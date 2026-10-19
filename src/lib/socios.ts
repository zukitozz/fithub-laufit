import { esTipoDocumento, normalizarCelular, normalizarDocumento, type TipoDocumento } from '@/lib/documentos'

export interface DatosSocio {
  nombre: string
  tipoDocumento: TipoDocumento
  numeroDocumento: string
  razonSocial: string | null
  rucFactura: string | null
  celular: string | null
  email: string | null
  fechaNacimiento: Date | null
  contactoEmergencia: string | null
  telefonoEmergencia: string | null
  condicionMedica: string | null
  notas: string | null
  consentimientoWhatsApp: boolean
}

function texto(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const limpio = valor.trim()
  return limpio ? limpio : null
}

/** Valida y normaliza el cuerpo de alta/edición de un socio. */
export function leerSocio(body: Record<string, unknown>): { data: DatosSocio } | { error: string } {
  const nombre = texto(body.nombre)
  if (!nombre) return { error: 'El nombre es obligatorio' }

  const tipoDocumento = body.tipoDocumento ?? 'DNI'
  if (!esTipoDocumento(tipoDocumento) || tipoDocumento === 'RUC') return { error: 'El documento del socio debe ser DNI o Carnet de Extranjería' }
  const numeroDocumento = normalizarDocumento(tipoDocumento, body.numeroDocumento)
  if (!numeroDocumento) return { error: tipoDocumento === 'DNI' ? 'El DNI debe tener 8 dígitos' : 'El Carnet de Extranjería debe tener entre 9 y 12 caracteres' }

  let celular: string | null = null
  if (texto(body.celular)) {
    celular = normalizarCelular(body.celular)
    if (!celular) return { error: 'El celular debe tener 9 dígitos y empezar con 9' }
  }

  let rucFactura: string | null = null
  if (texto(body.rucFactura)) {
    rucFactura = normalizarDocumento('RUC', body.rucFactura)
    if (!rucFactura) return { error: 'El RUC debe tener 11 dígitos' }
  }

  let fechaNacimiento: Date | null = null
  if (texto(body.fechaNacimiento)) {
    fechaNacimiento = new Date(`${String(body.fechaNacimiento).slice(0, 10)}T00:00:00.000Z`)
    if (Number.isNaN(fechaNacimiento.getTime())) return { error: 'Fecha de nacimiento inválida' }
  }

  const email = texto(body.email)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Correo inválido' }

  return {
    data: {
      nombre,
      tipoDocumento,
      numeroDocumento,
      razonSocial: texto(body.razonSocial),
      rucFactura,
      celular,
      email: email?.toLowerCase() ?? null,
      fechaNacimiento,
      contactoEmergencia: texto(body.contactoEmergencia),
      telefonoEmergencia: texto(body.telefonoEmergencia),
      condicionMedica: texto(body.condicionMedica),
      notas: texto(body.notas),
      consentimientoWhatsApp: body.consentimientoWhatsApp === true,
    },
  }
}
