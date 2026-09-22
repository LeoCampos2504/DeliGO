# P2-T52-A2 — Empleado + Salón Legacy PWA Artifact Cleanup Audit

Fecha: 2026-09-20
Alcance: AUDITORÍA READ-ONLY PROFUNDA + CONTRATO DE BORRADO SEGURO. Cero
implementación, cero borrado de archivo, cero edición de manifest/
role-config/DynamicManifest/service worker/push/auth/ruta/DB/schema/
migración, cero Production.

## 0. Autoridad — incluye un documento previo a esta sesión

Además de A0/A1 (esta sesión), existe una auditoría previa completa
sobre este mismo tema, `codex-reports/P2_OPERATIONS_SINGLE_PWA_IDENTITY_AUTHORITY_CORRECTION.md`
(2026-09-09) — **preservada sin reescribir**, se cita y se verifica que
sigue vigente en vez de re-derivar sus conclusiones desde cero. Esa
auditoría ya había clasificado con precisión: Empleado/Salón
"wireados pero funcionalmente inertes" (retirados) vs. Mozo
"genuinamente activo" — coincide punto por punto con A0/A1 de esta
sesión. A2 extiende esa base con un hallazgo NUEVO no cubierto en
2026-09-09 (ver §9).

```text
MOZO_ROUTE_CURRENTLY_FUNCTIONAL=SI (preservado, no auditado de nuevo)
KEEP_MOZO_ROUTES_FOR_COMPATIBILITY=SI
MOZO_ROUTE_REMOVAL_IN_R1=NO
MANIFEST_MOZO_DELETE=NO
ICON_MOZO_DELETE=NO
MOZO_PUSH_ICON_PRESERVED=SI
RECOMMENDED_MOZO_PUSH_TARGET=/mozo/panel/[slug] (sin cambios)
MOZO_SCOPE_TOUCHED=NO
```

## 1. Preflight

```text
WORKTREE_PATH=C:/Leo Campos/Trabajo/deligo-main-limpio
BRANCH=work/p2-t43-r2
START_HEAD_SHA=98341e2e083c479f2a938f1e2d4a9cb6ddfe9feb (== origin/testing-codex)
DIRTY_BEFORE=SI (2 archivos documentales pre-existentes + next-env.d.ts,
  artefacto auto-generado por `next dev` — ninguno es código de
  producto ajeno)
PRODUCT_CODE_DIRTY_AJENO=NO
```

Worktree T39 no tocado. `origin/main` en lectura únicamente:
`ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763`, sin cambios.

## 2. Rutas legacy Empleado — confirmado, no asumido

```text
EMPLOYEE_LEGACY_ROUTE=src/app/e/page.tsx (bare), src/app/e/[token]/page.tsx
EMPLOYEE_LEGACY_ROUTE_FUNCTIONALITY=pantalla estática única
  (<LegacyAccessRetired label="E" .../>) — server component SIN
  "use client", sin fetch, sin efectos, sin estado
EMPLOYEE_LEGACY_TOKEN_USED=NO (el segmento [token] existe porque
  Next.js lo exige estructuralmente, pero `page.tsx` no declara ningún
  parámetro — el valor nunca se lee)
EMPLOYEE_LEGACY_FETCH_USED=NO
EMPLOYEE_LEGACY_AUTH_USED=NO
```

`src/app/e/[token]/layout.tsx` sólo fija `metadata.referrer:
"no-referrer"` — ninguna llamada a `getPwaIdentityMetadata` (coherente
con que "empleado" es un rol `tokenBased`, fuera de
`PRINCIPAL_PWA_ROLES`, cuya identidad depende exclusivamente de
`DynamicManifest` en runtime, nunca de metadata SSR).

## 3. Rutas legacy Salón — confirmado, mismo patrón exacto

```text
SALON_LEGACY_ROUTE=src/app/s/page.tsx (bare), src/app/s/[token]/page.tsx
SALON_LEGACY_ROUTE_FUNCTIONALITY=pantalla estática única
  (<LegacyAccessRetired label="S" .../>) — idéntico patrón a Empleado
SALON_LEGACY_TOKEN_USED=NO
SALON_LEGACY_FETCH_USED=NO
SALON_LEGACY_AUTH_USED=NO
```

No se confunde con `/operaciones/mi-panel/[slug]/salon` (Salón
MODERNO, sesión `deligo_operativo_session`, área `areaOperativa=salon`)
— arquitectura de auth completamente distinta, intacta, no auditada de
nuevo en esta ronda (fuera de alcance, ya confirmada como Operaciones
moderno en A0/A1).

## 4. `LegacyAccessRetired` — componente compartido, desacoplado de PWA

```text
LEGACY_ACCESS_RETIRED_COMPONENT_PATH=src/components/legacy/legacy-access-retired.tsx
LEGACY_ACCESS_RETIRED_CONSUMERS=exactamente 4: src/app/e/page.tsx,
  src/app/e/[token]/page.tsx, src/app/s/page.tsx, src/app/s/[token]/page.tsx
  (grep exhaustivo, cero consumidores adicionales)
```

