import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'
import { calcularTotales, obtenerFacturasPendientes } from '@/lib/cierres'

export const dynamic = 'force-dynamic'

// Vista previa del cierre: lo cobrado desde el cierre anterior.
export async function GET() {
  const guard = await requireApiAuth(['ADMIN', 'SUPERVISOR'])
  if (guard) return guard

  const facturas = await obtenerFacturasPendientes(prisma)
  const { total, porMetodo } = calcularTotales(facturas)
  return NextResponse.json({
    facturas: facturas.map(({ pagoEfectivo, pagoTarjeta, pagoYape, pagoTransferencia, pagoDeposito, ...f }) => f),
    cantidad: facturas.length,
    total,
    porMetodo,
    fechaDesde: facturas[0]?.creadoAt ?? null,
  })
}
