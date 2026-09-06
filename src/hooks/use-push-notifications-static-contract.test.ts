/// <reference types="bun-types" />
// P2-T05 Stage3 (F-P2-T05-02): static-contract test — proves
// SERVER_DETACH_ONLY without needing a real browser PushManager. Complements
// (does not replace) manual/browser verification.
import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

function read(relPath: string): string {
  return readFileSync(join(process.cwd(), ...relPath.split("/")), "utf-8")
}

describe("F-P2-T05-02 — PHYSICAL_UNSUBSCRIBE_POLICY_FINAL=SERVER_DETACH_ONLY", () => {
  const src = read("src/hooks/use-push-notifications.ts")

  test("PERSONAL_MANUAL_DISABLE_PHYSICAL_UNSUBSCRIBE=NO: unsubscribe() never calls subscription.unsubscribe()", () => {
    expect(src).not.toMatch(/subscription\.unsubscribe\(\)/)
  })

  test("PERSONAL_MANUAL_DISABLE_SERVER_DETACH_ONLY=SI: unsubscribe() still calls the server detach endpoint", () => {
    // P2-T18-BLOCKER-AUTH2-R13-R2 (F-P2-T18-AUTH02): the URL is now built
    // into a local `unsubscribeUrl` variable (carrying the actorFamily
    // selector) instead of a literal passed directly to fetch() — the
    // fetch call site and the base endpoint string are asserted separately.
    expect(src).toContain("fetch(unsubscribeUrl")
    expect(src).toContain('"/api/push/unsubscribe"')
  })

  test("no new endpoint was introduced for this — still exactly one call site to /api/push/unsubscribe (comment + selector-URL template + selector-URL fallback = 3 literal occurrences of the same single call site)", () => {
    const matches = src.match(/\/api\/push\/unsubscribe/g) ?? []
    expect(matches.length).toBe(3)
    const callSites = [...src.matchAll(/const res = await fetch\(unsubscribeUrl/g)]
    expect(callSites.length).toBe(1)
  })

  test("local state (isSubscribed/permission) is still updated after the server call, unconditionally on success", () => {
    const unsubscribeBody = src.slice(src.indexOf("const unsubscribe = useCallback"))
    // P2-T05 Hardening H3B (F-P2-T05-23): el literal directo `setIsSubscribed(false)`
    // ya no vive en el cuerpo de unsubscribe() — pasa por `finishMutation`,
    // que es quien de verdad aplica el estado (ver describe de H3B abajo).
    expect(unsubscribeBody).toContain("finishMutation(opId, false)")
    expect(unsubscribeBody).toContain('setPermission("default")')
  })
})

describe("F-P2-T05-13 — PERSONAL_PUSH_UI_STATUS_SOURCE=SERVER_ACTOR_ENDPOINT_BINDING", () => {
  const src = read("src/hooks/use-push-notifications.ts")
  const checkSubscriptionBody = src.slice(
    src.indexOf("const checkSubscription ="),
    src.indexOf("const getVapidKey =")
  )
  // P2-T05 Stage3R2: the actual staleness-guarded orchestration moved into
  // push-personal-status-check.ts (see push-personal-status-check.test.ts
  // for its DIRECT_BEHAVIORAL race coverage) — this file only wires it up.
  const statusCheckSrc = read("src/hooks/push-personal-status-check.ts")

  test("F_P2_T05_13_TEST: checkSubscription never derives isSubscribed from physical existence alone", () => {
    // The exact regressed line from before Stage3R1 must never come back.
    expect(src).not.toContain("setIsSubscribed(!!subscription)")
  })

  test("checkSubscription delegates to checkPersonalPushStatus, wired to the server-authoritative status endpoint", () => {
    expect(checkSubscriptionBody).toContain("checkPersonalPushStatus({")
    // P2-T18-BLOCKER-AUTH2-R13-R2 (F-P2-T18-AUTH02): the URL now carries the
    // actorFamily selector via a local `statusUrl` variable instead of a
    // literal passed directly to fetch().
    expect(checkSubscriptionBody).toContain("fetch(statusUrl")
    expect(checkSubscriptionBody).toContain('"/api/push/status"')
    expect(checkSubscriptionBody).toContain('method: "POST"')
    // P2-T05 Hardening H3B (F-P2-T05-23): `applyIsSubscribed` ahora apunta al
    // wrapper `applySubscribed` (mantiene también el ref siempre-fresco),
    // nunca directo a `setIsSubscribed` — ver F-P2-T05-23 describe abajo.
    expect(checkSubscriptionBody).toContain("applyIsSubscribed: applySubscribed")
  })

  test("CHECK_SUBSCRIPTION_AUTO_REGISTERS=NO: neither checkSubscription's wiring nor the status orchestration ever calls /api/push/subscribe", () => {
    expect(checkSubscriptionBody).not.toContain("/api/push/subscribe")
    expect(statusCheckSrc).not.toContain("/api/push/subscribe")
  })

  test("no physical subscription -> applyIsSubscribed(false) without ever calling fetchStatus", () => {
    const guardIdx = statusCheckSrc.indexOf("if (!subscription)")
    const fetchCallIdx = statusCheckSrc.indexOf("fetchStatus(")
    expect(guardIdx).toBeGreaterThan(-1)
    expect(fetchCallIdx).toBeGreaterThan(-1)
    expect(guardIdx).toBeLessThan(fetchCallIdx) // physical-absence guard runs BEFORE the status call
  })

  test("STATUS_CHECK_FAILURE_CAN_ASSERT_ENABLED_FROM_PHYSICAL_ONLY=NO: every failure branch in the orchestration applies false, never a bare true", () => {
    expect(statusCheckSrc).not.toMatch(/applyIsSubscribed\(true\)/)
    const applyCalls = statusCheckSrc.match(/applyIsSubscribed\([^)]*\)/g) ?? []
    expect(applyCalls.length).toBeGreaterThan(0)
    for (const call of applyCalls) {
      expect(call === "applyIsSubscribed(false)" || call === "applyIsSubscribed(result.subscribed === true)").toBe(true)
    }
  })

  test("the server result (result.subscribed) is the ONLY expression that can apply true", () => {
    expect(statusCheckSrc).toContain("applyIsSubscribed(result.subscribed === true)")
  })
})

