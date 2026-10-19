import { CODIGO_SUNAT_DOCUMENTO, normalizarDocumento, type TipoDocumento } from '@/lib/documentos'

export interface SocioReceptor {
  tipoDocumento: TipoDocumento
  numeroDocumento: string
  nombre: string
  rucFactura: string | null
  razonSocial: string | null
}

export interface Receptor {
  /** Catálogo 06 SUNAT: 0=sin documento, 1=DNI, 4=CE, 6=RUC. */
  tipo: string
  numero: string
  nombre: string
}

/** SUNAT exige identificar al comprador en boletas desde este monto. */
export const MONTO_BOLETA_CON_DOCUMENTO = 700

/**
 * Quién figura como receptor del comprobante.
 * - Factura: exige RUC y razón social (del socio o escritos en la venta).
 * - Boleta y nota de despacho: el documento del socio, o "cliente varios" si no hay socio.
 */
export function construirReceptor(
  tipoComprobante: 'BOLETA' | 'FACTURA' | 'NOTA_DESPACHO',
  socio: SocioReceptor | null,
  entrada: { ruc?: string; razonSocial?: string } | undefined,
  total: number,
): { ok: true; receptor: Receptor } | { ok: false; error: string } {
  if (tipoComprobante === 'FACTURA') {
    const ruc = normalizarDocumento('RUC', entrada?.ruc || socio?.rucFactura)
    const razon = (entrada?.razonSocial || socio?.razonSocial || '').trim()
    if (!ruc) return { ok: false, error: 'Una factura exige un RUC válido de 11 dígitos' }
    if (!razon) return { ok: false, error: 'Una factura exige la razón social' }
    return { ok: true, receptor: { tipo: '6', numero: ruc, nombre: razon } }
  }

  if (socio) {
    return { ok: true, receptor: { tipo: CODIGO_SUNAT_DOCUMENTO[socio.tipoDocumento], numero: socio.numeroDocumento, nombre: socio.nombre } }
  }
  if (tipoComprobante === 'BOLETA' && total >= MONTO_BOLETA_CON_DOCUMENTO) {
    return { ok: false, error: `Las boletas desde S/ ${MONTO_BOLETA_CON_DOCUMENTO} requieren identificar al cliente` }
  }
  return { ok: true, receptor: { tipo: '0', numero: '00000000', nombre: 'CLIENTE VARIOS' } }
}
