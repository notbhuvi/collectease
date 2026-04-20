import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TransportSidebar } from '@/components/transport/transport-sidebar'
import { getRoleHome, TRANSPORT_ROLES } from '@/lib/roles'
import type { UserRole } from '@/types'

export default async function TransportLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()

  if (!profile || !TRANSPORT_ROLES.includes(profile.role as UserRole)) {
    redirect(profile ? getRoleHome(profile.role as UserRole) : '/auth/login')
  }

  return (
    <div className="flex h-full min-h-screen bg-gray-50">
      <TransportSidebar userName={profile.full_name || user.email || undefined} />
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
