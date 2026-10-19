import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { requireApiAuth } from '@/lib/api-auth'
import { hoyPeru } from '@/lib/fechas'
import { fechaPosponer } from '@/lib/vencimientos'

export const dynamic = 'force-dynamic'

const MOTIVOS = ['VENCIMIENTO', 'CUMPLEANOS', 'OTRO']
type Ctx = { params: { id: string } }

export async function GET(_req: Request, { params }: Ctx) {
  const guard = await requireApiAuth(['ADMIN', 'SUPERVISOR'])
  if (guard) return guard
  const contactos = await prisma.contactoSocio.findMany({
    where: { socioId: params.id },
    orderBy: { creadoAt: 'desc' },
    take: 30,
    include: { usuario: { select: { name: true } } },
  })
  return NextResponse.json(contactos.map((c) => ({ id: c.id, motivo: c.motivo, nota: c.nota, creadoAt: c.creadoAt, usuario: c.usuario.name })))
}

// Registra un contacto (llamada, saludo) y, si se pide, pospone el recordatorio de renovación.
export async function POST(req: Request, { params }: Ctx) {
  const guard = await requireApiAuth(['ADMIN', 'SUPERVISOR'])
  if (guard) return guard
  const session = await auth()

  const body = await req.json().catch(() => null)
  const nota = typeof body?.nota === 'string' ? body.nota.trim() : ''
  if (nota.length < 2) return NextResponse.json({ error: 'Escribe una nota breve del contacto' }, { status: 400 })
  if (nota.length > 500) return NextResponse.json({ error: 'La nota no puede pasar de 500 caracteres' }, { status: 400 })
  if (!MOTIVOS.includes(body?.motivo)) return NextResponse.json({ error: 'Motivo inválido' }, { status: 400 })
  const posponerDias = body?.posponerDias === undefined ? 0 : Number(body.posponerDias)
  if (!Number.isInteger(posponerDias) || posponerDias < 0 || posponerDias > 30) return NextResponse.json({ error: 'Los días para posponer deben estar entre 0 y 30' }, { status: 400 })

  const socio = await prisma.socio.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!socio) return NextResponse.json({ error: 'Socio no encontrado' }, { status: 404 })

  const [contacto] = await prisma.$transaction([
    prisma.contactoSocio.create({ data: { socioId: socio.id, motivo: body.motivo, nota, usuarioId: session!.user.id } }),
    ...(posponerDias > 0 ? [prisma.socio.update({ where: { id: socio.id }, data: { recordatorioPospuestoHasta: fechaPosponer(posponerDias, hoyPeru()) } })] : []),
  ])
  return NextResponse.json({ id: contacto.id, pospuesto: posponerDias > 0 }, { status: 201 })
}
