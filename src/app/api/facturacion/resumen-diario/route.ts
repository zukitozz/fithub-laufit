import { NextResponse } from 'next/server'
import { enviarResumenDiario } from '@/lib/facturador'
import { reintentarPendientes, sincronizarCdrPendientes } from '@/lib/enviarFactura'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Tarea nocturna (Vercel Cron, 00:00 de Lima = 05:00 UTC). No hay botón manual: solo se ejecuta con
// `Authorization: Bearer $CRON_SECRET`, que Vercel envía solo cuando la variable CRON_SECRET está definida.
//   1. Reenvía los comprobantes que no llegaron al facturador (así las boletas pendientes entran al resumen).
//   2. Informa a SUNAT las boletas de días anteriores (resumen diario).
//   3. Descarga los CDR de facturas y notas dentro de los 7 días que los conserva el facturador.
// Cada paso es independiente: si uno falla, los demás se ejecutan. Los resultados se devuelven (y quedan en los logs de Vercel).
async function ejecutar(req: Request) {
  const secreto = process.env.CRON_SECRET
  if (!secreto || req.headers.get('authorization') !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const mensaje = (e: unknown) => (e instanceof Error ? e.message : 'Error desconocido')
  const reintentos = await reintentarPendientes().catch((e) => ({ error: mensaje(e) }))
  const resumen = await enviarResumenDiario().then((r) => ({ ok: true as const, r })).catch((e) => ({ ok: false as const, error: mensaje(e) }))
  const cdr = await sincronizarCdrPendientes().catch((e) => ({ error: mensaje(e) }))

  console.log('[resumen-diario]', JSON.stringify({ reintentos, resumen, cdr }))
  // 502 si el resumen falló, para que el fallo quede visible en el panel de Cron de Vercel.
  return NextResponse.json({ reintentos, resumen, cdr }, { status: resumen.ok ? 200 : 502 })
}

export const GET = ejecutar
export const POST = ejecutar
