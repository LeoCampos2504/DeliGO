import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { esAreaMozoEfectiva } from "@/lib/area-operativa"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"
import { safeErrorForLog } from "@/lib/log-safe-error"
import {
  arePushSubscriptionsEquivalent,
  parsePushSubscriptionShape,
  resolvePushSubscriptionDetachInput,
} from "@/lib/push-subscription-http"
import { detachPushSubscriptionByEndpoint } from "@/lib/push-subscription-repository"

// Ownership-B2: `subscription`, cuando se pasa, exige coincidencia EXACTA (o,
// desde Stage3H3R1/F-P2-T05-17, equivalencia semántica vía CAS) contra el
// valor ya almacenado antes de limpiar — nunca un blind clear por sólo
// empleado.id. Mismo patrón ya certificado en /api/push/unsubscribe y en
// /api/operativo/{mozo,salon}/panel/[slug]/push-subscription DELETE.
//
// P2-T05 Stage3H3R1 (F-P2-T05-17): un string vacío/ausente/de otro tipo
// primitivo (number, boolean) preserva el 400 "obligatorio" ya existente. Un
// objeto plano es ahora un input válido de primera clase (antes se
// descartaba en silencio junto con los demás no-string, dejando el binding
// legacy imposible de retirar por esta vía) — se clasifica aparte para poder
// fallar cerrado con un mensaje distinto si su forma es inválida.
type UnsubscribeInputKind = "empty" | "string" | "object" | "other"

function classifyUnsubscribeInput(value: unknown): UnsubscribeInputKind {
  if (value === undefined || value === null) return "empty"
  if (typeof value === "string") return value.trim().length === 0 ? "empty" : "string"
  if (typeof value === "object" && !Array.isArray(value)) return "object"
  return "other"
}

// POST /api/mozo/push/unsubscribe - Remove push subscription for a mozo
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { mozoToken } = body as { mozoToken: string }

    if (!mozoToken) {
      return NextResponse.json(
        { error: "mozoToken es obligatorio" },
        { status: 400 }
      )
    }

    // Seguridad-6A: mismo tipo/clave que /api/mozo/push/subscribe (ya lo
    // tenía) — evita fuerza bruta de mozoToken vía este endpoint, que antes
    // quedaba sin ningún límite de intentos.
    const ip = getClientIp(req)
    const rl = checkRateLimit("push", `${ip}:${mozoToken}`)
    if (!rl.allowed) {
      return rateLimitResponse(rl)
    }

    const empleado = await db.empleado.findFirst({
      where: { token: mozoToken, activo: true, eliminado: false },
      select: { id: true, rol: true, areaOperativa: true },
    })

    // Guard de transición (Operaciones-1F): solo área efectiva Mozo.
    if (!empleado || !esAreaMozoEfectiva({ areaOperativa: empleado.areaOperativa, rol: empleado.rol })) {
      return NextResponse.json({ error: "Token de mozo invalido" }, { status: 401 })
    }

    const subscriptionRaw = (body as { subscription?: unknown }).subscription
    const kind = classifyUnsubscribeInput(subscriptionRaw)

    if (kind === "empty" || kind === "other") {
      return NextResponse.json(
        { error: "subscription es obligatorio" },
        { status: 400 }
      )
    }

    // P2-T05 Stage3H3R1 (F-P2-T05-17): un STRING preserva el contrato
    // tolerante ya existente (nunca exigió forma completa, sólo no-vacío) —
    // no se agrega validación nueva para no romper valores legacy ya
    // almacenados. Un OBJETO debe cumplir la forma completa o falla cerrado.
    const detachInput = resolvePushSubscriptionDetachInput(subscriptionRaw)

    if (kind === "object" && !detachInput.parsed) {
      return NextResponse.json(
        { error: "subscription debe ser un JSON válido" },
        { status: 400 }
      )
    }

    const exactCandidates = [detachInput.rawString, detachInput.canonical].filter(
      (value): value is string => typeof value === "string"
    )

    // Ownership-B2: coincidencia exacta (o, desde F-P2-T05-17, equivalencia
    // semántica vía CAS) contra la subscription almacenada — si otro
    // dispositivo de este mismo mozoToken es hoy el dueño real, no se toca
    // nada (removed:false, no es un error de autorización).
    //
    // P2-T05 Stage3 (F-P2-T05-03): el detach normalizado nunca exige que el
    // exact-match legacy haya encontrado nada — misma transacción, misma
    // regla multi-device que /api/push/unsubscribe.
    const endpoint = detachInput.endpoint

    const removed = await db.$transaction(async (tx) => {
      let legacyRemoved = false

      for (const candidate of exactCandidates) {
        const result = await tx.empleado.updateMany({
          where: { id: empleado.id, pushSubscription: candidate },
          data: { pushSubscription: null },
        })
        if (result.count > 0) {
          legacyRemoved = true
          break
        }
      }

      // P2-T05 Stage3H3R1 (F-P2-T05-17): fallback semántico — sólo si el
      // exact/canonical-match falló Y el request trae una forma válida. Lee
      // el valor legacy ACTUAL, compara por campos físicos (nunca sólo
      // endpoint) y limpia con un CAS exacto contra ese mismo valor
      // observado — nunca un blind clear por sólo el id del empleado.
      if (!legacyRemoved && detachInput.parsed) {
        const current = await tx.empleado.findUnique({ where: { id: empleado.id }, select: { pushSubscription: true } })
        const currentRaw = current?.pushSubscription ?? null
        if (currentRaw) {
          const currentParsed = parsePushSubscriptionShape(currentRaw)
          if (currentParsed && arePushSubscriptionsEquivalent(currentParsed, detachInput.parsed)) {
            const casResult = await tx.empleado.updateMany({
              where: { id: empleado.id, pushSubscription: currentRaw },
              data: { pushSubscription: null },
            })
            legacyRemoved = casResult.count > 0
          }
        }
      }

      let normalizedRemoved = false
      if (endpoint) {
        const result = await detachPushSubscriptionByEndpoint(
          { ownerType: "empleado", ownerId: empleado.id, channel: "default" },
          endpoint,
          tx
        )
        normalizedRemoved = result.detached
      }

      return legacyRemoved || normalizedRemoved
    })

    return NextResponse.json({ ok: true, removed })
  } catch (error) {
    console.error("Error removing mozo push subscription:", safeErrorForLog(error))
    return NextResponse.json(
      { error: "Error al eliminar la suscripcion" },
      { status: 500 }
    )
  }
}
