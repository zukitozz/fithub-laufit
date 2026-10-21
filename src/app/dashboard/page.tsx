'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { Cake } from 'lucide-react'
import { Spinner } from '@/components/Spinner'
import { fetcher, soles } from '@/components/ui'

interface Resumen {
  sociosActivos: number
  vencenEn7Dias: number
  altasMes: number
  asistenciaHoy: number
  pendientesHoy: number
  ingresosHoy: number
  ingresosMes: number
  facturasPendientes: number
  cumpleanosHoy: { id: string; nombre: string }[]
}

function Indicador({ titulo, valor, detalle, href, alerta }: { titulo: string; valor: string | number; detalle?: string; href?: string; alerta?: boolean }) {
  const cuerpo = (
    <div className={`card-surface h-full transition ${href ? 'hover:-translate-y-0.5' : ''} ${alerta ? 'border-danger-300 bg-danger-50' : ''}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-ink-500">{titulo}</p>
      <p className={`mt-1 font-display text-5xl font-extrabold leading-none ${alerta ? 'text-danger-600' : 'text-ink-900'}`}>{valor}</p>
      {detalle && <p className="mt-2 text-xs text-ink-400">{detalle}</p>}
    </div>
  )
  return href ? <Link href={href} className="block">{cuerpo}</Link> : cuerpo
}

export default function DashboardPage() {
  const { data, error } = useSWR<Resumen>('/api/dashboard', fetcher, { refreshInterval: 30_000 })

  return (
    <div className="p-4 md:p-8">
      <header className="mb-6">
        <p className="eyebrow">Resumen</p>
        <h1 className="page-heading text-4xl">Dashboard</h1>
      </header>

      {error && <p role="alert" className="rounded-xl bg-danger-50 px-4 py-2 text-sm font-semibold text-danger-700">{String(error.message)}</p>}
      {!data && !error && <p className="text-ink-500"><Spinner /> Cargando…</p>}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Indicador titulo="Socios activos" valor={data.sociosActivos} detalle="Con membresía vigente hoy" href="/socios" />
            <Indicador titulo="Vencen en 7 días" valor={data.vencenEn7Dias} detalle="Sin renovación posterior" href="/vencimientos" alerta={data.vencenEn7Dias > 0} />
            <Indicador titulo="Ingresos de hoy" valor={data.asistenciaHoy} detalle={data.pendientesHoy > 0 ? `${data.pendientesHoy} por revisar en recepción` : 'Todos revisados'} href="/ingreso" alerta={data.pendientesHoy > 0} />
            <Indicador titulo="Altas del mes" valor={data.altasMes} detalle="Socios nuevos registrados" />
            <Indicador titulo="Cobrado hoy" valor={soles(data.ingresosHoy)} detalle="Boletas y facturas menos notas de crédito" href="/facturacion" />
            <Indicador titulo="Cobrado en el mes" valor={soles(data.ingresosMes)} detalle="Incluye IGV" />
            <Indicador titulo="Comprobantes pendientes" valor={data.facturasPendientes} detalle="Aún sin confirmar en SUNAT" href="/facturacion" alerta={data.facturasPendientes > 0} />
          </div>

          <section className="card-surface mt-6">
            <h2 className="flex items-center gap-2 font-display text-2xl font-bold"><Cake size={20} className="text-brand-600" /> <Link href="/cumpleanos" className="hover:text-brand-600">Cumpleaños de hoy</Link></h2>
            {data.cumpleanosHoy.length === 0 ? (
              <p className="mt-2 text-sm text-ink-500">Nadie cumple años hoy.</p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-2">
                {data.cumpleanosHoy.map((c) => (
                  <li key={c.id}><Link href={`/socios/${c.id}`} className="badge bg-brand-100 text-brand-800 hover:bg-brand-200">{c.nombre}</Link></li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
