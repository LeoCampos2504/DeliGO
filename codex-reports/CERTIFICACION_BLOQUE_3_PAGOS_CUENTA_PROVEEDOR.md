# Certificación manual — Bloque 3: Pagos, anticipos, deudas y cuenta corriente de proveedores · CERTIFICADO

Fecha: 2026-11-25 · Estado: **CERTIFICADO EN RAILWAY TESTING** (ejecución `M11251859`; ZIP definitivo APROBADO auditado de
forma independiente por ChatGPT el 2026-11-26; ver §9). Historial de la preparación y la conciliación en §1–§8.
Reemplaza a `CERTIFICACION_BLOQUE_3_PAGOS_CUENTA_PROVEEDOR_PROPUESTA.md` (queda como antecedente).
Entorno: Railway TESTING (`testing-codex` = `327d6c73`), negocio QA `paola-vinal`. Production intacta. Sin commits, push,
migraciones ni despliegues. Sin pruebas funcionales locales ni de Claude. Sin dinero real (fondos y transferencias QA ficticios).

## 1. Decisiones del operador aplicadas

1. Anticipo en efectivo del cajero **incluido** (E6, obligatorio).
2. Turno del dueño en «Caja principal» **completamente intacto** (sólo se lee).
3. Efectivo **sólo** en la caja QA «QA Caja A e31b» (ya existente; no se crean cajas).
4. Se reutiliza la obligación de Alfa de **$ 6.231,50** del Bloque 2.
5. Pagos de **$ 2.000** (parcial) y **$ 5.000** (cancelación).
6. Se certifica tal como está `PEDIDO_CON_DEUDA_APROBADA` (revisión futura en el ROADMAP).
7. Fuera: devoluciones, reintegros, vencimientos y uso del saldo a favor general.

## 2. Importes, medios y efectos esperados

Impuestos: configuración `SIN_FILA` → `IMPUESTOS_INTEGRAN_COSTO` (comportamiento vigente; la preparación lo comprueba).

| Escenario | Medio | Importe | ¿Mueve Caja? | Efecto esperado |
|---|---|---|---|---|
| E1 | — | — | No | Alfa: una obligación vigente de 6.231,50 sin pagos |
| E2 | Transferencia realizada («Pagar deudas seleccionadas») | 2.000 | **No** (pago externo) | Un crédito confirmado; asignación 2.000; pendiente 4.231,50 |
| E3 | Sin dinero: desafectar (con motivo) y volver a asignar | 2.000 | No | Pendiente 6.231,50 → 4.231,50; historial asignación → desafectación → asignación |
| E4 | Transferencia realizada | 5.000 | **No** | Asigna 4.231,50; obligación pagada; total pagado 7.000; **768,50 a favor** |
| E5 | Pedido nuevo (Producto Stock × 4 a 500) + transferencia realizada ligada al pedido + programada que no se hace | 1.000 + 1.000 | **No** | Recepción de 2 u. → obligación 1.210 (1.000 + IVA 210); aplica 1.000 del anticipo; saldo 210; programada nunca cuenta; 768,50 a favor intactos; stock 4 → 6; último costo 605 |
| E6 | **Efectivo de la caja QA** (cajero con permiso; turno QA con fondo 2.000) — pedido nuevo (Producto Stock × 2 a 500) | 1.000 | **Sí** (único) | Una salida `PAGO_PROVEEDOR` de 1.000; una operación y un movimiento financieros; crédito `PAGO_CAJA` ligado al pedido (disponible 1.000); cierre esperado = contado = 1.000 |
| E7 | Rechazos sin dinero | 1.200 / 600 / 100 / 100 | No | Límite por operación (1.000), límite diario (1.500), sin permiso tras revocar, `PEDIDO_CON_DEUDA_APROBADA`; avisos de pago parecido en E5 y E6 con confirmación humana; doble clic sin duplicar |

Estado final de Alfa (identidad F5): pendiente **210**; anticipos disponibles **1.768,50** (768,50 general + 1.000 del pedido E6);
deuda exigible = 7.441,50 − 9.000 = **−1.558,50** (= 210 − 1.768,50). Beta sin cambios.

## 3. Procedimiento seguro: caja QA y permisos

