// Marca blanca: un mismo código y un despliegue por cliente. La variable TENANT elige el tema (next.config.js la expone al navegador).

type Escala = Record<50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900, string>

export interface Tenant {
  id: string
  nombre: string
  /** Nombre partido en dos para el menú lateral: la segunda parte va en el color de la marca. */
  marca: [string, string]
  eslogan: { antes: string; destacado: string }
  /** Logo cuadrado sobre fondo oscuro (login, QR de la sede, favicon y comprobantes). */
  logo: string
  /** Versión corta para el menú lateral y la cabecera móvil. */
  logoCompacto: string
  /** Colores de la marca (hex). */
  colores: Escala
  /** Datos del emisor y del contacto para la política de privacidad. */
  razonSocial: string
  contacto: string
}

const TEMAS: Record<string, Tenant> = {
  laufit: {
    id: 'laufit',
    nombre: 'LAUFIT Fitness Club',
    marca: ['LAU', 'FIT'],
    eslogan: { antes: 'Invierte en tu', destacado: 'bienestar' },
    logo: '/logo-laufit.png',
    logoCompacto: '/logo-laufit.png',
    colores: { 50: '#fef2f2', 100: '#fde3e4', 200: '#fbc9cb', 300: '#f59ea1', 400: '#ec5f65', 500: '#e0262d', 600: '#d10f15', 700: '#a80b10', 800: '#7f0a0e', 900: '#4d0609' },
    razonSocial: 'THE1 FITNESS CLUB CENTER S.A.C.',
    contacto: 'recepción de LAUFIT Fitness Club, Av. Próceres de Huandoy 7585, Los Olivos · 974 775 549',
  },
  fitfactory: {
    id: 'fitfactory',
    nombre: 'FitFactory Fitness Club',
    marca: ['FIT', 'FACTORY'],
    eslogan: { antes: 'Juntos somos más', destacado: 'fuertes' },
    logo: '/logo-fitfactory.png',
    logoCompacto: '/logo-fitfactory-icono.png',
    colores: { 50: '#eef0ff', 100: '#dfe3ff', 200: '#c3caff', 300: '#99a4ff', 400: '#6a7af7', 500: '#4558ee', 600: '#2233d0', 700: '#1a27a8', 800: '#151f80', 900: '#0d1450' },
    razonSocial: 'FitFactory Fitness Club (demostración)',
    contacto: 'recepción de FitFactory Fitness Club',
  },
}

/** Tema activo; sin TENANT (o con uno desconocido) se usa LAUFIT. */
export function obtenerTenant(id: string | undefined = process.env.NEXT_PUBLIC_TENANT ?? process.env.TENANT): Tenant {
  return TEMAS[(id ?? '').trim().toLowerCase()] ?? TEMAS.laufit
}

/** "#rrggbb" a "r g b", el formato de las variables CSS que usa Tailwind. */
export const hexARgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}

/** Declaraciones de variables CSS (--brand-50 … --brand-900) con los colores del tema. */
export function variablesCss(t: Tenant): string {
  return Object.entries(t.colores).map(([k, v]) => `--brand-${k}:${hexARgb(v)}`).join(';')
}
