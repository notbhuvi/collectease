import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createServiceClient } from '@/lib/supabase/server'

export default async function WarehouseReportsPage() {
  const serviceClient = await createServiceClient()
  const [{ data: items }, { data: movements }] = await Promise.all([
    serviceClient.from('warehouse_items').select('*').order('item_name'),
    serviceClient.from('warehouse_movements').select('*'),
  ])

  const movementCountByItem = (movements || []).reduce<Record<string, number>>((acc: Record<string, number>, row: any) => {
    acc[row.item_id] = (acc[row.item_id] || 0) + 1
    return acc
  }, {})

  const lowStock = (items || []).filter((item: any) => Number(item.current_stock || 0) <= Number(item.min_level || 0))
  const deadStock = (items || []).filter((item: any) => !movementCountByItem[item.id])
  const slowMoving = (items || []).filter((item: any) => (movementCountByItem[item.id] || 0) > 0 && (movementCountByItem[item.id] || 0) <= 2)
  const fastMoving = (items || []).filter((item: any) => (movementCountByItem[item.id] || 0) >= 5)
  const totalValue = (items || []).reduce((sum: number, item: any) => sum + Number(item.current_stock || 0) * Number(item.unit_rate || 0), 0)

  const reports = [
    { title: 'Low stock', value: lowStock.length, note: 'Below configured minimum level' },
    { title: 'Dead stock', value: deadStock.length, note: 'No movements recorded' },
    { title: 'Slow moving', value: slowMoving.length, note: '1-2 movements in ledger' },
    { title: 'Fast moving', value: fastMoving.length, note: '5+ movements in ledger' },
    { title: 'Valuation report', value: `₹${Math.round(totalValue).toLocaleString('en-IN')}`, note: 'Current stock x unit rate' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Warehouse Reports" description="Operational report cards for stock risk and valuation." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {reports.map(report => (
          <Card key={report.title}>
            <CardHeader><CardTitle className="text-sm">{report.title}</CardTitle></CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-900">{report.value}</p>
              <p className="mt-1 text-xs text-gray-500">{report.note}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
