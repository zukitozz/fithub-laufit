import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { requireApiAuth } from '@/lib/api-auth'
import { calcularTotales, obtenerFacturasPendientes } from '@/lib/cierres'

export const dynamic = 'force-dynamic'

// Historial. La administradora ve los cierres de los últimos 3 días; el gerente ve los últimos 100.
export async function GET() {
  const guard = await requireApiAuth(['ADMIN', 'SUPERVISOR'])
  if (guard) return guard
  const session = await auth()
  const esAdmin = session!.user.role === 'ADMIN'

  const cierres = await prisma.cierreTurno.findMany({
    where: esAdmin ? { fechaFin: { gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) } } : {},
    include: { usuario: { select: { name: true } } },
    orderBy: { fechaFin: 'desc' },
    take: 100,
  })
  return NextResponse.json(cierres)
}

const round2 = (n: number) => Math.round(n * 100) / 100

// Cierra el turno: congela los comprobantes pendientes y guarda los totales por método de pago.
export async function POST(req: Request) {
  const guard = await requireApiAuth(['ADMIN', 'SUPERVISOR'])
  if (guard) return guard
  const session = await auth()

  const body = await req.json().catch(() => ({}))
  let efectivoContado: number | null = null
  if (body?.efectivoContado !== undefined && body.efectivoContado !== null && body.efectivoContado !== '') {
    efectivoContado = Number(body.efectivoContado)
    if (!Number.isFinite(efectivoContado) || efectivoContado < 0) return NextResponse.json({ error: 'El efectivo contado no es válido' }, { status: 400 })
    efectivoContado = round2(efectivoContado)
  }
  const notas = typeof body?.notas === 'string' && body.notas.trim() ? body.notas.trim().slice(0, 500) : null

  try {
    const cierre = await prisma.$transaction(async (tx) => {
      const facturas = await obtenerFacturasPendientes(tx)
      if (facturas.length === 0) throw new Error('SIN_PENDIENTES')

      const { total, porMetodo } = calcularTotales(facturas)
      const creado = await tx.cierreTurno.create({
        data: {
          usuarioId: session!.user.id,
          fechaInicio: facturas[0].creadoAt,
          fechaFin: new Date(),
          totalVentas: total,
          totalEfectivo: porMetodo.EFECTIVO,
          totalTarjeta: porMetodo.TARJETA,
          totalYape: porMetodo.YAPE,
          totalTransferencia: porMetodo.TRANSFERENCIA,
          totalDeposito: porMetodo.DEPOSITO,
          efectivoContado,
          diferencia: efectivoContado === null ? null : round2(efectivoContado - porMetodo.EFECTIVO),
          notas,
          cantidadComprobantes: facturas.length,
        },
      })

      // Solo los que siguen sin cierre: si otro cierre se coló en el medio, este falla en vez de duplicar.
      const marcados = await tx.factura.updateMany({
        where: { id: { in: facturas.map((f) => f.id) }, cierreTurnoId: null },
        data: { cierreTurnoId: creado.id },
      })
      if (marcados.count !== facturas.length) throw new Error('CONCURRENCIA')
      return creado
    })
    return NextResponse.json(cierre, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'SIN_PENDIENTES') return NextResponse.json({ error: 'No hay cobros pendientes de cerrar' }, { status: 400 })
    if (error instanceof Error && error.message === 'CONCURRENCIA') return NextResponse.json({ error: 'Otro cierre se estaba haciendo al mismo tiempo. Revisa y vuelve a intentar.' }, { status: 409 })
    throw error
  }
}