describe("F-P2-T05-14 — PERSONAL_PUSH_ASYNC_MODEL=LATEST_RELEVANT_OPERATION_WINS (wiring)", () => {
  const src = read("src/hooks/use-push-notifications.ts")

  test("a single shared gate instance exists per hook, used by checkSubscription/subscribe/unsubscribe", () => {
    expect(src).toContain("createLatestOperationGate()")
    const gateUsages = src.match(/gateRef\.current/g) ?? []
    expect(gateUsages.length).toBeGreaterThanOrEqual(6)
  })

  test("subscribe() begins its own operation synchronously and guards its success apply via finishMutation", () => {
    const body = src.slice(src.indexOf("const subscribe = useCallback"), src.indexOf("const unsubscribe = useCallback"))
    const beginIdx = body.indexOf("gateRef.current.begin()")
    const awaitIdx = body.indexOf("await Notification.requestPermission()")
    expect(beginIdx).toBeGreaterThan(-1)
    expect(awaitIdx).toBeGreaterThan(-1)
    expect(beginIdx).toBeLessThan(awaitIdx) // begin() happens BEFORE the first await — synchronous invalidation
    expect(body).toContain("gateRef.current.isCurrent(opId)")
    expect(body).toContain("finishMutation(opId, true)")
  })

  test("unsubscribe() begins its own operation synchronously and guards its success apply via finishMutation", () => {
    const body = src.slice(src.indexOf("const unsubscribe = useCallback"), src.lastIndexOf("return {"))
    const beginIdx = body.indexOf("gateRef.current.begin()")
    const awaitIdx = body.indexOf("await navigator.serviceWorker.ready")
    expect(beginIdx).toBeGreaterThan(-1)
    expect(awaitIdx).toBeGreaterThan(-1)
    expect(beginIdx).toBeLessThan(awaitIdx)
    expect(body).toContain("gateRef.current.isCurrent(opId)")
    expect(body).toContain("finishMutation(opId, false)")
  })

  test("ACTOR_CHANGE_INVALIDATES_PENDING_PUSH_OPERATIONS=SI: an actorKey-dependent effect invalidates the gate and resets local state", () => {
    const effectIdx = src.indexOf("[actorKey]")
    expect(effectIdx).toBeGreaterThan(-1)
    const actorEffectBody = src.slice(src.lastIndexOf("useEffect(() => {", effectIdx), effectIdx)
    expect(actorEffectBody).toContain("gateRef.current.invalidate()")
    expect(actorEffectBody).toContain("applySubscribed(false)")
  })

  test("CLIENT_ACTOR_METADATA_USED_AS_SECURITY_AUTHORITY=NO: actorKey is never sent to the server, only read locally from the auth store", () => {
    expect(src).toContain("useAuthStore((s) => s.user?.id ?? null)")
    expect(src).toContain("useAuthStore((s) => s.user?.type ?? null)")
    // actorKey must never be interpolated into any fetch body/header in this file.
    const fetchBodies = [...src.matchAll(/body:\s*JSON\.stringify\(\{[^}]*\}\)/g)].map((m) => m[0])
    for (const body of fetchBodies) {
      expect(body).not.toContain("actorKey")
    }
  })

  test("UNMOUNT_INVALIDATES_PENDING_PUSH_OPERATIONS=SI: the mount effect's cleanup invalidates the gate", () => {
    // Anchored on `const supported =`, which only appears inside the mount
    // effect's body — avoids matching the closing `}, [])` of an unrelated
    // earlier `useCallback`/`useEffect` (e.g. `applySubscribed`).
    const mountEffectStart = src.indexOf("const supported =")
    expect(mountEffectStart).toBeGreaterThan(-1)
    const mountEffect = src.slice(mountEffectStart, src.indexOf("}, [])", mountEffectStart) + "}, [])".length)
    expect(mountEffect).toContain("return () => {")
    expect(mountEffect).toContain("gateRef.current.invalidate()")
  })

  test("STATUS_RESULT_BOUND_TO_CURRENT_PHYSICAL_ENDPOINT=SI: the status orchestration re-verifies the physical endpoint before applying (Race D)", () => {
    const statusCheckSrc = read("src/hooks/push-personal-status-check.ts")
    expect(statusCheckSrc).toContain("currentSubscription?.endpoint !== endpoint")
  })
})

