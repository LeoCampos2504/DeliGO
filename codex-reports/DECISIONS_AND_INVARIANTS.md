# CURRENT DECISIONS AND INVARIANTS — POST-P2-T46-R1 (2026-09-11)

```text
P2_T46_STATUS=CLOSED_PRODUCTION
P2_T46_RELEASE_STATUS=CLOSED_PRODUCTION_CHECKPOINTED
P2_T42_STATUS=CLOSED_PRODUCTION
P2_T48_STATUS=CLOSED_PRODUCTION
P2_T32_STATUS=CLOSED_PRODUCTION_CHECKPOINTED
ACCOUNT_PAYMENT_AUTHORITY=SesionOcupacionMesa
ORDER_MEMBERSHIP_AUTHORITY=Pedido.ocupacionMesaId
HISTORICAL_GROUPING_AUTHORITY=Pedido.ocupacionMesaId
LEGACY_NULL_OCCUPATION_INFERENCE=NO
LEGACY_NULL_OCCUPATION_BACKFILL=NO
LEGACY_ACCOUNTING_RECONSTRUCTION=NO
PREVIOUS_OCCUPATION_CURRENT_SURFACE_ISOLATION=PASS
NEGOCIO_OCCUPATION_CLOSE_LIVE_REFRESH_BUG=CONFIRMED_PHYSICAL
NEGOCIO_REFRESH_FINDING_STATUS=OPEN
NEGOCIO_REFRESH_EXISTING_TASK_OWNER=NONE
NEGOCIO_REFRESH_FORMALIZED_TASK=P2-T53
P2_T02_STATUS=WAITING_FOR_REMAINING_EXTERIOR_AND_COMPLETION_PHYSICAL_EVIDENCE
P2_T02_SOFTWARE_ACTIONABLE_NOW=NO
P2_T02_R4_STATUS=PHYSICALLY_CERTIFIED_NORMAL_FLOW
T23_NAVIGATION_FOLLOW_SCOPE=PARTIAL
T24_NAVIGATION_MAP_MATCHING_SCOPE=CONFIRMED_RELATED
DRIVER_NAVIGATION_UX_TASK_ID=P2-T54
P2_T32_EXCLUDED_FROM_ACTIVE_BACKLOG=SI
NEXT_RECOMMENDED_SOFTWARE_TASK=P2-T43
PUBLIC_RELEASE_AUTHORIZED=NO
```

## P2-T02-R5 — navigation UX handoff and GPS invariants (2026-09-12)

```text
P2_T02_R4_STATUS=PHYSICALLY_CERTIFIED_NORMAL_FLOW
CURRENT_REPARTIDOR_NAVIGATION=ROUTE_OVERVIEW
NAVIGATION_GOOGLE_MAPS_LIKE_FOLLOW_MODE=NEW_PRODUCT_UX_REQUIREMENT
DELIGO_DRIVER_NAVIGATION_TARGET=GOOGLE_MAPS_LIKE_IN_APP_FOLLOW_MODE
FOLLOW_CAMERA_REQUIRED=SI
RECENTER_REQUIRED=SI
DRIVER_HEADING_REQUIRED=SI
MAP_BEARING_DESIRED=SI

ONE_DEVICE_GEOLOCATION_WATCHER_AUTHORITY=SI
SECOND_GEOLOCATION_WATCHER_ALLOWED=NO
CURRENT_MAP_RENDERER=LEAFLET_1_9_4
CURRENT_TILE_PROVIDER=OPENSTREETMAP
CURRENT_ROUTING_PROVIDER_TESTING=OSRM_PUBLIC
CURRENT_ROUTE_SOURCE=OSRM_GEOJSON
CURRENT_ROUTE_RECALC_POLICY=INITIAL_THEN_AFTER_30S_AND_100M_OR_120S_MAX
NAV_RENDERER_DECISION_REQUIRED=SI
OPTION_A=KEEP_LEAFLET
OPTION_B=MAPLIBRE_GL_FOR_DRIVER_NAVIGATION

T23_NAVIGATION_FOLLOW_SCOPE=PARTIAL
T24_NAVIGATION_MAP_MATCHING_SCOPE=CONFIRMED_RELATED
DRIVER_NAVIGATION_UX_TASK_REQUIRED=SI
DRIVER_NAVIGATION_UX_TASK_ID=P2-T54
DRIVER_NAVIGATION_UX_TASK_TITLE=Driver Turn-by-Turn Follow Camera UX
FALLBACK=SI
PRIMARY_NAVIGATION_TARGET=DELIGO_IN_APP
```

`useRepartidorTracking` permanece como única autoridad de geolocalización y
la navegación sólo consume `latestPosition` de forma read-only. La decisión
preliminar de renderer para T54 favorece auditar MapLibre GL como opción
recomendada para bearing, camera easing y heading-up nativos; Leaflet queda
válido para el runtime actual y no se migra en R5. No se cambia proveedor de
tiles ni routing.

## P2-T02-R5A — Client tracking safe-area invariants (2026-09-12)

```text
CLIENT_TRACKING_SAFE_AREA_FINDING=CONFIRMED_PHYSICAL
CLIENT_TRACKING_FULL_BLEED_PRESERVED=SI
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
CHAT_FILES_CHANGED=0
GOOGLE_MAPS_LIKE_NAVIGATION_IMPLEMENTED=NO
GOOGLE_MAPS_LIKE_NAVIGATION_SCOPE_CHANGED=NO
P2_T02_R5A_PHYSICAL_CERTIFICATION=PENDING_OPERATOR
NEXT_ACTION=OPERATOR_CLIENT_TRACKING_IOS_LAYOUT_RECERTIFICATION
```

R5A modifica sólo el layout local de `DeliveryTrackingMap`: safe-area top en
el header, grid de tres columnas para centrado estable y safe-area bottom en
el footer. No agrega padding al body/layout global, no cambia `viewportFit`,
no altera Leaflet, markers, bounds, tracking ni routing.

## P2-T02-R5B — physical certification closeout invariants (2026-09-12)

```text
R5A_IPHONE_TOP_SAFE_AREA=PASS
R5A_IPHONE_BOTTOM_SAFE_AREA=PASS
R5A_ANDROID_LAYOUT_SMOKE=PASS
CLIENT_TRACKING_TOP_SAFE_AREA_PHYSICAL=PASS
CLIENT_TRACKING_CLOSE_BUTTON_PHYSICAL=PASS
CLIENT_TRACKING_HEADER_CENTERING_PHYSICAL=PASS
CLIENT_TRACKING_BOTTOM_SAFE_AREA_PHYSICAL=PASS
CLIENT_TRACKING_ANDROID_LAYOUT_PHYSICAL=PASS
P2_T02_R5A_OPERATOR_CERTIFICATION=PASS
P2_T02_R5A_STATUS=CLOSED_TESTING_CERTIFIED
CLIENT_TRACKING_FULL_BLEED_PRESERVED=SI
CLIENT_TRACKING_TOP_SAFE_AREA_AFTER=SI
CLIENT_TRACKING_CLOSE_VISIBLE_CONTRACT=SI
CLIENT_TRACKING_HEADER_CENTERED=SI
CLIENT_TRACKING_BOTTOM_SAFE_AREA_AFTER=SI
MAP_LAYOUT_FLEX_REMAINS_VALID=SI
TRACKING_LOGIC_CHANGED=NO
GPS_LOGIC_CHANGED=NO
ROUTING_LOGIC_CHANGED=NO
LEAFLET_BEHAVIOR_CHANGED=NO
MAP_MARKER_LOGIC_CHANGED=NO
MAP_FIT_BOUNDS_LOGIC_CHANGED=NO
CHAT_FILES_CHANGED=0
PRISMA_SCHEMA_CHANGED=NO
NEW_MIGRATION=NO
P2_T02_STATUS=WAITING_FOR_REMAINING_EXTERIOR_AND_COMPLETION_PHYSICAL_EVIDENCE
NEXT_ACTION=COMPLETE_P2_T02_REMAINING_PHYSICAL_GATES
PRODUCTION_TOUCHED=NO
PUBLIC_RELEASE_AUTHORIZED=NO
```

La certificación física cierra sólo R5A en Testing. R4 permanece PASS, y el
requisito P2-T54 de follow camera sigue futuro sin iniciar.

# HISTORICAL DECISIONS — P2-T46 audit stop gate (2026-09-10)

```text
P2_T46_STATUS=STOPPED_AUDIT_GATE_WAITING_FOR_APPROVAL
T46_ARCHITECTURE_AUDIT_COMPLETE=SI
CANONICAL_ACCOUNT_DETAIL_BUILDER=buildCuentaMesa
ORDER_OCCUPATION_AUTHORITY=PARTIAL_DIRECT_ID_LEGACY_NULL_AMBIGUOUS
NEW_OCCUPATION_MUST_NOT_INHERIT_PREVIOUS_OPEN_ORDERS=SI
PAYMENT_METHOD_SELECTION_DURING_INDIVIDUAL_TABLE_ORDER=NO_REQUIRED_PRODUCT_BEHAVIOR
PAYMENT_METHOD_SELECTION_AT_ACCOUNT_CLOSE=SI_REQUIRED_PRODUCT_BEHAVIOR
CURRENT_PAYMENT_AUTHORITY=Pedido.metodoPago_ONLY
SCHEMA_CHANGE_REQUIRED=SI_FOR_ACCOUNT_PAYMENT_AUTHORITY
HISTORICAL_ORDER_OCCUPATION_BACKFILL=AMBIGUOUS
NEGOCIO_REFRESH_RELATED_TO_T46=UNCLEAR
T41_AUTHORITY_PRESERVED=SI
TERMINAL_SALON_CLOSE_ACCOUNT=DENY
CLIENT_ADMIN_MUTATIONS=DENY
```

No se implementa la migración ni se mueve el selector de pago hasta definir
qué fila/evento es la autoridad de cobro de una ocupación. No se permite
inferir pertenencia de pedidos legacy por mesa y timestamp.

# DECISIONS AND INVARIANTS — DeliGO

## P2-T48-R2 — promoción Production y checkpoint (2026-09-10)

```text
P2_T48_STATUS=CLOSED_PRODUCTION
SOURCE_T48_SHA=bb228ee43c89073a4355e6a012bb9aeaf3669dcb
RELEASE_T48_SHA=946f8c2404df8be6a1e7252f3d7d2ba520d337f8
PROMOTION_STRATEGY=DIRECT_CHERRY_PICK
FINAL_RELEASE_DIFF_MATCHES_T48_APPROVED_SCOPE=SI
T02_FILES_IN_RELEASE_DIFF=0
T02_HUNKS_IN_RELEASE_DIFF=0
UNAUTHORIZED_POST_T48_DIFF=0
PRISMA_SCHEMA_CHANGED=NO
NEW_MIGRATION=NO
DB_BACKFILL_REQUIRED=NO
SERVER_SIDE_AUTHORITY_PRESERVED=SI
MAIN_PROMOTION_PERFORMED=SI
PRODUCTION_DEPLOYMENT_STATUS=SUCCESS_RUNNING_EXACT_COMMIT
POST_T48_STABLE_TAG=p2-t48-stable-2026-09-10
POST_T48_STABLE_TAG_SHA=946f8c2404df8be6a1e7252f3d7d2ba520d337f8
P2_T42_STATUS=CLOSED_PRODUCTION
P2_T02_STATUS=WAITING_FOR_ADDITIONAL_PHYSICAL_EVIDENCE
TEST_T02_ORDER_LEFT_ACTIVE=SI
NEXT_RECOMMENDED_SOFTWARE_TASK=P2-T46
PRODUCTION_TOUCHED=SI (sólo promoción exacta T48)
PUBLIC_RELEASE_AUTHORIZED=NO
```

La promoción a Production fue un fast-forward sin force desde la rama curada
basada en el tag T42. El parent de Testing contiene T02, pero el release sólo
aplicó el delta de cuatro archivos T48. Los dos findings nuevos permanecen
abiertos; no se los implementó ni se reabrió T48 por ellos.

## P2-T48-R1 — certificación física y findings adyacentes (2026-09-10)

```text
P2_T48_STATUS=CLOSED_TESTING_CERTIFIED
P2_T48_OPERATOR_CERTIFICATION=PASS
P2_T48_PHYSICAL_CASE_A=PASS
P2_T48_PHYSICAL_CASE_B=PASS
P2_T48_PHYSICAL_CASE_C=PASS
P2_T48_RELEASE_ELIGIBLE=SI
NEGOCIO_OCCUPATION_CLOSE_LIVE_REFRESH_BUG=CONFIRMED_PHYSICAL
NEGOCIO_OCCUPATION_REFRESH_ROOT_CAUSE=UNKNOWN_PENDING_AUDIT
NEGOCIO_OCCUPATION_REFRESH_TARGET_TASK=TO_BE_RECONCILED
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
P2_T42_STATUS=CLOSED_PRODUCTION
P2_T02_STATUS=WAITING_FOR_ADDITIONAL_PHYSICAL_EVIDENCE
TEST_T02_ORDER_LEFT_ACTIVE=SI
PRODUCT_CODE_CHANGED=NO
TEST_CODE_CHANGED=NO
DATABASE_CHANGED=NO
COMMIT_CREATED=NO
PUSH_PERFORMED=NO
DEPLOY_PERFORMED=NO
PRODUCTION_TOUCHED=NO
```

T48 queda cerrado en Testing por evidencia física A/B/C. Los hallazgos de
Negocio→Salón y de aislamiento de pedidos entre ocupaciones permanecen
abiertos. No se elige root cause para el primero ni autoridad contable para el
segundo; P2-T46 es sólo destino provisional del segundo.

## P2-T48 — paridad de ocupación en Salón Personal (2026-09-10)

```text
P2_T48_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_WAITING_OPERATOR
CANONICAL_OCCUPATION_MODEL=Mesa.ocupacionActualId -> SesionOcupacionMesa
CANONICAL_OCCUPATION_ACTIVE_RULE=pointer same business+mesa and estado=activa
CANONICAL_OCCUPATION_SERVER_AUTHORITY=GET /api/operaciones/mesas/[id]/ocupacion
OCCUPATION_SERVER_SIDE_SCOPING=business + actor/session + mesa/area
ORDER_PRESENCE_USED_AS_OCCUPATION_AUTHORITY_AFTER=NO
OCCUPATION_REFRESH_MECHANISM=existing Salon Personal 15s + focus + visibility polling propagates refreshKey
QUERY_INVALIDATION=occupation control re-fetch on occupationRefreshKey; no new realtime
PERSONAL_SESSION_TERMINAL_ISOLATION=PRESERVED
MOZO_PRODUCT_BEHAVIOR_CHANGED=NO
NEGOCIO_SALON_BEHAVIOR_CHANGED=NO
CROSS_BUSINESS_OCCUPATION_ACCESS=DENY (401)
CROSS_EMPLOYEE_OCCUPATION_ACCESS=DENY_FOR_MOZO_WRONG_MESA (403)
T48_PRISMA_SCHEMA_CHANGED=NO
T48_NEW_MIGRATION=NO
T48_DB_BACKFILL_REQUIRED=NO
PRODUCTION_TOUCHED=NO
PUBLIC_RELEASE_AUTHORIZED=NO
```

Decisión: Salón Personal reutiliza la autoridad canónica existente y conecta
su polling existente al control compartido mediante una señal opcional de
refresh. No se duplica la autoridad en el panel, no se deriva ocupación de
pedidos y no se introduce realtime ni una mutación de esquema.

## P2-T42-R1 — cierre Production y reconciliación de roadmap (2026-09-10)

```text
P2_T42_STATUS=CLOSED_PRODUCTION
P2_T42_RELEASE_COMMIT=46a1d55634e8bd848e160302cdb64a32be241c89
P2_T42_PROMOTION=DIRECT_CHERRY_PICK_FROM_ORIGIN_MAIN
P2_T42_EXACT_SCOPE=SI
T02_FILES_IN_PRODUCTION_DIFF=0
PRODUCTION_DEPLOYMENT_COMMIT_MATCH=SI
PRODUCTION_STATUS=SUCCESS_RUNNING
POST_T42_STABLE_TAG=p2-t42-stable-2026-09-10
P2_T02_STATUS=WAITING_FOR_ADDITIONAL_PHYSICAL_EVIDENCE
TEST_T02_ORDER_LEFT_ACTIVE=SI
NEXT_RECOMMENDED_SOFTWARE_TASK=P2-T48
PUBLIC_RELEASE_AUTHORIZED=NO
```

La promoción de T42 no autoriza promover T02 ni convertir el checkpoint
técnico en lanzamiento público. El siguiente trabajo recomendado es P2-T48;
esta tarea no lo inicia.

## P2-T02-B4-R3-R1 — iOS physical pass closeout (2026-09-10)

```text
P2_T02_B4_R3_PHYSICAL_IOS_RETEST=PASS
P2_T02_B4_IOS_STATUS=PASS
IOS_B4_RETURN_FROM_GOOGLE_MAPS_ROUTE_RECOVERY=RESOLVED_AND_PHYSICALLY_CERTIFIED_IOS
P2_T02_B4_STATUS=IOS_CERTIFIED_ANDROID_PHYSICAL_PENDING
P2_T02_B4_ANDROID_STATUS=PENDING_DEVICE_AVAILABILITY
P2_T02_STATUS=WAITING_FOR_ADDITIONAL_PHYSICAL_EVIDENCE
P2_T02_IOS_INDOOR_STATUS=PASS_FOR_TESTED_SCENARIOS
TEST_T02_ORDER_LEFT_ACTIVE=SI
NEXT_RECOMMENDED_SOFTWARE_TASK=P2_T42_FORMAL_CLOSEOUT_AND_CURATED_PROMOTION
P2_T23_STARTED=NO
P2_T24_STARTED=NO
```

La certificación iOS no se generaliza a Android ni convierte el tracking
best-effort en garantizado. El movimiento exterior, recorrido real,
background con movimiento, T23/T24 y cierre de entrega siguen pendientes.

## P2-T02-B4-R3 — route recovery contract (2026-09-10)

```text
ROUTE_PROVIDER=OSRM_PUBLIC_TESTING_ONLY
OSRM_ENDPOINT=https://router.project-osrm.org/route/v1/driving
ROUTE_FETCH_TIMEOUT_MS=10000
ROUTE_TERMINAL_OUTCOMES=SUCCESS|ERROR|ABORTED|TIMEOUT
ROUTE_FOREGROUND_SIGNALS=visibilitychange|pageshow|focus
ROUTE_FOREGROUND_RECOVERY=ONLY_IF_NO_ROUTE_OR_ERROR_OR_STALE_LOADING
ROUTE_REQUEST_RACE_PROTECTION=GENERATION_TOKEN_PLUS_ABORT
ROUTE_CLOSE_REOPEN=REAL_COMPONENT_UNMOUNT
GPS_WATCHER_COUNT_CHANGE=0
TRACKING_API_CHANGE=NO
ANDROID_CHANGE=NO
PRODUCTION_TOUCHED=NO
PHYSICAL_FINDING_CLOSED=NO_PENDING_IOS_RETEST
R3_COMMIT=fb3e584259cb2c57605c783543c7fdb1dc845454
R3_TESTING_DEPLOYMENT=b54f0214-69a0-4e93-8589-fc2f37054301_SUCCESS
```

Se conserva la decisión de no resolver atribución/proveedor OSRM en R3. La
recuperación es web-standard y no depende de user-agent de iOS.

## P2-T02-B4-R2 — deploy Testing confirmado; habilitación del gate físico iOS (2026-09-10)

```text
RAILWAY_PROJECT=amiable-rejoicing
RAILWAY_ENVIRONMENT=TESTING
RAILWAY_SERVICE=DeliGO Copy
B4_TESTING_DEPLOYMENT_ID=8b0fc718-f65e-4367-8210-07f12b8a5956
B4_TESTING_DEPLOYMENT_STATUS=SUCCESS
B4_TESTING_INSTANCE_STATUS=RUNNING
B4_TESTING_DEPLOYMENT_BRANCH=testing-codex
B4_TESTING_DEPLOYMENT_COMMIT=0c362895656d389de73fd0dd94a124fe3aac8dd1
B4_TESTING_DEPLOYMENT_COMMIT_MATCH=SI
B4_TESTING_LOGS=CLEAN
B4_TESTING_DEPLOY_CONFIRMED=SI
B4_RUNTIME_NAVIGATION_PRESENT=NOT_DISTINGUISHABLE (evidencia secundaria)
PRODUCTION_TOUCHED=NO
```

La metadata del CLI de Railway es la autoridad del commit. El deploy exacto
queda habilitado para certificación física iOS; B3/B4 no se cierran hasta que
el operador complete la matriz física. Android permanece pendiente de
dispositivo y no se sustituye por iOS.

## P2-T02-B4-R1 — autoridad vigente de deploy y certificación física (2026-09-10)

```text
BASELINE_TESTING=0c362895656d389de73fd0dd94a124fe3aac8dd1
BASELINE_MAIN=bb17c7dd1eb9b8f4cb94d03de834019baf182987
B4_TESTING_DEPLOY_CONFIRMED=NO
B4_RUNTIME_NAVIGATION_PRESENT=NOT_DISTINGUISHABLE
P2_T02_B3_STATUS=WAITING_FOR_CROSS_PLATFORM_PHYSICAL_CERTIFICATION
P2_T02_B4_STATUS=IMPLEMENTED_TESTED_PUSHED_TESTING_PENDING_DEPLOY_CONFIRMATION_AND_PHYSICAL_CERTIFICATION
ANDROID_B3_PHYSICAL=PENDING_DEVICE_AVAILABILITY
ANDROID_B4_PHYSICAL=PENDING_DEVICE_AVAILABILITY
```

La estrategia física vigente es `IOS_NOW_ANDROID_DEFERRED_BATCH`: iOS está
disponible para certificar cuando exista confirmación del commit exacto en
Testing; Android queda acumulado hasta que regrese el dispositivo. Esta
decisión no cierra B3/B4 físicamente ni autoriza Production.

El programa nativo completo queda aprobado como dirección futura, no iniciado:
después de todas las tareas T actuales y estabilidad final de Production,
`Capacitor first` sobre el codebase compartido, con continuidad PWA durante la
migración y capacidades nativas Android/iOS sólo donde sean necesarias.

## DECISIÓN DE PRODUCTO — OPTION-C reemplaza OPTION-V2: tracking de Repartidor best-effort en background (P2-T02-B3, 2026-09-10)

```text
BACKGROUND_TRACKING_MODEL=OPTION-C (best-effort, nunca corta voluntariamente por hidden) — SUPERSEDE OPTION-V2 (Stage 1B, commit 0ad1562, 2026-08-24)
BACKGROUND_TRACKING_GUARANTEED=NO (sin cambios — sigue siendo un límite real de la plataforma, nunca una promesa de producto)
DELIGO_VOLUNTARY_BACKGROUND_STOP=PROHIBIDO desde P2-T02-B3 — ningún código de tracking debe volver a cortar watcher/heartbeat/watchdog/pending-sends únicamente por `document.visibilityState==="hidden"`
CLIENT_STALE_LOCATION_AUTHORITY=isTrackingLocationStale (src/lib/tracking-freshness.ts), threshold 120000ms — ÚNICA autoridad para decidir si el Cliente puede mostrar "En vivo"/"Tiempo real"; la conectividad del socket (isLiveSocket) NUNCA por sí sola implica que la posición sea fresca
```

Decisión del operador (2026-09-10, tras el audit P2-T02-B2): el requisito de
producto real — tracking útil mientras el Repartidor usa Maps/Waze, recibe
una llamada, o bloquea la pantalla por períodos razonables — exige más que
"recuperar rápido al volver a foreground" (ya resuelto desde Stage 6I/6J).
OPTION-V2 (cortar el watcher deliberadamente al ocultarse) fue una decisión
razonable en su momento — tomada por batería/determinismo, ANTES de que
"tracking continuo en background" existiera como requisito explícito — pero
quedó superada. Cualquier tarea futura que toque `use-repartidor-tracking.ts`
debe preservar: (a) el reinicio duro defensivo al volver a foreground (Stage
6I/6J, sigue siendo necesario porque Chromium puede congelar la ejecución sin
avisar), (b) el gate real de elegibilidad (`isCoreEligible`, nunca relajado
por esta decisión — sigue sin haber tracking sin entrega activa), y (c) la
honestidad de staleness del Cliente — un fix futuro de background NUNCA debe
reintroducir un badge "en vivo" incondicional. Un wrapper nativo (Capacitor o
equivalente) queda registrado como escalamiento futuro (`NATIVE_WRAPPER_ESCALATION_REQUIRED=PENDING_PHYSICAL_EVIDENCE`)
— sólo reconsiderar con evidencia física real de que el best-effort de
Chromium es insuficiente, nunca por adelantado.

## INVARIANTE DE ARQUITECTURA — una única autoridad de formulario/lógica de dirección de Cliente (P2-T32, 2026-09-09)

```text
CLIENT_ADDRESS_AUTHORITY=src/components/location/address-form.tsx (campos, validación, payload, submit) + address-map-picker.tsx (mapa Leaflet, GPS, reverse-geocoding)
CLIENT_ADDRESS_DUPLICATED_FORM_AUTHORITY_ALLOWED=NO (decisión del operador, preservada)
CONSUMERS=Perfil (client-profile-panel.tsx, AddressesSection) y el modal de checkout (client-address-modal.tsx) — ambos instancian la MISMA AddressForm, nunca una copia
```

Descubierto durante la auditoría de P2-T32: el modal de checkout
(`LocationPickerModal`) nunca llamaba al backend real — sólo escribía al
store local del carrito, sin campo alias. Cualquier tarea futura que
toque el flujo de direcciones de Cliente debe extender `AddressForm`/
`AddressMapPicker`, nunca crear un tercer formulario o un segundo picker
de mapa/GPS. `location-map-picker.tsx`/`location-picker-modal.tsx`
quedan preservados sin consumidores de Cliente (un test estático de
contrato iOS referencia el primero por path) — no reactivarlos para
direcciones de Cliente sin resolver antes esa referencia.

## INVARIANTE DE TEST HYGIENE — localizar elementos DOM por texto/rol, nunca por posición; inputs controlados requieren el setter nativo (P2-T32, 2026-09-09)

```text
DOM_QUERY_BY_POSITION_FORBIDDEN_WHEN_AMBIGUOUS=SI (usar texto/rol/data-testid cuando puede haber más de un match)
CONTROLLED_INPUT_TEST_SETTER=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set — nunca asignar element.value directamente en un test de un input controlado de React
```

Encontrado en la primera versión de `address-form.test.tsx`:
`host.querySelector("button")` devolvía el botón del mock de mapa (el
primero en el DOM), no el submit real, dando falsos negativos en varios
tests. Y asignar `input.value = "x"` + `dispatchEvent("input")` no
notificaba a React (que trackea el valor previo en una propiedad oculta
del propio nodo DOM) — los tests veían el input "vacío" pese a la
asignación. Ambos corregidos con helpers dedicados
(`submitButton()` por texto, `setInputValue()` con el setter nativo).
Aplicable a cualquier test futuro de render real (happy-dom +
react-dom/client) en este repo.

## DECISIONES DE PRODUCTO Y BACKLOG — consolidación autoritativa (P2-CURRENT-AUTHORITATIVE-BACKLOG-RECONCILIATION, 2026-09-09)

```text
GPS_REQUIRED_BY_OPERATOR=SI — P2-T02/T23/T24 se mantienen, NO se eliminan ni se convierten en opcional post-launch sin nueva decisión explícita
DARK_KITCHEN_STANDALONE_TASK_REQUIRED=NO — la capacidad de negocio "delivery-only" ya existe (Negocio.ofreceRetiro + T20-DK1/DK2A-C, ver hallazgo en el reporte de esta tarea) — NO introducir tipo de negocio DarkKitchen, modelo DB, flag especial, categoría nueva, ni UX especial
CLIENT_ADDRESS_UX_UNIFICATION_TASK=P2-T32 — el modal de checkout y Perfil deben compartir la MISMA autoridad de formulario/lógica de dirección (nunca un segundo formulario divergente); deep-link obligatorio desde "Agregar dirección" en Inicio hasta "Mis direcciones" en Perfil; auto-selección de la nueva dirección tras guardar desde carrito si el contrato lo permite de forma segura; requiere gate físico/mobile
SUPPORT_INSTAGRAM_CONTACT_SURFACE=DEFERRED_TO_END_OF_CURRENT_BACKLOG — mejora mantenida, no blocker de lanzamiento salvo decisión futura
FINAL_SECURITY_REVIEW_TASK=P2-T33 — debe ejecutarse cerca del final, después de los cambios funcionales grandes pendientes (T32/T02/T23/T24/T34/T35/T36); alcance mínimo: authentication, sesiones, autorización, aislamiento de familias de actor, cross-tenant, IDOR/BOLA, CSRF/origin, validación de input, XSS, injection, uploads/imágenes, OAuth, cookies, secrets, seguridad de Push, realtime/socket auth, auth de terminal, rate limiting, replay, race/concurrency abuse, superficies de abuso de pedidos/pagos, logging, PII, endpoints de diagnóstico, disclosure de errores, admin/SuperAdmin, mínimo privilegio, postura de dependencias, OWASP ASVS, matriz STRIDE — log sanitization global queda ABSORBIDO ahí, no es tarea separada
PAYMENTS_WORKSTREAM_SEPARATE=SI — PAYMENTS-01..10 permanece un workstream completamente separado de P2, sin mezclar su orden salvo decisión futura explícita del operador; no se inicia sin esa decisión
P2_FINAL_AUDIT_LAUNCH_READINESS_TASK=P2-T37 — sólo puede ejecutarse después de disponer/cerrar todos los blockers obligatorios; cerrar T29/T30/T31/T32/etc. NO implica public launch ready por sí solo
```

Consolidado tras una auditoría explícita del operador sobre el backlog
completo pendiente, para evitar que decisiones quedaran sólo en el
chat. Detalle completo, incluidos los hallazgos que corrigieron premisas
del propio operador (P2-T18 ya cerrado; Dark Kitchen con implementación
dedicada más fuerte que "indirecta"; Thermal Printing con módulo
funcional ya wireado, contradiciendo "no iniciado") en
`codex-reports/P2_CURRENT_AUTHORITATIVE_BACKLOG_RECONCILIATION.md`. La
autoridad primaria de estado VIGENTE del backlog es la sección
`CURRENT AUTHORITATIVE BACKLOG` al inicio de `ROADMAP.md`, no ningún
snapshot histórico de este archivo ni de `ROADMAP.md` por debajo de esa
sección.

## INVARIANTE DE TEST HYGIENE — nunca borrar datos reales/compartidos para forzar un PASS; usar `test.skipIf` + top-level await cuando el resultado depende de un precondición de estado real (P2-T30, 2026-09-09)

```text
NEVER_DELETE_REAL_DATA_TO_FORCE_TEST_PASS=SI (absoluto)
CONDITIONAL_SKIP_PATTERN=top-level await UNA vez al cargar el archivo (calcula la condición real de la DB) + test.skipIf(condicion) en los tests específicos que dependen de ella
SKIP_MUST_BE_EXPLICIT_AND_DOCUMENTED=SI (nunca un try/catch silencioso que "pase" igual, nunca un early-return que se vea como PASS)
PERMANENT_COVERAGE_SUPPLEMENT=cuando un test de integración se skipea por una precondición de DB no reproducible en un entorno compartido, agregar cobertura PERMANENTE e inmune a ese estado (p.ej. contra una función pura ya exportada con datos 100% sintéticos) en vez de dejar la lógica sin ningún test cuando el skip aplica
```

Descubierto al corregir `superadmin-auth.test.ts` (F-PRE-T29-03): 4
tests dependían de que la tabla `super_admins` completa no tuviera
NINGUNA identidad ya vinculada — una regla de negocio real de
`resolverIdentidadSuperadminGoogle` (rechaza creación/vinculación en
cuanto existe una identidad ajena), no un defecto de fixture. La DB
compartida de TESTING tiene 3 identidades reales vinculadas hoy —
borrarlas para que esos 4 tests "pasen" habría sido exactamente lo que
`deligo-safe-task` prohíbe (nunca datos reales/compartidos para
conveniencia de un test). La solución fue: `top-level await` una vez al
cargar el archivo para conocer el estado REAL de la DB, `test.skipIf()`
explícito y documentado en los tests bloqueados (nunca silencioso), y
tests PERMANENTES nuevos contra la función pura de decisión
(`resolverIdentidadSuperadminGoogle`, ya exportada exactamente para esto)
con snapshots sintéticos — cobertura de esa lógica que NUNCA se salta,
sin importar el estado de la DB compartida. Aplicable a cualquier tarea
futura de fixture hygiene que encuentre el mismo patrón (un test cuyo
resultado depende de "cero filas de X en TODA la tabla" contra una DB
compartida con datos reales). Ver
`codex-reports/P2_T30_SUPERADMIN_AUTH_TEST_FIXTURE_HYGIENE.md`.

## INVARIANTE OPERATIVO — el CLI de Railway local está linkeado por defecto al entorno TESTING, no a Production (P2-T29D-T29E-PROMOTE-TO-MAIN-AND-PRODUCTION, 2026-09-09)

```text
RAILWAY_CLI_DEFAULT_LINKED_ENVIRONMENT=TESTING
RAILWAY_CLI_DEFAULT_LINKED_SERVICE=DeliGO Copy (c6335604-063a-4a10-9c82-b0acb9e8ca7a)
PRODUCTION_VERIFICATION_REQUIRES_EXPLICIT_FLAGS=SI (-e production -s "<nombre exacto del servicio>")
```

Detectado durante la promoción final de P2-T29D+T29E: `railway domain`
sin flags devolvió el dominio de TESTING
(`deligo-copy-production.up.railway.app`, un nombre engañosamente
similar a "production" pese a ser TESTING), y `railway logs
--deployment` sin flags también apunta al servicio/entorno linkeado
localmente (TESTING), no a Production. El dominio REAL de Production es
`https://deligo.ar`, obtenido recién con `railway domain -e production
-s "DeliGO"`. **Cualquier tarea futura que verifique logs, dominio, o
estado de Production vía `railway` CLI debe pasar `-e production` y
`-s "<nombre exacto>"` explícitamente en CADA comando** — nunca confiar
en el link local por defecto, que apunta a TESTING en este entorno de
trabajo. `railway status --json` (sin flags) sí devuelve todos los
entornos y sirve para auditar ambos sin este riesgo, siempre que se
filtre por `environment.name` explícitamente al parsear. Ver
`codex-reports/P2_T29D_T29E_PROMOTE_TO_MAIN_AND_PRODUCTION.md` §22-24.

## DECISIÓN DE PRODUCTO — copy de la notificación Cliente "aceptado" (P2-T29D, 2026-09-09)

```text
ACCEPTED_NOTIFICATION_STILL_DEFERRED_TO_T29D=NO (resuelto — reemplaza la entrada previa con el mismo nombre)
ACCEPTED_NOTIFICATION_TITLE=Actualización de pedido (genérico existente, sin factory nueva)
ACCEPTED_NOTIFICATION_BODY=${negocioNombre} aceptó tu pedido
ACCEPTED_NOTIFICATION_APPLIES_TO=domicilio, retiro (mesa nunca alcanza `aceptado`, MESA_PASA_POR_ACEPTADO=false, sin reabrir)
ACCEPTED_NOTIFICATION_COPY_DECIDED_BY=operador, vía pregunta directa con 3 opciones (no inventado, no tomado del "(propuesto)" de la auditoría original read-only)
```