El componente es 100% autocontenido: props `label`/`badgeClassName`
(cosméticos), sin `"use client"`, sin importar `role-config.ts`,
`DynamicManifest`, ni ningún manifest. **Confirmado, no sólo
conceptual**: SÍ puede seguir mostrándose exactamente igual aunque se
elimine por completo la identidad PWA de Empleado/Salón — no hay
ningún acoplamiento entre ambos.

## 5. `role-config.ts` — tabla de campos, Empleado

| FIELD | VALUE | CONSUMERS | PWA_ONLY | OTHER_FUNCTIONAL_USE | SAFE_TO_REMOVE |
|---|---|---|---|---|---|
| `name`/`shortName`/`description`/`emoji`/`color` | "DeliGO Empleados"/... | `DynamicManifest` (title), `InstallPrompt` (banner) | SÍ | ninguno | SÍ (con el resto del entry) |
| `themeColor` | `#0891B2` | `DynamicManifest` (meta theme-color) | SÍ | ninguno | SÍ |
| `manifestFile` | `/manifest-empleado.json` | `DynamicManifest` (`<link rel=manifest>`), `src/app/api/manifest/route.ts` (lookup muerto, ver §14) | SÍ | ninguno | SÍ |
| `startUrl`/`loginUrl` | `/e` | NINGÚN consumidor real hoy — `getRoleForUserType()` nunca devuelve "empleado" (no es un `UserType` de sesión real), así que `wrong-role-notice.tsx`/`use-auth.ts` nunca lo alcanzan para este rol | SÍ (en teoría) | ninguno | SÍ |
| `icon192` | `/icon-empleado-192x192.png` | `DynamicManifest` (apple-touch-icon/favicon), `InstallPrompt` (imagen del banner) | SÍ **para este campo del role-config** — el ARCHIVO en sí tiene un consumidor independiente en `sw.js` (ver §12, NUNCA a través de este campo) | Push (por ruta de archivo hardcodeada en sw.js, no por este campo) | NO — el campo puede quitarse de role-config sin afectar Push (sw.js no lo importa), pero el ARCHIVO debe preservarse |
| `icon512` | `/icon-empleado-512x512.png` | `DynamicManifest`, manifest JSON (`icons[]`), tests genéricos de contrato (`pwa-role-icon-contract.test.ts`, pero ESE test excluye explícitamente a "empleado" de su set `ROLES_WITH_REFRESHED_ICONS`) | SÍ | ninguno | SÍ |
| `gradientFrom`/`gradientTo`/`shadowColor` | `from-cyan-500`/`to-teal-600`/`shadow-cyan-500/20` | `InstallPrompt` (estilos del banner) | SÍ | ninguno | SÍ |
| `tokenBased: true` | — | `getRoleFromPath()`/`getTokenFromPath()` (mecanismo de detección de rol) | SÍ (estructural) | ninguno | SÍ, PERO requiere tocar `getRoleFromPath`/`getTokenFromPath` en el mismo cambio (ver §8) |
| `pathPrefix: "/e/"` | — | documental/estructural, no leído por ningún consumidor en runtime (el path-matching real vive hardcodeado dentro de `getRoleFromPath`, no lee este campo) | SÍ | ninguno | SÍ |

## 6. `role-config.ts` — tabla de campos, Salón

Idéntica estructura, mismos resultados:

| FIELD | VALUE | CONSUMERS | PWA_ONLY | OTHER_FUNCTIONAL_USE | SAFE_TO_REMOVE |
|---|---|---|---|---|---|
| `name`/`shortName`/`description`/`emoji`/`color` | "DeliGO Salón"/... | `DynamicManifest`, `InstallPrompt` | SÍ | ninguno | SÍ |
| `themeColor` | `#475569` | `DynamicManifest` | SÍ | ninguno | SÍ |
| `manifestFile` | `/manifest-salon.json` | `DynamicManifest`, `/api/manifest/route.ts` (muerto) | SÍ | ninguno | SÍ |
| `startUrl`/`loginUrl` | `/s` | ninguno real (mismo razonamiento que Empleado) | SÍ | ninguno | SÍ |
| `icon192` | `/icon-salon-192x192.png` | `DynamicManifest`, `InstallPrompt` — el ARCHIVO tiene consumidor independiente en `sw.js` | ver nota Empleado | Push (ruta hardcodeada) | NO borrar el archivo; SÍ se puede quitar el campo de role-config |
| `icon512` | `/icon-salon-512x512.png` | `DynamicManifest`, manifest JSON, excluido de `pwa-role-icon-contract.test.ts` | SÍ | ninguno | SÍ |
| `gradientFrom`/`gradientTo`/`shadowColor` | `from-slate-600`/`to-slate-800`/`shadow-slate-500/20` | `InstallPrompt` | SÍ | ninguno | SÍ |
| `tokenBased: true` | — | `getRoleFromPath`/`getTokenFromPath` | SÍ | ninguno | SÍ, con el mismo requisito que Empleado |
| `pathPrefix: "/s/"` | — | documental | SÍ | ninguno | SÍ |

## 7. `getRoleFromPath()` — efecto de quitar los roles

