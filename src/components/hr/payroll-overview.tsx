'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import type { AttendanceRecord, Employee, LeaveRecord } from '@/types'

export function PayrollOverview({
  employees,
  attendance,
  leaves,
}: {
  employees: Employee[]
  attendance: AttendanceRecord[]
  leaves: LeaveRecord[]
}) {
  const summary = useMemo(() => {
    const monthPrefix = new Date().toISOString().slice(0, 7)
    const workingDays = new Date().getDate()

    const rows = employees.map(employee => {
      const monthlyAttendance = attendance.filter(record =>
        record.employee_id === employee.id &&
        record.date.startsWith(monthPrefix) &&
        ['present', 'remote', 'half_day'].includes(record.status)
      )
      const approvedLeaves = leaves.filter(leave =>
        leave.employee_id === employee.id &&
        leave.status === 'approved' &&
        leave.from_date.startsWith(monthPrefix)
      ).length
      const attendanceDays = monthlyAttendance.reduce((sum, record) => sum + (record.status === 'half_day' ? 0.5 : 1), 0)
      const attendancePct = workingDays > 0 ? Math.min(100, Math.round((attendanceDays / workingDays) * 100)) : 0
      const projectedPay = Number(employee.salary || 0) * (attendancePct / 100)

      return {
        employee,
        attendanceDays,
        attendancePct,
        approvedLeaves,
        projectedPay,
      }
    })

    const totalGross = rows.reduce((sum, row) => sum + Number(row.employee.salary || 0), 0)
    const totalProjected = rows.reduce((sum, row) => sum + row.projectedPay, 0)

    return { rows, totalGross, totalProjected, workingDays }
  }, [attendance, employees, leaves])

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Monthly Gross</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{formatCurrency(summary.totalGross)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Projected Payout</p>
            <p className="mt-2 text-2xl font-bold text-rose-700">{formatCurrency(summary.totalProjected)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Working Days Counted</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{summary.workingDays}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payroll Sheet</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2">Department</th>
                  <th className="px-3 py-2">Base Salary</th>
                  <th className="px-3 py-2">Attendance</th>
                  <th className="px-3 py-2">Approved Leaves</th>
                  <th className="px-3 py-2">Projected Pay</th>
                </tr>
              </thead>
              <tbody>
                {summary.rows.map(row => (
                  <tr key={row.employee.id} className="border-b border-gray-50">
                    <td className="px-3 py-3">
                      <p className="font-medium text-gray-900">{row.employee.name}</p>
                      <p className="text-xs text-gray-400">{row.employee.designation || 'Designation pending'}</p>
                    </td>
                    <td className="px-3 py-3 text-gray-600">{row.employee.department || 'Unassigned'}</td>
                    <td className="px-3 py-3 text-gray-700">{formatCurrency(Number(row.employee.salary || 0))}</td>
                    <td className="px-3 py-3 text-gray-700">{row.attendanceDays} days ({row.attendancePct}%)</td>
                    <td className="px-3 py-3 text-gray-600">{row.approvedLeaves}</td>
                    <td className="px-3 py-3 font-semibold text-rose-700">{formatCurrency(row.projectedPay)}</td>
                  </tr>
                ))}
                {summary.rows.length === 0 && (
                  <tr>
                    <td className="px-3 py-10 text-center text-sm text-gray-400" colSpan={6}>
                      No employees available for payroll.
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
