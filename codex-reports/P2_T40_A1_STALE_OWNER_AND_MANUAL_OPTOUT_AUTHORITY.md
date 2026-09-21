# P2-T40-A1 — Stale Owner Detach + Manual Push Opt-Out Authority

**Tipo:** READ-ONLY AUDIT + DESIGN CORRECTION sobre `P2_T40_A0_PUSH_SESSION_LIFECYCLE_AUDIT_DESIGN.md`. Cero implementación, cero mutación de push, cero cambio de login/logout/API/SW, cero DB/schema/migración, cero Production, cero test físico en esta ronda.

**Autoridad preservada de A0 (no rediseñada):**
```text
MODEL_C1_MULTI_BIND=CONFIRMADO_CORRECTO_NO_TOCAR
PHYSICAL_UNSUBSCRIBE_POLICY=SERVER_DETACH_ONLY_CONFIRMADO_CORRECTO_NO_TOCAR
ONE_PHYSICAL_PUSH_SUBSCRIPTION_PER_ORIGIN=SI
OWNER_DERIVED_SERVER_SIDE=SI
RECOMMENDED_LOW_LEVEL_PUSH_MODEL=PRESERVE_EXISTING
```
La tabla `PushSubscription` (clave única `(ownerType, ownerId, channel, endpoint)`) NO se rediseña en esta ronda ni se propone rediseñar.

---

## 0. Gate de autorización de R1

```text
P2_T40_R1_AUTHORIZED=NO
```
hasta resolver los tres gates de A1 — resultado de esta auditoría en §31.

---

## 1. Reclasificación de la expiración de sesión (§3 del prompt)

A0 llamó "Estado D / detached" al resultado de una expiración. Confirmado por lectura de `src/lib/auth.ts` (`validateSession()`, `validateOperationalSession()`): al expirar, la fila `PushSubscription` del ACTOR EXPIRADO **no se toca en absoluto** — sólo se borra la fila `Sesion` (lazy-delete, en la misma request que descubre `expiresAt < now`). Por tanto, para el actor cuya sesión expiró, el estado real es:

```text
SESSION_EXPIRY_CAN_LEAVE_STALE_OWNER_BINDING=SI
```

Nuevo estado, distinto de "Estado D" de A0:

**`STALE_AUTH_OWNER_BINDING`** — condición: `session(ownerA)` inválida/inexistente, `backend push row(ownerA)` existe y vigente, `physical endpoint` existe. Es el opuesto de "Estado D" (D = fila backend AUSENTE; esto es fila backend PRESENTE pero el dueño de la sesión que la creó ya no está autenticado). A0 conflacionó ambos bajo "detached"; A1 los separa porque tienen remedios opuestos: D necesita CREAR una fila, `STALE_AUTH_OWNER_BINDING` necesita evaluarse para posible BORRADO condicional.

---

## 2. Impacto real: ¿la entrega de Push requiere sesión activa? (§4)

Auditado por lectura completa de los 3 puntos del pipeline de envío:

- `src/lib/push-subscription-repository.ts` — cero referencia a `Sesion`/`expiresAt`/validación de sesión.
- `src/lib/push.ts` (incluye la llamada real `webpush.sendNotification()`, línea 751) — cero referencia a `Sesion`/`expiresAt`.
- `src/lib/operational-push-targets.ts` y los 6 notification senders (`mesa-order-ready-notification.ts`, `operations-cancellation-notification.ts`, `pyr-chat-notification.ts`, `pyr-new-order-notification.ts`, `pyr-new-review-notification.ts`, `salon-new-order-notification.ts`) — cero referencia a `Sesion`/`expiresAt`/`isSesionActiveById`.

El envío se resuelve **exclusivamente** por la existencia de una fila `PushSubscription` para el owner destinatario — nunca por si ese owner tiene una sesión de login actualmente válida. Confirmado:

```text
DOES_PUSH_DELIVERY_REQUIRE_ACTIVE_LOGIN_SESSION_AT_SEND_TIME=NO
EXPIRED_SESSION_OWNER_CAN_STILL_RECEIVE_PUSH=SI
```

No es una suposición — es la ausencia confirmada de cualquier chequeo de sesión en las 3 capas relevantes.

---

## 3. Escenario crítico A → B (§5)

Con `STALE_AUTH_OWNER_BINDING` confirmado (§1) y entrega sin chequeo de sesión (§2): tras `A` expirar sin logout explícito y `B` loguearse en el mismo navegador (mismo endpoint físico X vía la única `PushManager` subscription por origen — ya confirmado en A0), el modelo de datos permite simultáneamente `A/X` (stale) y `B/X` (nueva, creada por auto-rebind). Un envío dirigido explícitamente a `A` (por ejemplo, un pedido/reseña/mensaje que sigue asociado a la cuenta de A en el dominio de negocio, sin relación alguna con B) se resuelve leyendo la fila `A/X` — que sigue teniendo el endpoint físico real y válido — y `sendNotification()` la entrega sin ningún chequeo adicional. El Service Worker del navegador la recibe y la muestra sin importar qué cuenta esté actualmente "activa" en la UI (el Service Worker no tiene noción de "sesión actual", sólo de push events).

```text
STALE_A_PLUS_ACTIVE_B_SAME_ENDPOINT_POSSIBLE=SI
STALE_A_NOTIFICATIONS_VISIBLE_WHILE_B_ACTIVE=SI
CROSS_ACCOUNT_NOTIFICATION_LEAK_RISK=HIGH
```

`HIGH` (no `MEDIUM`) porque el escenario de mayor probabilidad real no es sólo "esperar 12h de TTL": es la reautenticación DIRECTA sin logout explícito previo en un dispositivo compartido (ver §4 abajo, hallazgo nuevo) — patrón ya documentado como real en este producto (tablet compartida de Mozo/Operaciones entre turnos, ver T52).

---

## 4. Hallazgo nuevo: el riesgo no depende sólo de la expiración por TTL

