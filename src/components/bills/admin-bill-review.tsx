'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { PdfViewer } from './pdf-viewer'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { formatDate } from '@/lib/utils'
import type { BillListItem } from '@/lib/bills'

type Decision = 'approved' | 'declined'

export function AdminBillReview({ initialBills }: { initialBills: BillListItem[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const [bills, setBills] = useState(initialBills)
  const [selectedBill, setSelectedBill] = useState<BillListItem | null>(null)
  const [decision, setDecision] = useState<Decision>('approved')
  const [remark, setRemark] = useState('')
  const [isPending, startTransition] = useTransition()

  function openDecisionModal(bill: BillListItem, nextDecision: Decision) {
    setSelectedBill(bill)
    setDecision(nextDecision)
    setRemark('')
  }

  function closeDecisionModal() {
    if (isPending) return
    setSelectedBill(null)
    setRemark('')
  }

  async function submitDecision() {
    if (!selectedBill) return
    if (!remark.trim()) {
      toast({ title: 'Remark required', description: 'Please capture the admin decision remark.', variant: 'error' })
      return
    }

    startTransition(async () => {
      try {
        const res = await fetch('/api/bills/decision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            billId: selectedBill.id,
            decision,
            remark,
          }),
        })

        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || 'Decision failed')
        }

        setBills(current => current.filter(bill => bill.id !== selectedBill.id))
        setSelectedBill(null)
        setRemark('')
        toast({
          title: decision === 'approved' ? 'Bill approved' : 'Bill declined',
          description: 'The stamped PDF is now available to the finance team.',
          variant: 'success',
        })
        router.refresh()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Decision failed'
        toast({ title: 'Could not update bill', description: message, variant: 'error' })
      }
    })
  }

  if (bills.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center">
        <p className="text-sm font-medium text-gray-900">No pending bill approvals.</p>
        <p className="mt-1 text-sm text-gray-500">New finance uploads will appear here for review.</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        {bills.map(bill => (
          <Card key={bill.id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{bill.original_name || 'Untitled bill'}</CardTitle>
              <div className="space-y-1 text-sm text-gray-500">
                <p>Uploaded by: {bill.uploaded_by_name || bill.uploaded_by_email || 'Unknown user'}</p>
                <p>Date: {formatDate(bill.created_at)}</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <PdfViewer
                url={bill.preview_url}
                fileType={bill.file_type}
                title={bill.original_name || 'Bill preview'}
              />
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => openDecisionModal(bill, 'approved')}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approve
                </Button>
                <Button variant="outline" className="text-red-600 hover:text-red-700" onClick={() => openDecisionModal(bill, 'declined')}>
                  <XCircle className="mr-2 h-4 w-4" />
                  Decline
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={Boolean(selectedBill)} onOpenChange={(open) => (!open ? closeDecisionModal() : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{decision === 'approved' ? 'Approve Bill' : 'Decline Bill'}</DialogTitle>
            <DialogDescription>
              Add the admin remark that should be recorded with this bill decision.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
              {selectedBill?.original_name || 'Untitled bill'}
            </div>
            <Textarea
              value={remark}
              onChange={(event) => setRemark(event.target.value)}
              placeholder="Enter approval or decline remark"
              rows={5}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeDecisionModal} disabled={isPending}>Cancel</Button>
              <Button onClick={submitDecision} disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {decision === 'approved' ? 'Approve' : 'Decline'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
