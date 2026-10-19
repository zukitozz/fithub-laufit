import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import QRCode from 'qrcode'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'
import { obtenerConfiguracion } from '@/lib/config'

export const dynamic = 'force-dynamic'

async function respuestaQr(req: Request, token: string) {
  // APP_URL fija el dominio público en producción; sin ella se usa el origen de la petición.
  const base = (process.env.APP_URL || new URL(req.url).origin).replace(/\/$/, '')
  const url = `${base}/marcar?t=${token}`
  const dataUrl = await QRCode.toDataURL(url, { width: 800, margin: 2, errorCorrectionLevel: 'M' })
  return NextResponse.json({ url, dataUrl })
}

export async function GET(req: Request) {
  const guard = await requireApiAuth(['SUPERVISOR'])
  if (guard) return guard
  const config = await obtenerConfiguracion()
  return respuestaQr(req, config.qrToken)
}

// Regenera el token: el QR impreso anterior deja de funcionar y hay que reimprimir el nuevo.
export async function POST(req: Request) {
  const guard = await requireApiAuth(['SUPERVISOR'])
  if (guard) return guard
  await obtenerConfiguracion()
  const config = await prisma.configuracion.update({ where: { id: 'default' }, data: { qrToken: randomUUID() } })
  return respuestaQr(req, config.qrToken)
}
