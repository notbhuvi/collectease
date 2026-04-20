import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Truck, FileText, ShieldCheck } from 'lucide-react'
import Link from 'next/link'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const serviceClient = await createServiceClient()

  const [{ data: profiles }, { data: loads }, { data: bids }, { data: invoices }] = await Promise.all([
    serviceClient.from('profiles').select('role'),
    serviceClient.from('transport_loads').select('status'),
    serviceClient.from('transport_bids').select('id'),
    serviceClient.from('invoices').select('status, total_amount'),
  ])

  const allProfiles = profiles || []
  const allLoads = loads || []

  const roleCounts = allProfiles.reduce((acc: Record<string, number>, p) => {
    acc[p.role] = (acc[p.role] || 0) + 1
    return acc
  }, {})

  const stats = [
    { label: 'Total Users', value: allProfiles.length, icon: Users, color: 'text-violet-600', href: '/admin/users' },
    { label: 'Active Loads', value: allLoads.filter(l => l.status === 'open').length, icon: Truck, color: 'text-orange-600', href: '/transport' },
    { label: 'Total Bids', value: (bids || []).length, icon: FileText, color: 'text-blue-600', href: '/transport' },
    { label: 'Total Invoices', value: (invoices || []).length, icon: FileText, color: 'text-green-600', href: '/dashboard/invoices' },
  ]

  const roleColors: Record<string, string> = {
    admin: 'bg-violet-100 text-violet-700',
    accounts: 'bg-blue-100 text-blue-700',
    sales: 'bg-cyan-100 text-cyan-700',
    transport_team: 'bg-orange-100 text-orange-700',
    transporter: 'bg-emerald-100 text-emerald-700',
  }

  return (
    <div>
      <PageHeader
        title="Admin Overview"
        description="System-wide analytics and access management"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map(s => (
          <Link key={s.label} href={s.href}>
            <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-gray-500">{s.label}</p>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Role distribution */}
        <Card>
          <CardHeader><CardTitle>Users by Role</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {['admin', 'accounts', 'sales', 'transport_team', 'transporter'].map(role => {
              const count = roleCounts[role] || 0
              const pct = allProfiles.length > 0 ? (count / allProfiles.length) * 100 : 0
              const label = { admin: 'Admin', accounts: 'Accounts', sales: 'Sales', transport_team: 'Transport Team', transporter: 'Transporter' }[role]
              return (
                <div key={role}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[role]}`}>{label}</span>
                    <span className="text-gray-500">{count} user{count !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
            <div className="pt-2">
              <Link href="/admin/users" className="text-sm text-violet-600 hover:text-violet-700 font-medium">
                Manage Users & Roles →
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <Card>
          <CardHeader><CardTitle>Quick Access</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {[
              { href: '/admin/users', label: 'Manage Users & Roles', desc: 'Assign roles, update profiles', color: 'bg-violet-50 hover:bg-violet-100 border-violet-100', icon: ShieldCheck, iconColor: 'text-violet-600' },
              { href: '/dashboard', label: 'Invoice Dashboard', desc: 'View receivables and reminders', color: 'bg-blue-50 hover:bg-blue-100 border-blue-100', icon: FileText, iconColor: 'text-blue-600' },
              { href: '/transport', label: 'Transport Dashboard', desc: 'Manage loads and bids', color: 'bg-orange-50 hover:bg-orange-100 border-orange-100', icon: Truck, iconColor: 'text-orange-600' },
            ].map(item => (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${item.color}`}>
                <div className={`p-2 rounded-lg bg-white`}>
                  <item.icon className={`h-4 w-4 ${item.iconColor}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.label}</p>
                  <p className="text-xs text-gray-500">{item.desc}</p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
