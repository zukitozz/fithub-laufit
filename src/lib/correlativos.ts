import type { Prisma, PrismaClient } from '@prisma/client'

type ClientLike = PrismaClient | Prisma.TransactionClient

const TIPOS_CON_SERIE_TRUNCADA = new Set(['07', '08'])

function resolverSerie(tipoDocumento: string, serie: string) {
  return TIPOS_CON_SERIE_TRUNCADA.has(tipoDocumento) ? serie.slice(-2) : serie
}

/**
 * tipoDocumentoAfectado solo aplica a notas de crédito/débito (07/08):
 * indica si la nota afecta una Factura ('01') o una Boleta ('03').
 */
export function resolverPrefijo(tipoDocumento: string, tipoDocumentoAfectado?: string | null): string {
  switch (tipoDocumento) {
    case '01':
      return 'F'
    case '03':
      return 'B'
    case '07':
    case '08': {
      if (tipoDocumentoAfectado !== '01' && tipoDocumentoAfectado !== '03') {
        throw new Error(`tipoDocumentoAfectado inválido para nota (tipo ${tipoDocumento}): ${tipoDocumentoAfectado}`)
      }
      const base = tipoDocumento === '07' ? 'C' : 'D'
      return (tipoDocumentoAfectado === '01' ? 'F' : 'B') + base
    }
    case '50':
      return 'ND'
    case '51':
      return 'NV'
    default:
      throw new Error(`Prefijo no definido para tipo de documento ${tipoDocumento}`)
  }
}

export async function obtenerCorrelativo(client: ClientLike, params: {
  ruc: string
  tipoDocumento: string
  serie: string
  prefijo: string
}) {
  const { ruc, tipoDocumento, prefijo } = params
  const serie = resolverSerie(tipoDocumento, params.serie)

  const rows = await client.$queryRaw<{ numeracion: number }[]>`
    INSERT INTO "Correlativo" ("id", "tipoDocumento", "serie", "prefijo", "ruc", "numeracion", "createdAt", "updatedAt")
    VALUES (gen_random_uuid()::text, ${tipoDocumento}, ${serie}, ${prefijo}, ${ruc}, 1, now(), now())
    ON CONFLICT ("ruc", "tipoDocumento", "serie", "prefijo")
    DO UPDATE SET "numeracion" = "Correlativo"."numeracion" + 1, "updatedAt" = now()
    RETURNING "numeracion"
  `

  const numeracion = String(rows[0].numeracion).padStart(6, '0')
  return `${prefijo}${serie}-${numeracion}`
}
