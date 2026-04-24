import { PageHeader } from '@/components/layout/page-header'
import { dedupeFinishedGoodsStock } from '@/lib/plant'
import { createServiceClient } from '@/lib/supabase/server'
import { DispatchManager } from '@/components/plant/dispatch-manager'
import type { FinishedGoodsStock } from '@/types'

export default async function DispatchPage() {
  const serviceClient = await createServiceClient()
  const [{ data: dispatches }, { data: finishedGoods }] = await Promise.all([
    serviceClient.from('fg_dispatches').select('*').order('date', { ascending: false }),
    serviceClient.from('finished_goods_stock').select('*').order('product_name'),
  ])
  const dedupedFinishedGoods = dedupeFinishedGoodsStock((finishedGoods || []) as FinishedGoodsStock[])

  return (
    <div className="space-y-6">
      <PageHeader title="Dispatch" description="Create dispatches and keep FG stock in sync." />
      <DispatchManager dispatches={dispatches || []} finishedGoods={dedupedFinishedGoods} />
    </div>
  )
}
