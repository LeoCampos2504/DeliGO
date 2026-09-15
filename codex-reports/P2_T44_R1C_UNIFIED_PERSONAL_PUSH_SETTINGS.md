# P2-T44-R1C — Unified Personal Push Settings

Fecha: 2026-09-14
Proyecto: DeliGO
Alcance: auditoría de arquitectura y decisión de bloqueo; sin Production.

## Autoridad

La certificación física P2-T44-R1B queda detenida y no se reutiliza como PASS
final. La nueva decisión de producto es una única configuración Push de la
cuenta personal, independiente del negocio seleccionado, que cubre Mozo, PyR
y Salón. La campana queda reservada al centro/listado de notificaciones.

```text
P2_T44_R1C_STATUS=BLOCKED_ARCHITECTURE_DECISION
P2_T44_R1C_PRODUCT_DECISION=ONE_PERSONAL_ACCOUNT_PUSH_SWITCH
P2_T44_R1B_PHYSICAL_CERTIFICATION=SUPERSEDED_PENDING_NEW_UX
PRODUCTION_MAIN_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
PRODUCTION_TOUCHED=NO
```

## Preflight y estado del árbol

```text
CURRENT_BRANCH=work/p2-t43-r2
CURRENT_HEAD=201ae4f977001629fd99b8d3ee070cfc777380f0
CURRENT_TESTING_REMOTE=201ae4f977001629fd99b8d3ee070cfc777380f0
PRODUCTION_MAIN_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
```

Existe un cambio local previo, no commiteado, en
`src/app/mozo/panel/[slug]/page.tsx`. No pertenece a R1C y no se incluye en
este reporte ni se despliega. La solución R1C no puede cerrarse usando ese
parche porque todavía deja la suscripción atada al panel/Empleado.

## Auditoría de patrones existentes

El patrón común de Cliente, Negocio y Repartidor es el mejor punto de partida
de UI y ciclo de vida: `usePushNotifications`, `Switch`, permiso explícito,
estado autoritativo por subscription física + binding server-side, escritura
dual legacy/normalizada y detach server-side. No se copia la implementación
de Mozo/PyR/Salón por panel como referencia final.

| Campo | Cliente | Negocio | Repartidor |
|---|---|---|---|
| `UI_COMPONENT` | `src/components/client/client-profile-panel.tsx` | `src/components/business/config-tab.tsx` | `src/components/repartidor/profile-tab.tsx` |
| `SETTINGS_LOCATION` | Perfil → Configuración | Configuración del negocio | Perfil → Notificaciones |
| `SWITCH_COMPONENT` | `src/components/ui/switch.tsx` | `src/components/ui/switch.tsx` | `src/components/ui/switch.tsx` |
| `HOOK` | `usePushNotifications` | `usePushNotifications` | `usePushNotifications` |
| `STATUS_ENDPOINT` | `POST /api/push/status?actorFamily=cliente` | `POST /api/push/status?actorFamily=negocio` | `POST /api/push/status?actorFamily=repartidor` |
| `SUBSCRIBE_ENDPOINT` | `POST /api/push/subscribe?actorFamily=cliente` | `POST /api/push/subscribe?actorFamily=negocio` | `POST /api/push/subscribe?actorFamily=repartidor` |
| `UNSUBSCRIBE_ENDPOINT` | `POST /api/push/unsubscribe?actorFamily=cliente` | `POST /api/push/unsubscribe?actorFamily=negocio` | `POST /api/push/unsubscribe?actorFamily=repartidor` |
| `PUSH_OWNER_TYPE` | `cliente` | `negocio` | `repartidor` |
| `PUSH_OWNER_ID` | actor autenticado `user.id` | actor autenticado `user.id` | actor autenticado `user.id` |
| `PERMISSION_LOGIC` | `Notification.requestPermission()` dentro del hook | igual | igual |
| `IOS_PWA_LOGIC` | hook genérico no exige slug ni negocio; prompt global excluye Mozo | igual | igual |
| `SERVER_SUBSCRIPTION_STATUS_SOURCE` | exact match normalizado + legacy del mismo actor | igual | igual |
| `MULTI_DEVICE_BEHAVIOR` | múltiples filas por owner+endpoint; fan-out por endpoint único | igual | igual |
| `NOTIFICATION_BELL_BEHAVIOR` | centro/listado independiente del switch | centro/listado independiente del switch | centro/listado independiente del switch |

`REFERENCE_PUSH_ARCHITECTURE=usePushNotifications + Switch + /api/push/{status,subscribe,unsubscribe} + normalized repository`

## Cuenta personal y áreas operativas

