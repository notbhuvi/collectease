'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { formatDate } from '@/lib/utils'
import type { BillApprovalStatus } from '@/types'
import type { BillListItem } from '@/lib/bills'

function getStatusVariant(status: BillApprovalStatus) {
  if (status === 'approved') return 'success'
  if (status === 'declined') return 'destructive'
  return 'warning'
}

export function BillTable({ initialBills }: { initialBills: BillListItem[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const [bills, setBills] = useState(initialBills)
  const [activeBillId, setActiveBillId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function downloadBill(billId: string) {
    setActiveBillId(billId)

    startTransition(async () => {
      try {
        const res = await fetch('/api/bills/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ billId }),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Download failed')
        }

        const blob = await res.blob()
        const contentDisposition = res.headers.get('Content-Disposition') || ''
        const nameMatch = contentDisposition.match(/filename="(.+)"/)
        const fileName = nameMatch?.[1] || 'stamped-bill.pdf'
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = fileName
        link.click()
        URL.revokeObjectURL(url)

        setBills(current => current.filter(bill => bill.id !== billId))
        toast({
          title: 'Stamped bill downloaded',
          description: 'The source files were cleaned up and only the text log remains.',
          variant: 'success',
        })
        router.refresh()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Download failed'
        toast({ title: 'Could not download bill', description: message, variant: 'error' })
      } finally {
        setActiveBillId(null)
      }
    })
  }

  if (bills.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center">
        <p className="text-sm font-medium text-gray-900">No active bills right now.</p>
        <p className="mt-1 text-sm text-gray-500">Uploaded bills will appear here until their stamped copy is downloaded.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">File Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Upload Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {bills.map(bill => {
              const isLoading = isPending && activeBillId === bill.id
              return (
                <tr key={bill.id}>
                  <td className="px-4 py-4">
                    <div className="text-sm font-medium text-gray-900">{bill.original_name || 'Untitled bill'}</div>
                    {bill.admin_remark ? <div className="mt-1 text-xs text-gray-500">Remark: {bill.admin_remark}</div> : null}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">{formatDate(bill.created_at)}</td>
                  <td className="px-4 py-4">
                    <Badge variant={getStatusVariant(bill.status)}>{bill.status}</Badge>
                  </td>
                  <td className="px-4 py-4">
                    {bill.status === 'pending' ? (
                      <span className="text-sm text-gray-500">Awaiting admin review</span>
                    ) : (
                      <Button size="sm" onClick={() => downloadBill(bill.id)} disabled={isLoading}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        Download Stamped File
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
