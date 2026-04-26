import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getOrCreateProfileForUser } from '@/lib/profile'

const HR_EMAIL = 'hr.samwha@sirpl.in'
const HR_PASSWORD = 'SIRPL@2016'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceClient = await createServiceClient()
  const profile = await getOrCreateProfileForUser(serviceClient, user, 'role')
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: listedUsers, error: listError } = await serviceClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 })
  }

  const existingUser = listedUsers.users?.find(candidate => candidate.email?.toLowerCase() === HR_EMAIL)

  let hrUserId = existingUser?.id

  if (!hrUserId) {
    const created = await serviceClient.auth.admin.createUser({
      email: HR_EMAIL,
      password: HR_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'HR Manager', role: 'hr' },
    })

    if (created.error) {
      return NextResponse.json({ error: created.error.message }, { status: 500 })
    }

    hrUserId = created.data.user.id
  }

  const upsertResult = await serviceClient
    .from('profiles')
    .upsert(
      {
        id: hrUserId,
        email: HR_EMAIL,
        role: 'hr',
        full_name: 'HR Manager',
      },
      { onConflict: 'id' }
    )

  if (upsertResult.error) {
    return NextResponse.json({ error: upsertResult.error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    user: {
      id: hrUserId,
      email: HR_EMAIL,
      role: 'hr',
      password: HR_PASSWORD,
    },
  })
}
