import { randomBytes, createHash } from "crypto"
import type { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { SESSION_COOKIE_NAME, findSesionByToken, getOperationalAccountFromRequest } from "@/lib/auth"
import { resolveAreaOperativaEfectiva } from "@/lib/area-operativa"
import { requireOperacionesArea } from "@/lib/operaciones-terminal-access"
import { ESTADOS_PENDIENTES_MESA } from "@/lib/mesa-cuenta"
import { tieneSalonHabilitado } from "@/lib/negocio-salon-contract"

// ============================================
// DeliGO — Ocupación rotativa de mesa
// (P0-D.1 fundación + P0-D.1A garantía + P0-D.1B reintento robusto)
// ============================================
// Sesión compartida por todos los clientes de una mesa física, entre el
// momento en que alguien escanea el QR estando "inside" de la geocerca
// (P0-C.2, src/lib/mesa-geofence.ts) y el cierre futuro de la mesa (P0-D.3,
// todavía no implementado). El QR físico y su URL (/n/{slug}?mesa={numero})
// nunca cambian — lo que rota es la ocupación.
//
// Reglas de seguridad (mismo patrón que src/lib/operaciones-terminal-auth.ts
// y src/lib/password-reset.ts):
//   - Cookie propia, HttpOnly, nunca `deligo_session` ni las cookies de
//     Cuenta Operativa / Terminal Operativa.
//   - El token real vive únicamente en la cookie del dispositivo; en DB solo
//     se guarda su hash SHA-256. Nunca se loguea el valor crudo.
//   - Esta etapa SOLO abre o reutiliza la ocupación — todavía no exige la
//     credencial en POST /api/pedidos (P0-D.2) ni implementa cierre o
//     expiración (P0-D.3).
//
// Sin React, sin ejecución en cliente — solo se importa desde código
// server-side (API routes).

// ---------------------------------------------------------------------------
// Cookie
// ---------------------------------------------------------------------------

export const MESA_OCCUPANCY_COOKIE_NAME = "deligo_mesa_occupancy"

const OCCUPANCY_COOKIE_MAX_AGE_SECONDS = 6 * 60 * 60 // 6 horas — misma duración máxima que MESA_OCCUPANCY_MAX_DURATION_MS

// P0-D.3C: única fuente de verdad de la duración máxima absoluta de una
// ocupación (contada desde `iniciadaEn`, nunca extendida por actividad) —
// derivada de la misma constante de arriba para no tener dos números
// mágicos independientes que puedan desincronizarse. La usa
// src/lib/mesa-occupancy-expiration.ts para calcular el corte de expiración.
export const MESA_OCCUPANCY_MAX_DURATION_MS = OCCUPANCY_COOKIE_MAX_AGE_SECONDS * 1000

function isProd(): boolean {
  return process.env.NODE_ENV === "production"
}

/** Opciones seguras de cookie — mismo patrón que terminalCookieOptions en operaciones-terminal-auth.ts. */
function occupancyCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProd(),
    path: "/",
    maxAge,
  }
}

export function setMesaOccupancyCookie<T extends NextResponse>(response: T, rawToken: string): T {
  response.cookies.set(MESA_OCCUPANCY_COOKIE_NAME, rawToken, occupancyCookieOptions(OCCUPANCY_COOKIE_MAX_AGE_SECONDS))
  return response
}

export function clearMesaOccupancyCookie<T extends NextResponse>(response: T): T {
  response.cookies.set(MESA_OCCUPANCY_COOKIE_NAME, "", occupancyCookieOptions(0))
  return response
}

// ---------------------------------------------------------------------------
// Token / hash
// ---------------------------------------------------------------------------

/** Token opaco: 32 bytes (256 bits) aleatorios criptográficamente seguros, base64url. */
export function generateMesaOccupancyToken(): string {
  return randomBytes(32).toString("base64url")
}

/** SHA-256 (hex) del token real — es lo único que se persiste (CredencialOcupacionMesa.tokenHash). */
export function hashMesaOccupancyToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

// Umbral para no reescribir `ultimaActividadEn` en cada comprobación — un
// mismo dispositivo puede reintentar la geocerca varias veces en pocos
// segundos (permiso denegado, timeout, etc.). 60s es un valor corto,
// server-side, elegido únicamente para reducir escrituras; no tiene ningún
// efecto de seguridad ni de expiración real (eso es P0-D.3).
const ACTIVITY_UPDATE_THROTTLE_MS = 60 * 1000

// ---------------------------------------------------------------------------
// Concurrencia (Estrategia B — mismo patrón que runSerializableTransaction en
// src/app/api/denuncias/route.ts, src/app/api/operativo/register/route.ts,
// src/app/api/operaciones/terminal/activar/route.ts, etc.)
// ---------------------------------------------------------------------------

const MAX_SERIALIZATION_RETRIES = 3

// Exportado: es el único predicado de "conflicto de serialización P2034" del
// módulo — P0-D.3C lo reutiliza tal cual (nunca redefine su propia versión)
// para distinguir, en el resumen del barrido de expiración, un conflicto de
// concurrencia esperado de un error real.
export function isSerializationConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034"
}

// P0-D.1A: nombre exacto del índice único PARCIAL agregado en
// prisma/migrations/20260804000000_add_table_occupancy_sessions/migration.sql
// ("mesaId") WHERE estado = 'activa' — no representable en schema.prisma
// (Prisma no soporta índices parciales en su DSL), así que Prisma nunca lo
// conoce como una restricción "nativa": una violación se reporta como un
// P2002 genérico, igual que cualquier otro índice único creado a mano.
const ACTIVE_OCCUPANCY_UNIQUE_INDEX = "sesiones_ocupacion_mesa_mesaId_activa_key"

// P0-D.1B: para un índice creado a mano (no vía `@@unique` de Prisma), el
// formato real de `error.meta.target` que reporta Prisma con el driver de
// Postgres no está confirmado de antemano — puede llegar como el nombre del
// índice, como el/los nombre(s) de columna involucrados ("mesaId"), como
// string o como array, y en principio con un prefijo de esquema
// ("public.…") si Postgres lo incluyera. Este set son los únicos tokens que
// identifican SIN AMBIGÜEDAD el índice parcial de ocupación activa — nunca
// una coincidencia difusa tipo `target.includes("mesa")`, que podría
// confundir restricciones no relacionadas (p. ej. las de Pedido o Mesa).
const ACTIVE_OCCUPANCY_TARGET_TOKENS = new Set([ACTIVE_OCCUPANCY_UNIQUE_INDEX, "mesaId"])

