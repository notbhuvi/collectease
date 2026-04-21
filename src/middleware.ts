import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl || supabaseUrl === 'your_supabase_project_url') {
    return NextResponse.next({ request })
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Unauthenticated → login
  const protectedPrefixes = ['/dashboard', '/transport', '/portal', '/admin']
  if (!user && protectedPrefixes.some(p => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Authenticated user on auth pages → go to their home
  if (user && pathname.startsWith('/auth/')) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    const roleHome: Record<string, string> = {
      admin: '/admin',
      accounts: '/dashboard',
      transport_team: '/transport',
      transporter: '/portal',
    }
    const dest = profile?.role ? (roleHome[profile.role] ?? '/dashboard') : '/dashboard'
    return NextResponse.redirect(new URL(dest, request.url))
  }

  // Role-based route guards — prevent wrong roles from accessing wrong sections
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    const role = profile?.role

    const guards: { prefix: string; allowed: string[] }[] = [
      { prefix: '/admin',     allowed: ['admin'] },
      { prefix: '/transport', allowed: ['admin', 'transport_team'] },
      { prefix: '/portal',    allowed: ['admin', 'transporter'] },
      { prefix: '/dashboard', allowed: ['admin', 'accounts'] },
    ]

    for (const guard of guards) {
      if (pathname.startsWith(guard.prefix) && role && !guard.allowed.includes(role)) {
        const roleHome: Record<string, string> = {
          admin: '/admin', accounts: '/dashboard',
          transport_team: '/transport', transporter: '/portal',
        }
        return NextResponse.redirect(new URL(roleHome[role] ?? '/auth/login', request.url))
      }
    }
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/transport/:path*', '/portal/:path*', '/admin/:path*', '/auth/:path*'],
}
