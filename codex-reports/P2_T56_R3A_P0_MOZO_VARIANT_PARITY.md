# P2-T56-R3A-P0 — Paridad de variantes en pedidos manuales de Mozo

Fecha: 2026-10-01. Branch: `work/p2-t56-r3-stock-lifecycle`.
Autoridad arquitectónica: `codex-reports/P2_T56_R3A_ORDER_STOCK_LIFECYCLE_DESIGN.md`
§ A0.1-14 (`R3A_P0_SCOPE`). Esta ronda implementa **sólo P0**: no
implementa ReservaStock, ni el lifecycle de stock, ni I1–I5.

## 1. Preflight

```text
CURRENT_BRANCH=work/p2-t56-r3-stock-lifecycle
LOCAL_HEAD_BEFORE=4f38992921715fe2499bd8f973b154c04d67e394 (A0.1)
R3A_A0_COMMIT=238ccade48dd686fb3d607a6100c98eea63aa59a
REMOTE_TESTING_CODEX_BEFORE=1e14355c617cad33ab33c3fdda508c6a93830f4e (git fetch + rev-parse; sin drift)
REMOTE_R3A_HEAD_BEFORE=4f38992921715fe2499bd8f973b154c04d67e394 (git ls-remote — el clone sólo trackea main/testing-codex)
TRACKED_WORKTREE_CLEAN=YES
STAGED_FILES=0
STASH_COUNT=0
```

## 2. Baseline untracked

```text
PRE_TASK_UNTRACKED_BASELINE=26737 (idéntico, archivo por archivo, al baseline auditado el 2026-10-01:
  .next-r5-7-* 26282 · codex-reports 435 · root 6 · branding-source 5 · public 4 · .claude 4 ·
  prisma/migrations/migration_lock.toml 1)
KNOWN_UNTRACKED_BASELINE_PRESENT=YES
NEW_HIGH_RISK_UNTRACKED_FILES=0
```

No se abrió, borró ni stageó nada del baseline. Ver §13 para el estado posterior.

## 3. Arquitectura previa (auditada read-only)

```text
MOZO_ORDER_UI=src/app/mozo/panel/[slug]/pedido/[mesaId]/page.tsx (MozoPedidoManualPage +
  ProductConfigurator + CartLine); re-export literal en
  src/app/operaciones/mi-panel/[slug]/pedido/[mesaId]/page.tsx (sin cambios)
MOZO_PRODUCTS_GET=GET /api/operativo/mozo/panel/[slug]/pedidos (mismo route.ts que el POST) —
  productos del negocio de la sesión (negocioId=auth.negocio.id, eliminado=false, stock=true);
  NO devolvía variantes
MOZO_ORDER_POST=POST /api/operativo/mozo/panel/[slug]/pedidos — tx Serializable +
  withSerializableRetry; precio = calculateEffectiveProductPrice(Producto base) para TODO
  producto (incluido uno con variantes → precio base "dormido"); no persistía
  productoVarianteId/varianteNombre
EXISTING_CLIENT_VARIANT_UI_AUTHORITY=src/app/n/[slug]/page.tsx (selector "Elegí una opción") +
  helpers puros src/lib/client-product-variants.ts (isVarianteDisponible,
  isProductoConVariantesDisponible, precioDesdeVariantes, resolveSingleActiveVariant)
EXISTING_CLIENT_VARIANT_SERVER_AUTHORITY=POST /api/pedidos (src/app/api/pedidos/route.ts:976-996,
  inline): variante requerida si el producto tiene >=1 variante (activa o no), buscada SÓLO en
  producto.variantes, activa, no agotada (controlStock && stockCantidad <= 0); varianteId en
  producto sin variantes → rechazo; precio = variante.precio sin descuento base; snapshot
  productoVarianteId + varianteNombre
PEDIDO_ITEM_SCHEMA=prisma/schema.prisma:617-619 — productoVarianteId String?, varianteNombre String?
  (R2C-F2) → R3A_P0_SCHEMA_CHANGE_REQUIRED=NO
```

