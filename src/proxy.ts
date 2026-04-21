import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip auth middleware if Supabase is not configured yet
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
        getAll() {
          return request.cookies.getAll()
        },
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

  const protectedPrefixes = ['/dashboard', '/transport', '/portal', '/admin']
  const isProtected = protectedPrefixes.some(p => pathname.startsWith(p))

  // Redirect unauthenticated users from protected routes
  if (!user && isProtected) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Redirect authenticated users away from auth pages → role-based home
  if (user && pathname.startsWith('/auth/')) {
    // Fetch role to redirect correctly
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('email', user.email)
        .single()

      const roleHome: Record<string, string> = {
        admin: '/admin',
        accounts: '/dashboard',
        sales: '/dashboard',
        transport_team: '/transport',
        transporter: '/portal',
      }
      const dest = profile?.role ? (roleHome[profile.role] ?? '/dashboard') : '/dashboard'
      return NextResponse.redirect(new URL(dest, request.url))
    } catch {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/transport/:path*', '/portal/:path*', '/admin/:path*', '/auth/:path*'],
}
