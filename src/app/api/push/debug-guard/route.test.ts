import { afterEach, beforeEach, describe, expect, test } from "bun:test"

const ORIGINAL = process.env.RAILWAY_ENVIRONMENT_NAME

describe("GET /api/push/debug-guard", () => {
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.RAILWAY_ENVIRONMENT_NAME
    else process.env.RAILWAY_ENVIRONMENT_NAME = ORIGINAL
  })

  test("TESTING => 200 { allowed: true }", async () => {
    process.env.RAILWAY_ENVIRONMENT_NAME = "TESTING"
    const { GET } = await import("./route")
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ allowed: true })
  })

  test("production => 404, never { allowed: false }", async () => {
    process.env.RAILWAY_ENVIRONMENT_NAME = "production"
    const { GET } = await import("./route")
    const res = await GET()
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body).not.toHaveProperty("allowed")
  })

  test("var absent (e.g. local without Railway) => 404, fail-closed", async () => {
    delete process.env.RAILWAY_ENVIRONMENT_NAME
    const { GET } = await import("./route")
    const res = await GET()
    expect(res.status).toBe(404)
  })

  test("route never imports or touches the DB", () => {
    const fs = require("fs") as typeof import("fs")
    const path = require("path") as typeof import("path")
    const source = fs.readFileSync(path.join(__dirname, "route.ts"), "utf8")
    expect(source).not.toContain("@/lib/db")
    expect(source).not.toContain("prisma")
  })
})