Nombres reales del repo: el request de Cliente usa `varianteId` por línea; PedidoItem usa
`productoVarianteId` + `varianteNombre`. P0 usa exactamente el mismo contrato
(`MOZO_VARIANT_REQUEST_FIELD=varianteId`), sin aliases.

Opciones del producto existentes en Mozo (auditadas antes de tocar): secciones propias
(con precio), opciones compartidas, agregados, ingredientes quitados, talle, color. Siguen
intactas; la variante es una dimensión propia (`VARIANT_AND_PRODUCT_OPTIONS_LOGIC_MERGED=NO`).

## 4. Archivos cambiados

| Archivo | Clase | Cambio |
|---|---|---|
| `src/app/api/operativo/mozo/panel/[slug]/pedidos/route.ts` | P0_API | GET devuelve `tieneVariantes` + variantes activas mínimas; POST acepta `varianteId`, resuelve la variante server-side, precio de variante, snapshot, fingerprint con variante |
| `src/app/mozo/panel/[slug]/pedido/[mesaId]/page.tsx` | P0_UI | selector de variante, precio de card/configurador, `canAdd`, línea de carrito con variante, `varianteId` en el POST |
| `src/lib/mozo-order-item-key.ts` (nuevo) | P0_HELPER | `buildOrderItemKey` extraído verbatim de page.tsx + `varianteId` |
| `src/lib/mozo-order-item-key.test.ts` (nuevo) | P0_TEST | identidad de línea |
| `src/app/api/operativo/mozo/panel/[slug]/pedidos/route.variantes.test.ts` (nuevo) | P0_TEST | GET/POST con dataset multi-tenant |
| `src/app/mozo/panel/[slug]/pedido/[mesaId]/page.variantes-static-contract.test.ts` (nuevo) | P0_TEST | contrato estático del selector |
| `src/app/api/operativo/mozo/panel/[slug]/pedidos/route.test.ts` | P0_TEST | fixture: `variantes: []` (el route ahora siempre las carga) |
| `codex-reports/P2_T56_R3A_P0_MOZO_VARIANT_PARITY.md` (nuevo), `codex-reports/ROADMAP.md`, `CODEX_REPORT.md`, `DELIGO_FULL_CONTEXT_LATEST.md` | P0_DOCUMENTATION | este reporte + estado |

No se tocó: POST /api/pedidos (Cliente), GET /api/negocios/[slug], la página de Cliente,
`client-product-variants.ts`, schema, migraciones, inventario, Caja.

## 5. Contrato GET (Mozo)

```text
MOZO_GET_VARIANT_FIELDS=id, nombre, precio, controlStock, stockCantidad (sólo variantes activas)
  + tieneVariantes (true si el producto tiene >=1 variante, activa o no)
Nunca: costo, sku, codigoBarras, stockMinimo, activo. Mismo select que GET /api/negocios/[slug]
(Cliente). Variantes cargadas por la relación Producto → sólo de productos del negocio de la
sesión. Producto sin variantes: tieneVariantes=false, variantes=[]; resto de la forma intacta.
```

## 6. Contrato POST (Mozo)

```text
REQUEST: items[].varianteId: string | null | undefined ("" / null / ausente = sin variante;
  no-string → 400 "varianteId invalido")
Por línea, dentro de la tx Serializable existente:
  producto con >=1 variante (activa o no):
    sin varianteId                      → 400 "Debe seleccionar una variante"
    varianteId fuera de producto.variantes (inexistente / de otro producto / de otro negocio)
                                        → 400 "Variante invalida"
    variante inactiva                   → 400 "Variante invalida"
    controlStock && stockCantidad <= 0  → 400 "Variante sin stock"
  producto sin variantes + varianteId   → 400 "Este producto no tiene variantes"
  (mismos mensajes que POST /api/pedidos)
Persistencia: PedidoItem.productoVarianteId = variante.id, PedidoItem.varianteNombre =
  variante.nombre (snapshot), PedidoItem.nombre = nombre del Producto, PedidoItem.precio =
  precio de variante. Cualquier rechazo aborta la tx: ningún Pedido parcial.
Idempotencia: la variante entra al fingerprint SÓLO cuando existe — el fingerprint de líneas
  sin variante es byte-idéntico al previo; misma key + otra variante → 409.
```

