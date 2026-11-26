# Certificación — Bloque 5: permisos temporales de catálogo de los empleados

Fecha: 2026-11-26 · Estado: **CERTIFICADO FUNCIONALMENTE EN TESTING (CLOSED_TESTING_CERTIFIED)** — ejecución `M11261651`,
ZIP APROBADO `04cd6c33…228e` (auditoría independiente de ChatGPT), ver §12. Las limitaciones técnicas siguen pendientes y
lo revisado sólo en código no se declara probado dinámicamente. Reemplaza a `CERTIFICACION_BLOQUE_5_PERMISOS_CATALOGO_PROPUESTA.md`
(antecedente).

- **Entorno:** Railway TESTING `327d6c73` (DeliGO Copy), negocio QA `paola-vinal`, cajero QA «TEST_T44_R1D_CUENTA_4135EA7A» (`cmuq91zhp0008ka0ab4fqenuj`).
- **Fuera de alcance:** dinero, turnos y Production.
- **Escrituras:** la preparación es **sólo de lectura** sobre TESTING. Las únicas escrituras son las operaciones manuales autorizadas del operador: permisos, productos e importación.

## 1. Matriz de cobertura

| Control | Cobertura | Evidencia |
|---|---|---|
| Pantalla del empleado sin permiso | **Certificado** | Bloque 4 E3.1 |
| «Asociar proveedores»: asociar y quitar, revocar, formulario abierto rechazado | **Certificado** | Bloque 1 E6 |
| «Precios de venta» del producto: cambio a nombre del cajero, revocación, 403 posterior, restauración | **Certificado** | Bloque 4 E3/C3 |
| Acciones del cajero sobre etiquetas (sólo «Etiqueta actualizada») | **Certificado** (interfaz) | Bloque 4 C1 |
| Vencimiento no futuro → 400 sin escritura | **Certificado** | Conciliación del 400, Bloque 4 §12.4 |
| Activación CATALOGO a nombre del EMPLEADO admitida por la base | **Certificado** | Bloque 4 PRECONDICION_C3 |
| «Crear productos y variantes» (simple y con variantes; sin Precios → sin precio; costo con Costos; nunca stock) | **Nuevo: E1** | Manual + SQL + auditoría |
| «Editar datos» (categoría, marca) | **Nuevo: E1, E2, E3** | Manual + SQL + auditoría |
| «Costos»: registrar y modificar; ocultamiento sin la casilla | **Nuevo: E1, E2** | Manual + SQL + respuesta real del servidor (E2) |
| Revocación **parcial** con formulario abierto e independencia de las casillas restantes | **Nuevo: E2** | 403 en logs + SQL + auditoría |
| **Vencimiento automático** con formulario abierto, sin renovar la sesión | **Nuevo: E3** | Auditoría (vencimiento) + 403 posterior + SQL |
| «Importar productos» con permisos parciales (columnas ignoradas, crear y actualizar) | **Nuevo: E4** | Manual + SQL + auditoría. Se reutiliza en el Bloque 6 |
| Restauración exacta, integridad del catálogo previo, sin stock ni dinero | **Nuevo: E5** | SQL + huellas |
| Aislamiento entre negocios y empleados; stock por catálogo (`STOCK_NO_PERMITIDO`); venta sin precio (`PRODUCTO_SIN_PRECIO`); `ETIQUETA_PENDIENTE` del empleado; precio de variante por empleado | **Sólo revisión de código. No se declara probado dinámicamente** | Propuesta técnica §8 |

## 2. Escenarios manuales definitivos

Los pasos exactos están en `INSTRUCCIONES-OPERADOR.md`, que genera la preparación.

