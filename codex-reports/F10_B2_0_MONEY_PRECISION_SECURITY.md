# F10-B2.0 — Precisión monetaria, migración segura a Decimal y seguridad de Caja

Fecha: 2026-10-09 · Entorno: TESTING únicamente (amiable-rejoicing / TESTING / DeliGO Copy / testing-codex) · Production: sin cambios.
Base: `2a25b0d` (F10-B1 CLOSED_TESTING_CERTIFIED) · rama `work/f10-b2-0-money-precision-security`.

```text
F10_B2_0_STATUS=IMPLEMENTED_TESTING (2026-10-09; sin smoke físico obligatorio — ver §12)
F10_B2_1_STATUS=NOT_STARTED · F10_B2_2_STATUS=NOT_STARTED · F10_C_STATUS=NOT_STARTED · F10_D_STATUS=NOT_STARTED · F10_E_STATUS=NOT_STARTED
CONSUMO_INTERNO_STATUS=PLANNED_NOT_STARTED (sin cambios de ubicación ni alcance)
```

## 1. Objetivo y alcance

Bases técnicas previas a turnos y cierre ciego. Implementado:
1. **Dinero exacto** para los importes de Caja que se suman, restan o comparan, mediante `src/lib/money.ts` (Prisma.Decimal / decimal.js en memoria, `NUMERIC(12,2)` en la base).
2. **Migración aditiva** `20261010120000_f10_b2_0_money_decimal_columns`: 4 columnas `Decimal?` nuevas y backfill histórico verificado.
3. **Escritura doble** en el motor único `registrarVentaCaja` (Float + Decimal, en la misma transacción).
4. **Resumen diario del dueño** con sumas exactas, sin cambiar el contrato JSON.
5. **Backfill idempotente** con guardia de huella (`scripts/money-decimal-backfill.ts`) para las filas que escriba el código anterior durante un deploy.
6. **Seguridad:** `/api/negocio/caja` incorporado a la protección de origen existente del proxy.

**No implementado (a propósito):**
- cajas físicas, turnos, fondo inicial, apertura y cierre ciego (F10-B2.1/B2.2);
- salidas de efectivo, recepciones y Consumo interno (F10-C);
- cuentas, Mercado Pago y conciliación (F10-D);
- cambios de efectivo/transferencia (F10-E);
- saldos visibles.

`Producto.precio`, precios de pedidos y demás `Float` comerciales fuera de Caja: **sin cambios**.

## 2. Diagnóstico de los `Float` monetarios

**Flujo real del dinero en Caja** (no repite F10-A):

| Paso | Dónde | Antes de B2.0 |
|---|---|---|
| Precio oficial | `Producto.precio` / `ProductoVariante.precio` (Float), leídos por el motor dentro de la tx | sin cambios |
| Descuentos | Caja **no** aplica descuentos de producto (sólo precio base o de variante) | sin cambios |
| Subtotal de línea | `computeSaleFromAuthoritativeProducts` → `Math.round(precio × cantidad × 100) / 100` | Float |
| Total | `Math.round(Σ subtotales × 100) / 100` | Float (suma binaria) |
| Persistencia | `Venta.total`, `VentaItem.precio/subtotal`, `CobroVenta.importe`, `MovimientoFinanciero.importe` (Float) | Float |
| Cobro / libro | `importe = venta.total` (copia del Float) | Float |
| Resumen del dueño | `GET /api/negocio/caja/ventas` suma `v.total` en JavaScript y redondea | suma Float |
| Cliente | `caja-tab.tsx` muestra el carrito con `cartTotal` (sólo visualización; el servidor es la autoridad) | sin cambios |

Otros `Float` monetarios (pedidos, delivery, promociones, `montoAbonado`) **no** comparten estas columnas y quedan fuera del alcance. `analytics` agrega `pedidos.total`, no Caja.

