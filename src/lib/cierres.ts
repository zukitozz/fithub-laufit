import type { Prisma, PrismaClient } from '@prisma/client'

type ClientLike = PrismaClient | Prisma.TransactionClient

export const METODOS_CIERRE = ['EFECTIVO', 'TARJETA', 'YAPE', 'TRANSFERENCIA', 'DEPOSITO'] as const
export type MetodoCierre = (typeof METODOS_CIERRE)[number]

/**
 * Comprobantes aún sin cerrar. Como en fuelspa, el cierre toma TODO lo cobrado desde el cierre
 * anterior (sin importar quién lo cobró): lo cierra la administradora de turno. Las notas de crédito
 * entran y restan, para que devolver dinero también cuadre la caja.
 */
export function obtenerFacturasPendientes(client: ClientLike) {
  return client.factura.findMany({
    where: { cierreTurnoId: null, activo: true },
    select: {
      id: true, tipo: true, numeracionComprobante: true, total: true, metodoPago: true, creadoAt: true, receptorNombre: true,
      pagoEfectivo: true, pagoTarjeta: true, pagoYape: true, pagoTransferencia: true, pagoDeposito: true,
      usuario: { select: { name: true } },
    },
    orderBy: { creadoAt: 'asc' },
  })
}

interface FacturaConPagos {
  tipo: string
  total: number
  pagoEfectivo: number | null
  pagoTarjeta: number | null
  pagoYape: number | null
  pagoTransferencia: number | null
  pagoDeposito: number | null
}

const round2 = (n: number) => Math.round(n * 100) / 100

// Suma por las columnas pago* (no por metodoPago) para que un pago MIXTO reparta su monto entre los
// métodos reales. Yape y Plin comparten la columna pagoYape.
export function calcularTotales(facturas: FacturaConPagos[]) {
  const porMetodo: Record<MetodoCierre, number> = { EFECTIVO: 0, TARJETA: 0, YAPE: 0, TRANSFERENCIA: 0, DEPOSITO: 0 }
  let total = 0
  for (const f of facturas) {
    const signo = f.tipo === 'NOTA_CREDITO' ? -1 : 1
    total += signo * f.total
    porMetodo.EFECTIVO += signo * (f.pagoEfectivo || 0)
    porMetodo.TARJETA += signo * (f.pagoTarjeta || 0)
    porMetodo.YAPE += signo * (f.pagoYape || 0)
    porMetodo.TRANSFERENCIA += signo * (f.pagoTransferencia || 0)
    porMetodo.DEPOSITO += signo * (f.pagoDeposito || 0)
  }
  for (const m of METODOS_CIERRE) porMetodo[m] = round2(porMetodo[m])
  return { total: round2(total), porMetodo }
}
