import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { BILL_UPLOAD_BUCKET, requireBillAccessContext } from '@/lib/bills'

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceClient = await createServiceClient()
  const profile = await requireBillAccessContext(serviceClient, user)
  if (profile.role !== 'admin') {
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

  const pathsToDelete = [bill.file_url, bill.stamped_file_url].filter(Boolean)
  if (pathsToDelete.length > 0) {
    const { error: removeError } = await serviceClient.storage
      .from(BILL_UPLOAD_BUCKET)
      .remove(pathsToDelete)

    if (removeError) {
      return NextResponse.json({ error: removeError.message }, { status: 500 })
    }
  }

  const { error: logError } = await serviceClient
    .from('bill_logs')
    .insert({
      bill_id: bill.id,
      uploaded_by: bill.uploaded_by,
      status: bill.status,
      remark: bill.admin_remark,
      action_by: bill.admin_id,
    })

  if (logError) {
    return NextResponse.json({ error: logError.message }, { status: 500 })
  }

  const { error: deleteError } = await serviceClient
    .from('bill_approvals')
    .delete()
    .eq('id', bill.id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
