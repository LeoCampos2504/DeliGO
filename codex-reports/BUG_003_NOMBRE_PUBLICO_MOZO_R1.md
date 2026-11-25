# BUG-003 — «Tu mozo: Pendiente de vinculación» en la vista pública de la mesa — diagnóstico y propuesta R1

Fecha: 2026-11-25 · Estado: **DIAGNOSTICADO, PROPUESTA PARA REVISIÓN (sin implementar, sin push, sin despliegue)**.
Hallado por el operador en Railway TESTING (`1c68007f`) al abrir el QR/enlace de la Mesa 1 de `paola-vinal`.
Contexto: la superficie pública quedó fuera de BUG-001 a propósito (privacidad). Production sin cambios.

## 1. Dónde está

- **Componente:** `src/app/n/[slug]/page.tsx:846-849` — muestra `Tu mozo: ${customerMesaData.mozoAsignado.nombre}`;
  si no hay `mozoAsignado`, muestra «Tu pedido será servido en esta mesa». Datos: `useQuery` en `:284-304`, que consulta
  `GET /api/negocio/mesas-public?slug=<slug>` y toma la mesa por número.
- **Endpoint:** `src/app/api/negocio/mesas-public/route.ts:30-55` — devuelve TODAS las mesas activas del negocio con
  `mozoAsignado: { nombre: Empleado.nombre, codigo: Empleado.codigo }`, crudo. Para un mozo vinculado creado sin nombre,
  `Empleado.nombre` es el marcador «Pendiente de vinculación» (diseño P2-T43-R2; BUG-001 no tocó esta ruta).

## 2. Causa raíz y alcance real

1. **Nombre:** el endpoint publica `Empleado.nombre` sin distinguir el marcador → «Tu mozo: Pendiente de vinculación».
2. **Quién lo ve (verificado en TESTING, consulta anónima de sólo lectura):** `GET /api/negocio/mesas-public?slug=paola-vinal`
   sin cookies → **401** «Se requiere autenticación de negocio». El proxy protege todo `/api/negocio/*` con sesión de dueño
   y `mesas-public` no figura en las rutas públicas. Un **cliente real (anónimo) nunca recibe el nombre del mozo**: ve
   «Tu pedido será servido en esta mesa». El operador lo vio porque su navegador tenía una sesión de dueño abierta.
3. **Aislamiento (hallazgo asociado):** el handler no valida la sesión: el proxy deja pasar CUALQUIER sesión de dueño, así
   que el dueño de un negocio puede leer, por `slug`, las mesas de otro negocio con nombre y **código interno** de sus mozos.
4. **Exposición del código interno:** `mozoAsignado.codigo` (código del empleado, el mismo que usa
   `/api/empleados/by-codigo`) viaja en la respuesta aunque la página no lo usa.
5. Misma familia, otra superficie pública: `GET /api/empleados/by-codigo` (sin protección de proxy) → página `/mozo/[slug]`
   (`src/app/mozo/[slug]/page.tsx:264`) muestra `{mozo.nombre}`: también mostraría «Pendiente de vinculación».
- No hay impacto en datos, vínculos, permisos ni historial: todo es lectura y presentación.

## 3. Propuesta de corrección mínima (para revisión)

**Regla de nombre público («nombre de atención»):** sólo el nombre que el NEGOCIO cargó para el empleado
(`Empleado.nombre`), recortado, si no está vacío y no es el marcador. **Nunca** `CuentaOperativa.nombre` ni otro dato de
la cuenta (es información personal de la persona, no del negocio). Si no hay nombre apropiado → **se oculta** el campo.
Helper nuevo en `src/lib/empleado-identidad.ts`: `nombreAtencionPublico(empleado) → string | null` (documentado como la
ÚNICA regla para superficies públicas).

Cambios propuestos (sin migraciones, sin escrituras, sin tocar vínculos ni históricos):
1. `mesas-public/route.ts`: `mozoAsignado = nombreAtencionPublico(m.empleado) ? { nombre } : null` (**sin `codigo`**).
2. `mesas-public/route.ts` — aislamiento: exigir que la sesión de dueño sea del negocio del `slug` (404 genérico si no).
   Mantiene el comportamiento actual para clientes anónimos (401 del proxy) y para la vista previa del propio dueño.
