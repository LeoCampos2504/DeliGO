# P2-T46-R2 — Cierre final: certificación física en TESTING (corrección de P2-T46)

Fecha: 2026-09-20
Alcance: DOCUMENTACIÓN / RECONCILIACIÓN DE ESTADO ÚNICAMENTE. Sin código
de producto, sin nueva implementación, sin prueba física por Claude, sin
mutación de DB, sin Production.

## 1. Preflight

```text
WORKTREE_PATH=C:/Leo Campos/Trabajo/deligo-main-limpio
BRANCH=work/p2-t43-r2
START_HEAD_SHA=4dc9c323564c01c0cd7842568dd478e08513c3b4
DIRTY_BEFORE=SI (2 archivos documentales pre-existentes de esta misma
  sesión — ninguno ajeno, ninguno de código)
```

Worktree T39 confirmado intacto, no tocado. `origin/main` reconfirmado
en `ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763` — Production sin cambios.

## 2. Línea de implementación certificada

```text
P2_T46_R2_COMMIT_SHA=55187a66f253e377df27f36a416f31cbd73642e0
P2_T46_R2_CERTIFIED_DEPLOY_ID=d458fc4f-9064-46e2-8851-f36f3f21fe20
TESTING_DEPLOY_STATUS=SUCCESS
```

R2 eliminó del flujo de pedido manual de mesa (Mozo/Operaciones
personal, mismo archivo compartido vía re-export literal) el selector
Efectivo/Transferencia, el estado `metodoPago`, y el envío/validación/
persistencia de `metodoPago` en `POST /api/operativo/mozo/panel/[slug]/pedidos` —
ver `codex-reports/P2_T46_R2_MOZO_PAYMENT_TIMING_PARITY.md` para el
detalle completo (auditoría de 7 superficies, cambios exactos de
backend/frontend, evidencia de tests).

## 3. Certificación física del operador

El operador probó físicamente el flujo real: Operaciones personal →
Mozo → mesa → levantar nuevo pedido, y confirmó explícitamente:
*"quedó todo perfecto ya lo probé"*.

```text
P2_T46_R2_PHYSICAL_CERTIFICATION=PASS
MOZO_PAYMENT_SELECTOR_PHYSICAL=PASS (Efectivo/Transferencia NO aparece)
OPERATIONS_PERSONAL_PAYMENT_SELECTOR_PHYSICAL=PASS (mismo componente)

PAYMENT_METHOD_SELECTION_DURING_INDIVIDUAL_TABLE_ORDER=NO
PAYMENT_METHOD_SELECTION_AT_ACCOUNT_CLOSE=SI
```

## 4. Comportamiento certificado

```text
MOZO_PAYMENT_SELECTOR_REMOVED=SI
OPERATIONS_PERSONAL_PAYMENT_SELECTOR_REMOVED=SI
METODO_PAGO_REMOVED_FROM_TABLE_ORDER_REQUEST=SI

TABLE_PAYMENT_AUTHORITY_PRESERVED=SI (SesionOcupacionMesa, sin cambios)
ACCOUNT_CLOSE_PAYMENT_SELECTOR_PRESERVED=SI (mesa-cuenta-dialog.tsx, sin cambios)

DELIVERY_PAYMENT_FLOW_CHANGED=NO
PICKUP_PAYMENT_FLOW_CHANGED=NO
```

Confirmado además — pedido creado normalmente, Notas funcional,
carrito funcional, `ProductConfigurator` de T47 funcional (Badge,
contador, aria-pressed, variante de remoción, `QuantityStepper`
corregido, safe-area, touch targets) — sin regresión entre ambas
correcciones que comparten el mismo archivo.

## 5. Evidencia automatizada preservada

