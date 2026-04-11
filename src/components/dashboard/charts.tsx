'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format, parseISO, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp } from 'lucide-react'

interface Invoice {
  total_amount: number
  paid_amount: number | null
  paid_at: string | null
  issue_date: string
  status: string
}

interface DashboardChartsProps {
  invoices: Invoice[]
}

export function DashboardCharts({ invoices }: DashboardChartsProps) {
  // Build last 6 months data
  const months = Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(new Date(), 5 - i)
    const start = startOfMonth(date)
    const end = endOfMonth(date)
    const label = format(date, 'MMM')

    const invoiced = invoices
      .filter(inv => {
        const d = parseISO(inv.issue_date)
        return d >= start && d <= end
      })
      .reduce((sum, inv) => sum + inv.total_amount, 0)

    const collected = invoices
      .filter(inv => {
        if (!inv.paid_at) return false
        const d = parseISO(inv.paid_at)
        return d >= start && d <= end
      })
      .reduce((sum, inv) => sum + (inv.paid_amount || inv.total_amount), 0)

    return { month: label, invoiced, collected }
  })

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-xs">
        <p className="font-semibold text-gray-900 mb-2">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }} className="flex justify-between gap-4">
            <span>{p.name}</span>
            <span className="font-medium">{formatCurrency(p.value)}</span>
          </p>
        ))}
      </div>
    )
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-gray-400" />
          Collection Trend (6 months)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={months} barSize={20} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 12, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <Bar dataKey="invoiced" name="Invoiced" fill="#bfdbfe" radius={[4, 4, 0, 0]} />
            <Bar dataKey="collected" name="Collected" fill="#2563eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
