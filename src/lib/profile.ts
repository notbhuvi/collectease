import type { User } from '@supabase/supabase-js'
import type { UserRole } from '@/types'

export interface ProfileRecord {
  id: string
  email: string | null
  role: UserRole | null
  full_name?: string | null
  company_name?: string | null
}

export async function getProfileForUser(
  client: { from: (table: 'profiles') => any },
  user: Pick<User, 'id' | 'email'>,
  select = 'id,email,role'
): Promise<ProfileRecord | null> {
  const { data: profileById } = await client
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

  const { data: profileByEmail } = await client
    .from('profiles')
    .select(select)
    .eq('email', user.email)
    .single()

  return profileByEmail
}