- **Caja QA:** el cajero abre su turno en «QA Caja A e31b» con «Fondo inicial declarado» 2.000 (sin recibir fondo de un
  turno anterior). La apertura sólo crea el turno (no hay movimiento de dinero por el fondo). Tras el anticipo, el
  esperado es 2.000 − 1.000 = 1.000; el cajero cierra con «Efectivo contado» 1.000 (cierre ciego del responsable).
- **Permisos:** originales = sin permiso de anticipos y sin límites (comprobado en la línea base). El dueño habilita sólo
  «Anticipos en efectivo a proveedores» del cajero con 1.000 por operación y 1.500 por día, justo antes de E6, y en E7 lo
  deja exactamente como estaba (desmarcar «Habilitado» y borrar ambos límites). Dos cambios auditados.
- **Caja principal:** no se usa; el verificador exige la misma fila del turno del dueño (incluida su fecha de actualización)
  y ningún egreso u operación en él.

## 4. Herramientas (`%USERPROFILE%\deligo-dev-db\certificacion\b3-manual\`, adaptadas de `b2-manual`)

| Archivo | Qué hace |
|---|---|
| `b3-manual.sql` | SOLO LECTURA, SHA-256 `996f328408055daed165861c138c0c1f74453245a1a51374cde6bb7770179f29`: obligaciones con asignado/pendiente, créditos con asignado, asignaciones y operaciones, eventos de cuenta, pedidos, recepciones, eventos, stock, costos, precios, cajas, turnos con fondos y cierres, cuenta de efectivo de la caja QA, egresos, operaciones y movimientos financieros del intervalo, otros registros de dinero, auditoría, permisos y límites del cajero, configuración |
| `testing-b3-manual.ps1` | Ejecutor de solo lectura (mismas protecciones del B2; ids fijos; caja QA por nombre; turno del dueño sólo lectura) |
| `b3-manual-preparar.ps1` | Despliegue → línea base → **precondiciones** → instrucciones. No abre navegador ni crea datos |
| `esperado.mjs` | Importes exactos del §2 |
| `instrucciones.mjs` | Comprueba precondiciones (código 3 si fallan) y genera `INSTRUCCIONES-OPERADOR.md` + plantilla E1–E7 |
| `comparar.mjs` | BASE, E1–E7, CUENTA (identidad F5), DINERO, GENERAL, DESPLIEGUE, LOGS, OPERADOR: identidad y cantidad de cada pago, asignación, salida y operación; relaciones (pago→pedido, pago→salida, asignación→obligación, desafectación→asignación); duplicados; rechazos HTTP esperados por ruta, método, código y momento |
| `b3-manual-verificar.ps1` | SQL final, despliegue, logs, comparación, revisión de credenciales y ZIP `B3-MANUAL-<etiqueta>-<marca>-<ESTADO>.zip` |

Control técnico hecho: SQL de solo lectura contra el esquema local sin errores; `.ps1` sin errores de análisis; `.mjs` con
`node --check`; comparador con datos sintéticos: el caso esperado da APROBADO y un pago duplicado + permisos sin restaurar
dan FALLIDO. Nada ejecutado en TESTING.

## 5. Comandos del operador

```powershell
powershell -ExecutionPolicy Bypass -File "%USERPROFILE%\deligo-dev-db\certificacion\b3-manual\b3-manual-preparar.ps1"
```

Después de las pruebas, de completar `observaciones-operador.md` y de **cerrar las ventanas de prueba**:

```powershell
powershell -ExecutionPolicy Bypass -File "%USERPROFILE%\deligo-dev-db\certificacion\b3-manual\b3-manual-verificar.ps1"
```

## 6. Limitaciones y diferencias con lo pedido (sin cambiar comportamiento)

1. **Vigencia del permiso:** el permiso de anticipos tiene límites por operación y por día, pero **no** fecha de
   vencimiento en el modelo actual. La vigencia es de procedimiento: se habilita justo antes de E6 y se revoca en E7; el
   verificador exige los dos cambios auditados y la restauración exacta.
