import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

const TIPOS = ['01', '03', '07', '50']

export async function GET() {
  const guard = await requireApiAuth(['SUPERVISOR'])
  if (guard) return guard
  return NextResponse.json(await prisma.serie.findMany({ orderBy: [{ tipoComprobante: 'asc' }, { serie: 'asc' }] }))
}

// Las series deben estar habilitadas en SUNAT para el RUC emisor y dadas de alta en el facturador.
export async function POST(req: Request) {
  const guard = await requireApiAuth(['SUPERVISOR'])
  if (guard) return guard

  const body = await req.json().catch(() => null)
  const tipoComprobante = String(body?.tipoComprobante ?? '')
  const serie = String(body?.serie ?? '').trim().toUpperCase()
  if (!TIPOS.includes(tipoComprobante)) return NextResponse.json({ error: 'Tipo de comprobante inválido (01, 03, 07 o 50)' }, { status: 400 })
  if (!/^[A-Z0-9]{3}$/.test(serie)) return NextResponse.json({ error: 'La serie debe tener 3 caracteres (ej. 001)' }, { status: 400 })

  const existente = await prisma.serie.findFirst({ where: { tipoComprobante, serie } })
  if (existente) return NextResponse.json({ error: 'Esa serie ya existe' }, { status: 409 })

  const creada = await prisma.serie.create({ data: { tipoComprobante, serie, descripcion: typeof body?.descripcion === 'string' ? body.descripcion.slice(0, 200) : null } })
  return NextResponse.json(creada, { status: 201 })
}
