import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'
import { leerCoach } from '@/lib/coachesDatos'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requireApiAuth(['ADMIN', 'SUPERVISOR'])
  if (guard) return guard
  const coaches = await prisma.coach.findMany({ orderBy: [{ activo: 'desc' }, { nombre: 'asc' }] })
  return NextResponse.json(coaches)
}

export async function POST(req: Request) {
  const guard = await requireApiAuth(['SUPERVISOR'])
  if (guard) return guard
  const body = await req.json().catch(() => null)
  const leido = leerCoach(body ?? {})
  if ('error' in leido) return NextResponse.json({ error: leido.error }, { status: 400 })

  const existente = await prisma.coach.findUnique({
    where: { tipoDocumento_numeroDocumento: { tipoDocumento: leido.data.tipoDocumento, numeroDocumento: leido.data.numeroDocumento } },
  })
  if (existente) return NextResponse.json({ error: `Ya existe un coach con ese documento: ${existente.nombre}` }, { status: 409 })

  const coach = await prisma.coach.create({ data: leido.data })
  return NextResponse.json(coach, { status: 201 })
}
