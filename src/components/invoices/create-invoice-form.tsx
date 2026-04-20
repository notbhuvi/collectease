'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { generateInvoiceNumber, formatCurrency } from '@/lib/utils'
import { createClient } from '@supabase/supabase-js'
import { UserPlus, Upload, FileText, X, Loader2, Bell, Clock } from 'lucide-react'
import { CreateClientDialog } from '@/components/clients/create-client-dialog'

interface Client {
  id: string
  name: string
  email: string | null
  phone: string | null
  gstin: string | null
}

interface CreateInvoiceFormProps {
  businessId: string
  clients: Client[]
}

interface ExtractedData {
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

export function CreateInvoiceForm({ businessId, clients: initialClients }: CreateInvoiceFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [showNewClient, setShowNewClient] = useState(false)
  const [clients, setClients] = useState(initialClients)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [extractionNote, setExtractionNote] = useState('')

  const today = new Date().toISOString().split('T')[0]
  const defaultDue = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]

  const [form, setForm] = useState({
    clientId: '',
    invoiceNumber: generateInvoiceNumber(),
    amount: '',
    taxRate: '18',
    issueDate: today,
    dueDate: defaultDue,
    description: '',
    notes: '',
    // Reminder settings
    reminderInitialDelay: '7',
    reminderIntervalDays: '7',
  })

  const amount = parseFloat(form.amount) || 0
  const taxRate = parseFloat(form.taxRate) || 0
  const taxAmount = (amount * taxRate) / 100
  const totalAmount = amount + taxAmount

  function update(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  // ── AI Extraction ───────────────────────────────────────────────────────────

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadedFile(file)
    await extractFromFile(file)
    // Reset input so same file can be re-uploaded
    e.target.value = ''
  }

