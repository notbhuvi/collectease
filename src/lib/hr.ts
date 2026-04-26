import { addDays, differenceInCalendarDays, eachDayOfInterval, format, isAfter, isBefore, parseISO, startOfDay, subDays } from 'date-fns'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getProfileForUser } from '@/lib/profile'
import { formatCurrency } from '@/lib/utils'
import { HR_DOCUMENT_BUCKET } from '@/lib/hr-constants'
import type {
  AttendanceRecord,
  Employee,
  EmployeeDocument,
  HrPolicyDocument,
  LeaveRecord,
  UserRole,
} from '@/types'

export const HR_PORTAL_ALLOWED_ROLES: UserRole[] = ['admin', 'hr']

export interface HrAccessContext {
  user: { id: string; email?: string | null }
  profile: { id: string; role: UserRole | null; full_name?: string | null; company_name?: string | null }
  serviceClient: Awaited<ReturnType<typeof createServiceClient>>
}

export async function getHrAccessContext(): Promise<HrAccessContext | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const serviceClient = await createServiceClient()
  const profile = await getProfileForUser(serviceClient, user, 'id,email,role,full_name,company_name')

  if (!profile || !profile.role || !HR_PORTAL_ALLOWED_ROLES.includes(profile.role)) {
    return null
  }

  return {
    user,
    profile,
    serviceClient,
  }
}

export function buildAttendanceTrend(records: AttendanceRecord[]) {
  const today = startOfDay(new Date())
  return Array.from({ length: 7 }, (_, index) => {
    const date = subDays(today, 6 - index)
    const key = format(date, 'yyyy-MM-dd')
    const presentCount = records.filter(record =>
      record.date === key && ['present', 'remote', 'half_day'].includes(record.status)
    ).length

    return {
      date: key,
      label: format(date, 'dd MMM'),
      present: presentCount,
    }
  })
}

export function buildDepartmentDistribution(employees: Employee[]) {
  const departmentMap = employees.reduce<Record<string, number>>((acc, employee) => {
    const key = employee.department?.trim() || 'Unassigned'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  return Object.entries(departmentMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

export function buildLowAttendanceAlerts(employees: Employee[], records: AttendanceRecord[]) {
  const range = eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() })
  const workingDays = range.length || 1

  return employees
    .map(employee => {
      const presentDays = records.filter(record =>
        record.employee_id === employee.id &&
        ['present', 'remote', 'half_day'].includes(record.status) &&
        isAfter(parseISO(record.date), subDays(new Date(), 30))
      ).length

      const rate = Math.round((presentDays / workingDays) * 100)
      return { employee, rate }
    })
    .filter(item => item.rate < 75)
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 5)
}

export function buildExpiringDocumentAlerts(documents: EmployeeDocument[]) {
  const today = startOfDay(new Date())
  const upcoming = addDays(today, 30)

  return documents
    .filter(document => {
      if (!document.expires_on) return false
      const expiry = parseISO(document.expires_on)
      return !isBefore(expiry, today) && !isAfter(expiry, upcoming)
    })
    .sort((a, b) => differenceInCalendarDays(parseISO(a.expires_on!), parseISO(b.expires_on!)))
    .slice(0, 5)
}

export function buildHrDashboardData(
  employees: Employee[],
  attendance: AttendanceRecord[],
  leaves: LeaveRecord[],
  documents: EmployeeDocument[]
) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const startWindow = subDays(new Date(), 30)

  const totalEmployees = employees.length
  const presentToday = attendance.filter(record =>
    record.date === today && ['present', 'remote', 'half_day'].includes(record.status)
  ).length
  const onLeave = leaves.filter(leave =>
    leave.status === 'approved' && leave.from_date <= today && leave.to_date >= today
  ).length
  const newJoinees = employees.filter(employee =>
    employee.joining_date && parseISO(employee.joining_date) >= startWindow
  ).length

  const attendanceTrend = buildAttendanceTrend(attendance)
  const departmentDistribution = buildDepartmentDistribution(employees)
  const lowAttendanceAlerts = buildLowAttendanceAlerts(employees, attendance)
  const expiringDocumentAlerts = buildExpiringDocumentAlerts(documents)

  const salaryTotal = employees.reduce((sum, employee) => sum + Number(employee.salary || 0), 0)

  return {
    cards: {
      totalEmployees,
      presentToday,
      onLeave,
      newJoinees,
      salaryTotal,
      salaryLabel: formatCurrency(salaryTotal),
    },
    attendanceTrend,
    departmentDistribution,
    lowAttendanceAlerts,
    expiringDocumentAlerts,
  }
}

export function getFileNameFromPath(path: string) {
  return path.split('/').filter(Boolean).pop() || path
}

function singleRelation<T>(value: T | T[] | null | undefined): T | undefined {
  if (Array.isArray(value)) {
    return value[0]
  }
  return value || undefined
}

export function normalizeAttendanceRecords(records: Array<AttendanceRecord & { employee?: AttendanceRecord['employee'] | AttendanceRecord['employee'][] }>) {
  return records.map(record => ({
    ...record,
    employee: singleRelation(record.employee),
  }))
}

export function normalizeLeaveRecords(records: Array<LeaveRecord & { employee?: LeaveRecord['employee'] | LeaveRecord['employee'][] }>) {
  return records.map(record => ({
    ...record,
    employee: singleRelation(record.employee),
  }))
}

export function normalizeEmployeeDocuments(records: Array<EmployeeDocument & { employee?: EmployeeDocument['employee'] | EmployeeDocument['employee'][] }>) {
  return records.map(record => ({
    ...record,
    employee: singleRelation(record.employee),
  }))
}

export async function attachSignedUrlsToDocuments(
  serviceClient: Awaited<ReturnType<typeof createServiceClient>>,
  documents: Array<EmployeeDocument & { employee?: EmployeeDocument['employee'] | EmployeeDocument['employee'][] }>
) {
  const normalized = normalizeEmployeeDocuments(documents)
  return Promise.all(normalized.map(async document => {
    const signed = await serviceClient.storage
      .from(HR_DOCUMENT_BUCKET)
      .createSignedUrl(document.file_url, 60 * 60)

    return {
      ...document,
      signed_url: signed.data?.signedUrl || null,
    }
  }))
}

export async function attachSignedUrlsToPolicies(
  serviceClient: Awaited<ReturnType<typeof createServiceClient>>,
  policies: HrPolicyDocument[]
) {
  return Promise.all(policies.map(async policy => {
    const signed = await serviceClient.storage
      .from(HR_DOCUMENT_BUCKET)
      .createSignedUrl(policy.file_url, 60 * 60)

    return {
      ...policy,
      signed_url: signed.data?.signedUrl || null,
    }
  }))
}
