import { NextResponse } from 'next/server'
import { normalizePlantSku } from '@/lib/plant'
import { requirePlantAccess } from '@/lib/plant-server'

export async function POST(request: Request) {
  const access = await requirePlantAccess()
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status })
  const body = await request.json()
  const normalizedSku = normalizePlantSku(body.product_name, body.sku)
  const { data, error } = await access.serviceClient
    .from('fg_dispatches')
    .insert({
      date: body.date,
      customer_name: body.customer_name,
      invoice_no: body.invoice_no || null,
      truck_no: body.truck_no || null,
      destination: body.destination || null,
      product_name: body.product_name,
      sku: normalizedSku,
      qty: body.qty || 0,
      remarks: body.remarks || null,
      status: body.status || 'completed',
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ dispatch: data })
}

export async function PATCH(request: Request) {
  const access = await requirePlantAccess()
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status })
  const body = await request.json()
  const { data, error } = await access.serviceClient
    .from('fg_dispatches')
    .update({ status: body.status })
    .eq('id', body.id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ dispatch: data })
}
