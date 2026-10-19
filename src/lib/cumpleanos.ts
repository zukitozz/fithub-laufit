const MS_DIA = 24 * 60 * 60 * 1000

export interface CumpleanosInfo {
  /** Días hasta el próximo cumpleaños (0 = hoy). */
  dias: number
  /** Próxima fecha de cumpleaños, 'YYYY-MM-DD'. */
  proxima: string
  /** Edad que cumple en esa fecha. */
  edad: number
  /** Cumpleaños de este año calendario (puede haber pasado ya), 'YYYY-MM-DD'. */
  esteAnio: string
  mes: number
  dia: number
}

const esBisiesto = (a: number) => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0

/** Un 29 de febrero se celebra el 28 en los años que no son bisiestos. */
function fechaCumple(anio: number, mes: number, dia: number): Date {
  const d = mes === 2 && dia === 29 && !esBisiesto(anio) ? 28 : dia
  return new Date(Date.UTC(anio, mes - 1, d))
}

const texto = (f: Date) => f.toISOString().slice(0, 10)

/**
 * Datos de cumpleaños de una persona respecto a hoy. `nacimiento` es la fecha guardada (@db.Date, 00:00 UTC)
 * y `hoyTexto` el día de hoy en Lima ('YYYY-MM-DD').
 */
export function infoCumpleanos(nacimiento: Date, hoyTexto: string): CumpleanosInfo {
  const [ha, hm, hd] = hoyTexto.split('-').map(Number)
  const hoy = Date.UTC(ha, hm - 1, hd)
  const mes = nacimiento.getUTCMonth() + 1
  const dia = nacimiento.getUTCDate()
  const esteAnio = fechaCumple(ha, mes, dia)
  const proxima = esteAnio.getTime() >= hoy ? esteAnio : fechaCumple(ha + 1, mes, dia)
  return {
    dias: Math.round((proxima.getTime() - hoy) / MS_DIA),
    proxima: texto(proxima),
    edad: proxima.getUTCFullYear() - nacimiento.getUTCFullYear(),
    esteAnio: texto(esteAnio),
    mes,
    dia,
  }
}

export type TabCumpleanos = 'hoy' | 'proximos' | 'mes'

/** Hoy; próximos 7 días (sin contar hoy); o todo el mes calendario actual. */
export function perteneceATab(info: CumpleanosInfo, tab: TabCumpleanos, mesActual: number): boolean {
  if (tab === 'hoy') return info.dias === 0
  if (tab === 'proximos') return info.dias >= 1 && info.dias <= 7
  return info.mes === mesActual
}
