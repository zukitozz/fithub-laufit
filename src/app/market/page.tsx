'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { Minus, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react'
import { SocioCombobox, type SocioSugerido } from '@/components/SocioCombobox'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { api, fetcher, soles } from '@/components/ui'
import { ETIQUETA_COMPROBANTE } from '@/lib/comprobantes'

interface Producto {
  id: string
  nombre: string
  categoria: string | null
  codigoBarras: string | null
  precioVenta: number
  stock: number
  alertaStock: number
  controlaStock: boolean
}

type Comprobante = 'BOLETA' | 'FACTURA' | 'NOTA_DESPACHO'

const METODOS = [
  { valor: 'EFECTIVO', etiqueta: 'Efectivo' },
  { valor: 'YAPE', etiqueta: 'Yape' },
  { valor: 'PLIN', etiqueta: 'Plin' },
  { valor: 'TARJETA', etiqueta: 'Tarjeta' },
  { valor: 'TRANSFERENCIA', etiqueta: 'Transf.' },
]

const BILLETES = [10, 20, 50, 100, 200]
const CLAVE_COMPROBANTE = 'fithub-market-comprobante'
const round2 = (n: number) => Math.round(n * 100) / 100

const sinStock = (p: Producto) => p.controlaStock && p.stock <= 0

