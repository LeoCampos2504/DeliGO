# F4-B — Precios justificados en sustituciones (2026-11-04, Claude Code)

Estado: **CLOSED_TESTING_CERTIFIED (funcional, sólo TESTING)** — certificación manual del operador en Railway TESTING
(2026-11-04): **11/11 comprobaciones funcionales favorables**. Algunas verificaciones complementarias se sustentan en
CI y no se ejecutaron manualmente (ver abajo). **No es una autorización para Production.**

Historial de este estado: integrado en `testing-codex` `2bc0a93` (fast-forward desde `eb0699c`, CI 41907431414
SUCCESS); el primer build de Railway (`b17858a2`) falló por un error transitorio de `next/font/google` (Nunito) y el
único redeploy autorizado (`51e10854`) terminó SUCCESS con la migración `20261105120000` aplicada una vez.

## Certificación manual en TESTING (2026-11-04)

| | |
|---|---|
| Rama / commit | `testing-codex` · `2bc0a93e8d509ad2223a4f618808ab66886c675f` |
| Deployment | Railway TESTING `51e10854-8686-45f4-8112-81d5fe528508` (SUCCESS) |
| CI | `41907431414` (SUCCESS) |
| Migración | `20261105120000_f4_b_justified_replacement_prices` aplicada correctamente |

Comprobaciones del operador (todas favorables):

1. Rechazo de producto con precio diferente.
2. Aceptación de producto nuevo con precio de catálogo coincidente.
3. Persistencia del precio original después de modificar el catálogo.
4. Devolución por el importe realmente cobrado, con actualización de inventario.
5. Reemplazo por otro producto incluido en la venta.
6. Visualización de correcciones anteriores con advertencia de precio heredado.
7. Corrección de una venta de turno cerrado sin alterar sus importes.
8. Rechazo por stock insuficiente.
9. Ausencia de la opción de corrección para empleados.
10. Bloqueo de correcciones cuando ya existen devoluciones.
11. Prevención de duplicados ante doble clic, con stock final correcto.

Sustentado sólo en CI (no ejecutado manualmente): reservas de pedidos activas (producto y variante) y carreras corrección/reserva, corrección/corrección y corrección/devolución; variantes inactivas, productos eliminados o de otro negocio; igualdad exacta al centavo; traslado de evidencia sin re-fechar en la fila SQL; criterio forzado por el guard SQL y CHECK; replay con la misma Idempotency-Key tras error del servidor; aislamiento entre negocios; tope F4-A sobre la línea corregida.

**Decisión que sigue pendiente:** si F4-A debe **bloquear** las devoluciones de líneas antiguas con precio heredado
(regla anterior). Hoy sólo advierte y reintegra lo efectivamente cobrado.

## Caso que originó la tarea (certificación manual en TESTING)

2 × Saphirus cobrados a $2.000 se corrigieron a 2 × Redmi, cuyo precio comercial es $1.000. F4-B registró el Redmi a
$2.000 (precio heredado) y una devolución F4-A posterior reintegró un Redmi por $2.000. El operador revirtió la
aprobación anterior («el reemplazo hereda el precio cobrado», 2026-10-15 / 2026-11-04).

Regla del operador: nunca asignar en silencio a un producto de reemplazo un precio que no le corresponde. Se mantienen
dos invariantes: total corregido = total cobrado, y cada producto valorizado a un precio comercialmente justificable.
Los cambios comerciales reales (diferencias de dinero) y las combinaciones de productos corresponden a **F4-C** (no
iniciado).

## Causa técnica precisa

- `correcciones_venta_lineas.precio` se fuerza a `venta_items.precio` de la línea original (servicio + trigger
  `guard_correccion_venta_linea`), **sin mirar qué producto se nombra**. Cualquier producto del catálogo podía quedar
  registrado al precio cobrado de otro.
- F4-A calcula el reintegro desde el subtotal de la línea vigente (`lineaVigente`), así que heredó el precio ajeno.
- No existe historial de precios de catálogo: el PATCH de productos no deja auditoría de precio y la auditoría de
  variantes sólo lista claves cambiadas. Caja cobra el precio de lista (sin promociones ni descuentos), y
  `VentaItem.precio` es el único precio histórico confiable — sólo para los productos que figuran en esa venta.

## Decisiones del operador aplicadas

