# FitHub: especificación funcional y técnica (borrador v0.2)

Sistema de gestión de gimnasio (primer cliente: LAUFIT Fitness Club, Los Olivos, Lima). Gestiona socios, membresías, cobros con comprobante electrónico, avisos por WhatsApp, **asistencia de socios con auto-marcación por QR** y **asistencia de coaches por QR (entrada y salida)**.

Cambios respecto a v0.1: la marcación por QR es de los **socios** (no del personal); se agrega la asistencia de **coaches**; se eliminan clases con reserva, congelamiento, pagos a cuotas y descuentos; se simplifica la seguridad.

Lo marcado **[Decidir]** necesita respuesta tuya (sección 13).

## 1. Fuentes y límites de la investigación

- **fuelspa** (`D:\SolucionesOP\Spa\Fuentes\fuelspa`): arquitectura base (sección 2).
- **`especificacion-consumo-api.md`**: facturador-api (SUNAT), consumido desde el backend con un módulo equivalente al `src/lib/facturador.ts` de fuelspa.
- **`spec-consumo-notificaciones-gimnasio.md`**: servicio de WhatsApp. Varias piezas están como "por construir" allí (sección 8.3).
- **Facebook de Lau Fitness Club**: la página no se pudo leer, pero el afiche de membresías que pasaste da los datos reales (sección 1.1). Las demás funciones salen de lo habitual en software de gimnasios (control de acceso por QR, cobros y renovaciones, recordatorios, informes de asistencia e ingresos).

### 1.1 Datos reales del negocio (afiche de membresías)

| Dato | Valor |
|---|---|
| Nombre comercial | **LAUFIT Fitness Club** |
| Dirección | Av. Próceres de Huandoy 7585, Los Olivos |
| WhatsApp / teléfono | 974 775 549 |
| Horario | Lunes a sábado 5:30 a 22:00; domingos 9:00 a 14:00 |
| Identidad visual | Negro, rojo y blanco; logo "LAUFIT" (LAU en rojo, FIT en blanco) |

**Planes y precios** (el afiche no muestra matrícula, pase diario, descuentos ni convenios):

| Plan | Duración | Precio | Equivale por mes |
|---|---|---|---|
| 1 Mes | 1 mes | S/ 100 | S/ 100 |
| 2 Meses | 2 meses | S/ 150 | S/ 75 |
| 3 Meses | 3 meses | S/ 200 | S/ 67 |
| 6 Meses | 6 meses | S/ 300 | S/ 50 |
| 12 Meses | 12 meses | S/ 500 | S/ 42 |

Estos cinco son la semilla (`seed`) del catálogo de `Plan`. Los precios incluyen IGV.

## 2. Arquitectura (heredada de fuelspa)

| Capa | Decisión |
|---|---|
| Framework | Next.js 14 (App Router), TypeScript, Tailwind, lucide-react |
| Datos | PostgreSQL + Prisma 5, migraciones en `prisma/migrations` |
| Auth del personal del sistema | NextAuth v5, credenciales (correo + bcrypt), roles en el JWT |
| Control de acceso | `middleware.ts` por rol + `requireApiAuth(roles)` en cada ruta API |
| Estado/fetch | zustand + SWR (el panel en vivo usa `refreshInterval`) |
| Archivos | S3 privado + URLs firmadas (`storage.ts`) para fotos de socios |
| QR | paquete `qrcode` (ya en uso) |
| Hosting/cron | Vercel; cron con `CRON_SECRET` en `Authorization: Bearer` |
| Facturación | `facturador.ts` adaptado; `Serie` y `Correlativo` para numeración |
| Zona horaria | Cálculos en `America/Lima`; `DateTime` en UTC |

Una instalación por gimnasio (una sola `Configuracion`), igual que fuelspa.

### Variables de entorno nuevas

`FACTURADOR_URL`, `FACTURADOR_RUC_EMISOR`, `CRON_SECRET`, `AWS_*` (como fuelspa), más `NOTIF_API_URL`, `NOTIF_TOKEN_URL`, `NOTIF_CLIENT_ID`, `NOTIF_CLIENT_SECRET`, `NOTIF_PROYECTO_CODIGO`. Los `.env` de fuelspa contienen credenciales reales: no copiarlos.

