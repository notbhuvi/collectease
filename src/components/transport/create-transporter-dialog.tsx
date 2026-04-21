'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { UserPlus, Eye, EyeOff, CheckCircle } from 'lucide-react'

export function CreateTransporterDialog() {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [created, setCreated] = useState<{ email: string; password: string; name: string } | null>(null)

  const [form, setForm] = useState({
    full_name: '',
    company_name: '',
    email: '',
    password: '',
  })

  function update(key: string, val: string) {
    setForm(p => ({ ...p, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.email || !form.password) {
      toast({ title: 'Email and password are required', variant: 'error' })
      return
    }
    if (form.password.length < 8) {
      toast({ title: 'Password must be at least 8 characters', variant: 'error' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, role: 'transporter' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCreated({ email: form.email, password: form.password, name: form.full_name || form.company_name || form.email })
      toast({ title: 'Transporter created!', variant: 'success' })
      router.refresh()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setOpen(false)
    setCreated(null)
    setForm({ full_name: '', company_name: '', email: '', password: '' })
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4" />
        Add Transporter
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Transporter</DialogTitle>
          </DialogHeader>

          {created ? (
            <div className="space-y-4 py-2">
              <div className="flex flex-col items-center text-center gap-2 py-2">
                <CheckCircle className="h-10 w-10 text-green-500" />
                <p className="font-medium text-gray-900">Transporter account created!</p>
                <p className="text-sm text-gray-500">Credentials emailed to {created.email}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Email</span>
                  <span className="font-medium">{created.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Password</span>
                  <span className="font-mono font-medium">{created.password}</span>
                </div>
              </div>
              <Button onClick={handleClose} className="w-full">Done</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <Input
                label="Full Name"
                value={form.full_name}
                onChange={e => update('full_name', e.target.value)}
                placeholder="Contact person name"
              />
              <Input
                label="Company Name"
                value={form.company_name}
                onChange={e => update('company_name', e.target.value)}
                placeholder="ABC Logistics Pvt. Ltd."
              />
              <Input
                label="Email *"
                type="email"
                value={form.email}
                onChange={e => update('email', e.target.value)}
                placeholder="transporter@company.com"
                required
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => update('password', e.target.value)}
                    className="w-full h-9 px-3 pr-10 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Minimum 8 characters"
                    required
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
                <Button type="submit" loading={loading}>
                  <UserPlus className="h-4 w-4" />
                  Create Account
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