Auditado `src/app/api/auth/login/route.ts` y `src/app/api/operativo/login/route.ts`: **ningún login invalida ni borra la `Sesion` previa de otro usuario antes de crear la nueva** — cada login es puramente aditivo (nueva fila `Sesion` + cookie sobrescrita client-side). Esto significa que el mismo riesgo de `STALE_AUTH_OWNER_BINDING` ocurre no sólo cuando A expira por las 12h de TTL, sino **inmediatamente** cuando B se loguea directamente sobre una sesión de A todavía válida y sin que A haya cerrado sesión explícitamente — el patrón más probable en una tablet compartida de Mozo/Operaciones entre turnos. La corrección diseñada en §7-§8 cubre AMBOS disparadores con el mismo mecanismo, porque en ambos casos lo único que importa es: "¿hay un owner distinto ocupando el mismo slot de cookie/family inmediatamente antes de este login?" — independientemente de si ese owner anterior expiró por TTL o simplemente nunca cerró sesión.

---

## 5. Multi-bind legítimo vs owner obsoleto (§6)

```text
LEGITIMATE_MULTI_BIND_RULE=
  Dos filas del mismo endpoint físico son legítimas cuando pertenecen a
  FAMILIAS DE SESIÓN DISTINTAS que pueden estar simultáneamente
  autenticadas en el mismo navegador (ver §9: cliente/negocio/repartidor
  vs cuenta_operativa, cookies independientes, ambas potencialmente
  válidas al mismo tiempo por diseño) — o al mismo CuentaOperativa
  resuelto como un único owner lógico `cuenta_operativa:{id}` a través
  de `resolveOperationalPushTargets()` (múltiples vínculos
  Empleado/negocio no crean múltiples filas conflictivas: ya colapsan a
  una). Nunca se limpian de forma cruzada entre familias.

STALE_PREVIOUS_OWNER_RULE=
  Una fila es candidata a limpieza SÓLO cuando las 4 condiciones se
  cumplen simultáneamente: (1) pertenece a la MISMA family de
  cookie/sesión que la autenticación que se está estableciendo ahora
  mismo (mismo nombre de cookie: deligo_session_cliente,
  deligo_session_negocio, deligo_session_repartidor, o
  deligo_operativo_session); (2) su ownerId es distinto al nuevo owner
  recién autenticado; (3) el endpoint físico coincide EXACTAMENTE con
  el que el cliente reporta como su subscription física actual en esta
  misma operación; (4) la sesión de ese owner anterior en esa family ya
  no es la sesión vigente en este dispositivo (fue reemplazada por este
  login, sea por TTL o por reautenticación directa). Nunca se aplica
  "borrar cualquier owner que no sea el actual sobre el endpoint" de
  forma ciega — sólo el owner que ocupaba ESE MISMO slot de
  cookie/family inmediatamente antes.
```

Esto preserva exactamente el invariante de A0/schema ("ningún primitivo puede borrar la fila de un owner distinto al que la solicita") añadiendo una EXCEPCIÓN explícita, estrecha y verificable: el propio flujo de login del nuevo owner, actuando como agente autorizado únicamente sobre el owner que ocupaba su mismo slot de family inmediatamente antes, con el endpoint como prueba de coincidencia de dispositivo.

---

## 6. ¿Es identificable el owner anterior tras la expiración? (§7)

Auditado: `useAuthStore` (Zustand, cliente) se limpia por completo en logout/expiración — no retiene identidad previa. La cookie `deligo_session`/`deligo_session_{family}` se sobrescribe, no se "recuerda" en el cliente. **Pero el servidor sí tiene una vía**: la request de login del NUEVO owner (B) todavía porta, en sus cabeceras HTTP, la cookie ANTERIOR (la de A) si el navegador la seguía teniendo — el servidor puede leerla PASIVAMENTE (sin usarla para autenticar nada, sólo para identificar quién ocupaba ese slot) antes de sobrescribirla con el token de B. Esto es autoridad real, server-side, sin depender de ningún estado cliente frágil.

```text
PREVIOUS_OWNER_IDENTIFIABLE_AFTER_SESSION_EXPIRY=
  SI, EXCLUSIVAMENTE_SERVER_SIDE_EN_EL_MOMENTO_DEL_NUEVO_LOGIN
  (leyendo pasivamente la cookie de la MISMA family que la request de
  login todavía porta, antes de sobrescribirla — nunca desde
  localStorage/sessionStorage/estado cliente, que no retienen nada
  útil tras una expiración o un logout).
```

---

## 7. Dónde debe ocurrir el detach de una sesión expirada (§8)

| Opción | CORRECTNESS | SERVER_AUTHORITY | ABILITY_TO_IDENTIFY_OLD_OWNER | NETWORK_FAILURE | CROSS_ACCOUNT_SAFETY | MULTI_DEVICE_IMPACT | DIFF_SIZE | PRIVACY |
|---|---|---|---|---|---|---|---|---|
| **A — 401 client-handler** (propuesta original de A0) | Baja — el cliente ya perdió su sesión, no puede autenticar un DELETE normal de sí mismo | Ninguna en ese instante (sesión ya inválida) | No sin inventar un canal nuevo inseguro | N/A | Riesgo si se intenta "arreglar" con un `ownerId` enviado por el cliente (prohibido por diseño, ver P0) | N/A | Bajo | OK si no se implementa nada aquí |
| **B — server-side al invalidar la sesión** (dentro de `validateSession`/`validateOperationalSession`) | Media — el servidor SÍ conoce el owner saliente en ese instante | Alta (lectura de la propia fila `Sesion` antes de borrarla) | Sí, el owner sí es conocible | N/A (es server-side puro) | Segura en cuanto a owner, pero **no conoce el endpoint físico** de esa request (una request cualquiera que dispara un 401 no transporta el endpoint) | Ninguno controlable — no se puede limitar a "el dispositivo actual" sin el endpoint | Bajo | OK |
| **C — al siguiente login en el mismo navegador** (recomendada) | Alta — combina identidad del owner saliente (cookie previa, §6) + endpoint físico actual (reportado por el propio cliente que se loguea, que ya sabe leer su `PushManager` subscription) en una única request YA autenticada como el nuevo owner | Alta — el servidor actúa como agente del nuevo owner, con evidencia pasiva del owner anterior | Sí, completa | Reintentable de forma segura (operación idempotente, ver §5 clave única) | Alta — nunca actúa fuera del scope exacto (misma family + mismo endpoint) | Correctamente acotado al dispositivo actual (el endpoint reportado ES ese dispositivo) | Bajo-medio (una función nueva + un paso condicional en el flujo de login/rebind) | OK, no requiere exponer nada sensible nuevo |
| **D — combinación** | La combinación real recomendada es: dejar B tal cual ya funciona hoy (borrado lazy de la fila `Sesion`, sin cambios) + implementar C como el único punto real de limpieza de push. A NO se implementa. | — | — | — | — | — | — | — |