## 3. Roles

| Rol | Quién | Alcance |
|---|---|---|
| `SUPERVISOR` | Dueño/gerente | Todo: planes, coaches, gastos, reportes, ajustes |
| `ADMIN` | Administradora/recepción de turno | Socios, membresías, cobros, panel de ingresos, cierre de turno. Sin ajustes, planes, coaches ni gastos |

**Los coaches no inician sesión.** Son la entidad `Coach` (sección 6) y solo marcan asistencia escaneando el QR. Los socios tampoco tienen cuenta: marcan con su documento.

## 4. Funciones por fase

### Fase 1 (MVP)

1. **Socios**: alta/edición, DNI o carnet de extranjería (RUC opcional para facturar), foto, celular, correo, fecha de nacimiento, contacto de emergencia, condición médica y notas, consentimiento de WhatsApp, historial de membresías, pagos y asistencias.
2. **Planes**: nombre, duración en días, precio, matrícula opcional, pase diario, activo. Precio fijo, **sin descuentos**.
3. **Membresías**: venta, renovación (incluida la adelantada), anulación. Sección 5. **Sin congelamiento.**
4. **Cobros y comprobantes**: **pago único** (sin cuotas), métodos de pago, nota de venta / boleta / factura / nota de crédito. Sección 7.
5. **Avisos por WhatsApp**: bienvenida, comprobante, vence en 3 días, vence hoy. Sección 8.
6. **Asistencia de socios por QR**: el socio escanea, ingresa su documento y queda registrado; la administradora lo verifica en un panel en vivo. Sección 9.
7. **Asistencia de coaches por QR**: entrada y salida. Sección 10.
8. **Cierre de turno** de la administradora, como `CierreTurno` de fuelspa.
9. **Dashboard**: socios activos, altas y bajas del mes, vencen en 7 días, ingresos del día y del mes, asistencia de hoy, cumpleaños.
10. **Vencimientos** (retención): lista de por vencer y vencidos hace 1 a 30 días, con posponer (como `/seguimiento` de fuelspa), y **cumpleaños**.
11. **Reportes**: ingresos vs. gastos mensual, altas/bajas/renovaciones, asistencia por hora y por día (horas pico), asistencia de coaches.
12. **Gastos y compras** (solo `SUPERVISOR`), como fuelspa.

### Fase 2 (a priorizar con el dueño)

Productos y venta en caja (agua, suplementos) con inventario, casilleros, mediciones corporales y rutinas por coach, referidos, portal del socio para ver su vigencia y su QR.

### Fase 3

Torniquete o lector automático, cobro recurrente con tarjeta, multi-sede.

### Fuera de alcance (decidido)

Clases con reserva, congelamiento de membresía, pagos a cuotas, descuentos.

## 5. Membresías: reglas de negocio

### Estados

Calculados a partir de fechas (solo `ANULADA` se guarda):

| Estado | Condición |
|---|---|
| `VIGENTE` | hoy dentro de `fechaInicio..fechaFin` |
| `POR_VENCER` | vigente y faltan ≤ `diasAvisoVencimiento` (config., por defecto 7) |
| `VENCIDA` | pasó `fechaFin` (más `diasGracia`, config., por defecto 0) |
| `PROGRAMADA` | `fechaInicio` futura (renovación adelantada) |
| `ANULADA` | anulada con motivo |

### Reglas