**Datos reales en TESTING** (auditoría sólo lectura, huella `d64be28f676e`):
- 12 ventas, 15 ítems, 4 cobros, 3 patas, 139 productos, 7 variantes;
- **0** valores con más de 2 decimales, **0** negativos, **0** no finitos, **0** fuera de `NUMERIC(12,2)`;
- 0 cantidades fraccionarias;
- consistencia histórica: total = Σ subtotales, subtotal = round2(precio × cantidad), cobro = total, pata = cobro, con **0** excepciones.

`ROUND(x::numeric, 2)` reproduce exactamente todas las filas.

## 3. Representación y reglas

- **Tipo:** `NUMERIC(12,2)` (Prisma `Decimal? @db.Decimal(12, 2)`), rango ±9.999.999.999,99. Compatible con todos los valores reales; los máximos actuales son ventas de 20.010 y pedidos de 176.100.
- **En memoria:** `Prisma.Decimal` (decimal.js 10.6.0, ya incluido en Prisma; sin dependencias nuevas). Módulo **sólo servidor** (un contrato impide que lo importe un componente cliente).
- **Origen Float:** su forma decimal más corta (`String(number)`), es decir, lo que el comercio cargó. **Convertir un Float a Decimal no recupera precisión que nunca existió.** El punto de cuantización de los valores viejos es `round2` (`ROUND(x::numeric, 2)` en el backfill).
- **Reglas:**
  - cuantización de un importe: 2 decimales, **ROUND_HALF_UP**;
  - **subtotal de línea:** exactamente la regla de siempre (`Math.round(precio × cantidad × 100) / 100`), devuelta como Decimal exacto de centavos (`lineSubtotalCaja`);
  - **todo lo posterior es aritmética decimal exacta:** total = suma exacta de subtotales; cobro, pata del libro y las futuras cuentas de esperado, diferencias y traspasos.
- **Equivalencia demostrada:** para todo precio con ≤ 2 decimales y cantidad entera, la regla de línea coincide con el HALF_UP exacto y con el valor anterior (barrido de >19.000 combinaciones en `money.test.ts`). Eso cubre todos los datos históricos y el catálogo soportado.
- **Diferencia detectada, NO cambiada (decisión pendiente):** con cantidades **fraccionarias** o precios con **más de 2 decimales**, el redondeo binario de la regla anterior baja algunos medios centavos verdaderos.
  - Ejemplos: 0,29 × 0,5 da 0,14 (HALF_UP exacto: 0,15); 1,005 × 1 da 1,00 (HALF_UP: 1,01).
  - Un barrido encontró 20.979 de 600.000 combinaciones fraccionarias con 1 centavo de diferencia.
  - Cambiarlo sería una decisión comercial de redondeo (la venta por peso F1 no está aprobada), así que **se conserva la regla anterior bit a bit** y queda registrada como decisión pendiente.
  - No hay datos afectados (0 cantidades fraccionarias y 0 precios con más de 2 decimales).
- **Rango:** una venta cuyo total o subtotal no entra en `NUMERIC(12,2)` se rechaza con 400 ("El importe de la venta está fuera del rango permitido") **antes** de escribir nada. Antes se aceptaba un Float sin límite; ningún dato real se acerca a ese rango.
- **Precio unitario:** `VentaItem.precio` sigue en Float, sin columna decimal. No se suma nunca: el subtotal exacto se calcula del precio dentro del motor, y el catálogo admite precios con más de 2 decimales, que una columna `(12,2)` truncaría. No se agregó una columna que no aporta garantía.

## 4. Schema anterior y nuevo

| Tabla | Columna existente (sin cambios) | Columna nueva |
|---|---|---|
| `ventas_caja` | `total` Float | `totalDecimal` NUMERIC(12,2) NULL |
| `venta_items` | `subtotal` Float (`precio` Float) | `subtotalDecimal` NUMERIC(12,2) NULL |
| `cobros_venta` | `importe` Float | `importeDecimal` NUMERIC(12,2) NULL |
| `movimientos_financieros` | `importe` Float (con signo) | `importeDecimal` NUMERIC(12,2) NULL (con signo) |

