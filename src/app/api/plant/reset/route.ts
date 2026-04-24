import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getOrCreateProfileForUser } from '@/lib/profile'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = await createServiceClient()
  const profile = await getOrCreateProfileForUser(serviceClient, user, 'role')
  if (!profile || (profile.role !== 'admin' && profile.role !== 'plant_ops')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const password = body?.password
  if (!password || !user.email) {
    return NextResponse.json({ error: 'Password is required' }, { status: 400 })
  }

  const verify = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  })
  if (verify.error) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
  }

  const tables = [
    'warehouse_movements',
    'fg_dispatches',
    'plant_production_logs',
    'raw_material_transactions',
    'finished_goods_stock',
    'warehouse_items',
    'raw_materials',
  ] as const

  let cleared = 0

  for (const table of tables) {
    const { data: rows, error: selectError } = await serviceClient
      .from(table)
      .select('id')

    if (selectError) {
      return NextResponse.json({ error: selectError.message }, { status: 500 })
    }

    const count = rows?.length || 0
    if (count > 0) {
      const { error: deleteError } = await serviceClient
        .from(table)
        .delete()
        .not('id', 'is', null)

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 })
      }
    }

    cleared += count
  }

  return NextResponse.json({ success: true, cleared })
}