// Normaliza un único token de `meta.target`: recorta espacios/comillas que
// Prisma no suele incluir pero que no cuesta tolerar, y descarta un posible
// prefijo de esquema ("public.algo" -> "algo") comparando solo la parte
// posterior al último punto.
function normalizeConstraintToken(value: string): string {
  const trimmed = value.trim().replace(/^["']+|["']+$/g, "")
  const dotIndex = trimmed.lastIndexOf(".")
  return dotIndex >= 0 ? trimmed.slice(dotIndex + 1) : trimmed
}

// `meta.target` de Prisma puede llegar como string, array de strings,
// ausente, o (en teoría) algún otro shape no documentado — se normaliza
// siempre a un array de tokens comparables, vacío si no hay nada usable.
function normalizeConstraintTargetTokens(target: unknown): string[] {
  if (typeof target === "string") return [normalizeConstraintToken(target)]
  if (Array.isArray(target)) {
    return target.filter((item): item is string => typeof item === "string").map(normalizeConstraintToken)
  }
  return []
}

// ¿Este target (ya sea el nombre del índice o el nombre de columna
// "mesaId", en cualquiera de las dos formas de Prisma) identifica
// específicamente el índice único parcial de ocupación activa? Nunca
// coincide con `tokenHash`, `credenciales_ocupacion_mesa_tokenHash_key`,
// `id`, ni ninguna otra restricción.
function isActiveOccupancyIndexTarget(target: unknown): boolean {
  return normalizeConstraintTargetTokens(target).some((token) => ACTIVE_OCCUPANCY_TARGET_TOKENS.has(token))
}

// SOLO se usa dentro del catch exacto que envuelve
// `tx.sesionOcupacionMesa.create(... estado: "activa")` (ver
// createActiveOccupancy) — nunca como predicado global sobre cualquier
// P2002 del sistema. Si el target identifica el índice/columna esperados,
// es la carrera. Si el target está ausente, también se trata como la
// carrera: dentro de ESTE create específico, sobre ESTA tabla, el único
// conflicto de unicidad plausible en una creación concurrente es el índice
// parcial (el `id` se genera con `cuid()` y no colisiona en la práctica) —
// esta tolerancia nunca se extiende a otro create ni al resto del helper.
// Si el target está presente pero identifica otra restricción (p. ej.
// "id", "tokenHash"), NO se trata como la carrera esperada.
function isActiveOccupancyCreateConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false
  const target = error.meta?.target
  if (target === undefined || target === null) return true
  return isActiveOccupancyIndexTarget(target)
}

// Error de dominio: se lanza únicamente desde createActiveOccupancy cuando
// el create de la ocupación activa colisiona con el índice único parcial —
// nunca se construye en ningún otro punto del helper. Guarda el error
// original de Prisma en `cause` solo para diagnóstico interno; nunca se
// loguea ni se expone tal cual (ver logMesaOccupancyEvent).
class ActiveOccupancyCreationRaceError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = "ActiveOccupancyCreationRaceError"
  }
}

// Crea la ocupación activa, traduciendo un conflicto de creación reconocido
// (ver isActiveOccupancyCreateConflict) a ActiveOccupancyCreationRaceError.
// Cualquier otro error (de esta tabla o de cualquier otra) se propaga sin
// tocar — nunca se amplía esta traducción más allá de este create puntual.
async function createActiveOccupancy(tx: Prisma.TransactionClient, negocioId: string, mesaId: string) {
  try {
    return await tx.sesionOcupacionMesa.create({ data: { negocioId, mesaId, estado: "activa" } })
  } catch (error) {
    if (isActiveOccupancyCreateConflict(error)) {
      throw new ActiveOccupancyCreationRaceError(
        "Conflicto al crear la ocupación activa: otra transacción concurrente ganó la carrera",
        error
      )
    }
    throw error
  }
}

// Error de dominio: una búsqueda previa a crear encontró más de una
// ocupación activa preexistente para la misma mesa — un estado que la
// aplicación nunca debería producir (y que, tras P0-D.1A, el índice único
// parcial impide que se cree de nuevo), pero que se maneja defensivamente
// ante datos manuales o un bug futuro. Nunca se elige una al azar ni se crea
// una tercera — se aborta con este error, sanitizado, sin ids en el mensaje.
class MultipleActiveOccupanciesError extends Error {}

// Tarea 20: error de dominio — el negocio no tiene Salón habilitado en el
// instante de esta lectura, dentro de la MISMA transacción que abre/
// reutiliza la ocupación (nunca una consulta previa y separada). Nunca se
// construye en ningún otro punto. Los llamadores (mesa-geofence.ts, que ya
// gatea antes de llegar acá, y la creación de pedido de personal en
// pedidos/route.ts) ya envuelven esta llamada en su propio try/catch
// genérico — este error se propaga y se trata igual que cualquier otro
// fallo de apertura, sin exponer detalles internos ni distinguirlo de
// otros motivos de fallo. Nunca se reintenta (no es un conflicto de
// serialización real): `isRetryableOccupancyConflict` no lo reconoce.
export class SalonDeshabilitadoError extends Error {
  constructor() {
    super("El negocio no tiene Salón habilitado")
    this.name = "SalonDeshabilitadoError"
  }
}

// Reintenta tanto el conflicto de serialización (P2034, cualquier escritura
// concurrente sobre las mismas filas) como el error de dominio específico
// de la carrera de creación de ocupación activa
// (ActiveOccupancyCreationRaceError, nunca un P2002 genérico) — jamás
// cualquier otro P2002 del sistema. Ambos comparten el mismo presupuesto de
// reintentos: tras perder cualquiera de las dos carreras, la transacción
// vuelve a ejecutarse desde el inicio, y al releer encuentra la ocupación ya
// creada por la transacción ganadora.
function isRetryableOccupancyConflict(error: unknown): boolean {
  return isSerializationConflict(error) || error instanceof ActiveOccupancyCreationRaceError
}

// Exportado con un predicado/límite de reintentos opcionales (por defecto,
// exactamente el mismo comportamiento que antes: solo P2034 o la carrera de
// creación de ocupación, hasta MAX_SERIALIZATION_RETRIES intentos) para que
// P0-D.3C pueda reutilizar el mismo motor de reintento con su propio
// predicado (solo P2034 — nunca le es aplicable ActiveOccupancyCreationRaceError,
// que es específico de la apertura de ocupación) sin duplicar el bucle.
export async function runSerializableTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { isRetryable?: (error: unknown) => boolean; maxRetries?: number }
): Promise<T> {
  const isRetryable = options?.isRetryable ?? isRetryableOccupancyConflict
  const maxRetries = options?.maxRetries ?? MAX_SERIALIZATION_RETRIES
  let lastError: unknown
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await db.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      })
    } catch (error) {
      lastError = error
      if (error instanceof MultipleActiveOccupanciesError || !isRetryable(error) || attempt === maxRetries) {
        throw error
      }
    }
  }
  throw lastError
}

// ---------------------------------------------------------------------------
// Apertura o reutilización de ocupación
// ---------------------------------------------------------------------------

export interface MesaOccupancyOutcome {
  // Token en claro nuevo — presente únicamente cuando hay que reemplazar la
  // cookie (ocupación nueva o credencial nueva para este dispositivo). El
  // llamador lo usa exclusivamente para setear la cookie: nunca debe
  // incluirse en el cuerpo de una respuesta JSON.
  newToken: string | null
  occupancyCreated: boolean
  credentialCreated: boolean
  // P0-D.1A: true cuando el puntero Mesa.ocupacionActualId estaba perdido o
  // era inconsistente, pero ya existía una ocupación activa real para esta
  // mesa (encontrada por búsqueda server-side) — se reparó el puntero y se
  // reutilizó esa ocupación, sin crear una segunda.
  pointerRepaired: boolean
  // P2 corrección: id de la ocupación activa resultante (nueva o reutilizada)
  // — necesario para que un llamador SIN credencial de dispositivo (personal
  // autenticado, Mozo) pueda revalidarla con un heartbeat dentro de SU PROPIA
  // transacción de creación de pedido (ver heartbeatOcupacionForStaffOrder),
  // en vez de confiar ciegamente en este resultado ya "viejo" para siempre.
  ocupacionId: string
}

