import { NextResponse, type NextRequest } from 'next/server';

import { locales, defaultLocale } from '@/lib/i18n/config';

/** Ensures every path is locale-prefixed; auth is enforced in the layout. */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public live-trip tracking page — no locale prefix, no admin auth.
  if (pathname === '/t' || pathname.startsWith('/t/')) {
    return NextResponse.next();
  }

  const hasLocale = locales.some(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`),
  );
  if (hasLocale) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/${defaultLocale}${pathname === '/' ? '' : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip Next internals, API routes, and static files.
  matcher: ['/((?!_next|favicon.ico|.*\\..*).*)'],
};
