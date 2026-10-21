'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { FileText } from 'lucide-react'
import { Spinner } from '@/components/Spinner'
import { fechaHoraLima, fetcher, soles } from '@/components/ui'
import { ETIQUETA_COMPROBANTE, type TipoComprobanteApp } from '@/lib/comprobantes'

interface Fila {
  id: string
  tipo: TipoComprobanteApp
  total: number
  metodoPago: string
  creadoAt: string
  numeracionComprobante: string | null
  receptorNombre: string
  receptorNumeroDocumento: string
  enviado: boolean
  estadoFacturador: string | null
  errors: string | null
  numeracionDocumentoAfectado: string | null
}

function EstadoSunat({ f }: { readonly f: Fila }) {
  if (f.tipo === 'NOTA_DESPACHO') return <span className="badge bg-ink-100 text-ink-600" title="Comprobante interno">No va a SUNAT</span>
  if (f.enviado) {
    return <span className="badge bg-emerald-100 text-emerald-800" title={f.estadoFacturador ?? ''}>{f.estadoFacturador === 'generado' ? 'Generada' : 'Enviado'}</span>
  }
  // Rechazado por SUNAT: reenviar no lo arregla, hay que corregir el dato. El resto se reintenta solo cada noche.
  if (f.estadoFacturador === 'rechazado') {
    return (
      <>
        <span className="badge bg-laufit-100 text-laufit-800">Rechazado por SUNAT</span>
        {f.errors && <span className="mt-1 block max-w-xs text-xs text-laufit-700">{f.errors}</span>}
      </>
    )
  }
  return (
    <>
      <span className="badge bg-amber-100 text-amber-800" title="Se reintenta automáticamente cada noche">Pendiente</span>
      {f.errors && <span className="mt-1 block max-w-xs text-xs text-ink-500">{f.errors}</span>}
    </>
  )
}

export default function FacturacionPage() {
  const [tipo, setTipo] = useState('')
  const [estado, setEstado] = useState('')
  const [q, setQ] = useState('')

  const params = new URLSearchParams()
  if (tipo) params.set('tipo', tipo)
  if (estado) params.set('estado', estado)
  if (q.trim()) params.set('q', q.trim())
  const { data, error, isLoading } = useSWR<Fila[]>(`/api/facturacion?${params}`, fetcher, { keepPreviousData: true, refreshInterval: 30_000 })

  return (
    <div className="p-4 md:p-8">
      <header className="mb-5">
        <p className="eyebrow">SUNAT</p>
        <h1 className="page-heading text-4xl">Facturación</h1>
        <p className="text-sm text-ink-500">Los comprobantes se envían a SUNAT al emitirse. Los pendientes se reintentan solos cada noche; el resumen diario de boletas lo envía el facturador a las 00:10.</p>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        <select aria-label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className="field w-48">
          <option value="">Todos los tipos</option>
          <option value="BOLETA">Boletas</option>
          <option value="FACTURA">Facturas</option>
          <option value="NOTA_CREDITO">Notas de crédito</option>
          <option value="NOTA_DESPACHO">Notas de despacho</option>
        </select>
        <select aria-label="Estado" value={estado} onChange={(e) => setEstado(e.target.value)} className="field w-48">
          <option value="">Todos los estados</option>
          <option value="pendientes">Pendientes en SUNAT</option>
          <option value="enviados">Enviados</option>
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nombre, documento o número" aria-label="Buscar" className="field w-72" />
      </div>

      {error && <p role="alert" className="mb-3 rounded-xl bg-laufit-50 px-4 py-2 text-sm font-semibold text-laufit-700">{String(error.message)}</p>}

      <div className="card-surface overflow-x-auto p-0">
        <table className="w-full min-w-[760px]">
          <thead className="border-b border-ink-100"><tr><th className="th">Comprobante</th><th className="th">Fecha</th><th className="th">Cliente</th><th className="th">Total</th><th className="th">Pago</th><th className="th">SUNAT</th><th className="th" /></tr></thead>
          <tbody className="divide-y divide-ink-100">
            {isLoading && <tr><td colSpan={7} className="td text-center"><Spinner /></td></tr>}
            {data?.map((f) => (
              <tr key={f.id}>
                <td className="td font-semibold">{f.numeracionComprobante ?? '—'}<span className="block text-xs font-normal text-ink-400">{ETIQUETA_COMPROBANTE[f.tipo]}{f.numeracionDocumentoAfectado && ` de ${f.numeracionDocumentoAfectado}`}</span></td>
                <td className="td text-ink-500">{fechaHoraLima(f.creadoAt)}</td>
                <td className="td">{f.receptorNombre}<span className="block text-xs text-ink-400">{f.receptorNumeroDocumento}</span></td>
                <td className="td font-semibold">{f.tipo === 'NOTA_CREDITO' && '−'}{soles(f.total)}</td>
                <td className="td text-xs">{f.metodoPago}</td>
                <td className="td"><EstadoSunat f={f} /></td>
                <td className="td text-right">
                  <a href={`/api/facturacion/${f.id}/pdf`} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm"><FileText size={14} /> PDF</a>
                </td>
              </tr>
            ))}
            {data && data.length === 0 && <tr><td colSpan={7} className="td py-10 text-center text-ink-500">No hay comprobantes con esos filtros.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-ink-400">Se muestran los últimos 100. Las boletas quedan “generadas” y el facturador las informa a SUNAT en su resumen diario. Las notas de despacho son internas y no se envían.</p>
    </div>
  )
}