```text
FOCAL_TESTS=21 PASS / 0 FAIL
T47_REGRESSION_TESTS=29 PASS / 0 FAIL
T46_REGRESSION_TESTS=60 PASS / 19 PREEXISTING ENVIRONMENTAL FAIL
  (Environment variable not found: DATABASE_URL — reproducidas
  idénticas vía git stash sobre el código sin el diff de R2, antes de
  restaurar los cambios; no atribuibles a R2)

TSC_TOTAL_ERRORS=31
TSC_BASELINE_ERRORS=31
TSC_NEW_ERRORS=0
ESLINT=PASS
BUILD=PASS
DIFF_CHECK=PASS
```

## 6. P2-T46 original — NO se reescribe la historia

```text
P2_T46_ORIGINAL_STATUS=CLOSED_PRODUCTION (checkpoint histórico de
  T46-R4, 2026-09-11, tag `p2-t46-stable-2026-09-11` — hecho histórico,
  preservado sin editar ni falsificar)
```

Este cierre NO cambia ese registro a FAIL ni lo borra. Se registra la
ronda correctiva por separado:

```text
P2_T46_R2_STATUS=CLOSED_TESTING_CERTIFIED_AWAITING_PRODUCTION_PROMOTION
P2_T46_R2_IMPLEMENTATION_COMPLETE=SI
P2_T46_R2_AUTOMATED_CERTIFICATION=PASS
P2_T46_R2_PHYSICAL_CERTIFICATION=PASS
R2_RELEASE_ELIGIBLE=YES
R2_PRODUCTION_PROMOTED=NO
```

## 7. Production — hallazgo importante, NO accionado

La auditoría read-only de R2 (`git show origin/main:".../page.tsx"`)
confirmó que `origin/main` todavía contiene el flujo viejo de Mozo con
el selector Efectivo/Transferencia — T46 fue promovida a Production en
2026-09-11, antes de que este gap se descubriera físicamente durante
T47.

```text
PRODUCTION_LIKELY_AFFECTED_BY_SAME_GAP=SI
P2_T46_R2_PRODUCTION_FIX_PENDING=SI
```

NO se promueve en esta tarea. NO se toca `main`. NO se toca Railway
Production. La futura promoción debe ser una tarea explícita y curada,
con su propia autorización.

## 8. Hallazgo lateral — Cliente Mesa (abierto, bajo autoridad T46)

Preservado exactamente como se documentó en R2, sin corregir:

```text
CLIENT_MESA_PAYMENT_SELECTOR_VISIBLE=NO (ya estaba oculto,
  cart-panel.tsx:1344, `{!isMesaOrder && <section>…}` — no tocado)
CLIENT_MESA_BACKEND_STILL_REQUIRES_METODO_PAGO=SI (`POST /api/pedidos`
  sigue validando/exigiendo `metodoPago` incluso para
  `metodoEntrega="mesa"`; el frontend envía silenciosamente
  `"efectivo"` sin preguntarle al cliente)
CLIENT_MESA_SILENT_DEFAULT_PAYMENT_FINDING=OPEN
```

No se crea un ID de tarea nuevo para este finding — no existe todavía
una convención de "findings de follow-up" independiente en `ROADMAP.md`
más allá de registrarlo en texto dentro de la entrada de T46 (ver
`ROADMAP.md`, ya actualizado en la ronda R2). NO se corrige en este
cierre.

## 9. Otros estados — preservados sin cambios

```text
P2_T50_STATUS=CLOSED_TESTING_CERTIFIED
P2_T49_STATUS=CLOSED_TESTING_CERTIFIED
P2_T44_STATUS=PAUSED_UNRESOLVED_AFTER_TIMEBOX
P2_T55_STATUS=READY_FUTURE (Salon History Custom Date Filtering — no iniciada)
T39_TOUCHED=NO
```

## 10. Cierre

```text
PRODUCT_FILES_CHANGED_DURING_CLOSEOUT=0
API_FILES_CHANGED_DURING_CLOSEOUT=0
TEST_FILES_CHANGED_DURING_CLOSEOUT=0
SCHEMA_CHANGED=NO
MIGRATION_CREATED=NO
DB_MUTATION=NO
REALTIME_CHANGED=NO
PUSH_CHANGED=NO
PRODUCTION_TOUCHED=NO
```