2. **Avisos de pago parecido ≠ idempotencia:** el aviso compara importes y fechas (transferencias: mismo día; Caja contra
   transferencias: ±3 días) y exige confirmación humana; la idempotencia (misma clave en reintentos y doble clic) es la que
   impide duplicar una misma operación. El bloque prueba ambos sin dinero extra (los avisos se disparan antes de escribir).
3. **Supervisión de egresos:** la salida del cajero queda «sin revisar» en el panel de Egresos del dueño. No se revisa en
   este bloque para no agregar escrituras; queda como dato esperado.
4. **Cuenta de efectivo de la caja QA:** si no existiera, la primera salida la crea (comportamiento vigente); la línea
   base la registra.
5. **Estado que queda para bloques futuros:** pedido E5 abierto (2 u. pendientes, factura con saldo 210) y pedido E6
   abierto con anticipo de 1.000 disponible; 768,50 a favor general. Stock del Producto Stock: 6.
6. La restricción `PEDIDO_CON_DEUDA_APROBADA` se certifica tal como está; su revisión futura sigue en el ROADMAP.

## 7. Ejecución `M11251859` — pruebas manuales del operador

Inicio 2026-11-25T19:00:23Z (TESTING `327d6c73`, despliegue `8ac0f58f`). Resultado manual: **29/29 OK** (E1 2/2 · E2 3/3 ·
E3 3/3 · E4 3/3 · E5 7/7 · E6 6/6 · E7 5/5), sin fallos funcionales. `observaciones-operador.md` completado con E1–E7 = OK;
línea base original sin cambios. Observaciones de UX y el texto financiero E4.1 (prioritario antes de Production) quedan
en el ROADMAP sin implementar. Corrección para instrucciones futuras (E2.1): «Pagar deudas seleccionadas» aparece después de
abrir el pedido y seleccionar la deuda. Verificación interna: pendiente (`b3-manual-verificar.ps1`, ventanas cerradas).

## 8. Primera verificación `INCOMPLETO` y conciliación de dos consultas de sesión (2026-11-25)

- **ZIP original (se conserva intacto):** `B3-MANUAL-M11251859-20261125T194110Z-INCOMPLETO.zip`, SHA-256
  `60044a86b8364cdf370b5585a675c216280a1a008f3ff978bbc455f789b4ee63`. Línea base intacta (SHA-256 `b91256e5…a5fc0`).
  Resultado: operador 29/29; 13/14 controles internos aprobados; sólo LOGS inconclusa. Auditoría de ChatGPT: sin fallos
  funcionales en los registros financieros y comerciales.
- **Incidencia:** dos HTTP 401 `GET /api/operativo/me`, a las 19:21:00.964829809Z (durante E5) y a las 19:41:02.625311457Z
  (después de todas las pruebas).
- **Comportamiento revisado en el código (`327d6c73`, sin cambios):**
  - `GET /api/operativo/me` es la consulta de lectura del estado de sesión operativa.
  - Responde 401 «sin_sesion» si falta la cookie, si la sesión no existe o venció, o si la cuenta no está activa.
  - `/operaciones/ingresar` la llama al cargar; un 401 sólo muestra el formulario.
  - También la llaman `/mozo`, `/operaciones/cuenta` y `/operaciones/terminal`.
  - El cierre de sesión elimina la sesión, así que la consulta siguiente responde 401.
  - `/api/push/subscribe` y `/api/push/unsubscribe` responden 401 sin sesión. Sólo quedan como advertencias WARN: no son errores ni rechazos relacionados.
- **Comprobado con la evidencia:**
  - Ambos registros figuran exactamente en los logs.
  - Ninguna ruta protegida respondió 401 en el intervalo.
  - Registro 1:
    - No hay acciones del cajero antes.
    - 34 s después, el cajero QA identificado creó y envió la recepción E5 (auditoría de empleado, 19:21:34).
    - El dueño siguió operando después (aprobación a las 19:23:23).
  - Registro 2:
    - Es posterior a la última escritura auditada (cierre del turno QA, 19:33:16) y no hay escrituras después.
    - Las advertencias de push son posteriores a él (19:41:04 y 19:41:05).
- **Declaración del operador:** cerró sesión antes de cerrar las ventanas; no puede confirmar la causa del registro 1; no
  observó fallos de autenticación que impidieran completar los escenarios.
