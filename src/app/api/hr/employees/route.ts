import { NextResponse } from 'next/server'
import { getHrAccessContext } from '@/lib/hr'

export async function GET() {
  const context = await getHrAccessContext()
  if (!context) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await context.serviceClient
    .from('employees')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ employees: data || [] })
}

export async function POST(request: Request) {
  const context = await getHrAccessContext()
  if (!context) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const payload = {
    user_id: body.user_id || null,
    name: body.name?.trim(),
    email: body.email?.trim() || null,
    phone: body.phone?.trim() || null,
    department: body.department?.trim() || null,
    designation: body.designation?.trim() || null,
    joining_date: body.joining_date || null,
    salary: body.salary === '' || body.salary === null || body.salary === undefined ? null : Number(body.salary),
    status: body.status || 'active',
  }

  if (!payload.name) {
    return NextResponse.json({ error: 'Employee name is required' }, { status: 400 })
  }

  const { data, error } = await context.serviceClient
    .from('employees')
    .insert(payload)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ employee: data }, { status: 201 })
}

export async function PATCH(request: Request) {
  const context = await getHrAccessContext()
  if (!context) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  if (!body.id) {
    return NextResponse.json({ error: 'Employee id is required' }, { status: 400 })
  }

  const payload = {
    user_id: body.user_id || null,
    name: body.name?.trim(),
    email: body.email?.trim() || null,
    phone: body.phone?.trim() || null,
    department: body.department?.trim() || null,
    designation: body.designation?.trim() || null,
    joining_date: body.joining_date || null,
    salary: body.salary === '' || body.salary === null || body.salary === undefined ? null : Number(body.salary),
    status: body.status || 'active',
  }

  if (!payload.name) {
    return NextResponse.json({ error: 'Employee name is required' }, { status: 400 })
  }

  const { data, error } = await context.serviceClient
    .from('employees')
    .update(payload)
    .eq('id', body.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ employee: data })
}

export async function DELETE(request: Request) {
  const context = await getHrAccessContext()
  if (!context) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  if (!body.id) {
    return NextResponse.json({ error: 'Employee id is required' }, { status: 400 })
  }

  const { error } = await context.serviceClient
    .from('employees')
    .delete()
    .eq('id', body.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
