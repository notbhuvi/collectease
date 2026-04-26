'use client'

import { useState } from 'react'
import { ExternalLink, Trash2, Upload } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { HR_DOCUMENT_TYPES } from '@/lib/hr-constants'
import { formatDate } from '@/lib/utils'
import type { Employee, EmployeeDocument, HrPolicyDocument } from '@/types'

export function DocumentsManager({
  employees,
  initialDocuments,
  initialPolicies,
}: {
  employees: Employee[]
  initialDocuments: Array<EmployeeDocument & { file_name?: string | null }>
  initialPolicies: Array<HrPolicyDocument & { file_name?: string | null }>
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [documents, setDocuments] = useState(initialDocuments)
  const [policies, setPolicies] = useState(initialPolicies)
  const [employeeUploading, setEmployeeUploading] = useState(false)
  const [policyUploading, setPolicyUploading] = useState(false)
  const [employeeForm, setEmployeeForm] = useState({
    employee_id: employees[0]?.id || '',
    doc_type: HR_DOCUMENT_TYPES[0] as string,
    expires_on: '',
    file: null as File | null,
  })
  const [policyForm, setPolicyForm] = useState({
    title: '',
    file: null as File | null,
  })

  async function uploadEmployeeDoc(e: React.FormEvent) {
    e.preventDefault()
    if (!employeeForm.file) {
      toast({ title: 'Choose a document to upload', variant: 'error' })
      return
    }
    setEmployeeUploading(true)
    try {
      const payload = new FormData()
      payload.set('kind', 'employee')
      payload.set('employee_id', employeeForm.employee_id)
      payload.set('doc_type', employeeForm.doc_type)
      payload.set('expires_on', employeeForm.expires_on)
      payload.set('file', employeeForm.file)

      const res = await fetch('/api/hr/documents', { method: 'POST', body: payload })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Unable to upload document')
      setDocuments(current => [data.document, ...current])
      setEmployeeForm(current => ({ ...current, expires_on: '', file: null }))
      toast({ title: 'Employee document uploaded', variant: 'success' })
      router.refresh()
    } catch (error: unknown) {
      toast({ title: 'Upload failed', description: error instanceof Error ? error.message : 'Unable to upload document', variant: 'error' })
    } finally {
      setEmployeeUploading(false)
    }
  }

  async function uploadPolicy(e: React.FormEvent) {
    e.preventDefault()
    if (!policyForm.file || !policyForm.title.trim()) {
      toast({ title: 'Policy title and file are required', variant: 'error' })
      return
    }
    setPolicyUploading(true)
    try {
      const payload = new FormData()
      payload.set('kind', 'policy')
      payload.set('title', policyForm.title)
      payload.set('file', policyForm.file)

      const res = await fetch('/api/hr/documents', { method: 'POST', body: payload })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Unable to upload policy')
      setPolicies(current => [data.policy, ...current])
      setPolicyForm({ title: '', file: null })
      toast({ title: 'Policy uploaded', variant: 'success' })
      router.refresh()
    } catch (error: unknown) {
      toast({ title: 'Upload failed', description: error instanceof Error ? error.message : 'Unable to upload policy', variant: 'error' })
    } finally {
      setPolicyUploading(false)
    }
  }

  async function deleteDocument(id: string, kind: 'employee' | 'policy') {
    if (!confirm('Delete this file?')) return
    try {
      const res = await fetch('/api/hr/documents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, kind }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Unable to delete file')
      if (kind === 'policy') {
        setPolicies(current => current.filter(policy => policy.id !== id))
      } else {
        setDocuments(current => current.filter(document => document.id !== id))
      }
      toast({ title: 'File deleted', variant: 'success' })
      router.refresh()
    } catch (error: unknown) {
      toast({ title: 'Delete failed', description: error instanceof Error ? error.message : 'Unable to delete file', variant: 'error' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Employee Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={uploadEmployeeDoc} className="grid gap-3">
              <Select value={employeeForm.employee_id} onValueChange={value => setEmployeeForm(current => ({ ...current, employee_id: value }))}>
                <SelectTrigger label="Employee">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(employee => (
                    <SelectItem key={employee.id} value={employee.id}>{employee.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={employeeForm.doc_type} onValueChange={value => setEmployeeForm(current => ({ ...current, doc_type: value }))}>
                <SelectTrigger label="Document Type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HR_DOCUMENT_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input label="Expiry Date" type="date" value={employeeForm.expires_on} onChange={e => setEmployeeForm(current => ({ ...current, expires_on: e.target.value }))} />
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">File</label>
                <input type="file" onChange={e => setEmployeeForm(current => ({ ...current, file: e.target.files?.[0] || null }))} className="block h-9 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
              </div>
              <Button type="submit" loading={employeeUploading}>
                <Upload className="h-4 w-4" />
                Upload Employee File
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Company Policies</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={uploadPolicy} className="grid gap-3">
              <Input label="Policy Title" value={policyForm.title} onChange={e => setPolicyForm(current => ({ ...current, title: e.target.value }))} placeholder="Employee handbook 2026" />
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Policy File</label>
                <input type="file" onChange={e => setPolicyForm(current => ({ ...current, file: e.target.files?.[0] || null }))} className="block h-9 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
              </div>
              <Button type="submit" loading={policyUploading}>
                <Upload className="h-4 w-4" />
                Upload Policy
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Document Register</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2">Document</th>
                  <th className="px-3 py-2">Expiry</th>
                  <th className="px-3 py-2">View</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map(document => (
                  <tr key={document.id} className="border-b border-gray-50">
                    <td className="px-3 py-3">
                      <p className="font-medium text-gray-900">{document.employee?.name || 'Employee'}</p>
                      <p className="text-xs text-gray-400">{document.employee?.department || 'Department pending'}</p>
                    </td>
                    <td className="px-3 py-3 text-gray-700">{document.doc_type}</td>
                    <td className="px-3 py-3 text-gray-600">{formatDate(document.expires_on)}</td>
                    <td className="px-3 py-3">
                      {document.signed_url ? (
                        <a href={document.signed_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-rose-600 hover:text-rose-700">
                          Open <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end">
                        <Button type="button" size="sm" variant="outline" onClick={() => deleteDocument(document.id, 'employee')}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {documents.length === 0 && (
                  <tr>
                    <td className="px-3 py-10 text-center text-sm text-gray-400" colSpan={5}>
                      No employee documents uploaded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                  <th className="px-3 py-2">Policy</th>
                  <th className="px-3 py-2">Uploaded On</th>
                  <th className="px-3 py-2">View</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {policies.map(policy => (
                  <tr key={policy.id} className="border-b border-gray-50">
                    <td className="px-3 py-3 font-medium text-gray-900">{policy.title}</td>
                    <td className="px-3 py-3 text-gray-600">{formatDate(policy.created_at)}</td>
                    <td className="px-3 py-3">
                      {policy.signed_url ? (
                        <a href={policy.signed_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-rose-600 hover:text-rose-700">
                          Open <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end">
                        <Button type="button" size="sm" variant="outline" onClick={() => deleteDocument(policy.id, 'policy')}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {policies.length === 0 && (
                  <tr>
                    <td className="px-3 py-10 text-center text-sm text-gray-400" colSpan={4}>
                      No policy uploads yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