1. 2026-11-04 (primera ronda): regla por la misma venta (`MISMO_PRODUCTO`, `MISMA_VENTA`).
2. 2026-11-04 (segunda ronda): **se admiten productos que no estaban en la venta cuando su precio de catálogo ACTUAL
   coincide exactamente con el precio unitario cobrado** (`PRECIO_CATALOGO_ACTUAL`), con 8 condiciones: precio
   exacto, total idéntico, producto/variante del negocio habilitado, stock y reservas sin movimientos duplicados,
   historial con criterio + precio consultado + momento de la comprobación, no afirmar que el precio actual demuestra
   el histórico, motivo/identidad del dueño/auditoría obligatorios, devoluciones posteriores por lo cobrado.

## Regla implementada

Una línea corregida conserva el precio cobrado de su línea original y sólo puede nombrar:

| Criterio | Significado | Evidencia guardada |
|---|---|---|
| `MISMO_PRODUCTO` | el mismo producto/variante de esa línea (cambio de cantidad) | — |
| `MISMA_VENTA` | un producto/variante de **otra línea original de la misma venta** cobrado exactamente a ese precio | — |
| `PRECIO_CATALOGO_ACTUAL` | un producto/variante **de este negocio, habilitado para Caja** (producto no eliminado; variante activa; si el producto tiene variantes activas, hay que elegir una) cuyo **precio de catálogo actual es exactamente** el cobrado | `precioCatalogoConsultado`, `precioCatalogoConsultadoEn` |

Todo lo demás → **409 `PRECIO_NO_JUSTIFICADO`** (o 400 `PRODUCTO_CORRECCION_INVALIDO` si el producto no es del
negocio o no está habilitado), sin escribir nada. Igualdad exacta: $2.000,01 no es $2.000.

- **Lo que prueba y lo que no:** `PRECIO_CATALOGO_ACTUAL` registra una coincidencia comprobada **en el momento de la
  corrección**. El historial, la auditoría y la UI lo dicen así («coincidencia en ese momento, no prueba el precio al
  vender»); nunca se presenta como el precio histórico.
- **Evidencia trasladada:** si una línea ya justificada por catálogo no cambia de producto en una corrección
  posterior, conserva el precio consultado y la fecha originales (no se re-fecha ni se re-verifica contra un precio
  nuevo). Un cambio de producto en esa línea vuelve a verificarse contra el catálogo de ese momento.
- **Aplicación en tres capas:** servicio (`criterioPrecioLinea` + lectura del catálogo en la misma transacción
  Serializable), SQL (trigger `guard_correccion_venta_linea` reemplazado con `CREATE OR REPLACE`: decide el criterio,
  lee el precio de catálogo del negocio y lo guarda; un criterio enviado desde afuera se sobrescribe; un CHECK exige
  evidencia completa sólo para `PRECIO_CATALOGO_ACTUAL` y precio consultado = precio cobrado) y UI.

Ejemplos del operador:

- 1 Saphirus $2.000 → 1 producto de $2.000 (de la venta o con catálogo actual $2.000): permitido.
- 1 Saphirus $2.000 → 1 Redmi $1.000: rechazado.
- 1 Saphirus → 2 Redmi de $1.000: rechazado (combinación; F4-C).

## Cambios

- Migración aditiva `20261105120000_f4_b_justified_replacement_prices` (sólo en esta rama; **nunca aplicada a una
  base persistente**, por eso se amplió en lugar de crear otra): columnas nullable `criterioPrecio`,
  `precioCatalogoConsultado` (DOUBLE PRECISION, mismo tipo que `precio`) y `precioCatalogoConsultadoEn`
  (TIMESTAMP(3)), CHECK y `CREATE OR REPLACE` de `guard_correccion_venta_linea`. No edita migraciones aplicadas
  (`20261018120000` intacta) y no modifica filas existentes.
- `src/lib/caja-correcciones-service.ts`: criterio por línea (venta → evidencia previa → catálogo actual), lectura
  del producto acotada al negocio y habilitada para Caja; el precio actual se usa sólo para comparar y como evidencia.
- `src/lib/caja-venta-vigente.ts`: `precioHeredado` y `criterioPrecio` de la línea vigente.
- `src/lib/caja-devoluciones-service.ts`: el historial y la auditoría (`venta.corregida`) incluyen `criterioPrecio` y
  `verificacionCatalogo { precio, consultadoEn }`.