```text
RECOMMENDED_SESSION_EXPIRY_DETACH_POINT=C_NEXT_LOGIN_SAME_SLOT
  (generalizado a "reemplazo del owner en el mismo slot de
  cookie/family", cubre tanto expiración por TTL como reautenticación
  directa sin logout previo — ver hallazgo §4)
```

---

## 8. ¿Puede el 401 hacer un detach seguro? (§9)

```text
DETACH_AFTER_401_SERVER_AUTH_POSSIBLE=NO
```

Al momento del 401, `validateSession()`/`validateOperationalSession()` ya conoce el owner saliente (lectura antes del `delete`), pero **ninguna request que dispare ese 401 transporta el endpoint físico** — no hay forma de acotar un detach al "dispositivo actual" sin inventar un canal nuevo. Diseñar una llamada de seguimiento donde el cliente, tras ver el 401, envíe su propio `ownerId`/endpoint a un endpoint de limpieza es exactamente el patrón inseguro que P0 ya prohibió (el cliente no es prueba de posesión de un owner). Por tanto, correctamente, **no se propone ningún cambio en el 401-handler de `syncSession()` para hacer detach** — el diseño de A0 que apuntaba a tocar ese archivo para esto queda **corregido**: el 401-handler puede seguir limitándose a limpiar el estado cliente (`store.logout()`), sin push, porque el trabajo real de limpieza se hace en otro punto (§7, Opción C).

---

## 9. Expiración server-side: ¿existe un punto donde el owner todavía se conoce? (§10)

Confirmado en `src/lib/auth.ts`: SÍ, dentro de `validateSession()`/`validateOperationalSession()`, el owner es legible (`session.userId`, `session.userType`) en el mismo statement donde se detecta `expiresAt < now`, antes del `db.sesion.delete()`. Pero, como en §8, el servidor en ESE punto no recibe (ni puede recibir de forma segura, sin rediseñar cada endpoint que pueda disparar un 401) el endpoint físico del dispositivo que hizo esa request particular.

```text
SERVER_SIDE_EXPIRY_DETACH_FEASIBLE=PARCIAL
  (el owner es conocible en el momento exacto de la expiración; el
  endpoint físico NO lo es sin una superficie nueva dedicada a
  transportarlo — por eso no se recomienda actuar en ese punto; ver
  §7 Opción C para el punto donde SÍ hay autoridad completa)
```

---

## 10. Next-login cleanup — ¿existe un criterio seguro? (§11)

Sí — es exactamente `STALE_PREVIOUS_OWNER_RULE` de §5, no una heurística de "todo owner distinto de B debe borrarse" (explícitamente rechazada por el propio prompt y por MODEL-C1). El criterio es verificable con datos 100% disponibles en el momento del login: nombre de cookie coincidente (family), ownerId anterior != ownerId nuevo, endpoint físico coincidente exacto, sesión anterior ya no vigente.

```text
NEXT_LOGIN_STALE_OWNER_CLEANUP_SAFE=SI_CON_CRITERIO_ESTRICTO_SECCION_5
```

---

## 11. Autoridad persistida de "manual off" (§12-§13)

Auditado exhaustivamente:
- `prisma/schema.prisma` — **cero campo** de tipo `pushOptOut`/`pushEnabled`/`pushDisabledAt`/preferencia en `Cliente`, `Negocio`, `Repartidor`, `Empleado`, `CuentaOperativa`, ni ningún modelo de preferencias/settings genérico (se listaron los 40+ modelos del schema; no existe ningún `Preferencias`/`UserPreference`/`ConfiguracionUsuario`).
- `src/app/api/push/unsubscribe/route.ts` — el único efecto es `detachPushSubscriptionByEndpoint()` (borra la fila). Cero escritura adicional.
- Rutas operativas de push-subscription (`mozo`/`salon`/`pyr` panel) — mismo patrón, DELETE puro sin marca adicional.
- `localStorage`/`sessionStorage` — la única key relacionada con push es `deligo-permissions-prompted` (historial de prompt del navegador, no un opt-out de usuario).
- Ningún `AuditLog`/`Notificacion` registra el evento de "usuario desactivó push" como preferencia consultable después.

```text
MANUAL_OPT_OUT_PERSISTED_AUTHORITY_EXISTS=NO
MANUAL_OFF_AND_BROKEN_BINDING_CURRENTLY_INDISTINGUISHABLE=SI
```

Confirmado: hoy, `DETACHED_ACCIDENTAL` (fila perdida por el bug de expiración) y `MANUAL_OPT_OUT` (fila borrada porque el usuario lo pidió) son **exactamente el mismo estado observable** (fila ausente, permiso `granted`, física viva). Cualquier auto-rebind universal e incondicional sería incorrecto porque revertiría decisiones humanas explícitas indistinguiblemente de reparar accidentes.

---

## 12. Semántica actual de la UI y política recomendada (§14)

Copy real auditado en `src/components/client/client-profile-panel.tsx` (patrón idéntico en `config-tab.tsx`/`profile-tab.tsx`/`operaciones/cuenta/page.tsx`): un `Switch` binario etiquetado "Notificaciones push" con estado textual "Activadas"/"Desactivadas", presentado exactamente igual que cualquier otra preferencia durable de la misma pantalla (tema, etc.) — **sin ninguna advertencia de que el apagado sea temporal o dure sólo la sesión actual**.

