'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Modal } from '@/components/Modal'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { api, fechaHoraLima, fetcher } from '@/components/ui'

export type MotivoContacto = 'VENCIMIENTO' | 'CUMPLEANOS' | 'OTRO'

interface Contacto { id: string; motivo: MotivoContacto; nota: string; creadoAt: string; usuario: string }

const ETIQUETA_MOTIVO: Record<MotivoContacto, string> = { VENCIMIENTO: 'Renovación', CUMPLEANOS: 'Cumpleaños', OTRO: 'Otro' }

const FRASES: Record<MotivoContacto, string[]> = {
  VENCIMIENTO: ['No contestó', 'Dijo que renueva', 'Renovará esta semana', 'Pidió que lo llamen luego', 'No le interesa'],
  CUMPLEANOS: ['Saludo de cumpleaños'],
  OTRO: ['No contestó'],
}

const POSPONER = [
  { dias: 0, etiqueta: 'No posponer' },
  { dias: 1, etiqueta: 'Mañana' },
  { dias: 3, etiqueta: 'En 3 días' },
  { dias: 7, etiqueta: 'En 1 semana' },
]

interface Props {
  readonly socio: { id: string; nombre: string }
  readonly motivo: MotivoContacto
  /** Muestra la opción de posponer el recordatorio de renovación. */
  readonly permitePosponer?: boolean
  readonly onClose: () => void
  readonly onHecho: () => void
}

/** Registra qué pasó al contactar a un socio (y opcionalmente lo pospone) y muestra el historial de contactos. */
export function ContactoModal({ socio, motivo, permitePosponer = false, onClose, onHecho }: Props) {
  const toast = useToast()
  const { data: historial } = useSWR<Contacto[]>(`/api/socios/${socio.id}/contactos`, fetcher)
  const [nota, setNota] = useState('')
  const [posponer, setPosponer] = useState(0)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    const r = await api(`/api/socios/${socio.id}/contactos`, { method: 'POST', body: { motivo, nota, posponerDias: posponer } })
    setEnviando(false)
    if (!r.ok) return setError(r.error)
    toast.success(posponer > 0 ? 'Contacto registrado y recordatorio pospuesto' : 'Contacto registrado')
    onHecho()
  }

  return (
    <Modal title={`Contacto · ${socio.nombre}`} onClose={onClose}>
      <form onSubmit={guardar} className="space-y-4">
        <div>
          <label htmlFor="nota-contacto" className="label">¿Qué pasó?</label>
          <textarea id="nota-contacto" required autoFocus rows={2} maxLength={500} value={nota} onChange={(e) => setNota(e.target.value)} className="field" placeholder="Ej.: Dijo que renueva el viernes" />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {FRASES[motivo].map((f) => (
              <button type="button" key={f} onClick={() => setNota(f)} className="rounded-full bg-ink-100 px-3 py-1 text-xs font-semibold text-ink-700 hover:bg-ink-200">{f}</button>
            ))}
          </div>
        </div>

        {permitePosponer && (
          <div>
            <label htmlFor="posponer-contacto" className="label">Volver a avisarme</label>
            <select id="posponer-contacto" value={posponer} onChange={(e) => setPosponer(Number(e.target.value))} className="field">
              {POSPONER.map((p) => <option key={p.dias} value={p.dias}>{p.etiqueta}</option>)}
            </select>
            <p className="mt-1 text-xs text-ink-400">Mientras tanto pasa a “Pospuestos” y vuelve solo a la lista.</p>
          </div>
        )}

        {error && <p role="alert" className="rounded-xl bg-danger-50 px-4 py-2 text-sm font-semibold text-danger-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
          <button type="submit" disabled={enviando || nota.trim().length < 2} className="btn-brand">{enviando && <Spinner />} Guardar contacto</button>
        </div>
      </form>

      <div className="mt-6 border-t border-ink-100 pt-4">
        <h3 className="font-display text-xl font-bold">Historial</h3>
        {!historial && <p className="mt-2 text-sm text-ink-500"><Spinner /> Cargando…</p>}
        {historial && historial.length === 0 && <p className="mt-2 text-sm text-ink-500">Aún no hay contactos registrados.</p>}
        <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
          {historial?.map((c) => (
            <li key={c.id} className="rounded-xl bg-ink-50 px-3 py-2 text-sm">
              <p className="text-xs text-ink-400">{fechaHoraLima(c.creadoAt)} · {c.usuario} · {ETIQUETA_MOTIVO[c.motivo]}</p>
              <p className="text-ink-800">{c.nota}</p>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  )
}
