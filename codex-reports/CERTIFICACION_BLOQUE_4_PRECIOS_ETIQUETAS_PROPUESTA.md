# Certificación manual — Bloque 4: Precios de venta y etiquetas · PROPUESTA (no preparada ni ejecutada)

> **REEMPLAZADA (2026-11-26)** por `CERTIFICACION_BLOQUE_4_PRECIOS_ETIQUETAS.md`, que tiene los escenarios definitivos,
> incluidos los adicionales, las decisiones del operador y las herramientas preparadas. Este documento queda como antecedente.

Fecha: 2026-11-25 · Estado: **PROPUESTA PARA REVISIÓN** (operador / ChatGPT). No se prepara ni se ejecuta hasta cerrar el
Bloque 3 (`M11251859`, falta el ZIP definitivo con la conciliación) y autorizar este bloque.
Entorno: Railway TESTING (`testing-codex` = `327d6c73`), negocio QA `paola-vinal`. Production intacta.
Metodología: igual que los Bloques 1–3. El operador prueba en la interfaz. Claude prepara la línea base, las instrucciones y
la verificación de solo lectura, con herramientas adaptadas de `b3-manual`.

## 1. Comportamiento implementado (revisado en el código de `327d6c73`; no se inventan reglas)

Fuentes: `DECISIONS_AND_INVARIANTS.md` (SALE_PRICE_*, SHELF_LABEL_*, PRICE_ACTIVATIONS, SALE_START_*, SALE_TOTAL_GUARD),
`F10_C2_F5_COMPRAS_RECEPCION_DISENO.md` §15.2-4/7/8 y §15.4, `F4_B_JUSTIFIED_PRICES.md`; servicios
`precios-venta-service`, `etiquetas-precio-service`, `inicio-venta-service` y `catalogo-empleado-service`.

- **Edición desde el catálogo** (dueño, producto o variante; empleado con permiso; importación):
  - El precio cambia **en el acto**.
  - Queda una activación `CATALOGO` en `activaciones_precio_venta` (append-only), en la misma transacción.
  - Si había una etiqueta pendiente de ese producto o variante, queda `REEMPLAZADA_POR_CATALOGO`.
  - Auditoría: `producto.precio_cambiado` (simple) o `producto.variante_actualizada` (variante). No crea etiquetas.
  - No toca costo ni stock.
- **Etiquetas:** sólo nacen al **aprobar una recepción** en la que el dueño autoriza un precio propuesto.
  - La propuesta es `costoNuevo × precioBase / costoAnterior`, al centavo. `precioBase` es el último precio autorizado.
  - Queda `cambios_precio_venta` (append-only) y, en modo ETIQUETA, una etiqueta `PENDIENTE`.
  - Mientras está pendiente se sigue cobrando el precio anterior.
  - El modo SIN_ETIQUETA activa el precio al aprobar (`APROBACION_SIN_ETIQUETA`).
- **Resolución de etiquetas:**
  - El empleado de Caja o el dueño **confirman** (`ETIQUETA`). Sólo el dueño **activa sin etiqueta** (`DUENO_SIN_ETIQUETA`) o **descarta**; un empleado recibe 403 `SOLO_DUENO`.
  - Cada etiqueta se resuelve una sola vez y tiene a lo sumo una activación. Una segunda confirmación se omite («ya estaba actualizada»).
  - Una autorización más nueva o una edición del catálogo deja la anterior `REEMPLAZADA`: nunca se activa un precio viejo.
  - Auditorías: `precio_venta.etiqueta_confirmada`, `activado_sin_etiqueta` y `etiqueta_descartada`.
  - Sin efectos sobre compras, costos, stock, deudas, pagos, promociones ni ventas.
- **Protección de precios en ventas iniciadas:**
  - El servidor registra `inicios_venta` al agregar el primer producto.
  - Al cobrar, cada producto vale lo vigente **al inicio**, también si se agregó después.
  - El inicio es de un solo uso y vence a los 30 min.
  - El cliente nunca envía precios: si el total mostrado no coincide → 409 `PRECIOS_CAMBIARON`, sin escribir.
  - Las ventas ya cobradas nunca cambian; F4-B, ya certificado, conserva el precio cobrado en las correcciones.
- **Permisos del empleado en el catálogo:**
  - Son por campo (crear, editar, proveedores, precios, costos, importar) y tienen **vencimiento nativo** (`catalogoHasta`).
  - Sin permiso de precios → 403 `PRECIO_SIN_PERMISO`. El stock nunca se edita desde el catálogo.
  - Auditoría: `empleado.permiso_catalogo` / `empleado.permiso_catalogo_revocado`, con antes y después.
  - A diferencia del permiso de anticipos del Bloque 3, este permiso sí tiene vigencia en el sistema.

## 2. Datos QA (reutilizar; estado al cierre del Bloque 3)

