import { format, parseISO, startOfMonth, subDays } from 'date-fns'
import type {
  FgDispatch,
  FinishedGoodsStock,
  PlantProductionLog,
  RawMaterial,
  RawMaterialTransaction,
  WarehouseItem,
  WarehouseMovement,
} from '@/types'

export const PLANT_ROLES = ['admin', 'plant_ops'] as const

export function formatNumber(value: number, digits = 0) {
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

export function parseNumeric(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '').trim()
    const numeric = Number(cleaned)
    return Number.isFinite(numeric) ? numeric : 0
  }
  return 0
}

export function normalizePlantSku(productName: unknown, sku?: unknown) {
  const explicitSku = typeof sku === 'string' ? sku.trim() : ''
  if (explicitSku) return explicitSku

  const normalizedName = typeof productName === 'string' ? productName.trim() : ''
  if (!normalizedName) return null

  const slug = normalizedName
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)

  return slug ? `FG-${slug}` : null
}

export function dedupeFinishedGoodsStock(items: FinishedGoodsStock[]) {
  const latestByKey = new Map<string, FinishedGoodsStock>()

  for (const item of items) {
    const key = normalizePlantSku(item.product_name, item.sku) || item.id
    const existing = latestByKey.get(key)

    if (!existing || new Date(item.updated_at).getTime() >= new Date(existing.updated_at).getTime()) {
      latestByKey.set(key, {
        ...item,
        sku: normalizePlantSku(item.product_name, item.sku),
      })
    }
  }

  return [...latestByKey.values()].sort((a, b) => (
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  ))
}

export function normalizeDate(value: unknown) {
  if (!value) return new Date().toISOString().slice(0, 10)
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
    const parsed = new Date(trimmed)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10)
    }
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  if (typeof value === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30))
    excelEpoch.setUTCDate(excelEpoch.getUTCDate() + value)
    return excelEpoch.toISOString().slice(0, 10)
  }
  return new Date().toISOString().slice(0, 10)
}

export function aggregateRawMaterialStock(
  materials: RawMaterial[],
  transactions: RawMaterialTransaction[]
) {
  return materials.map(material => {
    const ledger = transactions.filter(txn => txn.material_id === material.id)
    const balance = ledger.reduce((sum, row) => {
      if (row.type === 'opening' || row.type === 'inward') return sum + Number(row.qty || 0)
      if (row.type === 'consumed') return sum - Number(row.qty || 0)
      return sum + Number(row.qty || 0)
    }, 0)
    const latestRate = [...ledger]
      .reverse()
      .find(row => typeof row.rate === 'number' && Number(row.rate) > 0)?.rate || 0
    return {
      ...material,
      current_stock: balance,
      stock_value: balance * Number(latestRate || 0),
      low_stock: balance <= Number(material.min_level || 0),
    }
  })
}

