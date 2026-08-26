// ============================================
// DeliGO - Push Notification Utilities
// ============================================
// VAPID-based web push notifications + DB persistence

import webpush from "web-push"
import type { PushSubscription } from "@prisma/client"
import { safeErrorForLog } from "@/lib/log-safe-error"
import {
  arePushSubscriptionsEquivalent,
  parsePushSubscriptionShape,
  type ParsedPushSubscriptionShape,
} from "@/lib/push-subscription-http"

// VAPID keys - generate once and store in env vars
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || ""
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ""
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:deligo@app.com"

// Initialize web-push with VAPID details
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

// Check if push notifications are configured
export function isPushConfigured(): boolean {
  return !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY)
}

// Get the public key for client-side subscription
export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY
}

// ============================================
// Push Notification Types
// ============================================

export type NotificationType =
  | "order_update"
  | "new_order"
  | "new_delivery"
  | "review"
  | "chat"
  | "general"
  | "review_request"
  | "account_update"
  | "mesa_order_ready"
  | "salon_new_order"
  | "operaciones_salon_new_order"
  | "operaciones_order_cancelled"

export interface PushNotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  image?: string
  tag?: string
  data?: {
    type: NotificationType
    url?: string
    pedidoId?: string
    negocioId?: string
    [key: string]: unknown
  }
  actions?: Array<{
    action: string
    title: string
    icon?: string
  }>
  requireInteraction?: boolean
  silent?: boolean
}

// ============================================
// Navigation Target per Role
// ============================================
// When a notification is clicked, we navigate the user to the correct tab/section

export interface NavigationTarget {
  cliente?: string   // tab for cliente page
  negocio?: string   // tab for negocio panel
  repartidor?: string // tab for repartidor panel
  empleado?: string  // tab/section for empleado (mozo PWA at /m/[token])
  salon?: string     // tab/section for salon shared display (/s/[token])
  empleados?: string // tab for empleados shared panel (/e/[token])
}

export type OperationsCancellationArea = "salon" | "pyr"

export function buildOperationsCancellationUrl(
  slug: string,
  area: OperationsCancellationArea,
  pedidoId: string
): string {
  const panelPath = area === "salon" ? "salon" : "pyr/pedidos"
  return `/operaciones/mi-panel/${encodeURIComponent(slug)}/${panelPath}?pedidoId=${encodeURIComponent(pedidoId)}`
}

// Maps notification type → navigation target per role
function getNavigationTarget(
  tipo: NotificationType,
  pedidoId?: string | null,
  negocioId?: string | null
): NavigationTarget {
  switch (tipo) {
    case "new_order":
      return {
        negocio: `pedidos`,
        // For negocio, we also want to highlight the specific order
      }
    case "order_update":
      return {
        cliente: "pedidos",
        negocio: "pedidos",
        repartidor: "entregas",
      }
    case "new_delivery":
      return {
        repartidor: "entregas",
      }
    case "chat":
      return {
        cliente: "pedidos",
        negocio: "pedidos",
        repartidor: "entregas",
      }
    case "review":
      return {
        negocio: "resenas",
        cliente: "pedidos",
      }
    case "review_request":
      return {
        cliente: "pedidos",
      }
    case "account_update":
      return {
        negocio: "config",
      }
    case "mesa_order_ready":
      return {
        // Mozo notifications go back to the salon page
        empleado: "salon",
      }
    case "salon_new_order":
      // New mesa order arrived at the salon shared display
      return {
        salon: "salon",
      }
    default:
      return {}
  }
}

// ============================================
// Create + Persist Notification
// ============================================

interface CreateNotificationParams {
  userId: string
  userType: string // "cliente" | "negocio" | "repartidor" | "superadmin" | "empleado"
  tipo: NotificationType
  titulo: string
  cuerpo: string
  pedidoId?: string | null
  negocioId?: string | null
  /**
   * 19-B0.2E1: provenance estructurada — el Cliente cuyos datos (nombre,
   * dirección, texto) están embebidos en `titulo`/`cuerpo` cuando el
   * DESTINATARIO (`userId`/`userType`) es OTRO actor (Negocio/Repartidor).
   * Nunca representa al destinatario ni lo reemplaza. Sólo debe pasarse
   * cuando el caller conoce con certeza al Cliente de origen (nunca se
   * infiere acá a partir de `titulo`/`cuerpo`/`pedidoId`) — omitir cuando la
   * notificación no embebe PII de un Cliente distinto del destinatario.
   */
  sourceClienteId?: string | null
  /** Additional data for navigation/action (JSON-serializable) */
  datos?: Record<string, unknown>
  /** If provided, also send a push notification to this subscription */
  pushSubscription?: string | null
  pushPayload?: PushNotificationPayload
  /** If provided, clean up expired push subscription on failure */
  cleanupExpired?: PushSubscriptionCleanup
  /** If true, await the push send so errors surface in logs (default: false, fire-and-forget) */
  awaitPush?: boolean
  /** Endpoints already used by this logical event across notification channels */
  reservedPushEndpoints?: Set<string>
}