## 7. Identidad del carrito

```text
MOZO_CART_IDENTITY=productoId + varianteId + agregados/opciones compartidas + secciones propias +
  ingredientes quitados + talle + color (buildOrderItemKey, src/lib/mozo-order-item-key.ts)
Dos variantes del mismo producto → dos líneas. Misma variante + misma personalización → misma
línea (el carrito suma cantidad, semántica existente sin cambios).
```

## 8. Autoridad de precio

```text
MOZO_VARIANT_PRICE_AUTHORITY=SERVER_DB_PRODUCTO_VARIANTE
Producto con variantes: ProductoVariante.precio leído en la tx, nunca el precio base ni su
descuento. Producto sin variantes: calculateEffectiveProductPrice sin cambios. El body nunca
lleva precio; cualquier campo de precio enviado se ignora (probado).
La UI muestra el precio de la variante elegida (o "Desde $X" / precio único / "Sin stock" en la
card) sólo como estimación.
```

## 9. Stock en P0

```text
P0_STOCK_BEHAVIOR=VARIANT_ZERO_STOCK_GUARD_ONLY_NO_MUTATION
Sólo se lee la regla R2C-F2 (controlStock && stockCantidad <= 0 → rechazo / no seleccionable).
No compara cantidad pedida contra stock, no reserva, no descuenta, no crea MovimientoInventario.
Queda deliberadamente superseded por R3A-I1/I2/I4 (available = max(0, physical − reserved)).
NO_ACTIVE_VARIANTS_BEHAVIOR=producto visible en el menú con "Sin stock" en la card; el
  configurador muestra "Este producto no tiene variantes disponibles." y "Agregar al pedido"
  queda deshabilitado; el POST lo rechaza ("Debe seleccionar una variante" / "Variante
  invalida") — nunca cae al precio base (mismo criterio que Cliente).
```

## 10. Tenant isolation

La variante se resuelve únicamente dentro de `producto.variantes`, y el producto se carga con
`negocioId = auth.negocio.id` (sesión, nunca body). Un `varianteId` de otro negocio nunca está
en esa relación → rechazo. Probado con un dataset de dos negocios: producto de A + variante de
B → 400 sin Pedido; producto de B → 400; el GET de A no lista productos ni variantes de B.

```text
MOZO_VARIANT_TENANT_ISOLATION=PASS (route real contra un db en memoria multi-tenant que replica
  el filtro por negocioId y la relación Producto→variantes; ver §11 sobre la corrida real-DB)
```

## 11. Tests

```text
P0_FOCAL_TESTS=PASS 40/40
  src/lib/mozo-order-item-key.test.ts                                   6 pass / 0 fail
  src/app/api/operativo/mozo/panel/[slug]/pedidos/route.variantes.test.ts 26 pass / 0 fail
  src/app/mozo/panel/[slug]/pedido/[mesaId]/page.variantes-static-contract.test.ts 8 pass / 0 fail
  Cobertura: P0-A, P0-B, P0-C, P0-D (servidor + helper), P0-E, P0-F, P0-G, P0-H, P0-I, P0-J,
  P0-K, P0-L, P0-M, P0-N (incluye renombrar la variante después), P0-O (secciones con precio +
  identidad), variante inexistente, sin variantes activas, idempotencia con variante, stock sin
  mutación, contrato GET (campos mínimos, inactivas ocultas, tenant).
P0_VARIANT_REGRESSION_TESTS=PASS 109/109
  mozo pedidos route.test.ts 8 · payment-timing-static-contract 13 · mozo page.test.ts 29 ·
  negocio-salon-static-contract 26 · client-product-variants.test 14 ·
  client-product-variants-static-contract (Cliente/Mesa) 19
NOT_RUN=tests real-DB de Cliente (pedidos/route.variantes.test.ts, negocios/[slug]/route.test.ts,
  repetir/route.test.ts): requieren la credencial TESTING que sólo se obtiene vía Railway CLI, y
  esta tarea dice "NO Railway". Sus archivos bajo prueba no cambiaron (diff vacío). Por la misma
  razón no se corrió una variante real-DB del test de Mozo.
  (Los 3 tests real-DB de Cliente se ejecutaron después de la integración — ver §18.)
```

