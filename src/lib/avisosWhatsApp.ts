import type { EnvioWhatsApp, Prisma, Socio, TipoAvisoWhatsApp } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { obtenerConfiguracion } from '@/lib/config'
import { enviarAviso, enviarConsentimiento, notificacionesConfiguradas, type SolicitudEnvio, type TopicoCodigo } from '@/lib/notificaciones'
import { generarPdfDeFactura } from '@/lib/comprobantePdf'
import { almacenamientoConfigurado, guardarPdfComprobante, urlFirmadaPdf } from '@/lib/storage'
import { hoyFecha, sumarDias, textoFecha } from '@/lib/membresias'

const TOPICO: Record<TipoAvisoWhatsApp, TopicoCodigo> = {
  BIENVENIDA: 'SUSCRIPCION_BIENVENIDA',
  COMPROBANTE: 'SUSCRIPCION_COMPROBANTE',
  D3: 'SUSCRIPCION_VENCE_3D',
  D0: 'SUSCRIPCION_VENCE_HOY',
}

/** Espera entre intentos ante un 500 o timeout (máximo 3 intentos). */
const ESPERAS_MS = [5_000, 15_000]
/** Un aviso pendiente deja de reintentarse pasado este plazo (un "faltan 3 días" ya no tendría sentido). */
const PLAZO_PENDIENTE_MS = 3 * 24 * 60 * 60 * 1000
/** Tiempo tras el cual la tarea deja de empezar envíos nuevos; lo que falte lo toma la siguiente corrida (es idempotente). */
const PRESUPUESTO_MS = 240_000

/** Lo que se guarda en EnvioWhatsApp.solicitud para poder rearmar la llamada en un reintento. */
interface SolicitudGuardada {
  topicoCodigo: TopicoCodigo
  telefono: string
  variables: Record<string, string>
  botonUrlSufijo?: string
  adjuntoKey?: string
  adjuntoNombre?: string
}

// ---------------------------------------------------------------------------
// Formato de datos
// ---------------------------------------------------------------------------

/** Las variables son solo texto: sin saltos de línea, tabulaciones ni 4 o más espacios seguidos. */
const variable = (v: string) => v.replace(/\s+/g, ' ').trim()

export function primerNombre(nombre: string): string {
  const [primero = ''] = variable(nombre).split(' ')
  return primero.charAt(0).toUpperCase() + primero.slice(1).toLowerCase()
}

/** 'dd/mm/aaaa' de una fecha @db.Date (00:00 UTC). */
export function fechaDMA(fecha: Date): string {
  const [a, m, d] = textoFecha(fecha).split('-')
  return `${d}/${m}/${a}`
}

type SocioAvisable = Pick<Socio, 'celular' | 'consentimientoWhatsApp' | 'bajaVoluntariaWhatsApp' | 'activo'>

function socioAvisable<T extends SocioAvisable>(s: T): s is T & { celular: string } {
  return s.activo && Boolean(s.celular) && s.consentimientoWhatsApp && !s.bajaVoluntariaWhatsApp
}

async function negocioNombre() {
  return variable(process.env.NOTIF_NEGOCIO_NOMBRE || (await obtenerConfiguracion()).nombreGimnasio)
}

/** Los avisos se mandan solo si el gimnasio los activó en Ajustes y el servicio está configurado. */
async function avisosActivos() {
  if (!notificacionesConfiguradas()) return false
  return (await obtenerConfiguracion()).whatsappActivo
}

// ---------------------------------------------------------------------------
// Envío con registro propio
// ---------------------------------------------------------------------------

const TERMINALES = ['ENVIADO', 'FALLIDO', 'SIN_CONSENTIMIENTO']

async function armarSolicitud(g: SolicitudGuardada, referenciaExterna: string): Promise<SolicitudEnvio> {
  return {
    topicoCodigo: g.topicoCodigo,
    telefono: g.telefono,
    referenciaExterna,
    variables: g.variables,
    botonUrlSufijo: g.botonUrlSufijo,
    // El enlace del PDF se firma justo antes de llamar, nunca se guarda de antemano.
    ...(g.adjuntoKey ? { adjuntoUrl: await urlFirmadaPdf(g.adjuntoKey, g.adjuntoNombre ?? 'comprobante.pdf'), adjuntoNombre: g.adjuntoNombre } : {}),
  }
}

