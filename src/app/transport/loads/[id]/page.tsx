import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { AwardBidButton } from '@/components/transport/award-bid-button'
import { CloseLoadButton } from '@/components/transport/close-load-button'
import { DeleteBidButton } from '@/components/transport/delete-bid-button'
import { EditBidButton } from '@/components/transport/edit-bid-button'
import { DeleteLoadButton } from '@/components/transport/delete-load-button'
import { EditLoadButton } from '@/components/transport/edit-load-button'
import { MapPin, Package, Truck, Calendar, Clock, IndianRupee, Medal } from 'lucide-react'
import { calculateTransportTotalFare, formatLoadQuantity, getBidRateLabel, getLoadQuantity } from '@/lib/transport'

interface TransporterProfile {
  id: string
  full_name: string | null
  company_name: string | null
  email: string | null
}

export default async function LoadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const serviceClient = await createServiceClient()

  // Fetch load and bids separately to avoid nested join issues
  const { data: load, error: loadError } = await serviceClient
    .from('transport_loads')
    .select('*')
    .eq('id', id)
    .single()

  if (loadError || !load) notFound()

  // Fetch awarded info separately (no join — fetch profile separately)
  const { data: awardedRaw } = await serviceClient
    .from('awarded_loads')
    .select('id, final_amount, transporter_id, awarded_at')
    .eq('load_id', id)
    .maybeSingle()

  // Fetch awarded transporter profile if exists
  const { data: awardedTransporter } = awardedRaw?.transporter_id
    ? await serviceClient.from('profiles').select('full_name, company_name').eq('id', awardedRaw.transporter_id).single()
    : { data: null }

  const awardedData = awardedRaw ? { ...awardedRaw, transporter: awardedTransporter } : null

  // Fetch creator profile separately
  const { data: creator } = await serviceClient
    .from('profiles')
    .select('full_name, email')
    .eq('id', load.created_by)
    .maybeSingle()

  // Fetch bids plain — no join (join on profiles!transporter_id fails silently)
  const { data: rawBids } = await serviceClient
    .from('transport_bids')
    .select('*')
    .eq('load_id', id)
    .order('bid_amount', { ascending: true })

  // Batch-fetch all transporter profiles in one query via service role so the
  // leaderboard keeps working even when RLS is tightened.
  const bidList = rawBids || []
  const transporterIds = [...new Set(bidList.map(b => b.transporter_id).filter(Boolean))]

  let transporterProfiles: TransporterProfile[] = []
  if (transporterIds.length > 0) {
    const { data: svcProfiles } = await serviceClient
      .from('profiles')
      .select('id, full_name, company_name, email')
      .in('id', transporterIds)
    transporterProfiles = svcProfiles || []
  }

  const profileMap = new Map(transporterProfiles.map(p => [p.id, p]))

  // Merge profiles into bids
  const allBids = bidList.map(b => ({
    ...b,
    transporter: profileMap.get(b.transporter_id) ?? null,
  }))
  const lowestBid = allBids[0]
  const quantity = getLoadQuantity(load)
  const quantityText = formatLoadQuantity(load)
  const rateLabel = getBidRateLabel(quantity.quantityUnit)
  const deadlinePassed = new Date(load.bidding_deadline) < new Date()
  const isOpen = load.status === 'open'
  const isAwarded = load.status === 'awarded'

  const statusVariant: Record<string, 'success' | 'secondary' | 'warning' | 'default'> = {
    open: 'success', closed: 'secondary', awarded: 'warning', completed: 'default',
  }

  function getRankLabel(index: number) {
    if (index === 0) return '🥇'
    if (index === 1) return '🥈'
    if (index === 2) return '🥉'
    return `#${index + 1}`
  }

  return (
    <div>
      <PageHeader
        title={`${load.pickup_location} → ${load.drop_location}`}
        description={`Load ID: ${load.id.slice(0, 8).toUpperCase()} · Created by ${creator?.full_name || creator?.email || 'Unknown'}`}
        actions={
          <div className="flex gap-2">
            {isOpen && <EditLoadButton load={load} />}
            {isOpen && <CloseLoadButton loadId={load.id} />}
            <DeleteLoadButton loadId={load.id} />
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Load details */}
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-base">Load Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-2">
              <Badge variant={statusVariant[load.status]} className="mt-0.5 capitalize">{load.status}</Badge>
              {deadlinePassed && isOpen && (
                <span className="text-xs text-red-500 font-medium mt-1">Deadline passed</span>
              )}
            </div>
            {[
              { icon: MapPin, label: 'From', value: load.pickup_location },
              { icon: MapPin, label: 'To', value: load.drop_location },
              { icon: Package, label: 'Material', value: `${load.material} · ${quantityText}` },
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
          {isAwarded && awardedData && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-green-700 uppercase tracking-wide mb-1">
                      🏆 Awarded To
                    </p>
                    <p className="text-lg font-bold text-green-900">
                      {awardedData.transporter?.company_name || awardedData.transporter?.full_name}
                    </p>
                    <p className="text-sm text-green-700">
                      Final amount: {formatCurrency(awardedData.final_amount)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Medal className="h-4 w-4 text-orange-500" />
                  Leaderboard — Bids Received ({allBids.length})
                </CardTitle>
                {lowestBid && (
                  <span className="text-xs text-gray-500">
                    Lowest:{' '}
                    <span className="font-semibold text-green-600">{formatCurrency(lowestBid.bid_amount)} {rateLabel}</span>
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
                        <th className="text-center text-xs font-medium text-gray-500 px-3 py-3 w-12">Rank</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Transporter</th>
                        <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Bid Rate</th>
                        <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Total Fare</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Remarks</th>
                        <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Submitted</th>
                        <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {allBids.map((bid, index) => {
                        const transporter = bid.transporter as TransporterProfile | null
                        const isLowest = index === 0
                        const totalFare = calculateTransportTotalFare(quantity.quantityValue, bid.bid_amount)
                        return (
                          <tr key={bid.id} className={`hover:bg-gray-50 ${isLowest ? 'bg-green-50/50' : ''}`}>
                            <td className="px-3 py-3 text-center">
                              <span className={`text-base font-bold ${isLowest ? 'text-green-600' : 'text-gray-400'}`}>
                                {getRankLabel(index)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {isLowest && (
                                  <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">
                                    Lowest
                                  </span>
                                )}
                                <div>
                                  <p className="font-medium text-gray-900">
                                    {transporter?.company_name || transporter?.full_name || transporter?.email || bid.transporter_id?.slice(0, 8).toUpperCase() || '—'}
                                  </p>
                                  {transporter?.email && (transporter?.company_name || transporter?.full_name) && (
                                    <p className="text-xs text-gray-400">{transporter.email}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-900">
                              {formatCurrency(bid.bid_amount)} {rateLabel}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-700">
                              {totalFare === null ? '—' : formatCurrency(totalFare)}
                            </td>
                            <td className="px-4 py-3 text-gray-500 max-w-[160px] truncate">
                              {bid.remarks || '—'}
                            </td>
                            <td className="px-4 py-3 text-gray-400 text-xs">
                              {new Date(bid.created_at).toLocaleDateString('en-IN')}
                              {bid.updated_at && bid.updated_at !== bid.created_at && (
                                <p className="text-gray-300">Edited {new Date(bid.updated_at).toLocaleDateString('en-IN')}</p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {isOpen && (
                                  <>
                                    <EditBidButton
                                      bidId={bid.id}
                                      currentAmount={bid.bid_amount}
                                      currentRemarks={bid.remarks || ''}
                                      transporterName={transporter?.company_name || transporter?.full_name || 'Unknown'}
                                      quantityValue={quantity.quantityValue}
                                      quantityUnit={quantity.quantityUnit}
                                    />
                                    <AwardBidButton
                                      loadId={load.id}
                                      transporterId={bid.transporter_id}
                                      bidRate={bid.bid_amount}
                                      totalFare={totalFare ?? bid.bid_amount}
                                      transporterName={transporter?.company_name || transporter?.full_name || 'Unknown'}
                                      rateLabel={rateLabel}
                                    />
                                  </>
                                )}
                                <DeleteBidButton bidId={bid.id} transporterName={transporter?.company_name || transporter?.full_name || 'Unknown'} />
                              </div>
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
        </div>
      </div>
    </div>
  )
}