// P2-T05 Hardening H1 (F-P2-T05-19): unión discriminada — el canal SALON
// (legacy-only, ver Stage3F) sólo es representable con `channel:"salon"` Y
// `field:"pushSubscriptionSalon"` juntos; cualquier objeto que traiga
// `field:"pushSubscriptionSalon"` SIN `channel:"salon"` no matchea ninguna
// de las dos variantes y es un error de TypeScript en tiempo de compilación
// (nunca sólo una convención de runtime como antes). `channel` es ahora la
// autoridad para decidir elegibilidad de fan-out normalizado
// (`isCorePushOwner` en `createNotification`) — `field` sigue existiendo
// exclusivamente para elegir qué columna legacy recibe el CAS-clear en
// `sendPushNotification`, nunca para decidir el canal.
type PushSubscriptionCleanupBase = {
  model: string
  id: string
  suppressEndpointLog?: boolean
  onExpired?: () => void
  /**
   * P2-T05 Stage4: otros owners LEGACY (cross-actor shared endpoint, ver
   * `groupByEndpoint` en salon-new-order-notification.ts/
   * operations-cancellation-notification.ts) que también deben intentar un
   * CAS-clear seguro si el proveedor confirma 404/410 para el mismo
   * endpoint físico — nunca un blind clear, misma comparación semántica que
   * el owner principal.
   */
  additionalLegacyOwners?: Array<{ model: string; id: string; field?: string }>
}

export type PushSubscriptionCleanup =
  | (PushSubscriptionCleanupBase & { channel?: "default"; field?: "pushSubscription" })
  | (PushSubscriptionCleanupBase & { channel: "salon"; field: "pushSubscriptionSalon" })

export function getPushSubscriptionEndpoint(subscriptionJson: string): string | null {
  try {
    const parsed = JSON.parse(subscriptionJson) as { endpoint?: unknown }
    return typeof parsed.endpoint === "string" && parsed.endpoint.trim()
      ? parsed.endpoint.trim()
      : null
  } catch {
    return null
  }
}

export function reservePushEndpoint(
  subscriptionJson: string,
  reservedEndpoints: Set<string>
): boolean {
  const endpoint = getPushSubscriptionEndpoint(subscriptionJson)
  if (!endpoint) return true
  if (reservedEndpoints.has(endpoint)) return false
  reservedEndpoints.add(endpoint)
  return true
}

// ============================================
// P2-T05 Stage4: safe legacy dead-endpoint cleanup (CAS, no blind clear)
// ============================================
// Reemplaza el blind-clear-by-actor-id histórico (F-P2-T05-16/17 ya
// endurecieron el detach de usuario con este mismo patrón semántico +
// compare-and-set; acá se reutiliza para el ÚNICO caso legítimo de barrido
// automático: una confirmación 404/410 real del proveedor Web Push).
// Nunca se llama desde un flujo de detach de usuario — eso sigue siendo
// exclusivamente `detachPushSubscriptionByEndpoint` (exact-match, nunca
// endpoint-global) en las rutas de unsubscribe.

async function readCurrentLegacyPushValue(model: string, id: string, field: string): Promise<string | null> {
  const { db } = await import("@/lib/db")
  switch (model) {
    case "cliente":
      return (await db.cliente.findUnique({ where: { id }, select: { pushSubscription: true } }))?.pushSubscription ?? null
    case "negocio":
      if (field === "pushSubscriptionSalon") {
        return (await db.negocio.findUnique({ where: { id }, select: { pushSubscriptionSalon: true } }))?.pushSubscriptionSalon ?? null
      }
      return (await db.negocio.findUnique({ where: { id }, select: { pushSubscription: true } }))?.pushSubscription ?? null
    case "repartidor":
      return (await db.repartidor.findUnique({ where: { id }, select: { pushSubscription: true } }))?.pushSubscription ?? null
    case "empleado":
      return (await db.empleado.findUnique({ where: { id }, select: { pushSubscription: true } }))?.pushSubscription ?? null
    case "superadmin":
      return (await db.superAdmin.findUnique({ where: { id }, select: { pushSubscription: true } }))?.pushSubscription ?? null
    default:
      return null
  }
}

async function casClearLegacyPushValue(model: string, id: string, field: string, expectedCurrentRaw: string): Promise<boolean> {
  const { db } = await import("@/lib/db")
  switch (model) {
    case "cliente": {
      const r = await db.cliente.updateMany({ where: { id, pushSubscription: expectedCurrentRaw }, data: { pushSubscription: null } })
      return r.count > 0
    }
    case "negocio": {
      if (field === "pushSubscriptionSalon") {
        const r = await db.negocio.updateMany({ where: { id, pushSubscriptionSalon: expectedCurrentRaw }, data: { pushSubscriptionSalon: null } })
        return r.count > 0
      }
      const r = await db.negocio.updateMany({ where: { id, pushSubscription: expectedCurrentRaw }, data: { pushSubscription: null } })
      return r.count > 0
    }
    case "repartidor": {
      const r = await db.repartidor.updateMany({ where: { id, pushSubscription: expectedCurrentRaw }, data: { pushSubscription: null } })
      return r.count > 0
    }
    case "empleado": {
      const r = await db.empleado.updateMany({ where: { id, pushSubscription: expectedCurrentRaw }, data: { pushSubscription: null } })
      return r.count > 0
    }
    case "superadmin": {
      const r = await db.superAdmin.updateMany({ where: { id, pushSubscription: expectedCurrentRaw }, data: { pushSubscription: null } })
      return r.count > 0
    }
    default:
      return false
  }
}

