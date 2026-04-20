'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { IndianRupee, Edit2 } from 'lucide-react'

interface Props {
  loadId: string
  existingBid?: { id: string; amount: number }
  isEdit?: boolean
}

export function BidModal({ loadId, existingBid, isEdit }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [amount, setAmount] = useState(existingBid?.amount?.toString() || '')
  const [remarks, setRemarks] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) {
      toast({ title: 'Enter a valid bid amount', variant: 'error' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/transport/bids', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isEdit
            ? { bid_id: existingBid!.id, bid_amount: Number(amount), remarks }
            : { load_id: loadId, bid_amount: Number(amount), remarks }
        ),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: isEdit ? 'Bid updated!' : 'Bid submitted!', variant: 'success' })
      setOpen(false)
      router.refresh()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button size="sm" variant={isEdit ? 'outline' : 'default'} onClick={() => setOpen(true)}>
        {isEdit ? <><Edit2 className="h-3 w-3" /> Edit Bid</> : <><IndianRupee className="h-3 w-3" /> Place Bid</>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Update Your Bid' : 'Place a Bid'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Quote (₹)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="w-full h-9 pl-7 pr-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter amount"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Remarks (optional)</label>
              <textarea
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={2}
                placeholder="Any conditions, transit time, etc."
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
              />
            </div>
            <p className="text-xs text-gray-400">
              ⚠️ Competitor names and bids are hidden. You can update your bid until the deadline.
            </p>
            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" loading={loading}>{isEdit ? 'Update Bid' : 'Submit Bid'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
