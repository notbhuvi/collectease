import { formatCurrency, formatDate } from './utils'

interface ReminderContext {
  businessName: string
  clientName: string
  invoiceNumber: string
  amount: number
  dueDate: string
  daysOverdue: number
  businessPhone?: string
  businessEmail?: string
}

export function buildReminderMessage(type: string, ctx: ReminderContext): string {
  const amount = formatCurrency(ctx.amount)
  const due = formatDate(ctx.dueDate)

  switch (type) {
    case 'friendly':
      return `Dear ${ctx.clientName},

This is a friendly reminder that invoice *${ctx.invoiceNumber}* for *${amount}* was due on ${due}.

If you have already processed the payment, please ignore this message and share the payment details.

For any queries, please contact us.

Regards,
${ctx.businessName}
${ctx.businessPhone || ''}`

    case 'firm':
      return `Dear ${ctx.clientName},

We would like to draw your attention to the outstanding invoice *${ctx.invoiceNumber}* for *${amount}*, which was due on ${due} — now ${ctx.daysOverdue} days overdue.

We request you to process the payment at the earliest to avoid any service disruption.

*Payment can be made via:*
• UPI / Bank Transfer
• Cheque in favour of ${ctx.businessName}

Please share the payment confirmation once done.

Regards,
${ctx.businessName}
${ctx.businessPhone || ''}`

    case 'final_warning':
      return `⚠️ *FINAL REMINDER*

Dear ${ctx.clientName},

Despite our earlier reminders, invoice *${ctx.invoiceNumber}* for *${amount}* (due ${due}) remains unpaid — now ${ctx.daysOverdue} days overdue.

*This is our final reminder before we initiate legal recovery proceedings.*

To avoid this, please make immediate payment and share the confirmation with us.

Regards,
${ctx.businessName}
${ctx.businessPhone || ''}`

    case 'legal':
      return `📋 *LEGAL NOTICE INTIMATION*

Dear ${ctx.clientName},

We regret to inform you that as invoice *${ctx.invoiceNumber}* for *${amount}* remains unpaid for ${ctx.daysOverdue} days despite multiple reminders, we are proceeding with formal legal action under the MSME Development Act, 2006.

A formal legal notice will be delivered to your registered address shortly. You may also be filed as a respondent in MSME Samadhaan.

To settle this matter amicably, please make full payment within 48 hours.

${ctx.businessName}
${ctx.businessPhone || ''}`

    default:
      return `Reminder for invoice ${ctx.invoiceNumber}: ${amount} due on ${due}.`
  }
}

export async function sendWhatsAppMessage(phone: string, message: string): Promise<{ success: boolean; error?: string }> {
  const { WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_API_URL } = process.env

  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    // Mock mode for development
    console.log(`[MOCK WhatsApp] To: ${phone}\n${message}`)
    return { success: true }
  }

  // Normalize phone number
  const normalized = phone.replace(/\D/g, '')
  const phoneWithCode = normalized.startsWith('91') ? normalized : `91${normalized}`

  try {
    const res = await fetch(`${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phoneWithCode,
        type: 'text',
        text: { body: message },
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      return { success: false, error: JSON.stringify(err) }
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function sendEmail(to: string, subject: string, body: string): Promise<{ success: boolean; error?: string }> {
  const { RESEND_API_KEY, EMAIL_FROM } = process.env

  if (!RESEND_API_KEY) {
    console.log(`[MOCK Email] To: ${to}\nSubject: ${subject}\n${body}`)
    return { success: true }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM || 'CollectEase <noreply@collectease.in>',
        to: [to],
        subject,
        text: body,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px">
          <pre style="white-space:pre-wrap;font-family:sans-serif">${body}</pre>
          <hr style="margin:24px 0;border-color:#e5e7eb">
          <p style="font-size:12px;color:#9ca3af">Powered by CollectEase · Automated Payment Collection for Indian MSMEs</p>
        </div>`,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      return { success: false, error: JSON.stringify(err) }
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export function getReminderType(daysOverdue: number): string {
  if (daysOverdue <= 0) return 'friendly' // Day 0 / sent
  if (daysOverdue <= 7) return 'friendly'
  if (daysOverdue <= 15) return 'firm'
  if (daysOverdue <= 25) return 'final_warning'
  return 'legal'
}
