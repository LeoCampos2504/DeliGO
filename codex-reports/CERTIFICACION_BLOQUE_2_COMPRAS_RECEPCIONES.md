# Certificación manual — Bloque 2: Compras y recepciones de mercadería · DEFINITIVO (preparado, no ejecutado)

Fecha: 2026-11-25 · Estado: **LISTO PARA QUE EL OPERADOR EJECUTE LA PREPARACIÓN** (autorizado por el operador tras
certificar el Bloque 1). Reemplaza a la propuesta `CERTIFICACION_BLOQUE_2_COMPRAS_RECEPCIONES_PROPUESTA.md` (se conserva
como antecedente).
Entorno: Railway TESTING (`testing-codex` = `327d6c73`), negocio QA `paola-vinal`. Production intacta. Sin commits, push,
migraciones ni despliegues. Sin pruebas funcionales locales ni de Claude.

## 1. Decisiones del operador y revisión de reglas vigentes

| Tema | Decisión / regla vigente (código `327d6c73` + diseño F10-C2/F5) |
|---|---|
| Datos QA | Se reutilizan Alfa, Beta, Producto A y Producto B del Bloque 1; se crea **un** producto nuevo con control de stock. |
| Cierre con faltante | Incluido (B2-E4). |
| **Turno de Caja** | **Regla vigente = preferencia del operador; no hay que cambiar nada.** Crear, guardar, editar y enviar recepciones (`/api/operativo/caja/[slug]/recepciones*`) sólo exige sesión operativa del área caja (`resolveOperativoAreaForSlug(...,"caja")`); ninguna ruta de recepción verifica turno. El turno propio sólo se exige para **pagar en efectivo** (pago al recibir D-7 v2 y anticipo E3: `TURNO_REQUERIDO`), porque ese dinero sale por F10-C1. La aprobación del dueño no mueve dinero (D-7). |
| Costos que ve el cajero | Precisión sobre la propuesta: el cajero **carga** el «Costo unitario sin IVA» de la factura en cada renglón; **no ve** costos acordados del pedido, último costo, saldo ni deuda del proveedor (lecturas `sinCostos`). |
| Precios de venta | La aprobación sólo cambia precios que el dueño marque (ninguno viene marcado). En este bloque no se marca ninguno. |

## 2. Datos exactos

| Dato | Id / valor |
|---|---|
| Negocio QA | `paola-vinal` (`cmukd0e8i000cmt0aizcmins4`) |
| Proveedor Alfa | «QA B1 Proveedor Alfa M11240504» `cmwvonba6000gk60atvght1h3` |
| Proveedor Beta | «QA B1 Proveedor Beta M11240504» `cmwvong4e000jk60a0fl0euem` |
| Producto A | «QA B1 Producto A M11240504» `cmwvol4be0005k60aqmnhcn5l` — precio 1000, costo 600, sin control de stock |
| Producto B | «QA B1 Producto B M11240504» `cmwvol4ku0008k60accj1pq7i` — Variante 1 (1100/650) y Variante 2 (1200/700), sin control de stock |
| **Nuevo** | «QA B2 Producto Stock `<etiqueta>`» — precio 900, costo 500, **control de stock, stock 0**, sin variantes ni proveedores (lo crea la preparación) |
| Cajero QA | `cmuq91zhp0008ka0ab4fqenuj` («TEST_T44_R1D_CUENTA_4135EA7A») |

Pedido (B2-E1, Alfa, costos acordados sin IVA): A × 2 a 600 · B Variante 1 × 3 a 650 · Stock × 5 a 500.
Recepción del cajero (B2-E2): A 2/2 a 600 · B V1 3/3 a 650 · Stock llegó 5, aceptado 4, rechazado 1 «Dañado», a 500 · IVA 21 % en
todos los renglones; sin descuentos, percepciones, cargos ni comprobante.
Recepción sin pedido (B2-E5, Beta): A × 1 a 600 → devuelta → corregida a 610 → rechazada.

## 3. Escenarios y resultados esperados

