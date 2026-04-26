'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png']
const MAX_SIZE_BYTES = 10 * 1024 * 1024

interface UploadBillProps {
  title?: string
  description?: string
}

export function UploadBill({
  title = 'Upload Bill',
  description = 'Accepted formats: PDF, JPG, JPEG, PNG. Max size: 10MB.',
}: UploadBillProps) {
  const router = useRouter()
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [selectedName, setSelectedName] = useState<string>('')
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const file = inputRef.current?.files?.[0]
    if (!file) {
      toast({ title: 'Choose a bill first', variant: 'error' })
      return
    }

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({ title: 'Unsupported file type', description: 'Only PDF, JPG, JPEG, and PNG are allowed.', variant: 'error' })
      return
    }

    if (file.size > MAX_SIZE_BYTES) {
      toast({ title: 'File too large', description: 'Keep the bill file under 10MB.', variant: 'error' })
      return
    }

    const formData = new FormData()
    formData.append('file', file)

    startTransition(async () => {
      try {
        const res = await fetch('/api/bills/upload', {
          method: 'POST',
          body: formData,
        })
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || 'Upload failed')
        }

        if (inputRef.current) {
          inputRef.current.value = ''
        }
        setSelectedName('')
        toast({ title: 'Bill uploaded', description: 'The admin team can review it now.', variant: 'success' })
        router.refresh()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Upload failed'
        toast({ title: 'Could not upload bill', description: message, variant: 'error' })
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:border-gray-300 hover:bg-gray-50">
            <UploadCloud className="h-4 w-4 text-gray-400" />
            Choose File
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(event) => setSelectedName(event.target.files?.[0]?.name || '')}
            />
          </label>
          <div className="min-w-0 text-sm text-gray-500">
            {selectedName || 'No file selected'}
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Upload
          </Button>
        </div>
      </div>
    </form>
  )
}
