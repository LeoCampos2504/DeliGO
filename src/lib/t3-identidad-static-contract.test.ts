/// <reference types="bun-types" />
// T3 — contrato de cableado (sin DB): cada superficie de P1-09 declara la familia de su pantalla, las rutas que
// mueven dinero/auditoría la exigen, las rutas sólo del dueño validan su credencial explícita y las consultas
// periódicas se detienen ante un rechazo de autenticación. El comportamiento real se prueba en
// t3-sesiones-simultaneas.integration.test.ts (PostgreSQL efímero) y notification-center.t3.test.tsx (happy-dom).
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { AuthRejectedError, isAuthRejected, pollUnlessAuthRejected, retryUnlessAuthRejected, throwIfAuthRejected } from "./auth-rejected-query"

const src = (path: string) => readFileSync(join(process.cwd(), path), "utf8").replace(/\r\n/g, "\n")

describe("T3 — helper de rechazo de autenticación", () => {
  test("401/403 lanzan; el resto pasa; el sondeo y el reintento se detienen sólo ante el rechazo", () => {
    expect(() => throwIfAuthRejected(new Response(null, { status: 401 }))).toThrow(AuthRejectedError)
    expect(() => throwIfAuthRejected(new Response(null, { status: 403 }))).toThrow(AuthRejectedError)
    for (const status of [200, 400, 404, 500, 503]) expect(() => throwIfAuthRejected(new Response(null, { status }))).not.toThrow()
    const rechazo = new AuthRejectedError(401)
    expect(isAuthRejected(rechazo)).toBe(true)
    expect(isAuthRejected(new Error("red"))).toBe(false)
    expect(pollUnlessAuthRejected(rechazo, 10_000)).toBe(false)
    expect(pollUnlessAuthRejected(new Error("red"), 10_000)).toBe(10_000)
    expect(pollUnlessAuthRejected(null, 30_000)).toBe(30_000)
    expect(retryUnlessAuthRejected(0, rechazo)).toBe(false)
    expect(retryUnlessAuthRejected(0, new Error("red"))).toBe(true)
    expect(retryUnlessAuthRejected(3, new Error("red"))).toBe(false)
  })
})

describe("T3 — rutas", () => {
  test("cierre comercial y cancelación exigen la familia y usan sólo el resolvedor por familia", () => {
    const cuenta = src("src/app/api/operaciones/ocupaciones/[id]/cuenta/route.ts")
    expect(cuenta).not.toContain("resolveMesaOccupancyCloseActor(")
    expect(cuenta).toContain("resolveMesaOccupancyActor(request, negocioId, family)")
    expect(cuenta).toContain("MESA_CUENTA_ACTOR_FAMILY_REQUIRED")
    expect(cuenta.match(/const family = familiaDeCuenta\(request\)/g)?.length).toBe(2)

    const cancelar = src("src/app/api/operaciones/pedidos/[id]/cancelar/route.ts")
    expect(cancelar).toContain("resolverActorCancelacionMesa(req, pedidoId, family)")
    expect(cancelar).toContain('if (family === null || family === "invalid")')
  })

  test("rutas sólo del dueño validan la credencial explícita de la familia negocio (nunca sólo la cookie legacy)", () => {
    for (const path of ["src/app/api/destacado-solicitud/route.ts", "src/app/api/mozos/stats/route.ts", "src/app/api/denuncias/route.ts"]) {
      const s = src(path)
      expect(s).not.toContain("SESSION_COOKIE_NAME")
      expect(s).toMatch(/requireNegocioOwnerSession\(req\)|readFamilySession\(req, "negocio"\)/)
    }
    // /api/negocio/mozos/stats reexporta la misma implementación.
    expect(src("src/app/api/negocio/mozos/stats/route.ts")).toContain('from "@/app/api/mozos/stats/route"')
  })

  test("notificaciones: el feed personal con familia declarada valida esa familia y nunca cae al operativo", () => {
    const s = src("src/app/api/notificaciones/route.ts")
    expect(s).toContain("readFamilySession(req, familia)")
    expect(s).toContain("user && user.type === familia")
    const cuenta = s.slice(s.indexOf("async function resolverCuenta"), s.indexOf("async function resolverFeed"))
    expect(cuenta).not.toContain("getOperationalAccountFromRequest")
  })
})

describe("T3 — clientes y hosts declaran la familia de su pantalla", () => {
  test("cuenta de mesa: cada host fija su familia", () => {
    expect(src("src/components/business/salon-tab.tsx")).toContain('onClosed={onOccupationClosed} actorFamily="negocio"')
    expect(src("src/app/mozo/panel/[slug]/page.tsx")).toContain('<MesaCuentaDialog mesaId={mesa.id} mesaNumero={mesa.numero} actorFamily="cuenta_operativa" />')
    expect(src("src/app/operaciones/mi-panel/[slug]/salon/page.tsx")).toContain('<MesaCuentaDialog mesaId={mesa.id} mesaNumero={mesa.numero} actorFamily="cuenta_operativa" />')
    expect(src("src/app/operaciones/salon/page.tsx")).toContain('canClose={false} actorFamily="terminal"')
    const dialog = src("src/components/operativo/mesa-cuenta-dialog.tsx")
    expect(dialog).toContain("fetchMesaOccupancyStatus(mesaId, undefined, actorFamily)")
    expect(dialog.match(/fetch\(urlCuenta\(/g)?.length).toBe(2)
    expect(dialog).not.toMatch(/fetch\(`\/api\/operaciones\/ocupaciones/)
  })

  test("cancelación: el diálogo envía la familia y cada host la fija", () => {
    expect(src("src/components/operativo/cancelar-pedido-mesa-dialog.tsx")).toContain("cancelarPedidoMesaRequest(pedidoId, validacion.motivo, actorFamily)")
    expect(src("src/components/business/salon-tab.tsx")).toContain('actorFamily="negocio"\n                      onCancelled')
    expect(src("src/components/operativo/pedido-detalle.tsx")).toContain("actorFamily={cancelarPedido.actorFamily}")
    for (const path of ["src/app/mozo/panel/[slug]/page.tsx", "src/app/operaciones/mi-panel/[slug]/salon/page.tsx"]) {
      expect(src(path)).toContain('cancelarPedido={{\n          actorFamily: "cuenta_operativa",')
    }
  })

  test("consultas periódicas: campana y destacado se detienen ante 401/403", () => {
    const bell = src("src/components/shared/notification-center.tsx")
    expect(bell).toContain('queryKey: ["notifications-unread", feed, actorKey]')
    expect(bell).toContain('queryKey: ["notifications-list", feed, actorKey]')
    expect(bell).toContain("refetchInterval: (query) => pollUnlessAuthRejected(query.state.error, 10000)")
    expect(bell).toContain("enabled: actorKey !== null")
    const dashboard = src("src/components/business/dashboard-tab.tsx")
    expect(dashboard).toContain("throwIfAuthRejected(res)")
    expect(dashboard).toContain("refetchInterval: (query) => pollUnlessAuthRejected(query.state.error, 30000)")
    expect(dashboard).toContain("retry: retryUnlessAuthRejected")
  })
})
