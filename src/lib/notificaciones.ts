// Cliente del servicio de notificaciones por WhatsApp. FitHub nunca habla con Meta: solo con esta API.

const TIMEOUT_MS = 30_000 // la primera llamada tras un rato sin uso puede tardar ~15 s (la base se pausa)
const MARGEN_TOKEN_MS = 5 * 60_000

export function notificacionesConfiguradas() {
  const e = process.env
  return Boolean(e.NOTIF_BASE_URL && e.NOTIF_TOKEN_URL && e.NOTIF_CLIENT_ID && e.NOTIF_CLIENT_SECRET && e.NOTIF_PROYECTO)
}

let tokenCache: { valor: string; vence: number } | null = null

async function obtenerToken(forzar = false): Promise<string> {
  if (!forzar && tokenCache && Date.now() < tokenCache.vence) return tokenCache.valor
  const credenciales = Buffer.from(`${process.env.NOTIF_CLIENT_ID}:${process.env.NOTIF_CLIENT_SECRET}`).toString('base64')
  const res = await fetch(process.env.NOTIF_TOKEN_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${credenciales}` },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: process.env.NOTIF_SCOPE || 'notificaciones-api/envios.write' }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`No se pudo obtener el token (${res.status})`)
  const json = (await res.json()) as { access_token: string; expires_in: number }
  tokenCache = { valor: json.access_token, vence: Date.now() + json.expires_in * 1000 - MARGEN_TOKEN_MS }
  return json.access_token
}

/** Llama a la API con Bearer; ante 401/403 renueva el token y reintenta una sola vez. */
async function llamar(metodo: 'POST' | 'PUT', ruta: string, cuerpo: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  for (const forzar of [false, true]) {
    const token = await obtenerToken(forzar)
    const res = await fetch(`${process.env.NOTIF_BASE_URL}${ruta}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if ((res.status === 401 || res.status === 403) && !forzar) continue
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
    return { status: res.status, json }
  }
  throw new Error('Unreachable')
}

export type TopicoCodigo = 'SUSCRIPCION_BIENVENIDA' | 'SUSCRIPCION_COMPROBANTE' | 'SUSCRIPCION_VENCE_3D' | 'SUSCRIPCION_VENCE_HOY'

export interface SolicitudEnvio {
  topicoCodigo: TopicoCodigo
  telefono: string
  referenciaExterna: string
  variables: Record<string, string>
  botonUrlSufijo?: string
  adjuntoUrl?: string
  adjuntoNombre?: string
}

export type ResultadoEnvio =
  | { tipo: 'ENVIADO'; envioId: string | null }
  | { tipo: 'FALLIDO'; error: string }
  | { tipo: 'SIN_CONSENTIMIENTO' }
  /** 500, timeout o red: se reintenta con la MISMA referencia. */
  | { tipo: 'REINTENTABLE'; error: string }

const texto = (v: unknown) => (typeof v === 'string' ? v : v ? JSON.stringify(v) : '')

export async function enviarAviso(s: SolicitudEnvio): Promise<ResultadoEnvio> {
  const cuerpo = {
    proyectoCodigo: process.env.NOTIF_PROYECTO,
    topicoCodigo: s.topicoCodigo,
    destinatario: { telefono: s.telefono },
    referenciaExterna: s.referenciaExterna,
    variables: s.variables,
    ...(s.botonUrlSufijo ? { botonUrlSufijo: s.botonUrlSufijo } : {}),
    ...(s.adjuntoUrl ? { adjuntoUrl: s.adjuntoUrl } : {}),
    ...(s.adjuntoNombre ? { adjuntoNombre: s.adjuntoNombre } : {}),
  }
  try {
    const { status, json } = await llamar('POST', '/v1/envios', cuerpo)
    if (status === 200) return { tipo: 'ENVIADO', envioId: typeof json.envioId === 'string' ? json.envioId : null }
    if (status === 422 && json.error === 'SIN_CONSENTIMIENTO') return { tipo: 'SIN_CONSENTIMIENTO' }
    // 400 es un error de código, 502 un rechazo de Meta y 401/403 persistente es de configuración: ninguno se arregla reintentando.
    if (status === 400 || status === 502 || status === 422 || status === 401 || status === 403) return { tipo: 'FALLIDO', error: `${status} ${texto(json.error)}`.trim() }
    return { tipo: 'REINTENTABLE', error: `${status} ${texto(json.error)}`.trim() }
  } catch (e) {
    return { tipo: 'REINTENTABLE', error: e instanceof Error ? e.message : 'Error de red' }
  }
}

export type ResultadoConsentimiento = { tipo: 'OK' } | { tipo: 'BAJA_VOLUNTARIA' } | { tipo: 'ERROR'; error: string }

export async function enviarConsentimiento(telefono: string, aceptado: boolean, origen: string): Promise<ResultadoConsentimiento> {
  try {
    const { status, json } = await llamar('PUT', '/v1/consentimientos', { proyectoCodigo: process.env.NOTIF_PROYECTO, telefono, aceptado, origen })
    if (status === 200) return { tipo: 'OK' }
    if (status === 409 && json.error === 'BAJA_VOLUNTARIA') return { tipo: 'BAJA_VOLUNTARIA' }
    return { tipo: 'ERROR', error: `${status} ${texto(json.error)}`.trim() }
  } catch (e) {
    return { tipo: 'ERROR', error: e instanceof Error ? e.message : 'Error de red' }
  }
}
