import * as XLSX from 'xlsx'

export type PlantImportPayload = {
  production: Record<string, unknown>[]
  rawMaterials: Record<string, unknown>[]
  rawTransactions: Record<string, unknown>[]
  finishedGoods: Record<string, unknown>[]
  dispatches: Record<string, unknown>[]
  warehouseItems: Record<string, unknown>[]
  warehouseMovements: Record<string, unknown>[]
}

type ParseResult = {
  payload: PlantImportPayload
  notes: string[]
}

function createPayload(): PlantImportPayload {
  return {
    production: [],
    rawMaterials: [],
    rawTransactions: [],
    finishedGoods: [],
    dispatches: [],
    warehouseItems: [],
    warehouseMovements: [],
  }
}

function asRows(sheet: XLSX.WorkSheet) {
  return XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(sheet, {
    header: 1,
    defval: '',
    raw: true,
  })
}

function asText(value: unknown) {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return ''
}

function asNumber(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '').trim()
    const numeric = Number(cleaned)
    return Number.isFinite(numeric) ? numeric : 0
  }
  return 0
}

function normalizeName(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function slugify(value: string, prefix: string) {
  const core = value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)

  return `${prefix}-${core || 'ITEM'}`
}

function extractDate(rows: unknown[][]) {
  for (const row of rows) {
    for (let index = 0; index < row.length; index += 1) {
      if (asText(row[index]).toUpperCase() === 'DATE') {
        for (let offset = row.length - 1; offset > index; offset -= 1) {
          const candidate = asText(row[offset])
          if (candidate) return candidate
        }
      }
    }
  }

  return new Date().toISOString().slice(0, 10)
}

function mergePayload(target: PlantImportPayload, source: PlantImportPayload) {
  target.production.push(...source.production)
  target.rawMaterials.push(...source.rawMaterials)
  target.rawTransactions.push(...source.rawTransactions)
  target.finishedGoods.push(...source.finishedGoods)
  target.dispatches.push(...source.dispatches)
  target.warehouseItems.push(...source.warehouseItems)
  target.warehouseMovements.push(...source.warehouseMovements)
}

function parseProductionSheet(rows: unknown[][]) {
  const date = extractDate(rows)
  const parsed: Record<string, unknown>[] = []

  for (let index = 7; index < rows.length; index += 1) {
    const row = rows[index] || []
    const productName = normalizeName(asText(row[0]))

    if (!productName || /^TOTAL PRODUCTION/i.test(productName) || /^CONSUMPTION/i.test(productName)) break

    parsed.push({
      date,
      shift: 'General',
      product_name: productName,
      sku: slugify(productName, 'FG'),
      qty: asNumber(row[1]),
      unit: 'MT',
      remarks: normalizeName(asText(row[3])) || null,
    })
  }

  return parsed.filter(row => asNumber(row.qty) > 0)
}

function parseRawMaterialSheet(rows: unknown[][]) {
  const date = extractDate(rows)
  const materialMap = new Map<string, Record<string, unknown>>()
  const transactions: Record<string, unknown>[] = []

  for (let index = 8; index < rows.length; index += 1) {
    const row = rows[index] || []
    const materialName = normalizeName(asText(row[0]))

    if (!materialName || /^TOTAL$/i.test(materialName)) break

    const key = materialName.toLowerCase()
    if (!materialMap.has(key)) {
      materialMap.set(key, {
        material_name: materialName,
        unit: 'MT',
        min_level: 0,
      })
    }

    const openingQty = asNumber(row[3])
    const receivedQty = asNumber(row[4])
    const consumedQty = asNumber(row[1])
    const closingQty = asNumber(row[6])
    const stockDays = asText(row[7])

    if (openingQty > 0) {
      transactions.push({
        material_name: materialName,
        date,
        type: 'opening',
        qty: openingQty,
        remarks: `Imported opening stock${closingQty > 0 ? `, closing ${closingQty} MT` : ''}`,
      })
    }

    if (receivedQty > 0) {
      transactions.push({
        material_name: materialName,
        date,
        type: 'inward',
        qty: receivedQty,
        remarks: 'Imported received quantity',
      })
    }

    if (consumedQty > 0) {
      transactions.push({
        material_name: materialName,
        date,
        type: 'consumed',
        qty: consumedQty,
        remarks: stockDays ? `Imported daily consumption, stock days ${stockDays}` : 'Imported daily consumption',
      })
    }
  }

  return {
    rawMaterials: [...materialMap.values()],
    rawTransactions: transactions,
  }
}

function parseFinishedGoodsSheet(rows: unknown[][]) {
  const date = extractDate(rows)
  const finishedGoods: Record<string, unknown>[] = []
  const dispatches: Record<string, unknown>[] = []

  for (let index = 8; index < rows.length; index += 1) {
    const row = rows[index] || []
    const productName = normalizeName(asText(row[0]))

    if (!productName) continue

    const sku = slugify(productName, 'FG')
    const onDateDispatch = asNumber(row[1])
    const closingStock = asNumber(row[6])
    const remarks = normalizeName(asText(row[7])) || null

    finishedGoods.push({
      date,
      product_name: productName,
      sku,
      qty: closingStock,
      remarks,
    })

    if (onDateDispatch > 0) {
      dispatches.push({
        date,
        customer_name: 'Imported Dispatch',
        invoice_no: null,
        truck_no: null,
        destination: null,
        product_name: productName,
        sku,
        qty: onDateDispatch,
        remarks,
        status: 'completed',
      })
    }
  }

  return {
    finishedGoods: finishedGoods.filter(row => asNumber(row.qty) > 0),
    dispatches,
  }
}