```text
CURRENT_UI_MANUAL_OFF_SEMANTICS=
  IMPLICA_PERSISTENCIA_INDEFINIDA_HASTA_REACTIVACION_EXPLICITA
  (mismo patrón visual que cualquier toggle de Settings durable; nada
  en el copy sugiere "sólo por esta sesión")
```

Comparación de políticas:

| Política | USER_EXPECTATION | ANTI_NAG | IMPLEMENTATION_COMPLEXITY | PERSISTENCE_REQUIRED | DB_CHANGE_REQUIRED | SECURITY | CONSISTENCY_CON_UI_ACTUAL |
|---|---|---|---|---|---|---|---|
| M1 — sólo la sesión actual, próximo login re-vincula en silencio | Baja — contradice la expectativa de un Switch de Settings | Buena (nunca reaparece nada) | Baja | Ninguna | No | Revierte decisiones humanas sin aviso — mal | **Contradice el copy actual** |
| M2 — sobrevive logout/login; próximo login NO re-vincula, puede mostrar aviso/CTA | Alta — coincide con lo que el copy ya promete | Aceptable (un aviso pasivo, no un re-prompt de navegador) | Media (requiere distinguir opt-out de rotura, ver §16) | Sí, pero puede lograrse **sin schema** con un marcador local scoped por owner (mismo dispositivo) | No (ver §15) | Segura si el marcador nunca contiene datos sensibles | **Consistente** |
| M3 — persiste incluso entre dispositivos futuros | Muy alta (la más fuerte) | Buena | Alta | Sí, verdaderamente cross-device — requiere autoridad server-side | **Sí** (un campo/tabla nuevo) | Segura, pero mayor superficie | Consistente, pero más de lo que el copy actual necesariamente promete |

```text
RECOMMENDED_MANUAL_OFF_POLICY=M2_DEVICE_SCOPED_SIN_SCHEMA
PRODUCT_DECISION_REQUIRED=SI
  (M2 es la recomendación técnica más barata y coherente con el copy
  actual sin tocar schema; M3 es la más robusta pero exige que el
  operador autorice explícitamente una nueva persistencia server-side
  — decisión de producto, no técnica, fuera del alcance de esta
  auditoría resolverla unilateralmente)
```

---

## 13. ¿Se puede lograr sin cambio de schema? (§15-§16)

Un marcador local, **scoped por owner, sin PII**, resuelve la ambigüedad de forma segura para M2 en el mismo dispositivo:

- Clave: `deligo-push-optout:{ownerType}:{ownerId}` (el `ownerId` ya es un identificador opaco que el propio cliente ya recibe legítimamente en cada sesión — no es un dato nuevo expuesto).
- Nunca almacena: email, nombre, token, cookie, endpoint completo, ni ningún dato del §16 explícitamente prohibido.
- Se escribe SOLO cuando el usuario apaga el toggle explícitamente desde la UI; se borra SOLO cuando lo reactiva explícitamente.
- Scoped por `ownerType`+`ownerId`: una cuenta distinta en el mismo dispositivo (login/logout, cuenta distinta, multi-business CuentaOperativa — que ya colapsa a un único `ownerId` de cuenta) nunca colisiona ni hereda el marcador de otra.
- Limpieza al borrar cuenta: no requiere ninguna acción especial — es un dato puramente local del navegador, no vinculado a ningún registro server-side que sobreviva al borrado de la cuenta.
- **Limitación aceptada y explícita**: sólo protege el MISMO dispositivo/navegador donde el usuario apagó el toggle. Un login del mismo usuario en un dispositivo/navegador distinto no hereda el opt-out (ahí no hay ambigüedad real que resolver — es un dispositivo nuevo sin subscription física previa, el auto-rebind allí simplemente no aplicaría por falta de física, no por conflicto de decisión). Verdadera persistencia cross-device requeriría M3 (schema).

```text
MANUAL_OPT_OUT_WITHOUT_SCHEMA_CHANGE_FEASIBLE=SI
SAFE_LOCAL_OPT_OUT_MARKER_FEASIBLE=SI
SCHEMA_CHANGE_REQUIRED_FOR_CORRECT_MANUAL_OPT_OUT=NO
  (NO para una M2 device-scoped correcta y segura; SÍ sería necesario
  únicamente si el operador decide más adelante exigir M3 cross-device
  — decisión de producto separada, no bloqueante para R1 bajo M2)
```

---

## 14. CuentaOperativa — cierre de GAP-6 de A0 (§17)

Auditado `src/app/mozo/page.tsx` (líneas 120-174, función de refresco de `/api/operativo/me`) como el equivalente operativo de `syncSession()`: al recibir `res.status === 401` (o `data.estado === "sin_sesion"`), hace únicamente `setState({status: "no-session"})` — **transición de UI pura, cero llamada de red adicional, cero detach**. Mismo patrón exacto que el BUG-1 de A0, confirmado también para este actor. `createOperationalSession()`/`validateOperationalSession()` reutilizan literalmente el mismo modelo `Sesion`/`SESSION_DURATION_HOURS = 12` que las sesiones personales.

```text
OPERATIVE_SESSION_TTL=12_HORAS_MISMO_SESSION_DURATION_HOURS
OPERATIVE_SESSION_EXPIRY_HANDLER=
  EXISTE_PER_PAGINA (mozo/page.tsx y equivalentes en
  operaciones/cuenta, operaciones/ingresar — cada página maneja su
  propio fetch a /api/operativo/me, no hay un hook centralizado único)
OPERATIVE_SESSION_EXPIRY_PUSH_DETACH_CURRENT=NO
OPERATIVE_STALE_BINDING_POSSIBLE=SI
```

GAP-6 de A0 queda cerrado: CuentaOperativa tiene EXACTAMENTE el mismo gap que los actores personales, y la corrección de §7 (Opción C, next-login) aplica igual, usando `deligo_operativo_session` como el nombre de family/cookie relevante.

---

## 15. Alcance del manual-off de CuentaOperativa (§18)

Confirmado por dos fuentes independientes: (a) el binding backend usa `ownerType:"cuenta_operativa", ownerId: account.id` — un único owner lógico para TODA la cuenta, sin distinción por negocio/Empleado; (b) el copy real en `src/app/operaciones/cuenta/page.tsx` dice textualmente: *"Recibí avisos de los negocios y áreas donde tenés una relación operativa válida"* (plural explícito).

