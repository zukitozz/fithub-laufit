'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { Plus, X } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { api, fetcher, soles } from '@/components/ui'
import { ETIQUETA_COMPROBANTE } from '@/lib/comprobantes'

interface Plan { id: string; nombre: string; duracion: number; unidad: 'MESES' | 'DIAS'; precio: number; matricula: number }
interface SocioMin { id: string; nombre: string }
interface SocioDetalle { rucFactura: string | null; razonSocial: string | null; membresias: { anulada: boolean }[] }

const METODOS = [
  { valor: 'EFECTIVO', etiqueta: 'Efectivo' },
  { valor: 'YAPE', etiqueta: 'Yape' },
  { valor: 'PLIN', etiqueta: 'Plin' },
  { valor: 'TARJETA', etiqueta: 'Tarjeta' },
  { valor: 'TRANSFERENCIA', etiqueta: 'Transferencia' },
  { valor: 'DEPOSITO', etiqueta: 'Depósito' },
]

interface Props {
  socio: SocioMin
  onClose: () => void
  onHecho: () => void
}

/** Venta o renovación de una membresía con pago único y comprobante (boleta o factura). */
export function VentaMembresiaModal({ socio, onClose, onHecho }: Props) {
  const toast = useToast()
  const { data: planes } = useSWR<Plan[]>('/api/planes?activos=1', fetcher)
  const { data: detalle } = useSWR<SocioDetalle>(`/api/socios/${socio.id}`, fetcher)

  const [planId, setPlanId] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [comprobante, setComprobante] = useState<'BOLETA' | 'FACTURA' | 'NOTA_DESPACHO'>('BOLETA')
  const [ruc, setRuc] = useState('')
  const [razon, setRazon] = useState('')
  const [pagos, setPagos] = useState<{ metodo: string; monto: string }[]>([{ metodo: 'EFECTIVO', monto: '' }])
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState<{ id: string; numeracion: string; enviado: boolean } | null>(null)

  const plan = planes?.find((p) => p.id === planId)
  const primeraVez = detalle ? detalle.membresias.filter((m) => !m.anulada).length === 0 : false
  const total = useMemo(() => (plan ? plan.precio + (primeraVez ? plan.matricula : 0) : 0), [plan, primeraVez])
  const sumaPagos = pagos.reduce((s, p) => s + (Number(p.monto) || 0), 0)
  const dividido = pagos.length > 1

  async function vender(e: React.FormEvent) {
    e.preventDefault()
    if (!plan) return setError('Elige un plan')
    if (dividido && Math.abs(sumaPagos - total) > 0.01) return setError(`Los pagos suman ${soles(sumaPagos)} y el total es ${soles(total)}`)
    setError(null)
    setEnviando(true)
    const r = await api<{ factura: { id: string; numeracionComprobante: string; enviado: boolean; errors: string | null } }>('/api/membresias', {
      method: 'POST',
      body: {
        socioId: socio.id,
        planId: plan.id,
        fechaInicio: fechaInicio || undefined,
        tipoComprobante: comprobante,
        receptor: comprobante === 'FACTURA' ? { ruc: ruc || detalle?.rucFactura, razonSocial: razon || detalle?.razonSocial } : undefined,
        metodoPago: dividido ? undefined : pagos[0].metodo,
        pagos: dividido ? pagos.map((p) => ({ metodo: p.metodo, monto: Number(p.monto) })) : undefined,
      },
    })
    setEnviando(false)
    if (!r.ok) return setError(r.error)

    const f = r.data.factura
    if (comprobante === 'NOTA_DESPACHO') toast.success(`Venta registrada. Nota de despacho ${f.numeracionComprobante}`)
    else if (f.enviado) toast.success(`Venta registrada. ${f.numeracionComprobante} enviado a SUNAT`)
    else toast.mostrar(`Venta registrada (${f.numeracionComprobante}). SUNAT no respondió${f.errors ? `: ${f.errors}` : ''}; se reintentará automáticamente esta noche.`, 'info')
    // Se queda en el modal para poder abrir el PDF de inmediato; al cerrar se refresca la pantalla.
    setHecho({ id: f.id, numeracion: f.numeracionComprobante, enviado: f.enviado })
  }

  if (hecho) {
    return (
      <Modal title="Venta registrada" onClose={onHecho}>
        <div className="space-y-4 text-center">
          <p className="font-display text-3xl font-bold">{hecho.numeracion}</p>
          <p className="text-sm text-ink-500">{comprobante === 'NOTA_DESPACHO' ? 'Nota de despacho interna.' : hecho.enviado ? 'Enviado a SUNAT.' : 'Pendiente de envío a SUNAT (se reintenta solo).'}</p>
          <a href={`/api/facturacion/${hecho.id}/pdf`} target="_blank" rel="noopener noreferrer" className="btn-brand w-full">Ver / imprimir PDF</a>
          <button type="button" onClick={onHecho} className="btn-ghost w-full">Listo</button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title={`Vender membresía · ${socio.nombre}`} onClose={onClose}>
      <form onSubmit={vender} className="space-y-5">
        <fieldset>
          <legend className="label">Plan</legend>
          {!planes ? (
            <p className="flex items-center gap-2 text-sm text-ink-500"><Spinner /> Cargando planes…</p>
          ) : planes.length === 0 ? (
            <p className="text-sm text-danger-700">No hay planes activos. El gerente debe crearlos en Planes.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {planes.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setPlanId(p.id)}
                  aria-pressed={planId === p.id}
                  className={`rounded-xl border-2 px-3 py-3 text-left transition ${planId === p.id ? 'border-brand-600 bg-brand-50' : 'border-ink-100 bg-white hover:border-ink-300'}`}
                >
                  <span className="block font-display text-xl font-bold leading-none">{p.nombre}</span>
                  <span className="mt-1 block text-sm font-semibold text-brand-600">{soles(p.precio)}</span>
                </button>
              ))}
            </div>
          )}
        </fieldset>

        {plan && (
          <div className="rounded-xl bg-ink-50 px-4 py-3 text-sm">
            <div className="flex justify-between"><span>Membresía {plan.nombre}</span><span>{soles(plan.precio)}</span></div>
            {primeraVez && plan.matricula > 0 && <div className="flex justify-between"><span>Matrícula (primera vez)</span><span>{soles(plan.matricula)}</span></div>}
            <div className="mt-1 flex justify-between border-t border-ink-200 pt-1 font-bold"><span>Total (IGV incluido)</span><span>{soles(total)}</span></div>
          </div>
        )}

        <div>
          <label htmlFor="inicio" className="label">Inicio (opcional)</label>
          <input id="inicio" type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="field" />
          <p className="mt-1 text-xs text-ink-400">Si lo dejas vacío: hoy, o el día siguiente al vencimiento si el socio aún tiene membresía vigente.</p>
        </div>

        <fieldset>
          <legend className="label">Comprobante</legend>
          <div className="grid grid-cols-3 gap-2">
            {(['BOLETA', 'FACTURA', 'NOTA_DESPACHO'] as const).map((tipo) => (
              <button type="button" key={tipo} aria-pressed={comprobante === tipo} onClick={() => setComprobante(tipo)}
                className={`rounded-xl border-2 px-2 py-2 text-sm font-bold ${comprobante === tipo ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-ink-100'}`}>
                {ETIQUETA_COMPROBANTE[tipo]}
              </button>
            ))}
          </div>
          {comprobante === 'NOTA_DESPACHO' && (
            <p className="mt-2 text-xs text-ink-500">Comprobante interno: no se envía a SUNAT.</p>
          )}
          {comprobante === 'FACTURA' && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="ruc" className="label">RUC</label>
                <input id="ruc" inputMode="numeric" value={ruc} placeholder={detalle?.rucFactura ?? '20123456789'} onChange={(e) => setRuc(e.target.value)} className="field" />
              </div>
              <div>
                <label htmlFor="razon" className="label">Razón social</label>
                <input id="razon" value={razon} placeholder={detalle?.razonSocial ?? ''} onChange={(e) => setRazon(e.target.value)} className="field" />
              </div>
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend className="label">Pago (completo)</legend>
          <div className="space-y-2">
            {pagos.map((p, i) => (
              <div key={i} className="flex gap-2">
                <select aria-label="Método de pago" value={p.metodo} onChange={(e) => setPagos(pagos.map((x, j) => (j === i ? { ...x, metodo: e.target.value } : x)))} className="field">
                  {METODOS.map((m) => <option key={m.valor} value={m.valor}>{m.etiqueta}</option>)}
                </select>
                {dividido && (
                  <input aria-label="Monto" inputMode="decimal" value={p.monto} onChange={(e) => setPagos(pagos.map((x, j) => (j === i ? { ...x, monto: e.target.value } : x)))} placeholder="Monto" className="field w-32" />
                )}
                {dividido && (
                  <button type="button" aria-label="Quitar pago" onClick={() => setPagos(pagos.filter((_, j) => j !== i))} className="btn-ghost px-3"><X size={16} /></button>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setPagos([...pagos.map((p, i) => (i === 0 && !p.monto && total ? { ...p, monto: String(total) } : p)), { metodo: 'YAPE', monto: '' }])} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-600">
            <Plus size={15} /> Dividir en varios métodos
          </button>
        </fieldset>

        {error && <p role="alert" className="rounded-xl bg-danger-50 px-4 py-2 text-sm font-semibold text-danger-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
          <button type="submit" disabled={enviando || !plan} className="btn-brand">{enviando && <Spinner />} Cobrar {plan ? soles(total) : ''}</button>
        </div>
      </form>
    </Modal>
  )
}
