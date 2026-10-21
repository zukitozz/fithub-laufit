import NextAuth from 'next-auth'
import { NextResponse } from 'next/server'
import { authConfig } from '@/lib/auth.config'

const { auth } = NextAuth(authConfig)

// Páginas solo para el gerente. Las rutas /api se protegen en cada handler con requireApiAuth.
const ADMIN_BLOCKED = ['/planes', '/ajustes', '/usuarios', '/productos']

function coincide(pathname: string, prefijos: string[]) {
  return prefijos.some((prefijo) => pathname === prefijo || pathname.startsWith(`${prefijo}/`))
}

export default auth((req) => {
  const { pathname, search } = req.nextUrl
  const role = req.auth?.user?.role
  if (!role) {
    const loginUrl = new URL('/auth/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname + search)
    return NextResponse.redirect(loginUrl)
  }

  if (role === 'ADMIN' && coincide(pathname, ADMIN_BLOCKED)) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
})

// Públicas: /marcar (auto-marcación de socios y coaches), /auth/login, /legal, assets.
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|logo-[a-z-]+\.png|auth/login|legal|marcar).*)'],
}
