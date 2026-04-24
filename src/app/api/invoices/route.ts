import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getProfileForUser } from '@/lib/profile'
import { getAccessibleBusinessForUser } from '@/lib/business'
import type { UserRole } from '@/types'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = await createServiceClient()
  const profile = await getProfileForUser(serviceClient, user, 'role')
  const business = await getAccessibleBusinessForUser(serviceClient, user, profile?.role as UserRole)

  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  let query = serviceClient
    .from('invoices')
    .select('*, client:clients(id, name, email, phone)')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ invoices: data })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = await createServiceClient()
  const profile = await getProfileForUser(serviceClient, user, 'role')
  const business = await getAccessibleBusinessForUser(serviceClient, user, profile?.role as UserRole)
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  const body = await request.json()

  if (body.business_id && body.business_id !== business.id) {
    return NextResponse.json({ error: 'Invalid business' }, { status: 403 })
  }

  const { data, error } = await serviceClient
    .from('invoices')
    .insert({
      business_id: business.id,
      client_id: body.client_id,
      invoice_number: body.invoice_number,
      amount: body.amount,
      tax_amount: body.tax_amount || 0,
      total_amount: body.total_amount,
      due_date: body.due_date,
      issue_date: body.issue_date || new Date().toISOString().split('T')[0],
      description: body.description,
      notes: body.notes,
      status: body.status || 'sent',
      reminder_initial_delay: body.reminder_initial_delay ?? 0,
      reminder_interval_days: body.reminder_interval_days ?? 7,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ invoice: data }, { status: 201 })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = await createServiceClient()
  const profile = await getProfileForUser(serviceClient, user, 'role')
  const business = await getAccessibleBusinessForUser(serviceClient, user, profile?.role as UserRole)
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  const body = await request.json()
  const { id, ...updates } = body

  const { data: inv } = await serviceClient
    .from('invoices')
    .select('business_id')
    .eq('id', id)
    .single()

  if (!inv || inv.business_id !== business.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data, error } = await serviceClient
    .from('invoices')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ invoice: data })
}