1. **Inicio**: hoy por defecto. Si renueva con membresía vigente, la nueva inicia al día siguiente de la `fechaFin` actual y queda `PROGRAMADA` (no pierde días). Si ya venció, inicia hoy. La administradora puede cambiarla.
2. **Fin**: inicio + duración en **meses de calendario** − 1 día (1 mes desde 05/11 vence 04/12; 3 meses desde 05/11 vence 04/02; 12 meses desde 05/11/2026 vence 04/11/2027). Si el día no existe en el mes de destino (31/01 + 1 mes), se usa el último día de ese mes. Se guarda el valor calculado.
3. **Una vigente a la vez**; puede haber programadas.
4. **Precio = el del plan.** No se edita en la venta. Solo `SUPERVISOR` cambia precios en el catálogo, y las membresías ya vendidas conservan el precio con el que se vendieron.
5. **Pase diario**: plan de 1 día. El visitante se registra con documento y nombre; celular opcional.
6. **Matrícula**: línea aparte, cobrada solo la primera vez o tras N meses sin membresía (configurable por plan).
7. **Anulación**: solo `SUPERVISOR`, con motivo. Si había comprobante aceptado por SUNAT, se emite nota de crédito (7.3).
8. **Cambio de plan a mitad de membresía**: no se contempla. Para pasar a un plan mayor, se anula y se vende uno nuevo. **[Decidir]** si se necesita un flujo especial.

## 6. Modelo de datos (esquema Prisma propuesto)

Se reutilizan de fuelspa: `User`, `Factura`, `FacturaItem`, `CierreTurno`, `Gasto`, `Serie`, `Correlativo`, `Configuracion` (con campos nuevos). `Cliente` pasa a `Socio`. Se quitan `Cabina`, `Atencion*`, `Tratamiento*`, `Paquete*`, `Cita` y todo lo de descuentos.

```prisma
enum TipoDocumento { DNI CE RUC }          // catálogo 06 SUNAT: 1, 4, 6
enum UnidadDuracion { MESES DIAS }

model Socio {
  id                  String   @id @default(uuid())
  nombre              String
  tipoDocumento       TipoDocumento
  numeroDocumento     String
  razonSocial         String?                        // si factura con RUC
  rucFactura          String?
  celular             String?                        // E.164: +51...
  email               String?
  fechaNacimiento     DateTime? @db.Date
  fotoKey             String?                        // S3; clave para que la administradora reconozca a la persona
  contactoEmergencia  String?
  telefonoEmergencia  String?
  condicionMedica     String?
  notas               String?
  consentimientoWhatsApp       Boolean   @default(false)
  consentimientoWhatsAppAt     DateTime?
  consentimientoWhatsAppOrigen String?
  recordatorioPospuestoHasta   DateTime?
  activo              Boolean  @default(true)
  createdAt           DateTime @default(now())
  membresias          Membresia[]
  asistencias         Asistencia[]
  facturas            Factura[]
  @@unique([tipoDocumento, numeroDocumento])
}

model Plan {
  id           String  @id @default(uuid())
  nombre       String
  duracion     Int                       // 1, 2, 3, 6, 12 (meses) o N días
  unidad       UnidadDuracion @default(MESES)   // MESES (calendario) o DIAS
  precio       Float
  matricula    Float   @default(0)       // el afiche no cobra matrícula: queda en 0
  esPaseDiario Boolean @default(false)   // no está en el afiche; opcional
  activo       Boolean @default(true)
  orden        Int     @default(0)
  membresias   Membresia[]
}

model Membresia {
  id            String   @id @default(uuid())
  socio         Socio    @relation(fields: [socioId], references: [id])
  socioId       String
  plan          Plan     @relation(fields: [planId], references: [id])
  planId        String
  fechaInicio   DateTime @db.Date
  fechaFin      DateTime @db.Date
  precio        Float                    // precio del plan al momento de la venta
  anulada       Boolean  @default(false)
  anuladaMotivo String?
  anuladaPorId  String?
  usuarioId     String                   // quién la vendió
  facturaId     String?
  creadoAt      DateTime @default(now())
  @@index([socioId, fechaFin])
}

model Asistencia {                        // ingreso de SOCIO
  id           String   @id @default(uuid())
  socio        Socio    @relation(fields: [socioId], references: [id])
  socioId      String
  membresiaId  String?
  fechaHora    DateTime @default(now())  // hora del servidor
  origen       OrigenAsistencia          // QR, RECEPCION
  estadoMembresia EstadoMembresiaAlMarcar // VIGENTE, POR_VENCER, VENCIDA, SIN_MEMBRESIA
  diasRestantes Int?                      // al momento de marcar
  validacion   ValidacionAsistencia @default(PENDIENTE) // PENDIENTE, CONFIRMADA, ANULADA, CORTESIA
  validadaPorId String?                  // la administradora que la revisó
  validadaAt   DateTime?
  motivo       String?                   // obligatorio si ANULADA o CORTESIA
  ip           String?
  @@index([socioId, fechaHora])
  @@index([fechaHora])
}

model Coach {
  id              String   @id @default(uuid())
  nombre          String
  tipoDocumento   TipoDocumento
  numeroDocumento String
  celular         String?
  fotoKey         String?
  activo          Boolean  @default(true)
  createdAt       DateTime @default(now())
  turnos          CoachTurno[]
  marcaciones     MarcacionCoach[]
  @@unique([tipoDocumento, numeroDocumento])
}

model CoachTurno {                        // horario esperado (opcional), para tardanzas
  id            String @id @default(uuid())
  coach         Coach  @relation(fields: [coachId], references: [id])
  coachId       String
  diaSemana     Int                      // 0=domingo ... 6=sábado
  entrada       String                   // "06:00"
  salida        String                   // "14:00"
  toleranciaMin Int    @default(10)
}

model MarcacionCoach {
  id          String   @id @default(uuid())
  coach       Coach    @relation(fields: [coachId], references: [id])
  coachId     String
  tipo        TipoMarcacion              // ENTRADA, SALIDA
  fechaHora   DateTime @default(now())   // hora del servidor, no la del teléfono
  origen      OrigenMarcacion            // QR, MANUAL
  anulada     Boolean  @default(false)
  observacion String?
  registradaPorId String?                // si fue MANUAL o corrección: el User
  ip          String?
  @@index([coachId, fechaHora])
}

model AvisoMembresia {                    // bitácora de WhatsApp y llave de idempotencia
  id                String   @id @default(uuid())
  membresiaId       String
  socioId           String
  tipo              TipoAviso            // BIENVENIDA, COMPROBANTE, D3, D0
  referenciaExterna String   @unique     // "{membresiaId}:{fechaFin}:{tipo}"
  estado            String               // ENVIADO, FALLIDO, OMITIDO_SIN_CONSENTIMIENTO, OMITIDO_SIN_TELEFONO
  envioId           String?
  error             String?
  creadoAt          DateTime @default(now())
}
```

