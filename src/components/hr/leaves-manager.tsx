'use client'

import { useState } from 'react'
import { Check, X, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { HR_LEAVE_TYPES } from '@/lib/hr-constants'
import { formatDate } from '@/lib/utils'
import type { Employee, LeaveRecord } from '@/types'

export function LeavesManager({
  employees,
  initialLeaves,
}: {
  employees: Employee[]
  initialLeaves: LeaveRecord[]
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [leaves, setLeaves] = useState(initialLeaves)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    employee_id: employees[0]?.id || '',
    type: HR_LEAVE_TYPES[0] as string,
    from_date: new Date().toISOString().slice(0, 10),
    to_date: new Date().toISOString().slice(0, 10),
    reason: '',
  })

  async function handleApply(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/hr/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Unable to create leave request')
      }
      setLeaves(current => [data.leave, ...current])
      toast({ title: 'Leave request saved', variant: 'success' })
      router.refresh()
    } catch (error: unknown) {
      toast({ title: 'Save failed', description: error instanceof Error ? error.message : 'Unable to save leave', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(leave: LeaveRecord, status: 'approved' | 'rejected') {
    try {
      const res = await fetch('/api/hr/leaves', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: leave.id,
          employee_id: leave.employee_id,
          type: leave.type,
          from_date: leave.from_date,
          to_date: leave.to_date,
          reason: leave.reason,
          status,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || `Unable to ${status} leave`)
      }
      setLeaves(current => current.map(item => (item.id === leave.id ? data.leave : item)))
      toast({ title: `Leave ${status}`, variant: 'success' })
      router.refresh()
    } catch (error: unknown) {
      toast({ title: 'Update failed', description: error instanceof Error ? error.message : 'Unable to update leave', variant: 'error' })
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this leave entry?')) return
    try {
      const res = await fetch('/api/hr/leaves', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Unable to delete leave')
      }
      setLeaves(current => current.filter(item => item.id !== id))
      toast({ title: 'Leave deleted', variant: 'success' })
      router.refresh()
    } catch (error: unknown) {
      toast({ title: 'Delete failed', description: error instanceof Error ? error.message : 'Unable to delete leave', variant: 'error' })
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Apply Leave</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleApply} className="grid gap-3 lg:grid-cols-2">
            <Select value={form.employee_id} onValueChange={value => setForm(current => ({ ...current, employee_id: value }))}>
              <SelectTrigger label="Employee">
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map(employee => (
                  <SelectItem key={employee.id} value={employee.id}>{employee.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={form.type} onValueChange={value => setForm(current => ({ ...current, type: value }))}>
              <SelectTrigger label="Leave Type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HR_LEAVE_TYPES.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input label="From Date" type="date" value={form.from_date} onChange={e => setForm(current => ({ ...current, from_date: e.target.value }))} />
            <Input label="To Date" type="date" value={form.to_date} onChange={e => setForm(current => ({ ...current, to_date: e.target.value }))} />
            <div className="lg:col-span-2">
              <Textarea label="Reason" value={form.reason} onChange={e => setForm(current => ({ ...current, reason: e.target.value }))} placeholder="Reason for leave request" />
            </div>
            <div className="lg:col-span-2">
              <Button type="submit" loading={saving}>Submit Leave Request</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Leave History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Period</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map(leave => (
                  <tr key={leave.id} className="border-b border-gray-50">
                    <td className="px-3 py-3">
                      <p className="font-medium text-gray-900">{leave.employee?.name || 'Employee'}</p>
                      <p className="text-xs text-gray-400">{leave.employee?.department || 'Department pending'}</p>
                    </td>
                    <td className="px-3 py-3 text-gray-700">{leave.type}</td>
                    <td className="px-3 py-3 text-gray-600">
                      {formatDate(leave.from_date)} to {formatDate(leave.to_date)}
                    </td>
                    <td className="px-3 py-3 text-gray-500">{leave.reason || '—'}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        leave.status === 'approved'
                          ? 'bg-green-100 text-green-700'
                          : leave.status === 'rejected'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'
                      }`}>
                        {leave.status}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-2">
                        {leave.status === 'pending' && (
                          <>
                            <Button type="button" size="sm" variant="outline" onClick={() => updateStatus(leave, 'approved')}>
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => updateStatus(leave, 'rejected')}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        <Button type="button" size="sm" variant="outline" onClick={() => handleDelete(leave.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {leaves.length === 0 && (
                  <tr>
                    <td className="px-3 py-10 text-center text-sm text-gray-400" colSpan={6}>
                      No leave history yet.
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
