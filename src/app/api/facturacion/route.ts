import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

// Últimos comprobantes. Filtros: ?tipo=BOLETA|FACTURA|NOTA_CREDITO  ?estado=pendientes|enviados  ?q=nombre o número
export async function GET(req: Request) {
  const guard = await requireApiAuth(['ADMIN', 'SUPERVISOR'])
  if (guard) return guard

  const { searchParams } = new URL(req.url)
  const where: Prisma.FacturaWhereInput = {}
  const tipo = searchParams.get('tipo')
  if (tipo === 'BOLETA' || tipo === 'FACTURA' || tipo === 'NOTA_CREDITO' || tipo === 'NOTA_DESPACHO') where.tipo = tipo
  const estado = searchParams.get('estado')
  // La nota de despacho es interna: nunca queda "pendiente" en SUNAT.
  if (estado === 'pendientes') {
    where.enviado = false
    if (tipo !== 'BOLETA' && tipo !== 'FACTURA' && tipo !== 'NOTA_CREDITO') where.tipo = { not: 'NOTA_DESPACHO' }
  }
  if (estado === 'enviados') where.enviado = true
  const q = searchParams.get('q')?.trim()
  if (q) {
    where.OR = [
      { numeracionComprobante: { contains: q, mode: 'insensitive' } },
      { receptorNombre: { contains: q, mode: 'insensitive' } },
      { receptorNumeroDocumento: { startsWith: q } },
    ]
  }

  const facturas = await prisma.factura.findMany({
    where,
    orderBy: { creadoAt: 'desc' },
    take: 100,
    // xmlEnvio y cdr pesan mucho: no viajan en el listado.
    select: {
      id: true, tipo: true, total: true, metodoPago: true, creadoAt: true, numeracionComprobante: true,
      receptorNombre: true, receptorNumeroDocumento: true, enviado: true, estadoFacturador: true, errors: true,
      numeracionDocumentoAfectado: true, cdr: false,
      socio: { select: { id: true, nombre: true } },
    },
  })
  return NextResponse.json(facturas)
}
