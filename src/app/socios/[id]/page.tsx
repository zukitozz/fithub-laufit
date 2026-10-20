'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import useSWR from 'swr'
import { ArrowLeft, Pencil } from 'lucide-react'
import { ContactoModal } from '@/components/ContactoModal'
import { Modal } from '@/components/Modal'
import { SocioFormModal, type SocioForm } from '@/components/SocioFormModal'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { VentaMembresiaModal } from '@/components/VentaMembresiaModal'
import { Avatar, EstadoBadge, api, fechaCorta, fechaHoraLima, fetcher, soles, textoDias } from '@/components/ui'

interface Detalle {
  id: string
  nombre: string
  tipoDocumento: 'DNI' | 'CE'
  numeroDocumento: string
  celular: string | null
  email: string | null
  fechaNacimiento: string | null
  contactoEmergencia: string | null
  telefonoEmergencia: string | null
  condicionMedica: string | null
  notas: string | null
  rucFactura: string | null
  razonSocial: string | null
  consentimientoWhatsApp: boolean
  consentimientoWhatsAppAt: string | null
  bajaVoluntariaWhatsApp: boolean
  enviosWhatsApp: { id: string; tipo: string; estado: string; error: string | null; creadoAt: string }[]
  fotoUrl: string | null
  estado: string
  diasRestantes: number | null
  fechaFin: string | null
  membresias: {
    id: string
    plan: { nombre: string }
    fechaInicio: string
    fechaFin: string
    precio: number
    estado: string
    anuladaMotivo: string | null
    factura: { id: string; tipo: string; numeracionComprobante: string | null; enviado: boolean } | null
  }[]
  asistencias: { id: string; fechaHora: string; validacion: string; origen: string }[]
}

const ETIQUETA_AVISO: Record<string, string> = { BIENVENIDA: 'Bienvenida', COMPROBANTE: 'Comprobante', D3: 'Vence en 3 días', D0: 'Vence hoy' }
const ETIQUETA_ENVIO: Record<string, string> = { ENVIADO: 'Enviado', PENDIENTE: 'Pendiente', FALLIDO: 'Fallido', SIN_CONSENTIMIENTO: 'Sin consentimiento' }

