'use client'

import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useState } from 'react'
import { Menu } from 'lucide-react'
import { BrandLogo } from '@/components/BrandLogo'
import { Sidebar } from '@/components/Sidebar'
import { useAppStore } from '@/store/useAppStore'

// Páginas sin menú lateral: login, legales y la auto-marcación pública que se abre desde el QR.
const SIN_SHELL = ['/auth/login', '/legal', '/marcar']

export function AppShell({ children }: { readonly children: React.ReactNode }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [mobileOpen, setMobileOpen] = useState(false)
  const collapsed = useAppStore((state) => state.sidebarCollapsed)
  const toggleSidebar = useAppStore((state) => state.toggleSidebar)

  if (SIN_SHELL.some((ruta) => pathname.startsWith(ruta)) || !session) return <>{children}</>

  return (
    <div className="min-h-screen">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={toggleSidebar}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-brand-600/40 bg-ink-900 px-4 py-3 text-white md:hidden">
        <button
          type="button"
          aria-label="Abrir menú"
          onClick={() => setMobileOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-brand-600/70 text-white transition hover:bg-brand-700"
        >
          <Menu size={20} />
        </button>
        <BrandLogo compact />
      </header>

      <main className={`transition-all duration-200 ${collapsed ? 'md:pl-20' : 'md:pl-64'}`}>
        {children}
      </main>
    </div>
  )
}
