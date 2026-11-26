# Certificación manual — Bloque 4: Precios de venta y etiquetas · DEFINITIVO (preparado, no ejecutado)

Fecha: 2026-11-26 · Estado: **CERTIFICADO (CLOSED_TESTING_CERTIFIED)** — ejecución original `M11260155` (ZIP FALLIDO conservado, §11) + certificación complementaria C1–C4 APROBADA + C5 en CI (verificada por ChatGPT con GitHub) · ver §12.11.
Reemplaza a `CERTIFICACION_BLOQUE_4_PRECIOS_ETIQUETAS_PROPUESTA.md` (queda como antecedente).
Entorno: Railway TESTING (`testing-codex` = `327d6c73`), negocio QA `paola-vinal`. Production intacta. Sin commits, push,
migraciones ni despliegues. Sin pruebas funcionales locales ni de Claude. Sin dinero real (cobro QA ficticio en la caja QA).

## 1. Decisiones del operador aplicadas

1. Las dos unidades pendientes del pedido E5 del Bloque 3 generan las etiquetas de E4 y E6, mediante dos recepciones de 1 unidad.
2. Se hace una venta ficticia de $950 para certificar la protección del precio en una venta iniciada.
3. Todo el dinero se mueve sólo en «QA Caja A e31b». «Caja principal» y el turno del dueño no se tocan.
4. El cajero recibe un permiso temporal de catálogo con vencimiento al día siguiente, sólo con lo necesario: **«Precios de venta»**. La revocación deja los permisos y vencimientos exactamente como al empezar.
5. Se incluyen **Descartar** y **Activar sin etiqueta** (E8 y E9). Cada uno usa una etiqueta nueva; ninguna etiqueta ya resuelta se reutiliza.
6. El vencimiento de 30 minutos se certifica sin esperas, sin cambiar relojes ni fechas y sin modificar código (E10 y §9).
7. Antes de la preparación se inicia sesión como dueño y como cajero; al terminar se cierran las ventanas sin cerrar sesión.

## 2. Comportamiento vigente (revisado en `327d6c73`) y confirmación de lo pedido

Fuentes:
- `precios-venta-service`, `etiquetas-precio-service`, `inicio-venta-service`, `caja-venta-service` y `catalogo-empleado-service`;
- la Caja (`caja-tab.tsx`), la lista de etiquetas (`etiquetas-precio-lista.tsx`), la aprobación de recepciones (`owner-compras.tsx`) y los permisos (`permisos-catalogo.tsx`);
- `DECISIONS_AND_INVARIANTS.md`: SALE_PRICE_*, SHELF_LABEL_*, PRICE_ACTIVATIONS y SALE_START_*.

- **Catálogo:**
  - El dueño, o el cajero con permiso, cambia el precio **en el acto**.
  - Queda una activación `CATALOGO` en la misma transacción. Si había una etiqueta pendiente, queda `REEMPLAZADA_POR_CATALOGO`.
  - No crea etiquetas y no toca costo ni stock.
  - Auditorías: `producto.precio_cambiado` y `producto.variante_actualizada`.
- **Etiquetas:**
  - Sólo nacen al aprobar una recepción.
  - Propuesta = costo nuevo × precio base / costo anterior, al centavo; se conserva el recargo.
  - Mientras está pendiente se sigue cobrando el precio anterior.
  - El cajero sólo puede **confirmar**. **Activar sin etiqueta** y **Descartar** son exclusivos del dueño: además del 403 del servidor, una restricción SQL impide que un empleado las resuelva.
  - Cada etiqueta se resuelve una vez y tiene a lo sumo una activación.
- **Venta iniciada:**
  - Al agregar el primer producto, el servidor registra un inicio que vence en 30 minutos.
  - Al cobrar, vale el precio vigente al inicio.
  - El inicio es de un solo uso y queda ligado a la venta.
  - El renglón de la venta guarda el precio cobrado.
- **Resultados de referencia de ChatGPT: CONFIRMADOS** contra el código.
  - Stock 6 → 7, con dos recepciones de 1 unidad y una venta de 1.
  - Nuevas obligaciones de Alfa: 665,50 + 732,05 = **1.397,55**.
  - Una venta de $950 con un único cobro.
  - Precios finales: Producto Stock 1.100 · A 1.050 · Variante 1 1.150. Variante 2 intacta.
  - Caja principal intacta y permisos restaurados.
- **Ajustes al diseño de la propuesta, por cómo funciona la interfaz:**
  - **E3, intento sin permiso:** sin permiso vigente, la pantalla Productos del cajero sólo muestra «No tenés un permiso vigente…» y el servidor no recibe ningún intento. El rechazo **del servidor** se certifica después de revocar, sin recargar: 403 `CATALOGO_SIN_PERMISO`, no `PRECIO_SIN_PERMISO`. `PRECIO_SIN_PERMISO` no se alcanza desde la interfaz, porque sin el permiso de precios no se muestra el campo.
  - **Volver a confirmar una etiqueta ya resuelta** no se puede ejercer de forma confiable: la lista se actualiza al volver a la ventana. La unicidad se certifica con los registros (una sola activación por etiqueta y una sola resolución) y con el doble clic en «Etiqueta actualizada».

## 3. Datos exactos (estado al cierre del Bloque 3; se comprueban como precondición)

| Dato | Id | Estado inicial |
|---|---|---|
| «QA B2 Producto Stock M11250631» (simple, controla stock) | `cmwvqxbp10014k60amf8iyabx` | precio 900 · costo 605 · stock 6 |
| «QA B1 Producto A M11240504» (simple, sin stock) | `cmwvol4be0005k60aqmnhcn5l` | precio 1.000 · costo 726 |
| «QA B1 Producto B M11240504» · Variante 1 / Variante 2 | `cmwvol4ku0008k60accj1pq7i` · `…0009k60ari1izrpc` / `…000ak60axbuvrk5x` | base 1.000 · V1 1.100 (costo 786,50) · V2 1.200 (costo 700) |
| Pedido E5 del Bloque 3 (Alfa, N° 2) | `cmwwi9ubz0041k60acbc1xa7o` | abierto · Producto Stock × 4, 2 recibidas |
| Pedido E6 del Bloque 3 (Alfa, N° 3) | `cmwwil6g00057k60ap0wzua83` | abierto, **no se usa** (su anticipo de 1.000 sigue reservado) |
| Alfa / Beta | `cmwvonba6000gk60atvght1h3` / `cmwvong4e000jk60a0fl0euem` | Alfa: pendiente 210, anticipos 1.768,50 · Beta: sin deuda |
| Cajero QA «TEST_T44_R1D_CUENTA_4135EA7A» | `cmuq91zhp0008ka0ab4fqenuj` | área caja · sin permisos de catálogo (vencimiento vacío) ni de anticipos |
| «QA Caja A e31b» · turno del dueño «Caja principal» | — · `cmw2sjtoj002do40aqaq0i1hu` | caja QA sin turno · turno del dueño abierto (sólo lectura) |

