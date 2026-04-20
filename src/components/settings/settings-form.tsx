'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { Building2, User, AlertTriangle, Loader2, Eye, EyeOff, Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'

interface SettingsFormProps {
  business: any
  userEmail: string
}

export function SettingsForm({ business, userEmail }: SettingsFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { theme, setTheme } = useTheme()
  const [loading, setLoading] = useState(false)

  // Reset state
  const [showReset, setShowReset] = useState(false)
  const [resetPassword, setResetPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  async function handleReset() {
    if (!resetPassword) return
    setResetLoading(true)
    try {
      const res = await fetch('/api/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: resetPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: 'Dashboard reset', description: 'All invoices, clients and payments have been deleted.', variant: 'success' })
      setShowReset(false)
      setResetPassword('')
      router.refresh()
    } catch (err: any) {
      toast({ title: 'Reset failed', description: err.message, variant: 'error' })
    } finally {
      setResetLoading(false)
    }
  }
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

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-4 w-4 text-gray-400" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-3">Choose how SIRPL looks on this device.</p>
          <div className="grid grid-cols-3 gap-3">
            {([
              { value: 'light', label: 'Light', icon: Sun },
              { value: 'dark',  label: 'Dark',  icon: Moon },
              { value: 'system', label: 'System', icon: Monitor },
            ] as const).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  theme === value
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button type="submit" loading={loading}>
        Save Changes
      </Button>

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-4 w-4" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!showReset ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Reset Dashboard</p>
                <p className="text-xs text-gray-500 mt-0.5">Permanently delete all clients, invoices, payments and reminders. Your account and business profile will remain.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowReset(true)}
                className="ml-4 shrink-0 px-4 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
              >
                Reset Data
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm font-semibold text-red-700">⚠️ This action cannot be undone</p>
                <p className="text-xs text-red-600 mt-1">All clients, invoices, payments and reminder history will be permanently deleted.</p>
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Enter your password to confirm</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={resetPassword}
                    onChange={e => setResetPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleReset()}
                    placeholder="Your account password"
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={!resetPassword || resetLoading}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {resetLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {resetLoading ? 'Resetting…' : 'Yes, Reset Everything'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowReset(false); setResetPassword('') }}
                  disabled={resetLoading}
                  className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </form>
  )
}
