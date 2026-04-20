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

  const body = await request.json()
  const { load_id, transporter_id, final_amount } = body

  if (!load_id || !transporter_id || !final_amount) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const serviceClient = await createServiceClient()

  // Insert awarded_loads record
  const { data: award, error: awardError } = await serviceClient
    .from('awarded_loads')
    .upsert({ load_id, transporter_id, final_amount: Number(final_amount), awarded_by: user.id, awarded_at: new Date().toISOString() }, { onConflict: 'load_id' })
    .select()
    .single()

  if (awardError) return NextResponse.json({ error: awardError.message }, { status: 500 })

  // Update load status to awarded
  await serviceClient.from('transport_loads').update({ status: 'awarded' }).eq('id', load_id)

  return NextResponse.json({ award })
}
