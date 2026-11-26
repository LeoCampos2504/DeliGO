# Certificación — Bloque 6: importación masiva de productos (Excel / CSV) — PROPUESTA

Fecha: 2026-11-26 · Estado: **REEMPLAZADA** por `CERTIFICACION_BLOQUE_6_IMPORTACIONES.md` (aprobada con decisiones D1/D2/D6 y ajustes; queda como antecedente).
Entorno previsto: Railway TESTING `327d6c73`, negocio QA `paola-vinal` (genérico). Actor principal: **dueño**. La importación del
empleado ya está certificada en el Bloque 5 E4. Sin Caja, compras, pagos ni stock; sin Production.

## 1. Fuentes revisadas (código vigente `327d6c73`)

- **Servidor:** `src/lib/importacion-productos-service.ts`, con `previsualizarImportacion` (sólo lectura), `ejecutarImportacion`, `estadoImportacion`, `parseNumero` y `planificar`.
- **HTTP:** `src/lib/importacion-productos-http.ts`, más las rutas del dueño (`POST/GET /api/negocio/productos/importar`, sólo para negocios genéricos) y del cajero (`…/operativo/caja/[slug]/catalogo/importar`).
- **Navegador:** `src/lib/importacion-archivo.ts` y `src/components/business/importar-productos.tsx`.
  - Lectura de `.xlsx` (primera hoja, entradas almacenadas o deflate) y de `.csv` (separador `;`, `,` o tabulador, UTF-8 o Windows-1252).
  - Límites: 5 MB y 2000 filas.
  - Relación automática por sinónimos y manual por selector, vista previa, decisiones por grupo, reintento automático con la misma clave y descarga de «Filas con error (.csv)».
- **Base:** la migración `20261121200000_catalogo_importacion_productos` crea `importaciones_productos`, con clave única por negocio, huella, resultados en JSONB, estado y bloqueo.
- **Pruebas automatizadas:** **no existe ninguna** sobre importación, ni de servidor ni de navegador.
- **Antecedente:** la validación manual en desarrollo local (FULL_CONTEXT, «catalog stage 2») **no es certificación**.
- **Decisiones aplicadas:**
  - nunca sobrescribir sin «actualizar» explícito;
  - nunca tocar stock;
  - precios y costos sólo con permiso (el dueño siempre);
  - una celda vacía no borra datos;
  - nunca crear proveedores;
  - precio por historial de activaciones;
  - auditoría.

## 2. Reglas implementadas (base de los resultados esperados)

| Tema | Regla en `327d6c73` |
|---|---|
| Dueño o empleado | El dueño tiene todos los permisos. El empleado necesita «Importar» más el permiso de cada operación, revalidado por grupo (certificado en B5 E4) |
| Identificación | Un producto existente se identifica **primero por código de barras** (del producto o de una variante) y **después por nombre exacto** (normalizado). Los productos eliminados no cuentan |
| Grupos | Las filas con el mismo nombre **y** con columna «Variante» forman un producto con variantes. Un nombre repetido sin variante es error en la segunda fila. Una variante repetida es error |
| Nuevo | Se crea con categoría («Sin Categoria» por defecto), marca, descripción, código, precio, costo y variantes. Sin precio queda con precio 0 y no disponible. El stock es siempre 0 y sin control de stock |
| Existente | Sólo se actualizan las diferencias: categoría, marca y descripción (con «Editar»), un código **sólo si el producto no tenía**, precio (producto sin variantes o precio por variante existente), costo y proveedores nuevos. **El nombre nunca cambia** (aviso). Una variante nueva sobre un existente da error («agregalas desde la ficha») |
| Conflictos de código | Hay error si un código está repetido en el archivo, si los códigos del grupo pertenecen a productos distintos, si el código es distinto del que ya tiene el producto, si hay varios productos con el mismo nombre sin código, o si el código de un producto con variantes no indica la variante |
| Números | Acepta `1234`, `1234.5`, `1.234`, `1.234,50`, `$`/`ARS`, con un máximo de 2 decimales. Lo ambiguo o inválido es error. Precio mayor que 0 y costo mayor o igual a 0 |
| Proveedores | Por nombre exacto de un proveedor activo, separados por `;` o `\|`. Uno inexistente da aviso y no se crea. La asociación es idempotente, a nivel producto |
| Precio con etiqueta pendiente | El precio **no se actualiza** (aviso) y el resto sí. Esto difiere de la edición manual del catálogo, que reemplaza la etiqueta: ver D1 |
| Decisión | Vista previa **sin escritura**. Cada grupo NUEVO (sugerido «crear») o EXISTENTE con cambios (sugerido «omitir») se decide aparte. Los grupos con error no se procesan |
| Confirmación | La clave es un UUID del navegador. La huella es campos + filas + decisiones. La misma clave con otros datos da 409 `IMPORTACION_DISTINTA`. Hay un bloqueo de 60 s y tandas de 8 s / 150 grupos. El resultado de cada grupo se guarda **en la misma transacción** que su escritura. Un reintento devuelve el mismo resultado o retoma. El registro se cierra una sola vez, con auditoría `catalogo.importacion` |
| Auditoría | `producto.creado` (origen IMPORTACION), `producto.modificado` / `producto.precio_cambiado`, `proveedor.productos_asociados` y `catalogo.importacion` con el resumen. El actor es el dueño o el empleado |
| Precios | Un cambio de precio de un existente pasa por `conPrecioDeCatalogoEnTx` y genera una activación CATALOGO a nombre del actor |

