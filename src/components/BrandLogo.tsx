import Image from 'next/image'
import { obtenerTenant } from '@/lib/tenant'

interface BrandLogoProps {
  readonly compact?: boolean
}

// El logo del cliente (TENANT) es un cuadrado oscuro: se muestra con esquinas suaves sobre fondo oscuro o claro.
const tenant = obtenerTenant()

export function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <Image
      src={compact ? tenant.logoCompacto : tenant.logo}
      alt={tenant.nombre}
      width={150}
      height={150}
      className={compact ? 'h-11 w-11 rounded-xl object-contain' : 'h-28 w-28 rounded-2xl object-contain'}
      priority
      unoptimized
    />
  )
}
