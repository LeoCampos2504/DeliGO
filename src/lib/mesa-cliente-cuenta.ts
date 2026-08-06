import { db } from "@/lib/db"
import { hashMesaOccupancyToken } from "@/lib/mesa-occupancy"
import { buildCuentaMesa, type CuentaPedidoInput, type CuentaMesaResult } from "@/lib/mesa-cuenta"

// ============================================
// DeliGO — Cuenta pública de mesa para el cliente (23-B, corregido en 23-B-CORRECCIÓN-1)
// ============================================
// Lectura de solo lectura de la cuenta de la ocupación activa de una mesa,
// autorizada EXCLUSIVAMENTE por la credencial de dispositivo ya emitida por
// el flujo existente P0-D (src/lib/mesa-occupancy.ts, cookie
// `deligo_mesa_occupancy`, token opaco de 32 bytes, solo hash persistido).
// 23-B no crea ningún modelo Prisma nuevo ni un mecanismo de sesión
// paralelo — reutiliza `CredencialOcupacionMesa`/`SesionOcupacionMesa` tal
// como ya los usa `resolveMesaOccupancyForOrder` para autorizar
// POST /api/pedidos, con la MISMA cadena de validación (credencial no
// revocada -> ocupación activa de ese negocio/mesa -> mesa cuyo puntero
// "actual" siga siendo exactamente esa ocupación).
//
// ---------------------------------------------------------------------------
// 23-B-CORRECCIÓN-1: eliminación del TOCTOU entre autorización y lectura
// ---------------------------------------------------------------------------
// La versión original de 23-B exponía `resolveMesaClienteCuentaAccess` y
// `loadMesaCuentaPublica` como dos operaciones separadas, llamadas en
// secuencia desde la ruta. Entre la autorización y la lectura de pedidos
// podía cerrarse, reabrirse o expirar la ocupación (o revocarse la
// credencial) sin que la respuesta lo reflejara — un TOCTOU real.
//
// Estrategia elegida ("Opción C" del prompt de corrección — validación
// inicial + carga + revalidación final, descartando todo si el estado
// cambió) en vez de envolver todo en una única transacción con aislamiento
// `RepeatableRead`: una transacción `RepeatableRead` fija su snapshot en la
// PRIMERA consulta y jamás observa cambios posteriores mientras dura la
// transacción — es perfecta para el caso "la lectura completa gana antes
// del cierre" (ver más abajo), pero NO permite "detectar" un cierre que
// ocurra DESPUÉS de esa primera consulta pero ANTES de terminar de
// responder (exactamente el caso 3 exigido por el prompt de corrección:
// "cierre entre validación y carga" debe detectarse y NUNCA devolver
// cuenta activa). Por eso el punto de linealización real de esta función
// es la REVALIDACIÓN FINAL (`validarAccesoActual`, ejecutada de nuevo
// justo antes de construir la respuesta, con lecturas frescas — nunca las
// mismas filas ya leídas antes) — no la primera validación ni ningún
// snapshot fijo. Si cualquier condición cambió entre la primera validación
// y la revalidación final, se descarta TODO lo cargado (incluida la cuenta
// ya calculada) y se responde como si nunca se hubiera autorizado.
//
// Dentro de una misma llamada a `pedido.findMany`, `estado` y `total` de
// una fila SIEMPRE se leen juntos en la misma consulta — Postgres nunca
// puede devolver el `estado` de una versión de fila y el `total` de otra
// para la MISMA fila en una misma consulta (consistencia de fila por
// MVCC) — así que nunca hay una mezcla parcial entre columnas de un mismo
// pedido, incluso si una cancelación concurrente ocurre justo antes o
// después de esa consulta puntual.
//
// Fail-closed y sin fuga cross-tenant: `negocioId`/`mesaId` SIEMPRE llegan
// ya resueltos server-side (por slug + número de mesa, igual que
// POST /api/public/mesa-geofence) — nunca se acepta ninguno de los dos como
// autoridad desde el cliente. Una credencial que pertenece a OTRA
// mesa/negocio nunca lo revela: colapsa al mismo "sin_sesion" genérico que
// una cookie ausente o manipulada. Solo se distingue "cerrada" cuando la
// credencial SÍ pertenece a la mesa/negocio ya resueltos públicamente (el
// cliente ya los conoce por el QR que está mirando) — no es una fuga, es
// información sobre su propia sesión.

