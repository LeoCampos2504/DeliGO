// P2-T31-R6 (INTERMITTENT-IPHONE-PUSH-LIFECYCLE-DIAGNOSTIC): static-contract
// tests for the push debug panel — no jsdom/React Testing Library in this
// repo, so the panel's safety contract is asserted against its actual source
// text, same style as permission-prompt-static-contract.test.ts.
import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

function read(relPath: string): string {
  return readFileSync(join(process.cwd(), ...relPath.split("/")), "utf-8")
}

function stripComments(src: string): string {
  return src
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n")
}

describe("PushDebugPanel — invisible without the server-side guard (P2-T31-R6B)", () => {
  const src = read("src/components/shared/push-debug-panel.tsx")
  const code = stripComments(src)

  test("reads the legacy query param from window.location.search, not useSearchParams (no forced Suspense boundary)", () => {
    expect(code).toContain("window.location.search")
    expect(code).not.toContain("useSearchParams")
  })

  test("the legacy auto-open query param is exactly pushDebug=1", () => {
    expect(code).toContain('.get("pushDebug") === "1"')
  })

  test("QUERY_PARAM_REQUIRED_FOR_PHYSICAL_USE=NO: the query-param effect only ever calls setPanelOpen, never setAllowed — the guard check is entirely independent of it", () => {
    const paramEffectStart = code.indexOf('new URLSearchParams(window.location.search)')
    const paramEffectLineEnd = code.indexOf("\n", paramEffectStart)
    const paramEffectBody = code.slice(code.lastIndexOf("useEffect(() => {", paramEffectStart), code.indexOf("}, [])", paramEffectLineEnd) + "}, [])".length)
    expect(paramEffectBody).toContain("setPanelOpen(true)")
    expect(paramEffectBody).not.toContain("setAllowed")
  })

  test("renders null (not merely hidden) whenever the guard has not confirmed TESTING", () => {
    expect(code).toContain("if (!allowed) return null")
  })

  test("the guard-check effect has NO dependency on any query-param state — it runs unconditionally on mount", () => {
    const guardEffectStart = code.indexOf('fetch("/api/push/debug-guard")')
    const guardEffectDeclStart = code.lastIndexOf("useEffect(() => {", guardEffectStart)
    const guardEffectDeclEnd = code.indexOf("}, [])", guardEffectStart) + "}, [])".length
    const guardEffect = code.slice(guardEffectDeclStart, guardEffectDeclEnd)
    expect(guardEffect).toContain("}, [])") // empty deps array — no `debugRequested`/panelOpen gating it
  })
})

describe("PushDebugPanel — TESTING-only guard, single authority", () => {
  const src = read("src/components/shared/push-debug-panel.tsx")
  const code = stripComments(src)

  test("gates visibility through the server-side /api/push/debug-guard endpoint — no second/duplicate environment check", () => {
    const matches = [...code.matchAll(/\/api\/push\/debug-guard/g)]
    expect(matches.length).toBe(1) // single call site — one authority, never duplicated
  })

  test("never introduces a client-only environment trust mechanism (NEXT_PUBLIC_DEBUG, hostname checks, bypass query params)", () => {
    expect(code).not.toContain("NEXT_PUBLIC_DEBUG")
    expect(code).not.toContain("location.hostname")
    expect(code).not.toContain("location.host")
    expect(code).not.toMatch(/process\.env\.\w*ENV/)
  })

  test("defaults `allowed` to false and only flips true on an explicit allowed===true from the server", () => {
    expect(code).toContain("useState(false)")
    expect(code).toContain('data?.allowed === true')
  })

  test("a fetch failure/rejection resolves to allowed=false, never throws unhandled or defaults open", () => {
    const guardEffectStart = code.indexOf('fetch("/api/push/debug-guard")')
    const guardEffectEnd = code.indexOf("}, [])", guardEffectStart)
    const guardEffectBody = code.slice(guardEffectStart, guardEffectEnd)
    expect(guardEffectBody).toContain(".catch(")
    expect(guardEffectBody).toContain("setAllowed(false)")
  })

  test("Production guard response (404/non-ok) resolves allowed=false via the same .then((res) => (res.ok ? res.json() : null)) branch — no special-cased bypass", () => {
    expect(code).toContain("res.ok ? res.json() : null")
  })
})

