import QRCode from 'qrcode'
import { fechaPeru } from '@/lib/fechas'
import type { ComprobantePdfDatos, EmisorPdf } from '@/lib/comprobantePdf'

const IGV_PORCENTAJE = Number(process.env.IGV_PORCENTAJE || '18')

const TITULOS: Record<ComprobantePdfDatos['tipo'], string> = {
  BOLETA: 'BOLETA DE VENTA ELECTRÓNICA',
  FACTURA: 'FACTURA ELECTRÓNICA',
  NOTA_CREDITO: 'NOTA DE CRÉDITO ELECTRÓNICA',
  NOTA_DESPACHO: 'NOTA DE DESPACHO',
}

const DOCUMENTO: Record<string, string> = { '1': 'DNI', '4': 'CE', '6': 'RUC', '0': 'DOC' }

const money = (n: number) => n.toFixed(2)
const round2 = (n: number) => Math.round(n * 100) / 100

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c))
}

function pagos(d: ComprobantePdfDatos): string {
  if (d.metodoPago !== 'MIXTO') return `<p>Pago: ${esc(d.metodoPago)}</p>`
  const partes: [string, number | null][] = [
    ['Efectivo', d.pagoEfectivo], ['Tarjeta', d.pagoTarjeta], ['Yape/Plin', d.pagoYape], ['Transferencia', d.pagoTransferencia], ['Depósito', d.pagoDeposito],
  ]
  return '<p>Pago: MIXTO</p>' + partes
    .filter(([, v]) => v)
    .map(([n, v]) => `<div class="fila"><span>${n}</span><span>S/ ${money(v as number)}</span></div>`)
    .join('')
}

/**
 * Ticket de 80 mm para impresora térmica. Es una página HTML que se imprime desde el navegador
 * (diálogo nativo, impresora térmica instalada en Windows); la página no se imprime sola.
 */
export async function generarHtmlTicket(d: ComprobantePdfDatos, emisor: EmisorPdf): Promise<string> {
  const qr = d.cadenaParaCodigoQr
    ? await QRCode.toDataURL(d.cadenaParaCodigoQr, { margin: 0, width: 260, errorCorrectionLevel: 'M' })
    : null
  const gravadas = d.gravadas ?? round2(d.total / (1 + IGV_PORCENTAJE / 100))
  const igv = d.igv ?? round2(d.total - gravadas)
  const documento = d.receptorNumeroDocumento === '00000000' && d.receptorTipoDocumento === '0'
    ? ''
    : `<p>${DOCUMENTO[d.receptorTipoDocumento] ?? 'DOC'}: ${esc(d.receptorNumeroDocumento)}</p>`

  const items = d.items.map((i) => `
    <div class="fila"><span>${i.cantidad} x ${esc(i.nombre)}</span><span>S/ ${money(i.total)}</span></div>`).join('')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(`${TITULOS[d.tipo]} ${d.numeracionComprobante ?? ''}`.trim())}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  /* Peso alto: las térmicas dithean el antialiasing del texto fino y sale borroso. */
  body { width: 76mm; margin: 0 auto; padding: 2mm 3mm; font-family: Arial, Helvetica, sans-serif; font-size: 12px; font-weight: 500; color: #000; }
  .centrado { text-align: center; }
  .sep { border-top: 1px dashed #000; margin: 6px 0; }
  .fila { display: flex; justify-content: space-between; gap: 8px; margin: 2px 0; }
  h1 { font-size: 14px; margin: 0 0 2px; font-weight: 600; }
  p { margin: 0; }
  .total { font-size: 14px; font-weight: 600; }
  .hash { font-size: 9px; font-weight: 400; word-break: break-all; margin-top: 4px; }
</style>
</head>
<body>
  <div class="centrado">
    <h1>${esc(emisor.razonSocial)}</h1>
    <p>RUC: ${esc(emisor.ruc)}</p>
    ${emisor.direccionFiscal ? `<p>${esc(emisor.direccionFiscal)}</p>` : ''}
    ${emisor.telefono ? `<p>Tel. ${esc(emisor.telefono)}</p>` : ''}
  </div>
  <div class="sep"></div>
  <div class="centrado">
    <p><strong>${TITULOS[d.tipo]}</strong></p>
    <p>${esc(d.numeracionComprobante ?? 'SIN NÚMERO')}</p>
  </div>
  <div class="sep"></div>
  <p>Fecha: ${esc(fechaPeru(d.fechaEmision))}</p>
  <p>Cliente: ${esc(d.receptorNombre)}</p>
  ${documento}
  ${d.tipo === 'NOTA_CREDITO' ? `<p>Modifica: ${esc(d.numeracionDocumentoAfectado ?? '-')}</p>${d.motivoDocumentoAfectado ? `<p>Motivo: ${esc(d.motivoDocumentoAfectado)}</p>` : ''}` : ''}
  <div class="sep"></div>
  ${items}
  <div class="sep"></div>
  <div class="fila"><span>Op. gravada</span><span>S/ ${money(gravadas)}</span></div>
  <div class="fila"><span>IGV (${IGV_PORCENTAJE}%)</span><span>S/ ${money(igv)}</span></div>
  <div class="fila total"><span>TOTAL</span><span>S/ ${money(d.total)}</span></div>
  ${d.montoLetras ? `<p>Son: ${esc(d.montoLetras)}</p>` : ''}
  ${pagos(d)}
  <div class="sep"></div>
  <div class="centrado">
    ${qr ? `<img src="${qr}" width="130" height="130" alt="Código QR" />` : ''}
    ${d.codigoHash ? `<p class="hash">Hash: ${esc(d.codigoHash)}</p>` : ''}
    ${d.tipo === 'NOTA_DESPACHO' ? '<p>Documento interno. No se informa a SUNAT.</p>' : ''}
    ${qr ? '<p class="hash">Representación impresa del comprobante electrónico. Verifique en sunat.gob.pe</p>' : ''}
  </div>
  <div class="sep"></div>
  <p class="centrado">¡Gracias por su preferencia!</p>
  <p class="centrado">${esc(emisor.nombreComercial)}</p>
</body>
</html>`
}
