'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { UserPlus, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { ROLE_LABELS } from '@/lib/roles'
import type { UserRole } from '@/types'

const creatableRoles: UserRole[] = ['admin', 'accounts', 'transport_team', 'transporter', 'plant_ops']

const roleColors: Record<string, string> = {
  admin: 'border-violet-300 bg-violet-50 text-violet-700',
  accounts: 'border-blue-300 bg-blue-50 text-blue-700',
  transport_team: 'border-orange-300 bg-orange-50 text-orange-700',
  transporter: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  plant_ops: 'border-cyan-300 bg-cyan-50 text-cyan-700',
}

export function CreateUserForm() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [created, setCreated] = useState<{ email: string; role: string; password: string } | null>(null)
  const [showPw, setShowPw] = useState(false)

  const [form, setForm] = useState({
    email: '',
    password: '',
    role: 'accounts' as UserRole,
    full_name: '',
    company_name: '',
  })

  function update(key: string, val: string) {
    setForm(p => ({ ...p, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.email || !form.password || !form.role) {
      toast({ title: 'Fill all required fields', variant: 'error' })
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
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCreated({ email: form.email, role: form.role, password: form.password })
      toast({ title: 'User created!', description: `${form.email} has been added.`, variant: 'success' })
    } catch (err: any) {
      toast({ title: 'Error creating user', description: err.message, variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  if (created) {
    return (
      <Card className="max-w-lg border-green-200">
        <CardContent className="pt-6">
          <div className="text-center mb-6">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-gray-900">User Created Successfully</h2>
            <p className="text-sm text-gray-500 mt-1">Credentials have been emailed to the user.</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm mb-6">
            <div className="flex justify-between">
              <span className="text-gray-500">Email</span>
              <span className="font-medium">{created.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Password</span>
              <span className="font-mono font-medium">{created.password}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Role</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[created.role]}`}>
                {ROLE_LABELS[created.role as UserRole]}
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => {
                setCreated(null)
                setForm({ email: '', password: '', role: 'accounts', full_name: '', company_name: '' })
              }}
              variant="outline"
              className="flex-1"
            >
              Create Another
            </Button>
            <Button onClick={() => router.push('/admin/users')} className="flex-1">
              View All Users
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4 text-gray-400" />
            New User Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Role selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Role *</label>
            <div className="grid grid-cols-2 gap-2">
              {creatableRoles.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => update('role', r)}
                  className={`px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all text-left ${
                    form.role === r ? roleColors[r] : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {ROLE_LABELS[r]}
                </button>
              ))}
            </div>
          </div>

          <Input
            label="Full Name"
            value={form.full_name}
            onChange={e => update('full_name', e.target.value)}
            placeholder="John Doe"
          />

          {(form.role === 'transporter') && (
            <Input
              label="Company Name"
              value={form.company_name}
              onChange={e => update('company_name', e.target.value)}
              placeholder="ABC Logistics Pvt. Ltd."
            />
          )}

          <Input
            label="Email Address *"
            type="email"
            value={form.email}
            onChange={e => update('email', e.target.value)}
            placeholder="user@example.com"
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={form.password}
                onChange={e => update('password', e.target.value)}
                className="w-full h-9 px-3 pr-10 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Minimum 8 characters"
                required
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Credentials will be emailed to the user automatically.</p>
          </div>

          <div className="pt-2">
            <Button type="submit" loading={loading} className="w-full">
              <UserPlus className="h-4 w-4" />
              Create User Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
