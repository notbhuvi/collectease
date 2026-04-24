import { NextResponse } from 'next/server'
import { requirePlantAccess } from '@/lib/plant-server'

export async function POST(request: Request) {
  const access = await requirePlantAccess()
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status })

  const body = await request.json()
  if (body.mode === 'material') {
    const { data, error } = await access.serviceClient
      .from('raw_materials')
      .insert({
        material_name: body.material_name,
        unit: body.unit,
        min_level: body.min_level || 0,
      })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ material: data })
  }

  const { data, error } = await access.serviceClient
    .from('raw_material_transactions')
    .insert({
      material_id: body.material_id,
      date: body.date,
      type: body.type,
      qty: body.qty || 0,
      rate: body.rate,
      remarks: body.remarks || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ transaction: data })
}