// P2-T31-R6B (STANDALONE-PWA-DEBUG-ACCESS-AND-COLD-BOOTSTRAP): the discreet
// "Diagnóstico Push (TESTING)" entry is the ONLY way to reach the panel from
// an installed Home-Screen PWA (no address bar to edit `?pushDebug=1`).
describe("PushDebugPanel — standalone PWA entry point (P2-T31-R6B)", () => {
  const src = read("src/components/shared/push-debug-panel.tsx")
  const code = stripComments(src)

  test("the entry label is exactly 'Diagnóstico Push (TESTING)'", () => {
    expect(code).toContain("Diagnóstico Push (TESTING)")
  })

  test("the entry point (panelOpen===false branch) is reached only AFTER the `if (!allowed) return null` gate — structurally unreachable without it", () => {
    const gateIdx = code.indexOf("if (!allowed) return null")
    const entryIdx = code.indexOf("if (!panelOpen)")
    expect(gateIdx).toBeGreaterThan(-1)
    expect(entryIdx).toBeGreaterThan(gateIdx)
  })

  test("tapping the entry only ever calls setPanelOpen(true) — never arms tracing, never fetches Push endpoints, never mutates a subscription", () => {
    const entryStart = code.indexOf("if (!panelOpen)")
    const entryEnd = code.indexOf("return (\n    <div", entryStart)
    const entryBlock = code.slice(entryStart, entryEnd)
    expect(entryBlock).toContain("setPanelOpen(true)")
    expect(entryBlock).not.toContain("armPushDebugTrace")
    expect(entryBlock).not.toContain("fetch(")
    expect(entryBlock).not.toContain(".subscribe(")
  })

  test("panelOpen defaults to false — the full panel is never open on first render, only the discreet entry", () => {
    expect(code).toContain("const [panelOpen, setPanelOpen] = useState(false)")
  })
})

