// P2-T05 (F-P0-03): capa de almacenamiento normalizado multi-dispositivo para
// push subscriptions. NO conoce cookies, sesiones, HTTP Request/Response,
// PushManager/ServiceWorker ni UI — recibe una identidad de owner YA
// resuelta y tipada por la capa server (rutas de Stage3), nunca deriva
// identidad de un input de navegador.
//
// P2-T05 Stage1C (F-P2-T05-03, reconciliacion con el invariante P0 I4): el
// endpoint/keys que trae cualquier caller NUNCA es prueba de posesion (P0 ya
// rechazo el "Modelo D" de transferencia por crear un DoS cross-actor). Por
// eso NINGUNA funcion de este archivo borra o modifica la fila de un owner
// distinto al que la solicita — la unica excepcion es
// `sweepDeadPushSubscriptionEndpoint`, que borra por endpoint SIN filtrar
// por owner porque un 404/410 del proveedor significa que el endpoint esta
// fisicamente muerto para TODO owner que lo referencie (nunca un ataque:
// esa senal viene del proveedor Web Push, no de un cliente HTTP).
import { db } from "@/lib/db"
import {
  Prisma,
  PrismaClient,
  PushSubscriptionChannel,
  PushSubscriptionOwnerType,
  type PushSubscription,
} from "@prisma/client"

export type { PushSubscriptionOwnerType, PushSubscriptionChannel } from "@prisma/client"

// P2-T05 Stage3 (transaction client support): las rutas HTTP que hacen
// dual-write (legacy + normalizado) necesitan que estas dos primitivas
// participen en la MISMA transacción Prisma que su escritura legacy. Por
// default siguen usando el singleton — ningún caller existente (incluida
// Stage2H) se ve afectado.
type PushSubscriptionDbClient = PrismaClient | Prisma.TransactionClient

const OWNER_TYPES: readonly PushSubscriptionOwnerType[] = [
  PushSubscriptionOwnerType.cliente,
  PushSubscriptionOwnerType.negocio,
  PushSubscriptionOwnerType.repartidor,
  PushSubscriptionOwnerType.empleado,
]
const CHANNELS: readonly PushSubscriptionChannel[] = [PushSubscriptionChannel.default, PushSubscriptionChannel.salon]

export interface PushSubscriptionOwner {
  ownerType: PushSubscriptionOwnerType
  ownerId: string
  channel: PushSubscriptionChannel
}

export interface PushSubscriptionOwnerScope {
  ownerType: PushSubscriptionOwnerType
  ownerId: string
}

export interface NormalizedPushSubscriptionInput {
  endpoint: string
  p256dh: string
  auth: string
  expirationTime: Date | null
}

function assertValidOwner(owner: PushSubscriptionOwner): void {
  assertValidOwnerType(owner.ownerType)
  assertValidChannel(owner.channel)
  assertValidOwnerId(owner.ownerId)
}

function assertValidOwnerScope(owner: PushSubscriptionOwnerScope): void {
  assertValidOwnerType(owner.ownerType)
  assertValidOwnerId(owner.ownerId)
}

function assertValidOwnerType(ownerType: PushSubscriptionOwnerType): void {
  if (!OWNER_TYPES.includes(ownerType)) {
    throw new Error("push-subscription-repository: ownerType invalido")
  }
}

function assertValidChannel(channel: PushSubscriptionChannel): void {
  if (!CHANNELS.includes(channel)) {
    throw new Error("push-subscription-repository: channel invalido")
  }
}

function assertValidOwnerId(ownerId: string): void {
  if (typeof ownerId !== "string" || ownerId.trim().length === 0) {
    throw new Error("push-subscription-repository: ownerId invalido")
  }
}

function assertValidSubscriptionInput(input: NormalizedPushSubscriptionInput): void {
  if (typeof input.endpoint !== "string" || input.endpoint.trim().length === 0) {
    throw new Error("push-subscription-repository: endpoint invalido")
  }
  if (typeof input.p256dh !== "string" || input.p256dh.trim().length === 0) {
    throw new Error("push-subscription-repository: p256dh invalido")
  }
  if (typeof input.auth !== "string" || input.auth.trim().length === 0) {
    throw new Error("push-subscription-repository: auth invalido")
  }
}

function assertValidEndpoint(endpoint: string): void {
  if (typeof endpoint !== "string" || endpoint.trim().length === 0) {
    throw new Error("push-subscription-repository: endpoint invalido")
  }
}

/**
 * Registra (crea o actualiza idempotentemente) la subscription física de UN
 * owner+channel+endpoint. Nunca toca ni conoce filas de otros owners — bajo
 * ninguna circunstancia esta función elimina el binding de un owner
 * distinto al que la solicita (P2-T05 Stage1C, F-P2-T05-03).
 *
 * Mismo owner + mismo endpoint (re-suscripción, incluso concurrente): el
 * `upsert` sobre `UNIQUE(ownerType, ownerId, channel, endpoint)` garantiza
 * atómicamente una única fila final, con p256dh/auth/expirationTime/updatedAt
 * actualizados a los últimos valores recibidos (rotación de keys).
 *
 * Mismo owner + endpoint distinto: agrega una fila nueva (multi-device).
 *
 * Owner distinto + mismo endpoint (multi-bind entre actores, o replay de un
 * endpoint ajeno): crea/actualiza SOLO la fila propia del owner que llama —
 * la fila de cualquier otro owner que ya tuviera ese mismo endpoint
 * permanece intacta.
 */
