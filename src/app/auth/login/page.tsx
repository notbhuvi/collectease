'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Lock } from 'lucide-react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Invalid email or password')
      setLoading(false)
      return
    }

    // Fetch role and redirect accordingly
    if (authData.user) {
      const { data: profile } = await supabase
  .from('profiles')
  .select('role')
  .eq('email', authData.user.email)
  .single()

      const roleRedirects: Record<string, string> = {
        admin: '/admin',
        accounts: '/dashboard',
        sales: '/dashboard',
        transport_team: '/transport',
        transporter: '/portal',
      }
      const dest = profile?.role ? (roleRedirects[profile.role] ?? '/dashboard') : '/dashboard'
      router.push(dest)
    } else {
      router.push('/dashboard')
    }
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex flex-col items-center gap-3">
            <Image
              src="/sirpl-logo.png"
              alt="SIRPL"
              width={80}
              height={80}
              className="rounded-2xl shadow-lg object-contain"
            />
            <span className="text-xl font-bold text-gray-900 tracking-wide">SIRPL</span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
            <p className="text-sm text-gray-500 mt-1">Sign in to manage your receivables</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="Email address"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              leftIcon={<Mail className="h-4 w-4" />}
              required
              autoComplete="email"
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              leftIcon={<Lock className="h-4 w-4" />}
              error={error}
              required
              autoComplete="current-password"
            />

            <Button type="submit" className="w-full" loading={loading}>
              Sign In
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Samwha India Refractories Pvt. Ltd. · Internal Use Only
        </p>
      </div>
    </div>
  )
}