- `src/components/business/caja-devoluciones.tsx` / `caja-tab.tsx`: el formulario del dueño vuelve a leer su catálogo
  (`/api/negocio/productos`) sólo para ofrecer coincidencias exactas («(catálogo actual $X)»), con aviso explícito
  de que no demuestra el precio de la venta; si el catálogo no carga, sólo ofrece productos de la venta. El historial
  muestra el precio consultado y la fecha.
- Pruebas: `caja-correcciones.test.ts` (11), `caja-correcciones.test.tsx` (10), integración real
  `f4-b-correcciones.integration.test.ts` (10 escenarios). CI: run 41904934465 on 687b972 SUCCESS (migrate deploy incl. extended 20261105120000 on ephemeral PostgreSQL 16, Typecheck F4-B files clean, main batch incl. F4-A/F4-B real-DB suites with the catalog-criterion scenario, isolated bell and CajaTab steps, build); earlier runs 41874744637 (242eac9) and 41875315605 (4ac3ccc) SUCCESS.

## Pruebas que cubren las condiciones

- Mismo precio (venta y catálogo); más barato, más caro (incluso 1 centavo) y combinaciones rechazados.
- Variantes: activa aceptada por catálogo; inactiva, sin elegir variante o de otro precio rechazadas.
- Producto eliminado o de otro negocio rechazado; precio de catálogo cambiado después de la venta.
- Evidencia guardada (precio + momento) en fila, respuesta, replay y auditoría; evidencia trasladada sin re-fechar.
- Devolución F4-A posterior: reintegra lo cobrado ($2.000) aunque el catálogo ya diga $2.600.
- Stock y reservas (producto y variante, carreras), idempotencia y concurrencia, permisos (sólo dueño), cierres de
  turno intactos, compatibilidad con correcciones de la regla anterior, defensa SQL (criterio forzado por el guard).
- Sin promociones ni descuentos en Caja: no hay caso que probar.

## Compatibilidad con F4-A y con el historial

- Correcciones ya registradas con la regla anterior: **inmutables, no se reescriben**. Quedan con `criterioPrecio`
  NULL; la vista del dueño las marca «precio heredado (regla anterior)».
- F4-A no cambia de comportamiento: reintegra lo efectivamente cobrado en todas las líneas.
- Para volver a corregir una venta con una línea heredada, esa línea debe pasar a un producto justificado (original,
  de la venta al mismo precio o con catálogo actual idéntico); si se mantiene, 409 con mensaje explícito.

## Pendiente / límites

- Combinaciones 1→N y cambios con diferencia de dinero: F4-C (requiere rediseño de líneas y de topes F4-A).
- **PENDIENTE (decisión del operador):** ¿F4-A debe bloquear devoluciones sobre líneas heredadas de la regla
  anterior? Hoy sólo advierte.
- No hay historial de precios: la coincidencia se comprueba sólo contra el precio vigente al corregir.

## Retest en TESTING (ejecutado por el operador el 2026-11-04; ver «Certificación manual»)

Venta: 2 × Gaseosa Cola $2.000 + 1 × Gaseosa Lima $2.000 + 1 × Yerba $5.000 = $11.000. Tener en el catálogo un
producto fuera de la venta a $2.000 (p. ej. Naranja) y Redmi a $1.000.

1. Cola → Redmi ($1.000): no aparece; por API 409 `PRECIO_NO_JUSTIFICADO`.
2. Cola → Naranja: aparece como «Naranja (catálogo actual $2.000)» con el aviso; se acepta; el historial muestra
   «precio de catálogo al corregir: $2.000 (comprobado …); coincidencia en ese momento, no prueba el precio al vender».
3. Cambiar después el precio de Naranja y corregir otra línea: Naranja conserva la evidencia original.
4. Devolver 1 Naranja: reintegro $2.000 (lo cobrado), reingresa Naranja.
5. Cola → Lima (de la venta): se acepta como antes.
6. Venta corregida con la regla anterior (Saphirus → Redmi): aviso «Precio heredado…»; el formulario exige un
   producto justificado.
7. Pasos 2–9 del checklist F4-B en `F4_A_SALE_RETURNS.md`.
