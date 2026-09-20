# P2-T46-R2 — Mozo Manual Order Payment Timing Parity

Fecha: 2026-09-20
Tipo: CORRECTIVE FOLLOW-UP / REGRESSION FIX de una regla ya definida y
certificada conceptualmente en P2-T46 (Table Account + Ticket + History
Canonical Detail) — NO es un requerimiento nuevo, NO es una tarea nueva.
Alcance: IMPLEMENTACIÓN + TESTS + QUALITY GATE + COMMIT + PUSH +
TESTING DEPLOY. Sin Production, sin certificación física por Claude, sin
DB backfill, sin schema, sin migración, sin cambio de regla de negocio.

## 0. Contexto

Durante la certificación física completa de P2-T47
(`P2_T47_PHYSICAL_RESULT=TODO_PASS`) el operador detectó un finding
ADYACENTE y PREEXISTENTE, no introducido por T47: al levantar un pedido
manual de mesa desde Mozo/Operaciones personal, el flujo todavía
mostraba un selector "Efectivo/Transferencia" — violando la regla
canónica ya definida en T46:

**Hallazgo crítico de alcance (verificado por lectura directa,
read-only, de `origin/main` — sin ninguna acción sobre Production)**:
`P2_T46_STATUS=CLOSED_PRODUCTION` desde la promoción curada de T46-R4
(2026-09-11, ver `codex-reports/P2_T46_R4_CURATED_PRODUCTION_PROMOTION.md`).
`git show origin/main:"src/app/mozo/panel/[slug]/pedido/[mesaId]/page.tsx"`
confirma que el MISMO selector "Efectivo/Transferencia" (mismo
`useState`, mismos botones, mismo envío de `metodoPago` en el POST) ya
existe hoy en la copia de Production de este archivo — T46-R1 nunca
tocó el flujo de pedido manual de Mozo (sólo la cuenta/ticket/historial),
así que este gap es real y **probablemente también está afectando
Production ahora mismo**, no sólo TESTING. Este reporte NO toca
Production bajo ninguna circunstancia (instrucción explícita de esta
ronda) — el hallazgo se registra para que una futura ronda con
autorización explícita de Production evalúe promover este mismo fix.

```text
PAYMENT_METHOD_SELECTION_DURING_INDIVIDUAL_TABLE_ORDER=NO
PAYMENT_METHOD_SELECTION_AT_ACCOUNT_CLOSE=SI
```

## 1. Preflight

```text
WORKTREE_PATH=C:/Leo Campos/Trabajo/deligo-main-limpio
BRANCH=work/p2-t43-r2
START_HEAD_SHA=bc51876b706bf18a8d29bffb7a5118c231cb3c0e
DIRTY_BEFORE=SI (2 archivos documentales pre-existentes de esta misma
  sesión: DELIGO_FULL_CONTEXT_LATEST.md,
  codex-reports/P2_T44_R1P6I_ABSOLUTE_OPERATIONS_PUSH_TARGET.md —
  ninguno ajeno, ninguno de código)
ORIGIN_TESTING_SHA=bc51876b706bf18a8d29bffb7a5118c231cb3c0e
ORIGIN_MAIN_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
```

Worktree T39 confirmado intacto, no tocado. Lineage confirmado contra
HEAD real — incluye el commit R1 de T47
(`8994bc304ef7ad5c057acf1deeb83fd9354ad051`).

## 2. Evidencia de código confirmada contra HEAD real (no snapshots)

`src/app/mozo/panel/[slug]/pedido/[mesaId]/page.tsx` (compartido
verbatim con `/operaciones/mi-panel/[slug]/pedido/[mesaId]` vía
re-export literal) contenía, confirmado por lectura directa antes de
editar:

- `const [metodoPago, setMetodoPago] = useState<"efectivo" |
  "transferencia">("efectivo")`
- Botones "Efectivo"/"Transferencia" en el panel del carrito, con
  "Transferencia" deshabilitado según `menu.negocio.aceptaTransferencia`
- `metodoPago` enviado en el body de
  `POST /api/operativo/mozo/panel/[slug]/pedidos`

## 3. Auditoría exhaustiva de superficies (matriz completa)

