import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { cleanupExpiredApprovedBills } from '@/lib/bills'
import { buildReminderMessage, sendEmail, getReminderType } from '@/lib/messaging'
import { generateReminderPDF } from '@/lib/pdf'
import { getDaysOverdue } from '@/lib/utils'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const expectedSecret = `Bearer ${process.env.CRON_SECRET}`

  if (process.env.NODE_ENV === 'production' && authHeader !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()
  const results = { updated: 0, reminders_sent: 0, skipped: 0, errors: 0, bills_deleted: 0 }

  // Step 1: Mark overdue invoices
  const { data: updatedInvoices, error: overdueError } = await supabase
    .from('invoices')
    .update({ status: 'overdue' })
    .eq('status', 'sent')
    .lt('due_date', new Date().toISOString().split('T')[0])
    .select('id')

  if (overdueError) console.error('Overdue update error:', overdueError)
  results.updated = updatedInvoices?.length || 0

  try {
    results.bills_deleted = await cleanupExpiredApprovedBills(supabase)
  } catch (billCleanupError) {
    console.error('Approved bill cleanup error:', billCleanupError)
    results.errors++
  }

  // Step 2: Fetch active unpaid invoices (1-day guard to avoid double-sends)
  const oneDayAgo = new Date(Date.now() - 86400000).toISOString()

  const { data: invoicesNeedingReminder, error: fetchError } = await supabase
    .from('invoices')
    .select(`
      *,
      client:clients(id, name, email, phone, gstin, address, city, state),
      business:businesses(id, name, email, phone, gstin, address, city, state, pincode)
    `)
    .in('status', ['sent', 'overdue'])
    .or(`last_reminder_at.is.null,last_reminder_at.lt.${oneDayAgo}`)

  if (fetchError) {
    console.error('Fetch error:', fetchError)
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  for (const invoice of invoicesNeedingReminder || []) {
    try {
      const daysOverdue = getDaysOverdue(invoice.due_date)

      if (!shouldSendReminder(invoice, daysOverdue)) {
        results.skipped++
        continue
      }

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
        console.error(`PDF generation failed for invoice ${invoice.id}:`, pdfErr)
        // Continue without attachment rather than failing the entire reminder
      }

      let emailResult: { success: boolean; error?: string } = { success: false }
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

      await supabase.from('reminders').insert({
        invoice_id: invoice.id,
        business_id: invoice.business.id,
        type: reminderType,
        channel: 'email',
        message,
        status: emailResult.success ? 'sent' : 'failed',
        sent_at: new Date().toISOString(),
      })

      await supabase.from('invoices').update({
        reminder_count: (invoice.reminder_count || 0) + 1,
        last_reminder_at: new Date().toISOString(),
      }).eq('id', invoice.id)

      if (emailResult.success) results.reminders_sent++
    } catch (err) {
      console.error(`Error processing invoice ${invoice.id}:`, err)
      results.errors++
    }
  }

  console.log(`Cron completed: ${JSON.stringify(results)}`)
  return NextResponse.json({ success: true, ...results, timestamp: new Date().toISOString() })
}

function shouldSendReminder(invoice: {
  reminder_initial_delay?: number | null
  reminder_interval_days?: number | null
  reminder_count?: number | null
  last_reminder_at?: string | null
}, daysOverdue: number): boolean {
  const initialDelay = invoice.reminder_initial_delay ?? 0
  const interval = invoice.reminder_interval_days ?? 7
  const reminderCount = invoice.reminder_count || 0

  if (reminderCount === 0) return daysOverdue >= initialDelay

  if (!invoice.last_reminder_at) return true
  const daysSinceLast = Math.floor(
    (Date.now() - new Date(invoice.last_reminder_at).getTime()) / 86400000
  )
  return daysSinceLast >= interval
}
