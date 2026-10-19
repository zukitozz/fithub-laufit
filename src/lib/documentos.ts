export type TipoDocumento = 'DNI' | 'CE' | 'RUC'

export const TIPOS_DOCUMENTO: TipoDocumento[] = ['DNI', 'CE', 'RUC']

/** Catálogo 06 SUNAT: 1=DNI, 4=Carnet de Extranjería, 6=RUC. */
export const CODIGO_SUNAT_DOCUMENTO: Record<TipoDocumento, string> = { DNI: '1', CE: '4', RUC: '6' }

export function esTipoDocumento(valor: unknown): valor is TipoDocumento {
  return typeof valor === 'string' && (TIPOS_DOCUMENTO as string[]).includes(valor)
}

/** Normaliza (mayúsculas, sin espacios) y valida el formato. Devuelve null si es inválido. */
export function normalizarDocumento(tipo: TipoDocumento, numero: unknown): string | null {
  if (typeof numero !== 'string') return null
  const limpio = numero.replace(/\s+/g, '').toUpperCase()
  if (tipo === 'DNI') return /^\d{8}$/.test(limpio) ? limpio : null
  if (tipo === 'RUC') return /^(10|15|17|20)\d{9}$/.test(limpio) ? limpio : null
  return /^[A-Z0-9]{9,12}$/.test(limpio) ? limpio : null // CE
}

/** Muestra solo los últimos dígitos: ***1234 */
export function enmascararDocumento(numero: string) {
  return numero.length <= 4 ? numero : `${'•'.repeat(numero.length - 4)}${numero.slice(-4)}`
}

/** Normaliza un celular peruano a E.164 (+51XXXXXXXXX). Null si no es válido. */
export function normalizarCelular(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const digitos = valor.replace(/[^\d]/g, '')
  const nacional = digitos.startsWith('51') && digitos.length === 11 ? digitos.slice(2) : digitos
  return /^9\d{8}$/.test(nacional) ? `+51${nacional}` : null
}