| Dato | Estado actual | Uso |
|---|---|---|
| «QA B2 Producto Stock M11250631» (simple, controla stock) | precio 900 · costo 605 · stock 6 | precio simple, etiquetas, venta protegida |
| «QA B1 Producto B» con Variante 1 / Variante 2 | base 1000 · variantes 1100 / 1200 | precio de variante |
| «QA B1 Producto A» (simple, sin control de stock) | precio 1000 · costo 726 | cambio de precio por el empleado con permiso |
| Pedido E5 del Bloque 3 (Alfa) | abierto, 2 unidades pendientes a 500 | **dos recepciones de 1 unidad** para generar etiquetas (única vía implementada) |
| Cajero QA (área Caja) | sin permisos de catálogo ni de anticipos | confirmar etiquetas, venta, permisos temporales |
| Caja QA «QA Caja A e31b» | sin turno abierto | única caja con dinero (venta protegida) |
| Turno del dueño «Caja principal» | abierto desde el 04/11 | **intacto** (sólo lectura) |

Sin productos, proveedores, pedidos ni cajas nuevos. Hoy no hay registros de precios en los productos QA (0 cambios,
0 activaciones, 0 etiquetas).

## 3. Escenarios propuestos (importes a confirmar en la preparación)

| Id | Escenario (operador) | Resultado esperado |
|---|---|---|
| B4-E1 | Dueño cambia el precio del Producto Stock 900 → **950** desde el catálogo | Una activación `CATALOGO` 900 → 950 y una auditoría `producto.precio_cambiado`. Costo 605, último costo y stock 6 sin cambios. Ninguna etiqueta. Sin dinero |
| B4-E2 | Dueño cambia la **Variante 1** de Producto B 1100 → **1150** | Una activación `CATALOGO` con la variante y una auditoría `producto.variante_actualizada`. Variante 2 (1200), precio base y costos sin cambios |
| B4-E3 | Permisos del empleado: el cajero intenta editar el precio de Producto A sin permiso. El dueño le da «Editar» + «Precios» con vencimiento al día siguiente; el cajero cambia 1000 → **1050**. El dueño revoca; el cajero vuelve a intentar | Primer intento: 403 `PRECIO_SIN_PERMISO`, sin escribir. Después: una activación `CATALOGO` del empleado y `producto.precio_cambiado` a su nombre (precio anterior y nuevo); costo 726 intacto. Tras revocar: 403. Dos cambios de permiso auditados y permisos restaurados exactamente |
| B4-E4 | Recepción R1 del pedido E5: **1 unidad a 550** + IVA 21 %. El dueño aprueba y autoriza el precio propuesto **en modo etiqueta** | Obligación de 665,50 y stock 6 → 7. Último costo 605 → 665,50. Propuesta 950 × 665,50 / 605 = **1.045,00**. Un `cambios_precio_venta` y una etiqueta L1 `PENDIENTE`. Se sigue cobrando **950** |
| B4-E5 | Venta protegida y confirmación por el cajero. El cajero abre turno en la caja QA (fondo 0), inicia una venta con 1 Producto Stock (950) y, en otra pestaña, confirma L1 en «Etiquetas». Cobra la venta en efectivo. Abre otra venta (ve 1.045) y no la cobra. Intenta confirmar L1 de nuevo. Cierra el turno con contado 950 | L1 `ACTIVADA`/`ETIQUETA_CONFIRMADA` por el empleado: una activación `ETIQUETA` 950 → 1.045. La venta se cobra a **950** (precio al inicio), con un cobro y una operación financiera, y el stock baja 7 → 6. El cajero no tiene «Descartar» ni «Activar sin etiqueta». La segunda confirmación no crea otra activación. El turno QA cierra con esperado 950 = contado 950. El segundo inicio queda sin usar |
| B4-E6 | Reemplazo. Recepción R2 del pedido E5: **1 unidad a 605** + IVA. Se autoriza en modo etiqueta (L2). Después el dueño fija el precio en el catálogo 1.045 → **1.100** | Obligación de 732,05; stock 6 → 7; último costo 732,05. Propuesta 1.045 × 732,05 / 665,50 = **1.149,50** (L2 `PENDIENTE`). La edición del catálogo deja L2 `REEMPLAZADA_POR_CATALOGO` y crea una activación `CATALOGO` 1.045 → 1.100. El precio queda en 1.100, nunca en 1.149,50, y L2 ya no se puede confirmar. El pedido E5 queda sin unidades pendientes |
| B4-E7 | Historial y ausencia de efectos indebidos | Historiales append-only con identidad y relaciones (cambio → etiqueta → activación), una sola vez cada uno. Lista «Etiquetas» del dueño: 0 pendientes, 2 completadas. Ningún pago, asignación ni salida de Caja. Alfa: sólo las dos obligaciones nuevas. Único dinero: la venta de 950 en la caja QA. Ventas anteriores del negocio sin cambios. Turno del dueño intacto |

**Totales esperados:**
- Precios finales: Producto Stock **1.100**; Producto B Variante 1 **1.150**; Producto A **1.050**.
- Stock: 6 → **7**.
- Alfa: pendiente 210 + 665,50 + 732,05 = **1.607,55**, con los anticipos de 1.768,50 sin cambios.

