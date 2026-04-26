import { PageHeader } from '@/components/layout/page-header'
import { AttendanceManager } from '@/components/hr/attendance-manager'
import { createServiceClient } from '@/lib/supabase/server'
import { normalizeAttendanceRecords } from '@/lib/hr'
import type { AttendanceRecord, Employee } from '@/types'

export default async function HrAttendancePage() {
  const serviceClient = await createServiceClient()

  const [employeesResult, attendanceResult] = await Promise.all([
    serviceClient.from('employees').select('*').order('name', { ascending: true }),
    serviceClient.from('attendance').select('id, employee_id, date, check_in, check_out, status, biometric_ref, created_at, employee:employees(id, name, department, designation)').order('date', { ascending: false }),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description="Mark daily attendance, capture check in/out, and keep biometric references ready."
      />
      <AttendanceManager employees={(employeesResult.data || []) as Employee[]} initialRecords={normalizeAttendanceRecords((attendanceResult.data || []) as unknown as AttendanceRecord[])} />
    </div>
  )
}
