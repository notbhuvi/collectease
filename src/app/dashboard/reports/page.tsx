import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate, getDaysOverdue } from '@/lib/utils'
import { BarChart3, Download } from 'lucide-react'
import { ReportExportButtons } from '@/components/reports/report-export-buttons'

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('user_id', user.id)
    .single()

  if (!business) redirect('/auth/register')

  const [{ data: invoices }, { data: clients }, { data: payments }] = await Promise.all([
    supabase.from('invoices').select('*, client:clients(name)').eq('business_id', business.id),
    supabase.from('clients').select('*').eq('business_id', business.id),
    supabase.from('payments').select('*, invoice:invoices(invoice_number, client:clients(name))').eq('business_id', business.id).order('payment_date', { ascending: false }),
  ])

  const allInvoices = invoices || []
  const totalInvoiced = allInvoices.reduce((s, i) => s + i.total_amount, 0)
  const totalCollected = allInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.paid_amount || i.total_amount), 0)
  const totalOutstanding = allInvoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled').reduce((s, i) => s + i.total_amount, 0)
  const overdueAmount = allInvoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.total_amount, 0)

  const riskVariant: Record<string, 'success' | 'warning' | 'destructive'> = {
    good: 'success', moderate: 'warning', risky: 'destructive',
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Financial summaries and collection analytics"
        actions={<ReportExportButtons businessId={business.id} />}
      />

      {/* Summary stats */}
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
        {/* Client risk summary */}
        <Card>
          <CardHeader>
            <CardTitle>Client Risk Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {!clients || clients.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No clients yet</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {clients
                  .sort((a, b) => {
                    const order = { risky: 0, moderate: 1, good: 2 }
                    return (order[a.risk_label as keyof typeof order] || 2) - (order[b.risk_label as keyof typeof order] || 2)
                  })
                  .map(client => (
                    <div key={client.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{client.name}</p>
                        <p className="text-xs text-gray-400">
                          {client.total_invoices} invoices · {client.avg_delay_days > 0 ? `${client.avg_delay_days}d avg delay` : 'No delays'}
                        </p>
                      </div>
                      <Badge variant={riskVariant[client.risk_label] || 'secondary'}>
                        {client.risk_label}
                      </Badge>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Collection efficiency */}
        <Card>
          <CardHeader>
            <CardTitle>Collection Efficiency</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: 'Paid on time', count: allInvoices.filter(i => i.status === 'paid' && i.paid_at && new Date(i.paid_at) <= new Date(i.due_date)).length },
              { label: 'Paid late', count: allInvoices.filter(i => i.status === 'paid' && i.paid_at && new Date(i.paid_at) > new Date(i.due_date)).length },
              { label: 'Currently overdue', count: allInvoices.filter(i => i.status === 'overdue').length },
              { label: 'Pending (sent)', count: allInvoices.filter(i => i.status === 'sent').length },
            ].map(item => {
              const pct = allInvoices.length > 0 ? (item.count / allInvoices.length) * 100 : 0
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

      {/* Overdue aging table */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Overdue Aging Report</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {allInvoices.filter(i => i.status === 'overdue').length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No overdue invoices</p>
          ) : (
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
                  {allInvoices
                    .filter(i => i.status === 'overdue')
                    .sort((a, b) => getDaysOverdue(b.due_date) - getDaysOverdue(a.due_date))
                    .map(inv => {
                      const days = getDaysOverdue(inv.due_date)
                      const bucket = days <= 30 ? '0–30d' : days <= 60 ? '30–60d' : days <= 90 ? '60–90d' : '90d+'
                      const bucketColor = days <= 30 ? 'warning' : 'destructive'
                      return (
                        <tr key={inv.id} className="hover:bg-gray-50">
                          <td className="px-6 py-3 font-medium text-gray-900">{inv.invoice_number}</td>
                          <td className="px-4 py-3 text-gray-700">{inv.client?.name || '–'}</td>
                          <td className="px-4 py-3 text-gray-500">{formatDate(inv.due_date)}</td>
                          <td className="px-4 py-3 text-center font-semibold text-red-600">{days}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(inv.total_amount)}</td>
                          <td className="px-6 py-3 text-center">
                            <Badge variant={bucketColor as any}>{bucket}</Badge>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment history */}
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!payments || payments.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No payments recorded yet</p>
          ) : (
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
                  {payments.map((p: any) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 font-medium text-gray-900">{p.invoice?.invoice_number || '–'}</td>
                      <td className="px-4 py-3 text-gray-700">{p.invoice?.client?.name || '–'}</td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(p.payment_date)}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">{p.payment_method || 'other'}</Badge>
                      </td>
                      <td className="px-6 py-3 text-right font-semibold text-green-600">{formatCurrency(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
