import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'
import { obtenerConfiguracion } from '@/lib/config'
import { hoyPeru, mesActualPeru, rangoDiaPeru, rangoMesPeru } from '@/lib/fechas'
import { hoyFecha, sumarDias } from '@/lib/membresias'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requireApiAuth(['ADMIN', 'SUPERVISOR'])
  if (guard) return guard

  const config = await obtenerConfiguracion()
  const hoy = hoyFecha()
  const dia = rangoDiaPeru(hoyPeru())
  const mes = rangoMesPeru(mesActualPeru())
  const limiteVigencia = sumarDias(hoy, -config.diasGracia)

  const sumaIngresos = async (rango: { gte: Date; lte: Date }) => {
    const [ventas, notas] = await Promise.all([
      prisma.factura.aggregate({ _sum: { total: true }, where: { tipo: { in: ['BOLETA', 'FACTURA', 'NOTA_DESPACHO'] }, creadoAt: rango } }),
      prisma.factura.aggregate({ _sum: { total: true }, where: { tipo: 'NOTA_CREDITO', creadoAt: rango } }),
    ])
    return Math.round(((ventas._sum.total ?? 0) - (notas._sum.total ?? 0)) * 100) / 100
  }

  const [vigentes, porVencer, altasMes, asistenciaHoy, pendientesHoy, ingresosHoy, ingresosMes, facturasPendientes, conNacimiento] = await Promise.all([
    prisma.membresia.findMany({ where: { anulada: false, fechaInicio: { lte: hoy }, fechaFin: { gte: limiteVigencia } }, distinct: ['socioId'], select: { socioId: true } }),
    prisma.membresia.groupBy({
      by: ['socioId'],
      where: { anulada: false },
      _max: { fechaFin: true },
      having: { fechaFin: { _max: { gte: hoy, lte: sumarDias(hoy, 7) } } },
    }),
    prisma.socio.count({ where: { createdAt: mes } }),
    prisma.asistencia.count({ where: { fechaHora: dia, validacion: { not: 'ANULADA' } } }),
    prisma.asistencia.count({ where: { fechaHora: dia, validacion: 'PENDIENTE' } }),
    sumaIngresos(dia),
    sumaIngresos(mes),
    prisma.factura.count({ where: { enviado: false, activo: true, tipo: { not: 'NOTA_DESPACHO' } } }),
    prisma.socio.findMany({ where: { activo: true, fechaNacimiento: { not: null } }, select: { id: true, nombre: true, fechaNacimiento: true } }),
  ])

  const mmdd = hoyPeru().slice(5)
  const cumpleanosHoy = conNacimiento.filter((s) => s.fechaNacimiento?.toISOString().slice(5, 10) === mmdd).map((s) => ({ id: s.id, nombre: s.nombre }))

  return NextResponse.json({
    sociosActivos: vigentes.length,
    vencenEn7Dias: porVencer.length,
    altasMes,
    asistenciaHoy,
    pendientesHoy,
    ingresosHoy,
    ingresosMes,
    facturasPendientes,
    cumpleanosHoy,
  })
}
