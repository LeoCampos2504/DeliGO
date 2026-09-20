# P2-T51-R1 — DeliGO Operaciones Home Visual Redesign: implementación + tests + deploy TESTING

Fecha: 2026-09-20
Alcance: DISEÑO VISUAL ÚNICAMENTE (Option A). Sin cambio de rutas, copy,
auth/sesión, API, DB, schema, migración, manifest/PWA/push. Sin
Production, sin prueba física por Claude.

## 1. Preflight

```text
WORKTREE_PATH=C:/Leo Campos/Trabajo/deligo-main-limpio
BRANCH=work/p2-t43-r2
START_HEAD_SHA=9c4b9d23aeada24d3a665c7e7b7e813323f7f3e1 (== origin/testing-codex)
DIRTY_BEFORE=SI (2 archivos documentales pre-existentes de esta misma
  sesión, ajenos a este task)
PRODUCT_CODE_DIRTY_AJENO=NO
```

Worktree T39 no tocado. `origin/main` reconfirmado en
`ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763` antes y después del deploy —
Production sin cambios.

## 2. Autoridad y opción implementada

```text
AUTHORITY=codex-reports/P2_T51_A0_OPERATIONS_HOME_VISUAL_REDESIGN_AUDIT_DESIGN.md
DESIGN_OPTION_IMPLEMENTED=OPTION_A (refinamiento del Card único existente)
```

Se implementó exactamente lo diseñado en A0 — sin desviaciones de
diseño ni de alcance.

## 3. Archivos modificados/creados

```text
src/app/operaciones/page.tsx        (modificado — sólo className/colores)
src/app/operaciones/page.test.tsx   (nuevo — contrato estático)
```

Ningún otro archivo de producto tocado. Confirmado explícitamente sin
tocar: `src/app/operaciones/layout.tsx`, `src/app/operaciones/ingresar/page.tsx`,
`src/app/operaciones/terminal/page.tsx`, `src/app/operaciones/activar/page.tsx`.

```text
PRODUCT_FILES_CHANGED=1
TEST_FILES_CHANGED=1
```

## 4. Cambios exactos en `page.tsx`

- **Fondo**: `main` pasa a `relative overflow-hidden`, con 2 blurs
  decorativos absolutos (`pointer-events-none`) — uno `bg-amber-400/10`
  arriba-derecha, uno `bg-slate-400/10` abajo-izquierda — mismo patrón
  ya usado en `/operaciones/ingresar`.
- **Card**: `shadow-sm` → `shadow-lg shadow-black/5 dark:shadow-black/20`,
  se agrega `relative` para quedar por encima de la decoración.
  `max-w-md`, `rounded-2xl`, `border-border/60` preservados sin cambio.
- **Identidad**: `<Logo size="sm" />`, título "DeliGO Operaciones" y
  subtítulo "Elegí cómo querés entrar." — **sin cambio de un solo
  carácter**.
- **Opción Personal**: badge `bg-amber-100 text-amber-700
  dark:bg-amber-950/40 dark:text-amber-300` (antes: `bg-muted
  text-foreground`, neutro). Hover `hover:border-amber-400/40
  hover:shadow-md` (antes: `hover:border-primary/40`). `href`, ícono
  (`UserRound`), título y descripción — **sin cambio**.
- **Opción Terminal**: badge `bg-slate-100 text-slate-700
  dark:bg-slate-800/60 dark:text-slate-300` (nuevo, fijo — nunca
  `negocio.colorPrincipal`). Hover `hover:border-slate-400/40
  hover:shadow-md`. `href`, ícono (`Monitor`), título y descripción —
  **sin cambio**.
- **Refactor de markup**: se extrajo un helper local `EntryOptionCard`
  (mismo archivo, no cross-file) para no duplicar el markup entre las
  dos opciones — reduce ~40 líneas de duplicación. `ChevronRight` sigue
  siendo puramente decorativo dentro de la fila clickable completa
  (nunca un botón/target separado). `focus-visible:ring-2
  focus-visible:ring-ring` preservado en el `Link` exterior. `<nav
  aria-label="Modo de acceso">` preservado sin cambio.

```text
COPY_CHANGED=NO
NEW_LINKS_ADDED=NO
PERSONAL_ROUTE_CHANGED=NO
TERMINAL_ROUTE_CHANGED=NO
PERSONAL_AMBER_ACCENT_IMPLEMENTED=SI
TERMINAL_SLATE_ACCENT_IMPLEMENTED=SI
BACKGROUND_DECORATION_IMPLEMENTED=SI
CARD_SHADOW_REFINED=SI
LOCAL_ENTRY_OPTION_HELPER_USED=SI
```

