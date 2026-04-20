import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { password } = await request.json()
  if (!password) return NextResponse.json({ error: 'Password is required' }, { status: 400 })

  // Verify password by re-authenticating
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password,
  })
  if (authError) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
  }

  // Get business
  const { data: business } = await supabase
    .from('businesses').select('id').eq('user_id', user.id).single()
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  const bId = business.id

  // Use service role to delete everything — bypasses RLS cascade issues
  const service = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  // Delete in dependency order
  await service.from('escalation_logs').delete().eq('business_id', bId)
  await service.from('reminders').delete().eq('business_id', bId)
  await service.from('payments').delete().eq('business_id', bId)
  await service.from('invoices').delete().eq('business_id', bId)
  await service.from('clients').delete().eq('business_id', bId)

  return NextResponse.json({ success: true })
}