describe("F-P2-T05-23 — subscribe()/unsubscribe() never let a consumer re-read a stale closed-over isSubscribed", () => {
  const src = read("src/hooks/use-push-notifications.ts")
  const subscribeBody = src.slice(src.indexOf("const subscribe = useCallback"), src.indexOf("const unsubscribe = useCallback"))
  const unsubscribeBody = src.slice(src.indexOf("const unsubscribe = useCallback"), src.lastIndexOf("return {"))

  test("PushMutationResult is exported and both mutations return Promise<PushMutationResult>", () => {
    expect(src).toContain("export interface PushMutationResult")
    expect(src).toContain("subscribe: () => Promise<PushMutationResult>")
    expect(src).toContain("unsubscribe: () => Promise<PushMutationResult>")
  })

  test("F23_POST_AWAIT_STALE_PUSH_STATE_READ_PRESENT=NO: subscribe()/unsubscribe() never re-check `isSubscribed` after an await to decide their own outcome", () => {
    // The exact regressed pattern this finding was about: `if (!push.isSubscribed)`
    // (or the hook's own bare state var used the same stale way) must never
    // reappear as a post-await decision inside these two functions.
    expect(subscribeBody).not.toMatch(/if\s*\(\s*!?\s*isSubscribed\s*\)/)
    expect(unsubscribeBody).not.toMatch(/if\s*\(\s*!?\s*isSubscribed\s*\)/)
  })

  test("finishMutation is the single exit point that decides `current` via the always-fresh gate, never a stale closure", () => {
    const finishIdx = src.indexOf("const finishMutation = useCallback(")
    expect(finishIdx).toBeGreaterThan(-1)
    const finishBody = src.slice(finishIdx, src.indexOf("const subscribe = useCallback"))
    expect(finishBody).toContain("gateRef.current.isCurrent(opId)")
    expect(finishBody).toContain("applySubscribed(subscribed)")
    expect(finishBody).toContain("setLoading(false)")
    // Reports { current, subscribed } — stale callers get current:false and
    // must not act on `subscribed` at all (enforced by convention + the
    // client-profile-panel wiring, not by this file).
    expect(finishBody).toMatch(/return\s*\{\s*current,\s*subscribed:/)
  })

  test("isSubscribedRef mirrors every applied value — never stale even mid-closure after an await", () => {
    expect(src).toContain("const isSubscribedRef = useRef(false)")
    expect(src).toContain("isSubscribedRef.current = value")
    // Failure paths report the ref (always fresh), never a bare re-derivation.
    expect(unsubscribeBody).toContain("finishMutation(opId, isSubscribedRef.current)")
  })
})

describe("F-P2-T05-15 — stale operations cannot own loading/toast (auxiliary state gated by the same latest-operation gate)", () => {
  const src = read("src/hooks/use-push-notifications.ts")
  const subscribeBody = src.slice(src.indexOf("const subscribe = useCallback"), src.indexOf("const unsubscribe = useCallback"))
  const unsubscribeBody = src.slice(src.indexOf("const unsubscribe = useCallback"), src.lastIndexOf("return {"))

  function toastCallSitesAreGated(body: string, toastCall: string) {
    // Every occurrence of a given toast.* call must be immediately preceded
    // (allowing only whitespace/comment lines) by an isCurrent(opId) guard —
    // i.e. it lives inside `if (gateRef.current.isCurrent(opId)) { ... toastCall ... }`.
    const idx = body.indexOf(toastCall)
    expect(idx).toBeGreaterThan(-1)
    const preceding = body.slice(0, idx)
    const guardIdx = preceding.lastIndexOf("gateRef.current.isCurrent(opId)")
    expect(guardIdx).toBeGreaterThan(-1)
    // No unrelated statement terminator between the guard and this toast call
    // that would put them in different blocks (a closing brace for a
    // DIFFERENT earlier if is fine; what matters is no `}` immediately after
    // the guard's own opening brace before reaching the toast call — checked
    // structurally by requiring the guard to be the NEAREST preceding one).
    const laterGuardIdx = preceding.lastIndexOf("gateRef.current.isCurrent(opId))")
    expect(laterGuardIdx).toBe(guardIdx)
  }

  test("subscribe(): every toast.error/toast.success call site is gated by isCurrent(opId)", () => {
    toastCallSitesAreGated(subscribeBody, "toast.error(\"Necesitás permitir las notificaciones")
    toastCallSitesAreGated(subscribeBody, "toast.error(\"Las notificaciones push no están configuradas")
    toastCallSitesAreGated(subscribeBody, "toast.success(\"Notificaciones activadas")
    toastCallSitesAreGated(subscribeBody, "toast.error(\"Error al activar notificaciones")
  })

  test("unsubscribe(): every toast.error/toast.success call site is gated by isCurrent(opId)", () => {
    toastCallSitesAreGated(unsubscribeBody, "toast.success(\"Notificaciones desactivadas")
    toastCallSitesAreGated(unsubscribeBody, "toast.error(\"Error al desactivar notificaciones")
  })

  test("CURRENT_SUCCESS_CLEARS_LOADING / CURRENT_FAILURE_CLEARS_LOADING: setLoading(false) only runs when isCurrent(opId), both in finishMutation and the finally net", () => {
    expect(src).toMatch(/if\s*\(current\)\s*\{\s*applySubscribed\(subscribed\)\s*\n\s*setLoading\(false\)/)
    // The `finally` net in each mutation is ALSO gated — never a bare setLoading(false).
    expect((subscribeBody.match(/setLoading\(false\)/g) ?? []).length).toBeGreaterThanOrEqual(1)
    expect(subscribeBody).not.toMatch(/finally\s*\{\s*setLoading\(false\)\s*\}/)
    expect(unsubscribeBody).not.toMatch(/finally\s*\{\s*setLoading\(false\)\s*\}/)
  })

  test("STATUS_CHECK_CAN_STEAL_MUTATION_LOADING_OWNERSHIP=NO: checkSubscription/checkPersonalPushStatus never reference loading at all", () => {
    const checkSubscriptionBody = src.slice(src.indexOf("const checkSubscription ="), src.indexOf("const getVapidKey ="))
    expect(checkSubscriptionBody).not.toContain("setLoading")
    expect(checkSubscriptionBody).not.toContain("loading")
    const statusCheckSrc = read("src/hooks/push-personal-status-check.ts")
    expect(statusCheckSrc).not.toContain("loading")
  })

  test("ACTOR_CHANGE_CANNOT_LEAVE_LOADING_STUCK=SI: the actor-change effect resets loading, not only the gate/isSubscribed (P2-T05 Hardening H3B precommit review finding)", () => {
    // Invalidating the gate alone does NOT clear a stale mutation's own
    // finally-block setLoading(false) — that finally is itself gated by
    // isCurrent(opId), which is now false. Without an explicit reset here,
    // a mutation in flight at the moment the actor changes leaves `loading`
    // (and therefore the disabled Switch) stuck true for the new actor,
    // with no way for that actor to trigger a fresh mutation to clear it.
    const effectIdx = src.indexOf("[actorKey]")
    const actorEffectBody = src.slice(src.lastIndexOf("useEffect(() => {", effectIdx), effectIdx)
    expect(actorEffectBody).toContain("gateRef.current.invalidate()")
    expect(actorEffectBody).toContain("applySubscribed(false)")
    expect(actorEffectBody).toContain("setLoading(false)")
  })
})

// P2-T18-BLOCKER-AUTH2-R13-R2 (F-P2-T18-AUTH02): /api/push/status,
// /api/push/subscribe y /api/push/unsubscribe son endpoints compartidos sin
// familia derivable de su propio path — bajo 2+ cookies de familia
// coexistiendo, resolveActorSession() no puede resolverlos sin un selector
// explícito. Este hook ya computaba `actorType` para otro propósito
// (invalidación Race C, no-autoritativo) — se reutiliza como fuente del
// selector, nunca window.location.pathname (el hook se usa desde paneles de
// perfil montados bajo rutas de familia, pero el propio hook no depende de
// eso, y no debe hacerlo).
describe("F-P2-T18-AUTH02 — use-push-notifications actorFamily selector propagation", () => {
  const src = read("src/hooks/use-push-notifications.ts")

  test("actorType (useAuthStore().user?.type) is the trusted family source, never window.location.pathname", () => {
    expect(src).toContain('const actorType = useAuthStore((s) => s.user?.type ?? null)')
    expect(src).not.toContain("activeSessionFamily(")
    expect(src).not.toContain("window.location.pathname")
  })

  test("all three call sites (status, subscribe, unsubscribe) build their URL from actorType with the same ternary shape", () => {
    expect(src).toContain('const statusUrl = actorType ? `/api/push/status?actorFamily=${actorType}` : "/api/push/status"')
    expect(src).toContain('const subscribeUrl = actorType ? `/api/push/subscribe?actorFamily=${actorType}` : "/api/push/subscribe"')
    expect(src).toContain('const unsubscribeUrl = actorType ? `/api/push/unsubscribe?actorFamily=${actorType}` : "/api/push/unsubscribe"')
    // P2-T18-BLOCKER-AUTH2-R13-R3-R1 (M9 gap closure): the three checks above
    // only proved each URL variable is DECLARED — mirroring the consumption
    // checks that already exist for unsubscribeUrl ("fetch(unsubscribeUrl",
    // F-P2-T05-02 describe above) and statusUrl ("fetch(statusUrl",
    // F-P2-T05-13 describe above), this proves subscribe()'s fetch actually
    // CONSUMES subscribeUrl rather than a bare literal (R13-R3 mutant M9
    // survived because this was missing).
    expect(src).toContain("fetch(subscribeUrl")
  })

  test("subscribe() and unsubscribe() depend on actorType in their useCallback deps array — a fresh actor never reuses a stale selector", () => {
    // P2-T31-R2: `actorKey` was added to both deps arrays alongside
    // `actorType` — subscribe()/unsubscribe() now also reference `actorKey`
    // directly (to register with the in-flight-mutation registry, see
    // push-mutation-in-flight-registry.ts), so a stale `actorKey` closure
    // would register under the WRONG actor's key just as surely as a stale
    // `actorType` would build the wrong URL.
    expect(src).toContain("}, [isSupported, loading, finishMutation, actorType, actorKey])")
    const depsOccurrences = [...src.matchAll(/\}, \[isSupported, loading, finishMutation, actorType, actorKey\]\)/g)]
    expect(depsOccurrences.length).toBe(2)
  })
})