Ningún producto QA tiene autorizaciones, etiquetas ni activaciones de precio. No se crean productos, proveedores, pedidos ni cajas.

## 4. Escenarios definitivos y resultados esperados

Orden de ejecución: **E0 → E1 … E6 → E8 → E9 → E10 → E7**. Los pasos exactos los genera la preparación en `INSTRUCCIONES-OPERADOR.md`.

### Principales (E1–E7)

| Id | Acción del operador | Resultado esperado (verificado por registros) |
|---|---|---|
| E0 | El cajero abre el turno QA con fondo **0** y deja abierta la venta **V0**: 1 Producto A a 1.000, en una pestaña propia, sin cobrar | Turno QA abierto por el cajero. Inicio V0 sin usar, con vencimiento a los 30 min |
| E1 | El dueño cambia el Producto Stock 900 → **950** en Inventario | Una activación `CATALOGO` del dueño, auditada. Costo 605 y stock 6 intactos. Ninguna etiqueta |
| E2 | El dueño cambia la Variante 1 1.100 → **1.150** | Una activación `CATALOGO` de la variante. Variante 2 (1.200), precio base y costos de B sin cambios |
| E3 | Permiso temporal del cajero. Sin permiso → mensaje sin acceso. El dueño habilita **sólo «Precios de venta»** hasta mañana. El cajero pone A 1.000 → **1.050**. La pestaña V0 sigue en 1.000. El dueño revoca y el cajero guarda **1.060** sin recargar | Un otorgamiento y una revocación auditados. Una activación `CATALOGO` del **cajero**, entre los dos, con `producto.precio_cambiado` a su nombre. 403 del servidor posterior a la revocación. Ninguna activación a 1.060. Permisos y vencimiento iguales a los originales |
| E4 | El cajero recibe 1 unidad del pedido E5 a **550** + IVA 21. El dueño aprueba y autoriza el precio «esperando la etiqueta» | Recepción 550 + 115,50 = **665,50** y obligación de Alfa 665,50 sin pagos. Autorización 950 → **1.045** (costo 605 → 665,50, recargo 57,02 %). Etiqueta L1 pendiente. El precio sigue en 950. Stock 6 → 7 |
| E5 | El cajero abre la venta V1 con 1 Producto Stock (**950**) y confirma L1 en otra pestaña con doble clic. Vuelve a V1 (sigue en 950) y cobra en efectivo. Luego agrega el producto otra vez: se ve **1.045**; lo quita sin cobrar | L1 `ETIQUETA_CONFIRMADA` por el cajero, con **una** activación 950 → 1.045. Secuencia inicio → confirmación → cobro, con el inicio usado una sola vez. **Una** venta de 950 en efectivo, renglón 950 × 1, **un** cobro y **una** operación `VENTA_COBRO` +950 en la cuenta de la caja QA. Stock 7 → 6 con un movimiento `VENTA`. Un inicio posterior sin usar (la vista a 1.045). El cajero no activa sin etiqueta ni descarta |
| E6 | El cajero recibe la última unidad del pedido E5 a **605** + IVA. El dueño la autoriza «esperando la etiqueta» (L2) y fija el catálogo en **1.100** | Recepción y obligación de **732,05**. Autorización 1.045 → **1.149,50** (costo 665,50 → 732,05). Una activación `CATALOGO` 1.045 → 1.100. L2 `REEMPLAZADA_POR_CATALOGO` en la misma transacción. **Ninguna activación de L2**; precio 1.100. Stock 6 → 7; último costo 732,05. El pedido E5 queda sin pendientes; su estado sigue `ABIERTA`, porque el sistema no lo cierra solo |
| E7 | Cierre del turno QA (contado **950**) y revisión del historial | Turno `CERRADO_DECLARADO` con esperado 950 = contado 950. Historial completo, sin duplicados ni pendientes. Ningún pago, egreso ni asignación. Turno del dueño intacto. Ventas anteriores del negocio sin cambios (huella) |

### Adicionales (E8–E10)

| Id | Acción del operador | Resultado esperado |
|---|---|---|
| E8 | El cajero hace una recepción **sin pedido** de **Beta**: A 1 × **660** y Variante 1 1 × **715**, IVA 21. El dueño aprueba autorizando los dos precios «esperando la etiqueta» y **descarta** la de la Variante 1 | Recepción 1.375 + 288,75 = **1.663,75** y obligación de Beta 1.663,75. Autorizaciones: A 1.050 → **1.155** (recargo 44,63 %) y V1 1.150 → **1.265** (46,22 %). L4 (V1) `DESCARTADA` por el dueño, auditada, sin activación: V1 sigue en 1.150. Últimos costos: A 798,60 y V1 865,15. Sin movimientos de stock (A y B no controlan stock) |
| E9 | El dueño **activa sin etiqueta** la de A (L3) | L3 `ACTIVADA_POR_DUENO`, auditada, con una activación `DUENO_SIN_ETIQUETA` 1.050 → **1.155** |
| E10 | Pasados **≥ 31 min** desde E0, el cajero vuelve a V0 sin recargar y después la vacía, sin cobrar | Aviso «La venta estuvo abierta más de 30 minutos…» y carrito con A a **1.155**. V0 empezó antes del cambio de E3, seguía vigente cuando ocurrió y nunca se cobró. Hay un inicio nuevo, sin usar, posterior a su vencimiento. Todos los inicios vencen a los 1.800 s |

### Resultados finales esperados

| Concepto | Sólo principales (E1–E7) | Final con adicionales |
|---|---|---|
| Producto Stock | precio **1.100** · costo 732,05 · stock **7** | igual |
| Producto A | **1.050** · costo 726 | **1.155** · costo 798,60 |
| Producto B | base 1.000 · V1 **1.150** · V2 **1.200** | base 1.000 · V1 **1.150** (costo 865,15) · V2 1.200 (costo 700) |
| Autorizaciones / etiquetas | 2 / 2 (L1 activada, L2 reemplazada) | 4 / 4 (+ L3 activada sin etiqueta, L4 descartada); 0 pendientes |
| Activaciones de precio | 5 | 6 |
| Alfa | 2 obligaciones nuevas **1.397,55**; pendiente **1.607,55**; anticipos 1.768,50 sin cambios | igual |
| Beta | sin cambios | 1 obligación de **1.663,75** sin pagos |
| Dinero | 1 venta de 950 en efectivo, 1 cobro y 1 operación en la caja QA; ningún pago ni egreso | igual |
| Turnos y permisos | Turno QA cerrado 950 = 950; Caja principal intacta; permisos del cajero originales | igual |

## 5. Procedimiento de autenticación (antes de la preparación)

