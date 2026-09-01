import { describe, expect, test } from "bun:test"
import { NextRequest } from "next/server"
import { POST } from "./route"

describe("POST /api/mozo/push/subscribe legacy retirement", () => {
  test("rejects legacy token payloads without touching the database", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/mozo/push/subscribe", {
        method: "POST",
        body: JSON.stringify({ mozoToken: "known-legacy-token", subscription: "legacy" }),
      })
    )

    expect(response.status).toBe(410)
    expect(await response.json()).toEqual({ error: "Esta API fue reemplazada por DeliGO Operaciones" })
    expect(response.headers.get("cache-control")).toBe("private, no-store")
  })
})
