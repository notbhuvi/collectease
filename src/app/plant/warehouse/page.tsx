import { PageHeader } from '@/components/layout/page-header'
import { createServiceClient } from '@/lib/supabase/server'
import { WarehouseStockManager } from '@/components/plant/warehouse-stock-manager'

export default async function WarehousePage() {
  const serviceClient = await createServiceClient()
  const { data } = await serviceClient.from('warehouse_items').select('*').order('item_name')

  return (
    <div className="space-y-6">
      <PageHeader title="Warehouse Stock" description="SKU-wise stock, reserved stock, and free stock view." />
      <WarehouseStockManager items={data || []} />
    </div>
  )
}
