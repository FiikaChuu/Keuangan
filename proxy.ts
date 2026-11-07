import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  let connect = '';
  try {
    const u = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');
    connect = `${u.origin} ${u.origin.replace('https:', 'wss:')}`;
  } catch {
    /* setup screen */
  }
  const policy = `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' ${connect}; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`;
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', policy);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|design|icon|sw.js|manifest|favicon).*)'],
};
