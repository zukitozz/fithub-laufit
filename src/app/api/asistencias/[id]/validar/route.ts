import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { requireApiAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

// La administradora confirma que la persona frente a ella es quien marcó, o anula la marca ("no coincide").
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAuth(['ADMIN', 'SUPERVISOR'])
  if (guard) return guard
  const session = await auth()

  const body = await req.json().catch(() => null)
  const accion = body?.accion
  if (accion !== 'CONFIRMAR' && accion !== 'ANULAR') return NextResponse.json({ error: 'accion debe ser CONFIRMAR o ANULAR' }, { status: 400 })

  const motivo = typeof body?.motivo === 'string' ? body.motivo.trim() : ''
  if (accion === 'ANULAR' && motivo.length < 3) return NextResponse.json({ error: 'Indica el motivo de la anulación' }, { status: 400 })

  const existente = await prisma.asistencia.findUnique({ where: { id: params.id } })
  if (!existente) return NextResponse.json({ error: 'Asistencia no encontrada' }, { status: 404 })

  const asistencia = await prisma.asistencia.update({
    where: { id: params.id },
    data: {
      validacion: accion === 'CONFIRMAR' ? 'CONFIRMADA' : 'ANULADA',
      motivo: accion === 'ANULAR' ? motivo : null,
      validadaPorId: session!.user.id,
      validadaAt: new Date(),
    },
  })
  return NextResponse.json(asistencia)
}