## 4. Decisiones para el operador antes de preparar

1. **Etiquetas:** sólo se generan al aprobar recepciones con costo distinto. ¿Se aceptan las dos recepciones de 1 unidad
   del pedido E5? Agregan 1.397,55 de deuda a Alfa y cierran las unidades pendientes. La alternativa es una recepción sin
   pedido.
2. **Venta protegida (E5):** es la única forma de certificar en TESTING la protección por inicio de venta. Mueve
   dinero ficticio (cobro de 950 en la caja QA) y stock (−1). La alternativa es dejarla para un bloque de ventas.
3. **Permiso temporal de catálogo (E3)** del cajero: «Editar» + «Precios» con vencimiento al día siguiente, revocado en el
   mismo bloque.
4. **Fuera de alcance, salvo que se pida:**
   - «Descartar» y «Activar sin etiqueta» por el dueño, y el modo SIN_ETIQUETA al aprobar. Cada uno necesita otra etiqueta, es decir, otra recepción.
   - El vencimiento de 30 min del inicio de venta y el 409 `PRECIOS_CAMBIARON`.
   - La importación de productos y las promociones.
   - Lo que quede fuera se informa como no certificado.

## 5. Verificación interna (solo lectura, adaptando `b3-manual`)

- **Base:** la misma SQL que `b3-manual.sql`.
- **Se agregan las filas de:**
  - `cambios_precio_venta`, `etiquetas_precio` (estado, resolución, actor) y `activaciones_precio_venta` (origen, anterior, nuevo, actor, etiqueta);
  - `inicios_venta`, las ventas y sus renglones de los productos QA en el intervalo, sus cobros y operaciones;
  - los permisos de catálogo del cajero.
- **Se compara antes y después:** precios de producto y variantes, costos y últimos costos, stock, obligaciones de Alfa, turnos y ventas anteriores.
- **Controles:**
  - Cada activación con su origen y actor; cada etiqueta resuelta una vez.
  - Que la venta use el precio del inicio.
  - Rechazos HTTP esperados: 403 `PRECIO_SIN_PERMISO` antes del permiso y después de revocar.
- Ninguna otra escritura. Mismas protecciones del ejecutor, revisión de credenciales y ZIP.

## 6. Mejora reutilizable: consultas de sesión sin autenticar (propuesta; se aplicaría desde las herramientas del Bloque 4)

En los Bloques 2 y 3 aparecieron 401 de consultas normales de sesión: la pantalla de ingreso consulta `/api/operativo/me`
y las ventanas reabiertas o cerradas también. Hubo que conciliarlas a mano. Propuesta, sin excepción general y sin tocar
las herramientas de otros bloques:

1. **Procedimiento (sencillo y lo que más ayuda):**
   - **Antes** de ejecutar la preparación, iniciar sesión en las ventanas del dueño y del cajero. Las consultas de la pantalla de ingreso quedan antes del intervalo y la sesión de 12 h queda recién creada.
   - Al terminar, **cerrar directamente las ventanas** y luego ejecutar el verificador, sin cerrar sesión antes.
2. **Evidencia de las transiciones de sesión:**
   - El ejecutor agrega una segunda consulta de solo lectura de los logs HTTP, limitada a `POST /api/operativo/login` y `POST /api/operativo/logout`.
   - Sólo conserva fecha, método, ruta y código (también los 2xx), sin cuerpos, encabezados ni identidad.
3. **Clasificación automática acotada.** Un 401 se clasifica como «consulta de sesión esperada» sólo si se cumplen todas estas condiciones:
   - **(a)** Es `GET /api/operativo/me`, la única ruta admitida (lista cerrada).
   - **(b)** En todo el intervalo no hay **ningún** 401 en otra ruta protegida. Si lo hay, no se clasifica nada y todo pasa a revisión.
   - **(c)** Cumple una de dos condiciones. Puede ocurrir ≤ 60 s **antes** de un inicio de sesión exitoso, que es la pantalla de ingreso. O puede ocurrir ≤ 60 s **después** de un cierre de sesión exitoso, o después de la última escritura auditada.
   - **(d)** Hay a lo sumo dos por transición.
4. **Transparencia:**
   - Los 401 clasificados se listan en una tabla propia del informe, con la regla que cumplió cada uno; nunca se ocultan.
   - Cualquier 401 que no cumpla las condiciones sigue dejando LOGS en INCONCLUSA y se concilia por registro exacto, como hasta ahora.

## 7. Limitaciones previstas

- Los logs HTTP no identifican actor ni ventana. La atribución se apoya en auditoría y horarios: queda comprobado lo que dicen los registros y lo demás es hipótesis compatible.
- El permiso de catálogo vence por fecha (`catalogoHasta`). La revocación del mismo bloque se verifica como cambio auditado.
- La venta protegida demuestra el precio al inicio. La base no registra el momento en que cada producto entró al carrito.
