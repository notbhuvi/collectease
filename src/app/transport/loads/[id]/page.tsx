import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { AwardBidButton } from '@/components/transport/award-bid-button'
import { CloseLoadButton } from '@/components/transport/close-load-button'
import { MapPin, Package, Truck, Calendar, Clock, IndianRupee } from 'lucide-react'

export default async function LoadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: load } = await supabase
    .from('transport_loads')
    .select(`*, creator:profiles!created_by(full_name, email), awarded:awarded_loads(id, final_amount, transporter_id, awarded_at, transporter:profiles!transporter_id(full_name, company_name))`)
    .eq('id', id)
    .single()

  if (!load) notFound()

  const { data: bids } = await supabase
    .from('transport_bids')
    .select(`*, transporter:profiles!transporter_id(full_name, company_name, email)`)
    .eq('load_id', id)
    .order('bid_amount', { ascending: true })

  const allBids = bids || []
  const lowestBid = allBids[0]
  const deadlinePassed = new Date(load.bidding_deadline) < new Date()
  const isOpen = load.status === 'open'
  const isAwarded = load.status === 'awarded'

  const statusVariant: Record<string, any> = {
    open: 'success', closed: 'secondary', awarded: 'warning', completed: 'default',
  }

  return (
    <div>
      <PageHeader
        title={`${load.pickup_location} → ${load.drop_location}`}
        description={`Load ID: ${load.id.slice(0, 8).toUpperCase()} · Created by ${(load.creator as any)?.full_name || (load.creator as any)?.email}`}
        actions={
          <div className="flex gap-2">
            {isOpen && <CloseLoadButton loadId={load.id} />}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Load details */}
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-base">Load Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-2">
              <Badge variant={statusVariant[load.status]} className="mt-0.5">{load.status}</Badge>
              {deadlinePassed && isOpen && <span className="text-xs text-red-500 font-medium mt-1">Deadline passed</span>}
            </div>
            {[
              { icon: MapPin, label: 'From', value: load.pickup_location },
              { icon: MapPin, label: 'To', value: load.drop_location },
              { icon: Package, label: 'Material', value: `${load.material} · ${load.weight}` },
              { icon: Truck, label: 'Vehicle', value: load.vehicle_type },
              { icon: Calendar, label: 'Pickup Date', value: new Date(load.pickup_date).toLocaleDateString('en-IN') },
              { icon: Clock, label: 'Bid Deadline', value: new Date(load.bidding_deadline).toLocaleString('en-IN') },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                <Icon className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="text-sm font-medium text-gray-900">{value}</p>
                </div>
              </div>
            ))}
            {load.notes && (
              <div className="pt-2">
                <p className="text-xs text-gray-400 mb-1">Notes</p>
                <p className="text-sm text-gray-600">{load.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bids */}
        <div className="lg:col-span-2 space-y-4">
          {isAwarded && (load.awarded as any) && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-green-700 uppercase tracking-wide mb-1">🏆 Awarded To</p>
                    <p className="text-lg font-bold text-green-900">{(load.awarded as any).transporter?.company_name || (load.awarded as any).transporter?.full_name}</p>
                    <p className="text-sm text-green-700">Final amount: {formatCurrency((load.awarded as any).final_amount)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Bids Received ({allBids.length})
                </CardTitle>
                {lowestBid && (
                  <span className="text-xs text-gray-500">
                    Lowest: <span className="font-semibold text-green-600">{formatCurrency(lowestBid.bid_amount)}</span>
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {allBids.length === 0 ? (
                <div className="text-center py-12">
                  <IndianRupee className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No bids yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">Transporter</th>
                        <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Bid Amount</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Remarks</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Submitted</th>
                        {isOpen && !deadlinePassed && <th className="text-right text-xs font-medium text-gray-500 px-6 py-3">Action</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {allBids.map((bid, index) => {
                        const transporter = bid.transporter as any
                        return (
                          <tr key={bid.id} className={`hover:bg-gray-50 ${index === 0 ? 'bg-green-50/50' : ''}`}>
                            <td className="px-6 py-3">
                              <div className="flex items-center gap-2">
                                {index === 0 && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">Lowest</span>}
                                <div>
                                  <p className="font-medium text-gray-900">{transporter?.company_name || transporter?.full_name || '—'}</p>
                                  <p className="text-xs text-gray-400">{transporter?.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-900">
                              {formatCurrency(bid.bid_amount)}
                            </td>
                            <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">{bid.remarks || '—'}</td>
                            <td className="px-4 py-3 text-gray-400 text-xs">
                              {new Date(bid.created_at).toLocaleDateString('en-IN')}
                            </td>
                            {isOpen && !deadlinePassed && (
                              <td className="px-6 py-3 text-right">
                                <AwardBidButton
                                  loadId={load.id}
                                  transporterId={bid.transporter_id}
                                  bidAmount={bid.bid_amount}
                                  transporterName={transporter?.company_name || transporter?.full_name || 'Unknown'}
                                />
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
