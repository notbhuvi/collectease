import { PageHeader } from '@/components/layout/page-header'
import { DocumentsManager } from '@/components/hr/documents-manager'
import { attachSignedUrlsToDocuments, attachSignedUrlsToPolicies, normalizeEmployeeDocuments } from '@/lib/hr'
import { createServiceClient } from '@/lib/supabase/server'
import type { Employee, EmployeeDocument, HrPolicyDocument } from '@/types'

export default async function HrDocumentsPage() {
  const serviceClient = await createServiceClient()

  const [employeesResult, documentsResult, policiesResult] = await Promise.all([
    serviceClient.from('employees').select('*').order('name', { ascending: true }),
    serviceClient.from('employee_documents').select('id, employee_id, doc_type, file_url, expires_on, created_at, employee:employees(id, name, department)').order('created_at', { ascending: false }),
    serviceClient.from('hr_policy_documents').select('id, title, file_url, created_by, created_at').order('created_at', { ascending: false }),
  ])

  const [documents, policies] = await Promise.all([
    attachSignedUrlsToDocuments(serviceClient, normalizeEmployeeDocuments((documentsResult.data || []) as unknown as EmployeeDocument[])),
    attachSignedUrlsToPolicies(serviceClient, (policiesResult.data || []) as HrPolicyDocument[]),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Store employee identity and onboarding files in Supabase Storage with policy uploads alongside them."
      />
      <DocumentsManager
        employees={(employeesResult.data || []) as Employee[]}
        initialDocuments={documents}
        initialPolicies={policies}
      />
    </div>
  )
}