1. Abrir dos ventanas de navegador separadas: una para el dueño en `/negocio` y otra para el cajero QA en `/operaciones/ingresar` → Mi panel. Iniciar sesión en las dos.
2. No hacer ninguna operación comercial.
3. Ejecutar la preparación. Primero pide escribir **SI** para confirmar que las dos sesiones están iniciadas; si no se confirma, no prepara nada. Recién después registra la línea base y la hora de inicio.
4. Durante las pruebas no cerrar sesión. Las pestañas nuevas del cajero (V0, V1, Etiquetas) usan la misma sesión.
5. Al terminar: completar `observaciones-operador.md`, **cerrar directamente las ventanas, sin cerrar sesión**, y ejecutar el verificador.

## 6. Caja QA y permisos

- **Caja QA:** el cajero abre el turno de «QA Caja A e31b».
  - Fondo declarado **0**, sin «Recibir el fondo del turno anterior»: así no se toca la salida de Caja del Bloque 3, que queda sin revisar.
  - El único dinero del bloque es el cobro de 950 de E5. Cierre con contado 950: esperado 0 + 950 = 950.
- **Permiso temporal:** el dueño va a Inventario → «Empleados que pueden cargar productos» → fila del cajero.
  - Marca **sólo «Precios de venta»**; «Vence» mañana a la misma hora; **Habilitar**.
  - Para precios no hace falta «Editar datos»: la pantalla del cajero envía sólo el precio.
  - **Revocar ahora** deja el vencimiento vacío y las seis casillas desmarcadas, exactamente como al empezar. El verificador compara los 14 campos de permisos.
- **Ediciones del dueño:** recargar Inventario antes de editar y cambiar sólo el precio. El formulario envía también el costo que muestra: con datos viejos podría reescribirlo, y el verificador lo detectaría como falla.

## 7. Herramientas (`%USERPROFILE%\deligo-dev-db\certificacion\b4-manual\`, adaptadas de `b3-manual`)

| Archivo | Función |
|---|---|
| `b4-manual-preparar.ps1` | Pide confirmar las sesiones, verifica el despliegue, registra la línea base, comprueba las precondiciones y genera las instrucciones |
| `b4-manual-verificar.ps1` | Toma el estado final y los logs, compara, genera el informe, revisa credenciales y arma el ZIP (repetible) |
| `testing-b4-manual.ps1` | Ejecutor de solo lectura, con las protecciones del B3: SQL con SHA-256 fijado, sesión `read-only`, comprobación del negocio QA, credenciales sólo en memoria |
| `b4-manual.sql` | SQL de solo lectura: productos, costos, stock, autorizaciones, etiquetas, activaciones, inicios, ventas, cobros, cuentas, recepciones, cajas, turnos, dinero, auditoría y permisos |
| `analizar-railway.mjs`, `esperado.mjs`, `instrucciones.mjs`, `comparar.mjs` | Resumen enmascarado de logs, importes esperados, instrucciones y comparación |

- **Ejecutor (`testing-b4-manual.ps1`):**
  - Agrega a la acción `logs` las solicitudes a `/api/operativo/login`, `/api/operativo/logout`, `/api/auth/login` y `/api/auth/logout`, con cualquier código.
  - De cada una conserva sólo fecha, método, ruta y código.
- **SQL (`b4-manual.sql`):**
  - De las ventas anteriores sólo conserva la cantidad, el total y una huella md5.
  - SHA-256: `f307e25b5616b2f241ba12f744b6cddbc30f45975f8790fbec991e7791a9659b`.
- **Verificación:**
  - Identifica cada registro esperado y sus relaciones: recepción → autorización → etiqueta → activación, e inicio → venta → renglón → cobro → operación → movimiento.
  - Controla la secuencia temporal. Por ejemplo: inicio < confirmación de L1 < cobro; otorgamiento < cambio del cajero < revocación < 403; V0 iniciado antes del cambio de E3 y vencido antes de E10.
  - Exige la cantidad exacta: 6 activaciones, 4 etiquetas, 3 recepciones, 3 obligaciones, 1 venta, 1 cobro, 1 operación y 3 movimientos de stock.
  - Exige la ausencia de efectos fuera de lo previsto: otros productos, pagos, egresos, devoluciones, cambios, correcciones, ventas anteriores, Caja principal y pedido E6.
- **Consultas de sesión `GET /api/operativo/me` con 401:**
  - Sólo se clasifican como esperadas si hay un inicio de sesión exitoso a ≤ 60 s después o un cierre exitoso a ≤ 60 s antes. Además, no debe haber ningún 401 en rutas protegidas y puede haber a lo sumo dos por transición.
  - **Nunca** se clasifican sólo por ocurrir después de la última escritura.
  - Siempre aparecen en una tabla propia del informe.
  - Sin evidencia suficiente, LOGS queda INCONCLUSA y se puede conciliar por registro exacto, como en el Bloque 3, con autorización del operador.
- **Controles hechos sin TESTING:**
  - El SQL corrió en la base local de desarrollo, en sesión de solo lectura con datos ficticios, sólo para comprobar la sintaxis.
  - Los cuatro `.ps1` pasan el analizador de PowerShell.
  - Simulaciones del comparador: recorrido correcto → APROBADO; activación del precio obsoleto → FALLIDO; 401 sin evidencia → INCOMPLETO.
  - Precondiciones con la línea base simulada: cumplidas.

## 8. Comandos del operador

Preparación, con las dos sesiones ya iniciadas:

```powershell
powershell -ExecutionPolicy Bypass -File "%USERPROFILE%\deligo-dev-db\certificacion\b4-manual\b4-manual-preparar.ps1"
```

Verificación, después de completar las observaciones y cerrar las ventanas sin cerrar sesión:

```powershell
powershell -ExecutionPolicy Bypass -File "%USERPROFILE%\deligo-dev-db\certificacion\b4-manual\b4-manual-verificar.ps1"
```

## 9. Vencimiento de la protección de 30 minutos: cobertura y propuesta

- **Cobertura automatizada existente: ninguna.**
  - En `327d6c73` no hay pruebas que ejerciten etiquetas, inicios de venta ni su vencimiento (`resolverEtiquetas`, `tomarInicioVentaEnTx`, `inicioVenta`).
  - Lo vigente es validación manual en desarrollo local (ROADMAP) y protecciones en SQL:
    - el plazo no puede superar 2 h (CHECK);
    - un trigger impide cambiar `iniciadaEn` o `expiraEn`;
    - el uso es único (índice sobre `ventaId`).
- **Comportamiento:**
  - El servidor fija `expiraEn = iniciadaEn + 30 min`.
  - La Caja consulta el inicio al volver a la pestaña y cada 60 s. Si está vencido, avisa, descarta el inicio y empieza otro con los precios actuales.
  - Si igual se cobrara con un inicio vencido, el servidor rechaza con 409 `INICIO_VENTA_VENCIDO` sin escribir.
- **Propuesta aplicada (E10):** usar el tiempo que ya insumen los escenarios.
  - La venta V0 se abre en E0 y se revisa al final; E0–E9 normalmente superan los 30 min. Sólo si no alcanzan se espera la diferencia.
  - El cambio de A de E3 ocurre con V0 vigente: la pestaña muestra 1.000 mientras el catálogo dice 1.050.
  - Al final se ve el aviso y el precio actual (1.155).
  - Los registros prueban el plazo exacto de 1.800 s, que V0 nunca se usó y el inicio nuevo posterior al vencimiento.
  - No se cambian relojes, fechas ni código.