export default function MarketPage() {
  const toast = useToast()
  const { data: productos, error, mutate } = useSWR<Producto[]>('/api/productos?activos=1', fetcher, { refreshInterval: 60_000 })
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('')
  const [carrito, setCarrito] = useState<Record<string, number>>({})
  const [socio, setSocio] = useState<SocioSugerido | null>(null)
  const [comprobante, setComprobante] = useState<Comprobante>('BOLETA')
  const [metodo, setMetodo] = useState('EFECTIVO')
  const [recibido, setRecibido] = useState('')
  const [ruc, setRuc] = useState('')
  const [razon, setRazon] = useState('')
  const [cobrando, setCobrando] = useState(false)
  const [errorVenta, setErrorVenta] = useState<string | null>(null)
  const [ultima, setUltima] = useState<{ id: string; numeracion: string; total: number; enviado: boolean; tipo: Comprobante } | null>(null)
  const buscador = useRef<HTMLInputElement>(null)

  // Recuerda el último comprobante elegido: en caja casi siempre es el mismo.
  useEffect(() => {
    try {
      const guardado = localStorage.getItem(CLAVE_COMPROBANTE)
      if (guardado === 'BOLETA' || guardado === 'FACTURA' || guardado === 'NOTA_DESPACHO') setComprobante(guardado)
    } catch {
      /* sin almacenamiento local: se queda en Boleta */
    }
  }, [])
  function elegirComprobante(c: Comprobante) {
    setComprobante(c)
    try {
      localStorage.setItem(CLAVE_COMPROBANTE, c)
    } catch {
      /* no crítico */
    }
  }

  const porId = useMemo(() => new Map((productos ?? []).map((p) => [p.id, p])), [productos])
  const categorias = useMemo(() => [...new Set((productos ?? []).map((p) => p.categoria).filter((c): c is string => Boolean(c)))].sort(), [productos])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return (productos ?? []).filter((p) => (!categoria || p.categoria === categoria) && (!q || p.nombre.toLowerCase().includes(q) || p.codigoBarras === busqueda.trim()))
  }, [productos, busqueda, categoria])

  const lineas = Object.entries(carrito)
    .map(([id, cantidad]) => ({ producto: porId.get(id), cantidad }))
    .filter((l): l is { producto: Producto; cantidad: number } => Boolean(l.producto))
  const total = round2(lineas.reduce((s, l) => s + l.producto.precioVenta * l.cantidad, 0))
  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0)

  function agregar(p: Producto, delta = 1) {
    setErrorVenta(null)
    setCarrito((c) => {
      const nueva = (c[p.id] ?? 0) + delta
      if (nueva <= 0) {
        const { [p.id]: _quitado, ...resto } = c
        return resto
      }
      if (p.controlaStock && nueva > p.stock) {
        toast.error(`Solo quedan ${p.stock} de "${p.nombre}"`)
        return c
      }
      return { ...c, [p.id]: nueva }
    })
  }

  // Lector de código de barras: escribe el código y envía Enter. Un código exacto (o un único
  // resultado) se agrega solo y la búsqueda queda lista para el siguiente producto.
  function alEnter() {
    const q = busqueda.trim()
    if (!q) return
    const exacto = (productos ?? []).find((p) => p.codigoBarras === q)
    const elegido = exacto ?? (filtrados.length === 1 ? filtrados[0] : null)
    if (!elegido) return
    if (sinStock(elegido)) return toast.error(`"${elegido.nombre}" no tiene stock`)
    agregar(elegido)
    setBusqueda('')
  }

  const montoRecibido = Number(recibido)
  const vuelto = metodo === 'EFECTIVO' && recibido !== '' ? round2(montoRecibido - total) : null
  const faltaRuc = comprobante === 'FACTURA' && !(socio?.rucFactura || ruc.trim())

  async function cobrar() {
    if (lineas.length === 0 || cobrando) return
    if (vuelto !== null && vuelto < 0) return setErrorVenta(`Falta ${soles(-vuelto)}: el monto recibido no alcanza`)
    setErrorVenta(null)
    setCobrando(true)
    const r = await api<{ factura: { id: string; numeracionComprobante: string; total: number; enviado: boolean; errors: string | null } }>('/api/market/venta', {
      method: 'POST',
      body: {
        items: lineas.map((l) => ({ productoId: l.producto.id, cantidad: l.cantidad })),
        socioId: socio?.id,
        tipoComprobante: comprobante,
        receptor: comprobante === 'FACTURA' ? { ruc: ruc.trim() || undefined, razonSocial: razon.trim() || undefined } : undefined,
        metodoPago: metodo,
      },
    })
    setCobrando(false)
    if (!r.ok) {
      setErrorVenta(r.error)
      void mutate() // el stock pudo haber cambiado
      return
    }
    const f = r.data.factura
    const sunat = comprobante === 'NOTA_DESPACHO' || f.enviado ? '' : ' · SUNAT pendiente (se reintenta solo)'
    setUltima({ id: f.id, numeracion: f.numeracionComprobante, total: f.total, enviado: f.enviado, tipo: comprobante })
    toast.success(`${ETIQUETA_COMPROBANTE[comprobante]} ${f.numeracionComprobante} · ${soles(f.total)}${vuelto && vuelto > 0 ? ` · vuelto ${soles(vuelto)}` : ''}${sunat}`)
    setCarrito({})
    setSocio(null)
    setRecibido('')
    setRuc('')
    setRazon('')
    setBusqueda('')
    void mutate()
    buscador.current?.focus()
  }

  // Ctrl+Enter cobra desde cualquier campo.
  useEffect(() => {
    const atajo = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault()
        void cobrar()
      }
    }
    window.addEventListener('keydown', atajo)
    return () => window.removeEventListener('keydown', atajo)
  })

  return (
    <div className="grid gap-4 p-4 md:p-6 lg:grid-cols-[1fr_26rem]">
      {/* Productos */}
      <section aria-label="Productos" className="min-w-0">
        <header className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="eyebrow">Caja</p>
            <h1 className="page-heading text-4xl">Market</h1>
          </div>
        </header>

        <div className="relative mb-3">
          <Search size={20} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
          <input
            ref={buscador}
            autoFocus
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                alEnter()
              }
              if (e.key === 'Escape') setBusqueda('')
            }}
            placeholder="Escribe el producto o escanea el código de barras"
            aria-label="Buscar producto"
            className="field h-14 pl-11 text-lg"
          />
        </div>

        {categorias.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Categorías">
            {['', ...categorias].map((c) => (
              <button
                key={c || 'todas'}
                type="button"
                aria-pressed={categoria === c}
                onClick={() => setCategoria(c)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${categoria === c ? 'bg-ink-900 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50'}`}
              >
                {c || 'Todos'}
              </button>
            ))}
          </div>
        )}

        {error && <p role="alert" className="rounded-xl bg-danger-50 px-4 py-2 text-sm font-semibold text-danger-700">{String(error.message)}</p>}
        {!productos && !error && <p className="text-ink-500"><Spinner /> Cargando productos…</p>}
        {productos && productos.length === 0 && (
          <div className="card-surface py-10 text-center text-ink-500">
            <p className="font-display text-2xl font-bold text-ink-800">Aún no hay productos</p>
            <p className="mt-1 text-sm">El gerente puede crearlos en el menú Productos.</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {filtrados.map((p) => {
            const agotado = sinStock(p)
            const bajo = p.controlaStock && !agotado && p.stock <= p.alertaStock
            const enCarrito = carrito[p.id] ?? 0
            return (
              <button
                key={p.id}
                type="button"
                disabled={agotado}
                onClick={() => agregar(p)}
                className={`relative flex min-h-[7rem] flex-col justify-between rounded-2xl border-2 bg-white p-3 text-left transition active:scale-[0.98] ${
                  agotado ? 'cursor-not-allowed border-ink-100 opacity-50' : enCarrito ? 'border-brand-600 shadow-soft' : 'border-ink-100 hover:border-brand-300'
                }`}
              >
                {enCarrito > 0 && <span className="absolute -right-2 -top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-brand-600 px-1.5 text-sm font-bold text-white">{enCarrito}</span>}
                <span className="text-sm font-semibold leading-snug text-ink-900">{p.nombre}</span>
                <span>
                  <span className="block font-display text-2xl font-bold text-brand-600">{soles(p.precioVenta)}</span>
                  {p.controlaStock && (
                    <span className={`text-xs font-semibold ${agotado ? 'text-danger-700' : bajo ? 'text-amber-700' : 'text-ink-400'}`}>
                      {agotado ? 'Agotado' : `${p.stock} en stock`}
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
        {productos && productos.length > 0 && filtrados.length === 0 && <p className="mt-4 text-center text-ink-500">Sin resultados para “{busqueda}”.</p>}
      </section>

      {/* Carrito */}
      <aside aria-label="Carrito" className="lg:sticky lg:top-4 lg:self-start">
        <div className="card-surface space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-2xl font-bold"><ShoppingCart size={22} className="text-brand-600" /> Carrito</h2>
            {lineas.length > 0 && <button type="button" onClick={() => setCarrito({})} className="text-sm font-semibold text-ink-400 hover:text-brand-600">Vaciar</button>}
          </div>

          {lineas.length === 0 ? (
            <p className="rounded-xl bg-ink-50 px-4 py-6 text-center text-sm text-ink-500">Toca un producto o escanea su código para agregarlo.</p>
          ) : (
            <ul className="max-h-72 divide-y divide-ink-100 overflow-y-auto">
              {lineas.map(({ producto: p, cantidad }) => (
                <li key={p.id} className="flex items-center gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.nombre}</p>
                    <p className="text-xs text-ink-400">{soles(p.precioVenta)} c/u</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => agregar(p, -1)} aria-label={`Quitar una unidad de ${p.nombre}`} className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-100 hover:bg-ink-200"><Minus size={16} /></button>
                    <span className="w-8 text-center font-bold tabular-nums">{cantidad}</span>
                    <button type="button" onClick={() => agregar(p, 1)} aria-label={`Agregar una unidad de ${p.nombre}`} className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-100 hover:bg-ink-200"><Plus size={16} /></button>
                  </div>
                  <span className="w-20 text-right text-sm font-bold tabular-nums">{soles(round2(p.precioVenta * cantidad))}</span>
                  <button type="button" onClick={() => agregar(p, -cantidad)} aria-label={`Eliminar ${p.nombre}`} className="rounded-lg p-1.5 text-ink-300 hover:bg-brand-50 hover:text-brand-600"><Trash2 size={16} /></button>
                </li>
              ))}
            </ul>
          )}

          <div>
            <p className="label">Cliente (opcional)</p>
            <SocioCombobox value={socio} onChange={setSocio} placeholder="Nombre, DNI o celular — vacío = cliente varios" />
            {comprobante === 'BOLETA' && !socio && total >= 700 && <p className="mt-1 text-xs font-semibold text-amber-700">Las boletas desde S/ 700 requieren identificar al cliente.</p>}
          </div>

          <div>
            <p className="label">Comprobante</p>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Comprobante">
              {(['BOLETA', 'FACTURA', 'NOTA_DESPACHO'] as const).map((c) => (
                <button key={c} type="button" aria-pressed={comprobante === c} onClick={() => elegirComprobante(c)}
                  className={`rounded-xl border-2 px-1 py-2 text-xs font-bold sm:text-sm ${comprobante === c ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-ink-100 text-ink-600'}`}>
                  {c === 'NOTA_DESPACHO' ? 'N. despacho' : ETIQUETA_COMPROBANTE[c]}
                </button>
              ))}
            </div>
            {comprobante === 'FACTURA' && (
              socio?.rucFactura ? (
                <p className="mt-2 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">RUC {socio.rucFactura} · {socio.razonSocial}</p>
              ) : (
                <div className="mt-2 grid grid-cols-[8rem_1fr] gap-2">
                  <input value={ruc} onChange={(e) => setRuc(e.target.value)} inputMode="numeric" placeholder="RUC" aria-label="RUC" className="field" />
                  <input value={razon} onChange={(e) => setRazon(e.target.value)} placeholder="Razón social" aria-label="Razón social" className="field" />
                </div>
              )
            )}
            {comprobante === 'NOTA_DESPACHO' && <p className="mt-1 text-xs text-ink-400">Interna: no se envía a SUNAT.</p>}
          </div>

          <div>
            <p className="label">Pago</p>
            <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Método de pago">
              {METODOS.map((m) => (
                <button key={m.valor} type="button" aria-pressed={metodo === m.valor} onClick={() => setMetodo(m.valor)}
                  className={`rounded-xl border-2 px-1 py-2 text-xs font-bold ${metodo === m.valor ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-ink-100 text-ink-600'}`}>
                  {m.etiqueta}
                </button>
              ))}
            </div>
            {metodo === 'EFECTIVO' && total > 0 && (
              <div className="mt-2">
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => setRecibido(String(total))} className="btn-ghost btn-sm">Exacto</button>
                  {BILLETES.filter((b) => b >= total).slice(0, 3).map((b) => (
                    <button key={b} type="button" onClick={() => setRecibido(String(b))} className="btn-ghost btn-sm">S/ {b}</button>
                  ))}
                  <input value={recibido} onChange={(e) => setRecibido(e.target.value)} inputMode="decimal" placeholder="Recibido" aria-label="Monto recibido" className="field min-h-9 w-28 py-1.5 text-sm" />
                </div>
                {vuelto !== null && (
                  <p className={`mt-2 text-center font-display text-3xl font-bold ${vuelto < 0 ? 'text-danger-600' : 'text-emerald-600'}`}>
                    {vuelto < 0 ? `Falta ${soles(-vuelto)}` : `Vuelto ${soles(vuelto)}`}
                  </p>
                )}
              </div>
            )}
          </div>

          {ultima && (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50 px-4 py-2 text-sm">
              <span className="min-w-0 truncate"><strong>{ultima.numeracion}</strong> · {soles(ultima.total)}</span>
              <a href={`/api/facturacion/${ultima.id}/pdf`} target="_blank" rel="noopener noreferrer" className="shrink-0 font-bold text-brand-600 underline">Ver PDF</a>
            </div>
          )}

          {errorVenta && <p role="alert" className="rounded-xl bg-danger-50 px-4 py-2 text-sm font-semibold text-danger-700">{errorVenta}</p>}

          <button type="button" onClick={() => void cobrar()} disabled={lineas.length === 0 || cobrando || faltaRuc} className="btn-brand h-14 w-full text-lg">
            {cobrando && <Spinner />} Cobrar {total > 0 && soles(total)}
          </button>
          <p className="text-center text-xs text-ink-400">{unidades > 0 ? `${unidades} ${unidades === 1 ? 'unidad' : 'unidades'} · ` : ''}Ctrl + Enter para cobrar</p>
        </div>
      </aside>
    </div>
  )
}
