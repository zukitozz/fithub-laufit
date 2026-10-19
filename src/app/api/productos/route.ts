import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { requireApiAuth } from '@/lib/api-auth'
import { leerProducto } from '@/lib/productos'

export const dynamic = 'force-dynamic'

// ?activos=1 para el market. Sin paginar: el catálogo de un gimnasio cabe de sobra.
export async function GET(req: Request) {
  const guard = await requireApiAuth(['ADMIN', 'SUPERVISOR'])
  if (guard) return guard
  const { searchParams } = new URL(req.url)
  const where: Prisma.ProductoWhereInput = {}
  if (searchParams.get('activos') === '1') where.activo = true
  const q = searchParams.get('q')?.trim()
  if (q) where.OR = [{ nombre: { contains: q, mode: 'insensitive' } }, { codigoBarras: q }, { categoria: { contains: q, mode: 'insensitive' } }]
  return NextResponse.json(await prisma.producto.findMany({ where, orderBy: [{ activo: 'desc' }, { nombre: 'asc' }], take: 1000 }))
}

export async function POST(req: Request) {
  const guard = await requireApiAuth(['SUPERVISOR'])
  if (guard) return guard
  const session = await auth()

  const body = await req.json().catch(() => null)
  const leido = leerProducto(body ?? {})
  if ('error' in leido) return NextResponse.json({ error: leido.error }, { status: 400 })

  if (leido.data.codigoBarras && (await prisma.producto.findUnique({ where: { codigoBarras: leido.data.codigoBarras } }))) {
    return NextResponse.json({ error: 'Ya existe un producto con ese código de barras' }, { status: 409 })
  }

  // Stock inicial opcional: queda registrado como una entrada.
  const stockInicial = Number(body?.stockInicial ?? 0)
  if (!Number.isInteger(stockInicial) || stockInicial < 0) return NextResponse.json({ error: 'El stock inicial no es válido' }, { status: 400 })

  const producto = await prisma.$transaction(async (tx) => {
    const creado = await tx.producto.create({ data: { ...leido.data, stock: stockInicial } })
    if (stockInicial > 0) {
      await tx.movimientoInventario.create({
        data: { productoId: creado.id, tipo: 'ENTRADA', cantidad: stockInicial, stockAnterior: 0, stockNuevo: stockInicial, motivo: 'Stock inicial', usuarioId: session!.user.id },
      })
    }
    return creado
  })
  return NextResponse.json(producto, { status: 201 })
}
