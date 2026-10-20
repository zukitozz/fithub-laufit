import { NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/api-auth'
import { simularAvisoVencimiento } from '@/lib/avisosWhatsApp'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// SOLO PRUEBAS: dispara ahora el aviso de vencimiento (3 días u hoy) de un socio. Retirar antes de pasar a producción.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAuth(['SUPERVISOR'])
  if (guard) return guard
  const body = await req.json().catch(() => null)
  if (body?.tipo !== 'D3' && body?.tipo !== 'D0') return NextResponse.json({ error: 'tipo debe ser D3 o D0' }, { status: 400 })
  const r = await simularAvisoVencimiento(params.id, body.tipo)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 409 })
  return NextResponse.json(r)
}