Sin `DROP`, `ALTER COLUMN`, `NOT NULL`, ni cambios en stock, reservas o movimientos de inventario. El código anterior (`2a25b0d`) funciona con el esquema ampliado: no conoce las columnas nuevas y TESTING siguió sirviendo con él tras aplicar la migración.

## 5. Migración aplicada (sólo TESTING)

- Archivo `prisma/migrations/20261010120000_f10_b2_0_money_decimal_columns/migration.sql`. Contiene 4 `ADD COLUMN` y 4 `UPDATE … SET x = ROUND(f::numeric, 2) WHERE x IS NULL AND abs(f) < 9999999999.995`.
- **Inmutabilidad:**
  - commiteado (`420f5d6`) **antes** de aplicarlo;
  - LF, sin CR, un único salto final (contrato estático);
  - sha256 del archivo = sha256 del blob = `10f49eab16a9b89b9cc49cde28072a73c7355cee583ab2067de1ff0a5b5f6dbe`.
- **Aplicación:**
  - guardia de huella `d64be28f676e`;
  - `prisma migrate status`: sólo esta migración pendiente;
  - comprobación de bytes contra el blob;
  - `prisma migrate deploy` → "All migrations have been successfully applied", luego "Database schema is up to date".
- **Checksum registrado:** `_prisma_migrations.checksum` = `10f49eab…` = archivo = blob (**coincide**). El checksum de F10-B0 sigue siendo `d3faab68…` (no se tocó la migración ni su registro; sin `UPDATE` sobre `_prisma_migrations`).
- **Drift:** `migrate diff` (base → schema) sólo muestra el `ALTER INDEX … RENAME` preexistente de `chat_attachment_deletion_jobs`.
- **Bloqueos e impacto:** `ADD COLUMN` NULL sin default sólo toca metadatos. Los `UPDATE` afectaron 12/15/4/3 filas. En Production el volumen es desconocido: el backfill es por fila y sólo de NULLs; a evaluar en su promoción, que no está autorizada.

## 6. Backfill y verificaciones (TESTING)

| Tabla | Filas | NULL tras backfill | ≠ ROUND(float,2) | Float vs Decimal > 1e-6 | Suma Decimal / Float |
|---|---|---|---|---|---|
| ventas_caja | 12 | 0 | 0 | 0 | 62310.00 / 62310 |
| venta_items | 15 | 0 | 0 | 0 | 62310.00 / 62310 |
| cobros_venta | 4 | 0 | 0 | 0 | 7000.00 / 7000 |
| movimientos_financieros | 3 | 0 | 0 | 0 | 5000.00 / 5000 |

- **Coherencia exacta:** total = Σ subtotales, cobro = total, pata = cobro, con **0** excepciones.
- **Sin cambios en stock, reservas y modo:** 139 productos, stock total 48, variantes 16, 25 movimientos; reservas ACTIVA 1 · CONSUMIDA 1 · LIBERADA 4; modo ON (config sin cambios desde 2026-10-08T17:51:08Z).
- **Discrepancias:** ninguna (`BACKFILL_MISMATCHES=0`).
- **Ventana de deploy:** entre `migrate deploy` y el nuevo código, el código anterior escribe Decimal NULL. `bun scripts/money-decimal-backfill.ts --expect-db=<huella>` informa (dry-run) y completa con `--execute --confirm=BACKFILL` (misma regla, idempotente, nunca toca Float). Un dry-run en TESTING dio 0 pendientes. Resultado post-deploy: ver §12.

## 7. Escritura doble y compatibilidad

- `registrarVentaCaja` calcula los importes **una sola vez** (`saleAmountsExact`) y escribe en la misma transacción Serializable:
  - `Venta.total = número(totalExacto)` y `totalDecimal = totalExacto`;
  - cada `VentaItem.subtotal/subtotalDecimal`;
  - `CobroVenta.importe/importeDecimal`;
  - en efectivo, la pata `MovimientoFinanciero.importe/importeDecimal`.

  El Float es la forma de transporte del mismo Decimal: **siempre los mismos centavos**. No hay venta confirmada con el decimal incompleto: todo o nada.