export type MesaClienteCuentaResultado =
  // El campo `cuenta` solo existe en la variante "activa" — a nivel de
  // tipos, "cerrada"/"sin_sesion" nunca pueden llevar datos de cuenta
  // adjuntos (criterios de aceptación 15/16 de la corrección).
  | { status: "activa"; ocupacionId: string; cuenta: CuentaMesaResult }
  | { status: "cerrada" }
  | { status: "sin_sesion" }

export interface MesaClienteCuentaTestHooks {
  /**
   * Pausa inyectable EXCLUSIVA de tests — nunca se pasa desde
   * route.ts. Se invoca justo antes de leer los pedidos, después de la
   * primera validación. Permite construir una condición de carrera real y
   * determinista (cerrar/reabrir/expirar/revocar concurrentemente durante
   * la pausa) para probar que la revalidación final la detecta.
   */
  beforeLoadPedidos?: () => Promise<void>
  /**
   * Pausa inyectable EXCLUSIVA de tests — nunca se pasa desde route.ts. Se
   * invoca después de cargar los pedidos y calcular la cuenta, justo antes
   * de la revalidación final. Permite probar el caso "la lectura ya ganó":
   * una cancelación/cierre que ocurra en esta ventana no debe alterar los
   * pedidos YA leídos (que se devuelven íntegros), pero si afecta el
   * binding de la ocupación (cierre/reapertura/revocación) sí debe seguir
   * siendo detectada por la revalidación.
   */
  beforeFinalRevalidation?: () => Promise<void>
}

type ValidacionAcceso =
  | { ok: true; credencial: { revocadaEn: Date | null }; ocupacion: { id: string } }
  | { ok: false; status: "sin_sesion" | "cerrada" }

/**
 * Única cadena de validación de autorización — usada IDÉNTICA en la
 * primera validación y en la revalidación final (nunca dos
 * implementaciones que puedan divergir). Siempre lee filas frescas de la
 * base (nunca reutiliza un resultado anterior), por lo que dos llamadas
 * sucesivas pueden legítimamente devolver resultados distintos si el
 * estado cambió entre medio — es exactamente lo que la revalidación final
 * necesita poder detectar.
 */
async function validarAccesoActual(
  negocioId: string,
  mesaId: string,
  tokenHash: string
): Promise<ValidacionAcceso> {
  const credencial = await db.credencialOcupacionMesa.findUnique({ where: { tokenHash } })
  if (!credencial) {
    return { ok: false, status: "sin_sesion" }
  }

  const ocupacion = await db.sesionOcupacionMesa.findUnique({ where: { id: credencial.ocupacionId } })
  if (!ocupacion || ocupacion.negocioId !== negocioId || ocupacion.mesaId !== mesaId) {
    // Credencial real, pero de otra mesa/negocio: nunca se revela — mismo
    // resultado que una cookie inexistente.
    return { ok: false, status: "sin_sesion" }
  }

  if (credencial.revocadaEn != null || ocupacion.estado !== "activa") {
    return { ok: false, status: "cerrada" }
  }

  const mesa = await db.mesa.findUnique({
    where: { id: mesaId },
    select: { negocioId: true, ocupacionActualId: true },
  })
  if (!mesa || mesa.negocioId !== negocioId) {
    return { ok: false, status: "sin_sesion" }
  }
  if (mesa.ocupacionActualId !== ocupacion.id) {
    // Esta ocupación ya no es la "actual" de la mesa — una nueva la
    // reemplazó (mesa reabierta). La sesión vieja nunca pasa a la nueva.
    return { ok: false, status: "cerrada" }
  }

  return { ok: true, credencial, ocupacion }
}

