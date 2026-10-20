import type { Factura, FacturaItem, Membresia, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { obtenerConfiguracion } from '@/lib/config'
import { CODIGO_SUNAT_DOCUMENTO, normalizarDocumento } from '@/lib/documentos'
import { obtenerCorrelativo, resolverPrefijo } from '@/lib/correlativos'
import { enviarFacturaASunat } from '@/lib/enviarFactura'
import { calcularFechaFin, fechaDesdeTexto, hoyFecha, inicioPorDefecto, seSuperpone } from '@/lib/membresias'
import { CODIGO_SUNAT_TIPO_COMPROBANTE, ETIQUETA_COMPROBANTE, TIPO_DOCUMENTO_CORRELATIVO, VA_A_SUNAT } from '@/lib/comprobantes'
import { numeroALetras } from '@/lib/numeroALetras'
import { construirReceptor } from '@/lib/receptor'
import { avisarBienvenida, avisarComprobante } from '@/lib/avisosWhatsApp'
import { resolverPagosFactura, type PagoParcial } from '@/lib/pagos'

const IGV_PORCENTAJE = Number(process.env.IGV_PORCENTAJE || '18')

const round2 = (n: number) => Math.round(n * 100) / 100

export interface VentaMembresiaInput {
  socioId: string
  planId: string
  /** 'YYYY-MM-DD'. Por defecto hoy, o el día siguiente al fin de la membresía vigente. */
  fechaInicio?: string
  tipoComprobante: 'BOLETA' | 'FACTURA' | 'NOTA_DESPACHO'
  receptor?: { ruc?: string; razonSocial?: string }
  metodoPago?: string
  pagos?: PagoParcial[]
  usuarioId: string
}

export type ResultadoVenta =
  | { ok: true; membresia: Membresia; factura: Factura & { items: FacturaItem[] } }
  | { ok: false; status: number; error: string }

const fallo = (status: number, error: string): ResultadoVenta => ({ ok: false, status, error })

async function serieActiva(tipoComprobante: string) {
  return prisma.serie.findFirst({ where: { tipoComprobante, estado: 1 }, orderBy: { serie: 'asc' } })
}

/**
 * Vende una membresía con pago único y emite el comprobante (Boleta o Factura) en una sola
 * transacción. El envío a SUNAT se hace después y, si falla, la venta queda registrada con el
 * error visible para reintentar: nunca se pierde una venta por un fallo del facturador.
 */
export async function venderMembresia(input: VentaMembresiaInput): Promise<ResultadoVenta> {
  const [config, socio, plan] = await Promise.all([
    obtenerConfiguracion(),
    prisma.socio.findUnique({ where: { id: input.socioId }, include: { membresias: true } }),
    prisma.plan.findUnique({ where: { id: input.planId } }),
  ])
  if (!socio || !socio.activo) return fallo(404, 'Socio no encontrado')
  if (!plan || !plan.activo) return fallo(404, 'Plan no encontrado o inactivo')

  const ruc = config.ruc || process.env.FACTURADOR_RUC_EMISOR
  if (!ruc) return fallo(400, 'Falta el RUC del emisor en Ajustes')

  // Fechas
  const hoy = hoyFecha()
  let inicio: Date
  if (input.fechaInicio) {
    inicio = fechaDesdeTexto(input.fechaInicio)
    if (Number.isNaN(inicio.getTime())) return fallo(400, 'Fecha de inicio inválida')
    if (inicio < hoy) return fallo(400, 'La fecha de inicio no puede ser anterior a hoy')
  } else {
    inicio = inicioPorDefecto(socio.membresias, hoy)
  }
  const fin = calcularFechaFin(inicio, plan.duracion, plan.unidad)
  if (seSuperpone(socio.membresias, inicio, fin)) {
    return fallo(409, 'Las fechas se superponen con otra membresía del socio. Elige otra fecha de inicio.')
  }

  // Ítems. La matrícula se cobra solo la primera vez (si el socio nunca tuvo una membresía).
  const primeraVez = socio.membresias.filter((m) => !m.anulada).length === 0
  const items: { nombre: string; precioUnit: number; total: number }[] = [
    { nombre: `Membresía ${plan.nombre}`, precioUnit: plan.precio, total: round2(plan.precio) },
  ]
  if (plan.matricula > 0 && primeraVez) {
    items.push({ nombre: 'Matrícula', precioUnit: plan.matricula, total: round2(plan.matricula) })
  }
  const total = round2(items.reduce((s, i) => s + i.total, 0))
  if (total <= 0) return fallo(400, 'El total debe ser mayor a 0')

  const pagos = resolverPagosFactura(total, input.metodoPago, input.pagos)
  if ('error' in pagos) return fallo(400, pagos.error)

  // Receptor
  const construido = construirReceptor(input.tipoComprobante, socio, input.receptor, total)
  if (!construido.ok) return fallo(400, construido.error)
  const receptor = construido.receptor

  // Tipo de documento para serie y correlativo ('50' = nota de despacho, interna).
  const codigoSunat = TIPO_DOCUMENTO_CORRELATIVO[input.tipoComprobante]
  const serie = await serieActiva(codigoSunat)
  if (!serie) return fallo(400, `No hay una serie activa para ${ETIQUETA_COMPROBANTE[input.tipoComprobante].toLowerCase()} (${codigoSunat}). Créala en Ajustes.`)

  const gravadas = round2(items.reduce((s, i) => s + i.total / (1 + IGV_PORCENTAJE / 100), 0))

  const creado = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const numeracion = await obtenerCorrelativo(tx, {
      ruc,
      tipoDocumento: codigoSunat,
      serie: serie.serie,
      prefijo: resolverPrefijo(codigoSunat),
    })
    const factura = await tx.factura.create({
      data: {
        socioId: socio.id,
        tipo: input.tipoComprobante,
        total,
        gravadas,
        igv: round2(total - gravadas),
        ...pagos,
        receptorTipoDocumento: receptor.tipo,
        receptorNumeroDocumento: receptor.numero,
        receptorNombre: receptor.nombre,
        // La nota de despacho no es un comprobante SUNAT: no lleva código de tipo.
        tipoComprobante: CODIGO_SUNAT_TIPO_COMPROBANTE[input.tipoComprobante],
        numeracionComprobante: numeracion,
        fechaEmision: new Date(),
        montoLetras: numeroALetras(total),
        usuarioId: input.usuarioId,
        items: { create: items.map((i) => ({ nombre: i.nombre, cantidad: 1, precioUnit: i.precioUnit, total: i.total })) },
      },
      include: { items: true },
    })
    const membresia = await tx.membresia.create({
      data: { socioId: socio.id, planId: plan.id, fechaInicio: inicio, fechaFin: fin, precio: plan.precio, usuarioId: input.usuarioId, facturaId: factura.id },
    })
    return { membresia, factura }
  })

  // Fuera de la transacción: un fallo del facturador no debe deshacer la venta.
  // Se envía siempre al emitir (la nota de despacho es interna y no va). Si falla, el reintento nocturno lo reenvía.
  let factura = creado.factura
  if (VA_A_SUNAT[input.tipoComprobante]) {
    factura = (await enviarFacturaASunat(creado.factura.id).catch(() => null)) ?? factura
  }
  // Avisos por WhatsApp: no lanzan; si el servicio no responde quedan pendientes para la tarea diaria.
  await Promise.all([avisarBienvenida(creado.membresia.id), avisarComprobante(creado.membresia.id)])
  return { ok: true, membresia: creado.membresia, factura }
}

