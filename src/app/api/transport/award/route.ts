import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendEmail, buildTransportWinnerEmail } from '@/lib/messaging'
import { generateTransportAwardPDF } from '@/lib/pdf'
import { getOrCreateProfileForUser } from '@/lib/profile'
import { calculateTransportTotalFare, formatLoadQuantity, getLoadQuantity } from '@/lib/transport'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = await createServiceClient()
  const profile = await getOrCreateProfileForUser(serviceClient, user, 'role')
  if (!profile || (profile.role !== 'admin' && profile.role !== 'transport_team')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { load_id, transporter_id } = body

  if (!load_id || !transporter_id) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const [{ data: load }, { data: winningBid }] = await Promise.all([
    serviceClient
      .from('transport_loads')
      .select('pickup_location, drop_location, material, weight, quantity_value, quantity_unit, vehicle_type, pickup_date')
      .eq('id', load_id)
      .single(),
    serviceClient
      .from('transport_bids')
      .select('bid_amount, total_amount')
      .eq('load_id', load_id)
      .eq('transporter_id', transporter_id)
      .single(),
  ])

  if (!load || !winningBid) {
    return NextResponse.json({ error: 'Load or winning bid not found' }, { status: 404 })
  }

  const quantity = getLoadQuantity(load)
  const totalFare = winningBid.total_amount ?? calculateTransportTotalFare(quantity.quantityValue, winningBid.bid_amount)
  if (totalFare === null) {
    return NextResponse.json({ error: 'Unable to calculate total fare' }, { status: 400 })
  }

  // Insert awarded_loads record
  const { data: award, error: awardError } = await serviceClient
    .from('awarded_loads')
    .upsert(
      {
        load_id,
        transporter_id,
        final_amount: Number(totalFare),
        awarded_by: user.id,
        awarded_at: new Date().toISOString(),
      },
      { onConflict: 'load_id' }
    )
    .select()
    .single()

  if (awardError) return NextResponse.json({ error: awardError.message }, { status: 500 })

  // Update load status to awarded
  await serviceClient.from('transport_loads').update({ status: 'awarded' }).eq('id', load_id)

  // Fetch load details + winner profile for email/PDF
  try {
    const [{ data: winner }] = await Promise.all([
      serviceClient
        .from('profiles')
        .select('email, full_name, company_name')
        .eq('id', transporter_id)
        .single(),
    ])

    if (load && winner?.email) {
      const awardDate = new Date().toLocaleDateString('en-IN')
      const refNumber = `SIRPL/TD/${new Date().getFullYear().toString().slice(-2)}-${new Date().getFullYear().toString().slice(-2)}/${load_id.slice(0, 8).toUpperCase()}`
      const quantityText = formatLoadQuantity(load)
      const rateText = `Rs. ${Number(winningBid.bid_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/${quantity.quantityUnit}`
      const totalFareText = `Rs. ${Number(totalFare).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      const subject = `Work Order - ${load.pickup_location} to ${load.drop_location}`
      const body = buildTransportWinnerEmail({
        transporterName: winner.company_name || winner.full_name || 'Transporter',
        transporterEmail: winner.email,
        refNumber,
        date: awardDate,
        pickup: load.pickup_location,
        drop: load.drop_location,
        material: load.material,
        quantity: quantityText,
        vehicleType: load.vehicle_type,
        rate: rateText,
        totalFare: totalFareText,
        pickupDate: load.pickup_date,
      })

      // Generate PDF
      let pdfAttachment: { name: string; base64: string } | undefined
      try {
        const pdfBuffer = await generateTransportAwardPDF({
          refNumber,
          date: awardDate,
          pickup: load.pickup_location,
          drop: load.drop_location,
          material: load.material,
          quantity: quantityText,
          vehicleType: load.vehicle_type,
          transporterName: winner.company_name || winner.full_name || 'Transporter',
          transporterEmail: winner.email,
          pickupDate: load.pickup_date,
          rate: rateText,
          totalFare: totalFareText,
        })
        pdfAttachment = {
          name: `SIRPL-Work-Order-${load_id.slice(0, 8).toUpperCase()}.pdf`,
          base64: Buffer.from(pdfBuffer).toString('base64'),
        }
      } catch (pdfErr) {
        console.error('PDF generation failed:', pdfErr)
      }

      const emailResult = await sendEmail(
        winner.email,
        subject,
        body,
        'friendly',
        pdfAttachment,
        undefined,
        { department: 'transport' }
      )

      if (!emailResult.success) {
        console.error('Winner email failed:', emailResult.error)
      }
    }
  } catch (emailErr) {
    console.error('Winner email failed:', emailErr)
  }

  return NextResponse.json({ award })
}
