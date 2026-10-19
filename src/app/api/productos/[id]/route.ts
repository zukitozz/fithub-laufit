import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'
import { leerProducto } from '@/lib/productos'

export const dynamic = 'force-dynamic'

// Cambiar el precio no afecta a los comprobantes ya emitidos (guardan el precio de su momento).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAuth(['SUPERVISOR'])
  if (guard) return guard

  const actual = await prisma.producto.findUnique({ where: { id: params.id } })
  if (!actual) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const leido = leerProducto(body ?? {})
  if ('error' in leido) return NextResponse.json({ error: leido.error }, { status: 400 })

  if (leido.data.codigoBarras && leido.data.codigoBarras !== actual.codigoBarras) {
    const otro = await prisma.producto.findUnique({ where: { codigoBarras: leido.data.codigoBarras } })
    if (otro) return NextResponse.json({ error: 'Ya existe un producto con ese código de barras' }, { status: 409 })
  }
  return NextResponse.json(await prisma.producto.update({ where: { id: params.id }, data: leido.data }))
}
