'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function DeleteLoadButton({ loadId, compact = false }: { loadId: string; compact?: boolean }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    if (!confirm('Delete this load? All bids and award records will also be removed. This cannot be undone.')) return
    setLoading(true)
    try {
      const res = await fetch(`/api/transport/loads/${loadId}`, { method: 'DELETE' })
      if (!res.ok) {
        const { error } = await res.json()
        alert(error || 'Failed to delete load')
        return
      }
      router.push('/transport/loads')
      router.refresh()
    } catch {
      alert('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size={compact ? 'icon' : 'sm'}
      onClick={handleDelete}
      disabled={loading}
      className={`text-red-500 hover:text-red-700 hover:bg-red-50 border border-red-200 ${compact ? 'h-8 w-8 p-0' : ''}`}
      title="Delete load"
    >
      <Trash2 className={`h-4 w-4 ${compact ? '' : 'mr-1'}`} />
      {!compact && (loading ? 'Deleting…' : 'Delete Load')}
    </Button>
  )
}
