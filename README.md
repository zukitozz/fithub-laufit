# FitHub · LAUFIT Fitness Club

Gestión de membresías, asistencia por QR y facturación electrónica de LAUFIT Fitness Club (THE1 FITNESS CLUB CENTER S.A.C.).
Misma arquitectura que fuelspa: Next.js 14 (App Router), PostgreSQL + Prisma, NextAuth, Tailwind, SWR, S3.

Especificación completa: [especificacion-fithub.md](especificacion-fithub.md). Consumo de APIs externas: [especificacion-consumo-api.md](especificacion-consumo-api.md) (facturador) y [spec-consumo-notificaciones-gimnasio.md](spec-consumo-notificaciones-gimnasio.md) (WhatsApp).

## Puesta en marcha local

```bash
npm install                      # también ejecuta prisma generate
cp .env.example .env             # completa DATABASE_URL, NEXTAUTH_SECRET, ADMIN_*
npx prisma migrate deploy        # crea las tablas (migración inicial en prisma/migrations)
npm run seed                     # gerente, configuración LAUFIT, 5 planes y series 001
npm run dev
```

Entra a http://localhost:3000 con `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Luego, en **Ajustes**, descarga el QR de la entrada.

## Qué hay construido

| Módulo | Ruta | Estado |
|---|---|---|
| Login, roles `SUPERVISOR` (gerente) y `ADMIN` (administrador) | `/auth/login` | Listo |
| Usuarios (crear, cambiar rol, desactivar, restablecer contraseña) | `/usuarios` (solo gerente) | Listo |
| Socios (alta, edición, foto, consentimiento WhatsApp, ficha) | `/socios` | Listo |
| Planes (catálogo editable) | `/planes` | Listo |
| Venta y renovación de membresía, pago único o mixto, boleta, factura o nota de despacho (interna, no va a SUNAT) | modal en Socios e Ingresos | Listo |
| Anulación de membresía + nota de crédito | ficha del socio (solo gerente) | Listo |
| Auto-marcación de socios y coaches por QR | `/marcar` (pública) | Listo |
| Panel de ingresos en vivo (foto, días restantes, confirmar o anular) | `/ingreso` | Listo |
| Asistencia de coaches (entrada y salida, corrección manual) | `/coaches` | Listo |
| Facturación: listado y PDF de cada comprobante; envío automático a SUNAT al emitir; reintento y resumen diario nocturnos (sin envío manual) | `/facturacion` | Listo |
| Ajustes: QR de la sede, datos fiscales, series, reglas | `/ajustes` | Listo |
| Dashboard | `/dashboard` | Listo |
| Market: carrito rápido con autocompletado de cliente, lector de código de barras, vuelto, boleta / factura / nota de despacho | `/market` | Listo |
| Productos e inventario (precio, stock, alerta de stock bajo, ingreso y ajuste de stock) | `/productos` (solo gerente) | Listo |
| Cierre de turno (totales por método de pago, arqueo de efectivo, historial) | `/cierres` | Listo |
| Vencimientos: hoy, próximos 7 días, vencidos (30 días) y pospuestos; renovar, llamar, registrar contacto y posponer | `/vencimientos` | Listo |
| Cumpleaños: hoy, próximos 7 días y mes; marcar saludado, llamar y renovar | `/cumpleanos` | Listo |

## Pendiente (siguientes etapas)

- **Avisos por WhatsApp** (bienvenida, comprobante, vence en 3 días, vence hoy) y botones de WhatsApp en Vencimientos y Cumpleaños (aún no se implementan por decisión del usuario): falta el módulo `notificaciones.ts`, el cron diario y la bitácora. Depende de las plantillas aprobadas por Meta.
- **Gastos** y **compras**, y reportes mensuales.
- **Anular una venta de productos** (nota de crédito + devolver el stock): hoy solo se anulan las membresías.
- Turnos de coaches y cálculo de tardanzas y faltas; reporte mensual exportable.

## Despliegue (Vercel + PostgreSQL)

1. Base PostgreSQL (RDS u otra) y `DATABASE_URL`. Aplicar `npx prisma migrate deploy` y `npm run seed`.
2. Proyecto en Vercel con las variables de `.env.example` (sin `ADMIN_*` salvo para el seed). `APP_URL` debe ser el dominio público: es la base de la URL que lleva el QR.
3. Bucket S3 **privado** y usuario IAM con solo `s3:PutObject`/`s3:GetObject` (fotos de socios).
4. `CRON_SECRET` (obligatorio): Vercel Cron llama a `/api/facturacion/resumen-diario` cada día a las 00:00 de Lima (05:00 UTC, `0 5 * * *`) y la ruta solo acepta ese secreto. Esa tarea reenvía los comprobantes que no llegaron al facturador, informa las boletas (resumen diario) y baja los CDR.
5. Los comprobantes se envían a SUNAT al emitirse, así que antes de vender en producción el RUC debe estar dado de alta en el facturador y las series habilitadas en SUNAT. El RUC se toma de Ajustes y `FACTURADOR_RUC_EMISOR` (deben coincidir).

## Notas importantes

- El facturador **no tiene autenticación**: solo se llama desde el backend, nunca desde el navegador.
- Las series sembradas son `001` para boletas, facturas y notas de crédito, y `001` para notas de despacho (`ND001-…`, internas). La boleta de ejemplo del gimnasio usa la serie `BY01` de su proveedor anterior; confirma qué series quedan habilitadas.
- Boleta: la serie y el número salen de `Correlativo` dentro de la misma transacción que crea la membresía.
- No copies los `.env` de fuelspa: contienen credenciales reales.

## Despliegue fuera de Vercel

Auth.js exige confiar en el host cuando se ejecuta en modo producción (`next start`) en un servidor propio: define `AUTH_TRUST_HOST=true` y `NEXTAUTH_URL` con la URL pública. En Vercel no hace falta.

## Producción

- URL: https://fithub-laufit.vercel.app (proyecto `fithub-laufit` en Vercel, conectado al repositorio `zukitozz/fithub-laufit`; cada push a `main` se despliega solo).
- Las migraciones pendientes se aplican en el build de producción (`vercel-build`).
- Base de datos: RDS `laufitness-db` (us-east-2). Fotos: bucket S3 privado `laufitness-fotos-945209558238`.

## Avisos por WhatsApp

FitHub llama al servicio de notificaciones (`spec-consumo-notificaciones-gimnasio.md`); nunca habla con Meta. Variables `NOTIF_*` en `.env.example`. Los avisos solo salen si **Ajustes → WhatsApp activo** está encendido, el socio aceptó y no se dio de baja.

- Al vender una membresía: bienvenida/renovación y comprobante con PDF (se guarda en S3 en `socios/comprobantes/` y se firma justo antes de enviar).
- Tarea diaria `/api/avisos/vencimientos` (Vercel Cron, 09:00 Lima, con `CRON_SECRET`): avisos de 3 días y de hoy, y reintento de los pendientes.
- Cada aviso queda en `EnvioWhatsApp` con su `referenciaExterna` (`membresía:fechaFin:tipo`); repetir la tarea no duplica mensajes.
