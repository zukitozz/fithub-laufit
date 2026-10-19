import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { requireApiAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

// ENTRADA suma unidades (compra, reposición). AJUSTE fija el stock real tras un conteo.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAuth(['SUPERVISOR'])
  if (guard) return guard
  const session = await auth()

  const body = await req.json().catch(() => null)
  const tipo = body?.tipo
  const cantidad = Number(body?.cantidad)
  if (tipo !== 'ENTRADA' && tipo !== 'AJUSTE') return NextResponse.json({ error: 'tipo debe ser ENTRADA o AJUSTE' }, { status: 400 })
  if (!Number.isInteger(cantidad) || cantidad < (tipo === 'ENTRADA' ? 1 : 0)) {
    return NextResponse.json({ error: tipo === 'ENTRADA' ? 'La cantidad debe ser un entero mayor a 0' : 'El stock debe ser un entero desde 0' }, { status: 400 })
  }
  const motivo = typeof body?.motivo === 'string' && body.motivo.trim() ? body.motivo.trim() : tipo === 'ENTRADA' ? 'Ingreso de mercadería' : 'Ajuste por conteo'

  const resultado = await prisma.$transaction(async (tx) => {
    const producto = await tx.producto.findUnique({ where: { id: params.id } })
    if (!producto) return null
    const nuevo = tipo === 'ENTRADA' ? producto.stock + cantidad : cantidad
    await tx.producto.update({ where: { id: producto.id }, data: { stock: nuevo } })
    await tx.movimientoInventario.create({
      data: {
        productoId: producto.id,
        tipo,
        cantidad: Math.abs(nuevo - producto.stock),
        stockAnterior: producto.stock,
        stockNuevo: nuevo,
        motivo,
        usuarioId: session!.user.id,
      },
    })
    return { id: producto.id, stock: nuevo }
  })
  if (!resultado) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
  return NextResponse.json(resultado)
}
