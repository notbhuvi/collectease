import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { dedupeFinishedGoodsStock } from '@/lib/plant'
import { createServiceClient } from '@/lib/supabase/server'
import type { FinishedGoodsStock } from '@/types'

export default async function FinishedGoodsPage() {
  const serviceClient = await createServiceClient()
  const { data } = await serviceClient.from('finished_goods_stock').select('*').order('updated_at', { ascending: false })
  const finishedGoods = dedupeFinishedGoodsStock((data || []) as FinishedGoodsStock[])

  return (
    <div className="space-y-6">
      <PageHeader title="Finished Goods" description="Live FG stock auto-synced from production and dispatch activity." />
      <Card>
        <CardHeader><CardTitle>FG live stock</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2">Qty</th>
                  <th className="px-3 py-2">Updated</th>
                </tr>
              </thead>
              <tbody>
                {finishedGoods.map(item => (
                  <tr key={item.id} className="border-b border-gray-50">
                    <td className="px-3 py-3 font-medium text-gray-900">{item.product_name}</td>
                    <td className="px-3 py-3">{item.sku || '—'}</td>
                    <td className="px-3 py-3">{item.qty}</td>
                    <td className="px-3 py-3">{new Date(item.updated_at).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