- **Hipótesis compatible, no comprobada:**
  - Registro 1: carga de la pantalla de ingreso sin una sesión válida, justo antes de iniciar sesión para E5. No se distingue entre cookie ausente y sesión anterior vencida.
  - Registro 2: consulta posterior al cierre de sesión declarado.
- **Limitación de atribución:**
  - Los logs HTTP de la verificación sólo conservan respuestas ≥ 400, sin actor, sesión ni navegador.
  - No permiten atribuir la solicitud a una ventana ni ver el inicio o el cierre de sesión.
  - No se afirma que hubo vencimiento ni que el registro 1 provenga del cajero.
- **Conciliación:**
  - Se reutiliza el mecanismo del Bloque 2: `preparacion/conciliacion-logs.json` y el bloque `CONCILIACION` de `comparar.mjs`, que genera `CONCILIACION-LOGS.md`.
  - Se toleran sólo esos dos registros, por fecha, método, ruta y código, y únicamente si se cumplen todos los controles: ruta `/api/operativo/me`, presencia exacta, ningún otro 401 relacionado, y la relación de cada registro con las pruebas (siguiente acción del cajero ≤ 60 s, o posterior a la última escritura).
  - Control técnico sobre una copia con la evidencia original: APROBADO. Con un 401 inyectado en una ruta protegida: FALLIDO, sin tolerar nada.
  - Nunca se ignoran en general los 401, ni siquiera los de `/api/operativo/me`. No se recortó el intervalo y no se quitó ningún control.
- **Recomendación operativa:** cerrar directamente las ventanas de prueba antes del verificador, sin cerrar sesión antes.
- **Siguiente paso:** el operador vuelve a ejecutar `b3-manual-verificar.ps1`, con las ventanas cerradas y sin abrir DeliGO, para obtener el ZIP definitivo.

## 9. Verificación definitiva `APROBADO` y cierre del Bloque 3 (2026-11-26)

- **ZIP definitivo:** `B3-MANUAL-M11251859-20261126T012159Z-APROBADO.zip` · SHA-256
  `cc68cf21b7fe8f6167585250ff4691cf77e8c12eb02a610e5eb1ddec9daea6c3` · 39.401 bytes · 17 archivos (hash y cantidad
  comprobados de nuevo, solo lectura, al registrar este cierre).
- **ZIP original conservado:** `B3-MANUAL-M11251859-20261125T194110Z-INCOMPLETO.zip` · SHA-256
  `60044a86b8364cdf370b5585a675c216280a1a008f3ff978bbc455f789b4ee63` · 26.735 bytes. Línea base y evidencias SQL intactas.
- **Resultado:** 29/29 pruebas manuales · 15/15 controles internos APROBADOS (incluida la `CONCILIACION` de los dos 401).
- **Auditoría independiente de ChatGPT — CERTIFICADO.** Comparó los registros SQL finales de las dos verificaciones incluidas en el ZIP: los registros comerciales y financieros son idénticos.
  - Cuatro pagos efectivos por $9.000: tres transferencias por $8.000 y un anticipo en efectivo por $1.000.
  - Una transferencia programada cancelada, sin efecto financiero.
  - Obligación original totalmente cancelada; nueva obligación con $210 pendientes.
  - Saldo general a favor $768,50 · anticipo reservado $1.000 · posición neta a favor del negocio $1.558,50.
  - Desafectación y reasignación correctamente vinculadas.
  - Una única salida de efectivo de la caja QA; diferencia de cierre cero.
  - Stock final 6; permisos originales restaurados; turno del dueño intacto; cero HTTP 5xx.
- **Limitación que se mantiene documentada:** la atribución de los dos HTTP 401 (§8). La auditoría de ChatGPT se hizo
  sobre los logs procesados del ZIP, no sobre los logs brutos completos de Railway.
- **Pendiente sin cambios (fuera de este bloque):** la salida de Caja QA del anticipo de E6 queda sin revisar ni compensar,
  por decisión del operador.
- **Observaciones de UX y regla comercial:** registradas en el ROADMAP sin implementar. E4.1 «a favor del proveedor» es
  prioritaria antes de Production.
- **Production:** no se tocó.