// P2-T31-R2 (FIRST-SUBSCRIBE-REMOUNT-STATE): a fresh mount's status check
// must not draw a conclusion from `getCurrentSubscription()` while a
// subscribe()/unsubscribe() from a PREVIOUS (already-unmounted) instance is
// still completing — see push-mutation-in-flight-registry.ts and the
// DIRECT_BEHAVIORAL races in push-personal-status-check.test.ts (RACE E) for
// the actual repro. This describe only certifies the WIRING: that
// subscribe()/unsubscribe() register themselves and checkSubscription()
// consults the registry, using the real production module (never a
// hand-rolled substitute).
describe("P2-T31-R2 — first-subscribe/remount in-flight-mutation wiring", () => {
  const src = read("src/hooks/use-push-notifications.ts")
  const subscribeBody = src.slice(src.indexOf("const subscribe = useCallback"), src.indexOf("const unsubscribe = useCallback"))
  const unsubscribeBody = src.slice(src.indexOf("const unsubscribe = useCallback"), src.lastIndexOf("return {"))
  const checkSubscriptionBody = src.slice(src.indexOf("const checkSubscription ="), src.indexOf("const getVapidKey ="))

  test("both mutations import from the real production registry module, never a local reimplementation", () => {
    expect(src).toContain('from "./push-mutation-in-flight-registry"')
    expect(src).toContain("registerInFlightPersonalPushMutation")
    expect(src).toContain("waitForInFlightPersonalPushMutation")
  })

  test("subscribe()/unsubscribe() register their real mutation promise (the one they return), not a decoy", () => {
    for (const body of [subscribeBody, unsubscribeBody]) {
      expect(body).toContain("const mutationPromise = run()")
      expect(body).toContain("registerInFlightPersonalPushMutation(actorKey, mutationPromise)")
      expect(body).toContain("return mutationPromise")
    }
  })

  test("registration happens BEFORE the mutation is returned to the caller — a status check started right after calling subscribe()/unsubscribe() can already see it", () => {
    for (const body of [subscribeBody, unsubscribeBody]) {
      const registerIdx = body.indexOf("registerInFlightPersonalPushMutation(actorKey, mutationPromise)")
      const returnIdx = body.indexOf("return mutationPromise")
      expect(registerIdx).toBeGreaterThan(-1)
      expect(returnIdx).toBeGreaterThan(registerIdx)
    }
  })

  test("checkSubscription() wires waitForInFlightMutation to the SAME actorKey used by Race C, calling into the real registry function", () => {
    expect(checkSubscriptionBody).toContain("waitForInFlightMutation: () => waitForInFlightPersonalPushMutation(actorKey)")
  })
})

