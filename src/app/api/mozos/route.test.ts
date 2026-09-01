import { describe, expect, test } from "bun:test"
import { NextRequest } from "next/server"
import { GET } from "./route"

describe("GET /api/mozos legacy retirement", () => {
  test("rejects Authorization Bearer legacy tokens", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/mozos", {
        headers: { authorization: "Bearer known-legacy-token" },
      })
    )

    expect(response.status).toBe(410)
    expect(await response.json()).toEqual({ error: "Esta API fue reemplazada por DeliGO Operaciones" })
  })
})
