# F9 — Lector de códigos de barras y escaneo continuo en Caja

Fecha: 2026-10-08 · Entorno autorizado: TESTING (amiable-rejoicing / TESTING / DeliGO Copy / testing-codex) · Production: sin cambios.

## 1. Resultado

```text
F9_STATUS=DEPLOYED_TESTING_AWAITING_PHYSICAL_SMOKE
F9_TECHNICAL_TESTS=PASS
F9_PHYSICAL_DEVICE_CERTIFICATION=PENDING_OPERATOR
STOCK_RESERVATION_MODE=ON (antes y después; no se tocó)
R3A_OVERALL_STATUS=CLOSED_TESTING_CERTIFIED_WITH_DOCUMENTED_LIMITATIONS (sin cambios de código R3A)
BASE_TESTING_CODEX_HEAD=5fbfc60a8e521681e876bec5fc8bf8f7e18fcdb8
F9_BRANCH=work/f9-barcode-continuous-scanner
```

La presencia del componente y del permiso correcto NO certifica la cámara física: iPhone Safari, iPhone PWA, Android Chrome y Android PWA quedan PENDIENTES del smoke del operador (§12).

## 2. Decisiones aplicadas (aprobadas por el operador)

| # | Decisión | Implementación |
|---|----------|----------------|
| D1 | BarcodeDetector nativo + alternativa para iPhone | `barcode-detector@3.2.2` (MIT, Sec-ant, sin scripts de instalación) → `zxing-wasm@3.1.3`. Nativo cuando el navegador soporta `ean_13` y `code_128`; si no, ponyfill WebAssembly. WASM servido por DeliGO en `/vendor/zxing-wasm/3.1.3/zxing_reader.wasm` (SHA-256 idéntico al `ZXING_WASM_SHA256` del paquete, verificado por test). El `locateFile` por defecto (jsDelivr) queda anulado: ningún CDN. Carga perezosa (`import()` dinámico) sólo al abrir el lector. |
| D2 | Permiso de cámara | `Permissions-Policy: camera=(self), microphone=(), geolocation=(self)` (antes `camera=()`). Resto de headers y CSP intactos (CSP ya permitía compilar WASM vía `'unsafe-eval'` y `connect-src 'self'`). |
| D3 | Códigos inequívocos por negocio | Autoridad única `src/lib/barcode-uniqueness.ts` en las 4 rutas reales; 409 `CODIGO_BARRAS_DUPLICADO` con el artículo en conflicto. |
| D4 | Código en producto padre con variantes | 1 variante activa vendible → se agrega; varias → selector existente; ninguna → "Producto no disponible". Nunca se elige arbitrariamente. |
| D5 | Cantidad superior al stock | El escaneo no se detiene: agrega y advierte. Disponible real (físico − reservas ACTIVA) cuando el catálogo lo trae; si sólo hay stock físico, se dice "stock registrado", nunca "disponible garantizado". El checkout sigue siendo la autoridad. |
| D6 | Sonido | Activo por defecto, botón visible para silenciar (preferencia por dispositivo), vibración donde exista; siempre acompañado de un aviso visual. |

## 3. Diseño implementado

### 3.1 Identificación (`src/lib/barcode.ts`, puro)
- Códigos siempre como string; ceros iniciales preservados; trim coherente; máximo 64 caracteres; sin caracteres de control; un valor no-string → 400.
- Clave de comparación `barcodeLookupKey`: UPC-A válido (12 dígitos con dígito verificador correcto) ≡ su EAN-13 con 0 inicial; códigos no numéricos sin distinguir mayúsculas. La equivalencia NO se aplica a códigos internos cortos, alfanuméricos ni a GTIN inválidos.
- Lecturas de cámara: dígito verificador validado por formato (EAN-13, EAN-8, UPC-A, UPC-E expandido a UPC-A); Code 128 con su checksum del decodificador. Los códigos manuales no se validan (pueden ser internos).
- Coincidencia exacta normalizada (nunca subcadena); productos eliminados y sus variantes excluidos; variantes inactivas incluidas (cuentan para duplicados, "no disponible" en Caja).
- `resolveScannedBarcode` replica las reglas actuales de Caja (`handleProductTap`/`addProduct`/`addVariante`, vendible por stock físico) + D4; duplicados históricos → `ambiguous` (el cajero elige).

