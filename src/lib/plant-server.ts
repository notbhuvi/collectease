import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getOrCreateProfileForUser } from '@/lib/profile'

export async function requirePlantAccess() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized', status: 401 as const }
  }

  const serviceClient = await createServiceClient()
  const profile = await getOrCreateProfileForUser(serviceClient, user, 'role')
  if (!profile || !['admin', 'plant_ops'].includes(profile.role || '')) {
    return { error: 'Forbidden', status: 403 as const }
  }

  return { user, profile, serviceClient }
}
