import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 })

  const { data: load, error } = await supabase
    .from('transport_loads')
    .select(`*, creator:profiles!created_by(full_name, email), awarded:awarded_loads(id, final_amount, transporter_id, awarded_at, transporter:profiles!transporter_id(full_name, company_name))`)
    .eq('id', id)
    .single()

  if (error || !load) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // transporters can only see open loads
  if (profile.role === 'transporter' && load.status !== 'open') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch bids — transport_team/admin see all with transporter info; transporters see only own
  let bids: any[] = []
  if (['admin', 'transport_team'].includes(profile.role)) {
    const { data } = await supabase
      .from('transport_bids')
      .select(`*, transporter:profiles!transporter_id(full_name, company_name, email)`)
      .eq('load_id', id)
      .order('bid_amount', { ascending: true })
    bids = data || []
  } else if (profile.role === 'transporter') {
    const { data } = await supabase
      .from('transport_bids')
      .select('*')
      .eq('load_id', id)
      .eq('transporter_id', user.id)
    bids = data || []
  }

  return NextResponse.json({ load, bids })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'transport_team'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const serviceClient = await createServiceClient()
  const { data, error } = await serviceClient
    .from('transport_loads')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ load: data })
}
