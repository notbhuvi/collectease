import { formatCurrency, formatDate } from './utils'
import {
  TRANSPORT_DEPARTMENT_EMAILS,
  TRANSPORT_DEPARTMENT_MOBILE,
  TRANSPORT_DEPARTMENT_NAME,
  buildTransportWorkOrderText,
} from './transport'

interface ReminderContext {
  businessName: string
  clientName: string
  invoiceNumber: string
  amount: number          // remaining (outstanding) amount
  totalAmount?: number    // original invoice total
  paidAmount?: number     // already received
  dueDate: string
  daysOverdue: number
  businessPhone?: string
  businessEmail?: string
}

export function buildReminderMessage(_type: string, ctx: ReminderContext): string {
  const amount = formatCurrency(ctx.amount)
  const due = formatDate(ctx.dueDate)

  return `Dear Sir/Ma'am,

This is with reference to the outstanding payment reminder for Invoice No. ${ctx.invoiceNumber} amounting to ${amount}, which was due on ${due}.

We kindly request you to arrange the pending payment at the earliest convenience. The details of the outstanding invoice are attached for your ready reference.

Your prompt attention to this matter will be highly appreciated.

Regards,
SIRPL Accounts Dept.${ctx.businessPhone ? `\n${ctx.businessPhone}` : ''}${ctx.businessEmail ? `\n${ctx.businessEmail}` : ''}`
}