### 3.2 Control antiduplicados (`src/lib/scan-lock.ts`, puro)
- El loop llama `observe()` en CADA frame analizado, también los vacíos: la ausencia se mide por frames, no por la frecuencia de lecturas exitosas.
- Confirmación con 2 frames consecutivos; el código aceptado queda bloqueado mientras siga visible; se rearma tras 700 ms de ausencia; piso adicional de 1,2 s entre aceptaciones del mismo código (no es el mecanismo principal); un código distinto se acepta apenas se confirma.
- En pausa (selector de variantes, elección de ambiguos, agregado en curso) no se acepta nada y todo lo visible queda bloqueado: al reanudar no se suma un producto que siguió frente a la cámara.
- Códigos inexistentes se bloquean igual (un solo mensaje). Un lock nuevo por sesión de escáner.
- Valores iniciales, no garantía universal: ajustar con el smoke físico.

### 3.3 Componente único de cámara (`src/components/business/barcode-scanner.tsx`)
- Modos `continuous` (Caja) y `single` (Inventario); `BarcodeField` reutiliza el mismo componente.
- `getUserMedia` sólo por acción del usuario, `facingMode: { ideal: "environment" }`, `playsInline`/`muted`, reintento con `video: true` si no hay cámara trasera; estados: abriendo, permiso denegado, sin cámara, error, suspendido.
- Linterna si `MediaTrackCapabilities.torch`.
- Detección local sobre una banda central reducida (≤960 px) cada ~90 ms; ninguna imagen sale del dispositivo.
- Ciclo de vida: contador de sesión; todo lo asíncrono de una sesión vieja detiene su propio stream (cerrar durante el prompt de permiso no deja la cámara prendida). Al cerrar/desmontar: `track.stop()` de todas las pistas, `clearTimeout` del loop, listeners de `visibilitychange`/`pagehide`/`keydown` removidos, scroll del body restaurado. En segundo plano se libera la cámara y al volver se reabre.
- Ingreso manual: en Caja, campo + "Agregar" (abierto y enfocado en dispositivos con puntero fino → compatible con lectores USB/Bluetooth tipo teclado que envían Enter); en Inventario el campo del formulario es el ingreso manual.
- Dentro de diálogos Radix (Inventario) el escáner habilita `pointer-events` para sí y los formularios usan `keepDialogOpenWhileScanning` (no se cierran ni pierden lo cargado).

### 3.4 Caja (`src/components/business/caja-tab.tsx`, `VenderView`)
- Botón "Escanear productos" en Vender → un solo toque abre el escáner continuo, que permanece abierto con contador de unidades, total del carrito existente y "Ver carrito".
- Cada lectura: normaliza → búsqueda exacta en el catálogo del negocio autenticado (ya acotado por sesión en `GET /api/negocio/productos`) → valida vendible → `addCartLine` del carrito existente (consolida por identidad producto/variante) → aviso visual + sonido/vibración → listo para el siguiente.
- No encontrado → refetch del catálogo UNA vez por código y sesión → "Producto no encontrado" sin cerrar.
- "Ver carrito" cierra el escáner y abre el resumen existente (`CartPanel`: +, −, eliminar, cobrar). No hay segundo carrito, segundo resumen ni otra lógica de cobro.
- El escáner no vende: la venta sigue siendo `POST /api/negocio/caja/ventas` (sin cambios: precio de servidor, aislamiento, Serializable, reservas R3A, 409, movimientos, métodos de pago).

### 3.5 Disponibilidad para advertencias (D5, adaptación READ-ONLY)
- `GET /api/negocio/productos` agrega `stockDisponible` sólo a filas con control de stock de un negocio genérico, usando la autoridad R3A ya re-exportada (`leerReservasActivasPorClave`, UNA lectura agrupada por request, acotada al negocio de la sesión, + `resolvePublicProductAvailability` con el toggle manual forzado a visible). Restaurante/Ropa o negocios sin control de stock: sin lecturas extra y respuesta idéntica.
- No modifica reservas, checkout ni el import allowlist de `stock-authority`.

