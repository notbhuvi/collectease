import type { SupabaseClient, User } from '@supabase/supabase-js'
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib'
import { getAdminUserDirectory } from '@/lib/admin-users'
import { sendEmail } from '@/lib/messaging'
import { getOrCreateProfileForUser, type ProfileRecord } from '@/lib/profile'
import type { BillApproval, BillApprovalStatus } from '@/types'

export const BILL_UPLOAD_BUCKET = 'bill-uploads'
export const MAX_BILL_SIZE_BYTES = 10 * 1024 * 1024
export const ALLOWED_BILL_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const

type AllowedBillMimeType = (typeof ALLOWED_BILL_MIME_TYPES)[number]

export interface BillListItem extends BillApproval {
  uploaded_by_name: string | null
  uploaded_by_email: string | null
  admin_name: string | null
  preview_url: string | null
  stamped_preview_url: string | null
}

export interface BillModuleResult<T> {
  data: T
  unavailable: boolean
  reason?: string
}

interface BillViewerOptions {
  status?: BillApprovalStatus
}

export function isAllowedBillMimeType(fileType: string): fileType is AllowedBillMimeType {
  return (ALLOWED_BILL_MIME_TYPES as readonly string[]).includes(fileType)
}

export function getBillExtension(fileType: string): string {
  if (fileType === 'application/pdf') return 'pdf'
  if (fileType === 'image/png') return 'png'
  return 'jpg'
}

export function buildBillStoragePath(userId: string, billId: string, fileType: string): string {
  return `bills/${userId}/${billId}.${getBillExtension(fileType)}`
}

export function buildStampedBillPath(billId: string): string {
  return `bills/stamped/${billId}.pdf`
}

export function formatStampedBillFileName(originalName: string | null | undefined, status: BillApprovalStatus): string {
  const safeBase = (originalName || 'bill')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9-_ ]+/g, '')
    .trim() || 'bill'

  return `${safeBase}-${status}.pdf`
}

export async function ensureBillUploadBucket(serviceClient: SupabaseClient) {
  const { error } = await serviceClient.storage.createBucket(BILL_UPLOAD_BUCKET, {
    public: false,
    fileSizeLimit: MAX_BILL_SIZE_BYTES,
    allowedMimeTypes: [...ALLOWED_BILL_MIME_TYPES],
  })

  if (error && !/already exists/i.test(error.message)) {
    throw new Error(error.message)
  }
}

export async function requireBillAccessContext(serviceClient: SupabaseClient, user: Pick<User, 'id' | 'email'>) {
  const profile = await getOrCreateProfileForUser(serviceClient, user, 'id,email,role,full_name,company_name')
  if (!profile?.role) {
    throw new Error('Forbidden')
  }

  return profile
}

type BasicProfileRow = {
  id: string
  full_name: string | null
  email: string | null
}

export async function listBillsForViewer(
  serviceClient: SupabaseClient,
  viewer: Pick<User, 'id'>,
  profile: ProfileRecord,
  options?: BillViewerOptions
) {
  let query = serviceClient
    .from('bill_approvals')
    .select('*')
    .order('created_at', { ascending: false })

  if (profile.role === 'accounts') {
    query = query.eq('status', 'approved')
  } else if (profile.role !== 'admin') {
    query = query.eq('uploaded_by', viewer.id)
  }

  if (options?.status) {
    query = query.eq('status', options.status)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(error.message)
  }

  const bills = (data || []) as BillApproval[]
  const userIds = [...new Set(
    bills.flatMap(bill => [bill.uploaded_by, bill.admin_id].filter(Boolean))
  )]

  const profileMap = new Map<string, { full_name: string | null; email: string | null }>()
  if (userIds.length > 0) {
    const { data: profiles, error: profileError } = await serviceClient
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds)

    if (profileError) {
      throw new Error(profileError.message)
    }

    for (const row of (profiles || []) as BasicProfileRow[]) {
      profileMap.set(row.id, {
        full_name: row.full_name || null,
        email: row.email || null,
      })
    }
  }

  return Promise.all(
    bills.map(async bill => {
      const [previewUrl, stampedPreviewUrl] = await Promise.all([
        createSignedPreviewUrl(serviceClient, bill.file_url),
        createSignedPreviewUrl(serviceClient, bill.stamped_file_url),
      ])

      const uploader = bill.uploaded_by ? profileMap.get(bill.uploaded_by) : null
      const admin = bill.admin_id ? profileMap.get(bill.admin_id) : null

      return {
        ...bill,
        uploaded_by_name: uploader?.full_name || uploader?.email || null,
        uploaded_by_email: uploader?.email || null,
        admin_name: admin?.full_name || admin?.email || null,
        preview_url: previewUrl,
        stamped_preview_url: stampedPreviewUrl,
      } satisfies BillListItem
    })
  )
}

export function isBillModuleUnavailableError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()

  return (
    message.includes('bill_approvals') ||
    message.includes('bill_logs') ||
    message.includes('relation') ||
    message.includes('does not exist') ||
    message.includes('schema cache')
  )
}

export async function getBillsForViewerSafe(
  serviceClient: SupabaseClient,
  viewer: Pick<User, 'id'>,
  profile: ProfileRecord,
  options?: BillViewerOptions
): Promise<BillModuleResult<BillListItem[]>> {
  try {
    const bills = await listBillsForViewer(serviceClient, viewer, profile, options)
    return { data: bills, unavailable: false }
  } catch (error) {
    if (isBillModuleUnavailableError(error)) {
      return {
        data: [],
        unavailable: true,
        reason: 'Bill approval tables are not available yet in this environment.',
      }
    }

    throw error
  }
}

