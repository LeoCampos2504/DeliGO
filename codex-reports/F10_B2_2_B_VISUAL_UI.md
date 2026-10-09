# DeliGO — F10-B2.2-B: UI visual de cajas y turnos compartidos

Fecha: 2026-10-09 · Entorno objetivo: Railway TESTING únicamente · Production: sin cambios.

```text
F10_B2_2_A_STATUS=IMPLEMENTED_TESTING
F10_B2_2_B_STATUS=IMPLEMENTED_TESTING
F10_B2_2_C_STATUS=NOT_STARTED
CODE_COMMIT=a210edb9acea594c70579a20eeab80b165d8bb4e
CODE_DEPLOY_ID=617eecb9-7e2d-4791-8ed5-713f3ccd4f2b
CODE_DEPLOY_STATUS=SUCCESS
CODE_DEPLOY_COMMIT_MATCH=YES
TESTING_BRANCH=testing-codex
PRODUCTION_TOUCHED=NO
```

## Alcance implementado

- El panel de Caja del empleado muestra disponibilidad de cajas y su turno
  actual, e integra la apertura de su propio turno. La acción requiere caja
  disponible, fondo inicial y clave idempotente. La interfaz oculta saldos,
  efectivo esperado, acumulados y diferencias.
- La apertura de empleado se habilita sólo si el entorno detectado es TESTING,
  `DELIGO_F10_B2_2_B_SHIFT_UI_ENABLED=true` y el ID de empleado figura en
  `DELIGO_F10_B2_2_B_CONTROLLED_EMPLOYEE_IDS`. El endpoint de apertura aplica
  la misma política. No está habilitada para operación general.
- El panel del dueño muestra cajas y turnos abiertos y permite administrar
  cajas con las APIs existentes (crear, renombrar, predeterminada y activar o
  desactivar cuando está permitido). Una caja con turno abierto no se puede
  desactivar. No se borra historial.
- En checkout del dueño, un único turno abierto se asocia automáticamente;
  con varios, la caja se elige explícitamente y permanece visible. Sin turnos,
  el modo `OPCIONAL` conserva la venta no asignada a caja física. Una selección
  obsoleta falla sin redirigir a otra caja y conserva el carrito.
- La selección se incorpora al fingerprint de la venta nueva y se preserva en
  reintentos inciertos junto con la clave idempotente; se mantiene compatibilidad
  con intentos pendientes antiguos. No se permite que un replay cambie de turno.
- No se agregaron migraciones ni cambios de schema. No hay participantes extra,
  cierre, cierre ciego, recuperación, diferencias, vuelto, consumo interno ni
  activación de `OBLIGATORIO`.

## Validación

- PostgreSQL TESTING se validó de sólo lectura: `current_database=railway`,
  `transaction_read_only=on`, huella `SHA256(system_identifier)[0:12]` =
  `d64be28f676e`; migraciones F10-B0, F10-B2.0 y F10-B2.1 presentes y
  finalizadas. No se imprimieron credenciales.
- Regresiones locales relevantes: 138 pasaron, 0 fallaron; 1.403 aserciones.
  Incluyeron pruebas de UI, selector/idempotencia de checkout, F9, R3A y
  contratos previos F10.
- Suite de integración PostgreSQL utilizada como regresión: 24 pasaron, 0
  fallaron; 225 aserciones. Se comprobaron acceso/apertura controlados,
  autoría de ventas, efectivo/transferencias, idempotencia, selección de caja,
  concurrencia, aislamiento tenant, R3A y privacidad del efectivo esperado.
  La suite limpió sus fixtures de prueba; una consulta read-only posterior
  confirmó cero registros de negocio/cuentas temporales con el prefijo usado.
- TypeScript: 35 diagnósticos, coincidentes con el baseline preexistente; cero
  nuevos en los archivos cambiados. Prisma validate, ESLint en archivos
  cambiados, build Next (162/162 páginas) y `git diff --check` pasaron.
- Smoke posterior al deploy de código: `/` respondió HTTP 200; los endpoints
  de cajas y turno sin sesión respondieron HTTP 401 como corresponde.
- No se realizó prueba autenticada de navegador ni smoke físico de iPhone PWA:
  `IPHONE_PHYSICAL_SMOKE=NOT_PERFORMED`. Por ello no se declara certificación
  física móvil.

## Integración y despliegue

El commit acotado de código B fue `a210edb9acea594c70579a20eeab80b165d8bb4e`
(`feat(caja): add controlled shared-shift UI`), con 15 archivos de producto y
pruebas. Se integró por fast-forward normal a `testing-codex`; no se usó force
push ni staging indiscriminado. Railway TESTING (proyecto `amiable-rejoicing`,
servicio `DeliGO Copy`) desplegó ese SHA como `617eecb9-7e2d-4791-8ed5-713f3ccd4f2b`
con estado `SUCCESS`, instancia `RUNNING`.

El deployment de Production observado permaneció en el servicio `DeliGO`, rama
`main`, SHA `42ca5005d2ecd412de87e454b52820f38aaec5c0`, deployment
`6bf1ee84-702e-41e1-80a8-d075e3ce9362` (`SUCCESS`). No se ejecutaron acciones
contra Production.

Una sincronización documental posterior puede hacer que Railway TESTING genere
otro deployment de `testing-codex`; su ID/estado debe verificarse en Railway al
terminar dicha sincronización. El ID arriba identifica el deploy probado del
commit de código B, no presupone el resultado de un deploy documental posterior.

## Siguientes límites

`F10_B2_2_C_STATUS=NOT_STARTED`. Esperar autorización expresa para comenzar
cierre ciego. No activar `OBLIGATORIO`, no exponer la apertura al personal
general y no desplegar fuera de TESTING.