Último residual real del diseño original de T29D
(`P2_T29_ESPERANDO_REPARTIDOR_ACCEPTANCE_REDESIGN_AUDIT_AND_DESIGN.md`
§10) — T29B/T29B-R1 lo dejaron deliberadamente sin copy ("diferido a
T29D"). Antes de implementar, se confirmó que ningún reporte previo
había cerrado un copy definitivo (sólo un texto "(propuesto)" de una
auditoría sin autoridad de decisión de producto) — se presentaron 3
opciones cortas al operador y se implementó exactamente la elegida, sin
elección unilateral. Reutiliza el mecanismo genérico existente
(`orderUpdateNotification.statusMessages`, mismo estilo que
`confirmado`/`preparando`) — no se creó ninguna factory nueva, tal como
el diseño original ya indicaba (`NEW_FACTORY_REQUIRED=NO`). Ver
`codex-reports/P2_T29D_RESIDUAL_CLIENT_NOTIFICATIONS_TIMELINE_AUDIT_AND_IMPLEMENTATION.md`.

## CHECKPOINT — P2-T29B+T29C promovidos a Production; T29D requiere reconciliación de alcance residual antes de implementar (2026-09-09)

```text
PRODUCTION_COMMIT=7a3a1dcbfa89bd63c96471290e936b979d74c5ce (era c45fd5ec8cd771d68020f37d892be31d62fb54c5)
TAG=p2-t29b-t29c-stable-2026-09-09 -> 7a3a1dcbfa89bd63c96471290e936b979d74c5ce
P2_T29B_STATUS=CLOSED_PRODUCTION_CHECKPOINTED / P2_T29C_STATUS=CLOSED_PRODUCTION_CHECKPOINTED
P2_T29D_REQUIRES_RESIDUAL_SCOPE_RECONCILIATION=SI
```

El significado final de `esperando_repartidor`/`en_camino` y la
autoridad única de disponibilidad de Repartidor (ver la entrada
inmediatamente abajo) ya no son sólo comportamiento de TESTING — están
en Production, sirviendo el dominio real (`deligo.ar`), aunque
`DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED` sigue vigente (sin tráfico
de clientes reales todavía).

**Nota para quien planifique P2-T29D**: parte de su alcance histórico
original (matriz de notificaciones Cliente para `aceptado`/
`esperando_repartidor`, timeline Cliente de 5 pasos) YA fue implementada
y certificada físicamente durante `P2-T29B-R1` y forma parte de este
checkpoint de Production — no es trabajo pendiente. Antes de iniciar
T29D, auditar explícitamente contra el diseño original
(`P2_T29_ESPERANDO_REPARTIDOR_ACCEPTANCE_REDESIGN_AUDIT_AND_DESIGN.md`
§10-11) qué notificaciones/UI realmente faltan (p.ej. notificación de
`aceptado`, todavía diferida) para no reimplementar ni duplicar lo que
ya está certificado y en Production.

## INVARIANTE — significado final de esperando_repartidor/en_camino + única autoridad de disponibilidad Repartidor (P2-T29C, 2026-09-09)

```text
CANONICAL_AVAILABLE_DELIVERY_STATE=esperando_repartidor
CANONICAL_AVAILABLE_DELIVERY_DRIVER_ID=null
EN_CAMINO_MEANS_ASSIGNED_ONLY=SI (ya NO significa "buscando repartidor sin asignar" — ese significado quedó exclusivamente en esperando_repartidor)
LEGACY_AVAILABLE_COMPATIBILITY=SI, acotada a un único punto de verdad: isAvailableForDriverAcceptance(estado, metodoEntrega) en src/lib/order-transitions.ts
DATABASE_CAS_FINAL_AUTHORITY=SI (sin cambios — cada CAS de aceptación/auto-cancelación compara contra el valor EXACTO de `estado` leído para esa fila, nunca un `estado: { in: [...] }` ambiguo en la escritura — canónico y legacy son ramas explícitas por construcción, nunca una unión)
```

**Alcance del invariante `estado: { in: [...] }` (aclarado en P2-T29E,
2026-09-09)**: aplica específicamente a los CAS donde el estado de
ORIGEN determina un efecto secundario distinto según cuál rama
matcheó (aceptación/auto-cancelación de Repartidor: canónico vs legacy
implican distinta `estadoAnterior` de auditoría, ver F-P2-T29C-01).
NO es una prohibición general de `{in:[...]}` en cualquier escritura
CAS del repo — `cliente/pedidos/[id]/route.ts` (cancelación de
Cliente, preexistente a T29) usa legítimamente `estado: { in:
cancellableStatuses }` en su `updateMany` porque el destino es siempre
único (`cancelado`) sin ninguna rama que dependa de cuál de los
orígenes cancelables matcheó — sin ambigüedad real, sin efecto
secundario diferenciado. Confirmado durante la auditoría final de
T29E, no es una regresión ni requiere cambio. Ver
`codex-reports/P2_T29E_FINAL_COMPATIBILITY_REGRESSION_AND_PHYSICAL_CERTIFICATION.md`
§13.

Tras T29C, `esperando_repartidor` = pedido listo para que un Repartidor
lo tome, todavía sin asignar; `en_camino` = pedido YA asignado, en etapa
de entrega. Antes de esta tarea, `en_camino` estaba sobrecargado con
ambos significados. La compatibilidad legacy (`en_camino`+
`repartidorId=null` sigue siendo aceptable) es NECESARIA, no opcional:
`NEGOCIO_T29B_ROLLOUT_FORWARD_TRANSITIONS` todavía acepta la arista
directa `preparando->en_camino` durante el rollout de T29B — un pedido
creado por esa vía DESPUÉS del deploy de T29C seguiría llegando a ese
estado, y si la disponibilidad/aceptación/auto-cancel sólo reconocieran
el canónico, ese pedido quedaría atascado sin que ningún Repartidor
pudiera tomarlo. La compatibilidad se centraliza en una única función
pura, consumida por los 3 call sites (query de disponibilidad, CAS de
aceptación, auto-cancel) — nunca una tercera copia de la decisión.
`NEGOCIO_WAITING_TO_EN_CAMINO_ACTION` sigue prohibido: Negocio nunca
puede producir `esperando_repartidor->en_camino` manualmente (waiting
driver boundary de T29B, reverificado sin cambios) — sólo la aceptación
real de un Repartidor lo hace. Ver
`codex-reports/P2_T29C_REPARTIDOR_WAITING_DRIVER_ACCEPTANCE_AND_CONCURRENCY.md`.

**Confirmado físicamente (2026-09-09)**: certificación con DOS
repartidores reales en TESTING, 11/11 ítems PASS — este invariante ya no
es sólo evidencia automática (Promise.all contra Postgres real), también
está confirmado en dispositivos reales. Ver
`codex-reports/P2_T29C_PHYSICAL_CERTIFICATION_CLOSEOUT.md`.

## DECISIÓN — newDeliveryNotification se dispara en la transición canónica de disponibilidad, no en la de asignación (P2-T29C, 2026-09-09)

```text
NEW_DELIVERY_NOTIFICATION_BOUNDARY=preparando->esperando_repartidor (canónico) O preparando->en_camino directo (legacy, preservado) — NUNCA en esperando_repartidor->en_camino (aceptación real de Repartidor)
ASSIGNMENT_NOTIFICATION_TO_CLIENTE=preexistente ("Repartidor asignado 🛵" en aceptar/route.ts), preservada sin cambios
```

"Hay un nuevo delivery disponible" y "un repartidor ya lo tomó" son
eventos semánticamente distintos y viven en endpoints distintos —
`negocio/pedidos/[id]/estado/route.ts` (dispara el primero) nunca
ejecuta el segundo, que ocurre exclusivamente en
`repartidor/pedidos/[id]/aceptar/route.ts`. Esto hace que ambos avisos
sean mutuamente excluyentes por construcción para un mismo pedido, sin
necesitar ningún guard adicional contra duplicación.

## DECISIÓN DE PRODUCTO — timeline Cliente de 5 pasos con primer nodo dinámico (Recibido->Aceptado) + notificación dedicada "Buscando delivery" (P2-T29B-R1, 2026-09-09)

```text
CLIENT_TIMELINE_FIVE_STEPS_DYNAMIC_ACCEPTED=SI
CLIENT_TIMELINE_DOMICILIO_STEPS=Recibido/Aceptado (dinámico, mismo nodo) -> Preparando -> Buscando delivery -> En camino -> Listo
CLIENT_TIMELINE_RETIRO_STEPS=Recibido/Aceptado (dinámico, mismo nodo) -> Confirmado (legacy, nunca emitido hoy) -> Preparando -> Listo (layout sin cambios respecto a antes de T29B-R1, sólo se corrigió que `aceptado` no apague la barra)
CLIENT_TIMELINE_MESA=sin tocar, sin `aceptado`, sin "Buscando delivery"
CLIENT_WAITING_DRIVER_NOTIFICATION=SI
CLIENT_WAITING_DRIVER_NOTIFICATION_TITLE=Buscando delivery
CLIENT_WAITING_DRIVER_NOTIFICATION_BODY=El local está esperando un delivery para tu pedido.
CLIENT_WAITING_DRIVER_NOTIFICATION_SCOPE=SÓLO domicilio, SÓLO transición real preparando->esperando_repartidor (no aceptado, no retiro, no legacy preparando->en_camino, no CAS loser)
ACCEPTED_NOTIFICATION_STILL_DEFERRED_TO_T29D=NO (era SI al momento de T29B-R1 — residual cerrado en P2-T29D, ver la entrada más arriba en este mismo documento)
```

Decisión del operador tomada durante la certificación física de
P2-T29B: la timeline Cliente debía seguir mostrando exactamente 5
posiciones para Domicilio (nunca 6) al incorporar los 2 estados nuevos
de T29B (`aceptado`/`esperando_repartidor`) — el primer nodo
("Recibido") se vuelve dinámico y pasa a mostrarse como "Aceptado" en
el MISMO lugar en vez de agregar un sexto nodo o mostrar ambos
simultáneamente. Retiro conserva su layout previo sin cambios de forma
(4 nodos), sólo se corrigió el mismo bug de fondo (`aceptado` apagando
la barra). Esta decisión es específica de la timeline Cliente — no
implica ni autoriza cambios en el badge/label general (`statusLabel`
sigue devolviendo "Buscando repartidor" para otras superficies), ni en
la timeline/flujo de Mesa, ni en ningún flujo de Repartidor. Ver
`codex-reports/P2_T29B_R1_CLIENT_TIMELINE_AND_WAITING_DRIVER_NOTIFICATION.md`.

## POLÍTICA — residual pequeño certificado se agrupa con la fase final del epic en vez de una promoción intermedia (P2-T29D, 2026-09-09)

```text
RELEASE_BATCH=P2_T29D_PLUS_P2_T29E
T29D_STANDALONE_PROMOTION_REQUIRED=NO
PROMOTION_EVALUATION_POINT=AFTER_P2_T29E_CERTIFICATION
```

A diferencia de la excepción T29B+T29C (bloque funcional incompleto —
ver abajo), P2-T29D SÍ es funcionalmente completo por sí mismo (una
notificación Cliente aislada, sin dependencia de trabajo futuro). La
decisión de no promoverlo solo es de cadencia, no de completitud: T29E
es la fase final del epic P2-T29 (compatibility + regression +
certificación física final) y puede comenzar inmediatamente después de
T29D — no tiene sentido abrir una promoción a Production sólo por un
cambio de una línea de copy si la siguiente tarea certificada estará
lista en poco tiempo. Reconsiderable si T29E descubre un blocker
grande (en cuyo caso T29D se promovería solo). Ver
`codex-reports/P2_T29D_PHYSICAL_CERTIFICATION_CLOSEOUT.md`.

## POLÍTICA — excepción explícita a la cadencia frecuente: un bloque funcional incompleto no se promueve a Production aunque cada tarea individual ya esté certificada en TESTING (P2-T29B, 2026-09-09)

```text
RELEASE_BATCH=P2_T29B_PLUS_P2_T29C
P2_T29B_PROMOTION_TO_PRODUCTION_AFTER_CLOSE=NO
PROMOTION_EVALUATION_POINT=AFTER_P2_T29C_CERTIFICATION
```

`RELEASE_CADENCE_POLICY=FREQUENT_CERTIFIED_PROMOTIONS` (ver la entrada
de abajo) tiene una excepción explícita, ya prevista en su propia
redacción: "no considerar una tarea elegible si dejaría un bloque
funcional incompleto en Production". T29B hace alcanzable
`esperando_repartidor` para pedidos de domicilio, pero Repartidor
todavía no lo consume (T29C) — promover sólo T29B a Production
dejaría pedidos reales atascados "buscando repartidor" sin que ningún
repartidor real pudiera aceptarlos jamás. Esto NO es una regresión de
T29B ni un blocker de su propia certificación en TESTING — es
simplemente la razón por la que T29B y T29C se tratan como un único
`RELEASE_BATCH` a efectos de promoción, aunque cada una se implemente,
certifique y despliegue a TESTING como tareas separadas. Cualquier
tarea futura que dependa de una fase posterior para ser funcionalmente
completa en Production debe aplicar el mismo criterio: certificar en
TESTING normalmente, pero diferir la evaluación de promoción hasta que
el bloque completo esté certificado.

## POLÍTICA — DeliGO adopta promociones frecuentes y certificadas a main/Production en vez de dejar `testing-codex` divergir por bloques grandes (P2-T29A-PROMOTE-TO-MAIN-AND-PRODUCTION, 2026-09-09)

```text
RELEASE_CADENCE_POLICY=FREQUENT_CERTIFIED_PROMOTIONS
NO_LONG_LIVED_CERTIFIED_TESTING_DIVERGENCE=SI
RULE=BIG_TASK_CERTIFIED -> EVALUATE_PROMOTION_BEFORE_NEXT_BIG_TASK
RULE=SMALL_TASK_LOGICAL_BATCH_CERTIFIED -> EVALUATE_PROMOTION_BEFORE_NEXT_BIG_TASK
NOT_ELIGIBLE_IF=blocker real, gate físico pendiente, o regresión nueva sin resolver
```

**Objetivo**: evitar divergencia prolongada `testing-codex` ↔ `main`
(la promoción PRE-T29 tuvo que auditar 168+ archivos acumulados de
múltiples epics); evitar releases con decenas de commits; evitar
auditorías masivas; evitar acumulación de migrations/env changes;
mantener checkpoints estables cercanos; simplificar rollback y
diagnóstico. Esta política NO significa deploy ciego — cada promoción
bajo esta cadencia sigue exigiendo exactamente la misma disciplina
completa que las promociones grandes: verificación de baseline, diff
audit, batería de tests focal (no necesariamente la masiva completa si
el bloque es pequeño y bien acotado), build, secret scan, y smoke de
Production no mutante. La diferencia es de TAMAÑO y FRECUENCIA del
bloque promovido, no de rigor por promoción.

Primera aplicación de esta política:
`P2_T29A_PROMOTE_TO_MAIN_AND_PRODUCTION.md` — promovió un bloque
pequeño (10 archivos, un solo epic certificado, P2-T29A) inmediatamente
después de cerrarlo en TESTING, en vez de esperar a acumular T29B-E
completos antes de tocar `main`. Cualquier tarea futura que cierre y
certifique un bloque de trabajo en `testing-codex` debe evaluar,
como parte de su propio closeout, si corresponde promoverlo a
`main`/Production antes de iniciar el siguiente bloque grande — no es
automático, pero sí la postura por defecto salvo que exista un blocker
real, un gate físico pendiente, o una regresión nueva sin resolver.

## TÉCNICO — un lock process-local síncrono (`acquireLock` antes del primer `await`) hace IMPOSIBLE ejercer una carrera real de DB dentro de un único proceso de test — probar el CAS directamente, sin el lock, es la única forma honesta de demostrar `DATABASE_CAS_FINAL_AUTHORITY` (P2-T29A, 2026-09-09)

```text
WHY=si un endpoint llama a un lock in-memory síncrono (Map, sin await) como primera línea de su handler, y se disparan 2 llamadas "concurrentes" al mismo handler vía Promise.all dentro del MISMO proceso Node/Bun, JS evalúa la primera llamada hasta su primer await (que ya pasó el lock, exitosamente) ANTES de siquiera empezar a ejecutar la segunda — la segunda ve el lock ya tomado de forma determinística, nunca llega a competir a nivel de DB. Un test así prueba el LOCK, no el CAS.
HOW_TO_TEST_THE_REAL_GUARANTEE=llamar la primitiva CAS (`db.pedido.updateMany({ where: { ..., estado: currentEstado }, data })`) DIRECTAMENTE, dos veces, vía `Promise.all`, SIN pasar por ningún endpoint/lock — esto son dos operaciones de I/O real (round-trips a Postgres) que sí pueden interleavearse genuinamente, y es exactamente lo que reproduce el escenario real que motiva tener CAS en primer lugar: múltiples instancias/workers de Railway, donde el lock in-memory de un solo proceso NUNCA protege.
COMPLEMENTARY_TEST=además de la primitiva aislada, sigue valiendo la pena un test end-to-end a través del endpoint completo (lock + CAS) — prueba que AMBOS guards juntos siguen produciendo single-winner, aunque el lock sea quien determine el ganador en ese caso específico (mismo proceso).
```

Aplicado en `src/app/api/negocio/pedidos/[id]/estado/order-transition-cas-concurrency.test.ts`: los tests 1-2 (raza aislada de la primitiva CAS) prueban la garantía real e independiente del lock; el test end-to-end confirma el comportamiento completo del endpoint. Sin esta distinción, un test "de concurrencia" que sólo pasa por el endpoint con lock síncrono da una falsa sensación de haber probado el CAS, cuando en realidad nunca lo ejercitó bajo presión real.

## OPERACIONAL — materializar un commit de release en un worktree aislado SIN `git reset --hard`: recrear el worktree desde cero en vez de resetear uno existente (PRE-T29-PROMOTE-CERTIFIED-TESTING-TO-MAIN-AND-PRODUCTION-R2, 2026-09-09)

```text
SAFE_PATTERN=git commit-tree <tree> -p <parent> -F <msgfile> para crear el commit; git update-ref refs/heads/<branch> <sha> para mover el puntero; git worktree remove <path> --force + git worktree add <path> <branch> (SIN -b, reutilizando la branch ya movida) para materializar el tree en un working directory NUEVO
NEVER=git reset --hard HEAD dentro del worktree para forzar la sincronización tras mover el ref externamente — aunque es técnicamente seguro en un worktree aislado (no toca testing-codex/main reales), algunas tareas prohíben `git reset` categóricamente sin excepción para el worktree, y el patrón de recrear el worktree logra el mismo resultado sin usar el comando prohibido
WORKTREE_PATH_LENGTH_WARNING=usar una ruta CORTA para el worktree de release (ej. C:\rt29r2), no la ruta larga del scratchpad de sesión — Next.js/Turbopack falla el build con "path length ... exceeds max length of filesystem" en Windows cuando la ruta base ya es muy larga, sin relación con el código
```

Establecido en el intento R2 de la promoción PRE-T29: la tarea prohibía
explícitamente `git reset`/`stash`/`clean`/`rebase` en cualquier forma,
sin la excepción para worktrees aislados que R1 sí había usado
(`git reset --hard HEAD` dentro del worktree, justificado ahí porque
tiene su propio índice/HEAD independiente). En vez de discutir si la
prohibición aplicaba, se evitó el comando por completo: se removió el
worktree stale (creado antes de mover el ref) y se recreó apuntando
directamente a la branch ya movida — git materializa el tree
correctamente en un `git worktree add` normal, sin necesidad de ningún
reset. Este patrón es preferible en general (más simple, cero ambigüedad
sobre si "reset en un worktree" cuenta como prohibido) y debe preferirse
en cualquier tarea futura de release curado, incluso cuando el reset
esté técnicamente permitido.

## OPERACIONAL — distinguir "regresión de código" de "contaminación de datos preexistente en una base de test compartida": reproducir el MISMO fallo contra el HEAD sin modificar antes de clasificar cualquier fallo de test como preexistente (PRE-T29-PROMOTE-CERTIFIED-TESTING-TO-MAIN-AND-PRODUCTION-R2, 2026-09-09)

```text
VERIFICATION_PROTOCOL=ante cualquier fallo de test durante una batería de promoción, antes de descartarlo como "preexistente/no relacionado", reproducir EXACTAMENTE el mismo comando contra el commit ORIGEN sin modificar (aquí, testing-codex@6c6fc58) — si el mismo test, con el mismo nombre y el mismo resultado exacto, falla igual, es prueba directa de que no fue introducido por el diff que se está promoviendo
DB_POLLUTION_VS_LATENCY_ARE_DIFFERENT_FINDINGS=un timeout intermitente (P2028, ya documentado como F-P2-TESTINFRA-01) y una violación de integridad referencial determinística por una fila específica dejada en la DB compartida (F-PRE-T29-03, nuevo) son dos categorías distintas de fragilidad de infraestructura de test — no fusionar ni tratar como el mismo finding sólo porque ambos "no son código"
NEVER_CLEAN_SHARED_TEST_DB_UNILATERALLY=incluso con evidencia clara de que una fila específica está bloqueando un test, no borrarla ni modificarla sin autorización explícita separada — el alcance de una tarea de promoción no incluye mutar datos de la base de TESTING
```

Aplicado dos veces en la misma tarea: `superadmin-auth.test.ts` (48
fallos, atribuidos a una fila huérfana con FK RESTRICT) y
`client-block-security.integration.test.ts` (timeout, atribuido a
latencia intermitente ya documentada). Ambos se reprodujeron
exactamente contra el HEAD de `testing-codex` sin ningún cambio antes
de excluirlos de `PROMOTION_NEW_FAIL` — nunca se asumió que eran
preexistentes sólo por "parecer" de infraestructura.

## OPERACIONAL — un archivo estático certificado en testing-codex (manifest, config, etc.) puede contener contenido válido SÓLO para TESTING sin que exista ningún mecanismo que lo condicione por entorno — verificar esto explícitamente antes de promover, nunca asumir que "certificado en testing" implica "seguro para Production" (PRE-T29-PROMOTE-CERTIFIED-TESTING-TO-MAIN-AND-PRODUCTION, 2026-09-08)

```text
STATIC_FILE_PROMOTION_CHECK_REQUIRED=SI (manifests PWA, configs estáticas, cualquier archivo servido tal cual sin generación condicional por RAILWAY_ENVIRONMENT_NAME u otro mecanismo real)
COMMENT_CLAIMING_ENVIRONMENT_SCOPE_IS_NOT_EVIDENCE=SI (un comentario de código que dice "esto es sólo para TESTING" no es prueba de que exista un gate real — verificar el mecanismo real, no confiar en la intención documentada)
CLIENT_SIDE_QUERY_PARAM_GATES_ARE_NOT_ENVIRONMENT_GATES=SI (a diferencia de un gate server-side fail-closed como el de RAILWAY_ENVIRONMENT_NAME usado en los diagnósticos de Push P2-T31, un query param activado por defecto en un manifest estático no distingue entornos)
```

Encontrado durante la revisión focal de diagnósticos iOS de la
promoción curada de `testing-codex` a Production:
`public/manifest-cliente.json`'s `start_url` tenía `?iosDebug=1`
hardcodeado, y el comentario de cabecera de
`ios-viewport-debug-panel.tsx` declaraba (incorrectamente) que esto era
"TESTING only" — pero el archivo en sí es estático y se serviría
idéntico en Production tras la promoción, activando el panel de
diagnóstico por defecto para cualquier instalación nueva de la PWA
Cliente. Regla: antes de promover CUALQUIER archivo estático
certificado en `testing-codex` (manifests, configs, JSON servidos tal
cual), verificar EXPLÍCITAMENTE si su contenido depende de un mecanismo
real de detección de entorno (server-side, fail-closed) o si es
simplemente un valor fijo que "se supone" es sólo para TESTING por
convención/comentario — la segunda categoría es un riesgo real de
Production y debe corregirse ANTES de promover, nunca en vivo durante
la promoción misma (ver también la decisión del operador de detener en
vez de fix-in-place, registrada en `FINDINGS.md` F-PRE-T29-02).

## OPERACIONAL — patrón seguro para escribir y verificar un secret en Railway sin exponer nunca el valor (PRE-T29, 2026-09-08)

```text
SAFE_RAILWAY_SECRET_SET_PATTERN=printf '%s' "$SECRET" | railway variable set KEY --stdin --service <exacto> --environment <exacto>
NEVER_USE_JSON_OR_KV_FLAGS_ON_A_SECRET_BEARING_COMMAND=SI (--json/--kv de `railway variable` incluyen valores crudos según la propia documentación del CLI)
SAFE_LENGTH_CHECK_PATTERN=railway variable list --kv ... | grep "^KEY=" | awk -F'=' '{print length($0)-length($1)-1}' (calcula longitud sin imprimir el valor)
SAFE_PRESENCE_CHECK_PATTERN=grep -c "^KEY" (cuenta coincidencias, nunca imprime la línea completa con el valor)
ALWAYS_CONFIRM_CLI_LINKED_CONTEXT_BEFORE_A_SCOPED_MUTATION=SI (`railway status` sin --json, revisa a qué environment/service apunta el contexto enlazado por defecto ANTES de cualquier `variable set` — puede no ser el esperado)
ALWAYS_PASS_EXPLICIT_--service_Y_--environment_EN_CADA_COMANDO=SI (nunca confiar en el contexto enlazado por defecto para una mutación con alcance de entorno)
```

Establecido al agregar `GOOGLE_OAUTH_PENDING_SECRET` a Railway
Production: el contexto CLI enlazado por defecto en este entorno de
trabajo apuntaba a TESTING/"DeliGO Copy", NO a Production/"DeliGO" —
si se hubiera confiado en el contexto por defecto, la mutación habría
aterrizado en el servicio equivocado. Cualquier tarea futura que
necesite escribir o verificar un secret en Railway debe: (1) confirmar
el contexto/target real ANTES de mutar, nunca asumirlo; (2) pasar
`--service`/`--environment` explícitos en cada comando, incluso si
parecen redundantes con el contexto enlazado; (3) usar `--stdin` para
la escritura (nunca el valor en `argv`); (4) nunca usar `--json`/`--kv`
en un comando que toque una variable secreta; (5) verificar presencia
por conteo de nombre y longitud por aritmética (`awk`), nunca
imprimiendo el valor completo. Este patrón es reutilizable para
cualquier secret futuro (rotación de VAPID, rotación de secrets
realtime, etc.), no específico de OAuth.

## PROMOTION — DeliGO promueve `testing-codex` → `main`/Production mediante commits de RELEASE CURADOS con trailer `Source-Commit:`, NUNCA un merge genérico de toda la historia (confirmado, PRE-T29, 2026-09-08)

```text
MAIN_PROMOTION_CONVENTION=CURATED_RELEASE_COMMITS_WITH_SOURCE_COMMIT_TRAILER
NEVER_GENERIC_MERGE_OF_FULL_TESTING_HISTORY_INTO_MAIN=SI
DELIBERATE_HUNK_EXCLUSION_IS_A_VALID_PATTERN=SI (un release curado puede incluir sólo un subconjunto de un commit fuente, documentándolo explícitamente en el mensaje)
```

Confirmado con evidencia directa en dos fuentes independientes: (1) el
reporte histórico `OPERATIONS_SECURITY_PRODUCTION_PROMOTION_R1.md`
("Se promovió a Production, mediante una rama de release curada — no
un merge de testing-codex — exactamente el bundle operacional
certificado... Los 4 commits se aplicaron sobre la base exacta de
Production... en un único fast-forward"); (2) los propios commits de
`main`, cada uno con un trailer `Source-Commit: <sha-de-testing-
codex>` explícito, uno de ellos documentando una exclusión deliberada
de hunks ("Deliberately excludes... out of scope for this curated
release"). Cualquier tarea futura de promoción DEBE seguir esta misma
convención — nunca intentar un `git merge origin/testing-codex` "para
simplificar", incluso si `main` parece ser ancestro de `testing-codex`
en un momento dado (dejará de serlo tan pronto como el siguiente
release curado aterrice, exactamente como ocurrió aquí). Verificar
SIEMPRE `git merge-base`/ancestry antes de asumir un fast-forward
trivial — la auditoría PRE-T29 encontró historia divergida (4 commits
main-only, 61 testing-only) precisamente por este patrón de curación
selectiva ya aplicado una vez antes.

## PROMOTION — un merge Git puede simularse de forma 100% read-only con `git merge-tree --write-tree <main> <testing>` para conocer conflictos ANTES de decidir estrategia, sin tocar working tree/index/HEAD (PRE-T29, 2026-09-08)

```text
SAFE_MERGE_SIMULATION_COMMAND=git merge-tree --write-tree <branchA> <branchB>
TOUCHES_WORKING_TREE_INDEX_OR_HEAD=NO (sólo escribe objetos blob/tree nuevos en .git/objects, inofensivo)
EXIT_CODE_1_MEANS_CONFLICTS_FOUND=SI (no un error de ejecución — leer el output para la lista de archivos en conflicto)
```

Usado en la auditoría PRE-T29 para determinar, sin ejecutar ni
proponer un merge real, que un merge genérico de `testing-codex` sobre
`main` produciría 4 conflictos textuales reales. Cualquier auditoría
futura que necesite evaluar el costo de una estrategia de merge antes
de comprometerse con ella debe usar este comando (Git 2.38+) en vez de
intentar un merge real y luego abortarlo — es más seguro y no requiere
ningún estado de recuperación.

## P2-T29 — el nuevo estado de espera de repartidor se llama `esperando_repartidor`, no `buscando_repartidor` — nombre elegido por el mecanismo real, no por preferencia (2026-09-08)

```text
CANONICAL_WAITING_DRIVER_STATE=esperando_repartidor
CANONICAL_ACCEPTED_STATE=aceptado
MECHANISM_IS_PASSIVE_POLLING_NOT_ACTIVE_DISPATCH=SI (repartidor/pedidos GET con refetchInterval de 8s, sin algoritmo de ranking/asignación activa)
```

Auditado el mecanismo real (`GET /api/repartidor/pedidos?filter=
disponibles`, `refetchInterval: 8000` en `repartidor-panel.tsx`) antes
de nombrar el estado: DeliGO no ejecuta ningún dispatch/búsqueda activa
hacia un repartidor específico — el pedido simplemente queda visible
para cualquier repartidor elegible que refresque su lista. "Esperando"
describe ese mecanismo con precisión; "buscando" implicaría una
búsqueda activa que el código no realiza. Cualquier implementación
futura de P2-T29 debe usar `esperando_repartidor` como el string
persistido — no introducir ambos nombres, no reabrir esta elección sin
evidencia de que el mecanismo subyacente cambió.

## P2-T29 — agregar nuevos valores de `Pedido.estado` NUNCA requiere migration en este schema — es un `String` Prisma plano, sin enum Postgres ni CHECK constraint (2026-09-08)

```text
ORDER_STATUS_DB_TYPE=String (Prisma), sin enum nativo, sin CHECK constraint (verificado: ningún migration.sql del repo restringe pedidos.estado)
NEW_ORDER_STATUS_VALUES_ARE_PURELY_ADDITIVE=SI
```

Confirmado leyendo `prisma/schema.prisma` (`estado String @default(
"recibido")`) y buscando `CHECK` en todos los `migration.sql` del
repo: no existe ninguna restricción de base de datos sobre los valores
permitidos de `estado`. Cualquier tarea futura que agregue un estado
de pedido nuevo (no sólo P2-T29) puede hacerlo sin migration — el
riesgo real de un cambio de estados vive enteramente en el código
(transiciones, filtros de query, UI), nunca en el schema. No asumir lo
contrario ni proponer una migration "por seguridad" sin evidencia de
que hace falta.

## P2-T29 — el CAS-vía-`updateMany` (condición de estado esperado dentro del propio WHERE) ya es el patrón de concurrencia estándar de este repo para mutaciones de `Pedido` — reutilizar, nunca reinventar (2026-09-08)

```text
STANDARD_ORDER_MUTATION_CAS_PATTERN=db.pedido.updateMany({ where: { id, ...condicionDeEstadoEsperado }, data: {...} }); if (result.count === 0) return 409
CONFIRMED_USED_IN=cancelado (negocio/estado), aceptar de repartidor, entregar de repartidor, auto-cancel de repartidor, cancelar/confirmar de cliente, TODOS los endpoints de Operativo/Operaciones-Terminal
```

Este patrón (una sola sentencia UPDATE cuyo WHERE incluye la condición
de estado/asignación que se espera encontrar, en vez de
`findUnique`+`update` en dos pasos) ya es, de facto, el estándar de
concurrencia de mutaciones de `Pedido` en todo el repo — confirmado en
6+ endpoints reales, incluida la aceptación atómica de repartidor
(el punto de mayor contención concurrente del sistema). P2-T27 (nunca
implementado, `QUEUED`) proponía generalizar exactamente este patrón a
las transiciones que todavía usan `update()` plano — cualquier tarea
futura que toque una transición de `Pedido.estado` debe usar este
patrón desde el principio, no el `update()` plano que sólo sigue
existiendo en las transiciones no-cancelación del endpoint
`negocio/pedidos/[id]/estado` por deuda histórica (ver
`P2_T29_ESPERANDO_REPARTIDOR_ACCEPTANCE_REDESIGN_AUDIT_AND_DESIGN.md`).

## CLOSEOUT — un diagnóstico "temporal hasta X" cuya condición X se cumple no se retira automáticamente; se reclasifica a permanente si cumple los criterios de seguridad, se retira sólo si no los cumple (P2-T31-R21, 2026-09-08)

```text
A_TEMPORARY_RETENTION_CONDITION_BEING_MET_IS_NOT_BY_ITSELF_A_REMOVAL_TRIGGER=SI
SAFE_TESTING_DIAGNOSTIC_CRITERIA=server-side_fail-closed_gate + no_secret_or_PII_leak + zero_Production_UX_impact + zero_operational_risk_increase (nunca puede mutar el recurso real que diagnostica) + genuine_future_utility_beyond_the_original_epic
VERIFY_BY_READING_THE_ACTUAL_GATE_CODE_NEVER_TRUST_A_COMMENT_OR_A_PRIOR_REPORTS_DESCRIPTION_ALONE=SI
```

R10 (P2-T31) retuvo explícitamente `PushDebugPanel`/timeline/snapshot/
bootstrap con la condición `RETAIN_UNTIL_ANDROID_PHYSICAL_
CERTIFICATION_COMPLETE`. R21 encontró que esa condición ya se cumplió
(Android certificado en íconos, chat tap y entrega general) — pero en
vez de asumir que eso dispara automáticamente una tarea de cleanup, se
re-verificó por LECTURA DIRECTA del código real (`push-testing-guard.
ts`, `debug-guard/route.ts`, `push-debug-trace.ts`) si la
instrumentación seguía cumpliendo los criterios de
`SAFE_TESTING_DIAGNOSTIC` ya usados en tareas anteriores de este mismo
epic para clasificar diagnósticos. Como los cumplía TODOS (gate
server-side que devuelve 404 indistinguible fuera de TESTING,
fingerprints no reversibles en vez de valores crudos, invisible en
Production, de sólo lectura, con utilidad real para cualquier
degradación futura de Push en TESTING) se reclasificó a retención
PERMANENTE en vez de diseñar una tarea de cleanup — retirar código
seguro y bien diseñado sólo porque la condición táctica original ya no
aplica sería puro desperdicio. Principio general para cualquier cierre
de epic futuro: cuando una condición de retención temporal se cumple,
la pregunta correcta no es "¿toca ya retirarlo?" sino "¿sigue siendo
seguro? si sí, reclasificar a permanente; si no, ahí sí diseñar el
cleanup". Nunca confiar en un comentario o en la descripción de un
reporte anterior sobre qué tan seguro es un gate — releer el código del
gate mismo antes de decidir.

## UI/SAFE-AREA — reposicionar el control built-in de un componente Radix COMPARTIDO (Sheet/Dialog) para UN SOLO consumidor requiere un data-slot inerte + CSS escopado, nunca tocar el default del componente compartido (P2-T31-R24, 2026-09-08)

```text
SHARED_RADIX_CLOSE_BUTTON_REPOSITION_MUST_BE_SCOPED_NEVER_GLOBAL=SI
INERT_DATA_SLOT_ATTRIBUTE_ADDITION_TO_A_SHARED_COMPONENT_IS_ACCEPTABLE_WHEN_ZERO_VISUAL_BEHAVIORAL_IMPACT_UNTIL_SCOPED=SI
SCOPE_VIA_A_MARKER_ALREADY_PRESENT_ON_THE_SPECIFIC_CONSUMER_BEFORE_INVENTING_A_NEW_ONE=SI (chat-sheet.tsx ya tenía data-ios-debug-role="chat-sheet")
```

R24 necesitaba mover el botón cerrar (X) built-in de `SheetContent`
(`src/components/ui/sheet.tsx`) SÓLO para el Sheet de Chat, sin afectar
ningún otro consumidor de `Sheet` en la app (carrito, selectores de
dirección, etc.). El componente ya usaba `absolute top-4 right-4` como
default para TODOS sus consumidores — cambiar ese default habría
afectado a todos. Se replicó exactamente el patrón YA establecido para
el mismo problema en `Dialog` (`mesa-cuenta-dialog.tsx`, que reposiciona
`[data-slot="dialog-close"]` escopado por `.mesa-cuenta-dialog-content`
— ese `data-slot` ya existía en `dialog.tsx`): (1) agregar
`data-slot="sheet-close"` al botón interno de `sheet.tsx` — un cambio
puramente inerte, sin selector CSS existente que lo tome, cero impacto
en cualquier Sheet hasta que algo lo seleccione explícitamente; (2)
escopar la regla CSS nueva en `globals.css` usando un marcador YA
PRESENTE en el consumidor específico (`chat-sheet.tsx` ya llevaba
`data-ios-debug-role="chat-sheet"` en su propio `SheetContent`, puesto
en una tarea anterior) — nunca inventar un marcador nuevo si uno
funcionalmente equivalente ya existe. Principio general: cuando un
componente compartido de UI necesita comportarse distinto para un solo
consumidor, la solución nunca es tocar su default ni bifurcar el
componente — es agregar un hook de datos inerte y escopar el CSS por
fuera, dejando el shared component funcionalmente idéntico para todo
lo demás.

## PUSH/CHAT — un reset de store keyed por "identidad del actor" debe distinguir "primera resolución tras hidratar" de "cambio real de actor", o puede borrar estado recién escrito en el mismo commit (P2-T31-R23B/R23C, 2026-09-08 — FIX IMPLEMENTADO por R23C)

```text
ACTOR_KEYED_RESET_HOOKS_MUST_IGNORE_NULL_TO_FIRST_REAL_USER_TRANSITION=SI (transición de hidratación, no un logout/login real)
ACTOR_KEYED_RESET_HOOKS_MUST_STILL_RESET_ON_REAL_USER_TO_DIFFERENT_REAL_USER_TRANSITION=SI (logout/login legítimo — no se debe romper este caso al corregir el anterior)
EFFECT_CALL_ORDER_WITHIN_A_COMPONENT_MATTERS_WHEN_TWO_HOOKS_READ_THE_SAME_STORE_DURING_REHYDRATION=SI (React ejecuta los efectos de una función-componente en el orden en que los hooks fueron llamados; si un efecto posterior resetea un store que un efecto anterior acaba de escribir, en el MISMO commit, la escritura se pierde en silencio)
ZUSTAND_PERSIST_ONREHYDRATESTORAGE_CALLBACK_RUNS_SYNCHRONOUSLY_RIGHT_AFTER_MERGE_FOR_SYNC_STORAGE=SI (localStorage — sin ningún await de por medio; React 18 batchea ambos set() en el mismo commit)
```

R23B probó, con una reproducción de código real (`useChatDeepLink`
real y exportado + una redeclaración fiel de `useChatActorReset`, no
exportado, montados en el mismo orden que `ChatProvider` real), que
`useChatActorReset` (`src/providers/chat-provider.tsx`) trataba la
transición `actorKey: null → "rol:id-real"` (identidad recién
hidratada) exactamente igual que un cambio de actor genuino
(`"rol:idA" → "rol:idB"`, el caso legítimo de logout+login para el que
fue diseñado), llamando `useChatStore.getState().reset()` en ambos
casos. Cuando esa transición ocurre en el MISMO commit de React en que
`useChatDeepLink` (llamado ANTES, en el cuerpo de `ChatProvider`) acaba
de abrir el chat sheet vía un deep-link `?chat=<pedidoId>`, el reset
corre inmediatamente después y borra ese estado — sin que ningún test
que monte los hooks por separado pueda detectarlo. Principio general
para cualquier hook futuro de este tipo: un "reset por cambio de
identidad" necesita una tercera categoría explícita —"identidad
resuelta por primera vez"— distinta de "sin identidad" y de "identidad
distinta a la anterior"; confundir la primera con la segunda es lo que
produce este bug. No se implementó el fix en R23B (auditoría
read-only); el guard exacto quedó diseñado para `R23C`.

**Adenda (R23C, 2026-09-08)**: fix IMPLEMENTADO exactamente como se
diseñó — `useChatActorReset` agrega `previous !== null` a su guard:
`null → primer actor real` ya NO resetea; `real → null` (logout) y
`real A → real B` (incluyendo cambio de rol) SIGUEN reseteando, sin
debilitar la propiedad de seguridad cross-actor original. Verificado
revirtiendo temporalmente sólo esa condición: 5/21 tests fallan;
restaurado de inmediato, 21/21 verdes. Ver
`P2_T31_R23C_CHAT_ACTOR_RESET_FIRST_HYDRATION_GUARD_FIX_TESTING_DEPLOY.md`.

## AUTH/PRODUCTO — Cliente y Repartidor DEBEN poder permanecer autenticados simultáneamente en Android, con la misma identidad de Google O con identidades distintas — el fallo NO depende de la cuenta de Google (corregido, P2-T31-R23C, 2026-09-08)

```text
SAME_IDENTITY_MULTI_ROLE_CONCURRENT_SESSION_REQUIRED=SI
DIFFERENT_IDENTITY_MULTI_ROLE_CONCURRENT_SESSION_REQUIRED=SI
GOOGLE_ACCOUNT_SPECIFIC_TRIGGER=RULED_OUT_BY_PHYSICAL_EVIDENCE
ANDROID_CLIENTE_REPARTIDOR_SESSION_ISOLATION_ROOT_CAUSE=NOT_AUDITED (diferido a tarea futura)
```

Actualización de R23C sobre el requisito registrado en R23B: la
evidencia física original (misma cuenta de Google rompe la sesión;
cuentas distintas la preservan) resultó INCOMPLETA. Evidencia física
ampliada muestra que en Android el fallo ocurre TANTO con la misma
cuenta de Google COMO con cuentas distintas — la identidad de Google
usada **no es el factor discriminante**. En iPhone, con la misma cuenta
de Google, Cliente y Repartidor permanecen autenticados y operativos
simultáneamente sin problema (control positivo). Requisito de producto
reafirmado y ampliado: DeliGO debe permitir que, en Android, Cliente y
Repartidor permanezcan simultáneamente autenticados/operativos tanto
con la misma identidad de Google como con identidades diferentes — sin
cerrar sesión de un rol para usar el otro, sin cambiar de cuenta, sin
cambiar de perfil de navegador, sin reinstalar ninguna PWA. Caso real:
un repartidor también puede usar DeliGO como cliente. La causa raíz
técnica (cookie/sesión compartida por origen en Chrome Android,
localStorage compartido entre PWAs same-origin, restauración global de
actor persistido, etc.) sigue explícitamente NO auditada, diferida a
una tarea futura dedicada de auth/PWA/session isolation — ver
`P2_T31_R23C_CHAT_ACTOR_RESET_FIRST_HYDRATION_GUARD_FIX_TESTING_DEPLOY.md`.

## PUSH/CHAT — un consumidor de deep-link montado FUERA de un gate de ruta ya autenticado debe esperar `_hasHydrated`, nunca sólo `isAuthenticated()` (P2-T31-R23, 2026-09-08)

```text
DEEPLINK_CONSUMERS_MOUNTED_AT_ROOT_LAYOUT_MUST_WAIT_FOR_AUTH_HASHYDRATED=SI
DEEPLINK_CONSUMERS_MOUNTED_INSIDE_AN_ALREADY_AUTHENTICATED_ROUTE_NEVER_NEED_TO_SELF_CHECK_AUTH=SI (orders-tab.tsx, client-orders-panel.tsx — patrón ya correcto, no tocar)
ONE_SHOT_DEEPLINK_CONSUMPTION_WITHOUT_A_RETRY_ON_HYDRATE_IS_A_SILENT_PERMANENT_DROP=SI
```

R23 aisló, comparando campo por campo un caso roto (`negocio+chat`,
tap no abre el chat) contra 2 controles que sí funcionan
(`cliente+order_update`, `repartidor+new_delivery`), que la ÚNICA
diferencia real es CÓMO cada consumidor decide si actuar sobre el
deep-link: `src/providers/chat-provider.tsx`::`useChatDeepLink` está
montado en el LAYOUT RAÍZ (antes de cualquier gate de ruta específico
de rol) y se auto-condiciona a `isAuthenticated()`/`userType()` de un
store Zustand `persist` (hidratación asíncrona por diseño) SIN esperar
`_hasHydrated` y SIN ningún reintento cuando esa hidratación termina —
en un arranque en frío (exactamente el escenario de abrir la PWA desde
un tap de notificación), esto puede leer el estado PRE-hidratación
(`isAuthenticated()===false`) y descartar el deep-link para siempre,
silenciosamente. Los consumidores que sí funcionan
(`src/components/business/orders-tab.tsx`,
`src/components/client/client-orders-panel.tsx`) nunca se
auto-verifican auth porque sólo se montan DENTRO de una ruta que la
app ya trata como autenticada a un nivel superior — no necesitan este
gate.

Este mismo patrón defensivo (`_hasHydrated`/`authHasHydrated`) YA
existe en 6+ archivos reales del repo (`src/app/cliente/page.tsx`,
`src/hooks/use-push-notifications.ts`, `src/store/cart-store.ts`,
`src/store/nav-store.ts`, `src/components/shared/push-debug-*`) — la
omisión en `chat-provider.tsx` no es una idea nueva a inventar, es
aplicar un patrón ya establecido en el mismo repositorio. Coincide con
el `AUTH_HYDRATION_PUSH_RACE` ya documentado (nunca confirmado) en R6A
de P2-T31 para un escenario análogo distinto — R23 no lo reclasifica,
pero es evidencia adicional de que la clase de race es real en este
codebase. Cualquier futuro consumidor de deep-link (de notificación
Push o de cualquier otro origen) que se monte FUERA de un gate de ruta
ya autenticado debe seguir este mismo patrón: esperar `_hasHydrated`,
nunca sólo `isAuthenticated()` en el primer render.

**Adenda (R23A, 2026-09-08)**: fix IMPLEMENTADO exactamente así —
`useChatDeepLink` ahora lee `useAuthStore((s) => s._hasHydrated)` y lo
agrega a las dependencias del `useEffect` que consume `?chat=`, sin
tocar `consumeChatParam()` en sí ni crear ningún campo/sistema nuevo.
Verificado con una reproducción rigurosa: revirtiendo TEMPORALMENTE
sólo esa línea de dependencias, exactamente 3 de 10 tests nuevos
fallan (confirmando la carrera histórica real, no sólo inferida) —
restaurada de inmediato, 10/10 verdes. Desplegado en TESTING (commit
`23c038a`). No corregido en `orders-tab.tsx`/`client-orders-panel.tsx`
— no lo necesitan, siguen siendo el patrón de referencia correcto para
un consumidor montado DENTRO de una ruta ya autenticada. Pendiente
confirmación física (Android/iPhone) antes de certificar. Ver
`P2_T31_R23A_CHAT_NOTIFICATION_DEEPLINK_AUTH_HYDRATION_FIX_TESTING_DEPLOY.md`.

## TESTS — un hook de React con efectos puede probarse con un ciclo de commit real (`happy-dom` + `react-dom/client` + `act()`) sin React Testing Library, reutilizando el patrón ya usado por `auth-store.test.ts`/`use-repartidor-tracking.test.ts` (P2-T31-R23A, 2026-09-08)

```text
NO_REACT_TESTING_LIBRARY_IN_THIS_REPO=SI (confirmado, no cambia)
REAL_DOM_HOOK_TESTING_PATTERN=GlobalRegistrator.register() + IS_REACT_ACT_ENVIRONMENT=true + createRoot(hostDiv) + act(() => root.render(<Harness/>))
STATIC_SOURCE_TEXT_CONTRACTS_REMAIN_THE_DEFAULT_FOR_PRESENTATIONAL_COMPONENTS=SI (chat-fab.test.tsx, chat-sheet.test.tsx, etc. — sin cambios, siguen siendo la herramienta correcta cuando no hace falta un ciclo de commit real)
```

R23A necesitaba probar un comportamiento que sólo existe a través de
un ciclo de efectos de React real (una carrera de timing entre un
`useEffect` y un cambio de estado de un store externo) — un test de
"contrato estático" (leer el archivo fuente y hacer `toContain(...)`,
el patrón dominante en este repo para componentes) no puede probar
ESO. Se usó el patrón ya establecido en `src/store/auth-store.test.ts`
y `src/hooks/use-repartidor-tracking.test.ts` (real DOM vía
`@happy-dom/global-registrator`, montaje real vía
`react-dom/client`+`act()`, sin ningún paquete/infraestructura nueva)
— exportar el hook bajo prueba (`useChatDeepLink`) para poder montarlo
aislado, sin arrastrar componentes `next/dynamic` no relacionados
(`ChatFab`/`ChatSheet`), es una técnica válida y de bajo riesgo cuando
el hook en sí no cambia de comportamiento por ser exportado. Usar este
patrón para un caso similar en el futuro (un efecto que depende de
timing de hidratación/store externo) es preferible a inventar un
mock/reimplementación del hook.

## PUSH — el branding visual de una notificación (icon/badge) debe derivarse de `data.role` (el destinatario real), nunca sólo de `notifType`, para cualquier tipo compartido entre roles (P2-T31-R22, 2026-09-08)

```text
NOTIFICATION_ICON_MUST_PREFER_RECIPIENT_ROLE_OVER_NOTIFTYPE_WHEN_A_TYPE_IS_SHARED=SI
DATA_ROLE_ALREADY_EXISTS_AND_IS_ALREADY_DELIVERED_RELIABLY=SI (createNotification -> enrichedPushPayload -> data.role = personalRoleFor(userType), desde Bugfix-4 [17] — hoy sólo usado por notificationclick, no por la selección de icon/badge)
KNOWN_SHARED_NOTIFTYPES_AS_OF_R22=order_update (cliente+negocio+repartidor), review (cliente+negocio), chat (cliente+negocio)
NEW_SHARED_NOTIFTYPE_MUST_BE_AUDITED_AGAINST_THIS_INVARIANT_BEFORE_ADDING_AN_SW_ICON_BRANCH=SI
```

R22 probó, ejecutando el `sw.js` real en un sandbox VM con payloads de
forma real, que `order_update` (el tipo más frecuente que un Cliente
recibe) se comparte entre Cliente/Negocio/Repartidor y que el `push`
event handler lo mapea incondicionalmente al ícono de Negocio —
mismo patrón para `review` (Cliente+Negocio) y, en dirección opuesta,
`chat` (rompe para Negocio). El campo que resuelve esto correctamente
—`data.role`— ya existe, ya se agrega centralmente en
`createNotification()`, y ya se entrega de forma probada (mismo
mecanismo que `notificationclick` usa para abrir la app/rol correcto)
— sólo faltaba que la selección de `icon`/`badge` lo consultara.
Cualquier futuro `notifType` nuevo que pueda ser compartido entre más
de un rol debe auditarse contra este invariante ANTES de agregarle una
rama de ícono en `sw.js` — nunca asumir que un tipo "sí describe una
sola audiencia" sin verificar todos sus call sites reales (el error
original vino exactamente de esa asunción implícita).

**Adenda (R22A, 2026-09-08)**: este invariante quedó IMPLEMENTADO y
DESPLEGADO en TESTING (commit `ed58ca4`, deployment
`34f5cf79-25bd-4d7a-855c-287d8bacdc4a` `SUCCESS`) — `public/sw.js`
ahora resuelve `icon`/`badge` primero por `data.data?.role`, con el
`notifType` legacy completo preservado como fallback. El deploy en sí
NO constituye confirmación física — pendiente de que el operador
verifique en Android real que Cliente/Negocio/Repartidor ven cada uno
su propio ícono. Ver
`P2_T31_R22A_ANDROID_PUSH_NOTIFICATION_ROLE_ICON_ROUTING_FIX_TESTING_DEPLOY.md`.

## GIT — `codex-reports/` es local/untracked por convención; sólo se trackea un archivo puntual cuando la tarea ACTUAL lo autoriza explícita y repetidamente (DELIGO-BRANDING-R1A, 2026-09-08)

```text
CODEX_REPORTS_DIRECTORY_IS_UNTRACKED_BY_DEFAULT=SI (confirmado con git ls-files codex-reports/ = 0 archivos, en todo el historial hasta este commit)
STAGING_A_REPORT_FILE_REQUIRES_EXPLICIT_PER_TASK_AUTHORIZATION=SI (nunca inferir desde "el reporte documenta esta tarea" — debe estar escrito en la tarea actual)
STAGING_ONE_REPORT_NEVER_IMPLIES_STAGING_THE_REST_OF_CODEX_REPORTS=SI (CODEX_REPORT.md/ROADMAP.md/FINDINGS.md/TEST_AUTHORITY.md/DECISIONS_AND_INVARIANTS.md/GIT_DEPLOY_HISTORY.md siguen 100% locales salvo autorización igual de explícita para cada uno)
```

DELIGO-BRANDING-R1A fue la primera tarea de todo este historial en
instruir explícita y repetidamente (dos secciones distintas de la
misma tarea) incluir un archivo de `codex-reports/` en un commit —
`DELIGO_BRANDING_R1_PWA_ROLE_ICON_REFRESH.md`. Se verificó con `git ls-
files codex-reports/` que esa carpeta nunca tuvo NINGÚN archivo
trackeado antes de ese commit — cada tarea previa de esta epopeya
(R13 en adelante) documentó explícitamente sus reportes como
puramente locales. Se siguió la instrucción tal cual estaba escrita
(no una inferencia propia) y se dejó constancia expresa del cambio de
precedente en el propio reporte de la tarea. Cualquier tarea futura
que quiera trackear otro archivo de `codex-reports/` (incluidos los
propios documentos de autoridad) necesita su propia autorización
explícita — nunca asumir que "ya se trackeó uno, se pueden trackear
los demás".

## BRANDING — un refresh de ícono de rol reemplaza CONTENIDO en el mismo path de archivo, nunca renombra; sw.js exige un bump manual de CACHE_NAME porque su bypass de red para íconos está roto (DELIGO-BRANDING-R1, 2026-09-08)

```text
ICON_REFRESH_MUST_REUSE_EXISTING_FILE_PATHS_WHEN_A_ROLE_ALREADY_HAS_ONE=SI (minimiza wiring tocado en manifests/role-config.ts/layout.tsx/sw.js)
SW_ICON_NETWORK_FIRST_BYPASS_IS_BROKEN=SI (request.url.includes("icon-192")/("icon-512") NUNCA es true para "icon-{rol}-192x192.png"/"512x512.png" — verificar con el nombre real antes de asumir que el bypass aplica)
ANY_FUTURE_ROLE_ICON_CONTENT_CHANGE_REQUIRES_A_MANUAL_CACHE_NAME_BUMP=SI (hasta que se corrija el substring roto — de lo contrario un cliente con el ícono viejo cacheado lo sirve indefinidamente)
NEVER_DECLARE_A_NEW_MASKABLE_SAFE_DERIVATIVE_WITHOUT_A_REAL_SAFE_ZONE_MEASUREMENT=SI (extender un fondo/degradado más allá de los límites originales del asset para "rellenar" un canvas maskable es rediseño, no resize — requiere BLOCKED_NEEDS_DESIGN_DECISION, no inventar)
```

DELIGO-BRANDING-R1 refrescó el branding de Cliente/Negocio/Repartidor/
Admin sobreescribiendo el CONTENIDO de los mismos 8 archivos PNG que
`role-config.ts`/los manifests/`sw.js` ya referenciaban — cero cambio
de wiring para esos 4 roles. Operaciones, que prestaba el ícono de
Negocio desde su alta como PWA, recibió 2 archivos NUEVOS
(`icon-operaciones-192x192.png`/`512x512.png`) y SÍ requirió actualizar
`role-config.ts` + `manifest-operaciones.json`. Cualquier tarea futura
de branding debe seguir el mismo principio: si el rol YA tiene un
archivo propio, reemplazar su contenido en el mismo path; sólo crear
paths nuevos cuando genuinamente no existía un asset dedicado antes.

Se descubrió con evidencia directa (no inferencia) que la regla de
`public/sw.js` que pretende servir "manifest files or PWA icons"
siempre desde red (`includes("icon-192")`/`("icon-512")`) NUNCA
matchea ningún nombre de archivo de ícono de rol real — el substring
literal no está presente en `"icon-{rol}-192x192.png"`. Esto significa
que los íconos de rol en realidad caen en la rama cache-first de
assets estáticos del mismo `sw.js`, y CUALQUIER cambio de contenido de
un ícono de rol existente requiere subir `CACHE_NAME` manualmente para
que los clientes con el ícono viejo ya cacheado dejen de servirlo. Este
bug del substring en sí NO se corrigió en R1 (fuera de alcance de un
refresh de branding) — queda documentado como deuda técnica conocida
para quien toque `sw.js` de nuevo.

Maskable: nunca declarar automáticamente un ícono de rol como
`purpose: "maskable"` seguro sin medir su safe-zone real. Si el fondo
del asset fuente es un degradado que sólo existe dentro de una forma ya
recortada (p. ej. un cuadrado con esquinas ya "horneadas" en opaco, sin
transparencia real que extender), generar un derivado maskable
correcto exigiría inventar/interpolar píxeles de fondo fuera de esa
forma — eso es rediseño, prohibido por defecto en tareas de refresh de
assets. El estado correcto a reportar en ese caso es
`MASKABLE_SAFE_DERIVATIVE_STATUS=BLOCKED_NEEDS_DESIGN_DECISION`, sin
bloquear por eso los íconos `purpose: "any"`.

**Adenda (R1A, 2026-09-08)**: este branding se desplegó en TESTING
(commit `1d3f58a`, deployment `976a7fa7-...` `SUCCESS`) — el deploy en
sí NO resuelve ninguno de los dos findings de esta sección
(`PWA_MASKABLE_ICON_SAFE_ZONE_FINDING`/`SW_ICON_CACHE_BYPASS_
SUBSTRING_FINDING`, ambos siguen `OPEN`/`OPEN_NON_BLOCKING`), y además
introdujo un finding NUEVO y distinto (routing de ícono de notificación
Push en Android — ver la sección PUSH — ANDROID PUSH NOTIFICATION ICON
ROUTING más abajo). Ningún deploy de branding por sí solo certifica
nada de Push — esa certificación sigue siendo exclusiva de pruebas
físicas dedicadas.

## PUSH — un finding de routing de ícono de notificación no se le atribuye causa raíz sin trazar el payload completo, y nunca se asume que un refresh de assets visuales lo resolvió (DELIGO-BRANDING-R1A, 2026-09-08)

```text
NOTIFICATION_ICON_ROUTING_BUG_ROOT_CAUSE_REQUIRES_FULL_PAYLOAD_TRACE=SI (backend -> notifType -> actor/recipient -> service worker -> NotificationOptions.icon/badge -> render)
A_VISUAL_ASSET_REFRESH_NEVER_PROVES_A_ROUTING_LOGIC_FIX=SI (cambiar el CONTENIDO de un ícono no toca la lógica de qué ícono se elige)
```

Evidencia física (R1A): Android Cliente mostró el ícono de Negocio en
una notificación Push destinada a Cliente; iPhone equivalente correcto.
El wiring de `sw.js` auditado (default `icon-cliente-...`, ramas
explícitas sólo para salon/mozo-empleado/negocio) NO explica por sí
solo el síntoma — una notificación de Cliente debería caer al default
de Cliente, no a la rama de Negocio. No se especula una causa sin
trazar el payload completo (ver F-BRANDING-R1A-03 en
`FINDINGS.md`) — la próxima auditoría dedicada debe hacerlo, no una
tarea de branding ni una de retry/mitigación de Push.

## PUSH — clasificación de una causa externa/plataforma no probada usa 4 niveles explícitos, nunca "CONFIRMED" sin una prueba de control independiente (R20, 2026-09-08)

```text
EXTERNAL_CAUSE_CLASSIFICATION_LEVELS=NOT_PROVEN|PLAUSIBLE|STRONGLY_SUPPORTED|CONFIRMED
NOT_PROVEN=sin evidencia más allá de la definición genérica del spec
PLAUSIBLE=spec + reportes de comunidad existen, pero las causas DeliGO-side no fueron auditadas exhaustivamente todavía
STRONGLY_SUPPORTED=causas DeliGO-side auditadas y descartadas exhaustivamente (matriz de precondiciones completa, evidencia en vivo tipo VAPID validada, sin rama de código específica) + patrón de comunidad documentado coincide exactamente + recurrencia repetida en el MISMO dispositivo/rol bajo condiciones auditadas como limpias — SIN una confirmación independiente
CONFIRMED=una prueba de control independiente (u otra evidencia externa directa) demuestra el fallo fuera del control de DeliGO en ese dispositivo específico
NEVER_DECLARE_CONFIRMED_SOLELY_BECAUSE_A_MITIGATION_OR_RETRY_FAILED=SI
```

R13 clasificó el `AbortError` de `PushManager.subscribe()` como
`NOT_PROVEN_PLAUSIBLE_PLATFORM_LEVEL_PUSH_SERVICE_REGISTRATION_FAILURE`
y esa etiqueta se preservó sin cambios durante R14/R16/R17/R18/R19/
R19R/R19R1/R19A. R20 encontró, tras el retest físico de R19A (ambos
intentos con `AbortError`, matriz de precondiciones source-level
agotada sin hallazgo, VAPID validada en vivo sin malformación/mismatch,
y 3 de las 4 ocurrencias totales en el mismo dispositivo/rol), que la
etiqueta ya no reflejaba con precisión el estado de la evidencia — pero
que tampoco había una prueba de control INDEPENDIENTE que justificara
saltar directo a "confirmado". Este invariante fija el vocabulario de 4
niveles para que cualquier tarea futura que reevalúe una causa externa
no probada use el mismo criterio, en vez de escalar directo a
`CONFIRMED` sólo porque una mitigación/retry de código falló (eso
prueba que el código no puede arreglarlo por sí solo, no que la causa
esté fuera de DeliGO — esa prueba exige evidencia externa
independiente, ver `web-push-codelab.glitch.me` en
`P2_T31_R20_ANDROID_PERSISTENT_ABORTERROR_ROOT_CAUSE_DEVICE_DIAGNOSTIC.md`).

## PUSH — todo call site que registra un binding físico en backend debe verificar gate.isCurrent con cero await de por medio, inmediatamente antes de la llamada de red (R19R, 2026-09-08)

```text
BACKEND_BIND_MUST_CHECK_GATE_CURRENT_IMMEDIATELY_BEFORE_NETWORK_CALL=SI
ZERO_AWAIT_BETWEEN_STALE_CHECK_AND_FETCH=SI (una verificación con un await de por medio no da esta garantía)
STALE_RESULT_IS_NEVER_AN_ERROR=SI (mismo finishMutation(opId, false) que cualquier otra rama stale — nunca un toast/mensaje inventado)
NEVER_DESTROY_THE_PHYSICAL_SUBSCRIPTION_JUST_BECAUSE_THE_OPERATION_WENT_STALE=SI
STALE_ACTOR_DETECTION_USES_GATE_ISCURRENT_ONLY_NEVER_A_SEPARATE_ACTOR_SNAPSHOT=SI (los cambios de actor ya enrutan por gate.invalidate() — comparar un actor snapshot aparte duplicaría autoridad sin agregar información)
```

R19 implementó un retry acotado para `AbortError` que alargó la ventana
entre "physical subscription obtenida" y "backend POST enviado" —
exponiendo (no creando) un gap que ya existía: ese POST corría
incondicional respecto al gate de operación. R19R lo cerró con
`bindPhysicalPushSubscriptionToBackend`
(`src/hooks/use-push-notifications.ts`): la verificación de
`gate.isCurrent(opId)` debe ser la ÚLTIMA sentencia síncrona antes de
la llamada de red — cualquier `await` entre el check y el `fetch`
reabre la ventana de carrera que este invariante existe para cerrar.
Cualquier future código de DeliGO que registre un binding físico
(push, u otro recurso equivalente atado a una `PushSubscription`/
sesión/actor) contra el backend DEBE seguir el mismo patrón: gate check
→ inmediatamente `fetch`, sin ningún trabajo async entre medio. Un
resultado stale nunca es un error — se resuelve por el mismo camino
`finishMutation`/contrato de staleness que el resto del sistema ya usa,
sin inventar un mensaje o estado nuevo. La subscription física en sí
NUNCA se destruye por la operación quedar stale — pertenece al
browser/origin, no a la operación, y el actor que la sucede la
reconcilia por su propio flujo normal (nunca se introduce un
unsubscribe físico como "limpieza" de una operación cancelada).

**Adenda (R19R1, 2026-09-08)**: este invariante quedó verificado con
evidencia DIRECTA del registry real (`push-mutation-in-flight-
registry.ts`, nunca mockeado) para la ruta compuesta stale-during-
retry — `MUTATION_REGISTRY_SET`/`RELEASE` contados explícitamente
(1/1, entrada final ausente), no sólo inferidos de `gate.begin()===1`.
Ningún cambio de diseño — sólo cierre de una discrepancia de evidencia
pendiente. Ver
`P2_T31_R19R1_EXPLICIT_MUTATION_REGISTRY_COVERAGE.md`.

**Adenda (R19A, 2026-09-08)**: este invariante (y el retry de R19 de
la sección siguiente) quedaron DESPLEGADOS en TESTING sin ningún
cambio funcional adicional — commit `39566e6`, deployment
`425ff95a-5a2e-4d70-9dd1-fbae6df5ce19` `SUCCESS`. El deploy no
constituye evidencia de que la mitigación resuelva el `AbortError`
físico real — pendiente de un retest físico único en Android Negocio.
Ver `P2_T31_R19A_REVIEW_COMMIT_PUSH_TESTING_DEPLOY.md`.

## PUSH — el único retry físico autorizado para AbortError está acotado a 2 intentos totales, con recheck defensivo obligatorio y fail-closed ante ambigüedad (R19, 2026-09-08)

```text
PUSHMANAGER_SUBSCRIBE_MAX_ATTEMPTS_PER_USER_ACTION=2 (MAX_PHYSICAL_SUBSCRIBE_ATTEMPTS_PER_USER_ACTION, exportado desde use-push-notifications.ts)
RETRY_GATED_EXCLUSIVELY_BY_ERROR_CLASS_ABORTERROR=SI
GETSUBSCRIPTION_RECHECK_MANDATORY_BEFORE_ANY_RETRY=SI
AMBIGUOUS_OR_UNVALIDATED_RECHECK_RESULT_MUST_FAIL_CLOSED=SI
NEVER_DESTROY_A_RECOVERED_SUBSCRIPTION_FROM_INSIDE_THE_RETRY_PATH=SI
```

Tras dos recurrencias consecutivas y cross-role de `PushManager.
subscribe() → AbortError` (R13: Cliente; R18: Negocio; el manual retry
de R18 también falló, R19), se implementó
`createPhysicalPushSubscriptionWithAbortRecovery` con exactamente UN
retry adicional — nunca más. Cualquier cambio futuro a este mecanismo
(subir el máximo de intentos, agregar un delay, ampliar los errores que
disparan retry, o reintentar sin el recheck previo) debe justificarse
con la MISMA evidencia física exigida aquí — nunca "por conveniencia"
ni para "hacer que pase el test". El recheck de `getSubscription()`
ANTES de cualquier retry es obligatorio y no negociable: existe
específicamente para prevenir una doble subscription física si el
browser crea una pese a rechazar la promesa (comportamiento no
descartable por spec). Si ese recheck no puede confirmar con
seguridad el estado físico (lanza, o encuentra una subscription cuya
key no coincide con la vigente), el sistema debe FALLAR CERRADO —
nunca reintentar a ciegas, y nunca destruir/reemplazar la subscription
ambigua desde dentro de este camino de recuperación (esa decisión sigue
siendo exclusiva del flujo de remoción de key obsoleta ya existente al
inicio de `subscribe()`). Este mecanismo se apoya EN el contrato de
failure-state de R13A — nunca lo reemplaza: si el retry también falla,
el resultado final debe seguir siendo exactamente el mismo
`SUBSCRIBE_FINISH subscribed=false` / registry-release / switch-OFF /
feedback-seguro que R13A ya garantiza.

**Adenda (R20, 2026-09-08)**: el primer retest físico real de este
mecanismo (build R19A, commit `39566e6`, Android Negocio) ejecutó
exactamente este contrato — recheck `getSubscription()` → `found=false`
→ único retry autorizado — y el retry TAMBIÉN falló con `AbortError`.
Esto NO invalida el mecanismo: se comportó exactamente como fue
diseñado (2 intentos exactos, sin tercero, backend nunca contactado,
failure-state de R13A PASS completo). Confirma que el retry no puede
resolver una causa situada en el registro interno browser↔FCM del
navegador — algo que este mecanismo nunca prometió resolver, sólo
mitigar el caso donde un segundo intento inmediato tuviera éxito. Ver
`P2_T31_R20_ANDROID_PERSISTENT_ABORTERROR_ROOT_CAUSE_DEVICE_DIAGNOSTIC.md`.

## PUSH — la recurrencia de una clase de fallo ya documentada no reabre automáticamente un bug ya corregido si su propio contrato de failure-state pasa (R18, 2026-09-08)

```text
FAILURE_CLASS_RECURRENCE_DOES_NOT_AUTOMATICALLY_REOPEN_A_FIXED_BUG=SI
MUST_VERIFY_FAILURE_STATE_CONTRACT_SEPARATELY_FROM_FAILURE_CLASS_RECURRENCE=SI
SHARED_HOOK_ROLE_NEUTRALITY_MUST_BE_VERIFIED_FROM_CODE_NEVER_ASSUMED=SI
```

R13 encontró y R13A corrigió un bug de UI stale (`finishMutation`
nunca corría tras una excepción secundaria en el logging/toast de
error) — independiente de la causa externa del `AbortError` en sí, que
quedó `NOT_PROVEN_PLAUSIBLE_PLATFORM_LEVEL`. R18 encontró una
recurrencia del MISMO `AbortError` (misma clase/etapa de fallo, en
Negocio esta vez, no en Cliente) y verificó explícitamente, campo por
campo contra el contrato documentado en R13A §10, que el manejo del
fallo se comportó exactamente como se diseñó
(`SUBSCRIBE_FINISH`/registry-release/switch-OFF/feedback-seguro, todos
presentes). **Distinguir siempre dos preguntas independientes ante
CUALQUIER recurrencia de un fallo ya auditado**: (A) ¿recurrió la CLASE
de fallo? y (B) ¿se sostuvo el CONTRATO de manejo de ese fallo que ya
se corrigió? Una recurrencia de (A) sin fallo de (B) NO reabre el bug
ya cerrado — es la confirmación de que el fix sigue funcionando.
Reabrir (B) sin evidencia de que el contrato realmente falló sería
inventar una regresión que no ocurrió.

Invariante relacionado: cuando el mismo hook/código es compartido entre
roles (Cliente/Negocio/Repartidor, `use-push-notifications.ts`), nunca
concluir "es plataforma porque el código es compartido" sin verificar
DIRECTAMENTE en el código de los 3 consumidores de rol que no existe
ninguna rama condicionada por rol antes del punto exacto de fallo — la
neutralidad de rol debe demostrarse leyendo el código, no asumirse por
la arquitectura compartida.

## PUSH — una causa "platform-level plausible, no probada" puede confirmarse después por evidencia física del operador, sin invalidar el reporte que la dejó como no probada (R17, 2026-09-08)

```text
DEVICE_LEVEL_CONFIRMATION_AFTER_PLATFORM_LEVEL_PLAUSIBLE_DOES_NOT_REWRITE_ORIGINAL_REPORT=SI
CHECK_DEVICE_NOTIFICATION_SETTINGS_BEFORE_ESCALATING_PUSH_DELIVERY_ANOMALIES=SI
```

R16 clasificó honestamente una pérdida de subscription como
`PLATFORM_LEVEL_PLAUSIBLE_NOT_PROVEN` porque, sin acceso al dispositivo
físico, no podía confirmar el mecanismo exacto — sólo podía probar que
NO era un bug de código DeliGO. R17 confirmó, con evidencia física
directa del operador, que la causa exacta era una configuración
externa (notificaciones de Chrome deshabilitadas a nivel del sistema
operativo Android). Esto NO significa que R16 haya estado mal
escrito o que deba reescribirse — clasificar como "plausible, no
probado" cuando la evidencia disponible en ese momento no permite más
fue la decisión CORRECTA, y el archivo de R16 se preserva sin editar
como registro histórico de lo que se sabía entonces. La reconciliación
de la conclusión nueva vive en las autoridades de estado ACTUAL
(`CODEX_REPORT.md`, `ROADMAP.md`, `FINDINGS.md`), nunca sobreescribiendo
el reporte original. Invariante operativo derivado: ante cualquier
anomalía de entrega de push que sobreviva una auditoría de código
exhaustiva sin encontrar bug (`NO_CODE_BUG_FOUND`), la siguiente
pregunta antes de escalar más auditoría de código debe ser pedirle al
operador que revise la configuración de notificaciones de su propio
dispositivo/navegador — no asumir que la ausencia de un bug de código
implica la necesidad de más instrumentación o más código.

## PUSH — un 404/410 real del proveedor puede reflejar un evento de plataforma fuera de DeliGO; no asumir causa de código sin agotar el inventario de unsubscribe (R16, 2026-09-07/08)

```text
PROVIDER_404_410_IS_NOT_AUTOMATICALLY_A_DELIGO_CODE_BUG=SI
BEFORE_BLAMING_CODE_FOR_SUBSCRIPTION_LOSS_MUST_INVENTORY=unsubscribe físico (hook + 3 rollbacks + stale-key removal), lifecycle listeners, auth bootstrap, Service Worker unregister, reset de permiso, storage cleanup
```

R16 encontró que una `PushSubscription` física recién creada y
confirmada murió genuinamente (410 real del proveedor) menos de un
minuto después de un envío aceptado (201), y que el MISMO actor había
sufrido una muerte idéntica de otro endpoint 90 segundos antes. Antes
de asumir que esto es un bug de código DeliGO, se debe repetir el
mismo inventario exhaustivo que R16 aplicó (ver
`P2_T31_R16_ANDROID_PUSH_SUBSCRIPTION_PERSISTENCE_LOSS_ROOT_CAUSE_AUDIT.md`,
secciones 2-8): TODOS los `.unsubscribe()` físicos del repo (el hook
personal, los 3 rollbacks de creación-fallida, la remoción de key
stale, logout operativo), todos los lifecycle listeners
(pagehide/visibilitychange/unmount), auth bootstrap, y cualquier
llamada a `registration.unregister()`. Sólo si ALGUNO de esos coincide
temporalmente con el trace del incidente se declara causa de código —
si ninguno coincide (como en R16), la clasificación correcta es
`PLATFORM_LEVEL_PLAUSIBLE_NOT_PROVEN`, nunca `HIGH_CONFIDENCE_CODE_BUG`
por descarte solamente. `Notification.permission` NUNCA puede ser
reseteado programáticamente por código de DeliGO — un cambio real de
ese valor (especialmente a `default`, no `denied`) es evidencia
adicional de que el evento ocurrió fuera del control de la aplicación.

## TOOLING — Project Skills contienen procedimiento, no estado (2026-09-07)

```text
SKILLS_CONTAIN_LIVE_PROJECT_STATE=NO
PROJECT_SKILLS_LOCATION=.claude/skills/<skill-name>/SKILL.md
```

Project Skills contain repeatable procedure; authority docs contain
mutable project state. Ninguna Skill de `.claude/skills/` (`deligo-
safe-task`, `deligo-closeout`, `deligo-testing-deploy`) puede contener
hashes de commit, deployment IDs, la tarea actual, el estado de
Android/Mercado Pago/P2-T31, ni conteos de tests actuales — ese estado
vive exclusivamente en Git real y en `codex-reports/CODEX_REPORT.md` +
`DELIGO_FULL_CONTEXT_LATEST.md` + el resto de `codex-reports/`. Un
futuro edit a una Skill que agregue estado vivo viola este invariante.
Ver `codex-reports/CLAUDE_SKILLS.md` para el detalle de cada Skill y
`DELIGO_CLAUDE_PROJECT_SKILLS_FOUNDATION_REPORT.md` para la auditoría
completa de su creación.

## PUSH — urgency explícita SÓLO para tipos time-sensitive; nunca forzar TTL sin decisión de producto (R15R corrige a R15, 2026-09-07)

```text
WEBPUSH_SEND_MUST_SET_EXPLICIT_URGENCY_AND_TTL=NO (CORREGIDO — ver invariante vigente abajo)
WEBPUSH_SEND_MUST_SET_URGENCY_HIGH_FOR_TIME_SENSITIVE_TYPES_ONLY=SI
WEBPUSH_SEND_MUST_NOT_OVERRIDE_TTL_WITHOUT_SEPARATE_PRODUCT_DECISION=SI
WEB_PUSH_LIBRARY_DEFAULT_TTL=2419200 (28 dias, DEFAULT_TTL en node_modules/web-push/src/web-push-lib.js — nunca estuvo ausente)
WEBPUSH_DEFAULT_URGENCY_WITHOUT_OPTIONS=normal (documentado, permite diferir entrega bajo Doze/ahorro de batería)
```

**Corrección de R15R sobre el invariante original de R15** (bloque
histórico preservado sin editar más abajo en `FINDINGS.md`): R15 había
declarado que TODO envío debía fijar `urgency` Y `TTL` explícitos. Se
audité la versión REAL instalada de `web-push` (3.6.7) y se confirmó
que la librería YA aplica `TTL=2419200` (28 días) por default —
nunca hubo ausencia real de TTL, sólo ausencia de un valor explícito
(que además, si se llegara a fijar, debería ser MAYOR o igual al
default para no acortar la retención real sin una decisión de producto
separada). El invariante vigente es:

- `sendPushNotification` (`src/lib/push.ts`) debe pedir
  `urgency: "high"` SÓLO cuando `payload.data?.type` es uno de los
  `NotificationType` clasificados como time-sensitive
  (`TIME_SENSITIVE_NOTIFICATION_TYPES` / `isTimeSensitivePushType` en
  `push.ts`: `order_update`, `new_order`, `new_delivery`, `chat`,
  `mesa_order_ready`, `salon_new_order`, `operaciones_salon_new_order`,
  `operaciones_order_cancelled`). Nunca global "por comodidad" — tipos
  no urgentes (`review`, `review_request`, `account_update`, `general`)
  deben conservar el default `"normal"` de la librería.
- `sendPushNotification` NO debe fijar un `TTL` explícito salvo que una
  tarea futura tome una decisión de producto separada y documentada
  sobre retención de push — nunca como efecto colateral de un fix de
  urgencia/entrega.
- Si se agrega un nuevo `NotificationType`, debe clasificarse
  explícitamente como time-sensitive o no en `push.ts` antes de
  producirse en ninguna fábrica de payload — no heredar el default de
  forma implícita sin decidirlo.

Este invariante corrige (no reemplaza silenciosamente) el hallazgo
`HIGH_CONFIDENCE_CODE_BUG` (no `PROVEN`) del fallo
`F-PAYMENTS-PAUSE-ANDROID-CLOSED-PWA-01` (Android, push real no
entregado con la PWA cerrada) — ver `FINDINGS.md`,
`P2_T31_R15_ANDROID_CLOSED_PWA_BACKGROUND_PUSH_ROOT_CAUSE_AUDIT.md` y
`P2_T31_R15R_PREDEPLOY_EVIDENCE_CORRECTION_AND_PUSH_PRIORITY_SCOPE.md`.
Cualquier refactor futuro de `sendPushNotification` que quite o cambie
la clasificación time-sensitive debe justificarlo explícitamente contra
este invariante, no eliminarla por accidente al "simplificar" la
llamada.

Invariante relacionado (no nuevo, re-confirmado durante R15): el envío
de push para el ciclo de vida completo de pedidos (`order_update`,
`new_order`, etc.) usa EXCLUSIVAMENTE este pipeline de Web Push —
`RealtimeEventMap` (`src/lib/realtime-types.ts`, canal Socket.IO) NO
tiene ningún evento de cambio de estado de pedido. Cualquier tarea
futura que necesite "notificar en tiempo real" un cambio de pedido debe
saber que el ÚNICO canal existente hoy es Web Push (con las
limitaciones de entrega en background que eso implica en Android) — no
existe un canal in-app alternativo que lo reemplace ni lo respalde.

## PUSH — el log de éxito del proveedor es TESTING-only, no global (R15R, 2026-09-07)

```text
PUSH_PROVIDER_SUCCESS_LOG_MUST_USE_TESTING_GUARD=SI
PUSH_TESTING_GUARD_FUNCTION=isPushDebugAllowedEnvironment (src/lib/push-testing-guard.ts)
```

R15 agregó `[Push] Enviado OK (...)` en el camino de éxito de
`sendPushNotification` (`src/lib/push.ts`) pero lo dejó corriendo en
TODOS los ambientes, pese a que la propia tarea R15 lo había concebido
como instrumentación TESTING-only (ver `PUSH_DIAGNOSTICS_POST_CERT_
ACTION` en su reporte). R15R corrigió esto reutilizando el guard YA
existente para el panel de diagnóstico de push
(`isPushDebugAllowedEnvironment`, gateado por
`RAILWAY_ENVIRONMENT_NAME=testing`, fail-closed) en vez de inventar un
mecanismo de configuración nuevo. Cualquier log de diagnóstico futuro
en `src/lib/push.ts` que no sea estrictamente necesario en Production
(el camino de FALLA sigue logueando incondicionalmente, por diseño
previo — ver invariante de arriba) debe pasar por este mismo guard, no
por una condición ad-hoc de `NODE_ENV` u otra variable. Sigue vigente:
nunca loguear el endpoint completo, `auth`, `p256dh`, ni el `body`/
`headers` crudos de la respuesta del proveedor — sólo
`fingerprintPushEndpoint` y `statusCode`.

## PAGOS — invariantes permanentes de Mercado Pago (diseño, 2026-09-07)

```text
PAYMENTS_DESIGN_AUTHORITY=codex-reports/PAYMENTS_MERCADOPAGO_DESIGN.md
MERCADOPAGO_INTEGRATION_CREATED=NO
```

Antes de cualquier implementación futura de pagos, cualquier tarea debe
leer `codex-reports/PAYMENTS_MERCADOPAGO_DESIGN.md` completo — es la
autoridad de diseño, no comentarios dispersos en otros archivos. Se
registran aquí, como invariantes permanentes que NINGUNA implementación
futura puede violar sin una nueva decisión explícita de Leonardo:

- Mercado Pago es OPCIONAL por negocio — nunca obligatorio.
- La conexión del negocio debe ser OAuth one-click — nunca pedir al
  comerciante que pegue Access Token/Client Secret/credenciales
  técnicas en un formulario DeliGO.
- Delivery pertenece económicamente al negocio — DeliGO nunca administra
  ni liquida pagos de delivery a repartidores.
- La tarifa DeliGO ($100 ARS, parametrizable) la paga el CLIENTE, nunca
  el negocio.
- Un pago por efectivo (u otro medio donde el negocio cobra también la
  tarifa) SÍ genera deuda/saldo pendiente del negocio por esa tarifa —
  un pago por Mercado Pago Split NUNCA genera esa deuda ni cuenta para
  el límite de ocultamiento/suspensión del comercio. Esta distinción es
  obligatoria para cualquier implementación futura de facturación/deuda.
- El precio sugerido es una ESTIMACIÓN, nunca una garantía de neto —
  debe protegerse tanto el neto deseado del negocio como que "Servicio
  DeliGO = $100" se muestre limpio al cliente (nunca desglosado con un
  costo de procesamiento MP visible aparte).
- Nunca mostrar al cliente un recargo/comisión de Mercado Pago como
  línea explícita — sujeto a validación legal antes de cualquier
  lanzamiento público (`LEGAL_REVIEW_BEFORE_PUBLIC_LAUNCH=REQUIRED`).
- Pedido y pago son estados SEPARADOS — un webhook de MP nunca debe
  mutar directamente el estado operativo de un pedido sin una regla de
  dominio explícita.
- La política central de captura es `BUSINESS_ACCEPTED AND CUSTOMER_
  CANCEL_WINDOW_EXPIRED` — condición AND, nunca OR. Ninguna de las dos
  condiciones por sí sola dispara el capture.
- Cancelación pre-capture usa `AUTHORIZATION_CANCEL`, nunca `REFUND` —
  el refund es un flujo excepcional, sólo aplicable post-capture.
- La política de que DeliGO cubra el 50% de un shortfall de refund
  quedó explícitamente `NOT_ADOPTED` — no incluirla en ningún término
  público/contractual sin una nueva decisión explícita.
- Deferred capture para crédito/débito/dinero-en-cuenta y la combinación
  Split+`capture=false` end-to-end quedan `TO_VERIFY`/`REQUIRES_
  TECHNICAL_SPIKE` — ninguna implementación puede asumir compatibilidad
  sin pasar primero por `MERCADOPAGO_SPLIT_DEFERRED_CAPTURE_
  COMPATIBILITY_SPIKE` (sandbox/test, no ejecutado todavía).

## P2-T31 — pruebas físicas Android PAUSADAS por decisión del operador, no cerradas (2026-09-07)

```text
ANDROID_PHYSICAL_TESTING_PAUSED_BY_OPERATOR=SI
ANDROID_PHYSICAL_TESTING_PAUSE_REASON=PAYMENTS_DESIGN_AND_DOCUMENTATION
ANDROID_PHYSICAL_TESTING_RESUME_REQUIRES_OPERATOR_DECISION=SI
```

Regla permanente para cualquier chat futuro: esta pausa es OPERATIVA
(Leonardo priorizó el diseño de pagos) — NUNCA debe interpretarse como
certificación Android, cierre de P2-T31, abandono del finding de
closed-PWA push (`F-PAYMENTS-PAUSE-ANDROID-CLOSED-PWA-01`), ni
resolución del `AbortError` histórico. No iniciar ninguna prueba física
Android nueva sin que Leonardo lo pida explícitamente. Los diagnósticos
R6/R6A/R6B se retienen (`PUSH_DIAGNOSTICS_POST_CERT_ACTION=RETAIN_
UNTIL_ANDROID_PHYSICAL_CERTIFICATION_COMPLETE`, sin cambios).

## P2-T31-R14 — Android tiene dos capas de permiso de notificación independientes (2026-09-06)

```text
ANDROID_NOTIFICATION_PERMISSION_HAS_TWO_INDEPENDENT_LAYERS=SI
ANDROID_PERMISSION_DEFAULT_WITH_ACTIVE_SUBSCRIPTION_IS_NOT_AUTOMATICALLY_A_DELIGO_BUG=SI
```

Un capture físico post-R13A mostró `permission=default` junto con
`physicalSubscription=true`/`backendSubscribed=true`/`hookSubscribed=true`
en el mismo snapshot — aparentemente contradictorio. Auditoría de código
confirmó que `Notification.requestPermission()` (usado por `subscribe()`)
y `Notification.permission` (releído en vivo por el panel de
diagnóstico) son la MISMA API del navegador, y que el código NO PUDO
haber creado la subscription física sin que el permiso fuera `granted`
en ese instante — ninguna API de JS permite revocarlo después. La
explicación NO se resolvió como un bug de DeliGO: fuentes de
plataforma (issue del repositorio oficial `GoogleChrome/android-browser-helper`,
issue de `pwa-builder/PWABuilder` #4817) documentan que Android
instalado como PWA/TWA mantiene DOS capas de permiso de notificación
rastreadas de forma independiente — el permiso de ORIGEN WEB que
`Notification.permission` reporta a la página, y el permiso de SISTEMA
OPERATIVO (`POST_NOTIFICATIONS`, runtime desde Android 13/API 33) — que
pueden divergir entre sí. Regla permanente: `permission=default` junto a
evidencia de subscription/backend activos NO debe interpretarse
automáticamente como un bug de lectura de DeliGO ni forzar un
"arreglo" de código — debe auditarse primero (código local +
documentación de plataforma), y la forma más confiable de resolver la
ambigüedad es observar directamente si la entrega real de push
funciona, no inspeccionar el string de permiso aislado. Ver
`P2_T31_R14_ANDROID_CREATE_RELIABILITY_CLOSEOUT_AND_REMAINING_MATRIX.md`
§6-9 para el detalle completo y las fuentes citadas.

## P2-T31-R13A — corrección de wording + boundaries independientes de logging/toast (2026-09-06)

```text
SECONDARY_FAILURE_REPORTING_EXCEPTION_PROVEN=SI
SECONDARY_FAILURE_EXACT_THROW_SITE=NOT_DIRECTLY_OBSERVED
INDEPENDENT_LOG_FAILURE_BOUNDARY=SI
INDEPENDENT_TOAST_FAILURE_BOUNDARY=SI
```

**Corrección explícita de la entrada de R13 (abajo)**: afirmaba que
"console.error(...) o toast.error(...) (las únicas dos líneas entre
entrar al catch y esa garantía) lanzaban una excepción propia" sin dejar
constancia explícita de que las demás expresiones evaluadas en esa
misma ventana (`safeErrorForLog(error)`, `gateRef.current.isCurrent(opId)`,
`pushMutationFailureMessage(error, ...)`) habían sido auditadas y
descartadas con certeza (funciones puras, sin llamadas externas, no
pueden lanzar para ningún input). El HECHO de que una excepción
secundaria ocurrió sigue PROBADO por eliminación — pero CUÁL de las dos
llamadas nativas/de terceros restantes (`console.error`/`toast.error`)
fue la causante NUNCA se observó directamente y no debe afirmarse como
resuelto. Formulación permanente correcta: `SECONDARY_FAILURE_REPORTING_
EXCEPTION_PROVEN=SI`, `SECONDARY_FAILURE_EXACT_THROW_SITE=NOT_DIRECTLY_
OBSERVED`.

**Hardening adicional**: la implementación de R13 envolvía
`console.error`+`toast.error` en UN solo `try/catch` compartido —
suficiente para garantizar que `finishMutation` siempre corriera, pero
NO para garantizar que `toast.error` se intentara si `console.error`
lanzaba primero. Se separaron en DOS boundaries independientes: un
fallo de logging nunca puede impedir el intento de toast, y viceversa —
ninguno de los dos puede impedir la finalización de la mutación. Regla
permanente para cualquier mutación futura en este archivo (o análoga en
otros hooks): cualquier llamada de logging/toast/feedback dentro de un
`catch` que precede a un punto de finalización obligatorio DEBE estar
protegida por su propio
`try/catch`, cada uno de forma INDEPENDIENTE (nunca compartiendo un
único boundary) — nunca asumir que `console.error`/librerías de UI de
terceros son intrínsecamente libres de excepciones. Ver
`P2_T31_R13_ANDROID_PUSHMANAGER_ABORTERROR_AND_STALE_UI_ROOT_CAUSE.md`
§10-13 y
`P2_T31_R13A_PUSH_FAILURE_REPORTING_HARDENING_TESTING_DEPLOY.md` §4-8
para el detalle completo.

## P2-T31-R12B — OFF→ON NO es una repetición válida del camino de creación física (2026-09-06)

```text
ANDROID_OFF_TOGGLE_IS_NOT_A_VALID_PHYSICAL_CREATE_REPEAT=SI
PHYSICAL_UNSUBSCRIBE_POLICY_FINAL=SERVER_DETACH_ONLY (P2-T05, sin cambios)
```

Confirmado por auditoría de código (`use-push-notifications.ts::unsubscribe()`):
desactivar notificaciones nunca llama a `PushSubscription.unsubscribe()`
a nivel navegador — sólo desvincula el binding server-side
(`SERVER_DETACH_ONLY`, ya vigente desde P2-T05, preservado sin cambios).
La `PushSubscription` física del browser sigue viva. Consecuencia
permanente para cualquier tarea futura que diseñe un gate físico de
"repetir la creación": un ciclo `OFF→ON` **NO** ejercita
`registration.pushManager.subscribe(...)` de nuevo — `subscribe()`
encuentra la subscription existente con la key VAPID vigente y toma la
rama de REUSO, sin pasar por `createPhysicalPushSubscription`. Para
forzar una creación física real y repetible hace falta destruir
genuinamente la subscription entre intentos (reinstalar la PWA, o
revocar el permiso de notificaciones del sitio) — nunca asumir que
mover el switch basta. Ver
`P2_T31_R12B_ANDROID_FAIL_PASS_RECONCILIATION_AND_RELIABILITY_GATE.md`
§11-12 para el detalle completo y el protocolo de reset propuesto.

## P2-T31-R12 — instrumentación diagnóstica mínima alrededor de `PushManager.subscribe()` (2026-09-06)

```text
SUBSCRIBE_PHYSICAL_CREATE_TRACE=START_RESULT_ERROR_UNCONDITIONAL
MUTATION_REGISTRY_TRACE=SET_RELEASE_WAIT_FOUND_WAIT_NOT_FOUND_OPTIONAL_DI
ERROR_CLASS_TAXONOMY=NotAllowedError|AbortError|InvalidStateError|NotSupportedError|NetworkError|Other
```

Un fallo físico real en Android (`ANDROID_PUSH_STATUS=FAIL_PHYSICAL_
FIRST_SUBSCRIBE_CAPTURED_PENDING_ROOT_CAUSE`) mostró un hueco de ~2.5s
en la traza sin ningún resultado ni error para el único `await` real de
esa ventana (`registration.pushManager.subscribe(...)`), y un
`waitForInFlightPersonalPushMutation` que resolvió casi instantáneo en
un remount sin poder confirmar si el registro cross-remount de R2 tenía
o no una entrada real. Se estableció como invariante: cualquier `await`
que llame directamente a una API nativa del navegador (Push/SW/etc.) y
cuyo resultado condicione la UI debe estar bracket-eado por un evento
START incondicional y, según el desenlace, exactamente uno de
RESULT/ERROR — nunca dejar un `await` de este tipo sin cobertura de
traza, porque un cuelgue real del navegador (fuera del control de
DeliGO) es indistinguible de un bug de código sin esa cobertura. Los
errores capturados se acotan SIEMPRE a una taxonomía cerrada y segura
(nunca el mensaje crudo). El registro de mutaciones en vuelo
(`push-mutation-in-flight-registry.ts`) usa inyección de dependencia
para su trace (nunca un import directo de `push-debug-trace.ts`),
preservando su naturaleza pura/framework-agnostic — ver
`P2_T31_R12_ANDROID_FIRST_SUBSCRIBE_PHYSICAL_CREATION_FAILURE_DIAGNOSTIC.md`
para el detalle completo. Cero cambio de comportamiento — sólo
visibilidad.

## P2-T31-R11 — regla permanente: el alcance nombrado por una tarea NO redefine un gate de una autoridad anterior (2026-09-06)

```text
TASK_SCOPE_NAMING_CANNOT_RETROACTIVELY_NARROW_PRIOR_MANDATORY_GATE=SI (regla permanente)
ORIGINAL_T31_PHYSICAL_MATRIX_SCOPE=ALL_THREE_ROLES_CLIENTE_NEGOCIO_REPARTIDOR_MANDATORY
P2_T31_STATUS=IN_PROGRESS_PENDING_IPHONE_BUSINESS_DELIVERY_PHYSICAL_MATRIX
```

R10 registró `IPHONE_PUSH_CERTIFICATION_SCOPE=TESTING_CLIENT_C1_THROUGH_C8`
(entrada de abajo) y usó ese alcance, nombrado por su propio prompt, para
declarar `P2_T31_STATUS=CLOSED_TESTING_CERTIFIED` — es decir, cerrar el
alcance GLOBAL de la tarea basándose en la certificación de un subconjunto
(Cliente). R11 auditó la autoridad original
(`P2_T31_TESTING_DEPLOY_PENDING_IPHONE_MATRIX_CERTIFICATION.md`, lenguaje
imperativo "debe cubrirse" para los tres roles, sin cláusula de excepción)
y determinó que esto fue incorrecto: **el nombre que una tarea posterior
le da a su propio entregable (`IPHONE_CLIENT_PUSH_MATRIX`) no constituye
autorización para cerrar un gate más amplio definido por una autoridad
anterior**. La entrada de R10 de abajo permanece como registro histórico
del dato técnico válido (Cliente SÍ está certificado) pero ya NO debe
leerse como justificación de cierre de P2-T31 completo —
`P2_T31_STATUS` fue corregido de vuelta a `IN_PROGRESS_PENDING_IPHONE_BUSINESS_DELIVERY_PHYSICAL_MATRIX`.
Esta regla (nombre-de-alcance-no-es-autorización-de-cierre) queda como
invariante permanente para cualquier tarea futura de esta cadena o de
otras. Detalle completo en
`P2_T31_R11_MULTIROLE_PHYSICAL_SCOPE_AUTHORITY_CORRECTION.md`.

## P2-T31-R10 — alcance de la certificación iPhone Push y retención de diagnósticos (2026-09-06) — DATO TÉCNICO VÁLIDO, VER CORRECCIÓN R11 ARRIBA

```text
IPHONE_PUSH_CERTIFICATION_SCOPE=TESTING_CLIENT_C1_THROUGH_C8
ANDROID_NOT_IMPLIED_BY_IPHONE_CERTIFICATION
PUSH_DIAGNOSTICS_POST_CERT_ACTION=RETAIN_UNTIL_ANDROID_PHYSICAL_CERTIFICATION_COMPLETE
```

`IPHONE_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING` (P2-T31-R10) cubre
específicamente: la plataforma **iOS/iPhone**, el entorno **TESTING**
(no Production, que sigue en `1de0d3c1...` sin los fixes R7/R8), y el
rol **Cliente** (matriz C1-C8). No implica ninguna garantía sobre
Android (`ANDROID_PUSH_STATUS` permanece `UNKNOWN_NOT_CERTIFIED` de
forma independiente — un cierre de iPhone nunca debe reinterpretarse
retroactivamente como evidencia de que Android funciona) ni sobre una
certificación física independiente de Negocio/Repartidor (ver
`F-P2-T31-R10-01` en `FINDINGS.md`, reclasificado como bloqueante por
R11), aunque ambos roles comparten código y cobertura de test con
Cliente — ver la corrección de R11 arriba: esa autoridad NUNCA fue
suficiente para cerrar el gate físico obligatorio de esos dos roles.

**Decisión explícita del operador**: aunque la certificación física
iPhone quedó completa, los diagnósticos R6/R6A/R6B (`PushDebugPanel`,
timeline de traza, snapshot, bootstrap de cold-launch, marcador armado
en `localStorage`, guard de debug TESTING, y el botón "Diagnóstico Push"
con sus acciones) se retienen intactos — sin cleanup ni preparación de
cleanup — porque Android sigue sin certificar y Leonardo quiere conservar
la instrumentación para esa certificación futura y para capturar
cualquier comportamiento diferente entre plataformas. Estos diagnósticos
son exclusivamente TESTING; Production nunca tuvo ni tiene acceso a
ellos. El retiro queda diferido explícitamente hasta que
`ANDROID_PUSH_STATUS` deje de ser `UNKNOWN_NOT_CERTIFIED`.

## P2-T31-R9 — método estándar para reproducir estado limpio de permiso Push en iOS (2026-09-06)

```text
IOS_PUSH_CLEAN_STATE_RESET_METHOD=REMOVE_HOME_SCREEN_INSTANCE_AND_REINSTALL
```

Para certificar C1 (primera activación real de notificaciones desde
`Notification.permission` no-decidido, sin `PushSubscription` física
previa) en un iPhone que YA tiene el permiso concedido y una
subscripción histórica — como el de Leonardo desde etapas tempranas de
T31 — el único método de reset con impacto mínimo y sin tocar cuenta/
datos del servidor es: cerrar la PWA, mantener presionado el ícono de
Home Screen y "Eliminar app"/"Quitar de la pantalla de inicio" (esto
borra la identidad de permiso + registro local de Service Worker/
`PushSubscription` de ESA instalación específica, que en iOS 16.4+ es
independiente por instancia instalada), reinstalar vía "Agregar a la
pantalla de inicio" desde Safari, y abrir EXCLUSIVAMENTE el ícono nuevo.
La señal de que el reset funcionó es que el diálogo NATIVO de permiso de
iOS vuelva a aparecer al activar notificaciones — si no aparece, el
estado no quedó limpio y el intento no cuenta como C1. Cualquier
subscripción stale que quede del lado del servidor para el endpoint
anterior ya está cubierta por el contrato de limpieza de subscripciones
stale de R3/R5/R5A, sin necesitar intervención manual. Ver
`P2_T31_R9_IPHONE_PHYSICAL_CERTIFICATION_RECONCILIATION.md` §19 para el
procedimiento completo paso a paso.

## P2-T31-R8 — invariante permanente: semántica de error de status Push (2026-09-06)

```text
STATUS_ERROR_SECURITY_MODEL=FAIL_CLOSED_WITHOUT_FALSE_OFF_REPRESENTATION
```

Un chequeo de estado Push (`checkPersonalPushStatus`) que no puede
obtener una respuesta real del backend — excepción de red, excepción del
browser API, o el backend respondiendo un HTTP no-2xx (incluido 429 del
rate limiter) — **nunca** debe representarse como `subscribed=false`
autoritativo. Sólo dos caminos pueden aplicar un valor autoritativo:

1. `no_physical_subscription` — el browser confirma que no existe
   ninguna `PushSubscription` física (hecho, no error) → `false`.
2. `server_authoritative_result` — el backend respondió 2xx con un
   `subscribed` real → `true` o `false` según ese valor.

Cualquier otro caso deja el estado explícitamente SIN RESOLVER
(`statusResolved=false`, opcionalmente `statusCheckError=true`) — nunca
afirma ON, nunca afirma OFF. Este invariante reemplaza/refina la
decisión previa de P2-T05 ("cualquier fallo cierra en false"), que había
sido preservada intacta por R7 con la evidencia disponible entonces —
R8 demostró con evidencia física real (un 429 con el backend genuinamente
`subscribed=true` segundos después) que esa decisión era incorrecta
específicamente para errores técnicos/de infraestructura, no para hechos
confirmados. Cualquier cambio futuro al pipeline de status Push debe
preservar esta distinción.

## PRODUCTION EMAIL VERIFICATION — invariantes operativas (2026-09-05)

```text
RESEND_KEY_ROTATION_CANONICAL_POLICY=
1_GENERATE_OR_PROVISION_NEW_KEY
2_UPDATE_TESTING
3_REDEPLOY_OR_RESTART_TESTING
4_CONFIRM_REAL_SEND
5_UPDATE_PRODUCTION
6_REDEPLOY_OR_RESTART_PRODUCTION
7_CONFIRM_REAL_SEND
8_ONLY_THEN_REVOKE_OR_DELETE_OLD_KEY
RESEND_KEY_ROTATION_POLICY_ADDED=SI
TEST_EMAIL_ENDPOINT_SEMANTIC_PARITY=NO
```

- **Causa raíz canónica cerrada:**
  `PRODUCTION_STALE_DELETED_RESEND_API_KEY_AFTER_INCOMPLETE_KEY_ROTATION`.
  Production retuvo una clave Resend vieja durante una rotación, y esa clave
  fue eliminada después. El operador actualizó Production y redeployó.
- **Política canónica de rotación de Resend:** generar/provisionar la clave
  nueva → actualizar Testing → reiniciar/redeployar Testing → confirmar envío
  real → actualizar Production → reiniciar/redeployar Production → confirmar
  envío real → recién entonces revocar/eliminar la clave vieja.
- `src/lib/email.ts` carga `RESEND_API_KEY` y crea el cliente Resend en
  module scope. Un cambio de variable no es efectivo para el proceso ya
  iniciado hasta reiniciar o redeployar.
- `/api/auth/test-email` usa SMTP/Nodemailer, mientras la ruta real de
  verificación usa Resend. `TEST_EMAIL_ENDPOINT_SEMANTIC_PARITY=NO`; esto es
  `EMAIL_DIAGNOSTIC_ENDPOINT_PROVIDER_DRIFT`, una deuda abierta no bloqueante,
  no evidencia para reabrir el blocker Resend ya cerrado.

## Reconciliación 2026-09-05 — contratos Push (P2-T31 R1→R5A) + P2-T25/T28

### Push — invariantes de arquitectura (vigentes, verificados por código y por reproducción en vivo)

- **`Notification.permission` != `PushSubscription` física != binding
  confirmado en backend.** Las tres son capas distintas, cualquiera puede
  fallar independientemente de las otras dos — nunca inferir una a partir
  de otra.
- **Que el switch de la UI muestre "activado" NUNCA es prueba de entrega
  real.** Reproducido en vivo: un negocio con switch ON y backend
  confirmando "subscribed" no recibió ningún push real durante días,
  porque su subscription física estaba atada a una VAPID key ya no
  vigente (`VapidPkHashMismatch`).
- **Multi-device = N `PushSubscription` por owner/dispositivo, nunca un
  booleano global de cuenta.** La tabla normalizada `PushSubscription`
  tiene `UNIQUE(ownerType, ownerId, channel, endpoint)` — el diseño
  explícito es multi-fila. La columna legacy de un solo valor es una
  limitación heredada del dual-write de migración, no el modelo real.
- **`/api/push/status` es por-endpoint-físico-actual, nunca "el owner tiene
  alguna subscription en algún dispositivo".** Un iPhone con subscription
  activa nunca puede hacer que el status de un Android del mismo owner dé
  `true`.
- **Disable normal = `SERVER_DETACH_ONLY` en las 4 superficies de
  subscribe.** `unsubscribe()`/`DELETE` sólo borra el binding
  server-side — la `PushSubscription` física del browser NUNCA se destruye
  en el camino normal de apagar el switch (el mismo endpoint físico puede
  estar legítimamente ligado a otro binding, MODEL-C1 multi-bind).
- **La destrucción física (`subscription.unsubscribe()`) está permitida
  ÚNICAMENTE en dos casos**: (a) reemplazo de una subscription confirmada
  como VAPID-stale, o (b) rollback de una subscription que la MISMA
  operación acaba de crear y cuya persistencia en backend falló. Nunca
  para desactivar por decisión normal del usuario.
- **Reusar una subscription física existente sin poder validar su
  compatibilidad con la VAPID key vigente está PROHIBIDO.** Una key que no
  pudo verificarse ("no pude obtener la VAPID vigente") se trata igual que
  una key incompatible para efectos de NO reusar/persistir — pero NUNCA
  igual que "confirmado stale" para efectos de destruir físicamente (fail
  aborta, nunca destruye sin evidencia).
- **La destrucción física de una subscription stale debe CONFIRMARSE, no
  asumirse del booleano de `unsubscribe()` por sí solo.** `false` es
  ambiguo entre navegadores; la política es fail-closed: `unsubscribe()`
  debe resolver `true` Y una relectura de `getSubscription()` debe
  confirmar `null` antes de crear una subscription nueva encima.
- **"La mutación/lectura más reciente gana" (`LATEST_RELEVANT_OPERATION_WINS`)**
  sigue siendo el modelo de arbitraje del hook personal
  (`createLatestOperationGate`, P2-T05) — protege races DENTRO de una
  instancia de componente, pero NO sobrevive un unmount/remount por sí
  solo.
- **El registro de mutación en vuelo module-scoped de P2-T31-R2**
  (`push-mutation-in-flight-registry.ts`) es lo que SÍ sobrevive un
  unmount/remount — permite que el chequeo de estado de una instancia
  NUEVA espere una mutación huérfana de la instancia VIEJA antes de leer
  el estado físico. Existe SOLAMENTE para el hook personal
  (Cliente/Negocio/Repartidor) — Salón y Mozo NO tienen el equivalente
  (`DIV-03`, ver `FINDINGS.md`).
- **`PushLifecycleManager` centralizado es una OPCIÓN ARQUITECTÓNICA
  FUTURA conceptual (R4), NO una decisión tomada ni una arquitectura
  actual.** No asumir que existe ni que se va a construir — hoy DeliGO
  tiene 4 implementaciones independientes del lifecycle de subscribe
  (`DIV-02`).

### P2-T25 — invariantes de abuso/rate-limiting

- Rate limiting de creación de pedido = 3 buckets independientes: cuenta
  (5/5min), IP (15/5min), negocio (30/5min).
- Un replay de idempotency (misma key, mismo request) NUNCA consume el
  bucket de negocio de nuevo.
- El rate limiter y los locks de creación de pedido son **process-local**
  (memoria del proceso) — no hay scaling horizontal seguro sin
  rediseñarlos primero.

### P2-T28 — invariante de concurrencia de estado de pedido

- Sólo la transición a `cancelado` usa CAS a nivel de base de datos. El
  resto de las transiciones de estado dependen únicamente del lock de
  aplicación process-local — no seguro para >1 réplica sin agregar CAS
  real (candidato natural de P2-T27).

## PRODUCTION-PILOT-CATALOG-E2E-01-R1 — 2026-08-30

- **Un token de reseteo de contraseña (`PasswordResetToken.tokenHash`) NO
  es recuperable por lectura de DB, a diferencia del token de verificación
  de email** — está hasheado con SHA-256 desde su creación, nunca
  guardado en texto plano. El patrón de "leer el token propio desde la DB
  para completar un flujo real sin depender de un buzón de correo" (usado
  repetidamente para verificación de email en esta saga) NO se generaliza
  a reseteo de contraseña. Si se pierde el acceso a una cuenta de prueba
  cuyo email es un dominio no entregable, la única salida sin acceso real
  al buzón es una excepción acotada y explícitamente autorizada por el
  usuario — nunca decidida unilateralmente.
