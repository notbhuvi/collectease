import { NextResponse } from 'next/server'
import { getHrAccessContext, normalizeAttendanceRecords } from '@/lib/hr'
import type { AttendanceRecord } from '@/types'

export async function GET(request: Request) {
  const context = await getHrAccessContext()
  if (!context) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const employeeId = searchParams.get('employee_id')
  const date = searchParams.get('date')

  let query = context.serviceClient
    .from('attendance')
    .select('id, employee_id, date, check_in, check_out, status, biometric_ref, created_at, employee:employees(id, name, department, designation)')
    .order('date', { ascending: false })

  if (employeeId) {
    query = query.eq('employee_id', employeeId)
  }

  if (date) {
    query = query.eq('date', date)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ attendance: normalizeAttendanceRecords((data || []) as unknown as AttendanceRecord[]) })
}

export async function POST(request: Request) {
  const context = await getHrAccessContext()
  if (!context) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  if (!body.employee_id || !body.date || !body.status) {
    return NextResponse.json({ error: 'Employee, date and status are required' }, { status: 400 })
  }

  const payload = {
    employee_id: body.employee_id,
    date: body.date,
    check_in: body.check_in || null,
    check_out: body.check_out || null,
    status: body.status,
    biometric_ref: body.biometric_ref?.trim() || null,
  }

  const { data, error } = await context.serviceClient
    .from('attendance')
    .upsert(payload, { onConflict: 'employee_id,date' })
    .select('id, employee_id, date, check_in, check_out, status, biometric_ref, created_at, employee:employees(id, name, department, designation)')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ attendance: normalizeAttendanceRecords([data] as unknown as AttendanceRecord[])[0] }, { status: 201 })
}

export async function DELETE(request: Request) {
  const context = await getHrAccessContext()
  if (!context) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  if (!body.id) {
    return NextResponse.json({ error: 'Attendance id is required' }, { status: 400 })
  }

  const { error } = await context.serviceClient
    .from('attendance')
    .delete()
    .eq('id', body.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
