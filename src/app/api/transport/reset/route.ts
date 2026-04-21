import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'transport_team'].includes(profile.role)) {
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

  // Delete only completed/awarded loads (preserve open/closed/active ones)
  // First get IDs of completed and awarded loads
  const { data: completedLoads } = await serviceClient
    .from('transport_loads')
    .select('id')
    .in('status', ['completed', 'awarded'])

  const loadIds = (completedLoads || []).map(l => l.id)

  if (loadIds.length > 0) {
    // Delete bids for those loads
    await serviceClient.from('transport_bids').delete().in('load_id', loadIds)
    // Delete awards for those loads
    await serviceClient.from('awarded_loads').delete().in('load_id', loadIds)
    // Delete the loads themselves
    await serviceClient.from('transport_loads').delete().in('id', loadIds)
  }

  return NextResponse.json({ success: true, cleared: loadIds.length })
}
