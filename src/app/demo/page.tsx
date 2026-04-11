import { PageHeader } from '@/components/layout/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate, getDaysOverdue } from '@/lib/utils'
import { IndianRupee, AlertTriangle, TrendingUp, Users, Clock } from 'lucide-react'
import Link from 'next/link'
import { DashboardCharts } from '@/components/dashboard/charts'
import { demoInvoices, demoClients, demoPayments, demoBusiness } from '@/lib/demo-data'

export default function DemoDashboard() {
  const unpaid = demoInvoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled')
  const overdue = demoInvoices.filter(i => i.status === 'overdue')
  const paid = demoInvoices.filter(i => i.status === 'paid')

  const totalReceivables = unpaid.reduce((s, i) => s + i.total_amount, 0)
  const overdueAmount = overdue.reduce((s, i) => s + i.total_amount, 0)
  const paidThisMonth = paid.reduce((s, i) => s + (i.paid_amount || i.total_amount), 0)

  const aging = { b0: 0, b30: 0, b60: 0, b90: 0 }
  overdue.forEach(inv => {
    const d = getDaysOverdue(inv.due_date)
    if (d <= 30) aging.b0 += inv.total_amount
    else if (d <= 60) aging.b30 += inv.total_amount
    else if (d <= 90) aging.b60 += inv.total_amount
    else aging.b90 += inv.total_amount
  })

  const recentOverdue = [...overdue].sort((a, b) => getDaysOverdue(b.due_date) - getDaysOverdue(a.due_date))

  return (
    <div>
      <PageHeader title="Good afternoon, TechSoft Solutions" description="Here's your receivables overview" />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Receivables" value={formatCurrency(totalReceivables)} subtitle={`${unpaid.length} unpaid invoices`} icon={<IndianRupee className="h-5 w-5" />} valueClassName="text-blue-700" />
        <StatCard title="Overdue Amount" value={formatCurrency(overdueAmount)} subtitle={`${overdue.length} overdue invoices`} icon={<AlertTriangle className="h-5 w-5" />} valueClassName="text-red-600" />
        <StatCard title="Collected This Month" value={formatCurrency(paidThisMonth)} subtitle={`${paid.length} invoices paid`} icon={<TrendingUp className="h-5 w-5" />} valueClassName="text-green-700" />
        <StatCard title="Total Clients" value={demoClients.length} subtitle={`${demoInvoices.length} total invoices`} icon={<Users className="h-5 w-5" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" /> Aging Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: '0–30 days', amount: aging.b0, color: 'bg-yellow-400' },
              { label: '30–60 days', amount: aging.b30, color: 'bg-orange-400' },
              { label: '60–90 days', amount: aging.b60, color: 'bg-red-400' },
              { label: '90+ days', amount: aging.b90, color: 'bg-red-700' },
            ].map(b => {
              const pct = overdueAmount > 0 ? (b.amount / overdueAmount) * 100 : 0
              return (
                <div key={b.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{b.label}</span>
                    <span className="font-medium">{formatCurrency(b.amount)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${b.color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <DashboardCharts invoices={demoInvoices as any} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" /> Overdue Invoices
            </CardTitle>
            <Link href="/demo/invoices" className="text-sm text-blue-600 hover:text-blue-700">View all</Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-gray-100">
            {recentOverdue.map(inv => (
              <div key={inv.id} className="flex items-center justify-between py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{inv.client?.name}</p>
                  <p className="text-xs text-gray-500">{inv.invoice_number} · Due {formatDate(inv.due_date)}</p>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <span className="text-sm font-semibold text-red-600">{formatCurrency(inv.total_amount)}</span>
                  <Badge variant="destructive">{getDaysOverdue(inv.due_date)}d overdue</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent Payments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-gray-100">
            {demoPayments.map(p => (
              <div key={p.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{p.invoice?.client?.name}</p>
                  <p className="text-xs text-gray-500">{p.invoice?.invoice_number} · {formatDate(p.payment_date)}</p>
                </div>
                <span className="text-sm font-semibold text-green-600">{formatCurrency(p.amount)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