/**
 * Lee el valor legacy ACTUAL, lo compara semánticamente (nunca sólo por
 * endpoint) contra la subscription que realmente falló, y sólo si coinciden
 * hace un CAS exacto contra ese mismo valor observado. Si cambió entre la
 * lectura y el intento de limpieza (otro dispositivo escribió), el CAS no
 * matchea y no se borra nada — el binding más nuevo sobrevive intacto.
 */
async function safeClearLegacyIfMatches(
  model: string,
  id: string,
  field: string,
  expectedShape: ParsedPushSubscriptionShape
): Promise<boolean> {
  try {
    const currentRaw = await readCurrentLegacyPushValue(model, id, field)
    if (!currentRaw) return false
    const currentParsed = parsePushSubscriptionShape(currentRaw)
    if (!currentParsed || !arePushSubscriptionsEquivalent(currentParsed, expectedShape)) return false
    return await casClearLegacyPushValue(model, id, field, currentRaw)
  } catch (error) {
    console.error("[Push] Error en cleanup CAS de legacy:", safeErrorForLog(error))
    return false
  }
}

// ============================================
// P2-T05 Stage4: normalized multi-device fan-out target resolution
// ============================================

export type CorePushOwnerType = "cliente" | "negocio" | "repartidor" | "empleado"

export interface PushFanoutTarget {
  /** JSON string listo para pasar a `sendPushNotification`. */
  raw: string
  endpoint: string
  /** Contexto de limpieza legacy/normalizada para ESTE target específico. */
  cleanup?: PushSubscriptionCleanup
}

type NormalizedPushSubscriptionRow = Pick<PushSubscription, "endpoint" | "p256dh" | "auth" | "expirationTime">

/**
 * Resuelve el conjunto de targets físicos únicos (por endpoint) para UN
 * owner core: UNION de sus PushSubscription normalizadas + su legacy actual
 * (nunca sólo fallback-cuando-vacío — durante mixed-version rollout el
 * legacy puede tener un binding válido aún no reflejado en normalized). Si
 * la consulta normalizada falla inesperadamente, degrada a legacy-only en
 * vez de abortar toda la notificación lógica. Legacy malformado/vacío nunca
 * aborta los targets normalizados — simplemente se omite.
 */
export function resolveCorePushTargetsFromNormalized(
  ownerType: CorePushOwnerType,
  ownerId: string,
  legacyRaw: string | null | undefined,
  normalizedRows: readonly NormalizedPushSubscriptionRow[]
): PushFanoutTarget[] {
  const byEndpoint = new Map<string, PushFanoutTarget>()
  const cleanup: PushSubscriptionCleanup = {
    model: ownerType,
    id: ownerId,
    field: "pushSubscription",
    suppressEndpointLog: true,
  }

  for (const row of normalizedRows) {
    byEndpoint.set(row.endpoint, {
      endpoint: row.endpoint,
      raw: JSON.stringify({
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
        expirationTime: row.expirationTime ? row.expirationTime.getTime() : null,
      }),
      cleanup,
    })
  }

  if (legacyRaw) {
    const parsedLegacy = parsePushSubscriptionShape(legacyRaw)
    if (parsedLegacy && !byEndpoint.has(parsedLegacy.endpoint)) {
      byEndpoint.set(parsedLegacy.endpoint, { endpoint: parsedLegacy.endpoint, raw: legacyRaw, cleanup })
    }
    // Legacy inválido/malformado: se omite silenciosamente, nunca aborta
    // los targets normalizados ya resueltos.
  }

  return Array.from(byEndpoint.values())
}

export async function resolveCorePushTargets(
  ownerType: CorePushOwnerType,
  ownerId: string,
  legacyRaw: string | null | undefined,
  channel: "default" | "salon" = "default"
): Promise<PushFanoutTarget[]> {
  let normalizedRows: PushSubscription[] = []
  try {
    const { getPushSubscriptionsForOwner } = await import("@/lib/push-subscription-repository")
    normalizedRows = await getPushSubscriptionsForOwner({ ownerType, ownerId, channel })
  } catch (error) {
    console.error("[Push] Error leyendo targets normalizados, degradando a legacy:", safeErrorForLog(error))
  }

  return resolveCorePushTargetsFromNormalized(ownerType, ownerId, legacyRaw, normalizedRows)
}

/**
 * P2-T05 Hardening H1 (F-P2-T05-20): compara ÚNICAMENTE el material
 * criptográfico (p256dh/auth) de dos targets que ya comparten el mismo
 * `endpoint` — nunca `expirationTime`, que es metadata operativa de
 * renovación (no identidad del dispositivo) y puede legítimamente diferir
 * entre la fila normalizada y el legacy JSON de la MISMA subscription real
 * sin que eso signifique una subscription físicamente distinta. Un fallo de
 * parseo (no debería ocurrir — ambos `raw` ya vienen de targets
 * previamente validados) se trata de forma conservadora como "no puedo
 * confirmar que sean la misma" — fail-closed, nunca fail-open.
 */
function sameFanoutSubscriptionKeys(rawA: string, rawB: string): boolean {
  const a = parsePushSubscriptionShape(rawA)
  const b = parsePushSubscriptionShape(rawB)
  if (!a || !b) return false
  return a.keys.p256dh === b.keys.p256dh && a.keys.auth === b.keys.auth
}