  async function extractFromFile(file: File) {
    setExtracting(true)
    setExtractionNote('')
    try {
      const DIRECT_LIMIT = 3 * 1024 * 1024 // 3 MB — send base64 directly, no Supabase needed

      let extractBody: Record<string, string>

      if (file.size <= DIRECT_LIMIT) {
        // Small file: convert to base64 and send directly (simplest path)
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            const dataUrl = reader.result as string
            resolve(dataUrl.split(',')[1]) // strip "data:...;base64," prefix
          }
          reader.onerror = () => reject(new Error('Failed to read file'))
          reader.readAsDataURL(file)
        })
        extractBody = { base64, mimeType: file.type }
      } else {
        // Large file: upload to Supabase Storage to bypass Vercel's 4.5 MB body limit
        const urlRes = await fetch('/api/extract-invoice/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileType: file.type }),
        })
        if (!urlRes.ok) {
          const e = await urlRes.json().catch(() => ({}))
          throw new Error(e.error || 'Could not get upload URL')
        }
        const { token, path } = await urlRes.json()

        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        const { error: uploadError } = await supabase.storage
          .from('invoice-documents')
          .uploadToSignedUrl(path, token, file, { contentType: file.type })
        if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`)

        extractBody = { path }
      }

      const extractRes = await fetch('/api/extract-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(extractBody),
      })
      if (!extractRes.ok) {
        const err = await extractRes.json().catch(() => ({}))
        throw new Error(err.error || 'AI extraction failed')
      }
      const ex = await extractRes.json()

      applyExtractedData(ex)
      const found = Object.values(ex).filter(v => v !== null).length
      setExtractionNote(`${found} fields extracted by AI — review and adjust before saving.`)
      toast({ title: 'AI extraction complete!', description: 'Fields filled from invoice. Please review.', variant: 'success' })
    } catch (err: any) {
      toast({ title: 'Extraction failed', description: err.message, variant: 'error' })
      setUploadedFile(null)
    } finally {
      setExtracting(false)
    }
  }

  function applyExtractedData(ex: ExtractedData) {
    setForm(prev => {
      const next = { ...prev }

      if (ex.invoice_number) next.invoiceNumber = ex.invoice_number
      if (ex.issue_date) next.issueDate = ex.issue_date
      if (ex.due_date) next.dueDate = ex.due_date
      if (ex.description) next.description = ex.description
      if (ex.notes) next.notes = ex.notes

      // Amount handling: use base amount if available, else derive from total/tax
      if (ex.amount !== null && ex.amount !== undefined) {
        next.amount = String(ex.amount)
        // Try to infer GST rate from tax_amount
        if (ex.tax_amount && ex.amount > 0) {
          const inferredRate = Math.round((ex.tax_amount / ex.amount) * 100)
          const validRates = [0, 5, 12, 18, 28]
          const closest = validRates.reduce((a, b) => Math.abs(b - inferredRate) < Math.abs(a - inferredRate) ? b : a)
          next.taxRate = String(closest)
        }
      } else if (ex.total_amount !== null && ex.total_amount !== undefined) {
        next.amount = String(ex.total_amount)
        next.taxRate = '0'
      }

      // Try to match client by name
      if (ex.client_name) {
        const matched = initialClients.find(c =>
          c.name.toLowerCase().includes(ex.client_name!.toLowerCase()) ||
          ex.client_name!.toLowerCase().includes(c.name.toLowerCase())
        )
        if (matched) next.clientId = matched.id
      }

      return next
    })
  }

  function clearUpload() {
    setUploadedFile(null)
    setExtractionNote('')
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.clientId) {
      toast({ title: 'Please select a client', variant: 'error' })
      return
    }
    setLoading(true)

    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: businessId,
          client_id: form.clientId,
          invoice_number: form.invoiceNumber,
          amount,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          issue_date: form.issueDate,
          due_date: form.dueDate,
          description: form.description || null,
          notes: form.notes || null,
          status: 'sent',
          reminder_initial_delay: parseInt(form.reminderInitialDelay) || 0,
          reminder_interval_days: parseInt(form.reminderIntervalDays) || 7,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      toast({ title: 'Invoice created!', variant: 'success' })
      router.push('/dashboard/invoices')
      router.refresh()
    } catch (err: any) {
      toast({ title: 'Error creating invoice', description: err.message, variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main form */}
          <div className="lg:col-span-2 space-y-6">

            {/* ── AI Upload Banner ── */}
            <Card className="border-dashed border-2 border-blue-200 bg-blue-50/40">
              <CardContent className="py-4">
                {extracting ? (
                  <div className="flex items-center gap-3 text-blue-700">
                    <Loader2 className="h-5 w-5 animate-spin shrink-0" />
                    <div>
                      <p className="font-medium text-sm">Scanning document with AI…</p>
                      <p className="text-xs text-blue-500">Extracting invoice details</p>
                    </div>
                  </div>
                ) : uploadedFile ? (
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-blue-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-blue-800 truncate">{uploadedFile.name}</p>
                      {extractionNote && (
                        <p className="text-xs text-green-600 mt-0.5">{extractionNote}</p>
                      )}
                    </div>
                    <button type="button" onClick={clearUpload} className="text-gray-400 hover:text-gray-600">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Upload className="h-5 w-5 text-blue-500 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-blue-800">Auto-fill from invoice</p>
                        <p className="text-xs text-blue-500">Upload a PDF or image — AI will extract the details</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="shrink-0 border-blue-300 text-blue-700 hover:bg-blue-100"
                    >
                      Upload Invoice
                    </Button>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,image/jpeg,image/jpg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </CardContent>
            </Card>

            {/* ── Invoice Details ── */}
            <Card>
              <CardHeader>
                <CardTitle>Invoice Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Invoice Number"
                    value={form.invoiceNumber}
                    onChange={e => update('invoiceNumber', e.target.value)}
                    required
                  />
                  <Input
                    label="Issue Date"
                    type="date"
                    value={form.issueDate}
                    onChange={e => update('issueDate', e.target.value)}
                    required
                  />
                </div>
                <Input
                  label="Due Date"
                  type="date"
                  value={form.dueDate}
                  onChange={e => update('dueDate', e.target.value)}
                  required
                />
                <Textarea
                  label="Description / Service Details"
                  placeholder="e.g. Web development services for Q1 2024"
                  value={form.description}
                  onChange={e => update('description', e.target.value)}
                  rows={3}
                />
              </CardContent>
            </Card>

            {/* ── Amount ── */}
            <Card>
              <CardHeader>
                <CardTitle>Amount</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Base Amount (₹)"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={e => update('amount', e.target.value)}
                    required
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">GST Rate</label>
                    <Select value={form.taxRate} onValueChange={v => update('taxRate', v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">No GST (0%)</SelectItem>
                        <SelectItem value="5">5% GST</SelectItem>
                        <SelectItem value="12">12% GST</SelectItem>
                        <SelectItem value="18">18% GST</SelectItem>
                        <SelectItem value="28">28% GST</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span>{formatCurrency(amount)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>GST ({taxRate}%)</span>
                    <span>{formatCurrency(taxAmount)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2 text-base">
                    <span>Total</span>
                    <span>{formatCurrency(totalAmount)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Reminder Settings ── */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-orange-500" />
                  <CardTitle>Automatic Reminders</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-500">
                  SIRPL will automatically send payment reminders for this invoice until it's marked paid.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First reminder
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="-30"
                        max="90"
                        value={form.reminderInitialDelay}
                        onChange={e => update('reminderInitialDelay', e.target.value)}
                        className="w-24"
                      />
                      <span className="text-sm text-gray-500 whitespace-nowrap">days after due date</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Use negative to send before due date</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Repeat every
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        max="90"
                        value={form.reminderIntervalDays}
                        onChange={e => update('reminderIntervalDays', e.target.value)}
                        className="w-24"
                      />
                      <span className="text-sm text-gray-500 whitespace-nowrap">days</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Until invoice is paid</p>
                  </div>
                </div>

                {/* Visual summary */}
                <div className="bg-orange-50 rounded-lg p-3 flex items-start gap-2 text-sm text-orange-800">
                  <Clock className="h-4 w-4 mt-0.5 shrink-0 text-orange-500" />
                  <span>
                    First reminder{' '}
                    {parseInt(form.reminderInitialDelay) === 0
                      ? 'on the due date'
                      : parseInt(form.reminderInitialDelay) < 0
                      ? `${Math.abs(parseInt(form.reminderInitialDelay))} days before due date`
                      : `${form.reminderInitialDelay} days after due date`}
                    , then every {form.reminderIntervalDays} day{parseInt(form.reminderIntervalDays) !== 1 ? 's' : ''} until paid.
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* ── Notes ── */}
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Payment terms, bank details, or any other notes..."
                  value={form.notes}
                  onChange={e => update('notes', e.target.value)}
                  rows={3}
                />
              </CardContent>
            </Card>
          </div>

          {/* ── Sidebar ── */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Client</CardTitle>
                  <button
                    type="button"
                    onClick={() => setShowNewClient(true)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <UserPlus className="h-3 w-3" />
                    New Client
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Client</label>
                  <Select value={form.clientId} onValueChange={v => update('clientId', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a client..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {form.clientId && (() => {
                  const c = clients.find(x => x.id === form.clientId)
                  if (!c) return null
                  return (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg text-sm text-blue-900">
                      <p className="font-medium">{c.name}</p>
                      {c.email && <p className="text-blue-700 text-xs">{c.email}</p>}
                      {c.phone && <p className="text-blue-700 text-xs">{c.phone}</p>}
                    </div>
                  )
                })()}
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button type="submit" loading={loading} className="flex-1">
                Create Invoice
              </Button>
            </div>
          </div>
        </div>
      </form>

      <CreateClientDialog
        open={showNewClient}
        onClose={() => setShowNewClient(false)}
        businessId={businessId}
        onCreated={client => {
          setClients(prev => [...prev, client])
          update('clientId', client.id)
          setShowNewClient(false)
        }}
      />
    </>
  )
}