Valores calculados con la fórmula vigente (`src/lib/compras-calculo.ts`): neto = aceptada × costo; IVA = round2(neto × 21 %);
costo de inventario = neto + IVA **sólo** si el negocio tiene `IMPUESTOS_INTEGRAN_COSTO` (valor por defecto); deuda = Σ(neto + IVA).
La preparación lee el tratamiento configurado (línea base) y las instrucciones muestran los números exactos.

| Id | Escenario (operador) | Resultado esperado |
|---|---|---|
| B2-E1 | Dueño crea el pedido a Alfa (3 renglones) | Pedido ABIERTO, 3 renglones, nada recibido; sin stock, costo ni deuda. Auditoría `compra.creada`. |
| B2-E2 | Cajero, **sin turno abierto**: recibe el pedido, guarda borrador, lo retoma y lo envía | Recepción `PENDIENTE_APROBACION` preparada por el cajero, ligada al pedido; renglones con recibido/aceptado/rechazado exactos (sólo Stock con rechazo `DANADO`); el cajero no ve costos acordados, último costo, saldo ni deuda. Sin stock ni deuda todavía. |
| B2-E3 | Dueño aprueba (doble clic) y en una **segunda pestaña** abierta antes intenta aprobar de nuevo | Una sola aprobación (1 evento `APROBACION`, 1 `recepcion.aprobada`); la segunda pestaña recibe 409 («ya fue aprobada» / «cambió mientras la mirabas»). Neto **5.150,00**, IVA **1.081,50**, deuda **6.231,50**. **Un** movimiento `RECEPCION` +4 del Producto Stock (0 → 4); ninguno para A ni B. Último costo (costos vigentes y ficha): con impuestos que integran costo A **726,0000**, B V1 **786,5000**, Stock **605,0000** (con impuestos recuperables: 600 / 650 / 500). Producto B general y Variante 2 sin cambio de costo. Precios de venta sin cambios. **Una** obligación `RECEPCION` de Alfa por 6.231,50, vigente. Alfa suma como «productos que entrega» Stock (general) y B Variante 1 (específica). |
| B2-E4 | Dueño cierra el pedido con pendientes, motivo «El proveedor no reemplazará la mercadería dañada» | Pedido `CERRADA_CON_FALTANTE` (faltante 1 Stock), evento `CIERRE_COMPRA` y `compra.cerrada` del dueño; deja de figurar en «Pedidos por recibir» del cajero. |
| B2-E5 | Cajero: recepción sin pedido a Beta y envío → dueño devuelve → cajero corrige y reenvía → dueño rechaza | Recepción `RECHAZADA` con motivo: eventos ENVIO (cajero) → DEVOLUCION_A_BORRADOR (dueño) → ENVIO (cajero) → RECHAZO (dueño); sin stock, sin costo nuevo, sin obligación ni asociación para Beta. |
| B2-E6 | Cajero revisa recepciones aprobada y rechazada | Sin Aprobar/Devolver/Rechazar ni edición; sin datos financieros del proveedor; sin opción de pago (sin turno). Permisos del cajero (catálogo, anticipos, área) iguales a la línea base. |
| Transversal | Dinero | En el intervalo: 0 movimientos financieros, operaciones, egresos de Caja, créditos, asignaciones y pagos de recepción en el negocio. |

## 4. Herramientas (adaptadas del Bloque 1, sin tocar las certificadas)

