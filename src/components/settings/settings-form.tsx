'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { Building2, User, Bell } from 'lucide-react'

interface SettingsFormProps {
  business: any
  userEmail: string
}

export function SettingsForm({ business, userEmail }: SettingsFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: business?.name || '',
    gstin: business?.gstin || '',
    phone: business?.phone || '',
    email: business?.email || '',
    address: business?.address || '',
    city: business?.city || '',
    state: business?.state || '',
    pincode: business?.pincode || '',
  })

  function update(key: string, val: string) {
    setForm(p => ({ ...p, [key]: val }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/businesses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error)
      }

      toast({ title: 'Settings saved!', variant: 'success' })
      router.refresh()
    } catch (err: any) {
      toast({ title: 'Error saving settings', description: err.message, variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gray-400" />
            Business Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input label="Business Name" value={form.name} onChange={e => update('name', e.target.value)} required placeholder="Acme Pvt. Ltd." />
          <div className="grid grid-cols-2 gap-4">
            <Input label="GSTIN" value={form.gstin} onChange={e => update('gstin', e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5" />
            <Input label="Phone" type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+91 98765 43210" />
          </div>
          <Input label="Business Email" type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="billing@company.com" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input label="Street Address" value={form.address} onChange={e => update('address', e.target.value)} placeholder="123, Business Park, MG Road" />
          <div className="grid grid-cols-3 gap-4">
            <Input label="City" value={form.city} onChange={e => update('city', e.target.value)} placeholder="Mumbai" />
            <Input label="State" value={form.state} onChange={e => update('state', e.target.value)} placeholder="Maharashtra" />
            <Input label="PIN Code" value={form.pincode} onChange={e => update('pincode', e.target.value)} placeholder="400001" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-4 w-4 text-gray-400" />
            Account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input label="Account Email" value={userEmail} disabled hint="Contact support to change your account email" />
        </CardContent>
      </Card>

      <Button type="submit" loading={loading}>
        Save Changes
      </Button>
    </form>
  )
}
