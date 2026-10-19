'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { Cake, Check, Clock, HeartPulse, RefreshCw, UserX, Volume2, VolumeX } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { VentaMembresiaModal } from '@/components/VentaMembresiaModal'
import { Avatar, EstadoBadge, api, fechaCorta, fetcher, haceCuanto, horaLima, textoDias, useAhora } from '@/components/ui'

interface Tarjeta {
  id: string
  fechaHora: string
  origen: 'QR' | 'RECEPCION'
  validacion: 'PENDIENTE' | 'CONFIRMADA' | 'ANULADA'
  motivo: string | null
  fueraDeHorario: boolean
  socio: { id: string; nombre: string; tipoDocumento: string; documento: string; fotoUrl: string | null; condicionMedica: string | null; notas: string | null; cumpleHoy: boolean }
  estado: string
  plan: string | null
  diasRestantes: number | null
  fechaFin: string | null
  renovacionProgramada: boolean
  visitas30: number
  ultimaVisita: string | null
}

interface Feed {
  items: Tarjeta[]
  pendientes: number
  coaches: { id: string; nombre: string; presente: boolean; hora: string; tipo: 'ENTRADA' | 'SALIDA' }[]
}

const BORDE: Record<string, string> = {
  VIGENTE: 'border-emerald-500',
  POR_VENCER: 'border-amber-500',
  VENCIDA: 'border-laufit-600',
  SIN_MEMBRESIA: 'border-laufit-600',
}

function pitido() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
    osc.start()
    osc.stop(ctx.currentTime + 0.25)
  } catch {
    /* sin audio: el panel sigue funcionando */
  }
}