/**
 * Combina los targets de VARIOS recipients (fan-out multi-recipient, p.ej.
 * todos los mozos de salón de un negocio) en una lista única deduplicada
 * por endpoint físico — un mismo dispositivo compartido entre dos owners
 * (MODEL-C1) recibe UN solo send, pero conserva el cleanup de AMBOS owners
 * vía `additionalLegacyOwners` para que un 404/410 pueda limpiar el legacy
 * de cada uno con su propio CAS. El dedupe es exclusivamente de esta wave
 * lógica — nunca persistente entre notificaciones distintas.
 *
 * P2-T05 Hardening H1 (F-P2-T05-20): si dos owners DISTINTOS reportan el
 * MISMO endpoint físico con material criptográfico DIVERGENTE (p256dh/auth
 * distintos), la subscription real de ese endpoint es ambigua — nunca se
 * transfiere ownership, nunca se borra la fila de ningún owner, nunca se
 * adivina cuál de los dos es "más nueva", nunca se envía con material
 * arbitrario, y nunca se interpreta como un 404/410 del proveedor (esa
 * señal sólo puede venir de una respuesta HTTP real de Web Push). Se
 * excluye ÚNICAMENTE ese endpoint conflictivo de esta wave de envío — el
 * resto de los endpoints válidos se envían normalmente — y el resultado es
 * el mismo sin importar el orden de `targetLists` (comparación siempre
 * contra el primer target resuelto para ese endpoint; en cuanto se detecta
 * UNA divergencia el endpoint queda marcado conflictivo de forma permanente
 * para el resto de esta llamada, sin volver a agregarse aunque aparezca un
 * tercer duplicado con keys coincidentes).
 */
export function mergePushFanoutTargets(targetLists: PushFanoutTarget[][]): PushFanoutTarget[] {
  const byEndpoint = new Map<string, PushFanoutTarget>()
  const conflicted = new Set<string>()
  for (const list of targetLists) {
    for (const t of list) {
      if (conflicted.has(t.endpoint)) continue
      const existing = byEndpoint.get(t.endpoint)
      if (!existing) {
        byEndpoint.set(t.endpoint, { ...t })
        continue
      }
      if (!sameFanoutSubscriptionKeys(existing.raw, t.raw)) {
        byEndpoint.delete(t.endpoint)
        conflicted.add(t.endpoint)
        console.warn("[Push] Endpoint deduplicado con material de subscription en conflicto entre owners; target omitido de esta wave.")
        continue
      }
      if (t.cleanup && existing.cleanup && t.cleanup.id !== existing.cleanup.id) {
        const extra = { model: t.cleanup.model, id: t.cleanup.id, field: t.cleanup.field }
        existing.cleanup = {
          ...existing.cleanup,
          additionalLegacyOwners: [...(existing.cleanup.additionalLegacyOwners ?? []), extra],
        }
      }
    }
  }
  return Array.from(byEndpoint.values())
}

/**
 * Envía el mismo payload a todos los targets con aislamiento de fallas
 * por-endpoint (`Promise.allSettled` — un fallo en E1 nunca aborta E2/E3).
 * Sin reintentos automáticos: un fallo transitorio se loguea y se continúa.
 */
export const WEBPUSH_SEND_CONCURRENCY = 8

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  worker: (item: T) => Promise<R>,
  concurrency: number
): Promise<PromiseSettledResult<R>[]> {
  if (items.length === 0) return []

  const results = new Array<PromiseSettledResult<R>>(items.length)
  let nextIndex = 0

  async function runWorker(): Promise<void> {
    while (true) {
      const index = nextIndex++
      if (index >= items.length) return
      try {
        results[index] = { status: "fulfilled", value: await worker(items[index]) }
      } catch (reason) {
        results[index] = { status: "rejected", reason }
      }
    }
  }

  const workerCount = Math.min(concurrency, items.length)
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()))
  return results
}

export async function sendPushToTargets(
  targets: PushFanoutTarget[],
  payload: PushNotificationPayload
): Promise<{ attempted: number; delivered: number }> {
  if (targets.length === 0) return { attempted: 0, delivered: 0 }

  const results = await mapWithConcurrency(
    targets,
    (t) => sendPushNotification(t.raw, payload, t.cleanup),
    WEBPUSH_SEND_CONCURRENCY
  )

  let delivered = 0
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) {
      delivered += 1
    } else if (r.status === "rejected") {
      console.error("[Push] Fan-out: un target falló de forma aislada:", safeErrorForLog(r.reason))
    }
  }
  return { attempted: targets.length, delivered }
}

// Bugfix-4 [17]: rol de PWA "personal" (con sesión) a la que pertenece la
// notificación. El service worker lo usa para saber qué app abrir/enfocar
// cuando no hay ninguna ventana abierta (antes siempre abría /cliente/,
// aunque la notificación fuera para negocio o repartidor). Roles sin PWA
// personal (empleado, salon, superadmin) devuelven undefined: el SW conserva
// su comportamiento previo (rama de "shared-display" o fallback a cliente).
function personalRoleFor(userType: string): "cliente" | "negocio" | "repartidor" | undefined {
  if (userType === "cliente" || userType === "negocio" || userType === "repartidor") return userType
  return undefined
}

