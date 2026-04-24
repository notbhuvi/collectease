'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import type { FgDispatch, FinishedGoodsStock, DispatchStatus } from '@/types'

export function DispatchManager({
  finishedGoods,
  dispatches,
}: {
  finishedGoods: FinishedGoodsStock[]
  dispatches: FgDispatch[]
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    customer_name: '',
    invoice_no: '',
    truck_no: '',
    destination: '',
    product_name: finishedGoods[0]?.product_name || '',
    sku: finishedGoods[0]?.sku || '',
    qty: '',
    remarks: '',
    status: 'completed' as DispatchStatus,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/plant/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, qty: Number(form.qty || 0) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Unable to create dispatch')
      toast({ title: 'Dispatch created', variant: 'success' })
      window.location.reload()
    } catch (error: any) {
      toast({ title: 'Dispatch failed', description: error.message, variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  async function updateStatus(id: string, status: DispatchStatus) {
    try {
      const res = await fetch('/api/plant/dispatch', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Unable to update')
      toast({ title: 'Dispatch updated', variant: 'success' })
      window.location.reload()
    } catch (error: any) {
      toast({ title: 'Status update failed', description: error.message, variant: 'error' })
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[420px,1fr]">
      <Card>
        <CardHeader><CardTitle>Create dispatch</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input label="Date" type="date" value={form.date} onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))} required />
            <Input label="Customer" value={form.customer_name} onChange={e => setForm(prev => ({ ...prev, customer_name: e.target.value }))} required />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Invoice no" value={form.invoice_no} onChange={e => setForm(prev => ({ ...prev, invoice_no: e.target.value }))} />
              <Input label="Truck no" value={form.truck_no} onChange={e => setForm(prev => ({ ...prev, truck_no: e.target.value }))} />
            </div>
            <Input label="Destination" value={form.destination} onChange={e => setForm(prev => ({ ...prev, destination: e.target.value }))} />
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Finished good</label>
              <select
                value={form.sku}
                onChange={e => {
                  const selected = finishedGoods.find(item => item.sku === e.target.value)
                  setForm(prev => ({ ...prev, sku: e.target.value, product_name: selected?.product_name || prev.product_name }))
                }}
                className="h-9 w-full rounded-lg border border-gray-300 px-3 text-sm"
              >
                {finishedGoods.map(item => (
                  <option key={item.id} value={item.sku || ''}>{item.product_name} ({item.qty})</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Product name" value={form.product_name} onChange={e => setForm(prev => ({ ...prev, product_name: e.target.value }))} required />
              <Input label="Qty" type="number" step="0.001" value={form.qty} onChange={e => setForm(prev => ({ ...prev, qty: e.target.value }))} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
              <select value={form.status} onChange={e => setForm(prev => ({ ...prev, status: e.target.value as DispatchStatus }))} className="h-9 w-full rounded-lg border border-gray-300 px-3 text-sm">
                {['pending', 'completed', 'cancelled'].map(item => <option key={item}>{item}</option>)}
              </select>
            </div>
            <Input label="Remarks" value={form.remarks} onChange={e => setForm(prev => ({ ...prev, remarks: e.target.value }))} />
            <Button type="submit" className="w-full" loading={loading}>Create Dispatch</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Dispatch records</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Qty</th>
                  <th className="px-3 py-2">Truck</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {dispatches.map(item => (
                  <tr key={item.id} className="border-b border-gray-50">
                    <td className="px-3 py-3">{item.date}</td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-gray-900">{item.customer_name}</p>
                      <p className="text-xs text-gray-400">{item.destination || '—'}</p>
                    </td>
                    <td className="px-3 py-3">{item.product_name}</td>
                    <td className="px-3 py-3">{item.qty}</td>
                    <td className="px-3 py-3">{item.truck_no || '—'}</td>
                    <td className="px-3 py-3">
                      <select value={item.status} onChange={e => updateStatus(item.id, e.target.value as DispatchStatus)} className="h-8 rounded-lg border border-gray-300 px-2 text-xs">
                        {['pending', 'completed', 'cancelled'].map(status => <option key={status}>{status}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
