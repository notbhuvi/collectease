'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { Trash2 } from 'lucide-react'

interface Props {
  bidId: string
  transporterName: string
  disabled?: boolean
}

export function DeleteBidButton({ bidId, transporterName, disabled = false }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (disabled) return
    if (!confirm(`Delete bid from ${transporterName}? This cannot be undone.`)) return
    setLoading(true)
    try {
      const res = await fetch(`/api/transport/bids/${bidId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: 'Bid deleted', variant: 'success' })
      router.refresh()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button size="sm" variant="ghost" onClick={handleDelete} loading={loading} disabled={disabled}
      className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 px-2">
      <Trash2 className="h-3 w-3" />
    </Button>
  )
}