export function buildPlantDashboardData(args: {
  productionLogs: PlantProductionLog[]
  rawMaterials: RawMaterial[]
  rawTransactions: RawMaterialTransaction[]
  finishedGoods: FinishedGoodsStock[]
  dispatches: FgDispatch[]
  warehouseItems: WarehouseItem[]
  warehouseMovements: WarehouseMovement[]
}) {
  const today = new Date().toISOString().slice(0, 10)
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')

  const productionToday = args.productionLogs
    .filter(row => row.date === today)
    .reduce((sum, row) => sum + Number(row.qty || 0), 0)

  const productionMonth = args.productionLogs
    .filter(row => row.date >= monthStart)
    .reduce((sum, row) => sum + Number(row.qty || 0), 0)

  const rmBalances = aggregateRawMaterialStock(args.rawMaterials, args.rawTransactions)
  const rmStockValue = rmBalances.reduce((sum, row) => sum + row.stock_value, 0)
  const fgStockQty = args.finishedGoods.reduce((sum, row) => sum + Number(row.qty || 0), 0)
  const warehouseStockValue = args.warehouseItems
    .reduce((sum, row) => sum + Number(row.current_stock || 0) * Number(row.unit_rate || 0), 0)
  const dispatchToday = args.dispatches
    .filter(row => row.date === today && row.status !== 'cancelled')
    .reduce((sum, row) => sum + Number(row.qty || 0), 0)
  const lowStockItems = [
    ...rmBalances.filter(row => row.low_stock).map(row => ({ type: 'RM', name: row.material_name, value: row.current_stock, min: row.min_level })),
    ...args.warehouseItems
      .filter(row => Number(row.current_stock || 0) <= Number(row.min_level || 0))
      .map(row => ({ type: 'WH', name: row.item_name, value: row.current_stock, min: row.min_level })),
  ]
  const pendingDispatches = args.dispatches.filter(row => row.status === 'pending').length

  const trendDays = Array.from({ length: 14 }, (_, index) => {
    const date = format(subDays(new Date(), 13 - index), 'yyyy-MM-dd')
    const produced = args.productionLogs
      .filter(row => row.date === date)
      .reduce((sum, row) => sum + Number(row.qty || 0), 0)
    const dispatched = args.dispatches
      .filter(row => row.date === date && row.status !== 'cancelled')
      .reduce((sum, row) => sum + Number(row.qty || 0), 0)
    const rmConsumed = args.rawTransactions
      .filter(row => row.date === date && row.type === 'consumed')
      .reduce((sum, row) => sum + Number(row.qty || 0), 0)
    return {
      date,
      label: format(parseISO(date), 'dd MMM'),
      production: produced,
      dispatch: dispatched,
      rmConsumption: rmConsumed,
    }
  })

  const topProducts = Object.entries(
    args.productionLogs.reduce<Record<string, number>>((acc, row) => {
      const key = row.product_name || row.sku || 'Unknown'
      acc[key] = (acc[key] || 0) + Number(row.qty || 0)
      return acc
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, qty]) => ({ name, qty }))

  const stockCategorySplit = Object.entries(
    args.warehouseItems.reduce<Record<string, number>>((acc, row) => {
      const key = row.category || 'Uncategorized'
      acc[key] = (acc[key] || 0) + Number(row.current_stock || 0)
      return acc
    }, {})
  ).map(([name, value]) => ({ name, value }))

  return {
    cards: {
      todayProduction: productionToday,
      monthlyProduction: productionMonth,
      rmStockValue,
      fgStockQty,
      warehouseStockValue,
      dispatchToday,
      lowStockItems: lowStockItems.length,
      pendingDispatches,
    },
    trendDays,
    topProducts,
    stockCategorySplit,
    lowStockItems,
    rmBalances,
  }
}

export const samplePlantImportData = {
  production: [
    {
      date: '2026-04-22',
      shift: 'A',
      product_name: 'Castable Mix 45',
      sku: 'FG-CM45',
      qty: 18,
      unit: 'MT',
      machine: 'Mixer-2',
      operator: 'Rahul',
      remarks: 'Stable batch output',
    },
    {
      date: '2026-04-23',
      shift: 'B',
      product_name: 'Ramming Mass 60',
      sku: 'FG-RM60',
      qty: 12,
      unit: 'MT',
      machine: 'Line-1',
      operator: 'Arun',
      remarks: '',
    },
  ],
  rawMaterials: [
    { material_name: 'Bauxite', unit: 'MT', min_level: 25 },
    { material_name: 'Silica Sand', unit: 'MT', min_level: 15 },
  ],
  rawTransactions: [
    { material_name: 'Bauxite', date: '2026-04-01', type: 'opening', qty: 80, rate: 4200, remarks: 'Opening stock' },
    { material_name: 'Bauxite', date: '2026-04-23', type: 'consumed', qty: 18, rate: 4200, remarks: 'Used in production' },
    { material_name: 'Silica Sand', date: '2026-04-01', type: 'opening', qty: 40, rate: 2800, remarks: 'Opening stock' },
  ],
  dispatches: [
    {
      date: '2026-04-24',
      customer_name: 'Jindal Steels',
      invoice_no: 'INV-PL-2401',
      truck_no: 'OD09AB1234',
      destination: 'Raigarh',
      product_name: 'Castable Mix 45',
      sku: 'FG-CM45',
      qty: 6,
      remarks: 'Morning dispatch',
      status: 'completed',
    },
  ],
  warehouseItems: [
    {
      item_name: 'Packing Bags 25kg',
      sku: 'WH-PB25',
      category: 'Packing',
      unit: 'Nos',
      opening_stock: 1500,
      reserved_stock: 250,
      min_level: 400,
      unit_rate: 12,
    },
    {
      item_name: 'Wooden Pallets',
      sku: 'WH-WP01',
      category: 'Stores',
      unit: 'Nos',
      opening_stock: 180,
      reserved_stock: 20,
      min_level: 40,
      unit_rate: 450,
    },
  ],
  warehouseMovements: [
    {
      item_sku: 'WH-PB25',
      date: '2026-04-22',
      type: 'outward',
      qty: 120,
      reference_no: 'PRD-240422',
      remarks: 'Issued to production',
    },
  ],
}
