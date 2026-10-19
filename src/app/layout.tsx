import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Barlow_Condensed, Inter } from 'next/font/google'
import { Providers } from '@/components/Providers'
import { AppShell } from '@/components/AppShell'

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
  title: 'FitHub · LAUFIT Fitness Club',
  description: 'Gestión de membresías, asistencia y facturación de LAUFIT Fitness Club',
  icons: { icon: '/logo-laufit.png' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <html lang="es-PE" className={`${barlow.variable} ${inter.variable}`}>
      <body>
        <Providers><AppShell>{children}</AppShell></Providers>
      </body>
    </html>
  )
}
