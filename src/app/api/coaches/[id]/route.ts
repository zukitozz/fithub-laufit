import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'
import { leerCoach } from '@/lib/coachesDatos'

export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAuth(['SUPERVISOR'])
  if (guard) return guard
  const actual = await prisma.coach.findUnique({ where: { id: params.id } })
  if (!actual) return NextResponse.json({ error: 'Coach no encontrado' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const leido = leerCoach(body ?? {})
  if ('error' in leido) return NextResponse.json({ error: leido.error }, { status: 400 })

  const otro = await prisma.coach.findUnique({
    where: { tipoDocumento_numeroDocumento: { tipoDocumento: leido.data.tipoDocumento, numeroDocumento: leido.data.numeroDocumento } },
  })
  if (otro && otro.id !== actual.id) return NextResponse.json({ error: `Ya existe un coach con ese documento: ${otro.nombre}` }, { status: 409 })

  const coach = await prisma.coach.update({ where: { id: params.id }, data: leido.data })
  return NextResponse.json(coach)
}
