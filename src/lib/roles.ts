import type { UserRole } from '@/types'

export const ROLE_REDIRECTS: Record<string, string> = {
  admin: '/admin',
  accounts: '/dashboard',
  transport_team: '/transport',
  transporter: '/portal',
  plant_ops: '/plant',
  hr: '/hr',
}

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  accounts: 'Accounts',
  transport_team: 'Transport Team',
  transporter: 'Transporter',
  plant_ops: 'Plant Ops',
  hr: 'HR',
}

export const DASHBOARD_ROLES: UserRole[] = ['admin', 'accounts']
export const TRANSPORT_ROLES: UserRole[] = ['admin', 'transport_team']
export const PORTAL_ROLES: UserRole[] = ['admin', 'transporter']
export const ADMIN_ROLES: UserRole[] = ['admin']
export const PLANT_PORTAL_ROLES: UserRole[] = ['admin', 'plant_ops']
export const HR_PORTAL_ROLES: UserRole[] = ['admin', 'hr']

export function isUserRole(role: string | null | undefined): role is UserRole {
  return role !== null && role !== undefined && role in ROLE_REDIRECTS
}

export function getRoleHome(role: string | null | undefined, fallback = '/auth/login'): string {
  return isUserRole(role) ? ROLE_REDIRECTS[role] : fallback
}

export function canAccessPath(role: string | null | undefined, pathname: string): boolean {
  if (!isUserRole(role)) {
    return false
  }

  if (pathname.startsWith('/admin')) {
    return ADMIN_ROLES.includes(role)
  }

  if (pathname.startsWith('/dashboard')) {
    return DASHBOARD_ROLES.includes(role)
  }

  if (pathname.startsWith('/transport')) {
    return TRANSPORT_ROLES.includes(role)
  }

  if (pathname.startsWith('/portal')) {
    return PORTAL_ROLES.includes(role)
  }

  if (pathname.startsWith('/plant')) {
    return PLANT_PORTAL_ROLES.includes(role)
  }

  if (pathname.startsWith('/hr')) {
    return HR_PORTAL_ROLES.includes(role)
  }

  return true
}