```text
EMPLOYEE_GET_ROLE_FROM_PATH_EFFECT=si se quita la rama
  `if (pathname.startsWith("/e/") || pathname === "/e") return "empleado"`
  Y el tipo `DeliGORole`/`ROLE_CONFIGS` ya no tiene "empleado", el
  fallback final de la función ("cliente") tomaría el control para
  /e/** — cosmético únicamente: DynamicManifest mostraría manifest/
  tema/título de Cliente mientras el usuario ve la pantalla
  LegacyAccessRetired de Empleado. LegacyAccessRetired en sí NO se ve
  afectada (§4).
SALON_GET_ROLE_FROM_PATH_EFFECT=idéntico razonamiento para /s/**.
```

Importante: `Record<DeliGORole, RoleConfig>` en TypeScript EXIGE que
`ROLE_CONFIGS` tenga una entrada para cada valor del union type
`DeliGORole` — quitar las entradas "empleado"/"salon" de
`ROLE_CONFIGS` sin quitarlas TAMBIÉN del union type `DeliGORole` y de
`getRoleFromPath` produce un error de compilación. Es decir, un
cleanup de role-config real es un cambio COORDINADO de 3 partes (tipo +
objeto + función de detección), no la eliminación aislada de 2 líneas
— información relevante para dimensionar correctamente cualquier R1B
futuro.

## 8. `DynamicManifest` en `/e/test` y `/s/test` — comportamiento exacto

```text
EMPLOYEE_DYNAMIC_PWA_IDENTITY=manifest=/manifest-empleado.json,
  theme-color=#0891B2, apple-touch-icon=/icon-empleado-192x192.png,
  title="DeliGO Empleados - Pedidos, reseñas y chat del negocio"
SALON_DYNAMIC_PWA_IDENTITY=manifest=/manifest-salon.json,
  theme-color=#475569, apple-touch-icon=/icon-salon-192x192.png,
  title="DeliGO Salón - Vista en vivo del salón y pedidos"
```

Pregunta central del task spec — **respondida con evidencia, SÍ es
posible**:

```text
EMPLOYEE_PWA_IDENTITY_REMOVAL_SAFE=SI (funcionalmente — LegacyAccessRetired
  no depende de esto; el único costo es cosmético, ver §7)
SALON_PWA_IDENTITY_REMOVAL_SAFE=SI (mismo razonamiento)
```

## 9. Hallazgo NUEVO de esta ronda — `install-prompt.tsx` SÍ promueve instalar Empleado/Salón hoy

Este es el hallazgo más importante y accionable de A2, **no cubierto
por la auditoría de 2026-09-09** (que se centró en `DynamicManifest`/
`role-config.ts`, no en `install-prompt.tsx` para estos dos roles).

A1 (esta sesión) confirmó que `install-prompt.tsx` YA excluye
explícitamente `/mozo` (`isMozoRoute()`). **Auditoría de código
confirma que NO existe ninguna exclusión equivalente para `/e` ni
`/s`** — leído el archivo completo (645 líneas): la única condición de
salida temprana es `isMozoRoute(pathname)`. Esto significa que,
técnicamente, si un usuario llega a `/e/{token}` o `/s/{token}` (un
enlace guardado, un marcador viejo, un QR físico impreso hace tiempo)
y su navegador cumple las condiciones de instalabilidad, el banner
personalizado de DeliGO **SÍ puede ofrecer "Instalar DeliGO
Empleados"/"Instalar DeliGO Salón"** — una PWA cuyo ÚNICO contenido
posible es la pantalla estática "Este acceso fue reemplazado".

```text
EMPLOYEE_INSTALL_PROMPT_AVAILABLE=SI (no excluido — a diferencia de Mozo)
SALON_INSTALL_PROMPT_AVAILABLE=SI (no excluido — a diferencia de Mozo)
```

Esto es, en los propios términos del task spec (§16), un **bug/residuo
real**, no sólo un artefacto inerte: promueve activamente instalar una
app que no puede hacer nada más que redirigir de vuelta a Operaciones.
Es el ÚNICO ítem de esta auditoría con una corrección de código de
bajo riesgo y valor real y concreto (ver §22/§24).

## 10. `permission-prompt.tsx` — no aplica a Empleado/Salón en absoluto

```text
EMPLOYEE_PERMISSION_PROMPT_AVAILABLE=NO_APLICA
SALON_PERMISSION_PROMPT_AVAILABLE=NO_APLICA
```

Confirmado leyendo el archivo completo: `PermissionPrompt` NO importa
`role-config.ts`, NO conoce ningún rol por nombre — su única exclusión
explícita es `isMozoRoute()` (irrelevante acá) y, más
determinantemente, su efecto principal exige `isAuth && uType`
(`useAuthStore`) — en `/e`/`/s` no existe ninguna sesión de
Cliente/Negocio/Repartidor activa (son pantallas públicas sin
`"use client"` de estado), así que el banner nunca podría activarse
ahí por ausencia de actor autenticado, no por una exclusión de rol.
Sin cambios necesarios ni posibles aquí.

