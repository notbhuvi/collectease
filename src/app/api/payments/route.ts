import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  // Get the invoice + verify ownership
  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, business_id, total_amount, businesses!inner(user_id)')
    .eq('id', body.invoice_id)
    .single()

  if (!invoice || (invoice.businesses as any).user_id !== user.id) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  // Record payment
  const { data: payment, error: paymentError } = await supabase
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

  // Update invoice status to paid
  const { error: updateError } = await supabase
    .from('invoices')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      paid_amount: body.amount,
    })
    .eq('id', body.invoice_id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ payment }, { status: 201 })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: business } = await supabase
    .from('businesses').select('id').eq('user_id', user.id).single()

  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('payments')
    .select('*, invoice:invoices(invoice_number, client:clients(name))')
    .eq('business_id', business.id)
    .order('payment_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ payments: data })
}
