# P2-T52-R1B — Disable Legacy Employee / Salon PWA Install Promotion

Fecha: 2026-09-20
Alcance: IMPLEMENTACIÓN MÍNIMA (Option A de A2). Sin borrado de ruta/
manifest/asset, sin cambio de role-config/DynamicManifest/service
worker/push/auth/sesión/DB/schema/migración. Sin Production.

## 1. Preflight

```text
WORKTREE_PATH=C:/Leo Campos/Trabajo/deligo-main-limpio
BRANCH=work/p2-t43-r2
START_HEAD_SHA=1e5ad4b6879eec67cde1dbdb2af8d60274678586 (== origin/testing-codex)
DIRTY_BEFORE=SI (2 archivos documentales pre-existentes + next-env.d.ts,
  artefacto auto-generado por `next dev` — ninguno es código de
  producto ajeno)
PRODUCT_CODE_DIRTY_AJENO=NO
```

Worktree T39 no tocado. `origin/main` en lectura únicamente:
`ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763`, sin cambios.

## 2. Autoridad y opción implementada

```text
AUTHORITY=codex-reports/P2_T52_A2_EMPLOYEE_SALON_LEGACY_PWA_ARTIFACT_AUDIT.md
OPTION_IMPLEMENTED=OPTION_A (compatibility tombstone + stop new installability)
```

## 3. Archivos modificados/creados

```text
src/components/shared/install-prompt.tsx        (modificado)
src/components/shared/install-prompt.test.ts    (nuevo)
```

```text
PRODUCT_FILES_CHANGED=1
TEST_FILES_CHANGED=1
```

## 4. Cambio exacto

Se agregó una segunda condición de exclusión temprana en
`InstallPrompt()`, junto a la ya existente `isMozoRoute()`:

```tsx
export function InstallPrompt() {
  const pathname = usePathname()
  if (isMozoRoute(pathname)) return null
  if (isLegacyOperationsTombstoneRoute(pathname)) return null
  return <InstallPromptInner pathname={pathname} />
}

export function isLegacyOperationsTombstoneRoute(pathname: string) {
  return (
    pathname === "/e" ||
    pathname.startsWith("/e/") ||
    pathname === "/s" ||
    pathname.startsWith("/s/")
  )
}
```

`isMozoRoute()` se dejó exactamente igual, sólo se exportó (antes era
privada del módulo) para permitir el contrato de test puro sin montar
el componente completo. Ambas funciones son independientes — `/mozo`
sigue excluido por su propia razón (flujo funcional real, no
tombstone), documentado explícitamente en un comentario para no
confundir ambos casos en el futuro.

```text
INSTALL_PROMPT_DISABLED_ON_EMPLOYEE_LEGACY_ROUTES=SI
INSTALL_PROMPT_DISABLED_ON_SALON_LEGACY_ROUTES=SI
```

## 5. Preservación confirmada — nada más se tocó

```text
LEGACY_TOMBSTONE_ROUTES_CHANGED=NO (src/app/e/page.tsx,
  src/app/e/[token]/page.tsx, src/app/s/page.tsx,
  src/app/s/[token]/page.tsx, src/components/legacy/legacy-access-retired.tsx
  — ningún byte tocado)
ROLE_CONFIG_CHANGED=NO (src/lib/role-config.ts intacto)
DYNAMIC_MANIFEST_CHANGED=NO (src/components/shared/dynamic-manifest.tsx intacto)
EMPLOYEE_MANIFEST_DELETED=NO (public/manifest-empleado.json intacto)
SALON_MANIFEST_DELETED=NO (public/manifest-salon.json intacto)
PWA_ASSETS_DELETED=0 (ningún PNG tocado ni borrado)
PUSH_CHANGED=NO (src/lib/push.ts, mesa-order-ready-notification.ts intactos)
SERVICE_WORKER_CHANGED=NO (public/sw.js intacto)
MOZO_SCOPE_TOUCHED=NO (/mozo, manifest-mozo.json, icon-mozo-*, push/SW de
  Mozo — cero cambios)
T38_FUNCTIONAL_SCOPE_TOUCHED=NO (no se agregó ningún estado/UX de
  instalación nuevo — sólo la condición de exclusión de ruta)
LEGACY_COMPAT_LINKS_CHANGED=NO (los 3 botones de LegacyAccessRetired —
  /operaciones/ingresar, /operaciones/registro, / — verificados sin
  cambio, ver §8)
```

