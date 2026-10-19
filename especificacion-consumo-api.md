# Especificación: consumir facturador-api

Servicio REST para emitir comprobantes electrónicos de SUNAT (factura, boleta, nota de crédito, nota de débito) y consultar su estado.

- **URL base:** `https://facturador.peru-hub.com` (Swagger en `/docs`)
- **Formato:** JSON sobre HTTPS, UTF-8.
- **`{ruc}`:** el RUC emisor (11 dígitos), que va en la URL. Si el RUC no está dado de alta, responde `404`.

## 0. Reglas que no se pueden pasar por alto

1. **El servicio no tiene autenticación ni CORS todavía.** Hay que llamarlo solo desde el backend, nunca desde el navegador. El mecanismo de acceso (API key o restricción por IP) está pendiente de definir.
2. **`fecha_emision` va en hora de Lima**, sin zona horaria ni `Z` (`2026-10-15T10:30:00`). Se usa tal cual llega.
3. **Solo IGV 18% gravado.** No hay soporte para exonerado, inafectado ni gratuito.
4. **El éxito se decide por el campo `estado`, no por el HTTP.** Un comprobante rechazado por SUNAT también responde `201`.
5. **Para reintentar se reenvía el mismo número.** No se usa un número nuevo para reintentar un error, un `502` o un timeout.
6. **El `xml` y el `cdr` se guardan sin reformatear.** Si cambia un solo espacio, la firma deja de validar.

## 1. Emitir: `POST /empresas/{ruc}/comprobantes`

Query opcional: `?incluir=xml,cdr` agrega esos archivos a la respuesta. Un valor desconocido da `400`.

### Cuerpo

| Campo | Tipo | Oblig. | Notas |
|---|---|---|---|
| `numeracion_comprobante` | string | sí | `SERIE-CORRELATIVO`, ej. `F002-000001`, `B001-000044` |
| `tipo_comprobante` | string | sí | `FACTURA`, `BOLETA`, `NOTA_CREDITO`, `NOTA_DEBITO` (o `01`, `03`, `07`, `08`) |
| `fecha_emision` | datetime ISO | sí | Hora de Lima |
| `total` | número | sí | Total con IGV |
| `gravadas` | número | no | Base imponible. Si se manda, mandar también `igv` |
| `igv` | número | no | Si se omiten ambos, se calculan al 18% desde `total` |
| `tipo_moneda` | string | no | Por defecto `PEN` |
| `monto_letras` | string | no | Ej. `CIENTO DIECIOCHO CON 00/100 SOLES` |
| `receptor` | objeto | ver abajo | `tipo_documento`, `numero_documento`, `razon_social` |
| `items` | lista | sí | Ver abajo |
| `referencia` | objeto | solo notas | Ver abajo |

**`receptor`** (por defecto `"0"`, `"00000000"`, `"CLIENTE VARIOS"`)
- Factura: `tipo_documento` debe ser `"6"` y `numero_documento` un RUC de 11 dígitos. Si no, responde `422`.
- Boleta: puede ir con los valores por defecto (consumidor final), o con `"1"` y un DNI de 8 dígitos.

**`items[]`**

| Campo | Notas |
|---|---|
| `descripcion` | obligatorio |
| `cantidad` | por defecto 1 |
| `medida` | por defecto `NIU` |
| `codigo_producto` | opcional |
| `valor` | valor unitario **sin** IGV (hasta 6 decimales) |
| `valor_venta` | `valor × cantidad` sin IGV, redondeado a 2 decimales |
| `igv_venta` | IGV de la línea |
| `precio` | precio unitario **con** IGV |

Las sumas de las líneas deben cuadrar con `total`, `gravadas` e `igv`. La API no lo valida, y SUNAT rechaza si no cuadran.

**`referencia`** (obligatoria en notas de crédito y de débito; sin ella responde `422`)
- `tipo_nota`: código del catálogo 09 (crédito) o 10 (débito), ej. `01`.
- `tipo_documento_afectado`: `01` o `03`.
- `numeracion_documento_afectado`: ej. `F002-000001`.
- `motivo_documento_afectado`: texto libre y opcional.

