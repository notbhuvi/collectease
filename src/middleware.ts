import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
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
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Unauthenticated users → login
  const protectedPrefixes = ['/dashboard', '/transport', '/portal', '/admin']
  if (!user && protectedPrefixes.some(p => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Authenticated users on /auth/* → home (page.tsx will do role-based redirect)
  if (user && pathname.startsWith('/auth/')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Role-based guards — prevent wrong roles accessing wrong sections
  if (user && protectedPrefixes.some(p => pathname.startsWith(p))) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role as string | undefined

    const roleHome: Record<string, string> = {
      admin: '/admin',
      accounts: '/dashboard',
      transport_team: '/transport',
      transporter: '/portal',
    }

    const guards: { prefix: string; allowed: string[] }[] = [
      { prefix: '/admin',     allowed: ['admin'] },
      { prefix: '/transport', allowed: ['admin', 'transport_team'] },
      { prefix: '/portal',    allowed: ['admin', 'transporter'] },
      { prefix: '/dashboard', allowed: ['admin', 'accounts'] },
    ]

    for (const guard of guards) {
      if (pathname.startsWith(guard.prefix) && role && !guard.allowed.includes(role)) {
        const dest = roleHome[role] ?? '/auth/login'
        return NextResponse.redirect(new URL(dest, request.url))
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/transport/:path*',
    '/portal/:path*',
    '/admin/:path*',
    '/auth/:path*',
  ],
}
