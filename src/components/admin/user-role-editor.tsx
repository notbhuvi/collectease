'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { ROLE_LABELS } from '@/lib/roles'
import type { UserRole } from '@/types'

const roles: UserRole[] = ['admin', 'accounts', 'transport_team', 'transporter']

const roleColors: Record<string, string> = {
  admin: 'bg-violet-100 text-violet-700',
  accounts: 'bg-blue-100 text-blue-700',
  transport_team: 'bg-orange-100 text-orange-700',
  transporter: 'bg-emerald-100 text-emerald-700',
}

interface Props {
  userId: string
  currentRole: UserRole
  currentName: string | null
  currentCompany: string | null
}

export function UserRoleEditor({ userId, currentRole, currentName, currentCompany }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [role, setRole] = useState<UserRole>(currentRole)
  const [name, setName] = useState(currentName || '')
  const [company, setCompany] = useState(currentCompany || '')
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, role, full_name: name, company_name: company }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: 'User updated', variant: 'success' })
      setEditing(false)
      router.refresh()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[currentRole]}`}>
          {ROLE_LABELS[currentRole]}
        </span>
        <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:underline">Edit</button>
      </div>
    )
  }

  return (
    <div className="space-y-2 py-1">
      <input
        type="text"
        className="w-full h-7 px-2 rounded border border-gray-300 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        placeholder="Full name"
        value={name}
        onChange={e => setName(e.target.value)}
      />
      <input
        type="text"
        className="w-full h-7 px-2 rounded border border-gray-300 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        placeholder="Company name"
        value={company}
        onChange={e => setCompany(e.target.value)}
      />
      <select
        className="w-full h-7 px-2 rounded border border-gray-300 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
        value={role}
        onChange={e => setRole(e.target.value as UserRole)}
      >
        {roles.map(r => (
          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
        ))}
      </select>
      <div className="flex gap-1">
        <Button size="sm" onClick={handleSave} loading={loading} className="h-6 text-xs px-2">Save</Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="h-6 text-xs px-2">Cancel</Button>
      </div>
    </div>
  )
}