## 3. Matriz de cobertura (los 20 puntos)

| # | Comportamiento | Estado | Dónde |
|---|---|---|---|
| 1 | Importación por el dueño | **Manual nuevo** | E1–E3 |
| 2 | Excel y CSV | `.csv` del empleado certificado (B5 E4). **`.xlsx` manual nuevo (E1)** y `.csv` del dueño (E2) | E1, E2 |
| 3 | Relación automática y manual de columnas | Automática certificada (B5 E4). **Manual nueva** con un encabezado sin sinónimo | E1 |
| 4 | Vista previa antes de confirmar | Certificada (B5 E4). Se reutiliza | E1–E3 |
| 5 | Creación | Empleado sin precio certificado. **Dueño con precio, costo, código, marca, proveedor y variantes, nuevo** | E1 |
| 6 | Actualización de existentes | Empleado (categoría) certificado. **Dueño: precio, costo, código faltante, marca y variante, nuevo** | E2 |
| 7 | Omisión voluntaria | **Manual nuevo** | E1 |
| 8 | Identificación de productos y variantes | Por nombre certificado (B5). **Por código, con nombre distinto (aviso), y por variante, nuevo** | E2 |
| 9 | Productos con variantes | **Nuevo:** alta con variantes y actualización del precio de una variante | E1, E2 |
| 10 | Códigos y conflictos | **Nuevo:** código distinto del catálogo (error). El código repetido en el archivo, el de productos distintos y los nombres ambiguos son **revisión estática + suite técnica** | E2 / §8 |
| 11 | Precios y costos autorizados | Ignorados sin permiso, certificado (B5). **Aplicados por el dueño, nuevo** (formatos `1.234,50` y `$ 1.300`) | E1, E2 |
| 12 | Proveedores | Ignorados sin permiso, certificado. **Asociación por el dueño y proveedor inexistente (aviso), nuevo** | E1 |
| 13 | Filas inválidas | **Nuevo:** precio no interpretable y nombre repetido → grupos con ERROR, no procesados | E1 |
| 14 | Errores parciales y recuperación | **Nuevo:** los válidos se aplican y los erróneos no. Descarga de «Filas con error (.csv)» y reimportación corregida | E1, E3 |
| 15 | Reintentos e idempotencia | **Suite técnica** (no reproducible a mano con fiabilidad: corte de red, doble envío, bloqueo). A mano sólo se ve «una importación por confirmación, sin duplicados» | §8 + SQL |
| 16 | Prevención de duplicados | **Nuevo:** un nuevo con el nombre de un existente queda como EXISTENTE. Un nombre repetido en el archivo da error. Sin productos duplicados en SQL | E1–E3 |
| 17 | Cancelación antes de confirmar | **Nuevo:** vista previa → «Elegir otro archivo» → ningún registro ni cambio | E1 |
| 18 | Auditoría y resultados | Empleado certificado. **Dueño nuevo** (resumen por importación y resultado por grupo) | E1–E3 |
| 19 | Invariantes de precios, etiquetas y stock | Activaciones CATALOGO por cambio de precio y nunca stock: **nuevo** para el dueño. Etiqueta pendiente → precio no actualizado: **revisión estática + suite técnica** (necesita una recepción, fuera de alcance) | E2 / §8 |
| 20 | Aislamiento entre negocios | **Revisión estática + suite técnica**: sesión del dueño, búsquedas por `negocioId` y clave única por negocio | §8 |

