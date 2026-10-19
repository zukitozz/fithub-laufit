import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'
import { obtenerConfiguracion } from '@/lib/config'
import { situacionSocio } from '@/lib/membresias'
import { leerSocio } from '@/lib/socios'
import { urlFirmada } from '@/lib/storage'

export const dynamic = 'force-dynamic'

const POR_PAGINA = 25

export async function GET(req: Request) {
  const guard = await requireApiAuth(['ADMIN', 'SUPERVISOR'])
  if (guard) return guard

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  const pagina = Math.max(1, Number(searchParams.get('pagina')) || 1)

  const where: Prisma.SocioWhereInput = { activo: true }
  if (q) {
    where.OR = [
      { nombre: { contains: q, mode: 'insensitive' } },
      { numeroDocumento: { startsWith: q } },
      { celular: { contains: q.replace(/\D/g, '') || '@@' } },
    ]
  }

  const [config, total, socios] = await Promise.all([
    obtenerConfiguracion(),
    prisma.socio.count({ where }),
    prisma.socio.findMany({
      where,
      orderBy: { nombre: 'asc' },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      include: { membresias: { where: { anulada: false }, include: { plan: { select: { nombre: true } } } } },
    }),
  ])

  const items = await Promise.all(
    socios.map(async ({ membresias, ...socio }) => {
      const s = situacionSocio(membresias, config)
      return {
        ...socio,
        fotoUrl: await urlFirmada(socio.fotoKey),
        estado: s.estado,
        diasRestantes: s.diasRestantes,
        fechaFin: s.fechaFin,
        plan: s.membresia?.plan.nombre ?? null,
        programada: Boolean(s.programada),
      }
    }),
  )

  return NextResponse.json({ items, total, pagina, porPagina: POR_PAGINA })
}

export async function POST(req: Request) {
  const guard = await requireApiAuth(['ADMIN', 'SUPERVISOR'])
  if (guard) return guard

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })

  const leido = leerSocio(body)
  if ('error' in leido) return NextResponse.json({ error: leido.error }, { status: 400 })
  const { consentimientoWhatsApp, ...datos } = leido.data

  const existente = await prisma.socio.findUnique({
    where: { tipoDocumento_numeroDocumento: { tipoDocumento: datos.tipoDocumento, numeroDocumento: datos.numeroDocumento } },
  })
  if (existente) return NextResponse.json({ error: `Ya existe un socio con ese documento: ${existente.nombre}`, socioId: existente.id }, { status: 409 })

  const socio = await prisma.socio.create({
    data: {
      ...datos,
      consentimientoWhatsApp,
      ...(consentimientoWhatsApp ? { consentimientoWhatsAppAt: new Date(), consentimientoWhatsAppOrigen: 'ALTA_RECEPCION' } : {}),
    },
  })
  return NextResponse.json(socio, { status: 201 })
}
