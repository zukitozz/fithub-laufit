export const METODOS_PAGO = ['EFECTIVO', 'TARJETA', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'DEPOSITO'] as const

export interface PagoParcial {
  metodo: string
  monto: number
}

export interface ColumnasPago {
  metodoPago: 'EFECTIVO' | 'TARJETA' | 'YAPE' | 'PLIN' | 'TRANSFERENCIA' | 'DEPOSITO' | 'MIXTO'
  pagoEfectivo: number | null
  pagoTarjeta: number | null
  pagoYape: number | null
  pagoTransferencia: number | null
  pagoDeposito: number | null
}

const METODOS_VALIDOS = new Set<string>(METODOS_PAGO)

function columnaDe(metodo: string): keyof Omit<ColumnasPago, 'metodoPago'> | null {
  switch (metodo) {
    case 'EFECTIVO': return 'pagoEfectivo'
    case 'TARJETA': return 'pagoTarjeta'
    case 'YAPE':
    case 'PLIN': return 'pagoYape'
    case 'TRANSFERENCIA': return 'pagoTransferencia'
    case 'DEPOSITO': return 'pagoDeposito'
    default: return null
  }
}

/**
 * Resuelve las columnas pago* de una Factura a partir de un único método o de un desglose por
 * varios métodos (pago mixto, p. ej. efectivo + Yape). El pago es siempre completo: los montos
 * deben sumar el total. Con más de un método distinto, metodoPago es 'MIXTO'.
 */
export function resolverPagosFactura(total: number, metodoPagoUnico: string | undefined, pagos: PagoParcial[] | undefined): ColumnasPago | { error: string } {
  const unico = metodoPagoUnico || 'EFECTIVO'
  if (!METODOS_VALIDOS.has(unico)) return { error: `Método de pago inválido: ${unico}` }

  const columnas: ColumnasPago = {
    metodoPago: unico as ColumnasPago['metodoPago'],
    pagoEfectivo: null,
    pagoTarjeta: null,
    pagoYape: null,
    pagoTransferencia: null,
    pagoDeposito: null,
  }

  if (!Array.isArray(pagos) || pagos.length === 0) {
    const columna = columnaDe(unico)
    if (columna) columnas[columna] = total
    return columnas
  }

  const sumas: Partial<Record<keyof Omit<ColumnasPago, 'metodoPago'>, number>> = {}
  const metodosDistintos = new Set<string>()
  for (const pago of pagos) {
    if (!METODOS_VALIDOS.has(pago.metodo)) return { error: `Método de pago inválido: ${pago.metodo}` }
    const monto = Number(pago.monto)
    if (!Number.isFinite(monto) || monto <= 0) return { error: 'Cada pago debe tener un monto mayor a 0' }
    const columna = columnaDe(pago.metodo)
    if (!columna) continue
    sumas[columna] = (sumas[columna] ?? 0) + monto
    metodosDistintos.add(pago.metodo)
  }

  const sumaTotal = Object.values(sumas).reduce((acc, valor) => acc + (valor ?? 0), 0)
  if (Math.abs(sumaTotal - total) > 0.01) {
    return { error: `Los montos ingresados (S/ ${sumaTotal.toFixed(2)}) no suman el total (S/ ${total.toFixed(2)})` }
  }

  for (const [columna, valor] of Object.entries(sumas) as [keyof typeof sumas, number][]) {
    columnas[columna as keyof Omit<ColumnasPago, 'metodoPago'>] = Math.round(valor * 100) / 100
  }
  columnas.metodoPago = metodosDistintos.size > 1 ? 'MIXTO' : ([...metodosDistintos][0] as ColumnasPago['metodoPago'])
  return columnas
}
