import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Package, MapPin, Truck, Calendar, Clock, TrendingDown } from 'lucide-react'
import { BidModal } from '@/components/portal/bid-modal'

export default async function PortalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Get open loads
  const { data: loads } = await supabase
    .from('transport_loads')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  // Get this transporter's existing bids
  const { data: myBids } = await supabase
    .from('transport_bids')
    .select('load_id, bid_amount, id')
    .eq('transporter_id', user.id)

  const myBidMap = new Map((myBids || []).map(b => [b.load_id, b]))
  const openLoads = loads || []

  // Fetch all bid amounts on open loads — RLS policy "transporter_view_open_load_bids"
  // allows transporters to read all bid amounts on open loads (amounts only, not who bid).
  const lowestBidMap = new Map<string, number>()
  if (openLoads.length > 0) {
    const { data: allBids } = await supabase
      .from('transport_bids')
      .select('load_id, bid_amount')
      .in('load_id', openLoads.map(l => l.id))

    for (const bid of allBids || []) {
      const current = lowestBidMap.get(bid.load_id)
      if (current === undefined || bid.bid_amount < current) {
        lowestBidMap.set(bid.load_id, bid.bid_amount)
      }
    }
  }

  return (
    <div>
      <PageHeader
        title="Open Loads"
        description="Available loads open for bidding. Submit your best price to win."
      />

      {openLoads.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500">No open loads right now</p>
            <p className="text-xs text-gray-400 mt-1">Check back soon for new freight opportunities</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {openLoads.map(load => {
            const existingBid = myBidMap.get(load.id)
            const deadlinePassed = new Date(load.bidding_deadline) < new Date()
            const lowestBid = lowestBidMap.get(load.id)
            const iAmLowest = existingBid && lowestBid === existingBid.bid_amount

            return (
              <Card key={load.id} className={`relative overflow-hidden ${existingBid ? 'border-emerald-200' : ''}`}>
                {existingBid && (
                  <div className="absolute top-3 right-3">
                    <Badge variant="success">Bid Placed ✓</Badge>
                  </div>
                )}
                <CardContent className="p-5">
                  {/* Route */}
                  <div className="flex items-start gap-2 mb-4 pr-24">
                    <MapPin className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-900">{load.pickup_location}</p>
                      <p className="text-xs text-gray-400 mt-0.5">→ {load.drop_location}</p>
                    </div>
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <Package className="h-3.5 w-3.5 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-400">Material</p>
                        <p className="text-sm font-medium text-gray-700">{load.material}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Truck className="h-3.5 w-3.5 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-400">Vehicle · Weight</p>
                        <p className="text-sm font-medium text-gray-700">{load.vehicle_type} · {load.weight}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-400">Pickup Date</p>
                        <p className="text-sm font-medium text-gray-700">
                          {new Date(load.pickup_date).toLocaleDateString('en-IN')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-400">Bid Deadline</p>
                        <p className={`text-sm font-medium ${deadlinePassed ? 'text-red-600' : 'text-gray-700'}`}>
                          {deadlinePassed ? 'Expired' : new Date(load.bidding_deadline).toLocaleDateString('en-IN')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Current lowest bid indicator */}
                  {lowestBid && !deadlinePassed && (
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-4 ${
                      iAmLowest ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'
                    }`}>
                      <TrendingDown className={`h-3.5 w-3.5 ${iAmLowest ? 'text-emerald-600' : 'text-amber-600'}`} />
                      <p className={`text-xs font-medium ${iAmLowest ? 'text-emerald-700' : 'text-amber-700'}`}>
                        Current Lowest Bid:{' '}
                        <span className="font-bold">
                          ₹{lowestBid.toLocaleString('en-IN')}
                        </span>
                        {iAmLowest && <span className="ml-1">— That&apos;s you! 🎉</span>}
                      </p>
                    </div>
                  )}

                  {load.notes && (
                    <p className="text-xs text-gray-500 bg-gray-50 rounded px-3 py-2 mb-4">{load.notes}</p>
                  )}

                  {existingBid ? (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-emerald-700">
                        Your bid:{' '}
                        <span className="font-bold">₹{existingBid.bid_amount.toLocaleString('en-IN')}</span>
                      </p>
                      {!deadlinePassed && (
                        <BidModal
                          loadId={load.id}
                          existingBid={{ id: existingBid.id, amount: existingBid.bid_amount }}
                          isEdit
                        />
                      )}
                    </div>
                  ) : deadlinePassed ? (
                    <p className="text-sm text-red-500 text-center py-2">Bidding closed</p>
                  ) : (
                    <BidModal loadId={load.id} />
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