/**
 * Abre o reutiliza la ocupación activa de una mesa ya resuelta server-side.
 * Nunca acepta como autoridad ningún dato enviado por el cliente más allá
 * del token opaco de su propia cookie (que solo sirve para buscar SU credencial,
 * nunca para identificar la mesa/negocio/ocupación). `negocioId` y `mesaId`
 * deben venir siempre de una resolución server-side previa (nunca del body).
 */
/**
 * P2 corrección final: núcleo compartido — abre o reutiliza la ocupación
 * ACTIVA de una mesa ya resuelta server-side, dentro de un `tx` YA ABIERTO
 * (nunca abre el suyo) — nunca decide nada sobre credenciales/token de
 * dispositivo, esa decisión queda exclusivamente en manos de cada variante
 * pública (`openOrReuseMesaOccupancy` para dispositivos,
 * `openOrReuseMesaOccupancyForStaff` para personal). Contiene exactamente la
 * misma lógica de búsqueda/reparación/creación que antes vivía en línea
 * dentro de `openOrReuseMesaOccupancy` (comparación estricta del puntero,
 * búsqueda de candidatas cuando el puntero es nulo/inconsistente,
 * MultipleActiveOccupanciesError si hay más de una, createActiveOccupancy +
 * traducción de ActiveOccupancyCreationRaceError si no hay ninguna) — sin
 * duplicarla entre las dos variantes.
 */
export interface MesaOccupancyTestHooks {
  /**
   * Pausa inyectable EXCLUSIVA de tests (Tarea 20) — nunca se pasa desde
   * ningún caller de producción. Se invoca justo después de confirmar que
   * el negocio tiene Salón habilitado, dentro de la MISMA transacción
   * Serializable, antes de leer/crear la ocupación. Permite construir una
   * carrera real y determinista contra una desactivación de Salón
   * concurrente.
   */
  afterSalonCheck?: () => Promise<void>
}

async function openOrReuseMesaOccupancyCore(
  tx: Prisma.TransactionClient,
  params: { negocioId: string; mesaId: string },
  testHooks?: MesaOccupancyTestHooks
) {
  const { negocioId, mesaId } = params

  const mesa = await tx.mesa.findUnique({
    where: { id: mesaId },
    select: { id: true, negocioId: true, ocupacionActualId: true },
  })

  if (!mesa || mesa.negocioId !== negocioId) {
    // La mesa ya fue validada por el llamador (misma consulta que resolvió
    // negocioId/mesaId) — este caso no debería ocurrir nunca en la práctica.
    throw new Error("Mesa no coincide con el negocio resuelto server-side")
  }

  // Tarea 20: lectura fresca de la capacidad, DENTRO de esta misma
  // transacción Serializable — nunca una consulta previa y separada del
  // llamador. Es el único punto donde se abre/reutiliza una ocupación
  // (device y staff comparten este núcleo), así que es el punto correcto
  // para cerrar el enforcement server-side sin depender de que cada ruta
  // pública (mesa-geofence) recuerde repetir el chequeo — aunque
  // mesa-geofence.ts YA lo hace antes de llegar acá (defensa en
  // profundidad), el camino de personal (openOrReuseMesaOccupancyForStaff,
  // llamado directamente desde la creación de pedidos) no tenía ningún
  // gate previo hasta esta tarea.
  const negocio = await tx.negocio.findUnique({ where: { id: negocioId }, select: { salonActivo: true } })
  if (!tieneSalonHabilitado(negocio)) {
    throw new SalonDeshabilitadoError()
  }

  await testHooks?.afterSalonCheck?.()

  const currentOcupacion = mesa.ocupacionActualId
    ? await tx.sesionOcupacionMesa.findUnique({ where: { id: mesa.ocupacionActualId } })
    : null

  // Puntero válido: existe, pertenece a esta misma mesa/negocio, y sigue
  // activo. Nunca se repara ni se elige con datos del cliente — solo se
  // confía en él si pasa las tres comprobaciones.
  const pointerValidActive =
    currentOcupacion &&
    currentOcupacion.mesaId === mesaId &&
    currentOcupacion.negocioId === negocioId &&
    currentOcupacion.estado === "activa"
      ? currentOcupacion
      : null

  let activeOcupacion = pointerValidActive
  let pointerRepaired = false

  if (!activeOcupacion && mesa.ocupacionActualId != null) {
    console.warn("[MesaOccupancy] Puntero de ocupación inconsistente, buscando ocupación activa real", {
      negocioId: shortId(negocioId),
      mesaId: shortId(mesaId),
    })
  }

  if (!activeOcupacion) {
    // Puntero nulo o inconsistente: antes de asumir que no hay ninguna
    // ocupación activa, buscar server-side (nunca con datos del cliente)
    // si ya existe una — puede haber quedado huérfana de una operación
    // manual, un bug previo, o simplemente porque el puntero nunca llegó
    // a escribirse. `take: 2` alcanza para distinguir "ninguna", "una" y
    // "más de una" sin escanear la tabla completa.
    const candidatas = await tx.sesionOcupacionMesa.findMany({
      where: { mesaId, negocioId, estado: "activa" },
      take: 2,
    })

    if (candidatas.length > 1) {
      // Estado que la aplicación nunca debería producir — ver comentario
      // de MultipleActiveOccupanciesError. Nunca se elige una al azar, ni
      // se crea una tercera: se aborta de forma controlada.
      console.error("[MesaOccupancy] Múltiples ocupaciones activas detectadas para la misma mesa", {
        negocioId: shortId(negocioId),
        mesaId: shortId(mesaId),
        cantidad: candidatas.length,
      })
      throw new MultipleActiveOccupanciesError("Múltiples ocupaciones activas para la misma mesa")
    }

    if (candidatas.length === 1) {
      // Ya existía una ocupación activa real — nunca crear una segunda.
      // Repara el puntero dentro de la misma transacción.
      activeOcupacion = candidatas[0]
      pointerRepaired = true
      await tx.mesa.update({
        where: { id: mesaId },
        data: { ocupacionActualId: activeOcupacion.id },
      })
    }
  }

  if (activeOcupacion) {
    return { ocupacion: activeOcupacion, occupancyCreated: false, pointerRepaired }
  }

  // ---- Mesa sin ninguna ocupación activa (ni por puntero, ni encontrada
  // por búsqueda server-side): abrir una nueva ----
  // Si otra transacción concurrente ganó la carrera y ya insertó su propia
  // fila activa para esta misma mesa justo antes de este INSERT, Postgres
  // rechaza esta inserción de inmediato por el índice único parcial —
  // createActiveOccupancy traduce ESE conflicto puntual (y solo ese) a
  // ActiveOccupancyCreationRaceError. Si en cambio ambas transacciones
  // pasaron el chequeo casi a la vez y el conflicto solo se detecta al
  // confirmar (lectura/escritura de la fila de Mesa), Postgres devuelve un
  // conflicto de serialización (P2034) más abajo, en el `tx.mesa.update`.
  // En cualquiera de los dos casos, `runSerializableTransaction` reconoce
  // el error (isRetryableOccupancyConflict) y reintenta la función
  // completa desde cero: en el reintento, la búsqueda de arriba encuentra
  // la ocupación ya comiteada por la transacción ganadora y toma la rama
  // de reutilización — nunca quedan dos ocupaciones activas ni una fila
  // huérfana (la transacción perdedora se revierte por completo, incluida
  // esta fila recién creada).
  const nuevaOcupacion = await createActiveOccupancy(tx, negocioId, mesaId)

  await tx.mesa.update({
    where: { id: mesaId },
    data: { ocupacionActualId: nuevaOcupacion.id },
  })

  return { ocupacion: nuevaOcupacion, occupancyCreated: true, pointerRepaired: false }
}

