'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { CreateClientDialog } from './create-client-dialog'

export function AddClientButton({ businessId }: { businessId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Add Client
      </Button>
      <CreateClientDialog
        open={open}
        onClose={() => setOpen(false)}
        businessId={businessId}
        onCreated={() => {
          setOpen(false)
          router.refresh()
        }}
      />
    </>
  )
}
