# FINDINGS REGISTRY — DeliGO

## CURRENT FINDINGS AUTHORITY — POST-P2-T46-R1 (2026-09-11)

La autoridad vigente de findings se reconcilia con
`codex-reports/ROADMAP.md` §CURRENT AUTHORITATIVE BACKLOG. Las entradas
históricas inferiores se preservan, pero no sustituyen estos estados.

```text
PREVIOUS_OCCUPATION_OPEN_ORDERS_SURFACE_FINDING_STATUS=RESOLVED_BY_P2_T46
PREVIOUS_OCCUPATION_CURRENT_SURFACE_ISOLATION=PASS
PREVIOUS_OCCUPATION_FINDING_OWNER=P2-T46
PREVIOUS_OCCUPATION_FINDING_OWNER_STATUS=CLOSED_PRODUCTION
LEGACY_NULL_OCCUPATION_INFERENCE=NO
LEGACY_NULL_OCCUPATION_BACKFILL=NO
LEGACY_ACCOUNTING_RECONSTRUCTION=NO

NEGOCIO_OCCUPATION_CLOSE_LIVE_REFRESH_BUG=CONFIRMED_PHYSICAL
NEGOCIO_REFRESH_FINDING_STATUS=OPEN
NEGOCIO_REFRESH_EXISTING_TASK_OWNER=NONE
NEGOCIO_REFRESH_PRIORITY=TO_BE_TRIAGED
NEGOCIO_REFRESH_FORMALIZED_TASK=P2-T53
NEGOCIO_REFRESH_FIX_INCLUDED_IN_T46=NO
```

## CURRENT T02 FINDINGS AUTHORITY — P2-T02-R5 (2026-09-12)

La recertificación física reportada por el operador resuelve el finding de
elegibilidad para el flujo normal de aceptación R4. La observación de una ruta
en overview, sin seguimiento de cámara tipo Google Maps, no se clasifica como
bug de R4: es un requisito UX nuevo y separado.

```text
P2_T02_R4_STATUS=PHYSICALLY_CERTIFIED_NORMAL_FLOW
R4_NORMAL_DRIVER_ACCOUNT_USED=SI
R4_NORMAL_ORDER_FLOW_USED=SI
R4_FIXTURE_ACCOUNT_USED=NO
R4_NORMAL_ACCEPT_FLOW=PASS
R4_DRIVER_GPS_NOW_WORKS=PASS
R4_IN_APP_NAVIGATION_OPENS=PASS
R4_IN_APP_ROUTE_RENDERED=PASS
R4_FIXTURE_PARITY_FINDING=RESOLVED_FOR_NORMAL_ACCEPT_FLOW
R4_NORMAL_FLOW_FIX=PASS
R4_ROOT_CAUSE=CLOSED_FOR_NORMAL_ACCEPT_FLOW

CURRENT_REPARTIDOR_NAVIGATION=ROUTE_OVERVIEW
NAVIGATION_GOOGLE_MAPS_LIKE_FOLLOW_MODE=NEW_PRODUCT_UX_REQUIREMENT
NAVIGATION_UX_IS_R4_REGRESSION=NO
DRIVER_NAVIGATION_UX_TASK_REQUIRED=SI
DRIVER_NAVIGATION_UX_TASK_ID=P2-T54
DRIVER_NAVIGATION_UX_TASK_TITLE=Driver Turn-by-Turn Follow Camera UX
T23_NAVIGATION_FOLLOW_SCOPE=PARTIAL
T24_NAVIGATION_MAP_MATCHING_SCOPE=CONFIRMED_RELATED
```

El alcance futuro debe cubrir cámara follow suave con posición del repartidor
por debajo del centro, recenter tras interacción manual, heading/bearing,
maniobra inmediata, distancia/ETA/destino y comportamiento seguro con mínima
interacción. La recomendación de renderer se mantiene como decisión técnica
pendiente: auditar Leaflet 1.9.4 contra MapLibre GL específicamente para cámara,
orientación y rendimiento móvil; no cambiar proveedor de tiles/routing en R5.

El finding de fuga visual de pedidos de la ocupación anterior queda resuelto
por el aislamiento de superficie actual certificado en T46; esto no afirma
reconstrucción de cuentas históricas con `ocupacionMesaId=NULL`. El finding
independiente de refresh en vivo de Negocio sigue abierto y se formaliza como
P2-T53 sin reabrir T48/T46 ni inventar una prioridad.

## F-P2-T02-R5A-CLIENT-TRACKING-SAFE-AREA-01 — corrección desplegada, recertificación física pendiente (2026-09-12)

```text
FINDING_ID=F-P2-T02-R5A-CLIENT-TRACKING-SAFE-AREA-01
STATUS=FIX_IMPLEMENTED_TESTED_DEPLOYED_AWAITING_PHYSICAL_CERTIFICATION
CLIENT_TRACKING_FULL_BLEED=SI
CLIENT_TRACKING_TOP_SAFE_AREA_BEFORE=NO
CLIENT_TRACKING_CLOSE_SAFE_AREA_BEFORE=NO
CLIENT_TRACKING_BOTTOM_SAFE_AREA_BEFORE=NO
ROOT_CAUSE=header fijo con px-4 py-3 y layout flex justify-between sin safe-area superior ni centrado independiente; footer sin safe-area inferior
CLIENT_TRACKING_TOP_SAFE_AREA_AFTER=SI
CLIENT_TRACKING_CLOSE_VISIBLE_CONTRACT=SI
CLIENT_TRACKING_HEADER_CENTERED=SI
CLIENT_TRACKING_BOTTOM_SAFE_AREA_AFTER=SI
MAP_LAYOUT_FLEX_REMAINS_VALID=SI
MAP_MARKER_LOGIC_CHANGED=NO
MAP_FIT_BOUNDS_LOGIC_CHANGED=NO
TRACKING_LOGIC_CHANGED=NO
GPS_LOGIC_CHANGED=NO
ROUTING_LOGIC_CHANGED=NO
```

El defecto es visual y está limitado al overlay de tracking del Cliente. No es
un finding de GPS, realtime, routing, Repartidor ni de navegación futura.

## P2-T02-R5B — physical finding closeout (2026-09-12)

```text
FINDING_ID=F-P2-T02-R5A-CLIENT-TRACKING-SAFE-AREA-01
STATUS=CLOSED_TESTING_CERTIFIED
R5A_IPHONE_TOP_SAFE_AREA=PASS
R5A_IPHONE_BOTTOM_SAFE_AREA=PASS
R5A_ANDROID_LAYOUT_SMOKE=PASS
CLIENT_TRACKING_TOP_SAFE_AREA_PHYSICAL=PASS
CLIENT_TRACKING_CLOSE_BUTTON_PHYSICAL=PASS
CLIENT_TRACKING_HEADER_CENTERING_PHYSICAL=PASS
CLIENT_TRACKING_BOTTOM_SAFE_AREA_PHYSICAL=PASS
CLIENT_TRACKING_ANDROID_LAYOUT_PHYSICAL=PASS
P2_T02_R5A_OPERATOR_CERTIFICATION=PASS
```

El cierre está limitado a la corrección visual R5A en Testing. No reabre R4 y
no altera el requisito futuro de navegación follow/bearing.

## F-P2-T46-AUDIT-01 — autoridad de cuenta/pago y pedidos legacy sin ocupación (2026-09-10)

```text
STATUS=OPEN_BLOCKING_T46
TASK=P2-T46
T46_ARCHITECTURE_AUDIT_COMPLETE=SI
ORDER_OCCUPATION_AUTHORITY=PARTIAL_DIRECT_ID; LEGACY_NULL_AMBIGUOUS
CURRENT_ACCOUNT_MODEL=DERIVED_CUENTA_MESA_RESULT
CURRENT_PAYMENT_MODEL=PEDIDO_METODOPAGO_ONLY_NO_ACCOUNT_PAYMENT_AUTHORITY
SCHEMA_CHANGE_REQUIRED=SI_FOR_ACCOUNT_PAYMENT_AUTHORITY
HISTORICAL_ORDER_OCCUPATION_BACKFILL=AMBIGUOUS
BACKFILL_REQUIRED=NO_APPLIED
PREVIOUS_OCCUPATION_FINDING_ROOT_CAUSE=CONFIRMED_FOR_ACTIVE_PANEL_VISUAL_SURFACE
ACCOUNTING_OF_OLD_ORDER_AGAINST_ORIGINAL_OCCUPATION=NOT_YET_VERIFIED
NEGOCIO_REFRESH_RELATED_TO_T46=UNCLEAR
IMPLEMENTATION=STOPPED_BEFORE_CODE_EDIT
```

La cuenta activa ya filtra por `Pedido.ocupacionMesaId`, pero no existe una
autoridad de pago confirmada a nivel de cuenta/ocupación y no puede hacerse
backfill seguro de pedidos históricos con vínculo NULL. Los paneles activos
agrupan por `mesaNumero` sin acotar la ocupación, lo que explica la exposición
visual del finding físico sin demostrar que la cuenta B haya contabilizado A.
Requiere decisión de diseño antes de cualquier migración, implementación o
certificación.

## F-P2-T48-SALON-PERSONAL-OCCUPATION-01 — estado de ocupación desfasado en Salón Personal (2026-09-10)

```text
STATUS=CLOSED_PRODUCTION
TASK=P2-T48
ROOT_CAUSE=SHARED_MESA_OCCUPANCY_CONTROL_FETCHES_ONLY_ON_MOUNT_WHILE_SALON_PERSONAL_PANEL_POLLS_AND_DOES_NOT_PROPAGATE_REFRESH
ROOT_CAUSE_CONFIDENCE=CONFIRMED_BY_CODE
CANONICAL_OCCUPATION_AUTHORITY=Mesa.ocupacionActualId -> SesionOcupacionMesa estado=activa, same business+mesa
ORDER_PRESENCE_USED_AS_OCCUPATION_AUTHORITY_AFTER=NO
FIX=Salon Personal propagates existing 15s/focus/visibility panel refresh to MesaOccupancyControl via refreshKey
FOCAL_TEST_PASS=13
REGRESSION_TEST_PASS=51
TESTING_COMMIT=bb228ee43c89073a4355e6a012bb9aeaf3669dcb
TESTING_DEPLOYMENT=d5497cb8-34a0-4835-b2f8-4c117c23a325_SUCCESS_RUNNING_EXACT_COMMIT
PHYSICAL_CERTIFICATION=PASS_CASE_A_CASE_B_CASE_C
P2_T48_OPERATOR_CERTIFICATION=PASS
P2_T48_RELEASE_ELIGIBLE=SI
RELEASE_T48_SHA=946f8c2404df8be6a1e7252f3d7d2ba520d337f8
PRODUCTION_DEPLOYMENT=96ef5efc-4678-40cd-9a96-966c839201f1_SUCCESS_RUNNING_EXACT_COMMIT
P2_T48_STABLE_TAG=p2-t48-stable-2026-09-10
P2_T42_STATUS=CLOSED_PRODUCTION
P2_T02_STATUS=WAITING_FOR_ADDITIONAL_PHYSICAL_EVIDENCE
PRODUCTION_TOUCHED=NO
```

La resolución quedó certificada físicamente en Testing con los tres casos
A/B/C y promovida a Production con alcance curado exacto. Los dos findings
adyacentes permanecen abiertos.

## F-P2-T48-R1-NEGOCIO-OCCUPATION-REFRESH-01 — Negocio no refresca ocupación en vivo (2026-09-10)

```text
STATUS=OPEN
FINDING=NEGOCIO_OCCUPATION_CLOSE_LIVE_REFRESH
NEGOCIO_OCCUPATION_CLOSE_LIVE_REFRESH_BUG=CONFIRMED_PHYSICAL
NEGOCIO_OCCUPATION_DATA_CORRECT_AFTER_REOPEN=SI
NEGOCIO_REQUIRES_VIEW_CLOSE_REOPEN_TO_REFRESH=SI
SALON_PERSONAL_SAME_EVENT_REFRESHES_CORRECTLY=SI
NEGOCIO_OCCUPATION_REFRESH_ROOT_CAUSE=UNKNOWN_PENDING_AUDIT
NEGOCIO_OCCUPATION_REFRESH_TARGET_TASK=TO_BE_RECONCILED
ROOT_CAUSE_NOT_SELECTED=SI
P2_T48_REOPENED=NO
```

La vista Negocio→Salón permaneció con el estado anterior hasta cerrar y
reabrir la vista de mesa, aunque Salón Personal se actualizó correctamente.
No se asigna un T-ID nuevo ni se implementa el fix en esta tarea.

## F-P2-T48-R1-PREVIOUS-OCCUPATION-ORDERS-01 — pedidos abiertos de ocupación anterior (2026-09-10)

```text
STATUS=OPEN
FINDING=PREVIOUS_OCCUPATION_OPEN_ORDERS_ISOLATION
PREVIOUS_OCCUPATION_OPEN_ORDERS_SURFACE_IN_NEXT_OCCUPATION=CONFIRMED_PHYSICAL
OLD_ORDERS_COUNTED_IN_NEW_CURRENT_ACCOUNT=NO_OBSERVED
OLD_ORDERS_PRESERVED_IN_NEGOCIO_HISTORY=SI_OBSERVED
DATA_LOSS_OBSERVED=NO
ACCOUNTING_OF_OLD_ORDER_AGAINST_ORIGINAL_OCCUPATION=NOT_YET_VERIFIED
NEW_OCCUPATION_MUST_NOT_INHERIT_PREVIOUS_OPEN_ORDERS=SI
PREVIOUS_OCCUPATION_OPEN_ORDERS_PROVISIONAL_TARGET=P2-T46
TARGET_CONFIRMATION_REQUIRED_DURING_T46_AUDIT=SI
ORDER_OCCUPATION_AUTHORITY=UNKNOWN_PENDING_T46_AUDIT
CLOSE_OCCUPATION_WITH_OPEN_ORDERS_GUARD=REQUIRED_FOR_FUTURE_DESIGN_REVIEW
```

Pedidos abiertos de una ocupación anterior siguieron apareciendo visualmente
en una nueva ocupación sobre la misma mesa. No se observaron sumados a la
cuenta actual, sí quedaron visibles en el historial de Negocio y no se
observó pérdida de datos. La contabilidad contra la cuenta original aún debe
auditarse. El destino P2-T46 es provisional y no se inicia aquí.

## F-P2-T42-R1-PRODUCTION-CLOSEOUT-01 — promoción curada exacta confirmada (2026-09-10)

```text
STATUS=CLOSED_PRODUCTION
T42_COMMIT=46a1d55634e8bd848e160302cdb64a32be241c89
PRODUCTION_DEPLOYMENT=08a9bc74-67df-4935-adb6-7de8e1a30c91
PRODUCTION_COMMIT_MATCH=SI
PRODUCTION_STATUS=SUCCESS_RUNNING
PRODUCTION_LOGS_CLEAN=SI
PRODUCTION_PENDING_MIGRATIONS=0
PRODUCTION_HTTP_SMOKE=PASS_READ_ONLY
T02_FILES_IN_PRODUCTION_DIFF=0
P2_T02_STATUS=WAITING_FOR_ADDITIONAL_PHYSICAL_EVIDENCE
NEXT_RECOMMENDED_SOFTWARE_TASK=P2-T48
PUBLIC_RELEASE_AUTHORIZED=NO
```

T42 fue promovida desde una rama curada basada exactamente en `origin/main`,
aplicando sólo el commit T42. El tag estable posterior apunta al mismo SHA.
La evidencia de T02 y su orden de prueba activo se preservan sin cambios.

## F-P2-T02-B4-R3-R1-RETURN-ROUTE-01 — cierre físico iOS del retorno desde Google Maps (2026-09-10)

```text
STATUS=RESOLVED_AND_PHYSICALLY_CERTIFIED_IOS
FINDING_ID=IOS_B4_RETURN_FROM_GOOGLE_MAPS_ROUTE_RECOVERY_FAIL
CERTIFIED_COMMIT=fb3e584259cb2c57605c783543c7fdb1dc845454
R3_RAILWAY_EXACT_DEPLOY=SUCCESS
IOS_ROUTE_INITIAL=PASS
IOS_GOOGLE_MAPS_OPEN=PASS
IOS_ROUTE_RECOVERY_ON_RETURN=PASS
IOS_ROUTE_RECOVERY_WITHOUT_PWA_RESTART=PASS
IOS_NAVIGATION_CLOSE_REOPEN=PASS
P2_T02_B4_IOS_STATUS=PASS
P2_T02_B4_ANDROID_STATUS=PENDING_DEVICE_AVAILABILITY
P2_T02_B4_CROSS_PLATFORM_STATUS=OPEN_ANDROID_PENDING
P2_T02_STATUS=WAITING_FOR_ADDITIONAL_PHYSICAL_EVIDENCE
```

El operador confirmó la ruta azul, distancia y ETA inicialmente, después de
abrir Google Maps y volver sin cerrar/reiniciar la PWA, y nuevamente tras
cerrar/reabrir la navegación. El cierre es sólo iOS; no sustituye la matriz
Android ni la evidencia exterior pendiente de T23/T24.

## F-P2-T02-B4-R3-RETURN-ROUTE-01 — retorno desde Google Maps requiere recovery de ruta (2026-09-10)

```text
STATUS=SUPERSEDED_BY_R3_R1_PHYSICAL_CLOSEOUT
FINDING=P2_T02_B4_RETURN_FROM_GOOGLE_MAPS_ROUTE_RECOVERY_FAIL
PREVIOUS_PHYSICAL_RESULT=FAIL_REPRODUCED_ROUTE_STUCK_UNTIL_FULL_PWA_RESTART
ROOT_CAUSE=STRONGLY_INDICATED_BY_CODE
R3_FIX=IMPLEMENTED_LOCAL_TESTED
R3_TIMEOUT=10s
R3_LIFECYCLE=visibilitychange+pageshow+focus_COALESCED
R3_REAL_CLOSE_UNMOUNT=SI
R3_STALE_RESPONSE_PROTECTION=SI
R3_TESTING_DEPLOY=WAITING_EXACT_CONFIRMATION
PHYSICAL_IOS_RETEST=REQUIRED
PRODUCTION_TOUCHED=NO
```

R3 no reescribe la evidencia física previa: background `37→40`, 3 updates,
max gap 62.30 s, `THROTTLED`; lock `41→45`, 5 updates, max gap observado
29.65 s, gap final 90.64 s no atribuible; unlock first rev 46 y foreground
recovery PASS. El finding se cierra únicamente si el operador confirma que,
tras volver de Google Maps, la ruta vuelve a mostrar polyline/distancia/ETA y
close/reopen funciona sin reiniciar la PWA.

## F-P2-T02-B4-R1-01 — deploy Testing reconciliado (2026-09-10)

```text
STATUS=RESOLVED_BY_P2_T02_B4_R2
B4_TESTING_DEPLOY_CONFIRMED=SI
B4_TESTING_DEPLOYMENT_ID=8b0fc718-f65e-4367-8210-07f12b8a5956
B4_TESTING_DEPLOYMENT_COMMIT=0c362895656d389de73fd0dd94a124fe3aac8dd1
B4_TESTING_LOGS=CLEAN
```

R2 confirmó mediante Railway CLI el proyecto, entorno, servicio, estado,
instancia, rama y `commitHash` exactos. El dashboard web no era necesario ni
fue usado como autoridad primaria.

## F-P2-T02-B4-R1-01 — atribución de routing pendiente (deploy reconciliado por R2, 2026-09-10)

```text
STATUS=OPEN_NON_BLOCKING_FOR_SOFTWARE; NOT_BLOCKING_PHYSICAL_GATE
B4_TESTING_DEPLOY_CONFIRMED=SI (reconciliado por R2)
B4_RUNTIME_NAVIGATION_PRESENT=NOT_DISTINGUISHABLE
TESTING_PUBLIC_SMOKE=/repartidor HTTP 200, contenido DeliGO
TESTING_COMMIT_MATCH=SI
ROUTING_PROVIDER=router.project-osrm.org demo server
ROUTING_PROVIDER_PRODUCTION_GATE=REQUIRED_BEFORE_PUBLIC_SCALE
OSRM_PUBLIC_ENDPOINT_ALLOWED_FOR_TESTING=SI
OSRM_PUBLIC_ENDPOINT_ACCEPTED_AS_FINAL_PRODUCTION_PROVIDER=NO_POR_AHORA
OSM_ATTRIBUTION_PRESENT=SI (Leaflet/OSM attribution visible in existing map)
OSRM_ROUTE_ATTRIBUTION_PRESENT=NO (no attribution text for OSRM route source observed in B4 UI/source)
```

El endpoint público OSRM no ofrece SLA/garantía y su política exige atribuir
la licencia de datos y la fuente OSRM; por eso no se acepta como proveedor
final para escala pública. R1 no cambia producto: queda pendiente una
decisión/implementación posterior de atribución y proveedor operativo.

## F-P2-T02-B4-R1-02 — matriz física cruzada pendiente por disponibilidad de dispositivo (2026-09-10)

```text
STATUS=OPEN_ANDROID_PENDING
PHYSICAL_IOS_AVAILABLE=SI
PHYSICAL_ANDROID_AVAILABLE=NO
P2_T02_B4_IOS_STATUS=PASS
P2_T02_B4_ANDROID_STATUS=PENDING_DEVICE_AVAILABILITY
CURRENT_PHYSICAL_CERTIFICATION_POLICY=IOS_NOW_ANDROID_DEFERRED_BATCH
ANDROID_ABSENCE_BLOCKS_SOFTWARE_PROGRESS=NO
ANDROID_SPECIFIC_GATES_REMAIN_OPEN=SI
ANDROID_ACCUMULATED_PHYSICAL_MATRIX=EXECUTE_WHEN_DEVICE_RETURNS
```

## Corrección de autoridad — F-P2-T36-01 reencuadrado tras decisión de identidad PWA única de Operaciones (2026-09-09)

```text
OPERATIONS_SINGLE_PWA_IDENTITY=SI
CANONICAL_ACTIVE_PWA_IDENTITIES=cliente, negocio, repartidor, admin, operaciones (5)
F_P2_T36_01_STATUS_BEFORE=OPEN_BLOCKED_OPERATOR_ASSET_OR_REGENERATION_DECISION
F_P2_T36_01_STATUS_AFTER=OPEN_FOLDED_INTO_P2_T52_CONSOLIDATION
```

El operador aclaró una decisión arquitectónica que la reconciliación
anterior no reflejaba: Empleado, Mozo y Salón fueron PWAs separadas en
una versión ANTERIOR de DeliGO, consolidadas después en la única
identidad instalable "DeliGO Operaciones" — nunca requieren
branding/manifest propio por diseño actual. F-P2-T36-01 (más abajo) NO
es, entonces, un caso de "falta arte fuente del operador" — es, con
auditoría real de código (`role-config.ts`, `dynamic-manifest.tsx`,
`install-prompt.tsx`, páginas `/e`, `/m/[token]`, `/mozo`, `/s`):

- **PyR y TerminalOperativa**: nunca tuvieron identidad separada.
- **Empleado y Salón**: la tuvieron, pero su único acceso (`/e`,
  `/e/[token]`, `/s`, `/s/[token]`) está 100% retirado (páginas
  estáticas compartidas `LegacyAccessRetired`, sin fetch/sesión/función
  real desde "Legacy-Cleanup-1B") — identidad separada técnicamente
  wireada pero funcionalmente inerte.
- **Mozo — excepción real**: `/mozo` sigue siendo hoy un flujo de
  login/registro/unirse genuinamente activo (mismo backend
  `CuentaOperativa`/`Operativo` que el resto de Operaciones) que TODAVÍA
  emite su propia identidad separada ("DeliGO Mozos") vía
  `DynamicManifest`, con `manifest-mozo.json` (`start_url: "/mozo/"`) —
  esto contradice la arquitectura consolidada y es lo que P2-T52 debe
  corregir. Su ícono de 192px (el realmente usado, no sólo el 512 ya
  conocido) está visiblemente cortado, mostrado hoy tanto en esa PWA
  activa como en notificaciones Push reales de `mesa_order_ready`.

`P2-T52` se retitula de "Operations Role Branding Source Asset Repair"
a **"Operations PWA Identity Consolidation / Legacy Artifact Cleanup"**
(`READY_FUTURE`) — ningún arte nuevo del operador es necesario en
ningún escenario. Los íconos de 192px de Empleado/Salón/Mozo usados
como íconos de notificación Push por área (`salon_new_order`,
`mesa_order_ready`, `operaciones_order_cancelled`) son un uso legítimo
e independiente de la identidad PWA — no se tocan por consolidar
instalabilidad. Ver `codex-reports/P2_OPERATIONS_SINGLE_PWA_IDENTITY_
AUTHORITY_CORRECTION.md` para el detalle completo de la auditoría.

## Revisión manual Operaciones/Salón del operador — punto 15 (historial Terminal) cerrado explícitamente como NOT_A_BUG (2026-09-09)

```text
MANUAL_REVIEW_POINT_15_STATUS=NOT_A_BUG
MANUAL_REVIEW_POINT_15_DISPOSITION=REFERENCE_IMPLEMENTATION_FOR_CANONICAL_ACCOUNT_HISTORY
```

De los 20 puntos reportados por el operador tras revisión visual física
de Operaciones/Mozo/PyR/Salón/TerminalOperativa/panel Negocio(Salón)/
Cliente Mesa, el punto 15 (historial de Terminal) se investigó con
evidencia adicional y se determinó que el historial de Terminal YA
muestra detalle completo (mesa, estado, fecha/hora, empleado, total,
entrega, producto, precio, aderezos, extras, ingredientes quitados) —
no es un bug. Ninguna tarea fue creada para este punto; su
implementación actual queda registrada como candidato de reutilización/
extracción para `P2-T46` (Table Account + Ticket + History Canonical
Detail), auditando el componente real antes de duplicar nada. Los
otros 19 puntos se agruparon en 12 tareas nuevas (`P2-T41` a `P2-T52`)
— ver `codex-reports/P2_OPERACIONES_SALON_OPERATOR_MANUAL_REVIEW_
BACKLOG_RECONCILIATION.md` para el detalle completo punto por punto.

## P2-T36 — F-P2-T36-01 (NUEVO, NO RESUELTO — requiere decisión del operador): icon-{empleado,mozo,salon}-512x512.png son en realidad 2133x2133 y muestran sólo un fragmento recortado del logo real — sin fuente en branding-source/ (2026-09-09)

```text
FINDING_ID=F-P2-T36-01
STATUS=OPEN_BLOCKED_OPERATOR_ASSET_OR_REGENERATION_DECISION (formalizado como tarea futura P2-T52 en la reconciliación de backlog Operaciones/Salón 2026-09-09 — ver P2_OPERACIONES_SALON_OPERATOR_MANUAL_REVIEW_BACKLOG_RECONCILIATION.md, preferencia explícita del operador de no perder este hallazgo del backlog) — SUPERADO, ver entrada de corrección arriba: STATUS_AFTER=OPEN_FOLDED_INTO_P2_T52_CONSOLIDATION, ningún arte nuevo requerido
SEVERITY=BRANDING_ASSET_CORRUPTION (visual, no funcional — la PWA sigue instalable/usable, el ícono simplemente no muestra el logo real)
DISCOVERED_IN=inspección visual/pixel obligatoria de cada ícono 512 durante P2-T36 (auditoría de safe-zone maskable) — NO se estaba buscando este problema, apareció al medir dimensiones reales de cada archivo
EVIDENCE=`icon-empleado-512x512.png`, `icon-mozo-512x512.png`, `icon-salon-512x512.png` miden 2133x2133 px reales (no 512x512 como su nombre promete) — el contenido visible es sólo un fragmento diminuto de trazo negro cerca del borde superior del canvas (Salón muestra un fragmento reconocible de mesa/silla cortado por el borde; Empleado y Mozo, trazos irreconocibles) — el resto del canvas es background sólido vacío. CORRECCIÓN posterior: el ícono realmente relevante en producción es `icon-mozo-192x192.png` (192, no 512) — visiblemente cortado y usado hoy tanto por la PWA Mozo activa como por notificaciones Push reales; `icon-empleado-192x192.png`/`icon-salon-192x192.png` están visualmente correctos (uso legítimo como íconos de Push por área, ver entrada de corrección arriba)
BRANDING_SOURCE_CHECK=`branding-source/` contiene EXACTAMENTE 5 archivos (admin, cliente, negocio, operaciones, repartidor) — CERO fuente para empleado/mozo/salon, confirmado por listado directo — no hay insumo válido del que derivar un reemplazo sin inventar contenido — SIGUE SIENDO CIERTO, pero ya NO es relevante: no se necesita "reemplazo" de arte, se necesita migrar identidad PWA (ver corrección arriba)
IMPACT=bloquea completar el fix de `PWA_MASKABLE_ICON_SAFE_ZONE_FINDING` (P2-T36) SÓLO para estos 3 roles — aplicar la misma técnica mecánica de escalado+padding a un PNG ya roto sólo produciría una versión igualmente rota; NO bloquea el resto de P2-T36 (badge y SW-cache-bypass resueltos al 100%, maskable resuelto para los otros 5 roles) — CORRECCIÓN: esos "otros 5 roles" SON las 5 identidades PWA canónicas completas (5_OF_5), no una cobertura parcial de 8
RESOLUTION_REQUIRED=SUPERADO — ya NO se requiere que el operador aporte arte original ni decida cómo regenerarlo; la resolución real es de ingeniería (migrar la identidad separada de Mozo a Operaciones, evaluar limpieza del wiring inerte de Empleado/Salón) dentro de P2-T52 retitulada
TASK_ID=P2-T52 (retitulada: OPERATIONS PWA IDENTITY CONSOLIDATION / LEGACY ARTIFACT CLEANUP) — READY_FUTURE (ya no BLOCKED — no depende de ninguna decisión pendiente del operador)
EVIDENCE_REPORT=codex-reports/P2_T36_PWA_BRANDING_HYGIENE.md §4, §14; codex-reports/P2_OPERACIONES_SALON_OPERATOR_MANUAL_REVIEW_BACKLOG_RECONCILIATION.md §6; codex-reports/P2_OPERATIONS_SINGLE_PWA_IDENTITY_AUTHORITY_CORRECTION.md (corrección completa)
```

## P2-T36 — F-P2-T36-02 (NUEVO, RESUELTO EN LA MISMA TAREA): SW icon/badge cache-bypass substring nunca matcheaba nombres reales de archivo — bug documentado desde DELIGO-BRANDING-R1, nunca corregido hasta ahora (2026-09-09)

```text
FINDING_ID=F-P2-T36-02
STATUS=RESOLVED
SEVERITY=CACHE_STALENESS (assets de branding podían quedar servidos stale indefinidamente sin depender de CACHE_NAME)
ROOT_CAUSE=`request.url.includes("icon-192")` / `includes("icon-512")` nunca es `true` para nombres reales (`icon-cliente-192x192.png` contiene "cliente-192x192" inmediatamente después de "icon-", nunca el substring literal "icon-192") — confirmado con evidencia directa, no hipótesis: el propio comentario del archivo ya documentaba el bug exacto desde DELIGO-BRANDING-R1 (2026-09-0x), nunca corregido — los PNG de ícono/badge caían silenciosamente en la rama cache-first de assets estáticos
RESOLUTION=reemplazado el substring accidental por un patrón explícito sobre `URL.pathname`: `/^\/(icon|badge)-/.test(pathname) && pathname.endsWith(".png")` — cubre por construcción los nuevos assets maskable/badge agregados en la misma tarea. `CACHE_NAME` bumpeado de `deligo-v15` a `deligo-v16` (mismo criterio que Bugfix-4D) para purgar cualquier ícono ya cacheado stale por el bug histórico
EVIDENCE=`src/lib/sw-icon-cache-bypass-static-contract.test.ts` (nuevo) — carga el `sw.js` real en sandbox VM, prueba que el patrón roto original nunca matchea nombres reales (sanity), y que el fix bypassea cache-first para ROLE_ICON/maskable/badge sin ampliar el bypass a assets no-branding
EVIDENCE_REPORT=codex-reports/P2_T36_PWA_BRANDING_HYGIENE.md §10-11
```

## P2-T35 — F-P2-T35-01 (NUEVO, RESUELTO EN LA MISMA TAREA PARA LOS 5 CASOS ENCONTRADOS): static-contract regex fragile ante CRLF (`core.autocrlf=true`) — riesgo sistémico, sólo remediado en los archivos tocados por T35 (2026-09-09)

```text
FINDING_ID=F-P2-T35-01
STATUS=RESOLVED_FOR_KNOWN_INSTANCES (5 casos en r6/r8 corregidos; NO se auditó el resto del repo en busca de más instancias — fuera del alcance explícito de T35, riesgo sistémico documentado, no un fix global)
SEVERITY=TEST_INFRA_FRAGILITY (no producto, no seguridad — falsos negativos de CI/local, nunca falsos positivos de "todo OK")
ROOT_CAUSE=este checkout corre con `core.autocrlf=true`; archivos de producto leídos por `readFileSync(..., "utf8")` en tests static-contract conservan `\r\n` real — cualquier regex que ancle un salto de línea literal (`\n` inmediato tras `}`) o use un presupuesto de caracteres ajustado (`{0,1200}`) puede romperse por el `\r` extra sin que el código real haya cambiado
DISCOVERED_IN=baseline fresco de P2-T35 (auditoría de 5 fallas históricas conocidas) — encontró una 6ta falla no documentada (P2-T32-related, distinta causa) y, al investigar las otras 5, confirmó CRLF como causa raíz común vía sanity-check (regex crudo=falla, regex normalizado=pasa)
RESOLUTION_APLICADA=normalización de fuente a LF (`.replace(/\r\n/g,"\n")`) en los 3 archivos de test tocados por T35 (r6, r8) — NO aplicada preventivamente a otros static-contract tests del repo que pudieran tener el mismo patrón sin haberlo manifestado aún
RIESGO_RESIDUAL=cualquier OTRO static-contract test del repo con un regex que ancle `\n` literal o un presupuesto de caracteres ajustado podría fallar de la misma forma bajo `core.autocrlf=true` sin ser un bug real — no se generalizó el fix para no expandir el alcance de T35; si aparece una falla similar en una tarea futura, aplicar el mismo diagnóstico (comparar regex contra fuente cruda vs normalizada) antes de asumir regresión de producto
EVIDENCE=codex-reports/P2_T35_IOS_PWA_STATIC_CONTRACT_HYGIENE.md §4, §8 (sanity-check), codex-reports/DECISIONS_AND_INVARIANTS.md (invariante P2-T35)
```

## P2-T29C — F-P2-T29C-01 (NUEVO, RESUELTO EN LA MISMA TAREA): `PedidoEvento.estadoAnterior` hardcodeado a `"en_camino"` en aceptar/auto-cancel de Repartidor — dejó de ser siempre cierto al introducir esperando_repartidor (2026-09-09)

```text
FINDING_ID=F-P2-T29C-01
STATUS=RESOLVED (en la misma tarea que lo encontró)
SEVERITY=AUDIT_TRAIL_ACCURACY (no seguridad, no concurrencia — el CAS ya usaba el valor correcto en el WHERE; sólo el registro de auditoría persistido tenía el string equivocado)
FILES=src/app/api/repartidor/pedidos/[id]/aceptar/route.ts, src/app/api/repartidor/pedidos/auto-cancel/route.ts
ROOT_CAUSE=en el modelo pre-T29C, el origen de la aceptación/auto-cancelación SIEMPRE era `en_camino` (único estado de "disponible") — ambos endpoints hardcodeaban `estadoAnterior: "en_camino"` en su `PedidoEvento.create`, coincidencia que dejó de ser cierta al introducir `esperando_repartidor` como origen canónico
DISCOVERED_IN=auditoría previa a implementar T29C (P2_T29_ESPERANDO_REPARTIDOR_ACCEPTANCE_REDESIGN_AUDIT_AND_DESIGN.md §4 ya documentaba el contrato recomendado; la revisión línea por línea del código real, no sólo del diseño, encontró el hardcodeo)
RESOLUTION=ambos endpoints ahora capturan el valor real de `estado` ANTES del CAS (`estadoOrigen`/`candidato.estado`) y lo usan tanto en el WHERE del `updateMany` (comparación exacta, nunca `estado: {in:[...]}` ambigua) como en `PedidoEvento.estadoAnterior`
EVIDENCE=codex-reports/P2_T29C_REPARTIDOR_WAITING_DRIVER_ACCEPTANCE_AND_CONCURRENCY.md §4/§6, con tests dedicados que asertan `estadoAnterior` exacto para el camino canónico Y el legacy
```

## P2-T29B — F-P2-T29B-R1-01 (NUEVO, RESUELTO EN LA MISMA TAREA): timeline Cliente se apagaba en `aceptado`/`esperando_repartidor` — descubierto en certificación física, corregido por P2-T29B-R1 (2026-09-09)

```text
FINDING_ID=F-P2-T29B-R1-01
STATUS=RESOLVED (en la misma tarea que lo encontró — P2-T29B-R1)
SEVERITY=UX_BLOCKING_PHYSICAL_GATE (no seguridad, no integridad de datos — sólo render Cliente)
FILE=src/components/client/client-orders-panel.tsx
ROOT_CAUSE=`TIMELINE_STEPS` era un array literal `[recibido, confirmado, preparando, en_camino, listo_para_retirar]` sin `aceptado`/`esperando_repartidor` (los 2 estados nuevos de T29B). `adjustedStepIndex` salía de `relevantSteps.findIndex((s) => s.key === pedido.estado)` — al no encontrar match, el índice caía en -1 y la barra de progreso completa se apagaba (0%, ningún nodo marcado), aunque el badge (statusLabel/statusEmoji, ya corregido en T29B) sí mostraba el label correcto
DISCOVERED_IN=certificación física de P2-T29B por el operador, ANTES de cerrarla
RESOLUTION=mapping explícito estado->índice (DOMICILIO_STEP_INDEX/RETIRO_STEP_INDEX), independiente de cualquier array de labels; domicilio pasa a 5 posiciones con primer nodo dinámico (Recibido->Aceptado en el mismo nodo); retiro conserva su layout de 4 nodos, sólo se corrige aceptado; Mesa sin tocar
EVIDENCE=codex-reports/P2_T29B_R1_CLIENT_TIMELINE_AND_WAITING_DRIVER_NOTIFICATION.md secciones 3-4, con 13 tests puros nuevos (client-timeline-t29b-r1.test.ts) cubriendo cada estado + saltos legacy
RELATED_FIX=misma tarea agregó notificación dedicada "Buscando delivery" para preparando->esperando_repartidor (antes T29B dejaba ese estado mudo para el Cliente, diferido a T29D)
```

## P2-T29A-PROMOTE — incidente transitorio (RESUELTO, no es un finding de código): `chat en vivo` falló su primer deploy en Production tras el push de T29A, sin causa de código, resuelto con un reintento (2026-09-09)

```text
STATUS=RESOLVED (transitorio, un reintento de Railway lo resolvió — no requiere seguimiento)
SERVICE=chat en vivo (mini-services/chat-service)
ROOT_CAUSE=desconocida a nivel de plataforma Railway — build (railpack) completó con éxito, imagen pusheada, pero el contenedor nunca produjo logs de runtime y Railway marcó el deployment FAILED tras agotar sus reintentos internos de arranque
CODE_INVOLVEMENT=NO (git diff --stat entre el commit anterior y el nuevo, acotado a mini-services/, vacío — el directorio fuente de este servicio no cambió en absoluto en esta promoción)
LIVE_IMPACT=NINGUNO (la versión anterior, commit 969ea77, siguió activa y respondiendo 200 en / y /health durante todo el intervalo — sin corte de servicio real)
RESOLUTION=railway redeploy --service "chat en vivo" --environment production (mismo commit, decisión explícita del operador vía AskUserQuestion) — SUCCESS en el segundo intento, logs limpios
NEXT_ACTION=ninguna — si este patrón se repite en futuras promociones, considerar investigar timeouts de arranque de contenedor a nivel de plataforma, pero no hay evidencia suficiente todavía para abrir un finding formal de infraestructura
```

## P2-T29A — F-P2-T29A-01 (NUEVO, RESUELTO EN LA MISMA TAREA): cuarta copia no documentada de reglas de transición encontrada en `negocio/pedidos/route.ts` (PUT, mesa) — tenía el mismo gap de CAS que su endpoint hermano (2026-09-09)

```text
FINDING_ID=F-P2-T29A-01
STATUS=RESOLVED (en la misma tarea que lo encontró)
FILE=src/app/api/negocio/pedidos/route.ts (PUT)
ROOT_CAUSE=la auditoría P2-T29 original documentó 3 copias de reglas de transición (VALID_TRANSITIONS en negocio/[id]/estado, TRANSICIONES en operaciones/pyr/estado, REQUIRED_CURRENT en operaciones/salon/estado) — se encontró una CUARTA, idéntica a la primera, en un endpoint real y en uso (salon-tab.tsx, gestión de mesas del propio Negocio, distinta del panel de Operaciones/Terminal) que tenía EXACTAMENTE el mismo gap: update() plano sin CAS para transiciones no-cancelación
RESOLUTION=migrado a la autoridad compartida (order-transitions.ts) + CAS real (updateMany con estado:currentEstado en el WHERE), mismo tratamiento que su endpoint hermano
EVIDENCE=codex-reports/P2_T29A_ORDER_TRANSITION_AUTHORITY_CAS_AND_CONCURRENCY_TESTS.md sección 3 y 6, con 3 tests de integración real (incluye una carrera concurrente real vía Promise.all)
```

## P2-T29A — F-P2-T29A-02 (NUEVO, NO CORREGIDO, fuera de alcance): `negocio/pedidos/route.ts` (PUT, mesa) nunca genera `PedidoEvento` para ninguna transición (2026-09-09)

```text
FINDING_ID=F-P2-T29A-02
STATUS=OPEN_NON_BLOCKING
SEVERITY=AUDIT_TRAIL_GAP (no seguridad, no concurrencia — el CAS de F-P2-T29A-01 ya protege la integridad de datos independientemente de esto)
FILE=src/app/api/negocio/pedidos/route.ts (PUT)
DESCRIPTION=a diferencia de negocio/pedidos/[id]/estado/route.ts, este endpoint NUNCA llamó a logPedidoEstadoChange/creó PedidoEvento para ninguna transición de mesa — preexistente, descubierto incidentalmente al escribir el test de concurrencia de F-P2-T29A-01 (el test esperaba 1 evento tras un CAS ganador y encontró 0)
BLOCKS_T29A=NO (T29A cierra el gap de CAS, no agrega auditoría nueva — deliberadamente fuera de su fileset autorizado)
NEXT_ACTION=si el operador considera valioso tener historial de PedidoEvento para pedidos de mesa gestionados desde salon-tab.tsx (hoy sólo tienen historial si se gestionan vía el panel de Operaciones/Salón, que sí audita), agregar logPedidoEstadoChange aquí como una tarea de hardening separada y acotada
```

## PRE-T29 — F-PRE-T29-03 (RESUELTO POR P2-T30, 2026-09-09): fila huérfana en `super_admins` de la base compartida de TESTING bloqueaba el cleanup de fixtures de `superadmin-auth.test.ts` vía FK RESTRICT — no bloqueante, no atribuible al código

```text
FINDING_ID=F-PRE-T29-03
STATUS=RESOLVED_BY_P2_T30 (era OPEN_NON_BLOCKING_TEST_INFRA)
SEVERITY=TEST_INFRA_RELIABILITY (no código, no seguridad, no Production runtime — sólo afecta la ejecución del test suite contra la DB compartida de TESTING)
FILE=src/lib/superadmin-auth.test.ts (afectado) — causa raíz en datos, no en código
ROOT_CAUSE=una fila en super_admins (id cmsjkkvd40000mz0az8y5gn9s) de $DELIGO_TEST_DATABASE_URL está referenciada por una fila de solicitudes_revision_resena.revisadaPorSuperadminId con constraint FK RESTRICT — el deleteMany() de limpieza de fixtures que corre antes/después de CADA test del archivo falla con PostgresError 23001, causando 48/48 fallos en ese archivo específicamente
DISCOVERED_IN=PRE-T29-PROMOTE-CERTIFIED-TESTING-TO-MAIN-AND-PRODUCTION-R2, batería de tests reejecutada tras el hang diagnosticado
REGRESSION_CONFIRMED=NO — reproducido con el mismo resultado EXACTO (mismo id de fila, mismo constraint) corriendo la misma suite contra testing-codex@6c6fc58 SIN NINGÚN CAMBIO, antes y durante esta promoción
RELATION_TO_F_P2_TESTINFRA_01=DISTINTO — F-P2-TESTINFRA-01 es latencia/timeout intermitente (P2028) en client-block-security.integration.test.ts; este finding es una violación de integridad referencial determinística (no intermitente) por una fila específica dejada en la DB compartida, probablemente de una ejecución de test o fixture anterior sin cleanup completo
BLOCKS_THIS_PROMOTION=NO (probado preexistente, ver arriba)
BLOCKS_PRODUCTION=NO (la DB compartida de TESTING no es Production)
RESOLUTION=P2-T30 (2026-09-09) corrigió el ORDEN/ALCANCE del cleanup en `superadmin-auth.test.ts` (segunda opción propuesta arriba, no la primera): cada test crea fixtures con sub/email únicos por corrida y el cleanup borra EXCLUSIVAMENTE esos ids (`deleteMany({ where: { id: { in: createdSuperAdminIds } } })`) — nunca un `deleteMany({})` global. Verificado con 3 corridas consecutivas idénticas contra la DB real (0 crashes, 0 fallos), sin tocar ninguna fila real (incluida la misma `cmsjkkvd40000mz0az8y5gn9s` referenciada arriba, confirmada intacta después). No se borró la fila huérfana real — sigue existiendo, simplemente el test ya no intenta tocarla. Ver `codex-reports/P2_T30_SUPERADMIN_AUTH_TEST_FIXTURE_HYGIENE.md`.
```

Encontrado durante la reejecución de la batería de tests de la
promoción R2 — no bloqueó el checkpoint porque se demostró, con
reproducción idéntica contra el HEAD de `testing-codex` sin modificar,
que es un problema de estado de datos preexistente en la base
compartida de TESTING, no algo introducido por el código promovido.
No se tocó la base de datos para limpiar esto (fuera del alcance
autorizado de la tarea de promoción). Cerrado en P2-T30 corrigiendo el
propio test, no los datos.

## P2-T30 — F-P2-T30-01 (NUEVO, OPEN_NON_BLOCKING): 12 sesiones `Sesion` (userType=superadmin) huérfanas en la DB compartida de TESTING — `userId` ya no corresponde a ninguna fila existente en `super_admins` (2026-09-09)

```text
FINDING_ID=F-P2-T30-01
STATUS=OPEN_NON_BLOCKING_TEST_INFRA
SEVERITY=TEST_INFRA_HYGIENE (no seguridad, no Production — Sesion no tiene FK restrictiva que bloquee nada; son filas huérfanas inertes, no un blocker)
FILE=ninguno — hallazgo de datos, no de código
ROOT_CAUSE_HIPOTESIS=probablemente residuo de ejecuciones ANTERIORES de superadmin-auth.test.ts que crasheaban a mitad de suite por el bug de F-PRE-T29-03 (deleteMany({}) sin scope), abortando antes de llegar al afterAll que limpia sesiones — no confirmado con certeza, no investigado a fondo (fuera de alcance de P2-T30)
DISCOVERED_IN=P2-T30-SUPERADMIN-AUTH-TEST-FIXTURE-HYGIENE, auditoría de residuos post-test (20 sesiones superadmin totales en la DB compartida, 8 pertenecen a los 3 SuperAdmin reales actuales, 12 huérfanas)
REGRESSION_CONFIRMED=NO — las 3 corridas de P2-T30 confirmaron explícitamente que sus propios tokens trackeados se limpiaron al 100% en cada corrida; estas 12 filas no son atribuibles a esa tarea
BLOCKS_ANYTHING=NO
NEXT_ACTION=ninguna en este momento — no bloquea nada, no se investigó la causa raíz exacta ni se tocó (fuera del alcance explícito de P2-T30, que era exclusivamente sobre superadmin-auth.test.ts). Si se decide limpiar, requiere autorización explícita separada y un scope claro (nunca un deleteMany global de Sesion).
```

## PRE-T29 — F-PRE-T29-02 CERRADO (CLOSED_TESTING_CERTIFIED — confirmación física PASS/PASS del operador): `public/manifest-cliente.json` start_url en `/cliente`, acceso manual `?iosDebug=1` preservado (2026-09-09)

```text
FINDING_ID=F-PRE-T29-02
STATUS=CLOSED_TESTING_CERTIFIED (era FIX_DEPLOYED_TESTING_AWAITING_PHYSICAL_CONFIRMATION)
F_PRE_T29_02_PHYSICAL_NORMAL_INSTALL=PASS (instalación nueva de Cliente en iPhone real abre sin panel de diagnóstico por defecto, sin iosDebug=1 en el contexto de lanzamiento)
F_PRE_T29_02_PHYSICAL_MANUAL_DEBUG=PASS (/cliente?iosDebug=1 navegado manualmente sigue mostrando el panel)
BLOCKS_PRE_T29_PROMOTION=NO (ya promovido — ver PRE_T29_PROMOTE_CERTIFIED_TESTING_TO_MAIN_AND_PRODUCTION_R2.md)
BLOCKS_PUBLIC_LAUNCH=NO
PROMOTED_TO_PRODUCTION_AS=969ea77ab1630b443fbc0e609397d9c45c5d7443
```

Cerrado con evidencia física humana. El código que corrige esto ya fue
promovido a `main`/Production como parte de
`PRE-T29-PROMOTE-CERTIFIED-TESTING-TO-MAIN-AND-PRODUCTION-R2` —
confirmado en vivo contra `deligo.ar/manifest-cliente.json`
(`start_url=/cliente`, sin `iosDebug`).

## PRE-T29 — F-PRE-T29-02 CORREGIDO EN TESTING (histórico, ver cierre arriba): `public/manifest-cliente.json` start_url vuelve a `/cliente`, acceso manual `?iosDebug=1` preservado, desplegado a Railway TESTING (2026-09-08)

```text
FINDING_ID=F-PRE-T29-02
STATUS=FIX_DEPLOYED_TESTING_AWAITING_PHYSICAL_CONFIRMATION (era OPEN)
FIX_COMMIT=6c6fc581ad678883f4e9fbcb9dbf8e90ecf63912 (parent 818b627, testing-codex)
FIX_VALUE=start_url: "/cliente?iosDebug=1" -> "/cliente" (único campo tocado)
MANUAL_DEBUG_ACCESS_PRESERVED=SI (/cliente?iosDebug=1 sigue activando isIosDebugFlagEnabled sin cambios; verificado por código, test nuevo de comportamiento real, y smoke HTTP 200 contra TESTING desplegado)
TESTING_DEPLOYMENT=d636ab54-7104-4e55-b9a6-6928ffc0817a, SUCCESS, commit 6c6fc58 (match exacto)
SERVED_MANIFEST_VERIFIED=SI (GET /manifest-cliente.json en deligo-copy-production.up.railway.app → 200, start_url="/cliente", sin "iosDebug")
BLOCKS_PRE_T29_PROMOTION=SI (hasta confirmación física en iPhone real — checklist pendiente, ver codex-reports/PRE_T29_FIX_MANIFEST_CLIENTE_IOSDEBUG_FLAG_TESTING.md sección 21)
BLOCKS_PUBLIC_LAUNCH=SI (mismo motivo, hasta el mismo PASS físico)
NEXT_ACTION=operador instala la PWA Cliente en TESTING desde cero en un iPhone real y confirma que el panel de diagnóstico NO aparece por defecto, y que SÍ aparece navegando manualmente a /cliente?iosDebug=1 — sólo entonces reintentar PRE_T29_PROMOTE_CERTIFIED_TESTING_TO_MAIN_AND_PRODUCTION
PRODUCTION_TOUCHED=NO
SEVERITY=PRODUCTION_FACING_UX_BEHAVIOR_BUG (no seguridad — panel auditado, sin secretos/PII, whitelist propia con test dedicado)
FILE=public/manifest-cliente.json
FIELD=start_url
ORIGINAL_VALUE=/cliente?iosDebug=1 (estático, sin condicional por RAILWAY_ENVIRONMENT_NAME ni ningún otro mecanismo — confirmado que scripts/copy-standalone-assets.js no genera/transforma manifests)
DISCOVERED_IN=PRE-T29-PROMOTE-CERTIFIED-TESTING-TO-MAIN-AND-PRODUCTION, revisión focal de diagnósticos iOS (§12 de la tarea), sobre el árbol certificado de testing-codex@818b627 dentro de un worktree de release aislado
FIXED_IN=PRE-T29-FIX-MANIFEST-CLIENTE-IOSDEBUG-FLAG-TESTING, commit 6c6fc581ad678883f4e9fbcb9dbf8e90ecf63912
BLAST_RADIUS_IF_UNFIXED=cualquier instalación NUEVA de la PWA Cliente (agregar a pantalla de inicio) habría lanzado con ?iosDebug=1 por defecto, activando el panel de diagnóstico de geometría iOS (src/components/pwa/ios-viewport-debug-panel.tsx) para un usuario real. El propio gate del panel es client-side (params.get("iosDebug")==="1"), no server-side fail-closed como el de Push (P2-T31) — cualquiera puede seguir activándolo manualmente en cualquier entorno, pero ya no queda activado POR DEFECTO.
PANEL_DATA_SAFETY_AUDITED=SI — el panel nunca lee input values, chat, tokens, cookies ni localStorage; cada campo es un rect numérico o un string de una whitelist fija de computed-style/className, con su propio test que audita esa whitelist (src/lib/ios-debug-snapshot.ts) — el hallazgo siempre fue de UX/comportamiento no intencional en Production, no de exposición de datos
```

Encontrado durante el intento de promoción curada de `testing-codex` a
`main`/Production (`PRE_T29_PROMOTE_CERTIFIED_TESTING_TO_MAIN_AND_PRODUCTION.md`).
El comentario de cabecera de `ios-viewport-debug-panel.tsx` declaraba
que el mecanismo era "TESTING only", pero el manifest real que lo
activa no tenía ningún condicional de entorno — la premisa de ese
comentario resultó ser incorrecta/obsoleta frente al estado real del
árbol certificado. Presentado al operador sin resolver unilateralmente;
el operador eligió **detener la promoción por completo** y corregir
esto en `testing-codex` primero — exactamente lo que
`PRE-T29-FIX-MANIFEST-CLIENTE-IOSDEBUG-FLAG-TESTING` ejecutó: revirtió
`start_url` a `/cliente`, preservó el acceso manual, y desplegó a
Railway TESTING/"DeliGO Copy" (`SUCCESS`, commit `6c6fc58`, manifest
servido verificado en vivo). Sólo falta la confirmación física en un
iPhone real (instalar la PWA Cliente desde cero y confirmar que el
panel ya no aparece por defecto) antes de reintentar la promoción.

## PRE-T29 — F-PRE-T29-01 RESUELTO: `GOOGLE_OAUTH_PENDING_SECRET` agregada a Railway Production — único blocker de promoción técnica cerrado (2026-09-08)

```text
FINDING_ID=F-PRE-T29-01
STATUS=RESOLVED
REQUIRED_BY=src/lib/google-oauth-pending.ts:43-45 (getSecret() lanza Error si falta o mide <32 caracteres)
PRODUCTION_PRESENCE=CONFIRMED_PRESENT (verificado por NOMBRE, 52 variables tras el cambio, +1 exacto vs las 51 previas; longitud=64 caracteres validada aritméticamente sin leer el valor)
BLAST_RADIUS=acotado — sólo el callback de Google OAuth para una identidad NUEVA o una cuenta existente sin LegalAcceptance; no rompió boot/build/ninguna otra ruta
```

Encontrado durante la auditoría de disponibilidad de promoción a
Production (`PRE_T29_PRODUCTION_PROMOTION_READINESS_AUDIT.md`). Era el
ÚNICO blocker real de esa auditoría — mecánico, no de diseño.
**Resuelto** en `PRE_T29_PRODUCTION_GOOGLE_OAUTH_PENDING_SECRET_
PRECONDITION.md`: se generó un secret nuevo y dedicado (CSPRNG local,
64 caracteres hexadecimales, nunca reutilizado de TESTING ni de ningún
otro secret existente) y se aplicó exclusivamente a Railway Production/
servicio "DeliGO" vía `--stdin` (nunca expuesto en argv/stdout/este
reporte). El cambio disparó un redeploy automático del MISMO commit
(`1de0d3c1`, `SUCCESS`, logs limpios, smoke no mutante PASS) — sin
ningún cambio de código. TESTING y el resto de las variables de
Production quedaron confirmadas sin cambios (diff de nombres: +1 exacto,
0 removidas/modificadas). Con esto resuelto, las 17 condiciones de
`PROMOTION_READY` de la auditoría anterior quedan satisfechas — la
promoción de código real sigue pendiente de una tarea separada, con
autorización explícita.

## P2-T29 — F-P2-T29-01 (NUEVO): `en_camino` está sobrecargado — significa "negocio buscando repartidor" Y "repartidor asignado en camino" a la vez, causando UI comprobadamente ambigua (2026-09-08)

```text
FINDING_ID=F-P2-T29-01
STATUS=DESIGNED_NOT_IMPLEMENTED
ORDER_STATE_OVERLOAD_CONFIRMED=SI (por lectura directa de negocio/pedidos/[id]/estado/route.ts y repartidor/pedidos/[id]/aceptar/route.ts)
UI_AMBIGUITY_EVIDENCE=orders-tab.tsx:1017-1020 muestra "Esperando confirmación del cliente" para TODO pedido en_camino, sin distinguir "todavía sin repartidor" de "repartidor ya asignado"
```

El estado `en_camino` pasa a existir en el momento en que Negocio pulsa
un único botón — ANTES de que exista ningún repartidor asignado — y
permanece con el mismo nombre después de que un repartidor lo acepta.
No es una hipótesis de diseño: es un hecho confirmado leyendo el código
real de ambos endpoints. Diseño de fix completo (`aceptado` +
`esperando_repartidor` como estados intermedios explícitos) entregado
en `P2_T29_ESPERANDO_REPARTIDOR_ACCEPTANCE_REDESIGN_AUDIT_AND_DESIGN.md`
— no implementado en esta tarea.

## P2-T29 — F-P2-T29-02 (NUEVO): la aceptación atómica del repartidor — el punto de mayor riesgo de concurrencia del sistema — no tiene ningún test de concurrencia real (2026-09-08)

```text
FINDING_ID=F-P2-T29-02
STATUS=OPEN_TO_BE_CLOSED_IN_T29A
CURRENT_DRIVER_ACCEPTANCE_ATOMIC=SI (el código en sí es seguro — updateMany CAS real, confirmado por lectura de repartidor/pedidos/[id]/aceptar/route.ts)
TEST_COVERAGE_FOR_THIS_ENDPOINT=CERO
```

El endpoint `POST /api/repartidor/pedidos/[id]/aceptar` usa un CAS de
base de datos real (una sola sentencia `UPDATE ... WHERE estado=X AND
repartidorId IS NULL`) y es, por lectura de código, seguro ante dos
repartidores compitiendo por el mismo pedido. Pero no existe NINGÚN
test que reproduzca esa concurrencia y lo demuestre ejecutablemente —
toda la confianza actual es por inspección manual. No bloquea nada hoy
(el código es correcto), pero es el gap de test más crítico
identificado para la implementación de P2-T29 — debe cerrarse en la
fase T29A, antes de tocar ese archivo para el nuevo nombre de estado.

## P2-T31-R21 — CERRADO: P2-T31 (Notification Switch + Web Push) queda `CLOSED_TESTING_CERTIFIED` — diagnósticos R6/R6A/R6B/R19R1 reclasificados de "temporales atados a T31" a "permanentes, seguros" (2026-09-08)

```text
P2_T31_STATUS=CLOSED_TESTING_CERTIFIED
FINAL_PUSH_DIAGNOSTICS_DISPOSITION=RETAIN_SAFE_PERMANENT_ONLY
P2_T31_R21A_CLEANUP_REQUIRED=NO
DIAGNOSTIC_SECRET_EXPOSURE_FINDING=NONE
PRODUCTION_USER_VISIBLE_PUSH_DIAGNOSTICS_PRESENT=NO
```

Auditoría final read-only de P2-T31: las 8 condiciones de cierre se
cumplen (matriz física de Push completa en los 3 roles/2 plataformas,
routing de íconos R22A físico, tap de chat R23C físico, safe-area de
chat R24 físico, sin diagnóstico peligroso/visible, sin secretos
expuestos, sin cleanup obligatorio, todo residual restante clasificado
como no-bloqueante/epic-separado/deuda-UX). La condición que R10
registró para retener `PushDebugPanel`/timeline/snapshot/bootstrap
(`RETAIN_UNTIL_ANDROID_PHYSICAL_CERTIFICATION_COMPLETE`) ya se cumplió
— pero, por lectura directa del código real (`push-debug-panel.tsx`,
`push-debug-trace.ts`, `push-testing-guard.ts`), esa instrumentación
cumple los 5 criterios de `SAFE_TESTING_DIAGNOSTIC` (gate server-side
fail-closed que devuelve 404 indistinguible en Production, fingerprints
no reversibles en vez de valores crudos, invisible fuera de TESTING,
de sólo lectura — nunca puede crear/cambiar una subscripción, utilidad
real futura más allá de T31), así que se reclasifica a retención
PERMANENTE en vez de disparar una tarea de cleanup. Detalle completo en
`P2_T31_R21_FINAL_DIAGNOSTICS_DISPOSITION_AND_CLOSEOUT.md`.

## P2-T31-R23C — F-P2-T31-R23B-01 CORREGIDO: NO es un finding de "misma cuenta de Google" — es sesión concurrente Cliente/Repartidor rota SÓLO en Android, independiente de la cuenta Google usada (2026-09-08)

```text
FINDING_ID=F-P2-T31-R23B-01 (mismo ID, corregido — reemplaza la clasificación de R23B abajo)
STATUS=OPEN
ANDROID_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_ISOLATION_FINDING=OPEN
PLATFORM_SCOPE=ANDROID_ONLY_CONFIRMED
ANDROID_CLIENTE_REPARTIDOR_SAME_GOOGLE_ACCOUNT_CONCURRENCY=FAIL
ANDROID_CLIENTE_REPARTIDOR_DIFFERENT_GOOGLE_ACCOUNT_CONCURRENCY=FAIL
IPHONE_CLIENTE_REPARTIDOR_SAME_GOOGLE_ACCOUNT_CONCURRENCY=PASS
IPHONE_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_CONTROL=PASS
GOOGLE_ACCOUNT_SPECIFIC_TRIGGER=RULED_OUT_BY_PHYSICAL_EVIDENCE
SAME_IDENTITY_MULTI_ROLE_CONCURRENT_SESSION_REQUIRED=SI
DIFFERENT_IDENTITY_MULTI_ROLE_CONCURRENT_SESSION_REQUIRED=SI
ANDROID_CLIENTE_REPARTIDOR_SESSION_ISOLATION_ROOT_CAUSE=NOT_AUDITED
P2_T31_BLOCKER=NO
PRODUCTION_READINESS_BLOCKER=YES
QUEUE_STATUS=OPEN_FUTURE_ANDROID_PWA_SESSION_ISOLATION_TASK
FORMAL_TASK_ID=P2-T34 (asignado en P2-CURRENT-AUTHORITATIVE-BACKLOG-RECONCILIATION, 2026-09-09 — sin cambios a la evidencia/root-cause de arriba)
```

**Corrección formal (R23C, 2026-09-08)**: la evidencia física original
de R23B (registrada abajo) atribuía el fallo a usar la MISMA cuenta de
Google en Cliente y Repartidor. Evidencia física nueva y más completa
del operador **descarta ese factor**: en Android, Cliente + Repartidor
con la MISMA cuenta de Google → `FAIL`, y Cliente + Repartidor con
cuentas de Google DIFERENTES → **también `FAIL`**. La igualdad o
diferencia de la cuenta de Google **no es el factor discriminante** —
el fallo ocurre en Android de todos modos. En iPhone, con la MISMA
cuenta de Google, Cliente + Repartidor permanecen autenticados y
operativos simultáneamente (`PASS`) — control positivo que demuestra
que el producto puede, conceptualmente, admitir esa coexistencia; la
futura auditoría de Android debe usar iPhone como comparación.

Requisito de producto (sin cambios, reafirmado): DeliGO debe permitir
que en Android, una misma persona tenga Cliente y Repartidor
autenticados/operativos simultáneamente, tanto con la misma identidad
de Google como con identidades diferentes — sin cerrar sesión de un rol
para usar el otro, sin cambiar de cuenta, sin cambiar de perfil de
navegador, sin reinstalar ninguna PWA. Caso real: un repartidor también
puede usar DeliGO como cliente.

**No se afirma "Google causa el bug"** — de hecho la evidencia ahora lo
descarta explícitamente como trigger. Hipótesis futuras a revisar (NO
auditadas, NO implementadas en R23C): cookie/sesión compartida por
origen en Chrome Android, localStorage compartido entre PWAs same-
origin, restauración global del actor activo persistido en Zustand,
propagación de logout entre roles, contexto de WebAPK instalado,
diferencias entre el modelo de storage de iOS standalone y el de
Android Chromium/WebAPK. Root cause explícitamente `NOT_AUDITED`,
diferido a una tarea futura dedicada de auth/PWA/session isolation. No
se corrige ni se mezcla con el finding de Push/chat (`F-P2-T31-R23-01`
abajo). No bloquea el closeout de P2-T31, pero SÍ es un bloqueante de
production readiness general. Ver
`P2_T31_R23C_CHAT_ACTOR_RESET_FIRST_HYDRATION_GUARD_FIX_TESTING_DEPLOY.md`.

## P2-T31-R23B — evidencia física ORIGINAL (histórica, corregida arriba por R23C): sesión concurrente cruzada de rol con la MISMA cuenta de Google interfiere entre Cliente y Repartidor (2026-09-08)

```text
STATUS=SUPERSEDED_BY_R23C_CORRECTION (ver F-P2-T31-R23B-01 arriba)
```

Evidencia física ORIGINAL del operador en R23B (parcial — R23C la
completó y reclasificó): usar la MISMA cuenta de Google para DeliGO
Cliente y DeliGO Repartidor hacía que una sesión interfiriera con la
otra; usando DOS cuentas de Google DISTINTAS, ambos roles parecían
permanecer autenticados simultáneamente sin problema. Evidencia física
AMPLIADA en R23C (probando también Android con cuentas DIFERENTES)
mostró que ese segundo caso **también falla en Android** — la cuenta
de Google no era, en realidad, el factor discriminante. Ver la entrada
corregida arriba.

## P2-T31-R23A/R24/R21 — F-P2-T31-R23A-02 CERRADO: iOS chat — controles interactivos superiores quedaban dentro de la safe-area del status bar, pudiendo dejar al usuario sin forma de salir del chat — CONFIRMADO FÍSICAMENTE (2026-09-08)

```text
FINDING_ID=F-P2-T31-R23A-02
STATUS=PHYSICALLY_CONFIRMED_FIXED_TESTING (elevado desde FIX_DEPLOYED_TESTING_AWAITING_PHYSICAL_CONFIRMATION — commit 818b627b472e03e80034c047a51dfd3491f3add3, deployment 1f025eba-02ed-469c-9412-3c3c740d4550 SUCCESS)
PLATFORM=IPHONE_IOS_PWA
IOS_CHAT_FULL_BLEED_BACKGROUND_DESIRED=SI / IOS_CHAT_INTERACTIVE_HEADER_SAFE_AREA_REQUIRED=SI / ANDROID_CHAT_SAFE_AREA_BEHAVIOR_CHANGE_REQUIRED=NO
ROOT_CAUSE=PROVEN (R24 — IOS_CHAT_SAFE_AREA_ROOT_CAUSE_CLASS=INTERACTIVE_HEADER_CONTAINER_TOP_0_WITHOUT_SAFE_AREA_PADDING)
P2_T31_CLOSEOUT_BLOCKED_BY_IOS_CHAT_SAFE_AREA_FIX=NO
```

Evidencia física del operador durante R23A: el layout full-bleed de
DeliGO en iPhone hasta la status bar es INTENCIONAL y debe
preservarse (banners/backgrounds/hero content deben ocupar toda la
pantalla) — pero en las vistas de chat, los CONTROLES INTERACTIVOS
superiores (cerrar/volver del chat individual, cerrar/volver del
listado de chats) también quedaban colocados dentro/debajo de esa misma
safe-area, pudiendo dejar al usuario sin forma de salir del chat
(workaround físico previo: cerrar y reabrir la PWA). Android no
presenta este problema.

**Fix (R24, 2026-09-08)**: auditoría del árbol completo de Chat
confirmó DOS headers en flujo normal sin protección de safe-area
(`chat-sheet.tsx` listado, `chat-view.tsx` conversación) más un tercer
control afectado — el botón cerrar (X) built-in compartido de
`sheet.tsx` (único cierre disponible en la vista de listado). Fix:
ambos headers reciben `pt-[calc(env(safe-area-inset-top,0px)+Xrem)]`
(mismo idioma ya usado en `mesa-cuenta-dialog.tsx`/`n/[slug]/page.tsx`);
el botón X compartido recibió un `data-slot="sheet-close"` inerte,
reposicionado SÓLO para chat vía `[data-ios-debug-role="chat-sheet"]`
en `globals.css` — ningún otro Sheet de la app se ve afectado. Fondo/
full-bleed y `viewport-fit=cover` (global) sin tocar; sin branching por
plataforma. 12 tests nuevos, Push 607/607 y R23C 21/21 sin regresión.
Ver
`P2_T31_R24_IOS_CHAT_SAFE_AREA_INTERACTIVE_CONTROLS_AUDIT_FIX_TESTING_DEPLOY.md`.

**Adenda (R21, 2026-09-08)**: CONFIRMADO FÍSICAMENTE por el operador —
listado de Chats con botón X totalmente debajo de la status bar/Dynamic
Island y tappable, fondo/full-bleed intacto sin franja blanca;
conversación individual con botón volver/título/avatar en zona segura,
navegación normal; abrir/cerrar el teclado no rompe el header; Android
de control sin regresión visual. Este finding queda **CERRADO**. Ya NO
bloquea el closeout de P2-T31. Ver
`P2_T31_R21_FINAL_DIAGNOSTICS_DISPOSITION_AND_CLOSEOUT.md`.

## P2-T31-R23A — F-P2-T31-R23A-03 (NUEVO): Android — la UI muestra "app instalada" antes de que el WebAPK termine de generarse en segundo plano (2026-09-08)

```text
FINDING_ID=F-P2-T31-R23A-03
STATUS=OPEN_NON_BLOCKING
DETERMINATE_REAL_PROGRESS_BAR_SUPPORTED=NO (la Web Platform no expone porcentaje real de instalación de WebAPK)
INDETERMINATE_INSTALL_PROGRESS=FEASIBLE
GET_INSTALLED_RELATED_APPS_FEASIBILITY=NOT_AUDITED
ANDROID_PWA_INSTALL_UX_ROOT_CAUSE_IN_DELIGO=NOT_AUDITED
P2_T31_CLOSEOUT_BLOCKED_BY_ANDROID_PWA_INSTALL_UX=NO
FORMALIZED_AS_TASK=P2-T38 (PWA Installation UX — Android completion-state + iOS guided tutorial, registrada 2026-09-09, READY_FUTURE, no implementada — ver P2_T32_PHYSICAL_CERTIFICATION_CLOSEOUT_AND_BACKLOG_ADDITIONS.md §4). Este finding permanece OPEN_NON_BLOCKING hasta que P2-T38 se implemente y certifique físicamente; la tarea es el vehículo de ejecución, no reemplaza este registro.
```

Evidencia física: en Android, tras aceptar el prompt de instalación de
Chrome, la UI de DeliGO muestra inmediatamente algo equivalente a
"App instalada" — pero Android/Chrome puede seguir generando el WebAPK
en segundo plano; el usuario vuelve al launcher, todavía no la ve, y
parece que la instalación falló. Objetivo UX futuro (no implementado):
máquina de estados `AVAILABLE → PROMPTING → ACCEPTED →
INSTALLING_BACKGROUND → INSTALLED_CONFIRMED`, con progreso
indeterminado ("Instalando DeliGO… puede tardar unos segundos"),
evaluando `navigator.getInstalledRelatedApps()` sin asumir su
viabilidad. Es una mejora de UX general de instalación, **NO bloquea
P2-T31** — queda `QUEUED` como tarea separada.

## P2-T31-R23/R23A/R23B/R23C — F-P2-T31-R23-01 CERRADO: fix del root cause PROVEN CONFIRMADO FÍSICAMENTE (commit 1bd953a) — tap de notificación Push de chat abre el chat correcto en Android e iPhone, cold y warm (2026-09-08)

```text
FINDING_ID=F-P2-T31-R23-01
STATUS=PHYSICALLY_CONFIRMED_FIXED_TESTING (elevado desde R23C_FIX_DEPLOYED_TESTING_AWAITING_PHYSICAL_CONFIRMATION — 4/4 combinaciones PASS: ANDROID_NEGOCIO_CHAT_TAP_COLD=PASS, ANDROID_NEGOCIO_CHAT_TAP_WARM=PASS, IPHONE_NEGOCIO_CHAT_TAP_COLD=PASS, IPHONE_NEGOCIO_CHAT_TAP_WARM=PASS)
CHAT_PUSH_DEEPLINK_PHYSICAL_CERTIFICATION_COMPLETE=SI
PHYSICAL_CHAT_NOTIFICATION_TAP_ANDROID=FAIL / PHYSICAL_CHAT_NOTIFICATION_TAP_IPHONE=FAIL
R23A_PHYSICAL_FIX_CONFIRMATION=FAIL
ANDROID_CHAT_TAP_WARM_APP=FAIL (Negocio ya abierto/autenticado — descarta la hidratación como causa única)
ROOT_CAUSE_PRIMARY_CLASS=CLIENT_SIDE_AUTH_HYDRATION_RACE_SILENTLY_DROPS_ONE_SHOT_CHAT_DEEPLINK (R23, cerrada por R23A, real pero insuficiente)
ROOT_CAUSE_ADDITIONAL_CLASS=CHAT_SHEET_STATE_IS_RESET_AFTER_OPEN (R23B, PROVEN — useChatActorReset resetea el chat-store en el mismo commit en que useChatDeepLink lo abre, porque trata la transición null→usuario-real como un cambio de actor)
```

Evidencia física: Cliente envía un mensaje de chat a Negocio — la Push
llega, con el ícono correcto de Negocio (R22A funcionando), sin
duplicado — pero tocar la notificación NO abre el chat correcto, ni en
Android ni en iPhone. No se trata como regresión de R22A (código
completamente distinto: R22A tocó sólo el cómputo de `icon`/`badge`
del `push` event; este finding es sobre `notificationclick`).

Se ejecutó el `public/sw.js` REAL en sandbox VM (misma técnica de
R22/R22A) probando `notificationclick` para `negocio+chat` en 2
escenarios (PWA cerrada/abierta): en AMBOS, el Service Worker calcula
`self.location.origin + "/negocio?chat=<pedidoId>"` — la URL/ventana
EXACTA y correcta, indistinguible de los 2 controles positivos
(`cliente+order_update`, `repartidor+new_delivery`) que sí funcionan
físicamente. Esto descarta con evidencia directa de ejecución: fábrica
con URL/identificador incorrecto, mapping de target roto, window-
matching role-unsafe, ruta legacy (Negocio no tiene página de chat
dedicada, usa el mismo widget global que Cliente), action handler
equivocado, atribución multi-PWA same-origin — 7 de 9 categorías
candidatas.

La única diferencia real, aislada comparando campo por campo contra
los 2 controles: `src/providers/chat-provider.tsx`::`useChatDeepLink`
es el ÚNICO consumidor de un deep-link montado en el LAYOUT RAÍZ
(antes de cualquier gate de ruta específico de rol) que se
auto-condiciona a `isAuthenticated()`/`userType()` de `auth-store.ts`
(un store Zustand `persist`, hidratación asíncrona por diseño) **sin
esperar `_hasHydrated`** y **sin ningún reintento** al completar la
hidratación. Los 2 consumidores que sí funcionan (`orders-tab.tsx`
Negocio, `client-orders-panel.tsx` Cliente) nunca se auto-verifican
auth — sólo se montan dentro de una ruta ya tratada como autenticada
por la app. Este mismo patrón defensivo (`_hasHydrated`) ya existe en
6+ archivos reales del repo — `chat-provider.tsx` es una omisión de un
patrón ya establecido, coincidente con el `AUTH_HYDRATION_PUSH_RACE`
ya documentado (nunca confirmado) en R6A de este mismo epic para un
escenario análogo distinto. Consistente con el fallo cross-platform
(Android e iPhone) — un problema de timing JS, no de renderizado
específico de plataforma.

`STRONGLY_SUPPORTED`, no `PROVEN` — no se reprodujo el timing exacto de
hidratación en un navegador real (fuera de alcance read-only). Fix
diseñado (no implementado en R23): gatear `useChatDeepLink` en
`authHasHydrated`, con reintento al completar hidratación — un solo
archivo, sin tocar `sw.js`/backend/routing de íconos/pedidos. Este
finding **bloquea el closeout de P2-T31**.

**Adenda (R23A, 2026-09-08)**: fix IMPLEMENTADO exactamente como se
diseñó — `authHasHydrated` agregado a las dependencias del efecto,
`consumeChatParam()` sin ningún otro cambio. Reproducción rigurosa:
revirtiendo temporalmente sólo la línea de dependencias, 3 de 10 tests
nuevos fallan (confirma la carrera histórica), restaurada de inmediato
y 10/10 verdes con el fix. 16 tests nuevos en total (10 de hidratación
+ 6 de `notificationclick` con el `sw.js` real). Desplegado en TESTING
(commit `23c038a`, deployment `96dc9cd8-...` `SUCCESS`). Suite Push
607/607 y PWA focal 52/52 sin regresión. `sw.js`/`push.ts`/
`auth-store.ts` sin ningún cambio. **No certificado físicamente
todavía** — pendiente confirmación en Android e iPhone real. Ver
`P2_T31_R23_CHAT_PUSH_NOTIFICATION_TAP_DEEPLINK_ROOT_CAUSE_AUDIT.md` y
`P2_T31_R23A_CHAT_NOTIFICATION_DEEPLINK_AUTH_HYDRATION_FIX_TESTING_DEPLOY.md`.

**Adenda (R23B, 2026-09-08, READ-ONLY)**: el retest físico del fix de
R23A FALLÓ en Android e iPhone. No se afirma que R23A introdujo una
regresión — su fix cerró una carrera real (10/10 tests) y sigue siendo
correcto y necesario. Evidencia nueva decisiva: con Negocio ya abierto,
autenticado y en dashboard (sin hidratación pendiente), el tap de un
chat entrante sigue sin abrir el chat — esto prueba que la carrera de
hidratación NO es la causa completa, porque `Client.navigate()` (usado
por `notificationclick` sobre una PWA ya abierta) es, por spec, una
navegación de documento real que reinicia el runtime de JS igual que un
arranque en frío, cayendo en la misma carrera de todos modos.

Inventario exhaustivo de escritores de URL en `app/negocio/**`,
`app/cliente/**`, `components/business/**`, `providers/**`, `store/**`,
`hooks/**` descartó cualquier normalización/limpieza de query que
borrara `?chat=` — ningún archivo de esos árboles toca la URL fuera de
los ya conocidos (login-form submit, el propio `useChatDeepLink`, dos
efectos de `cliente/page.tsx` gateados por params ajenos a `chat`).
`start_url`/`launch_handler` del manifest también descartados (no
interceptan URLs explícitas que el SW pasa a
`clients.openWindow()`/`client.navigate()`, y no explicarían iPhone).

Causa raíz adicional PROBADA (no sólo inferida): `ChatProvider`
(`src/providers/chat-provider.tsx`) llama `useChatDeepLink()` y luego
`useChatActorReset()` — React corre los efectos de ambos, en ese orden,
dentro del MISMO commit cuando la rehidratación de `auth-store` actualiza
`user` y `_hasHydrated` sincrónicamente (confirmado leyendo
`auth-store.ts`: `onRehydrateStorage` llama `setHasHydrated(true)`
inmediatamente después del `merge()`, sin ningún `await` de por medio).
`useChatActorReset` trata la transición `null → usuario real` igual que
un cambio real de actor y llama `useChatStore.getState().reset()` — el
único call site de producción de ese reset, confirmado por grep —
borrando el `isSheetOpen`/`activePedidoId` que `useChatDeepLink` acababa
de fijar en el mismo commit. Reproducido con un script FUERA del repo
(nunca commiteado) que monta el `useChatDeepLink` real y exportado junto
a una redeclaración fiel de `useChatActorReset`, en el mismo orden real:
el escenario "un solo commit" (el real de `auth-store.ts`) pierde el
deep-link; el escenario "dos commits separados" lo preserva — prueba
con código real, DOM real, React real.

`PROVEN`, no sólo `STRONGLY_SUPPORTED`. No se implementó ningún fix en
R23B (auditoría estrictamente read-only) — diseño (no código) para una
futura `R23C`: `useChatActorReset` debe ignorar la transición
`null → primer usuario real tras el mount`, y sólo resetear cuando el
actor anterior YA era un usuario real distinto. Este finding **sigue
bloqueando el closeout de P2-T31**. Ver
`P2_T31_R23B_CHAT_PUSH_TAP_RUNTIME_URL_CONSUMPTION_ROOT_CAUSE_AUDIT.md`.

**Adenda (R23C, 2026-09-08)**: fix IMPLEMENTADO exactamente como se
diseñó — `useChatActorReset` agrega `previous !== null` a su guard de
reset, distinguiendo la primera hidratación (`null → real`, ya NO
resetea) de un cambio de actor genuino (`real → null` logout, o
`real A → real B`, que SIGUEN reseteando sin cambios). R23A no se tocó.
Reproducción rigurosa: revirtiendo temporalmente sólo el `!== null`,
5 de 21 tests nuevos fallan; restaurado de inmediato, 21/21 verdes.
Matriz completa de 9 transiciones de actor cubierta, verificando el
estado observable del store (no espiando `reset()`). Desplegado en
TESTING (commit `1bd953a`, deployment `e1fad4be-...` `SUCCESS`, servicio
"DeliGO Copy"). Suite Push 607/607 sin regresión, `notificationclick`
6/6 sin cambios, ESLint/TypeScript (24 raw, 0 nuevos)/build limpios.
`sw.js`/`auth-store.ts`/`chat-store.ts` sin ningún cambio. **No
certificado físicamente todavía** — pendiente confirmación en Android
(cold + warm) e iPhone (cold) real. Ver
`P2_T31_R23C_CHAT_ACTOR_RESET_FIRST_HYDRATION_GUARD_FIX_TESTING_DEPLOY.md`.

**Adenda (R24, 2026-09-08)**: CONFIRMADO FÍSICAMENTE por el operador
en las 4 combinaciones obligatorias — Android Negocio cerrado (cold) y
ya abierto (warm), iPhone Negocio cerrado (cold) y ya abierto (warm),
todas PASS: la Push llega, el tap navega/abre la app correcta, y el
`ChatSheet` abre automáticamente la conversación correcta, sin quedar
en el dashboard. Este finding queda **CERRADO**. R23A (fix de
hidratación) y R23C (fix del guard de `useChatActorReset`) quedan
ambos certificados como necesarios y correctos — ninguno se revierte.

## P2-T31-R22A/R23 — F-BRANDING-R1A-03 CERRADO: fix implementado, testeado, desplegado en TESTING y CONFIRMADO FÍSICAMENTE en Cliente/Negocio/Repartidor (Android) — `data.role` es el criterio primario de icon/badge; fallback legacy y override de payload intactos (2026-09-08)

```text
FINDING_ID=F-BRANDING-R1A-03 (mismo ID, 4ta y última actualización — CERRADO)
STATUS=PHYSICALLY_CONFIRMED_FIXED_TESTING (elevado desde FIX_DEPLOYED_TESTING_AWAITING_PHYSICAL_CONFIRMATION — R23 reconcilió la evidencia física entregada por el operador: Android Cliente order_update PASS, Android Negocio chat-icon PASS, Android Repartidor new_delivery PASS)
COMMIT=ed58ca47a522b8190c41283818d1742887f24d31 / DEPLOYMENT=34f5cf79-25bd-4d7a-855c-287d8bacdc4a SUCCESS
```

`public/sw.js`::push event ahora resuelve `icon`/`badge` PRIMERO por
`data.data?.role` (cliente/negocio/repartidor → su propio ícono),
cayendo al `if/else if` legacy por `notifType` completo e intacto como
fallback exclusivo para payloads sin `role` reconocido (Salón/Mozo/
Empleado/Operaciones, y cualquier push viejo ya encolado). El override
explícito `data.icon`/`data.badge` sigue ganando siempre. Backend
(`src/lib/push.ts`) sin ningún cambio — `data.role` ya existía y se
entregaba correctamente desde antes de R22.

Reproducción antes/después del bug físico exacto de R22 (Cliente+
order_update, Negocio+chat, Repartidor+new_delivery): `FAIL→PASS`
confirmado con 26 tests nuevos que ejercitan el `sw.js` REAL (misma
técnica de `sw-push-dedupe.test.ts`, nunca una reimplementación) +
4 tests directos de `data.role` en `push.test.ts`. Suite Push completa
607/607 (577 baseline + 30 nuevos), PWA focal 52/52 sin cambios,
ESLint/TypeScript/build limpios. Desplegado en TESTING con match
exacto de commit, validado con `GET /sw.js` (contenido byte a byte
idéntico al commit) y `GET` de los 3 íconos de rol (200 cada uno) —
ninguna mutación de subscripción/pedido/Push real.

**No se certifica físicamente todavía** — requiere confirmación en
Android real: Cliente recibe `order_update` con ícono naranja de
Cliente (obligatorio); Negocio recibe `chat` con ícono turquesa propio
y Repartidor recibe `new_delivery` con ícono azul propio
(recomendados). Este finding sigue bloqueando el closeout de P2-T31
hasta esa confirmación — "R21 final" no se ejecuta todavía. Ver
`P2_T31_R22A_ANDROID_PUSH_NOTIFICATION_ROLE_ICON_ROUTING_FIX_TESTING_DEPLOY.md`.

## P2-T31-R22 (histórico, ver arriba la actualización de R22A con el fix ya desplegado) — F-BRANDING-R1A-03 ACTUALIZADO: causa raíz PROBADA — `order_update`/`review`/`chat` son notifType compartidos entre roles; el SW ignora `data.role` (ya existente) y resuelve el ícono sólo por notifType (2026-09-08)

```text
FINDING_ID=F-BRANDING-R1A-03 (actualizado, mismo ID)
STATUS=PROVEN (elevado desde OPEN/ROOT_CAUSE=NOT_AUDITED)
ROOT_CAUSE_PRIMARY_CLASS=SHARED_NOTIFTYPE_USED_BY_MULTIPLE_ROLES_WITH_ROLE_UNSAFE_ICON_MAPPING
```

Trazado completo del pipeline (`src/lib/push.ts` → `public/sw.js`) y
ejecución real del `push` event handler de `sw.js` (VM sandbox, código
genuino, no reimplementado) contra payloads con la forma exacta de
producción: **PROBADO** que `order_update` (el tipo más frecuente que
recibe un Cliente — todo el ciclo de vida de su pedido) se comparte
entre Cliente, Negocio y Repartidor, y que `sw.js` lo mapea
incondicionalmente al ícono de Negocio
(`notifType === "order_update" || ... → icon-negocio`). Reproduce
exactamente el síntoma físico reportado. Se descubrieron 2 instancias
adicionales confirmadas por el MISMO mecanismo: Cliente recibiendo
`review` (respuesta a reseña del Negocio) con ícono de Negocio, y
Negocio recibiendo `chat` (mensaje del Cliente) con ícono de Cliente
(dirección opuesta, mismo patrón).

El campo que resolvería esto YA EXISTE: `createNotification()`
(`src/lib/push.ts:608-622`, desde "Bugfix-4 [17]") agrega
`data.role = personalRoleFor(userType)` a todo payload personal
(cliente/negocio/repartidor), entregado de forma confiable end-to-end
(mismo mecanismo ya usado y certificado por `notificationclick` para
deep-linking). El `push` event handler que selecciona `icon`/`badge`
simplemente nunca lo consulta — sólo mira `data.data?.type`.

Se descartaron con evidencia directa (no por omisión): caché (el path
incorrecto se genera en tiempo de ejecución, probado), colisión de
`tag`, atribución multi-PWA de Android, binding multi-owner del lado
del servidor (el `userId`/`userType` de cada call site apunta
correctamente al destinatario real). Se documentó, citando foros
oficiales de Apple Developer, por qué iPhone se ve correcto pese al
MISMO bug de código: WebKit/Safari ignora estructuralmente el `icon`
de `showNotification()` y sustituye siempre el ícono del manifest de
la PWA instalada — una limitación de plataforma que enmascara el bug,
no evidencia de que el código esté bien.

`badge` hereda siempre el mismo valor que `icon`
(`badge: data.badge || icon`) — mismo origen, no una causa
independiente; `ANDROID_BADGE_CURRENTLY_ROLE_SAFE=NO`.

**Fix diseñado, NO implementado en R22** (tarea read-only): el `push`
event debe usar `data.data?.role` como criterio primario de selección
de ícono, cayendo al `notifType` actual completo como fallback para
tipos sin `role` (salon/mozo/empleado/operaciones/general).
Backward-compatible por diseño: sin `role` → mismo comportamiento de
hoy, nunca roto. Ver
`P2_T31_R22_ANDROID_PUSH_NOTIFICATION_ICON_ROUTING_ROOT_CAUSE_AUDIT.md`
para la matriz completa de 12 notifType × recipient(s) y la
clasificación de las 9 causas candidatas (A-I) evaluadas.

Este finding **sigue bloqueando el closeout de P2-T31** — ahora con
causa raíz probada, el siguiente paso es implementar el fix (R22A), no
un cierre final (R21).

## DELIGO-BRANDING-R1A — F-BRANDING-R1A-03 (histórico, ver arriba la actualización de R22 con causa raíz probada): Android Cliente mostró el ícono de Negocio en una notificación Push destinada a Cliente; iPhone equivalente correcto (2026-09-08)

```text
FINDING_ID=F-BRANDING-R1A-03
STATUS=OPEN
SEVERITY=MEDIUM (visual/branding, no funcional — la notificación en sí llegó y su contenido/deep-link no están cuestionados aquí)
ANDROID_PUSH_NOTIFICATION_ICON_ROUTING_FINDING=OPEN
OBSERVED_ANDROID_CLIENT_NOTIFICATION_ICON=NEGOCIO_ICON
EXPECTED_ANDROID_CLIENT_NOTIFICATION_ICON=CLIENTE_ICON
IPHONE_EQUIVALENT_NOTIFICATION_ICON_BEHAVIOR=CORRECT
ROOT_CAUSE=NOT_AUDITED
BRANDING_REFRESH_MAY_AFFECT_VISUAL_ASSET_BUT_DOES_NOT_PROVE_ROUTING_FIX=YES
P2_T31_CLOSEOUT_BLOCKED_BY_ANDROID_NOTIFICATION_ICON_ROUTING_AUDIT=YES
```

Evidencia física reportada por el operador durante la review de
Branding R1A: en Android, una notificación Push destinada al actor
Cliente se mostró con el ícono correspondiente a Negocio en lugar del
ícono de Cliente. En iPhone, el comportamiento visual equivalente se
observó correcto (ícono propio del actor). **No se investigó ni se
corrigió en esta tarea** — se documenta explícitamente para la próxima
auditoría dedicada, sin sacar conclusión de causa raíz todavía.

Evidencia de código relacionada, registrada como insumo (no como
diagnóstico): `public/sw.js` selecciona `icon` por `notifType` con un
default `icon-cliente-192x192.png` y ramas explícitas sólo para
`salon`, `mozo`/`empleado`, y Negocio (`new_order`/`order_update`/
`review`/`account_update`) — no existe ninguna rama propia para
Repartidor, Admin ni Operaciones. Este wiring, tal cual está escrito,
NO explica por sí solo el síntoma observado (una notificación de
Cliente debería caer al `default` de Cliente, no a la rama de Negocio)
— la causa exacta requiere trazar el payload completo: backend →
`notifType` → actor/recipient real enviado → service worker →
`NotificationOptions.icon`/`badge` → renderizado en Android. El
refresh de branding (R1/R1A) cambió el CONTENIDO visual de los íconos
pero no tocó esta lógica de selección — por tanto no se puede asumir
que el refresh arregló o empeoró este finding, que es anterior y
ortogonal al cambio de assets.

Este finding **bloquea el closeout final de P2-T31** — la matriz
funcional de entrega física de Push por rol ya está completa
(Cliente/Negocio/Repartidor, Android + iPhone), pero no puede
declararse un cierre limpio del epic mientras un bug de branding visual
en notificaciones reales quede sin explicar.

## DELIGO-BRANDING-R1 — F-BRANDING-R1-01: sw.js servía íconos de rol vía cache-first indefinidamente porque su condición de bypass "icon-192"/"icon-512" nunca matchea ningún nombre de archivo real (2026-09-08)

```text
FINDING_ID=F-BRANDING-R1-01
SEVERITY=LOW (efecto = branding stale hasta el próximo CACHE_NAME bump, nunca funcional)
STATUS=WORKED_AROUND_NOT_ROOT_FIXED
```

`public/sw.js` declara una regla explícita para servir "manifest files
or PWA icons" siempre desde red, nunca cacheados:
`request.url.includes("manifest") || request.url.includes("icon-192")
|| request.url.includes("icon-512")`. Verificado programáticamente:
`"icon-cliente-192x192.png".includes("icon-192")` es `false` — después
de `"icon-"` sigue `"cliente-192x192"`, nunca el substring literal
`"192"` inmediatamente pegado. Lo mismo se confirmó para los 10 nombres
de archivo reales usados hoy (`icon-{cliente,negocio,repartidor,admin,
operaciones}-{192x192,512x512}.png`) — ninguno matchea. En la práctica,
todos los PNG de ícono de rol caen en la rama cache-first de assets
estáticos más abajo en el mismo archivo (`/\.(png|jpg|...)$/`), lo cual
significa que cualquier cliente que ya tenga un ícono cacheado bajo el
`CACHE_NAME` vigente seguiría sirviéndolo indefinidamente pese a un
refresh de contenido, hasta que ese `CACHE_NAME` suba.

Se trabajó ALREDEDOR del bug (bump `deligo-v14`→`deligo-v15` en esta
misma tarea, con el comentario que documenta esta evidencia) — el bug
en sí (la condición del substring) NO se corrigió, por estar fuera del
alcance de un refresh de branding. Cualquier futuro refresh de íconos
de rol necesitará repetir manualmente este bump hasta que se corrija.
Ver `DELIGO_BRANDING_R1_PWA_ROLE_ICON_REFRESH.md` §12.

## DELIGO-BRANDING-R1 — F-BRANDING-R1-02: Operaciones dejaba de tener ícono propio (prestaba el de Negocio) desde su alta como PWA; assets fuente nuevos resuelven este préstamo (2026-09-08)

```text
FINDING_ID=F-BRANDING-R1-02
STATUS=RESOLVED_THIS_TASK
```

Desde que Operaciones se dio de alta como PWA propia ("Bugfix-2 [6]"),
`role-config.ts` documentaba explícitamente: "Reusa los íconos de
'negocio' (no se generaron imágenes nuevas...)" — y
`manifest-operaciones.json` apuntaba sus 4 entradas de `icons`
(any+maskable ×192/512) a `icon-negocio-*`. Con el asset rojo dedicado
de Operaciones ya provisto por el operador, se generaron
`icon-operaciones-192x192.png`/`512x512.png` (nuevos) y se actualizaron
`role-config.ts` + `manifest-operaciones.json` para dejar de prestar
el ícono de Negocio. Verificado con test focal explícito
(`pwa-role-icon-contract.test.ts`) que ningún archivo de
`manifest-operaciones.json` contiene ya el substring `icon-negocio`.

## R20 — F-P2-T31-R13-01: ambos intentos físicos de R19A fallaron con AbortError; source-level ruled out exhaustivamente; causa de plataforma elevada a STRONGLY_SUPPORTED con criterio de 4 niveles; VAPID validada en vivo sin malformación/mismatch (2026-09-08)

```text
R19A_PHYSICAL_MITIGATION_RESULT=FAIL
BACKEND_SUBSCRIBE_REACHED=NO
R13A_FAILURE_STATE_CONTRACT_PHYSICAL_RESULT=PASS
VAPID_MALFORMATION_STILL_PLAUSIBLE=NO
VAPID_ENV_MISMATCH_STILL_PLAUSIBLE=NO
ABORTERROR_UNDERLYING_CAUSE_STATUS=STRONGLY_SUPPORTED_PLATFORM_LEVEL_PUSH_SERVICE_REGISTRATION_FAILURE (elevado desde NOT_PROVEN_PLAUSIBLE)
FURTHER_DELIGO_CODE_CHANGE_JUSTIFIED_NOW=NO
```

El primer retest físico válido del build R19A (commit `39566e6`) ejecutó
exactamente la mitigación de R19/R19R: recheck defensivo
(`SUBSCRIBE_ABORT_RECHECK_RESULT found=false`) autorizó el único retry
permitido, y el retry TAMBIÉN falló con `AbortError` (~510ms, tras el
primer intento en ~290ms) — total 2 llamadas reales a
`registration.pushManager.subscribe()`, el límite exacto
(`MAX_PHYSICAL_SUBSCRIBE_ATTEMPTS_PER_USER_ACTION=2`), sin ningún
request HTTP hacia el backend en ningún momento. El contrato de
failure-state de R13A se verificó PASS completo de nuevo.

Se reauditó exhaustivamente la matriz de precondiciones source-level
del `subscribe()` exacto (forma/conversión/longitud/contenido de la
VAPID key, origen, `ServiceWorkerRegistration`, scope, worker activo,
secure context, permiso, user gesture, timing, same-origin, ausencia de
subscription previa ambigua) — todas PASS, cada una con evidencia
directa de código/snapshot/spec, ninguna asumida. Se hizo un `GET
/api/push/vapid-key` real (lectura pública, no mutante) contra TESTING
y se decodificó la key vigente localmente sin imprimirla: 87 caracteres
base64url → 65 bytes decodificados, primer byte `0x04` (formato EC
P-256 sin comprimir canónico) — descarta malformación con evidencia
directa, no por plausibilidad. `GIT_DEPLOY_HISTORY.md` no registra
ninguna rotación de VAPID jamás — descarta mismatch de entorno; la
MISMA key sirvió con éxito para Android Cliente e iPhone (los 3 roles),
`CERTIFIED_TESTING` en el mismo periodo.

Investigación de Chromium/Push API con fuentes 2025-2026 (Opera
forums, `firebase/firebase-js-sdk#7748`/`#7764`, GitLab Gitter
webapp#1892, MDN): confirmado por múltiples fuentes independientes que
`PushManager.subscribe()` en Chrome/Android envía internamente una
solicitud HTTPS a `android.clients.google.com/c2dm/register3` (registro
FCM) — un fallo en ESA solicitud interna es lo que Chrome expone como
`AbortError`. El issue `firebase-js-sdk#7748` documenta un caso
completamente ajeno a DeliGO (Pixel 6, Android 14, Chrome 118) con el
MISMO síntoma exacto, cerrado sin causa raíz aislada ni siquiera por el
propio equipo de Firebase.

Con esto, y con 4 ocurrencias totales de `AbortError` ya documentadas
en todo el epic (R13 Cliente, R18 Negocio, y estos 2 intentos de R19A —
3 de las 4 en el MISMO dispositivo Negocio, tras una reinstalación
completa de la PWA auditada como estructuralmente incapaz de tocar la
capa de causa plausible de Chrome/Play Services/FCM — ver §13 del
reporte), se introduce un criterio explícito de 4 niveles
(`NOT_PROVEN`/`PLAUSIBLE`/`STRONGLY_SUPPORTED`/`CONFIRMED`) y se eleva
`ABORTERROR_UNDERLYING_CAUSE_STATUS` de `NOT_PROVEN_PLAUSIBLE` a
`STRONGLY_SUPPORTED` — deliberadamente sin llegar a `CONFIRMED`, que
exigiría una prueba de control independiente (diseñada como próximo
paso: `web-push-codelab.glitch.me`, demo oficial GoogleChromeLabs, sin
login/APK/datos personales, en el mismo dispositivo).

`FURTHER_DELIGO_CODE_CHANGE_JUSTIFIED_NOW=NO` — ningún cambio de código
se justifica todavía: la matriz de precondiciones agotó lo auditable
desde DeliGO, y la mitigación ya implementada (R19/R19R) se ejecutó
exactamente como fue diseñada. Ver
`P2_T31_R20_ANDROID_PERSISTENT_ABORTERROR_ROOT_CAUSE_DEVICE_DIAGNOSTIC.md`.

## R19A — F-P2-T31-R13-01: mitigación completa desplegada en TESTING (commit 39566e6), pendiente de certificación física (2026-09-08) — AMBOS INTENTOS DEL RETEST FÍSICO FALLARON, CAUSA ELEVADA A STRONGLY_SUPPORTED POR R20 ARRIBA

```text
FINDING_ID=F-P2-T31-R13-01 (desplegado en TESTING — los reportes históricos R19/R19R/R19R1 quedan preservados sin editar)
COMMIT_HASH=39566e69647fd2b19453721214563a7b9a0ccc5e
TESTING_DEPLOYMENT_ID=425ff95a-5a2e-4d70-9dd1-fbae6df5ce19 / TESTING_DEPLOYMENT_STATUS=SUCCESS (match exacto verificado)
ANDROID_PHYSICAL_MITIGATION_CERTIFIED=NO
PRODUCTION_TOUCHED=NO
```

El diff local completo de R19 (retry único con recheck defensivo) +
R19R (guard stale-actor pre-backend) + R19R1 (cobertura explícita de
registry) quedó desplegado en TESTING sin ningún cambio funcional
adicional — el review final pre-commit confirmó línea por línea que el
diff coincide exactamente con lo ya auditado en los 3 reportes. Commit
único `39566e6`, push a `testing-codex`, autodeploy Git-triggered
normal a "DeliGO Copy" con `SUCCESS` verificado ejecutando ese
`commitHash` exacto (`railway status --json`, no asumido). Smokes NO
destructivos limpios (sin ejecutar `POST /api/push/subscribe`).
Production (`origin/main`, servicio "DeliGO") confirmado sin cambios
en el mismo JSON.

**El deploy no constituye evidencia de que la mitigación resuelva el
`AbortError` físico real** — `ANDROID_PHYSICAL_MITIGATION_CERTIFIED=NO`
hasta el próximo retest. Único siguiente paso: un solo reintento físico
de activación en Android Negocio, con la traza armada, sobre este
build exacto. El hallazgo lateral de `unsubscribe()` (mismo patrón de
fetch incondicional, sin retry) se preservó sin corregir. Ver
`P2_T31_R19A_REVIEW_COMMIT_PUSH_TESTING_DEPLOY.md`.

## R19R1 — F-P2-T31-R13-01: evidencia explícita de registry SET/RELEASE para la ruta compuesta stale-during-retry (2026-09-08) — DESPLEGADO EN TESTING POR R19A ARRIBA

```text
FINDING_ID=F-P2-T31-R13-01 (evidencia completada — el reporte histórico R19R queda preservado sin editar)
MUTATION_REGISTRY_SET_COUNT_STALE_ABORT_RETRY=1 / MUTATION_REGISTRY_RELEASE_COUNT_STALE_ABORT_RETRY=1 / MUTATION_REGISTRY_FINAL_ENTRY_EXISTS_STALE_ABORT_RETRY=NO
MUTATION_REGISTRY_SET_COUNT_NORMAL_SUCCESS=1 / MUTATION_REGISTRY_RELEASE_COUNT_NORMAL_SUCCESS=1 / MUTATION_REGISTRY_FINAL_ENTRY_EXISTS_NORMAL_SUCCESS=NO
STALE_DURING_ABORT_RETRY_BACKEND_CALL_COUNT=0 (preservado)
PRODUCT_CODE_CHANGED_IN_R19R1=NO
FOCAL_TEST_PASS=577 / FOCAL_TEST_FAIL=0 / NEW_TYPECHECK_ERRORS=0
```

R19R (bloque abajo) había demostrado dinámicamente que `gate.begin()`
se llama exactamente 1 vez en el flujo compuesto creación+bind —
evidencia INDIRECTA de una sola operación de alto nivel. El TEST 8 de
su propio mandato pedía explícitamente `MUTATION_REGISTRY_SET`/
`MUTATION_REGISTRY_RELEASE` contados DIRECTAMENTE en la ruta compuesta
nueva (stale-durante-el-retry-de-AbortError) — esa discrepancia de
evidencia queda cerrada.

Se extendió `use-push-notifications-stale-actor-backend-guard.test.ts`
(sin archivos nuevos) con un harness TEST-ONLY
(`runLikeSubscribeHighLevelOperation`) que compone, en el mismo orden
que `subscribe()` propio, las 3 funciones REALES ya exportadas:
`createPhysicalPushSubscriptionWithAbortRecovery` (R19),
`bindPhysicalPushSubscriptionToBackend` (R19R), y
`registerInFlightPersonalPushMutation` (R2, el registry REAL de
`push-mutation-in-flight-registry.ts` — **nunca mockeado**). No es un
mock que reproduce el resultado deseado — cada función interna es la
implementación real ya probada por su propia suite.

Test 1 (el que faltaba): la operación arranca (SET síncrono
confirmado), primer intento físico → `AbortError`, recheck → `null`,
segundo intento físico queda GENUINAMENTE pendiente (confirmado con
`hasInFlightPersonalPushMutationForDebug === true` en ese instante), el
actor se invalida MIENTRAS sigue pendiente, el intento resuelve con
éxito DESPUÉS, el bind se salta por stale (backend call count sigue en
0) — resultado: `SET=1`, `RELEASE=1`, entrada final ausente. Test 2:
mismo harness para el camino normal exitoso, mismo contrato de
limpieza, sin duplicar toda la suite.

Ni el retry de R19 ni el guard de R19R fueron modificados — confirmado
por un `git diff --stat` de `use-push-notifications.ts` IDÉNTICO al
que R19R dejó (cero cambios netos de esta tarea). No apareció ningún
bug real durante esta cobertura. 577 tests focales en 0 fail (575
previos + 2 nuevos, mismos 33 archivos), ESLint limpio, TypeScript
idéntico a la baseline. El hallazgo lateral de `unsubscribe()` se
preservó sin corregir. Sin commit/push/deploy, sin tocar backend/
schema/dependencias. Ver
`P2_T31_R19R1_EXPLICIT_MUTATION_REGISTRY_COVERAGE.md`.

## R19R — F-P2-T31-R13-01: gap stale-actor/backend cerrado (nuevo, no en R19); gap preexistente reconocido honestamente (2026-09-08) — EVIDENCIA DE TEST 8 COMPLETADA POR R19R1 ARRIBA

```text
FINDING_ID=F-P2-T31-R13-01 (guard stale-actor agregado — el reporte histórico R19 queda preservado sin editar)
PRE_BACKEND_STALE_OPERATION_GUARD_EXISTS_BEFORE_R19R=NO
PREEXISTING_STALE_BACKEND_BIND_GAP_EXPOSED_DURING_R19_REVIEW=SI
STALE_ACTOR_GUARD_IMPLEMENTED=SI / STALE_ACTOR_GUARD_SOURCE=OP_ID_ONLY
STALE_DURING_ABORT_RETRY_TEST=PASS / STALE_DURING_ABORT_RETRY_BACKEND_CALL_COUNT=0 / STALE_AFTER_FIRST_PHYSICAL_SUCCESS_BACKEND_CALL_COUNT=0
DOUBLE_BACKEND_REGISTER_POSSIBLE=NO / R13A_FAILURE_STATE_CONTRACT_PRESERVED=SI
FOCAL_TEST_PASS=575 / FOCAL_TEST_FAIL=0 / NEW_TYPECHECK_ERRORS=0
```

El reporte de R19 (bloque abajo) ya había reconocido con honestidad que
el `POST /api/push/subscribe` en `subscribe()` corría
**incondicionalmente** respecto al gate de operación — nada verificaba
`gate.isCurrent(opId)` ANTES del `fetch`; sólo `finishMutation`,
DESPUÉS de que el request ya había salido, decidía si el resultado se
aplicaba a la UI. Con la ventana de R19 (hasta 2 intentos físicos + un
recheck defensivo, todos `await`-eados en secuencia) esa ventana se
hizo más larga — pero el gap en sí **no es nuevo de R19**: existía ya
para el caso de un solo intento, y se reconoce honestamente como tal
(`PREEXISTING_STALE_BACKEND_BIND_GAP_EXPOSED_DURING_R19_REVIEW=SI`,
nunca presentado como bug introducido por R19).

Se implementó `bindPhysicalPushSubscriptionToBackend` (nueva, exportada
en `use-push-notifications.ts`, mismo patrón de dependencias inyectadas
que `checkPersonalPushStatus`): verifica `gate.isCurrent(opId)` — la
MISMA autoridad canónica que `finishMutation` ya usa en todo el
archivo (los cambios de actor enrutan exclusivamente por
`gate.invalidate()`, nunca por una comparación de identidad separada
— `STALE_ACTOR_GUARD_SOURCE=OP_ID_ONLY`, sin duplicar autoridad) —
como la ÚLTIMA sentencia síncrona antes de construir la URL y llamar
al backend, con **cero `await`** entre el guard y el request de red.
Si la operación quedó stale: sin backend POST, sin toast, sin estado
ON, sin inventar un error técnico — resuelve por el mismo
`finishMutation(opId, false)` que cualquier otra rama stale del
archivo ya usa. La `PushSubscription` física NUNCA se destruye por
quedar stale — pertenece al browser/origin, el actor que sucede a la
operación la reconcilia por su propio flujo normal.
`createPhysicalPushSubscriptionWithAbortRecovery` (R19) no fue tocada
— el retry (máximo 2 intentos, sólo `AbortError`, recheck obligatorio,
sin delay) queda exactamente igual.

**TEST 9 del mandato original de R19, ahora determinista** (nuevo
archivo `use-push-notifications-stale-actor-backend-guard.test.ts`):
compone el `LatestOperationGate` REAL con la función de retry REAL de
R19, controlando el timing exacto — el segundo intento físico queda
GENUINAMENTE pendiente, el test invoca `gate.invalidate()` mientras
sigue pendiente, LUEGO el intento resuelve con éxito, y se confirma
`backend.calls.length === 0`. Un test paralelo prueba el mismo gap
para el camino SIN `AbortError` (éxito inmediato + actor stale antes
del backend) — 6 conteos exactos de llamadas a backend quedan
afirmados con tests reales, no sólo grep. Un test dedicado
(`spyOnGateBegin`) prueba dinámicamente que ni la creación ni el bind
mintan una segunda operación de alto nivel.

575 tests focales en 0 fail (33 archivos), ESLint limpio, TypeScript
idéntico a la baseline (0 nuevos). Se corrigieron 2 assertions de
`use-push-notifications-static-contract.test.ts` cuya ubicación
literal cambió por el refactor (la invariante que protegen —
construcción de URL desde `actorType`, `fetch` consume la variable
calculada nunca un literal — sigue exactamente igual). `unsubscribe()`
tiene el mismo patrón de fetch incondicional (sin retry que lo haga
relevante hoy) — documentado como hallazgo lateral, no corregido, fuera
de alcance de esta tarea. Sin commit/push/deploy, sin tocar backend/
schema/dependencias. Ver
`P2_T31_R19R_ABORTERROR_RETRY_STALE_ACTOR_BACKEND_GUARD.md`.

## R19 — F-P2-T31-R13-01: mitigación de retry único implementada localmente tras 2da recurrencia consecutiva de AbortError (2026-09-08) — GAP STALE-ACTOR/BACKEND CERRADO POR R19R ARRIBA

```text
FINDING_ID=F-P2-T31-R13-01 (mitigación implementada — el reporte histórico R18 queda preservado sin editar)
ANDROID_NEGOCIO_MANUAL_RETRY_STATUS=FAIL_ABORTERROR (2da recurrencia consecutiva, proceso nuevo)
MANUAL_RETRY_ONLY_STRATEGY=INSUFFICIENT
ANDROID_ABORTERROR_MITIGATION_REQUIRED_BEFORE_T31_CLOSEOUT=SI (corregido desde NO de R18)
ABORTERROR_RETRY_IMPLEMENTED=SI / ABORTERROR_RETRY_MAX_ATTEMPTS=2 / ABORTERROR_RETRY_ONLY_FOR_ABORTERROR=SI / ABORTERROR_POST_FAILURE_GETSUBSCRIPTION_RECHECK=SI
DOUBLE_BACKEND_REGISTER_POSSIBLE=NO / POST_ABORT_RECHECK_FAILURE_FAILS_CLOSED=SI / R13A_FAILURE_STATE_CONTRACT_PRESERVED=SI
FOCAL_TEST_PASS=564 / FOCAL_TEST_FAIL=0 / NEW_TYPECHECK_ERRORS=0
```

El reintento manual único que R18 había autorizado a Leonardo en
Android Negocio también falló con `AbortError` — en un PROCESO NUEVO
de la PWA (descarta estado de memoria arrastrado, `opId` viejo, o
mutación en vuelo previa), ~1103ms, backend nunca alcanzado por
segunda vez consecutiva. La condición explícita que R18 había dejado
(si el retry manual también falla, implementar el recheck defensivo +
retry único) se cumplió.

Se implementó `createPhysicalPushSubscriptionWithAbortRecovery` en
`src/hooks/use-push-notifications.ts`: envuelve la función existente
`createPhysicalPushSubscription` (sin modificarla) con, como máximo,
UN intento físico adicional, gateado exclusivamente por `errorClass
=== "AbortError"` — cualquier otro error re-lanza de inmediato, sin
cambios respecto al comportamiento previo. Ante `AbortError`, relee
OBLIGATORIAMENTE `getSubscription()` antes de cualquier retry: si
encuentra una subscription cuya VAPID key coincide con la vigente
(mismo `applicationServerKeyMatches` ya usado en todo el archivo), la
reutiliza sin un segundo `subscribe()`; si el recheck lanza, o
encuentra una subscription ambigua/stale, FALLA CERRADO con el
`AbortError` ORIGINAL — nunca un retry a ciegas, nunca destruye la
subscription ambigua (esa decisión sigue siendo exclusiva del flujo
de remoción de key obsoleta ya existente). Sólo un `null` confirmado
autoriza el único retry físico #2, con su propio trace distinguible
(`SUBSCRIBE_PHYSICAL_RETRY_START/RESULT/ERROR`, separado de
`SUBSCRIBE_ABORT_RECHECK_START/RESULT/ERROR`). Sin delay, sin ninguna
rama de browser/plataforma, sin tocar el mutation gate/registry (cero
referencias a `gate`/`opId=`/`begin(` dentro del wrapper), sin tocar
ningún endpoint de backend. Estructuralmente imposible una doble
subscription física o un doble registro backend — un único call site
de `fetch(subscribeUrl...)` en todo el archivo.

10 tests deterministas nuevos cubren los 7 escenarios físicos
directamente; los 3 restantes (mutation registry, gate stale,
consumidores de rol Cliente/Negocio/Repartidor) quedan cubiertos por
inspección estructural explícita más la regresión verde de las suites
R2/R7/R13A y los 3 static-contracts de rol, sin necesitar cambios en
ellas. 564 tests focales en 0 fail, ESLint limpio, TypeScript idéntico
a la baseline vigente (0 nuevos). Sin commit/push/deploy — la
mitigación queda lista para revisión y deploy, pendiente del ciclo
completo commit→deploy→smoke→retest físico de Android Negocio antes de
poder certificarla con evidencia real. Ver
`P2_T31_R19_ANDROID_PUSHMANAGER_ABORTERROR_SINGLE_RETRY_HARDENING.md`.

## R18 — F-P2-T31-R13-01 RECURRIÓ cross-role (Negocio); failure-state contract de R13A verificado PASS; no se reabre el bug de UI stale (2026-09-08) — MITIGACIÓN IMPLEMENTADA POR R19 ARRIBA

```text
FINDING_ID=F-P2-T31-R13-01 (recurrencia confirmada — el reporte original R13/R13A/R14 queda preservado sin editar)
ANDROID_R18_MATCHES_R13_FAILURE_CLASS=SI (misma etapa exacta: PushManager.subscribe() -> AbortError, ~290ms, antes de backend)
ANDROID_ABORTERROR_UNDERLYING_CAUSE_STATUS=NOT_PROVEN_PLAUSIBLE_PLATFORM_LEVEL_PUSH_SERVICE_REGISTRATION_FAILURE (sin cambios desde R13)
R13A_FAILURE_STATE_CONTRACT_CURRENT_PHYSICAL_RESULT=PASS
ANDROID_R18_ROLE_SPECIFIC_CODE_CAUSE_STATUS=NO_EVIDENCE
ANDROID_PHYSICAL_CREATE_RELIABILITY_CURRENT_STATUS=HISTORICAL_3_OF_3_PASS_BUT_ABORTERROR_RECURRENCE_CONFIRMED
ANDROID_ABORTERROR_MITIGATION_REQUIRED_BEFORE_T31_CLOSEOUT=NO
```

Durante el smoke corto de Android Negocio (posterior a la
certificación física de Android Cliente en R17), `PushManager.
subscribe()` volvió a rechazar con `AbortError` (~297ms, sin llegar a
backend) — comparado campo por campo contra R13 (Cliente,
2026-09-06): mismo `errorClass`, mismo orden de magnitud de duración,
mismo estado previo (`permission=granted`, SW `activated`, VAPID fetch
exitoso, sin subscription existente), mismo punto exacto de rechazo.
**No se afirma la misma causa raíz de plataforma** (sigue sin probarse,
tal como R13/R13A/R14 la dejaron) — sólo se afirma la misma
CLASE/ETAPA de fallo, que sí está probada campo por campo.

Lo que SÍ es diferente y significativo: en R13, `SUBSCRIBE_FINISH`
nunca se disparó (bug real de UI stale, corregido por R13A) y el switch
quedó stale en ON; en esta recurrencia, `SUBSCRIBE_FINISH` se disparó
correctamente (`current=true subscribed=false errorClass=AbortError`),
el registry liberó, y el switch terminó OFF — el contrato de
failure-state de R13A (§10 de su reporte) se verificó `PASS` completo
contra un fallo real, en un rol (Negocio) distinto al que originalmente
lo expuso (Cliente). **No se reabre el bug de UI stale de R13** — sigue
corregido y ahora confirmado funcionando en un escenario de fallo real
posterior al deploy.

Se auditó el código real de los 3 consumidores de rol
(`client-profile-panel.tsx`, `config-tab.tsx`, `profile-tab.tsx`) y se
confirmó con evidencia directa de código — no por asunción de "es
compartido, entonces es plataforma" — que los 3 llaman exactamente la
misma función `usePushNotifications()` sin ninguna rama condicionada
por rol antes del punto de fallo. Se probó, precondición por
precondición, que auth Negocio, backend ownership, rate limiter, DB y
provider send no pudieron ser causa de este intento — cero requests
HTTP salieron del browser (no se confunde SUBSCRIBE físico con SEND de
notificación).

El `PASS_3_OF_3_CONSECUTIVE` de R14 se preserva histórico sin
reescribirse; se reconcilia con un marcador de estado ACTUAL separado.
Android Cliente (R17) no se invalida — la nueva falla es de creación en
Negocio, sin relación con la matriz de entrega ya certificada de
Cliente. Se evaluaron 9 opciones de mitigación de código sin
implementar ninguna (2 ocurrencias totales, evidencia insuficiente para
justificar un retry automático); único siguiente paso: un reintento
manual único del switch de Negocio con la traza armada. Ver
`P2_T31_R18_ANDROID_ABORTERROR_CROSS_ROLE_RECURRENCE_AUDIT.md`.

**Nueva evidencia física del operador, registrada en la misma tarea**:
iPhone Negocio (N1-N7) e iPhone Repartidor (R1-R7) llegaron con PASS
completo en todas sus capas — los 3 roles de iPhone quedan
`CERTIFIED_TESTING`.

## R17 — F-P2-T31-R16-01 RECONCILIADO: causa confirmada por el operador — notificaciones Chrome deshabilitadas a nivel Android (2026-09-08)

```text
FINDING_ID=F-P2-T31-R16-01 (RECONCILIADO — autoridad ACTUAL; el bloque R16 original abajo queda preservado sin editar)
ANDROID_R16_SUBSCRIPTION_LOSS_ROOT_CAUSE_STATUS (ACTUAL)=CONFIRMED_EXTERNAL_DEVICE_NOTIFICATION_CONFIGURATION
ANDROID_R16_SUBSCRIPTION_LOSS_ROOT_CAUSE_STATUS (HISTÓRICO, tal cual R16 lo dejó)=PLATFORM_LEVEL_PLAUSIBLE_NOT_PROVEN
ANDROID_DEVICE_NOTIFICATION_ROOT_CAUSE=CHROME_NOTIFICATIONS_DISABLED_AT_ANDROID_OS_LEVEL
ANDROID_PUSH_CODE_BUG_FOR_THIS_INCIDENT=NO_EVIDENCE
ANDROID_R16_FAILURE_MODEL_CURRENT_INTERPRETATION=DEVICE_NOTIFICATION_CONFIGURATION_EXPLAINS_OBSERVED_FAILURES_AND_SUBSEQUENT_FIX_IS_PHYSICALLY_CONFIRMED
R15A_URGENCY_MITIGATION_STATUS=DEPLOYED_COMPATIBLE_NOT_PROVEN_ROOT_CAUSE
ANDROID_CLIENT_PUSH_MATRIX_STATUS=CERTIFIED_TESTING
```

Leonardo revisó su dispositivo físico tras R16 y encontró que las
notificaciones de Chrome estaban deshabilitadas a nivel del sistema
Android — exactamente el "platform-level" que R16 había dejado
plausible pero no probado (sección 12 de ese reporte, por falta de
acceso al dispositivo). Después de habilitarlas, sin ningún cambio de
código ni redeploy, las 4 capas pendientes de la matriz Android
Cliente pasaron físicamente: foreground, closed-PWA/background,
notification tap (destino correcto) y OFF+cold-reopen (sin
auto-reactivación). Esto NO reescribe el reporte original de R16 — ese
archivo sigue diciendo `PLATFORM_LEVEL_PLAUSIBLE_NOT_PROVEN` porque
era exacto en su momento; esta entrada es la reconciliación de
autoridad ACTUAL. Tampoco se afirma un bug de Chrome/Android — fue una
configuración externa del dispositivo. R15A no se le adjudica la causa
raíz (no se revierte, sigue compatible con lo observado). El hallazgo
de "en camino" pre-aceptación de repartidor se clasificó como
comportamiento esperado del código actual, no como fallo de push. Ver
`P2_T31_R17_ANDROID_CLIENT_PUSH_PHYSICAL_CERTIFICATION_AND_CONTEXT_RECONCILIATION.md`.

## R16 (TEXTO ORIGINAL, RECONCILIADO POR R17 ARRIBA) — F-P2-T31-R16-01, pérdida física real de PushSubscription tras cierre/reapertura (PLATFORM_LEVEL_PLAUSIBLE_NOT_PROVEN, 2026-09-07/08)

```text
FINDING_ID=F-P2-T31-R16-01
ANDROID_R16_SUBSCRIPTION_LOSS_ROOT_CAUSE_STATUS=PLATFORM_LEVEL_PLAUSIBLE_NOT_PROVEN
ANDROID_R16_SUBSCRIPTION_LOSS_ROOT_CAUSE=BROWSER_OR_OS_LEVEL_PERMISSION_OR_SUBSCRIPTION_INVALIDATION_OUTSIDE_DELIGO_CODE
R16_PROVIDER_SEND_FOR_522C650F=SI (201 a las 01:28:46Z, luego 410 REAL a las 01:29:43Z, mismo endpoint)
R16_FAILURE_MODEL=SINGLE_CAUSE_PROVEN
R15A_CHANGE_CAUSED_SUBSCRIPTION_LOSS=NO_EVIDENCE
FIX_IMPLEMENTED=NO
```

El retest físico post-R15A reveló que la `PushSubscription` de
Leonardo (`endpointFingerprint=522c650f`), creada y confirmada
correctamente server-side, desaparece tras cerrar y reabrir la PWA
(`physicalSubscription=false`, `permission=default` en el proceso
nuevo). Se auditaron exhaustivamente TODAS las rutas de código DeliGO
que podrían destruir una subscription física o resetear el permiso —
el hook personal (`PERSONAL_MANUAL_DISABLE_PHYSICAL_UNSUBSCRIBE=NO`,
certificado por static-contract test), los 3 rollbacks de creación
fallida (permission-prompt/salón/mozo, ninguno se disparó porque el
guardado backend fue exitoso), el logout (sólo limpia estado de
React), el Service Worker (`unregisterServiceWorker` existe pero sin
ningún caller real), y cualquier lifecycle listener
(pagehide/visibilitychange/unmount) — **ninguno coincide con el
incidente ni podría haberlo causado**. `Notification.permission` no
puede ser reseteado programáticamente por ningún código de DeliGO — el
valor `default` observado es el valor REAL que el navegador devolvió,
no algo que el código pudiera haber escrito.

**Evidencia decisiva** (logs REALES de Railway TESTING, sólo lectura,
ventana exacta `01:25:00Z`–`01:45:00Z`): un envío real a `522c650f` a
las `01:28:46Z` (tipo `order_update`, con las opciones de urgency de
R15A ya vigentes) fue **aceptado por el proveedor (`providerStatus=
201`)**. Un segundo cambio de estado del MISMO pedido, 57 segundos
después, generó un segundo intento que recibió un **410 GENUINO**
("Subscription expired") para el MISMO endpoint — el backend reaccionó
exactamente como está diseñado (CAS-safe), limpiando el binding legacy
sin ninguna inferencia. El mismo actor había sufrido la muerte de OTRO
endpoint apenas 90 segundos ANTES de que arrancara esta sesión — un
patrón que se repite, no un evento aislado.

Esto separa con precisión dos preguntas antes mezcladas: el pipeline de
envío (R15A, urgency por tipo) funcionó correctamente (201 real); la
pérdida de la subscription es un evento REAL de plataforma (confirmado
por el proveedor, no inferido por DeliGO), no un bug de código.
`R15A_CHANGE_CAUSED_SUBSCRIPTION_LOSS=NO_EVIDENCE` — R15A no se
revierte. Sin bug de código probado, `FIX_IMPLEMENTED=NO` — se
descartó explícitamente cualquier re-subscribe automático silencioso
(ocultaría el problema en vez de permitir seguir diagnosticándolo).
Ver
`P2_T31_R16_ANDROID_PUSH_SUBSCRIPTION_PERSISTENCE_LOSS_ROOT_CAUSE_AUDIT.md`.
Próxima acción recomendada:
`OPERATOR_CHECK_DEVICE_NOTIFICATION_PERMISSION_STATE_BEFORE_NEXT_ANDROID_RETEST`.

## R15A — mitigación R15R desplegada en TESTING, causa raíz sigue UNRESOLVED pendiente de retest físico (2026-09-07) — RETEST FÍSICO REVELÓ LA REGRESIÓN DE R16 ARRIBA

```text
R15A_COMMIT=d7cc66dcce6b2367cf52e5438741b02d5a2a2a84
R15A_RAILWAY_DEPLOYMENT_ID=906d7960-10f5-449b-a1bd-a492feb91bab
R15A_RAILWAY_STATUS=SUCCESS / R15A_RAILWAY_COMMIT_MATCH=SI
PROVEN_ROOT_CAUSE=NO (sin cambios — el deploy no es evidencia de causa, sólo pone la mitigación disponible para el retest)
```

El finding `F-PAYMENTS-PAUSE-ANDROID-CLOSED-PWA-01` (bloque R15R
abajo) queda desplegado en TESTING (commit/push/deploy explícitamente
autorizados por el operador). El deploy en sí NO constituye evidencia
de causa raíz — `PROVEN_ROOT_CAUSE` sigue `NO` hasta el reintento
físico `ANDROID_CLOSED_PWA_PUSH_RETEST_POST_R15A`. Ver
`P2_T31_R15A_COMMIT_DEPLOY_AND_CLOSED_PWA_RETEST_READY.md`.

## R15R — F-PAYMENTS-PAUSE-ANDROID-CLOSED-PWA-01 corregido pre-deploy: TTL nunca estuvo ausente, causa raíz bajada a UNRESOLVED, urgency acotada por tipo (2026-09-07) — DESPLEGADO POR R15A ARRIBA

```text
FINDING_ID=F-PAYMENTS-PAUSE-ANDROID-CLOSED-PWA-01 (corregido por R15R, ver bloque R15 abajo para el texto original)
STATUS=ROOT_CAUSE_UNRESOLVED_MITIGATION_APPLIED_PENDING_DEPLOY_AND_RETEST
WEB_PUSH_LIBRARY_VERSION=3.6.7 / WEB_PUSH_DEFAULT_TTL=2419200 (28 dias) / WEB_PUSH_DEFAULT_URGENCY=normal
MISSING_TTL_BEFORE_R15=NO
PROVEN_ROOT_CAUSE=NO
ANDROID_CLOSED_PWA_FAILURE_ROOT_CAUSE_STATUS=UNRESOLVED_WITH_HIGH_URGENCY_AS_STRONG_MITIGATION_CANDIDATE (corregido desde HIGH_CONFIDENCE_CODE_BUG)
GLOBAL_HIGH_URGENCY_JUSTIFIED=NO
```

R15 clasificó `ANDROID_CLOSED_PWA_FAILURE_ROOT_CAUSE=MISSING_PUSH_
URGENCY_AND_TTL_OPTIONS_ON_WEBPUSH_SEND` (ver bloque original abajo).
Se auditó la versión REAL instalada de `web-push` (3.6.7,
`node_modules/web-push/src/web-push-lib.js`): `DEFAULT_TTL=2419200`
(28 días) y `urgency` default `"normal"` — el TTL NUNCA estuvo
ausente, la librería siempre lo aplicó por default con mucha más
retención que cualquier valor que R15 pudiera fijar explícitamente. El
candidato real de código era sólo `urgency`, no "urgency y TTL" como
par conjunto. Además, R15 nunca tuvo una captura directa (request/
response del proveedor, traza del SW) que probara la causa para ESTE
incidente — ese nivel de evidencia no sostiene `HIGH_CONFIDENCE_CODE_
BUG`; se corrige a `UNRESOLVED_WITH_HIGH_URGENCY_AS_STRONG_MITIGATION_
CANDIDATE`.

Se inventariaron los 12 `NotificationType` reales del pipeline
(`src/lib/push.ts`) y se clasificaron:

```text
TIME_SENSITIVE (8): order_update, new_order, new_delivery, chat, mesa_order_ready, salon_new_order, operaciones_salon_new_order, operaciones_order_cancelled
NON_TIME_SENSITIVE (4): review, review_request, account_update, general (sin fabrica de payload real, solo alcanzable en tests)
```

`urgency:"high"` ahora se pide SÓLO para los 8 tipos time-sensitive
(`isTimeSensitivePushType` en `push.ts`) — nunca global "por
comodidad": una reseña o un cambio de cuenta no pierden nada real por
una entrega no urgente. El `TTL: 60*60*24` que R15 había agregado se
REMOVIÓ por completo — acortaba la retención real (28 días por
default) sin ninguna decisión de producto que lo autorizara, y no
tenía relación con el problema de urgencia auditado.

El log de éxito `[Push] Enviado OK` (agregado por R15) había quedado
corriendo en TODOS los ambientes pese a que la propia tarea R15 lo
había autorizado sólo para TESTING (ver `PUSH_DIAGNOSTICS_POST_CERT_
ACTION` en su reporte). Se gateó con el guard ya existente
(`isPushDebugAllowedEnvironment`, `src/lib/push-testing-guard.ts`,
`RAILWAY_ENVIRONMENT_NAME`) y ahora incluye el `statusCode` real que
devuelve `webpush.sendNotification()` en éxito (nunca `body`/
`headers`).

240 tests focales (`push*.test.ts`, 8 archivos) en 0 fail. ESLint
limpio en los 2 archivos tocados. TypeScript: 24 raw / 18 distintos,
idéntico a la baseline de R15 — 0 nuevos. Sin commit/push/deploy. Ver
`P2_T31_R15R_PREDEPLOY_EVIDENCE_CORRECTION_AND_PUSH_PRIORITY_SCOPE.md`.

## R15 (TEXTO ORIGINAL, CORREGIDO POR R15R ARRIBA) — F-PAYMENTS-PAUSE-ANDROID-CLOSED-PWA-01 root-caused (HIGH_CONFIDENCE, no PROVEN): falta urgency/TTL en webpush.sendNotification (2026-09-07)

```text
FINDING_ID=F-PAYMENTS-PAUSE-ANDROID-CLOSED-PWA-01 (actualizado)
STATUS=ROOT_CAUSE_HIGH_CONFIDENCE_LOCAL_FIX_APPLIED_PENDING_DEPLOY_AND_RETEST (CORREGIDO POR R15R ARRIBA)
ANDROID_CLOSED_PWA_FAILURE_ROOT_CAUSE_STATUS=HIGH_CONFIDENCE_CODE_BUG (CORREGIDO POR R15R ARRIBA)
ANDROID_CLOSED_PWA_FAILURE_ROOT_CAUSE=MISSING_PUSH_URGENCY_AND_TTL_OPTIONS_ON_WEBPUSH_SEND (CORREGIDO POR R15R ARRIBA)
FIX_IMPLEMENTED=SI_LOCAL_SOLAMENTE_NO_DESPLEGADO
```

Leonardo retomó las pruebas Android (`ANDROID_PHYSICAL_TESTING_PAUSED_
BY_OPERATOR=NO`) para cerrar P2-T31 antes de Mercado Pago. Auditoría de
punta a punta del pipeline de push: **hallazgo de proceso crítico**, el
canal realtime (Socket.IO, `RealtimeEventMap` en
`src/lib/realtime-types.ts`) no tiene NINGÚN evento de cambio de estado
de pedido — todo el ciclo de vida de pedidos usa EXCLUSIVAMENTE Web
Push real (`src/lib/push.ts::createNotification`). Esto prueba que el
test foreground (PASS) y el test closed-PWA (FAIL) corrieron por el
MISMO pipeline exacto, mismo endpoint físico, mismo código — se
descarta que el foreground haya usado un mecanismo alternativo que
enmascarara el problema real.

Se auditó cada frontera del pipeline y se descartó como causa: la
selección de subscription (misma query siempre, sin condición de
visibilidad), el branching foreground/background (sólo existe uno,
exclusivo del tipo `chat`, fail-open, requiere una marca previa de
foreground que no puede existir con la PWA cerrada — no puede explicar
un fallo closed-PWA), el contrato de payload (el `catch` del Service
Worker SIEMPRE muestra una notificación, incluso en el peor caso de
JSON inválido — esto restringe las causas posibles a "el evento nunca
llegó al SW" o "el SO difirió/suprimió la entrega"), `event.waitUntil`
(usado correctamente, síncrono), las opciones de `showNotification`,
el dedupe por `tag`, y la detección de clientes residuales (el handler
`push` nunca llama `clients.matchAll`).

**Hallazgo real**: `sendPushNotification` (`src/lib/push.ts`) llamaba
`webpush.sendNotification(subscription, payload)` **sin tercer
argumento `options`** — nunca pedía `urgency` ni `TTL` explícitos.
Documentación oficial (`web-push-libs/web-push` README + issues del
propio repo + docs de FCM/Android sobre prioridad de mensajes,
consultadas vía WebSearch/WebFetch) confirma que sin `urgency`
explícito la librería usa el default `"normal"` (RFC 8030), y que un
push service puede diferir la entrega de mensajes `normal` mientras el
dispositivo está en Doze/ahorro de batería — patrón EXACTAMENTE
compatible con "llega con la app en foreground, no llega con la PWA
cerrada". No se marca `PROVEN` (no hay una captura directa — request/
response del proveedor, traza de que el SW se despertó — para ESTE
incidente específico), se clasifica `HIGH_CONFIDENCE_CODE_BUG`.

Fix mínimo aplicado LOCALMENTE (sin commit/push/deploy):

```ts
await webpush.sendNotification(subscription, JSON.stringify(payload), {
  TTL: 60 * 60 * 24,
  urgency: "high",
})
```

Opción estándar y documentada de la Push API — no un hack (no es
específica de FCM/Android, no es un timeout arbitrario, no un retry
loop, no una rama de user-agent, no un unregister/register del SW, no
un reset de permiso). Se aplica a todos los envíos, no sólo Android.

**Gap de observabilidad real, también cerrado localmente**: antes de
este fix, un envío EXITOSO no dejaba ningún rastro en logs — sólo las
fallas se logueaban. Esto significaba que, retroactivamente, no se
podía confirmar si un envío específico (p.ej. al endpoint `a55ebad6` de
Leonardo) fue intentado y aceptado por el proveedor. Se agregó un log
simétrico y seguro, reusando `fingerprintPushEndpoint` (ya existente en
`src/lib/push-debug-snapshot.ts`, mismo criterio de redacción que el
panel de diagnóstico existente — nunca el endpoint completo):
`[Push] Enviado OK (tipo=... actorFamily=... endpointFingerprint=...)`.

**Evidencia adicional real (lectura de logs de Railway TESTING, sin
modificar nada)**: se encontraron 3 llamadas reales
`PATCH /api/negocio/pedidos/.../estado → 200` el 2026-09-07 (01:18:23,
01:28:07, 01:45:18), la primera seguida inmediatamente de 3 líneas
reales `[Push] Subscription expired (statusCode=410)` — prueba de que
el pipeline ejecuta envíos reales y maneja respuestas reales del
proveedor (limpiando endpoints obsoletos de ciclos de diagnóstico
anteriores). Sin una marca de tiempo del lado del operador no se pudo
correlacionar con certeza cuál de las 3 llamadas corresponde a cuál
prueba física — limitación honesta, no una correlación inventada.

Tests: 235 focales (`push*.test.ts`, incluye 3 tests nuevos R15) en 0
fail. Suite completa del repo: 227 fail, 100% explicado por
`DATABASE_URL` ausente en este sandbox (tests de integración, sin
relación con push, verificado archivo por archivo). ESLint limpio.
TypeScript: 24 raw / 18 distintos, 0 nuevos.

**Hallazgo secundario de cobertura** (no corregido, fuera de alcance de
esta tarea): un comentario en `src/lib/sw-push-dedupe.test.ts` afirma
que `notificationclick`/`buildPersonalNotificationTarget` están
"cubiertos por los tests existentes del SW" — no existe ningún test así
en el repo. Registrado para no repetir la afirmación falsa.

Ver `P2_T31_R15_ANDROID_CLOSED_PWA_BACKGROUND_PUSH_ROOT_CAUSE_AUDIT.md`
para el detalle completo. Próxima tarea recomendada:
`P2-T31-R15A-COMMIT-DEPLOY-AND-CLOSED-PWA-RETEST`.

## Corrección — diagnóstico post-fallo closed-PWA entregado: subscription/backend/VAPID/permission siguen sanos (2026-09-07)

```text
ANDROID_CLOSED_PWA_FAILURE_DIAGNOSTIC_STATUS=CAPTURED_POST_FAILURE_SUBSCRIPTION_AND_BACKEND_HEALTHY
ANDROID_CLOSED_PWA_POST_FAILURE_PHYSICAL_SUBSCRIPTION=true
ANDROID_CLOSED_PWA_POST_FAILURE_BACKEND_SUBSCRIBED=true
ANDROID_CLOSED_PWA_POST_FAILURE_VAPID_MATCH=true
ANDROID_CLOSED_PWA_POST_FAILURE_PERMISSION=granted
ANDROID_CLOSED_PWA_POST_FAILURE_UI_SWITCH=true
ANDROID_CLOSED_PWA_POST_FAILURE_ENDPOINT=a55ebad6
ANDROID_CLOSED_PWA_POST_FAILURE_ENDPOINT_CONTINUITY=SAME_ENDPOINT_AS_CLEAN_CREATE_3_OF_3
ANDROID_CLOSED_PWA_FAILURE_ROOT_CAUSE_STATUS=UNRESOLVED_DELIVERY_PATH_REQUIRES_AUDIT
```

El marcador previo `ANDROID_CLOSED_PWA_FAILURE_DIAGNOSTIC_STATUS=
PENDING_OPERATOR_CAPTURE` queda OBSOLETO — Leonardo abrió DeliGO tras el
fallo y capturó el diagnóstico completo. Snapshot: `permission=granted`,
`physicalSubscription=true` (`endpointFingerprint=a55ebad6`,
`existingKeyPresent=true`), `vapidFetched=true`/`vapidMatch=true`,
`backendStatusHttp=200`/`backendSubscribed=true`, `hookSubscribed=true`,
`uiSwitch=true`, `error=none`. El endpoint `a55ebad6` es el MISMO
creado exitosamente en `ANDROID_POST_R13A_CREATE_3_OF_3` — no apareció
ninguna subscription nueva. Traza posterior confirma
`PHYSICAL_SUBSCRIPTION_READ physicalPresent=true` →
`BACKEND_STATUS_RESULT ok=true backendSubscribed=true httpStatus=200`
→ `ENDPOINT_RECHECK_RESULT physicalStillMatches=true` →
`STATUS_APPLY candidateValue=true reason=server_authoritative_result`
→ `HOOK_IS_SUBSCRIBED_CHANGED false→true` → `UI_SWITCH_CHANGED
false→true`.

**Lo que esto descarta** (como causa simple/de un solo factor —
`RULED_OUT`, no una prueba de todo el camino de entrega):

```text
ANDROID_CLOSED_PWA_SUBSCRIPTION_LOSS_AS_SIMPLE_CAUSE=RULED_OUT
ANDROID_CLOSED_PWA_BACKEND_DETACH_AS_SIMPLE_CAUSE=RULED_OUT
ANDROID_CLOSED_PWA_PERMISSION_REVOKED_AS_SIMPLE_CAUSE=RULED_OUT
```

La `PushSubscription` física seguía existiendo, el endpoint seguía
siendo el esperado, VAPID seguía coincidiendo, el backend seguía
registrando al actor como `subscribed`, `Notification.permission`
reportaba `granted`, y hook/UI seguían `ON`. **Lo que esto NO prueba**
(interpretación explícitamente prohibida en esta corrección): no se
sabe todavía (1) si el backend intentó enviar ESE push concreto, (2) si
el proveedor web-push aceptó el envío, (3) si el endpoint respondió
error o éxito, (4) si el Service Worker recibió el evento `push`, (5) si
`showNotification()` se ejecutó, ni (6) si Android presentó o suprimió
la notificación. **No se declara causa** — no Service Worker, no FCM,
no Chrome, no Android, no backend send, no notification display, no
supresión del SO, no capa de permiso, no VAPID, no fallo del proveedor.

```text
ANDROID_CLOSED_PWA_FAILURE_ROOT_CAUSE_STATUS=UNRESOLVED_DELIVERY_PATH_REQUIRES_AUDIT
```

Futura tarea (no iniciada, sólo registrada como próxima acción cuando
se retome): `P2-T31-ANDROID-CLOSED-PWA-BACKGROUND-DELIVERY-ROOT-CAUSE-AUDIT`
— debe investigar en orden, sin asumir dónde falla: server send →
resultado del proveedor web-push → código de resultado del endpoint →
evento `push` del Service Worker → `showNotification` → presentación
Android. Ver
`ANDROID_CLOSED_PWA_POST_FAILURE_DIAGNOSTIC_CONTEXT_CORRECTION.md` para
el detalle completo. La pausa operativa de Android (decisión del
operador para priorizar el diseño de pagos) permanece sin cambios — no
se pide ninguna prueba física nueva ni se ejecuta auditoría de causa
todavía.

## Post-R14: foreground push PASS, closed-PWA push FAIL — pruebas Android pausadas por el operador (2026-09-07)

```text
ANDROID_FOREGROUND_PUSH_STATUS=PASS
ANDROID_CLOSED_PWA_PUSH_STATUS=FAIL_REPRODUCED
ANDROID_NOTIFICATION_TAP_STATUS=NOT_TESTABLE_DUE_TO_CLOSED_PWA_DELIVERY_FAILURE
ANDROID_OFF_COLD_REOPEN_STATUS=PENDING
ANDROID_PHYSICAL_TESTING_PAUSED_BY_OPERATOR=SI
```

Tras el cierre del reliability gate de creación (R14), Leonardo probó
físicamente la entrega real: con DeliGO en foreground, la notificación
llegó correctamente (recibida, sin duplicar, contenido correcto,
notificaciones de Android habilitadas en Ajustes de la app — no se
confirma si vio el diálogo nativo de permiso en activaciones
anteriores, no se convierte ese "no recuerdo" en `PASS` del gate de
prompt nativo). Con la PWA completamente cerrada, una notificación real
generada **NO llegó**. El tap queda `NOT_TESTABLE` (no hubo
notificación que tocar). La persistencia OFF tras cold reopen sigue sin
ejecutarse. Leonardo decidió PAUSAR las pruebas físicas Android en este
punto para priorizar el diseño de pagos Mercado Pago
(`codex-reports/PAYMENTS_MERCADOPAGO_DESIGN.md`) — la pausa es
operativa, no implica certificación, cierre de P2-T31, abandono de
ningún finding, ni resolución del fallo. Ver
`PAYMENTS_CONTEXT_PERSISTENCE_AND_ANDROID_TEST_PAUSE_REPORT.md`.

### Nuevo — F-PAYMENTS-PAUSE-ANDROID-CLOSED-PWA-01 — ANDROID_CLOSED_PWA_PUSH_DELIVERY_FAILURE (bloqueante para certificación Android completa, causa NO auditada, investigación pausada)

```text
FINDING_ID=F-PAYMENTS-PAUSE-ANDROID-CLOSED-PWA-01
STATUS=OPEN_BLOCKING_FOR_ANDROID_FULL_CERTIFICATION_INVESTIGATION_PAUSED_BY_OPERATOR
SEVERITY=ALTA (push con PWA cerrada es un caso de uso central — el usuario no necesita tener la app abierta para recibir pedidos/actualizaciones)
```

Con la PWA completamente cerrada, un push real generado por el backend
NO llegó al dispositivo Android — a diferencia del caso foreground
(PASS, inmediatamente antes). **No se atribuye causa todavía** — no se
asume bug de Service Worker, de FCM, de Android, del backend, ni de
permiso, sin auditoría posterior. El diagnóstico post-fallo (traza del
panel TESTING) todavía NO fue entregado por Leonardo — pendiente,
`ANDROID_CLOSED_PWA_FAILURE_DIAGNOSTIC_STATUS=PENDING_OPERATOR_CAPTURE`,
no solicitado activamente mientras las pruebas están pausadas.

## Reliability gate Android cerrado 3/3 + anomalía de permiso auditada (2026-09-06/07, R14)

```text
ANDROID_POST_R13A_PHYSICAL_CREATE_RELIABILITY=PASS_3_OF_3_CONSECUTIVE
ABORTERROR_REPRODUCED_POST_R13A_3_OF_3=NO
ANDROID_PERMISSION_DEFAULT_WITH_ACTIVE_SUBSCRIPTION_STATUS=OBSERVED_UNEXPLAINED_MULTIPLE_PLAUSIBLE_CAUSES_NOT_ISOLATED
ANDROID_PUSH_STATUS=PARTIAL_CREATE_RELIABILITY_CERTIFIED_PENDING_DELIVERY_AND_PERSISTENCE_MATRIX
```

Las 3 creaciones físicas post-R13A ejercitaron el camino de creación
real (sin reuso) sin reproducir `AbortError` — reliability gate
cumplido (ver reclasificación de `F-P2-T31-R13-01` abajo). NO se afirma
que la causa del `AbortError` haya sido identificada o arreglada.

Se auditó una anomalía observada en el tercer capture:
`permission=default` junto con subscription/backend/hook/UI todos
activos. Auditoría de código probó que esto es lógicamente imposible
como resultado de una revocación por JS (el permiso tuvo que ser
`granted` en el instante de esa misma creación exitosa, y ninguna API
permite revertirlo). No se identificó como bug de DeliGO — evidencia de
plataforma (repos oficiales `GoogleChrome/android-browser-helper`,
`pwa-builder/PWABuilder`) documenta que Android mantiene dos capas de
permiso de notificación independientes (origen web vs. sistema
operativo) que pueden divergir. No bloquea las pruebas de entrega
pendientes — se resolverá empíricamente al ejecutarlas. Ver
`P2_T31_R14_ANDROID_CREATE_RELIABILITY_CLOSEOUT_AND_REMAINING_MATRIX.md`.

### Nuevo — F-P2-T31-R14-01 — ANDROID_REMAINING_DELIVERY_PERSISTENCE_MATRIX (bloqueante para certificación Android completa)

```text
FINDING_ID=F-P2-T31-R14-01
STATUS=OPEN_BLOCKING_FOR_ANDROID_FULL_CERTIFICATION
SEVERITY=MEDIA (creación física ya certificada; falta entrega/persistencia)
```

Pendiente: `OFF_COLD_REOPEN`, `FOREGROUND_PUSH`, `CLOSED_PWA_PUSH`,
`NOTIFICATION_TAP`, confirmación explícita de
`ANDROID_NATIVE_PERMISSION_PROMPT`. Orden mínimo propuesto (evitando
reinstalar innecesariamente): foreground → closed-PWA (+ tap
reutilizando la misma notificación) → OFF persistence. Ver el reporte
de R14 §12 para el protocolo exacto.

## Deploy R13A — hardening desplegado, wording de causa secundaria corregido (2026-09-06)

```text
COMMIT_HASH=8b49756e76a32b2641bd1099c1e8382d3be32f25
TESTING_DEPLOY_STATUS=SUCCESS
SECONDARY_FAILURE_REPORTING_EXCEPTION_PROVEN=SI
SECONDARY_FAILURE_EXACT_THROW_SITE=NOT_DIRECTLY_OBSERVED
INDEPENDENT_LOG_FAILURE_BOUNDARY=SI
INDEPENDENT_TOAST_FAILURE_BOUNDARY=SI
ANDROID_RELIABILITY_GATE_POST_FIX_START=0_OF_3
```

R13A desplegó en TESTING el fix de `F-P2-T31-R13-02` (ver abajo, ahora
verificado en TESTING) y endureció el helper: antes tenía un único
`try/catch` compartido para logging+toast; ahora cada uno tiene su
propio boundary independiente, garantizando que un fallo de logging
nunca impida el intento de mostrar el toast. Se corrigió también el
wording de R13 sobre la excepción secundaria: el HECHO de que ocurrió
sigue probado (por eliminación de todas las demás expresiones evaluadas
en esa ventana, todas funciones puras auditadas con certeza), pero la
llamada EXACTA (`console.error` vs `toast.error`) nunca se observó
directamente — ya no se afirma de forma que sugiera lo contrario.
Contrato de evaluación registrado para el próximo capture: si
`AbortError` reaparece, un `FAIL` de creación con el estado de fallo
consistente (`hookSubscribed=false`, `uiSwitch=false`, sin backend, sin
success feedback) es un resultado VÁLIDO — no se espera que el fix
"arregle" el `AbortError` en sí. 581/581 tests en verde, smokes/logs
sanos en TESTING. Reliability gate Android reiniciado en `0/3`. Ver
`P2_T31_R13A_PUSH_FAILURE_REPORTING_HARDENING_TESTING_DEPLOY.md`.

## Nuevo hallazgo — AbortError real reproducido + UI stale corregida localmente (2026-09-06, R13) — desplegado y endurecido por R13A arriba

```text
ANDROID_RELIABILITY_GATE_RESULT=FAIL_ON_CYCLE_2_OF_3
ANDROID_PUSHMANAGER_SUBSCRIBE_RESULT=REJECTED
ANDROID_PUSHMANAGER_SUBSCRIBE_ERROR_CLASS=AbortError
STALE_UI_IS_DELIGO_BUG=SI
FIX_IMPLEMENTED=SI
ANDROID_PUSH_STATUS=FAIL_REPRODUCED_ABORTERROR_DURING_PHYSICAL_CREATE_PENDING_ROOT_CAUSE
P2_T31_R13_STATUS=ABORTERROR_ROOT_CAUSE_UNRESOLVED_UI_FAILURE_STATE_FIXED_LOCALLY
```

El reliability gate de 3 ciclos (definido en R12B) falló en el ciclo
2/3: `PushManager.subscribe()` esta vez SÍ se asentó, pero por RECHAZO
(`AbortError`, ~287ms) — reemplaza, para este intento, la hipótesis de
"Promise pendiente" de los fallos anteriores. Auditoría profunda (código
+ W3C Push API spec) clasificó `AbortError` con precisión:
`SOURCE_CODE_FACT` = ninguna rama Android-específica en el código;
`PLATFORM_DOCUMENTATION` = el spec define `AbortError` como el rechazo
GENÉRICO del propio push service (no ligado a permiso/SW/VAPID, que
tienen sus propios códigos de error), y la comunidad Chromium documenta
que en Chrome esto suele originarse en un fallo del registro interno
con FCM; `INFERENCE` (explícitamente no probada) = plausible que un
fallo transitorio de esa comunicación interna navegador↔FCM explique
este rechazo puntual — nunca observable desde código de aplicación.

**Hallazgo independiente, real y corregido**: la traza probó que
`SUBSCRIBE_FINISH` — documentado como incondicional desde R12 — nunca se
registró, Y que el snapshot mostró `hookSubscribed=false` pero
`uiSwitch=true` (divergencia real). Auditoría de código probó que
`console.error`/`toast.error`, sin protección propia, podían lanzar y
saltarse `finishMutation` por completo — rompiendo tanto la traza como
el patrón `await push.subscribe(); if (result.current)
setNotifications(result.subscribed)` usado en `client-profile-panel.tsx`
(Cliente) y `config-tab.tsx` (Negocio) — el switch optimista quedaba
`ON` para siempre. Repartidor no está expuesto (renderiza
`push.isSubscribed` directamente). **Corregido localmente** con
`reportMutationFailureSafely` (ver `DECISIONS_AND_INVARIANTS.md`) — cero
cambio de comportamiento en el camino feliz, R7/R8 preservados, sin
retry/delay/hack Android. Ver
`P2_T31_R13_ANDROID_PUSHMANAGER_ABORTERROR_AND_STALE_UI_ROOT_CAUSE.md`.

### F-P2-T31-R13-01 — ANDROID_PUSHMANAGER_ABORTERROR_INTERMITTENT (reclasificado por R14: reliability gate cumplido, ya no bloquea el avance)

```text
FINDING_ID=F-P2-T31-R13-01
STATUS=OPEN_NON_BLOCKING_MONITORING (era OPEN_BLOCKING_FOR_ANDROID_CERTIFICATION)
SEVERITY=BAJA (para el avance de la matriz — la causa de plataforma sigue sin confirmarse, pero el reliability gate diseñado para resolver el bloqueo se cumplió: 3/3 consecutivos post-fix sin reproducir el fallo)
ABORTERROR_UNDERLYING_CAUSE_STATUS=NOT_PROVEN_PLAUSIBLE_PLATFORM_LEVEL_PUSH_SERVICE_REGISTRATION_FAILURE
ANDROID_POST_R13A_PHYSICAL_CREATE_RELIABILITY=PASS_3_OF_3_CONSECUTIVE
```

R14 (2026-09-06/07) cerró el reliability gate: 3 creaciones físicas
consecutivas post-R13A, sin reproducir `AbortError`. Esto NO significa
que la causa quedó identificada o "arreglada" — sólo que el camino de
código mostró estabilidad suficiente bajo el criterio ya definido.
Reabrir a `BLOCKING` si el `AbortError` reaparece en cualquier prueba
física futura.

Requiere desplegar el fix de §UI + reiniciar el reliability gate de 3
ciclos consecutivos desde cero (no se reutiliza el 1/3 previo, el código
cambió). Si el `AbortError` sigue apareciendo intermitentemente incluso
con la UI corregida, la certificación Android puede requerir una
política de tolerancia a fallos intermitentes de plataforma en vez de
0-tolerancia — a decidir con más evidencia, no ahora.

### F-P2-T31-R13-02 — STALE_UI_AFTER_MUTATION_REJECTION (CERRADO, corregido y desplegado)

```text
FINDING_ID=F-P2-T31-R13-02
STATUS=CLOSED_FIXED_AND_DEPLOYED_TESTING
SEVERITY=MEDIA (afectaba Cliente y Negocio; requería un rechazo inesperado de subscribe()/unsubscribe() para manifestarse — infrecuente pero real)
```

Corregido vía `reportMutationFailureSafely` en `use-push-notifications.ts`
(endurecido en R13A con boundaries independientes de logging/toast) —
desplegado en TESTING (`8b49756...`), smokes/logs verificados sanos. No
requiere certificación física nueva (este bug no depende de Android
específicamente, aunque fue descubierto ahí) — queda cerrado.

## Reconciliación R12B — 1 FAIL + 1 PASS sobre el mismo build, sin fix funcional (2026-09-06)

```text
ORIGINAL_ANDROID_PHYSICAL_RESULT=FAIL
ANDROID_R12_RETEST_VISUAL_RESULT=ON
FUNCTIONAL_FIX_BETWEEN_FAIL_AND_PASS=NO
ROOT_CAUSE_STATUS=UNRESOLVED_INTERMITTENT_PHYSICAL_SUBSCRIBE_STALL_NOT_REPRODUCED_ON_R12_RETEST
INTERMITTENCY_CONFIRMED=SI
UNDERLYING_CAUSE_CONFIRMED=NO
ANDROID_PUSH_STATUS=UNRESOLVED_INTERMITTENT_PHYSICAL_SUBSCRIBE_STALL_NOT_REPRODUCED_ON_R12_RETEST
```

Leonardo repitió el retest sobre el build ya desplegado (`085cc0b`, sólo
instrumentación, cero cambio de comportamiento) y esta vez el flujo
completó limpio: `SUBSCRIBE_PHYSICAL_CREATE_START`→`RESULT` en ~1910ms,
`SUBSCRIBE_BACKEND_RESULT` 200, switch final ON. La traza nueva también
probó con evidencia directa (no sólo auditoría de código) que el unmount
NUNCA cancela la mutación en curso — el backend ACK llegó igual con el
hook viejo ya desmontado, y `MUTATION_REGISTRY_RELEASE`+remount
`WAIT_NOT_FOUND` es exactamente el comportamiento esperado cuando la
mutación ya terminó ~1169ms antes del remount (no un fallo de R2). La
conexión con `AUTH_HYDRATION_PUSH_RACE` sigue descartada para este
incidente (R12A), y el hallazgo global permanece `OPEN` para otros
escenarios. **No hubo fix funcional entre el FAIL y el PASS** — por
tanto no se afirma `BUG_FIXED`/`ROOT_CAUSE_FIXED`/`FIX_VERIFIED`, y
Android NO se certifica sólo porque este intento terminó ON. Se
confirmó por auditoría de código que `OFF→ON` NO es una repetición
válida del camino de creación física (`unsubscribe()` nunca destruye la
`PushSubscription` física — `SERVER_DETACH_ONLY`), así que se diseñó un
gate de repetibilidad específico (3 ciclos consecutivos de creación
física genuina, con reset real de la subscription entre intentos) antes
de poder certificar Android. Ver
`P2_T31_R12B_ANDROID_FAIL_PASS_RECONCILIATION_AND_RELIABILITY_GATE.md`.

### F-P2-T31-R12-01 — reclasificado: de "causa por determinar" a "gate de confiabilidad pendiente"

```text
FINDING_ID=F-P2-T31-R12-01
STATUS=OPEN_BLOCKING_FOR_ANDROID_CERTIFICATION (sin cambio de severidad)
SEVERITY=ALTA (Android — no afecta iPhone Cliente ya certificado)
ROOT_CAUSE_STATUS=UNRESOLVED_INTERMITTENT_PHYSICAL_SUBSCRIBE_STALL_NOT_REPRODUCED_ON_R12_RETEST
ANDROID_FIRST_SUBSCRIBE_RELIABILITY_STATUS=NOT_YET_TESTED_REPEATEDLY
```

Antes: pendiente de que el próximo capture mostrara si `subscribe()`
lanzaba un error o quedaba genuinamente colgado. Ahora: el capture
mostró un PASS limpio, lo que confirma que el camino de código FUNCIONA
al menos intermitentemente — el hallazgo se reclasifica de "causa por
determinar" a "confiabilidad del camino de creación física aún no
demostrada con repetición" (`ANDROID_RELIABILITY_REPEAT_COUNT_AUTHORITY=NINGUNA_ENCONTRADA`,
propuesto 3 ciclos consecutivos — ver reporte para el protocolo exacto).

## Corrección factual R12A — actorFamily/authHasHydrated SÍ estaban en SUBSCRIBE_START (2026-09-06) — reconciliado por R12B arriba

```text
ORIGINAL_TRACE_SUBSCRIBE_START_ACTOR_FAMILY=cliente
ORIGINAL_TRACE_SUBSCRIBE_START_AUTH_HAS_HYDRATED=true
CAN_ACTOR_FAMILY_CLIENTE_COEXIST_WITH_NULL_ACTOR_KEY=NO
```

R12 afirmó incorrectamente que la traza física no incluía el campo
`actorFamily` de `SUBSCRIBE_START`. La traza original de Leonardo SÍ lo
incluye: `actorFamily=cliente`, `authHasHydrated=true`. Auditoría de
`src/store/auth-store.ts` confirma que `AuthUser.id`/`.type` se asignan
atómicamente en el mismo objeto literal en las 4 acciones de login —
estructuralmente imposible que `actorFamily=cliente` coexista con
`actorId=null`. Por tanto, la hipótesis de la entrada de abajo
("conexión plausible con `AUTH_HYDRATION_PUSH_RACE`" como explicación de
por qué el registro cross-remount no protegió este incidente) **queda
descartada para ESTA captura específica** — la hidratación ya había
completado mucho antes del click. `AUTH_HYDRATION_PUSH_RACE`
(`F-P2-T31-AUTH-HYDRATION-RACE-01`) NO se reclasifica en sí — sigue
abierto como hallazgo estructural para otros escenarios — sólo se retira
como explicación de este incidente Android. La causa de por qué el
registro no protegió este caso queda genuinamente sin resolver
(`R2_REGISTRY_CAUSE_CURRENTLY=UNRESOLVED_PENDING_NEW_TRACE`), pendiente
del próximo capture con la instrumentación ya agregada. Ver
`P2_T31_R12_ANDROID_FIRST_SUBSCRIBE_PHYSICAL_CREATION_FAILURE_DIAGNOSTIC.md`
§6-8 para el detalle completo.

## Nuevo hallazgo físico — fallo real de first-subscribe en Android (2026-09-06, R12) — CORREGIDO POR R12A ARRIBA

```text
COMMIT_HASH=70d3f826bef291f403f0e42e007187eb1b5d6688 (sin cambios)
ANDROID_PUSH_STATUS=FAIL_PHYSICAL_FIRST_SUBSCRIBE_CAPTURED_PENDING_ROOT_CAUSE
P2_T31_STATUS=IN_PROGRESS_PENDING_IPHONE_BUSINESS_DELIVERY_PHYSICAL_MATRIX_AND_ANDROID_FIRST_SUBSCRIBE_ROOT_CAUSE
IPHONE_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (preservado, sin cambios)
```

Reproducción física de Leonardo en Android: activar notificaciones en
Cliente/Perfil → cambiar de pantalla → volver → switch OFF. Auditoría
de código probó que el único `await` ejecutado en la ventana sin
eventos (`registration.pushManager.subscribe(...)`, en
`use-push-notifications.ts`) nunca se asentó (ni éxito ni excepción)
durante toda la ventana observada — ninguna trace incondicional
(`SUBSCRIBE_NEW_PHYSICAL_RESULT`/`SUBSCRIBE_FINISH`) apareció pese a que
el mismo proceso JS siguió vivo (`processInstanceId` idéntico antes y
después del remount). Backend, rate-limit R8 y el fix de flicker R7
quedaron descartados como causa (el fallo es 100% anterior al backend).
Causa raíz NO probada concluyentemente — hipótesis líder: Android
suspendió/abandonó ese `await` nativo al perder foreground. Por qué el
registro cross-remount de R2 no protegió este caso queda por separado
SIN RESOLVER (ver corrección R12A arriba — la conexión originalmente
propuesta con `AUTH_HYDRATION_PUSH_RACE` quedó descartada para este
incidente específico). Sin fix de comportamiento — sólo se
agregó instrumentación diagnóstica local (sin desplegar) para que el
próximo capture físico pueda confirmar o refutar la causa exacta. Ver
`P2_T31_R12_ANDROID_FIRST_SUBSCRIBE_PHYSICAL_CREATION_FAILURE_DIAGNOSTIC.md`.

### Nuevo — F-P2-T31-R12-01 — ANDROID_FIRST_SUBSCRIBE_PHYSICAL_CREATION_UNRESOLVED (bloqueante para certificación Android)

```text
FINDING_ID=F-P2-T31-R12-01
STATUS=OPEN_BLOCKING_FOR_ANDROID_CERTIFICATION
SEVERITY=ALTA (Android — impide confirmar que el flujo de activación funciona; no afecta iPhone Cliente ya certificado)
ROOT_CAUSE_STATUS=NOT_CONCLUSIVELY_PROVEN_LEADING_HYPOTHESIS_IDENTIFIED
```

Requiere: desplegar la instrumentación agregada en R12 a TESTING y
repetir el mismo escenario físico en Android una única vez (armando
traza, borrando historial antes) para que la traza resultante confirme
o refute directamente la hipótesis (¿aparece `SUBSCRIBE_PHYSICAL_CREATE_ERROR`?
¿sigue sin aparecer nada, confirmando que el `await` realmente cuelga?
¿`MUTATION_REGISTRY_SET`/`WAIT_FOUND` confirman si hubo o no una entrada
real de registro?).

## Corrección de autoridad — P2-T31 REABIERTO: Negocio/Repartidor eran gates obligatorios (2026-09-06, R11)

```text
COMMIT_HASH=70d3f826bef291f403f0e42e007187eb1b5d6688 (sin cambios)
P2_T31_STATUS=IN_PROGRESS_PENDING_IPHONE_BUSINESS_DELIVERY_PHYSICAL_MATRIX
IPHONE_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (preservado, sin cambios)
BUSINESS_PHYSICAL_MATRIX_STATUS=NOT_EXECUTED_FORMALLY
DELIVERY_PHYSICAL_MATRIX_STATUS=NOT_EXECUTED
BUSINESS_PUSH_INCIDENTAL_EVIDENCE=PASS_OBSERVED (no estructurado, no sustituye el gate formal)
```

R11 auditó la autoridad original (`P2_T31_TESTING_DEPLOY_PENDING_IPHONE_MATRIX_CERTIFICATION.md`,
"Para cada rol **debe** cubrirse... Cliente C1–C8, Negocio N1–N7 y
Repartidor R1–R7... ningún pass por rol **ni cierre de P2-T31** sin
evidencia física") y determinó que el cierre `CLOSED_TESTING_CERTIFIED`
de R10 fue **prematuro**: Negocio y Repartidor eran gates físicos
obligatorios, no opcionales, y ninguno fue ejecutado formalmente.
Compartir hook/endpoints/tests de contrato demuestra cobertura de
código, no evidencia física por rol — R10 usó su propio alcance nombrado
(`IPHONE_CLIENT_PUSH_MATRIX`) como si autorizara cerrar el alcance
completo, lo cual esta tarea corrige explícitamente sin degradar la
certificación de Cliente (C1-C8 permanece PASS, intacta) ni sin borrar
la historia del cierre anterior. Detalle completo en
`P2_T31_R11_MULTIROLE_PHYSICAL_SCOPE_AUTHORITY_CORRECTION.md`, que
incluye la matriz N1-N7/R1-R7 propuesta y las instrucciones exactas para
que Leonardo la ejecute cuando decida hacerlo.

### F-P2-T31-R10-01 — reclasificado como BLOQUEANTE para el cierre completo de P2-T31

```text
FINDING_ID=F-P2-T31-R10-01
STATUS=OPEN_BLOCKING_MISSING_REQUIRED_PHYSICAL_MATRIX
SEVERITY=MEDIA (bloquea sólo el cierre GLOBAL de P2-T31; no afecta la certificación ya válida de Cliente)
NEGOCIO_REPARTIDOR_PHYSICAL_MATRIX_STATUS=NOT_EXECUTED
F_P2_T31_R10_01_FINAL_CLASSIFICATION=RECLASSIFIED_BLOCKING_FOR_P2_T31_FULL_CLOSURE
```

Estado anterior (R10): `OPEN_NON_BLOCKING_SCOPE_NOTE`. La matriz física
ORIGINAL de T31 definía Negocio N1-N7 y Repartidor R1-R7 como gates
`debe cubrirse` — lenguaje imperativo, sin cláusula de excepción ni
equivalencia por código compartido en ninguna autoridad. Toda la
evidencia física de R6 a R10 fue exclusivamente de Cliente. Como
contexto adicional (no como cierre del gate): Leonardo probó Negocio de
forma incidental tras R7/R8 y observó que las notificaciones —
previamente rotas — ahora funcionan (`BUSINESS_PUSH_INCIDENTAL_PHYSICAL_RESULT=NOTIFICATIONS_WORKING`),
pero sin la estructura de diagnóstico (traza armada, snapshot,
RECEIVED/DUPLICATE/CONTENT_CORRECT) que los demás casos físicos de T31
sí tienen, por lo que no cierra ningún `N#` individual. Queda como gate
real pendiente — ver instrucciones exactas en
`P2_T31_R11_MULTIROLE_PHYSICAL_SCOPE_AUTHORITY_CORRECTION.md` §11.

## Actualización de estado — reconciliación física R9, C1 identificado como gate abierto (2026-09-06)

```text
COMMIT_HASH=70d3f826bef291f403f0e42e007187eb1b5d6688 (sin cambios)
IPHONE_PUSH_CERTIFICATION_STATUS=PARTIAL_PENDING_C1_CLEAN_FIRST_ENABLE
P2_T31_STATUS=IN_PROGRESS_PENDING_C1_CLEAN_FIRST_ENABLE
```

Auditoría de evidencia (sin tests, sin código) reconcilió toda la
evidencia física reportada por Leonardo tras R7 y R8: **C2, C3, C4, C5,
C6, C7 y C8 quedan PASS** con evidencia trazable a reportes concretos.
**C1 (primera activación real desde estado limpio) sigue sin evidencia
física válida** — el iPhone de Leonardo ya tenía `permission=granted` y
una `PushSubscription` histórica desde etapas tempranas de T31, así que
todo el ciclo OFF→ON certificado es un re-enable, no un first-enable. La
matriz original (`P2_T31_TESTING_DEPLOY_PENDING_IPHONE_MATRIX_CERTIFICATION.md`)
había diferido explícitamente este caso desde el día 1
(`PERMISSION_PROMPT_PHYSICAL_CASE=DEFERRED_NOT_SAFELY_REPRODUCIBLE`) y
ningún reporte posterior lo resolvió ni registró una equivalencia
autorizada. No se inventó ningún cierre. Detalle completo en
`P2_T31_R9_IPHONE_PHYSICAL_CERTIFICATION_RECONCILIATION.md`.

### Residual — F-P2-T31-R9-01 — C1_CLEAN_FIRST_ENABLE_NO_PHYSICAL_EVIDENCE (bloqueante para cierre iPhone)

```text
FINDING_ID=F-P2-T31-R9-01
STATUS=OPEN_BLOCKING_FOR_IPHONE_FULL_CERTIFICATION
SEVERITY=MEDIA (no afecta a usuarios ya suscriptos; sólo bloquea la
  certificación formal del caso "primera activación" en el build actual)
C1_CURRENT_BUILD_PHYSICAL_STATUS=NOT_RECERTIFIED_CLEAN_STATE
```

Requiere que Leonardo elimine y reinstale la instancia de la PWA en su
Home Screen (método documentado en
`codex-reports/DECISIONS_AND_INVARIANTS.md` bajo
`IOS_PUSH_CLEAN_STATE_RESET_METHOD`) y active notificaciones por primera
vez contra el build actual, observando si aparece el diálogo nativo de
permiso de iOS. No se pidió ejecutar esto todavía — es la próxima acción
recomendada, pendiente de que Leonardo decida hacerlo.

## Actualización de estado — deploy TESTING del fix R8 (2026-09-06)

```text
COMMIT_HASH=70d3f826bef291f403f0e42e007187eb1b5d6688
TESTING_DEPLOY_STATUS=SUCCESS
```

Los 4 hallazgos de R8 de abajo (F-P2-T31-R8-01 a 04) quedan ahora
DESPLEGADOS en TESTING, verificados por HTTP/guard/logs sin errores.
Pendiente exclusivamente el retest físico de Leonardo (8 ciclos ON/OFF
humanos rápidos, el mismo stress que originalmente produjo el 429) para
cerrar la certificación física. No se declaró ningún PASS físico
todavía — sólo el deploy técnico.

### Residual — F-P2-T31-R8-05 — RATE_LIMITER_IN_MEMORY_PROCESS_LOCAL (no bloqueante)

```text
FINDING_ID=F-P2-T31-R8-05
STATUS=OPEN_NON_BLOCKING_RESIDUAL
SEVERITY=BAJA (con 1 réplica, coherente; sólo relevante si escala)
PUSH_LIMITER_DISTRIBUTION_MODEL=IN_MEMORY_PROCESS_LOCAL
```

`src/lib/rate-limit.ts` usa un `Map` en memoria por proceso — con la
configuración actual (`numReplicas=1` en TESTING, confirmado vía Railway)
el comportamiento es completamente coherente. Si algún día TESTING o
Production corrieran con más de una réplica, el presupuesto de rate
limit dejaría de ser global (cada proceso tendría su propio contador,
efectivamente multiplicando el límite real por el número de réplicas).
NO se implementa Redis/limiter distribuido ahora — queda registrado como
residual de seguridad/escalado para una futura revisión (candidato
natural para T27 o cuando se evalúe escalar horizontalmente).

## Hallazgos P2-T31-R8 — CONFIRMADOS por evidencia física: 429 real en stress de navegación (2026-09-06)

### F-P2-T31-R8-01 — PUSH_API_RATE_LIMIT_CAN_BE_HIT_BY_INTERACTIVE_TOGGLE_REMOUNT_STRESS — CERRADO (fix local)

```text
FINDING_ID=F-P2-T31-R8-01
STATUS=CLOSED_LOCAL_FIX_PENDING_DEPLOY_AND_PHYSICAL_RETEST
SEVERITY=ALTA
NORMAL_HUMAN_STRESS_CAN_HIT_LIMIT=SI (modelo viejo) / NO (modelo nuevo, verificado por test)
STATUS_READS_CAN_STARVE_MUTATIONS=SI (modelo viejo) / estructuralmente imposible (modelo nuevo)
```

Los 3 endpoints Push (`status`/`subscribe`/`unsubscribe`) compartían un
único bucket de 10 req/min, misma clave `ip:userId` — y superficies
independientes (`permission-prompt.tsx`, el panel de diagnóstico
R6/R6A/R6B) consumían del MISMO presupuesto sin coordinarse. Un stress de
navegación + toggles humano normal, SIN automatización, agotaba el
límite con facilidad — confirmado directamente por la traza física de
Leonardo. Cerrado dividiendo en `pushStatus` (60/min) + `pushMutation`
(20/min, subido de 10), independientes — verificado que stress humano
razonable (10 remounts + 10 ciclos ON/OFF) nunca produce 429, mientras un
flood de 40+/100+ requests sigue bloqueado (`ABUSE_RESISTANCE_PRESERVED=SI`).

### F-P2-T31-R8-02 — FAILED_UNSUBSCRIBE_429_LEAVES_BACKEND_BINDING_ACTIVE — NO ES UN BUG

```text
FINDING_ID=F-P2-T31-R8-02
STATUS=CONFIRMED_EXPECTED_BEHAVIOR_NOT_A_DEFECT
```

Un `unsubscribe()` rechazado con 429 nunca llega a ejecutar la
transacción de detach — el binding server-side correctamente permanece
`true`. El switch mostrando ON tras reabrir es la consecuencia CORRECTA
de un intento que jamás se completó, no un estado inconsistente. No
requiere ni admite un "physical unsubscribe" como workaround —
`SERVER_DETACH_ONLY` (P2-T05) permanece intacto.

### F-P2-T31-R8-03 — STATUS_NON_OK_CURRENTLY_RENDERED_AS_AUTHORITATIVE_OFF — CERRADO (fix local)

```text
FINDING_ID=F-P2-T31-R8-03
STATUS=CLOSED_LOCAL_FIX_PENDING_DEPLOY_AND_PHYSICAL_RETEST
STATUS_ERROR_SECURITY_MODEL=FAIL_CLOSED_WITHOUT_FALSE_OFF_REPRESENTATION
WOULD_NEW_FACT_HAVE_CHANGED_R7_PROMPT=SI
```

R7 dejó deliberadamente que un backend no-ok resolviera en `false`
autoritativo (herencia de P2-T05, "cualquier fallo cierra en false"). La
evidencia física de R8 (backend respondiendo `true` genuino segundos
después del 429, sin acción del usuario) demuestra que esto es
incorrecto específicamente para errores como 429 — no son evidencia de
"no suscrito", sólo de "no pudimos preguntar". R7 no estaba mal con la
evidencia que tenía entonces; este hecho nuevo exige refinar el contrato,
no revertirlo. Cerrado: `getCurrentSubscription` lanzando excepción,
`fetchStatus` lanzando excepción, y backend no-ok (incluido 429) ya NUNCA
llaman `applyIsSubscribed` — llaman al nuevo `applyStatusUnresolved`, que
dejar `statusResolved` intacto. Sólo `no_physical_subscription` (hecho
confirmado) y una respuesta 2xx real siguen siendo autoritativos.

### F-P2-T31-R8-04 — PUSH_MUTATION_FAILURE_FEEDBACK_RELIABILITY — CERRADO (fix local)

```text
FINDING_ID=F-P2-T31-R8-04
STATUS=CLOSED_LOCAL_FIX_PENDING_DEPLOY_AND_PHYSICAL_RETEST
SUCCESS_FEEDBACK_ONLY_ON_ACK=SI
FAILURE_FEEDBACK_PRESENT=SI
```

Auditado: el feedback de fallo YA existía estructuralmente
(`toast.error(...)` en el catch de ambas mutaciones) — el síntoma de
"mensajes que dejaron de aparecer" se explica por dos factores, ninguno
nuevo: (1) el modelo `LATEST_RELEVANT_OPERATION_WINS` (P2-T05/R2)
descarta silenciosamente el resultado de cualquier operación superada por
una más nueva — deliberado, no un bug, esperable en un toggle rápido; (2)
el mensaje que SÍ llegaba a mostrarse para el intento final era genérico
("Error al desactivar notificaciones"), indistinguible de cualquier otro
fallo. Cerrado: nuevo `PushMutationHttpError` (con `httpStatus`) +
`pushMutationFailureMessage` — un 429 ahora muestra específicamente
"Demasiados intentos. Esperá unos segundos e intentá nuevamente.", sin
exponer detalles internos.

## Hallazgo P2-T31-R7 — CONFIRMADO por evidencia física: flicker C4 (2026-09-06)

### F-P2-T31-INITIAL-STATE-FLICKER-01 — CERRADO (desplegado en TESTING, pendiente retest físico)

```text
FINDING_ID=F-P2-T31-INITIAL-STATE-FLICKER-01
STATUS=CLOSED_DEPLOYED_TESTING_PENDING_PHYSICAL_RETEST
COMMIT_HASH=6380ba2b77ffe6bee1b978ef1e2480da233e61c2
TESTING_DEPLOY_STATUS=SUCCESS
SEVERITY=ALTA (visible directamente al usuario en cada cold launch)
C4_FLICKER_ROOT_CAUSE=UNRESOLVED_INITIAL_PUSH_STATE_RENDERED_AS_FALSE_OFF
C4_FLICKER_AUTH_HYDRATION_CAUSALITY=RULED_OUT_FOR_CAPTURED_FLICKER
```

Leonardo capturó, usando el panel de R6B, 3 cold launches reales en
iPhone (Cliente) con el mismo patrón: notificaciones ON → cerrar completo
→ reabrir → Perfil muestra brevemente OFF → cambia solo a ON
(~325-430ms). `isSubscribed` arrancaba `false` y ese mismo valor servía
tanto para "confirmado no suscrito" como para "todavía sin verificar" —
las 3 UI renderizaban esa ambigüedad como un OFF real. La auth-hydration
race de R6 (`F-P2-T31-AUTH-HYDRATION-RACE-01`, sigue `OPEN` como hallazgo
estructural general) quedó explícitamente DESCARTADA como causa de ESTE
flicker — evidencia: `AUTH_HYDRATED` ocurrió 732ms antes de
`PUSH_HOOK_MOUNT` en la captura `tn5kvs`. Fix: `statusResolved` en el
hook, consumido por las 3 UI para mostrar un loader neutral en vez de un
Switch "Desactivado" mientras no hay conclusión autoritativa. Ningún
algoritmo de subscribe/unsubscribe/VAPID/backend/server-detach fue
tocado. Ver `P2_T31_R7_PUSH_INITIAL_UNKNOWN_STATE_FLICKER_FIX.md`.

### F-P2-T31-RAW-ACTOR-ID-EXPOSED-01 — CERRADO

```text
FINDING_ID=F-P2-T31-RAW-ACTOR-ID-EXPOSED-01
STATUS=CLOSED_FIXED
RAW_ACTOR_ID_EXPOSED_AFTER=NO
```

La traza física copiada por Leonardo mostró `actorFamily=cliente:<raw
internal id>` — `push-debug-panel.tsx` pasaba el `actorKey` interno
(`${family}:${id}`, legítimo para el lookup del registro de mutaciones)
directo al campo de display del snapshot. Corregido: el snapshot ahora
recibe sólo el rol (`actorFamily`) + un `actorFingerprint` opcional (hash
FNV-1a de 8 hex, no reversible, vía el nuevo `fingerprintActorId` en
`push-debug-snapshot.ts`) para distinguir actores sin exponer el id real.

### F-P2-T31-ENDPOINT-BOOLEAN-FALSE-POSITIVE-01 — CERRADO

```text
FINDING_ID=F-P2-T31-ENDPOINT-BOOLEAN-FALSE-POSITIVE-01
STATUS=CLOSED_FIXED
ENDPOINT_MATCH_BOOLEAN_OBSERVABLE=SI
RAW_ENDPOINT_EXPOSED=NO
```

El sanitizador de `push-debug-trace.ts` redacta por NOMBRE cualquier
campo que contenga "endpoint" — `endpointStillMatches` (un booleano sin
dato de endpoint real) caía ahí por coincidencia de nombre. Renombrado a
`physicalStillMatches` en `push-personal-status-check.ts`; la regla de
sanitización en sí NO se debilitó (sigue redactando cualquier otro campo
con "endpoint" en el nombre, verificado por test).

## Actualización de estado — deploy TESTING de diagnóstico R6+R6A+R6B (2026-09-05)

```text
COMMIT_HASH=925a86017a5e7546f0a6f82245c9d5fc1d344776
TESTING_DEPLOY_STATUS=SUCCESS
```

Los dos hallazgos de R6B de abajo (F-P2-T31-COLD-BOOTSTRAP-GAP-01 y
F-P2-T31-QUERY-PARAM-STANDALONE-BLOCKER-01) quedan ahora VERIFICABLES
FÍSICAMENTE en TESTING — la instrumentación que los cierra está
desplegada, confirmada por HTTP/guard smoke y logs sin errores. Los
hallazgos raíz de R6 (`F-P2-T31-MODULE-REGISTRY-FULL-REOPEN-01`,
`F-P2-T31-AUTH-HYDRATION-RACE-01`) permanecen `OPEN` — esta tarea no los
corrigió, sólo desplegó la herramienta para recolectar evidencia real
sobre ellos. No se declaró ningún caso `PASS` — pendiente de que Leonardo
capture 1 FAIL TRACE + 1 HEALTHY TRACE del mismo escenario.

## Hallazgo P2-T31-R6B — el tracer no capturaba el cold launch real (2026-09-05)

### F-P2-T31-COLD-BOOTSTRAP-GAP-01 — CERRADO, bootstrap agregado

```text
FINDING_ID=F-P2-T31-COLD-BOOTSTRAP-GAP-01
STATUS=CLOSED_BOOTSTRAP_ADDED
SEVERITY=ALTA (afectaba directamente la validez de cualquier captura física de R6A)
TRACE_MODULE_FIRST_LOAD_POINT_BEFORE=DYNAMICALLY_IMPORTED_PROFILE_CONFIG_CHUNK_ONLY
COLD_BOOTSTRAP_CURRENTLY_SUFFICIENT=NO
```

Auditado: `push-debug-trace.ts` (R6A) sólo se evaluaba dentro del chunk
`dynamic()`-importado de `ClientProfilePanel`/`PushNotificationsConfig`/
`ProfileTab` — nunca en la carga inicial de la PWA. Los 3 manifests abren a
`/cliente`, `/negocio`, `/repartidor` (nunca directo a Perfil), así que
entre el cold launch real y el tap a Perfil, el tracer literalmente no
existía en memoria — cualquier `pageshow`/`visibilitychange`/estado de auth
en ese instante quedaba sin observar. Esto habría invalidado exactamente el
tipo de evidencia que R6A fue diseñado para capturar (la ventana causal de
la `AUTH_HYDRATION_PUSH_RACE`). Cerrado agregando `PushDebugTraceBootstrap`
(puramente observacional, siempre `null`) en los 3 `layout.tsx` de rol —
el único punto compartido no-perezoso de cada rol.

### F-P2-T31-QUERY-PARAM-STANDALONE-BLOCKER-01 — CERRADO, entrada TESTING agregada

```text
FINDING_ID=F-P2-T31-QUERY-PARAM-STANDALONE-BLOCKER-01
STATUS=CLOSED_STANDALONE_ENTRY_ADDED
SEVERITY=ALTA (bloqueaba la certificación física por completo)
QUERY_PARAM_REQUIRED_FOR_PHYSICAL_USE=NO
STANDALONE_DEBUG_ENTRY_PRODUCTION_EXPOSURE=NO
```

R6/R6A dependían de `?pushDebug=1` para mostrar el panel — inviable en una
PWA Home-Screen sin barra de direcciones. Cerrado reestructurando
`push-debug-panel.tsx`: el guard server-side (`/api/push/debug-guard`, la
MISMA autoridad única, sin duplicar lógica de entorno) se verifica en cada
montaje, independiente del query param; confirmado TESTING, aparece una
entrada "Diagnóstico Push (TESTING)" — tocarla abre el panel sin editar
ninguna URL. Verificado por test que Production sigue sin mostrar nada
(guard 404 → `allowed` nunca `true` → `return null`) incluso con el query
param presente.

## Hallazgo P2-T31-R6A — separación grabación pasiva vs. exposición (2026-09-05)

### F-P2-T31-TRACE-EARLY-ARM-SAFETY-01 — mitigado por diseño, verificado por test

```text
FINDING_ID=F-P2-T31-TRACE-EARLY-ARM-SAFETY-01
STATUS=MITIGATED_BY_DESIGN
SEVERITY=BAJA (requiere acceso físico a devtools del propio dispositivo)
EARLY_TRACE_TESTING_GUARD_MODEL=LOCAL_ARM_FLAG_PERMITS_EARLY_SYNC_RECORDING_ASYNC_SERVER_REVERIFY_DISARMS_AND_WIPES_ON_MISMATCH
PRODUCTION_TRACE_EXPOSURE=NO
```

Para capturar los primeros milisegundos de un cold launch, el tracer de R6A
necesita poder empezar a grabar ANTES de que resuelva el fetch asíncrono al
guard server-side (`/api/push/debug-guard`) — por diseño se apoya en un
marcador local (`deligo_push_debug_armed_v1`) leído sincrónicamente al
cargar el módulo. Esto abre una ventana teórica: si ese marcador estuviera
presente en el origin de Production (sólo posible manipulándolo a mano vía
devtools, ya que Testing y Production son orígenes Railway distintos y no
comparten storage), el tracer empezaría a grabar localmente. Mitigado en dos
capas: (1) la grabación pasiva nunca expone nada por sí sola — sólo escribe
al `localStorage` del propio dispositivo del atacante, sin persistir
secretos (ver F-P2-T31-TRACE-NO-SECRETS-01); (2) una verificación
server-side automática (`verifyPushDebugTraceGuard`) se dispara apenas el
módulo arranca armado y desarma + borra todo si el servidor no confirma
`{allowed:true}` — acotando la ventana de exposición a, como máximo, la
duración de un fetch. El PANEL (render/copiar) sigue exigiendo sus propios
dos gates de R6 en todo momento, independientemente del estado de armado.
Verificado por tests en `push-debug-trace.test.ts` (grupo "panel cannot
expose timeline in Production").

### F-P2-T31-TRACE-NO-SECRETS-01 — CERRADO, verificado por 8 tests dedicados

```text
FINDING_ID=F-P2-T31-TRACE-NO-SECRETS-01
STATUS=VERIFIED_BY_TEST
SECRET_DATA_PERSISTED=NO
```

`recordPushDebugEvent` sanitiza cada campo por patrón de nombre (cualquier
clave con "endpoint" salvo `endpointFingerprint`, o que matchee
`cookie|token|secret|password|authorization|p256dh|vapid.?private|jwt|
session|email`, se redacta) como defensa adicional a la disciplina de cada
call site de sólo pasar primitivos ya sanitizados. Valores no-primitivos se
descartan a `"[unsupported]"` en vez de serializarse enteros. Verificado
exhaustivamente en `push-debug-trace.test.ts`.

## Hallazgos P2-T31-R6 — diagnóstico de lifecycle push intermitente en iPhone (2026-09-05)

### F-P2-T31-MODULE-REGISTRY-FULL-REOPEN-01 — OPEN, estructural, no corregido en R6

```text
FINDING_ID=F-P2-T31-MODULE-REGISTRY-FULL-REOPEN-01
STATUS=OPEN_DOCUMENTED_NOT_FIXED
SEVERITY=PLAUSIBLE_CONTRIBUTOR
R2_MODULE_REGISTRY_LIFETIME=SAME_JS_MODULE_INSTANCE_ONLY
FULL_PWA_REOPEN_R2_PROTECTION=NO
```

`push-mutation-in-flight-registry.ts` (R2) usa un `Map` a nivel de módulo —
sobrevive unmount/remount de React dentro de la MISMA carga de página
(exactamente el caso que R2 arregló), pero se reinicializa vacío en
cualquier reevaluación completa del bundle JS, incluido un cierre total +
reapertura de una PWA Home-Screen (mata el proceso WKWebView). El mandato
original de R2 hablaba explícitamente de "navegar afuera y regresar" — un
caso de runtime compartido — nunca de reinicio completo de proceso; este
hallazgo documenta un límite de alcance real, no un defecto introducido.
No corregido en R6 (fuera de alcance: "sin fix funcional" explícito de la
tarea) — instrumentado para captura física en
`P2_T31_R6_INTERMITTENT_IPHONE_PUSH_LIFECYCLE_DIAGNOSTIC.md` §4.

### F-P2-T31-AUTH-HYDRATION-RACE-01 — OPEN, estructural, impacto no confirmado

```text
FINDING_ID=F-P2-T31-AUTH-HYDRATION-RACE-01
STATUS=OPEN_STRUCTURAL_GAP_PROVEN_IMPACT_PLAUSIBLE_NOT_CONFIRMED
SEVERITY=PLAUSIBLE_CONTRIBUTOR
AUTH_HYDRATION_PUSH_RACE=PROVEN_STRUCTURAL_GAP_EXISTS_IMPACT_ON_FINAL_STATE_PLAUSIBLE_NOT_CONFIRMED
```

`auth-store.ts` hidrata `_hasHydrated` de forma asíncrona (persist +
`onRehydrateStorage`). `usePushNotifications()` dispara su primer
`checkSubscription()` en el mount effect SIN leer ni esperar
`_hasHydrated` — usa el `actorType`/`actorId` que el store tenga
sincrónicamente en ese instante, potencialmente `null` en un cold launch.
Existe un mecanismo de autocorrección (el efecto `[actorKey]` invalida y
re-chequea si el actor cambia después), pero no está confirmado que cubra
todos los timings — es exactamente la familia de hipótesis que el panel de
diagnóstico de R6 (campo `authHasHydrated`, agregado más allá del mínimo
pedido por la tarea) permitirá confirmar o descartar con evidencia física
real. No corregido en R6.

## Hallazgo Production — email de verificación (cierre 2026-09-05)

### F-PRODUCTION-EMAIL-VERIFICATION-RESEND-AUTH-01 — CERRADO, remediado por operador

```text
FINDING_ID=F-PRODUCTION-EMAIL-VERIFICATION-RESEND-AUTH-01
STATUS=CLOSED_ROOT_CAUSE_CONFIRMED_AND_REMEDIATED
PRODUCTION_EMAIL_VERIFICATION_BLOCKER=CLOSED_OPERATOR_REMEDIATED
SEVERITY=BLOCKER
ROOT_CAUSE=PRODUCTION_STALE_DELETED_RESEND_API_KEY_AFTER_INCOMPLETE_KEY_ROTATION
REMEDIATION=OPERATOR_UPDATED_PRODUCTION_RESEND_API_KEY_AND_REDEPLOYED
REAL_EMAIL_PATH=src/lib/email.ts -> Resend HTTPS API
DEAD_CONFIGURATION=SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM_NAME, SMTP_FROM_EMAIL, SMTP_SECURE
```

`src/lib/email.ts` no crea un transporter Nodemailer. Carga `RESEND_API_KEY`, `EMAIL_FROM` y la URL pública en module scope, construye un cliente Resend cacheado y envía de forma no bloqueante desde los tres registros. El deployment previo (`376129d9-bd7b-4fe7-93cd-3cab64b2e644`) registró `[Email] Resend API error sending verification` con `ProviderHttpError`, código `401`. El deployment posterior actual (`bc4a94a9-8ee8-4ed8-8a41-e791b1911f16`, mismo commit `1de0d3c153eaf3be068adeb004ea43feb42fc40e`) registró `[Email] Verification sent`; esto prueba aceptación por Resend, no entrega final al buzón.

Las variables `SMTP_*` están presentes y coinciden por fingerprint en la lectura final entre Testing y Production, pero no participan en el envío real. En la lectura inicial del deployment fallido, `RESEND_API_KEY` tenía fingerprint `75af888a4bbb`; en la lectura final y el deployment posterior tiene `4941d9424894`, igual que Testing. La evidencia del operador confirma que Production no recibió la clave nueva durante la rotación, conservó la vieja y luego falló cuando esa clave fue eliminada. El timestamp exacto del cambio no está expuesto.

```text
PRODUCTION_EMAIL_ENABLED_EFFECTIVE=TRUE_RESEND_API_KEY_LOADED
SMTP_ACCEPTED_MESSAGE=YES_CURRENT_RESEND_SEND_SUCCESS_NO_DELIVERY_CONFIRMATION
OPERATOR_PRODUCTION_ENV_CHANGE_CONFIRMED=SI
OPERATOR_PRODUCTION_DEPLOY_CONFIRMED=SI
PRODUCTION_DEPLOY_POSTDATES_RESEND_KEY_CHANGE=YES_TIMESTAMP_NOT_EXPOSED
NEXT_ACTION=NONE_FOR_BLOCKER_CLOSED
```

No se modificó código, variables, DB, commit, push ni deployment por esta tarea. Reporte de cierre: `codex-reports/PRODUCTION_EMAIL_VERIFICATION_BLOCKER_CLOSURE.md`.

### F-EMAIL_DIAGNOSTIC_ENDPOINT_PROVIDER_DRIFT — nota histórica no bloqueante, sacada del backlog activo (2026-09-09)

```text
FINDING_ID=F-EMAIL_DIAGNOSTIC_ENDPOINT_PROVIDER_DRIFT
STATUS=KNOWN_NON_BLOCKING_HISTORICAL_DEBT (era OPEN_NON_BLOCKING)
SEVERITY=MEDIA
EMAIL_DIAGNOSTIC_ENDPOINT_PROVIDER_DRIFT=KNOWN_NON_BLOCKING_HISTORICAL_DEBT
```

`/api/auth/test-email` usa SMTP/Nodemailer y `SMTP_*`, pero el flujo real de
verificación usa Resend desde `src/lib/email.ts`. Por lo tanto, un resultado
positivo o negativo del endpoint diagnóstico SMTP no tiene paridad semántica
automática con el envío real. Decisión del operador
(P2-CURRENT-AUTHORITATIVE-BACKLOG-RECONCILIATION, 2026-09-09): sacar del
backlog activo — no es blocker, no es tarea activa. Se preserva como nota/
finding histórico, sin borrar la evidencia original.

## Reconciliación 2026-09-05 — hallazgos abiertos/diferidos de P2-T25/T26/T28/T31

### F-P2-T31-ANDROID-PUSH-DELIVERY-01 — OPEN, requiere diagnóstico físico

```text
FINDING_ID=F-P2-T31-ANDROID-PUSH-DELIVERY-01
STATUS=UNKNOWN_NOT_CERTIFIED
SEVERITY=ALTA (reportado por Leonardo como el problema original de negocio)
```

Ningún dispositivo Android ha logrado jamás persistir una `PushSubscription`
en TESTING — cero filas FCM en las tablas legacy Y normalizada, en los 3
roles (Cliente/Negocio/Repartidor), confirmado por inventario directo de la
base de TESTING en P2-T31-R3. El rastro server-side se corta antes de que
cualquier fila llegue a existir — no hay forma de determinar sin evidencia
física si `pushManager.subscribe()` nunca se ejecuta, lanza una excepción, o
el POST al backend falla, en el dispositivo real. R3 dejó instrucciones
exactas de diagnóstico remoto (`chrome://inspect` vía USB, 3 comandos de
consola de solo lectura) en `codex-reports/P2_T31_R3_ANDROID_WEB_PUSH_DELIVERY_CROSS_ENV_AUDIT.md`
§24. NO usar este finding para afirmar "Android roto" en ningún sentido más
específico que "no certificado" — el mismo bloque de trabajo SÍ encontró y
corrigió una causa raíz real y distinta que afecta a CUALQUIER plataforma
(ver `F-P2-T31-VAPID-STALE-SUBSCRIPTION-01` abajo, ya CERRADO).

NEXT_ACTION=LEONARDO_ANDROID_PUSH_DIAGNOSTIC (requiere el dispositivo físico, actualmente no disponible)

### F-P2-T31-VAPID-STALE-SUBSCRIPTION-01 — CERRADO (R3+R5+R5A desplegado en TESTING; iPhone pendiente)

```text
FINDING_ID=F-P2-T31-VAPID-STALE-SUBSCRIPTION-01
STATUS=CLOSED_FIX_IMPLEMENTED_TESTING_DEPLOYED_PENDING_IPHONE_PHYSICAL_CERTIFICATION
SEVERITY=ALTA
```

Reproducido EN VIVO contra TESTING (no simulado): una `PushSubscription`
física, nunca destruida por el contrato `SERVER_DETACH_ONLY`, seguía siendo
reutilizada indefinidamente por `subscribe()` sin validar jamás si su
`applicationServerKey` seguía coincidiendo con la VAPID public key vigente
del servidor. Apple Web Push respondió `{"reason":"VapidPkHashMismatch"}`,
statusCode 400, para un negocio real de TESTING con órdenes reales
fallando en `0/1 envíos entregados`. Corregido en las 4 superficies de
subscribe existentes (`use-push-notifications.ts`, `permission-prompt.tsx`,
`use-operativo-salon-push.ts`, Mozo inline) — R3 corrigió la primera, R5
portó el mismo fix a las otras 3, R5A endureció además el contrato de
fallo (VAPID fetch failure = abort sin reuse/destroy; backend ACK real;
confirmación de remoción física antes de recrear). El fix está incluido en
`a8ac961bd81ee505297f81787c1cf32e3f4cd161` y desplegado en TESTING; la
certificación física iPhone sigue pendiente.

REPORTS=codex-reports/P2_T31_R3_ANDROID_WEB_PUSH_DELIVERY_CROSS_ENV_AUDIT.md, .../P2_T31_R5_VAPID_STALE_SUBSCRIPTION_VALIDATION_EXTENSION.md, .../P2_T31_R5A_PUSH_SUBSCRIPTION_FAILURE_CONTRACT_HARDENING.md

### DIV-02 — 4 implementaciones independientes del lifecycle de PushSubscription (deuda arquitectónica, OPEN, no bloqueante)

```text
FINDING_ID=DIV-02
STATUS=OPEN_ARCHITECTURAL_DEBT_NOT_BLOCKING
SEVERITY=MEDIA
```

R4 encontró 4 implementaciones GENUINAMENTE independientes del ciclo de
vida de subscribe/unsubscribe (`use-push-notifications.ts` compartido por
Cliente/Negocio/Repartidor, `permission-prompt.tsx`, `use-operativo-salon-push.ts`,
y una copia inline en `app/mozo/panel/[slug]/page.tsx`) — ninguna reusa
código de las otras. Ya se demostró el costo real de esto: el fix de R3
tuvo que portarse manualmente 3 veces más (R5) para cubrir las 4
superficies. Se evaluó conceptualmente un `PushLifecycleManager`
centralizado (ver `codex-reports/P2_T31_R4_WEB_PUSH_REFERENCE_ARCHITECTURE_CONFORMANCE_AUDIT.md`
§29) pero NO se recomienda como próxima tarea — reparar puntualmente cada
implementación (como ya se hizo con DIV-01) tiene menor riesgo inmediato.

### DIV-03 — Salón/Mozo sin protección de remount/mutación-en-vuelo equivalente a P2-T31-R2 (OPEN, riesgo estructural sin evidencia física)

```text
FINDING_ID=DIV-03
STATUS=OPEN_STRUCTURAL_RISK_NO_PHYSICAL_EVIDENCE
SEVERITY=MEDIA
```

El registro de mutación en vuelo module-scoped que P2-T31-R2 agregó (protege
contra el race de "primera activación lenta + remount" en el hook personal)
NO fue portado a `use-operativo-salon-push.ts` ni a la copia inline de Mozo
— ninguna de las dos tiene ningún gate/registro de operaciones. Es
estructuralmente el mismo tipo de superficie (mismo patrón de subscribe
lento en la primera activación) pero NO se confirmó con evidencia física
que el bug se manifieste ahí — se documenta como riesgo, no como defecto
confirmado. Deliberadamente NO tocado en R5/R5A (fuera de su alcance
explícito). Candidato a una tarea de auditoría dedicada antes de portar
cualquier fix.

### DIV-04 — `NEXT_PUBLIC_VAPID_PUBLIC_KEY` muerta y con valor distinto en TESTING (OPEN, baja severidad, cosmético)

```text
FINDING_ID=DIV-04
STATUS=OPEN_LOW_SEVERITY_CONFIG_HYGIENE
SEVERITY=BAJA
```

En TESTING, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` tiene un valor DISTINTO de
`VAPID_PUBLIC_KEY` (confirmado por hash, nunca se imprimió ningún valor
real) y no se referencia en ningún archivo de `src/` — es una variable de
entorno muerta. El código real obtiene la key vigente vía
`GET /api/push/vapid-key`, que sirve `VAPID_PUBLIC_KEY` (la misma que firma
el servidor) — así que esta discrepancia NO afecta el flujo real hoy, pero
podría confundir a un futuro debugging de env vars. `PROD_TEST_VAPID_SAME_OR_DIFFERENT`
respecto a Production sigue `UNKNOWN` — sin acceso read-only establecido a
las env vars de Production desde ninguna sesión de esta cadena.

### DIV-05 — `?iosDebug=1` residual en `start_url` del manifest de Cliente (OPEN, cosmético)

```text
FINDING_ID=DIV-05
STATUS=OPEN_LOW_SEVERITY_COSMETIC
SEVERITY=BAJA
```

`public/manifest-cliente.json` tiene `"start_url": "/cliente?iosDebug=1"`
— residuo de la serie histórica de diagnósticos iOS (`IOS_MOBILE_*`,
`IOS_STANDALONE_*`). Los manifests de Negocio/Repartidor NO tienen este
query param. Sin efecto funcional conocido hoy; limpieza cosmética de baja
prioridad.

### P2-T25 — hallazgos operativos abiertos (no bloqueantes para TESTING, sí antes de escalar Production)

```text
STATUS=OPEN_DOCUMENTED_LIMITATIONS
```

- Rate limiter y locks de creación de pedido son **process-local** (memoria
  del proceso Node) — sin scaling horizontal seguro todavía; una segunda
  réplica de la app duplicaría los límites reales de cada bucket.
- El bucket de negocio (30/5min) sólo tiene smoke-test en runtime —
  requiere validación de producto/operaciones antes de promoción a
  Production.
- `getClientIp`/confianza del proxy de Railway (X-Forwarded-For) queda
  pendiente de endurecer — el límite por IP en runtime está parcialmente
  limitado por esto.
- Capa de "challenge" (CAPTCHA o equivalente) NO implementada.

### P2-T28 — hallazgo para P2-T27

```text
STATUS=OPEN_FOR_FUTURE_TASK
```

Las transiciones de estado de pedido NO-cancelación (confirmado, preparando,
en_camino, listo_para_retirar, entregado) no tienen CAS a nivel de base de
datos — dependen únicamente del lock de aplicación process-local.
`cancelado` SÍ usa CAS. Antes de correr más de una réplica de la app, esto
necesita concurrencia optimista real — candidato natural para P2-T27.

## F-PRODUCTION-CATALOG-IMAGE-PIPELINE-01 — 2026-08-30 (CERRADO — Cloudinary; fallback local queda como deuda separada)

```text
STATUS_UPDATE=CLOUDINARY_RESOLVED_2026-08-30
```

El operador reemplazó la API key de Cloudinary en Production y redesplegó
`DeliGO`. Certificado en `PRODUCTION-PILOT-CATALOG-E2E-01-R1`: un canario
real subió a `res.cloudinary.com` (no a `/uploads/...`), y las 8
referencias de imagen rotas del negocio demo fueron re-subidas y
actualizadas por las APIs reales — 8/8 confirmadas renderizando (fetch
directo 200 + inspección de DOM `naturalWidth>0` en desktop y mobile). El
bloqueador de onboarding queda `RESOLVED`. **El `404` del fallback local a
disco en sí NUNCA fue investigado ni corregido** — sigue abierto como
`LOCAL_UPLOAD_FALLBACK_404_FINDING=OPEN_NON_BLOCKING_WHILE_CLOUDINARY_HEALTHY`,
deuda de robustez para una tarea de ingeniería futura (si Cloudinary
volviera a fallar, el fallback silencioso seguiría produciendo el mismo
problema). Ver `codex-reports/PRODUCTION_PILOT_CATALOG_E2E_01_R1.md`.

## F-PRODUCTION-CATALOG-IMAGE-PIPELINE-01 (histórico, 2026-08-30, hallazgo original)

```text
FINDING_ID=F-PRODUCTION-CATALOG-IMAGE-PIPELINE-01
STATUS=OPEN_FIX_NOT_APPLIED
SEVERITY=HIGH
REAL_BUSINESS_ONBOARDING_BLOCKER=SI
```

Ninguna imagen de producto/negocio subida hoy en Production renderiza
para los clientes. Descubierto en `PRODUCTION-PILOT-CATALOG-E2E-01`
subiendo 8 imágenes reales (Wikimedia Commons → archivo temporal →
`POST /api/upload` real, mismo endpoint que usa el panel) a un negocio
demo: las 8 devolvieron `200` con una URL, pero ninguna de las 8 URLs
sirve la imagen (`404` real, confirmado por `curl` y visualmente en
navegador real, desktop y mobile).

Causa raíz precisa, diagnosticada sin modificar nada: `src/app/api/upload/route.ts`
intenta Cloudinary primero (`CLOUDINARY_CLOUD_NAME`/`_API_KEY`/`_API_SECRET`,
las 3 presentes en Production con los nombres exactos) y cae en silencio
al fallback de disco local si falla (`catch` sin propagar el error al
llamador). Logs de Production confirmaron el fallo en las 8 subidas
(`"Error uploading image to Cloudinary: {"`, truncado en el propio log).
Un ping de diagnóstico directo a la API de Cloudinary con las
credenciales reales (nunca impresas, sólo el código de error) confirmó:
**`401 disabled api_key`** — la API key está deshabilitada del lado de
Cloudinary, no es un typo ni una variable ausente. El fallback a disco
local TAMPOCO funciona: la URL `/uploads/productos/...` que el propio
backend genera y confirma como "subida" devuelve `404` al pedirse — causa
exacta no investigada (hipótesis no verificada: cómo el build standalone
de Next.js sirve archivos escritos en tiempo de ejecución bajo
`public/uploads/`), fuera de alcance de una tarea de solo-lectura/no-fix.

Impacto: cualquier negocio real que suba fotos de sus productos hoy
recibe una confirmación de éxito y termina con un catálogo de imágenes
rotas, sin ningún error visible en ningún punto del flujo.

NEXT_ACTION=requiere su propia tarea corta dedicada (restablecer/reemplazar
la API key de Cloudinary + investigar el 404 del fallback local),
autorización explícita del usuario. Ver
`codex-reports/PRODUCTION_PILOT_CATALOG_E2E_01.md` sección 11.

## F-PRODUCTION-CHAT-SESSION-CHECK-URL-01 — 2026-08-30 (CERRADO)

```text
FINDING_ID=F-PRODUCTION-CHAT-SESSION-CHECK-URL-01
STATUS=CLOSED_FIX_APPLIED_AND_CERTIFIED
SEVERITY=HIGH_FOR_REALTIME_CHAT_SPECIFICALLY (no bloquea onboarding de catálogo/productos/pedidos)
CLOSED_IN=CHAT_SESSION_CHECK_URL_PRODUCTION_FIX-R1 (2026-08-30)
```

**Cerrado**: el operador provisionó
`DELIGO_MONOLITH_INTERNAL_URL=https://deligo.ar` en `chat en vivo`/
production y la desplegó (`0bfc7bb5...`, commit `c05525a5`, `SUCCESS`).
Certificado con el roundtrip sintético de `P2-T11-STAGE4E` contra
Production real: HMAC válido → `200 {"valid":false}` (autenticado
correctamente, sesión inexistente); HMAC inválido/timestamp vencido →
`401`; gate de socket obligatorio ahora ejecuta el chequeo completo
(`reason=inactive`, ya no `reason=configuration_disabled`). Ver
`codex-reports/CHAT_SESSION_CHECK_URL_PRODUCTION_FIX.md` para el detalle
completo, incluida la limitación honesta declarada (el camino positivo de
"conexión de socket exitosa" no se certificó por requerir una escritura de
DB fuera del alcance permitido — el gate en sí quedó probado funcionando
correctamente). `PRODUCTION_OPERATIONAL_READINESS=PASS`.

`chat en vivo`/production nunca recibió `DELIGO_MONOLITH_INTERNAL_URL` —
la variable que `mini-services/chat-service/internal-session-check-client.js`
necesita para validar sesiones. Sin ella, `readConfiguration()` devuelve
`{status:"disabled"}` y `checkSessionActive()` devuelve `valid:false` para
cualquier `sid`. `index.js` línea 306 usa ese resultado como gate
obligatorio de cada conexión de socket entrante (`io.use(...)`, paso 4-5
del `CONNECT_VALIDATION_ORDER` de P2-T11) — sin bypass en el código. **Toda
conexión de chat en tiempo real en Production es rechazada hoy con
`TOKEN_INVALID`.** Descubierto en `PRODUCTION-SYNC-R7` (2026-08-30) al
derivar el inventario de variables requeridas directamente del código
actual en vez de reutilizar sólo la tabla de 8 variables congelada por R1
(que nunca incluyó esta dirección del canal). Refuerza — no contradice —
`F-P2-T18-LIVE-PUSH-01`/`P2_T18_DISPOSITION=PAUSED_NOT_CLOSED_EXTERNAL_INFRA_DEPENDENCY`.

Fix conocido, no aplicado (fuera del presupuesto de solo-lectura de R7):
escribir `DELIGO_MONOLITH_INTERNAL_URL=https://deligo.ar` en
`chat en vivo`/production (`--skip-deploys`), certificar con un roundtrip
autenticado sintético — mismo patrón ya usado y documentado en
`codex-reports/archive/P2-T11-STAGE4E.md`. Ver
`codex-reports/PRODUCTION_SYNC_R7.md` sección 9 para el detalle completo.

NEXT_ACTION=requiere una tarea corta dedicada, autorización explícita del
usuario, análoga a PRODUCTION-SYNC-R2.

## F-PRODUCTION-SYNC-R6-R0-AUXILIARY-PARITY-01 — 2026-08-30

Review Moderation Expiry y DeliGO Mesa Occupancy Cron existen como objetos de
proyecto Railway y tienen instancia TESTING, pero no instancia Production.
Ambas configuraciones TESTING fueron verificadas en estado actual y sus
runners son one-shot con `DATABASE_URL` como único requisito propio; ambos
escriben datos cuando se ejecutan.

## F-PRODUCTION-SYNC-R6-R0-CHAT-SCHEDULER-01 — 2026-08-30

El scheduler externo de Chat Cleanup no pudo probarse desde el workspace. Se
clasifica `UNPROVEN_REQUIRES_OPERATOR_UI`, no ausente. El endpoint Production
sin secreto devolvió 404 porque no existe `CLEANUP_SECRET` con el nombre que
lee el código; la variable distinta `x-cleanup-secret2` no fue reutilizada.
Decisión: `BLOCKED_AWAITING_OPERATOR_CHAT_CLEANUP_SCHEDULER_EVIDENCE`.

## F-PRODUCTION-SYNC-R6-R0-BACKUP-01 — 2026-08-30

Backup custom post-27/pre-auxjobs de 205878 bytes, SHA-256
`71027a88ec31e0497a1d18850d1db551fa6a05d73153828ca1a3603e4f1260bc`, legible
y restaurable con PostgreSQL 18.6. Production y scratch coincidieron en
27/27/0, schema 47/514/102/139 y agregados 16/6/22/144/43.

## F-PRODUCTION-SYNC-R5-CONTRACT-01 — 2026-08-29

Migration `20260826230000_drop_terminal_operativa_push_subscription` fue
aplicada una sola vez en Production, con exit 0. Se verificó 27/27/0, cero
pendientes, `terminales_salon` existente y `pushSubscription` ausente. El
fingerprint pasó de 47/515/102/139 a 47/514/102/139, exactamente el cambio
esperado; los agregados de referencia permanecieron 16/6/22/144/43.

## F-PRODUCTION-SYNC-R5-CERTIFICATION-01 — 2026-08-29

El backup lógico pre-27 continúa certificado y restaurable con SHA-256
`160468441db4e240bbadd962545d24576c0055912454815ff484b1f9d3c7e424`.
DeliGO y chat conservan sus deployments SUCCESS exactos, ambos sin
`preDeployCommand`, y sus smoke checks post-R5 pasaron. No hubo push, code
deploy, restart, movimiento de main ni activación de cron/preDeploy.

## F-PRODUCTION-SYNC-R5-R0-R1-BACKUP-01 — 2026-08-29

Tooling oficial EDB PostgreSQL 18.6 verificado fuera del repo. El dump custom
Production de 205830 bytes tiene SHA-256
`160468441db4e240bbadd962545d24576c0055912454815ff484b1f9d3c7e424`.
`pg_restore --list` y restore completo en scratch 18.6 pasaron: 26/0, #27
única pendiente, schema 47/515/102/139 y conteos agregados coincidentes.
Scratch eliminado; Production sin mutaciones.

## F-PRODUCTION-SYNC-R5-R0-R1-CLOSURE-01 — 2026-08-29

`PRODUCTION_LOGICAL_BACKUP_RESTORABLE=SI`. R5 queda preparado pero requiere
autorización explícita para ejecutar #27.

## F-PRODUCTION-SYNC-R5-R0-TOOLING-01 — 2026-08-29

Production confirma PostgreSQL 18.6, 26 migraciones exitosas, 0 fallidas,
exactamente #27 pendiente y `terminales_salon.pushSubscription` presente.
La captura del backup no puede comenzar: no existe cliente PostgreSQL 18 ni
Docker/Podman; sólo se encontró PostgreSQL 12, deliberadamente no utilizado.
R5-R0 queda bloqueado sin dump, restore, scratch ni mutación.

## F-PRODUCTION-SYNC-R5-R0-REFERENCE-01 — 2026-08-29

Los controles read-only son 47 tablas, 515 columnas, 102 constraints lógicos,
139 índices y conteos agregados 16 negocios, 6 empleados, 22 clientes,
144 pedidos y 43 productos. El catálogo bruto de PostgreSQL 18 suma 484 por
382 constraints `NOT NULL`; la métrica lógica autorizada sigue siendo 102.

## F-PRODUCTION-SYNC-R4-R2-R2-DUAL-DEPLOY-01 — 2026-08-29

El cambio manual de branch produjo el deployment nuevo de chat
`94927d86-a16f-45cb-80b5-2637aace0a39`, `SUCCESS`, commit exacto
`c05525a5e0419922a484fbe6cb25c8604b8ca313`. Repo, root y branch `main`
coinciden; autodeploy queda habilitado por autoridad UI. DeliGO conserva su
deployment `a3d7d7a4-3732-42d7-95b6-4ecbbeae6ca3`, `SUCCESS`, mismo commit.
Logs y smokes de ambos pasaron. DB final: 26/0, #27 única pendiente,
`pushSubscription` presente y predeploy migratorio inactivo.

## F-PRODUCTION-SYNC-R4-CLOSURE-01 — 2026-08-29

R4 satisface la condición de dual production deploy exacto y saludable. R5
queda preparado pero no autorizado: la migración destructiva permanece sin
ejecutar.

## F-PRODUCTION-SYNC-R4-R2-R1-DEPLOY-01 — 2026-08-29

La relectura viva confirmó las 8 filas requeridas por R1, incluidas las tres
`PRIVATE_EVIDENCE_CLOUDINARY_*` presentes en DeliGO Production; no se expuso
plaintext y no hubo deployment por el stage apply. El gate local pasó, se hizo
exactamente un push fast-forward a `c05525a5e0419922a484fbe6cb25c8604b8ca313`
y DeliGO desplegó con `SUCCESS`; logs y smoke HTTP 200 pasaron. El branch de
chat quedó `testing` porque la CLI no soporta un cambio branch-only demostrable
sin reconectar la fuente. Ver `codex-reports/PRODUCTION_SYNC_R4_R2_R1.md`.

## F-PRODUCTION-SYNC-R4-R2-PREFLIGHT-01 — 2026-08-29

El gate local de R4-R2 pasó, pero la lectura directa de variables del servicio
exacto `DeliGO` en Production reportó ausentes
`PRIVATE_EVIDENCE_CLOUDINARY_CLOUD_NAME`,
`PRIVATE_EVIDENCE_CLOUDINARY_API_KEY` y
`PRIVATE_EVIDENCE_CLOUDINARY_API_SECRET`, en contradicción con la autoridad UI
del operador. Como el hecho cambia el gate pre-push, se detuvo sin push,
deploy, retry de escritura o mutación de chat. Ver
`codex-reports/PRODUCTION_SYNC_R4_R2.md`.

## F-PRODUCTION-SYNC-R4-R1-PREREQUISITES-01 — 2026-08-29

R4-R1 derivó de metadata actual la URL Production→Production
`http://harmonious-empathy.railway.internal:8080` y la escribió únicamente en
DeliGO con `--skip-deploys`, sin deployment nuevo. El código confirma que la
evidencia privada es lazy y fail-closed, con namespace separado y sin fallback;
la autoridad de seguridad exige credencial Cloudinary dedicada Production.
La credencial histórica de TESTING fue expuesta y luego rotada/revocada, pero
no está autorizada para reutilización en Production. Los tres nombres exactos
siguen ausentes y requieren acción manual. Chat Production sólo expone repo;
branch/root/autodeploy no son demostrables sin mutación. Ver
`codex-reports/PRODUCTION_SYNC_R4_R1.md`.

## F-PRODUCTION-SYNC-R4-PREFLIGHT-01 — 2026-08-29

R4 se bloqueó antes del push y del deploy. El listado de Production no
contiene los nombres exactos `PRIVATE_EVIDENCE_CLOUDINARY_API_KEY`,
`PRIVATE_EVIDENCE_CLOUDINARY_API_SECRET` ni
`PRIVATE_EVIDENCE_CLOUDINARY_CLOUD_NAME`; además
`REALTIME_INTERNAL_SERVICE_URL` está ausente sin estrategia inequívoca. El
último deployment de DeliGO evidencia `main`, pero `chat en vivo` nunca ha
desplegado y su rama no puede certificarse. No se usaron aliases, secretos de
Testing ni cambios de fuente/configuración. Evidencia completa:
`codex-reports/PRODUCTION_SYNC_R4.md`.

## F-PRODUCTION-SYNC-R3-R3-R1-EXECUTION-01 — 2026-08-29

La segunda autorización corrigió la invocación: el patch certificado se
consumió una vez, `0_init` quedó baselined y #2–#26 terminaron exitosamente.
El único pendiente real es #27, deliberadamente no ejecutado. Evidencia:
`codex-reports/PRODUCTION_SYNC_R3_R3_R1.md`.

Registro canónico de findings del workstream P2-T05 (Push multi-device).
No repite informes enteros — para evidencia extensa ver
`codex-reports/archive/LEGACY_FULL_REPORT_20260826.md`.

## F-PRODUCTION-SYNC-R3-R3-EXECUTION-01 — 2026-08-29

La invocación inicial de `psql` colocó `-f` después de la URL. `psql` advirtió
que el archivo era un argumento extra ignorado y terminó sin ejecutar SQL. La
Producción permaneció sin cambios y, conforme al gate, no se hizo retry
automático. El detalle y la evidencia están en
`codex-reports/PRODUCTION_SYNC_R3_R3.md`.

## PRODUCTION-SYNC-R3-R2-R1 UPDATE — 2026-08-29

`F-PRODUCTION-SYNC-R3-R2-R1-BASELINE-01`: la autorización de reconciliación
permitió sintetizar sólo el `ALTER` nullable de `empleados.cuentaOperativaId`.
Completion exacta, baseline scratch, bundle #2–#26 y status con sólo #27
pendiente pasan. No hubo mutación de Production.

## PRODUCTION-SYNC-R3-R2 UPDATE — 2026-08-29

`F-PRODUCTION-SYNC-R3-R2-BASELINE-01`: la revalidación read-only confirmó las
cinco tablas faltantes de `0_init` y un sexto hueco estructural en la tabla
existente `empleados.cuentaOperativaId`, con sus índices y FK. Bajo el hard
rule de no alterar objetos existentes no existe completion patch exacto;
decisión `BLOCKED_BASELINE_COMPLETION_PATCH_NOT_EXACT`. Ver
`codex-reports/PRODUCTION_SYNC_R3_R2.md`.

## PRODUCTION-SYNC-R3 UPDATE — 2026-08-29

`F-PRODUCTION-SYNC-R3-BASELINE-01`: Production tiene 27 migraciones
pendientes, ausencia de `_prisma_migrations` y tablas base ya existentes.
El mecanismo aislado certifica la exclusión física de la migración
destructiva, pero no puede ejecutar exactamente 26 sin el `resolve` de
`0_init`, prohibido por la autorización R3. Estado: BLOCKED; sin DB write.

`F-PRODUCTION-SYNC-R3-R1-BASELINE-02`: `0_init` no está completamente
materializada: faltan cinco tablas del conjunto de 36 y el prefijo contiguo
legítimo es cero. Estado: BLOCKED_BASELINE_STATE_CANNOT_BE_PROVEN.

---

## F-P2-T05-15
```
TITLE: stale async auxiliary state (loading/toast) can be owned by a superseded Push mutation
STATUS: RESOLVED_H3B_COMMITTED_AND_POSTCOMMIT_CERTIFIED
ROOT_CAUSE: use-push-notifications.ts subscribe()/unsubscribe() didn't gate loading/toast application through the latest-operation gate consistently; additionally, the actor-change effect invalidated the gate/isSubscribed but never reset `loading`, which could leave it stuck true for a new actor whose own mutation could never clear it (Switch stays disabled).
IMPACT: UI could show a stuck spinner / permanently disabled switch for a newly-authenticated actor sharing the same hook instance.
EVIDENCE_SUMMARY: found during H3B precommit adversarial review by direct code trace of push-operation-guard.ts's invalidate() semantics; confirmed via new regression test.
RESOLUTION_TASK: H3B (implementation) + H3B precommit review (actual fix: setLoading(false) added to actor-change effect)
COMMIT: 9394b605611deb4f10b8028a41a8bd19f7687314
DEPLOY/RUNTIME_AUTHORITY: H3B testing checkpoint — real external Chrome, F15 runtime sanity confirmed no stuck loading/stale UI reversion/unhandled rejection across first-enable/disable/re-enable flow.
BLOCKS: nothing further
NEXT_ACTION: none — resolved
```

## F-P2-T05-18
```
TITLE: Personal Push switch shows OFF after a genuinely successful subscribe (stale post-await UI read)
STATUS: RESOLVED_H3B_TESTING_DEPLOY_AND_REAL_BROWSER_CERTIFIED
ROOT_CAUSE: same as F-P2-T05-23 (client stale-closure) — SettingsSection.handleToggleNotifications re-read `push.isSubscribed` from a stale render closure after `await push.subscribe()` instead of using the hook's fresh result.
IMPACT: user could genuinely enable Push (physical subscription created, server bound) yet see the switch revert to OFF, appearing broken.
EVIDENCE_SUMMARY: reproduced with a real external Chrome (H3 CDP session): subPresent:true, /api/push/status subscribed:true, switch checked:false. Root-caused to F-P2-T05-23.
RESOLUTION_TASK: H3B implementation (PushMutationResult contract) + H3B testing checkpoint (real post-deploy re-confirmation)
COMMIT: 9394b605611deb4f10b8028a41a8bd19f7687314
DEPLOY/RUNTIME_AUTHORITY: pushed + auto-deployed to Railway TESTING (DeliGO Copy + chat en vivo, both SUCCESS at commit 9394b60). Real external Chrome (headless, isolated profile, native Notification/PushManager/ServiceWorker, no monkeypatch) against the deployed origin: first-enable/disable/re-enable all consistent, switch checked=true without reload after a genuine subscribe.
BLOCKS: nothing further
NEXT_ACTION: none — resolved
```

## F-P2-T05-19
```
TITLE: Push channel (default/salon) not type-safe — string-convention field could silently cross channels
STATUS: RESOLVED_H1_COMMITTED_AND_POSTCOMMIT_CERTIFIED
ROOT_CAUSE: PushSubscriptionCleanup used a loosely-typed `field` string convention instead of a discriminated union to distinguish default vs salon channel ownership.
IMPACT: type-safety debt — a caller could theoretically pass a mismatched field/channel combination undetected at compile time.
RESOLUTION_TASK: H1 (F19+F20 implementation) — PushSubscriptionCleanup became a discriminated union on `channel`.
COMMIT: c66df8d (fix: harden push fanout channel and key handling)
DEPLOY/RUNTIME_AUTHORITY: H1+H2 checkpoint — pushed and deployed to TESTING, HTTP smoke PASS.
BLOCKS: nothing further
NEXT_ACTION: none — resolved
```

## F-P2-T05-20
```
TITLE: cross-owner endpoint/key divergence not fail-closed in push fanout merge
STATUS: RESOLVED_H1_COMMITTED_AND_POSTCOMMIT_CERTIFIED
ROOT_CAUSE: mergePushFanoutTargets didn't detect when the SAME physical endpoint carried divergent p256dh/auth keys across two different owners' records, risking sending to a stale/wrong key.
IMPACT: edge case — a stale legacy record sharing an endpoint with a newer normalized record, with divergent keys, could reach an inconsistent fanout target.
RESOLUTION_TASK: H1 — added `sameFanoutSubscriptionKeys()` comparing only p256dh/auth (excluding expirationTime), with a monotonic `conflicted: Set<string>` fail-closed exclusion.
COMMIT: c66df8d
DEPLOY/RUNTIME_AUTHORITY: H1+H2 checkpoint, TESTING deploy PASS.
BLOCKS: nothing further
NEXT_ACTION: none — resolved
```

## F-P2-T05-21
```
TITLE: push fanout performance — unbounded concurrency / N+1 subscription lookups across owners
STATUS: RESOLVED_H2_COMMITTED_POSTCOMMIT_AND_TESTING_DEPLOY_CERTIFIED
ROOT_CAUSE: createNotification's fanout issued unbatched per-owner subscription reads and unbounded concurrent sends.
IMPACT: performance debt at scale (many simultaneous targets) — no correctness defect, purely throughput/DB load.
RESOLUTION_TASK: H2 — getPushSubscriptionsForOwners batch primitive + mapWithConcurrency (cap 8).
COMMIT: 47a630e1cbb1c2fe2a3dcedc739748f67f896952 (perf: batch push fanout and bound concurrency)
DEPLOY/RUNTIME_AUTHORITY: H1+H2 checkpoint — pushed and deployed to TESTING, HTTP smoke PASS.
BLOCKS: nothing further
NEXT_ACTION: none — resolved
```

## F-P2-T05-22
```
TITLE: Bun process-global @/lib/auth mock collision across Push-related test files
STATUS: RESOLVED_H4_AMENDED_AND_POSTAMEND_CERTIFIED
ROOT_CAUSE: Bun's mock.module("@/lib/auth", ...) replaces module resolution PROCESS-WIDE. Seven test files registered three mutually-incompatible partial shapes (some missing validateSession, others missing getUserFromToken/SESSION_COOKIE_NAME). Route handlers call the imported auth functions at TEST-EXECUTION time (not each file's own module-load time), so whichever shape survived process-wide governed EVERY file's route calls — producing "SyntaxError: Export named 'validateSession' not found" or silently wrong behavior, depending on combined-run file order.
IMPACT: the affected file (chat/mensajes route.test.ts) deterministically lost its tests whenever combined with the other 6 in one `bun test` invocation — pure test-infrastructure debt, never a product defect.
EVIDENCE_SUMMARY: H4 postcommit review contradicted the prior PASS report by direct code inspection: resetAuthMockState() did not clear authMockHooks and mozo/salon omitted the shared reset. A deterministic regression was added and failed before the fix, exactly at the hook baseline assertion. The correction now passes 124/124 across the 7 suites and 523/523 across the 34-file authority in isolated, normal combined, and reversed combined runs.
RESOLUTION_TASK: H4/F22 reset-isolation correction and post-amend full recertification PASS — helper hook reset, per-suite reset wiring for mozo/salon, one regression test, 7/7 and 34/34 gates in all required orders.
COMMIT: e172cd7ac8245d32db89f96cf6c86ca31bb43cf2 (amended from f5571f14e73155f7a4828dfe014230b95c795115; parent 9394b605611deb4f10b8028a41a8bd19f7687314) — LOCAL ONLY, NOT pushed.
DEPLOY/RUNTIME_AUTHORITY: N/A — test-infrastructure only, no deploy required for closure.
BLOCKS: P2-T05 closeout only; final push/deploy/testing checkpoint remains
NEXT_ACTION: P2-T05-FINAL-TESTING-CHECKPOINT
```

## F-P2-T05-23
```
TITLE: Cliente SettingsSection re-reads stale closed-over push.isSubscribed after await (F18's root cause)
STATUS: RESOLVED_H3B_TESTING_DEPLOY_AND_REAL_BROWSER_CERTIFIED
ROOT_CAUSE: handleToggleNotifications called `await push.subscribe()` then checked `if (!push.isSubscribed)` — that variable belongs to the render closure captured when the mutation STARTED, never updates even though the hook internally applies a newer setIsSubscribed.
IMPACT: identical symptom to F18 — false "revert" of a genuinely successful first-time Push activation.
RESOLUTION_TASK: H3B — hook now returns an explicit `PushMutationResult {current, subscribed}`; consumer only acts on it when `result.current === true`, never re-reads `push.isSubscribed` post-await.
COMMIT: 9394b605611deb4f10b8028a41a8bd19f7687314
DEPLOY/RUNTIME_AUTHORITY: same real-browser TESTING confirmation as F18 (they share one runtime certification).
BLOCKS: nothing further
NEXT_ACTION: none — resolved
```

---

## Historical / pre-hardening findings (P2-T05 Stage1-Stage4, resolved before the H1-H4 hardening sequence began)

All `RESOLVED` — full evidence lives only in the legacy archive, not repeated here (design/implementation-match findings, not runtime defects requiring separate tracking):

```
F-P2-T05-01=RESOLVED_BY_UNIFIED_HTTP_PUSH_SUBSCRIPTION_VALIDATION
F-P2-T05-02=RESOLVED_BY_DURABLE_SERVER_DETACH_ONLY_WITH_ASYNC_STALENESS_GUARD (+ RESOLVED_PHYSICAL_BROWSER_RUNTIME_CERTIFIED)
F-P2-T05-03=RESOLVED_IN_DESIGN_IMPLEMENTATION_MATCH
F-P2-T05-05=RESOLVED_BY_AUTHORITATIVE_RAILWAY_CONNECTION_LINEAGE
F-P2-T05-06=RESOLVED_CREDENTIAL_ROTATED_AND_OLD_SECRET_INVALIDATED
F-P2-T05-12=RESOLVED_BY_SERVER_AUTHORITATIVE_ACTOR_ENDPOINT_STATUS (+ RESOLVED_PHYSICAL_BROWSER_RUNTIME_CERTIFIED)
F-P2-T05-13=RESOLVED_BY_SERVER_AUTHORITATIVE_ACTOR_ENDPOINT_STATUS (+ RESOLVED_PHYSICAL_BROWSER_RUNTIME_CERTIFIED)
F-P2-T05-14=RESOLVED_BY_LATEST_RELEVANT_OPERATION_GUARD
```

Note: F-P2-T05-04, -07 through -11, -16, -17 do not appear as distinct
open/resolved entries in the recent MASTER_CONTEXT blocks — if precise
detail on any of these is needed, consult the legacy archive directly
(search `F-P2-T05-<NN>` in `codex-reports/archive/LEGACY_FULL_REPORT_20260826.md`).

---

## P2-T13 (separate, not absorbed by P2-T05 hardening) — CLOSED (ver Stage 7)

```
STATUS: CLOSED (P2-T13-STAGE7 FINAL ADVERSARIAL CLOSEOUT, 2026-08-26)
SCOPE: same-owner same-endpoint re-subscription RACE (distinct from F20,
  which covers cross-owner divergent-key conflicts on the same endpoint).
BLOCKS_CURRENT_WORK: NO — explicitly out of scope for every H1-H4 stage;
  boundary re-confirmed clean at every checkpoint.
```

Nota histórica: esta sección originalmente (pre-Stage1) decía
`IMPLEMENTED_LOCAL_AWAITING_PRECOMMIT_REVIEW` — texto obsoleto detectado y
corregido en Stage 7. El detalle cronológico completo (Stage1 audit →
Stage2 implementation → Stage3 precommit → Stage4 commit → Stage5
postcommit → Stage6 push/runtime → Stage7 closeout) está en las secciones
fechadas 2026-08-26 más abajo.

## P2-T05 closeout verification — 2026-08-26

P2_T05_CLOSEOUT_VERIFIED=SI
FINAL_CLOSEOUT_F15=PASS
FINAL_CLOSEOUT_F18=PASS
FINAL_CLOSEOUT_F19=PASS
FINAL_CLOSEOUT_F20=PASS
FINAL_CLOSEOUT_F21=PASS
FINAL_CLOSEOUT_F22=PASS
FINAL_CLOSEOUT_F23=PASS
NEW_BLOCKING_FINDING_COUNT=0

La anotación histórica de F22 que decía `LOCAL ONLY, NOT pushed` describía el
estado previo al checkpoint final. El registro posterior de Git y Railway
confirma la publicación de e172cd7 y ambos autodeploys SUCCESS en TESTING; no
se altera el status histórico RESOLVED_H4_AMENDED_AND_POSTAMEND_CERTIFIED.

## F-P0-06 / P2-T13 Stage 1 reconciliation — 2026-08-26

F-P0-06_P2_T13_SCOPE_RECONCILED=SI
P2_T13_STAGE1_AUDIT_DESIGN=PASS
T13_RACE_A_REGISTER_REGISTER=ALREADY_RESOLVED_BY_T05
T13_RACE_B_STALE_DETACH_KEY_ROTATION=RESIDUAL_BUG_REPRODUCED
T13_RACE_C_CROSS_ACTOR=ALREADY_SAFE_BY_MODEL_C1
STALE_OLD_KEYS_CAN_DELETE_NEWER_SAME_ENDPOINT_NORMALIZED_BINDING=SI
P2_T13_DISPOSITION=IMPLEMENTATION_REQUIRED
P2_T13_CLOSEOUT=NO

El alcance residual de F-P0-06/P2-T13 no reabre ningún finding de P2-T05:
register/register queda protegido por la identity unique y upsert; el gap
vigente es el detach normalized endpoint-only frente a una rotación de keys.

## F-P0-06 / P2-T13 Stage 2 implementation — 2026-08-26

P2_T13_STAGE2_IMPLEMENTATION=IMPLEMENTED_LOCAL_AWAITING_PRECOMMIT_REVIEW
STALE_OLD_KEYS_CAN_DELETE_NEWER_SAME_ENDPOINT_NORMALIZED_BINDING=FIXED_LOCAL
T13_NORMALIZED_CAS_OWNER_CHANNEL_ENDPOINT_KEYS=IMPLEMENTED
T13_MALFORMED_INPUT_BLIND_ENDPOINT_FALLBACK=BLOCKED
P2_T13_CLOSEOUT=NO
P2_T13_NEXT_TASK=P2-T13-STAGE3

Race-B queda corregida en el working tree mediante compare-and-delete
atómico por owner/channel/endpoint/p256dh/auth. Race-A register/register y
Race-C cross-actor multi-bind permanecen resueltas por T05/Model-C1. Este
registro no marca P2-T13 como CLOSED ni reabre ningún finding de P2-T05.

## F-P0-06 / P2-T13 Stage 3 pre-commit review — 2026-08-26

P2_T13_STAGE3_PRECOMMIT_REVIEW=PASS
P2_T13_STATUS=FIX_PRECOMMIT_CERTIFIED
P2_T13_IMPLEMENTATION_STATUS=PRECOMMIT_CERTIFIED
T13_RACE_B_STATUS=FIX_PRECOMMIT_CERTIFIED
T13_STAGE3_ADVERSARIAL_FINDINGS=0
T13_STAGE3_DELETE_PREDICATE=ownerType+ownerId+channel+endpoint+p256dh+auth
T13_STAGE3_NORMALIZED_DETACH_CALLER_COUNT=5
T13_STAGE3_USER_ENDPOINT_ONLY_DETACH_CALLER_COUNT=0
T13_STAGE3_FOCAL=146 pass / 0 fail / 0 error
T13_STAGE3_34_ISOLATED=526 pass / 0 fail / 0 error
T13_STAGE3_34_NORMAL=526 pass / 0 fail / 0 error
T13_STAGE3_34_REVERSED=526 pass / 0 fail / 0 error
T13_STAGE3_PRISMA_VALIDATE=PASS
T13_STAGE3_CLOSEOUT=NO
P2_T13_NEXT_TASK=P2-T13-STAGE4

La revisión confirmó que el detach stale V1 no elimina la generación V2
rotada y que el detach V2 actual sí elimina su binding. P2-T05 permanece
CLOSED; no se reabre ni se absorbe este finding separado.

## F-P0-06 / P2-T13 Stage 4 local commit — 2026-08-26

STATUS: FIX_COMMITTED_LOCAL_AWAITING_POSTCOMMIT_CERTIFICATION
P2_T13_STAGE4_LOCAL_COMMIT=PASS
T13_RACE_B_STATUS=FIX_COMMITTED_LOCAL_AWAITING_POSTCOMMIT_CERTIFICATION
COMMIT=44b9da06ff2fa099cf7eb5fb971b13454f33f308
COMMIT_PARENT=e172cd7ac8245d32db89f96cf6c86ca31bb43cf2
COMMIT_SUBJECT=fix: prevent stale push subscription detach
COMMIT_FILE_COUNT=10
COMMIT_ALLOWLIST_MATCH=SI
PUSH=NO
DEPLOY=NO
P2_T13_CLOSEOUT=NO
P2_T13_NEXT_TASK=P2-T13-STAGE5

Se re-verificó continuidad exacta desde Stage 3 (git preflight, diff
completo, gate focal 146/146) antes de stagear; no se asumió `READY` como
autorización automática. El commit contiene exactamente los 10 paths
certificados, sin schema/migration/package/reportes. Este finding NO queda
`RESOLVED` — falta la recertificación adversarial postcommit/pre-push de
Stage 5 antes de cualquier push. P2-T05 permanece CLOSED, sin reapertura.

## F-P0-06 / P2-T13 Stage 5 postcommit/pre-push adversarial recertification — 2026-08-26

STATUS: FIX_COMMITTED_AND_POSTCOMMIT_CERTIFIED_AWAITING_TESTING_RUNTIME
P2_T13_STAGE5_POSTCOMMIT_PREPUSH_RECERTIFICATION=PASS
T13_RACE_B_STATUS=FIX_COMMITTED_AND_POSTCOMMIT_CERTIFIED
COMMIT=44b9da06ff2fa099cf7eb5fb971b13454f33f308 (sin cambios, sin amend)
PUSH=NO
DEPLOY=NO
P2_T13_CLOSEOUT=NO
REAL_POSTGRES_T13_RUNTIME_REQUIRED_BEFORE_CLOSEOUT=SI
T13_HTTP_RUNTIME_REQUIRED=SI
REAL_WEBPUSH_DELIVERY_REQUIRED_FOR_T13=NO
P2_T13_NEXT_TASK=P2-T13-STAGE6

Recertificación adversarial leyendo directamente los blobs del commit
(`git show HEAD:<path>`), sin confiar en Stage3/Stage4 PASS. Predicate CAS
confirmado atómico (`ownerType+ownerId+channel+endpoint+p256dh+auth`, un
único `deleteMany`, sin select-then-delete). RED reproducido de forma
independiente contra el código real del parent (`HEAD^`) en un worktree
temporal aislado, fuera del repo, usando la firma original string-only:
demuestra que el parent SÍ permite que un detach stale borre la fila V2
vigente. GREEN confirmado contra HEAD (146/146 focal, 526/526/526 en los 34
archivos, 3 órdenes). 0 findings nuevos. Este finding TAMPOCO queda
`RESOLVED` todavía — la corrección está certificada a nivel de código y
tests mockeados, pero requiere certificación runtime contra PostgreSQL real
(concurrencia genuina) y un flujo HTTP mínimo antes de cerrarse; ninguno de
los dos exige envío real de WebPush. P2-T05 permanece CLOSED, sin
reapertura.

## F-P0-06 / P2-T13 Stage 6 push + TESTING deploy + real Postgres/HTTP race certification — 2026-08-26

STATUS: FIX_PUSHED_TESTING_DEPLOYED_REAL_POSTGRES_HTTP_CERTIFIED
P2_T13_STAGE6_TESTING_RUNTIME_CERTIFICATION=PASS
T13_RACE_B_STATUS=FIX_PUSHED_TESTING_DEPLOYED_REAL_POSTGRES_HTTP_CERTIFIED
PUSHED_COMMIT=44b9da06ff2fa099cf7eb5fb971b13454f33f308
PUSH=SI (único fast-forward, exit 0)
DEPLOY=AUTODEPLOY_REAL (DeliGO Copy + chat en vivo, ambos SUCCESS al commit exacto)
DB_REAL_READ=SI DB_REAL_WRITE=SI (exclusivamente TEST_T13_* aislado, vía DELIGO_TEST_DATABASE_URL, sin fallback a DATABASE_URL)
P2_T13_CLOSEOUT=NO
P2_T13_NEXT_TASK=P2-T13-STAGE7

Commit publicado a `origin/testing-codex` y desplegado en TESTING. Dos
certificaciones runtime independientes contra infraestructura real: (A)
repository primitive contra PostgreSQL real de TESTING — sequential stale
(V1 nunca borra V2), current detach (V2 sí se elimina), campaña de 10
rondas concurrentes reales (`Promise.allSettled` sin sleep) con resultado
`FINAL_STATE_ALWAYS_V2` en el 100% de los casos, cross-actor/channel/
multi-device/register-sanity todos PASS; (B) flujo HTTP real autenticado
(actor Cliente TEST vía la función productiva `createSessionWithClient`,
sin bypass de auth) a través de `/api/push/subscribe` +
`/api/push/unsubscribe` desplegados: subscribe V1, rotación a V2, stale
unsubscribe V1 preserva V2 (`removed:false`), current unsubscribe V2 lo
elimina (`removed:true`), malformed fail-closed (400), owner/channel
authority confirmada en runtime. Sin WebPush real, sin Production, sin
5xx/Prisma/fatal nuevos en logs. Cleanup total verificado (0 filas
remanentes, actor TEST eliminado). Este finding TAMPOCO queda `RESOLVED`
— falta el cierre adversarial final de Stage 7 antes de marcar P2-T13
`CLOSED`. P2-T05 permanece CLOSED, sin reapertura.

## F-P0-06 / P2-T13 Stage 7 final adversarial closeout — 2026-08-26

STATUS: RESOLVED_P2_T13_REAL_POSTGRES_HTTP_CERTIFIED
P2_T13_STAGE7_FINAL_CLOSEOUT=PASS
P2_T13=CLOSED
P2_T13_CLOSED=SI
T13_RACE_A_STATUS=ALREADY_RESOLVED_BY_P2_T05
T13_RACE_B_STATUS=RESOLVED_P2_T13_REAL_POSTGRES_HTTP_CERTIFIED
T13_RACE_C_STATUS=SAFE_MODEL_C1_PRESERVED
F_P0_06_STATUS=RESOLVED_P2_T13_REAL_POSTGRES_HTTP_CERTIFIED
NEW_BLOCKING_FINDING_COUNT=0
P2_T13_CLOSEOUT=SI

Cierre adversarial final: se reconstruyó y confrontó toda la cadena
Stage1→Stage6 contra Git real, findings, decisiones/invariantes, test
authority, deploy history y roadmap — no se cerró sólo porque Stage6
declarara `READY`. Los 28 gates de la matriz de cierre (ver
`codex-reports/CURRENT_TASK.md` §CLOSEOUT_GATE_MATRIX) están en PASS. Único
hallazgo: gap de trazabilidad documental de Stage1 (archivo
`P2-T13-STAGE1.md` nunca existió pese a que Stage2 afirmó haberlo creado;
sus conclusiones sobreviven de forma redundante en `COMPLETED_TASKS.md` y
`DECISIONS_AND_INVARIANTS.md`, nunca contradichas) — clasificado NO
bloqueante. P2-T05 permanece CLOSED, sin reapertura. Siguiente tarea
canónica del roadmap: P2-T12 (TerminalOperativa.pushSubscription Cleanup).

## F-P0-05 / P2-T12 Stage 1 current-state audit — 2026-08-26

```
TITLE: TerminalOperativa.pushSubscription — columna inerte, nunca limpiada al revocar terminal
STATUS: CURRENT_STATE_CONFIRMED_DISPOSITION_DROP_INERT_COLUMN (no RESOLVED todavía)
DISCOVERED_IN: P0-T13 / reconfirmado P0-T17 / re-confirmado independientemente en P2-T12-STAGE1
TERMINAL_PUSH_COLUMN_EXISTS=SI
TERMINAL_PUSH_ZERO_PRODUCT_READERS_CURRENT=SI (confirmado por forma exacta de cada query, no sólo grep)
TERMINAL_PUSH_ZERO_PRODUCT_WRITERS_CURRENT=SI (confirmado, incluida toda la historia de git)
TERMINAL_OPERATIVA_ACTIVE_PUSH_RECIPIENT=NO
T12_SUBSUMED_BY_T05=NO (exclusión deliberada y documentada en el comentario de la migración de T05)
P2_T12_DISPOSITION=DROP_INERT_COLUMN_IMPLEMENTATION_REQUIRED
```

Re-confirmado desde cero contra el repo actual, sin asumir el título
histórico ("limpiar al revocar") como la solución correcta. El campo
existe desde el primer commit del feature terminal (`d8ead24`),
byte-idéntico hoy, nunca escrito ni leído por ningún código de producto en
toda la historia de git. La revocación explícita de terminal
(`POST .../revocar`) sigue sin tocar el campo — el gap estructural que el
finding original describía sigue siendo cierto, pero la causa NO es una
omisión: es que nunca hubo nada que limpiar (zero writer). Disposition:
`DROP_INERT_COLUMN` en vez de "clear on revoke", porque limpiar un campo
que nunca se escribe no resuelve ningún riesgo real — sólo eliminar la
columna cierra el footgun estructural. NO se marca `RESOLVED` — falta la
implementación (Stage2+), commit, y certificación. P2-T05 y P2-T13
permanecen `CLOSED`, sin reapertura ni intrusión de alcance.

## F-P0-05 / P2-T12 Stage 2 dead column local removal — 2026-08-26

```
STATUS: DEAD_COLUMN_REMOVAL_IMPLEMENTED_LOCAL_AWAITING_ROLLOUT_CERTIFICATION
P2_T12_STAGE2_LOCAL_IMPLEMENTATION=PASS
T12_SCHEMA_FIELD_REMOVED=SI
T12_PHYSICAL_TABLE_NAME=terminales_salon
T12_PHYSICAL_COLUMN_NAME=pushSubscription
T12_NEW_MIGRATION_COUNT=1
OLD_PRISMA_CLIENT_CAN_SELECT_DROPPED_TERMINAL_PUSH_COLUMN=SI
T12_DEPLOYMENT_STRATEGY=STAGE3_MUST_RESOLVE_BEFORE_COMMIT
COMMIT=NO
```

Removida la línea `pushSubscription String?` de `TerminalOperativa` en
`prisma/schema.prisma`, y creada
`prisma/migrations/20260826230000_drop_terminal_operativa_push_subscription/migration.sql`
(`ALTER TABLE "terminales_salon" DROP COLUMN IF EXISTS "pushSubscription"`)
— ninguna migración aplicada a ninguna DB. Prisma validate/generate, TSC
(0 nuevos diagnósticos), build: todos PASS. Diff puro: 0 archivos de
producción TS/test tocados. Hallazgo material nuevo: 2 de los 11
call-sites productivos de `terminalOperativa` (`activar/route.ts:142`,
`operaciones-terminal-auth.ts:209`) invocan `update()` sin `select`
explícito — el Prisma Client viejo (pre-drop) pediría `pushSubscription`
en su `RETURNING` SQL aunque nunca la lea en JS, lo que podría romper la
transacción de activación de terminal si el DROP se aplica mientras esas
instancias siguen sirviendo tráfico durante un rolling deploy. NO se
modificó código de producto para corregir esto (fuera del allowlist de
Stage2) — se deja como evidencia explícita para que P2-T12-STAGE3 decida
adversarialmente entre ampliar scope o exigir rollout de dos fases. NO se
marca `RESOLVED` — falta la revisión de rollout, commit y certificación
runtime. P2-T05 y P2-T13 permanecen `CLOSED`, sin reapertura.

## F-P0-05 / P2-T12 Stage 3 destructive migration / rolling-deploy compatibility review — 2026-08-26

```
STATUS: DEAD_COLUMN_REMOVAL_LOCAL_VALIDATED_TWO_PHASE_ROLLOUT_REQUIRED
P2_T12_STAGE3_PRECOMMIT_ROLLOUT_REVIEW=PASS
T12_DEPLOYMENT_STRATEGY=TWO_PHASE_CONTRACT_DEPLOY_REQUIRED
T12_STAGE2_COMBINED_DIFF_SAFE_TO_COMMIT_AS_ONE=NO
OLD_PRISMA_CLIENT_CAN_REQUEST_DROPPED_FIELD=SI
T12_OLD_CLIENT_IMPLICIT_COLUMN_RISK_CALL_COUNT=2
COMMIT=NO
```

Auditoría adversarial del diff local de Stage2 (no confió en su PASS
como autorización de commit). Confirmó mecánicamente — vía el tipo
`$TerminalOperativaPayload.scalars` del cliente Prisma generado, sin
conectar a ninguna DB — que 2 de los 11 call-sites productivos reales
(`src/app/api/operaciones/terminal/activar/route.ts:142`,
`src/lib/operaciones-terminal-auth.ts:209`, ambos `update()` sin `select`)
harían que el Prisma Client ya desplegado (commit `44b9da0`) solicite la
columna `pushSubscription` en su `RETURNING` SQL incluso sin leerla en JS.
Sin evidencia de que Railway drene la instancia vieja antes de aplicar el
`preDeploy` DROP, y confirmado que ningún parche de código en un commit
nuevo puede proteger un proceso ya en ejecución, se concluye que el diff
combinado (schema removal + migración DROP) de Stage2 NO es seguro de
commitear/desplegar como una sola unidad. El cleanup local sigue siendo
correcto — sólo debe particionarse en un rollout de contrato de dos fases
(Phase1: sólo remover el campo del schema, sin migración; Phase2: DROP
físico en un commit/deploy separado, sólo tras certificar que ninguna
instancia vieja sigue sirviendo). NO se marca `RESOLVED` — falta preparar,
commitear y certificar ambas fases. P2-T05 y P2-T13 permanecen `CLOSED`,
sin reapertura; P2-T06 y P2-T17 sin intrusión de alcance.

## F-P0-05 / P2-T12 Stage 4A Phase1 contract local preparation — 2026-08-26

```
STATUS: TWO_PHASE_ROLLOUT_PHASE1_LOCAL_PREPARED
P2_T12_STAGE4A_PHASE1_LOCAL_PREPARATION=PASS
T12_PHASE1_TRACKED_DIFF_FILE_COUNT=1
T12_PHASE1_NEW_MIGRATION_COUNT=0
T12_PHASE2_MIGRATION_BLUEPRINT_COMPLETE=SI
COMMIT=NO
```

Preparación local de Phase1: la migración `DROP COLUMN` de Stage2 (nunca
tracked) fue preservada íntegra (SQL completo + SHA-256
`cbd4a4684aceb41895f3d0b47335147c5470c80a90d2c434ecf51bf0ca43623d`) en
`codex-reports/CURRENT_TASK.md` y luego eliminada del árbol activo —
el único diff tracked que queda es la remoción de 1 línea
(`pushSubscription String?`) en `prisma/schema.prisma`. Demostrado
mecánicamente (sin DB, vía `$TerminalOperativaPayload.scalars` del
cliente Prisma regenerado) que el nuevo cliente ya no puede solicitar la
columna en ninguna de las 11 queries productivas reales — incluyendo las 2
que antes tenían riesgo (`activar/route.ts:142`,
`operaciones-terminal-auth.ts:209`), sin haber tocado ningún archivo TS.
Prisma validate/generate, TSC (0 nuevos diagnósticos), build: todos PASS.
Test estático de terminal disponible sin DB: 26/26 pass, sin regresión.
NO se marca `RESOLVED` — falta la revisión adversarial pre-commit de
Phase1 (Stage4B), el commit, el push/deploy, y la certificación de que
ninguna instancia previa a Phase1 sigue sirviendo antes de habilitar
Phase2. P2-T05 y P2-T13 permanecen `CLOSED`, sin reapertura.

## F-P0-05 / P2-T12 Stage 4B Phase1 schema-only pre-commit adversarial review — 2026-08-26

```
STATUS: TWO_PHASE_ROLLOUT_PHASE1_PRECOMMIT_CERTIFIED
P2_T12_STAGE4B_PHASE1_PRECOMMIT_REVIEW=PASS
P2_T12_PHASE1_COMMIT_ALLOWLIST=prisma/schema.prisma
P2_T12_PHASE1_COMMIT_FILE_COUNT=1
P2_T12_PHASE1_PROPOSED_COMMIT_SUBJECT=chore: remove dead terminal push field
COMMIT=NO
```

Revisión adversarial pre-commit de la Phase1 schema-only. No aceptó el
`PASS`/`READY` de Stage4A como autorización de commit — re-derivó desde
cero los 11 call-sites productivos, re-confirmó mecánicamente (sin DB, vía
`$TerminalOperativaPayload.scalars`) que el cliente Prisma regenerado ya
no puede solicitar `pushSubscription` para ninguna de las 11 queries
—incluidas las 2 antes riesgosas, confirmadas byte-idénticas a `HEAD`, sin
`select` agregado—, y re-confirmó que la migración DROP de Stage2 (nunca
tracked) sigue completamente ausente del árbol activo, con su blueprint
(SQL completo + SHA-256) intacto para Phase2. Prisma validate/generate,
TSC (0 nuevos diagnósticos), build, y el test de terminal ejecutable sin
DB (26/26): todos PASS, sin drift de herramientas. El diff certificado
para commit es exactamente 1 archivo (`prisma/schema.prisma`, 1 línea).
NO se marca `RESOLVED` — falta el commit local, el push/deploy de Phase1,
y la certificación de que ninguna instancia previa sigue sirviendo antes
de habilitar Phase2. P2-T05 y P2-T13 permanecen `CLOSED`, sin reapertura.

## F-P0-05 / P2-T12 Stage 4C Phase1 local commit — 2026-08-26

```
STATUS: TWO_PHASE_ROLLOUT_PHASE1_COMMITTED_LOCAL
P2_T12_STAGE4C_PHASE1_LOCAL_COMMIT=PASS
T12_PHASE1_COMMIT_HASH=bebd36c841f588fc9e4c74099e38a95d37d58982
T12_PHASE1_COMMIT_PARENT=44b9da06ff2fa099cf7eb5fb971b13454f33f308
T12_PHASE1_COMMIT_SUBJECT=chore: remove dead terminal push field
T12_STAGE4C_COMMIT_FILE_COUNT=1
T12_STAGE4C_COMMIT_ONLY_PATH=prisma/schema.prisma
T12_STAGE4C_COMMITTED_SCHEMA_FIELD_ABSENT=SI
T12_STAGE4C_QUICK_TERMINAL_TEST=26 pass / 0 fail / 0 error
PRISMA_VALIDATE_T12_STAGE4C=PASS
T12_STAGE4C_ACTIVE_DROP_MIGRATION_PRESENT=NO
T12_STAGE4C_PHASE2_ALLOWED_NOW=NO
P2_T12_CLOSED=NO
PUSH=NO
DEPLOY=NO
```

Phase1 contiene únicamente la eliminación certificada del campo muerto en el
schema. El hallazgo no se marca CLOSED: Phase2, push/deploy y la certificación
post-commit/pre-push siguen pendientes.

## F-P0-05 / P2-T12 Stage 4D Phase1 post-commit review — 2026-08-26

```
STATUS: TWO_PHASE_ROLLOUT_PHASE1_POSTCOMMIT_CERTIFIED
P2_T12_STAGE4D_PHASE1_POSTCOMMIT_PREPUSH_REVIEW=PASS
T12_PHASE1_COMMIT_HASH=bebd36c841f588fc9e4c74099e38a95d37d58982
T12_PHASE1_COMMIT_PARENT=44b9da06ff2fa099cf7eb5fb971b13454f33f308
T12_PHASE1_COMMIT_SUBJECT=chore: remove dead terminal push field
T12_STAGE4D_COMMIT_FILE_COUNT=1
T12_STAGE4D_COMMIT_ONLY_PATH=prisma/schema.prisma
T12_STAGE4D_PARENT_FIELD_PRESENT=SI
T12_STAGE4D_COMMIT_FIELD_ABSENT=SI
T12_STAGE4D_COMMIT_CONTAINS_T12_MIGRATION=NO
T12_STAGE4D_GENERATED_CLIENT_HAS_PUSH_SCALAR=NO
T12_STAGE4D_TERMINAL_QUERY_CALLSITE_COUNT=11
T12_STAGE4D_TERMINAL_TEST=26 pass / 0 fail / 0 error
PRISMA_VALIDATE_T12_STAGE4D=PASS
PRISMA_GENERATE_T12_STAGE4D=PASS
T12_STAGE4D_BUILD=PASS
T12_STAGE4D_PHASE2_ALLOWED_NOW=NO
PUSH=NO
DEPLOY=NO
P2_T12_CLOSED=NO
```

El commit exacto es compatible con Phase1: la aplicación deja de conocer el
campo mientras la columna física permanece disponible. El hallazgo queda
post-commit certificado, no CLOSED; Stage4E debe realizar el push/deploy
TESTING y certificar el drain de instancias antiguas antes de Phase2.

## F-P0-05 / P2-T12 Stage4E Phase1 testing certification — 2026-08-26

```
STATUS=TWO_PHASE_ROLLOUT_PHASE1_TESTING_CERTIFIED
P2_T12_STAGE4E_PHASE1_TESTING_CERTIFICATION=PASS
PUSH_COUNT=1
PUSH_RESULT=PASS
COMMIT=bebd36c841f588fc9e4c74099e38a95d37d58982
ORIGIN_TESTING_CODEX=bebd36c841f588fc9e4c74099e38a95d37d58982
TESTING_DEPLOYMENT_COMMIT_EXACT=SI
TESTING_DEPLOYMENT_STATUS=SUCCESS
T12_PHASE1_OLD_INSTANCE_DRAIN_CERTIFIED=SI
OLD_INSTANCE_STATE=REMOVED
CURRENT_INSTANCE_STATE=RUNNING
PHYSICAL_COLUMN_PRE=SI
PHYSICAL_COLUMN_POST=SI
T12_DROP_APPLIED=NO
FAILED_MIGRATIONS_PRE=0
FAILED_MIGRATIONS_POST=0
T12_MIGRATION_HISTORY_COUNT=0
TERMINAL_RUNTIME_SMOKE=PASS
TERMINAL_RUNTIME_ACTIVATION=PASS
TERMINAL_RUNTIME_AUTH=PASS
TERMINAL_RUNTIME_REVOCATION=PASS
TERMINAL_RUNTIME_NEGATIVE_CHECK=PASS
TERMINAL_PUSH_SEND=NO
FIXTURE_PREFIX=TEST_T12_PHASE1_
FIXTURE_CLEANUP=PASS
FIXTURE_REMAINDER=0
P2_T12_CLOSED=NO
T12_PHASE2_ALLOWED_AFTER_STAGE4E=SI
NEXT_TASK_ID=P2-T12-STAGE5A
```

El hallazgo F-P0-05 queda certificado para Phase1 en TESTING, pero no se marca
como cerrado porque el DROP físico de Phase2 aún no fue ejecutado.

## F-P0-05 / P2-T12 Stage5A Phase2 local prepared — 2026-08-26

```
STATUS=TWO_PHASE_ROLLOUT_PHASE2_MIGRATION_LOCAL_PREPARED
P2_T12_STAGE5A_PHASE2_LOCAL_MIGRATION_RECREATION=PASS
T12_PHASE1_COMMIT_IDENTITY=PASS
T12_PHASE1_SCHEMA_PUSH_FIELD_ABSENT=SI
T12_STAGE5A_BLUEPRINT_ARCHIVE_CHAIN_COMPLETE=SI
T12_PHASE2_MIGRATION_PATH=prisma/migrations/20260826230000_drop_terminal_operativa_push_subscription/migration.sql
T12_PHASE2_MIGRATION_SHA256=cbd4a4684aceb41895f3d0b47335147c5470c80a90d2c434ecf51bf0ca43623d
T12_PHYSICAL_TABLE_NAME=terminales_salon
T12_PHYSICAL_COLUMN_NAME=pushSubscription
T12_STAGE5A_TRACKED_MIGRATION_COUNT_BEFORE=26
T12_STAGE5A_NEW_MIGRATION_COUNT=1
T12_STAGE5A_BLUEPRINT_DIRECTORY_REUSED=SI
T12_STAGE5A_BLUEPRINT_HASH_MATCH=SI
T12_STAGE5A_BLUEPRINT_BYTE_REPRODUCTION=PASS_BY_SHA256
T12_STAGE5A_MIGRATION_STATEMENT_COUNT=1
T12_STAGE5A_SCHEMA_MUTATION=NO
T12_STAGE5A_PRODUCT_SOURCE_MUTATION=NO
T12_STAGE5A_TEST_MUTATION=NO
DB_REAL_READ=NO
DB_REAL_WRITE=NO
MIGRATION_APPLIED=NO
P2_T12_CLOSED=NO
NEXT_TASK_ID=P2-T12-STAGE5B
```

La Phase2 queda preparada localmente, no cerrada: existe una única migration
DROP nueva y pendiente de revisión adversarial precommit.

## F-P0-05 / P2-T12 Stage5C Phase2 local commit — 2026-08-26

```
STATUS=TWO_PHASE_ROLLOUT_PHASE2_MIGRATION_COMMITTED_LOCAL
P2_T12_STAGE5C_PHASE2_LOCAL_COMMIT=PASS
COMMIT=7822d84ac5ac841978a77ebef76ad93630b69f42
PARENT=bebd36c841f588fc9e4c74099e38a95d37d58982
SUBJECT=chore: remove dead terminal push column
COMMIT_FILE_COUNT=1
COMMIT_PATH=prisma/migrations/20260826230000_drop_terminal_operativa_push_subscription/migration.sql
MIGRATION_SHA256=cbd4a4684aceb41895f3d0b47335147c5470c80a90d2c434ecf51bf0ca43623d
MIGRATION_BYTES=2134
EXECUTABLE_SQL_STATEMENT_COUNT=1
SCHEMA_SOURCE_TEST_MUTATION=NO
DB_REAL_READ=NO
DB_REAL_WRITE=NO
MIGRATION_APPLIED=NO
PUSH=NO
DEPLOY=NO
RAILWAY_MUTATION=NO
PRODUCTION=NO
P2_T12_CLOSED=NO
NEXT_TASK_ID=P2-T12-STAGE5D
```

El hallazgo queda con Phase2 committeada únicamente en local. La revisión
post-commit/pre-push y cualquier aplicación siguen siendo gates separados.

## F-P0-05 / P2-T12 Stage5D post-commit/pre-push certification — 2026-08-26

```
STATUS=TWO_PHASE_ROLLOUT_PHASE2_POSTCOMMIT_CERTIFIED
P2_T12_STAGE5D_PHASE2_POSTCOMMIT_PREPUSH_REVIEW=PASS
COMMIT=7822d84ac5ac841978a77ebef76ad93630b69f42
PARENT=bebd36c841f588fc9e4c74099e38a95d37d58982
SUBJECT=chore: remove dead terminal push column
COMMIT_FILE_COUNT=1
COMMIT_PATH=prisma/migrations/20260826230000_drop_terminal_operativa_push_subscription/migration.sql
COMMITTED_BLOB_ID=52501817c39ba4c3979ba0f77c687cd518c298ef
COMMITTED_BYTES=2134
COMMITTED_SHA256=cbd4a4684aceb41895f3d0b47335147c5470c80a90d2c434ecf51bf0ca43623d
PHYSICAL_TARGET=terminales_salon.pushSubscription
PHASE1_PARENT_SCHEMA_FIELD_ABSENT=SI
PHASE2_SCHEMA_EQUALS_PHASE1=SI
NEW_MIGRATION_COUNT=1
HISTORICAL_MIGRATION_MODIFICATION_COUNT=0
PRISMA_VALIDATE=PASS
DB_REAL_READ=NO
DB_REAL_WRITE=NO
MIGRATION_APPLIED=NO
PUSH=NO
DEPLOY=NO
RAILWAY_MUTATION=NO
PRODUCTION=NO
P2_T12_CLOSED=NO
NEXT_TASK_ID=P2-T12-STAGE5E
```

Stage5D certifica que el commit exacto merece llegar al gate de TESTING. La
aplicación destructiva y la certificación runtime permanecen exclusivamente
en Stage5E.

## F-P0-05 / P2-T12 Stage5E TESTING drop and runtime certification — 2026-08-26

```
STATUS=TWO_PHASE_ROLLOUT_PHASE2_TESTING_CERTIFIED_AWAITING_CLOSEOUT
P2_T12_STAGE5E=PASS
REQUIRED_ENV_EXISTS=SI
REQUIRED_ENV_VALUE_PRINTED=NO
DATABASE_URL_FALLBACK=NO
PRE_FAILED_MIGRATION_COUNT=0
PRE_PENDING_MIGRATION_COUNT=1
PRE_PENDING_MIGRATION=20260826230000_drop_terminal_operativa_push_subscription
PRE_HISTORY_COUNT=0
PRE_PHYSICAL_COLUMN_EXISTS=SI
PUSH_COUNT=1
PUSH_RESULT=PASS_FAST_FORWARD
DEPLOYMENT_ID=cf5cca9a-e5f3-4a35-8b56-d6b90ec0c2b9
DEPLOYMENT_COMMIT=7822d84ac5ac841978a77ebef76ad93630b69f42
DEPLOYMENT_STATUS=SUCCESS
PREDEPLOY_APPLIED_EXACT_MIGRATION=SI
POST_HISTORY_COUNT=1
POST_SUCCESSFUL_COUNT=1
POST_FAILED_COUNT=0
POST_PENDING_COUNT=0
POST_PHYSICAL_COLUMN_EXISTS=NO
RUNTIME_SMOKE=PASS
REPLAY_400=SI
REVOKED_CONTEXT_401=SI
SALONACTIVO_EXPOSED=NO
TERMINAL_PUSH_SIDE_EFFECT=NO
WEBPUSH=NO
FIXTURE_CLEANUP=PASS
FIXTURE_ROWS_REMAINING=0
POSTDROP_LOG_GATE=PASS
PRODUCTION=NO
P2_T12_CLOSED=NO
NEXT_ACTION=P2-T12-STAGE5F FINAL CLOSEOUT / CROSS-REGISTRY RECONCILIATION
```

El DROP físico se ejecutó únicamente en TESTING después de certificar la
Phase1. El deployment nuevo arrancó sano y el deployment Phase1 anterior
quedó `REMOVED`. El smoke autenticado validó creación/activación, rechazo de
replay, revocación y rechazo de contexto; la fixture fue eliminada por ID
exacto y la verificación final dejó cero filas de negocio, terminal y
auditoría. No se introduce un nuevo finding bloqueante.

## F-P0-05 — RESOLVED / P2-T12 CLOSED — 2026-08-26

```
F_P0_05_STATUS=RESOLVED
P2_T12=CLOSED
P2_T12_FINAL_STATUS=CLOSED_AFTER_TWO_PHASE_SCHEMA_AND_PHYSICAL_COLUMN_REMOVAL_TESTING_CERTIFICATION
T12_STAGE5F_F_P0_05_RESOLUTION_MATRIX=PASS
T12_STAGE5F_P2_T12_CLOSURE_MATRIX=PASS
T12_STAGE5F_OPEN_T12_BLOCKING_FINDING_COUNT=0
SCHEMA_FIELD_ABSENT=SI
PHYSICAL_COLUMN_ABSENT=SI
PRODUCTIVE_RUNTIME_READER_COUNT=0
PRODUCTIVE_RUNTIME_WRITER_COUNT=0
MIGRATION_HISTORY_COUNT=1
MIGRATION_SUCCESSFUL_COUNT=1
PENDING_MIGRATION_COUNT=0
FAILED_MIGRATION_COUNT=0
PHASE2_DEPLOY_HEALTH=PASS
TERMINAL_RUNTIME=PASS
FIXTURE_CLEANUP=PASS
NO_TERMINAL_PUSH_FEATURE=SI
BACKFILL_REQUIRED=NO
```

Resolución precisa: Phase1 eliminó el field del Prisma schema/client y Phase2
eliminó la columna física en TESTING con la migration exacta. La terminal
conservó sus flujos autorizados, no se introdujo un actor Push terminal y no
queda deuda residual de datos. No se cierran ni alteran findings de otras
tareas.

## P2-T11 — Native socket post-logout residual access — 2026-08-26

```
FINDING_ID=F-P2-T11-01
STATUS=CURRENT_STATE_AUDITED_HARDENING_REQUIRED
CLASS=POSTLOGOUT_RESIDUAL_ACCESS_REQUIRES_HARDENING
SEVERITY=MEDIUM
ACTOR_TOKEN_TTL_SECONDS=300
ROOM_CAPABILITY_TTL_SECONDS=120
CONNECT_SESSION_RECHECK=NO
SERVER_REVOCATION_CHECK=NO
OLD_ACTOR_TOKEN_REUSABLE_POSTLOGOUT=SI
OLD_ROOM_CAPABILITY_REUSABLE_POSTLOGOUT=SI
EXISTING_SOCKET_DISCONNECT=PARTIAL
MULTI_TAB_PROPAGATION=NO_GARANTIZADA
LOGOUT_SCOPE=CURRENT_SESSION
```

La evidencia actual es `src/app/api/realtime/token/route.ts`,
`src/app/api/realtime/authorize/route.ts`, `src/lib/realtime-auth.ts`,
`src/lib/realtime-manager.ts`, `src/hooks/use-auth.ts`,
`src/app/api/auth/logout/route.ts` y `mini-services/chat-service/index.js`.
El chat service valida JWT/exp/scopes en memoria y no reconsulta `Sesion` ni
recibe un evento de revocación. El logout evita nuevas emisiones HTTP al borrar
la sesión actual y detiene el manager de la pestaña actual, pero no invalida
credenciales previamente emitidas en otras conexiones. El actor JWT puede
reconectar hasta su `exp` restante (máximo 300 s desde emisión) y una room
capability puede reutilizarse hasta su `exp` restante (máximo 120 s).

La corrección requiere separar prevención de reconnect de terminación de
sockets vivos. La terminación multi-instancia exige un contrato distribuido;
su transporte/fan-out general permanece en P2-T09. No se crea schema ni
migration especulativa. Stage1B debe seleccionar introspection, epoch/JTI store
o evento distribuido y recién entonces congelar el allowlist de Stage2.

## P2-T11 — Stage 1B design freeze (actualiza F-P2-T11-01) — 2026-08-26

```
FINDING_ID=F-P2-T11-01
STATUS=DESIGN_FROZEN_H1_HYBRID_SELECTED_AWAITING_IMPLEMENTATION
CLASS=POSTLOGOUT_RESIDUAL_ACCESS_REQUIRES_HARDENING
SEVERITY=MEDIUM (sin cambio)
SELECTED_DESIGN_ID=H1
TARGET_SOCKET_ACTOR_TTL_SECONDS=120 (antes 300)
TARGET_ROOM_CAP_TTL_SECONDS=120 (sin cambio)
FRESH_RECONNECT_POSTLOGOUT_POLICY=IMMEDIATE_REJECT
EXISTING_SOCKET_DISTRIBUTED_POLICY=BOUNDED_BY_REDUCED_TTL_DEFERRED_TO_T09
REVOCATION_MODEL=IMMEDIATE_NEW_CONNECT_REJECTION_WITH_EXISTING_SOCKET_DISTRIBUTED_DEBT
SCHEMA_CHANGE_REQUIRED=NO
MIGRATION_REQUIRED=NO
NEW_PACKAGE_REQUIRED=NO
NEW_SERVICE_REQUIRED=NO
```

Stage1B congeló el diseño completo, sin dejar ningún ítem `UNRESOLVED`:
reconnect fresco queda bloqueado de inmediato vía un nuevo chequeo de
sesión en connect-time (endpoint interno HMAC monolito↔chat-service, reusa
el patrón ya certificado de `src/lib/realtime-publish.ts`), aprovechando
que el claim `sid` ya es literalmente `Sesion.id` — sin necesidad de
ningún campo o migration nuevos. El TTL del actor baja de 300s a 120s como
cota del residual de un socket ya conectado antes del logout; el TTL de
room-capability queda sin cambio (ya acotado, ya sincronizado). Se agrega
un listener nativo de evento `storage` para propagación de logout entre
pestañas del mismo browser (gap que Stage1 había marcado
`NO_GARANTIZADA`). La terminación forzada e inmediata de un socket YA
conectado en otra instancia del chat-service queda explícitamente fuera de
T11 y es el mandato de P2-T09 — frontera documentada con detalle en
`codex-reports/CURRENT_TASK.md` §T09_BOUNDARY. Detalle completo (matriz de
seguridad de 9 escenarios, inventario de archivos, contrato de tests,
modelado de razas, rollout de dos fases y compatibilidad de rollback) en
`codex-reports/CURRENT_TASK.md`. Este finding sigue sin `RESOLVED` — el
diseño está congelado, la implementación (P2-T11-STAGE2) no ha comenzado.
No se modificó código, schema, tests, Git ni Railway en esta tarea.

## P2-T11 — Stage 1B-R1 connected-socket lifetime reconciliation (actualiza F-P2-T11-01) — 2026-08-26

```
FINDING_ID=F-P2-T11-01
STATUS=DESIGN_FROZEN_H1_RECONCILED_CONNECTED_SOCKET_BOUND_PROVEN
CLASS=POSTLOGOUT_RESIDUAL_ACCESS_REQUIRES_HARDENING
SEVERITY=MEDIUM (sin cambio)
EXISTING_SOCKET_TTL_BOUND_CLAIM=VALID
CONNECTED_SOCKET_ENFORCES_TOKEN_EXPIRY=SI (mecanismo pre-existente, no nuevo)
EXISTING_SOCKET_MAX_RESIDUAL_SECONDS=120 (target; medido desde la EMISIÓN del token, no desde el logout)
```

Esta tarea auditó una posible contradicción en el diseño H1 de Stage1B:
reducir el TTL del JWT a 120s no acota por sí solo un socket ya conectado,
salvo que exista un mecanismo server-side que lo desconecte al llegar
`exp`. La auditoría confirmó, tanto por lectura de código como por la
ejecución real del test existente
`mini-services/chat-service/test/security.test.js` ("disconnects an
already-connected socket when the actor token expires", 12/12 PASS en
esta tarea), que ese mecanismo YA EXISTE en producción
(`mini-services/chat-service/index.js:327-332`, un `setTimeout`
programado en connect-time usando el `exp` real del JWT, no un valor
inventado). El claim de Stage1B queda `VALID`, con una corrección de
redacción: el residual máximo de un socket ya conectado se mide desde la
EMISIÓN del token, no desde el instante del logout — puede acercarse al
TTL completo (120s tras Stage2) si el logout ocurre justo después de
conectar, o ser casi nulo si ocurre cerca del fin natural del token. La
frontera con P2-T09 (terminación forzada instantánea cross-instance) se
mantiene sin cambios: T11 provee un acotamiento por TTL ya vigente hoy;
T09 provee terminación inmediata antes del vencimiento natural. Detalle
completo (inventario post-connect, tabla de eventos, matriz de residual
por escenario) en `codex-reports/CURRENT_TASK.md`. Sin cambios de código,
schema, tests, Git ni Railway — sólo se ejecutó un test ya existente para
verificación (sin modificarlo).

## P2-T11 — Stage 2 implementation contract freeze (actualiza F-P2-T11-01) — 2026-08-26

```
FINDING_ID=F-P2-T11-01
STATUS=IMPLEMENTATION_CONTRACT_FROZEN_READY_FOR_PHASE_A
SEVERITY=MEDIUM (sin cambio)
ROLLOUT_PHASE_COUNT=3
SECRET_POLICY=NEW_DEDICATED_SECRET (REALTIME_SESSION_CHECK_SECRET)
```

Congeló la especificación de implementación completa del diseño H1 sin
dejar decisiones abiertas: endpoint interno `POST /api/internal/realtime/
session` (HMAC dedicado, nunca reusa `REALTIME_INTERNAL_PUBLISH_SECRET`
tras un análisis explícito de expansión de privilegio — un chat-service
comprometido ganaría, por primera vez, un canal autenticado hacia el
monolito si se reusara ese secreto); nuevo helper de sólo lectura
`isSesionActiveById` en `src/lib/auth.ts` (misma regla de vigencia que
`validateSession`, sin el borrado lazy-expiry); tres fases de rollout
(A=autoridad monolito inerte, B=enforcement chat-service — requiere A
vivo, C=TTL 120 + propagación cross-tab vía la key `deligo-auth` YA
existente de Zustand persist, sin key nueva); matriz de compatibilidad
con un único caso UNSAFE identificado y evitado por el orden de rollout;
4 modelos de carrera clasificados sin prometer linealizabilidad falsa
(las conexiones aceptadas en una carrera quedan acotadas por el mismo TTL
ya reconocido, nunca un hueco nuevo). Detalle completo (allowlist exacto
por fase, contrato de tests, matriz de rollback, env vars nuevas) en
`codex-reports/CURRENT_TASK.md`. Este finding sigue sin `RESOLVED` — el
contrato de implementación está congelado, pero P2-T11-STAGE3A
(implementación real de Phase A) no ha comenzado. No se modificó código,
schema, tests, Git ni Railway en esta tarea.

## P2-T11 — Stage 3A Phase A local implementation (actualiza F-P2-T11-01) — 2026-08-26

```
FINDING_ID=F-P2-T11-01
STATUS=PHASE_A_LOCAL_IMPLEMENTED_AWAITING_PRECOMMIT_REVIEW
SEVERITY=MEDIUM (sin cambio)
PHASE_A_FILES=4 (3 nuevos + 1 modificado)
PHASE_A_TESTS=14/14 PASS
PHASE_B_ENFORCEMENT_ACTIVE=NO
SOCKET_ACTOR_TTL_SECONDS=300 (sin cambio, Phase C pendiente)
```

Implementó localmente, EXCLUSIVAMENTE, Phase A del contrato de Stage2: el
helper `isSesionActiveById` en `src/lib/auth.ts` (misma regla de
`validateSession`, sólo lectura), el endpoint interno
`POST /api/internal/realtime/session` (`src/app/api/internal/realtime/
session/route.ts`) y su verificación HMAC dedicada
(`src/lib/internal-session-check-auth.ts`, secreto
`REALTIME_SESSION_CHECK_SECRET`, NUNCA reusa el del bridge de publish
existente). 14/14 tests nuevos PASS; 0 errores nuevos de TSC (baseline 31
sin cambio) ni de ESLint; `next build` PASS con la ruta nueva presente en
el manifiesto. Confirmado explícitamente: el chat-service permanece sin
ningún cambio (`mini-services/**` intacto), el TTL del actor sigue en
300s, y el listener cross-tab no existe todavía — la autoridad nueva es
completamente INERTE, nada la invoca aún. Diff exacto = subset idéntico
al allowlist de Phase A (4 archivos), sin tocar schema/migration/package.
Este finding sigue sin `RESOLVED` — Phase A está implementada localmente,
sin commit/push/deploy; falta la revisión adversarial pre-commit
(Stage3B) antes de siquiera considerar un commit local.

## P2-T11 — Stage 3B Phase A pre-commit adversarial review (actualiza F-P2-T11-01) — 2026-08-26

```
FINDING_ID=F-P2-T11-01
STATUS=PHASE_A_PRECOMMIT_CERTIFIED_READY_FOR_LOCAL_COMMIT
SEVERITY=MEDIUM (sin cambio)
ADVERSARIAL_ISSUES_FOUND=0
PROPOSED_COMMIT_SUBJECT=feat: add internal realtime session validation endpoint
```

Auditoría adversarial de los 4 archivos locales de Phase A, con el
mandato explícito de intentar demostrar que la implementación estaba
mal. No se confió en el `14/14 PASS`/`BUILD=PASS` de Stage3A: se
releyeron los 4 archivos completos, se re-ejecutaron tests/lint/TSC/
build de forma independiente (mismos resultados exactos), y se ejecutó
un script adversarial temporal (fuera de commit, eliminado
inmediatamente tras usarse) con un mock de `db.sesion.findUnique` que
cuenta invocaciones, cubriendo 19 casos nuevos: secreto de firma
incorrecto, corrupción de un carácter de una firma real, tamper del body
manteniendo la firma original, timestamps viejos/futuros dentro y fuera
de la ventana de skew, secreto ausente/corto, excepción del lookup de
sesión, y varias formas de body malformado (array, null, `sid` numérico/
gigante/con caracteres de path-traversal/intento de contaminación vía
`__proto__`) — los 19 casos confirmaron rechazo correcto con CERO
lecturas de sesión en cada caso inválido, y fail-closed genuino ante
excepción (nunca `{valid:true}` por defecto). Ningún auth bypass, fail-
open, debilidad de canonicalización/replay, reuso de secreto,
enumeración de sesión, consulta DB antes de autenticar, fuga en
respuesta/logs, scope drift ni activación prematura de Phase B fue
encontrado. Única observación no bloqueante: el propio test "tampered
signature" de Stage3A usaba una firma trivialmente inválida en vez de un
bit-flip de una firma genuina — cerrado por el script adversarial de
esta tarea sin modificar el archivo de test. Certificado listo para
commit local exacto de los mismos 4 archivos. Este finding sigue sin
`RESOLVED` — falta el commit local (Stage3C), y luego el resto del
rollout de Phase A/B/C antes de cualquier cierre.

## P2-T11 — Stage 3C Phase A exact local commit (actualiza F-P2-T11-01) — 2026-08-26

```
FINDING_ID=F-P2-T11-01
STATUS=PHASE_A_LOCAL_COMMIT_COMPLETE_AWAITING_POSTCOMMIT_PREPUSH_REVIEW
SEVERITY=MEDIUM (sin cambio)
COMMIT=d0ba59dccfdd51a4aa5705d0e76d2e84ba4867d1
COMMIT_PARENT=7822d84ac5ac841978a77ebef76ad93630b69f42
COMMIT_SUBJECT=feat: add internal realtime session validation endpoint
COMMIT_FILE_COUNT=4
PUSH=NO
```

Convirtió la implementación de Phase A (ya certificada adversarialmente
en Stage3B) en exactamente un commit local, sin modificar producto.
Stage exacto de los 4 paths permitidos (`git add -- <4 paths>`, nunca
`-A`/`.`), auditoría inmediata del índice (4 archivos, sin reportes/
`32`/schema/chat-service), commit único (`exit 0`, sin amend, sin
segundo intento), y verificación posterior leyendo directamente los
blobs del commit (no el working tree) para confirmar que el contenido
committeado es idéntico al certificado y que TTL/cross-tab/chat-service
permanecen sin cambio en `HEAD`. `AHEAD=1`/`BEHIND=0` respecto de
`origin/testing-codex`, que no cambió durante la tarea. Este finding
sigue sin `RESOLVED` — falta la revisión post-commit/pre-push
(Stage3D) antes de cualquier push, y luego el resto del rollout de
Phase A/B/C.

## P2-T11 — Stage 3D Phase A post-commit/pre-push exact-blob review (actualiza F-P2-T11-01) — 2026-08-26

```
FINDING_ID=F-P2-T11-01
STATUS=PHASE_A_POSTCOMMIT_CERTIFIED_READY_FOR_TESTING_PUSH
SEVERITY=MEDIUM (sin cambio)
COMMIT=d0ba59dccfdd51a4aa5705d0e76d2e84ba4867d1
COMMIT_PARENT=7822d84ac5ac841978a77ebef76ad93630b69f42
TREE_HASH=2beb452fb73bcf0e7aa0817b86b41d56e2fc6d9a
AHEAD=1 BEHIND=0
PUSH=NO
```

Recertificó el commit local `d0ba59d` directamente desde los objetos
Git — nunca desde el working tree ni desde la confianza en Stage3B. Los
4 blobs (IDs derivados vía `git ls-tree HEAD`) fueron leídos completos
vía `git show HEAD:<path>`, confirmando contenido byte-idéntico al
certificado: helper `isSesionActiveById` (misma regla de `validateSession`,
sólo lectura), endpoint `POST /api/internal/realtime/session` con orden
de validación HMAC-antes-que-DB, secreto dedicado
`REALTIME_SESSION_CHECK_SECRET` (cero fallback, `git grep` sobre el
árbol de `HEAD` confirma que ningún otro archivo del repo lo lee), y 14
tests sin `.skip`/`.only`/`.todo`. Re-ejecutó de forma independiente:
test focal (14/14 PASS), lint (0 errores), TSC (31 baseline sin cambio,
0 nuevos), build (`next build` PASS, ruta presente en el manifiesto), y
un script adversarial temporal (19/19 PASS, creado y eliminado dentro de
la misma tarea, nunca stageado). Confirmó, vía `git grep` directo sobre
`HEAD` (no el working tree), que Phase A permanece completamente inerte
— cero referencias desde `mini-services/**` o cualquier código cliente.
Confirmó desde los blobs que TTL del actor sigue en 300s, room-cap en
120s, y no existe listener cross-tab. `AHEAD=1`/`BEHIND=0` respecto de
`origin/testing-codex`, que no cambió. Certificado listo para el push a
TESTING de Stage3E. Este finding sigue sin `RESOLVED` — falta el push,
el despliegue y la certificación runtime antes de cualquier cierre.

## P2-T11 — Stage 3E Phase A testing push + deploy certification (actualiza F-P2-T11-01) — 2026-08-27

```
FINDING_ID=F-P2-T11-01
STATUS=PHASE_A_DEPLOYED_TESTING_CERTIFIED_READY_FOR_NEXT_ROLLOUT_GATE
SEVERITY=MEDIUM (sin cambio)
COMMIT=d0ba59dccfdd51a4aa5705d0e76d2e84ba4867d1
DELIGO_COPY_DEPLOYMENT_ID=2b86f710-2c73-4423-ac28-2e850b0a8f6a
DEPLOYMENT_STATUS=SUCCESS
SESSION_SECRET_CONFIGURATION=KNOWN_ABSENT
AHEAD=0 BEHIND=0
PUSH=SI (1)
```

Publicó exactamente el commit `d0ba59d` a `origin/testing-codex` con un
único push, observó el autodeploy Git-triggered de `DeliGO Copy` y `chat
en vivo` (ambos `SUCCESS`), y certificó Phase A desplegada y sana. Un
único probe seguro no autenticado contra el endpoint nuevo devolvió
`503` (`AUTH_UNAVAILABLE`), revelando de forma determinística — sin
`railway variables` — que `REALTIME_SESSION_CHECK_SECRET` sigue ausente
en TESTING; el monolito permanece sano de todos modos (diseño
intencional de Phase A: fail-closed sin degradar la app normal).
Chat-service confirmado sin llamadas al endpoint nuevo (Phase A sigue
inerte). TTL/room-cap/cross-tab sin drift. Sin mutación de Railway, sin
DB real, Production intacta. Este finding sigue sin `RESOLVED` — falta
Phase B (implementación, revisión, commit) y luego el gate de secreto
antes de cualquier cierre.

## P2-T11 — Stage 4A Phase B local implementation (actualiza F-P2-T11-01) — 2026-08-27

```
FINDING_ID=F-P2-T11-01
STATUS=PHASE_B_LOCAL_IMPLEMENTED_AWAITING_PRECOMMIT_SECURITY_REVIEW
SEVERITY=MEDIUM (sin cambio)
PHASE_B_FILES=5 (2 nuevos + 3 modificados, incluye 1 desviación de allowlist documentada)
PHASE_B_TESTS=98/98 PASS
PHASE_B_ENFORCEMENT_ACTIVE_TESTING=NO (local only)
SOCKET_ACTOR_TTL_SECONDS=300 (sin cambio, Phase C pendiente)
```

Implementó localmente Phase B del contrato Stage2: `internal-session-
check-client.js` (nuevo, firmante HMAC dedicado), `io.use()` del
chat-service ahora exige — tras la verificación JWT local — que Phase A
confirme la `Sesion` activa, con timeout 400ms + 1 retry, fail-closed en
cada rama, sin fuga del motivo interno al cliente. 29 tests nuevos + 12
+ 57 existentes = 98/98 PASS. Descubrió que `internal-publish.test.js`
(fuera del allowlist congelado de Stage2) comparte el mismo call site de
producción y necesitaba el mismo stub de una línea que `security.test.js`
para no romperse por el nuevo fail-closed por defecto — corregido y
documentado íntegro para revisión independiente en Stage4B (no se dio
por buena la propia justificación). Este finding sigue sin `RESOLVED` —
Phase B está implementada localmente, sin commit/push/deploy; falta la
revisión adversarial pre-commit (Stage4B).

## P2-T11 — Stage 4B Phase B pre-commit adversarial review (actualiza F-P2-T11-01) — 2026-08-27

```
FINDING_ID=F-P2-T11-01
STATUS=PHASE_B_PRECOMMIT_CERTIFIED_READY_FOR_LOCAL_COMMIT
SEVERITY=MEDIUM (sin cambio)
ADVERSARIAL_ISSUES_FOUND=0
ALLOWLIST_EXCEPTION_STATUS=ACCEPTED_TEST_ONLY_MINIMAL_EXCEPTION
PROPOSED_COMMIT_SUBJECT=feat: enforce connect-time session validation in chat service
```

Auditoría adversarial de los 5 archivos de Phase B, con mandato
explícito de intentar demostrar que la implementación estaba mal. No se
confió en el `PASS` de Stage4A: se releyeron los 5 archivos completos,
se re-derivó el equivalente HMAC byte-a-byte entre firmante y
verificador por lectura directa de código (no sólo "los tests pasan"),
y se construyó un script adversarial temporal (fuera del repo, eliminado
al terminar) que conectó el firmante REAL de Phase B con el verificador
REAL de Phase A (`src/lib/internal-session-check-auth.ts`, importado
directamente) — 12/12 casos PASS, incluyendo secreto discordante, tamper
de body y timestamp viejo. Re-ejecutó las 3 suites de forma
independiente: 98/98 PASS. Auditó la desviación del allowlist Stage2
(`internal-publish.test.js`) contra 12 preguntas de diagnóstico y la
ACEPTÓ como excepción test-only mínima — no oculta ninguna regresión
real. Cero hallazgos materiales de seguridad o alcance; un único nit
cosmético de logging (`"configuration_configuration_incomplete"`,
string duplicado, nunca llega al cliente) registrado sin bloquear — ver
`NONBLOCKING_COSMETIC_DEBT` abajo. Certificado listo para commit local
exacto de los 5 archivos. Este finding sigue sin `RESOLVED` — falta el
commit local (Stage4C), la revisión post-commit, y el gate de secreto
antes de cualquier push/deploy.

## P2-T11 — Stage 4C Phase B exact local commit (actualiza F-P2-T11-01) — 2026-08-27

```
FINDING_ID=F-P2-T11-01
STATUS=PHASE_B_LOCAL_COMMIT_COMPLETE_AWAITING_POSTCOMMIT_REVIEW_AND_SECRET_GATE
SEVERITY=MEDIUM (sin cambio)
COMMIT=e8d217112b1cfd6af311dda70ad2880ea8be295c
COMMIT_PARENT=d0ba59dccfdd51a4aa5705d0e76d2e84ba4867d1
COMMIT_SUBJECT=feat: enforce connect-time session validation in chat service
COMMIT_FILE_COUNT=5
AHEAD=1 BEHIND=0
PUSH=NO
SAFE_TO_PUSH_NOW=NO
PUSH_BLOCK_REASON=SECRET_GATE_NOT_CERTIFIED
```

Convirtió la implementación de Phase B (ya certificada adversarialmente
en Stage4B) en exactamente un commit local, sin modificar producto ni
tests. Stage exacto de los 5 paths permitidos (`git add -- <5 paths>`,
nunca `-A`/`.`), auditoría inmediata del índice (5 archivos, sin
reportes/`32`/Phase A/schema/package), commit único (`exit 0`, sin
amend, sin segundo intento), y verificación posterior leyendo
directamente los blobs del commit (no el working tree) para confirmar
que el contenido committeado es idéntico al certificado y que
JWT-first/`sid`/connect-only/fail-closed/TTL/timer de expiración
permanecen sin cambio en `HEAD`. `AHEAD=1`/`BEHIND=0` respecto de
`origin/testing-codex`, que sigue en `d0ba59d`. Phase B queda
implementada y commiteada LOCALMENTE — sigue sin desplegar. Este
finding sigue sin `RESOLVED` — falta la revisión post-commit/pre-
secret-gate (Stage4D), la certificación explícita del gate de secreto,
y luego push/deploy antes de cualquier cierre.

## P2-T11 — Stage 4D Phase B post-commit/pre-secret exact-blob review (actualiza F-P2-T11-01) — 2026-08-27

```
FINDING_ID=F-P2-T11-01
STATUS=PHASE_B_POSTCOMMIT_CERTIFIED_AWAITING_TESTING_SECRET_GATE
SEVERITY=MEDIUM (sin cambio)
COMMIT=e8d217112b1cfd6af311dda70ad2880ea8be295c
BLOBS_MATCH_STAGE4C=5/5
ADVERSARIAL_CASE_COUNT=12/12 PASS (script nuevo, no reutilizado)
MAX_AUTH_LATENCY_BOUND_MS=900 (recalculado desde código committed)
```

Recertificó el commit `e8d2171` directamente desde los objetos Git
(nunca desde el working tree ni la confianza en Stage4B/4C). Re-derivó
el equivalente HMAC byte-a-byte desde `HEAD` para ambos lados, y
construyó un script adversarial NUEVO que conectó el firmante real de
Phase B con el verificador real de Phase A — 12/12 PASS. Re-ejecutó las
3 suites (98/98 PASS). Cero hallazgos materiales nuevos. Este finding
sigue sin `RESOLVED` — falta el gate de secreto de TESTING (Stage4E)
antes de cualquier push.

## P2-T11 — Stage 4E TESTING secret / internal authority readiness gate (actualiza F-P2-T11-01) — 2026-08-27

```
FINDING_ID=F-P2-T11-01
STATUS=PHASE_B_SECRET_GATE_CERTIFIED_READY_FOR_FRESH_TESTING_PUSH
SEVERITY=MEDIUM (sin cambio)
REALTIME_SESSION_CHECK_SECRET_TESTING=PRESENT (DeliGO Copy + chat en vivo, mismo valor, nunca revelado)
DELIGO_MONOLITH_INTERNAL_URL_TESTING=PRESENT (chat en vivo, dominio público certificado)
AUTHENTICATED_SYNTHETIC_ROUNDTRIP=PASS (200 {"valid":false})
BAD_HMAC_RUNTIME=PASS (401)
STALE_TIMESTAMP_RUNTIME=PASS (401)
PHASE_B_PUSH_PERFORMED=NO
```

Provisionó el prerequisito de configuración que bloqueaba el push de
Phase B: generó un secreto de 32 bytes con el CSPRNG del sistema y lo
escribió, vía un mecanismo write-only verificado primero con una
variable no sensible, en `DeliGO Copy` y `chat en vivo` (TESTING) —
transmitido exclusivamente por stdin de un proceso hijo, nunca como
argumento de comando, nunca impreso, nunca a disco ni a ningún reporte.
Certificó un roundtrip HTTP real firmado contra el endpoint de Phase A
con un `sid` sintético inexistente (`200 {"valid":false}`, nunca
`AUTH_UNAVAILABLE`), demostrando el secreto compartido activo; probó
además HMAC corrupto y timestamp con 10 minutos de antigüedad, ambos
rechazados (401). Confirmó por código que el chat-service actualmente
desplegado (sin Phase B) ignora ambas variables nuevas — configurar
antes del deploy es seguro. Dos acciones de Railway fueron bloqueadas
por el clasificador de permisos del harness y requirieron aprobación
explícita del usuario en el chat antes de ejecutarse. El commit Phase B
(`e8d2171`) permanece exactamente sin cambios, sin push. Este finding
sigue sin `RESOLVED` — Phase B sigue sin desplegar; falta un gate
fresco de prepush (Stage4F) que ejecute el único push real y certifique
runtime la revocación post-logout antes de poder cerrar F-P2-T11-01.

## P2-T11 — Stage 4F Phase B TESTING deploy + runtime revocation certification (actualiza F-P2-T11-01) — 2026-08-27

```
FINDING_ID=F-P2-T11-01
STATUS=PHASE_B_DEPLOYED_TESTING_CERTIFIED_READY_FOR_PHASE_C
SEVERITY=MEDIUM (sin cambio)
COMMIT_PUSHED=e8d217112b1cfd6af311dda70ad2880ea8be295c
CHAT_DEPLOYMENT_STATUS=SUCCESS
PRELOGOUT_ACTOR_FRESH_CONNECT_AFTER_LOGOUT=REJECTED
FRESH_RECONNECT_REJECT_LATENCY_MS=1126
INDEPENDENT_SESSION_B_UNAFFECTED=SI
EXISTING_SOCKET_IMMEDIATE_DISTRIBUTED_REVOCATION=NO (esperado, fuera de alcance de Phase B)
```

Publicó el commit `e8d2171` a `origin/testing-codex` con un único push,
observó el autodeploy Git-triggered normal (`DeliGO Copy` + `chat en
vivo`, ambos `SUCCESS` en el commit exacto), y certificó en RUNTIME
contra la base de datos real de TESTING (dos fixtures aisladas,
prefijo `P2T11_STAGE4F_`, vía `DELIGO_TEST_DATABASE_URL` — nunca
`DATABASE_URL` — creadas y eliminadas en la misma tarea, aprobado
explícitamente por el usuario tras ser bloqueado por el clasificador de
permisos del harness) el objetivo central de Phase B: una sesión activa
conecta y reconecta con normalidad; tras un logout real
(`POST /api/auth/logout`), el MISMO actor JWT emitido antes del logout
fue rechazado en una conexión Socket.IO nueva en ~1.1 segundos —
`SESSION_INVALID reason=inactive` en el log del servidor, jamás
esperando los 300s de TTL del JWT — mientras una segunda sesión
independiente conectó sin verse afectada (revocación scoped-a-sesión,
no global). Un socket ya conectado con ese mismo JWT permaneció
conectado tras el logout — exactamente el comportamiento documentado
(Phase B nunca prometió revocación distribuida instantánea de sockets
ya conectados; ese socket sigue acotado por su `exp`, mecanismo
certificado desde Stage1B-R1, sin cambio). Cero errores de
autenticación interna en las 3 conexiones válidas del smoke. TTL
(300/120) y cross-tab (NO) sin drift. Este finding sigue sin
`RESOLVED` — Phase B queda desplegada y certificada, pero el objetivo
completo de F-P2-T11-01 (TTL reducido a 120s + propagación cross-tab)
requiere Phase C, todavía no implementada.

## NONBLOCKING_COSMETIC_DEBT — Phase B logging (no es finding de seguridad)

```
TITLE: reason string duplicado en checkSessionActive() para config ausente/inválida
LOCATION: mini-services/chat-service/internal-session-check-client.js (checkSessionActive)
SYMPTOM: reason final queda "configuration_configuration_incomplete" / "configuration_configuration_invalid" (prefijo "configuration_" duplicado sobre un reason que ya lo incluye)
SEVERITY: COSMETIC — sólo visible en logs server-side (console.warn de index.js), nunca llega al cliente (siempre TOKEN_INVALID genérico)
SECURITY_IMPACT: NINGUNO — no afecta fail-closed, HMAC, timeout, ni ningún control de seguridad
DISCOVERED_IN: P2-T11-STAGE4B (adversarial review)
DISPOSITION: NO corregir en P2-T11 (fuera de scope de Stage4A-4E) — preservar para P2-T15 (accumulated dead-code/cosmetic cleanup) o registro equivalente
STATUS: OPEN_NONBLOCKING
```

## P2-T11 — Stage 5A Phase C TTL 120s + same-browser cross-tab logout, implementación local (actualiza F-P2-T11-01) — 2026-08-27

```
FINDING_ID=F-P2-T11-01
STATUS=OPEN_IN_PROGRESS (Phase C implementada LOCALMENTE, sin commit/push/deploy)
SEVERITY=MEDIUM (sin cambio)
ACTOR_TTL_SECONDS=120 (antes 300, sólo en código local, no desplegado)
ROOM_CAP_TTL_SECONDS=120 (sin cambio)
CROSS_TAB_SAME_BROWSER_LOGOUT_IMPLEMENTED=SI (código local)
CROSS_DEVICE_INSTANT_REVOCATION=NO (fuera de alcance, deuda de T09)
COMMIT_PUSHED=NO
DEPLOY=NO
```

Implementó localmente los dos componentes pendientes de Phase C sobre el
allowlist exacto de 5 archivos congelado en Stage2:
`SOCKET_TOKEN_TTL_SECONDS` del `socket-actor` reducido de 300s a 120s
(medido desde la emisión, no desde el logout; `ROOM_CAPABILITY_TTL_SECONDS`
sin cambio), el endpoint `/api/realtime/token` sincronizado con la
constante real en vez de un literal, y un listener del evento nativo
`storage` (clave `deligo-auth`, la misma que ya persiste Zustand) en
`RealtimeProvider` que propaga el logout hacia las demás pestañas del
mismo navegador reutilizando el cableado `setActor`/`RealtimeManager` ya
existente — auditado y confirmado que la máquina de estados con epochs de
`RealtimeManager` (sin ningún cambio) ya impide toda reconexión con actor
obsoleto tras el cross-tab logout, y que un login posterior legítimo
sigue conectando con normalidad. Alcance estrictamente same-browser (el
evento `storage` nunca cruza dispositivos) — la revocación cross-device
instantánea sigue siendo deuda de T09, sin tocar. 9/9 tests nuevos, 47/47
suite TS relacionada y 98/98 regresión Phase B (chat-service) en verde;
lint y `git diff --check` limpios; TypeScript sin errores nuevos dentro
del allowlist. Cero commit, cero push, cero deploy, cero acceso a
Railway/DB real/navegador real en esta etapa. Este finding sigue sin
`RESOLVED`: Phase C queda implementada y verificada localmente, pero
todavía no commiteada ni desplegada — falta Stage5B (revisión adversarial
precommit) antes de poder considerar un commit.

## P2-T11 — Stage 5A-R1 evidencia local + reconciliación del MASTER HANDOFF (actualiza F-P2-T11-01) — 2026-08-27

```
FINDING_ID=F-P2-T11-01
STATUS=OPEN_IN_PROGRESS (sin cambio de fondo — sólo revalidación de evidencia y corrección de reportes)
SEVERITY=MEDIUM (sin cambio)
PRODUCT_OR_TEST_MUTATION_BY_R1=NO
MASTER_HANDOFF_RECONCILED=SI
```

Etapa de reconciliación pura de reportes: no modificó ningún archivo de
código ni de test. Revalidó la evidencia de Stage5A releyendo el diff
completo y re-ejecutando tests reales (TTL actor 120s vía `exp - iat`
firmado/verificado, 9 tests en verde en los 2 archivos tocados, 47/47 en
la suite TS relacionada, 98/98 en la regresión de `mini-services/chat-service`,
`npm run build` PASS por primera vez en esta secuencia) en vez de confiar
en el autorreporte anterior. Encontró que `CODEX_REPORT.md` (el MASTER
HANDOFF) había quedado inconsistente tras Stage5A: el header raíz seguía
apuntando a `CURRENT_TASK_ID=P2-T11-STAGE4F` y `P2_T11=` seguía en
`PHASE_B_DEPLOYED_TESTING_CERTIFIED_READY_FOR_PHASE_C`, mientras los
markers `DB_REAL_READ`/`DB_REAL_WRITE`/`PUSH`/`DEPLOY` heredaban sin
calificar acciones que en realidad fueron exclusivas de Stage4F (fixtures
TESTING, un push, un autodeploy) — presentándolas como si aún describieran
el estado actual. Corrigió el header y esos markers, separando
explícitamente `STAGE4F_*` (historia preservada sin editar su narrativa)
de los markers actuales (`NO`), y corrigió una línea equivalente en
`ROADMAP.md` (posición 9 del orden canónico, que todavía decía "Phase C
... not started"). No se resuelve este finding: Phase C sigue requiriendo
revisión adversarial precommit, commit, revisión postcommit, deploy en
TESTING y certificación real de multi-tab same-origin en navegador antes
del cierre final de P2-T11.

## P2-T11 — Stage 5B revisión adversarial precommit de Phase C (actualiza F-P2-T11-01) — 2026-08-27

```
FINDING_ID=F-P2-T11-01
STATUS=PHASE_C_PRECOMMIT_CERTIFIED_AWAITING_LOCAL_COMMIT (no RESOLVED)
SEVERITY=MEDIUM (sin cambio)
PHASE_C_DEFECTS_FOUND=0
PHASE_C_CORRECTIONS_MADE=0
PRIOR_REPORT_NARRATIVE_CORRECTION=1 (orden del logout — sin impacto de seguridad)
LOW_SEVERITY_RESIDUAL_DOCUMENTED=1 (evento de logout tardío bajo timing patológico de navegador — no explotable como bypass, no verificable sin navegador real)
```

Revisión adversarial completa de Phase C: TTL del actor confirmado como
autoridad única (sin duplicados de `300`/`120` hardcodeados, sin segundo
emisor de tokens `socket-actor`), room-capability confirmado
independiente y sin cambio, timer de expiración del chat-service
reconfirmado usando el `exp` real sin diff de producto, y Phase B
reconfirmado sin ningún cambio de comportamiento. La auditoría más
crítica — si la clave `deligo-auth`, ya usada por la persistencia de
Zustand desde antes de Phase C, podía sufrir colisión de namespace,
corrupción del auth-store, o que una escritura normal (login, cambio de
suspensión) se malinterpretara como una señal de logout — no encontró
ningún defecto real: el listener nuevo únicamente OBSERVA el canal ya
autoritativo existente, nunca escribe en él, y sólo un `logout()` real
puede producir el valor `user: null` que dispara la limpieza cross-tab
(las otras cuatro acciones del store fueron auditadas una por una y
ninguna puede producir ese valor). Se probó por trazado exacto de
`realtime-manager.ts` (sin ningún cambio, releído completo) que una
conexión asíncrona iniciada antes de un logout cross-tab no puede
resucitar un socket tras completarse tarde (el método `stop()` es
100% síncrono y desregistra los listeners del socket antes de cualquier
carrera posible), y que un login legítimo posterior siempre puede
reactivar el realtime sin ningún estado "envenenado" permanente. Se
construyó un arnés adversarial temporal fuera del repositorio, que
extrajo el handler real del código fuente (con sólo una erosión de tipos
mecánica, sin reescribir ninguna rama de lógica) y lo ejecutó contra 12
payloads maliciosos/malformados (clave no relacionada, JSON inválido,
formato antiguo, payload sobredimensionado, etc.) — 12/12 sin excepción
y con la decisión correcta en cada caso; el arnés fue eliminado al
terminar. Se corrigió además una inexactitud narrativa (no de código) en
los reportes de Stage5A/Stage5A-R1 sobre el orden real del flujo de
logout: la limpieza local (que dispara la señal cross-tab) ocurre
síncronamente ANTES de que la petición al servidor siquiera comience —
no después, como se había descrito — sin que esto represente una
ampliación de riesgo, ya que la propia pestaña iniciadora ya tenía este
mismo comportamiento incondicional desde antes de Phase C. Se documentó,
sin bloquear, un único residual de severidad baja: bajo un timing de
navegador patológico y no verificable sin pruebas de navegador real
(pestaña en segundo plano o bfcache), un evento de logout tardío
teóricamente podría desloguear localmente un login recién establecido en
otra pestaña — el peor caso posible es una solicitud de re-login, nunca
un acceso no autorizado, ya que la autoridad real de seguridad para
cualquier conexión nueva sigue siendo el chequeo server-side de Phase B,
no el estado local del cliente. Cero corrección de código fue necesaria
— ningún defecto real la ameritó. No se resuelve este finding: falta
todavía el commit local exacto (Stage5C), la revisión postcommit, el
deploy en TESTING, y la certificación real de multi-tab same-origin en
navegador antes del cierre final de P2-T11.

## P2-T11 — Stage 5C commit local exacto de Phase C (actualiza F-P2-T11-01) — 2026-08-27

```
FINDING_ID=F-P2-T11-01
STATUS=PHASE_C_LOCAL_COMMIT_COMPLETE_AWAITING_POSTCOMMIT_EXACT_BLOB_REVIEW (no RESOLVED)
SEVERITY=MEDIUM (sin cambio)
COMMIT=f6ca24f78a4359fdf66e213b1a449a49426c1234
COMMIT_PARENT=e8d217112b1cfd6af311dda70ad2880ea8be295c
COMMIT_FILE_COUNT=5
PRODUCT_MUTATION_BY_STAGE5C=NO (sólo se stageó y commiteó lo ya certificado en Stage5B)
LOW_RESIDUAL_STATUS=LOW_PENDING_REAL_BROWSER_CERTIFICATION (preservado sin intentar corrección de código)
```

Convirtió la implementación de Phase C ya certificada sin defectos en
Stage5B en exactamente un commit local, sin modificar ni una sola línea
de producto/test en esta etapa: recuperó textualmente (no de memoria) el
allowlist de 5 archivos y el subject exacto congelados por Stage5B,
confirmó por `git diff --stat` idéntico que nada mutó desde esa
certificación, re-ejecutó la batería completa (9 tests Phase C, 47/47
suite TS relacionada, 98/98 regresión Phase B, lint/TSC/`diff --check`/
`npm run build` limpios), stageó explícitamente sólo los 5 paths
permitidos, auditó el índice antes y después del `add` para confirmar
ausencia de contenido prohibido (reportes, `32`, archivos de Phase B,
schema/package), leyó los 5 blobs directamente desde el índice, confirmó
`staged == worktree` exacto, y ejecutó un único intento de
`git commit`, exitoso al primer intento (sin necesidad de un segundo).
El commit resultante (`f6ca24f`) tiene como padre exacto `e8d2171`
(el commit de cierre de Phase B), contiene exactamente los 5 archivos
esperados, y su diff/blobs fueron releídos completos directamente desde
`HEAD` — idénticos a lo certificado en Stage5B. El residual de severidad
baja documentado en Stage5B (un evento de logout tardío bajo timing
patológico de navegador, no explotable como bypass de seguridad) se
preservó explícitamente sin ningún intento de corrección de código, tal
como exigía esta etapa. Distinción explícita LOCAL vs DESPLEGADO: el
TTL de 120s y la propagación de logout entre pestañas quedan
**commiteados localmente**, pero `origin/testing-codex` (y por tanto
TESTING/Production) no se movió — sigue exactamente en `e8d2171`, con
el TTL desplegado aún en 300s y el cross-tab desplegado aún inactivo,
hasta que un push futuro publique `f6ca24f`. Sin push, sin deploy, sin
acceso a Railway, sin DB real, sin navegador real en esta etapa. Este
finding sigue sin `RESOLVED`: falta todavía la revisión postcommit/
pre-push (Stage5D), el push, el deploy en TESTING, y la certificación
real de multi-tab same-origin en navegador — incluyendo, obligatoriamente,
una prueba del escenario del residual de severidad baja aquí preservado
— antes del cierre final de P2-T11.

## P2-T11 — Stage 5D revisión postcommit/pre-push exacta de Phase C (actualiza F-P2-T11-01) — 2026-08-27

```
FINDING_ID=F-P2-T11-01
STATUS=PHASE_C_POSTCOMMIT_CERTIFIED_READY_FOR_FRESH_TESTING_PREPUSH (no RESOLVED)
SEVERITY=MEDIUM (sin cambio)
COMMIT_RECERTIFIED=f6ca24f78a4359fdf66e213b1a449a49426c1234
COMMIT_PARENT_RECERTIFIED=e8d217112b1cfd6af311dda70ad2880ea8be295c
INDEPENDENT_BLOB_COUNT_MATCH=5/5
BYTE_IDENTICAL_NEIGHBOR_FILES=5/5 (chat-service/index.js, internal-session-check-auth.ts, realtime-manager.ts, auth-store.ts, use-auth.ts)
PRODUCT_MUTATION_BY_STAGE5D=NO
LOW_RESIDUAL_STATUS=LOW_PENDING_REAL_BROWSER_CERTIFICATION (reafirmado, no resuelto, no reclasificado como imposible)
```

Recertificó de forma **independiente** el commit `f6ca24f` desde los
objetos Git, tratando como autoridad primaria los propios objetos y no
el resumen de Stage5C: derivó el fileset del commit vía
`git diff-tree --no-commit-id --name-status -r HEAD` (5/5 exacto, sin
extras ni faltantes respecto al allowlist), recalculó los 5 blob IDs de
forma independiente vía `git ls-tree HEAD` (5/5 idénticos, byte a byte,
a los registrados por Stage5C), y leyó los 5 archivos completos
directamente desde `git show HEAD:<path>`. La evidencia más fuerte de
esta etapa: en vez de conformarse con que los archivos de Phase A/Phase
B/vecinos de autoridad estuvieran simplemente "ausentes" del diff del
commit, se ejecutó una comparación byte-a-byte explícita
(`diff <(git show HEAD^:<path>) <(git show HEAD:<path>)`) para
`mini-services/chat-service/index.js`,
`src/lib/internal-session-check-auth.ts`, `src/lib/realtime-manager.ts`,
`src/store/auth-store.ts` y `src/hooks/use-auth.ts` — los 5 resultaron
**IDENTICAL**, la prueba más rigurosa posible de que Phase A, Phase B y
las autoridades vecinas (incluyendo la máquina de estados con epochs de
`RealtimeManager` y el punto real de logout cliente) quedaron
absolutamente intactas por este commit. Reprobó desde el árbol
commiteado (no desde el literal visto en el código): autoridad única de
TTL para el `socket-actor` (sin segundo emisor, sin duplicado `300`),
room-capability independiente en 120s, timer del chat-service usando el
`exp` real, y re-derivó el orden correcto del flujo de logout
(limpieza local síncrona primero, petición al servidor best-effort
después) directamente del blob commiteado de `use-auth.ts` —
reconfirmando la corrección que Stage5B ya había hecho, sin restaurar la
narrativa incorrecta "servidor primero". Construyó un arnés adversarial
NUEVO (distinto al de Stage5B), extrayendo el handler directamente del
blob commiteado vía `git show HEAD:...` en vez del working tree, y lo
ejecutó contra 12 payloads maliciosos/malformados — 12/12 PASS, con el
texto extraído resultando byte-idéntico al que Stage5B había auditado
desde el working tree, confirmando ausencia de drift entre lo revisado
y lo efectivamente commiteado. Recontó (no copió) 9 tests Phase C, 47/47
suite TS relacionada y 98/98 regresión Phase B, todos en verde; lint,
TSC, `git show --check HEAD`, `git diff --check` y `npm run build`
limpios; confirmó `git diff HEAD -- <5 paths>` vacío, validando que la
batería ejecutada sobre el working tree es evidencia válida del código
efectivamente commiteado. Preservó explícitamente, sin reclasificar como
resuelto ni como imposible, el residual de severidad baja documentado en
Stage5B (evento de logout tardío bajo timing patológico de navegador —
no auth bypass, no privilege escalation, no resurrección de sesión
server-side). Cero mutación de fuente/test por esta etapa — únicamente
`CODEX_REPORT.md` y `codex-reports/**`. `HEAD=f6ca24f`, `ORIGIN` sigue
en `e8d2171` (sin mover), `AHEAD=1`/`BEHIND=0`. Sin push, sin deploy,
sin acceso a Railway, sin DB real, sin navegador real. Este finding
sigue sin `RESOLVED`: Phase C queda elegible para push, pero sólo
después de que Stage5E repita su propio preflight completo
inmediatamente antes del push real — esta certificación no lo sustituye
— y falta todavía el push, el deploy en TESTING, la certificación
server-runtime del TTL/revocación desplegados, y la certificación real
de multi-tab same-origin en navegador (incluyendo, obligatoriamente, una
prueba explícita del residual aquí preservado) antes del cierre final de
P2-T11.

## P2-T11 — Stage 5E deploy en TESTING + certificación runtime server-side de Phase C (actualiza F-P2-T11-01) — 2026-08-27

```
FINDING_ID=F-P2-T11-01
STATUS=PHASE_C_DEPLOYED_SERVER_RUNTIME_CERTIFIED_AWAITING_REAL_BROWSER_CROSSTAB (no RESOLVED)
SEVERITY=MEDIUM (sin cambio)
COMMIT_PUSHED=f6ca24f78a4359fdf66e213b1a449a49426c1234
DELIGO_DEPLOYMENT_STATUS=SUCCESS
CHAT_DEPLOYMENT_STATUS=SUCCESS
DEPLOYED_ACTOR_TTL_SECONDS=120 (medido sobre un JWT real emitido por el servidor de TESTING, no sobre el literal del código)
EXISTING_SOCKET_RUNTIME_DISCONNECT_NEAR_EXP=SI (~119.9s, reason=server namespace disconnect)
PRELOGOUT_ACTOR_FRESH_CONNECT_AFTER_LOGOUT=REJECTED (TOKEN_INVALID / SESSION_INVALID reason=inactive)
REJECT_LATENCY_MS=1226
INDEPENDENT_SESSION_B_UNAFFECTED=SI
REAL_BROWSER_CROSSTAB_CERTIFIED=NO
LOW_RESIDUAL_STATUS=LOW_PENDING_REAL_BROWSER_CERTIFICATION (reafirmado, no resuelto)
```

Publicó `f6ca24f` a `origin/testing-codex` con un único push, tras
repetir todo el preflight en fresco (nada había mutado desde Stage5D),
confirmar proyecto/entorno de Railway (`amiable-rejoicing`/`TESTING`)
sin ejecutar `railway variables` ni mutar config, y confirmar ausencia
de deploy concurrente y salud de ambos servicios. Observó exclusivamente
el autodeploy Git-triggered normal (sin `railway up`/redeploy manual):
ambos servicios `SUCCESS`, confirmados sirviendo exactamente `f6ca24f`
mediante la metadata de despliegue de Railway (`commitHash`, no
inferido del éxito del push) — incluyendo que `chat en vivo` también
autodeployó a ese commit pese a que sus archivos productivos no
cambiaron. Logs de build/deploy sin ningún patrón de error. Con permiso
explícito del usuario en el chat (bloqueado primero por el clasificador
de permisos del harness, igual que en Stage4F), creó 2 filas `Cliente`
fixture aisladas en TESTING (`P2T11_STAGE5E_A`/`_B`, vía
`DELIGO_TEST_DATABASE_URL` exclusivamente, `DATABASE_URL` confirmado
ausente del entorno antes de empezar) y certificó en RUNTIME contra el
servidor real: el JWT del actor emitido por `/api/realtime/token` mide
`exp - iat = 120` exacto — ya no 300 — y el `expiresIn` de la respuesta
coincide; una conexión y una reconexión activas al chat-service real
funcionaron con normalidad; un socket dejado conectado con un token
nuevo se desconectó realmente a los ~119.9 segundos, con razón
`server namespace disconnect` observada tanto del lado cliente como en
el log interno del propio chat-service — prueba directa de que el
mecanismo de expiración real quedó acotado al nuevo TTL de 120s, no al
antiguo de 300s. Tras ejecutar un logout real
(`POST /api/auth/logout`), el MISMO actor JWT emitido antes del logout
fue rechazado en una conexión nueva en 1.226 segundos —
`TOKEN_INVALID` genérico hacia el cliente, `SESSION_INVALID
reason=inactive` en el log interno del servidor — confirmando que la
revocación server-side de Phase B sigue funcionando exactamente igual
después del deploy de Phase C, sin ninguna regresión. Una sesión
independiente (Sesión B) conectó sin verse afectada por el logout de la
Sesión A, confirmando que la revocación permanece scoped-a-sesión, no
global. Cero errores de autenticación interna en las 5 conexiones
válidas del harness. Limpieza completa al finalizar: las 2 filas
fixture fueron eliminadas (`deletedCount=2, remaining=0`), y los 3
scripts temporales usados (creación de fixtures, arnés de runtime,
limpieza) fueron eliminados del repositorio inmediatamente después de
cada uso, sin dejar rastro en `git status` en ningún punto de control.
`HEAD=ORIGIN=f6ca24f`, `AHEAD=0`/`BEHIND=0`. Cross-tab (el listener
`storage` sobre `deligo-auth`) queda desplegada como código — forma
parte del mismo commit servido por `DeliGO Copy` — pero su
comportamiento real en un navegador (propagación nativa del evento
`storage` entre pestañas) NO fue observado en esta etapa; toda la
certificación usó clientes API/socket programáticos, cero pestañas de
Chrome. Sin mutación de Railway config, sin acceso a Production. Este
finding sigue sin `RESOLVED`: falta la certificación real de multi-tab
same-origin en navegador (Stage5F), incluyendo obligatoriamente un
ataque explícito al residual de logout tardío que sigue preservado sin
resolver, antes del cierre final de P2-T11.

## P2-T11 — Stage 5F certificación real de multi-tab en navegador para Phase C (actualiza F-P2-T11-01) — 2026-08-27

```
FINDING_ID=F-P2-T11-01
STATUS=CORE_ACCEPTANCE_CERTIFIED_AWAITING_FINAL_CLOSEOUT_AND_RESIDUAL_DISPOSITION (no RESOLVED)
SEVERITY=MEDIUM (sin cambio)
REAL_BROWSER_ENGINE=Chromium (Claude Browser pane, CDP, ya disponible)
TAB_A_OWN_STORAGE_EVENT_COUNT=0
TAB_B_NATIVE_STORAGE_EVENT_LATENCY_MS=15-20 (dos ciclos reales independientes)
TAB_B_STALE_RECONNECT_SUCCESS_COUNT=0
SERVER_LOGOUT_REQUEST_COUNT_PER_CYCLE=1 (sólo desde la pestaña emisora)
NORMAL_WRITE_CAUSED_LOGOUT=NO
MALFORMED_EVENT_CAUSED_LOGOUT=NO
UNRELATED_KEY_CAUSED_LOGOUT=NO
DUPLICATE_LOGOUT_SAFE=SI
REBROADCAST_LOOP=NO
NEW_LOGIN_REENABLES_REALTIME=SI
OLD_CONNECTION_RESURRECTED=NO
LATE_STORAGE_RESIDUAL_RESULT=NOT_TESTABLE_WITH_AVAILABLE_BROWSER_LIFECYCLE_CONTROL
```

Certificó con un **navegador Chromium real** (Claude Browser pane, ya
disponible en el harness — nada instalado, `package.json` sin tocar) el
comportamiento cross-tab de Phase C que hasta Stage5E sólo estaba
probado por código y por clientes API/socket programáticos. Con permiso
explícito del usuario en el chat, creó exactamente 1 fila `Cliente`
fixture temporal en TESTING (`P2T11_STAGE5F`, vía
`DELIGO_TEST_DATABASE_URL` exclusivamente, `DATABASE_URL` confirmado
ausente del entorno), la usó para un login real vía el formulario
productivo, y la eliminó al finalizar (`deletedCount:1, remaining:0`).
Abrió dos pestañas (`Page`) dentro de un único `BrowserContext` —
nunca dos contextos separados — confirmando que ambas comparten la
cookie httpOnly de sesión automáticamente (Tab B mostró el mismo saludo
autenticado sin login propio). Ejecutó el logout real mediante el botón
productivo "Cerrar sesión" (mismo elemento DOM, mismo handler; se
resolvió un problema de hit-testing por coordenadas causado por un
overlay de Radix atascado en este entorno sin compositing visual,
invocando `.click()` directamente sobre el elemento real — documentado
explícitamente como limitación de entorno, no como hallazgo de
producto) y observó, con un listener pasivo instalado ANTES del logout
y sin usar jamás `dispatchEvent` sintético: la pestaña emisora recibió
**0** eventos propios de `storage` (confirma empíricamente que el
navegador nunca entrega el evento al documento que escribió); la
pestaña receptora recibió exactamente **1** evento nativo cross-document
en 15-20ms, y limpió su `RealtimeManager` de forma completamente
independiente (`hasActor:false, state:"stopped"`, verificado por lectura
de solo-lectura de `getConnectionSnapshot()` vía introspección del árbol
de fibers de React); tras una ventana de estabilización de 10s más
eventos reales de `focus`/`visibilitychange`/`pageshow` y, como mejor
esfuerzo, `offline`/`online`, no se registró ninguna petición de red a
`realtime`/`socket.io` — cero intentos de reconexión, cero éxito. Reprobó
además, con escrituras REALES de `localStorage` (nunca sintéticas): que
una escritura no-logout semánticamente equivalente pero con distinta
serialización no causa logout ni teardown; que un valor malformado
(`"{not valid json!!"`) no lanza excepción ni desloguea; que una clave
no relacionada (`P2T11_STAGE5F_UNRELATED`) se ignora; que un segundo
evento de logout con serialización distinta es seguro (idempotente); y
que el sistema se asienta sin rebroadcast (0 eventos nuevos tras 4s de
estabilidad). Un login nuevo real reactivó el realtime con un
`actorEpoch` nuevo, nunca resucitando el epoch viejo ya detenido — y
descubrió, documentándolo sin sobre-afirmar, una asimetría de diseño
real: un login nuevo en una pestaña NO se propaga automáticamente a otra
ya abierta (sólo el logout se propaga vía el listener), por diseño
congelado desde Stage2. Intentó honestamente el residual de severidad
baja preservado desde Stage5B: sin acceso a `Page.setWebLifecycleState`
vía CDP en este toolset (LIFECYCLE_CONTROL_AVAILABLE=NO), y un intento
de la alternativa de BFCache (navegación hacia otra ruta y `back`) cuyo
propio diagnóstico (`performance.getEntriesByType("navigation")[0].type`
= `"back_forward"` pero el estado JS inyectado NO sobrevivió) probó que
fue una recarga real, no una congelación genuina — clasificado
honestamente como `NOT_TESTABLE_WITH_AVAILABLE_BROWSER_LIFECYCLE_CONTROL`,
sin reclasificarlo como resuelto ni como imposible. En ningún escenario,
incluidos los adversariales, un actor revocado logró conectar ni una
sesión resucitó — la autoridad real de seguridad sigue siendo el chequeo
server-side de Phase B, ya certificado en Stage5E. Cero errores de
navegador relevantes (sólo 401 esperados de chequeos de sesión), cero
mutación de fuente/test, cero commit/push/deploy/mutación de Railway.
Este finding sigue sin `RESOLVED`: el contrato técnico central de
aceptación (Phase A + Phase B + Phase C TTL 120s + Phase C cross-tab
same-browser) queda cumplido, pero el cierre formal y la disposición
final del residual de severidad baja quedan para Stage5G.

## P2-T11 — Stage 5G cierre final / disposición del residual (actualiza F-P2-T11-01) — 2026-08-27

```
FINDING_ID=F-P2-T11-01
STATUS=RESOLVED
CLASS=POSTLOGOUT_RESIDUAL_ACCESS_REQUIRES_HARDENING
SEVERITY=MEDIUM (histórico; residual final clasificado LOW y ACCEPTED, no bloqueante)
ACCEPTANCE_MATRIX_RESULT=10_OF_10_PASS
RESIDUAL_DISPOSITION=ACCEPTED_LOW_NON_SECURITY_BLOCKING_LIMITATION
P2_T11=CLOSED
```

Cierre final read/audit-only. Reconstruyó y confrontó toda la cadena
Stage1→Stage5F contra Git real (HEAD=ORIGIN=f6ca24f, AHEAD=0/BEHIND=0,
recertificado desde los objetos), los seis registros canónicos y los
archives de Stage1/Stage1B/Stage1B-R1/Stage2 — sin encontrar ninguna
contradicción entre ellos. Confirmó independientemente que Phase A
(`d0ba59d`), Phase B (`e8d2171`) y Phase C (`f6ca24f`) forman una cadena
estrictamente aditiva: el diff byte-a-byte de Stage5D ya había probado
que Phase C no modifica ningún blob de Phase A/Phase B. Construyó la
matriz de aceptación de los 10 puntos congelados en el contrato de
Stage2 — los 10 en PASS, con evidencia runtime real tanto server-side
(PostgreSQL + HTTP + socket, Stage4F/Stage5E) como de navegador real
(Chromium vía CDP, Stage5F), no sólo tests unitarios/mockeados. Evaluó
explícitamente el residual de severidad baja (evento de logout tardío
bajo timing patológico de navegador, documentado desde Stage5B, nunca
corregido en código, nunca reproducido con las herramientas de navegador
disponibles) contra un modelo de amenaza de cuatro preguntas —
resurrección de sesión server-side, reautorización de actor revocado,
acceso no autorizado a socket, escalación de privilegio — las cuatro
respondidas `NO` con evidencia directa de Stage5F
(`RESIDUAL_SECURITY_BACKSTOP`: en ningún escenario probado, incluidos los
adversariales, un actor revocado logró conectar ni una sesión resucitó).
El peor caso real es una re-solicitud de login, nunca acceso no
autorizado, y el contrato de aceptación congelado en Stage2 no exige su
eliminación. Se dispone como `ACCEPTED_LOW_NON_SECURITY_BLOCKING_LIMITATION`
— ni `RESOLVED` (nunca se reprodujo, no puede declararse corregido) ni
`IMPOSSIBLE` (no hay prueba de que no pueda ocurrir, sólo de que esta
sesión no pudo forzarlo) — con una política de reapertura explícita si
en el futuro una herramienta con control genuino de lifecycle de página
logra reproducirlo, o si surge evidencia de un efecto de seguridad más
allá de UX local. `F-P2-T11-01` pasa a **`RESOLVED`**; **`P2-T11` pasa a
`CLOSED`**. La terminación forzada instantánea cross-instance permanece
deliberadamente fuera de este cierre — mandato explícito de P2-T09, no
absorbido ni implementado. Cero mutación de código/tests/schema/
migration/package/Git/Railway/Production en esta etapa. Siguiente tarea
canónica del roadmap: P2-T18-STAGE1 (Chat Cross-Tab UI Polish,
complejidad 2/10) — definida, no ejecutada. Ver
`codex-reports/archive/P2-T11-STAGE5G-R1.md` para el detalle archivado
de esa etapa de cierre.

## P2-T18 — F-P1-01 / F-P1-02 — recuperación histórica / baseline actual (Stage 1) — 2026-08-27

```
FINDING_ID=F-P1-01
TITLE=Chat cross-tab: messages-read entregado a pestaña hermana pero ignorado por la UI (unread stale hasta el próximo poll)
STATUS=REPRODUCED_CURRENT_ACCEPTANCE_CONTRACT_FROZEN (histórico: OPEN/LOW-cosmetic desde P1-T01/P1-T02, nunca RESOLVED)
SEVERITY=COSMETIC (sin cambio respecto de la severidad histórica)
CURRENT_EVIDENCE=chat-sheet.tsx:190-192 (callback vacío, comentario textual idéntico al de hace un año) + chat-service/index.js:503-505 (exclusión sólo por socket.id, nunca por actor)
```

```
FINDING_ID=F-P1-02
TITLE=Chat cross-tab: typing se auto-refleja en pestaña hermana del mismo actor
STATUS=PAUSED_BLOCKED_BY_LIVE_PUSH_DEFECT (2026-08-29 — P2-T18 en pausa por decisión explícita del usuario, NO cerrado; F-P1-02 permanece abierto/sin PASS-FAIL, bloqueado por `F-P2-T18-LIVE-PUSH-01` (defecto de infraestructura de Railway, fuera del alcance de código). Historial: matriz de 6 casos intentada con topología real X1/X2/Y1 en P2-T18-F-P1-02-REAL-BROWSER-ACCEPTANCE-R2; ningún indicador de typing apareció en NINGUNA dirección, pese a canal de conexión sano; causa aislada a un defecto DISTINTO y más profundo, `F-P2-T18-LIVE-PUSH-01`, que bloquea la aceptación sin ser el guard de auto-eco de F-P1-02 en sí — ver narrativa al final de este finding. IMPORTANTE (alcance del bloqueo, definido explícitamente por el usuario): este defecto NO bloquea que los negocios carguen productos/configuren catálogo tras la sincronización Production-vs-testing-codex — SÍ debe permanecer como bloqueo para el lanzamiento operativo completo de pedidos/chat en tiempo real hasta resolverlo)
SEVERITY=COSMETIC (sin cambio respecto de la severidad histórica del propio guard; la severidad del bloqueador se evalúa por separado en F-P2-T18-LIVE-PUSH-01)
CURRENT_EVIDENCE=chat-sheet.tsx:166-178 (sin filtro de identidad) + chat-store.ts:194-204 (addTypingUser sin excluir userId propio) + chat-service/index.js:474-478 (exclusión sólo por socket.id) — ninguno de estos alcanza a ejecutarse en el navegador real actual, ver F-P2-T18-LIVE-PUSH-01
```

Ambos findings, originados en P1-T01/P1-T02 y nunca antes registrados en
los seis registros activos post-reorganización (existían únicamente en
`codex-reports/archive/LEGACY_FULL_REPORT_20260826.md`), fueron
recuperados textualmente por P2-T18-STAGE1 y re-derivados de forma
independiente contra el código actual — no se copió el estado histórico
`OPEN` como prueba de vigencia. Confirmados `REPRODUCED` por lectura
exhaustiva y determinista del código real (sin necesidad de navegador,
decisión justificada explícitamente: mecanismo de lógica JS
incondicional, no dependiente de timing/compositing/visibilidad).
Auditoría de fix incidental: P2-T04 (Chat Active-Message Resync) tocó un
subsistema adyacente (`chatRevision` bump en mark-read) pero documentó
explícitamente que preservaba sin cambio el efecto de UI de
`messages-read` — ningún otro task tocó los archivos relevantes. Ambos
clasificados `UI_POLISH`, sin relación con seguridad ni con P2-T11
(preservado `CLOSED`, sin reabrir). Contratos de aceptación
independientes congelados (`F_P1_01_ACCEPTANCE`/`F_P1_02_ACCEPTANCE`,
ver `codex-reports/CURRENT_TASK.md`), allowlist candidato congelado
`FROZEN_HIGH_CONFIDENCE` (1 archivo de producto, `chat-sheet.tsx`, dos
guardas de identidad de una línea, sin tocar servidor). No se marca
`RESOLVED` — ninguna corrección de código fue implementada en esta
etapa, sólo auditoría/baseline/congelamiento de alcance. Siguiente
tarea: P2-T18-STAGE2 (implementación local), no ejecutada.

Stage2 implementó localmente el fix (allowlist de 1 archivo de
producto + 1 de test), Stage3 lo auditó adversarialmente (9
mutaciones, 1 defecto real encontrado y corregido en el test), Stage4
lo convirtió en commit local (`1adcc01f5380d896bed6e46dcd11bccb90d39e07`,
"fix: filter own-actor echo from chat typing and read events") y
recertificó los blobs. Stage5/Stage6 lo llevaron a push/deploy en
TESTING. Stage7 y su cadena de reintentos (R1, R1A, R1A-R1, R2,
R2-RETRY, R2-RETRY-2) intentaron certificarlo con navegador real y
encontraron evidencia runtime persistentemente inestable — nunca un
`PASS` ni un `FAIL` de producto confirmado, siempre `CONTROL_INVALID`
o bloqueos de disponibilidad de navegador. `P2-T18-F-P1-02-REAL-BROWSER-ACCEPTANCE`
(2026-08-29) repitió el intento desde cero con Chrome real (Claude in
Chrome, "Browser 2", ya probado funcional en R13-R7) contra el commit
desplegado `fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f`: baseline de
chat confirmado PASS en ambas direcciones, pero el indicador de typing
nunca apareció en el receptor en ninguna dirección (Y1→X1/X2 ni
X1→Y1), pese a room-grants frescos y confirmación por lectura de
código de que el emisor sí disparaba `sendTyping` en cada intento.
Clasificado `BLOCKED_REAL_BROWSER_TYPING_CONTROL_INVALID` — ni PASS ni
FAIL, por regla explícita de la etapa. Ningún fix de código intentado.
Detalle completo en `codex-reports/CURRENT_TASK.md` y en la narrativa
final de `CODEX_REPORT.md`. Siguiente tarea definida (no ejecutada):
`P2-T18-F-P1-02-REAL-BROWSER-ACCEPTANCE-R1`.

**R1 (2026-08-29, diagnóstico acotado, 3 observaciones máximo)** aisló
el primer tramo roto: Observation 1 (harness externo, dos actores
reales, servidor puro) confirmó el chat-service 100% sano
(`SERVER_TYPING_CHANNEL=PASS` ambas direcciones); Observation 2
(Browser 2 real, espera deliberada de 5s antes de escribir) descartó
timing/room-grant como causa; Observation 3 (observador temporal de
solo lectura de WebSocket, instalado antes de conectar, per excepción
puntual del prompt a la regla de no-monkey-patch) confirmó, corroborado
por `read_network_requests` mostrando cero requests de cualquier tipo
hacia el chat-service, que **el navegador nunca intenta siquiera
conectar** al chat-service — pese a que `/api/realtime/token` y
`/api/realtime/authorize` devuelven `200`. `FIRST_BROKEN_HOP=HOP_B`,
`R1_CLASSIFICATION=SENDER_CLIENT_EGRESS_DEFECT`. El guard de auto-eco
de `F-P1-02` nunca llega a ejecutarse porque el evento nunca llega —
no es el defecto que F-P1-02 busca corregir. Registrado un finding
nuevo y distinto: `F-P2-T18-TYPING-CHANNEL-01` (ver abajo). Ningún fix
intentado — causa raíz interna (por qué la conexión nunca se intenta)
queda `UNKNOWN_PENDING_FOCUSED_IMPLEMENTATION_DIAGNOSIS`, fuera del
presupuesto de esta etapa. Detalle completo en
`codex-reports/CURRENT_TASK.md`; etapa anterior archivada en
`codex-reports/archive/P2-T18-F-P1-02-REAL-BROWSER-ACCEPTANCE.md`
(`7810a8a478b662738cd187ac37d64548d1daf383672bc77cd4f2b6226bf5632c`).
`NEXT_REQUIRES_USER_DISPOSITION=SI` — sin R2 automático.

**Investigación de seguimiento (2026-08-29)**, tras elegir el usuario
explícitamente la opción A ("investigar/corregir ahora") frente al
defecto `F-P2-T18-TYPING-CHANNEL-01`: se implementó localmente un fix
especulativo (reordenar `transports` a `["polling","websocket"]` en
`realtime-manager.ts`/`realtime-types.ts`), validado contra la
suite de tests y TSC (limpio), pero se descubrió que la CSP del
proyecto (`connect-src`, `src/proxy.ts:227`) bloquea `fetch`/XHR hacia
el origen del chat-service — invalidando la verificación hecha en
Node.js (que no aplica CSP y usa el paquete `ws`, no el `WebSocket`
nativo del navegador). El fix fue **revertido** antes de dejarlo sin
verificar correctamente en el entorno real (`git checkout --` sobre
ambos archivos, confirmado limpio). Se retomó la investigación con
Chrome real: login fresco del fixture `P2T18_TYPINGFIX_`, apertura de
la conversación específica del pedido (dispara la cadena real
`acquireOrderRoom→ensureConnected→connectForEpoch`), y evidencia
directa y convergente confirmó que **el navegador SÍ conecta
correctamente**: `/api/realtime/token` y `/api/realtime/authorize`
en 200 (gateados lógicamente detrás de un `ensureConnected()`
exitoso) y el indicador de estado en vivo mostrando **"● Conectado"**.
Conclusión: la evidencia original de R1 (Observation 3, "cero
conexión intentada") fue un falso positivo — tanto el observador de
WebSocket inyectado como `read_network_requests` comparten un punto
ciego para tráfico WebSocket nativo, y "cero evidencia observada" fue
malinterpretado como "cero conexión intentada". `F-P2-T18-TYPING-CHANNEL-01`
se reclasifica `FALSE_POSITIVE_CORRECTED` (ver su bloque de finding
propio) y se retira como bloqueador de F-P1-02. **F-P1-02 sigue sin
PASS/FAIL**: esta investigación de seguimiento fue puntual (corregir
el bloqueador de canal), no una re-ejecución de la matriz de 6 casos
de typing — esa matriz completa queda pendiente de una nueva etapa de
aceptación real-browser, ahora sin el bloqueador de conexión. Fixture
`P2T18_TYPINGFIX_` (1 Cliente + 1 Negocio + 1 Producto + 1 Pedido) y
la pestaña de navegador usados en esta investigación fueron limpiados
en su totalidad al concluir. Ningún cambio de código de producto
quedó en el árbol de trabajo (`git status` limpio salvo los archivos
de reporte no versionados de siempre).

---

## F-P2-T18-TYPING-CHANNEL-01
```
FINDING_ID=F-P2-T18-TYPING-CHANNEL-01
TITLE=El navegador nunca establece conexión Socket.IO con el chat-service pese a que la autorización REST (/api/realtime/token, /api/realtime/authorize) funciona correctamente
STATUS=FALSE_POSITIVE_CORRECTED (2026-08-29, investigación de seguimiento tras disposición del usuario "investigar/corregir ahora" — ver narrativa abajo)
SEVERITY=N/A (finding retirado — no describe un defecto real de producto)
DISCOVERED_IN=P2-T18-F-P1-02-REAL-BROWSER-ACCEPTANCE-R1 (2026-08-29), durante el diagnóstico acotado de F-P1-02
CORRECTED_ROOT_CAUSE=El navegador SÍ conecta correctamente. La conclusión original de R1 ("el navegador nunca intenta siquiera conectar") fue un falso positivo de instrumentación: tanto el observador de WebSocket inyectado por R1 como la herramienta `read_network_requests` del navegador comparten un punto ciego para tráfico WebSocket nativo (no capturan el handshake/frames de una conexión `wss://` real, sólo XHR/fetch), por lo que "cero evidencia observada" fue interpretado incorrectamente como "cero conexión intentada". Sesión de seguimiento (2026-08-29): login real fresco con el fixture `P2T18_TYPINGFIX_`, apertura de la conversación específica del pedido (dispara `acquireOrderRoom`→`ensureConnected()`→`connectForEpoch()`), confirmado con evidencia directa y convergente: (1) `read_network_requests` mostró `/api/realtime/token` y `/api/realtime/authorize` en 200 — estas llamadas están gateadas secuencialmente DETRÁS de un `await this.ensureConnected()` exitoso en `acquireOrderRoom()` (`src/lib/realtime-manager.ts:305-307`), por lo que su éxito ya probaba lógicamente que el socket había conectado; (2) al volver a la vista de lista de chats (`chat-sheet.tsx`), el indicador de estado en vivo mostró **"● Conectado"** (no "Sin conexión"). El código de transporte actual, sin modificar, `transports:["websocket","polling"]` (`realtime-manager.ts:464`, `realtime-types.ts:141`) es correcto para el navegador real. Un fix especulativo (reordenar a `["polling","websocket"]`), verificado únicamente vía Node.js (que usa el paquete `ws`, no el `WebSocket` nativo del navegador, y no aplica CSP), fue implementado, luego revertido antes de esta sesión de seguimiento al descubrirse que Node no es un proxy válido para el comportamiento del navegador — decisión que esta investigación confirma como correcta: ese fix habría sido innecesario y potencialmente dañino (el transporte `polling` específicamente requiere `fetch`/XHR, que la CSP (`connect-src`, `src/proxy.ts:227`) bloquea hacia ese origen).
EVIDENCE_SUMMARY=Ver CORRECTED_ROOT_CAUSE. Evidencia original de R1 (Observation 1 y 2) se mantiene válida (servidor sano, timing no es la causa); sólo Observation 3 (interpretación "cero conexión intentada") queda invalidada.
IMPACT=Ninguno — no hay defecto de conexión real. La UX de typing en vivo depende ahora únicamente de si el guard de auto-eco de F-P1-02 se ejecuta correctamente sobre un canal que sí entrega el evento (no verificado en esta sesión — fuera de alcance, ver RELATION_TO_F_P1_02).
RELATION_TO_F_P1_02=NO_LONGER_BLOCKS — el canal de conexión está confirmado sano; la aceptación real-browser de F-P1-02 (matriz de 6 casos de typing) puede reintentarse sin este bloqueador, pero esa matriz completa NO fue re-ejecutada en esta sesión (fuera del alcance de esta corrección puntual) y por lo tanto F-P1-02 permanece sin PASS/FAIL — requiere una nueva etapa de aceptación.
RESOLUTION_TASK=CERRADO — ninguna corrección de código fue necesaria ni aplicada. Retirado como bloqueador activo.
BLOCKS=NINGUNO (retirado)
NEXT_ACTION=NINGUNA — finding cerrado. Ver F-P1-02 para el estado de aceptación pendiente.
```

**P2-T18-F-P1-02-REAL-BROWSER-ACCEPTANCE-R2 (2026-08-29)**, tras la
elección del usuario de reintentar la aceptación de F-P1-02 ahora que
el bloqueador de canal fue descartado: fixture fresca
`P2T18_F_P1_02_R2_` (1 Cliente + 1 Negocio + 1 Producto + 1 Pedido),
topología real X1/X2/Y1 en un único navegador (Cliente en dos pestañas
hermanas + Negocio en una tercera, coexistiendo gracias a
`AUTH01`/`AUTH02` `RESOLVED`). Baseline de chat bidireccional
confirmado `PASS` en ambas direcciones (mensajes visibles tras reabrir
el panel). Matriz de typing: **ningún indicador de "está
escribiendo..." apareció en NINGUNA de las direcciones probadas**
(X1→Y1, Y1→X1), pese a: conexión sana confirmada ("● Conectado" en
ambos actores), identidad correcta en los tokens JWT decodificados
(`sub` de cada token coincide exactamente con el `clienteId`/`negocioId`
real), política de scopes del servidor (`realtime-policy.ts:92-100`)
correctamente otorgando `chat:typing` a ambos actores para este
pedido, y grants recién renovados (reapertura del hilo inmediatamente
antes de cada intento). Se descartaron metódicamente: rate-limiting
del lado servidor (`typing: createRateLimiter(30, 10000)` — ritmo de
prueba muy por debajo del límite), expiración de grant (grants
recién renovados), y latencia de observación/render (probado con
espera explícita de 1s tras frentear la pestaña receptora, sin
cambio). **Prueba decisiva**: se envió un mensaje de chat NUEVO desde
Y1 sin nunca navegar/reabrir el hilo de X1 (que ya estaba montado y a
la vista) — el mensaje nunca apareció en X1 en vivo; sólo los dos
mensajes de baseline (enviados y vistos ANTES, vía el patrón de
"reabrir el panel" ya documentado en `F-P1-01`) eran visibles. Esto
demuestra que el "baseline de chat bidireccional PASS" de R1-R1 y de
esta misma etapa reflejaba entrega vía **HTTP + refetch al reabrir el
panel**, no push en vivo por WebSocket — el mismo patrón de
degradación graceful ya documentado para `F-P1-01`. **Conclusión: el
push en vivo servidor→cliente (`io.to(socketId).emit(...)`, tanto
`new-message` como `user-typing`) no llega al cliente en el navegador
real actual**, pese a que el socket muestra estado "conectado" y la
autorización REST/scopes es correcta en ambos extremos. Esto es un
defecto DISTINTO y más profundo que el retirado
`F-P2-T18-TYPING-CHANNEL-01` (que era sobre si la conexión se
establece; ésta es sobre si, una vez establecida, el servidor logra
empujar eventos de vuelta al cliente). Registrado como nuevo finding
`F-P2-T18-LIVE-PUSH-01` (ver abajo). Causa raíz NO investigada más
allá de este punto — por disciplina de alcance (evitar scope creep de
depuración de infraestructura dentro de una etapa de aceptación),
la investigación se detuvo aquí para reportar al usuario. Cero
mutación de producto/test/config, cero commit/push/deploy. Fixture
`P2T18_F_P1_02_R2_` y las 3 pestañas de navegador usadas, limpiadas en
su totalidad. `F_P1_02_CURRENT_STATUS=BLOCKED_BY_LIVE_PUSH_DEFECT`.

---

## F-P2-T18-LIVE-PUSH-01
```
FINDING_ID=F-P2-T18-LIVE-PUSH-01
TITLE=Los eventos push del servidor hacia el cliente (new-message, user-typing) no llegan al navegador real pese a conexión y autorización correctas — sólo se ven efectos vía HTTP+refetch al reabrir el panel
STATUS=PAUSED_EXTERNAL_INFRA_DEPENDENCY (2026-08-29 — decisión explícita del usuario: NO se cierra, NO se acepta como residual definitivo; queda en pausa por dependencia externa de infraestructura de Railway fuera del alcance de este flujo de trabajo de código. Investigación técnica completa hasta este punto: instrumentación temporal del servidor Y del cliente, ambas desplegadas y revertidas, MÁS reproducción cruzada en un segundo navegador/red independiente — evidencia cuádruple-convergente: el servidor emite, la UI nunca refleja, el handler de relay del cliente nunca se invoca, y el defecto reproduce IDÉNTICO en Chrome real sobre la red real del usuario — descarta la sandbox de pruebas como confusor; la brecha es genuinamente de entrega de transporte entre Railway y CUALQUIER cliente, no específica de esta herramienta de testing. NO se investiga más Railway hasta nueva instrucción explícita del usuario — instrucción expresa: "no seguir investigando Railway en esta tarea ni crear más retries automáticos")
SEVERITY=MEDIUM_TO_HIGH (deriva de evidencia, no asumida — afecta CUALQUIER feature dependiente de push en vivo por socket: typing, mensajes nuevos en vivo, posiblemente unread-update/repartidor-location; ningún dato se pierde — todo es recuperable al reabrir/refrescar — pero la UX "en tiempo real" prometida por la UI no se cumple en absoluto en el navegador real actual)
DISCOVERED_IN=P2-T18-F-P1-02-REAL-BROWSER-ACCEPTANCE-R2 (2026-08-29), durante el reintento de la matriz de aceptación de 6 casos de typing de F-P1-02
ROOT_CAUSE=NO_IDENTIFICADA_EXACTAMENTE, pero la BRECHA se acotó decisivamente. Candidatos DESCARTADOS con evidencia directa (investigación de seguimiento, 2026-08-29, disposición A del usuario "investigar/corregir ahora" repetida dos veces sobre este finding): (a) DESCARTADO — infraestructura multi-réplica del chat-service: `railway status --json` confirma `numReplicas:1` en TESTING; (b) DESCARTADO — defecto de reconexión/re-join tras expiración de token: typing probado en una conexión RECIÉN establecida (<2 minutos desde login, antes de cualquier ciclo de expiración de 120s) — el defecto está presente DESDE LA PRIMERA conexión; (c) DESCARTADO — bug de wiring del relay cliente: lectura de código confirma que `subscribe()` (`realtime-manager.ts:371`) adjunta el relay al socket actual de forma proactiva, sin dependencia de orden subscribe-vs-connect. **Confirmado con evidencia directa del SERVIDOR** (instrumentación temporal desplegada a TESTING, observada, y revertida — commits `bb795a1`→`55334ba`, chat-service byte-idéntico al estado previo tras el revert): con logging agregado en `join-order-room` y `typing`, se confirmó `join_ok` para ambos actores (scopes `chat:read,chat:typing` correctamente otorgados) y, al emitir typing, `typing_received ... candidates=2 emitted=1 connectedUsersSize=2` — es decir, **el servidor SÍ recibe el evento, SÍ encuentra al destinatario autorizado, y SÍ llama a `io.to(socketId).emit("user-typing", payload)` exitosamente** contra un socket actualmente conectado. Pese a esto, la UI del receptor NUNCA mostró el indicador en la misma prueba. Esto DESCARTA por completo la cadena de lógica del servidor (autorización, scopes, rate-limiting, selección de destinatario, llamada a emit) como causa — la brecha está exclusivamente entre "el servidor llamó a `io.to(socketId).emit(...)`" y "el navegador ejecutó el handler de `user-typing`". Candidatos restantes, ninguno confirmado: (d) buffering/proxy intermedio de Railway que permite el handshake y el tráfico cliente→servidor pero retiene/descarta frames servidor→cliente específicamente; (e) un bug en el manejo del lado cliente MÁS ALLÁ del wiring de `subscribe()` ya descartado — por ejemplo, dentro del handler mismo de `attachEventRelay` (`realtime-manager.ts:948-966`, que envuelve cada llamada a un subscriber en un `try/catch` que traga silenciosamente cualquier excepción — línea 956-960 — lo que podría estar ocultando un error real sin dejar rastro en consola); (f) alguna otra causa no contemplada. **Confirmado con evidencia directa del CLIENTE** (segunda instrumentación temporal, esta vez en el código PRINCIPAL de la app — `src/lib/realtime-manager.ts`, `attachEventRelay` — desplegada a TESTING vía DeliGO Copy, observada, y revertida — commits `32a86b3`→`c05525a`, ambos archivos confirmados byte-idénticos al estado previo tras los revert): se agregó logging al handler interno que Socket.IO invoca en el navegador cuando llega CUALQUIER evento del servidor (`relay_fired`) y se expuso cualquier excepción que un subscriber lanzara (antes silenciada por un `try/catch` vacío). Con ambos actores recién logueados y sus hilos de chat abiertos, se disparó typing y se leyó la consola del navegador del receptor en tiempo real (confirmado que `console.log` SÍ se captura en este build — se veía la línea `[SW] Service worker registered successfully` — y confirmado independientemente, vía `fetch(chunkUrl, {cache:'no-store'})`, que el chunk servido por el servidor SÍ contenía el código nuevo): **`relay_fired` NUNCA apareció en la consola, para NINGÚN evento**, ni en el emisor ni en el receptor. Esto significa que el handler `socket.on(event, ...)` del navegador — el punto de entrada donde Socket.IO invoca código de la app cuando un frame del servidor llega — nunca se ejecuta, para ningún evento de la aplicación, en toda la sesión. Combinado con la evidencia del servidor (R4: el servidor sí llama a `emit` exitosamente), esto es **evidencia triple-convergente y consistente**: (1) la UI nunca refleja push en vivo, (2) el servidor confirma que sí emite, (3) el propio código del cliente confirma que su handler de recepción nunca se invoca. La brecha está específicamente en la ENTREGA DE TRANSPORTE — el frame que Socket.IO server envía nunca llega a ejecutar el listener `socket.on()` en el navegador — no en ninguna lógica de aplicación (ni servidor ni cliente). El candidato más plausible que queda es (d): algún componente de infraestructura entre Railway y el navegador (proxy/edge/load balancer) que permite el handshake WebSocket y el tráfico cliente→servidor pero descarta o nunca entrega frames servidor→cliente en esa misma conexión — algo que ninguna instrumentación de código de aplicación (servidor o cliente) puede diagnosticar más allá de este punto; requeriría inspección de la configuración de red/proxy de Railway, o una prueba de eco WebSocket de bajo nivel independiente de Socket.IO.
EVIDENCE_SUMMARY=Matriz de 6 casos de typing (R2): 0/6 indicadores en ninguna dirección, con conexión/identidad/scopes/grants confirmados sanos. Prueba de conexión fresca (R3): typing falló también en una conexión recién establecida (<2 min), descartando reconexión/expiración como causa. `railway status --json` (R3): 1 sola réplica activa, descartando sharding. Lectura de código (R3): wiring de `subscribe()`→`attachEventRelay()` correcto. **Instrumentación temporal del servidor (R4)**: logs con timestamp confirman `join_ok` (scopes correctos, ambos actores) y `typing_received ... candidates=2 emitted=1` — el servidor emite correctamente hacia un socket conectado — mientras la UI del receptor, verificada en el mismo instante, no mostró nada. **Instrumentación temporal del cliente (R5, decisiva)**: `relay_fired` (el punto de entrada donde el navegador recibe cualquier evento del servidor) nunca se registró en consola, para ningún evento, en ninguno de los dos actores — confirmando que el frame nunca llega a ejecutar código de aplicación en el navegador, pese a que el servidor sí lo emitió. Ambas instrumentaciones revertidas inmediatamente después de cada observación (commits `55334ba` y `c05525a`, ambos archivos confirmados byte-idénticos al estado pre-diagnóstico vía `git diff`).
IMPACT=El indicador de "está escribiendo..." no funciona (bloquea F-P1-02). Los mensajes de chat NO aparecen en vivo — sólo al reabrir/refrescar el panel (degradación graceful ya documentada parcialmente en F-P1-01, pero ahora entendida como síntoma de esta causa más amplia, no como un bug aislado de esa UI específica). Sin pérdida de datos confirmada — todo persiste vía HTTP y se refleja al reabrir.
RELATION_TO_F_P1_02=BLOCKS_ACCEPTANCE — el guard de auto-eco de F-P1-02 nunca llega a ejecutarse porque el evento `user-typing` nunca llega a ningún receptor, propio o ajeno.
RELATION_TO_F_P1_01=POSIBLEMENTE_LA_MISMA_CAUSA_RAÍZ — F-P1-01 (unread stale hasta el próximo poll) podría ser un síntoma del mismo defecto de push en vivo, no un bug aislado de UI — no confirmado, requiere investigación futura.
RESOLUTION_TASK=NINGUNA TODAVÍA — toda la lógica de aplicación (servidor Y cliente) fue descartada con evidencia directa de logs reales, y el defecto fue reproducido de forma idéntica en un navegador/red completamente independiente (Chrome real del usuario, no la sandbox de pruebas), descartando esa sandbox como confusor. Se agotaron las vías de diagnóstico disponibles vía código/CLI de Railway de sólo lectura (`railway status --json` confirmó 1 réplica; `railway logs --network --json` no mostró paquetes descartados en una muestra, aunque sin correlación fina al instante exacto del test). El siguiente paso, si se continúa, requiere inspección/soporte de infraestructura de Railway fuera de las herramientas de código de este proyecto, o aceptar el residual. Requiere disposición explícita del usuario
BLOCKS=F-P1-02 (no puede certificarse mientras el push en vivo no llegue); posiblemente relacionado con F-P1-01 (ver arriba)
NEXT_ACTION=PENDING_USER_DISPOSITION
```

---

## F-P2-T18-AUTH01
```
TITLE: SAME_BROWSER_MULTI_ACTOR_SESSION_COLLISION — Cliente y Negocio no pueden coexistir autenticados en el mismo navegador/perfil
STATUS: RESOLVED (R13-R7, 2026-08-29 — matriz de 18/18 PASS con navegador real, ver narrativa al final de este finding)
ROOT_CAUSE: SESSION_COOKIE_NAME="deligo_session" (src/lib/auth.ts:224) es global para cliente/negocio/repartidor/superadmin — un segundo login sobrescribe el valor de la cookie en el navegador (mismo nombre, mismo path="/"), aunque la fila Sesion DB del primer actor permanece 100% válida (ningún login revoca sesiones de otro userId). Descubierto durante P2-T18-STAGE7-R2-RETRY-2 al intentar establecer topología X1+X2+Y1 simultánea con navegador real conectado.
IMPACT: bloquea F-P1-02 browser acceptance con navegador único; bloquea el caso de uso legítimo de un mismo usuario/staff operando Cliente y Negocio a la vez en un mismo navegador. NO es una vulnerabilidad de seguridad (ninguna Sesion ajena se lee/filtra; peor caso es re-login).
EVIDENCE_SUMMARY: confirmado empíricamente (pantalla de conflicto de sesión) en Stage7-R2-RETRY-2, y confirmado por lectura directa de código en P2-T18-BLOCKER-AUTH1 (src/lib/auth.ts, src/app/api/auth/login/route.ts, src/app/api/auth/me/route.ts, src/app/api/auth/logout/route.ts, src/store/auth-store.ts, src/providers/realtime-provider.tsx, src/app/api/realtime/token/route.ts). Además confirmado CROSS_TAB_MULTI_ACTOR_COLLISION_RISK=SI: el listener cross-tab de realtime-provider.tsx dispara logout() global ante cualquier user:null en localStorage["deligo-auth"], sin distinguir actor.
CLASSIFICATION: HISTORICAL_CLASSIFICATION=C_ONLY_DB_MULTI_SESSION_WAS_PREVIOUSLY_SOLVED — nunca fue una regresión (SESSION_LOGIN_ATOMICITY_DEBT sólo resolvió atomicidad DB de logins concurrentes DEL MISMO actor, nunca cookie coexistence entre actores distintos).
RESOLUTION_TASK: diseño mínimo congelado en P2-T18-BLOCKER-AUTH1 (SELECTED_DESIGN_ID=OPTION_A_ACTOR_FAMILY_SCOPED_SESSION_COOKIES, SCHEMA_CHANGE_REQUIRED=NO), reconciliado en AUTH2-R2-R1 (autoridad correcta: src/proxy.ts, no middleware.ts — Next.js 16 falla el build si ambos coexisten), implementado localmente en AUTH2-R2-R2 (Fase 1 completa: src/proxy.ts, src/lib/auth.ts, login/route.ts, logout/route.ts, 5 archivos de test, 73/73 tests PASS, R2_R2_SECURITY_MATRIX=12_OF_12_PASS, build PASS), revisado adversarialmente en AUTH2-R3 (R3_SECURITY_MATRIX=16_OF_16_PASS, bloqueado sólo por proceso/alcance), reconciliado con autorización externa explícita del usuario en AUTH2-R3-R1 (excepción única y puntual del hunk de tipos de req() en proxy.test.ts, 18/18 condiciones de PASS verificadas con contrapunto contrafactual ejecutado, R3_R1_SECURITY_MATRIX=16_OF_16_PASS, 73/73 tests frescos, cero mutación de source/test), commiteado localmente en AUTH2-R4 (commit c047e9eb67e97ca1b9c1ae78b4c2725f44b02ebb, parent 1adcc01f5380d896bed6e46dcd11bccb90d39e07, subject "feat: add actor-family session cookie foundation", 9/9 blobs commiteados idénticos a los certificados por AUTH2-R3-R1, sin drift) recertificado de forma independiente en AUTH2-R5 directamente desde los objetos Git (9/9 blobs re-derivados/re-hasheados, diff completo clasificado sin hunks sin clasificar ni de Fase 2, R5_SECURITY_MATRIX=16_OF_16_PASS re-derivada desde cero, 73/73 tests frescos tras confirmar que un fallo aislado de un test de concurrencia real contra DB era un flake transitorio no relacionado, lint/TSC/build sin regresiones, working tree idéntico a HEAD) y desplegado/certificado en TESTING en AUTH2-R6: revalidación fresca prepush (73/73 a la primera corrida decisiva, 16/16 seguridad, lint/TSC/build PASS), un único git push (1adcc01f..c047e9eb), autodeploy Git-triggered de DeliGO Copy y chat en vivo ambos SUCCESS con commitHash exacto confirmado desde metadata de Railway, y matriz runtime de 16/16 PASS contra el backend real desplegado (login individual compatible, coexistencia simultánea de ambas cookies de familia, aislamiento por path verificado por ID/slug exacto, selector conflictivo/malformado/desconocido fail-closed, header spoofeado sin autoridad, sin Set-Cookie de resolución, sin fallback cruzado, logout acotado por familia, transición legacy sin fuga), y con el contrato de Fase 2 (activación cliente) revalidado y re-congelado en AUTH2-R7: allowlist de producto ampliado a 7 archivos (3 callers de /api/auth/me no detectados antes: use-suspension-check.ts, login/page.tsx, auth-modal.tsx; realtime-manager.ts removido — no requiere cambio, realtime-client.ts deriva la familia de pathname por sí mismo), fuente de verdad de familia activa (pathname), diseño de storage namespaced sin migrar los 26 consumidores actuales del store, transición legacy sin migración explícita, aislamiento cross-tab same/cross-family, selector reutilizando el transporte ya certificado de Fase 1, matriz de seguridad de 20 casos y aceptación de 10 puntos — todo congelado sin mutar código, y con esa Fase 2 IMPLEMENTADA localmente en AUTH2-R8: los 7 archivos de producto congelados por R7 modificados exactamente (familia activa derivada de pathname, storage namespaced por familia sin cambiar la forma pública del store, listener cross-tab consciente de familia, selector ?actorFamily= en los 4 endpoints compartidos vía sus 4 callers reales, RealtimeManager/realtime-types/Fase1 server byte-idénticos verificados dos veces), 4 archivos de test (1 modificado + 3 nuevos), 130/130 tests PASS, 20/20 casos de seguridad y 10/10 de aceptación local satisfechos, lint/TSC/build limpios, sin commit todavía. Fase 1 (server, ya desplegada en TESTING) y Fase 2 (cliente, implementada localmente) juntas cubren la coexistencia real Cliente+Negocio — sólo falta commitear/certificar/desplegar Fase 2 y certificar con navegador real. El long-tail diferido (Fase 3) sigue sin iniciarse — ver codex-reports/CURRENT_TASK.md para el detalle completo. AUTH2-R9 (2026-08-28) ejecutó la revisión adversarial precommit de esos 11 paths: re-derivó el fileset/diff/callers/vecinos byte-congelados desde cero (sin contradicción con R7/R8), ejecutó 18/18 casos de ataque de boundary de pathname, y corrió mutation testing aislado fuera del repo (12 mutantes) — 10/12 detectados, 2/12 sobrevivientes (un `getItem` de storage sin cobertura de rehidratación en auth-store.test.ts; un listener cross-tab cuyo contrato estático de P2-T11 no detectaría un bypass OR agregado a la clave legacy). Ambos gaps son de cobertura de TEST, no de producto — el código real fue verificado correcto por lectura directa en los dos casos. Por regla explícita de la etapa (mutante sobreviviente sin prueba de arnés inválido → BLOCK, sin corrección de test en R9), la conclusión es BLOCK: el diff de R8 se preserva intacto, sin ningún cambio de código de producción, y se define un único follow-up focal (P2-T18-BLOCKER-AUTH2-R9-R1) para cerrar exactamente esas dos piezas de cobertura de test.
BLOCKS: P2-T18 F-P1-02 browser acceptance con navegador único (permanece BLOCKED_BY_AUTH_SESSION_COEXISTENCE hasta que se certifique con navegador real la coexistencia same-browser)
NEXT_ACTION: P2-T18-BLOCKER-AUTH2-R13-R1 (corrección focal aislada del defecto F-P2-T18-AUTH02, luego repetir R13 completa desde cero para 18/18). AUTH2-R12 (2026-08-28) pusheó y desplegó Fase 2 en TESTING: revalidación decisiva fresca (133/133 tests, 20/20 seguridad, 10/10 aceptación, mutation authority 12/12 por identidad de blobs, lint/TSC/build limpios), un único git push (c047e9eb..a1579f11), autodeploy Git-triggered de DeliGO Copy y chat en vivo ambos SUCCESS con commitHash=a1579f11 exacto confirmado desde metadata real de Railway, health pre/postdeploy limpio, y smoke de regresión de Fase 1 server sin navegador (fail-closed uniforme, sin fuga de Set-Cookie, sin 5xx). PHASE2_DEPLOYED_FROM_EXACT_COMMIT=SI; PHASE2_BROWSER_BEHAVIOR_CERTIFIED=NO (esperado, diferido a R13). Fase 2 queda PHASE2_DEPLOYED_TESTING_AWAITING_SAME_BROWSER_REAL_ACCEPTANCE. AUTH2-R13 (2026-08-28) ejecutó la certificación real-browser con Chrome real (Claude in Chrome, navegador elegido explícitamente por el usuario) contra TESTING desplegado en `a1579f11`: confirmó con evidencia de red real y UI real 9 de los 18 puntos de la matriz de aceptación — login real de Cliente y Negocio en el mismo navegador, coexistencia simultánea de ambas cookies de familia y ambos namespaces de storage, Cliente sobreviviendo sin recarga al login de Negocio (repro directo del ataque original de AUTH01, sin colisión), reload determinístico para ambos actores (incluida una ronda alternada adicional), y selectores de `realtime/token`+`realtime/authorize` correctos para Cliente vía un chat real abierto sobre un Pedido fixture mínimo autorizado explícitamente por el usuario. A mitad de la matriz se descubrió, con evidencia de red real (200 antes del login de Negocio, 401 consistente después), un defecto real de producto — registrado por separado como **F-P2-T18-AUTH02** — que bloqueó la continuación del resto de la matriz. Por regla explícita de la etapa no se corrigió nada: R13 concluye **BLOCKED_REAL_BROWSER_PRODUCT_DEFECT**, `F_P2_T18_AUTH01_STATUS=OPEN_REAL_BROWSER_DEFECT_ISOLATED` (el núcleo cookie/storage/reload/realtime-connection de AUTH01 está confirmado funcionando; el defecto aislado es un gap DISTINTO, nunca cubierto por el allowlist de 4 endpoints de Fase 1/Fase 2). Fixtures (1 Cliente + 1 Negocio + 1 Producto + 1 Pedido, éste último autorizado explícitamente por el usuario más allá del cap original de 2) y 2 filas Sesion huérfanas limpiadas en su totalidad (0 remanentes). Git final `HEAD=ORIGIN=a1579f11`, `AHEAD=0`/`BEHIND=0`, `src/` sin cambios. Detalle completo en `codex-reports/CURRENT_TASK.md`. Siguiente tarea: `P2-T18-BLOCKER-AUTH2-R13-R1` (corrección focal única del defecto aislado F-P2-T18-AUTH02).
```

## F-P2-T18-AUTH02
```
TITLE: Endpoints compartidos /api/chat/* (excepto /cleanup) y /api/push/subscribe+unsubscribe devuelven 401 para AMBOS actores bajo coexistencia real de 2+ cookies de familia en el mismo navegador
STATUS: RESOLVED (R13-R7, 2026-08-29 — CASE_09 confirmó con navegador real que no-leidos/conversaciones/mensajes/realtime-token/realtime-authorize responden 200 para ambos actores coexistiendo, síntoma no reproducido)
SEVERITY: FUNCIONAL (no seguridad — fail-closed, nunca fuga ni autorización incorrecta entre actores)
DISCOVERED_IN: P2-T18-BLOCKER-AUTH2-R13, durante la certificación real-browser de F-P2-T18-AUTH01 — nunca observable en ninguna etapa previa porque ninguna había ejercido coexistencia real de 2+ familias en un navegador real contra endpoints fuera del allowlist de 4 (`/api/auth/me`, `/api/auth/logout`, `/api/realtime/token`, `/api/realtime/authorize`).
ROOT_CAUSE: `src/app/api/chat/no-leidos/route.ts`, `src/app/api/chat/conversaciones/route.ts`, `src/app/api/chat/mensajes/[pedidoId]/route.ts` y `src/app/api/push/subscribe/route.ts` leen `req.cookies.get("deligo_session")` (nombre legacy) directamente, dependiendo enteramente de que `src/proxy.ts` reescriba esa cookie con el token resuelto. Estos paths caen bajo `AUTH_REQUIRED_PREFIXES` en `proxy.ts` (`/api/chat`, `/api/push/subscribe`, `/api/push/unsubscribe`) — una categoría que NUNCA fue incluida en `SELECTOR_ENDPOINT_PREFIXES` (el allowlist de 4 endpoints congelado desde R6/R7) ni deriva familia del path (a diferencia de `ROLE_PROTECTED_ROUTES`). `resolveActorSession()` cae en su rama de fallback (líneas ~121-130): con exactamente 1 cookie de familia candidata resuelve sin ambigüedad (comportamiento histórico pre-Fase2); con 2+ candidatas — exactamente la coexistencia real que Fase 2 fue construida para habilitar — devuelve `{family:null, token:null}` por diseño fail-closed, y el route handler nunca recibe cookie reescrita.
IMPACT: el badge de mensajes no leídos y el listado de conversaciones de chat dejan de funcionar (401) para AMBOS actores mientras coexistan 2+ familias autenticadas en el mismo navegador. La conexión realtime YA establecida (socket, room ya otorgado vía `acquireOrderRoom`) NO se ve afectada — sólo estas llamadas REST puntuales.
EVIDENCE_SUMMARY: reproducido con evidencia de red real (no sintética): `/api/chat/no-leidos` y `/api/chat/conversaciones` devolvieron 200 de forma consistente ANTES del login de Negocio (sólo cookie Cliente presente) y 401 de forma consistente DESPUÉS (ambas cookies de familia coexistiendo) — mientras que endpoints CON selector (`/api/auth/me`, dashboard de Negocio) siguieron funcionando sin problema en todo momento, aislando el defecto exactamente a esta categoría.
RESOLUTION_TASK: root-cause/caller/allowlist reconciliado en P2-T18-BLOCKER-AUTH2-R13-R1 (2026-08-28, read-only, PASS); implementado localmente en P2-T18-BLOCKER-AUTH2-R13-R2 (2026-08-28, PASS); auditado adversarialmente en P2-T18-BLOCKER-AUTH2-R13-R3 (2026-08-28, BLOCKED por gap de cobertura de test aislado — M9); gap M9 cerrado en P2-T18-BLOCKER-AUTH2-R13-R3-R1 (2026-08-28, PASS); recertificación completa desde cero en P2-T18-BLOCKER-AUTH2-R13-R3-RETRY (2026-08-28, BLOCKED por un SEGUNDO gap de cobertura de test aislado y distinto — M19-NEW); gap M19-NEW cerrado en P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-R1 (2026-08-28, PASS); recertificación final desde cero en P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2 (2026-08-29, BLOCKED — AUTH02 en sí 100% verde, BLOCK por un fallo de regresión ajeno); investigación aislada de ese fallo en P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R1 (2026-08-29, clasificación INCONCLUSIVE_EXTERNAL_DB_INSTABILITY); gate de regresión fresca de certificación en P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R2 (2026-08-29, BLOCKED — SEGUNDO fallo consecutivo del mismo caso exacto SEC-BLOCK-1); disposición read-only del fallo repetido en P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R2-R1 (2026-08-29, PASS — disposición determinada: EXTERNAL_TESTING_DB_RELIABILITY_LIMITATION); decisión de producto/proceso del usuario en P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R2-R1A (2026-08-29, PASS — DB dedicada diferida, AUTH02 precommit aceptado con una excepción de infraestructura acotada, R13-R4 autorizado); commit local exacto en P2-T18-BLOCKER-AUTH2-R13-R4 (2026-08-29, PASS — `fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f`); recertificación postcommit/prepush independiente en P2-T18-BLOCKER-AUTH2-R13-R5 (2026-08-29, PASS); push + deploy TESTING certificado en P2-T18-BLOCKER-AUTH2-R13-R6 (2026-08-29, PASS — `fe0e11d0` desplegado, DeliGO Copy y chat en vivo ambos SUCCESS, ver detalle abajo).
BLOCKS: F-P2-T18-AUTH01 no puede pasar a RESOLVED/18-of-18 hasta que R13 se repita completa (18/18 desde cero) contra Chrome real
NEXT_ACTION: P2-T18-BLOCKER-AUTH2-R13-R7 — FULL REAL-BROWSER REPLAY FROM ZERO contra el commit desplegado `fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f`
```

**R13-R1 (2026-08-28, read-only, PASS)** reconcilió causa raíz,
inventario de endpoints/callers y contrato de fix exacto, sin mutar
código. Confirmó el mecanismo preciso: el rewrite de cookie en
`src/proxy.ts` es incondicional a `AUTH_REQUIRED_PREFIXES` — depende
sólo de si `resolved.token` es truthy — así que **cualquier** endpoint
que lea `deligo_session`/`SESSION_COOKIE_NAME` directamente sufre la
misma ambigüedad bajo 2+ cookies de familia, esté o no en
`AUTH_REQUIRED_PREFIXES`. Esto reveló un **hallazgo de alcance
ampliado no visto en R13**: `/api/push/status` (fuera de
`AUTH_REQUIRED_PREFIXES`, pero con el mismo patrón de lectura directa)
también está afectado y debe incluirse en el fix. Confirmó por lectura
directa de código que `/api/push/unsubscribe` SÍ está afectado (R13
sólo lo daba como "probable"). Clasificó `/api/chat/cleanup` como
`NOT_GENERIC_SESSION` (secreto cron, público) y `/api/pedidos`
(creación)+`/api/pedidos/[id]/tracking` como `PHASE3_DEFERRED` (mismo
patrón pero degradación silenciosa a invitado, no un 401 duro, nunca
ejercido por R13, fuera del alcance aislado autorizado). Enumeró
exhaustivamente los 11 call sites reales (6 Chat en 4 archivos, 5 Push
en 2 archivos, 0 callers no-browser) y descubrió que la fuente de
familia confiable NO es uniforme: a diferencia de los 4 endpoints
originales (donde `activeSessionFamily(pathname)` funciona porque las
llamadas ocurren en páginas con prefijo de familia garantizado), los
componentes de Chat (`ChatFab`/`ChatSheet` vía `ChatProvider`) y
`PermissionPrompt` están montados en el ROOT layout — activos en
cualquier ruta — así que la fuente correcta es
`useAuthStore().user?.type` (ya disponible en cada closure, sin
problema de bootstrap porque el actor ya está autenticado en el
momento de cada llamada); `share-target-flow.tsx` usa en cambio su
prop `role` explícito. Congeló: allowlist de producto de 7 archivos
(`src/proxy.ts` + 4 Chat + 2 Push, ningún route handler), allowlist de
test de 7 (4 modificados + 3 nuevos, 3 archivos de producto sin
ninguna cobertura de test hoy), matriz de seguridad de 20 casos y de
aceptación local de 12, y la regla de que single-family/selector
ausente preservan el comportamiento actual sin regresión. Sin BLOCK —
ninguna de las condiciones A-J aplicó; el alcance ampliado se
clasificó como profundización de la MISMA causa raíz, no como un
segundo defecto independiente. `P2_T18_BLOCKER_AUTH2_R13_R1=PASS_AUTH02_ROOT_CAUSE_SCOPE_AND_FIX_CONTRACT_REFROZEN`.
Cero mutación de código/test/commit/push/deploy. Detalle completo en
`codex-reports/CURRENT_TASK.md`; R13 archivado en
`codex-reports/archive/P2-T18-BLOCKER-AUTH2-R13.md`. AUTH2-R13-R2
(2026-08-28) implementó localmente ese contrato exacto, sin ampliarlo:
6 prefijos nuevos en `SELECTOR_ENDPOINT_PREFIXES` (`src/proxy.ts`) y
los 11 call sites productivos (6 Chat en 4 archivos, 5 Push en 2
archivos) enviando `?actorFamily=` desde la fuente congelada por
caller (`useAuthStore().user?.type` en 9 de 11, `role` prop en los 2
de `share-target-flow.tsx`) — cero route handlers tocados
(confirmado por fingerprint SHA-256 idéntico pre/post en los 6
handlers + 11 vecinos congelados). 4 archivos de test existentes
modificados (con corrección de aserciones literales que dependían del
texto exacto anterior, sin debilitar ninguna) + 3 archivos de test
nuevos creados (cobertura previamente inexistente para
`chat-fab.tsx`/`chat-view.tsx`/`share-target-flow.tsx`). Autoridad
focal 117/117 PASS; regresión completa 294/294 PASS (Fase1/Fase2
unit+integration con DB real vía `DELIGO_TEST_DATABASE_URL`, P2-T13
focal, 4 route tests de Chat/Push); 0 errores ESLint/TSC nuevos (2
diagnósticos TS2367 preexistentes en `permission-prompt.tsx`
confirmados idénticos contra el blob del commit `a1579f11`, no
tocados); `git diff --check` y `npm run build` ambos PASS. Diff
completo (20 hunks) clasificado 100% en 3 clases (extensión de proxy,
propagación Chat, propagación Push), 0 hunks de limpieza incidental.
Sin commit/push/deploy — `P2_T18_BLOCKER_AUTH2_R13_R2=PASS_AUTH02_FOCUSED_LOCAL_IMPLEMENTATION`,
`F_P2_T18_AUTH02_STATUS=LOCAL_IMPLEMENTED_AWAITING_ADVERSARIAL_PRECOMMIT_REVIEW`.
Detalle completo en `codex-reports/CURRENT_TASK.md`; R13-R1 archivado
en `codex-reports/archive/P2-T18-BLOCKER-AUTH2-R13-R1.md`. Siguiente
tarea: `P2-T18-BLOCKER-AUTH2-R13-R3` (revisión adversarial precommit),
no ejecutada. AUTH2-R13-R3 (2026-08-28) auditó adversarialmente el
diff exacto de R13-R2 desde un harness fuera del repo (junction a
`node_modules` + copia del working tree, eliminado al finalizar):
releyó los 20 hunks completos, re-derivó el inventario de 11 callers y
el modelo fail-closed, y corrió una campaña de **19 mutantes**
semánticos — **17 detectados**. 2 sobrevivieron: uno (`/api/chat/cleanup`
agregado por error al selector) confirmado **mutante equivalente**
(cleanup nunca lee la cookie resuelta, ningún test podría distinguirlo
sin consecuencia observable — no es un hallazgo); el otro (en
`use-push-notifications.ts`, el `fetch()` de `subscribe` dejando de
usar `subscribeUrl`) **sobrevivió genuinamente** — confirmado por
lectura directa de código que el producto SÍ está implementado
correctamente (`fetch(subscribeUrl, {` en la línea real), pero
`use-push-notifications-static-contract.test.ts` sólo verificaba la
declaración de la variable, nunca que `fetch()` la consumiera —
exactamente la misma verificación que SÍ existe para `unsubscribeUrl`/
`statusUrl`. Clasificado `TEST_COVERAGE_GAP`, nunca `PRODUCT_DEFECT`.
`P2_T18_BLOCKER_AUTH2_R13_R2=PASS_AUTH02_FOCUSED_LOCAL_IMPLEMENTATION`
y `P2_T18_BLOCKER_AUTH2_R13_R2_R1=PASS_...` preservados sin degradar
— el diff de producto queda certificado correcto por esta misma
etapa; sólo la protección de test necesita una corrección puntual.
`P2_T18_BLOCKER_AUTH2_R13_R3=BLOCKED_AUTH02_PRECOMMIT_ADVERSARIAL_FINDING`.
Fingerprint 14/14 y 17/17 idéntico antes/después, cero mutación real
de repo. Detalle completo en `codex-reports/CURRENT_TASK.md`; R13-R2-R1
archivado en `codex-reports/archive/P2-T18-BLOCKER-AUTH2-R13-R2-R1.md`.
Siguiente tarea: `P2-T18-BLOCKER-AUTH2-R13-R3-R1` (corrección focal
exclusiva de test), no ejecutada.

**R13-R3-R1 (2026-08-28, test-only, PASS)** cerró exactamente ese gap
(mutante M9), sin tocar producto ni ningún otro archivo de test.
Recuperó el contrato exacto desde el R13-R3 recién archivado
(`bf73b31fe7433e20fa49fc620937febfdf3b3ed1c93820c33395385b0777096f`),
confirmó por lectura directa que `use-push-notifications.ts` línea 247
consume realmente `fetch(subscribeUrl, {` (producto correcto, sin
tocar), y reprodujo el mutante M9 fuera del repo en un harness
temporal (junction a `node_modules` + copia de `src/`, eliminado al
cierre) contra el test sin corregir: sobrevivió (29 pass/0 fail),
confirmando el gap antes de tocar ningún archivo real. Agregó una
única assertion (`expect(src).toContain("fetch(subscribeUrl")`) dentro
del test ya existente `"all three call sites... build their URL from
actorType..."` de `use-push-notifications-static-contract.test.ts`
— sin crear ningún `test()`/`describe()` nuevo (29 tests antes y
después, `expect()` calls 99→100), mismo patrón exacto ya usado para
`unsubscribeUrl`/`statusUrl`. Replay del mismo mutante en el harness
contra el test corregido: detectado (28 pass/1 fail, exactamente la
nueva assertion). Harness restaurado desde backup (byte-idéntico por
SHA-256) y eliminado por completo. 7 archivos de producto y 6 archivos
de test no-objetivo confirmados byte-idénticos antes/después. 117/117
focal AUTH02 PASS (idéntico a R13-R2). ESLint limpio, TSC 31 raw/24
distinct (0 nuevos), `git diff --check` limpio. Diff completo del
archivo objetivo releído: único cambio es la nueva assertion, sin
remociones ni debilitamiento de ninguna existente. No se re-ejecutó la
campaña completa de 19 mutantes ni la regresión de 294 — corresponden
a `P2-T18-BLOCKER-AUTH2-R13-R3-RETRY`.
`P2_T18_BLOCKER_AUTH2_R13_R2=PASS_AUTH02_FOCUSED_LOCAL_IMPLEMENTATION`
preservado sin degradar; `M3_CLASSIFICATION_PRESERVED=EQUIVALENT_MUTANT_NO_OBSERVABLE_IMPACT`
(`proxy.ts` no tocado). R13-R3 permanece históricamente `BLOCKED`, no
se reescribe. `P2_T18_BLOCKER_AUTH2_R13_R3_R1=PASS_AUTH02_M9_TEST_COVERAGE_GAP_CLOSED`.
Git final idéntico `HEAD=ORIGIN=a1579f11`, `AHEAD=0`/`BEHIND=0`,
índice vacío, sin commit/push/deploy. Detalle completo en
`codex-reports/CURRENT_TASK.md`; R13-R3 archivado en
`codex-reports/archive/P2-T18-BLOCKER-AUTH2-R13-R3.md`. Siguiente
tarea: `P2-T18-BLOCKER-AUTH2-R13-R3-RETRY` (repetición completa desde
cero, no continuación, de la revisión adversarial precommit), no
ejecutada.

**R13-R3-RETRY (2026-08-28, recertificación adversarial completa desde
cero, BLOCK)** no aceptó como prueba suficiente ningún resultado
histórico (117/117, 294/294, los propios PASS de R13-R2/R13-R3-R1) —
re-derivó fileset, diff completo (20 hunks), modelo fail-closed, 11
callers, composición de URL y route handlers byte-frozen
independientemente. Su revisión de fuerza de test "desde cero" (no
sólo confirmar que M9 seguía parcheado) clasificó los 11 call sites
por declaración-vs-consumo verificado, encontrando un SEGUNDO gap real
y aislado, distinto de M9: `savePushSubscription` en
`src/components/shared/permission-prompt.tsx` declara
`const url = family ? ... : "/api/push/subscribe"` pero
`permission-prompt-static-contract.test.ts` sólo verifica esa
declaración, nunca que `fetch(url` sea el call site real consumido —
gap nunca atacado por los 19 mutantes originales de R13-R3 (que para
este archivo sólo atacaron el caller, M12/M12b, no la consumición
interna). Confirmado por mutación real en un harness externo nuevo
(distinto del de R13-R3/R13-R3-R1, eliminado al cierre): el mutante
sobrevivió (11 pass/0 fail) mientras que los 18/19 mutantes originales
no-equivalentes SÍ fueron detectados (M9 ahora recertificado correcto,
M3 reconfirmado equivalente). Confirmado por código que el producto es
correcto — `TEST_COVERAGE_GAP`, nunca `PRODUCT_DEFECT`.
`P2_T18_BLOCKER_AUTH2_R13_R2=PASS_...` y
`P2_T18_BLOCKER_AUTH2_R13_R3_R1=PASS_AUTH02_M9_TEST_COVERAGE_GAP_CLOSED`
preservados sin degradar. Git final idéntico `HEAD=ORIGIN=a1579f11`,
fingerprint 14/14 y 17/17 idéntico, cero mutación real de repo.
Detalle completo en `codex-reports/CURRENT_TASK.md`; R13-R3-R1
archivado en `codex-reports/archive/P2-T18-BLOCKER-AUTH2-R13-R3-R1.md`.
Siguiente tarea: `P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-R1` (corrección
focal exclusiva de test), no ejecutada.

**R13-R3-RETRY-R1 (2026-08-28, test-only, PASS)** cerró exactamente el
segundo gap (mutante M19-NEW) encontrado por R13-R3-RETRY, sin tocar
producto ni ningún otro archivo de test. Recuperó el contrato exacto
desde el R13-R3-RETRY recién archivado
(`0620e8e0a575537072b4de519bc52158431ccb2c86b79a418f27c8ae835b0083`),
confirmó por lectura directa que `permission-prompt.tsx` consume
realmente `fetch(url, {` en `savePushSubscription` (producto correcto,
sin tocar), y reprodujo el mutante M19-NEW fuera del repo en un
harness temporal nuevo (junction a `node_modules` + copia de `src/`,
eliminado al cierre) contra el test sin corregir: sobrevivió (11
pass/0 fail), confirmando el gap antes de tocar ningún archivo real.
Agregó una única assertion (`expect(fnBody).toContain("fetch(url")`)
dentro del test ya existente `"savePushSubscription accepts an
explicit family parameter..."` de
`permission-prompt-static-contract.test.ts` — sin crear ningún
`test()`/`describe()` nuevo (11 tests antes y después, `expect()`
calls 22→23), mismo patrón exacto ya usado para
`checkExistingPushSubscriptionStatus`. Replay del mismo mutante en el
harness contra el test corregido: detectado (10 pass/1 fail,
exactamente la nueva assertion). Harness restaurado desde backup
(byte-idéntico por SHA-256) y eliminado por completo. 7 archivos de
producto y 6 archivos de test no-objetivo — incluido el test de M9,
confirmado intacto — confirmados byte-idénticos antes/después. 117/117
focal AUTH02 PASS. ESLint limpio, TSC 31 raw/24 distinct (0 nuevos),
`git diff --check` limpio. Diff completo del archivo objetivo releído:
único cambio es la nueva assertion, sin remociones ni debilitamiento
de ninguna existente. No se re-ejecutó la campaña completa de 20
mutantes ni la regresión de 294 — corresponden a
`P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2`.
`P2_T18_BLOCKER_AUTH2_R13_R2=PASS_AUTH02_FOCUSED_LOCAL_IMPLEMENTATION`
y `P2_T18_BLOCKER_AUTH2_R13_R3_R1=PASS_AUTH02_M9_TEST_COVERAGE_GAP_CLOSED`
preservados sin degradar. El primer R13-R3-RETRY permanece
históricamente `BLOCKED`, no se reescribe.
`P2_T18_BLOCKER_AUTH2_R13_R3_RETRY_R1=PASS_AUTH02_M19_TEST_COVERAGE_GAP_CLOSED`.
Durante la finalización también se reconcilió un marcador `P2_T18=`
sin calificar del header de `CODEX_REPORT.md` que había quedado
desactualizado desde antes de esta cadena de etapas, per instrucción
explícita, sin crear ninguna micro-tarea adicional. Git final idéntico
`HEAD=ORIGIN=a1579f11`, `AHEAD=0`/`BEHIND=0`, índice vacío, sin
commit/push/deploy. Detalle completo en
`codex-reports/CURRENT_TASK.md`; R13-R3-RETRY archivado en
`codex-reports/archive/P2-T18-BLOCKER-AUTH2-R13-R3-RETRY.md`.
Siguiente tarea: `P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2` (repetición
completa desde cero, no continuación, de la revisión adversarial
precommit — 20 mutantes: 19 originales + M19-NEW), no ejecutada.

**R13-R3-RETRY-2 (2026-08-29, recertificación adversarial final desde
cero, BLOCK)** confirmó que AUTH02 en sí quedó completamente
verde: gate crítico de 11 call sites con cobertura declaración+consumo
11/11, campaña fresca de 20 mutantes (19 originales + M19-NEW) en un
harness externo nuevo con 19/19 no-equivalentes detectados (M9 y
M19-NEW ambos recertificados detectados, M3 reconfirmado equivalente),
matriz de seguridad 20/20, aceptación local 12/12, focal 117/117 en
la primera corrida decisiva. La regresión fresca en 3 tandas (listado
literal recuperado de `codex-reports/TEST_AUTHORITY.md`, nunca
reconstruido de memoria) dio TANDA_1 163/163 PASS, pero TANDA_2 (31
tests contra PostgreSQL real) dio 30 pass/1 fail: un único fallo
decisivo en `client-block-security.integration.test.ts` (caso
"SEC-BLOCK-1... dispositivo compartido pero SIN ninguna fila
ClienteBloqueado previa", esperado 201 recibido 500, 12878ms),
completamente ajeno al mecanismo `actorFamily` de AUTH02, con
precedente histórico documentado de flake transitorio aislado en el
mismo archivo (`P2-T18-BLOCKER-AUTH2-R5`, mismo síntoma). Por regla
explícita de la etapa ("no retry-to-green", "Do NOT correct"), no se
re-ejecutó ni se investigó más a fondo, y TANDA_3 no se corrió
(stop-on-objective).
`P2_T18_BLOCKER_AUTH2_R13_R2=PASS_AUTH02_FOCUSED_LOCAL_IMPLEMENTATION`,
`P2_T18_BLOCKER_AUTH2_R13_R3_R1=PASS_AUTH02_M9_TEST_COVERAGE_GAP_CLOSED`
y `P2_T18_BLOCKER_AUTH2_R13_R3_RETRY_R1=PASS_AUTH02_M19_TEST_COVERAGE_GAP_CLOSED`
preservados sin degradar. El primer `P2-T18-BLOCKER-AUTH2-R13-R3-RETRY`
permanece históricamente `BLOCKED`, no se reescribe.
`P2_T18_BLOCKER_AUTH2_R13_R3_RETRY_2=BLOCKED_AUTH02_FRESH_TEST_GATE`.
Git final idéntico `HEAD=ORIGIN=a1579f11`, `AHEAD=0`/`BEHIND=0`,
índice vacío, sin commit/push/deploy. Detalle completo en
`codex-reports/CURRENT_TASK.md`; R13-R3-RETRY-R1 archivado en
`codex-reports/archive/P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-R1.md`.
Siguiente tarea: `P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R1` (investigación
aislada del único fallo de regresión, flake vs. real), no ejecutada.

**R13-R3-RETRY-2-R1 (2026-08-29, diagnóstico exclusivo, sin
corrección, BLOCK)** investigó el único fallo que bloqueó
R13-R3-RETRY-2 en `client-block-security.integration.test.ts` (caso
SEC-BLOCK-1, "dispositivo compartido pero SIN ninguna fila
ClienteBloqueado previa"). Confirmó ESTRUCTURALMENTE que AUTH02 no
puede haber causado el fallo: el test llama al route handler de
`/api/pedidos` directamente como función importada, sin pasar jamás
por `src/proxy.ts` (0 matches de `proxy`/`middleware`/
`resolveActorSession` en el archivo completo). Comparó contra el
precedente de R5 sin sobre-extenderlo — mismo archivo, pero test
title, mecanismo (sin concurrencia diseñada, a diferencia del
`Promise.all` de R5) y código de error (P2028 vs. P2002 histórico)
distintos. Ejecutó exactamente 3 corridas diagnósticas fijas, sin
repetir ninguna: D1 (caso aislado) FALLÓ con `P2028` y latencia
anómala de 25s; D2 (archivo completo) PASÓ 19/19; D3 (TANDA_2 exacta,
31 tests) PASÓ 31/31. El patrón mixto no encajó limpio en ningún caso
A/B/C de la matriz de interpretación del prompt — clasificado Caso E,
`INCONCLUSIVE_EXTERNAL_DB_INSTABILITY`, sin forzar una clasificación
PASS pese a la evidencia circunstancial fuerte de inestabilidad
transitoria de conexión/motor de TESTING.
`P2_T18_BLOCKER_AUTH2_R13_R3_RETRY_2=BLOCKED_AUTH02_FRESH_TEST_GATE`
permanece históricamente preservado, no reescrito. 0 mutación de
source/test; fingerprint 14/14, 17/17 y del propio test objetivo
confirmado idéntico antes/después. Git final idéntico
`HEAD=ORIGIN=a1579f11`, sin commit/push/deploy. Detalle completo en
`codex-reports/CURRENT_TASK.md`; R13-R3-RETRY-2 archivado en
`codex-reports/archive/P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2.md`.
Siguiente tarea: `P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R2` (gate de
regresión fresca de certificación, TANDA_2 y TANDA_3 una vez cada
una, sin retry-to-green), no ejecutada.

**R13-R3-RETRY-2-R2 (2026-08-29, certificación, no diagnóstico,
BLOCK)** intentó completar la certificación precommit de AUTH02
corriendo TANDA_2 (y, si pasaba, TANDA_3) como certificación fresca de
una sola corrida, sin retry-to-green, sobre los mismos bytes ya
certificados. Confirmó gate de continuidad de bytes: 14/14, 17/17 y el
propio `client-block-security.integration.test.ts` idénticos a R1.
Preservó íntegra toda la evidencia de RETRY-2 sin re-ejecutar nada
(11/11, 20 mutantes/19 no-equivalentes/0 sobrevivientes, 20/20, 12/12,
117/117, TANDA_1 163/163). **C1 (TANDA_2, una única corrida) FALLÓ
30/31** — exactamente el mismo caso SEC-BLOCK-1
(`client-block-security.integration.test.ts:406`, esperado 201
recibido 500), esta vez con 26786.71ms de latencia (nuevamente
anómala). Por regla explícita "no retry-to-green" se detuvo de
inmediato — no se corrió TANDA_3, no se aisló el test, no se
investigó más. Este es el SEGUNDO fallo consecutivo del mismo caso
exacto en dos intentos de certificación distintos (RETRY-2 original y
esta R2), ambos con latencias anómalas — evidencia adicional
consistente con la hipótesis de inestabilidad transitoria de R1, sin
que esta etapa reclasifique el incidente.
`P2_T18_BLOCKER_AUTH2_R13_R3_RETRY_2=BLOCKED_AUTH02_FRESH_TEST_GATE` y
`P2_T18_BLOCKER_AUTH2_R13_R3_RETRY_2_R1=BLOCKED_SEC_BLOCK_1_CLASSIFICATION_INCONCLUSIVE`
permanecen íntegros, sin reescribir. `P2_T18_BLOCKER_AUTH2_R13_R3_RETRY_2_R2=BLOCKED_FRESH_TANDA_2_CERTIFICATION_FAILURE`.
0 mutación de source/test; fingerprint 14/14, 17/17 y el test objetivo
confirmado idéntico antes/después. Git final idéntico
`HEAD=ORIGIN=a1579f11`, sin commit/push/deploy. Detalle completo en
`codex-reports/CURRENT_TASK.md`; R13-R3-RETRY-2-R1 archivado en
`codex-reports/archive/P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R1.md`.
Siguiente tarea: `P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R2-R1`
(disposición aislada del segundo fallo consecutivo), no ejecutada.

**R13-R3-RETRY-2-R2-R1 (2026-08-29, read-only, PASS)** determinó la
disposición del fallo REPETIDO de SEC-BLOCK-1 (dos corridas frescas de
certificación de TANDA_2 bloqueadas por el mismo caso exacto), sin
corregir nada. Trazó completo el path productivo `/api/pedidos` para
las condiciones exactas de este test: la única transacción interactiva
alcanzada (`db.$transaction`, `pedidos/route.ts:1493`) es mínima (1
lectura + 1 update + 1 create, sin trabajo no-DB dentro de su alcance)
y `P2028` no tiene ningún manejo/retry explícito — cae directo al
catch-all genérico → 500, un comportamiento igualmente alcanzable en
producción bajo latencia suficiente. Confirmó por documentación local
(`node_modules/@prisma/client`) los defaults de Prisma 6 nunca
sobreescritos en este código (`maxWait=2000`/`timeout=5000`). Comparó
los 3 fallos frescos (RETRY-2 original/resB/12878ms, R1-D1/resA/25144ms/
P2028, R2-R2-C1/resB/26786ms) contra 2 controles limpios (D2 19/19, D3
31/31): el dato decisivo es que el fallo AISLADO (D1, sin ningún otro
archivo de TANDA_2 corriendo) también reprodujo el mismo patrón,
descartando la contención ENTRE archivos de TANDA_2 como causa
necesaria. Recuperó contexto adicional ya existente en el repo (harness
de carga `load-tests/runner/pg-metrics.ts` que ya instrumenta conexiones
contra la misma DB de TESTING; el resultado de carga más reciente
contra PRODUCCIÓN muestra p95=389ms/0 fallos 5xx bajo carga real
sostenida) — reforzando que la inestabilidad es anómala específicamente
en TESTING, no una característica esperable de la arquitectura del
producto en general. Encontró, como hallazgo SECUNDARIO no causal para
este síntoma específico, un `mock.module()` sin scope en
`session-login-atomicity.integration.test.ts` (reemplaza
`@/lib/client-block-security` a nivel de proceso sin re-exportar
`findForeignDeviceBlockMatch`/`applyDeviceEvasionAutoBlock`) — un riesgo
de higiene de test real, documentado para revisión futura separada,
pero estructuralmente incapaz de producir un `P2028` con latencia de
segundos (produciría un `TypeError` síncrono casi instantáneo).
Seleccionó disposición `EXTERNAL_TESTING_DB_RELIABILITY_LIMITATION_REQUIRES_NEW_CERTIFICATION_AUTHORITY`
(confianza MEDIA), congelando las características de una base de
TESTING dedicada sin provisionar nada (§26 del prompt de esta etapa).
`PASS_REPEATED_SEC_BLOCK_1_FAILURE_DISPOSITION_FROZEN` — PASS significa
exclusivamente "la disposición correcta queda determinada", NO "AUTH02
puede commitearse" (`AUTH02_SAFE_FOR_EXACT_LOCAL_COMMIT=NO`,
`R13_R4_AUTHORIZED=NO` se mantienen sin cambio). R13-R3-RETRY-2,
R13-R3-RETRY-2-R1 y R13-R3-RETRY-2-R2 permanecen históricamente
BLOCKED, sin reescribir. 0 mutación de source/test, fingerprint
14/14+17/17+test-objetivo idéntico antes/después. Git final idéntico
`HEAD=ORIGIN=a1579f11`, `AHEAD=0`/`BEHIND=0`, índice vacío. Detalle
completo en `codex-reports/CURRENT_TASK.md`; R13-R3-RETRY-2-R2
archivado en
`codex-reports/archive/P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R2.md`
(`2e1e3525b3e462902af6330fe430218ae2af91d3cc2916a1c31e43e285fa4828`).
Siguiente tarea: `P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R2-R1A` — decisión
de producto/proceso del usuario, no otra certificación puramente
técnica, no ejecutada.

**R13-R3-RETRY-2-R2-R1A (2026-08-29, reconciliación de reportes/autoridad
únicamente, PASS)** procesó la decisión explícita del usuario de
**diferir** la base de datos de TESTING dedicada recomendada por
R13-R3-RETRY-2-R2-R1 y continuar con la infraestructura existente —
priorizando no seguir gastando etapas en el mismo fallo puntual. 0
ejecución de tests, 0 mutación de source/test. Verificó, sobre la
autoridad ya persistida (sin re-derivar nada), los 6 gates requeridos
para aceptar una excepción: (A) el candidato de AUTH02 sigue siendo
exactamente 14 paths (7+7); (B) la autoridad adversarial completa —
11/11 declaración+consumo, 20 mutantes/19 no-equivalentes detectados/0
sobrevivientes válidos, seguridad 20/20, aceptación 12/12, focal
117/117, TANDA_1 163/163 — sigue vigente; (C)
`AUTH02_CAUSAL=NO`, ya confirmado estructuralmente (SEC-BLOCK-1 nunca
ejecuta `src/proxy.ts`); (D) el mismo test byte-idéntico produjo tanto
evidencia PASS como evidencia de fallo P2028/500 sin ningún cambio de
AUTH02 entre corridas; (E) el fallo se reprodujo incluso en
aislamiento total (D1 de R13-R3-RETRY-2-R1), evidencia de que el
código nuevo de AUTH02 no lo causa; (F) ningún fix de producto ni de
test fue identificado por la disposición ya completada. Los 6 PASS —
se acepta la excepción sin fabricarla.

Registró una excepción de infraestructura estrechamente acotada
(`EX-P2-T18-SEC-BLOCK-1-P2028` — sólo el caso exacto de SEC-BLOCK-1,
no permanente, sin `.skip`, sin borrar el test, sin cambiar
`expect(...).toBe(201)`, sin debilitar el 31/31 permanentemente — el
test sigue 100% activo en el repo) y una deuda diferida separada
(`F-P2-TESTINFRA-01`, ver entrada propia abajo). Formuló explícitamente
sin green falso (`NO_FALSE_GREEN_TEST_CLAIM=SI`): nunca afirmó
"TANDA_2 31/31" ni "294/294 PASS" — la autoridad de regresión de AUTH02
se ACEPTA para el avance precommit actual por la combinación de
TANDA_1 163/163 real + autoridad específica de AUTH02 100% real + una
exclusión explícita y acotada de SEC-BLOCK-1 por decisión del usuario.
`AUTH02_SAFE_FOR_EXACT_LOCAL_COMMIT=SI`, `R13_R4_AUTHORIZED=SI`.
`P2_T18_BLOCKER_AUTH2_R13_R3_RETRY_2`,
`P2_T18_BLOCKER_AUTH2_R13_R3_RETRY_2_R1`,
`P2_T18_BLOCKER_AUTH2_R13_R3_RETRY_2_R2` y
`P2_T18_BLOCKER_AUTH2_R13_R3_RETRY_2_R2_R1` permanecen históricamente
preservados, sin reescribir. Congeló el contrato de commit de R13-R4
(exactamente los 14 paths de AUTH02, subject `fix: scope shared auth
requests by actor family`, 0 paths de reportes/ajenos). Fingerprint
14/14+1 confirmado idéntico antes/después; 0 mutación de source/test.
Git final idéntico `HEAD=ORIGIN=a1579f11`, `AHEAD=0`/`BEHIND=0`, índice
vacío. Detalle completo en `codex-reports/CURRENT_TASK.md`;
R13-R3-RETRY-2-R2-R1 archivado en
`codex-reports/archive/P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R2-R1.md`
(`84489640ab6babcf0af21928b0ead3cf6b56c0f5f4994beb22ec4002e441e9ad`).
Siguiente tarea: `P2-T18-BLOCKER-AUTH2-R13-R4` — commit local exacto,
no ejecutada.

**R13-R4 (2026-08-29, PASS)** convirtió el candidato AUTH02 ya
certificado en un único commit local, sin mutar ni un solo byte de
producto/test. Rehash pre-stage 14/14 idéntico a la autoridad
certificada; diff completo (30 hunks en los 11 archivos ya
trackeados) sin ningún hunk nuevo/removido desde certificación;
`M9_ASSERTION_PRESENT=SI`, `M19_ASSERTION_PRESENT=SI`; 0 tests
ejecutados. Staging explícito de exactamente los 14 paths vía `git add
--` (nunca `.`/`-A`/`-u`/`commit -a`); índice auditado: 14 paths
exactos (3 `A` para los tests nuevos, 11 `M`), 0 reportes, 0 root `32`,
0 schema/migración/package; probado `staged == worktree == certificado`
14/14 vía `git rev-parse ":<path>"` contra `git hash-object <path>`.

```bash
git commit -m "fix: scope shared auth requests by actor family"
```

Un único commit, sin amend, sin push. Verificación postcommit sin
confiar únicamente en el exit code: `git diff-tree` confirmó
exactamente los 14 paths commiteados; los 14 blobs `HEAD:<path>`
coinciden con `git hash-object <path>` (14/14); `git show --stat`/
`--name-status HEAD` confirmó ausencia de reportes/schema/migración/
root `32`; `git diff --name-status HEAD -- <14 paths>` quedó vacío.

```
R13_R4_COMMIT_HASH=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f
R13_R4_COMMIT_PARENT=a1579f11e79a41b90c6df4d2e8573ca9a669b856
R13_R4_COMMIT_SUBJECT=fix: scope shared auth requests by actor family
R13_R4_COMMITTED_BLOB_MATCH=14_OF_14_PASS
P2_T18_BLOCKER_AUTH2_R13_R4=PASS_AUTH02_EXACT_LOCAL_COMMIT
AUTH02_LOCAL_COMMIT_COMPLETE=SI
AUTH02_PUSHED=NO
AUTH02_DEPLOYED=NO
R13_R5_AUTHORIZED=SI
```

Git final: `HEAD=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f`,
`HEAD_PARENT=a1579f11e79a41b90c6df4d2e8573ca9a669b856`,
`ORIGIN=a1579f11e79a41b90c6df4d2e8573ca9a669b856` (sin cambio),
`AHEAD=1`/`BEHIND=0`, índice vacío. Sin push, sin deploy, sin Railway,
sin acceso a DB real, sin navegador real. Se registró, sin ejecutar
nada, la nueva prioridad de roadmap del usuario tras el cierre de
P2-T18 (`P2-T06` primero, luego `P2-T14` si es dependency-safe — ver
`codex-reports/ROADMAP.md`). Detalle completo en
`codex-reports/CURRENT_TASK.md`; R13-R3-RETRY-2-R2-R1A archivado en
`codex-reports/archive/P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R2-R1A.md`
(`e0223f98d05fd4056f52f10fbcf5c7de1f8375282d4e82ff07f93f4f152c2888`).
Siguiente tarea: `P2-T18-BLOCKER-AUTH2-R13-R5` — postcommit prepush
exact blob review, no ejecutada.

**R13-R5 (2026-08-29, PASS)** recertificó de forma INDEPENDIENTE el
commit `fe0e11d0` creado por R13-R4, leyendo los objetos Git
directamente desde `HEAD` — sin confiar en el resumen de R13-R4 y sin
re-ejecutar ninguna batería de tests ya certificada (`R13_R5_TEST_RUNS_EXECUTED=0`,
`R13_R5_DB_ACCESS=NO`). Derivó el fileset commiteado por 2 métodos
Git independientes (`git diff-tree --name-status`, `git show
--name-only`) — ambos de acuerdo en 14 paths exactos (7 producto + 7
test), 0 rutas prohibidas (reportes/root `32`/schema/migración/
package/lockfile: 0 coincidencias). Derivó independientemente los 14
blob IDs vía `git ls-tree HEAD` — 14/14 idénticos a los certificados
por R13-R4. Leyó los 14 blobs directamente de `HEAD`
(`git show HEAD:<path>`, nunca las copias del working tree como
autoridad primaria): confirmó que `src/proxy.ts` contiene exactamente
las 10 entradas certificadas de `SELECTOR_ENDPOINT_PREFIXES` sin
ningún prefijo genérico nuevo, que los callers de Chat/Push
commiteados preservan `?actorFamily=`, y que las protecciones M9
(`fetch(subscribeUrl`) y M19 (`fetch(url` dentro de
`savePushSubscription`) están presentes. Revisó el diff commiteado
completo (33 hunks, 578+/32-, 0 sin clasificar/incidental). Confirmó
`git diff --name-status HEAD -- <14 paths>` vacío.

```
R13_R5_FILESET_MATCHES_R13_R4=14_OF_14_PASS
R13_R5_BLOB_MATCH_R13_R4=14_OF_14_PASS
R13_R5_COMMITTED_PROXY_CONTRACT_PRESENT=SI
R13_R5_M9_ASSERTION_COMMITTED=SI
R13_R5_M19_ASSERTION_COMMITTED=SI
NO_FALSE_GREEN_TEST_CLAIM=SI
P2_T18_BLOCKER_AUTH2_R13_R5=PASS_AUTH02_POSTCOMMIT_PREPUSH_EXACT_BLOB_REVIEW
AUTH02_COMMIT_TECHNICALLY_CERTIFIED=SI
AUTH02_SAFE_FOR_FRESH_R13_R6_PREPUSH=SI
R13_R6_AUTHORIZED=SI
```

Preservó por identidad de blob toda la autoridad de seguridad/
mutación/aceptación/focal y la excepción temporal
`EX-P2-T18-SEC-BLOCK-1-P2028`, sin reabrir SEC-BLOCK-1 ni crear DB
dedicada. Preservó, sin ejecutar nada, la prioridad de roadmap del
usuario. Git final idéntico `HEAD=fe0e11d0`/`ORIGIN=a1579f11` (sin
cambio), `AHEAD=1`/`BEHIND=0`, índice vacío. Detalle completo en
`codex-reports/CURRENT_TASK.md`; R13-R4 archivado en
`codex-reports/archive/P2-T18-BLOCKER-AUTH2-R13-R4.md`
(`ae131e951cdf862c1c632be684076b9beb11329810c4b47ee61677840e8195d1`).
Siguiente tarea: `P2-T18-BLOCKER-AUTH2-R13-R6` — fresh prepush +
TESTING push/deploy certification, no ejecutada.

**R13-R6 (2026-08-29, PASS)** ejecutó el gate final de entrega
server-side, lean por prioridad explícita del usuario. Confirmó
continuidad de blobs 14/14 contra R13-R5, corrió el focal certificado
una única vez (`bun test` sobre los 7 paths de test exactos) — 117
pass / 0 fail / 280 expect() calls, idéntico al histórico, sin DB.
ESLint limpio sobre los 14 paths. `bunx tsc --noEmit`: 31 diagnósticos
crudos / 24 distintos, idéntico byte a byte a la baseline vigente —
filtrado a los 14 paths de AUTH02, únicamente los 2 TS2367
preexistentes ya documentados en `permission-prompt.tsx`, 0 nuevos.
`git show --check HEAD` y `npm run build` limpios. Eliminó únicamente
el artefacto incidental `tsconfig.tsbuildinfo` generado por `tsc`.

Confirmó read-only Railway `amiable-rejoicing`/`TESTING`
(`f37d0c49-b737-49e8-be89-a00c13734fae`), servicios "DeliGO Copy" y
"chat en vivo" ambos `RUNNING` en el commit padre `a1579f11` antes del
push, sin deployment concurrente. Health prepush limpio (`/login`=200,
`/`=307, `/health`=200). Con todos los gates en verde, ejecutó
**exactamente un** `git push origin testing-codex` sin `--force`
(`a1579f1..fe0e11d`), confirmado inmediatamente:
`HEAD=ORIGIN=fe0e11d0`, `AHEAD=0`/`BEHIND=0`. Observó únicamente (sin
`railway up`/`deploy`/`redeploy` manual) el autodeploy Git-triggered
vía polling read-only de `railway status --json` cada 15s (~90s hasta
estado terminal):

```
DeliGO Copy: DEPLOYMENT_ID=4e6618dc-4910-4b94-9da1-0f1d1fa60e5e, STATUS=SUCCESS, COMMIT=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f
chat en vivo: DEPLOYMENT_ID=43abe272-4fb2-474f-a55a-5d9389ead83c, STATUS=SUCCESS, COMMIT=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f
```

Ambos `commitHash` confirmados desde metadata real de Railway, nunca
inferidos del éxito del `git push`. `chat en vivo` SÍ autodeployó pese
a que el diff de AUTH02 (14 paths) no toca ningún archivo propio de
ese servicio — mismo patrón ya visto en R6/R12 (Railway dispara ambos
servicios en cada push, sin filtro por path); se observó, nunca se
disparó manualmente. Logs de ambos servicios sin `error`/excepción
(DeliGO Copy: "No pending migrations to apply", esperado; chat en
vivo: "listening on port 8080"). Health postdeploy limpio en ambos.

```
P2_T18_BLOCKER_AUTH2_R13_R6=PASS_AUTH02_TESTING_PUSH_DEPLOY_CERTIFIED
AUTH02_PUSHED=SI
AUTH02_DEPLOYED_TESTING=SI
AUTH02_DEPLOYED_COMMIT=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f
F_P2_T18_AUTH02_STATUS=DEPLOYED_TESTING_AWAITING_FULL_REAL_BROWSER_REPLAY
F_P2_T18_AUTH01_STATUS=OPEN_AWAITING_FULL_REAL_BROWSER_REPLAY
R13_R7_AUTHORIZED=SI
```

Cero DB real, cero navegador real, cero fixture manual, Production
intacta. Preservó sin ejecutar nada la excepción temporal
`EX-P2-T18-SEC-BLOCK-1-P2028` y amplió (sin ejecutar) las prioridades
post-P2-T18 del usuario: ahora la auditoría de sincronización
Producción-vs-`testing-codex` tiene prioridad explícita ANTES de
`P2-T06`/`P2-T14` (ver `codex-reports/ROADMAP.md`). Git final idéntico
`HEAD=ORIGIN=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f`, `AHEAD=0`/
`BEHIND=0`, índice vacío. Detalle completo en
`codex-reports/CURRENT_TASK.md`; R13-R5 archivado en
`codex-reports/archive/P2-T18-BLOCKER-AUTH2-R13-R5.md`
(`44c5ad7df9853eb636b4e4f553249bd44b93f7afe7e586598be88043aafcf1cc`).
Siguiente tarea: `P2-T18-BLOCKER-AUTH2-R13-R7` — full real-browser
replay from zero, no ejecutada.

**R13-R7 (2026-08-29, PASS)** repitió desde cero, con Chrome real
(Claude in Chrome, "Browser 2") contra el commit desplegado
`fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f`, la matriz histórica de 18
casos de R13 — 0/18 de crédito heredado del resultado parcial
histórico (9/18). Recuperó la matriz verbatim desde
`codex-reports/archive/P2-T18-BLOCKER-AUTH2-R13.md` antes de tocar
DB/navegador. Fixtures TESTING frescas (prefijo `P2T18_AUTH2_R13_R7_`,
1 Cliente + 1 Negocio + 1 Producto + 1 Pedido) creadas vía harness
externo que replica `hashPassword()` desde `src/lib/auth.ts` — nunca
importando código del repo. Resultado: **18/18 PASS**, incluyendo el
ataque directo a AUTH01 (Cliente sobrevive sin recarga al login de
Negocio en el mismo navegador/cookie-jar, CASE_05) y la recreación
directa del síntoma AUTH02 (chat del Pedido abierto en ambas tabs —
`no-leidos`/`conversaciones`/`mensajes`/`realtime-token`/
`realtime-authorize`, TODOS 200 con `?actorFamily=` correcto, ningún
401, CASE_09). Casos 10-13 (logout simétrico + sync cross-tab nativo
por familia) y 14-17 (aislamiento de storage cruzado, ausencia de
clave legacy, sin reconexión realtime obsoleta, sin secreto en JS
storage) también PASS. Dos correcciones de control documentadas
(dentro del presupuesto máximo de 2): un toast residual tapando el
botón de logout, y autocompletado residual del navegador en el campo
contraseña — ninguna reclasificó un fallo real como error de control.
Cleanup completo: 0 filas residuales DB, ambas familias `401`, 0 tabs
remanentes.

```
R13_R7_ACCEPTANCE_MATRIX=18_OF_18_PASS
F_P2_T18_AUTH01_STATUS=RESOLVED
F_P2_T18_AUTH02_STATUS=RESOLVED
AUTH01_RESOLVED_COMMIT=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f
AUTH02_RESOLVED_COMMIT=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f
P2_T18_BLOCKED_BY_AUTH_SESSION_COEXISTENCE=NO
```

Cero mutación de producto/test, cero commit/push/deploy. `F-P2-T18-AUTH01`
y `F-P2-T18-AUTH02` quedan `RESOLVED`, pero **P2-T18 NO se cierra** —
bloqueado únicamente por la aceptación con navegador real de la UI de
Chat restante (`F-P1-02`, luego `F-P1-01`). Detalle completo en
`codex-reports/CURRENT_TASK.md`; R13-R6 archivado en
`codex-reports/archive/P2-T18-BLOCKER-AUTH2-R13-R6.md`
(`545f6537b512bc20959842a3d836f41e443f4a6e85d28d85a8b78fa3f3eee2e6`).
Siguiente tarea definida (no ejecutada): `P2-T18-F-P1-02-REAL-BROWSER-ACCEPTANCE`.

---

## F-P2-TESTINFRA-01

```
TITLE: TESTING DB intermittent P2028 undermines deterministic DB-backed regression authority
STATUS: DEFERRED_BY_USER
SEVERITY: PROCESS_RELIABILITY (no AUTH02_SECURITY_DEFECT, no PRODUCT_DEFECT)
DISCOVERED_IN: P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2 (2026-08-29), como bloqueo lateral no relacionado a la certificación precommit de F-P2-T18-AUTH02; investigado en R13-R3-RETRY-2-R1 (clasificación INCONCLUSIVE_EXTERNAL_DB_INSTABILITY), repetido en R13-R3-RETRY-2-R2, y dispuesto técnicamente en R13-R3-RETRY-2-R2-R1 (disposición EXTERNAL_TESTING_DB_RELIABILITY_LIMITATION_REQUIRES_NEW_CERTIFICATION_AUTHORITY, confianza MEDIA)
ROOT_CAUSE: la base de datos Postgres real usada por TANDA_2/TANDA_3 (`$DELIGO_TEST_DATABASE_URL`) exhibe picos intermitentes de latencia de conexión/transacción de varios segundos a 25+ segundos, suficientes para disparar el timeout por defecto de Prisma 6 (`timeout ?= 5000`) en transacciones interactivas que en código son mínimas y sin defecto de diseño — reproducido incluso en ejecución completamente aislada (sin ningún otro test/archivo concurrente), lo que descarta contención entre los propios archivos de TANDA_2 como causa necesaria. No se probó una causa raíz definitiva a nivel de servidor/red (no se consultaron variables de Railway ni se hicieron cambios de infraestructura).
EVIDENCE_SUMMARY: 3 fallos frescos del mismo caso exacto (`client-block-security.integration.test.ts`, SEC-BLOCK-1) en 3 corridas independientes — RETRY-2 original (12878ms), R1/D1 aislado (25144ms, P2028 confirmado), R2-R2/C1 (26786ms) — contra 2 controles limpios en el mismo entorno (R1/D2 19/19, R1/D3 31/31). Contexto adicional: un harness de carga (`load-tests/runner/pg-metrics.ts`) ya instrumenta esta misma base; el resultado de carga más reciente contra PRODUCCIÓN (no TESTING) muestra p95=389ms/0 fallos 5xx bajo carga real sostenida, sugiriendo que la inestabilidad es específica de TESTING.
USER_DECISION: en P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R2-R1A (2026-08-29) el usuario decidió explícitamente DIFERIR el aprovisionamiento de una base de TESTING dedicada (características ya congeladas en R13-R3-RETRY-2-R2-R1: alcance, aislamiento de fixtures, requisitos de conexión, límite de seguridad) y continuar con la infraestructura existente, aceptando una excepción temporal y estrechamente acotada (`EX-P2-T18-SEC-BLOCK-1-P2028`) exclusivamente para el avance precommit de AUTH02.
DEDICATED_TEST_DB_RECOMMENDATION: DEFERRED_BY_USER
REVISIT_STAGE: P2-T10 (stress/soak/cost testing — bucket de infraestructura de test ya existente en el roadmap; no se creó un P2 nuevo arbitrariamente)
GLOBAL_FLAKE_POLICY_WEAKENED: NO — esta deuda NO autoriza ignorar tests flaky en general, aceptar 30/31 como suficiente en general, ni ignorar futuros fallos de SEC-BLOCK-1. Se reabre si: aparece en Producción; aparece en un path de producto activamente modificado; aumenta la frecuencia de P2028; otro test independiente empieza a fallar de forma similar; P2-T10 llega a esta área; o el usuario autoriza infraestructura de test dedicada más adelante.

RECURRENCE_2026-09-09 (P2-T29E): mismo síntoma exacto (P2028, transacción cerrada por timeout) reproducido en `order-rate-limit-buckets.integration.test.ts` (P2-T25, archivo NO tocado por ningún diff de T29A-E) durante una ventana de carga sostenida de la batería final de T29 (concurrencia real de 2 repartidores + CAS de negocio + suites P2-T25 grandes, ejecutadas consecutivamente contra la misma DB compartida de TESTING). Protocolo aplicado antes de clasificar: confirmado que el archivo está fuera del diff T29; reproducido en aislamiento total → 14/14 PASS; batería completa reejecutada → 72/72 PASS. Clasificado como la MISMA causa raíz (picos de latencia intermitente bajo carga en la DB compartida), no una regresión de T29 ni un nuevo finding — `GLOBAL_FLAKE_POLICY_WEAKENED` sigue `NO`, este finding no se reabre ni escala por esta recurrencia. Ver `codex-reports/P2_T29E_FINAL_COMPATIBILITY_REGRESSION_AND_PHYSICAL_CERTIFICATION.md` §16.
```

---

## F-ENV-TESTING-REALTIME-ROUTING-01 (CERRADO — falso positivo, PRODUCTION-SYNC-R2, 2026-08-29)

```
FINDING_ID=F-ENV-TESTING-REALTIME-ROUTING-01
STATUS=FALSE_POSITIVE_NOT_CREATED_OR_CLOSED_AS_NOT_A_DRIFT — cerrado en PRODUCTION-SYNC-R2 (2026-08-29) con autoridad de plataforma provista directamente por el usuario, nunca llegó a crearse como finding formal
TITLE=REALTIME_INTERNAL_SERVICE_URL en TESTING (DeliGO Copy) apunta a http://harmonious-empathy.railway.internal:8080 — el mismo hostname privado que el propio chat-service de PRODUCTION reporta como suyo, pero TAMBIÉN el que el chat-service de TESTING reporta como suyo
EVIDENCE=Verificado con railway variables (solo lectura): TESTING_DELIGO_COPY.REALTIME_INTERNAL_SERVICE_URL=http://harmonious-empathy.railway.internal:8080; TESTING_CHAT_SERVICE.RAILWAY_PRIVATE_DOMAIN=harmonious-empathy.railway.internal; PRODUCTION_CHAT_SERVICE.RAILWAY_PRIVATE_DOMAIN=harmonious-empathy.railway.internal (idéntico). Ambos entornos reportan el mismo pet-name privado para el mismo servicio lógico "chat en vivo".
CLASSIFICATION_FINAL=NOT_CAUSAL / NOT_A_DRIFT — resuelto en PRODUCTION-SYNC-R2: cada entorno de Railway tiene su propia red privada AISLADA a nivel de proyecto+entorno; el mismo pet-name de servicio puede legítimamente resolver igual en TESTING y en production sin que eso implique ningún ruteo cruzado real. REALTIME_INTERNAL_SERVICE_URL_CROSS_ENV_DRIFT=NO, REALTIME_INTERNAL_SERVICE_URL_PRIVATE_DNS_SCOPE=ENVIRONMENT_ISOLATED. La variable de TESTING no fue tocada; la de Production aún no fue escrita (ver codex-reports/PRODUCTION_SYNC_R2.md §6).
LIVE_PUSH_01_RELATION=NOT_CAUSAL para el síntoma de typing de F-P2-T18-LIVE-PUSH-01 (sin cambio respecto a la clasificación previa — ese código sólo cubre chat.message.created/chat.messages.read/tracking.location.updated, nunca typing). F-P2-T18-LIVE-PUSH-01 permanece PAUSED_EXTERNAL_INFRA_DEPENDENCY, NO reabierto por este cierre.
DISCOVERED_IN=Auditoría de sincronización Production-vs-testing-codex, consolidación 2026-08-29 (ver codex-reports/PRODUCTION_SYNC_AUDIT.md sección 4)
CLOSED_IN=PRODUCTION-SYNC-R2 (ver codex-reports/PRODUCTION_SYNC_R2.md sección 2)
NEXT_ACTION=NINGUNA — cerrado. Si en el futuro se decide escribir REALTIME_INTERNAL_SERVICE_URL en Production, el valor correcto ya está documentado: http://harmonious-empathy.railway.internal:8080 (verificado directamente contra el propio chat-service de production, no copiado de TESTING).
```

## BUSINESS-HOURS-TIMEZONE-PRODUCTION-PROMOTION-R1 — cierre

No se abrió un finding de regresión en la promoción. El estado público de `DeliGO Demo Burger` coincidió con el estado server-side timezone-aware (`America/Argentina/Buenos_Aires`, abierto en `todayKey=7`), y el hash de todos los horarios permaneció idéntico. Follow-ups permitidos solo en superficies de operaciones/estadísticas, medianoche server-side y presentación de fechas por instante general.

## Cross-chat handoff — P2-T18 realtime diagnosis correction

HISTORICAL_CONCLUSION: los findings históricos `P2_T18=PAUSED_NOT_CLOSED_EXTERNAL_INFRA_DEPENDENCY` y `F_P2_T18_LIVE_PUSH_01_STATUS=PAUSED_EXTERNAL_INFRA_DEPENDENCY` permanecen intactos.

NEW_RUNTIME_COUNTEREVIDENCE: el usuario observó que Negocio móvil con chat abierto recibe mensajes nuevos y el indicador de escritura en tiempo real. No observó realtime para Cliente móvil, Negocio desktop o Cliente desktop en los escenarios aportados, ni fuera del chat.

CURRENT_PROVISIONAL_CLASSIFICATION (SUPERADA, ver corrección abajo — se preserva sin editar como registro histórico): `P2_T18=PAUSED_PENDING_REALTIME_ACTOR_DEVICE_MATRIX_REDIAGNOSIS`; `F_P2_T18_LIVE_PUSH_01_STATUS=REOPEN_DIAGNOSIS_ACTOR_DEVICE_DEPENDENT_COUNTEREXAMPLE_FOUND`; `P2_T18_GLOBAL_RAILWAY_SERVER_TO_CLIENT_BLOCK_HYPOTHESIS=INVALIDATED_BY_COUNTEREXAMPLE`; `RAILWAY_GLOBAL_ROOT_CAUSE_CONFIRMED=NO`; `RAILWAY_GLOBAL_TRANSPORT_BLOCK_ASSUMPTION_ALLOWED=NO`.

**CORRECCIÓN POSTERIOR (P2-CURRENT-AUTHORITATIVE-BACKLOG-RECONCILIATION,
2026-09-09)**: la clasificación provisional de arriba quedó SUPERADA
por trabajo real posterior, nunca actualizado en este archivo hasta
ahora. `P2-T18-REALTIME-ACTOR-DEVICE-MATRIX-R1` sí se ejecutó
(`P2_T18_REALTIME_ACTOR_DEVICE_MATRIX_R1.md`), seguida de
`P2_T18_CLIENTE_DELIVERY_PIPELINE_INSTRUMENTATION_R2.md`, y finalmente
`P2_T18_REALTIME_RECERTIFICATION_R1.md` certificó PASS en una matriz
exhaustiva de actor/dispositivo/lifecycle — incluido typing en ambas
direcciones, desktop y mobile — el síntoma exacto de
`F-P2-T18-LIVE-PUSH-01` ya no reproduce. `P2_T18_STATUS=CLOSED` se
estableció ahí y se preservó sin reabrir en 5+ reportes posteriores
(T10, T15-T17, T20, T21). Registrar:
`P2_T18_STATUS=CLOSED (RESOLVED_BY_P2_T18_REALTIME_RECERTIFICATION_R1)`,
`F-P2-T18-LIVE-PUSH-01=RESOLVED_BY_P2_T18_REALTIME_RECERTIFICATION_R1`.
No se reabre por esta reconciliación — sólo se corrige que este archivo
nunca reflejó el cierre real.

NEXT_ACTION: `P2-T18-REALTIME-ACTOR-DEVICE-MATRIX-R1`. No se ejecutó código realtime ni investigación Railway en PRODUCT-DUPLICATION-R1. `P2_T18_OUTSIDE_CHAT_REALTIME_STATUS=NEEDS_CONTRACT_AUDIT_NOT_YET_CLASSIFIED_AS_BUG`.

## P2-T46 — history finding remediated and physically recertified — 2026-09-11

El finding observado en R1 queda resuelto por R2 y certificado físicamente:
`HISTORY_PAYMENT_VISIBLE=PASS`, mientras que el estado inicial había sido
`HISTORY_ACCOUNT_GROUPING=FAIL`, `HISTORY_FULL_ITEM_CONTENT=FAIL` y
`HISTORY_VIEW_TICKET=MISSING`. R2 implementó agrupación por
`OCUPACION_MESA_ID`, detalle completo y ticket canónico; R2-A..R2-E fueron
`PASS`. Estado final: `P2_T46_STATUS=CLOSED_TESTING_CERTIFIED`.

El finding independiente `NEGOCIO_OCCUPATION_CLOSE_LIVE_REFRESH_BUG` sigue
`CONFIRMED_PHYSICAL` y abierto; no fue modificado ni cerrado por T46.

## P2-T46-R4 — Production checkpoint — 2026-09-11

La remediación T46 fue promovida a Production con diff curado exact-scope.
No se introdujeron findings nuevos: `NEW_SECRET_OR_PII_FINDINGS=0`, T02=0 y
unrelated=0. `NEGOCIO_OCCUPATION_CLOSE_LIVE_REFRESH_BUG` permanece
`CONFIRMED_PHYSICAL` y abierto; el release registra explícitamente
`NEGOCIO_REFRESH_FIX_INCLUDED=NO`.

## P2-T43-R3 — findings closeout — 2026-09-12

La recertificación física del operador cerró los findings T43 sin alterar los
findings de otras tareas:

`T43_ORIGINAL_FINDING_2=RESOLVED_PHYSICALLY_CERTIFIED_TESTING`

`T43_ORIGINAL_FINDING_10=RESOLVED_PHYSICALLY_CERTIFIED_TESTING`

`T43_R2_LINKED_EDIT_FINDING=RESOLVED_PHYSICALLY_CERTIFIED_TESTING`

`T43_R2_DELETED_CODE_REUSE_FINDING=RESOLVED_PHYSICALLY_CERTIFIED_TESTING`

`P2_T43_OPERATOR_CERTIFICATION=PASS`.

La autoridad sigue separada: la identidad personal proviene de
`CuentaOperativa`, la membresía de negocio de `Empleado`, y rol/área continúan
protegidos server-side. No se identificaron findings nuevos en este cierre.
