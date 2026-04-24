import { PageHeader } from '@/components/layout/page-header'
import { createServiceClient } from '@/lib/supabase/server'
import { RawMaterialsManager } from '@/components/plant/raw-materials-manager'
import { aggregateRawMaterialStock } from '@/lib/plant'

export default async function PlantRawMaterialsPage() {
  const serviceClient = await createServiceClient()
  const [{ data: materials }, { data: transactions }] = await Promise.all([
    serviceClient.from('raw_materials').select('*').order('material_name'),
    serviceClient.from('raw_material_transactions').select('*').order('date', { ascending: false }),
  ])

  const balances = aggregateRawMaterialStock(materials || [], transactions || [])

  return (
    <div className="space-y-6">
      <PageHeader title="Raw Materials" description="Material master, inward, consumption, adjustments, and ledger view." />
      <RawMaterialsManager
        materials={materials || []}
        transactions={transactions || []}
        balances={balances}
      />
    </div>
  )
}