- **Idempotencia, replay por actor, doble toque, R3A, actor, aislamiento y stock:** sin cambios; el replay devuelve la venta original sin escribir nada.
- **Contratos JSON:**
  - la Caja del dueño (POST 201/200 y GET `ventasHoy`) devuelve **los mismos campos** que antes: `ventaCajaParaRespuesta` quita las columnas Decimal, que si no se serializarían como texto;
  - `resumenHoy` mantiene su forma numérica y ahora suma exacto (`storedMoney`: columna Decimal, o el Float cuantizado si la fila es anterior al backfill);
  - la respuesta del cajero (`ventaParaCajero`) sigue siendo una lista explícita, sin Decimal.
- **Compatibilidad histórica:** las ventas viejas se leen igual. Un contrato verifica que el resumen lee una fila sólo-Float (simulando el código anterior).

## 8. Estado del libro financiero

- Sigue siendo mínimo (F10-B0): sólo cobros en efectivo, una pata por operación en `efectivo_caja_sin_asignar`. Ahora con `importeDecimal` exacto y verificado igual al cobro.
- **No** hay saldos visibles, fondos iniciales, cuentas de Mercado Pago ni conciliación.
- Las futuras sumas (efectivo esperado, diferencias) deben usar `importeDecimal` / `storedMoney` y `addMoney` / `subtractMoney` de `src/lib/money.ts`.

## 9. Seguridad de Caja

**Revisión de la protección de origen:**
- `src/proxy.ts` aplica `validateMutationOrigin` (`src/lib/request-security.ts`) a los métodos mutantes de los prefijos listados: exige Origin o Referer en la allowlist (`ALLOWED_ORIGINS`, `CLIENT_URL(S)`, `NEXT_PUBLIC_APP_URL`, `APP_URL`, `NEXTAUTH_URL` y el origen propio) y responde 403 si falta.
- `/api/negocio/caja` **no** estaba listado y su handler no valida origen. El `POST` de ventas, que crea venta, cobro y libro, dependía sólo de la cookie de sesión `SameSite=Lax` (`src/lib/auth-session-cookie.ts`).
- Lax impide el envío en POST cross-site, pero no en contextos same-site (por ejemplo otro subdominio del mismo sitio registrable) ni ante navegadores que no la respeten.
- El handler hace `req.json()` sin exigir `Content-Type`.

**Conclusión: brecha real de defensa en profundidad**, de baja explotabilidad, inconsistente con el resto del panel del dueño.

**Corrección:** `"/api/negocio/caja"` agregado a `NEGOCIO_ORIGIN_PROTECTED_PREFIXES`, con el mismo mecanismo y sin una segunda implementación de CSRF.
- Las lecturas, la ruta del cajero (ya cubierta por `/api/operativo`) y los demás prefijos no cambian.
- La Caja del dueño y la PWA envían `Origin` same-origin en sus POST (los POST protegidos de `/api/negocio/productos` y `/api/operativo` ya funcionan así en TESTING).

**Pruebas** (`f10-b2-0-origin.test.ts`, 9/0):
- same-origin y Referer propio pasan;
- cross-origin por Origin o por Referer → 403;
- sin Origin ni Referer → 403 (política existente);
- `GET` no se valida;
- sin sesión → 401;
- cajero same-origin pasa y cross-origin da 403;
- `productos` sigue protegido.

**Cajero:** las protecciones de F10-B1 no cambiaron (área `caja`, negocio, cuenta activa, sesión personal, sin rutas de dueño, sin precios, actor ni saldos; el replay por actor está verificado de nuevo en real-DB).

**Hallazgos laterales (NO tocados, fuera del alcance de Caja):** otros prefijos mutantes del dueño sin protección de origen: `/api/negocio/inventario/movimientos`, `/api/negocio/mesas` y `/api/negocio/solicitudes-revision-resenas`. Se recomienda una tarea de seguridad dedicada.

## 10. Pruebas

Nuevos — **47 pass / 0 fail**:

