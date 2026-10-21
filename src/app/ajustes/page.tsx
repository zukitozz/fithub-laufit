'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { Printer, RefreshCw } from 'lucide-react'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { api, fetcher } from '@/components/ui'

interface Config {
  nombreGimnasio: string
  direccion: string | null
  telefonoContacto: string | null
  ruc: string | null
  razonSocial: string | null
  direccionFiscal: string | null
  codigoUbigeo: string | null
  diasAvisoVencimiento: number
  diasGracia: number
  minutosAntiDuplicadoIngreso: number
  whatsappActivo: boolean
}
interface Serie { id: string; tipoComprobante: string; serie: string; estado: number; descripcion: string | null }

const TIPO_SERIE: Record<string, string> = { '01': 'Facturas', '03': 'Boletas', '07': 'Notas de crédito', '50': 'Notas de despacho (internas)' }

export default function AjustesPage() {
  const toast = useToast()
  const { data: config, mutate } = useSWR<Config>('/api/ajustes', fetcher)
  const { data: series, mutate: recargarSeries } = useSWR<Serie[]>('/api/ajustes/series', fetcher)
  const { data: qr, mutate: recargarQr } = useSWR<{ url: string; dataUrl: string }>('/api/ajustes/qr', fetcher)
  const [form, setForm] = useState<Config | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [regenerando, setRegenerando] = useState(false)
  const [nuevaSerie, setNuevaSerie] = useState({ tipoComprobante: '03', serie: '' })

  useEffect(() => {
    if (config) setForm(config)
  }, [config])

  const set = <K extends keyof Config>(campo: K, valor: Config[K]) => setForm((f) => (f ? { ...f, [campo]: valor } : f))

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    setGuardando(true)
    const r = await api('/api/ajustes', { method: 'PATCH', body: form })
    setGuardando(false)
    if (!r.ok) return toast.error(r.error)
    toast.success('Ajustes guardados')
    void mutate()
  }

  async function regenerar() {
    if (!window.confirm('El QR impreso actual dejará de funcionar y tendrás que imprimir y pegar el nuevo. ¿Continuar?')) return
    setRegenerando(true)
    const r = await api<{ url: string; dataUrl: string }>('/api/ajustes/qr', { method: 'POST' })
    setRegenerando(false)
    if (!r.ok) return toast.error(r.error)
    toast.success('QR regenerado. Imprime el nuevo.')
    void recargarQr(r.data, { revalidate: false })
  }

  async function agregarSerie(e: React.FormEvent) {
    e.preventDefault()
    const r = await api('/api/ajustes/series', { method: 'POST', body: nuevaSerie })
    if (!r.ok) return toast.error(r.error)
    toast.success('Serie agregada')
    setNuevaSerie({ ...nuevaSerie, serie: '' })
    void recargarSeries()
  }

  return (
    <div className="space-y-6 p-4 md:p-8">
      <header>
        <p className="eyebrow">Configuración</p>
        <h1 className="page-heading text-4xl">Ajustes</h1>
      </header>

      <section className="card-surface grid gap-6 md:grid-cols-[18rem_1fr]">
        <div className="text-center">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr.dataUrl} alt="Código QR de la sede" className="mx-auto w-full max-w-[18rem] rounded-xl border border-ink-100" />
          ) : (
            <Spinner />
          )}
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold">QR de la entrada</h2>
          <p className="mt-1 text-sm text-ink-600">
            Imprímelo y pégalo en la entrada. Socios y coaches lo escanean con su celular, escriben su documento y marcan. Si el QR se filtra
            o lo fotografían para marcar desde fuera, regéneralo: el anterior deja de funcionar.
          </p>
          {qr && <p className="mt-2 break-all rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-500">{qr.url}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => window.print()} className="btn-ghost"><Printer size={16} /> Imprimir</button>
            <button type="button" onClick={() => void regenerar()} disabled={regenerando} className="btn-ghost">{regenerando ? <Spinner /> : <RefreshCw size={16} />} Regenerar QR</button>
          </div>
        </div>
      </section>

      {form && (
        <form onSubmit={guardar} className="card-surface space-y-6">
          <div>
            <h2 className="font-display text-2xl font-bold">Gimnasio</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <Campo id="ng" titulo="Nombre comercial" valor={form.nombreGimnasio} onChange={(v) => set('nombreGimnasio', v)} requerido />
              <Campo id="dir" titulo="Dirección" valor={form.direccion ?? ''} onChange={(v) => set('direccion', v)} />
              <Campo id="tel" titulo="Teléfono" valor={form.telefonoContacto ?? ''} onChange={(v) => set('telefonoContacto', v)} />
            </div>
          </div>

          <div>
            <h2 className="font-display text-2xl font-bold">Datos fiscales del emisor</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Campo id="ruc" titulo="RUC" valor={form.ruc ?? ''} onChange={(v) => set('ruc', v)} />
              <Campo id="rs" titulo="Razón social" valor={form.razonSocial ?? ''} onChange={(v) => set('razonSocial', v)} />
              <Campo id="df" titulo="Dirección fiscal" valor={form.direccionFiscal ?? ''} onChange={(v) => set('direccionFiscal', v)} />
              <Campo id="ub" titulo="Ubigeo" valor={form.codigoUbigeo ?? ''} onChange={(v) => set('codigoUbigeo', v)} />
            </div>
            <p className="mt-3 rounded-xl bg-ink-50 px-4 py-3 text-sm text-ink-600">
              Los comprobantes se envían a SUNAT <strong>automáticamente al emitirse</strong>. Si el envío falla, se reintenta solo cada noche, y el facturador envía el resumen diario de boletas a las 00:10 de Lima. No hay envío manual.
            </p>
          </div>

          <div>
            <h2 className="font-display text-2xl font-bold">Membresías y asistencia</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <Numero id="av" titulo="Marcar “por vencer” desde (días)" valor={form.diasAvisoVencimiento} onChange={(v) => set('diasAvisoVencimiento', v)} />
              <Numero id="gr" titulo="Días de gracia tras vencer" valor={form.diasGracia} onChange={(v) => set('diasGracia', v)} />
              <Numero id="ad" titulo="No repetir ingreso antes de (min)" valor={form.minutosAntiDuplicadoIngreso} onChange={(v) => set('minutosAntiDuplicadoIngreso', v)} />
            </div>
          </div>

          <div>
            <h2 className="font-display text-2xl font-bold">Avisos por WhatsApp</h2>
            <label className="mt-3 flex items-start gap-3 rounded-xl bg-ink-50 px-4 py-3 text-sm">
              <input type="checkbox" checked={form.whatsappActivo} onChange={(e) => set('whatsappActivo', e.target.checked)} className="mt-0.5 h-5 w-5 accent-laufit-600" />
              <span>Enviar por WhatsApp la bienvenida, el comprobante y los avisos de vencimiento (solo a socios que aceptaron). Con esto apagado no sale ningún mensaje.</span>
            </label>
          </div>

          <div className="flex justify-end"><button type="submit" disabled={guardando} className="btn-brand">{guardando && <Spinner />} Guardar ajustes</button></div>
        </form>
      )}

      <section className="card-surface">
        <h2 className="font-display text-2xl font-bold">Series de comprobantes</h2>
        <p className="mt-1 text-sm text-ink-500">Deben coincidir con las series habilitadas en SUNAT para el RUC. La numeración continúa desde 000001 en cada serie nueva.</p>
        <ul className="mt-3 divide-y divide-ink-100 text-sm">
          {series?.map((s) => (
            <li key={s.id} className="flex justify-between py-2"><span>{TIPO_SERIE[s.tipoComprobante] ?? s.tipoComprobante}</span><strong>{s.serie}</strong></li>
          ))}
        </ul>
        <form onSubmit={agregarSerie} className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="stipo" className="label">Tipo</label>
            <select id="stipo" value={nuevaSerie.tipoComprobante} onChange={(e) => setNuevaSerie({ ...nuevaSerie, tipoComprobante: e.target.value })} className="field w-48">
              <option value="03">Boletas</option>
              <option value="01">Facturas</option>
              <option value="07">Notas de crédito</option>
              <option value="50">Notas de despacho (internas)</option>
            </select>
          </div>
          <div>
            <label htmlFor="sserie" className="label">Serie (3 caracteres)</label>
            <input id="sserie" value={nuevaSerie.serie} onChange={(e) => setNuevaSerie({ ...nuevaSerie, serie: e.target.value.toUpperCase() })} maxLength={3} className="field w-32" placeholder="001" required />
          </div>
          <button type="submit" className="btn-ghost">Agregar serie</button>
        </form>
      </section>
    </div>
  )
}

function Campo({ id, titulo, valor, onChange, requerido }: { id: string; titulo: string; valor: string; onChange: (v: string) => void; requerido?: boolean }) {
  return (
    <div>
      <label htmlFor={id} className="label">{titulo}</label>
      <input id={id} value={valor} onChange={(e) => onChange(e.target.value)} required={requerido} className="field" />
    </div>
  )
}

function Numero({ id, titulo, valor, onChange }: { id: string; titulo: string; valor: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label htmlFor={id} className="label">{titulo}</label>
      <input id={id} type="number" min={0} max={365} value={valor} onChange={(e) => onChange(Number(e.target.value))} className="field" />
    </div>
  )
}
