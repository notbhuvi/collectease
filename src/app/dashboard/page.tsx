import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate, getDaysOverdue } from '@/lib/utils'
import {
  IndianRupee, FileText, Users, AlertTriangle,
  TrendingUp, Clock
} from 'lucide-react'
import Link from 'next/link'
import { DashboardCharts } from '@/components/dashboard/charts'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('user_id', user.id)
    .single()

  // No business yet — show empty dashboard (don't redirect, prevents loops for admin/accounts)
  if (!business) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <FileText className="h-14 w-14 text-gray-200 mb-4" />
        <h2 className="text-lg font-semibold text-gray-700 mb-2">No Business Profile Set Up</h2>
        <p className="text-sm text-gray-400 max-w-sm">
          Your account doesn&apos;t have a business profile linked yet. Please contact your administrator to set up invoicing.
        </p>
      </div>
    )
  }

  const bid = business.id

  // First of current month for "this month" filter
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

  const [
    { data: invoices },
    { data: clients },
    { data: recentPayments },
    { data: paymentsThisMonth },
  ] = await Promise.all([
    supabase.from('invoices').select('*, client:clients(name)').eq('business_id', bid),
    supabase.from('clients').select('id').eq('business_id', bid),
    supabase.from('payments')
      .select('*, invoice:invoices(invoice_number, client:clients(name))')
      .eq('business_id', bid)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('payments')
      .select('amount')
      .eq('business_id', bid)
      .gte('payment_date', monthStart),
  ])

  const allInvoices = invoices || []

  // Remaining balance per invoice = total_amount - (paid_amount || 0)
  function remaining(inv: { total_amount: number; paid_amount?: number | null }) {
    return inv.total_amount - (inv.paid_amount || 0)
  }

  // Partial = has some money but not fully paid
  function isPartial(inv: { status: string; paid_amount?: number | null }) {
    return inv.status !== 'paid' && (inv.paid_amount || 0) > 0
  }

  const today = new Date().toISOString().split('T')[0]

  const unpaid = allInvoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled')
  // Treat as overdue if DB says so OR if due_date has already passed (cron may not have run yet)
  const overdue = allInvoices.filter(i =>
    i.status !== 'paid' && i.status !== 'cancelled' &&
    (i.status === 'overdue' || i.due_date < today)
  )

  // Receivables = sum of remaining balances (not full total_amount)
  const totalReceivables = unpaid.reduce((sum, i) => sum + remaining(i), 0)

  // Overdue = sum of remaining balances on overdue invoices
  const overdueAmount = overdue.reduce((sum, i) => sum + remaining(i), 0)

  // Collected this month = sum from payments table (captures partial payments too)
  const collectedThisMonth = (paymentsThisMonth || []).reduce((sum, p) => sum + Number(p.amount), 0)
  const paymentsThisMonthCount = (paymentsThisMonth || []).length

  // Aging buckets — use remaining balance
  const aging = { b0: 0, b30: 0, b60: 0, b90: 0 }
  overdue.forEach(inv => {
    const days = getDaysOverdue(inv.due_date)
    const bal = remaining(inv)
    if (days <= 30) aging.b0 += bal
    else if (days <= 60) aging.b30 += bal
    else if (days <= 90) aging.b60 += bal
    else aging.b90 += bal
  })

  // Recent overdue — sorted by most overdue
  const recentOverdue = overdue
    .sort((a, b) => getDaysOverdue(b.due_date) - getDaysOverdue(a.due_date))
    .slice(0, 5)

  return (
    <div>
      <PageHeader
        title={`Good ${getGreeting()}, ${business.name}`}
        description="Here's your receivables overview"
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Receivables"
          value={formatCurrency(totalReceivables)}
          subtitle={`${unpaid.length} unpaid invoices`}
          icon={<IndianRupee className="h-5 w-5" />}
          valueClassName="text-blue-700"
        />
        <StatCard
          title="Overdue Amount"
          value={formatCurrency(overdueAmount)}
          subtitle={`${overdue.length} overdue invoices`}
          icon={<AlertTriangle className="h-5 w-5" />}
          valueClassName={overdueAmount > 0 ? 'text-red-600' : 'text-gray-900'}
        />
        <StatCard
          title="Collected This Month"
          value={formatCurrency(collectedThisMonth)}
          subtitle={`${paymentsThisMonthCount} payment${paymentsThisMonthCount !== 1 ? 's' : ''} received`}
          icon={<TrendingUp className="h-5 w-5" />}
          valueClassName="text-green-700"
        />
        <StatCard
          title="Total Clients"
          value={clients?.length || 0}
          subtitle={`${allInvoices.length} total invoices`}
          icon={<Users className="h-5 w-5" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Aging buckets */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              Aging Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: '0–30 days', amount: aging.b0, color: 'bg-yellow-400' },
              { label: '30–60 days', amount: aging.b30, color: 'bg-orange-400' },
              { label: '60–90 days', amount: aging.b60, color: 'bg-red-400' },
              { label: '90+ days', amount: aging.b90, color: 'bg-red-700' },
            ].map(bucket => {
              const pct = overdueAmount > 0 ? (bucket.amount / overdueAmount) * 100 : 0
              return (
                <div key={bucket.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{bucket.label}</span>
                    <span className="font-medium">{formatCurrency(bucket.amount)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${bucket.color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
            {overdueAmount === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No overdue invoices</p>
            )}
          </CardContent>
        </Card>

        {/* Charts */}
        <div className="lg:col-span-2">
          <DashboardCharts invoices={allInvoices} />
        </div>
      </div>

      {/* Recent overdue */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Overdue Invoices
            </CardTitle>
            <Link href="/dashboard/invoices?filter=overdue" className="text-sm text-blue-600 hover:text-blue-700">
              View all
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentOverdue.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">🎉</div>
              <p className="text-sm font-medium text-gray-900">No overdue invoices!</p>
              <p className="text-xs text-gray-500 mt-1">All caught up</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentOverdue.map(inv => {
                const bal = remaining(inv)
                const partial = isPartial(inv)
                return (
                  <div key={inv.id} className="flex items-center justify-between py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{inv.client?.name || 'Unknown Client'}</p>
                      <p className="text-xs text-gray-500">{inv.invoice_number} · Due {formatDate(inv.due_date)}</p>
                      {partial && (
                        <p className="text-xs text-amber-600">
                          {formatCurrency(inv.paid_amount)} paid · {formatCurrency(bal)} remaining
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-red-600">{formatCurrency(bal)}</p>
                        {partial && <p className="text-xs text-gray-400">of {formatCurrency(inv.total_amount)}</p>}
                      </div>
                      <Badge variant="destructive">{getDaysOverdue(inv.due_date)}d overdue</Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent payments */}
      {recentPayments && recentPayments.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-400" />
              Recent Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-gray-100">
              {recentPayments.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.invoice?.client?.name || 'Unknown'}</p>
                    <p className="text-xs text-gray-500">{p.invoice?.invoice_number} · {formatDate(p.payment_date)}</p>
                  </div>
                  <span className="text-sm font-semibold text-green-600">{formatCurrency(p.amount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
