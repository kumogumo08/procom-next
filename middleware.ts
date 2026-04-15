import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const RENDER_HOST = 'procom-next.onrender.com';
const PRODUCTION_HOST = 'procom.jp';
const REDIRECT_EXCLUDED_PATHS = new Set(['/googleeb841dae764c019b.html']);

export function middleware(request: NextRequest) {
  if (REDIRECT_EXCLUDED_PATHS.has(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const forwardedHost = request.headers.get('x-forwarded-host');
  const rawHost = forwardedHost ?? request.headers.get('host') ?? '';
  const host = rawHost.split(':')[0].toLowerCase();

  if (host !== RENDER_HOST) {
    return NextResponse.next();
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.protocol = 'https:';
  redirectUrl.host = PRODUCTION_HOST;

  return NextResponse.redirect(redirectUrl, 301);
}

export const config = {
  matcher: '/:path*',
};
