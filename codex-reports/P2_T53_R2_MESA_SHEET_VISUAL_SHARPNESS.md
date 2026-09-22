# P2-T53-R2 — Mesa detail sheet visual sharpness

Fecha: 2026-09-14

## Autoridad preservada

P2_T53_R1B_STATUS=CLOSED_OPERATOR_PASS  
R1_PHYSICAL_SAME_SESSION=PASS  
OPERATOR_VISUAL_CONFIRMATION=PASS  
PRODUCTION_TOUCHED=NO

El mensaje de ocupación observado durante una captura anterior queda
clasificado como `EXPECTED_STALE_OPEN_VIEW_AFTER_TEST_FIXTURE_CLEANUP`; no fue
reproducido con una mesa válida y no se reabrió ese bug funcional.

## Preflight

BRANCH_ACTUAL=work/p2-t43-r2  
BASELINE_SHA=d168ddc19baad24cb53e9c4f4cc27f1c7bfb73e6  
PREVIOUS_REMOTE_TESTING_SHA=d168ddc19baad24cb53e9c4f4cc27f1c7bfb73e6  
PRODUCTION_MAIN_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763  
PRODUCTION_TOUCHED=NO

No se cambió de rama porque el worktree contiene numerosos archivos
untracked preexistentes pertenecientes al usuario.

## Alcance y auditoría

MESA_DETAIL_COMPONENT=`MesaDetailDrawer` local de
`src/components/business/salon-tab.tsx`  
MESA_DETAIL_SHEET_PRIMITIVE=`DrawerContent` → `DrawerPrimitive.Content` de
`src/components/ui/drawer.tsx`, basado en Vaul 1.1.2  
MESA_DETAIL_OVERLAY_COMPONENT=`DrawerOverlay` → `DrawerPrimitive.Overlay`

Archivos implicados en el recorrido:

- `src/components/business/salon-tab.tsx`
- `src/components/ui/drawer.tsx`
- `node_modules/vaul/dist/style.css` (evidencia de la dependencia instalada)

OVERLAY_STYLES=`fixed inset-0 z-50 bg-black/50`  
SHEET_CONTENT_STYLES=`ios-keyboard-bottom fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-2xl border bg-background max-h-[85vh]`

El contenido blanco no tiene opacity, filter, blur ni backdrop-filter propios
ni heredados desde el wrapper local. Vaul aplica al drawer
`will-change: transform` y usa `translate3d` para la entrada/salida y el
drag. La animación de apertura es `slideFromBottom`, desde
`translate3d(0,var(--initial-transform,100%),0)` hasta
`translate3d(0,0,0)`; no usa scale. El hint de compositing permanecía en la
capa del drawer después de terminar la animación.

SHEET_USES_TRANSFORM=SI  
SHEET_FINAL_TRANSFORM_PERSISTS=SI (por `will-change: transform` persistente en
la implementación base; el transform final es identidad)  
SHEET_CAN_LAND_ON_FRACTIONAL_PIXEL=SI (runtime observado: `y=304.5` y
`height=613.5` en viewport mobile; no fue seleccionado como causa principal)

SHEET_OPEN_ANIMATION=Vaul `slideFromBottom` con `translate3d`  
SHEET_CLOSE_ANIMATION=transición Vaul de `transform` y desmontaje del drawer  
SHEET_OPEN_ANIMATION_USES_SCALE=NO  
SHEET_OPEN_ANIMATION_USES_TRANSLATE=SI  
SHEET_REMAINS_COMPOSITED_AFTER_ANIMATION=SI (baseline)

SHEET_CONTENT_OPACITY=1  
SHEET_CONTENT_FILTER=none  
SHEET_CONTENT_BACKDROP_FILTER=none  
TYPOGRAPHY_DIFFERENCE_FOUND=NO  
COMPOSITING_DIFFERENCE_FOUND=SI

MESA_SHEET_SOFTNESS_ROOT_CAUSE=B_PERSISTENT_TRANSFORM_COMPOSITING

La evidencia que sustenta la clasificación es el selector global de Vaul
`[data-vaul-drawer] { will-change: transform; }`, aplicado al mismo elemento
que contiene título, textos, botones y controles del detalle. No se encontró
una diferencia tipográfica, una escala residual ni un filtro sobre el panel.

## Fix mínimo

Se agregó únicamente al `DrawerContent` del detalle de mesa:

```tsx
style={{ willChange: "auto" }}
```

