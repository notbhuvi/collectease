import { NextResponse } from 'next/server'
import { normalizePlantSku } from '@/lib/plant'
import { requirePlantAccess } from '@/lib/plant-server'

export async function POST(request: Request) {
  const access = await requirePlantAccess()
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status })

  const body = await request.json()
  const normalizedSku = normalizePlantSku(body.product_name, body.sku)
  const { data, error } = await access.serviceClient
    .from('plant_production_logs')
    .insert({
      date: body.date,
      shift: body.shift,
      product_name: body.product_name,
      sku: normalizedSku,
      qty: body.qty || 0,
      unit: body.unit,
      machine: body.machine || null,
      operator: body.operator || null,
      remarks: body.remarks || null,
      created_by: access.user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entry: data })
}

export async function PATCH(request: Request) {
  const access = await requirePlantAccess()
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status })
  const body = await request.json()
  const normalizedSku = normalizePlantSku(body.product_name, body.sku)
  const { data, error } = await access.serviceClient
    .from('plant_production_logs')
    .update({
      date: body.date,
      shift: body.shift,
      product_name: body.product_name,
      sku: normalizedSku,
      qty: body.qty || 0,
      unit: body.unit,
      machine: body.machine || null,
      operator: body.operator || null,
      remarks: body.remarks || null,
    })
    .eq('id', body.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entry: data })
}

export async function DELETE(request: Request) {
  const access = await requirePlantAccess()
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status })
  const body = await request.json()
  const { error } = await access.serviceClient.from('plant_production_logs').delete().eq('id', body.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