3. `n/[slug]/page.tsx`: defensa en el cliente — mostrar «Tu mozo: X» sólo si X es un texto no vacío distinto del
   marcador; si no, el texto existente «Tu pedido será servido en esta mesa» (sin estilos ni flujos nuevos).
4. (misma regla, opcional en este lote) `by-codigo`: devolver `nombre: nombreAtencionPublico(...)` (o `null`) y que
   `/mozo/[slug]` oculte el nombre si es `null`; el resto de la respuesta sin cambios.

**Decisiones para el operador/ChatGPT:**
- (a) ¿Incluir el punto 4 (`by-codigo` / `/mozo/[slug]`) en BUG-003 o dejarlo registrado aparte? Recomendado: incluirlo
  (misma regla, mismo marcador visible).
- (b) Comportamiento de producto: hoy `mesas-public` NO es público pese a su comentario («PUBLIC endpoint … customers»), por
  lo que los clientes nunca ven el nombre del mozo. Hacerlo realmente público (agregarlo a las rutas públicas del proxy) es
  una decisión aparte de privacidad/producto; esta propuesta **no** lo cambia.
- (c) Retirar `codigo` de la respuesta (recomendado; la página no lo usa).

## 4. Pruebas propuestas (mínimas)

- Unidad `nombreAtencionPublico`: marcador → null; vacío/espacios → null; nombre real → nombre; nunca el de la cuenta.
- Ruta `mesas-public`: mozo vinculado con marcador → `mozoAsignado: null`; con nombre cargado → `{ nombre }` sin `codigo`;
  sesión de dueño de otro negocio → 404; sin sesión → 401 (proxy, sin cambios).
- TESTING (operador, sólo lo afectado): abrir el QR/enlace de la Mesa 1 de `paola-vinal` con la sesión de dueño abierta →
  «Tu pedido será servido en esta mesa» (o el nombre cargado por el negocio, si lo tiene).

Riesgo: bajo-medio (presentación pública + un control de aislamiento en una ruta de lectura). Sin migraciones.

---

# R2 — Implementación local (2026-11-25): BUG-003A (presentación) y BUG-003B (aislamiento y privacidad)

Autorizado por el operador tras la revisión de ChatGPT. Local en `deligo-dev-local` (rama `codex/fix-identidad-ocupacion`,
sobre `1c68007f`), **sin commit, push ni despliegue**. Sin migraciones, sin cambios de esquema, permisos, vínculos,
geolocalización ni históricos.

## Causa raíz confirmada (código + TESTING)

- **003A:** `mesas-public` devolvía `Empleado.nombre` crudo (marcador para mozos vinculados) y `n/[slug]` lo mostraba.
- **003B aislamiento:** `GET /api/negocio/mesas-public` no validaba la sesión. El proxy sólo exige *alguna* sesión de dueño
  para `/api/negocio/*`, así que el dueño de un negocio podía leer, por `slug`, las mesas de OTRO negocio con nombre y código
  interno de sus mozos (y distinguir si tenía el Salón activo). Para clientes anónimos la ruta ya respondía 401 (verificado
  en TESTING), por lo que un cliente real nunca recibió esos datos.
- **003B privacidad:** el `codigo` interno del mozo viajaba en `mesas-public` sin consumidores; `by-codigo` (pública por
  diseño) devolvía `nombre`.

## Cambios

| Archivo | Cambio |
|---|---|
| `src/app/api/negocio/mesas-public/route.ts` | valida en el servidor la sesión de dueño y que sea la del negocio del `slug` (otro negocio o slug inexistente → mismo 404 sin datos, antes de revelar el estado del Salón); no consulta ni devuelve datos de empleados; `mozoAsignado` siempre `null` |
| `src/app/api/empleados/by-codigo/route.ts` | deja de devolver `nombre` e `id` del empleado (sin consumidores); sigue validando que el código sea de un mozo activo de ESE negocio |
| `src/app/n/[slug]/page.tsx` | muestra «Tu mozo: X» sólo si X es un nombre público válido (`nombrePublicoMostrable`); si no, «Tu pedido será servido en esta mesa» |
| `src/app/mozo/[slug]/page.tsx` | encabezado «Mozo (CÓDIGO)» en lugar del nombre; el flujo de escaneo y la navegación no cambian |
| `src/lib/empleado-identidad.ts` | `nombrePublicoMostrable()`: el marcador, vacíos y no-textos nunca se muestran al cliente |
| `src/lib/bug003-superficies-publicas.integration.test.ts` | prueba nueva (aislamiento y privacidad) |
| `.github/workflows/f10-b2-2-e-testing.yml` | paso de CI para la prueba nueva |