## 11. Manifest Empleado — referencias completas

```text
EMPLOYEE_MANIFEST_REFERENCE_COUNT=2 archivos de código (role-config.ts
  campo `manifestFile`, api/manifest/route.ts lookup table) + su propio
  archivo `public/manifest-empleado.json` + su cobertura implícita en
  DynamicManifest (vía el campo, no una referencia literal nueva)
EMPLOYEE_MANIFEST_REFERENCES=
  - src/lib/role-config.ts:113 (RUNTIME — campo `manifestFile`)
  - src/app/api/manifest/route.ts:10 (DEAD — endpoint sin ningún caller
    en todo el repo, ver §14)
  - Ningún test, ningún doc de código, ninguna otra referencia activa
```

Contenido de `public/manifest-empleado.json` (auditado): `id:
"/e/?pwa=empleado"`, `start_url: "/e/"`, `scope: "/e/"`, `display:
standalone`, `theme_color: "#0891B2"`, `icons` apuntando a
`icon-empleado-192x192.png`/`icon-empleado-512x512.png` (any +
maskable, mismo archivo para ambos "purpose" — sin derivado maskable
dedicado, confirmado por `pwa-role-icon-contract.test.ts` línea
198-202).

## 12. Manifest Salón — referencias completas

```text
SALON_MANIFEST_REFERENCE_COUNT=mismo patrón exacto que Empleado
SALON_MANIFEST_REFERENCES=
  - src/lib/role-config.ts:132 (RUNTIME)
  - src/app/api/manifest/route.ts:9 (DEAD)
  - Ningún test, ningún doc de código adicional
```

Contenido de `public/manifest-salon.json`: `id: "/s/?pwa=salon"`,
`start_url: "/s/"`, `scope: "/s/"`, `theme_color: "#475569"`, íconos
`icon-salon-192x192.png`/`icon-salon-512x512.png` (mismo patrón any+
maskable compartido).

## 13. Iconos Empleado — inventario completo

Dimensiones reales verificadas por lectura directa del header PNG (no
asumidas): **ambos archivos declaran en su nombre un tamaño que NO
coincide con su tamaño real** — hallazgo que precisa, sin contradecir,
al reporte de 2026-09-09 (que sólo caracterizó el de 512 como
"corrupto" tras inspección visual; la medición exacta de esta ronda
muestra que el de 192 TAMPOCO coincide con su nombre, aunque
visualmente sigue siendo un ícono completo y utilizable):

| ASSET | REAL_SIZE | PWA_REFERENCE | PUSH_REFERENCE | SW_REFERENCE | UI_REFERENCE | TEST_REFERENCE | DOC_REFERENCE | SAFE_DELETE |
|---|---|---|---|---|---|---|---|---|
| `icon-empleado-192x192.png` | 800×800 real (nombre dice 192×192) | role-config.ts `icon192`, manifest "any"+"maskable" | **SÍ, ACTIVO HOY** — `sw.js:465` lo usa como ícono de fallback para notificaciones de tipo `operaciones_order_cancelled` cuando `area !== "salon"` (áreas PyR) | `sw.js:465` (string literal hardcodeado, NO vía role-config) | `DynamicManifest`, `InstallPrompt` | excluido explícitamente de `pwa-role-icon-contract.test.ts` (`ROLES_WITH_REFRESHED_ICONS` no lo incluye) | P2_OPERATIONS_SINGLE_PWA_IDENTITY_AUTHORITY_CORRECTION.md §3.3/§6 | **NO** — uso de Push activo, independiente de cualquier limpieza de PWA |
| `icon-empleado-512x512.png` | 2133×2133 real (nombre dice 512×512) | role-config.ts `icon512`, manifest "any"+"maskable" | NO (ningún código de Push referencia el ícono 512 de ningún rol) | NO | ninguna (sólo se serviría si un launcher pidiera explícitamente 512, sin consumidor UI en React) | excluido de `pwa-role-icon-contract.test.ts`, incluido en el test de "sin maskable dedicado" (línea 198-202, sólo verifica AUSENCIA de un derivado, no depende de que este archivo exista) | mismo reporte 2026-09-09 §4 | **SÍ, candidato — pero NO ejecutado en esta ronda** (requiere quitar también las 2 entradas "512" del manifest JSON en el mismo cambio, para no dejar un `icons[].src` roto) |

## 14. Iconos Salón — inventario completo (mismo patrón, con la salvedad crítica de Push)