## 12. Gates

```text
TYPESCRIPT_TOTAL_ERRORS=33 (node node_modules/typescript/bin/tsc --noEmit; = baseline R3B de 33)
NEW_TYPESCRIPT_ERRORS=0 (ningún error en archivos tocados)
ESLINT_GATE=PASS (eslint sobre los 7 archivos de código/test tocados, exit 0)
BUILD_GATE=PASS (npm run build: prisma generate + next build + copy-standalone-assets, exit 0; ver §15)
DIFF_CHECK=PASS
```

## 13. Untracked post-implementación

```text
POST_TASK_UNTRACKED (después de tests + build, antes del commit)=26742 = baseline 26737 + exactamente
  5 archivos de la tarea (4 de código/test + este reporte), todos incluidos en el commit P0.
  El build sólo escribió en .next/ (ignorado) y node_modules (prisma generate); ningún otro
  untracked nuevo.
NEW_UNTRACKED_TASK_SOURCE_FILES=0 tras el commit
```

## 14. Limitaciones conocidas (explícitas)

```text
RESERVATION_IMPLEMENTED=NO
ORDER_STOCK_LIFECYCLE_IMPLEMENTED=NO
AVAILABLE_STOCK_IMPLEMENTED=NO
R3A_I1_STARTED=NO
R3A_I2_STARTED=NO
```

- El pedido de Mozo con variante NO reserva ni descuenta stock (igual que Cliente hoy).
- La validación de stock es sólo `stockCantidad <= 0`, no por cantidad.
- Hallazgo lateral (no corregido, fuera de scope): el fingerprint de idempotencia de
  POST /api/pedidos (Cliente) no incluye `varianteId` — un replay de la misma key con otra
  variante devolvería el pedido original en vez de 409. P0 sí lo incluye para Mozo.
- Sin smoke manual: pertenece al operador después de la integración a TESTING.

## 15. Build

```text
BUILD_GATE=PASS — npm run build (Next.js 16.1.3 Turbopack): "Compiled successfully", 160/160
  páginas generadas (incluye /mozo/panel/[slug]/pedido/[mesaId] y
  /operaciones/mi-panel/[slug]/pedido/[mesaId]), "[copy-assets] Assets copiados correctamente",
  exit 0.
```

Smoke visual / browser preview no ejecutado: requiere sesión operativa de Mozo y la DB
TESTING (credencial vía Railway, excluida por esta tarea), y la tarea reserva el smoke manual
al operador tras la integración.

## 16. Rollback

Revertir el commit de P0 (`git revert`) restaura el comportamiento previo: sin schema ni datos
nuevos que limpiar; los PedidoItem ya creados con variante conservan su snapshot (columnas
existentes desde R2C-F2).

## 17. Markers al cierre de la implementación (2026-10-01, históricos desde la integración a TESTING — estado current en §18)

```text
MOZO_VARIANT_REQUEST_FIELD=varianteId
MOZO_CART_IDENTITY=productoId + varianteId + agregados + secciones + ingredientesQuitados + talle + color
VARIANT_AND_PRODUCT_OPTIONS_LOGIC_MERGED=NO
MOZO_GET_VARIANT_FIELDS=id, nombre, precio, controlStock, stockCantidad (+ tieneVariantes)
MOZO_VARIANT_PRICE_AUTHORITY=SERVER_DB_PRODUCTO_VARIANTE
P0_STOCK_BEHAVIOR=VARIANT_ZERO_STOCK_GUARD_ONLY_NO_MUTATION
NO_ACTIVE_VARIANTS_BEHAVIOR=VISIBLE_SIN_STOCK_NOT_ADDABLE_SERVER_REJECTS_NO_BASE_PRICE_FALLBACK
R3A_P0_SCHEMA_CHANGE_REQUIRED=NO
MOZO_VARIANT_TENANT_ISOLATION=PASS
UNRELATED_FILES=0
NEW_UNTRACKED_TASK_SOURCE_FILES=0
NEW_TYPESCRIPT_ERRORS=0
ESLINT_GATE=PASS
BUILD_GATE=PASS
DIFF_CHECK=PASS
RESERVATION_IMPLEMENTED=NO
ORDER_STOCK_LIFECYCLE_IMPLEMENTED=NO
AVAILABLE_STOCK_IMPLEMENTED=NO
R3A_I1_STARTED=NO
R3A_I2_STARTED=NO
PRODUCTION_TOUCHED=NO
P2_T56_R3A_P0_STATUS=IMPLEMENTED_TESTED_AWAITING_TESTING_INTEGRATION
NEXT_ACTION=RETURN_TO_OPERATOR_FOR_P0_TESTING_INTEGRATION_AUTHORIZATION
R3A_P0_COMMIT=commit "feat: add variant parity to mozo orders" en work/p2-t56-r3-stock-lifecycle
  (el hash queda registrado en Git y en la respuesta de la ronda; un commit no puede contener
  su propio hash)
```