export default function IngresoPage() {
  const toast = useToast()
  const ahora = useAhora()
  const { data, error, mutate, isValidating } = useSWR<Feed>('/api/ingreso/feed', fetcher, { refreshInterval: 4000, revalidateOnFocus: true })
  const [sonido, setSonido] = useState(true)
  const [nuevos, setNuevos] = useState<Set<string>>(new Set())
  const vistos = useRef<Set<string> | null>(null)
  const [anulando, setAnulando] = useState<Tarjeta | null>(null)
  const [renovando, setRenovando] = useState<Tarjeta | null>(null)
  const [documento, setDocumento] = useState('')
  const [registrando, setRegistrando] = useState(false)

  // Detecta tarjetas nuevas para resaltarlas y avisar con un sonido corto (no en la primera carga).
  useEffect(() => {
    if (!data) return
    const ids = new Set(data.items.map((i) => i.id))
    if (vistos.current) {
      const llegadas = data.items.filter((i) => !vistos.current!.has(i.id)).map((i) => i.id)
      if (llegadas.length) {
        setNuevos(new Set(llegadas))
        if (sonido) pitido()
        setTimeout(() => setNuevos(new Set()), 6000)
      }
    }
    vistos.current = ids
  }, [data, sonido])

  async function confirmar(t: Tarjeta) {
    const r = await api(`/api/asistencias/${t.id}/validar`, { method: 'POST', body: { accion: 'CONFIRMAR' } })
    if (!r.ok) return toast.error(r.error)
    void mutate()
  }

  async function registrarManual(e: React.FormEvent) {
    e.preventDefault()
    setRegistrando(true)
    const r = await api<{ resultado: string; socio: { nombre: string } }>('/api/ingreso/manual', { method: 'POST', body: { tipoDocumento: 'DNI', numeroDocumento: documento } })
    setRegistrando(false)
    if (!r.ok) return toast.error(r.error)
    toast.success(r.data.resultado === 'DUPLICADO' ? `${r.data.socio.nombre} ya registró su ingreso` : `Ingreso de ${r.data.socio.nombre} registrado`)
    setDocumento('')
    void mutate()
  }

  const items = data?.items ?? []
  const activos = items.filter((i) => i.validacion !== 'ANULADA')

  return (
    <div className="p-4 md:p-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">En vivo</p>
          <h1 className="page-heading text-4xl">Ingresos de hoy</h1>
          <p className="text-sm text-ink-500">
            {activos.length} {activos.length === 1 ? 'ingreso' : 'ingresos'}
            {data && data.pendientes > 0 && <> · <strong className="text-laufit-600">{data.pendientes} por revisar</strong></>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form onSubmit={registrarManual} className="flex gap-2">
            <input
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
              inputMode="numeric"
              placeholder="DNI para registrar a mano"
              aria-label="DNI del socio"
              className="field w-52"
            />
            <button type="submit" disabled={registrando || !documento.trim()} className="btn-ghost">
              {registrando ? <Spinner /> : 'Registrar'}
            </button>
          </form>
          <button type="button" onClick={() => setSonido((s) => !s)} className="btn-ghost px-3" aria-label={sonido ? 'Silenciar avisos' : 'Activar avisos sonoros'} title={sonido ? 'Silenciar' : 'Activar sonido'}>
            {sonido ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button type="button" onClick={() => void mutate()} className="btn-ghost px-3" aria-label="Actualizar" title="Actualizar">
            <RefreshCw size={18} className={isValidating ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {data && data.coaches.length > 0 && (
        <section className="card-surface mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 py-3" aria-label="Coaches de hoy">
          <span className="text-xs font-bold uppercase tracking-wide text-ink-500">Coaches</span>
          {data.coaches.map((c) => (
            <span key={c.id} className="flex items-center gap-2 text-sm">
              <span className={`h-2.5 w-2.5 rounded-full ${c.presente ? 'bg-emerald-500' : 'bg-ink-300'}`} />
              <strong>{c.nombre}</strong>
              <span className="text-ink-500">{c.presente ? `entró ${horaLima(c.hora)}` : `salió ${horaLima(c.hora)}`}</span>
            </span>
          ))}
        </section>
      )}

      {error && <p role="alert" className="mb-4 rounded-xl bg-laufit-50 px-4 py-2 text-sm font-semibold text-laufit-700">No se pudo actualizar el panel: {String(error.message)}</p>}
      {!data && !error && <p className="flex items-center gap-2 text-ink-500"><Spinner /> Cargando…</p>}
      {data && items.length === 0 && (
        <div className="card-surface py-12 text-center text-ink-500">
          <p className="font-display text-2xl font-bold text-ink-800">Aún no hay ingresos hoy</p>
          <p className="mt-1 text-sm">Cuando un socio escanee el QR de la entrada, aparecerá aquí.</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {items.map((t) => {
          const anulada = t.validacion === 'ANULADA'
          const noVigente = t.estado === 'VENCIDA' || t.estado === 'SIN_MEMBRESIA'
          const antigua = (ahora - new Date(t.fechaHora).getTime()) / 60_000 > 10
          return (
            <article
              key={t.id}
              className={`card-surface border-l-8 ${anulada ? 'border-ink-300 opacity-60' : BORDE[t.estado] ?? 'border-ink-300'} ${nuevos.has(t.id) ? 'tarjeta-nueva ring-4 ring-laufit-200' : ''}`}
            >
              <div className="flex gap-4">
                <Avatar nombre={t.socio.nombre} url={t.socio.fotoUrl} className="h-28 w-28 text-3xl" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-display text-2xl font-bold leading-tight text-ink-900">{t.socio.nombre}</h2>
                    <EstadoBadge estado={t.estado} />
                  </div>
                  <p className="text-xs text-ink-400">{t.socio.tipoDocumento} {t.socio.documento}</p>

                  <p className={`mt-2 font-display text-3xl font-bold leading-none ${noVigente ? 'text-laufit-600' : t.estado === 'POR_VENCER' ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {t.estado === 'SIN_MEMBRESIA' ? 'Sin membresía' : textoDias(t.diasRestantes)}
                  </p>
                  <p className="mt-1 text-sm text-ink-600">
                    {t.plan ? <>{t.plan} · vence {fechaCorta(t.fechaFin)}</> : 'Sin plan registrado'}
                    {t.renovacionProgramada && <span className="badge ml-2 bg-sky-100 text-sky-800">Renovación pagada</span>}
                  </p>
                </div>
              </div>

              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
                <li className="flex items-center gap-1"><Clock size={13} /> Marcó {horaLima(t.fechaHora)} ({haceCuanto(t.fechaHora, ahora)}){t.origen === 'RECEPCION' && ' · en recepción'}</li>
                <li>{t.visitas30} {t.visitas30 === 1 ? 'visita' : 'visitas'} en 30 días</li>
                <li>{t.ultimaVisita ? `Última vez: ${fechaCorta(t.ultimaVisita)}` : 'Primera visita registrada'}</li>
                {t.fueraDeHorario && <li className="font-semibold text-amber-700">Fuera del horario de atención</li>}
              </ul>

              {(t.socio.cumpleHoy || t.socio.condicionMedica || t.socio.notas) && (
                <div className="mt-3 space-y-1 rounded-xl bg-ink-50 p-3 text-sm">
                  {t.socio.cumpleHoy && <p className="flex items-center gap-2 font-semibold text-laufit-700"><Cake size={16} /> ¡Hoy es su cumpleaños!</p>}
                  {t.socio.condicionMedica && <p className="flex items-start gap-2"><HeartPulse size={16} className="mt-0.5 shrink-0 text-laufit-600" /> {t.socio.condicionMedica}</p>}
                  {t.socio.notas && <p className="text-ink-600">{t.socio.notas}</p>}
                </div>
              )}

              {antigua && t.validacion === 'PENDIENTE' && (
                <p className="mt-3 text-xs font-semibold text-amber-700">Marcó hace más de 10 minutos: confirma que sigue en recepción.</p>
              )}

              <footer className="mt-4 flex flex-wrap items-center gap-2">
                {t.validacion === 'PENDIENTE' && (
                  <>
                    <button type="button" onClick={() => void confirmar(t)} className="btn-brand btn-sm"><Check size={15} /> Coincide</button>
                    <button type="button" onClick={() => setAnulando(t)} className="btn-ghost btn-sm"><UserX size={15} /> No coincide</button>
                  </>
                )}
                {t.validacion === 'CONFIRMADA' && <span className="badge bg-emerald-100 text-emerald-800"><Check size={13} className="mr-1" /> Confirmado</span>}
                {anulada && <span className="badge bg-ink-100 text-ink-600">Anulado: {t.motivo}</span>}
                {!anulada && (noVigente || t.estado === 'POR_VENCER') && !t.renovacionProgramada && (
                  <button type="button" onClick={() => setRenovando(t)} className="btn-ghost btn-sm ml-auto">Renovar</button>
                )}
              </footer>
            </article>
          )
        })}
      </div>

      {anulando && (
        <AnularModal
          tarjeta={anulando}
          onClose={() => setAnulando(null)}
          onHecho={() => {
            setAnulando(null)
            void mutate()
          }}
        />
      )}
      {renovando && (
        <VentaMembresiaModal
          socio={{ id: renovando.socio.id, nombre: renovando.socio.nombre }}
          onClose={() => setRenovando(null)}
          onHecho={() => {
            setRenovando(null)
            void mutate()
          }}
        />
      )}
    </div>
  )
}

function AnularModal({ tarjeta, onClose, onHecho }: { tarjeta: Tarjeta; onClose: () => void; onHecho: () => void }) {
  const toast = useToast()
  const [motivo, setMotivo] = useState('No coincide con la persona en recepción')
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    const r = await api(`/api/asistencias/${tarjeta.id}/validar`, { method: 'POST', body: { accion: 'ANULAR', motivo } })
    setEnviando(false)
    if (!r.ok) return toast.error(r.error)
    toast.success('Marcación anulada: no cuenta como asistencia')
    onHecho()
  }

  return (
    <Modal title="Anular marcación" onClose={onClose}>
      <form onSubmit={enviar} className="space-y-4">
        <p className="text-sm text-ink-600">
          Alguien marcó con el documento de <strong>{tarjeta.socio.nombre}</strong> pero no es la persona que está en recepción. La marca no contará como asistencia.
        </p>
        <div>
          <label htmlFor="motivo" className="label">Motivo</label>
          <input id="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} className="field" required minLength={3} />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
          <button type="submit" disabled={enviando} className="btn-brand">{enviando && <Spinner />} Anular</button>
        </div>
      </form>
    </Modal>
  )
}
