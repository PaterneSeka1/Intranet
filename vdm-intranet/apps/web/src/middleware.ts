import { NextRequest, NextResponse } from 'next/server'

const COOKIE = process.env.COOKIE_NAME ?? 'vdm_token'
const PUBLIC = [
  '/',
  '/login',
  '/acces-refuse',
  '/mot-de-passe-oublie',
  '/reinitialiser-mot-de-passe',
]
const LOGIN_ONLY = ['/login', '/mot-de-passe-oublie', '/reinitialiser-mot-de-passe']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get(COOKIE)?.value
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(p + '/'))

  if (isPublic) {
    if (token && LOGIN_ONLY.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
      return NextResponse.redirect(new URL('/accueil', request.url))
    }
    return NextResponse.next()
  }

  if (!token) {
    const url = new URL('/login', request.url)
    url.searchParams.set('from', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|manifest.webmanifest|sw.js|offline.html|icon-192.png|icon-512.png|logo_entreprise.png).*)',
  ],
}
