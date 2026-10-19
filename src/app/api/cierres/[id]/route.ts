import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

// Detalle de un cierre: sus comprobantes y los productos vendidos en el turno.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAuth(['ADMIN', 'SUPERVISOR'])
  if (guard) return guard

  const cierre = await prisma.cierreTurno.findUnique({
    where: { id: params.id },
    include: {
      usuario: { select: { name: true } },
      facturas: {
        select: {
          id: true, tipo: true, numeracionComprobante: true, total: true, metodoPago: true, creadoAt: true, receptorNombre: true,
          usuario: { select: { name: true } },
          items: { select: { nombre: true, cantidad: true, total: true, productoId: true } },
        },
        orderBy: { creadoAt: 'asc' },
      },
    },
  })
  if (!cierre) return NextResponse.json({ error: 'Cierre no encontrado' }, { status: 404 })

  // Productos del turno (las notas de crédito restan).
  const productos = new Map<string, { nombre: string; cantidad: number; total: number }>()
  for (const f of cierre.facturas) {
    const signo = f.tipo === 'NOTA_CREDITO' ? -1 : 1
    for (const i of f.items) {
      if (!i.productoId) continue
      const acum = productos.get(i.productoId) ?? { nombre: i.nombre, cantidad: 0, total: 0 }
      acum.cantidad += signo * i.cantidad
      acum.total += signo * i.total
      productos.set(i.productoId, acum)
    }
  }

  const { facturas, ...resto } = cierre
  return NextResponse.json({
    ...resto,
    facturas: facturas.map(({ items: _items, ...f }) => f),
    productos: [...productos.values()].filter((p) => p.cantidad !== 0).sort((a, b) => b.total - a.total),
  })
}
