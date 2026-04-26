import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  BILL_UPLOAD_BUCKET,
  buildStampedBillPath,
  notifyUploaderOfDecision,
  requireBillAccessContext,
  stampBillDocument,
} from '@/lib/bills'

export async function POST(request: Request) {
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
  const decision = body?.decision === 'approved' || body?.decision === 'declined'
    ? body.decision
    : null
  const remark = typeof body?.remark === 'string' ? body.remark.trim() : ''

  if (!billId || !decision || !remark) {
    return NextResponse.json({ error: 'Bill, decision, and remark are required' }, { status: 400 })
  }

  const { data: bill, error: billError } = await serviceClient
    .from('bill_approvals')
    .select('*')
    .eq('id', billId)
    .single()

  if (billError || !bill) {
    return NextResponse.json({ error: billError?.message || 'Bill not found' }, { status: 404 })
  }

  if (bill.status !== 'pending') {
    return NextResponse.json({ error: 'Bill has already been decided' }, { status: 409 })
  }

  if (!bill.file_url || !bill.file_type) {
    return NextResponse.json({ error: 'Original bill file is missing' }, { status: 400 })
  }

  try {
    const { data: sourceFile, error: downloadError } = await serviceClient.storage
      .from(BILL_UPLOAD_BUCKET)
      .download(bill.file_url)

    if (downloadError || !sourceFile) {
      return NextResponse.json({ error: downloadError?.message || 'Unable to load source bill' }, { status: 500 })
    }

    const decidedAt = new Date()
    const stampedBytes = await stampBillDocument({
      inputBytes: new Uint8Array(await sourceFile.arrayBuffer()),
      fileType: bill.file_type,
      decision,
      adminName: profile.full_name || user.email || 'Admin',
      decidedAt,
    })

    const stampedPath = buildStampedBillPath(bill.id)
    const { error: uploadError } = await serviceClient.storage
      .from(BILL_UPLOAD_BUCKET)
      .upload(stampedPath, Buffer.from(stampedBytes), {
        upsert: true,
        contentType: 'application/pdf',
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: updated, error: updateError } = await serviceClient
      .from('bill_approvals')
      .update({
        status: decision,
        admin_id: user.id,
        admin_remark: remark,
        stamped_file_url: stampedPath,
        decided_at: decidedAt.toISOString(),
      })
      .eq('id', bill.id)
      .select('*')
      .single()

    if (updateError || !updated) {
      return NextResponse.json({ error: updateError?.message || 'Failed to update bill' }, { status: 500 })
    }

    void notifyUploaderOfDecision(serviceClient, updated, updated.uploaded_by, profile.full_name || user.email || 'Admin')

    return NextResponse.json({ bill: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to stamp bill'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