## 6. Regresión tombstones — verificado

```text
EMPLOYEE_LEGACY_TOMBSTONE=PASS (src/app/e/page.tsx y
  src/app/e/[token]/page.tsx siguen renderizando exclusivamente
  <LegacyAccessRetired label="E" .../>, confirmado por lectura directa,
  sin diff)
SALON_LEGACY_TOMBSTONE=PASS (mismo patrón exacto para /s)
```

## 7. Tests

Nuevo archivo `src/components/shared/install-prompt.test.ts` —
contrato puro sobre las dos funciones de clasificación de ruta
(`isLegacyOperationsTombstoneRoute`, `isMozoRoute`), exportadas
explícitamente para este propósito. No se renderiza el componente
completo (`InstallPromptInner` depende de `framer-motion` y de los
hooks de instalación del navegador vía `useInstallPrompt()`, sin
harness real disponible en este entorno) — mismo criterio de "extraer
sólo la función pura si mejora testabilidad" indicado por el propio
task spec.

```text
FOCAL_TESTS=13 PASS / 0 FAIL

Cobertura exacta (A-J del task spec + 3 adicionales):
A. /e (bare) → excluido
B. /e/abc → excluido
C. /s (bare) → excluido
D. /s/abc → excluido
E. /mozo → excluido (regresión, regla preexistente intacta)
F. /mozo/panel/test → excluido (regresión, regla preexistente intacta)
G. /operaciones → NO excluido por esta regla
H. /cliente → NO excluido por esta regla
I. /negocio → NO excluido por esta regla
J. /repartidor → NO excluido por esta regla
+ /mozo no queda excluido por isLegacyOperationsTombstoneRoute (reglas
  independientes)
+ /e y /s no quedan excluidos por isMozoRoute (reglas independientes)
+ sin match parcial engañoso (/empleados, /salones → NO excluidos)

INSTALL_PROMPT_REGRESSION_TESTS=14 PASS / 0 FAIL
  (src/lib/android-install-status-static-contract.test.ts — única
  suite existente relacionada con InstallPrompt, ejecutada sin
  modificar, sin regresión)
```

## 8. Quality gate

```text
TSC_TOTAL_ERRORS=31
TSC_BASELINE_ERRORS=31
TSC_NEW_ERRORS=0
ESLINT=PASS (0 warnings/errors en los 2 archivos tocados/creados)
BUILD=PASS
DIFF_CHECK=PASS
```

## 9. Prevalidación técnica en Browser pane (NO certificación física)

Verificado en el dev server local (`bun x next dev`, puerto 3901),
antes de commit/deploy:

```text
/e/test → LegacyAccessRetired visible ("E", "Este acceso fue
  reemplazado", 3 botones: Ir a DeliGO Operaciones / Crear cuenta /
  Volver al inicio) — sin ningún banner/FAB de instalación en pantalla
  (confirmado por captura completa). manifest-empleado.json y
  theme-color #0891B2 siguen inyectándose correctamente por
  DynamicManifest (sin tocar, funcionando como antes).
/s/test → mismo patrón exacto, badge "S", sin banner de instalación.
/operaciones → home de T51 intacto (accent amber/slate preservados,
  sin regresión visual).
/mozo → comportamiento preexistente intacto: sin sesión, muestra
  "Ingresa para continuar" con botones de login/registro — igual que
  antes del cambio.
CONSOLE: los únicos errores observados (401 en /api/operativo/me y
  /api/auth/me — esperado, sin sesión; 500 en /api/negocios/*;
  WebSocket HMR del dev server) son limitaciones preexistentes del
  sandbox local (sin DATABASE_URL alcanzable), no relacionadas con
  este cambio — confirmado cruzando los endpoints reales vía
  read_network_requests.
```

No se declara ninguna certificación física del operador — esto es
prevalidación técnica de Claude únicamente.

## 10. Commit / push / deploy

