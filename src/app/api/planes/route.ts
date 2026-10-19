import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'
import { leerPlan } from '@/lib/planes'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const guard = await requireApiAuth(['ADMIN', 'SUPERVISOR'])
  if (guard) return guard
  const soloActivos = new URL(req.url).searchParams.get('activos') === '1'
  const planes = await prisma.plan.findMany({ where: soloActivos ? { activo: true } : {}, orderBy: [{ orden: 'asc' }, { precio: 'asc' }] })
  return NextResponse.json(planes)
}

export async function POST(req: Request) {
  const guard = await requireApiAuth(['SUPERVISOR'])
  if (guard) return guard
  const body = await req.json().catch(() => null)
  const leido = leerPlan(body ?? {})
  if ('error' in leido) return NextResponse.json({ error: leido.error }, { status: 400 })
  const plan = await prisma.plan.create({ data: leido.data })
  return NextResponse.json(plan, { status: 201 })
}
