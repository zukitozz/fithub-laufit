// Perú no tiene horario de verano: el offset -05:00 es fijo todo el año, así que se puede
// calcular el rango de un día/mes en hora peruana sin depender del timezone del servidor.
const OFFSET_PERU = '-05:00'

export function rangoDiaPeru(fecha: string) {
  return {
    gte: new Date(`${fecha}T00:00:00${OFFSET_PERU}`),
    lte: new Date(`${fecha}T23:59:59.999${OFFSET_PERU}`),
  }
}

export function rangoMesPeru(mes: string) {
  const [anioStr, mesStr] = mes.split('-')
  const anio = Number(anioStr)
  const mesNum = Number(mesStr)
  const gte = new Date(`${anioStr}-${mesStr}-01T00:00:00${OFFSET_PERU}`)
  const ultimoDia = new Date(Date.UTC(anio, mesNum, 0)).getUTCDate()
  const lte = new Date(`${anioStr}-${mesStr}-${String(ultimoDia).padStart(2, '0')}T23:59:59.999${OFFSET_PERU}`)
  return { gte, lte }
}

export function hoyPeru(): string {
  return fechaPeru(new Date())
}

/** Fecha 'YYYY-MM-DD' de un instante, vista en hora peruana (en-CA formatea como YYYY-MM-DD). */
export function fechaPeru(fecha: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(fecha)
}

export function mesActualPeru(): string {
  return hoyPeru().slice(0, 7)
}

/** Mediodía peruano de un 'YYYY-MM-DD': evita que la fecha salte de día al cambiar de zona horaria. */
export function mediodiaPeru(fecha: string): Date {
  return new Date(`${fecha.slice(0, 10)}T12:00:00${OFFSET_PERU}`)
}