- **Al necesitar generar un hash de contraseña fuera del runtime de la
  app (p. ej. en un script de reset acotado), importar y usar la función
  real (`hashPassword` de `src/lib/auth.ts`) en vez de reimplementar el
  algoritmo** — evita cualquier incompatibilidad sutil con el verificador
  real de login (formato de hash, iteraciones, versión).
- **`isNegocioOpen` (`src/lib/utils.ts`) evalúa el horario configurado
  contra la hora del propio proceso del servidor, sin conversión de zona
  horaria** — si Railway corre el proceso en UTC, un horario pensado en
  hora de Buenos Aires (ART, UTC-3) queda desplazado 3 horas en la
  práctica. No confirmado como bug (podría ser intencional o la
  plataforma podría estar en otra zona), pero cualquier tarea futura de
  onboarding real de horarios debe verificar esto explícitamente antes de
  asumir que "guardado correctamente" implica "abre/cierra a la hora que
  el dueño del negocio espera".

## PRODUCTION-PILOT-CATALOG-E2E-01 — 2026-08-30

- **`REAL_PRODUCTION_BUSINESS_DATA_PROTECTED=SI` — invariante permanente
  para toda tarea futura en Production.** Nunca mutar un negocio real
  como fixture de prueba, nunca editar/resetear su catálogo, nunca
  limpieza masiva de Production. Toda prueba mutable de Production debe
  quedar restringida a negocios DEMO/TEST explícitamente autorizados por
  el usuario (p. ej. `DeliGO Demo Burger`,
  `cmtgcfhep0009li0axg92s4tc`/`deligo-demo-burger`, creado y preservado
  en esta tarea). Verificado que `negocios` pasó de 16 a 17 (sólo el
  demo) antes/después de esta tarea.