Carpeta `%USERPROFILE%\deligo-dev-db\certificacion\b2-manual\` (fuera del repo):

| Archivo | Origen | Qué hace |
|---|---|---|
| `b2-manual.sql` | nuevo (patrón de `b1-manual.sql`) | SOLO LECTURA (`BEGIN READ ONLY`/`ROLLBACK`), SHA-256 `f6d80d9af390aae74e58333ff37444d04597ffc0b51957ed841f188126fca0b2`. Secciones: productos, variantes, altas fuera de alcance, proveedores, pedidos y renglones, recepciones y renglones, eventos, movimientos, costos vigentes, registros de precios, asociaciones, obligaciones, créditos, asignaciones, eventos de cuenta, pagos de recepción, dinero del intervalo, turnos, auditoría (sin detalle), permisos del cajero, configuración de impuestos. Sin CUIT, contactos, notas, motivos escritos ni comprobantes. |
| `testing-b2-manual.ps1` | copia de `testing-b1-manual.ps1` | Mismas protecciones: proyecto/entorno TESTING, commit esperado `327d6c73`, SHA del SQL, palabras de escritura prohibidas, sesión `default_transaction_read_only`, negocio `paola-vinal`, ids QA fijos, URL de la base sólo en memoria, salida enmascarada. |
| `analizar-railway.mjs` | copia del B1 | + rutas `/api/negocio/(compras|recepciones)` y palabras de compras/stock en «relacionados». |
| `preparar.mjs` | adaptación del B1 | El operador ingresa como dueño; verifica sesión y datos fijos; se detiene si hay otros «QA B2»; crea sólo el Producto Stock (o lo reutiliza en un reintento). |
| `b2-manual-preparar.ps1` | adaptación del B1 | Despliegue → preparación → línea base SQL → inicio de pruebas → instrucciones. |
| `esperado.mjs` | nuevo | Valores esperados con la fórmula vigente según el tratamiento configurado. |
| `instrucciones.mjs` | adaptación del B1 | `INSTRUCCIONES-OPERADOR.md` con pasos, datos y resultados esperados + plantilla de observaciones. |
| `comparar.mjs` | adaptación del B1 | Antes/después por escenario (BASE, E1–E6, DINERO, GENERAL, DESPLIEGUE, LOGS, OPERADOR); 409 de la segunda aprobación correlacionado por ruta/método/tiempo. |
| `b2-manual-verificar.ps1` | adaptación del B1 | SQL final, despliegue, logs, comparación, revisión de credenciales, ZIP `B2-MANUAL-<etiqueta>-<marca>-<ESTADO>.zip`. |

Control técnico hecho: SQL ejecutado en sesión de solo lectura contra el esquema local (`deligo_dev`, 69 migraciones) sin
errores; todos los `.ps1` sin errores de análisis; `.mjs` con `node --check`; comparador e instrucciones en seco con datos
ficticios (sin fallos de la herramienta). No se ejecutó nada en TESTING.

## 5. Comandos del operador

Preparación (abre un navegador: ingresar como dueño de `paola-vinal`):

```powershell
powershell -ExecutionPolicy Bypass -File "%USERPROFILE%\deligo-dev-db\certificacion\b2-manual\b2-manual-preparar.ps1"
```

Después de las pruebas manuales y de completar `observaciones-operador.md`:

```powershell
powershell -ExecutionPolicy Bypass -File "%USERPROFILE%\deligo-dev-db\certificacion\b2-manual\b2-manual-verificar.ps1"
```

## 6. Observaciones para el operador (sin cambios de comportamiento)

1. **Costos del Bloque 1:** la aprobación actualiza el último costo de los productos A y B Variante 1 (efecto a certificar;
   autorizado como operación QA del Bloque 2). Precios, stock y asociaciones certificadas del Bloque 1 no se tocan, salvo
   la asociación nueva descrita abajo.
2. **Asociación específica redundante:** Alfa ya entrega «todas las variantes» de B; al aprobar, el código vigente suma
   igual una asociación específica Alfa ↔ B Variante 1 (`ON CONFLICT DO NOTHING` no la considera duplicada). No es un
   duplicado según la regla actual; se relaciona con la mejora UX «Todas las variantes» del ROADMAP. Se informa, no se cambia.
3. No hay otra decisión comercial pendiente para ejecutar el bloque.

## 7. Operación de preparación previa — turno del cajero abierto (2026-11-25, ejecución `M11250631`)

Situación al terminar la preparación (línea base original `M11250631`, 06:32 UTC; ninguna prueba iniciada):
- Turno `cmwvlv6tb0008s40abp7v5ebj` — «QA Caja A e31b», responsable el cajero QA, abierto 2026-11-25 04:10:23 UTC
  (01:10 hora Argentina), fondo $0. **Se cierra** para que el cajero empiece sin turno.
- Turno `cmw2sjtoj002do40aqaq0i1hu` — «Caja principal», responsable el dueño, abierto 2026-11-05 00:12 UTC
  (04/11 hora Argentina). **Queda intacto.**

Procedimiento (sin código funcional, sin datos nuevos, sin tocar históricos):
1. `b2-manual-preparar.ps1 -RevisarTurno` — SOLO LECTURA (`b2-turno-previo.sql`, SHA `97371c1b…11d0c`, nueva acción `turno`
   del ejecutor): estado de los dos turnos y registros ligados al turno del cajero en ventas, operaciones y movimientos
   financieros, egresos, compensaciones, devoluciones, cambios, entregas, traspasos y revisiones. Si alguno ≠ 0, se detiene.
2. El cajero cierra su turno desde la interfaz con efectivo contado 0. El cierre (`cerrarTurnoCaja`) sólo marca el turno
   `CERRADO_DECLARADO` y la revisión de bloqueo de su caja: no crea movimientos de dinero ni toca otros turnos.
3. `b2-manual-preparar.ps1 -NuevaLineaBase` — comprueba el cierre por el responsable con contado 0 y que el turno del dueño
   no cambió; registra `preparacion/cierre-turno-previo.json`; conserva `linea-base-sql-ORIGINAL.txt` e
   `inicio-pruebas-ORIGINAL.json`; toma la línea base nueva reutilizando los datos QA ya preparados.
El comparador agrega a BASE: el cajero sin turno abierto al empezar, el cierre previo y el turno del dueño intacto.

## 8. Primera verificación INCOMPLETA y conciliación de seis HTTP 401 (2026-11-25)

- **Resultado original:** `B2-MANUAL-M11250631-20261125T165107Z-INCOMPLETO.zip` (SHA-256
  `cffd60d43e3e2a8e66e91bafa65f4c8bd1c67ebc8097b7ed867c124980fcd86f`, 31533 B; se conserva). Operador 21/21; 11/12 bloques
  internos aprobados; LOGS INCONCLUSA sólo por seis HTTP 401 GET en rutas operativas del cajero a las 16:48:47–16:48:48 UTC,
  casi diez horas después de la última escritura auditada (06:55:01.484 UTC). Sin 5xx; 409 de la segunda aprobación
  correlacionado (06:50:44 UTC).
- **Causa declarada por el operador:** ventanas del dueño y del cajero abiertas y minimizadas ~10 h; al reabrirlas la
  interfaz del cajero cerró el acceso por falta de sesión. Sin operaciones comerciales en ese período.
- **Regla vigente (código `327d6c73`, sin cambios):** la sesión operativa dura 12 h fijas, sin renovación (vencimiento en la
  base y `maxAge` de la cookie). `resolveOperativoAreaForSlug` responde **401** «sin_sesion» cuando falta la cookie, cuando
  la sesión no existe o venció, o cuando la cuenta operativa no está activa; un problema de permisos o de área da 403. Los
  seis 401 son compatibles con ese comportamiento.
- **Limitación:** los logs no distinguen una sesión vencida de una cookie ausente o inválida (mismo 401). No se afirma que
  se confirmó técnicamente el vencimiento.
- **Conciliación (sin tocar datos, auditorías, líneas base ni el intervalo):** `preparacion/conciliacion-logs.json` declara
  los seis registros por valor exacto (fecha con nanosegundos, método, ruta y código). El comparador agrega el bloque
  CONCILIACION y sólo los tolera si TODOS se cumplen: seis registros, todos GET/401 en `/api/operativo/`, presentes
  exactamente en los logs de la verificación, posteriores a la última escritura auditada, sin escrituras desde un minuto
  antes y en una sola ráfaga. Cualquier otro 4xx relacionado o 5xx sigue bloqueando. Genera `CONCILIACION-LOGS.md`.
  Comprobado sobre una copia de la evidencia: con la declaración exacta → APROBADO; con un registro alterado → CONCILIACION
  FALLIDA, 0 tolerados.
- **Recomendación para las próximas certificaciones:** cerrar las ventanas de prueba (dueño y cajero) antes de ejecutar la
  verificación interna, para evitar consultas automáticas posteriores con sesiones vencidas.
