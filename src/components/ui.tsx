'use client'

import { useEffect, useState } from 'react'

export const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`)
  return res.json()
}

/** Llama a la API y devuelve { ok, data, error } sin lanzar. */
export async function api<T = unknown>(url: string, opciones?: { method?: string; body?: unknown }) {
  try {
    const res = await fetch(url, {
      method: opciones?.method ?? 'GET',
      headers: opciones?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: opciones?.body !== undefined ? JSON.stringify(opciones.body) : undefined,
    })
    const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null
    if (!res.ok) return { ok: false as const, data: null, error: data?.error ?? `Error ${res.status}` }
    return { ok: true as const, data: data as T, error: null }
  } catch {
    return { ok: false as const, data: null, error: 'Sin conexión con el servidor' }
  }
}

const ESTADOS: Record<string, { texto: string; clase: string }> = {
  VIGENTE: { texto: 'Vigente', clase: 'bg-emerald-100 text-emerald-800' },
  POR_VENCER: { texto: 'Por vencer', clase: 'bg-amber-100 text-amber-800' },
  VENCIDA: { texto: 'Vencida', clase: 'bg-laufit-100 text-laufit-800' },
  PROGRAMADA: { texto: 'Programada', clase: 'bg-sky-100 text-sky-800' },
  ANULADA: { texto: 'Anulada', clase: 'bg-ink-100 text-ink-500' },
  SIN_MEMBRESIA: { texto: 'Sin membresía', clase: 'bg-ink-100 text-ink-600' },
}

export function EstadoBadge({ estado }: { estado: string }) {
  const e = ESTADOS[estado] ?? { texto: estado, clase: 'bg-ink-100 text-ink-600' }
  return <span className={`badge ${e.clase}`}>{e.texto}</span>
}

export function fechaCorta(valor: string | Date | null | undefined) {
  if (!valor) return '—'
  const texto = typeof valor === 'string' ? valor : valor.toISOString()
  const [a, m, d] = texto.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

export function horaLima(valor: string | Date | null | undefined) {
  if (!valor) return '—'
  return new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(valor))
}

export function fechaHoraLima(valor: string | Date | null | undefined) {
  if (!valor) return '—'
  return new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(valor))
}

export const soles = (n: number | null | undefined) => `S/ ${(n ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function textoDias(dias: number | null) {
  if (dias === null) return '—'
  if (dias < 0) return `Venció hace ${-dias} ${-dias === 1 ? 'día' : 'días'}`
  if (dias === 0) return 'Vence hoy'
  return `${dias} ${dias === 1 ? 'día' : 'días'}`
}

/** Hace cuánto: "hace 3 min". Se refresca solo cada 30 s. */
export function useAhora(intervaloMs = 30_000) {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), intervaloMs)
    return () => clearInterval(id)
  }, [intervaloMs])
  return ahora
}

export function haceCuanto(valor: string | Date, ahora: number) {
  const min = Math.max(0, Math.round((ahora - new Date(valor).getTime()) / 60_000))
  if (min < 1) return 'ahora mismo'
  if (min < 60) return `hace ${min} min`
  return `hace ${Math.floor(min / 60)} h ${min % 60} min`
}

export function Avatar({ nombre, url, className = 'h-12 w-12 text-base' }: { nombre: string; url?: string | null; className?: string }) {
  const iniciales = nombre.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
  // eslint-disable-next-line @next/next/no-img-element
  if (url) return <img src={url} alt={`Foto de ${nombre}`} className={`${className} shrink-0 rounded-2xl object-cover`} />
  return <div className={`${className} flex shrink-0 items-center justify-center rounded-2xl bg-ink-800 font-bold text-white`}>{iniciales}</div>
}

/** "hoy", "ayer" o "hace N días" a partir de una fecha (se compara por día calendario de Lima). */
export function haceDias(valor: string | Date | null | undefined) {
  if (!valor) return null
  const dia = (f: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(f)
  const [a, m, d] = dia(new Date(valor)).split('-').map(Number)
  const [ha, hm, hd] = dia(new Date()).split('-').map(Number)
  const n = Math.round((Date.UTC(ha, hm - 1, hd) - Date.UTC(a, m - 1, d)) / 86_400_000)
  if (n <= 0) return 'hoy'
  if (n === 1) return 'ayer'
  return `hace ${n} días`
}