### 3.6 Unicidad en backend (`src/lib/barcode-uniqueness.ts`)
- Rutas reales: `POST /api/negocio/productos` (incluye variantes inline), `PUT /api/negocio/productos/[id]` (incluye reactivación `eliminado:false`), `POST /api/negocio/productos/[id]/variantes`, `PUT /api/negocio/productos/[id]/variantes/[varianteId]`. Duplicar producto no copia códigos (verificado).
- Sólo se reclama un código cuando la escritura lo INTRODUCE (nuevo, cambiado, o reactivación de un producto eliminado y sus variantes). Mantener el propio código o editar otra cosa no ejecuta la guarda → los duplicados históricos no bloquean.
- Atomicidad: `runBarcodeGuardedWrite` = UNA transacción Serializable (`runStockSerializable`, autoridad compartida sin cambios, reintento acotado de P2034) + `pg_advisory_xact_lock(hashtextextended(<negocio>:<clave canónica>, 0))` por código (parámetro enlazado, ordenado, liberación automática al terminar la tx) + relectura de los códigos del negocio + escritura en la misma tx.
- Por qué ambos: en Serializable el snapshot se toma al INICIAR la sentencia del lock, posiblemente antes de que otro escritor confirme; la corrección viene de que TODOS los escritores de códigos son Serializable (SSI aborta al segundo → reintento con snapshot nuevo → 409). El lock encola a los escritores del mismo código. Demostrado con escrituras concurrentes reales (§7).

### 3.7 Inventario (`src/components/business/inventario-tab.tsx`)
- Botón de cámara junto a: código del producto base (en "Detalles avanzados", sin mover el campo), código de variante al crear (filas inline) y código de variante al editar.
- Single-read: completa sólo el campo desde el que se abrió, cierra la cámara, el campo queda editable, el formulario sigue abierto.
- Advertencia temprana (catálogo ya cargado) si el código pertenece a otro artículo o se repite entre filas; el backend sigue siendo la autoridad.

## 4. Archivos

Commits funcionales (rama `work/f9-barcode-continuous-scanner`, integrados por fast-forward):
- `85e701bb0d7526d954e3f841ae99cfb7cf70807b` feat: add barcode lookup and duplicate safeguards (S1)
- `3e687b271f0bf99c1b18db2efb503c190fb9a60c` feat: add continuous barcode scanning to caja (S2)
- `306f34a9f9c4ea9d34033f1e0d9a770e1c49b6d9` feat: add barcode capture to inventory forms (S3)

24 archivos (+3390 / −33):

| Archivo | Tipo |
|---|---|
| `package.json`, `bun.lock` | dependencia `barcode-detector` 3.2.2 (exacta) |
| `public/vendor/zxing-wasm/3.1.3/zxing_reader.wasm` | WASM servido por DeliGO (1 093 289 bytes, SHA-256 2ebda08a…c6d1ba = ZXING_WASM_SHA256) |
| `src/lib/barcode.ts` | nuevo — autoridad de normalización/identificación |
| `src/lib/scan-lock.ts` | nuevo — control antiduplicados |
| `src/lib/barcode-uniqueness.ts` | nuevo — guarda transaccional de unicidad |
| `src/lib/barcode-detector-loader.ts` | nuevo — detector nativo / ponyfill, WASM local |
| `src/lib/scan-feedback.ts` | nuevo — sonido/vibración |
| `src/components/business/barcode-scanner.tsx` | nuevo — componente único + `BarcodeField` |
| `src/components/business/caja-tab.tsx` | escaneo continuo en VenderView |
| `src/components/business/inventario-tab.tsx` | captura en los 3 campos + advertencia |
| `src/app/api/negocio/productos/route.ts` | POST con guarda; GET con stockDisponible read-only |
| `src/app/api/negocio/productos/[id]/route.ts` | PUT con guarda (cambio de código y reactivación) |
| `src/app/api/negocio/productos/[id]/variantes/route.ts` | POST con guarda |
| `src/app/api/negocio/productos/[id]/variantes/[varianteId]/route.ts` | PUT con guarda |
| `src/proxy.ts` | `camera=(self)` |
| 8 archivos de test | ver §6 |