```text
P2_T52_R1B_COMMIT_SHA=5f4804c0d903475ca1949bd5428145a80ca6dc15
COMMIT_PARENT=1e5ad4b6879eec67cde1dbdb2af8d60274678586 (== origin/testing-codex antes del push)
PUSH_TARGET=origin/testing-codex
PUSH_STATUS=FAST_FORWARD (1e5ad4b..5f4804c)

TESTING_SERVICE=DeliGO Copy
TESTING_DEPLOY_ID=2aae4685-8c1a-4e04-815d-ae3197682724
TESTING_DEPLOY_STATUS=SUCCESS
TESTING_DEPLOY_COMMIT=5f4804c0d903475ca1949bd5428145a80ca6dc15
DEPLOY_COMMIT_MATCH=SI
BOOT_LOGS_CLEAN=SI (sin errores/excepciones; "No pending migrations to
  apply" coherente con SCHEMA_CHANGED=NO; servidor "Ready" normal)

PRODUCTION_TOUCHED=NO (origin/main sin cambios: ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763)
```

## 11. Certificación física futura — preparada, NO ejecutada

```text
CASE_A_READY=SI — /e/test: LegacyAccessRetired visible, sin oferta de
  instalación PWA Empleado
CASE_B_READY=SI — /s/test: LegacyAccessRetired visible, sin oferta de
  instalación PWA Salón
CASE_C_READY=SI — /operaciones: home T51 intacto
CASE_D_READY=SI — /mozo: compatibilidad intacta
CASE_E_READY=CONDICIONAL_NOT_AVAILABLE — no existe hoy un dispositivo
  con PWA "DeliGO Empleados"/"DeliGO Salón" ya instalada disponible
  para el operador; no se inventa un PASS
```

## 12. Estados preservados sin cambio

```text
P2_T51_STATUS=CLOSED_TESTING_CERTIFIED
P2_T55_STATUS=CLOSED_TESTING_CERTIFIED
P2_T50_STATUS=CLOSED_TESTING_CERTIFIED
P2_T49_STATUS=CLOSED_TESTING_CERTIFIED
P2_T47_STATUS=CLOSED_TESTING_CERTIFIED
P2_T45_STATUS=CLOSED_TESTING_CERTIFIED
P2_T43_STATUS=CLOSED_TESTING_CERTIFIED
P2_T44_STATUS=PAUSED_UNRESOLVED_AFTER_TIMEBOX
P2_T46_ORIGINAL_STATUS=CLOSED_PRODUCTION
P2_T46_R2_STATUS=CLOSED_TESTING_CERTIFIED_AWAITING_PRODUCTION_PROMOTION
CLIENT_MESA_SILENT_DEFAULT_PAYMENT_FINDING=OPEN
T39_TOUCHED=NO
```

## 13. Estado final de esta ronda

```text
P2_T52_R1B_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_OPERATOR_CERTIFICATION
P2_T52_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_OPERATOR_CERTIFICATION
NEXT_ACTION=Operador certifica físicamente /e y /s en TESTING (sin
  banner de instalación, tombstone intacto) — y, si tiene disponible
  un dispositivo con "DeliGO Empleados"/"DeliGO Salón" ya instalada,
  confirma que sigue abriendo el tombstone sin romperse (Case E,
  condicional). No cerrar T52 formalmente hasta esa confirmación.
```

## 14. Cierre de esta ronda

```text
PRODUCT_FILES_CHANGED=1
TEST_FILES_CHANGED=1
ROLE_CONFIG_CHANGED=NO
DYNAMIC_MANIFEST_CHANGED=NO
MANIFEST_FILES_DELETED=0
PWA_ASSETS_DELETED=0
PUSH_CHANGED=NO
SERVICE_WORKER_CHANGED=NO
AUTH_CHANGED=NO
SESSION_CHANGED=NO
DB_MUTATED=NO
SCHEMA_CHANGED=NO
MIGRATION_CREATED=NO
MOZO_SCOPE_TOUCHED=NO
PHYSICAL_CERTIFICATION_BY_CLAUDE=NO
PRODUCTION_TOUCHED=NO
P2_T38_STARTED=NO
P2_T40_STARTED=NO
P2_T44_TOUCHED=NO
```
