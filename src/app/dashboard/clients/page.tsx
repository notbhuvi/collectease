import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { Users, Plus } from 'lucide-react'
import { AddClientButton } from '@/components/clients/add-client-button'
import { DeleteClientButton } from '@/components/clients/delete-client-button'
import { getProfileForUser } from '@/lib/profile'
import { getAccessibleBusinessForUser } from '@/lib/business'
import type { UserRole } from '@/types'

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const serviceClient = await createServiceClient()
  const profile = await getProfileForUser(serviceClient, user, 'role')
  const business = await getAccessibleBusinessForUser(serviceClient, user, profile?.role as UserRole)

  if (!business) redirect('/dashboard/settings')

  const { data: clients } = await serviceClient
    .from('clients')
    .select('*')
    .eq('business_id', business.id)
    .order('name')

  // Get outstanding per client
  const { data: invoiceSums } = await serviceClient
    .from('invoices')
    .select('client_id, total_amount, status')
    .eq('business_id', business.id)
    .in('status', ['sent', 'overdue'])

  const outstandingMap: Record<string, number> = {}
  ;(invoiceSums || []).forEach(inv => {
    outstandingMap[inv.client_id] = (outstandingMap[inv.client_id] || 0) + inv.total_amount
  })

  const riskVariant: Record<string, 'success' | 'warning' | 'destructive'> = {
    good: 'success',
    moderate: 'warning',
    risky: 'destructive',
  }

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Manage your clients and track payment behavior"
        actions={<AddClientButton businessId={business.id} />}
      />

      <Card>
        <CardContent className="p-0">
          {!clients || clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="h-10 w-10 text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-900">No clients yet</p>
              <p className="text-xs text-gray-500 mt-1">Add your first client to start creating invoices</p>
            </div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">Client</th>
                      <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Contact</th>
                      <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Outstanding</th>
                      <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Invoices</th>
                      <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Avg Delay</th>
                      <th className="text-center text-xs font-medium text-gray-500 px-6 py-3">Risk</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {clients.map(client => (
                      <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-900">{client.name}</p>
                          {client.gstin && <p className="text-xs text-gray-400">GSTIN: {client.gstin}</p>}
                        </td>
                        <td className="px-4 py-4">
                          {client.contact_person && <p className="text-gray-700">{client.contact_person}</p>}
                          {client.email && <p className="text-xs text-gray-400">{client.email}</p>}
                          {client.phone && <p className="text-xs text-gray-400">{client.phone}</p>}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className={`font-semibold ${(outstandingMap[client.id] || 0) > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                            {formatCurrency(outstandingMap[client.id] || 0)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center text-gray-600">{client.total_invoices}</td>
                        <td className="px-4 py-4 text-center">
                          <span className={client.avg_delay_days > 0 ? 'text-orange-600' : 'text-gray-400'}>
                            {client.avg_delay_days > 0 ? `${client.avg_delay_days}d` : '–'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <Badge variant={riskVariant[client.risk_label] || 'secondary'}>
                            {client.risk_label}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <DeleteClientButton clientId={client.id} clientName={client.name} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="md:hidden divide-y divide-gray-100">
                {clients.map(client => (
                  <div key={client.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-gray-900">{client.name}</p>
                        {client.email && <p className="text-xs text-gray-400">{client.email}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={riskVariant[client.risk_label] || 'secondary'}>{client.risk_label}</Badge>
                        <DeleteClientButton clientId={client.id} clientName={client.name} />
                      </div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">{client.total_invoices} invoices · {client.avg_delay_days > 0 ? `${client.avg_delay_days}d avg delay` : 'on time'}</span>
                      <span className={`font-semibold ${(outstandingMap[client.id] || 0) > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {formatCurrency(outstandingMap[client.id] || 0)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
