import type { Factura, FacturaItem, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { obtenerConfiguracion } from '@/lib/config'
import { CODIGO_SUNAT_TIPO_COMPROBANTE, ETIQUETA_COMPROBANTE, TIPO_DOCUMENTO_CORRELATIVO, VA_A_SUNAT } from '@/lib/comprobantes'
import { obtenerCorrelativo, resolverPrefijo } from '@/lib/correlativos'
import { enviarFacturaASunat } from '@/lib/enviarFactura'
import { numeroALetras } from '@/lib/numeroALetras'
import { resolverPagosFactura, type PagoParcial } from '@/lib/pagos'
import { construirReceptor } from '@/lib/receptor'

const IGV_PORCENTAJE = Number(process.env.IGV_PORCENTAJE || '18')
const round2 = (n: number) => Math.round(n * 100) / 100

export interface VentaProductosInput {
  items: { productoId: string; cantidad: number }[]
  socioId?: string | null
  tipoComprobante: 'BOLETA' | 'FACTURA' | 'NOTA_DESPACHO'
  receptor?: { ruc?: string; razonSocial?: string }
  metodoPago?: string
  pagos?: PagoParcial[]
  usuarioId: string
}

export type ResultadoVentaProductos =
  | { ok: true; factura: Factura & { items: FacturaItem[] } }
  | { ok: false; status: number; error: string }

const fallo = (status: number, error: string): ResultadoVentaProductos => ({ ok: false, status, error })

class StockInsuficiente extends Error {
  constructor(readonly producto: string, readonly disponible: number) {
    super('STOCK_INSUFICIENTE')
  }
}

/**
 * Vende productos del market: valida el stock, lo descuenta y emite el comprobante en una sola
 * transacción. El descuento es condicional (`stock >= cantidad`), así dos ventas simultáneas del
 * último producto no dejan el stock en negativo. El envío a SUNAT va después y no deshace la venta.
 */
export async function venderProductos(input: VentaProductosInput): Promise<ResultadoVentaProductos> {
  // Unifica líneas repetidas del mismo producto.
  const cantidades = new Map<string, number>()
  for (const linea of input.items) {
    const cantidad = Number(linea.cantidad)
    if (!linea.productoId || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > 999) return fallo(400, 'Cantidad inválida en el carrito')
    cantidades.set(linea.productoId, (cantidades.get(linea.productoId) ?? 0) + cantidad)
  }
  if (cantidades.size === 0) return fallo(400, 'El carrito está vacío')

  const [config, productos, socio] = await Promise.all([
    obtenerConfiguracion(),
    prisma.producto.findMany({ where: { id: { in: [...cantidades.keys()] } } }),
    input.socioId ? prisma.socio.findUnique({ where: { id: input.socioId } }) : null,
  ])
  if (input.socioId && (!socio || !socio.activo)) return fallo(404, 'Cliente no encontrado')
  if (productos.length !== cantidades.size) return fallo(404, 'Algún producto del carrito ya no existe')
  const inactivo = productos.find((p) => !p.activo)
  if (inactivo) return fallo(409, `"${inactivo.nombre}" está inactivo y no se puede vender`)

  const ruc = config.ruc || process.env.FACTURADOR_RUC_EMISOR
  if (!ruc) return fallo(400, 'Falta el RUC del emisor en Ajustes')

  const lineas = productos.map((p) => {
    const cantidad = cantidades.get(p.id)!
    return { producto: p, cantidad, total: round2(p.precioVenta * cantidad) }
  })
  const total = round2(lineas.reduce((s, l) => s + l.total, 0))
  if (total <= 0) return fallo(400, 'El total debe ser mayor a 0')

  const pagos = resolverPagosFactura(total, input.metodoPago, input.pagos)
  if ('error' in pagos) return fallo(400, pagos.error)

  const receptor = construirReceptor(input.tipoComprobante, socio, input.receptor, total)
  if (!receptor.ok) return fallo(400, receptor.error)

  const tipoDocumento = TIPO_DOCUMENTO_CORRELATIVO[input.tipoComprobante]
  const serie = await prisma.serie.findFirst({ where: { tipoComprobante: tipoDocumento, estado: 1 }, orderBy: { serie: 'asc' } })
  if (!serie) return fallo(400, `No hay una serie activa para ${ETIQUETA_COMPROBANTE[input.tipoComprobante].toLowerCase()} (${tipoDocumento}). Créala en Ajustes.`)

  const gravadas = round2(lineas.reduce((s, l) => s + l.total / (1 + IGV_PORCENTAJE / 100), 0))

  let factura: Factura & { items: FacturaItem[] }
  try {
    factura = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const numeracion = await obtenerCorrelativo(tx, { ruc, tipoDocumento, serie: serie.serie, prefijo: resolverPrefijo(tipoDocumento) })
      const creada = await tx.factura.create({
        data: {
          socioId: socio?.id ?? null,
          tipo: input.tipoComprobante,
          total,
          gravadas,
          igv: round2(total - gravadas),
          ...pagos,
          receptorTipoDocumento: receptor.receptor.tipo,
          receptorNumeroDocumento: receptor.receptor.numero,
          receptorNombre: receptor.receptor.nombre,
          tipoComprobante: CODIGO_SUNAT_TIPO_COMPROBANTE[input.tipoComprobante],
          numeracionComprobante: numeracion,
          fechaEmision: new Date(),
          montoLetras: numeroALetras(total),
          usuarioId: input.usuarioId,
          items: {
            create: lineas.map((l) => ({
              nombre: l.producto.nombre,
              cantidad: l.cantidad,
              precioUnit: l.producto.precioVenta,
              total: l.total,
              codigoProducto: l.producto.codigoBarras,
              productoId: l.producto.id,
            })),
          },
        },
        include: { items: true },
      })

      for (const l of lineas) {
        if (!l.producto.controlaStock) continue
        const descuento = await tx.producto.updateMany({ where: { id: l.producto.id, stock: { gte: l.cantidad } }, data: { stock: { decrement: l.cantidad } } })
        if (descuento.count === 0) {
          const actual = await tx.producto.findUnique({ where: { id: l.producto.id }, select: { stock: true } })
          throw new StockInsuficiente(l.producto.nombre, actual?.stock ?? 0)
        }
        const { stock } = await tx.producto.findUniqueOrThrow({ where: { id: l.producto.id }, select: { stock: true } })
        await tx.movimientoInventario.create({
          data: {
            productoId: l.producto.id,
            tipo: 'SALIDA',
            cantidad: l.cantidad,
            stockAnterior: stock + l.cantidad,
            stockNuevo: stock,
            motivo: `Venta ${numeracion}`,
            facturaId: creada.id,
            usuarioId: input.usuarioId,
          },
        })
      }
      return creada
    })
  } catch (error) {
    if (error instanceof StockInsuficiente) {
      return fallo(409, `Stock insuficiente de "${error.producto}": quedan ${error.disponible}`)
    }
    throw error
  }

  // Se envía siempre al emitir (la nota de despacho es interna y no va). Si falla, el reintento nocturno lo reenvía.
  if (VA_A_SUNAT[input.tipoComprobante]) {
    const enviada = await enviarFacturaASunat(factura.id).catch(() => null)
    if (enviada) return { ok: true, factura: enviada }
  }
  return { ok: true, factura }
}
