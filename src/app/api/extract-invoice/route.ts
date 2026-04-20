import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const maxDuration = 60

const EXTRACTION_PROMPT = `Extract invoice data from this document and return ONLY a valid JSON object.
Use null for any field that cannot be found. All dates must be in YYYY-MM-DD format.
Amount fields must be plain numbers (no currency symbols or commas).

{
  "invoice_number": "string or null",
  "issue_date": "YYYY-MM-DD or null",
  "due_date": "YYYY-MM-DD or null",
  "amount": base amount before tax as number or null,
  "tax_amount": GST/tax amount as number or null,
  "total_amount": total including tax as number or null,
  "client_name": "name of buyer/bill-to party or null",
  "description": "brief description of goods/services or null",
  "notes": "payment terms or bank details or null"
}

Return ONLY the JSON object, no markdown, no explanation.`

async function callGemini(base64: string, mimeType: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const modelsToTry = ['gemini-2.0-flash', 'gemini-2.5-flash-lite', 'gemini-1.5-flash']
  let lastError = ''

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName })
      const result = await model.generateContent([
        { inlineData: { data: base64, mimeType } },
        EXTRACTION_PROMPT,
      ])
      return result.response.text()
    } catch (err: any) {
      lastError = err.message
    }
  }
  throw new Error(`Gemini extraction failed: ${lastError}`)
}

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  let base64: string
  let mimeType: string

  if (body.base64) {
    // Small file: client sent base64 directly (< 3MB raw, saves Supabase round-trip)
    base64 = body.base64
    mimeType = body.mimeType || 'application/pdf'
  } else if (body.path) {
    // Large file: download from Supabase Storage (bypasses Vercel's 4.5MB body limit)
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const { data: fileBlob, error: downloadError } = await serviceClient.storage
      .from('invoice-documents')
      .download(body.path)

    if (downloadError || !fileBlob) {
      return NextResponse.json(
        { error: `Failed to retrieve uploaded file: ${downloadError?.message}` },
        { status: 500 }
      )
    }

    const arrayBuffer = await fileBlob.arrayBuffer()
    base64 = Buffer.from(arrayBuffer).toString('base64')
    mimeType = body.path.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'

    // Clean up temp file (non-blocking)
    serviceClient.storage.from('invoice-documents').remove([body.path]).catch(() => {})
  } else {
    return NextResponse.json({ error: 'No file data provided' }, { status: 400 })
  }

  try {
    const responseText = await callGemini(base64, mimeType)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found in AI response')
    const extracted = JSON.parse(jsonMatch[0])
    return NextResponse.json(extracted)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