```text
OPERATIVE_MANUAL_OFF_SCOPE=ACCOUNT
```

---

## 16. Re-login mismo actor / actor distinto (§19-§20)

```text
SAME_ACCOUNT_RELOGIN_AUTO_REBIND=SI
  (caso ideal: logout explícito ya hizo detach limpio de A/X; A
  vuelve a loguearse; auto-rebind crea A/X de nuevo sin pedir permiso
  de navegador — sin cambios respecto a A0, sigue siendo seguro,
  SALVO que exista un opt-out local vigente de §13 para ese owner, en
  cuyo caso NO se re-vincula automáticamente, se respeta la decisión)

DIFFERENT_ACCOUNT_AFTER_EXPLICIT_LOGOUT_SAFE=SI
  (ya lo hacía A0 correctamente: detach exacto antes de logout, B
  luego crea su propia fila limpia)

DIFFERENT_ACCOUNT_AFTER_EXPIRY_SAFE=
  NO_SIN_LA_CORRECCION_DE_SECCION_7
  (con el diseño de A0 tal cual estaba escrito: NO era seguro — dejaba
  A/X stale y B/X coexistiendo, fuga confirmada en §3. Con la
  corrección de la Opción C (next-login, STALE_PREVIOUS_OWNER_RULE)
  aplicada: SI, seguro)
```

---

## 17. Familias de sesión simultáneas — multi-bind legítimo cross-family (§21)

Confirmado: `deligo_session`/`deligo_session_{family}` (personal) y `deligo_operativo_session` (CuentaOperativa) son cookies completamente independientes, sin ningún código que las correlacione o invalide una al crear la otra. Un mismo dispositivo puede legítimamente tener, por ejemplo, un Cliente autenticado en `/cliente` Y una CuentaOperativa autenticada en `/mozo` al mismo tiempo (escenario real: alguien que pide como cliente Y trabaja como mozo en el mismo teléfono).

```text
SIMULTANEOUS_DIFFERENT_SESSION_FAMILIES_SUPPORTED=SI
LEGITIMATE_CROSS_FAMILY_MULTI_BIND=SI
```

`STALE_PREVIOUS_OWNER_RULE` (§5) NUNCA cruza esta frontera — sólo actúa dentro de la MISMA family de cookie, exactamente para no romper este caso legítimo.

---

## 18. Same-family account switch (§22-§23)

```text
SAME_SESSION_FAMILY_STALE_BIND_POLICY=
  Al reemplazarse el owner dentro de la MISMA family (ej. Cliente A →
  Cliente B en el slot deligo_session_cliente, o CuentaOperativa A →
  CuentaOperativa B en deligo_operativo_session), el owner anterior YA
  NO debe seguir recibiendo push en ese endpoint — se limpia bajo
  STALE_PREVIOUS_OWNER_RULE (§5) en el momento del login de B.

SESSION_FAMILY_AWARE_STALE_CLEANUP_FEASIBLE=SI
  (es exactamente el mecanismo diseñado en §7 Opción C — ya es
  "family-aware" por construcción, porque el criterio exige coincidencia
  de nombre de cookie/family antes de actuar)
```

Ejemplo del propio prompt verificado contra la arquitectura real: `deligo_session` (Cliente A → Cliente B) se limpia; `deligo_operativo_session` (CuentaOperativa C) coexiste sin tocarse — correcto y ya cubierto por el diseño de §5/§7.

---

## 19. Dedup de entrega no es autorización (§24)

```text
DEDUP_IS_NOT_AUTHORIZATION=SI
```
Confirmado explícitamente: `resolveOperationalPushTargets()` deduplica por endpoint físico para evitar ENVIAR dos copias del MISMO evento a dos filas que resuelven al mismo dispositivo — pero esto es un problema de "no repetir", no de "verificar que el destinatario es quien debería recibir este evento". Un evento dirigido específicamente al owner A (vía su propia fila `A/X`) se envía igual, dedup o no, independientemente de que B también use ese dispositivo.

---

## 20. Corrección del contrato de auto-rebind de A0 (§25)

```text
A0_AUTO_REBIND_CONTRACT_SAFE_AS_WRITTEN=NO
```

El contrato original de A0 ("aditivo para el owner actual, sin tocar otros owners") es **necesario pero insuficiente**: crear la fila del nuevo owner sigue siendo correcto y debe preservarse tal cual, pero omitir cualquier limpieza deja sistemáticamente vivo el riesgo de fuga cross-account de §3/§4 en cada reemplazo de owner dentro de la misma family.

**Contrato corregido** (diseño, no implementado):
1. Verificar que existe sesión autenticada válida del nuevo owner (server-side) — sin cambios respecto a A0.
2. Verificar `Notification.permission === "granted"` + subscription física válida — sin cambios.
3. **Nuevo paso, en la MISMA operación atómica**: si existe una cookie de la MISMA family en la request (leída pasivamente, nunca usada para autenticar) cuyo owner es distinto al nuevo owner, y el endpoint físico reportado coincide con una fila `PushSubscription` de ese owner anterior → aplicar `STALE_PREVIOUS_OWNER_RULE` (borrar SÓLO esa fila específica, nunca ninguna otra).
4. Crear/renovar la fila del nuevo owner (paso original de A0, sin cambios).
5. Nunca ejecutar el paso 3 si existe un opt-out local vigente (§13) para el owner anterior específico — un opt-out explícito no se "limpia" como si fuera basura, simplemente no se auto-repara ni se auto-crea nada nuevo para él tampoco.
6. Nunca ejecutar el paso 4 (crear la fila del nuevo owner) si existe un opt-out local vigente para el NUEVO owner en este dispositivo — se respeta su decisión previa.

---

## 21. Corrección del Test 9 de A0 (§26)

```text
A0_TEST_9_SAFE_AS_WRITTEN=NO
```