`Configuracion` gana: `nombreGimnasio` ("LAUFIT Fitness Club"), `horarioAtencion` (lun-sáb 05:30-22:00, dom 09:00-14:00; una marcación fuera de ese horario queda destacada en el panel), `telefonoContacto` (974 775 549), `direccion`, `diasAvisoVencimiento`, `diasGracia`, `minutosAntiDuplicadoIngreso` (por defecto 60), `qrTokenActual` (token del QR de la sede, regenerable), `whatsappActivo`; se mantienen los fiscales de fuelspa. Se eliminan `usaCabinas` y los de Google Calendar.

## 7. Cobros y facturación (facturador-api)

Reglas heredadas de `especificacion-consumo-api.md`:

1. Solo desde el backend (no tiene auth ni CORS).
2. `fecha_emision` en hora de Lima sin zona (`fechaHoraLima()` de fuelspa).
3. Solo IGV 18 % gravado: los precios incluyen IGV y `gravadas = total / 1.18`.
4. El éxito se decide por `estado`, no por el HTTP.
5. Reintento = mismo número de comprobante.
6. `xml` y `cdr` se guardan sin reformatear.

### 7.1 Tipos de comprobante

| Tipo | Receptor |
|---|---|
| `NOTA_VENTA` | Interno, no va a SUNAT |
| `BOLETA` | Consumidor final o DNI/CE. Queda `generado` y se informa en el resumen diario |
| `FACTURA` | Exige RUC (tipo `6`); si el socio no tiene, se pide en la venta |

Ítems de membresía con unidad `ZZ` (servicio). Una venta es un solo pago (puede combinar métodos de pago, p. ej. efectivo + Yape), reutilizando `pagos.ts`.

### 7.2 Flujo de venta