| ASSET | REAL_SIZE | PWA_REFERENCE | PUSH_REFERENCE | SW_REFERENCE | UI_REFERENCE | TEST_REFERENCE | DOC_REFERENCE | SAFE_DELETE |
|---|---|---|---|---|---|---|---|---|
| `icon-salon-192x192.png` | 800×800 real | role-config.ts `icon192`, manifest | **SÍ, ACTIVO HOY** — `sw.js:461` lo usa para `salon_new_order`/`operaciones_salon_new_order`, y como ícono cuando `area === "salon"` en `operaciones_order_cancelled` | `sw.js:461,464` (hardcodeado) | `DynamicManifest`, `InstallPrompt` | excluido de `pwa-role-icon-contract.test.ts` | mismo reporte §3.4/§6 | **NO** — uso de Push activo (confirmado: `salonNewOrderNotification()` en `src/lib/push.ts` sigue siendo llamado hoy desde 2 flujos de pedido real: `src/app/api/operativo/mozo/panel/[slug]/pedidos/route.ts` y `src/app/api/pedidos/route.ts`) |
| `icon-salon-512x512.png` | 2133×2133 real | role-config.ts `icon512`, manifest | NO | NO | ninguna | excluido/incluido en los mismos tests que Empleado | mismo reporte §4 | **SÍ, candidato — NO ejecutado**, mismo requisito de coordinar con el manifest JSON |

## 15. Push — dependencias exactas de Empleado/Salón (sin cambiar Push)

```text
EMPLOYEE_PUSH_DEPENDENCIES=icon-empleado-192x192.png (ACTIVO, fallback
  de área no-salón en operaciones_order_cancelled — ver sw.js:465).
  El tipo de notificación "empleados_new_order"/"empleados_new_review"
  YA fue retirado ("Legacy-Cleanup-1C.1", confirmado en A0/A1) — sin
  consumidor moderno, cero dependencia funcional del ROL "empleado"
  más allá de ese ícono compartido.
SALON_PUSH_DEPENDENCIES=icon-salon-192x192.png (ACTIVO, tipos
  `salon_new_order`/`operaciones_salon_new_order`). HALLAZGO
  ADICIONAL: `salon_new_order` (el tipo LEGACY, no
  `operaciones_salon_new_order`) sigue siendo generado HOY por
  `salonNewOrderNotification()` desde 2 flujos de pedido activos y
  reales (mozo manual + checkout de Cliente) — pero su manejo en
  `sw.js` (líneas 1109-1140) NUNCA navega a `/s/{token}` fresco: sólo
  intenta enfocar (`.focus()`, sin `.navigate()`) una pestaña YA
  abierta con prefijo `/s/`, y en el peor caso abre `/cliente/` — es
  decir, el string `/s/` sigue teniendo relevancia residual en el
  matching de clientes ya abiertos, pero NO depende de que la ruta
  `/s/{token}` exista/sirva contenido nuevo para funcionar sin
  romperse. Esto es una observación de comportamiento pre-existente,
  documentada, NO una propuesta de cambio (Push/SW fuera de alcance
  de A2).
```

## 16. Service Worker — inventario exhaustivo de referencias a Empleado/Salón

| LINE/PATTERN | PURPOSE | LEGACY_OR_ACTIVE | REMOVE_WITH_PWA_CLEANUP | KEEP |
|---|---|---|---|---|
| `sw.js:434` (comentario) | documenta valores posibles de `role` en el payload | documental | — | KEEP |
| `sw.js:460-465` | selección de ícono por tipo/área (`icon-salon-192x192.png`/`icon-empleado-192x192.png`) | **ACTIVO** | NO — independiente de cualquier limpieza de identidad PWA | KEEP |
| `sw.js:894-946` | distingue `operaciones_salon_new_order`/`operaciones_order_cancelled` (MODERNO, área Operaciones) de la lógica legacy de abajo | ACTIVO (moderno) | NO | KEEP |
| `sw.js:1066-1071` (comentarios) | documenta que `empleados_new_order`/`empleados_new_review` YA fueron retirados ("Legacy-Cleanup-1C.1") | histórico/documental | NO | KEEP (es evidencia de limpieza previa, no código a tocar) |
| `sw.js:1072-1107` | manejo de `mesa_order_ready` con `directMozoPanelUrl` — rama de Mozo, no de Empleado/Salón | ACTIVO (Mozo) | NO — fuera de alcance de A2 | KEEP |
| `sw.js:1109-1140` | manejo legacy de `salon_new_order` — sólo `.focus()` sobre clientes ya abiertos con prefijo `/s/`, nunca `.navigate()` fresco; fallback final `/cliente/` | **ACTIVO** (el tipo `salon_new_order` se sigue emitiendo, ver §15) | NO — cambiarlo es una decisión de Push/SW, explícitamente fuera de alcance | KEEP |

Ninguna línea de `sw.js` referencia `manifest-empleado.json`,
`manifest-salon.json`, `icon-empleado-512`, ni `icon-salon-512` — el
Service Worker NUNCA lee manifests, y sólo conoce las rutas de ícono
192 por string literal hardcodeado (nunca importa `role-config.ts`).
Esto significa: **el Service Worker es completamente inmune a
cualquier cambio futuro en `role-config.ts`/manifests/`icon512`** — no
hay ningún acoplamiento a auditar más allá de lo ya listado.

## 17. APIs legacy — confirmado inexistentes, sin alias históricos

```text
EMPLOYEE_LEGACY_API_EXISTS=NO (src/app/api/empleado/ no existe;
  búsqueda adicional de alias — "empleado-legacy", "api/e/" — sin
  resultados)
SALON_LEGACY_API_EXISTS=NO (src/app/api/salon/ no existe; misma
  búsqueda de alias sin resultados)
```

