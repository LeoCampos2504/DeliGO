import { NextRequest, NextResponse } from "next/server"
import { isPushDebugAllowedEnvironment } from "@/lib/push-testing-guard"

// P2-T44-R1P5B (G3 SW CLICK TRACE): TESTING-only ingest for the Service
// Worker's own diagnostic trace — the deep link into
// /operaciones/mi-panel/.../pyr/pedidos never mounted after a real device
// tapped a delivered `operaciones_pyr_new_order` Push (see
// P2_T44_R1P4_G3_PHYSICAL_DELIVERY_PASS_DEEPLINK_FAIL_ANALYSIS.md). Nothing
// in server-side logs/DB could explain WHY `notificationclick`'s own safe-
// URL check picked the fallback on the real device, and `public/sw.js` has
// no `window`/`localStorage` to reuse the existing push-debug-trace.ts
// engine (see P2_T44_R1P5_G3_SW_CLICK_TRACE_INSTRUMENTATION.md for the full
// analysis of why that engine can't be reused as-is). This route is the
// minimal viable alternative: `public/sw.js` POSTs a handful of already-
// sanitized primitives here, fire-and-forget, and the only thing this route
// does with them is a single `console.info` line — read exclusively via
// `railway logs --service "DeliGO Copy" --environment TESTING`, the exact
// channel R1P4 already used successfully to prove the SW never reached the
// destination page.
//
// Same 404-outside-TESTING contract as /api/push/debug-guard: fails closed
// on anything other than a confirmed Railway TESTING environment, and never
// touches the DB, never persists anything itself, and never exposes trace
// history back over HTTP (no GET here, ever — see the report's §19 review).
//
// The body is UNTRUSTED — it originates from a Service Worker running on an
// arbitrary physical device. Every field is read through the explicit
// allowlist below; anything not listed is silently dropped, never logged,
// never echoed back.

const MAX_BODY_BYTES = 8 * 1024
const MAX_STRING_LENGTH = 256
const MAX_PATH_LENGTH = 512

const KNOWN_EVENTS = new Set([
  "push_received",
  "show_notification",
  "notificationclick_decision",
  "notificationclick_client",
  "notificationclick_routing_result",
  "endpoint_self_test",
])

// Defense in depth: even though the allowlist below never maps a
// secret-shaped key to a passthrough sanitizer, any key whose NAME looks
// like it could carry a secret is dropped before its sanitizer ever runs —
// mirrors the equivalent pattern in push-debug-trace.ts (not imported here
// on purpose, see the report: that module assumes a browser/window and this
// route must not depend on it).
const SECRET_FIELD_NAME_PATTERN = /cookie|token|secret|password|authorization|p256dh|vapid|jwt|session|email/i

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value
}

// Only for fields that must be an internal, relative path — never an
// absolute URL, never protocol-relative. Re-implemented independently from
// sw.js's own `isSafeInternalUrl` (same logic) because this route must never
// import anything Service-Worker- or browser-specific.
function sanitizePathField(value: unknown): string | null {
  if (typeof value !== "string") return null
  if (!value.startsWith("/") || value.startsWith("//")) return null
  return truncate(value, MAX_PATH_LENGTH)
}

function sanitizeShortString(max: number) {
  return (value: unknown): string | null => (typeof value === "string" ? truncate(value, max) : null)
}

function sanitizeBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null
}

function sanitizeSmallInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  const int = Math.trunc(value)
  if (int < 0 || int > 1000) return null
  return int
}

// e.g. `typeof rawUrl` -> "string"/"undefined"/"object" — always one of a
// handful of fixed JS primitive-name strings, never user content.
function sanitizeTypeName(value: unknown): string | null {
  return typeof value === "string" ? truncate(value, 32) : null
}

type SanitizedValue = string | number | boolean
type SanitizedTraceEvent = Record<string, SanitizedValue>

