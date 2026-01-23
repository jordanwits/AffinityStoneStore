import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // Use placeholder values if not configured (dev mode)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MDAsImV4cCI6MTk2MDc2ODgwMH0.placeholder';

  // If using placeholder credentials, skip auth checks (dev mode)
  if (url.includes('placeholder')) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
        cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refreshing the auth token
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protected routes - require authentication
  const isAppRoute = request.nextUrl.pathname.startsWith('/dashboard') ||
                     request.nextUrl.pathname.startsWith('/catalog') ||
                     request.nextUrl.pathname.startsWith('/product') ||
                     request.nextUrl.pathname.startsWith('/cart') ||
                     request.nextUrl.pathname.startsWith('/checkout') ||
                     request.nextUrl.pathname.startsWith('/orders') ||
                     request.nextUrl.pathname.startsWith('/points-history') ||
                     request.nextUrl.pathname.startsWith('/admin');

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') ||
                      request.nextUrl.pathname.startsWith('/logout') ||
                      request.nextUrl.pathname.startsWith('/update-password');

  if (isAppRoute && !user) {
    // Redirect to login if trying to access protected route without auth
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && user) {
    // Redirect to dashboard if already logged in and trying to access login
    // But allow /update-password to process password reset tokens
    if (request.nextUrl.pathname === '/login') {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
