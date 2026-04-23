import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getOrCreateProfileForUser } from '@/lib/profile'
import { buildUpdatedLoadEmail, sendEmail } from '@/lib/messaging'
import { formatLoadQuantity, normalizeTransportQuantityUnit, parseNumericQuantity } from '@/lib/transport'

function buildLoadEmailPayload(load: {
  id: string
  pickup_location: string
  drop_location: string
  material: string
  weight: string
  quantity_value?: number | null
  quantity_unit?: string | null
  vehicle_type: string
  pickup_date: string
  bidding_deadline: string
}) {
  return {
    loadId: load.id.slice(0, 8).toUpperCase(),
    pickup: load.pickup_location,
    drop: load.drop_location,
    material: load.material,
    quantity: formatLoadQuantity(load),
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
  const { pickup_location, drop_location, material, quantity_value, quantity_unit, vehicle_type, pickup_date, bidding_deadline, notes } = body
  const parsedQuantity = parseNumericQuantity(quantity_value)
  const normalizedUnit = normalizeTransportQuantityUnit(quantity_unit)

  if (!pickup_location || !drop_location || !material || parsedQuantity === null || !vehicle_type || !pickup_date || !bidding_deadline) {
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
      weight: formatLoadQuantity({ quantity_value: parsedQuantity, quantity_unit: normalizedUnit }),
      quantity_value: parsedQuantity,
      quantity_unit: normalizedUnit,
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

      const emailJobs = transporters
        .filter(transporter => !!transporter.email)
        .map(transporter =>
          sendEmail(transporter.email!, subject, emailBody, 'friendly', undefined, undefined, { department: 'transport' })
        )

      const emailResults = await Promise.allSettled(emailJobs)
      for (const result of emailResults) {
        if (result.status === 'rejected') {
          console.error('Transporter update notification failed:', result.reason)
          continue
        }

        if (!result.value.success) {
          console.error('Transporter update notification failed:', {
            error: result.value.error,
            provider: result.value.provider,
          })
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