```text
PERSONAL_ACCOUNT_ENTRYPOINT=/operaciones/cuenta (accesible desde /operaciones/mi-panel sin elegir negocio)
PERSONAL_SETTINGS_COMPONENT=src/app/operaciones/cuenta/page.tsx (actualmente sólo identidad/Google; no tiene Push)
PERSONAL_SETTINGS_CAN_RENDER_WITHOUT_BUSINESS_CONTEXT=SI
PERSONAL_PUSH_SWITCH_COUNT=1
PERSONAL_PUSH_SCOPE=MOZO_PYR_SALON
PERSONAL_PUSH_TOGGLE_REQUIRES_SELECTED_BUSINESS=NO (requisito de diseño; hoy no implementado)
```

La navegación actual ya ofrece `Mi cuenta` antes de abrir un negocio. Es la
superficie correcta para alojar el switch, pero hoy no existe allí una
configuración Push.

## Separación de campana y configuración

```text
NOTIFICATION_BELL_PURPOSE=VIEW_NOTIFICATIONS
PUSH_SETTINGS_SWITCH_PURPOSE=ENABLE_DISABLE_BROWSER_PUSH
```

El centro compartido (`src/components/shared/notification-center.tsx`) sólo
lee, muestra badge, marca como leído y navega. No suscribe Push. En cambio,
R1 dejó controles de Push ligados a negocio en Mozo, PyR y Salón personal:

```text
MOZO_AREA_PUSH_TOGGLE_REMOVED=NO_PENDING_ACCOUNT_LEVEL_REPLACEMENT
PYR_AREA_PUSH_TOGGLE_REMOVED=NO_PENDING_ACCOUNT_LEVEL_REPLACEMENT
SALON_AREA_PUSH_TOGGLE_REMOVED=NO_PENDING_ACCOUNT_LEVEL_REPLACEMENT
```

No se eliminan todavía porque hacerlo sin crear primero el switch account-level
dejaría a la cuenta sin una vía de configuración. El cambio local previo de
Mozo tampoco se considera la solución final.

## Estado actual de Operaciones personal

Los tres paneles personales usan owner `empleado` y dependen de un `slug`:

```text
MOZO_PUSH_ROUTE=/api/operativo/mozo/panel/[slug]/push-subscription
PYR_PUSH_ROUTE=/api/operativo/pyr/panel/[slug]/push-subscription
SALON_PUSH_ROUTE=/api/operativo/salon/panel/[slug]/push-subscription
CURRENT_OPERATIVE_PUSH_OWNER=empleado
CURRENT_OPERATIVE_PUSH_OWNER_ID=Empleado.id
CURRENT_OPERATIVE_BUSINESS_DEPENDENCY=SI
```

R1 reutiliza correctamente autorización de Empleado/negocio/área,
parseo/validación de subscription, escritura dual y repositorio normalizado.
Esas piezas son reutilizables como seguridad y transporte, pero las rutas y
controles de activación por panel deben reubicarse cuando exista ownership de
cuenta.

```text
R1_REUSABLE_BACKEND_PARTS=authorization scoped to employee/business/area; push-subscription-http; normalized repository primitives; legacy+normalized dual-write compatibility; exact-match detach; VAPID validation; iOS/PWA states; regression/security tests
R1_UI_TO_REMOVE_OR_RELOCATE=Mozo/PyR/Salón area-level Push toggles and slug-dependent activation; keep notification lists/badges/navigation
```

## Ownership y decisión de schema

El schema actual contiene:

```text
CuentaOperativa -> Empleado[]
Empleado.pushSubscription -> String?
PushSubscription.ownerType -> cliente | negocio | repartidor | empleado
PushSubscription.ownerId -> String sin FK polimórfica
PushSubscription.unique -> (ownerType, ownerId, channel, endpoint)
```

No existe `cuenta_operativa` en `PushSubscriptionOwnerType`, ni una tabla o
campo de subscription account-level. Por lo tanto:

```text
RECOMMENDED_PERSONAL_PUSH_OWNER_MODEL=PushSubscription normalizada con ownerType=cuenta_operativa y ownerId=CuentaOperativa.id; sin duplicar la misma subscription en Empleado; autorización de cada evento permanece por CuentaOperativa↔Empleado↔Negocio/área
PERSONAL_PUSH_REQUIRES_SCHEMA_DECISION=SI
PERSONAL_PUSH_SCHEMA_CHANGE_REQUIRED=agregar owner enum cuenta_operativa y soportarlo en repository/rutas/producers; agregar endpoint account-level bajo sesión operativo; no hace falta campo legacy en CuentaOperativa si la tabla normalizada es la autoridad
DB_SCHEMA_CHANGED=NO
PRISMA_MIGRATION_CREATED=NO
```

La alternativa A (seguir usando `Empleado`) no representa correctamente una
preferencia de cuenta: con Empleado A en Negocio A y Empleado B en Negocio B
habría que escoger un empleado canónico, duplicar la subscription en ambos o
reconstruirla por evento. Las tres opciones crean hacks, huérfanos o riesgo de
duplicación y contradicen explícitamente la decisión de producto. No se
implementa ninguna.

