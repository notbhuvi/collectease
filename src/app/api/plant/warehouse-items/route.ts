import { NextResponse } from 'next/server'
import { requirePlantAccess } from '@/lib/plant-server'

export async function POST(request: Request) {
  const access = await requirePlantAccess()
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status })
  const body = await request.json()
  const currentStock = Number(body.opening_stock || 0)
  const { data, error } = await access.serviceClient
    .from('warehouse_items')
    .insert({
      item_name: body.item_name,
      sku: body.sku || null,
      category: body.category || null,
      unit: body.unit,
      opening_stock: currentStock,
      current_stock: currentStock,
      reserved_stock: body.reserved_stock || 0,
      min_level: body.min_level || 0,
      unit_rate: body.unit_rate || 0,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}

export async function PATCH(request: Request) {
  const access = await requirePlantAccess()
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status })
  const body = await request.json()
  const { data: existing } = await access.serviceClient.from('warehouse_items').select('current_stock, opening_stock').eq('id', body.id).single()
  const nextCurrent = Number(existing?.current_stock || 0) - Number(existing?.opening_stock || 0) + Number(body.opening_stock || 0)
  const { data, error } = await access.serviceClient
    .from('warehouse_items')
    .update({
      item_name: body.item_name,
      sku: body.sku || null,
      category: body.category || null,
      unit: body.unit,
      opening_stock: body.opening_stock || 0,
      current_stock: nextCurrent,
      reserved_stock: body.reserved_stock || 0,
      min_level: body.min_level || 0,
      unit_rate: body.unit_rate || 0,
    })
    .eq('id', body.id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}

export async function DELETE(request: Request) {
  const access = await requirePlantAccess()
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status })
  const body = await request.json()
  await access.serviceClient.from('warehouse_movements').delete().eq('item_id', body.id)
  const { error } = await access.serviceClient.from('warehouse_items').delete().eq('id', body.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
