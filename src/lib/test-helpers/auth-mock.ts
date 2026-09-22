// P2-T05 Hardening H4 (F-P2-T05-22): canonical `@/lib/auth` mock shared by
// every Push-related test file that calls `mock.module("@/lib/auth", ...)`.
//
// ROOT CAUSE this file exists to eliminate: `mock.module()` patches Bun's
// module registry PROCESS-WIDE. When several test files are loaded in the
// same `bun test` invocation, each file's route handlers call the imported
// `@/lib/auth` functions lazily, at TEST-EXECUTION time (inside `test()`
// bodies, run in a later runner phase) — not at each file's own
// module-load time. By then only ONE registered factory for "@/lib/auth"
// survives process-wide, and EVERY route across EVERY file resolves its
// calls to that single surviving factory, regardless of which file
// registered it. Before this helper, seven files registered SEVEN
// mutually-incompatible partial shapes (some missing `validateSession`,
// others missing `getUserFromToken`/`SESSION_COOKIE_NAME`) — whichever
// shape survived left every OTHER file's route calls a named export short,
// producing `SyntaxError: Export named 'X' not found in module
// '.../auth.ts'` (or, when every name happened to exist, silently running
// against a DIFFERENT file's captured state/closure instead).
//
// Fix, in two parts:
//  1. SHAPE: every one of the seven files installs this exact same
//     canonical superset (`buildAuthMockModule`) — so no matter which
//     file's registration Bun keeps, the surviving module has the
//     complete, identical set of exports. No missing-export SyntaxError is
//     possible anymore.
//  2. SEMANTICS: `authMockState`/`authMockHooks` below are SINGLETONS —
//     this module (unlike "@/lib/auth" itself) is never itself
//     `mock.module`-replaced, so ordinary ESM module caching guarantees
//     every one of the seven files' `import { authMockState } from
//     "@/lib/test-helpers/auth-mock"` resolves to the literal SAME object.
//     Each file's own `beforeEach` mutates that SAME shared object right
//     before its own tests run, so whichever factory Bun actually kept
//     still observes the CURRENTLY-running file's configured scenario —
//     the winning closure is always reading live, current state, never a
//     stale snapshot private to whichever file happened to "win".
import { mock } from "bun:test"

export interface AuthMockState {
  /** Backing store for `validateSession()` — consumed by chat/mensajes. */
  sessionResult: { userId: string; userType: string } | null
  /** Backing store for `getUserFromToken()` — consumed by the 3 push/* routes. */
  currentUser: { id: string; type: string } | null
  /** Backing store for `validateOperationalSession()` — consumed by operativo/logout. */
  operationalSessionByToken: Map<string, { cuentaOperativaId: string } | null>
  /** Backing store for `deleteOperationalSession()` — consumed by operativo/logout. */
  deletedOperationalSessionTokens: string[]
  /**
   * P2-T40-R1: backing store for `getOperationalAccountFromRequest()` —
   * consumed by /api/push/subscribe|unsubscribe|reconcile-stale-owner's
   * `actorFamily=cuenta_operativa` branch. Purely additive to the canonical
   * superset (H4) — every pre-existing test file that never sets this field
   * keeps getting `null` (its previous implicit behavior, since none of
   * them exercised this branch), so this addition cannot regress them.
   */
  currentOperationalAccount: { id: string } | null
  /**
   * P2-T40-R1: backing store for `findSesionByToken()` — consumed by
   * applyLoginCookies()/applyOperationalLoginCookies() (STALE_PREVIOUS_OWNER_RULE
   * handoff-minting). Purely additive; every pre-existing test that never
   * sets this keeps getting `null` (its previous implicit behavior).
   */
  sesionByToken: Map<string, { token: string; userId: string; userType: string; expiresAt: Date } | null>
}

/** The exact literal every push/* test's request cookie carries as the "authenticated" token — matches the pre-H4 per-file constant verbatim. */
export const AUTH_MOCK_VALID_TOKEN = "valid-token"

/** P2-T40-R1: matching literal for the operational session cookie in tests exercising `actorFamily=cuenta_operativa`. */
export const AUTH_MOCK_VALID_OPERATIONAL_TOKEN = "valid-operational-token"