Sin cambios: `prisma/` (schema/migraciones), `src/lib/stock-lifecycle.ts`, `src/lib/stock-authority.ts`, `src/app/api/negocio/caja/**`, `src/app/api/pedidos/**`, `src/app/mozo/**`.

## 5. Dependencias
- `barcode-detector` 3.2.2 (exacto) → `zxing-wasm` 3.1.3, `type-fest`, `@types/emscripten`, `tagged-tag`. Licencia MIT. Sin scripts de instalación. `bun.lock` actualizado (Railway instala con `bun install --frozen-lockfile`, verificado sin cambios). `package-lock.json` no se regeneró (Railway no lo usa; mismo criterio que commits previos que sólo tocaron `bun.lock`).
- `html5-qrcode` sigue sólo en Mozo, sin cambios.

## 6. Pruebas automatizadas

Nuevos (F9) — 100 pass / 0 fail:

| Archivo | Resultado | Cubre |
|---|---|---|
| `src/lib/barcode.test.ts` | 34/0 | normalización, ceros iniciales, GTIN, UPC-E, UPC-A≡EAN-13, manuales, producto/variante/padre 1 o varias variantes, inactivos, eliminados, no encontrado, duplicados históricos, aislamiento, D5 |
| `src/lib/scan-lock.test.ts` | 12/0 | 10 s quieto = 1 unidad, retirar/volver, alternar, parpadeos, pausa, no encontrado sin repetición, lock manual, sesión nueva |
| `src/components/business/barcode-scanner.test.tsx` (happy-dom, loop real) | 9/0 | 1 unidad con código quieto y cámara abierta, nueva presentación, misread descartado, pausa, cierre libera pistas/loop/listeners, cierre durante el prompt de permiso, reapertura con lock limpio, segundo plano, permiso denegado + ingreso manual, single-read |
| `src/components/business/caja-tab.scanner.test.tsx` (happy-dom, CajaTab real) | 7/0 | un toque abre el escáner, 3 productos sin crear venta, consolidación con `addCartLine`, edición con +, checkout exactamente 1 POST, selector de variantes (pausa + anuncio), no encontrado con un solo refetch, catálogo desactualizado, advertencia D5, 409 del checkout conserva el carrito |
| `src/components/business/inventario-tab.barcode.test.tsx` (happy-dom) | 3/0 | botón de cámara en producto base, filas de variantes (sólo la fila de origen) y edición de variante; advertencias |
| `src/app/api/negocio/productos/route.catalog-availability.test.ts` | 3/0 | stockDisponible = físico − ACTIVA, 1 groupBy acotado al negocio, Restaurante sin lecturas |
| `src/lib/f9-barcode-static-contract.test.ts` | 20/0 | headers, WASM local = hash del paquete, sin CDN, import dinámico, ciclo de vida, Caja usa carrito/checkout existentes, guarda en las 4 rutas, alcance por rubro, Mozo intacto |
| `src/app/api/negocio/productos/route.barcode-uniqueness.test.ts` (real DB TESTING) | 12/0 | las 4 rutas reales + concurrencia real (§7) |

