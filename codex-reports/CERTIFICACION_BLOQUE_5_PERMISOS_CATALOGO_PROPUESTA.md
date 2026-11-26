# Certificación — Bloque 5: permisos temporales de catálogo de los empleados — PROPUESTA

Fecha: 2026-11-26 · Estado: **REEMPLAZADA** por `CERTIFICACION_BLOQUE_5_PERMISOS_CATALOGO.md` (aprobada con ajustes por el operador; queda como antecedente).
Entorno previsto: Railway TESTING `327d6c73` (DeliGO Copy), negocio QA `paola-vinal`. Sin Production, sin dinero, sin turnos.

## 1. Fuentes revisadas

- **Código vigente (`327d6c73`):**
  - `src/lib/catalogo-empleado-service.ts`: permisos, alta, edición, listado y guardado de permisos.
  - `src/lib/catalogo-empleado-http.ts`: proveedores del producto.
  - `src/lib/importacion-productos-service.ts`: importación Excel/CSV.
  - `src/components/business/permisos-catalogo.tsx`: pantalla del dueño.
  - `src/app/operaciones/mi-panel/[slug]/productos/page.tsx` e `importar/page.tsx`: pantallas del cajero.
  - Rutas `src/app/api/operativo/caja/[slug]/catalogo/*` y `src/app/api/negocio/empleados/permisos-catalogo`.
- **Bloques certificados:**
  - Bloque 1 E6: «Asociar proveedores».
  - Bloque 4 E3/C3: «Precios de venta», más el diagnóstico del 400 de vencimiento.
  - Bloque 4 C1: restricciones de etiquetas del cajero.
- **Pruebas automatizadas existentes:** no hay una suite de permisos de catálogo. Sólo `empleado-identidad.integration.test.ts` lee la lista de permisos (identidad y aislamiento de la lista entre negocios).

## 2. Matriz de permisos vigente (sólo lo implementado; no se agregan reglas)

**Reglas comunes:**
- El dueño otorga con «Vence», un datetime-local que debe ser futuro y a menos de 366 días; si no, el servidor responde 400 sin escribir. El otorgamiento combina seis casillas independientes.
- **«Revocar ahora»** deja `catalogoHasta = null` y las seis casillas en falso.
- Ambas operaciones quedan auditadas como `empleado.permiso_catalogo` y `empleado.permiso_catalogo_revocado`, con antes y después.
- **Vigencia:** `catalogoHasta > ahora`. Se evalúa en **cada** operación y otra vez **dentro** de la transacción. Una pestaña abierta con permisos viejos es rechazada por el servidor.
- **Sin vigencia**, todas las casillas efectivas son falsas: el catálogo devuelve 200 con `vigente: false` y la pantalla muestra «No tenés un permiso vigente…».
- **Nunca** otorga stock. Si el cuerpo trae `stockCantidad`, `controlStock`, `stockMinimo` o `eliminado`, responde 403 `STOCK_NO_PERMITIDO`. Los productos que crea un empleado nacen con `controlStock=false` y `stockCantidad=0`.
- **Nunca** otorga permisos financieros, etiquetas (sólo «Etiqueta actualizada»), recepciones ni pagos.

