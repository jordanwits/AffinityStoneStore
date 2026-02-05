import { type NextRequest } from 'next/server';
import { updateSession } from './lib/supabase/middleware';

// Use edge runtime for faster execution closer to users
// This reduces latency by running middleware at edge locations
export const runtime = 'edge';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