| Id | Permisos (casillas) | Acciones | Comprobaciones |
|---|---|---|---|
| E1 | G1: Crear + Editar + Costos, «7 días» | Alta de P1 (simple, costo 400) y P2 (variantes Chico y Grande, sin costo). Edición de P1: categoría y costo 400 → 450 | Sin campo de precio («sin precio»). Precio 0 y `stock=false`. Variantes con precio 0. Sin control de stock y stock 0. Auditorías `producto.creado` ×2 y `producto.modificado` (categoría y costo) del cajero |
| E2 | G2: se quita Costos, con el formulario abierto | Guardar costo 450 → 500 **sin recargar**. Recargar. Marca de P1. Pegar la respuesta de `GET …/catalogo` | 403 del servidor y costo sigue en 450. Tras recargar no hay campo de costo. La respuesta del servidor no trae ningún campo `costo` y trae `costos:false`. La marca se guarda: la casilla restante funciona |
| E3 | G3: Crear + Editar, vence en ahora + 4 min | Antes de vencer: marca de P2. Con el formulario de P1 abierto, esperar el vencimiento y guardar **sin recargar**. «Revocar ahora» | Edición previa OK. 403 posterior al vencimiento auditado. Ningún cambio entre el vencimiento y la revocación. Restauración exacta |
| E4 | G4: Importar + Crear + Editar (sin Precios, Costos ni Proveedores) | CSV de 2 filas: P3 nuevo y P1 existente, con precio, costo y proveedor identificables | Avisos de columnas ignoradas. P3 creado sin precio (no 7777), sin costo (no 3333) y sin proveedor. P1 actualizado sólo en categoría (no 7778 ni 3334). Importación 1 creado / 1 actualizado. Auditoría |
| E5 | Revocar ahora | — | Permisos originales e integridad completa |

## 3. Datos QA exactos (`<e>` = etiqueta de la ejecución, `M` + MMddHHmm UTC)

**Productos nuevos:**
- `QA B5 Producto Nuevo <e>` (P1)
- `QA B5 Producto Variantes <e>` (P2), con las variantes **Chico** y **Grande**
- `QA B5 Producto Importado <e>` (P3)

**Categorías:** `QA B5 Cat Inicial <e>`, `… Cat Editada <e>`, `… Cat Actualizada <e>`, `… Cat Importada <e>` y `… Cat Vencida <e>`. Esta última sólo se intenta y nunca se guarda.

**Marcas:** `QA B5 Marca <e>` (P1) y `QA B5 Marca Variantes <e>` (P2).

**Costos:** 400 → 450. El intento rechazado es de 500.

**CSV `importacion-b5.csv`:**
- Separador «;», UTF-8 con BOM.
- Encabezados `Nombre;Categoría;Precio de venta;Costo;Proveedor`, que la pantalla relaciona sola.
- Fila P3: `7777;3333;QA B1 Proveedor Alfa M11240504`.
- Fila P1: `7778;3334;` con el mismo proveedor.

**Otros datos:**
- Se reutilizan el proveedor Alfa del Bloque 1 (sólo como nombre en el CSV; nunca se asocia), el cajero QA y el turno del dueño, que es de sólo lectura (`cmw2sjtoj002do40aqaq0i1hu`).
- No se tocan los productos QA de los Bloques 1–4.

## 4. Valores esperados al final

| Producto | Precio | `stock` | Costo | Categoría | Marca | Control de stock |
|---|---|---|---|---|---|---|
| P1 | 0 | false | **450** | Cat Actualizada | Marca | no, 0 |
| P2 (Chico 0, Grande 0) | 0 | false | — | Cat Inicial | Marca Variantes | no, 0 |
| P3 | 0 | false | — | Cat Importada | — | no, 0 |

**Permisos:**
- Cuatro otorgamientos o cambios del dueño, cada uno con sus casillas exactas leídas del detalle de auditoría:
  - G1: crear, editar, costos;
  - G2: crear, editar;
  - G3: crear, editar, con vencimiento entre 1 y 10 min;
  - G4: importar, crear, editar.
- Dos revocaciones.
- Orden G1 < G2 < G3 < revocación < G4 < revocación.
- Permisos finales idénticos a la línea base.

**Auditoría del cajero:**
- `producto.creado` ×3: dos de catálogo y una de importación, todas sin precio, P2 con 2 variantes.
- `producto.modificado` ×4:
  - P1 categoría y costo (E1);
  - P1 marca (E2);
  - P2 marca (E3);
  - P1 categoría (E4).
- `catalogo.importacion` ×1, con 1 creado y 1 actualizado.
- Ninguna `producto.precio_cambiado` ni `proveedor.*`.
- Ninguna otra acción del dueño ni del cajero.

**Rechazos HTTP:** exactamente dos 403 `PUT /api/operativo/caja/paola-vinal/catalogo/productos/<P1>`, uno entre G2 y G3 y otro entre el vencimiento de G3 y la revocación. Sin 5xx. Los 401 no relacionados son informativos.

**Integridad:**
- Huellas del resto del catálogo idénticas: productos, variantes y asociaciones.
- Cero movimientos de stock, activaciones, autorizaciones y etiquetas de precio, y ningún costo vigente para P1–P3.
- Cero ventas, cobros, inicios de venta, operaciones y movimientos financieros, salidas, recepciones, obligaciones, créditos, devoluciones y turnos.
- Ventas anteriores y turno del dueño idénticos.

