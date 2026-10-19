import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'
import { obtenerConfiguracion } from '@/lib/config'
import { normalizarDocumento } from '@/lib/documentos'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requireApiAuth(['ADMIN', 'SUPERVISOR'])
  if (guard) return guard
  // El token del QR nunca sale por esta ruta: se obtiene solo en /api/ajustes/qr (gerente).
  const { qrToken: _qrToken, ...config } = await obtenerConfiguracion()
  return NextResponse.json(config)
}

const TEXTOS = ['nombreGimnasio', 'direccion', 'telefonoContacto', 'razonSocial', 'direccionFiscal', 'codigoUbigeo'] as const
const ENTEROS = ['diasAvisoVencimiento', 'diasGracia', 'minutosAntiDuplicadoIngreso'] as const
const BOOLEANOS = ['whatsappActivo'] as const

export async function PATCH(req: Request) {
  const guard = await requireApiAuth(['SUPERVISOR'])
  if (guard) return guard

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })

  const data: Record<string, unknown> = {}
  for (const campo of TEXTOS) {
    if (campo in body) data[campo] = typeof body[campo] === 'string' && body[campo].trim() ? body[campo].trim() : null
  }
  for (const campo of ENTEROS) {
    if (campo in body) {
      const n = Number(body[campo])
      if (!Number.isInteger(n) || n < 0 || n > 365) return NextResponse.json({ error: `Valor inválido en ${campo}` }, { status: 400 })
      data[campo] = n
    }
  }
  for (const campo of BOOLEANOS) {
    if (campo in body) data[campo] = body[campo] === true
  }
  if ('ruc' in body) {
    if (body.ruc === null || body.ruc === '') data.ruc = null
    else {
      const ruc = normalizarDocumento('RUC', body.ruc)
      if (!ruc) return NextResponse.json({ error: 'El RUC debe tener 11 dígitos' }, { status: 400 })
      data.ruc = ruc
    }
  }
  if ('nombreGimnasio' in data && !data.nombreGimnasio) return NextResponse.json({ error: 'El nombre del gimnasio es obligatorio' }, { status: 400 })

  await obtenerConfiguracion()
  const { qrToken: _qrToken, ...config } = await prisma.configuracion.update({ where: { id: 'default' }, data })
  return NextResponse.json(config)
}
