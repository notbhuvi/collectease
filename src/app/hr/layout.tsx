import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getProfileForUser } from '@/lib/profile'
import { getRoleHome, HR_PORTAL_ROLES } from '@/lib/roles'
import type { UserRole } from '@/types'
import { HrSidebar } from '@/components/hr/hr-sidebar'

export default async function HrLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const serviceClient = await createServiceClient()
  const profile = await getProfileForUser(serviceClient, user, 'id,email,role,full_name')

  if (!profile || !HR_PORTAL_ROLES.includes(profile.role as UserRole)) {
    redirect(getRoleHome(profile?.role, '/auth/login'))
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <HrSidebar userName={profile.full_name || user.email || undefined} />
      <main className="flex-1 lg:overflow-y-auto">
        <div className="pt-14 lg:pt-0">
          <div className="mx-auto max-w-7xl p-6">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