## 18. Token legacy — sin consumidores reales

```text
EMPLOYEE_TOKEN_CURRENT_CONSUMERS=0 (grep exhaustivo de `Empleado.token`
  y variantes de acceso al campo en src/lib, src/app/api/operativo:
  cero resultados — el campo `token String? // token para
  notificaciones push` del schema es, en la práctica, un residuo del
  mecanismo de push ANTERIOR al `pushSubscription` JSON moderno, que
  SÍ tiene consumidores activos confirmados en T46/T47 de esta sesión)
SALON_TOKEN_CURRENT_CONSUMERS=N/A — no existe un campo de token
  dedicado a "Salón" en el modelo `Empleado` ni en ningún otro modelo;
  el token de `/s/{token}` pertenecía al mecanismo legacy ya retirado
  por completo (Legacy-Cleanup-1B), sin persistencia actual que
  auditar
```

```text
SCHEMA_FIELD_REMOVAL_IN_T52=NO (confirmado, sin excepción — ningún
  cambio de schema se propone ni se ejecuta en T52)
```

## 19. Instalaciones existentes — distinguir 3 acciones independientes

```text
EMPLOYEE_EXISTING_INSTALL_COMPATIBILITY=si alguien instaló "DeliGO
  Empleados" en el pasado, su ícono sigue abriendo `/e/` (start_url
  registrado), que HOY YA muestra únicamente la pantalla de retiro con
  botones hacia Operaciones — es decir, la propia app instalada YA
  actúa como un mecanismo de compatibilidad/aviso, sin necesidad de
  ningún cambio adicional.
SALON_EXISTING_INSTALL_COMPATIBILITY=idéntico razonamiento para "DeliGO Salón".
```

Confirmado, no se asume: `STOP_NEW_INSTALLABILITY` (§9, corregir
`install-prompt.tsx`), `DELETE_MANIFEST_FILE` (§13/§14, candidato
futuro opcional) y `DELETE_ROUTE` (nunca propuesto, ni en A2 ni en
ninguna fase) son genuinamente tres acciones independientes — esta
auditoría sólo encuentra justificación de riesgo/valor suficiente para
la primera.

## 20. Objetivo recomendado — evaluado punto por punto

```text
A. Mantener /e/[token] y /s/[token] como compatibility tombstones — SÍ,
   confirmado seguro (§2-4), cero cambio necesario.
B. Dejar de anunciar identidades PWA NUEVAS de Empleado/Salón — SÍ,
   accionable y de bajo riesgo ÚNICAMENTE vía install-prompt.tsx (§9);
   DynamicManifest/role-config NO requieren tocarse para lograr este
   objetivo (mismo patrón exacto que la conclusión de A1 para Mozo).
C. Mantener manifiestos/assets antiguos si son necesarios para
   instalaciones ya existentes — SÍ, confirmado (§19): los manifests y
   los íconos 192 deben preservarse; sólo los íconos 512 (sin ningún
   consumidor, ver §13/§14) son candidatos de limpieza opcional futura.
D. No tocar Operaciones moderno — confirmado, cero archivo de
   Operaciones tocado o propuesto en esta auditoría.
```

Los 4 puntos son técnicamente seguros según la evidencia reunida.

## 21. Opciones (máximo 3)

### OPTION_A — Compatibility tombstone + stop new installability (RECOMENDADA)

Mantener todo exactamente como está EXCEPTO agregar `/e` y `/s` a la
exclusión de `install-prompt.tsx` (mismo patrón textual que
`isMozoRoute()`, ya probado en producción). `role-config.ts`,
manifests e íconos quedan intactos.

```text
PRODUCT_RISK=MUY BAJO — mismo patrón ya usado y probado para Mozo, un
  archivo tocado, ninguna lógica nueva inventada
LEGACY_INSTALL_RISK=NINGUNO — no afecta instalaciones ya existentes en
  absoluto (install-prompt sólo decide si ofrecer una instalación
  NUEVA, nunca interactúa con una ya hecha)
PUSH_RISK=NINGUNO — sw.js no importa install-prompt.tsx ni role-config.ts
DIFF_SIZE=~3-5 líneas
ROLLBACK=trivial, revertir la condición agregada
VALUE=resuelve el ÚNICO residuo/bug real confirmado en esta auditoría
  (§9) — deja de promover instalar una PWA que sólo muestra una
  pantalla de "reemplazado"
```

### OPTION_B — Eliminar manifests/role-config PWA pero conservar rutas tombstone

Quitar las entradas "empleado"/"salon" de `ROLE_CONFIGS` (requiere
coordinar `DeliGORole` union type + `getRoleFromPath` + `getTokenFromPath`,
ver §7) — `install-prompt`/`DynamicManifest` caerían al fallback
"cliente" en `/e`/`/s`.