**Presentación:** el modelo no tiene un nombre de atención destinado al público y `Empleado.nombre` no se asume público
(puede ser el marcador o un nombre heredado). Por eso las rutas públicas no envían nombres de empleados y la vista muestra el
texto actual. Nunca se usan datos de `CuentaOperativa`.

## Datos que deja de exponer cada endpoint

- `mesas-public`: a dueños de OTROS negocios, todo (mesas, nombres, zonas, capacidades, mozos, estado del Salón) → 404
  idéntico a un slug inexistente. Al propio dueño: `codigo` interno y `nombre` del mozo asignado.
- `by-codigo`: `nombre` e `id` interno del empleado. Sigue devolviendo `codigo` (el mismo que recibe), `rol`, `activo`.
- Ninguno expone (ni exponía) correos, ids o nombres de cuentas operativas ni datos de vinculación.

## Pruebas automatizadas (sólo las necesarias)

`bug003-superficies-publicas.integration.test.ts` (PostgreSQL efímero): unidad de `nombrePublicoMostrable`; dueño propio
200; dueño de otro negocio 404 idéntico al de un slug inexistente y sin datos; sin sesión de dueño / sesión operativa 401;
`mesas-public` sin marcador, nombres, códigos, ids de empleados ni datos de la cuenta; `by-codigo` 200 con las claves
`activo, codigo, rol` sin nombre, id ni datos de cuenta, y 404 con el código de otro negocio. Local: 4/4 + la prueba
existente `negocio/empleados/route.test.ts` (usa `by-codigo`) 4/4; contratos estáticos de Salón, transición de mesa y
registro seguro de errores 56/56. Typecheck: 40 errores (línea base 41: desaparece el de `mozo.nombre`; ninguno nuevo).

## Riesgos pendientes

- ~~`by-codigo` devolvía el `id` del empleado~~ — retirado antes del commit (revisión de ChatGPT): ningún consumidor lo
  usaba; `negocio/empleados/route.test.ts` ahora comprueba `{ codigo, rol, activo }` del mozo activo con el código reutilizado.
- `by-codigo` sigue siendo pública (diseño original del escaneo): permite confirmar si un código existe en un negocio
  (con rate limiting). Sin cambios.
- La vista previa del dueño y la página del mozo ya no muestran nombres (cambio visible buscado).
- `mesas-public` conserva su nombre engañoso (no es pública); se documentó en la ruta.

## Propuesta futura (NO implementada) — nombre para el cliente real

Si el operador quiere que el cliente vea quién lo atiende: (1) un campo de «nombre de atención» definido por el dueño para
cada empleado, opcional y explícitamente público (requiere migración: otro lote); (2) exponerlo sólo en una superficie
limitada a la mesa del cliente, validada con su credencial de ocupación/QR (la misma que ya usa el pedido de mesa), nunca
listando todas las mesas ni empleados del negocio; (3) sin ese campo, se mantiene «Tu pedido será servido en esta mesa».

## Comprobación en TESTING (cuando se autorice el despliegue)

1. Con la sesión de dueño de `paola-vinal` abierta, abrir el QR/enlace de la Mesa 1 (`/n/paola-vinal?mesa=1`): debe decir
   «Tu pedido será servido en esta mesa».
2. Ventana privada (sin sesión): `…/api/negocio/mesas-public?slug=paola-vinal` → 401 (igual que antes).
3. Si tenés el dueño de otro negocio: con esa sesión, la misma URL → 404 `{"error":"Negocio no encontrado"}`.
4. Página de escaneo del mozo `/mozo/paola-vinal?mozo=<CÓDIGO>`: encabezado «Mozo (CÓDIGO)» y el escaneo/ingreso de mesa
   sigue llevando a la mesa.
