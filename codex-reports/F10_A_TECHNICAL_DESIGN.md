# F10-A — Auditoría técnica y diseño: Operaciones, Caja por turnos y control financiero

Fecha: 2026-10-09 · Base auditada: `testing-codex` @ `f984b4c12d0da9c425616ee46e6c6e3dc9e082c1` · Modo: READ-ONLY (sin código, datos ni entornos modificados durante la auditoría).
Estado: **F10-A COMPLETED**. Este documento registra la auditoría y el diseño aprobado; NO describe funcionalidades implementadas salvo donde se indica.

Convenciones de este documento:
- **[EXISTENTE]** = verificado en el código de la base auditada.
- **[PROPUESTO]** = diseño técnico, todavía no implementado.
- **[APROBADO]** = decisión del operador.
- **[PENDIENTE]** = implementación o decisión todavía no realizada.

---

## 1. Arquitectura actual de Caja [EXISTENTE]

- **Endpoint oficial:** `POST /api/negocio/caja/ventas` (`src/app/api/negocio/caja/ventas/route.ts`). Sólo acepta la sesión del negocio (`user.type === "negocio"`); el `negocioId` sale de la sesión.
- **Precios y total:** autoridad del servidor (`computeSaleFromAuthoritativeProducts` en `src/lib/caja-venta.ts`). El cliente sólo envía productoId, varianteId y cantidad.
- **Escritura:** una transacción Serializable vía `runStockSerializable` (reintento acotado ante P2034). Dentro:
  - plan de stock agregado por clave contra el disponible R3A (`planificarStockVentaCaja`);
  - `Venta` + `VentaItem` como snapshot;
  - descuento y `MovimientoInventario` tipo VENTA (`registrarStockVentaCaja`).
- **`Venta`:** negocioId, total, `metodoPago` **único** (EFECTIVO | TRANSFERENCIA | OTRO), cantidadItems, createdAt. **No** guarda empleado, turno, remitente ni pagos mixtos.
- **Lectura:** `GET /api/negocio/caja/ventas` devuelve `ventasHoy` y `resumenHoy` (totales por método; día calendario UTC del servidor, no `Negocio.timezone`). Es el único consumidor de `Venta` en la API.
- **Idempotencia:** **no existe** en el checkout. El único freno es el botón deshabilitado mientras la mutación está pendiente (sólo en el cliente). Un reintento tras un corte o una respuesta tardía puede duplicar una venta.
- **Cliente:** `VenderView` en `src/components/business/caja-tab.tsx`; carrito en estado local del componente (se pierde al recargar); lector F9 integrado (F9 CLOSED_TESTING_CERTIFIED).

## 2. Arquitectura actual de Operaciones y autenticación de empleados [EXISTENTE]

- **Identidad personal:** `CuentaOperativa` (email/contraseña o Google) + `Empleado` por negocio (`@@unique([negocioId, cuentaOperativaId])`). Sesión operativa en `Sesion` (userType operativo), duración `SESSION_DURATION_HOURS = 12` (`src/lib/auth.ts`).
- **Autoridad real del empleado:** `Empleado.areaOperativa` ∈ `sin_asignar | mozo | salon | pyr` (`src/lib/area-operativa.ts`). El resolver `resolveOperativoAreaForSlug` (`src/lib/operativo-mozo.ts`) exige sesión operativa válida, negocio aprobado, no suspendido y con `empleadosActivos`, un `Empleado` activo de ese negocio y el área esperada.
- **Gate de Salón:** `areaOperativaRequiereSalon(area)` devuelve true para toda área salvo `pyr`. Una nueva área heredaría el gate de Salón si no se excluye explícitamente.
- **Terminales compartidas:** `TerminalOperativa` con áreas `salon | pyr` y scopes (deny-by-default), vinculación por código y sesión propia (`src/lib/operaciones-terminal-access.ts`). Una terminal no identifica a una persona.
- **PWA personal:** `/operaciones/mi-panel/[slug]` con subrutas `mozo`, `pyr`, `salon`, `pedido`.
- **Sistema antiguo de roles:** `Empleado.rol` (texto, default "mozo") y `Empleado.permisos` (JSON). El preset con rol `cajero` y permiso `gestion_caja` vive en `src/lib/empleado-permissions.ts`, que **no importa ningún archivo**: es código muerto. Ninguna ruta lee `permisos`; `rol` ya no participa de la autorización de área.
- **`CuentaOperativa` no es una cuenta financiera:** es la identidad del empleado.

