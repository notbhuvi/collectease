import Link from 'next/link'
import { PageHeader } from '@/components/layout/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, Boxes, IndianRupee, Package2, Truck, AlertTriangle, ClipboardList, Factory } from 'lucide-react'
import { createServiceClient } from '@/lib/supabase/server'
import { buildPlantDashboardData, dedupeFinishedGoodsStock, formatCurrency, formatNumber } from '@/lib/plant'
import { PlantDashboardCharts } from '@/components/plant/plant-dashboard-charts'
import type { FinishedGoodsStock } from '@/types'

export default async function PlantPage() {
  const serviceClient = await createServiceClient()
  const [
    { data: productionLogs },
    { data: rawMaterials },
    { data: rawTransactions },
    { data: finishedGoods },
    { data: dispatches },
    { data: warehouseItems },
    { data: warehouseMovements },
  ] = await Promise.all([
    serviceClient.from('plant_production_logs').select('*').order('date', { ascending: false }),
    serviceClient.from('raw_materials').select('*').order('material_name'),
    serviceClient.from('raw_material_transactions').select('*').order('date', { ascending: false }),
    serviceClient.from('finished_goods_stock').select('*').order('updated_at', { ascending: false }),
    serviceClient.from('fg_dispatches').select('*').order('date', { ascending: false }),
    serviceClient.from('warehouse_items').select('*').order('item_name'),
    serviceClient.from('warehouse_movements').select('*').order('date', { ascending: false }),
  ])

  const dashboard = buildPlantDashboardData({
    productionLogs: productionLogs || [],
    rawMaterials: rawMaterials || [],
    rawTransactions: rawTransactions || [],
    finishedGoods: dedupeFinishedGoodsStock((finishedGoods || []) as FinishedGoodsStock[]),
    dispatches: dispatches || [],
    warehouseItems: warehouseItems || [],
    warehouseMovements: warehouseMovements || [],
  })

  const cards = [
    { title: 'Today Production', value: formatNumber(dashboard.cards.todayProduction), subtitle: 'today output', icon: <Factory className="h-5 w-5" /> },
    { title: 'Monthly Production', value: formatNumber(dashboard.cards.monthlyProduction), subtitle: 'current month', icon: <Activity className="h-5 w-5" /> },
    { title: 'RM Stock Value', value: formatCurrency(dashboard.cards.rmStockValue), subtitle: 'live valuation', icon: <IndianRupee className="h-5 w-5" /> },
    { title: 'FG Stock Qty', value: formatNumber(dashboard.cards.fgStockQty), subtitle: 'finished goods', icon: <Package2 className="h-5 w-5" /> },
    { title: 'Warehouse Stock Value', value: formatCurrency(dashboard.cards.warehouseStockValue), subtitle: 'stores + inventory', icon: <Boxes className="h-5 w-5" /> },
    { title: 'Dispatch Today', value: formatNumber(dashboard.cards.dispatchToday), subtitle: 'qty moved', icon: <Truck className="h-5 w-5" /> },
    { title: 'Low Stock Items', value: formatNumber(dashboard.cards.lowStockItems), subtitle: 'requires action', icon: <AlertTriangle className="h-5 w-5" /> },
    { title: 'Pending Dispatches', value: formatNumber(dashboard.cards.pendingDispatches), subtitle: 'awaiting completion', icon: <ClipboardList className="h-5 w-5" /> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plant & Warehouse Dashboard"
        description="Combined production, stock, dispatch, and warehouse control center."
        actions={
          <div className="flex gap-2">
            <Link href="/plant/import" className="inline-flex items-center rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 transition hover:bg-gray-50">
              Import Data
            </Link>
            <Link href="/plant/production" className="inline-flex items-center rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-700">
              Add Production
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(card => (
          <StatCard key={card.title} title={card.title} value={card.value} subtitle={card.subtitle} icon={card.icon} className="border-gray-200" />
        ))}
      </div>

      <PlantDashboardCharts
        trendDays={dashboard.trendDays}
        topProducts={dashboard.topProducts}
        stockCategorySplit={dashboard.stockCategorySplit}
      />

      <Card>
        <CardHeader><CardTitle>Low stock watchlist</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {dashboard.lowStockItems.length === 0 && (
              <p className="text-sm text-gray-500">No low stock alerts right now.</p>
            )}
            {dashboard.lowStockItems.map(item => (
              <div key={`${item.type}-${item.name}`} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm font-semibold text-amber-900">{item.name}</p>
                <p className="mt-1 text-xs text-amber-700">{item.type} current: {item.value} · min: {item.min}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
