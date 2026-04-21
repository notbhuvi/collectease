import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { UserRoleEditor } from '@/components/admin/user-role-editor'
import { DeleteUserButton } from '@/components/admin/delete-user-button'
import Link from 'next/link'
import { UserPlus } from 'lucide-react'

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const serviceClient = await createServiceClient()
  // Order by email — avoids failures if created_at column doesn't exist in profiles
  const { data: users, error } = await serviceClient
    .from('profiles')
    .select('*')
    .order('email', { ascending: true })

  const allUsers = users || []

  return (
    <div>
      <PageHeader
        title="Users & Roles"
        description="Manage user access and role assignments"
        actions={
          <Link
            href="/admin/create-user"
            className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors"
          >
            <UserPlus className="h-4 w-4" /> Create User
          </Link>
        }
      />

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          Error loading users: {error.message}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>All Users ({allUsers.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {allUsers.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">No users found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">Name / Email</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Company</th>
                    <th className="text-left text-xs font-medium text-gray-500 px-4 py-3">Role</th>
                    <th className="text-right text-xs font-medium text-gray-500 px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {allUsers.map((u: any) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3">
                        <p className="font-medium text-gray-900">{u.full_name || '—'}</p>
                        <p className="text-xs text-gray-400">{u.email}</p>
                        {u.id === user.id && (
                          <span className="text-xs text-violet-600 font-medium">You</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{u.company_name || '—'}</td>
                      <td className="px-4 py-3">
                        <UserRoleEditor
                          userId={u.id}
                          currentRole={u.role}
                          currentName={u.full_name}
                          currentCompany={u.company_name}
                        />
                      </td>
                      <td className="px-6 py-3 text-right">
                        {u.id !== user.id && (
                          <DeleteUserButton userId={u.id} userEmail={u.email || u.full_name || 'this user'} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
