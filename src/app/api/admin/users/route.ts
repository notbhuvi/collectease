import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/messaging'
import { getAdminUserDirectory } from '@/lib/admin-users'
import { getOrCreateProfileForUser } from '@/lib/profile'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = await createServiceClient()
  const profile = await getOrCreateProfileForUser(serviceClient, user, 'role')
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const users = await getAdminUserDirectory(serviceClient)
  return NextResponse.json({ users })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = await createServiceClient()
  const profile = await getOrCreateProfileForUser(serviceClient, user, 'role')
  // admin can create anyone; transport_team can only create transporters
  const canCreate = profile?.role === 'admin' || profile?.role === 'transport_team'
  if (!profile || !canCreate) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { email, password, role, full_name, company_name } = body

  // transport_team can only create transporters
  if (profile.role === 'transport_team' && role !== 'transporter') {
    return NextResponse.json({ error: 'Transport team can only create transporter accounts' }, { status: 403 })
  }

  const allowedRoles = ['admin', 'accounts', 'transport_team', 'transporter', 'plant_ops', 'hr']
  if (!email || !password || !role || !allowedRoles.includes(role)) {
    return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 })
  }

  // Create auth user
  const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role, company_name },
  })

  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

  const newUserId = authData.user.id

  // Upsert profile (trigger should have created it, but just in case)
  await serviceClient
    .from('profiles')
    .upsert({ id: newUserId, email, role, full_name, company_name }, { onConflict: 'id' })

  // Send welcome credentials email
  try {
    const roleLabel: Record<string, string> = {
      admin: 'Admin', accounts: 'Accounts',
      transport_team: 'Transport Team', transporter: 'Transporter', plant_ops: 'Plant Ops', hr: 'HR',
    }
    const emailBody = `Dear ${full_name || email},

Your SIRPL account has been created. Here are your login credentials:

Email:    ${email}
Password: ${password}
Role:     ${roleLabel[role] || role}

Please log in at https://collectease.vercel.app and change your password immediately.

Regards,
SIRPL Admin
Samwha India Refractories Pvt. Ltd.`

    await sendEmail(email, 'Your SIRPL Account Credentials', emailBody)
  } catch (emailErr) {
    console.error('Credentials email failed:', emailErr)
  }

  return NextResponse.json({ user: { id: newUserId, email, role, full_name, company_name } }, { status: 201 })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = await createServiceClient()
  const profile = await getOrCreateProfileForUser(serviceClient, user, 'role')
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { user_id, role, full_name, company_name } = body

  if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

  const update: Record<string, string> = {}
  if (role) update.role = role
  if (full_name !== undefined) update.full_name = full_name
  if (company_name !== undefined) update.company_name = company_name

  const { data, error } = await serviceClient
    .from('profiles')
    .update(update)
    .eq('id', user_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ user: data })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = await createServiceClient()
  const profile = await getOrCreateProfileForUser(serviceClient, user, 'role')
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { user_id } = body
  if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })
  if (user_id === user.id) return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })

  // Delete related transport data first to avoid FK violations
  await serviceClient.from('awarded_loads').delete().eq('transporter_id', user_id)
  await serviceClient.from('awarded_loads').delete().eq('awarded_by', user_id)
  await serviceClient.from('transport_bids').delete().eq('transporter_id', user_id)
  await serviceClient.from('transport_loads').delete().eq('created_by', user_id)
  await serviceClient.from('profiles').delete().eq('id', user_id)

  const { error } = await serviceClient.auth.admin.deleteUser(user_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
