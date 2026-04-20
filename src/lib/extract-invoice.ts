/**
 * Client-side invoice data extraction.
 * PDF: uses pdfjs-dist to pull raw text, then regex.
 * Image: draws to canvas, reads pixels — user gets whatever text is selectable.
 * No AI, no API calls, completely free.
 */

export interface ExtractedInvoiceData {
  client_name: string | null
  invoice_number: string | null
  issue_date: string | null
  due_date: string | null
  description: string | null
  amount: number | null
  tax_amount: number | null
  total_amount: number | null
  notes: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF text extraction via pdfjs-dist
// ─────────────────────────────────────────────────────────────────────────────
async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  // Serve worker from our own domain — avoids CDN version mismatch & CORS issues
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pages: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item: any) => item.str)
      .join(' ')
    pages.push(pageText)
  }

  return pages.join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// Regex-based field extraction
// ─────────────────────────────────────────────────────────────────────────────

/** Parse Indian-style amounts: 1,40,000.00 → 140000 */
function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').trim()
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

/** Normalise various date formats to YYYY-MM-DD */
function parseDate(raw: string): string | null {
  if (!raw) return null
  raw = raw.trim()

  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  }

  // DD-MMM-YY or DD-MMM-YYYY  e.g. 11-Apr-26 or 11-Apr-2026
  const mdy = raw.match(/^(\d{1,2})[-\/\s]([A-Za-z]{3})[-\/\s](\d{2,4})$/)
  if (mdy) {
    const [, d, m, y] = mdy
    const mon = months[m.toLowerCase()]
    if (!mon) return null
    const year = y.length === 2 ? (parseInt(y) >= 50 ? `19${y}` : `20${y}`) : y
    return `${year}-${mon}-${d.padStart(2, '0')}`
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = raw.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/)
  if (dmy) {
    const [, d, m, y] = dmy
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // YYYY-MM-DD (already ISO)
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return raw

  // MM/DD/YYYY
  const mdy2 = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mdy2) {
    const [, m, d, y] = mdy2
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  return null
}

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1]?.trim()) return m[1].trim()
  }
  return null
}