### Ejemplo

```json
POST /empresas/{ruc}/comprobantes?incluir=xml
{
  "numeracion_comprobante": "F002-000010",
  "tipo_comprobante": "FACTURA",
  "fecha_emision": "2026-10-15T10:30:00",
  "total": 118.00, "gravadas": 100.00, "igv": 18.00,
  "monto_letras": "CIENTO DIECIOCHO CON 00/100 SOLES",
  "receptor": {"tipo_documento": "6", "numero_documento": "20123456789", "razon_social": "CLIENTE SAC"},
  "items": [{"descripcion": "SERVICIO", "cantidad": 1, "valor": 100.000000,
             "valor_venta": 100.00, "igv_venta": 18.00, "precio": 118.00}]
}
```

### Respuesta `201`

```json
{"codigo": "01-F002-000010", "estado": "aceptado", "des_obse": "-",
 "hash": "fQpBhx...=", "qr": "{ruc}|01|F002|000010|18.00|118.00|2026-10-15|6|20123456789|fQpBhx...=",
 "codigo_error": null, "descripcion_error": null, "xml": "<?xml ...>", "cdr": null}
```

- `codigo` es `{tipo}-{numeracion}` y sirve para consultar después.
- `hash` y `qr` son `null` hasta que el comprobante se firma. El `qr` se codifica tal cual como código QR en la representación impresa.
- `codigo_error` y `descripcion_error` solo vienen en estados `rechazado` o `error`.

### Estados

| `estado` | Significado | Qué hacer |
|---|---|---|
| `aceptado` | SUNAT lo aceptó | Listo |
| `aceptado_con_observaciones` | Aceptado con advertencias (ver `des_obse`) | Listo |
| `enviado` | SUNAT ya lo tiene, pero el CDR aún no se descargó | Tratarlo como emitido y consultar con `GET` luego |
| `generado` | Firmado y en espera. **Toda boleta queda así** | Ver sección 3 |
| `pendiente`, `validando` | En proceso | Consultar con `GET` más tarde |
| `rechazado` | SUNAT lo rechazó | Corregir el dato y reenviar el mismo número |
| `error` | SFS no pudo firmar o generar | Reintentar el mismo número |
| `anulado` | Anulado | Final |

## 2. Consultar: `GET /empresas/{ruc}/comprobantes/{codigo}`

El `codigo` es `{tipo}-{numeracion}`, ej. `01-F002-000010`.

La respuesta trae `codigo`, `estado`, `des_obse`, `fec_gene`, `fec_envi`, `codigo_error`, `descripcion_error`, y siempre `xml` y `cdr` cuando ya existen.

- Da `404` si no existe y `400` si el formato es inválido.
- El `cdr` está disponible solo **7 días** tras la aceptación. Después se archiva en el servidor, así que hay que descargarlo y guardarlo dentro de ese plazo.
- El `xml` no tiene ese límite.

## 3. Boletas y resumen diario

La boleta **nunca se envía sola a SUNAT**. Queda `generado` y se informa en un resumen diario (RC).

1. El `POST` de una boleta devuelve `generado` con `hash` y `qr`. Ya se puede entregar al cliente.
2. **Hay que pedir `?incluir=xml` en ese mismo POST.** Cuando el resumen consume la boleta, su `GET` da `404`.
3. Una vez al día se llama a `POST /empresas/{ruc}/resumenes-diarios`, sin cuerpo. Incluye las boletas de días **anteriores**. Llamarlo de más es inofensivo.
   - Con pendientes responde `{"numeracion_rc": "RC-20261015-001", "cantidad_boletas": 7, "boletas": ["B001-000044", ...], "estado": "aceptado", "des_obse": "-"}`.
   - Sin pendientes responde `{"mensaje": "No hay boletas de días anteriores pendientes de resumir."}`.