function parseWarehouseSummary(rows: unknown[][]) {
  const items: Record<string, unknown>[] = []
  let currentBrand = ''

  for (let index = 5; index < rows.length; index += 1) {
    const row = rows[index] || []
    const serial = asText(row[0])
    const brandCell = normalizeName(asText(row[1]))
    const unit = normalizeName(asText(row[2])).toUpperCase()
    const size = normalizeName(asText(row[3]))
    const remarks = normalizeName(asText(row[20])) || null

    if (brandCell) currentBrand = brandCell

    if (!serial && !brandCell && !size && !unit) continue
    if (!currentBrand || !unit) continue

    const itemName = normalizeName(`${currentBrand} ${size}`.trim())
    const currentStock = unit === 'PCS' ? asNumber(row[11]) : asNumber(row[12] || row[11])

    if (currentStock <= 0) continue

    items.push({
      item_name: itemName,
      sku: slugify(itemName, 'WH'),
      category: unit === 'PCS' ? 'Bricks' : 'Monolithic',
      unit,
      opening_stock: currentStock,
      current_stock: currentStock,
      reserved_stock: 0,
      min_level: 0,
      unit_rate: 0,
      remarks,
    })
  }

  return items
}

function parseLegacyPlantWorkbook(fileName: string, workbook: XLSX.WorkBook): ParseResult | null {
  const payload = createPayload()
  const notes: string[] = []

  if (workbook.SheetNames.includes('PRODUCTION')) {
    const rows = asRows(workbook.Sheets.PRODUCTION)
    const parsed = parseProductionSheet(rows)
    payload.production.push(...parsed)
    notes.push(`${fileName}: production rows ${parsed.length}`)
  }

  if (workbook.SheetNames.includes('RM CONSUMPTION')) {
    const rows = asRows(workbook.Sheets['RM CONSUMPTION'])
    const parsed = parseRawMaterialSheet(rows)
    payload.rawMaterials.push(...parsed.rawMaterials)
    payload.rawTransactions.push(...parsed.rawTransactions)
    notes.push(`${fileName}: RM materials ${parsed.rawMaterials.length}, transactions ${parsed.rawTransactions.length}`)
  }

  if (workbook.SheetNames.includes('FG DESP & STOCK')) {
    const rows = asRows(workbook.Sheets['FG DESP & STOCK'])
    const parsed = parseFinishedGoodsSheet(rows)
    payload.finishedGoods.push(...parsed.finishedGoods)
    payload.dispatches.push(...parsed.dispatches)
    notes.push(`${fileName}: FG stock rows ${parsed.finishedGoods.length}, dispatch rows ${parsed.dispatches.length}`)
  }

  if (workbook.SheetNames.includes('SUMMARY')) {
    const rows = asRows(workbook.Sheets.SUMMARY)
    const parsed = parseWarehouseSummary(rows)
    payload.warehouseItems.push(...parsed)
    notes.push(`${fileName}: warehouse items ${parsed.length}`)
  }

  const hasParsedRows = Object.values(payload).some(rows => rows.length > 0)
  return hasParsedRows ? { payload, notes } : null
}

function matchSheetTarget(name: string) {
  const value = name.toLowerCase()
  if (value.includes('production')) return 'production'
  if (value.includes('rm') || value.includes('raw')) return 'raw'
  if (value.includes('dispatch') || value.includes('fg')) return 'fg'
  if (value.includes('stock') || value.includes('item')) return 'warehouse'
  return 'unknown'
}

function parseGenericWorkbook(fileName: string, workbook: XLSX.WorkBook): ParseResult {
  const payload = createPayload()
  const notes: string[] = []

  workbook.SheetNames.forEach(sheetName => {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: '' })
    const target = matchSheetTarget(sheetName)
    notes.push(`${fileName}: ${sheetName} (${rows.length} rows)`)

    if (target === 'production') payload.production.push(...rows)
    if (target === 'raw') payload.rawTransactions.push(...rows)
    if (target === 'fg') payload.dispatches.push(...rows)
    if (target === 'warehouse') payload.warehouseItems.push(...rows)
  })

  return { payload, notes }
}

export function parsePlantWorkbook(fileName: string, workbook: XLSX.WorkBook): ParseResult {
  return parseLegacyPlantWorkbook(fileName, workbook) || parseGenericWorkbook(fileName, workbook)
}

export function mergePlantImportPayload(parts: ParseResult[]) {
  const payload = createPayload()
  const notes: string[] = []

  for (const part of parts) {
    mergePayload(payload, part.payload)
    notes.push(...part.notes)
  }

  return { payload, notes }
}