/** Llama al servicio con la misma referencia hasta `maxIntentos` veces y deja el resultado en el registro. */
async function despachar(envio: EnvioWhatsApp, maxIntentos: number): Promise<EnvioWhatsApp> {
  const guardada = envio.solicitud as unknown as SolicitudGuardada
  let actual = envio
  for (let intento = 0; intento < maxIntentos; intento++) {
    if (intento > 0) await new Promise((r) => setTimeout(r, ESPERAS_MS[Math.min(intento - 1, ESPERAS_MS.length - 1)]))
    const resultado = await enviarAviso(await armarSolicitud(guardada, envio.referenciaExterna))
    const base = { intentos: { increment: 1 } }
    if (resultado.tipo === 'ENVIADO') return prisma.envioWhatsApp.update({ where: { id: envio.id }, data: { ...base, estado: 'ENVIADO', envioId: resultado.envioId, error: null } })
    if (resultado.tipo === 'FALLIDO') return prisma.envioWhatsApp.update({ where: { id: envio.id }, data: { ...base, estado: 'FALLIDO', error: resultado.error } })
    if (resultado.tipo === 'SIN_CONSENTIMIENTO') return prisma.envioWhatsApp.update({ where: { id: envio.id }, data: { ...base, estado: 'SIN_CONSENTIMIENTO', error: 'SIN_CONSENTIMIENTO' } })
    actual = await prisma.envioWhatsApp.update({ where: { id: envio.id }, data: { ...base, error: resultado.error } })
  }
  return actual
}

interface Registro {
  socioId: string
  membresiaId: string
  facturaId?: string
  tipo: TipoAvisoWhatsApp
  fechaFin: Date
  solicitud: Omit<SolicitudGuardada, 'topicoCodigo'>
  maxIntentos: number
}

/** `{idMembresía}:{fechaVencimiento aaaa-mm-dd}:{tipo}`: así el job diario puede correr varias veces sin duplicar. */
const referencia = (membresiaId: string, fechaFin: Date, tipo: TipoAvisoWhatsApp) => `${membresiaId}:${textoFecha(fechaFin)}:${tipo}`

async function registrarYEnviar(r: Registro): Promise<EnvioWhatsApp> {
  const referenciaExterna = referencia(r.membresiaId, r.fechaFin, r.tipo)
  const solicitud = { topicoCodigo: TOPICO[r.tipo], ...r.solicitud } as unknown as Prisma.InputJsonValue
  const envio = await prisma.envioWhatsApp.upsert({
    where: { referenciaExterna },
    update: {},
    create: { socioId: r.socioId, membresiaId: r.membresiaId, facturaId: r.facturaId, tipo: r.tipo, referenciaExterna, solicitud },
  })
  if (TERMINALES.includes(envio.estado)) return envio
  return despachar(envio, r.maxIntentos)
}

// ---------------------------------------------------------------------------
// Avisos de la venta
// ---------------------------------------------------------------------------

/**
 * Bienvenida o renovación tras vender una membresía. Nunca lanza: un fallo de WhatsApp no debe afectar la venta.
 * Un solo intento en línea; si el servicio no responde queda PENDIENTE y lo retoma la tarea diaria.
 */
export async function avisarBienvenida(membresiaId: string): Promise<void> {
  try {
    if (!(await avisosActivos())) return
    const m = await prisma.membresia.findUnique({ where: { id: membresiaId }, include: { socio: true, plan: true } })
    if (!m || m.anulada || !socioAvisable(m.socio)) return
    const anteriores = await prisma.membresia.count({ where: { socioId: m.socioId, anulada: false, id: { not: m.id } } })
    await registrarYEnviar({
      socioId: m.socioId,
      membresiaId: m.id,
      tipo: 'BIENVENIDA',
      fechaFin: m.fechaFin,
      maxIntentos: 1,
      solicitud: {
        telefono: m.socio.celular,
        variables: {
          nombre: primerNombre(m.socio.nombre),
          tipo_registro: anteriores === 0 ? 'matrícula' : 'renovación',
          negocio: await negocioNombre(),
          plan: variable(m.plan.nombre),
          fecha_vencimiento: fechaDMA(m.fechaFin),
        },
      },
    })
  } catch (e) {
    console.error('[whatsapp] bienvenida', membresiaId, e instanceof Error ? e.message : e)
  }
}

