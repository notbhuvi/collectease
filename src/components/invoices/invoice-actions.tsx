'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, CheckCircle, Send, FileDown, Trash2, Eye } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { MarkPaidDialog } from './mark-paid-dialog'
import { cn } from '@/lib/utils'

interface InvoiceActionsProps {
  invoice: {
    id: string
    status: string
    invoice_number: string
    total_amount: number
    paid_amount?: number | null
    client_id: string
    business_id: string
  }
}

export function InvoiceActions({ invoice }: InvoiceActionsProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [showPaidDialog, setShowPaidDialog] = useState(false)
  const [loading, setLoading] = useState(false)

  async function sendReminder() {
    setLoading(true)
    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: invoice.id, manual: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: 'Reminder sent!', variant: 'success' })
    } catch (err: any) {
      toast({ title: 'Failed to send reminder', description: err.message, variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  async function downloadPDF() {
    try {
      const res = await fetch(`/api/documents?invoiceId=${invoice.id}&type=invoice`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${invoice.invoice_number}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast({ title: 'Failed to generate PDF', variant: 'error' })
    }
  }

  async function deleteInvoice() {
    if (!confirm('Delete this invoice? This cannot be undone.')) return
    const supabase = createClient()
    await supabase.from('invoices').delete().eq('id', invoice.id)
    toast({ title: 'Invoice deleted', variant: 'success' })
    router.refresh()
  }

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="z-50 min-w-[180px] rounded-xl border border-gray-200 bg-white shadow-xl p-1 text-sm"
            align="end"
            sideOffset={4}
          >
            {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
              <DropdownMenu.Item
                onSelect={() => setShowPaidDialog(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-green-700 hover:bg-green-50 cursor-pointer outline-none"
              >
                <CheckCircle className="h-4 w-4" />
                {invoice.paid_amount && invoice.paid_amount > 0 ? 'Record Payment' : 'Mark as Paid'}
              </DropdownMenu.Item>
            )}

            {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
              <DropdownMenu.Item
                onSelect={sendReminder}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 cursor-pointer outline-none"
              >
                <Send className="h-4 w-4" />
                Send Reminder
              </DropdownMenu.Item>
            )}

            <DropdownMenu.Item
              onSelect={downloadPDF}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 cursor-pointer outline-none"
            >
              <FileDown className="h-4 w-4" />
              Download PDF
            </DropdownMenu.Item>

            <DropdownMenu.Separator className="my-1 h-px bg-gray-100" />

            <DropdownMenu.Item
              onSelect={deleteInvoice}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 cursor-pointer outline-none"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <MarkPaidDialog
        open={showPaidDialog}
        onClose={() => setShowPaidDialog(false)}
        invoice={invoice}
      />
    </>
  )
}
