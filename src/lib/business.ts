import type { User } from '@supabase/supabase-js'
import { getProfileForUser } from '@/lib/profile'
import type { UserRole } from '@/types'

export interface BusinessRecord {
  id: string
  user_id: string
  name: string
  gstin?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  logo_url?: string | null
  created_at?: string
  updated_at?: string
}

type ServiceClientLike = {
  from: (table: 'businesses' | 'profiles') => any
}

export async function getAccessibleBusinessForUser(
  serviceClient: ServiceClientLike,
  user: Pick<User, 'id' | 'email'>,
  role?: UserRole | null
): Promise<BusinessRecord | null> {
  const resolvedRole = role ?? (await getProfileForUser(serviceClient, user, 'role'))?.role ?? null

  const { data: ownBusiness } = await serviceClient
    .from('businesses')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (ownBusiness) {
    return ownBusiness
  }

  if (resolvedRole === 'admin' || resolvedRole === 'accounts') {
    const { data: sharedBusiness } = await serviceClient
      .from('businesses')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (sharedBusiness) {
      return sharedBusiness
    }
  }

  return null
}