// Every field this endpoint will EVER log, mapped to its own sanitizer.
const FIELD_SANITIZERS: Record<string, (value: unknown) => SanitizedValue | null> = {
  traceVersion: sanitizeShortString(64),
  // P2-T44-R1P6E (durable click trace): routingVersion identifies which
  // notificationclick routing implementation ran (independent from
  // traceVersion, which identifies which trace ENGINE ran) — lets a future
  // probe confirm both dimensions from the same log line.
  routingVersion: sanitizeShortString(64),
  // P2-T44-R1P6E: stable id of the IndexedDB record this event came from —
  // never secret, just an opaque id — so a duplicate delivery (server
  // confirmed receipt but the local delete lost the race) is recognizable
  // as the same event, not two different clicks.
  traceRecordId: sanitizeShortString(64),
  // P2-T44-R1P6E: how many times the Service Worker already tried to flush
  // this exact durable record before this attempt.
  attemptCount: sanitizeSmallInt,
  event: (v) => (typeof v === "string" && KNOWN_EVENTS.has(v) ? v : null),
  type: sanitizeShortString(64),
  pedidoId: sanitizeShortString(64),
  payloadUrlPresent: sanitizeBoolean,
  payloadUrlType: sanitizeTypeName,
  payloadUrl: sanitizePathField,
  notificationDataUrlPresent: sanitizeBoolean,
  notificationDataUrlType: sanitizeTypeName,
  notificationDataUrl: sanitizePathField,
  rawUrlPresent: sanitizeBoolean,
  rawUrlType: sanitizeTypeName,
  rawUrl: sanitizePathField,
  safeInternalUrl: sanitizeBoolean,
  operationsPanelPrefixMatch: sanitizeBoolean,
  containsPyrOrSalon: sanitizeBoolean,
  selectedTargetUrl: sanitizePathField,
  usedFallback: sanitizeBoolean,
  fallbackReason: sanitizeShortString(64),
  clientCount: sanitizeSmallInt,
  clientIndex: sanitizeSmallInt,
  clientPathname: sanitizePathField,
  matchesOperationsPanel: sanitizeBoolean,
  canFocus: sanitizeBoolean,
  canNavigate: sanitizeBoolean,
  routingAction: sanitizeShortString(64),
  navigateTarget: sanitizePathField,
  navigateResult: sanitizeShortString(64),
  openWindowTarget: sanitizePathField,
  errorName: sanitizeShortString(128),
  errorMessage: sanitizeShortString(MAX_STRING_LENGTH),
}

function sanitizeTraceEvent(body: unknown): SanitizedTraceEvent | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null
  const source = body as Record<string, unknown>
  const out: SanitizedTraceEvent = {}
  for (const [key, sanitize] of Object.entries(FIELD_SANITIZERS)) {
    if (!(key in source)) continue
    if (SECRET_FIELD_NAME_PATTERN.test(key)) continue
    const sanitized = sanitize(source[key])
    if (sanitized !== null) out[key] = sanitized
  }
  if (typeof out.event !== "string") return null
  return out
}

// POST /api/push/debug-sw-trace — write-only, TESTING-only ingest for the
// Service Worker's own click-routing diagnostic trace. No GET is defined:
// trace history is never readable over HTTP, only via Railway TESTING logs.
export async function POST(req: NextRequest) {
  if (!isPushDebugAllowedEnvironment()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const contentType = (req.headers.get("content-type") || "").toLowerCase()
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "Content-Type debe ser application/json" }, { status: 400 })
  }

  const contentLengthHeader = req.headers.get("content-length")
  if (contentLengthHeader && Number(contentLengthHeader) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Body demasiado grande" }, { status: 413 })
  }

  let rawText: string
  try {
    rawText = await req.text()
  } catch {
    return NextResponse.json({ error: "No se pudo leer el body" }, { status: 400 })
  }

  if (rawText.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Body demasiado grande" }, { status: 413 })
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawText)
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  const sanitized = sanitizeTraceEvent(parsed)
  if (!sanitized) {
    return NextResponse.json({ error: "event es obligatorio y debe ser reconocido" }, { status: 400 })
  }

  // The ONLY side effect of this route. No DB, no file, no external store —
  // read exclusively via `railway logs`.
  console.info("[SW_TRACE]", JSON.stringify({ receivedAt: new Date().toISOString(), ...sanitized }))

  return new NextResponse(null, { status: 204 })
}