## 18. Integración a TESTING + deploy + certificación automática (2026-10-01)

Autorizado explícitamente por el operador (fast-forward only, push `testing-codex`,
verificación del autodeploy TESTING). Production / `main` no autorizados ni tocados.

```text
REMOTE_TESTING_CODEX_BEFORE=1e14355c617cad33ab33c3fdda508c6a93830f4e
R3A_REMOTE_HEAD=e7731c7f6cc2a61bda8feb6a746bd909f90245ae
COMMITS_TO_INTEGRATE=5 (238ccad R3A_A0 docs · 4f38992 R3A_A01 docs · 489d55b R3A_P0 código+tests+docs ·
  a72ad4c R3A_P0_DOC_FIX · e7731c7 R3A_P0_DOC_FIX_2) — archivos auditados, UNRELATED_COMMITS=0
FAST_FORWARD_PRECONDITION=YES (merge-base --is-ancestor)
INTEGRATION=git switch testing-codex → git pull --ff-only origin testing-codex (local estaba 179
  commits atrás; ff a 1e14355) → git merge --ff-only e7731c7 (sin merge commit, sin squash,
  sin cherry-pick; los 5 commits preservados)
TESTING_PUSH_STATUS=SUCCESS (1e14355..e7731c7 testing-codex)
REMOTE_TESTING_CODEX_AFTER_INTEGRATION=e7731c7f6cc2a61bda8feb6a746bd909f90245ae
P0_FUNCTIONAL_COMMIT=489d55b342f5ffdc7be6b7bb3ae61750ca755260

TESTING_SERVICE=Railway proyecto amiable-rejoicing · environment TESTING · servicio "DeliGO Copy"
  (dominio deligo-copy-production.up.railway.app — el nombre del dominio es histórico; el
  servicio pertenece al environment TESTING)
TESTING_DEPLOY_TRIGGER=autodeploy Git desde testing-codex (no se ejecutó railway up ni deploy manual)
FUNCTIONAL_DEPLOY_ID=a057f10f-2a27-4872-9d68-809e1402bd63
FUNCTIONAL_DEPLOY_STATUS=SUCCESS (BUILDING → DEPLOYING → SUCCESS, polling finito)
FUNCTIONAL_DEPLOY_BRANCH=testing-codex
FUNCTIONAL_DEPLOY_COMMIT=e7731c7f6cc2a61bda8feb6a746bd909f90245ae
FUNCTIONAL_DEPLOY_COMMIT_MATCH=YES

P0_SCHEMA_CHANGE=NO
P0_MIGRATION_CHANGE=NO (0 archivos bajo prisma/ en 1e14355..e7731c7)
TESTING_MIGRATION_STATUS=UP_TO_DATE — `prisma migrate status` read-only contra TESTING: "Database
  schema is up to date!"; arranque del deploy: "37 migrations found" + "No pending migrations to apply"

MOZO_VARIANT_REAL_DB_TESTS=NOT_AVAILABLE — no existe una suite real-DB del route de Mozo (no se creó en
  P0). Cobertura equivalente: route.variantes.test.ts (26) ejecuta el route REAL contra un db en
  memoria multi-tenant que replica el filtro por negocioId y la relación Producto→variantes.
CLIENT_VARIANT_REAL_DB_REGRESSION=PASS 9/9 (src/app/api/pedidos/route.variantes.test.ts, TESTING Postgres)
PUBLIC_BUSINESS_API_REAL_DB_REGRESSION=PASS 3/3 (src/app/api/negocios/[slug]/route.test.ts, TESTING Postgres)
REPEAT_ORDER_REAL_DB_REGRESSION=PASS 5/5 (src/app/api/cliente/pedidos/[id]/repetir/route.test.ts, TESTING Postgres)
  Credencial TESTING obtenida read-only con `railway variables --service Postgres --environment
  TESTING --kv` (CLI linkeado a TESTING, verificado), usada sólo en memoria; nunca impresa ni persistida.

P0_FOCAL_TESTS_POST_INTEGRATION=PASS 40/40 (sobre testing-codex e7731c7)
P0_REGRESSION_TESTS_POST_INTEGRATION=PASS 109/109 (mismas 6 suites de §11)

POSTDEPLOY_LOGS=PASS — deploy log: prisma migrate deploy sin pendientes, "Next.js 16.1.3 … ✓ Ready in
  136ms"; sin errores, excepciones, errores de Prisma/módulos ni 5xx. Build log remoto: "Compiled
  successfully", 160/160 páginas, sin errores.
HTTP_SMOKE=PASS (sólo GET, ningún pedido creado):
  /                                                   → 307 → /cliente (200)
  /mozo/panel/smoke-slug/pedido/smoke-mesa            → 200 (página renderiza)
  /operaciones/mi-panel/smoke-slug/pedido/smoke-mesa  → 200 (re-export renderiza)
  /api/operativo/mozo/panel/smoke-slug/pedidos (GET)  → 401 {"estado":"sin_sesion"} (sin 5xx)
  /api/negocios/<slug inexistente>                    → 404 {"error":"Negocio no encontrado"} (sin 5xx)
PRODUCTION_CHECK=origin/main 42ca5005d2ecd412de87e454b52820f38aaec5c0 antes y después; deployment
  production/DeliGO 6bf1ee84-702e-41e1-80a8-d075e3ce9362 sin cambios → PRODUCTION_TOUCHED=NO
```

