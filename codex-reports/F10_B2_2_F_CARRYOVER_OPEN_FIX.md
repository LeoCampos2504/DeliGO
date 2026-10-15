# F10-B2.2-F — corrección de la apertura con fondo transferido (2026-10-15)

## Síntoma (prueba manual en TESTING, negocio Paola Vinal)

Caja principal disponible, fondo del turno anterior $1.500,00 ofrecido, ambas
confirmaciones marcadas → «Abrir turno con fondo transferido» → «Error al abrir
el turno». El turno no se abría y el remanente seguía ofrecido.

## Causa raíz (comprobada)

- Logs de `DeliGO Copy` (TESTING): `POST /api/operativo/caja/paola-vinal/turno`
  → excepción `PrismaClientUnknownRequestError` en
  `prisma.traspasoFondoTurnoCaja.create()`, PostgreSQL `P0001`
  «fund transfer source is no longer the latest shift». La ruta la convertía en
  500 «Error al abrir el turno». La transacción hacía rollback (sin turno ni
  traspaso persistido).
- El mensaje proviene del trigger `validate_fondo_transfer_turno_caja`. La
  migración `20261015120000_f10_b2_2_f_cash_fund_carryover` se aplicó en TESTING
  desde el deployment de `35395f3` (17:50Z, log «Applying migration …»). En esa
  versión, el chequeo «¿hay un turno más nuevo que el origen?» NO excluía el
  propio turno destino, que se inserta antes que el traspaso: toda transferencia
  legítima era rechazada.
- `7a220fd` corrigió el trigger EDITANDO la migración ya aplicada. Prisma no
  re-ejecuta migraciones aplicadas (los deploys posteriores informan «No pending
  migrations»), así que TESTING quedó con la función defectuosa. CI pasaba porque
  su PostgreSQL efímero aplica el archivo final ya corregido.
- Descartado: frontend (envía `cajaFisicaId`, `fondoInicial` "1500.00",
  `transferirDesdeTurnoCajaId`, `confirmoRecepcionFondo: true` correctos),
  idempotencia, validaciones del servicio (todas pasaron hasta el INSERT),
  serialización/bloqueos, índices (idénticos entre 35395f3 y el archivo actual).

## Corrección (commit `dde47b7`)

- Migración correctiva aditiva
  `20261015190000_f10_b2_2_f_fix_fund_transfer_trigger`: `CREATE OR REPLACE
  FUNCTION "validate_fondo_transfer_turno_caja"` con el cuerpo corregido
  (excluye el destino y exige destino posterior al origen). No toca tablas,
  índices ni bindings de triggers; en una base nueva es un reemplazo idéntico.
  La migración `20261015120000` publicada NO se editó.
- UI del empleado (`operational-shift-panel.tsx`): al confirmarse la apertura
  muestra el turno abierto de inmediato y luego relee; ante 409 conocidos
  (fondo ya transferido / no disponible / importe cambiado / caja ocupada o
  inactiva / turno ya abierto) muestra un mensaje claro, desmarca las
  confirmaciones y refresca la disponibilidad; ante 5xx muestra un mensaje de
  error del servidor y conserva la Idempotency-Key para reintentar sin duplicar;
  guarda por `useRef` contra doble envío.
- Servidor: sin cambios de lógica; el 500 sigue registrándose de forma segura
  (`safeErrorForLog` + log de Prisma) porque un rechazo del trigger tras las
  validaciones del servicio es una violación de invariante, no un conflicto de
  negocio esperable.

## Pruebas agregadas

- Integración (PostgreSQL efímero, `f10-b2-1-turnos.integration.test.ts`):
  - regresión: negocio + Caja principal, empleado 1 abre/cierra con $4.000,
    entrega $2.500 / remanente $1.500, empleado 2 consulta el fondo (endpoint
    operativo), se instala la función que TESTING tiene aplicada → 500 sin turno
    ni traspaso; se aplica el archivo correctivo real → misma clave → 201,
    fondo inicial 1500.00, traspaso vinculado a turno origen, entrega y destino,
    replay 200, fondo ya no ofrecido, tercer empleado 409, sin datos privados
    para el empleado, cierre/entrega/ledger/ventas intactos, rectificación
    posterior 409; verifica `pg_get_functiondef` con la exclusión del destino.
  - el mismo empleado que cerró puede recibir el remanente.
  - Ya existentes y vigentes: replay idempotente, dos receptores concurrentes,
    negocio distinto, caja distinta, rectificación posterior, apertura manual.
- UI (`operational-shift-panel.test.tsx`): éxito inmediato + doble clic → 1
  request; 409 fondo ya recibido → mensaje y disponibilidad refrescada; 500 →
  mensaje y reintento con la misma clave.

## Resultados

Ver `CODEX_REPORT.md` (bloque F10-B2.2-F fix) para CI, deployment y migración.
