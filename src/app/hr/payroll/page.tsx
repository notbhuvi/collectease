import { PageHeader } from '@/components/layout/page-header'
import { PayrollOverview } from '@/components/hr/payroll-overview'
import { createServiceClient } from '@/lib/supabase/server'
import type { AttendanceRecord, Employee, LeaveRecord } from '@/types'

export default async function HrPayrollPage() {
  const serviceClient = await createServiceClient()

  const [employeesResult, attendanceResult, leavesResult] = await Promise.all([
    serviceClient.from('employees').select('*').order('name', { ascending: true }),
    serviceClient.from('attendance').select('id, employee_id, date, check_in, check_out, status, biometric_ref, created_at').order('date', { ascending: false }),
    serviceClient.from('leaves').select('id, employee_id, type, from_date, to_date, status, approved_by, reason, created_at').order('created_at', { ascending: false }),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll"
        description="Basic payroll readiness based on employee salary masters, attendance, and approved leave."
      />
      <PayrollOverview
        employees={(employeesResult.data || []) as Employee[]}
        attendance={(attendanceResult.data || []) as AttendanceRecord[]}
        leaves={(leavesResult.data || []) as LeaveRecord[]}
      />
    </div>
  )
}
