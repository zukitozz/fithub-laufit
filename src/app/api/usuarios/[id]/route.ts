import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { requireApiAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

const SELECT = { id: true, name: true, email: true, role: true, activo: true, createdAt: true } as const

// Edita nombre, correo, rol, estado o restablece la contraseña (campo "password", opcional).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAuth(['SUPERVISOR'])
  if (guard) return guard
  const session = await auth()

  const actual = await prisma.user.findUnique({ where: { id: params.id } })
  if (!actual) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })

  const data: { name?: string; email?: string; role?: 'SUPERVISOR' | 'ADMIN'; activo?: boolean; password?: string } = {}

  if ('name' in body) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
    data.name = name
  }
  if ('email' in body) {
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Correo inválido' }, { status: 400 })
    const otro = await prisma.user.findUnique({ where: { email } })
    if (otro && otro.id !== actual.id) return NextResponse.json({ error: 'Ya existe un usuario con ese correo' }, { status: 409 })
    data.email = email
  }
  if ('role' in body) {
    if (body.role !== 'SUPERVISOR' && body.role !== 'ADMIN') return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
    if (body.role === 'SUPERVISOR' && actual.role !== 'SUPERVISOR') return NextResponse.json({ error: 'No se puede ascender a un usuario a Gerente desde la app' }, { status: 403 })
    data.role = body.role
  }
  if ('activo' in body) data.activo = body.activo === true
  if (typeof body.password === 'string' && body.password !== '') {
    if (body.password.length < 8) return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
    data.password = await bcrypt.hash(body.password, 12)
  }

  // Salvaguardas: nadie se quita su propio acceso y siempre queda al menos un gerente activo.
  const dejaDeSerGerenteActivo = actual.role === 'SUPERVISOR' && actual.activo && (data.role === 'ADMIN' || data.activo === false)
  if (dejaDeSerGerenteActivo) {
    if (actual.id === session!.user.id) return NextResponse.json({ error: 'No puedes quitarte a ti mismo el acceso de gerente' }, { status: 400 })
    const otrosGerentes = await prisma.user.count({ where: { role: 'SUPERVISOR', activo: true, id: { not: actual.id } } })
    if (otrosGerentes === 0) return NextResponse.json({ error: 'Debe quedar al menos un gerente activo' }, { status: 400 })
  }
  if (actual.id === session!.user.id && data.activo === false) {
    return NextResponse.json({ error: 'No puedes desactivar tu propio usuario' }, { status: 400 })
  }

  const user = await prisma.user.update({ where: { id: actual.id }, data, select: SELECT })
  return NextResponse.json(user)
}