## 3. Inventario y R3A [EXISTENTE]

- **Movimientos manuales:** `POST /api/negocio/inventario/movimientos` (sólo sesión del negocio) aplica ENTRADA/SALIDA/AJUSTE **inmediatamente**, vía `planificarMovimientoManual` / `registrarMovimientoManual` dentro de `runStockSerializable`. No hay recepciones pendientes.
- **Autoridad de stock:** `src/lib/stock-lifecycle.ts`. Disponible = físico − reservas ACTIVA. Reservas R3A en modo ON en TESTING (R3A CLOSED_TESTING_CERTIFIED_WITH_DOCUMENTED_LIMITATIONS).
- **Contrato de llamadores:** `p2-t56-r3a-i2-wiring-static-contract.test.ts` mantiene una **lista exacta** de llamadores de `runStockSerializable` y verifica literalmente la secuencia plan → venta → registro de Caja.

## 4. Infraestructura reutilizable [EXISTENTE]

- **Idempotencia de pedidos** (Seguridad-5C, `src/app/api/pedidos/route.ts`): cabecera `Idempotency-Key` (UUID), huella canónica del contenido, `@@unique([negocioId, idempotencyKey])` en `Pedido`, replay exacto (200), conflicto de contenido (409), recuperación ante P2002 en carreras.
- **Auditoría:** `AuditLog` (usuario, tipo, acción, recurso, detalle JSON).
- **Almacenamiento privado:** `src/lib/private-evidence-storage.ts` (Cloudinary privado con descarga firmada), útil para comprobantes futuros.
- **Mercado Pago:** sólo `codex-reports/PAYMENTS_MERCADOPAGO_DESIGN.md` (DESIGN_RESEARCH_NOT_IMPLEMENTED, pagos online de pedidos). **No hay integración en ejecución**: DeliGO no conoce ningún saldo real.

## 5. Carencias identificadas [PENDIENTE al momento de la auditoría]

1. Ventas sin actor (empleado/dueño) ni turno.
2. Checkout sin idempotencia.
3. Un único `metodoPago` por venta (impide pagos mixtos).
4. Sin cajas físicas, turnos, cierre ni fondo.
5. Sin cuentas ni movimientos financieros.
6. Sin recepciones pendientes de aprobación (las entradas de stock son inmediatas).
7. Sin área de caja para empleados.
8. Resumen de Caja por día UTC (no por turno ni zona horaria del negocio).

## 6. Riesgos del cierre ciego [PROPUESTO como controles]

- `resumenHoy` revela totales en efectivo: el cajero **nunca** debe acceder a esa ruta.
- Toda ruta del cajero debe omitir efectivo esperado, diferencia y totales por medio de pago; verificarlo con contratos estáticos.
- Riesgo residual documentado: si el cajero ve el detalle de sus ventas en efectivo, puede sumarlas a mano. El cierre ciego evita el anclaje a un número visible, no a un cálculo manual deliberado.

## 7. Arquitectura propuesta F10-B0 → F10-E [PROPUESTO]

| Etapa | Contenido | Estado |
|---|---|---|
| **F10-B0 — Bases** | Servicio único de venta; idempotencia del checkout; actor de la venta; `CobroVenta` (1 por venta, preparado para varios); libro financiero mínimo para cobros en efectivo. | Autorizado 2026-10-09 (ver `F10_B0_IMPLEMENTATION.md`) |
| **F10-B1 — Acceso del cajero** | Área `caja` (genéricos, sin gate de Salón); ruta de venta del cajero con idempotencia obligatoria; vista móvil `/operaciones/mi-panel/[slug]/caja`. | NOT_STARTED |
| **F10-B2 — Turnos** | `CajaFisica` (una por defecto), `TurnoCaja` (un turno activo por caja), apertura, cierre ciego en dos fases (cerrando → cerrado) con CAS e idempotencia, entrega y fondo para el siguiente turno, revisión del dueño, `Venta.turnoId` con FK. | NOT_STARTED |
| **F10-C1 — Salidas de efectivo** | Salidas inmediatas sin aprobación previa, revisión posterior (Sin revisar / Revisado / Observado sin re-descontar). | NOT_STARTED |
| **F10-C2 — Recepciones** | Recepción PENDIENTE + ítems; aprobación atómica e idempotente vía `registrarMovimientoManual` (requiere sumar el llamador al contrato R3A). | NOT_STARTED |
| **F10-D — Cuentas y conciliación** | Cuentas (Efectivo, resguardo del dueño, Mercado Pago, otras); remitente y estados de conciliación en el cobro; movimientos del dueño; ajustes auditados. | NOT_STARTED |
| **F10-E — Cambios y transferencias** | Cambios efectivo↔transferencia (suma cero, sin venta), transferencias internas, comisión aparte. | NOT_STARTED |

