'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Sent', value: 'sent' },
  { label: 'Overdue', value: 'overdue' },
  { label: 'Paid', value: 'paid' },
  { label: 'Draft', value: 'draft' },
]

export function InvoiceFilters({ currentFilter }: { currentFilter: string }) {
  return (
    <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit mb-4">
      {FILTERS.map(f => (
        <Link
          key={f.value}
          href={`/dashboard/invoices${f.value !== 'all' ? `?filter=${f.value}` : ''}`}
          className={cn(
            'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
            currentFilter === f.value
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          )}
        >
          {f.label}
        </Link>
      ))}
    </div>
  )
}