export default function SocioPage() {
  const { id } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const toast = useToast()
  const { data, error, mutate } = useSWR<Detalle>(`/api/socios/${id}`, fetcher)
  const { data: contactos, mutate: recargarContactos } = useSWR<{ id: string; motivo: string; nota: string; creadoAt: string; usuario: string }[]>(`/api/socios/${id}/contactos`, fetcher)
  const [contactando, setContactando] = useState(false)
  const [editando, setEditando] = useState(false)
  const [venta, setVenta] = useState(false)
  const [anulando, setAnulando] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)

  if (error) return <div className="p-8"><p role="alert" className="text-laufit-700">{String(error.message)}</p></div>
  if (!data) return <div className="p-8 text-ink-500"><Spinner /> Cargando…</div>

  const esGerente = session?.user?.role === 'SUPERVISOR'
  const inicial: SocioForm = {
    id: data.id,
    nombre: data.nombre,
    tipoDocumento: data.tipoDocumento,
    numeroDocumento: data.numeroDocumento,
    celular: data.celular?.replace('+51', '') ?? '',
    email: data.email ?? '',
    fechaNacimiento: data.fechaNacimiento?.slice(0, 10) ?? '',
    contactoEmergencia: data.contactoEmergencia ?? '',
    telefonoEmergencia: data.telefonoEmergencia ?? '',
    condicionMedica: data.condicionMedica ?? '',
    notas: data.notas ?? '',
    rucFactura: data.rucFactura ?? '',
    razonSocial: data.razonSocial ?? '',
    consentimientoWhatsApp: data.consentimientoWhatsApp,
    bajaVoluntariaWhatsApp: data.bajaVoluntariaWhatsApp,
    fotoUrl: data.fotoUrl,
  }

  async function anular(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    const r = await api<{ notaCredito: { numeracionComprobante: string } | null }>(`/api/membresias/${anulando}/anular`, { method: 'POST', body: { motivo } })
    setEnviando(false)
    if (!r.ok) return toast.error(r.error)
    toast.success(r.data.notaCredito ? `Membresía anulada. Nota de crédito ${r.data.notaCredito.numeracionComprobante}` : 'Membresía anulada')
    setAnulando(null)
    setMotivo('')
    void mutate()
  }

  return (
    <div className="p-4 md:p-8">
      <Link href="/socios" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-laufit-600"><ArrowLeft size={16} /> Socios</Link>

      <header className="card-surface flex flex-wrap items-center gap-5">
        <Avatar nombre={data.nombre} url={data.fotoUrl} className="h-24 w-24 text-3xl" />
        <div className="min-w-0 flex-1">
          <h1 className="page-heading text-4xl leading-none">{data.nombre}</h1>
          <p className="mt-1 text-sm text-ink-500">{data.tipoDocumento} {data.numeroDocumento}{data.celular && <> · {data.celular}</>}{data.email && <> · {data.email}</>}</p>
          <p className="mt-2 flex items-center gap-2"><EstadoBadge estado={data.estado} /> <span className="text-sm text-ink-600">{data.estado === 'SIN_MEMBRESIA' ? '' : `${textoDias(data.diasRestantes)} · vence ${fechaCorta(data.fechaFin)}`}</span></p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setEditando(true)} className="btn-ghost"><Pencil size={16} /> Editar</button>
          <button type="button" onClick={() => setVenta(true)} className="btn-brand">{data.estado === 'SIN_MEMBRESIA' ? 'Vender membresía' : 'Renovar'}</button>
        </div>
      </header>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <section className="card-surface p-0 lg:col-span-2">
          <h2 className="px-5 pt-4 font-display text-2xl font-bold">Membresías</h2>
          <div className="overflow-x-auto">
            <table className="mt-2 w-full min-w-[560px]">
              <thead className="border-b border-ink-100"><tr><th className="th">Plan</th><th className="th">Periodo</th><th className="th">Estado</th><th className="th">Comprobante</th><th className="th" /></tr></thead>
              <tbody className="divide-y divide-ink-100">
                {data.membresias.map((m) => (
                  <tr key={m.id}>
                    <td className="td font-semibold">{m.plan.nombre}<span className="block text-xs font-normal text-ink-400">{soles(m.precio)}</span></td>
                    <td className="td">{fechaCorta(m.fechaInicio)} → {fechaCorta(m.fechaFin)}</td>
                    <td className="td"><EstadoBadge estado={m.estado} />{m.anuladaMotivo && <span className="block text-xs text-ink-400">{m.anuladaMotivo}</span>}</td>
                    <td className="td text-xs">{m.factura ? <a href={`/api/facturacion/${m.factura.id}/pdf`} target="_blank" rel="noopener noreferrer" className="font-semibold text-laufit-600 underline">{m.factura.numeracionComprobante ?? 'PDF'}</a> : '—'}{m.factura && !m.factura.enviado && m.factura.tipo !== 'NOTA_DESPACHO' && <span className="block text-amber-700">Pendiente en SUNAT</span>}</td>
                    <td className="td text-right">
                      {esGerente && m.estado !== 'ANULADA' && <button type="button" onClick={() => setAnulando(m.id)} className="btn-ghost btn-sm">Anular</button>}
                    </td>
                  </tr>
                ))}
                {data.membresias.length === 0 && <tr><td colSpan={5} className="td py-8 text-center text-ink-500">Aún no tiene membresías.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-5">
          <section className="card-surface">
            <h2 className="font-display text-2xl font-bold">Datos</h2>
            <dl className="mt-2 space-y-2 text-sm">
              <Dato titulo="Nacimiento" valor={fechaCorta(data.fechaNacimiento)} />
              <Dato titulo="Emergencia" valor={[data.contactoEmergencia, data.telefonoEmergencia].filter(Boolean).join(' · ') || '—'} />
              <Dato titulo="Condición médica" valor={data.condicionMedica ?? '—'} />
              <Dato titulo="Notas" valor={data.notas ?? '—'} />
              <Dato titulo="Datos de factura" valor={data.rucFactura ? `${data.rucFactura} · ${data.razonSocial ?? ''}` : '—'} />
              <Dato titulo="WhatsApp" valor={data.bajaVoluntariaWhatsApp ? 'Pidió no recibir mensajes (baja voluntaria)' : data.consentimientoWhatsApp ? `Aceptado ${fechaHoraLima(data.consentimientoWhatsAppAt)}` : 'Sin consentimiento'} />
            </dl>
            {data.enviosWhatsApp.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-ink-100 pt-3 text-xs text-ink-500">
                {data.enviosWhatsApp.map((e) => (
                  <li key={e.id} className="flex justify-between gap-2" title={e.error ?? undefined}>
                    <span>{fechaHoraLima(e.creadoAt)} · {ETIQUETA_AVISO[e.tipo] ?? e.tipo}</span>
                    <span className="font-semibold">{ETIQUETA_ENVIO[e.estado] ?? e.estado}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card-surface">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold">Contactos</h2>
              <button type="button" onClick={() => setContactando(true)} className="btn-ghost btn-sm">Registrar</button>
            </div>
            <ul className="mt-2 space-y-2 text-sm">
              {contactos?.slice(0, 5).map((c) => (
                <li key={c.id} className="rounded-xl bg-ink-50 px-3 py-2">
                  <p className="text-xs text-ink-400">{fechaHoraLima(c.creadoAt)} · {c.usuario}</p>
                  <p>{c.nota}</p>
                </li>
              ))}
              {contactos && contactos.length === 0 && <li className="text-ink-500">Sin contactos registrados.</li>}
            </ul>
          </section>

          <section className="card-surface">
            <h2 className="font-display text-2xl font-bold">Últimas asistencias</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {data.asistencias.slice(0, 10).map((a) => (
                <li key={a.id} className="flex justify-between"><span>{fechaHoraLima(a.fechaHora)}</span><span className="text-xs text-ink-400">{a.origen === 'QR' ? 'QR' : 'Recepción'}</span></li>
              ))}
              {data.asistencias.length === 0 && <li className="text-ink-500">Sin asistencias registradas.</li>}
            </ul>
          </section>
        </aside>
      </div>

      {contactando && data && <ContactoModal socio={{ id: data.id, nombre: data.nombre }} motivo="OTRO" onClose={() => setContactando(false)} onHecho={() => { setContactando(false); void recargarContactos() }} />}
      {editando && <SocioFormModal inicial={inicial} onClose={() => setEditando(false)} onGuardado={() => { setEditando(false); void mutate() }} />}
      {venta && <VentaMembresiaModal socio={{ id: data.id, nombre: data.nombre }} onClose={() => setVenta(false)} onHecho={() => { setVenta(false); void mutate() }} />}
      {anulando && (
        <Modal title="Anular membresía" onClose={() => setAnulando(null)}>
          <form onSubmit={anular} className="space-y-4">
            <p className="text-sm text-ink-600">Se anulará la membresía y, si tenía comprobante, se emitirá una <strong>nota de crédito</strong> por el total.</p>
            <div>
              <label htmlFor="motivo" className="label">Motivo</label>
              <input id="motivo" required minLength={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} className="field" />
            </div>
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

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-ink-400">{titulo}</dt>
      <dd className="text-ink-800">{valor}</dd>
    </div>
  )
}
