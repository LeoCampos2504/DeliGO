# F4-B — Precios justificados en sustituciones (2026-11-04, Claude Code)

Estado: **IMPLEMENTADO EN RAMA TÉCNICA, SIN INTEGRAR** (`codex/f4-b-justified-prices`, base `testing-codex`
`eb0699c`). Sin deploy, sin Production, sin migraciones aplicadas a bases persistentes. **F4-B sigue sin certificar:
la certificación manual quedó PAUSADA** por el operador hasta resolver esta inconsistencia.

## Caso que originó la tarea (certificación manual en TESTING)

2 × Saphirus cobrados a $2.000 se corrigieron a 2 × Redmi, cuyo precio comercial es $1.000. F4-B registró el Redmi a
$2.000 (precio heredado) y una devolución F4-A posterior reintegró un Redmi por $2.000. El operador revirtió la
aprobación anterior («el reemplazo hereda el precio cobrado», 2026-10-15 / 2026-11-04).

Regla nueva del operador: nunca asignar en silencio a un producto de reemplazo un precio que no le corresponde.
Se mantienen dos invariantes: total corregido = total cobrado, y cada producto valorizado a un precio comercialmente
justificable. Un cambio real de productos (con diferencia de dinero) corresponde a **F4-C** (no iniciado).

## Causa técnica precisa

- `correcciones_venta_lineas.precio` se fuerza a `venta_items.precio` de la línea original (servicio + trigger
  `guard_correccion_venta_linea`), **sin mirar qué producto se nombra**. Cualquier producto del catálogo podía quedar
  registrado al precio cobrado de otro.
- F4-A calcula el reintegro desde el subtotal de la línea vigente (`lineaVigente`), así que heredó el precio ajeno.
- No existe historial de precios de catálogo: el PATCH de productos no deja auditoría de precio y la auditoría de
  variantes sólo lista claves cambiadas. Caja cobra el precio de lista (sin promociones ni descuentos), y
  `VentaItem.precio` es el único precio histórico confiable — **sólo para los productos que figuran en esa venta**.

## Regla implementada (segura con los datos existentes)

Una línea corregida conserva el precio cobrado de su línea original y sólo puede nombrar:

| Criterio | Significado |
|---|---|
| `MISMO_PRODUCTO` | el mismo producto/variante de esa línea (cambio de cantidad) |
| `MISMA_VENTA` | un producto/variante de **otra línea original de la misma venta** cobrado exactamente a ese precio |

Todo lo demás → **409 `PRECIO_NO_JUSTIFICADO`**, sin escribir nada. Ejemplos del operador:

- 1 Saphirus $2.000 → 1 producto de $2.000 **de la misma venta**: permitido (`MISMA_VENTA`).
- 1 Saphirus $2.000 → 1 Redmi $1.000: rechazado (sale de la regla y además el total cambiaría si se tomara su precio).
- 1 Saphirus → 2 Redmi de $1.000: **no implementado** (ver «Decisiones pendientes»).
- Un producto con el mismo precio de catálogo que **no** está en la venta: rechazado (precio actual ≠ precio histórico).

Aplicación en tres capas: servicio (`criterioPrecioLinea`), SQL (trigger reemplazado con `CREATE OR REPLACE`, guarda el
criterio en la fila) y UI (el selector sólo ofrece opciones justificadas; ya no carga el catálogo).

## Cambios

- Migración aditiva `20261105120000_f4_b_justified_replacement_prices`: columna nullable
  `correcciones_venta_lineas.criterioPrecio` + CHECK (`MISMO_PRODUCTO` / `MISMA_VENTA`) + `CREATE OR REPLACE` de
  `guard_correccion_venta_linea`. No edita migraciones aplicadas, no modifica filas existentes.
- `src/lib/caja-correcciones-service.ts`: `criterioPrecioLinea`, rechazo `PRECIO_NO_JUSTIFICADO` (mensaje específico
  para líneas heredadas de la regla anterior), mapeo del error SQL, criterio persistido por línea.