// P2-T31-R3 (ANDROID-WEB-PUSH-DELIVERY-CROSS-ENV-AUDIT): reproduced live
// against TESTING that a stale physical PushSubscription (bound to an old
// VAPID public key — Apple: `VapidPkHashMismatch`, statusCode 400) was being
// silently reused forever by subscribe()'s `existingSubscription ?? ...`
// pattern, with no check against the CURRENT server VAPID key — see
// push-subscription-key.ts::applicationServerKeyMatches and the P2_T31_R3
// report for the full evidence chain.
describe("P2-T31-R3 — subscribe() validates an existing physical subscription's VAPID key before reusing it", () => {
  const src = read("src/hooks/use-push-notifications.ts")
  const subscribeBody = src.slice(src.indexOf("const subscribe = useCallback"), src.indexOf("const unsubscribe = useCallback"))

  test("imports the real conversion/comparison helpers from push-subscription-key.ts, never a local reimplementation", () => {
    expect(src).toContain('from "@/lib/push-subscription-key"')
    expect(src).toContain("applicationServerKeyMatches")
    expect(src).toContain("urlBase64ToUint8Array")
  })

  test("the VAPID key is converted via urlBase64ToUint8Array before being used, both for comparison AND for a fresh subscribe()", () => {
    expect(subscribeBody).toContain("const applicationServerKey = urlBase64ToUint8Array(vapidKey)")
  })

  test("an existing physical subscription's key is compared against the current key before deciding whether to reuse it", () => {
    expect(subscribeBody).toContain("applicationServerKeyMatches(")
    expect(subscribeBody).toContain("existingSubscription?.options.applicationServerKey ?? null")
  })

  test("a stale (mismatched) existing subscription goes through confirmed removal (P2-T31-R5A) before a fresh one is created — never silently reused", () => {
    // Stripped of comments, so a mention inside an explanatory comment
    // cannot make this pass for the wrong reason.
    const codeOnly = subscribeBody
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n")
    const removalCallIdx = codeOnly.indexOf("await unsubscribeStalePushSubscription(existingSubscription")
    const guardIdx = codeOnly.lastIndexOf(
      "if (existingSubscription && !existingKeyIsCurrent)",
      removalCallIdx === -1 ? undefined : removalCallIdx
    )
    expect(removalCallIdx).toBeGreaterThan(-1)
    expect(guardIdx).toBeGreaterThan(-1)
    expect(guardIdx).toBeLessThan(removalCallIdx)
  })

  test("P2-T31-R5A: an unconfirmed removal aborts (throws) instead of proceeding to create a subscription on top of a possibly-still-live one", () => {
    const codeOnly = subscribeBody
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n")
    const removalCallIdx = codeOnly.indexOf("await unsubscribeStalePushSubscription(existingSubscription")
    const throwIdx = codeOnly.indexOf("throw new Error(", removalCallIdx)
    expect(removalCallIdx).toBeGreaterThan(-1)
    expect(throwIdx).toBeGreaterThan(removalCallIdx)
  })

  test("the reuse decision requires BOTH an existing subscription AND a matching key — a matched-but-absent subscription can never be reused", () => {
    expect(subscribeBody).toContain("existingSubscription && existingKeyIsCurrent")
  })
})