function buildEmailHtml(body: string, ctx?: ReminderContext): string {
  const escaped = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')

  // Invoice summary table rows (only if context provided)
  const invoiceTable = ctx ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border-collapse:collapse;border-radius:6px;overflow:hidden">
      <tr style="background:#f3f4f6">
        <td style="padding:8px 12px;font-size:12px;font-weight:bold;color:#6b7280;width:50%">Invoice Number</td>
        <td style="padding:8px 12px;font-size:13px;color:#111827;font-weight:bold">${ctx.invoiceNumber}</td>
      </tr>
      <tr style="background:#ffffff">
        <td style="padding:8px 12px;font-size:12px;font-weight:bold;color:#6b7280">Due Date</td>
        <td style="padding:8px 12px;font-size:13px;color:#111827">${formatDate(ctx.dueDate)}</td>
      </tr>
      ${ctx.totalAmount && ctx.paidAmount && ctx.paidAmount > 0 ? `
      <tr style="background:#f3f4f6">
        <td style="padding:8px 12px;font-size:12px;font-weight:bold;color:#6b7280">Invoice Total</td>
        <td style="padding:8px 12px;font-size:13px;color:#111827">${formatCurrency(ctx.totalAmount)}</td>
      </tr>
      <tr style="background:#ffffff">
        <td style="padding:8px 12px;font-size:12px;font-weight:bold;color:#16a34a">Amount Received</td>
        <td style="padding:8px 12px;font-size:13px;color:#16a34a">${formatCurrency(ctx.paidAmount)}</td>
      </tr>
      ` : ''}
      <tr style="background:#fef2f2">
        <td style="padding:10px 12px;font-size:13px;font-weight:bold;color:#dc2626">Amount Outstanding</td>
        <td style="padding:10px 12px;font-size:16px;font-weight:bold;color:#dc2626">${formatCurrency(ctx.amount)}</td>
      </tr>
    </table>` : ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.12);max-width:600px;width:100%">
        <tr><td style="background:#2563eb;padding:20px 32px">
          <span style="color:#ffffff;font-size:18px;font-weight:bold">SIRPL</span>
          <span style="color:rgba(255,255,255,0.8);font-size:13px;margin-left:8px">Samwha India Refractories Pvt. Ltd.</span>
        </td></tr>
        <tr><td style="padding:32px 32px 16px;color:#374151;font-size:15px;line-height:1.8">
          ${escaped}
        </td></tr>
        ${invoiceTable ? `<tr><td style="padding:0 32px 16px">${invoiceTable}</td></tr>` : ''}
        <tr><td style="padding:16px 32px 24px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px;line-height:1.6">
          <strong>SIRPL</strong> · Samwha India Refractories Pvt. Ltd.<br>
          This is an automated reminder. Please do not reply to this email.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

interface EmailAttachment {
  name: string
  base64: string
}

type EmailDepartment = 'accounts' | 'transport'

interface EmailOptions {
  department?: EmailDepartment
}

interface EmailResult {
  success: boolean
  error?: string
  provider?: 'brevo' | 'resend' | 'mock'
  messageId?: string
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function getSenderConfig(department: EmailDepartment = 'accounts') {
  const {
    BREVO_FROM_NAME,
    BREVO_FROM_EMAIL,
    EMAIL_FROM,
  } = process.env

  const accountsEmail = BREVO_FROM_EMAIL || 'accounts@sirpl.in'
  const senderEmail = department === 'transport'
    ? 'jbehera@sirpl.in'
    : accountsEmail
  const senderName = department === 'transport'
    ? TRANSPORT_DEPARTMENT_NAME
    : (BREVO_FROM_NAME || 'SIRPL')
  const resendFrom = department === 'transport'
    ? `${senderName} <${senderEmail}>`
    : (EMAIL_FROM || `${senderName} <${senderEmail}>`)

  return {
    name: senderName,
    email: senderEmail,
    resendFrom,
  }
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  type = 'friendly',
  attachment?: EmailAttachment,
  ctx?: ReminderContext,
  options?: EmailOptions
): Promise<EmailResult> {
  const { BREVO_API_KEY, RESEND_API_KEY } = process.env
  const html = buildEmailHtml(body, ctx)
  const department = options?.department || 'accounts'
  const sender = getSenderConfig(department)

  // ── Brevo (primary) ───────────────────────────────────────────────────────
  if (BREVO_API_KEY) {
    try {
      const payload: Record<string, unknown> = {
        sender: {
          name: sender.name,
          email: sender.email,
        },
        to: [{ email: to }],
        subject,
        textContent: body,
        htmlContent: html,
        tags: [department, type],
      }
      if (attachment) {
        payload.attachment = [{ content: attachment.base64, name: attachment.name }]
      }
      console.info('[sendEmail] provider=brevo', {
        department,
        to,
        subject,
        from: sender.email,
      })
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        return { success: false, error: 'Brevo: ' + JSON.stringify(err), provider: 'brevo' }
      }
      const data = await res.json()
      console.info('[sendEmail] provider=brevo success', {
        department,
        to,
        subject,
        messageId: data?.messageId,
      })
      return { success: true, provider: 'brevo', messageId: data?.messageId }
    } catch (err: unknown) {
      return { success: false, error: 'Brevo: ' + getErrorMessage(err), provider: 'brevo' }
    }
  }

  // ── Resend (fallback) ─────────────────────────────────────────────────────
  if (RESEND_API_KEY) {
    try {
      const payload: Record<string, unknown> = {
        from: sender.resendFrom,
        to: [to],
        subject,
        text: body,
        html,
      }
      if (attachment) {
        payload.attachments = [{ filename: attachment.name, content: attachment.base64 }]
      }
      console.info('[sendEmail] provider=resend', {
        department,
        to,
        subject,
        from: sender.resendFrom,
      })
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        return { success: false, error: 'Resend: ' + JSON.stringify(err), provider: 'resend' }
      }
      const data = await res.json()
      console.info('[sendEmail] provider=resend success', {
        department,
        to,
        subject,
        messageId: data?.id,
      })
      return { success: true, provider: 'resend', messageId: data?.id }
    } catch (err: unknown) {
      return { success: false, error: 'Resend: ' + getErrorMessage(err), provider: 'resend' }
    }
  }

  // ── Mock ──────────────────────────────────────────────────────────────────
  console.log(`[MOCK Email] To: ${to}\nSubject: ${subject}\n${body}`)
  return { success: true, provider: 'mock' }
}

// Always polite — no escalation
export function getReminderType(_daysOverdue: number): string {
  return 'friendly'
}

// ─── Transport Email Templates ────────────────────────────────────────────────

interface NewLoadEmailCtx {
  loadId: string
  pickup: string
  drop: string
  material: string
  quantity: string
  vehicleType: string
  pickupDate: string
  biddingDeadline: string
}

interface UpdatedLoadEmailCtx extends NewLoadEmailCtx {}

export function buildNewLoadEmail(ctx: NewLoadEmailCtx): string {
  const deadline = new Date(ctx.biddingDeadline).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  const pickup = new Date(ctx.pickupDate).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  })

  return `Dear Transporter,

A new freight load is now available for bidding on the SIRPL Transport Portal.

Load Details:
━━━━━━━━━━━━━━━━━━━━━━
Load ID:         ${ctx.loadId}
Route:           ${ctx.pickup} → ${ctx.drop}
Material:        ${ctx.material}
Quantity:        ${ctx.quantity}
Vehicle Type:    ${ctx.vehicleType}
Pickup Date:     ${pickup}
Bid Deadline:    ${deadline}
━━━━━━━━━━━━━━━━━━━━━━

Please log in to the SIRPL Transporter Portal to submit your bid before the deadline.

Note: Bids submitted after the deadline will not be accepted.

Regards,
${TRANSPORT_DEPARTMENT_NAME}
Email: ${TRANSPORT_DEPARTMENT_EMAILS.join(' / ')}
Mobile: ${TRANSPORT_DEPARTMENT_MOBILE}`
}

export function buildUpdatedLoadEmail(ctx: UpdatedLoadEmailCtx): string {
  const deadline = new Date(ctx.biddingDeadline).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  const pickup = new Date(ctx.pickupDate).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  })

  return `Dear Transporter,

An existing freight load on the SIRPL Transport Portal has been modified during the active bidding period.

Updated Load Details:
━━━━━━━━━━━━━━━━━━━━━━
Load ID:         ${ctx.loadId}
Route:           ${ctx.pickup} → ${ctx.drop}
Material:        ${ctx.material}
Quantity:        ${ctx.quantity}
Vehicle Type:    ${ctx.vehicleType}
Pickup Date:     ${pickup}
Bid Deadline:    ${deadline}
━━━━━━━━━━━━━━━━━━━━━━

Please log in to the SIRPL Transporter Portal to review the updated load details and revise your bid if required before the deadline.

Regards,
${TRANSPORT_DEPARTMENT_NAME}
Email: ${TRANSPORT_DEPARTMENT_EMAILS.join(' / ')}
Mobile: ${TRANSPORT_DEPARTMENT_MOBILE}`
}

interface WinnerEmailCtx {
  transporterName: string
  transporterEmail?: string | null
  refNumber: string
  date: string
  pickup: string
  drop: string
  material: string
  quantity: string
  vehicleType: string
  rate: string
  totalFare: string
  pickupDate: string
}

export function buildTransportWinnerEmail(ctx: WinnerEmailCtx): string {
  const pickup = new Date(ctx.pickupDate).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  })

  return buildTransportWorkOrderText({
    refNumber: ctx.refNumber,
    date: ctx.date,
    transporterName: ctx.transporterName,
    transporterEmail: ctx.transporterEmail,
    pickup: ctx.pickup,
    drop: ctx.drop,
    material: ctx.material,
    quantity: ctx.quantity,
    vehicleType: ctx.vehicleType,
    rate: ctx.rate,
    totalFare: ctx.totalFare,
    pickupDate: pickup,
  })
}

// ─── WhatsApp ─────────────────────────────────────────────────────────────────
// Priority: Green API (free, scan QR) → Meta Cloud API (free 1k/month) → mock

export function buildWhatsAppMessage(ctx: ReminderContext): string {
  const amount = formatCurrency(ctx.amount)
  const due = formatDate(ctx.dueDate)
  const partial = ctx.paidAmount && ctx.paidAmount > 0
    ? `\n✅ Amount Received: ${formatCurrency(ctx.paidAmount)}`
    : ''

  return `*SIRPL – Payment Reminder*

Dear Sir/Ma'am,

This is a friendly reminder for an outstanding payment:

📄 *Invoice No:* ${ctx.invoiceNumber}
📅 *Due Date:* ${due}${partial}
💰 *Amount Outstanding:* ${amount}

Kindly arrange the payment at your earliest convenience.

Regards,
*SIRPL Accounts Dept.*${ctx.businessPhone ? `\n📞 ${ctx.businessPhone}` : ''}${ctx.businessEmail ? `\n📧 ${ctx.businessEmail}` : ''}`
}

function formatWhatsAppTo(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) return digits
  if (digits.length === 10) return `91${digits}`
  return `91${digits.slice(-10)}`
}

// ── Green API (free — scan QR with your WhatsApp Business number) ─────────────
// Setup: green-api.com → Register free → Create instance → Scan QR
// Add to .env: GREEN_API_INSTANCE_ID and GREEN_API_TOKEN
async function sendViaGreenAPI(
  to: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  const { GREEN_API_INSTANCE_ID, GREEN_API_TOKEN } = process.env
  if (!GREEN_API_INSTANCE_ID || !GREEN_API_TOKEN) return { success: false, error: 'not_configured' }

  const chatId = `${formatWhatsAppTo(to)}@c.us`
  const url = `https://api.green-api.com/waInstance${GREEN_API_INSTANCE_ID}/sendMessage/${GREEN_API_TOKEN}`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message }),
    })
    const data = await res.json() as any
    if (!res.ok || data.error) {
      return { success: false, error: `GreenAPI: ${data.error || JSON.stringify(data)}` }
    }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: `GreenAPI: ${err.message}` }
  }
}

