import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getProfileForUser } from '@/lib/profile'
import { getAccessibleBusinessForUser } from '@/lib/business'
import type { UserRole } from '@/types'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = await createServiceClient()
  const profile = await getProfileForUser(serviceClient, user, 'role')
  const business = await getAccessibleBusinessForUser(serviceClient, user, profile?.role as UserRole)
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  const body = await request.json()

  const { data, error } = await serviceClient
    .from('businesses')
    .update({
      name: body.name,
      gstin: body.gstin || null,
      phone: body.phone || null,
      email: body.email || null,
      address: body.address || null,
      city: body.city || null,
      state: body.state || null,
      pincode: body.pincode || null,
    })
    .eq('id', business.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ business: data })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = await createServiceClient()
  const profile = await getProfileForUser(serviceClient, user, 'role')
  const data = await getAccessibleBusinessForUser(serviceClient, user, profile?.role as UserRole)

  if (!data) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  return NextResponse.json({ business: data })
}
