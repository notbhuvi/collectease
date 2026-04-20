import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { UserRoleEditor } from '@/components/admin/user-role-editor'

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const serviceClient = await createServiceClient()
  const { data: users } = await serviceClient
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div>
      <PageHeader title="Users & Roles" description="Manage user access and role assignments" />

      <Card>
        <CardHeader><CardTitle>All Users ({(users || []).length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">Name / Email</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Company</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Role</th>
                  <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Joined</th>
                  <th className="text-right text-xs font-medium text-gray-500 px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(users || []).map((u: any) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3">
                      <p className="font-medium text-gray-900">{u.full_name || '—'}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{u.company_name || '—'}</td>
                    <td className="px-4 py-3">
                      <UserRoleEditor userId={u.id} currentRole={u.role} currentName={u.full_name} currentCompany={u.company_name} />
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(u.created_at).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-6 py-3 text-right text-xs text-gray-400">
                      {u.id === user.id ? <span className="text-violet-600 font-medium">You</span> : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
