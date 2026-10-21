'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Modal } from '@/components/Modal'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { api, fechaHoraLima, fetcher, soles } from '@/components/ui'
import { ETIQUETA_COMPROBANTE, type TipoComprobanteApp } from '@/lib/comprobantes'

type PorMetodo = { EFECTIVO: number; TARJETA: number; YAPE: number; TRANSFERENCIA: number; DEPOSITO: number }

interface FilaComprobante {
  id: string
  tipo: TipoComprobanteApp
  numeracionComprobante: string | null
  total: number
  metodoPago: string
  creadoAt: string
  receptorNombre: string
  usuario: { name: string } | null
}

interface Pendiente {
  facturas: FilaComprobante[]
  cantidad: number
  total: number
  porMetodo: PorMetodo
  fechaDesde: string | null
}

interface Cierre {
  id: string
  fechaInicio: string
  fechaFin: string
  totalVentas: number
  totalEfectivo: number
  totalTarjeta: number
  totalYape: number
  totalTransferencia: number
  totalDeposito: number
  efectivoContado: number | null
  diferencia: number | null
  notas: string | null
  cantidadComprobantes: number
  usuario: { name: string }
}

interface DetalleCierre extends Cierre {
  facturas: FilaComprobante[]
  productos: { nombre: string; cantidad: number; total: number }[]
}

const ETIQUETAS_METODO: Record<keyof PorMetodo, string> = {
  EFECTIVO: 'Efectivo',
  YAPE: 'Yape / Plin',
  TARJETA: 'Tarjeta',
  TRANSFERENCIA: 'Transferencia',
  DEPOSITO: 'Depósito',
}
const ORDEN_METODOS: (keyof PorMetodo)[] = ['EFECTIVO', 'YAPE', 'TARJETA', 'TRANSFERENCIA', 'DEPOSITO']
const round2 = (n: number) => Math.round(n * 100) / 100

function Totales({ porMetodo, total }: { porMetodo: PorMetodo; total: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {ORDEN_METODOS.map((m) => (
        <div key={m} className="rounded-xl bg-ink-50 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-500">{ETIQUETAS_METODO[m]}</p>
          <p className="font-display text-2xl font-bold">{soles(porMetodo[m])}</p>
        </div>
      ))}
      <div className="rounded-xl bg-ink-900 px-4 py-3 text-white">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-300">Total</p>
        <p className="font-display text-2xl font-bold">{soles(total)}</p>
      </div>
    </div>
  )
}

