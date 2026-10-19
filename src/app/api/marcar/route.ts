import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { obtenerConfiguracion } from '@/lib/config'
import { esTipoDocumento, normalizarDocumento } from '@/lib/documentos'
import { registrarAsistenciaSocio } from '@/lib/asistencia'
import { proponerTipo, ultimaMarcacionValida } from '@/lib/coaches'
import { ipDe, limitar } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'

// Endpoint PÚBLICO (sin sesión): lo usa la página /marcar que se abre al escanear el QR de la sede.
// Las respuestas a socios no incluyen nombre ni foto: solo la administradora los ve en el panel /ingreso.

function hora(fecha: Date) {
  return new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(fecha)
}

export async function POST(req: Request) {
  const ip = ipDe(req)
  if (!limitar(`marcar:${ip}`, 20)) {
    return NextResponse.json({ error: 'Demasiados intentos. Espera un minuto o acércate a recepción.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })

  const config = await obtenerConfiguracion()
  if (typeof body.token !== 'string' || body.token !== config.qrToken) {
    return NextResponse.json({ error: 'Este QR ya no es válido. Pide ayuda en recepción.' }, { status: 403 })
  }

  if (!esTipoDocumento(body.tipoDocumento)) return NextResponse.json({ error: 'Tipo de documento inválido' }, { status: 400 })
  const numero = normalizarDocumento(body.tipoDocumento, body.numeroDocumento)
  if (!numero) return NextResponse.json({ error: 'Revisa el número de documento' }, { status: 400 })
  const clave = { tipoDocumento_numeroDocumento: { tipoDocumento: body.tipoDocumento, numeroDocumento: numero } }

  const [coach, socio] = await Promise.all([
    prisma.coach.findUnique({ where: clave }),
    body.tipoDocumento === 'RUC' ? null : prisma.socio.findUnique({ where: clave }),
  ])
  const coachActivo = coach?.activo ? coach : null
  const socioActivo = socio?.activo ? socio : null

  if (!coachActivo && !socioActivo) return NextResponse.json({ resultado: 'NO_ENCONTRADO' })

  // El mismo documento puede ser coach y socio: se pregunta qué quiere marcar.
  if (coachActivo && socioActivo && body.como !== 'COACH' && body.como !== 'SOCIO') {
    return NextResponse.json({ resultado: 'ELEGIR' })
  }

  if (coachActivo && (!socioActivo || body.como === 'COACH')) {
    const ultima = await ultimaMarcacionValida(coachActivo.id)
    const propuesta = proponerTipo(ultima)
    const nombre = coachActivo.nombre.split(' ')[0]

    // Paso 1: solo propone ENTRADA o SALIDA; el coach confirma (o lo invierte) en el paso 2.
    if (body.paso !== 'confirmar') return NextResponse.json({ resultado: 'COACH_PREVIA', nombre, propuesta })

    const tipo = body.tipo === 'ENTRADA' || body.tipo === 'SALIDA' ? body.tipo : propuesta
    // Doble toque: misma marcación en el último minuto no se duplica.
    if (ultima && ultima.tipo === tipo && Date.now() - ultima.fechaHora.getTime() < 60_000) {
      return NextResponse.json({ resultado: 'COACH_OK', nombre, tipo, hora: hora(ultima.fechaHora) })
    }
    const marcacion = await prisma.marcacionCoach.create({ data: { coachId: coachActivo.id, tipo, origen: 'QR', ip } })
    return NextResponse.json({ resultado: 'COACH_OK', nombre, tipo, hora: hora(marcacion.fechaHora) })
  }

  const registro = await registrarAsistenciaSocio(socioActivo!, 'QR', { ip })
  return NextResponse.json({ resultado: registro.resultado })
}