| Casilla (pantalla del dueño) | Campo | Permite | No permite / reglas |
|---|---|---|---|
| Crear productos y variantes | `catalogoCrear` | Alta de producto y variantes (`POST …/catalogo/productos`), auditada `producto.creado` (empleado) | Sin «Precios» el producto nace **sin precio**: precio 0, no disponible online, la Caja no lo vende. Sin «Costos», el costo queda `null`. Nunca carga stock |
| Editar datos | `catalogoEditar` | Nombre, categoría, código, marca, unidad, imagen y nombre o código de variantes (`PUT …/productos/[id]`), auditada `producto.modificado`. Ver los proveedores del producto | Sin esta casilla, cambiar datos da 403 `EDITAR_SIN_PERMISO`. No toca precio, costo ni stock |
| Asociar proveedores | `catalogoProveedores` | Ver, asociar y quitar proveedores del producto, auditado `proveedor.productos_asociados`/… | Sin ella, 403 `PROVEEDORES_SIN_PERMISO`. **Certificado en el Bloque 1 E6** |
| Precios de venta | `catalogoPrecios` | Precio del producto y de sus variantes (activación CATALOGO a nombre del EMPLEADO), auditado `producto.precio_cambiado` | Sin ella, 403 `PRECIO_SIN_PERMISO`. Con una etiqueta pendiente, 409 `ETIQUETA_PENDIENTE`. **Precio del producto certificado en el Bloque 4 E3/C3** |
| Costos | `catalogoCostos` | Ver el costo en el catálogo del empleado y modificarlo, auditado en `producto.modificado` | Sin ella el costo **no se envía** al empleado (`costo: undefined`) y modificarlo da 403 `COSTO_SIN_PERMISO` |
| Importar productos (Excel/CSV) | `catalogoImportar` | Vista previa (sólo lectura) y ejecución por grupos, con clave idempotente | Crear filas nuevas exige además «Crear». Actualizar datos exige «Editar», y si falta se omiten con aviso. Las columnas de precio, costo y proveedores sin su casilla se **ignoran con aviso** («Precio ignorado: no tenés permiso de precios.»). Un existente nunca se sobrescribe sin elegir «actualizar». Nunca stock. Permisos revalidados por grupo. Sin «Importar»: 403 `IMPORTAR_SIN_PERMISO` |

**Aislamiento:**
- El cajero opera sólo el negocio de su sesión: `resolveOperativoAreaForSlug` exige un empleado activo del negocio del slug, con área caja.
- Los productos se buscan siempre con `negocioId`; un producto de otro negocio da 404.
- El permiso es por empleado: otro empleado no hereda nada.
- La lista de permisos del dueño ya tiene una prueba de aislamiento entre negocios (`empleado-identidad`).

## 3. Cobertura ya certificada (no se repite)

| Control | Evidencia |
|---|---|
| Sin permiso → pantalla «No tenés un permiso vigente…» | B4 E3.1 |
| Otorgar sólo «Asociar proveedores»; asociar y quitar; revocar; formulario abierto rechazado | B1 E6 |
| Otorgar sólo «Precios de venta»; precio cambiado a nombre del cajero; revocar; 403 posterior con el formulario abierto; restauración exacta; vencimiento futuro (400 si no) | B4 E3, C3 y la conciliación del 400 |
| El cajero sólo puede confirmar etiquetas | B4 C1 (interfaz) |
| Activaciones CATALOGO a nombre del EMPLEADO admitidas por la base (migración `20261121181000`) | B4 PRECONDICION_C3 |

## 4. Escenarios nuevos (recorrido manual compacto: dueño + cajero QA, sin dinero ni turnos)

**Datos:**
- Cajero QA «TEST_T44_R1D_CUENTA_4135EA7A» (`cmuq91zhp0008ka0ab4fqenuj`), sin permisos al empezar.
- Productos **nuevos** con el sufijo de la ejecución (`QA B5 … M<etiqueta>`). Así no se tocan los productos QA de los Bloques 1–4 (A, B, Stock).
- Un archivo CSV que genera la preparación.

**Reglas de procedimiento** (aprendidas del Bloque 4):
- Cada acción se hace en la pestaña indicada, del dueño o del cajero.
- Al vencimiento se le da margen.
- Los formularios no se recargan cuando la instrucción dice «sin recargar».

