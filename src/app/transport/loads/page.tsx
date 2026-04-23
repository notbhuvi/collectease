import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Truck } from 'lucide-react'
import Link from 'next/link'
import { DeleteLoadButton } from '@/components/transport/delete-load-button'
import { formatLoadQuantity } from '@/lib/transport'

export default async function AllLoadsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const serviceClient = await createServiceClient()

  // Fetch loads plain (no nested joins — profiles!transporter_id fails silently)
  const { data: loads } = await serviceClient
    .from('transport_loads')
    .select('*')
    .order('created_at', { ascending: false })

  const allLoads = loads || []

  // Fetch awarded info for awarded loads separately
  const awardedLoadIds = allLoads.filter(l => l.status === 'awarded').map(l => l.id)
  const { data: awardedRows } = awardedLoadIds.length > 0
    ? await serviceClient.from('awarded_loads').select('load_id, final_amount, transporter_id').in('load_id', awardedLoadIds)
    : { data: [] }

  // Batch-fetch transporter profiles for awarded loads
  const awardedTransporterIds = [...new Set((awardedRows || []).map(a => a.transporter_id).filter(Boolean))]
  const { data: awardedProfiles } = awardedTransporterIds.length > 0
    ? await serviceClient.from('profiles').select('id, full_name, company_name').in('id', awardedTransporterIds)
    : { data: [] }

  const profileMap = new Map((awardedProfiles || []).map(p => [p.id, p]))
  const awardedMap = new Map((awardedRows || []).map(a => [a.load_id, {
    ...a,
    transporter: profileMap.get(a.transporter_id) ?? null,
  }]))

  const statusVariant: Record<string, any> = {
    open: 'success', closed: 'secondary', awarded: 'warning', completed: 'default',
  }

  const statusGroups = {
    open: allLoads.filter(l => l.status === 'open'),
    closed: allLoads.filter(l => l.status === 'closed'),
    awarded: allLoads.filter(l => l.status === 'awarded'),
    completed: allLoads.filter(l => l.status === 'completed'),
  }

  return (
    <div>
      <PageHeader
        title="All Loads"
        description={`${allLoads.length} total loads across all statuses`}
      />

      {allLoads.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Truck className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500">No loads yet</p>
            <p className="text-xs text-gray-400 mt-1">Go to Dashboard to create a new load</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {(['open', 'closed', 'awarded', 'completed'] as const).map(status => {
            const group = statusGroups[status]
            if (group.length === 0) return null
            return (
              <Card key={status}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-base">
                    <Badge variant={statusVariant[status]} className="capitalize">{status}</Badge>
                    <span className="text-sm font-normal text-gray-500">{group.length} load{group.length !== 1 ? 's' : ''}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">Route</th>
                          <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Material</th>
                          <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Vehicle</th>
                          <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Pickup Date</th>
                          <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Deadline</th>
                          {status === 'awarded' && (
                            <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Awarded To</th>
                          )}
                          <th className="text-right text-xs font-medium text-gray-500 px-6 py-3">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {group.map(load => {
                          const awarded = awardedMap.get(load.id)
                          return (
                            <tr key={load.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-3">
                                <p className="font-medium text-gray-900 truncate max-w-[180px]">{load.pickup_location}</p>
                                <p className="text-xs text-gray-400">→ {load.drop_location}</p>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-gray-700">{load.material}</p>
                                <p className="text-xs text-gray-400">{formatLoadQuantity(load)}</p>
                              </td>
                              <td className="px-4 py-3 text-gray-700">{load.vehicle_type}</td>
                              <td className="px-4 py-3 text-gray-500">
                                {new Date(load.pickup_date).toLocaleDateString('en-IN')}
                              </td>
                              <td className="px-4 py-3 text-gray-500">
                                {new Date(load.bidding_deadline) < new Date()
                                  ? <span className="text-red-500 text-xs font-medium">Expired</span>
                                  : new Date(load.bidding_deadline).toLocaleDateString('en-IN')}
                              </td>
                              {status === 'awarded' && (
                                <td className="px-4 py-3 text-gray-700">
                                  {awarded?.transporter?.company_name || awarded?.transporter?.full_name || awarded?.transporter_id?.slice(0, 8) || '—'}
                                </td>
                              )}
                              <td className="px-6 py-3">
                                <div className="flex items-center justify-end gap-2">
                                  <Link
                                    href={`/transport/loads/${load.id}`}
                                    className="text-xs font-medium text-blue-600 hover:text-blue-700"
                                  >
                                    View Bids →
                                  </Link>
                                  <DeleteLoadButton loadId={load.id} compact />
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
