'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import useSWR from 'swr'
import { Plus } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { api, fetcher, horaLima } from '@/components/ui'

interface Coach { id?: string; nombre: string; tipoDocumento: 'DNI' | 'CE' | 'RUC'; numeroDocumento: string; celular: string; activo: boolean }
interface Marcacion { id: string; tipo: 'ENTRADA' | 'SALIDA'; fechaHora: string; origen: 'QR' | 'MANUAL'; anulada: boolean; observacion: string | null }
interface DiaCoach {
  fecha: string
  coaches: { id: string; nombre: string; marcaciones: Marcacion[]; resumen: { primeraEntrada: string | null; ultimaSalida: string | null; minutosTrabajados: number; incompleta: boolean } }[]
}

const NUEVO: Coach = { nombre: '', tipoDocumento: 'DNI', numeroDocumento: '', celular: '', activo: true }

const horas = (min: number) => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`

export default function CoachesPage() {
  const { data: session } = useSession()
  const toast = useToast()
  const esGerente = session?.user?.role === 'SUPERVISOR'
  const [fecha, setFecha] = useState('')
  const { data: dia, mutate: recargarDia } = useSWR<DiaCoach>(`/api/coaches/asistencia${fecha ? `?fecha=${fecha}` : ''}`, fetcher, { refreshInterval: 15_000 })
  const { data: coaches, mutate: recargarCoaches } = useSWR<(Coach & { id: string })[]>('/api/coaches', fetcher)
  const [editando, setEditando] = useState<Coach | null>(null)
  const [manual, setManual] = useState<{ coachId: string; nombre: string } | null>(null)
  const [anulando, setAnulando] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [tipoManual, setTipoManual] = useState<'ENTRADA' | 'SALIDA'>('ENTRADA')
  const [horaManual, setHoraManual] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardarCoach(e: React.FormEvent) {
    e.preventDefault()
    if (!editando) return
    setEnviando(true)
    setError(null)
    const r = await api(editando.id ? `/api/coaches/${editando.id}` : '/api/coaches', { method: editando.id ? 'PATCH' : 'POST', body: editando })
    setEnviando(false)
    if (!r.ok) return setError(r.error)
    toast.success('Coach guardado')
    setEditando(null)
    void recargarCoaches()
    void recargarDia()
  }

  async function marcarManual(e: React.FormEvent) {
    e.preventDefault()
    if (!manual) return
    setEnviando(true)
    setError(null)
    const fechaHora = horaManual ? new Date(`${dia?.fecha}T${horaManual}:00-05:00`).toISOString() : undefined
    const r = await api('/api/coaches/marcaciones', { method: 'POST', body: { coachId: manual.coachId, tipo: tipoManual, observacion: texto, fechaHora } })
    setEnviando(false)
    if (!r.ok) return setError(r.error)
    toast.success('Marcación registrada')
    setManual(null)
    setTexto('')
    setHoraManual('')
    void recargarDia()
  }

  async function anular(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    const r = await api(`/api/coaches/marcaciones/${anulando}/anular`, { method: 'POST', body: { motivo: texto } })
    setEnviando(false)
    if (!r.ok) return setError(r.error)
    toast.success('Marcación anulada')
    setAnulando(null)
    setTexto('')
    void recargarDia()
  }

  return (
    <div className="p-4 md:p-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Equipo</p>
          <h1 className="page-heading text-4xl">Coaches</h1>
          <p className="text-sm text-ink-500">Marcan entrada y salida escaneando el mismo QR de la entrada.</p>
        </div>
        {esGerente && <button type="button" onClick={() => { setError(null); setEditando({ ...NUEVO }) }} className="btn-brand"><Plus size={18} /> Nuevo coach</button>}
      </header>

      <section className="card-surface">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-2xl font-bold">Asistencia del día</h2>
          <input type="date" aria-label="Fecha" value={fecha || dia?.fecha || ''} onChange={(e) => setFecha(e.target.value)} className="field w-44" />
        </div>
        {!dia && <p className="text-ink-500"><Spinner /> Cargando…</p>}
        {dia && dia.coaches.length === 0 && <p className="text-sm text-ink-500">No hay coaches activos. {esGerente ? 'Crea el primero con “Nuevo coach”.' : 'Pídele al gerente que los registre.'}</p>}
        <div className="divide-y divide-ink-100">
          {dia?.coaches.map((c) => (
            <div key={c.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{c.nombre}</p>
                  <p className="text-xs text-ink-500">
                    {c.resumen.primeraEntrada ? <>Entró {horaLima(c.resumen.primeraEntrada)}{c.resumen.ultimaSalida && <> · salió {horaLima(c.resumen.ultimaSalida)}</>} · {horas(c.resumen.minutosTrabajados)}</> : 'Sin marcaciones'}
                    {c.resumen.incompleta && <span className="badge ml-2 bg-amber-100 text-amber-800">Sin salida</span>}
                  </p>
                </div>
                <button type="button" onClick={() => { setError(null); setTexto(''); setManual({ coachId: c.id, nombre: c.nombre }) }} className="btn-ghost btn-sm">Marcar a mano</button>
              </div>
              {c.marcaciones.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2 text-xs">
                  {c.marcaciones.map((m) => (
                    <li key={m.id} className={`flex items-center gap-1 rounded-lg px-2 py-1 ${m.anulada ? 'bg-ink-100 text-ink-400 line-through' : m.tipo === 'ENTRADA' ? 'bg-emerald-50 text-emerald-800' : 'bg-ink-100 text-ink-700'}`}>
                      {m.tipo === 'ENTRADA' ? '→' : '←'} {horaLima(m.fechaHora)} {m.origen === 'MANUAL' && '(manual)'}
                      {!m.anulada && <button type="button" onClick={() => { setError(null); setTexto(''); setAnulando(m.id) }} className="ml-1 font-bold text-laufit-600" aria-label="Anular marcación">×</button>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      {esGerente && (
        <section className="card-surface mt-5 overflow-x-auto p-0">
          <h2 className="px-5 pt-4 font-display text-2xl font-bold">Lista de coaches</h2>
          <table className="mt-2 w-full min-w-[480px]">
            <thead className="border-b border-ink-100"><tr><th className="th">Nombre</th><th className="th">Documento</th><th className="th">Celular</th><th className="th">Estado</th><th className="th" /></tr></thead>
            <tbody className="divide-y divide-ink-100">
              {coaches?.map((c) => (
                <tr key={c.id} className={c.activo ? '' : 'opacity-50'}>
                  <td className="td font-semibold">{c.nombre}</td>
                  <td className="td">{c.tipoDocumento} {c.numeroDocumento}</td>
                  <td className="td">{c.celular ?? '—'}</td>
                  <td className="td">{c.activo ? 'Activo' : 'Inactivo'}</td>
                  <td className="td text-right"><button type="button" onClick={() => { setError(null); setEditando({ ...c, celular: c.celular?.replace('+51', '') ?? '' }) }} className="btn-ghost btn-sm">Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {editando && (
        <Modal title={editando.id ? 'Editar coach' : 'Nuevo coach'} onClose={() => setEditando(null)}>
          <form onSubmit={guardarCoach} className="space-y-4">
            <div>
              <label htmlFor="cn" className="label">Nombre completo</label>
              <input id="cn" required value={editando.nombre} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} className="field" />
            </div>
            <div className="grid grid-cols-[10rem_1fr] gap-3">
              <div>
                <label htmlFor="ct" className="label">Documento</label>
                <select id="ct" value={editando.tipoDocumento} onChange={(e) => setEditando({ ...editando, tipoDocumento: e.target.value as Coach['tipoDocumento'] })} className="field">
                  <option value="DNI">DNI</option>
                  <option value="CE">Carnet de extranjería</option>
                  <option value="RUC">RUC</option>
                </select>
              </div>
              <div>
                <label htmlFor="cd" className="label">Número</label>
                <input id="cd" required value={editando.numeroDocumento} onChange={(e) => setEditando({ ...editando, numeroDocumento: e.target.value })} className="field" />
              </div>
            </div>
            <div>
              <label htmlFor="cc" className="label">Celular</label>
              <input id="cc" value={editando.celular} onChange={(e) => setEditando({ ...editando, celular: e.target.value })} className="field" inputMode="tel" />
            </div>
            <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={editando.activo} onChange={(e) => setEditando({ ...editando, activo: e.target.checked })} className="h-5 w-5 accent-laufit-600" /> Activo</label>
            {error && <p role="alert" className="rounded-xl bg-laufit-50 px-4 py-2 text-sm font-semibold text-laufit-700">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditando(null)} className="btn-ghost">Cancelar</button>
              <button type="submit" disabled={enviando} className="btn-brand">{enviando && <Spinner />} Guardar</button>
            </div>
          </form>
        </Modal>
      )}

      {manual && (
        <Modal title={`Marcación manual · ${manual.nombre}`} onClose={() => setManual(null)}>
          <form onSubmit={marcarManual} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="mt" className="label">Tipo</label>
                <select id="mt" value={tipoManual} onChange={(e) => setTipoManual(e.target.value as 'ENTRADA' | 'SALIDA')} className="field">
                  <option value="ENTRADA">Entrada</option>
                  <option value="SALIDA">Salida</option>
                </select>
              </div>
              <div>
                <label htmlFor="mh" className="label">Hora (vacío = ahora)</label>
                <input id="mh" type="time" value={horaManual} onChange={(e) => setHoraManual(e.target.value)} className="field" />
              </div>
            </div>
            <div>
              <label htmlFor="mm" className="label">Motivo</label>
              <input id="mm" required minLength={3} value={texto} onChange={(e) => setTexto(e.target.value)} className="field" placeholder="Olvidó marcar, falló su celular…" />
            </div>
            {error && <p role="alert" className="rounded-xl bg-laufit-50 px-4 py-2 text-sm font-semibold text-laufit-700">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setManual(null)} className="btn-ghost">Cancelar</button>
              <button type="submit" disabled={enviando} className="btn-brand">{enviando && <Spinner />} Registrar</button>
            </div>
          </form>
        </Modal>
      )}

      {anulando && (
        <Modal title="Anular marcación" onClose={() => setAnulando(null)}>
          <form onSubmit={anular} className="space-y-4">
            <div>
              <label htmlFor="am" className="label">Motivo</label>
              <input id="am" required minLength={3} value={texto} onChange={(e) => setTexto(e.target.value)} className="field" />
            </div>
            {error && <p role="alert" className="rounded-xl bg-laufit-50 px-4 py-2 text-sm font-semibold text-laufit-700">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAnulando(null)} className="btn-ghost">Cancelar</button>
              <button type="submit" disabled={enviando} className="btn-brand">{enviando && <Spinner />} Anular</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
