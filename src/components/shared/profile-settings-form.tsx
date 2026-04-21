'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { useTheme } from '@/components/theme-provider'
import { User, Lock, Monitor, Sun, Moon, AlertTriangle, Eye, EyeOff, Loader2 } from 'lucide-react'

interface ProfileSettingsFormProps {
  userEmail: string
  fullName: string | null
  companyName: string | null
  accentColor?: string // e.g. 'orange', 'emerald', 'violet'
  resetApiPath: string // '/api/transport/reset' or '/api/portal/reset'
  resetLabel: string
  resetDescription: string
}

export function ProfileSettingsForm({
  userEmail,
  fullName,
  companyName,
  accentColor = 'blue',
  resetApiPath,
  resetLabel,
  resetDescription,
}: ProfileSettingsFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { theme, setTheme } = useTheme()

  const [name, setName] = useState(fullName || '')
  const [company, setCompany] = useState(companyName || '')
  const [profileLoading, setProfileLoading] = useState(false)

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)

  const [showReset, setShowReset] = useState(false)
  const [resetPw, setResetPw] = useState('')
  const [showResetPw, setShowResetPw] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault()
    setProfileLoading(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: name, company_name: company }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: 'Profile updated!', variant: 'success' })
      router.refresh()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'error' })
    } finally {
      setProfileLoading(false)
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    if (newPw !== confirmPw) {
      toast({ title: 'Passwords do not match', variant: 'error' })
      return
    }
    if (newPw.length < 8) {
      toast({ title: 'Password must be at least 8 characters', variant: 'error' })
      return
    }
    setPwLoading(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: 'Password changed!', variant: 'success' })
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'error' })
    } finally {
      setPwLoading(false)
    }
  }

  async function handleReset() {
    if (!resetPw) return
    setResetLoading(true)
    try {
      const res = await fetch(resetApiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: resetPw }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({
        title: 'Data cleared',
        description: `${data.cleared || 0} records removed.`,
        variant: 'success',
      })
      setShowReset(false)
      setResetPw('')
      router.refresh()
    } catch (err: any) {
      toast({ title: 'Reset failed', description: err.message, variant: 'error' })
    } finally {
      setResetLoading(false)
    }
  }

  const accentFocus = `focus:ring-${accentColor}-500`

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Profile Info */}
      <form onSubmit={handleProfileSave}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4 text-gray-400" />
              Profile Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Full Name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
            />
            <Input
              label="Company Name"
              value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="Your company"
            />
            <Input
              label="Email"
              value={userEmail}
              disabled
              hint="Contact admin to change your email"
            />
            <div className="pt-2">
              <Button type="submit" loading={profileLoading}>Save Profile</Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Change Password */}
      <form onSubmit={handlePasswordChange}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="h-4 w-4 text-gray-400" />
              Change Password
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPw}
                  onChange={e => setCurrentPw(e.target.value)}
                  className="w-full h-9 px-3 pr-9 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter current password"
                  required
                />
                <button type="button" onClick={() => setShowCurrent(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  className="w-full h-9 px-3 pr-9 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Minimum 8 characters"
                  required
                />
                <button type="button" onClick={() => setShowNew(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Re-enter new password"
                required
              />
            </div>
            <div className="pt-2">
              <Button type="submit" loading={pwLoading} variant="outline">Change Password</Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Monitor className="h-4 w-4 text-gray-400" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-3">Choose how the app looks on this device.</p>
          <div className="grid grid-cols-3 gap-3">
            {([
              { value: 'light', label: 'Light', icon: Sun },
              { value: 'dark', label: 'Dark', icon: Moon },
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

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600 text-base">
            <AlertTriangle className="h-4 w-4" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!showReset ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{resetLabel}</p>
                <p className="text-xs text-gray-500 mt-0.5">{resetDescription}</p>
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
                <p className="text-xs text-red-600 mt-1">{resetDescription}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Enter your password to confirm
                </label>
                <div className="relative">
                  <input
                    type={showResetPw ? 'text' : 'password'}
                    value={resetPw}
                    onChange={e => setResetPw(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleReset()}
                    placeholder="Your account password"
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowResetPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showResetPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={!resetPw || resetLoading}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {resetLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {resetLoading ? 'Clearing…' : 'Yes, Clear Data'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowReset(false); setResetPw('') }}
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
    </div>
  )
}
