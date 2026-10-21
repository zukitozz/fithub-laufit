import { NextResponse } from 'next/server'
import { reintentarPendientes, sincronizarCdrPendientes } from '@/lib/enviarFactura'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Tarea nocturna (Vercel Cron, 00:00 de Lima = 05:00 UTC). No hay botón manual: solo se ejecuta con
// `Authorization: Bearer $CRON_SECRET`, que Vercel envía solo cuando la variable CRON_SECRET está definida.
//   1. Reenvía los comprobantes que no llegaron al facturador (timeout, caída). Las boletas entran así al resumen,
//      que el facturador arma y envía solo a las 00:10 de Lima: ya no se llama a POST /resumenes-diarios.
//   2. Descarga los CDR de facturas y notas dentro de los 7 días que los conserva el facturador.
// Cada paso es independiente: si uno falla, el otro se ejecuta. Los resultados se devuelven (y quedan en los logs de Vercel).
async function ejecutar(req: Request) {
  const secreto = process.env.CRON_SECRET
  if (!secreto || req.headers.get('authorization') !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const mensaje = (e: unknown) => (e instanceof Error ? e.message : 'Error desconocido')
  const reintentos = await reintentarPendientes().catch((e) => ({ error: mensaje(e) }))
  const cdr = await sincronizarCdrPendientes().catch((e) => ({ error: mensaje(e) }))

  console.log('[resumen-diario]', JSON.stringify({ reintentos, cdr }))
  return NextResponse.json({ reintentos, cdr })
}

export const GET = ejecutar
export const POST = ejecutar
