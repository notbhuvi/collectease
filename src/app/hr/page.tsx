import { AlertTriangle, CalendarCheck2, Sparkles, UserPlus, Users } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { createServiceClient } from '@/lib/supabase/server'
import { buildHrDashboardData, normalizeAttendanceRecords, normalizeEmployeeDocuments, normalizeLeaveRecords } from '@/lib/hr'
import { HrDashboardCharts } from '@/components/hr/hr-dashboard-charts'
import type { AttendanceRecord, Employee, EmployeeDocument, LeaveRecord } from '@/types'

export default async function HrDashboardPage() {
  const serviceClient = await createServiceClient()

  const [employeesResult, attendanceResult, leavesResult, documentsResult] = await Promise.all([
    serviceClient.from('employees').select('*').order('created_at', { ascending: false }),
    serviceClient.from('attendance').select('id, employee_id, date, check_in, check_out, status, biometric_ref, created_at, employee:employees(id, name, department, designation)').order('date', { ascending: false }),
    serviceClient.from('leaves').select('id, employee_id, type, from_date, to_date, status, approved_by, reason, created_at, employee:employees(id, name, department, designation)').order('created_at', { ascending: false }),
    serviceClient.from('employee_documents').select('id, employee_id, doc_type, file_url, expires_on, created_at, employee:employees(id, name, department)').order('created_at', { ascending: false }),
  ])

  const dashboard = buildHrDashboardData(
    (employeesResult.data || []) as Employee[],
    normalizeAttendanceRecords((attendanceResult.data || []) as unknown as AttendanceRecord[]),
    normalizeLeaveRecords((leavesResult.data || []) as unknown as LeaveRecord[]),
    normalizeEmployeeDocuments((documentsResult.data || []) as unknown as EmployeeDocument[])
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="HR Dashboard"
        description="Live workforce visibility across employees, attendance, leave, documents, and payroll readiness."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Employees" value={dashboard.cards.totalEmployees} subtitle="active workforce records" icon={<Users className="h-5 w-5" />} />
        <StatCard title="Present Today" value={dashboard.cards.presentToday} subtitle="present, remote, and half-day" icon={<CalendarCheck2 className="h-5 w-5" />} />
        <StatCard title="On Leave" value={dashboard.cards.onLeave} subtitle="approved leave right now" icon={<AlertTriangle className="h-5 w-5" />} />
        <StatCard title="New Joinees" value={dashboard.cards.newJoinees} subtitle="joined in last 30 days" icon={<UserPlus className="h-5 w-5" />} />
      </div>

      <HrDashboardCharts
        attendanceTrend={dashboard.attendanceTrend}
        departmentDistribution={dashboard.departmentDistribution}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.expiringDocumentAlerts.map(document => (
              <div key={document.id} className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
                <p className="text-sm font-medium text-amber-800">{document.employee?.name || 'Employee'} · {document.doc_type}</p>
                <p className="text-xs text-amber-700">Expiry due on {document.expires_on}</p>
              </div>
            ))}
            {dashboard.lowAttendanceAlerts.map(alert => (
              <div key={alert.employee.id} className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2">
                <p className="text-sm font-medium text-rose-800">{alert.employee.name}</p>
                <p className="text-xs text-rose-700">Attendance at {alert.rate}% over the last 30 days</p>
              </div>
            ))}
            {dashboard.expiringDocumentAlerts.length === 0 && dashboard.lowAttendanceAlerts.length === 0 && (
              <p className="text-sm text-gray-500">No urgent HR alerts at the moment.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Compensation Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl bg-rose-50 p-4">
              <p className="text-sm font-medium text-rose-700">Monthly Salary Base</p>
              <p className="mt-2 text-2xl font-bold text-rose-800">{dashboard.cards.salaryLabel}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-700">Largest Department</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{dashboard.departmentDistribution[0]?.name || '—'}</p>
              <p className="text-xs text-slate-500">{dashboard.departmentDistribution[0]?.value || 0} employees</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                <Sparkles className="h-4 w-4" />
                HR hygiene
              </p>
              <p className="mt-2 text-sm text-emerald-800">
                {dashboard.expiringDocumentAlerts.length} document alerts and {dashboard.lowAttendanceAlerts.length} low-attendance alerts currently open.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
