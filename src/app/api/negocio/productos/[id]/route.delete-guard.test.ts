// P2-T56-R3A-I2 (A0.1-8) — DELETE /api/negocio/productos/[id] no puede hacer
// desaparecer en silencio una reserva ACTIVA. Route real, db/auth mockeados.
import { beforeEach, describe, expect, mock, test } from "bun:test"
import { NextRequest } from "next/server"

const NEGOCIO = "negocio-a"
let activeReservations: number
let lastCountWhere: Record<string, unknown> | null
let deleted: string[]

mock.module("@/lib/auth", () => ({
  SESSION_COOKIE_NAME: "deligo_session",
  getUserFromToken: async () => ({ id: NEGOCIO, type: "negocio" }),
}))

mock.module("@/lib/db", () => ({
  db: {
    producto: {
      findUnique: async ({ where }: { where: { id: string } }) => ({ id: where.id, negocioId: NEGOCIO }),
      delete: async ({ where }: { where: { id: string } }) => {
        deleted.push(where.id)
        return { id: where.id }
      },
    },
    reservaStock: {
      count: async ({ where }: { where: Record<string, unknown> }) => {
        lastCountWhere = where
        return activeReservations
      },
    },
    productoAgregado: { deleteMany: async () => ({ count: 0 }) },
    productoIngrediente: { deleteMany: async () => ({ count: 0 }) },
    seccionProducto: { deleteMany: async () => ({ count: 0 }) },
    promocion: { updateMany: async () => ({ count: 0 }) },
  },
}))

const { DELETE } = await import("./route")

function callDelete(id = "p-1") {
  const req = new NextRequest(`http://localhost/api/negocio/productos/${id}`, {
    method: "DELETE",
    headers: { cookie: "deligo_session=token" },
  })
  return DELETE(req, { params: Promise.resolve({ id }) })
}

beforeEach(() => {
  activeReservations = 0
  lastCountWhere = null
  deleted = []
})

describe("P2-T56-R3A-I2 — guard de borrado de producto con reservas ACTIVA", () => {
  test("I2-AC: producto con reservas ACTIVA → 409 PRODUCT_HAS_ACTIVE_RESERVATIONS y NO se borra", async () => {
    activeReservations = 2
    const res = await callDelete()
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe("PRODUCT_HAS_ACTIVE_RESERVATIONS")
    expect(deleted).toEqual([])
  })

  test("el conteo se acota al negocio de la sesión, al producto y a estado ACTIVA", async () => {
    await callDelete("p-9")
    expect(lastCountWhere).toEqual({ negocioId: NEGOCIO, productoId: "p-9", estado: "ACTIVA" })
  })

  test("I2-AD: sin reservas ACTIVA (sólo históricas o ninguna) → borrado como antes", async () => {
    const res = await callDelete()
    expect(res.status).toBe(200)
    expect(deleted).toEqual(["p-1"])
  })
})
