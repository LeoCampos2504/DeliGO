/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import vm from "node:vm"

// P2-T31-R22A: contrato de routing de ícono de notificación Push por ROL
// del destinatario, no por `notifType` en solitario — ver
// P2_T31_R22_ANDROID_PUSH_NOTIFICATION_ICON_ROUTING_ROOT_CAUSE_AUDIT.md
// para la causa raíz probada (order_update/review/chat son notifType
// REALMENTE compartidos entre Cliente/Negocio/Repartidor).
//
// Carga el `public/sw.js` REAL (nunca una reimplementación) en un sandbox
// VM mínimo — misma técnica exacta que `sw-push-dedupe.test.ts` — así que
// este archivo ejercita el código de producción real, no una copia.

interface SwHarness {
  listeners: Map<string, (event: unknown) => void>
  showNotificationCalls: Array<{ title: string; options: Record<string, unknown> }>
}

function loadServiceWorker(): SwHarness {
  const source = readFileSync(resolve(import.meta.dir, "..", "..", "public", "sw.js"), "utf8")

  const listeners = new Map<string, (event: unknown) => void>()
  const showNotificationCalls: Array<{ title: string; options: Record<string, unknown> }> = []

  const selfObj: Record<string, unknown> = {
    addEventListener: (type: string, handler: (event: unknown) => void) => {
      listeners.set(type, handler)
    },
    skipWaiting: () => {},
    clients: { claim: async () => {}, matchAll: async () => [] },
    registration: {
      showNotification: (title: string, options: Record<string, unknown>) => {
        showNotificationCalls.push({ title, options })
        return Promise.resolve()
      },
    },
    crypto: globalThis.crypto,
    location: { origin: "https://example.test" },
  }
  selfObj.self = selfObj

  const context = vm.createContext({
    self: selfObj,
    Date,
    console,
    caches: {
      open: async () => ({
        keys: async () => [],
        addAll: async () => {},
        delete: async () => {},
        match: async () => undefined,
        put: async () => {},
      }),
    },
  })

  vm.runInContext(source, context, { filename: "sw.js" })

  return { listeners, showNotificationCalls }
}

function firePush(sw: SwHarness, payload: unknown) {
  const handler = sw.listeners.get("push")
  if (!handler) throw new Error("push listener was not registered")
  handler({ data: { json: () => payload }, waitUntil: (p: Promise<unknown>) => p })
}

function lastCall(sw: SwHarness) {
  const call = sw.showNotificationCalls[sw.showNotificationCalls.length - 1]
  if (!call) throw new Error("showNotification was never called")
  return call
}

// Payloads con la forma EXACTA que `enrichedPushPayload` produce en
// producción (src/lib/push.ts::createNotification) — `data.role` es el
// campo agregado por `personalRoleFor(userType)`.
function payload(
  type: string,
  opts: { role?: string; area?: string; icon?: string; badge?: string } = {}
) {
  return {
    title: "t",
    body: "b",
    ...(opts.icon ? { icon: opts.icon } : {}),
    ...(opts.badge ? { badge: opts.badge } : {}),
    data: {
      type,
      ...(opts.role ? { role: opts.role } : {}),
      ...(opts.area ? { area: opts.area } : {}),
    },
  }
}

const ICON = {
  cliente: "/icon-cliente-192x192.png",
  negocio: "/icon-negocio-192x192.png",
  repartidor: "/icon-repartidor-192x192.png",
  salon: "/icon-salon-192x192.png",
  mozo: "/icon-mozo-192x192.png",
  empleado: "/icon-empleado-192x192.png",
}

// P2-T36: `badge` ya NO hereda `icon` (era `badge: data.badge || icon`,
// siempre el mismo PNG full-color que el ícono grande de rol — mal
// candidato para el badge monocromático pequeño que Android compone). Sin
// override explícito del payload, TODOS los roles comparten el mismo badge
// neutro de DeliGO — el badge nunca necesitó codificar el rol, sólo `icon`
// lo hace.
const DELIGO_BADGE = "/badge-deligo-monochrome-96x96.png"

