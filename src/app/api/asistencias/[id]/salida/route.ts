import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

// Recepción marca que el socio ya salió: la tarjeta deja de verse en el panel de ingresos en vivo.
// { deshacer: true } la devuelve al panel (por si se marcó por error).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAuth(['ADMIN', 'SUPERVISOR'])
  if (guard) return guard

  const body = await req.json().catch(() => null)
  const deshacer = body?.deshacer === true

  const existente = await prisma.asistencia.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!existente) return NextResponse.json({ error: 'Asistencia no encontrada' }, { status: 404 })

  const asistencia = await prisma.asistencia.update({ where: { id: params.id }, data: { salidaAt: deshacer ? null : new Date() } })
  return NextResponse.json(asistencia)
}
