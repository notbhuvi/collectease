'use client'

import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { HR_ATTENDANCE_STATUSES } from '@/lib/hr-constants'
import type { AttendanceRecord, Employee } from '@/types'

export function AttendanceManager({
  employees,
  initialRecords,
}: {
  employees: Employee[]
  initialRecords: AttendanceRecord[]
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [records, setRecords] = useState(initialRecords)
  const [saving, setSaving] = useState(false)
  const [filters, setFilters] = useState({ employee_id: '', date: '' })
  const [form, setForm] = useState({
    employee_id: employees[0]?.id || '',
    date: new Date().toISOString().slice(0, 10),
    status: 'present' as string,
    check_in: '',
    check_out: '',
    biometric_ref: '',
  })

  const filteredRecords = useMemo(() => records.filter(record => {
    const matchesEmployee = !filters.employee_id || record.employee_id === filters.employee_id
    const matchesDate = !filters.date || record.date === filters.date
    return matchesEmployee && matchesDate
  }), [records, filters])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/hr/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          check_in: form.check_in ? `${form.date}T${form.check_in}:00` : null,
          check_out: form.check_out ? `${form.date}T${form.check_out}:00` : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Unable to mark attendance')
      }

      setRecords(current => {
        const existingIndex = current.findIndex(item => item.employee_id === data.attendance.employee_id && item.date === data.attendance.date)
        if (existingIndex >= 0) {
          const next = [...current]
          next[existingIndex] = data.attendance
          return next
        }
        return [data.attendance, ...current]
      })
      toast({ title: 'Attendance saved', variant: 'success' })
      router.refresh()
    } catch (error: unknown) {
      toast({ title: 'Save failed', description: error instanceof Error ? error.message : 'Unable to save attendance', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this attendance record?')) return
    try {
      const res = await fetch('/api/hr/attendance', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Unable to delete attendance')
      }
      setRecords(current => current.filter(record => record.id !== id))
      toast({ title: 'Attendance deleted', variant: 'success' })
      router.refresh()
    } catch (error: unknown) {
      toast({ title: 'Delete failed', description: error instanceof Error ? error.message : 'Unable to delete attendance', variant: 'error' })
    }
  }

  function toTime(value: string | null) {
    if (!value) return '—'
    return value.slice(11, 16)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Mark Attendance</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="grid gap-3 xl:grid-cols-[1.2fr,1fr,1fr,1fr,1fr,1fr,auto]">
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
            <Input label="Date" type="date" value={form.date} onChange={e => setForm(current => ({ ...current, date: e.target.value }))} />
            <Select value={form.status} onValueChange={value => setForm(current => ({ ...current, status: value }))}>
              <SelectTrigger label="Status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HR_ATTENDANCE_STATUSES.map(status => (
                  <SelectItem key={status} value={status}>{status.replace('_', ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input label="Check In" type="time" value={form.check_in} onChange={e => setForm(current => ({ ...current, check_in: e.target.value }))} />
            <Input label="Check Out" type="time" value={form.check_out} onChange={e => setForm(current => ({ ...current, check_out: e.target.value }))} />
            <Input label="Biometric Ref" value={form.biometric_ref} onChange={e => setForm(current => ({ ...current, biometric_ref: e.target.value }))} placeholder="Optional" />
            <div className="flex items-end">
              <Button type="submit" loading={saving} className="w-full xl:w-auto">Save</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daily Records</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Select value={filters.employee_id} onValueChange={value => setFilters(current => ({ ...current, employee_id: value === 'all' ? '' : value }))}>
              <SelectTrigger label="Employee Filter">
                <SelectValue placeholder="All employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All employees</SelectItem>
                {employees.map(employee => (
                  <SelectItem key={employee.id} value={employee.id}>{employee.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input label="Date Filter" type="date" value={filters.date} onChange={e => setFilters(current => ({ ...current, date: e.target.value }))} />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Check In</th>
                  <th className="px-3 py-2">Check Out</th>
                  <th className="px-3 py-2">Biometric</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map(record => (
                  <tr key={record.id} className="border-b border-gray-50">
                    <td className="px-3 py-3">
                      <p className="font-medium text-gray-900">{record.employee?.name || 'Employee'}</p>
                      <p className="text-xs text-gray-400">{record.employee?.department || 'Department pending'}</p>
                    </td>
                    <td className="px-3 py-3 text-gray-700">{record.date}</td>
                    <td className="px-3 py-3 capitalize text-gray-700">{record.status.replace('_', ' ')}</td>
                    <td className="px-3 py-3 text-gray-700">{toTime(record.check_in)}</td>
                    <td className="px-3 py-3 text-gray-700">{toTime(record.check_out)}</td>
                    <td className="px-3 py-3 text-gray-500">{record.biometric_ref || '—'}</td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end">
                        <Button type="button" size="sm" variant="outline" onClick={() => handleDelete(record.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredRecords.length === 0 && (
                  <tr>
                    <td className="px-3 py-10 text-center text-sm text-gray-400" colSpan={7}>
                      No attendance records for the current filter.
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
