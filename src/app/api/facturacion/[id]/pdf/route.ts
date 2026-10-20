import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'
import { obtenerConfiguracion } from '@/lib/config'
import { generarPdfDeFactura } from '@/lib/comprobantePdf'

export const dynamic = 'force-dynamic'

// Representación impresa (PDF) de cualquier comprobante: boleta, factura, nota de crédito o nota de despacho.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAuth(['ADMIN', 'SUPERVISOR'])
  if (guard) return guard

  const [config, factura] = await Promise.all([
    obtenerConfiguracion(),
    prisma.factura.findUnique({ where: { id: params.id }, include: { items: true } }),
  ])
  if (!factura) return NextResponse.json({ error: 'Comprobante no encontrado' }, { status: 404 })

  const bytes = await generarPdfDeFactura(factura, config)

  const nombre = `${factura.numeracionComprobante ?? factura.id}.pdf`
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${nombre}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
