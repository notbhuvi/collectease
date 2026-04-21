import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { ProfileSettingsForm } from '@/components/shared/profile-settings-form'

export default async function TransportSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, company_name, role')
    .eq('id', user.id)
    .single()

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage your profile, password and preferences"
      />
      <ProfileSettingsForm
        userEmail={user.email || ''}
        fullName={profile?.full_name || null}
        companyName={profile?.company_name || null}
        accentColor="orange"
        resetApiPath="/api/transport/reset"
        resetLabel="Reset Transport Data"
        resetDescription="Permanently deletes all completed and awarded loads, bids and award records. Active (open/closed) loads are preserved. User accounts are NOT deleted."
      />
    </div>
  )
}
