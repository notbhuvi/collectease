import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'transporter') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { password } = await request.json()
  if (!password) return NextResponse.json({ error: 'Password is required' }, { status: 400 })

  // Verify password
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password,
  })
  if (authError) return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })

  const serviceClient = await createServiceClient()

  // Delete own bids on completed/awarded loads only
  const { data: myBids } = await serviceClient
    .from('transport_bids')
    .select('id, load_id, load:transport_loads(status)')
    .eq('transporter_id', user.id)

  const oldBidIds = (myBids || [])
    .filter(b => {
      const status = (b.load as any)?.status
      return status === 'completed' || status === 'awarded'
    })
    .map(b => b.id)

  if (oldBidIds.length > 0) {
    await serviceClient.from('transport_bids').delete().in('id', oldBidIds)
  }

  return NextResponse.json({ success: true, cleared: oldBidIds.length })
}