| SURFACE | ROUTE | CAN_CREATE_TABLE_ORDER | PAYMENT_SELECTOR_VISIBLE | PAYMENT_METHOD_SENT_IN_REQUEST | EXPECTED_AFTER_T46 |
|---|---|---|---|---|---|
| Mozo (personal) | `/mozo/panel/[slug]/pedido/[mesaId]` | SÍ | SÍ → **NO (corregido)** | SÍ → **NO (corregido)** | Cumple |
| Operaciones personal Mozo | `/operaciones/mi-panel/[slug]/pedido/[mesaId]` (re-export literal) | SÍ | SÍ → **NO (mismo archivo)** | SÍ → **NO (mismo archivo)** | Cumple |
| Cliente Mesa | `/n/[slug]?mesa=X` (`CartCheckoutStep` en `cart-panel.tsx`) | SÍ | **NO — ya estaba oculto** (`{!isMesaOrder && <section>…Método de pago…</section>}`, `cart-panel.tsx:1344`) | SÍ (constante `"efectivo"`, nunca preguntado al cliente) | Visualmente cumple — ver hallazgo lateral §4 |
| Salón personal | `/operaciones/mi-panel/[slug]/salon` | NO (sólo tablero de ocupación en vivo, sin creación de pedidos) | n/a | n/a | n/a |
| Terminal Salón | `/operaciones/salon`, `/operaciones/terminal` | NO (sin scope de pedidos de producto — confirmado en T47-A0) | n/a | n/a | n/a |
| Panel Negocio | `/negocio` (`orders-tab`/`salon-tab`, vía `GET/PUT /api/negocio/pedidos`) | NO (sólo lista/actualiza estado, sin creación) | n/a | n/a | Ya cumple — lee `pedido.ocupacionMesa.metodoPago` (autoridad T46), nunca `Pedido.metodoPago`, para mostrar el método confirmado |
| Cierre de cuenta | `mesa-cuenta-dialog.tsx`, vía `POST /api/operaciones/ocupaciones/[id]/cuenta` | n/a (no es un pedido, es el cierre) | SÍ — **es el lugar correcto y autorizado** | SÍ — correcto, es la autoridad T46 | Cumple — preservado sin cambios |

```text
SURFACES_AUDITED=7
```

## 4. Hallazgo lateral documentado (NO corregido en esta ronda)

`src/components/cart/cart-panel.tsx` / `src/app/api/pedidos/route.ts`
(el checkout de Cliente para retiro/domicilio/mesa, endpoint COMPARTIDO
entre los tres métodos de entrega): aunque el selector VISUAL de método
de pago ya está correctamente oculto para `isMesaOrder` (confirmado
arriba), el backend `POST /api/pedidos` sigue **exigiendo y validando**
`metodoPago` incondicionalmente (`payload.metodoPago !== "efectivo" &&
payload.metodoPago !== "transferencia"` → 400), sin importar
`metodoEntrega`. El frontend satisface esto enviando silenciosamente el
valor constante `"efectivo"` (el `useState` inicial, nunca expuesto al
cliente para mesa) — el cliente nunca es "preguntado", pero el backend
sigue tratando el campo como si fuera significativo para un pedido de
mesa.