- **Lo que no cubre:** el 409 del servidor al cobrar con un inicio vencido, porque la Caja lo evita antes.
  - Propuesta, registrada en el ROADMAP y **no autorizada**: una prueba de integración focalizada en la base efímera de CI, en una tarea técnica aparte. Un inicio con `expiraEn` pasado → 409 y ninguna escritura.
  - Mientras no exista, esa rama queda **certificada sólo por revisión de código**.

## 10. Limitaciones y discrepancias detectadas (sin cambiar comportamiento)

- **E3:** el rechazo previo al permiso es visual; el servidor no recibe ningún intento. El rechazo del servidor certificado es el posterior a la revocación (403 `CATALOGO_SIN_PERMISO`).
- **«Imposible activar L2»:**
  - Se prueba por el estado `REEMPLAZADA`, la ausencia de activaciones de L2 y la lista «Completadas» sin casilla.
  - La regla «activar exige que el precio vigente siga siendo el autorizado» está revisada en el código. No se fuerza un intento desde una pestaña vieja: la lista se actualiza sola.
- **Pedido E5:** sigue `ABIERTA` aunque no queden unidades pendientes; la vista lo muestra como completado. Es comportamiento vigente.
- **Ventas anteriores:** la huella se compara con el corte de cada consulta. La línea base corta unos 2 min antes del inicio y el final 30 s antes. Una venta en ese margen aparecería como diferencia, con falla segura.
- **Evidencia de sesión:** depende de que Railway acepte el filtro `@path:`. Si falla o viene incompleta, no se clasifica ningún 401: LOGS queda INCONCLUSA.
- **Atribución:** los logs HTTP no identifican actor ni ventana; la atribución se apoya en auditoría y horarios.
- **Efectos adicionales documentados de E8–E10:**
  - una deuda nueva de Beta de 1.663,75, la primera de Beta;
  - últimos costos de A (798,60) y de la Variante 1 (865,15);
  - el precio de A queda en 1.155;
  - dos etiquetas y dos autorizaciones más.
- **No se tocan:** la salida de Caja QA del anticipo E6 del Bloque 3 (sin revisar ni compensar), las mejoras UX acumuladas y Production.

## 11. Ejecución `M11260155` — resultados del operador (2026-11-26, versión corregida)

Inicio de las pruebas: 2026-11-26T01:55:32Z (TESTING `327d6c73`). Línea base original intacta. Observaciones registradas
en `observaciones-operador.md` sin convertir nada pendiente en aprobado. El formato del verificador admite sólo OK, FALLA o
PENDIENTE por escenario; lo incompleto o inconcluso figura como PENDIENTE, con el detalle por comprobación.

| Escenario | Registro | Detalle del operador |
|---|---|---|
| E0 | OK | Turno QA abierto; V0 iniciada |
| E1 | OK | Producto Stock modificado; costo y stock conservados |
| E2 | OK | Variante 1 modificada, Variante 2 intacta. **Bug visual:** el cuadro de variantes muestra el precio anterior hasta reabrirlo (ROADMAP) |
| E3 | PENDIENTE | Sin permiso, habilitación, revocación y rechazo posterior: OK. **3.3:** Producto A pasado a 1.050 por el **dueño**, no por el cajero. **3.4:** carrito V0 perdido al navegar en la misma pestaña; no se comprobó la protección |
| E4 | OK | Recepción, etiqueta pendiente, precio anterior conservado |
| E5 | PENDIENTE | Inicio, confirmación de etiqueta, cobro a 950, vista nueva a 1.045 sin cobrar y descuento de una unidad: OK. **5.3:** no se comprobaron las acciones vedadas al cajero |
| E6 | PENDIENTE | Recepción y etiqueta de 1.149,50: OK. Edición directa a 1.100 **sin completar**: la etiqueta seguía pendiente. 6.3 rectificado (no aprobado); 6.4 pendiente |
| E8 | OK | Recepción sin pedido de Beta, dos etiquetas, descarte de Variante 1 |
| E9 | OK | Activación sin etiqueta de Producto A |
| E10 | PENDIENTE | V0 reutilizada para recibir mercadería; vencimiento no observado |
| E7 | PENDIENTE | Cierre del turno QA, obligaciones y Caja principal: OK. Tres de cuatro etiquetas vistas. Precios de Producto Stock y base de B sin confirmar |

- **Lectura previa a la verificación (no es diagnóstico):**
  - Las desviaciones son de procedimiento; ninguna demuestra por sí sola una falla funcional.
  - Con este recorrido el verificador **debe** dar FALLIDO o INCOMPLETO. Por ejemplo, E3 exige que la activación de A sea del cajero, E6 exige L2 reemplazada y GENERAL exige 0 etiquetas pendientes.
  - Sus controles no se relajan.
- **Siguiente paso:**
  1. El operador ejecuta `b4-manual-verificar.ps1`, con las ventanas cerradas sin cerrar sesión, para obtener el estado real por SQL, auditoría y logs, y el ZIP (que se genera con cualquier resultado).
  2. Con ese ZIP se diagnostica y se propone el mínimo de pruebas complementarias. Si la etiqueta de 1.149,50 sigue pendiente y válida, se reutiliza para completar E6, sin nuevas recepciones ni etiquetas.

## 12. Certificación complementaria de `M11260155` (2026-11-26) — preparada, sin ejecutar

### 12.1 Resultado del ZIP original (se conserva sin cambios)

- **ZIP:** `B4-MANUAL-M11260155-20261126T040739Z-FALLIDO.zip`. SHA-256 `3b46b7bc76edfda52689624196a2874b7c5d057996926130ee817fc53d574795`, recalculado y coincidente.
- **Aprobados:** BASE, E1, E2, E4, E5, E8, E9, CUENTA, DINERO y DESPLIEGUE.
- **FALLIDOS:** E3 (A → 1.050 hecho por el dueño), E6 (L2 sin reemplazar) y GENERAL.
- **INCONCLUSOS:** E10, LOGS (el HTTP 400) y OPERADOR.
- **Desviaciones de procedimiento, sin falla funcional demostrada.**
- **Protección del original:** `b4-manual-preparar.ps1` y `b4-manual-verificar.ps1` se niegan a correr sobre `M11260155` mientras exista la carpeta complementaria. Así no se regenera la carpeta original.

### 12.2 Paquete complementario

