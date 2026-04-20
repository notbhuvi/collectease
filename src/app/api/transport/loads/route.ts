import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function getProfile(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).single()
  return data
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getProfile(supabase, user.id)
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 })

  let query = supabase
    .from('transport_loads')
    .select(`*, creator:profiles!created_by(full_name, email), awarded:awarded_loads(id, final_amount, transporter_id, awarded_at, transporter:profiles!transporter_id(full_name, company_name))`)
    .order('created_at', { ascending: false })

  // transporters only see open loads
  if (profile.role === 'transporter') {
    query = query.eq('status', 'open')
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ loads: data })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getProfile(supabase, user.id)
  if (!profile || !['admin', 'transport_team'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { pickup_location, drop_location, material, weight, vehicle_type, pickup_date, bidding_deadline, notes } = body

  if (!pickup_location || !drop_location || !material || !weight || !vehicle_type || !pickup_date || !bidding_deadline) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const serviceClient = await createServiceClient()
  const { data, error } = await serviceClient
    .from('transport_loads')
    .insert({ created_by: user.id, pickup_location, drop_location, material, weight, vehicle_type, pickup_date, bidding_deadline, notes, status: 'open' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ load: data }, { status: 201 })
}
