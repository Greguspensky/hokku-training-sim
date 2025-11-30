import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Simple passthrough middleware - i18n is handled via cookies in layout.tsx
export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  // Only match routes that need middleware (none for now, all handled in layout)
  matcher: []
};