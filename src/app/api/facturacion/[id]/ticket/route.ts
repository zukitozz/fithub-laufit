import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'
import { obtenerConfiguracion } from '@/lib/config'
import { generarHtmlTicket } from '@/lib/comprobanteTicket'

export const dynamic = 'force-dynamic'

// Ticket de 80 mm (HTML) de cualquier comprobante, para imprimirlo en impresora térmica desde el navegador.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAuth(['ADMIN', 'SUPERVISOR'])
  if (guard) return guard

  const [config, factura] = await Promise.all([
    obtenerConfiguracion(),
    prisma.factura.findUnique({ where: { id: params.id }, include: { items: true } }),
  ])
  if (!factura) return NextResponse.json({ error: 'Comprobante no encontrado' }, { status: 404 })

  const html = await generarHtmlTicket(
    { ...factura, fechaEmision: factura.fechaEmision ?? factura.creadoAt },
    {
      razonSocial: config.razonSocial || config.nombreGimnasio,
      ruc: config.ruc || process.env.FACTURADOR_RUC_EMISOR || '',
      direccionFiscal: config.direccionFiscal || config.direccion || '',
      nombreComercial: config.nombreGimnasio,
      telefono: config.telefonoContacto,
    },
  )

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' },
  })
}
