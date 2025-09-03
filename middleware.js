import { NextResponse } from 'next/server';
import { verifyToken } from './src/lib/auth.js';

export function middleware(request) {
  const token = request.cookies.get('token')?.value;
  
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    if (!token) {
      return NextResponse.redirect(new URL('/signin', request.url));
    }
    
    try {
      verifyToken(token);
      return NextResponse.next();
    } catch (error) {
      return NextResponse.redirect(new URL('/signin', request.url));
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*']
};
