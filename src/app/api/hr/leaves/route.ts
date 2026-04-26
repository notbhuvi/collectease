import { NextResponse } from 'next/server'
import { getHrAccessContext, normalizeLeaveRecords } from '@/lib/hr'
import type { LeaveRecord } from '@/types'

export async function GET() {
  const context = await getHrAccessContext()
  if (!context) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await context.serviceClient
    .from('leaves')
    .select('id, employee_id, type, from_date, to_date, status, approved_by, reason, created_at, employee:employees(id, name, department, designation)')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ leaves: normalizeLeaveRecords((data || []) as unknown as LeaveRecord[]) })
}

export async function POST(request: Request) {
  const context = await getHrAccessContext()
  if (!context) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  if (!body.employee_id || !body.type || !body.from_date || !body.to_date) {
    return NextResponse.json({ error: 'Employee, leave type and dates are required' }, { status: 400 })
  }

  const { data, error } = await context.serviceClient
    .from('leaves')
    .insert({
      employee_id: body.employee_id,
      type: body.type,
      from_date: body.from_date,
      to_date: body.to_date,
      status: body.status || 'pending',
      approved_by: body.status === 'approved' || body.status === 'rejected' ? context.user.id : null,
      reason: body.reason?.trim() || null,
    })
    .select('id, employee_id, type, from_date, to_date, status, approved_by, reason, created_at, employee:employees(id, name, department, designation)')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ leave: normalizeLeaveRecords([data] as unknown as LeaveRecord[])[0] }, { status: 201 })
}

export async function PATCH(request: Request) {
  const context = await getHrAccessContext()
  if (!context) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  if (!body.id) {
    return NextResponse.json({ error: 'Leave id is required' }, { status: 400 })
  }

  const payload = {
    type: body.type,
    from_date: body.from_date,
    to_date: body.to_date,
    status: body.status,
    approved_by: body.status === 'approved' || body.status === 'rejected' ? context.user.id : null,
    reason: body.reason?.trim() || null,
  }

  const { data, error } = await context.serviceClient
    .from('leaves')
    .update(payload)
    .eq('id', body.id)
    .select('id, employee_id, type, from_date, to_date, status, approved_by, reason, created_at, employee:employees(id, name, department, designation)')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ leave: normalizeLeaveRecords([data] as unknown as LeaveRecord[])[0] })
}

export async function DELETE(request: Request) {
  const context = await getHrAccessContext()
  if (!context) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  if (!body.id) {
    return NextResponse.json({ error: 'Leave id is required' }, { status: 400 })
  }

  const { error } = await context.serviceClient
    .from('leaves')
    .delete()
    .eq('id', body.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