describe("PushDebugPanel — never mutates a subscription", () => {
  const src = read("src/components/shared/push-debug-panel.tsx")
  const code = stripComments(src)

  test("never calls PushManager.subscribe()", () => {
    expect(code).not.toContain("pushManager.subscribe(")
  })

  test("never calls .unsubscribe()", () => {
    expect(code).not.toContain(".unsubscribe(")
  })

  test("never POSTs to /api/push/subscribe or /api/push/unsubscribe", () => {
    expect(code).not.toContain("/api/push/subscribe")
    expect(code).not.toContain("/api/push/unsubscribe")
  })

  test("only real network calls are the read-only vapid-key and status endpoints", () => {
    const fetchCalls = [...code.matchAll(/fetch\(\s*["'`]?([^"'`),\s]+)/g)].map((m) => m[1])
    expect(fetchCalls.length).toBeGreaterThan(0)
    for (const call of fetchCalls) {
      expect(
        call.startsWith("/api/push/debug-guard") ||
          call.startsWith("/api/push/vapid-key") ||
          call === "statusUrl"
      ).toBe(true)
    }
  })
})

describe("PushDebugPanel — no secrets rendered", () => {
  const src = read("src/components/shared/push-debug-panel.tsx")
  const code = stripComments(src)

  test("never references the raw push endpoint field directly for display — delegates to the fingerprinting collector", () => {
    expect(code).not.toContain("subscription.endpoint")
    expect(code).toContain("collectPushDebugSnapshot")
  })

  test("never imports or references VAPID_PRIVATE_KEY", () => {
    expect(code).not.toContain("VAPID_PRIVATE_KEY")
  })

  test("never references session cookie names", () => {
    expect(code).not.toContain("SESSION_COOKIE_NAME")
    expect(code).not.toContain("document.cookie")
  })
})

describe("PushDebugPanel — refresh always does a fresh read (no accidental caching)", () => {
  const src = read("src/components/shared/push-debug-panel.tsx")
  const code = stripComments(src)

  test("handleRefresh calls collectPushDebugSnapshot on every invocation, not once cached in state", () => {
    const handleRefreshStart = code.indexOf("const handleRefresh")
    const handleRefreshEnd = code.indexOf("const handleCopy")
    const body = code.slice(handleRefreshStart, handleRefreshEnd)
    expect(body).toContain("await collectPushDebugSnapshot(")
    expect(body).toContain("setSnapshot(result)")
  })

  test("vapid-key fetch has no cache-control override implying a stale-tolerant read — plain fetch each time", () => {
    expect(code).not.toContain("cache: \"force-cache\"")
  })
})

describe("PushDebugPanel — copy button", () => {
  const src = read("src/components/shared/push-debug-panel.tsx")
  const code = stripComments(src)

  test("P2-T31-R6A: copies the FULL diagnostic (snapshot + trace meta + timeline), not the bare snapshot alone", () => {
    expect(code).toContain("buildFullPushDebugDiagnosticText(formatPushDebugSnapshot(snapshot), traceMeta, traceEvents)")
    expect(code).toContain("navigator.clipboard.writeText(text)")
  })

  test("copy is disabled until a snapshot exists", () => {
    const copyButtonIdx = code.indexOf("COPIAR DIAGNÓSTICO COMPLETO")
    expect(copyButtonIdx).toBeGreaterThan(-1)
    const precedingButtonOpenIdx = code.lastIndexOf("<Button", copyButtonIdx)
    const buttonTag = code.slice(precedingButtonOpenIdx, copyButtonIdx)
    expect(buttonTag).toContain("disabled={!snapshot}")
  })
})

// P2-T31-R6A (PUSH-LIFECYCLE-TIMELINE-DIAGNOSTIC): the panel extends R6 with
// a timeline view and arm/disarm/clear controls. P2-T31-R6B moved the single
// visibility gate to `allowed` alone (the standalone entry replaced the old
// `debugRequested` query-param gate) — arming is only ever reachable once
// that gate already passed AND the user tapped into the full panel.
describe("PushDebugPanel — timeline + arm/disarm/clear (R6A/R6B)", () => {
  const src = read("src/components/shared/push-debug-panel.tsx")
  const code = stripComments(src)

  test("imports the real tracer module, never a local reimplementation", () => {
    expect(code).toContain('from "@/lib/push-debug-trace"')
    expect(code).toContain("armPushDebugTrace")
    expect(code).toContain("disarmPushDebugTrace")
    expect(code).toContain("clearPushDebugTraceHistory")
    expect(code).toContain("getPushDebugTraceEvents")
    expect(code).toContain("getPushDebugTraceMeta")
    expect(code).toContain("isPushDebugTraceArmed")
  })

  test("the arm/disarm/clear/timeline reads all happen AFTER the 'if (!allowed) return null' gate — never before it", () => {
    const gateIdx = code.indexOf("if (!allowed) return null")
    expect(gateIdx).toBeGreaterThan(-1)
    const armIdx = code.indexOf("armPushDebugTrace()")
    const metaIdx = code.indexOf("getPushDebugTraceMeta()")
    const eventsIdx = code.indexOf("getPushDebugTraceEvents()")
    expect(armIdx).toBeGreaterThan(gateIdx)
    expect(metaIdx).toBeGreaterThan(gateIdx)
    expect(eventsIdx).toBeGreaterThan(gateIdx)
  })

  test("DEBUG_CLEAR_SEMANTICS: BORRAR HISTORIAL never touches the armed flag (clearPushDebugTraceHistory only clears events) — DESARMAR is the only action that stops recording", () => {
    const handleClearIdx = code.indexOf("const handleClearHistory")
    const handleClearEnd = code.indexOf("return (", handleClearIdx)
    const clearBody = code.slice(handleClearIdx, handleClearEnd)
    expect(clearBody).not.toContain("disarmPushDebugTrace")
    expect(clearBody).not.toContain("armPushDebugTrace()")

    const handleDisarmIdx = code.indexOf("const handleDisarm")
    const handleDisarmEnd = code.indexOf("const handleClearHistory", handleDisarmIdx)
    const disarmBody = code.slice(handleDisarmIdx, handleDisarmEnd)
    expect(disarmBody).toContain("disarmPushDebugTrace()")
  })

  test("timeline renders via formatPushDebugTraceEvent, never a hand-rolled inline formatter", () => {
    expect(code).toContain("traceEvents.map(formatPushDebugTraceEvent)")
  })

  test("BORRAR HISTORIAL calls clearPushDebugTraceHistory, never subscribe/unsubscribe", () => {
    const handleClearIdx = code.indexOf("const handleClearHistory")
    const handleClearEnd = code.indexOf("return (", handleClearIdx)
    const body = code.slice(handleClearIdx, handleClearEnd)
    expect(body).toContain("clearPushDebugTraceHistory()")
  })

  test("ARM/DESARMAR button toggles based on the real isPushDebugTraceArmed() read, not a locally-invented boolean", () => {
    expect(code).toContain("const armed = isPushDebugTraceArmed()")
    expect(code).toContain("armed ? (")
  })
})
