import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { requireApiAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAuth(['ADMIN', 'SUPERVISOR'])
  if (guard) return guard
  const session = await auth()

  const body = await req.json().catch(() => null)
  const motivo = typeof body?.motivo === 'string' ? body.motivo.trim() : ''
  if (motivo.length < 3) return NextResponse.json({ error: 'El motivo es obligatorio' }, { status: 400 })

  const existente = await prisma.marcacionCoach.findUnique({ where: { id: params.id } })
  if (!existente) return NextResponse.json({ error: 'Marcación no encontrada' }, { status: 404 })

  const marcacion = await prisma.marcacionCoach.update({
    where: { id: params.id },
    data: { anulada: true, observacion: [existente.observacion, `Anulada: ${motivo}`].filter(Boolean).join(' | '), registradaPorId: session!.user.id },
  })
  return NextResponse.json(marcacion)
}