4. SUNAT procesa el resumen de forma asíncrona. Para ver el veredicto final se hace `GET .../comprobantes/RC-20261015-001`. Si el resumen es `rechazado`, la lista `boletas` indica cuáles reencolar.
5. El CDR de una boleta es el del resumen. La boleta individual nunca trae `cdr`.

## 4. Reintentos e idempotencia

Reintentar es repetir el `POST` con el mismo número. El servicio decide según el estado previo:

| Estado previo | Resultado |
|---|---|
| aceptado, enviado, anulado | No reenvía y devuelve el estado actual, así que repetirlo es seguro |
| rechazado | Limpia y reenvía con el dato corregido |
| error (factura o nota) | Consulta antes a SUNAT. Si ya lo tiene responde `enviado`, si no lo reenvía, y si no puede confirmar responde `502` |
| error (boleta) | La vuelve a generar |

No se reintenta un `rechazado` sin cambiar nada, porque se rechaza igual. Se corrige según `codigo_error` y `descripcion_error`.

## 5. Errores HTTP

| HTTP | Cuándo | Acción |
|---|---|---|
| `201` | Procesado | Revisar `estado` |
| `200` | Los `GET` y el resumen | — |
| `400` | `incluir` inválido, o `codigo` mal formado | Corregir la llamada |
| `404` | RUC no dado de alta, o comprobante inexistente | Verificar |
| `409` | No se pudo armar el resumen (`detail`) | Leer el detalle |
| `422` | Dato inválido: campo faltante, factura sin RUC, nota sin `referencia` | Corregir y **no reintentar igual** |
| `502` | SFS caído, o no se pudo verificar en SUNAT | Reintentar luego con el **mismo número** |

El formato de error es `{"detail": "texto"}`. En un `422` de campos, `detail` es una lista de `{loc, msg, type}`.

**Timeouts:** el `POST` es síncrono y puede tardar de 1 a 10 segundos o más. Conviene un timeout de cliente de al menos 60 s. Si se agota, no hay que asumir que falló. Se hace `GET` del `codigo`: si da `404`, no llegó y se reenvía el mismo `POST`; si existe, se usa su estado.

## 6. Otros endpoints

- `GET /salud` devuelve `{"estado": "ok"}`, para monitoreo.
- `GET /empresas/{ruc}/rechazos?desde=AAAA-MM-DD&origen=sunat&limite=50` devuelve el historial de fallos, lo más reciente primero. Los valores de `origen` son `sunat`, `sfs`, `validacion`, `red`, `resumen` y `consulta`. Cada evento trae `fecha`, `codigo`, `estado`, `codigo_error`, `descripcion_error`, `des_obse`, `origen` y `detalle`. El máximo de `limite` es 1000.

## 7. Flujo recomendado para el agente

1. Armar el payload y calcular `valor`, `valor_venta`, `igv_venta`, `precio`, `gravadas`, `igv` y `total` de forma consistente.
2. Hacer `POST` con `?incluir=xml` y timeout de 60 s o más.
3. Decidir por `estado`:
   - **Éxito** (`aceptado`, `aceptado_con_observaciones`, `enviado`): guardar `xml`, `hash` y `qr`.
   - **Boleta `generado`**: guardar `xml`, `hash` y `qr`, y dejarla para el resumen del día siguiente.
   - **`pendiente` o `validando`**: consultar con `GET` más tarde.
   - **`rechazado`**: mostrar `descripcion_error` y corregir el dato.
   - **`error`, `502` o timeout**: reintentar con el mismo número.
4. Para facturas y notas: consultar con `GET` hasta tener el `cdr` y guardarlo dentro de los 7 días.
5. Programar un cron diario para `POST /resumenes-diarios` si se emiten boletas.

## Pendientes conocidos

- Autenticación: hoy no hay ninguna; el mecanismo está por definir.
- Un comprobante `rechazado` aún no devuelve CDR en el `GET`.
