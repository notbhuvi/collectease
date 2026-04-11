'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Zap, Mail, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    toast({ title: 'Welcome back!', variant: 'success' })
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-200">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">CollectEase</span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
            <p className="text-sm text-gray-500 mt-1">Sign in to manage your receivables</p>
          </div>

          {/* Demo shortcut */}
          <div className="mb-5 p-3 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-blue-700">Try the demo</p>
              <p className="text-xs text-blue-500">No account needed — sample data loaded</p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="shrink-0 border-blue-200 text-blue-600 hover:bg-blue-100 text-xs px-3 py-1.5 h-auto"
              onClick={() => router.push('/demo')}
            >
              Open Demo →
            </Button>
          </div>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100" /></div>
            <div className="relative flex justify-center"><span className="bg-white px-2 text-xs text-gray-400">or sign in with your account</span></div>
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

          <p className="mt-6 text-center text-sm text-gray-500">
            New to CollectEase?{' '}
            <Link href="/auth/register" className="font-medium text-blue-600 hover:text-blue-700">
              Create account
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Built for Indian MSMEs. Secure & reliable.
        </p>
      </div>
    </div>
  )
}
