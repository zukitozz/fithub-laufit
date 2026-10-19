'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Plus, Search } from 'lucide-react'
import { SOCIO_VACIO, SocioFormModal } from '@/components/SocioFormModal'
import { Spinner } from '@/components/Spinner'
import { VentaMembresiaModal } from '@/components/VentaMembresiaModal'
import { Avatar, EstadoBadge, fechaCorta, fetcher, textoDias } from '@/components/ui'

interface Fila {
  id: string
  nombre: string
  tipoDocumento: string
  numeroDocumento: string
  celular: string | null
  fotoUrl: string | null
  estado: string
  plan: string | null
  diasRestantes: number | null
  fechaFin: string | null
  programada: boolean
}

export default function SociosPage() {
  const [q, setQ] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)
  const [nuevo, setNuevo] = useState(false)
  const [venta, setVenta] = useState<{ id: string; nombre: string } | null>(null)

  // Espera a que se deje de escribir antes de consultar.
  useEffect(() => {
    const id = setTimeout(() => {
      setBusqueda(q.trim())
      setPagina(1)
    }, 300)
    return () => clearTimeout(id)
  }, [q])

  const { data, error, mutate, isLoading } = useSWR<{ items: Fila[]; total: number; porPagina: number }>(
    `/api/socios?pagina=${pagina}${busqueda ? `&q=${encodeURIComponent(busqueda)}` : ''}`,
    fetcher,
    { keepPreviousData: true },
  )
  const paginas = data ? Math.max(1, Math.ceil(data.total / data.porPagina)) : 1

  return (
    <div className="p-4 md:p-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Socios</p>
          <h1 className="page-heading text-4xl">Socios</h1>
        </div>
        <button type="button" onClick={() => setNuevo(true)} className="btn-brand"><Plus size={18} /> Nuevo socio</button>
      </header>

      <div className="relative mb-4 max-w-md">
        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, documento o celular" aria-label="Buscar socio" className="field pl-10" />
      </div>

      {error && <p role="alert" className="mb-3 rounded-xl bg-laufit-50 px-4 py-2 text-sm font-semibold text-laufit-700">{String(error.message)}</p>}

      <div className="card-surface overflow-x-auto p-0">
        <table className="w-full min-w-[640px]">
          <thead className="border-b border-ink-100">
            <tr>
              <th className="th">Socio</th>
              <th className="th">Documento</th>
              <th className="th">Plan</th>
              <th className="th">Estado</th>
              <th className="th">Vence</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {isLoading && (
              <tr><td colSpan={6} className="td text-center text-ink-500"><Spinner /> Cargando…</td></tr>
            )}
            {data?.items.map((s) => (
              <tr key={s.id} className="hover:bg-ink-50">
                <td className="td">
                  <Link href={`/socios/${s.id}`} className="flex items-center gap-3 font-semibold text-ink-900 hover:text-laufit-600">
                    <Avatar nombre={s.nombre} url={s.fotoUrl} className="h-10 w-10 text-sm" />
                    {s.nombre}
                  </Link>
                </td>
                <td className="td text-ink-500">{s.tipoDocumento} {s.numeroDocumento}</td>
                <td className="td">{s.plan ?? '—'}</td>
                <td className="td"><EstadoBadge estado={s.estado} /></td>
                <td className="td">
                  {fechaCorta(s.fechaFin)}
                  <span className="block text-xs text-ink-400">{s.estado === 'SIN_MEMBRESIA' ? '' : textoDias(s.diasRestantes)}</span>
                </td>
                <td className="td text-right">
                  <button type="button" onClick={() => setVenta({ id: s.id, nombre: s.nombre })} className="btn-ghost btn-sm">
                    {s.estado === 'SIN_MEMBRESIA' ? 'Vender' : 'Renovar'}
                  </button>
                </td>
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr><td colSpan={6} className="td py-10 text-center text-ink-500">{busqueda ? 'Sin resultados para esa búsqueda.' : 'Aún no hay socios registrados.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {data && paginas > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Paginación">
          <span className="text-ink-500">{data.total} socios · página {pagina} de {paginas}</span>
          <div className="flex gap-2">
            <button type="button" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)} className="btn-ghost btn-sm">Anterior</button>
            <button type="button" disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)} className="btn-ghost btn-sm">Siguiente</button>
          </div>
        </nav>
      )}

      {nuevo && (
        <SocioFormModal
          inicial={SOCIO_VACIO}
          onClose={() => setNuevo(false)}
          onGuardado={(id, nombre) => {
            setNuevo(false)
            void mutate()
            setVenta({ id, nombre }) // un socio nuevo casi siempre se matricula de inmediato
          }}
        />
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
