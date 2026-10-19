# Spec: cómo consumir el servicio `notificaciones-whatsapp` desde la app del gimnasio

Documento autocontenido para quien construye la app del gimnasio (o cualquier sistema de
suscripciones). No depende de ninguna otra conversación. Idioma de trabajo: español.

## 1. Qué es y cómo se usa

`notificaciones-whatsapp` manda mensajes de WhatsApp (y correo) en nombre de un negocio. La app del
gimnasio **no habla con WhatsApp ni con Meta**: llama a una API HTTP del servicio con "qué aviso mandar,
a quién y con qué datos". El servicio se encarga de la plantilla, el envío, la auditoría y la
idempotencia.

Modelo: el gimnasio es un **proyecto** (`proyectoCodigo`) con sus **tópicos** (tipos de aviso, uno por
plantilla de WhatsApp). Agregar un negocio o un aviso nuevo es configuración en nuestra base, no código.

## 2. Qué existe hoy y qué falta (leer primero)

| Capacidad | Estado |
|---|---|
| Autenticación M2M (OAuth Client Credentials) | **Disponible** |
| `POST /v1/envios`: envío a un destinatario con plantilla de WhatsApp o correo | **Disponible** |
| Idempotencia por `referenciaExterna` | **Disponible** |
| Plantillas y tópicos del gimnasio (bienvenida, comprobante, vencimiento) | **Por crear** (Meta debe aprobar las plantillas) |
| PDF del comprobante adjunto en el mensaje de WhatsApp | **Por construir** (hoy el adjunto solo existe para correo, en base64) |
| Consentimiento del socio (aceptar y revocar) | **Por construir** |
| Número de WhatsApp propio del negocio | **Por construir** (hoy todo sale del número de CoreHub) |
| Consultar el estado de un envío (`GET`) o recibir "entregado/leído" | **No existe** |
| Programar avisos ("3 días antes") | **No existe**: lo dispara la app del gimnasio |

Las secciones 6 a 9 describen lo **propuesto**: los nombres definitivos se confirman cuando se construya.

## 3. Autenticación

OAuth 2.0 **Client Credentials**. Pedir un token y usarlo como `Bearer`. Dura 1 hora: cachearlo y
renovarlo antes de que venza.

- Token URL: `https://notificaciones-whatsapp-m2m-dev-cc4416b4fc.auth.us-east-2.amazoncognito.com/oauth2/token`
- Scope: `notificaciones-api/envios.write`
- `client_id` y `client_secret`: **se entregan por canal seguro**, nunca en este documento ni en el
  repositorio. Guardarlos en el gestor de secretos de la app del gimnasio. Conviene un client propio por
  negocio (alta en CDK, pocas líneas) en vez de compartir el existente.

```bash
curl -X POST "https://notificaciones-whatsapp-m2m-dev-cc4416b4fc.auth.us-east-2.amazoncognito.com/oauth2/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -u "<client_id>:<client_secret>" \
  -d "grant_type=client_credentials&scope=notificaciones-api/envios.write"
# → { "access_token": "...", "expires_in": 3600, "token_type": "Bearer" }
```

## 4. `POST /v1/envios`

Base URL: `https://pjxj3p3c97.execute-api.us-east-2.amazonaws.com`

```
POST /v1/envios
Authorization: Bearer <access_token>
Content-Type: application/json
```

```json
{
  "proyectoCodigo": "GIMNASIO",
  "topicoCodigo": "SUSCRIPCION_VENCE_HOY",
  "destinatario": { "telefono": "+51987654321" },
  "referenciaExterna": "membresia-8841:2026-11-05:D0",
  "variables": {
    "nombre": "Carla",
    "negocio": "Gym Titanes",
    "plan": "Mensual",
    "fecha_vencimiento": "2026-11-05"
  }
}
```

| Campo | Obligatorio | Detalle |
|---|---|---|
| `proyectoCodigo` | sí | Código del proyecto (se entrega al dar de alta el negocio). |
| `topicoCodigo` | sí | Tipo de aviso. Debe existir para ese proyecto y ser de modo `A_DEMANDA`. |
| `destinatario.telefono` | sí para WhatsApp | Formato E.164 con `+` y código de país (`+51…`). |
| `destinatario.email` | sí para correo | El tópico define el canal: WhatsApp o correo, no ambos. |
| `referenciaExterna` | sí | Clave de idempotencia (ver 5). |
| `variables` | sí | Mapa `nombre → texto`. Los nombres deben coincidir **exactamente** con las variables de la plantilla aprobada, si no Meta rechaza el envío. Solo texto, sin saltos de línea, tabulaciones ni 4 o más espacios seguidos. |

Respuesta:

| HTTP | Cuándo | Cuerpo |
|---|---|---|
| `200` | Mensaje aceptado por Meta, o reintento con la misma `referenciaExterna` ya enviada | `{ "envioId": "...", "estado": "ENVIADO", "proveedorMensajeId": "wamid..." }` |
| `502` | Meta rechazó el envío (plantilla, número, ventana, etc.) | `{ "envioId": "...", "estado": "FALLIDO", "error": "..." }` |
| `400` | Pedido inválido (campo faltante, proyecto o tópico inexistente, tópico no `A_DEMANDA`, falta teléfono/email) | `{ "error": "..." }` |
| `401` / `403` | Token ausente, vencido o sin el scope | — |
| `500` | Error interno | `{ "error": "Error interno" }` |