## 5. Archivos preparados (`%USERPROFILE%\deligo-dev-db\certificacion\b5-manual\`, reutilizando `b4-complementaria`)

| Archivo | Función |
|---|---|
| `b5-manual.sql` (SHA `578fde9e…5efd42`) | Consulta de solo lectura: productos P1–P3, variantes, asociaciones, costos vigentes, huellas del resto, stock, precios, importaciones, auditoría (sólo campos técnicos), permisos, dinero y turnos |
| `testing-b5.ps1` | Runner con las mismas protecciones que el Bloque 4: SHA fijado, palabras de escritura prohibidas, sesión `default_transaction_read_only`, URL sólo en memoria, logs enmascarados, sesión con fecha, método, ruta y código, y 4xx no relacionados agrupados |
| `analizar-railway.mjs` | Copia del complementario |
| `nombres-b5.mjs` | Nombres y valores esperados, y el CSV de E4 |
| `instrucciones-b5.mjs` | Precondiciones (exit 3), instrucciones, observaciones E1–E5, el CSV y el archivo vacío de evidencia `evidencias\catalogo-sin-costos.txt` |
| `comparar-b5.mjs` | Comparador: BASE, PERMISOS, E1–E4, GENERAL (E5), LOGS, DESPLIEGUE y OPERADOR |
| `b5-manual-preparar.ps1` / `b5-manual-verificar.ps1` | Preparación (despliegue, línea base y generación de instrucciones) y verificación (SQL final, despliegue, logs, comparación, revisión de credenciales y ZIP con cualquier resultado) |
| `local-sql.ps1` | Sólo validación local de sintaxis |

**Validación local:**
- SQL contra `deligo_dev`, sólo sintaxis.
- Parser de PowerShell y `node --check`.
- Precondición fallida → exit 3.
- Ocho simulaciones del comparador con datos ficticios:
  - recorrido correcto → APROBADO;
  - costo del CSV aplicado → FALLIDO;
  - precio del CSV aplicado → FALLIDO;
  - asociación indebida → FALLIDO;
  - respuesta con «costo» → FALLIDO;
  - evidencia no pegada → INCOMPLETO;
  - sin 403 de E3 → FALLIDO;
  - auditoría extra de precio → FALLIDO.

## 6. Controles del verificador

- Todos los valores de §4.
- **Sesión:** el 401 de `/api/operativo/me` sólo se clasifica con un inicio o cierre de sesión exitoso a ≤ 60 s, como en el Bloque 4.
- **Rechazos:** no hay exclusiones generales de errores HTTP. Cualquier otro 4xx relacionado deja LOGS en INCONCLUSA.
- **Respuesta del servidor (E2):** se exige que el texto pegado contenga P1 y `"costos": false`, y que no tenga ningún campo `"costo"`. Si no se pegó, el resultado es INCONCLUSA; nunca se supone.

## 7. Limitaciones

- Lo que muestra la pantalla es observación del operador: campos ausentes, «sin precio» y avisos de la vista previa. Los registros prueban lo persistido y los rechazos.
- Los 403 se atribuyen por ruta exacta, código y horario. Los logs no guardan cuerpos, así que el mensaje exacto del rechazo es visual.
- La precisión del vencimiento de E3 depende del campo datetime-local, que tiene precisión de minutos. Se usa + 4 min con 1 min de margen, y la hora real sale de la auditoría.
- **Discrepancias:**
  - **D1** (permisos vencidos preseleccionados): **corrección prioritaria antes de Production**, registrada en el ROADMAP. E3 muestra el estado y su restauración.
  - **D2** (catálogo completo visible con cualquier permiso): aceptado por diseño. E2 comprueba que no se exponen costos.
  - **D3–D6:** §8.

## 8. Propuesta técnica consolidada (riesgos sin prueba manual ni automatizada suficiente) — NO implementada

**Cobertura existente revisada en `327d6c73`:**
- No hay pruebas de `catalogo-empleado-service`, `importacion-productos-service` ni de la venta de un producto sin precio.
- Sólo `empleado-identidad.integration.test.ts`, que cubre la lista de permisos aislada entre negocios y la autoría.
- La protección del servidor existe: en `registrarVentaCajaEnTx`, 400 `PRODUCTO_SIN_PRECIO` antes de cualquier escritura.

