export interface DatosPlan {
  nombre: string
  duracion: number
  unidad: 'MESES' | 'DIAS'
  precio: number
  matricula: number
  esPaseDiario: boolean
  activo: boolean
  orden: number
}

export function leerPlan(body: Record<string, unknown>): { data: DatosPlan } | { error: string } {
  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : ''
  if (!nombre) return { error: 'El nombre es obligatorio' }
  const duracion = Number(body.duracion)
  if (!Number.isInteger(duracion) || duracion < 1) return { error: 'La duración debe ser un entero mayor a 0' }
  const unidad = body.unidad === 'DIAS' ? 'DIAS' : 'MESES'
  const precio = Number(body.precio)
  if (!Number.isFinite(precio) || precio <= 0) return { error: 'El precio debe ser mayor a 0' }
  const matricula = body.matricula === undefined || body.matricula === '' ? 0 : Number(body.matricula)
  if (!Number.isFinite(matricula) || matricula < 0) return { error: 'La matrícula no puede ser negativa' }
  return {
    data: {
      nombre,
      duracion,
      unidad,
      precio: Math.round(precio * 100) / 100,
      matricula: Math.round(matricula * 100) / 100,
      esPaseDiario: body.esPaseDiario === true,
      activo: body.activo !== false,
      orden: Number.isInteger(Number(body.orden)) ? Number(body.orden) : 0,
    },
  }
}