1. Buscar o crear socio.
2. Elegir plan, fecha de inicio y matrícula si corresponde. El precio viene del plan.
3. Registrar el pago completo y el comprobante; asignar correlativo con `Correlativo` dentro de una transacción.
4. Crear `Membresia` + `Factura` + `FacturaItem` en una sola transacción.
5. "Enviar a SUNAT" con `?incluir=xml,cdr` y timeout de 60 s. Si hay timeout, se consulta por `GET` antes de reenviar (ya resuelto en fuelspa).
6. Con el comprobante generado se dispara `BIENVENIDA` y luego `COMPROBANTE` (sección 8).

Si SUNAT o el facturador fallan, la membresía queda activa y la factura "pendiente de envío", con el error visible y botón de reintento.

### 7.3 Anulación

Comprobante aceptado por SUNAT → nota de crédito (`tipo_nota` del catálogo 09, p. ej. `01`) con `referencia`. Nota de venta → anulación interna. La membresía queda `ANULADA`.

### 7.4 Cron de facturación

- `POST /api/facturacion/resumen-diario` (Bearer `CRON_SECRET`), una vez al día, para las boletas.
- `POST /api/facturacion/recuperar-cdr`: facturas y notas aceptadas sin `cdr` y con menos de 7 días; el facturador solo lo conserva ese tiempo.

## 8. Notificaciones por WhatsApp

Se consume `POST /v1/envios` con OAuth Client Credentials (token en caché 1 h). Módulo `src/lib/notificaciones.ts`.

### 8.1 Cuándo se envía

| Evento | `topicoCodigo` | `referenciaExterna` | Variables |
|---|---|---|---|
| Venta o renovación | `SUSCRIPCION_BIENVENIDA` | `{membresiaId}:{fechaFin}:BIENVENIDA` | `nombre`, `negocio`, `plan`, `fecha_vencimiento` |
| Comprobante emitido | `SUSCRIPCION_COMPROBANTE` | `{membresiaId}:{fechaFin}:COMPROBANTE` | `nombre`, `negocio`, `numero_comprobante`, `monto` |
| Faltan 3 días | `SUSCRIPCION_VENCE_3D` | `{membresiaId}:{fechaFin}:D3` | `nombre`, `negocio`, `fecha_vencimiento` |
| Vence hoy | `SUSCRIPCION_VENCE_HOY` | `{membresiaId}:{fechaFin}:D0` | `nombre`, `negocio`, `plan` |

Los nombres de variables son los propuestos; hay que leerlos de la configuración final cuando se aprueben las plantillas.

### 8.2 Reglas de la app

1. **Consentimiento**: casilla en el alta del socio ("acepto recibir mi comprobante y avisos por WhatsApp") con fecha y origen. Sin consentimiento no se envían recordatorios (`D3`/`D0`); queda `OMITIDO_SIN_CONSENTIMIENTO`.
2. **Job diario** (`GET /api/cron/avisos-membresias`, Bearer `CRON_SECRET`). Vercel cron corre en UTC: `0 13 * * *` = 8:00 en Lima. Busca membresías no anuladas con `fechaFin = hoy+3` y `fechaFin = hoy`, **sin otra membresía programada que las cubra** (si ya renovó, no se avisa).
3. **Idempotencia**: se inserta `AvisoMembresia` con `referenciaExterna` única antes de llamar. El servicio también es idempotente por (tópico, referencia).
4. Un envío a la vez; no hay endpoint masivo.
5. La primera llamada del día puede tardar ~15 s o dar `500`; reintentar a los pocos segundos con la misma referencia.
6. Un `502` (Meta rechazó) no se reintenta con la misma referencia; queda `FALLIDO` visible. El reenvío manual usa referencia nueva con sufijo `:r2`.
7. Variables solo texto, sin saltos de línea, tabulaciones ni 4 o más espacios seguidos.
8. El envío nunca bloquea una venta ni un ingreso: se hace tras confirmar la transacción.
9. Teléfono normalizado a E.164 (`+51` + 9 dígitos). Sin celular válido: `OMITIDO_SIN_TELEFONO`.
10. `ENVIADO` solo significa "aceptado por Meta", no entregado ni leído; la pantalla `/avisos` debe decirlo así.

### 8.3 Dependencias pendientes del servicio

