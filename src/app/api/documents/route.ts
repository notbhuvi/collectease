import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  generateInvoicePDF,
  generateLegalNoticePDF,
  generateMSMEComplaintPDF,
  generateReportCSV,
} from '@/lib/pdf'
import { getProfileForUser } from '@/lib/profile'
import { getAccessibleBusinessForUser } from '@/lib/business'
import type { UserRole } from '@/types'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const invoiceId = searchParams.get('invoiceId')
  const serviceClient = await createServiceClient()
  const profile = await getProfileForUser(serviceClient, user, 'role')
  const business = await getAccessibleBusinessForUser(serviceClient, user, profile?.role as UserRole)

  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  // CSV Report export
  if (type === 'report_csv') {
    const { data: invoices } = await serviceClient
      .from('invoices')
      .select('*, client:clients(name)')
      .eq('business_id', business.id)
      .order('issue_date', { ascending: false })

    const csv = await generateReportCSV(invoices || [])
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="sirpl-report-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  }

  // PDF Report
  if (type === 'report_pdf') {
    const { data: invoices } = await serviceClient
      .from('invoices')
      .select('*, client:clients(name)')
      .eq('business_id', business.id)
      .order('issue_date', { ascending: false })

    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default

    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const w = doc.internal.pageSize.getWidth()
    const margin = 20

    doc.setFillColor(37, 99, 235)
    doc.rect(0, 0, w, 30, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('Receivables Report', margin, 15)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`${business.name} · Generated ${new Date().toLocaleDateString('en-IN')}`, margin, 22)

    autoTable(doc, {
      startY: 40,
      head: [['Invoice #', 'Client', 'Issue Date', 'Due Date', 'Status', 'Amount']],
      body: (invoices || []).map(inv => [
        inv.invoice_number,
        inv.client?.name || '',
        inv.issue_date,
        inv.due_date,
        inv.status.toUpperCase(),
        `₹${Number(inv.total_amount).toLocaleString('en-IN')}`,
      ]),
      margin: { left: margin, right: margin },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: { 5: { halign: 'right' } },
    })

    const buf = doc.output('arraybuffer')
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="sirpl-report-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    })
  }

  // Invoice / Legal / MSME PDFs
  if (!invoiceId) return NextResponse.json({ error: 'Missing invoiceId' }, { status: 400 })

  const { data: invoice } = await serviceClient
    .from('invoices')
    .select('*, client:clients(*), business:businesses(*)')
    .eq('id', invoiceId)
    .single()

  if (!invoice || invoice.business.id !== business.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let pdfBuf: ArrayBuffer
  let filename: string

  if (type === 'invoice' || !type) {
    pdfBuf = await generateInvoicePDF(invoice.business, invoice.client, invoice)
    filename = `invoice-${invoice.invoice_number}.pdf`
  } else if (type === 'legal_notice') {
    pdfBuf = await generateLegalNoticePDF(invoice.business, invoice.client, invoice)
    filename = `legal-notice-${invoice.invoice_number}.pdf`

    await serviceClient.from('escalation_logs').insert({
      invoice_id: invoiceId,
      business_id: business.id,
      type: 'legal_notice',
    }).then(() => {})
  } else if (type === 'msme_complaint') {
    pdfBuf = await generateMSMEComplaintPDF(invoice.business, invoice.client, invoice)
    filename = `msme-complaint-${invoice.invoice_number}.pdf`

    await serviceClient.from('escalation_logs').insert({
      invoice_id: invoiceId,
      business_id: business.id,
      type: 'msme_complaint',
    }).then(() => {})
  } else {
    return NextResponse.json({ error: 'Invalid document type' }, { status: 400 })
  }

  return new NextResponse(pdfBuf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
