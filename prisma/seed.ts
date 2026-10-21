import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { obtenerTenant } from '../src/lib/tenant'

const prisma = new PrismaClient()
const tenant = obtenerTenant(process.env.TENANT)

// Datos del emisor por cliente. Los de la demostración son ficticios: no emitir comprobantes reales con ellos.
const EMISORES: Record<string, { direccion: string; telefonoContacto: string; ruc: string; razonSocial: string; direccionFiscal: string; codigoUbigeo: string }> = {
  laufit: {
    direccion: 'Av. Próceres de Huandoy 7585, Los Olivos',
    telefonoContacto: '974775549',
    ruc: '20563019337',
    razonSocial: 'THE1 FITNESS CLUB CENTER S.A.C.',
    direccionFiscal: 'AV. LOS PROCERES MZ TT2 LT 6 URB. PRO 5TO SECTOR I ETAPA FRENTE A COLEGIO DE JESUS, LOS OLIVOS - LIMA - LIMA',
    codigoUbigeo: '150117',
  },
  fitfactory: {
    direccion: 'Dirección de demostración, Lima',
    telefonoContacto: '999999999',
    ruc: '20000000001',
    razonSocial: tenant.razonSocial,
    direccionFiscal: 'DIRECCIÓN DE DEMOSTRACIÓN - LIMA - LIMA',
    codigoUbigeo: '150101',
  },
}
const emisor = EMISORES[tenant.id] ?? EMISORES.laufit

// Planes del afiche de LAUFIT (precios con IGV). Se pueden editar después en /planes.
const PLANES = [
  { nombre: '1 Mes', duracion: 1, precio: 100, orden: 1 },
  { nombre: '2 Meses', duracion: 2, precio: 150, orden: 2 },
  { nombre: '3 Meses', duracion: 3, precio: 200, orden: 3 },
  // No sale en el afiche, pero hay una boleta real de "4 MESES" por S/ 200.
  { nombre: '4 Meses', duracion: 4, precio: 200, orden: 4 },
  { nombre: '6 Meses', duracion: 6, precio: 300, orden: 5 },
  { nombre: '12 Meses', duracion: 12, precio: 500, orden: 6 },
]

// Horario del afiche: lunes a sábado 5:30-22:00, domingo 9:00-14:00 (0 = domingo).
const HORARIO = {
  '0': ['09:00', '14:00'],
  '1': ['05:30', '22:00'],
  '2': ['05:30', '22:00'],
  '3': ['05:30', '22:00'],
  '4': ['05:30', '22:00'],
  '5': ['05:30', '22:00'],
  '6': ['05:30', '22:00'],
}

async function main() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  const name = process.env.ADMIN_NAME || 'Gerente'
  if (!email || !password) {
    throw new Error('Define ADMIN_EMAIL y ADMIN_PASSWORD antes de ejecutar el seed.')
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: { name, password: passwordHash, role: 'SUPERVISOR' },
    create: { name, email: email.toLowerCase(), password: passwordHash, role: 'SUPERVISOR' },
  })
  console.log(`Gerente listo: ${user.email}`)

  // Datos del emisor (boleta de ejemplo del gimnasio). Verificar con el contador antes de emitir.
  await prisma.configuracion.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      nombreGimnasio: tenant.nombre,
      ...emisor,
      horarioAtencion: HORARIO,
    },
  })

  // Solo crea los planes que faltan (por nombre): se puede volver a ejecutar sin pisar precios editados.
  const existentes = new Set((await prisma.plan.findMany({ select: { nombre: true } })).map((p) => p.nombre))
  const nuevos = PLANES.filter((p) => !existentes.has(p.nombre))
  if (nuevos.length > 0) {
    await prisma.plan.createMany({ data: nuevos.map((p) => ({ ...p, unidad: 'MESES' as const })) })
    console.log(`Planes creados: ${nuevos.map((p) => p.nombre).join(', ')}`)
  }

  // Series por defecto (solo las que faltan por tipo). Las de SUNAT (01, 03, 07) deben coincidir con las
  // habilitadas para el RUC; la '50' es la nota de despacho, interna.
  const SERIES = [
    { tipoComprobante: '01', serie: '001', descripcion: 'Facturas' },
    { tipoComprobante: '03', serie: '001', descripcion: 'Boletas' },
    { tipoComprobante: '07', serie: '001', descripcion: 'Notas de crédito' },
    { tipoComprobante: '50', serie: '001', descripcion: 'Notas de despacho (internas)' },
  ]
  const tiposExistentes = new Set((await prisma.serie.findMany({ select: { tipoComprobante: true } })).map((s) => s.tipoComprobante))
  const faltantes = SERIES.filter((s) => !tiposExistentes.has(s.tipoComprobante))
  if (faltantes.length > 0) {
    await prisma.serie.createMany({ data: faltantes })
    console.log(`Series creadas: ${faltantes.map((s) => s.tipoComprobante).join(', ')}`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => prisma.$disconnect())