A0 (Test 9) asumía: "Actor A expira → fila A queda; B rebind; fila A permanece" y lo calificaba de seguro. Bajo la corrección de §5/§20, esto es correcto **sólo si A y B pertenecen a families DISTINTAS** (multi-bind legítimo cross-family, §17) — si A y B pertenecen a la MISMA family (el caso que el propio Test 9 de A0 parecía estar describiendo, dos "actores" genéricos sin especificar family), la fila de A **debe limpiarse**, no "permanecer". Expectativa corregida:

> Test 9 corregido — dos variantes: (9a) A y B misma family (ej. ambos `cliente`): tras el login de B, la fila de A en ese endpoint específico debe estar ausente (limpiada por `STALE_PREVIOUS_OWNER_RULE`). (9b) A y B families distintas (ej. A `cliente`, B `cuenta_operativa`): tras el login de B, la fila de A debe seguir vigente sin cambios (multi-bind legítimo cross-family, nunca tocado).

---

## 22. Precondición backend para la certificación física Caso C de A0 (§27)

```text
PHYSICAL_CASE_C_BACKEND_PRECONDITION=
  El caso físico "sesión A expira → login B → B recibe → cero cruce
  con A" de A0 NO puede certificarse hoy: con el código actual
  fallaría (A/X stale confirmado en §1-§3). Es precondición haber
  implementado el contrato corregido de §20 (limpieza de
  STALE_PREVIOUS_OWNER en el login de B) ANTES de intentar este test
  físico. Además, el test tal como estaba redactado en A0 sólo
  verificaba que B recibe correctamente — debe AMPLIARSE para también
  enviar un evento de prueba dirigido explícitamente a A después del
  login de B y confirmar que NO aparece en el dispositivo (verificación
  negativa explícita, no sólo la positiva de B).
```

---

## 23. Responsabilidad final del flag de PermissionPrompt (§29)

```text
PERMISSION_PROMPT_FLAG_FINAL_RESPONSIBILITY=
  `deligo-permissions-prompted` debe representar EXCLUSIVAMENTE "¿ya se
  mostró/decidió el diálogo nativo del navegador en este dispositivo?"
  (evitar un segundo re-prompt de `Notification.requestPermission()`).
  NUNCA debe leerse ni escribirse como proxy de "el backend está
  vinculado" (eso lo responde `checkPersonalPushStatus`/la
  reconciliación server-side, autoridad exclusiva) ni de "el usuario lo
  apagó a propósito" (eso lo responde el marcador local owner-scoped de
  §13, autoridad exclusiva). Las tres responsabilidades quedan
  separadas en tres fuentes de verdad distintas, ninguna sustituye a
  otra.
```

---

## 24. Máquina de estados corregida (§30)

| Estado | DETECTION_AUTHORITY | AUTO_ACTION | CAN_REBIND | CAN_DELETE_BINDING | USER_MESSAGE | PERSISTENCE |
|---|---|---|---|---|---|---|
| **ON** | Server (fila vigente del owner actual + endpoint física coincide) | Ninguna | — | — | "Activadas" | N/A |
| **PERMISSION_DEFAULT** | Navegador (`Notification.permission`) | Mostrar prompt nativo, una vez por dispositivo (ya vigente) | N/A (aún no hay física) | N/A | Copy de invitación ya existente | `deligo-permissions-prompted` (sólo esto) |
| **PERMISSION_DENIED** | Navegador | Ninguna posible | No | No | Mensaje pasivo, instrucciones manuales | N/A |
| **PHYSICAL_MISSING** | Navegador (`getSubscription()` devuelve null pese a `granted`) | Ninguna automática (requiere gesto porque puede reabrir un flujo de permiso) | Sólo con gesto explícito del usuario | N/A | "Reactivar" en Ajustes | N/A |
| **BACKEND_DETACHED_REPAIRABLE** | Server (fila ausente del owner actual, física viva, SIN opt-out local vigente) | Auto-rebind silencioso (§20 pasos 1-2-4) | Sí, automático | N/A | Ninguno visible (transición silenciosa a ON) | N/A |
| **MANUAL_OPT_OUT** | Marcador local owner-scoped (§13) presente para este owner | Ninguna — nunca auto-rebind | No (hasta gesto explícito) | N/A (ya está borrada) | "Desactivadas" (idéntico texto que hoy — el usuario no distingue el motivo, sólo se comporta distinto internamente) | Marcador local `deligo-push-optout:{ownerType}:{ownerId}` |
| **STALE_PREVIOUS_OWNER** | Server, sólo en el momento de login de un owner distinto en la misma family (§5/§7) | Borrado condicional exacto (§20 paso 3) | No aplica (no es el owner actual) | Sí, exclusivamente esa fila específica | Ninguno (invisible para el usuario saliente, que ya no está autenticado) | N/A |
| **LEGITIMATE_MULTI_OWNER** | Server (familias distintas o mismo CuentaOperativa vía resolver) | Ninguna | N/A | Nunca | N/A | N/A |
| **CHECKING** | Cliente (llamada de reconciliación en curso) | Ninguna hasta resolver | — | — | "Comprobando estado..." (copy ya existente) | N/A |
| **REPAIRING** | Cliente (auto-rebind en curso) | Ejecutando §20 | — | — | Ninguno visible (silencioso por diseño) | N/A |
| **ERROR_RETRYABLE** | Cliente (fallo de red durante checking/repairing) | Reintento en el siguiente montaje relevante, sin bloquear | — | — | Ícono de alerta neutral (copy ya existente en `client-profile-panel.tsx`) | N/A |

---

## 25. Gate de autorización de R1 (§31) — resultado

```text
STALE_OWNER_POLICY_DEFINED=SI (secciones 5, 7, 10, 20)
EXPIRED_OWNER_DELIVERY_RISK_UNDERSTOOD=SI (secciones 2, 3, 4)
MANUAL_OPT_OUT_AUTHORITY_DEFINED=SI (secciones 11-13, marcador local M2)
DETACHED_VS_MANUAL_OFF_DISTINGUISHABLE=SI (una vez implementado el marcador de §13 — HOY, sin R1, es NO)
CROSS_ACCOUNT_NOTIFICATION_LEAK_PREVENTED=SI (en el diseño corregido de §20; NO en el código actual ni en el contrato original de A0)
OPERATIVE_SESSION_EXPIRY_AUDITED=SI (sección 14, GAP-6 de A0 cerrado)
LEGITIMATE_MULTI_BIND_PRESERVED=SI (secciones 5, 17 — la regla nunca cruza families ni toca el resolver de cuenta)
AUTO_REBIND_CONTRACT_SAFE=SI (contrato corregido de la sección 20; el original de A0 era NO)
```

