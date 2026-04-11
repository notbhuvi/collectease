'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { generateInvoiceNumber, formatCurrency } from '@/lib/utils'
import { Plus, Minus, UserPlus } from 'lucide-react'
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

export function CreateInvoiceForm({ businessId, clients: initialClients }: CreateInvoiceFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [showNewClient, setShowNewClient] = useState(false)
  const [clients, setClients] = useState(initialClients)

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
  })

  const amount = parseFloat(form.amount) || 0
  const taxRate = parseFloat(form.taxRate) || 0
  const taxAmount = (amount * taxRate) / 100
  const totalAmount = amount + taxAmount

  function update(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

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

          {/* Sidebar */}
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