- **Para probar features de catálogo end-to-end contra Production, usar
  las APIs reales de la aplicación (mismas que consume el panel), nunca
  SQL/Prisma directo para fabricar filas de catálogo** — sólo lectura vía
  Prisma sigue permitida para certificación (leer un token de
  verificación propio, contar filas, comparar fingerprints), nunca para
  escribir datos de producto/negocio. El registro de negocio requiere dos
  portones reales (verificación de email + aprobación de superadmin);
  ambos deben recorrerse de verdad — el primero puede resolverse leyendo
  el propio token generado (no depende de una bandeja de entrada real),
  el segundo requiere al usuario mismo vía su cuenta de superadmin real,
  nunca escribiendo `aprobado=true` por Prisma como atajo.
- **No asumir que un endpoint que responde `200 {"url":...}` significa
  que el recurso subido es servible** — verificar el `curl`/render real
  de la URL devuelta antes de certificar una subida como exitosa. El
  pipeline de upload de imágenes cae en silencio a un fallback cuando
  Cloudinary falla, y ese fallback puede a su vez no funcionar sin que
  ninguna capa lo reporte como error (ver `F-PRODUCTION-CATALOG-IMAGE-PIPELINE-01`).

## PRODUCTION-SYNC-R7 — 2026-08-30

- **Política de migraciones futuras de Production: `KEEP_MANUAL_MIGRATION_GATE`,
  `DeliGO`/production permanece con `preDeployCommand=NONE` a propósito.**
  Razón: `prisma migrate deploy` aplica TODAS las migraciones pendientes en
  orden sin distinguir expand de contract, y el repositorio no tiene ningún
  mecanismo automatizado (CI, convención, gate) que impida a un futuro
  deploy aplicar ciegamente una migración destructiva antes de que el
  código viejo haya dejado de depender de lo que se elimina. Activar
  `preDeployCommand` en Production eliminaría el control manual que R1/R3-R5
  usaron deliberadamente para la única migración destructiva de este ciclo.
  Cómo aplicar: cada futuro release con migraciones nuevas repite el patrón
  R5 (clasificar → backup → `migrate deploy` manual explícito → certificar)
  como su propia mini-tarea, nunca automático.
