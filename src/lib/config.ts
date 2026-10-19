import { prisma } from '@/lib/prisma'

/** La fila única de configuración; se crea con valores por defecto si aún no existe. */
export async function obtenerConfiguracion() {
  return prisma.configuracion.upsert({ where: { id: 'default' }, update: {}, create: { id: 'default' } })
}

export type HorarioAtencion = Record<string, [string, string] | null>

/** true si el instante cae fuera del horario de atención (0 = domingo). Sin horario configurado nunca marca "fuera". */
export function fueraDeHorario(horario: unknown, instante: Date): boolean {
  if (!horario || typeof horario !== 'object') return false
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Lima', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(instante)
  const get = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? ''
  const dia = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'))
  const rango = (horario as HorarioAtencion)[String(dia)]
  if (!rango) return true
  const hora = `${get('hour')}:${get('minute')}`
  return hora < rango[0] || hora > rango[1]
}