```text
PRODUCT_RISK=MEDIO — toca un tipo compartido (`DeliGORole`) y una
  función usada por TODOS los roles (`getRoleFromPath`), mayor
  superficie que Option A
LEGACY_INSTALL_RISK=NINGUNO funcional (la app instalada sigue abriendo
  su start_url y mostrando la tombstone), pero SÍ pierde su identidad
  visual propia (tema/ícono) durante esa sesión — degradación
  cosmética, no funcional
PUSH_RISK=NINGUNO (confirmado en §16: sw.js no depende de role-config.ts)
DIFF_SIZE=~15-25 líneas en 2-3 archivos
ROLLBACK=moderado (revertir 3 partes coordinadas)
VALUE=marginal sobre Option A — el objetivo real (dejar de promover
  instalación nueva) YA se logra con Option A; esto sólo limpia código
  fuente sin cambiar ningún comportamiento observable adicional
```

### OPTION_C — Eliminar también manifests/íconos-512

Además de B, borrar `manifest-empleado.json`/`manifest-salon.json` y
`icon-empleado-512x512.png`/`icon-salon-512x512.png`.

```text
PRODUCT_RISK=MEDIO-ALTO — borrado de archivos explícitamente prohibido
  en esta ronda (§20 del task spec), y en general requiere confirmar
  cero riesgo de instalaciones existentes que pidan ese manifest
LEGACY_INSTALL_RISK=BAJO pero no cero — una instalación existente que
  dispare una verificación de actualización de manifest (ver
  investigación de A1 sobre el ciclo de update de Chrome) encontraría
  un 404 en vez de un manifest sin cambios; el comportamiento exacto
  ante un manifest 404 en una PWA ya instalada no está cubierto por la
  documentación oficial consultada en A1 — vacío de evidencia, no un
  "seguro confirmado"
PUSH_RISK=NINGUNO (los íconos 192, los únicos que usa Push, se
  preservan siempre)
DIFF_SIZE=mayor, incluye borrado de binarios
ROLLBACK=requiere restaurar archivos binarios desde git history
VALUE=limpieza de disco menor, sin ningún beneficio funcional
  observable por el usuario
```

```text
OPTION_A=Compatibility tombstone + stop new installability (sólo install-prompt.tsx)
OPTION_B=Eliminar wiring de role-config/DynamicManifest, conservar rutas
OPTION_C=Eliminar también manifests/íconos-512
RECOMMENDED_OPTION=OPTION_A
```

## 22. Safe Delete Matrix — obligatoria, completa

| ARTIFACT | EMPLOYEE_OR_SALON | CURRENT_CONSUMERS | ACTIVE_FUNCTION | EXISTING_INSTALL_COMPAT | PUSH_USE | SAFE_DELETE_NOW | SAFE_STOP_REFERENCING | KEEP_TEMPORARILY | REASON |
|---|---|---|---|---|---|---|---|---|---|
| `src/app/e/page.tsx`, `src/app/e/[token]/page.tsx` | Employee | LegacyAccessRetired | SÍ (tombstone) | requerido | NO | NO | NO | SÍ | única vía de compatibilidad para instalaciones/bookmarks existentes |
| `src/app/s/page.tsx`, `src/app/s/[token]/page.tsx` | Salon | LegacyAccessRetired | SÍ (tombstone) | requerido | NO | NO | NO | SÍ | idéntico |
| `role-config.ts` entry "empleado" | Employee | DynamicManifest, InstallPrompt (vía path) | SÍ (cosmético) | parcial (identidad visual) | NO | NO | SÍ (Option B, futuro opcional) | SÍ | quitar requiere tocar tipo compartido + función compartida |
| `role-config.ts` entry "salon" | Salon | idéntico | SÍ (cosmético) | parcial | NO | NO | SÍ (futuro opcional) | SÍ | idéntico |
| `public/manifest-empleado.json` | Employee | role-config.ts, DynamicManifest | SÍ (cosmético) | requerido (start_url/scope) | NO | NO | NO (mientras existan instalaciones) | SÍ | riesgo de 404 en ciclo de update no documentado por fuentes oficiales |
| `public/manifest-salon.json` | Salon | idéntico | SÍ (cosmético) | requerido | NO | NO | NO | SÍ | idéntico |
| `public/icon-empleado-192x192.png` | Employee | role-config.ts, sw.js (hardcoded) | SÍ | requerido | **SÍ, ACTIVO** | **NO** | **NO** | SÍ (permanente) | dependencia de Push real hoy — nunca tocar |
| `public/icon-salon-192x192.png` | Salon | role-config.ts, sw.js (hardcoded) | SÍ | requerido | **SÍ, ACTIVO** | **NO** | **NO** | SÍ (permanente) | dependencia de Push real hoy — nunca tocar |
| `public/icon-empleado-512x512.png` | Employee | role-config.ts, manifest JSON | NO (cosmético, sin consumidor UI real) | opcional | NO | **SÍ, candidato** (no ejecutado) | — | SÍ (esta ronda) | requiere coordinar con el manifest JSON en el mismo cambio |
| `public/icon-salon-512x512.png` | Salon | idéntico | NO | opcional | NO | **SÍ, candidato** (no ejecutado) | — | SÍ (esta ronda) | idéntico |
| `install-prompt.tsx` (falta de exclusión) | Ambos | — | **BUG activo** (§9) | N/A | N/A | N/A (es código a MODIFICAR, no a borrar) | — | — | único ítem accionable real de esta auditoría |
| `src/app/api/manifest/route.ts` | Ambos (y todos los demás roles) | ninguno (grep exhaustivo sin callers) | NO | N/A | NO | candidato de limpieza, pero fuera de alcance específico de Empleado/Salón (afecta TODOS los roles del lookup) | — | SÍ | hallazgo lateral, no forma parte de esta auditoría específica |

