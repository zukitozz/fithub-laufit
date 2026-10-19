'use client'

import { useEffect, useState } from 'react'
import { Camera } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { Avatar, api } from '@/components/ui'

export interface SocioForm {
  id?: string
  nombre: string
  tipoDocumento: 'DNI' | 'CE'
  numeroDocumento: string
  celular: string
  email: string
  fechaNacimiento: string
  contactoEmergencia: string
  telefonoEmergencia: string
  condicionMedica: string
  notas: string
  rucFactura: string
  razonSocial: string
  consentimientoWhatsApp: boolean
  fotoUrl?: string | null
}

export const SOCIO_VACIO: SocioForm = {
  nombre: '', tipoDocumento: 'DNI', numeroDocumento: '', celular: '', email: '', fechaNacimiento: '',
  contactoEmergencia: '', telefonoEmergencia: '', condicionMedica: '', notas: '', rucFactura: '', razonSocial: '',
  consentimientoWhatsApp: false,
}

interface Props {
  inicial: SocioForm
  onClose: () => void
  /** Recibe el id del socio guardado (para encadenar la venta de membresía). */
  onGuardado: (socioId: string, nombre: string, esNuevo: boolean) => void
}

export function SocioFormModal({ inicial, onClose, onGuardado }: Props) {
  const toast = useToast()
  const [form, setForm] = useState<SocioForm>(inicial)
  const [foto, setFoto] = useState<File | null>(null)
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const esNuevo = !inicial.id

  useEffect(() => {
    if (!foto) return setVistaPrevia(null)
    const url = URL.createObjectURL(foto)
    setVistaPrevia(url)
    return () => URL.revokeObjectURL(url)
  }, [foto])

  const set = <K extends keyof SocioForm>(campo: K, valor: SocioForm[K]) => setForm((f) => ({ ...f, [campo]: valor }))

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    const { id, fotoUrl: _fotoUrl, ...cuerpo } = form
    const r = await api<{ id: string; nombre: string }>(id ? `/api/socios/${id}` : '/api/socios', { method: id ? 'PATCH' : 'POST', body: cuerpo })
    if (!r.ok) {
      setEnviando(false)
      return setError(r.error)
    }

    if (foto) {
      const datos = new FormData()
      datos.append('foto', foto)
      const res = await fetch(`/api/socios/${r.data.id}/foto`, { method: 'POST', body: datos })
      if (!res.ok) toast.error((await res.json().catch(() => null))?.error ?? 'El socio se guardó, pero no se pudo subir la foto')
    }
    setEnviando(false)
    toast.success(esNuevo ? 'Socio registrado' : 'Socio actualizado')
    onGuardado(r.data.id, r.data.nombre, esNuevo)
  }

  return (
    <Modal title={esNuevo ? 'Nuevo socio' : 'Editar socio'} onClose={onClose}>
      <form onSubmit={guardar} className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar nombre={form.nombre || '?'} url={vistaPrevia ?? form.fotoUrl} className="h-24 w-24 text-2xl" />
          <div>
            <label className="btn-ghost btn-sm cursor-pointer">
              <Camera size={15} /> {form.fotoUrl || foto ? 'Cambiar foto' : 'Tomar o subir foto'}
              <input type="file" accept="image/jpeg,image/png,image/webp" capture="user" className="sr-only" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
            </label>
            <p className="mt-1 text-xs text-ink-400">La administradora la usa para verificar quién marca su ingreso.</p>
          </div>
        </div>

        <div>
          <label htmlFor="nombre" className="label">Nombre completo</label>
          <input id="nombre" required value={form.nombre} onChange={(e) => set('nombre', e.target.value)} className="field" autoComplete="off" />
        </div>

        <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
          <div>
            <label htmlFor="tipoDoc" className="label">Documento</label>
            <select id="tipoDoc" value={form.tipoDocumento} onChange={(e) => set('tipoDocumento', e.target.value as 'DNI' | 'CE')} className="field">
              <option value="DNI">DNI</option>
              <option value="CE">Carnet de extranjería</option>
            </select>
          </div>
          <div>
            <label htmlFor="numDoc" className="label">Número</label>
            <input id="numDoc" required value={form.numeroDocumento} onChange={(e) => set('numeroDocumento', e.target.value)} className="field" inputMode={form.tipoDocumento === 'DNI' ? 'numeric' : 'text'} autoComplete="off" />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="celular" className="label">Celular (WhatsApp)</label>
            <input id="celular" value={form.celular} onChange={(e) => set('celular', e.target.value)} className="field" inputMode="tel" placeholder="987654321" />
          </div>
          <div>
            <label htmlFor="nac" className="label">Fecha de nacimiento</label>
            <input id="nac" type="date" value={form.fechaNacimiento} onChange={(e) => set('fechaNacimiento', e.target.value)} className="field" />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="label">Correo (opcional)</label>
          <input id="email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className="field" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="emer" className="label">Contacto de emergencia</label>
            <input id="emer" value={form.contactoEmergencia} onChange={(e) => set('contactoEmergencia', e.target.value)} className="field" />
          </div>
          <div>
            <label htmlFor="emerTel" className="label">Teléfono de emergencia</label>
            <input id="emerTel" value={form.telefonoEmergencia} onChange={(e) => set('telefonoEmergencia', e.target.value)} className="field" inputMode="tel" />
          </div>
        </div>

        <div>
          <label htmlFor="medica" className="label">Condición médica (la ve recepción al marcar)</label>
          <input id="medica" value={form.condicionMedica} onChange={(e) => set('condicionMedica', e.target.value)} className="field" placeholder="Hipertensión, lesión de rodilla…" />
        </div>
        <div>
          <label htmlFor="notas" className="label">Notas</label>
          <textarea id="notas" rows={2} value={form.notas} onChange={(e) => set('notas', e.target.value)} className="field" />
        </div>

        <details className="rounded-xl border border-ink-100 px-4 py-2">
          <summary className="cursor-pointer text-sm font-semibold text-ink-600">Datos para factura (opcional)</summary>
          <div className="mt-3 grid gap-3 pb-2 sm:grid-cols-2">
            <div>
              <label htmlFor="rucf" className="label">RUC</label>
              <input id="rucf" value={form.rucFactura} onChange={(e) => set('rucFactura', e.target.value)} className="field" inputMode="numeric" />
            </div>
            <div>
              <label htmlFor="razonf" className="label">Razón social</label>
              <input id="razonf" value={form.razonSocial} onChange={(e) => set('razonSocial', e.target.value)} className="field" />
            </div>
          </div>
        </details>

        <label className="flex items-start gap-3 rounded-xl bg-ink-50 px-4 py-3 text-sm">
          <input type="checkbox" checked={form.consentimientoWhatsApp} onChange={(e) => set('consentimientoWhatsApp', e.target.checked)} className="mt-0.5 h-5 w-5 accent-laufit-600" />
          <span>El socio acepta recibir su comprobante y avisos de vencimiento por WhatsApp.</span>
        </label>

        {error && <p role="alert" className="rounded-xl bg-laufit-50 px-4 py-2 text-sm font-semibold text-laufit-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
          <button type="submit" disabled={enviando} className="btn-brand">{enviando && <Spinner />} {esNuevo ? 'Registrar' : 'Guardar'}</button>
        </div>
      </form>
    </Modal>
  )
}
