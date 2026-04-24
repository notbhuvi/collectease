import { NextResponse } from 'next/server'
import { normalizeDate, normalizePlantSku, parseNumeric, samplePlantImportData } from '@/lib/plant'
import { requirePlantAccess } from '@/lib/plant-server'

type ImportRow = Record<string, unknown>

type ImportPayload = {
  production?: ImportRow[]
  rawMaterials?: ImportRow[]
  rawTransactions?: ImportRow[]
  finishedGoods?: ImportRow[]
  dispatches?: ImportRow[]
  warehouseItems?: ImportRow[]
  warehouseMovements?: ImportRow[]
}

function pick(row: ImportRow, keys: string[]) {
  for (const key of keys) {
    const exact = row[key]
    if (exact !== undefined && exact !== '') return exact
    const foundKey = Object.keys(row).find(column => column.toLowerCase().trim() === key.toLowerCase())
    if (foundKey && row[foundKey] !== '') return row[foundKey]
  }
  return ''
}

export async function POST(request: Request) {
  const access = await requirePlantAccess()
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status })

  const body = await request.json() as { sample?: boolean; payload?: ImportPayload }
  const payload: ImportPayload = body.sample ? samplePlantImportData : (body.payload || {})
  const summary: string[] = []

  const productionRows = (payload.production || []).map(row => ({
    date: normalizeDate(pick(row, ['date', 'production date'])),
    shift: pick(row, ['shift']) || 'General',
    product_name: pick(row, ['product_name', 'product', 'item']) || 'Imported Product',
    sku: normalizePlantSku(
      String(pick(row, ['product_name', 'product', 'item']) || 'Imported Product'),
      pick(row, ['sku', 'item code'])
    ),
    qty: parseNumeric(pick(row, ['qty', 'quantity', 'production qty'])),
    unit: pick(row, ['unit']) || 'Nos',
    machine: pick(row, ['machine']) || null,
    operator: pick(row, ['operator']) || null,
    remarks: pick(row, ['remarks']) || null,
    created_by: access.user.id,
  })).filter(row => row.qty > 0)

  if (productionRows.length > 0) {
    const { error } = await access.serviceClient.from('plant_production_logs').insert(productionRows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    summary.push(`Production rows imported: ${productionRows.length}`)
  }

  const materialMap = new Map<string, string>()
  const { data: existingMaterials } = await access.serviceClient.from('raw_materials').select('id, material_name')
  ;(existingMaterials || []).forEach((row: { id: string; material_name: string }) => {
    materialMap.set(String(row.material_name).toLowerCase(), row.id)
  })

  const rawMasterRows = (payload.rawMaterials || []).filter(row => pick(row, ['material_name', 'material']))
  for (const row of rawMasterRows) {
    const materialName = String(pick(row, ['material_name', 'material']))
    if (!materialMap.has(materialName.toLowerCase())) {
      const { data } = await access.serviceClient
        .from('raw_materials')
        .insert({
          material_name: materialName,
          unit: pick(row, ['unit']) || 'kg',
          min_level: parseNumeric(pick(row, ['min_level', 'min'])),
        })
        .select('id, material_name')
        .single()
      if (data) materialMap.set(String(data.material_name).toLowerCase(), data.id)
    }
  }

  const rawTxnRows = (payload.rawTransactions || []).map(row => {
    const materialName = String(pick(row, ['material_name', 'material'])).trim()
    return {
      materialName,
      record: {
        material_id: materialMap.get(materialName.toLowerCase()) || null,
        date: normalizeDate(pick(row, ['date'])),
        type: pick(row, ['type']) || 'inward',
        qty: parseNumeric(pick(row, ['qty', 'quantity'])),
        rate: parseNumeric(pick(row, ['rate'])),
        remarks: pick(row, ['remarks']) || null,
      },
    }
  }).filter(row => row.record.material_id && row.record.qty > 0)

  if (rawTxnRows.length > 0) {
    const { error } = await access.serviceClient.from('raw_material_transactions').insert(rawTxnRows.map(row => row.record))
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    summary.push(`RM transactions imported: ${rawTxnRows.length}`)
  }

  const dispatchRows = (payload.dispatches || []).map(row => ({
    date: normalizeDate(pick(row, ['date', 'dispatch date'])),
    customer_name: pick(row, ['customer_name', 'customer']) || 'Imported Customer',
    invoice_no: pick(row, ['invoice_no', 'invoice']) || null,
    truck_no: pick(row, ['truck_no', 'truck']) || null,
    destination: pick(row, ['destination']) || null,
    product_name: pick(row, ['product_name', 'product']) || 'Imported Product',
    sku: normalizePlantSku(
      String(pick(row, ['product_name', 'product']) || 'Imported Product'),
      pick(row, ['sku', 'item code'])
    ),
    qty: parseNumeric(pick(row, ['qty', 'quantity'])),
    remarks: pick(row, ['remarks']) || null,
    status: pick(row, ['status']) || 'completed',
  })).filter(row => row.qty > 0)

  if (dispatchRows.length > 0) {
    const { error } = await access.serviceClient.from('fg_dispatches').insert(dispatchRows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    summary.push(`Dispatch rows imported: ${dispatchRows.length}`)
  }

  const finishedGoodsRows = (payload.finishedGoods || []).map(row => ({
    product_name: pick(row, ['product_name', 'product']) || 'Imported Product',
    sku: normalizePlantSku(
      String(pick(row, ['product_name', 'product']) || 'Imported Product'),
      pick(row, ['sku', 'item code'])
    ),
    qty: parseNumeric(pick(row, ['qty', 'quantity', 'closing_stock', 'stock'])),
    updated_at: new Date().toISOString(),
  })).filter(row => row.qty >= 0 && row.sku)

  if (finishedGoodsRows.length > 0) {
    const { error } = await access.serviceClient
      .from('finished_goods_stock')
      .upsert(finishedGoodsRows, { onConflict: 'sku' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    summary.push(`FG stock rows imported: ${finishedGoodsRows.length}`)
  }

  const itemRows = (payload.warehouseItems || []).map(row => ({
    item_name: pick(row, ['item_name', 'item']) || 'Imported Item',
    sku: pick(row, ['sku', 'item code']) || null,
    category: pick(row, ['category']) || null,
    unit: pick(row, ['unit']) || 'Nos',
    opening_stock: parseNumeric(pick(row, ['opening_stock', 'opening', 'current_stock', 'stock'])),
    current_stock: parseNumeric(pick(row, ['current_stock', 'stock'])) || parseNumeric(pick(row, ['opening_stock', 'opening'])),
    reserved_stock: parseNumeric(pick(row, ['reserved_stock', 'reserved'])),
    min_level: parseNumeric(pick(row, ['min_level', 'min'])),
    unit_rate: parseNumeric(pick(row, ['unit_rate', 'rate', 'value'])),
  })).filter(row => row.item_name)

  if (itemRows.length > 0) {
    const { error } = await access.serviceClient
      .from('warehouse_items')
      .upsert(itemRows, { onConflict: 'sku' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    summary.push(`Warehouse items imported: ${itemRows.length}`)
  }

  const { data: warehouseItems } = await access.serviceClient.from('warehouse_items').select('id, sku')
  const warehouseMap = new Map<string, string>()
  ;(warehouseItems || []).forEach((row: { id: string; sku: string | null }) => {
    if (row.sku) warehouseMap.set(String(row.sku).toLowerCase(), row.id)
  })

  const movementRows = (payload.warehouseMovements || []).map(row => ({
    item_id: warehouseMap.get(String(pick(row, ['item_sku', 'sku', 'item code'])).toLowerCase()) || null,
    date: normalizeDate(pick(row, ['date'])),
    type: pick(row, ['type']) || 'adjustment',
    qty: parseNumeric(pick(row, ['qty', 'quantity'])),
    reference_no: pick(row, ['reference_no', 'reference']) || null,
    remarks: pick(row, ['remarks']) || null,
  })).filter(row => row.item_id && row.qty > 0)

  if (movementRows.length > 0) {
    const { error } = await access.serviceClient.from('warehouse_movements').insert(movementRows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    summary.push(`Warehouse movements imported: ${movementRows.length}`)
  }

  return NextResponse.json({ success: true, summary })
}
