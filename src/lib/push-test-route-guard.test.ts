import { describe, expect, test } from "bun:test"
import { NextRequest } from "next/server"
import { readFileSync } from "fs"
import { join } from "path"
import { PUSH_TEST_DIAGNOSTIC_HEADER, PUSH_TEST_DIAGNOSTIC_VALUE, isPushTestRouteAllowed } from "./push-test-route-guard"

function request(value?: string) {
  return new NextRequest("http://localhost/api/operativo/mozo/panel/demo/push-subscription/test", {
    method: "POST",
    headers: value ? { [PUSH_TEST_DIAGNOSTIC_HEADER]: value } : undefined,
  })
}

describe("P2-T44-R1 retained Mozo push test route guard", () => {
  test("requires the exact diagnostic opt-in and Testing environment", () => {
    expect(isPushTestRouteAllowed(request(PUSH_TEST_DIAGNOSTIC_VALUE), { RAILWAY_ENVIRONMENT_NAME: "TESTING" })).toBe(true)
    expect(isPushTestRouteAllowed(request(), { RAILWAY_ENVIRONMENT_NAME: "TESTING" })).toBe(false)
    expect(isPushTestRouteAllowed(request("1"), { RAILWAY_ENVIRONMENT_NAME: "TESTING" })).toBe(false)
    expect(isPushTestRouteAllowed(request(PUSH_TEST_DIAGNOSTIC_VALUE), { RAILWAY_ENVIRONMENT_NAME: "production" })).toBe(false)
    expect(isPushTestRouteAllowed(request(PUSH_TEST_DIAGNOSTIC_VALUE), {})).toBe(false)
  })

  test("the retained endpoint invokes the fail-closed gate and returns a not-found response when denied", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/operativo/mozo/panel/[slug]/push-subscription/test/route.ts"), "utf-8")
    expect(route).toContain("isPushTestRouteAllowed(req)")
    expect(route).toContain('NextResponse.json({ error: "Not found" }, { status: 404 })')
  })
})
