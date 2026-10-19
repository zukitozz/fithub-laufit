import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'
import { obtenerConfiguracion } from '@/lib/config'
import { hoyFecha, situacionSocio, sumarDias } from '@/lib/membresias'
import { urlFirmada } from '@/lib/storage'
import { clasificarVencimiento, compararUrgencia, DIAS_VENCIDOS_MAX, type TabVencimiento } from '@/lib/vencimientos'

export const dynamic = 'force-dynamic'

const TABS: TabVencimiento[] = ['hoy', 'proximos', 'vencidos', 'pospuestos']

// Lista de trabajo de renovaciones: quién vence hoy, en los próximos 7 días, o venció en los últimos 30.
// ?tab=hoy|proximos|vencidos|pospuestos  ?q=nombre, documento o celular  ?plan=<id>
export async function GET(req: Request) {
  const guard = await requireApiAuth(['ADMIN', 'SUPERVISOR'])
  if (guard) return guard

  const { searchParams } = new URL(req.url)
  const tabParam = searchParams.get('tab')
  const tab: TabVencimiento = TABS.includes(tabParam as TabVencimiento) ? (tabParam as TabVencimiento) : 'hoy'
  const q = searchParams.get('q')?.trim().toLowerCase() ?? ''
  const planId = searchParams.get('plan') ?? ''

  const config = await obtenerConfiguracion()
  const hoy = hoyFecha()
  const ahora = new Date()

  // Candidatos: socios activos con alguna membresía que terminó hace menos de 30 días (o que aún corre).
  const socios = await prisma.socio.findMany({
    where: { activo: true, membresias: { some: { anulada: false, fechaFin: { gte: sumarDias(hoy, -DIAS_VENCIDOS_MAX) } } } },
    include: { membresias: { where: { anulada: false }, include: { plan: { select: { id: true, nombre: true } } } } },
  })

  const filas = socios.flatMap((s) => {
    const situacion = situacionSocio(s.membresias, config, hoy)
    const clase = clasificarVencimiento({ diasRestantes: situacion.diasRestantes, tieneRenovacion: Boolean(situacion.programada), pospuestoHasta: s.recordatorioPospuestoHasta }, ahora)
    if (!clase || !situacion.membresia || situacion.diasRestantes === null || !situacion.fechaFin) return []
    return [{ socio: s, clase, membresia: situacion.membresia, diasRestantes: situacion.diasRestantes, fechaFin: situacion.fechaFin }]
  })

  const conteos = Object.fromEntries(TABS.map((t) => [t, filas.filter((f) => f.clase.tab === t).length]))

  const digitos = q.replace(/\D/g, '')
  const elegidas = filas.filter((f) => {
    if (f.clase.tab !== tab) return false
    if (planId && f.membresia.plan.id !== planId) return false
    if (!q) return true
    return f.socio.nombre.toLowerCase().includes(q) || f.socio.numeroDocumento.startsWith(q) || (digitos.length >= 3 && (f.socio.celular ?? '').includes(digitos))
  })

  const ids = elegidas.map((f) => f.socio.id)
  const hace30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const [visitas, ultimas, contactos] = await Promise.all([
    prisma.asistencia.groupBy({ by: ['socioId'], where: { socioId: { in: ids }, fechaHora: { gte: hace30 }, validacion: { not: 'ANULADA' } }, _count: { _all: true } }),
    prisma.asistencia.findMany({ where: { socioId: { in: ids }, validacion: { not: 'ANULADA' } }, orderBy: { fechaHora: 'desc' }, distinct: ['socioId'], select: { socioId: true, fechaHora: true } }),
    prisma.contactoSocio.findMany({ where: { socioId: { in: ids } }, orderBy: { creadoAt: 'desc' }, distinct: ['socioId'], include: { usuario: { select: { name: true } } } }),
  ])

  const items = await Promise.all(
    elegidas.map(async (f) => {
      const contacto = contactos.find((c) => c.socioId === f.socio.id)
      return {
        socio: {
          id: f.socio.id,
          nombre: f.socio.nombre,
          tipoDocumento: f.socio.tipoDocumento,
          numeroDocumento: f.socio.numeroDocumento,
          celular: f.socio.celular,
          fotoUrl: await urlFirmada(f.socio.fotoKey),
        },
        plan: f.membresia.plan.nombre,
        fechaFin: f.fechaFin,
        diasRestantes: f.diasRestantes,
        base: f.clase.base,
        pospuestoHasta: f.clase.pospuesto ? f.socio.recordatorioPospuestoHasta : null,
        visitas30: visitas.find((v) => v.socioId === f.socio.id)?._count._all ?? 0,
        ultimaVisita: ultimas.find((u) => u.socioId === f.socio.id)?.fechaHora ?? null,
        ultimoContacto: contacto ? { creadoAt: contacto.creadoAt, nota: contacto.nota, motivo: contacto.motivo, usuario: contacto.usuario.name } : null,
      }
    }),
  )
  items.sort(compararUrgencia)

  return NextResponse.json({ tab, conteos, items })
}
