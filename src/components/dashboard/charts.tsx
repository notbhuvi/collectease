'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format, parseISO, subMonths, startOfMonth, endOfMonth, isValid } from 'date-fns'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp } from 'lucide-react'

interface Invoice {
  total_amount: number | string | null
  paid_amount: number | string | null
  paid_at: string | null
  issue_date: string | null
  status: string
}

interface DashboardChartsProps {
  invoices: Invoice[]
}

function toAmount(value: number | string | null | undefined) {
  const num = Number(value || 0)
  return Number.isFinite(num) ? num : 0
}

function safeParse(date: string | null | undefined) {
  if (!date) return null
  const parsed = parseISO(date)
  return isValid(parsed) ? parsed : null
}

export function DashboardCharts({ invoices }: DashboardChartsProps) {
  const months = Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(new Date(), 5 - i)
    const start = startOfMonth(date)
    const end = endOfMonth(date)
    const label = format(date, 'MMM')

    const invoiced = invoices
      .filter(inv => {
        const issueDate = safeParse(inv.issue_date)
        return issueDate ? issueDate >= start && issueDate <= end : false
      })
      .reduce((sum, inv) => sum + toAmount(inv.total_amount), 0)

    const collected = invoices
      .filter(inv => {
        const paidAt = safeParse(inv.paid_at)
        return paidAt ? paidAt >= start && paidAt <= end : false
      })
      .reduce((sum, inv) => {
        const paidAmount = toAmount(inv.paid_amount)
        const totalAmount = toAmount(inv.total_amount)
        return sum + (paidAmount > 0 ? paidAmount : totalAmount)
      }, 0)

    return { month: label, invoiced, collected }
  })

  const maxValue = Math.max(...months.flatMap(month => [month.invoiced, month.collected]), 1)

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-gray-400" />
          Collection Trend (6 months)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {months.map(month => {
          const invoicedPct = (month.invoiced / maxValue) * 100
          const collectedPct = (month.collected / maxValue) * 100

          return (
            <div key={month.month} className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">{month.month}</p>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Invoiced {formatCurrency(month.invoiced)}</p>
                  <p className="text-xs text-blue-600">Collected {formatCurrency(month.collected)}</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <div>
                  <div className="mb-1 flex items-center justify-between text-[11px] text-gray-500">
                    <span>Invoiced</span>
                    <span>{formatCurrency(month.invoiced)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-blue-100 overflow-hidden">
                    <div className="h-full rounded-full bg-blue-300" style={{ width: `${invoicedPct}%` }} />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-[11px] text-gray-500">
                    <span>Collected</span>
                    <span>{formatCurrency(month.collected)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-blue-600" style={{ width: `${collectedPct}%` }} />
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

