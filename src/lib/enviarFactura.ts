import { prisma } from '@/lib/prisma'
import { enviarComprobante, obtenerCdr } from '@/lib/facturador'

export async function enviarFacturaASunat(facturaId: string) {
  const factura = await prisma.factura.findUnique({
    where: { id: facturaId },
    include: { items: true },
  })
  if (!factura || factura.enviado || factura.tipo === 'NOTA_DESPACHO') return null

  try {
    const resultado = await enviarComprobante(factura)
    // El CDR puede no venir en el POST (SUNAT aún no responde): se reintenta luego en sincronizarCdrPendientes.
    // Las boletas no tienen CDR propio (es el del resumen, que el facturador envía solo).
    const cdr = resultado.cdr ?? (resultado.exito && factura.tipoComprobante !== '03' ? await obtenerCdr(factura.tipoComprobante!, factura.numeracionComprobante!).catch(() => null) : null)
    return prisma.factura.update({
      where: { id: factura.id },
      data: {
        enviado: resultado.exito,
        estadoFacturador: resultado.estado || null,
        codigoHash: resultado.hash || null,
        cadenaParaCodigoQr: resultado.qr || null,
        errors: resultado.errors || null,
        // Guardar sin reformatear: si se altera un espacio, la firma deja de validar.
        xmlEnvio: resultado.xml,
        cdr,
      },
      include: { items: true },
    })
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error desconocido al enviar a SUNAT'
    return prisma.factura.update({
      where: { id: factura.id },
      data: { errors: mensaje },
      include: { items: true },
    })
  }
}

const DIAS_REINTENTO = 30
const MAX_REINTENTOS_POR_CORRIDA = 100

/**
 * Reenvía solos los comprobantes que no llegaron al facturador (timeout, caída, error al firmar). Reenviar es repetir
 * el mismo número, como pide el facturador. Los rechazados por SUNAT NO se reintentan: se rechazarían igual hasta que
 * se corrija el dato, y eso no se arregla reenviando.
 */
export async function reintentarPendientes() {
  const desde = new Date(Date.now() - DIAS_REINTENTO * 24 * 60 * 60 * 1000)
  const pendientes = await prisma.factura.findMany({
    where: {
      enviado: false,
      activo: true,
      tipo: { in: ['BOLETA', 'FACTURA', 'NOTA_CREDITO'] },
      numeracionComprobante: { not: null },
      creadoAt: { gte: desde },
      OR: [{ estadoFacturador: null }, { estadoFacturador: 'error' }],
    },
    select: { id: true },
    orderBy: { creadoAt: 'asc' },
    take: MAX_REINTENTOS_POR_CORRIDA,
  })
  let enviados = 0
  // De a uno y en orden: una nota de crédito debe ir después del comprobante que anula.
  for (const { id } of pendientes) {
    const f = await enviarFacturaASunat(id).catch(() => null)
    if (f?.enviado) enviados++
  }
  return { pendientes: pendientes.length, enviados }
}

const DIAS_CDR_DISPONIBLE = 7

/** Descarga el CDR de facturas/notas enviadas que aún no lo tienen, dentro del plazo de 7 días del facturador. */
export async function sincronizarCdrPendientes() {
  const desde = new Date(Date.now() - DIAS_CDR_DISPONIBLE * 24 * 60 * 60 * 1000)
  const pendientes = await prisma.factura.findMany({
    where: { enviado: true, cdr: null, tipoComprobante: { in: ['01', '07'] }, numeracionComprobante: { not: null }, creadoAt: { gte: desde } },
    select: { id: true, tipoComprobante: true, numeracionComprobante: true },
  })
  let guardados = 0
  for (const f of pendientes) {
    const cdr = await obtenerCdr(f.tipoComprobante!, f.numeracionComprobante!).catch(() => null)
    if (!cdr) continue
    await prisma.factura.update({ where: { id: f.id }, data: { cdr } })
    guardados++
  }
  return { pendientes: pendientes.length, guardados }
}
