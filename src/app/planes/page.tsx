'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Plus } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { api, fetcher, soles } from '@/components/ui'

interface Plan {
  id?: string
  nombre: string
  duracion: number
  unidad: 'MESES' | 'DIAS'
  precio: number
  matricula: number
  esPaseDiario: boolean
  activo: boolean
  orden: number
}

const NUEVO: Plan = { nombre: '', duracion: 1, unidad: 'MESES', precio: 0, matricula: 0, esPaseDiario: false, activo: true, orden: 0 }

export default function PlanesPage() {
  const toast = useToast()
  const { data, error, mutate } = useSWR<Plan[]>('/api/planes', fetcher)
  const [editando, setEditando] = useState<Plan | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [errorForm, setErrorForm] = useState<string | null>(null)

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!editando) return
    setEnviando(true)
    setErrorForm(null)
    const r = await api(editando.id ? `/api/planes/${editando.id}` : '/api/planes', { method: editando.id ? 'PATCH' : 'POST', body: editando })
    setEnviando(false)
    if (!r.ok) return setErrorForm(r.error)
    toast.success('Plan guardado')
    setEditando(null)
    void mutate()
  }

  return (
    <div className="p-4 md:p-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Catálogo</p>
          <h1 className="page-heading text-4xl">Planes</h1>
          <p className="text-sm text-ink-500">Precios con IGV incluido. Cambiar un precio no afecta a las membresías ya vendidas.</p>
        </div>
        <button type="button" onClick={() => setEditando({ ...NUEVO })} className="btn-brand"><Plus size={18} /> Nuevo plan</button>
      </header>

      {error && <p role="alert" className="mb-3 text-danger-700">{String(error.message)}</p>}
      <div className="card-surface overflow-x-auto p-0">
        <table className="w-full min-w-[560px]">
          <thead className="border-b border-ink-100"><tr><th className="th">Plan</th><th className="th">Duración</th><th className="th">Precio</th><th className="th">Matrícula</th><th className="th">Estado</th><th className="th" /></tr></thead>
          <tbody className="divide-y divide-ink-100">
            {!data && <tr><td colSpan={6} className="td text-center"><Spinner /></td></tr>}
            {data?.map((p) => (
              <tr key={p.id} className={p.activo ? '' : 'opacity-50'}>
                <td className="td font-semibold">{p.nombre}</td>
                <td className="td">{p.duracion} {p.unidad === 'MESES' ? (p.duracion === 1 ? 'mes' : 'meses') : (p.duracion === 1 ? 'día' : 'días')}</td>
                <td className="td">{soles(p.precio)}</td>
                <td className="td">{p.matricula > 0 ? soles(p.matricula) : '—'}</td>
                <td className="td">{p.activo ? <span className="badge bg-emerald-100 text-emerald-800">Activo</span> : <span className="badge bg-ink-100 text-ink-500">Inactivo</span>}</td>
                <td className="td text-right"><button type="button" onClick={() => setEditando(p)} className="btn-ghost btn-sm">Editar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editando && (
        <Modal title={editando.id ? 'Editar plan' : 'Nuevo plan'} onClose={() => setEditando(null)}>
          <form onSubmit={guardar} className="space-y-4">
            <div>
              <label htmlFor="pnombre" className="label">Nombre</label>
              <input id="pnombre" required value={editando.nombre} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} className="field" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="pdur" className="label">Duración</label>
                <input id="pdur" type="number" min={1} required value={editando.duracion} onChange={(e) => setEditando({ ...editando, duracion: Number(e.target.value) })} className="field" />
              </div>
              <div>
                <label htmlFor="puni" className="label">Unidad</label>
                <select id="puni" value={editando.unidad} onChange={(e) => setEditando({ ...editando, unidad: e.target.value as 'MESES' | 'DIAS' })} className="field">
                  <option value="MESES">Meses</option>
                  <option value="DIAS">Días</option>
                </select>
              </div>
              <div>
                <label htmlFor="pprecio" className="label">Precio (S/)</label>
                <input id="pprecio" type="number" min={0} step="0.01" required value={editando.precio} onChange={(e) => setEditando({ ...editando, precio: Number(e.target.value) })} className="field" />
              </div>
              <div>
                <label htmlFor="pmat" className="label">Matrícula (S/)</label>
                <input id="pmat" type="number" min={0} step="0.01" value={editando.matricula} onChange={(e) => setEditando({ ...editando, matricula: Number(e.target.value) })} className="field" />
              </div>
            </div>
            <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={editando.activo} onChange={(e) => setEditando({ ...editando, activo: e.target.checked })} className="h-5 w-5 accent-brand-600" /> Plan activo (se puede vender)</label>
            {errorForm && <p role="alert" className="rounded-xl bg-danger-50 px-4 py-2 text-sm font-semibold text-danger-700">{errorForm}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditando(null)} className="btn-ghost">Cancelar</button>
              <button type="submit" disabled={enviando} className="btn-brand">{enviando && <Spinner />} Guardar</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
