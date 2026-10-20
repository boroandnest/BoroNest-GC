import { NextResponse } from 'next/server';

// Fast redirect for logged-out visitors on workspace routes.
// This only checks that a session cookie is present; every API call re-validates it server-side.
export function middleware(request) {
  if (request.cookies.get('bn_session')?.value) return NextResponse.next();
  const login = new URL('/login', request.url);
  login.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/dashboard/:path*', '/projects/:path*', '/admin/:path*', '/pending']
};
