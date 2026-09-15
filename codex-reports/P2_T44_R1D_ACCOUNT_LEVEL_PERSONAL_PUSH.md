# P2-T44-R1D — Account-level personal Push

```text
P2_T44_R1D_STATUS=IMPLEMENTED_TESTING_AWAITING_DEPLOYMENT
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
TESTING_DEPLOYMENT_ID=PENDING
TESTING_DEPLOYMENT_STATUS=PENDING
TESTING_DEPLOYMENT_COMMIT=PENDING
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
```

No se realizó certificación visual ni se enviaron Push de prueba. La migración y cualquier deploy de este cambio se limitan a Testing; Production mantiene su SHA autoritativo sin cambios.
