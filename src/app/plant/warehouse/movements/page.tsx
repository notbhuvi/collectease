import { PageHeader } from '@/components/layout/page-header'
import { createServiceClient } from '@/lib/supabase/server'
import { WarehouseMovementsManager } from '@/components/plant/warehouse-movements-manager'

export default async function WarehouseMovementsPage() {
  const serviceClient = await createServiceClient()
  const [{ data: items }, { data: movements }] = await Promise.all([
    serviceClient.from('warehouse_items').select('*').order('item_name'),
    serviceClient.from('warehouse_movements').select('*').order('date', { ascending: false }),
  ])

  return (
    <div className="space-y-6">
      <PageHeader title="Warehouse Movements" description="Capture inward, outward, and adjustment entries with a full item ledger." />
      <WarehouseMovementsManager items={items || []} movements={movements || []} />
    </div>
  )
}
