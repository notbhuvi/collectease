'use client'

import { useState } from 'react'
import { ShieldPlus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'

export function EnsureHrUserButton() {
  const { toast } = useToast()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/bootstrap-hr', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Unable to ensure HR user')
      }

      toast({
        title: 'HR user ready',
        description: `${data.user.email} is available with the HR role.`,
        variant: 'success',
      })
      router.refresh()
    } catch (error: unknown) {
      toast({
        title: 'Unable to prepare HR user',
        description: error instanceof Error ? error.message : 'Request failed',
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button onClick={handleClick} loading={loading} variant="outline">
      <ShieldPlus className="h-4 w-4" />
      Ensure HR Login
    </Button>
  )
}
