import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/auth/callback']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Pass through public paths without any session work
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // For all other paths, verify the session and refresh cookies if needed
  const response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  // getUser() validates the token with the Supabase Auth server — safe for auth decisions
  const { data: { user } } = await supabase.auth.getUser()

  // if (!user) {
  //   const loginUrl = request.nextUrl.clone()
  //   loginUrl.pathname = '/login'
  //   return NextResponse.redirect(loginUrl)
  // }

  return response
}

export const config = {
  matcher: [
    // Run on all paths except Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
