import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { AdminSidebar } from '@/components/admin/admin-sidebar'
import { getProfileForUser } from '@/lib/profile'
import { getRoleHome } from '@/lib/roles'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const serviceClient = await createServiceClient()
  const profile = await getProfileForUser(serviceClient, user, 'id,email,role,full_name')

  if (!profile || profile.role !== 'admin') {
    redirect(getRoleHome(profile?.role, '/auth/login'))
  }

  return (
    <div className="flex h-full min-h-screen bg-gray-50">
      <AdminSidebar userName={profile.full_name || user.email || undefined} />
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