export async function getPendingBillApprovalCountSafe(serviceClient: SupabaseClient): Promise<BillModuleResult<number>> {
  const { count, error } = await serviceClient
    .from('bill_approvals')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

  if (!error) {
    return { data: count || 0, unavailable: false }
  }

  if (isBillModuleUnavailableError(error.message)) {
    return {
      data: 0,
      unavailable: true,
      reason: 'Bill approval tables are not available yet in this environment.',
    }
  }

  throw new Error(error.message)
}

export async function createSignedPreviewUrl(serviceClient: SupabaseClient, path: string | null | undefined) {
  if (!path) {
    return null
  }

  const { data, error } = await serviceClient.storage
    .from(BILL_UPLOAD_BUCKET)
    .createSignedUrl(path, 60 * 10)

  if (error) {
    return null
  }

  return data?.signedUrl || null
}

export async function stampBillDocument(args: {
  inputBytes: Uint8Array
  fileType: string
  decision: Exclude<BillApprovalStatus, 'pending'>
  adminName: string
  decidedAt: Date
}) {
  const { inputBytes, fileType, decision, adminName, decidedAt } = args
  const pdfDoc = fileType === 'application/pdf'
    ? await PDFDocument.load(inputBytes)
    : await buildPdfFromImage(inputBytes, fileType)

  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica)

  const statusLabel = `${decision.toUpperCase()} by SIRPL`
  const dateLabel = decidedAt.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  })
  const detailLabel = `${statusLabel} | ${dateLabel} | ${adminName}`
  const accentColor = decision === 'approved'
    ? rgb(0.06, 0.47, 0.2)
    : rgb(0.74, 0.15, 0.17)

  for (const page of pdfDoc.getPages()) {
    const { width, height } = page.getSize()
    const mainSize = Math.min(width, height) * 0.08
    const detailSize = Math.min(width, height) * 0.022

    page.drawText(statusLabel, {
      x: width * 0.13,
      y: height * 0.45,
      size: mainSize,
      font: boldFont,
      color: accentColor,
      rotate: degrees(35),
      opacity: 0.16,
    })

    page.drawRectangle({
      x: 24,
      y: 18,
      width: width - 48,
      height: Math.max(42, detailSize * 2.8),
      color: rgb(1, 1, 1),
      opacity: 0.72,
      borderColor: accentColor,
      borderWidth: 1,
    })

    page.drawText(detailLabel, {
      x: 36,
      y: 34,
      size: detailSize,
      font: regularFont,
      color: accentColor,
    })
  }

  return pdfDoc.save()
}

async function buildPdfFromImage(inputBytes: Uint8Array, fileType: string) {
  const pdfDoc = await PDFDocument.create()
  const image = fileType === 'image/png'
    ? await pdfDoc.embedPng(inputBytes)
    : await pdfDoc.embedJpg(inputBytes)

  const page = pdfDoc.addPage([image.width, image.height])
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: image.width,
    height: image.height,
  })

  return pdfDoc
}

export async function notifyAdminsOfBillUpload(serviceClient: SupabaseClient, bill: {
  id: string
  original_name: string | null
  created_at: string
}, uploadedBy: ProfileRecord, uploaderEmail: string | null | undefined) {
  try {
    const users = await getAdminUserDirectory(serviceClient)
    const admins = users.filter(user => user.role === 'admin' && user.email)

    await Promise.all(admins.map(admin => sendEmail(
      admin.email!,
      'New bill awaiting approval',
      `Dear ${admin.full_name || admin.email},

A new bill has been uploaded in CollectEase and is awaiting review.

Bill: ${bill.original_name || bill.id}
Uploaded by: ${uploadedBy.full_name || uploaderEmail || uploadedBy.email || 'Unknown user'}
Uploaded at: ${new Date(bill.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}

Please review it in the admin portal so finance only receives approved bills.

Regards,
CollectEase`
    )))
  } catch (error) {
    console.error('Bill upload email notification failed', error)
  }
}

type BillNotificationProfile = {
  email: string | null
  full_name: string | null
}

export async function notifyUploaderOfDecision(serviceClient: SupabaseClient, bill: BillApproval, uploaderId: string | null, adminName: string) {
  if (!uploaderId) {
    return
  }

  try {
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('email, full_name')
      .eq('id', uploaderId)
      .single()

    const recipient = profile as BillNotificationProfile | null

    if (!recipient?.email) {
      return
    }

    await sendEmail(
      recipient.email,
      `Bill ${bill.status} in CollectEase`,
      `Dear ${recipient.full_name || recipient.email},

The bill "${bill.original_name || bill.id}" uploaded by HR has been ${bill.status} by ${adminName}.

Remark: ${bill.admin_remark || 'No remark provided'}
Decision time: ${bill.decided_at ? new Date(bill.decided_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Just now'}

${bill.status === 'approved'
  ? 'The approved stamped bill is now available to the finance team in CollectEase.'
  : 'Because it was declined, finance will not see this bill in their queue.'}

Regards,
CollectEase`
    )
  } catch (error) {
    console.error('Bill decision email notification failed', error)
  }
}
