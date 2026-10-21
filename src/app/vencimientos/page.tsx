'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { MessageSquareText, Phone, Search } from 'lucide-react'
import { ContactoModal } from '@/components/ContactoModal'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { VentaMembresiaModal } from '@/components/VentaMembresiaModal'
import { Avatar, api, fechaCorta, fetcher, haceDias, textoDias } from '@/components/ui'

type Tab = 'hoy' | 'proximos' | 'vencidos' | 'pospuestos'

interface Item {
  socio: { id: string; nombre: string; tipoDocumento: string; numeroDocumento: string; celular: string | null; fotoUrl: string | null }
  plan: string
  fechaFin: string
  diasRestantes: number
  base: 'hoy' | 'proximos' | 'vencidos'
  pospuestoHasta: string | null
  visitas30: number
  ultimaVisita: string | null
  ultimoContacto: { creadoAt: string; nota: string; motivo: string; usuario: string } | null
}

interface Respuesta {
  tab: Tab
  conteos: Record<Tab, number>
  items: Item[]
}

interface Plan { id: string; nombre: string }

const TABS: { id: Tab; etiqueta: string; alerta: boolean }[] = [
  { id: 'hoy', etiqueta: 'Vencen hoy', alerta: true },
  { id: 'proximos', etiqueta: 'Próximos 7 días', alerta: false },
  { id: 'vencidos', etiqueta: 'Vencidos (30 días)', alerta: true },
  { id: 'pospuestos', etiqueta: 'Pospuestos', alerta: false },
]

const POSPONER = [
  { valor: '1', etiqueta: 'Mañana' },
  { valor: '3', etiqueta: 'En 3 días' },
  { valor: '7', etiqueta: 'En 1 semana' },
]

function colorDias(dias: number) {
  if (dias < 0) return 'text-danger-600'
  if (dias <= 1) return 'text-amber-600'
  return 'text-ink-900'
}