describe("P2-T31-R5A — subscribe() confirms stale-subscription removal via the real shared helper, never a local reimplementation", () => {
  const src = read("src/hooks/use-push-notifications.ts")

  test("imports unsubscribeStalePushSubscription from push-subscription-key.ts alongside the R3 helpers", () => {
    expect(src).toContain("unsubscribeStalePushSubscription")
    expect(src).toContain('from "@/lib/push-subscription-key"')
  })
})

// P2-T31-R6A (PUSH-LIFECYCLE-TIMELINE-DIAGNOSTIC): this hook is instrumented
// with `recordPushDebugEvent` calls at every real lifecycle point, but §21 of
// the task explicitly forbids any functional change — no delay, no retry, no
// new gate/actor-resolution behavior. These tests certify the wiring exists
// AND that every describe block above (unmodified) still proves the exact
// same subscribe/unsubscribe/status/gate/actor/loading contracts as before
// R6A — i.e. tracing was added, nothing else changed.
describe("P2-T31-R6A — diagnostic tracer wiring is purely additive", () => {
  const src = read("src/hooks/use-push-notifications.ts")
  const subscribeBody = src.slice(src.indexOf("const subscribe = useCallback"), src.indexOf("const unsubscribe = useCallback"))
  const unsubscribeBody = src.slice(src.indexOf("const unsubscribe = useCallback"), src.lastIndexOf("return {"))
  const checkSubscriptionBody = src.slice(src.indexOf("const checkSubscription ="), src.indexOf("const getVapidKey ="))

  test("imports the real tracer module, never a local reimplementation", () => {
    expect(src).toContain('from "@/lib/push-debug-trace"')
    expect(src).toContain("recordPushDebugEvent")
    expect(src).toContain("setPushDebugTraceContext")
  })

  test("checkSubscription passes the real recordPushDebugEvent as `trace` into checkPersonalPushStatus", () => {
    expect(checkSubscriptionBody).toContain("trace: recordPushDebugEvent")
  })

  test("subscribe()/unsubscribe() emit START and FINISH events bracketing the real mutation", () => {
    expect(subscribeBody).toContain('recordPushDebugEvent("SUBSCRIBE_START"')
    expect(subscribeBody).toContain('recordPushDebugEvent("SUBSCRIBE_FINISH"')
    expect(unsubscribeBody).toContain('recordPushDebugEvent("UNSUBSCRIBE_START"')
    expect(unsubscribeBody).toContain('recordPushDebugEvent("UNSUBSCRIBE_FINISH"')
  })

  test("subscribe() never traces the raw endpoint — only fingerprintPushEndpoint(...)", () => {
    expect(subscribeBody).toContain("fingerprintPushEndpoint(")
    expect(subscribeBody).not.toMatch(/recordPushDebugEvent\([^)]*endpoint:\s*(existingSubscription|subscription)\.endpoint/)
  })

  test("a new authHasHydrated selector exists and is read-only — never appears inside an `if` that gates subscribe/unsubscribe/status decisions", () => {
    expect(src).toContain("const authHasHydrated = useAuthStore((s) => s._hasHydrated)")
    // The only conditional uses of authHasHydrated must be the observational
    // AUTH_HYDRATED effect — never a guard around checkSubscription/
    // subscribe/unsubscribe/finishMutation.
    const hydratedGuards = [...src.matchAll(/if\s*\([^)]*authHasHydrated[^)]*\)/g)].map((m) => m[0])
    for (const guard of hydratedGuards) {
      expect(guard).toContain("wasHydratedRef.current")
    }
  })

  test("AUTH_HYDRATED fires from its own dedicated effect, never inside the mount or actorKey effects (kept structurally separate so it cannot change their timing)", () => {
    const mountEffectStart = src.indexOf("const supported =")
    const mountEffect = src.slice(mountEffectStart, src.indexOf("}, [])", mountEffectStart) + "}, [])".length)
    expect(mountEffect).not.toContain("AUTH_HYDRATED")

    const actorKeyEffectIdx = src.indexOf("[actorKey]")
    const actorEffectBody = src.slice(src.lastIndexOf("useEffect(() => {", actorKeyEffectIdx), actorKeyEffectIdx)
    expect(actorEffectBody).not.toContain("AUTH_HYDRATED")

    expect(src).toContain('recordPushDebugEvent("AUTH_HYDRATED"')
  })

  test("HOOK_IS_SUBSCRIBED_CHANGED is gated on an actual value change, never fired unconditionally", () => {
    const applyIdx = src.indexOf("const applySubscribed = useCallback")
    const applyEnd = src.indexOf("}, [])", applyIdx) + "}, [])".length
    const applyBody = src.slice(applyIdx, applyEnd)
    expect(applyBody).toContain("if (isSubscribedRef.current !== value)")
    expect(applyBody).toContain('recordPushDebugEvent("HOOK_IS_SUBSCRIBED_CHANGED"')
  })

  test("PUSH_HOOK_MOUNT/UNMOUNT wrap the existing mount effect body without altering its return/cleanup contract", () => {
    const mountEffectStart = src.indexOf("const supported =")
    const mountEffect = src.slice(src.lastIndexOf("useEffect(() => {", mountEffectStart), src.indexOf("}, [])", mountEffectStart) + "}, [])".length)
    expect(mountEffect).toContain('recordPushDebugEvent("PUSH_HOOK_MOUNT")')
    expect(mountEffect).toContain('recordPushDebugEvent("PUSH_HOOK_UNMOUNT")')
    expect(mountEffect).toContain("return () => {")
    expect(mountEffect).toContain("gateRef.current.invalidate()")
  })
})