Los 8 gates quedan en `SI` **sobre el diseño corregido de esta ronda** (no sobre el código actual, que sigue teniendo el bug y el contrato original inseguro). Por tanto:

```text
P2_T40_STATUS=AUDITED_PENDING_PRODUCT_OR_SECURITY_DECISION
```

La única decisión pendiente que NO es puramente técnica es la de §12 (`PRODUCT_DECISION_REQUIRED=SI` — confirmar que M2 device-scoped es la política deseada, o si el operador prefiere invertir en M3 cross-device con schema). Una vez esa única decisión de producto se confirme, R1 puede autorizarse formalmente sobre el plan de §26.

---

## 26. Plan R1 corregido (§32) — sólo referencia, no implementado

| Path | Change | Why | Owner/Family | Security effect | Rollback |
|---|---|---|---|---|---|
| `src/app/api/auth/login/route.ts` | Leer pasivamente la cookie de family anterior antes de sobrescribirla; si el cliente reporta un endpoint físico y hay match con `STALE_PREVIOUS_OWNER_RULE`, ejecutar el detach condicional (§20 paso 3) dentro de la misma request de login | Cierra el escenario A→B (§3/§4) en su origen real | cliente/negocio/repartidor | Elimina la fuga cross-account confirmada en §3 | Revertir el paso 3 deja el comportamiento actual (inseguro, ya documentado) |
| `src/app/api/operativo/login/route.ts` | Mismo tratamiento para `deligo_operativo_session` | Cierra GAP-6 (§14) | cuenta_operativa | Igual | Igual |
| `src/hooks/use-auth.ts` | Auto-rebind corregido (§20 pasos 1-2-4-5-6) llamado tras `syncSession()` exitoso, NO en el 401-handler (§8 — corrección explícita del plan original de A0) | Resuelve BUG-2/GAP-4 de A0 sin el patrón inseguro de detach-en-401 | cliente/negocio/repartidor | Nunca envía `ownerId` desde el cliente; server deriva todo | Deshacer el hook deja el estado actual (sin auto-repair, no inseguro) |
| `src/components/shared/permission-prompt.tsx` | Reducir su responsabilidad exclusivamente a §23; retirar `syncExistingPushSubscription()` inerte | Separa las 3 responsabilidades (§23) | Todos los actores personales | Ninguno negativo — elimina código muerto/engañoso | Revertir restaura el comportamiento actual (funcionalmente idéntico, sólo pierde claridad) |
| Nuevo: marcador local owner-scoped (helper compartido, ubicación exacta a definir en R1) | Implementar `deligo-push-optout:{ownerType}:{ownerId}` (lectura/escritura) | Habilita M2 sin schema (§13) | Todos | No sensible, sólo local | Borrar la key dejaría el comportamiento M1-like (aceptable como fallback, no ideal) |
| Tests nuevos | Cobertura de la matriz de §27 | Verificación del contrato corregido | — | — | — |

Ningún archivo de API/SW/DB/schema fuera de esta lista. Ninguno de estos cambios se ejecuta en esta ronda.

---

## 27. Matriz de tests corregida (§34)

A. A logout explícito → B login (misma family). Sin fuga cross-account. `PASS` esperado incluso sin R1 (ya correcto hoy).
B. A session expiry (o reautenticación directa sin logout) → B login (misma family). Sin fuga cross-account. `FAIL` hoy, `PASS` esperado tras R1 (§20).
C. Cliente A + CuentaOperativa B simultáneos (families distintas, legítimo). Ambos reciben sólo sus propios eventos, ninguno se borra. `PASS` esperado en cualquier escenario (nunca se tocan cross-family).
D. Manual OFF → reload misma sesión. Sigue OFF. `PASS` esperado hoy y tras R1.
E. Manual OFF → logout/login. Bajo M2: sigue OFF, sin auto-rebind, posible aviso/CTA pasivo. `FAIL` hoy (no hay autoridad persistida, técnicamente el resultado actual es indistinguible de un accidente), `PASS` esperado tras R1 con el marcador de §13.
F. Detached accidental (sin opt-out local) → login/reload. Auto-repair permitido. `PASS` esperado tras R1.
G. Permiso `granted` + binding correcto. No-op. `PASS` esperado hoy y tras R1.
H. Permiso `denied`. Sin re-prompt nativo. `PASS` esperado hoy y tras R1 (sin cambios en esta rama).
I. CuentaOperativa expiry (o reautenticación directa) → otra CuentaOperativa login mismo dispositivo. Sin fuga. `FAIL` hoy, `PASS` esperado tras R1.
J. Multi-business Operaciones (múltiples vínculos Empleado/negocio del mismo CuentaOperativa). Sin duplicados no autorizados — ya correcto hoy vía `resolveOperationalPushTargets()`, test de regresión únicamente.

---

## 28. Documentación (§35)

Creado: `codex-reports/P2_T40_A1_STALE_OWNER_AND_MANUAL_OPTOUT_AUTHORITY.md` (este archivo).

`ROADMAP.md` y `DELIGO_FULL_CONTEXT_LATEST.md` se actualizan a continuación de este reporte, únicamente con el resultado de esta ronda (sin reabrir ni modificar las entradas de A0 más allá de referenciar esta corrección).

---

## 29. Salida final (§36)

