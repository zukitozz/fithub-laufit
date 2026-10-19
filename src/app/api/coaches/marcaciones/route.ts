import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { requireApiAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

// Marcación manual de un coach (olvidó marcar, falló el celular). Siempre con motivo y con quién la registró.
export async function POST(req: Request) {
  const guard = await requireApiAuth(['ADMIN', 'SUPERVISOR'])
  if (guard) return guard
  const session = await auth()

  const body = await req.json().catch(() => null)
  if (!body?.coachId) return NextResponse.json({ error: 'coachId requerido' }, { status: 400 })
  if (body.tipo !== 'ENTRADA' && body.tipo !== 'SALIDA') return NextResponse.json({ error: 'tipo debe ser ENTRADA o SALIDA' }, { status: 400 })
  const observacion = typeof body.observacion === 'string' ? body.observacion.trim() : ''
  if (observacion.length < 3) return NextResponse.json({ error: 'Indica el motivo de la marcación manual' }, { status: 400 })

  const fechaHora = body.fechaHora ? new Date(body.fechaHora) : new Date()
  if (Number.isNaN(fechaHora.getTime()) || fechaHora.getTime() > Date.now() + 5 * 60_000) {
    return NextResponse.json({ error: 'Fecha y hora inválidas' }, { status: 400 })
  }

  const coach = await prisma.coach.findUnique({ where: { id: body.coachId } })
  if (!coach) return NextResponse.json({ error: 'Coach no encontrado' }, { status: 404 })

  const marcacion = await prisma.marcacionCoach.create({
    data: { coachId: coach.id, tipo: body.tipo, fechaHora, origen: 'MANUAL', observacion, registradaPorId: session!.user.id },
  })
  return NextResponse.json(marcacion, { status: 201 })
}
