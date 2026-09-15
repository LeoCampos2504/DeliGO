# P2-T44-R1D — Account-level personal Push

```text
P2_T44_R1D_STATUS=IMPLEMENTED_TESTING_DEPLOYED_AWAITING_OPERATOR_PHYSICAL_CERTIFICATION
R1D_COMMIT_SHA=c3bf576e0a63da29e408672c9cc96384fc4ac4fc
PERSONAL_PUSH_SCHEMA_CHANGE_AUTHORIZED=SI
PUSH_OWNER_TYPE=cuenta_operativa
PUSH_OWNER_ID_SOURCE=server_derived_operational_session_account_id
LEGACY_ACCOUNT_PUSH_FIELD=NO
AREA_PUSH_TOGGLES=REMOVED
ACCOUNT_PUSH_SETTINGS_PATH=/operaciones/cuenta
ACCOUNT_PUSH_SWITCH_COUNT=1
NOTIFICATION_BELL_PURPOSE=VIEW_NOTIFICATIONS_ONLY
PRODUCER_AUTHORIZATION=EMPLOYEE_BUSINESS_AREA_RELATION
PRODUCER_ACCOUNT_DEDUPE=SI
PRODUCER_ENDPOINT_DEDUPE_PER_EVENT=SI
LEGACY_EMPLOYEE_FALLBACK=ONLY_WHEN_ACCOUNT_HAS_NO_ACCOUNT_LEVEL_ROW
LOGOUT_ACCOUNT_EXACT_MATCH=SI
P2_T44_R1C_STATUS=SUPERSEDED_BY_R1D_AUTHORIZED_SCHEMA_IMPLEMENTATION
PRISMA_SCHEMA_CHANGED=SI
PRISMA_MIGRATION=20260914100000_account_level_personal_push
TESTING_MIGRATION=APPLIED
PRODUCTION_MIGRATION=NOT_RUN
TESTING_DEPLOYMENT_ID=08782b78-bc49-4878-b155-36d7a51a2849
TESTING_DEPLOYMENT_STATUS=SUCCESS_RUNNING
TESTING_DEPLOYMENT_COMMIT=4e1fc296327a3fbb6fa5724f9739cc1441e74c86
TESTING_CLIENT_URL=https://deligo-copy-production.up.railway.app
PRODUCTION_TOUCHED=NO
PHYSICAL_OPERATOR_CERTIFICATION=PENDING
NEXT_ACTION=OPERATOR_ENABLE_ACCOUNT_PUSH_AND_CERTIFY_CROSS_BUSINESS_DELIVERY
```

## Implementación

- La tabla normalizada `push_subscriptions` admite `ownerType=cuenta_operativa`.
- `/api/push/status`, `/subscribe` y `/unsubscribe` aceptan la familia operativa y derivan la cuenta desde `deligo_operativo_session`; no aceptan `ownerId`, negocio, empleado ni slug desde el cliente.
- La pantalla `/operaciones/cuenta` concentra el único switch personal. Mozo, PyR y Salón ya no exponen activación Push por área; sus campanas quedan dedicadas al centro de notificaciones.
- Los productores de pedidos nuevos, cancelaciones y pedido de mesa listo resuelven relaciones empleado–negocio–área, agrupan por cuenta y deduplican endpoints por evento. Las filas de empleado sólo sirven como fallback acotado para cuentas aún sin fila de cuenta.
- El logout operativo retira la fila exacta de cuenta/dispositivo y conserva la limpieza legacy de empleados.

## Fixture Testing preparado

