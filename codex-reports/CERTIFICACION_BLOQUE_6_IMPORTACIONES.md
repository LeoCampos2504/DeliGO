# Certificación — Bloque 6: importación masiva de productos (Excel / CSV) del dueño

Fecha: 2026-11-26 · Estado: **CERTIFICADO FUNCIONALMENTE EN TESTING (CLOSED_TESTING_CERTIFIED)**, dentro del alcance manual — ejecución
`M11262102`, ZIP APROBADO `e042303e…8255` (ver §11). Reemplaza a `CERTIFICACION_BLOQUE_6_IMPORTACIONES_PROPUESTA.md` (antecedente).

- **Entorno:** Railway TESTING `327d6c73`, negocio QA `paola-vinal` (genérico). Actor: **dueño**.
- **Fuera de alcance:** cajero, Caja, compras, pagos, stock y Production.
- **Escrituras:** la preparación es **sólo de lectura**. No se crean productos por SQL: los crean las importaciones que confirma el operador.

## 1. Reglas comerciales aprobadas (registradas en `DECISIONS_AND_INVARIANTS.md`, 2026-11-26)

- **D1:** con un precio pendiente de etiqueta, la importación no cambia el precio ni toca la etiqueta, y avisa. Los demás campos se actualizan. La edición manual conserva lo certificado en el Bloque 4.
- **D2:** la importación nunca cambia el nombre ni agrega variantes a un existente. Actualiza precios de variantes existentes y los demás campos permitidos. Una celda vacía no borra.
  - **Claridad de la vista previa:** cuando el código identifica un producto con otro nombre, la vista previa muestra «En el catálogo: `<nombre>`» y el aviso «En el catálogo se llama «…»: el nombre no se cambia.». Es una indicación suficiente; E2 la comprueba visualmente.
  - No se registra una mejora de UX adicional para D2.
- **D6:** la importación del dueño es sólo para negocios genéricos. La importación para restaurantes queda como mejora futura.
- **Costo:** el importado modifica el costo del catálogo, no los históricos de recepciones.
- **Formatos y límites:** `.xlsx` (primera hoja) o `.csv`, 5 MB y 2000 filas. La comunicación de los límites en la interfaz queda como mejora futura (ROADMAP).

## 2. Matriz definitiva de cobertura

| # | Comportamiento | Cobertura |
|---|---|---|
| 1 | Importación del dueño | **Manual** E1–E3 |
| 2 | Excel y CSV | **Manual**: `.xlsx` convencional (deflate) en E1 y `.csv` en E2–E3. El `.csv` del empleado ya está certificado (B5 E4) |
| 3 | Relación automática y manual | Automática: certificada (B5) y **manual** en E1. Manual: **manual** con «Importe final» en E1 |
| 4 | Vista previa | **Manual** (visual) en E1–E3. Ya certificada en B5 |
| 5 | Creación | **Manual** E1 y E3: simple, con variantes, precio, costo, código, marca y proveedor |
| 6 | Actualización | **Manual** E2: precio, costo, categoría, marca y variante |
| 7 | Omisión voluntaria | **Manual** E1 (fila 7) |
| 8 | Identificación | **Manual**: por nombre (E2 filas 2–3), por código con otro nombre (E2 fila 4) y variante por nombre (E2 fila 3) |
| 9 | Variantes | **Manual**: alta (E1 filas 3–4) y precio de una variante existente (E2 fila 3) |
| 10 | Códigos y conflictos | **Manual**: código distinto del catálogo (E2 fila 5). Repetido en el archivo, de productos distintos y nombres ambiguos: **suite técnica** (§7) |
| 11 | Precios y costos autorizados | **Manual**: «1.234,50» (texto), números de Excel, «$ 1.300», «1.200» y costo 800 → 850. Sin permiso: certificado (B5) |
| 12 | Proveedores | **Manual**: asociación con Alfa (E1 fila 2) y proveedor inexistente con aviso (E1 fila 5). Sin permiso: certificado (B5) |
| 13 | Filas inválidas | **Manual**: precio no interpretable (E1 fila 8) y nombre repetido (E1 fila 9) |
| 14 | Errores parciales y recuperación | **Manual**: las válidas se aplican y las erróneas no. Descarga de «Filas con error» en E1 y E2 y reimportación corregida en E3 |
| 15 | Reintentos e idempotencia | **Suite técnica**. A mano sólo se comprueba «una importación por confirmación» |
| 16 | Duplicados | **Manual**: nombre repetido, ningún producto duplicado y existente identificado en vez de recreado |
| 17 | Cancelación | **Manual** E1 paso 1: ninguna importación ni cambio |
| 18 | Auditoría y resultados | **Manual**: resumen y resultado por grupo, y auditorías |
| 19 | Invariantes de precios y stock | **Manual**: activaciones CATALOGO del dueño y nunca stock. Etiqueta pendiente (D1): **suite técnica** + revisión de código |
| 20 | Aislamiento entre negocios | **Revisión estática + suite técnica**. No se declara probado dinámicamente |

