export interface AdminUserDirectoryRow {
  id: string
  email: string
  full_name: string | null
  company_name: string | null
  role: string | null
  created_at?: string
}

type ServiceClientLike = {
  from: (table: 'profiles') => any
  auth: {
    admin: {
      listUsers: (params?: { page?: number; perPage?: number }) => Promise<{
        data?: { users?: Array<any> }
        error?: { message?: string } | null
      }>
    }
  }
}

export async function getAdminUserDirectory(serviceClient: ServiceClientLike): Promise<AdminUserDirectoryRow[]> {
  const [{ data: profileRows }, { data: authData }] = await Promise.all([
    serviceClient
      .from('profiles')
      .select('id, email, full_name, company_name, role, created_at')
      .order('email', { ascending: true }),
    serviceClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ])

  const merged = new Map<string, AdminUserDirectoryRow>()

  for (const profile of profileRows || []) {
    merged.set(profile.id, {
      id: profile.id,
      email: profile.email || '',
      full_name: profile.full_name || null,
      company_name: profile.company_name || null,
      role: profile.role || null,
      created_at: profile.created_at,
    })
  }

  for (const authUser of authData?.users || []) {
    const existing = merged.get(authUser.id)
    const meta = authUser.user_metadata || {}

    merged.set(authUser.id, {
      id: authUser.id,
      email: existing?.email || authUser.email || '',
      full_name: existing?.full_name || meta.full_name || null,
      company_name: existing?.company_name || meta.company_name || null,
      role: existing?.role || meta.role || null,
      created_at: existing?.created_at || authUser.created_at,
    })
  }

  return Array.from(merged.values()).sort((a, b) => a.email.localeCompare(b.email))
}
