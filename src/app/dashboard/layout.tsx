import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { getRoleHome, DASHBOARD_ROLES } from '@/lib/roles'
import type { UserRole } from '@/types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Use service client for profile so RLS never blocks the role lookup
  const svc = await createServiceClient()
  const { data: profile } = await svc
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // Strict role guard — if no profile or wrong role, send them to their correct home
  if (!profile || !DASHBOARD_ROLES.includes(profile.role as UserRole)) {
    const roleHome: Record<string, string> = {
      admin: '/admin', accounts: '/dashboard',
      transport_team: '/transport', transporter: '/portal',
    }
    redirect(profile ? (roleHome[profile.role] ?? '/auth/login') : '/auth/login')
  }

  // Fetch or auto-create business — only runs for accounts/admin users (role guard above)
  let { data: business } = await svc
    .from('businesses')
    .select('name')
    .eq('user_id', user.id)
    .single()

  if (!business) {
    await svc
      .from('businesses')
      .upsert(
        { user_id: user.id, name: 'Samwha India Refractories Pvt. Ltd.', email: user.email || '' },
        { onConflict: 'user_id', ignoreDuplicates: true }
      )
    const { data: refreshed } = await svc
      .from('businesses').select('name').eq('user_id', user.id).single()
    business = refreshed
  }

  return (
    <div className="flex h-full min-h-screen">
      <Sidebar businessName={business?.name} />
      <main className="flex-1 lg:overflow-y-auto">
        <div className="pt-14 lg:pt-0">
          <div className="p-6 max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
