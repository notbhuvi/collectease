/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Truck, FileText, IndianRupee, Package, Trophy, CheckCircle, Clock, AlertCircle, FileCheck2, Briefcase, CalendarCheck2 } from 'lucide-react'
import Link from 'next/link'
import { getAdminUserDirectory } from '@/lib/admin-users'
import { buildPlantDashboardData, formatCurrency, formatNumber } from '@/lib/plant'
import { getPendingBillApprovalCountSafe } from '@/lib/bills'
import { buildHrDashboardData } from '@/lib/hr'
import { EnsureHrUserButton } from '@/components/hr/ensure-hr-user-button'

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

  const pendingBillsStatePromise = getPendingBillApprovalCountSafe(serviceClient)

  const [
    users,
    { data: loads },
    { data: bids },
    { data: invoices },
    { data: productionLogs },
    { data: rawMaterials },
    { data: rawTxns },
    { data: dispatches },
    { data: warehouseItems },
    { data: warehouseMovements },
    { data: employees },
    { data: attendance },
    { data: leaves },
    { data: hrDocuments },
  ] = await Promise.all([
    getAdminUserDirectory(serviceClient),
    serviceClient.from('transport_loads').select('status'),
    serviceClient.from('transport_bids').select('id, bid_amount'),
    serviceClient.from('invoices').select('status, total_amount, due_date, paid_amount'),
    serviceClient.from('plant_production_logs').select('*').order('date', { ascending: false }),
    serviceClient.from('raw_materials').select('id, material_name, unit, min_level, created_at'),
    serviceClient.from('raw_material_transactions').select('material_id, date, type, qty, rate, remarks, created_at'),
    serviceClient.from('fg_dispatches').select('*').order('date', { ascending: false }),
    serviceClient.from('warehouse_items').select('*').order('updated_at', { ascending: false }),
    serviceClient.from('warehouse_movements').select('*').order('date', { ascending: false }),
    serviceClient.from('employees').select('*').order('created_at', { ascending: false }),
    serviceClient.from('attendance').select('id, employee_id, date, check_in, check_out, status, biometric_ref, created_at, employee:employees(id, name, department, designation)').order('date', { ascending: false }),
    serviceClient.from('leaves').select('id, employee_id, type, from_date, to_date, status, approved_by, reason, created_at, employee:employees(id, name, department, designation)').order('created_at', { ascending: false }),
    serviceClient.from('employee_documents').select('id, employee_id, doc_type, file_url, expires_on, created_at, employee:employees(id, name, department)').order('created_at', { ascending: false }),
  ])

  const pendingBillsState = await pendingBillsStatePromise

  const allProfiles = users || []
  const allLoads = loads || []
  const allBids = bids || []
  const allInvoices = invoices || []
  const plantTodayProduction = (productionLogs || [])
    .filter((row: any) => row.date === today)
    .reduce((sum: number, row: any) => sum + Number(row.qty || 0), 0)
  const rmAlerts = (rawMaterials || []).filter((material: any) => {
    const balance = (rawTxns || [])
      .filter((txn: any) => txn.material_id === material.id)
      .reduce((sum: number, txn: any) => {
        if (txn.type === 'opening' || txn.type === 'inward') return sum + Number(txn.qty || 0)
        if (txn.type === 'consumed') return sum - Number(txn.qty || 0)
        return sum + Number(txn.qty || 0)
      }, 0)
    return balance <= Number(material.min_level || 0)
  }).length
  const dispatchTodayQty = (dispatches || [])
    .filter((row: any) => row.date === today && row.status !== 'cancelled')
    .reduce((sum: number, row: any) => sum + Number(row.qty || 0), 0)
  const warehouseValue = (warehouseItems || [])
    .reduce((sum: number, row: any) => sum + Number(row.current_stock || 0) * Number(row.unit_rate || 0), 0)
  const plantDashboard = buildPlantDashboardData({
    productionLogs: (productionLogs || []) as any,
    rawMaterials: (rawMaterials || []) as any,
    rawTransactions: (rawTxns || []) as any,
    finishedGoods: [],
    dispatches: (dispatches || []) as any,
    warehouseItems: (warehouseItems || []) as any,
    warehouseMovements: (warehouseMovements || []) as any,
  })
  const recentProduction = (productionLogs || []).slice(0, 4)
  const recentDispatches = (dispatches || []).slice(0, 4)
  const hotWarehouseItems = [...(warehouseItems || [])]
    .sort((a: any, b: any) => ((Number(b.current_stock || 0) * Number(b.unit_rate || 0)) - (Number(a.current_stock || 0) * Number(a.unit_rate || 0))))
    .slice(0, 4)
  const hrDashboard = buildHrDashboardData(
    (employees || []) as any,
    (attendance || []) as any,
    (leaves || []) as any,
    (hrDocuments || []) as any
  )

  // User stats
  const roleCounts = allProfiles.reduce((acc: Record<string, number>, p) => {
    if (!p.role) {
      return acc
    }
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
  const avgBid = allBids.length > 0
    ? allBids.reduce((s, a) => s + (a.bid_amount || 0), 0) / allBids.length
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
    plant_ops: 'bg-cyan-100 text-cyan-700',
    hr: 'bg-rose-100 text-rose-700',
  }
  const roleLabels: Record<string, string> = {
    admin: 'Admin', accounts: 'Accounts',
    transport_team: 'Transport Team', transporter: 'Transporter', plant_ops: 'Plant Ops', hr: 'HR',
  }

  return (
    <div>
      <PageHeader
        title="Admin Overview"
        description="System-wide analytics across all business modules"
        actions={<EnsureHrUserButton />}
      />

      {/* Accounts & Invoices */}
      <div className="mb-6">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <FileText className="h-3.5 w-3.5" /> Accounts &amp; Invoices
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <StatCard label="Total Invoices" value={allInvoices.length} icon={FileText} color="text-gray-700" href="/dashboard/invoices" />
          <StatCard label="Paid" value={paidInvoices.length} icon={CheckCircle} color="text-green-600" href="/dashboard/invoices" />
          <StatCard label="Pending" value={pendingInvoices.length} icon={Clock} color="text-blue-600" href="/dashboard/invoices" />
          <StatCard label="Overdue" value={overdueInvoices.length} icon={AlertCircle} color="text-red-600" href="/dashboard/invoices" />
          <StatCard label="Pending Bill Approvals" value={pendingBillsState.data} sub={pendingBillsState.unavailable ? 'setup pending' : undefined} icon={FileCheck2} color="text-violet-600" href="/admin/bills" />
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

      <div className="mb-6">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Package className="h-3.5 w-3.5" /> Plant &amp; Warehouse
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Today Production" value={plantTodayProduction} sub="qty produced" icon={Package} color="text-cyan-700" href="/plant" />
          <StatCard label="RM Alerts" value={rmAlerts} sub="materials below min" icon={AlertCircle} color="text-amber-600" href="/plant/raw-materials" />
          <StatCard label="Dispatch Today" value={dispatchTodayQty} sub="qty dispatched" icon={Truck} color="text-blue-600" href="/plant/dispatch" />
          <StatCard label="Warehouse Stock Value" value={fmtAmount(warehouseValue)} sub="current valuation" icon={IndianRupee} color="text-emerald-600" href="/plant/warehouse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Production Snapshot</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-cyan-50 p-3">
                  <p className="text-xs font-medium text-cyan-700">Monthly Production</p>
                  <p className="mt-1 text-xl font-bold text-cyan-800">{formatNumber(plantDashboard.cards.monthlyProduction)}</p>
                </div>
                <div className="rounded-lg bg-blue-50 p-3">
                  <p className="text-xs font-medium text-blue-700">Top Product</p>
                  <p className="mt-1 text-sm font-semibold text-blue-900">{plantDashboard.topProducts[0]?.name || '—'}</p>
                  <p className="text-xs text-blue-600">{formatNumber(plantDashboard.topProducts[0]?.qty || 0)} qty</p>
                </div>
              </div>
              <div className="space-y-2">
                {recentProduction.length === 0 && <p className="text-sm text-gray-500">No production entries yet.</p>}
                {recentProduction.map((entry: any) => (
                  <div key={entry.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{entry.product_name}</p>
                      <p className="text-xs text-gray-400">{entry.date} · Shift {entry.shift}</p>
                    </div>
                    <p className="text-sm font-semibold text-cyan-700">{formatNumber(Number(entry.qty || 0), 0)} {entry.unit}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Stock Risk &amp; Materials</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-amber-50 p-3">
                  <p className="text-xs font-medium text-amber-700">Low Stock Items</p>
                  <p className="mt-1 text-xl font-bold text-amber-800">{plantDashboard.lowStockItems.length}</p>
                </div>
                <div className="rounded-lg bg-emerald-50 p-3">
                  <p className="text-xs font-medium text-emerald-700">RM Stock Value</p>
                  <p className="mt-1 text-base font-bold text-emerald-800">{formatCurrency(plantDashboard.cards.rmStockValue)}</p>
                </div>
              </div>
              <div className="space-y-2">
                {plantDashboard.lowStockItems.length === 0 && <p className="text-sm text-gray-500">No low stock alerts right now.</p>}
                {plantDashboard.lowStockItems.slice(0, 4).map(item => (
                  <div key={`${item.type}-${item.name}`} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-400">{item.type === 'RM' ? 'Raw Material' : 'Warehouse'} · min {formatNumber(Number(item.min || 0))}</p>
                    </div>
                    <p className="text-sm font-semibold text-amber-700">{formatNumber(Number(item.value || 0))}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Dispatch &amp; Warehouse Detail</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-indigo-50 p-3">
                  <p className="text-xs font-medium text-indigo-700">Pending Dispatches</p>
                  <p className="mt-1 text-xl font-bold text-indigo-800">{plantDashboard.cards.pendingDispatches}</p>
                </div>
                <div className="rounded-lg bg-teal-50 p-3">
                  <p className="text-xs font-medium text-teal-700">Top Warehouse SKU</p>
                  <p className="mt-1 text-sm font-semibold text-teal-900">{hotWarehouseItems[0]?.item_name || '—'}</p>
                  <p className="text-xs text-teal-600">{hotWarehouseItems[0] ? fmtAmount(Number(hotWarehouseItems[0].current_stock || 0) * Number(hotWarehouseItems[0].unit_rate || 0)) : '—'}</p>
                </div>
              </div>
              <div className="space-y-2">
                {recentDispatches.length === 0 && <p className="text-sm text-gray-500">No dispatch activity yet.</p>}
                {recentDispatches.map((dispatch: any) => (
                  <div key={dispatch.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{dispatch.customer_name}</p>
                      <p className="text-xs text-gray-400">{dispatch.product_name} · {dispatch.date}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-blue-700">{formatNumber(Number(dispatch.qty || 0))}</p>
                      <p className="text-xs capitalize text-gray-400">{dispatch.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
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
            <p className="text-xs font-medium text-gray-500 mb-1">Average Bid Amount</p>
            <p className="text-xl font-bold text-blue-700">{avgBid > 0 ? fmtAmount(avgBid) : '—'}</p>
            <p className="text-xs text-gray-400 mt-0.5">across {allBids.length} bids</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium text-gray-500 mb-1">Lowest Bid</p>
            <p className="text-xl font-bold text-green-700">{lowestBid > 0 ? fmtAmount(lowestBid) : '—'}</p>
            <p className="text-xs text-gray-400 mt-0.5">across {allBids.length} bids</p>
          </Card>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Briefcase className="h-3.5 w-3.5" /> Human Resources
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
          <StatCard label="Employees" value={hrDashboard.cards.totalEmployees} icon={Users} color="text-rose-700" href="/hr/employees" />
          <StatCard label="Present Today" value={hrDashboard.cards.presentToday} icon={CalendarCheck2} color="text-emerald-600" href="/hr/attendance" />
          <StatCard label="On Leave" value={hrDashboard.cards.onLeave} icon={Clock} color="text-amber-600" href="/hr/leaves" />
          <StatCard label="New Joinees" value={hrDashboard.cards.newJoinees} icon={Users} color="text-blue-600" href="/hr/employees" />
          <StatCard label="Salary Base" value={hrDashboard.cards.salaryLabel} icon={IndianRupee} color="text-violet-600" href="/hr/payroll" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">HR Alerts</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {hrDashboard.expiringDocumentAlerts.slice(0, 3).map(document => (
                <div key={document.id} className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
                  <p className="text-sm font-medium text-amber-800">{document.employee?.name || 'Employee'} · {document.doc_type}</p>
                  <p className="text-xs text-amber-700">Expiry on {document.expires_on}</p>
                </div>
              ))}
              {hrDashboard.lowAttendanceAlerts.slice(0, 3).map(alert => (
                <div key={alert.employee.id} className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2">
                  <p className="text-sm font-medium text-rose-800">{alert.employee.name}</p>
                  <p className="text-xs text-rose-700">Attendance at {alert.rate}% in the last 30 days</p>
                </div>
              ))}
              {hrDashboard.expiringDocumentAlerts.length === 0 && hrDashboard.lowAttendanceAlerts.length === 0 && (
                <p className="text-sm text-gray-500">No HR alerts right now.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">HR Quick Access</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {[
                { href: '/hr', label: 'Open HR Dashboard', meta: 'Overview and charts' },
                { href: '/admin/create-user', label: 'Create HR User', meta: 'Assign role = HR' },
                { href: '/hr/documents', label: 'Review HR Documents', meta: `${(hrDocuments || []).length} files tracked` },
              ].map(item => (
                <Link key={item.href} href={item.href} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.label}</p>
                    <p className="text-xs text-gray-400">{item.meta}</p>
                  </div>
                  <span className="text-sm text-violet-600">Open</span>
                </Link>
              ))}
            </CardContent>
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
              {['admin', 'accounts', 'transport_team', 'transporter', 'plant_ops', 'hr'].map(role => {
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
