import { NextResponse } from 'next/server'
import { requirePlantAccess } from '@/lib/plant-server'

export async function POST(request: Request) {
  const access = await requirePlantAccess()
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status })
  const body = await request.json()
  const { data, error } = await access.serviceClient
    .from('warehouse_movements')
    .insert({
      item_id: body.item_id,
      date: body.date,
      type: body.type,
      qty: body.qty || 0,
      reference_no: body.reference_no || null,
      remarks: body.remarks || null,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ movement: data })
}
