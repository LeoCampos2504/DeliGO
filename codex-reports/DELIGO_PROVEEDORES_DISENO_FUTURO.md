# DeliGO Proveedores — plataforma B2B distribuidoras ↔ comercios · DISEÑO FUTURO

Estado: `DELIGO_PROVEEDORES_STATUS=PLANNED · FUTURE_EXPANSION · NOT_STARTED` · definido comercial y funcionalmente por el
operador (2026-11-20). **No pertenece al desarrollo inmediato.** No existen ni se deben crear todavía modelos, rutas,
migraciones, interfaces ni servicios de este proyecto. Este documento reúne decisiones de producto para retomarlas cuando
se autorice; las fases son orientativas y pueden reorganizarse. Ubicación en el roadmap:
`codex-reports/ROADMAP.md` → sección «FUTURE EXPANSION — DeliGO Proveedores».

## 1. Objetivo

Plataforma web B2B que conecte **distribuidoras medianas** con **comercios**, para reducir la dependencia de las visitas
de preventistas al hacer pedidos, sin eliminar la atención presencial.

**Problema real:**
- El preventista visita una vez por semana con una lista o carpeta de precios, toma el pedido y se retira.
- Si el comerciante olvida un producto, debe llamar a la distribuidora o esperar la próxima visita.

DeliGO permitiría consultar el catálogo y pedir desde el celular o la computadora cuando el comerciante quiera,
respetando los horarios de recepción y entrega del proveedor.

## 2. Mercado inicial

Distribuidoras medianas de **Libertador General San Martín, Calilegua y localidades cercanas de Jujuy**. Normalmente:
- tienen clientes comerciales registrados y usan preventistas;
- manejan listas de precios y reparten con rutas propias;
- incorporan comercios nuevos enviando un representante que registra los datos y puede tomar el primer pedido.

No se diseña inicialmente para grandes cadenas nacionales ni logística compleja.

## 3. Estrategia de lanzamiento

- **Primero consolidar DeliGO Negocios.** Meta comercial orientativa (no condición rígida): **unos 20 comercios
  asociados**, preferentemente activos, antes de ofrecer DeliGO Proveedores a las distribuidoras.
- Presentación prevista: «Ya tenemos aproximadamente 20 comercios de la zona utilizando DeliGO. Queremos que puedan
  hacerte pedidos directamente desde nuestra plataforma, manteniendo también la atención de tus preventistas».
- La propuesta es más atractiva con compradores potenciales desde el lanzamiento.
- **No desarrollar DeliGO Proveedores antes de una validación comercial suficiente** (§13).

## 4. Acceso de los comercios

- Página web **responsive**, sin app obligatoria.
- Un comercio puede acceder **gratis** a los pedidos B2B aunque no contrate la suscripción completa de DeliGO Negocios.
- Los comercios que usan DeliGO Negocios tienen **integración directa** con su módulo de compras (§10).
- Cuentas y permisos seguros; aislamiento estricto de datos entre negocios y entre distribuidoras.

## 5. Red privada de proveedores y clientes

Cada distribuidora podrá:
- registrar o importar su cartera de clientes habituales;
- vincular comercios que ya usan DeliGO;
- asignarles un preventista responsable;
- habilitarles catálogos y listas de precios;
- definir condiciones comerciales;
- autorizar o rechazar solicitudes de clientes nuevos.

Un comercio que todavía no es cliente puede encontrar una distribuidora participante y **solicitar acceso**; la
distribuidora puede enviar un preventista para verificar los datos y tomar el primer pedido. **Nunca se muestran precios
privados a comercios no autorizados.**

## 6. Catálogo y precios

Cada distribuidora administra:
- productos y presentaciones;
- unidades, cajas y bultos;
- precios comerciales y listas por cliente o grupo;
- descuentos y promociones;
- cantidades mínimas y monto mínimo de compra;
- disponibilidad, sólo cuando haya información confiable;
- condiciones de pago;
- zonas y días de reparto.

Los comercios podrán **comparar proveedores habilitados** con un precio comparable: presentación, IVA, descuentos,
entrega y mínimo de compra. **No se asume** que un proveedor ofrece el mismo precio a todos sus clientes.

## 7. Dos modalidades de pedido

- **A. Pedido directo:**
  1. el comercio entra a DeliGO y consulta productos y precios;
  2. crea el pedido y lo envía al proveedor;
  3. sigue el estado y la entrega estimada.
- **B. Pedido asistido:**
  1. el preventista visita el negocio y carga los productos desde DeliGO;
  2. el comercio revisa y confirma;
  3. el pedido entra al mismo circuito del proveedor.

