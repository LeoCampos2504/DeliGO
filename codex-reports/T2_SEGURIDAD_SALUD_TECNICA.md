# T2 — seguridad y salud técnica: avance local, NO cerrado

## Actualización al reanudar — 2026-11-26, runs de CI 1–4

- Punto de partida verificado: rama `codex/estabilizacion-final`, HEAD `70d0b2536a418d44e21da9e32b7ce0d6219fa07c`, worktree con las modificaciones de esta continuación y sin cambios staged. Se preservaron los commits existentes.
- P0 etiquetas/precios: se añadió `bloquearPrecioYEtiquetasEnTx`, con bloqueo del producto y variante más un no-op MVCC update en `productos` para hacer visible el punto de serialización bajo PostgreSQL `SERIALIZABLE`. Confirmar, activar sin etiqueta, descartar, aprobación de precios, precio manual del dueño, empleado e importación consultan ese punto. El dueño sigue reemplazando etiquetas; el empleado recibe 409; la importación conserva precio/stock vinculado, permite aplicar otros campos y audita ese resultado. La barrera etiqueta-primero prueba espera real de empleado e importación; precio-primero rechaza la propuesta vieja y acepta la nueva vista. Se amplió el retry F9 a P2034 y P2010/SQLSTATE 40001.
- TypeScript: la medición completa local deja dos errores por clientes Prisma históricos ausentes (`client-sqlite`, `client-postgres`); el workflow genera ambos en la instalación aislada y el typecheck completo de CI aprobó. También quedaron corregidos los siete diagnósticos de código previamente informados, incluido el tipo de suscripción Push.
- Workflow: PostgreSQL 16 efímero; sólo credenciales sintéticas locales al servicio del job (`deligo_test`); `permissions: contents: read`; sin secretos de Railway ni pasos de deploy. El run 1, `45918851134` (`e8a24002`), detectó el predicado incorrecto del sondeo de revocación. El run 2, `45919159203` (`1a6df234`), validó revocación, importación (6/6) y catálogo (3/3), y descubrió P2010/40001 en la carrera. El run 3, `45919595597` (`f3f8b185`), confirmó el comportamiento de empleado/importación y detectó una aserción de stock con baseline incorrecto. El run 4, [`45919963626`](https://github.com/LeoCampos2504/DeliGO/actions/runs/45919963626), validó el código final de T2: **59 comandos de prueba, 805 aprobadas, 0 fallidas, 0 omitidas; PostgreSQL/integración aprobada; TypeScript completo aprobado; build aprobado**.
- Railway: la configuración observada conectora en `amiable-rejoicing` muestra los servicios DeliGO (`DeliGO`, `chat en vivo`, `DeliGO Mesa Occupancy Cron`, `Review Moderation Expiry`) enlazados a `LeoCampos2504/DeliGO@main`. No se encontró un proyecto Testing separado en los proyectos accesibles. Los pushes realizados a la rama de CI no coinciden con el disparador `main` configurado en esos servicios.
- Rama remota: `codex/estabilizacion-final` está publicada en `fd80bad8d19c158a0a56a3f85135b84b71caff8d`, el commit exacto validado por el run 4. `main` (`42ca5005`) y `testing-codex` (`327d6c73`) no se modificaron.
- Revisiones ejecutadas: `t2-importacion-formatos` 3/3; ESLint focalizado exit 0; diff check limpio. El escaneo de credenciales sólo detecta en YAML las URL de PostgreSQL efímero con usuario/clave sintéticos.
- XLSX: no se añadió dependencia ni workaround de happy-dom; la evidencia previa de XLSX sintético conserva su alcance y Microsoft Excel real sigue en T5. D-3, importación integral y PostgreSQL dependen del run remoto; este documento no presenta pruebas escritas como pruebas ejecutadas.
- Estado: **T2 técnicamente aprobada por CI** en `fd80bad8` (run `45919963626`). XLSX guardado desde Microsoft Excel sigue en T5; T1 continúa sin certificación funcional Railway. No iniciar T3.

## Reanudación y medición actual — 2026-11-26

Estado recuperado: rama `codex/estabilizacion-final`, HEAD `2356969316b81c8f9456ac9747093c46992e5ac4`; sin commits posteriores a ese HEAD al reanudar y sin cambios staged. Los cinco commits T2 previos (`a995d894`…`23569693`) se conservaron. Se continuó sobre sus modificaciones locales; no se reinició ni se descartó trabajo. La rama tiene como base certificada `327d6c739a55e2f6b5da89f1ec125a24013eb345`. La continuación quedó en el commit local `04456072` (`test(t2): ampliar concurrencia e importaciones`).

### Avances de esta continuación

- El workflow general invoca la prueba concurrente de permisos T2 en un job con PostgreSQL 16 efímero; las variables `DELIGO_TEST_DATABASE_URL`, `DELIGO_ENVIRONMENT=TESTING` y `DELIGO_EPHEMERAL_TEST_DB=1` están declaradas. No hay paso de despliegue.
- Se agregó una prueba controlada por barreras para que la revocación real se inicie mientras una operación ya sostiene `FOR SHARE`; consulta `pg_stat_activity` hasta observar la espera del `UPDATE` de empleado, libera la operación y comprueba que la siguiente alta es rechazada. Otra barrera cubre revocación confirmada antes de iniciar la transacción de alta. Son pruebas escritas; ambas siguen pendientes de ejecución en PostgreSQL.
- La importación suma casos para 2000/2001 filas, replay con variantes/proveedor sin relaciones ni auditoría duplicadas, conservación de nombre y celdas vacías, actualización exclusiva del costo, protección del stock/precio, ausencia de asientos y rechazo de variantes nuevas sobre producto existente. Escritos, no ejecutados en DB.
- Se actualizaron los contratos estáticos históricos para el estado real del carrito y la ubicación de presentación de variantes; el contrato I3 permite los escritores de creación de catálogo/importación sólo si su stock inicial es cero. R2B-F1 + R2C + I3 pasan juntos: **69/69**.
- Correcciones de tipos sin cambio funcional deliberado: query nullable de mozo y eliminación tipada de la propiedad Leaflet mediante `Reflect.deleteProperty`.

### Matriz vigente: escrito no significa ejecutado

| Área | Estado actual | Pendiente verificable |
|---|---|---|
| Revocación de permisos de catálogo | Transacciones, revocación concurrente/prioritaria y carrera de proveedor tienen pruebas escritas; los mecanismos usan `FOR SHARE` frente a `UPDATE` de empleado. | Ejecutar contra PostgreSQL efímero en CI y revisar todos los seis permisos, revocación parcial/completa y cada tanda de importación. |
| Etiquetas pendientes vs. precio | El bloqueo de fila protege precio activo; el recuento de etiquetas de empleado ocurre fuera de la transacción y el de importación dentro pero puede compartir snapshot Serializable. | **Carrera no resuelta ni certificada.** Hace falta prueba determinista sobre la ruta de aprobación de precios y ruta de catálogo/importación. No declarar protección frente a etiqueta insertada concurrentemente. |
| D-3 / aislamiento y rutas | Hay suites de servicio y pruebas estáticas existentes. | Matriz completa de rutas reales, dos negocios, suplantación de actores, seis permisos, ocultamiento de costos, variantes/historial, etiquetas y no efectos ante rechazo sigue incompleta y no ejecutada. |
| Importación | Idempotencia, 151 grupos, continuaciones y nuevos límites/campos están cubiertos en código de prueba; guard fail-closed en CI. | Nuevas suites DB no ejecutadas. Falta completar conflictos de identificación, asociaciones/precios/auditorías con casos concurrentes y protección de etiquetas con rutas reales. |
| XLSX | CSV y formatos: 3/3 ejecutados previamente. | Sin parser XML estándar/buscador XLSX ni navegador de automatización disponible en dependencias existentes; happy-dom no implementa correctamente `getElementsByTagNameNS("*", ...)`. No se tocó el importador ni se añadió un mock. XLSX sintético queda pendiente de CI con navegador/XML compatible; archivo guardado por Excel real queda en T5. |
| TypeScript | Medición completa de continuación: **9 diagnósticos** (2 clientes Prisma históricos no generados, 2 mozo, 2 estado de prompt de notificaciones, 1 callback de promocionados y 1 suscripción Push potencialmente nula; mapas ya corregidos). | No se modificaron GPS, notificaciones, destacado ni la lógica de mozo para silenciar errores ajenos a T2. Los clientes históricos requieren generación aislada; no se generaron ni se tocó `node_modules` compartido. Typecheck no aprobado. |
| CI | Tests focalizados estáticos y ESLint corren; workflow está configurado para PostgreSQL 16 efímero, typecheck y suites declaradas. | CI remoto no ejecutado; nuevas suites de DB, XLSX y todo el workflow siguen pendientes. |

### Controles realizados al reanudar

- `bun --no-env-file test` sobre `category-filter-operational-static-contract`, `product-variants-static-contract` e `I3 wiring`: **69 pass / 0 fail** (225 expect calls).
- ESLint focalizado sobre los archivos modificados, incluida la nueva prueba concurrente: **exit 0**.
- `git diff --check`: sin errores.
- Typecheck completo: sigue fallando con los 9 diagnósticos enumerados; no se presenta como aprobado.
- No se ejecutaron suites que requieren DB, XLSX en happy-dom, pruebas funcionales manuales, CI remoto, migraciones ni conexiones a bases persistentes.

### Dictamen

T2 está **en curso**, no cerrada ni lista para push de validación todavía: quedan incompleta la carrera de etiquetas, huecos D-3, XLSX sintético y typecheck global. La propuesta para cuando esos bloqueos estén resueltos será el push ordinario exclusivo `git push origin codex/estabilizacion-final:refs/heads/codex/estabilizacion-final` (sin tags ni otras ramas); no se ejecutó. El CI no despliega y sólo usa el servicio PostgreSQL efímero declarado en el workflow.

Base de trabajo: `codex/estabilizacion-final`, HEAD inicial `392d920a`, base certificada `327d6c739a55e2f6b5da89f1ec125a24013eb345`. Sin push, CI remoto, despliegue, migraciones, ni uso de bases reales. T1 sigue implementada localmente, sin certificar. T2 está incompleta; no iniciar T3 hasta cerrar sus controles.

## Cambios locales
- `a995d894`: C5 histórico incorporado al CI general; sus aserciones no cambian. El guard exige la declaración de base efímera en vez de omitir silenciosamente. No ejecutado en este trabajo.
- `84a29bf4`: revalidación de permisos en alta/edición del catálogo con bloqueo de empleado frente a revocación; pruebas de catálogo y de importación, y typecheck completo añadido al workflow. Integración PostgreSQL no ejecutada.
- `8f02a377`: correcciones de tipos en seed, auth, Caja, tests y otros componentes; no se tocaron las decisiones financieras.
- `f63c8365`: revocación del permiso de proveedores en altas por importación revalidada por grupo; prueba de venta sin precio y actualización de contratos F10-B1/F9.
- `a2306f47`: revalidación transaccional en asociación/desasociación de proveedores y pruebas adicionales; pendientes de ejecución en PostgreSQL.

## Matriz de cobertura (escrito ≠ ejecutado)
| Riesgo | Evidencia existente / nueva | Estado y faltante |
|---|---|---|
| Aislamiento | F10-B1 integración existente; `t2-catalogo` y `t2-importacion` | Nuevas pruebas de producto, variante, permiso y estado de importación escritas; falta rutas reales, proveedores y efectos completos en ambos negocios; no ejecutadas. |
| Sesión y seis permisos | F10-B1 ruta e identidad; `t2-catalogo` | Revocación parcial, vencimiento y ventana entre lectura/transacción escritas; falta matriz completa, suplantación y revocaciones verdaderamente concurrentes. |
| Costos, stock, variantes | `t2-catalogo` y F10-B1 | Ocultamiento, rechazo de costo y stock, variante ajena, preservación y permiso de precio escritos; faltan control positivo de precio, historial y cobertura exhaustiva de rutas. No ejecutadas en PostgreSQL. |
| Sin precio | `t2-venta-sin-precio` | Ruta real y control positivo escritos; no ejecutados. |
| Etiquetas | Certificación histórica del bloque 4 | Faltan pruebas técnicas nuevas para empleado, dueño e importación y carreras de etiqueta. |
| Importación: idempotencia/concurrencia | `t2-importacion` | Promise.all simultáneo, replay, auditorías, aislamiento y no duplicación del producto escritos; replay con variantes y asociaciones escrito; faltan activaciones y evaluación real en CI. |
| Importación: tandas | `t2-importacion` | 151 grupos atraviesan límite de 150, continuación escrita; no ejecutada. |
| Importación: identidad/límites | `t2-importacion`, `t2-importacion-formatos` | Casos de nombres/códigos repetidos y 2001 filas escritos, sin ejecutar en DB; formatos argentinos, CSV y rechazo >5 MB: 3/3 ejecutados localmente. Faltan frontera 2000, XLSX y más conflictos. |
| Importación: integridad | Código y certificación histórica | Faltan pruebas técnicas completas de etiquetas, campos vacíos, nombre, variantes, costos y ausencia de efectos. Microsoft Excel real sigue en T5. |

La revisión encontró una ventana en asociaciones de proveedores del empleado: se agregó revalidación con bloqueo dentro de la transacción de asociación/desasociación y una prueba escrita de rechazo, pendiente de ejecución; falta comprobar el orden real frente a revocación concurrente. También verificar la carrera entre etiqueta pendiente y escritura de precio: la comprobación del catálogo ocurre fuera de la transacción; no declarar protección concurrente completa.

## Controles ejecutados
- TypeScript completo inicial: 40 diagnósticos. Última medición completa antes de los cambios más recientes: 12 (28 corregidos); no es un typecheck aprobado. Los restantes: 2 imports de clientes Prisma históricos no generados; 4 mozo; 2 mapas; 2 prompt de notificaciones; 1 destacado; 1 push; y el resultado más reciente debe verificarse de nuevo tras los tests añadidos. Los módulos mozo, notificaciones, destacado y GPS requieren respetar la exclusión de T3/GPS. No se modificó node_modules compartido. El workflow ahora exige typecheck completo y fallará mientras existan diagnósticos.
- ESLint focalizado sobre código y tests nuevos revisados: sin errores en las ejecuciones realizadas. `git diff --check` sin errores, con avisos de CRLF.
- Formatos: 3/3, 15 comprobaciones. Un intento de XLSX sintético falló en happy-dom por soporte incompleto de `getElementsByTagNameNS('*', ...)`; un segundo intento de adaptar el entorno también falló. Se retiró ese ensayo, sin afirmar comportamiento de navegador ni certificación Excel.
- `f10-b1-static-contract`: 13/13 tras corregir la expectativa obsoleta de total de auditoría del servidor. `f9-barcode-static-contract`: 20/20 tras reconocer el inicio de venta y el lector de recepciones. Primera ejecución simultánea con tsc tuvo un timeout; la segunda pasó. `stock-lifecycle-i3.test.ts`: 32/32, pero no identifica por sí solo el contrato estático I3 histórico fallido.
- Los seis fallos históricos documentados se repartían en F10-B1, F9 ×2, I3, R2B-F1 y R2C; los tres primeros quedaron abordados como arriba. Identificar y diagnosticar los otros tres. Los ocho CRLF y los diez de una revisión previa corresponden a subconjuntos/baterías históricas distintas: no se han reconciliado caso por caso aquí.

## Continuación necesaria
1. Terminar pruebas D-3 con rutas reales y PostgreSQL aislado, especialmente los huecos de la matriz, revocaciones concurrentes y protección de etiquetas. Verificar la corrección de revocación y resolver la ventana de etiquetas señalada.
2. Completar formatos XLSX y fronteras, idempotencia completa, asociaciones, conflictos y etiquetas sin reemplazar la evidencia de Excel real de T5.
3. Resolver o documentar cada diagnóstico restante sin ocultarlo; generar clientes históricos sólo en un entorno aislado y sin modificar la unión compartida. Ejecutar typecheck completo y ESLint focalizado.
4. Diagnosticar los fallos históricos restantes y conservar las aserciones. Verificar CI como configuración; CI remoto requiere autorización posterior y puede fallar actualmente.
5. Cerrar T2 solamente con cobertura completa y verificación correspondiente. Después, T3: identidad explícita en cierre de mesa, cancelaciones, notificaciones y destacado, y reducir consultas 401 sin sesión, sin fallback ambiguo.

La contradicción `deligo-closeout` §B / `DELIGO_FULL_CONTEXT_LATEST.md` versionado sigue pendiente; no modificar el skill. En la copia original el inventario histórico documenta 460 informes sin seguimiento, de los cuales 13 eran idénticos a archivos de testing y 447 nunca versionados; no se hizo una nueva auditoría ni se tocó esa copia.
