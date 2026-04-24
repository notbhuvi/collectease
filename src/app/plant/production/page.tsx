import { PageHeader } from '@/components/layout/page-header'
import { createServiceClient } from '@/lib/supabase/server'
import { ProductionManager } from '@/components/plant/production-manager'

export default async function PlantProductionPage() {
  const serviceClient = await createServiceClient()
  const { data } = await serviceClient.from('plant_production_logs').select('*').order('date', { ascending: false })

  return (
    <div className="space-y-6">
      <PageHeader title="Production" description="Track output by shift, machine, product, and operator." />
      <ProductionManager entries={data || []} />
    </div>
  )
}