async function cargarCuentaDeOcupacion(ocupacionId: string, negocioId: string): Promise<CuentaMesaResult> {
  const pedidos = await db.pedido.findMany({
    where: { ocupacionMesaId: ocupacionId, negocioId, metodoEntrega: "mesa" },
    orderBy: [{ fecha: "asc" }, { id: "asc" }],
    select: {
      id: true,
      estado: true,
      fecha: true,
      total: true,
      items: {
        select: {
          id: true,
          nombre: true,
          precio: true,
          cantidad: true,
          agregados: true,
          secciones: true,
          ingredientesQuitados: true,
          talle: true,
          color: true,
        },
      },
    },
  })

  const input: CuentaPedidoInput[] = pedidos.map((pedido) => ({
    id: pedido.id,
    estado: pedido.estado,
    fecha: pedido.fecha,
    total: pedido.total,
    items: pedido.items,
  }))

  return buildCuentaMesa(input)
}

/**
 * Único punto de entrada — reemplaza a las antiguas
 * `resolveMesaClienteCuentaAccess` + `loadMesaCuentaPublica` (23-B
 * original), que ejecutaban la autorización y la carga como dos
 * operaciones independientes sin ninguna revalidación entre medio. Ver el
 * comentario de cabecera de este archivo para el análisis completo del
 * TOCTOU y la estrategia elegida.
 *
 * `testHooks` es exclusivamente para pruebas deterministas de concurrencia
 * (ver mesa-cliente-cuenta.test.ts) — route.ts NUNCA lo pasa.
 */
export async function resolveMesaClienteCuenta(
  params: { negocioId: string; mesaId: string; token: string | null },
  testHooks?: MesaClienteCuentaTestHooks
): Promise<MesaClienteCuentaResultado> {
  const { negocioId, mesaId, token } = params
  if (!token || !token.trim()) {
    return { status: "sin_sesion" }
  }

  const tokenHash = hashMesaOccupancyToken(token)

  const primeraValidacion = await validarAccesoActual(negocioId, mesaId, tokenHash)
  if (!primeraValidacion.ok) {
    return { status: primeraValidacion.status }
  }

  await testHooks?.beforeLoadPedidos?.()

  const cuenta = await cargarCuentaDeOcupacion(primeraValidacion.ocupacion.id, negocioId)

  await testHooks?.beforeFinalRevalidation?.()

  // Punto de linealización real: revalidación fresca, ejecutada
  // inmediatamente antes de responder. Nunca reutiliza las filas ya leídas
  // arriba — si cualquier condición cambió (cierre, reapertura, expiración,
  // revocación) entre la primera validación y este instante, se descarta
  // TODA la cuenta ya calculada y se responde como si nunca se hubiera
  // autorizado. Esto es lo que hace posible detectar el caso "cierre entre
  // validación y carga" — algo que ninguna transacción de solo lectura con
  // un snapshot fijo (p. ej. RepeatableRead) podría lograr por sí sola,
  // porque un snapshot fijo jamás observa cambios posteriores a su inicio.
  const revalidacion = await validarAccesoActual(negocioId, mesaId, tokenHash)
  if (!revalidacion.ok) {
    return { status: revalidacion.status }
  }
  if (revalidacion.ocupacion.id !== primeraValidacion.ocupacion.id) {
    // Defensivo: ya cubierto en la práctica por la comparación de
    // `Mesa.ocupacionActualId` dentro de `validarAccesoActual`, pero nunca
    // se asume — si por cualquier motivo la ocupación "activa" resuelta en
    // la revalidación fuera distinta de la que se usó para cargar los
    // pedidos, se descarta igual (nunca se mezclan datos de dos
    // ocupaciones distintas).
    return { status: "cerrada" }
  }

  return { status: "activa", ocupacionId: primeraValidacion.ocupacion.id, cuenta }
}
