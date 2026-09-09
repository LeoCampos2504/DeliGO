/// <reference types="bun-types" />

// ============================================
// P2-T29C — GET /api/repartidor/pedidos: query de disponibilidad
// ============================================
// route.test.ts (ya existente, P2-T01) mockea `db.pedido.findMany` para
// devolver una lista fija sin inspeccionar el `where` recibido — no puede
// probar la construcción real del filtro. Este archivo captura el `where`
// efectivamente pasado a `findMany` y verifica que:
//   - "disponibles"/"all" consultan esperando_repartidor (canónico) Y
//     en_camino (legacy compat, ver order-transitions.ts) — nunca sólo uno;
//   - "mios" no cambia (post-aceptación siempre en_camino, sin relación con
//     este mapping);
//   - metodoEntrega sigue acotado a domicilio (retiro/mesa nunca entran acá,
//     ya filtrado por el `where` base, sin cambios de esta tarea).
// Mismo patrón de mock.module que route.test.ts (db/auth reemplazados antes
// de importar la ruta).

import { describe, expect, mock, test } from "bun:test"
import { NextRequest } from "next/server"

let sessionUser: { id: string; type: string } | null
let asociaciones: Array<{ negocioId: string }>
let capturedWhere: unknown = null

mock.module("@/lib/db", () => ({
  db: {
    repartidorNegocio: {
      findMany: async () => asociaciones,
    },
    pedido: {
      findMany: async (args: { where: unknown }) => {
        capturedWhere = args.where
        return []
      },
    },
  },
}))

mock.module("@/lib/auth", () => ({
  SESSION_COOKIE_NAME: "deligo_session",
  getUserFromToken: async (_token: string) => (sessionUser ? { ...sessionUser } : null),
}))

mock.module("@/lib/log-safe-error", () => ({
  safeErrorForLog: (e: unknown) => e,
}))

const { GET } = await import("./route")
const { CANONICAL_WAITING_DRIVER_STATE, LEGACY_AVAILABLE_DELIVERY_STATE } = await import("@/lib/order-transitions")

function callRoute(filter?: string) {
  sessionUser = { id: "repartidor-1", type: "repartidor" }
  asociaciones = [{ negocioId: "negocio-1" }]
  capturedWhere = null
  const url = filter ? `http://localhost/api/repartidor/pedidos?filter=${filter}` : "http://localhost/api/repartidor/pedidos"
  const req = new NextRequest(url, { headers: { cookie: "deligo_session=fake-session-token" } })
  return GET(req)
}

describe("P2-T29C — filter=disponibles consulta esperando_repartidor (canónico) + en_camino (legacy compat)", () => {
  test("estado es un `in` con exactamente los 2 valores permitidos, nunca sólo uno", async () => {
    await callRoute("disponibles")
    const where = capturedWhere as { estado: { in: string[] }; repartidorId: null; metodoEntrega: string }
    expect(where.estado.in.sort()).toEqual([CANONICAL_WAITING_DRIVER_STATE, LEGACY_AVAILABLE_DELIVERY_STATE].sort())
    expect(where.repartidorId).toBeNull()
    expect(where.metodoEntrega).toBe("domicilio")
  })
})

describe("P2-T29C — filter=all incluye la misma disponibilidad canónica+legacy en su rama OR", () => {
  test("la primera rama del OR usa el mismo `in` que disponibles; la segunda (mios) es en_camino/listo_para_retirar sin cambios", async () => {
    await callRoute("all")
    const where = capturedWhere as {
      OR: Array<{ estado: { in?: string[] } | string; repartidorId: string | null }>
    }
    const disponiblesBranch = where.OR.find((b) => b.repartidorId === null)!
    const miosBranch = where.OR.find((b) => b.repartidorId !== null)!
    expect((disponiblesBranch.estado as { in: string[] }).in.sort()).toEqual(
      [CANONICAL_WAITING_DRIVER_STATE, LEGACY_AVAILABLE_DELIVERY_STATE].sort()
    )
    expect((miosBranch.estado as { in: string[] }).in.sort()).toEqual(["en_camino", "listo_para_retirar"].sort())
  })
})

describe("P2-T29C — filter=mios no cambia (ya asignado, sin relación con el mapping de disponibilidad)", () => {
  test("estado sigue siendo en_camino/listo_para_retirar, repartidorId=yo", async () => {
    await callRoute("mios")
    const where = capturedWhere as { estado: { in: string[] }; repartidorId: string }
    expect(where.estado.in.sort()).toEqual(["en_camino", "listo_para_retirar"].sort())
    expect(where.repartidorId).toBe("repartidor-1")
  })
})

describe("P2-T29C — la query base sigue acotada a domicilio (sin cambios, retiro/mesa nunca aparecen)", () => {
  test("metodoEntrega=domicilio presente en los 3 filtros", async () => {
    for (const filter of ["disponibles", "mios", "all"]) {
      await callRoute(filter)
      const where = capturedWhere as { metodoEntrega: string }
      expect(where.metodoEntrega).toBe("domicilio")
    }
  })
})