**No se corrige en esta ronda**: el finding y la autorización de esta
tarea son específicamente sobre "Operaciones personal funcionando como
Mozo" (§0-§2 del task spec, con evidencia de código citada
exclusivamente de ese archivo); `/api/pedidos` es un endpoint mucho más
grande y compartido por TODO el checkout de Cliente (retiro, domicilio
y mesa a la vez), con mayor superficie de regresión, y el task spec
explícitamente advierte contra expandir el alcance ("NO aplicar
globalmente", "Target principal", múltiples "NO cambiar X"). Se
documenta acá como hallazgo separado para una futura ronda bajo la
misma autoridad de T46, en vez de mezclarlo silenciosamente con esta
corrección quirúrgica.

```text
CLIENT_TABLE_ORDER_PAYMENT_SELECTOR=NO (selector visual confirmado
  ausente para pedidos de mesa; hallazgo lateral de backend
  documentado arriba, no corregido en esta ronda)
```

## 5. Target principal — cambios de frontend

`src/app/mozo/panel/[slug]/pedido/[mesaId]/page.tsx`:

- Eliminado `const [metodoPago, setMetodoPago] = useState(...)`.
- Eliminado el bloque `<div className="grid grid-cols-2 gap-2">` con los
  botones "Efectivo"/"Transferencia".
- Eliminado `metodoPago` del body de `submitOrder()`.
- Eliminado `aceptaTransferencia: boolean` de la interfaz `MenuData.negocio`
  (ya no tiene ningún consumidor en este archivo).
- **Preservado sin cambios**: Notas (`textarea`, `notas` state), el
  carrito (`cart`, `CartLine`, `updateQuantity`), y el 100% del
  `ProductConfigurator` de T47 (Badge "Obligatorio", contador N/máximo,
  `aria-pressed` + check de selección, variante roja/tachada de quitar
  ingredientes, `QuantityStepper` sin la papelera falsa, safe-area,
  touch targets 44px) — confirmado por régresión (§8).

```text
MOZO_PAYMENT_SELECTOR_REMOVED=SI
OPERATIONS_PERSONAL_PAYMENT_SELECTOR_REMOVED=SI (mismo archivo, re-export literal)
METODO_PAGO_REMOVED_FROM_TABLE_ORDER_REQUEST=SI
```

## 6. Backend — auditoría real (§7 del task spec)

Auditado `POST /api/operativo/mozo/panel/[slug]/pedidos` contra HEAD
real antes de editar:

```text
MOZO_POST_METODO_PAGO_REQUIRED=SI (antes del fix) → NO (después)
MOZO_POST_METODO_PAGO_VALIDATED=SI (antes) → NO (después) — ya no existe
  ninguna validación 400 "Metodo de pago invalido"
MOZO_POST_METODO_PAGO_PERSISTED=SI (antes, en Pedido.metodoPago) →
  NO explícitamente (después) — la columna toma su default de schema
  ("efectivo", `Pedido.metodoPago String @default("efectivo")`) sin que
  el endpoint la fije ni la trate como autoridad
MOZO_POST_CAN_OMIT_METODO_PAGO=SI (confirmado por test comportamental,
  §9)
```

Cambios exactos en `src/app/api/operativo/mozo/panel/[slug]/pedidos/route.ts`:

- Eliminada la validación `if (body.metodoPago !== "transferencia" &&
  body.metodoPago !== "efectivo") return 400`.
- Eliminado `metodoPago` de los parámetros/payload de
  `createManualOrderFingerprint` (la huella de idempotencia ya no
  incluye el método de pago).
- Eliminada la comprobación `if (metodoPago === "transferencia" &&
  !negocio.aceptaTransferencia) throw METODO_PAGO_INVALIDO` y su rama
  de catch correspondiente (código ahora inalcanzable, removido).
- Eliminado `aceptaTransferencia` del `select` de `negocio` (tanto en
  el `GET` del menú como dentro de la transacción del `POST`) — sin
  ningún consumidor restante en este archivo.
- Eliminado `metodoPago` del `select` de la respuesta `GET` (el menú ya
  no expone `aceptaTransferencia` al frontend).
- `tx.pedido.create({ data: {...} })` ya no incluye la key `metodoPago`
  — Postgres aplica el default de columna sin que el endpoint lo
  declare como autoridad.

## 7. Autoridad de cierre de cuenta — preservada sin cambios

```text
TABLE_PAYMENT_AUTHORITY_PRESERVED=SI
ACCOUNT_CLOSE_PAYMENT_SELECTOR_PRESERVED=SI
```

`SesionOcupacionMesa.metodoPago`/`pagoConfirmadoEn`/
`pagoConfirmadoPorTipo`/`pagoConfirmadoPorId` (schema, sin cambios),
`mesa-cuenta-dialog.tsx`, `POST /api/operaciones/ocupaciones/[id]/cuenta`,
`buildCuentaMesa`, el cierre comercial/técnico, el ticket y el
historial — ninguno de estos archivos fue tocado en esta ronda. La
auditoría (§3) no reveló ninguna dependencia real que obligara a
tocarlos.

## 8. Delivery / Retiro — sin cambios

```text
DELIVERY_PAYMENT_FLOW_CHANGED=NO
PICKUP_PAYMENT_FLOW_CHANGED=NO
```

El fix es exclusivo del endpoint `/api/operativo/mozo/panel/[slug]/pedidos`,
que sólo crea pedidos con `metodoEntrega: "mesa"` (hardcodeado, sin
cambios) — nunca delivery ni retiro. `/api/pedidos` (el endpoint
compartido que sí maneja los tres métodos) no fue tocado (ver hallazgo
lateral §4).

## 9. Tests

```text
FOCAL_TESTS=21 pass / 0 fail
  8  — src/app/api/operativo/mozo/panel/[slug]/pedidos/route.test.ts
       (comportamental: mock completo de @/lib/db + @/lib/operativo-mozo
       + @/lib/mesa-occupancy + @/lib/push + @/lib/salon-new-order-notification
       + @/lib/rate-limit, dejando correr sin mockear los helpers puros
       ya definidos en el propio route.ts contra un producto simple.
       Confirma: un pedido de mesa válido se crea sin metodoPago en el
       body (nunca 400); Pedido.create nunca incluye la key metodoPago;
       metodoEntrega sigue "mesa"; un cliente legacy que aún envía
       metodoPago="efectivo"/"transferencia"/basura no rompe ni es
       usado como autoridad; notas se sigue persistiendo sin cambios)
  13 — src/app/api/operativo/mozo/panel/[slug]/pedidos/payment-timing-static-contract.test.ts
       (contrato estático: sin validación "Metodo de pago invalido",
       sin METODO_PAGO_INVALIDO, fingerprint sin metodoPago,
       aceptaTransferencia ausente del archivo completo, Pedido.create
       sin la key metodoPago, metodoEntrega sigue "mesa", GET del menú
       sin aceptaTransferencia; más el lado frontend: sin state
       metodoPago, sin botones Efectivo/Transferencia, sin
       aceptaTransferencia, el POST manual sin metodoPago, Notas
       preservado; y confirma que el re-export de Operaciones sigue
       apuntando al mismo archivo corregido — MOZO_MANUAL_TABLE_ORDER_PAYMENT_SELECTOR_ABSENT=PASS)

T47_REGRESSION_TESTS=29 pass / 0 fail
  src/app/mozo/panel/[slug]/pedido/[mesaId]/page.test.ts — TODOS los
  contratos de T47 (Badge Obligatorio, contador N/max, aria-pressed +
  check, variante remove, precio sin cambios, fake-trash removido,
  CartLine preservado, safe-area, touch targets 44px, canAdd/total sin
  cambios, re-export de Operaciones intacto) siguen pasando sin ningún
  ajuste necesario.
T47_REGRESSION_PASS=SI

T46_REGRESSION_TESTS=60 pass / 19 fail — las 19 fallas son
  PREEXISTENTES (`Environment variable not found: DATABASE_URL`,
  dependen de una conexión Prisma/DB real no disponible en este
  entorno de test) — confirmado reproduciendo las MISMAS 19 fallas vía
  `git stash` sobre el código sin las modificaciones de esta ronda,
  antes de restaurar los cambios. No atribuibles a T46-R2. Los 60 tests
  que sí corren sin DB (mesa-cliente-cuenta-static-contract,
  mesa-cliente-cuenta-ui, partes de mesa-cliente-cuenta.test.ts que no
  golpean Prisma) pasan sin cambios.
```

## 10. Quality gate

```text
TSC_TOTAL_ERRORS=31
TSC_BASELINE_ERRORS=31
TSC_NEW_ERRORS=0
ESLINT=PASS (sin salida en los 4 archivos tocados/nuevos)
BUILD=PASS (incluye /mozo/panel/[slug]/pedido/[mesaId],
  /operaciones/mi-panel/[slug]/pedido/[mesaId] y /n/[slug])
DIFF_CHECK=PASS
```

## 11. Diff review

```text
PRODUCT_FILES_CHANGED=
  src/app/mozo/panel/[slug]/pedido/[mesaId]/page.tsx
  src/app/api/operativo/mozo/panel/[slug]/pedidos/route.ts
TEST_FILES_CHANGED=
  src/app/api/operativo/mozo/panel/[slug]/pedidos/route.test.ts (nuevo)
  src/app/api/operativo/mozo/panel/[slug]/pedidos/payment-timing-static-contract.test.ts (nuevo)
```

Confirmado por `git status --short` filtrado: sin tocar `prisma/**`,
`src/app/api/pedidos/**`, `src/components/cart/**`, push, realtime,
Service Worker, manifest, branding, `mesa-cuenta-dialog.tsx`, ni ningún
archivo de la autoridad de cierre de T46.

## 12. Commit / Push / Deploy

```text
P2_T46_R2_COMMIT_SHA=55187a66f253e377df27f36a416f31cbd73642e0
PUSH_TARGET=origin/testing-codex
PUSH_STATUS=SUCCESS
TESTING_DEPLOY_ID=d458fc4f-9064-46e2-8851-f36f3f21fe20
TESTING_DEPLOY_SERVICE=DeliGO Copy
TESTING_DEPLOY_STATUS=SUCCESS
TESTING_DEPLOY_COMMIT=55187a66f253e377df27f36a416f31cbd73642e0
DEPLOY_COMMIT_MATCH=SI
```

Logs de arranque limpios: `33 migrations found`, `No pending migrations
to apply` (confirma cero cambio de schema), `Ready in 101ms`, sin
excepciones ni 500 en boot. `origin/main` reconfirmado sin cambios
(`ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763`) antes y después del deploy.

## 13. Estado final

```text
P2_T46_R2_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_PHYSICAL_CERTIFICATION
P2_T50_STATUS_UNCHANGED=CLOSED_TESTING_CERTIFIED
P2_T55_STATUS_UNCHANGED=READY_FUTURE
P2_T49_STATUS_UNCHANGED=CLOSED_TESTING_CERTIFIED
P2_T44_STATUS_UNCHANGED=PAUSED_UNRESOLVED_AFTER_TIMEBOX
PRODUCTION_TOUCHED=NO
PRODUCTION_LIKELY_AFFECTED_BY_SAME_GAP=SI (verificado read-only vía
  `git show origin/main:...page.tsx`; requiere su propia autorización
  explícita de Production en una tarea futura — no promovido acá)
T39_TOUCHED=NO
```

**Sobre P2-T47**: el operador confirmó evidencia física acumulada
completa —

```text
P2_T47_R2_OPERATOR_RESULT=ALL_CASES_PASS
P2_T47_R2_CASE_A=PASS
P2_T47_R2_CASE_B=PASS
P2_T47_R2_CASE_C=PASS
P2_T47_R2_CASE_D=PASS
P2_T47_R2_CASE_E=PASS
P2_T47_R2_CASE_F=PASS
P2_T47_R2_CASE_G=PASS
P2_T47_R2_CASE_H=PASS
P2_T47_R2_CASE_I=PASS
P2_T47_R2_CASE_J=PASS
P2_T47_R2_CASE_K=PASS
P2_T47_PHYSICAL_CERTIFICATION=PASS
```

El finding de pago NO bloquea T47 — no fue introducido por T47 (T47 sólo
tocó `ProductConfigurator`/`ProductDetailSheet`/catálogo de categorías;
el selector de pago del carrito ya existía antes de T47) y pertenece
explícitamente a la autoridad de T46. El código de este fix (T46-R2) se
registra como una corrección separada de T46, nunca mezclado con el
scope conceptual de T47. El closeout formal de T47 (con este dato de
certificación física) se hace en una tarea de cierre dedicada, no acá.

**Sobre P2-T46**: este gap de cobertura fue descubierto DESPUÉS del
checkpoint original de T46 (`P2_T46_R4_CURATED_PRODUCTION_PROMOTION.md`
y los reportes de certificación previos permanecen sin editar — no se
reescribe ni se falsifica esa historia). Se registra esta ronda
correctiva (R2) como una extensión documental de la autoridad de T46,
no como un nuevo backlog item — no se crea ningún `P2-Txx` nuevo.
`P2_T46_R2_STATUS` NO se declara `CLOSED_PRODUCTION` todavía: el gap
requiere su propia certificación física antes de considerarse cerrado.
