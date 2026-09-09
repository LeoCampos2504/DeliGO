# DELIGO-BRANDING-R1-PWA-ROLE-ICON-REFRESH — 2026-09-08

## 0. Modo y alcance

AUDIT + LOCAL IMPLEMENTATION + TESTS + LOCAL REVIEW ONLY. Sin commit,
sin push, sin deploy, sin Production, sin mutación de Railway/DB, sin
dependencias nuevas (se usó `sharp`, ya presente en `package.json`), sin
tocar el archivo untracked `32`.

```text
COMMIT_AUTHORIZED=NO
PUSH_AUTHORIZED=NO
TESTING_DEPLOY_AUTHORIZED=NO
PRODUCTION_DEPLOY_AUTHORIZED=NO
```

## 1. Baseline

```text
HEAD=origin/testing-codex=39566e69647fd2b19453721214563a7b9a0ccc5e
origin/main=1de0d3c153eaf3be068adeb004ea43feb42fc40e
```

Verificado fresco antes de cualquier cambio (coincidía exactamente). El
BLOCKER inicial (`ICON_SOURCE_ASSETS_AVAILABLE=NO`) quedó resuelto
cuando el operador colocó los 5 assets fuente en
`C:\Leo Campos\Trabajo\deligo-main-limpio\branding-source\`.

## 2. Assets fuente — integridad

| Archivo | Dimensiones | Formato | Alpha real | Tamaño | sha256 |
|---|---|---|---|---|---|
| `deligo cliente.png` | 1254x1254 | PNG RGBA 8-bit | NO (opaco, alpha=255 en el 100% de los píxeles) | 1,834,913 B | `9730674d...b2` |
| `deligo negocio.png` | 1254x1254 | PNG RGBA 8-bit | NO | 2,069,952 B | `e0a2cbdc...cd` |
| `deligo repartidor.png` | 1254x1254 | PNG RGBA 8-bit | NO | 2,060,292 B | `e8096001...d6` |
| `deligo admin.png` | 1254x1254 | PNG RGBA 8-bit | NO | 2,334,780 B | `57a742f8...b2` |
| `deligo operaciones.png` | 1254x1254 | PNG RGBA 8-bit | NO | 2,040,750 B | `1bac4bfb...75` |

Hallazgo de integridad relevante: aunque los 5 archivos declaran un
canal alfa (`colorType=6`, truecolor+alpha), un escaneo completo
píxel-a-píxel confirmó `minAlpha=255`/`nonOpaquePixels=0` en los 5 —
es decir, son cuadrados 100% opacos con las esquinas redondeadas y la
sombra ya "horneadas" en negro opaco, NO como transparencia real. Esto
es idéntico estructuralmente a los assets legacy que reemplazan
(`icon-{rol}-192x192.png` viejos eran PNG `colorType=2`, truecolor SIN
canal alfa — igual de opacos). No es una regresión introducida por esta
tarea; es la razón técnica exacta detrás de la decisión de §11
(maskable).

No se modificaron los 5 archivos fuente originales — permanecen
intactos en `branding-source/`.

## 3. Auditoría BEFORE

### 3.1 Wiring real (no asumido)

- **`src/lib/role-config.ts`**: fuente de verdad única de
  `manifestFile`/`icon192`/`icon512`/`themeColor` por rol.
- **`src/lib/pwa-identity.ts`**: `PRINCIPAL_PWA_ROLES = ["cliente",
  "negocio", "operaciones", "repartidor"]` — estos 4 emiten su manifest
  + ícono + apple-touch-icon vía `getPwaIdentityMetadata(role)` en el
  `layout.tsx` propio de cada uno (SSR, `icons.icon`/`icons.apple`
  ambos apuntan a `config.icon192` — el mismo archivo para las dos
  cosas, sin una variante Apple dedicada de 180x180).
- **Admin** NO está en `PRINCIPAL_PWA_ROLES` y NO tiene `layout.tsx`
  propio (`src/app/admin/` no tiene ninguno) — su manifest/ícono/
  apple-touch-icon/favicon se actualizan client-side después del mount
  vía `src/components/shared/dynamic-manifest.tsx` (`DynamicManifest`),
  usando el mismo `config.icon192` de `role-config.ts`.
- **Root `src/app/layout.tsx`**: fallback SSR global — `icons.icon`
  incluye `/favicon.ico`, `/icon.svg` y `/icon-cliente-192x192.png`
  explícitamente (comentario del propio archivo explica por qué NO
  hardcodea un manifest: hacerlo rompía el install prompt de
  Negocio/Repartidor/etc.). Esto YA coincide con el target del §8 de la
  tarea ("GLOBAL FALLBACK = ícono Cliente") — no requirió cambio de
  wiring.
- **`public/api/manifest` (`src/app/api/manifest/route.ts`)**:
  redirect legacy por `role` query param — su tabla `STATIC_MANIFEST_
  BY_ROLE` NO incluye `"operaciones"` como clave (cae a `cliente` si se
  pidiera `?role=operaciones`). No se tocó: no hay evidencia de que
  ningún consumidor real use este endpoint con `role=operaciones` (el
  wiring real de Operaciones pasa por `layout.tsx`/`role-config.ts`,
  nunca por este endpoint) — se documenta como hallazgo lateral, no se
  corrige (fuera de alcance de un refresh de branding).
- **`public/sw.js`** (push handler): `icon` se resuelve por `notifType`
  con un `let icon = "/icon-cliente-192x192.png"` por defecto y 3
  ramas explícitas (`salon`, `mozo`/`empleado`, `negocio` vía
  `new_order`/`order_update`/`review`/`account_update`) — **nunca**
  hay una rama para Repartidor ni para Admin ni para Operaciones
  (sus notificaciones, si existen, caen al ícono de Cliente). `badge`
  SIEMPRE reusa el mismo valor que `icon` (`badge: data.badge ||
  icon`) — nunca existió un asset de badge monocromático dedicado.
- **Manifests** (`public/manifest-{role}.json`): Cliente/Negocio/
  Repartidor/Admin ya apuntaban cada uno a su propio
  `icon-{rol}-192x192.png`/`512x512.png` (`purpose: "any"` Y
  `purpose: "maskable"` reusando el MISMO archivo en los 4). **Único
  hallazgo real de wiring roto**: `manifest-operaciones.json` apuntaba
  sus 4 entradas de `icons` a `/icon-negocio-192x192.png`/
  `512x512.png` — Operaciones nunca tuvo un ícono propio, confirmado
  también por el comentario explícito ya existente en
  `role-config.ts` ("Reusa los íconos de negocio... no se generaron
  imágenes nuevas").

### 3.2 Matriz BEFORE

| SURFACE | MANIFEST | ICON_192 | ICON_512 | MASKABLE | APPLE_TOUCH | FAVICON/METADATA | NOTIF_ICON | NOTIF_BADGE | LEGACY_OR_CURRENT |
|---|---|---|---|---|---|---|---|---|---|
| Cliente | manifest-cliente.json | icon-cliente-192x192.png (viejo) | icon-cliente-512x512.png (viejo) | mismo archivo que "any" | icon-cliente-192x192.png (viejo) | favicon.ico + icon.svg + icon-cliente-192x192.png (viejo) | icon-cliente-192x192.png (default) | = icon | CURRENT (legacy content) |
| Negocio | manifest-negocio.json | icon-negocio-192x192.png (viejo) | icon-negocio-512x512.png (viejo) | mismo archivo | icon-negocio-192x192.png (viejo) | dinámico (DynamicManifest si no-principal; en este caso SÍ es principal → SSR) | icon-negocio-192x192.png (new_order/order_update/review/account_update) | = icon | CURRENT (legacy content) |
| Repartidor | manifest-repartidor.json | icon-repartidor-192x192.png (viejo) | icon-repartidor-512x512.png (viejo) | mismo archivo | icon-repartidor-192x192.png (viejo) | SSR (principal) | **ninguna rama — cae a icon-cliente** | = icon (cliente) | CURRENT (legacy content), mismatch de notif. preexistente |
| Admin | manifest-admin.json | icon-admin-192x192.png (viejo) | icon-admin-512x512.png (viejo) | mismo archivo | icon-admin-192x192.png (viejo) | dinámico (DynamicManifest, no-principal) | **ninguna rama — cae a icon-cliente** | = icon (cliente) | CURRENT (legacy content), mismatch preexistente |
| Operaciones | manifest-operaciones.json | **icon-negocio-192x192.png (prestado)** | **icon-negocio-512x512.png (prestado)** | mismo archivo prestado | icon-negocio-192x192.png (prestado, vía role-config) | SSR (principal) | operaciones_salon_new_order→salon; operaciones_order_cancelled→salon/empleado | = icon | **LEGACY — sin asset propio** |
| Global/Fallback | (root layout.tsx, sin manifest hardcoded) | icon-cliente-192x192.png (viejo) | — | — | — | favicon.ico + icon.svg + icon-cliente-192x192.png (viejo) | — | — | CURRENT (ya usaba Cliente, correcto) |

## 4. Decisiones

1. **Reusar exactamente los mismos paths de archivo** para Cliente/
   Negocio/Repartidor/Admin (`icon-{rol}-192x192.png`/`512x512.png`) —
   sólo se reemplaza el CONTENIDO binario, cero cambios de wiring en
   manifests/`role-config.ts`/`layout.tsx`/`sw.js` para estos 4 roles.
   Minimiza el diff y el riesgo (ningún consumidor necesita saber que
   cambió nada).
2. **Crear paths NUEVOS para Operaciones** (`icon-operaciones-
   192x192.png`/`512x512.png`, no existían) y actualizar `role-config.ts`
   + `manifest-operaciones.json` para apuntar ahí — cierra el
   préstamo de Negocio documentado desde "Bugfix-2 [6]".
3. **No crear ninguna PWA nueva** — Admin y Operaciones ya tenían
   superficie/manifest/scope reales (confirmado en §3.1); no se creó
   ninguna infraestructura nueva sólo para "tener dónde poner el ícono".
4. **No declarar un derivado maskable-safe nuevo** — ver §7.
5. **No tocar `favicon.ico`, `icon.svg`, ni introducir una variante
   Apple de 180x180** — ver §8/§9.
6. **No tocar la lógica de selección de ícono/badge de notificaciones
   en `sw.js`** — los paths que YA usa (`icon-cliente-...`,
   `icon-negocio-...`) se refrescan automáticamente porque son los
   mismos archivos que se acaban de reemplazar; no se agregó ninguna
   rama nueva (p. ej. Repartidor) aunque el mismatch preexistente
   quedó documentado — ver §10.
7. **Sí se subió `CACHE_NAME` en `sw.js`** (`deligo-v14` →
   `deligo-v15`) — con evidencia directa, no por reflejo — ver §12.
8. **No se generaron tamaños adicionales** (sólo 192/512, que son los
   únicos realmente consumidos — confirmado por grep exhaustivo, ver
   §6 de la tarea / §5 de este reporte).

## 5. Target canónico — mapping final exacto

| SOURCE_ASSET | PUBLIC_DERIVATIVES | CONSUMERS |
|---|---|---|
| `deligo cliente.png` | `public/icon-cliente-192x192.png`, `public/icon-cliente-512x512.png` | `manifest-cliente.json` (any+maskable ×2), `role-config.ts` (`cliente.icon192/512`), `src/app/layout.tsx` (fallback global), `pwa-identity.ts` (apple, vía `cliente.icon192`), `sw.js` (`icon` default + `account_update`/etc. si no matchea otras ramas) |
| `deligo negocio.png` | `public/icon-negocio-192x192.png`, `public/icon-negocio-512x512.png` | `manifest-negocio.json` (any+maskable ×2), `role-config.ts` (`negocio.icon192/512`), `sw.js` (`new_order`/`order_update`/`review`/`account_update`) |
| `deligo repartidor.png` | `public/icon-repartidor-192x192.png`, `public/icon-repartidor-512x512.png` | `manifest-repartidor.json` (any+maskable ×2), `role-config.ts` (`repartidor.icon192/512`) |
| `deligo admin.png` | `public/icon-admin-192x192.png`, `public/icon-admin-512x512.png` | `manifest-admin.json` (any+maskable ×2), `role-config.ts` (`admin.icon192/512`) |
| `deligo operaciones.png` | `public/icon-operaciones-192x192.png` (**nuevo**), `public/icon-operaciones-512x512.png` (**nuevo**) | `manifest-operaciones.json` (any+maskable ×2, actualizado), `role-config.ts` (`operaciones.icon192/512`, actualizado) |

Derivados generados con `sharp` (`^0.34.3`, ya presente en
`package.json` — **cero dependencias nuevas**), `resize(size, size,
{fit: "fill", kernel: lanczos3})` — como el origen ya es 1254x1254
(cuadrado perfecto) y el destino también es cuadrado, `fit: "fill"` no
recorta ni deforma nada: es un escalado directo 1:1 de aspecto.
Verificado con `sharp().metadata()` tras generar: 192x192 y 512x512
exactos, PNG válido, en los 10 archivos.

sha256 de los 10 derivados instalados en `public/`:

```text
icon-cliente-192x192.png     94ea0ed0...36f5
icon-cliente-512x512.png     7940bef5...6057
icon-negocio-192x192.png     50533df6...901f
icon-negocio-512x512.png     ec978b22...ff09
icon-repartidor-192x192.png  1a37b79d...b778
icon-repartidor-512x512.png  ab8e3222...fa42
icon-admin-192x192.png       418e581f...014
icon-admin-512x512.png       4f24e6ee...715d
icon-operaciones-192x192.png 9d7a2680...a30f
icon-operaciones-512x512.png 4e04c138...e892
```

(hashes truncados por legibilidad; los completos están en el historial
de esta sesión y son reproducibles desde `branding-source/` con el
mismo comando `sharp` documentado arriba).

## 6. Tamaños

Auditado por grep exhaustivo de todo el repo (`icon-(cliente|negocio|
repartidor|admin|operaciones)-\d+x\d+`): **sólo 192x192 y 512x512** se
consumen en cualquier manifest/`role-config.ts`/`sw.js`/`layout.tsx`.
Ningún 180x180 ni ningún otro tamaño está referenciado en ningún lado
— no se generaron tamaños adicionales innecesarios.

## 7. Maskable icons — BLOCKED_NEEDS_DESIGN_DECISION

```text
MASKABLE_SAFE_DERIVATIVE_STATUS=BLOCKED_NEEDS_DESIGN_DECISION
```

Los 5 manifests ya reusaban, ANTES de esta tarea, el mismo archivo
"any" también para `purpose: "maskable"` (sin ningún padding de
safe-zone auditado) — un patrón preexistente, no introducido acá.
Inspección visual de los 5 derivados confirma que el texto de rol
(NEGOCIO/REPARTIDOR/ADMIN/OPERACIONES) queda con muy poco margen
respecto al borde inferior del cuadrado — muy probablemente fuera del
círculo de safe-zone del 80% que exige un ícono maskable real. Generar
un derivado seguro exigiría, como mínimo, decidir un color de fondo
sólido para extender más allá del cuadrado ya "horneado" con esquinas
negras opacas (§2) — el fondo original es un degradado que sólo existe
dentro de esa forma, no se puede extender sin inventar/interpolar
píxeles nuevos, lo cual cruza hacia "rediseño" explícitamente prohibido
por la tarea. Por instrucción explícita de la tarea, se reporta este
estado y **no se bloquean los íconos `any`** — cada manifest conserva
exactamente el mismo patrón de reuso que ya tenía (ahora con el
contenido nuevo), sin regresión respecto al estado anterior.

## 8. Favicon global

```text
FAVICON_ICO_REGENERATED=NO
GLOBAL_FAVICON_REFRESHED=SI (indirectamente, vía icon-cliente-192x192.png)
```

`favicon.ico` (legacy, binario multi-resolución) se dejó intacto — no
se regeneró por decisión explícita: el root `layout.tsx` YA declara
`icon-cliente-192x192.png` como una entrada adicional de
`icons.icon` junto al `.ico`, y esa entrada SÍ se refresca con esta
tarea (mismo archivo, contenido nuevo). Regenerar el `.ico` en sí
exigiría herramienta dedicada de empaquetado multi-resolución fuera del
alcance de un simple resize, con riesgo de producir un archivo
malformado sin necesidad real (los navegadores modernos ya priorizan
el PNG declarado). El ícono Cliente/DeliGO (naranja, sin texto) sigue
siendo la elección correcta como favicon/fallback global — legible en
tamaño diminuto, a diferencia de los íconos de rol con texto.

## 9. Apple touch icon

```text
APPLE_TOUCH_ICONS_REFRESHED=SI (contenido, vía icon192 compartido)
APPLE_180X180_VARIANT_CREATED=NO
```

`getPwaIdentityMetadata()` y `DynamicManifest` ya reusaban
`config.icon192` (192x192) tanto para `icons.icon` como para
`icons.apple`/`apple-touch-icon` — sin una variante 180x180 dedicada.
Este patrón YA está certificado físicamente en iPhone (Cliente/Negocio/
Repartidor `CERTIFIED_TESTING`, P2-T31) usando exactamente este mismo
wiring — cambiarlo ahora (agregar un campo/archivo nuevo) sería una
modificación de wiring no solicitada y no necesaria, con riesgo de
tocar una superficie ya certificada. Se preserva sin cambios; sólo el
contenido de `icon-{rol}-192x192.png` se refresca. No se tocó
safe-area, status bar, standalone/startup behavior ni P2-T22.

## 10. Notificaciones — icon/badge

```text
NOTIFICATION_ICON_CHANGED=SI (contenido de archivo, CERO cambio de wiring/lógica en sw.js)
NOTIFICATION_BADGE_CHANGED=NO
NOTIFICATION_BADGE_STATUS=LEGACY_INADEQUATE_PRESERVED_NOT_FIXED_THIS_TASK
```

`sw.js` selecciona `icon`/`badge` por `notifType` usando los MISMOS
paths de archivo que ya existían (`icon-cliente-192x192.png`,
`icon-negocio-192x192.png`, `icon-salon-...`, `icon-mozo-...`,
`icon-empleado-...`) — no se tocó ni una línea de esa lógica de
selección. Como consecuencia, las notificaciones de Cliente y de
Negocio (los 2 únicos roles con rama propia) mostrarán automáticamente
el nuevo branding sin ningún cambio de código adicional.

Se auditó y NO se corrigió (fuera de alcance, preexistente): Repartidor,
Admin y Operaciones no tienen ninguna rama de `icon` propia en `sw.js`
— sus notificaciones (si las hay) siguen cayendo al ícono de Cliente
por defecto, exactamente igual que antes de esta tarea.

`badge` siempre reusa el mismo valor que `icon` (`badge: data.badge ||
icon`) — nunca existió un asset monocromático dedicado. Los PNG viejos
(`colorType=2`, sin alfa) y los nuevos (`colorType=6` pero 100% opacos,
§2) comparten la MISMA limitación estructural: ninguno tiene una forma
recortada sobre transparencia real que Android pueda usar como
silueta de badge. Esto NO es una regresión de esta tarea — es
idéntico al comportamiento anterior, sólo con el logo nuevo en vez del
viejo. Derivar un badge monocromático correcto exigiría aislar/redibujar
sólo la "D" sobre transparencia — una decisión de diseño explícitamente
fuera de alcance ("NO hacerlo en esta tarea" por instrucción directa).
No se cambió la acción "ANULAR SUSCRIPCIÓN" ni ningún copy/action de
notificación.

## 11. Legacy cleanup

```text
LEGACY_ICON_FILES_REMOVED_COUNT=0
LEGACY_ICON_FILES_PRESERVED_COUNT=10 (los 10 paths de Cliente/Negocio/Repartidor/Admin/Operaciones, todos en uso activo)
AMBIGUOUS_LEGACY_ICON_FILES=NINGUNO
```

No se eliminó ningún archivo: para 4 roles se sobrescribió CONTENIDO en
el mismo path (nada queda huérfano); para Operaciones se agregaron 2
archivos NUEVOS sin eliminar `icon-negocio-*` (que sigue en uso activo
por Negocio mismo). `icon-empleado-*`, `icon-mozo-*`, `icon-salon-*`
(fuera del set de 5 roles de esta tarea) permanecen intactos, en uso
por sus propios manifests/`role-config.ts`/`sw.js`.

## 12. Service Worker — cache version

```text
SW_CACHE_VERSION_CHANGE_REQUIRED=SI
SW_CACHE_VERSION_CHANGED=SI (deligo-v14 -> deligo-v15)
```

Auditoría con evidencia directa, no por reflejo: la regla de `sw.js`
que pretende servir "manifest files or PWA icons" siempre desde red
(`request.url.includes("manifest") || request.url.includes("icon-192")
|| request.url.includes("icon-512")`) sólo matchea realmente el
substring `"manifest"` — se verificó programáticamente que
`"icon-cliente-192x192.png".includes("icon-192")` es **`false`** (tras
`"icon-"` sigue `"cliente-192x192"`, nunca `"192"` directo), y lo mismo
para los 10 nombres de archivo reales de este refresh. Es decir, esa
condición de bypass de cache NUNCA se cumple para ningún ícono de rol
existente — los PNG de íconos en realidad caen en la rama cache-first
de assets estáticos (`/\.(png|jpg|...)$/`) más abajo en el mismo
archivo. Sin subir `CACHE_NAME`, un cliente que ya tenía cacheado el
ícono viejo bajo `deligo-v14` seguiría sirviéndolo indefinidamente pese
al refresh de contenido. Se subió a `deligo-v15` con un comentario
explícito documentando esta evidencia — el bug del substring roto en sí
NO se corrigió (cambiar esa lógica es más que un bump de versión, fuera
de alcance de esta tarea; se deja como hallazgo lateral para una tarea
futura). No se tocó ninguna otra lógica de `sw.js` (push, notificación,
share-target, cache de rutas).

## 13. Producción futura

```text
PRODUCTION_FUTURE_COMPATIBLE=SI
```

Ningún cambio hardcodea `deligo-copy-production...` ni ningún dominio
TESTING-only, ni condiciona íconos por `environment`. Los assets
públicos (`public/icon-*.png`), los manifests y `role-config.ts` son
comunes al código — cuando este diff se promueva a `main`, Production
serviría exactamente el mismo branding sin ningún paso adicional.
Production (`origin/main=1de0d3c1`) permanece intacta y no fue tocada
en ningún momento de esta tarea.

## 14. Tests

```text
FOCAL_TEST_PASS=52
FOCAL_TEST_FAIL=0
PUSH_TESTS_EXECUTED=SI
PUSH_TEST_PASS=577
PUSH_TEST_FAIL=0
```

Se agregó `src/lib/pwa-role-icon-contract.test.ts` (5 tests nuevos):
verifica que `role-config.icon192/icon512` existan en disco, sean PNG
válidos con la dimensión exacta que su nombre promete; que ningún rol
de los 5 comparta `icon192` con otro (Operaciones ya no apunta a
Negocio); que los 5 manifests nunca referencien un ícono inexistente y
que sus entradas `any` apunten al ícono propio del rol; que
`manifest-operaciones.json` ya no contenga `icon-negocio`; y que el
fallback global de `layout.tsx` siga siendo Cliente. Ejecutado junto a
los tests de identidad/scope PWA ya existentes
(`pwa-identity.test.ts`, `pwa-canonical-scope.test.ts`,
`role-config.test.ts`) y los de safe-area/iOS adyacentes — **52/52
verdes**. Como `sw.js` fue tocado (bump de `CACHE_NAME`), se
re-ejecutó también la suite Push completa por ser P2-T31 un epic
abierto: **577/577 verdes**, idéntico al baseline vigente, cero
regresiones.

Un `bun test` global (3180 tests) muestra 227 fallos y 3 errores, en su
totalidad pre-existentes y ambientales — `error: Environment variable
not found: DATABASE_URL` en tests de integración que requieren una DB
real no disponible en este entorno local (confirmado: ninguno de los
227 fallos toca `icon`/`manifest`/`pwa-identity`/`pwa-canonical`/
`role-config`/`sw.js`/`pwa-role-icon-contract`). No es un hallazgo de
esta tarea ni se intentó corregir (fuera de alcance).

## 15. ESLint / TypeScript / diff-check

```text
ESLINT_PASS=SI
TYPECHECK_RAW_FINAL=24
TYPECHECK_DISTINCT_FINAL=24 (por línea de error única; metodología de conteo puede diferir levemente de reportes previos, pero el conjunto de errores es idéntico al vigente)
NEW_TYPECHECK_ERRORS=0
DIFF_CHECK_PASS=SI
ICON_BINARY_VALIDATION_PASS=SI
```

ESLint limpio sobre `src/lib/role-config.ts` y
`src/lib/pwa-role-icon-contract.test.ts` (únicos `.ts`/`.tsx` tocados).
TypeScript: 24 errores raw, idéntico al conteo histórico documentado
desde R15A — ninguno menciona `role-config.ts`, `pwa-role-icon-
contract.test.ts`, `manifest-operaciones.json` ni `sw.js`. `git diff
--check` limpio (sólo warning CRLF de Windows en
`manifest-operaciones.json`, igual de aceptable que en tareas previas).
Validación binaria: los 10 PNG en `public/` verificados con firma PNG
válida (`89 50 4E 47 0D 0A 1A 0A`) y dimensiones IHDR exactas (192x192/
512x512) leídas directamente del header, sin depender de la extensión
del nombre de archivo.

## 16. Build

```text
BUILD_EXECUTED=SI
BUILD_PASS=SI
BUILD_NEW_ERRORS=0
```

`npx next build` completo, terminó limpio con el manifiesto completo de
rutas — sin `error`/`failed` en la salida. No se corrigió ningún error
histórico fuera de alcance (no apareció ninguno relacionado).

## 17. Git

```text
STAGE_PERFORMED=NO
COMMIT_PERFORMED=NO
PUSH_PERFORMED=NO
DEPLOY_PERFORMED=NO
PRODUCTION_TOUCHED=NO
```

`git status -sb`, `git diff --name-status`, `git diff --stat`, `git
diff --check` ejecutados y revisados línea por línea (ver §§ previas).
Ningún `git add` ejecutado en ningún momento.

Archivos modificados (tracked, contenido):

```
M public/icon-admin-192x192.png       (Bin 33997 -> 68049 bytes)
M public/icon-admin-512x512.png       (Bin 110102 -> 396763 bytes)
M public/icon-cliente-192x192.png     (Bin 42817 -> 35434 bytes)
M public/icon-cliente-512x512.png     (Bin 136247 -> 256134 bytes)
M public/icon-negocio-192x192.png     (Bin 30594 -> 63721 bytes)
M public/icon-negocio-512x512.png     (Bin 99320 -> 371333 bytes)
M public/icon-repartidor-192x192.png  (Bin 28962 -> 52851 bytes)
M public/icon-repartidor-512x512.png  (Bin 111144 -> 332982 bytes)
M public/manifest-operaciones.json    (8 líneas, 4 src reemplazados)
M public/sw.js                        (+17/-1, comentario + bump CACHE_NAME)
M src/lib/role-config.ts              (+10/-4, comentario + 2 paths de Operaciones)
```

Archivos nuevos (untracked, no stageados):

```
?? public/icon-operaciones-192x192.png
?? public/icon-operaciones-512x512.png
?? src/lib/pwa-role-icon-contract.test.ts
?? branding-source/  (5 PNG fuente del operador — conservados sin modificar, para referencia/auditoría futura)
```

Ningún otro archivo tracked del repo fue tocado. `32` no fue leído,
inspeccionado, modificado ni tocado en ningún momento.

## 18. Fileset

```text
SOURCE_ASSETS_CONSUMED=deligo cliente.png, deligo negocio.png, deligo repartidor.png, deligo admin.png, deligo operaciones.png
NEW_ICON_FILES=public/icon-operaciones-192x192.png, public/icon-operaciones-512x512.png
MODIFIED_MANIFEST_FILES=public/manifest-operaciones.json
MODIFIED_METADATA_FILES=src/lib/role-config.ts
MODIFIED_SERVICE_WORKER_FILES=public/sw.js
MODIFIED_NOTIFICATION_FILES=NINGUNO (sw.js sólo cambió CACHE_NAME, no lógica de notificación)
REMOVED_LEGACY_ICON_FILES=NINGUNO
BINARY_ASSETS_CHANGED=10 (8 sobrescritos in-place + 2 nuevos)
```

## 19. Limitaciones de cache/PWA — qué verificar tras un futuro deploy

No se pidió ni se ejecutó ninguna reinstalación. Para cuando este diff
se promueva a un deploy TESTING real:

- **Cliente/Negocio/Repartidor/Admin/Operaciones**: dado que `sw.js`
  sirve los PNG de ícono vía cache-first (§12) y `CACHE_NAME` se subió,
  un cliente con la PWA YA instalada verá el ícono nuevo en cuanto el
  SW nuevo tome control — `install`/`activate` ya llaman
  `skipWaiting()`/`clients.claim()` incondicionalmente, así que no
  requiere que el usuario borre datos ni reinstale. El icono del
  LAUNCHER/home-screen en sí (el WebAPK de Android, o el ícono
  "guardado" de iOS) es una capa MÁS externa que Chrome/Safari generan
  al momento de "Agregar a pantalla de inicio" — esa capa NO se
  actualiza sola con un simple refresh del manifest; **puede requerir
  que el usuario reinstale la PWA (quitar y volver a agregar a
  pantalla de inicio)** para ver el ícono nuevo en el launcher, aunque
  el `<link rel="manifest">`/apple-touch-icon internos ya sirvan el
  contenido correcto. No se afirma que la reinstalación sea siempre
  obligatoria — depende de si Chrome/Safari revalida el manifest
  periódicamente (Chrome sí lo hace ocasionalmente vía "manifest
  update"; iOS Safari, generalmente no, hasta reinstalar).
- Verificar tras deploy: favicon en pestaña del navegador (debería
  refrescar solo, sin reinstalar nada); ícono dentro de la propia PWA
  (splash screens, `apple-touch-icon` en Safari) debería reflejar el
  cambio en la próxima carga; ícono del launcher/home-screen puede
  necesitar reinstalación manual — documentar el resultado real
  observado, no asumirlo.

## 20. No interferencia con P2-T31

```text
ANDROID_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (sin cambios)
IPHONE_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (sin cambios)
IPHONE_NEGOCIO_PUSH_MATRIX=CERTIFIED_TESTING (sin cambios)
IPHONE_REPARTIDOR_PUSH_MATRIX=CERTIFIED_TESTING (sin cambios)
ANDROID_NEGOCIO_SMOKE=FAIL_PHYSICAL_SUBSCRIPTION_CREATE_ON_R19A_AFTER_TWO_ABORTERROR_ATTEMPTS (sin cambios — el smoke funcional exitoso en el SEGUNDO Android, según lo reportado por el operador en el header de esta tarea, no generó su propio reporte formal todavía; este estado del marcador histórico de R20 se preserva literal sin reinterpretar)
ANDROID_REPARTIDOR_SMOKE=NOT_STARTED (sin cambios, no se tocó ni se ejecutó desde esta tarea)
```

No se modificó `use-push-notifications.ts`, `push-operation-guard.ts`,
`push-mutation-in-flight-registry.ts`, `push-subscription-key.ts`,
`push.ts`, ni ninguna lógica de suscripción/entrega/retry. El único
archivo compartido con el epic de Push es `sw.js`, y el único cambio
ahí es un bump de `CACHE_NAME` — la suite Push completa (577/577) se
re-ejecutó explícitamente para confirmarlo sin regresiones. P2-T31 no
se cierra ni se certifica desde esta tarea.

## 21. Riesgos

- **Reinstalación del launcher** (§19): riesgo de UX menor, no
  funcional — el ícono en el home-screen puede tardar en reflejar el
  cambio hasta que el usuario reinstale; no afecta ninguna
  funcionalidad de la app.
- **Maskable safe-zone no garantizada** (§7): riesgo preexistente, sin
  cambios — si algún launcher Android aplica una máscara agresiva
  sobre el ícono `maskable` reusado, el texto de rol podría recortarse;
  esto YA era el caso con los íconos viejos, no es nuevo.
- **`icon-192`/`icon-512` bypass roto en `sw.js`** (§12): hallazgo
  lateral documentado, no corregido — cualquier FUTURO refresh de
  íconos de rol necesitará repetir manualmente el bump de
  `CACHE_NAME` hasta que se corrija la condición del substring.
- **Mismatch de ícono de notificación para Repartidor/Admin/
  Operaciones** (§10): preexistente, sin cambios — documentado para
  una futura tarea de UX/Push si se decide corregirlo.

## 22. Próxima acción

```text
NEXT_RECOMMENDED_ACTION=DELIGO_BRANDING_R1_REVIEW_BEFORE_COMMIT_AND_TESTING_DEPLOY
```

Pendiente de revisión del operador antes de autorizar una tarea
separada de commit/push/TESTING deploy (fuera del alcance de ésta).

STOP.
