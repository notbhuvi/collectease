import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: business } = await supabase
    .from('businesses').select('id').eq('user_id', user.id).single()

  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('business_id', business.id)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ clients: data })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('user_id', user.id)
    .eq('id', body.business_id)
    .single()

  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('clients')
    .insert({
      business_id: body.business_id,
      name: body.name,
      email: body.email,
      phone: body.phone,
      gstin: body.gstin,
      address: body.address,
      city: body.city,
      state: body.state,
      contact_person: body.contact_person,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ client: data }, { status: 201 })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing client id' }, { status: 400 })

  // Verify ownership
  const { data: client } = await supabase
    .from('clients')
    .select('business_id, businesses!inner(user_id)')
    .eq('id', id)
    .single()

  if (!client || (client.businesses as any).user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Check for active (unpaid) invoices
  const { data: activeInvoices } = await supabase
    .from('invoices')
    .select('id')
    .eq('client_id', id)
    .in('status', ['sent', 'overdue'])
    .limit(1)

  if (activeInvoices && activeInvoices.length > 0) {
    return NextResponse.json(
      { error: 'Cannot delete client with outstanding invoices. Mark all invoices as paid or cancelled first.' },
      { status: 409 }
    )
  }

  const { error } = await supabase.from('clients').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, ...updates } = body

  const { data: client } = await supabase
    .from('clients')
    .select('business_id, businesses!inner(user_id)')
    .eq('id', id)
    .single()

  if (!client || (client.businesses as any).user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('clients')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ client: data })
}
