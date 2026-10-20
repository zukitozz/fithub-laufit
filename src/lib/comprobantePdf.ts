import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import QRCode from 'qrcode'
import { LOGO_PNG_BASE64 } from '@/lib/logoPdf'
import { fechaPeru } from '@/lib/fechas'

const IGV_PORCENTAJE = Number(process.env.IGV_PORCENTAJE || '18')

export interface EmisorPdf {
  razonSocial: string
  ruc: string
  direccionFiscal: string
  nombreComercial: string
  telefono: string | null
}

export interface ComprobantePdfDatos {
  tipo: 'BOLETA' | 'FACTURA' | 'NOTA_CREDITO' | 'NOTA_DESPACHO'
  numeracionComprobante: string | null
  fechaEmision: Date
  receptorTipoDocumento: string
  receptorNumeroDocumento: string
  receptorNombre: string
  total: number
  gravadas: number | null
  igv: number | null
  montoLetras: string | null
  metodoPago: string
  pagoEfectivo: number | null
  pagoTarjeta: number | null
  pagoYape: number | null
  pagoTransferencia: number | null
  pagoDeposito: number | null
  numeracionDocumentoAfectado: string | null
  motivoDocumentoAfectado: string | null
  cadenaParaCodigoQr: string | null
  codigoHash: string | null
  items: { nombre: string; cantidad: number; total: number; codigoProducto: string | null; productoId: string | null }[]
}

const TITULOS: Record<ComprobantePdfDatos['tipo'], string> = {
  BOLETA: 'BOLETA DE VENTA ELECTRÓNICA',
  FACTURA: 'FACTURA ELECTRÓNICA',
  NOTA_CREDITO: 'NOTA DE CRÉDITO ELECTRÓNICA',
  NOTA_DESPACHO: 'NOTA DE DESPACHO',
}

const DOCUMENTO: Record<string, string> = { '1': 'DNI', '4': 'CARNET EXT.', '6': 'RUC', '0': 'DOCUMENTO' }
const METODOS: Record<string, string> = { EFECTIVO: 'EFECTIVO', TARJETA: 'TARJETA', YAPE: 'YAPE', PLIN: 'PLIN', TRANSFERENCIA: 'TRANSFERENCIA', DEPOSITO: 'DEPÓSITO' }

const AZUL = rgb(0.1, 0.2, 0.62)
const NEGRO = rgb(0.1, 0.1, 0.1)
const GRIS = rgb(0.45, 0.45, 0.45)
const GRIS_CLARO = rgb(0.78, 0.78, 0.78)
const LINEA = rgb(0.7, 0.7, 0.7)

const money = (n: number) => n.toFixed(2)
const round2 = (n: number) => Math.round(n * 100) / 100

/** Reemplaza lo que la fuente estándar (WinAnsi) no puede dibujar, para que un nombre raro nunca rompa el PDF. */
function limpio(font: PDFFont, texto: string) {
  return Array.from(texto.replace(/\s+/g, ' ').trim())
    .map((c) => {
      try {
        font.encodeText(c)
        return c
      } catch {
        return '?'
      }
    })
    .join('')
}

/** Recorta el texto (sin romper el diseño) hasta que quepa en el ancho. */
function recortar(font: PDFFont, texto: string, size: number, ancho: number) {
  let t = limpio(font, texto)
  while (t.length > 0 && font.widthOfTextAtSize(t, size) > ancho) t = t.slice(0, -1)
  return t
}

function partir(font: PDFFont, texto: string, size: number, ancho: number): string[] {
  const lineas: string[] = []
  let actual = ''
  for (const palabra of limpio(font, texto).split(' ')) {
    const prueba = actual ? `${actual} ${palabra}` : palabra
    if (font.widthOfTextAtSize(prueba, size) <= ancho || !actual) actual = prueba
    else {
      lineas.push(actual)
      actual = palabra
    }
  }
  if (actual) lineas.push(actual)
  return lineas.length ? lineas : ['']
}