function parseInvoiceText(text: string): ExtractedInvoiceData {
  // Normalise whitespace but keep newlines
  const t = text.replace(/[ \t]+/g, ' ')

  // ── Invoice Number ────────────────────────────────────────────────────────
  const invoice_number = firstMatch(t, [
    /Invoice\s*(?:No|Number|#|\.)[:\s]+([A-Z0-9\/\-]+)/i,
    /Inv\.?\s*(?:No|#)[:\s]+([A-Z0-9\/\-]+)/i,
    /Bill\s*(?:No|Number)[:\s]+([A-Z0-9\/\-]+)/i,
    // Standalone alphanumeric codes like SIRPL/26-27/0005 or BITC/25-26/02
    /\b([A-Z]{2,}[\/\-]\d{2,}[\/\-\d]*\d{2,})\b/,
  ])

  // ── Dates ─────────────────────────────────────────────────────────────────
  const rawIssueDate = firstMatch(t, [
    /(?:Invoice|Issue|Invoic(?:e)?\s*Date|Date\s*of\s*Invoice)[:\s]+(\d{1,2}[-\/\s][A-Za-z]{3}[-\/\s]\d{2,4})/i,
    /(?:Invoice|Issue|Invoic(?:e)?\s*Date|Date\s*of\s*Invoice)[:\s]+(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/i,
    /Date[:\s]+(\d{1,2}[-\/\s][A-Za-z]{3}[-\/\s]\d{2,4})/i,
    /Date[:\s]+(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/i,
  ])
  const issue_date = rawIssueDate ? parseDate(rawIssueDate) : null

  const rawDueDate = firstMatch(t, [
    /(?:Due\s*Date|Payment\s*Due|Pay\s*By|Due\s*on|Expiry)[:\s]+(\d{1,2}[-\/\s][A-Za-z]{3}[-\/\s]\d{2,4})/i,
    /(?:Due\s*Date|Payment\s*Due|Pay\s*By|Due\s*on|Expiry)[:\s]+(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/i,
  ])
  const due_date = rawDueDate ? parseDate(rawDueDate) : null

  // ── Amounts ───────────────────────────────────────────────────────────────
  const rawTotal = firstMatch(t, [
    /(?:Grand\s*Total|Total\s*Amount|Amount\s*Due|Net\s*Payable|Total\s*Payable|Invoice\s*Total|Total)[:\s₹Rs.]*\s*([\d,]+\.?\d*)/i,
    /(?:Total)[:\s₹Rs.]*\s*([\d,]+\.?\d*)/i,
  ])
  const total_amount = rawTotal ? parseAmount(rawTotal) : null

  const rawTax = firstMatch(t, [
    /(?:GST|IGST|CGST\s*\+\s*SGST|Tax\s*Amount|Total\s*Tax|Tax)[:\s₹Rs.]*\s*([\d,]+\.?\d*)/i,
    /(?:IGST|CGST|SGST)\s*@?\s*\d+%?[:\s₹Rs.]*\s*([\d,]+\.?\d*)/i,
  ])
  const tax_amount = rawTax ? parseAmount(rawTax) : null

  const rawBase = firstMatch(t, [
    /(?:Sub\s*Total|Subtotal|Taxable\s*(?:Value|Amount)|Base\s*Amount|Net\s*Amount)[:\s₹Rs.]*\s*([\d,]+\.?\d*)/i,
  ])
  let amount = rawBase ? parseAmount(rawBase) : null

  // Derive base from total - tax if not found
  if (!amount && total_amount !== null && tax_amount !== null) {
    amount = parseFloat((total_amount - tax_amount).toFixed(2))
  }
  // If only total found, use it as amount with 0 tax
  if (!amount && total_amount !== null) {
    amount = total_amount
  }

  // ── Client Name ───────────────────────────────────────────────────────────
  const client_name = firstMatch(t, [
    /(?:Bill\s*To|Billed\s*To|Ship\s*To|Sold\s*To|To)[:\s]+([A-Z][^\n,]{3,60}?)(?:\s*\n|\s{2,}|GSTIN|GST|Ph|Tel|Address)/i,
    /(?:Buyer|Customer|Client)[:\s]+([A-Z][^\n,]{3,60}?)(?:\s*\n|\s{2,})/i,
  ])

  // ── Description ───────────────────────────────────────────────────────────
  const description = firstMatch(t, [
    /(?:Description\s*of\s*(?:Goods|Services?)|Particulars|Item\s*Description|Narration)[:\s]+([^\n]{5,120})/i,
    /(?:Description)[:\s]+([^\n]{5,120})/i,
  ])

  // ── Notes (payment terms) ─────────────────────────────────────────────────
  const notes = firstMatch(t, [
    /(?:Payment\s*Terms?|Terms?\s*&?\s*Conditions?|Remarks?|Notes?)[:\s]+([^\n]{5,200})/i,
  ])

  return {
    client_name: client_name || null,
    invoice_number: invoice_number || null,
    issue_date,
    due_date,
    description: description || null,
    amount,
    tax_amount,
    total_amount,
    notes: notes || null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────────────
export async function extractInvoiceData(file: File): Promise<ExtractedInvoiceData> {
  const isPdf = file.type === 'application/pdf'

  if (!isPdf) {
    // For images, return empty — user fills manually
    // (OCR would need heavy WASM bundle; PDF upload is recommended)
    throw new Error('Please upload a PDF file for best results. Image scanning is not supported.')
  }

  const text = await extractTextFromPdf(file)
  if (!text.trim()) {
    throw new Error('Could not extract text from this PDF. The file may be scanned/image-based. Please enter details manually.')
  }

  return parseInvoiceText(text)
}
