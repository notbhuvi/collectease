'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { formatCurrency } from '@/lib/utils'
import { Trophy } from 'lucide-react'

interface Props {
  loadId: string
  transporterId: string
  bidRate: number
  totalFare: number
  transporterName: string
  rateLabel: string
}

export function AwardBidButton({ loadId, transporterId, bidRate, totalFare, transporterName, rateLabel }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  async function handleAward() {
    if (!confirm(`Award this load to ${transporterName} at ${formatCurrency(bidRate)} ${rateLabel} with total fare ${formatCurrency(totalFare)}?`)) return
    setLoading(true)
    try {
      const res = await fetch('/api/transport/award', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ load_id: loadId, transporter_id: transporterId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: 'Load awarded!', description: `Awarded to ${transporterName}`, variant: 'success' })
      router.refresh()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button size="sm" variant="success" onClick={handleAward} loading={loading}>
      <Trophy className="h-3 w-3" />
      Award
    </Button>
  )
}