Regresiones dirigidas — 41 archivos, 677 pass / 9 fail (cada archivo en su propio proceso):
- Caja: `caja/ventas/route.test.ts` 21/0 (real DB), `route.reservations.test.ts` 14/0, `caja-venta.test.ts` 27/0, `caja-tab-responsive-static-contract` 6/0.
- Productos/variantes: `variantes/route.test.ts` 6/0 (real DB), `variantes/[varianteId]/route.test.ts` 7/0, `route.delete-guard` 3/0, duplicación/galería/reorden (real DB) 4/0 · 4/0 · 7/0, `product-variant-search` 25/0, `shared-options-server.integration` 10/0.
- R3A: `stock-lifecycle` 43/0, `-i3` 32/0, `-i4` 20/0, `stock-mode-controller-i5p0` 32/0, `stock-reservation-ops` 15/0, contratos I1 19/0 · I2 34/0 · I4 15/0 · I5-P0 10/0 · P0-F1 19/0.
- `proxy.test.ts` 56/0, `business-panel-tab-gating` 5/0, `negocios/[slug]/route.test.ts` 3/0.
- 9 fallas = BASELINE de la copia de trabajo Windows (CRLF por core.autocrlf): `product-variant-editor-ux-static-contract` 6, `product-variants-static-contract` 2, `catalog-tutorial-static-contract` 1 — comparan literales con "
". Verificado: con fuentes normalizadas a LF (como están en el repo), base y F9 pasan 17/0 y 21/0; el tutorial lee archivos que F9 no modifica. No son regresiones.
- Observación: en la primera pasada, duplicación/galería/reorden devolvieron 409 (deadlock 40P01) porque corrían al mismo tiempo que mis pruebas de carrera reales; aislados pasan 4/0 · 4/0 · 7/0. Ver riesgo de contención en §10.

## 7. Concurrencia real (TESTING, huella d64be28f676e)

- 8 altas simultáneas de producto con el mismo EAN-13 en un negocio → 1×201 + 7×409 `CODIGO_BARRAS_DUPLICADO`; 1 sola fila con la clave.
- Carrera mixta: 3 altas de producto (UPC-A y su EAN-13) + 2 altas de variante + 1 edición de producto hacia el mismo código → 1 éxito + 5×409 `CODIGO_BARRAS_DUPLICADO`; 1 sola fila con la clave.
- Repetido tras el cambio al runner propio: mismo resultado (1+7 y 1+5).
- Fixtures por id aleatorio, limpieza por ids exactos (sesiones, auditLog del negocio fixture, productos, negocios); verificación read-only posterior: 0 negocios `test-f9-*`, 0 productos, 0 auditLog; modo ON; 0 ACTIVA.

## 8. Gates

| Gate | Resultado |
|---|---|
| Tests F9 | 100/0 |
| Regresiones dirigidas | 677 pass / 9 baseline CRLF (0 nuevas) |
| TypeScript (`tsc --noEmit`) | 0 errores (baseline 0) |
| ESLint (archivos F9 + tests) | 0 errores, 0 warnings |
| `next build` (Turbopack) | OK (compiled, 160/160 páginas) |
| `prisma validate` / `prisma generate` | OK / OK (schema sin cambios) |
| `git diff --check` | limpio |
| `bun install --frozen-lockfile` | sin cambios |
| Dependencias | MIT, sin scripts de instalación, versión exacta, WASM con hash verificado |
| Imports cliente/servidor | ponyfill sólo por `import()` dinámico; `getUserMedia` sólo dentro de funciones; componente `"use client"` |
| Checkout/R3A intactos | 0 cambios en stock-lifecycle, stock-authority, caja/ventas, pedidos, prisma |

## 9. Integración y deploy

- Rama `work/f9-barcode-continuous-scanner` publicada en origin (306f34a). Referencia de seguridad local: tag `f9-pre-integration-testing-codex` → 5fbfc60.
- Fast-forward `testing-codex` 5fbfc60..306f34a y push a `origin/testing-codex`. `main` sin cambios (42ca500).
- Autodeploy TESTING / DeliGO Copy: `c2015fe3-493b-4a69-888e-34796d6d9fb7` SUCCESS, commitHash 306f34a9f9c4ea9d34033f1e0d9a770e1c49b6d9 (match). Build: `bun install --frozen-lockfile` (+ barcode-detector@3.2.2), compiled OK. Runtime: "No pending migrations to apply" (38), Ready, sin errores.
- Verificación HTTP en TESTING: `permissions-policy: camera=(self), microphone=(), geolocation=(self)`; CSP y X-Frame-Options sin cambios; `/vendor/zxing-wasm/3.1.3/zxing_reader.wasm` 200 `application/wasm` 1 093 289 bytes, SHA-256 idéntico; `/negocio` 200; `/api/negocio/productos` sin sesión 401; `/mozo/<slug>` 200.
- Verificación en navegador real (Chromium de escritorio, página /negocio de TESTING): `document.featurePolicy.allowsFeature("camera")` = true (micrófono false), contexto seguro, sin BarcodeDetector nativo (→ ruta ponyfill), y el WASM local COMPILA bajo la CSP en vivo. Esto NO certifica la cámara física.
- Otros servicios TESTING redeployados por el mismo push (sin cambios propios): chat en vivo, Mesa Occupancy Cron, Review Moderation Expiry.
- Production/DeliGO 6bf1ee84 @ 42ca500 sin cambios. Modo de reservas ON (lectura segura), 0 ACTIVA.

