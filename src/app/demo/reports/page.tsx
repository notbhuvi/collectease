import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate, getDaysOverdue } from '@/lib/utils'
import { Download, FileText } from 'lucide-react'
import { demoInvoices, demoClients, demoPayments } from '@/lib/demo-data'

const riskVariant: Record<string, 'success' | 'warning' | 'destructive'> = {
  good: 'success', moderate: 'warning', risky: 'destructive',
}

export default function DemoReportsPage() {
  const totalInvoiced = demoInvoices.reduce((s, i) => s + i.total_amount, 0)
  const totalCollected = demoInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.paid_amount || i.total_amount), 0)
  const totalOutstanding = demoInvoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled').reduce((s, i) => s + i.total_amount, 0)
  const overdueAmount = demoInvoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.total_amount, 0)

  const overdue = demoInvoices.filter(i => i.status === 'overdue')

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Financial summaries and collection analytics"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><Download className="h-4 w-4" />Export CSV</Button>
            <Button variant="outline" size="sm"><FileText className="h-4 w-4" />Export PDF</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Invoiced', value: formatCurrency(totalInvoiced), color: 'text-gray-900' },
          { label: 'Collected', value: formatCurrency(totalCollected), color: 'text-green-600' },
          { label: 'Outstanding', value: formatCurrency(totalOutstanding), color: 'text-blue-600' },
          { label: 'Overdue', value: formatCurrency(overdueAmount), color: 'text-red-600' },
        ].map(s => (
          <Card key={s.label} className="p-4">
            <p className="text-xs font-medium text-gray-500 mb-1">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader><CardTitle>Client Risk Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y divide-gray-100">
              {[...demoClients].sort((a, b) => {
                const o = { risky: 0, moderate: 1, good: 2 }
                return (o[a.risk_label as keyof typeof o] ?? 2) - (o[b.risk_label as keyof typeof o] ?? 2)
              }).map(client => (
                <div key={client.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{client.name}</p>
                    <p className="text-xs text-gray-400">{client.total_invoices} invoices · {client.avg_delay_days > 0 ? `${client.avg_delay_days}d avg delay` : 'No delays'}</p>
                  </div>
                  <Badge variant={riskVariant[client.risk_label] || 'secondary'}>{client.risk_label}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Collection Efficiency</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: 'Paid on time', count: demoInvoices.filter(i => i.status === 'paid' && i.paid_at && new Date(i.paid_at) <= new Date(i.due_date)).length },
              { label: 'Paid late', count: demoInvoices.filter(i => i.status === 'paid' && i.paid_at && new Date(i.paid_at) > new Date(i.due_date)).length },
              { label: 'Currently overdue', count: demoInvoices.filter(i => i.status === 'overdue').length },
              { label: 'Pending (sent)', count: demoInvoices.filter(i => i.status === 'sent').length },
            ].map(item => {
              const pct = demoInvoices.length > 0 ? (item.count / demoInvoices.length) * 100 : 0
              return (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{item.label}</span>
                    <span className="font-medium text-gray-900">{item.count} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle>Overdue Aging Report</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">Invoice</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Client</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Due Date</th>
                  <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Days Overdue</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Amount</th>
                  <th className="text-center text-xs font-medium text-gray-500 px-6 py-3">Bucket</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[...overdue].sort((a, b) => getDaysOverdue(b.due_date) - getDaysOverdue(a.due_date)).map(inv => {
                  const days = getDaysOverdue(inv.due_date)
                  const bucket = days <= 30 ? '0–30d' : days <= 60 ? '30–60d' : days <= 90 ? '60–90d' : '90d+'
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 font-medium text-gray-900">{inv.invoice_number}</td>
                      <td className="px-4 py-3 text-gray-700">{inv.client?.name}</td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(inv.due_date)}</td>
                      <td className="px-4 py-3 text-center font-semibold text-red-600">{days}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(inv.total_amount)}</td>
                      <td className="px-6 py-3 text-center">
                        <Badge variant={days > 30 ? 'destructive' : 'warning'}>{bucket}</Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Payment History</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">Invoice</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Client</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Date</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Method</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-6 py-3">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {demoPayments.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">{p.invoice?.invoice_number}</td>
                    <td className="px-4 py-3 text-gray-700">{p.invoice?.client?.name}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(p.payment_date)}</td>
                    <td className="px-4 py-3"><Badge variant="secondary">{p.payment_method}</Badge></td>
                    <td className="px-6 py-3 text-right font-semibold text-green-600">{formatCurrency(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