/** Comprobante con el PDF adjunto, para la membresía recién vendida (boleta o factura). Nunca lanza. */
export async function avisarComprobante(membresiaId: string): Promise<void> {
  try {
    if (!(await avisosActivos()) || !almacenamientoConfigurado()) return
    const m = await prisma.membresia.findUnique({ where: { id: membresiaId }, include: { socio: true, factura: { include: { items: true } } } })
    const f = m?.factura
    if (!m || !f || m.anulada || !socioAvisable(m.socio)) return
    // La nota de despacho es interna: no es un comprobante electrónico.
    if ((f.tipo !== 'BOLETA' && f.tipo !== 'FACTURA') || !f.numeracionComprobante) return

    const config = await obtenerConfiguracion()
    const adjuntoKey = await guardarPdfComprobante(f.id, await generarPdfDeFactura(f, config))
    await registrarYEnviar({
      socioId: m.socioId,
      membresiaId: m.id,
      facturaId: f.id,
      tipo: 'COMPROBANTE',
      fechaFin: m.fechaFin,
      maxIntentos: 1,
      solicitud: {
        telefono: m.socio.celular,
        adjuntoKey,
        adjuntoNombre: `${f.tipo === 'BOLETA' ? 'boleta' : 'factura'}_${f.numeracionComprobante}.pdf`.replace(/[^\w.-]/g, '_'),
        variables: {
          nombre: primerNombre(m.socio.nombre),
          numero_comprobante: variable(f.numeracionComprobante),
          monto: f.total.toFixed(2),
          negocio: await negocioNombre(),
        },
      },
    })
  } catch (e) {
    console.error('[whatsapp] comprobante', membresiaId, e instanceof Error ? e.message : e)
  }
}

// ---------------------------------------------------------------------------
// Tarea diaria (08:00 Lima)
// ---------------------------------------------------------------------------

export interface ResumenAvisos {
  omitido?: string
  candidatos: number
  enviados: number
  fallidos: number
  sinConsentimiento: number
  pendientes: number
  yaResueltos: number
  reintentados: number
}

/**
 * Avisa a quienes vencen en 3 días y hoy (solo con consentimiento y sin una renovación ya pagada). Se puede correr varias
 * veces el mismo día: la referencia evita duplicados. Primero reintenta los pendientes de envíos anteriores.
 */
