import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  const path = req.nextUrl.pathname;

  const isAuthHost = host.startsWith('auth.');
  const isPanelHost = host.startsWith('cc.');

  // Endpointy wywoływane maszynowo (cron) działają niezależnie od hosta - chronione własnym sekretem.
  if (path.startsWith('/api/internal/')) {
    return NextResponse.next();
  }

  if (isAuthHost) {
    const allowed = path === '/' || path.startsWith('/api/auth/');
    if (!allowed) {
      return new NextResponse('Not found', { status: 404 });
    }
    return NextResponse.next();
  }

  if (isPanelHost) {
    const allowed = path.startsWith('/desc') || path.startsWith('/api/admin/');
    if (!allowed) {
      return new NextResponse('Not found', { status: 404 });
    }
    return NextResponse.next();
  }

  // Każdy inny host (główna domena, IP, cokolwiek) - nic tu nie ma.
  return new NextResponse('Not found', { status: 404 });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
