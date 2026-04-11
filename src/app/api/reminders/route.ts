import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  buildReminderMessage,
  sendWhatsAppMessage,
  sendEmail,
  getReminderType,
} from '@/lib/messaging'
import { getDaysOverdue } from '@/lib/utils'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { invoiceId, manual } = body

  // Fetch invoice with all needed relations
  const { data: invoice } = await supabase
    .from('invoices')
    .select(`
      *,
      client:clients(id, name, email, phone),
      business:businesses(id, name, email, phone, user_id)
    `)
    .eq('id', invoiceId)
    .single()

  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  if (invoice.business.user_id !== user.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  if (invoice.status === 'paid' || invoice.status === 'cancelled') {
    return NextResponse.json({ error: 'Cannot send reminder for paid/cancelled invoice' }, { status: 400 })
  }

  const daysOverdue = getDaysOverdue(invoice.due_date)
  const reminderType = manual ? getReminderType(daysOverdue) : getReminderType(daysOverdue)

  const ctx = {
    businessName: invoice.business.name,
    clientName: invoice.client.name,
    invoiceNumber: invoice.invoice_number,
    amount: invoice.total_amount,
    dueDate: invoice.due_date,
    daysOverdue,
    businessPhone: invoice.business.phone,
    businessEmail: invoice.business.email,
  }

  const message = buildReminderMessage(reminderType, ctx)
  const subject = getReminderSubject(reminderType, invoice.invoice_number)

  let whatsappResult: { success: boolean; error?: string } = { success: false, error: 'No phone' }
  let emailResult: { success: boolean; error?: string } = { success: false, error: 'No email' }

  if (invoice.client.phone) {
    whatsappResult = await sendWhatsAppMessage(invoice.client.phone, message)
  }

  if (invoice.client.email) {
    emailResult = await sendEmail(invoice.client.email, subject, message)
  }

  const channel = invoice.client.phone && invoice.client.email ? 'both'
    : invoice.client.phone ? 'whatsapp' : 'email'

  const overallSuccess = whatsappResult.success || emailResult.success

  // Log reminder
  const serviceClient = await createServiceClient()
  await serviceClient.from('reminders').insert({
    invoice_id: invoiceId,
    business_id: invoice.business.id,
    type: reminderType,
    channel,
    message,
    status: overallSuccess ? 'sent' : 'failed',
    error: overallSuccess ? null : `WA: ${whatsappResult.error || ''} | Email: ${emailResult.error || ''}`,
    sent_at: new Date().toISOString(),
  })

  // Update invoice reminder count
  await serviceClient.from('invoices').update({
    reminder_count: (invoice.reminder_count || 0) + 1,
    last_reminder_at: new Date().toISOString(),
  }).eq('id', invoiceId)

  // Log escalation if legal
  if (reminderType === 'legal') {
    await serviceClient.from('escalation_logs').insert({
      invoice_id: invoiceId,
      business_id: invoice.business.id,
      type: 'formal_reminder',
    })
  }

  return NextResponse.json({
    success: overallSuccess,
    type: reminderType,
    whatsapp: whatsappResult,
    email: emailResult,
  })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: business } = await supabase
    .from('businesses').select('id').eq('user_id', user.id).single()

  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const invoiceId = searchParams.get('invoiceId')

  let query = supabase
    .from('reminders')
    .select('*')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })

  if (invoiceId) query = query.eq('invoice_id', invoiceId)

  const { data, error } = await query.limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ reminders: data })
}

function getReminderSubject(type: string, invoiceNumber: string): string {
  const subjects: Record<string, string> = {
    friendly: `Friendly Reminder: Invoice ${invoiceNumber} Payment Due`,
    firm: `Payment Reminder: Invoice ${invoiceNumber} Overdue`,
    final_warning: `Final Warning: Invoice ${invoiceNumber} — Immediate Payment Required`,
    legal: `Legal Notice: Invoice ${invoiceNumber} — Recovery Action Initiated`,
  }
  return subjects[type] || `Invoice ${invoiceNumber} Reminder`
}
