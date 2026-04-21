import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/page-header'
import { CreateUserForm } from '@/components/admin/create-user-form'

export default async function CreateUserPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  return (
    <div>
      <PageHeader
        title="Create User"
        description="Add a new user account and assign a role"
      />
      <CreateUserForm />
    </div>
  )
}
