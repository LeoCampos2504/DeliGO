# ROADMAP — DeliGO

# CURRENT AUTHORITATIVE BACKLOG (2026-09-11) — POST-P2-T46-R1

Esta sección es la autoridad primaria vigente. `CURRENT_AUTHORITATIVE_BACKLOG`
supersede todos los snapshots históricos posteriores de este archivo; esos
snapshots se conservan sólo como trazabilidad y no deben usarse para inferir
estados actuales.

```text
BACKLOG_AUTHORITY_BEFORE=STALE
BACKLOG_AUTHORITY_AFTER=RECONCILED_CURRENT
CURRENT_MAIN_SHA=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
CURRENT_T46_STABLE_TAG=p2-t46-stable-2026-09-11
CURRENT_T46_STABLE_TAG_PEELED_COMMIT=ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763
PUBLIC_RELEASE_AUTHORIZED=NO

P2_T29_STATUS=CLOSED_PRODUCTION_CHECKPOINTED
P2_T30_STATUS=CLOSED_PRODUCTION_CHECKPOINTED
P2_T31_STATUS=CLOSED_TESTING_CERTIFIED
P2_T32_STATUS=CLOSED_PRODUCTION_CHECKPOINTED
P2_T35_STATUS=CLOSED_PRODUCTION_CHECKPOINTED
P2_T36_STATUS=CLOSED_PRODUCTION_CHECKPOINTED
P2_T41_STATUS=CLOSED_PRODUCTION_CHECKPOINTED
P2_T42_STATUS=CLOSED_PRODUCTION
P2_T46_STATUS=CLOSED_PRODUCTION
P2_T46_OPERATOR_CERTIFICATION=PASS
P2_T46_RELEASE_STATUS=CLOSED_PRODUCTION_CHECKPOINTED
P2_T48_STATUS=CLOSED_PRODUCTION

P2_T32_ALREADY_PRODUCTION=SI
P2_T32_EXCLUDED_FROM_ACTIVE_BACKLOG=SI
R4_NEXT_TASK_P2_T32_VALID=NO
R4_NEXT_TASK_RECOMMENDATION_STATUS=SUPERSEDED_BY_POST_T46_BACKLOG_RECONCILIATION

P2_T02_STATUS=WAITING_FOR_ADDITIONAL_PHYSICAL_EVIDENCE
P2_T02_B4_IOS_STATUS=PASS
P2_T02_B4_ANDROID_STATUS=PENDING_DEVICE_AVAILABILITY
P2_T02_SOFTWARE_ACTIONABLE_NOW=NO
TEST_T02_ORDER_LEFT_ACTIVE=SI
P2_T23_STATUS=FUTURE_DEPENDS_ON_P2_T02_NOT_STARTED
P2_T24_STATUS=FUTURE_DEPENDS_ON_P2_T23_NOT_STARTED

NEGOCIO_OCCUPATION_CLOSE_LIVE_REFRESH_BUG=CONFIRMED_PHYSICAL
NEGOCIO_REFRESH_FINDING_STATUS=OPEN
NEGOCIO_REFRESH_EXISTING_TASK_OWNER=NONE
NEGOCIO_REFRESH_PRIORITY=TO_BE_TRIAGED
NEGOCIO_REFRESH_NEW_TASK=P2-T53
PREVIOUS_OCCUPATION_OPEN_ORDERS_SURFACE_FINDING_STATUS=RESOLVED_BY_P2_T46
PREVIOUS_OCCUPATION_CURRENT_SURFACE_ISOLATION=PASS
LEGACY_NULL_OCCUPATION_INFERENCE=NO
LEGACY_NULL_OCCUPATION_BACKFILL=NO
LEGACY_ACCOUNTING_RECONSTRUCTION=NO
```

## Backlog vigente por estado

### A. CLOSED / PRODUCTION

P2-T29, P2-T30, P2-T32, P2-T35, P2-T36, P2-T41, P2-T42, P2-T46 y P2-T48
están excluidas del backlog activo. P2-T31 está cerrada con certificación de
Testing y no se inventa un checkpoint Production que no esté demostrado.

### B. ACTIVE / ACTIONABLE

```text
P2-T43 — Employee Join Identity + Admin Feedback — P1 — READY_FUTURE
P2-T44 — Operaciones Personal Push UX + PyR Coverage — P1 — READY_FUTURE
P2-T45 — Terminal Operations Notification Architecture — P1 — READY_FUTURE
P2-T49 — Terminal Mobile Shell + Chat Layout — P1 — READY_FUTURE
P2-T53 — Negocio Occupation Close Live Refresh Parity — TO_BE_TRIAGED — READY_FUTURE
P2-T47 — Operations Product Personalization UX — P2_UX — READY_FUTURE
P2-T50 — Salon Statistics Custom Date Filtering — P2 — READY_FUTURE
P2-T51 — DeliGO Operaciones Home Visual Redesign — P2_UX — READY_FUTURE
P2-T52 — Operations PWA Identity Consolidation / Legacy Artifact Cleanup — PRIORITY_UNASSIGNED — READY_FUTURE
P2-T38 — PWA Installation UX — PRIORITY_UNASSIGNED — READY_FUTURE
P2-T40 — Push Session Lifecycle + Login Re-Enrollment — PRIORITY_UNASSIGNED — READY_FUTURE
P2-T39 — Admin/SuperAdmin Functional Review — PRIORITY_UNASSIGNED — READY_FUTURE
```

P2-T53 sólo audita y corrige la revalidación/refresh de Negocio → Salón tras
el cierre de una ocupación. No reabre P2-T48 ni P2-T46, no toca accounting,
payment, T02 ni la autoridad de ocupación. Su prioridad queda pendiente de
triage y no desplaza los P1.

### C. BLOCKED_EXTERNAL_OR_OPERATOR

```text
P2-T02 — GPS Android (Repartidor) — WAITING_FOR_ADDITIONAL_PHYSICAL_EVIDENCE
P2-T23 — movimiento exterior — FUTURE_DEPENDS_ON_P2_T02
P2-T24 — final delivery GPS — FUTURE_DEPENDS_ON_P2_T23
P2-T34 — Android Cliente/Repartidor Session Isolation — READY_TO_START,
          bloqueada para certificación/avance físico por falta de Android
P2-T33 — Final Security Review — bloqueada hasta T38/T40/T39 y funcionales
P2-T37 — P2 Final Audit / Launch Readiness — bloqueada por el backlog previo
```

### D. DEFERRED

```text
Support/Instagram contact surface — DEFERRED_TO_END_OF_CURRENT_BACKLOG
F-P2-TESTINFRA-01 — deferred testing DB reliability
F-P2-T30-01 — non-blocking testing data hygiene
P2-T19 — optional deferred post-launch
```

### E. FINAL_REVIEW_TASKS

P2-T33 y P2-T37 permanecen al final de la secuencia: no son la próxima tarea
funcional mientras existan los prerequisitos indicados.

```text
OPEN_P0_TASKS=0
OPEN_P1_HIGH_TASKS=0
OPEN_P1_TASKS=4
OPEN_P2_TASKS=3
OPEN_PRIORITY_UNSPECIFIED_TASKS=11
ACTIONABLE_NOW_TASKS=12
BLOCKED_TASKS=6
DEFERRED_TASKS=1

NEXT_RECOMMENDED_SOFTWARE_TASK=P2-T43
NEXT_RECOMMENDED_SOFTWARE_TASK_TITLE=Employee Join Identity + Admin Feedback
NEXT_RECOMMENDED_SOFTWARE_TASK_PRIORITY=P1
NEXT_RECOMMENDED_SOFTWARE_TASK_REASON=Primer P1 accionable del backlog vigente después de excluir todos los cierres Production, mantener T02/T34 bloqueadas por hardware y no permitir que el finding sin prioridad triageada P2-T53 desplace un P1.
ALTERNATIVE_NEXT_TASK_1=P2-T44
ALTERNATIVE_NEXT_TASK_2=P2-T45
```

R4 se conserva como artefacto histórico sin reescritura; su recomendación de
P2-T32 queda supersedida únicamente por esta reconciliación.

# HISTORICAL SNAPSHOT (2026-09-10) — SUPERSEDED BY CURRENT SECTION ABOVE

**DO NOT INFER CURRENT STATUS FROM HISTORICAL SNAPSHOTS BELOW.** Todo lo
que sigue después de esta sección es un log cronológico de snapshots
históricos — muchos describen estados YA SUPERADOS por trabajo
posterior. Esta sección es la única referencia primaria para saber qué
está pendiente, diferido, bloqueado, absorbido o eliminado. Se actualiza
en cada reconciliación de backlog; los snapshots históricos de abajo NO
se reescriben salvo corrección puntual de errores documentales (nunca
se borra historia). Fuente: `codex-reports/P2_CURRENT_AUTHORITATIVE_
BACKLOG_RECONCILIATION.md` (2026-09-09).

```text
LAST_RECONCILED=2026-09-10 (P2-T46 — architecture audit stop gate)
P2_T46_STATUS=STOPPED_AUDIT_GATE_WAITING_FOR_APPROVAL
P2_T46_REPORT=codex-reports/P2_T46_TABLE_ACCOUNT_TICKET_HISTORY_CANONICAL_DETAIL.md
T46_ARCHITECTURE_AUDIT_COMPLETE=SI
T46_SCHEMA_CHANGE_REQUIRED=SI_FOR_ACCOUNT_PAYMENT_AUTHORITY
T46_HISTORICAL_BACKFILL=AMBIGUOUS_FOR_LEGACY_NULL_OCCUPATION
BASELINE_AT_RECONCILIATION=testing-codex@bb228ee43c89073a4355e6a012bb9aeaf3669dcb / main@46a1d55634e8bd848e160302cdb64a32be241c89
P2_T42_STATUS=CLOSED_PRODUCTION
P2_T42_RELEASE_COMMIT=46a1d55634e8bd848e160302cdb64a32be241c89
P2_T42_PROMOTION=DIRECT_CHERRY_PICK_EXACT_SCOPE_FAST_FORWARD_NO_FORCE
P2_T42_PRODUCTION_DEPLOY=08a9bc74-67df-4935-adb6-7de8e1a30c91_SUCCESS_RUNNING_EXACT_COMMIT
P2_T42_STABLE_TAG=p2-t42-stable-2026-09-10
P2_T48_STATUS=CLOSED_PRODUCTION
P2_T48_SOURCE_COMMIT=bb228ee43c89073a4355e6a012bb9aeaf3669dcb
P2_T48_COMMIT=946f8c2404df8be6a1e7252f3d7d2ba520d337f8
P2_T48_TESTING_DEPLOYMENT=d5497cb8-34a0-4835-b2f8-4c117c23a325_SUCCESS_RUNNING_EXACT_COMMIT
P2_T48_PRODUCTION_DEPLOYMENT=96ef5efc-4678-40cd-9a96-966c839201f1_SUCCESS_RUNNING_EXACT_COMMIT
P2_T48_PHYSICAL_CERTIFICATION=PASS_CASE_A_CASE_B_CASE_C
P2_T48_RELEASE_ELIGIBLE=SI
P2_T48_STABLE_TAG=p2-t48-stable-2026-09-10
P2_T48_STABLE_TAG_SHA=946f8c2404df8be6a1e7252f3d7d2ba520d337f8
P2_T48_R2_REPORT=codex-reports/P2_T48_R2_CURATED_PRODUCTION_PROMOTION.md
NEGOCIO_OCCUPATION_CLOSE_LIVE_REFRESH_BUG=CONFIRMED_PHYSICAL
NEGOCIO_OCCUPATION_REFRESH_ROOT_CAUSE=UNKNOWN_PENDING_AUDIT
NEGOCIO_OCCUPATION_REFRESH_TARGET_TASK=TO_BE_RECONCILED
PREVIOUS_OCCUPATION_OPEN_ORDERS_SURFACE_IN_NEXT_OCCUPATION=CONFIRMED_PHYSICAL
PREVIOUS_OCCUPATION_OPEN_ORDERS_PROVISIONAL_TARGET=P2-T46
TARGET_CONFIRMATION_REQUIRED_DURING_T46_AUDIT=SI
ORDER_OCCUPATION_AUTHORITY=PARTIAL_DIRECT_ID_LEGACY_NULL_AMBIGUOUS
NEXT_RELEASE_CANDIDATE=NONE
P2_T02_STATUS=WAITING_FOR_ADDITIONAL_PHYSICAL_EVIDENCE
TEST_T02_ORDER_LEFT_ACTIVE=SI
P2_T23_STATUS=FUTURE_DEPENDS_ON_P2_T02_NOT_STARTED
P2_T24_STATUS=FUTURE_DEPENDS_ON_P2_T23_NOT_STARTED
NEXT_ACTION=APROBAR O RECHAZAR DELTA DE PAGO/CUENTA Y POLÍTICA DE LEGACY ORDERS
```

## Current Physical Certification Strategy

```text
PHYSICAL_IOS_AVAILABLE=SI
PHYSICAL_ANDROID_AVAILABLE=NO
CURRENT_PHYSICAL_CERTIFICATION_POLICY=IOS_NOW_ANDROID_DEFERRED_BATCH
ANDROID_ABSENCE_BLOCKS_SOFTWARE_PROGRESS=NO
ANDROID_SPECIFIC_GATES_REMAIN_OPEN=SI
ANDROID_ACCUMULATED_PHYSICAL_MATRIX=EXECUTE_WHEN_DEVICE_RETURNS
P2_T02_B3_STATUS=IOS_SHORT_BACKGROUND_CERTIFIED_ANDROID_PENDING
P2_T02_B3_IOS_STATUS=IOS_SHORT_BACKGROUND_CERTIFIED
P2_T02_B3_ANDROID_STATUS=PENDING_DEVICE_AVAILABILITY
P2_T02_B4_STATUS=IOS_CERTIFIED_ANDROID_PHYSICAL_PENDING
P2_T02_B4_IOS_STATUS=IOS_CERTIFIED
P2_T02_B4_ANDROID_STATUS=PENDING_DEVICE_AVAILABILITY
P2_T02_B4_R3_STATUS=IOS_PHYSICAL_PASS_CLOSEOUT
P2_T02_B4_R3_COMMIT=fb3e584259cb2c57605c783543c7fdb1dc845454
P2_T02_B4_R3_TESTING_DEPLOYMENT=b54f0214-69a0-4e93-8589-fc2f37054301_SUCCESS
IOS_B4_RETURN_FROM_GOOGLE_MAPS_ROUTE_RECOVERY=RESOLVED_AND_PHYSICALLY_CERTIFIED_IOS
ANDROID_B3_PHYSICAL=PENDING_DEVICE_AVAILABILITY
ANDROID_B4_PHYSICAL=PENDING_DEVICE_AVAILABILITY
P2_T02_STATUS=WAITING_FOR_ADDITIONAL_PHYSICAL_EVIDENCE
P2_T02_IOS_INDOOR_STATUS=PASS_FOR_TESTED_SCENARIOS
P2_T02_ANDROID_STATUS=PENDING_DEVICE_AVAILABILITY
TEST_T02_ORDER_LEFT_ACTIVE=SI
NEXT_RECOMMENDED_SOFTWARE_TASK=P2-T46
P2_T23_STATUS=FUTURE_DEPENDS_ON_P2_T02_NOT_STARTED
P2_T24_STATUS=FUTURE_DEPENDS_ON_P2_T23_NOT_STARTED
```

P2-T02-B4-R3 corrigió el ciclo de vida de la ruta interna al regresar de
Google Maps: señales `visibilitychange`/`pageshow`/`focus` coalescidas,
retry condicionado, timeout de 10 s, estados terminales, protección contra
respuestas stale y desmontaje real al cerrar navegación. El operador
confirmó en iPhone ruta inicial, retorno desde Google Maps sin reiniciar la
PWA y close/reopen; el finding `IOS_B4_RETURN_FROM_GOOGLE_MAPS_ROUTE_RECOVERY_FAIL`
queda `RESOLVED_AND_PHYSICALLY_CERTIFIED_IOS`. Ver
`codex-reports/P2_T02_B4_R3_IOS_MAPS_RETURN_ROUTE_RECOVERY.md`.

La disponibilidad de iPhone permitió certificar los escenarios iOS cubiertos.
La ausencia actual de Android no bloquea el avance documental/software, pero
no cierra los gates específicos Android; se acumulan para una matriz posterior
con el dispositivo disponible. P2-T23 y P2-T24 no se inician todavía porque
requieren evidencia exterior de movimiento.

## Findings físicos adyacentes registrados por P2-T48-R1

```text
NEGOCIO_OCCUPATION_CLOSE_LIVE_REFRESH_BUG=CONFIRMED_PHYSICAL
NEGOCIO_OCCUPATION_DATA_CORRECT_AFTER_REOPEN=SI
NEGOCIO_REQUIRES_VIEW_CLOSE_REOPEN_TO_REFRESH=SI
SALON_PERSONAL_SAME_EVENT_REFRESHES_CORRECTLY=SI
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
```

Ambos findings permanecen abiertos y no reciben un T-ID nuevo en esta
reconciliación. El primero requiere una auditoría específica de refresh de
Negocio/Salón; el segundo queda provisionalmente relacionado con P2-T46,
sujeto a confirmar la autoridad de cuenta/historial durante esa auditoría.
Por prioridad P1 y por su relación directa con el finding de trazabilidad de
cuenta/historial, `P2-T46` queda como la siguiente tarea recomendada; no se
inicia T46 ni se implementa ninguno de los dos findings aquí.

## Post-P2 / DeliGO Mobile Native Full Platform

```text
STATUS=APPROVED_FUTURE_PROGRAM_NOT_STARTED
TRIGGER=AFTER_ALL_CURRENT_T_TASKS_AND_FINAL_PRODUCTION_STABILITY
TARGETS=ANDROID_GOOGLE_PLAY_AND_IOS_APP_STORE
SCOPE=FULL_DELIGO_NOT_ONLY_REPARTIDOR
INITIAL_TECH_DIRECTION=CAPACITOR_FIRST_SHARED_CODEBASE
PLATFORM_NATIVE_CAPABILITIES=ANDROID_AND_IOS_WHERE_REQUIRED
WEB_PWA_CONTINUITY=PRESERVED_DURING_MIGRATION
NATIVE_IMPLEMENTATION_STARTED=NO
```

Esta dirección futura no autoriza mover el roadmap actual antes de P2-T37 ni
crear ahora directorios/dependencias Capacitor, Android o iOS.

```text
OPERATIONS_SINGLE_PWA_IDENTITY=SI — Empleado/Mozo/PyR/Salón/TerminalOperativa son áreas/roles DENTRO de la única identidad instalable "DeliGO Operaciones", nunca PWAs separadas por diseño actual. Empleado/Mozo/Salón fueron PWAs separadas en una arquitectura ANTERIOR — ver P2_OPERATIONS_SINGLE_PWA_IDENTITY_AUTHORITY_CORRECTION.md
CANONICAL_ACTIVE_PWA_IDENTITIES=cliente, negocio, repartidor, admin, operaciones (5) — confirmado por auditoría real de código (PRINCIPAL_PWA_ROLES + admin), no asumido
PRESENCE_OF_LEGACY_ASSET_DOES_NOT_IMPLY_ACTIVE_PRODUCT_IDENTITY=SI — los manifests/icons de empleado/mozo/salon siguen existiendo en el repo (8 archivos de manifest en total) sin que eso implique 3 identidades de producto activas pendientes
```

## Epics/tareas grandes cerradas — Production checkpoint

```text
P2_T29_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (epic A-E completo, orden aceptado/esperando_repartidor)
P2_T31_STATUS=CLOSED_TESTING_CERTIFIED (Web Push, certificación física completa iOS+Android)
P2_T27_STATUS=MERGED_CLOSED_BY_T29A (nunca implementado por separado, fusionado a T29A)
P2_T18_STATUS=CLOSED (chat realtime — recertificado con matriz completa actor/dispositivo/lifecycle, incluido typing; NO se reabre por snapshots históricos de "PAUSED_PENDING..." que aparecen más abajo — esos quedaron superados sin que el archivo se actualizara, ver reconciliación §5)
P2_T30_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (higiene de fixtures SuperAdmin, test-only; promovido a main/Production 2026-09-09 junto a P2-T32, commit 8011ee3, tag p2-t30-t32-stable-2026-09-09)
P2_T32_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (unificación de formulario de dirección Cliente + deep-link a Perfil; certificación física de 4 casos PASS; promovido a main/Production 2026-09-09, commit 8011ee3, tag p2-t30-t32-stable-2026-09-09 — ver P2_T30_T32_PROMOTION_TO_MAIN_AND_PRODUCTION.md)
P2_T35_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (iOS/PWA static-contract hygiene, test-only; promovido a main/Production 2026-09-10 junto a P2-T36, commit 773664f, tag p2-t35-t36-stable-2026-09-10 — ver P2_T35_T36_PROMOTION_TO_MAIN_AND_PRODUCTION.md)
P2_T36_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (PWA/Branding Hygiene — certificación física Android PASS en los 4 controles sobre TESTING; maskable safe-zone 5_OF_5 identidades PWA canónicas, badge compartido y SW cache-bypass RESUELTOS; promovido a main/Production 2026-09-10, commit 773664f, tag p2-t35-t36-stable-2026-09-10 — ver P2_T35_T36_PROMOTION_TO_MAIN_AND_PRODUCTION.md)
P2_T41_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (Terminal Read-Only Action Authorization — fix server-side (deny 403 en cancelar pedido y cerrar cuenta comercial para Terminal Operativa) + UI, certificación física/browser del operador PASS en los 5 pasos del checklist sobre TESTING; promovido a main/Production 2026-09-10, commit bb17c7dd1eb9b8f4cb94d03de834019baf182987 (source testing-codex@fb404a2), tag p2-t41-stable-2026-09-10 — ver P2_T41_PROMOTION_TO_MAIN_AND_PRODUCTION.md)
```

## Backlog activo — orden auditado (dependencias duras verificadas, no por comodidad)

```text
1. P2-T02 — GPS Android (Repartidor) — WAITING_FOR_ADDITIONAL_PHYSICAL_EVIDENCE (B3 iOS short background certificado best-effort throttled; B4 iOS certificado incluyendo retorno desde Google Maps y close/reopen sobre R3 `fb3e584`, Android B3/B4 pendientes por disponibilidad; movimiento exterior/T23/T24/final delivery aún pendientes — ver reportes B3/B4/R3/R3-R1)
2. P2-T23 — FUTURE, depende de P2-T02 (dependencia dura)
3. P2-T24 — FUTURE, depende de P2-T23 (dependencia dura)
4. P2-T34 — ANDROID CLIENTE/REPARTIDOR SESSION ISOLATION — READY_TO_START (nueva ID formal 2026-09-09 para el finding F-P2-T31-R23B-01, ya existente; requiere hardware Android; nueva evidencia física 2026-09-10 vía P2-T02-B1: la PWA de Repartidor instalada en Android puede pedir login de nuevo aunque ya hubiera sesión en una pestaña Chrome previa — ver P2_T02_B1_REPARTIDOR_PWA_POST_LOGIN_ROUTING.md §7, no investigado ahí)
```

**Hallazgos Operaciones/Salón — revisión manual física del operador
(nueva ID formal 2026-09-09, ver
`P2_OPERACIONES_SALON_OPERATOR_MANUAL_REVIEW_BACKLOG_RECONCILIATION.md`)
— prioridad interna 1-12, agregados sin reemplazar el roadmap global:**

```text
5. P2-T41 — TERMINAL READ-ONLY ACTION AUTHORIZATION — CLOSED_PRODUCTION_CHECKPOINTED (P0 — fix server-side (deny 403 en cancelar pedido y cerrar cuenta comercial de Terminal Operativa) + UI, 243 pass/0 fail (cifra corregida, ver P2_T41_PROMOTION_TO_MAIN_AND_PRODUCTION.md §8); certificación física/browser del operador PASS en los 5 pasos del checklist; promovido a main/Production 2026-09-10, commit bb17c7dd1eb9b8f4cb94d03de834019baf182987, tag p2-t41-stable-2026-09-10; T46 sigue dependiendo de esta autoridad, ya disponible, para cualquier acción mutante de cuenta)
6. P2-T42 — PYR EMPLOYEE + TERMINAL ORDER WORKFLOW PARITY — IMPLEMENTED_TESTED_DEPLOYED_TESTING_OPERATOR_REVIEW_TODO_PASS_PENDING_FORMAL_CLOSEOUT_CURATED_PROMOTION (P1_HIGH — commit `eb2af3a`, 134 pass/0 fail, deploy Testing y revisión manual del operador TODO_PASS; no ejecutar en esta tarea. Próxima tarea recomendada: `P2_T42_FORMAL_CLOSEOUT_AND_CURATED_PROMOTION`, sin promover HEAD completo ni B1/B3/B4/R3)
7. P2-T48 — SALON PERSONAL OCCUPATION STATE PARITY — CLOSED_PRODUCTION (P1 — casos físicos A/B/C PASS; release curado `946f8c2`, Production `96ef5efc`; tag `p2-t48-stable-2026-09-10`; findings adyacentes abiertos y no implementados)
8. P2-T43 — EMPLOYEE JOIN IDENTITY + ADMIN FEEDBACK — READY_FUTURE (P1 — admin sin feedback al vincularse un empleado + admin no debe declarar identidad del empleado; agrupa puntos 2/10)
9. P2-T44 — OPERACIONES PERSONAL PUSH UX + PYR COVERAGE — READY_FUTURE (P1 — "Enviar prueba" visible en UI normal de Mozo + popover roto en móvil + PyR sin notificaciones equivalentes; agrupa puntos 3/12; DISTINTA de P2-T40)
10. P2-T45 — TERMINAL OPERATIONS NOTIFICATION ARCHITECTURE — READY_FUTURE (P1 — Terminal Salón tiene avisos, Terminal PyR no; decisión de producto nueva, auditar mecanismo real de Salón primero; punto 19; preserva TERMINAL_OPERATIVA_PUSH=NO_ES_ACTOR_PUSH_POR_DISEÑO de P2-T12)
11. P2-T46 — TABLE ACCOUNT + TICKET + HISTORY CANONICAL DETAIL — READY_FUTURE (P1 — pago debe ir al cierre de cuenta no al pedido individual, "Tu cuenta" interactiva, ticket con jerarquía visual, historial Salón con detalle completo; agrupa puntos 4/6/7/8; punto 15 usado como referencia, NO bug; requiere autoridad de P2-T41 para cualquier acción mutante)
12. P2-T49 — TERMINAL MOBILE SHELL + CHAT LAYOUT — READY_FUTURE (P1 — Terminal Chat móvil con área vacía enorme, botón "Cerrar terminal" superpuesto al composer; agrupa puntos 17/18)
13. P2-T47 — OPERATIONS PRODUCT PERSONALIZATION UX — READY_FUTURE (P2_UX — inconsistencia visual, posible duplicación "Aderezos/aderezos" a auditar antes de asumir bug; punto 5)
14. P2-T50 — SALON STATISTICS CUSTOM DATE FILTERING — READY_FUTURE (P2 — agregar día/mes/rango personalizado preservando quick filters existentes; punto 9)
15. P2-T51 — DELIGO OPERACIONES HOME VISUAL REDESIGN — READY_FUTURE (P2_UX — home sin identidad visual equivalente a otras superficies DeliGO, sin tocar workflows/permissions; punto 1)
16. P2-T52 — OPERATIONS PWA IDENTITY CONSOLIDATION / LEGACY ARTIFACT CLEANUP — READY_FUTURE (RETITULADA 2026-09-09, ver P2_OPERATIONS_SINGLE_PWA_IDENTITY_AUTHORITY_CORRECTION.md — NO es reparación de arte: Empleado/Mozo/Salón fueron PWAs separadas en arquitectura ANTERIOR, hoy consolidadas en DeliGO Operaciones; auditoría confirmó que Mozo AÚN emite una identidad PWA separada activa y funcional en /mozo — vía DynamicManifest/role-config.ts, no vía T36 — objetivo: migrar esa identidad a Operaciones y evaluar limpieza de wiring inerte de Empleado/Salón; NO tocar los íconos 192px de notificación Push por área, que siguen siendo uso legítimo independiente)
```

```text
17. P2-T38 — PWA INSTALLATION UX (Android completion-state + iOS guided tutorial) — READY_FUTURE (nueva ID formal 2026-09-09, ver P2_T32_PHYSICAL_CERTIFICATION_CLOSEOUT_AND_BACKLOG_ADDITIONS.md §4; formaliza como tarea ejecutable el finding F-P2-T31-R23A-03 ya existente, sin reemplazarlo)
18. P2-T40 — PUSH SESSION LIFECYCLE + LOGIN RE-ENROLLMENT — READY_FUTURE (nueva ID formal 2026-09-09, ver P2_T40_PUSH_SESSION_LIFECYCLE_BACKLOG_REGISTRATION.md; requisito nuevo del operador tras P2-T32 sobre reconciliación de estado Push al reautenticar, especialmente tras expiración de sesión; NO reabre P2-T31, que permanece CLOSED; sin dependencia dura con P2-T38, colocada entre T38 y T39 por pedido explícito del operador de ejecutarse antes de T33/T37; DISTINTA de P2-T44/P2-T45, ver deslinde en el reporte de reconciliación §7)
19. P2-T39 — ADMIN/SUPERADMIN FUNCTIONAL REVIEW — READY_FUTURE (nueva ID formal 2026-09-09, ver §5 del mismo reporte; funcional/UX, explícitamente DISTINTA de P2-T33 y debe ejecutarse ANTES; NO reabre P2-T26)
20. P2-T33 — FINAL SECURITY REVIEW (STRIDE + OWASP ASVS, absorbe log sanitization global) — READY_TO_START tras los cambios funcionales grandes de arriba, incluidas T38/T40/T39 (nueva, formalizada 2026-09-09)
21. Support/Instagram contact surface — DEFERRED_TO_END_OF_CURRENT_BACKLOG (sin ID propio, no bloqueante)
22. P2-T37 — P2 FINAL AUDIT / LAUNCH READINESS — depende de que 1-21 estén disponibles/cerrados (ID asignado por consistencia interna, operador no especificó uno)
```

```text
F-P2-T36-01=OPEN_FOLDED_INTO_P2_T52_CONSOLIDATION (corregido 2026-09-09 — ya NO es "falta arte fuente del operador": Empleado/Salón son legacy funcionalmente inerte, pero Mozo tiene una identidad PWA separada REALMENTE ACTIVA hoy con su ícono 192px visiblemente cortado, mostrado tanto en la PWA Mozo instalable como en notificaciones Push reales de mesa_order_ready — ver P2_OPERATIONS_SINGLE_PWA_IDENTITY_AUTHORITY_CORRECTION.md §3.5/§7; formalizado como P2-T52, ningún arte nuevo requerido del operador; NO bloqueó el cierre de P2-T36 (P2_T36_BLOCKED_BY_T52=NO)
MANUAL_REVIEW_POINT_15_STATUS=NOT_A_BUG (historial Terminal ya detallado y correcto — usado como referencia de reutilización para P2-T46, ninguna tarea creada para este punto)
```

```text
P2_T30_PLUS_P2_T32_RELEASE_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (promovidos a main/Production 2026-09-09 — commit 8011ee3716c93e62b4a85ce82e3a9646ac5302a5, tag p2-t30-t32-stable-2026-09-09, deploy SUCCESS + smoke 8/8 PASS en ambos servicios relevantes — ver P2_T30_T32_PROMOTION_TO_MAIN_AND_PRODUCTION.md)
P2_T35_PLUS_P2_T36_RELEASE_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (promovidos a main/Production 2026-09-10 — commit 773664f8da80b2143cfd1443ed0467ace6c45a34, tag p2-t35-t36-stable-2026-09-10, deploy SUCCESS + smoke 11/11 PASS en ambos servicios relevantes — ver P2_T35_T36_PROMOTION_TO_MAIN_AND_PRODUCTION.md)
NEXT_FUNCTIONAL_TASK_AFTER_RELEASE=P2-T41 (Terminal Read-Only Action Authorization, P0 — primera tarea funcional nueva de Operaciones tras este checkpoint Production, no iniciada)
```

## Diferido / no prioritario (sin cambios de decisión)

```text
ANDROID_PWA_INSTALL_COMPLETION_UX_FINDING=DEFERRED_NON_BLOCKING (formalizado como tarea ejecutable P2-T38 en el backlog activo 2026-09-09, ver F-P2-T31-R23A-03 en FINDINGS.md)
OPERACIONES_SALON_MANUAL_REVIEW_BY_OPERATOR=IN_PROGRESS_EXTERNAL_TO_CURRENT_TASK (revisión manual del operador en curso, fuera de esta tarea)
OPERACIONES_SALON_NEW_TASKS=PENDING_OPERATOR_FINDINGS (ningún ID nuevo hasta que el operador reporte hallazgos concretos)
F-P2-TESTINFRA-01=OPEN_DEFERRED (latencia P2028 DB compartida TESTING)
F-P2-T30-01=OPEN_NON_BLOCKING_TEST_INFRA (12 sesiones superadmin huérfanas en TESTING)
SUPERADMIN_BOOTSTRAP_SHARED_DB_LIMITATION=limitación de entorno de test, no bug productivo, cubierta por tests puros
P2-T19 (Watcher-Aware GPS Optimization)=OPTIONAL_DEFERRED_POST_LAUNCH
THERMAL_PRINTING=POST_LAUNCH_DEFERRED (ver hallazgo: ya existe un módulo funcional wireado en src/lib/thermal-print/ + mesa-cuenta-dialog.tsx — NO es "no iniciado", ver reconciliación §4.O antes de asumir alcance restante)
EMAIL_DIAGNOSTIC_ENDPOINT_PROVIDER_DRIFT=KNOWN_NON_BLOCKING_HISTORICAL_DEBT (sacado del backlog activo)
```

## Workstream separado

```text
PAYMENTS-01..PAYMENTS-10=DEFERRED_PLANNED (no se mezcla su orden con P2 salvo decisión futura explícita)
```

## No activo (confirmado explícitamente, no crear)

```text
DARK_KITCHEN_STANDALONE_TASK=NO (satisfecho directamente por Negocio.ofreceRetiro + T20-DK1/DK2A-C, ver reconciliación §4.C)
EMAIL_DIAGNOSTIC_DRIFT_STANDALONE_TASK=NO
GLOBAL_LOG_SANITIZATION_STANDALONE_TASK=NO (absorbido por P2-T33)
```

## Legacy backlog dudoso — clasificado con evidencia (no por nombre)

```text
19-G (vencimiento automático de solicitudes de revisión)=ABSORBED — implementado en src/lib/review-moderation-expiry.ts, testeado
19-H/19-H1 (copy neutral al Cliente sobre su reseña)=ABSORBED — implementado en src/lib/review-moderation-client-ui.ts, testeado
19-B0.2 (+D1/E1, cleanup/masking PII tras eliminación de cuenta)=ABSORBED — wireado en 6+ archivos de producción reales
24-B=DECISION_REQUIRED — ninguna evidencia encontrada en código/reportes/comentarios; sólo existen 24-A y 24-A2 (Superadmin Auth)
```

## Lanzamiento público

```text
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED
PUBLIC_RELEASE_AUTHORIZED=NO
```

Detalle completo de esta reconciliación:
`codex-reports/P2_CURRENT_AUTHORITATIVE_BACKLOG_RECONCILIATION.md`.

---

## P2-T43-R3 — operator physical certification closeout — 2026-09-12

T43 quedó `CLOSED_TESTING_CERTIFIED` sobre el runtime Testing de R2. La
recertificación física del operador fue PASS en los casos originales A/B/C/D/E/F
y en los cuatro casos R2 de identidad vinculada, preservación rol/área,
reutilización de código eliminado y rechazo de duplicado activo. No hubo cambio
funcional posterior: producto, tests, Prisma y migraciones = 0 archivos.

`P2_T43_RELEASE_ELIGIBLE=SI` y
`P2_T43_RELEASE_STATUS=READY_FOR_PRODUCTION_PROMOTION_EVALUATION`.
Production permanece intacta y el lanzamiento público no está autorizado.
Siguiente acción: evaluación separada de promoción curada a Production.
Evidencia: `codex-reports/P2_T43_R3_OPERATOR_CERTIFICATION_CLOSEOUT.md`.

## P2-T32 — CLIENT ADDRESS UX UNIFICATION + PROFILE DEEP-LINK — IMPLEMENTADO, TESTEADO Y DESPLEGADO A TESTING — 2026-09-09 (`P2_T32_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION`)

```text
TASK_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_PHYSICAL_CERTIFICATION
HALLAZGO=el modal de checkout (LocationPickerModal) nunca persistía en el backend (sólo localStorage), sin campo alias — confirmado leyendo el código real
FIX=extraída la autoridad de Perfil (mapa Leaflet + formulario) a address-map-picker.tsx + address-form.tsx, compartida por Perfil y el nuevo ClientAddressModal — nunca dos formularios divergentes
DEEP_LINK=scroll determinista a "Mis Direcciones" reutilizando el mecanismo useNavStore ya existente, sin timeouts mágicos
AUTOSELECT=dirección recién creada en checkout seleccionada por id real, carrito preservado
TESTS=26 focales nuevos + 42 de regresión, 0 fallas nuevas
QUALITY=TYPECHECK_RAW=24 (idéntico baseline) / BUILD_PASS=SI / ESLINT_PASS=SI / DIFF_CHECK_PASS=SI / SECRET_LEAK=NO
PRISMA_SCHEMA_CHANGED=NO / NEW_MIGRATION=NO
COMMIT=2fb603bf4aa4b2c993b0a75078f29a259e036aca (parent 2fff459) / PUSH=testing-codex únicamente / TESTING_DEPLOY=SUCCESS ambos servicios, primer intento / PRODUCTION_TOUCHED=NO
P2_T32_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION (checklist de 4 casos A-D en el reporte)
PROPOSED_RELEASE_BATCH=P2_T30_PLUS_P2_T32 (no ejecutado en esta tarea)
```

Corrigió dos inconsistencias reales del flujo Cliente sin dirección
guardada — el CTA "Agregar dirección" de Inicio llevaba a Perfil sin
posicionar el scroll en la sección correcta, y el modal de checkout
tenía un formulario divergente e incompleto que nunca persistía en el
backend. Extraída la implementación de Perfil (más completa/estable) a
una autoridad compartida de mapa/formulario, consumida idénticamente
por ambos flujos. Sin cambios de schema/migration. Detalle completo:
`codex-reports/P2_T32_CLIENT_ADDRESS_UX_UNIFICATION_AND_PROFILE_DEEPLINK.md`.

## P2-T30 — SUPERADMIN AUTH TEST FIXTURE HYGIENE — CERRADO — 2026-09-09 (F-PRE-T29-03 resuelto con evidencia real — `P2_T30_STATUS=CLOSED_TESTING_CERTIFIED`)

```text
TASK_STATUS=COMPLETE
ROOT_CAUSE=deleteMany({}) sin scope en superadmin-auth.test.ts crasheaba contra 3 filas SuperAdmin reales vinculadas (2 referenciadas por FK Restrict de SolicitudRevisionResena) en la DB compartida de TESTING
FIX=fixtures únicos por corrida + cleanup scoped por id (nunca deleteMany({}) global) — único archivo modificado (test-only)
HALLAZGO_ADICIONAL=4 tests cuyo éxito depende de "cero identidades vinculadas en toda la tabla" (regla de negocio real de resolverIdentidadSuperadminGoogle, no un bug) no son reproducibles end-to-end contra la DB compartida actual — marcados test.skipIf() explícito, nunca forzados borrando datos reales; cobertura preservada de forma permanente vía tests puros de la función de decisión
TESTS=48 pass + 4 skip + 0 fail, 3 corridas consecutivas idénticas + 77/77 en archivos vecinos de SuperAdmin
QUALITY=TYPECHECK_RAW=24 (idéntico baseline) / BUILD_PASS=SI / ESLINT_PASS=SI / DIFF_CHECK_PASS=SI / SECRET_LEAK=NO
COMMIT=2fff459b36ea459a9cb6603daf746c571562449d (parent a5109b0) / PUSH=testing-codex únicamente / PRODUCTION_TOUCHED=NO / TESTING_DEPLOY_REQUIRED=NO
F-PRE-T29-03=RESOLVED_BY_P2_T30
P2_T29A/B/C/D/E_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservados) / P2_T29_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado)
P2_T30_STATUS=CLOSED_TESTING_CERTIFIED (era READY_TO_START)
NEXT_ACTION=P2-T02 (WAITING_FOR_OPERATOR — no accionable sin el operador; ninguna otra tarea READY/QUEUED disponible)
```

Higiene de fixtures de test, sin tocar código de producto. La DB
compartida de TESTING tiene hoy 3 identidades SuperAdmin reales ya
vinculadas (2 referenciadas por una FK `Restrict`) — el
`deleteMany({})` sin scope que el archivo usaba en su `beforeEach`
intentaba borrarlas y crasheaba cada test. Redisñados los fixtures con
ids únicos por corrida y cleanup exclusivamente por esos ids. Se
descubrió además que 4 tests dependían estructuralmente de que la tabla
completa no tuviera NINGUNA identidad vinculada (regla de negocio real
de `resolverIdentidadSuperadminGoogle`, no un defecto) — se marcaron con
`skipIf` explícito (nunca se borró la fila real para forzar su PASS) y
su cobertura de lógica se preservó de forma permanente vía tests puros,
inmunes al estado de la DB. 48 pass + 4 skip + 0 fail en 3 corridas
consecutivas, 77/77 en archivos vecinos. `F-PRE-T29-03` cerrado con
evidencia real. Un solo commit test-only, push exclusivo a
`testing-codex`, sin deploy necesario. Sin ninguna otra tarea
`READY_TO_START`/`QUEUED` disponible en el roadmap salvo `P2-T02`
(bloqueada, esperando al operador) — no iniciada. Detalle completo:
`codex-reports/P2_T30_SUPERADMIN_AUTH_TEST_FIXTURE_HYGIENE.md`.

## P2-T29 (EPIC) — CHECKPOINTED EN PRODUCTION — 2026-09-09 (promoción final: `main`/Production avanzados a `44af4ec`, tag `p2-t29-stable-2026-09-09` creado, ambos servicios SUCCESS en el primer intento — `P2_T29_STATUS=CLOSED_PRODUCTION_CHECKPOINTED`)

```text
TASK_STATUS=COMPLETE
SOURCE=testing-codex@a5109b0930ef975b0220b6cfbcb0698b32d8cf32 / RELEASE_COMMIT=44af4ecedd245977f0a50eeeb5bb5b292519c370 (parent 7a3a1dc)
DELTA=3 archivos (residual T29D exclusivamente — order-transition-t29b-flow.test.ts, negocio/pedidos/[id]/estado/route.ts, push.ts) / T29E sin código propio confirmado
PROMOTION_TESTS=163/163 (0 fallas) / TYPECHECK_RAW=24 (idéntico baseline) / BUILD_PASS=SI / ESLINT_PASS=SI / DIFF_CHECK_PASS=SI / SECRET_LEAK=NO
MIGRATIONS=0 ("No pending migrations to apply" confirmado en logs reales de Production)
PRODUCTION_DEPLOY=SUCCESS ambos servicios (DeliGO + chat en vivo), PRIMER intento, sin hiccup
SMOKE=8/8 rutas 200 contra https://deligo.ar (dominio real de Production)
TAG=p2-t29-stable-2026-09-09 -> 44af4ec
P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado) / P2_T29B_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado) / P2_T29C_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado)
P2_T29D_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (era CLOSED_TESTING_CERTIFIED) / P2_T29E_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (era CLOSED_TESTING_CERTIFIED)
P2_T29_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (epic completo A-E, era CLOSED_TESTING_CERTIFIED)
NEXT_ACTION=P2-T30 (SUPERADMIN AUTH TEST FIXTURE HYGIENE) — READY_TO_START, no iniciada
```

Quinta promoción curada del epic (tras T29A solo, y T29B+T29C):
snapshot vía `git commit-tree`, tree exacto del source, sin merge
genérico. El delta auditado correspondió exactamente al residual de
T29D (3 archivos) — T29E, fase de auditoría/regresión/certificación,
no aportó ningún archivo de código propio, confirmado explícitamente.
Batería focal de 163 tests (0 fallas), 0 migrations, build/lint/
typecheck limpios, secret scan limpio. Push fast-forward a `main`,
Production (DeliGO + chat en vivo) SUCCESS en el commit exacto en el
PRIMER intento para ambos servicios. Se corrigió sobre la marcha que
el CLI de Railway local estaba linkeado por defecto a TESTING — todos
los comandos posteriores usaron `-e production`/`-s` explícitos.
Smoke HTTP completo PASS contra el dominio real de Production. Tag
`p2-t29-stable-2026-09-09` creado sólo tras confirmar todo lo anterior.
`P2_T29_STATUS` (epic completo A-E) avanza a
`CLOSED_PRODUCTION_CHECKPOINTED`. Lanzamiento público sigue sin
autorizar. Próxima tarea determinada por autoridad real del roadmap:
`P2-T30` (higiene de fixture de test de superadmin auth,
`src/lib/superadmin-auth.test.ts` con `deleteMany({})` sin scope),
`READY_TO_START`, no iniciada en esta tarea. Detalle completo:
`codex-reports/P2_T29D_T29E_PROMOTE_TO_MAIN_AND_PRODUCTION.md`.

## P2-T29 (EPIC) — CERRADO EN TESTING — 2026-09-09 (certificación física final PASS — Domicilio/Retiro/Mesa/concurrencia/notificaciones — `P2_T29_STATUS=CLOSED_TESTING_CERTIFIED`, bloque `P2_T29D_PLUS_P2_T29E` listo para promoción)

```text
TASK_STATUS=COMPLETE
PHYSICAL_CERTIFICATION_RESULT=PASS (Domicilio completo, dos repartidores solo un ganador, notificaciones sin duplicar; Retiro completo sin buscando-delivery/sin Repartidor; Mesa completo sin aceptado/sin Repartidor)
CODE_CHANGES_REQUIRED_FOR_CLOSE=NO — tarea puramente documental
PRODUCTION_TOUCHED=NO
P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado) / P2_T29B_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado) / P2_T29C_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado) / P2_T29D_STATUS=CLOSED_TESTING_CERTIFIED (preservado)
P2_T29E_STATUS=CLOSED_TESTING_CERTIFIED (era WAITING_FOR_OPERATOR_FINAL_PHYSICAL_CERTIFICATION)
P2_T29_STATUS=CLOSED_TESTING_CERTIFIED (epic completo, era IN_PROGRESS)
RELEASE_BATCH=P2_T29D_PLUS_P2_T29E / RELEASE_BATCH_READY_FOR_PROMOTION=SI / PROMOTION_EVALUATION_POINT=NOW
NEXT_ACTION=PROMOTE_P2_T29D_PLUS_P2_T29E_TO_MAIN_AND_PRODUCTION
```

El operador certificó físicamente en TESTING el checklist final
completo del epic P2-T29 sobre el commit `a5109b0` (ya certificado
automáticamente: 218 tests, 0 fallas). Domicilio con dos repartidores
reales compitiendo (single-winner confirmado), Retiro y Mesa sin
regresión, notificaciones sin duplicados. Tarea puramente
documental — sin código, sin commit. `P2_T29E_STATUS` y `P2_T29_STATUS`
(epic completo) avanzan a `CLOSED_TESTING_CERTIFIED` — T29D y T29E
permanecen en checkpoint de TESTING, no de Production, hasta la
próxima promoción. `RELEASE_BATCH=P2_T29D_PLUS_P2_T29E` queda
`RELEASE_BATCH_READY_FOR_PROMOTION=SI` — esta tarea NO ejecuta la
promoción. Cerrar T29 en TESTING no implica lanzamiento público
(`DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED` sin cambios). Detalle
completo:
`codex-reports/P2_T29E_AND_T29_FINAL_PHYSICAL_CERTIFICATION_CLOSEOUT.md`.

## P2-T29E — AUDITORÍA FINAL + REGRESIÓN COMPLETA — 2026-09-09 (218 tests reales, 0 fallas nuevas — sin cambios de código — `P2_T29E_STATUS=WAITING_FOR_OPERATOR_FINAL_PHYSICAL_CERTIFICATION`)

```text
TASK_STATUS=AUTOMATED_FINAL_CERTIFICATION_COMPLETE_AWAITING_OPERATOR
ORDER_TRANSITION_SINGLE_AUTHORITY_FINAL=SI / DUPLICATED_TRANSITION_TABLES_FOUND=NO
LEGACY_DOMICILIO_COMPAT=SI / LEGACY_RETIRO_COMPAT=SI / LEGACY_MESA_COMPAT=SI (todos certificados por test real, no sólo inspección)
FINAL_T29_TEST_PASS=218 / FINAL_T29_TEST_FAIL=0 / NEW_FAIL=0 (1 fallo transitorio P2028 en archivo P2-T25 ajeno al diff, reproducido como recurrencia de F-P2-TESTINFRA-01, no regresión)
TYPECHECK_RAW=24 (idéntico baseline) / BUILD_PASS=SI / ESLINT_PASS=SI / DIFF_CHECK_PASS=SI
T29E_CODE_CHANGES_REQUIRED=NO — sin commit, sin push, sin deploy nuevo
PRODUCTION_TOUCHED=NO
P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado) / P2_T29B_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado) / P2_T29C_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado) / P2_T29D_STATUS=CLOSED_TESTING_CERTIFIED (preservado)
P2_T29E_STATUS=WAITING_FOR_OPERATOR_FINAL_PHYSICAL_CERTIFICATION (era READY_TO_START)
P2_T29_STATUS=IN_PROGRESS (epic completo no se marca cerrado hasta la certificación física final)
NEXT_ACTION=OPERATOR_FINAL_PHYSICAL_CERTIFICATION_P2_T29E (checklist completo Domicilio/Retiro/Mesa en el reporte)
```

Auditoría final del epic sin agregar funcionalidad: confirmó que la
autoridad de transición sigue única (5 consumidores, sin tablas
duplicadas reaparecidas), que los grafos canónico y legacy de
domicilio/retiro siguen cubiertos por tests reales (no sólo por
diseño), que la UI nueva de Negocio nunca ofrece un atajo legacy como
acción normal, y que Mesa/Retiro no regresionaron. Batería final de
218 tests (24 unitarios con mock-db + 122 puros + 72 de integración
real), 0 fallas nuevas — el único fallo observado (P2028 transitorio en
un archivo de P2-T25 no tocado por T29) se reprodujo como no
determinístico y coincide con el finding preexistente
F-P2-TESTINFRA-01. Sin ninguna regresión real de T29,
`T29E_CODE_CHANGES_REQUIRED=NO`. `P2_T29E_STATUS` queda
`WAITING_FOR_OPERATOR_FINAL_PHYSICAL_CERTIFICATION` — el epic completo
no cierra hasta que el operador confirme el checklist físico final.
Detalle completo:
`codex-reports/P2_T29E_FINAL_COMPATIBILITY_REGRESSION_AND_PHYSICAL_CERTIFICATION.md`.

## P2-T29D — CERRADO — 2026-09-09 (certificación física del operador PASS, 10/10 ítems — `P2_T29D_STATUS=CLOSED_TESTING_CERTIFIED`, `P2_T29E_STATUS=READY_TO_START`)

```text
TASK_STATUS=COMPLETE
PHYSICAL_CERTIFICATION_RESULT=PASS (Domicilio 4/4, Retiro 3/3, Mesa 2/2, sin duplicados, timeline sin regresión — 10/10)
Commit certificado: a5109b0930ef975b0220b6cfbcb0698b32d8cf32 (testing-codex)
CODE_CHANGES_REQUIRED_FOR_CLOSE=NO — tarea puramente documental
PRODUCTION_TOUCHED=NO
P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado) / P2_T29B_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado) / P2_T29C_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado)
P2_T29D_STATUS=CLOSED_TESTING_CERTIFIED (era WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION)
P2_T29E_STATUS=READY_TO_START
P2_T29_STATUS=IN_PROGRESS (epic completo no se marca cerrado hasta T29E)
PROPOSED_RELEASE_BATCH=P2_T29D_PLUS_P2_T29E (T29D_STANDALONE_PROMOTION_REQUIRED=NO — residual pequeño, evaluación de promoción diferida hasta certificación física de T29E)
NEXT_ACTION=P2_T29E_FINAL_COMPATIBILITY_REGRESSION_AND_PHYSICAL_CERTIFICATION
```

El operador certificó físicamente en TESTING el residual único de
P2-T29D (notificación Cliente "aceptó tu pedido" para
`recibido→aceptado`, Domicilio y Retiro; Mesa excluida correctamente).
10/10 ítems del checklist reducido PASS, sin notificación duplicada,
sin regresión de timeline. Cierre puramente documental — sin código,
sin commit. `P2_T29D_STATUS` avanza a `CLOSED_TESTING_CERTIFIED`.
Detalle completo: `codex-reports/P2_T29D_PHYSICAL_CERTIFICATION_CLOSEOUT.md`.

## P2-T29D — RESIDUAL AUDITADO E IMPLEMENTADO — 2026-09-09 (auditoría completa del scope histórico + único residual real implementado y desplegado a TESTING — certificación física recibida en la tarea siguiente)

```text
TASK_STATUS=AUDITED_RESIDUAL_IMPLEMENTED_DEPLOYED_TESTING_AWAITING_PHYSICAL_GATE
T29D_COMMIT=a5109b0930ef975b0220b6cfbcb0698b32d8cf32 (parent 0c23008, testing-codex)
TESTING_DEPLOYMENT=SUCCESS ("DeliGO Copy"), commit match
PRODUCTION_TOUCHED=NO
P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado) / P2_T29B_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado) / P2_T29C_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado)
P2_T29D_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION (era READY_TO_START) -> ver entrada CERRADO arriba
P2_T29_STATUS=IN_PROGRESS
RESIDUAL=notificación Cliente recibido->aceptado ("${negocio} aceptó tu pedido", decisión explícita del operador) — único requisito del diseño original de T29D que quedaba sin cerrar; los otros 5 ya estaban implementados/certificados/en Production desde T29B-R1/T29C
PROPOSED_RELEASE_BATCH=P2_T29D_PLUS_P2_T29E (propuesta, no obligación) / P2_T29E_STATUS=QUEUED_AFTER_T29D
NEXT_ACTION=OPERATOR_PHYSICAL_CERTIFICATION_P2_T29D (checklist reducido en el reporte) — recién si PASS, cerrar T29D y evaluar T29E
```

Auditoría de dos fases: primero se leyó completo el diseño original de
T29D (`P2_T29_ESPERANDO_REPARTIDOR_ACCEPTANCE_REDESIGN_AUDIT_AND_
DESIGN.md` §10/§11) y se comparó requisito por requisito contra la
implementación real — confirmando que 5 de 6 requisitos ya estaban
satisfechos, certificados físicamente y en Production (timeline de 5
pasos, notificación "Buscando delivery", aviso a repartidores,
notificación de asignación preexistente preservada). El único residual
real era la notificación Cliente de `aceptado`, cuyo copy nunca había
sido cerrado por ninguna autoridad — se presentaron opciones al
operador antes de escribir código, en vez de inventar un texto. Se
implementó el residual (3 archivos, mínimo) y se corrigió de paso una
discrepancia documental de conteo de tests en 4 reportes previos (root
cause: un subtotal transcrito mal en T29B-R1, propagado sin
re-verificar). Por ser un cambio user-visible, `P2_T29D_STATUS` queda
pendiente de certificación física. Detalle completo:
`codex-reports/P2_T29D_RESIDUAL_CLIENT_NOTIFICATIONS_TIMELINE_AUDIT_AND_IMPLEMENTATION.md`.

## P2-T29B + P2-T29C — PROMOVIDOS A PRODUCTION — 2026-09-09 (checkpoint curado — main/Production avanzados a `7a3a1dc`, tag creado, ambos servicios SUCCESS en el primer intento)

```text
GIT_ACTION=1 release commit vía git commit-tree (7a3a1dcbfa89bd63c96471290e936b979d74c5ce, tree=testing-codex@0c2300827ea09d149253b84bc43fa5bda6db29f2, parent=origin/main@c45fd5ec8cd771d68020f37d892be31d62fb54c5) + 1 push por SHA a origin/main + 1 tag anotado pusheado
RELEASE_COMMIT_SHA=7a3a1dcbfa89bd63c96471290e936b979d74c5ce
MAIN_PUSH=c45fd5e..7a3a1dc (fast-forward, sin force)
PRODUCTION_DELIGO_DEPLOYMENT_ID=a5a7ffd0-c38e-4c27-a967-94128e5f70e1 / STATUS=SUCCESS / COMMIT=7a3a1dc (match exacto, primer intento) / 0 migrations pendientes
PRODUCTION_CHAT_EN_VIVO=SUCCESS (deployment 3794366d-7a62-47e7-8c3c-3bb37715610c, también primer intento — sin el hiccup transitorio que P2-T29A tuvo)
TAG=p2-t29b-t29c-stable-2026-09-09, target=7a3a1dcbfa89bd63c96471290e936b979d74c5ce
TESTING_CODEX_UNCHANGED=SI (0c2300827ea09d149253b84bc43fa5bda6db29f2)
P2_T29B_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (era CLOSED_TESTING_CERTIFIED) / P2_T29C_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (era CLOSED_TESTING_CERTIFIED)
P2_T29_STATUS=IN_PROGRESS / P2_T29D_STATUS=READY_TO_START
```

Promovió el bloque funcional certificado (Negocio
aceptado/preparando/esperando_repartidor, timeline Cliente + waiting-
driver notification, Repartidor waiting-driver acceptance con
concurrencia real de 2 repartidores) de `testing-codex` a
`main`/Production — 22 archivos, auditados uno por uno, byte-equivalentes
al source. 0 migrations. Batería focal (134+47 tests) 0 fallas nuevas
(1 fallo no-determinístico de infraestructura de test compartida,
reproducido y descartado). `main`/Production coinciden exactamente en
`7a3a1dc`. `P2_T29D_REQUIRES_RESIDUAL_SCOPE_RECONCILIATION=SI` — parte
del alcance histórico de T29D ya fue adelantado y certificado (timeline
+ notificación "Buscando delivery"); la próxima tarea debe reconciliar
ese alcance antes de implementar. Detalle completo:
`codex-reports/P2_T29B_T29C_PROMOTE_TO_MAIN_AND_PRODUCTION.md`.

## P2-T29C — CERRADO — 2026-09-09 (certificación física con DOS repartidores PASS, 11/11 ítems — `P2_T29C_STATUS=CLOSED_TESTING_CERTIFIED`, bloque `P2_T29B_PLUS_P2_T29C` listo para evaluación de promoción)

```text
TASK_STATUS=CLOSED_DOCUMENTATION_ONLY (tarea de cierre, cero código tocado)
PHYSICAL_CERTIFICATION_RESULT=PASS (11/11 ítems, 0 fallas — dos repartidores, disponibilidad, Retiro/Mesa excluidos, notificaciones)
P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado) / P2_T29B_STATUS=CLOSED_TESTING_CERTIFIED (preservado)
P2_T29C_STATUS=CLOSED_TESTING_CERTIFIED (era WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION)
P2_T29_STATUS=IN_PROGRESS (T29D/T29E pendientes según autoridad del roadmap — epic completo no se marca cerrado)
FINAL_COMMIT=0c2300827ea09d149253b84bc43fa5bda6db29f2 (P2-T29C, sin cambios de código en el cierre)
PRODUCTION_TOUCHED=NO
RELEASE_BATCH=P2_T29B_PLUS_P2_T29C / RELEASE_BATCH_READY_FOR_PROMOTION=SI / PROMOTION_EVALUATION_POINT=NOW
NEXT_TASK_RECOMMENDED=PROMOTE_P2_T29B_PLUS_P2_T29C_TO_MAIN_AND_PRODUCTION (tarea SEPARADA, no iniciada por este cierre)
```

Certificación física completa de P2-T29C con dos repartidores reales:
ambos ven el mismo pedido `esperando_repartidor`, exactamente uno gana,
el perdedor no queda asignado y su pedido desaparece tras el siguiente
poll, Cliente avanza a "En camino", Negocio deja de mostrar "Buscando
repartidor...", nunca dos asignados, Retiro/Mesa excluidos de
disponibilidad, notificaciones correctas sin duplicados. Complementa
(no reemplaza) la evidencia automática de concurrencia real ya probada
en la implementación. Con T29B y T29C ambos `CLOSED_TESTING_CERTIFIED`,
el bloque queda listo para que una tarea separada evalúe la promoción a
`main`/Production — **no promovida en esta tarea**. Detalle completo:
`codex-reports/P2_T29C_PHYSICAL_CERTIFICATION_CLOSEOUT.md`.

## P2-T29C — REPARTIDOR WAITING DRIVER ACCEPTANCE — 2026-09-09 (implementado + testeado con concurrencia real de 2 repartidores + desplegado a TESTING — PENDIENTE certificación física con 2 repartidores, NO cerrado)

```text
TASK_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_TWO_DRIVER_PHYSICAL_GATE
T29C_COMMIT=0c2300827ea09d149253b84bc43fa5bda6db29f2 (parent 155b4c4, testing-codex)
TESTING_DEPLOYMENT=22c337f9-773f-4478-8587-ee97cc626a26 SUCCESS, commit match
PRODUCTION_TOUCHED=NO
P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado) / P2_T29B_STATUS=CLOSED_TESTING_CERTIFIED (normalizado, preservado)
P2_T29C_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION (era READY_TO_START)
P2_T29_STATUS=IN_PROGRESS
RELEASE_BATCH=P2_T29B_PLUS_P2_T29C (sin cambios) / PROMOTION_EVALUATION_POINT=AFTER_P2_T29C_CERTIFICATION (sin cambios, sin promoción en esta tarea)
NEXT_ACTION=OPERATOR_TWO_DRIVER_PHYSICAL_CERTIFICATION_P2_T29C (checklist en el reporte) — recién si PASS, cerrar T29C y evaluar promoción del bloque T29B+T29C
```

Repartidor pasa a consumir realmente `esperando_repartidor` (estado que
T29B dejó alcanzable pero sin consumidor) en vez del
`en_camino`+`repartidorId=null` legacy sobrecargado — domicilio opera
`recibido->aceptado->preparando->esperando_repartidor->en_camino->
entregado`. Query de disponibilidad, CAS de aceptación y auto-cancel
migran a una única autoridad (`isAvailableForDriverAcceptance`,
`order-transitions.ts`) que reconoce el estado canónico Y preserva
compatibilidad legacy explícita (nunca ambigua — cada CAS compara contra
el valor exacto leído). El GAP CRÍTICO de la auditoría P2-T29 original
("aceptación atómica sin test de concurrencia real") queda cerrado: dos
repartidores compitiendo vía `Promise.all` contra Postgres real de
TESTING prueban single-winner real, y una tercera prueba cubre la
carrera cancelación-vs-aceptación. El aviso a Repartidores de "nuevo
delivery" se mueve de `en_camino` a `preparando->esperando_repartidor`
(preservando el disparo legacy). Sin cambios de frontend (Repartidor UI
ya dependía 100% del split servidor). Detalle completo:
`codex-reports/P2_T29C_REPARTIDOR_WAITING_DRIVER_ACCEPTANCE_AND_CONCURRENCY.md`.

## P2-T29B — CERRADO — 2026-09-09 (certificación física del operador PASS, 10/10 ítems — `P2_T29B_STATUS=CLOSED`, `P2_T29C_STATUS=READY_TO_START`)

```text
TASK_STATUS=CLOSED_DOCUMENTATION_ONLY (tarea de cierre, cero código tocado)
PHYSICAL_CERTIFICATION_RESULT=PASS (10/10 ítems, 0 fallas — DOMICILIO 8/8, RETIRO 2/2)
P2_T29B_STATUS=CLOSED (era WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION)
P2_T29C_STATUS=READY_TO_START (era QUEUED_AFTER_P2_T29B) — NO iniciada automáticamente, operador pidió detenerse a revisar el cierre primero
P2_T29_STATUS=IN_PROGRESS (epic completo requiere T29C)
FINAL_COMMIT=155b4c4f0ce6426bea429f9aa400061e8a1e5455 (P2-T29B-R1, sin cambios de código en el cierre)
PRODUCTION_TOUCHED=NO
RELEASE_BATCH=P2_T29B_PLUS_P2_T29C (preservado) / P2_T29B_PROMOTION_TO_PRODUCTION_AFTER_CLOSE=NO (preservado — cerrar T29B no dispara promoción)
NEXT_TASK_RECOMMENDED=P2-T29C (Repartidor consume esperando_repartidor: polling/visibilidad + aceptación real)
```

Certificación física completa de P2-T29B (implementado en la tarea
`P2-T29B-NEGOCIO-ACCEPTED-PREPARING-WAITING-DRIVER-FLOW` y su fix focal
`P2-T29B-R1-CLIENT-TIMELINE-CONTINUITY-WAITING-DRIVER-NOTIFICATION`):
domicilio (Recibido→Aceptado en el mismo nodo→Preparando→Buscando
delivery con notificación única→En camino→Listo, 5 pasos exactos) y
retiro (aceptado no apaga la timeline, sin "Buscando delivery") ambos
PASS sin regresión. Detalle completo:
`codex-reports/P2_T29B_PHYSICAL_CERTIFICATION_CLOSEOUT.md`.

## P2-T29B-R1-CLIENT-TIMELINE-CONTINUITY-WAITING-DRIVER-NOTIFICATION — 2026-09-09 (fix focal implementado + desplegado a TESTING — PENDIENTE certificación física de T29B, NO cerrado)

```text
TASK_STATUS=IMPLEMENTED_TESTED_DEPLOYED_TESTING_AWAITING_PHYSICAL_GATE
T29B_R1_COMMIT=155b4c4f0ce6426bea429f9aa400061e8a1e5455 (parent 3d9f3b3, testing-codex)
TESTING_DEPLOYMENT=22c337f9-773f-4478-8587-ee97cc626a26 SUCCESS, commit match
PRODUCTION_TOUCHED=NO
P2_T29B_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION (preservado, este fix es prerequisito de esa certificación)
P2_T29C_STATUS=QUEUED_AFTER_P2_T29B (sin cambios)
P2_T29_STATUS=IN_PROGRESS
RELEASE_BATCH=P2_T29B_PLUS_P2_T29C (sin cambios)
NEXT_ACTION=OPERATOR_PHYSICAL_CERTIFICATION_P2_T29B (checklist reducido específico de este fix en el reporte) — recién si PASS, cerrar T29B e iniciar P2-T29C
```

Corrección focal descubierta durante la certificación física de
P2-T29B: la timeline de Cliente para pedidos domicilio/retiro se
apagaba por completo al llegar a `aceptado`/`esperando_repartidor`
(`findIndex` sobre un array sin esos estados). Reemplazada por un
mapping explícito estado→índice que preserva exactamente 5 posiciones
para domicilio (primer nodo dinámico "Recibido"→"Aceptado") y el
layout de 4 posiciones ya existente para retiro (sólo corrige
`aceptado`). Se agregó también una notificación dedicada al Cliente
("Buscando delivery" / "El local está esperando un delivery para tu
pedido.") para la transición real `preparando→esperando_repartidor` en
domicilio — antes ese estado quedaba mudo para el Cliente. Mesa y
Repartidor sin cambios. Detalle completo:
`codex-reports/P2_T29B_R1_CLIENT_TIMELINE_AND_WAITING_DRIVER_NOTIFICATION.md`.

## P2-T29B-NEGOCIO-ACCEPTED-PREPARING-WAITING-DRIVER-FLOW — 2026-09-09 (implementado + desplegado a TESTING — PENDIENTE certificación física, NO cerrado)

```text
TASK_STATUS=T29B_IMPLEMENTATION_COMPLETE_AWAITING_OPERATOR_PHYSICAL_CERTIFICATION
T29B_COMMIT=3d9f3b32f9359a4cdd0385f13bf5c4621d6d16ce (parent 4b19954, testing-codex)
TESTING_DEPLOYMENT=1c00f674-0882-4785-91b6-2560e275fec0 SUCCESS, commit match
PRODUCTION_TOUCHED=NO
P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (preservado)
P2_T29B_STATUS=WAITING_FOR_OPERATOR_PHYSICAL_CERTIFICATION
P2_T29C_STATUS=QUEUED_AFTER_P2_T29B
P2_T29_STATUS=IN_PROGRESS
RELEASE_BATCH=P2_T29B_PLUS_P2_T29C (promoción a Production diferida hasta certificar T29C — bloque funcional único, no se parte)
NEXT_ACTION=OPERATOR_PHYSICAL_CERTIFICATION_P2_T29B (checklist DOMICILIO/RETIRO/MESA/MOBILE en el reporte) — recién si PASS, cerrar T29B e iniciar P2-T29C
```

Activa en Negocio el flujo `recibido→aceptado→preparando→
esperando_repartidor` (domicilio) y `recibido→aceptado→preparando→
listo_para_retirar` (retiro), con compatibilidad legacy explícita
durante el rollout. Cliente puede cancelar desde `aceptado` (activado
como comportamiento real). Mesa sin cambios. Repartidor sin cambios —
`esperando_repartidor` queda deliberadamente sin consumidor todavía
(T29C). Verificado con clicks reales en un Negocio sintético de
TESTING, no sólo tests automatizados. Detalle completo:
`codex-reports/P2_T29B_NEGOCIO_ACCEPTED_PREPARING_WAITING_DRIVER_FLOW.md`.

## POLÍTICA — RELEASE_CADENCE_POLICY=FREQUENT_CERTIFIED_PROMOTIONS (2026-09-09)

```text
POLICY=FREQUENT_CERTIFIED_PROMOTIONS
RULE=BIG_TASK_CERTIFIED -> EVALUATE_PROMOTION_BEFORE_NEXT_BIG_TASK
RULE=SMALL_TASK_LOGICAL_BATCH_CERTIFIED -> EVALUATE_PROMOTION_BEFORE_NEXT_BIG_TASK
NOT_ELIGIBLE_IF=blocker real, gate físico pendiente, o regresión nueva sin resolver
```

DeliGO adopta promociones frecuentes y pequeñas a `main`/Production en
vez de dejar `testing-codex` divergir por bloques grandes de trabajo.
Detalle completo y justificación en
`codex-reports/DECISIONS_AND_INVARIANTS.md`. Primera aplicación:
`P2-T29A-PROMOTE-TO-MAIN-AND-PRODUCTION` (ver abajo).

## P2-T29A-PROMOTE-TO-MAIN-AND-PRODUCTION — 2026-09-09 (CHECKPOINT COMPLETO — main/Production en `c45fd5e`, tag `p2-t29a-stable-2026-09-09` creado, `P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED`)

```text
TASK_STATUS=COMPLETE
ORIGIN_MAIN_FINAL=c45fd5ec8cd771d68020f37d892be31d62fb54c5
PRODUCTION_COMMIT_FINAL=c45fd5ec8cd771d68020f37d892be31d62fb54c5 (ambos servicios)
PRE_T29A_TAG=p2-t29a-stable-2026-09-09 -> c45fd5e
TESTING_CODEX_UNCHANGED=SI (4b199540c78ebe0a010c699f6fc2e63b43d162a0)
P2_T29A_STATUS=CLOSED_PRODUCTION_CHECKPOINTED (avanzó desde CLOSED_TESTING_CERTIFIED)
P2_T27_STATUS=MERGED_CLOSED_BY_T29A (preservado)
P2_T29B_STATUS=READY_TO_START
P2_T29_STATUS=AUDITED_DESIGNED_READY_FOR_IMPLEMENTATION (preservado — T29 completo sigue abierto, no se marca cerrado)
NEXT_ACTION=P2-T29B — activar recibido→aceptado→preparando→esperando_repartidor en la API/UI de Negocio
```

Detalle completo, incluido el incidente transitorio del servicio de
chat (resuelto con un reintento, sin relación con el código): ver
`codex-reports/P2_T29A_PROMOTE_TO_MAIN_AND_PRODUCTION.md`.

## P2-T29A-ORDER-TRANSITION-AUTHORITY-CAS-AND-CONCURRENCY-TESTS — 2026-09-09 (CERRADO — autoridad compartida + CAS real en Negocio, T27 absorbido, T29B listo para empezar)

```text
TASK_STATUS=CLOSED_TESTING_CERTIFIED
ORDER_TRANSITION_AUTHORITY_FILE=src/lib/order-transitions.ts
T29A_COMMIT=4b199540c78ebe0a010c699f6fc2e63b43d162a0 (parent 6c6fc58, testing-codex)
TESTING_DEPLOYMENT=e84a22e3-27f5-4863-944e-c559e03976e3 SUCCESS, commit match
PRODUCTION_TOUCHED=NO
P2_T29A_STATUS=CLOSED_TESTING_CERTIFIED
P2_T27_STATUS=MERGED_CLOSED_BY_T29A
P2_T29B_STATUS=READY_TO_START
P2_T29C_STATUS=QUEUED_AFTER_T29B
NEXT_ACTION=P2-T29B — activar recibido→aceptado→preparando→esperando_repartidor en la API/UI de Negocio ("Aceptar pedido", "Preparar", "Buscar repartidor", "Buscando repartidor...") — no implementado aquí
```

Detalle completo: `codex-reports/P2_T29A_ORDER_TRANSITION_AUTHORITY_CAS_AND_CONCURRENCY_TESTS.md`.

## PRE-T29-PROMOTE-CERTIFIED-TESTING-TO-MAIN-AND-PRODUCTION-R2 — 2026-09-08/09 (CHECKPOINT PRE-T29 COMPLETO — main/Production en `969ea77`, tag `pre-t29-stable-2026-09-08` creado, `P2_T29A_STATUS=READY_TO_START`)

```text
TASK_STATUS=COMPLETE
ORIGIN_MAIN_FINAL=969ea77ab1630b443fbc0e609397d9c45c5d7443
PRODUCTION_COMMIT_FINAL=969ea77ab1630b443fbc0e609397d9c45c5d7443
PRE_T29_TAG=pre-t29-stable-2026-09-08 -> 969ea77
TESTING_CODEX_UNCHANGED=SI (6c6fc581ad678883f4e9fbcb9dbf8e90ecf63912)
F_PRE_T29_02_STATUS=CLOSED_TESTING_CERTIFIED
F_PRE_T29_03_STATUS=OPEN_NON_BLOCKING (nuevo finding, contaminación de datos en TESTING DB compartida, no bloqueante)
P2_T29A_STATUS=READY_TO_START (avanzó desde PAUSED_PENDING_PRE_T29_PROMOTION)
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED (sin cambios)
NEXT_ACTION=P2-T29A (Order Transition Authority + CAS + Concurrency Tests) — no iniciado en esta tarea
```

Detalle completo: `codex-reports/PRE_T29_PROMOTE_CERTIFIED_TESTING_TO_MAIN_AND_PRODUCTION_R2.md`.
Con este checkpoint, `main`/Production quedan como la última versión
estable PRE-T29; `testing-codex` es la rama donde continuará el
trabajo de T29A/B/C/etc.

## PRE-T29-FIX-MANIFEST-CLIENTE-IOSDEBUG-FLAG-TESTING — 2026-09-08 (histórico — F-PRE-T29-02 corregido y desplegado a TESTING, ya promovido y cerrado arriba)

```text
TASK_STATUS=IMPLEMENTED_COMMITTED_PUSHED_DEPLOYED_TESTING_AWAITING_PHYSICAL_CONFIRMATION
FIX_COMMIT=6c6fc581ad678883f4e9fbcb9dbf8e90ecf63912 (parent 818b627, testing-codex)
TESTING_DEPLOYMENT=d636ab54-7104-4e55-b9a6-6928ffc0817a SUCCESS, commit match
F_PRE_T29_02_STATUS=FIX_DEPLOYED_TESTING_AWAITING_PHYSICAL_CONFIRMATION
PRODUCTION_TOUCHED=NO
P2_T29A_STATUS=PAUSED_PENDING_PRE_T29_PROMOTION (sin cambio)
NEXT_ACTION=operador confirma físicamente en un iPhone real que una instalación NUEVA de la PWA Cliente ya no abre con el panel de diagnóstico activado por defecto, y que /cliente?iosDebug=1 sigue activándolo manualmente — sólo entonces reintentar PRE_T29_PROMOTE_CERTIFIED_TESTING_TO_MAIN_AND_PRODUCTION usando 6c6fc58 como nuevo RC source
```

Detalle completo: `codex-reports/PRE_T29_FIX_MANIFEST_CLIENTE_IOSDEBUG_FLAG_TESTING.md`.

## PRE-T29-PROMOTE-CERTIFIED-TESTING-TO-MAIN-AND-PRODUCTION — 2026-09-08 (DETENIDA antes del push — bug real encontrado, corrección requerida en testing-codex antes de reintentar)

```text
TASK_STATUS=STOPPED_BEFORE_PUSH_BY_OPERATOR_DECISION
NEW_BLOCKER=F-PRE-T29-02 (public/manifest-cliente.json start_url="/cliente?iosDebug=1" hardcodeado, sin condicional de entorno)
GIT_UNCHANGED=SI (origin/testing-codex=818b627..., origin/main=1de0d3c1..., sin tags, sin push)
INFRA_FIX_RETAINED=SI (Production preDeployCommand agregado, independiente del código)
P2_T29A_STATUS=PAUSED_PENDING_PRE_T29_PROMOTION (sin cambio — NO pasa a READY_TO_START)
NEXT_ACTION=corregir public/manifest-cliente.json en testing-codex (quitar ?iosDebug=1 del start_url o condicionarlo a detección real de entorno), re-certificar, desplegar a TESTING, luego reintentar esta misma tarea de promoción
```

El método de release curado (snapshot commit vía `git commit-tree` con
trailers `Source-Head`/`Source-Merge-Base`, construido en un worktree
aislado) quedó validado end-to-end y es directamente reutilizable en el
reintento — no hace falta re-derivarlo. Detalle completo:
`codex-reports/PRE_T29_PROMOTE_CERTIFIED_TESTING_TO_MAIN_AND_PRODUCTION.md`.

## PAGOS — Mercado Pago (diseño, no implementado) — 2026-09-07

```text
PAYMENTS_DESIGN_DOCUMENT_CREATED=SI
PAYMENTS_DESIGN_AUTHORITY=codex-reports/PAYMENTS_MERCADOPAGO_DESIGN.md
PAYMENT_PROVIDER_V1=MERCADOPAGO
MERCADOPAGO_INTEGRATION_CREATED=NO
```

Leonardo definió el diseño económico y técnico completo de Mercado Pago
(función opcional por negocio, OAuth one-click, split 1:1, tarifa
DeliGO $100 pagada por el cliente, deuda de tarifa sólo por efectivo —
nunca por MP Split, precio sugerido estimado que protege tanto el neto
del negocio como la tarifa DeliGO, y la regla central de authorization
+ deferred capture con condición AND: negocio aceptó Y venció la
ventana de cancelación). Todo el detalle, incluidas las decisiones
confirmadas, los findings investigados (RESEARCHED, no certificados),
los supuestos prohibidos, y el spike técnico obligatorio antes de
implementar, vive en `codex-reports/PAYMENTS_MERCADOPAGO_DESIGN.md` —
ese documento es la autoridad, este archivo sólo resume.

```text
PAYMENTS-01  Mercado Pago official compatibility research/spike       = PLANNED
PAYMENTS-02  Economic/pricing model finalization                       = PLANNED
PAYMENTS-03  Data model / payment state machine design                 = PLANNED
PAYMENTS-04  OAuth seller connection                                   = PLANNED
PAYMENTS-05  Payment authorization + capture                           = PLANNED
PAYMENTS-06  Split + DeliGO fee reconciliation                         = PLANNED
PAYMENTS-07  Cancellation / refund handling                            = PLANNED
PAYMENTS-08  Business UI / suggested pricing                           = PLANNED
PAYMENTS-09  Client checkout                                           = PLANNED
PAYMENTS-10  Terms / legal / production certification                 = PLANNED
```

Ninguna etapa comenzó — `PRODUCT_CODE_CHANGED=NO`,
`DB_SCHEMA_CHANGED=NO`. Próximo paso único: `PAYMENTS-01`
(`MERCADOPAGO_SPLIT_DEFERRED_CAPTURE_COMPATIBILITY_SPIKE`) — no
autorizado a iniciar en esta tarea.

## PRE-T29-PRODUCTION-GOOGLE-OAUTH-PENDING-SECRET-PRECONDITION — 2026-09-08 (único blocker de promoción RESUELTO — variable agregada a Railway Production, redeploy del mismo commit SUCCESS)

```text
PREVIOUS_PROMOTION_BLOCKER=MISSING_PRODUCTION_ENV_VAR_GOOGLE_OAUTH_PENDING_SECRET / PREVIOUS_PROMOTION_BLOCKER_RESOLVED=SI
PROMOTION_ENV_PRECONDITION_READY=SI / PRE_T29_PROMOTION_CAN_NOW_PROCEED=SI
GOOGLE_OAUTH_PENDING_SECRET_VALUE_EXPOSED=NO / PRODUCTION_GOOGLE_OAUTH_PENDING_SECRET_PRESENT=SI (longitud 64, validada sin leer el valor)
ENV_CHANGE_TRIGGERED_PRODUCTION_REDEPLOY=SI / PRODUCTION_ENV_REDEPLOY_STATUS=SUCCESS / PRODUCTION_ENV_REDEPLOY_COMMIT=1de0d3c153eaf3be068adeb004ea43feb42fc40e (sin cambio de código)
PRODUCTION_CODE_CHANGED=NO / TESTING_ENV_MUTATED=NO / NON_TARGET_ENV_VARS_MUTATED=NO
```

Única mutación operacional autorizada: agregar `GOOGLE_OAUTH_PENDING_
SECRET` a Railway Production/servicio "DeliGO", resolviendo el único
blocker de `PRE_T29_PRODUCTION_PROMOTION_READINESS_AUDIT.md`. Target
confirmado explícitamente antes de mutar (el contexto CLI por defecto
apuntaba a TESTING, no a Production — cada comando usó flags
explícitos). Secret nuevo y dedicado, generado con CSPRNG local, nunca
expuesto en ningún output/reporte — verificación de presencia y
longitud realizada sin leer el valor en ningún momento. El cambio
disparó un redeploy automático del MISMO commit (autorizado
explícitamente para este caso), `SUCCESS`, smoke no mutante PASS.
TESTING y el resto de variables de Production confirmadas sin cambios.

De las 17 condiciones de `PROMOTION_READY`, todas quedan satisfechas
ahora. No se ejecutó ninguna promoción de código en esta tarea — sólo
la precondición. Ver
`PRE_T29_PRODUCTION_GOOGLE_OAUTH_PENDING_SECRET_PRECONDITION.md`.

## PRE-T29-PRODUCTION-PROMOTION-READINESS-AUDIT — 2026-09-08 (READ-ONLY — `PROMOTION_READY=NO`: único blocker es 1 env var faltante; historia divergida requiere release curado, no merge genérico — BLOCKER RESUELTO POR LA TAREA DE ARRIBA)

```text
PROMOTION_READY=NO
PROMOTION_BLOCKER=GOOGLE_OAUTH_PENDING_SECRET ausente en Railway Production
DELIGO_PUBLIC_LAUNCH_STATUS=NOT_PUBLISHED / PRODUCTION_CURRENT_ROLE=PRE_LAUNCH_CONTROLLED_ENVIRONMENT
MERGE_BASE=86609599bcbdf7979244c34298a27836e6452d3c / DIVERGED_HISTORY=SI (4 commits main-only, 61 testing-only)
RECOMMENDED_MAIN_PROMOTION_METHOD=release curado con Source-Commit trailer (precedente ya documentado en OPERATIONS_SECURITY_PRODUCTION_PROMOTION_R1.md; merge genérico simulado read-only produce 4 conflictos reales)
NEW_MIGRATIONS_PENDING_FOR_PRODUCTION=2 (ambas aditivas, ambas ya CLOSED/certificadas en TESTING)
RC_BUILD_PASS=SI / PROMOTION_NEW_FAIL=0 / SECRET_LEAK_IN_PROMOTION_DIFF=NO
```

Auditoría final de disponibilidad de promoción a Production, previa a
iniciar T29A. Distinción explícita: DeliGO no está publicado, sin
tráfico real — esta auditoría evalúa promoción TÉCNICA, no lanzamiento
público (el finding de aislamiento Android Cliente/Repartidor sigue
bloqueando lo segundo, no lo primero).

Hallazgo central: la historia de `main`/`testing-codex` está divergida
(merge-base 30 commits atrás), pero los 4 commits exclusivos de `main`
llevan trailers `Source-Commit:` que confirman una convención YA
establecida de "release curado" (verificado byte a byte, aplicado
sobre el HEAD real de `main`, nunca un merge completo) — documentada en
`OPERATIONS_SECURITY_PRODUCTION_PROMOTION_R1.md`. Un merge genérico,
simulado de forma 100% read-only vía `git merge-tree --write-tree`
(sin tocar working tree/index/HEAD), produce 4 conflictos textuales
reales — confirmando que la convención curada sigue siendo la correcta.

Único blocker real: `GOOGLE_OAUTH_PENDING_SECRET` (requerido, sin
fallback) ausente en Production — gap mecánico y acotado (sólo afecta
el callback de Google OAuth para identidades nuevas), no un blocker de
diseño. 2 migrations nuevas, ambas aditivas y ya certificadas en
TESTING, recomendadas para incluir (excluidas de la promoción anterior
sólo por corte cronológico). Dependencias idénticas, secret scan
limpio, diagnósticos de TESTING revalidados como seguros post-
promoción, build/typecheck/1177 tests sin regresión nueva (9 fallas
preexistentes ya documentadas).

Diseño completo entregado, no ejecutado: estrategia de release curado,
tag `pre-t29-stable-2026-09-08`, mecanismo de deploy confirmado
(autodeploy Git + `preDeployCommand` Prisma), smoke checklist,
rollback. Cero cambios de producto/tests/DB/Railway. Ver
`PRE_T29_PRODUCTION_PROMOTION_READINESS_AUDIT.md`.

## P2-T29-ESPERANDO-REPARTIDOR-ACCEPTANCE-REDESIGN-AUDIT-AND-DESIGN — 2026-09-08 (READ-ONLY — diseño completo: ACEPTADO+ESPERANDO_REPARTIDOR, cero migration, T27 fusionado a T29A, gap crítico de test identificado)

```text
P2_T29_STATUS=AUDITED_DESIGNED_READY_FOR_IMPLEMENTATION
CANONICAL_ACCEPTED_STATE=aceptado / CANONICAL_WAITING_DRIVER_STATE=esperando_repartidor
MIGRATION_REQUIRED=NO / ORDER_STATUS_DB_TYPE=String sin enum/CHECK
CURRENT_DRIVER_ACCEPTANCE_ATOMIC=SI (ya seguro, updateMany CAS real) / TEST_GAPS_FOR_T29=CRÍTICO en repartidor/pedidos/[id]/aceptar (cero tests hoy)
P2_T27_DISPOSITION_FOR_T29=MERGE_INTO_T29 / P2_T28_DISPOSITION_FOR_T29=reutilizar CAS+lock+PedidoEvento, cerrar gap residual en T29A
ORDER_TRANSITION_SINGLE_AUTHORITY=NO (3 copias de reglas de transición)
IMPLEMENTATION_PHASES=T29A->T29B->T29C->T29D->T29E
NEXT_RECOMMENDED_ACTION=P2_T29A_ORDER_TRANSITION_AUTHORITY_CAS_AND_CONCURRENCY_TESTS (no iniciado)
```

Auditoría profunda del lifecycle de pedidos, 100% desde código real
(schema, 3 copias de reglas de transición, endpoint de aceptación de
repartidor, notificaciones, UI de los 3 roles, tests existentes) — cero
suposiciones sin verificar. Reconstruyó el grafo actual (probando que
`en_camino` está sobrecargado: significa tanto "buscando repartidor"
como "repartidor asignado en camino", causando un texto de UI
comprobadamente ambiguo en `orders-tab.tsx`) y diseñó el grafo objetivo
por modalidad: domicilio y retiro reciben `aceptado`, mesa NO (sin
ventana de decisión remota que justifique el paso adicional).

`esperando_repartidor` recomendado sobre `buscando_repartidor` — el
mecanismo real es polling pasivo de 8s, sin dispatch/ranking activo.
`estado` es un `String` Prisma plano sin enum ni CHECK constraint —
agregar valores nuevos no requiere ninguna migration, sólo código.

La aceptación atómica del repartidor (`repartidor/pedidos/[id]/
aceptar`) ya usa un CAS real (`updateMany` con la condición de estado
esperado en el `WHERE`) — seguro hoy, reutilizable sin cambios
estructurales para el nuevo estado. Pero **no tiene ningún test de
concurrencia real** — el gap más crítico identificado, a cerrar en la
primera fase de implementación.

P2-T27 nunca se implementó (`QUEUED` desde su creación, sin código ni
reporte) — se recomienda fusionarlo a T29A en vez de precederlo, ya que
el patrón de CAS que generalizaría ya está probado en 6+ endpoints
reales y T29 reescribe de todos modos el archivo donde falta. P2-T28
estableció que sólo `cancelado` usa CAS hoy — T29A cierra ese residual.

Diseño completo: matriz de notificaciones (10 transiciones), matriz de
UI por rol, matriz de cancelación por estado/actor, timeouts (el
auto-cancel de 30 min YA EXISTE y es seguro), plan de compatibilidad
legacy sin backfill ni transformación retroactiva, inventario de tests
(casi nulo para transiciones), y 5 fases de implementación con
fileset/dependencias explícitos (T29A autoridad+CAS+tests → T29B
Negocio → T29C Repartidor → T29D Cliente/notificaciones → T29E
compatibilidad/regresión/TESTING).

2 preguntas de producto quedan explícitamente abiertas para el
operador, no asumidas: cancelación de Cliente durante `aceptado`, y si
mesa también debe recibir `aceptado`. Ninguna implementación inicia sin
esas respuestas. Cero cambios de producto/tests/DB en esta tarea. P2-T31
sigue `CLOSED_TESTING_CERTIFIED`, no reabierto. Ver
`P2_T29_ESPERANDO_REPARTIDOR_ACCEPTANCE_REDESIGN_AUDIT_AND_DESIGN.md`.

## P2-T31-R21-FINAL-DIAGNOSTICS-DISPOSITION-AND-CLOSEOUT — 2026-09-08 (P2-T31 CERRADO — `CLOSED_TESTING_CERTIFIED`; R24 confirmado físicamente; diagnósticos R6/R6A/R6B reclasificados PERMANENTES, sin cleanup necesario)

```text
P2_T31_STATUS=CLOSED_TESTING_CERTIFIED
R24_PHYSICAL_CONFIRMATION=PASS / IOS_CHAT_SAFE_AREA_INTERACTIVE_CONTROLS_FINDING=PHYSICALLY_CONFIRMED_FIXED_TESTING
ANDROID_PHYSICAL_CERTIFICATION_COMPLETE=SI / FINAL_PUSH_DIAGNOSTICS_DISPOSITION=RETAIN_SAFE_PERMANENT_ONLY / P2_T31_R21A_CLEANUP_REQUIRED=NO
DIAGNOSTIC_SECRET_EXPOSURE_FINDING=NONE / PRODUCTION_USER_VISIBLE_PUSH_DIAGNOSTICS_PRESENT=NO
PRODUCTION_TOUCHED=NO / PRODUCTION_COMMIT_FINAL=1de0d3c153eaf3be068adeb004ea43feb42fc40e
P2_T29_STATUS=READY_TO_START (no iniciado) / P2_T02_STATUS=WAITING_FOR_OPERATOR / PAYMENTS_WORK_STATUS=DEFERRED
```

Auditoría final READ-ONLY. R24 (safe-area de chat en iOS) confirmado
físicamente en las 4 áreas obligatorias — CERRADO, junto con R23C
(tap de chat) y R22A (routing de íconos), ya cerrados previamente.
Matriz física de Push consolidada sin duplicados: Cliente/Negocio/
Repartidor en iPhone (`CERTIFIED_TESTING`) y Android (Cliente
`CERTIFIED_TESTING`, Negocio/Repartidor `PASS`/short smoke); el
incidente histórico "Android A" (`AbortError`,
`STRONGLY_SUPPORTED_PLATFORM_LEVEL_PUSH_SERVICE_REGISTRATION_FAILURE`,
nunca `CONFIRMED`) se preserva sin reabrir.

Inventario exhaustivo, por lectura directa de código (no sólo
reportes), de toda la instrumentación R6/R6A/R6B/R7/R19R1
(`PushDebugPanel`, `push-debug-trace.ts`, `push-debug-snapshot.ts`,
`push-debug-trace-bootstrap.tsx`): todos verificados como
`SAFE_TESTING_DIAGNOSTIC` — gate server-side fail-closed (404
indistinguible en Production), fingerprints no reversibles/redacción
por patrón de nombre en vez de valores crudos, nunca sale del origen
(`localStorage`), de sólo lectura. `push-mutation-in-flight-registry.ts`
y el logging de error estándar clasifican como `PERMANENT_HARDENING`.
Ningún diagnóstico visible a un usuario normal, ni exposición de
secretos/PII.

La condición de R10 (retener hasta certificación física de Android) ya
se cumplió, pero como todo lo auditado ya es seguro por diseño, se
reclasifica a retención PERMANENTE en vez de disparar un cleanup —
`P2_T31_R21A_CLEANUP_REQUIRED=NO`, no se diseña ninguna tarea R21A.

Las 8 condiciones de cierre se verificaron cumplidas. Findings
preservados explícitamente SEPARADOS del cierre de Push: sesión
cruzada Android Cliente/Repartidor (no bloquea T31, sí production
readiness general), Android install UX, branding/ícono, deuda de
contrato estático iOS/PWA (5 fallas preexistentes) y deuda MODEL-G1/
MODEL-E1 de P2-T02 (epic distinto). Recheck read-only barato: 21/21 +
6/6 + 12/12 + 607/607, todos sin regresión. Git estrictamente
read-only, `PRODUCT_DIFF=NONE`/`TEST_DIFF=NONE`. Production intacta,
ninguna promoción autorizada.

**`P2_T31_STATUS=CLOSED_TESTING_CERTIFIED`**. P2-T29 `READY_TO_START`
(no iniciado). P2-T02 `WAITING_FOR_OPERATOR`. Payments `DEFERRED`. Ver
`P2_T31_R21_FINAL_DIAGNOSTICS_DISPOSITION_AND_CLOSEOUT.md`.

## P2-T31-R24-IOS-CHAT-SAFE-AREA-INTERACTIVE-CONTROLS-AUDIT-FIX-TESTING-DEPLOY — 2026-09-08 (R23C confirmado físicamente y CERRADO; fix de safe-area de chat desplegado en TESTING, commit 818b627 — CONFIRMADO FÍSICAMENTE Y CERRADO POR R21 ARRIBA, P2-T31 CERRADO)

```text
PUSH_CHAT_NOTIFICATION_TAP_ROUTING_FINDING=PHYSICALLY_CONFIRMED_FIXED_TESTING (R23C, 4/4 combinaciones PASS — CERRADO)
IOS_CHAT_SAFE_AREA_ROOT_CAUSE_CLASS=INTERACTIVE_HEADER_CONTAINER_TOP_0_WITHOUT_SAFE_AREA_PADDING / STATUS=PROVEN
COMMIT_HASH=818b627b472e03e80034c047a51dfd3491f3add3 / COMMIT_PARENT=1bd953a6bc97fe5dffa993d1653ee55212f012d4
TESTING_DEPLOYMENT_ID=1f025eba-02ed-469c-9412-3c3c740d4550 / STATUS=SUCCESS (match exacto, servicio "DeliGO Copy")
IOS_CHAT_SAFE_AREA_TEST_PASS=12 (nuevo) / PUSH_TEST_FINAL_PASS=607 (sin regresión) / CHAT_R23C_REGRESSION_PASS=21 (sin cambios) / BUILD_PASS=SI
P2_T31_STATUS=IN_PROGRESS_PENDING_IOS_CHAT_SAFE_AREA_PHYSICAL_CONFIRMATION_AND_FINAL_DIAGNOSTICS_CLOSEOUT
```

**R23C reconciliado primero**: nueva evidencia física confirmó el fix
en las 4 combinaciones obligatorias (Android/iPhone × cold/warm) — el
finding de tap de chat queda `PHYSICALLY_CONFIRMED_FIXED_TESTING`,
CERRADO. R23/R23A/R23B/R23C no se reabren.

Auditó el árbol completo de Chat: DOS headers en flujo normal sin
protección de safe-area (listado en `chat-sheet.tsx`, conversación en
`chat-view.tsx`) más el botón cerrar (X) built-in compartido de
`sheet.tsx` (`absolute top-4 right-4`, único cierre del listado). Root
cause `PROVEN`: contenedores en flujo normal/`top:0` sin `env(safe-
area-inset-top)`, mientras el fondo del Sheet ya hereda correctamente
el full-bleed vía `viewport-fit=cover` (global, sin tocar).

Fix con el mismo idioma ya establecido en el repo
(`mesa-cuenta-dialog.tsx`, `n/[slug]/page.tsx`): los dos headers
reciben `pt-[calc(env(safe-area-inset-top,0px)+Xrem)]`. El botón X
compartido recibió `data-slot="sheet-close"` (inerte, misma convención
que `dialog.tsx`) para poder escoparlo en `globals.css` exclusivamente
bajo `[data-ios-debug-role="chat-sheet"]` — ningún otro Sheet de la app
se ve afectado. Sin branching por plataforma. `useChatDeepLink`/
`useChatActorReset`/push routing/`notificationclick`: sin ningún
cambio.

Gate completo: 12 tests nuevos, R23C 21/21 sin cambios,
`notificationclick` 6/6 sin cambios, Push 607/607 sin regresión, iOS/
PWA proxy con las mismas 5 fallas preexistentes de R23C (0 nuevas),
ESLint/TypeScript (24 raw, 0 nuevos)/build limpios. Fileset exacto:
`chat-sheet.tsx` + `chat-view.tsx` + `sheet.tsx` (sólo `data-slot`
inerte) + `globals.css` + 1 test nuevo. Un commit (`818b627`, parent
`1bd953a`), push a `testing-codex`, autodeploy a "DeliGO Copy" con
match exacto de commit, smokes no mutantes (`/negocio`→200,
`/cliente/`→308). Production intacta.

No se certifica físicamente — checklist entregado (iPhone listado/
conversación/teclado, Android control). P2-T31 sigue abierto — "R21
final" no se ejecuta. Ver
`P2_T31_R24_IOS_CHAT_SAFE_AREA_INTERACTIVE_CONTROLS_AUDIT_FIX_TESTING_DEPLOY.md`.

## P2-T31-R23C-CHAT-ACTOR-RESET-FIRST-HYDRATION-GUARD-FIX-TESTING-DEPLOY — 2026-09-08 (fix del root cause PROVEN de R23B desplegado en TESTING, commit 1bd953a — CONFIRMADO FÍSICAMENTE POR R24 ARRIBA; finding Cliente/Repartidor Android CORREGIDO — Google descartado como trigger)

```text
COMMIT_HASH=1bd953a6bc97fe5dffa993d1653ee55212f012d4 / COMMIT_PARENT=23c038af4406e7ee838d465e3d2023acf391fb5f
TESTING_DEPLOYMENT_ID=e1fad4be-dacb-44c8-8721-48973bb18bdf / STATUS=SUCCESS (match exacto, servicio "DeliGO Copy")
R23B_ROOT_CAUSE_REPRO_WITH_OLD_RESET=FAIL_EXPECTED (5/21 confirmado) / R23C_ROOT_CAUSE_REPRO_WITH_NEW_RESET=PASS (21/21 confirmado)
PUSH_TEST_FINAL_PASS=607 (sin regresión) / NOTIFICATIONCLICK_TEST_PASS=6 (sin cambios) / BUILD_PASS=SI
GOOGLE_ACCOUNT_SPECIFIC_TRIGGER=RULED_OUT_BY_PHYSICAL_EVIDENCE (Android same-account FAIL Y different-account FAIL; iPhone same-account PASS control positivo)
P2_T31_STATUS=IN_PROGRESS_PENDING_R23C_CHAT_TAP_PHYSICAL_CONFIRMATION_AND_IOS_SAFE_AREA_AND_FINAL_DIAGNOSTICS_CLOSEOUT
```

Implementó el fix mínimo del root cause `PROVEN` de R23B:
`useChatActorReset` (`src/providers/chat-provider.tsx`) agregó
`previous !== null` a su guard de reset, distinguiendo la primera
hidratación de `auth-store` (`null → primer actor real`, que ya NO
resetea el chat-store) de un cambio de actor genuino (`real → null`
logout, o `real A → real B`, incluyendo cambio de rol, que SIGUEN
reseteando exactamente igual que antes — la propiedad de seguridad
cross-actor no se debilitó). R23A no se tocó ni se revirtió.

Verificación rigurosa: se revirtió temporalmente sólo el `!== null` y
se confirmó que 5 de 21 tests nuevos fallan sin el fix, restaurándolo
de inmediato. Se extendió `chat-provider-deep-link-hydration.test.ts`
con un `JointHarness` que monta `useChatDeepLink()` +
`useChatActorReset()` (ambas exportadas sólo para test) EN EL MISMO
ORDEN que `ChatProvider` real, cubriendo el repro principal, un test de
persistencia final, y la matriz completa de 9 transiciones de actor.

Gate completo: Push 607/607 (34 archivos, sin regresión),
`notificationclick` 6/6 sin cambios, ESLint limpio, TypeScript 24 raw
idéntico (0 nuevos), `next build` limpio. `sw.js`/`auth-store.ts`/
`chat-store.ts`/backend: ningún cambio. Fileset exacto: `chat-
provider.tsx` + su test — nada más. Un commit (`1bd953a`, parent
`23c038a`), push a `testing-codex`, autodeploy a "DeliGO Copy" con
match exacto de commit, logs de boot limpios, smokes no mutantes
(`/negocio`→200, `/cliente/`→308). Production intacta.

**Finding Cliente/Repartidor Android CORREGIDO**: evidencia física
nueva descarta que la cuenta de Google sea el factor discriminante —
en Android falla TANTO con la misma cuenta COMO con cuentas distintas;
en iPhone, la misma cuenta SÍ permite ambos roles simultáneos (control
positivo). Re-registrado como
`ANDROID_CLIENTE_REPARTIDOR_CONCURRENT_SESSION_ISOLATION_FINDING=OPEN`,
alcance Android, causa raíz diferida a tarea futura.

No se certifica físicamente — checklist de 3 casos obligatorios
(Android Negocio cold/warm, iPhone Negocio cold) + 1 recomendado
entregado. P2-T31 sigue abierto — "R21 final" no se ejecuta. Ver
`P2_T31_R23C_CHAT_ACTOR_RESET_FIRST_HYDRATION_GUARD_FIX_TESTING_DEPLOY.md`.

## P2-T31-R23B-CHAT-PUSH-TAP-RUNTIME-URL-CONSUMPTION-ROOT-CAUSE-AUDIT — 2026-09-08 (READ-ONLY — causa raíz PROBADA con reproducción de código real: `useChatActorReset` borra el chat-store justo después de que `useChatDeepLink` lo abre; retest físico de R23A FALLÓ en ambas plataformas; nuevo finding formal de sesión Google cruzada multi-rol registrado — FIX IMPLEMENTADO Y DESPLEGADO POR R23C ARRIBA)

```text
R23A_PHYSICAL_FIX_CONFIRMATION=FAIL / PHYSICAL_CHAT_NOTIFICATION_TAP_ANDROID=FAIL / PHYSICAL_CHAT_NOTIFICATION_TAP_IPHONE=FAIL
ANDROID_CHAT_TAP_WARM_APP=FAIL (app ya abierta/autenticada — descarta la hidratación como causa única)
AUTH_HYDRATION_RACE_WAS_COMPLETE_PHYSICAL_ROOT_CAUSE=NO (R23A no se descarta, sigue correcto y necesario)
FINAL_ROOT_CAUSE_CLASSIFICATION=H_CHAT_SHEET_STATE_IS_RESET_AFTER_OPEN / STATUS=PROVEN
CROSS_ROLE_SAME_GOOGLE_ACCOUNT_CONCURRENT_SESSION_FINDING=OPEN (nuevo, no bloquea P2-T31, sí bloquea production readiness, root cause diferido)
P2_T31_STATUS=IN_PROGRESS_PENDING_CHAT_TAP_R23C_FIX_AND_IOS_SAFE_AREA_AND_FINAL_DIAGNOSTICS_CLOSEOUT
GIT_DEPLOY_HISTORY_UPDATED=NO (sin commit/push/deploy — auditoría estrictamente read-only)
```

El retest físico del fix de hidratación de R23A (desplegado en TESTING
el mismo día, commit `23c038a`, deployment `96dc9cd8` `SUCCESS`) falló
de nuevo en Android e iPhone. Evidencia "warm app" decisiva: con
Negocio ya abierto, autenticado, sin ninguna hidratación pendiente, el
tap de un chat entrante sigue sin abrir el chat — esto prueba que la
carrera de hidratación no es la causa completa, porque `Client.
navigate()` (usado por `notificationclick` sobre una PWA ya abierta) es
una navegación de documento real que reinicia el runtime de JS igual
que un arranque en frío.

Inventario exhaustivo de escritores de URL en `app/negocio/**`,
`app/cliente/**`, `components/business/**`, `providers/**`, `store/**`,
`hooks/**` descartó cualquier normalización/limpieza de query como
causa (ningún archivo de esos árboles toca la URL fuera de los ya
conocidos); `start_url`/`launch_handler` del manifest de Negocio
también descartados (no interceptan URLs explícitas pasadas por el SW,
y no explicarían iPhone).

Causa raíz adicional PROBADA con reproducción de código real (no sólo
inferida por lectura): `ChatProvider` llama `useChatDeepLink()` y luego
`useChatActorReset()` — ambos efectos corren, en ese orden, dentro del
MISMO commit de React cuando `auth-store` rehidrata `user` y
`_hasHydrated` sincrónicamente (confirmado en el código real de
`auth-store.ts`). `useChatActorReset` trata la transición `null →
usuario real` como un cambio de actor y llama
`useChatStore.getState().reset()` (único call site de producción),
borrando el sheet que `useChatDeepLink` acababa de abrir. Reproducido
con un script fuera del repo (nunca commiteado) que monta el hook real
exportado junto a una redeclaración fiel del hook privado, en el mismo
orden real: el escenario de un solo commit (el real) pierde el
deep-link; el de dos commits separados lo preserva.

No se implementó ningún fix en esta tarea (read-only). Diseño (no
código) para una futura `R23C`: `useChatActorReset` debe ignorar la
transición `null → primer usuario real tras el mount`, y sólo resetear
cuando el actor anterior YA era un usuario real distinto. Nuevo
finding formal registrado, no corregido, no mezclado con éste: usar la
misma cuenta de Google en Cliente y Repartidor rompe una de las dos
sesiones; requisito de producto explícito de permitir ambas
simultáneamente con la misma identidad — causa raíz diferida a tarea
futura. Git estrictamente read-only, `PRODUCT_DIFF=NONE`/
`TEST_DIFF=NONE`. P2-T31 sigue abierto — "R21 final" no se ejecuta. Ver
`P2_T31_R23B_CHAT_PUSH_TAP_RUNTIME_URL_CONSUMPTION_ROOT_CAUSE_AUDIT.md`.

## P2-T31-R23A-CHAT-NOTIFICATION-DEEPLINK-AUTH-HYDRATION-FIX-TESTING-DEPLOY — 2026-09-08 (fix desplegado en TESTING, commit 23c038a — retest físico FALLÓ en ambas plataformas, causa adicional PROBADA y auditada por R23B arriba; 2 findings nuevos: iOS chat safe-area bloquea T31, Android install UX no bloquea)

```text
COMMIT_HASH=23c038af4406e7ee838d465e3d2023acf391fb5f / COMMIT_PARENT=ed58ca47a522b8190c41283818d1742887f24d31
TESTING_DEPLOYMENT_ID=96dc9cd8-b4d6-492b-a0e6-e6566127d38c / STATUS=SUCCESS (match exacto)
R23_AUTH_HYDRATION_RACE_REPRO_BEFORE=FAIL_EXPECTED (3/10 confirmado) / R23_AUTH_HYDRATION_RACE_REPRO_AFTER=PASS (10/10 confirmado)
PUSH_TEST_FINAL_PASS=607 (sin regresión) / PWA_FOCAL_TEST_PASS=52 (sin regresión) / BUILD_PASS=SI
IOS_CHAT_SAFE_AREA_INTERACTIVE_CONTROLS_FINDING=OPEN (bloquea T31) / ANDROID_PWA_INSTALL_COMPLETION_UX_FINDING=OPEN (no bloquea, queued)
P2_T31_STATUS=IN_PROGRESS_PENDING_CHAT_TAP_PHYSICAL_CONFIRMATION_AND_IOS_CHAT_SAFE_AREA_FIX_AND_FINAL_DIAGNOSTICS_CLOSEOUT
```

Implementó el fix diseñado en R23: `useChatDeepLink`
(`src/providers/chat-provider.tsx`) ahora lee `authHasHydrated`
(`_hasHydrated`, campo ya existente en `auth-store.ts`) y lo agrega a
las dependencias del efecto — cuando la hidratación termina,
`consumeChatParam()` se reevalúa automáticamente, cerrando la carrera
donde un arranque en frío descartaba `?chat=<pedidoId>` para siempre
en silencio. Verificación rigurosa: se revirtió temporalmente sólo la
línea de dependencias y se confirmó que 3/10 tests nuevos fallan sin
el fix, restaurándolo de inmediato. 16 tests nuevos en total (10 de
hidratación con happy-dom + react-dom real, 6 de `notificationclick`
con el `sw.js` real, cerrando el gap de cobertura de R23). Sin cambios
en `sw.js`/`push.ts`/`auth-store.ts`. Stage de exactamente 3 archivos.

Desplegado en TESTING con match exacto de commit. Validación no
mutante: `/negocio`/`/cliente/` responden, bundle confirmado con
`_hasHydrated`. Production sin cambios. No se certifica físicamente —
checklist de 2-3 casos entregado (Android + iPhone Negocio
obligatorios). Se registraron 2 findings nuevos aportados por el
operador: iOS chat safe-area de controles interactivos (el
full-bleed intencional hasta la status bar deja también los controles
de cerrar/volver del chat inaccesibles en algunos casos — bloquea el
closeout de P2-T31) y Android PWA install completion UX (la app
muestra "instalada" antes de que el WebAPK termine de generarse en
background — UX general, no bloquea, queda en cola). Ninguna
certificación funcional de Push se revoca; el routing de íconos (R22A)
permanece cerrado, no se reabre. P2-T31 sigue abierto. Ver
`P2_T31_R23A_CHAT_NOTIFICATION_DEEPLINK_AUTH_HYDRATION_FIX_TESTING_DEPLOY.md`.

## P2-T31-R23-CHAT-PUSH-NOTIFICATION-TAP-DEEPLINK-ROOT-CAUSE-AUDIT — 2026-09-08 (R22A íconos confirmado físicamente y cerrado; nuevo finding: tap de chat falla en Android e iPhone — FIX IMPLEMENTADO Y DESPLEGADO POR R23A ARRIBA)

```text
ANDROID_PUSH_NOTIFICATION_ICON_ROUTING_FINDING=PHYSICALLY_CONFIRMED_FIXED_TESTING (los 3 roles PASS, cerrado)
PUSH_CHAT_NOTIFICATION_TAP_ROUTING_FINDING=OPEN (nuevo)
PHYSICAL_CHAT_NOTIFICATION_TAP_ANDROID=FAIL / PHYSICAL_CHAT_NOTIFICATION_TAP_IPHONE=FAIL
ROOT_CAUSE_PRIMARY_CLASS=CLIENT_SIDE_AUTH_HYDRATION_RACE_SILENTLY_DROPS_ONE_SHOT_CHAT_DEEPLINK / STATUS=STRONGLY_SUPPORTED
P2_T31_STATUS=IN_PROGRESS_PENDING_CHAT_NOTIFICATION_TAP_ROUTING_FIX_AND_FINAL_DIAGNOSTICS_CLOSEOUT
```

Reconciliación física de R22A: Android Cliente (`order_update`) y
Android Repartidor (`new_delivery`) tap correcto; Android Negocio
(`chat`) push/ícono correctos pero **tap incorrecto** — nuevo finding
independiente, confirmado también en iPhone. El routing de íconos por
rol queda cerrado físicamente en los 3 roles, no se reabre.

Se trazó el pipeline completo de chat (fábrica → payload →
`notificationclick` → `buildPersonalNotificationTarget` → window
matching → app cliente). Se ejecutó el `sw.js` real en sandbox VM
(misma técnica de R22/R22A) probando que la URL/ventana objetivo para
`negocio+chat` es exactamente correcta en app cerrada y abierta —
descartando con evidencia directa 7 de 9 categorías de causa (fábrica,
mapping, window-matching, ruta legacy, action handler, multi-PWA). La
única diferencia real contra los 2 controles que sí funcionan:
`ChatProvider` (único consumidor de deep-link montado en el layout
raíz) se auto-condiciona a `isAuthenticated()` sin esperar
`_hasHydrated` del store Zustand persistido — patrón defensivo ya
usado en 6+ archivos reales del repo, ausente aquí. Clasificado
`STRONGLY_SUPPORTED` (no `PROVEN`, sin reproducción de timing en
navegador real).

Fix diseñado (no implementado): gatear el efecto en `_hasHydrated` con
reintento al completar hidratación — un solo archivo, sin tocar
`sw.js`/backend/routing de íconos/pedidos. Re-test físico diseñado:
Android+iPhone Negocio con PWA cerrada, Cliente→chat, tap debe abrir
el chat correcto (no sólo el dashboard). Ninguna certificación
funcional de Push se revoca. P2-T31 sigue abierto — "R21 final" no se
ejecuta hasta el fix. Ver
`P2_T31_R23_CHAT_PUSH_NOTIFICATION_TAP_DEEPLINK_ROOT_CAUSE_AUDIT.md`.

## P2-T31-R22A-ANDROID-PUSH-NOTIFICATION-ROLE-ICON-ROUTING-FIX-TESTING-DEPLOY — 2026-09-08 (fix desplegado en TESTING, commit ed58ca4 — CONFIRMADO FÍSICAMENTE EN LOS 3 ROLES POR R23 ARRIBA)

```text
COMMIT_HASH=ed58ca47a522b8190c41283818d1742887f24d31 / COMMIT_PARENT=1d3f58a1ea5487d254b51fa8627b5935065bce3a
TESTING_DEPLOYMENT_ID=34f5cf79-25bd-4d7a-855c-287d8bacdc4a / STATUS=SUCCESS (match exacto)
PUSH_TEST_BASELINE_PASS=577 / PUSH_TEST_FINAL_PASS=607 / PWA_FOCAL_TEST_PASS=52 / BUILD_PASS=SI
R22_BUG_REPRO_BEFORE=FAIL_EXPECTED / R22_BUG_REPRO_AFTER=PASS
P2_T31_STATUS=IN_PROGRESS_PENDING_ANDROID_NOTIFICATION_ICON_ROUTING_PHYSICAL_CONFIRMATION_AND_FINAL_DIAGNOSTICS_CLOSEOUT
```

Implementó el fix diseñado en R22: `public/sw.js`::push event ahora
resuelve `icon`/`badge` PRIMERO por `data.data?.role` (ya agregado por
el backend desde "Bugfix-4 [17]", sin ningún cambio de backend
necesario) — el `notifType` legacy completo se preservó intacto como
fallback exclusivo para payloads sin `role`. Override explícito de
payload sigue ganando siempre; `notificationclick`/delivery/
subscription/dedupe: sin tocar. 26 tests nuevos ejercitando el `sw.js`
real (misma técnica de `sw-push-dedupe.test.ts`) + 4 tests de
`data.role` directo — suite Push 607/607, PWA focal 52/52, gates
limpios. Reproducción antes/después del bug físico exacto de R22
(Cliente+order_update, Negocio+chat, Repartidor+new_delivery):
FAIL→PASS confirmado.

Stage de exactamente 3 archivos (`sw.js` + 2 tests) — el reporte de
esta tarea queda untracked, sin generalizar el precedente puntual de
R1A. Commit único, push a `testing-codex`, autodeploy a "DeliGO Copy"
`SUCCESS` con match exacto. Validación no mutante: `GET /sw.js` sirve
contenido idéntico al commit (verificado byte a byte); los 3 íconos de
rol responden 200. Ninguna suscripción mutada, ningún pedido creado,
ningún Push real enviado. Production sin cambios.

No se certifica físicamente — checklist de 3 casos entregado al
operador (Cliente+order_update obligatorio, Negocio+chat y
Repartidor+new_delivery recomendados). Ninguna certificación funcional
de Push se revoca; maskable/SW-cache-substring/badge-monocromático/
unsubscribe-stale: todos preservados sin tocar. P2-T31 sigue abierto —
"R21 final" no se ejecuta hasta la confirmación física. Ver
`P2_T31_R22A_ANDROID_PUSH_NOTIFICATION_ROLE_ICON_ROUTING_FIX_TESTING_DEPLOY.md`.

## P2-T31-R22-ANDROID-PUSH-NOTIFICATION-ICON-ROUTING-ROOT-CAUSE-AUDIT — 2026-09-08 (causa raíz PROBADA: notifType compartido entre roles ignora data.role, ya existente; fix diseñado, no implementado — IMPLEMENTADO Y DESPLEGADO POR R22A ARRIBA)

```text
ROOT_CAUSE_PRIMARY_CLASS=SHARED_NOTIFTYPE_USED_BY_MULTIPLE_ROLES_WITH_ROLE_UNSAFE_ICON_MAPPING / STATUS=PROVEN
SHARED_NOTIFTYPE_LIST=order_update(cliente+negocio+repartidor), review(cliente+negocio), chat(cliente+negocio)
WRONG_ICON_PATH_GENERATED=SI (ejecución real de sw.js en VM sandbox) / CACHE_ROOT_CAUSE_PLAUSIBILITY=NO_EVIDENCE
RECOMMENDED_FIX_ARCHITECTURE=SW_USES_DATA_ROLE_AS_PRIMARY_ICON_SELECTOR_WITH_NOTIFTYPE_FALLBACK
P2_T31_STATUS=IN_PROGRESS_PENDING_ANDROID_NOTIFICATION_ICON_ROUTING_FIX
```

Auditoría read-only profunda, sin código/tests/commit/deploy. Se
trazó el pipeline completo (productor → `enrichedPushPayload` →
`webpush.sendNotification` → `push` event del SW → `showNotification`)
y se inventariaron los 12 `NotificationType` reales contra 20+ call
sites. Hallazgo central: `order_update` (el tipo MÁS FRECUENTE que
recibe un Cliente) se comparte entre Cliente/Negocio/Repartidor, y
`sw.js` lo mapea incondicionalmente al ícono de Negocio; lo mismo pasa
con `review` (Cliente+Negocio) y, en dirección opuesta, `chat`
(rompe para Negocio, cae al default Cliente). El campo que ya
resolvería esto — `data.role`, agregado por `createNotification()`
desde Bugfix-4 [17] para navegación — nunca se consulta en la
selección de ícono.

Se PROBÓ ejecutando el `sw.js` real (no reimplementado) en un sandbox
VM con payloads de forma real de producción: reprodujo exactamente el
síntoma físico (Cliente+order_update → ícono Negocio) más 2 instancias
nuevas confirmadas por el mismo mecanismo (Cliente+review, Negocio+chat).
Se descartaron con evidencia: caché, colisión de tag, atribución
multi-PWA, binding multi-owner. Se explicó (con fuente de Apple
Developer Forums) por qué iPhone se ve correcto pese al mismo bug:
WebKit ignora el `icon` de `showNotification()` y usa siempre el
ícono del manifest instalado — enmascara el bug, no lo desmiente.

Fix diseñado (NO implementado): usar `data.role` como criterio
primario en el `push` event, con el `notifType` actual completo como
fallback para tipos sin `role`. Backward compatibility explícita y
fail-safe. Ninguna certificación funcional de Push se revocó. P2-T31
sigue abierto — próximo paso es el fix (R22A), no R21. Ver
`P2_T31_R22_ANDROID_PUSH_NOTIFICATION_ICON_ROUTING_ROOT_CAUSE_AUDIT.md`.

## DELIGO-BRANDING-R1A-REVIEW-COMMIT-PUSH-TESTING-DEPLOY — 2026-09-08 (branding desplegado en TESTING, nuevo finding de routing de ícono de notificación Android — CAUSA RAÍZ PROBADA POR R22 ARRIBA)

```text
COMMIT_HASH=1d3f58a1ea5487d254b51fa8627b5935065bce3a / COMMIT_PARENT=39566e69647fd2b19453721214563a7b9a0ccc5e
TESTING_DEPLOYMENT_ID=976a7fa7-b607-40e2-8cb4-22907f005d22 / TESTING_DEPLOYMENT_STATUS=SUCCESS (match exacto)
FOCAL_TEST_PASS=52 / PUSH_TEST_PASS=577 / BUILD_PASS=SI / PRODUCTION_TOUCHED=NO
ANDROID_PUSH_NOTIFICATION_ICON_ROUTING_FINDING=OPEN (NUEVO — bloquea closeout de P2-T31)
PWA_MASKABLE_ICON_SAFE_ZONE_FINDING=OPEN / SW_ICON_CACHE_BYPASS_SUBSTRING_FINDING=OPEN_NON_BLOCKING
P2_T31_STATUS=IN_PROGRESS_PENDING_ANDROID_NOTIFICATION_ICON_ROUTING_AUDIT_AND_FINAL_DIAGNOSTICS_CLOSEOUT
```

Review independiente del trabajo local de Branding R1 (comparado
contra Git/archivos reales, no sólo el reporte) confirmó que todo
coincidía sin ninguna regresión. Gate re-ejecutado: 52 focales + 577
Push en 0 fail, ESLint/TypeScript/build limpios. Stage de exactamente
15 archivos (14 de producto/test + el reporte de R1, explícitamente
autorizado — primer archivo jamás trackeado bajo `codex-reports/`).
Commit único, push a `testing-codex`, autodeploy a "DeliGO Copy"
alcanzó `SUCCESS` con match exacto de commit. 16 smokes HTTP no
mutantes (app + 5 manifests + 10 íconos) pasaron con bytes idénticos al
commit; `manifest-operaciones.json` confirmado sin `icon-negocio`;
`sw.js` sirviendo `deligo-v15`. Production confirmado sin cambios.

Se reconciliaron pruebas físicas nuevas: Android Negocio en segundo
dispositivo (PASS completo) y Android Repartidor (PASS completo) — sin
tocar la historia del Android con `AbortError` persistente (residual
específico de dispositivo, no un blocker general). Se registró un
finding NUEVO y crítico: **Android Cliente mostró el ícono de Negocio
en una notificación Push** (iPhone equivalente correcto, causa raíz no
auditada) — no se investigó ni corrigió, sólo se documentó con la
evidencia de código de `sw.js` como insumo para la próxima auditoría.
Este finding bloquea el closeout de P2-T31, que sigue abierto. P2-T29
sigue en cola; Payments diferido. Ver
`DELIGO_BRANDING_R1A_REVIEW_COMMIT_PUSH_TESTING_DEPLOY.md`.

## DELIGO-BRANDING-R1-PWA-ROLE-ICON-REFRESH — 2026-09-08 (nuevos íconos de rol instalados local, Operaciones deja de prestar el ícono de Negocio — tarea independiente de P2-T31 — DESPLEGADO EN TESTING POR R1A ARRIBA)

```text
DELIGO_BRANDING_R1_STATUS=IMPLEMENTED_LOCAL_TESTED_PENDING_COMMIT_REVIEW
CLIENT/NEGOCIO/REPARTIDOR/ADMIN_ICON_REFRESHED=SI (mismo path, sólo contenido) / OPERACIONES_ICON_REFRESHED=SI (paths nuevos, ya no reusa icon-negocio-*)
MASKABLE_SAFE_DERIVATIVE_STATUS=BLOCKED_NEEDS_DESIGN_DECISION (preexistente, no regresión)
SW_CACHE_VERSION_CHANGED=SI (deligo-v14 -> deligo-v15, evidencia directa de bypass roto)
FOCAL_TEST_PASS=52 / PUSH_TEST_PASS=577 (re-ejecutada por tocar sw.js) / ESLINT_PASS=SI / TYPECHECK_NEW_ERRORS=0 / BUILD_PASS=SI
STAGE_PERFORMED=NO / COMMIT_PERFORMED=NO / PUSH_PERFORMED=NO / DEPLOY_PERFORMED=NO
```

5 assets fuente nuevos del operador (`deligo {cliente,negocio,
repartidor,admin,operaciones}.png`, 1254x1254, 100% opacos pese a
declarar alfa) reemplazan el contenido de los 8 PNG de ícono existentes
(mismo path, cero cambio de wiring) y agregan 2 archivos nuevos para
Operaciones, que hasta ahora prestaba el ícono de Negocio (documentado
así desde "Bugfix-2 [6]"). `role-config.ts` y
`manifest-operaciones.json` actualizados para apuntar a los nuevos
`icon-operaciones-*`. Maskable queda `BLOCKED_NEEDS_DESIGN_DECISION`
(el fondo original no puede extenderse sin inventar píxeles fuera del
cuadrado ya "horneado" con esquinas negras opacas) — se preserva el
mismo patrón de reuso "any"/"maskable" que ya existía, sin regresión.
Favicon/Apple sin cambios de wiring (ya usaban Cliente/icon192,
certificado en iPhone). Notificaciones: `sw.js` no cambió su lógica de
selección de `icon`/`badge` — Cliente/Negocio refrescan su branding en
push automáticamente; el mismatch preexistente de Repartidor/Admin/
Operaciones (sin rama propia, caen a Cliente) y el badge full-color sin
alfa real quedaron documentados, no corregidos (fuera de alcance
explícito). Hallazgo con evidencia directa: la condición de `sw.js`
que pretende servir íconos siempre desde red nunca matchea ningún
nombre de archivo real — se subió `CACHE_NAME` para forzar la
invalidación de caché de clientes con el ícono viejo ya cacheado; el
bug del substring en sí no se corrigió (fuera de alcance). 52 tests
focales + 577 Push en 0 fail, ESLint limpio, TypeScript sin errores
nuevos, `next build` limpio. Cero commit/push/deploy. Completamente
independiente de P2-T31 (ver la entrada R20 debajo, sin ningún cambio).
Reporte completo: `DELIGO_BRANDING_R1_PWA_ROLE_ICON_REFRESH.md`.

## P2-T31-R20-ANDROID-PUSHMANAGER-PERSISTENT-ABORTERROR-ROOT-CAUSE-AND-DEVICE-DIAGNOSTIC — 2026-09-08 (ambos intentos físicos de R19A fallaron con AbortError, causa de plataforma elevada a STRONGLY_SUPPORTED, pendiente control externo)

```text
R19A_PHYSICAL_MITIGATION_RESULT=FAIL (2 intentos reales de subscribe(), ambos AbortError, ~290ms y ~510ms)
BACKEND_SUBSCRIBE_REACHED=NO / R13A_FAILURE_STATE_CONTRACT_PHYSICAL_RESULT=PASS
VAPID_MALFORMATION_STILL_PLAUSIBLE=NO / VAPID_ENV_MISMATCH_STILL_PLAUSIBLE=NO (key en vivo: 87 chars b64url, 65 bytes, 0x04, sin rotación)
ABORTERROR_UNDERLYING_CAUSE_STATUS=STRONGLY_SUPPORTED_PLATFORM_LEVEL_PUSH_SERVICE_REGISTRATION_FAILURE (elevado desde NOT_PROVEN_PLAUSIBLE)
FURTHER_DELIGO_CODE_CHANGE_JUSTIFIED_NOW=NO
NEXT_PHYSICAL_DIAGNOSTIC_ACTION=EXTERNAL_WEB_PUSH_CONTROL_TEST_VIA_WEB_PUSH_CODELAB_GLITCH_ME
NEXT_DELIGO_PUSH_TOGGLE_ACTION=BLOCKED_UNTIL_DIAGNOSTIC_RESULT
P2_T31_STATUS=IN_PROGRESS_ANDROID_NEGOCIO_PERSISTENT_PUSHMANAGER_ABORTERROR_PENDING_PLATFORM_DEVICE_DIAGNOSTIC
```

Auditoría read-only profunda, sin código/tests/commit/deploy. El
retest físico de R19A ejecutó exactamente la mitigación diseñada
(recheck `getSubscription()` → `found=false` → único retry autorizado)
y ambos intentos reales de `PushManager.subscribe()` fallaron con
`AbortError`, sin ningún contacto con el backend. Se reauditó la
matriz completa de precondiciones source-level del `subscribe()` (VAPID
forma/conversión/longitud/contenido, SW/scope/worker activo, secure
context, permiso, user gesture, timing, same-origin) — todas PASS, sin
hallazgo DeliGO-side. Se validó la VAPID key vigente en vivo (fetch de
solo lectura a `/api/push/vapid-key`, decodificada sin imprimirla: 87
chars b64url → 65 bytes, primer byte `0x04`, formato EC P-256 canónico)
— descarta malformación y mismatch de entorno. Se investigó Chromium/
Push API con fuentes 2025-2026 (Opera forums, 2 issues de
`firebase-js-sdk`, GitLab Gitter, MDN): `PushManager.subscribe()` en
Chrome/Android envía internamente una solicitud a
`android.clients.google.com/c2dm/register3` (registro FCM) — un fallo
ahí es lo que se expone como `AbortError`; un caso ajeno a DeliGO con
síntoma idéntico quedó documentado sin causa raíz aislada ni por el
propio equipo de Firebase. Con 4 ocurrencias totales ya documentadas
(R13, R18, y 2 más en este retest, 3 de ellas en el mismo dispositivo
Negocio pese a una reinstalación completa de la PWA que — auditado —
no tenía razón estructural para tocar la capa de causa plausible), la
clasificación se eleva de `NOT_PROVEN_PLAUSIBLE` a `STRONGLY_SUPPORTED`
(criterio de 4 niveles explícito), sin declarar `CONFIRMED`. No se
justifica ningún cambio de código adicional ahora — se diseñó un único
próximo paso físico: probar `PushManager.subscribe()` en
`web-push-codelab.glitch.me` (demo oficial GoogleChromeLabs, sin login/
APK/datos personales) en el mismo dispositivo, para discriminar entre
plataforma/dispositivo (si también falla) y una causa específica de
DeliGO no detectada (si funciona). Ningún estado certificado
previamente se revoca. P2-T31 sigue abierto. Ver
`P2_T31_R20_ANDROID_PERSISTENT_ABORTERROR_ROOT_CAUSE_DEVICE_DIAGNOSTIC.md`.

## P2-T31-R19A-REVIEW-COMMIT-PUSH-TESTING-DEPLOY — 2026-09-08 (mitigación completa de AbortError desplegada en TESTING, commit exacto verificado — AMBOS intentos del retest físico fallaron, ver R20 arriba)

```text
COMMIT_HASH=39566e69647fd2b19453721214563a7b9a0ccc5e / COMMIT_PARENT=d7cc66dcce6b2367cf52e5438741b02d5a2a2a84
TESTING_DEPLOYMENT_ID=425ff95a-5a2e-4d70-9dd1-fbae6df5ce19 / TESTING_DEPLOYMENT_STATUS=SUCCESS (match exacto verificado)
PRECOMMIT_PUSH_TEST_PASS=577 / PRECOMMIT_PUSH_TEST_FAIL=0 / NEW_TYPECHECK_ERRORS=0
PRODUCTION_TOUCHED=NO / ANDROID_PHYSICAL_MITIGATION_CERTIFIED=NO
P2_T31_STATUS=IN_PROGRESS_R19A_DEPLOYED_TESTING_PENDING_ANDROID_NEGOCIO_PHYSICAL_RETEST_AND_ANDROID_REPARTIDOR_SMOKE
NEXT_ANDROID_PHYSICAL_ACTION=ANDROID_NEGOCIO_SINGLE_ACTIVATION_RETEST_WITH_TRACE_ARMED_ON_R19A_BUILD
```

Review final pre-commit confirmó, línea por línea, que el diff local
acumulado (R19+R19R+R19R1) coincide exactamente con lo ya auditado —
cero cambios funcionales nuevos. Gate re-ejecutado fresco: 577 focales
en 0 fail, ESLint limpio, TypeScript idéntico a la baseline. Stage
selectivo de exactamente 4 archivos (`use-push-notifications.ts`,
`use-push-notifications-static-contract.test.ts` modificados;
`use-push-notifications-abort-retry.test.ts`, `use-push-notifications-
stale-actor-backend-guard.test.ts` nuevos), commit único, push
únicamente a `testing-codex`. Autodeploy Git-triggered normal — Railway
TESTING alcanzó `SUCCESS` ejecutando el `commitHash` exacto recién
pusheado (verificado vía `railway status --json`, no asumido). Logs de
build/boot limpios. Smokes NO destructivos (lecturas únicamente, nunca
`POST /api/push/subscribe`). Production (`origin/main`, servicio
"DeliGO") confirmado sin cambios en el mismo JSON. Ninguna
certificación física declarada desde smokes HTTP. Hallazgo lateral de
`unsubscribe()` preservado, no corregido. P2-T31 sigue abierto —
próximo gate: UN solo reintento físico de activación en Android
Negocio sobre este build exacto, con la traza armada; el camino de
"ambos intentos fallan" no sería una certificación, requeriría nueva
auditoría. Ver `P2_T31_R19A_REVIEW_COMMIT_PUSH_TESTING_DEPLOY.md`.

## P2-T31-R19R1-EXPLICIT-MUTATION-REGISTRY-SET-RELEASE-COVERAGE — 2026-09-08 (discrepancia de evidencia de TEST 8 cerrada, cero cambios de producto — desplegado en TESTING por R19A arriba)

```text
MUTATION_REGISTRY_SET_COUNT_STALE_ABORT_RETRY=1 / MUTATION_REGISTRY_RELEASE_COUNT_STALE_ABORT_RETRY=1 / MUTATION_REGISTRY_FINAL_ENTRY_EXISTS_STALE_ABORT_RETRY=NO
MUTATION_REGISTRY_SET_COUNT_NORMAL_SUCCESS=1 / MUTATION_REGISTRY_RELEASE_COUNT_NORMAL_SUCCESS=1 / MUTATION_REGISTRY_FINAL_ENTRY_EXISTS_NORMAL_SUCCESS=NO
PRODUCT_CODE_CHANGED_IN_R19R1=NO / STALE_DURING_ABORT_RETRY_BACKEND_CALL_COUNT=0 (preservado)
FOCAL_TEST_PASS=577 / FOCAL_TEST_FAIL=0 / NEW_TYPECHECK_ERRORS=0
NEXT_RECOMMENDED_ACTION=P2_T31_R19A_REVIEW_COMMIT_PUSH_TESTING_DEPLOY_PENDING_ANDROID_NEGOCIO_PHYSICAL_RETEST
```

R19R (abajo) había probado `gate.begin()` llamado 1 vez como evidencia
INDIRECTA de una sola operación de alto nivel — el TEST 8 de su propio
mandato pedía `MUTATION_REGISTRY_SET`/`RELEASE` contados DIRECTAMENTE
en la ruta compuesta stale-during-retry. Se extendió el mismo archivo
de test (sin archivos nuevos) con un harness TEST-ONLY que compone las
3 funciones REALES ya exportadas (`createPhysicalPushSubscriptionWith
AbortRecovery`, `bindPhysicalPushSubscriptionToBackend`,
`registerInFlightPersonalPushMutation` — el registry REAL, nunca
mockeado) en el mismo orden que `subscribe()` propio. Confirmado: SET=1,
RELEASE=1, entrada final ausente, tanto en el flujo stale-durante-
retry (segundo intento genuinamente pendiente, invalidado a mitad de
vuelo, resuelto después) como en el camino normal exitoso. Cero
cambios de código de producto (diffstat de `use-push-notifications.ts`
idéntico al de R19R). 577 focales en 0 fail. Ver
`P2_T31_R19R1_EXPLICIT_MUTATION_REGISTRY_COVERAGE.md`.

## P2-T31-R19R-ABORTERROR-RETRY-STALE-ACTOR-BACKEND-GUARD — 2026-09-08 (gap stale-actor/backend cerrado, retry de R19 preservado, tests verdes — evidencia de TEST 8 completada por R19R1 arriba)

```text
PRE_BACKEND_STALE_OPERATION_GUARD_EXISTS_BEFORE_R19R=NO / PREEXISTING_STALE_BACKEND_BIND_GAP_EXPOSED_DURING_R19_REVIEW=SI
STALE_ACTOR_GUARD_IMPLEMENTED=SI / STALE_ACTOR_GUARD_SOURCE=OP_ID_ONLY
STALE_DURING_ABORT_RETRY_TEST=PASS / STALE_DURING_ABORT_RETRY_BACKEND_CALL_COUNT=0 / STALE_AFTER_FIRST_PHYSICAL_SUCCESS_BACKEND_CALL_COUNT=0
ABORTERROR_RETRY_MAX_ATTEMPTS=2 (sin cambios) / R13A_FAILURE_STATE_CONTRACT_PRESERVED=SI / DOUBLE_BACKEND_REGISTER_POSSIBLE=NO
FOCAL_TEST_PASS=575 / FOCAL_TEST_FAIL=0 / NEW_TYPECHECK_ERRORS=0
PRODUCT_CODE_CHANGED=SI (local, sin commit) / BACKEND_CHANGED=NO / PRODUCTION_TOUCHED=NO
P2_T31_STATUS=IN_PROGRESS_ABORTERROR_MITIGATION_AND_STALE_ACTOR_GUARD_IMPLEMENTED_LOCALLY_PENDING_COMMIT_DEPLOY_AND_ANDROID_ROLE_RETESTS
NEXT_RECOMMENDED_ACTION=P2_T31_R19A_REVIEW_COMMIT_PUSH_TESTING_DEPLOY_PENDING_ANDROID_NEGOCIO_PHYSICAL_RETEST
```

R19 (abajo) había reconocido honestamente que el `POST /api/push/
subscribe` corría incondicional respecto al gate de operación —
`finishMutation` sólo decidía DESPUÉS si el resultado se aplicaba a
UI, el request ya había salido. Se implementó
`bindPhysicalPushSubscriptionToBackend`: verifica `gate.isCurrent(opId)`
— misma autoridad canónica que el resto del archivo, sin duplicarla —
como última sentencia síncrona antes del único `fetch`, cero `await`
de por medio. Si stale: sin backend POST, sin toast, sin estado ON, sin
inventar error — mismo `finishMutation(opId, false)` de siempre; la
subscription física nunca se destruye. El retry de R19 (2 intentos,
sólo AbortError, recheck obligatorio, sin delay) no se tocó. TEST 9
del mandato original ahora es un test REAL: gate real + retry real de
R19, con el segundo intento genuinamente pendiente, invalidado a mitad
de vuelo, resuelto con éxito después — backend call count = 0
confirmado. Test paralelo prueba el mismo gap SIN AbortError (éxito
inmediato + stale antes del backend) — reconocido honestamente como
gap PREEXISTENTE a R19, no introducido por él. 6 conteos de backend
afirmados con tests reales. 575 focales en 0 fail, ESLint limpio,
TypeScript idéntico a la baseline. `unsubscribe()` tiene el mismo
patrón sin retry — documentado como hallazgo lateral, no corregido
(fuera de alcance). Sin commit/push/deploy, sin tocar backend/schema.
P2-T31 sigue abierto. Ver
`P2_T31_R19R_ABORTERROR_RETRY_STALE_ACTOR_BACKEND_GUARD.md`.

## P2-T31-R19-ANDROID-PUSHMANAGER-ABORTERROR-SINGLE-RETRY-HARDENING — 2026-09-08 (mitigación de retry único implementada localmente, tests verdes, sin deploy — gap stale-actor/backend cerrado por R19R arriba)

```text
ANDROID_NEGOCIO_MANUAL_RETRY_STATUS=FAIL_ABORTERROR (retry manual de R18 también falló, proceso nuevo — 2da recurrencia consecutiva)
ANDROID_ABORTERROR_MITIGATION_REQUIRED_BEFORE_T31_CLOSEOUT=SI (corregido desde NO de R18)
ABORTERROR_RETRY_IMPLEMENTED=SI / ABORTERROR_RETRY_MAX_ATTEMPTS=2 / ABORTERROR_RETRY_ONLY_FOR_ABORTERROR=SI / ABORTERROR_POST_FAILURE_GETSUBSCRIPTION_RECHECK=SI / ABORTERROR_RETRY_DELAY_MS=0
DOUBLE_BACKEND_REGISTER_POSSIBLE=NO / POST_ABORT_RECHECK_FAILURE_FAILS_CLOSED=SI / R13A_FAILURE_STATE_CONTRACT_PRESERVED=SI
FOCAL_TEST_PASS=564 / FOCAL_TEST_FAIL=0 / NEW_TYPECHECK_ERRORS=0
PRODUCT_CODE_CHANGED=SI (local, sin commit) / PRODUCTION_TOUCHED=NO
P2_T31_STATUS=IN_PROGRESS_ABORTERROR_MITIGATION_IMPLEMENTED_LOCALLY_PENDING_REVIEW_DEPLOY_AND_ANDROID_ROLE_RETESTS
NEXT_RECOMMENDED_ACTION=P2_T31_R19A_REVIEW_COMMIT_PUSH_TESTING_DEPLOY_PENDING_ANDROID_NEGOCIO_PHYSICAL_RETEST
```

El reintento manual único que R18 autorizó a Leonardo en Android
Negocio también falló con `AbortError` — segunda recurrencia
consecutiva, proceso nuevo (descarta estado arrastrado), backend nunca
alcanzado. Se implementó `createPhysicalPushSubscriptionWithAbortRecovery`
en `use-push-notifications.ts`: envuelve la función existente
`createPhysicalPushSubscription` con AT MOST un intento físico
adicional, gateado exclusivamente por `errorClass === "AbortError"`.
Ante `AbortError`, relee obligatoriamente `getSubscription()` antes de
cualquier retry — si encuentra una subscription con key vigente, la
reutiliza sin un segundo `subscribe()`; si el recheck lanza o encuentra
una key stale/ambigua, falla cerrado con el error original, sin
destruir nada. Sólo un `null` confirmado autoriza el único retry físico
#2, con su propio trace distinguible. Sin delay, sin rama de
plataforma, sin tocar el gate/registry ni ningún endpoint de backend —
estructuralmente imposible una doble subscription o un doble registro
backend (un único call site de `fetch`, alcanzado a lo sumo una vez).
10 tests deterministas nuevos cubren 7 escenarios directamente; los 3
restantes (registry, gate stale, consumidores de rol) quedan cubiertos
por inspección estructural + regresión verde de R2/R7/R13A y los 3
static-contracts de rol. 564 tests focales en 0 fail, ESLint limpio,
TypeScript idéntico a la baseline (0 nuevos). Corrección de wording:
cualquier referencia a R13A "confirmado en producción" es incorrecta —
la formulación correcta es "confirmado en runtime real de TESTING".
Sin commit/push/deploy. P2-T31 sigue abierto — la mitigación queda
lista para revisión y deploy, pendiente del retest físico de Android
Negocio. Ver
`P2_T31_R19_ANDROID_PUSHMANAGER_ABORTERROR_SINGLE_RETRY_HARDENING.md`.

## P2-T31-R18-ANDROID-ABORTERROR-CROSS-ROLE-RECURRENCE-AUDIT — 2026-09-08 (AbortError recurrió en Negocio, misma clase que R13, failure-state contract PASS, iPhone Negocio/Repartidor certificados — mitigación implementada por R19 arriba)

```text
ANDROID_R18_MATCHES_R13_FAILURE_CLASS=SI / ANDROID_R18_ROLE_SPECIFIC_CODE_CAUSE_STATUS=NO_EVIDENCE
R13A_FAILURE_STATE_CONTRACT_CURRENT_PHYSICAL_RESULT=PASS (no se reabre el bug de UI stale)
ANDROID_PHYSICAL_CREATE_RELIABILITY_CURRENT_STATUS=HISTORICAL_3_OF_3_PASS_BUT_ABORTERROR_RECURRENCE_CONFIRMED
ANDROID_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (sin cambios)
IPHONE_NEGOCIO_PUSH_MATRIX=CERTIFIED_TESTING / IPHONE_REPARTIDOR_PUSH_MATRIX=CERTIFIED_TESTING (los 3 roles iPhone certificados)
ANDROID_NEGOCIO_SMOKE=FAIL_AT_ACTIVATION_ABORTERROR / ANDROID_REPARTIDOR_SMOKE=NOT_STARTED
ANDROID_ABORTERROR_MITIGATION_REQUIRED_BEFORE_T31_CLOSEOUT=NO
NEXT_ANDROID_PHYSICAL_ACTION=SINGLE_MANUAL_RETRY_ANDROID_NEGOCIO_ACTIVATION_WITH_TRACE_ARMED
P2_T31_STATUS=IN_PROGRESS_IPHONE_ALL_ROLES_CERTIFIED_ANDROID_CLIENT_CERTIFIED_PENDING_ANDROID_NEGOCIO_ABORTERROR_RESOLUTION_AND_ANDROID_REPARTIDOR_SMOKE
```

Durante el smoke corto de Android Negocio, la activación falló con
`PushManager.subscribe() → AbortError` (~297ms, sin llegar a backend)
— la misma clase de fallo que R13 documentó para Cliente en
2026-09-06. Comparación campo por campo: mismo `errorClass`, mismo
orden de duración, mismo estado previo (permission granted, SW
activated, VAPID ok) — pero el MANEJO del fallo ahora es correcto:
`SUBSCRIBE_FINISH` disparó, el registry liberó, el switch terminó OFF.
El contrato de failure-state de R13A pasó completo contra un fallo
real, en un rol distinto al que lo expuso originalmente — no se reabre
el bug de UI stale de R13 (sigue corregido). Se auditó el código de
los 3 consumidores de rol y se confirmó, con evidencia directa, que no
existe ninguna rama específica de Negocio antes del punto de fallo —
el código ejecutado fue bit-a-bit idéntico al de Cliente en R13. Se
probó que backend/DB/rate-limiter/provider no pudieron ser causa
(cero requests HTTP salieron del browser). El `PASS_3_OF_3` de R14 se
preserva histórico, reconciliado con un marcador de estado actual
separado — el `AbortError` sigue intermitente, causa de plataforma
NOT_PROVEN_PLAUSIBLE (sin cambios). Android Cliente (R17) no se
invalida. Nueva evidencia física del operador: iPhone Negocio (N1-N7)
e iPhone Repartidor (R1-R7) llegaron con PASS completo — los 3 roles
de iPhone quedan certificados. Se evaluaron 9 opciones de mitigación
sin implementar ninguna (sólo 2 ocurrencias totales, evidencia
insuficiente para justificar retry automático) — único siguiente paso:
un reintento manual único del switch de Negocio con la traza armada.
P2-T31 sigue abierto. Ver
`P2_T31_R18_ANDROID_ABORTERROR_CROSS_ROLE_RECURRENCE_AUDIT.md`.

## P2-T31-R17-ANDROID-CLIENT-PUSH-PHYSICAL-CERTIFICATION-AND-CONTEXT-RECONCILIATION — 2026-09-08 (Android Cliente CERTIFICADO en TESTING — causa confirmada: notificaciones Chrome deshabilitadas a nivel Android)

```text
ANDROID_DEVICE_NOTIFICATION_ROOT_CAUSE_STATUS=CONFIRMED_BY_OPERATOR_CONFIGURATION_CHANGE
ANDROID_DEVICE_NOTIFICATION_ROOT_CAUSE=CHROME_NOTIFICATIONS_DISABLED_AT_ANDROID_OS_LEVEL
ANDROID_PUSH_CODE_BUG_FOR_THIS_INCIDENT=NO_EVIDENCE
ANDROID_FOREGROUND_PUSH_STATUS=PASS / ANDROID_CLOSED_PWA_PUSH_STATUS=PASS / ANDROID_NOTIFICATION_TAP_STATUS=PASS / ANDROID_OFF_COLD_REOPEN_STATUS=PASS
ANDROID_CLIENT_PUSH_MATRIX_STATUS=CERTIFIED_TESTING
R15A_URGENCY_MITIGATION_STATUS=DEPLOYED_COMPATIBLE_NOT_PROVEN_ROOT_CAUSE
P2_T31_STATUS=IN_PROGRESS_ANDROID_CLIENT_AND_IPHONE_CLIENT_CERTIFIED_PENDING_IPHONE_NEGOCIO_AND_REPARTIDOR_PHYSICAL_MATRICES
NEXT_RECOMMENDED_ACTION=RUN_IPHONE_NEGOCIO_PUSH_PHYSICAL_MATRIX
```

Leonardo revisó su dispositivo físico tras R16 y encontró que las
notificaciones de Chrome estaban deshabilitadas a nivel del sistema
Android — exactamente el "platform-level" que R16 había dejado
plausible pero no probado, ahora confirmado. Sin ningún cambio de
código ni redeploy (mismo commit TESTING `d7cc66d` de R15A), tras
habilitarlas, Leonardo confirmó físicamente: foreground PASS,
closed-PWA/background PASS (sin force-stop), notification tap PASS
(abre el pedido correcto), OFF+cold-reopen PASS (switch permanece OFF,
sin auto-reactivación). Android Cliente queda `CERTIFIED_TESTING` —
las 6 capas de su matriz física (creación 3/3, ON-persistence,
foreground, closed-PWA, tap, OFF) en PASS. No se extrapola a Negocio/
Repartidor (nunca ejecutados). R16 NO fue editado — su conclusión
`PLATFORM_LEVEL_PLAUSIBLE_NOT_PROVEN` queda preservada como lo que se
sabía en ese momento; la confirmación vive en esta autoridad. R15A no
se le adjudica la causa raíz (la causa real fue la configuración del
dispositivo, no la prioridad de entrega) — no se revierte, sigue
compatible y desplegado. El hallazgo de "en camino" pre-aceptación de
repartidor se clasificó como comportamiento esperado, no como fallo de
push; la notificación al aceptar el repartidor queda PASS físico.
P2-T29 (rediseño de flujo + notificaciones) sigue sin implementarse ni
iniciarse — requiere auditoría completa previa. P2-T31 sigue abierto
por iPhone Negocio/Repartidor. Ver
`P2_T31_R17_ANDROID_CLIENT_PUSH_PHYSICAL_CERTIFICATION_AND_CONTEXT_RECONCILIATION.md`.

## P2-T31-R16-ANDROID-PUSH-SUBSCRIPTION-PERSISTENCE-LOSS-ROOT-CAUSE-AUDIT — 2026-09-07/08 (pérdida física real confirmada, platform-level plausible EN SU MOMENTO — causa confirmada por R17 arriba, este bloque preservado sin editar)

```text
ANDROID_R16_POST_REOPEN_PHYSICAL_SUBSCRIPTION=MISSING / ANDROID_R16_POST_REOPEN_PERMISSION=default
R16_PROVIDER_SEND_FOR_522C650F=SI (providerStatus=201 a las 01:28:46Z, luego 410 REAL a las 01:29:43Z, mismo endpoint, ~57s después)
R16_BACKEND_BINDING_AFTER_PHYSICAL_LOSS=ABSENT / R16_FAILURE_MODEL=SINGLE_CAUSE_PROVEN
ANDROID_R16_SUBSCRIPTION_LOSS_ROOT_CAUSE_STATUS=PLATFORM_LEVEL_PLAUSIBLE_NOT_PROVEN
R15A_CHANGE_CAUSED_SUBSCRIPTION_LOSS=NO_EVIDENCE / FIX_IMPLEMENTED=NO
NEXT_RECOMMENDED_ACTION=OPERATOR_CHECK_DEVICE_NOTIFICATION_PERMISSION_STATE_BEFORE_NEXT_ANDROID_RETEST
```

El retest físico post-R15A reveló algo más grave que un problema de
prioridad de entrega: la subscription física de Leonardo
(`endpointFingerprint=522c650f`), creada y confirmada correctamente,
desapareció tras cerrar y reabrir la PWA (`physicalSubscription=false`,
`permission=default`). Se auditó exhaustivamente TODO el repo buscando
cualquier código DeliGO (unsubscribe físico, lifecycle listeners, auth
bootstrap, Service Worker unregister, reset de permiso, storage
cleanup) que pudiera explicarlo — `NO_CODE_BUG_FOUND` en cada capa. La
correlación con logs REALES de Railway TESTING fue el hallazgo
decisivo: un envío a `522c650f` fue aceptado por el proveedor (201) a
las 01:28:46Z, y 57 segundos después un segundo envío al MISMO
endpoint recibió un 410 GENUINO ("Subscription expired") — la muerte de
la subscription es un evento REAL de plataforma (confirmado por el
proveedor, no inferido), no un bug de código. El mismo actor había
sufrido una muerte idéntica de OTRO endpoint 90 segundos ANTES de
empezar esta sesión — un patrón repetido, no un evento aislado.
`R15A_CHANGE_CAUSED_SUBSCRIPTION_LOSS=NO_EVIDENCE` — R15A no se
revierte. Sin bug de código probado, no se implementó fix (se descartó
explícitamente cualquier re-subscribe automático silencioso). Ver
`P2_T31_R16_ANDROID_PUSH_SUBSCRIPTION_PERSISTENCE_LOSS_ROOT_CAUSE_AUDIT.md`.

## P2-T31-R15A-COMMIT-DEPLOY-AND-CLOSED-PWA-RETEST — 2026-09-07 (fix R15R desplegado en TESTING — retest físico reveló la regresión de R16 arriba)

```text
R15A_COMMIT=d7cc66dcce6b2367cf52e5438741b02d5a2a2a84 / R15A_PARENT=8b49756e76a32b2641bd1099c1e8382d3be32f25
R15A_RAILWAY_DEPLOYMENT_ID=906d7960-10f5-449b-a1bd-a492feb91bab / R15A_RAILWAY_STATUS=SUCCESS / R15A_RAILWAY_COMMIT_MATCH=SI
R15A_FOCAL_PASS=240 / R15A_FOCAL_FAIL=0 / NEW_TYPECHECK_ERRORS=0
PRODUCTION_TOUCHED=NO
P2_T31_R15A_STATUS=DEPLOYED_TESTING_PENDING_ANDROID_CLOSED_PWA_PHYSICAL_RETEST
NEXT_PHYSICAL_TEST=ANDROID_CLOSED_PWA_PUSH_RETEST_POST_R15A
```

Deploy explícitamente autorizado por el operador (commit+push+TESTING
deploy; Production explícitamente NO autorizado). Commit único
(`d7cc66d`) con exactamente `src/lib/push.ts` y `src/lib/push.test.ts`
— el diff completo de R15R (urgency acotada por tipo, sin TTL forzado,
success log TESTING-only con `statusCode`) — verificado con `git diff
--cached --name-status` antes de commitear. Push a `testing-codex`
(nunca `main`). Autodeploy Git-triggered normal, sin `railway up`;
deployment `906d7960...` en `SUCCESS` con `commitHash` exacto. Logs de
build y boot limpios, smokes verdes (`/api/push/debug-guard` →
`{"allowed":true}`, confirmando el guard TESTING-only en runtime real).
`origin/main` intacto. P2-T31 SIGUE ABIERTO — el protocolo físico
`ANDROID_CLOSED_PWA_PUSH_RETEST_POST_R15A` queda preparado para
Leonardo, no se ejecutó desde Claude. Ver
`P2_T31_R15A_COMMIT_DEPLOY_AND_CLOSED_PWA_RETEST_READY.md`.

## P2-T31-R15R-PREDEPLOY-EVIDENCE-CORRECTION — 2026-09-07 (corrección pre-deploy del fix R15 — DESPLEGADO POR R15A ARRIBA)

```text
WEB_PUSH_LIBRARY_VERSION=3.6.7 / WEB_PUSH_DEFAULT_TTL=2419200 (28 dias) / WEB_PUSH_DEFAULT_URGENCY=normal
MISSING_TTL_BEFORE_R15=NO (la libreria ya aplicaba TTL por default)
PROVEN_ROOT_CAUSE=NO
ANDROID_CLOSED_PWA_FAILURE_ROOT_CAUSE_STATUS=UNRESOLVED_WITH_HIGH_URGENCY_AS_STRONG_MITIGATION_CANDIDATE (corregido desde HIGH_CONFIDENCE_CODE_BUG de R15)
GLOBAL_HIGH_URGENCY_JUSTIFIED=NO (acotado a 8/12 tipos time-sensitive)
R15_TTL_CHANGE_SHORTENS_RETENTION=SI -> TTL de R15 revertido al default de la libreria
PUSH_PROVIDER_SUCCESS_LOG_PRODUCTION_ENABLED=NO (TESTING-only, isPushDebugAllowedEnvironment)
R15R_FOCAL_PASS=240 / R15R_FOCAL_FAIL=0 / NEW_TYPECHECK_ERRORS=0
NEXT_RECOMMENDED_ACTION=P2-T31-R15A-COMMIT-DEPLOY-AND-CLOSED-PWA-RETEST
```

Revisión pre-deploy del fix local de R15, antes de cualquier commit.
Se auditó la versión REAL instalada de `web-push` (3.6.7): la
librería ya aplica `TTL` por default (2419200s / 28 días) y `urgency`
default `"normal"` — el TTL nunca estuvo ausente, sólo implícito;
corrige `MISSING_PUSH_URGENCY_AND_TTL_OPTIONS_ON_WEBPUSH_SEND` de R15
(el candidato real era sólo `urgency`). La clasificación de causa raíz
se corrige de `HIGH_CONFIDENCE_CODE_BUG` a
`UNRESOLVED_WITH_HIGH_URGENCY_AS_STRONG_MITIGATION_CANDIDATE` — R15
nunca tuvo una captura directa proveedor/SW que probara la causa para
este incidente específico. `urgency:"high"` ahora se pide sólo para
los 8 `NotificationType` genuinamente time-sensitive (pedidos,
entregas, chat, mesa/salón) — nunca global; reseñas/cuenta conservan
el default. El `TTL: 86400` que R15 había fijado se removió (acortaba
la retención real de 28 días sin decisión de producto que lo
autorizara). El log de éxito `[Push] Enviado OK` (R15 lo dejó corriendo
en todos los ambientes) ahora está gateado TESTING-only con el mismo
guard ya existente del panel de push (`isPushDebugAllowedEnvironment`)
e incluye el `statusCode` real del proveedor. 240 tests focales en 0
fail. Sin commit/push/deploy. Ver
`P2_T31_R15R_PREDEPLOY_EVIDENCE_CORRECTION_AND_PUSH_PRIORITY_SCOPE.md`.

## P2-T31-R15-ANDROID-CLOSED-PWA-BACKGROUND-PUSH-ROOT-CAUSE-AUDIT — 2026-09-07 (Android reanudado, causa auditada, fix local sin deploy — VER CORRECCIÓN R15R ARRIBA)

```text
ANDROID_PHYSICAL_TESTING_PAUSED_BY_OPERATOR=NO
ANDROID_CLOSED_PWA_FAILURE_ROOT_CAUSE_STATUS=HIGH_CONFIDENCE_CODE_BUG (CORREGIDO POR R15R)
ANDROID_CLOSED_PWA_FAILURE_ROOT_CAUSE=MISSING_PUSH_URGENCY_AND_TTL_OPTIONS_ON_WEBPUSH_SEND (CORREGIDO POR R15R)
FIX_IMPLEMENTED=SI_LOCAL_SOLAMENTE_NO_DESPLEGADO
R15_FOCAL_PASS=235 / R15_FOCAL_FAIL=0 / NEW_TYPECHECK_ERRORS=0
NEXT_RECOMMENDED_ACTION=P2-T31-R15A-COMMIT-DEPLOY-AND-CLOSED-PWA-RETEST
```

Leonardo retomó las pruebas Android para cerrar P2-T31 antes de
Mercado Pago. Auditoría de punta a punta confirmó que foreground
(PASS) y closed-PWA (FAIL) usan el MISMO pipeline de Web Push real
(el canal realtime/Socket.IO no tiene ningún evento de cambio de
estado de pedido) — se descartó código propio en subscription lookup,
branching foreground/background (sólo existe uno, exclusivo de chat,
no aplica), contrato de payload, `waitUntil`, opciones de
`showNotification`, dedupe por tag y detección de clientes. Hallazgo
real: `sendPushNotification` nunca pedía `urgency`/`TTL` explícitos —
documentado (web-push-libs/web-push + FCM/Android) como causa conocida
de entrega diferida bajo Doze con la app cerrada. Clasificado
`HIGH_CONFIDENCE_CODE_BUG` (no `PROVEN`) y corregido localmente
(`{ TTL: 86400, urgency: "high" }`), sin hacks. Se cerró también un
gap real de observabilidad: los envíos exitosos no dejaban ningún
rastro en logs — ahora sí, con fingerprint seguro reusado de
`push-debug-snapshot.ts`. 235 tests focales en 0 fail; suite completa
227 fail, 100% por `DATABASE_URL` ausente en este sandbox (no
relacionado). Sin commit/push/deploy. Ver
`P2_T31_R15_ANDROID_CLOSED_PWA_BACKGROUND_PUSH_ROOT_CAUSE_AUDIT.md`.

## P2-T31-ANDROID-CLOSED-PWA-DIAGNOSTIC-CONTEXT-CORRECTION — 2026-09-07 (corrección de contexto — causa auditada y fix local aplicado por R15 arriba)

```text
ANDROID_CLOSED_PWA_FAILURE_DIAGNOSTIC_STATUS=CAPTURED_POST_FAILURE_SUBSCRIPTION_AND_BACKEND_HEALTHY
ANDROID_CLOSED_PWA_FAILURE_ROOT_CAUSE_STATUS=UNRESOLVED_DELIVERY_PATH_REQUIRES_AUDIT
PRODUCT_CODE_CHANGED=NO / TEST_CODE_CHANGED=NO / PRODUCTION_TOUCHED=NO
NEXT_RECOMMENDED_ACTION=CONTINUE_PAYMENTS_DESIGN_OR_MERCADOPAGO_SPIKE_WHEN_OPERATOR_AUTHORIZES
```

El marcador `ANDROID_CLOSED_PWA_FAILURE_DIAGNOSTIC_STATUS=
PENDING_OPERATOR_CAPTURE` del bloque de abajo queda OBSOLETO: Leonardo
entregó el diagnóstico post-fallo. Subscription física, endpoint
(mismo que en `CREATE_3_OF_3`), VAPID y estado del backend siguen
sanos (`permission=granted`, `physicalSubscription=true`,
`backendSubscribed=true`, `vapidMatch=true`, `uiSwitch=true`). Esto
descarta pérdida de subscription/detach de backend/revocación de
permiso como causa SIMPLE, pero NO prueba nada sobre el resto del
camino de entrega — no se declara causa (ni SW, ni FCM, ni Android, ni
backend send, ni permission layer). El fallo de entrega
(`ANDROID_CLOSED_PWA_PUSH_STATUS=FAIL_REPRODUCED`) NO cambia. Próxima
tarea registrada, no iniciada:
`P2-T31-ANDROID-CLOSED-PWA-BACKGROUND-DELIVERY-ROOT-CAUSE-AUDIT`. Ver
`ANDROID_CLOSED_PWA_POST_FAILURE_DIAGNOSTIC_CONTEXT_CORRECTION.md` y
`FINDINGS.md`. La pausa operativa de Android (bloque de abajo)
continúa sin cambios.

## P2-T31 — Android pausado por decisión del operador (2026-09-07)

```text
ANDROID_PHYSICAL_TESTING_PAUSED_BY_OPERATOR=SI
ANDROID_PHYSICAL_TESTING_PAUSE_REASON=PAYMENTS_DESIGN_AND_DOCUMENTATION
ANDROID_PHYSICAL_TESTING_RESUME_REQUIRES_OPERATOR_DECISION=SI
ANDROID_FOREGROUND_PUSH_STATUS=PASS
ANDROID_CLOSED_PWA_PUSH_STATUS=FAIL_REPRODUCED
ANDROID_NOTIFICATION_TAP_STATUS=NOT_TESTABLE_DUE_TO_CLOSED_PWA_DELIVERY_FAILURE
ANDROID_OFF_COLD_REOPEN_STATUS=PENDING
P2_T31_STATUS=IN_PROGRESS_OPERATOR_PAUSED_PENDING_ANDROID_CLOSED_PWA_DELIVERY_INVESTIGATION_OFF_PERSISTENCE_AND_IPHONE_BUSINESS_DELIVERY_PHYSICAL_MATRIX
```

Leonardo decidió pausar temporalmente las pruebas físicas Android para
trabajar primero en el diseño de pagos (arriba). La pausa es OPERATIVA
— NO significa certificación Android, ni cierre de P2-T31, ni abandono
de ningún finding, ni resolución de ningún fallo pendiente. Congelado
exactamente donde quedó: creación física 3/3 PASS y ON-cold-reopen PASS
(post-R14, sin cambios); un nuevo test físico posterior a R14 mostró
push real en foreground PASS (recibido, sin duplicar, contenido
correcto, notificaciones de Android habilitadas en Ajustes — el
operador no recuerda si vio el prompt nativo en activaciones
anteriores, no se convierte ese "no recuerdo" en `PASS`); pero un push
real con la PWA completamente cerrada **NO llegó** — `FAIL_REPRODUCED`,
nuevo hallazgo real (`F-PAYMENTS-PAUSE-ANDROID-CLOSED-PWA-01` en
`FINDINGS.md`), sin atribuir causa todavía (no se asume Service
Worker/FCM/Android/backend/permission sin auditoría posterior). El
diagnóstico post-fallo YA fue entregado y corregido en el contexto
(ver entrada de arriba) — subscription/backend/VAPID sanos, causa de
entrega sigue `UNRESOLVED_DELIVERY_PATH_REQUIRES_AUDIT`. El tap
de notificación queda `NOT_TESTABLE` (no hubo notificación que tocar).
La persistencia OFF tras cold reopen sigue sin ejecutarse. **No se pide
ninguna prueba física nueva en esta tarea** — todo queda documentado
para cuando Leonardo decida retomar. Ver
`PAYMENTS_CONTEXT_PERSISTENCE_AND_ANDROID_TEST_PAUSE_REPORT.md` para el
detalle completo.

## P2-T31-R14-ANDROID-CREATE-RELIABILITY-CLOSEOUT-AND-REMAINING-PHYSICAL-MATRIX — 2026-09-06/07 (audit, creación física cerrada — Android pausado por el operador, ver entrada de arriba)

```text
ANDROID_POST_R13A_PHYSICAL_CREATE_RELIABILITY=PASS_3_OF_3_CONSECUTIVE
ABORTERROR_REPRODUCED_POST_R13A_3_OF_3=NO / ABORTERROR_FIXED_BY_DELIGO=NO_EVIDENCE
ANDROID_PERMISSION_DEFAULT_WITH_ACTIVE_SUBSCRIPTION_STATUS=OBSERVED_UNEXPLAINED_MULTIPLE_PLAUSIBLE_CAUSES_NOT_ISOLATED (no bloquea)
ANDROID_PUSH_STATUS=PARTIAL_CREATE_RELIABILITY_CERTIFIED_PENDING_DELIVERY_AND_PERSISTENCE_MATRIX
P2_T31_STATUS=IN_PROGRESS_PENDING_IPHONE_BUSINESS_DELIVERY_PHYSICAL_MATRIX_AND_ANDROID_DELIVERY_PERSISTENCE_MATRIX
IPHONE_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (preservado)
NEXT_RECOMMENDED_ACTION=LEONARDO_ANDROID_FOREGROUND_AND_CLOSED_PWA_PUSH_DELIVERY_PLUS_TAP_THEN_OFF_PERSISTENCE
```

3 creaciones físicas consecutivas post-R13A (sin reutilizar el Clean
Create 1/3 previo al fix), todas ejercitando el camino de creación real
(`existingPresent=false`+`reused=false`+backend 200), sin reproducir
`AbortError` — reliability gate de creación física CERRADO. No se
afirma que el `AbortError` haya sido "arreglado": el reliability gate
mide estabilidad bajo el criterio definido, no identifica la causa
externa. `F-P2-T31-R13-01` se reclasifica de bloqueante a monitoreo no
bloqueante. Se auditó una anomalía real (`permission=default` con
subscription/backend activos en el 3er capture) — descartada como bug
de DeliGO por auditoría de código, atribuida (sin confirmar) a las dos
capas independientes de permiso de notificación que Android mantiene
para PWAs instaladas (documentado en repos oficiales de Google/
PWABuilder) — no bloquea las pruebas de entrega pendientes, se resuelve
observándolas directamente. Persistencia ON tras cold reopen ya
certificada (evidencia de los ciclos 1/3 y 2/3). Quedan pendientes:
persistencia OFF, push foreground, push con PWA cerrada, tap de
notificación, y confirmación explícita del prompt nativo de permiso.
Orden mínimo preparado (sin reinstalar innecesariamente), no ejecutado.
Ver
`P2_T31_R14_ANDROID_CREATE_RELIABILITY_CLOSEOUT_AND_REMAINING_MATRIX.md`.

## P2-T31-R13A-PUSH-FAILURE-REPORTING-HARDENING-AND-TESTING-DEPLOY — 2026-09-06 (desplegado TESTING — creación física Android cerrada por R14 arriba)

```text
COMMIT_HASH=8b49756e76a32b2641bd1099c1e8382d3be32f25
TESTING_DEPLOY_STATUS=SUCCESS
ANDROID_PUSH_STATUS=FAIL_REPRODUCED_ABORTERROR_DURING_PHYSICAL_CREATE_PENDING_ROOT_CAUSE (sin cambios — no se certifica)
P2_T31_STATUS=IN_PROGRESS_PENDING_IPHONE_BUSINESS_DELIVERY_PHYSICAL_MATRIX_AND_ANDROID_ABORTERROR_ROOT_CAUSE_OR_MITIGATION
ANDROID_RELIABILITY_GATE_POST_FIX_START=0_OF_3
IPHONE_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (preservado)
NEXT_RECOMMENDED_ACTION=LEONARDO_ANDROID_POST_R13A_CLEAN_CREATE_1_OF_3
```

Antes de commitear, se re-auditó el `catch` exacto de R13: el hecho de
que una excepción secundaria ocurrió (rompiendo `SUBSCRIBE_FINISH`)
sigue probado por eliminación de todas las expresiones intermedias
(`safeErrorForLog`/`pushMutationFailureMessage`/`gate.isCurrent`, todas
funciones puras auditadas con certeza) — pero se corrigió el wording
para NO afirmar cuál de las dos llamadas restantes
(`console.error`/`toast.error`) fue la causante exacta (nunca observado
directamente). Se endureció además el helper `reportMutationFailureSafely`:
tenía un único `try/catch` compartido; ahora logging y toast tienen
boundaries INDEPENDIENTES, garantizando que un fallo de logging nunca
impida el intento de mostrar el toast. 5 tests directos cubren
exactamente esa matriz de casos. Commiteado
(`8b49756...`, hijo de `085cc0b`), pusheado a `testing-codex`,
desplegado en Railway TESTING (deployment `5de51131`, commit exacto
confirmado). Smokes y logs en verde. Production intacta. Android sigue
sin certificar — se registró explícitamente el contrato de evaluación
para el próximo capture: si `AbortError` reaparece, un estado de fallo
consistente (`hookSubscribed=false`, `uiSwitch=false`, sin backend, sin
success feedback falso) es un `PASS` del failure-state-contract aunque
la creación en sí haya fallado. El reliability gate se reinicia en
`0/3`. Ver
`P2_T31_R13A_PUSH_FAILURE_REPORTING_HARDENING_TESTING_DEPLOY.md`.

## P2-T31-R13-ANDROID-PUSHMANAGER-ABORTERROR-AND-STALE-UI-ROOT-CAUSE — 2026-09-06 (fix desplegado y endurecido por R13A arriba)

```text
ANDROID_RELIABILITY_GATE_RESULT=FAIL_ON_CYCLE_2_OF_3
ANDROID_PUSHMANAGER_SUBSCRIBE_ERROR_CLASS=AbortError
STALE_UI_IS_DELIGO_BUG=SI / FIX_IMPLEMENTED=SI
ANDROID_PUSH_STATUS=FAIL_REPRODUCED_ABORTERROR_DURING_PHYSICAL_CREATE_PENDING_ROOT_CAUSE
P2_T31_STATUS=IN_PROGRESS_PENDING_IPHONE_BUSINESS_DELIVERY_PHYSICAL_MATRIX_AND_ANDROID_ABORTERROR_ROOT_CAUSE_OR_MITIGATION
IPHONE_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (preservado)
NEXT_RECOMMENDED_ACTION=P2-T31-R13A-ABORTERROR-UI-FIX-TESTING-DEPLOY
```

El reliability gate de 3 ciclos (R12B) falló en el ciclo 2/3:
`PushManager.subscribe()` se asentó por RECHAZO (`AbortError`, ~287ms),
no por cuelgue. Auditoría profunda (código + W3C Push API spec,
distinguiendo explícitamente hecho de código / documentación de
plataforma / inferencia) no logró probar la causa de fondo del rechazo
— plausiblemente un fallo transitorio del registro del navegador con su
servicio push interno (Chrome↔FCM), pero no confirmable desde código de
aplicación. **Hallazgo independiente real**: se probó y corrigió un bug
de DeliGO — `console.error`/`toast.error` sin protección propia podían
lanzar dentro del `catch` de `subscribe()`/`unsubscribe()`, saltándose
`finishMutation` por completo, lo que dejaba el switch optimista de
Cliente/Negocio mostrando "ON" para siempre pese a que el hook
correctamente reportaba `false` (Repartidor no está expuesto). Corregido
localmente (`reportMutationFailureSafely`), 580/580 tests en verde, 0
nuevos errores TypeScript, cero cambio de comportamiento en el camino
feliz. No se certifica Android, no se reanuda el reliability gate
todavía — primero este fix necesita su propio ciclo de deploy/
verificación. Ver
`P2_T31_R13_ANDROID_PUSHMANAGER_ABORTERROR_AND_STALE_UI_ROOT_CAUSE.md`.

## P2-T31-R12B-ANDROID-FAIL-PASS-RECONCILIATION-AND-RELIABILITY-GATE — 2026-09-06 (audit, sin certificar — SUBSCRIBE_FINISH corregido, UI stale corregida por R13 arriba)

```text
ORIGINAL_ANDROID_PHYSICAL_RESULT=FAIL
ANDROID_R12_RETEST_VISUAL_RESULT=ON
FUNCTIONAL_FIX_BETWEEN_FAIL_AND_PASS=NO
ANDROID_PUSH_STATUS=UNRESOLVED_INTERMITTENT_PHYSICAL_SUBSCRIBE_STALL_NOT_REPRODUCED_ON_R12_RETEST
P2_T31_STATUS=IN_PROGRESS_PENDING_IPHONE_BUSINESS_DELIVERY_PHYSICAL_MATRIX_AND_ANDROID_FIRST_SUBSCRIBE_RELIABILITY_GATE
IPHONE_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (preservado)
NEXT_RECOMMENDED_ACTION=LEONARDO_ANDROID_FIRST_SUBSCRIBE_RELIABILITY_GATE_3_CONSECUTIVE_CLEAN_CREATES
```

Leonardo repitió el retest Android sobre el build ya desplegado
(`085cc0b`, sin fix funcional — sólo instrumentación) y esta vez el
flujo completó limpio de punta a punta: creación física en ~1910ms,
backend 200, switch final ON. La traza probó con evidencia directa que
el contrato cross-remount de R2 funciona exactamente como se diseñó
(el unmount no cancela la mutación en curso; el registro libera y el
remount correctamente no encuentra nada pendiente porque la mutación ya
había terminado). **No se afirma bug arreglado** — es el mismo código
que falló antes, sin ningún cambio funcional entre ambas capturas. Se
confirmó por código que `OFF→ON` no sirve como repetición del camino de
creación física (`SERVER_DETACH_ONLY` nunca destruye la subscription
real), así que se diseñó un gate de confiabilidad específico: 3 ciclos
consecutivos de creación física genuina (con reset real de la
subscription entre intentos — reinstalar la PWA o revocar el permiso
del sitio), antes de poder certificar Android. Ver
`P2_T31_R12B_ANDROID_FAIL_PASS_RECONCILIATION_AND_RELIABILITY_GATE.md`.

## P2-T31-R12A-ANDROID-PHYSICAL-SUBSCRIBE-DIAGNOSTICS-TESTING-DEPLOY — 2026-09-06 (desplegado TESTING — evidencia física reconciliada por R12B arriba)

```text
COMMIT_HASH=085cc0b540f51a841115697eb25dbf98d3740023
TESTING_DEPLOY_STATUS=SUCCESS
ANDROID_PUSH_STATUS=FAIL_PHYSICAL_FIRST_SUBSCRIBE_CAPTURED_PENDING_ROOT_CAUSE
P2_T31_STATUS=IN_PROGRESS_PENDING_IPHONE_BUSINESS_DELIVERY_PHYSICAL_MATRIX_AND_ANDROID_FIRST_SUBSCRIBE_ROOT_CAUSE
IPHONE_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (preservado)
NEXT_RECOMMENDED_ACTION=LEONARDO_ANDROID_R12_SINGLE_PHYSICAL_RETEST
```

Antes de commitear, se corrigió una imprecisión factual de R12: la
traza física original SÍ incluía `actorFamily=cliente`/
`authHasHydrated=true` en `SUBSCRIBE_START` (R12 había afirmado lo
contrario). Auditoría de `auth-store.ts` confirmó que eso hace
estructuralmente imposible que `actorKey` fuera nulo por hidratación
transitoria en este incidente — la conexión propuesta con
`AUTH_HYDRATION_PUSH_RACE` queda descartada para este caso (sin
reclasificar el hallazgo en sí), y la causa de por qué el registro
cross-remount de R2 no protegió el caso queda genuinamente sin resolver,
pendiente del próximo capture. La instrumentación diagnóstica de R12
(`SUBSCRIBE_PHYSICAL_CREATE_START/RESULT/ERROR`,
`MUTATION_REGISTRY_SET/RELEASE/WAIT_FOUND/WAIT_NOT_FOUND`) quedó
commiteada tal cual (sin cambio de comportamiento), pusheada a
`testing-codex` y desplegada en Railway TESTING (`DeliGO Copy`,
deployment `13800b1d`, commit exacto confirmado). Smokes y logs en
verde. Production intacta. Preparado (sin ejecutar) un único retest
físico Android. Ver
`P2_T31_R12A_ANDROID_DIAGNOSTICS_TESTING_DEPLOY_PENDING_PHYSICAL_RETEST.md`.

## P2-T31-R12-ANDROID-FIRST-SUBSCRIBE-PHYSICAL-CREATION-FAILURE-DIAGNOSTIC — 2026-09-06 (diagnóstico local — desplegado por R12A, corrección factual aplicada, ver arriba)

```text
ANDROID_PUSH_STATUS=FAIL_PHYSICAL_FIRST_SUBSCRIBE_CAPTURED_PENDING_ROOT_CAUSE
P2_T31_STATUS=IN_PROGRESS_PENDING_IPHONE_BUSINESS_DELIVERY_PHYSICAL_MATRIX_AND_ANDROID_FIRST_SUBSCRIBE_ROOT_CAUSE
IPHONE_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (preservado)
R12_FOCAL_PASS=574 / R12_FOCAL_FAIL=0
NEXT_RECOMMENDED_TASK=P2-T31-R12-ANDROID-FIRST-SUBSCRIBE-PHYSICAL-CREATION-FAILURE-RETEST (deploy + único retest físico)
```

Un fallo físico real en Android (activar notificaciones → cambiar de
pantalla → volver → switch OFF) fue auditado a fondo: el único código
ejecutado en la ventana sin trace es un `await
registration.pushManager.subscribe(...)` que provadamente nunca se
asentó (ni éxito ni excepción) durante la captura. Backend, R7 y R8
(429) quedaron descartados como causa. Causa raíz NO probada
concluyentemente — hipótesis líder: Android suspendió ese `await` nativo
al perder foreground. Por regla explícita de la tarea ("no inventar fix
si la causa no puede probarse"), no se implementó ningún fix de
comportamiento — sólo instrumentación de traza mínima
(`SUBSCRIBE_PHYSICAL_CREATE_START/RESULT/ERROR`,
`MUTATION_REGISTRY_SET/RELEASE/WAIT_FOUND/WAIT_NOT_FOUND`), local, sin
desplegar, 574/574 tests en verde, 0 nuevos errores TypeScript. R11
(reapertura de P2-T31 por Negocio/Repartidor faltantes en iPhone) ya se
había ejecutado en el turno anterior de esta sesión — se preserva
intacta; este hallazgo Android se suma como SEGUNDO blocker sobre el
mismo `P2_T31_STATUS`, no la reemplaza. Ver
`P2_T31_R12_ANDROID_FIRST_SUBSCRIBE_PHYSICAL_CREATION_FAILURE_DIAGNOSTIC.md`.

## P2-T31-R11-MULTIROLE-PHYSICAL-SCOPE-AUTHORITY-CORRECTION — 2026-09-06 (P2-T31 REABIERTO — corrección de autoridad)

```text
P2_T31_STATUS=IN_PROGRESS_PENDING_IPHONE_BUSINESS_DELIVERY_PHYSICAL_MATRIX
IPHONE_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (preservado)
BUSINESS_PHYSICAL_MATRIX_STATUS=NOT_EXECUTED_FORMALLY (evidencia incidental positiva registrada, no formal)
DELIVERY_PHYSICAL_MATRIX_STATUS=NOT_EXECUTED
NEXT_RECOMMENDED_ACTION=LEONARDO_IPHONE_BUSINESS_DELIVERY_PUSH_PHYSICAL_MATRIX
```

Auditoría de autoridad: la matriz física ORIGINAL de T31
(`P2_T31_TESTING_DEPLOY_PENDING_IPHONE_MATRIX_CERTIFICATION.md`) exigía
en lenguaje imperativo ("debe cubrirse") evidencia física de los TRES
roles — Cliente C1-C8, Negocio N1-N7, Repartidor R1-R7 — y condicionaba
explícitamente tanto el pass por rol como el cierre de P2-T31 a esa
evidencia, sin ninguna cláusula de excepción por código compartido. R10
cerró P2-T31 completo basándose sólo en la certificación de Cliente,
argumento que esta tarea determina insuficiente: código/tests
compartidos demuestran cobertura técnica, no evidencia física por rol.
Se corrige `P2_T31_STATUS` de vuelta a `IN_PROGRESS`, sin degradar en
absoluto la certificación ya válida de Cliente (C1-C8 sigue PASS). Se
preparó (sin ejecutar) una matriz física N1-N7/R1-R7 e instrucciones
exactas para Leonardo, reutilizando los diagnósticos ya desplegados —
sin reinstalar la PWA. Evidencia incidental nueva: Leonardo probó
Negocio informalmente tras R7/R8 y las notificaciones (antes rotas)
ahora funcionan — señal positiva, no un cierre formal del gate. Ver
`P2_T31_R11_MULTIROLE_PHYSICAL_SCOPE_AUTHORITY_CORRECTION.md`.

## P2-T31-R10-IPHONE-CERTIFICATION-FINAL-CLOSEOUT — 2026-09-06 (P2-T31 CERRADO — corregido por R11, ver arriba)

```text
P2_T31_STATUS=CLOSED_TESTING_CERTIFIED
IPHONE_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING
IPHONE_CLIENT_PUSH_MATRIX=C1_THROUGH_C8_PASS
ANDROID_PUSH_STATUS=UNKNOWN_NOT_CERTIFIED
PUSH_DIAGNOSTICS_POST_CERT_ACTION=RETAIN_UNTIL_ANDROID_PHYSICAL_CERTIFICATION_COMPLETE
NEXT_RECOMMENDED_ACTION=P2-T27 (ver tabla de cola abajo)
```

Leonardo ejecutó el procedimiento de reset limpio (borrar + reinstalar
la instancia de la PWA) y realizó la primera activación real de
notificaciones contra el build actual (`70d3f826...`): apareció el
diálogo nativo de iOS, aceptó, la activación terminó en ON con feedback
correcto, y el estado sobrevivió un cierre completo + reapertura. Esto
satisface exactamente el caso C1 que había quedado diferido desde el
inicio de la certificación física de T31. Con C1 resuelto y C2-C8 ya
certificados en R9, la matriz Cliente queda completa: **P2-T31 cierra**.

Precisión de alcance registrada con transparencia (no oculta): la
matriz física ORIGINAL también definía Negocio N1-N7 y Repartidor R1-R7,
que nunca fueron ejercidos físicamente de forma independiente — ambos
roles comparten el mismo hook/endpoints que Cliente y recibieron los
mismos fixes R1/R7/R8 con cobertura de test estático, por lo que no se
consideró bloqueante para este cierre, pero queda documentado como
`F-P2-T31-R10-01` para una eventual certificación física dedicada.

**Decisión explícita del operador**: los diagnósticos R6/R6A/R6B se
RETIENEN intactos (no hay cleanup ni tarea de cleanup recomendada)
porque Android sigue `UNKNOWN_NOT_CERTIFIED` y Leonardo quiere conservar
la instrumentación para esa certificación futura. Ver
`P2_T31_R10_IPHONE_CERTIFICATION_FINAL_CLOSEOUT.md`.

## P2-T31-R9-IPHONE-PHYSICAL-CERTIFICATION-RECONCILIATION — 2026-09-06 (audit, sin cierre)

```text
P2_T31_STATUS=IN_PROGRESS_PENDING_C1_CLEAN_FIRST_ENABLE
IPHONE_PUSH_CERTIFICATION_STATUS=PARTIAL_PENDING_C1_CLEAN_FIRST_ENABLE
ANDROID_PUSH_STATUS=UNKNOWN_NOT_CERTIFIED
NEXT_ACTION=LEONARDO_C1_CLEAN_FIRST_ENABLE_PHYSICAL_TEST
```

Reconciliación formal de toda la evidencia física iPhone post-R7/R8:
C2 (cubierto por el stress físico de R8, más fuerte que un toggle simple),
C3, C4 (R7), C5 (básico + stress), C6, C7 y C8 quedan PASS con evidencia
trazable. C1 — primera activación real desde un estado de permiso
verdaderamente limpio — sigue sin evidencia física válida contra el
build actual: el iPhone de Leonardo ya tiene permiso concedido y una
subscripción histórica desde etapas tempranas de T31, y el caso había
sido diferido explícitamente desde el reporte original de la matriz
(`PERMISSION_PROMPT_PHYSICAL_CASE=DEFERRED_NOT_SAFELY_REPRODUCIBLE`),
sin resolverse nunca. P2-T31 NO se cierra — se documenta el gate
faltante y el procedimiento de reset (borrar + reinstalar la instancia
de la PWA en el Home Screen) que Leonardo puede ejecutar cuando decida
hacerlo. Diagnósticos R6/R6A/R6B se mantienen desplegados hasta el
cierre total de T31. Ningún cambio de código ni de test en esta tarea.
Ver `P2_T31_R9_IPHONE_PHYSICAL_CERTIFICATION_RECONCILIATION.md`.

## P2-T31-R8-TESTING-COMMIT-DEPLOY-AND-PHYSICAL-RETEST — 2026-09-06 (desplegado)

```text
P2_T31_STATUS=IN_PROGRESS
IPHONE_PHYSICAL_CERTIFICATION_STATUS=BLOCKED_PENDING_R8_STRESS_RETEST
COMMIT_HASH=70d3f826bef291f403f0e42e007187eb1b5d6688
TESTING_DEPLOY_STATUS=SUCCESS
NEXT_ACTION=LEONARDO_R8_PUSH_STRESS_PHYSICAL_RETEST
```

El fix de R8 (rate limiter Push dividido en `pushStatus` 60/min +
`pushMutation` 20/min independientes, semántica de error de status
corregida, mensajes de mutación fallida más claros) quedó commiteado y
desplegado en Railway TESTING (`DeliGO Copy`, deployment `58f4e0a3`,
commit exacto confirmado). Smokes HTTP y guard en verde, logs sin
errores. Production intacta. C4-R7 y C5 básico ya certificados
físicamente por Leonardo; próximo paso: repetir el stress de navegación +
8 ciclos ON/OFF humanos rápidos que antes producía 429, y confirmar 0
fallos. Residual documentado (no bloqueante): rate limiter in-memory
process-local, coherente con 1 réplica. Ver
`P2_T31_R8_TESTING_DEPLOY_PENDING_STRESS_PHYSICAL_RETEST.md`.

## P2-T31-R8-PUSH-RATE-LIMIT-429-STATE-CONSISTENCY-FIX — 2026-09-06 (fix local)

```text
P2_T31_STATUS=IN_PROGRESS
IPHONE_PHYSICAL_CERTIFICATION_STATUS=BLOCKED_PENDING_R8_RATE_LIMIT_FIX
PUSH_STRESS_FAILURE_ROOT_CAUSE=PUSH_API_RATE_LIMIT_429
P2_T31_R8_STATUS=LOCAL_FIX_IMPLEMENTED_PENDING_REVIEW
```

Segunda causa raíz CONFIRMADA por evidencia física tras C4/C5: un stress
de navegación + toggles normal (sin automatización) agotaba el rate
limiter Push compartido (10/min, un solo bucket para status+subscribe+
unsubscribe) — Leonardo capturó un HTTP 429 real que rechazó un intento
de desactivar (nunca se persistió) y un chequeo de estado posterior que
mapeó ese mismo 429 a "Desactivado" mientras el backend seguía sabiendo
"activado". Fix: bucket dividido en `pushStatus` (60/min) y `pushMutation`
(20/min, subido de 10), independientes — verificado que stress humano
razonable ya no produce 429 mientras un flood real sigue bloqueado.
Además, un backend no-ok (incluido 429) ya NO se representa como OFF
confirmado — las 3 UI muestran "No se pudo comprobar" en vez de mentir.
R2/R3/R5/R5A intactos. 551/551 tests. Sin commit/push/deploy — pendiente
de autorización. Ver
`P2_T31_R8_PUSH_RATE_LIMIT_429_STATE_CONSISTENCY_FIX.md`.

## P2-T31-R7-TESTING-COMMIT-DEPLOY-AND-PHYSICAL-RETEST — 2026-09-06 (desplegado)

```text
P2_T31_STATUS=IN_PROGRESS
IPHONE_PHYSICAL_CERTIFICATION_STATUS=BLOCKED_PENDING_R7_PHYSICAL_RETEST
COMMIT_HASH=6380ba2b77ffe6bee1b978ef1e2480da233e61c2
TESTING_DEPLOY_STATUS=SUCCESS
NEXT_ACTION=LEONARDO_R7_C4_PHYSICAL_RETEST
```

El fix de R7 (`statusResolved`, higiene de debug) quedó commiteado y
desplegado en Railway TESTING (`DeliGO Copy`, deployment `41124f04`,
commit exacto confirmado). Smokes HTTP y guard en verde, logs sin
errores. Production intacta. Próximo paso: Leonardo debe reproducir C4
(dejar ON, matar PWA, reabrir, Perfil) al menos 10 veces usando el panel
ya desplegado y confirmar 0 falsos OFF / 0 flickers antes de que se
considere C4 estable. Ver
`P2_T31_R7_TESTING_DEPLOY_PENDING_C4_PHYSICAL_RETEST.md`.

## P2-T31-R7-PUSH-INITIAL-UNKNOWN-STATE-FLICKER-FIX — 2026-09-06 (fix local)

```text
P2_T31_STATUS=IN_PROGRESS
IPHONE_PHYSICAL_CERTIFICATION_STATUS=BLOCKED_PENDING_R7_FIX_DEPLOY_AND_RETEST
C4_FLICKER_ROOT_CAUSE=UNRESOLVED_INITIAL_PUSH_STATE_RENDERED_AS_FALSE_OFF
P2_T31_R7_STATUS=LOCAL_FIX_IMPLEMENTED_PENDING_REVIEW
```

Primera causa raíz CONFIRMADA por evidencia física real (no un hallazgo
teórico): el switch de notificaciones renderizaba el `false` inicial del
hook como un OFF real durante la ventana de ~325-430ms entre el mount y
la primera conclusión autoritativa — Leonardo capturó 3 cold launches con
el mismo patrón usando el panel de R6B. Fix: nuevo `statusResolved` en
`usePushNotifications()`, consumido por Cliente/Negocio/Repartidor para
mostrar un loader neutral en vez de un OFF falso mientras no hay
conclusión. La auth-hydration race de R6 quedó descartada como causa de
ESTE flicker específico (sigue abierta como hallazgo estructural
general). Ningún algoritmo de subscribe/unsubscribe/VAPID/backend fue
tocado. 512/512 tests. Sin commit/push/deploy — pendiente de
autorización para la siguiente etapa. Ver
`P2_T31_R7_PUSH_INITIAL_UNKNOWN_STATE_FLICKER_FIX.md`.

## P2-T31-R6B-TESTING-DIAGNOSTIC-DEPLOY — 2026-09-05 (desplegado)

```text
P2_T31_STATUS=IN_PROGRESS
IPHONE_PHYSICAL_CERTIFICATION_STATUS=BLOCKED_FLAKY_INTERMITTENT_PENDING_TRACE
COMMIT_HASH=925a86017a5e7546f0a6f82245c9d5fc1d344776
TESTING_DEPLOY_STATUS=SUCCESS
NEXT_ACTION=LEONARDO_CAPTURE_IPHONE_PUSH_TRACE
```

R6+R6A+R6B (panel de diagnóstico, timeline, entrada standalone, bootstrap
de cold-launch) quedaron commiteados en un único commit y desplegados por
autodeploy en Railway TESTING (`DeliGO Copy`, deployment `85fc4026`,
commit exacto confirmado). Smokes HTTP y del guard TESTING en verde, logs
sin errores. Production intacta. Esta ronda NO corrige el bug
intermitente — sólo habilita la captura física. Próximo paso: Leonardo
debe reproducir C4 (cerrar completo + reabrir) y capturar 1 FAIL TRACE +
1 HEALTHY TRACE usando el panel ya desplegado. Ver
`P2_T31_R6B_TESTING_DIAGNOSTIC_DEPLOY_PENDING_PHYSICAL_TRACE.md`.

## P2-T31-R6B-STANDALONE-PWA-DEBUG-ACCESS-AND-COLD-BOOTSTRAP — 2026-09-05

```text
P2_T31_STATUS=IN_PROGRESS
IPHONE_PHYSICAL_CERTIFICATION_STATUS=BLOCKED_FLAKY_INTERMITTENT
P2_T31_R6B_STATUS=LOCAL_STANDALONE_DEBUG_ACCESS_READY_PENDING_REVIEW
NEXT_RECOMMENDED_TASK=P2-T31-R6B-TESTING-DIAGNOSTIC-COMMIT-DEPLOY-AND-PHYSICAL-TRACE
```

Cierra el blocker de usabilidad de R6/R6A: una PWA Home-Screen no tiene
barra de direcciones para editar `?pushDebug=1`. El panel ahora muestra
una entrada discreta "Diagnóstico Push (TESTING)" al final de Perfil/
Configuración, visible únicamente cuando el guard server-side confirma
TESTING (misma autoridad única de R6, sin duplicar lógica de entorno) —
tocarla abre el panel completo sin editar ninguna URL.
`QUERY_PARAM_REQUIRED_FOR_PHYSICAL_USE=NO`. Además, se auditó que
`push-debug-trace.ts` sólo cargaba antes dentro del chunk perezoso de
Perfil/Configuración — nunca en el cold launch real de la PWA — y se
agregó `PushDebugTraceBootstrap` (siempre `null`, puramente observacional)
montado en los 3 layouts de rol para garantizar captura desde el primer
render. Cero cambio de algoritmo — único comportamiento visible nuevo: la
entrada TESTING-only. Ver `codex-reports/TEST_AUTHORITY.md` y el reporte
completo para el detalle técnico y el fileset acumulado exacto. Sin
commit, sin push, sin deploy, sin escritura en Production.

## P2-T31-R6A-PUSH-LIFECYCLE-TIMELINE-DIAGNOSTIC — 2026-09-05

```text
P2_T31_STATUS=IN_PROGRESS
IPHONE_PHYSICAL_CERTIFICATION_STATUS=BLOCKED_FLAKY_INTERMITTENT
P2_T31_R6A_STATUS=LOCAL_TIMELINE_DIAGNOSTIC_IMPLEMENTED_PENDING_REVIEW
NEXT_RECOMMENDED_TASK=P2-T31-R6A-TESTING-DIAGNOSTIC-DEPLOY-AND-PHYSICAL-TRACE
```

Extiende R6 (aún sin commit/push/deploy) con una TIMELINE cronológica
(`src/lib/push-debug-trace.ts`) además del snapshot puntual — un snapshot
tomado a demanda no puede mostrar una carrera de timing que ya resolvió
antes de que Leonardo abra el panel. Tracer pasivo module-scoped, ring
buffer de 100 eventos, persistencia sincrónica en `localStorage` (nunca
batcheada, por diseño — ver `P2_T31_R6A_PUSH_LIFECYCLE_TIMELINE_DIAGNOSTIC.md`
§15), ~35 puntos reales de instrumentación en el lifecycle completo (mount,
auth hydration, status check, subscribe/unsubscribe, cambios de UI). Cero
cambio de algoritmo — sólo lectura observacional nueva. Ver
`codex-reports/FINDINGS.md` para los hallazgos de sanitización/seguridad y
el reporte completo para el detalle técnico. Sin commit, sin push, sin
deploy, sin escritura en Production.

## P2-T31-R6-INTERMITTENT-IPHONE-PUSH-LIFECYCLE-DIAGNOSTIC — 2026-09-05

```text
P2_T31_STATUS=IN_PROGRESS
IPHONE_PHYSICAL_CERTIFICATION_STATUS=BLOCKED_FLAKY_INTERMITTENT
P2_T31_R6_STATUS=LOCAL_DIAGNOSTIC_IMPLEMENTED_PENDING_REVIEW
NEXT_RECOMMENDED_TASK=P2-T31-R6-TESTING-DIAGNOSTIC-DEPLOY-AND-PHYSICAL-TRACE
```

Leonardo certificó físicamente R2+R3+R5+R5A en un iPhone Home-Screen PWA real
(commit `a8ac961b`, ya desplegado en TESTING) y encontró que la matriz
C1-C5 NO es determinística — el mismo caso a veces certifica ON, a veces
OFF, sin cambiar nada más. `IPHONE_PHYSICAL_CERTIFICATION_STATUS` pasa de
`PENDING_LEONARDO` a `BLOCKED_FLAKY_INTERMITTENT`. Esta ronda (R6) no
corrige el bug — construye un panel de diagnóstico local (invisible salvo
`?pushDebug=1` + guard server-side por `RAILWAY_ENVIRONMENT_NAME`) para
capturar evidencia física real antes de intentar ningún fix. Ver
`codex-reports/FINDINGS.md` (hallazgos F-P2-T31-MODULE-REGISTRY-FULL-REOPEN-01
y F-P2-T31-AUTH-HYDRATION-RACE-01) y
`P2_T31_R6_INTERMITTENT_IPHONE_PUSH_LIFECYCLE_DIAGNOSTIC.md` para el detalle
completo. Sin commit, sin push, sin deploy, sin escritura en Production.

## PRODUCTION-EMAIL-VERIFICATION-BLOCKER-CLOSURE — 2026-09-05

```text
EMAIL_BLOCKER_STATUS=CLOSED_OPERATOR_REMEDIATED
PRODUCTION_EMAIL_VERIFICATION_BLOCKER=CLOSED_OPERATOR_REMEDIATED
ROOT_CAUSE=PRODUCTION_STALE_DELETED_RESEND_API_KEY_AFTER_INCOMPLETE_KEY_ROTATION
REMEDIATION=OPERATOR_UPDATED_PRODUCTION_RESEND_API_KEY_AND_REDEPLOYED
CURRENT_RUNTIME_RESEND_SEND=SUCCESS_PROVIDER_ACCEPTED
CODE_FIX_REQUIRED=NO
SCHEMA_FIX_REQUIRED=NO
SMTP_CONFIG_FIX_REQUIRED=NO
EMAIL_DIAGNOSTIC_ENDPOINT_PROVIDER_DRIFT=OPEN_NON_BLOCKING
P2_T31_STATUS=IN_PROGRESS
ANDROID_PUSH_STATUS=UNKNOWN_NOT_CERTIFIED
NEXT_RECOMMENDED_TASK=P2-T31-COMMIT-TESTING-DEPLOY-IPHONE-MATRIX-CERTIFICATION
P2_T31_TECHNICAL_NEXT=P2-T31-COMMIT-TESTING-DEPLOY-IPHONE-MATRIX-CERTIFICATION
```

El blocker de verificación de email en Production queda cerrado por evidencia
operativa del operador. No hubo mutación de código, Git, DB, variables ni
deployment por esta tarea. Se retoma P2-T31; la deuda de paridad del endpoint
diagnóstico SMTP queda separada y no bloqueante.

## Reconciliación 2026-09-05 — estado canónico actual (gap desde 2026-08-30 cerrado)

```
P0=CLOSED
P1=CLOSED
P2=IN_PROGRESS
P3=NOT_STARTED

P2-T25 (Order Creation Abuse Resistance)         = CLOSED_TESTING_CERTIFIED
P2-T26 (SuperAdmin Notifications E2E)             = CLOSED_TESTING_CERTIFIED
P2-T28 (Order State Lock Ownership Hardening)     = CLOSED_TESTING_CERTIFIED_NO_BUG
P2-T31 (Notification Switch + Web Push)           = IN_PROGRESS_ANDROID_CLOSED_PWA_DELIVERY_FAILURE_UNDER_AUDIT_THEN_OFF_PERSISTENCE_AND_IPHONE_BUSINESS_DELIVERY_MATRIX_PENDING
  R1  = commiteado, pusheado, desplegado en TESTING (989785a)
  R2  = commiteado, pusheado y desplegado en TESTING (cross-remount fix)
  R3  = auditoría + fix VAPID-stale (1/4 superficies), incluido en deploy TESTING
  R4  = auditoría de arquitectura (sin código), completa
  R5  = fix VAPID-stale portado a 3 superficies más (4/4), incluido en deploy TESTING
  R5A = hardening de contrato de fallos (4/4 STRICT), incluido en deploy TESTING
  R6/R6A/R6B = instrumentación de diagnóstico físico, desplegada TESTING (925a860)
  R7  = fix flicker de estado inicial, desplegado TESTING (6380ba2), certificado físicamente (C3/C4)
  R8  = fix rate-limit 429 + semántica de error de status, desplegado TESTING (70d3f826), certificado físicamente (C2/C5)
  R9  = reconciliación de evidencia física C2-C8 (PASS), C1 identificado pendiente
  R10 = nueva evidencia física C1 (clean first enable, PASS) — cerró P2-T31 PREMATURAMENTE (sólo Cliente)
  R11 = auditoría de autoridad: Negocio/Repartidor eran gates obligatorios — P2-T31 REABIERTO, Cliente preservado
  R12 = fallo físico Android real auditado (first-subscribe nunca se asienta) — instrumentación diagnóstica agregada, sin fix (causa no probada)
  R12A = corrección factual (actorFamily/authHasHydrated SÍ estaban en SUBSCRIBE_START) + deploy TESTING de la instrumentación (085cc0b)
  R12B = retest Android sobre 085cc0b dio PASS (sin fix funcional) — reconciliado: intermitencia confirmada, causa subyacente no confirmada, gate de confiabilidad de 3 ciclos diseñado
  R13 = reliability gate falló en 2/3 con AbortError real — causa de plataforma no probada; bug real de UI stale (Cliente/Negocio) encontrado y corregido localmente
  R13A = wording de causa secundaria corregido, boundaries independientes de logging/toast, deploy TESTING (8b49756)
  R14 = reliability gate de creación física Android CERRADO (3/3 post-fix, AbortError no reproducido, causa aún no confirmada) — anomalía permission=default auditada y descartada como bug — matriz de entrega/persistencia Android preparada
  POST-R14 (fuera de tarea numerada) = foreground push PASS; closed-PWA push FAIL_REPRODUCED (nuevo hallazgo, causa no auditada); tap NOT_TESTABLE; OFF cold reopen PENDING — Leonardo PAUSÓ las pruebas físicas Android para priorizar el diseño de pagos Mercado Pago (ver bloque PAGOS arriba)
  CONTEXT-CORRECTION (2026-09-07) = diagnóstico post-fallo entregado (subscription/backend/VAPID sanos), causa de entrega sigue sin auditar
  R15 = Leonardo RETOMA Android — root cause audit de punta a punta; foreground y closed-PWA comparten el MISMO pipeline Web Push (no hay canal realtime alternativo); causa clasificada HIGH_CONFIDENCE_CODE_BUG (falta urgency/TTL en webpush.sendNotification, documentado como causa de entrega diferida en Doze); fix local aplicado (sin deploy) + gap de observabilidad de envíos exitosos cerrado
  R15R = corrección pre-deploy de R15 (mismo día, sin deploy): TTL nunca estuvo ausente (web-push 3.6.7 ya aplica 28 días por default) — sólo faltaba urgency; causa raíz bajada de HIGH_CONFIDENCE_CODE_BUG a UNRESOLVED_WITH_HIGH_URGENCY_AS_STRONG_MITIGATION_CANDIDATE (nunca hubo captura directa que la probara); urgency:"high" acotado a 8/12 tipos time-sensitive (nunca global); TTL de 24h de R15 revertido (acortaba la retención real de 28 días sin decisión de producto); log de éxito ahora TESTING-only (R15 lo había dejado global) + statusCode real del proveedor
  R15A = commit/push/deploy TESTING explícitamente autorizado por el operador del fix R15R (d7cc66d, parent 8b49756, exclusivamente push.ts/push.test.ts); autodeploy Git-triggered normal a "DeliGO Copy" (deployment 906d7960, SUCCESS, commitHash exacto); smokes/logs limpios; origin/main intacto; protocolo físico ANDROID_CLOSED_PWA_PUSH_RETEST_POST_R15A preparado para Leonardo, no ejecutado desde Claude
  R16 = Leonardo ejecutó el retest físico post-R15A: closed-PWA siguió FAIL, PERO ADEMÁS reveló que la subscription física desaparece tras cerrar/reabrir la PWA (permission=default, physicalSubscription=false) — auditoría exhaustiva de código (unsubscribe físico, lifecycle, auth bootstrap, SW unregister, reset de permiso, storage) sin encontrar ningún bug DeliGO; logs REALES de Railway TESTING probaron que el envío a esa subscription fue ACEPTADO por el proveedor (201) y, 57s después, el MISMO endpoint recibió un 410 GENUINO ("Subscription expired") — pérdida real de plataforma, no un bug de código; mismo actor sufrió una muerte idéntica de OTRO endpoint 90s antes de empezar esta sesión (patrón repetido); R15A no se revierte (sin evidencia de que lo haya causado); sin fix (NO_CODE_BUG_FOUND); clasificado PLATFORM_LEVEL_PLAUSIBLE_NOT_PROVEN EN ESE MOMENTO
  R17 = Leonardo revisó su dispositivo Android y encontró la causa real: notificaciones de Chrome deshabilitadas a nivel del sistema operativo — exactamente el "platform-level" que R16 había dejado plausible pero no probado, ahora CONFIRMADO. Sin ningún cambio de código ni redeploy, tras habilitarlas: foreground PASS, closed-PWA/background PASS (sin force-stop), notification tap PASS (pedido correcto), OFF+cold-reopen PASS (switch permanece OFF). Android Cliente CERTIFICADO en TESTING. R15A no se le adjudica la causa raíz (no se revierte). "En camino" pre-aceptación de repartidor = comportamiento esperado, no fallo; notificación al aceptar repartidor = PASS físico. P2-T29 sigue sin implementarse
  R18 = durante el smoke corto de Android Negocio, PushManager.subscribe() volvió a rechazar con AbortError (~297ms, sin llegar a backend) — misma clase/etapa de fallo que R13 (Cliente, 2026-09-06), causa de plataforma sigue NOT_PROVEN_PLAUSIBLE (sin cambios); pero el MANEJO del fallo ahora es correcto (SUBSCRIBE_FINISH disparó, registry liberó, switch terminó OFF) — el contrato de failure-state de R13A pasó completo contra un fallo real, no se reabre el bug de UI stale; código de los 3 roles auditado y confirmado bit-a-bit idéntico hasta el punto de fallo (sin causa específica de rol); R14 3/3 preservado histórico, reconciliado con marcador de estado actual separado; Android Cliente (R17) no se invalida; NUEVA evidencia física: iPhone Negocio (N1-N7) e iPhone Repartidor (R1-R7) PASS completo — los 3 roles iPhone certificados; 9 opciones de mitigación evaluadas sin implementar ninguna (evidencia insuficiente, 2 ocurrencias totales); único siguiente paso: reintento manual único de Negocio con traza armada
  R19 = ese reintento manual único TAMBIÉN falló con AbortError (proceso nuevo, 2da recurrencia consecutiva, backend nunca alcanzado) — condición de R18 cumplida, se implementa localmente createPhysicalPushSubscriptionWithAbortRecovery: máximo 1 retry físico adicional, exclusivo para AbortError, con recheck defensivo de getSubscription() obligatorio antes de reintentar (reutiliza si la key coincide, falla cerrado si es ambigua o el recheck lanza), sin delay, sin rama de plataforma, sin tocar gate/registry/backend; estructuralmente imposible doble subscription o doble registro backend; 10 tests deterministas nuevos + regresión de 564 tests focales en 0 fail; sin commit/push/deploy — mitigación lista para revisión y deploy, pendiente de retest físico; el propio reporte reconoció un gap: el bind a backend corría incondicional respecto al gate durante esa ventana más larga
  R19R = cerrado ese gap: bindPhysicalPushSubscriptionToBackend verifica gate.isCurrent(opId) — misma autoridad canónica, sin duplicarla — como última sentencia síncrona antes del único fetch, cero await de por medio; stale = sin backend POST/toast/estado ON/error inventado, subscription física nunca destruida; retry de R19 preservado sin ninguna modificación; TEST 9 del mandato original implementado como test REAL (gate real + retry real, segundo intento genuinamente pendiente, invalidado a mitad de vuelo, resuelto después — backend call count=0 confirmado); gap paralelo SIN AbortError reconocido honestamente como PREEXISTENTE a R19, no introducido por él; 6 conteos de backend afirmados con tests; 575 focales en 0 fail; unsubscribe() con el mismo patrón sin retry documentado como hallazgo lateral, no corregido
  R19R1 = cerrada la única discrepancia de evidencia restante de R19R: TEST 8 exigía MUTATION_REGISTRY_SET/RELEASE contados directamente en la ruta compuesta stale-during-retry, no sólo gate.begin()=1; se extendió el mismo archivo de test (sin archivos nuevos) con un harness TEST-ONLY que compone las 3 funciones REALES ya exportadas (retry de R19, bind de R19R, y el registry REAL de R2, nunca mockeado) — SET=1/RELEASE=1/entrada final ausente confirmados tanto en el flujo stale-during-retry como en el camino normal exitoso; cero cambios de código de producto; 577 focales en 0 fail
  R19A = review final pre-commit confirmó el diff idéntico a lo auditado en R19/R19R/R19R1 — commit único d7cc66d..39566e6 (4 archivos exactos), push a testing-codex, autodeploy TESTING SUCCESS ejecutando el commitHash exacto (verificado, no asumido); smokes no destructivos limpios; Production (origin/main, servicio "DeliGO") confirmado sin cambios en el mismo railway status --json; ninguna certificación física declarada; próximo gate: UN solo reintento físico de activación Android Negocio sobre este build
  IPHONE_CLIENT_PUSH_CERTIFICATION_STATUS=CERTIFIED_TESTING (Cliente C1-C8, TESTING — válido y preservado)
  IPHONE_NEGOCIO_PUSH_MATRIX=CERTIFIED_TESTING (N1-N7 PASS físico completo, R18)
  IPHONE_REPARTIDOR_PUSH_MATRIX=CERTIFIED_TESTING (R1-R7 PASS físico completo, R18)
  BUSINESS_PHYSICAL_MATRIX_STATUS=NOT_EXECUTED_FORMALLY (evidencia incidental positiva, no formal — se refiere a Android Negocio; iPhone Negocio ya certificado arriba)
  DELIVERY_PHYSICAL_MATRIX_STATUS=NOT_EXECUTED (se refiere a Android Repartidor; iPhone Repartidor ya certificado arriba)
  ANDROID_ON_COLD_REOPEN_STATUS=PASS_POST_DEVICE_NOTIFICATION_CONFIGURATION_FIX (Cliente, sin cambios desde R17 — la recurrencia de R18/R19/R19R/R19R1 es sobre CREACIÓN en Negocio, no sobre persistencia de Cliente)
  ANDROID_PUSH_STATUS=CLIENTE_CERTIFIED_TESTING_NEGOCIO_MITIGATION_DEPLOYED_TESTING_PENDING_PHYSICAL_RETEST_REPARTIDOR_NOT_STARTED (Cliente: 6 capas PASS, sin cambios; Negocio: mitigación completa de retry + guard stale-actor DESPLEGADA en TESTING (commit 39566e6), pendiente de UN solo retest físico; Repartidor: smoke NOT_STARTED)
  ANDROID_PHYSICAL_CREATE_RELIABILITY_CURRENT_STATUS=HISTORICAL_3_OF_3_PASS_BUT_ABORTERROR_RECURRENCE_CONFIRMED (R14 preservado sin reescribir)
  TESTING_DEPLOY_COMMIT=39566e69647fd2b19453721214563a7b9a0ccc5e (R19A — reemplaza a d7cc66d en TESTING, deployment 425ff95a-5a2e-4d70-9dd1-fbae6df5ce19 SUCCESS)
  PUSH_DIAGNOSTICS_POST_CERT_ACTION=RETAIN_UNTIL_ANDROID_PHYSICAL_CERTIFICATION_COMPLETE (también sirve para el retest Negocio/Repartidor, aún pendiente)
  NEXT_TECHNICAL_TASK=ANDROID_NEGOCIO_SINGLE_ACTIVATION_RETEST_WITH_TRACE_ARMED_ON_R19A_BUILD (Mercado Pago sigue pausado hasta cerrar Push; P2-T29 — Order Flow + Notification Semantics Redesign — es el siguiente bloque de producto después de cerrar Push, aún no iniciado)
  Ver codex-reports/COMPLETED_TASKS.md (entrada corregida),
  P2_T31_R11_MULTIROLE_PHYSICAL_SCOPE_AUTHORITY_CORRECTION.md,
  P2_T31_R12A_ANDROID_DIAGNOSTICS_TESTING_DEPLOY_PENDING_PHYSICAL_RETEST.md,
  P2_T31_R12B_ANDROID_FAIL_PASS_RECONCILIATION_AND_RELIABILITY_GATE.md,
  P2_T31_R13_ANDROID_PUSHMANAGER_ABORTERROR_AND_STALE_UI_ROOT_CAUSE.md,
  P2_T31_R13A_PUSH_FAILURE_REPORTING_HARDENING_TESTING_DEPLOY.md,
  P2_T31_R14_ANDROID_CREATE_RELIABILITY_CLOSEOUT_AND_REMAINING_MATRIX.md y
  PAYMENTS_CONTEXT_PERSISTENCE_AND_ANDROID_TEST_PAUSE_REPORT.md.

P2-T02 (Real Android GPS Delivery Certification)  = READY_TO_RESUME
  Certificación Android depende de disponibilidad futura del dispositivo
  físico — mismo dispositivo cuya falta también bloquea la certificación
  física Android de Push (P2-T31, diagnósticos retenidos para ese fin).
  No confundir ambos bloqueos con el mismo hallazgo — son features
  distintas (GPS de repartidor vs. Web Push).

P2-T27 (Order State DB-level CAS, no-cancellation transitions) = QUEUED
  Depende del finding de P2-T28: sólo `cancelado` tiene CAS hoy — P2-T28
  ya cerró (CLOSED_TESTING_CERTIFIED_NO_BUG), así que esta dependencia
  está resuelta. Disponible como alternativa de trabajo en paralelo,
  pero NO es la próxima acción prioritaria mientras P2-T31 siga
  reabierto — R11 corrigió `NEXT_RECOMMENDED_ACTION` de vuelta a
  `LEONARDO_IPHONE_BUSINESS_DELIVERY_PUSH_PHYSICAL_MATRIX`.

P2-T29 = QUEUED
P2-T30 = QUEUED
P2-T19 (Watcher-Aware GPS Optimization) = OPTIONAL_DEFERRED (fuera del orden de ejecución principal, sólo reabrir con métricas reales post-lanzamiento)
P2-T23 = FUTURE (después de P2-T02)
P2-T24 = FUTURE (después de P2-T23)

GIT_HEAD=989785a3cb1613bcda3a6c67f96472058bc876b0
ORIGIN_TESTING_CODEX=989785a3cb1613bcda3a6c67f96472058bc876b0
ORIGIN_MAIN_PRODUCTION=1de0d3c153eaf3be068adeb004ea43feb42fc40e (SIN CAMBIO — T25/T26/T28/T31 y todo lo posterior NO están en Production)
```

Cadena de commits reales desde el último estado registrado en este archivo
(2026-08-30): `1b69ee8` (P2-T25) → `913d20e` (P2-T28) → `642da15` (P2-T26)
→ `989785a` (P2-T31-R1) — todos pusheados a `testing-codex` y desplegados
en TESTING (DeliGO Copy), ninguno en `origin/main`. Detalle completo en
`codex-reports/GIT_DEPLOY_HISTORY.md` (entrada de esta misma fecha) y
`codex-reports/COMPLETED_TASKS.md`.

El bloque local de P2-T31-R2+R3+R5+R5A fue incorporado al commit
`a8ac961bd81ee505297f81787c1cf32e3f4cd161`, pusheado y desplegado en TESTING.
La certificación física iPhone sigue pendiente; Android permanece
`UNKNOWN_NOT_CERTIFIED`. Ver `codex-reports/TEST_AUTHORITY.md` y el reporte
`codex-reports/P2_T31_TESTING_DEPLOY_PENDING_IPHONE_MATRIX_CERTIFICATION.md`.

## PRODUCTION-PILOT-CATALOG-E2E-01-R1 — 2026-08-30 (bloqueador de imágenes RESUELTO)

```
PRODUCTION_PILOT_CATALOG_E2E_01_R1=PASS_PRODUCTION_DEMO_CATALOG_IMAGES_HOURS_AND_REAL_BUSINESS_ONBOARDING_CERTIFIED
IMAGE_PIPELINE_PRODUCTION_BLOCKER=RESOLVED
REAL_BUSINESS_CATALOG_ONBOARDING_READY=SI
PUBLIC_LAUNCH_AUTHORIZED=NO
DEMO_BUSINESS_PRESERVED=SI
```

Cloudinary corregido por el operador; certificado con canario real +
8/8 imágenes del negocio demo re-subidas y confirmadas renderizando
(fetch directo + DOM). Horario semanal completo configurado, catálogo
público confirma "Abierto" correctamente. Onboarding de negocios reales
ahora autorizado a empezar; lanzamiento público sigue sin autorizar.
Detalle en `codex-reports/PRODUCTION_PILOT_CATALOG_E2E_01_R1.md`.

## PRODUCTION-PILOT-CATALOG-E2E-01 — 2026-08-30

```
PRODUCTION_PILOT_CATALOG_E2E_01=PARTIAL_CATALOG_MECHANICS_CERTIFIED_IMAGE_PIPELINE_BLOCKED
REAL_BUSINESS_CATALOG_ONBOARDING_READY=NO
DEMO_BUSINESS_PRESERVED=SI
PRODUCT_IMAGE_CLIENT_RENDER_PASS_COUNT=0
REAL_PRODUCTION_BUSINESS_DATA_PROTECTED=SI
PUBLIC_LAUNCH_AUTHORIZED=NO
NEXT_PROJECT_TASK_ID=CLOUDINARY_PRODUCTION_CREDENTIAL_FIX
NEXT_PROJECT_TASK_STATUS=READY_NOT_EXECUTED_REQUIRES_EXPLICIT_USER_AUTHORIZATION
```

Negocio demo real creado y preservado (`deligo-demo-burger`), toda la
mecánica de catálogo (ingredientes/agregados/secciones/opciones
compartidas/descuentos/disponibilidad) certificada PASS con cálculos
exactos en vivo. Bloqueador real: pipeline de imágenes roto en Production
(Cloudinary deshabilitado + fallback local 404) —
`F-PRODUCTION-CATALOG-IMAGE-PIPELINE-01`. Onboarding de negocios reales
NO autorizado hasta resolverlo. Detalle en
`codex-reports/PRODUCTION_PILOT_CATALOG_E2E_01.md`.

## CHAT_SESSION_CHECK_URL_PRODUCTION_FIX-R1 — 2026-08-30

```
CHAT_SESSION_CHECK_URL_PRODUCTION_FIX=PASS_PRODUCTION_CHAT_SESSION_CHECK_CONFIGURATION_AND_ROUNDTRIP_CERTIFIED
CHAT_SESSION_CHECK_URL_MISSING=NO
PRODUCTION_MISSING_REQUIRED_VARIABLE_COUNT=0
PRODUCTION_OPERATIONAL_READINESS=PASS
NEXT_PROJECT_TASK_ID=P2_T06_OR_P2_T14_SELECTION
NEXT_PROJECT_TASK_STATUS=READY_NOT_EXECUTED_REQUIRES_EXPLICIT_USER_AUTHORIZATION
```

Cierra `F-PRODUCTION-CHAT-SESSION-CHECK-URL-01` (única limitación
documentada de R7). El operador provisionó `DELIGO_MONOLITH_INTERNAL_URL`
y desplegó `chat en vivo`; esta tarea certificó el resultado en vivo con el
roundtrip sintético de P2-T11-STAGE4E, sin ninguna mutación propia.
Production Sync (R1→R7→este fix) queda completo sin limitaciones
pendientes conocidas. Detalle en
`codex-reports/CHAT_SESSION_CHECK_URL_PRODUCTION_FIX.md`.

## PRODUCTION-SYNC-R7 — 2026-08-30 (Production Sync COMPLETO)

```
PRODUCTION_SYNC_R7=PASS_PRODUCTION_FINAL_INFRASTRUCTURE_POLICY_AND_READINESS_CERTIFIED
PRODUCTION_SYNC_STATUS=CLOSED_WITH_DOCUMENTED_LIMITATIONS
PRODUCTION_OPERATIONAL_READINESS=PASS_WITH_LIMITATIONS
PRODUCTION_SYNC_COMPLETE=SI
CHAT_SESSION_CHECK_URL_MISSING=SI
PRODUCTION_MISSING_REQUIRED_VARIABLE_COUNT=1
PREDEPLOY_POLICY_RECOMMENDATION=KEEP_MANUAL_MIGRATION_GATE
KNOWN_PRODUCTION_SECRET_EXPOSURE_OPEN_COUNT=0
NEXT_PRODUCTION_SYNC_TASK_ID=NONE
NEXT_PROJECT_TASK_ID=CHAT_SESSION_CHECK_URL_PRODUCTION_FIX
NEXT_PROJECT_TASK_STATUS=READY_NOT_EXECUTED_REQUIRES_EXPLICIT_USER_AUTHORIZATION
```

Production Sync se declara completo (R1→R7). Único hallazgo abierto:
`DELIGO_MONOLITH_INTERNAL_URL` ausente en `chat en vivo`/production —
`F-PRODUCTION-CHAT-SESSION-CHECK-URL-01`, fix de una variable conocido, no
aplicado (R7 fue solo lectura). Política de migraciones futuras congelada
en manual (`KEEP_MANUAL_MIGRATION_GATE`); backup/recovery y expand/
contract congelados; runbook operativo documentado. P0/P1 cerrados, P2 en
progreso (P2-T06/T14 sin iniciar, P2-T18 pausado por dependencia externa,
sin cambio por el cierre de Production Sync). Detalle completo en
`codex-reports/PRODUCTION_SYNC_R7.md`.

## PRODUCTION-SYNC-R6-R2 — 2026-08-30

```
PRODUCTION_SYNC_R6_R2=PASS_PRODUCTION_AUXILIARY_JOB_PARITY_CERTIFIED
AUXILIARY_JOB_PARITY_PRODUCTION=PASS
REVIEW_DUPLICATE_PROJECT_SERVICE_FOUND=NO
MESA_DUPLICATE_PROJECT_SERVICE_FOUND=NO
TESTING_DATABASE_CROSSOVER_DETECTED=NO
REVIEW_FIRST_PRODUCTION_RUN_STATUS=PASS
MESA_FIRST_PRODUCTION_RUN_STATUS=PASS
CHAT_CLEANUP_EXECUTION_COUNT_R6_R2=0
PRODUCTION_MIGRATIONS_FINAL_R6_R2=27
DELIGO_FINAL_R6_R2_HEALTH=PASS
CHAT_FINAL_R6_R2_HEALTH=PASS
NEXT_TASK_ID=PRODUCTION-SYNC-R7
NEXT_TASK_STATUS=READY_NOT_EXECUTED_REQUIRES_EXPLICIT_USER_AUTHORIZATION
```

Paridad de jobs auxiliares de Production certificada de punta a punta:
instancias reutilizadas sin duplicados, configuración exacta, sin cruce con
la DB de TESTING, sin ejecución antes de configurar `main`, corridas reales
de Review y Mesa con `errors=0`, backup final post-auxjobs restaurado y
certificado. Detalle completo en `codex-reports/PRODUCTION_SYNC_R6_R2.md`.

## PRODUCTION-SYNC-R6-R1 — 2026-08-30

```
PRODUCTION_SYNC_R6_R1=BLOCKED_REQUIRES_OPERATOR_ASSISTED_PRODUCTION_INSTANCE_CREATION
OPERATOR_CHAT_CLEANUP_FIX_COMPLETED=SI
PRODUCTION_CLEANUP_SECRET_PRESENT=SI
LEGACY_X_CLEANUP_SECRET2_PRESENT=NO
CLEANUP_EXTERNAL_SCHEDULER_CURRENT_EXISTENCE=SI
R6_R1_CURRENT_BACKUP_RESTORABLE=SI
REVIEW_SAFE_PRODUCTION_INSTANCE_CREATION_PROVABLE=NO
MESA_SAFE_PRODUCTION_INSTANCE_CREATION_PROVABLE=NO
REVIEW_ELIGIBLE_NOW_COUNT=0
MESA_ACTIVE_OCCUPANCY_COUNT=0
MESA_ELIGIBLE_EXPIRY_COUNT=0
AUXILIARY_JOB_PARITY_PRODUCTION=BLOCKED_REQUIRES_OPERATOR_ASSISTED_INSTANCE_CREATION
NEXT_TASK_ID=PRODUCTION-SYNC-R6-R2
NEXT_TASK_STATUS=BLOCKED_AWAITING_OPERATOR_UI_INSTANCE_CREATION
```

Cleanup del operador certificado con evidencia real (redeploy exacto,
logs limpios, agregados post-cleanup en cero) y backup fresco restaurado.
Instancias Production de Review/Mesa quedan bloqueadas hasta creación
manual por UI — la API no probó semántica de creación para un par
(servicio, entorno) sin instancia previa. Hand-off exacto en
`codex-reports/PRODUCTION_SYNC_R6_R1.md`.

## PRODUCTION-SYNC-R6-R0 — 2026-08-30

```
PRODUCTION_SYNC_R6_R0=BLOCKED_AWAITING_OPERATOR_CHAT_CLEANUP_SCHEDULER_EVIDENCE
R6_BACKUP_RESTORABLE=SI
PRODUCTION_RECORDED_MIGRATIONS_R6_R0=27
PRODUCTION_PENDING_MIGRATIONS_R6_R0=0
REVIEW_SERVICE_PROJECT_OBJECT_EXISTS=SI
REVIEW_TESTING_INSTANCE_EXISTS=SI
REVIEW_PRODUCTION_INSTANCE_EXISTS=NO
MESA_SERVICE_PROJECT_OBJECT_EXISTS=SI
MESA_TESTING_INSTANCE_EXISTS=SI
MESA_PRODUCTION_INSTANCE_EXISTS=NO
CLEANUP_EXTERNAL_SCHEDULER_CURRENT_EXISTENCE=UNPROVEN_REQUIRES_OPERATOR_UI
PRODUCTION_CLEANUP_SECRET_PRESENT=NO
R6_R0_RAILWAY_MUTATION_COUNT=0
R6_R0_PRODUCTION_JOB_EXECUTION_COUNT=0
R6_R0_PRODUCTION_DB_WRITE=NO
R6_R0_GIT_PUSH_COUNT=0
R6_R0_CODE_DEPLOY_COUNT=0
NEXT_TASK_ID=PRODUCTION-SYNC-R6-R1
NEXT_TASK_STATUS=BLOCKED_AWAITING_OPERATOR_CHAT_CLEANUP_SCHEDULER_EVIDENCE
```

Backup post-27/pre-auxjobs creado y restaurado en PostgreSQL 18.6; auditoría
de Review y Mesa en TESTING completa, sin instancias Production. El scheduler
externo de Chat Cleanup requiere evidencia del operador; no se crea reemplazo.

## PRODUCTION-SYNC-R5 — 2026-08-29

```
PRODUCTION_SYNC_R5=PASS_FINAL_CONTRACT_MIGRATION_27_APPLIED_PRODUCTION_SCHEMA_COMPLETE
R5_MIGRATION_NAME=20260826230000_drop_terminal_operativa_push_subscription
R5_TARGET_MIGRATION_APPLIED=SI
R5_MIGRATE_DEPLOY_ATTEMPT_COUNT=1
R5_MIGRATION_COMMAND_EXIT_CODE=0
PRODUCTION_RECORDED_MIGRATIONS_POST_R5=27
PRODUCTION_SUCCESSFUL_MIGRATIONS_POST_R5=27
PRODUCTION_FAILED_MIGRATIONS_POST_R5=0
PRODUCTION_PENDING_MIGRATIONS_POST_R5=0
PRODUCTION_SCHEMA_MATCHES_POST_27=SI
PUSHSUBSCRIPTION_EXISTS_POST_R5=NO
R5_PRIMARY_BACKUP_RESTORABLE=SI
PRODUCTION_DB_WRITE=SI
R5_GIT_PUSH_COUNT=0
R5_CODE_DEPLOY_COUNT=0
R5_RAILWAY_SERVICE_RESTART_COUNT=0
NEXT_TASK_ID=PRODUCTION-SYNC-R6
NEXT_TASK_STATUS=READY_NOT_EXECUTED_REQUIRES_EXPLICIT_USER_AUTHORIZATION
```

Migration #27 fue aplicada exactamente una vez en Production. El contrato de
`terminales_salon` quedó completo, sin drift inesperado ni pérdida de datos;
los despliegues existentes permanecen saludables. R6 queda listo, pero no fue
ejecutado y requiere autorización explícita nueva.

## PRODUCTION-SYNC-R5-R0-R1 — 2026-08-29

```
PRODUCTION_SYNC_R5_R0_R1=PASS_FRESH_POST26_PRE27_PRODUCTION_LOGICAL_BACKUP_RESTORABLE
PG18_TOOLING_TARGET_VERSION=18.6
PRODUCTION_LOGICAL_BACKUP_RESTORABLE=SI
PRODUCTION_DB_WRITE=NO
R5_R0_R1_GIT_PUSH_COUNT=0
R5_R0_R1_DATABASE_MIGRATION_COUNT=0
R5_PRIMARY_RECOVERY_ARTIFACT=LOGICAL_PG_DUMP_POST26_PRE27
R5_PRIMARY_BACKUP_RESTORABLE=SI
NEXT_TASK_ID=PRODUCTION-SYNC-R5
NEXT_TASK_STATUS=READY_NOT_EXECUTED_REQUIRES_EXPLICIT_USER_AUTHORIZATION
```

Backup lógico fresco Production restaurado y certificado con PostgreSQL 18.6.
R5 queda listo para #27, pero requiere autorización explícita.

## PRODUCTION-SYNC-R5-R0 — 2026-08-29

```
PRODUCTION_SYNC_R5_R0=BLOCKED_PG_DUMP_18_UNAVAILABLE
PRODUCTION_POSTGRES_MAJOR_VERSION=18
PRODUCTION_RECORDED_MIGRATIONS_PRE_BACKUP=26
PRODUCTION_FAILED_MIGRATIONS_PRE_BACKUP=0
PRODUCTION_PENDING_MIGRATIONS_PRE_BACKUP=1
PG_DUMP_18_AVAILABLE=NO
PRODUCTION_DB_WRITE=NO
R5_R0_GIT_PUSH_COUNT=0
R5_R0_DATABASE_MIGRATION_COUNT=0
NEXT_TASK_ID=NOT_SET
NEXT_TASK_STATUS=BLOCKED_PG_DUMP_18_UNAVAILABLE
```

R5-R0 queda detenido hasta disponer de `pg_dump`/`pg_restore` PostgreSQL 18 o
Docker/Podman para `postgres:18`. No usar PostgreSQL 12 ni ejecutar #27.

## PRODUCTION-SYNC-R4-R2-R2 — 2026-08-29

```
PRODUCTION_SYNC_R4_R2_R2=PASS_R4_DUAL_PRODUCTION_DEPLOY_CERTIFIED_27_PENDING
PRODUCTION_SYNC_R4=PASS_PRODUCTION_MAIN_FAST_FORWARDED_EXACT_CODE_DEPLOYED_HEALTHY_27_PENDING
DELIGO_FINAL_R4_RUNTIME_STATE=ONLINE/HEALTHY
CHAT_FINAL_R4_RUNTIME_STATE=ONLINE/HEALTHY
PRODUCTION_RECORDED_MIGRATIONS_FINAL_R4=26
PRODUCTION_FAILED_MIGRATIONS_FINAL_R4=0
PRODUCTION_PENDING_MIGRATIONS_FINAL_R4=1
PREDEPLOY_ACTIVATION_R4=DEFERRED
NEXT_TASK_ID=PRODUCTION-SYNC-R5
NEXT_TASK_STATUS=READY_NOT_EXECUTED_REQUIRES_EXPLICIT_USER_AUTHORIZATION
```

R4 queda cerrado con DeliGO y chat Production en el commit exacto, ambos
`SUCCESS`, logs sanos y smoke HTTP 200. La DB permanece post-26/pre-27.
R5 sólo está listo; no ejecutar sin autorización explícita.

## PRODUCTION-SYNC-R4-R2-R1 — 2026-08-29

```
PRODUCTION_SYNC_R4_R2_R1=BLOCKED_AWAITING_MANUAL_CHAT_BRANCH_CHANGE
R1_REQUIRED_VARIABLE_ROWS_PASS=8_OF_8
R4_R2_R1_LOCAL_DEPLOY_GATE=PASS
R4_R2_R1_PRE_PUSH_GATE=PASS
R4_R2_R1_MAIN_PUSH_COUNT=1
PRODUCTION_CODE_DEPLOY=SI
DELIGO_DEPLOYMENT_STATUS=SUCCESS
CHAT_SOURCE_BRANCH_POST=testing_UNCHANGED
CHAT_DEPLOYMENT_STATUS=NOT_REACHED
PRODUCTION_DB_WRITE=NO
NEXT_TASK_ID=NOT_SET
NEXT_TASK_STATUS=BLOCKED_AWAITING_MANUAL_CHAT_BRANCH_CHANGE
```

DeliGO está sano en el commit objetivo. Queda una acción manual única en
Railway Production: cambiar sólo `chat en vivo` de branch `testing` a `main`,
preservando `LeoCampos2504/DeliGO`, `/mini-services/chat-service` y autodeploy
habilitado. No ejecutar Deploy manual. Ver
`codex-reports/PRODUCTION_SYNC_R4_R2_R1.md`.

## PRODUCTION-SYNC-R4-R2 — 2026-08-29

```
PRODUCTION_SYNC_R4_R2=BLOCKED_UNEXPECTED_LIVE_PRODUCTION_VARIABLE_STATE
R4_R2_LOCAL_DEPLOY_GATE=PASS
R4_R2_PRE_PUSH_GATE=BLOCKED
R4_R2_MAIN_PUSH_COUNT=0
PRODUCTION_CODE_DEPLOY=NO
PRODUCTION_DB_WRITE=NO
NEXT_TASK_ID=NOT_SET
NEXT_TASK_STATUS=BLOCKED_LIVE_RAILWAY_VARIABLE_STATE_CONTRADICTS_OPERATOR_AUTHORITY
```

El gate local pasó, pero el listado vivo de Railway Production DeliGO no
contiene las tres variables `PRIVATE_EVIDENCE_CLOUDINARY_*` declaradas por el
operador. No se hizo push ni deploy. Ver
`codex-reports/PRODUCTION_SYNC_R4_R2.md`.

## PRODUCTION-SYNC-R4-R1 — 2026-08-29

```
PRODUCTION_SYNC_R4_R1=BLOCKED_AWAITING_MANUAL_PRIVATE_EVIDENCE_CLOUDINARY_CONFIGURATION
REALTIME_INTERNAL_SERVICE_URL=RESOLVED_PROD_TO_PROD_WITH_SKIP_DEPLOYS
PRIVATE_EVIDENCE_MANUAL_OPERATOR_ACTION_REQUIRED=SI
R4_R1_MAIN_PUSH_COUNT=0
PRODUCTION_CODE_DEPLOY=NO
PRODUCTION_DB_WRITE=NO
NEXT_TASK_ID=NOT_SET
NEXT_TASK_STATUS=BLOCKED_AWAITING_MANUAL_PRIVATE_EVIDENCE_CLOUDINARY_CONFIGURATION
```

La URL interna ya está resuelta y verificada. Faltan las tres variables
Cloudinary exactas de evidencia privada, que requieren credenciales dedicadas
de Production obtenidas por el operador. La fuente de chat permanece sin
branch/root demostrables por metadata; no se hizo mutación. Ver
`codex-reports/PRODUCTION_SYNC_R4_R1.md`.

## PRODUCTION-SYNC-R4 — 2026-08-29

```
PRODUCTION_SYNC_R4=BLOCKED_R4_REQUIRED_PRODUCTION_VARIABLES_UNCERTIFIED_AND_CHAT_SOURCE_BRANCH_UNPROVEN
R4_MAIN_PUSH_COUNT=0
PRODUCTION_DB_WRITE=NO
PRODUCTION_CODE_DEPLOY=NO
NEXT_TASK_ID=NOT_SET
NEXT_TASK_STATUS=BLOCKED_AWAITING_EXPLICIT_AUTHORIZATION_FOR_MISSING_PRODUCTION_DEPLOY_PREREQUISITES
```

El fast-forward exacto estaba identificado, pero el gate se detuvo antes del
push: faltan tres secretos exactos de evidencia privada, falta cerrar la
estrategia de `REALTIME_INTERNAL_SERVICE_URL` y no se puede probar la rama
Production de `chat en vivo`. Ver `codex-reports/PRODUCTION_SYNC_R4.md`.

## PRODUCTION-SYNC-R3-R3-R1 — 2026-08-29

```
PRODUCTION_SYNC_R3_R3_R1=PASS_PRODUCTION_BASELINED_AND_MIGRATED_THROUGH_26_DESTRUCTIVE_27_PENDING
PRODUCTION_DB_WRITE=SI
NEXT_TASK_ID=PRODUCTION-SYNC-R4
NEXT_TASK_STATUS=READY_NOT_EXECUTED_REQUIRES_EXPLICIT_USER_AUTHORIZATION
```

La invocación corregida completó `0_init` y #2–#26 en Production. #27 no se
ejecutó; el detalle está en `codex-reports/PRODUCTION_SYNC_R3_R3_R1.md`.

## PRODUCTION-SYNC-R3-R3 — 2026-08-29

```
PRODUCTION_SYNC_R3_R3=BLOCKED_PRODUCTION_PATCH_NOT_EXECUTED_COMMAND_INVOCATION_ERROR
PRODUCTION_DB_WRITE=NO
NEXT_TASK_ID=NOT_SET
NEXT_TASK_STATUS=BLOCKED_AWAITING_NEW_EXPLICIT_AUTHORIZATION
```

El comando de `psql` recibió el archivo después de la URL; `psql` lo reportó
como argumento ignorado. No se ejecutó SQL, no hubo mutación y no se reintentó.
Detalle: `codex-reports/PRODUCTION_SYNC_R3_R3.md`.

## PRODUCTION-SYNC-R3-R2-R1 — 2026-08-29

```
PRODUCTION_SYNC_R3_R2_R1=PASS_SEMANTIC_0_INIT_COMPLETION_FULL_SCRATCH_REHEARSAL_CERTIFIED
NEXT_TASK_ID=PRODUCTION-SYNC-R3-R3
NEXT_TASK_STATUS=READY_NOT_EXECUTED_REQUIRES_EXPLICIT_USER_AUTHORIZATION
PRODUCTION_DB_WRITE=NO
```

El patch semántico de `0_init` y el replay aislado #2–#26 pasan en scratch;
exactamente #27 queda pendiente. Ver `codex-reports/PRODUCTION_SYNC_R3_R2_R1.md`.

## PRODUCTION-SYNC-R3-R2 — 2026-08-29

```
PRODUCTION_SYNC_R3_R2=BLOCKED_BASELINE_COMPLETION_PATCH_NOT_EXACT
BLOCKER=0_init requiere empleados.cuentaOperativaId y objetos asociados; el hard rule prohíbe alterar la tabla existente
NEXT_TASK_ID=NOT_SET
NEXT_TASK_STATUS=BLOCKED_REQUIRES_EXPLICIT_RECONCILIATION
PRODUCTION_DB_WRITE=NO
```

Detalle y marcadores completos: `codex-reports/PRODUCTION_SYNC_R3_R2.md`.

## PRODUCTION-SYNC-R3 — 2026-08-29

```
PRODUCTION_SYNC_R3=BLOCKED_SELECTIVE_EXECUTION_UNPROVABLE_0_INIT_BASELINE
NEXT_TASK_ID=PRODUCTION-SYNC-R3-R1
NEXT_TASK_STATUS=REQUIRES_EXPLICIT_DECISION_ON_0_INIT_BASELINE
PRODUCTION_DB_WRITE=NO
DATABASE_MIGRATION_EXECUTED=NO
PRODUCTION_CODE_DEPLOY=NO
```

## PRODUCTION-SYNC-R3-R1 — 2026-08-29

```
PRODUCTION_SYNC_R3_R1=BLOCKED_BASELINE_STATE_CANNOT_BE_PROVEN
BASELINE_PREFIX_COUNT=0
NEXT_TASK_ID=NOT_SET
NEXT_TASK_STATUS=BLOCKED_PENDING_EXPLICIT_BASELINE_DECISION
PRODUCTION_DB_WRITE=NO
```

## Fases

```
P0=CLOSED
P1=CLOSED
P2=IN_PROGRESS
P3=(no iniciada, sin detalle en el historial reciente)
```

## Orden canónico P2 (posiciones no se reordenan permanentemente)

```
position 5: P2-T02 = PAUSED_EXTERNAL_DEPENDENCY
  Tracking GPS de delivery en tiempo real — requiere hardware Android
  físico con GPS confiable para certificación runtime (Stage 6N).
  NEXT_WHEN_HARDWARE_AVAILABLE=P2-T02-STAGE6N-RETRY
  Pausa es temporal y EXPLÍCITA (EXTERNAL_HARDWARE_DEPENDENCY) — no
  reordena el roadmap; en cuanto haya hardware disponible retoma
  prioridad inmediata, sujeta a su compatibility gate.

position 6: P2-T05 = CLOSED (final accumulated regression, testing checkpoint
  y adversarial closeout PASS — ver CURRENT_TASK.md)
  Push multi-device normalized subscription model — hardening.
  Se activó como tarea ejecutable mientras P2-T02 está pausada.

position 7:  P2-T13 = CLOSED (same-owner/same-endpoint stale-detach race — separado, nunca absorbido por P2-T05; ver bloque Stage 7 abajo)
position 8:  P2-T12 = CLOSED (TerminalOperativa.pushSubscription Cleanup, F-P0-05; Stage5F final closeout PASS)
position 9:  P2-T11 = CLOSED (Native Socket Post-Logout TTL Hardening — Phase A+B+C desplegadas y certificadas en TESTING con runtime real de servidor y navegador; F-P2-T11-01 RESOLVED; Stage5G final closeout PASS — ver bloque Stage 5G abajo)
position 10: P2-T18 = BLOCKED_ONLY_BY_FULL_REAL_BROWSER_REPLAY_AND_REMAINING_CHAT_UI_ACCEPTANCE (Chat Cross-Tab UI Polish, F-P1-01+F-P1-02; Stage6 PASS — commit 1adcc01f5380d896bed6e46dcd11bccb90d39e07 desplegado y confirmado en TESTING; Stage7 BLOCKED_REAL_BROWSER_CONTROL_UNAVAILABLE; Stage7-R1 recuperó un navegador real local (Chrome + CDP crudo, compositor confirmado activo) pero F-P1-02 tropezó con un runtime defect/ambigüedad material en la dirección X→Y del typing — servidor emite, frame llega al WebSocket real de la página receptora en dos niveles, scope autorizado, pero la UI nunca se actualiza; causa raíz no determinada por instrucción explícita del usuario; F-P1-01 no se completó; Stage7-R1A ejecutó un diagnóstico acotado (3 intentos, regla Stop-on-Objective) y refutó las tres hipótesis más probables — guard de identidad, consumidor de chat distinto, reconexión de socket — sin aislar el hop exacto; encontró que el defecto también afecta a `new-message`, no sólo a `user-typing`, contradiciendo la evidencia de Stage7-R1; causa raíz sigue sin determinar; Stage7-R1A-R1 intentó reconciliar con 2 reproducciones controladas — la Reproducción 1 mostró frames reales confirmados sin actualización de UI para ambos eventos, pero el control Y→X (100% estable en las 2 etapas previas) falló, invalidando la reproducción para clasificación; por regla de alto temprano no se ejecutó la Reproducción 2 ni se forzó una clasificación A/B/C/D/E; recomienda priorizar estabilidad de navegador conectado por el usuario en P2-T18-STAGE7-R2 antes de seguir clasificando el defecto; Stage7-R2 exigió exactamente eso — navegador real conectado por el usuario (Claude in Chrome), rechazando cualquier fallback headless/CDP — pero `list_connected_browsers()` devolvió 0 navegadores conectados; bloqueo inmediato antes de crear ningún fixture, per la puerta obligatoria del prompt; requiere que el usuario conecte Claude in Chrome antes de reintentar en P2-T18-STAGE7-R2-RETRY; Stage7-R2-RETRY reintentó exactamente eso tras autorización explícita de reintento, pero `list_connected_browsers()` volvió a devolver 0 navegadores conectados — segunda vez consecutiva; mismo bloqueo inmediato sin fixture ni fallback; requiere que el usuario conecte Claude in Chrome antes de reintentar en P2-T18-STAGE7-R2-RETRY-2; Stage7-R2-RETRY-2 se ejecutó con el navegador ya conectado y funcional — fixture TESTING creado, login productivo PASS por separado para X (Cliente) e Y (Negocio) — pero la topología obligatoria (X1+X2+Y1 simultáneos) falló estructuralmente: Cliente y Negocio comparten la misma cookie de sesión `deligo_session`, por lo que el login de Y invalida la sesión de X en el mismo navegador/perfil; una ventana de incógnito no resultó controlable por la extensión; `P2_T18_STAGE7_R2_RETRY_2=BLOCKED_CONTROL_INVALID_EARLY_HARD_STOP`; ningún run de aceptación fue ejecutado; esto no es un hallazgo sobre el runtime defect ya conocido de F-P1-02, sino un hecho estructural de sesión única; próxima tarea recomendada P2-T18-STAGE7-R2-R1 para decidir si se necesitan dos navegadores reales conectados simultáneamente, uno por actor; en vez de eso el usuario abrió P2-T18-BLOCKER-AUTH1 — auditoría histórica + de código actual que clasificó el hallazgo como F-P2-T18-AUTH01 SAME_BROWSER_MULTI_ACTOR_SESSION_COLLISION (HISTORICAL_CLASSIFICATION=C_ONLY_DB_MULTI_SESSION_WAS_PREVIOUSLY_SOLVED, nunca fue una regresión, nunca fue implementado), congeló el diseño mínimo seguro SELECTED_DESIGN_ID=OPTION_A_ACTOR_FAMILY_SCOPED_SESSION_COOKIES (SCHEMA_CHANGE_REQUIRED=NO, 8 archivos núcleo, 14 tests de aceptación), sin implementar nada; P2-T18=BLOCKED_BY_AUTH_SESSION_COEXISTENCE; P2-T18-BLOCKER-AUTH2 intentó la implementación local dentro de ese allowlist de 8 archivos, pero se bloqueó ANTES de mutar ningún código: los 4 endpoints compartidos por múltiples familias de actor necesitan que sus únicos callers reales (src/hooks/use-auth.ts, src/lib/realtime-client.ts, src/lib/realtime-manager.ts) declaren explícitamente la familia solicitada, y esos 3 archivos quedan fuera del allowlist; además useAuthStore es consumido por 26 archivos, sólo 2 en el allowlist; DESIGN_DRIFT_EXTRA_PRODUCT_PATH_REQUIRED=SI, cero mutación de fuente/test, el diseño OPTION_A en sí no se cuestiona; siguiente tarea P2-T18-BLOCKER-AUTH2-R1 P2-T18-BLOCKER-AUTH2-R1 reconcilió el drift: auditó el call-site real de SESSION_COOKIE_NAME (89 archivos, ≈65 de producto, la abrumadora mayoría bajo prefijo de path family-específico) y verificó por semántica de plataforma que cada pestaña tiene memoria JS/Zustand independiente, así que useAuthStore.user preserva su forma pública sin migrar sus 26 consumidores; diseñó un middleware.ts nuevo que resuelve la cookie de familia y la presenta bajo el nombre legacy a los route handlers sin modificarlos, reduciendo el allowlist real a 9 archivos (SECURITY_ATTACK_MATRIX=8_OF_8_SAFE, SCHEMA_CHANGE_REQUIRED=NO); rollout congelado en 3 fases; cero mutación de código; F-P2-T18-AUTH01=DESIGN_REFROZEN_READY_FOR_LOCAL_IMPLEMENTATION; P2-T18-BLOCKER-AUTH2-R2 comenzó esa implementación pero descubrió a mitad de camino que src/proxy.ts ya es la autoridad de Edge Middleware activa en Next.js 16 (equivalente exacta de middleware.ts) — crear un middleware.ts nuevo habría competido con ella; la implementación continuó extendiendo src/proxy.ts en vez de detenerse a reconciliar el allowlist, hasta que el usuario emitió un ALTO CONTROLADO explícito; ANTI_SCOPE_CREEP_COMPLIANCE=FAIL_BEFORE_STOP_DUE_TO_POST_DISCOVERY_MUTATION registrado sin ocultarlo; diff preservado sin revertir (7 archivos modificados + 2 nuevos, todos con tests PASS) pero NO certificado como Fase 1 válida; cero commit/push/deploy; siguiente tarea P2-T18-BLOCKER-AUTH2-R2-R1 P2-T18-BLOCKER-AUTH2-R2-R1 completó esa reconciliación sin ninguna mutación de código (fingerprint del diff idéntico antes/después): confirmó con evidencia definitiva (node_modules/next/dist/build/index.js:605, Next.js 16 falla el build si middleware.ts y proxy.ts coexisten) que src/proxy.ts es la única autoridad posible; auditó los 9 paths del diff preservado línea por línea, encontró que 7 quedan KEEP_AS_IS_CANDIDATE sin cambios y sólo 2 (src/proxy.ts, src/proxy.test.ts) necesitan una corrección puntual no bloqueante (sanitización del header x-resolved-actor-family, gap cosmético, nunca explotable); re-congeló el allowlist de Fase 1 en 4 archivos de producto + 5 tests; introdujo la regla permanente WOULD_NEW_FACT_HAVE_CHANGED_EXTERNAL_PROMPT para toda tarea futura; P2-T18-BLOCKER-AUTH2-R2-R2 aplicó exactamente esa corrección (sólo en src/proxy.ts y src/proxy.test.ts, los otros 7 paths preservados byte-idénticos, verificado por fingerprint antes/después): saneamiento incondicional del header interno x-resolved-actor-family (SANITIZE_FIRST->RESOLVE->SET_TRUSTED_IF_VALID), 4 tests adversariales nuevos; re-evaluó la matriz de seguridad completa en 12/12 PASS; re-ejecutó la autoridad de test de Fase 1 completa en 73/73 PASS (23 proxy.test.ts + 5 actor-family-coexistence + 7 session-login-atomicity + 19 wiring + 19 client-block-security); ESLint/TSC sin errores nuevos; npm run build exitoso confirmando "ƒ Proxy (Middleware)" sin conflicto; Fase 1 queda certificada LOCALMENTE (sin commit todavía); P2-T18-BLOCKER-AUTH2-R3 ejecutó esa revisión adversarial de forma independiente (releyendo proxy.ts completo contra HEAD, re-derivando el límite de confianza del header, reconstruyendo la matriz de seguridad desde cero: R3_SECURITY_MATRIX=16_OF_16_PASS, ningún hallazgo de seguridad sustantivo) pero bloqueó la certificación por un hallazgo de PROCESO: el propio reporte de R2-R2 admitía haber corregido de paso un problema de tipos preexistente en proxy.test.ts (firma del helper req(), ajena a la corrección de seguridad), técnicamente correcto pero nunca pre-autorizado explícitamente al congelar los dos correction paths — clasificado INCIDENTAL_TSC_CHANGE_CLASSIFICATION=B_REQUIRED_TO_CERTIFY_PHASE1_BUT_NOT_PREVIOUSLY_FROZEN, que por regla explícita nunca puede auto-autorizarse en precommit; nada corregido ni revertido, fingerprint del diff idéntico antes/después; requiere autorización externa explícita del usuario antes de reintentar certificación — P2-T18-BLOCKER-AUTH2-R3-R1 recibió esa autorización explícita del usuario (excepción única y puntual, no precedente general: preservar el hunk de tipos ya existente en req() de proxy.test.ts) y verificó las 18 condiciones de PASS del prompt de esa etapa sin mutar ni revertir ningún byte de código: confirmó que ese hunk es el único no atribuible ya a los dos correction paths (auditadas las 293 líneas de proxy.test.ts), que el tipo nuevo describe exactamente la superficie real usada por sus 24 call-sites (nunca body/signal/duplex), y — con un contrapunto EJECUTADO en un repro standalone fuera del working tree, no sólo razonado — que revertir sólo ese hunk reproduce exactamente el error de TypeScript original (signal: AbortSignal|null no asignable a AbortSignal|undefined); re-derivó R3_R1_SECURITY_MATRIX=16/16 PASS, re-ejecutó fresca la autoridad de test completa en 73/73 PASS, ESLint/TSC/build sin errores nuevos, fingerprint de los 9 paths idéntico antes/después; Fase 1 queda PASS_PRECOMMIT_SCOPE_RECONCILED_SINGLE_TEST_ONLY_EXCEPTION_ACCEPTED, lista para P2-T18-BLOCKER-AUTH2-R4 (commit local exacto) — P2-T18-BLOCKER-AUTH2-R4 empaquetó ese diff en un único commit local sin mutar source/test: verificó fingerprint 9/9 contra la autoridad certificada antes de tocar nada, re-ejecutó fresca la autoridad de test completa (73/73 PASS, tercera confirmación consecutiva del mismo total), lint/TSC/build sin regresiones, re-fingerprint inmediato antes de stagear, stageó explícitamente sólo los 9 paths exactos por nombre (nunca git add -A), auditó el índice completo (0 extras, sin reports, sin root 32), comparó byte a byte blobs staged vs. working tree certificado (9/9), leyó el diff cacheado completo línea por línea confirmando alcance semántico exacto, ejecutó exactamente un git commit -m "feat: add actor-family session cookie foundation" exitoso a la primera, y recertificó directamente desde los objetos Git (git ls-tree HEAD): los 9 blobs commiteados son idénticos a los staged e idénticos a los certificados por AUTH2-R3-R1, sin ningún drift; HEAD=c047e9eb67e97ca1b9c1ae78b4c2725f44b02ebb, HEAD^=1adcc01f5380d896bed6e46dcd11bccb90d39e07 (baseline exacto), origin/testing-codex sin cambio, AHEAD=1/BEHIND=0, sin push/deploy/Railway/Production, root 32 nunca tocado — P2-T18-BLOCKER-AUTH2-R5 recertificó ese commit de forma independiente directamente desde los objetos Git, sin confiar en el resumen de R4: re-derivó fileset y 9 blob IDs desde git diff-tree/git ls-tree HEAD, leyó los 9 blobs completos vía git show HEAD:<path> con hash recomputado de forma independiente (prueba criptográfica), leyó el diff completo HEAD^..HEAD clasificando cada hunk en 8 categorías congeladas (0 sin clasificar, 0 de Fase 2), re-derivó la matriz de seguridad de 16 casos desde cero código por código (confirmando por grep que proxy.ts no tiene ninguna llamada a response.cookies.*), reconfirmó la excepción única de req() sin reabrir su autorización, y confirmó ausencia total de activación de cliente de Fase 2; en la primera corrida fresca un test de concurrencia real contra Postgres (client-block-security.integration.test.ts, 3 logins verdaderamente concurrentes) falló de forma aislada, investigado sin tocar código (aislado PASS, grupo completo re-ejecutado PASS) confirmando un flake transitorio de infraestructura, no una regresión; total final reproducible 73/73 PASS, lint/TSC/build sin regresiones, working tree idéntico a HEAD, origin sin movimiento; corrigió exclusivamente como documentación un bloque de marcadores current-state desactualizado en CODEX_REPORT.md, sin tocar ningún marcador histórico; R5_PHASE1_COMMIT_TECHNICALLY_CERTIFIED=SI, P2_T18_PHASE1_SAFE_TO_PUSH=YES_AFTER_FRESH_R6_PREPUSH_GATES (R5 no autoriza por sí sola un push — R6 debe repetir gates de prepush completamente frescos) — P2-T18-BLOCKER-AUTH2-R6 revalidó en fresco inmediatamente antes del push (corrida DECISIVA única sin reintentos permitidos: 73/73 a la primera, 16/16 seguridad re-confirmada, lint/TSC/build PASS, Railway confirmado amiable-rejoicing/TESTING sin deploy concurrente, salud prepush PASS) y ejecutó exactamente un git push origin testing-codex (1adcc01f..c047e9eb, sin --force); observó pasivamente el autodeploy Git-triggered de DeliGO Copy (deployment 2b2c2771) y chat en vivo (deployment c3873b8a), ambos SUCCESS con commitHash exacto c047e9eb confirmado desde metadata real de Railway (no inferido), logs limpios, sin migración pendiente (sin schema change), salud pre/post deploy PASS; certificó en runtime real contra el backend desplegado, con un harness temporal externo al repo (eliminado al finalizar) y fixtures TESTING aislados con prefijo P2T18_AUTH2_R6_ (limpiados, 0 remanentes), los 16 casos de la matriz de seguridad runtime: login individual Cliente/Negocio compatible con el cliente actual pre-Fase2, coexistencia simultánea de ambas cookies de familia en el mismo jar, aislamiento estricto por path verificado por ID/slug exacto de cada fixture (no sólo "algún login funcionó"), selector en conflicto sin poder anular el path, selector malformado/desconocido fail-closed, header interno spoofeado sin autoridad, resolución sin efecto secundario de Set-Cookie, sin fallback cruzado de familia, logout acotado exactamente a la familia seleccionada dejando la sesión DB de la otra familia intacta, y transición legacy funcional sin fuga cruzada; Fase 1 queda PASS_PHASE1_TESTING_PUSH_DEPLOY_RUNTIME_CERTIFIED, desplegada y certificada en TESTING como foundation server-side, sin haber iniciado Fase 2; P2-T18-BLOCKER-AUTH2-R7 revalidó de sólo lectura el contrato de Fase 2 (activación cliente) contra el código actual, no contra el diseño histórico sin verificar: encontró 3 callers reales de /api/auth/me nunca detectados antes (use-suspension-check.ts, login/page.tsx, auth-modal.tsx, cada uno con la familia ya conocida en su propio call-site) y encontró que realtime-manager.ts (parte del candidato histórico de 5) NO requiere ningún cambio porque realtime-client.ts puede derivar la familia de window.location.pathname por sí mismo sin que el manager reenvíe actor.userType; congeló allowlist de producto reconciliado en 7 archivos (auth-store.ts, realtime-provider.tsx, use-auth.ts, realtime-client.ts, use-suspension-check.ts, login/page.tsx, auth-modal.tsx), fuente de verdad de familia activa (pathname), diseño de storage namespaced por familia sin cambiar la forma pública del store (0/26 consumidores requieren cambio), transición legacy sin migración explícita (auto-reparación vía el bootstrap existente + el fallback de cookie legacy ya certificado), contrato cross-tab same-family/cross-family aislado (resolviendo el hallazgo de colisión de AUTH1), selector reutilizando exactamente el transporte ya certificado de Fase 1 (query param, nunca uno nuevo), matriz de seguridad de 20 casos y contrato de aceptación de 10 puntos; cero mutación de código; PASS_PHASE2_CONTRACT_RECONCILED_WITH_ALLOWLIST_CHANGE — P2-T18-BLOCKER-AUTH2-R8 implementó localmente exactamente ese contrato: los 7 archivos de producto congelados (auth-store.ts con activeSessionFamily boundary-safe y storage namespaced por familia sin cambiar la forma pública del store, realtime-provider.tsx con listener cross-tab consciente de familia, use-auth.ts y sus 3 callers adicionales de /api/auth/me con selector ?actorFamily=, realtime-client.ts derivando la familia de pathname sin tocar RealtimeManager), verificando dos veces que realtime-manager.ts/realtime-types.ts/los 4 archivos server de Fase 1 quedan byte-idénticos; escribió/modificó 4 archivos de test (3 nuevos + 1 actualizado), 130/130 tests PASS (33 mandatorios + 97 de regresión, incluyendo Fase 1 server y P2-T11 sin cambio), lint/TSC/build limpios, 20/20 casos de seguridad y 10/10 de aceptación local satisfechos; un defecto propio de boundary-safety en activeSessionFamily ("/clientevil" habría matcheado "/cliente") fue encontrado y corregido por el propio test antes de terminar, dentro del mismo archivo ya autorizado; PASS_PHASE2_CLIENT_ACTIVATION_LOCAL_IMPLEMENTED; sin commit/push/deploy/DB real/navegador real; siguiente tarea P2-T18-BLOCKER-AUTH2-R9 (revisión adversarial precommit del diff de Fase 2, 11 paths), todavía no ejecutada; AUTH2-R9 bloqueó por 2 mutantes sobrevivientes de cobertura de test (sin corrección de producto), definiendo AUTH2-R9-R1 como único follow-up; AUTH2-R9-R1 cerró exactamente esa cobertura (allowlist final: 11 paths, 2 archivos de test corregidos), quedando el diff de Fase 2 PHASE2_LOCAL_MUTATION_HARDENED_READY_FOR_EXACT_COMMIT; AUTH2-R10 lo convirtió en el commit local exacto `a1579f11e79a41b90c6df4d2e8573ca9a669b856` (parent `c047e9eb`, subject "feat: enable actor-family client auth coexistence", 11/11 blobs); AUTH2-R11 lo recertificó de forma independiente directamente desde los objetos Git (11/11 blobs, 133/133 tests, 20/20 seguridad, 10/10 aceptación); AUTH2-R12 ejecutó el único push (`c047e9eb..a1579f11`) y confirmó el autodeploy Git-triggered de DeliGO Copy y chat en vivo, ambos SUCCESS con commitHash exacto, más un smoke de regresión de Fase 1 server sin navegador; AUTH2-R13 certificó con Chrome real (Claude in Chrome, navegador elegido explícitamente por el usuario) la coexistencia Cliente+Negocio en el mismo navegador contra TESTING desplegado en `a1579f11`: confirmó 9/18 puntos de la matriz de aceptación con evidencia real (login productivo de ambos actores, coexistencia simultánea de cookies/storage por familia, Cliente sobreviviendo sin recarga al login de Negocio — repro directo del ataque original de AUTH01 sin colisión —, reload determinístico alternado, y selectores de realtime/token+authorize correctos para Cliente vía un chat real sobre un Pedido fixture mínimo autorizado explícitamente por el usuario más allá del cap original de 2 fixtures) pero descubrió a mitad de la matriz, con evidencia de red real, un defecto real de producto distinto — registrado como F-P2-T18-AUTH02 — en el que `/api/chat/*` (excepto `/cleanup`) y `/api/push/subscribe`+`/unsubscribe` devuelven 401 para ambos actores en cuanto coexisten 2+ cookies de familia, root-caused a que `AUTH_REQUIRED_PREFIXES` en `src/proxy.ts` nunca fue incluido en el allowlist de selector de Fase 1/Fase 2 y su fallback de `resolveActorSession()` falla cerrado ante 2+ candidatas; por regla explícita de la etapa no se corrigió nada, y R13 concluye BLOCKED_REAL_BROWSER_PRODUCT_DEFECT con matriz 9/18+1/18 cleanup, sin alcanzar 18/18; F_P2_T18_AUTH01_STATUS=OPEN_REAL_BROWSER_DEFECT_ISOLATED (el núcleo cookie/storage/reload/realtime-connection de AUTH01 queda confirmado funcionando; el defecto es un gap distinto nunca antes auditado); fixtures y Sesion huérfanas limpiadas en su totalidad, Git final HEAD=ORIGIN=a1579f11 sin cambio; siguiente tarea P2-T18-BLOCKER-AUTH2-R13-R1 (corrección focal única y aislada de F-P2-T18-AUTH02, tras la cual R13 debe repetirse completa desde cero para certificar 18/18), todavía no ejecutada; AUTH2-R13-R1 (read-only, PASS) reconcilió causa raíz/callers/allowlist exacto para F-P2-T18-AUTH02 sin mutar código: confirmó que el rewrite de cookie en proxy.ts es incondicional a AUTH_REQUIRED_PREFIXES, revelando que /api/push/status (fuera de esa lista) también está afectado por el mismo mecanismo; confirmó por código que /api/push/unsubscribe también está afectado (antes sólo "probable"); enumeró los 11 call sites reales (6 Chat en 4 archivos incluyendo un segundo caller no documentado en share-target-flow.tsx, 5 Push en 2 archivos, 0 no-navegador) y descubrió que la fuente de familia confiable para estos callers es useAuthStore().user?.type (no pathname, porque ChatFab/ChatSheet/PermissionPrompt están montados en el ROOT layout, activos en cualquier ruta) salvo share-target-flow.tsx que usa su prop role explícito; clasificó /api/pedidos(creación)+tracking como PHASE3_DEFERRED (mismo patrón, degradación silenciosa a invitado, fuera de este fix aislado); congeló allowlist de producto de 7 archivos (proxy.ts + 4 Chat + 2 Push, cero route handlers), allowlist de test de 7 (4 modificados + 3 nuevos sobre archivos hoy sin cobertura), matriz de seguridad de 20 casos y aceptación de 12; sin BLOCK, Git sin cambio; siguiente tarea P2-T18-BLOCKER-AUTH2-R13-R2 (implementación local focal), todavía no ejecutada; AUTH2-R13-R2 implementó localmente ese contrato exacto sin commit: recuperó el contrato verbatim de R13-R1 antes de tocar nada, recontó narrow los 11 callers (6 Chat + 5 Push, idéntico) y fingerprint SHA-256 de 17 vecinos+handlers (pre/post idénticos); agregó exactamente 6 entradas a SELECTOR_ENDPOINT_PREFIXES en src/proxy.ts (incluyendo /api/push/status pese a estar fuera de AUTH_REQUIRED_PREFIXES); propagó ?actorFamily= en los 11 call sites productivos desde la fuente congelada por caller (useAuthStore().user?.type en 9 de 11 — nunca pathname, porque ChatFab/ChatSheet/ChatView/PermissionPrompt se montan desde el layout raíz — role prop en los 2 de share-target-flow.tsx); cero route handler tocado; 4 archivos de test existentes corrigieron aserciones literales dependientes del texto exacto anterior (URLs fetch directas, deps arrays, conteo de ocurrencias de /api/push/unsubscribe de 1 a 3) sin debilitar ninguna, más 3 archivos de test nuevos creados (chat-fab.tsx/chat-view.tsx/share-target-flow.tsx no tenían cobertura); autoridad focal 117/117 PASS; regresión completa 294/294 PASS en 3 tandas (Fase1/Fase2 unit+integration con DB real vía DELIGO_TEST_DATABASE_URL, P2-T13 focal, 4 route tests Chat/Push); 0 ESLint/TSC nuevos (2 diagnósticos TS2367 preexistentes en permission-prompt.tsx confirmados idénticos contra el blob a1579f11, no tocados); git diff --check y npm run build ambos PASS (`ƒ Proxy (Middleware)` confirmado sin conflicto); diff completo de 20 hunks leído íntegro y clasificado 100% en 3 clases (1 proxy + 10 Chat + 9 Push), 0 limpieza incidental; artefacto tsconfig.tsbuildinfo eliminado antes del cierre; índice vacío en todo momento; Git final idéntico HEAD=ORIGIN=a1579f11, AHEAD=0/BEHIND=0; P2-T13/P2-T11 verificados intactos; PASS_AUTH02_FOCUSED_LOCAL_IMPLEMENTATION; siguiente tarea P2-T18-BLOCKER-AUTH2-R13-R3 (revisión adversarial precommit), todavía no ejecutada; AUTH2-R13-R2-R1 reconcilió documentación-only el handoff sin mutar producto/test (fingerprint 14/14 idéntico): corrigió el header P2_T18= de CODEX_REPORT.md congelado desde antes de R6, las 3 repeticiones sin calificar de F_P2_T18_AUTH01_STATUS/AUTH02_STATUS, un bloque GLOBAL_HEAD_CURRENT=c047e9eb completo nunca actualizado desde Stage7-R2-RETRY-2, y la ambigüedad de CROSS_CHAT_PRIMARY_HANDOFF compartida con DELIGO_FULL_CONTEXT_LATEST.md (ahora único primary CODEX_REPORT.md, DELIGO_FULL_CONTEXT_LATEST.md reclasificado secundario); ningún hecho histórico reescrito; siguiente tarea P2-T18-BLOCKER-AUTH2-R13-R3 sin cambio de alcance; AUTH2-R13-R3 auditó adversarialmente el diff exacto de R13-R2 desde un harness fuera del repo (junction a node_modules + copia de src/, eliminado al cierre): releyó los 20 hunks completos (1 proxy + 10 Chat + 9 Push, exacto), re-derivó los 11 callers y el modelo fail-closed por lectura directa, y corrió una campaña de 19 mutantes — 17 detectados, 2 sobrevivieron: uno (/api/chat/cleanup agregado por error al selector) es un mutante equivalente confirmado (cleanup nunca lee la cookie resuelta, sin consecuencia observable, no es hallazgo); el otro (fetch() de subscribe en use-push-notifications.ts dejando de usar subscribeUrl) sobrevivió genuinamente — confirmado por código que el producto SÍ está correctamente implementado, pero use-push-notifications-static-contract.test.ts sólo verificaba la declaración de la variable, nunca que fetch() la consumiera, a diferencia de unsubscribeUrl/statusUrl; clasificado TEST_COVERAGE_GAP, nunca PRODUCT_DEFECT; P2_T18_BLOCKER_AUTH2_R13_R2/R13_R2_R1 preservados sin degradar; Git final idéntico HEAD=ORIGIN=a1579f11, fingerprint 14/14 y 17/17 idéntico, cero mutación real; BLOCKED_AUTH02_PRECOMMIT_ADVERSARIAL_FINDING; siguiente tarea P2-T18-BLOCKER-AUTH2-R13-R3-R1 (corrección focal exclusiva de test: agregar la verificación de fetch(subscribeUrl, mismo patrón ya usado para unsubscribeUrl), todavía no ejecutada); AUTH2-R13-R3-R1 cerró exactamente ese gap: reprodujo el mutante M9 fuera del repo en un harness temporal (junction a node_modules + copia de src/, eliminado al cierre) confirmando que sobrevivía con el test existente (29 pass/0 fail sin detectarlo), agregó una única assertion `expect(src).toContain("fetch(subscribeUrl")` dentro del test ya existente (sin crear ningún test/describe nuevo, 29 tests antes y después, 99→100 expect() calls) en `use-push-notifications-static-contract.test.ts`, mismo patrón exacto ya usado para `unsubscribeUrl`/`statusUrl`; replay del mismo mutante contra el test corregido en el harness confirmó detección (28 pass/1 fail, el único fallo es la nueva assertion); 0 archivos de producto tocados, 0 archivos de test adicionales tocados (fingerprint 7+6 idéntico antes/después); 117/117 focal AUTH02 PASS, ESLint/TSC/diff-check limpios; PASS_AUTH02_M9_TEST_COVERAGE_GAP_CLOSED; M3 preservado como mutante equivalente sin tocar proxy.ts; R13-R3 permanece históricamente BLOCKED, no se reescribe; Git final idéntico HEAD=ORIGIN=a1579f11, sin commit/push; siguiente tarea P2-T18-BLOCKER-AUTH2-R13-R3-RETRY (repetición completa desde cero de la revisión adversarial, no una continuación, para confirmar R13_R3_MUTANTS_SURVIVED=0 antes de autorizar R13-R4), todavía no ejecutada; AUTH2-R13-R3-RETRY recertificó DESDE CERO el diff completo sin confiar en ningún resultado histórico: re-derivó fileset (14/14), diff (20 hunks, 0 sin clasificar), modelo fail-closed, 11 callers, composición de URL, route handlers byte-frozen; la revisión de fuerza de test "desde cero" de los 7 archivos (no sólo la assertion de M9) encontró un SEGUNDO gap real, nunca atacado por los 19 mutantes originales: `savePushSubscription` en permission-prompt.tsx declara `url` pero ningún test verifica que `fetch(url` sea el call site real consumido; harness externo nuevo (distinto del de R13-R3/R13-R3-R1, eliminado al cierre) replicó fielmente los 19 mutantes originales — 18/19 no-equivalentes detectados, M9 ahora SÍ detectado (recertifica R13-R3-R1 como correcto), M3 reconfirmado equivalente por los 5 puntos exigidos — más 1 mutante nuevo sobre ese gap: sobrevivió (11 pass/0 fail); confirmado por código que el producto es correcto, TEST_COVERAGE_GAP real y aislado, nunca PRODUCT_DEFECT; por stop-on-objective no se completaron matrices 20/20-12/12 ni 117/294 frescos; P2_T18_BLOCKER_AUTH2_R13_R2/R13_R2_R1/R13_R3_R1 preservados sin degradar (el hallazgo es un gap DISTINTO de M9); Git final idéntico HEAD=ORIGIN=a1579f11, fingerprint 14/14 y 17/17 idéntico, cero mutación real del repo; BLOCKED_AUTH02_TEST_COVERAGE_GAP; siguiente tarea P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-R1 (corrección focal exclusiva de test: agregar la verificación de fetch(url dentro de savePushSubscription, mismo patrón ya usado para checkExistingPushSubscriptionStatus), todavía no ejecutada; AUTH2-R13-R3-RETRY-R1 cerró exactamente ese segundo gap: reprodujo el mutante M19-NEW fuera del repo en un harness temporal nuevo (junction a node_modules + copia de src/, eliminado al cierre) confirmando que sobrevivía con el test existente (11 pass/0 fail sin detectarlo), agregó una única assertion `expect(fnBody).toContain("fetch(url")` dentro del test ya existente (sin crear ningún test/describe nuevo, 11 tests antes y después, 22→23 expect() calls) en `permission-prompt-static-contract.test.ts`, mismo patrón exacto ya usado para `checkExistingPushSubscriptionStatus`; replay del mismo mutante contra el test corregido en el harness confirmó detección (10 pass/1 fail, el único fallo es la nueva assertion); 0 archivos de producto tocados, 0 archivos de test adicionales tocados incluido el de M9 (fingerprint 7+6 idéntico antes/después); 117/117 focal AUTH02 PASS, ESLint/TSC/diff-check limpios; PASS_AUTH02_M19_TEST_COVERAGE_GAP_CLOSED; M3 preservado como mutante equivalente sin tocar proxy.ts; el primer R13-R3-RETRY permanece históricamente BLOCKED, no se reescribe; durante la finalización se reconcilió también un marcador P2_T18= desactualizado en el header de CODEX_REPORT.md (arrastraba la era de R13-R3, nunca actualizado), sin crear micro-tarea adicional; Git final idéntico HEAD=ORIGIN=a1579f11, sin commit/push; siguiente tarea P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2 (repetición completa desde cero de la revisión adversarial — 20 mutantes: 19 originales + M19-NEW —, no una continuación, para confirmar 0 sobrevivientes válidos antes de autorizar R13-R4), todavía no ejecutada; AUTH2-R13-R3-RETRY-2 recertificó DESDE CERO el diff completo por última vez: gate crítico de 11 call sites con cobertura declaración+consumo confirmada 11/11 antes de mutar nada, harness externo nuevo (nunca reutilizado, eliminado al cierre) con los 20 mutantes (19 originales + M19-NEW) — 19/19 no-equivalentes detectados, M9 y M19-NEW ambos recertificados detectados, M3 reconfirmado equivalente por los 5 puntos exigidos, 0 sobrevivientes válidos; matriz de seguridad 20/20 y aceptación 12/12 re-evaluadas; focal fresco 117/117 PASS en primera corrida; regresión fresca en 3 tandas (listado literal recuperado de TEST_AUTHORITY.md, nunca de memoria): TANDA_1 163/163 PASS, pero TANDA_2 (DB real) dio 30/31 — 1 fallo decisivo en client-block-security.integration.test.ts (caso SEC-BLOCK-1, dispositivo compartido, esperado 201 recibido 500), archivo completamente ajeno al mecanismo actorFamily de AUTH02, con precedente documentado de flake transitorio en el mismo archivo (P2-T18-BLOCKER-AUTH2-R5); por regla explícita "no retry-to-green" no se re-ejecutó ni se investigó más, y TANDA_3 no se corrió (stop-on-objective); BLOCK exclusivamente por ese fallo de regresión ajeno — AUTH02 en sí (cobertura, mutación, seguridad, aceptación, focal, TANDA_1) quedó 100% verde; P2_T18_BLOCKER_AUTH2_R13_R2/R13_R2_R1/R13_R3_R1/R13_R3_RETRY_R1 preservados sin degradar; Git final idéntico HEAD=ORIGIN=a1579f11, fingerprint 14/14 y 17/17 idéntico, cero mutación real del repo; BLOCKED_AUTH02_FRESH_TEST_GATE; siguiente tarea P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R1 (investigación aislada, read-only primero, del único fallo de regresión, para clasificarlo flake vs. regresión real), todavía no ejecutada; AUTH2-R13-R3-RETRY-2-R1 investigó exclusivamente ese fallo sin corregir nada: confirmó estructuralmente 0 solapamiento con AUTH02 (proxy.ts nunca importado/invocado en client-block-security.integration.test.ts — el test llama al route handler de /api/pedidos directamente como función, nunca por Edge Middleware); comparó contra R5 sin sobre-extender la coincidencia de archivo (test/caso/mecanismo distintos — R5 usa Promise.all de logins realmente concurrentes diseñado para forzar P2002, éste usa awaits secuenciales sin concurrencia diseñada); ejecutó exactamente 3 corridas diagnósticas sin repetir ninguna: D1 (caso aislado) FALLÓ con P2028 y 25s de latencia anómala, D2 (archivo completo) PASÓ 19/19, D3 (TANDA_2 exacta) PASÓ 31/31; el patrón mixto no encajó limpio en ningún caso A/B/C de la matriz de interpretación, clasificado Caso E INCONCLUSIVE_EXTERNAL_DB_INSTABILITY, sin forzar un PASS pese a la fuerte evidencia circunstancial de inestabilidad transitoria de conexión/motor; 0 mutación de source/test, 14/14 y 17/17 fingerprint idéntico, cleanup automático confirmado sin residuales; BLOCKED_SEC_BLOCK_1_CLASSIFICATION_INCONCLUSIVE; R13-R3-RETRY-2 permanece históricamente BLOCKED, no se reescribe; siguiente tarea P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R2 (gate de regresión fresca de certificación, no diagnóstica: TANDA_2 una vez, si PASA TANDA_3 una vez, sin retry-to-green, reutilizando por identidad de bytes toda la evidencia ya certificada), todavía no ejecutada; AUTH2-R13-R3-RETRY-2-R2 ejecutó exactamente ese gate de certificación: confirmó continuidad de bytes 14/14+17/17+test-objetivo idénticos a R1, preservó íntegra toda la evidencia de RETRY-2 sin re-ejecutar nada; C1 (TANDA_2 exacta, una única corrida sin retry) FALLÓ 30/31 — el MISMO caso exacto SEC-BLOCK-1, segunda vez consecutiva, con latencia nuevamente anómala (26786ms); por regla explícita "no retry-to-green" se detuvo de inmediato sin correr TANDA_3, sin aislar el test, sin investigar más; fingerprint 14/14+17/17+test-objetivo confirmado idéntico antes/después, 0 mutación de source/test; BLOCKED_FRESH_TANDA_2_CERTIFICATION_FAILURE; R13-R3-RETRY-2 y R13-R3-RETRY-2-R1 permanecen históricamente BLOCKED/INCONCLUSIVE, no se reescriben — el diff de AUTH02 en sí sigue 100% verde; siguiente tarea P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R2-R1 (disposición aislada del segundo fallo consecutivo, probablemente una decisión de producto/proceso con el usuario dado que dos intentos de certificación ya fallaron el mismo caso); AUTH2-R13-R3-RETRY-2-R2-R1 (read-only, disposición) determinó esa disposición sin corregir nada: trazó completo el path productivo /api/pedidos para el caso exacto de SEC-BLOCK-1 (sin bloqueo, sin mesa, sin Idempotency-Key), confirmando que la única transacción interactiva alcanzada (T1, pedidos/route.ts:1493) es mínima (1 lectura + 1 update + 1 create, sin trabajo no-DB dentro) y que P2028 no tiene ningún manejo/retry explícito — cae directo al catch-all genérico a 500; confirmó por documentación local (node_modules/@prisma/client) los defaults de Prisma 6 nunca sobreescritos (maxWait=2000/timeout=5000); comparó los 3 fallos frescos (RETRY-2 original/resB/12878ms, R1-D1/resA/25144ms/P2028, R2-R2-C1/resB/26786ms) contra 2 controles limpios (D2 19/19, D3 31/31): el dato decisivo es que el fallo AISLADO (D1, sin ningún otro archivo corriendo) también reprodujo el mismo patrón, descartando la contención entre archivos de TANDA_2 como causa necesaria; recuperó contexto adicional YA EXISTENTE en el repo (harness de carga load-tests/runner/pg-metrics.ts que ya instrumenta conexiones contra la misma DB de TESTING, y el resultado de carga más reciente contra PRODUCCIÓN con p95=389ms/0 fallos 5xx, mostrando que la infraestructura del producto en general no exhibe este orden de magnitud de latencia); encontró como hallazgo secundario NO causal un mock.module() sin scope en session-login-atomicity.integration.test.ts (riesgo de higiene de test real, pero estructuralmente incapaz de producir P2028 con latencia de segundos); seleccionó disposición EXTERNAL_TESTING_DB_RELIABILITY_LIMITATION_REQUIRES_NEW_CERTIFICATION_AUTHORITY (confianza MEDIA), congelando las características de una base de TESTING dedicada sin provisionar nada; PASS_REPEATED_SEC_BLOCK_1_FAILURE_DISPOSITION_FROZEN — PASS significa "disposición determinada", NO "AUTH02 puede commitearse" (AUTH02_SAFE_FOR_EXACT_LOCAL_COMMIT=NO, R13_R4_AUTHORIZED=NO se mantienen); R13-R3-RETRY-2/R13-R3-RETRY-2-R1/R13-R3-RETRY-2-R2 permanecen históricamente BLOCKED, no se reescriben; 0 mutación de source/test, fingerprint 14/14+17/17+test-objetivo idéntico; Git final idéntico HEAD=ORIGIN=a1579f11; siguiente tarea P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R2-R1A ("DB-BACKED REGRESSION AUTHORITY STABILIZATION — DEDICATED TESTING DATABASE", una decisión de producto/proceso del usuario, no otra certificación puramente técnica); AUTH2-R13-R3-RETRY-2-R2-R1A (reconciliación de reportes/autoridad únicamente, 0 ejecución de tests, 0 mutación de source/test) recibió esa decisión: el usuario difirió explícitamente la DB de TESTING dedicada y decidió continuar con la infraestructura existente para dejar de gastar etapas en el mismo fallo puntual; verificó los 6 gates A-F sobre la autoridad ya persistida (14 paths candidatos; 11/11+20 mutantes/19 no-equivalentes/0 sobrevivientes+seguridad 20/20+aceptación 12/12+focal 117/117+TANDA_1 163/163; AUTH02_CAUSAL=NO confirmado estructuralmente; evidencia PASS y FAIL sobre los mismos bytes; el fallo reproducido incluso en aislamiento total; 0 fix de producto/test identificado) — los 6 PASS; aceptó una excepción de infraestructura estrechamente acotada (EX-P2-T18-SEC-BLOCK-1-P2028, sólo este caso exacto, no permanente, sin tocar el test en código) y registró la deuda diferida F-P2-TESTINFRA-01 (revisit P2-T10); formuló explícitamente sin green falso — nunca afirmó "TANDA_2 31/31" ni "294/294 PASS"; AUTH02 queda PRECOMMIT_CERTIFIED_WITH_TEMP_TESTING_INFRA_EXCEPTION, R13-R4 AUTORIZADO (`AUTH02_SAFE_FOR_EXACT_LOCAL_COMMIT=SI`, `R13_R4_AUTHORIZED=SI`); congeló el contrato de commit de R13-R4 (exactamente los 14 paths de AUTH02, subject "fix: scope shared auth requests by actor family", 0 paths de reportes/ajenos); R13-R3-RETRY-2/R13-R3-RETRY-2-R1/R13-R3-RETRY-2-R2/R13-R3-RETRY-2-R2-R1 permanecen históricos sin reescribir; Git final idéntico HEAD=ORIGIN=a1579f11, fingerprint 14/14+1 idéntico, cero mutación real; PASS_USER_PROCESS_DECISION_DEDICATED_DB_DEFERRED_AUTH02_PRECOMMIT_ACCEPTED_WITH_SINGLE_INFRA_EXCEPTION; siguiente tarea P2-T18-BLOCKER-AUTH2-R13-R4 (commit local exacto de los 14 paths congelados); AUTH2-R13-R4 ejecutó exactamente esa conversión a commit sin mutar ni un byte: rehash pre-stage 14/14 idéntico a la autoridad certificada, diff completo sin hunks nuevos/removidos desde certificación, M9/M19 confirmados presentes, staging explícito con `git add --` de exactamente los 14 paths (nunca `.`/`-A`/`-u`/`commit -a`), índice auditado (14 paths exactos, 0 reportes/root 32/schema/migración/package), probado staged==worktree==certificado 14/14 vía blob hashing directo; un único commit `fix: scope shared auth requests by actor family` (`fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f`, parent `a1579f11e79a41b90c6df4d2e8573ca9a669b856`); recertificado postcommit desde los objetos Git sin confiar sólo en el exit code — 14/14 blobs commiteados idénticos a los certificados, diff commiteado revisado completo sin ningún path ajeno, 0 diff restante en el worktree para los 14 paths; AHEAD=1/BEHIND=0 contra origin, que permanece exactamente en a1579f11 — sin push, sin deploy, sin Railway, sin DB real, sin navegador; PASS_AUTH02_EXACT_LOCAL_COMMIT; registró (sin ejecutar nada) la nueva prioridad de roadmap del usuario tras el cierre de P2-T18 (P2-T06 primero, luego P2-T14 si es dependency-safe — ver nota de prioridad al final de este archivo); siguiente tarea P2-T18-BLOCKER-AUTH2-R13-R5 (postcommit prepush exact blob review); AUTH2-R13-R5 recertificó de forma INDEPENDIENTE el commit `fe0e11d0` leyendo los objetos Git directamente, sin confiar en el resumen de R13-R4 y sin re-ejecutar ninguna batería de tests (0 test runs, 0 acceso a DB): derivó el fileset commiteado por 2 métodos Git (`diff-tree`, `show --name-only`) — ambos de acuerdo en 14 paths exactos, 0 rutas prohibidas; derivó 14 blob IDs vía `git ls-tree HEAD` — 14/14 idénticos a los certificados por R13-R4; leyó los 14 blobs directamente de HEAD confirmando el contrato de selector de proxy.ts (10 entradas exactas), el contrato de Chat/Push, y las protecciones M9/M19; revisó el diff commiteado completo (33 hunks, 0 sin clasificar/incidental); confirmó 0 diferencia de working tree contra HEAD para los 14 paths; preservó por identidad de blob toda la autoridad de seguridad/mutación/aceptación/focal y la excepción temporal EX-P2-T18-SEC-BLOCK-1-P2028 sin reabrir nada; Git final idéntico HEAD=fe0e11d0/ORIGIN=a1579f11 (sin cambio), AHEAD=1/BEHIND=0; PASS_AUTH02_POSTCOMMIT_PREPUSH_EXACT_BLOB_REVIEW, R13-R6 autorizado; siguiente tarea P2-T18-BLOCKER-AUTH2-R13-R6 (fresh prepush + push + deploy TESTING); AUTH2-R13-R6 ejecutó ese gate final lean: continuidad de blobs 14/14 contra R13-R5, focal fresco 117/117 en una única corrida, ESLint limpio, TSC 31/24 idéntico a la baseline vigente (0 diagnóstico nuevo en los 14 paths de AUTH02), git show --check y npm run build limpios; confirmó read-only Railway amiable-rejoicing/TESTING sin deploy concurrente, health prepush limpio; ejecutó exactamente un `git push origin testing-codex` (a1579f1..fe0e11d, sin --force); observó read-only el autodeploy Git-triggered — DeliGO Copy y chat en vivo ambos SUCCESS en fe0e11d0 exacto (confirmado desde metadata real de Railway); chat en vivo autodeployó pese a 0 paths propios cambiados, consistente con el patrón ya visto en R6/R12; health/logs postdeploy limpios, 0 errores materiales; PASS_AUTH02_TESTING_PUSH_DEPLOY_CERTIFIED, AUTH02 ahora desplegado en TESTING, R13-R7 autorizado; preservó sin ejecutar nada las prioridades post-P2-T18 del usuario (auditoría Producción-vs-testing-codex, luego P2-T06/P2-T14); siguiente tarea P2-T18-BLOCKER-AUTH2-R13-R7 (replay completo de navegador real desde cero, 18/18), todavía no ejecutada
position 11: P2-T06 = NOT_STARTED (PRIORIDAD DEL USUARIO tras cierre de P2-T18 — registrada en P2-T18-BLOCKER-AUTH2-R13-R4, 2026-08-29, reafirmada en R13-R6 — ver "PRIORIDAD DE ROADMAP DEL USUARIO" al final de este archivo; posiciones numéricas SIN renumerar por regla explícita NO_UNVERIFIED_ROADMAP_REORDER=SI hasta que el gate de dependencia de T14 se audite en su propia etapa. ACTUALIZACIÓN 2026-08-29, post auditoría de sync Production-vs-testing-codex: el usuario detuvo explícitamente cualquier avance automático — P2_T06_SCOPE_DEFINED=NO, P2_T06_EXECUTION_AUTHORIZED=NO, P2_T06_NEXT_AUTOMATIC_START=NO. La frase de negocio "configuración empleados/mozo/terminal" registrada abajo es sólo prioridad/intención, NO un contrato técnico suficiente — no inventar su alcance de ahí. Requiere un prompt nuevo del usuario que defina el alcance real antes de cualquier ejecución. Auditoría de sync completa y consolidada en codex-reports/PRODUCTION_SYNC_AUDIT.md — NO ejecutada (sync sigue pendiente de fases futuras). ACTUALIZACIÓN 2026-08-29 (PRODUCTION-SYNC-R1): coreografía exacta de 7 fases congelada en codex-reports/PRODUCTION_SYNC_R1.md — planificación completa, CERO mutación, NEXT_TASK_ID=PRODUCTION-SYNC-R2 READY_NOT_EXECUTED. ACTUALIZACIÓN 2026-08-29 (PRODUCTION-SYNC-R2): primera mutación real ejecutada — 4/4 secretos provisionados y verificados en Production (codex-reports/PRODUCTION_SYNC_R2.md), preDeployCommand diferido por semántica de deploy no probada, deploy NO disparado. NEXT_TASK_ID=PRODUCTION-SYNC-R3 READY_NOT_EXECUTED (26 migraciones no destructivas + activación de preDeployCommand). P2-T06 sigue sin iniciar, sin alcance, sin autorización — el sync de Production tiene prioridad y aún no fue completado.)
position 12: P2-T07 = NOT_STARTED
position 13: P2-T08 = NOT_STARTED
position 14: P2-T09 = NOT_STARTED
position 15: P2-T14 = NOT_STARTED (PRIORIDAD DEL USUARIO tras P2-T06, SI dependency-safe — gate de dependencia pendiente de auditar al inicio de T14, ver nota al final de este archivo)
position 16: P2-T15 = NOT_STARTED
position 17: P2-T17 = NOT_STARTED
position 18: P2-T10 = NOT_STARTED
             P2-T19 = OPTIONAL_DEFERRED

ROADMAP_PERMANENTLY_REORDERED=NO
```

## P2-T05 — estado interno detallado

```
Stage1..Stage4F=PASS
POST-STAGE4-HARDENING-PLAN=PASS
H1 (F19+F20)=RESOLVED_H1_COMMITTED_AND_POSTCOMMIT_CERTIFIED
  commit: c66df8d
H2 (F21)=RESOLVED_H2_COMMITTED_POSTCOMMIT_AND_TESTING_DEPLOY_CERTIFIED
  commit: 47a630e1cbb1c2fe2a3dcedc739748f67f896952
H3 precheck (real-browser F18 repro)=COMPLETED_REAL_RUNTIME_REPRODUCTION
H3B (F23+F15, root cause de F18)=RESOLVED_AND_RUNTIME_CERTIFIED
  commit: 9394b605611deb4f10b8028a41a8bd19f7687314
  pushed + deployed TESTING + real Chrome confirmation
H4 (F22)=COMPLETED_AND_CERTIFIED
  amended commit: e172cd7ac8245d32db89f96cf6c86ca31bb43cf2 (pushed + TESTING deployed)
  replaced local H4: f5571f14e73155f7a4828dfe014230b95c795115
  parent/origin: 9394b605611deb4f10b8028a41a8bd19f7687314
  correction: helper + logout/mozo/salon tests incorporated atomically
  precommit correction review PASS; post-amend full recertification PASS
FINAL_ACCUMULATED_REGRESSION=PASS
  34/34 archivos, 523/523 tests aislados, combined normal y combined reversed;
  sin exclusiones ni nuevos findings bloqueantes
```

## Gate de cierre P2-T05=CLOSED (requiere TODOS)

```
- F15 resuelto                          [SI]
- F18 resuelto                          [SI]
- F19 resuelto                          [SI]
- F20 resuelto                          [SI]
- F21 resuelto                          [SI]
- F22 resuelto                          [SI]
- Stage4F sigue PASS (sin relitigar salvo evidencia nueva)
- 0 hallazgos bloqueantes nuevos introducidos por el hardening
- regresión acumulada final: PASS, 0 fail, orden normal e invertido, sin exclusiones
- deployment TESTING alineado al commit final del hardening
- Git alineado (HEAD=origin, AHEAD=0 BEHIND=0)
- cleanup de cualquier fixture usado en H3/H3B verificado limpio  [SI, ya verificado]
- P2-T13 permanece separado, no absorbido; su estado actual se registra abajo
```

Nota: el escenario opcional de sweep 404/410 real del proveedor Push NO es
bloqueante para el cierre — puede quedar como deuda documentada
indefinidamente sin fecha (`OPTIONAL_404_410_RUNTIME_REQUIRED_FOR_P2_T05_CLOSEOUT=NO`).

## Orden de ejecución del hardening (definido en POST-STAGE4-HARDENING-PLAN)

```
H1(F19+F20) -> H2(F21) -> H3(F18+F15) -> H4(F22) -> regresión final
acumulada -> deploy/smoke final -> P2-T05 closeout
```

## P2-T05 FINAL CLOSEOUT

```
P2_T05_FINAL_ACCUMULATED_REGRESSION=PASS
P2_T05_FINAL_TESTING_CHECKPOINT=PASS
FINAL_TESTING_DEPLOY=PASS
FINAL_TESTING_BOUNDED_SMOKE=PASS
P2_T05_FINAL_CLOSEOUT=PASS
P2_T05=CLOSED
P2_T05_CLOSED=SI
POST_P2_T05_NEXT_TASK_ID=P2-T13
POST_P2_T05_NEXT_TASK_TITLE=same-owner same-endpoint re-subscription race
POST_P2_T05_NEXT_TASK_STATUS=STAGE1_PASS_AT_CLOSEOUT
NEXT_TASK_ID=P2-T13
NEXT_TASK_TITLE=same-owner same-endpoint re-subscription race
```

El push fast-forward único, autodeploy exacto, smoke final TESTING y
closeout adversarial ya pasaron. P2-T13 permanece separado y nunca se ejecutó
como parte de ese cierre; su estado actual se registra en el bloque Stage 2.

## P2-T13 — Stage 7 (CLOSED)

```
P2_T13_STAGE1_AUDIT_DESIGN=PASS
P2_T13_STAGE2_LOCAL_IMPLEMENTATION=PASS
P2_T13_STAGE3_PRECOMMIT_REVIEW=PASS
P2_T13_STAGE4_LOCAL_COMMIT=PASS
P2_T13_STAGE5_POSTCOMMIT_PREPUSH_RECERTIFICATION=PASS
P2_T13_STAGE6_TESTING_RUNTIME_CERTIFICATION=PASS
P2_T13_STAGE7_FINAL_CLOSEOUT=PASS
P2_T13=CLOSED
P2_T13_CLOSED=SI
P2_T13_IMPLEMENTATION_STATUS=PUSHED_TESTING_RUNTIME_CERTIFIED
P2_T13_FINAL_STATUS=CLOSED_AFTER_ATOMIC_CAS_POSTCOMMIT_AND_REAL_POSTGRES_HTTP_CERTIFICATION
T13_RACE_A_STATUS=ALREADY_RESOLVED_BY_P2_T05
T13_RACE_B_STATUS=RESOLVED_P2_T13_REAL_POSTGRES_HTTP_CERTIFIED
T13_RACE_C_STATUS=SAFE_MODEL_C1_PRESERVED
PUSHED_COMMIT=44b9da06ff2fa099cf7eb5fb971b13454f33f308
HEAD=origin AHEAD=0 BEHIND=0
DELIGO_COPY_DEPLOY_STATUS=SUCCESS
CHAT_DEPLOY_STATUS=SUCCESS
DB_T13_03_CONCURRENCY_ROUNDS=10/10 PASS, 0 rechazos, 0 torn, FINAL_ALWAYS_V2
HTTP_T13_STALE_UNSUBSCRIBE_PRESERVES_V2=SI
HTTP_T13_CURRENT_UNSUBSCRIBE_REMOVES_V2=SI
REAL_WEBPUSH_SENT=NO
P2_T13_CLOSEOUT=SI
```

P2-T05 permanece CLOSED, sin alteración. P2-T13 completó Stage 1 a Stage 7:
el commit `44b9da0` fue publicado a `origin/testing-codex`, desplegado
exitosamente en TESTING (DeliGO Copy + chat en vivo), certificado en
runtime real contra PostgreSQL (10/10 rondas concurrentes, resultado
siempre V2) y un flujo HTTP real (subscribe/rotate/stale-unsubscribe/
current-unsubscribe), y cerrado adversarialmente en Stage 7 tras confrontar
toda la cadena contra Git real, findings, decisiones/invariantes, test
authority, deploy history y roadmap. Único hallazgo no-bloqueante: un gap
de trazabilidad documental del archivo de Stage1 (ver `FINDINGS.md` y
`codex-reports/CURRENT_TASK.md` §HISTORICAL_RECONSTRUCTION). Siguiente
tarea canónica: **P2-T12 — TerminalOperativa.pushSubscription Cleanup**
(NOT_STARTED, primer ítem ejecutable tras P2-T02 pausado y P2-T05/P2-T13
cerrados).

## P2-T12 — Stage 1 (audit/design)

```
P2_T12_STAGE1_AUDIT_DESIGN=PASS
P2_T12=STAGE1_AUDIT_PASS_DROP_INERT_COLUMN_IMPLEMENTATION_REQUIRED
P2_T12_DISPOSITION=DROP_INERT_COLUMN_IMPLEMENTATION_REQUIRED
TERMINAL_PUSH_COLUMN_EXISTS=SI
TERMINAL_PUSH_ZERO_PRODUCT_READERS_CURRENT=SI
TERMINAL_PUSH_ZERO_PRODUCT_WRITERS_CURRENT=SI
TERMINAL_OPERATIVA_ACTIVE_PUSH_RECIPIENT=NO
TERMINAL_PUSH_PRODUCT_INTENT=A_NO_PUSH_TERMINAL
T12_SUBSUMED_BY_T05=NO
P2_T12_SCHEMA_CHANGE_REQUIRED=SI
P2_T12_MIGRATION_REQUIRED=SI
P2_T12_DATA_BACKFILL_REQUIRED=NO
NEXT_TASK_ID=P2-T12-STAGE2
NEXT_TASK_TITLE=DEAD COLUMN LOCAL SCHEMA/MIGRATION REMOVAL + REGRESSION TESTS
NEXT_TASK_STATUS=READY
```

Auditoría desde cero (no asumió el título histórico): el campo existe
desde el primer commit del feature terminal, nunca tuvo writer ni reader
en toda la historia de git, cero send-path, sin ownerType normalizado, sin
UI/flujo cliente, exclusión deliberada y documentada por P2-T05 (no
accidental). Disposition: `DROP_INERT_COLUMN` — reduce deuda de schema sin
romper ningún flujo.

## P2-T12 — Stage 2 (local implementation)

```
P2_T12_STAGE2_LOCAL_IMPLEMENTATION=PASS
P2_T12=STAGE2_DEAD_COLUMN_REMOVAL_LOCAL_AWAITING_PRECOMMIT_ROLLOUT_REVIEW
T12_SCHEMA_FIELD_REMOVED=SI
T12_NEW_MIGRATION_COUNT=1 (20260826230000_drop_terminal_operativa_push_subscription)
OLD_PRISMA_CLIENT_CAN_SELECT_DROPPED_TERMINAL_PUSH_COLUMN=SI
T12_OLD_APP_AFTER_DROP_EXPECTED_COMPATIBILITY=FAIL_RISK
T12_DEPLOYMENT_STRATEGY=STAGE3_MUST_RESOLVE_BEFORE_COMMIT
PRISMA_VALIDATE_T12_STAGE2=PASS
PRISMA_GENERATE_T12_STAGE2=PASS
BUILD_T12_STAGE2=PASS
TSC_NEW_DIAGNOSTICS=0
NEXT_TASK_ID=P2-T12-STAGE3
NEXT_TASK_TITLE=PRE-COMMIT DESTRUCTIVE MIGRATION / ROLLING-DEPLOY COMPATIBILITY REVIEW
NEXT_TASK_STATUS=READY
```

Removido `pushSubscription` de `TerminalOperativa` en el schema (1 línea)
y creada una migración `DROP COLUMN IF EXISTS` local, no aplicada a
ninguna DB. Hallazgo material para Stage3: 2 de 11 call-sites productivos
(`activar/route.ts`, `operaciones-terminal-auth.ts`) usan `update()` sin
`select` explícito — el Prisma Client viejo pediría la columna eliminada
en su `RETURNING`, arriesgando la ventana de rolling-deploy si el DROP se
aplica junto con el schema removal en un solo commit. Stage3 debe decidir
adversarialmente entre ampliar scope (agregar `select`) o exigir un
rollout de dos fases.

## P2-T12 — Stage 3 (rollout decision: TWO-PHASE)

```
P2_T12_STAGE3_PRECOMMIT_ROLLOUT_REVIEW=PASS
P2_T12=STAGE3_TWO_PHASE_CONTRACT_REQUIRED_READY_FOR_PHASE1_PREPARATION
T12_DEPLOYMENT_STRATEGY=TWO_PHASE_CONTRACT_DEPLOY_REQUIRED
T12_STAGE2_COMBINED_DIFF_SAFE_TO_COMMIT_AS_ONE=NO
T12_SINGLE_DEPLOY_SAFETY=FAIL
OLD_PRISMA_CLIENT_CAN_REQUEST_DROPPED_FIELD=SI
T12_OLD_INSTANCE_MAY_SERVE_DURING_PREDEPLOY=SI
T12_SELECT_PATCH_REQUIRED=NO
NEXT_TASK_ID=P2-T12-STAGE4A
NEXT_TASK_TITLE=PHASE1 CONTRACT LOCAL PREPARATION
NEXT_TASK_STATUS=READY
```

Auditoría adversarial demostró mecánicamente (sin DB, vía el tipo
`$TerminalOperativaPayload.scalars` del cliente Prisma generado) que 2 de
los 11 call-sites productivos (`activar/route.ts:142`,
`operaciones-terminal-auth.ts:209`) usan `update()` sin `select` — el
cliente viejo desplegado pediría la columna eliminada en su `RETURNING`.
Sin evidencia de que Railway drene la instancia vieja antes del
`preDeploy`, y confirmado que agregar `select` a un commit nuevo no puede
proteger un proceso ya en ejecución, el diff combinado de Stage2
(schema+migración) NO es seguro de commitear como una sola unidad — debe
partirse en Phase1 (schema-only, sin migración) y Phase2 (DROP físico,
commit separado, después de certificar que ninguna instancia vieja sigue
sirviendo). El schema removal de Stage2 ya ES la Phase1 correcta; la
migración ya escrita ya ES la Phase2 correcta — sólo deben viajar
separadas.

## P2-T12 — Stage 4A (Phase1 local preparation)

```
P2_T12_STAGE4A_PHASE1_LOCAL_PREPARATION=PASS
P2_T12=PHASE1_SCHEMA_ONLY_LOCAL_PREPARED_AWAITING_PRECOMMIT_REVIEW
T12_PHASE1_TRACKED_DIFF_FILE_COUNT=1 (sólo prisma/schema.prisma)
T12_PHASE1_NEW_MIGRATION_COUNT=0
T12_PHASE2_ORIGINAL_MIGRATION_SHA256=cbd4a4684aceb41895f3d0b47335147c5470c80a90d2c434ecf51bf0ca43623d
T12_PHASE1_GENERATED_CLIENT_HAS_TERMINAL_PUSH_FIELD=NO
T12_PHASE1_TERMINAL_QUERY_CALLSITE_COUNT=11
PRISMA_VALIDATE_T12_PHASE1=PASS
PRISMA_GENERATE_T12_PHASE1=PASS
BUILD_T12_PHASE1=PASS
TSC_NEW_DIAGNOSTICS=0
NEXT_TASK_ID=P2-T12-STAGE4B
NEXT_TASK_TITLE=PHASE1 SCHEMA-ONLY PRE-COMMIT ADVERSARIAL REVIEW
NEXT_TASK_STATUS=READY
```

La migración `DROP COLUMN` de Stage2 (nunca tracked) fue retirada por
completo del árbol activo — preservada como blueprint exacto+hash en
`codex-reports/CURRENT_TASK.md` para recrearla byte-idéntica en Phase2. El
único diff tracked que queda es la remoción de 1 línea en
`prisma/schema.prisma`. El cliente Prisma regenerado confirma
mecánicamente (`$TerminalOperativaPayload.scalars`, sin DB) que
`pushSubscription` ya no existe en la superficie del cliente — protegiendo
las 11 queries reales por igual, sin tocar ningún archivo TS.

## P2-T12 — Stage 4B (Phase1 precommit certified)

```
P2_T12_STAGE4B_PHASE1_PRECOMMIT_REVIEW=PASS
P2_T12=PHASE1_SCHEMA_ONLY_PRECOMMIT_CERTIFIED_READY_FOR_LOCAL_COMMIT
P2_T12_PHASE1_COMMIT_ALLOWLIST=prisma/schema.prisma
P2_T12_PHASE1_COMMIT_FILE_COUNT=1
P2_T12_PHASE1_PROPOSED_COMMIT_SUBJECT=chore: remove dead terminal push field
T12_STAGE4B_PHASE1_ROLLOUT_SAFETY=PASS
T12_STAGE4B_PHASE2_ALLOWED_NOW=NO
NEXT_TASK_ID=P2-T12-STAGE4C
NEXT_TASK_TITLE=PHASE1 SCHEMA-ONLY EXACT LOCAL COMMIT
NEXT_TASK_STATUS=READY
```

Revisión adversarial: no aceptó el `READY` de Stage4A como autorización
automática — re-derivó desde cero los 11 call-sites, re-confirmó
mecánicamente (sin DB) que el cliente Prisma regenerado ya no puede pedir
`pushSubscription`, re-ejecutó Prisma validate/generate, TSC (0 nuevos),
build y el test de terminal ejecutable sin DB (26/26). Confirmó que la
migración DROP de Stage2 sigue completamente fuera del árbol activo, con
su blueprint (SQL + SHA-256) intacto para Phase2. El diff sigue siendo
exactamente 1 línea en `prisma/schema.prisma` — certificado listo para un
único commit local schema-only. Detalle completo en
`codex-reports/CURRENT_TASK.md`.

## P2-T12 — Stage 4C (Phase1 local commit)

```
P2_T12_STAGE4C_PHASE1_LOCAL_COMMIT=PASS
P2_T12=PHASE1_SCHEMA_ONLY_LOCAL_COMMIT_COMPLETE_AWAITING_POSTCOMMIT_PREPUSH_REVIEW
F_P0_05_STATUS=TWO_PHASE_ROLLOUT_PHASE1_COMMITTED_LOCAL
T12_PHASE1_COMMIT_HASH=bebd36c841f588fc9e4c74099e38a95d37d58982
T12_PHASE1_COMMIT_PARENT=44b9da06ff2fa099cf7eb5fb971b13454f33f308
T12_PHASE1_COMMIT_SUBJECT=chore: remove dead terminal push field
T12_STAGE4C_COMMIT_FILE_COUNT=1
T12_STAGE4C_COMMIT_ONLY_PATH=prisma/schema.prisma
T12_STAGE4C_COMMITTED_SCHEMA_FIELD_ABSENT=SI
T12_STAGE4C_ACTIVE_DROP_MIGRATION_PRESENT=NO
T12_STAGE4C_PHASE2_BLUEPRINT_PRESENT=SI
T12_STAGE4C_QUICK_TERMINAL_TEST=26 pass / 0 fail / 0 error
PRISMA_VALIDATE_T12_STAGE4C=PASS
PUSH=NO
DEPLOY=NO
RAILWAY_MUTATION=NO
P2_T12_CLOSED=NO
NEXT_TASK_ID=P2-T12-STAGE4D
NEXT_TASK_TITLE=PHASE1 POST-COMMIT / PRE-PUSH EXACT-BLOB REVIEW
NEXT_TASK_STATUS=READY
```

Phase1 fue committeada localmente en un commit schema-only. Phase2 sigue
prohibida hasta la revisión post-commit, push/deploy TESTING y certificación
del drain de instancias antiguas.

## P2-T12 — Stage 4D (Phase1 post-commit/pre-push review)

```
P2_T12_STAGE4D_PHASE1_POSTCOMMIT_PREPUSH_REVIEW=PASS
P2_T12=PHASE1_POSTCOMMIT_CERTIFIED_READY_FOR_TESTING_PUSH_DEPLOY
F_P0_05_STATUS=TWO_PHASE_ROLLOUT_PHASE1_POSTCOMMIT_CERTIFIED
T12_PHASE1_COMMIT_HASH=bebd36c841f588fc9e4c74099e38a95d37d58982
T12_PHASE1_COMMIT_PARENT=44b9da06ff2fa099cf7eb5fb971b13454f33f308
T12_PHASE1_COMMIT_SUBJECT=chore: remove dead terminal push field
T12_STAGE4D_COMMIT_FILE_COUNT=1
T12_STAGE4D_COMMIT_ONLY_PATH=prisma/schema.prisma
T12_STAGE4D_PARENT_FIELD_PRESENT=SI
T12_STAGE4D_COMMIT_FIELD_ABSENT=SI
T12_STAGE4D_GENERATED_CLIENT_HAS_PUSH_SCALAR=NO
T12_STAGE4D_TERMINAL_QUERY_CALLSITE_COUNT=11
T12_STAGE4D_TERMINAL_TEST=26 pass / 0 fail / 0 error
PRISMA_VALIDATE_T12_STAGE4D=PASS
PRISMA_GENERATE_T12_STAGE4D=PASS
T12_STAGE4D_BUILD=PASS
T12_STAGE4D_COMMIT_CONTAINS_T12_MIGRATION=NO
T12_STAGE4D_PHASE2_BLUEPRINT_COMPLETE=SI
T12_STAGE4D_PHASE2_ALLOWED_NOW=NO
PUSH=NO
DEPLOY=NO
P2_T12_CLOSED=NO
NEXT_TASK_ID=P2-T12-STAGE4E
NEXT_TASK_TITLE=PHASE1 EXACT PUSH + TESTING DEPLOY / OLD-INSTANCE DRAIN + CONTRACT RUNTIME CERTIFICATION
NEXT_TASK_STATUS=READY
```

Stage4D auditó los blobs del commit y autoriza el siguiente pre-push/deploy
TESTING. No se hizo push; Phase2 sigue bloqueada.

## P2-T12 — Stage 4E (Phase1 testing deploy + runtime certification)

```
P2_T12_STAGE4E_PHASE1_TESTING_CERTIFICATION=PASS
P2_T12=PHASE1_TESTING_DEPLOYED_DRAIN_CERTIFIED_READY_FOR_PHASE2_PREPARATION
F_P0_05_STATUS=TWO_PHASE_ROLLOUT_PHASE1_TESTING_CERTIFIED
T12_PHASE1_COMMIT_HASH=bebd36c841f588fc9e4c74099e38a95d37d58982
T12_PHASE1_PUSH_COUNT=1
T12_TESTING_DEPLOYMENT_COMMIT_EXACT=SI
T12_TESTING_DEPLOYMENT_STATUS=SUCCESS
T12_PHASE1_OLD_INSTANCE_DRAIN_CERTIFIED=SI
T12_OLD_INSTANCE_STATE=REMOVED
T12_CURRENT_INSTANCE_STATE=RUNNING
T12_PHYSICAL_COLUMN_PRE=SI
T12_PHYSICAL_COLUMN_POST=SI
T12_T12_DROP_APPLIED=NO
T12_TERMINAL_RUNTIME_SMOKE=PASS
T12_TERMINAL_RUNTIME_ACTIVATION=PASS
T12_TERMINAL_RUNTIME_AUTH=PASS
T12_TERMINAL_RUNTIME_REVOCATION=PASS
T12_TERMINAL_RUNTIME_NEGATIVE_CHECK=PASS
T12_TERMINAL_PUSH_SEND=NO
T12_FIXTURE_CLEANUP=PASS
T12_FIXTURE_REMAINDER=0
T12_HTTP_HEALTH=PASS
P2_T12_CLOSED=NO
T12_PHASE2_ALLOWED_AFTER_STAGE4E=SI
NEXT_TASK_ID=P2-T12-STAGE5A
NEXT_TASK_STATUS=READY
```

Stage4E publicó exactamente una vez el commit de Phase1 a `testing-codex`,
observó el autodeploy de TESTING y confirmó el contrato de dos fases. La
columna física sigue presente; Phase2 queda permitida para preparación futura,
pero no fue ejecutada.

## P2-T12 — Stage 5A (Phase2 local migration recreation)

```
P2_T12_STAGE5A_PHASE2_LOCAL_MIGRATION_RECREATION=PASS
P2_T12=PHASE2_DROP_MIGRATION_LOCAL_RECREATED_AWAITING_PRECOMMIT_REVIEW
F_P0_05_STATUS=TWO_PHASE_ROLLOUT_PHASE2_MIGRATION_LOCAL_PREPARED
T12_PHASE1_COMMIT_HASH=bebd36c841f588fc9e4c74099e38a95d37d58982
T12_PHASE1_COMMIT_IDENTITY=PASS
T12_PHASE1_SCHEMA_PUSH_FIELD_ABSENT=SI
T12_STAGE5A_BLUEPRINT_ARCHIVE_CHAIN_COMPLETE=SI
T12_PHASE2_MIGRATION_PATH=prisma/migrations/20260826230000_drop_terminal_operativa_push_subscription/migration.sql
T12_PHASE2_MIGRATION_SHA256=cbd4a4684aceb41895f3d0b47335147c5470c80a90d2c434ecf51bf0ca43623d
T12_PHASE2_MIGRATION_DIRECTORY=20260826230000_drop_terminal_operativa_push_subscription
T12_STAGE5A_BLUEPRINT_DIRECTORY_REUSED=SI
T12_STAGE5A_TRACKED_MIGRATION_COUNT_BEFORE=26
T12_STAGE5A_NEW_MIGRATION_COUNT=1
T12_STAGE5A_MIGRATION_STATEMENT_COUNT=1
T12_STAGE5A_BLUEPRINT_HASH_MATCH=SI
T12_STAGE5A_BLUEPRINT_BYTE_REPRODUCTION=PASS_BY_SHA256
T12_PHYSICAL_TABLE_NAME=terminales_salon
T12_PHYSICAL_COLUMN_NAME=pushSubscription
T12_STAGE5A_SCHEMA_MUTATION=NO
T12_STAGE5A_PRODUCT_SOURCE_MUTATION=NO
T12_STAGE5A_TEST_MUTATION=NO
T12_STAGE5A_PHASE2_PREPUSH_DB_GATES_DEFINED=SI
T12_STAGE5A_PHASE2_POSTDROP_GATES_DEFINED=SI
T12_STAGE5A_PHASE2_FAILURE_CONTAINMENT=PASS
DB_REAL_READ=NO
DB_REAL_WRITE=NO
STAGE=NO
NEW_COMMIT=NO
PUSH=NO
DEPLOY=NO
P2_T12_CLOSED=NO
NEXT_TASK_ID=P2-T12-STAGE5B
NEXT_TASK_STATUS=READY
```

Stage5A deja una sola migration DROP local, sin aplicar. La revisión adversarial
Stage5B es obligatoria antes de cualquier commit o despliegue de Phase2.

## P2-T12 — Stage 5C (Phase2 exact local commit)

```
P2_T12_STAGE5C_PHASE2_LOCAL_COMMIT=PASS
P2_T12=PHASE2_DROP_MIGRATION_LOCAL_COMMIT_COMPLETE_AWAITING_POSTCOMMIT_PREPUSH_REVIEW
F_P0_05_STATUS=TWO_PHASE_ROLLOUT_PHASE2_MIGRATION_COMMITTED_LOCAL
T12_PHASE1_COMMIT_HASH=bebd36c841f588fc9e4c74099e38a95d37d58982
T12_PHASE2_COMMIT_HASH=7822d84ac5ac841978a77ebef76ad93630b69f42
T12_PHASE2_COMMIT_PARENT=bebd36c841f588fc9e4c74099e38a95d37d58982
T12_PHASE2_COMMIT_SUBJECT=chore: remove dead terminal push column
T12_PHASE2_COMMIT_FILE_COUNT=1
T12_PHASE2_MIGRATION_PATH=prisma/migrations/20260826230000_drop_terminal_operativa_push_subscription/migration.sql
T12_PHASE2_MIGRATION_SHA256=cbd4a4684aceb41895f3d0b47335147c5470c80a90d2c434ecf51bf0ca43623d
T12_PHASE2_MIGRATION_BYTES=2134
T12_STAGE5C_COMMITTED_BLOB=52501817c39ba4c3979ba0f77c687cd518c298ef
T12_STAGE5C_COMMITTED_BLOB_SIZE=2134
T12_STAGE5C_SCOPE_PURITY=PASS
T12_STAGE5C_SCHEMA_TS_TESTS_COMMITTED=NO
T12_STAGE5C_OTHER_MIGRATIONS_COMMITTED=NO
DB_REAL_READ=NO
DB_REAL_WRITE=NO
MIGRATION_APPLIED_TO_TESTING=NO
MIGRATION_APPLIED_TO_PRODUCTION=NO
PUSH=NO
DEPLOY=NO
RAILWAY_MUTATION=NO
PRODUCTION=NO
HEAD=7822d84ac5ac841978a77ebef76ad93630b69f42
ORIGIN_TESTING_CODEX=bebd36c841f588fc9e4c74099e38a95d37d58982
AHEAD=1
BEHIND=0
P2_T12_CLOSED=NO
NEXT_TASK_ID=P2-T12-STAGE5D
NEXT_TASK_STATUS=READY
```

Stage5C committeó localmente la Phase2 con un único archivo. El siguiente gate
es la revisión post-commit/pre-push; no se autoriza push, deploy ni aplicación
de la migration dentro de Stage5C.

## P2-T12 — Stage 5D (Phase2 post-commit/pre-push review)

```
P2_T12_STAGE5D_PHASE2_POSTCOMMIT_PREPUSH_REVIEW=PASS
P2_T12=PHASE2_DROP_MIGRATION_POSTCOMMIT_CERTIFIED_READY_FOR_TESTING_PUSH
F_P0_05_STATUS=TWO_PHASE_ROLLOUT_PHASE2_POSTCOMMIT_CERTIFIED
T12_PHASE1_COMMIT_HASH=bebd36c841f588fc9e4c74099e38a95d37d58982
T12_PHASE2_COMMIT_HASH=7822d84ac5ac841978a77ebef76ad93630b69f42
T12_PHASE2_COMMIT_PARENT=bebd36c841f588fc9e4c74099e38a95d37d58982
T12_PHASE2_COMMIT_FILE_COUNT=1
T12_PHASE2_MIGRATION_PATH=prisma/migrations/20260826230000_drop_terminal_operativa_push_subscription/migration.sql
T12_STAGE5D_COMMITTED_BLOB_ID=52501817c39ba4c3979ba0f77c687cd518c298ef
T12_STAGE5D_COMMITTED_BYTE_LENGTH=2134
T12_STAGE5D_COMMITTED_SHA256=cbd4a4684aceb41895f3d0b47335147c5470c80a90d2c434ecf51bf0ca43623d
T12_STAGE5D_FULL_COMMITTED_BLOB_READ=SI
T12_STAGE5D_EXECUTABLE_SQL_EXACT_MATCH=SI
T12_STAGE5D_PHYSICAL_TARGET_REDERIVED=PASS
T12_STAGE5D_PHASE1_PARENT_SCHEMA_FIELD_ABSENT=SI
T12_STAGE5D_PHASE2_SCHEMA_EQUALS_PHASE1_SCHEMA=SI
T12_STAGE5D_NEW_MIGRATION_COUNT=1
T12_STAGE5D_HISTORICAL_MIGRATION_MODIFICATION_COUNT=0
T12_STAGE5D_MIGRATION_ORDER=PASS
T12_STAGE5D_TWO_PHASE_ROLLOUT_PROOF=PASS
T12_STAGE5D_FAILURE_CONTAINMENT=PASS
PRISMA_VALIDATE_T12_STAGE5D=PASS
DB_REAL_READ=NO
DB_REAL_WRITE=NO
MIGRATION_APPLIED_TO_TESTING=NO
MIGRATION_APPLIED_TO_PRODUCTION=NO
PUSH=NO
DEPLOY=NO
RAILWAY_MUTATION=NO
PRODUCTION=NO
P2_T12_CLOSED=NO
NEXT_TASK_ID=P2-T12-STAGE5E
NEXT_TASK_STATUS=READY
```

Stage5D certificó el commit destructivo para el gate de TESTING. Stage5E
realizó los gates fresh de DB, el único push y la certificación post-DROP;
Stage5F ejecutó el cierre formal.

## P2-T12 — Stage 5E (TESTING runtime certification)

```
P2_T12_STAGE5E=PASS
P2_T12=PHASE2_TESTING_DROP_APPLIED_RUNTIME_CERTIFIED_AWAITING_FINAL_CLOSEOUT
F_P0_05_STATUS=TWO_PHASE_ROLLOUT_PHASE2_TESTING_CERTIFIED_AWAITING_CLOSEOUT
T12_PHASE1_COMMIT_HASH=bebd36c841f588fc9e4c74099e38a95d37d58982
T12_PHASE2_COMMIT_HASH=7822d84ac5ac841978a77ebef76ad93630b69f42
T12_STAGE5E_PRE_PENDING_COUNT=1
T12_STAGE5E_PRE_PENDING_MIGRATION=20260826230000_drop_terminal_operativa_push_subscription
T12_STAGE5E_PRE_PHYSICAL_COLUMN_EXISTS=SI
T12_STAGE5E_PUSH_COUNT=1
T12_STAGE5E_POST_HISTORY_COUNT=1
T12_STAGE5E_POST_PENDING_COUNT=0
T12_STAGE5E_POST_FAILED_COUNT=0
T12_STAGE5E_POST_PHYSICAL_COLUMN_EXISTS=NO
T12_STAGE5E_DEPLOYMENT_ID=cf5cca9a-e5f3-4a35-8b56-d6b90ec0c2b9
T12_STAGE5E_DEPLOYMENT_STATUS=SUCCESS
T12_STAGE5E_RUNTIME_SMOKE=PASS
T12_STAGE5E_FIXTURE_CLEANUP=PASS
T12_STAGE5E_WEBPUSH=NO
P2_T12_CLOSED=NO
NEXT_TASK_ID=P2-T12-STAGE5F
NEXT_TASK_STATUS=READY
```

Phase2 completó el único push y autodeploy en TESTING. El preDeploy aplicó
exactamente la migration T12; la columna física quedó ausente, el smoke
autenticado de terminal pasó y la fixture aislada quedó en cero filas. No se
tocó Production. El siguiente paso es exclusivamente el cierre documental
Stage5F.

## P2-T12 — Stage 5F (final closeout)

```
P2_T12_STAGE5F_FINAL_CLOSEOUT=PASS
P2_T12=CLOSED
P2_T12_CLOSED=SI
F_P0_05_STATUS=RESOLVED
P2_T12_FINAL_STATUS=CLOSED_AFTER_TWO_PHASE_SCHEMA_AND_PHYSICAL_COLUMN_REMOVAL_TESTING_CERTIFICATION
T12_STAGE5F_CROSS_REGISTRY_CONSISTENCY=PASS
T12_STAGE5F_OPEN_T12_BLOCKING_FINDING_COUNT=0
P0=CLOSED
P1=CLOSED
P2=IN_PROGRESS
P3=NOT_STARTED
T12_STAGE5F_NEXT_MAIN_TASK_ID=P2-T11
T12_STAGE5F_NEXT_MAIN_TASK_TITLE=Native Socket Post-Logout TTL Hardening
T12_STAGE5F_NEXT_MAIN_TASK_STATUS=NOT_STARTED
```

P2-T12 se cierra formalmente tras confirmar schema y DB sin el field/columna,
history T12 exactamente una vez, cero pending/failed, deployment Phase2 sano,
runtime certificado, cleanup limpio y Git alineado. P2-T11 es el siguiente
task real de la posición 9; P2-T02 continúa pausada por hardware y P2-T19
continúa diferida opcionalmente.

## P2-T11 — estado interno normalizado (actualizado por Stage5G) — 2026-08-27

```
P2-T11=CLOSED
Phase A=DEPLOYED_TESTING_CERTIFIED
Phase B=DEPLOYED_TESTING_RUNTIME_CERTIFIED
Phase C=DEPLOYED_TESTING_SERVER_RUNTIME_CERTIFIED_REAL_BROWSER_CERTIFIED (commit f6ca24f, TTL 120s certificado en runtime, cross-tab certificado con navegador real)
F-P2-T11-01=RESOLVED
P2_T11_PHASE_C_LATE_STORAGE_EVENT_RESIDUAL=ACCEPTED_LOW_NON_SECURITY_BLOCKING_LIMITATION
P2_T11_ACCEPTANCE_MATRIX_RESULT=10_OF_10_PASS
```

Este bloque resume el estado ACTUAL (post Stage5G); el detalle
cronológico completo, incluyendo la historia de cada etapa (Stage1 a
Stage5G), está en los bloques `## P2-T11 — Stage N ...` que siguen a
continuación, sin reescribir.

## P2-T11 — Stage 1 current-state audit — 2026-08-26

```
P2_T11_STAGE1=PASS_HARDENING_REQUIRED_MORE_DESIGN_NEEDED
P2_T11=CURRENT_STATE_AUDITED_HARDENING_REQUIRED
P2_T11_FINDING=POSTLOGOUT_RESIDUAL_ACCESS_REQUIRES_HARDENING
P2_T11_SECURITY_SEVERITY=MEDIUM
P2_T11_SOCKET_ACTOR_TTL_SECONDS=300
P2_T11_ROOM_CAPABILITY_TTL_SECONDS=120
P2_T11_SOCKET_CONNECT_RECHECKS_CURRENT_SESSION=NO
P2_T11_SOCKET_CONNECT_HAS_SERVER_REVOCATION_CHECK=NO
P2_T11_LOGOUT_DISCONNECTS_EXISTING_SOCKET=PARTIAL
P2_T11_DESIGN_RECONNECT_REVOCATION=UNRESOLVED
P2_T11_DESIGN_EXISTING_SOCKET_REVOCATION=UNRESOLVED
P2_T11_T09_BOUNDARY_DEFINED=SI
P2_T11_SCHEMA_CHANGE_REQUIRED=UNDECIDED
P2_T11_MIGRATION_REQUIRED=UNDECIDED
P2_T12=CLOSED
F_P0_05_STATUS=RESOLVED
NEXT_TASK_ID=P2-T11-STAGE1B
NEXT_TASK_STATUS=READY
```

La auditoría confirmó residual post-logout bounded by JWT/capability TTL, sin
revocación server-side ni propagación multi-tab/multi-instance. Stage1B debe
seleccionar la autoridad y transporte de revocación antes de congelar el
allowlist de implementación; la implementación general de fan-out permanece
en el boundary de P2-T09.

## P2-T11 — Stage 1B distributed revocation design freeze — 2026-08-26

```
P2_T11_STAGE1B=PASS_DISTRIBUTED_REVOCATION_DESIGN_FROZEN
P2_T11=DESIGN_FROZEN_READY_FOR_IMPLEMENTATION_PLANNING
P2_T11_SELECTED_DESIGN_ID=H1
P2_T11_TARGET_SOCKET_ACTOR_TTL_SECONDS=120
P2_T11_TARGET_ROOM_CAP_TTL_SECONDS=UNCHANGED
P2_T11_FRESH_RECONNECT_POSTLOGOUT_POLICY=IMMEDIATE_REJECT
P2_T11_EXISTING_SOCKET_DISTRIBUTED_POLICY=BOUNDED_BY_REDUCED_TTL_DEFERRED_TO_T09
P2_T11_SCHEMA_CHANGE_REQUIRED=NO
P2_T11_MIGRATION_REQUIRED=NO
P2_T11_MULTI_TAB_DESIGN=NATIVE_STORAGE_EVENT_LISTENER
P2_T11_T09_BOUNDARY_FROZEN=SI
P2_T11_ROLLOUT_REQUIRES_MULTI_PHASE=SI
P2_T11_ACCEPTANCE_CONTRACT_FROZEN=SI
NEXT_TASK_ID=P2-T11-STAGE2
NEXT_TASK_STATUS=READY
```

Toda ambigüedad previa (TTL, schema/migration, multi-tab, reconnect,
existing-socket, rollout, frontera T09) quedó resuelta con evidencia
directa del código: el claim `sid` ya es `Sesion.id` (sin campo nuevo), el
chat-service ya desconecta al vencer el `exp` del actor (confirmado por
código, no supuesto), y el patrón HMAC interno ya existente
(`realtime-publish.ts`) se reutiliza en sentido inverso para un chequeo de
connect-time. Selección final: diseño híbrido "H1" — connect-time session
check + TTL de actor reducido a 120s + propagación cross-tab vía evento
`storage` + limpieza same-tab ya existente — dejando explícitamente en
P2-T09 sólo la terminación forzada inmediata de un socket ya conectado en
otra instancia del chat-service. Detalle completo en
`codex-reports/CURRENT_TASK.md`. No se modificó código, schema, tests, Git
ni Railway en esta tarea (READ/AUDIT/DESIGN-FREEZE-ONLY).

## P2-T11 — Stage 1B-R1 connected-socket lifetime reconciliation — 2026-08-26

```
P2_T11_STAGE1B_R1=PASS_CONNECTED_SOCKET_LIFETIME_RECONCILED
P2_T11=DESIGN_FULLY_FROZEN_READY_FOR_IMPLEMENTATION_PLANNING
P2_T11_STAGE1B_EXISTING_SOCKET_TTL_BOUND_CLAIM=VALID
P2_T11_CONNECTED_SOCKET_ENFORCES_TOKEN_EXPIRY=SI
P2_T11_R1_EXISTING_SOCKET_MAX_RESIDUAL_SECONDS=120 (target, desde emisión del token, no desde logout)
P2_T11_R1_SELECTED_CORRECTION=R1-A (mecanismo ya existente, no requiere código nuevo)
P2_T11_SELECTED_DESIGN_ID=H1 (sin cambio)
NEXT_TASK_ID=P2-T11-STAGE2
NEXT_TASK_STATUS=READY
```

Auditó una posible contradicción en el diseño H1: ¿reducir el TTL del JWT
acota realmente un socket ya conectado, o sólo bloquea reconexiones
nuevas? Confirmado con evidencia mecánica (`mini-services/chat-service/
index.js:327-332`) y empírica (test real ejecutado en esta tarea, 12/12
PASS, incluyendo el test específico que fuerza un token de 1s de vida y
confirma la desconexión del socket ya conectado) que el chat-service ya
tiene, en producción, un timer por-conexión que desconecta el socket al
llegar el `exp` real del JWT — independiente de cualquier señal de
logout, heartbeat o transporte. El claim de Stage1B queda `VALID`, con
una corrección de precisión: el residual se mide desde la emisión del
token, no desde el logout. La frontera con P2-T09 permanece intacta y con
un propósito real (terminación instantánea cross-instance, antes del
vencimiento natural). Ningún archivo de código requiere cambios nuevos
para este mecanismo — Stage2 sólo necesita reducir la constante de TTL ya
planeada. No se modificó código, schema, tests, Git ni Railway en esta
tarea.

## P2-T11 — Stage 2 implementation contract freeze — 2026-08-26

```
P2_T11_STAGE2=PASS_IMPLEMENTATION_CONTRACT_FROZEN
P2_T11=IMPLEMENTATION_CONTRACT_FROZEN_READY_FOR_PHASE_A
P2_T11_STAGE2_ROLLOUT_PHASE_COUNT=3
P2_T11_STAGE2_ROLLOUT_ORDER=A_then_B_then_C
P2_T11_STAGE2_INTERNAL_SECRET_POLICY=NEW_DEDICATED_SECRET
P2_T11_STAGE2_EXACT_ALLOWLIST_FROZEN=SI
NEXT_TASK_ID=P2-T11-STAGE3A
NEXT_TASK_TITLE=PHASE A MONOLITH INTERNAL SESSION VALIDATION LOCAL IMPLEMENTATION
NEXT_TASK_STATUS=READY
```

Congeló, sin decisiones abiertas: endpoint interno nuevo `POST /api/
internal/realtime/session` con secreto HMAC dedicado
(`REALTIME_SESSION_CHECK_SECRET`, nunca reusa el secreto del bridge de
publish tras un análisis explícito de expansión de privilegio); nuevo
helper `isSesionActiveById` en `src/lib/auth.ts` (misma regla de
`validateSession`); tres fases de rollout con dependencia dura sólo entre
A→B (B es fail-closed sin A); reutilización de la key `deligo-auth` YA
existente de Zustand persist para la propagación cross-tab (sin key
nueva); allowlist exacto de 13 archivos (nuevos + modificados) repartidos
en las tres fases; contrato de tests completo (endpoint interno,
chat-service, cliente); matriz de compatibilidad con un único caso UNSAFE
(chat-service con Phase B sin monolito con Phase A) evitado por el orden
de rollout; 4 modelos de carrera clasificados honestamente (ninguna
carrera produce un hueco mayor al ya reconocido TTL-bound). Detalle
completo en `codex-reports/CURRENT_TASK.md`. No se modificó código,
schema, tests, Git ni Railway en esta tarea (READ/AUDIT/TEST-PLANNING
ONLY).

## P2-T11 — Stage 3A Phase A local implementation — 2026-08-26

```
P2_T11_STAGE3A=PASS_PHASE_A_LOCAL_IMPLEMENTATION
P2_T11=PHASE_A_LOCAL_IMPLEMENTED_AWAITING_PRECOMMIT_REVIEW
P2_T11_STAGE3A_PHASE_A_ALLOWLIST_FILE_COUNT=4
P2_T11_STAGE3A_ACTUAL_DIFF_ALLOWLIST_MATCH=SI
P2_T11_STAGE3A_CHAT_CONNECT_ENFORCEMENT_ACTIVE=NO
P2_T11_STAGE3A_SOCKET_ACTOR_TTL_SECONDS=300
P2_T11_STAGE3A_PHASE_A_SAFE_IF_DEPLOYED_ALONE=SI
NEXT_TASK_ID=P2-T11-STAGE3B
NEXT_TASK_TITLE=PHASE A LOCAL IMPLEMENTATION PRE-COMMIT ADVERSARIAL REVIEW
NEXT_TASK_STATUS=READY
```

Implementó localmente, exclusivamente, Phase A del contrato Stage2:
`src/lib/internal-session-check-auth.ts` (nuevo, HMAC dedicado),
`src/app/api/internal/realtime/session/route.ts` (nuevo, endpoint
interno inerte), `src/app/api/internal/realtime/session/route.test.ts`
(nuevo, 14/14 PASS) y `src/lib/auth.ts` (agrega `isSesionActiveById`,
diff puro de 13 líneas). Confirmado: 0 errores nuevos de TSC/ESLint,
`next build` PASS, cero cambios en `mini-services/**` (chat-service
intacto), TTL del actor sigue en 300s, sin listener cross-tab, sin
schema/migration/package. Diff real = subset exacto del allowlist de
Phase A congelado en Stage2. Sin commit/push/deploy/Railway/DB real. No
se marca el finding `RESOLVED` ni se cierra T11 — falta la revisión
adversarial pre-commit de Stage3B.

## P2-T11 — Stage 3B Phase A pre-commit adversarial review — 2026-08-26

```
P2_T11_STAGE3B=PASS_PHASE_A_PRECOMMIT_ADVERSARIAL_REVIEW
P2_T11=PHASE_A_PRECOMMIT_CERTIFIED_READY_FOR_LOCAL_COMMIT
P2_T11_STAGE3B_ALLOWLIST_MATCH=SI
P2_T11_PHASE_A_PROPOSED_COMMIT_SUBJECT=feat: add internal realtime session validation endpoint
NEXT_TASK_ID=P2-T11-STAGE3C
NEXT_TASK_TITLE=PHASE A EXACT LOCAL COMMIT
NEXT_TASK_STATUS=READY
```

Auditoría adversarial completa de los 4 archivos de Phase A, con mandato
explícito de intentar demostrar que la implementación estaba mal. No se
confió en el `PASS` de Stage3A: se releyeron los 4 archivos completos, se
re-ejecutaron tests/lint/TSC/build de forma independiente (mismo
resultado exacto), y se ejecutó un script adversarial temporal (nunca
stageado, eliminado inmediatamente después de usarse) con 19 casos
nuevos cubriendo secreto de firma incorrecto, corrupción de firma real,
tamper de body, timestamps límite, secreto ausente/corto, excepción del
lookup, y variantes de body malformado — ningún auth bypass, fail-open,
enumeración de sesión, DB-antes-de-auth, fuga de datos ni scope drift
fue encontrado. Certificado listo para un commit local exacto de los
mismos 4 archivos. Sin commit/push/deploy/Railway/DB real en esta tarea.

## P2-T11 — Stage 3C Phase A exact local commit — 2026-08-26

```
P2_T11_STAGE3C=PASS_PHASE_A_EXACT_LOCAL_COMMIT
P2_T11=PHASE_A_LOCAL_COMMIT_COMPLETE_AWAITING_POSTCOMMIT_PREPUSH_REVIEW
P2_T11_PHASE_A_COMMIT=d0ba59dccfdd51a4aa5705d0e76d2e84ba4867d1
P2_T11_PHASE_A_COMMIT_PARENT=7822d84ac5ac841978a77ebef76ad93630b69f42
AHEAD=1
BEHIND=0
PUSH=NO
NEXT_TASK_ID=P2-T11-STAGE3D
NEXT_TASK_TITLE=PHASE A POST-COMMIT / PRE-PUSH EXACT-BLOB REVIEW
NEXT_TASK_STATUS=READY
```

Convirtió la implementación ya certificada de Phase A en exactamente un
commit local (`d0ba59d`, subject `feat: add internal realtime session
validation endpoint`, 4 archivos exactos: 3 nuevos + `src/lib/auth.ts`
modificado). Stage exacto por paths explícitos, auditoría de índice,
commit único, y verificación posterior leyendo los blobs del commit
directamente (confirmando TTL/cross-tab/chat-service sin cambio en
`HEAD`). `AHEAD=1`/`BEHIND=0` respecto de origin, que no cambió. Sin
push/deploy/Railway/DB real. F-P2-T11-01 permanece abierto; P2-T11 no
cerrado — falta la revisión post-commit/pre-push de Stage3D.

## P2-T11 — Stage 3D Phase A post-commit/pre-push exact-blob review — 2026-08-26

```
P2_T11_STAGE3D=PASS_PHASE_A_POSTCOMMIT_PREPUSH_EXACT_BLOB_REVIEW
P2_T11=PHASE_A_POSTCOMMIT_CERTIFIED_READY_FOR_TESTING_PUSH
P2_T11_PHASE_A_COMMIT=d0ba59dccfdd51a4aa5705d0e76d2e84ba4867d1
AHEAD=1
BEHIND=0
PUSH=NO
NEXT_TASK_ID=P2-T11-STAGE3E
NEXT_TASK_TITLE=PHASE A FRESH TESTING GATES / EXACT PUSH + DEPLOY CERTIFICATION
NEXT_TASK_STATUS=READY
```

Recertificó el commit `d0ba59d` directamente desde los objetos Git
(blob IDs vía `git ls-tree`, contenido vía `git show HEAD:<path>`), sin
confiar en Stage3B/3C. Re-ejecutó test focal (14/14), lint (0), TSC (31
baseline, 0 nuevos), build (PASS), y un script adversarial temporal
(19/19, eliminado tras su uso) — todos con el mismo resultado exacto.
Confirmó vía `git grep` sobre `HEAD` que Phase A permanece inerte (cero
referencias desde `mini-services/**`) y que TTL/room-cap/cross-tab no
cambiaron. Origin no se movió. Certificado listo para el push de
Stage3E. Sin push/deploy/Railway/DB real en esta tarea. F-P2-T11-01
permanece abierto; P2-T11 no cerrado.

## P2-T11 — Stage 3E Phase A testing push + deploy certification — 2026-08-27

```
P2_T11_STAGE3E=PASS_PHASE_A_TESTING_PUSH_DEPLOY_CERTIFICATION
P2_T11=PHASE_A_DEPLOYED_TESTING_CERTIFIED_READY_FOR_NEXT_ROLLOUT_GATE
P2_T11_PHASE_A_COMMIT=d0ba59dccfdd51a4aa5705d0e76d2e84ba4867d1
P2_T11_STAGE3E_SESSION_SECRET_CONFIGURATION=KNOWN_ABSENT
AHEAD=0
BEHIND=0
PUSH=SI (1)
DEPLOY=SI_TESTING_AUTODEPLOY
NEXT_TASK_ID=P2-T11-STAGE4A
NEXT_TASK_TITLE=PHASE B LOCAL IMPLEMENTATION
NEXT_TASK_STATUS=READY
```

Publicó exactamente el commit `d0ba59d` a `origin/testing-codex` con un
único push normal, observó el autodeploy Git-triggered (`DeliGO Copy`
`BUILDING`→`DEPLOYING`→`SUCCESS`, `chat en vivo` `AUTODEPLOYED_HEALTHY`),
y certificó Phase A desplegada y sana sin activar Phase B. Un único
probe seguro no autenticado contra el endpoint nuevo devolvió `503`
(`AUTH_UNAVAILABLE`), revelando de forma determinística — sin ejecutar
`railway variables` — que `REALTIME_SESSION_CHECK_SECRET` sigue ausente
en TESTING; el monolito permanece sano de todos modos (diseño
intencional). TTL/room-cap/cross-tab sin drift. Sin mutación de Railway,
sin DB real, Production intacta.

## P2-T11 — Stage 4A Phase B local implementation — 2026-08-27

```
P2_T11_STAGE4A=PASS_PHASE_B_LOCAL_IMPLEMENTATION
P2_T11=PHASE_B_LOCAL_IMPLEMENTED_AWAITING_PRECOMMIT_SECURITY_REVIEW
P2_T11_STAGE4A_ACTUAL_DIFF_FILE_COUNT=5
P2_T11_STAGE4A_SAFE_TO_PUSH_NOW=NO
NEXT_TASK_ID=P2-T11-STAGE4B
NEXT_TASK_TITLE=PHASE B LOCAL IMPLEMENTATION PRE-COMMIT ADVERSARIAL REVIEW
NEXT_TASK_STATUS=READY
```

Implementó localmente Phase B: `io.use()` del chat-service exige, tras
la verificación JWT local, que Phase A confirme la `Sesion` activa vía
HMAC dedicado, timeout 400ms + 1 retry, fail-closed en cada rama, sin
leak al cliente. 98/98 tests PASS (29 nuevos + 12 + 57 existentes).
Descubrió y corrigió una desviación necesaria del allowlist Stage2
(`internal-publish.test.js`, mismo stub de una línea que
`security.test.js`), documentada íntegra para revisión en Stage4B. Sin
push/deploy — secreto sigue ausente en TESTING.

## P2-T11 — Stage 4B Phase B pre-commit adversarial review — 2026-08-27

```
P2_T11_STAGE4B=PASS_PHASE_B_PRECOMMIT_ADVERSARIAL_REVIEW
P2_T11=PHASE_B_PRECOMMIT_CERTIFIED_READY_FOR_LOCAL_COMMIT
P2_T11_STAGE4B_ALLOWLIST_EXCEPTION_STATUS=ACCEPTED_TEST_ONLY_MINIMAL_EXCEPTION
P2_T11_STAGE4B_ADVERSARIAL_CASE_COUNT=12
P2_T11_STAGE4B_ADVERSARIAL_PASS_COUNT=12
NEXT_TASK_ID=P2-T11-STAGE4C
NEXT_TASK_TITLE=PHASE B EXACT LOCAL COMMIT
NEXT_TASK_STATUS=READY
```

Auditó adversarialmente sin confiar en Stage4A: releyó los 5 archivos
completos, re-derivó el HMAC byte-a-byte por lectura de código, y
construyó un script temporal (fuera del repo, eliminado al terminar)
que conectó el firmante REAL de Phase B con el verificador REAL de
Phase A — 12/12 PASS. Re-ejecutó las 3 suites (98/98 PASS). Aceptó la
excepción de allowlist de `internal-publish.test.js` tras 12 preguntas
de diagnóstico (test-only, diff mínimo, sin debilitamiento). Único
hallazgo: un nit cosmético de logging, sin impacto de seguridad,
preservado sin corregir. Certificado listo para commit local.

## P2-T11 — Stage 4F Phase B TESTING deploy + runtime revocation certification — 2026-08-27

```
P2_T11_STAGE4F=PASS_PHASE_B_TESTING_DEPLOY_RUNTIME_REVOCATION_CERTIFICATION
P2_T11=PHASE_B_DEPLOYED_TESTING_CERTIFIED_READY_FOR_PHASE_C
P2_T11_PHASE_B_COMMIT=e8d217112b1cfd6af311dda70ad2880ea8be295c
P2_T11_STAGE4F_FRESH_RECONNECT_REJECT_LATENCY_MS=1126
AHEAD=0
BEHIND=0
PUSH=SI (1)
NEXT_TASK_ID=P2-T11-STAGE5A
NEXT_TASK_TITLE=PHASE C ACTOR TTL 120s / SAME-BROWSER CROSS-TAB LOGOUT LOCAL IMPLEMENTATION
NEXT_TASK_STATUS=READY
```

Publicó `e8d2171` con un único push, observó el autodeploy Git-triggered
normal (ambos servicios `SUCCESS` en el commit exacto), y certificó en
runtime, contra la base de datos real de TESTING (fixtures aisladas
`P2T11_STAGE4F_`, creadas y eliminadas en la misma tarea, aprobado
explícitamente por el usuario), el objetivo central de Phase B: un
actor JWT emitido antes de un logout real es rechazado en una conexión
Socket.IO nueva ~1.1s después del logout — sin esperar el TTL de
300s — mientras una sesión independiente y un socket ya conectado con
ese mismo JWT continúan exactamente según lo documentado (sin
revocación distribuida instantánea, deuda de T09). TTL/room-cap/
cross-tab sin drift. Sin mutación de Railway config, sin Production.
Phase B queda cerrada dentro de P2-T11; Phase C puede comenzar.

## P2-T11 — Stage 4C Phase B exact local commit — 2026-08-27

```
P2_T11_STAGE4C=PASS_PHASE_B_EXACT_LOCAL_COMMIT
P2_T11=PHASE_B_LOCAL_COMMIT_COMPLETE_AWAITING_POSTCOMMIT_REVIEW_AND_SECRET_GATE
P2_T11_PHASE_B_COMMIT=e8d217112b1cfd6af311dda70ad2880ea8be295c
P2_T11_PHASE_B_COMMIT_PARENT=d0ba59dccfdd51a4aa5705d0e76d2e84ba4867d1
AHEAD=1
BEHIND=0
PUSH=NO
NEXT_TASK_ID=P2-T11-STAGE4D
NEXT_TASK_TITLE=PHASE B POST-COMMIT / PRE-SECRET-GATE EXACT-BLOB REVIEW
NEXT_TASK_STATUS=READY
```

Convirtió la implementación Phase B ya certificada en exactamente un
commit local (`e8d2171`, subject `feat: enforce connect-time session
validation in chat service`, 5 archivos exactos: 2 nuevos + 3
modificados). Stage exacto por paths explícitos, auditoría de índice,
commit único, blobs y diff committed releídos íntegros desde `HEAD`.
`AHEAD=1`/`BEHIND=0` respecto de origin, que no cambió. Phase B queda
implementada y commiteada LOCALMENTE, sin desplegar. Push permanece
prohibido: `REALTIME_SESSION_CHECK_SECRET` sigue `KNOWN_ABSENT` en
TESTING. Sin push/deploy/Railway/DB real. F-P2-T11-01 permanece
abierto; P2-T11 no cerrado — falta la revisión post-commit/pre-secret-
gate de Stage4D.

## P2-T11 — Stage 5A Phase C TTL 120s + same-browser cross-tab logout (implementación local) — 2026-08-27

```
P2_T11_STAGE5A=PASS_PHASE_C_LOCAL_IMPLEMENTATION
P2_T11=PHASE_B_DEPLOYED_TESTING_CERTIFIED_PHASE_C_LOCAL_IMPLEMENTED_UNCOMMITTED
P2_T11_HEAD_COMMIT=e8d217112b1cfd6af311dda70ad2880ea8be295c
AHEAD=0
BEHIND=0
PUSH=NO
COMMIT=NO
NEXT_TASK_ID=P2-T11-STAGE5B
NEXT_TASK_TITLE=PHASE C PRE-COMMIT ADVERSARIAL REVIEW
NEXT_TASK_STATUS=READY
```

Implementó localmente Phase C completa según el allowlist de 5 archivos
congelado en Stage2: TTL del `socket-actor` reducido de 300s a 120s
(`src/lib/realtime-auth.ts`), aserción de test actualizada, endpoint
`/api/realtime/token` sincronizado con la constante real (ya no un
literal), y un listener del evento nativo `storage` sobre la clave
`deligo-auth` en `src/providers/realtime-provider.tsx` que propaga el
logout a las demás pestañas del mismo navegador reutilizando el cableado
`setActor`/`RealtimeManager` ya existente (sin tocar `realtime-manager.ts`
ni el chat-service). Nuevo test estático de 6 puntos
(`realtime-provider-cross-tab-static-contract.test.ts`). 9/9 tests nuevos,
47/47 suite TS relacionada, 98/98 regresión Phase B (chat-service) en
verde; lint limpio; TypeScript sin errores nuevos en el allowlist. Diff
final = exactamente los 5 archivos del allowlist, sin commit/push/deploy/
Railway/DB real/navegador real. F-P2-T11-01 permanece abierto; P2-T11 no
cerrado — falta Stage5B (revisión adversarial precommit).

## P2-T11 — Stage 5A-R1 evidencia local + reconciliación del MASTER HANDOFF — 2026-08-27

```
P2_T11_STAGE5A_R1=PASS_STAGE5A_EVIDENCE_AND_MASTER_HANDOFF_RECONCILED
P2_T11_HEAD_COMMIT=e8d217112b1cfd6af311dda70ad2880ea8be295c
AHEAD=0
BEHIND=0
PUSH=NO
COMMIT=NO
NEXT_TASK_ID=P2-T11-STAGE5B
NEXT_TASK_TITLE=PHASE C PRE-COMMIT ADVERSARIAL REVIEW
NEXT_TASK_STATUS=READY
```

Revalidó la evidencia de Stage5A sin confiar en su autorreporte: releyó
el diff completo de los 4 archivos modificados y el contenido íntegro del
test estático nuevo, re-ejecutó el test real del TTL del actor (120s vía
`exp - iat` firmado/verificado con `jose`), reconfirmó room-capability en
120s sin cambio, re-auditó el timer de expiración del chat-service
(usa `actor.tokenExp` real, sin diff de producto) y `realtime-manager.ts`
(epochs + `stopped`, sin diff de producto, reconexión con actor obsoleto
imposible tras cross-tab logout, login posterior funciona), releyó
`auth-store.ts` completo confirmando ausencia de `sid`/token/JWT/secret
en el payload persistido, y recontó exactamente los tests: 9 en verde al
correr los 2 archivos tocados (6 nuevos + 1 aserción modificada dentro de
un archivo de 3), 47/47 en la suite TS relacionada (desglose 3+24+6+14),
98/98 en la regresión completa de `mini-services/chat-service`. Corrió
además `npm run build` completo (no ejecutado en Stage5A) — PASS, exit 0.
Reconcilió el MASTER HANDOFF (`CODEX_REPORT.md`): el header raíz y el
marker `P2_T11=` seguían apuntando a Stage4F pese a que la sección
`## Next` ya reflejaba Stage5A; los markers `DB_REAL_READ`/
`DB_REAL_WRITE`/`PUSH`/`DEPLOY` heredaban sin calificar acciones que en
realidad eran exclusivas de Stage4F — se separaron en `STAGE4F_*`
(preservados como historia) y en markers actuales (`NO`). También
corrigió la línea de posición 9 del orden canónico de este archivo, que
todavía decía "Phase C ... not started". Ningún párrafo histórico fue
reescrito, ninguna fuente ni test fue tocado — únicamente
`CODEX_REPORT.md` y `codex-reports/**`. F-P2-T11-01 permanece abierto;
P2-T11 no cerrado — listo para Stage5B (no ejecutada).

## P2-T11 — Stage 5B revisión adversarial precommit de Phase C — 2026-08-27

```
P2_T11_STAGE5B=PASS_PHASE_C_PRECOMMIT_ADVERSARIAL_REVIEW
P2_T11_HEAD_COMMIT=e8d217112b1cfd6af311dda70ad2880ea8be295c
AHEAD=0
BEHIND=0
PUSH=NO
COMMIT=NO
CORRECTION_COUNT=0
NEXT_TASK_ID=P2-T11-STAGE5C
NEXT_TASK_TITLE=PHASE C EXACT LOCAL COMMIT
NEXT_TASK_STATUS=READY
```

Auditó adversarialmente la implementación local de Phase C sin aceptar
el autorreporte de Stage5A/Stage5A-R1 como autoridad suficiente: releyó
completos los 5 archivos del allowlist más `realtime-manager.ts` (1050
líneas) y `auth-store.ts` (147 líneas) enteros, y localizó el punto real
de logout cliente (`src/hooks/use-auth.ts`). Encontró y corrigió una
**inexactitud narrativa** (no de código) — el orden real del logout es
limpieza local síncrona primero (que dispara la señal cross-tab) y
petición al servidor best-effort después, al revés de lo que reportes
previos narraban, sin impacto de seguridad. Auditó exhaustivamente si la
clave `deligo-auth` (ya usada por el `persist` de Zustand desde antes de
Phase C) podía sufrir colisión de namespace, corrupción del auth-store,
o que una escritura normal se malinterpretara como logout — sin
encontrar ningún defecto: el listener sólo observa el canal ya
autoritativo, nunca escribe. Probó por trazado exacto de código que una
conexión asíncrona vieja no puede resucitar un socket tras un logout
cross-tab, y que un login nuevo siempre reactiva el realtime. Construyó
un arnés adversarial temporal fuera del repo (12 payloads maliciosos/
malformados, 12/12 sin excepción, eliminado al terminar). Documentó un
único residual de severidad baja y no explotable como bypass de
seguridad (evento de logout tardío bajo timing patológico de navegador),
aceptado sin bloquear, con el mismo criterio que el prompt ya autoriza
para la brecha estático-vs-navegador-real. Recontó (no copió) 9 tests
tocados, 47/47 suite TS relacionada y 98/98 regresión Phase B, todos en
verde; lint, TSC, `git diff --check` y `npm run build` limpios. Cero
corrección de código — ningún defecto real lo ameritó. F-P2-T11-01 pasa
a `PHASE_C_PRECOMMIT_CERTIFIED_AWAITING_LOCAL_COMMIT` (no `RESOLVED`);
P2-T11 no cerrado — listo para Stage5C (commit local exacto), no
ejecutada.

## P2-T11 — Stage 5C commit local exacto de Phase C — 2026-08-27

```
P2_T11_STAGE5C=PASS_PHASE_C_EXACT_LOCAL_COMMIT
P2_T11_PHASE_C_COMMIT=f6ca24f78a4359fdf66e213b1a449a49426c1234
P2_T11_PHASE_C_COMMIT_PARENT=e8d217112b1cfd6af311dda70ad2880ea8be295c
AHEAD=1
BEHIND=0
PUSH=NO
NEXT_TASK_ID=P2-T11-STAGE5D
NEXT_TASK_TITLE=PHASE C POST-COMMIT / PRE-PUSH EXACT-BLOB REVIEW
NEXT_TASK_STATUS=READY
```

Convirtió la implementación de Phase C ya certificada (Stage5A,
revalidada en Stage5A-R1, auditada sin defectos en Stage5B) en
exactamente un commit local: recuperó textualmente el allowlist de 5
archivos y el subject congelados por Stage5B, confirmó cero mutación
desde esa certificación (mismo `git diff --stat` exacto: 4 files
changed, 24 insertions, 4 deletions), re-ejecutó toda la batería (9
tests Phase C, 47/47 suite TS relacionada, 98/98 regresión Phase B,
lint/TSC/diff-check/build limpios), stageó explícitamente sólo los 5
paths (`git add -- <5 rutas>`, nunca `-A`/`.`), auditó el índice (3 `M`
+ 1 `A` + 1 `M`, cero contenido prohibido), confirmó `staged ==
worktree` exacto, y ejecutó un único
`git commit -m "fix: shorten realtime actor TTL and sync logout across
tabs"` (subject verbatim). Resultado: `f6ca24f` (parent `e8d2171`
exacto, 5 archivos, 102 inserciones/4 eliminaciones). Blobs y diff
committed releídos íntegros desde `HEAD`. `HEAD=f6ca24f`, `ORIGIN` sigue
en `e8d2171` (no se movió), `AHEAD=1`/`BEHIND=0`. Preservó sin intentar
corregirlo el residual de severidad baja de Stage5B (evento de logout
tardío bajo timing patológico de navegador). Phase C queda commiteada
LOCALMENTE — TESTING/Production siguen exactamente en `e8d2171` (TTL
300s, cross-tab inactivo). Sin push/deploy/Railway/DB real/navegador
real. F-P2-T11-01 pasa a
`PHASE_C_LOCAL_COMMIT_COMPLETE_AWAITING_POSTCOMMIT_EXACT_BLOB_REVIEW`
(no `RESOLVED`); P2-T11 no cerrado — listo para Stage5D (revisión
postcommit/pre-push), no ejecutada.

## P2-T11 — Stage 5D revisión postcommit/pre-push exacta de Phase C — 2026-08-27

```
P2_T11_STAGE5D=PASS_PHASE_C_POSTCOMMIT_PREPUSH_EXACT_BLOB_REVIEW
P2_T11_PHASE_C_COMMIT=f6ca24f78a4359fdf66e213b1a449a49426c1234
AHEAD=1
BEHIND=0
PUSH=NO
NEXT_TASK_ID=P2-T11-STAGE5E
NEXT_TASK_TITLE=PHASE C FRESH TESTING PREPUSH / EXACT PUSH / DEPLOY + SERVER-RUNTIME CERTIFICATION
NEXT_TASK_STATUS=READY
```

Recertificó de forma independiente el commit `f6ca24f` desde los objetos
Git — no desde el resumen de Stage5C: confirmó topología exacta,
derivó el fileset del commit vía `git diff-tree`/`git show --name-only`
(5/5 exacto), recalculó los 5 blob IDs de forma independiente vía
`git ls-tree` (5/5 idénticos a Stage5C), leyó los 5 blobs completos vía
`git show HEAD:<path>`, y — la prueba más fuerte de la etapa — confirmó
por diff byte-a-byte que `mini-services/chat-service/index.js`,
`internal-session-check-auth.ts`, `realtime-manager.ts`,
`auth-store.ts` y `use-auth.ts` son idénticos entre el padre `e8d2171` y
`f6ca24f`. Reprobó desde el árbol commiteado la autoridad única de TTL
(sin segundo emisor), room-cap independiente en 120s, timer con `exp`
real, y el orden correcto del logout (reconfirmando la corrección de
Stage5B sin restaurar la narrativa incorrecta). Construyó un arnés
adversarial nuevo que extrajo el handler directamente del blob
commiteado — 12/12 PASS. Recontó 9/47/98 tests, todos en verde; lint,
TSC, `git show --check`, `git diff --check` y `npm run build` limpios.
Confirmó `git diff HEAD -- <5 paths>` vacío. Preservó sin reclasificar
el residual de severidad baja de Stage5B. Cero mutación de fuente/test.
`HEAD=f6ca24f`, `ORIGIN` sigue en `e8d2171` (sin mover),
`AHEAD=1`/`BEHIND=0`. F-P2-T11-01 pasa a
`PHASE_C_POSTCOMMIT_CERTIFIED_READY_FOR_FRESH_TESTING_PREPUSH` (no
`RESOLVED`); P2-T11 no cerrado — listo para Stage5E (fresh prepush /
push exacto / deploy + certificación runtime en servidor), no ejecutada.
Stage5E debe repetir su propio preflight completo inmediatamente antes
del push — esta certificación no lo sustituye.

## P2-T11 — Stage 5E deploy en TESTING + certificación runtime server-side de Phase C — 2026-08-27

```
P2_T11_STAGE5E=PASS_PHASE_C_TESTING_DEPLOY_SERVER_RUNTIME_CERTIFICATION
P2_T11_PHASE_C_COMMIT=f6ca24f78a4359fdf66e213b1a449a49426c1234
AHEAD=0
BEHIND=0
PUSH=SI (1)
DEPLOY=SI_TESTING_GIT_TRIGGERED
NEXT_TASK_ID=P2-T11-STAGE5F
NEXT_TASK_TITLE=PHASE C REAL SAME-ORIGIN MULTI-TAB BROWSER CERTIFICATION
NEXT_TASK_STATUS=READY
```

Repitió todo el preflight en fresco (nada mutó desde Stage5D), confirmó
proyecto/entorno de Railway (`amiable-rejoicing`/`TESTING`), ausencia de
deploy concurrente y salud de ambos servicios, y ejecutó exactamente un
`git push` (`e8d2171..f6ca24f`). Observó únicamente el autodeploy
Git-triggered normal — ambos servicios `SUCCESS`, confirmados sirviendo
exactamente `f6ca24f` por la metadata de despliegue de Railway (no por
inferencia). Con permiso explícito del usuario, creó 2 filas fixture
temporales en TESTING (`P2T11_STAGE5E_A`/`_B`, vía
`DELIGO_TEST_DATABASE_URL` exclusivamente) y certificó en RUNTIME contra
el servidor real: el JWT del actor desplegado mide `exp-iat=120` exacto
(no 300); conexión y reconexión activas PASS; un socket dejado
conectado se desconectó realmente a los ~119.9s por
`server namespace disconnect`; tras un logout real, el mismo actor JWT
prelogout fue rechazado en 1.226s (`TOKEN_INVALID`/`SESSION_INVALID
reason=inactive`) — Phase B sigue sin regresión tras el deploy de Phase
C; sesión independiente conectó sin verse afectada. Limpieza completa:
0 filas remanentes, sin rastro de scripts temporales en `git status`.
`HEAD=ORIGIN=f6ca24f`, `AHEAD=0`/`BEHIND=0`. Cross-tab queda desplegada
como código, sin certificación real de navegador (eso es Stage5F). Sin
deploy manual, sin mutación de Railway, sin Production. F-P2-T11-01 pasa
a `PHASE_C_DEPLOYED_SERVER_RUNTIME_CERTIFIED_AWAITING_REAL_BROWSER_CROSSTAB`
(no `RESOLVED`); P2-T11 no cerrado — listo para Stage5F, no ejecutada.

## P2-T11 — Stage 5F certificación real de multi-tab en navegador para Phase C — 2026-08-27

```
P2_T11_STAGE5F=PASS_PHASE_C_REAL_BROWSER_CROSSTAB_CERTIFICATION_LOW_RESIDUAL_PENDING_DISPOSITION
P2_T11_PHASE_C_COMMIT=f6ca24f78a4359fdf66e213b1a449a49426c1234
NEXT_TASK_ID=P2-T11-STAGE5G
NEXT_TASK_TITLE=FINAL ACCEPTANCE / FINDING DISPOSITION / CLOSEOUT
NEXT_TASK_STATUS=READY
```

Con un navegador Chromium real (Claude Browser pane, ya disponible, nada
instalado), dos pestañas del mismo contexto/origin de TESTING
compartiendo cookie y `localStorage`, certificó: logout productivo real
en Tab A → evento nativo `storage` en Tab B en 15-20ms (2 ciclos
independientes); Tab A con 0 eventos propios; Tab B limpia su
`RealtimeManager` de forma independiente; sin reconexión exitosa tras
10s + eventos reales de foco/visibilidad/red; sin storm de logout
server-side (exactamente 1 `POST /api/auth/logout` por ciclo); sin
efectos indebidos ante escrituras normales/malformadas/de clave no
relacionada/duplicadas en `deligo-auth` (todas con eventos genuinamente
generados por el navegador); login nuevo reactiva el realtime con un
epoch nuevo sin resucitar el viejo. Documentó una asimetría de diseño
observada empíricamente: el login no se propaga automáticamente entre
pestañas (sólo el logout). Intentó honestamente el residual de severidad
baja — sin control CDP de lifecycle en este toolset, e intento de
BFCache que el propio diagnóstico probó que fue una recarga real, no una
congelación — clasificado `NOT_TESTABLE_WITH_AVAILABLE_BROWSER_LIFECYCLE_CONTROL`,
ni resuelto ni declarado imposible. Con permiso explícito del usuario,
usó 1 fixture TESTING temporal, eliminada al finalizar (0 remanentes).
Cero mutación de fuente/test, cero push/deploy/Railway. `HEAD=ORIGIN=f6ca24f`
sin cambio. F-P2-T11-01 pasa a
`CORE_ACCEPTANCE_CERTIFIED_AWAITING_FINAL_CLOSEOUT_AND_RESIDUAL_DISPOSITION`
(no `RESOLVED`); P2-T11 no cerrado — listo para Stage5G (cierre final),
no ejecutada.

## P2-T11 — Stage 5G final closeout / finding disposition — 2026-08-27

```
P2_T11_STAGE5G=PASS_FINAL_ACCEPTANCE_FINDING_RESOLVED_TASK_CLOSED
F_P2_T11_01_STATUS=RESOLVED
P2_T11=CLOSED
P2_T11_CLOSED=SI
P2_T11_ACCEPTANCE_MATRIX_RESULT=10_OF_10_PASS
P2_T11_RESIDUAL_DISPOSITION=ACCEPTED_LOW_NON_SECURITY_BLOCKING_LIMITATION
HEAD=ORIGIN=f6ca24f78a4359fdf66e213b1a449a49426c1234
AHEAD=0
BEHIND=0
NEW_COMMIT=NO
PUSH=NO
DEPLOY=NO
NEXT_TASK_ID=P2-T18-STAGE1
NEXT_TASK_TITLE=Chat Cross-Tab UI Polish
NEXT_TASK_STATUS=READY
```

Cierre final read/audit-only, sin re-litigar Stage1-5F por continuidad
narrativa: reconstruyó y confrontó toda la cadena contra Git real (los
tres commits de P2-T11 forman una cadena estrictamente aditiva, probado
por diff byte-a-byte en Stage5D), los seis registros canónicos y los
archives de diseño (Stage1/Stage1B/Stage1B-R1/Stage2), sin contradicción.
Construyó la matriz de los 10 puntos de aceptación congelados en Stage2
— 10/10 PASS con evidencia runtime real server-side y de navegador real.
Evaluó el residual de logout tardío contra un modelo de amenaza de
cuatro preguntas (resurrección de sesión, reautorización de actor,
acceso no autorizado, escalación de privilegio) — las cuatro `NO` — y lo
dispuso como `ACCEPTED_LOW_NON_SECURITY_BLOCKING_LIMITATION`, con
política de reapertura explícita, sin forzar `RESOLVED` ni `IMPOSSIBLE`.
`F-P2-T11-01` pasa a `RESOLVED`; `P2-T11` pasa a `CLOSED`. La
terminación forzada cross-instance permanece fuera de este cierre —
mandato de P2-T09, no implementado aquí. Siguiente tarea canónica:
P2-T18-STAGE1 (Chat Cross-Tab UI Polish, complejidad 2/10) — definida,
no ejecutada.

## P2-T18 — Stage 1 historical recovery / current baseline / scope freeze — 2026-08-27

```
P2_T18_STAGE1=PASS_HISTORICAL_FINDINGS_RECOVERED_CURRENT_BASELINE_AND_SCOPE_FROZEN
P2_T18=BASELINE_SCOPE_FROZEN
F_P1_01_CURRENT_STATUS=REPRODUCED
F_P1_02_CURRENT_STATUS=REPRODUCED
P2_T18_STAGE1_FINDING_RELATIONSHIP=SAME_ROOT_CAUSE
P2_T18_STAGE1_BRANCH_DECISION=A_BOTH_IMPLEMENTATION_REQUIRED
P2_T18_STAGE1_ALLOWLIST_STATUS=FROZEN_HIGH_CONFIDENCE
HEAD=ORIGIN=f6ca24f78a4359fdf66e213b1a449a49426c1234
AHEAD=0
BEHIND=0
NEW_COMMIT=NO
PUSH=NO
DEPLOY=NO
NEXT_TASK_ID=P2-T18-STAGE2
NEXT_TASK_TITLE=CHAT CROSS-TAB UI POLISH — F-P1-01 / F-P1-02 LOCAL IMPLEMENTATION
NEXT_TASK_STATUS=READY
```

Recuperó textualmente `F-P1-01` (mensaje `messages-read` entregado a
pestaña hermana del mismo actor pero ignorado por la UI) y `F-P1-02`
(evento `user-typing` auto-reflejado en pestaña hermana del mismo
actor) desde `codex-reports/archive/LEGACY_FULL_REPORT_20260826.md` —
única autoridad, ninguno de los seis registros activos los contenía.
Ambos fueron originados en P1-T01/P1-T02 y agrupados en P1-T06 por
"mismo root gap, misma superficie de archivo". Re-derivó el estado
ACTUAL de forma independiente (no copió el histórico `OPEN`): lectura
exhaustiva del código real confirmó que el servidor
(`mini-services/chat-service/index.js`) sigue excluyendo únicamente el
socket emisor, nunca el actor, en los tres handlers `typing`/
`stop-typing`/`mark-read`, y que el cliente (`chat-sheet.tsx`) sigue sin
filtrar por identidad propia — código byte-idéntico al auditado hace un
año. Auditó fixes incidentales: P2-T04 (Chat Active-Message Resync)
tocó un subsistema adyacente pero documentó explícitamente en su propio
cierre que preservaba el no-op de `messages-read` sin cambio. Clasificó
ambos `REPRODUCED`, `UI_POLISH`, sin relación con P2-T11 (preservado
`CLOSED`), congeló contratos de aceptación independientes y un allowlist
candidato de 1 archivo de producto (`chat-sheet.tsx`, dos guardas de
identidad de una línea, client-side, sin tocar el servidor). No se
implementó ningún fix. Siguiente tarea: P2-T18-STAGE2 (implementación
local), no ejecutada.

## P2-T18 — Stage 2 local implementation — 2026-08-27

```
P2_T18_STAGE2=PASS_F_P1_01_F_P1_02_LOCAL_IMPLEMENTATION
P2_T18=LOCAL_IMPLEMENTED_AWAITING_PRECOMMIT_ADVERSARIAL_REVIEW
F_P1_01_CURRENT_STATUS=LOCAL_IMPLEMENTED_AWAITING_PRECOMMIT_REVIEW
F_P1_02_CURRENT_STATUS=LOCAL_IMPLEMENTED_AWAITING_PRECOMMIT_REVIEW
HEAD=ORIGIN=f6ca24f78a4359fdf66e213b1a449a49426c1234 (sin cambio)
AHEAD=0
BEHIND=0
NEW_COMMIT=NO
PUSH=NO
DEPLOY=NO
ACTUAL_DIFF_FILE_COUNT=2
PROPOSED_COMMIT_SUBJECT=fix: filter own-actor echo from chat typing and read events
NEXT_TASK_ID=P2-T18-STAGE3
NEXT_TASK_TITLE=CHAT CROSS-TAB UI POLISH — F-P1-01 + F-P1-02 PRE-COMMIT ADVERSARIAL REVIEW
NEXT_TASK_STATUS=READY
```

Implementó localmente ambos findings ciñéndose exactamente al allowlist
congelado por Stage1: en `src/components/chat/chat-sheet.tsx`, el
handler `user-typing` gana un guard de identidad de una línea
(`data.userId === user.id`) antes de `addTypingUser`, y el handler
`messages-read` — antes vacío — gana `data.readBy === user.id` seguido
de `updateConversationUnread(data.pedidoId, 0)`, reutilizando el mismo
patrón ya usado al abrir la propia conversación. `user-stop-typing`
quedó sin tocar (ya seguro por `.filter`). El archivo de test opcional
(`security.test.js`) NO se activó — servidor intocado, y
`chat-sheet.tsx` no tiene harness de renderizado DOM por diseño
preexistente del repo — en su lugar, `chat-consumer-static-contract.test.ts`
ganó 7 tests estructurales (orden de statements, ausencia de mutación
fuera de la rama condicional, comparaciones negativas contra campos
incorrectos). Certificado: 262/262 tests relacionados de Chat, 98/98 en
la suite completa del chat-service (servidor sin cambio, sin regresión),
TSC idéntico al baseline (31/24), 0 nuevos errores de lint, build PASS,
diff-check limpio. Diff total: 2 archivos, +89/-2 líneas, local y
unstaged — ningún commit creado. Siguiente tarea: P2-T18-STAGE3 (revisión
adversarial precommit), no ejecutada.

## P2-T18 — Stage 3 pre-commit adversarial review — 2026-08-27

```
P2_T18_STAGE3=PASS_F_P1_01_F_P1_02_PRECOMMIT_ADVERSARIAL_REVIEW
P2_T18=PRECOMMIT_CERTIFIED_READY_FOR_LOCAL_COMMIT
F_P1_01_CURRENT_STATUS=PRECOMMIT_CERTIFIED_AWAITING_LOCAL_COMMIT
F_P1_02_CURRENT_STATUS=PRECOMMIT_CERTIFIED_AWAITING_LOCAL_COMMIT
HEAD=ORIGIN=f6ca24f78a4359fdf66e213b1a449a49426c1234 (sin cambio)
AHEAD=0
BEHIND=0
NEW_COMMIT=NO
PUSH=NO
DEPLOY=NO
CORRECTION_COUNT=1
ACTUAL_DIFF_FILE_COUNT=2
FROZEN_COMMIT_SUBJECT=fix: filter own-actor echo from chat typing and read events
NEXT_TASK_ID=P2-T18-STAGE4
NEXT_TASK_TITLE=CHAT CROSS-TAB UI POLISH — F-P1-01 + F-P1-02 EXACT LOCAL COMMIT
NEXT_TASK_STATUS=READY
```

Auditó adversarialmente sin confiar en el `PASS` de Stage2: re-derivó
independientemente los payloads de los tres eventos desde el emisor
real del servidor, confirmó namespace de identidad compartido (cuid en
las tres tablas de actor), descartó falso-positivo por `undefined`
(relay ya envuelve en `try/catch`), y aplicó **9 mutaciones reales**
directamente sobre `chat-sheet.tsx` (respaldado y restaurado
byte-a-byte en cada paso, sin commit). Encontró **1 defecto real**: dos
tests de Stage2 no distinguían código real de un comentario —
comentar las llamadas mutantes dejando el texto presente pasaba las 43
pruebas sin fallo. Corregido dentro del allowlist (2 tests nuevos que
verifican que la línea no empieza con `//`); re-atacados los 9
mutantes, ahora 9/9 detectados. El código de producto resultó correcto
en las 9 mutaciones — ninguna requirió cambio. Certificado: 43/43 test
modificado, 264/264 unión de Chat, 98/98 chat-service, 0 nuevos errores
de lint/TSC, build PASS, diff-check limpio. Diff final: 2 archivos,
+103/-2, local y unstaged. Siguiente tarea: P2-T18-STAGE4 (commit local
exacto), no ejecutada.

## P2-T18 — Stage 4 exact local commit — 2026-08-27

```
P2_T18_STAGE4=PASS_F_P1_01_F_P1_02_EXACT_LOCAL_COMMIT
P2_T18=LOCAL_COMMIT_COMPLETE_AWAITING_POSTCOMMIT_EXACT_BLOB_REVIEW
F_P1_01_CURRENT_STATUS=LOCAL_COMMIT_COMPLETE_AWAITING_POSTCOMMIT_REVIEW
F_P1_02_CURRENT_STATUS=LOCAL_COMMIT_COMPLETE_AWAITING_POSTCOMMIT_REVIEW
COMMIT=1adcc01f5380d896bed6e46dcd11bccb90d39e07
COMMIT_PARENT=f6ca24f78a4359fdf66e213b1a449a49426c1234
COMMIT_SUBJECT=fix: filter own-actor echo from chat typing and read events
COMMIT_FILE_COUNT=2
HEAD=1adcc01f5380d896bed6e46dcd11bccb90d39e07
ORIGIN=f6ca24f78a4359fdf66e213b1a449a49426c1234 (sin mover)
AHEAD=1
BEHIND=0
PUSH=NO
DEPLOY=NO
NEXT_TASK_ID=P2-T18-STAGE5
NEXT_TASK_TITLE=CHAT CROSS-TAB UI POLISH — POST-COMMIT / PRE-PUSH EXACT-BLOB REVIEW
NEXT_TASK_STATUS=READY
```

Antes de stagear, cerró un gate de precisión de identidad exigido
explícitamente: probó con evidencia de tipos + un `throw` runtime real
del productor (`mini-services/chat-service/index.js:80`, rechaza
cualquier conexión con `sub` ausente/vacío ANTES de que `socket.data.actor`
exista) que `data.userId`/`data.readBy` nunca pueden ser `undefined` en
producción — cerrando el ataque de falso self-match por
`undefined === undefined` con evidencia más fuerte que el `try/catch`
que Stage3 había citado. Documentó honestamente un hallazgo colateral
no bloqueante en `auth-store.ts` (cast sin validación al rehidratar
`localStorage`), analizado y descartado como no explotable. Stageó
explícitamente los 2 paths exactos, auditó el índice, leyó ambos blobs
staged completos, y ejecutó un único intento de commit exitoso. Commit
resultante recertificado directamente desde los objetos Git — IDs de
blob coincidentes con los del diff pre-commit, sin drift. Sin push, sin
deploy. Siguiente tarea: P2-T18-STAGE5 (revisión postcommit/pre-push de
blobs exactos), no ejecutada.

## P2-T18 — Stage 5 postcommit/pre-push exact-blob review — 2026-08-27

```
P2_T18_STAGE5=PASS_POSTCOMMIT_PREPUSH_EXACT_BLOB_REVIEW
P2_T18=POSTCOMMIT_CERTIFIED_READY_FOR_FRESH_TESTING_PREPUSH
F_P1_01_CURRENT_STATUS=POSTCOMMIT_CERTIFIED_READY_FOR_TESTING_PREPUSH
F_P1_02_CURRENT_STATUS=POSTCOMMIT_CERTIFIED_READY_FOR_TESTING_PREPUSH
HEAD=1adcc01f5380d896bed6e46dcd11bccb90d39e07 (sin cambio)
ORIGIN=f6ca24f78a4359fdf66e213b1a449a49426c1234 (sin mover)
AHEAD=1
BEHIND=0
NEW_COMMIT=NO
PUSH=NO
DEPLOY=NO
NEXT_TASK_ID=P2-T18-STAGE6
NEXT_TASK_TITLE=CHAT CROSS-TAB UI POLISH — FRESH TESTING PREPUSH / EXACT PUSH / GIT-TRIGGERED DEPLOY CERTIFICATION
NEXT_TASK_STATUS=READY
```

Recertificó el commit `1adcc01` de forma independiente, desde los
objetos Git — no desde el resumen de Stage4: recalculó identidad
(HEAD/HEAD^/tree/subject, idénticos), derivó el fileset (2/2), y
recalculó los 2 blob IDs COMPLETOS de forma independiente vía
`git ls-tree` (`d752aa12ecc40902c64c415d95f17d4275dc9eed`,
`c4f79b43b0fb4a32a11d06d79ed83d46d2e8bdc8`, coincidentes exactos). Leyó
ambos blobs committed completos, y re-derivó — sin copiar la conclusión
de Stage4 — el gate de identidad/nulabilidad releyendo directamente
`mini-services/chat-service/index.js:80` (el `throw` explícito e
inalterado que garantiza `data.userId`/`data.readBy` nunca `undefined`
en producción). Confirmó `git diff HEAD^ HEAD` vacío sobre servidor/
auth/T11/RealtimeManager/realtime-provider, y working tree idéntico a
`HEAD`. Certificó: 43/43 test modificado, 264/264 unión de Chat, 98/98
chat-service, 0 nuevos errores de lint/TSC, build PASS, `git show
--check`/`git diff --check` limpios. Corrigió dos referencias
documentales stale (detalle de Stage4 apuntando a `CURRENT_TASK.md` en
vez de su archive; marcadores `NEW_COMMIT`/`PUSH`/`DEPLOY` del bloque
de P2-T11 que, sin calificar, podían leerse como estado global actual
— ahora acotados explícitamente "dentro del alcance de P2-T11"). Sin
push, sin deploy. Siguiente tarea: P2-T18-STAGE6 (fresh testing
prepush / push exacto / certificación de deploy Git-triggered), no
ejecutada. Detalle completo en
`codex-reports/archive/P2-T18-STAGE5.md`.

## P2-T18 — Stage 6 fresh testing prepush + exact push + Git-triggered deploy certification — 2026-08-27

```
P2_T18_STAGE6=PASS_TESTING_EXACT_PUSH_GIT_TRIGGERED_DEPLOY_CERTIFICATION
P2_T18=DEPLOYED_TESTING_AWAITING_REAL_BROWSER_CERTIFICATION
F_P1_01_CURRENT_STATUS=DEPLOYED_TESTING_AWAITING_REAL_BROWSER_CERTIFICATION
F_P1_02_CURRENT_STATUS=DEPLOYED_TESTING_AWAITING_REAL_BROWSER_CERTIFICATION
HEAD=1adcc01f5380d896bed6e46dcd11bccb90d39e07
ORIGIN=1adcc01f5380d896bed6e46dcd11bccb90d39e07
AHEAD=0
BEHIND=0
NEW_COMMIT=NO
PUSH=SI
PUSH_COUNT=1
DEPLOY=SI_TESTING_GIT_TRIGGERED
DELIGO_DEPLOYMENT_ID=fb41d224-c993-4b9f-b632-eb3a5ee614b9
CHAT_DEPLOYMENT_ID=b6d48c4b-1592-494d-96ef-5dca8ae36ed9
DELIGO_DEPLOY_STATUS=SUCCESS
CHAT_DEPLOY_STATUS=SUCCESS
NEXT_TASK_ID=P2-T18-STAGE7
NEXT_TASK_TITLE=CHAT CROSS-TAB UI POLISH — REAL SAME-BROWSER MULTI-TAB RUNTIME CERTIFICATION
NEXT_TASK_STATUS=READY
```

Repitió en fresco todo el preflight (nada mutó desde Stage5), recheck
exacto de commit/fileset/blobs (2/2 sin drift), re-ejecutó la batería
completa (43/43 test modificado, 264/264 unión de Chat, 98/98
chat-service, 0 errores nuevos de lint/TSC, build PASS, git checks
limpios), confirmó Railway `amiable-rejoicing`/`TESTING` (nunca
Production) sin deployment concurrente y con ambos servicios sanos en
el commit padre `f6ca24f`, y ejecutó **exactamente un**
`git push origin testing-codex` (`f6ca24f..1adcc01`, sin `--force`).
Observó únicamente (sin `railway up`/redeploy manual) el autodeploy
Git-triggered: `DeliGO Copy` y `chat en vivo` terminaron `SUCCESS`,
ambos sirviendo exactamente `1adcc01` — confirmado vía el campo
`commitHash` de `railway status --json`, no inferido. Logs sin
`error`/`fatal`/`panic`/`failed`; sin migración pendiente ni fallida;
health HTTP post-deploy normal en ambos servicios. `HEAD=ORIGIN=1adcc01`,
`AHEAD=0`/`BEHIND=0`. Sin mutación de Railway, sin DB real, sin
navegador real, Production intacta. F-P1-01/F-P1-02 permanecen
explícitamente abiertos — la certificación final con navegador real
multi-pestaña queda diferida a Stage7, no ejecutada. Detalle completo
en `codex-reports/archive/P2-T18-STAGE6.md`.

## P2-T18 — Stage 7 real same-browser multi-tab runtime certification — 2026-08-27

```
P2_T18_STAGE7=BLOCKED_REAL_BROWSER_CONTROL_UNAVAILABLE
P2_T18=DEPLOYED_TESTING_AWAITING_REAL_BROWSER_CERTIFICATION (sin cambio)
F_P1_01_CURRENT_STATUS=DEPLOYED_TESTING_AWAITING_REAL_BROWSER_CERTIFICATION (sin cambio)
F_P1_02_CURRENT_STATUS=DEPLOYED_TESTING_AWAITING_REAL_BROWSER_CERTIFICATION (sin cambio)
BLOCKER=NON_COMPOSITING_BROWSER_PANE + ZERO_CONNECTED_CLAUDE_IN_CHROME
NEW_COMMIT=NO
PUSH=NO
DEPLOY=NO
NEXT_TASK_ID=P2-T18-STAGE7-R1
NEXT_TASK_STATUS=BLOCKED_PENDING_USER_ACTION
```

Se intentó certificar F-P1-01/F-P1-02 con navegador real contra el
commit ya desplegado en TESTING. El motor de navegador disponible
(Claude Browser pane, Chromium vía CDP) navega y lee el DOM
correctamente, pero su compositor nunca produce frames en esta sesión
— confirmado con tres evidencias independientes y convergentes:
`computer{action:"screenshot"}` lo declara explícitamente; un
`requestAnimationFrame` real nunca se resuelve en 30s; y la propia
animación de apertura del modal de login del producto (Framer
Motion/CSS transition) queda congelada a mitad de camino
(`transform: translateY(541px)`, nunca llega a la posición visible
final). Un botón HTML plano de diagnóstico confirmó que el clic sí
llega al DOM, pero el `handleSubmit` real de React del formulario de
login nunca completó un `POST /api/auth/login` observable en la red
tras 5+ intentos — un `fetch()` de diagnóstico aparte confirmó que el
mismo endpoint acepta las credenciales reales del fixture sin
problema, aislando la causa al tooling de navegador, nunca al
producto. La vía alternativa (Claude in Chrome, el navegador real del
usuario) reportó 0 navegadores conectados. Se creó y limpió por
completo (0 remanentes) el fixture temporal mínimo requerido (`Cliente`
X + `Negocio` Y + `Pedido` compartido, prefijo "P2T18 Stage7"). Ninguna
sustitución prohibida fue usada. `HEAD=ORIGIN=1adcc01`, `AHEAD=0`/
`BEHIND=0`, sin mutación de Railway, sin push/commit/deploy, Production
intacta, P2-T11 permanece `CLOSED`. Requiere que el usuario muestre el
Browser pane o conecte Claude in Chrome antes de reintentar en Stage7-R1.
Detalle completo en `codex-reports/archive/P2-T18-STAGE7.md`.

## P2-T18 — Stage 7-R1 real browser recovered / runtime defect discovered — 2026-08-27

```
P2_T18_STAGE7_R1=BLOCKED_REAL_BROWSER_RUNTIME_DEFECT
P2_T18=DEPLOYED_TESTING_RUNTIME_DEFECT_DISCOVERED_DURING_BROWSER_CERTIFICATION
F_P1_01_CURRENT_STATUS=DEPLOYED_TESTING_AWAITING_REAL_BROWSER_CERTIFICATION (sin cambio, no se completó su prueba)
F_P1_02_CURRENT_STATUS=REAL_BROWSER_RUNTIME_DEFECT_DISCOVERED
DB_REAL_READ=SI (temporal, fixture "P2T18 Stage7 R1", limpiado)
DB_REAL_WRITE=SI (temporal, mismo alcance)
NEW_COMMIT=NO
PUSH=NO
DEPLOY=NO
NEXT_TASK_ID=P2-T18-STAGE7-R1A
NEXT_TASK_STATUS=READY
```

Recuperó el navegador real: Chrome local ya instalado, lanzado headless
vía CDP crudo (WebSocket nativo de Node, sin dependencias nuevas —
Playwright/Puppeteer/CRI ausentes del entorno), perfil temporal
aislado. Smoke previo confirmó compositor genuinamente activo
(`requestAnimationFrame` real, ~86fps, transición CSS progresando,
screenshot real, clic real) — supera el bloqueo de Stage7. Con fixture
temporal mínimo (`Cliente` X + `Negocio` Y + `Pedido` compartido,
prefijo "P2T18 Stage7 R1"), login productivo real, topología de 3
pestañas/2 `BrowserContext`, y baseline de chat bidireccional
certificados, la certificación de F-P1-02 avanzó hasta un runtime
defect/ambigüedad material: el control remoto Y→X (Negocio tipea,
Cliente ve) funcionó perfecto y reproducible, pero X→Y (Cliente tipea,
Negocio debería ver) nunca actualizó la UI del receptor pese a
evidencia positiva en cada capa intermedia — el servidor emite (26/26
frames reales), el frame llega íntegro al `WebSocket` real de la
página de Y1 (confirmado a nivel de red vía CDP Y a nivel de JS de
página vía un parche inyectado en `WebSocket`), y el scope
`chat:typing` está confirmado autorizado (ACK del servidor capturado).
Por instrucción explícita del usuario, la investigación se detuvo en
ese punto — la causa raíz **no** se determinó ni se atribuye a ningún
componente sin prueba concluyente adicional. F-P1-01 no llegó a
ejecutarse. Ningún fix de código fue intentado. Fixture y navegador
temporal limpiados por completo (0 remanentes). `HEAD=ORIGIN=1adcc01`,
`AHEAD=0`/`BEHIND=0`, sin mutación de fuente/test, sin commit/push/
deploy, sin mutación de Railway, Production intacta, P2-T11 permanece
`CLOSED`. Siguiente tarea: **P2-T18-STAGE7-R1A** (diagnóstico acotado
de la ruta X→Y del typing: server emit → WebSocket frame received by Y
→ client realtime dispatch → ChatSheet callback → store/UI render),
no ejecutada. Detalle completo en `codex-reports/CURRENT_TASK.md`.

## P2-T18-BLOCKER-AUTH2-R9 — revisión adversarial precommit de Fase 2 (SAME_BROWSER_MULTI_ACTOR_SESSION_COEXISTENCE) — 2026-08-28

```
P2_T18_BLOCKER_AUTH2_R9=BLOCKED_PHASE2_PRECOMMIT_DEFECT_REQUIRES_FOCUSED_CORRECTION
R9_MUTANTS_ATTEMPTED=12
R9_MUTANTS_DETECTED=10
R9_MUTANTS_SURVIVED=2
NEXT_TASK_ID=P2-T18-BLOCKER-AUTH2-R9-R1
NEXT_TASK_STATUS=READY_NOT_EXECUTED
```

Revisión independiente, read-only y adversarial de los 11 paths
locales de Fase 2 que AUTH2-R8 dejó implementados (7 de producto, 4 de
test) — separada del hilo cronológico de F-P1-01/F-P1-02 de arriba,
pertenece al blocker F-P2-T18-AUTH01 que sigue reteniendo el cierre
final de F-P1-02 con navegador real. Re-derivó el fileset desde Git
(no de la lista de rutas del propio prompt de la etapa, que tenía dos
rutas aproximadas incorrectas), re-leyó el diff completo hunk por hunk,
re-enumeró los 4 callers reales de `/api/auth/me` (sin caller nuevo),
ejecutó 18/18 casos de ataque de boundary de pathname, y re-verificó
byte-idénticos los 6 vecinos congelados. El único hallazgo material
vino de mutation testing aislado fuera del repo (12 mutantes, nunca
tocando el repositorio real): 10/12 detectados por la batería
existente, 2/12 sobrevivieron — un `getItem` de storage hardcodeado a
la familia Cliente (gap: ningún test ejercita la rehidratación de una
instancia fresca del store), y un listener cross-tab que aceptaría
también la clave legacy plana (gap: la assertion #2 del contrato
estático de P2-T11 sólo detecta presencia del patrón correcto, no
ausencia de un bypass OR agregado). En ambos casos el código real
shippeado se confirmó correcto por lectura directa — son gaps de
cobertura de test, no defectos de producto. Por regla explícita de la
etapa (mutante sobreviviente sin prueba de arnés inválido → BLOCK, sin
corrección de test permitida en R9), la conclusión es **BLOCK**: el
diff de R8 queda preservado sin ningún cambio, y se define un único
follow-up focal, `P2-T18-BLOCKER-AUTH2-R9-R1`, que agrega exactamente
esas dos piezas de cobertura de test, sin tocar código de producción.
`HEAD=ORIGIN=c047e9eb` sin cambio, 130/130 tests frescos, lint/TSC/
build limpios, cero commit/push/deploy. Esta etapa también creó por
primera vez `DELIGO_FULL_CONTEXT_LATEST.md` en la raíz del repo como
`CROSS_CHAT_PRIMARY_HANDOFF` autocontenido, construido exclusivamente
desde las 8 autoridades nombradas más el estado real de Git — nunca
reconstruido de memoria — mientras `CODEX_REPORT.md` sigue siendo el
`CURRENT_MASTER_TASK_HANDOFF`. Detalle completo en
`codex-reports/CURRENT_TASK.md`; R8 archivado en
`codex-reports/archive/P2-T18-BLOCKER-AUTH2-R8.md`.

## P2-T18-BLOCKER-AUTH2-R9-R1 — cierre focalizado sólo-test de los 2 gaps de R9 — 2026-08-28

```
P2_T18_BLOCKER_AUTH2_R9_R1=PASS_PHASE2_TEST_COVERAGE_GAPS_CLOSED_PRECOMMIT_RECERTIFIED
R9_R1_MUTANTS_DETECTED=12
R9_R1_MUTANTS_SURVIVED=0
NEXT_TASK_ID=P2-T18-BLOCKER-AUTH2-R10
NEXT_TASK_STATUS=READY_NOT_EXECUTED
```

Corrección estrictamente sólo-test de los 2 gaps de cobertura que R9
dejó bloqueando la etapa (mutantes #5 y #12), sin tocar los 7 archivos
de producto de Fase 2 ni los otros 2 archivos de test ya certificados
sin gaps por R9 (todos re-verificados byte-idénticos). Cerró el
mutante #5 con 2 tests en `auth-store.test.ts` que fuerzan una
rehidratación real vía `useAuthStore.persist.rehydrate()` contra
fixtures de Cliente/Negocio pre-sembradas — el camino de lectura real
que ningún test anterior ejercitaba directamente. Cerró el mutante #12
con 1 test en `realtime-provider-cross-tab-static-contract.test.ts`
que aísla la línea exacta del guard cross-tab y exige ausencia de
cualquier `||`/`&&` adicional, sin reescribir la assertion #2 original
(su debilidad estructural documentada permanece como tal, ahora
compensada, no "arreglada"). El propio proceso de mutation testing
encontró y corrigió, dentro del harness aislado (nunca en el repo
real), un bug de normalización de saltos de línea introducido por
Python en modo texto sin `newline=''` en Windows — confirmado inocuo
para los mutantes ya aplicados y corregido antes de continuar. Replay
completo: 12/12 mutantes ahora detectados (0 sobrevivientes), sin
cambiar la definición de ningún mutante. 133/133 tests frescos (130
preexistentes + 3 nuevos, 0 regresión), 20/20 seguridad, 10/10
aceptación, lint/TSC/build limpios. Un timeout transitorio en la
primera corrida de integración contra la DB real de TESTING (latencia
de red) se investigó por reproducibilidad — segunda corrida con más
tiempo dio 31/31 PASS, confirmando infraestructura externa lenta, no
regresión. `HEAD=ORIGIN=c047e9eb` sin cambio, cero commit/push/deploy.
F-P2-T18-AUTH01 pasa a
`PHASE2_PRECOMMIT_CERTIFIED_AWAITING_EXACT_LOCAL_COMMIT`. Detalle
completo en `codex-reports/CURRENT_TASK.md`; R9 archivado en
`codex-reports/archive/P2-T18-BLOCKER-AUTH2-R9.md`. Siguiente tarea:
`P2-T18-BLOCKER-AUTH2-R10` (commit exacto local de Fase 2), no
ejecutada.

## P2-T18-BLOCKER-AUTH2-R10 — commit local exacto de Fase 2 (sin push) — 2026-08-28

```
P2_T18_BLOCKER_AUTH2_R10=PASS_PHASE2_EXACT_LOCAL_COMMIT
R10_COMMIT_HASH=a1579f11e79a41b90c6df4d2e8573ca9a669b856
R10_COMMIT_PARENT=c047e9eb67e97ca1b9c1ae78b4c2725f44b02ebb
AHEAD_POSTCOMMIT=1
NEXT_TASK_ID=P2-T18-BLOCKER-AUTH2-R11
NEXT_TASK_STATUS=READY_NOT_EXECUTED
```

Convirtió el diff local de Fase 2 (11 paths, ya certificado
adversarialmente por R9 y con mutation testing 12/12 por R9-R1) en
exactamente un commit local, sin push. Re-derivó el fileset exacto y
lo confrontó contra la lista de rutas del propio prompt (coincidencia
exacta, sin drift), re-hasheó los 11 paths y los 6 vecinos congelados
(idénticos), y corrió la autoridad completa de test como corrida
DECISIVA ÚNICA — 133/133 a la primera. No repitió la campaña de
mutation testing de 12 mutantes — el fingerprint byte-a-byte idéntico
más la corrida fresca bastaron como prueba de identidad exigida por la
etapa. Stageó explícitamente los 11 paths (`git add --`, nunca `-A`),
auditó el índice completo (0 archivo extra, ningún report/context/`32`/
vecino congelado), comparó cada blob staged contra el certificado
(11/11), leyó el diff staged completo sin muestreo (0 hunks sin
clasificar), y — sólo entonces — ejecutó exactamente
`git commit -m "feat: enable actor-family client auth coexistence"`
(subject pre-congelado por el prompt). Recertificó el commit
`a1579f11e79a41b90c6df4d2e8573ca9a669b856` (parent `c047e9eb`)
directamente desde los objetos Git — 11/11 blobs commiteados idénticos
a los staged, working tree limpio contra HEAD, exactamente 11 paths en
el commit (sin extra). `AHEAD=1`/`BEHIND=0` contra `origin/testing-codex`
(sin cambio, `c047e9eb`) — Fase 2 commiteada localmente, **NO
pusheada**. Cero mutación de fuente/test, cero push/deploy/Railway.
F-P2-T18-AUTH01 pasa a
`PHASE2_LOCAL_COMMIT_COMPLETE_AWAITING_POSTCOMMIT_PREPUSH_EXACT_REVIEW`.
Detalle completo en `codex-reports/CURRENT_TASK.md`; R9-R1 archivado en
`codex-reports/archive/P2-T18-BLOCKER-AUTH2-R9-R1.md`. Siguiente tarea:
`P2-T18-BLOCKER-AUTH2-R11` (revisión postcommit/prepush de blobs
exactos), no ejecutada.

## P2-T18-BLOCKER-AUTH2-R11 — recertificación postcommit/prepush independiente de blobs — 2026-08-28

```
P2_T18_BLOCKER_AUTH2_R11=PASS_PHASE2_POSTCOMMIT_PREPUSH_EXACT_BLOB_REVIEW
R11_BLOB_MATCH_R10=11_OF_11_PASS
R11_MUTATION_COVERAGE=12_OF_12_BY_CERTIFIED_BLOB_IDENTITY
NEXT_TASK_ID=P2-T18-BLOCKER-AUTH2-R12
NEXT_TASK_STATUS=READY_NOT_EXECUTED
```

Recertificó el commit `a1579f11e79a41b90c6df4d2e8573ca9a669b856`
directamente desde los objetos Git, sin confiar en la narrativa de
R10: re-derivó el fileset (11 paths, coincide con la lista externa del
prompt), re-derivó los 11 blob IDs vía `git ls-tree HEAD` (11/11
idénticos a la autoridad certificada), leyó los 11 blobs completos vía
`git show HEAD:<path>`, y re-generó/re-clasificó el diff completo
`HEAD^..HEAD` (19 hunks, 0 sin clasificar). Re-derivó la semántica de
boundary-safety ejecutando el código exacto del blob committed
standalone (18 casos, incluidos `/clientevil`/`/negociomal`/
`/superadministrator`), confirmó por lectura directa el guard cross-tab
de igualdad exacta y la cobertura selector/logout, y verificó los 6
vecinos congelados sin diff entre `HEAD^` y `HEAD`. En vez de repetir
la campaña completa de mutation testing, probó identidad exacta de
bytes (commit == staged R10 == certificado R9-R1) para declarar
aplicable la autoridad 12/12 sin cambios. Reconstruyó independientemente
20/20 seguridad y 10/10 aceptación, corrió la autoridad completa como
corrida decisiva única (133/133), y confirmó lint/TSC/`git show
--check`/`git diff --check`/build limpios con fingerprint 11/11
estable. Corrigió, sólo como documentación, un párrafo de orientación
en `CODEX_REPORT.md` que había quedado desactualizado desde antes de
R8 (todavía decía "sin commitear todavía"). `HEAD=a1579f1`/`origin=c047e9eb`
sin cambio, `AHEAD=1`/`BEHIND=0`, cero commit/push/deploy. Fase 2 pasa
a `PHASE2_POSTCOMMIT_CERTIFIED_READY_FOR_FRESH_TESTING_PREPUSH` —
técnicamente certificada para push, pero sin otorgar un push futuro
ciego: `P2-T18-BLOCKER-AUTH2-R12` debe repetir gates decisivos frescos
inmediatamente antes del push real. Detalle completo en
`codex-reports/CURRENT_TASK.md`; R10 archivado en
`codex-reports/archive/P2-T18-BLOCKER-AUTH2-R10.md`. Siguiente tarea:
`P2-T18-BLOCKER-AUTH2-R12` (gates frescos + push + deploy TESTING +
certificación runtime), no ejecutada.

## P2-T18-BLOCKER-AUTH2-R12 — push exacto a TESTING + autodeploy certificado — 2026-08-28

```
P2_T18_BLOCKER_AUTH2_R12=PASS_PHASE2_TESTING_PUSH_DEPLOY_CERTIFIED_AWAITING_REAL_BROWSER
R12_PUSH_MOVEMENT=c047e9eb..a1579f11
DELIGO_DEPLOY_COMMIT_EXACT=SI
CHAT_DEPLOY_COMMIT_EXACT=SI
NEXT_TASK_ID=P2-T18-BLOCKER-AUTH2-R13
NEXT_TASK_STATUS=READY_NOT_EXECUTED
```

Repitió en fresco toda la revalidación decisiva (fileset/blobs 11/11
idénticos a R11, vecinos congelados sin drift, 133/133 tests a la
primera corrida, 20/20 seguridad, 10/10 aceptación, mutation authority
12/12 por identidad de blobs, lint/TSC/build limpios), confirmó
Railway inequívocamente en `amiable-rejoicing`/`TESTING` sin deploy
concurrente, y health prepush limpio. Ejecutó **exactamente un**
`git push origin testing-codex` (`c047e9eb..a1579f1`, sin `--force`) —
`HEAD=ORIGIN=a1579f11`, `AHEAD=0`/`BEHIND=0`. Observó únicamente (sin
`railway up`/redeploy manual) el autodeploy Git-triggered: `DeliGO
Copy` y `chat en vivo` terminaron `SUCCESS`, ambos sirviendo
exactamente `a1579f11` — confirmado vía el campo `commitHash` de la
metadata real de Railway, no inferido del éxito del `git push`. Logs
sin `error`/excepción; sin migración pendiente (esperado, Fase 2 no
toca schema); health postdeploy limpio en ambos servicios. Ejecutó un
smoke de regresión de Fase 1 server sin navegador (7 casos HTTP
directos) — comportamiento fail-closed uniforme sin importar el valor
del selector, sin `Set-Cookie` filtrado, sin fallback cruzado de
familia, sin 5xx. `PHASE2_DEPLOYED_FROM_EXACT_COMMIT=SI` confirmado
por metadata de Railway en ambos servicios;
`PHASE2_BROWSER_BEHAVIOR_CERTIFIED=NO` — resultado esperado, la
certificación real de navegador queda íntegramente para
`P2-T18-BLOCKER-AUTH2-R13`. Cero navegador real, cero fixture manual
nueva, Production intacta. Fase 2 pasa a
`PHASE2_DEPLOYED_TESTING_AWAITING_SAME_BROWSER_REAL_ACCEPTANCE`.
Detalle completo en `codex-reports/CURRENT_TASK.md`; R11 archivado en
`codex-reports/archive/P2-T18-BLOCKER-AUTH2-R11.md`. Siguiente tarea:
`P2-T18-BLOCKER-AUTH2-R13` (certificación con navegador real de la
coexistencia Cliente+Negocio en el mismo navegador — disposición final
de F-P2-T18-AUTH01), no ejecutada.

## P2-T18-BLOCKER-AUTH2-R13 — certificación real-browser Cliente+Negocio — BLOCKED (defecto real aislado) — 2026-08-28

```
P2_T18_BLOCKER_AUTH2_R13=BLOCKED_REAL_BROWSER_PRODUCT_DEFECT
F_P2_T18_AUTH01_STATUS=OPEN_REAL_BROWSER_DEFECT_ISOLATED
R13_AUTH01_ACCEPTANCE_MATRIX=9_OF_18_CONFIRMED_1_OF_18_CLEANUP_8_OF_18_NOT_REACHED
NEXT_TASK_ID=P2-T18-BLOCKER-AUTH2-R13-R1
NEXT_TASK_STATUS=READY_NOT_EXECUTED
```

Certificación con Chrome real (Claude in Chrome — dos navegadores
conectados detectados; el Claude Browser pane integrado mostró la misma
firma histórica de compositor no funcional (`requestAnimationFrame`
nunca resuelve), así que se preguntó explícitamente al usuario cuál de
los dos navegadores reales usar — usuario eligió "Browser 2"), contra
TESTING desplegado en el commit exacto `a1579f11` (confirmado por
metadata real de Railway antes de empezar). Fixture mínimo autorizado
(1 Cliente + 1 Negocio) resultó insuficiente para ejercer
`realtime/token`+`realtime/authorize` de forma productiva —
`acquireOrderRoom()` sólo se dispara desde un Pedido real
(`src/lib/realtime-manager.ts`) — así que se preguntó al usuario, quien
autorizó ampliar mínimamente con 1 Producto + 1 Pedido vinculando
ambos actores.

Confirmado con UI real y evidencia de red real: login productivo de
Cliente y Negocio en el mismo navegador (con corrección de dos
intentos contaminados por autocompletado del navegador real,
resueltos con selección/borrado explícito antes de retipear);
coexistencia simultánea de `deligo-auth:cliente`+`deligo-auth:negocio`
en `localStorage` del mismo origen; Cliente sobreviviendo sin recargar
al login de Negocio — el ataque directo al bug original de AUTH01, sin
colisión; reload determinístico para ambos actores, incluida una
ronda alternada adicional sin hidratación cruzada; y selectores de
`realtime/token`+`realtime/authorize` correctos para Cliente, vía un
chat real abierto desde la UI productiva sobre el Pedido fixture.

A mitad de la matriz (al reabrir el chat de Cliente tras el reload) se
descubrió, con evidencia de red real (200 consistente antes del login
de Negocio → 401 consistente después, con las mismas llamadas),
un defecto real de producto — registrado por separado como
**F-P2-T18-AUTH02** en `codex-reports/FINDINGS.md` — root-caused por
lectura directa de código a `AUTH_REQUIRED_PREFIXES` en `src/proxy.ts`
(`/api/chat`, `/api/push/subscribe`, `/api/push/unsubscribe`), una
categoría nunca incluida en `SELECTOR_ENDPOINT_PREFIXES` ni derivable
por path — cuyo fallback de `resolveActorSession()` falla cerrado
(sin cookie reescrita) en cuanto coexisten 2+ cookies de familia. Por
regla explícita de la etapa ("no corregir en R13, preservar evidencia,
cleanup, reportar BLOCK") se detuvo la ejecución del resto de la
matriz sin intentar ninguna corrección. Resultado final: 9/18
confirmados + 1/18 cleanup, 8/18 no alcanzados por el corte
temprano — no 18/18, por lo que R13 no puede pasar a PASS.

Fixtures (Cliente + Negocio + Producto + Pedido + 2 filas Sesion
huérfanas) limpiadas en su totalidad (0 remanentes); estado de
`localStorage` limpiado en ambas pestañas; ambas pestañas cerradas.
Git final `HEAD=ORIGIN=a1579f11e79a41b90c6df4d2e8573ca9a669b856`,
`AHEAD=0`/`BEHIND=0`, `src/` sin cambios, índice vacío. Detalle
completo en `codex-reports/CURRENT_TASK.md`. Siguiente tarea:
`P2-T18-BLOCKER-AUTH2-R13-R1` — corrección focal única y aislada del
defecto F-P2-T18-AUTH02, tras la cual R13 debe repetirse completa
desde cero (no una continuación) para certificar 18/18 antes de
disponer F-P2-T18-AUTH01 como `RESOLVED`.

## P2-T18-BLOCKER-AUTH2-R13-R1 — reconciliación read-only de F-P2-T18-AUTH02 — PASS — 2026-08-28

```
P2_T18_BLOCKER_AUTH2_R13_R1=PASS_AUTH02_ROOT_CAUSE_SCOPE_AND_FIX_CONTRACT_REFROZEN
F_P2_T18_AUTH02_STATUS=CONTRACT_FROZEN_READY_FOR_LOCAL_IMPLEMENTATION
F_P2_T18_AUTH01_STATUS=OPEN_BLOCKED_BY_AUTH02_FIX_AND_FULL_R13_REPLAY
AUTH02_RECONCILED_PRODUCT_ALLOWLIST_COUNT=7
AUTH02_RECONCILED_TEST_ALLOWLIST_COUNT=7
NEXT_TASK_ID=P2-T18-BLOCKER-AUTH2-R13-R2
NEXT_TASK_STATUS=READY_NOT_EXECUTED
```

Tarea read-only (sin mutación de código/test/commit/push/deploy/DB/
navegador). Releyó `src/proxy.ts` completo y confirmó el mecanismo
exacto: el rewrite de cookie es incondicional a
`AUTH_REQUIRED_PREFIXES` — depende únicamente de si `resolved.token`
es truthy — así que cualquier endpoint que lea la cookie legacy
directamente sufre la misma ambigüedad bajo 2+ candidatas, esté o no
en esa lista. Esto llevó a un hallazgo de alcance ampliado que R13
nunca observó: `/api/push/status` (fuera de `AUTH_REQUIRED_PREFIXES`,
pero con idéntico patrón de lectura directa de `SESSION_COOKIE_NAME`)
también está afectado y debe entrar en el fix. Confirmó por lectura
directa de código (no por inferencia) que `/api/push/unsubscribe`
también está afectado, cerrando la ambigüedad que R13 había dejado
como "probable". Enumeró exhaustivamente los 8 endpoints del
`AUTH_REQUIRED_PREFIXES` (Chat: no-leidos/conversaciones/
mensajes/[pedidoId]/cleanup; Realtime: token/authorize, ya cubiertos;
Push: subscribe/unsubscribe) y buscó en los 106 archivos que leen la
cookie legacy en algún punto para clasificar cada patrón similar:
`/api/pedidos` (creación) y `/api/pedidos/[id]/tracking` comparten el
mismo patrón pero degradan silenciosamente a "invitado" en vez de
fallar con 401 duro — nunca ejercidos por R13, clasificados
`PHASE3_DEFERRED`, explícitamente NO absorbidos en este fix aislado.

Enumeró los 11 call sites productivos reales (6 Chat en 4 archivos —
`chat-fab.tsx`, `chat-sheet.tsx`, `chat-view.tsx` x2, y
`share-target-flow.tsx` x2, este último un SEGUNDO caller no
documentado de `conversaciones` y de `mensajes/[pedidoId]` POST,
contradiciendo un comentario "sole owner" desactualizado en
`chat-sheet.tsx` — nota de documentación, no un bug; 5 Push en 2
archivos — `use-push-notifications.ts` x3, `permission-prompt.tsx`
x2) y 0 callers no-navegador (confirmado por grep en `public/sw.js`).
Descubrió un hallazgo estructural crítico para el diseño del fix: a
diferencia de los 4 endpoints originales (donde
`activeSessionFamily(window.location.pathname)` — el mecanismo
congelado por R7 — funciona porque esas llamadas ocurren en páginas
con prefijo de familia garantizado), los componentes de Chat
(`ChatFab`/`ChatSheet`, montados vía `ChatProvider`) y
`PermissionPrompt` están montados en el ROOT layout
(`src/app/layout.tsx`) — activos potencialmente en cualquier ruta de
la app, no sólo `/cliente`/`/negocio` — así que reusar
`activeSessionFamily(pathname)` ahí sería estructuralmente incorrecto.
La fuente confiable correcta para estos 6 callers es
`useAuthStore().user?.type` (ya computado en cada closure para otros
propósitos, sin problema de bootstrap porque el actor ya está
autenticado en el momento de cada llamada); `share-target-flow.tsx`
usa en cambio su prop `role` explícito, fijado por la página que lo
renderiza.

Congeló: allowlist de producto de exactamente 7 archivos
(`src/proxy.ts` + 4 Chat + 2 Push, CERO route handlers — el diseño
original de Fase 1 de reescribir la cookie legacy sin tocar handlers
se preserva intacto), allowlist de test de 7 (4 modificados
existentes + 3 archivos de producto — `chat-fab.tsx`, `chat-view.tsx`,
`share-target-flow.tsx` — que hoy no tienen NINGUNA cobertura de test,
gap preexistente no introducido por esta tarea), matriz de seguridad
de 20 casos y de aceptación local de 12, y confirmó por trazado exacto
del código que el comportamiento single-family/selector-ausente
preserva el fallback actual sin ningún cambio (cero regresión para
clientes viejos). Confirmó que P2-T13 y P2-T11 permanecen intactos
(el fix nunca toca semántica DB de Push ni TTL de socket). Sin
BLOCK — ninguna de las 10 condiciones A-J aplicó; el alcance ampliado
(`/api/push/status`, la fuente `user?.type` en vez de pathname) se
clasificó como profundización de la MISMA causa raíz, nunca como un
segundo defecto independiente. Git verificado sin cambio en todo
momento: `HEAD=ORIGIN=a1579f11e79a41b90c6df4d2e8573ca9a669b856`,
`AHEAD=0`/`BEHIND=0`. Detalle completo en
`codex-reports/CURRENT_TASK.md`; R13 archivado en
`codex-reports/archive/P2-T18-BLOCKER-AUTH2-R13.md`. Siguiente tarea:
`P2-T18-BLOCKER-AUTH2-R13-R2` (implementación local focal del
contrato ya congelado), no ejecutada.

## P2-T18-BLOCKER-AUTH2-R13-R2 — implementación local focal de F-P2-T18-AUTH02 — PASS — 2026-08-28

```
P2_T18_BLOCKER_AUTH2_R13_R2=PASS_AUTH02_FOCUSED_LOCAL_IMPLEMENTATION
F_P2_T18_AUTH02_STATUS=LOCAL_IMPLEMENTED_AWAITING_ADVERSARIAL_PRECOMMIT_REVIEW
F_P2_T18_AUTH01_STATUS=OPEN_BLOCKED_BY_AUTH02_CERTIFICATION_DEPLOY_AND_FULL_R13_REPLAY
PRODUCT_MUTATED_PATH_COUNT=7
TEST_MUTATED_PATH_COUNT=7
NEXT_TASK_ID=P2-T18-BLOCKER-AUTH2-R13-R3
NEXT_TASK_STATUS=READY_NOT_EXECUTED
```

Implementación local (sin commit/push/deploy) del contrato exacto
congelado por R13-R1, recuperado verbatim antes de tocar el primer
byte. Preflight de Git confirmó `HEAD=ORIGIN=a1579f11` sin cambio;
recontado narrow de callers (grep exacto sobre los 6 archivos cliente)
confirmó 6 Chat + 5 Push = 11 call sites, idéntico a R13-R1;
fingerprint SHA-256 de 17 archivos (6 route handlers + 11 vecinos
congelados: `auth.ts`, login/logout, auth-store, realtime-provider,
use-auth, realtime-client/manager/types, realtime token/authorize)
tomado antes y después — 17/17 idénticos, ninguno tocado.

`src/proxy.ts`: exactamente 6 entradas nuevas en
`SELECTOR_ENDPOINT_PREFIXES` (`/api/chat/no-leidos`,
`/api/chat/conversaciones`, `/api/chat/mensajes`,
`/api/push/subscribe`, `/api/push/unsubscribe`, `/api/push/status`),
con comentario explicando por qué `/api/push/status` se incluye pese a
no estar en `AUTH_REQUIRED_PREFIXES`. `resolveActorSession()`,
`rewriteResolvedSessionCookieHeaders()`, el saneamiento incondicional
de `x-resolved-actor-family` y el resto del archivo: sin cambio.

Los 11 call sites: `chat-fab.tsx` (1, `no-leidos`), `chat-sheet.tsx`
(1, `conversaciones`), `chat-view.tsx` (2, historial GET preservando
el `query` existente de `mode=safety`/`knownRevision` + envío POST),
`share-target-flow.tsx` (2, vía `role` — descubierto por R13-R1 como
segundo caller no documentado de `conversaciones`/`mensajes` POST),
`use-push-notifications.ts` (3, status/subscribe/unsubscribe vía
`actorType` ya existente en el hook) y `permission-prompt.tsx` (2, vía
`uType` ya existente — sus 2 funciones module-level ganaron un
parámetro explícito `family: string | null` al no tener acceso directo
al store). Cero route handler tocado — confirmado por el fingerprint.
Cero uso de `window.location.pathname`/`activeSessionFamily()` en
ninguno de los 6 archivos (la fuente pathname-based de R7, correcta
para los 4 endpoints originales, habría sido estructuralmente
incorrecta acá — `ChatFab`/`ChatSheet`/`PermissionPrompt` se montan
desde el layout raíz, activos en cualquier ruta, exactamente el
hallazgo que R13-R1 documentó).

4 archivos de test existentes requirieron corrección de aserciones
literales dependientes del texto exacto anterior (URLs de `fetch(...)`
directas, deps arrays, conteo de ocurrencias de
`/api/push/unsubscribe` pasando de 1 a 3 por el comentario+template+
fallback nuevos) — ninguna aserción debilitada ni eliminada, todas
actualizadas para reflejar el código nuevo con el mismo rigor. 3
archivos de test nuevos creados con cobertura mínima (`chat-fab.tsx`,
`chat-view.tsx`, `share-target-flow.tsx` no tenían ningún test
previamente, gap preexistente). Corrigió sobre la marcha un desajuste
de convención de fin de línea (CRLF en el archivo fuente vs. LF en el
string de aserción multi-línea) normalizando en 3 helpers de lectura
de fuente — hallazgo mecánico, no arquitectónico.

Autoridad focal AUTH02: 117/117 PASS (7 archivos). Regresión completa
en 3 tandas: Fase1/Fase2 unit + 4 route tests de Chat/Push
(163/163, sin DB), Fase1/Fase2 integration (31/31, DB real vía
`DATABASE_URL=$DELIGO_TEST_DATABASE_URL`, nunca fallback a la real),
P2-T13 focal —repository + http parsing— (100/100, sin DB). Total
294/294 PASS, 0 fail. ESLint: 0 errores nuevos en los 14 paths.
TypeScript: 0 errores nuevos — confirmó por comparación byte-exacta
contra el blob `a1579f11:src/components/shared/permission-prompt.tsx`
que los 2 diagnósticos `TS2367` en líneas 302/304 de ese archivo
(comparación `state === "requesting"` dentro de un bloque ya narrowed)
son 100% preexistentes, sin relación con el diff, no corregidos.
`git diff --check`: PASS. `npm run build`: `Compiled successfully`,
`ƒ Proxy (Middleware)` confirmado sin conflicto. Diff completo (20
hunks) leído íntegro y clasificado 1 Clase A (proxy) + 10 Clase B
(Chat) + 9 Clase C (Push) = 20, 0 sin clasificar, 0 limpieza
incidental. Artefacto incidental `tsconfig.tsbuildinfo` (generado por
`tsc --noEmit` mismo, nunca parte del allowlist) eliminado antes del
cierre. Índice vacío en todo momento (`git add` nunca ejecutado). Git
final idéntico al preflight: `HEAD=ORIGIN=a1579f11`, `AHEAD=0`/
`BEHIND=0`. Fileset final confirmado exacto: 11 `M` (7 producto + 4
test) + 3 `??` (test nuevos) = 14 paths bajo `src/`, 0 inesperados.

`P2-T13` y `P2-T11` verificados intactos (`P2_T13_PRODUCT_LOGIC_CHANGE_REQUIRED=NO`,
`P2_T11_PRODUCT_CHANGE=NO` — ningún route handler de Push ni lógica de
socket/TTL tocada). Detalle completo en `codex-reports/CURRENT_TASK.md`;
R13-R1 archivado en `codex-reports/archive/P2-T18-BLOCKER-AUTH2-R13-R1.md`
(`db2d1e2a4d95c53b0ef53adb02d489941069e382e34d02e1ae191ccb0a179882`).
Siguiente tarea: `P2-T18-BLOCKER-AUTH2-R13-R3` (revisión adversarial
precommit del diff exacto de esta etapa), no ejecutada.

## P2-T18-BLOCKER-AUTH2-R13-R2-R1 — reconciliación de handoff post-implementación — PASS — 2026-08-28

```
P2_T18_BLOCKER_AUTH2_R13_R2_R1=PASS_POST_IMPLEMENTATION_HANDOFF_RECONCILED_NO_PRODUCT_MUTATION
NEXT_TASK_ID=P2-T18-BLOCKER-AUTH2-R13-R3
NEXT_TASK_STATUS=READY_NOT_EXECUTED
```

Tarea documentación-only tras R13-R2: cero mutación de producto/test
(fingerprint 14/14 idéntico), reconcilió marcadores `CURRENT`/`GLOBAL`
obsoletos en `CODEX_REPORT.md` (el header `P2_T18=` congelado desde
antes de R6, `F_P2_T18_AUTH01_STATUS`/`AUTH02_STATUS` sin calificar
repetidos 3 veces sin distinguir cuál era vigente, un bloque
`GLOBAL_HEAD_CURRENT=c047e9eb...`/`LAST_PUSH_STAGE=...R6` completo
nunca actualizado desde Stage7-R2-RETRY-2) y la ambigüedad de
`CROSS_CHAT_PRIMARY_HANDOFF` (compartida entre `CODEX_REPORT.md` y
`DELIGO_FULL_CONTEXT_LATEST.md`) — dejando `CODEX_REPORT.md` como
único primary handoff y `DELIGO_FULL_CONTEXT_LATEST.md` reclasificado
como contexto secundario. Ningún hecho histórico reescrito — sólo
alias "CURRENT" corregidos, cada valor histórico calificado por etapa.
`P2_T18_BLOCKER_AUTH2_R13_R2=PASS_AUTH02_FOCUSED_LOCAL_IMPLEMENTATION`
preservado íntegro. Detalle completo en `codex-reports/CURRENT_TASK.md`;
R13-R2 archivado en `codex-reports/archive/P2-T18-BLOCKER-AUTH2-R13-R2.md`.
Siguiente tarea: `P2-T18-BLOCKER-AUTH2-R13-R3` (revisión adversarial
precommit del diff exacto), no ejecutada.

## P2-T18-BLOCKER-AUTH2-R13-R3 — revisión adversarial precommit — BLOCKED (gap de cobertura aislado) — 2026-08-28

```
P2_T18_BLOCKER_AUTH2_R13_R3=BLOCKED_AUTH02_PRECOMMIT_ADVERSARIAL_FINDING
R13_R3_BLOCKER_CLASS=TEST_COVERAGE_GAP
R13_R3_MUTANTS_ATTEMPTED=19
R13_R3_MUTANTS_DETECTED=17
R13_R3_MUTANTS_SURVIVED=2
NEXT_TASK_ID=P2-T18-BLOCKER-AUTH2-R13-R3-R1
NEXT_TASK_STATUS=READY_NOT_EXECUTED
```

Auditó de forma independiente el diff local exacto de R13-R2, sin
aceptar sus marcadores PASS como prueba suficiente. Recuperó el
contrato verbatim, confirmó fingerprint 14/14 y 17/17 idéntico antes
de empezar, releyó completos los 20 hunks (1 proxy + 10 Chat + 9
Push, 0 sin clasificar, 0 limpieza incidental — exacto a lo reportado
por R13-R2), re-derivó por grep independiente el inventario de 11
callers (coincide exacto), atacó el modelo fail-closed de
`resolveActorSession()` por lectura directa de código, y trazó a mano
la composición de URL de `chat-view.tsx` en sus 4 casos posibles sin
encontrar ningún `??` duplicado ni parámetro perdido.

Creó un harness temporal FUERA del repo (junction a `node_modules`
real + copia del `src/` con el diff de AUTH02 aplicado), verificado
con una corrida baseline idéntica a R13-R2 (117/117). Aplicó **19
mutantes** (más de los 16 mínimos requeridos) cubriendo proxy, los 6
archivos cliente, y los 8 escenarios de falso-positivo estático del
prompt — cada uno aplicado y revertido exclusivamente dentro del
harness, confirmado por diff byte-a-byte antes del siguiente mutante.
Harness eliminado al finalizar; repo real re-hasheado, 14/14 y 17/17
idénticos al fingerprint pre-review — cero mutación real.

**17/19 detectados.** 2 sobrevivieron: uno (`/api/chat/cleanup`
agregado por error al selector) es un **mutante equivalente**
confirmado por trazado exacto — `cleanup` nunca lee la cookie
resuelta, ningún test podría distinguirlo sin verificar un detalle
sin consecuencia observable; no cuenta como hallazgo, y la
implementación real nunca contiene esta mutación. El otro (en
`use-push-notifications.ts`, el `fetch()` de `subscribe` deja de usar
`subscribeUrl`) **sobrevivió genuinamente**: confirmado por lectura
directa del diff que el producto SÍ está correctamente implementado
(`fetch(subscribeUrl, {`), pero
`use-push-notifications-static-contract.test.ts` sólo verificaba la
declaración de la variable, nunca que `fetch()` la consumiera —
exactamente la misma verificación que sí existe para
`unsubscribeUrl`/`statusUrl`. Clasificado `TEST_COVERAGE_GAP`, nunca
`PRODUCT_DEFECT`. Por regla stop-on-objective, no se reconstruyeron
los matrices de seguridad/aceptación 20/20 y 12/12 ni se re-ejecutó
la autoridad focal/regresión completa, ya que ninguno de esos pasos
cambiaría el veredicto.
`P2_T18_BLOCKER_AUTH2_R13_R2=PASS_AUTH02_FOCUSED_LOCAL_IMPLEMENTATION`
y `P2_T18_BLOCKER_AUTH2_R13_R2_R1=PASS_...` preservados sin degradar.
Git final idéntico al preflight: `HEAD=ORIGIN=a1579f11`, `AHEAD=0`/
`BEHIND=0`, índice vacío, mismos 14 paths sin cambio. Detalle completo
en `codex-reports/CURRENT_TASK.md`; R13-R2-R1 archivado en
`codex-reports/archive/P2-T18-BLOCKER-AUTH2-R13-R2-R1.md`
(`3139b6b2da2fcc92cfacdc0f84314481e615e268cc32970bdda5d3e1f037f5dd`).
Siguiente tarea: `P2-T18-BLOCKER-AUTH2-R13-R3-R1` (corrección focal
exclusiva de test: agregar la verificación de `fetch(subscribeUrl` en
`use-push-notifications-static-contract.test.ts`, mismo patrón ya
usado para `unsubscribeUrl`), no ejecutada.

## P2-T18-BLOCKER-AUTH2-R13-R3-R1 — corrección focal test-only del gap M9 — PASS — 2026-08-28

```
P2_T18_BLOCKER_AUTH2_R13_R3_R1=PASS_AUTH02_M9_TEST_COVERAGE_GAP_CLOSED
R13_R3_R1_TARGET_TEST_PATH=src/hooks/use-push-notifications-static-contract.test.ts
R13_R3_R1_PRODUCT_PATHS_CHANGED=0
R13_R3_R1_TEST_PATHS_CHANGED=1
R13_R3_R1_FOCAL_RESULT=117_OF_117_PASS
NEXT_TASK_ID=P2-T18-BLOCKER-AUTH2-R13-R3-RETRY
NEXT_TASK_STATUS=READY_NOT_EXECUTED
```

Tarea test-only, focal y aislada: cerrar exclusivamente el gap M9 de
R13-R3, sin tocar producto ni ningún otro archivo de test. Recuperó el
contrato exacto desde el R13-R3 recién archivado
(`bf73b31fe7433e20fa49fc620937febfdf3b3ed1c93820c33395385b0777096f`),
confirmó por lectura directa que `use-push-notifications.ts` línea 247
sí consume `fetch(subscribeUrl, {` (producto correcto), y reprodujo el
mutante M9 fuera del repo en un harness temporal (junction a
`node_modules` + copia de `src/`, eliminado al cierre) contra el test
sin corregir — sobrevivió (29 pass/0 fail), confirmando el gap antes
de tocar ningún archivo real.

Agregó una única assertion (`expect(src).toContain("fetch(subscribeUrl")`)
dentro del test ya existente `"all three call sites... build their URL
from actorType..."`, sin crear ningún `test()`/`describe()` nuevo —
mismo patrón exacto ya usado para `unsubscribeUrl`/`statusUrl`. Conteo
de tests sin cambio (29→29), `expect()` calls +1 (99→100). Replay del
mismo mutante en el harness contra el test corregido: detectado (28
pass/1 fail, exactamente la nueva assertion). Harness restaurado desde
backup (byte-idéntico por SHA-256) y eliminado por completo.

7 archivos de producto y 6 archivos de test no-objetivo confirmados
byte-idénticos antes/después (fingerprint SHA-256). 117/117 focal
AUTH02 PASS (idéntico al conteo de R13-R2). ESLint limpio, TSC 31
raw/24 distinct (0 nuevos), `git diff --check` limpio. Diff completo
del archivo objetivo releído: único cambio es la nueva assertion, sin
remociones ni debilitamiento de ninguna existente. No se re-ejecutó la
campaña completa de 19 mutantes ni la regresión de 294 — corresponden
a `P2-T18-BLOCKER-AUTH2-R13-R3-RETRY`.

`P2_T18_BLOCKER_AUTH2_R13_R2=PASS_AUTH02_FOCUSED_LOCAL_IMPLEMENTATION`
preservado sin degradar. `M3_CLASSIFICATION_PRESERVED=EQUIVALENT_MUTANT_NO_OBSERVABLE_IMPACT`
— `proxy.ts` no se tocó. R13-R3 permanece históricamente `BLOCKED`, no
se reescribe. Git final idéntico HEAD=ORIGIN=a1579f11, `AHEAD=0`/
`BEHIND=0`, índice vacío, sin commit/push/deploy. Detalle completo en
`codex-reports/CURRENT_TASK.md`; R13-R3 archivado en
`codex-reports/archive/P2-T18-BLOCKER-AUTH2-R13-R3.md`.
Siguiente tarea: `P2-T18-BLOCKER-AUTH2-R13-R3-RETRY` — repetición
completa desde cero (no continuación) de la revisión adversarial
precommit, para confirmar `R13_R3_MUTANTS_SURVIVED=0` antes de
autorizar `P2-T18-BLOCKER-AUTH2-R13-R4` (commit local exacto), no
ejecutada.

## P2-T18-BLOCKER-AUTH2-R13-R3-RETRY — recertificación adversarial completa desde cero — BLOCKED (segundo gap de cobertura aislado) — 2026-08-28

```
P2_T18_BLOCKER_AUTH2_R13_R3_RETRY=BLOCKED_AUTH02_TEST_COVERAGE_GAP
R13_R3_RETRY_MUTANTS_ATTEMPTED=20
R13_R3_RETRY_EQUIVALENT_MUTANTS=1 (M3)
R13_R3_RETRY_NON_EQUIVALENT_DETECTED=18
R13_R3_RETRY_VALID_SURVIVORS=1 (M19-NEW)
NEXT_TASK_ID=P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-R1
NEXT_TASK_STATUS=READY_NOT_EXECUTED
```

Recertificó DESDE CERO el diff local completo de AUTH02 — no aceptó
como prueba suficiente ningún resultado histórico (117/117, 294/294,
los propios PASS de R13-R2/R13-R3-R1). Re-derivó fileset (14/14
idéntico), releyó completo el diff de los 7 archivos de producto (20
hunks, 0 sin clasificar — 1 proxy + 10 Chat + 9 Push, idéntico a
R13-R2/R13-R3), releyó completa `resolveActorSession()` y
`checkRouteProtection()` confirmando el modelo fail-closed y el
rewrite request-only, re-derivó por grep independiente el inventario
de 11 callers (coincide exacto), re-trazó a mano la composición de URL
de `chat-view.tsx` en sus 4 casos, y confirmó por fingerprint SHA-256
los 6 route handlers byte-frozen (17/17 vecinos sin diferencia).

La revisión de fuerza de test se hizo genuinamente "desde cero" — no
se limitó a confirmar que la assertion de M9 seguía presente, sino que
clasificó cada uno de los 11 call sites por declaración-vs-consumo
verificado en su test correspondiente. Encontró que 10/11 tienen
ambos verificados, pero el 11º —`savePushSubscription` en
`src/components/shared/permission-prompt.tsx`— declara `const url =
family ? ... : "/api/push/subscribe"` mientras que
`permission-prompt-static-contract.test.ts` sólo verifica esa
DECLARACIÓN como substring, nunca que `fetch(url` sea el call site
real consumido (a diferencia de `checkExistingPushSubscriptionStatus`
en el mismo archivo, que sí tiene esa verificación). Este gap es
distinto de M9 y nunca fue atacado por los 19 mutantes originales de
R13-R3 (que para `permission-prompt.tsx` sólo atacaron el CALLER —
M12/M12b — nunca la consumición interna de las dos funciones
module-level).

Creó un harness temporal NUEVO fuera del repo (distinto del usado en
R13-R3 y R13-R3-R1, eliminado al cierre), replicó fielmente los 19
mutantes originales (M1-M18 + M12b) más un mutante nuevo sobre el gap
detectado. **18/19 no-equivalentes detectados**: M9 ahora SÍ se
detecta (antes 29 pass/0 fail sin detectarlo; ahora 1 fail exacto por
la assertion de R13-R3-R1 — recertifica esa corrección como genuina, no
sólo por inspección estática), M3 reconfirmado independientemente
equivalente por los 5 puntos exigidos (`checkRouteProtection` aprueba
`cleanup` antes del selector, el handler nunca lee la cookie resuelta,
sin efecto observable, producto real no contiene la mutación). El
mutante nuevo (`savePushSubscription`'s `fetch(url, {` revertido a
`fetch("/api/push/subscribe", {` literal, dejando intacta la
declaración de `url`) **sobrevivió** (11 pass/0 fail) — confirmado por
lectura directa que el producto SÍ está correctamente implementado;
clasificado `TEST_COVERAGE_GAP`, nunca `PRODUCT_DEFECT`.

Por regla stop-on-objective, en cuanto quedó demostrado este
`BLOCK_CONDITION` real se detuvo la investigación adicional — no se
reconstruyeron las matrices 20/20 y 12/12 ni se corrieron 117/294
frescos. `P2_T18_BLOCKER_AUTH2_R13_R2=PASS_AUTH02_FOCUSED_LOCAL_IMPLEMENTATION`
y `P2_T18_BLOCKER_AUTH2_R13_R3_R1=PASS_AUTH02_M9_TEST_COVERAGE_GAP_CLOSED`
preservados sin degradar — el hallazgo de esta etapa es un gap
DISTINTO, nunca sobre la corrección de M9. Git final idéntico
`HEAD=ORIGIN=a1579f11`, `AHEAD=0`/`BEHIND=0`, índice vacío, mismos 14
paths sin cambio; fingerprint 14/14 y 17/17 idéntico antes/después
(la única discrepancia observada durante la campaña fue una diferencia
de codificación CRLF/LF en 2 archivos DENTRO del harness eliminado,
confirmada por comparación normalizada como byte-idéntica en
contenido — el repo real nunca se vio afectado). Detalle completo en
`codex-reports/CURRENT_TASK.md`; R13-R3-R1 archivado en
`codex-reports/archive/P2-T18-BLOCKER-AUTH2-R13-R3-R1.md`.
Siguiente tarea: `P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-R1` — corrección
focal exclusiva de test (agregar la verificación de `fetch(url` dentro
de `savePushSubscription`, mismo patrón ya usado para
`checkExistingPushSubscriptionStatus`), tras la cual
`P2-T18-BLOCKER-AUTH2-R13-R3-RETRY` debe repetirse (no continuarse)
para confirmar `R13_R3_RETRY_VALID_SURVIVORS=0` antes de autorizar
`P2-T18-BLOCKER-AUTH2-R13-R4` (commit local exacto), no ejecutada.

## P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-R1 — segunda corrección focal test-only del gap M19-NEW — PASS — 2026-08-28

```
P2_T18_BLOCKER_AUTH2_R13_R3_RETRY_R1=PASS_AUTH02_M19_TEST_COVERAGE_GAP_CLOSED
R13_R3_RETRY_R1_TARGET_TEST_PATH=src/components/shared/permission-prompt-static-contract.test.ts
R13_R3_RETRY_R1_PRODUCT_PATHS_CHANGED=0
R13_R3_RETRY_R1_TEST_PATHS_CHANGED=1
R13_R3_RETRY_R1_FOCAL_RESULT=117_OF_117_PASS
NEXT_TASK_ID=P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2
NEXT_TASK_STATUS=READY_NOT_EXECUTED
```

Tarea test-only, focal y aislada: cerrar exclusivamente el segundo
gap real de cobertura encontrado por R13-R3-RETRY (mutante M19-NEW),
sin tocar producto ni ningún otro archivo de test. Recuperó el
contrato exacto desde el R13-R3-RETRY recién archivado
(`0620e8e0a575537072b4de519bc52158431ccb2c86b79a418f27c8ae835b0083`),
confirmó por lectura directa que `permission-prompt.tsx` sí consume
`fetch(url, {` en `savePushSubscription` (producto correcto), y
reprodujo el mutante M19-NEW fuera del repo en un harness temporal
nuevo (junction a `node_modules` + copia de `src/`, eliminado al
cierre) contra el test sin corregir — sobrevivió (11 pass/0 fail),
confirmando el gap antes de tocar ningún archivo real.

Agregó una única assertion (`expect(fnBody).toContain("fetch(url")`)
dentro del test ya existente `"savePushSubscription accepts an
explicit family parameter..."`, sin crear ningún
`test()`/`describe()` nuevo — mismo patrón exacto ya usado para
`checkExistingPushSubscriptionStatus`. Conteo de tests sin cambio
(11→11), `expect()` calls +1 (22→23). Replay del mismo mutante en el
harness contra el test corregido: detectado (10 pass/1 fail,
exactamente la nueva assertion). Harness restaurado desde backup
(byte-idéntico por SHA-256) y eliminado por completo.

7 archivos de producto y 6 archivos de test no-objetivo — incluido el
test de M9, confirmado intacto — byte-idénticos antes/después. 117/117
focal AUTH02 PASS. ESLint limpio, TSC 31 raw/24 distinct (0 nuevos),
`git diff --check` limpio. Diff completo del archivo objetivo releído:
único cambio es la nueva assertion, sin remociones ni debilitamiento
de ninguna existente. No se re-ejecutó la campaña completa de 20
mutantes ni la regresión de 294 — corresponden a
`P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2`.

`P2_T18_BLOCKER_AUTH2_R13_R2=PASS_AUTH02_FOCUSED_LOCAL_IMPLEMENTATION`
y `P2_T18_BLOCKER_AUTH2_R13_R3_R1=PASS_AUTH02_M9_TEST_COVERAGE_GAP_CLOSED`
preservados sin degradar. `M3_CLASSIFICATION_PRESERVED=EQUIVALENT_MUTANT_NO_OBSERVABLE_IMPACT`
— `proxy.ts` no se tocó. El primer R13-R3-RETRY permanece
históricamente `BLOCKED`, no se reescribe. Durante la finalización
también se reconcilió, per instrucción explícita, un marcador
`P2_T18=` sin calificar del header de `CODEX_REPORT.md` que había
quedado desactualizado desde antes de esta cadena de etapas (arrastraba
la era de R13-R3, nunca actualizado a RETRY/RETRY-R1) — sin crear
ninguna micro-tarea adicional para eso, sin reescribir ningún
resultado histórico. Git final idéntico HEAD=ORIGIN=a1579f11,
`AHEAD=0`/`BEHIND=0`, índice vacío, sin commit/push/deploy. Detalle
completo en `codex-reports/CURRENT_TASK.md`; R13-R3-RETRY archivado en
`codex-reports/archive/P2-T18-BLOCKER-AUTH2-R13-R3-RETRY.md`.
Siguiente tarea: `P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2` — repetición
completa desde cero (no continuación) de la revisión adversarial
precommit (20 mutantes: 19 originales + M19-NEW), para confirmar
`R13_R3_RETRY_VALID_SURVIVORS=0` antes de autorizar
`P2-T18-BLOCKER-AUTH2-R13-R4` (commit local exacto), no ejecutada.

## P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2 — recertificación adversarial final desde cero — BLOCKED (fallo de regresión ajeno a AUTH02) — 2026-08-29

```
P2_T18_BLOCKER_AUTH2_R13_R3_RETRY_2=BLOCKED_AUTH02_FRESH_TEST_GATE
RETRY_2_MUTANTS_ATTEMPTED=20
RETRY_2_NON_EQUIVALENT_DETECTED=19
RETRY_2_VALID_SURVIVORS=0
RETRY_2_SECURITY_MATRIX=20_OF_20_PASS
RETRY_2_FOCAL_RESULT=117_OF_117_PASS
RETRY_2_REGRESSION_TANDA_1=163_OF_163_PASS
RETRY_2_REGRESSION_TANDA_2=30_OF_31_PASS_1_FAIL
NEXT_TASK_ID=P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R1
NEXT_TASK_STATUS=READY_NOT_EXECUTED
```

Recertificó DESDE CERO, por última vez antes del commit local, el diff
completo de AUTH02 tras las dos correcciones test-only (M9 en
R13-R3-R1, M19-NEW en R13-R3-RETRY-R1). Construyó un gate crítico
explícito ANTES de mutar nada: una tabla de los 11 call sites
productivos confirmando declaración Y consumo real (`fetch(...)`)
protegidos por test en cada uno — 11/11 verde, incluidos los dos call
sites recién corregidos. Re-derivó independientemente fileset (14/14),
diff (20 hunks), modelo fail-closed, 11 callers, fuente de familia
confiable, route handlers byte-frozen (ausentes del diff por
completo).

Harness temporal NUEVO fuera del repo (nunca reutilizado de ninguna
etapa anterior, eliminado al cierre): replay fiel de los 19 mutantes
originales + M19-NEW (20 totales). **19/19 no-equivalentes
detectados** — M9 y M19-NEW ambos recertificados como genuinamente
detectados (no sólo por inspección estática), M3 reconfirmado
independientemente equivalente por los 5 puntos exigidos. Matriz de
seguridad (20 casos) y aceptación local (12 casos) re-evaluadas contra
evidencia fresca de esta etapa: 20/20 y 12/12. Corrida focal decisiva
fresca: **117/117 PASS** en la primera corrida.

Corrida de regresión decisiva fresca en 3 tandas (listado literal
recuperado de `codex-reports/TEST_AUTHORITY.md` líneas 1459-1478,
nunca reconstruido de memoria): **TANDA_1 (163 tests, sin DB) 163/163
PASS**. **TANDA_2 (31 tests, PostgreSQL real) 30 pass / 1 fail** — un
único fallo decisivo en `client-block-security.integration.test.ts`
(caso "SEC-BLOCK-1... dispositivo compartido pero SIN ninguna fila
ClienteBloqueado previa", esperado 201 recibido 500, 12878ms),
completamente ajeno al mecanismo `actorFamily` de AUTH02, con
precedente histórico documentado de flake transitorio aislado en el
mismo archivo (`P2-T18-BLOCKER-AUTH2-R5`, mismo síntoma exacto). Por
regla explícita de esta etapa ("no retry-to-green", "Do NOT correct"),
no se re-ejecutó ni se investigó más a fondo, y TANDA_3 no se corrió
(stop-on-objective).

Es importante lo que este BLOCK NO es: AUTH02 en sí —cobertura de los
11 call sites, 19/19 mutantes no-equivalentes detectados, matriz de
seguridad 20/20, aceptación 12/12, focal 117/117, TANDA_1 163/163—
quedó completamente verde. El único hallazgo es un fallo de la primera
corrida decisiva de un archivo de regresión pre-existente y ajeno, con
precedente de flake, que la regla explícita de esta etapa prohíbe
investigar o re-ejecutar en este mismo turno.
`P2_T18_BLOCKER_AUTH2_R13_R2=PASS_AUTH02_FOCUSED_LOCAL_IMPLEMENTATION`,
`P2_T18_BLOCKER_AUTH2_R13_R3_R1=PASS_AUTH02_M9_TEST_COVERAGE_GAP_CLOSED`
y `P2_T18_BLOCKER_AUTH2_R13_R3_RETRY_R1=PASS_AUTH02_M19_TEST_COVERAGE_GAP_CLOSED`
preservados sin degradar. El primer `P2-T18-BLOCKER-AUTH2-R13-R3-RETRY`
permanece históricamente `BLOCKED`, no se reescribe. Git final
idéntico `HEAD=ORIGIN=a1579f11`, `AHEAD=0`/`BEHIND=0`, índice vacío,
mismos 14 paths sin cambio; fingerprint 14/14 y 17/17 idéntico
antes/después. Detalle completo en `codex-reports/CURRENT_TASK.md`;
R13-R3-RETRY-R1 archivado en
`codex-reports/archive/P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-R1.md`.
Siguiente tarea: `P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R1` —
investigación aislada (read-only primero) del único fallo de
regresión, para clasificarlo `TEST_INFRASTRUCTURE_FLAKE` vs.
`REAL_REGRESSION`, tras la cual `R13-R3-RETRY-2` debe repetirse (no
continuarse), mínimo re-ejecutando TANDA_2 y TANDA_3 completas, antes
de autorizar `P2-T18-BLOCKER-AUTH2-R13-R4` (commit local exacto), no
ejecutada.

## P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R1 — clasificación aislada de SEC-BLOCK-1 — BLOCKED (inconcluyente) — 2026-08-29

```
P2_T18_BLOCKER_AUTH2_R13_R3_RETRY_2_R1=BLOCKED_SEC_BLOCK_1_CLASSIFICATION_INCONCLUSIVE
R13_R3_RETRY_2_FAILURE_CLASS=INCONCLUSIVE_EXTERNAL_DB_INSTABILITY
AUTH02_CAUSED_SEC_BLOCK_1_FAILURE=NO
D1=FAIL (P2028, resA, 25144ms) / D2=PASS (19/19) / D3=PASS (31/31)
R13_R4_AUTHORIZED=NO
NEXT_TASK_ID=P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R2
NEXT_TASK_STATUS=READY_NOT_EXECUTED
```

Tarea de diagnóstico exclusiva (sin corregir nada, sin
retry-to-green, presupuesto fijo de 3 corridas): clasificó el único
fallo fresco que bloqueó R13-R3-RETRY-2 en
`client-block-security.integration.test.ts`, caso SEC-BLOCK-1
"dispositivo compartido pero SIN ninguna fila ClienteBloqueado
previa" (esperado 201, recibido 500, ~12878ms).

Confirmó ESTRUCTURALMENTE (no probabilísticamente) que AUTH02 no
puede haber causado el fallo: grep exhaustivo del archivo de test
completo — 0 matches de `proxy`/`middleware`/`resolveActorSession` —
el test llama al route handler de `/api/pedidos` DIRECTAMENTE como
función importada, construyendo un `NextRequest` a mano, sin pasar
jamás por Next.js Edge Middleware. `src/proxy.ts` es inalcanzable
desde este test por diseño.

Comparó contra el precedente de R5 sin sobre-extender la coincidencia:
mismo archivo, pero test title distinto ("dispositivos concurrentes...
P2002" en R5 vs. "dispositivo compartido... ninguna fila
ClienteBloqueado previa" ahora), mecanismo distinto (R5 usa
`Promise.all` de 3 logins realmente concurrentes, diseñado para forzar
una carrera; el caso actual usa awaits secuenciales, sin concurrencia
diseñada), código de error distinto (P2002 histórico vs. P2028
reproducido en esta tarea). `R5_SAME_FILE=SI` pero
`R5_SAME_EXACT_TEST_CASE=NO`, `R5_SAME_ROOT_CAUSE_PROVEN=NO`.

Ejecutó exactamente 3 corridas diagnósticas, ninguna repetida: **D1**
(caso aislado con `-t`) **FALLÓ** — `P2028` (error de transacción
Prisma) en `resA`, con latencia anómala de 25144ms para un único
request. **D2** (archivo completo) **PASÓ** 19/19. **D3** (autoridad
exacta de TANDA_2, 31 tests) **PASÓ** 31/31. El patrón (aislado falla,
agrupado pasa dos veces) es el INVERSO del patrón "contención
multi-archivo" y no encaja limpio en ningún Caso A/B/C de la matriz de
interpretación — corresponde **Caso E, `INCONCLUSIVE_EXTERNAL_DB_INSTABILITY`**:
corridas idénticas en código produjeron comportamiento distinto, con
evidencia circunstancial fuerte (código transaccional `P2028`,
latencias anómalas) apuntando hacia inestabilidad transitoria de la
conexión/motor de TESTING — sin forzar una clasificación PASS limpia,
per regla explícita de la etapa.

`P2_T18_BLOCKER_AUTH2_R13_R3_RETRY_2=BLOCKED_AUTH02_FRESH_TEST_GATE`
permanece históricamente preservado, no se reescribe a PASS — toda su
evidencia (20 mutantes, 19/19 no-equivalentes, 11/11, 20/20, 12/12,
117/117, TANDA_1 163/163) sigue técnicamente reutilizable, confirmada
idéntica por fingerprint antes/después de esta etapa (14/14, 17/17, y
el propio test objetivo). 0 mutación de source/test. Cleanup
automático del propio archivo confirmado sin residuales tras las 3
corridas. Git final idéntico `HEAD=ORIGIN=a1579f11`, `AHEAD=0`/
`BEHIND=0`, índice vacío. Detalle completo en
`codex-reports/CURRENT_TASK.md`; R13-R3-RETRY-2 archivado en
`codex-reports/archive/P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2.md`.
Siguiente tarea: `P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R2` — gate de
regresión fresca de certificación (no diagnóstica): TANDA_2 una vez,
si PASA TANDA_3 una vez, sin retry-to-green, reutilizando por
identidad de bytes toda la evidencia ya certificada sin repetirla, no
ejecutada.

## P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R2 — gate de regresión fresca de certificación — BLOCKED (segundo fallo consecutivo del mismo caso) — 2026-08-29

```
P2_T18_BLOCKER_AUTH2_R13_R3_RETRY_2_R2=BLOCKED_FRESH_TANDA_2_CERTIFICATION_FAILURE
C1_TANDA_2_TOTAL=31 / C1_TANDA_2_PASS=30 / C1_TANDA_2_FAIL=1 (SEC-BLOCK-1, 26786ms)
C2_TANDA_3=NO_EJECUTADA (C1 falló primero, sin retry)
R13_R4_AUTHORIZED=NO
NEXT_TASK_ID=P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R2-R1
NEXT_TASK_STATUS=READY_NOT_EXECUTED
```

Tarea de CERTIFICACIÓN (no diagnóstico): completar la certificación
precommit de AUTH02 interrumpida exclusivamente por el fallo DB de
SEC-BLOCK-1, corriendo TANDA_2 y (si pasa) TANDA_3 una sola vez cada
una, sin retry-to-green, sobre exactamente los mismos bytes ya
certificados por R13-R3-RETRY-2 y R13-R3-RETRY-2-R1.

Confirmó gate de continuidad de bytes: 14/14 paths de AUTH02, 17/17
vecinos congelados, y el propio
`client-block-security.integration.test.ts` idénticos byte a byte
respecto de R1. Preservó íntegra toda la evidencia de RETRY-2 (11/11
cobertura, 20 mutantes/19 no-equivalentes/0 sobrevivientes válidos,
seguridad 20/20, aceptación 12/12, focal 117/117, TANDA_1 163/163) por
identidad de bytes — nada de eso se re-ejecutó.

**C1 — certificación fresca de TANDA_2** (una única corrida): **FALLÓ
30/31** — exactamente el mismo caso `client-block-security.integration.test.ts:406`,
"SEC-BLOCK-1... dispositivo compartido pero SIN ninguna fila
ClienteBloqueado previa" (esperado 201, recibido 500), esta vez con
26786.71ms de duración — nuevamente anómala, consistente con el
patrón de latencia ya observado en R1. Por regla explícita "no
retry-to-green", se detuvo de inmediato: no se corrió C2/TANDA_3, no
se aisló el test, no se investigó la causa (presupuesto diagnóstico ya
agotado en R1).

`P2_T18_BLOCKER_AUTH2_R13_R3_RETRY_2=BLOCKED_AUTH02_FRESH_TEST_GATE` y
`P2_T18_BLOCKER_AUTH2_R13_R3_RETRY_2_R1=BLOCKED_SEC_BLOCK_1_CLASSIFICATION_INCONCLUSIVE`
permanecen íntegros, sin reescribir — esta etapa no reclasifica el
incidente, aunque el segundo fallo consecutivo del mismo caso exacto
(con la misma latencia anómala) es evidencia adicional consistente con
la hipótesis de inestabilidad transitoria. El diff de AUTH02 en sí
permanece 100% verde en toda su evidencia preservada — el bloqueo es,
otra vez, exclusivamente sobre el mismo test ajeno. Fingerprint 14/14,
17/17 y el test objetivo confirmados idénticos antes/después; 0
mutación de source/test. Git final idéntico `HEAD=ORIGIN=a1579f11`,
`AHEAD=0`/`BEHIND=0`, índice vacío. Detalle completo en
`codex-reports/CURRENT_TASK.md`; R13-R3-RETRY-2-R1 archivado en
`codex-reports/archive/P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R1.md`.
Siguiente tarea: `P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R2-R1` —
disposición aislada de este segundo fallo consecutivo, probablemente
una decisión de producto/proceso con el usuario dado que dos intentos
de certificación ya fallaron el mismo caso exacto, no ejecutada.

---

## P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R2-R1 — root-cause/disposition reconciliation — PASS (disposición determinada) — 2026-08-29

Tarea de disposición read-only sobre el fallo REPETIDO de SEC-BLOCK-1
(dos corridas frescas de certificación de TANDA_2 bloqueadas por el
mismo caso exacto). Trazó completo el path productivo `/api/pedidos`
para las condiciones exactas de este test: la única transacción
interactiva alcanzada (`db.$transaction`, `pedidos/route.ts:1493`) es
mínima (1 lectura + 1 update + 1 create, sin trabajo no-DB dentro de su
alcance) y `P2028` no tiene ningún manejo/retry explícito — cae directo
al catch-all genérico → 500, un comportamiento igualmente alcanzable en
producción bajo latencia suficiente. Comparó los 3 fallos frescos
(RETRY-2 original, R1/D1, R2-R2/C1) contra 2 controles limpios (D2, D3):
el dato decisivo es que el fallo AISLADO (D1, sin ningún otro archivo de
TANDA_2 corriendo) también reprodujo el mismo patrón (P2028, latencia
anómala) — descartando la contención ENTRE archivos de TANDA_2 como
causa necesaria. Recuperó contexto adicional ya existente en el repo
(harness de carga `load-tests/runner/pg-metrics.ts` ya instrumentando
conexiones contra la misma DB de TESTING; el resultado de carga más
reciente contra PRODUCCIÓN muestra p95=389ms, 0 fallos 5xx bajo carga
real sostenida) — reforzando que la inestabilidad es anómala
específicamente en TESTING. Encontró, como hallazgo secundario no
causal para este síntoma, un `mock.module()` sin scope en
`session-login-atomicity.integration.test.ts` que reemplaza
`@/lib/client-block-security` a nivel de proceso sin re-exportar todas
sus funciones — un riesgo de higiene de test real, documentado para
revisión futura separada, pero estructuralmente incapaz de producir un
`P2028` con latencia de segundos.

```
SELECTED_DISPOSITION=EXTERNAL_TESTING_DB_RELIABILITY_LIMITATION_REQUIRES_NEW_CERTIFICATION_AUTHORITY
CONFIDENCE=MEDIUM
AUTH02_CAUSAL=NO
DEDICATED_TEST_DB_REQUIRED=SI
P2_T18_BLOCKER_AUTH2_R13_R3_RETRY_2_R2_R1=PASS_REPEATED_SEC_BLOCK_1_FAILURE_DISPOSITION_FROZEN
AUTH02_SAFE_FOR_EXACT_LOCAL_COMMIT=NO
R13_R4_AUTHORIZED=NO
```

PASS aquí significa exclusivamente "la disposición correcta del fallo
repetido queda determinada" — NO significa "AUTH02 puede commitearse".
R13-R3-RETRY-2, R13-R3-RETRY-2-R1 y R13-R3-RETRY-2-R2 permanecen
históricamente BLOCKED, sin reescribir. Características de una base de
TESTING dedicada quedaron congeladas (alcance, aislamiento de fixtures,
requisitos de conexión, límite de seguridad) sin provisionar nada — una
decisión de producto/proceso que excede el alcance de esta tarea. 0
mutación de source/test, fingerprint 14/14+17/17+test-objetivo
idéntico. Git final idéntico `HEAD=ORIGIN=a1579f11`, `AHEAD=0`/
`BEHIND=0`, índice vacío. Detalle completo en
`codex-reports/CURRENT_TASK.md`; R13-R3-RETRY-2-R2 archivado en
`codex-reports/archive/P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R2.md`.
Siguiente tarea: `P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R2-R1A` —
"DB-BACKED REGRESSION AUTHORITY STABILIZATION — DEDICATED TESTING
DATABASE", una decisión de producto/proceso del usuario, no otra
certificación puramente técnica, no ejecutada.

---

## P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R2-R1A — user product/process decision override — PASS — 2026-08-29

El usuario decidió explícitamente diferir la DB de TESTING dedicada
propuesta en R13-R3-RETRY-2-R2-R1 y continuar con la infraestructura
existente. Tarea de reconciliación de reportes/autoridad exclusivamente
(0 ejecución de tests, 0 mutación de source/test). Verificó los 6
gates A-F sobre la autoridad ya persistida — todos PASS — y aceptó una
excepción de infraestructura estrechamente acotada
(`EX-P2-T18-SEC-BLOCK-1-P2028`, sólo el caso exacto de SEC-BLOCK-1, no
permanente, sin `.skip`/borrado/cambio de expectativa en el test),
registrando `F-P2-TESTINFRA-01` como deuda diferida (revisit P2-T10).
Formuló explícitamente sin green falso — nunca afirmó "TANDA_2 31/31"
ni "294/294 PASS".

```
P2_T18_BLOCKER_AUTH2_R13_R3_RETRY_2_R2_R1A=PASS_USER_PROCESS_DECISION_DEDICATED_DB_DEFERRED_AUTH02_PRECOMMIT_ACCEPTED_WITH_SINGLE_INFRA_EXCEPTION
AUTH02_SAFE_FOR_EXACT_LOCAL_COMMIT=SI
R13_R4_AUTHORIZED=SI
F_P2_T18_AUTH02_STATUS=PRECOMMIT_CERTIFIED_WITH_TEMP_TESTING_INFRA_EXCEPTION_AWAITING_EXACT_LOCAL_COMMIT
```

R13-R3-RETRY-2, R13-R3-RETRY-2-R1, R13-R3-RETRY-2-R2 y
R13-R3-RETRY-2-R2-R1 permanecen históricos sin reescribir. Congeló el
contrato de commit de R13-R4 (exactamente los 14 paths de AUTH02,
subject `fix: scope shared auth requests by actor family`, 0 paths de
reportes/ajenos). Fingerprint 14/14+1 idéntico antes/después. Git final
idéntico `HEAD=ORIGIN=a1579f11`, `AHEAD=0`/`BEHIND=0`, índice vacío.
Detalle completo en `codex-reports/CURRENT_TASK.md`;
R13-R3-RETRY-2-R2-R1 archivado en
`codex-reports/archive/P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R2-R1.md`.
Siguiente tarea: `P2-T18-BLOCKER-AUTH2-R13-R4` — "EXACT LOCAL COMMIT",
no ejecutada.

---

## P2-T18-BLOCKER-AUTH2-R13-R4 — exact local commit — PASS — 2026-08-29

Convirtió el candidato AUTH02 ya certificado (R13-R3-RETRY-2-R2-R1A) en
un único commit local, sin mutar ni un solo byte de producto/test.
Rehash pre-stage 14/14 idéntico a la autoridad certificada; staging
explícito de exactamente los 14 paths vía `git add --`; probado
`staged == worktree == certificado` 14/14 por blob hashing directo
antes de commitear.

```bash
git commit -m "fix: scope shared auth requests by actor family"
```

```
R13_R4_COMMIT_HASH=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f
R13_R4_COMMIT_PARENT=a1579f11e79a41b90c6df4d2e8573ca9a669b856
P2_T18_BLOCKER_AUTH2_R13_R4=PASS_AUTH02_EXACT_LOCAL_COMMIT
AUTH02_LOCAL_COMMIT_COMPLETE=SI
R13_R5_AUTHORIZED=SI
```

Recertificado postcommit desde los objetos Git — 14/14 blobs
commiteados idénticos a los certificados, 0 diff restante en el
worktree para los 14 paths. `AHEAD=1`/`BEHIND=0` contra
`origin/testing-codex`, que permanece exactamente en `a1579f11` — sin
push, sin deploy, sin Railway, sin DB real, sin navegador real.
Detalle completo en `codex-reports/CURRENT_TASK.md`;
R13-R3-RETRY-2-R2-R1A archivado en
`codex-reports/archive/P2-T18-BLOCKER-AUTH2-R13-R3-RETRY-2-R2-R1A.md`.
Siguiente tarea: `P2-T18-BLOCKER-AUTH2-R13-R5` — "POSTCOMMIT PREPUSH
EXACT BLOB REVIEW", no ejecutada.

---

## PRIORIDAD DE ROADMAP DEL USUARIO (registrada en R13-R4, 2026-08-29 — ampliada en R13-R6, 2026-08-29 — no ejecutada)

El usuario quiere acelerar explícitamente, tras el cierre completo de
P2-T18, las tareas que afectan el onboarding real de negocios —
negocios reales pueden estar ya cargando datos de Negocio, productos,
categorías, precios, imágenes y configuración de menú, y el usuario
quiere que la configuración operativa de empleado/mozo/terminal quede
estabilizada lo antes razonablemente posible para que esos negocios
puedan terminar su configuración.

**Ampliación de R13-R6**: antes de P2-T06/P2-T14, la PRIMERA prioridad
post-P2-T18 es auditar la diferencia real entre el repositorio/rama de
Producción (`https://github.com/LeoCampos2504/DeliGO`) y
`testing-codex` (`https://github.com/LeoCampos2504/DeliGO/tree/testing-codex`)
para derivar el plan real de sincronización/migración de Producción
desde Git — no sólo desde reportes históricos —, y ejecutar esa
sincronización aprobada en etapas separadas y controladas, ANTES de
que negocios reales empiecen a cargar catálogos de producto.

```
USER_BUSINESS_ONBOARDING_PRIORITY=STABILIZE_OPERATIONAL_BUSINESS_CONFIGURATION_EARLY
POST_T18_PRODUCTION_SYNC_AUDIT_PRIORITY=SI
REAL_BUSINESS_CATALOG_ONBOARDING_BEFORE_PRODUCTION_SYNC=NO
USER_POST_P2_T18_PRIORITY=PRODUCTION_SYNC_AUDIT_THEN_P2_T06_THEN_P2_T14_AS_SOON_AS_DEPENDENCY_SAFE
BUSINESS_REASON=MINIMIZE_DELAY_BEFORE_REAL_BUSINESSES_CAN_COMPLETE_EMPLOYEE_MOZO_TERMINAL_CONFIGURATION
P2_T06_EARLY_PRIORITY=SI
P2_T06_PRIORITY=FIRST_AFTER_P2_T18_AND_PRODUCTION_SYNC_AUDIT
P2_T14_EARLY_PRIORITY=SI
P2_T14_PRIORITY=SECOND_AFTER_P2_T18_IF_DEPENDENCY_SAFE
P2_T14_DEPENDENCY_GATE_REQUIRED=SI
P2_T14_MUST_NOT_BE_DELAYED_BY_NON_REQUIRED_T07_T08_T09=SI
NO_UNVERIFIED_ROADMAP_REORDER=SI
```

Orden completo deseado: cierre de P2-T18 (R13-R7 real-browser 18/18 →
F-P1-02 → F-P1-01 → closeout) → auditoría de sincronización
Producción-vs-testing-codex → sincronización aprobada en etapas
controladas → `P2-T06 → P2-T14 → P2-T07 → P2-T08 → P2-T09 → P2-T15 →
P2-T17 → P2-T10 → P3` (T14 sólo si es dependency-safe). Al inicio de
`P2-T14` debe auditarse primero cualquier dependencia dura contra
T07/T08/T09 — si no existe ninguna, T14 procede inmediatamente después
de T06; si existe una dependencia dura, sólo el/los prerequisito(s)
mínimo(s) necesario(s) pueden ejecutarse antes de T14, sin abandonar la
prioridad. Ni R13-R4 ni R13-R6 iniciaron nada de esto (ni la auditoría
de Producción, ni T06, ni T14), y **no** renumeraron las posiciones
11-18 del roadmap (regla explícita `NO_UNVERIFIED_ROADMAP_REORDER=SI`)
— sólo dejaron la intención del usuario registrada de forma explícita
para cuando P2-T18 cierre completo.

---

## P2-T18-BLOCKER-AUTH2-R13-R5 — postcommit prepush exact blob review — PASS — 2026-08-29

Recertificó de forma independiente el commit `fe0e11d0` (R13-R4)
leyendo los objetos Git directamente desde `HEAD`, sin confiar en el
resumen de R13-R4 y sin re-ejecutar ninguna batería de tests (0 test
runs, 0 acceso a DB). Fileset commiteado derivado por 2 métodos Git
independientes — 14 paths exactos, 0 rutas prohibidas. 14 blob IDs
derivados vía `git ls-tree HEAD` — 14/14 idénticos a los certificados.
Lectura directa de los 14 blobs desde `HEAD` confirmó el contrato de
selector de `proxy.ts`, el contrato de Chat/Push, y las protecciones
M9/M19. Diff commiteado completo revisado (33 hunks, 0 sin clasificar/
incidental). 0 diferencia de working tree contra `HEAD`.

```
R13_R5_FILESET_MATCHES_R13_R4=14_OF_14_PASS
R13_R5_BLOB_MATCH_R13_R4=14_OF_14_PASS
P2_T18_BLOCKER_AUTH2_R13_R5=PASS_AUTH02_POSTCOMMIT_PREPUSH_EXACT_BLOB_REVIEW
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
`codex-reports/archive/P2-T18-BLOCKER-AUTH2-R13-R4.md`. Siguiente
tarea: `P2-T18-BLOCKER-AUTH2-R13-R6` — "FRESH PREPUSH + TESTING
PUSH/DEPLOY CERTIFICATION", no ejecutada.

---

## P2-T18-BLOCKER-AUTH2-R13-R6 — fresh prepush + push + deploy TESTING — PASS — 2026-08-29

Gate final de entrega server-side, lean por prioridad explícita del
usuario. Continuidad de blobs 14/14 contra R13-R5. Focal fresco
(única corrida): **117 pass / 0 fail / 280 expect() calls**, idéntico
al histórico. ESLint limpio; TSC 31/24 idéntico a la baseline vigente
(0 nuevo en los 14 paths de AUTH02); `git show --check`/`npm run
build` limpios. Railway confirmado read-only en
`amiable-rejoicing`/`TESTING`, sin deploy concurrente, health prepush
limpio.

```bash
git push origin testing-codex
# a1579f1..fe0e11d  testing-codex -> testing-codex
```

Movimiento remoto confirmado: `HEAD=ORIGIN=fe0e11d0`, `AHEAD=0`/
`BEHIND=0`. Autodeploy Git-triggered observado read-only (polling
`railway status --json` cada 15s):

```
DeliGO Copy: SUCCESS, commit fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f
chat en vivo: SUCCESS, commit fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f
```

Ambos `commitHash` confirmados desde metadata real de Railway. Health
y logs postdeploy limpios, 0 errores materiales.

```
P2_T18_BLOCKER_AUTH2_R13_R6=PASS_AUTH02_TESTING_PUSH_DEPLOY_CERTIFIED
AUTH02_PUSHED=SI
AUTH02_DEPLOYED_TESTING=SI
R13_R7_AUTHORIZED=SI
```

Cero DB real, cero navegador real, cero fixture manual, Production
intacta. Detalle completo en `codex-reports/CURRENT_TASK.md`; R13-R5
archivado en `codex-reports/archive/P2-T18-BLOCKER-AUTH2-R13-R5.md`.
Siguiente tarea: `P2-T18-BLOCKER-AUTH2-R13-R7` — "FULL REAL-BROWSER
REPLAY FROM ZERO", no ejecutada.

---

## P2-T18-BLOCKER-AUTH2-R13-R7 — full real-browser replay from zero — PASS — 2026-08-29

Repitió desde cero, con Chrome real (Claude in Chrome, "Browser 2"),
la matriz histórica de 18 casos de R13 contra el commit desplegado
`fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f` — 0/18 de crédito heredado.
Matriz recuperada verbatim de `codex-reports/archive/P2-T18-BLOCKER-AUTH2-R13.md`
antes de tocar DB/navegador. Fixtures TESTING frescas (prefijo
`P2T18_AUTH2_R13_R7_`: 1 Cliente + 1 Negocio + 1 Producto + 1 Pedido)
vía harness externo que replica `hashPassword()` — nunca importando
código del repo, nunca `DATABASE_URL` de fallback.

```
CASE_01..CASE_18=PASS (18/18)
R13_R7_ACCEPTANCE_MATRIX=18_OF_18_PASS
R13_R7_HISTORICAL_CASES_REUSED_AS_PASS=0
```

Destacados: CASE_05 recreó el ataque directo original de AUTH01
(Cliente sobrevive sin recarga al login de Negocio) — PASS. CASE_09
recreó directamente el síntoma histórico de AUTH02 (chat del Pedido
abierto en ambas tabs — `no-leidos`/`conversaciones`/`mensajes`/
`realtime-token`/`realtime-authorize`, TODOS 200) — síntoma NO
reproducido. CASE_12/13 (sync nativo cross-tab de logout por familia)
y CASE_17 (sin secreto de sesión en JS storage — el cuerpo real de
`/api/auth/login` sólo expone `ok`/`user.{id,email,nombre,telefono,type}`)
también PASS. Dos correcciones de control documentadas (presupuesto
máximo 2, ninguna ocultó un fallo real): toast residual tapando el
botón de logout de Negocio; autocompletado residual del navegador en
el campo contraseña de Cliente. Cleanup completo: 0 filas residuales
DB, ambas familias `401` tras logout+clear, 0 tabs remanentes.

```
P2_T18_BLOCKER_AUTH2_R13_R7=PASS_AUTH01_AUTH02_FULL_REAL_BROWSER_REPLAY_18_OF_18
F_P2_T18_AUTH01_STATUS=RESOLVED
F_P2_T18_AUTH02_STATUS=RESOLVED
AUTH01_RESOLVED_COMMIT=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f
AUTH02_RESOLVED_COMMIT=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f
P2_T18_BLOCKED_BY_AUTH_SESSION_COEXISTENCE=NO
P2_T18=BLOCKED_ONLY_BY_REMAINING_CHAT_UI_REAL_BROWSER_ACCEPTANCE_F_P1_02_THEN_F_P1_01
```

Cero DB real fuera del harness de fixtures/cleanup, cero mutación de
producto/test, cero commit/push/deploy — Git final idéntico
`HEAD=ORIGIN=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f`, `AHEAD=0`/
`BEHIND=0`, índice vacío. Preservó, sin ejecutar nada, la excepción
temporal `EX-P2-T18-SEC-BLOCK-1-P2028`, el finding diferido
`F-P2-TESTINFRA-01`, y las prioridades post-P2-T18 del usuario
(auditoría de sincronización Producción-vs-`testing-codex` primero,
luego `P2-T06` → gate de dependencia de `P2-T14`). `F-P2-T18-AUTH01` y
`F-P2-T18-AUTH02` quedan `RESOLVED`, pero **P2-T18 NO se cierra** —
bloqueado únicamente por la aceptación con navegador real de la UI de
Chat restante (`F-P1-02`, luego `F-P1-01`). Detalle completo en
`codex-reports/CURRENT_TASK.md`; R13-R6 archivado en
`codex-reports/archive/P2-T18-BLOCKER-AUTH2-R13-R6.md`
(`545f6537b512bc20959842a3d836f41e443f4a6e85d28d85a8b78fa3f3eee2e6`).
Siguiente tarea definida (no ejecutada, requiere prompt nuevo del
usuario): `P2-T18-F-P1-02-REAL-BROWSER-ACCEPTANCE`.

---

## P2-T18-F-P1-02-REAL-BROWSER-ACCEPTANCE — same-actor sibling self-typing suppression — BLOCKED_REAL_BROWSER_TYPING_CONTROL_INVALID — 2026-08-29

Intentó certificar con Chrome real (Browser 2) el fix ya desplegado de
`F-P1-02` (commit `1adcc01f`) contra `fe0e11d0` — AUTH01/AUTH02
preservados `RESOLVED` sin reabrir. Fixture fresca TESTING (prefijo
`P2T18_F_P1_02_`), topología X1/X2 (mismo Cliente) + Y1 (Negocio
distinto), baseline de chat bidireccional confirmado PASS en ambas
direcciones. La matriz de typing (Y1→X1/X2, X1→Y1), repetida con
room-grants recién renovados en cada intento, nunca mostró el
indicador de typing en el receptor — confirmado por lectura de código
que el emisor sí disparaba `sendTyping` en cada intento, y descartado
un problema meramente visual vía `body.innerText`. Sin control remoto
positivo válido en ninguna dirección: `CONTROL_INVALID`, no `PASS` ni
`FAIL`.

```
P2_T18_F_P1_02_REAL_BROWSER_ACCEPTANCE=BLOCKED_REAL_BROWSER_TYPING_CONTROL_INVALID
F_P1_02_CURRENT_STATUS=REAL_BROWSER_TYPING_CONTROL_INVALID
F_P1_01_STATUS_CHANGED=NO
P2_T18=BLOCKED_ONLY_BY_REMAINING_CHAT_UI_REAL_BROWSER_ACCEPTANCE_F_P1_02_THEN_F_P1_01
```

Cero mutación de producto/test, cero commit/push/deploy. Cleanup
completo (DB + navegador, 0 residuales, 0 tabs remanentes). Git final
idéntico `HEAD=ORIGIN=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f`,
`AHEAD=0`/`BEHIND=0`. Preservó sin ejecutar las prioridades
post-P2-T18 y la excepción temporal `EX-P2-T18-SEC-BLOCK-1-P2028`.
Detalle completo en `codex-reports/CURRENT_TASK.md`; R13-R7 archivado
en `codex-reports/archive/P2-T18-BLOCKER-AUTH2-R13-R7.md`
(`d664df0db7f84e6f8b3453c6b6d3b3cb59a051e1778b01efcbd7f44e7ae9aa11`).
Siguiente tarea definida (no ejecutada): `P2-T18-F-P1-02-REAL-BROWSER-ACCEPTANCE-R1`.

---

## P2-T18-F-P1-02-REAL-BROWSER-ACCEPTANCE-R1 — focused typing channel diagnosis — PASS_DIAGNOSIS_GENUINE_TYPING_CHANNEL_DEFECT_ISOLATED — 2026-08-29

Diagnóstico acotado (máximo 3 observaciones) que aisló el primer tramo
roto del pipeline de typing. Observation 1 (harness externo con
`socket.io-client`, dos actores reales, chat-service real): servidor
100% sano en ambas direcciones. Observation 2 (Browser 2 real, espera
deliberada de 5s antes de escribir): descarta timing/room-grant.
Observation 3 (observador temporal de solo lectura de WebSocket,
excepción puntual del prompt): cero frames Y cero requests HTTP de
cualquier tipo hacia el chat-service — el navegador nunca intenta
conectar, pese a que `/realtime/token`+`/realtime/authorize` devuelven
200.

```
FIRST_BROKEN_HOP=HOP_B
R1_CLASSIFICATION=SENDER_CLIENT_EGRESS_DEFECT
NEW_TYPING_CHANNEL_FINDING_ID=F-P2-T18-TYPING-CHANNEL-01
F_P1_02_CURRENT_STATUS=BLOCKED_BY_TYPING_CHANNEL_DEFECT
SEVERITY=MEDIUM
NEXT_REQUIRES_USER_DISPOSITION=SI
```

No es el guard de auto-eco de F-P1-02 el que falla — es un defecto
distinto que bloquea su aceptación. Ningún fix intentado, causa raíz
interna queda `UNKNOWN_PENDING_FOCUSED_IMPLEMENTATION_DIAGNOSIS` por
presupuesto agotado. Cero mutación de producto/test, cero commit/push/
deploy. Cleanup completo (DB + navegador + harness + observador, 0
residuales). Git final idéntico
`HEAD=ORIGIN=fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f`, `AHEAD=0`/
`BEHIND=0`. Por política explícita de velocidad del usuario, no se
define R2 automático — se requiere disposición explícita entre: (A)
investigar/corregir ahora; (B) diferir y avanzar a F-P1-01 igual; (C)
diferir ambos y cerrar P2-T18 con residual MEDIUM aceptado. Detalle
completo en `codex-reports/CURRENT_TASK.md`; etapa anterior archivada
en `codex-reports/archive/P2-T18-F-P1-02-REAL-BROWSER-ACCEPTANCE.md`
(`7810a8a478b662738cd187ac37d64548d1daf383672bc77cd4f2b6226bf5632c`).

## Promoción completada — BUSINESS-HOURS-TIMEZONE-PRODUCTION-PROMOTION-R1

El fix timezone-aware fue promovido a Production en `a178140` por fast-forward limpio. Migración única aditiva certificada, backup pre/post restaurables, horarios sin cambios y smoke público PASS. `PUBLIC_LAUNCH_AUTHORIZED=NO`; el siguiente trabajo requiere autorización explícita. Evidencia: `codex-reports/BUSINESS_HOURS_TIMEZONE_PRODUCTION_PROMOTION_R1.md`.

## Cross-chat handoff — P2-T18 realtime diagnosis correction

HISTORICAL_CONCLUSION: se conserva `P2_T18=PAUSED_NOT_CLOSED_EXTERNAL_INFRA_DEPENDENCY`; no se reescribe la historia ni se marca P2-T18 como CLOSED.

NEW_RUNTIME_COUNTEREVIDENCE: Negocio móvil dentro del chat sí recibió `new-message` y `user-typing` en pruebas manuales reales; otros actores/dispositivos y la superficie fuera del chat no observaron realtime según la matriz aportada por el usuario.

CURRENT_PROVISIONAL_CLASSIFICATION: `P2_T18=PAUSED_PENDING_REALTIME_ACTOR_DEVICE_MATRIX_REDIAGNOSIS`; `RAILWAY_GLOBAL_ROOT_CAUSE_CONFIRMED=NO`; `RAILWAY_GLOBAL_TRANSPORT_BLOCK_ASSUMPTION_ALLOWED=NO`; el próximo diagnóstico es `P2-T18-REALTIME-ACTOR-DEVICE-MATRIX-R1`.

No se ejecuta esta investigación en PRODUCT-DUPLICATION-R1. `P2_T18_OUTSIDE_CHAT_REALTIME_STATUS=NEEDS_CONTRACT_AUDIT_NOT_YET_CLASSIFIED_AS_BUG`.

## PRODUCT-GALLERY-PERSISTENCE-HOTFIX-R1 — cierre

```text
BUSINESS-CATALOG-UX-HARDENING-R1=CLOSED
SHARED-OPTIONS-SERVER-HARDENING-R1=CLOSED
PRODUCT-DUPLICATION-R1=CLOSED
PRODUCT-GALLERY-PERSISTENCE-HOTFIX-R1=PASS
CATALOG-PRODUCT-CATEGORY-REORDER-UX-AUDIT-R1=PAUSED_UNTIL_GALLERY_HOTFIX_PASS (desbloqueada; no ejecutada)
P0=CLOSED
P1=CLOSED
P2=IN_PROGRESS
P3=NOT_STARTED
NEXT_ACTION=CATALOG-PRODUCT-CATEGORY-REORDER-UX-AUDIT-R1
```

Evidencia: `PRODUCT_GALLERY_PERSISTENCE_HOTFIX_R1.md`. El hotfix fue publicado sólo en `testing-codex`; Production permanece intacta.

## PRODUCT-CATALOG-REORDER-R1 — cierre

```text
CATALOG-PRODUCT-CATEGORY-REORDER-UX-AUDIT-R1=CLOSED_PASS
PRODUCT-GALLERY-PERSISTENCE-HOTFIX-R1=PASS
CATALOG-PRODUCT-REORDER-R1=PASS
CURRENT_TASK_ID=CATALOG-PRODUCT-REORDER-R1
CURRENT_TASK_STATUS=PASS_COMPLETED
SOURCE_COMMIT=983056785329e412e948b2523e1f8989f5ee45fc
TESTING_DEPLOYMENT=SUCCESS_COMMIT_MATCH
PRODUCTION_TOUCHED=NO
P2_T18_HANDOFF=PRESERVED_UNCHANGED
NEXT_ACTION=SECTION_REORDER_ATOMICITY;SECTION_PRODUCT_REORDER;CATEGORY_PILL_REORDER;DUPLICATION_SECTION_POSITION
```

La auditoría de reorder de categorías ya estaba cerrada y no se repitió. La implementación
agrega `PATCH /api/negocio/productos/orden` para el conjunto activo completo, append
server-side para altas normales y modo UX explícito desktop/mobile. Evidencia detallada:
`CATALOG_PRODUCT_REORDER_R1.md`. Production permanece intacta.

## Cierre — PRODUCT-GALLERY-PUBLIC-RENDER-HOTFIX-R1

```text
CURRENT_TASK_ID=PRODUCT-GALLERY-PUBLIC-RENDER-HOTFIX-R1
CURRENT_TASK_STATUS=PASS_COMPLETED
ROOT_CAUSE_LAYER=GALLERY_DATA_PRESENT_BUT_NAVIGATION_MISSING
SOURCE_COMMIT=dfbd639276ef7a5bbb943bad8e845260a91b292b
TESTING_DEPLOYMENT=SUCCESS_COMMIT_MATCH
PRODUCTION_TOUCHED=NO
P2_T18_CLOSED=NO
P2_T18_HANDOFF=PRESERVED_UNCHANGED
NEXT_ACTION=CATALOG-SECTION-REORDER-ATOMICITY-R1
AUTHORITY_REPORT=PRODUCT_GALLERY_PUBLIC_RENDER_HOTFIX_R1.md
```

La API pública ya transportaba `imagenUrl` e `imagenesExtra`; el bloqueo estaba en que
`ProductDetailSheet` sólo navegaba la galería para `rubro=ropa`. El componente compartido
ahora expone la galería para catálogo público y Business Preview. La revisión de reorder de
producto no se repitió. El walkthrough manual multi-imagen queda pendiente por falta de una
fixture autenticada segura; los tests DOM/componentes e integración API fueron PASS.

## Auditoría — CATALOG-PRODUCTION-PROMOTION-READINESS-R1

```text
CURRENT_TASK_ID=CATALOG-PRODUCTION-PROMOTION-READINESS-R1
CURRENT_TASK_STATUS=PASS_READY_FOR_CONTROLLED_PRODUCTION_PROMOTION_SELECTIVE_ONLY
TESTING_CERTIFIED_COMMIT=dfbd639276ef7a5bbb943bad8e845260a91b292b
MAIN_HEAD=a178140ef5167dce1b596edeb58e17cc7029beaf
PRODUCTION_DEPLOYED_COMMIT=a178140ef5167dce1b596edeb58e17cc7029beaf
UNRELATED_COMMITS_PRESENT=YES_IOS_DIAGNOSTIC_COMMITS_EXCLUDED
PROMOTION_STRATEGY=SELECTIVE_CHERRY_PICK_12_CATALOG_COMMITS_FROM_ORIGIN_MAIN
MIGRATIONS_REQUIRED=NO
NEW_RUNTIME_ENV_VARS=0
ROLLBACK=CONDITIONAL_FORWARD_COMPATIBLE_PLAN_REQUIRED_AFTER_NEW_PRICED_OPTION_WRITES
P2_T18_CLOSED=NO
P2_T18_HANDOFF=PRESERVED_UNCHANGED
NEXT_ACTION=CATALOG-PRODUCTION-PROMOTION-R1
AUTHORITY_REPORT=CATALOG_PRODUCTION_PROMOTION_READINESS_R1.md
```

La rama completa no se promueve: contiene nueve commits iOS/diagnóstico fuera de
esta tanda. La readiness es PASS sólo para el set selectivo de catálogo descrito
en el reporte; esta auditoría no ejecutó promoción ni cambió Production.

## CATALOG-PRODUCTION-PROMOTION-R1 — bloqueado pre-push

La release local `release/catalog-production-r1` se construyó desde
`a178140ef5167dce1b596edeb58e17cc7029beaf` con los 12 cherry-picks certificados,
sin conflictos. Resultado: `86609599bcbdf7979244c34298a27836e6452d3c`, 62 rutas en
el diff neto (64 rutas tocadas por el union histórico), patch-equivalence PASS,
sin iOS/chat/realtime/push/tracking/Prisma/migraciones/package/lockfiles.

Las gates de lint focal, build `150/150`, diff-check, schema/migrations/env/deps
pasaron; lint global y TSC reprodujeron únicamente sus baselines conocidos. La
batería combinada de tests produjo `308 pass / 1 fail`: el fallo es un contrato
estático del tutorial que exige LF literal en un checkout Windows CRLF. El test y
la fuente son byte-a-byte iguales a `origin/testing-codex`, por lo que no se
introdujo una regresión de release, pero la tarea exige `REGRESSION_FAIL_COUNT=0`.

`MAIN_PUSH_COUNT=0`; `origin/main` y Production siguen en `a178140`, Testing no
fue modificada, y Production recibió cero writes/config/migraciones/restarts.
Reporte autocontenido: `CATALOG_PRODUCTION_PROMOTION_R1.md`. No ejecutar rollback.

```text
CATALOG-PRODUCTION-PROMOTION-R1=BLOCKED_PRE_PUSH_RELEVANT_TEST_HOST_LINE_ENDING_STATIC_CONTRACT
NEXT_ACTION=REVERIFY_TEST_GATE_ON_LF_NATIVE_CHECKOUT_OR_APPROVED_TEST_HARNESS
POST-PRODUCTION-BRANCH-RECONCILIATION-R1=DEFERRED
P2_T18_CLOSED=NO
P2_T18_HANDOFF=PRESERVED_UNCHANGED
```

## CATALOG-PRODUCTION-PROMOTION-GATE-REVERIFY-R1 — bloqueado

La re-verificación exigía un entorno Linux/LF real para confirmar el único
blocker `308 PASS / 1 FAIL` causado por un contrato estático que busca LF. El
host actual no tiene distribución WSL ni Docker/Podman. El focal Windows volvió
a dar `34 pass / 1 fail`, con 630 CRLF y 0 LF desnudos, pero no se declara que el
fallo sea falso positivo sin la ejecución Linux solicitada.

La release sigue en `release/catalog-production-r1` /
`86609599bcbdf7979244c34298a27836e6452d3c`; `origin/main` y Production siguen
en `a178140ef5167dce1b596edeb58e17cc7029beaf`. No hubo source change, commit,
push, deploy, restart, configuración ni DB write.

```text
CATALOG_PRODUCTION_PROMOTION_GATE_REVERIFY-R1=BLOCKED_LF_LINUX_RUNNER_UNAVAILABLE
RELEASE_REGRESSION_GATE=BLOCKED_LINUX_REVERIFY_NOT_EXECUTED
PRODUCTION_PROMOTION_CAN_RESUME=NO
NEXT_ACTION=CATALOG-TUTORIAL-STATIC-CONTRACT-PORTABILITY-AUDIT-R1
P2_T18_CLOSED=NO
P2_T18_HANDOFF=PRESERVED_UNCHANGED
AUTHORITY_REPORT=CATALOG_PRODUCTION_PROMOTION_GATE_REVERIFY_R1.md
```

## P2-T06-HARDENING-R1 — implementación

```text
CURRENT_TASK_ID=P2-T06-HARDENING-R1
CURRENT_TASK_STATUS=COMPLETED_TESTING_DEPLOYED
F1=PASS
F2=PASS
F3=PASS_4_OF_4
F4=PASS
F5=PASS_17_OF_17
F6=PASS_17_OF_17
TESTING_TARGETED_TESTS=12_PASS_0_FAIL
BUILD=PASS_155_OF_155
PRODUCTION_TOUCHED=NO
P2_T14_READY_AFTER_T06=SI
P2_T18=PAUSED_PRESERVED
COMMIT_SHA=72e59d4d01e5495fceaf4b575597fcc3c066dbd1
PUSH_COUNT=1
TESTING_DEPLOYMENT_STATUS=SUCCESS
TESTING_DEPLOYMENT_COMMIT_MATCH=SI
TESTING_DIRECT_STATUS_CHECK=PASS
NEXT_ACTION=P2-T14_DEPENDENCY_GATE
AUTHORITY_REPORT=P2_T06_HARDENING_R1.md
```
# P2-T14-LEGACY-M-TOKEN-FULL-MIGRATION-R1 — 2026-09-01 (CLOSED)

```text
P2_T14= CLOSED
P2_T14_STATUS=PASS_LEGACY_MOZO_TOKEN_AUTH_RETIRED_AND_OPERATIVE_SESSION_MIGRATION_DEPLOYED_IN_TESTING
P2_T14_COMMIT=8fb4688dd5da0a6065e53801c34f132c530da5d4
P2_T14_TESTING_DEPLOY=SUCCESS
P2_T14_LEGACY_M_TOKEN_AUTHORIZATION_ACTIVE=NO
P2_T14_LEGACY_PRODUCTIVE_SECURITY_SURFACE_COUNT=0
P2_T14_CROSS_BUSINESS=PASS
P2_T14_AREA_REVALIDATION=PASS
P2_T14_REGRESSION_FAIL_COUNT=0
P2_T14_PRODUCTION_UNCHANGED=SI
F7_SECURITY_RISK_STATUS=CLOSED_NO_PRODUCTIVE_AUTH_SURFACE
NEXT_TASK_ID=P2-T07
NEXT_TASK_TITLE=Stale-Capability Review
P2_T18_STATUS=PAUSED
```

P2-T14 cerró la credencial productiva `Empleado.token` sin migración de
schema: `/m/[token]` es deprecación neutral, las APIs legacy responden 410,
`mesas-assign` ya no tiene fallback `mozoToken`, y el flujo personal usa
CuentaOperativa/Empleado más `deligo_operativo_session`. TESTING quedó
desplegado y certificado sobre `8fb4688`. Production permanece en
`86609599bcbdf7979244c34298a27836e6452d3c`; no hubo escritura de datos,
configuración ni deploy.

Detalle: `codex-reports/P2_T14_LEGACY_M_TOKEN_FULL_MIGRATION_R1.md`.

P2-T46-R1: implementación aprobada en `work/p2-t46-r1` con autoridad de pago por ocupación, aislamiento entre ocupaciones, guardas de cierre y detalle canónico. Pendiente deploy exclusivo a Testing y certificación manual.

## P2-T46-R3 — operator recertification closeout — 2026-09-11

P2-T46 quedó `CLOSED_TESTING_CERTIFIED` con certificación física del
operador PASS sobre el runtime exacto `c3da04ef84dbd183956e78691a3b3da0f5dc2f68`.
El Testing actual `c826e796d33de5d00f8efddf4fa258fb86587c6a` es un descendiente
lineal que sólo agrega documentación del despliegue; no modifica el árbol
funcional certificado. `P2_T46_RELEASE_ELIGIBLE=SI` para evaluación futura de
promoción curada, sin promoción ejecutada en este closeout. Evidencia completa:
`codex-reports/P2_T46_R3_OPERATOR_RECERTIFICATION_CLOSEOUT.md`.

## P2-T46-R4 — curated Production promotion — 2026-09-11

P2-T46 fue promovida de forma curada y exact-scope a Production mediante
`ff4cc2f875dbf67f7bdfc0229104d8c3c6c08763`, sin arrastrar `testing-codex`,
T02 ni features unrelated. La migración nullable/aditiva se aplicó sin
backfill, Railway Production quedó `SUCCESS/RUNNING`, y el checkpoint anotado
`p2-t46-stable-2026-09-11` apunta al nuevo main. Estado:
`P2_T46_STATUS=CLOSED_PRODUCTION`, `P2_T46_RELEASE_STATUS=CLOSED_PRODUCTION_CHECKPOINTED`.
Production no autoriza todavía el lanzamiento público (`PUBLIC_RELEASE_AUTHORIZED=NO`).
La siguiente prioridad recomendada es `P2-T32` (Client Address UX Unification +
Profile Deep-Link); no se inició. Evidencia: `codex-reports/P2_T46_R4_CURATED_PRODUCTION_PROMOTION.md`.

---
