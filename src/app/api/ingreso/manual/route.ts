import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { requireApiAuth } from '@/lib/api-auth'
import { esTipoDocumento, normalizarDocumento } from '@/lib/documentos'
import { registrarAsistenciaSocio } from '@/lib/asistencia'

export const dynamic = 'force-dynamic'

// Ingreso registrado por la administradora (socio sin celular o que no pudo escanear).
export async function POST(req: Request) {
  const guard = await requireApiAuth(['ADMIN', 'SUPERVISOR'])
  if (guard) return guard
  const session = await auth()

  const body = await req.json().catch(() => null)
  const tipo = body?.tipoDocumento ?? 'DNI'
  if (!esTipoDocumento(tipo) || tipo === 'RUC') return NextResponse.json({ error: 'Tipo de documento inválido' }, { status: 400 })
  const numero = normalizarDocumento(tipo, body?.numeroDocumento)
  if (!numero) return NextResponse.json({ error: 'Revisa el número de documento' }, { status: 400 })

  const socio = await prisma.socio.findUnique({ where: { tipoDocumento_numeroDocumento: { tipoDocumento: tipo, numeroDocumento: numero } } })
  if (!socio || !socio.activo) return NextResponse.json({ error: 'No hay un socio con ese documento' }, { status: 404 })

  const registro = await registrarAsistenciaSocio(socio, 'RECEPCION', { usuarioId: session!.user.id })
  return NextResponse.json({ ...registro, socio: { id: socio.id, nombre: socio.nombre } })
}