describe("P2-T31-R22A — Service Worker push icon routing prioriza data.role sobre notifType", () => {
  describe("CLIENTE — role=cliente gana sobre cualquier notifType compartido", () => {
    test("cliente + order_update -> icon Cliente, badge compartido DeliGO (el bug físico exacto de R22, badge realineado por P2-T36)", () => {
      const sw = loadServiceWorker()
      firePush(sw, payload("order_update", { role: "cliente" }))
      const { options } = lastCall(sw)
      expect(options.icon).toBe(ICON.cliente)
      expect(options.badge).toBe(DELIGO_BADGE)
    })

    test("cliente + review -> icon Cliente, badge compartido DeliGO", () => {
      const sw = loadServiceWorker()
      firePush(sw, payload("review", { role: "cliente" }))
      const { options } = lastCall(sw)
      expect(options.icon).toBe(ICON.cliente)
      expect(options.badge).toBe(DELIGO_BADGE)
    })

    test("cliente + chat -> icon Cliente, badge compartido DeliGO", () => {
      const sw = loadServiceWorker()
      firePush(sw, payload("chat", { role: "cliente" }))
      const { options } = lastCall(sw)
      expect(options.icon).toBe(ICON.cliente)
      expect(options.badge).toBe(DELIGO_BADGE)
    })

    test("cliente + review_request -> icon Cliente", () => {
      const sw = loadServiceWorker()
      firePush(sw, payload("review_request", { role: "cliente" }))
      expect(lastCall(sw).options.icon).toBe(ICON.cliente)
    })
  })

  describe("NEGOCIO — role=negocio gana sobre cualquier notifType compartido", () => {
    test("negocio + new_order -> icon Negocio", () => {
      const sw = loadServiceWorker()
      firePush(sw, payload("new_order", { role: "negocio" }))
      expect(lastCall(sw).options.icon).toBe(ICON.negocio)
    })

    test("negocio + order_update -> icon Negocio", () => {
      const sw = loadServiceWorker()
      firePush(sw, payload("order_update", { role: "negocio" }))
      expect(lastCall(sw).options.icon).toBe(ICON.negocio)
    })

    test("negocio + review -> icon Negocio", () => {
      const sw = loadServiceWorker()
      firePush(sw, payload("review", { role: "negocio" }))
      expect(lastCall(sw).options.icon).toBe(ICON.negocio)
    })

    test("negocio + chat -> icon Negocio (antes rompía al default Cliente), badge compartido DeliGO", () => {
      const sw = loadServiceWorker()
      firePush(sw, payload("chat", { role: "negocio" }))
      const { options } = lastCall(sw)
      expect(options.icon).toBe(ICON.negocio)
      expect(options.badge).toBe(DELIGO_BADGE)
    })

    test("negocio + account_update -> icon Negocio", () => {
      const sw = loadServiceWorker()
      firePush(sw, payload("account_update", { role: "negocio" }))
      expect(lastCall(sw).options.icon).toBe(ICON.negocio)
    })
  })

  describe("REPARTIDOR — role=repartidor gana sobre cualquier notifType compartido", () => {
    test("repartidor + new_delivery -> icon Repartidor (antes rompía al default Cliente), badge compartido DeliGO", () => {
      const sw = loadServiceWorker()
      firePush(sw, payload("new_delivery", { role: "repartidor" }))
      const { options } = lastCall(sw)
      expect(options.icon).toBe(ICON.repartidor)
      expect(options.badge).toBe(DELIGO_BADGE)
    })

    test("repartidor + order_update -> icon Repartidor (antes rompía a Negocio)", () => {
      const sw = loadServiceWorker()
      firePush(sw, payload("order_update", { role: "repartidor" }))
      expect(lastCall(sw).options.icon).toBe(ICON.repartidor)
    })
  })

  describe("LEGACY / FALLBACK — sin `role`, el comportamiento por notifType es IDÉNTICO al de antes de R22A", () => {
    test("sin role + salon_new_order -> icon Salon", () => {
      const sw = loadServiceWorker()
      firePush(sw, payload("salon_new_order"))
      expect(lastCall(sw).options.icon).toBe(ICON.salon)
    })

    test("sin role + operaciones_salon_new_order -> icon Salon", () => {
      const sw = loadServiceWorker()
      firePush(sw, payload("operaciones_salon_new_order"))
      expect(lastCall(sw).options.icon).toBe(ICON.salon)
    })

    test("sin role + mesa_order_ready -> icon Mozo", () => {
      const sw = loadServiceWorker()
      firePush(sw, payload("mesa_order_ready"))
      expect(lastCall(sw).options.icon).toBe(ICON.mozo)
    })

    test("sin role + operaciones_order_cancelled area=salon -> icon Salon (vía override explícito del payload, comportamiento sin cambios)", () => {
      const sw = loadServiceWorker()
      firePush(sw, payload("operaciones_order_cancelled", { area: "salon", icon: ICON.salon, badge: ICON.salon }))
      const { options } = lastCall(sw)
      expect(options.icon).toBe(ICON.salon)
      expect(options.badge).toBe(ICON.salon)
    })

    test("sin role + operaciones_order_cancelled area=pyr -> icon Empleado (vía override explícito del payload, comportamiento sin cambios)", () => {
      const sw = loadServiceWorker()
      firePush(sw, payload("operaciones_order_cancelled", { area: "pyr", icon: ICON.empleado, badge: ICON.empleado }))
      const { options } = lastCall(sw)
      expect(options.icon).toBe(ICON.empleado)
      expect(options.badge).toBe(ICON.empleado)
    })

    test("sin role + new_order -> icon Negocio (backward compatibility intencional)", () => {
      const sw = loadServiceWorker()
      firePush(sw, payload("new_order"))
      expect(lastCall(sw).options.icon).toBe(ICON.negocio)
    })

    test("sin role + order_update -> icon Negocio (backward compatibility intencional — payloads viejos ya encolados sin `role`)", () => {
      const sw = loadServiceWorker()
      firePush(sw, payload("order_update"))
      expect(lastCall(sw).options.icon).toBe(ICON.negocio)
    })

    test("sin role + review -> icon Negocio (backward compatibility intencional)", () => {
      const sw = loadServiceWorker()
      firePush(sw, payload("review"))
      expect(lastCall(sw).options.icon).toBe(ICON.negocio)
    })

    test("sin role + account_update -> icon Negocio (backward compatibility intencional)", () => {
      const sw = loadServiceWorker()
      firePush(sw, payload("account_update"))
      expect(lastCall(sw).options.icon).toBe(ICON.negocio)
    })

    test("sin role + chat -> icon Cliente (backward compatibility intencional, default legacy)", () => {
      const sw = loadServiceWorker()
      firePush(sw, payload("chat"))
      expect(lastCall(sw).options.icon).toBe(ICON.cliente)
    })

    test("sin role + new_delivery -> icon Cliente (backward compatibility intencional, default legacy)", () => {
      const sw = loadServiceWorker()
      firePush(sw, payload("new_delivery"))
      expect(lastCall(sw).options.icon).toBe(ICON.cliente)
    })

    test("role desconocido (valor no reconocido) + notifType existente -> cae al fallback legacy, sin throw", () => {
      const sw = loadServiceWorker()
      expect(() => firePush(sw, payload("order_update", { role: "superadmin" }))).not.toThrow()
      expect(lastCall(sw).options.icon).toBe(ICON.negocio)
    })

    test("role null explícito en el payload -> cae al fallback legacy, sin throw", () => {
      const sw = loadServiceWorker()
      const p = payload("order_update")
      // @ts-expect-error simulando un payload legacy que sí manda la clave con null
      p.data.role = null
      expect(() => firePush(sw, p)).not.toThrow()
      expect(lastCall(sw).options.icon).toBe(ICON.negocio)
    })
  })

  describe("Precedencia — el override explícito data.icon/data.badge sigue ganando SIEMPRE, incluso con role presente", () => {
    test("role=cliente + order_update + data.icon explícito -> gana el override, no el role ni el notifType", () => {
      const sw = loadServiceWorker()
      const customIcon = "/icon-empleado-192x192.png"
      firePush(sw, payload("order_update", { role: "cliente", icon: customIcon }))
      expect(lastCall(sw).options.icon).toBe(customIcon)
    })

    test("role=negocio + chat + data.badge explícito -> badge usa el override, icon sigue resolviendo por role", () => {
      const sw = loadServiceWorker()
      const customBadge = "/icon-mozo-192x192.png"
      firePush(sw, payload("chat", { role: "negocio", badge: customBadge }))
      const { options } = lastCall(sw)
      expect(options.icon).toBe(ICON.negocio)
      expect(options.badge).toBe(customBadge)
    })
  })

  describe("P2-T36 — badge ya NO hereda automáticamente icon (era `badge: data.badge || icon`)", () => {
    test("sin role, sin override, notifType legacy -> badge sigue siendo el compartido DeliGO, nunca el icon full-color de rol", () => {
      const sw = loadServiceWorker()
      firePush(sw, payload("new_order"))
      const { options } = lastCall(sw)
      expect(options.icon).toBe(ICON.negocio)
      expect(options.badge).toBe(DELIGO_BADGE)
      expect(options.badge).not.toBe(options.icon)
    })

    test("el badge compartido es el MISMO valor sin importar el rol destinatario — nunca codifica el rol, a diferencia de icon", () => {
      const sw = loadServiceWorker()
      firePush(sw, payload("order_update", { role: "cliente" }))
      const badgeCliente = lastCall(sw).options.badge
      firePush(sw, payload("new_order", { role: "negocio" }))
      const badgeNegocio = lastCall(sw).options.badge
      firePush(sw, payload("new_delivery", { role: "repartidor" }))
      const badgeRepartidor = lastCall(sw).options.badge
      expect(badgeCliente).toBe(DELIGO_BADGE)
      expect(badgeNegocio).toBe(DELIGO_BADGE)
      expect(badgeRepartidor).toBe(DELIGO_BADGE)
    })
  })
})
