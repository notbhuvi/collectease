'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { Edit2 } from 'lucide-react'
import { TRANSPORT_QUANTITY_UNITS, getLoadQuantity, formatQuantityValue } from '@/lib/transport'

interface Props {
  load: {
    id: string
    pickup_location: string
    drop_location: string
    material: string
    weight: string
    quantity_value?: number | null
    quantity_unit?: string | null
    vehicle_type: string
    pickup_date: string
    bidding_deadline: string
    notes: string | null
  }
}

const vehicleTypes = ['10 Wheeler', '12 Wheeler', '14 Wheeler', '16 Wheeler', 'Trailer', 'Mini Truck', 'Container', 'Tanker', 'Flatbed']

function toDateTimeLocal(value: string) {
  const date = new Date(value)
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 16)
}

export function EditLoadButton({ load }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const initialQuantity = getLoadQuantity(load)
  const [form, setForm] = useState({
    pickup_location: load.pickup_location,
    drop_location: load.drop_location,
    material: load.material,
    quantity_value: formatQuantityValue(initialQuantity.quantityValue),
    quantity_unit: initialQuantity.quantityUnit,
    vehicle_type: load.vehicle_type,
    pickup_date: load.pickup_date,
    bidding_deadline: toDateTimeLocal(load.bidding_deadline),
    notes: load.notes || '',
  })

  function update(field: string, value: string) {
    setForm(current => ({ ...current, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch(`/api/transport/loads/${load.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      toast({
        title: 'Load updated',
        description: 'Transporters will see the latest details and receive an email notification.',
        variant: 'success',
      })
      setOpen(false)
      router.refresh()
    } catch (err: unknown) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update load',
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Edit2 className="h-4 w-4" />
        Edit Load
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Load During Bidding</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Pickup Location" value={form.pickup_location} onChange={e => update('pickup_location', e.target.value)} required />
              <Input label="Drop Location" value={form.drop_location} onChange={e => update('drop_location', e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Material" value={form.material} onChange={e => update('material', e.target.value)} required />
              <Input
                label="Quantity"
                type="number"
                min="0.01"
                step="0.01"
                value={form.quantity_value}
                onChange={e => update('quantity_value', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity Unit</label>
              <select
                className="w-full h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={form.quantity_unit}
                onChange={e => update('quantity_unit', e.target.value)}
                required
              >
                {TRANSPORT_QUANTITY_UNITS.map(unit => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Type</label>
              <select
                className="w-full h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                value={form.vehicle_type}
                onChange={e => update('vehicle_type', e.target.value)}
                required
              >
                <option value="">Select vehicle type</option>
                {vehicleTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Pickup Date" type="date" value={form.pickup_date} onChange={e => update('pickup_date', e.target.value)} required />
              <Input label="Bidding Deadline" type="datetime-local" value={form.bidding_deadline} onChange={e => update('bidding_deadline', e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
              <textarea
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
                value={form.notes}
                onChange={e => update('notes', e.target.value)}
              />
            </div>
            <p className="text-xs text-gray-400">
              Saving these changes will update the transporter portal immediately and email all transporters about the modified load.
            </p>
            <div className="flex gap-3 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" loading={loading}>Save Changes</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