- `src/lib/caja-venta-vigente.ts`: `precioHeredado` (línea corregida con otro producto y criterio NULL).
- `src/lib/caja-devoluciones-service.ts`: el detalle expone `precioHeredado`, la línea `original` y `criterioPrecio`
  en el historial.
- `src/components/business/caja-devoluciones.tsx` / `caja-tab.tsx`: opciones justificadas por línea, aviso
  «precio heredado» en el detalle y en el historial; sin consulta al catálogo.
- Pruebas: `caja-correcciones.test.ts` (11), `caja-correcciones.test.tsx` (8), integración real
  `f4-b-correcciones.integration.test.ts` (9 escenarios). CI habilitado para la rama (sin paso de deploy): run 41874744637 on 242eac9 SUCCESS (migrate deploy incl. 20261105120000 on ephemeral PostgreSQL 16, Typecheck F4-B files clean, main batch incl. F4-A/F4-B real-DB suites, isolated bell and CajaTab steps, build).

## Compatibilidad con F4-A y con el historial

- Correcciones ya registradas con la regla anterior: **inmutables, no se reescriben**. Quedan con `criterioPrecio`
  NULL; la vista del dueño las marca «precio heredado (regla anterior)».
- F4-A no cambia de comportamiento: sobre esas líneas sigue reintegrando lo efectivamente cobrado (p. ej. $2.000).
  Es dinero real cobrado, por eso no se recalcula.
- Para volver a corregir una venta con una línea heredada, esa línea debe pasar a un producto justificado (p. ej.
  volver al original): si se intenta mantenerla, 409 con mensaje explícito.
- Ventas nunca corregidas y correcciones justificadas: idénticas a F4-B/F4-A aprobadas.

## Decisiones pendientes del operador (no implementadas)

1. **Productos que no estaban en la venta.** No hay precio histórico confiable. Opciones: (a) no permitirlo nunca en
   F4-B y derivarlo a F4-C *(recomendado)*; (b) admitirlo si el precio de catálogo actual coincide, con aviso y tal vez
   límite de antigüedad (riesgo: el precio pudo cambiar y volver); (c) agregar desde ahora un historial de precios
   (auditoría de PATCH de productos/variantes) y habilitarlo sólo para ventas posteriores a su activación.
2. **Combinaciones / división de líneas (1 Saphirus → 2 Redmi).** El esquema actual tiene una línea corregida por
   línea original (único `(correccionId, ventaItemId)` + verificación diferida «líneas = ítems») y F4-A limita las
   devoluciones por `ventaItemId`. Requiere rediseño (líneas hijas con precio propio, topes F4-A por línea hija) y
   un precio histórico confiable del producto nuevo → mismo problema que el punto 1. Propuesta: tratarlo en F4-C.
3. **Líneas heredadas existentes en TESTING.** ¿F4-A debe bloquear o advertir antes de devolver sobre ellas? Hoy
   sólo advierte (y reintegra lo cobrado).

## Retest recomendado en TESTING (sólo tras autorización de integración y deploy)

Venta: 2 × Gaseosa Cola $2.000 + 1 × Gaseosa Lima $2.000 + 1 × Yerba $5.000 = $11.000.

1. Corregir Cola → Redmi ($1.000): no aparece como opción; por API, 409 `PRECIO_NO_JUSTIFICADO`.
2. Corregir Cola → producto de $2.000 que no está en la venta: no aparece como opción.
3. Corregir Cola → Lima (2 u.): se acepta; total $11.000; historial «2 × Gaseosa Cola → 2 × Gaseosa Lima ($2.000 c/u,
   precio cobrado)»; stock Cola +2 / Lima −2.
4. Devolver 1 Lima de esa línea: reintegro $2.000, reingresa Lima.
5. Venta corregida con la regla anterior (p. ej. la de Saphirus → Redmi): el detalle muestra «Precio heredado…»; el
   formulario exige elegir un producto justificado para esa línea.
6. Pasos 2–9 del checklist F4-B en `F4_A_SALE_RETURNS.md` con el ejemplo nuevo.
