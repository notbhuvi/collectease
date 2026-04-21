'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function DeleteLoadButton({ loadId }: { loadId: string }) {
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
      size="sm"
      onClick={handleDelete}
      disabled={loading}
      className="text-red-500 hover:text-red-700 hover:bg-red-50 border border-red-200"
    >
      <Trash2 className="h-4 w-4 mr-1" />
      {loading ? 'Deleting…' : 'Delete Load'}
    </Button>
  )
}
