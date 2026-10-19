import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { requireApiAuth } from '@/lib/api-auth'
import { venderMembresia } from '@/lib/ventas'

export const dynamic = 'force-dynamic'
// El envío inmediato espera al facturador (1 a 10 s, hasta 60 s).
export const maxDuration = 60

export async function POST(req: Request) {
  const guard = await requireApiAuth(['ADMIN', 'SUPERVISOR'])
  if (guard) return guard
  const session = await auth()

  const body = await req.json().catch(() => null)
  if (!body?.socioId || !body?.planId) {
    return NextResponse.json({ error: 'socioId y planId son obligatorios' }, { status: 400 })
  }
  if (!['BOLETA', 'FACTURA', 'NOTA_DESPACHO'].includes(body.tipoComprobante)) {
    return NextResponse.json({ error: 'tipoComprobante debe ser BOLETA, FACTURA o NOTA_DESPACHO' }, { status: 400 })
  }

  const resultado = await venderMembresia({
    socioId: body.socioId,
    planId: body.planId,
    fechaInicio: typeof body.fechaInicio === 'string' && body.fechaInicio ? body.fechaInicio : undefined,
    tipoComprobante: body.tipoComprobante,
    receptor: body.receptor,
    metodoPago: body.metodoPago,
    pagos: body.pagos,
    usuarioId: session!.user.id,
  })
  if (!resultado.ok) return NextResponse.json({ error: resultado.error }, { status: resultado.status })
  return NextResponse.json({ membresia: resultado.membresia, factura: resultado.factura }, { status: 201 })
}
