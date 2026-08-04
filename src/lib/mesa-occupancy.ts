import { randomBytes, createHash } from "crypto"
import type { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"

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

const OCCUPANCY_COOKIE_MAX_AGE_SECONDS = 6 * 60 * 60 // 6 horas — prepara la futura expiración por inactividad (P0-D.3)

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

function isSerializationConflict(error: unknown): boolean {
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

async function runSerializableTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_SERIALIZATION_RETRIES; attempt++) {
    try {
      return await db.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      })
    } catch (error) {
      lastError = error
      if (error instanceof MultipleActiveOccupanciesError || !isRetryableOccupancyConflict(error) || attempt === MAX_SERIALIZATION_RETRIES) {
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
}

/**
 * Abre o reutiliza la ocupación activa de una mesa ya resuelta server-side.
 * Nunca acepta como autoridad ningún dato enviado por el cliente más allá
 * del token opaco de su propia cookie (que solo sirve para buscar SU credencial,
 * nunca para identificar la mesa/negocio/ocupación). `negocioId` y `mesaId`
 * deben venir siempre de una resolución server-side previa (nunca del body).
 */
export async function openOrReuseMesaOccupancy(params: {
  negocioId: string
  mesaId: string
  existingToken: string | null
}): Promise<MesaOccupancyOutcome> {
  const { negocioId, mesaId, existingToken } = params
  const existingTokenHash = existingToken ? hashMesaOccupancyToken(existingToken) : null
  const now = Date.now()

  return runSerializableTransaction(async (tx) => {
    const mesa = await tx.mesa.findUnique({
      where: { id: mesaId },
      select: { id: true, negocioId: true, ocupacionActualId: true },
    })

    if (!mesa || mesa.negocioId !== negocioId) {
      // La mesa ya fue validada por el llamador (misma consulta que resolvió
      // negocioId/mesaId) — este caso no debería ocurrir nunca en la práctica.
      throw new Error("Mesa no coincide con el negocio resuelto server-side")
    }

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
      // ---- Mesa con ocupación activa: reutilizar ----
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

        return { newToken: null, occupancyCreated: false, credentialCreated: false, pointerRepaired }
      }

      // Cookie ausente, inválida, de otra ocupación/mesa/negocio, o
      // revocada: nueva credencial para ESTE dispositivo, misma ocupación.
      const rawToken = generateMesaOccupancyToken()
      await tx.credencialOcupacionMesa.create({
        data: { ocupacionId: activeOcupacion.id, tokenHash: hashMesaOccupancyToken(rawToken) },
      })

      return { newToken: rawToken, occupancyCreated: false, credentialCreated: true, pointerRepaired }
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

    const rawToken = generateMesaOccupancyToken()
    await tx.credencialOcupacionMesa.create({
      data: { ocupacionId: nuevaOcupacion.id, tokenHash: hashMesaOccupancyToken(rawToken) },
    })

    return { newToken: rawToken, occupancyCreated: true, credentialCreated: true, pointerRepaired: false }
  })
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
