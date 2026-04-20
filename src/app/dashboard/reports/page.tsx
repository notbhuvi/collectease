import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate, getDaysOverdue } from '@/lib/utils'
import { ReportExportButtons } from '@/components/reports/report-export-buttons'
import { Clock } from 'lucide-react'

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
    supabase.from('payments')
      .select('*, invoice:invoices(invoice_number, client:clients(name))')
      .eq('business_id', business.id)
      .order('payment_date', { ascending: false }),
  ])

  const allInvoices = invoices || []

  // Remaining balance = total - already paid
  function remaining(inv: { total_amount: number; paid_amount?: number | null }) {
    return inv.total_amount - (inv.paid_amount || 0)
  }

  const today = new Date().toISOString().split('T')[0]

  // Treat as overdue if DB says so OR if due_date has already passed (cron may not have run yet)
  function isOverdue(inv: { status: string; due_date: string }) {
    return inv.status !== 'paid' && inv.status !== 'cancelled' &&
      (inv.status === 'overdue' || inv.due_date < today)
  }

  const totalInvoiced = allInvoices.reduce((s, i) => s + i.total_amount, 0)

  // Collected = sum of ALL payment records (captures every partial payment)
  const totalCollected = (payments || []).reduce((s, p) => s + Number(p.amount), 0)

  // Outstanding = sum of remaining balances (not full total_amount)
  const totalOutstanding = allInvoices
    .filter(i => i.status !== 'paid' && i.status !== 'cancelled')
    .reduce((s, i) => s + remaining(i), 0)

  // Overdue = remaining balance on invoices past due date
  const overdueAmount = allInvoices
    .filter(i => isOverdue(i))
    .reduce((s, i) => s + remaining(i), 0)

  // Collection efficiency categories
  const partialInvoices = allInvoices.filter(
    i => i.status !== 'paid' && i.status !== 'cancelled' && (i.paid_amount || 0) > 0
  )

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
              {
                label: 'Paid on time',
                count: allInvoices.filter(i => i.status === 'paid' && i.paid_at && new Date(i.paid_at) <= new Date(i.due_date)).length,
                color: 'bg-green-500',
              },
              {
                label: 'Paid late',
                count: allInvoices.filter(i => i.status === 'paid' && i.paid_at && new Date(i.paid_at) > new Date(i.due_date)).length,
                color: 'bg-blue-400',
              },
              {
                label: 'Partially paid',
                count: partialInvoices.length,
                color: 'bg-amber-400',
              },
              {
                label: 'Currently overdue',
                count: allInvoices.filter(i => isOverdue(i) && !(i.paid_amount > 0)).length,
                color: 'bg-red-500',
              },
              {
                label: 'Pending (sent)',
                count: allInvoices.filter(i => i.status === 'sent' && !(i.paid_amount > 0)).length,
                color: 'bg-gray-400',
              },
            ].map(item => {
              const pct = allInvoices.length > 0 ? (item.count / allInvoices.length) * 100 : 0
              return (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{item.label}</span>
                    <span className="font-medium text-gray-900">{item.count} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${item.color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* Partially paid invoices */}
      {partialInvoices.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Partially Paid Invoices
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">Invoice</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Client</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Total</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Received</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Remaining</th>
                    <th className="text-center text-xs font-medium text-gray-500 px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {partialInvoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 font-medium text-gray-900">{inv.invoice_number}</td>
                      <td className="px-4 py-3 text-gray-700">{inv.client?.name || '–'}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{formatCurrency(inv.total_amount)}</td>
                      <td className="px-4 py-3 text-right font-medium text-green-600">{formatCurrency(inv.paid_amount)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-amber-600">{formatCurrency(remaining(inv))}</td>
                      <td className="px-6 py-3 text-center">
                        <Badge variant="warning">partial</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overdue aging table — shows remaining balance */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Overdue Aging Report</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {allInvoices.filter(i => isOverdue(i)).length === 0 ? (
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
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Remaining</th>
                    <th className="text-center text-xs font-medium text-gray-500 px-6 py-3">Bucket</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {allInvoices
                    .filter(i => isOverdue(i))
                    .sort((a, b) => getDaysOverdue(b.due_date) - getDaysOverdue(a.due_date))
                    .map(inv => {
                      const days = getDaysOverdue(inv.due_date)
                      const bucket = days <= 30 ? '0–30d' : days <= 60 ? '30–60d' : days <= 90 ? '60–90d' : '90d+'
                      const bucketColor = days <= 30 ? 'warning' : 'destructive'
                      const bal = remaining(inv)
                      return (
                        <tr key={inv.id} className="hover:bg-gray-50">
                          <td className="px-6 py-3 font-medium text-gray-900">
                            {inv.invoice_number}
                            {(inv.paid_amount || 0) > 0 && (
                              <span className="ml-2 text-xs text-amber-600 font-normal">partial</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-700">{inv.client?.name || '–'}</td>
                          <td className="px-4 py-3 text-gray-500">{formatDate(inv.due_date)}</td>
                          <td className="px-4 py-3 text-center font-semibold text-red-600">{days}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">
                            {formatCurrency(bal)}
                            {(inv.paid_amount || 0) > 0 && (
                              <p className="text-xs text-gray-400 font-normal">{formatCurrency(inv.paid_amount)} paid</p>
                            )}
                          </td>
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