Extra: sólo se importa la **primera hoja**. El `.xlsx` trae una segunda hoja «trampa» que no debe crear nada.

## 3. Contadores

**Los resúmenes y contadores de la importación son por PRODUCTO (grupo de filas), no por fila ni por variante.** Por ejemplo, E1 tiene 8 filas y 7 productos: las filas 3 y 4 son un único producto con 2 variantes.

## 4. Archivos y acción esperada por fila

`<e>` = etiqueta de la ejecución. `<n>` = sus 8 dígitos. Los códigos son `77<n>00d` (13 dígitos).

### E1 — `archivos\b6-alta.xlsx`

Es un `.xlsx` con la estructura de Excel: libro, relaciones, hoja «Productos», textos compartidos, estilos, propiedades y una segunda hoja. Tiene **compresión deflate**. Los códigos y los importes son **celdas numéricas**; «1.234,50» y «12,345,6» son texto.

| Fila | Nombre | Variante | Código | Categoría | Marca | Importe final | Costo | Proveedor | Acción |
|---|---|---|---|---|---|---|---|---|---|
| 2 | QA B6 Simple | | …001 | QA B6 Cat | QA B6 Marca | 1.234,50 | 800 | QA B1 Proveedor Alfa M11240504 | g2 CREADO, asociado a Alfa |
| 3 | QA B6 Variantes | Rojo | …002 | QA B6 Cat | | 1500 | | | g3 CREADO (filas 3–4) |
| 4 | QA B6 Variantes | Azul | …003 | QA B6 Cat | | 1600 | | | (g3) |
| 5 | QA B6 Sin Proveedor | | …004 | QA B6 Cat | | 900 | | QA B6 Proveedor Inexistente | g5 CREADO con aviso, sin asociación |
| 6 | QA B6 Codigo | | …005 | QA B6 Cat | | 700 | | | g6 CREADO |
| 7 | QA B6 Omitido | | | QA B6 Cat | | 500 | | | g7 **OMITIDO** (decisión) |
| 8 | QA B6 Precio Malo | | | QA B6 Cat | | 12,345,6 | | | g8 **ERROR** de formato |
| 9 | QA B6 Simple | | | QA B6 Cat | | 999 | | | g9 **ERROR**, nombre repetido |

Resultado intermedio E1: 7 productos → **4 creados, 0 actualizados, 1 omitido, 2 errores**.

### E2 — `archivos\b6-actualizacion.csv`

UTF-8 con BOM y separador «;».

| Fila | Nombre | Variante | Código | Categoría | Marca | Precio de venta | Costo | Acción |
|---|---|---|---|---|---|---|---|---|
| 2 | QA B6 Simple | | | QA B6 Cat Act | *(vacía)* | $ 1.300 | 850 | g2 ACTUALIZADO: categoría, precio 1234,50 → 1300 (activación) y costo 800 → 850. La marca no se borra |
| 3 | QA B6 Variantes | Rojo | | | | 1550 | | g3 ACTUALIZADO: Rojo 1500 → 1550 (activación). Azul intacta |
| 4 | QA B6 Nombre Distinto | | …004 | | QA B6 Marca Nueva | | | g4 ACTUALIZADO = «Sin Proveedor» por código: sólo la marca, nombre sin cambios (aviso) |
| 5 | QA B6 Codigo | | …009 | | | | | g5 **ERROR**: código distinto del catálogo |

Resultado intermedio E2: 4 productos → **0 creados, 3 actualizados, 0 omitidos, 1 error**.

### E3 — `archivos\b6-correccion.csv`

| Fila | Nombre | Categoría | Precio de venta | Acción |
|---|---|---|---|---|
| 2 | QA B6 Precio Malo | QA B6 Cat | 1.200 | g2 CREADO: corrige la fila 8 de E1 |
| 3 | QA B6 Simple Bis | QA B6 Cat | 999 | g3 CREADO: corrige la fila 9 de E1 |

Resultado intermedio E3: **2 creados**.

### Qué pasa con cada uno de los tres errores

