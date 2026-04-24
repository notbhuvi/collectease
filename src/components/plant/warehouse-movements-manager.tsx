'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import type { WarehouseItem, WarehouseMovement } from '@/types'

export function WarehouseMovementsManager({
  items,
  movements,
}: {
  items: WarehouseItem[]
  movements: WarehouseMovement[]
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    item_id: items[0]?.id || '',
    date: new Date().toISOString().slice(0, 10),
    type: 'inward',
    qty: '',
    reference_no: '',
    remarks: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/plant/warehouse-movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, qty: Number(form.qty || 0) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Unable to save movement')
      toast({ title: 'Movement added', variant: 'success' })
      window.location.reload()
    } catch (error: any) {
      toast({ title: 'Save failed', description: error.message, variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[400px,1fr]">
      <Card>
        <CardHeader><CardTitle>Warehouse movement</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Item</label>
              <select value={form.item_id} onChange={e => setForm(prev => ({ ...prev, item_id: e.target.value }))} className="h-9 w-full rounded-lg border border-gray-300 px-3 text-sm">
                {items.map(item => <option key={item.id} value={item.id}>{item.item_name}</option>)}
              </select>
            </div>
            <Input label="Date" type="date" value={form.date} onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))} required />
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Type</label>
              <select value={form.type} onChange={e => setForm(prev => ({ ...prev, type: e.target.value }))} className="h-9 w-full rounded-lg border border-gray-300 px-3 text-sm">
                {['inward', 'outward', 'adjustment'].map(option => <option key={option}>{option}</option>)}
              </select>
            </div>
            <Input label="Quantity" type="number" step="0.001" value={form.qty} onChange={e => setForm(prev => ({ ...prev, qty: e.target.value }))} required />
            <Input label="Reference no" value={form.reference_no} onChange={e => setForm(prev => ({ ...prev, reference_no: e.target.value }))} />
            <Input label="Remarks" value={form.remarks} onChange={e => setForm(prev => ({ ...prev, remarks: e.target.value }))} />
            <Button type="submit" className="w-full" loading={loading}>Save Movement</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Item ledger</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Qty</th>
                  <th className="px-3 py-2">Reference</th>
                  <th className="px-3 py-2">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {movements.map(movement => {
                  const item = items.find(row => row.id === movement.item_id)
                  return (
                    <tr key={movement.id} className="border-b border-gray-50">
                      <td className="px-3 py-3">{movement.date}</td>
                      <td className="px-3 py-3">{item?.item_name || '—'}</td>
                      <td className="px-3 py-3 capitalize">{movement.type}</td>
                      <td className="px-3 py-3">{movement.qty}</td>
                      <td className="px-3 py-3">{movement.reference_no || '—'}</td>
                      <td className="px-3 py-3">{movement.remarks || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
