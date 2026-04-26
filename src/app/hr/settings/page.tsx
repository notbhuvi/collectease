import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { HrSettingsForm } from '@/components/hr/hr-settings-form'
import { attachSignedUrlsToPolicies } from '@/lib/hr'
import { getProfileForUser } from '@/lib/profile'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { HrPolicyDocument } from '@/types'

export default async function HrSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const serviceClient = await createServiceClient()
  const profile = await getProfileForUser(serviceClient, user, 'id,email,role,full_name,company_name')
  const policiesResult = await serviceClient
    .from('hr_policy_documents')
    .select('id, title, file_url, created_by, created_at')
    .order('created_at', { ascending: false })

  const policies = await attachSignedUrlsToPolicies(serviceClient, (policiesResult.data || []) as HrPolicyDocument[])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage the HR profile, appearance preferences, and company policy uploads."
      />
      <HrSettingsForm
        userEmail={user.email || ''}
        fullName={profile?.full_name || null}
        companyName={profile?.company_name || null}
        policies={policies}
      />
    </div>
  )
}
