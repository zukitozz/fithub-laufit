import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'crypto'

const BUCKET = process.env.AWS_S3_BUCKET || ''
// 12 horas: alcanza para una jornada sin que la URL expire con el panel de ingresos abierto.
const URL_EXPIRACION_SEGUNDOS = 60 * 60 * 12

// Credenciales explícitas: si la máquina tiene AWS_PROFILE, el SDK lo prioriza sobre estas
// variables y terminaría usando credenciales de otro usuario/rol.
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
})

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}

export const TAMANO_MAXIMO_FOTO = 8 * 1024 * 1024 // 8 MB

export function almacenamientoConfigurado() {
  return Boolean(BUCKET && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
}

// Devuelve la key de S3 (no una URL): el bucket es privado y las lecturas pasan siempre por urlFirmada().
export async function guardarFotoSocio(socioId: string, file: File): Promise<string> {
  const extension = EXTENSION_BY_MIME[file.type]
  if (!extension) throw new Error('TIPO_NO_SOPORTADO')
  if (file.size > TAMANO_MAXIMO_FOTO) throw new Error('ARCHIVO_MUY_GRANDE')

  const key = `socios/${socioId}/${randomUUID()}${extension}`
  const buffer = Buffer.from(await file.arrayBuffer())
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer, ContentType: file.type }))
  return key
}

/** URL firmada de una foto, o null si no hay foto o el almacenamiento no está configurado. */
export async function urlFirmada(key: string | null | undefined): Promise<string | null> {
  if (!key || !almacenamientoConfigurado()) return null
  try {
    return await getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: URL_EXPIRACION_SEGUNDOS })
  } catch {
    return null
  }
}

const PDF_EXPIRACION_SEGUNDOS = 60 * 60 // WhatsApp descarga el archivo al enviar; debe valer al menos 10 minutos

/** Guarda el PDF de un comprobante y devuelve su key de S3. */
export async function guardarPdfComprobante(facturaId: string, bytes: Uint8Array): Promise<string> {
  const key = `comprobantes/${facturaId}.pdf`
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: bytes, ContentType: 'application/pdf' }))
  return key
}

/** URL https firmada de un PDF para que WhatsApp lo descargue sin autenticación. Firmarla justo antes de enviar. */
export async function urlFirmadaPdf(key: string, nombreArchivo: string): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: key, ResponseContentDisposition: `inline; filename="${nombreArchivo}"`, ResponseContentType: 'application/pdf' }),
    { expiresIn: PDF_EXPIRACION_SEGUNDOS },
  )
}
