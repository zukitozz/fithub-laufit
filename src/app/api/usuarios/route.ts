import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

const SELECT = { id: true, name: true, email: true, role: true, activo: true, createdAt: true } as const

// Solo el gerente gestiona usuarios. La contraseña nunca sale en las respuestas.
export async function GET() {
  const guard = await requireApiAuth(['SUPERVISOR'])
  if (guard) return guard
  return NextResponse.json(await prisma.user.findMany({ select: SELECT, orderBy: [{ activo: 'desc' }, { role: 'asc' }, { name: 'asc' }] }))
}

export async function POST(req: Request) {
  const guard = await requireApiAuth(['SUPERVISOR'])
  if (guard) return guard

  const body = await req.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!name) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Correo inválido' }, { status: 400 })
  if (password.length < 8) return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
  // Desde la app solo se crean administradores: el gerente es único y se crea con el seed.
  if (body?.role !== undefined && body.role !== 'ADMIN') return NextResponse.json({ error: 'Solo se pueden crear usuarios con rol Administrador' }, { status: 403 })

  if (await prisma.user.findUnique({ where: { email } })) return NextResponse.json({ error: 'Ya existe un usuario con ese correo' }, { status: 409 })

  const user = await prisma.user.create({
    data: { name, email, role: 'ADMIN', password: await bcrypt.hash(password, 12) },
    select: SELECT,
  })
  return NextResponse.json(user, { status: 201 })
}
