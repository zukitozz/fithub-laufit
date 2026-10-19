import { hoyPeru } from '@/lib/fechas'

// Las fechas de membresía son @db.Date: Prisma las entrega como Date a las 00:00 UTC.
// Todo el cálculo se hace en UTC sobre esas fechas, así una zona horaria no mueve un vencimiento un día.

const MS_DIA = 24 * 60 * 60 * 1000

export type EstadoMembresia = 'VIGENTE' | 'POR_VENCER' | 'VENCIDA' | 'PROGRAMADA' | 'ANULADA'
export type EstadoAlMarcar = 'VIGENTE' | 'POR_VENCER' | 'VENCIDA' | 'SIN_MEMBRESIA'

export interface MembresiaFechas {
  fechaInicio: Date
  fechaFin: Date
  anulada: boolean
}

export interface ReglasVigencia {
  diasAvisoVencimiento: number
  diasGracia: number
}

/** Hoy en Lima como Date a las 00:00 UTC. */
export function hoyFecha(): Date {
  return fechaDesdeTexto(hoyPeru())
}

export function fechaDesdeTexto(texto: string): Date {
  return new Date(`${texto.slice(0, 10)}T00:00:00.000Z`)
}

export function textoFecha(fecha: Date): string {
  return fecha.toISOString().slice(0, 10)
}

export function sumarDias(fecha: Date, dias: number): Date {
  return new Date(fecha.getTime() + dias * MS_DIA)
}

/** Suma meses de calendario; si el día no existe en el mes de destino usa el último día de ese mes (31/01 + 1 mes = 28/02). */
export function sumarMeses(fecha: Date, meses: number): Date {
  const anio = fecha.getUTCFullYear()
  const mes = fecha.getUTCMonth() + meses
  const dia = fecha.getUTCDate()
  const ultimoDiaDestino = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate()
  return new Date(Date.UTC(anio, mes, Math.min(dia, ultimoDiaDestino)))
}

/** inicio + duración − 1 día. 1 mes desde 05/11 vence 04/12. */
export function calcularFechaFin(inicio: Date, duracion: number, unidad: 'MESES' | 'DIAS'): Date {
  const siguiente = unidad === 'MESES' ? sumarMeses(inicio, duracion) : sumarDias(inicio, duracion)
  return sumarDias(siguiente, -1)
}

export function diasEntre(desde: Date, hasta: Date): number {
  return Math.round((hasta.getTime() - desde.getTime()) / MS_DIA)
}

/** Días que le quedan hasta fechaFin (0 = vence hoy, negativo = ya venció). */
export function diasRestantes(fechaFin: Date, hoy: Date = hoyFecha()): number {
  return diasEntre(hoy, fechaFin)
}

export function estadoMembresia(m: MembresiaFechas, reglas: ReglasVigencia, hoy: Date = hoyFecha()): EstadoMembresia {
  if (m.anulada) return 'ANULADA'
  if (m.fechaInicio > hoy) return 'PROGRAMADA'
  const limite = sumarDias(m.fechaFin, reglas.diasGracia)
  if (hoy > limite) return 'VENCIDA'
  return diasRestantes(m.fechaFin, hoy) <= reglas.diasAvisoVencimiento ? 'POR_VENCER' : 'VIGENTE'
}

export interface SituacionSocio<T extends MembresiaFechas> {
  estado: EstadoAlMarcar
  membresia: T | null
  diasRestantes: number | null
  fechaFin: Date | null
  /** Hay una renovación futura ya pagada. */
  programada: T | null
}

/** Membresía que cuenta hoy para el acceso del socio y su estado. */
export function situacionSocio<T extends MembresiaFechas>(membresias: T[], reglas: ReglasVigencia, hoy: Date = hoyFecha()): SituacionSocio<T> {
  const activas = membresias.filter((m) => !m.anulada)
  const programada = activas.filter((m) => m.fechaInicio > hoy).sort((a, b) => a.fechaInicio.getTime() - b.fechaInicio.getTime())[0] ?? null
  const vigente = activas
    .filter((m) => m.fechaInicio <= hoy && hoy <= sumarDias(m.fechaFin, reglas.diasGracia))
    .sort((a, b) => b.fechaFin.getTime() - a.fechaFin.getTime())[0]

  if (vigente) {
    const estado = estadoMembresia(vigente, reglas, hoy) === 'POR_VENCER' ? 'POR_VENCER' : 'VIGENTE'
    return { estado, membresia: vigente, diasRestantes: diasRestantes(vigente.fechaFin, hoy), fechaFin: vigente.fechaFin, programada }
  }

  const ultima = activas.filter((m) => m.fechaInicio <= hoy).sort((a, b) => b.fechaFin.getTime() - a.fechaFin.getTime())[0]
  if (ultima) {
    return { estado: 'VENCIDA', membresia: ultima, diasRestantes: diasRestantes(ultima.fechaFin, hoy), fechaFin: ultima.fechaFin, programada }
  }
  return { estado: 'SIN_MEMBRESIA', membresia: null, diasRestantes: null, fechaFin: null, programada }
}

/** Fecha de inicio por defecto: hoy, o el día siguiente al fin de la última membresía si aún no vence (no pierde días). */
export function inicioPorDefecto(membresias: MembresiaFechas[], hoy: Date = hoyFecha()): Date {
  const finMayor = membresias.filter((m) => !m.anulada).reduce<Date | null>((mayor, m) => (!mayor || m.fechaFin > mayor ? m.fechaFin : mayor), null)
  return finMayor && finMayor >= hoy ? sumarDias(finMayor, 1) : hoy
}

export function seSuperpone(membresias: MembresiaFechas[], inicio: Date, fin: Date): boolean {
  return membresias.some((m) => !m.anulada && m.fechaInicio <= fin && m.fechaFin >= inicio)
}