export async function openOrReuseMesaOccupancy(
  params: {
    negocioId: string
    mesaId: string
    existingToken: string | null
  },
  testHooks?: MesaOccupancyTestHooks
): Promise<MesaOccupancyOutcome> {
  const { negocioId, mesaId, existingToken } = params
  const existingTokenHash = existingToken ? hashMesaOccupancyToken(existingToken) : null
  const now = Date.now()

  return runSerializableTransaction(async (tx) => {
    const { ocupacion: activeOcupacion, occupancyCreated, pointerRepaired } = await openOrReuseMesaOccupancyCore(
      tx,
      { negocioId, mesaId },
      testHooks
    )

    if (occupancyCreated) {
      // ---- Ocupación recién creada: siempre credencial nueva para este
      // dispositivo (nunca hay una credencial previa que pudiera coincidir). ----
      const rawToken = generateMesaOccupancyToken()
      await tx.credencialOcupacionMesa.create({
        data: { ocupacionId: activeOcupacion.id, tokenHash: hashMesaOccupancyToken(rawToken) },
      })

      return {
        newToken: rawToken,
        occupancyCreated: true,
        credentialCreated: true,
        pointerRepaired: false,
        ocupacionId: activeOcupacion.id,
      }
    }

    // ---- Mesa con ocupación activa (reutilizada o con puntero reparado):
    // resolver credencial de ESTE dispositivo ----
    const credencial = existingTokenHash
      ? await tx.credencialOcupacionMesa.findFirst({
          where: { tokenHash: existingTokenHash, ocupacionId: activeOcupacion.id, revocadaEn: null },
        })
      : null

    if (credencial) {
      // Credencial válida de esta misma ocupación — reutilizar sin emitir
      // otro token. Actualizar `ultimaActividadEn` solo si pasó el umbral,
      // para no escribir en cada reintento/render.
      const staleOcupacion = now - activeOcupacion.ultimaActividadEn.getTime() > ACTIVITY_UPDATE_THROTTLE_MS
      const staleCredencial = now - credencial.ultimaActividadEn.getTime() > ACTIVITY_UPDATE_THROTTLE_MS

      if (staleOcupacion) {
        await tx.sesionOcupacionMesa.update({
          where: { id: activeOcupacion.id },
          data: { ultimaActividadEn: new Date(now) },
        })
      }
      if (staleCredencial) {
        await tx.credencialOcupacionMesa.update({
          where: { id: credencial.id },
          data: { ultimaActividadEn: new Date(now) },
        })
      }

      return {
        newToken: null,
        occupancyCreated: false,
        credentialCreated: false,
        pointerRepaired,
        ocupacionId: activeOcupacion.id,
      }
    }

    // Cookie ausente, inválida, de otra ocupación/mesa/negocio, o
    // revocada: nueva credencial para ESTE dispositivo, misma ocupación.
    const rawToken = generateMesaOccupancyToken()
    await tx.credencialOcupacionMesa.create({
      data: { ocupacionId: activeOcupacion.id, tokenHash: hashMesaOccupancyToken(rawToken) },
    })

    return {
      newToken: rawToken,
      occupancyCreated: false,
      credentialCreated: true,
      pointerRepaired,
      ocupacionId: activeOcupacion.id,
    }
  })
}

export interface StaffMesaOccupancyOutcome {
  ocupacionId: string
  occupancyCreated: boolean
  pointerRepaired: boolean
}

/**
 * P2 corrección final: variante para personal autorizado (personal
 * autenticado sin credencial de dispositivo, Mozo) — abre o reutiliza la
 * ocupación activa de una mesa ya resuelta server-side, reutilizando el
 * MISMO núcleo que la variante de dispositivo (`openOrReuseMesaOccupancy`),
 * pero:
 *   - NUNCA genera un token opaco (`generateMesaOccupancyToken`);
 *   - NUNCA calcula ni compara ningún hash;
 *   - NUNCA crea, actualiza ni revoca ninguna fila `CredencialOcupacionMesa`;
 *   - NUNCA necesita ni asume ninguna cookie.
 * El personal nunca es dueño de un "dispositivo cliente" en el sentido de
 * P0-D — vincula pedidos a la ocupación real de la mesa, no abre un canal de
 * autorización nuevo. El llamador DEBE revalidar el `ocupacionId` devuelto
 * dentro de su PROPIA transacción de creación de pedido, vía
 * `heartbeatOcupacionForStaffOrder`, antes de crear el pedido — este helper
 * por sí solo no ofrece ninguna garantía de que la ocupación siga activa un
 * instante después de devolver el resultado.
 */
export async function openOrReuseMesaOccupancyForStaff(
  params: { negocioId: string; mesaId: string },
  testHooks?: MesaOccupancyTestHooks
): Promise<StaffMesaOccupancyOutcome> {
  const { negocioId, mesaId } = params
  return runSerializableTransaction(async (tx) => {
    const { ocupacion, occupancyCreated, pointerRepaired } = await openOrReuseMesaOccupancyCore(
      tx,
      { negocioId, mesaId },
      testHooks
    )
    return { ocupacionId: ocupacion.id, occupancyCreated, pointerRepaired }
  })
}

// ---------------------------------------------------------------------------
// Validación y heartbeat al crear un pedido (P0-D.2)
// ---------------------------------------------------------------------------

export type MesaOccupancyOrderValidation =
  | { status: "valid"; ocupacionId: string; credencialId: string }
  | { status: "missing" }
  | { status: "invalid" }

/**
 * Resuelve y valida, dentro del `tx` de creación del pedido, si el token de
 * la cookie de ocupación autoriza a este dispositivo a pedir en esta mesa
 * ahora mismo. Nunca acepta como autoridad ningún id enviado por el cliente
 * — `negocioId`/`mesaId` deben venir siempre de una resolución server-side
 * previa (la misma que ya resuelve el pedido). Debe coincidir toda la
 * cadena: credencial no revocada -> ocupación activa de ESE negocio/mesa ->
 * mesa cuyo puntero "actual" siga siendo exactamente esa ocupación. Nunca
 * alcanza con que el hash exista, ni con que la ocupación esté "activa" en
 * abstracto.
 */
