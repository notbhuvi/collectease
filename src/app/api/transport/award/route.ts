import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendEmail, buildTransportWinnerEmail } from '@/lib/messaging'
import { generateTransportAwardPDF } from '@/lib/pdf'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'transport_team'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { load_id, transporter_id, final_amount } = body

  if (!load_id || !transporter_id || !final_amount) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const serviceClient = await createServiceClient()

  // Insert awarded_loads record
  const { data: award, error: awardError } = await serviceClient
    .from('awarded_loads')
    .upsert(
      {
        load_id,
        transporter_id,
        final_amount: Number(final_amount),
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
    const [{ data: load }, { data: winner }] = await Promise.all([
      serviceClient
        .from('transport_loads')
        .select('pickup_location, drop_location, material, weight, vehicle_type, pickup_date')
        .eq('id', load_id)
        .single(),
      serviceClient
        .from('profiles')
        .select('email, full_name, company_name')
        .eq('id', transporter_id)
        .single(),
    ])

    if (load && winner?.email) {
      const loadIdShort = load_id.slice(0, 8).toUpperCase()
      const subject = `🏆 You Won! Load ${loadIdShort} — Award Confirmation`
      const body = buildTransportWinnerEmail({
        transporterName: winner.company_name || winner.full_name || 'Transporter',
        loadId: loadIdShort,
        pickup: load.pickup_location,
        drop: load.drop_location,
        material: load.material,
        finalAmount: Number(final_amount),
        pickupDate: load.pickup_date,
      })

      // Generate PDF
      let pdfAttachment: { name: string; base64: string } | undefined
      try {
        const pdfBuffer = await generateTransportAwardPDF({
          loadId: loadIdShort,
          pickup: load.pickup_location,
          drop: load.drop_location,
          material: load.material,
          weight: load.weight,
          vehicleType: load.vehicle_type,
          finalAmount: Number(final_amount),
          transporterName: winner.company_name || winner.full_name || 'Transporter',
          pickupDate: load.pickup_date,
          awardedAt: new Date().toISOString(),
        })
        pdfAttachment = {
          name: `SIRPL-Award-${loadIdShort}.pdf`,
          base64: Buffer.from(pdfBuffer).toString('base64'),
        }
      } catch (pdfErr) {
        console.error('PDF generation failed:', pdfErr)
      }

      // Send winner email (fire-and-forget)
      sendEmail(winner.email, subject, body, 'friendly', pdfAttachment).catch(console.error)
    }
  } catch (emailErr) {
    console.error('Winner email failed:', emailErr)
  }

  return NextResponse.json({ award })
}
