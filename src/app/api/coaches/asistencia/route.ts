import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAuth } from '@/lib/api-auth'
import { resumirDia } from '@/lib/coaches'
import { hoyPeru, rangoDiaPeru } from '@/lib/fechas'

export const dynamic = 'force-dynamic'

// Asistencia de coaches de un día (por defecto hoy): marcaciones y horas trabajadas.
export async function GET(req: Request) {
  const guard = await requireApiAuth(['ADMIN', 'SUPERVISOR'])
  if (guard) return guard

  const fechaParam = new URL(req.url).searchParams.get('fecha')
  const fecha = fechaParam && /^\d{4}-\d{2}-\d{2}$/.test(fechaParam) ? fechaParam : hoyPeru()

  const [coaches, marcaciones] = await Promise.all([
    prisma.coach.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } }),
    prisma.marcacionCoach.findMany({ where: { fechaHora: rangoDiaPeru(fecha) }, orderBy: { fechaHora: 'asc' } }),
  ])

  return NextResponse.json({
    fecha,
    coaches: coaches.map((coach) => {
      const propias = marcaciones.filter((m) => m.coachId === coach.id)
      return { id: coach.id, nombre: coach.nombre, marcaciones: propias, resumen: resumirDia(propias.filter((m) => !m.anulada)) }
    }),
  })
}
