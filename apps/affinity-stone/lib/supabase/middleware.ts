import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { userMustChangePassword } from '@/lib/auth/must-change-password';
import { LOGIN_REDIRECT_PARAM, safeRedirectPath } from '@/lib/auth/redirect';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const pathname = request.nextUrl.pathname;

  // Only run Supabase session refresh logic on routes that actually need auth state.
  // This avoids a network roundtrip on marketing/static pages and reduces click-to-open latency.
  const isAppRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/catalog') ||
    pathname.startsWith('/product') ||
    pathname.startsWith('/cart') ||
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/orders') ||
    pathname.startsWith('/points-history') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/admin');

  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/logout') ||
    pathname.startsWith('/update-password') ||
    pathname.startsWith('/forgot-password');

  const isMarketingHome = pathname === '/home' || pathname === '/';

  if (!isAppRoute && !isAuthRoute && !isMarketingHome) {
    return supabaseResponse;
  }

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

  // Avoid calling the Supabase Auth API on every request.
  // We can usually trust the session cookie and only refresh when nearing expiry.
  const refreshGraceMs = 2 * 60 * 1000; // refresh if expiring in next 2 minutes

  function clearSupabaseAuthCookies(response: NextResponse) {
    request.cookies.getAll().forEach((cookie) => {
      if (cookie.name.startsWith('sb-')) {
        response.cookies.delete(cookie.name);
      }
    });
  }

  let session;
  let hadRefreshTokenError = false;
  try {
    const sessionResult = await supabase.auth.getSession();
    session = sessionResult.data?.session;
    if (sessionResult.error?.message?.includes('Refresh Token')) {
      hadRefreshTokenError = true;
    }
  } catch (error) {
    // If session retrieval fails (e.g., invalid refresh token), treat as unauthenticated
    session = null;
    hadRefreshTokenError =
      error instanceof Error && error.message.includes('Refresh Token');
  }

  const expiresAtMs = session?.expires_at ? session.expires_at * 1000 : 0;
  const shouldRefresh = !session || (expiresAtMs > 0 && expiresAtMs - Date.now() < refreshGraceMs);

  let isAuthenticated = Boolean(session?.access_token);
  let userForPasswordGate: User | null = null;

  if (shouldRefresh) {
    try {
      const {
        data: { user: refreshedUser },
      } = await supabase.auth.getUser();
      userForPasswordGate = refreshedUser;
      isAuthenticated = Boolean(refreshedUser);
    } catch (error) {
      // If refresh fails (e.g., invalid refresh token), treat as unauthenticated
      // This is expected after logout or token expiration
      isAuthenticated = false;
      hadRefreshTokenError =
        error instanceof Error && error.message.includes('Refresh Token');
    }
  } else if (isAuthenticated) {
    try {
      const {
        data: { user: sessionUser },
      } = await supabase.auth.getUser();
      userForPasswordGate = sessionUser;
    } catch {
      userForPasswordGate = null;
    }
  }

  const passwordChangeRequired =
    isAuthenticated && Boolean(userForPasswordGate) && userMustChangePassword(userForPasswordGate);

  const isPasswordChangeExempt =
    pathname.startsWith('/update-password') ||
    pathname.startsWith('/logout');

  if (hadRefreshTokenError) {
    clearSupabaseAuthCookies(supabaseResponse);
  }

  if (isAppRoute && !isAuthenticated) {
    // Redirect to login if trying to access protected route without auth,
    // remembering where they were headed (e.g. an order link from an email)
    // so signing in drops them on that page instead of the dashboard.
    const url = request.nextUrl.clone();
    const destination = `${pathname}${request.nextUrl.search}`;
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set(LOGIN_REDIRECT_PARAM, destination);
    const redirectResponse = NextResponse.redirect(url);
    if (hadRefreshTokenError) {
      clearSupabaseAuthCookies(redirectResponse);
    }
    return redirectResponse;
  }

  if (passwordChangeRequired && !isPasswordChangeExempt && isAppRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/update-password';
    url.searchParams.set('required', '1');
    return NextResponse.redirect(url);
  }

  if (passwordChangeRequired && !isPasswordChangeExempt && isAuthRoute && pathname.startsWith('/forgot-password')) {
    const url = request.nextUrl.clone();
    url.pathname = '/update-password';
    url.searchParams.set('required', '1');
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && isAuthenticated) {
    if (request.nextUrl.pathname === '/login') {
      if (passwordChangeRequired) {
        const url = request.nextUrl.clone();
        url.pathname = '/update-password';
        url.search = '';
        url.searchParams.set('required', '1');
        return NextResponse.redirect(url);
      }
      // Already signed in and arriving at login with a destination in hand
      // (an emailed link opened in a tab that still has a session).
      const destination =
        safeRedirectPath(request.nextUrl.searchParams.get(LOGIN_REDIRECT_PARAM)) ?? '/dashboard';
      return NextResponse.redirect(new URL(destination, request.url));
    }
  }

  // Redirect logged-in users from marketing home to dashboard (avoids NEXT_REDIRECT in page component)
  if (isMarketingHome && isAuthenticated) {
    const url = request.nextUrl.clone();
    if (passwordChangeRequired) {
      url.pathname = '/update-password';
      url.searchParams.set('required', '1');
    } else {
      url.pathname = '/dashboard';
    }
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
