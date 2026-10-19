'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { Plus, Search } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { api, fetcher, soles } from '@/components/ui'

interface Producto {
  id: string
  nombre: string
  categoria: string | null
  codigoBarras: string | null
  precioVenta: number
  precioCosto: number | null
  stock: number
  alertaStock: number
  controlaStock: boolean
  activo: boolean
}

interface Form {
  id?: string
  nombre: string
  categoria: string
  codigoBarras: string
  precioVenta: string
  precioCosto: string
  stockInicial: string
  alertaStock: string
  controlaStock: boolean
  activo: boolean
}

const NUEVO: Form = { nombre: '', categoria: '', codigoBarras: '', precioVenta: '', precioCosto: '', stockInicial: '0', alertaStock: '5', controlaStock: true, activo: true }

type Movimiento = { producto: Producto; tipo: 'ENTRADA' | 'AJUSTE' }

export default function ProductosPage() {
  const toast = useToast()
  const { data, error, mutate } = useSWR<Producto[]>('/api/productos', fetcher)
  const [q, setQ] = useState('')
  const [form, setForm] = useState<Form | null>(null)
  const [mov, setMov] = useState<Movimiento | null>(null)
  const [cantidad, setCantidad] = useState('')
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [errorForm, setErrorForm] = useState<string | null>(null)

  const categorias = useMemo(() => [...new Set((data ?? []).map((p) => p.categoria).filter((c): c is string => Boolean(c)))].sort(), [data])
  const filtrados = (data ?? []).filter((p) => {
    const t = q.trim().toLowerCase()
    return !t || p.nombre.toLowerCase().includes(t) || (p.codigoBarras ?? '').includes(t) || (p.categoria ?? '').toLowerCase().includes(t)
  })
  const bajos = (data ?? []).filter((p) => p.activo && p.controlaStock && p.stock <= p.alertaStock).length

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    setEnviando(true)
    setErrorForm(null)
    const { id, ...cuerpo } = form
    const r = await api(id ? `/api/productos/${id}` : '/api/productos', { method: id ? 'PATCH' : 'POST', body: cuerpo })
    setEnviando(false)
    if (!r.ok) return setErrorForm(r.error)
    toast.success(id ? 'Producto actualizado' : 'Producto creado')
    setForm(null)
    void mutate()
  }

  async function moverStock(e: React.FormEvent) {
    e.preventDefault()
    if (!mov) return
    setEnviando(true)
    setErrorForm(null)
    const r = await api(`/api/productos/${mov.producto.id}/stock`, { method: 'POST', body: { tipo: mov.tipo, cantidad: Number(cantidad), motivo } })
    setEnviando(false)
    if (!r.ok) return setErrorForm(r.error)
    toast.success(mov.tipo === 'ENTRADA' ? 'Stock ingresado' : 'Stock ajustado')
    setMov(null)
    void mutate()
  }

  function abrirMovimiento(producto: Producto, tipo: Movimiento['tipo']) {
    setErrorForm(null)
    setCantidad(tipo === 'AJUSTE' ? String(producto.stock) : '')
    setMotivo('')
    setMov({ producto, tipo })
  }

  return (
    <div className="p-4 md:p-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Market</p>
          <h1 className="page-heading text-4xl">Productos</h1>
          <p className="text-sm text-ink-500">
            Precios con IGV incluido.{bajos > 0 && <strong className="ml-1 text-laufit-600">{bajos} con stock bajo.</strong>}
          </p>
        </div>
        <button type="button" onClick={() => { setErrorForm(null); setForm({ ...NUEVO }) }} className="btn-brand"><Plus size={18} /> Nuevo producto</button>
      </header>

      <div className="relative mb-4 max-w-md">
        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, categoría o código" aria-label="Buscar producto" className="field pl-10" />
      </div>

      {error && <p role="alert" className="mb-3 text-laufit-700">{String(error.message)}</p>}
      <div className="card-surface overflow-x-auto p-0">
        <table className="w-full min-w-[720px]">
          <thead className="border-b border-ink-100"><tr><th className="th">Producto</th><th className="th">Categoría</th><th className="th">Precio</th><th className="th">Costo</th><th className="th">Stock</th><th className="th" /></tr></thead>
          <tbody className="divide-y divide-ink-100">
            {!data && <tr><td colSpan={6} className="td text-center"><Spinner /></td></tr>}
            {filtrados.map((p) => {
              const agotado = p.controlaStock && p.stock <= 0
              const bajo = p.controlaStock && !agotado && p.stock <= p.alertaStock
              return (
                <tr key={p.id} className={p.activo ? '' : 'opacity-50'}>
                  <td className="td font-semibold">{p.nombre}{!p.activo && <span className="badge ml-2 bg-ink-100 text-ink-500">Inactivo</span>}<span className="block text-xs font-normal text-ink-400">{p.codigoBarras ?? 'Sin código de barras'}</span></td>
                  <td className="td">{p.categoria ?? '—'}</td>
                  <td className="td font-semibold">{soles(p.precioVenta)}</td>
                  <td className="td text-ink-500">{p.precioCosto === null ? '—' : soles(p.precioCosto)}</td>
                  <td className="td">
                    {p.controlaStock ? (
                      <span className={`badge ${agotado ? 'bg-laufit-100 text-laufit-800' : bajo ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{agotado ? 'Agotado' : `${p.stock} u.`}</span>
                    ) : (
                      <span className="text-xs text-ink-400">Sin control</span>
                    )}
                  </td>
                  <td className="td whitespace-nowrap text-right">
                    {p.controlaStock && (
                      <>
                        <button type="button" onClick={() => abrirMovimiento(p, 'ENTRADA')} className="btn-ghost btn-sm mr-1">+ Ingresar</button>
                        <button type="button" onClick={() => abrirMovimiento(p, 'AJUSTE')} className="btn-ghost btn-sm mr-1">Ajustar</button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setErrorForm(null)
                        setForm({ id: p.id, nombre: p.nombre, categoria: p.categoria ?? '', codigoBarras: p.codigoBarras ?? '', precioVenta: String(p.precioVenta), precioCosto: p.precioCosto === null ? '' : String(p.precioCosto), stockInicial: '0', alertaStock: String(p.alertaStock), controlaStock: p.controlaStock, activo: p.activo })
                      }}
                      className="btn-ghost btn-sm"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              )
            })}
            {data && filtrados.length === 0 && <tr><td colSpan={6} className="td py-10 text-center text-ink-500">{q ? 'Sin resultados.' : 'Aún no hay productos. Crea el primero con “Nuevo producto”.'}</td></tr>}
          </tbody>
        </table>
      </div>

      {form && (
        <Modal title={form.id ? 'Editar producto' : 'Nuevo producto'} onClose={() => setForm(null)}>
          <form onSubmit={guardar} className="space-y-4">
            <div>
              <label htmlFor="pn" className="label">Nombre</label>
              <input id="pn" required autoFocus value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="field" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="pc" className="label">Categoría</label>
                <input id="pc" list="categorias-producto" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="field" placeholder="Bebidas, Suplementos…" />
                <datalist id="categorias-producto">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
              </div>
              <div>
                <label htmlFor="pb" className="label">Código de barras</label>
                <input id="pb" value={form.codigoBarras} onChange={(e) => setForm({ ...form, codigoBarras: e.target.value })} className="field" placeholder="Escanéalo aquí" />
              </div>
              <div>
                <label htmlFor="pv" className="label">Precio de venta (S/)</label>
                <input id="pv" type="number" required min={0.01} step="0.01" value={form.precioVenta} onChange={(e) => setForm({ ...form, precioVenta: e.target.value })} className="field" />
              </div>
              <div>
                <label htmlFor="pco" className="label">Costo (S/, opcional)</label>
                <input id="pco" type="number" min={0} step="0.01" value={form.precioCosto} onChange={(e) => setForm({ ...form, precioCosto: e.target.value })} className="field" />
              </div>
              {!form.id && (
                <div>
                  <label htmlFor="ps" className="label">Stock inicial</label>
                  <input id="ps" type="number" min={0} step={1} value={form.stockInicial} onChange={(e) => setForm({ ...form, stockInicial: e.target.value })} className="field" />
                </div>
              )}
              <div>
                <label htmlFor="pa" className="label">Avisar con stock de</label>
                <input id="pa" type="number" min={0} step={1} value={form.alertaStock} onChange={(e) => setForm({ ...form, alertaStock: e.target.value })} className="field" />
              </div>
            </div>
            <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={form.controlaStock} onChange={(e) => setForm({ ...form, controlaStock: e.target.checked })} className="h-5 w-5 accent-laufit-600" /> Controlar stock (se descuenta al vender)</label>
            <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} className="h-5 w-5 accent-laufit-600" /> Activo (aparece en el Market)</label>
            {errorForm && <p role="alert" className="rounded-xl bg-laufit-50 px-4 py-2 text-sm font-semibold text-laufit-700">{errorForm}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setForm(null)} className="btn-ghost">Cancelar</button>
              <button type="submit" disabled={enviando} className="btn-brand">{enviando && <Spinner />} Guardar</button>
            </div>
          </form>
        </Modal>
      )}

      {mov && (
        <Modal title={`${mov.tipo === 'ENTRADA' ? 'Ingresar stock' : 'Ajustar stock'} · ${mov.producto.nombre}`} onClose={() => setMov(null)}>
          <form onSubmit={moverStock} className="space-y-4">
            <p className="text-sm text-ink-600">Stock actual: <strong>{mov.producto.stock}</strong> unidades.</p>
            <div>
              <label htmlFor="mc" className="label">{mov.tipo === 'ENTRADA' ? 'Unidades que ingresan' : 'Stock real contado'}</label>
              <input id="mc" type="number" required autoFocus min={mov.tipo === 'ENTRADA' ? 1 : 0} step={1} value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="field" />
              {mov.tipo === 'ENTRADA' && cantidad !== '' && <p className="mt-1 text-xs text-ink-400">Quedarán {mov.producto.stock + (Number(cantidad) || 0)} unidades.</p>}
            </div>
            <div>
              <label htmlFor="mm" className="label">Motivo (opcional)</label>
              <input id="mm" value={motivo} onChange={(e) => setMotivo(e.target.value)} className="field" placeholder={mov.tipo === 'ENTRADA' ? 'Compra a proveedor…' : 'Conteo de fin de mes…'} />
            </div>
            {errorForm && <p role="alert" className="rounded-xl bg-laufit-50 px-4 py-2 text-sm font-semibold text-laufit-700">{errorForm}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setMov(null)} className="btn-ghost">Cancelar</button>
              <button type="submit" disabled={enviando} className="btn-brand">{enviando && <Spinner />} Guardar</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