**Propuesta:** una única suite de integración nueva, `src/lib/f10-c2-catalogo-permisos.integration.test.ts`.
- Mismas guardas que C5: PostgreSQL efímero de CI y datos sintéticos.
- Rutas reales del cajero y del dueño.
- Corre en el workflow focalizado o en la batería general, según lo que se autorice.
- Se incorpora junto con C5 en la próxima tanda autorizada, sin un despliegue dedicado.

**Casos de la suite:**
1. **Aislamiento:** un cajero del negocio A no opera con el slug de B (403) y recibe 404 al editar un producto de B. Otro empleado de A sin permisos no hereda los de su compañero.
2. **Ocultamiento de costos:** `GET …/catalogo` sin «Costos» no trae `costo` en ningún producto; con «Costos», sí.
3. **Independencia:** con cada casilla sola, la operación propia funciona y las demás dan su 403 (`EDITAR_`, `PRECIO_`, `COSTO_`, `PROVEEDORES_`, `IMPORTAR_SIN_PERMISO`). Las combinaciones del Bloque 5 se cubren manualmente.
4. **Vencido y revocado:** 403 `CATALOGO_SIN_PERMISO` y revalidación dentro de la transacción, sin escritura.
5. **Stock:** `PUT` o `POST` con `stockCantidad`, `controlStock`, `stockMinimo` o `eliminado` → 403 `STOCK_NO_PERMITIDO`, sin cambios.
6. **Venta sin precio:** un producto creado por un empleado sin «Precios» → venta 400 `PRODUCTO_SIN_PRECIO`, sin venta, cobro, movimientos ni stock.
7. **Importación:** las columnas sin permiso se ignoran, crear y actualizar exigen «Crear» y «Editar», y un permiso cambiado durante la ejecución deja el grupo sin crear. Sin stock.
8. **`ETIQUETA_PENDIENTE`:** 409 para el empleado con una etiqueta pendiente. Opcional: el precio de una variante.

Nada de esto se implementa ni se pushea sin autorización expresa.

## 9. Comandos del operador

1. Iniciar sesión como **dueño** y como **cajero QA** en el navegador. Después ejecutar la preparación (sólo lectura):
   ```powershell
   powershell -ExecutionPolicy Bypass -File "%USERPROFILE%\deligo-dev-db\certificacion\b5-manual\b5-manual-preparar.ps1"
   ```
2. Seguir `INSTRUCCIONES-OPERADOR.md` (E1–E5), completar `observaciones-operador.md`, cerrar las ventanas sin cerrar sesión y ejecutar:
   ```powershell
   powershell -ExecutionPolicy Bypass -File "%USERPROFILE%\deligo-dev-db\certificacion\b5-manual\b5-manual-verificar.ps1"
   ```

## 10. Ejecución `M11261651` (2026-11-26) — pruebas manuales hechas; falta la verificación interna

**Ejecución:** inicio de las pruebas a las 2026-11-26T16:51:54.700Z, en TESTING `327d6c73`.

**Resultados del operador** (21 OK, 0 FALLA, 0 INCONCLUSA, 0 PENDIENTE): E1 5/5, E2 5/5, E3 6/6, E4 3/3 y E5 2/2. Están registrados en `observaciones-operador.md`.

**Hora de vencimiento de G3:** declarada 14:04 hora de Argentina (17:04 UTC). El verificador la contrasta con la auditoría del servidor.

**Evidencia `evidencias/catalogo-sin-costos.txt`:**
- La capturó el operador y se conserva **sin cambios**: SHA-256 `e113e56f53e5e69861205856547e2d3b90c543bb39a2a5383ee70aaec976a48c`, 4049 bytes.
- Revisión de solo lectura:
  - JSON válido de `GET …/catalogo` con 16 productos;
  - `permisos.costos=false`, con sólo crear y editar;
  - **ningún producto con el campo `costo`**;
  - P1 presente, con su id, la marca de E2 y la categoría de E1.

**Ajustes del verificador antes de correrlo** (sólo agregan controles):
- La hora declarada debe ser igual al vencimiento registrado.
- La categoría «Cat Vencida» no debe haberse persistido.
- La evidencia debe estar ligada al id real de P1 y a la marca editada, con su huella SHA-256 en el informe.
- P3 debe quedar sin marca.

**Validación:** `node --check` y nueve simulaciones con datos ficticios (una hora declarada distinta da FALLIDO).

