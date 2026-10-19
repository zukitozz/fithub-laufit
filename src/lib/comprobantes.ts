/** Código SUNAT del tipo de comprobante (catálogo 01). La nota de despacho es interna: no tiene código SUNAT. */
export const CODIGO_SUNAT_TIPO_COMPROBANTE = {
  BOLETA: '03',
  FACTURA: '01',
  NOTA_CREDITO: '07',
  NOTA_DESPACHO: null,
} as const

export type TipoComprobanteApp = keyof typeof CODIGO_SUNAT_TIPO_COMPROBANTE

/** Tipo de documento para serie y correlativo (la nota de despacho usa el '50' interno: prefijo ND). */
export const TIPO_DOCUMENTO_CORRELATIVO: Record<TipoComprobanteApp, string> = {
  BOLETA: '03',
  FACTURA: '01',
  NOTA_CREDITO: '07',
  NOTA_DESPACHO: '50',
}

export const ETIQUETA_COMPROBANTE: Record<TipoComprobanteApp, string> = {
  BOLETA: 'Boleta',
  FACTURA: 'Factura',
  NOTA_CREDITO: 'Nota de crédito',
  NOTA_DESPACHO: 'Nota de despacho',
}

/** Los comprobantes que se informan a SUNAT. */
export const VA_A_SUNAT: Record<TipoComprobanteApp, boolean> = {
  BOLETA: true,
  FACTURA: true,
  NOTA_CREDITO: true,
  NOTA_DESPACHO: false,
}
