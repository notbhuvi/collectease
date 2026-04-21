'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

export function BusinessSetupForm({ userId }: { userId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: 'Samwha India Refractories Pvt. Ltd.',
    gstin: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
  })

  function update(key: string, val: string) {
    setForm(p => ({ ...p, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Business name is required'); return }
    setError('')
    setLoading(true)
    try {
      const supabase = createClient()
      const { error: dbError } = await supabase
        .from('businesses')
        .insert({ user_id: userId, ...form })

      if (dbError) throw new Error(dbError.message)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Failed to create business profile')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-50 mb-4">
            <Building2 className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Set Up Your Business Profile</h1>
          <p className="text-sm text-gray-500 mt-2">
            This is required once to start creating invoices and managing clients.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Business Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Business Name *"
                value={form.name}
                onChange={e => update('name', e.target.value)}
                placeholder="Samwha India Refractories Pvt. Ltd."
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="GSTIN"
                  value={form.gstin}
                  onChange={e => update('gstin', e.target.value)}
                  placeholder="22AAAAA0000A1Z5"
                />
                <Input
                  label="Phone"
                  value={form.phone}
                  onChange={e => update('phone', e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </div>
              <Input
                label="Email"
                type="email"
                value={form.email}
                onChange={e => update('email', e.target.value)}
                placeholder="accounts@sirpl.in"
              />
              <Input
                label="Address"
                value={form.address}
                onChange={e => update('address', e.target.value)}
                placeholder="Street address"
              />
              <div className="grid grid-cols-3 gap-3">
                <Input
                  label="City"
                  value={form.city}
                  onChange={e => update('city', e.target.value)}
                  placeholder="Mumbai"
                />
                <Input
                  label="State"
                  value={form.state}
                  onChange={e => update('state', e.target.value)}
                  placeholder="Maharashtra"
                />
                <Input
                  label="Pincode"
                  value={form.pincode}
                  onChange={e => update('pincode', e.target.value)}
                  placeholder="400001"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Setting up...</>
                ) : (
                  <><Building2 className="h-4 w-4 mr-2" />Create Business Profile</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