**Distinción de evidencias:**
- Lo visual: pantallas y mensajes.
- Lo capturado por el operador: la respuesta del catálogo.
- Lo que prueban SQL, auditoría y logs: lo persistido, el actor, los horarios y los 403.
- Lo que sólo se revisó en código (§8) no se declara probado.

**El Bloque 5 no está certificado** hasta revisar el resultado de `b5-manual-verificar.ps1`.

## 11. Verificación `M11261651`: ZIP INCOMPLETO por un 403 adicional — diagnóstico y conciliación exacta (2026-11-26)

**ZIP auditado:** ChatGPT auditó `B5-MANUAL-M11261651-20261126T171507Z-INCOMPLETO.zip`: SHA-256 `2d3b1861…38cd4`, 17 archivos, CRC correcto. Se conservan **los dos** ZIP INCOMPLETO, también `…171304Z…`.
- 9/10 bloques del verificador aprobados.
- 21/21 comprobaciones manuales.
- Los dos SQL finales son idénticos, salvo los intervalos.
- Hay 14 auditorías previstas.
- La evidencia del catálogo sin costos fue revisada directamente.
- Sólo **LOGS** quedó INCONCLUSA.

**Incidencia:** además de los dos 403 previstos (E2 a las 16:56:11.676Z y E3 a las 17:05:02.822Z, `PUT …/catalogo/productos/cmwxslact00abk60aczjryw5r`), los dos logs contienen el registro `2026-11-26T17:05:17.041549756Z GET /api/operativo/caja/paola-vinal/catalogo/productos/cmwxslact00abk60aczjryw5r/proveedores 403`.

**Diagnóstico** (revisión del código de `327d6c73`, coincidente con la de ChatGPT):
- La ficha de edición del cajero monta `ProveedoresDelProducto` con «Editar» o «Proveedores». El panel consulta solo su GET con `useQuery`, y sin reintentos de 4xx: `retry` sólo para respuestas 5xx.
- El `QueryProvider` global tiene `refetchOnWindowFocus: true`, así que al volver a la ventana se repite la consulta.
- `proveedoresProductoEmpleadoHttp` recalcula la vigencia con la hora del servidor. Con el permiso vencido, Editar y Proveedores efectivos son falsos y el GET responde **403 `CATALOGO_SIN_PERMISO`** «Tu permiso para el catálogo no está vigente.» antes de leer los proveedores, sin escribir nada.
- El registro es posterior al vencimiento real (17:04:00.000Z) y anterior a «Revocar ahora» (17:05:46.397Z) y a G4. Es compatible con la ficha de P1, que seguía abierta en E3.13–14.
- **El disparador exacto no está observado**: puede ser el refetch al volver a la ventana, la reapertura de la ficha o «Reintentar». Tampoco el cuerpo de la respuesta.
- **No hay una falla funcional:** el servidor negó una lectura con un permiso vencido, como corresponde.

**Conciliación por registro exacto:**
- El archivo `B5-MANUAL-M11261651\conciliacion-logs.json` es nuevo; no se modificó ninguna evidencia anterior.
- Contiene un único tipo admitido, `PROVEEDORES_TRAS_VENCIMIENTO`, y un solo registro. No hay exclusiones generales de 403 ni de consultas de proveedores.
- El verificador nuevo (bloque **CONCILIACION**) exige:
  - el registro exacto presente: fecha, método GET, ruta y 403;
  - la ruta del panel de proveedores **de P1**, con el id del SQL;
  - el momento posterior al vencimiento de G3 y anterior a la revocación y a G4;
  - ningún efecto: ninguna asociación, ninguna auditoría de proveedores, ningún cambio del cajero entre el vencimiento y la revocación, y ningún POST/DELETE de proveedores;
  - que se mantengan los dos 403 previstos de E2 y E3, que no se concilian y siguen exigidos.
- La compatibilidad con el código queda declarada como **revisión de código**, no como observación dinámica.

**Refuerzo con metadatos de solo lectura** (nuevo en `b5-manual-verificar.ps1`):
- La verificación consulta en los logs las rutas del catálogo del cajero para P1 (`PUT` del producto y `GET/POST/DELETE` de sus proveedores), con fecha, método, ruta, código y bytes. No incluye cuerpos ni identidad.
- Las respuestas de permisos del mismo intervalo pesan exactamente su cuerpo (26 y 27 B, sobrecarga 0).
- Con esa calibración, el tamaño del 403 del GET debe igualar el cuerpo `CATALOGO_SIN_PERMISO` del GET. Los 403 de E2 y E3 deben igualar los suyos: `COSTO_SIN_PERMISO` y el `CATALOGO_SIN_PERMISO` de edición.
- Si el tamaño no está disponible, no bloquea. Si no coincide, sí bloquea.