Los preventistas siguen siendo parte del proceso comercial: DeliGO facilita su trabajo, no los elimina. La distribuidora
mantiene la relación preventista ↔ cliente aunque el cliente pida de forma digital.

## 8. Pedidos complementarios

- El comercio puede pedir **agregar productos a un pedido existente** mientras la distribuidora acepte modificaciones.
- La distribuidora fija los **horarios límite** de modificación según sus procesos y rutas.
- Si el pedido ya está cerrado o preparado para despacho, el sistema puede ofrecer crear otro pedido.
- Las modificaciones son visibles y confirmadas por el proveedor; **nunca** se altera en silencio un pedido aceptado.

## 9. Estados y entrega

- **Estados previstos:** Enviado · Recibido por la distribuidora · Aceptado · En preparación · Preparado · Despachado ·
  Entregado · Rechazado o cancelado.
- La fecha estimada de entrega se muestra sólo cuando la informa la distribuidora. No se inventan tiempos ni se
  garantiza disponibilidad sin confirmación.
- **Versiones avanzadas:** agrupación de pedidos por zona, ruta y vehículo.

## 10. Integración con DeliGO Negocios (diferencial principal)

Un pedido digital de un comercio que usa DeliGO Negocios se integra con su **módulo de compras**. Cuando llega la
mercadería:
1. el empleado abre el pedido existente;
2. registra cantidades recibidas, faltantes y daños;
3. completa los costos reales e impuestos de la factura;
4. envía la recepción;
5. el dueño aprueba;
6. DeliGO actualiza stock, costos, obligaciones y propuestas de precio de venta con las reglas ya desarrolladas (F10-C2,
   F5, etiquetas de góndola).

- Evitar registrar dos veces el mismo pedido.
- Respetar aislamiento de datos, permisos, auditoría, F5, F10-C y la autoridad única de stock R3A.

## 11. Monetización futura

- DeliGO Negocios mantiene su propuesta de **ARS 10.000 mensuales**, **sin** trasladar automáticamente ese precio a
  los proveedores.
- **Modelo freemium a evaluar para proveedores:**

| Plan | Incluye |
|---|---|
| Proveedor Básico — gratis | Catálogo básico, clientes habilitados, recepción de pedidos, estados básicos |
| Proveedor Pro — suscripción | Varios preventistas, listas de precios específicas, estadísticas, historial y herramientas avanzadas, gestión comercial de cartera |
| Proveedor Distribución — suscripción superior | Rutas y zonas, organización de entregas, repartidores o vehículos, funciones avanzadas y posibles integraciones |

- **Precios definitivos: NO decididos.**
- Explorar más adelante una tarifa por **captación de clientes nuevos efectivamente conseguidos por DeliGO**,
  diferenciándolos de los clientes históricos de la distribuidora.
- **No** cobrar inicialmente comisión por todos los pedidos de clientes habituales.
- **No** procesar al inicio pagos bancarios de compras entre negocios y distribuidoras. Los pagos siguen por los medios
  habituales y DeliGO registra la información correspondiente.

## 12. Desarrollo por etapas (orientativo)

1. Validación comercial con negocios y distribuidoras.
2. MVP de catálogos privados y pedidos directos.
3. Preventistas y pedidos asistidos.
4. Seguimiento de preparación y entrega.
5. Comparación entre proveedores autorizados.
6. Integración completa con DeliGO Negocios.
7. Funciones premium comerciales y logísticas.

Cada etapa necesitará su propia auditoría, diseño, autorización y validación.

## 13. Indicadores para decidir el lanzamiento

- Comercios asociados y activos.
- Comercios interesados en pedir a proveedores.
- Distribuidoras dispuestas a participar.
- Pedidos mensuales potenciales.
- Frecuencia de visitas de preventistas.
- Tiempo administrativo ahorrado.
- Interés real en suscripciones premium.

**No dar por validada la rentabilidad sin medir estos indicadores.**

## 14. Relación con el desarrollo actual

- No modifica ninguna decisión de DeliGO Negocios, de la plataforma de clientes ni del modelo comercial vigente.
- El rediseño de pagos a proveedores de DeliGO Negocios (`F10_C2_F5_COMPRAS_RECEPCION_DISENO.md` §16) es independiente
  y anterior; el registro de pagos a distribuidoras previsto en §11 se apoyaría en él.
- Sin código, base, migraciones, rutas, interfaces ni servicios creados para este proyecto.
