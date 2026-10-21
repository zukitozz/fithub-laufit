'use client'

import { useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Cake, Check, Phone } from 'lucide-react'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { VentaMembresiaModal } from '@/components/VentaMembresiaModal'
import { Avatar, EstadoBadge, api, fechaCorta, fetcher, textoDias } from '@/components/ui'

type Tab = 'hoy' | 'proximos' | 'mes'

interface Item {
  socio: { id: string; nombre: string; tipoDocumento: string; numeroDocumento: string; celular: string | null; fotoUrl: string | null }
  fecha: string
  dias: number
  edad: number
  estado: string
  plan: string | null
  diasRestantes: number | null
  fechaFin: string | null
  saludado: boolean
}

interface Respuesta {
  tab: Tab
  conteos: Record<Tab, number>
  sinFecha: number
  items: Item[]
}

const TABS: { id: Tab; etiqueta: string }[] = [
  { id: 'hoy', etiqueta: 'Hoy' },
  { id: 'proximos', etiqueta: 'Próximos 7 días' },
  { id: 'mes', etiqueta: 'Este mes' },
]

function cuando(dias: number, fecha: string) {
  if (dias === 0) return 'hoy'
  if (dias === 1) return 'mañana'
  if (dias === -1) return 'ayer'
  if (dias < 0) return `el ${fechaCorta(fecha).slice(0, 5)} (hace ${-dias} días)`
  return `el ${fechaCorta(fecha).slice(0, 5)} (en ${dias} días)`
}

export default function CumpleanosPage() {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('hoy')
  const { data, error, mutate, isLoading } = useSWR<Respuesta>(`/api/cumpleanos?tab=${tab}`, fetcher, { keepPreviousData: true, refreshInterval: 120_000 })
  const [venta, setVenta] = useState<{ id: string; nombre: string } | null>(null)
  const [guardando, setGuardando] = useState<string | null>(null)

  async function saludar(socioId: string) {
    setGuardando(socioId)
    const r = await api(`/api/socios/${socioId}/contactos`, { method: 'POST', body: { motivo: 'CUMPLEANOS', nota: 'Saludo de cumpleaños' } })
    setGuardando(null)
    if (!r.ok) return toast.error(r.error)
    toast.success('Marcado como saludado')
    void mutate()
  }

  return (
    <div className="p-4 md:p-8">
      <header className="mb-5">
        <p className="eyebrow">Socios</p>
        <h1 className="page-heading text-4xl">Cumpleaños</h1>
        <p className="text-sm text-ink-500">Un saludo a tiempo fideliza. Y si su membresía está por vencer, es buen momento para renovar.</p>
      </header>

      <div className="mb-4 grid grid-cols-3 gap-3" role="tablist" aria-label="Periodo">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-2xl border-2 px-4 py-3 text-left transition ${tab === t.id ? 'border-brand-600 bg-brand-50' : 'border-ink-100 bg-white hover:border-ink-300'}`}
          >
            <span className="block text-xs font-bold uppercase tracking-wide text-ink-500">{t.etiqueta}</span>
            <span className={`font-display text-4xl font-extrabold leading-none ${t.id === 'hoy' && (data?.conteos.hoy ?? 0) > 0 ? 'text-brand-600' : 'text-ink-900'}`}>{data ? data.conteos[t.id] : '–'}</span>
          </button>
        ))}
      </div>

      {error && <p role="alert" className="mb-3 rounded-xl bg-danger-50 px-4 py-2 text-sm font-semibold text-danger-700">{String(error.message)}</p>}
      {isLoading && !data && <p className="text-ink-500"><Spinner /> Cargando…</p>}

      {data && data.items.length === 0 && (
        <div className="card-surface py-12 text-center text-ink-500">
          <p className="font-display text-2xl font-bold text-ink-800">Nadie cumple años en este periodo</p>
        </div>
      )}

      <ul className="space-y-3">
        {data?.items.map((i) => {
          const necesitaRenovar = ['POR_VENCER', 'VENCIDA', 'SIN_MEMBRESIA'].includes(i.estado)
          return (
            <li key={i.socio.id} className={`card-surface ${i.dias === 0 && tab !== 'mes' ? 'border-brand-300 bg-brand-50/40' : ''}`}>
              <div className="flex flex-wrap items-start gap-4">
                <Avatar nombre={i.socio.nombre} url={i.socio.fotoUrl} className="h-16 w-16 text-xl" />
                <div className="min-w-0 flex-1 basis-60">
                  <Link href={`/socios/${i.socio.id}`} className="font-display text-2xl font-bold leading-tight text-ink-900 hover:text-brand-600">{i.socio.nombre}</Link>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-brand-700"><Cake size={16} /> Cumple {i.edad} {cuando(i.dias, i.fecha)}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-600">
                    <EstadoBadge estado={i.estado} />
                    {i.plan && <span>{i.plan}{i.diasRestantes !== null && <> · {textoDias(i.diasRestantes)}</>}</span>}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {i.saludado ? (
                  <span className="badge bg-emerald-100 text-emerald-800"><Check size={13} className="mr-1" /> Saludado</span>
                ) : (
                  <button type="button" disabled={guardando === i.socio.id} onClick={() => void saludar(i.socio.id)} className="btn-brand btn-sm">
                    {guardando === i.socio.id ? <Spinner /> : <Check size={14} />} Marcar saludado
                  </button>
                )}
                {i.socio.celular && <a href={`tel:${i.socio.celular}`} className="btn-ghost btn-sm"><Phone size={14} /> Llamar</a>}
                {necesitaRenovar && <button type="button" onClick={() => setVenta({ id: i.socio.id, nombre: i.socio.nombre })} className="btn-ghost btn-sm">Renovar</button>}
                <Link href={`/socios/${i.socio.id}`} className="btn-ghost btn-sm">Ver ficha</Link>
              </div>
            </li>
          )
        })}
      </ul>

      {data && data.sinFecha > 0 && (
        <p className="mt-4 text-xs text-ink-400">{data.sinFecha} {data.sinFecha === 1 ? 'socio no tiene' : 'socios no tienen'} fecha de nacimiento registrada y no aparecen aquí.</p>
      )}

      {venta && (
        <VentaMembresiaModal
          socio={venta}
          onClose={() => setVenta(null)}
          onHecho={() => {
            setVenta(null)
            void mutate()
          }}
        />
      )}
    </div>
  )
}