```text
P2_T40_A1_STATUS=AUDIT_AND_DESIGN_CORRECTION_COMPLETE

SESSION_EXPIRY_CAN_LEAVE_STALE_OWNER_BINDING=SI

DOES_PUSH_DELIVERY_REQUIRE_ACTIVE_LOGIN_SESSION_AT_SEND_TIME=NO
EXPIRED_SESSION_OWNER_CAN_STILL_RECEIVE_PUSH=SI

STALE_A_PLUS_ACTIVE_B_SAME_ENDPOINT_POSSIBLE=SI
STALE_A_NOTIFICATIONS_VISIBLE_WHILE_B_ACTIVE=SI
CROSS_ACCOUNT_NOTIFICATION_LEAK_RISK=HIGH

LEGITIMATE_MULTI_BIND_RULE=CROSS_FAMILY_O_MISMO_CUENTA_OPERATIVA_VIA_RESOLVER_VER_SECCION_5
STALE_PREVIOUS_OWNER_RULE=MISMA_FAMILY_MAS_OWNER_DISTINTO_MAS_ENDPOINT_COINCIDENTE_VER_SECCION_5

PREVIOUS_OWNER_IDENTIFIABLE_AFTER_SESSION_EXPIRY=SI_SOLO_SERVER_SIDE_EN_EL_LOGIN_SIGUIENTE

RECOMMENDED_SESSION_EXPIRY_DETACH_POINT=C_NEXT_LOGIN_SAME_SLOT

DETACH_AFTER_401_SERVER_AUTH_POSSIBLE=NO
SERVER_SIDE_EXPIRY_DETACH_FEASIBLE=PARCIAL_OWNER_SI_ENDPOINT_NO
NEXT_LOGIN_STALE_OWNER_CLEANUP_SAFE=SI_CON_CRITERIO_ESTRICTO

MANUAL_OPT_OUT_PERSISTED_AUTHORITY_EXISTS=NO

MANUAL_OFF_AND_BROKEN_BINDING_CURRENTLY_INDISTINGUISHABLE=SI

CURRENT_UI_MANUAL_OFF_SEMANTICS=IMPLICA_PERSISTENCIA_INDEFINIDA_HASTA_REACTIVACION_EXPLICITA
RECOMMENDED_MANUAL_OFF_POLICY=M2_DEVICE_SCOPED_SIN_SCHEMA
PRODUCT_DECISION_REQUIRED=SI

MANUAL_OPT_OUT_WITHOUT_SCHEMA_CHANGE_FEASIBLE=SI
SAFE_LOCAL_OPT_OUT_MARKER_FEASIBLE=SI

OPERATIVE_SESSION_TTL=12_HORAS
OPERATIVE_SESSION_EXPIRY_HANDLER=EXISTE_PER_PAGINA_SIN_HOOK_CENTRALIZADO
OPERATIVE_SESSION_EXPIRY_PUSH_DETACH_CURRENT=NO
OPERATIVE_STALE_BINDING_POSSIBLE=SI

OPERATIVE_MANUAL_OFF_SCOPE=ACCOUNT

SAME_ACCOUNT_RELOGIN_AUTO_REBIND=SI_SALVO_OPT_OUT_LOCAL_VIGENTE

DIFFERENT_ACCOUNT_AFTER_EXPLICIT_LOGOUT_SAFE=SI
DIFFERENT_ACCOUNT_AFTER_EXPIRY_SAFE=NO_SIN_CORRECCION_SECCION_7_SI_CON_ELLA

SIMULTANEOUS_DIFFERENT_SESSION_FAMILIES_SUPPORTED=SI
LEGITIMATE_CROSS_FAMILY_MULTI_BIND=SI

SAME_SESSION_FAMILY_STALE_BIND_POLICY=LIMPIAR_BAJO_STALE_PREVIOUS_OWNER_RULE
SESSION_FAMILY_AWARE_STALE_CLEANUP_FEASIBLE=SI

DEDUP_IS_NOT_AUTHORIZATION=SI

A0_AUTO_REBIND_CONTRACT_SAFE_AS_WRITTEN=NO
A0_TEST_9_SAFE_AS_WRITTEN=NO

PHYSICAL_CASE_C_BACKEND_PRECONDITION=REQUIERE_CORRECCION_SECCION_20_ANTES_DE_INTENTARSE_MAS_VERIFICACION_NEGATIVA_DE_A

PERMISSION_PROMPT_FLAG_FINAL_RESPONSIBILITY=SOLO_HISTORIAL_DE_PROMPT_NATIVO_VER_SECCION_23

STALE_OWNER_POLICY_DEFINED=SI
EXPIRED_OWNER_DELIVERY_RISK_UNDERSTOOD=SI
MANUAL_OPT_OUT_AUTHORITY_DEFINED=SI
DETACHED_VS_MANUAL_OFF_DISTINGUISHABLE=SI_TRAS_R1_NO_HOY
CROSS_ACCOUNT_NOTIFICATION_LEAK_PREVENTED=SI_EN_DISENO_CORREGIDO_NO_EN_CODIGO_ACTUAL
OPERATIVE_SESSION_EXPIRY_AUDITED=SI
LEGITIMATE_MULTI_BIND_PRESERVED=SI
AUTO_REBIND_CONTRACT_SAFE=SI_CONTRATO_CORREGIDO

SCHEMA_CHANGE_REQUIRED_FOR_CORRECT_MANUAL_OPT_OUT=NO

R1_AUTHORIZED=NO
R1_FILES_PLANNED=VER_SECCION_26

PRODUCT_FILES_CHANGED_DURING_A1=0
TEST_FILES_CHANGED_DURING_A1=0
API_FILES_CHANGED_DURING_A1=0
DB_CHANGED=NO
SCHEMA_CHANGED=NO
MIGRATION_CREATED=NO
PRODUCTION_TOUCHED=NO

P2_T40_STATUS=AUDITED_PENDING_PRODUCT_OR_SECURITY_DECISION
NEXT_ACTION=OPERATOR_CONFIRM_RECOMMENDED_MANUAL_OFF_POLICY_M2_THEN_AUTHORIZE_P2_T40_R1
```

**Próxima acción recomendada:** el operador confirma (o rechaza) `RECOMMENDED_MANUAL_OFF_POLICY=M2_DEVICE_SCOPED_SIN_SCHEMA` como la política de producto deseada. Con esa única confirmación, los 8 gates de §25 quedan cerrados de forma consistente y `P2-T40-R1` puede autorizarse formalmente sobre el plan de §26. Ninguna acción adicional se toma en este round por instrucción explícita del propio prompt de A1 (§37).
