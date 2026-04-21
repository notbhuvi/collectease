import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminSidebar } from '@/components/admin/admin-sidebar'
import type { UserRole } from '@/types'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()

  if (!profile || profile.role !== 'admin') {
    redirect(profile ? `/` + (
      { accounts: 'dashboard', transport_team: 'transport', transporter: 'portal' }[profile.role as string] ?? 'auth/login'
    ) : '/auth/login')
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
