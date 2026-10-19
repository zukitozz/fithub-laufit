import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'
import { obtenerConfiguracion } from '@/lib/config'
import { estadoMembresia, situacionSocio } from '@/lib/membresias'
import { leerSocio } from '@/lib/socios'
import { urlFirmada } from '@/lib/storage'

export const dynamic = 'force-dynamic'

type Ctx = { params: { id: string } }

export async function GET(_req: Request, { params }: Ctx) {
  const guard = await requireApiAuth(['ADMIN', 'SUPERVISOR'])
  if (guard) return guard

  const [config, socio] = await Promise.all([
    obtenerConfiguracion(),
    prisma.socio.findUnique({
      where: { id: params.id },
      include: {
        membresias: { include: { plan: true, factura: { select: { id: true, tipo: true, numeracionComprobante: true, enviado: true } } }, orderBy: { fechaInicio: 'desc' } },
        asistencias: { where: { validacion: { not: 'ANULADA' } }, orderBy: { fechaHora: 'desc' }, take: 30 },
      },
    }),
  ])
  if (!socio) return NextResponse.json({ error: 'Socio no encontrado' }, { status: 404 })

  const situacion = situacionSocio(socio.membresias, config)
  return NextResponse.json({
    ...socio,
    fotoUrl: await urlFirmada(socio.fotoKey),
    estado: situacion.estado,
    diasRestantes: situacion.diasRestantes,
    fechaFin: situacion.fechaFin,
    membresias: socio.membresias.map((m) => ({ ...m, estado: estadoMembresia(m, config) })),
  })
}

export async function PATCH(req: Request, { params }: Ctx) {
  const guard = await requireApiAuth(['ADMIN', 'SUPERVISOR'])
  if (guard) return guard

  const actual = await prisma.socio.findUnique({ where: { id: params.id } })
  if (!actual) return NextResponse.json({ error: 'Socio no encontrado' }, { status: 404 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })

  const leido = leerSocio(body)
  if ('error' in leido) return NextResponse.json({ error: leido.error }, { status: 400 })
  const { consentimientoWhatsApp, ...datos } = leido.data

  if (datos.tipoDocumento !== actual.tipoDocumento || datos.numeroDocumento !== actual.numeroDocumento) {
    const otro = await prisma.socio.findUnique({
      where: { tipoDocumento_numeroDocumento: { tipoDocumento: datos.tipoDocumento, numeroDocumento: datos.numeroDocumento } },
    })
    if (otro && otro.id !== actual.id) return NextResponse.json({ error: `Ya existe un socio con ese documento: ${otro.nombre}` }, { status: 409 })
  }

  const socio = await prisma.socio.update({
    where: { id: params.id },
    data: {
      ...datos,
      consentimientoWhatsApp,
      // La fecha y el origen del consentimiento solo cambian cuando el valor cambia.
      ...(consentimientoWhatsApp !== actual.consentimientoWhatsApp
        ? { consentimientoWhatsAppAt: new Date(), consentimientoWhatsAppOrigen: consentimientoWhatsApp ? 'EDICION_RECEPCION' : 'REVOCADO_RECEPCION' }
        : {}),
    },
  })
  return NextResponse.json(socio)
}
