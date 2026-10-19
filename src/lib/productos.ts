export interface DatosProducto {
  nombre: string
  categoria: string | null
  codigoBarras: string | null
  precioVenta: number
  precioCosto: number | null
  alertaStock: number
  controlaStock: boolean
  activo: boolean
}

const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
const round2 = (n: number) => Math.round(n * 100) / 100

/** Valida el alta/edición de un producto. El stock no se edita aquí: se mueve con ingresos y ajustes. */
export function leerProducto(body: Record<string, unknown>): { data: DatosProducto } | { error: string } {
  const nombre = texto(body.nombre)
  if (!nombre) return { error: 'El nombre es obligatorio' }
  const precioVenta = Number(body.precioVenta)
  if (!Number.isFinite(precioVenta) || precioVenta <= 0) return { error: 'El precio de venta debe ser mayor a 0' }
  let precioCosto: number | null = null
  if (body.precioCosto !== undefined && body.precioCosto !== null && body.precioCosto !== '') {
    precioCosto = Number(body.precioCosto)
    if (!Number.isFinite(precioCosto) || precioCosto < 0) return { error: 'El costo no es válido' }
    precioCosto = round2(precioCosto)
  }
  const alertaStock = body.alertaStock === undefined || body.alertaStock === '' ? 5 : Number(body.alertaStock)
  if (!Number.isInteger(alertaStock) || alertaStock < 0) return { error: 'La alerta de stock debe ser un entero positivo' }

  return {
    data: {
      nombre,
      categoria: texto(body.categoria),
      codigoBarras: texto(body.codigoBarras),
      precioVenta: round2(precioVenta),
      precioCosto,
      alertaStock,
      controlaStock: body.controlaStock !== false,
      activo: body.activo !== false,
    },
  }
}