**Libro financiero [PROPUESTO, base APROBADA]:**
- `CuentaFinanciera` (por negocio);
- `OperacionFinanciera` (cabecera: tipo, actor, idempotencia, referencia de origen, reversión);
- `MovimientoFinanciero` (patas con importe con signo por cuenta).

Reglas del libro:
- Las operaciones internas y los cambios suman cero entre cuentas propias y no generan ingreso ni gasto.
- Las correcciones son operaciones compensatorias; los importes nunca se editan.
- Saldos distinguidos: calculado, declarado, conciliado. Nunca el "saldo real" del proveedor sin integración.

## 8. Decisiones del operador

**[APROBADO] 2026-10-09:**
- **D5 — Permisos del cajero:** nueva área operativa `caja` integrada a `areaOperativa`; exclusiva de negocios genéricos; sin exigir Salón; no revivir `Empleado.rol`/`permisos`. Implementación en F10-B1.
- **D6 — Cajas físicas y turnos:** varias cajas por negocio, una inicial por defecto, como máximo un turno activo por caja. El dueño también usa la Caja; se registra quién hizo cada venta. Las operaciones del dueño sobre una caja usada por un cajero quedan identificadas, sin mezclar fondos. Implementación en F10-B2.
- **D7 — Pagos mixtos:** estructura de varios cobros por venta; la interfaz sigue con un medio por venta; `Venta.metodoPago` se conserva durante la transición; sin cobros duplicados.
- **D9 — Sólo en línea:** sin operaciones monetarias offline. Ante un corte se informa al usuario, se conserva el carrito y la identidad del intento de cobro, y se permite reintentar de forma idempotente. Sin colas locales ni sincronización offline.
- **Principio — identidad del dueño en Caja:** las ventas del dueño también registran autoría, derivada de la sesión real; sin exigirle turno mientras los turnos no existan.
- **Principio — Mercado Pago declarado vs acreditado:** un cobro por transferencia declarado no es dinero verificado. Estados futuros: declarado · verificado/acreditado · observado · diferencia de conciliación. Sin APIs financieras ni saldos reales inventados.

**[PENDIENTE] (no resolver en B0):**
- **#1** Permiso del cajero para cambios con Mercado Pago.
- **#2** Obligatoriedad del nombre del remitente.
- **#3** Estados y transiciones finales de conciliación.
- **#4** Política ante transferencias no acreditadas.
- **#8** Alertas por montos elevados.
- **#10** Proveedores y cuentas por pagar (F10 vs F5).
- **#11** Saldo inicial y conciliación manual / integración futura de Mercado Pago.
- **#12** Comprobantes y retención.
- **#14** Tarifas comerciales.

## 9. Riesgos y dependencias

- **Multi-tenant:** filtrar siempre por el negocio de la sesión (nunca por slug ni body). Sin claves foráneas compuestas, la pertenencia de turno, caja, empleado y cuenta se valida en el servicio y con pruebas.
- **Concurrencia:** aperturas simultáneas, cierres simultáneos, doble aprobación, contención Serializable (follow-up R3A conocido).
- **Contabilidad:** doble conteo entre turno y cuentas (mitigado con un único libro), fondos trasladados entre turnos, movimientos del dueño en turnos de empleados.
- **Sesión de 12 h** frente a turnos largos (el turno vive en el servidor).
- **Contrato R3A:** cualquier nuevo llamador de `runStockSerializable` (ruta del cajero, aprobación de recepciones) exige actualizar la lista exacta del contrato con autorización.
- **Dinero en `Float`:** columnas existentes en Float; se mantiene por consistencia, con redondeo a centavos; una migración a Decimal queda fuera de alcance.
