import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { getRoleHome, DASHBOARD_ROLES } from '@/lib/roles'
import { getProfileForUser } from '@/lib/profile'
import { getAccessibleBusinessForUser } from '@/lib/business'
import type { UserRole } from '@/types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Use service client for profile so RLS never blocks the role lookup
  const svc = await createServiceClient()
  const profile = await getProfileForUser(svc, user, 'id,email,role')

  // Strict role guard — if no profile or wrong role, send them to their correct home
  if (!profile || !DASHBOARD_ROLES.includes(profile.role as UserRole)) {
    redirect(getRoleHome(profile?.role, '/auth/login'))
  }

  // Resolve the business once for all dashboard pages. Accounts/admin users can
  // share the same company record, so we fall back to the first business row.
  let business = await getAccessibleBusinessForUser(svc, user, profile.role as UserRole)

  if (!business) {
    const { count } = await svc
      .from('businesses')
      .select('id', { count: 'exact', head: true })

    if (!count) {
      const { data: created } = await svc
        .from('businesses')
        .insert({
          user_id: user.id,
          name: 'Samwha India Refractories Pvt. Ltd.',
          email: user.email || '',
        })
        .select('id, user_id, name')
        .single()
      business = created
    }
  }

  return (
    <div className="flex h-full min-h-screen">
      <Sidebar businessName={business?.name || 'SIRPL'} />
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
