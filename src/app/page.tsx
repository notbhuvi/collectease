import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getRoleHome } from '@/lib/roles'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Try regular client FIRST — user just logged in so their JWT session is active.
  // RLS policy 'own_profile_select' allows users to read their own row.
  const { data: myProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  let role = myProfile?.role as string | undefined

  // Fallback: service client bypasses RLS entirely (handles edge cases)
  if (!role) {
    try {
      const svc = await createServiceClient()
      const { data: svcProfile } = await svc
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      role = svcProfile?.role as string | undefined
    } catch {
      // service client unavailable
    }
  }

  // Explicit role → correct home
  if (role) {
    redirect(getRoleHome(role, '/auth/login'))
  }

  // Unknown/missing role — send to login to re-authenticate
  redirect('/auth/login')
}