## 10. Riesgos y limitaciones
- Compatibilidad física NO certificada: iPhone PWA instalada tiene antecedentes de bugs de WebKit con la cámara (congelamiento, video rotado); si falla y Safari funciona, documentarlo y evaluar antes de certificar PWA.
- Umbrales del lock (2 frames / 700 ms / 1,2 s) a ajustar con el smoke: un reflejo largo (>700 ms sin decodificar con el producto quieto) podría rearmar.
- Rendimiento del WASM en teléfonos de gama baja sin BarcodeDetector nativo: no medido en dispositivo.
- iOS no tiene Vibration API (no-op); el sonido requiere el toque inicial (se prepara en el botón).
- La advertencia D5 usa el catálogo cargado (puede estar desactualizado); el 409 del checkout es la validación definitiva.
- El código del producto base sigue dentro de "Detalles avanzados" (no se alteró la experiencia de carga manual).
- `package-lock.json` sin la nueva dependencia (no usado por Railway).
- Más escrituras Serializable sobre `productos` (cambios de código): sin índice por negocio, PostgreSQL usa locks de predicado amplios y puede haber conflictos de serialización entre negocios bajo escrituras simultáneas; la guarda reintenta 3 veces y luego responde 409 `CONFLICTO_CONCURRENTE` (alta: mensaje existente). Ya ocurría con duplicar/reordenar (observado al correr pruebas reales en paralelo).

## 11. Rollback (sólo código)
- Sin schema ni migraciones: no hay rollback de base de datos. No desactivar reservas ON para resolver problemas del lector.
- Referencia de seguridad previa a la integración: tag local `f9-pre-integration-testing-codex` → `5fbfc60a8e521681e876bec5fc8bf8f7e18fcdb8` (HEAD previo de testing-codex).
- Rollback de TESTING: revertir el/los commits funcionales F9 en `testing-codex` con `git revert` (nuevo commit), push y verificar el autodeploy. El permiso `camera=(self)` vuelve a `camera=()` con el revert (Mozo vuelve a quedar bloqueado en Chromium).
- Datos creados con F9 (códigos cargados) son válidos sin el lector; no requieren limpieza.

## 12. Smoke físico del operador (pendiente)

Dispositivos: iPhone Safari · iPhone PWA instalada · Android Chrome · Android PWA instalada. Registrar cuáles se probaron; no declarar PASS en los no disponibles.

- **M1 — Escaneo continuo:** en Caja, abrir una vez la cámara, escanear tres productos distintos; los tres en el carrito; la cámara no se cerró entre lecturas.
- **M2 — Lecturas repetidas:** producto ~10 s frente a la cámara → una sola unidad; retirarlo y acercarlo → otra unidad.
- **M3 — Cantidades y cobro:** sopa, arroz y fideos; cerrar; sopa a 2 en el resumen; verificar total; confirmar una venta de prueba.
- **M4 — Variantes y desconocidos:** escanear una variante válida; un código no registrado; nada incorrecto agregado.
- **M5 — Carga de producto:** crear o editar un producto, escanear su código, el campo se completa; advertencia por duplicado.
- **M6 — Cámara y stock:** cerrar y reabrir (indicador de cámara apagado al cerrar); venta que supera el disponible por reservas → rechazo controlado sin venta parcial.

## 13. Estado R3A
Sin cambios en `stock-lifecycle.ts`, `stock-authority.ts`, checkout de Caja, rutas de pedidos ni tablas de reservas. `stockReservaModo=ON` leído en solo-lectura antes y después.
