import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import type { UserRole } from '@/types/user'

export async function requireApiAuth(roles?: UserRole[]) {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json({ error: 'Autenticación requerida' }, { status: 401 })
  }

  if (roles && !roles.includes(session.user.role)) {
    return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 })
  }

  return null
}
