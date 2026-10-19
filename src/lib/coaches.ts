import type { MarcacionCoach, TipoMarcacion } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// Una ENTRADA sin SALIDA con más de estas horas se considera olvidada: la siguiente marcación vuelve a ser ENTRADA.
const HORAS_MAXIMAS_TURNO = 18

/** ENTRADA o SALIDA que corresponde según la última marcación válida del coach. */
export function proponerTipo(ultima: Pick<MarcacionCoach, 'tipo' | 'fechaHora'> | null, ahora: Date = new Date()): TipoMarcacion {
  if (!ultima || ultima.tipo === 'SALIDA') return 'ENTRADA'
  const horas = (ahora.getTime() - ultima.fechaHora.getTime()) / 3_600_000
  return horas > HORAS_MAXIMAS_TURNO ? 'ENTRADA' : 'SALIDA'
}

export async function ultimaMarcacionValida(coachId: string) {
  return prisma.marcacionCoach.findFirst({ where: { coachId, anulada: false }, orderBy: { fechaHora: 'desc' } })
}

export interface ResumenDiaCoach {
  primeraEntrada: Date | null
  ultimaSalida: Date | null
  minutosTrabajados: number
  incompleta: boolean
}

/** Suma pares ENTRADA/SALIDA ordenados. Una ENTRADA sin SALIDA deja el día "incompleto" (no suma). */
export function resumirDia(marcaciones: Pick<MarcacionCoach, 'tipo' | 'fechaHora'>[]): ResumenDiaCoach {
  const orden = [...marcaciones].sort((a, b) => a.fechaHora.getTime() - b.fechaHora.getTime())
  let minutos = 0
  let entradaAbierta: Date | null = null
  let primeraEntrada: Date | null = null
  let ultimaSalida: Date | null = null
  for (const m of orden) {
    if (m.tipo === 'ENTRADA') {
      if (!entradaAbierta) entradaAbierta = m.fechaHora
      primeraEntrada ??= m.fechaHora
    } else if (entradaAbierta) {
      minutos += Math.round((m.fechaHora.getTime() - entradaAbierta.getTime()) / 60_000)
      entradaAbierta = null
      ultimaSalida = m.fechaHora
    }
  }
  return { primeraEntrada, ultimaSalida, minutosTrabajados: minutos, incompleta: entradaAbierta !== null }
}
