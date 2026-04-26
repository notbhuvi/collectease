'use client'

import { useState } from 'react'
import { Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import { HR_DOCUMENT_TYPES } from '@/lib/hr-constants'
import type { Employee, EmployeeDocument } from '@/types'

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  department: '',
  designation: '',
  salary: '',
  joining_date: new Date().toISOString().slice(0, 10),
  status: 'active',
}

export function EmployeesManager({
  initialEmployees,
  initialDocuments,
}: {
  initialEmployees: Employee[]
  initialDocuments: Array<EmployeeDocument & { file_name?: string | null }>
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [employees, setEmployees] = useState(initialEmployees)
  const [documents, setDocuments] = useState(initialDocuments)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [documentForm, setDocumentForm] = useState({
    employee_id: initialEmployees[0]?.id || '',
    doc_type: HR_DOCUMENT_TYPES[0] as string,
    expires_on: '',
    file: null as File | null,
  })

  function updateForm(key: string, value: string) {
    setForm(current => ({ ...current, [key]: value }))
  }

  function startEdit(employee: Employee) {
    setEditingId(employee.id)
    setForm({
      name: employee.name,
      email: employee.email || '',
      phone: employee.phone || '',
      department: employee.department || '',
      designation: employee.designation || '',
      salary: employee.salary ? String(employee.salary) : '',
      joining_date: employee.joining_date || new Date().toISOString().slice(0, 10),
      status: employee.status,
    })
  }

  function resetForm() {
    setEditingId(null)
    setForm(emptyForm)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/hr/employees', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingId ? { id: editingId, ...form } : form),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Unable to save employee')
      }

      const employee = data.employee
      setEmployees(current =>
        editingId
          ? current.map(item => (item.id === employee.id ? employee : item))
          : [employee, ...current]
      )
      toast({ title: editingId ? 'Employee updated' : 'Employee added', variant: 'success' })
      resetForm()
      router.refresh()
    } catch (error: unknown) {
      toast({ title: 'Save failed', description: error instanceof Error ? error.message : 'Unable to save employee', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this employee record?')) return
    try {
      const res = await fetch('/api/hr/employees', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Unable to delete employee')
      }
      setEmployees(current => current.filter(employee => employee.id !== id))
      setDocuments(current => current.filter(document => document.employee_id !== id))
      toast({ title: 'Employee deleted', variant: 'success' })
      router.refresh()
    } catch (error: unknown) {
      toast({ title: 'Delete failed', description: error instanceof Error ? error.message : 'Unable to delete employee', variant: 'error' })
    }
  }

  async function handleDocumentUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!documentForm.file) {
      toast({ title: 'Choose a document first', variant: 'error' })
      return
    }
    setUploading(true)
    try {
      const payload = new FormData()
      payload.set('kind', 'employee')
      payload.set('employee_id', documentForm.employee_id)
      payload.set('doc_type', documentForm.doc_type)
      payload.set('expires_on', documentForm.expires_on)
      payload.set('file', documentForm.file)

      const res = await fetch('/api/hr/documents', { method: 'POST', body: payload })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Unable to upload document')
      }
      setDocuments(current => [data.document, ...current])
      setDocumentForm(current => ({ ...current, expires_on: '', file: null }))
      toast({ title: 'Document uploaded', variant: 'success' })
      router.refresh()
    } catch (error: unknown) {
      toast({ title: 'Upload failed', description: error instanceof Error ? error.message : 'Unable to upload document', variant: 'error' })
    } finally {
      setUploading(false)
    }
  }

  const documentsByEmployee = documents.reduce<Record<string, number>>((acc, document) => {
    if (!document.employee_id) return acc
    acc[document.employee_id] = (acc[document.employee_id] || 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[420px,1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Employee' : 'Add Employee'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-3">
              <Input label="Name" value={form.name} onChange={e => updateForm('name', e.target.value)} required />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Email" type="email" value={form.email} onChange={e => updateForm('email', e.target.value)} />
                <Input label="Phone" value={form.phone} onChange={e => updateForm('phone', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Department" value={form.department} onChange={e => updateForm('department', e.target.value)} />
                <Input label="Designation" value={form.designation} onChange={e => updateForm('designation', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Salary" type="number" min="0" value={form.salary} onChange={e => updateForm('salary', e.target.value)} />
                <Input label="Joining Date" type="date" value={form.joining_date} onChange={e => updateForm('joining_date', e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
                <select
                  value={form.status}
                  onChange={e => updateForm('status', e.target.value)}
                  className="h-9 w-full rounded-lg border border-gray-300 px-3 text-sm"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="on_leave">On Leave</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" loading={saving} className="flex-1">
                  <Plus className="h-4 w-4" />
                  {editingId ? 'Update Employee' : 'Add Employee'}
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Employee Directory</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                    <th className="px-3 py-2">Employee</th>
                    <th className="px-3 py-2">Department</th>
                    <th className="px-3 py-2">Joining</th>
                    <th className="px-3 py-2">Salary</th>
                    <th className="px-3 py-2">Docs</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map(employee => (
                    <tr key={employee.id} className="border-b border-gray-50">
                      <td className="px-3 py-3">
                        <p className="font-medium text-gray-900">{employee.name}</p>
                        <p className="text-xs text-gray-400">{employee.email || 'No email'}{employee.phone ? ` · ${employee.phone}` : ''}</p>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium text-gray-700">{employee.department || 'Unassigned'}</p>
                        <p className="text-xs text-gray-400">{employee.designation || '—'}</p>
                      </td>
                      <td className="px-3 py-3 text-gray-600">{formatDate(employee.joining_date)}</td>
                      <td className="px-3 py-3 text-gray-700">{employee.salary ? formatCurrency(employee.salary) : '—'}</td>
                      <td className="px-3 py-3 text-gray-700">{documentsByEmployee[employee.id] || 0}</td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => startEdit(employee)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => handleDelete(employee.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {employees.length === 0 && (
                    <tr>
                      <td className="px-3 py-10 text-center text-sm text-gray-400" colSpan={6}>
                        No employees added yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Employee Document</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleDocumentUpload} className="grid gap-3 lg:grid-cols-[1.2fr,1fr,1fr,1.2fr,auto]">
            <Select value={documentForm.employee_id} onValueChange={value => setDocumentForm(current => ({ ...current, employee_id: value }))}>
              <SelectTrigger label="Employee">
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map(employee => (
                  <SelectItem key={employee.id} value={employee.id}>{employee.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={documentForm.doc_type} onValueChange={value => setDocumentForm(current => ({ ...current, doc_type: value }))}>
              <SelectTrigger label="Document Type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HR_DOCUMENT_TYPES.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              label="Expiry"
              type="date"
              value={documentForm.expires_on}
              onChange={e => setDocumentForm(current => ({ ...current, expires_on: e.target.value }))}
            />
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">File</label>
              <input
                type="file"
                onChange={e => setDocumentForm(current => ({ ...current, file: e.target.files?.[0] || null }))}
                className="block h-9 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" loading={uploading} className="w-full lg:w-auto">
                <Upload className="h-4 w-4" />
                Upload
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
