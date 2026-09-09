// P2-T31-R6 (INTERMITTENT-IPHONE-PUSH-LIFECYCLE-DIAGNOSTIC): fail-closed guard
// for diagnostic-only surfaces (this task's push debug panel/API) so they can
// never activate outside Railway TESTING.
//
// `RAILWAY_ENVIRONMENT_NAME` is a variable Railway itself injects into every
// deployed container — never defined in this repo's own `.env` or committed
// config, so it cannot be spoofed by anything checked into git. Confirmed via
// `railway variables` (read-only) against both real services: the TESTING
// service ("DeliGO Copy") reports `RAILWAY_ENVIRONMENT_NAME=TESTING`; the
// Production service ("DeliGO") reports `RAILWAY_ENVIRONMENT_NAME=production`
// (lowercase). Comparison is case-insensitive against the literal `testing`
// so neither casing is a foot-gun; anything else — undefined (e.g. running
// locally without Railway), `production`, a typo, or a future third
// environment this guard has never seen — fails closed to `false`.
export function isPushDebugAllowedEnvironment(
  env: Record<string, string | undefined> = process.env
): boolean {
  return (env.RAILWAY_ENVIRONMENT_NAME ?? "").toLowerCase() === "testing"
}
