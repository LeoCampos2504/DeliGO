# P2-T49 — Cierre final: certificación física completa en TESTING

Fecha: 2026-09-20
Alcance: DOCUMENTACIÓN / RECONCILIACIÓN DE ESTADO ÚNICAMENTE. Sin código
de producto, sin nueva implementación, sin prueba física, sin mutación
de DB, sin Production.

## 1. Preflight

```text
WORKTREE_PATH=C:/Leo Campos/Trabajo/deligo-main-limpio
BRANCH=work/p2-t43-r2
START_HEAD_SHA=eccf1866292eca82db87f3c07ce5c92788da8131
DIRTY_BEFORE=SI (3 archivos documentales pre-existentes de esta misma
  sesión: DELIGO_FULL_CONTEXT_LATEST.md, codex-reports/ROADMAP.md,
  codex-reports/P2_T44_R1P6I_ABSOLUTE_OPERATIONS_PUSH_TARGET.md —
  ninguno ajeno, ninguno de código)
```

Worktree T39 (`C:/Leo Campos/Trabajo/deligo-t39-admin`,
`work/p2-t39-admin-notifications`, HEAD `54d17d5`) confirmado intacto,
no tocado. `origin/main` reconfirmado en
`ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763` — Production sin cambios.

## 2. Línea de implementación certificada (R1 → R1D)

| Ronda | Objetivo | Commit |
|---|---|---|
| R1 | Terminal Mobile Shell + Chat Layout (h-dvh, overflow-hidden, header shrink-0, mensajes flex-1 min-h-0, composer shrink-0 + safe-area, logout compacto) | `443a37aa65520b65327e14c0e7603c622b4124fa` |
| R1B | Aislamiento visual del Chat personal en Operaciones + background refresh del chat Terminal (10s, best-effort) | `6380c762bb4e8a97eaf03b035b9bcf050945bb0e` |
| R1C | Aislamiento completo del runtime del Chat personal (`GlobalChatRuntime` separado, hooks incluidos, no sólo FAB/Sheet) en `/operaciones/**` | `b002958aaa613171283b9895dfb0fc0bfad7d3d2` |
| R1D | Presencia de mensajes + indicador de no-leídos por pedido en el panel PyR | `eccf1866292eca82db87f3c07ce5c92788da8131` |

```text
TESTING_DEPLOY_ID=68952a90-44e1-40fe-a53f-24d4c9371fb0
TESTING_DEPLOY_STATUS=SUCCESS
TESTING_DEPLOY_COMMIT=eccf1866292eca82db87f3c07ce5c92788da8131
DEPLOY_COMMIT_MATCH=SI
```

Reconfirmado (read-only) contra Railway: el deployment vigente en TESTING
sigue siendo ese mismo commit, sin ningún deploy posterior que lo
reemplace.

## 3. Certificación física — layout (R2)

```text
P2_T49_R2_LAYOUT_CASE_A=PASS
```
Mobile portrait / teclado cerrado: sin espacio vacío anormal, composer
visible al pie, el botón flotante de logout no tapa contenido, logout
compacto visible en el header del chat.

```text
P2_T49_R2_LAYOUT_CASE_B=PASS
```
Teclado móvil abierto: composer/input completamente visibles sobre el
teclado, botones accesibles, sin salto/corte de layout; al cerrar el
teclado la altura se recupera correctamente.

```text
P2_T49_R2_LAYOUT_CASE_C=PASS
```
Panel PyR mobile: el logout flotante sigue visible fuera del chat, no
tapa cards ni acciones, panel normal.

```text
P2_T49_R2_LAYOUT_CASE_D=PASS
```
Desktop: chat normal (header, composer, scroll de mensajes, logout en
header), panel normal (logout flotante visible, sin tapar contenido).

## 4. Certificación física — aislamiento del Chat personal (R2B Case E)

```text
P2_T49_R2B_CASE_E=PASS
BURBUJA_NARANJA_CHAT_PERSONAL_VISIBLE=NO
CHAT_PERSONAL_SE_ABRE_DESDE_OPERACIONES=NO
```

Con Cliente autenticado en una pestaña y Terminal Operaciones abierta en
otra del mismo navegador: la burbuja naranja del Chat personal no
aparece dentro de `/operaciones/**`, y el Chat personal no se abre desde
ahí. El Chat Cliente sigue disponible normalmente en su propia ruta — no
se cerró ni destruyó la sesión Cliente en ningún momento. Confirma en
producción física lo que R1B/R1C implementaron: `GlobalChatRuntime`
(hooks `useChatDeepLink`/`useChatActorReset` incluidos, no sólo
`ChatFab`/`ChatSheet`) no corre en ninguna ruta `/operaciones/**`.

## 5. Certificación física — frescura de background (R2B Case F)

```text
P2_T49_R2B_CASE_F=PASS
TERMINAL_CHAT_BACKGROUND_REFRESH_PHYSICAL=PASS
BACKGROUND_REFRESH_MODEL=BEST_EFFORT_BROWSER_TIMER
```