**Validación local** (sin TESTING):
- Sobre una **copia** de la evidencia real:
  - sin la conciliación, reproduce el INCOMPLETO (LOGS INCONCLUSA);
  - con ella, APROBADO;
  - con bytes compatibles simulados, APROBADO.
- Variantes ficticias:
  - otro 403 inesperado → LOGS INCONCLUSA, INCOMPLETO;
  - tamaño incompatible → FALLIDO;
  - escritura de proveedores → FALLIDO;
  - registro fuera de horario → FALLIDO;
  - registro de otra ruta → FALLIDO.

**Limitaciones:**
- Los logs no guardan cuerpos ni el disparador del navegador.
- El tamaño es un metadato que discrimina el mensaje, pero no es el cuerpo.
- La relación con la ficha abierta es una inferencia por ruta, horario y código.

**Pendiente:** el operador ejecuta `b5-manual-verificar.ps1` (sólo lectura), que genera un ZIP nuevo con cualquier resultado. El Bloque 5 no se certifica hasta revisar ese resultado.

## 12. CIERRE DEFINITIVO — Bloque 5 CERTIFICADO (2026-11-26)

**ZIP definitivo:** `B5-MANUAL-M11261651-20261126T172306Z-APROBADO.zip`, SHA-256 `04cd6c330c2d826e950d185b0ccb2ebaeab360b767e9e7c049d39a5ef7e8228e` (recalculado y coincidente). Lo auditó ChatGPT de forma independiente: 21 archivos con CRC correcto, **21/21 manuales** y **11/11 bloques**.

**ZIP conservados con su resultado histórico (no se reescriben):**
- `B5-MANUAL-M11261651-20261126T171304Z-INCOMPLETO.zip`;
- `B5-MANUAL-M11261651-20261126T171507Z-INCOMPLETO.zip` (`2d3b1861…`).

**Confirmado en los registros:**
- Cuatro otorgamientos o cambios con sus seis casillas exactas, dos revocaciones completas y 14 auditorías previstas.
- Tres productos y dos variantes nuevos:
  - P1: precio 0, costo 450;
  - P2: sin precio ni costo;
  - P3: sin precio, costo ni marca.
- Campos prohibidos de la importación ignorados y ninguna asociación.
- Ningún precio activado, movimiento de stock, venta, cobro, turno ni movimiento financiero.
- Permisos originales restaurados, Caja principal intacta y huellas del catálogo previo y de las ventas anteriores coincidentes.
- Los tres estados finales SQL del ZIP son idénticos, salvo los intervalos.

**Costos:** la respuesta capturada (`catalogo-sin-costos.txt`, `e113e56f…a48c`) tiene 16 productos, ningún campo de costo y `costos=false`, con P1 coincidente.

**Logs:**
- Los tres 403 tienen respaldo en registros y tamaños:
  - E2, 90 B: costo sin permiso;
  - E3, 146 B: edición con el permiso vencido;
  - GET de proveedores, 99 B: lectura con el permiso vencido, conciliada por registro exacto (17:05:17.041549756Z).
- Había GET de proveedores exitosos antes del vencimiento y otro después de G4.
- Cero rechazos adicionales, cero 5xx y cero errores de aplicación.
- **Limitaciones:** los tamaños son metadatos, no cuerpos, y no se conoce el disparador exacto de la consulta.

**Probado dinámicamente:**
- Crear (simple y con variantes), Editar, Costos (registrar, modificar y ocultar) e Importar con permisos parciales.
- Revocación parcial con el formulario abierto e independencia de las casillas.
- Vencimiento automático y rechazo sin renovar la sesión.
- Restauración exacta.

**Sólo revisión de código, NO probado dinámicamente:**
- aislamiento entre negocios;
- stock por rutas del catálogo (`STOCK_NO_PERMITIDO`);
- venta de un producto sin precio (`PRODUCTO_SIN_PRECIO`);
- `ETIQUETA_PENDIENTE` del empleado y precio de una variante por un empleado.

**Pendientes antes de Production** (en el ROADMAP):
- corrección D1;
- la suite técnica consolidada (§8);
- integración permanente de C5;
- los 32 diagnósticos de TypeScript;
- la revisión de los 401;
- las mejoras de UX;
- el CI completo.
