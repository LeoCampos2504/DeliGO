import type { NextRequest } from "next/server"
import { isPushDebugAllowedEnvironment } from "@/lib/push-testing-guard"

export const PUSH_TEST_DIAGNOSTIC_HEADER = "x-deligo-push-diagnostic"
export const PUSH_TEST_DIAGNOSTIC_VALUE = "push-test"

/** Fail-closed gate for the retained Mozo push test tooling. */
export function isPushTestRouteAllowed(
  req: Pick<NextRequest, "headers">,
  env: Record<string, string | undefined> = process.env
): boolean {
  return (
    isPushDebugAllowedEnvironment(env) &&
    req.headers.get(PUSH_TEST_DIAGNOSTIC_HEADER) === PUSH_TEST_DIAGNOSTIC_VALUE
  )
}
