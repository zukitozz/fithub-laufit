'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { BrandLogo } from '@/components/BrandLogo'
import { Spinner } from '@/components/Spinner'

type Doc = 'DNI' | 'CE' | 'RUC'
type Como = 'SOCIO' | 'COACH'

type Respuesta =
  | { resultado: 'OK' | 'NO_VIGENTE' | 'DUPLICADO' | 'NO_ENCONTRADO' | 'ELEGIR' }
  | { resultado: 'COACH_PREVIA'; nombre: string; propuesta: 'ENTRADA' | 'SALIDA' }
  | { resultado: 'COACH_OK'; nombre: string; tipo: 'ENTRADA' | 'SALIDA'; hora: string }

const ETIQUETAS: Record<Doc, string> = { DNI: 'DNI', CE: 'Carnet de extranjería', RUC: 'RUC' }

function Marcar() {
  const token = useSearchParams().get('t') ?? ''
  const [tipoDocumento, setTipoDocumento] = useState<Doc>('DNI')
  const [numero, setNumero] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [respuesta, setRespuesta] = useState<Respuesta | null>(null)
  const [como, setComo] = useState<Como | undefined>()

  async function enviar(extra: Record<string, unknown> = {}) {
    setEnviando(true)
    setError(null)
    try {
      const res = await fetch('/api/marcar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, tipoDocumento, numeroDocumento: numero, como, ...extra }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error ?? 'No se pudo registrar. Inténtalo de nuevo o acércate a recepción.')
        return
      }
      setRespuesta(data)
    } catch {
      setError('Sin conexión. Inténtalo de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  function reiniciar() {
    setRespuesta(null)
    setNumero('')
    setComo(undefined)
    setError(null)
  }

  function elegir(valor: Como) {
    setComo(valor)
    void enviar({ como: valor })
  }

  const tarjeta = 'w-full max-w-sm rounded-3xl bg-white p-6 text-ink-900 shadow-[0_30px_60px_rgba(0,0,0,0.5)]'

  let contenido: React.ReactNode
  if (!token) {
    contenido = (
      <div className={tarjeta}>
        <h1 className="page-heading text-3xl">QR incompleto</h1>
        <p className="mt-2 text-sm text-ink-500">Escanea de nuevo el código QR que está en la entrada del gimnasio.</p>
      </div>
    )
  } else if (!respuesta) {
    contenido = (
      <form
        className={tarjeta}
        onSubmit={(e) => {
          e.preventDefault()
          void enviar()
        }}
      >
        <p className="eyebrow">Bienvenido</p>
        <h1 className="page-heading mt-1 text-4xl leading-none">Marca tu ingreso</h1>

        <div className="mt-5 grid grid-cols-3 gap-1 rounded-xl bg-ink-100 p-1" role="radiogroup" aria-label="Tipo de documento">
          {(Object.keys(ETIQUETAS) as Doc[]).map((tipo) => (
            <button
              key={tipo}
              type="button"
              role="radio"
              aria-checked={tipoDocumento === tipo}
              onClick={() => setTipoDocumento(tipo)}
              className={`rounded-lg px-2 py-2 text-sm font-bold transition ${tipoDocumento === tipo ? 'bg-white text-laufit-600 shadow' : 'text-ink-500'}`}
            >
              {tipo === 'CE' ? 'C.E.' : tipo}
            </button>
          ))}
        </div>

        <label htmlFor="documento" className="label mt-4">{ETIQUETAS[tipoDocumento]}</label>
        <input
          id="documento"
          inputMode={tipoDocumento === 'CE' ? 'text' : 'numeric'}
          autoComplete="off"
          autoFocus
          required
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          className="field text-center text-2xl font-bold tracking-widest"
          placeholder={tipoDocumento === 'DNI' ? '12345678' : ''}
        />

        {error && <p role="alert" className="mt-3 rounded-xl bg-laufit-50 px-3 py-2 text-sm font-semibold text-laufit-700">{error}</p>}

        <button type="submit" disabled={enviando || !numero.trim()} className="btn-brand mt-5 w-full text-base">
          {enviando && <Spinner />} Marcar
        </button>
        <p className="mt-4 text-center text-xs text-ink-400">
          Al marcar aceptas el tratamiento de tus datos. <Link href="/legal/privacidad" className="underline">Privacidad</Link>
        </p>
      </form>
    )
  } else if (respuesta.resultado === 'ELEGIR') {
    contenido = (
      <div className={tarjeta}>
        <h1 className="page-heading text-3xl">¿Qué vas a marcar?</h1>
        <div className="mt-5 space-y-3">
          <button type="button" disabled={enviando} onClick={() => elegir('SOCIO')} className="btn-brand w-full">Mi ingreso como socio</button>
          <button type="button" disabled={enviando} onClick={() => elegir('COACH')} className="btn-ghost w-full">Mi asistencia como coach</button>
        </div>
      </div>
    )
  } else if (respuesta.resultado === 'COACH_PREVIA') {
    const otra = respuesta.propuesta === 'ENTRADA' ? 'SALIDA' : 'ENTRADA'
    contenido = (
      <div className={tarjeta}>
        <p className="eyebrow">Coach</p>
        <h1 className="page-heading mt-1 text-4xl leading-none">Hola, {respuesta.nombre}</h1>
        <button type="button" disabled={enviando} onClick={() => void enviar({ paso: 'confirmar', tipo: respuesta.propuesta })} className="btn-brand mt-6 w-full text-lg">
          {enviando && <Spinner />} Marcar {respuesta.propuesta}
        </button>
        <button type="button" disabled={enviando} onClick={() => void enviar({ paso: 'confirmar', tipo: otra })} className="mt-3 w-full text-sm font-semibold text-ink-500 underline">
          Es otra cosa: marcar {otra}
        </button>
      </div>
    )
  } else if (respuesta.resultado === 'COACH_OK') {
    contenido = (
      <Pantalla tarjeta={tarjeta} icono="✓" tono="ok" titulo={`${respuesta.tipo === 'ENTRADA' ? 'Entrada' : 'Salida'} registrada`} texto={`${respuesta.nombre}, ${respuesta.hora}`} onVolver={reiniciar} />
    )
  } else if (respuesta.resultado === 'OK') {
    contenido = <Pantalla tarjeta={tarjeta} icono="✓" tono="ok" titulo="Ingreso registrado" texto="¡Buen entrenamiento!" onVolver={reiniciar} />
  } else if (respuesta.resultado === 'DUPLICADO') {
    contenido = <Pantalla tarjeta={tarjeta} icono="✓" tono="ok" titulo="Ya registraste tu ingreso" texto="No necesitas marcar otra vez." onVolver={reiniciar} />
  } else if (respuesta.resultado === 'NO_VIGENTE') {
    contenido = <Pantalla tarjeta={tarjeta} icono="!" tono="aviso" titulo="Tu membresía no está vigente" texto="Acércate a recepción para renovarla." onVolver={reiniciar} />
  } else {
    contenido = <Pantalla tarjeta={tarjeta} icono="?" tono="aviso" titulo="No encontramos tu documento" texto="Acércate a recepción para que te registren." onVolver={reiniciar} />
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-ink-900 px-5 py-8">
      <BrandLogo />
      {contenido}
    </main>
  )
}

function Pantalla({ tarjeta, icono, tono, titulo, texto, onVolver }: { tarjeta: string; icono: string; tono: 'ok' | 'aviso'; titulo: string; texto: string; onVolver: () => void }) {
  return (
    <div className={`${tarjeta} text-center`}>
      <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl font-extrabold text-white ${tono === 'ok' ? 'bg-emerald-600' : 'bg-laufit-600'}`}>{icono}</div>
      <h1 className="page-heading mt-4 text-3xl leading-tight">{titulo}</h1>
      <p className="mt-2 text-sm text-ink-500">{texto}</p>
      <button type="button" onClick={onVolver} className="btn-ghost mt-6 w-full">Volver</button>
    </div>
  )
}

export default function MarcarPage() {
  return (
    <Suspense>
      <Marcar />
    </Suspense>
  )
}