| Archivo | Resultado | Cubre |
|---|---|---|
| `src/lib/money.test.ts` | 14/0 | 0,10 + 0,20 = 0,30 exacto; 1000 × 0,10 = 100,00; resta y comparación exactas; HALF_UP; forma decimal más corta de un Float; NaN/±Infinity/no numérico rechazados; rango NUMERIC(12,2) y negativos sólo permitidos explícitamente; cantidades grandes; venta multilínea (total = Σ subtotales); barrido de >19.000 combinaciones (regla de línea = HALF_UP exacto = regla anterior para ≤ 2 decimales × cantidad entera); regla de línea idéntica a la anterior también con cantidades fraccionarias (decisión pendiente documentada); lectura compatible; transporte numérico sin cambio de formato |
| `src/lib/f10-b2-0-money.integration.test.ts` (real DB TESTING) | 11/0 | Dueño: efectivo con precios en centavos (0,10 × 3 + 0,20 → 0,50 exacto en todas las columnas, mismos centavos en Float, pata exacta, stock 10 → 7); transferencia + variante (5999,97, DECLARADO, sin pata); cliente sin clave; importe fuera de rango → 400 sin escrituras; replay (mismo JSON, sin claves Decimal, nada escrito) y 409 por contenido distinto; doble toque 6 concurrentes → 1 venta/1 cobro/1 pata; reserva ACTIVA → 409 STOCK_RESERVED_FOR_ORDERS sin escrituras y reserva intacta. Cajero: efectivo y transferencia con Decimal exacto, actor EMPLEADO, contrato de respuesta intacto; replay por actor (el dueño con la misma clave → 409). Resumen: 0,10 + 0,20 = 0,3 exacto, `ventasHoy` sin claves Decimal, fila legacy sólo-Float leída por el resumen. Backfill acotado: completa NULLs con ROUND, no toca Float, idempotente, informa la fila fuera de rango |
| `src/lib/f10-b2-0-origin.test.ts` | 9/0 | protección de origen de `/api/negocio/caja` (ver §9) |
| `src/lib/f10-b2-0-static-contract.test.ts` | 13/0 | sólo el motor escribe las columnas Decimal; escritura doble desde un único cálculo (no se escriben valores Float derivados del cálculo viejo); un solo motor; helpers sólo servidor; regla de línea anterior + acumulación exacta; respuestas del dueño sin Decimal; resumen sin sumas Float; respuesta del cajero sin Decimal; migración aditiva (8 sentencias exactas, nada destructivo, nada de R3A/stock); bytes LF con un salto final; columnas del schema; migración F10-B0 sin editar (5631 bytes); prefijo de origen de Caja sin segunda implementación CSRF |

**Contratos y tests existentes ajustados (sin debilitar):**
- `f10-b0-static-contract` (resumen por `Venta.metodoPago`, sin cobros);
- `f10-b1-static-contract` ("B1 no agregó migración");
- el fake en memoria de `route.reservations.test.ts`: su `structuredClone` de rollback no podía copiar `Prisma.Decimal` (DataCloneError → 500); ahora conserva los Decimal por referencia. Aserciones sin cambios, 14/0.

**Regresiones:** cada archivo en su propio proceso, secuencial, guardia de huella TESTING; timeout por test de 60 s y secreto OAuth de prueba local para evitar el ruido de entorno ya clasificado en F10-B1. **137 archivos, 1796 pass / 9 fail en la primera pasada.** Clasificación:
- **1 nueva causada por B2.0 y corregida:** el fake de reservas de Caja (arriba) → 14/0.
- **5 preexistentes verificadas** (idénticas en `e72c61b`, archivos no tocados): `catalog-tutorial-static-contract` 1, `category-filter-operational-static-contract` 1, `product-variants-static-contract` 2, `operativo-logout-wiring-static-contract` 1.
- **2 preexistentes verificadas:** `google-oauth-consent-gate.integration` 2, idénticas en `e72c61b` (B1 §8).
- **1 preexistente intermitente:** `mesa-pedido-cancelacion` (concurrencia real contra la base remota). Falló un caso distinto en cada corrida (K2; luego H5 + K1). Corridas alternadas: **base `e72c61b` falla K2 en 2 de 3**, la rama pasó 3 de 3. B2.0 no toca su código (diff vacío de `mesa-pedido-cancelacion` y `stock-lifecycle`). Se recomienda un seguimiento de su estabilidad.