// ── Meta Cloud API (free 1,000 conversations/month) ───────────────────────────
// Setup: developers.facebook.com → Create app → WhatsApp → get Phone Number ID + Token
// Add to .env: WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN
async function sendViaMetaAPI(
  to: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  const { WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_API_URL } = process.env
  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN ||
      WHATSAPP_PHONE_NUMBER_ID === 'your_phone_number_id') {
    return { success: false, error: 'not_configured' }
  }

  const apiUrl = WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0'
  const toNumber = formatWhatsAppTo(to)

  try {
    const res = await fetch(`${apiUrl}/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toNumber,
        type: 'text',
        text: { body: message, preview_url: false },
      }),
    })
    const data = await res.json() as any
    if (!res.ok) return { success: false, error: `Meta: ${data?.error?.message || JSON.stringify(data)}` }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: `Meta: ${err.message}` }
  }
}

// ── Main sendWhatsApp — tries Green API first, then Meta, then mock ───────────
export async function sendWhatsApp(
  to: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  // 1. Try Green API (free, no monthly cap)
  const greenResult = await sendViaGreenAPI(to, message)
  if (greenResult.success) return greenResult
  if (greenResult.error !== 'not_configured') return greenResult

  // 2. Try Meta Cloud API (free 1,000/month)
  const metaResult = await sendViaMetaAPI(to, message)
  if (metaResult.success) return metaResult
  if (metaResult.error !== 'not_configured') return metaResult

  // 3. Mock — log to console (no keys configured yet)
  console.log(`[MOCK WhatsApp] To: ${to}\n${message}`)
  return { success: true }
}
