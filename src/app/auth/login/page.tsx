'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { BrandLogo } from '@/components/BrandLogo'
import { Spinner } from '@/components/Spinner'

function destinoSeguro(callbackUrl: string | null) {
  if (!callbackUrl || !callbackUrl.startsWith('/') || callbackUrl.startsWith('//')) return '/dashboard'
  return callbackUrl
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setEnviando(true)
    const result = await signIn('credentials', { redirect: false, email, password })
    setEnviando(false)

    if (result?.error) {
      setError('Correo o contraseña inválidos')
      return
    }
    router.push(destinoSeguro(searchParams.get('callbackUrl')))
    router.refresh()
  }

  return (
    <div className="flex min-h-screen flex-col bg-ink-900 lg:flex-row">
      <div className="relative flex flex-col items-center justify-center gap-6 overflow-hidden px-8 py-12 lg:w-1/2">
        <div className="pointer-events-none absolute -left-24 top-1/3 h-64 w-[140%] -rotate-12 bg-laufit-600/20 blur-3xl" />
        <BrandLogo />
        <div className="relative text-center">
          <p className="font-display text-5xl font-extrabold uppercase leading-none tracking-wide text-white sm:text-6xl">
            Invierte en tu <span className="text-laufit-500">bienestar</span>
          </p>
          <p className="mt-4 text-sm text-ink-300">Gestión de socios, asistencia y facturación</p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-white px-6 py-12 lg:rounded-l-[2.5rem]">
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">
          <div>
            <p className="eyebrow">FitHub</p>
            <h1 className="page-heading mt-1 text-4xl">Iniciar sesión</h1>
          </div>

          <div>
            <label htmlFor="email" className="label">Correo</label>
            <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className="field" />
          </div>
          <div>
            <label htmlFor="password" className="label">Contraseña</label>
            <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="field" />
          </div>

          {error && <p role="alert" className="rounded-xl bg-laufit-50 px-4 py-2 text-sm font-semibold text-laufit-700">{error}</p>}

          <button type="submit" disabled={enviando} className="btn-brand w-full">
            {enviando && <Spinner />} Entrar
          </button>
        </form>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
