'use client'

import { FileText, Expand } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface PdfViewerProps {
  url: string | null
  fileType: string | null
  title?: string
  className?: string
}

export function PdfViewer({ url, fileType, title, className }: PdfViewerProps) {
  if (!url) {
    return (
      <div className={`flex h-64 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500 ${className || ''}`}>
        Preview unavailable
      </div>
    )
  }

  if (fileType?.startsWith('image/')) {
    return (
      <ViewerDialog
        title={title || 'Bill preview'}
        trigger={
          <button
            type="button"
            className={`group relative block w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50 text-left ${className || ''}`}
          >
            <img src={url} alt={title || 'Bill preview'} className="h-64 w-full object-contain bg-white" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/60 to-transparent px-3 py-3 text-white">
              <span className="text-sm font-medium">Click to expand</span>
              <Expand className="h-4 w-4 transition-transform group-hover:scale-110" />
            </div>
          </button>
        }
      >
        <div className="rounded-xl bg-gray-950 p-3">
          <img src={url} alt={title || 'Bill preview'} className="max-h-[78vh] w-full object-contain" />
        </div>
      </ViewerDialog>
    )
  }

  return (
    <ViewerDialog
      title={title || 'Bill preview'}
      trigger={
        <button
          type="button"
          className={`group block w-full overflow-hidden rounded-xl border border-gray-200 bg-white text-left ${className || ''}`}
        >
          <iframe
            src={url}
            title={title || 'Bill preview'}
            className="h-64 w-full pointer-events-none"
          />
          <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" />
              Private preview
            </div>
            <div className="flex items-center gap-1 text-sm font-medium text-gray-700">
              <span>Click to expand</span>
              <Expand className="h-4 w-4 transition-transform group-hover:scale-110" />
            </div>
          </div>
        </button>
      }
    >
      <iframe
        src={url}
        title={title || 'Bill preview'}
        className="h-[78vh] w-full rounded-xl border border-gray-200 bg-white"
      />
    </ViewerDialog>
  )
}

function ViewerDialog({ trigger, title, children }: {
  trigger: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-6xl p-4">
        <DialogHeader className="px-2 pt-2">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Review the uploaded bill at full size before approving or declining it.
          </DialogDescription>
        </DialogHeader>
        <div className="px-2 pb-2">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  )
}
