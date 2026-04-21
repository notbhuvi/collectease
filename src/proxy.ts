import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getProfileForUser } from '@/lib/profile'
import { canAccessPath, getRoleHome } from '@/lib/roles'

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

  const isAuthRoute = pathname === '/auth' || pathname.startsWith('/auth/')
  const protectedPrefixes = ['/dashboard', '/transport', '/portal', '/admin']
  const isProtected = protectedPrefixes.some(p => pathname.startsWith(p))

  // Redirect unauthenticated users from protected routes
  if (!user && isProtected) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  if (!user) {
    return response
  }

  const profile = await getProfileForUser(supabase, user, 'id,email,role')
  const roleHome = getRoleHome(profile?.role, '/dashboard')

  // Redirect authenticated users away from auth pages → role-based home
  if (isAuthRoute) {
    return NextResponse.redirect(new URL(roleHome, request.url))
  }

  if (isProtected && !canAccessPath(profile?.role, pathname)) {
    return NextResponse.redirect(new URL(roleHome, request.url))
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/transport/:path*', '/portal/:path*', '/admin/:path*', '/auth/:path*'],
}
