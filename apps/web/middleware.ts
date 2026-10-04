import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login'];

function isPrefetch(request: NextRequest) {
  return (
    request.headers.get('next-router-prefetch') === '1' ||
    request.headers.get('next-router-segment-prefetch') === '1' ||
    request.headers.get('purpose') === 'prefetch'
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check for access_token cookie (set by NestJS /auth/login)
  const token = request.cookies.get('access_token');
  if (!token) {
    // A prefetch redirect is cached as the page itself, so the next click opens login.
    if (isPrefetch(request)) {
      return new NextResponse(null, {
        status: 204,
        headers: { 'x-middleware-cache': 'no-cache' },
      });
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
