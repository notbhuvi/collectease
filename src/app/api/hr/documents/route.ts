import { NextResponse } from 'next/server'
import {
  attachSignedUrlsToDocuments,
  attachSignedUrlsToPolicies,
  getFileNameFromPath,
  getHrAccessContext,
  normalizeEmployeeDocuments,
} from '@/lib/hr'
import { HR_DOCUMENT_BUCKET } from '@/lib/hr-constants'
import type { EmployeeDocument } from '@/types'

export async function GET() {
  const context = await getHrAccessContext()
  if (!context) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [documentsResult, policiesResult] = await Promise.all([
    context.serviceClient
      .from('employee_documents')
      .select('id, employee_id, doc_type, file_url, expires_on, created_at, employee:employees(id, name, department)')
      .order('created_at', { ascending: false }),
    context.serviceClient
      .from('hr_policy_documents')
      .select('id, title, file_url, created_by, created_at')
      .order('created_at', { ascending: false }),
  ])

  if (documentsResult.error) {
    return NextResponse.json({ error: documentsResult.error.message }, { status: 500 })
  }

  if (policiesResult.error) {
    return NextResponse.json({ error: policiesResult.error.message }, { status: 500 })
  }

  const [documents, policies] = await Promise.all([
    attachSignedUrlsToDocuments(context.serviceClient, normalizeEmployeeDocuments((documentsResult.data || []) as unknown as EmployeeDocument[])),
    attachSignedUrlsToPolicies(context.serviceClient, policiesResult.data || []),
  ])

  return NextResponse.json({
    documents: documents.map(document => ({ ...document, file_name: getFileNameFromPath(document.file_url) })),
    policies: policies.map(policy => ({ ...policy, file_name: getFileNameFromPath(policy.file_url) })),
  })
}

export async function POST(request: Request) {
  const context = await getHrAccessContext()
  if (!context) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const formData = await request.formData()
  const kind = String(formData.get('kind') || 'employee')
  const file = formData.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'A file is required' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
  const folder = kind === 'policy'
    ? `policies/${Date.now()}`
    : `employees/${String(formData.get('employee_id') || 'unassigned')}/${Date.now()}`
  const storagePath = `${folder}-${safeName}`

  const uploadResult = await context.serviceClient.storage
    .from(HR_DOCUMENT_BUCKET)
    .upload(storagePath, buffer, { contentType: file.type || 'application/octet-stream', upsert: false })

  if (uploadResult.error) {
    return NextResponse.json({ error: uploadResult.error.message }, { status: 500 })
  }

  if (kind === 'policy') {
    const title = String(formData.get('title') || '').trim()
    if (!title) {
      await context.serviceClient.storage.from(HR_DOCUMENT_BUCKET).remove([storagePath])
      return NextResponse.json({ error: 'Policy title is required' }, { status: 400 })
    }

    const { data, error } = await context.serviceClient
      .from('hr_policy_documents')
      .insert({
        title,
        file_url: storagePath,
        created_by: context.user.id,
      })
      .select('id, title, file_url, created_by, created_at')
      .single()

    if (error) {
      await context.serviceClient.storage.from(HR_DOCUMENT_BUCKET).remove([storagePath])
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const [policy] = await attachSignedUrlsToPolicies(context.serviceClient, [data])
    return NextResponse.json({ policy: { ...policy, file_name: getFileNameFromPath(policy.file_url) } }, { status: 201 })
  }

  const employeeId = String(formData.get('employee_id') || '')
  const docType = String(formData.get('doc_type') || '').trim()
  const expiresOn = String(formData.get('expires_on') || '').trim()

  if (!employeeId || !docType) {
    await context.serviceClient.storage.from(HR_DOCUMENT_BUCKET).remove([storagePath])
    return NextResponse.json({ error: 'Employee and document type are required' }, { status: 400 })
  }

  const { data, error } = await context.serviceClient
    .from('employee_documents')
    .insert({
      employee_id: employeeId,
      doc_type: docType,
      file_url: storagePath,
      expires_on: expiresOn || null,
    })
    .select('id, employee_id, doc_type, file_url, expires_on, created_at, employee:employees(id, name, department)')
    .single()

  if (error) {
    await context.serviceClient.storage.from(HR_DOCUMENT_BUCKET).remove([storagePath])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const [document] = await attachSignedUrlsToDocuments(context.serviceClient, normalizeEmployeeDocuments([data] as unknown as EmployeeDocument[]))
  return NextResponse.json({ document: { ...document, file_name: getFileNameFromPath(document.file_url) } }, { status: 201 })
}

export async function DELETE(request: Request) {
  const context = await getHrAccessContext()
  if (!context) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const kind = body.kind === 'policy' ? 'policy' : 'employee'
  if (!body.id) {
    return NextResponse.json({ error: 'Document id is required' }, { status: 400 })
  }

  if (kind === 'policy') {
    const { data, error } = await context.serviceClient
      .from('hr_policy_documents')
      .select('file_url')
      .eq('id', body.id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await context.serviceClient.storage.from(HR_DOCUMENT_BUCKET).remove([data.file_url])
    const remove = await context.serviceClient.from('hr_policy_documents').delete().eq('id', body.id)
    if (remove.error) {
      return NextResponse.json({ error: remove.error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  }

  const { data, error } = await context.serviceClient
    .from('employee_documents')
    .select('file_url')
    .eq('id', body.id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await context.serviceClient.storage.from(HR_DOCUMENT_BUCKET).remove([data.file_url])
  const remove = await context.serviceClient.from('employee_documents').delete().eq('id', body.id)
  if (remove.error) {
    return NextResponse.json({ error: remove.error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
