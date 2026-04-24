import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, differenceInDays, parseISO, isValid } from 'date-fns'
import { RiskLabel, InvoiceStatus } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  const safeAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(safeAmount)
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? parseISO(date) : date
  if (!isValid(d)) return '—'
  return format(d, 'dd MMM yyyy')
}

export function formatDateShort(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? parseISO(date) : date
  if (!isValid(d)) return '—'
  return format(d, 'dd/MM/yyyy')
}

export function getDaysOverdue(dueDate: string | null | undefined): number {
  if (!dueDate) return 0
  const today = new Date()
  const due = parseISO(dueDate)
  if (!isValid(due)) return 0
  const days = differenceInDays(today, due)
  return days > 0 ? days : 0
}

export function getAgingBucket(daysOverdue: number): string {
  if (daysOverdue <= 0) return 'current'
  if (daysOverdue <= 30) return '0-30'
  if (daysOverdue <= 60) return '30-60'
  if (daysOverdue <= 90) return '60-90'
  return '90+'
}

export function computeRiskLabel(avgDelayDays: number, delayedPct: number): RiskLabel {
  if (avgDelayDays <= 7 && delayedPct <= 20) return 'good'
  if (avgDelayDays <= 30 && delayedPct <= 50) return 'moderate'
  return 'risky'
}

export function getStatusColor(status: InvoiceStatus): string {
  const map: Record<InvoiceStatus, string> = {
    draft: 'bg-gray-100 text-gray-700',
    sent: 'bg-blue-100 text-blue-700',
    paid: 'bg-green-100 text-green-700',
    overdue: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-500',
  }
  return map[status]
}

export function getRiskColor(risk: RiskLabel): string {
  const map: Record<RiskLabel, string> = {
    good: 'bg-green-100 text-green-700',
    moderate: 'bg-yellow-100 text-yellow-700',
    risky: 'bg-red-100 text-red-700',
  }
  return map[risk]
}

export function generateInvoiceNumber(prefix = 'INV'): string {
  const year = new Date().getFullYear()
  const random = Math.floor(Math.random() * 9000) + 1000
  return `${prefix}-${year}-${random}`
}

export function truncate(str: string, length: number): string {
  return str.length > length ? str.slice(0, length) + '...' : str
}
