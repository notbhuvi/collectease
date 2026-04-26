import { PageHeader } from '@/components/layout/page-header'
import { LeavesManager } from '@/components/hr/leaves-manager'
import { createServiceClient } from '@/lib/supabase/server'
import { normalizeLeaveRecords } from '@/lib/hr'
import type { Employee, LeaveRecord } from '@/types'

export default async function HrLeavesPage() {
  const serviceClient = await createServiceClient()

  const [employeesResult, leavesResult] = await Promise.all([
    serviceClient.from('employees').select('*').order('name', { ascending: true }),
    serviceClient.from('leaves').select('id, employee_id, type, from_date, to_date, status, approved_by, reason, created_at, employee:employees(id, name, department, designation)').order('created_at', { ascending: false }),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Management"
        description="Track requests, approve or reject them, and keep the leave history organized."
      />
      <LeavesManager employees={(employeesResult.data || []) as Employee[]} initialLeaves={normalizeLeaveRecords((leavesResult.data || []) as unknown as LeaveRecord[])} />
    </div>
  )
}
