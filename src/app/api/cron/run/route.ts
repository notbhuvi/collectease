import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  buildReminderMessage,
  sendWhatsAppMessage,
  sendEmail,
  getReminderType,
} from '@/lib/messaging'
import { getDaysOverdue } from '@/lib/utils'

// This endpoint is called by Vercel Cron or external scheduler
// Protected by CRON_SECRET

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const expectedSecret = `Bearer ${process.env.CRON_SECRET}`

  if (process.env.NODE_ENV === 'production' && authHeader !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createServiceClient()
  const results = { updated: 0, reminders_sent: 0, errors: 0 }

  // Step 1: Mark overdue invoices
  const { data: updatedInvoices, error: overdueError } = await supabase
    .from('invoices')
    .update({ status: 'overdue' })
    .eq('status', 'sent')
    .lt('due_date', new Date().toISOString().split('T')[0])
    .select('id')

  if (overdueError) console.error('Overdue update error:', overdueError)
  results.updated = updatedInvoices?.length || 0

  // Step 2: Find invoices that need reminders
  // Rules: Day 30, 37, 42, 45 (relative to due_date)
  // Or: overdue with no recent reminder (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()

  const { data: invoicesNeedingReminder } = await supabase
    .from('invoices')
    .select(`
      *,
      client:clients(id, name, email, phone),
      business:businesses(id, name, email, phone)
    `)
    .in('status', ['sent', 'overdue'])
    .or(`last_reminder_at.is.null,last_reminder_at.lt.${sevenDaysAgo}`)

  for (const invoice of invoicesNeedingReminder || []) {
    try {
      const daysOverdue = getDaysOverdue(invoice.due_date)

      // Only send reminders at specific thresholds
      const shouldSend = checkReminderThreshold(daysOverdue, invoice.reminder_count || 0)
      if (!shouldSend) continue

      const reminderType = getReminderType(daysOverdue)

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

      let whatsappResult = { success: false }
      let emailResult = { success: false }

      if (invoice.client.phone) {
        whatsappResult = await sendWhatsAppMessage(invoice.client.phone, message)
      }
      if (invoice.client.email) {
        emailResult = await sendEmail(invoice.client.email, subject, message)
      }

      const overallSuccess = whatsappResult.success || emailResult.success
      const channel = invoice.client.phone && invoice.client.email ? 'both'
        : invoice.client.phone ? 'whatsapp' : 'email'

      // Log reminder
      await supabase.from('reminders').insert({
        invoice_id: invoice.id,
        business_id: invoice.business.id,
        type: reminderType,
        channel,
        message,
        status: overallSuccess ? 'sent' : 'failed',
        sent_at: new Date().toISOString(),
      })

      // Update invoice
      await supabase.from('invoices').update({
        reminder_count: (invoice.reminder_count || 0) + 1,
        last_reminder_at: new Date().toISOString(),
      }).eq('id', invoice.id)

      if (overallSuccess) results.reminders_sent++

      // Log escalation for legal reminders
      if (reminderType === 'legal') {
        const { data: existingEsc } = await supabase
          .from('escalation_logs')
          .select('id')
          .eq('invoice_id', invoice.id)
          .eq('type', 'formal_reminder')
          .single()

        if (!existingEsc) {
          await supabase.from('escalation_logs').insert({
            invoice_id: invoice.id,
            business_id: invoice.business.id,
            type: 'formal_reminder',
          })
        }
      }
    } catch (err) {
      console.error(`Error processing invoice ${invoice.id}:`, err)
      results.errors++
    }
  }

  console.log(`Cron completed: ${JSON.stringify(results)}`)
  return NextResponse.json({ success: true, ...results, timestamp: new Date().toISOString() })
}

// Thresholds: send reminder at days 0, 7, 15, 25, 30+ (weekly for very overdue)
function checkReminderThreshold(daysOverdue: number, reminderCount: number): boolean {
  if (reminderCount === 0) return true                      // First reminder always
  if (daysOverdue >= 7 && reminderCount < 2) return true   // Day ~7
  if (daysOverdue >= 15 && reminderCount < 3) return true  // Day ~15
  if (daysOverdue >= 25 && reminderCount < 4) return true  // Day ~25
  if (daysOverdue >= 30 && reminderCount < 5) return true  // Day ~30+
  if (daysOverdue >= 45 && reminderCount >= 5) return true // Weekly for severely overdue
  return false
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