| Pendiente | Impacto | Alternativa |
|---|---|---|
| Plantillas aprobadas por Meta (4 tópicos) | Sin ellas no hay envíos | Iniciar el trámite ya; tarda días |
| PDF adjunto en WhatsApp | `COMPROBANTE` sin PDF | Enviar número y monto; el PDF se imprime en recepción. Luego: URL firmada de S3 (≥ 10 min) justo antes del envío |
| Consentimiento en el servicio | "Acepto/No gracias" no se registran allí | La app guarda el suyo |
| Número propio del gimnasio | Hoy sale del número de CoreHub | Aceptar para el piloto |
| Cliente M2M propio | Aislamiento y revocación | Pedir `client_id` exclusivo |

## 9. Asistencia de socios: auto-marcación por QR

Flujo pedido: el socio llega, escanea un QR, ingresa su documento y marca asistencia. La administradora de turno ve en una pantalla quién marcó y verifica que corresponda a la persona que está frente a ella.

### 9.1 Flujo del socio (celular)

1. Escanea el QR de la entrada: `https://<host>/marcar?t=<token>`.
2. Página pública, simple, de un solo campo: selector de documento (DNI por defecto, CE) y número.
3. Pulsa "Marcar ingreso". El servidor busca al socio, calcula su membresía y guarda la `Asistencia` con hora del servidor.
4. **Respuesta en el celular, sin datos personales** (para no exponer nombres a quien escriba documentos ajenos):
   - Vigente o por vencer: "Ingreso registrado. ¡Buen entrenamiento!"
   - Membresía vencida o sin membresía: "Tu membresía no está vigente. Acércate a recepción."
   - Documento no registrado: "No encontramos tu documento. Acércate a recepción."
   - Ya marcó hace menos de `minutosAntiDuplicadoIngreso`: "Ya registraste tu ingreso."
5. El QR no bloquea físicamente el paso; la administradora decide en el panel (9.2).

### 9.2 Panel de ingresos en vivo (administradora)

Pantalla `/ingreso`, pensada para dejarse abierta en un monitor o tablet en recepción. Se actualiza sola cada pocos segundos (SWR con `refreshInterval`) y resalta con color y un sonido corto cada ingreso nuevo.

Cada ingreso aparece como tarjeta, el más reciente arriba:

| Dato | Para qué |
|---|---|
| **Foto grande y nombre completo** | Comparar visualmente con la persona que está en recepción |
| Documento (parcial: últimos dígitos) | Confirmar identidad |
| Plan y **días restantes** (con color: verde / ámbar ≤ 7 / rojo vencida) | Decidir si pasa |
| Fecha de vencimiento | — |
| Hora de marcación | — |
| Cumpleaños hoy | Saludo / detalle |
| Condición médica o notas | Avisar al coach si aplica |
| Visitas en los últimos 30 días / último ingreso anterior | Detectar socios que no vienen hace tiempo |
| Aviso "marcó hace X min" | Si la marca es antigua, probablemente no sea la persona de recepción |

Acciones por tarjeta (un clic):

- **Confirmar**: la administradora verificó que coincide. Pasa a `CONFIRMADA`.
- **No coincide / anular**: alguien marcó con un documento ajeno. Pasa a `ANULADA` con motivo y no cuenta como asistencia.
- **Cortesía**: membresía vencida pero se le deja ingresar. Pasa a `CORTESIA` con motivo obligatorio; se reporta aparte.
- **Renovar**: atajo a la venta con el socio ya cargado (si venció o está por vencer).

Las tarjetas sin revisar permanecen como `PENDIENTE` hasta el cierre de turno; el reporte indica cuántas quedaron sin confirmar.

También en el panel: búsqueda manual por documento, para registrar el ingreso del socio que no tiene celular o no pudo escanear (`origen = RECEPCION`), y el listado de coaches presentes (sección 10).

### 9.3 Seguridad (proporcional, ligera)

El control real es **la verificación visual de la administradora**; no se agrega PIN, QR rotativo, geocerca ni selfie. Lo mínimo que se mantiene:

