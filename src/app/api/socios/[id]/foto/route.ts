import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'
import { almacenamientoConfigurado, guardarFotoSocio, urlFirmada } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireApiAuth(['ADMIN', 'SUPERVISOR'])
  if (guard) return guard

  if (!almacenamientoConfigurado()) {
    return NextResponse.json({ error: 'Almacenamiento de fotos no configurado (AWS_S3_BUCKET y credenciales)' }, { status: 503 })
  }

  const socio = await prisma.socio.findUnique({ where: { id: params.id } })
  if (!socio) return NextResponse.json({ error: 'Socio no encontrado' }, { status: 404 })

  const form = await req.formData().catch(() => null)
  const archivo = form?.get('foto')
  if (!(archivo instanceof File)) return NextResponse.json({ error: 'Falta el archivo "foto"' }, { status: 400 })

  try {
    const fotoKey = await guardarFotoSocio(socio.id, archivo)
    await prisma.socio.update({ where: { id: socio.id }, data: { fotoKey } })
    return NextResponse.json({ fotoUrl: await urlFirmada(fotoKey) })
  } catch (error) {
    const codigo = error instanceof Error ? error.message : ''
    if (codigo === 'TIPO_NO_SOPORTADO') return NextResponse.json({ error: 'Formato no soportado (usa JPG, PNG o WEBP)' }, { status: 400 })
    if (codigo === 'ARCHIVO_MUY_GRANDE') return NextResponse.json({ error: 'La foto supera los 8 MB' }, { status: 400 })
    return NextResponse.json({ error: 'No se pudo guardar la foto' }, { status: 500 })
  }
}
