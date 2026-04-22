import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Truck, FileText, IndianRupee, Package, Trophy, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import Link from 'next/link'

function StatCard({ label, value, sub, icon: Icon, color, href }: {
  label: string; value: string | number; sub?: string; icon: any; color: string; href?: string
}) {
  const inner = (
    <Card className={`p-4 hover:shadow-md transition-shadow ${href ? 'cursor-pointer' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </Card>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const serviceClient = await createServiceClient()
  const today = new Date().toISOString().split('T')[0]

  const [
    { data: profiles },
    { data: loads },
    { data: bids },
    { data: awards },
    { data: invoices },
  ] = await Promise.all([
    serviceClient.from('profiles').select('role'),
    serviceClient.from('transport_loads').select('status'),
    serviceClient.from('transport_bids').select('id, bid_amount'),
    serviceClient.from('awarded_loads').select('final_amount'),
    serviceClient.from('invoices').select('status, total_amount, due_date, paid_amount'),
  ])

  const allProfiles = profiles || []
  const allLoads = loads || []
  const allBids = bids || []
  const allAwards = awards || []
  const allInvoices = invoices || []

  // User stats
  const roleCounts = allProfiles.reduce((acc: Record<string, number>, p) => {
    acc[p.role] = (acc[p.role] || 0) + 1
    return acc
  }, {})

  // Invoice stats
  const paidInvoices = allInvoices.filter(i => i.status === 'paid')
  const overdueInvoices = allInvoices.filter(i =>
    i.status !== 'paid' && i.status !== 'cancelled' &&
    (i.status === 'overdue' || (i.due_date && i.due_date < today))
  )
  const pendingInvoices = allInvoices.filter(i =>
    i.status !== 'paid' && i.status !== 'cancelled' &&
    !(i.status === 'overdue' || (i.due_date && i.due_date < today))
  )
  const outstandingAmount = allInvoices
    .filter(i => i.status !== 'paid' && i.status !== 'cancelled')
    .reduce((sum, i) => sum + ((i.total_amount || 0) - (i.paid_amount || 0)), 0)

  // Transport stats
  const openLoads = allLoads.filter(l => l.status === 'open').length
  const awardedLoads = allLoads.filter(l => l.status === 'awarded').length
  const completedLoads = allLoads.filter(l => l.status === 'completed').length
  const lowestBid = allBids.length > 0
    ? Math.min(...allBids.map(b => b.bid_amount || 0))
    : 0
  const avgAward = allAwards.length > 0
    ? allAwards.reduce((s, a) => s + (a.final_amount || 0), 0) / allAwards.length
    : 0

  function fmtAmount(val: number) {
    if (val >= 1_00_00_000) return `₹${(val / 1_00_00_000).toFixed(2)} Cr`
    if (val >= 1_00_000) return `₹${(val / 1_00_000).toFixed(2)} L`
    return `₹${val.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
  }

  const roleColors: Record<string, string> = {
    admin: 'bg-violet-100 text-violet-700',
    accounts: 'bg-blue-100 text-blue-700',
    transport_team: 'bg-orange-100 text-orange-700',
    transporter: 'bg-emerald-100 text-emerald-700',
  }
  const roleLabels: Record<string, string> = {
    admin: 'Admin', accounts: 'Accounts',
    transport_team: 'Transport Team', transporter: 'Transporter',
  }

  return (
    <div>
      <PageHeader
        title="Admin Overview"
        description="System-wide analytics across all business modules"
      />

      {/* Accounts & Invoices */}
      <div className="mb-6">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <FileText className="h-3.5 w-3.5" /> Accounts &amp; Invoices
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard label="Total Invoices" value={allInvoices.length} icon={FileText} color="text-gray-700" href="/dashboard/invoices" />
          <StatCard label="Paid" value={paidInvoices.length} icon={CheckCircle} color="text-green-600" href="/dashboard/invoices" />
          <StatCard label="Pending" value={pendingInvoices.length} icon={Clock} color="text-blue-600" href="/dashboard/invoices" />
          <StatCard label="Overdue" value={overdueInvoices.length} icon={AlertCircle} color="text-red-600" href="/dashboard/invoices" />
          <StatCard
            label="Outstanding"
            value={fmtAmount(outstandingAmount)}
            sub="unpaid total"
            icon={IndianRupee}
            color="text-amber-600"
            href="/dashboard"
          />
        </div>
      </div>

      {/* Transport & Logistics */}
      <div className="mb-6">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Truck className="h-3.5 w-3.5" /> Transport &amp; Logistics
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
          <StatCard label="Total Loads" value={allLoads.length} icon={Package} color="text-gray-700" href="/transport" />
          <StatCard label="Open for Bids" value={openLoads} icon={Clock} color="text-orange-600" href="/transport" />
          <StatCard label="Total Bids" value={allBids.length} icon={FileText} color="text-blue-600" href="/transport" />
          <StatCard label="Awarded" value={awardedLoads} icon={Trophy} color="text-amber-600" href="/transport" />
          <StatCard label="Completed" value={completedLoads} icon={CheckCircle} color="text-green-600" href="/transport" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Card className="p-4">
            <p className="text-xs font-medium text-gray-500 mb-1">Lowest Bid</p>
            <p className="text-xl font-bold text-blue-700">{lowestBid > 0 ? fmtAmount(lowestBid) : '—'}</p>
            <p className="text-xs text-gray-400 mt-0.5">across {allBids.length} bids</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium text-gray-500 mb-1">Avg Awarded Amount</p>
            <p className="text-xl font-bold text-green-700">{avgAward > 0 ? fmtAmount(avgAward) : '—'}</p>
            <p className="text-xs text-gray-400 mt-0.5">across {allAwards.length} awards</p>
          </Card>
        </div>
      </div>

      {/* Users */}
      <div className="mb-6">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Users className="h-3.5 w-3.5" /> Users &amp; Roles
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-4">
            <p className="text-xs font-medium text-gray-500 mb-1">Total Users</p>
            <p className="text-2xl font-bold text-violet-700">{allProfiles.length}</p>
            <div className="flex gap-2 mt-3">
              <Link href="/admin/users"
                className="text-xs font-medium text-violet-600 hover:text-violet-700 hover:underline">
                Manage Users →
              </Link>
              <span className="text-gray-300">·</span>
              <Link href="/admin/create-user"
                className="text-xs font-medium text-violet-600 hover:text-violet-700 hover:underline">
                Create User →
              </Link>
            </div>
          </Card>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Users by Role</CardTitle></CardHeader>
            <CardContent className="pt-0 space-y-2">
              {['admin', 'accounts', 'transport_team', 'transporter'].map(role => {
                const count = roleCounts[role] || 0
                return (
                  <div key={role} className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[role]}`}>
                      {roleLabels[role]}
                    </span>
                    <span className="text-sm font-semibold text-gray-700">{count}</span>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
