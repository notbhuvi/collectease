'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

export function DeleteUserButton({ userId, userEmail }: { userId: string; userEmail: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    if (!confirm(`Delete user "${userEmail}"? This will remove their account and all associated data.`)) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Failed to delete user')
        return
      }
      router.refresh()
    } catch {
      alert('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
    >
      <Trash2 className="h-3.5 w-3.5" />
      {loading ? 'Deleting…' : 'Delete'}
    </button>
  )
}
