import type { Factura, FacturaItem } from '@prisma/client'

const IGV_PORCENTAJE = Number(process.env.IGV_PORCENTAJE || '18')
// El POST es síncrono (firma + envío a SUNAT): el servicio pide al menos 60 s de timeout.
const TIMEOUT_MS = 60_000

function round2(value: number) {
  return Math.round(value * 100) / 100
}

/** Fecha-hora de Lima sin sufijo de zona ('YYYY-MM-DDTHH:mm:ss'), como exige el facturador. */
function fechaHoraLima(fecha: Date) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(fecha)
      .map((p) => [p.type, p.value]),
  )
  return `${partes.year}-${partes.month}-${partes.day}T${partes.hour}:${partes.minute}:${partes.second}`
}

function construirItem(item: FacturaItem) {
  const valorVenta = round2(item.total / (1 + IGV_PORCENTAJE / 100))
  const igv = round2(item.total - valorVenta)

  return {
    descripcion: item.nombre,
    cantidad: item.cantidad,
    medida: item.productoId ? 'NIU' : 'ZZ', // producto = unidad; membresía = servicio
    codigo_producto: item.codigoProducto || undefined,
    valor: Number((valorVenta / item.cantidad).toFixed(6)),
    valor_venta: valorVenta,
    igv_venta: igv,
    precio: item.precioUnit,
  }
}

/**
 * Catálogo 06 SUNAT (tipo de documento de identidad): 1=DNI, 4=Carnet de Extranjería, 6=RUC.
 * Una Factura exige RUC; una Boleta acepta DNI, Carnet de Extranjería o RUC. El receptor se
 * guarda en la Factura al emitirla, así que se usa tal cual (no el dato actual del socio).
 */
function datosReceptor(factura: Factura, tipoComprobante: string) {
  if (tipoComprobante === '01' && factura.receptorTipoDocumento !== '6') {
    throw new Error('Una Factura exige RUC del receptor')
  }
  return {
    tipo_documento: factura.receptorTipoDocumento,
    numero_documento: factura.receptorNumeroDocumento,
    razon_social: factura.receptorNombre,
  }
}

export interface FacturaParaEnvio extends Factura {
  items: FacturaItem[]
}

export interface ResultadoFacturador {
  /** SUNAT (o el facturador, en boletas) ya tiene el comprobante: no hace falta reenviarlo. */
  exito: boolean
  estado: string
  errors: string
  hash: string
  qr: string
  xml: string | null
  cdr: string | null
}

// aceptado*/enviado: SUNAT lo tiene. generado: boleta firmada, va en el resumen diario.
// pendiente/validando: en proceso en SUNAT; reenviar solo duplicaría el trámite.
const ESTADOS_EXITO = new Set(['aceptado', 'aceptado_con_observaciones', 'enviado', 'generado', 'pendiente', 'validando'])

function configuracionApi() {
  const baseUrl = (process.env.FACTURADOR_URL || '').replace(/\/$/, '')
  const ruc = process.env.FACTURADOR_RUC_EMISOR
  if (!baseUrl || !ruc) {
    throw new Error('Faltan variables de entorno FACTURADOR_URL/FACTURADOR_RUC_EMISOR')
  }
  return { baseUrl, ruc }
}

function interpretar(data: Record<string, unknown>): ResultadoFacturador {
  const estado = String(data.estado || '')
  const exito = ESTADOS_EXITO.has(estado)
  let errors = ''
  if (!exito) {
    const detalle = [data.codigo_error, data.descripcion_error].filter(Boolean).join(' - ')
    errors = detalle || String(data.des_obse || '') || `Estado ${estado || 'desconocido'}`
  }
  return {
    exito,
    estado,
    errors,
    hash: typeof data.hash === 'string' ? data.hash : '',
    qr: typeof data.qr === 'string' ? data.qr : '',
    xml: typeof data.xml === 'string' ? data.xml : null,
    cdr: typeof data.cdr === 'string' ? data.cdr : null,
  }
}

