import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const url = rawUrl.startsWith('http') ? rawUrl : 'https://placeholder.supabase.co'
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.startsWith('your') || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ? 'placeholder-key'
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server component - cookies can't be set
          }
        },
      },
    }
  )
}

export async function createServiceClient() {
  const cookieStore = await cookies()

  const rawUrl2 = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const url = rawUrl2.startsWith('http') ? rawUrl2 : 'https://placeholder.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.startsWith('your') || !process.env.SUPABASE_SERVICE_ROLE_KEY
    ? 'placeholder-key'
    : process.env.SUPABASE_SERVICE_ROLE_KEY

  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
