import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'
import { hoyPeru } from '@/lib/fechas'
import { fechaPosponer } from '@/lib/vencimientos'

export const dynamic = 'force-dynamic'

// Pospone el recordatorio de renovación N días (vuelve a la lista a las 00:00 de Lima). dias = 0 lo quita.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAuth(['ADMIN', 'SUPERVISOR'])
  if (guard) return guard

  const body = await req.json().catch(() => null)
  const dias = Number(body?.dias)
  if (!Number.isInteger(dias) || dias < 0 || dias > 30) return NextResponse.json({ error: 'Los días deben estar entre 0 y 30' }, { status: 400 })

  const existente = await prisma.socio.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!existente) return NextResponse.json({ error: 'Socio no encontrado' }, { status: 404 })

  const socio = await prisma.socio.update({
    where: { id: params.id },
    data: { recordatorioPospuestoHasta: dias === 0 ? null : fechaPosponer(dias, hoyPeru()) },
    select: { recordatorioPospuestoHasta: true },
  })
  return NextResponse.json({ pospuestoHasta: socio.recordatorioPospuestoHasta })
}
