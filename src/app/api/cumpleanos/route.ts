import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'
import { obtenerConfiguracion } from '@/lib/config'
import { infoCumpleanos, perteneceATab, type TabCumpleanos } from '@/lib/cumpleanos'
import { hoyPeru } from '@/lib/fechas'
import { hoyFecha, situacionSocio } from '@/lib/membresias'
import { urlFirmada } from '@/lib/storage'

export const dynamic = 'force-dynamic'

const TABS: TabCumpleanos[] = ['hoy', 'proximos', 'mes']
const MS_DIA = 24 * 60 * 60 * 1000

// ?tab=hoy|proximos|mes  (próximos = los 7 días siguientes; mes = todo el mes calendario)
export async function GET(req: Request) {
  const guard = await requireApiAuth(['ADMIN', 'SUPERVISOR'])
  if (guard) return guard

  const tabParam = new URL(req.url).searchParams.get('tab')
  const tab: TabCumpleanos = TABS.includes(tabParam as TabCumpleanos) ? (tabParam as TabCumpleanos) : 'hoy'

  const hoyTexto = hoyPeru()
  const mesActual = Number(hoyTexto.slice(5, 7))
  const config = await obtenerConfiguracion()

  const socios = await prisma.socio.findMany({
    where: { activo: true, fechaNacimiento: { not: null } },
    select: { id: true, nombre: true, tipoDocumento: true, numeroDocumento: true, celular: true, fotoKey: true, fechaNacimiento: true },
  })
  const todos = socios.map((s) => ({ s, info: infoCumpleanos(s.fechaNacimiento!, hoyTexto) }))
  const conteos = Object.fromEntries(TABS.map((t) => [t, todos.filter((x) => perteneceATab(x.info, t, mesActual)).length]))
  const sinFecha = await prisma.socio.count({ where: { activo: true, fechaNacimiento: null } })

  const elegidos = todos
    .filter((x) => perteneceATab(x.info, tab, mesActual))
    // Mes: por día del mes. Hoy y próximos: por cercanía.
    .sort((a, b) => (tab === 'mes' ? a.info.dia - b.info.dia : a.info.dias - b.info.dias) || a.s.nombre.localeCompare(b.s.nombre))

  const ids = elegidos.map((x) => x.s.id)
  const hoy = hoyFecha()
  const [membresias, saludos] = await Promise.all([
    prisma.membresia.findMany({ where: { socioId: { in: ids }, anulada: false }, include: { plan: { select: { nombre: true } } } }),
    prisma.contactoSocio.findMany({ where: { socioId: { in: ids }, motivo: 'CUMPLEANOS', creadoAt: { gte: new Date(Date.now() - 400 * MS_DIA) } }, select: { socioId: true, creadoAt: true } }),
  ])

  const items = await Promise.all(
    elegidos.map(async ({ s, info }) => {
      const situacion = situacionSocio(membresias.filter((m) => m.socioId === s.id), config, hoy)
      // En "mes" se muestra el cumpleaños de este año (aunque ya haya pasado); en el resto, el próximo.
      const fecha = tab === 'mes' ? info.esteAnio : info.proxima
      const ocurrencia = new Date(`${fecha}T00:00:00Z`).getTime()
      // "Saludado": hay un saludo registrado desde una semana antes hasta un mes después de ese cumpleaños.
      const saludado = saludos.some((x) => x.socioId === s.id && x.creadoAt.getTime() >= ocurrencia - 7 * MS_DIA && x.creadoAt.getTime() <= ocurrencia + 30 * MS_DIA)
      return {
        socio: { id: s.id, nombre: s.nombre, tipoDocumento: s.tipoDocumento, numeroDocumento: s.numeroDocumento, celular: s.celular, fotoUrl: await urlFirmada(s.fotoKey) },
        fecha,
        dias: tab === 'mes' ? Math.round((ocurrencia - Date.UTC(Number(hoyTexto.slice(0, 4)), mesActual - 1, Number(hoyTexto.slice(8, 10)))) / MS_DIA) : info.dias,
        edad: tab === 'mes' ? Number(info.esteAnio.slice(0, 4)) - s.fechaNacimiento!.getUTCFullYear() : info.edad,
        estado: situacion.estado,
        plan: situacion.membresia?.plan.nombre ?? null,
        diasRestantes: situacion.diasRestantes,
        fechaFin: situacion.fechaFin,
        saludado,
      }
    }),
  )

  return NextResponse.json({ tab, conteos, sinFecha, items })
}
