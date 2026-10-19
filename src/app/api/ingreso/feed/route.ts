import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'
import { fueraDeHorario, obtenerConfiguracion } from '@/lib/config'
import { enmascararDocumento } from '@/lib/documentos'
import { hoyPeru, rangoDiaPeru } from '@/lib/fechas'
import { situacionSocio } from '@/lib/membresias'
import { urlFirmada } from '@/lib/storage'

export const dynamic = 'force-dynamic'

const MAX_TARJETAS = 60

// Datos del panel de ingresos en vivo (la página lo consulta cada pocos segundos).
export async function GET() {
  const guard = await requireApiAuth(['ADMIN', 'SUPERVISOR'])
  if (guard) return guard

  const hoy = hoyPeru()
  const rango = rangoDiaPeru(hoy)
  const [mes, dia] = [hoy.slice(5, 7), hoy.slice(8, 10)]

  const config = await obtenerConfiguracion()
  const asistencias = await prisma.asistencia.findMany({
    where: { fechaHora: rango },
    orderBy: { fechaHora: 'desc' },
    take: MAX_TARJETAS,
    include: { socio: true },
  })
  const socioIds = [...new Set(asistencias.map((a) => a.socioId))]

  const hace30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const [membresias, visitas, previas, pendientes, coaches, marcacionesHoy] = await Promise.all([
    prisma.membresia.findMany({ where: { socioId: { in: socioIds }, anulada: false }, include: { plan: { select: { nombre: true } } } }),
    prisma.asistencia.groupBy({ by: ['socioId'], where: { socioId: { in: socioIds }, fechaHora: { gte: hace30 }, validacion: { not: 'ANULADA' } }, _count: { _all: true } }),
    prisma.asistencia.findMany({
      where: { socioId: { in: socioIds }, fechaHora: { lt: rango.gte }, validacion: { not: 'ANULADA' } },
      orderBy: { fechaHora: 'desc' },
      distinct: ['socioId'],
      select: { socioId: true, fechaHora: true },
    }),
    prisma.asistencia.count({ where: { fechaHora: rango, validacion: 'PENDIENTE' } }),
    prisma.coach.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' }, select: { id: true, nombre: true } }),
    prisma.marcacionCoach.findMany({ where: { fechaHora: rango, anulada: false }, orderBy: { fechaHora: 'asc' } }),
  ])

  const items = await Promise.all(
    asistencias.map(async (a) => {
      const s = situacionSocio(membresias.filter((m) => m.socioId === a.socioId), config)
      const nac = a.socio.fechaNacimiento?.toISOString().slice(5, 10)
      return {
        id: a.id,
        fechaHora: a.fechaHora,
        origen: a.origen,
        validacion: a.validacion,
        motivo: a.motivo,
        fueraDeHorario: fueraDeHorario(config.horarioAtencion, a.fechaHora),
        socio: {
          id: a.socio.id,
          nombre: a.socio.nombre,
          tipoDocumento: a.socio.tipoDocumento,
          documento: enmascararDocumento(a.socio.numeroDocumento),
          fotoUrl: await urlFirmada(a.socio.fotoKey),
          condicionMedica: a.socio.condicionMedica,
          notas: a.socio.notas,
          cumpleHoy: nac === `${mes}-${dia}`,
        },
        // Estado en vivo: si la administradora renueva mientras la tarjeta está abierta, se pone verde.
        estado: s.estado,
        plan: s.membresia?.plan.nombre ?? null,
        diasRestantes: s.diasRestantes,
        fechaFin: s.fechaFin,
        renovacionProgramada: Boolean(s.programada),
        visitas30: visitas.find((v) => v.socioId === a.socioId)?._count._all ?? 0,
        ultimaVisita: previas.find((p) => p.socioId === a.socioId)?.fechaHora ?? null,
      }
    }),
  )

  const coachesHoy = coaches
    .map((c) => {
      const propias = marcacionesHoy.filter((m) => m.coachId === c.id)
      const ultima = propias[propias.length - 1]
      return ultima ? { id: c.id, nombre: c.nombre, presente: ultima.tipo === 'ENTRADA', hora: ultima.fechaHora, tipo: ultima.tipo } : null
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)

  return NextResponse.json({ items, pendientes, coaches: coachesHoy, ahora: new Date() })
}