export async function resolveMesaOccupancyForOrder(
  tx: Prisma.TransactionClient,
  params: { negocioId: string; mesaId: string; token: string | null }
): Promise<MesaOccupancyOrderValidation> {
  const { negocioId, mesaId, token } = params
  if (!token || !token.trim()) {
    return { status: "missing" }
  }

  const tokenHash = hashMesaOccupancyToken(token)
  const credencial = await tx.credencialOcupacionMesa.findUnique({ where: { tokenHash } })
  if (!credencial || credencial.revocadaEn != null) {
    return { status: "invalid" }
  }

  const ocupacion = await tx.sesionOcupacionMesa.findUnique({ where: { id: credencial.ocupacionId } })
  if (
    !ocupacion ||
    ocupacion.estado !== "activa" ||
    ocupacion.negocioId !== negocioId ||
    ocupacion.mesaId !== mesaId
  ) {
    return { status: "invalid" }
  }

  // La ocupación puede existir, estar activa, y pertenecer a la mesa/negocio
  // correctos, pero ya no ser la que la Mesa considera "actual" (p. ej. si
  // P0-D.3 la cerrara y abriera una nueva entre la apertura de esta
  // credencial y este pedido) — sin este chequeo, una credencial de un ciclo
  // de ocupación ya superado seguiría aceptándose.
  const mesa = await tx.mesa.findUnique({
    where: { id: mesaId },
    select: { negocioId: true, ocupacionActualId: true },
  })
  if (!mesa || mesa.negocioId !== negocioId || mesa.ocupacionActualId !== ocupacion.id) {
    return { status: "invalid" }
  }

  return { status: "valid", ocupacionId: ocupacion.id, credencialId: credencial.id }
}

export type StaffOcupacionGuardResult =
  | { status: "linked"; ocupacionId: string }
  | { status: "unavailable" }

/**
 * P2 corrección: usado por creadores de pedido de mesa SIN credencial de
 * dispositivo (personal autenticado, Mozo) para vincular el pedido a una
 * ocupación real de forma NO best-effort. El llamador debe:
 *   1) Antes de abrir su transacción de creación, llamar a
 *      `openOrReuseMesaOccupancyForStaff` (server-side, negocioId/mesaId ya
 *      validados) para garantizar que existe una ocupación activa —
 *      política A de la sección 5 del prompt de corrección: abrir/reutilizar
 *      automáticamente, nunca "esperar" que ya exista.
 *   2) Dentro de su propia transacción de creación (la misma que hace el
 *      `pedido.create`), llamar a esta función con el `ocupacionId`
 *      devuelto por el paso 1.
 * Esta función revalida esa ocupación con la MISMA escritura condicional
 * ("heartbeat") que ya usa el camino con credencial
 * (heartbeatMesaOccupancyForOrder) — un `updateMany` con `WHERE estado =
 * 'activa'` toma un lock de fila real sobre esa `SesionOcupacionMesa`. Si
 * otra transacción (un cierre comercial concurrente) ya la cerró, esta
 * escritura condicional afecta 0 filas y esta función devuelve
 * `"unavailable"` — el llamador DEBE abortar toda la transacción (nunca
 * crear el pedido con `ocupacionMesaId: null` como fallback silencioso).
 * Este es exactamente el mecanismo de exclusión mutua real entre "crear
 * pedido" y "cerrar cuenta": ambas operaciones intentan una escritura
 * condicional sobre la MISMA fila de `SesionOcupacionMesa`, y Postgres
 * serializa esas dos escrituras a nivel de fila sin importar el nivel de
 * aislamiento — nunca pueden ambas "ver activa" y proceder a la vez.
 */
export async function heartbeatOcupacionForStaffOrder(
  tx: Prisma.TransactionClient,
  params: { negocioId: string; mesaId: string; ocupacionId: string; now: Date }
): Promise<StaffOcupacionGuardResult> {
  const { negocioId, mesaId, ocupacionId, now } = params

  const update = await tx.sesionOcupacionMesa.updateMany({
    where: { id: ocupacionId, negocioId, mesaId, estado: "activa" },
    data: { ultimaActividadEn: now },
  })
  if (update.count !== 1) return { status: "unavailable" }

  return { status: "linked", ocupacionId }
}

/**
 * Heartbeat de actividad al crear un pedido nuevo — SOLO se llama después de
 * que resolveMesaOccupancyForOrder ya devolvió "valid", y vuelve a
 * comprobar todas las condiciones en el mismo momento de escribir (nunca
 * confía en la lectura anterior): protege contra que la ocupación/mesa/
 * credencial cambien entre la validación y la creación real del pedido
 * (TOCTOU), sin necesitar aislamiento Serializable en toda la transacción
 * de pedidos (que también sirve a delivery/retiro). Si cualquier
 * `updateMany` afecta 0 filas, la credencial ya no es válida en este
 * instante — el llamador debe abortar toda la transacción y no crear el
 * pedido. Nunca actualiza `iniciadaEn`, `emitidaEn`, `cerradaEn`,
 * `revocadaEn`, `estado` ni el puntero actual — solo `ultimaActividadEn` en
 * ambas filas, con el mismo `now`.
 *
 * Orden de escritura (documentado para que P0-D.3 lo respete al cerrar, y
 * así evitar deadlocks): 1) Mesa (lectura), 2) SesionOcupacionMesa, 3)
 * CredencialOcupacionMesa.
 */
export async function heartbeatMesaOccupancyForOrder(
  tx: Prisma.TransactionClient,
  params: { ocupacionId: string; credencialId: string; negocioId: string; mesaId: string; now: Date }
): Promise<boolean> {
  const { ocupacionId, credencialId, negocioId, mesaId, now } = params

  const mesa = await tx.mesa.findUnique({
    where: { id: mesaId },
    select: { negocioId: true, ocupacionActualId: true },
  })
  if (!mesa || mesa.negocioId !== negocioId || mesa.ocupacionActualId !== ocupacionId) {
    return false
  }

  const ocupacionUpdate = await tx.sesionOcupacionMesa.updateMany({
    where: { id: ocupacionId, negocioId, mesaId, estado: "activa" },
    data: { ultimaActividadEn: now },
  })
  if (ocupacionUpdate.count !== 1) return false

  const credencialUpdate = await tx.credencialOcupacionMesa.updateMany({
    where: { id: credencialId, ocupacionId, revocadaEn: null },
    data: { ultimaActividadEn: now },
  })
  if (credencialUpdate.count !== 1) return false

  return true
}

// ---------------------------------------------------------------------------
// Cierre técnico de ocupación (P0-D.3A)
// ---------------------------------------------------------------------------
// Cierra únicamente el ciclo TÉCNICO de seguridad de la mesa: revoca las
// credenciales de dispositivo y libera el puntero de Mesa para que el
// próximo escaneo válido pueda abrir una ocupación nueva. Nunca toca
// pedidos, totales, pagos, tickets ni el cierre COMERCIAL de la cuenta — los
// pedidos conservan su `ocupacionMesaId` histórico para siempre, aunque la
// ocupación quede cerrada (necesario para que una etapa futura pueda reunir
// los consumos de esa ocupación).

export type MesaOccupancyCloseActor =
  | { type: "negocio"; negocioId: string; actorId: string; canCloseAnyMesa: true }
  | { type: "salon"; negocioId: string; actorId: string; canCloseAnyMesa: true }
  | { type: "mozo"; negocioId: string; actorId: string; canCloseAnyMesa: false; assignedMesaIds: string[] }