- Hora del servidor (no la del teléfono).
- Límite de intentos por IP (p. ej. 20 por minuto) para que no se pueda recorrer documentos en bucle.
- Token en el QR que el `SUPERVISOR` puede regenerar desde Ajustes si el QR se filtra (se reimprime).
- Las respuestas del celular no incluyen nombre ni foto.
- Foto del socio obligatoria al alta (sin ella la verificación visual pierde sentido).

Riesgo aceptado: alguien podría marcar con el documento de otro. La administradora lo detecta al ver la foto; si pasa seguido, se evalúa un PIN. **[Decidir]** si se acepta.

### 9.4 Reportes derivados

Asistencia por día y por hora (horas pico), socios activos que no asisten hace 14 o más días (insumo para el seguimiento y futuros avisos), cortesías y anulaciones por turno.

## 10. Asistencia de coaches: entrada y salida por QR

Los coaches usan el mismo QR de la entrada y la misma página `/marcar`.

### 10.1 Flujo

1. El coach escanea el QR y escribe su documento.
2. El sistema reconoce que pertenece a un `Coach` activo (se busca primero entre coaches, luego entre socios). Si el documento está en ambos, pregunta qué desea marcar.
3. Decide **ENTRADA o SALIDA** según su última marcación válida: si la última fue ENTRADA, ahora es SALIDA, y viceversa. La pantalla de confirmación muestra el tipo propuesto y un botón "Es otra cosa" para invertirlo si se equivocó.
4. Se guarda `MarcacionCoach` con hora del servidor.
5. Respuesta en el celular: "Carlos, ENTRADA registrada 06:02" (el nombre aquí es aceptable porque los coaches son pocos y conocidos; si prefieres no mostrarlo, queda genérico). Si tiene turno asignado, indica a tiempo o tardanza.

### 10.2 Panel de coaches (supervisor/administradora)

- En `/ingreso`: franja "Coaches presentes" con quién entró, a qué hora y quién ya salió.
- `/coaches/asistencia`: tabla del día y calendario por coach; horas trabajadas, tardanzas, faltas (turno asignado sin marcación), marcaciones incompletas (ENTRADA sin SALIDA al cierre del día).
- **Corrección manual** (`SUPERVISOR`/`ADMIN`): crear o anular una marcación con motivo; queda `registradaPorId`.
- Reporte mensual por coach exportable a Excel (útil para planilla).

### 10.3 Seguridad

Misma filosofía que los socios: sin PIN ni geocerca. Control por transparencia: cada marcación aparece en el panel con su hora y la administradora ve quién está presente. Límite de intentos por IP. **[Decidir]** si el pago o la evaluación del coach dependen de esta asistencia, porque entonces conviene un PIN simple.

## 11. Pantallas y navegación

Mismo patrón de `Sidebar.tsx` (menú lateral filtrado por rol). **Identidad visual: LAUFIT** (negro de fondo, rojo como color de acento y botones, blanco para texto; tipografía condensada en títulos, como el afiche). Se reemplaza el verde y dorado de fuelspa en `tailwind.config.ts` y `Sidebar.tsx`. Falta el logo en archivo (SVG o PNG con fondo transparente).

| Ruta | Roles | Contenido |
|---|---|---|
| `/dashboard` | ADMIN, SUPERVISOR | Indicadores |
| `/ingreso` | ADMIN, SUPERVISOR | **Panel en vivo** de asistencia de socios y coaches presentes |
| `/socios`, `/socios/[id]` | ADMIN, SUPERVISOR | Listado y ficha (membresías, pagos, asistencias, avisos) |
| `/membresias/nueva` | ADMIN, SUPERVISOR | Venta o renovación |
| `/vencimientos` | ADMIN, SUPERVISOR | Por vencer y vencidos; posponer y llamar |
| `/cumpleanos` | ADMIN, SUPERVISOR | Como fuelspa |
| `/facturacion` | ADMIN, SUPERVISOR | Comprobantes, SUNAT, reintentos, notas de crédito |
| `/reportes` | ADMIN (cierre), SUPERVISOR | Cierre de turno, mensual, asistencia |
| `/avisos` | ADMIN, SUPERVISOR | Bitácora de WhatsApp y reenvío |
| `/coaches`, `/coaches/asistencia` | SUPERVISOR | Alta de coaches, turnos, marcaciones |
| `/planes` | SUPERVISOR | Catálogo de planes |
| `/gastos`, `/compras` | SUPERVISOR | Como fuelspa |
| `/usuarios`, `/ajustes` | SUPERVISOR | Usuarios, datos fiscales, QR de la sede (ver, imprimir, regenerar) |
| `/marcar` | **Público** | Auto-marcación de socios y coaches (móvil) |
| `/auth/login`, `/legal/privacidad` | Público | Como fuelspa |