**Resultado: 0 regresiones nuevas pendientes.**

Destacados: Caja dueño `route.test` 21/0 · idempotencia B0 real-DB 11/0 · reservas 14/0 · cajero B1 real-DB 23/0 · página del cajero 4/0 · checkout idempotente 6/0 · escáner F9 7/0 · contratos F9, F10-B0 9/0, F10-B1 13/0, R3A I1 19/0, I2 34/0 · `proxy.test` 56/0 · Inventario · Pedidos · Mozo/PyR/Salón · auth.

## 11. Gates

| Gate | Resultado |
|---|---|
| Tests nuevos | 47/0 (real-DB 11/0) |
| Regresiones | 137 archivos; 0 regresiones nuevas pendientes (§10) |
| TypeScript | 35 errores; **conjunto idéntico** al baseline medido en `2a25b0d` antes de cambiar nada → 0 nuevos (sin `any`, `@ts-ignore` ni cambios de configuración) |
| ESLint (13 archivos .ts/.tsx cambiados) | limpio |
| `prisma validate` / `generate` | válido / generado |
| `next build` | OK (compiled, 160/160) |
| `git diff --check` | limpio |
| Migración | aditiva; checksum aplicado = archivo = blob (`10f49eab…`); F10-B0 sin cambios (`d3faab68…`) |

## 12. Integración y deploy

- **Commits** (rama `work/f10-b2-0-money-precision-security`):
  - `aff31ad` feat: add exact money helpers for caja amounts
  - `420f5d6` feat: add decimal money columns with historical backfill
  - `d55e0ab` feat: dual-write exact money amounts in the caja sale engine
  - `21d86de` fix: apply owner origin protection to caja routes
  - `b175c52` test: cover exact money dual write, backfill and caja contracts
  - `522c821` test: keep decimal values in the caja reservations fake snapshot
- **Integración:**
  - migración aplicada a TESTING con `migrate deploy` **antes** de integrar (§5);
  - referencia de seguridad local `f10-b2-0-pre-integration-testing-codex` → `2a25b0d`;
  - fast-forward `testing-codex` `2a25b0d..522c821` (push sin force);
  - `main` sin cambios (`42ca500`).
- **Deploy TESTING:** `e30bd062-9bdd-4a2c-a7df-1472247bcf2d` SUCCESS, commitHash `522c8219ab4fcc1acfd2c10870ac8e5383c0ecc3` (coincide). Logs: "40 migrations found", "No pending migrations to apply", "Ready", sin errores ni excepciones (sólo el aviso de actualización de Prisma).
- **Smoke HTTP** (sin crear ventas):
  - `POST /api/negocio/caja/ventas` cross-origin con cookie de dueño → **403 "Origen no permitido"** (protección activa);
  - same-origin → llega al handler (403 "Acceso denegado" con sesión falsa);
  - sin sesión → 401; `GET` sin sesión → 401;
  - `POST /api/operativo/caja/x/ventas` sin sesión → 401;
  - `/negocio` → 200.
- **Base (sólo lectura, huella `d64be28f676e`):**
  - checksum `10f49eab…` = archivo; F10-B0 `d3faab68…` sin cambios;
  - backfill en dry-run: **0 pendientes** (no hubo ventas en la ventana migración → deploy);
  - 12/15/4/3 filas con Decimal completo, = ROUND(Float), sumas idénticas, coherencia exacta;
  - stock (48 / variantes 16 / 25 movimientos), reservas (ACTIVA 1 · CONSUMIDA 1 · LIBERADA 4) y modo ON sin cambios;
  - 0 duplicados, 0 cobros dobles, 0 cruces entre negocios, 0 stock negativo;
  - 0 fixtures `test-f10b20-*` y 0 cuentas de prueba remanentes.
