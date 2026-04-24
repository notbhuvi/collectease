import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getOrCreateProfileForUser } from '@/lib/profile'
import { calculateTransportTotalFare, getLoadQuantity, parseNumericQuantity } from '@/lib/transport'

// DELETE — admin can delete any bid; transport_team can delete only before bidding ends
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

  const { data: existingBid, error: bidError } = await serviceClient
    .from('transport_bids')
    .select('id, load_id, load:transport_loads(status, bidding_deadline)')
    .eq('id', id)
    .single()

  if (bidError || !existingBid) {
    return NextResponse.json({ error: 'Bid not found' }, { status: 404 })
  }

  const load = Array.isArray(existingBid.load) ? existingBid.load[0] : existingBid.load
  if (!load) {
    return NextResponse.json({ error: 'Related load not found' }, { status: 404 })
  }

  const deadlinePassed = new Date(load.bidding_deadline) < new Date()
  const isAdmin = profile.role === 'admin'
  if (!isAdmin && (load.status !== 'open' || deadlinePassed)) {
    return NextResponse.json(
      { error: 'Only admin can delete a bid after the bidding period has ended. It is otherwise kept as history.' },
      { status: 400 }
    )
  }

  const { error } = await serviceClient.from('transport_bids').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePath('/transport')
  revalidatePath('/transport/loads')
  revalidatePath(`/transport/loads/${existingBid.load_id}`)
  return NextResponse.json({ success: true })
}

// PATCH — transport_team/admin can edit any bid
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
  const { bid_amount, remarks } = body

  const { data: existingBid, error: bidError } = await serviceClient
    .from('transport_bids')
    .select('id, load:transport_loads(quantity_value, quantity_unit, weight)')
    .eq('id', id)
    .single()

  if (bidError || !existingBid) {
    return NextResponse.json({ error: 'Bid not found' }, { status: 404 })
  }

  const rate = parseNumericQuantity(bid_amount)
  const quantity = getLoadQuantity(existingBid.load as { quantity_value?: number | null; quantity_unit?: string | null; weight?: string | null })
  const totalAmount = calculateTransportTotalFare(quantity.quantityValue, rate)
  if (rate === null || totalAmount === null) {
    return NextResponse.json({ error: 'Invalid bid amount or load quantity' }, { status: 400 })
  }

  const { data, error } = await serviceClient
    .from('transport_bids')
    .update({ bid_amount: rate, total_amount: totalAmount, remarks, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ bid: data })
}