| Error | Qué ocurre |
|---|---|
| E1 fila 8 (precio no interpretable) | Se corrige y se crea en E3 |
| E1 fila 9 (nombre repetido) | Se corrige con otro nombre y se crea en E3 |
| E2 fila 5 (código distinto) | **Queda rechazado a propósito**: es la protección contra la sobrescritura de un código. «QA B6 Codigo» conserva …005 y …009 no existe en ningún lado |

**Evidencias** (las descarga el operador y las copia sin modificar a `evidencias\`):
- `filas-con-error-b6-alta.csv`: debe contener sólo las filas 8 y 9, con el error de formato y el de nombre repetido.
- `filas-con-error-b6-actualizacion.csv`: debe contener sólo la fila 5, con «distinto al del catálogo».

Los archivos de importación originales quedan en `archivos\` con su SHA-256 registrado en `preparacion\archivos.json`. Los corregidos son un archivo distinto y no se sobrescriben.

## 5. Resultados finales esperados

| Producto | Precio | Costo | Categoría | Marca | Código | Otros |
|---|---|---|---|---|---|---|
| QA B6 Simple | 1300 | 850 | QA B6 Cat Act | QA B6 Marca | …001 | Asociado a Alfa |
| QA B6 Variantes | 0 (base) | — | QA B6 Cat | — | — | Rojo 1550 (…002) y Azul 1600 (…003) |
| QA B6 Sin Proveedor | 900 | — | QA B6 Cat | QA B6 Marca Nueva | …004 | Sin proveedores |
| QA B6 Codigo | 700 | — | QA B6 Cat | — | …005 | — |
| QA B6 Precio Malo | 1200 | — | QA B6 Cat | — | — | — |
| QA B6 Simple Bis | 999 | — | QA B6 Cat | — | — | — |

**Productos:**
- Los seis están activos, sin control de stock y con stock 0.
- Hay exactamente dos variantes.
- No existen «Omitido», «Nombre Distinto» ni el producto de la segunda hoja.
- Hay exactamente tres productos y dos variantes con el prefijo de códigos.

**Precios:**
- Exactamente **dos activaciones CATALOGO a nombre del dueño**, durante E2: Simple 1234,50 → 1300 y Rojo 1500 → 1550.
- Ninguna autorización ni etiqueta de precio.
- Ningún costo vigente nuevo.

**Proveedores:** una asociación (Alfa con Simple, a nivel producto) y ningún proveedor nuevo.

**Importaciones:**
- Exactamente **tres**, del dueño y COMPLETADAS, con los resúmenes y el resultado por grupo de §4.
- **Ninguna por la cancelación.** La vista previa no escribe en la base; sólo deja sus solicitudes HTTP 200 en los logs, que no son escrituras comerciales.

**Auditoría del dueño:**
- `producto.creado` ×6 (origen IMPORTACION; Variantes con 2 variantes);
- `proveedor.productos_asociados` ×1 (Alfa);
- `producto.precio_cambiado` ×2;
- `producto.modificado` ×1 (sólo marca);
- `catalogo.importacion` ×3, con sus contadores.
- **Nada más**, tampoco del cajero.

**Integridad:**
- Huellas idénticas del resto del catálogo: productos, variantes, asociaciones y proveedores.
- Cero movimientos de stock, ventas, cobros, inicios, operaciones y movimientos financieros, salidas, recepciones, obligaciones, créditos, devoluciones y turnos.
- Ventas anteriores y Caja principal idénticas.

**Logs:** ningún 4xx relacionado (la importación informa los errores por grupo con 200) y ningún 5xx. Los 401 no relacionados se muestran agrupados como informativos.

## 6. Herramientas (`%USERPROFILE%\deligo-dev-db\certificacion\b6-manual\`, reutilizando `b5-manual`)

| Archivo | Función |
|---|---|
| `b6-manual.sql` (SHA `217898f8…d631d`) | Consulta de solo lectura: productos, variantes, códigos, asociaciones, proveedores nuevos, costos vigentes, huellas, stock, activaciones, etiquetas, importaciones con su resultado por grupo, auditoría (campos técnicos), dinero y turnos |
| `testing-b6.ps1` | Runner con las mismas protecciones: SHA fijado, palabras de escritura prohibidas, sesión `read_only`, URL sólo en memoria, logs enmascarados, sesión con fecha, método, ruta y código, y 4xx agrupados |
| `analizar-railway.mjs` | Copia del Bloque 5 |
| `datos-b6.mjs` | Contenido exacto de los archivos, acción esperada por fila y generador del `.xlsx` (deflate con el zlib de Node, sin dependencias nuevas) y de los CSV |
| `instrucciones-b6.mjs` | Precondiciones: sin productos ni códigos de la ejecución, Alfa activo, sólo el turno del dueño (exit 3 si fallan). Genera `archivos\`, `evidencias\`, instrucciones y observaciones |
| `comparar-b6.mjs` | Bloques BASE, ARCHIVOS, E1, E2, E3, GENERAL, LOGS, DESPLIEGUE y OPERADOR |
| `b6-manual-preparar.ps1` / `b6-manual-verificar.ps1` | Preparación (despliegue, línea base y archivos) y verificación (SQL, despliegue, logs, comparación, revisión de credenciales y ZIP con cualquier resultado) |
| `local-sql.ps1` | Sólo validación local de sintaxis |

**Validación local:**
- SQL contra `deligo_dev`, sólo sintaxis.
- Parser de PowerShell y `node --check`.
- Estructura del `.xlsx` generado: diez entradas, todas deflate. La primera hoja es «Productos», con las 8 filas previstas, códigos numéricos y «1.234,50» como texto.
- Nueve simulaciones del comparador con datos ficticios:
  - recorrido correcto → APROBADO;
  - fila omitida creada → FALLIDO;
  - código en conflicto guardado → FALLIDO;
  - marca borrada por una celda vacía → FALLIDO;
  - cancelación confirmada (una cuarta importación) → FALLIDO;
  - evidencia faltante → INCOMPLETO;
  - evidencia con una fila de más → FALLIDO;
  - activación con otro actor → FALLIDO;
  - archivo de importación modificado → FALLIDO.

## 7. Cobertura técnica pendiente (suite consolidada junto con el Bloque 5 §8; NO implementada)

- **Importación:**
  - idempotencia de confirmaciones: misma clave y huella → mismo resultado; otra huella → 409 `IMPORTACION_DISTINTA`;
  - reintentos;
  - confirmaciones simultáneas (bloqueo y `reservarGrupo`);
  - tandas de más de 150 grupos;
  - conflictos de identificación: código repetido en el archivo, de productos distintos, nombres ambiguos y código de variante;
  - etiqueta pendiente (D1);
  - aislamiento entre negocios;
  - límites de 5 MB y 2000 filas;
  - formatos numéricos;
  - ausencia de efectos ante grupos con error.
- **Pendientes del Bloque 5:** aislamiento, costos ocultos, independencia de permisos, vencido o revocado, `STOCK_NO_PERMITIDO`, `PRODUCTO_SIN_PRECIO` y `ETIQUETA_PENDIENTE`.

## 8. Riesgos y limitaciones

- **Excel real:** el `.xlsx` se genera con la estructura y la compresión estándar de Excel, pero **no lo guardó Microsoft Excel** (no hay Excel disponible en las herramientas). Pendiente antes de Production: importar un archivo guardado por Excel real, con fórmulas y formatos de celda propios. Queda en el ROADMAP.
- **Observación del operador:** la vista previa, los avisos y la relación de columnas. Los registros prueban lo persistido.
- **Cancelación:** se comprueba por ausencia (no hay una cuarta importación ni cambios). La vista previa no deja registros en la base.
- **Archivos de errores:** se descargan en el navegador del operador. Se exige que los copie sin modificar; se registra su SHA-256.
- **No probado dinámicamente:** reintentos, simultaneidad, tandas, etiqueta pendiente, conflictos restantes, aislamiento y límites (§7).

## 9. Comando del operador

Con la sesión del **dueño** iniciada, ejecutar la preparación (sólo lectura):

```powershell
powershell -ExecutionPolicy Bypass -File "%USERPROFILE%\deligo-dev-db\certificacion\b6-manual\b6-manual-preparar.ps1"
```

Después, seguir `INSTRUCCIONES-OPERADOR.md` (E1–E3), completar las observaciones, cerrar la ventana sin cerrar sesión y ejecutar `b6-manual-verificar.ps1`.

## 10. Ejecución `M11262102` (2026-11-26) — pruebas manuales hechas; falta la verificación interna

**Ejecución:** inicio a las 2026-11-26T21:03:18.482Z, en TESTING `327d6c73`.

**Resultados del operador** (10 OK, 0 FALLA, 0 INCONCLUSA, 0 PENDIENTE), registrados en `observaciones-operador.md`:

| Escenario | Pasos | Creados | Actualizados | Omitidos | Con error |
|---|---|---|---|---|---|
| E1 | 5/5 | 4 | 0 | 1 | 2 |
| E2 | 4/4 | 0 | 3 | 0 | 1 (conflicto de código, rechazado a propósito) |
| E3 | 1/1 | 2 | 0 | 0 | 0 |

**Evidencias capturadas por el operador** (leídas sin modificar):
- `filas-con-error-b6-alta.csv`: SHA-256 `738fa708…1011d`, 398 B. Contiene las filas 8 («Precio «12,345,6» no tiene un formato de importe válido…») y 9 («Nombre repetido en el archivo (fila 2)…»).
- `filas-con-error-b6-actualizacion.csv`: SHA-256 `5952e92b…78a2`, 201 B. Contiene la fila 5 («El código 7711262102009 es distinto al del catálogo (7711262102005).»).

**Archivos originales:** los tres son idénticos a las huellas de la preparación (`a7a784cf…`, `6386cc44…`, `c396b5ee…`).

**Permisos de empleados y compras o pagos:** la consulta del bloque no los lista por separado, pero cualquier cambio quedaría en la auditoría del dueño o del cajero del intervalo. El verificador exige que esa auditoría contenga **sólo** las 13 acciones previstas, así que un cambio de permisos, compras o pagos lo haría fallar. No se modificó ninguna herramienta.

**Límites que siguen pendientes:** archivo guardado por Microsoft Excel real, reintentos e idempotencia, simultaneidad, tandas, conflictos adicionales de identificación, etiqueta pendiente, aislamiento dinámico entre negocios y límites (§7–§8). No se declaran certificados por revisión de código.

**El Bloque 6 no está certificado** hasta revisar el ZIP de `b6-manual-verificar.ps1`.

## 11. CIERRE DEFINITIVO — Bloque 6 CERTIFICADO (2026-11-26)

**ZIP:** `B6-MANUAL-M11262102-20261126T211329Z-APROBADO.zip`, SHA-256 `e042303e0d6a5c5c245edf3aa9baa1fc7d7a20ecab15182f410edcd23b4d8255` (recalculado y coincidente). 18 archivos, **10/10 manuales** y **9/9 bloques**. Lo revisaron ChatGPT y el verificador.

**Huellas recalculadas antes del cierre (sin cambios):**
- Evidencias: `filas-con-error-b6-alta.csv` `738fa708…1011d` y `filas-con-error-b6-actualizacion.csv` `5952e92b…78a2`.
- Archivos originales: `b6-alta.xlsx` `a7a784cf…`, `b6-actualizacion.csv` `6386cc44…` y `b6-correccion.csv` `c396b5ee…`.
- El `.xlsx` tiene dos hojas, comprimidas con deflate.

**Resultados:**
- Tres importaciones: E1 con 4 creados, 1 omitido y 2 errores previstos; E2 con 3 actualizados y 1 error previsto; E3 con 2 creados.
- Seis productos y dos variantes nuevos, dos activaciones del dueño, una asociación con Alfa y 13 auditorías previstas.
- Ningún proveedor nuevo, ningún producto omitido, duplicado o de la segunda hoja, y ninguna importación por la cancelación.
- Nombre conservado en la identificación por código, marca conservada ante la celda vacía y código rechazado no persistido.

**Valores finales:**

| Producto | Precio | Costo |
|---|---|---|
| Simple | 1300 | 850 |
| Variantes: Rojo | 1550 | — |
| Variantes: Azul | 1600 | — |
| Sin Proveedor | 900 | — |
| Codigo | 700 | — |
| Precio Malo | 1200 | — |
| Simple Bis | 999 | — |

**Integridad:**
- Se conservan 24 productos, 11 variantes, 7 asociaciones, 2 proveedores y 61 ventas anteriores.
- Cero movimientos de stock, ventas, cobros, operaciones o movimientos financieros, turnos y etiquetas.
- El turno de la Caja principal está intacto.

**Logs:** cero 4xx relacionados y no relacionados, cero 5xx, cero errores y cero advertencias de aplicación. No hizo falta ninguna conciliación. El despliegue coincide con `327d6c73`.

**Limitación explícita:** los permisos de empleados y las compras o pagos **no tienen una comparación SQL propia** en este paquete; su ausencia de cambios se respalda en la auditoría completa del intervalo.

**Pendientes, no certificados** (ver `CONSOLIDACION_FINAL_PRODUCTION_PLAN.md`):
- el Excel guardado por Microsoft Excel;
- reintentos e idempotencia, simultaneidad y tandas;
- conflictos de identificación adicionales;
- la etiqueta pendiente durante la importación;
- el aislamiento dinámico entre negocios;
- los límites de tamaño, filas y formatos.
