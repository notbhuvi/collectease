import { PageHeader } from '@/components/layout/page-header'
import { EmployeesManager } from '@/components/hr/employees-manager'
import { createServiceClient } from '@/lib/supabase/server'
import { attachSignedUrlsToDocuments } from '@/lib/hr'
import type { Employee, EmployeeDocument } from '@/types'

export default async function HrEmployeesPage() {
  const serviceClient = await createServiceClient()

  const [employeesResult, documentsResult] = await Promise.all([
    serviceClient.from('employees').select('*').order('created_at', { ascending: false }),
    serviceClient.from('employee_documents').select('id, employee_id, doc_type, file_url, expires_on, created_at, employee:employees(id, name, department)').order('created_at', { ascending: false }),
  ])

  const documents = await attachSignedUrlsToDocuments(serviceClient, (documentsResult.data || []) as unknown as EmployeeDocument[])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        description="Create, edit, remove, and document the workforce directory."
      />
      <EmployeesManager initialEmployees={(employeesResult.data || []) as Employee[]} initialDocuments={documents} />
    </div>
  )
}
