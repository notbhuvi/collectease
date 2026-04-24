'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import type { RawMaterial, RawMaterialTransaction } from '@/types'

export function RawMaterialsManager({
  materials,
  transactions,
  balances,
}: {
  materials: RawMaterial[]
  transactions: RawMaterialTransaction[]
  balances: Array<RawMaterial & { current_stock: number; stock_value: number; low_stock: boolean }>
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [materialForm, setMaterialForm] = useState({ material_name: '', unit: 'kg', min_level: '' })
  const [txnForm, setTxnForm] = useState({
    material_id: materials[0]?.id || '',
    date: new Date().toISOString().slice(0, 10),
    type: 'inward',
    qty: '',
    rate: '',
    remarks: '',
  })
  const ledger = useMemo(() => [...transactions].sort((a, b) => b.date.localeCompare(a.date)), [transactions])

  async function handleMaterialSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/plant/raw-materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'material', ...materialForm, min_level: Number(materialForm.min_level || 0) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      toast({ title: 'Material created', variant: 'success' })
      window.location.reload()
    } catch (error: any) {
      toast({ title: 'Unable to save material', description: error.message, variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  async function handleTxnSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/plant/raw-materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'transaction',
          ...txnForm,
          qty: Number(txnForm.qty || 0),
          rate: txnForm.rate ? Number(txnForm.rate) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      toast({ title: 'Transaction added', variant: 'success' })
      window.location.reload()
    } catch (error: any) {
      toast({ title: 'Unable to save transaction', description: error.message, variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        {balances.slice(0, 3).map(item => (
          <Card key={item.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.material_name}</p>
                  <p className="mt-1 text-xs text-gray-500">Current stock: {item.current_stock} {item.unit}</p>
                </div>
                {item.low_stock && <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">Low</span>}
              </div>
              <p className="mt-4 text-lg font-bold text-gray-900">₹{Math.round(item.stock_value).toLocaleString('en-IN')}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px,360px,1fr]">
        <Card>
          <CardHeader><CardTitle>Material master</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleMaterialSubmit} className="space-y-3">
              <Input label="Material name" value={materialForm.material_name} onChange={e => setMaterialForm(prev => ({ ...prev, material_name: e.target.value }))} required />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Unit" value={materialForm.unit} onChange={e => setMaterialForm(prev => ({ ...prev, unit: e.target.value }))} required />
                <Input label="Min level" type="number" step="0.001" value={materialForm.min_level} onChange={e => setMaterialForm(prev => ({ ...prev, min_level: e.target.value }))} required />
              </div>
              <Button type="submit" className="w-full" loading={loading}>Add Material</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Stock transaction</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleTxnSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Material</label>
                <select value={txnForm.material_id} onChange={e => setTxnForm(prev => ({ ...prev, material_id: e.target.value }))} className="h-9 w-full rounded-lg border border-gray-300 px-3 text-sm">
                  {materials.map(material => <option key={material.id} value={material.id}>{material.material_name}</option>)}
                </select>
              </div>
              <Input label="Date" type="date" value={txnForm.date} onChange={e => setTxnForm(prev => ({ ...prev, date: e.target.value }))} required />
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Type</label>
                <select value={txnForm.type} onChange={e => setTxnForm(prev => ({ ...prev, type: e.target.value }))} className="h-9 w-full rounded-lg border border-gray-300 px-3 text-sm">
                  {['opening', 'inward', 'consumed', 'adjustment'].map(type => <option key={type}>{type}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Quantity" type="number" step="0.001" value={txnForm.qty} onChange={e => setTxnForm(prev => ({ ...prev, qty: e.target.value }))} required />
                <Input label="Rate" type="number" step="0.01" value={txnForm.rate} onChange={e => setTxnForm(prev => ({ ...prev, rate: e.target.value }))} />
              </div>
              <Input label="Remarks" value={txnForm.remarks} onChange={e => setTxnForm(prev => ({ ...prev, remarks: e.target.value }))} />
              <Button type="submit" className="w-full" loading={loading}>Post Transaction</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Current stock & ledger</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                    <th className="px-3 py-2">Material</th>
                    <th className="px-3 py-2">Stock</th>
                    <th className="px-3 py-2">Min</th>
                    <th className="px-3 py-2">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.map(item => (
                    <tr key={item.id} className="border-b border-gray-50">
                      <td className="px-3 py-3 font-medium text-gray-900">{item.material_name}</td>
                      <td className="px-3 py-3">{item.current_stock} {item.unit}</td>
                      <td className="px-3 py-3">{item.min_level}</td>
                      <td className="px-3 py-3">₹{Math.round(item.stock_value).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Qty</th>
                    <th className="px-3 py-2">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map(item => (
                    <tr key={item.id} className="border-b border-gray-50">
                      <td className="px-3 py-3">{item.date}</td>
                      <td className="px-3 py-3 capitalize">{item.type}</td>
                      <td className="px-3 py-3">{item.qty}</td>
                      <td className="px-3 py-3">{item.remarks || '—'}</td>
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