function mensajeHttp(status: number, data: unknown) {
  const detail = (data as { detail?: unknown } | null)?.detail
  if (Array.isArray(detail)) {
    return detail.map((d: { loc?: unknown[]; msg?: string }) => `${(d.loc || []).join('.')}: ${d.msg}`).join('; ')
  }
  return typeof detail === 'string' ? detail : `HTTP ${status}`
}

export async function enviarComprobante(factura: FacturaParaEnvio): Promise<ResultadoFacturador> {
  const { baseUrl, ruc } = configuracionApi()
  if (!factura.numeracionComprobante || !factura.tipoComprobante) {
    throw new Error('La factura no tiene numeración/tipo de comprobante asignado')
  }

  const tipo = factura.tipoComprobante
  const gravadas = round2(factura.items.reduce((s, i) => s + round2(i.total / (1 + IGV_PORCENTAJE / 100)), 0))
  const igv = round2(factura.total - gravadas)

  const payload: Record<string, unknown> = {
    numeracion_comprobante: factura.numeracionComprobante,
    tipo_comprobante: tipo,
    fecha_emision: fechaHoraLima(factura.fechaEmision || factura.creadoAt),
    total: factura.total,
    gravadas,
    igv,
    tipo_moneda: factura.tipoMoneda || 'PEN',
    receptor: datosReceptor(factura, tipo),
    items: factura.items.map(construirItem),
  }
  if (factura.montoLetras) payload.monto_letras = factura.montoLetras

  if (tipo === '07' || tipo === '08') {
    if (!factura.tipoNota || !factura.tipoDocumentoAfectado || !factura.numeracionDocumentoAfectado) {
      throw new Error('La nota requiere tipo de nota, tipo y numeración del documento afectado')
    }
    payload.referencia = {
      tipo_nota: factura.tipoNota,
      tipo_documento_afectado: factura.tipoDocumentoAfectado,
      numeracion_documento_afectado: factura.numeracionDocumentoAfectado,
      ...(factura.motivoDocumentoAfectado ? { motivo_documento_afectado: factura.motivoDocumentoAfectado } : {}),
    }
  }

  const raiz = `${baseUrl}/empresas/${ruc}/comprobantes`
  const codigo = `${tipo}-${factura.numeracionComprobante}`

  let response: Response
  try {
    response = await fetch(`${raiz}?incluir=xml,cdr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    // Timeout o corte de red: no asumir que falló. Si el comprobante existe, usar su estado;
    // si no existe (404) no llegó y se puede reenviar con el mismo número.
    const consulta = await fetch(`${raiz}/${codigo}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) }).catch(() => null)
    if (consulta?.ok) {
      const data = await consulta.json()
      return interpretar(data)
    }
    throw new Error('No se pudo confirmar el envío al facturador; reintenta con el mismo número de comprobante')
  }

  const data = await response.json().catch(() => null)
  if (response.status !== 201 || !data) {
    throw new Error(mensajeHttp(response.status, data))
  }
  // Un rechazo de SUNAT también responde 201: el éxito se decide por `estado`.
  return interpretar(data)
}

/** Informa a SUNAT las boletas de días anteriores. Seguro llamarlo de más. */
export async function enviarResumenDiario(): Promise<unknown> {
  const { baseUrl, ruc } = configuracionApi()
  const response = await fetch(`${baseUrl}/empresas/${ruc}/resumenes-diarios`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(mensajeHttp(response.status, data))
  return data
}

/**
 * CDR de un comprobante ya enviado, o null si SUNAT aún no lo entrega. Las boletas no tienen
 * CDR propio (es el del resumen diario), así que solo aplica a facturas y notas.
 */
export async function obtenerCdr(tipoComprobante: string, numeracion: string): Promise<string | null> {
  const { baseUrl, ruc } = configuracionApi()
  const response = await fetch(`${baseUrl}/empresas/${ruc}/comprobantes/${tipoComprobante}-${numeracion}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!response.ok) return null
  const data = await response.json().catch(() => null)
  return typeof data?.cdr === 'string' ? data.cdr : null
}