/**
 * Resuelve quién está pidiendo cerrar una ocupación, exclusivamente desde
 * sesiones server-side reales — nunca desde el body. `negocioId` debe venir
 * ya resuelto por el llamador (el negocio real de la mesa, nunca uno
 * enviado por el cliente). Reutiliza los helpers de autorización ya
 * existentes del proyecto (sin modificarlos): `resolveAreaOperativaEfectiva`
 * (única fuente de verdad del área personal — nunca "rol") y
 * `requireOperacionesArea` (autorización real de Terminal Operativa, misma
 * regla que ya usa Salón vía terminal). Devuelve `null` si ninguna de las
 * tres identidades (Negocio dueño / Cuenta Operativa de área Salón o Mozo /
 * Terminal Operativa de área Salón) es válida para ESE negocio — cliente,
 * invitado, PyR, sesión expirada, u otro negocio nunca devuelven un actor.
 */
export async function resolveMesaOccupancyCloseActor(
  request: NextRequest,
  negocioId: string
): Promise<MesaOccupancyCloseActor | null> {
  // 1) Negocio dueño — sesión `deligo_session`, tipo "negocio", cuyo userId
  // sea exactamente el negocio real ya resuelto.
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value
  if (sessionToken) {
    const session = await findSesionByToken(sessionToken)
    if (session && session.userType === "negocio" && session.userId === negocioId) {
      return { type: "negocio", negocioId, actorId: session.userId, canCloseAnyMesa: true }
    }
  }

  // 2) Cuenta Operativa personal (Salón o Mozo, según ÁREA EFECTIVA real —
  // nunca el body, nunca "rol" solo) — empleado activo del mismo negocio.
  const cuentaOperativa = await getOperationalAccountFromRequest(request)
  if (cuentaOperativa) {
    const empleado = cuentaOperativa.empleados.find(
      (candidate) => candidate.negocio.id === negocioId && candidate.activo
    )
    if (empleado) {
      const area = resolveAreaOperativaEfectiva({ areaOperativa: empleado.areaOperativa, rol: empleado.rol })
      if (area === "salon") {
        return { type: "salon", negocioId, actorId: empleado.id, canCloseAnyMesa: true }
      }
      if (area === "mozo") {
        return {
          type: "mozo",
          negocioId,
          actorId: empleado.id,
          canCloseAnyMesa: false,
          // Server-side real: Mesa.empleadoId → Empleado (asignación actual,
          // nunca "mesaAsignada"/"mesaId" del body). Ver Mesa.mesas en el schema.
          assignedMesaIds: empleado.mesas.map((mesa) => mesa.id),
        }
      }
      // "pyr" / "sin_asignar": no autorizado para cerrar mesas.
    }
  }

  // 3) Terminal Operativa — misma regla que ya usa Salón vía terminal (área
  // "salon" + su scope base de lectura). `requireOperacionesArea` nunca se
  // modificó; solo se reutiliza.
  const terminalAuth = await requireOperacionesArea(request, "salon")
  if (terminalAuth.ok && terminalAuth.context.negocio.id === negocioId) {
    return { type: "salon", negocioId, actorId: terminalAuth.context.terminal.id, canCloseAnyMesa: true }
  }

  return null
}

export type MesaOccupancyStatusResult =
  | { status: "active"; occupancy: { id: string; startedAt: Date; lastActivityAt: Date } }
  // P2 corrección (Bloqueo 4): cuando no hay ocupación activa, se informa
  // además el id de la ÚLTIMA ocupación cerrada de esta mesa (si existe) —
  // única y exclusivamente para que la UI pueda ofrecer reabrir/reimprimir
  // ESE ticket ya cerrado (GET /api/operaciones/ocupaciones/[id]/cuenta,
  // que ya funciona con ocupaciones cerradas). Nunca es una ocupación activa
  // ni autoriza nada por sí sola — la autorización real la sigue haciendo el
  // endpoint de cuenta en cada consulta.
  | { status: "none"; lastClosedOcupacionId: string | null }
  | { status: "inconsistent" }

/**
 * Consulta de solo lectura del estado técnico actual de la ocupación de una
 * mesa — para paneles de personal ya autorizado (la autorización la resuelve
 * el llamador, esta función no la repite). Si el puntero de Mesa referencia
 * una sesión inexistente, de otra mesa, de otro negocio, o no activa, NUNCA
 * se repara ni se devuelve como válida acá — se informa como
 * `"inconsistent"`, sanitizado, con un warning en log.
 */
export async function getMesaOccupancyStatus(params: {
  negocioId: string
  mesaId: string
}): Promise<MesaOccupancyStatusResult> {
  const { negocioId, mesaId } = params

  const mesa = await db.mesa.findUnique({
    where: { id: mesaId },
    select: { negocioId: true, ocupacionActualId: true },
  })
  if (!mesa || mesa.negocioId !== negocioId) {
    return { status: "inconsistent" }
  }
  if (!mesa.ocupacionActualId) {
    // P2 corrección (Bloqueo 4): búsqueda mínima de solo lectura — la más
    // reciente ocupación `cerrada` de ESTA mesa/negocio (nunca de otra). No
    // es un historial nuevo: es un único registro puntual para permitir
    // reimprimir el último ticket cerrado, reutilizando el mismo endpoint
    // de cuenta que ya acepta ocupaciones cerradas.
    const lastClosed = await db.sesionOcupacionMesa.findFirst({
      where: { negocioId, mesaId, estado: "cerrada" },
      orderBy: { cerradaEn: "desc" },
      select: { id: true },
    })
    return { status: "none", lastClosedOcupacionId: lastClosed?.id ?? null }
  }

  const ocupacion = await db.sesionOcupacionMesa.findUnique({ where: { id: mesa.ocupacionActualId } })
  if (!ocupacion || ocupacion.negocioId !== negocioId || ocupacion.mesaId !== mesaId || ocupacion.estado !== "activa") {
    console.warn("[MesaOccupancy] Puntero de ocupación inconsistente detectado en consulta de estado", {
      negocioId: shortId(negocioId),
      mesaId: shortId(mesaId),
    })
    return { status: "inconsistent" }
  }

  return {
    status: "active",
    occupancy: { id: ocupacion.id, startedAt: ocupacion.iniciadaEn, lastActivityAt: ocupacion.ultimaActividadEn },
  }
}

export type MesaOccupancyCloseResult =
  | { status: "closed"; revokedCredentials: number }
  | { status: "no_active" }
  | { status: "occupancy_changed" }
  | { status: "inconsistent" }

// Motivo estable y sanitizado para cierre manual por personal — nunca texto
// libre del usuario en esta etapa.
const MANUAL_STAFF_CLOSE_REASON = "manual_staff_close"

// Error de dominio interno: cualquier estado que la aplicación no debería
// producir si el propio helper siempre cierra+limpia atómicamente (puntero
// apuntando a una fila que no coincide con negocio/mesa, o que ya no está
// activa, o un `updateMany` que no afecta la fila esperada). Nunca se
// repara silenciosamente — se traduce a un resultado "inconsistent" sin
// exponer la causa exacta.
class MesaOccupancyCloseInconsistentError extends Error {}