export async function registerPushSubscription(
  owner: PushSubscriptionOwner,
  input: NormalizedPushSubscriptionInput,
  client: PushSubscriptionDbClient = db
): Promise<PushSubscription> {
  assertValidOwner(owner)
  assertValidSubscriptionInput(input)

  return client.pushSubscription.upsert({
    where: {
      ownerType_ownerId_channel_endpoint: {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        channel: owner.channel,
        endpoint: input.endpoint,
      },
    },
    create: {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      channel: owner.channel,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      expirationTime: input.expirationTime,
    },
    update: {
      p256dh: input.p256dh,
      auth: input.auth,
      expirationTime: input.expirationTime,
    },
  })
}

/**
 * Devuelve exclusivamente las filas del owner+channel exactos. Nunca
 * devuelve filas de otros owners, aunque compartan el mismo endpoint físico.
 */
export async function getPushSubscriptionsForOwner(owner: PushSubscriptionOwner): Promise<PushSubscription[]> {
  assertValidOwner(owner)

  return db.pushSubscription.findMany({
    where: {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      channel: owner.channel,
    },
  })
}

/**
 * Devuelve las filas normalizadas de varios owners con una única lectura.
 * El resultado siempre contiene una entrada para cada owner solicitado,
 * incluso cuando no tiene subscriptions; las filas inesperadas del mock o
 * del driver quedan fuera de forma fail-closed y nunca se exponen al caller.
 */
export async function getPushSubscriptionsForOwners(
  ownerType: PushSubscriptionOwnerType,
  ownerIds: string[],
  channel: PushSubscriptionChannel
): Promise<Map<string, PushSubscription[]>> {
  assertValidOwnerType(ownerType)
  assertValidChannel(channel)

  const uniqueOwnerIds = Array.from(new Set(ownerIds))
  uniqueOwnerIds.forEach(assertValidOwnerId)

  const grouped = new Map<string, PushSubscription[]>()
  for (const ownerId of uniqueOwnerIds) grouped.set(ownerId, [])
  if (uniqueOwnerIds.length === 0) return grouped

  const rows = await db.pushSubscription.findMany({
    where: {
      ownerType,
      ownerId: { in: uniqueOwnerIds },
      channel,
    },
  })

  for (const row of rows) {
    if (row.ownerType !== ownerType || row.channel !== channel) continue
    const ownerRows = grouped.get(row.ownerId)
    if (ownerRows) ownerRows.push(row)
  }

  return grouped
}

/**
 * Detach exacto de UN dispositivo físico de UN owner+channel — nunca toca
 * otras filas del mismo owner (otros endpoints) ni de ningún otro owner que
 * comparta ese mismo endpoint (P2-T05 Stage1C).
 */
export async function detachPushSubscriptionByEndpoint(
  owner: PushSubscriptionOwner,
  endpoint: string,
  client: PushSubscriptionDbClient = db
): Promise<{ detached: boolean }> {
  assertValidOwner(owner)
  assertValidEndpoint(endpoint)

  const result = await client.pushSubscription.deleteMany({
    where: {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      channel: owner.channel,
      endpoint,
    },
  })

  return { detached: result.count > 0 }
}

/**
 * Existence check exacta de UN owner+channel+endpoint — usada por
 * `POST /api/push/status` (P2-T05 Stage3R1, F-P2-T05-12/13) para responder
 * únicamente "¿esta subscription física actual está vinculada server-side a
 * este actor?", nunca "¿el actor tiene alguna subscription en general?".
 * Read-only, no expone p256dh/auth/id ni ninguna otra fila.
 */
export async function hasPushSubscriptionForOwnerEndpoint(
  owner: PushSubscriptionOwner,
  endpoint: string
): Promise<boolean> {
  assertValidOwner(owner)
  assertValidEndpoint(endpoint)

  const row = await db.pushSubscription.findFirst({
    where: {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      channel: owner.channel,
      endpoint,
    },
    select: { id: true },
  })

  return row !== null
}

/**
 * Barrido de endpoint físicamente muerto (404/410 del proveedor Web Push).
 * A diferencia de `detachPushSubscriptionByEndpoint`, esta función borra
 * TODAS las filas normalizadas que referencian ese endpoint, sin filtrar por
 * ownerType/ownerId/channel — un 404/410 significa que el endpoint dejó de
 * existir para cualquiera que lo tuviera guardado, y esa señal viene siempre
 * del proveedor Web Push, nunca de un cliente HTTP (no es una superficie
 * explotable por un actor malicioso).
 *
 * ADVERTENCIA (P2-T05 Stage2B): NUNCA invocar esta función desde una ruta de
 * "desactivar notificaciones"/detach de usuario — para ese caso usar siempre
 * `detachPushSubscriptionByEndpoint`, que está acotado al owner que hace la
 * request. Esta función sólo debe llamarse desde el pipeline de envío, tras
 * confirmar un 404/410 real del proveedor para ESE endpoint exacto.
 */
export async function sweepDeadPushSubscriptionEndpoint(endpoint: string): Promise<{ count: number }> {
  assertValidEndpoint(endpoint)

  const result = await db.pushSubscription.deleteMany({
    where: { endpoint },
  })

  return { count: result.count }
}

/**
 * Borra todas las subscriptions de un owner lógico (ownerType+ownerId) a
 * través de todos sus channels — uso: desactivación/eliminación de cuenta.
 * Requiere ownerType explícito (nunca sólo ownerId) para no arriesgar un
 * borrado cruzado entre actores que pudieran compartir el mismo valor de id
 * por coincidencia entre modelos distintos.
 */
export async function deletePushSubscriptionsForOwner(owner: PushSubscriptionOwnerScope): Promise<{ count: number }> {
  assertValidOwnerScope(owner)

  const result = await db.pushSubscription.deleteMany({
    where: {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
    },
  })

  return { count: result.count }
}
