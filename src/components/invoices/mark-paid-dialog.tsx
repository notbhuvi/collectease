'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { formatCurrency } from '@/lib/utils'

interface MarkPaidDialogProps {
  open: boolean
  onClose: () => void
  invoice: {
    id: string
    invoice_number: string
    total_amount: number
    paid_amount?: number | null
    business_id: string
  }
}

export function MarkPaidDialog({ open, onClose, invoice }: MarkPaidDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const alreadyPaid = Number(invoice.paid_amount || 0)
  const remaining = invoice.total_amount - alreadyPaid

  const [form, setForm] = useState({
    amount: String(remaining > 0 ? remaining : invoice.total_amount),
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'upi',
    reference: '',
    notes: '',
  })

  const enteredAmount = parseFloat(form.amount) || 0
  const isPartial = enteredAmount < remaining - 0.01 // 1 paise tolerance
  const newTotal = alreadyPaid + enteredAmount

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_id: invoice.id,
          amount: enteredAmount,
          payment_date: form.paymentDate,
          payment_method: form.paymentMethod,
          reference: form.reference || null,
          notes: form.notes || null,
        }),
      })

      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error)
      }

      const { isFullyPaid } = await res.clone().json().catch(() => ({}))

      toast({
        title: isFullyPaid ? 'Fully paid!' : 'Partial payment recorded',
        description: isFullyPaid
          ? `${invoice.invoice_number} is now fully paid`
          : `${formatCurrency(enteredAmount)} recorded. ${formatCurrency(invoice.total_amount - newTotal)} still outstanding.`,
        variant: 'success',
      })
      onClose()
      router.refresh()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            {invoice.invoice_number} · Total {formatCurrency(invoice.total_amount)}
          </DialogDescription>
        </DialogHeader>

        {/* Payment summary */}
        {alreadyPaid > 0 && (
          <div className="bg-blue-50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between text-blue-800">
              <span>Already received</span>
              <span className="font-medium">{formatCurrency(alreadyPaid)}</span>
            </div>
            <div className="flex justify-between text-blue-900 font-semibold border-t border-blue-200 pt-1">
              <span>Remaining balance</span>
              <span>{formatCurrency(remaining)}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-1">
          <Input
            label="Amount Received (₹)"
            type="number"
            step="0.01"
            min="0.01"
            max={remaining > 0 ? remaining : undefined}
            value={form.amount}
            onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
            required
          />

          {/* Partial payment notice */}
          {isPartial && enteredAmount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
              Partial payment — {formatCurrency(invoice.total_amount - newTotal)} will still be outstanding.
              Reminders will continue until fully paid.
            </div>
          )}

          <Input
            label="Payment Date"
            type="date"
            value={form.paymentDate}
            onChange={e => setForm(p => ({ ...p, paymentDate: e.target.value }))}
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <Select value={form.paymentMethod} onValueChange={v => setForm(p => ({ ...p, paymentMethod: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="neft">NEFT / RTGS</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input
            label="Reference / UTR Number"
            placeholder="e.g. UPI ref or transaction ID"
            value={form.reference}
            onChange={e => setForm(p => ({ ...p, reference: e.target.value }))}
          />
          <Input
            label="Notes (optional)"
            value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
          />

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" variant="success" loading={loading} className="flex-1">
              {isPartial ? 'Record Partial Payment' : 'Record Payment'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