function TablaComprobantes({ facturas }: { facturas: FilaComprobante[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px]">
        <thead className="border-b border-ink-100"><tr><th className="th">Comprobante</th><th className="th">Hora</th><th className="th">Cliente</th><th className="th">Cobró</th><th className="th">Pago</th><th className="th text-right">Total</th></tr></thead>
        <tbody className="divide-y divide-ink-100">
          {facturas.map((f) => (
            <tr key={f.id}>
              <td className="td font-semibold">{f.numeracionComprobante ?? '—'}<span className="block text-xs font-normal text-ink-400">{ETIQUETA_COMPROBANTE[f.tipo]}</span></td>
              <td className="td text-ink-500">{fechaHoraLima(f.creadoAt)}</td>
              <td className="td">{f.receptorNombre}</td>
              <td className="td text-ink-500">{f.usuario?.name ?? '—'}</td>
              <td className="td text-xs">{f.metodoPago}</td>
              <td className={`td text-right font-semibold ${f.tipo === 'NOTA_CREDITO' ? 'text-danger-600' : ''}`}>{f.tipo === 'NOTA_CREDITO' && '−'}{soles(f.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function CierresPage() {
  const toast = useToast()
  const { data: pendiente, error, mutate: recargarPendiente } = useSWR<Pendiente>('/api/cierres/pendiente', fetcher, { refreshInterval: 20_000 })
  const { data: historial, mutate: recargarHistorial } = useSWR<Cierre[]>('/api/cierres', fetcher)
  const [contado, setContado] = useState('')
  const [notas, setNotas] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const [cerrando, setCerrando] = useState(false)
  const [errorCierre, setErrorCierre] = useState<string | null>(null)
  const [detalleId, setDetalleId] = useState<string | null>(null)
  const { data: detalle } = useSWR<DetalleCierre>(detalleId ? `/api/cierres/${detalleId}` : null, fetcher)

  const esperado = pendiente?.porMetodo.EFECTIVO ?? 0
  const diferencia = contado === '' ? null : round2(Number(contado) - esperado)

  async function cerrar() {
    setCerrando(true)
    setErrorCierre(null)
    const r = await api<Cierre>('/api/cierres', { method: 'POST', body: { efectivoContado: contado === '' ? null : Number(contado), notas } })
    setCerrando(false)
    if (!r.ok) {
      setConfirmando(false)
      return setErrorCierre(r.error)
    }
    toast.success(`Turno cerrado: ${soles(r.data.totalVentas)} en ${r.data.cantidadComprobantes} comprobantes`)
    setConfirmando(false)
    setContado('')
    setNotas('')
    void recargarPendiente()
    void recargarHistorial()
    setDetalleId(r.data.id)
  }

  return (
    <div className="space-y-6 p-4 md:p-8">
      <header>
        <p className="eyebrow">Caja</p>
        <h1 className="page-heading text-4xl">Cierre de turno</h1>
        <p className="text-sm text-ink-500">Cierra todo lo cobrado desde el cierre anterior: membresías, productos y devoluciones.</p>
      </header>

      {error && <p role="alert" className="rounded-xl bg-danger-50 px-4 py-2 text-sm font-semibold text-danger-700">{String(error.message)}</p>}
      {!pendiente && !error && <p className="text-ink-500"><Spinner /> Cargando…</p>}

      {pendiente && (
        <section className="card-surface space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-2xl font-bold">Turno actual</h2>
            <p className="text-sm text-ink-500">
              {pendiente.cantidad === 0 ? 'Sin cobros pendientes' : `${pendiente.cantidad} ${pendiente.cantidad === 1 ? 'comprobante' : 'comprobantes'} desde ${fechaHoraLima(pendiente.fechaDesde)}`}
            </p>
          </div>

          <Totales porMetodo={pendiente.porMetodo} total={pendiente.total} />

          {pendiente.cantidad > 0 && (
            <>
              <div className="grid gap-4 rounded-xl border border-ink-100 p-4 md:grid-cols-[1fr_1fr_1.5fr]">
                <div>
                  <p className="label">Efectivo esperado en caja</p>
                  <p className="font-display text-3xl font-bold">{soles(esperado)}</p>
                </div>
                <div>
                  <label htmlFor="contado" className="label">Efectivo contado</label>
                  <input id="contado" type="number" min={0} step="0.01" inputMode="decimal" value={contado} onChange={(e) => setContado(e.target.value)} className="field text-lg" placeholder="Cuenta la caja" />
                  {diferencia !== null && (
                    <p className={`mt-1 text-sm font-bold ${diferencia === 0 ? 'text-emerald-600' : 'text-danger-600'}`}>
                      {diferencia === 0 ? 'Caja cuadrada' : diferencia > 0 ? `Sobran ${soles(diferencia)}` : `Faltan ${soles(-diferencia)}`}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="notas" className="label">Notas (opcional)</label>
                  <input id="notas" value={notas} onChange={(e) => setNotas(e.target.value)} className="field" maxLength={500} placeholder="Observaciones del turno" />
                </div>
              </div>

              {errorCierre && <p role="alert" className="rounded-xl bg-danger-50 px-4 py-2 text-sm font-semibold text-danger-700">{errorCierre}</p>}
              <div className="flex justify-end">
                <button type="button" onClick={() => setConfirmando(true)} className="btn-brand">Cerrar turno</button>
              </div>

              <details className="rounded-xl border border-ink-100 px-4 py-2">
                <summary className="cursor-pointer text-sm font-semibold text-ink-600">Ver los {pendiente.cantidad} comprobantes del turno</summary>
                <div className="mt-2"><TablaComprobantes facturas={pendiente.facturas} /></div>
              </details>
            </>
          )}
        </section>
      )}

      <section className="card-surface overflow-x-auto p-0">
        <h2 className="px-5 pt-4 font-display text-2xl font-bold">Cierres anteriores</h2>
        <table className="mt-2 w-full min-w-[640px]">
          <thead className="border-b border-ink-100"><tr><th className="th">Cerrado</th><th className="th">Por</th><th className="th">Comprobantes</th><th className="th">Total</th><th className="th">Efectivo</th><th className="th">Diferencia</th><th className="th" /></tr></thead>
          <tbody className="divide-y divide-ink-100">
            {!historial && <tr><td colSpan={7} className="td text-center"><Spinner /></td></tr>}
            {historial?.map((c) => (
              <tr key={c.id}>
                <td className="td">{fechaHoraLima(c.fechaFin)}</td>
                <td className="td">{c.usuario.name}</td>
                <td className="td">{c.cantidadComprobantes}</td>
                <td className="td font-semibold">{soles(c.totalVentas)}</td>
                <td className="td">{soles(c.totalEfectivo)}</td>
                <td className={`td font-semibold ${c.diferencia === null ? 'text-ink-300' : c.diferencia === 0 ? 'text-emerald-600' : 'text-danger-600'}`}>{c.diferencia === null ? 'Sin contar' : soles(c.diferencia)}</td>
                <td className="td text-right"><button type="button" onClick={() => setDetalleId(c.id)} className="btn-ghost btn-sm">Ver</button></td>
              </tr>
            ))}
            {historial && historial.length === 0 && <tr><td colSpan={7} className="td py-8 text-center text-ink-500">Aún no hay cierres.</td></tr>}
          </tbody>
        </table>
      </section>

      {confirmando && pendiente && (
        <Modal title="Cerrar turno" onClose={() => setConfirmando(false)}>
          <div className="space-y-4">
            <p className="text-sm text-ink-600">Se cerrarán <strong>{pendiente.cantidad} comprobantes</strong> por <strong>{soles(pendiente.total)}</strong>. Después no se pueden reabrir.</p>
            {diferencia !== null && diferencia !== 0 && (
              <p className="rounded-xl bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">
                La caja no cuadra: {diferencia > 0 ? `sobran ${soles(diferencia)}` : `faltan ${soles(-diferencia)}`}. Puedes anotar el motivo en las notas.
              </p>
            )}
            {contado === '' && <p className="text-sm text-ink-500">No ingresaste el efectivo contado: el cierre quedará sin arqueo.</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmando(false)} className="btn-ghost">Volver</button>
              <button type="button" onClick={() => void cerrar()} disabled={cerrando} className="btn-brand">{cerrando && <Spinner />} Confirmar cierre</button>
            </div>
          </div>
        </Modal>
      )}

      {detalleId && (
        <Modal title="Detalle del cierre" size="lg" onClose={() => setDetalleId(null)}>
          {!detalle ? (
            <p className="text-ink-500"><Spinner /> Cargando…</p>
          ) : (
            <div className="space-y-5">
              <p className="text-sm text-ink-500">
                {fechaHoraLima(detalle.fechaInicio)} → {fechaHoraLima(detalle.fechaFin)} · cerrado por <strong>{detalle.usuario.name}</strong>
              </p>
              <Totales porMetodo={{ EFECTIVO: detalle.totalEfectivo, YAPE: detalle.totalYape, TARJETA: detalle.totalTarjeta, TRANSFERENCIA: detalle.totalTransferencia, DEPOSITO: detalle.totalDeposito }} total={detalle.totalVentas} />
              <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
                <span>Efectivo contado: <strong>{detalle.efectivoContado === null ? 'sin arqueo' : soles(detalle.efectivoContado)}</strong></span>
                {detalle.diferencia !== null && <span className={detalle.diferencia === 0 ? 'font-bold text-emerald-600' : 'font-bold text-danger-600'}>{detalle.diferencia === 0 ? 'Caja cuadrada' : detalle.diferencia > 0 ? `Sobraron ${soles(detalle.diferencia)}` : `Faltaron ${soles(-detalle.diferencia)}`}</span>}
              </div>
              {detalle.notas && <p className="rounded-xl bg-ink-50 px-4 py-2 text-sm">{detalle.notas}</p>}
              {detalle.productos.length > 0 && (
                <div>
                  <h3 className="mb-1 font-display text-xl font-bold">Productos vendidos</h3>
                  <ul className="divide-y divide-ink-100 text-sm">
                    {detalle.productos.map((p) => (
                      <li key={p.nombre} className="flex justify-between py-1.5"><span>{p.cantidad} × {p.nombre}</span><strong>{soles(p.total)}</strong></li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <h3 className="mb-1 font-display text-xl font-bold">Comprobantes</h3>
                <TablaComprobantes facturas={detalle.facturas} />
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
