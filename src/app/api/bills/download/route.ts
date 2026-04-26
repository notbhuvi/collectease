import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  BILL_RETENTION_DAYS,
  BILL_UPLOAD_BUCKET,
  formatStampedBillFileName,
  getBillDeleteAfterDate,
  requireBillAccessContext,
} from '@/lib/bills'

export async function POST(request: Request) {
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

  if (profile.role !== 'admin' && profile.role !== 'accounts' && bill.uploaded_by !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (bill.status !== 'approved' || !bill.stamped_file_url) {
    return NextResponse.json({ error: 'Stamped bill is not available yet' }, { status: 409 })
  }

  try {
    const { data: stampedFile, error: downloadError } = await serviceClient.storage
      .from(BILL_UPLOAD_BUCKET)
      .download(bill.stamped_file_url)

    if (downloadError || !stampedFile) {
      return NextResponse.json({ error: downloadError?.message || 'Unable to fetch stamped bill' }, { status: 500 })
    }

    const arrayBuffer = await stampedFile.arrayBuffer()
    const deleteAfterAt = getBillDeleteAfterDate()

    const { error: updateError } = await serviceClient
      .from('bill_approvals')
      .update({
        downloaded_at: new Date().toISOString(),
        delete_after_at: deleteAfterAt.toISOString(),
      })
      .eq('id', bill.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return new NextResponse(Buffer.from(arrayBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${formatStampedBillFileName(bill.original_name, bill.status)}"`,
        'Cache-Control': 'no-store',
        'X-Bill-Delete-After': deleteAfterAt.toISOString(),
        'X-Bill-Retention-Days': String(BILL_RETENTION_DAYS),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to download bill'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
