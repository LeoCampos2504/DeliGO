# T2 — seguridad y salud técnica: avance local, NO cerrado

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