| Id | Escenario | Permisos | Qué se comprueba | Nuevo |
|---|---|---|---|---|
| E1 | Alta **sin precio** con costo y edición de datos | Crear + Editar + Costos («7 días») | El producto «QA B5 Producto Nuevo» nace sin precio (aviso «… sin precio de venta…»), con costo 400, stock 0, sin control de stock y sin activación de precio; auditoría `producto.creado` del cajero. Editar la categoría y el costo 400 → 450: `producto.modificado` del cajero. En pantalla: «Precio de venta: sin precio (no tenés permiso…)», ni «Importar» ni asociar proveedores | Crear, Editar, Costos |
| E2 | **Cambio de permisos con el formulario abierto** (sin revocar) | El dueño quita «Costos» con «Guardar / ampliar» (quedan Crear + Editar) | El cajero, sin recargar, guarda un costo 450 → 500: 403 «No tenés permiso para modificar costos» y el costo sigue en 450. Tras recargar, el campo de costo ya no aparece y el catálogo no envía costos. Editar el nombre sigue permitido | Protección por casilla, no sólo por revocación |
| E3 | **Vencimiento natural** | El dueño fija «Vence» a ahora + 3 min (Crear + Editar) | El cajero abre la edición, espera a que venza y guarda **sin recargar**: 403 `CATALOGO_SIN_PERMISO`, sin cambios. Tras recargar: «No tenés un permiso vigente…». Fila del dueño: «vencido el …». Después, **«Revocar ahora»** restaura exactamente los permisos originales (ver la discrepancia D1) | Vencimiento sin revocación |
| E4 | **Importación** con permisos parciales | Importar + Crear + Editar, sin Precios, Costos ni Proveedores | CSV de 2 filas: (a) un producto nuevo «QA B5 Producto Importado» con columnas de precio, costo y proveedor; (b) el producto de E1 con otra categoría. Vista previa: avisos de precio, costo y proveedores ignorados; (a) NUEVO con «crear»; (b) EXISTENTE con «actualizar». Ejecutar: (a) se crea sin precio, sin costo, sin proveedores y con stock 0; (b) se actualiza sólo la categoría. Auditorías del cajero. Ningún precio, costo, stock ni asociación cambiado | Importar y su combinación con los demás permisos |
| E5 | Cierre y **restauración** | «Revocar ahora» | Permisos y vencimiento exactamente como al empezar; Caja principal intacta; sin dinero | — |

**Opcionales**, sólo si el operador los pide:
- **E6:** precio de una **variante** por el cajero. El precio de un producto ya está certificado; el de variantes usa el mismo `conPrecioDeCatalogoEnTx`.
- **E7:** «Crear» con «Precios» y una variante nueva con precio.

No se proponen para no duplicar lo cubierto por el Bloque 4.

## 5. Resultados esperados (verificación interna por SQL de solo lectura, logs y auditoría)

**Permisos y su auditoría:**
- Otorgamientos y cambios del dueño, cada uno con antes y después: G1 (crear, editar, costos), G2 (crear, editar), G3 (crear, editar, vence +3 min) y G4 (importar, crear, editar).
- Revocaciones: la de E3 y la final.
- Las casillas exactas de cada uno se leen del detalle de la auditoría, como en `b4c-permisos.sql`.
- Al final, `catalogoHasta = null` y las seis casillas en falso, igual que la línea base.

**Productos:**
- Exactamente dos productos nuevos del negocio QA, los dos con `controlStock = false`, `stockCantidad = 0`, ningún movimiento de inventario y ninguna activación de precio:
  - «QA B5 Producto Nuevo M…»: precio 0, `stock=false`, costo 450, categoría editada por la importación;
  - «QA B5 Producto Importado M…»: precio 0, costo `null`, sin proveedores.
- Ningún producto existente alterado: A, B, Stock y el resto del negocio conservan precio, costo, stock, variantes y asociaciones.

**Auditoría y registros:**
- Auditoría del cajero:
  - `producto.creado` ×2 (una de la importación);
  - `producto.modificado`: E1 (categoría y costo), E2 (nombre) y E4 (categoría);
  - ninguna `producto.precio_cambiado`, ninguna `proveedor.*` y ninguna acción del dueño.
