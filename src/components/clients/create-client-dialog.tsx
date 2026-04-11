'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'

interface CreateClientDialogProps {
  open: boolean
  onClose: () => void
  businessId: string
  onCreated?: (client: any) => void
}

export function CreateClientDialog({ open, onClose, businessId, onCreated }: CreateClientDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '', email: '', phone: '', gstin: '',
    address: '', city: '', state: '', contactPerson: '',
  })

  function update(key: string, val: string) {
    setForm(p => ({ ...p, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: businessId,
          name: form.name,
          email: form.email || null,
          phone: form.phone || null,
          gstin: form.gstin || null,
          address: form.address || null,
          city: form.city || null,
          state: form.state || null,
          contact_person: form.contactPerson || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      toast({ title: 'Client created!', variant: 'success' })
      onCreated?.(data.client)
      onClose()
      setForm({ name: '', email: '', phone: '', gstin: '', address: '', city: '', state: '', contactPerson: '' })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New Client</DialogTitle>
          <DialogDescription>Enter client details to add them to your list</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 mt-2">
          <Input label="Client / Business Name" value={form.name} onChange={e => update('name', e.target.value)} required placeholder="ABC Enterprises" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Email" type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="billing@client.com" />
            <Input label="Phone" type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+91 98765 43210" />
          </div>
          <Input label="GSTIN" value={form.gstin} onChange={e => update('gstin', e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5" />
          <Input label="Contact Person" value={form.contactPerson} onChange={e => update('contactPerson', e.target.value)} placeholder="Mr. Ramesh Kumar" />
          <Input label="Address" value={form.address} onChange={e => update('address', e.target.value)} placeholder="123, MG Road" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="City" value={form.city} onChange={e => update('city', e.target.value)} placeholder="Mumbai" />
            <Input label="State" value={form.state} onChange={e => update('state', e.target.value)} placeholder="Maharashtra" />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" loading={loading} className="flex-1">Add Client</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
