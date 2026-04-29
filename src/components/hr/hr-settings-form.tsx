'use client'

import { useState } from 'react'
import { AlertTriangle, Eye, EyeOff, Loader2, Monitor, Moon, Sun, Upload } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { useTheme } from '@/components/theme-provider'
import { formatDate } from '@/lib/utils'
import type { HrPolicyDocument } from '@/types'

export function HrSettingsForm({
  userEmail,
  fullName,
  companyName,
  policies,
}: {
  userEmail: string
  fullName: string | null
  companyName: string | null
  policies: Array<HrPolicyDocument & { file_name?: string | null }>
}) {
  const router = useRouter()
  const { toast } = useToast()
  const { theme, setTheme } = useTheme()
  const [profileLoading, setProfileLoading] = useState(false)
  const [policyLoading, setPolicyLoading] = useState(false)
  const [name, setName] = useState(fullName || '')
  const [company, setCompany] = useState(companyName || '')
  const [policyTitle, setPolicyTitle] = useState('')
  const [policyFile, setPolicyFile] = useState<File | null>(null)
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
      if (!res.ok) throw new Error(data.error || 'Unable to update profile')
      toast({ title: 'Profile updated', variant: 'success' })
      router.refresh()
    } catch (error: unknown) {
      toast({ title: 'Save failed', description: error instanceof Error ? error.message : 'Unable to update profile', variant: 'error' })
    } finally {
      setProfileLoading(false)
    }
  }

  async function handlePolicyUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!policyTitle.trim() || !policyFile) {
      toast({ title: 'Policy title and file are required', variant: 'error' })
      return
    }
    setPolicyLoading(true)
    try {
      const payload = new FormData()
      payload.set('kind', 'policy')
      payload.set('title', policyTitle)
      payload.set('file', policyFile)
      const res = await fetch('/api/hr/documents', { method: 'POST', body: payload })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Unable to upload policy')
      toast({ title: 'Policy uploaded', variant: 'success' })
      setPolicyTitle('')
      setPolicyFile(null)
      router.refresh()
    } catch (error: unknown) {
      toast({ title: 'Upload failed', description: error instanceof Error ? error.message : 'Unable to upload policy', variant: 'error' })
    } finally {
      setPolicyLoading(false)
    }
  }

  async function handleReset() {
    if (!resetPw) return
    setResetLoading(true)
    try {
      const res = await fetch('/api/hr/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: resetPw }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Unable to reset HR data')
      toast({
        title: 'HR data cleared',
        description: `${data.cleared || 0} records removed.`,
        variant: 'success',
      })
      setShowReset(false)
      setResetPw('')
      router.refresh()
    } catch (error: unknown) {
      toast({ title: 'Reset failed', description: error instanceof Error ? error.message : 'Unable to reset HR data', variant: 'error' })
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <form onSubmit={handleProfileSave}>
        <Card>
          <CardHeader>
            <CardTitle>HR Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input label="Full Name" value={name} onChange={e => setName(e.target.value)} />
            <Input label="Company Name" value={company} onChange={e => setCompany(e.target.value)} />
            <Input label="Email" value={userEmail} disabled />
            <Button type="submit" loading={profileLoading}>Save Profile</Button>
          </CardContent>
        </Card>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent>
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
                className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                  theme === value
                    ? 'border-rose-500 bg-rose-50 text-rose-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Company Policies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handlePolicyUpload} className="grid gap-3 md:grid-cols-[1fr,1fr,auto]">
            <Input label="Policy Title" value={policyTitle} onChange={e => setPolicyTitle(e.target.value)} placeholder="Travel policy 2026" />
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Policy File</label>
              <input type="file" onChange={e => setPolicyFile(e.target.files?.[0] || null)} className="block h-9 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
            </div>
            <div className="flex items-end">
              <Button type="submit" loading={policyLoading} className="w-full md:w-auto">
                <Upload className="h-4 w-4" />
                Upload
              </Button>
            </div>
          </form>

          <div className="space-y-2">
            {policies.map(policy => (
              <div key={policy.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-3">
                <div>
                  <p className="font-medium text-gray-900">{policy.title}</p>
                  <p className="text-xs text-gray-400">Uploaded {formatDate(policy.created_at)}</p>
                </div>
                {policy.signed_url ? (
                  <a href={policy.signed_url} target="_blank" rel="noreferrer" className="text-sm font-medium text-rose-600 hover:text-rose-700">
                    Open
                  </a>
                ) : (
                  <span className="text-sm text-gray-400">Unavailable</span>
                )}
              </div>
            ))}
            {policies.length === 0 && (
              <p className="text-sm text-gray-400">No company policies uploaded yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

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
                <p className="text-sm font-medium text-gray-900">Reset HR Portal</p>
                <p className="text-xs text-gray-500 mt-0.5">Delete employees, attendance, leave history, employee documents, and policy uploads from the HR portal.</p>
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
                <p className="text-sm font-semibold text-red-700">This action cannot be undone</p>
                <p className="text-xs text-red-600 mt-1">All HR employees, attendance, leaves, and uploaded documents will be permanently removed.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Enter your password to confirm</label>
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
                  <button
                    type="button"
                    onClick={() => setShowResetPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
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
                  {resetLoading ? 'Clearing…' : 'Yes, Clear HR Data'}
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