## Multi-negocio, dedupe y autorización

Los productores actuales de operaciones consultan Empleados válidos del
negocio/área y envían targets por owner `empleado`:

- Mozo: `notifyMesaOrderReadyForMozo` resuelve el Mozo asignado a la mesa.
- Salón: `notifySalonNewOrderForOperations` resuelve Empleados de Salón del
  negocio.
- PyR/Salón: `notifyOperationsOrderCancelled` resuelve Empleados por área.

El patrón actual deduplica endpoints dentro de una wave de fan-out, pero un
mismo endpoint guardado bajo varios owners `empleado` sigue siendo un riesgo
semántico si se migra sin cambiar ownership.

```text
PERSONAL_PUSH_DUPLICATE_RISK=ALTO_SI_SE_REUSA_EMPLOYEE_OWNER; un endpoint físico puede quedar ligado a varios Empleados de una misma CuentaOperativa y el evento puede recorrerlos más de una vez
DEDUPLICATION_STRATEGY=account-level rows keyed by (cuenta_operativa, channel, endpoint) + reservePushEndpoint per event; resolve valid employee/business/area relations first, then target each account once
EVENT_AUTHORIZATION_REMAINS_EMPLOYEE_BUSINESS_SCOPED=SI
```

Con el owner account-level, un evento del Negocio X puede targetear la cuenta
sólo después de validar la relación activa Empleado de esa cuenta con X y el
área correspondiente. El scope de suscripción no se convierte en permiso
global.

```text
MOZO_PERSONAL_PUSH_COMPATIBLE=SI_CON_PRODUCER_REWORK_ACCOUNT_TARGETS
PYR_PERSONAL_PUSH_COMPATIBLE=SI_CON_PRODUCER_REWORK_ACCOUNT_TARGETS
SALON_PERSONAL_PUSH_COMPATIBLE=SI_CON_PRODUCER_REWORK_ACCOUNT_TARGETS
MULTI_BUSINESS_PERSONAL_PUSH_TEST=PENDING_SCHEMA_AND_PRODUCER_IMPLEMENTATION
DUPLICATE_DELIVERY_TEST=PENDING_SCHEMA_AND_PRODUCER_IMPLEMENTATION
```

## In-app, logout y alcance

El centro de notificaciones existente usa `Notificacion` y actor `empleado`
para varios eventos operativos; hoy las filas y algunas rutas/deep-links son
por Empleado y/o negocio. La auditoría no rediseña ese centro: el switch Push
puede ser account-level antes de elegir negocio, mientras que la autorización,
la fila lógica y la navegación del evento siguen conservando su scope actual.

```text
T40_ABSORBED=NO
T44_COMPATIBLE_WITH_CURRENT_LOGOUT=KNOWN_LIMITATION
```

El logout operativo actual captura la subscription física y hace detach contra
los owners `empleado` de los vínculos de la cuenta. Al introducir owner
`cuenta_operativa`, debe agregarse un detach account-level exact-match en la
misma política, sin absorber T40 ni destruir físicamente una subscription que
pueda tener otros bindings.

## Decisión y siguiente paso

No se implementan UI, rutas, producers, tests de integración, migraciones ni
deploy en R1C porque el owner correcto requiere una decisión de schema y la
tarea prohíbe simularlo con duplicaciones.

```text
TESTS=NOT_RUN_IMPLEMENTATION_BLOCKED
LINT=NOT_RUN_IMPLEMENTATION_BLOCKED
DIFF_CHECK=PASS_FOR_AUDIT_DOCS
BUILD=NOT_RUN_IMPLEMENTATION_BLOCKED
R1C_COMMIT_SHA=NOT_CREATED
REMOTE_TESTING_SHA=UNCHANGED_201ae4f977001629fd99b8d3ee070cfc777380f0
DELIGO_TESTING_DEPLOYMENT_ID=NOT_CREATED
DELIGO_TESTING_DEPLOYMENT_STATUS=NOT_APPLICABLE
DELIGO_TESTING_DEPLOYMENT_COMMIT=NOT_APPLICABLE
OPERATOR_UNIFIED_PUSH_CERTIFICATION=PENDING
FULL_CONTEXT_UPDATED=SI
FULL_CONTEXT_CONSISTENCY_CHECK=PASS
NEXT_ACTION=AUTHORIZE_PERSONAL_PUSH_SCHEMA_CHANGE_THEN_IMPLEMENT_ACCOUNT_LEVEL_SWITCH_AND_PRODUCER_DEDUPE
```

La certificación R1B queda detenida. No pedir `ACTIVADO`, no enviar Push real,
no crear pedidos de cancelación, no ejecutar cleanup, no iniciar T45 y no tocar
Production.
