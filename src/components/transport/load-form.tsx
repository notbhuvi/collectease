'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { PlusCircle } from 'lucide-react'
import { TRANSPORT_QUANTITY_UNITS } from '@/lib/transport'

export function TransportLoadForm() {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    pickup_location: '', drop_location: '', material: '', quantity_value: '', quantity_unit: 'MT',
    vehicle_type: '', pickup_date: '', bidding_deadline: '', notes: '',
  })

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/transport/loads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: 'Load created', description: 'Transporters can now bid on this load.', variant: 'success' })
      setOpen(false)
      setForm({ pickup_location: '', drop_location: '', material: '', quantity_value: '', quantity_unit: 'MT', vehicle_type: '', pickup_date: '', bidding_deadline: '', notes: '' })
      router.refresh()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const vehicleTypes = ['10 Wheeler', '12 Wheeler', '14 Wheeler', '16 Wheeler', 'Trailer', 'Mini Truck', 'Container', 'Tanker', 'Flatbed']

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusCircle className="h-4 w-4" />
        New Load
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Create New Load / Tender</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Pickup Location" placeholder="e.g. Bhilai, CG" value={form.pickup_location} onChange={e => set('pickup_location', e.target.value)} required />
              <Input label="Drop Location" placeholder="e.g. Nagpur, MH" value={form.drop_location} onChange={e => set('drop_location', e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Material" placeholder="e.g. Refractory Bricks" value={form.material} onChange={e => set('material', e.target.value)} required />
              <Input
                label="Quantity"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="e.g. 20"
                value={form.quantity_value}
                onChange={e => set('quantity_value', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity Unit</label>
              <select
                className="w-full h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={form.quantity_unit}
                onChange={e => set('quantity_unit', e.target.value)}
                required
              >
                {TRANSPORT_QUANTITY_UNITS.map(unit => <option key={unit} value={unit}>{unit}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Type</label>
              <select
                className="w-full h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={form.vehicle_type}
                onChange={e => set('vehicle_type', e.target.value)}
                required
              >
                <option value="">Select vehicle type</option>
                {vehicleTypes.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Pickup Date" type="date" value={form.pickup_date} onChange={e => set('pickup_date', e.target.value)} required />
              <Input label="Bidding Deadline" type="datetime-local" value={form.bidding_deadline} onChange={e => set('bidding_deadline', e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
              <textarea
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={2}
                placeholder="Any special requirements..."
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
              />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" loading={loading}>Create Load</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