- **Auditoría:** las suites real-DB **preexistentes** dejaron **34** filas huérfanas más de `audit_logs` durante esta regresión (05:10–05:34Z: 13 `venta.creada`, 8 `empleado.creado`, 3 `empleado.area_asignada`, 5 `producto.stock_ajustado`, 4 de variantes, 1 terminal). Es el mismo patrón que las 47 ya documentadas (`FOLLOWUP_REAL_DB_SUITES_AUXILIARY_TABLE_CLEANUP`). No se borraron. Las suites nuevas de B2.0 limpian sus propias auditorías.
- **Production** `6bf1ee84` @ `42ca500`: sin cambios.
- **Smoke físico:** no obligatorio (sin cambios visibles de interfaz). Verificación opcional para el operador, en TESTING:
  1. una venta en efectivo y una por transferencia desde la Caja del dueño, y una desde la Caja del cajero;
  2. verificar que los importes y el Resumen se ven igual que antes.

## 13. Cambios de contratos

- **Sin cambios visibles:** misma forma JSON en las Cajas del dueño y del cajero, y mismos importes para todos los datos y el catálogo soportado.
- **Nuevo:** 400 para importes fuera de `NUMERIC(12,2)`.
- **Nuevo:** 403 "Origen no permitido" para POST cross-origin o sin origen a `/api/negocio/caja/**`.
- **Contratos estáticos ajustados sin debilitar su intención:**
  - F10-B0 "las estadísticas leen Venta": ahora con suma exacta, todavía por `Venta.metodoPago` y sin cobros;
  - F10-B1 "la última migración es la de B0" pasa a "B1 no agregó migración": a B0 le sigue directamente B2.0.

## 14. Riesgos y limitaciones

- La regla de línea con cantidades fraccionarias o precios con más de 2 decimales conserva el redondeo binario anterior (decisión pendiente, §3).
- Los Float siguen existiendo y escribiéndose (transición). Retirarlos sería una migración destructiva aparte y autorizada.
- Los precios del catálogo siguen en Float (sin cuantizar a centavos en la carga).
- Ventana de deploy con Decimal NULL: hay que completarla con el script de backfill (sólo NULLs).
- Production todavía no tiene la migración. Su promoción requiere evaluar volumen y bloqueos, y correr el backfill tras el deploy.
- La deuda de TypeScript (35 errores preexistentes) es independiente.
- Las 47 filas de `audit_logs` huérfanas siguen documentadas y no se tocaron. Los tests nuevos borran sus propias auditorías (actores de fixtures).

## 15. Rollback

- **Código:** `git revert` de los commits funcionales de B2.0 en `testing-codex` + deploy de TESTING. El código anterior funciona con el esquema ampliado: no requiere `DROP`.
- **Schema y datos:**
  - las columnas `*Decimal` y su backfill quedan como datos persistidos (no se borran automáticamente);
  - con el código anterior, las ventas nuevas vuelven a dejarlas NULL;
  - si luego se re-aplica B2.0, el script de backfill las completa.
- **Seguridad:** revertir el commit `fix: apply owner origin protection to caja routes` reabriría la brecha de origen. Si hiciera falta revertir B2.0, conviene conservar ese commit (es independiente del dinero).
- No se ejecutó ningún rollback.

## 16. Dependencias para F10-B2.1

- Turnos y cajas: las sumas de efectivo esperado deben usar `importeDecimal` y `storedMoney`/`addMoney`/`subtractMoney` (nunca Float).
- Fondo inicial y traspasos: crear sus columnas nuevas directamente como `Decimal(12,2)`. No agregar nuevos `Float` monetarios.
- Correr el backfill tras cada deploy que cambie de código anterior a escritura doble.
- Decidir la regla de redondeo para cantidades fraccionarias y precios con más de 2 decimales antes de la venta por peso o de cuantizar precios.
- Mantener la protección de origen y considerar la tarea de seguridad de los prefijos laterales.