/**
 * Anula una membresía. Si tenía un comprobante, emite una nota de crédito por el total
 * (motivo catálogo 09 "01: anulación de la operación") y la intenta enviar a SUNAT.
 */
export async function anularMembresia(membresiaId: string, motivo: string, usuarioId: string): Promise<{ ok: true; notaCredito: Factura | null } | { ok: false; status: number; error: string }> {
  const [config, membresia] = await Promise.all([
    obtenerConfiguracion(),
    prisma.membresia.findUnique({ where: { id: membresiaId }, include: { factura: { include: { items: true } } } }),
  ])
  if (!membresia) return { ok: false, status: 404, error: 'Membresía no encontrada' }
  if (membresia.anulada) return { ok: false, status: 409, error: 'La membresía ya está anulada' }

  const original = membresia.factura
  let notaCredito: (Factura & { items: FacturaItem[] }) | null = null

  // Solo lo que está en SUNAT (boleta y factura) se anula con nota de crédito; la nota de despacho se anula directamente.
  if (original && (original.tipo === 'BOLETA' || original.tipo === 'FACTURA') && original.numeracionComprobante) {
    const ruc = config.ruc || process.env.FACTURADOR_RUC_EMISOR
    if (!ruc) return { ok: false, status: 400, error: 'Falta el RUC del emisor en Ajustes' }
    const serie = await serieActiva('07')
    if (!serie) return { ok: false, status: 400, error: 'No hay una serie activa para notas de crédito. Créala en Ajustes.' }

    const tipoAfectado = original.tipoComprobante! // '01' o '03'
    notaCredito = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const numeracion = await obtenerCorrelativo(tx, {
        ruc,
        tipoDocumento: '07',
        serie: serie.serie,
        prefijo: resolverPrefijo('07', tipoAfectado),
      })
      return tx.factura.create({
        data: {
          socioId: original.socioId,
          tipo: 'NOTA_CREDITO',
          total: original.total,
          gravadas: original.gravadas,
          igv: original.igv,
          metodoPago: original.metodoPago,
          // Los mismos medios de pago que la venta original: el cierre de turno devuelve por el mismo método.
          pagoEfectivo: original.pagoEfectivo,
          pagoTarjeta: original.pagoTarjeta,
          pagoYape: original.pagoYape,
          pagoTransferencia: original.pagoTransferencia,
          pagoDeposito: original.pagoDeposito,
          receptorTipoDocumento: original.receptorTipoDocumento,
          receptorNumeroDocumento: original.receptorNumeroDocumento,
          receptorNombre: original.receptorNombre,
          tipoComprobante: '07',
          numeracionComprobante: numeracion,
          fechaEmision: new Date(),
          montoLetras: original.montoLetras,
          tipoNota: '01',
          tipoDocumentoAfectado: tipoAfectado,
          numeracionDocumentoAfectado: original.numeracionComprobante,
          motivoDocumentoAfectado: motivo,
          facturaAfectadaId: original.id,
          usuarioId,
          items: { create: original.items.map((i) => ({ nombre: i.nombre, cantidad: i.cantidad, precioUnit: i.precioUnit, total: i.total })) },
        },
        include: { items: true },
      })
    })
  }

  await prisma.membresia.update({
    where: { id: membresia.id },
    data: { anulada: true, anuladaMotivo: motivo, anuladaPorId: usuarioId, anuladaAt: new Date() },
  })

  if (notaCredito) {
    notaCredito = (await enviarFacturaASunat(notaCredito.id).catch(() => null)) ?? notaCredito
  }
  return { ok: true, notaCredito }
}
