export type TabVencimiento = 'hoy' | 'proximos' | 'vencidos' | 'pospuestos'

/** "Próximos": vencen dentro de este número de días. */
export const DIAS_PROXIMOS = 7
/** Hasta cuántos días vencido se sigue mostrando para llamar; después se considera inactivo. */
export const DIAS_VENCIDOS_MAX = 30

export interface EntradaVencimiento {
  /** Días hasta fechaFin de la membresía vigente o última (negativo = ya venció). Null = sin membresía. */
  diasRestantes: number | null
  /** Ya pagó una renovación que empieza después: no hay nada que cobrar. */
  tieneRenovacion: boolean
  pospuestoHasta: Date | null
}

export interface ResultadoVencimiento {
  /** En qué grupo caería sin posponer. */
  base: Exclude<TabVencimiento, 'pospuestos'>
  pospuesto: boolean
  /** Pestaña donde se muestra. */
  tab: TabVencimiento
}

/** Decide si un socio debe aparecer en el seguimiento de vencimientos y en qué pestaña. Null = no aparece. */
export function clasificarVencimiento(e: EntradaVencimiento, ahora: Date = new Date()): ResultadoVencimiento | null {
  const dias = e.diasRestantes
  if (dias === null || e.tieneRenovacion) return null

  let base: ResultadoVencimiento['base'] | null = null
  if (dias === 0) base = 'hoy'
  else if (dias > 0 && dias <= DIAS_PROXIMOS) base = 'proximos'
  else if (dias < 0 && dias >= -DIAS_VENCIDOS_MAX) base = 'vencidos'
  if (!base) return null

  const pospuesto = e.pospuestoHasta !== null && e.pospuestoHasta.getTime() > ahora.getTime()
  return { base, pospuesto, tab: pospuesto ? 'pospuestos' : base }
}

/** Orden de trabajo: primero lo más urgente; a igual urgencia, quien viene más seguido (más fácil de retener). */
export function compararUrgencia(a: { diasRestantes: number; visitas30: number }, b: { diasRestantes: number; visitas30: number }) {
  // Vencidos: el que venció hace menos tiempo primero (-1 antes que -20). Vigentes: el que vence antes primero.
  const ua = a.diasRestantes < 0 ? -a.diasRestantes : a.diasRestantes
  const ub = b.diasRestantes < 0 ? -b.diasRestantes : b.diasRestantes
  return ua - ub || b.visitas30 - a.visitas30
}

/** Medianoche (hora de Lima) de dentro de `dias` días: el socio vuelve a la lista a primera hora. */
export function fechaPosponer(dias: number, hoyTexto: string): Date {
  const [a, m, d] = hoyTexto.split('-').map(Number)
  const destino = new Date(Date.UTC(a, m - 1, d + dias))
  return new Date(`${destino.toISOString().slice(0, 10)}T00:00:00-05:00`)
}
