import { NextResponse } from 'next/server'
import { ejecutarAvisosVencimiento } from '@/lib/avisosWhatsApp'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Tarea diaria (Vercel Cron, 08:00 de Lima = 13:00 UTC): avisa por WhatsApp a quienes vencen en 3 días y hoy.
// Solo se ejecuta con `Authorization: Bearer $CRON_SECRET`. Se puede lanzar a mano varias veces el mismo día sin duplicar avisos.
async function ejecutar(req: Request) {
  const secreto = process.env.CRON_SECRET
  if (!secreto || req.headers.get('authorization') !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  try {
    const resumen = await ejecutarAvisosVencimiento()
    console.log('[avisos-vencimientos]', JSON.stringify(resumen))
    return NextResponse.json(resumen)
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Error desconocido'
    console.error('[avisos-vencimientos]', error)
    return NextResponse.json({ error }, { status: 500 })
  }
}

export const GET = ejecutar
export const POST = ejecutar