```text
FIXTURE_PREFIX=TEST_T44_R1D_
ACCOUNT_ID=cmu1xe5p10000rip8gbsxes0l
ACCOUNT_LOGIN=test_t44_r1d_4135ea7a@example.test
BUSINESS_A_ID=cmu1xe6780001rip85yygdszn
BUSINESS_A_NAME=TEST_T44_R1D_NEGOCIO_A_4135EA7A
BUSINESS_A_AREA=mozo
BUSINESS_B_ID=cmu1xe6ok0002rip8yc707wze
BUSINESS_B_NAME=TEST_T44_R1D_NEGOCIO_B_4135EA7A
BUSINESS_B_AREA=pyr
EMPLOYEE_A_ID=cmu1xe6vr0004rip8eqkwkziq
EMPLOYEE_B_ID=cmu1xe79q0006rip8lbdqmvpz
PRECREATED_PUSH_SUBSCRIPTIONS=0
```

La contraseña temporal se entregó sólo en la respuesta runtime al operador y no se persiste en este reporte.

## Verificación

```text
GLOBAL_PUSH_ROUTE_REGRESSION=64_PASS
PYR_AREA_PUSH_STATIC_CONTRACT=UPDATED_PASS
FOCAL_LINT=PASS
DIFF_CHECK=PASS
TYPECHECK=PREEXISTING_OUT_OF_SCOPE_ERRORS_ONLY
TESTING_NORMAL_OPERATIONAL_LOGIN=PASS
TESTING_OPERATIONAL_ME=PASS
TESTING_ACCOUNT_PUSH_STATUS_WITHOUT_BINDING=PASS
TESTING_ACCOUNT_PUSH_ROWS_AFTER_FIXTURE_PREPARATION=0
```

No se realizó certificación visual ni se enviaron Push de prueba. La migración y cualquier deploy de este cambio se limitan a Testing; Production mantiene su SHA autoritativo sin cambios.

## R1E — preparación de certificación física

```text
R1D_DEPLOY_CONTAINS_IMPLEMENTATION=SI
DEPLOY_COMMIT_RELATION_TO_R1D=POSTERIOR_DOCS_COMMIT
REQUESTED_R1D_DEPLOYMENT_ID=08782b78-bc49-4878-b155-36d7a51a2849
REQUESTED_R1D_DEPLOYMENT_STATUS=REMOVED_BY_RAILWAY_REPLACEMENT
CURRENT_TESTING_DEPLOYMENT_ID=a7d3b5e2-2642-4af0-854a-83dc6b017c7a
CURRENT_TESTING_DEPLOYMENT_STATUS=SUCCESS_RUNNING
CURRENT_TESTING_DEPLOYMENT_COMMIT=f1604f22784131f963aed5e008fb8c4fe773b5a5
TESTING_LOGIN_HTTP_STATUS=200
TESTING_ACCOUNT_OWNER_SCHEMA=PASS
BUSINESS_C_ID=cmu1ycdqr0000rii4nskdb6ug
BUSINESS_C_NAME=TEST_T44_R1D_NEGOCIO_C_4135EA7A
BUSINESS_C_AREA=salon
BUSINESS_C_SALON_ACTIVE=SI
EMPLOYEE_C_ID=cmu1yce4v0002rii4okjefbi4
ACCOUNT_HAS_MOZO_RELATION=SI
ACCOUNT_HAS_PYR_RELATION=SI
ACCOUNT_HAS_SALON_RELATION=SI
PRE_OPERATOR_ACCOUNT_PUSH_ROWS=0
PRECREATED_PUSH_SUBSCRIPTIONS=0
P2_T44_R1E_STATUS=READY_FOR_OPERATOR_ACCOUNT_LEVEL_PUSH_CERTIFICATION
PHYSICAL_OPERATOR_CERTIFICATION=PENDING
NEXT_ACTION=OPERATOR_ENABLE_ACCOUNT_PUSH_ONLY
PRODUCTION_DATABASE_TOUCHED=NO
PRODUCTION_TOUCHED=NO
```

La relación Salón se agregó al mismo fixture y a la misma CuentaOperativa;
el negocio de prueba quedó aprobado y con Salón habilitado para que la
relación sea utilizable durante las fases posteriores. No se llamó a
`/api/push/subscribe`, no se insertaron subscriptions y no se enviaron
eventos Push.
