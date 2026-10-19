'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Avatar, EstadoBadge } from '@/components/ui'

export interface SocioSugerido {
  id: string
  nombre: string
  tipoDocumento: string
  numeroDocumento: string
  celular: string | null
  fotoUrl: string | null
  estado: string
  diasRestantes: number | null
  rucFactura: string | null
  razonSocial: string | null
}

interface Props {
  readonly value: SocioSugerido | null
  readonly onChange: (socio: SocioSugerido | null) => void
  readonly placeholder?: string
  readonly inputRef?: React.RefObject<HTMLInputElement>
}

const MAX_SUGERENCIAS = 8

/**
 * Autocompletado de socio: escribe parte del nombre, el DNI o el celular y elige con el mouse o con
 * ↑ ↓ Enter. Consulta a la API con una pequeña espera para no disparar una petición por tecla.
 */
export function SocioCombobox({ value, onChange, placeholder = 'Buscar cliente por nombre, DNI o celular', inputRef }: Props) {
  const id = useId()
  const [texto, setTexto] = useState('')
  const [sugerencias, setSugerencias] = useState<SocioSugerido[]>([])
  const [abierto, setAbierto] = useState(false)
  const [activo, setActivo] = useState(0)
  const [cargando, setCargando] = useState(false)
  const contenedor = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const q = texto.trim()
    if (q.length < 2) {
      setSugerencias([])
      return
    }
    let vigente = true
    setCargando(true)
    const espera = setTimeout(async () => {
      try {
        const res = await fetch(`/api/socios?q=${encodeURIComponent(q)}`)
        const data = res.ok ? await res.json() : { items: [] }
        if (!vigente) return
        setSugerencias((data.items as SocioSugerido[]).slice(0, MAX_SUGERENCIAS))
        setActivo(0)
      } finally {
        if (vigente) setCargando(false)
      }
    }, 250)
    return () => {
      vigente = false
      clearTimeout(espera)
    }
  }, [texto])

  // Cierra la lista al hacer clic fuera.
  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [])

  function elegir(socio: SocioSugerido) {
    onChange(socio)
    setTexto('')
    setSugerencias([])
    setAbierto(false)
  }

  function teclas(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAbierto(true)
      setActivo((a) => Math.min(a + 1, sugerencias.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActivo((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter' && abierto && sugerencias[activo]) {
      e.preventDefault()
      elegir(sugerencias[activo])
    } else if (e.key === 'Escape') {
      setAbierto(false)
    }
  }

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-ink-200 bg-ink-50 px-3 py-2">
        <Avatar nombre={value.nombre} url={value.fotoUrl} className="h-10 w-10 text-sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink-900">{value.nombre}</p>
          <p className="flex items-center gap-2 text-xs text-ink-500">{value.tipoDocumento} {value.numeroDocumento} <EstadoBadge estado={value.estado} /></p>
        </div>
        <button type="button" onClick={() => onChange(null)} aria-label="Quitar cliente" className="rounded-full p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"><X size={18} /></button>
      </div>
    )
  }

  return (
    <div ref={contenedor} className="relative">
      <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={abierto}
        aria-controls={`${id}-lista`}
        aria-autocomplete="list"
        aria-activedescendant={abierto && sugerencias[activo] ? `${id}-${sugerencias[activo].id}` : undefined}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value)
          setAbierto(true)
        }}
        onFocus={() => setAbierto(true)}
        onKeyDown={teclas}
        placeholder={placeholder}
        autoComplete="off"
        className="field pl-10"
      />
      {abierto && texto.trim().length >= 2 && (
        <ul id={`${id}-lista`} role="listbox" className="absolute z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-ink-200 bg-white py-1 shadow-soft">
          {cargando && sugerencias.length === 0 && <li className="px-4 py-3 text-sm text-ink-400">Buscando…</li>}
          {!cargando && sugerencias.length === 0 && <li className="px-4 py-3 text-sm text-ink-500">Sin resultados</li>}
          {sugerencias.map((s, i) => (
            <li
              key={s.id}
              id={`${id}-${s.id}`}
              role="option"
              aria-selected={i === activo}
              onMouseDown={(e) => {
                e.preventDefault()
                elegir(s)
              }}
              onMouseEnter={() => setActivo(i)}
              className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${i === activo ? 'bg-laufit-50' : ''}`}
            >
              <Avatar nombre={s.nombre} url={s.fotoUrl} className="h-9 w-9 text-xs" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink-900">{s.nombre}</span>
                <span className="block text-xs text-ink-500">{s.tipoDocumento} {s.numeroDocumento}</span>
              </span>
              <EstadoBadge estado={s.estado} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
