import type { UserRole } from '@/types'

export const ROLE_REDIRECTS: Record<UserRole, string> = {
  admin: '/admin',
  accounts: '/dashboard',
  sales: '/dashboard',
  transport_team: '/transport',
  transporter: '/portal',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  accounts: 'Accounts',
  sales: 'Sales',
  transport_team: 'Transport Team',
  transporter: 'Transporter',
}

export const DASHBOARD_ROLES: UserRole[] = ['admin', 'accounts', 'sales']
export const TRANSPORT_ROLES: UserRole[] = ['admin', 'transport_team']
export const PORTAL_ROLES: UserRole[] = ['admin', 'transporter']
export const ADMIN_ROLES: UserRole[] = ['admin']

export function getRoleHome(role: UserRole): string {
  return ROLE_REDIRECTS[role] ?? '/dashboard'
}
