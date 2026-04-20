import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { FileText, Trophy, Clock } from 'lucide-react'

export default async function MyBidsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: bids } = await supabase
    .from('transport_bids')
    .select(`
      *,
      load:transport_loads(pickup_location, drop_location, material, vehicle_type, pickup_date, bidding_deadline, status,
        awarded:awarded_loads(transporter_id, final_amount))
    `)
    .eq('transporter_id', user.id)
    .order('created_at', { ascending: false })

  const allBids = bids || []

  function getBidStatus(bid: any) {
    const load = bid.load
    if (!load) return { label: 'Unknown', variant: 'secondary' as const }
    if (load.status === 'open') return { label: 'Bidding Open', variant: 'success' as const }
    if (load.status === 'awarded') {
      const awarded = load.awarded?.[0] || load.awarded
      if (awarded?.transporter_id === user!.id) return { label: '🏆 Won', variant: 'success' as const }
      return { label: 'Not Selected', variant: 'secondary' as const }
    }
    if (load.status === 'completed') {
      const awarded = load.awarded?.[0] || load.awarded
      if (awarded?.transporter_id === user!.id) return { label: 'Completed', variant: 'default' as const }
      return { label: 'Not Selected', variant: 'secondary' as const }
    }
    return { label: load.status, variant: 'secondary' as const }
  }

  const won = allBids.filter(b => {
    const load = b.load
    const awarded = load?.awarded?.[0] || load?.awarded
    return load?.status === 'awarded' && awarded?.transporter_id === user.id
  })

  return (
    <div>
      <PageHeader title="My Bids" description="Track all your submitted bids and their outcomes" />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <p className="text-xs text-gray-500 mb-1">Total Bids</p>
          <p className="text-2xl font-bold text-gray-900">{allBids.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500 mb-1">Won</p>
          <p className="text-2xl font-bold text-emerald-600">{won.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500 mb-1">Win Rate</p>
          <p className="text-2xl font-bold text-blue-600">
            {allBids.length > 0 ? Math.round((won.length / allBids.length) * 100) : 0}%
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Bid History</CardTitle></CardHeader>
        <CardContent className="p-0">
          {allBids.length === 0 ? (
            <div className="text-center py-16">
              <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No bids placed yet</p>
              <p className="text-xs text-gray-400 mt-1">Go to Open Loads to place your first bid</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">Route</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Details</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-4 py-3">Your Bid</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Submitted</th>
                    <th className="text-center text-xs font-medium text-gray-500 px-6 py-3">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {allBids.map(bid => {
                    const load = bid.load as any
                    const status = getBidStatus(bid)
                    const isWon = status.label === '🏆 Won'
                    return (
                      <tr key={bid.id} className={`hover:bg-gray-50 ${isWon ? 'bg-green-50/30' : ''}`}>
                        <td className="px-6 py-3">
                          <p className="font-medium text-gray-900">{load?.pickup_location || '—'}</p>
                          <p className="text-xs text-gray-400">→ {load?.drop_location}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-gray-700">{load?.material}</p>
                          <p className="text-xs text-gray-400">{load?.vehicle_type} · {new Date(load?.pickup_date).toLocaleDateString('en-IN')}</p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className={`font-semibold ${isWon ? 'text-emerald-600' : 'text-gray-900'}`}>
                            {formatCurrency(bid.bid_amount)}
                          </p>
                          {bid.remarks && <p className="text-xs text-gray-400">{bid.remarks}</p>}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {new Date(bid.created_at).toLocaleDateString('en-IN')}
                        </td>
                        <td className="px-6 py-3 text-center">
                          <Badge variant={status.variant}>{status.label}</Badge>
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
  )
}