## 4. Escenarios manuales (compactos; sólo el dueño; ventana del dueño con sesión iniciada)

`<e>` = etiqueta de la ejecución. Proveedor existente: «QA B1 Proveedor Alfa M11240504». Todos los productos son nuevos `QA B6 … <e>`.

**E1 — Alta desde Excel (`b6-alta.xlsx`)**, con relación manual, cancelación previa, omisión y errores parciales:
1. Cargar el archivo → vista previa → **«Elegir otro archivo»**: cancela sin escribir.
2. Volver a cargarlo.
3. El encabezado «Importe final» no tiene sinónimo: hay que relacionarlo **a mano** con «Precio de venta».
4. En la vista previa, elegir **Omitir** en una fila válida y confirmar. **Descargar «Filas con error (.csv)»** y guardarlo en `evidencias\`.

| Fila | Nombre | Variante | Código | Categoría | Marca | Importe final | Costo | Proveedor | Esperado |
|---|---|---|---|---|---|---|---|---|---|
| 2 | QA B6 Simple `<e>` | | 779000`<n>`1 | QA B6 Cat `<e>` | QA B6 Marca `<e>` | 1.234,50 | 800 | Alfa | CREADO: precio 1234.50, costo 800, código, marca, **asociado a Alfa** |
| 3 | QA B6 Variantes `<e>` | Rojo | 779000`<n>`2 | QA B6 Cat `<e>` | | 1500 | | | CREADO, con variantes |
| 4 | QA B6 Variantes `<e>` | Azul | 779000`<n>`3 | QA B6 Cat `<e>` | | 1600 | | | (mismo producto) Azul 1600 |
| 5 | QA B6 Sin Proveedor `<e>` | | 779000`<n>`4 | QA B6 Cat `<e>` | | 900 | | QA B6 Proveedor Inexistente | CREADO, aviso «Proveedor … no existe», sin asociación |
| 6 | QA B6 Codigo `<e>` | | 779000`<n>`5 | QA B6 Cat `<e>` | | 700 | | | CREADO (se usa en E2) |
| 7 | QA B6 Omitido `<e>` | | | QA B6 Cat `<e>` | | 500 | | | **OMITIDO** por decisión: no existe |
| 8 | QA B6 Precio Malo `<e>` | | | QA B6 Cat `<e>` | | 12,345,6 | | | **ERROR** de precio no interpretable: no se crea |
| 9 | QA B6 Simple `<e>` | | | QA B6 Cat `<e>` | | 999 | | | **ERROR** de nombre repetido en el archivo: no afecta la fila 2 |

Resultado E1: 4 creados (Simple, Variantes, Sin Proveedor, Codigo), 1 omitido y 2 errores.

**E2 — Actualización desde CSV (`b6-actualizacion.csv`, formato argentino)**: elegir **Actualizar** en cada existente.

| Nombre | Variante | Código | Categoría | Marca | Precio de venta | Costo | Esperado |
|---|---|---|---|---|---|---|---|
| QA B6 Simple `<e>` | | | QA B6 Cat Act `<e>` | *(vacía)* | $ 1.300 | 850 | ACTUALIZADO: categoría, precio 1234.50 → 1300 (**activación CATALOGO del dueño**) y costo 800 → 850. **La marca vacía no se borra** |
| QA B6 Variantes `<e>` | Rojo | | | | 1550 | | ACTUALIZADO: precio de Rojo 1500 → 1550 (activación de la variante). Azul intacta |
| QA B6 Nombre Distinto `<e>` | | 779000`<n>`4 | | QA B6 Marca Nueva `<e>` | | | Identificado **por código** como «Sin Proveedor»: aviso «el nombre no se cambia» y sólo cambia la marca |
| QA B6 Codigo `<e>` | | 779000`<n>`9 | | | | | **ERROR**: «El código … es distinto al del catálogo»; no se procesa |

Resultado E2: 3 actualizados y 1 error.

**E3 — Recuperación de filas con error (`b6-correccion.csv`)**:
- Son las filas 8 y 9 de E1 corregidas: «QA B6 Precio Malo `<e>`» con precio 1.200, y la fila 9 renombrada «QA B6 Simple Bis `<e>`» con precio 999.
- Resultado: 2 creados.
- El archivo de errores que descargaste en E1 se conserva como evidencia y se compara con las filas esperadas.

Fuera de los manuales:
- **Importación del empleado:** sólo el B5 E4.
- **Aislamiento, reintentos, etiqueta pendiente y conflictos de código restantes:** §8.

## 5. Resultados esperados (verificación interna)

**Productos `QA B6 … <e>`:** exactamente seis (Simple, Variantes, Sin Proveedor, Codigo, Precio Malo, Simple Bis), activos, sin control de stock y con stock 0.

| Producto | Estado final |
|---|---|
| Simple | Precio 1300, costo 850, categoría Cat Act, marca «QA B6 Marca», asociado a Alfa |
| Variantes | Precio base 0. Variantes Rojo 1550 y Azul 1600, con sus códigos |
| Sin Proveedor | Precio 900, código `<n>4`, marca «Marca Nueva», sin proveedores, nombre sin cambios |
| Codigo | Precio 700, código `<n>5` sin cambios |
| Precio Malo | Precio 1200 |
| Simple Bis | Precio 999 |

No existen ni «Omitido» ni «Nombre Distinto».

**Activaciones CATALOGO del dueño:**
- exactamente dos (Simple 1234.50 → 1300 y Rojo 1500 → 1550);
- ninguna etiqueta ni autorización nueva;
- ningún costo vigente nuevo (el costo del catálogo no es costo de recepción).

**Proveedores:** una asociación nueva (Alfa con Simple, a nivel producto) y ningún proveedor nuevo.

**Importaciones del intervalo:** exactamente tres, del dueño y COMPLETADAS:
- E1: 4 creados, 0 actualizados, 1 omitido y 2 errores;
- E2: 0 creados, 3 actualizados y 1 error;
- E3: 2 creados.

Ninguna importación por la cancelación de E1.

**Auditoría del dueño:**
- `producto.creado` ×6 (origen IMPORTACION);
- `producto.precio_cambiado` ×2, más `producto.modificado` para «Sin Proveedor»;
- `proveedor.productos_asociados` ×1;
- `catalogo.importacion` ×3;
- nada más.

**Integridad:**
- Huellas del resto del catálogo idénticas, como en el Bloque 5.
- Cero movimientos de stock, ventas, cobros, inicios, operaciones financieras, turnos, recepciones y pagos. Caja principal idéntica.

**Logs:** sin 4xx relacionados (la importación devuelve 200 con errores por grupo) y sin 5xx. Los 401 no relacionados se agrupan como informativos.

**Evidencia:** `evidencias/filas-con-error.csv` (descargado por el operador) contiene exactamente las filas 8 y 9 de E1 con su error.

## 6. Datos QA y archivos

**Datos QA:**
- Negocio `paola-vinal`, ventana del dueño y proveedor Alfa del Bloque 1, que sólo se asocia a «QA B6 Simple».
- No se usan cajero ni caja.

**Códigos `779000<n>d`:**
- `<n>` deriva de la etiqueta. La preparación verifica que ninguno exista en el negocio.
- Son códigos sintéticos: la verificación no exige que sean EAN válidos, porque el código vigente no valida el dígito.

**Archivos generados por la preparación:**
- `b6-alta.xlsx`: XLSX mínimo de una hoja, generado sin dependencias.
- `b6-actualizacion.csv` y `b6-correccion.csv`: UTF-8 con BOM, separador `;`.
- `evidencias\` vacío, para el CSV de errores descargado.

## 7. Verificación interna propuesta (reutilizando `b5-manual`)

- **Herramientas:** copiar `b5-manual` como `b6-manual`, con el mismo runner, analizador, sesión, logs y ZIP.
- **SQL de solo lectura:**
  - productos `QA B6 %<e>` con variantes, códigos, asociaciones y costos vigentes;
  - huellas del resto;
  - `importaciones_productos` del intervalo (resumen y resultado por grupo, con la clave del grupo y el resultado);
  - activaciones, etiquetas y autorizaciones del intervalo;
  - auditoría del dueño (campos técnicos);
  - dinero, stock y turnos.
- **Preparación:**
  - comprobar que los códigos y los nombres no existen;
  - registrar la línea base;
  - generar los archivos.
- **Comparador:** exige lo de §5, cada producto y valor exacto, y ningún efecto no previsto. Reutiliza la conciliación por registro exacto del Bloque 5 sólo si aparece un rechazo justificable, sin exclusiones generales.

## 8. Cobertura técnica adicional (no implementada; se suma a la suite consolidada del Bloque 5 §8)

Para el riesgo que no se puede comprobar a mano con fiabilidad, se suman casos a `f10-c2-catalogo-permisos.integration.test.ts` (o a una suite hermana de importación), en el PostgreSQL efímero de CI y con la ruta real:

1. **Idempotencia y reintentos:**
   - la misma clave y la misma huella devuelven el resultado guardado;
   - la misma clave con otra huella da 409 `IMPORTACION_DISTINTA`;
   - dos confirmaciones concurrentes procesan cada grupo una sola vez (bloqueo y `reservarGrupo`);
   - con más de 150 grupos, la ejecución retoma por tandas sin duplicar.
2. **Conflictos de código:**
   - un código repetido en el archivo;
   - códigos de productos distintos en un grupo;
   - nombres ambiguos en el catálogo;
   - el código de una variante.
3. **Etiqueta pendiente:** la importación no actualiza el precio (aviso) y el resto sí.
4. **Aislamiento:** el dueño de B no ve ni actualiza productos de A, y la clave es única por negocio.
5. **Límites:** 2000 filas y el parser de números (casos ambiguos).

## 9. Discrepancias y limitaciones (no se corrige nada)

- **D1 — etiqueta pendiente:** la importación **omite** el cambio de precio con aviso, mientras la edición manual del catálogo **reemplaza** la etiqueta (certificado en B4 E6/C2). Es una diferencia de criterio que **el operador debe confirmar** antes de certificar: si la regla aprobada es reemplazar, es una discrepancia.
- **D2 — nombre y variantes:** una actualización nunca cambia el nombre ni crea variantes nuevas sobre un existente. Está documentado en la interfaz y es coherente con «no sobrescribir sin decisión», pero hay que confirmarlo como regla comercial.
- **D3 — costo:** el costo importado actualiza `producto.costo`, no el costo vigente de recepciones. Es igual que la edición manual de costos.
- **D4 — formato de archivos:** sólo `.xlsx` (primera hoja) y `.csv`. Un `.xls` antiguo se rechaza con instrucciones. Límites de 5 MB y 2000 filas.
- **D5:** sin pruebas automatizadas de importación. Ver §8.
- **D6 — sólo negocios genéricos:** la importación del dueño exige un negocio genérico (`requireNegocioCajaGenerico`); un restaurante no la tiene. Hay que confirmar si es la regla buscada.
- **Limitación:** lo que muestra la vista previa (avisos, sugerencias) es observación del operador. Los registros prueban el resultado. El reintento automático del navegador no se observa a mano.
