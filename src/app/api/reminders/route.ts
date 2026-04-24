import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { buildReminderMessage, sendEmail, getReminderType } from '@/lib/messaging'
import { generateReminderPDF } from '@/lib/pdf'
import { getDaysOverdue } from '@/lib/utils'
import { getProfileForUser } from '@/lib/profile'
import { getAccessibleBusinessForUser } from '@/lib/business'
import type { UserRole } from '@/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { invoiceId } = body
  const serviceClient = await createServiceClient()
  const profile = await getProfileForUser(serviceClient, user, 'role')
  const business = await getAccessibleBusinessForUser(serviceClient, user, profile?.role as UserRole)
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  const { data: invoice } = await serviceClient
    .from('invoices')
    .select(`
      *,
      client:clients(id, name, email, phone, gstin, address, city, state),
      business:businesses(id, name, email, phone, gstin, address, city, state, pincode, user_id)
    `)
    .eq('id', invoiceId)
    .single()

  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  if (invoice.business.id !== business.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  if (invoice.status === 'paid' || invoice.status === 'cancelled') {
    return NextResponse.json({ error: 'Cannot send reminder for paid/cancelled invoice' }, { status: 400 })
  }

  const daysOverdue = getDaysOverdue(invoice.due_date)
  const reminderType = getReminderType(daysOverdue)
  const paidAmount = Number(invoice.paid_amount || 0)
  const remainingAmount = invoice.total_amount - paidAmount

  const ctx = {
    businessName: invoice.business.name,
    clientName: invoice.client.name,
    invoiceNumber: invoice.invoice_number,
    amount: remainingAmount,
    totalAmount: invoice.total_amount,
    paidAmount,
    dueDate: invoice.due_date,
    daysOverdue,
    businessPhone: invoice.business.phone,
    businessEmail: invoice.business.email,
  }

  const message = buildReminderMessage(reminderType, ctx)

  // Generate PDF attachment
  let pdfAttachment: { name: string; base64: string } | undefined
  try {
    const pdfBuffer = await generateReminderPDF(
      {
        name: invoice.business.name,
        gstin: invoice.business.gstin,
        phone: invoice.business.phone,
        email: invoice.business.email,
        address: invoice.business.address,
        city: invoice.business.city,
        state: invoice.business.state,
        pincode: invoice.business.pincode,
      },
      {
        name: invoice.client.name,
        email: invoice.client.email,
        phone: invoice.client.phone,
        gstin: invoice.client.gstin,
        address: invoice.client.address,
        city: invoice.client.city,
        state: invoice.client.state,
      },
      {
        invoice_number: invoice.invoice_number,
        amount: invoice.amount,
        tax_amount: invoice.tax_amount,
        total_amount: invoice.total_amount,
        issue_date: invoice.issue_date,
        due_date: invoice.due_date,
        description: invoice.description,
        status: invoice.status,
        paid_amount: invoice.paid_amount,
      }
    )
    const base64 = Buffer.from(pdfBuffer).toString('base64')
    pdfAttachment = { name: `Outstanding-${invoice.invoice_number}.pdf`, base64 }
  } catch (pdfErr) {
    console.error('PDF generation failed:', pdfErr)
    // Continue without attachment
  }

  let emailResult: { success: boolean; error?: string } = { success: false, error: 'No email on file' }
  if (invoice.client.email) {
    emailResult = await sendEmail(
      invoice.client.email,
      `Outstanding Payment Reminder — Invoice ${invoice.invoice_number}`,
      message,
      reminderType,
      pdfAttachment,
      ctx
    )
  }

  await serviceClient.from('reminders').insert({
    invoice_id: invoiceId,
    business_id: invoice.business.id,
    type: reminderType,
    channel: 'email',
    message,
    status: emailResult.success ? 'sent' : 'failed',
    error: emailResult.success ? null : emailResult.error,
    sent_at: new Date().toISOString(),
  })

  await serviceClient.from('invoices').update({
    reminder_count: (invoice.reminder_count || 0) + 1,
    last_reminder_at: new Date().toISOString(),
  }).eq('id', invoiceId)

  return NextResponse.json({ success: emailResult.success, type: reminderType, email: emailResult })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = await createServiceClient()
  const profile = await getProfileForUser(serviceClient, user, 'role')
  const business = await getAccessibleBusinessForUser(serviceClient, user, profile?.role as UserRole)

  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const invoiceId = searchParams.get('invoiceId')

  let query = serviceClient
    .from('reminders')
    .select('*')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })

  if (invoiceId) query = query.eq('invoice_id', invoiceId)

  const { data, error } = await query.limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ reminders: data })
}
