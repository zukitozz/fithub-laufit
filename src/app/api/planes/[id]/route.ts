import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'
import { leerPlan } from '@/lib/planes'

export const dynamic = 'force-dynamic'

// Cambiar el precio no afecta a las membresías ya vendidas: cada una guarda el precio con el que se vendió.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAuth(['SUPERVISOR'])
  if (guard) return guard
  const existente = await prisma.plan.findUnique({ where: { id: params.id } })
  if (!existente) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
  const body = await req.json().catch(() => null)
  const leido = leerPlan(body ?? {})
  if ('error' in leido) return NextResponse.json({ error: leido.error }, { status: 400 })
  const plan = await prisma.plan.update({ where: { id: params.id }, data: leido.data })
  return NextResponse.json(plan)
}
