'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import {
  Cake,
  CalendarClock,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  ScanLine,
  Settings,
  ShoppingCart,
  Tag,
  UserCheck,
  UserCog,
  Users,
  X,
} from 'lucide-react'
import { BrandLogo } from '@/components/BrandLogo'
import { obtenerTenant } from '@/lib/tenant'
import { ROLE_LABELS, type UserRole } from '@/types/user'

const tenant = obtenerTenant()

const STAFF: UserRole[] = ['ADMIN', 'SUPERVISOR']

const navigation: { href: string; label: string; icon: typeof LayoutDashboard; roles: UserRole[] }[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: STAFF },
  { href: '/ingreso', label: 'Ingresos en vivo', icon: ScanLine, roles: STAFF },
  { href: '/market', label: 'Market', icon: ShoppingCart, roles: STAFF },
  { href: '/socios', label: 'Socios', icon: Users, roles: STAFF },
  { href: '/vencimientos', label: 'Vencimientos', icon: CalendarClock, roles: STAFF },
  { href: '/cumpleanos', label: 'Cumpleaños', icon: Cake, roles: STAFF },
  { href: '/facturacion', label: 'Facturación', icon: Receipt, roles: STAFF },
  { href: '/cierres', label: 'Cierre de turno', icon: ClipboardCheck, roles: STAFF },
  { href: '/productos', label: 'Productos', icon: Package, roles: ['SUPERVISOR'] },
  { href: '/coaches', label: 'Coaches', icon: UserCheck, roles: STAFF },
  { href: '/planes', label: 'Planes', icon: Tag, roles: ['SUPERVISOR'] },
  { href: '/usuarios', label: 'Usuarios', icon: UserCog, roles: ['SUPERVISOR'] },
  { href: '/ajustes', label: 'Ajustes', icon: Settings, roles: ['SUPERVISOR'] },
]

function getActiveHref(pathname: string) {
  let best: string | null = null
  for (const item of navigation) {
    const matches = pathname === item.href || pathname.startsWith(`${item.href}/`)
    if (matches && (!best || item.href.length > best.length)) best = item.href
  }
  return best
}

interface SidebarProps {
  collapsed: boolean
  onToggleCollapsed: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}

export function Sidebar({ collapsed, onToggleCollapsed, mobileOpen, onCloseMobile }: SidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const role = session?.user?.role
  const items = navigation.filter((item) => !role || item.roles.includes(role))
  const activeHref = getActiveHref(pathname)
  const initials = (session?.user?.name || '?')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={onCloseMobile} />}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen flex-col bg-ink-900 text-white transition-all duration-200 ${
          collapsed ? 'w-20' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      >
        <div className="flex items-center gap-2 border-b border-brand-600/40 p-4">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <BrandLogo compact />
              <span className="font-display text-xl font-bold leading-none tracking-wide">
                {tenant.marca[0]}<span className="text-brand-400">{tenant.marca[1]}</span>
              </span>
            </div>
          )}
          <button
            type="button"
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            onClick={onToggleCollapsed}
            className="ml-auto hidden h-9 w-9 items-center justify-center rounded-full text-ink-200 transition hover:bg-ink-700 md:flex"
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={onCloseMobile}
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-full text-ink-200 transition hover:bg-ink-700 md:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map((item) => {
            const Icon = item.icon
            const isActive = item.href === activeHref
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  isActive ? 'bg-brand-600 font-semibold text-white' : 'text-ink-200 hover:bg-ink-700 hover:text-white'
                }`}
              >
                <Icon size={20} className="shrink-0" />
                <span className={collapsed ? 'hidden' : 'truncate'}>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-brand-600/40 p-3">
          <div className={`flex items-center gap-3 rounded-xl px-2 py-2 ${collapsed ? 'justify-center' : ''}`}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
              {initials}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{session?.user?.name}</p>
                <p className="truncate text-[11px] uppercase tracking-[0.16em] text-ink-300">{role ? ROLE_LABELS[role] : ''}</p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: '/auth/login' })}
            title={collapsed ? 'Salir' : undefined}
            className={`mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-200 transition hover:bg-brand-700 hover:text-white ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <LogOut size={18} className="shrink-0" />
            <span className={collapsed ? 'hidden' : ''}>Salir</span>
          </button>
        </div>
      </aside>
    </>
  )
}