- **Regla expand/contract congelada permanentemente** (ver
  `codex-reports/PRODUCTION_SYNC_R7.md` sección 14): clasificar contra
  código real del entorno objetivo, EXPAND antes que código nuevo,
  DATA_CONDITION requiere conteo real, CONTRACT sólo tras confirmar con
  evidencia fresca que el código viejo no depende de lo eliminado + backup
  dedicado inmediatamente antes; `db push`/`migrate dev`/SQL manual
  prohibidos en Production salvo recuperación explícitamente autorizada.
- **Política de backup/recovery de Production congelada**: `pg_dump`
  lógico PostgreSQL 18.6 (`custom`, `--no-owner --no-acl`, SHA-256, restore
  completo a scratch desechable con certificación de migraciones/schema/
  agregados) es la primaria y obligatoria antes de cualquier migración
  destructiva o cambio de infraestructura de alto riesgo sobre la DB de
  Production — el plan actual de Railway no ofrece PITR/snapshot manual
  fresco, así que no hay secundaria operable salvo el snapshot histórico
  pasivo de la plataforma.
- **No asumir que una tabla de variables requeridas ya congelada (p. ej. la
  de 8 variables de R1) sigue siendo exhaustiva sólo porque el commit no
  cambió — derivar de nuevo directamente del código actual cuando la tarea
  lo exige.** R1 nunca incluyó `DELIGO_MONOLITH_INTERNAL_URL` (dependencia
  de `chat en vivo`, no de `DeliGO`) porque su alcance original fue otro
  canal; R7 la encontró recién al re-derivar desde
  `internal-session-check-client.js` en vez de reutilizar sólo la tabla
  histórica. Ver `F-PRODUCTION-CHAT-SESSION-CHECK-URL-01`.

## PRODUCTION-SYNC-R6-R1 — 2026-08-30

- **`serviceInstanceUpdate` no tiene semántica de creación probada para un
  par (servicio, entorno) sin instancia previa** — su descripción de schema
  es únicamente "Update a service instance", sin mención de upsert. El único
  mecanismo de API explícitamente de creación es `serviceCreate`, que crea un
  SERVICIO NUEVO (prohibido cuando el objetivo es reutilizar un servicio de
  proyecto existente). Regla: antes de usar `serviceInstanceUpdate` para
  provisionar Production por primera vez para un servicio que hoy solo tiene
  instancia TESTING, no asumir semántica upsert sin evidencia — si no puede
  probarse, tratar como no seguro y entregar hand-off manual de UI en su
  lugar (mismo patrón que R2 con `preDeployCommand`: preferir diferir a
  arriesgar un estado a medio configurar en Production).
- Confirmado (nueva evidencia, no disponible en R2): Railway separa
  configuración (`serviceInstanceUpdate`) de disparo de deploy
  (`serviceInstanceDeploy`/`serviceInstanceDeployV2`) como mutaciones
  DISTINTAS — esto resuelve la incertidumbre genérica de "¿escribir config
  dispara deploy?" para mutaciones de `ServiceInstance` en general, pero NO
  resuelve la pregunta de creación de instancia nueva tratada arriba.
- Cuando el operador ejecuta una corrección real de configuración/secreto
  fuera de una tarea Codex (p. ej. corrigiendo `x-cleanup-secret2` →
  `CLEANUP_SECRET` directamente en Railway) y eso dispara un deploy no
  intencional, la siguiente tarea debe CERTIFICAR ese deploy con evidencia
  fresca (commit exacto + status + logs + health) antes de construir sobre
  él — nunca asumir que "el operador dijo que funcionó" es suficiente sin
  verificación independiente, incluso cuando la evidencia del operador (un
  200 real) es aceptada como autoridad para lo que no es verificable desde
  este workspace (el scheduler externo en sí).

## PRODUCTION-SYNC-R6-R0 — 2026-08-30

- R6-R0 es read-only/backup-only contra Production: no hubo DB write, job,
  cron, Railway mutation, Git push, deployment ni restart.
- El backup post-27 fue creado y restaurado completamente con tooling 18.6;
  el artefacto queda fuera del repo.
- Los objetos Railway de Review y Mesa ya existen a nivel de proyecto; sus
  instancias Production no existen. No se creó duplicado.
- El scheduler externo de Chat Cleanup es `UNPROVEN_REQUIRES_OPERATOR_UI`.
  No se puede inferir ausencia ni crear reemplazo. `CLEANUP_SECRET` tampoco
  está presente con el nombre exigido por la ruta.

`DECISION_TYPE=BLOCKED_AWAITING_OPERATOR_CHAT_CLEANUP_SCHEDULER_EVIDENCE`

## PRODUCTION-SYNC-R5 — 2026-08-29

- Se autorizó y ejecutó exactamente un `prisma migrate deploy` en Production.
- La única migración aplicada fue #27:
  `20260826230000_drop_terminal_operativa_push_subscription`.
- El resultado es PASS: 27 migraciones exitosas, 0 fallidas, 0 pendientes;
  `terminales_salon` existe y `pushSubscription` ya no existe.
- No se realizaron cambios de código, schema, migraciones, Git, deployment,
  restart, preDeploy, variables, secretos, source ni cron.
- El backup lógico pre-27 restaurable sigue siendo el artefacto primario de
  recuperación. R6 requiere autorización explícita separada.

`DECISION_TYPE=PASS_FINAL_CONTRACT_MIGRATION_27_APPLIED_PRODUCTION_SCHEMA_COMPLETE`

## PRODUCTION-SYNC-R5-R0-R1 — 2026-08-29

- Tooling oficial PostgreSQL/EDB 18.6 obtenido fuera del repo; PostgreSQL 12
  no fue usado contra Production.
- El backup custom se creó una vez, se hasheó y se restauró completamente en
  scratch 18.6 con coincidencia de schema, migraciones y agregados.
- Production permanece sin mutaciones y #27 no se ejecutó.
- El dump certificado es el artefacto primario de recuperación de R5; el
  snapshot Railway anterior permanece secundario y conservado.
- R5 queda listo, pero la migración destructiva requiere autorización
  explícita separada.

`DECISION_TYPE=PASS_FRESH_POST26_PRE27_PRODUCTION_LOGICAL_BACKUP_RESTORABLE`

## PRODUCTION-SYNC-R5-R0 — 2026-08-29

- No se sustituye `pg_dump` 18 por PostgreSQL 12. Al no existir cliente 18 ni
  Docker/Podman, la decisión única es `BLOCKED_PG_DUMP_18_UNAVAILABLE`.
- Production fue consultada sólo read-only y permanece post-26/pre-27; no se
  creó dump, scratch DB, deployment, push ni migración.
- No se cambia la autoridad futura de R5 ni se deja R5 listo hasta certificar
  un backup PostgreSQL 18 restaurable.

## PRODUCTION-SYNC-R4-R2-R2 — 2026-08-29

- La certificación final es PASS: DeliGO y chat Production ejecutan el mismo
  commit exacto `c05525a5e0419922a484fbe6cb25c8604b8ca313` con `SUCCESS`.
- El cambio `testing` → `main` fue realizado manualmente por el operador y
  verificado sin mutación adicional de Codex.
- La DB permanece post-26/pre-27; #27, `DROP pushSubscription`, sigue sin
  ejecutar y el predeploy migratorio sigue diferido.
- R5 es sólo el siguiente task listo y requiere autorización explícita; no se
  ejecuta en R4-R2-R2.

`DECISION_TYPE=PASS_R4_DUAL_PRODUCTION_DEPLOY_CERTIFIED_27_PENDING`

## PRODUCTION-SYNC-R4-R2-R1 — 2026-08-29

- Se certificaron 8/8 variables R1; los valores secretos permanecen sin
  imprimir y la autoridad del operador declara credenciales privadas nuevas y
  dedicadas de Production.
- Se autorizó y ejecutó exactamente un push fast-forward. DeliGO desplegó el
  commit objetivo con `SUCCESS`; queda sano y no se revierte.
- No se usa `service source connect` para chat: reconecta repo+branch y no
  demuestra preservar root/autodeploy. El cambio branch-only requiere UI manual.
- La instrucción manual es cambiar `testing` → `main` preservando
  `LeoCampos2504/DeliGO`, `/mini-services/chat-service` y autodeploy; no hacer
  Deploy manual.
- No se ejecutan #27, `DROP pushSubscription`, T18, P2-T06 ni P2-T14; no hay
  segundo push ni escritura DB.

## DECISION REACHED

`DECISION_TYPE=BLOCKED_AWAITING_MANUAL_CHAT_BRANCH_CHANGE`

## PRODUCTION-SYNC-R4-R2 — 2026-08-29

- Una discrepancia entre autoridad del operador y metadata viva de Railway
  bloquea el push; no se resuelve por inferencia ni retry automático.
- El gate local puede pasar sin autorizar el push si una variable Production
  requerida aparece ausente en la lectura directa.
- No pedir secretos por chat, no copiar Testing, no crear aliases y no cambiar
  la fuente de chat mientras la discrepancia permanezca.
- #27, preDeployCommand, `DROP pushSubscription`, T18, P2-T06 y P2-T14 siguen
  fuera de alcance.

## PRODUCTION-SYNC-R4-R1 — 2026-08-29

- La única decisión de cierre es `BLOCKED_AWAITING_MANUAL_PRIVATE_EVIDENCE_CLOUDINARY_CONFIGURATION`.
- `REALTIME_INTERNAL_SERVICE_URL` puede resolverse desde el dominio privado y
  puerto de chat Production y ya fue escrito con `--skip-deploys`; no se
  permite copiar el literal de TESTING.
- `PRIVATE_EVIDENCE_CLOUDINARY_*` debe usar una credencial dedicada de
  Production. El namespace separado del código no autoriza reutilizar
  `CLOUDINARY_*` normales ni credenciales de TESTING.
- La API de Railway no expone branch/root/autodeploy de chat sin deployment;
  no se infiere desde TESTING ni se conecta/cambia la fuente automáticamente.
- Push, deploy, #27, preDeployCommand, DML Production y cambios de código
  permanecen prohibidos en R4-R1.

## PRODUCTION-SYNC-R4 — 2026-08-29

- Sin las ocho filas exactas R1 certificadas no se puede hacer fast-forward ni
  deploy de Production.
- R4 no autoriza crear/rotar los tres secretos faltantes de
  `PRIVATE_EVIDENCE_CLOUDINARY_*`, copiar secretos de Testing, inventar el
  valor de `REALTIME_INTERNAL_SERVICE_URL` ni mutar la fuente de `chat en vivo`.
- El gate se detiene antes del push; #27, `DROP pushSubscription`, T18,
  P2-T06 y P2-T14 permanecen fuera de alcance.

## PRODUCTION-SYNC-R3-R3-R1 — 2026-08-29

- Production puede quedar baselined en `0_init` y migrada hasta #26 con el
  bundle aislado exacto.
- #27 y `DROP terminales_salon.pushSubscription` permanecen prohibidos y
  pendientes; no hay deploy de código ni movimiento de `main`.
- El siguiente paso es R4, únicamente con autorización explícita nueva.

Decisiones permanentes y contratos que no deben perderse ni relitigarse
sin evidencia nueva. No es historia cronológica — ver `COMPLETED_TASKS.md`
o el archive para eso.

## PRODUCTION-SYNC-R3-R3 — 2026-08-29

- No reintentar automáticamente una mutación de Production tras un error de
  invocación; exigir nueva autorización explícita.
- La escritura autorizada no ocurrió: Production conserva el estado parcial
  31 tablas / 352 columnas y no tiene `_prisma_migrations`.