/**
 * Creates a notification in the database and optionally sends a push notification.
 * This is the main entry point for all notification creation.
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  const {
    userId,
    userType,
    tipo,
    titulo,
    cuerpo,
    pedidoId,
    negocioId,
    sourceClienteId,
    datos,
    pushSubscription,
    pushPayload,
    cleanupExpired,
    awaitPush,
    reservedPushEndpoints,
  } = params

  // Build navigation data
  const navTarget = getNavigationTarget(tipo, pedidoId, negocioId)
  const navigationData: Record<string, unknown> = {
    ...datos,
    // Store the navigation target for the recipient's role
    navigateTo: navTarget,
  }

  // Bugfix-4 [17]: enriquecer el payload de push con el rol real del destinatario
  // y el pedidoId, en un único lugar (en vez de tocar cada fábrica de payload).
  // El service worker usa esto para abrir la PWA correcta y navegar al pedido
  // exacto en vez de siempre caer en /cliente/.
  const enrichedPushPayload: PushNotificationPayload | undefined = pushPayload
    ? {
        ...pushPayload,
        data: {
          ...pushPayload.data,
          type: pushPayload.data?.type ?? tipo,
          role: personalRoleFor(userType),
          pedidoId: pushPayload.data?.pedidoId ?? pedidoId ?? undefined,
        },
      }
    : undefined

  // 1. Persist notification in DB
  try {
    const { db } = await import("@/lib/db")
    await db.notificacion.create({
      data: {
        userId,
        userType,
        tipo,
        titulo,
        cuerpo,
        pedidoId: pedidoId || null,
        negocioId: negocioId || null,
        sourceClienteId: sourceClienteId || null,
        datos: JSON.stringify(navigationData),
      },
    })
  } catch (error) {
    console.error("[Notificacion] Error persisting notification:", safeErrorForLog(error))
    // Don't fail the whole operation if DB write fails
  }

  // 2. Send push notification if a payload was built
  if (enrichedPushPayload) {
    // P2-T05 Stage4 + Hardening H1 (F-P2-T05-19): los 4 owners core reciben
    // fan-out multi-device (normalizado UNION legacy) SÓLO en su canal
    // personal por defecto; cualquier otro userType (superadmin, P2-T17)
    // preserva exactamente el envío legacy single-subscription de siempre.
    // La autoridad de canal es ahora `cleanupExpired.channel` (type-safe,
    // ver PushSubscriptionCleanup arriba) — no la presencia/ausencia de
    // `field`. Un `channel:"salon"` explícito (p.ej. Negocio.
    // pushSubscriptionSalon — canal compartido legacy-only, ver Stage3F) es
    // la señal de que este NO es el canal personal normalizado del owner,
    // aunque userId/userType coincidan con uno core — nunca se debe mezclar
    // el push personal del negocio con su display compartido de salón, ni
    // intentar limpiar el campo equivocado en un 404/410.
    const isCorePushOwner =
      (userType === "cliente" || userType === "negocio" || userType === "repartidor" || userType === "empleado") &&
      (cleanupExpired?.channel ?? "default") === "default"

    if (isCorePushOwner) {
      const fanoutPromise = (async () => {
        const targets = await resolveCorePushTargets(userType, userId, pushSubscription ?? null)
        const filtered = reservedPushEndpoints
          ? targets.filter((t) => reservePushEndpoint(t.raw, reservedPushEndpoints))
          : targets
        if (filtered.length === 0) return
        const { attempted, delivered } = await sendPushToTargets(filtered, enrichedPushPayload)
        if (delivered === 0 && attempted > 0) {
          console.warn(`[Push] 0/${attempted} envíos entregados para tipo=${tipo} userId=${userId}`)
        }
      })()
      if (awaitPush) {
        try {
          await fanoutPromise
        } catch (err) {
          console.error(`[Push] Error en fan-out de push (tipo=${tipo} userId=${userId}):`, safeErrorForLog(err))
        }
      } else {
        fanoutPromise.catch((err) => {
          console.error("[Push] Error en fan-out de push:", safeErrorForLog(err))
        })
      }
    } else if (
      pushSubscription &&
      (!reservedPushEndpoints || reservePushEndpoint(pushSubscription, reservedPushEndpoints))
    ) {
      const pushPromise = sendPushNotification(pushSubscription, enrichedPushPayload, cleanupExpired)
      if (awaitPush) {
        // Await the push so errors surface in the caller's logs
        try {
          const sent = await pushPromise
          if (!sent) {
            console.warn(`[Push] sendPushNotification returned false for tipo=${tipo} userId=${userId} (VAPID not configured or subscription expired)`)
          }
        } catch (err) {
          console.error(`[Push] Error sending push notification (tipo=${tipo} userId=${userId}):`, safeErrorForLog(err))
        }
      } else {
        // Fire-and-forget (default for non-critical notifications)
        pushPromise.catch((err) => {
          console.error("[Push] Error sending push notification:", safeErrorForLog(err))
        })
      }
    }
  }
}

// ============================================
// Send Push Notification (raw push only)
// ============================================

export async function sendPushNotification(
  subscriptionJson: string,
  payload: PushNotificationPayload,
  cleanupExpired?: PushSubscriptionCleanup
): Promise<boolean> {
  if (!isPushConfigured()) {
    console.warn("[Push] VAPID keys not configured, skipping notification")
    return false
  }

  let subscription: { endpoint?: string } | null = null
  try {
    subscription = JSON.parse(subscriptionJson)
    await webpush.sendNotification(subscription, JSON.stringify(payload))
    return true
  } catch (error: unknown) {
    const err = error as { statusCode?: number; message?: string; body?: string }
    // GLOBAL-LOGS-PII-1: el endpoint de push es, en la práctica, un
    // identificador de dispositivo de larga duración (equivalente a una
    // credencial del canal push de ese browser/device) — nunca se imprime
    // raw acá, sin importar el caller. `suppressEndpointLog` sigue
    // controlando el detalle adicional (mensaje/body del proveedor) para
    // rutas que ya optaban por un modo aún más estricto.
    const endpoint = "redacted"
    // 410 = subscription expired, 404 = subscription gone
    if (err.statusCode === 410 || err.statusCode === 404) {
      console.log(`[Push] Subscription expired (statusCode=${err.statusCode}, endpoint=${endpoint}), should be removed`)
      try {
        cleanupExpired?.onExpired?.()
      } catch {
        // Expiration callbacks are diagnostic only; cleanup should continue.
      }

      const parsedShape = parsePushSubscriptionShape(subscriptionJson)
      const deadEndpoint = parsedShape?.endpoint ?? getPushSubscriptionEndpoint(subscriptionJson)

      // P2-T05 Stage4: barrido GLOBAL normalizado por endpoint — señal 404/410
      // real del proveedor Web Push, nunca de un cliente HTTP; el mismo
      // endpoint físico puede estar legítimamente ligado a varios owners
      // (MODEL-C1) y todos deben perder esa fila muerta.
      if (deadEndpoint) {
        try {
          const { sweepDeadPushSubscriptionEndpoint } = await import("@/lib/push-subscription-repository")
          await sweepDeadPushSubscriptionEndpoint(deadEndpoint)
        } catch (sweepError) {
          console.error("[Push] Error en barrido normalizado de endpoint muerto:", safeErrorForLog(sweepError))
        }
      }

      // P2-T05 Stage4 (F-P0-03/F-P2-T05-16/17): reemplaza el blind-clear-by-
      // actor-id histórico por el mismo patrón CAS ya certificado en el
      // detach de usuario — sólo limpia legacy si el valor ACTUAL sigue
      // siendo semánticamente la misma subscription que falló. Si el actor
      // ya escribió un binding distinto entre el envío y esta limpieza, el
      // CAS no matchea y ese binding más nuevo sobrevive intacto.
      if (cleanupExpired && parsedShape) {
        const fieldToClear = cleanupExpired.field || "pushSubscription"
        const cleared = await safeClearLegacyIfMatches(cleanupExpired.model, cleanupExpired.id, fieldToClear, parsedShape)
        if (cleared) {
          console.log(`[Push] Legacy limpiado de forma segura (CAS) para ${cleanupExpired.model}:${cleanupExpired.id} (field=${fieldToClear})`)
        }
        if (cleanupExpired.additionalLegacyOwners) {
          for (const extra of cleanupExpired.additionalLegacyOwners) {
            await safeClearLegacyIfMatches(extra.model, extra.id, extra.field || "pushSubscription", parsedShape)
          }
        }
      }
      return false
    }
    // Log the full error details for regular push flows. Sensitive routes can
    // suppress provider details that may include subscription material.
    console.error(
      `[Push] Error sending notification (statusCode=${err.statusCode}, endpoint=${endpoint}):`,
      cleanupExpired?.suppressEndpointLog ? "details suppressed" : err.message || error
    )
    // GLOBAL-LOGS-PII-1: el body crudo de la respuesta del proveedor puede
    // incluir el endpoint/subscription material (según el comentario
    // original de esta función) — nunca se imprime, sin importar el caller.
    if (err.body) {
      console.error(`[Push] Response body received (length=${err.body.length}), withheld from logs`)
    }
    return false
  }
}

// ============================================
// Notification Factories
// ============================================

export function orderUpdateNotification(
  pedidoId: string,
  negocioNombre: string,
  newStatus: string
): PushNotificationPayload {
  const statusMessages: Record<string, string> = {
    confirmado: `${negocioNombre} confirmó tu pedido`,
    preparando: `${negocioNombre} está preparando tu pedido`,
    en_camino: "Tu pedido está en camino 🛵",
    listo_para_retirar: "Tu pedido está listo para retirar 📦",
    entregado: "Tu pedido fue entregado ✅",
    cancelado: `Tu pedido de ${negocioNombre} fue cancelado`,
  }

  return {
    title: "Actualización de pedido",
    body: statusMessages[newStatus] || `Tu pedido cambió a: ${newStatus}`,
    tag: `order-${pedidoId}`,
    data: {
      type: "order_update",
      pedidoId,
      // Bugfix-4B [17B]: se quita el `url` fijo ("/?tab=pedidos", sin rol y
      // sin pedidoId) para que el service worker arme el destino real
      // (rol correcto + pedidoId) en vez de usar este valor incompleto.
    },
    actions: newStatus === "listo_para_retirar"
      ? [{ action: "view", title: "Ver pedido" }]
      : undefined,
    requireInteraction: newStatus === "listo_para_retirar",
  }
}

export function newOrderNotification(
  pedidoId: string,
  clienteNombre: string,
  total: number
): PushNotificationPayload {
  return {
    title: "¡Nuevo pedido! 📩",
    body: `${clienteNombre} hizo un pedido de $${total.toFixed(0)}`,
    tag: `new-order-${pedidoId}`,
    data: {
      type: "new_order",
      pedidoId,
    },
    requireInteraction: true,
    actions: [
      { action: "view", title: "Ver pedido" },
    ],
  }
}

export function newDeliveryNotification(
  pedidoId: string,
  negocioNombre: string,
  direccion: string
): PushNotificationPayload {
  return {
    title: "¡Nueva entrega! 🛵",
    body: `Pedido de ${negocioNombre} - ${direccion || "Retiro en local"}`,
    tag: `delivery-${pedidoId}`,
    data: {
      type: "new_delivery",
      pedidoId,
    },
    requireInteraction: true,
    actions: [
      { action: "navigate", title: "Navegar" },
      { action: "view", title: "Ver detalle" },
    ],
  }
}

export function newReviewNotification(
  negocioNombre: string,
  puntuacion: number,
  clienteNombre: string
): PushNotificationPayload {
  const stars = "⭐".repeat(puntuacion)
  return {
    title: "Nueva reseña ⭐",
    body: `${clienteNombre} dejó ${stars} en ${negocioNombre}`,
    data: {
      type: "review",
    },
  }
}

export function chatMessageNotification(
  pedidoId: string,
  senderName: string,
  messagePreview: string,
  messageId?: string
): PushNotificationPayload {
  return {
    title: `Mensaje de ${senderName}`,
    body: messagePreview.slice(0, 100),
    tag: `chat-${pedidoId}`,
    data: {
      type: "chat",
      pedidoId,
      ...(messageId ? { messageId } : {}),
    },
  }
}

// ============================================
// New notification factories
// ============================================

export function orderDeliveredNotification(
  pedidoId: string,
  negocioNombre: string
): PushNotificationPayload {
  return {
    title: "Pedido entregado ✅",
    body: `Tu pedido de ${negocioNombre} fue entregado`,
    tag: `order-${pedidoId}`,
    data: {
      type: "order_update",
      pedidoId,
      // Bugfix-4B [17B]: mismo motivo que en orderUpdateNotification.
    },
  }
}

export function orderCancelledByClienteNotification(
  pedidoId: string,
  clienteNombre: string
): PushNotificationPayload {
  return {
    title: "Pedido cancelado ❌",
    body: `${clienteNombre} canceló un pedido`,
    tag: `order-cancelled-${pedidoId}`,
    data: {
      type: "order_update",
      pedidoId,
    },
    requireInteraction: true,
  }
}

export function clientConfirmedNotification(
  pedidoId: string,
  clienteNombre: string
): PushNotificationPayload {
  return {
    title: "Cliente confirmó recepción ✅",
    body: `${clienteNombre} confirmó que recibió el pedido`,
    tag: `order-confirmed-${pedidoId}`,
    data: {
      type: "order_update",
      pedidoId,
    },
  }
}

export function negocioApprovedNotification(
  negocioNombre: string
): PushNotificationPayload {
  return {
    title: "¡Tu local fue aprobado! 🎉",
    body: `${negocioNombre} ya está activo en DeliGO. Ya podés empezar a recibir pedidos.`,
    data: {
      type: "account_update",
    },
    requireInteraction: true,
  }
}

export function negocioSuspendedNotification(
  negocioNombre: string
): PushNotificationPayload {
  return {
    title: "Tu local fue suspendido ⚠️",
    body: `${negocioNombre} fue suspendido. Contactá al administrador para más información.`,
    data: {
      type: "account_update",
    },
    requireInteraction: true,
  }
}

export function negocioReactivatedNotification(
  negocioNombre: string
): PushNotificationPayload {
  return {
    title: "Tu local fue reactivado ✅",
    body: `${negocioNombre} está activo nuevamente.`,
    data: {
      type: "account_update",
    },
  }
}

export function subscriptionRenewedNotification(
  negocioNombre: string,
  fechaVencimiento: string
): PushNotificationPayload {
  return {
    title: "Suscripción renovada 🔄",
    body: `${negocioNombre} — Tu plan fue renovado hasta el ${new Date(fechaVencimiento).toLocaleDateString("es-AR")}`,
    data: {
      type: "account_update",
    },
  }
}

export function reviewReplyNotification(
  negocioNombre: string
): PushNotificationPayload {
  return {
    title: "Respuesta a tu reseña 💬",
    body: `${negocioNombre} respondió tu reseña`,
    data: {
      type: "review",
      url: "/?tab=pedidos",
    },
    actions: [
      { action: "view", title: "Ver reseña" },
    ],
  }
}

export function orderDeliveredByRepartidorNotification(
  pedidoId: string,
  clienteNombre: string
): PushNotificationPayload {
  return {
    title: "Pedido entregado por repartidor ✅",
    body: `El pedido de ${clienteNombre} fue entregado`,
    tag: `order-delivered-${pedidoId}`,
    data: {
      type: "order_update",
      pedidoId,
      // Bugfix-4B [17B]: mismo motivo que en orderUpdateNotification.
    },
  }
}

export function reviewRequestNotification(
  pedidoId: string,
  negocioNombre: string
): PushNotificationPayload {
  return {
    title: "¿Cómo fue tu pedido? ⭐",
    body: `Dejá tu reseña de ${negocioNombre} y ayudá a otros usuarios`,
    tag: `review-request-${pedidoId}`,
    data: {
      type: "review_request",
      pedidoId,
      // Bugfix-4B [17A]: se quita el `url` fijo — el service worker arma
      // "<rol>/?tab=pedidos&pedidoId=<id>&review=1" para abrir el modal de
      // reseña exacto en vez de solo la pestaña genérica de pedidos.
    },
    actions: [
      { action: "review", title: "Calificar" },
    ],
    requireInteraction: true,
  }
}

export function mesaOrderReadyNotification(
  pedidoId: string,
  mesaNumero: number,
  options?: { panelUrl?: string }
): PushNotificationPayload {
  const panelUrl = options?.panelUrl?.startsWith("/mozo/panel/")
    ? options.panelUrl
    : undefined

  return {
    title: "Pedido listo",
    body: `Mesa ${mesaNumero} lista para entregar`,
    tag: `mesa-ready-${pedidoId}`,
    data: {
      type: "mesa_order_ready",
      pedidoId,
      mesaNumero,
      ...(panelUrl ? { url: panelUrl } : {}),
    },
    actions: [
      { action: "view", title: "Ver salon" },
    ],
    requireInteraction: true,
  }
}

// ============================================
// Salon PWA notifications (/s/[token])
// ============================================

export function salonNewOrderNotification(
  pedidoId: string,
  mesaNumero: number,
  clienteNombre: string,
  total: number,
  mozoNombre?: string | null
): PushNotificationPayload {
  // For mesa orders placed by a mozo, the "cliente" is really the mozo
  // (there's no customer session). Show the mozo's name so the salon staff
  // know who took the order. Fall back to the customer name for regular
  // mesa orders (e.g. a customer scanning a QR without a mozo).
  const autor = mozoNombre || clienteNombre
  const body = mozoNombre
    ? `${mozoNombre} tomó un pedido por $${total.toFixed(0)} en la mesa ${mesaNumero}`
    : `${clienteNombre} hizo un pedido por $${total.toFixed(0)} en la mesa ${mesaNumero}`
  return {
    title: `Mesa ${mesaNumero} — Nuevo pedido 📩`,
    body,
    tag: `salon-new-order-${pedidoId}`,
    data: {
      type: "salon_new_order",
      pedidoId,
      mesaNumero,
      autor,
    },
    actions: [
      { action: "view", title: "Ver pedido" },
    ],
    requireInteraction: true,
  }
}

// ============================================
// Operaciones — Salón (cuenta personal, /operaciones/mi-panel/[slug]/salon)
// ============================================

export function operacionesSalonNewOrderNotification(
  pedidoId: string,
  mesaNumero: number,
  clienteNombre: string,
  total: number,
  panelUrl: string,
  mozoNombre?: string | null
): PushNotificationPayload {
  const autor = mozoNombre || clienteNombre
  const body = mozoNombre
    ? `${mozoNombre} tomó un pedido por $${total.toFixed(0)} en la mesa ${mesaNumero}`
    : `${clienteNombre} hizo un pedido por $${total.toFixed(0)} en la mesa ${mesaNumero}`
  return {
    title: `Mesa ${mesaNumero} — Nuevo pedido 📩`,
    body,
    tag: `operaciones-salon-new-order-${pedidoId}`,
    data: {
      type: "operaciones_salon_new_order",
      pedidoId,
      mesaNumero,
      autor,
      url: panelUrl,
    },
    actions: [
      { action: "view", title: "Ver pedido" },
    ],
    requireInteraction: true,
  }
}

export function operacionesOrderCancelledNotification(
  pedidoId: string,
  area: OperationsCancellationArea,
  canceladoPor: string,
  panelUrl: string,
  mesaNumero?: number | null
): PushNotificationPayload {
  const actorLabel =
    canceladoPor === "cliente"
      ? "por el cliente"
      : canceladoPor === "sistema"
        ? "automáticamente"
        : "por el local"
  const contextLabel = area === "salon"
    ? mesaNumero == null ? "Un pedido de mesa" : `El pedido de la mesa ${mesaNumero}`
    : "Un pedido"
  const icon = area === "salon" ? "/icon-salon-192x192.png" : "/icon-empleado-192x192.png"

  return {
    title: "Pedido cancelado ❌",
    body: `${contextLabel} fue cancelado ${actorLabel}`,
    icon,
    badge: icon,
    tag: `operaciones-order-cancelled-${pedidoId}`,
    data: {
      type: "operaciones_order_cancelled",
      pedidoId,
      area,
      url: panelUrl,
    },
    actions: [{ action: "view", title: area === "salon" ? "Ver salón" : "Ver pedidos" }],
    requireInteraction: true,
  }
}

// ============================================
// Generate VAPID keys (run once to create keys)
// ============================================

export function generateVapidKeys(): { publicKey: string; privateKey: string } {
  return webpush.generateVAPIDKeys()
}
