import type { UserRole } from '@/types'

export const ROLE_REDIRECTS: Record<string, string> = {
  admin: '/admin',
  accounts: '/dashboard',
  transport_team: '/transport',
  transporter: '/portal',
}

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  accounts: 'Accounts',
  transport_team: 'Transport Team',
  transporter: 'Transporter',
}

export const DASHBOARD_ROLES: UserRole[] = ['admin', 'accounts']
export const TRANSPORT_ROLES: UserRole[] = ['admin', 'transport_team']
export const PORTAL_ROLES: UserRole[] = ['admin', 'transporter']
export const ADMIN_ROLES: UserRole[] = ['admin']

export function getRoleHome(role: UserRole): string {
  return ROLE_REDIRECTS[role] ?? '/dashboard'
}
