import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getProfileForUser } from '@/lib/profile'
import { getAccessibleBusinessForUser } from '@/lib/business'
import type { UserRole } from '@/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = await createServiceClient()
  const profile = await getProfileForUser(serviceClient, user, 'role')
  const business = await getAccessibleBusinessForUser(serviceClient, user, profile?.role as UserRole)
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  const body = await request.json()

  // Get the invoice + verify ownership
  const { data: invoice } = await serviceClient
    .from('invoices')
    .select('id, business_id, total_amount')
    .eq('id', body.invoice_id)
    .single()

  if (!invoice || invoice.business_id !== business.id) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  // Record payment
  const { data: payment, error: paymentError } = await serviceClient
    .from('payments')
    .insert({
      invoice_id: body.invoice_id,
      business_id: invoice.business_id,
      amount: body.amount,
      payment_date: body.payment_date,
      payment_method: body.payment_method,
      reference: body.reference,
      notes: body.notes,
    })
    .select()
    .single()

  if (paymentError) return NextResponse.json({ error: paymentError.message }, { status: 500 })

  // Sum all payments to get running total
  const { data: allPayments } = await serviceClient
    .from('payments')
    .select('amount')
    .eq('invoice_id', body.invoice_id)

  const totalPaid = (allPayments || []).reduce((sum, p) => sum + Number(p.amount), 0)
  const isFullyPaid = totalPaid >= invoice.total_amount

  // Only mark 'paid' when fully settled; keep sent/overdue + track paid_amount for partial
  const invoiceUpdate: Record<string, unknown> = { paid_amount: totalPaid }
  if (isFullyPaid) {
    invoiceUpdate.status = 'paid'
    invoiceUpdate.paid_at = new Date().toISOString()
  }

  const { error: updateError } = await serviceClient
    .from('invoices')
    .update(invoiceUpdate)
    .eq('id', body.invoice_id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ payment, totalPaid, isFullyPaid }, { status: 201 })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = await createServiceClient()
  const profile = await getProfileForUser(serviceClient, user, 'role')
  const business = await getAccessibleBusinessForUser(serviceClient, user, profile?.role as UserRole)

  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  const { data, error } = await serviceClient
    .from('payments')
    .select('*, invoice:invoices(invoice_number, client:clients(name))')
    .eq('business_id', business.id)
    .order('payment_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ payments: data })
}