`/marcar` se agrega al `matcher` del middleware como excepción pública, igual que `/auth/login` y `/legal`.

## 12. Requisitos no funcionales y plan

- **Móvil primero** en `/marcar`; monitor o tablet en `/ingreso`; escritorio en el resto.
- **Auditoría**: toda anulación, cortesía, corrección de marcación y cambio de precio guarda quién y cuándo.
- **Resiliencia**: si el facturador o WhatsApp caen, se sigue vendiendo y registrando asistencia; lo pendiente se reintenta. La marcación nunca depende de ellos.
- **Datos personales (Ley 29733)**: política enlazada desde `/marcar`; fotos con URLs firmadas; acceso por rol; backups diarios. Definir retención de asistencia con el contador o abogado.
- **Fechas de membresía como `Date`** (sin hora), para que un cambio de zona no mueva un vencimiento.
- **Pruebas** del cálculo de fechas y estados con casos límite (fin de mes, bisiesto, renovación adelantada) y de la lógica ENTRADA/SALIDA del coach.

### Etapas

| Etapa | Entrega |
|---|---|
| 0 | Responder la sección 13, iniciar plantillas en Meta, pedir `client_id` M2M, definir identidad visual |
| 1 | Proyecto base (arquitectura de fuelspa), auth, roles, socios con foto, planes, membresías |
| 2 | Cobros y facturación (adaptando `facturador.ts`), cierre de turno, resumen diario y recuperación de CDR |
| 3 | `/marcar` + panel `/ingreso` en vivo, asistencia de socios |
| 4 | Asistencia de coaches y reportes |
| 5 | Avisos por WhatsApp (puede construirse con modo "simulado" si las plantillas aún no están) |
| 6 | Dashboard, vencimientos, cumpleaños; piloto con 2 o 3 socios de prueba |

## 13. Preguntas abiertas [Decidir]

1. **Planes**: ya están los cinco del afiche (sección 1.1). Falta confirmar si existe **pase diario** o **matrícula** (el afiche no los muestra) y si hay otros planes que no se publican (estudiante, pareja, convenio).
2. **Comprobantes**: ¿mayormente boletas o notas de venta? ¿Hay clientes que pidan factura?
3. **Foto del socio al alta**: ¿se toma en recepción con la cámara de la tablet o PC? (La verificación visual depende de esto.)
4. **Marcación sin verificar**: ¿qué hace la administradora si hay una marca pendiente al terminar su turno? (Propuesta: se reporta cuántas quedaron `PENDIENTE`.)
5. **Membresía vencida que marca**: ¿se le permite entrar de cortesía con motivo, o se le exige renovar siempre?
6. **Coaches**: ¿cuántos, con horario fijo y turnos? ¿La asistencia afecta su pago?
7. **Seguridad**: ¿se acepta el riesgo de marcar con documento ajeno, mitigado por la verificación visual, o se agrega un PIN?
8. **Cambio de plan a mitad de membresía** (p. ej. mensual a trimestral): ¿ocurre? Hoy se resolvería anulando y vendiendo de nuevo.
9. **Venta de productos y casilleros**: ¿desde la primera fase o después?
10. **Logo en archivo** (SVG o PNG transparente). El nombre comercial para los mensajes será "LAUFIT Fitness Club", ¿correcto?
11. **RUC emisor y series** de comprobantes; el facturador debe tener el RUC dado de alta.
12. **Número de WhatsApp**: el 974 775 549 del afiche es el número de atención del gimnasio. ¿Se usará como número remitente propio (requiere alta en Meta por el servicio de notificaciones) o el de CoreHub en el piloto?
13. **Retención de datos** de asistencia: validar con contador o abogado.
