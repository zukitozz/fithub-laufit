'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Plus } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { api, fechaCorta, fetcher } from '@/components/ui'
import { ROLE_LABELS, type UserRole } from '@/types/user'

interface Usuario { id: string; name: string; email: string; role: UserRole; activo: boolean; createdAt: string }
interface Form { id?: string; name: string; email: string; role: UserRole; password: string; activo: boolean }

const NUEVO: Form = { name: '', email: '', role: 'ADMIN', password: '', activo: true }

export default function UsuariosPage() {
  const toast = useToast()
  const { data, error, mutate } = useSWR<Usuario[]>('/api/usuarios', fetcher)
  const [form, setForm] = useState<Form | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [errorForm, setErrorForm] = useState<string | null>(null)

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    setEnviando(true)
    setErrorForm(null)
    const { id, password, ...resto } = form
    // Al editar, una contraseña vacía significa "no cambiarla".
    const cuerpo = id ? { ...resto, ...(password ? { password } : {}) } : { ...resto, password }
    const r = await api(id ? `/api/usuarios/${id}` : '/api/usuarios', { method: id ? 'PATCH' : 'POST', body: cuerpo })
    setEnviando(false)
    if (!r.ok) return setErrorForm(r.error)
    toast.success(id ? 'Usuario actualizado' : 'Usuario creado')
    setForm(null)
    void mutate()
  }

  return (
    <div className="p-4 md:p-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Acceso</p>
          <h1 className="page-heading text-4xl">Usuarios</h1>
          <p className="text-sm text-ink-500">
            Quienes inician sesión en el sistema. Los socios y los coaches no tienen usuario: marcan con su documento.
          </p>
        </div>
        <button type="button" onClick={() => { setErrorForm(null); setForm({ ...NUEVO }) }} className="btn-brand"><Plus size={18} /> Nuevo usuario</button>
      </header>

      {error && <p role="alert" className="mb-3 text-danger-700">{String(error.message)}</p>}
      <div className="card-surface overflow-x-auto p-0">
        <table className="w-full min-w-[560px]">
          <thead className="border-b border-ink-100"><tr><th className="th">Nombre</th><th className="th">Correo</th><th className="th">Rol</th><th className="th">Estado</th><th className="th">Creado</th><th className="th" /></tr></thead>
          <tbody className="divide-y divide-ink-100">
            {!data && <tr><td colSpan={6} className="td text-center"><Spinner /></td></tr>}
            {data?.map((u) => (
              <tr key={u.id} className={u.activo ? '' : 'opacity-50'}>
                <td className="td font-semibold">{u.name}</td>
                <td className="td">{u.email}</td>
                <td className="td"><span className={`badge ${u.role === 'SUPERVISOR' ? 'bg-brand-100 text-brand-800' : 'bg-ink-100 text-ink-700'}`}>{ROLE_LABELS[u.role]}</span></td>
                <td className="td">{u.activo ? 'Activo' : 'Inactivo'}</td>
                <td className="td text-ink-500">{fechaCorta(u.createdAt)}</td>
                <td className="td text-right">
                  <button type="button" onClick={() => { setErrorForm(null); setForm({ id: u.id, name: u.name, email: u.email, role: u.role, password: '', activo: u.activo }) }} className="btn-ghost btn-sm">Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-ink-400">
        Gerente: acceso total (planes, coaches, ajustes, usuarios, anular membresías). Administrador: socios, ventas, ingresos en vivo, coaches y facturación.
      </p>

      {form && (
        <Modal title={form.id ? 'Editar usuario' : 'Nuevo usuario'} onClose={() => setForm(null)}>
          <form onSubmit={guardar} className="space-y-4">
            <div>
              <label htmlFor="un" className="label">Nombre</label>
              <input id="un" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="field" />
            </div>
            <div>
              <label htmlFor="ue" className="label">Correo (para iniciar sesión)</label>
              <input id="ue" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="field" autoComplete="off" />
            </div>
            <p className="text-sm text-ink-600">Rol: <strong>{ROLE_LABELS[form.role]}</strong>{!form.id && <span className="text-ink-400"> (los usuarios nuevos siempre son Administradores)</span>}</p>
            <div>
              <label htmlFor="up" className="label">{form.id ? 'Nueva contraseña (vacío = no cambiar)' : 'Contraseña (mínimo 8 caracteres)'}</label>
              <input id="up" type="password" required={!form.id} minLength={form.id && !form.password ? undefined : 8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="field" autoComplete="new-password" />
            </div>
            {form.id && (
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} className="h-5 w-5 accent-brand-600" /> Usuario activo (puede iniciar sesión)
              </label>
            )}
            {errorForm && <p role="alert" className="rounded-xl bg-danger-50 px-4 py-2 text-sm font-semibold text-danger-700">{errorForm}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setForm(null)} className="btn-ghost">Cancelar</button>
              <button type="submit" disabled={enviando} className="btn-brand">{enviando && <Spinner />} Guardar</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