- Un registro de importación completado, con un grupo CREADO y otro ACTUALIZADO.

**Logs:**
- Sólo los rechazos previstos:
  - E2: `PUT …/catalogo/productos/<id>` 403;
  - E3: `PUT …/catalogo/productos/<id>` 403.
- Sin 5xx.
- Los 401 no relacionados ya conocidos (`/api/notificaciones`, `/api/destacado-solicitud`) se listan como informativos y no bloquean (ROADMAP).

**Dinero y turnos:** sin ventas, cobros, operaciones, movimientos, turnos, recepciones ni pagos. Caja principal idéntica.

## 6. Herramientas (reutilizar; no se construye infraestructura nueva)

- **Copiar `b4-complementaria`** a `b5-manual`, con el mismo runner, analizador, comprobación de despliegue, logs (incluidos los rechazos 4xx agrupados) y ZIP.
- **SQL:** una consulta nueva de solo lectura para el negocio QA y la ejecución:
  - productos `QA B5 %`, sus variantes y asociaciones, más una huella de los productos existentes;
  - movimientos de inventario y activaciones;
  - `importaciones_productos` y sus resultados;
  - permisos del cajero y detalle de antes y después de las auditorías de permisos (vencimiento y casillas);
  - auditoría del intervalo;
  - conteos de dinero y turno del dueño, como en el Bloque 4.
- **Preparación:**
  - SI de sesiones iniciadas;
  - despliegue `327d6c73`;
  - línea base;
  - CSV de E4 en la carpeta de la ejecución;
  - instrucciones;
  - observaciones E1–E5.
- **Verificación:** el comparador exige lo de §5 y genera el ZIP con cualquier resultado.

## 7. Discrepancias y limitaciones detectadas (revisión de código; no se corrige nada)

- **D1 — vencimiento ≠ restauración:**
  - Al vencer, el servidor no limpia nada: `catalogoHasta` queda en el pasado y las casillas siguen en verdadero. El efecto es nulo, porque sin vigencia todo es falso.
  - Pero el estado guardado no es el original, y la pantalla del dueño muestra esas casillas **ya marcadas** al volver a habilitar. Hay riesgo de otorgar casillas viejas sin querer.
  - Para restaurar exactamente hay que tocar «Revocar ahora». E3 lo comprueba.
  - Queda como posible mejora de UX: no se corrige.
- **D2 — el catálogo completo es visible con cualquier permiso vigente:** basta, por ejemplo, con «Asociar proveedores». Es así por diseño (sólo lectura y sin costos si no hay «Costos»). Se documenta; no es una regla nueva.
- **D3 — producto sin precio:** se crea con precio 0 y la Caja lo rechaza. No se ejercita una venta en este bloque, porque implicaría una operación de Caja; queda cubierto por la revisión de código.
- **D4 — aislamiento entre negocios:**
  - No se puede probar a mano sin un segundo negocio QA.
  - Queda cubierto por revisión de código (`resolveOperativoAreaForSlug` y búsquedas por `negocioId`) y por `empleado-identidad` para la lista.
  - Propuesta futura: una prueba de integración como C5, que no está autorizada.
- **D5 — protecciones sólo del servidor:** `STOCK_NO_PERMITIDO`, `ETIQUETA_PENDIENTE` y los 403 por casilla desde una pantalla que no los ofrece no son alcanzables desde la interfaz. Se certifican por código; E2 y E3 ejercitan las protecciones alcanzables.
- **D6 — sin suite automatizada de permisos de catálogo.** Es un candidato a cobertura permanente, junto con C5.

## 8. Próximo paso

Revisión de esta propuesta. Con la aprobación del operador, se preparan las herramientas `b5-manual`, con validación local sólo de sintaxis y simulación del comparador, sin ejecutar nada en TESTING.
