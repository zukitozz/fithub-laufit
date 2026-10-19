import type { OrigenAsistencia, Socio } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { obtenerConfiguracion } from '@/lib/config'
import { situacionSocio } from '@/lib/membresias'

/** Membresías del socio relevantes para calcular su situación hoy (no anuladas). */
export async function situacionActualDe(socioId: string) {
  const [config, membresias] = await Promise.all([
    obtenerConfiguracion(),
    prisma.membresia.findMany({ where: { socioId, anulada: false }, include: { plan: true }, orderBy: { fechaFin: 'desc' } }),
  ])
  return { config, situacion: situacionSocio(membresias, config) }
}

export type ResultadoRegistro =
  | { resultado: 'OK' | 'NO_VIGENTE'; asistenciaId: string }
  | { resultado: 'DUPLICADO' }

/**
 * Registra el ingreso de un socio. Se guarda siempre, aunque la membresía no esté vigente: el
 * panel de recepción lo muestra en rojo y la administradora decide. Evita duplicados dentro de
 * `minutosAntiDuplicadoIngreso`.
 */
export async function registrarAsistenciaSocio(socio: Pick<Socio, 'id'>, origen: OrigenAsistencia, opciones: { ip?: string; usuarioId?: string } = {}): Promise<ResultadoRegistro> {
  const { config, situacion } = await situacionActualDe(socio.id)

  const desde = new Date(Date.now() - config.minutosAntiDuplicadoIngreso * 60_000)
  const reciente = await prisma.asistencia.findFirst({
    where: { socioId: socio.id, validacion: { not: 'ANULADA' }, fechaHora: { gte: desde } },
    select: { id: true },
  })
  if (reciente) return { resultado: 'DUPLICADO' }

  const asistencia = await prisma.asistencia.create({
    data: {
      socioId: socio.id,
      membresiaId: situacion.membresia?.id ?? null,
      origen,
      estadoMembresia: situacion.estado,
      diasRestantes: situacion.diasRestantes,
      ip: opciones.ip ?? null,
      // Lo registrado en recepción ya lo vio la administradora.
      ...(origen === 'RECEPCION' ? { validacion: 'CONFIRMADA' as const, validadaPorId: opciones.usuarioId ?? null, validadaAt: new Date() } : {}),
    },
  })

  const vigente = situacion.estado === 'VIGENTE' || situacion.estado === 'POR_VENCER'
  return { resultado: vigente ? 'OK' : 'NO_VIGENTE', asistenciaId: asistencia.id }
}
