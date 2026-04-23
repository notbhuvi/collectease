import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getOrCreateProfileForUser } from '@/lib/profile'
import { calculateTransportTotalFare, getLoadQuantity, parseNumericQuantity } from '@/lib/transport'

type BidLoadSummary = {
  bidding_deadline: string
  quantity_value?: number | null
  quantity_unit?: string | null
  weight?: string | null
}

function getBidLoad(load: BidLoadSummary | BidLoadSummary[] | null | undefined) {
  if (!load) return null
  return Array.isArray(load) ? load[0] ?? null : load
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = await createServiceClient()
  const profile = await getOrCreateProfileForUser(serviceClient, user, 'role')
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const loadId = searchParams.get('load_id')

  let query = serviceClient
    .from('transport_bids')
    .select(`*, load:transport_loads(pickup_location, drop_location, material, status, bidding_deadline, pickup_date), transporter:profiles!transporter_id(full_name, company_name)`)
    .order('created_at', { ascending: false })

  if (profile.role === 'transporter') {
    query = query.eq('transporter_id', user.id)
  }
  if (loadId) query = query.eq('load_id', loadId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ bids: data })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = await createServiceClient()
  const profile = await getOrCreateProfileForUser(serviceClient, user, 'role')
  if (!profile || profile.role !== 'transporter') {
    return NextResponse.json({ error: 'Only transporters can bid' }, { status: 403 })
  }

  const body = await request.json()
  const { load_id, bid_amount, remarks } = body

  if (!load_id || !bid_amount) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  // Verify load is open and deadline not passed
  const { data: load } = await serviceClient
    .from('transport_loads')
    .select('status, bidding_deadline, quantity_value, quantity_unit, weight')
    .eq('id', load_id)
    .single()

  if (!load || load.status !== 'open') {
    return NextResponse.json({ error: 'Load is not open for bidding' }, { status: 400 })
  }
  if (new Date(load.bidding_deadline) < new Date()) {
    return NextResponse.json({ error: 'Bidding deadline has passed' }, { status: 400 })
  }

  const rate = parseNumericQuantity(bid_amount)
  const quantity = getLoadQuantity(load)
  const totalAmount = calculateTransportTotalFare(quantity.quantityValue, rate)
  if (rate === null || totalAmount === null) {
    return NextResponse.json({ error: 'Invalid bid amount or load quantity' }, { status: 400 })
  }

  const { data, error } = await serviceClient
    .from('transport_bids')
    .upsert({
      load_id,
      transporter_id: user.id,
      bid_amount: rate,
      total_amount: totalAmount,
      remarks,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'load_id,transporter_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ bid: data }, { status: 201 })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = await createServiceClient()
  const profile = await getOrCreateProfileForUser(serviceClient, user, 'role')
  if (!profile || profile.role !== 'transporter') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { bid_id, bid_amount, remarks } = body

  // Verify ownership and deadline
  const { data: bid } = await serviceClient
    .from('transport_bids')
    .select(`*, load:transport_loads(status, bidding_deadline, quantity_value, quantity_unit, weight)`)
    .eq('id', bid_id)
    .eq('transporter_id', user.id)
    .single()

  if (!bid) return NextResponse.json({ error: 'Bid not found' }, { status: 404 })
  const load = getBidLoad(bid.load as BidLoadSummary | BidLoadSummary[] | null | undefined)
  if (!load) return NextResponse.json({ error: 'Related load not found' }, { status: 404 })
  if (new Date(load.bidding_deadline) < new Date()) {
    return NextResponse.json({ error: 'Bidding deadline has passed' }, { status: 400 })
  }

  const rate = parseNumericQuantity(bid_amount)
  const quantity = getLoadQuantity(load)
  const totalAmount = calculateTransportTotalFare(quantity.quantityValue, rate)
  if (rate === null || totalAmount === null) {
    return NextResponse.json({ error: 'Invalid bid amount or load quantity' }, { status: 400 })
  }

  const { data, error } = await serviceClient
    .from('transport_bids')
    .update({ bid_amount: rate, total_amount: totalAmount, remarks, updated_at: new Date().toISOString() })
    .eq('id', bid_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ bid: data })
}
