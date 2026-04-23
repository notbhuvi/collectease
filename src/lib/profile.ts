import type { User } from '@supabase/supabase-js'
import type { UserRole } from '@/types'

export interface ProfileRecord {
  id: string
  email: string | null
  role: UserRole | null
  full_name?: string | null
  company_name?: string | null
}

type ProfileSelectResult = PromiseLike<{ data: ProfileRecord | null }>

type ProfileQueryBuilder = {
  select: (query: string) => {
    eq: (column: string, value: string) => {
      single: () => ProfileSelectResult
    }
  }
  upsert?: (
    values: Partial<ProfileRecord> & { id: string; email: string; role: UserRole },
    options: { onConflict: string }
  ) => PromiseLike<unknown>
}

const VALID_ROLES: UserRole[] = ['admin', 'accounts', 'transport_team', 'transporter']

function normalizeRole(role: unknown): UserRole | null {
  return typeof role === 'string' && VALID_ROLES.includes(role as UserRole)
    ? (role as UserRole)
    : null
}

export async function getProfileForUser(
  client: unknown,
  user: Pick<User, 'id' | 'email'>,
  select = 'id,email,role'
): Promise<ProfileRecord | null> {
  const profileClient = client as { from: (table: 'profiles') => ProfileQueryBuilder }

  const { data: profileById } = await profileClient
    .from('profiles')
    .select(select)
    .eq('id', user.id)
    .single()

  if (profileById) {
    return profileById
  }

  if (!user.email) {
    return null
  }

  const { data: profileByEmail } = await profileClient
    .from('profiles')
    .select(select)
    .eq('email', user.email)
    .single()

  return profileByEmail
}

export type ServiceProfileClient = {
  from: (table: 'profiles') => ProfileQueryBuilder
  auth?: {
    admin?: {
      getUserById?: (id: string) => Promise<{
        data?: { user?: { email?: string | null; user_metadata?: Record<string, unknown> | null } | null }
        error?: { message?: string } | null
      }>
    }
  }
}

export async function getOrCreateProfileForUser(
  client: unknown,
  user: Pick<User, 'id' | 'email'>,
  select = 'id,email,role,full_name,company_name'
): Promise<ProfileRecord | null> {
  const profileClient = client as ServiceProfileClient
  const existing = await getProfileForUser(profileClient, user, select)
  if (existing) {
    return existing
  }

  const authResult = profileClient.auth?.admin?.getUserById
    ? await profileClient.auth.admin.getUserById(user.id)
    : null

  const authUser = authResult?.data?.user
  const metadata = authUser?.user_metadata || {}
  const email = user.email || authUser?.email || null

  if (!email) {
    return null
  }

  const fallbackProfile = {
    id: user.id,
    email,
    role: normalizeRole(metadata.role) || 'accounts',
    full_name: typeof metadata.full_name === 'string' ? metadata.full_name : null,
    company_name: typeof metadata.company_name === 'string' ? metadata.company_name : null,
  }

  await profileClient
    .from('profiles')
    .upsert?.(fallbackProfile, { onConflict: 'id' })

  return getProfileForUser(profileClient, user, select)
}
