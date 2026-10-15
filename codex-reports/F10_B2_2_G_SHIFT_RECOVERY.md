# F10-B2.2-G — Recuperación administrativa de turnos abandonados (2026-10-16, Claude Code)

## Objetivo

Cuando un empleado deja un turno abierto y no puede cerrarlo, el dueño lo
recupera: registra el efectivo contado físicamente y el motivo, cierra el
turno de forma transaccional y libera la caja física, sin perder ventas ni
atribuir al empleado una declaración que no hizo.

## Diseño

- **Mismo motor de cierre que C.** `cerrarTurnoCaja` y la nueva
  `recuperarTurnoCaja` comparten `cerrarTurnoCore` (`src/lib/caja-turnos-service.ts`):
  bloqueo `FOR UPDATE` de la caja, incremento real de `turnoLockRevision`,
  transacción Serializable con reintentos acotados (P2034 / P2010+40001),
  snapshot exacto del efectivo esperado (`calcularSnapshotEfectivoTurno`) y
  `updateMany` condicionado a `estado = ABIERTO`. Una venta concurrente o
  confirma antes (y entra en el esperado) o se reintenta contra el turno
  cerrado (409 / sin turno en modo OPCIONAL); nunca queda atribuida después.
- **Estado terminal sin cambios** (`CERRADO_DECLARADO`), por lo que D
  (revisión), E (entrega/remanente) y F (traspaso) funcionan igual sobre un
  turno recuperado. Lo que cambia es quién cerró:
  - `cierreOrigen`: `RESPONSABLE` | `RECUPERACION_ADMINISTRATIVA`
  - `cierreActorTipo` / `cierreActorId`: actor real (dueño = `negocioId`)
  - `cierreMotivo`: obligatorio en recuperación, NULL en cierre normal
  - El responsable original (`responsableTipo/Id`, `empleadoId`) no se toca.
- **Migración aditiva** `20261016120000_f10_b2_2_g_shift_recovery`: columnas
  nuevas; backfill de todos los cierres históricos como `RESPONSABLE` (el
  servicio C sólo permitía cerrar al responsable); CHECK de coherencia
  (abierto ⇒ sin datos de cierre; RESPONSABLE ⇒ actor = responsable, sin
  motivo; RECUPERACION ⇒ responsable EMPLEADO, actor NEGOCIO = negocioId,
  motivo 1–500); trigger que vuelve inmutables esos campos una vez cerrado y,
  durante un despliegue progresivo, completa como RESPONSABLE un cierre hecho
  por un proceso anterior. No se editó ninguna migración aplicada.
- **Endpoint** `POST /api/negocio/caja/turnos/[id]/recuperacion` — sólo sesión
  del dueño (`requireNegocioCajaGenerico`, prefijo con protección de origen);
  negocio y actor derivados de la sesión; body: `efectivoContado`, `motivo`,
  `confirmo: true`, `cajaFisicaId` esperado; `Idempotency-Key` obligatoria.
  Replay idéntico → 200 con el resultado original; misma clave con otros datos
  → 409 `IDEMPOTENCY_KEY_REUSED`; turno ya cerrado → 409 `TURNO_NO_ABIERTO`;
  caja distinta → 409 `CAJA_NO_COINCIDE`; turno propio del dueño → 409
  `TURNO_PROPIO_DEL_DUENO` (se cierra con el cierre normal); otro negocio →
  404. Auditoría `turno_caja.recuperado_administrativamente` (una por
  recuperación). No crea venta, operación ni movimiento financiero, ni abre el
  turno siguiente, ni crea traspaso.
- **Conteo explícito**: el importe se valida como el fondo (NUMERIC(12,2), sin
  negativos, ≤ 2 decimales); vacío o ausente → 400. Nunca se completa con el
  esperado ni con cero.

## Interfaz

- Dueño (`owner-caja-turnos.tsx` + `owner-caja-recuperacion.tsx`): cada caja
  con turno abierto de empleado muestra responsable, apertura, fondo inicial,
  tiempo transcurrido y actividad real (cantidad de ventas y hora de la
  última; si no hay, «Sin ventas registradas»). «Recuperar turno» abre el
  formulario con advertencia de que el empleado podría seguir operando,
  efectivo contado, motivo obligatorio y confirmación. Éxito → aviso «Turno
  recuperado correctamente», formulario cerrado, cajas e historial
  refrescados. Error → formulario abierto con los datos, mensaje claro y
  reintento con la misma clave (5xx/red). Guarda contra doble envío.
- Historial D (`owner-caja-revisiones.tsx`): insignia «Cerrado por
  recuperación administrativa», «Responsable original», «Cierre realizado por:
  Dueño (recuperación administrativa)», motivo, «Contado por el dueño».
- Empleado (`operational-shift-panel.tsx`): ve que su último turno fue cerrado
  por el responsable del negocio, sin importes ni motivo; si intenta cerrar un
  turno ya recuperado, 409 → mensaje y refresco del estado.

## Pruebas

- Integración (PostgreSQL efímero, `f10-b2-1-turnos.integration.test.ts`,
  bloque F10-B2.2-G): flujo completo fondo $5.000 + ventas $20.000 → recuperación
  con $24.000 → esperado $25.000, diferencia −$1.000, actor dueño, responsable
  empleado A, inmutabilidad, auditoría única, sin movimientos nuevos; empleado
  sin turno ni datos privados, cierre tardío 409, venta tardía no atribuida;
  historial D tras recarga, revisión D; caja libre; E $20.000/$4.000; F con
  empleado B y fondo $4.000 vinculado. Validaciones (motivo, confirmación,
  importes inválidos, clave, caja), empleado en el endpoint, otro negocio,
  replay, clave reutilizada, turno ya cerrado, dos recuperaciones concurrentes,
  ráfaga con la misma clave, venta concurrente (3 rondas), turno propio del
  dueño, y cierre normal registrado como RESPONSABLE.
- Interfaz: `owner-caja-recuperacion.test.tsx` (5) y
  `operational-shift-panel.test.tsx` (+1).

## Fuera de alcance (sin cambios)

F10-B2.2-H, modo OBLIGATORIO, controles temporales de habilitación, cierres
automáticos por tiempo, «Pendiente de vinculación».

## Resultados

- Commit `abeddee` en `testing-codex`.
- CI run 38790999199: success (validate, generate, migrate deploy en PostgreSQL efímero, pruebas de caja incl. G y regresiones C/D/E/F, build). Conteos exactos no capturados (el log del job requiere autenticación).
- Railway TESTING `DeliGO Copy` deployment `e201cb44-97d1-4b7d-a54f-98cb40e1e4b9` SUCCESS, commit coincide; migración `20261016120000_f10_b2_2_g_shift_recovery` aplicada (47 migraciones).
- Production y `main` sin cambios. Pendiente: prueba manual del operador.