`ENVIADO` significa **aceptado por Meta**, no entregado ni leído.

## 5. Idempotencia y reintentos

- La unicidad es por **(tópico, `referenciaExterna`)**. Repetir la llamada con la misma referencia
  **no reenvía**: devuelve el resultado guardado (también si fue `FALLIDO`).
- Armar la referencia con datos estables: `{idMembresía}:{fechaVencimiento}:{tipo}`, donde `tipo` es
  `BIENVENIDA`, `COMPROBANTE`, `D3` o `D0`. Así el job diario puede correr varias veces sin duplicar.
- Un `502` no se arregla reintentando con la misma referencia. Para reenviar a propósito, usar una
  referencia nueva (por ejemplo, con sufijo `:r2`) o pedir que se libere el envío fallido.
- Un `500` o un timeout antes de guardar el envío **sí** se puede reintentar con la misma referencia.
- La primera llamada del día puede tardar hasta ~15 segundos (la base de datos se pausa cuando no hay
  uso) y, mientras no se amplíe el timeout, devolver `500`. Reintentar a los pocos segundos es seguro.
- Mandar los avisos de a uno o con poca concurrencia. No hay endpoint masivo.

## 6. Tópicos propuestos para el modelo genérico (por crear)

Todos con variables genéricas. `negocio` permite reutilizar la misma plantilla para varios clientes.

| `topicoCodigo` | Cuándo | Variables | Categoría Meta (probable) |
|---|---|---|---|
| `SUSCRIPCION_BIENVENIDA` | Al matricular o renovar. Trae botones "Acepto recordatorios" y "No, gracias" | `nombre`, `negocio`, `plan`, `fecha_vencimiento` | Utilidad |
| `SUSCRIPCION_COMPROBANTE` | Al emitir la factura o boleta, con el PDF adjunto | `nombre`, `negocio`, `numero_comprobante`, `monto` | Utilidad |
| `SUSCRIPCION_VENCE_3D` | 3 días antes del vencimiento, con botón de enlace a promociones | `nombre`, `negocio`, `fecha_vencimiento` | Marketing (probable) |
| `SUSCRIPCION_VENCE_HOY` | El día del vencimiento, con invitación a renovar | `nombre`, `negocio`, `plan` | Utilidad |

Los nombres de variables son propuestos. Quedan fijos cuando se redacten las plantillas, y la app del
gimnasio debe leerlos de la configuración final.

## 7. PDF del comprobante (por construir)

Propuesta: el campo `adjuntoUrl` con una **URL firmada de S3** (válida al menos 10 minutos) y
`adjuntoNombre` con el nombre visible (por ejemplo `boleta_B001-123.pdf`). WhatsApp descarga el archivo
directo desde la URL, así que debe ser accesible sin autenticación. Pedir o firmar la URL justo antes de
llamar a `POST /v1/envios`, no guardarla de antemano. Hoy, solo para correo, existe `adjuntoBase64` +
`adjuntoNombre` + `adjuntoContentType`.

## 8. Consentimiento (por construir, pero ya obligatorio en la práctica)

Meta exige que el socio haya aceptado recibir mensajes. Reglas para la app del gimnasio:

1. Al matricular, mostrar una casilla o cláusula ("acepto recibir mi comprobante y avisos por WhatsApp")
   y **guardar fecha y origen** de la aceptación.
2. No llamar a `POST /v1/envios` para recordatorios ni promociones a socios que no aceptaron o que
   pidieron dejar de recibir.
3. Cuando exista la tabla de consentimiento del servicio, el botón "Acepto" y la palabra "baja" del
   socio quedarán registrados allí, y los tópicos de recordatorio y promoción se bloquearán solos.

## 9. Calendario de disparo recomendado

Un job diario en la app del gimnasio (hora fija de la mañana):
- Socios cuyo vencimiento es en 3 días → `SUSCRIPCION_VENCE_3D`
- Socios cuyo vencimiento es hoy → `SUSCRIPCION_VENCE_HOY`
- Al registrar una matrícula o renovación → `SUSCRIPCION_BIENVENIDA` y luego `SUSCRIPCION_COMPROBANTE`

Los planes (mensual, trimestral, semestral, anual) no cambian el servicio: solo cambia la fecha que
calcula la app.

## 10. Lo que el servicio no hace

- No programa envíos ni lleva la cuenta de vencimientos.
- No guarda socios ni membresías: el destinatario viaja en cada llamada.
- No ofrece consulta de historial por API ni avisos de entregado o leído.
- Fuera de una conversación abierta por el socio (24 h), WhatsApp **solo permite plantillas aprobadas**:
  no se puede mandar texto libre.

## 11. Alta de un negocio nuevo (lado de quien opera el servicio)

1. Crear el proyecto en `proyectos_cliente` (`/v1/admin/proyectos-cliente`).
2. Crear las plantillas en Meta y esperar su aprobación (idioma `es`, variables nombradas, ninguna
   variable al principio ni al final del cuerpo).
3. Crear los tópicos `A_DEMANDA` con el nombre exacto de cada plantilla aprobada.
4. Crear el client M2M del negocio y entregar `client_id` y `client_secret` por canal seguro.
5. Probar con 2 o 3 socios de prueba antes de conectar la base real.