- **Carpeta:** `deligo-certificaciones\B4-COMPLEMENTARIA-M11260155\`.
- **Herramientas:** `%USERPROFILE%\deligo-dev-db\certificacion\b4-complementaria\`.
  - Reutilizan el mismo `b4-manual.sql` aprobado (SHA `f307e25b…`).
  - Agregan `b4c-permisos.sql` (SHA `289f0808…`), de solo lectura. Lee el vencimiento y las seis casillas de cada otorgamiento o revocación auditados, la migración `20261121181000_catalogo_activacion_empleado` y la restricción `activaciones_precio_venta_origen_check`.
  - Agregan un modo de logs con bytes por solicitud: sólo fecha, método, ruta, código, bytes y duración.
- **Validación local:**
  - SQL nuevo contra `deligo_dev`: sólo sintaxis.
  - Parser de PowerShell y `node --check`.
  - Seis simulaciones del comparador con datos ficticios: recuperación correcta → apta para C3/C4; L2 pendiente → no apta; sin bytes → 400 INCONCLUSA; C3/C4 correctos → APROBADO; C3 hecho por el dueño → FALLIDO; sin inicio posterior al vencimiento → INCOMPLETO.

### 12.3 C1 y C2 (hechos por el operador después del ZIP original; no se repiten)

Declaración del operador: `recuperacion-C1-C2\declaracion-operador-C1-C2.md`. `b4c-preparar.ps1` compara el estado actual con el estado final del ZIP original y exige lo siguiente.

**Para C2:**
- La etiqueta `cmwwxltl4008ik60ayi5715sa` (1.045 → 1.149,50, PENDIENTE en el original) está REEMPLAZADA, con motivo REEMPLAZADA_POR_CATALOGO, resuelta por NEGOCIO y en el mismo instante que la activación.
- Hay una única activación nueva: CATALOGO 1.045 → 1.100 del dueño, posterior al ZIP original.
- Hay una auditoría `producto.precio_cambiado` del dueño.
- No hay ninguna activación de esa etiqueta ni a 1.149,50 en todo el historial.
- El costo sigue en 732,05 y el stock en 7, sin movimientos.
- No hay autorizaciones ni etiquetas nuevas.

**Para C1:**
- Se apoya en la declaración del operador. El sistema no audita lecturas.
- Respaldo en registros: el cajero no confirmó la etiqueta ni registró acciones de etiquetas.
- No es una prueba directa de la autorización del servidor.

**Estado esperado completo:**
- Stock: 1.100 / 732,05 / 7.
- Producto A: 1.155 / 798,60.
- Producto B base: 1.000 / 600.
- Variante 1: 1.150 / 865,15. Variante 2: 1.200 / 700.
- Etiquetas: L1 confirmada por el cajero, L2 reemplazada, L3 activada sin etiqueta y L4 descartada, con cero pendientes.
- Permisos originales y único turno abierto: el del dueño.

**Sin efectos en el lapso posterior al ZIP original:**
- Sin inicios de venta, ventas, cobros, operaciones, movimientos financieros, recepciones, pagos ni cuentas.
- Las ventas anteriores son las del original más la venta de E5 (61 / 184.260).
- La Caja principal es idéntica.
- La auditoría sólo registra C2.

**Bloqueo:** si algo de esto falla, el comando no habilita C3/C4.

### 12.4 Incidencia HTTP 400 (02:17:13.911Z, PUT `/api/negocio/empleados/permisos-catalogo`)

**Revisión de código en `327d6c73`:**
- `guardarPermisosCatalogo` devuelve 400 sólo por `EMPLEADO_REQUERIDO` o `VENCIMIENTO_INVALIDO`. Este último cubre una fecha no interpretable, una fecha no futura o una fecha a más de 366 días.
- El 400 se devuelve antes de la transacción: no escribe ni audita.
- La pantalla del dueño siempre envía el empleado y convierte «Vence» con `toISOString()`. Con un valor inválido falla en el navegador y no envía nada.

**Diagnóstico, que hace `b4c-preparar.ps1`:**
- Vuelve a consultar los logs del intervalo original con los bytes de cada respuesta.
- Calibra la sobrecarga con tres respuestas conocidas del mismo intervalo: el otorgamiento 200, la revocación 200 y el 403 del cajero.
- Identifica la causa sólo si la sobrecarga es idéntica y coincide un único mensaje. «Fecha de vencimiento inválida.» y «El plazo máximo es de un año.» miden lo mismo (84 B): ese caso queda INCONCLUSA.
- Comprueba además que en ese instante no hubo auditoría y que el otorgamiento de las 02:17:24.916 fue válido (sólo «Precios de venta»).
- No se atribuye ninguna causa sin esa evidencia.

**Aclaración del operador (2026-11-26):**
- Registrada como evidencia complementaria en `recuperacion-C1-C2\declaracion-operador-HTTP400.md`.
- El operador declara que en la primera habilitación eligió por error una fecha y hora del mismo día, y que después lo corrigió al día siguiente.
- Es compatible con la regla «el vencimiento tiene que ser futuro» y con el otorgamiento auditado 11 s después.

**Conciliación con registro exacto:**
- Alcance: sólo `2026-11-26T02:17:13.911925697Z`, PUT `/api/negocio/empleados/permisos-catalogo`, 400. Ningún otro rechazo queda conciliado.
- La hace `b4c-preparar.ps1`, y sólo si todo esto es compatible:
  - hay un único 400 en el log original;
  - en ese instante no hubo auditoría ni cambio de permisos;
  - el otorgamiento posterior fue válido: sólo precios, con vencimiento en el día siguiente (hora local UTC−3);
  - el tamaño de la respuesta, si se puede medir, coincide con «tiene que ser futuro».
- Un tamaño de otro mensaje (por ejemplo, 84 B) contradice la declaración y deja el bloque FALLIDA.
- Sin tamaño medible, alcanzan la declaración y los demás registros.

**Límites y evidencia original:**
- El cuerpo exacto de la respuesta no está disponible: los logs sólo guardan fecha, método, ruta, código y tamaños.
- El ZIP original y su LOGS INCONCLUSA no se modifican.
- Simulación con datos ficticios:
  - declaración sin tamaño: CONCILIADO;
  - declaración con tamaño de 84 B: FALLIDA;
  - sin declaración y sin tamaño: INCONCLUSA.

### 12.5 C3 y C4 (instrucciones definitivas: `c3-c4\INSTRUCCIONES-C3-C4.md`, generadas por `instrucciones-c.mjs`)

Revisadas contra `327d6c73`:
- **Sin turno:** la sección «Ventas» del cajero se muestra sin turno, y el carrito y `POST …/ventas/inicio` no lo exigen. No se cobra, así que no hace falta abrir turno; sólo se abre si la Caja no deja agregar el producto, con QA Caja A e31b, fondo 0 y cierre en 0.
- **Formulario del cajero:** envía sólo los campos cambiados que permite su permiso, así que «Precios de venta» basta.
- **Etiquetas pendientes:** con una pendiente en A, la edición sería 409; no hay ninguna.
- **Actor de la activación:** la activación CATALOGO a nombre del EMPLEADO requiere la migración `20261121181000`; la preparación comprueba que esté aplicada y vigente.
- **Protección:** la da `preciosAlInicio`, que toma el precio anterior de la primera activación posterior al inicio.
- **Vencimiento:** al volver a V0-C, la consulta del inicio devuelve `vencido`. La Caja avisa «La venta estuvo abierta más de 30 minutos: se actualizaron los precios del carrito.» y crea un inicio nuevo con el precio vigente.
- **Pestaña visible:** si V0-C quedó visible, el refresco de 60 s puede hacerlo solo.

**Secuencia:**
1. V0-C del cajero con A a 1.155 (anotar la hora).
2. El dueño habilita sólo «Precios de venta» con el botón «7 días».
3. El cajero cambia A de 1.155 a 1.160 desde otra pestaña, en Productos.
4. V0-C sigue mostrando 1.155.
5. El dueño toca «Revocar ahora».
6. Esperar 31 minutos o más.
7. En V0-C aparece el aviso y el precio pasa a 1.160.
8. Quitar el producto sin cobrar.
9. El dueño restaura 1.155 recargando antes Inventario.
10. Cerrar el turno QA en 0, sólo si se abrió.

**El verificador exige:**
- Un otorgamiento (sólo precios, vencimiento válido) y una revocación que restaura exactamente los permisos.
- La activación 1.155 → 1.160 del cajero entre ambos, auditada a su nombre.
- V0-C (1.800 s) anterior al cambio y vigente cuando ocurrió, nunca cobrada.
- Un inicio nuevo después del vencimiento y antes de la restauración; si falta, el resultado es INCONCLUSA.
- La restauración 1.160 → 1.155 del dueño, después de la revocación y del vencimiento.
- Exactamente dos activaciones nuevas, con las históricas intactas.
- Cero ventas, cobros, movimientos financieros, recepciones, etiquetas y movimientos de stock.
- La Caja principal y los permisos idénticos.
- La auditoría sin acciones imprevistas.
- Los logs sin rechazos nuevos.
- Observaciones C3 y C4 en OK.

### 12.6 C5 — rechazo del servidor ante un inicio vencido (propuesta técnica, no implementada ni ejecutada)

**Forma de la prueba:**
- Un archivo nuevo de prueba, `src/lib/f10-c2c-inicio-vencido.integration.test.ts`.
- Usa `bun:test` y las mismas guardas que `f10-c2a-recepciones.integration.test.ts` (`DELIGO_TEST_DATABASE_URL` = `DATABASE_URL`, `DELIGO_ENVIRONMENT=TESTING`, `DELIGO_EPHEMERAL_TEST_DB=1`).
- Corre sólo en el PostgreSQL 16 efímero de GitHub Actions.

**Datos sintéticos:**
- Un negocio genérico, un cajero del área caja con sesión operativa real, y un producto con control de stock (3 unidades).
- El inicio vencido es una fila **creada por la prueba** con `iniciadaEn = ahora − 31 min` y `expiraEn = ahora − 1 min`. La restricción de plazo se cumple, y el trigger sólo protege las actualizaciones, no la inserción.
- No se cambian relojes, no se modifican registros existentes y no se toca código funcional.

**Casos:**
1. `POST /api/operativo/caja/[slug]/ventas` con `inicioVentaId` vencido e `Idempotency-Key` devuelve 409 `INICIO_VENTA_VENCIDO`.
   - No se crea venta, ni renglones, ni cobros, ni operaciones o movimientos financieros, ni movimientos de inventario.
   - El stock sigue en 3, el inicio sigue sin usar (`ventaId` y `usadaEn` nulos) y no hay auditoría `venta.creada`.
2. Control: con un inicio vigente creado por la ruta real, la misma venta se registra y consume el inicio. Así se prueba que el 409 lo causa el vencimiento.

**Opcionales:** la misma prueba para el dueño y un inicio ya usado → 409.

**Ejecución:**
- En una rama técnica creada desde `327d6c73`, agregada al workflow de CI. No se despliega.
- Requiere autorización expresa de commit y push.
- No se certifica sólo con revisión de código ni con el aviso de la Caja.

### 12.7 Comandos del operador

1. Iniciar sesión como dueño y como cajero. Después:
   ```powershell
   powershell -ExecutionPolicy Bypass -File "%USERPROFILE%\deligo-dev-db\certificacion\b4-complementaria\b4c-preparar.ps1"
   ```
   Recupera C1/C2, diagnostica el 400 y, si todo está respaldado, registra la línea base y muestra las instrucciones de C3/C4.
2. Hacer C3/C4, completar `c3-c4\observaciones-operador.md` y cerrar las ventanas sin cerrar sesión. Después:
   ```powershell
   powershell -ExecutionPolicy Bypass -File "%USERPROFILE%\deligo-dev-db\certificacion\b4-complementaria\b4c-verificar.ps1"
   ```
   Genera el ZIP `B4-COMPLEMENTARIA-M11260155-<marca>-<estado>.zip` con cualquier resultado.

**Certificación definitiva:** debe integrar la evidencia válida del original, C1/C2 recuperados, C3/C4, C5 y la resolución del 400.

### 12.8 Ejecución complementaria (2026-11-26) — preparación 9/9, C3/C4 manuales OK; falta `b4c-verificar.ps1`

- **Preparación (`b4c-preparar.ps1`, inicio de C3/C4 a las 04:40:21.876Z):** los nueve controles salieron APROBADOS: ORIGINAL, C1, C2, ESTADO, SIN_EFECTOS, PRECONDICION_C3, LOGS_LAPSO, DESPLIEGUE y HTTP400. Corrió con la versión del comparador anterior a la regla de conciliación del 400.
- **Tamaño de la respuesta del 400:** el log registra 130 B y la única coincidencia es «El vencimiento tiene que ser futuro…». Las tres respuestas de calibración coinciden byte a byte con su cuerpo (sobrecarga 0). Esto concuerda con la declaración del operador, que llegó después.
- **Conciliación del 400:**
  - `b4c-verificar.ps1` la reevalúa **sin conexión** (modo `conciliacion400`) en `CONCILIACION-HTTP-400.md`.
  - No reescribe ni `DIAGNOSTICO-HTTP-400.md` ni `recuperacion.json`.
  - La vista previa sobre una copia de la evidencia real da APROBADA: único 400, sin auditoría, otorgamiento válido con vencimiento al día siguiente (hora local) y tamaño compatible.
- **Operador (registrado en `c3-c4\observaciones-operador.md`):** C3 = OK y C4 = OK, 9/9.
  - V0-C a las 01:42 del 26/11, hora de Argentina (≈ 04:42Z).
  - $1.155 → $1.160 desde la cuenta del cajero.
  - V0-C conservó $1.155 y, tras el vencimiento, pasó al precio vigente.
  - Carrito vaciado sin cobrar; restauración a $1.155 por el dueño.
  - **No abrió ningún turno de Caja.**
- **Verificador ajustado, sin relajar controles:**
  - Exige **cero** turnos nuevos o movidos y cero cuentas nuevas (antes admitía un turno QA en 0). La auditoría de turnos deja de estar permitida.
  - Comprueba que la recuperación sigue intacta: su SQL es idéntico a la línea base de C3/C4, sus bloques fueron aprobados y se registran las huellas de sus archivos.
  - Incluye en el estado global la conciliación del 400.
  - Explicita la distinción **comprobación visual vs. registros persistidos**:
    - lo visual: $1.155 conservado y $1.160 tras el vencimiento, que es observación del operador porque el precio mostrado no se guarda;
    - lo registrado: la secuencia de inicios y activaciones.
- **Validación local:** `node --check`, parser de PowerShell y once simulaciones con datos ficticios. Un turno abierto y cerrado da FALLIDO; el resto de los casos, como antes.
- **C5:** enfoque aceptado; espera autorización expresa de commit y push.

### 12.9 ZIP complementario INCOMPLETO (auditado) y conciliación del inicio adicional

**El ZIP y su auditoría:**
- ZIP: `B4-COMPLEMENTARIA-M11260155-20261126T052405Z-INCOMPLETO.zip`, SHA-256 `1e263cce…6236`. Lo auditó ChatGPT y se conserva sin cambios.
- Único bloque inconcluso: C4, por un tercer inicio de venta del cajero.
- Todo lo demás quedó aprobado: C1, C2, C3, la restauración, los permisos, la conciliación del 400, la integridad financiera y comercial, el despliegue y 9/9 del operador.

**Código vigente (`caja-tab.tsx`, 327d6c73):**
- Un inicio se crea sólo cuando el carrito de una pestaña pasa de vacío a tener un producto y la pestaña no tiene inicio.
- Hay un único punto de creación: el POST `…/ventas/inicio`, protegido contra creaciones paralelas.
- La pestaña descarta su inicio cuando el carrito queda vacío (sin cobro pendiente), cuando el servidor lo informa vencido o usado, o ante un 409 `INICIO_VENTA_VENCIDO` al cobrar.
- El carrito no se guarda al recargar ni al navegar.

**Acciones que crean un inicio nuevo:**
- agregar un producto después de vaciar el carrito;
- volver a una venta vencida con productos en el carrito;
- usar otra pestaña o ventana, porque cada una tiene su propio almacenamiento;
- recargar o navegar y volver a agregar;
- excepcionalmente, un POST que se registró en el servidor pero cuya respuesta no llegó.

**Diseño:**
- Varios inicios independientes y sin usar están **permitidos por diseño**. No hay unicidad por persona: sólo `ventaId` único (uso único), un plazo de 30 minutos o menos fijado por el servidor (CHECK de 2 h como máximo) y el trigger que impide cambiar las fechas.
- Un inicio descartado no protege nada por sí solo: sólo cuenta si se presenta al cobrar, dentro de su plazo.
- No se encontró ninguna violación de las invariantes de protección de precios.

**Declaración del operador:**
- Agregó primero un producto equivocado, lo quitó y después agregó el Producto A.
- Registrada en `c3-c4\declaracion-operador-inicio-adicional.md`.
- Coincide con el código y con los registros: los inicios se crearon a las 04:42:13.646 y a las 04:42:50.464, 37 s de diferencia.

**Cuál es el inicio adicional:**
- Según el código y la declaración, el inicio descartado es el **primero**, `cmwx2fzf3009qk60ahth5cnak`.
- V0-C, el que estaba en la pestaña cuando cambió el precio a las 04:44:05.090, es el **segundo**, `cmwx2grtt009sk60ayomhurv5`.
- La auditoría de ChatGPT había señalado el segundo como adicional. Para la prueba da igual: los dos son anteriores al cambio y estaban vigentes cuando ocurrió.
- El tercero (05:13:32.850) es posterior al vencimiento de ambos, que fue a las 05:12:50.464 como máximo.

**Conciliación por registro exacto (comparador `c34`):**
- Sólo concilia el id declarado y exige:
  - mismo negocio y cajero;
  - creado antes de V0-C, del otorgamiento y del cambio;
  - 1.800 s;
  - nunca usado, sin venta ni cobro;
  - sin efectos financieros, comerciales ni de stock;
  - el inicio posterior es posterior al vencimiento de ambos.
- V0-C pasa a ser el único otro inicio previo al cambio. Si hay más, falla.
- Cualquier otro inicio extra sigue sin conciliar.
- **Evidencia de logs (nueva, de solo lectura):** `b4c-verificar.ps1` consulta además los POST de `…/ventas/inicio` y los GET `…/ventas/inicio/<id>` de los inicios del cajero, con fecha, método, ruta, código y bytes.
  - Si el inicio adicional se sigue consultando después de crearse V0-C, había otra pestaña: contradice la declaración y el resultado es FALLIDA.
  - Sin logs, la conciliación se apoya en la declaración, el código y los registros.
- **Los logs existentes alrededor de las 04:42:50** no sirven para esto: el ZIP sólo guardó rechazos (≥ 400), sesión y las rutas de permisos.

**Validación local:**
- Sobre una **copia** de la evidencia real (sin consultas):
  - sin declaración, el resultado reproduce el INCOMPLETO;
  - con la declaración, C4 y el paquete quedan APROBADOS.
- Variantes ficticias:
  - logs compatibles → APROBADO;
  - consulta posterior del adicional → FALLIDO;
  - declarar el id equivocado → FALLIDO.

**`http.total4xx = 116 = http.lineas`:**
- No es un error del analizador. La consulta HTTP ya viene filtrada a respuestas de 400 o más; sin 5xx, cada línea es una respuesta 400–499.
- `total4xx` cuenta todas las del intervalo, relacionadas o no. El informe sólo listaba las relacionadas (ninguna), así que las 116 son 4xx de rutas no relacionadas.
- Lo que faltaba era un resumen de esas rutas; no se suponen errores funcionales.
- Desde ahora, `logs-http` agrega `total4xxNoRelacionados` y `otros4xxAgrupados` (por código, método y ruta sin identificadores), y el bloque LOGS los muestra como dato informativo que no bloquea.
- La nueva verificación mostrará qué rutas son.

**C5 — plan exacto (pendiente de autorización de commit y push):**
- **Lugar:** un worktree aparte desde `327d6c73`, con la rama técnica `codex/b4-c5-inicio-vencido` (`git worktree add ..\deligo-b4-c5 -b codex/b4-c5-inicio-vencido 327d6c73`). No se toca la rama actual.
- **Commit:** un único commit con **dos archivos nuevos**:
  - `src/lib/f10-c2c-inicio-vencido.integration.test.ts`: `bun:test`, guardas de base efímera y `DELIGO_ENVIRONMENT=TESTING`, datos sintéticos (negocio, cajero con sesión operativa real, producto con stock 3).
    - Caso 1: un inicio vencido creado por la prueba (`iniciadaEn` = ahora − 31 min, `expiraEn` = ahora − 1 min). El POST de venta del cajero con `Idempotency-Key` devuelve 409 `INICIO_VENTA_VENCIDO`, con cero ventas, renglones, cobros, operaciones, movimientos financieros, movimientos de inventario y auditoría `venta.creada`. El stock sigue en 3 y el inicio sin usar.
    - Caso 2, control: un inicio vigente creado por la ruta real hace que la venta se registre y consuma el inicio.
  - `.github/workflows/b4-c5-inicio-vencido.yml`: se dispara sólo con push a esa rama. Usa el mismo servicio `postgres:16` y las mismas variables que `f10-b2-2-e-testing.yml`. Pasos: `bun install --frozen-lockfile`, `prisma validate/generate/migrate deploy`, typecheck limitado al archivo nuevo y `bun test` de ese único archivo.
- **Sin cambios de código funcional, sin despliegue** (Railway TESTING despliega sólo desde `testing-codex`) **y sin merge.**
- **Resultado:** se registran el id de la ejecución de CI y su resultado.

### 12.10 Paquete complementario APROBADO y ejecución de C5 (2026-11-26)

**Paquete complementario C1–C4: APROBADO.**
- ZIP `B4-COMPLEMENTARIA-M11260155-20261126T053337Z-APROBADO.zip`, SHA-256 `5279a313eb47ec76138aa3e0eb8ebc789430665f32c8671b6f854192e4b84b63`, auditado por ChatGPT.
- 28 archivos con CRC correcto.
- 9/9 controles de recuperación, 10/10 internos de C3/C4, conciliación del 400 y 9/9 manuales.
- La conciliación del inicio adicional quedó aceptada con logs: 3 POST de inicio, 1 GET del inicio descartado, 19 GET de V0-C, 1 GET del inicio posterior y ninguna consulta del descartado después de crearse V0-C.
- Se conservan los ZIP FALLIDO (`3b46b7bc…`), INCOMPLETO (`1e263cce…`) y APROBADO.
- El ZIP original no está dentro del complementario: su conservación se respalda con las huellas registradas.

**C5, autorizado por el operador (sólo esta rama y estos dos archivos):**
- **Carpeta y rama:** worktree `C:\Leo Campos\Trabajo\deligo-b4-c5`, rama `codex/b4-c5-inicio-vencido`, base `327d6c739a55e2f6b5da89f1ec125a24013eb345`.
- **Commit:** `3c498c24433590dc606cf2a3e808fe38df6c18c6`, con dos archivos nuevos (228 inserciones): `src/lib/f10-c2c-inicio-vencido.integration.test.ts` y `.github/workflows/b4-c5-inicio-vencido.yml`.
  - Sin código funcional, sin migraciones y sin cambios en el workflow general.
  - `git diff --cached --check` OK.
- **Triggers revisados:**
  - `f10-b2-2-e-testing.yml` sólo corre en sus ramas listadas, que no incluyen la nueva.
  - El workflow nuevo corre sólo en `codex/b4-c5-inicio-vencido`.
  - Ninguno de los dos tiene un paso de despliegue; Railway TESTING despliega sólo desde `testing-codex`.
  - Push sólo de la rama técnica, sin force.
- **CI:** run [45763041157](https://github.com/LeoCampos2504/DeliGO/actions/runs/45763041157), job 139717297407, **success**.
  - Pasos: install, `prisma validate`/`generate`/`migrate deploy`, typecheck de la suite y suite C5, todos en success.
  - Única anotación: el aviso de deprecación de Node 20 en `actions/checkout@v4`.
  - Fue la única ejecución en la rama.
- **Pendiente de evidencia:** el log del paso de la suite necesita una sesión de GitHub, porque la API devuelve 403 y la página pide iniciar sesión.
  - El paso duró menos de 1 s según las marcas de tiempo.
  - Sin el log no se confirma que los dos casos se hayan **ejecutado** y no saltado: con `DELIGO_EPHEMERAL_TEST_DB=1` no deberían saltarse, pero eso no se da por probado.
  - **C5 no se declara aprobada hasta leer el log.**

### 12.11 CIERRE DEFINITIVO — Bloque 4 CERTIFICADO (2026-11-26)

**C5, verificada por ChatGPT directamente en GitHub (conector):**
- Run 45763041157, job 139717297407, completado con success. Commit `3c498c24433590dc606cf2a3e808fe38df6c18c6` sobre `327d6c73`.
- Un único commit, con dos archivos nuevos y 228 inserciones, cero eliminaciones. Sin código funcional ni migraciones.
- Log de la suite: **2 pass, 0 fail, 41 `expect()`**. Los casos se ejecutaron: el log pendiente de §12.10 quedó leído.
- **Caso negativo:**
  - 409 `INICIO_VENTA_VENCIDO`;
  - ninguna venta, renglón, cobro, operación ni movimiento financiero o de stock;
  - cuentas, turnos y auditoría sin cambios, stock en 3;
  - inicio sin usar, con sus fechas.
- **Control positivo:**
  - 201, un cobro, una operación, un movimiento financiero y uno de stock (3 → 2);
  - auditoría con el actor correcto e inicio ligado a la venta;
  - el replay da 200 con la misma venta sin duplicar, y reusar el inicio da 409 sin efectos.
- **Ramas remotas:** `main` en `42ca5005`, `testing-codex` en `327d6c73` y `codex/b4-c5-inicio-vencido` en `3c498c24`. El workflow de C5 no tiene pasos de despliegue. ChatGPT no consultó Railway en esa comprobación.

**La certificación integra:**
1. La evidencia válida de la ejecución original `M11260155`.
2. El ZIP FALLIDO original conservado: `B4-MANUAL-M11260155-20261126T040739Z-FALLIDO.zip`, `3b46b7bc…4795`.
3. La certificación complementaria C1–C4 APROBADA: `B4-COMPLEMENTARIA-M11260155-20261126T053337Z-APROBADO.zip`, SHA-256 `5279a313eb47ec76138aa3e0eb8ebc789430665f32c8671b6f854192e4b84b63`. El ZIP INCOMPLETO `1e263cce…6236` también se conserva.
4. La conciliación documentada del HTTP 400.
5. La conciliación documentada del inicio adicional `cmwx2fzf3009qk60ahth5cnak`.
6. C5 verificada en GitHub Actions.

Los resultados de los ZIP FALLIDO e INCOMPLETO no se modifican retrospectivamente. No se repite ninguna prueba del Bloque 4.

**Observaciones técnicas antes de Production (registradas en el ROADMAP; ninguna es una falla del Bloque 4):**
- El workflow de C5 informó «C5 suite typechecks clean (32 pre-existing diagnostics elsewhere)». Hay que revisar los 32 diagnósticos de TypeScript, confirmar que son preexistentes y evaluar su relevancia, sin suponer que todos son inocuos.
- Hay que incorporar la prueba C5 a la cobertura permanente con la siguiente tanda autorizada de cambios, sin un despliegue dedicado y sin merge ni cherry-pick por ahora.
- La ejecución focalizada no reemplaza la batería completa de CI exigida antes de Production.
- Siguen pendientes la revisión de los 401 (`/api/notificaciones`, `/api/destacado-solicitud`), el bug visual del cuadro de variantes y las mejoras de UX acumuladas.
