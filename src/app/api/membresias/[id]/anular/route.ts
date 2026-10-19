import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { requireApiAuth } from '@/lib/api-auth'
import { anularMembresia } from '@/lib/ventas'

export const dynamic = 'force-dynamic'
// El envío inmediato espera al facturador (1 a 10 s, hasta 60 s).
export const maxDuration = 60

// Solo el gerente anula membresías (y con ello emite la nota de crédito).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAuth(['SUPERVISOR'])
  if (guard) return guard
  const session = await auth()

  const body = await req.json().catch(() => null)
  const motivo = typeof body?.motivo === 'string' ? body.motivo.trim() : ''
  if (motivo.length < 3) return NextResponse.json({ error: 'El motivo es obligatorio' }, { status: 400 })

  const resultado = await anularMembresia(params.id, motivo, session!.user.id)
  if (!resultado.ok) return NextResponse.json({ error: resultado.error }, { status: resultado.status })
  return NextResponse.json({ notaCredito: resultado.notaCredito })
}