## 23. Plan R1B — sólo si se autoriza en el futuro (NO implementado)

| PATH | CHANGE | WHY | RISK | ROLLBACK |
|---|---|---|---|---|
| `src/components/shared/install-prompt.tsx` | Agregar `/e` y `/s` a la condición de exclusión (mismo patrón que `isMozoRoute()`, ej. una función `isLegacyTombstoneRoute()` que cubra `/mozo`, `/e`, `/s`) | Deja de promover instalar una PWA cuyo único contenido es una pantalla de retiro — el único bug/residuo real confirmado en A2 | BAJO | trivial, revertir la condición |

```text
R1B_PRODUCT_FILES_PLANNED=1 (src/components/shared/install-prompt.tsx,
  SI se autoriza — no implementado en A2)
R1B_MANIFEST_FILES_PLANNED=0
R1B_ASSET_FILES_PLANNED=0
R1B_TEST_FILES_PLANNED=1 sugerido (test estático confirmando que
  isMozoRoute-equivalente también excluye /e y /s)
```

## 24. Plan de tests futuro (diseñado, NO implementado)

```text
A. /e/[token] sigue mostrando LegacyAccessRetired — regresión estática
B. /s/[token] sigue mostrando LegacyAccessRetired — regresión estática
C. Los botones de LegacyAccessRetired llevan a /operaciones/ingresar,
   /operaciones/registro, / — assert exacto de los 3 hrefs
D. Sin fetch legacy — assert que page.tsx no contiene "fetch("
E. Sin auth token legacy activa — assert ausencia de lectura de params.token
F. Sin API legacy — confirmar que src/app/api/empleado y
   src/app/api/salon siguen sin existir (test de "directorio ausente"
   o simplemente omitir, ya confirmado por auditoría de código)
G. Operaciones Salón moderno intacto — regresión de
   /operaciones/mi-panel/[slug]/salon sin cambios
H. Operaciones PyR intacto — regresión sin cambios
I. Mozo intacto — regresión de A0/A1, sin cambios en esta ronda
J. Push Salón intacto — confirmar que salonNewOrderNotification() y
   la selección de ícono en sw.js siguen funcionando sin cambios
K. manifest-operaciones.json intacto
L. (si se ejecuta R1B) install-prompt.tsx NO se renderiza bajo
   pathname "/e" ni "/s" (test estático, mismo patrón que Mozo)
M. Instalaciones antiguas de Empleado/Salón (si existieran) siguen
   abriendo su start_url y mostrando LegacyAccessRetired sin cambios —
   no verificable sin dispositivo real
```

## 25. Decisión de cierre de T52

```text
T52_REMAINING_ACTIONABLE_CODE=SI — exactamente 1 ítem: agregar /e y /s
  a la exclusión de install-prompt.tsx (§9, §21 Option A, §23)
```

T52 NO puede cerrarse todavía como "sin cambios funcionales" (opción A
del §28 del task spec) porque SÍ existe un residuo real y accionable
de bajo riesgo. Tampoco requiere un R1B de limpieza técnica amplio
(manifest/role-config/iconos) — eso queda como deuda opcional, no
bloqueante, consistente con la disposición ya registrada en
`P2_OPERATIONS_SINGLE_PWA_IDENTITY_AUTHORITY_CORRECTION.md` desde
2026-09-09. Tampoco queda ninguna decisión de producto pendiente sobre
instalaciones legacy — la estrategia de conservarlas intactas como
compatibility tombstones ya está confirmada segura.

Recomendación: **proponer T52-R1B acotado** (un solo archivo,
`install-prompt.tsx`) como la única implementación pendiente de T52,
separada de cualquier decisión futura sobre Fase 4 de Mozo (A1, push
target) o limpieza opcional de assets 512/role-config (§21 Option B/C,
sin urgencia).

## 26. No se tocó Mozo ni otras tareas

```text
MOZO_SCOPE_TOUCHED=NO
T38_TOUCHED=NO
T40_TOUCHED=NO
T44_TOUCHED=NO
T39_TOUCHED=NO
T46_R2_TOUCHED=NO
T51_TOUCHED=NO
```

## 27. Cierre de esta ronda (A2)

```text
PRODUCT_FILES_CHANGED_DURING_A2=0
MANIFEST_FILES_CHANGED=0
ROLE_CONFIG_CHANGED=0
DYNAMIC_MANIFEST_CHANGED=0
SERVICE_WORKER_CHANGED=0
PUSH_CHANGED=0
AUTH_CHANGED=NO
DB_CHANGED=NO
SCHEMA_CHANGED=NO
MIGRATION_CREATED=NO
PRODUCTION_TOUCHED=NO
```