- Las fases posteriores (#2–#26), #27, deploy, restart y movimiento de main
  quedan sin ejecutar.

## PRODUCTION-SYNC-R3-R2-R1 decision — 2026-08-29

La reconciliación queda congelada: sólo se permite en scratch el `ALTER`
semánticamente equivalente a `0_init` para `empleados.cuentaOperativaId`.
El patch fingerprintado y el procedimiento #1–#26 pasaron; Production sigue
read-only y #27 sigue fuera de alcance. Ver
`codex-reports/PRODUCTION_SYNC_R3_R2_R1.md`.

## PRODUCTION-SYNC-R3-R2 decision — 2026-08-29

`0_init` no puede completarse mediante un parche exacto restringido a objetos
ausentes: `empleados.cuentaOperativaId`, dos índices y su FK faltan en una
tabla ya existente. Regla congelada: no inventar un `ALTER TABLE` ni mutar
ninguna de las 31 tablas Production; mantener bloqueado cualquier baseline o
deploy hasta reconciliación explícita. Autoridad:
`codex-reports/PRODUCTION_SYNC_R3_R2.md`.

## Push subscription model

## PRODUCTION-SYNC-R3 decision — 2026-08-29

- `prisma migrate deploy` against the full repository is forbidden because
  it includes the destructive migration #27.
- The isolated 26-directory bundle preserved exact SQL bytes and excluded
  #27, but Production has no `_prisma_migrations` table and `0_init` would
  attempt to recreate existing base tables.
- No `migrate resolve --applied 0_init` was executed: R3 explicitly forbids
  marking a migration applied without executing its complete SQL. The task
  is BLOCKED pending an explicit baseline decision.

R3-R1 confirma la condición más estricta: `0_init` es sólo parcialmente
materializada en Production, por lo que no es elegible para baseline. Las
cinco tablas faltantes son schema real faltante, no una discrepancia de
historia.

- **Normalized + legacy dual-write, rollout-safe**: cada actor
  (cliente/negocio/repartidor/empleado) mantiene tanto el campo legacy
  `pushSubscription` (string) como filas normalizadas en
  `push_subscriptions` (multi-device). Escritura SIEMPRE atómica en la
  misma transacción — nunca escritura parcial (`*_PARTIAL_SUCCESS_ALLOWED=NO`).
- **`SERVER_DETACH_ONLY`**: un "disable"/"unsubscribe" del lado personal
  NUNCA llama `subscription.unsubscribe()` físico en el navegador — sólo
  hace detach del lado servidor (legacy clear + normalized delete). La
  PushSubscription física del navegador puede seguir viva legítimamente
  ligada a otro binding (multi-bind, MODEL-C1). Verificado en runtime real
  (H3B testing checkpoint): tras un disable, la subscripción física
  persiste en el browser.
- **Server actor+endpoint = única autoridad de "activado"**: la UI NUNCA
  infiere `enabled` sólo de la existencia física de una PushSubscription
  ni sólo de `Notification.permission === "granted"` — siempre requiere
  confirmación server-side del binding actor+endpoint
  (`PERSONAL_PUSH_UI_STATUS_SOURCE=SERVER_ACTOR_ENDPOINT_BINDING`).
- **Endpoint dedupe / cross-owner conflict fail-closed (F20)**: cuando el
  MISMO endpoint físico aparece con p256dh/auth divergentes entre dos
  owners distintos, el merge de fanout excluye esa entrada del envío en
  vez de arriesgar enviar con la key equivocada — comparación excluye
  deliberadamente `expirationTime` (no es parte de la identidad
  criptográfica de la key).
- **1 Notificacion lógica / N sends físicos**: el fanout multi-device
  crea UNA fila `Notificacion` por evento pero puede disparar N envíos
  Push físicos (uno por device/subscription) — nunca N filas lógicas
  duplicadas.
- **Provider 404/410 cleanup — SÓLO desde estado real del proveedor**:
  el sweep que elimina una subscription muerta (`sweepDeadPushSubscriptionEndpoint`,
  único call site dentro de `push.ts`) sólo se dispara ante un 404/410
  REAL devuelto por el proveedor Push — NUNCA como resultado de un
  conflicto F20 local, y nunca por un 500/error de red (esos no implican
  que la subscription esté muerta, sólo que el intento falló).
- **F19 — discriminated union de canal**: `PushSubscriptionCleanup` usa
  un discriminated union sobre `channel` (`"default" | "salon"`) en vez de
  una convención de string suelta — evita que un caller mezcle
  field/channel incompatibles sin que TypeScript lo detecte.
- **Detach de usuario = exact-match únicamente**: las 5 rutas de detach
  (`detachPushSubscriptionByEndpoint`) usan siempre coincidencia exacta de
  endpoint — nunca un filtro amplio que pudiera afectar el binding de
  OTRO device del mismo actor.

## Hook `usePushNotifications` (Cliente/Negocio/Repartidor compartido)

- **`PushMutationResult` contract**: `subscribe()`/`unsubscribe()`
  retornan `Promise<{current: boolean, subscribed: boolean}>` (antes:
  `Promise<void>`) — cambio de contrato retrocompatible porque ningún
  consumidor productivo (Negocio, Repartidor) captura el valor de
  retorno. `current:false` significa que una operación/actor más nuevo ya
  invalidó ésta — el consumidor NUNCA debe actuar sobre `subscribed` en
  ese caso.
- **Nunca re-leer estado post-`await` de un closure**: la causa raíz de
  F18/F23 fue exactamente esto — un consumidor debe usar el resultado
  fresco devuelto por la mutación, nunca `push.isSubscribed` capturado
  antes del `await`.
- **`LatestOperationGate` (`PERSONAL_PUSH_ASYNC_MODEL=LATEST_RELEVANT_OPERATION_WINS`)**:
  gate compartido por `checkSubscription`/`subscribe`/`unsubscribe`/
  cambio-de-actor/unmount. `invalidate()` bumpea la generación SIN acuñar
  un nuevo id "current" — por lo que invalidar por sí solo NO reactiva
  automáticamente ningún `setLoading(false)` de una operación vieja
  descalificada (lección de F15: el efecto de cambio de actor debe
  resetear `loading` EXPLÍCITAMENTE, no basta con invalidar el gate).
- **Status check nunca toca `loading`**: sólo las mutaciones
  (`subscribe`/`unsubscribe`) lo hacen — estructuralmente imposible que un
  status check robe el ownership del loading de una mutación en vuelo.

## Testing infrastructure (Bun)

- **`mock.module()` es process-global, no per-file**: cuando varios
  archivos de test se cargan en una misma invocación `bun test`, las
  llamadas a las funciones mockeadas ocurren en la fase de EJECUCIÓN de
  tests (no en la de carga de cada archivo), y sólo UN registro de
  `mock.module(<mismo specifier>)` sobrevive a nivel de proceso. Cualquier
  helper de mock compartido entre archivos DEBE usar un singleton de
  estado mutable a nivel de módulo (no un `state` creado localmente por
  archivo) para que, sin importar cuál registro sobreviva, sus funciones
  lean el estado que el archivo ACTUALMENTE en ejecución configuró. Ver
  `src/lib/test-helpers/auth-mock.ts` (F-P2-T05-22/H4) como patrón de
  referencia reutilizable para cualquier otro mock compartido futuro.
- **Todo estado process-global del harness compartido, incluidos hooks, debe
  volver al baseline en el `beforeEach` de cada suite consumidora**: un reset
  que sólo limpia datos y deja callbacks globales permite que una clausura de
  test sobreviva entre tests/archivos. La corrección F22 agrega esta
  invariante al patrón `auth-mock`.
- **Modelo de regresión Push**: ver `TEST_AUTHORITY.md` para el listado
  vigente y los gates exactos — nunca inventar un modelo distinto sin
  reconciliar contra la lista literal persistida ahí.
- **Static-contract tests**: el repo NO tiene jsdom ni React Testing
  Library — toda prueba de hooks/componentes React se hace vía
  `readFileSync` + aserciones estructurales/regex sobre el código fuente
  REAL de producción (nunca un mock/helper divorciado del código real).
  Patrón establecido y sancionado explícitamente por el repo.

## P2-T13 boundary

`P2-T13` (race de re-suscripción del MISMO owner al MISMO endpoint) es un
finding/tarea DISTINTO de F20 (conflicto cross-owner de keys divergentes
en el mismo endpoint) — nunca deben confundirse ni uno absorber al otro.
Ningún stage de H1-H4 toca `push-subscription-repository.ts` de forma que
implemente, rediseñe o cierre P2-T13.

## Test fixture safety (TESTING únicamente)

- Toda fixture temporal usa `DELIGO_TEST_DATABASE_URL` leído FRESCO desde
  `.env` en el momento de uso (`DATABASE_URL="$(grep '^DELIGO_TEST_DATABASE_URL=' .env | cut -d= -f2-)" bun run <script>`)
  — nunca un valor de proceso stale, nunca fallback a `DATABASE_URL`
  normal, nunca impreso.
- Prefijo inequívoco en cada fixture (p.ej. `TEST_H3B_F18_<timestamp>`).
- Cleanup por ID EXACTO únicamente — nunca `deleteMany` con filtro amplio
  por prefijo/dominio.
- Nunca producción, nunca `railway connect postgres --tunnel-only`
  (permanentemente prohibido), nunca `railway variables`.

## TESTING vs Production (Railway)

```
RAILWAY_PROJECT=amiable-rejoicing
RAILWAY_ENVIRONMENT_TESTING=TESTING (id f37d0c49-b737-49e8-be89-a00c13734fae)
RAILWAY_LINKED_SERVICE=DeliGO Copy
```
El proyecto también contiene un environment `production` separado —
NUNCA es el contexto vinculado por defecto ni el objetivo de ninguna
operación del workstream P2-T05. Todo push/deploy de esta serie de tareas
va exclusivamente a `testing-codex` -> TESTING.

## Real-browser testing method (F18/F23 runtime certification)

Chrome Stable real (`C:\Program Files\Google\Chrome\Application\chrome.exe`),
`--headless=new`, perfil temporal exclusivo (`mkdtempSync`), CDP crudo vía
el paquete `ws` ya existente (nunca Playwright/Puppeteer, nunca
instalación nueva). `Browser.grantPermissions({permissions:["notifications"]})`
scoped al origin exacto. NUNCA monkeypatch de `Notification`/`PushManager`/
`ServiceWorker`. NUNCA tocar el Chrome real del usuario (perfil, procesos,
preferencias) — sólo procesos/perfiles task-owned, verificados
explícitamente al final vía inventario de procesos con línea de comandos
completa.

## No secret logging

Nunca imprimir: endpoint Push, p256dh, auth (keys), VAPID private key,
`DATABASE_URL`, `DELIGO_TEST_DATABASE_URL`, tokens/cookies/JWTs de sesión
real, variables de Railway. Los `console.error` de rutas Push usan
siempre `safeErrorForLog()` — patrón ya certificado, nunca bypaseado.

## P2-T13 Stage 1 confirmed design boundary

- RACE-A `register/register` del mismo owner/channel/endpoint queda resuelta
  por `UNIQUE(ownerType, ownerId, channel, endpoint)` + `upsert`; no se agrega
  ownership global.
- El residual demostrado es RACE-B: un detach normalizado que sólo filtra
  endpoint puede borrar una generación posterior con p256dh/auth rotados.
- El fix futuro debe ser un compare-and-delete atómico con ownerType, ownerId,
  channel, endpoint, p256dh y auth; `expirationTime` queda fuera del CAS como
  metadata mutable. No requiere schema/migration nueva.
- MODEL-C1 permanece vigente: cross-actor multi-bind permitido, transferencia
  destructiva prohibida, channel isolation preservada y SERVER_DETACH_ONLY
  intacto.

## P2-T13 Stage 2 confirmed invariant — 2026-08-26

T13_USER_DETACH_GENERATION_CAS_CONFIRMED=SI

El detach de usuario debe usar un CAS atómico de generación sobre el binding
normalizado: ownerType, ownerId, channel y endpoint identifican la fila lógica;
p256dh y auth identifican la generación esperada para el detach destructivo.
Si las keys ya rotaron, el detach stale no puede borrar la generación nueva.
Este CAS no aplica al sweep de endpoint muerto: el sweep global por endpoint
sigue reservado exclusivamente a la confirmación real 404/410 del proveedor.
expirationTime permanece fuera del CAS por ser metadata mutable.

## P2-T13 Stage 3 review confirmation — 2026-08-26

T13_STAGE3_GENERATION_CAS_REVIEW=PASS
T13_STAGE3_DELETE_PREDICATE=ownerType+ownerId+channel+endpoint+p256dh+auth
T13_STAGE3_USER_DETACH_ENDPOINT_ONLY=NO
T13_STAGE3_REGISTER_UNIQUE_UPSERT_UNCHANGED=SI
T13_STAGE3_MODEL_C1_PRESERVED=SI
T13_STAGE3_CHANNEL_ISOLATION_PRESERVED=SI
T13_STAGE3_EXPIRATION_TIME_EXCLUDED=SI
T13_STAGE3_DEAD_SWEEP_SEPARATE=SI

La recertificación no cambia las decisiones previas: el CAS de usuario
compara la generación completa; el sweep global por endpoint sigue reservado
a 404/410 del proveedor; y el register conserva la identidad unique por
owner/channel/endpoint.

## P2-T13 Stage 7 — cierre final, invariantes confirmadas en runtime real

Todas las invariantes de las secciones "Stage 1"/"Stage 2"/"Stage 3" de
arriba quedaron confirmadas empíricamente contra PostgreSQL real de
TESTING (no sólo mocks/blobs) en P2-T13-STAGE6, y el cierre adversarial de
P2-T13-STAGE7 no encontró ninguna contradicción entre esas decisiones y la
evidencia runtime. No se agrega una invariante nueva — se cierra el ciclo:
diseño (Stage1) → implementación (Stage2) → revisión de código (Stage3) →
commit (Stage4) → recertificación de blobs (Stage5) → runtime real
Postgres+HTTP (Stage6) → cierre adversarial (Stage7), sin relitigar el
predicate CAS ni el boundary MODEL-C1/SERVER_DETACH_ONLY/dead-sweep en
ningún punto de la cadena.

## P2-T12 — TerminalOperativa.pushSubscription (F-P0-05)

- **El campo es deuda de schema pura, no una feature latente**: existe
  desde el commit que introdujo el modelo `TerminalOperativa`
  (`d8ead24`), nunca tuvo writer ni reader en ningún punto de la historia
  de git, y su exclusión del modelo `PushSubscription` normalizado de
  P2-T05 fue deliberada y está documentada en el propio comentario de la
  migración `20260824220000_add_push_subscription_model` — no un
  descuido de T05.
- **`TerminalOperativa` no es un actor Push**: arquitectónicamente es un
  dispositivo kiosco con sesión revocable por token
  (`SesionTerminalOperativa`), que se refresca por polling — no tiene
  concepto de suscripción Push propia. `CorePushOwnerType` nunca incluyó
  `"terminal"`. Cualquier tarea futura que considere agregar Push a
  terminales debe tratarse como una feature nueva de producto (fuera del
  alcance de limpieza de deuda), nunca como una simetría automática con
  los demás actores.
- **`revokedAt` es la fuente de verdad de revocación efectiva** de
  `TerminalOperativa` — `estado` es descriptivo/derivado, no autoritativo
  por sí solo.
- **`TerminalOperativa` no debe recibir una feature Push como parte del
  cleanup de F-P0-05**: el objetivo de P2-T12 es eliminar deuda inerte, no
  construir una feature nueva. Ningún stage de P2-T12 debe agregar
  `ownerType` terminal, rutas subscribe/status/unsubscribe, ni UI de
  permiso de notificación.
- **`Prisma update()`/`create()`/`find*()` sin `select` explícito
  arriesga el rollout de cualquier futuro `DROP COLUMN`**: el Prisma
  Client pide TODOS los campos escalares del modelo (según el schema
  vigente al momento de `prisma generate`) en su SQL por defecto — si una
  columna se elimina de la DB mientras una instancia con Prisma Client
  generado contra el schema ANTERIOR todavía sirve tráfico, esas queries
  fallan a nivel SQL aunque el código JS nunca lea el campo. Demostrado
  mecánicamente (sin DB) vía el tipo `$<Modelo>Payload.scalars` del
  cliente generado. **Invariante de rollout, no preliminar**: un `DROP
  COLUMN` NUNCA puede viajar en el mismo commit/deploy que el schema
  removal si existe al menos un caller sin `select` explícito sobre ese
  campo Y no hay prueba fuerte de que la plataforma (Railway) drene la
  instancia vieja antes del `preDeploy` — el patrón correcto es un
  rollout de contrato de dos fases: **Phase1** remueve el campo del
  schema/cliente (la DB conserva la columna, inofensiva) y sólo tras
  certificar que ninguna instancia vieja sigue sirviendo, **Phase2**
  aplica el `DROP COLUMN` físico en un commit/deploy separado. Agregar
  `select` a un commit nuevo NUNCA protege un proceso ya en ejecución —
  sólo protege a la instancia que arranca con ese commit. Caso concreto:
  `TerminalOperativa.pushSubscription`
  (`src/app/api/operaciones/terminal/activar/route.ts:142`,
  `src/lib/operaciones-terminal-auth.ts:209`), decidido en
  P2-T12-STAGE3 como `TWO_PHASE_CONTRACT_DEPLOY_REQUIRED`.
- **Phase1 de un rollout de contrato no necesita `select` explícito en
  ningún caller para quedar protegida**: basta con que el campo
  desaparezca del `schema.prisma` — el cliente regenerado excluye el
  campo de `$<Modelo>Payload.scalars` para TODAS las queries sin
  `select`, no sólo las que antes se identificaron como riesgosas.
  Confirmado en P2-T12-STAGE4A inspeccionando directamente el tipo
  generado (sin DB). Ningún archivo TS necesita tocarse en Phase1.
- **Blueprint de migración retirada = SQL completo + SHA-256 preservados
  en el reporte, archivo eliminado del árbol antes del commit de Phase1**:
  patrón reutilizable para cualquier futuro rollout de contrato de dos
  fases — evita que Railway aplique una migración destructiva pendiente
  junto con un commit que sólo debía cambiar el contrato de cliente.

## Reglas de reporte (desde REPORT_SCHEMA_VERSION=2)

Ver el manifest al inicio de `CODEX_REPORT.md`. Regla dura: nunca volver
a appendear un informe completo al root `CODEX_REPORT.md` — el detalle
extenso va en `codex-reports/CURRENT_TASK.md`, y el root se regenera
compacto (~200-500 líneas, límite duro ~800) al final de cada tarea.

## P2-T12 Stage5A — Phase2 local preparation decision

- Se conserva el contrato TWO_PHASE: Phase1 desplegada primero; Phase2 solo
  elimina físicamente `terminales_salon.pushSubscription` en un commit/deploy
  posterior.
- El mapping certificado es `@@map("terminales_salon")` + columna física
  `pushSubscription`; se deriva del parent y de `prisma/migrations/0_init/migration.sql`,
  no del schema Phase1 que ya no contiene el field.
- Se reutiliza el directory histórico
  `20260826230000_drop_terminal_operativa_push_subscription` porque no existe,
  es único y queda después del último migration tracked.
- El archivo recreado reproduce por SHA exacto el blueprint de 2134 bytes y
  conserva la sentencia única `ALTER TABLE ... DROP COLUMN IF EXISTS ...`.
- `KEEP_IDEMPOTENT` permanece vigente, pero `IF EXISTS` no sustituye el gate
  futuro `PHYSICAL_COLUMN_EXISTS_PREPUSH=SI`.
- Stage5A no aplica la migration, no accede DB y no habilita commit/push/deploy.
  Stage5B debe realizar la revisión adversarial antes de cualquier mutación
  de Git.

## P2-T12 Stage5D/R1 — canonical rollout decision

- `TWO_PHASE_CONTRACT_DEPLOY_REQUIRED` permanece vigente: Phase1 commit
  `bebd36c841f588fc9e4c74099e38a95d37d58982` precede a Phase2 commit
  `7822d84ac5ac841978a77ebef76ad93630b69f42`.
- `KEEP_IDEMPOTENT` permanece vigente mediante `DROP COLUMN IF EXISTS`.
- El fresh prepush gate debe demostrar que la columna física existe antes de
  cualquier aplicación; `IF EXISTS` no sustituye ese gate.
- No se recreará automáticamente la columna si el deployment posterior falla.
- Stage5D/R1 solo certificó y reconcilió documentación. Stage5E ejecutó la
  secuencia autorizada: primero Phase1 compatible, luego un único push de
  Phase2, DROP físico en TESTING mediante preDeploy, smoke runtime y cleanup.
  La estrategia de rollout de dos fases queda validada en producción-like
  TESTING; Production permanece fuera de alcance. Stage5F queda reservado para
  el cierre documental final.

## P2-T12 Stage5E — TESTING certification decision

- El gate de base de datos exige y usó exclusivamente
  `DELIGO_TEST_DATABASE_URL`; la ausencia habría detenido la tarea. Su valor
  nunca se imprime y `DATABASE_URL` no es fallback.
- Antes del push había exactamente una migration pendiente (T12), cero
  migrations fallidas, history T12 en cero y la columna física presente.
- El único push fast-forward publicó la Phase2 exacta; Railway TESTING
  aplicó la migration en el preDeploy declarado y el deployment arrancó
  `SUCCESS`. La instancia Phase1 anterior quedó `REMOVED`.
- Después del DROP, history T12 es exactamente 1, successful exactamente 1,
  pending/failed son 0 y `terminales_salon.pushSubscription` está ausente.
- El smoke HTTP confirmó que la terminal sigue operativa, replay del QR es
  fail-closed (`400`), contexto revocado es no autorizado (`401`) y la
  respuesta no expone `salonActivo`. No se invocó Push ni WebPush.
- Las fixtures se eliminan por identidad exacta y se verifica cero remanentes;
  no se recrea la columna automáticamente si una etapa posterior falla.

## P2-T12 Stage5F — permanent closeout invariant

- `TerminalOperativa.pushSubscription` queda permanentemente removido del
  Prisma schema y de la DB TESTING; no queda compatibility shim.
- `TerminalOperativa` no es actor Push: no existe modelo, ruta, provider ni
  send-path terminal. La autoridad normalized `PushSubscription` se mantiene
  solo para los actores soportados.
- El patrón de migration destructiva two-phase quedó validado: contrato/schema
  primero, DROP físico después del drain certificado.
- F-P0-05 está `RESOLVED` y P2-T12 está `CLOSED`; no se crea una nueva feature
  ni se requiere backfill.
- El siguiente task canónico es P2-T11, `Native Socket Post-Logout TTL
  Hardening`, posición 9 del roadmap; P2-T02 y P2-T19 conservan sus estados
  independientes.

## P2-T11 — Native socket post-logout revocation design (F-P2-T11-01, Stage1B)

- **`sid` = `Sesion.id`, no un campo nuevo**: el claim `sid` de cada JWT
  (`socket-actor` y `room-capability`) ya es literalmente el `id` (PK cuid)
  de la fila `Sesion`, nunca el token hasheado (`Sesion.token`). Esto hace
  posible un chequeo de revocación en connect-time SIN ningún cambio de
  schema/migration — invariante central que evita reinventar un
  identificador de sesión en cualquier tarea futura sobre este dominio.
- **Prevención de reconnect ≠ terminación de socket ya vivo**: son dos
  garantías estructuralmente distintas y NUNCA deben tratarse como una
  sola. T11 puede (y debe) rechazar de inmediato cualquier conexión NUEVA
  con una sesión ya revocada (chequeo en `io.use()` antes de `next()`).
  Forzar la desconexión inmediata de un socket que YA estaba conectado en
  el instante exacto del logout, en una instancia arbitraria del
  chat-service, requiere fan-out/targeting distribuido — eso es,
  explícitamente, el mandato de P2-T09. Ninguna tarea debe declarar
  "revocación inmediata" sin calificar cuál de las dos garantías cubre.
- **Modelo de revocación preciso, nunca "inmediato" sin calificar**:
  la clasificación correcta para este diseño es
  `IMMEDIATE_NEW_CONNECT_REJECTION_WITH_EXISTING_SOCKET_DISTRIBUTED_DEBT`
  — cualquier futura tarea que toque este flujo debe seguir usando una
  clasificación igual de precisa, nunca "el logout revoca todo de
  inmediato" sin especificar el residual real.
- **Asimetría de costo TTL actor vs. room-capability**: el vencimiento del
  actor dispara un ciclo completo de reconexión (`disconnect` + nuevo
  token HTTP + nuevo handshake Socket.IO), mientras que el vencimiento de
  una room-capability sólo dispara un refresh liviano sobre el MISMO
  socket ya conectado. Por eso el TTL del actor nunca debe bajarse tan
  agresivamente como el de una capability sin volver a evaluar el riesgo
  de "reconnect storm" — 120s fue el punto elegido tras rechazar
  15/30/60s por ese motivo exacto.
- **Bridge HMAC interno reutilizable, patrón único**: el repo ya tiene un
  canal autenticado monolito→chat-service (`createHmac("sha256", secret)`,
  `INTERNAL_PUBLISH_PATH`, timeout acotado) en
  `src/lib/realtime-publish.ts` / `mini-services/chat-service/internal-publish-*.js`.
  Cualquier endpoint interno nuevo entre estos dos procesos (en cualquier
  dirección) DEBE seguir el mismo patrón de autenticación — nunca
  introducir un mecanismo de confianza nuevo o distinto sin justificación
  explícita.
- **Multi-tab logout es responsabilidad de T11, no una excusa para T09**:
  Zustand `persist` ya escribe a `localStorage` en cada logout; el gap
  (ninguna otra pestaña escucha ese cambio) se resuelve con un listener
  nativo `window.addEventListener("storage", ...)` — un mecanismo
  local-al-browser, sin infraestructura distribuida, por lo que nunca debe
  diferirse a P2-T09.
- **Restricción de rollback asimétrica**: una vez que el chat-service
  dependa de un endpoint interno nuevo del monolito para el chequeo de
  connect-time (fail-closed), un rollback del monolito por DEBAJO de la
  versión que introduce ese endpoint, sin rollback simultáneo del
  chat-service, provoca que TODAS las conexiones nuevas sean rechazadas
  (404 tratado como fail-closed). Cualquier operación de rollback futura
  sobre este par de servicios debe respetar el orden: chat-service se
  revierte con o antes que el monolito, nunca después.
- **Rollout de dos fases obligatorio cuando cambian monolito Y
  chat-service**: Phase1 despliega el endpoint interno nuevo + TTL
  reducido + listener cross-tab (inertes hasta Phase2, 100%
  retrocompatibles); sólo después de certificar Phase1 vivo, Phase2
  despliega el chat-service llamando al endpoint ya existente. Mismo
  patrón de contrato-primero-recurso-después ya usado y validado en
  P2-T12.
- **El chat-service YA auto-expira un socket conectado al vencer su actor
  JWT — no es trabajo nuevo de T11**: `mini-services/chat-service/
  index.js:327-332` programa, en `io.on("connection")`, un
  `setTimeout(..., Math.max(0, actor.tokenExp*1000 - Date.now()))` que
  fuerza `socket.disconnect(true)` al llegar el `exp` real del JWT
  presentado en esa conexión — independiente de heartbeat de transporte,
  de reauth y de cualquier señal externa. Confirmado mecánica Y
  empíricamente (test real `mini-services/chat-service/test/
  security.test.js`, caso "disconnects an already-connected socket when
  the actor token expires", 12/12 PASS). **Corolario preciso**: el
  residual de un socket ya conectado se mide desde la EMISIÓN del token
  presentado en esa conexión, nunca desde el instante del logout — puede
  acercarse al TTL completo si el logout ocurre justo tras conectar, o
  ser casi nulo si ocurre cerca del fin natural del token. Cualquier
  descripción futura de esta garantía debe usar esa redacción exacta,
  nunca "el socket se cierra a los N segundos del logout".
- **No confundir "acotado por TTL" con "revocación instantánea"**: un
  mecanismo de auto-expiración por `exp` (como el de arriba) acota el
  residual de un socket YA conectado sin necesitar enterarse del logout
  — porque el límite estaba pre-programado desde el momento de conectar,
  usando un dato (`exp`) que el JWT ya llevaba grabado. Esto es
  estructuralmente distinto de una terminación forzada en el instante
  exacto del logout, que sí requiere que la instancia se entere del
  evento (fan-out distribuido) — ese es, exclusivamente, el mandato de
  P2-T09. Ninguna tarea debe tratar estos dos mecanismos como
  intercambiables ni usar "bounded by TTL" como sinónimo de "immediate".
- **Nunca reusar un secreto HMAC interno entre canales de propósito
  distinto sin analizar expansión de privilegio primero**: HMAC es
  simétrico — cualquier parte que posea el secreto para VERIFICAR ya
  posee, criptográficamente, la capacidad de FIRMAR con él. Reusar
  `REALTIME_INTERNAL_PUBLISH_SECRET` (hoy poseído por el chat-service
  sólo para verificar publishes entrantes) para un nuevo canal en
  sentido inverso (chat-service firma, monolito verifica) le daría al
  chat-service, por primera vez, un canal de entrada autenticado hacia
  el monolito — una expansión real de lo que un chat-service comprometido
  podría hacer, no una conveniencia gratis. Cada canal interno nuevo debe
  evaluar esto explícitamente antes de decidir reusar vs. dedicar un
  secreto (ver P2-T11-STAGE2 para el caso concreto:
  `REALTIME_SESSION_CHECK_SECRET` dedicado, nunca compartido con
  `REALTIME_INTERNAL_PUBLISH_SECRET`).
- **Railway en este proyecto despliega TODOS los servicios del monorepo a
  cada push, sin filtrado por paths** (confirmado empíricamente por el
  historial de deploys de P2-T12: "chat en vivo" redesplegó en cada stage
  aunque el diff sólo tocara `prisma/schema.prisma`). Cualquier rollout
  multi-fase futuro debe lograr el orden mediante SECUENCIA DE COMMITS +
  verificación entre pushes — nunca asumiendo que se puede desplegar
  selectivamente un solo servicio del monorepo.
- **`deligo_session` es una cookie de origen, compartida por TODAS las
  pestañas del mismo browser** — nunca hay dos sesiones cliente/negocio/
  repartidor simultáneamente activas en el mismo navegador. Esto elimina
  la necesidad de cualquier mecanismo de correlación de sesión en un
  diseño cross-tab: un cambio a `user:null` en la key persistida de
  Zustand (`deligo-auth`) siempre significa "la única sesión de este
  browser cerró", nunca "otra sesión distinta cerró". (`superadmin` usa
  una cookie separada y está fuera del alcance del chat realtime.)

## P2-T11 — invariantes finales de cierre (F-P2-T11-01 RESOLVED, Stage5G) — 2026-08-27

Estas invariantes describen el estado FINAL desplegado en TESTING tras
las tres fases de P2-T11 (commit `f6ca24f`); no reemplazan las
invariantes de diseño de Stage1B listadas arriba, las complementan con
el resultado certificado:

- **Actor socket TTL = 120s desde la EMISIÓN del token, nunca desde el
  logout** — certificado en runtime real (JWT emitido por el servidor de
  TESTING mide `exp-iat=120` exacto). Nunca describir este TTL como "120s
  después del logout" — es un techo desde la emisión, que puede
  acercarse al máximo si el logout ocurre justo después de conectar, o
  ser casi nulo si ocurre cerca del vencimiento natural.
- **Room-capability TTL = 120s, sin cambio, independiente del TTL del
  actor** — nunca acoplar ambos valores en el código ni en el
  razonamiento de seguridad; son dos autoridades JWT separadas.
- **Toda conexión Socket.IO nueva exige una `Sesion` activa verificada
  server-side** (endpoint interno HMAC, `isSesionActiveById`) — una vez
  que el logout borra la fila `Sesion`, ningún JWT de actor previamente
  válido puede establecer una conexión nueva, sin esperar ningún TTL.
  Este es el mecanismo de seguridad real; el TTL reducido y el listener
  cross-tab son mitigaciones adicionales de acotamiento/UX, no la
  autoridad primaria.
- **Cero lookup de sesión por evento** — el chequeo server-side ocurre
  exactamente una vez, en `io.use()`, antes de aceptar la conexión;
  nunca en cada mensaje/evento posterior. No introducir un chequeo
  per-event sin una razón de seguridad nueva y explícita.
- **Un socket ya conectado antes del logout permanece acotado por su
  propio `exp`** (mecanismo `actorExpiryTimer` pre-existente,
  confirmado en Stage1B-R1, sin cambio de código) — nunca se desconecta
  de forma forzada e instantánea por el logout mismo. Confundir
  "prevención de reconexión" con "terminación de socket ya vivo" es el
  error conceptual explícito que Stage1B ya advertía evitar.
- **La propagación de logout entre pestañas del mismo navegador es
  soportada y certificada con navegador real** (evento nativo `storage`
  sobre la key `deligo-auth` ya existente de Zustand persist, 15-20ms de
  latencia observada). **La revocación instantánea cross-device/
  cross-instance NO es soportada por P2-T11** — sigue siendo,
  explícitamente, el mandato de P2-T09, nunca absorbido.
- **Un login nuevo en una pestaña no se propaga automáticamente a otra
  pestaña ya abierta** — asimetría de diseño intencional (el listener
  cross-tab sólo actúa sobre `user === null`), confirmada empíricamente
  con navegador real en Stage5F. No es un defecto; no debe "corregirse"
  sin una decisión de producto explícita nueva.
- **El residual de logout tardío bajo timing patológico de navegador
  (pestaña en segundo plano/BFCache) queda como riesgo aceptado de
  severidad baja** (`ACCEPTED_LOW_NON_SECURITY_BLOCKING_LIMITATION`),
  nunca corregido en código, nunca reproducido con las herramientas de
  navegador disponibles en este entorno. Su peor caso es una
  re-solicitud de login local — nunca acceso no autorizado, nunca
  resurrección de sesión server-side. Cualquier tarea futura que toque
  `realtime-provider.tsx`/`use-auth.ts` debe preservar esta
  clasificación salvo evidencia nueva que la contradiga.
- **Producción nunca fue tocada, leída ni consultada en ningún momento
  de P2-T11** — todo el hardening, certificación server-runtime y
  certificación de navegador real ocurrieron exclusivamente contra
  TESTING.

## Sesión / autenticación — same-browser multi-actor coexistence (P2-T18-BLOCKER-AUTH1)

- **`deligo_session` es una única cookie global** para los cuatro tipos
  que comparten el modelo `Sesion` (cliente/negocio/repartidor/
  superadmin) — un segundo login de un `tipo` distinto sobrescribe el
  valor de la cookie en el navegador, aunque nunca revoca la fila
  `Sesion` DB del actor anterior (`loginCliente`/`loginNegocio`/
  `loginRepartidor` sólo hacen `INSERT`, nunca tocan sesiones de otro
  `userId`). Ver F-P2-T18-AUTH01.
- **`SESSION_LOGIN_ATOMICITY_DEBT` ≠ same-browser multi-actor
  coexistence** — distinción obligatoria confirmada por lectura de
  `session-login-atomicity.integration.test.ts`: ese trabajo resolvió
  atomicidad transaccional DB de logins concurrentes de LA MISMA
  cuenta (test `CONCURRENT_LOGIN_RESPONSES`: 2 logins concurrentes del
  mismo Cliente → 2 filas `Sesion`, sin excepción). Nunca tocó
  selección de cookie ni contempló dos tipos de actor distintos
  autenticados a la vez. No confundir "DB soporta múltiples sesiones"
  con "el navegador puede presentar dos tokens simultáneos".
- **`model Sesion` no tiene constraint `@unique` sobre `userId` ni
  `(userId, userType)`** — múltiples filas independientes por distinto
  actor ya son válidas hoy sin cambio de schema
  (`SCHEMA_CHANGE_REQUIRED=NO` para el diseño de coexistencia
  congelado).
- **`useAuthStore` (`deligo-auth`, localStorage) tiene un único campo
  `user`, compartido cross-tab** — y el listener de
  `realtime-provider.tsx` dispara `logout()` global ante cualquier
  `user:null` sin distinguir actor. Riesgo real (no hipotético): con
  cookies separadas por actor pero sin tocar este store, un logout de
  Negocio en una pestaña cerraría también la sesión de Cliente en las
  demás. Cualquier implementación de same-browser multi-actor
  coexistence DEBE convertir este store en un mapa por actor.
- **Diseño mínimo congelado**: `OPTION_A_ACTOR_FAMILY_SCOPED_SESSION_COOKIES`
  — cookies con nombre por familia de actor (nombres finales no
  decididos), cada API resuelve identidad por la cookie de su propia
  familia, logout aislado por cookie, sin cambio a la validación `sid`
  de P2-T11 (ya opera por fila `Sesion` puntual). Detalle completo en
  `codex-reports/archive/P2-T18-BLOCKER-AUTH1.md`. No implementado —
  ver P2-T18-BLOCKER-AUTH2.
- **El allowlist de 8 archivos congelado en AUTH1 subestimó el radio
  de impacto real de OPTION_A** (descubierto en AUTH2, sin ninguna
  mutación de código): los 4 endpoints compartidos por múltiples
  familias (`/api/auth/me`, `/api/auth/logout`, `/api/realtime/token`,
  `/api/realtime/authorize`) reciben ambas cookies de familia en toda
  request una vez que Cliente y Negocio coexisten (las cookies viajan
  por dominio+path, no por página) — resolver sin ambigüedad exige que
  el caller declare la familia, y los únicos callers reales
  (`src/hooks/use-auth.ts`, `src/lib/realtime-client.ts`,
  `src/lib/realtime-manager.ts`) están fuera del allowlist. Además
  `useAuthStore` es consumido por 26 archivos, sólo 2 en el allowlist.
  Esto NO cuestiona el diseño `OPTION_A` en sí — sólo su
  dimensionamiento de allowlist. Cualquier implementación futura debe
  re-auditar call-sites reales antes de congelar un allowlist final,
  no asumir que el archivo que define un endpoint es el único que
  necesita cambiar.
- **Diseño reconciliado (AUTH2-R1)**: el radio de impacto real de
  `SESSION_COOKIE_NAME` es 89 archivos (≈65 de producto), no 8 ni 26 —
  pero la abrumadora mayoría está bajo un prefijo de path específico
  de familia (`/api/negocio/**`, `/api/repartidor/**`,
  `/api/cliente/**`) y nunca es llamada por otro tipo de actor. Cada
  pestaña de navegador tiene su propia memoria JS/Zustand — sólo
  `localStorage` se comparte por origen — por lo que `useAuthStore.user`
  puede preservar su forma pública sin migrar ninguno de sus 26
  consumidores; sólo la CLAVE de persistencia necesita namespacing por
  familia (derivada de pathname, sin relevancia de seguridad). Del
  lado servidor, un `middleware.ts` nuevo (único, centralizado) puede
  resolver la cookie de familia correcta por prefijo de path o
  selector explícito y presentarla bajo el nombre legacy
  `deligo_session` a los route handlers existentes SIN modificarlos —
  reduciendo el allowlist real a 9 archivos (y sacando `me/route.ts`,
  `realtime/token/route.ts`, `realtime/authorize/route.ts` del
  allowlist original de AUTH1, que ya no requieren cambio). Un
  subconjunto acotado (~10-12 archivos no derivables de path:
  `/api/pedidos/**`, `/api/push/**`, `/api/notificaciones`, etc.) queda
  diferido a una fase separada, sin bloquear el diseño ni introducir
  regresión (el fallback de middleware preserva su comportamiento
  actual). Detalle completo en
  `codex-reports/archive/P2-T18-BLOCKER-AUTH2-R1.md` una vez archivado.
  No implementado — ver P2-T18-BLOCKER-AUTH2-R2 (Fase 1 solamente).
- **`src/proxy.ts` (no `middleware.ts`) es la autoridad de Edge
  Middleware activa de este repo** — hecho arquitectónico descubierto
  a mitad de AUTH2-R2 (después de haber empezado a mutar código —
  ver ANTI_SCOPE_CREEP_COMPLIANCE=FAIL_BEFORE_STOP_DUE_TO_POST_DISCOVERY_MUTATION
  en `codex-reports/CURRENT_TASK.md`), aplicable a cualquier tarea
  futura que necesite tocar el middleware de Next.js: Next.js 16
  (`next@^16.1.1`, instalado) reconoce `proxy.ts`/`src/proxy.ts` como
  nombre de archivo especial exactamente equivalente a
  `middleware.ts`/`src/middleware.ts` (`isMiddlewareFilename`/
  `isMiddlewareFile` en `node_modules/next/dist/build/utils.js`
  aceptan ambos nombres indistintamente). `src/proxy.ts` ya implementa
  CORS, security headers, origin validation, rate-limit hints y
  protección de rutas por rol (`ROLE_PROTECTED_ROUTES`: `/api/cliente`,
  `/api/negocio`, `/api/repartidor`, `/api/superadmin`, este último
  con cookie propia `deligo_superadmin_session`, aislada — 24-A).
  Cualquier diseño futuro que asuma "crear `middleware.ts` nuevo" debe
  verificar primero si `src/proxy.ts` ya cubre ese rol — crear ambos
  archivos a la vez sería incorrecto. **Confirmado con evidencia
  definitiva en AUTH2-R2-R1** (`node_modules/next/dist/build/index.js:605`):
  Next.js 16 **falla el build con un error explícito** ("Both
  middleware file ... and proxy file ... are detected. Please use ...
  only") si ambos coexisten — no es ambigüedad silenciosa, es un hard
  stop documentado por el propio framework.
- **REGLA PERMANENTE — `WOULD_NEW_FACT_HAVE_CHANGED_EXTERNAL_PROMPT`**
  (introducida tras el incidente de P2-T18-BLOCKER-AUTH2-R2): si
  durante CUALQUIER implementación futura se descubre un hecho
  arquitectónico nuevo que, de haberse conocido antes, habría
  cambiado el prompt/diseño/allowlist que autorizó esa tarea —
  ejemplo real: descubrir que `src/proxy.ts` ya existía mientras se
  iba a crear `middleware.ts` — la única acción permitida es
  `IMMEDIATE_HARD_STOP=SI` para pedir reconciliación explícita. Queda
  prohibido de forma permanente: `AUTO_ADAPTATION_ALLOWED=NO`,
  `SAFE_SUBSTITUTION_ALLOWED=NO`, `ALLOWLIST_EXPANSION_ALLOWED=NO`,
  `DESIGN_CORRECTION_DURING_IMPLEMENTATION=NO` —
  `MAX_UNATTENDED_SCOPE_DRIFTS_PER_TASK=0`. No importa cuán obvia,
  segura o técnicamente correcta parezca la sustitución en el
  momento — el criterio de "¿el hecho nuevo habría cambiado el
  prompt externo?" decide, no la corrección técnica del cambio en sí.
  Regla hermana de STOP-ON-OBJECTIVE (detenerse en cuanto la decisión
  PASS/BLOCKED esté tomada) — esta cubre el caso complementario:
  detenerse en cuanto aparece un hecho que invalida la premisa de la
  tarea, incluso a mitad de implementación.
- **Fase 1 de same-browser multi-actor session coexistence — local,
  no commiteada aún (AUTH2-R2-R2)**: implementación completa en
  `src/proxy.ts` (único punto de resolución de familia de actor,
  request-only, nunca DB), `src/lib/auth.ts` (helpers de nombre de
  cookie por familia), `src/app/api/auth/login/route.ts` (escribe sólo
  la cookie de su propia familia), `src/app/api/auth/logout/route.ts`
  (limpia sólo la familia resuelta + revoca sólo esa `Sesion`). El
  header interno `x-resolved-actor-family` se sanea de forma
  **incondicional** en `proxy.ts` antes de decidir si escribir un
  valor de confianza (`SANITIZE_FIRST -> RESOLVE ->
  SET_TRUSTED_IF_VALID`) — ningún valor suministrado por el cliente
  puede sobrevivir ese paso bajo ninguna circunstancia, verificado con
  4 tests adversariales explícitos en `src/proxy.test.ts`. Sin cambio
  de schema, sin cambio de las 11 responsabilidades preexistentes de
  `proxy.ts` (CORS, security headers, origin validation, soft-auth por
  rol, rate-limit hints, logging). **No incluye** activación del lado
  cliente (Fase 2) ni el long-tail diferido (Fase 3) — ver
  `codex-reports/archive/P2-T18-BLOCKER-AUTH2-R1.md` para el
  desglose completo de fases. Pendiente: revisión adversarial
  precommit (`P2-T18-BLOCKER-AUTH2-R3`), luego commit/push/deploy/
  certificación real antes de que F-P2-T18-AUTH01 se marque
  `RESOLVED`.
- **Regla reforzada por AUTH2-R3**: un fix incidental es alcance no
  autorizado incluso cuando es técnicamente correcto y sirve a un
  gate YA autorizado de la misma etapa (ej. `NEW_TSC_ERRORS=0`). La
  corrección de un problema de tipos preexistente en
  `src/proxy.test.ts` (firma de `req()`, ajena a la lógica de
  seguridad) durante AUTH2-R2-R2 se coló silenciosamente dentro de
  "correction path 2" sin señalarse como una categoría de cambio
  distinta — bloqueado en revisión precommit
  (`INCIDENTAL_TSC_CHANGE_CLASSIFICATION=B`) pese a no haber ningún
  hallazgo de seguridad (`R3_SECURITY_MATRIX=16_OF_16_PASS`). El
  criterio correcto: satisfacer un gate ya autorizado no autoriza por
  sí solo CUALQUIER cambio necesario para satisfacerlo — el cambio
  específico debe señalarse explícitamente como alcance adicional en
  el momento en que aparece, no incluirse tácitamente.
- **Cierre de AUTH2-R3-R1 (2026-08-28)**: el bloqueo de AUTH2-R3 se
  resolvió por autorización externa explícita del usuario — no por
  auto-adaptación. El usuario aceptó, como excepción puntual y no
  como precedente general (`THIS_EXCEPTION_CREATES_PRECEDENT=NO`,
  `FUTURE_INCIDENTAL_TSC_FIX_AUTO_ALLOWED=NO`), preservar el único
  hunk de tipos ya existente en `req()` de `src/proxy.test.ts`.
  AUTH2-R3-R1 verificó las 18 condiciones de PASS del prompt de esa
  etapa, incluyendo un contrapunto contrafactual EJECUTADO (repro
  standalone fuera del working tree, node_modules real del proyecto
  vía `paths` de tsconfig) que reprodujo exactamente el error de
  TypeScript (`signal: AbortSignal | null` vs `AbortSignal |
  undefined`) al revertir sólo ese hunk — evidencia ejecutada, no
  narrativa, de que `REVERTING_EXCEPTION_REINTRODUCES_TASK_LOCAL_
  TSC_FAILURE=SI`. Fase 1 (9 paths) queda certificada precommit,
  fingerprint idéntico antes/después, cero mutación de source/test.
  Regla reafirmada: una autorización externa puntual resuelve
  exactamente el hallazgo que cubre — no reabre P2-T11, no expande el
  allowlist de paths, no pre-autoriza ningún hallazgo de tipos
  futuro.
- **Cierre de AUTH2-R4 (2026-08-28)**: el diff de Fase 1 (9 paths) se
  convirtió en un único commit local
  (`c047e9eb67e97ca1b9c1ae78b4c2725f44b02ebb`, parent
  `1adcc01f5380d896bed6e46dcd11bccb90d39e07`, subject
  `feat: add actor-family session cookie foundation`), sin mutar
  source/test durante el empaquetado. Disciplina aplicada: fingerprint
  verificado contra la autoridad certificada de AUTH2-R3-R1 antes de
  tocar nada; tests/lint/tsc/build frescos; re-fingerprint inmediato
  antes de stagear; `git add --` explícito por los 9 nombres exactos
  (nunca `-A`/`.`); auditoría completa del índice (0 extras, sin
  reports, sin root `32`); comparación byte a byte de blobs staged vs.
  working tree certificado; lectura línea por línea del diff cacheado
  completo antes de commitear; un único intento de commit; y
  recertificación posterior directamente desde los objetos Git
  (`git ls-tree HEAD`) — nunca confiando en el staging previo como
  prueba suficiente. Sin push, sin deploy, sin acceso a Railway.
- **Cierre de AUTH2-R5 (2026-08-28)**: recertificación INDEPENDIENTE
  del commit `c047e9eb` — re-derivó fileset y 9 blob IDs desde
  `git diff-tree`/`git ls-tree HEAD` (nunca copiados del reporte de
  R4), leyó los 9 blobs completos vía `git show HEAD:<path>` con hash
  recomputado independientemente (prueba criptográfica), releyó el
  diff completo `HEAD^..HEAD` clasificando cada hunk, y re-derivó la
  matriz de seguridad de 16 casos desde cero — código por código,
  nunca copiando la conclusión de R3/R3-R1 — confirmando entre otras
  cosas por grep que `src/proxy.ts` no tiene ninguna llamada a
  `response.cookies.*`. Durante los tests frescos, un test de
  concurrencia real contra Postgres TESTING
  (`client-block-security.integration.test.ts`, 3 logins
  verdaderamente concurrentes vía `Promise.all` contra un límite de
  infraestructura ya migrado) falló de forma aislada una vez —
  investigado con DOS re-ejecuciones limpias (aislada y de grupo
  completo), sin tocar código entre intentos, confirmando un flake
  transitorio de infraestructura, no una regresión del commit. Regla
  reafirmada: un fallo de test se investiga por reproducibilidad antes
  de clasificarse — ni se ignora silenciosamente, ni se trata como
  bloqueo automático que exige corrección de producto, cuando el
  propio test ejercita una condición de carrera real contra
  infraestructura externa y el código conmiteado no cambió entre
  intentos. Corrigió, exclusivamente como documentación, un bloque de
  marcadores "current" desactualizados en `CODEX_REPORT.md`
  (reflejaban el estado previo al commit de R4) — sin tocar ningún
  marcador histórico de stage/tarea.
- **Cierre de AUTH2-R6 (2026-08-28)**: Fase 1 empujada y certificada en
  TESTING. Regla operativa aplicada estrictamente: la corrida DECISIVA
  de tests prepush se ejecuta UNA sola vez — si hubiera dado distinto
  de 73/73 no se habría reintentado para "conseguir verde" (a
  diferencia de R5, donde una investigación de reproducibilidad SÍ era
  apropiada por tratarse de una revisión post-commit, no de la
  decisión de empujar). Dio 73/73 a la primera, sin necesidad de
  invocar esa cláusula. El push fue exactamente uno, sin `--force`, y
  el commit exacto desplegado (`c047e9eb`) se confirmó leyendo
  `commitHash` de la metadata real de Railway — nunca inferido del
  éxito del push ni del propio `git push`. La certificación runtime se
  hizo con un harness temporal EXTERNO al repo (nunca importó código
  del repo, replicó el algoritmo de hash de contraseñas leyendo las
  constantes exactas del código fuente) hablando directamente con el
  backend REAL desplegado — no con un servidor local — con fixtures
  TESTING aislados y su propio cleanup verificado (0 remanentes). Cada
  verificación de "familia correcta resuelta" comparó el ID/slug EXACTO
  del fixture propio, no sólo "algún login funcionó" — la misma
  disciplina de "no confiar en éxito superficial" aplicada en todas las
  etapas anteriores de esta cadena.
- **Cierre de AUTH2-R7 (2026-08-28)**: revalidación de sólo lectura del
  contrato de Fase 2 (activación cliente) contra el código actual, no
  contra el diseño histórico copiado sin verificar. Dos hallazgos
  materiales, en direcciones opuestas: (1) 3 callers reales de
  `/api/auth/me` (`use-suspension-check.ts`, `login/page.tsx`,
  `auth-modal.tsx`) nunca habían sido detectados por AUTH2/AUTH2-R1 —
  ningún recuento previo de "callers de los 4 endpoints compartidos"
  fue exhaustivo; encontrados por grep repo-wide de `fetch("/api/auth/me"...)`,
  no por confiar en el allowlist histórico. (2) `realtime-manager.ts`
  (incluido en el candidato de 5 desde AUTH1) resulta NO requerir
  ningún cambio — `realtime-client.ts` ya corre en el navegador
  ("use client") y puede derivar la familia de
  `window.location.pathname` por sí mismo, sin que `RealtimeManager`
  necesite reenviar `actor.userType` a través de
  `RealtimeManagerDependencies` (un tipo definido en
  `src/lib/realtime-types.ts`, fuera del allowlist — cambiar su forma
  habría sido una expansión de alcance evitable). Regla reafirmada: un
  allowlist heredado de una etapa de diseño anterior se re-verifica
  contra el código actual, nunca se copia — tanto para ENCONTRAR
  superficie no vista antes como para DESCARTAR superficie que ya no
  hace falta, con la misma exigencia de evidencia en ambos sentidos.
  El selector de familia (`?actorFamily=`) reutiliza exactamente el
  transporte ya certificado en Fase 1 (query param, nunca header) —
  nunca se inventa un mecanismo nuevo cuando uno ya certificado
  resuelve el problema. Cero mutación de código en esta etapa.
- **Cierre de AUTH2-R8 (2026-08-28)**: implementación local de Fase 2
  exactamente dentro del contrato de R7, 7/7 archivos de producto, sin
  octavo path, sin tocar `realtime-manager.ts`/`realtime-types.ts`/Fase
  1 server (verificado byte-idéntico dos veces, antes y después). Un
  defecto propio fue encontrado por el propio proceso de testing, no
  por revisión externa: la primera versión de `activeSessionFamily()`
  usaba `pathname.startsWith("/cliente")` sin boundary-safety —
  `"/clientevil".startsWith("/cliente")` es `true` en JavaScript (no
  hay chequeo de límite de segmento), lo que habría namespaced
  incorrectamente cualquier pathname que empezara con el prefijo sin
  ser realmente esa familia. Corregido al mismo patrón boundary-safe
  ya certificado server-side en `pathFamily()`
  (`pathname === prefix || pathname.startsWith(prefix + "/")`) — regla
  reafirmada: cuando dos partes del sistema (cliente y servidor)
  implementan el mismo concepto (aquí, "resolución de familia por
  prefijo de ruta"), deben usar EXACTAMENTE el mismo patrón de
  comparación, nunca una aproximación "similar mirada rápido". La
  corrección se hizo dentro del mismo archivo ya autorizado, sin
  expandir el allowlist ni activar la regla de nuevo-hecho — es
  exactamente el tipo de hallazgo que el propio proceso de escribir
  tests antes de cerrar una etapa está diseñado para atrapar.
- **Cierre de AUTH2-R9 (2026-08-28)**: "130/130 tests PASS" (la propia
  certificación de R8) no es prueba de ausencia de gaps de cobertura —
  sólo prueba que los tests existentes pasan contra el código
  existente, nunca que detectarían una regresión futura plausible.
  Mutation testing aislado (12 mutantes fuera del repo, nunca tocando
  el repositorio real) expuso exactamente esa distinción: 2/12
  mutantes sobrevivieron pese a que el código real es correcto — no
  porque el producto tuviera un defecto, sino porque la batería de
  test tiene dos puntos ciegos reales (el camino de rehidratación/
  `getItem` nunca se ejercita directamente; un contrato estático
  basado en `toContain`/`toMatch` detecta PRESENCIA de un patrón
  correcto pero no AUSENCIA de una condición adicional insertada en
  otro lugar del mismo bloque — `STATIC_STRING_ONLY_WEAKNESS`, una
  debilidad estructural inherente a esa técnica de test, no un error
  puntual). Regla reafirmada explícitamente por el propio prompt de la
  etapa y aplicada sin excepción: un mutante sobreviviente bloquea la
  etapa salvo prueba independiente de que el arnés de mutación es
  inválido — y una etapa de revisión adversarial NUNCA corrige el test
  que encontró el gap, por más trivial que parezca la corrección;
  corregir "de paso" durante una revisión que se supone read-only
  contaminaría la separación entre "quien encuentra el defecto" y
  "quien lo corrige", que es exactamente el propósito de tener una
  etapa de revisión adversarial separada de la etapa de implementación.
  El follow-up (R9-R1) queda acotado a exactamente esas dos piezas de
  test, sin abrir la puerta a ningún cambio de código de producción —
  el código ya fue verificado correcto por lectura directa del diff,
  dos veces, en R9.
- **Cierre de AUTH2-R9-R1 (2026-08-28)**: un gap de cobertura de test
  se cierra agregando cobertura que ejercite el camino REAL que faltaba
  (para el mutante #5, eso significó forzar una rehidratación
  verdadera vía `useAuthStore.persist.rehydrate()`, no inventar un
  mock del storage adapter) — nunca reescribiendo una assertion
  existente para que "pase distinto". La assertion #2 original de
  `realtime-provider-cross-tab-static-contract.test.ts`, con su
  debilidad estructural ya documentada en R9, se dejó intacta; el
  fortalecimiento se hizo agregando un test nuevo que aísla la línea
  exacta del guard y prueba AUSENCIA de una cláusula adicional — la
  debilidad de la assertion #2 sigue siendo real (sigue sin detectar
  el mutante #12 por sí sola), simplemente queda compensada por un
  test distinto con una técnica distinta (comparación exacta de línea
  en vez de `toContain`/`toMatch`). Reafirma que "cerrar un gap de
  cobertura" no significa "hacer que la técnica de test original deje
  de tener el punto ciego" — significa "agregar una prueba que sí lo
  cubra", que pueden ser cosas distintas.
- **El propio arnés de mutation testing puede tener bugs, y esos bugs
  se investigan y corrigen dentro del proceso, nunca se confunden con
  un hallazgo real** (AUTH2-R9-R1): Python en modo texto sin
  `newline=''`, al escribir en Windows, normaliza TODOS los saltos de
  línea de un archivo a CRLF — esto rompió, en el espejo aislado de
  mutation testing (nunca en el repo real), una búsqueda de substring
  multilínea sensible a saltos de línea, produciendo un fallo de test
  que no tenía relación con el mutante que se estaba probando en ese
  momento. Se detectó por conteo directo de bytes `\r` (no se asumió
  "está bien, dio fail igual"), se corrigió preservando bytes exactos
  (`newline=''` en lectura y escritura), y se confirmó que la
  corrección no alteró la fidelidad del harness re-aplicando el
  mutante afectado y comparando el conteo de fallos contra el que R9
  había documentado originalmente (coincidió exacto). Regla: cualquier
  herramienta de verificación (harness de mutación, script de
  contrafactual, arnés de fixtures) es en sí misma sujeta a error, y un
  resultado inesperado de la herramienta se investiga por causa raíz
  antes de aceptarse como señal — la misma disciplina que ya se aplica
  a un fallo de test contra infraestructura externa real.
- **Cierre de AUTH2-R10 (2026-08-28)**: convertir un diff ya
  precommit-certificado (dos veces: R9 adversarialmente, R9-R1 con
  mutation testing) en un commit exacto no requiere repetir toda la
  evidencia desde cero — requiere PROBAR que nada cambió desde la
  última certificación (fingerprint byte-a-byte 11/11 idéntico) y
  luego re-ejercer sólo las partes de la autoridad que SÍ tienen
  sentido repetir en esta etapa (una corrida decisiva fresca de tests,
  lint/TSC/build). Repetir un arnés de mutation testing completo de 12
  mutantes cuando el fingerprint ya prueba bytes idénticos habría sido
  trabajo redundante, no rigor adicional — la etapa lo permitió
  explícitamente ("no rerun unless needed to verify identity"), y la
  combinación fingerprint+tests-frescos ya cumplía ese propósito. Regla
  reafirmada: la profundidad de re-verificación en cada etapa debe ser
  proporcional a lo que esa etapa puede cambiar, no un ritual fijo
  repetido sin importar qué ya está probado.
- **Cierre de AUTH2-R11 (2026-08-28)**: recertificar un commit "desde
  los objetos Git" significa literalmente eso — derivar el fileset con
  `git diff-tree`/`git show --name-only`, los blobs con `git ls-tree
  HEAD`, y el contenido con `git show HEAD:<path>`, nunca confiar en
  que "el working tree ya lo prueba" aunque coincidan. La diferencia
  no es cosmética: el working tree puede divergir del commit por
  edición posterior sin que nadie lo note, mientras que los objetos
  Git son la única fuente que un `git push` real transmite. Cuando la
  identidad de bytes ya está probada (blob committed == blob staged ==
  blob certificado en la etapa anterior), no hace falta releer el
  mismo texto una tercera vez para "estar más seguro" — pero si hace
  falta re-derivar el resultado semántico (p. ej. boundary-safety),
  eso se hace ejecutando el código EXACTO tal como aparece en el blob
  (copiado de `git show`, no del working tree ni de memoria del
  diseño), para que la prueba sea sobre lo que realmente se va a
  pushear, no sobre una aproximación. Reafirma también que "R11 no
  otorga un push futuro ciego" — una recertificación exitosa hoy no
  exime a la etapa que efectivamente pushea de repetir sus propios
  gates decisivos frescos, porque el estado del repo remoto/CI puede
  cambiar entre una etapa y la siguiente.
- **Cierre de AUTH2-R12 (2026-08-28)**: un smoke de regresión
  post-deploy no necesita explicar cada código de estado HTTP que no
  sea el esperado — sólo necesita distinguir "esto es un 5xx/fuga de
  sesión/fallback cruzado" (señal real de regresión) de "esto es un
  comportamiento de seguridad preexistente y ortogonal al cambio que
  se está certificando" (ruido). El `403` de `POST /api/auth/logout`
  sin cookie (protección CSRF/origin del propio endpoint) es del
  segundo tipo — se registró explícitamente en el reporte con su
  explicación, en vez de omitirlo o de perseguirlo como si fuera un
  hallazgo. Regla reafirmada: un dato que no encaja en "PASS trivial"
  se documenta con su explicación, no se descarta en silencio ni se
  convierte en una investigación fuera de alcance.
- **`commitHash` siempre se lee del JSON completo, nunca del resumen
  corto** (AUTH2-R12): `railway status` (vista corta) puede mostrar un
  `deployment ID` que corresponde a un estado ya superado, mientras
  que `railway status --json` expone el `latestDeployment` real y
  actualizado — el polling de esta etapa observó exactamente esa
  transición (`BUILDING`→`DEPLOYING`→`SUCCESS`, con el `id` del
  deployment cambiando en el camino). La verificación de "qué se
  desplegó realmente" siempre se hace leyendo `commitHash` del JSON
  completo, nunca inferido de que el `git push` haya terminado sin
  error ni de la vista resumida — misma disciplina de "no confiar en
  éxito superficial" ya aplicada desde AUTH2-R6 para Fase 1, ahora
  reconfirmada para Fase 2.
- **Cierre de AUTH2-R13 (2026-08-28)**: la única forma válida de
  certificar coexistencia real de sesión multi-actor es forzar la
  situación exacta que el diseño promete resolver — dos logins reales,
  de familias distintas, en el mismo navegador/perfil/origin, sin
  ningún atajo sintético (`dispatchEvent(new StorageEvent(...))`,
  forzado manual de DOM, dos perfiles de navegador separados en vez de
  uno). Esa disciplina fue lo que permitió que el defecto de
  `AUTH_REQUIRED_PREFIXES` (F-P2-T18-AUTH02) emergiera en absoluto: un
  test unitario mockeado, o una prueba en dos navegadores separados,
  jamás habría producido 2 cookies de familia simultáneas en el mismo
  jar de cookies del navegador real, condición exacta que dispara el
  fallback ambiguo de `resolveActorSession()`. Regla reafirmada: la
  autenticidad del escenario de prueba no es un detalle procedimental
  — es la única vía por la que un defecto de esta clase (invisible a
  cualquier nivel de test aislado) puede siquiera manifestarse.
- **Regla de "no corregir bajo evidencia real de defecto" aplicada
  literalmente en AUTH2-R13**: al confirmar la causa raíz del 401 bajo
  coexistencia (lectura directa de `src/proxy.ts` y de los 4 route
  handlers afectados), la etapa tenía toda la información necesaria
  para escribir la corrección en el acto — y explícitamente no lo
  hizo. La regla de la etapa ("si aparece un defecto real, preservar
  evidencia, limpiar fixtures, reportar BLOCKED, definir un único
  follow-up aislado — NO corregir") se siguió al pie de la letra
  aunque la corrección candidata ya era obvia por el propio análisis.
  Motivo: una corrección aplicada dentro de una etapa de CERTIFICACIÓN
  contamina la separación entre "encontrar" y "arreglar" que sostiene
  la trazabilidad de todo este workflow — permite que un hallazgo se
  resuelva sin su propio ciclo de revisión adversarial/precommit/
  postcommit, exactamente el atajo que este proceso existe para
  prevenir. `P2-T18-BLOCKER-AUTH2-R13-R1` hereda esa corrección como
  tarea propia, con su propio ciclo completo.
- **Un defecto fail-closed no es un defecto de seguridad, aunque rompa
  funcionalidad real (F-P2-T18-AUTH02)**: el hallazgo de AUTH2-R13
  nunca permitió que un actor leyera datos de otro, ni autorizó nada
  incorrectamente — el peor caso observado fue una función rota (401)
  para ambos actores simultáneamente. Se clasificó explícitamente como
  `SEVERITY=FUNCIONAL`, no como una regresión de seguridad, y no se le
  aplicó ninguna urgencia de "vulnerabilidad" que no le correspondía —
  aunque sigue bloqueando el cierre de F-P2-T18-AUTH01 como hallazgo
  funcional legítimo por derecho propio.
- **Cierre de AUTH2-R13-R1 (2026-08-28)**: "reconciliar antes de
  implementar" no es un ritual burocrático — encontró un hecho
  material que el propio hallazgo de R13 no había capturado
  (`/api/push/status`, afectado por el mismo mecanismo aunque fuera de
  `AUTH_REQUIRED_PREFIXES`) precisamente porque esta etapa releyó
  `src/proxy.ts` completo en vez de asumir que la lista
  `AUTH_REQUIRED_PREFIXES` era el límite exacto del defecto. El
  mecanismo real (rewrite de cookie incondicional a esa lista,
  dependiente sólo de `resolved.token`) es más amplio que la lista que
  originalmente lo disparó — regla reafirmada: cuando una etapa de
  reconciliación tiene la oportunidad de releer el código fuente en
  vez de heredar la caracterización de la etapa anterior, debe
  hacerlo, incluso si la caracterización anterior parece suficiente.
- **La fuente de "verdad de familia activa" no es un mecanismo único
  y universal — es una decisión por caller (AUTH2-R13-R1)**: R7 había
  congelado `activeSessionFamily(window.location.pathname)` como la
  fuente para los 4 endpoints originales, y habría sido tentador
  reutilizar ese mismo mecanismo para los 6 callers nuevos "porque ya
  está certificado". Esta etapa demostró por qué eso habría sido
  incorrecto: `ChatFab`/`ChatSheet`/`PermissionPrompt` están montados
  en el ROOT layout (`src/app/layout.tsx`), activos en cualquier ruta
  de la app — el pathname en el momento de sus fetches puede no
  empezar con `/cliente` ni `/negocio` en absoluto, a diferencia de
  las páginas family-scoped donde vive el caso original de
  `/api/auth/me`. La fuente correcta ahí es
  `useAuthStore().user?.type`, ya disponible sin problema de bootstrap
  porque estos callers sólo se disparan cuando el actor ya está
  autenticado. Regla: un patrón ya certificado para un conjunto de
  callers no se copia automáticamente a un conjunto nuevo sin
  verificar que las precondiciones que lo hacían correcto (aquí:
  "el pathname en el momento de la llamada siempre tiene el prefijo de
  familia") siguen siendo ciertas en el nuevo contexto.
- **Un fix "aislado" puede ampliar su propio inventario de endpoints
  sin dejar de ser aislado, si la ampliación comparte la misma causa
  raíz (AUTH2-R13-R1)**: agregar `/api/push/status` al alcance del fix
  no violó la instrucción de "corrección focal única y aislada" — el
  criterio no es "tocar el menor número de archivos posible a toda
  costa", sino "resolver genuinamente la causa raíz sin introducir un
  segundo problema estructural". Dejar `/api/push/status` fuera habría
  producido un fix incompleto que R13-replay habría vuelto a bloquear
  por el mismo mecanismo. Regla: el criterio de alcance de un fix
  aislado es la causa raíz, no el conteo de archivos.
- **Cierre de AUTH2-R13-R2 (2026-08-28)**: "recuperar el contrato
  verbatim antes de mutar" no es una formalidad — permitió detectar,
  antes de escribir el primer byte, que 3 de los 7 nombres de test
  nuevos congelados por R13-R1 estaban explícitamente marcados
  "tentativo". La resolución correcta no fue tratar eso como una
  ambigüedad que bloquea (STOP), sino reconocer que R13-R1 ya había
  delegado esa decisión mecánica a esta etapa por diseño — se usaron
  los nombres tal como estaban propuestos, siguiendo la convención ya
  establecida en el propio directorio (`chat-sheet.test.tsx`). Regla:
  distinguir una ambigüedad real (bloqueante) de una decisión mecánica
  explícitamente delegada (no bloqueante) evita un STOP innecesario
  sin violar la disciplina de "no inventar sustitutos".
- **Un archivo de test con aserciones sobre literales exactos de
  código se rompe silenciosamente cuando el código cambia — corregir
  esas aserciones para que reflejen el código nuevo no es "debilitar
  el test" (AUTH2-R13-R2)**: 3 de los 4 archivos de test existentes
  modificados en esta etapa contenían `toContain()`/`indexOf()` sobre
  substrings exactos (`fetch("/api/push/status"`, conteo de
  ocurrencias de una URL, límites de un `.slice()` anclados a
  `}, [isMozo])`) que dejaron de existir tras el cambio — no por un
  error, sino porque el propio código legítimamente cambió de forma.
  La disciplina correcta no es "dejar el test roto para no tocar
  nada" ni "borrar la aserción" — es actualizar el literal al texto
  exacto nuevo, preservando el mismo rigor y la misma intención
  (demostrado en esta etapa: cada aserción actualizada mantuvo o
  aumentó su precisión, nunca la redujo). `ASSERTION_WEAKENING_FOUND=NO`
  se verificó explícitamente, no se asumió.
- **Mezcla de fin de línea (CRLF/LF) dentro de un mismo archivo es un
  riesgo real para tests "static-contract" basados en substring
  (AUTH2-R13-R2)**: el 100% de los 7 archivos de producto de este
  fix usan CRLF en disco, pero las herramientas de edición insertaron
  algunos bloques nuevos con LF puro — produciendo una mezcla dentro
  del mismo archivo. Una aserción `toContain()` multi-línea que
  incluye `\n` literal es sensible a esta mezcla y puede fallar sin
  que el código esté mal — descubierto empíricamente (2 de 7 tests
  focales fallaron en la primera corrida por esto, no por un error de
  lógica). Fix aplicado: normalizar `\r\n` → `\n` en el propio helper
  de lectura de fuente de cada test static-contract, en vez de intentar
  forzar una convención de fin de línea uniforme en el código fuente
  (fuera de alcance, no lint-enforced en este repo). Regla: cualquier
  test static-contract con aserciones multi-línea debe normalizar el
  fin de línea de la fuente que lee, nunca asumir un único estilo.
- **Un test static-contract que verifica la DECLARACIÓN de una
  variable no prueba que esa variable sea realmente CONSUMIDA
  (AUTH2-R13-R3, hallazgo M9)**: `use-push-notifications-static-contract.test.ts`
  verificaba `const subscribeUrl = actorType ? ... : ...` como
  substring del archivo, pero nunca `fetch(subscribeUrl` — un producto
  mutado para que el `fetch()` real usara un literal bare (dejando la
  declaración como variable muerta) habría pasado ese test sin
  detección. La campaña de mutación (no la sola lectura de código) fue
  lo que reveló esto — la asimetría con `unsubscribeUrl` (que SÍ tenía
  la verificación de consumo) no era visible por inspección casual del
  texto del test, sólo intentando activamente "romper" cada call site
  uno por uno. Regla: en un test static-contract, cada variable que
  transporta un valor de seguridad/autorización necesita DOS
  aserciones, no una — que la declaración tenga la forma correcta, Y
  que el call site real (`fetch(`, `await x(`, etc.) consuma esa
  variable por nombre, nunca sólo uno de los dos.
- **Un mutante sin ningún test que lo detecte no es automáticamente un
  hallazgo — primero hay que probar que el mutante es observable
  (AUTH2-R13-R3, `/api/chat/cleanup` agregado por error al selector)**:
  antes de clasificar una mutación sobreviviente como gap de
  cobertura, se trazó el flujo completo de `checkRouteProtection()`
  para confirmar que el cambio no tiene NINGÚN efecto sobre el
  comportamiento observable de ningún endpoint real (el paso de rutas
  públicas aprueba `cleanup` antes de que el selector importe, y su
  handler nunca lee la cookie resuelta). Sin esa verificación, se
  habría gastado esfuerzo "corrigiendo" un test para detectar algo que
  no tiene ninguna consecuencia — el mutante equivalente clásico de la
  literatura de mutation testing. Regla: `MUTANTE SOBREVIVE` no es lo
  mismo que `GAP REAL` — siempre verificar primero si el mutante
  cambia algún comportamiento observable antes de exigir una
  corrección de test.
- **BLOCK por gap de cobertura de test no degrada el PASS del producto
  ya certificado (AUTH2-R13-R3)**: encontrar que `subscribe` carecía
  de una aserción de consumo NO puso en duda que
  `use-push-notifications.ts` estuviera bien implementado — se
  reconfirmó por lectura directa del diff (ya releído en la misma
  etapa) que el código real SÍ usa `fetch(subscribeUrl, {`. Por eso
  `P2_T18_BLOCKER_AUTH2_R13_R2=PASS_AUTH02_FOCUSED_LOCAL_IMPLEMENTATION`
  se preservó explícitamente sin degradar, mientras
  `P2_T18_BLOCKER_AUTH2_R13_R3=BLOCKED_...` refleja únicamente que la
  PROTECCIÓN contra una futura regresión de ese mismo call site era
  insuficiente. Regla: un BLOCK de `TEST_COVERAGE_GAP` es sobre la red
  de seguridad, no sobre el producto que esa red protege — ambos
  juicios se registran y preservan por separado, nunca se funden en
  un solo veredicto binario.
- **Reproducir el mutante ANTES de tocar el test evita "arreglar" un
  gap que ya no existe (AUTH2-R13-R3-R1)**: antes de editar
  `use-push-notifications-static-contract.test.ts`, se replicó
  exactamente la mutación M9 de R13-R3 en un harness externo y se
  confirmó que sobrevivía contra el test SIN corregir (29 pass/0
  fail) — sólo entonces se agregó la assertion. Sin ese paso previo,
  un drift silencioso entre lo que R13-R3 reportó y el estado real del
  archivo (por ejemplo si alguien ya hubiera tocado el test entre
  etapas) podría haber llevado a agregar una aserción redundante o,
  peor, a no notar que el gap ya no aplicaba. Regla: en una corrección
  de cobertura de test derivada de un hallazgo de otra etapa, siempre
  reproducir el fallo original antes de aplicar el fix — nunca confiar
  ciegamente en el reporte previo como sustituto de la evidencia
  fresca.
- **Cerrar un gap de test no reabre ni sustituye la revisión adversarial
  completa (AUTH2-R13-R3-R1)**: agregar la única aserción faltante y
  confirmar que detecta el mutante M9 replicado NO equivale a
  re-certificar el diff completo de AUTH02 — R13-R3 sigue registrado
  históricamente como `BLOCKED`, y se definió explícitamente
  `P2-T18-BLOCKER-AUTH2-R13-R3-RETRY` como una repetición COMPLETA
  desde cero (no una continuación) antes de autorizar el commit local
  (R13-R4). Regla: una corrección focal de un hallazgo aislado nunca
  se autocertifica como suficiente para levantar el BLOCK de la etapa
  adversarial que lo originó — esa etapa debe repetirse íntegra para
  producir su propio veredicto fresco.
- **Cerrar un gap de cobertura conocido no garantiza que no exista un
  gap ANÁLOGO en otro call site — la "fuerza de test desde cero" debe
  cubrir los 11 call sites, no sólo re-verificar el que ya se sabe que
  falló (AUTH2-R13-R3-RETRY)**: R13-R3 encontró que
  `use-push-notifications.ts`'s `subscribe()` declaraba `subscribeUrl`
  sin que ningún test verificara su consumo real (`fetch(subscribeUrl`).
  R13-R3-R1 cerró exactamente ese gap. Pero `permission-prompt.tsx`
  tiene una función (`savePushSubscription`) con la MISMA forma
  exacta (`const url = family ? ... : "..."` seguido de `fetch(url, {`)
  y el mismo tipo de gap — nunca detectado porque los 19 mutantes
  originales de R13-R3, al atacar `permission-prompt.tsx`, sólo
  probaron el CALLER (¿pasa el argumento correcto?), nunca la
  consumición INTERNA de la función llamada. Sólo se descubrió porque
  la revisión de fuerza de test del retry clasificó explícitamente
  cada uno de los 11 call sites por separado (declaración-vs-consumo),
  en vez de asumir que "arreglar M9" bastaba. Regla: cuando se
  encuentra un patrón de gap de cobertura en un call site, buscar
  activamente ese MISMO patrón en los demás call sites de forma
  estructural (misma forma de código = mismo riesgo de gap) — no basta
  con re-probar el caso ya conocido.
- **Un mutante fiel a la definición original debe preservar TODO lo
  que la mutación original no tocaba — mutar de más invalida la
  prueba (AUTH2-R13-R3-RETRY)**: el primer intento de replicar el
  nuevo mutante candidato (`savePushSubscription`'s `fetch(url`)
  eliminó por error tanto la declaración de `url` como su consumo en
  una sola sustitución de texto — y ese mutante SÍ fue detectado, pero
  por una razón distinta (declaración ausente), no por la razón que se
  quería probar (consumo ausente con declaración intacta). Sólo tras
  notar la discrepancia se corrigió el mutante para tocar
  EXCLUSIVAMENTE la línea de consumo, dejando la declaración
  bit-a-bit intacta — y ese mutante correctamente aislado sí
  sobrevivió, revelando el gap real. Regla: al diseñar un mutante,
  verificar que cambia exactamente UNA cosa (la propiedad que se
  quiere probar) — un mutante que cambia dos cosas a la vez puede dar
  un falso negativo de "está protegido" cuando en realidad sólo una de
  las dos mutaciones fue detectada.
- **Cerrar dos gaps aislados seguidos (M9, luego M19-NEW) sin nunca
  fundir ambas correcciones en un solo veredicto (AUTH2-R13-R3-RETRY-R1)**:
  R13-R3-RETRY encontró que la corrección de M9 (R13-R3-R1) era
  genuina Y que existía un SEGUNDO gap distinto (`savePushSubscription`
  en `permission-prompt.tsx`). R13-R3-RETRY-R1 corrigió exclusivamente
  el segundo, sin tocar el archivo de test de M9 ni reabrir esa
  corrección — confirmado explícitamente por fingerprint
  (`M9_TARGET_TEST_CHANGED_BY_RETRY_R1=NO`). Regla: cuando una etapa
  adversarial encuentra múltiples hallazgos independientes en
  secuencia, cada corrección focal debe tocar EXCLUSIVAMENTE su propio
  gap — nunca asumir que "ya que estoy corrigiendo cobertura de test"
  es licencia para revisar o retocar una corrección anterior ya
  cerrada, aunque esté en el mismo archivo o sea del mismo tipo de
  hallazgo.
- **Un marcador "current" sin calificar puede quedar desactualizado
  silenciosamente por varias etapas si ningún prompt lo señala
  explícitamente — verificar el header completo, no sólo la sección
  que se espera tocar (AUTH2-R13-R3-RETRY-R1)**: el marcador `P2_T18=`
  en el header de `CODEX_REPORT.md` quedó congelado en el estado de
  R13-R3 (nunca actualizado a R13-R3-RETRY ni R13-R3-R1) porque las
  ediciones de esas dos etapas usaron un `old_string` que coincidía
  con el bloque `## Next` de más abajo pero no con esta ocurrencia
  específica del header — un `replace_all` sobre un valor que ya no
  coincidía con lo que realmente había en esa línea. Sólo se detectó
  al re-grepear TODAS las ocurrencias de `^P2_T18=` en la etapa
  siguiente. Regla: al reconciliar un marcador "current" repetido en
  varios bloques del mismo archivo, verificar con un grep global
  cuántas ocurrencias existen y su texto EXACTO antes de asumir que un
  único `replace_all` las cubrió todas — un texto ligeramente distinto
  al esperado (por drift de una etapa anterior) hace que la
  sustitución silenciosamente no aplique donde más importa.
- **"No retry-to-green" en un gate decisivo obliga a distinguir el
  veredicto del diff bajo revisión del veredicto del gate mismo
  (AUTH2-R13-R3-RETRY-2)**: la certificación final de AUTH02 (11/11
  cobertura, 20 mutantes con 19/19 no-equivalentes detectados, 0
  sobrevivientes válidos, matrices 20/20 y 12/12, focal 117/117) quedó
  completamente verde — pero la corrida decisiva de regresión (294
  tests, 3 tandas) encontró 1 fallo en un archivo completamente ajeno
  (`client-block-security.integration.test.ts`, dominio de
  auto-bloqueo por dispositivo compartido, sin relación textual ni
  funcional con el selector `actorFamily`). La regla explícita de la
  etapa prohibía re-ejecutar para confirmar si era un flake (pese a
  tener precedente documentado del mismo síntoma en el mismo archivo,
  en `P2-T18-BLOCKER-AUTH2-R5`). El reporte final documentó con
  precisión CUÁLES de las ~15 dimensiones certificadas seguían verdes
  y cuál fue la única causa del BLOCK — evitando dos errores opuestos:
  (a) declarar PASS ignorando la regla del gate porque "el fallo no es
  de AUTH02", o (b) declarar todo el diff de AUTH02 sospechoso porque
  "algo falló en la misma corrida". Regla: cuando un gate estricto
  bloquea por un fallo ajeno al objeto real de la certificación, el
  reporte debe separar explícitamente "qué se certificó verde" de
  "por qué се bloqueó" — nunca fundir ambos en un solo estado binario
  que oscurezca cuánto trabajo de verificación ya es sólido.
- **Un archivo de test con precedente documentado de flake no se
  descarta a priori sin evidencia fresca — se anota como hipótesis, no
  como conclusión (AUTH2-R13-R3-RETRY-2)**: aunque la coincidencia con
  el precedente de R5 (mismo archivo, mismo tipo de síntoma: fallo
  aislado en una corrida multi-archivo contra Postgres real) es fuerte
  evidencia circunstancial, el reporte la registró explícitamente como
  "clasificación preliminar, no confirmada (ningún re-run permitido)"
  — nunca como un hecho establecido. La clasificación definitiva
  (flake vs. regresión real) se delegó explícitamente a la tarea de
  seguimiento aislada, que sí tiene permiso de investigar. Regla: la
  prohibición de "retry-to-green" no impide anotar una hipótesis
  razonada con su evidencia — sólo impide tratarla como conclusión sin
  la investigación que la etapa actual tiene prohibido hacer.
- **"Ajeno al diff" no es lo mismo que "estructuralmente inalcanzable"
  — la segunda afirmación necesita evidencia de código, no sólo de
  fileset (AUTH2-R13-R3-RETRY-2-R1)**: la etapa anterior (RETRY-2)
  clasificó el fallo de `client-block-security.integration.test.ts`
  como "ajeno a AUTH02" principalmente porque el archivo está fuera
  del allowlist de 14 paths. Esta etapa fue más allá y demostró por
  qué es estructuralmente imposible que AUTH02 haya causado el fallo:
  el test llama al route handler `/api/pedidos` DIRECTAMENTE como
  función importada (nunca hace una petición HTTP real), así que
  `src/proxy.ts` — el único archivo de AUTH02 con alcance global —
  nunca se ejecuta en absoluto durante este test. Esa es una prueba
  categóricamente más fuerte que "está fuera del allowlist" (que sólo
  demuestra que el archivo no fue TOCADO, no que sea INALCANZABLE por
  el código que sí se tocó). Regla: cuando un fallo de regresión toca
  un archivo fuera del diff pero el diff incluye un componente de
  alcance global (middleware, proxy, un hook usado ampliamente), no
  basta con señalar que el archivo no cambió — hay que trazar si el
  código SÍ ejecuta el camino cambiado, aunque sea indirectamente.
- **Comparar contra un precedente histórico exige descomponerlo en sus
  partes verificables, no aceptarlo como un solo hecho binario
  (AUTH2-R13-R3-RETRY-2-R1)**: el prompt de esta etapa advirtió
  explícitamente no asumir "mismo archivo = mismo flake" respecto del
  precedente de R5. Se construyó una tabla de atributos independientes
  (test title, código de error Prisma, mecanismo de concurrencia,
  tabla DB, constraint único objetivo) y se encontró que sólo 1 de 6
  atributos coincidía (el archivo) — los demás eran distintos o no
  comparables. El resultado (`R5_SAME_FILE=SI` pero
  `R5_SAME_ROOT_CAUSE_PROVEN=NO`) evitó tanto sobre-confiar en el
  precedente como descartarlo — la coincidencia de archivo sigue
  siendo evidencia circunstancial legítima (ambos son fallos DB-layer
  no reproducibles en el mismo archivo de integración), sólo que no
  prueba causa raíz idéntica. Regla: al invocar un precedente, listar
  explícitamente qué atributos concretos coinciden y cuáles no — la
  fuerza de la analogía es proporcional a cuántos atributos
  independientes coinciden, no a la coincidencia de un solo campo
  llamativo (el nombre del archivo).
- **Un presupuesto diagnóstico fijo puede terminar en una clasificación
  "inconcluyente" incluso con evidencia circunstancial fuerte —  eso
  es preferible a forzar una clasificación limpia que la matriz de
  interpretación no autoriza (AUTH2-R13-R3-RETRY-2-R1)**: de las 3
  corridas diagnósticas permitidas, 1 falló (con un código de error de
  transacción Prisma y latencia anómala — evidencia fuerte de
  inestabilidad transitoria) y 2 pasaron limpio con el mismo código
  exacto. La tentación honesta habría sido "2 de 3 pasan, y el que
  falló tiene toda la pinta de un flake — llamémoslo transient flake y
  sigamos" — pero la matriz de interpretación del prompt exige
  ESTRICTAMENTE que los 3 diagnósticos pasen para esa clasificación.
  Se reportó la clasificación más débil que la evidencia
  estrictamente sostiene (`INCONCLUSIVE`), documentando por separado
  la hipótesis más fuerte (inestabilidad transitoria de DB) sin
  convertirla en el veredicto oficial. Regla: cuando una matriz de
  clasificación formal exige una condición estricta (ej. "los tres
  deben pasar") y la evidencia real es mixta, reportar la categoría
  que la evidencia literalmente sostiene — nunca "redondear hacia
  arriba" a la clasificación más conveniente aunque el peso
  circunstancial la favorezca.
- **"No retry-to-green" en una etapa de certificación se cumple al
  detenerse en el primer fallo, incluso cuando la evidencia
  circunstancial ya apunta a un patrón conocido (AUTH2-R13-R3-RETRY-2-R2)**:
  esta etapa era explícitamente de CERTIFICACIÓN (no diagnóstico) tras
  una clasificación previa de `INCONCLUSIVE_EXTERNAL_DB_INSTABILITY`.
  Cuando la primera corrida de TANDA_2 falló de nuevo en el MISMO caso
  exacto con una latencia igualmente anómala, la tentación habría sido
  "esto ya lo vimos, seguro es el mismo flake, dejame confirmar
  corriendo una vez más antes de rendirme" — exactamente el patrón que
  la regla prohibía. Se detuvo de inmediato sin ninguna corrida
  adicional, sin aislar el test, sin re-investigar — tal como exigía
  el prompt explícitamente en su §4/§15. Regla: cuando una tarea se
  define a sí misma como "certificación, no diagnóstico" con un límite
  estricto de una corrida por capa, ese límite se respeta aunque el
  resultado sea sorprendentemente similar a un patrón ya visto — la
  tentación de "una corrida más para confirmar" es precisamente lo que
  la regla existe para prevenir.
- **Dos fallos consecutivos del mismo caso en dos intentos de
  certificación distintos no confirman la causa raíz por sí solos —
  son evidencia adicional, no prueba (AUTH2-R13-R3-RETRY-2-R2)**: el
  reporte final documentó explícitamente que el segundo fallo (mismo
  test, mismo síntoma, latencia igualmente anómala) es "evidencia
  adicional consistente con la hipótesis de inestabilidad transitoria"
  — sin reescribir la clasificación `INCONCLUSIVE` de R1 a
  `TRANSIENT_DB_TEST_FLAKE` confirmado. Regla: acumular observaciones
  compatibles con una hipótesis fortalece la confianza en ella, pero
  no la convierte automáticamente en la clasificación oficial si la
  etapa que la estableció definió una regla de evidencia estricta que
  esta etapa no repitió ni tenía mandato de repetir — cada etapa
  reporta sólo lo que ELLA demostró, remitiendo la reclasificación a
  quien tenga la autoridad y el mandato explícito de hacerla.
- **Un fallo AISLADO (sin ningún otro proceso/archivo concurrente) es
  la evidencia más fuerte para descartar contención como causa
  necesaria (AUTH2-R13-R3-RETRY-2-R2-R1)**: D1 de R13-R3-RETRY-2-R1
  corrió el caso SEC-BLOCK-1 completamente solo — sin los otros 2
  archivos de TANDA_2, sin ningún otro test — y aun así reprodujo el
  mismo P2028 con latencia anómala. Esa única corrida aislada pesó más
  en la disposición final que las dos corridas agrupadas que pasaron
  limpio (D2/D3): si la causa fuera contención entre archivos del
  propio suite, el caso aislado debería haber sido el más seguro de
  todos, no el que falló primero. Regla: al distinguir "nuestra propia
  estrategia de ejecución" de "el entorno externo" como causa, la
  corrida más aislada posible es la que más información aporta —
  búsquenla en el historial disponible antes de proponer cualquier
  cambio a la topología de ejecución del propio suite.
- **Documentación/instrumentación YA EXISTENTE en el repo puede ser
  evidencia legítima sin ejecutar nada nuevo (AUTH2-R13-R3-RETRY-2-R2-R1)**:
  esta etapa era estrictamente read-only (prohibido ejecutar tests),
  pero encontró un harness de carga (`load-tests/runner/pg-metrics.ts`)
  y resultados de carga ya persistidos (`load-tests/results/`) que
  documentaban comportamiento real de latencia/conexión contra
  infraestructura Railway del propio proyecto — sin necesidad de correr
  nada, sólo de leer lo que ya estaba ahí. Regla: antes de declarar
  "evidencia insuficiente, requiere una tarea diagnóstica nueva",
  revisar si el repo ya contiene instrumentación o resultados
  archivados relevantes a la pregunta — no toda "nueva evidencia
  necesaria" requiere una nueva ejecución.
- **No dejar pasar un hallazgo de higiene de test real sólo porque no
  explica el síntoma bajo investigación (AUTH2-R13-R3-RETRY-2-R2-R1)**:
  se encontró un `mock.module()` sin scope en un archivo hermano de
  TANDA_2 que reemplaza un módulo completo sin re-exportar todas sus
  funciones — un riesgo real, aunque el análisis de la forma exacta del
  síntoma (latencia de segundos + código Prisma P2028) descartó que
  fuera la causa de ESTE bloqueo. Regla: un hallazgo colateral genuino
  se documenta y se preserva para revisión futura aunque no sea la
  respuesta a la pregunta que se está resolviendo — no se descarta sólo
  por no encajar en la hipótesis principal, y tampoco se sobre-vende
  como si fuera la causa cuando la evidencia de forma (shape) del fallo
  la contradice.
- **Una decisión de proceso del usuario puede aceptar una excepción sin
  reescribir la evidencia técnica que la motivó
  (AUTH2-R13-R3-RETRY-2-R2-R1A)**: el usuario decidió diferir la DB de
  TESTING dedicada recomendada por la etapa anterior — pero esa
  recomendación técnica NO se borró ni se marcó como incorrecta; se
  preservó íntegra como "recomendación técnica histórica", y la
  decisión del usuario se registró como un hecho de proceso SEPARADO
  que la supersede sólo para efectos de avance actual. Regla: cuando el
  usuario prioriza avanzar sobre seguir una recomendación técnica, el
  reporte debe capturar AMBAS cosas explícitamente — la recomendación
  sigue siendo válida y queda disponible si se necesita reabrir, y la
  decisión del usuario queda igual de explícita como la autoridad que
  gobierna el avance inmediato.
- **Una excepción de certificación nunca debe expresarse como un
  resultado de test falso (AUTH2-R13-R3-RETRY-2-R2-R1A)**: el prompt de
  esta etapa exigió explícitamente NO escribir "TANDA_2 31/31 PASS" ni
  "294/294 PASS" — la formulación correcta describe qué evidencia real
  se tiene (TANDA_1 163/163, autoridad específica de AUTH02 100%) y qué
  se excluyó explícitamente por decisión del usuario (un caso exacto,
  con su propio ID de excepción). Regla: cuando una excepción de
  proceso permite avanzar pese a un fallo real, el reporte nunca debe
  fusionar "excepción aceptada" con "test pasó" — son epistemológicamente
  distintos y deben quedar distinguibles para cualquier lector futuro,
  incluido uno que audite la certificación meses después.
- **Verificar el orden cronológico real antes de insertar una narrativa
  nueva en un archivo de registro append-only (lección de esta misma
  sesión, FINDINGS.md)**: al insertar la narrativa de dos etapas
  consecutivas usando como ancla el cierre del bloque de marcadores
  (```) en vez del final real del archivo, ambas quedaron insertadas
  ANTES de toda la narrativa histórica previa (R13-R1 en adelante),
  invirtiendo el orden cronológico. Se detectó por un `grep` de los
  encabezados `**R13-R...` y se corrigió moviendo ambos párrafos al
  final real. Regla: en archivos append-only con múltiples etapas
  narradas, anclar la inserción al último párrafo real (verificado con
  `tail`/`grep`, no asumido), nunca a un bloque de marcadores que puede
  repetirse en cada etapa.
- **Un `replace_all` sobre texto de marcador puede alcanzar secciones
  narrativas históricas que comparten el mismo literal
  (AUTH2-R13-R4)**: al usar `replace_all` para actualizar dos
  ocurrencias esperadas (header + bloque duplicado "## Next") de
  `P2_T18=BLOCKED_AUTH02_PRECOMMIT_CERTIFIED_AWAITING_R13_R4`, el mismo
  reemplazo alcanzó una TERCERA ocurrencia dentro de una sección
  narrativa fechada de una etapa anterior (R13-R3-RETRY-2-R2-R1A),
  donde ese marcador debía permanecer congelado como hecho histórico.
  Se detectó con un `grep -c`/listado de ocurrencias inmediatamente
  después del `replace_all` (contando cuántas veces apareció el nuevo
  valor vs. cuántas se esperaban) y se revirtió sólo esa tercera
  instancia a su valor histórico original. Regla: después de CUALQUIER
  `replace_all` en un archivo con secciones narrativas fechadas, contar
  las ocurrencias resultantes contra el número esperado ANTES de seguir
  editando — un `replace_all` es seguro sólo cuando el string es
  exclusivo del estado "actual" (header/bloque Next), nunca cuando
  también podría aparecer, textualmente idéntico, dentro de una
  narrativa histórica ya cerrada.
- **Un commit local exacto, correctamente preparado, no necesita
  improvisación (AUTH2-R13-R4)**: el gate de identidad de bytes
  pre-stage (SHA-256 sobre los 14 paths) coincidió exactamente con la
  autoridad certificada de la etapa anterior, y el staging/commit/
  verificación postcommit (blob hashing vía `git rev-parse
  ":<path>"`/`git hash-object`) pasó 14/14 en cada gate sin ninguna
  sorpresa. Regla: cuando una cadena de certificación precommit fue
  seguida rigurosamente (fingerprints tomados y comparados en cada
  etapa, nunca confiados de memoria), el commit final es un trámite
  mecánico verificable, no un punto donde deba re-abrirse ningún
  juicio técnico — la disciplina de las etapas previas es lo que hace
  que ésta sea aburrida, que es exactamente el resultado deseado.
- **Recertificar un commit desde los objetos Git, no desde el resumen
  de quien lo creó (AUTH2-R13-R5)**: en vez de confiar en el propio
  reporte de R13-R4, se re-derivó el fileset por 2 métodos Git
  independientes (`diff-tree`, `show --name-only`) y los 14 blob IDs
  vía `git ls-tree HEAD` — la fuente de verdad para "qué se
  commiteó" nunca fue el resumen en prosa de la etapa anterior, sino
  los propios objetos del repositorio. Regla: una etapa de
  recertificación postcommit existe precisamente para no propagar un
  error de transcripción de una etapa a la siguiente sin
  detectarlo — usar SIEMPRE la fuente primaria (objetos Git) en vez
  de la fuente secundaria (el reporte que describe esos objetos).
- **No asumir que un servicio no necesita redeploy sólo porque el
  diff no toca sus archivos (AUTH2-R13-R6)**: el prompt de esta etapa
  advertía explícitamente que el diff de AUTH02 no toca ningún path
  de `chat en vivo`, y que por tanto un redeploy de ese servicio "no
  es inherentemente requerido" — pero también exigía observar la
  realidad, no asumirla. `chat en vivo` SÍ recibió un autodeploy
  Git-triggered para este push, exactamente como ya había ocurrido en
  R6 y R12 con diffs igualmente ajenos a ese servicio — confirmando
  que Railway dispara ambos servicios en cada push a la rama, sin
  filtro por path. Regla: cuando un prompt da instrucciones
  condicionales sobre un comportamiento externo no controlado
  directamente ("si pasa X, hacer Y; si no, hacer Z"), la condición se
  resuelve observando el sistema real en el momento, nunca infiriendo
  del código fuente qué "debería" pasar — un sistema de CI/CD externo
  puede tener su propio criterio de trigger, distinto del que un
  observador esperaría del diff en sí.
- **Ampliar una prioridad de usuario sin reordenar nada (AUTH2-R13-R6)**:
  el usuario añadió una nueva prioridad (auditoría de sincronización
  Producción-vs-testing-codex) que debía anteponerse a una prioridad
  ya registrada (P2-T06/P2-T14) en una etapa previa. Se actualizó la
  sección de prioridad en `ROADMAP.md` para reflejar el nuevo orden
  deseado completo, sin tocar la numeración de posiciones 11-18 del
  roadmap — la regla `NO_UNVERIFIED_ROADMAP_REORDER` seguía vigente,
  intacta, para AMBAS prioridades. Regla: una prioridad nueva del
  usuario se añade a la narrativa y a los marcadores de intención sin
  que eso autorice, por sí sola, ninguna reordenación estructural que
  el propio usuario no pidió explícitamente para esa estructura.
- **Distinguir un click fallido de un fallo de producto por el estado
  del servidor, no por la apariencia de la UI (AUTH2-R13-R7)**: al
  intentar el logout de Negocio, un toast de bienvenida residual tapaba
  visualmente el ícono real de "Cerrar sesión"; dos clicks en esa
  coordenada no dispararon nada observable a simple vista. En vez de
  asumir que el logout había fallado como defecto de producto (o, a la
  inversa, asumir que sí funcionó porque "se veía razonable"), se
  verificó el estado real vía `GET /api/auth/me?actorFamily=negocio`
  — `200` confirmó que la sesión seguía activa, es decir que el click
  nunca llegó al botón real. Sólo tras cerrar el toast y reintentar se
  confirmó `401`. Regla: cuando un control de UI parece no responder,
  la fuente de verdad sobre si ocurrió un fallo real de producto o un
  simple error de control es el estado del servidor (una llamada de
  red real), nunca la apariencia visual de la página — esto es lo que
  permite acotar con confianza el presupuesto de "correcciones de
  control" sin arriesgarse a ocultar un defecto real bajo esa etiqueta.
- **Los mensajes de chat tienen fallback HTTP; el typing no lo tiene
  (F-P1-02-REAL-BROWSER-ACCEPTANCE)**: `chat-view.tsx` envía mensajes
  vía `POST /api/chat/mensajes/[pedidoId]` (persistencia HTTP, con
  refetch al reabrir el panel como camino secundario si el push de
  socket no llega a tiempo), mientras que `sendTyping`/`sendStopTyping`
  (`realtime-manager.ts:333-339`) son exclusivamente `socket.emit`, sin
  ningún fallback. Esto significa que un baseline de "los mensajes
  llegan" NO es evidencia suficiente de que el canal de socket para
  typing esté funcionando — son mecanismos independientes que sólo
  comparten la misma conexión subyacente. Regla: al certificar
  features puramente socket-driven (sin fallback HTTP/polling), nunca
  inferir su salud a partir de una feature que sí tiene un camino
  alternativo — verificar cada canal por separado.
- **`ROOM_CAPABILITY_TTL_SECONDS=120` puede invalidar un room-grant a
  mitad de una sesión de prueba larga (F-P1-02-REAL-BROWSER-ACCEPTANCE)**:
  `src/lib/realtime-auth.ts` define un TTL de 120s para el grant que
  autoriza a un socket a recibir eventos de una sala (`chat:typing`/
  `chat:read`). Si un panel de chat se abre al principio de una
  secuencia de prueba larga (fixtures, baseline, investigación) y el
  caso de aceptación real se ejecuta más de 120s después, el grant del
  RECEPTOR puede haber expirado silenciosamente — `getAuthorizedRecipientSockets`
  en el chat-service simplemente excluye ese socket sin error visible.
  Regla: para cualquier aceptación de una feature de sala con TTL,
  reabrir el panel/re-adquirir el grant inmediatamente antes de cada
  caso, no asumir que un panel abierto minutos antes sigue autorizado.
- **`void promise` sin `.catch()` puede convertir un fallo de conexión
  real en un silencio total (F-P1-02-REAL-BROWSER-ACCEPTANCE-R1)**:
  `chat-sheet.tsx` invoca `void client.acquireOrderRoom(...)`
  (fire-and-forget). Si esa promesa se rechaza (por ejemplo porque
  `ensureConnected()` nunca logra crear una conexión de socket real),
  el error se descarta silenciosamente — sin excepción no capturada,
  sin log de consola, sin estado de error visible en la UI. Esto
  convirtió lo que podría haber sido un error obvio en un
  `REAL_BROWSER_TYPING_CONTROL_INVALID` genuinamente difícil de
  diagnosticar sin lectura de código + instrumentación dirigida. Regla:
  cuando una feature parece "no hacer nada" con navegador real y sin
  errores de consola, sospechar primero de un `void`/promesa
  fire-and-forget sin manejo de rechazo en la cadena de invocación,
  no asumir que "sin error" significa "sin fallo".
- **Cuando no hay tooling de red que exponga frames WebSocket, un
  observador temporal de solo lectura es una excepción legítima y
  acotada a la regla general de no-monkey-patching
  (F-P1-02-REAL-BROWSER-ACCEPTANCE-R1)**: `read_network_requests` del
  navegador conectado sólo rastrea XHR/fetch, nunca frames WebSocket
  crudos — confirmado con 0 resultados para el patrón "socket" pese a
  research que la conexión debería existir. Para este caso puntual, el
  prompt de la etapa autorizó explícitamente instalar un wrap de solo
  lectura de `WebSocket.prototype.send`/evento `message` (nunca altera
  payload/comportamiento, se instala en memoria del navegador antes de
  que el socket se cree, se retira al terminar) — una excepción
  puntual, no una licencia general para instrumentar producción sin
  autorización explícita de la etapa en curso. El hallazgo (cero frames
  en ambos actores) fue además corroborado independientemente por
  `read_network_requests` mostrando cero requests de CUALQUIER tipo
  hacia el chat-service — nunca confiar en una sola fuente de evidencia
  cuando dos técnicas independientes pueden confirmarse mutuamente.
  **CORRECCIÓN POSTERIOR (P2-T18-F-P1-02-REAL-BROWSER-ACCEPTANCE-R1-R1,
  2026-08-29)**: esta "corroboración independiente" resultó ser una
  ilusión — el observador de WebSocket inyectado y `read_network_requests`
  NO son técnicas independientes para este propósito: ambos comparten
  el mismo punto ciego real (ninguno de los dos captura tráfico
  WebSocket nativo `wss://`, sólo XHR/fetch), por lo que "cero
  evidencia en ambas" no descarta una conexión real — sólo prueba que
  ninguna herramienta usada podía verla. La conclusión original ("el
  navegador nunca conecta") era falsa; se corrigió con evidencia
  lógica indirecta (una llamada REST gateada secuencialmente detrás de
  `ensureConnected()` que sí tuvo éxito) más el indicador de UI en vivo
  ("● Conectado"). Regla corregida: para confirmar positivamente una
  conexión WebSocket real, preferir evidencia que NO dependa de
  capturar el tráfico WS directamente (un efecto secuencialmente
  dependiente de la conexión, como una llamada REST que sólo se
  dispara tras `ensureConnected()` exitoso, o el estado de UI derivado
  del propio manager) antes que instrumentación de red que puede
  compartir el mismo punto ciego que el observador original.
- **Un "baseline de chat bidireccional PASS" puede enmascarar un push
  en vivo completamente roto si la prueba de aceptación reabre/renavega
  el hilo antes de verificar cada mensaje
  (P2-T18-F-P1-02-REAL-BROWSER-ACCEPTANCE-R2)**: en R1-R1 y al inicio
  de R2, un mensaje enviado por un actor apareció correctamente del
  lado del receptor — pero SIEMPRE tras cerrar y reabrir (o
  renavegar) el panel de chat del receptor antes de comprobar, lo cual
  dispara un fetch HTTP fresco al montar el componente. Esto se
  clasificó erróneamente como evidencia de push en vivo funcionando.
  La prueba que reveló la verdad fue enviar un mensaje NUEVO mientras
  el hilo del receptor ya estaba montado y a la vista, SIN ninguna
  navegación antes ni después — recién ahí se hizo evidente que el
  mensaje nunca llegaba sin ese refetch manual. Regla: para certificar
  push en vivo (no sólo persistencia+refetch), la prueba de aceptación
  debe mantener la superficie receptora ABIERTA y SIN renavegar desde
  antes de la acción del emisor hasta después de verificar el
  resultado — cualquier apertura/cierre/reapertura del panel entre el
  envío y la verificación invalida la prueba como evidencia de push en
  vivo, aunque siga siendo válida como evidencia de persistencia HTTP.
- **Un `RAILWAY_PRIVATE_DOMAIN` (`.railway.internal`) idéntico entre
  dos entornos distintos para el mismo servicio lógico NO es, por sí
  solo, prueba de que una variable que referencia ese hostname esté
  mal configurada (auditoría de sync Production-vs-testing-codex,
  2026-08-29)**: se encontró que `REALTIME_INTERNAL_SERVICE_URL` en
  TESTING apunta a `harmonious-empathy.railway.internal` — el mismo
  string que el chat-service de TESTING Y el de PRODUCTION reportan
  ambos como su propio `RAILWAY_PRIVATE_DOMAIN`. Esto es ambiguo, no
  concluyente: si la red privada de Railway está aislada por entorno,
  ambos strings son coincidentemente iguales pero cada uno resuelve
  correctamente dentro de su propia red; si está compartida a nivel
  de proyecto, hay un drift real. Regla: ante esta ambigüedad,
  clasificar `INCONCLUSIVE` (nunca asumir "correcto" ni "roto") y
  documentar toda la evidencia real reunida — la única forma de
  resolverlo con certeza es una prueba de conectividad en vivo desde
  dentro del entorno en cuestión, nunca inferencia desde nombres de
  variable que "suenan" a un entorno u otro. **Resuelto en
  PRODUCTION-SYNC-R2 (2026-08-29)**: el usuario aportó autoridad de
  plataforma directa (cada entorno de Railway tiene su propia red
  privada aislada; el mismo pet-name puede repetirse legítimamente
  entre entornos) — cerrado como `NOT_A_DRIFT`, ver
  `codex-reports/FINDINGS.md` (F-ENV-TESTING-REALTIME-ROUTING-01) y
  `codex-reports/PRODUCTION_SYNC_R2.md` sección 2. La regla de "no
  inferir desde el nombre, verificar" sigue vigente para casos
  FUTUROS sin esa autoridad explícita — este cierre específico no la
  invalida, la autoridad vino del usuario, no de una inferencia propia.
- **Cuando el clasificador de permisos del harness bloquea una
  mutación real hacia infraestructura compartida (Railway Production),
  no intentar eludirlo — presentar opciones al usuario y, si elige
  ejecutar manualmente, darle comandos que preserven exactamente la
  misma disciplina de no-exposición ya establecida (PRODUCTION-SYNC-R2,
  2026-08-29)**: el intento del agente de generar/escribir secretos vía
  un proceso Node con `--stdin` fue bloqueado por el clasificador,
  incluso con una prueba no sensible. El mensaje de bloqueo instruye
  explícitamente no intentar workarounds. Regla: ofrecer al usuario
  opciones claras (reintentar, ajustar permisos, ejecutar manualmente,
  pausar) vía `AskUserQuestion`; si elige ejecutar manualmente, los
  comandos entregados deben mantener el mismo contrato de secreto
  (generado y retenido sólo en memoria del proceso del propio usuario,
  transmitido exclusivamente por `--stdin`, nunca como argumento,
  variable de shell liberada con `unset` inmediatamente después) —
  la verificación posterior del agente sigue siendo obligatoria
  (read-only, fingerprint SHA-256, nunca plaintext) para no depender
  ciegamente del reporte del usuario.
- **Un riesgo de "compatibilidad con código viejo" documentado en una
  migración destructiva debe verificarse contra el código viejo REAL
  del entorno al que se va a aplicar, no asumirse genéricamente
  (PRODUCTION-SYNC-R1, 2026-08-29)**: la migración
  `20260826230000_drop_terminal_operativa_push_subscription` documenta
  un riesgo real de romper 2 call-sites sin `select` explícito si
  corre mientras una instancia vieja del Prisma Client sigue
  sirviendo tráfico — verificado que ese riesgo sigue sin corregir en
  testing-codex HEAD. Pero para la sincronización de Production
  específicamente, `git cat-file -e` confirmó que ninguno de esos 2
  archivos ni el modelo `TerminalOperativa` existen en `main` — el
  "código viejo" real de Production nunca conoció esa columna, así
  que no hay ventana de riesgo que proteger para ESE salto específico
  (aunque el riesgo siga siendo válido para el historial interno de
  TESTING, donde sí hubo una versión con el campo presente). Regla:
  antes de heredar la clasificación de riesgo de una migración desde
  su contexto de origen (TESTING) hacia un contexto distinto
  (Production), verificar con evidencia directa (`git cat-file -e`,
  lectura del schema en el commit real del otro entorno) si la
  premisa del riesgo (código viejo que referencia lo que se elimina)
  sigue siendo cierta ahí — nunca asumir que un riesgo documentado en
  un contexto se traslada automáticamente a otro.

## Invariante añadida — BUSINESS-HOURS-TIMEZONE-PRODUCTION-PROMOTION-R1

`Negocio.timezone` es la autoridad IANA por negocio; los valores existentes de `horarios` son wall-clock locales y no deben reescribirse al agregar/cambiar timezone. La promoción Production fue expand-only, sin config Railway ni datos financieros. `PUBLIC_LAUNCH_AUTHORIZED=NO` y cualquier continuación requiere autorización del usuario.

## Invariante añadida — P2-T40 (registro de backlog, 2026-09-09) — Push session lifecycle / anti-nag

- **Un flag histórico de "prompt once per device" nunca es autoridad
  suficiente para silenciar una sesión autenticada nueva cuando el
  push efectivo está apagado.** `deligo-permissions-prompted`
  (`src/components/shared/permission-prompt.tsx`) documenta
  explícitamente un diseño "una vez por dispositivo" — válido como
  heurística de no-molestar, pero subordinado al invariante de
  producto: `NEW_AUTHENTICATED_SESSION + EFFECTIVE_PUSH_OFF =>
  USER_MUST_BE_INFORMED`. Cualquier tarea futura que toque este flag
  debe preservar la heurística de no-repetir dentro de una misma
  sesión, pero no puede usarla para ocultar un estado real de push
  apagado en una sesión nueva (especialmente tras expiración por
  desuso, el caso que originó P2-T40).
- **No asumir que actores con push "moderno" comparten el mismo hook.**
  Cliente/Negocio/Repartidor consumen `unlinkCurrentPushSubscription`
  desde el hook compartido `use-push-notifications.ts`, pero Salón
  personal ya tiene su propio hook dedicado
  (`use-operativo-salon-push.ts`) — confirmado por lectura real
  durante el registro de P2-T40. Cualquier auditoría o fix de
  lifecycle de sesión/push debe tratar cada actor por separado hasta
  confirmar equivalencia real de comportamiento, nunca asumir simetría
  por el sólo hecho de que ambos están clasificados como "push
  moderno".
- **`TerminalOperativa` sigue excluida de cualquier trabajo de push
  session lifecycle** — reafirma la decisión ya registrada en §P2-T12:
  no es un actor Push por diseño (kiosco con sesión por token +
  polling), no una feature pendiente de completar.

## Invariante añadida — P2-T35 (2026-09-09) — CRLF vs static-contract regex

- **Este checkout corre con `core.autocrlf=true`** (confirmado:
  `git config --get core.autocrlf`) — todo archivo de texto en disco
  tiene terminadores `\r\n` reales, incluidos los archivos de
  producto que los static-contract tests leen con `readFileSync(...,
  "utf8")`. Cualquier regex que ancle un salto de línea LITERAL
  (`\n` inmediato tras una llave de cierre, p.ej. `\}\n\n    \/\/`) o
  que use un presupuesto de caracteres fijo sin margen (`{0,1200}`)
  se rompe en este entorno sin que el código real haya cambiado — el
  `\r` extra por línea intercepta el `\n` esperado o agota el
  presupuesto. Confirmado con evidencia directa en P2-T35: 5 de 6
  fallas "preexistentes" documentadas desde P2-T29/P2-T31 eran
  exactamente este artefacto, nunca una regresión de runtime.
- **Fix correcto: normalizar la fuente leída a LF una vez, en el punto
  de declaración** (`readFileSync(path, "utf8").replace(/\r\n/g,
  "\n")`), no reescribir cada regex individualmente ni cambiar el
  código de producto para "acomodar" el test. Esto preserva
  exactamente el mismo poder de detección (un cambio real en la
  estructura protegida sigue rompiendo el test) y es inmune a si el
  checkout de turno tiene `autocrlf` en `true`, `false` o `input`.
- **Regla para cualquier static-contract test nuevo**: si el regex
  necesita anclar saltos de línea o presupuestar caracteres contra el
  contenido de un archivo real, normalizar la fuente a LF al leerla
  es la práctica por defecto — no asumir que el entorno de ejecución
  siempre tendrá LF puro.

## Invariante añadida — P2-T36 (2026-09-09) — maskable icons, badge Android, SW cache-bypass

- **Derivado maskable "sin decisión creativa" = escalar+centrar+rellenar
  con un color YA presente en el propio asset, nunca inventar uno.**
  Los 8 íconos de rol de DeliGO eran full-bleed edge-to-edge (0% margen
  en los lados planos, sólo redondeo en las esquinas) — el mismo PNG
  servía `purpose: "any"` Y `purpose: "maskable"` sin ningún margen real
  para el círculo de seguridad de Android (radio = 40% del ancho
  total). El procedimiento aceptado sin requerir decisión del operador:
  muestrear el color de fondo del propio asset (punto interior, lejos
  de esquinas/logo/texto), escalar la imagen COMPLETA (sin tocar nada
  de su contenido) a ~70% de su tamaño, centrarla sobre un canvas nuevo
  relleno con ese color muestreado. Cualquier tarea futura que necesite
  un derivado maskable debe seguir este mismo patrón — nunca elegir un
  color/fondo nuevo por criterio propio.
- **Un ícono "512x512" por nombre de archivo puede NO serlo realmente**
  — `icon-empleado-512x512.png`, `icon-mozo-512x512.png` e
  `icon-salon-512x512.png` miden 2133x2133 px reales y muestran sólo un
  fragmento recortado del logo (ver F-P2-T36-01). Nunca asumir
  dimensiones por el nombre de archivo — medir siempre con
  `sharp(...).metadata()` o equivalente antes de derivar cualquier
  variante.
- **El badge Android (`NotificationOptions.badge`) es conceptualmente
  distinto del icon y NUNCA debe heredarlo por defecto** — un PNG
  full-color como badge rinde mal (Android lo trata como silueta
  monocromática pequeña). DeliGO usa UN ÚNICO badge compartido
  (`/badge-deligo-monochrome-96x96.png`, extraído mecánicamente por
  umbral de color del glyph blanco "D" de `icon-cliente-512x512.png` —
  el único ícono de rol sin texto superpuesto) para TODOS los roles —
  el badge no necesita codificar el rol, sólo `icon` lo hace. El
  override explícito `data.badge` del payload sigue ganando siempre
  sobre este fallback compartido.
- **Cualquier chequeo de "no cachear este asset" en `public/sw.js` debe
  basarse en `URL.pathname` con un patrón explícito, nunca en
  `request.url.includes(...)` con un substring que se asume presente**
  — el bug de F-P2-T36-02 (`includes("icon-192")` nunca matcheaba
  `icon-cliente-192x192.png`) estuvo documentado en el propio código
  desde DELIGO-BRANDING-R1 sin corregirse hasta P2-T36. El patrón
  correcto usado ahora: `/^\/(icon|badge)-/.test(pathname) &&
  pathname.endsWith(".png")` — cualquier asset de branding nuevo
  (`icon-*`, `badge-*`) queda cubierto por construcción, sin necesitar
  editar esta regla de nuevo.

## Invariante añadida — reconciliación Operaciones/Salón (2026-09-09) — nuevas tareas P2-T41..T52

- **Autorización server-side y corrección de workflow/sort son
  invariantes DISTINTOS, aunque compartan pantalla.** P2-T41 (Terminal
  Read-Only Action Authorization) y P2-T42 (PyR Workflow Parity) tocan
  superficies visualmente relacionadas (PyR/Terminal), pero una
  pantalla puede mostrar el estado/orden correcto (T42) y aun así
  autorizar una acción indebida en el servidor (T41) — nunca fusionar
  sus invariantes ni asumir que resolver uno resuelve el otro.
- **`T46_MUTATING_ACTIONS_REQUIRE_T41_AUTHORITY=SI`** — cualquier
  cambio a "Ver cuenta"/"Cerrar cuenta"/ticket dentro de P2-T46 debe
  esperar (o coordinarse explícitamente con) la autoridad de
  autorización que P2-T41 define para qué actores pueden ejecutar
  cierre/cancelación. Implementar T46 sin T41 arriesga reintroducir
  exactamente el mismo patrón de acción-mutante-sin-autorizar que T41
  existe para corregir.
- **Push/avisos por actor (P2-T44, P2-T45) es DISTINTO de lifecycle de
  sesión/login (P2-T40)** — no fusionar. T40 cubre exclusivamente
  logout/login/expiración de sesión/reconciliación/aviso al usuario;
  T44/T45 cubren si existe cobertura funcional de Push/avisos correcta
  por actor (PyR personal, Terminal PyR) y cómo se usa (popover roto,
  "Enviar prueba" visible indebidamente). Un actor puede tener el
  lifecycle de sesión perfecto (T40) y aun así no tener ninguna
  cobertura de Push real (T44/T45).
- **Terminal como actor de avisos (P2-T45) es una decisión de producto
  NUEVA, no una extensión automática de `TerminalOperativa`.** Preserva
  sin reabrir la decisión ya registrada en §P2-T12:
  `TERMINAL_OPERATIVA_PUSH=NO_ES_ACTOR_PUSH_POR_DISEÑO` (kiosco con
  sesión por token+polling, nunca incluido en `CorePushOwnerType`).
  P2-T45 no reabre esa exclusión — investiga qué mecanismo YA usa
  Terminal Salón (que el operador confirma que sí tiene avisos, sin que
  eso implique Web Push) antes de diseñar algo equivalente para PyR,
  respetando el aislamiento `CuentaOperativa personal !=
  TerminalOperativa compartida`.
- **Un ícono de rol PWA nombrado "512x512" puede no serlo realmente —
  ver F-P2-T36-01 (formalizada como P2-T52).** Preservada aquí también
  porque afecta el criterio de auditoría de cualquier tarea futura de
  branding: medir siempre con una librería real (`sharp` u equivalente),
  nunca confiar en el nombre de archivo.

## Invariante añadida — Operations Single-PWA Identity (2026-09-09)

- **`OPERATIONS_SINGLE_PWA_IDENTITY=SI`**: Empleado/CuentaOperativa,
  Mozo, PyR, Salón y TerminalOperativa son áreas/roles internos de la
  ÚNICA identidad PWA instalable "DeliGO Operaciones" — nunca requieren
  manifest/ícono/branding propio por diseño actual. Diferencias de
  autorización, área o tipo de sesión (`CuentaOperativa` personal vs
  `TerminalOperativa` compartida) NO implican identidad PWA separada:
  `AUTH_ACTOR_OR_AREA_DIFFERENCE != SEPARATE_PWA_BRANDING`. Empleado,
  Mozo y Salón SÍ fueron PWAs separadas en una arquitectura ANTERIOR de
  DeliGO — el código conserva residuos de esa época (`role-config.ts`
  con entradas `mozo`/`salon`/`empleado`, `manifest-{mozo,salon,
  empleado}.json`, `icon-{mozo,salon,empleado}-*`) que no deben
  interpretarse como identidades de producto activas pendientes de
  mantener sólo porque los archivos existen:
  `PRESENCE_OF_LEGACY_ASSET_DOES_NOT_IMPLY_ACTIVE_PRODUCT_IDENTITY=SI`.
- **Las 5 identidades PWA canónicas activas de DeliGO son: cliente,
  negocio, repartidor, admin, operaciones** — confirmado por
  `PRINCIPAL_PWA_ROLES` en `src/lib/pwa-identity.ts` (4: cliente,
  negocio, operaciones, repartidor — identidad SSR-emitida desde
  layout) más `admin` (5to, mecanismo `DynamicManifest` no-principal
  pero superficie SuperAdmin viva y legítimamente separada, nunca
  reclamada como parte de Operaciones). Cualquier auditoría futura de
  branding/PWA debe partir de esta lista de 5, no de "cuántos manifests
  hay en `public/`".
- **`/mozo` es un caso de residuo de migración incompleta, no una
  excepción de diseño**: a diferencia de Empleado (`/e`, `/e/[token]`)
  y Salón (`/s`, `/s/[token]`), cuyo único acceso está 100% retirado
  (`LegacyAccessRetired`, "Legacy-Cleanup-1B", sin fetch/sesión/función),
  `/mozo` sigue siendo HOY un flujo de login/registro/unirse real que
  usa el mismo backend `CuentaOperativa`/`Operativo` que el resto de
  Operaciones, pero todavía emite su propia identidad PWA separada
  ("DeliGO Mozos") vía `DynamicManifest` (mozo no está en
  `PRINCIPAL_PWA_ROLES`). Cualquier tarea que toque identidad PWA de
  Operaciones (p.ej. P2-T52) debe migrar este camino específico —no
  asumir que "ya está resuelto" sólo porque Empleado/Salón sí lo están.
- **Los íconos de 192px de Mozo/Salón/Empleado (`icon-{rol}-
  192x192.png`) tienen un uso LEGÍTIMO E INDEPENDIENTE de la identidad
  PWA**: `public/sw.js` los usa para diferenciar visualmente
  notificaciones Push por área (`salon_new_order`, `mesa_order_ready`,
  `operaciones_order_cancelled` con `area=salon|pyr`). Consolidar o
  retirar la identidad PWA separada de estos roles NUNCA debe implicar
  borrar estos 3 archivos — sólo dejar de usarlos para manifest/
  instalación. `icon-mozo-192x192.png` específicamente está visualmente
  cortado y necesita su propio arreglo de asset (no relacionado con la
  consolidación de identidad).

## Invariante añadida — Terminal Operativa read-only vs mutaciones (P2-T41, 2026-09-10)

- **`TERMINAL_GLOBAL_MUTATION_BAN=NO` / `TERMINAL_READ_ONLY_CONTEXT_
  ENFORCEMENT=SI`**: nunca interpretar "TerminalOperativa" como
  sinónimo global de "solo lectura" — PyR Terminal tiene mutaciones
  legítimas propias (transiciones de estado de pedido, P2-T42) y deben
  preservarse intactas. La autorización correcta depende de
  contexto/área/capability/endpoint/recurso/operación, nunca de un
  chequeo plano `if (actor === terminal) deny all`. El patrón correcto,
  establecido acá y reutilizable: dar a Terminal su **propio tipo de
  actor** en el resolver (`salon_terminal`, nunca reusar el tipo
  genérico de Cuenta Operativa personal), y que cada endpoint de
  mutación decida explícitamente si ese tipo está autorizado — nunca
  negarlo implícitamente ocultando sólo el botón en la UI.
- **`salon_terminal` ya NO es un actor válido de cancelación de pedido
  de mesa ni de cierre comercial de cuenta** (`resolverActorCancelacionMesa`
  en `src/lib/mesa-pedido-cancelacion.ts`, `resolveMesaOccupancyCloseActor`
  en `src/lib/mesa-occupancy.ts`) — esto es una **reversión de política
  de producto** sobre un diseño previo deliberado y probado ("23-A1",
  que autorizaba explícitamente 4 tipos de actor incluyendo
  `salon_terminal`), decidida por el operador tras evidencia física
  directa, no la corrección de un exploit no intencional. El cierre
  TÉCNICO de ocupación (`mesas/[id]/ocupacion`, nunca toca
  pedidos/pagos/tickets) es una acción DISTINTA y de menor riesgo —
  Terminal Operativa SÍ conserva esa capacidad, sin cambios.
- **`T46_MUTATING_ACTIONS_REQUIRE_T41_AUTHORITY=SI`**: cualquier
  rediseño futuro de cuenta/ticket/historial (P2-T46) que agregue
  nuevas acciones mutantes sobre la cuenta de mesa debe consultar/
  extender la autoridad ya establecida acá (los mismos actor-types y
  el mismo patrón de deny-server-side-primero), nunca reinventar un
  chequeo de autorización paralelo.
- **La UI nunca es la autoridad, ni siquiera para ocultar acciones**:
  el fix de P2-T41 negó primero server-side (403 en ambos endpoints de
  mutación) y sólo DESPUÉS retiró el botón/prop de la UI
  (`canClose` en `MesaCuentaDialog`, remoción de
  `CancelarPedidoMesaDialog` en `operaciones/salon/page.tsx`) — un
  fix que sólo oculta el control sin negación server-side no habría
  cumplido el invariante y hubiera sido rechazado por el propio
  criterio de éxito de la tarea.
- **Cierre certificado (2026-09-10, P2-T41-OPERATOR-CERTIFICATION-CLOSEOUT)**:
  el operador certificó físicamente/vía browser sobre TESTING que el
  fix cumple el invariante en la práctica (5/5 pasos PASS: "Cancelar
  pedido" ausente, "Ver cuenta" funcional, "Cerrar cuenta" ausente,
  lectura/navegación intacta, PyR sin regresión). No se introduce
  ningún invariante nuevo en el cierre — este ítem sólo REGISTRA que el
  invariante de arriba quedó verificado end-to-end (código + UI +
  operador), no sólo por evidencia de código. `P2_T41_STATUS=CLOSED_
  TESTING_CERTIFIED`, sin cambios de código en esta tarea.
- **Checkpoint Production (2026-09-10, P2-T41-PROMOTION-TO-MAIN-AND-PRODUCTION)**:
  el invariante de arriba quedó promovido a `main`/Production (commit
  `bb17c7dd1eb9b8f4cb94d03de834019baf182987`, tag
  `p2-t41-stable-2026-09-10`) tras confirmar que el delta real
  correspondía exactamente a T41 (8 archivos, ninguno ajeno) y
  re-verificar tests/typecheck/lint/build sobre ese source exacto.
  `P2_T41_STATUS=CLOSED_PRODUCTION_CHECKPOINTED`. Ningún invariante
  nuevo — sólo el checkpoint de que la autoridad server-side de
  Terminal read-only ya rige en Production, no sólo en TESTING.

## Invariante añadida — PyR reutiliza la autoridad de transición de Negocio, nunca la duplica (P2-T42, 2026-09-10)

- **`PYR_ORDER_WORKFLOW_AUTHORITY=SHARED_WHERE_PRACTICAL`**: PyR
  (Employee y Terminal) gestiona el MISMO ciclo de vida de pedidos
  domicilio/retiro que Negocio — nunca un motor de estados paralelo.
  `src/lib/order-transitions.ts` expone `NEGOCIO_T29B_ROLLOUT_
  FORWARD_TRANSITIONS`, reutilizado tal cual (mismo objeto, import
  alias `PYR_ROLLOUT_FORWARD_TRANSITIONS`, sin copiarlo) por el
  endpoint Terminal PyR y por los endpoints fijos de Employee. El
  nombre `NEGOCIO_...` queda histórico a propósito — renombrarlo
  tocaría innecesariamente los call-sites ya existentes de Negocio.
  Cualquier tarea futura que gestione domicilio/retiro desde un nuevo
  actor debe partir de esta misma autoridad, nunca de una tabla local.
- **El paso "aceptado" ya era una recomendación explícita, no una
  invención de esta tarea**: el propio documento de diseño de P2-T29
  (`P2_T29_ESPERANDO_REPARTIDOR_ACCEPTANCE_REDESIGN_AUDIT_AND_DESIGN.md`)
  ya señalaba, en su tabla de superficies a migrar, "pyr: agregar
  aceptado como paso previo si el operador lo autoriza" — quedó
  pendiente hasta que el operador lo autorizó explícitamente en T42.
  Ninguna tarea futura debe re-litigar si PyR "debería" tener
  aceptación explícita: ya está decidido y ya está implementado.
- **"Marcar en camino" manual queda retirado como patrón**: avanzar un
  pedido de domicilio a `en_camino` es EXCLUSIVO de la aceptación
  atómica real de un Repartidor (`POST /api/repartidor/pedidos/[id]/aceptar`,
  CAS single-winner) — nunca una acción manual de quien gestiona el
  pedido (Negocio o PyR). La acción correcta de gestión es hacer el
  pedido DISPONIBLE (`esperando_repartidor`, `CANONICAL_WAITING_DRIVER_STATE`).
  Cualquier superficie futura que gestione pedidos de domicilio debe
  ofrecer "buscar repartidor" (esperando_repartidor), nunca un botón
  que fuerce `en_camino` directamente.
- **`PYR_ACTIVE_ESTADOS_NO_MESA`** (`order-transitions.ts`) es ahora la
  única fuente de verdad de "¿este pedido no-mesa está activo para
  PyR?" — antes de esta tarea la misma lista literal estaba duplicada,
  byte-idéntica, en 10 archivos (paneles, listados, detalle, mensajes y
  adjuntos, Employee y Terminal). Agregar un estado activo nuevo en el
  futuro debe tocar sólo este export, nunca los 10 call-sites a mano.
- **El endpoint fijo `preparar` de Employee (`operativo/pyr/pedidos/[id]/preparar`)
  es la única excepción deliberada sin arista legacy**: a diferencia
  del endpoint genérico de Terminal (que preserva `recibido→preparando`
  directo vía el grafo de rollout compartido), este endpoint fijo pasó
  a exigir `estado==="aceptado"` sin aceptar también `"recibido"` — el
  riesgo aceptado es una PWA cacheada por unos segundos durante el
  propio despliegue, auto-resuelto en el próximo reload; no existe
  ningún otro llamador de este endpoint. No generalizar esta excepción
  a otros endpoints fijos sin la misma justificación explícita.

## Invariante añadida — patrón canónico de destino post-login por rol (P2-T02-B1, 2026-09-10)

- **Ningún formulario de login por password de un rol con PWA propia
  puede navegar a `"/"` tras autenticar**: la raíz (`src/app/page.tsx`)
  redirige incondicionalmente a `/cliente/`, sin importar el actor —
  arquitectura deliberada del aislamiento de PWA por rol, confirmada
  correcta y NUNCA se vuelve actor-aware para "arreglar" este tipo de
  bug. El patrón canónico correcto, establecido primero por Negocio
  (commit `95ff272`, "fix: keep business login inside pwa scope") y
  ahora replicado por Repartidor (P2-T02-B1): un módulo dedicado
  `<rol>-post-login-navigation.ts` que exporta una constante de ruta
  fija `<ROL>_POST_LOGIN_PATH` (namespace del propio manifest del rol,
  p. ej. `/negocio/`, `/repartidor/`) + un helper `esRutaPwa<Rol>`,
  consumido por `router.replace(<ROL>_POST_LOGIN_PATH)` en el propio
  formulario de login — nunca un `router.replace("/")` ni un string
  literal duplicado. Cualquier PWA de rol nueva (o revisión de una
  existente) que agregue/mantenga un login por password debe seguir
  este mismo patrón desde el principio.
- **Este defecto (Repartidor) era preexistente desde el commit
  `9684082`** ("Implementa manifests PWA por rol y mejoras de
  instalacion", el mismo commit que introdujo el aislamiento de PWA por
  rol) — nunca detectado hasta una certificación física real de
  P2-T02 en Android, porque el login por Google OAuth de Repartidor
  (que sí se usaba en pruebas previas) nunca pasa por este código: no
  navega, deja que el propio estado del componente renderice el panel.
  Un login por password real, dentro de la PWA instalada, es lo que
  expuso el defecto — recordatorio de que las pruebas de login deben
  cubrir AMBOS caminos (password y OAuth) para cada rol con ambos
  disponibles, no sólo el que resulte más cómodo de automatizar.

P2-T46-R1: pago final de mesa en `SesionOcupacionMesa`; cierre comercial como autoridad; cierre técnico bloquea pendientes/consumo; sin backfill ni inferencia de `ocupacionMesaId=NULL`.

## P2-T46-R3 — certified invariants closeout — 2026-09-11

Se preservan las autoridades finales: `ACCOUNT_PAYMENT_AUTHORITY=SESION_OCUPACION_MESA`,
`TABLE_ORDER_PAYMENT_AUTHORITY=OCCUPATION`, `CURRENT_ORDER_OCCUPATION_AUTHORITY=PEDIDO_OCUPACION_MESA_ID`,
`HISTORY_GROUPING_AUTHORITY=OCUPACION_MESA_ID`, `HISTORY_PAYMENT_AUTHORITY=SESION_OCUPACION_MESA`.
El checkout de mesa no permite seleccionar pago; el cierre comercial es la
autoridad de pago y el terminal Salón permanece read-only. Las guardas de
cierre técnico para pedidos abiertos y cuenta facturable siguen activas.

Historial: una cuenta por ocupación, detalle completo visible, ticket canónico
disponible, sin heurística ni inferencia para ocupaciones NULL. Certificación
física PASS sobre `c3da04ef`; `c826e79` sólo añade documentación.

## P2-T46-R4 — Production checkpoint invariants — 2026-09-11

La promoción fue curada desde `origin/main@946f8c2` y contiene sólo T46:
`T46_DEPENDS_ON_T02=NO`, `T46_CAN_BE_PROMOTED_INDEPENDENTLY=SI`,
`T02_FILES_IN_RELEASE_DIFF=0`, `UNRELATED_FILES=0`. La migración
`20260910120000_p2_t46_account_payment_authority` es
`ADDITIVE_NULLABLE_NO_BACKFILL`; no se ejecuta downgrade destructivo en caso
de rollback. El checkpoint vigente es `p2-t46-stable-2026-09-11` sobre
`ff4cc2f`; `PUBLIC_RELEASE_AUTHORIZED=NO` permanece preservado.

## P2-T43-R3 — certified employee identity and join invariants — 2026-09-12

La certificación física confirma las autoridades finales:

- `PERSONAL_EMPLOYEE_IDENTITY_AUTHORITY=CUENTA_OPERATIVA`
- `BUSINESS_MEMBERSHIP_AUTHORITY=EMPLEADO`
- `LINKED_EMPLOYEE_DISPLAY_NAME_AUTHORITY=CUENTA_OPERATIVA_NOMBRE`
- `EMPLOYEE_NOMBRE_IS_PERSONAL_IDENTITY_AUTHORITY=NO`
- `EMPLOYEE_AREA_AUTHORITY=NEGOCIO_SERVER_SIDE`
- `PROJECTION_OVER_LEGACY_MUTATION=SI`

El código interno es único entre empleados no eliminados por negocio:
`UNIQUE (negocioId, codigo) WHERE eliminado=false`. El código de un empleado
activo se rechaza si está duplicado; el código de un empleado eliminado puede
reutilizarse y la fila histórica permanece preservada.

Se preservan las guardas `JOIN_CROSS_BUSINESS_GUARD=YES`,
`JOIN_PRIVILEGE_ESCALATION_GUARD=YES`, `JOIN_ROLE_SCOPE_GUARD=YES`,
`JOIN_SERVER_SIDE_AUTHORITY=YES`, `ADMIN_EMPLOYEE_SCOPE_GUARD=YES`, con
`CLIENT_CAN_MANAGE_EMPLOYEES=NO` y `TERMINAL_CAN_MANAGE_EMPLOYEES=NO`.
El join de uso único y el error genérico ante código inválido fueron PASS
físico. T43 queda certificado en Testing; Production sigue fuera de alcance.
