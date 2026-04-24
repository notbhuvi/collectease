'use client'

import { useMemo, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import type { WarehouseItem } from '@/types'

const blank = {
  item_name: '',
  sku: '',
  category: '',
  unit: 'Nos',
  opening_stock: '',
  reserved_stock: '',
  min_level: '',
  unit_rate: '',
}

export function WarehouseStockManager({ items }: { items: WarehouseItem[] }) {
  const { toast } = useToast()
  const [form, setForm] = useState(blank)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const categories = [...new Set(items.map(item => item.category).filter(Boolean))] as string[]
  const filtered = useMemo(() => items.filter(item => {
    const matchesQuery = !query || [item.item_name, item.sku].join(' ').toLowerCase().includes(query.toLowerCase())
    const matchesCategory = !category || item.category === category
    return matchesQuery && matchesCategory
  }), [items, query, category])

  function startEdit(item: WarehouseItem) {
    setEditingId(item.id)
    setForm({
      item_name: item.item_name,
      sku: item.sku || '',
      category: item.category || '',
      unit: item.unit,
      opening_stock: String(item.opening_stock),
      reserved_stock: String(item.reserved_stock),
      min_level: String(item.min_level),
      unit_rate: String(item.unit_rate),
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/plant/warehouse-items', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          ...form,
          opening_stock: Number(form.opening_stock || 0),
          reserved_stock: Number(form.reserved_stock || 0),
          min_level: Number(form.min_level || 0),
          unit_rate: Number(form.unit_rate || 0),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Unable to save item')
      toast({ title: editingId ? 'Item updated' : 'Item created', variant: 'success' })
      window.location.reload()
    } catch (error: any) {
      toast({ title: 'Save failed', description: error.message, variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this warehouse item?')) return
    try {
      const res = await fetch('/api/plant/warehouse-items', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      toast({ title: 'Item deleted', variant: 'success' })
      window.location.reload()
    } catch (error: any) {
      toast({ title: 'Delete failed', description: error.message, variant: 'error' })
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[400px,1fr]">
      <Card>
        <CardHeader><CardTitle>{editingId ? 'Edit warehouse item' : 'Add warehouse item'}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input label="Item name" value={form.item_name} onChange={e => setForm(prev => ({ ...prev, item_name: e.target.value }))} required />
            <div className="grid grid-cols-2 gap-3">
              <Input label="SKU" value={form.sku} onChange={e => setForm(prev => ({ ...prev, sku: e.target.value }))} />
              <Input label="Category" value={form.category} onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Unit" value={form.unit} onChange={e => setForm(prev => ({ ...prev, unit: e.target.value }))} required />
              <Input label="Opening stock" type="number" step="0.001" value={form.opening_stock} onChange={e => setForm(prev => ({ ...prev, opening_stock: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Input label="Reserved" type="number" step="0.001" value={form.reserved_stock} onChange={e => setForm(prev => ({ ...prev, reserved_stock: e.target.value }))} required />
              <Input label="Min level" type="number" step="0.001" value={form.min_level} onChange={e => setForm(prev => ({ ...prev, min_level: e.target.value }))} required />
              <Input label="Unit rate" type="number" step="0.01" value={form.unit_rate} onChange={e => setForm(prev => ({ ...prev, unit_rate: e.target.value }))} required />
            </div>
            <div className="flex gap-2">
              <Button type="submit" loading={loading} className="flex-1">{editingId ? 'Update Item' : 'Save Item'}</Button>
              {editingId && <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm(blank) }}>Cancel</Button>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>SKU wise stock</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Input placeholder="Search item / SKU" value={query} onChange={e => setQuery(e.target.value)} />
            <select value={category} onChange={e => setCategory(e.target.value)} className="h-9 rounded-lg border border-gray-300 px-3 text-sm">
              <option value="">All categories</option>
              {categories.map(option => <option key={option}>{option}</option>)}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Current</th>
                  <th className="px-3 py-2">Reserved</th>
                  <th className="px-3 py-2">Free stock</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id} className="border-b border-gray-50">
                    <td className="px-3 py-3">
                      <p className="font-medium text-gray-900">{item.item_name}</p>
                      <p className="text-xs text-gray-400">{item.sku || 'No SKU'}</p>
                    </td>
                    <td className="px-3 py-3">{item.category || '—'}</td>
                    <td className="px-3 py-3">{item.current_stock} {item.unit}</td>
                    <td className="px-3 py-3">{item.reserved_stock}</td>
                    <td className="px-3 py-3 font-medium text-emerald-700">{Number(item.current_stock) - Number(item.reserved_stock)}</td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => startEdit(item)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => handleDelete(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
  )
}
