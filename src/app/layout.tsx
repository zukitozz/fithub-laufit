import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Barlow_Condensed, Inter } from 'next/font/google'
import { Providers } from '@/components/Providers'
import { AppShell } from '@/components/AppShell'
import { obtenerTenant, variablesCss } from '@/lib/tenant'

const tenant = obtenerTenant()

const barlow = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
})

export const metadata: Metadata = {
  title: `FitHub · ${tenant.nombre}`,
  description: `Gestión de membresías, asistencia y facturación de ${tenant.nombre}`,
  icons: { icon: tenant.logoCompacto },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <html lang="es-PE" className={`${barlow.variable} ${inter.variable}`} style={Object.fromEntries(variablesCss(tenant).split(';').map((d) => d.split(':')))}>
      <body>
        <Providers><AppShell>{children}</AppShell></Providers>
      </body>
    </html>
  )
}