export async function ejecutarAvisosVencimiento(): Promise<ResumenAvisos> {
  const resumen: ResumenAvisos = { candidatos: 0, enviados: 0, fallidos: 0, sinConsentimiento: 0, pendientes: 0, yaResueltos: 0, reintentados: 0 }
  if (!(await avisosActivos())) return { ...resumen, omitido: 'WhatsApp desactivado en Ajustes o servicio sin configurar' }
  const slug = process.env.NOTIF_PROMOS_SLUG
  if (!slug) return { ...resumen, omitido: 'Falta NOTIF_PROMOS_SLUG' }

  const inicio = Date.now()
  const sinTiempo = () => Date.now() - inicio > PRESUPUESTO_MS
  const contar = (e: EnvioWhatsApp) => {
    if (e.estado === 'ENVIADO') resumen.enviados++
    else if (e.estado === 'FALLIDO') resumen.fallidos++
    else if (e.estado === 'SIN_CONSENTIMIENTO') resumen.sinConsentimiento++
    else resumen.pendientes++
  }

  // 1) Pendientes de corridas anteriores (error transitorio): misma referencia.
  const pendientes = await prisma.envioWhatsApp.findMany({
    where: { estado: 'PENDIENTE', creadoAt: { gte: new Date(Date.now() - PLAZO_PENDIENTE_MS) } },
    orderBy: { creadoAt: 'asc' },
  })
  for (const p of pendientes) {
    if (sinTiempo()) break
    const socio = await prisma.socio.findUnique({ where: { id: p.socioId } })
    if (!socio || !socioAvisable(socio)) continue
    contar(await despachar(p, ESPERAS_MS.length + 1))
    resumen.reintentados++
  }

  // 2) Vencimientos de dentro de 3 días y de hoy. De a uno: el servicio no tiene endpoint masivo.
  const hoy = hoyFecha()
  const negocio = await negocioNombre()
  for (const { dias, tipo } of [{ dias: 3, tipo: 'D3' }, { dias: 0, tipo: 'D0' }] as const) {
    const membresias = await prisma.membresia.findMany({
      where: {
        anulada: false,
        fechaFin: sumarDias(hoy, dias),
        socio: { activo: true, consentimientoWhatsApp: true, bajaVoluntariaWhatsApp: false, celular: { not: null } },
      },
      include: { plan: true, socio: { include: { membresias: { select: { fechaFin: true, anulada: true } } } } },
      orderBy: { creadoAt: 'asc' },
    })
    for (const m of membresias) {
      // Ya renovó (hay otra membresía que termina después): no hay nada que avisar.
      if (m.socio.membresias.some((o) => !o.anulada && o.fechaFin > m.fechaFin)) continue
      resumen.candidatos++
      const existente = await prisma.envioWhatsApp.findUnique({ where: { referenciaExterna: referencia(m.id, m.fechaFin, tipo) } })
      if (existente) {
        // Los PENDIENTES ya se reintentaron en el paso 1.
        if (existente.estado !== 'PENDIENTE') resumen.yaResueltos++
        continue
      }
      if (sinTiempo()) continue
      const nombre = primerNombre(m.socio.nombre)
      const plan = variable(m.plan.nombre)
      try {
        contar(
          await registrarYEnviar({
            socioId: m.socioId,
            membresiaId: m.id,
            tipo,
            fechaFin: m.fechaFin,
            maxIntentos: ESPERAS_MS.length + 1,
            solicitud: {
              telefono: m.socio.celular!,
              botonUrlSufijo: slug,
              variables: tipo === 'D3' ? { nombre, plan, negocio, fecha_vencimiento: fechaDMA(m.fechaFin) } : { nombre, plan, negocio },
            },
          }),
        )
      } catch (e) {
        console.error('[whatsapp] vencimiento', m.id, e instanceof Error ? e.message : e)
        resumen.pendientes++
      }
    }
  }
  return resumen
}

// ---------------------------------------------------------------------------
// Consentimiento
// ---------------------------------------------------------------------------

export type SincronizacionConsentimiento = 'OK' | 'OMITIDO' | 'BAJA_VOLUNTARIA' | 'ERROR'

/**
 * Informa al servicio el consentimiento del socio. Si el socio se dio de baja por WhatsApp el servicio responde 409 y
 * FitHub no puede reactivarlo: se marca la baja y se quita el consentimiento local.
 */
export async function sincronizarConsentimiento(socioId: string, telefono: string | null, aceptado: boolean, origen: string): Promise<SincronizacionConsentimiento> {
  if (!telefono || !(await avisosActivos())) return 'OMITIDO'
  const r = await enviarConsentimiento(telefono, aceptado, origen)
  if (r.tipo === 'OK') return 'OK'
  if (r.tipo === 'BAJA_VOLUNTARIA') {
    await prisma.socio.update({
      where: { id: socioId },
      data: { bajaVoluntariaWhatsApp: true, consentimientoWhatsApp: false, consentimientoWhatsAppAt: new Date(), consentimientoWhatsAppOrigen: 'BAJA_VOLUNTARIA' },
    })
    return 'BAJA_VOLUNTARIA'
  }
  console.error('[whatsapp] consentimiento', socioId, r.error)
  return 'ERROR'
}
