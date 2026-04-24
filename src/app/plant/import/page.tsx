import { PageHeader } from '@/components/layout/page-header'
import { PlantImportClient } from '@/components/plant/plant-import-client'

export default function PlantImportPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Import Data" description="Upload Excel sheets and map legacy production, RM, FG, and warehouse data into Supabase." />
      <PlantImportClient />
    </div>
  )
}
