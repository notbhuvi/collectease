import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  ALLOWED_BILL_MIME_TYPES,
  BILL_UPLOAD_BUCKET,
  MAX_BILL_SIZE_BYTES,
  buildBillStoragePath,
  ensureBillUploadBucket,
  isAllowedBillMimeType,
  notifyAdminsOfBillUpload,
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
  if (profile.role !== 'accounts' && profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'File is required' }, { status: 400 })
  }

  if (!isAllowedBillMimeType(file.type)) {
    return NextResponse.json({
      error: `Unsupported file type. Allowed types: ${ALLOWED_BILL_MIME_TYPES.join(', ')}`,
    }, { status: 400 })
  }

  if (file.size > MAX_BILL_SIZE_BYTES) {
    return NextResponse.json({ error: 'File exceeds 10MB limit' }, { status: 400 })
  }

  try {
    await ensureBillUploadBucket(serviceClient)

    const { data: inserted, error: insertError } = await serviceClient
      .from('bill_approvals')
      .insert({
        uploaded_by: user.id,
        file_type: file.type,
        original_name: file.name,
        status: 'pending',
      })
      .select('*')
      .single()

    if (insertError || !inserted) {
      return NextResponse.json({ error: insertError?.message || 'Failed to create bill record' }, { status: 500 })
    }

    const storagePath = buildBillStoragePath(user.id, inserted.id, file.type)
    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await serviceClient.storage
      .from(BILL_UPLOAD_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      await serviceClient.from('bill_approvals').delete().eq('id', inserted.id)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: updated, error: updateError } = await serviceClient
      .from('bill_approvals')
      .update({ file_url: storagePath })
      .eq('id', inserted.id)
      .select('*')
      .single()

    if (updateError || !updated) {
      return NextResponse.json({ error: updateError?.message || 'Failed to update bill record' }, { status: 500 })
    }

    void notifyAdminsOfBillUpload(serviceClient, updated, profile, user.email)

    return NextResponse.json({ bill: updated }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upload bill'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