export default function VencimientosPage() {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('hoy')
  const [q, setQ] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [plan, setPlan] = useState('')
  const [venta, setVenta] = useState<{ id: string; nombre: string } | null>(null)
  const [contacto, setContacto] = useState<{ id: string; nombre: string } | null>(null)

  useEffect(() => {
    const id = setTimeout(() => setBusqueda(q.trim()), 300)
    return () => clearTimeout(id)
  }, [q])

  const params = new URLSearchParams({ tab })
  if (busqueda) params.set('q', busqueda)
  if (plan) params.set('plan', plan)
  const { data, error, mutate, isLoading } = useSWR<Respuesta>(`/api/vencimientos?${params}`, fetcher, { keepPreviousData: true, refreshInterval: 60_000 })
  const { data: planes } = useSWR<Plan[]>('/api/planes?activos=1', fetcher)

  async function posponer(socioId: string, dias: number) {
    const r = await api(`/api/socios/${socioId}/posponer`, { method: 'POST', body: { dias } })
    if (!r.ok) return toast.error(r.error)
    toast.success(dias === 0 ? 'Vuelve a la lista' : 'Recordatorio pospuesto')
    void mutate()
  }

  return (
    <div className="p-4 md:p-8">
      <header className="mb-5">
        <p className="eyebrow">Retención</p>
        <h1 className="page-heading text-4xl">Vencimientos</h1>
        <p className="text-sm text-ink-500">Quién vence o venció hace poco y todavía no renovó. Contáctalos antes de que dejen de venir.</p>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4" role="tablist" aria-label="Grupos de vencimientos">
        {TABS.map((t) => {
          const n = data?.conteos[t.id] ?? 0
          const activa = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activa}
              onClick={() => setTab(t.id)}
              className={`rounded-2xl border-2 px-4 py-3 text-left transition ${activa ? 'border-brand-600 bg-brand-50' : 'border-ink-100 bg-white hover:border-ink-300'}`}
            >
              <span className="block text-xs font-bold uppercase tracking-wide text-ink-500">{t.etiqueta}</span>
              <span className={`font-display text-4xl font-extrabold leading-none ${t.alerta && n > 0 ? 'text-danger-600' : 'text-ink-900'}`}>{data ? n : '–'}</span>
            </button>
          )
        })}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative w-full max-w-sm">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, DNI o celular" aria-label="Buscar socio" className="field pl-10" />
        </div>
        <select aria-label="Plan" value={plan} onChange={(e) => setPlan(e.target.value)} className="field w-48">
          <option value="">Todos los planes</option>
          {planes?.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </div>

      {error && <p role="alert" className="mb-3 rounded-xl bg-danger-50 px-4 py-2 text-sm font-semibold text-danger-700">{String(error.message)}</p>}
      {isLoading && !data && <p className="text-ink-500"><Spinner /> Cargando…</p>}

      {data && data.items.length === 0 && (
        <div className="card-surface py-12 text-center text-ink-500">
          <p className="font-display text-2xl font-bold text-ink-800">{busqueda || plan ? 'Sin resultados' : 'Todo al día'}</p>
          <p className="mt-1 text-sm">{busqueda || plan ? 'Prueba con otra búsqueda o plan.' : 'No hay socios en este grupo.'}</p>
        </div>
      )}

      <ul className="space-y-3">
        {data?.items.map((i) => (
          <li key={i.socio.id} className="card-surface">
            <div className="flex flex-wrap items-start gap-4">
              <Avatar nombre={i.socio.nombre} url={i.socio.fotoUrl} className="h-16 w-16 text-xl" />
              <div className="min-w-0 flex-1 basis-60">
                <Link href={`/socios/${i.socio.id}`} className="font-display text-2xl font-bold leading-tight text-ink-900 hover:text-brand-600">{i.socio.nombre}</Link>
                <p className="text-xs text-ink-400">{i.socio.tipoDocumento} {i.socio.numeroDocumento}{i.socio.celular && <> · {i.socio.celular}</>}</p>
                <p className="mt-1 text-sm text-ink-600">{i.plan} · vence {fechaCorta(i.fechaFin)}</p>
              </div>
              <div className="text-right">
                <p className={`font-display text-3xl font-bold leading-none ${colorDias(i.diasRestantes)}`}>{textoDias(i.diasRestantes)}</p>
                <p className="mt-1 text-xs text-ink-500">
                  {i.visitas30} {i.visitas30 === 1 ? 'visita' : 'visitas'} en 30 días · {i.ultimaVisita ? `vino ${haceDias(i.ultimaVisita)}` : 'sin visitas'}
                </p>
              </div>
            </div>

            {(i.ultimoContacto || i.pospuestoHasta) && (
              <div className="mt-3 space-y-1 rounded-xl bg-ink-50 px-3 py-2 text-sm">
                {i.ultimoContacto && (
                  <p className="flex items-start gap-2 text-ink-700">
                    <MessageSquareText size={15} className="mt-0.5 shrink-0 text-ink-400" />
                    <span><strong>{haceDias(i.ultimoContacto.creadoAt)}</strong> · {i.ultimoContacto.usuario}: {i.ultimoContacto.nota}</span>
                  </p>
                )}
                {i.pospuestoHasta && <p className="text-xs font-semibold text-amber-700">Vuelve a la lista el {fechaCorta(i.pospuestoHasta)}</p>}
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setVenta({ id: i.socio.id, nombre: i.socio.nombre })} className="btn-brand btn-sm">Renovar</button>
              {i.socio.celular ? (
                <a href={`tel:${i.socio.celular}`} className="btn-ghost btn-sm"><Phone size={14} /> Llamar</a>
              ) : (
                <span className="px-2 text-xs text-ink-400">Sin celular</span>
              )}
              <button type="button" onClick={() => setContacto({ id: i.socio.id, nombre: i.socio.nombre })} className="btn-ghost btn-sm">Registrar contacto</button>
              {i.pospuestoHasta ? (
                <button type="button" onClick={() => void posponer(i.socio.id, 0)} className="btn-ghost btn-sm">Quitar posposición</button>
              ) : (
                <select
                  aria-label={`Posponer a ${i.socio.nombre}`}
                  value=""
                  onChange={(e) => e.target.value && void posponer(i.socio.id, Number(e.target.value))}
                  className="btn-ghost btn-sm cursor-pointer"
                >
                  <option value="">Posponer…</option>
                  {POSPONER.map((p) => <option key={p.valor} value={p.valor}>{p.etiqueta}</option>)}
                </select>
              )}
            </div>
          </li>
        ))}
      </ul>

      {venta && (
        <VentaMembresiaModal
          socio={venta}
          onClose={() => setVenta(null)}
          onHecho={() => {
            setVenta(null)
            void mutate() // al renovar, sale de la lista
          }}
        />
      )}
      {contacto && (
        <ContactoModal
          socio={contacto}
          motivo="VENCIMIENTO"
          permitePosponer
          onClose={() => setContacto(null)}
          onHecho={() => {
            setContacto(null)
            void mutate()
          }}
        />
      )}
    </div>
  )
}
