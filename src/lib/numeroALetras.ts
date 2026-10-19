const UNIDADES = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE']
const DIECIS = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE']
const VEINTIS = ['VEINTE', 'VEINTIUNO', 'VEINTIDOS', 'VEINTITRES', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISEIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE']
const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS']

function convertirGrupo(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'CIEN'

  const centena = Math.floor(n / 100)
  const resto = n % 100
  let texto = centena > 0 ? CENTENAS[centena] : ''

  if (resto > 0) {
    let restoTexto: string
    if (resto < 10) restoTexto = UNIDADES[resto]
    else if (resto < 20) restoTexto = DIECIS[resto - 10]
    else if (resto < 30) restoTexto = VEINTIS[resto - 20]
    else {
      const decena = Math.floor(resto / 10)
      const unidad = resto % 10
      restoTexto = DECENAS[decena] + (unidad > 0 ? ' Y ' + UNIDADES[unidad] : '')
    }
    texto = texto ? `${texto} ${restoTexto}` : restoTexto
  }

  return texto
}

function convertirEntero(n: number): string {
  if (n === 0) return 'CERO'
  if (n < 1000) return convertirGrupo(n)

  if (n < 1_000_000) {
    const miles = Math.floor(n / 1000)
    const resto = n % 1000
    const milesTexto = miles === 1 ? 'MIL' : `${convertirGrupo(miles)} MIL`
    return resto > 0 ? `${milesTexto} ${convertirGrupo(resto)}` : milesTexto
  }

  const millones = Math.floor(n / 1_000_000)
  const resto = n % 1_000_000
  const millonesTexto = millones === 1 ? 'UN MILLON' : `${convertirEntero(millones)} MILLONES`
  return resto > 0 ? `${millonesTexto} ${convertirEntero(resto)}` : millonesTexto
}

export function numeroALetras(monto: number, moneda = 'SOLES'): string {
  const absoluto = Math.abs(monto)
  const entero = Math.floor(absoluto)
  const centimos = Math.round((absoluto - entero) * 100)

  return `${convertirEntero(entero)} CON ${String(centimos).padStart(2, '0')}/100 ${moneda}`
}
