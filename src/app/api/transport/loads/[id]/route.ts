import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getOrCreateProfileForUser } from '@/lib/profile'
import { buildUpdatedLoadEmail, sendEmail } from '@/lib/messaging'

function buildLoadEmailPayload(load: {
  id: string
  pickup_location: string
  drop_location: string
  material: string
  weight: string
  vehicle_type: string
  pickup_date: string
  bidding_deadline: string
}) {
  return {
    loadId: load.id.slice(0, 8).toUpperCase(),
    pickup: load.pickup_location,
    drop: load.drop_location,
    material: load.material,
    weight: load.weight,
    vehicleType: load.vehicle_type,
    pickupDate: load.pickup_date,
    biddingDeadline: load.bidding_deadline,
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = await createServiceClient()
  const profile = await getOrCreateProfileForUser(serviceClient, user, 'role')
  if (!profile || (profile.role !== 'admin' && profile.role !== 'transport_team')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { pickup_location, drop_location, material, weight, vehicle_type, pickup_date, bidding_deadline, notes } = body

  if (!pickup_location || !drop_location || !material || !weight || !vehicle_type || !pickup_date || !bidding_deadline) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data: existingLoad, error: existingLoadError } = await serviceClient
    .from('transport_loads')
    .select('id, status')
    .eq('id', id)
    .single()

  if (existingLoadError || !existingLoad) {
    return NextResponse.json({ error: 'Load not found' }, { status: 404 })
  }

  if (existingLoad.status !== 'open') {
    return NextResponse.json({ error: 'Only open loads can be edited during bidding' }, { status: 400 })
  }

  const { data: updatedLoad, error: updateError } = await serviceClient
    .from('transport_loads')
    .update({
      pickup_location,
      drop_location,
      material,
      weight,
      vehicle_type,
      pickup_date,
      bidding_deadline,
      notes,
    })
    .eq('id', id)
    .select('*')
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  try {
    const { data: transporters } = await serviceClient
      .from('profiles')
      .select('email')
      .eq('role', 'transporter')
      .not('email', 'is', null)

    if (transporters && transporters.length > 0) {
      const emailCtx = buildLoadEmailPayload(updatedLoad)
      const subject = `✏️ Load Updated — ${updatedLoad.pickup_location} → ${updatedLoad.drop_location}`
      const emailBody = buildUpdatedLoadEmail(emailCtx)

      for (const transporter of transporters) {
        if (transporter.email) {
          sendEmail(transporter.email, subject, emailBody).catch(console.error)
        }
      }
    }
  } catch (emailErr) {
    console.error('Transporter update notification failed:', emailErr)
  }

  return NextResponse.json({ load: updatedLoad })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = await createServiceClient()
  const profile = await getOrCreateProfileForUser(serviceClient, user, 'role')
  if (!profile || (profile.role !== 'admin' && profile.role !== 'transport_team')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Delete in dependency order: awarded → bids → load
  await serviceClient.from('awarded_loads').delete().eq('load_id', id)
  await serviceClient.from('transport_bids').delete().eq('load_id', id)

  const { error } = await serviceClient.from('transport_loads').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