## 5. Auth / sesión — verificado sin tocar

```text
HOME_SESSION_READ_ADDED=NO
```

El archivo sigue siendo un server component puro: sin `"use client"`,
sin `useEffect`, sin `fetch`, sin importar `@/lib/auth`,
`@/lib/operaciones-terminal-auth`, `next/headers` ni referenciar las
cookies `deligo_operativo_session`/`deligo_operaciones_terminal` —
verificado tanto por lectura manual del diff como por el test I (§7).
La ruta `/operaciones` sigue apareciendo como `○` (estática) en el
output de `bun run build`, confirmando que no se introdujo ninguna
dependencia dinámica de request/sesión.

## 6. T52 / T38 / Push — confirmado sin tocar

```text
T52_SCOPE_TOUCHED=NO (sin manifest, DynamicManifest, /mozo, SW, iconos PWA)
T38_SCOPE_TOUCHED=NO (sin install prompt, tutorial iOS, standalone detection)
PUSH_SCOPE_TOUCHED=NO (sin push.ts, subscriptions, SW, permisos, re-enrollment)
```

## 7. Tests

Nuevo archivo `src/app/operaciones/page.test.tsx` — contrato ESTÁTICO
sobre el source del archivo (no renderizado con DOM): `page.tsx` es un
server component puro que compone `<Link>` de `next/link`
(prefetch vía `IntersectionObserver`, sin contexto de App Router
disponible fuera de Next) — mismo patrón de "contrato estático puro" ya
aceptado en T45/T47/T49/T50, extendido acá a un chequeo de fuente en
vez de lógica pura, siguiendo la salida explícita que el propio task
spec de R1 ofrecía (§23: *"o un contrato estático equivalente si
renderizar un Server Component puro con el setup actual resulta
innecesariamente complejo"*).

```text
FOCAL_TESTS=17 PASS / 0 FAIL

Cobertura exacta (A-N del task spec + 3 adicionales):
A. "Ingresar con mi cuenta" presente
B. "Usar o activar esta terminal" presente
C. href personal exacto /operaciones/ingresar
D. href terminal exacto /operaciones/terminal
E. descripción personal exacta
F. descripción terminal exacta
G. exactamente 2 opciones (2 EntryOptionCard, 2 href de destino)
H. sin link a /mozo
I. sin import/referencia de auth/session/cookies/hooks de cliente
J. accent amber presente en Personal
K. accent slate presente en Terminal
L. clases dark: presentes para ambos accents
M. nav aria-label="Modo de acceso" preservado
N. Logo y textos principales preservados
+ focus-visible preservado
+ ChevronRight sigue siendo decorativo (no botón separado)
+ accent es className estático, nunca style dinámico

OPERATIONS_ENTRY_REGRESSION_TESTS=NONE_EXIST (no existen tests previos
  para /operaciones/ingresar, /operaciones/terminal ni /operaciones/activar
  — ninguno de esos archivos fue tocado en esta ronda, así que no hay
  regresión que verificar en ellos)
```

## 8. Quality gate

```text
TSC_TOTAL_ERRORS=31
TSC_BASELINE_ERRORS=31
TSC_NEW_ERRORS=0
ESLINT=PASS (0 warnings/errors en los 2 archivos tocados/creados)
BUILD=PASS (/operaciones sigue prerenderizada como ○ estática)
DIFF_CHECK=PASS
```

## 9. Prevalidación técnica/visual (Browser pane — NO certificación física)

Verificado en el dev server local (`bun x next dev`, puerto 3901) vía
Browser pane, antes de commit/deploy:

```text
DESKTOP (≥1280px): selector centrado, compacto, max-w-md; accent amber
  y slate claramente distintos entre sí; blurs de fondo sutiles, no
  interfieren con el contenido; shadow-lg visible pero sutil.
MOBILE 375px: sin overflow, título/descripción de Terminal envuelven a
  2 líneas correctamente sin corte, chevron visible, Card completo
  dentro del viewport.
MOBILE 320px: sin overflow horizontal — verificado
  scrollWidth===clientWidth===320 vía JS.
DARK MODE: verificado forzando `localStorage.setItem('deligo-theme',
  'dark')` (el ThemeProvider del repo usa su propio storage key,
  no `prefers-color-scheme` directo) — ambos accents (amber-950/40 +
  amber-300, slate-800/60 + slate-300) legibles sobre fondo oscuro,
  sin colores hardcodeados rompiendo el tema.
CONSOLE: sin errores (read_console_messages onlyErrors=true → vacío).
ROUTES: confirmado en el DOM real, los 2 <a> dentro de <nav> apuntan
  exactamente a /operaciones/ingresar y /operaciones/terminal.
```

No se declara ninguna certificación física del operador — esto es
prevalidación técnica de Claude únicamente, per §27 del task spec.

## 10. Commit / push / deploy

```text
P2_T51_R1_COMMIT_SHA=c713650708855c5bd40efede3674b48581c65a11
COMMIT_PARENT=9c4b9d23aeada24d3a665c7e7b7e813323f7f3e1 (== origin/testing-codex antes del push)
PUSH_TARGET=origin/testing-codex
PUSH_STATUS=FAST_FORWARD (9c4b9d2..c713650)

TESTING_SERVICE=DeliGO Copy
TESTING_DEPLOY_ID=f31a69d8-2dbe-4929-9870-f616db9454fb
TESTING_DEPLOY_STATUS=SUCCESS
TESTING_DEPLOY_COMMIT=c713650708855c5bd40efede3674b48581c65a11
DEPLOY_COMMIT_MATCH=SI
BOOT_LOGS_CLEAN=SI (sin errores/excepciones; "No pending migrations to
  apply" coherente con SCHEMA_CHANGED=NO; servidor "Ready" normal)

PRODUCTION_TOUCHED=NO (origin/main sin cambios: ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763)
```

## 11. Certificación física futura (R2) — preparada, NO ejecutada

```text
R2_CASE_A_READY=SI — /operaciones desktop
R2_CASE_B_READY=SI — /operaciones mobile
R2_CASE_C_READY=SI — Cuenta personal, accent amber claro y distinto
R2_CASE_D_READY=SI — Terminal, accent slate claro y distinto
R2_CASE_E_READY=SI — tap Cuenta personal → /operaciones/ingresar
R2_CASE_F_READY=SI — Volver → /operaciones
R2_CASE_G_READY=SI — tap Terminal → /operaciones/terminal (o redirect
  preexistente a /operaciones/activar si no hay terminal válida)
R2_CASE_H_READY=SI — dark mode, ambas opciones legibles
R2_CASE_I_READY=SI — 320px sin overflow horizontal ni texto cortado
R2_CASE_J_READY=CONDICIONAL — PWA Operaciones instalada, sólo si el
  operador ya la tiene disponible
```

## 12. Estados preservados sin cambio

```text
P2_T55_STATUS_UNCHANGED=CLOSED_TESTING_CERTIFIED
P2_T50_STATUS_UNCHANGED=CLOSED_TESTING_CERTIFIED
P2_T49_STATUS_UNCHANGED=CLOSED_TESTING_CERTIFIED
P2_T47_STATUS_UNCHANGED=CLOSED_TESTING_CERTIFIED
P2_T45_STATUS_UNCHANGED=CLOSED_TESTING_CERTIFIED
P2_T43_STATUS_UNCHANGED=CLOSED_TESTING_CERTIFIED
P2_T44_STATUS_UNCHANGED=PAUSED_UNRESOLVED_AFTER_TIMEBOX
P2_T46_ORIGINAL_STATUS_UNCHANGED=CLOSED_PRODUCTION
P2_T46_R2_STATUS_UNCHANGED=CLOSED_TESTING_CERTIFIED_AWAITING_PRODUCTION_PROMOTION
CLIENT_MESA_SILENT_DEFAULT_PAYMENT_FINDING_UNCHANGED=OPEN
T39_TOUCHED=NO
```

## 13. Estado final de esta ronda

```text
P2_T51_R1_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_R2_PHYSICAL_CERTIFICATION
P2_T51_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_R2_PHYSICAL_CERTIFICATION
NEXT_ACTION=Operador certifica físicamente /operaciones en TESTING
  (desktop + mobile 320/360/390px + dark mode + tap de ambas opciones)
  antes de cualquier cierre final o promoción.
```

## 14. Cierre de esta ronda

```text
PRODUCT_FILES_CHANGED=1
TEST_FILES_CHANGED=1
AUTH_CHANGED=NO
PERMISSIONS_CHANGED=NO
API_CHANGED=NO
DB_MUTATED=NO
SCHEMA_CHANGED=NO
MIGRATION_CREATED=NO
MANIFEST_CHANGED=NO
SERVICE_WORKER_CHANGED=NO
PUSH_CHANGED=NO
PHYSICAL_CERTIFICATION_BY_CLAUDE=NO
PRODUCTION_TOUCHED=NO
P2_T52_STARTED=NO
P2_T38_STARTED=NO
P2_T40_STARTED=NO
P2_T39_STARTED=NO
```
