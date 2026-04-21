import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getProfileForUser } from '@/lib/profile'
import { getRoleHome } from '@/lib/roles'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const serviceClient = await createServiceClient()
    const profile = await getProfileForUser(serviceClient, user, 'id,email,role')
    redirect(getRoleHome(profile?.role, '/dashboard'))
  } else {
    redirect('/auth/login')
  }
}
