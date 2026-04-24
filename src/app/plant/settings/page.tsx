import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { ProfileSettingsForm } from '@/components/shared/profile-settings-form'

export default async function PlantSettingsPage() {
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
        accentColor="cyan"
        resetApiPath="/api/plant/reset"
        resetLabel="Reset Plant & Warehouse Data"
        resetDescription="Permanently deletes production logs, raw material transactions, dispatches, finished goods stock, warehouse items and warehouse movements. User accounts are NOT deleted."
      />
    </div>
  )
}
