import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { getRoleHome, DASHBOARD_ROLES } from '@/lib/roles'
import type { UserRole } from '@/types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const [{ data: profile }, { data: business }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('businesses').select('name').eq('user_id', user.id).single(),
  ])

  // If role exists and isn't allowed here, send to their correct home
  if (profile?.role && !DASHBOARD_ROLES.includes(profile.role as UserRole)) {
    redirect(getRoleHome(profile.role as UserRole))
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