function createAuthMockState(): AuthMockState {
  return {
    sessionResult: null,
    currentUser: null,
    operationalSessionByToken: new Map(),
    deletedOperationalSessionTokens: [],
    currentOperationalAccount: null,
    sesionByToken: new Map(),
  }
}

/**
 * The ONE shared mutable state singleton every file's mock functions read
 * from and every file's `beforeEach` writes to. A plain module-level
 * `const` — ordinary ESM caching (not `mock.module`) guarantees every
 * importer gets this exact same object.
 */
export const authMockState: AuthMockState = createAuthMockState()

export interface AuthMockHooks {
  /**
   * Optional extra side-effect run whenever `deleteOperationalSession` is
   * called — lets operativo/logout's test prove call-ORDERING against its
   * own other mocks (e.g. "push detach happened before session delete")
   * without giving that file a second, competing
   * `mock.module("@/lib/auth", ...)` registration. Left `undefined` by
   * every other file; harmless no-op when unset. Because `authMockHooks`
   * is ALSO a shared singleton (not an argument baked into whichever
   * factory happens to win), setting this field works regardless of
   * registration order — the winning factory always reads the CURRENT
   * value at call time.
   */
  onDeleteOperationalSession?: (token: string) => void
}

export const authMockHooks: AuthMockHooks = {}

/** Resets every shared state field — call from EVERY file's own `beforeEach` so a test never inherits state a DIFFERENT file's previous test left behind. */
export function resetAuthMockState(state: AuthMockState = authMockState): void {
  state.sessionResult = null
  state.currentUser = null
  state.operationalSessionByToken = new Map()
  state.deletedOperationalSessionTokens = []
  state.currentOperationalAccount = null
  state.sesionByToken = new Map()
  authMockHooks.onDeleteOperationalSession = undefined
}

function buildAuthMockModule() {
  return {
    SESSION_COOKIE_NAME: "deligo_session",
    OPERATIONAL_SESSION_COOKIE_NAME: "deligo_operativo_session",
    validateSession: async (_token: string) => authMockState.sessionResult,
    getUserFromToken: async (token: string) => (token === AUTH_MOCK_VALID_TOKEN ? authMockState.currentUser : null),
    validateOperationalSession: async (token: string) => authMockState.operationalSessionByToken.get(token) ?? null,
    deleteOperationalSession: async (token: string) => {
      authMockState.deletedOperationalSessionTokens.push(token)
      authMockHooks.onDeleteOperationalSession?.(token)
    },
    // P2-T40-R1: matches the real signature shape used by
    // src/app/api/push/*/route.ts (reads the operational cookie off the
    // request) closely enough for these tests — real token match only,
    // never trusts anything else from the request.
    getOperationalAccountFromRequest: async (req: { cookies: { get: (name: string) => { value: string } | undefined } }) => {
      const token = req.cookies.get("deligo_operativo_session")?.value
      return token === AUTH_MOCK_VALID_OPERATIONAL_TOKEN ? authMockState.currentOperationalAccount : null
    },
    // P2-T40-R1: consumed by applyLoginCookies()/applyOperationalLoginCookies()
    // to look up the owner occupying a cookie slot immediately before the
    // current login — never filters by expiresAt (matches the real
    // src/lib/auth.ts, which only enforces expiry inside
    // validateSession/validateOperationalSession, never here).
    findSesionByToken: async (token: string) => authMockState.sesionByToken.get(token) ?? null,
    getFamilySessionCookieName: (family: string) => `deligo_session_${family}`,
    SESSION_DURATION_HOURS: 12,
    evaluatePasswordHash: async () => ({ valid: false, needsUpgrade: false }),
    createSession: async () => "unused-in-auth-mock",
    createSessionWithClient: async () => "unused-in-auth-mock",
    createOperationalSession: async () => "unused-in-auth-mock",
    hashPassword: async () => "unused-in-auth-mock",
  }
}

/** Registers the canonical shape. Call once per file, before importing the route under test. Every call across every file registers behaviorally-identical functions (all closing over the same shared singletons) — so it does not matter which file's registration Bun ultimately keeps. */
export function installAuthMock(): void {
  mock.module("@/lib/auth", buildAuthMockModule)
}
