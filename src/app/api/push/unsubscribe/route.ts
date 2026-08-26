import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"
import { safeErrorForLog } from "@/lib/log-safe-error"
import {
  arePushSubscriptionsEquivalent,
  parsePushSubscriptionShape,
  resolvePushSubscriptionDetachInput,
} from "@/lib/push-subscription-http"
import { detachPushSubscriptionByEndpoint, type PushSubscriptionOwnerType } from "@/lib/push-subscription-repository"

const NORMALIZED_OWNER_TYPES: Partial<Record<"cliente" | "negocio" | "repartidor" | "superadmin", PushSubscriptionOwnerType>> = {
  cliente: "cliente",
  negocio: "negocio",
  repartidor: "repartidor",
}

// POST /api/push/unsubscribe — Remove push subscription for the current user
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user) {
      return NextResponse.json({ error: "Sesión inválida" }, { status: 401 })
    }

    // Seguridad-6A: mismo tipo/clave que /api/push/subscribe (ya lo tenía),
    // para que ninguno de los dos quede sin límite de intentos.
    const ip = getClientIp(req)
    const rl = checkRateLimit("push", `${ip}:${user.id}`)
    if (!rl.allowed) {
      return rateLimitResponse(rl)
    }

    let body: unknown = null
    try {
      body = await req.json()
    } catch {
      body = null
    }
    const subscriptionRaw = (body as { subscription?: unknown } | null)?.subscription

    // Ausente/vacío: preserva el contrato actual — no-op honesto, nunca error.
    if (
      subscriptionRaw === undefined ||
      subscriptionRaw === null ||
      (typeof subscriptionRaw === "string" && subscriptionRaw.trim().length === 0)
    ) {
      return NextResponse.json({ ok: true, removed: false })
    }

    // P2-T05 Stage3H3R1 (F-P2-T05-17): un STRING preserva el contrato
    // tolerante actual (sólo exige JSON.parse válido, nunca la forma
    // completa) — no romper compatibilidad con valores legacy ya
    // almacenados. Un valor que no sea string ni objeto plano (number,
    // boolean, array) preserva el no-op existente. Un OBJETO debe cumplir la
    // forma completa o falla cerrado — antes de esta corrección se
    // descartaba en silencio como "sin subscription", lo cual dejaba el
    // binding legacy imposible de retirar por esta vía (F-P2-T05-17).
    if (typeof subscriptionRaw === "string") {
      try {
        JSON.parse(subscriptionRaw)
      } catch {
        return NextResponse.json(
          { error: "subscription debe ser un JSON válido" },
          { status: 400 }
        )
      }
    } else if (typeof subscriptionRaw !== "object" || Array.isArray(subscriptionRaw)) {
      return NextResponse.json({ ok: true, removed: false })
    }

    const detachInput = resolvePushSubscriptionDetachInput(subscriptionRaw)

    if (typeof subscriptionRaw === "object" && !detachInput.parsed) {
      return NextResponse.json(
        { error: "subscription debe ser un JSON válido" },
        { status: 400 }
      )
    }

    // Candidatos exactos seguros: el string original tal cual (compatibilidad
    // byte-exacta con clientes actuales) y/o la forma canónica del objeto
    // parseado — nunca se inventa un candidato no derivado directamente del
    // request.
    const exactCandidates = [detachInput.rawString, detachInput.canonical].filter(
      (value): value is string => typeof value === "string"
    )
    let removed = false

    // P2-T05 Stage3 (F-P2-T05-03, MODEL-C1): el detach normalizado retira
    // ÚNICAMENTE la fila propia de este owner+channel+endpoint — nunca exige
    // que el exact-match legacy haya encontrado nada (multi-device: legacy
    // puede tener otro dispositivo más reciente mientras este endpoint sigue
    // vivo en la tabla normalizada). Ambas escrituras ocurren en la MISMA
    // transacción; nunca se llama al barrido global de endpoints muertos
    // desde un detach de usuario.

    // Remove only this browser subscription for the authenticated user.
    switch (user.type) {
      case "cliente":
      case "negocio":
      case "repartidor": {
        const ownerType = NORMALIZED_OWNER_TYPES[user.type]!
        removed = await db.$transaction(async (tx) => {
          let legacyRemoved = false

          for (const candidate of exactCandidates) {
            let count = 0
            if (user.type === "cliente") {
              count = (await tx.cliente.updateMany({
                where: { id: user.id, pushSubscription: candidate },
                data: { pushSubscription: null },
              })).count
            } else if (user.type === "negocio") {
              count = (await tx.negocio.updateMany({
                where: { id: user.id, pushSubscription: candidate },
                data: { pushSubscription: null },
              })).count
            } else {
              count = (await tx.repartidor.updateMany({
                where: { id: user.id, pushSubscription: candidate },
                data: { pushSubscription: null },
              })).count
            }
            if (count > 0) {
              legacyRemoved = true
              break
            }
          }

          // P2-T05 Stage3H3R1 (F-P2-T05-17): fallback semántico — sólo si el
          // exact/canonical-match falló Y el request trae una forma válida.
          // Lee el valor legacy ACTUAL, lo compara por campos físicos (nunca
          // sólo endpoint) contra el request, y si son la MISMA subscription
          // lógica limpia con un CAS exacto contra ese mismo valor
          // observado — nunca un blind clear por sólo el id del actor. Si el
          // valor cambió entre la lectura y el write (otro dispositivo
          // escribió), el CAS no matchea y no se limpia nada.
          if (!legacyRemoved && detachInput.parsed) {
            let currentRaw: string | null = null
            if (user.type === "cliente") {
              currentRaw = (await tx.cliente.findUnique({ where: { id: user.id }, select: { pushSubscription: true } }))?.pushSubscription ?? null
            } else if (user.type === "negocio") {
              currentRaw = (await tx.negocio.findUnique({ where: { id: user.id }, select: { pushSubscription: true } }))?.pushSubscription ?? null
            } else {
              currentRaw = (await tx.repartidor.findUnique({ where: { id: user.id }, select: { pushSubscription: true } }))?.pushSubscription ?? null
            }

            if (currentRaw) {
              const currentParsed = parsePushSubscriptionShape(currentRaw)
              if (currentParsed && arePushSubscriptionsEquivalent(currentParsed, detachInput.parsed)) {
                let casCount = 0
                if (user.type === "cliente") {
                  casCount = (await tx.cliente.updateMany({
                    where: { id: user.id, pushSubscription: currentRaw },
                    data: { pushSubscription: null },
                  })).count
                } else if (user.type === "negocio") {
                  casCount = (await tx.negocio.updateMany({
                    where: { id: user.id, pushSubscription: currentRaw },
                    data: { pushSubscription: null },
                  })).count
                } else {
                  casCount = (await tx.repartidor.updateMany({
                    where: { id: user.id, pushSubscription: currentRaw },
                    data: { pushSubscription: null },
                  })).count
                }
                legacyRemoved = casCount > 0
              }
            }
          }

          let normalizedRemoved = false
          if (detachInput.parsed) {
            const result = await detachPushSubscriptionByEndpoint(
              { ownerType, ownerId: user.id, channel: "default" },
              {
                endpoint: detachInput.parsed.endpoint,
                p256dh: detachInput.parsed.keys.p256dh,
                auth: detachInput.parsed.keys.auth,
              },
              tx
            )
            normalizedRemoved = result.detached
          }

          return legacyRemoved || normalizedRemoved
        })
        break
      }
      case "superadmin": {
        let legacyRemoved = false
        for (const candidate of exactCandidates) {
          const result = await db.superAdmin.updateMany({
            where: { id: user.id, pushSubscription: candidate },
            data: { pushSubscription: null },
          })
          if (result.count > 0) {
            legacyRemoved = true
            break
          }
        }

        if (!legacyRemoved && detachInput.parsed) {
          const current = await db.superAdmin.findUnique({ where: { id: user.id }, select: { pushSubscription: true } })
          const currentRaw = current?.pushSubscription ?? null
          if (currentRaw) {
            const currentParsed = parsePushSubscriptionShape(currentRaw)
            if (currentParsed && arePushSubscriptionsEquivalent(currentParsed, detachInput.parsed)) {
              const casResult = await db.superAdmin.updateMany({
                where: { id: user.id, pushSubscription: currentRaw },
                data: { pushSubscription: null },
              })
              legacyRemoved = casResult.count > 0
            }
          }
        }

        removed = legacyRemoved
        break
      }
      default:
        return NextResponse.json(
          { error: "Tipo de usuario no soportado" },
          { status: 400 }
        )
    }

    return NextResponse.json({ ok: true, removed })
  } catch (error) {
    console.error("Error removing push subscription:", safeErrorForLog(error))
    return NextResponse.json(
      { error: "Error al eliminar la suscripción" },
      { status: 500 }
    )
  }
}