// P2 corrección (Bloqueo 1): error de dominio lanzado por el hook
// `beforeWrite` de `closeMesaOccupancyComercial` cuando existen pedidos de
// mesa todavía mutables — nunca se construye en ningún otro punto. Al
// propagarse, Prisma revierte toda la transacción (incluida la escritura
// tentativa del paso 5 de `closeMesaOccupancyCore`, ver abajo), por lo que
// un cierre bloqueado nunca deja la ocupación a medio cerrar.
class MesaOccupancyPendingOrdersError extends Error {
  constructor(public readonly pendingCount: number) {
    super("La ocupación tiene pedidos de mesa todavía no entregados ni cancelados")
    this.name = "MesaOccupancyPendingOrdersError"
  }
}

/**
 * P2 corrección (Bloqueo 1): núcleo transaccional único del cierre de
 * ocupación — recibe un `tx` YA ABIERTO (nunca abre su propia transacción) y
 * hace exactamente los mismos 7 pasos que antes tenía `closeMesaOccupancy`
 * en línea, sin cambiar su contrato ni su orden de escrituras (documentado
 * para evitar deadlocks: 1) SesionOcupacionMesa, 2) CredencialOcupacionMesa,
 * 3) Mesa). `closeMesaOccupancy` (cierre TÉCNICO, P0-D.3A) sigue llamando
 * este núcleo exactamente igual que antes, envuelto en su propia
 * `runSerializableTransaction` — su comportamiento observable no cambió en
 * absoluto. `closeMesaOccupancyComercial` (cierre COMERCIAL, P2) llama este
 * MISMO núcleo, dentro de SU PROPIA `runSerializableTransaction`, pasando un
 * `beforeWrite` que cuenta pedidos pendientes DESPUÉS de que el paso 5 ya
 * tomó el lock de fila sobre la ocupación (nunca antes, nunca en una
 * consulta o transacción separada) — si hay pendientes, lanza
 * MesaOccupancyPendingOrdersError, que revierte toda la transacción
 * (incluida la escritura tentativa del paso 5).
 *
 * Nunca acepta como autoridad `negocioId`/`mesaId` sin resolución previa del
 * llamador, ni `actorType`/`actorId`/`estado`/`cerradaPorId`/`cerradaPorTipo`/
 * `revocadaEn` del body — todos son parámetros ya resueltos server-side.
 */
async function closeMesaOccupancyCore(
  tx: Prisma.TransactionClient,
  params: {
    negocioId: string
    mesaId: string
    expectedOcupacionId: string
    actorType: "negocio" | "salon" | "mozo"
    actorId: string
    now: Date
  },
  beforeWrite?: (tx: Prisma.TransactionClient, ocupacionId: string) => Promise<void>
): Promise<MesaOccupancyCloseResult> {
  const { negocioId, mesaId, expectedOcupacionId, actorType, actorId, now } = params

  // 1) Leer Mesa y confirmar negocio real.
  const mesa = await tx.mesa.findUnique({
    where: { id: mesaId },
    select: { negocioId: true, ocupacionActualId: true },
  })
  if (!mesa || mesa.negocioId !== negocioId) {
    throw new MesaOccupancyCloseInconsistentError("Mesa no coincide con el negocio resuelto server-side")
  }

  // 2) Idempotente: si la mesa ya no tiene ninguna ocupación activa
  // (primer cierre ya ejecutado, o nunca hubo una), no es un error.
  if (!mesa.ocupacionActualId) {
    return { status: "no_active" as const }
  }

  // 3) Comparación estricta contra el puntero actual — un request viejo
  // (de una ocupación ya cerrada) nunca debe poder cerrar la ocupación
  // nueva de la misma mesa.
  if (mesa.ocupacionActualId !== expectedOcupacionId) {
    return { status: "occupancy_changed" as const }
  }

  // 4) Leer y validar la ocupación esperada — debe coincidir toda la
  // cadena (negocio/mesa reales), y estar activa (si el puntero le
  // apuntara pero ya no estuviera activa, sería un estado que este
  // mismo helper nunca debería producir — ver comentario de
  // MesaOccupancyCloseInconsistentError).
  const ocupacion = await tx.sesionOcupacionMesa.findUnique({ where: { id: expectedOcupacionId } })
  if (!ocupacion || ocupacion.negocioId !== negocioId || ocupacion.mesaId !== mesaId) {
    throw new MesaOccupancyCloseInconsistentError("Ocupación esperada no coincide con negocio/mesa reales")
  }
  if (ocupacion.estado !== "activa") {
    throw new MesaOccupancyCloseInconsistentError("El puntero apunta a una ocupación que ya no está activa")
  }

  // 5) Primera escritura: la ocupación activa → cerrada. Esta es la
  // escritura que toma el lock de fila real sobre la ocupación — CUALQUIER
  // otra transacción que intente su propia escritura condicional
  // (`WHERE estado = 'activa'`) sobre esta MISMA fila (el heartbeat de una
  // creación de pedido concurrente, por ejemplo) queda bloqueada por
  // Postgres hasta que esta transacción termine (commit o rollback) — nunca
  // pueden ambas "ver activa" y proceder a la vez. Este es el mecanismo real
  // de exclusión mutua, no una afirmación sin mecanismo equivalente.
  const ocupacionUpdate = await tx.sesionOcupacionMesa.updateMany({
    where: { id: expectedOcupacionId, negocioId, mesaId, estado: "activa" },
    data: {
      estado: "cerrada",
      cerradaEn: now,
      cerradaPorTipo: actorType,
      cerradaPorId: actorId,
      motivoCierre: MANUAL_STAFF_CLOSE_REASON,
    },
  })
  if (ocupacionUpdate.count !== 1) {
    throw new MesaOccupancyCloseInconsistentError("No se pudo actualizar la ocupación esperada")
  }

  // P2 corrección (Bloqueo 1): comprobación comercial (pedidos pendientes),
  // SIEMPRE después del lock de fila del paso 5 y SIEMPRE dentro de esta
  // misma transacción — nunca en una consulta separada de antemano. Si el
  // hook lanza, Prisma revierte también la escritura del paso 5 (nunca
  // queda una ocupación "cerrada" a medias con pedidos pendientes).
  // `closeMesaOccupancy` (cierre técnico) nunca pasa este hook — su
  // comportamiento no cambia.
  if (beforeWrite) {
    await beforeWrite(tx, ocupacion.id)
  }

  // 6) Segunda escritura: revocar todas las credenciales activas de esa
  // ocupación. Puede ser cero, una, o varias — nunca se exige un count
  // exacto (a diferencia de la ocupación y la mesa, que sí lo exigen).
  const credencialesUpdate = await tx.credencialOcupacionMesa.updateMany({
    where: { ocupacionId: expectedOcupacionId, revocadaEn: null },
    data: { revocadaEn: now },
  })

  // 7) Tercera escritura: limpiar el puntero de Mesa. Si esto fallara
  // (count !== 1), NO se acepta el cierre como correcto — se revierte
  // toda la transacción para nunca dejar una ocupación cerrada con el
  // puntero de Mesa sin resolver.
  const mesaUpdate = await tx.mesa.updateMany({
    where: { id: mesaId, negocioId, ocupacionActualId: expectedOcupacionId },
    data: { ocupacionActualId: null },
  })
  if (mesaUpdate.count !== 1) {
    throw new MesaOccupancyCloseInconsistentError("No se pudo limpiar el puntero de Mesa")
  }

  return { status: "closed" as const, revokedCredentials: credencialesUpdate.count }
}

