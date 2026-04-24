import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
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

  const protectedPrefixes = ['/dashboard', '/transport', '/portal', '/admin', '/plant']
  const isProtected = protectedPrefixes.some(p => pathname.startsWith(p))
  const isAuth = pathname.startsWith('/auth/')

  // Unauthenticated on protected route → login
  if (!user && isProtected) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Authenticated on auth pages → home (page.tsx will handle role redirect via service client)
  if (user && isAuth) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Role-based route guards
  if (user && isProtected) {
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
      plant_ops: '/plant',
    }

    const guards: { prefix: string; allowed: string[] }[] = [
      { prefix: '/admin',     allowed: ['admin'] },
      { prefix: '/transport', allowed: ['admin', 'transport_team'] },
      { prefix: '/portal',    allowed: ['admin', 'transporter'] },
      { prefix: '/dashboard', allowed: ['admin', 'accounts'] },
      { prefix: '/plant',     allowed: ['admin', 'plant_ops'] },
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
    '/plant/:path*',
    '/auth/:path*',
  ],
}