function textoPagos(d: ComprobantePdfDatos) {
  if (d.metodoPago !== 'MIXTO') return METODOS[d.metodoPago] ?? d.metodoPago
  const partes: [string, number | null][] = [
    ['EFECTIVO', d.pagoEfectivo], ['TARJETA', d.pagoTarjeta], ['YAPE/PLIN', d.pagoYape], ['TRANSFERENCIA', d.pagoTransferencia], ['DEPÓSITO', d.pagoDeposito],
  ]
  return partes.filter(([, v]) => v).map(([n, v]) => `${n} S/ ${money(v as number)}`).join(' + ')
}

/**
 * Representación impresa (A4) de un comprobante, siguiendo el formato de la boleta de ejemplo del gimnasio:
 * emisor y caja con RUC y número, datos del cliente, detalle, totales, importe en letras y QR de SUNAT.
 */
export async function generarPdfComprobante(d: ComprobantePdfDatos, emisor: EmisorPdf): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(`${TITULOS[d.tipo]} ${d.numeracionComprobante ?? ''}`.trim())
  pdf.setAuthor(emisor.razonSocial)
  const page = pdf.addPage([595.28, 841.89])
  const normal = await pdf.embedFont(StandardFonts.Helvetica)
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold)

  const W = page.getWidth()
  const H = page.getHeight()
  const M = 40
  const derecha = W - M

  const escribir = (p: PDFPage, texto: string, x: number, y: number, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; align?: 'left' | 'right' | 'center'; ancho?: number } = {}) => {
    const font = opts.bold ? negrita : normal
    const size = opts.size ?? 8
    const t = limpio(font, texto)
    const w = font.widthOfTextAtSize(t, size)
    const px = opts.align === 'right' ? x - w : opts.align === 'center' ? x - w / 2 : x
    p.drawText(t, { x: px, y, size, font, color: opts.color ?? NEGRO })
  }

  // ── Cabecera ────────────────────────────────────────────────────────────────
  let y = H - M
  const logo = await pdf.embedPng(Buffer.from(LOGO_PNG_BASE64, 'base64'))
  page.drawImage(logo, { x: M, y: y - 72, width: 72, height: 72 })

  const cajaW = 212
  const cajaX = derecha - cajaW
  const textoX = M + 86
  escribir(page, emisor.razonSocial, textoX, y - 10, { size: 11.5, bold: true, color: AZUL })
  let yd = y - 24
  for (const linea of partir(normal, emisor.direccionFiscal, 8, cajaX - textoX - 12)) {
    escribir(page, linea, textoX, yd, { size: 8 })
    yd -= 10
  }
  if (emisor.telefono) escribir(page, `Tel. ${emisor.telefono}`, textoX, yd, { size: 8, color: GRIS })

  page.drawRectangle({ x: cajaX, y: y - 72, width: cajaW, height: 72, borderColor: NEGRO, borderWidth: 0.8 })
  escribir(page, `RUC ${emisor.ruc}`, cajaX + cajaW / 2, y - 20, { size: 11, align: 'center' })
  let yt = y - 38
  for (const linea of partir(negrita, TITULOS[d.tipo], 10, cajaW - 16)) {
    escribir(page, linea, cajaX + cajaW / 2, yt, { size: 10, bold: true, align: 'center' })
    yt -= 13
  }
  escribir(page, d.numeracionComprobante ?? 'SIN NÚMERO', cajaX + cajaW / 2, y - 64, { size: 12, bold: true, align: 'center' })

  // ── Datos del cliente ──────────────────────────────────────────────────────
  y -= 72 + 26
  const fecha = fechaPeru(d.fechaEmision)
  const izquierda: [string, string][] = [
    ['Cliente', d.receptorNombre],
    [DOCUMENTO[d.receptorTipoDocumento] ?? 'Documento', d.receptorNumeroDocumento === '00000000' && d.receptorTipoDocumento === '0' ? '-' : d.receptorNumeroDocumento],
    ['Dirección', '-'],
    ['Moneda', 'PEN'],
  ]
  if (d.tipo === 'NOTA_CREDITO') {
    izquierda.push(['Documento que modifica', d.numeracionDocumentoAfectado ?? '-'])
    if (d.motivoDocumentoAfectado) izquierda.push(['Motivo', d.motivoDocumentoAfectado])
  }
  const derechaDatos: [string, string][] = [['Fecha de Emisión', fecha], ['Condición de Pago', 'CONTADO'], ['Fecha de Vencimiento', fecha]]

  let yc = y
  for (const [etiqueta, valor] of izquierda) {
    escribir(page, etiqueta, M, yc, { bold: true })
    const lineas = partir(normal, valor, 8, 200)
    lineas.forEach((l, i) => escribir(page, l, M + 112, yc - i * 10))
    yc -= 12 + (lineas.length - 1) * 10
  }
  let yr = y
  for (const [etiqueta, valor] of derechaDatos) {
    escribir(page, etiqueta, 360, yr, { bold: true })
    escribir(page, valor, 360 + 105, yr)
    yr -= 12
  }
  y = Math.min(yc, yr) - 14

  // ── Detalle ────────────────────────────────────────────────────────────────
  const col = { codigo: M + 2, und: M + 70, desc: M + 104, cant: 340, vunit: 395, dscto: 450, sub: 505, total: derecha - 2 }
  page.drawRectangle({ x: M, y: y - 4, width: derecha - M, height: 15, color: GRIS_CLARO })
  const cab = (t: string, x: number, right = false) => escribir(page, t, x, y, { bold: true, color: AZUL, align: right ? 'right' : 'left' })
  cab('Código', col.codigo); cab('Und.', col.und); cab('Descripción', col.desc)
  cab('Cantidad', col.cant, true); cab('V.Unitario', col.vunit, true); cab('Descuento', col.dscto, true); cab('Sub_Total', col.sub, true); cab('Total', col.total, true)
  y -= 17

  for (const item of d.items) {
    const valorVenta = round2(item.total / (1 + IGV_PORCENTAJE / 100))
    const valorUnitario = round2(valorVenta / item.cantidad)
    const lineas = partir(normal, item.nombre, 8, col.cant - 60 - col.desc)
    escribir(page, recortar(normal, item.codigoProducto ?? '', 8, col.und - col.codigo - 6), col.codigo, y)
    escribir(page, item.productoId ? 'NIU' : 'ZZ', col.und, y)
    lineas.forEach((l, i) => escribir(page, l, col.desc, y - i * 10))
    escribir(page, item.cantidad.toFixed(2), col.cant, y, { align: 'right' })
    escribir(page, money(valorUnitario), col.vunit, y, { align: 'right' })
    escribir(page, '0.00', col.dscto, y, { align: 'right' })
    escribir(page, money(valorVenta), col.sub, y, { align: 'right' })
    escribir(page, money(item.total), col.total, y, { align: 'right' })
    y -= 12 + (lineas.length - 1) * 10
  }
  y -= 8

  // ── Observaciones y totales ────────────────────────────────────────────────
  page.drawRectangle({ x: M, y: y - 4, width: 250, height: 15, color: GRIS_CLARO })
  escribir(page, 'Observaciones', M + 2, y, { bold: true, color: AZUL })
  let yo = y - 16
  for (const l of partir(negrita, textoPagos(d), 8, 245)) {
    escribir(page, l, M + 2, yo, { bold: true, color: AZUL })
    yo -= 10
  }

  const gravadas = d.gravadas ?? round2(d.total / (1 + IGV_PORCENTAJE / 100))
  const igv = d.igv ?? round2(d.total - gravadas)
  const totales: [string, string][] = [
    ['Gratuitas : S/', '0.00'], ['Gravadas S/', money(gravadas)], [`IGV(${IGV_PORCENTAJE.toFixed(2)}%) S/`, money(igv)],
    ['Inafectas S/', '0.00'], ['Exoneradas S/', '0.00'], ['Exportaciones S/', '0.00'],
  ]
  let yT = y
  for (const [etiqueta, valor] of totales) {
    escribir(page, etiqueta, 480, yT, { bold: true, color: AZUL, align: 'right' })
    escribir(page, valor, derecha - 2, yT, { align: 'right' })
    yT -= 11
  }
  page.drawLine({ start: { x: 330, y: yT + 4 }, end: { x: derecha, y: yT + 4 }, thickness: 0.6, color: LINEA })
  yT -= 12
  escribir(page, 'Importe total :', 430, yT, { size: 11, bold: true, color: AZUL, align: 'right' })
  escribir(page, 'S/', 462, yT, { size: 11, bold: true, color: AZUL, align: 'right' })
  escribir(page, money(d.total), derecha - 2, yT, { size: 11, bold: true, color: AZUL, align: 'right' })

  y = Math.min(yo, yT) - 20
  page.drawLine({ start: { x: M, y: y + 8 }, end: { x: derecha, y: y + 8 }, thickness: 0.6, color: LINEA })
  escribir(page, 'Importe en letras', M, y - 4, { size: 8, color: GRIS })
  escribir(page, d.montoLetras ?? '', M, y - 18, { size: 9, bold: true, color: rgb(0.2, 0.25, 0.35) })
  y -= 40
  if (d.tipo !== 'NOTA_DESPACHO') {
    escribir(page, 'Resumen', M, y, { size: 8, color: GRIS })
    y -= 12
    escribir(page, d.codigoHash ?? '-----', M, y, { size: 8 })
    y -= 12
  } else {
    y += 12
  }
  page.drawLine({ start: { x: M, y }, end: { x: derecha, y }, thickness: 0.6, color: LINEA })

  // ── QR y pie ────────────────────────────────────────────────────────────────
  y -= 12
  if (d.cadenaParaCodigoQr) {
    const qr = await pdf.embedPng(await QRCode.toBuffer(d.cadenaParaCodigoQr, { width: 360, margin: 0, errorCorrectionLevel: 'M' }))
    page.drawImage(qr, { x: M, y: y - 100, width: 100, height: 100 })
    escribir(page, 'Representación impresa del comprobante electrónico.', M + 115, y - 14, { size: 8, color: GRIS })
    escribir(page, 'Puede verificarse en sunat.gob.pe con el código QR.', M + 115, y - 25, { size: 8, color: GRIS })
  } else if (d.tipo === 'NOTA_DESPACHO') {
    escribir(page, 'Documento interno. No se informa a SUNAT.', M, y - 14, { size: 8, color: GRIS })
  } else {
    escribir(page, 'Comprobante pendiente de envío a SUNAT: se enviará automáticamente.', M, y - 14, { size: 8, bold: true, color: rgb(0.7, 0.4, 0) })
  }

  const pie = [emisor.nombreComercial, emisor.telefono ? `Tel. ${emisor.telefono}` : null].filter(Boolean).join(' · ')
  escribir(page, 'Gracias por su preferencia!', W / 2, 60, { size: 8, bold: true, align: 'center' })
  escribir(page, pie, W / 2, 49, { size: 7, color: GRIS, align: 'center' })

  return pdf.save()
}

/** PDF de una factura guardada, con los datos del emisor tomados de la configuración. */
export async function generarPdfDeFactura(
  factura: Omit<ComprobantePdfDatos, 'fechaEmision'> & { fechaEmision: Date | null; creadoAt: Date },
  config: { ruc: string | null; razonSocial: string | null; nombreGimnasio: string; direccionFiscal: string | null; direccion: string | null; telefonoContacto: string | null },
): Promise<Uint8Array> {
  return generarPdfComprobante(
    { ...factura, fechaEmision: factura.fechaEmision ?? factura.creadoAt },
    {
      razonSocial: config.razonSocial || config.nombreGimnasio,
      ruc: config.ruc || process.env.FACTURADOR_RUC_EMISOR || '',
      direccionFiscal: config.direccionFiscal || config.direccion || '',
      nombreComercial: config.nombreGimnasio,
      telefono: config.telefonoContacto,
    },
  )
}
