import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { purgeBillApproval, requireBillAccessContext } from '@/lib/bills'

export async function DELETE(request: Request) {
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

  const body = await request.json().catch(() => null)
  const billId = typeof body?.billId === 'string' ? body.billId : ''
  if (!billId) {
    return NextResponse.json({ error: 'Bill ID is required' }, { status: 400 })
  }

  const { data: bill, error: billError } = await serviceClient
    .from('bill_approvals')
    .select('*')
    .eq('id', billId)
    .single()

  if (billError || !bill) {
    return NextResponse.json({ error: billError?.message || 'Bill not found' }, { status: 404 })
  }

  if (profile.role === 'accounts' && bill.status !== 'approved') {
    return NextResponse.json({ error: 'Only approved bills can be removed from finance' }, { status: 403 })
  }

  try {
    await purgeBillApproval(serviceClient, bill, user.id)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove bill'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
