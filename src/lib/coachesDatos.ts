import { esTipoDocumento, normalizarCelular, normalizarDocumento, type TipoDocumento } from '@/lib/documentos'

export interface DatosCoach {
  nombre: string
  tipoDocumento: TipoDocumento
  numeroDocumento: string
  celular: string | null
  activo: boolean
}

export function leerCoach(body: Record<string, unknown>): { data: DatosCoach } | { error: string } {
  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : ''
  if (!nombre) return { error: 'El nombre es obligatorio' }
  const tipoDocumento = body.tipoDocumento ?? 'DNI'
  if (!esTipoDocumento(tipoDocumento)) return { error: 'Tipo de documento inválido' }
  const numeroDocumento = normalizarDocumento(tipoDocumento, body.numeroDocumento)
  if (!numeroDocumento) return { error: 'Número de documento inválido' }
  let celular: string | null = null
  if (typeof body.celular === 'string' && body.celular.trim()) {
    celular = normalizarCelular(body.celular)
    if (!celular) return { error: 'El celular debe tener 9 dígitos y empezar con 9' }
  }
  return { data: { nombre, tipoDocumento, numeroDocumento, celular, activo: body.activo !== false } }
}