Esto retira la promoción compositing persistente de esa hoja, sin modificar la
animación `translate3d`, el drag, dimensiones, layout, colores, spacing,
backdrop ni el primitive compartido globalmente.

FIX_IMPLEMENTED=SI  
FILES_CHANGED=src/components/business/salon-tab.tsx (único archivo de producto)

Runtime posterior al fix, con la hoja abierta:

- mobile: `transform=none`, `willChange=auto`, `opacity=1`, `filter=none`,
  `backdropFilter=none`
- desktop: `transform=none`, `willChange=auto`, `opacity=1`, `filter=none`,
  `backdropFilter=none`

La comparación visual de nitidez queda deliberadamente pendiente del operador;
las comprobaciones mobile/desktop de layout y estilos no encontraron regresión.

## Verificación

TESTS=PASS — 10/10 tests focales P2-T53/MesaOccupancyControl  
LINT=PASS — ESLint focal en `salon-tab.tsx` y `drawer.tsx`  
DIFF_CHECK=PASS  
BUILD=PASS — `bun run build`

MOBILE_VISUAL_REGRESSION=PASS  
DESKTOP_VISUAL_REGRESSION=PASS  
T53_FUNCTIONAL_REGRESSION=PASS

DB_SCHEMA_CHANGED=NO  
PRISMA_MIGRATION_CREATED=NO  
REALTIME_CHANGED=NO

## Git, Testing y fixture

R2_COMMIT_SHA=edcccd543f7bb1f06dc63f21839a4ce492694777  
REMOTE_TESTING_SHA=edcccd543f7bb1f06dc63f21839a4ce492694777  
COMMIT_MESSAGE=`fix: sharpen mesa detail sheet rendering`

DELIGO_TESTING_DEPLOYMENT_ID=79ca6780-93ed-4df1-bf32-1e6c26884a5e  
DELIGO_TESTING_DEPLOYMENT_STATUS=SUCCESS  
DELIGO_TESTING_DEPLOYMENT_COMMIT=edcccd543f7bb1f06dc63f21839a4ce492694777  
TESTING_URL=https://deligo-copy-production.up.railway.app/negocio

Se creó en la base TESTING exclusivamente el fixture visual
`TEST_T53_UI_NEGOCIO_266271C0`, con la mesa 73 `Vista UI`. El login normal de
Negocio, `GET /api/negocio/config` y `GET /api/negocio/mesas` respondieron 200;
la sesión recibió cookie y la mesa fue encontrada. La contraseña temporal se
entregó sólo por runtime al operador y no está en este reporte ni en Git.

TEST_T53_UI_FIXTURE_CREATED=SI  
TEST_T53_UI_FIXTURE_CLEANUP=SI  
TEST_T53_UI_REMAINING_ROWS=0  
OPERATOR_VISUAL_SHARPNESS_CONFIRMATION=PASS

## Estado

P2_T53_R2_STATUS=CLOSED_OPERATOR_PASS  
NEXT_ACTION=RETURN_TO_ACTIVE_BACKLOG

No se tocó Production, no se modificó DB schema/Prisma/API/realtime y no se
iniciaron T24, T54, T02 ni T23.

## R2B — operator visual confirmation and cleanup

OPERATOR_RESULT=mesa detail sheet now appears sharp and visually correct  
OPERATOR_QUOTE=`quedó perfecto, ahora se ve bien`  
MOBILE_VISUAL_SHARPNESS=PASS  
MOBILE_VISUAL_REGRESSION=PASS  
DESKTOP_VISUAL_REGRESSION=PASS  
T53_FUNCTIONAL_REGRESSION=PASS

La confirmación es la observación textual del operador; no se inventa una
observación desktop independiente.

Se eliminó exclusivamente el negocio `TEST_T53_UI_NEGOCIO_266271C0` y la mesa
73 `Vista UI`, después de verificar ownership exacto. La verificación posterior
en la base TESTING no encontró negocios ni mesas con el prefijo del fixture.

TEST_T53_UI_FIXTURE_CLEANUP=SI  
TEST_T53_UI_REMAINING_ROWS=0  
R2_CLOSEOUT_COMMIT_SHA=reported in runtime output; no self-referential SHA

P2_T53_R2_STATUS=CLOSED_OPERATOR_PASS  
P2_T53_R1B_STATUS=CLOSED_OPERATOR_PASS  
DB_SCHEMA_CHANGED=NO  
PRISMA_MIGRATION_CREATED=NO  
REALTIME_CHANGED=NO  
PRODUCTION_TOUCHED=NO
