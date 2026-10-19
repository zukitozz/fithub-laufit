import Image from 'next/image'

interface BrandLogoProps {
  readonly compact?: boolean
}

// El logo es el cuadrado negro de LAUFIT: se muestra con esquinas suaves sobre fondo oscuro o claro.
export function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <Image
      src="/logo-laufit.png"
      alt="LAUFIT Fitness Club"
      width={150}
      height={150}
      className={compact ? 'h-11 w-11 rounded-xl object-contain' : 'h-28 w-28 rounded-2xl object-contain'}
      priority
      unoptimized
    />
  )
}
