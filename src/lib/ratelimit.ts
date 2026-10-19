// Límite de intentos en memoria. En serverless cada instancia lleva su propio contador, así que
// es un freno contra recorridos de documentos en bucle, no una garantía estricta.
const ventanas = new Map<string, { inicio: number; cuenta: number }>()

export function limitar(clave: string, max = 20, ventanaMs = 60_000): boolean {
  const ahora = Date.now()
  const actual = ventanas.get(clave)
  if (!actual || ahora - actual.inicio > ventanaMs) {
    ventanas.set(clave, { inicio: ahora, cuenta: 1 })
    if (ventanas.size > 5000) {
      for (const [k, v] of ventanas) if (ahora - v.inicio > ventanaMs) ventanas.delete(k)
    }
    return true
  }
  actual.cuenta += 1
  return actual.cuenta <= max
}

export function ipDe(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'desconocida'
}
