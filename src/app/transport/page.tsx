import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Truck, Package, Clock, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { TransportLoadForm } from '@/components/transport/load-form'
import { CreateTransporterDialog } from '@/components/transport/create-transporter-dialog'
import { DeleteLoadButton } from '@/components/transport/delete-load-button'
import { formatLoadQuantity } from '@/lib/transport'

export default async function TransportDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Use service client to bypass RLS so transport_team can always see all loads
  const serviceClient = await createServiceClient()
  const { data: loads } = await serviceClient
    .from('transport_loads')
    .select('*')
    .order('created_at', { ascending: false })

  const allLoads = loads || []
  const open = allLoads.filter(l => l.status === 'open').length
  const awarded = allLoads.filter(l => l.status === 'awarded').length
  const completed = allLoads.filter(l => l.status === 'completed').length

  const statusVariant: Record<string, any> = {
    open: 'success', closed: 'secondary', awarded: 'warning', completed: 'default',
  }

  return (
    <div>
      <PageHeader
        title="Transport Dashboard"
        description="Manage freight loads and transporter bids"
        actions={
          <div className="flex gap-2">
            <CreateTransporterDialog />
            <TransportLoadForm />
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Loads', value: allLoads.length, icon: Package, color: 'text-blue-600' },
          { label: 'Open for Bids', value: open, icon: Clock, color: 'text-green-600' },
          { label: 'Awarded', value: awarded, icon: Truck, color: 'text-amber-600' },
          { label: 'Completed', value: completed, icon: CheckCircle, color: 'text-gray-600' },
        ].map(s => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium text-gray-500">{s.label}</p>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </div>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Loads table */}
      <Card>
        <CardHeader>
          <CardTitle>All Loads</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {allLoads.length === 0 ? (
            <div className="text-center py-16">
              <Truck className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500">No loads yet</p>
              <p className="text-xs text-gray-400 mt-1">Create a new load to start collecting bids</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">Route</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Material</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Vehicle</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Pickup Date</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Deadline</th>
                    <th className="text-center text-xs font-medium text-gray-500 px-4 py-3">Status</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-6 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {allLoads.map(load => (
                    <tr key={load.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3">
                        <p className="font-medium text-gray-900 truncate max-w-[200px]">{load.pickup_location}</p>
                        <p className="text-xs text-gray-400">→ {load.drop_location}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-700">{load.material}</p>
                        <p className="text-xs text-gray-400">{formatLoadQuantity(load)}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{load.vehicle_type}</td>
                      <td className="px-4 py-3 text-gray-500">{new Date(load.pickup_date).toLocaleDateString('en-IN')}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(load.bidding_deadline) < new Date()
                          ? <span className="text-red-500 text-xs font-medium">Expired</span>
                          : new Date(load.bidding_deadline).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={statusVariant[load.status]}>{load.status}</Badge>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/transport/loads/${load.id}`}
                            className="text-xs font-medium text-blue-600 hover:text-blue-700">
                            View Bids →
                          </Link>
                          <DeleteLoadButton loadId={load.id} compact />
                        </div>
                      </td>
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