### Certificación manual pendiente (operador, en TESTING, paso a paso)

1. Negocio genérico con un producto con ≥2 variantes activas (una controlada sin stock) y un
   producto simple. Mozo con mesa asignada → abrir "Pedido manual".
2. Card del producto con variantes: muestra "Desde $X" (o el precio único), nunca el precio base.
3. Configurador: grupo "Elegí una opción" (Obligatorio); la variante sin stock se ve deshabilitada
   con "Sin stock"; "Agregar al pedido" deshabilitado hasta elegir una variante.
4. Agregar variante A y luego variante B del mismo producto → dos líneas en el carrito, cada una
   con su badge de variante y su precio; volver a agregar A → suma cantidad en la línea A.
5. Producto simple: se agrega y cobra igual que antes.
6. Confirmar → el pedido aparece en Salón/Negocio con el nombre de la variante y el precio de la
   variante; el stock de la variante NO cambia (P0 no reserva ni descuenta).
7. Producto con opciones/secciones + variante: la opción se cobra sobre el precio de la variante.

### Markers current (post-integración)

```text
P2_T56_R3A_P0_STATUS=DEPLOYED_TESTING_AWAITING_MANUAL_CERTIFICATION
MANUAL_CERTIFICATION=PENDING_OPERATOR
RESERVATION_IMPLEMENTED=NO
ORDER_STOCK_LIFECYCLE_IMPLEMENTED=NO
AVAILABLE_STOCK_IMPLEMENTED=NO
R3A_I1_STARTED=NO
R3A_I2_STARTED=NO
PRODUCTION_TOUCHED=NO
NEXT_ACTION=RETURN_TO_OPERATOR_FOR_ONE_STEP_AT_A_TIME_MANUAL_P0_CERTIFICATION
```

Nota: el commit documental que registra esta sección también se integra a `testing-codex` y
dispara su propio autodeploy (docs-only); su ID/estado se reportan en la respuesta de la ronda,
separados del deploy funcional de arriba.
