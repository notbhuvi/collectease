'use client'

import { useMemo, useState } from 'react'
import { FileSpreadsheet, FileText, Pencil, Trash2 } from 'lucide-react'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import type { PlantProductionLog, ProductionShift } from '@/types'

const emptyForm = {
  date: new Date().toISOString().slice(0, 10),
  shift: 'General' as ProductionShift,
  product_name: '',
  sku: '',
  qty: '',
  unit: 'MT',
  machine: '',
  operator: '',
  remarks: '',
}

export function ProductionManager({ entries }: { entries: PlantProductionLog[] }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [date, setDate] = useState('')
  const [shift, setShift] = useState('')
  const [form, setForm] = useState(emptyForm)

  const filtered = useMemo(() => entries.filter(entry => {
    const matchesQuery = !query || [entry.product_name, entry.sku, entry.machine, entry.operator]
      .join(' ')
      .toLowerCase()
      .includes(query.toLowerCase())
    const matchesDate = !date || entry.date === date
    const matchesShift = !shift || entry.shift === shift
    return matchesQuery && matchesDate && matchesShift
  }), [entries, query, date, shift])

  const totals = {
    daily: filtered
      .filter(row => row.date === (date || new Date().toISOString().slice(0, 10)))
      .reduce((sum, row) => sum + Number(row.qty || 0), 0),
    monthly: filtered
      .filter(row => row.date.slice(0, 7) === new Date().toISOString().slice(0, 7))
      .reduce((sum, row) => sum + Number(row.qty || 0), 0),
    byProduct: Object.entries(filtered.reduce<Record<string, number>>((acc, row) => {
      acc[row.product_name] = (acc[row.product_name] || 0) + Number(row.qty || 0)
      return acc
    }, {})).slice(0, 4),
    byMachine: Object.entries(filtered.reduce<Record<string, number>>((acc, row) => {
      const key = row.machine || 'Unassigned'
      acc[key] = (acc[key] || 0) + Number(row.qty || 0)
      return acc
    }, {})).slice(0, 4),
  }

  function update(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/plant/production', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, ...form, qty: Number(form.qty || 0) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      toast({ title: editingId ? 'Production entry updated' : 'Production entry added', variant: 'success' })
      window.location.reload()
    } catch (error: any) {
      toast({ title: 'Unable to save entry', description: error.message, variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  function startEdit(entry: PlantProductionLog) {
    setEditingId(entry.id)
    setForm({
      date: entry.date,
      shift: entry.shift,
      product_name: entry.product_name,
      sku: entry.sku || '',
      qty: String(entry.qty),
      unit: entry.unit,
      machine: entry.machine || '',
      operator: entry.operator || '',
      remarks: entry.remarks || '',
    })
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this production entry?')) return
    try {
      const res = await fetch('/api/plant/production', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      toast({ title: 'Entry deleted', variant: 'success' })
      window.location.reload()
    } catch (error: any) {
      toast({ title: 'Delete failed', description: error.message, variant: 'error' })
    }
  }

  function exportExcel() {
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(filtered)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Production')
    XLSX.writeFile(workbook, `production-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  function exportPdf() {
    const doc = new jsPDF()
    doc.text('Production Report', 14, 14)
    autoTable(doc, {
      startY: 20,
      head: [['Date', 'Shift', 'Product', 'SKU', 'Qty', 'Machine', 'Operator']],
      body: filtered.map(row => [row.date, row.shift, row.product_name, row.sku || '-', row.qty, row.machine || '-', row.operator || '-']),
    })
    doc.save(`production-${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-gray-500">Daily production total</p><p className="mt-2 text-2xl font-bold text-gray-900">{totals.daily}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-gray-500">Monthly total</p><p className="mt-2 text-2xl font-bold text-gray-900">{totals.monthly}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-gray-500">Top product</p><p className="mt-2 text-lg font-semibold text-gray-900">{totals.byProduct[0]?.[0] || '—'}</p><p className="text-xs text-gray-400">{totals.byProduct[0]?.[1] || 0} qty</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-gray-500">Best machine</p><p className="mt-2 text-lg font-semibold text-gray-900">{totals.byMachine[0]?.[0] || '—'}</p><p className="text-xs text-gray-400">{totals.byMachine[0]?.[1] || 0} qty</p></CardContent></Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px,1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit production entry' : 'Add production entry'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <Input label="Date" type="date" value={form.date} onChange={e => update('date', e.target.value)} required />
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Shift</label>
                <select value={form.shift} onChange={e => update('shift', e.target.value)} className="h-9 w-full rounded-lg border border-gray-300 px-3 text-sm">
                  {['A', 'B', 'C', 'General'].map(option => <option key={option}>{option}</option>)}
                </select>
              </div>
              <Input label="Product name" value={form.product_name} onChange={e => update('product_name', e.target.value)} required />
              <div className="grid grid-cols-2 gap-3">
                <Input label="SKU" value={form.sku} onChange={e => update('sku', e.target.value)} />
                <Input label="Quantity" type="number" step="0.001" value={form.qty} onChange={e => update('qty', e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Unit" value={form.unit} onChange={e => update('unit', e.target.value)} required />
                <Input label="Machine" value={form.machine} onChange={e => update('machine', e.target.value)} />
              </div>
              <Input label="Operator" value={form.operator} onChange={e => update('operator', e.target.value)} />
              <Input label="Remarks" value={form.remarks} onChange={e => update('remarks', e.target.value)} />
              <div className="flex gap-2">
                <Button type="submit" loading={loading} className="flex-1">{editingId ? 'Update Entry' : 'Save Entry'}</Button>
                {editingId && (
                  <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm(emptyForm) }}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <CardTitle>Production ledger</CardTitle>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4" /> Export Excel</Button>
                <Button type="button" variant="outline" size="sm" onClick={exportPdf}><FileText className="h-4 w-4" /> Export PDF</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Input placeholder="Search product / machine" value={query} onChange={e => setQuery(e.target.value)} />
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
              <select value={shift} onChange={e => setShift(e.target.value)} className="h-9 rounded-lg border border-gray-300 px-3 text-sm">
                <option value="">All shifts</option>
                {['A', 'B', 'C', 'General'].map(option => <option key={option}>{option}</option>)}
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Shift</th>
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2">Qty</th>
                    <th className="px-3 py-2">Machine</th>
                    <th className="px-3 py-2">Operator</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(entry => (
                    <tr key={entry.id} className="border-b border-gray-50">
                      <td className="px-3 py-3">{entry.date}</td>
                      <td className="px-3 py-3">{entry.shift}</td>
                      <td className="px-3 py-3"><p className="font-medium text-gray-900">{entry.product_name}</p><p className="text-xs text-gray-400">{entry.sku || 'No SKU'}</p></td>
                      <td className="px-3 py-3">{entry.qty} {entry.unit}</td>
                      <td className="px-3 py-3">{entry.machine || '—'}</td>
                      <td className="px-3 py-3">{entry.operator || '—'}</td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => startEdit(entry)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => handleDelete(entry.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