El operador dejó el chat Terminal abierto en una pestaña en background,
envió un mensaje desde Cliente, y comprobó de forma real que el mensaje
llegó sin depender de volver primero a la pestaña Terminal —
confirmando en dispositivo real el `TERMINAL_CHAT_REFRESH_INTERVAL_MS=10000`
con `allowHidden=true` implementado en R1B, preservando
`AbortController`/generación/`focus`/`visibilitychange`/cleanup. No se
declara hard realtime — sigue siendo explícitamente best-effort
(dependiente del throttling de timers en background que cada navegador
aplica), y la certificación física lo confirma como suficiente para el
caso de uso real.

## 6. Certificación física — indicador de mensajes (R2C Case H)

```text
P2_T49_R2C_CASE_H=PASS
ORDER_CARD_MESSAGE_INDICATOR_PHYSICAL=PASS
ORDER_CARD_UNREAD_TRANSITION_PHYSICAL=PASS
```

Confirmación literal del operador: "quedó perfecto". Se verificó
funcionalmente en TESTING el indicador implementado en R1D: pedido sin
mensajes sin badge, pedido con conversación leída con badge neutro
"Mensajes", pedido con mensajes de Cliente sin leer con badge acentuado
"1 mensaje nuevo"/"N mensajes nuevos" — sin necesidad de entrar al
pedido para detectarlo desde el panel principal.

## 7. Regresión general (R2B Case G)

```text
P2_T49_R2B_CASE_G=PASS
```

Basado en la evidencia física acumulada de las rondas anteriores: Chat
Cliente normal preservado, chat dedicado de Terminal funciona (enviar/
recibir), panel PyR funciona, polling de T45 preservado
(`REFRESH_MS=5000`, `countPedidosRecibidos`, chip/dot de pedido nuevo
sin cambios), indicador de mensajes funciona, logout correcto en todas
las superficies, layout desktop/mobile correcto, aislamiento Cliente/
Operaciones correcto. No se repitió ninguna prueba física en esta
ronda de cierre — se registra sobre la evidencia ya entregada por el
operador en las rondas R2/R2B/R2C.

## 8. Quality gate — ya certificado, no repetido

```text
AUTOMATED_TESTS_LATEST=142 pass / 0 fail (R1D, última ronda con cambio
  de código)
TSC_TOTAL_ERRORS=31
TSC_BASELINE_ERRORS=31
TSC_NEW_ERRORS=0
ESLINT=PASS
BUILD=PASS
DIFF_CHECK=PASS
```

Ningún archivo de producto/test se modificó en esta ronda de cierre —
no hay ninguna razón material para repetir estas suites; se reutiliza la
evidencia ya generada y verificada en R1D.

## 9. Invariantes preservadas

```text
P2_T44_STATUS_UNCHANGED=SI (PAUSED_UNRESOLVED_AFTER_TIMEBOX, sin tocar)
TERMINAL_OPERATIVA_PUSH_INVARIANT_PRESERVED=SI
  (TERMINAL_OPERATIVA_PUSH=NO_ES_ACTOR_PUSH_POR_DISEÑO — T49 completo,
  R1-R1D, nunca agregó PushSubscription/owner/columna a Terminal)
NEW_TERMINAL_REALTIME_ACTOR=NO (REALTIME_USER_TYPES sin cambios,
  cliente|negocio|repartidor únicamente)
T39_TOUCHED=NO
PRODUCTION_TOUCHED=NO (origin/main = ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763,
  reconfirmado en este cierre)
```

## 10. Estado final

```text
P2_T49_STATUS=CLOSED_TESTING_CERTIFIED
P2_T49_IMPLEMENTATION_COMPLETE=SI
P2_T49_AUTOMATED_CERTIFICATION=PASS
P2_T49_PHYSICAL_CERTIFICATION=PASS
P2_T49_R2_LAYOUT_A_D=PASS
P2_T49_R2B_CASE_E=PASS
P2_T49_R2B_CASE_F=PASS
P2_T49_R2B_CASE_G=PASS
P2_T49_R2C_CASE_H=PASS
RELEASE_ELIGIBLE=YES
PRODUCTION_PROMOTED=NO
PRODUCTION_TOUCHED=NO
```

No se usa `CLOSED_PRODUCTION` — T49 queda certificada en TESTING,
release-eligible, pero no fue promovida a `main`/Production en esta
tarea ni en ninguna de las rondas anteriores.

## 11. Cierre

```text
PRODUCT_FILES_CHANGED_DURING_CLOSEOUT=0
API_FILES_CHANGED_DURING_CLOSEOUT=0
SCHEMA_CHANGED=NO
MIGRATION_CREATED=NO
DB_MUTATION=NO
REALTIME_CHANGED=NO
PUSH_CHANGED=NO
```