/**
 * Cierre TÉCNICO (P0-D.3A) — contrato y comportamiento observable idénticos
 * a los que tenía antes de la corrección de P2: abre su propia transacción
 * Serializable con reintento (`runSerializableTransaction`, reutilizado) y
 * llama al núcleo sin ningún hook — nunca revisa pedidos pendientes. Sigue
 * siendo el único mecanismo que usa el endpoint técnico existente
 * (`/api/operaciones/mesas/[id]/ocupacion`) y el que reutiliza el cron de
 * expiración si alguna vez lo necesitara.
 */
export async function closeMesaOccupancy(params: {
  negocioId: string
  mesaId: string
  expectedOcupacionId: string
  actorType: "negocio" | "salon" | "mozo"
  actorId: string
  now?: Date
}): Promise<MesaOccupancyCloseResult> {
  const now = params.now ?? new Date()
  try {
    return await runSerializableTransaction((tx) => closeMesaOccupancyCore(tx, { ...params, now }))
  } catch (error) {
    if (error instanceof MesaOccupancyCloseInconsistentError) {
      return { status: "inconsistent" }
    }
    throw error
  }
}

export type MesaOccupancyComercialCloseResult =
  | { status: "closed"; revokedCredentials: number }
  | { status: "no_active" }
  | { status: "occupancy_changed" }
  | { status: "inconsistent" }
  | { status: "pending_orders"; pendingCount: number }

/**
 * Cierre COMERCIAL (P2 corrección, Bloqueo 1) — la comprobación de pedidos
 * pendientes y el cierre técnico ocurren dentro de UNA ÚNICA transacción
 * Serializable real (nunca dos operaciones separadas). Llama al MISMO
 * núcleo que `closeMesaOccupancy` (nunca duplica su lógica de escritura),
 * pasándole un hook que cuenta pedidos de mesa en estado
 * `recibido`/`preparando`/`listo_para_retirar` para esa ocupación exacta —
 * ejecutado siempre DESPUÉS de que el núcleo ya tomó el lock de fila sobre
 * la ocupación (paso 5), nunca antes. Ver el comentario de
 * `closeMesaOccupancyCore` para la garantía exacta de exclusión mutua frente
 * a una creación de pedido concurrente.
 */
export async function closeMesaOccupancyComercial(params: {
  negocioId: string
  mesaId: string
  expectedOcupacionId: string
  actorType: "negocio" | "salon" | "mozo"
  actorId: string
  now?: Date
}): Promise<MesaOccupancyComercialCloseResult> {
  const now = params.now ?? new Date()
  try {
    return await runSerializableTransaction(async (tx) => {
      return await closeMesaOccupancyCore(tx, { ...params, now }, async (txInner, ocupacionId) => {
        const pendingCount = await txInner.pedido.count({
          where: {
            ocupacionMesaId: ocupacionId,
            negocioId: params.negocioId,
            metodoEntrega: "mesa",
            estado: { in: [...ESTADOS_PENDIENTES_MESA] },
          },
        })
        if (pendingCount > 0) {
          throw new MesaOccupancyPendingOrdersError(pendingCount)
        }
      })
    })
  } catch (error) {
    if (error instanceof MesaOccupancyCloseInconsistentError) {
      return { status: "inconsistent" }
    }
    if (error instanceof MesaOccupancyPendingOrdersError) {
      return { status: "pending_orders", pendingCount: error.pendingCount }
    }
    throw error
  }
}

// ---------------------------------------------------------------------------
// Logs sanitizados
// ---------------------------------------------------------------------------

function shortId(value: string | null | undefined): string | null {
  if (!value) return null
  return value.length <= 8 ? value : `${value.slice(0, 8)}...`
}

/**
 * Un solo evento resumen por request (evita duplicar el mismo log varias
 * veces por una sola evaluación). Nunca incluye token, tokenHash, cookie,
 * ids completos, IP, user agent, coordenadas, body ni headers.
 */
export function logMesaOccupancyEvent(details: {
  negocioId: string
  mesaNumero: number
  // "repaired" (P0-D.1A): el puntero estaba perdido/inconsistente pero se
  // encontró y reutilizó una ocupación activa real ya existente.
  outcome: "opened" | "reused" | "repaired" | "error"
  occupancyCreated: boolean
  credentialCreated: boolean
}) {
  console.info("[MesaOccupancy] mesa_occupancy_check", {
    negocioId: shortId(details.negocioId),
    mesaNumero: details.mesaNumero,
    outcome: details.outcome,
    occupancyCreated: details.occupancyCreated,
    credentialCreated: details.credentialCreated,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Evento resumen de la comprobación de ocupación al CREAR un pedido (P0-D.2)
 * — distinto de logMesaOccupancyEvent (que cubre la apertura/reutilización
 * al abrir el QR). Un solo evento por request. `outcome` nunca revela cuál
 * causa concreta hizo inválida una credencial (revocada/cerrada/expirada/
 * otra mesa/otro negocio/puntero distinto quedan todas colapsadas en
 * "invalid", igual que en la respuesta pública) — reducido a propósito
 * respecto de la lista conceptual completa, para no exponer más detalle del
 * necesario ni siquiera en logs. Nunca incluye token, tokenHash, cookie,
 * ids completos, IP, user agent, coordenadas, body ni headers.
 */
export function logMesaOccupancyOrderEvent(details: {
  negocioId: string
  mesaNumero: number
  outcome: "valid" | "missing" | "invalid" | "bypassed_staff" | "business_unconfigured" | "error"
  linked: boolean
}) {
  console.info("[MesaOccupancy] mesa_occupancy_order_check", {
    negocioId: shortId(details.negocioId),
    mesaNumero: details.mesaNumero,
    outcome: details.outcome,
    linked: details.linked,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Evento resumen del cierre técnico de una ocupación (P0-D.3A). Un solo
 * evento por request, `timestamp` definido una sola vez (a diferencia de
 * otros loggers ajenos a este alcance que lo duplicaban — deuda heredada,
 * no corregida acá por estar fuera de los archivos permitidos). Nunca
 * incluye `expectedOcupacionId`/`ocupacionId` completos, `credencialId`,
 * token, tokenHash, cookie, `actorId` completo, email, nombre, teléfono, IP,
 * user agent, body, headers, coordenadas, stack completo ni el objeto
 * Prisma completo.
 */
export function logMesaOccupancyCloseEvent(details: {
  negocioId: string
  mesaNumero: number
  actorType: "negocio" | "salon" | "mozo"
  outcome: "closed" | "no_active" | "occupancy_changed" | "forbidden" | "inconsistent" | "error" | "pending_orders"
  revokedCredentials: number
}) {
  console.info("[MesaOccupancy] mesa_occupancy_close", {
    negocioId: shortId(details.negocioId),
    mesaNumero: details.mesaNumero,
    actorType: details.actorType,
    outcome: details.outcome,
    revokedCredentials: details.revokedCredentials,
    timestamp: new Date().toISOString(),
  })
}
