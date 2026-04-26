import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { listBillsForViewer, requireBillAccessContext } from '@/lib/bills'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceClient = await createServiceClient()
  const profile = await requireBillAccessContext(serviceClient, user)

  if (profile.role !== 'admin' && profile.role !== 'accounts') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const statusParam = new URL(request.url).searchParams.get('status')
  const status = statusParam === 'pending' || statusParam === 'approved' || statusParam === 'declined'
    ? statusParam
    : undefined

  try {
    const bills = await listBillsForViewer(serviceClient, user, profile, { status })
    return NextResponse.json({ bills })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load bills'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
