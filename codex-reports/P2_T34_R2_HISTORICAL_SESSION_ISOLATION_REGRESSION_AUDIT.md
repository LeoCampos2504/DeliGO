# P2-T34-R2 — Historical regression audit: Cliente / Repartidor session isolation

Fecha: 2026-09-26  
Modo: `READ_ONLY_HISTORICAL_CODE_GIT_DOCUMENTATION_AUDIT`  
Baseline: `origin/testing-codex` = `82ee16a27e71cd4d438c81f7953a4956a563389d`  
Checkout usado para historial: rama/worktree existente `work/p2-t43-r2`, con cambios locales ajenos preservados. No hubo checkout/reset/stash ni cambio de rama. El código actual se contrastó directamente con la ref del baseline.

## Resultado ejecutivo

La auditoría no encontró un commit posterior que haya quitado el aislamiento de cookies por familia, cambiado la selección de `/api/auth/me`, vuelto a unir los namespaces de Zustand o alterado el guard Cliente de rol incorrecto. Por tanto, no se confirma una regresión posterior introducida por un commit.

Sí se encontró un gap histórico concreto: el arreglo AUTH01 convirtió el login de contraseña en family-aware, pero no migró el callback Google OAuth, que continúa escribiendo el alias global `deligo_session`. El proxy todavía permite usar ese alias como fallback cuando falta la cookie de la familia solicitada. Si las autenticaciones del Caso B pasaron por ese callback (o no quedó una cookie familiar Cliente disponible), el flujo puede producir exactamente `/cliente` → `/api/auth/me?actorFamily=cliente` → fallback a sesión Repartidor → Zustand Cliente recibe `type=repartidor` → `WrongRoleNotice`. El método de login del Caso B y la resolución runtime no quedaron registrados, por lo que esta cadena es un candidato condicional, no una causa física confirmada.

La matriz de aceptación real histórica cubrió Cliente+Negocio en navegador Chrome y sí incluyó reload Cliente; no cubrió el par Cliente+Repartidor, Android real ni los dos roles entrando por Google OAuth. Además, la prueba de integración original de login sólo ejecuta logins de Cliente y Negocio. La clasificación es `HISTORICAL_FIX_INCOMPLETE`: el trabajo histórico no certificó la combinación/plataforma actual y dejó una ruta Google fuera del aislamiento de cookie. Esto no significa que el callback haya sido demostrado como disparador de esta reproducción.

```text
P2_T34_R2_HISTORY_AUDIT_GATE=PASS
CASE_A=PASS
CASE_B=FAIL
HISTORICAL_ANDROID_FAIL_REPRODUCED=SI
ORIGINAL_BUG_FOUND=SI
ORIGINAL_FIX_FOUND=SI
ORIGINAL_FIX_COMMIT=c047e9eb67e97ca1b9c1ae78b4c2725f44b02ebb; a1579f11e79a41b90c6df4d2e8573ca9a669b856; fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f
ORIGINAL_SESSION_ISOLATION_FIX_COMMIT=c047e9eb67e97ca1b9c1ae78b4c2725f44b02ebb
ORIGINAL_SESSION_ISOLATION_FIX_COMMITS=c047e9eb67e97ca1b9c1ae78b4c2725f44b02ebb,a1579f11e79a41b90c6df4d2e8573ca9a669b856,fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f
ORIGINAL_FIX_SCOPE=PASSWORD_LOGIN_FAMILY_COOKIES_PROXY_SELECTOR_ZUSTAND_NAMESPACE; final AUTH01/AUTH02 browser certification was Cliente+Negocio, not Android Cliente+Repartidor
ORIGINAL_FIX_TASK=P2-T18-BLOCKER-AUTH2 (phases 1/2); closeout/certification P2-T18-BLOCKER-AUTH2-R13-R7
ORIGINAL_FIX_FINDING=F-P2-T18-AUTH01 (AUTH02 was a related shared-endpoint finding)
REGRESSION_STATUS=HISTORICAL_FIX_INCOMPLETE
REGRESSION_INTRODUCED_BY_COMMIT=NONE
ROOT_CAUSE_CONFIRMED=NO
ROOT_CAUSE_LAYER=UNCONFIRMED; conditional code path identified at Google OAuth legacy-cookie write/fallback
PROPOSED_FIX=No behavior fix until login path is confirmed; conditionally migrate Cliente/Repartidor Google OAuth to their family cookie and preserve proxy request rewrite
PROPOSED_FILESET=NONE_CONFIRMED; conditional candidate src/app/api/auth/google/callback/route.ts plus focused tests
PROPOSED_TESTS=Actual Cliente+Repartidor concurrent-login/reload browser test; OAuth cookie-family integration; proxy /auth/me selector; both Zustand namespaces; WrongRoleNotice absent; Repartidor remains authenticated
CODE_MODIFIED=NO
TESTS_MODIFIED=NO
DB_TOUCHED=NO
RAILWAY_TOUCHED=NO
PRODUCTION_TOUCHED=NO
NEXT_ACTION=RETURN_TO_OPERATOR_FOR_SAFE_INSTRUMENTATION_AUTHORIZATION
```

## Adenda R4 — recertificación/cierre posterior

La confirmación posterior de Google OAuth y el fix R3 quedan preservados arriba. El operador completó Android A/B post-fix en Chrome normal y el mismo perfil: ambos roles Google autenticaron, Cliente permaneció Cliente después del reload sin aviso de rol incorrecto, y Repartidor siguió autenticado. Este replay satisface los ocho elementos de coexistencia descritos en §10; la ruta Cliente y la del Repartidor quedaron observadas en `/cliente/` y `/repartidor`. R3 había pedido recertificar A/B primero; ningún reporte autoritativo requiere C–H para el cierre. Esos casos siguen sin ejecutar.

```text
R2_HISTORICAL_CASE_B=FAIL
R2_ROOT_CAUSE_CONFIRMED_LATER=SI
CASE_A_POST_FIX=PASS
CASE_B_POST_FIX=PASS
CLIENT_RELOAD_AFTER_DRIVER_GOOGLE_LOGIN=PASS
DRIVER_REMAINED_AUTHENTICATED=SI
P2_T34_STATUS=CLOSED_TESTING_CERTIFIED
PRODUCTION_TOUCHED=NO
```

Detalle: [P2_T34_R4_PHYSICAL_RECERTIFICATION_CLOSEOUT.md](P2_T34_R4_PHYSICAL_RECERTIFICATION_CLOSEOUT.md).

## Addendum R3 — physical trigger confirmed; OAuth family-cookie fix deployed

The operator subsequently confirmed both Case B sign-ins used Google OAuth.
This upgrades the previously conditional callback/fallback chain to the
confirmed cause for that reproduction; it does not change the historical
audit's conclusion that no later commit reverted the original family-cookie
implementation:

```text
CASE_B_LOGIN_METHOD=GOOGLE_OAUTH_BOTH
ROOT_CAUSE_CONFIRMED=SI
ROOT_CAUSE_LAYER=GOOGLE_OAUTH_LEGACY_SESSION_COOKIE
REGRESSION_STATUS=HISTORICAL_FIX_INCOMPLETE
REGRESSION_INTRODUCED_BY_COMMIT=NONE
```

R3 migrated successful Cliente/Repartidor Google callback sessions and the
legal-consent completion path to their family cookies. It keeps the proxy's
legacy fallback (only as compatibility behavior), password-login behavior,
server-side selector precedence and T40 signed Push handoff; prior-owner
handoff is now same-family so a concurrent actor's binding is not displaced.
Focused tests exercise both OAuth callback responses, coexistence through the
proxy and `/api/auth/me`, the Client store bootstrap, logout family isolation,
password Repartidor cookies and same-/cross-family T40 owner handling.

Commit `38ac6d398fb1bdead11913a347c81162eb260666` is deployed `SUCCESS` to
TESTING. This is technical closeout only: the physical Android Cases A and B
must be repeated by the operator; Cases C–H remain unrun. See
[P2_T34_R3_GOOGLE_OAUTH_FAMILY_SESSION_FIX.md](P2_T34_R3_GOOGLE_OAUTH_FAMILY_SESSION_FIX.md).

```text
P2_T34_R3_TECHNICAL_GATE=PASS
TESTING_DEPLOY=SUCCESS
PHYSICAL_RECERTIFICATION_REQUIRED=SI
NEXT_ACTION=RETURN_TO_OPERATOR_FOR_CASE_A_B_GOOGLE_OAUTH_RECERTIFICATION
```

## 1. Baseline and evidence boundary

The physical report records the operator’s Android/Chrome/TESTING results: Case A Cliente login PASS; Case B Repartidor login in a second tab of the same Chrome profile, then reload Cliente, FAIL with the DeliGO Delivery/Repartidor notice. Both accounts were reported still authenticated; no logout, profile switch or incognito; C–H were not run. The URL changed from `/cliente/` to `/cliente`. The physical record does not say whether either login used Google OAuth or email/password, and does not capture the `/api/auth/me` result, browser storage, or actual cookies.

Baseline is exactly `82ee16a27e71cd4d438c81f7953a4956a563389d`. The earlier family-isolation series and T02-B1 commit are ancestors of this baseline. Read-only `git branch --contains` confirms `c047e9e`, `a1579f1`, and `fe0e11d` are present in `origin/testing-codex` and `origin/main`; T02-B1 `489528c` is present in `origin/testing-codex`. No branch was altered and no historical checkout was made.

## 2. Original bug and original fix

### Original bug

The Aug. 28 P2-T18-BLOCKER-AUTH1 audit recovered an earlier real-browser observation: Cliente and Negocio could each log in independently, but the second login replaced the one browser cookie `deligo_session`; the first DB session row remained valid but its token was no longer presented by that cookie jar. The old `useAuthStore` also used one flat `deligo-auth` key and cross-tab state did not represent multi-actor login. The AUTH1 audit explicitly classified this as a new same-browser distinct-actor capability, not a regression of a previously working multi-actor feature. Existing DB “multiple session rows for one actor” atomicity was a different issue.

### Fix series and scope

| Commit (date) | Task/context | Relevant change |
|---|---|---|
| `c047e9eb67e97ca1b9c1ae78b4c2725f44b02ebb` (2026-08-28) | P2-T18-BLOCKER-AUTH2-R2, family-cookie/server foundation | Added `deligo_session_cliente`, `deligo_session_negocio`, `deligo_session_repartidor`; password login writes the selected family cookie; logout clears the resolved family; `src/proxy.ts` selects by protected API path or allowlisted `actorFamily`, then rewrites only the downstream request cookie to the legacy name. |
| `a1579f11e79a41b90c6df4d2e8573ca9a669b856` (2026-08-28) | P2-T18-BLOCKER-AUTH2 Phase 2, enable coexistence | Namespaced persisted client state by the current tab pathname (`deligo-auth:<family>`); `use-auth` attaches `?actorFamily=` to `/api/auth/me` and logout; cross-tab storage listener filters by family. This is when browser clients began selecting their own family for shared endpoints. |
| `fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f` (2026-08-29) | P2-T18-BLOCKER-AUTH2-R13-R2; final P2-T18 AUTH01/AUTH02 fix | Extended actor-family selection to shared Chat/Push endpoints that otherwise failed closed with multiple family cookies. It did not change `/api/auth/me` or the cookie-family map. |

The first two commits form the cookie + client-state fix. `fe0e11d0` closed the adjacent shared-endpoint gap and is the commit recorded as resolving both findings after R13-R7 acceptance. No later commit reverted those core family semantics.

```text
BEFORE_BEHAVIOR=All generic password logins wrote deligo_session; later login replaced the previous actor's browser cookie. /api/auth/me was actor-neutral. Persisted browser state used deligo-auth.
AFTER_BEHAVIOR=Password logins write per-family cookies; proxy selects by path or actorFamily and request-rewrites the token for existing handlers; client sync sends actorFamily; Zustand persistence is namespaced per tab family.
FILES_CHANGED=c047e9e: src/app/api/auth/login/route.ts, src/app/api/auth/logout/route.ts, src/lib/auth.ts, src/proxy.ts, integration/static tests. a1579f1: src/hooks/use-auth.ts, src/store/auth-store.ts, src/providers/realtime-provider.tsx and focused tests/callers. fe0e11d: src/proxy.ts and Chat/Push components/hooks/tests.
TESTS_ADDED=actor-family-session-coexistence.integration.test.ts; proxy.test.ts family resolver cases; auth-store.test.ts; use-auth-static-contract.test.ts; realtime-provider-cross-tab-static-contract.test.ts; later proxy/Chat/Push selectors tests.
PHYSICAL_TESTS_DONE=P2-T18-BLOCKER-AUTH2-R13-R7: 18/18 real-browser cases from zero against deployed fe0e11d0, Chrome browser profile, Cliente+Negocio.
WHAT_WAS_ACTUALLY_CERTIFIED=Cliente+Negocio cookies/storage coexist, selectors, reloads, logout independence, cross-tab same-family logout, and covered Chat/Push endpoints; not Android, not Cliente+Repartidor, not a Google OAuth family-cookie flow.
```

R13-R7’s cases 01–18 use real browser/network/storage evidence and do include reload of both roles. The roles in the report are explicitly Cliente and Negocio (tabs TAB_C1/TAB_N1). It is not valid to promote its 18/18 result to Android or Repartidor certification.

## 3. T02-B1 — Repartidor PWA post-login routing

```text
T02_B1_COMMIT=489528ca4ba315cd0873e4b270fcdf0b4e3094cd (2026-09-10)
T02_B1_FILES=src/app/repartidor/page.tsx; src/lib/repartidor-post-login-navigation.ts (new); src/lib/repartidor-post-login-navigation.test.ts (new)
T02_B1_BEFORE=Successful Repartidor password login did router.replace("/"); root page redirected unconditionally to /cliente/.
T02_B1_AFTER=Successful password login replaces with /repartidor/ via REPARTIDOR_POST_LOGIN_PATH.
T02_B1_PHYSICAL_SCOPE=Android standalone Repartidor post-login navigation; not two-tab actor coexistence/reload certification.
```

The commit changed navigation only. It did not touch login cookies, `/api/auth/me`, `auth-store`, `use-auth`, logout, or `src/proxy.ts`. It does not explain Case B’s post-reload Client role warning and is not a cause of the session-isolation symptom. Its implementation test checks the route constant and static page call, not session coexistence.

## 4. Comparison of original fix and current baseline (A–P)

| Surface | Historical change | Current `82ee16a` / later history | Relevance to Case B |
|---|---|---|---|
| A. Cookie writes | Password login began writing one family cookie in `c047e9e`. | `setCookie(response, token, family)` still writes the family cookie. T40 wraps it with Push handoff; the family write itself remains. Google OAuth callback still writes `SESSION_COOKIE_NAME` (`deligo_session`). | No later regression found. OAuth path is an incomplete route through the family design; whether Case B used it is unknown. |
| B. Cookie reads | Proxy resolves family cookie and request-rewrites legacy name. | Same family-first behavior; `/api/auth/me` uses selector; no later change making it select Repartidor arbitrarily. | Static code with an extant Cliente cookie selects Cliente. Runtime cookie set not captured. |
| C. Legacy fallback | Kept for compatibility when family cookie is absent. | Still present. OAuth callback remains an active legacy writer; fallback is not merely a dead migration branch. | Concrete conditional path to the observed role mismatch. |
| D. `actorFamily` | Server allowlist included `/api/auth/me`; client selector was added in `a1579f1`. | `/api/auth/me?actorFamily=cliente` remains supported; later `fe0e11d` adds unrelated shared Chat/Push endpoints. | No later selector regression identified. |
| E. `/api/auth/me` | Handler reads the proxy-rewritten legacy request cookie and returns that session’s actual user type. | Route handler’s actor-neutral design remains; proxy + selector make token selection family-aware when the family cookie exists. `use-auth` writes the returned type into the pathname-derived store. | A legacy fallback to Driver would be trusted and could write Repartidor into the Client namespace. Exact response unknown. |
| F. Zustand persistence | `a1579f1` introduced dynamic `deligo-auth:<family>` storage. | `/cliente` and `/cliente/` both map to Cliente; Repartidor maps separately. No later change to the store in the baseline history. | Separate keys prevent a Driver-tab write from directly replacing Client key; a Client-tab `/me` response of Repartidor would still write Repartidor to Client key. |
| G. Hydration | Family namespace introduced with rehydrate tests for Client/Business. | `useHydrated()` is a React server/client hydration gate; it does not establish from history alone the runtime order of persistence rehydration vs `/me` in this failed sequence. | No post-fix hydration change shown to cause this case; ordering remains unobserved. |
| H. Logout | AUTH2 made logout family-aware and proxy clears resolved family/legacy alias. | Current hook captures `userType()` before local logout then sends selector. Case B did not logout. | Not causal to this sequence. |
| I. Proxy | Family mapping/path/query selector introduced in `c047e9e`. | Later changes add Chat/Push selectors (`fe0e11d`), `cuenta_operativa` (`e10eb5a`) and SuperAdmin Push handling (`1661d87`); Cliente/Negocio/Repartidor resolution preserved. | No regression in role-family resolver identified. Legacy fallback remains by design. |
| J. Cliente/Repartidor layouts | Role-PWA boundaries predate AUTH2. | No post-fix layout change found that redirects the Client reload to Repartidor. | Not a demonstrated route/layout cause. |
| K. Route guards | `cd45cc9` added role-specific PWA boundaries before the family fix. | Client page still guards against a non-Cliente `authUser`. | Guard reacts to bad actor state; it does not select the server session. |
| L. Wrong-role behavior | `WrongRoleNotice` and `authUser.type !== "cliente"` were introduced in `cd45cc9` (2026-08-15), before AUTH2. | Same condition remains unchanged since then. | Notice is not a new post-fix regression; it exposes a role mismatch rather than creating one. |
| M. Cross-tab | `a1579f1` scopes the storage listener to the active family; only a same-family null user propagates logout. | Repartidor non-null state uses its own key and does not directly change Client memory/key. | Does not explain notice by itself; later Client-tab bootstrap can still receive the wrong `/me` type if legacy fallback is used. |
| N. Realtime provider | Actor-bound realtime and shared provider predate/overlap T18; storage family filter landed in `a1579f1`. | No later change to auth state or family key. | Not causal based on available code. The R23C fix was in ChatProvider/chat-store, not auth session selection. |
| O. Push handoff | Not part of original session fix. | P2-T40 adds signed, separate `deligo_push_handoff`; lookup is limited to the same family slot on password login. Google callback adds Push handoff but still writes global session cookie. | Push owner handoff does not choose `authUser`; not the cause. OAuth session-cookie behavior remains a separate incomplete path. |
| P. Post-login redirects | Role navigation was separate. | T02-B1 changes successful Repartidor password login from `/` to `/repartidor/`. | No logout/reload or Client state mutation; unrelated to Case B after the driver reached its start page. |

## 5. Post-fix candidate commits

The following commits after the family-store enablement (`a1579f1`) touch the specified auth/session files or the exact page/route paths. The diff—not just filename overlap—was reviewed. None demonstrates a change that makes `/cliente` resolve to Repartidor when the Cliente family cookie is present.

| Commit / date / context | Files and actual delta | Could affect isolation? / conclusion |
|---|---|---|
| `fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f`, 2026-08-29, P2-T18 AUTH02 | `src/proxy.ts` selector allowlist expanded for Chat/Push; Chat/Push consumers and tests. | `NO` for `/api/auth/me`: no family precedence or auth/me selector change. It fixed a distinct fail-closed endpoint gap. |
| `a178140ef5167dce1b596edeb58e17cc7029beaf`, 2026-08-30, business-hours timezone | `src/app/cliente/page.tsx` and catalog/timezone files; displayed hours logic. | `NO`: page file overlap only; wrong-role guard not changed. |
| `18aad860b4947126f438625f18dd1cd0a8e08a9d`, 2026-09-01, stale authorization lifecycle | `src/lib/auth.ts` rejects inactive Repartidor in `getUserFromToken`; callback adds unavailable-account validation. | `NO` for a successful active login showing a Repartidor warning; no cookie family/selector changes. It may make inactive sessions return 401, not change actor family. |
| `cef85d9b2e843db284696dbd57264e4b1b345f57`, 2026-09-01, mesa boundaries | `src/lib/auth.ts` adds operational-account/mesa selection fields. | `NO`: generic Client/Driver token family resolver unchanged. |
| `f43705cb4d057aec3ad547a1510f21de094f4159`, 2026-09-02, Client PWA status bar | `src/app/cliente/page.tsx`, styles/headers and PWA identity tests. | `NO`: UI-safe-area/layout changes, not auth guard/store/bootstrap. |
| `489528ca4ba315cd0873e4b270fcdf0b4e3094cd`, 2026-09-10, P2-T02-B1 | Repartidor page uses `/repartidor/` after password login; route helper/test added. | `NO`: navigation only; no cookie, auth, proxy, store or `use-auth` changes. |
| `e10eb5a7740849c64c14ccc97cddf5ee2d5620c5`, 2026-09-16, P2-T44 operational Push | `src/proxy.ts` adds `cuenta_operativa` mapping/selector recognition and tests. | `NO`: additive independent actor; original three family paths/precedence remain. |
| `1fc6edc5ca661050271a3c5a3ba64fda606cf919`, 2026-09-20, P2-T40-R1 | Login route extracts `applyLoginCookies`, writes the same family cookie, adds signed Push handoff; Google callback adds handoff; proxy adds reconcile endpoint selector. | `MAYBE` by route overlap, but diff preserves family `setCookie` for password flow and does not change the Google callback’s existing global `deligo_session` write. It introduces no demonstrated auth actor switch. |
| `2e0ee2b97a4cf1fcf5684f5cde7ef4118616b3c2`, 2026-09-21, P2-T40-R2 | Push handoff TTL/telemetry and tests. | `NO`: only Push handoff TTL/fingerprinted diagnostics; no session-cookie family write or selection change. |
| `1661d87b10db4c35e3fafc35c2e6186198d14a83`, 2026-09-21, P2-T39-R3B | `src/proxy.ts` SuperAdmin Push auth and tests. | `NO`: additive separate SuperAdmin cookie path; no Client/Driver resolver change. |

Other OAuth legal-consent commits (`8ca4a413`, `cf1a2a90`) alter consent/verification flow, not the generic session-cookie name assignment. The R23C chat deep-link fix (`1bd953a6bc97fe5dffa993d1653ee55212f012d4`) modifies only `src/providers/chat-provider.tsx` and its test; it is not an auth-store, cookie, proxy or role-selection change.

The only post-fix behavior that remains a concrete isolation concern is not newly introduced by these commits: the Google callback’s legacy cookie write was outside the c047/a157 fix fileset and remains in the baseline. `1fc6edc` later added Push handoff logic around the callback but did not change that session-cookie write.

## 6. Blame and origin of current flow

`git blame origin/testing-codex` on the baseline attributes the relevant blocks as follows:

| Current block | Introducing commit | Evidence/meaning |
|---|---|---|
| `src/lib/auth.ts` family mapping (`cliente`, `negocio`, `repartidor`) and helper | `c047e9e` | Cookie-name map is part of the server cookie foundation. |
| Password `setCookie(response, token, family)` | `c047e9e` | Writes selected family name; cookie attributes date to initial auth implementation. |
| `applyLoginCookies` wrapper | `1fc6edc` | New T40 helper; its first operation remains `setCookie(response, token, family)`. |
| `src/proxy.ts` family cookie map, path/query selection, legacy fallback | `c047e9e` | Includes explicit fallback only if family cookie is missing; original priority still current. |
| `src/store/auth-store.ts` path family and dynamic namespaced storage | `a1579f1` | `/cliente` and `/cliente/` both match Cliente; `/repartidor` maps separately. |
| `src/hooks/use-auth.ts` fetch family selector | `a1579f1` | Derives family from current pathname before fetch; returned server user is applied with a type-specific `loginX()` action. The switch was older; the selector/write integration is AUTH2 Phase 2. |
| Client logout family capture before clearing store | `a1579f1` | Captures `userType()` before `logout()`, then sends actor selector. |
| Client warning guard and `WrongRoleNotice` | `cd45cc9` (2026-08-15) | Predates original session coexistence implementation; guard detects non-Cliente actor. |
| `/api/auth/me` handler | no post-AUTH2 handler rewrite; legacy route retained | It consumes proxy-rewritten `deligo_session` and returns resolved user. |
| Google callback legacy session cookie write | initial callback lineage (`0e96d4d`/`a195d44`), preserved by T18 | Callback has not been migrated to `getFamilySessionCookieName(role)`; current T40 changes are Push handoff only. |

### Google/legacy conditional causal chain

1. `src/app/api/auth/google/callback/route.ts` determines Cliente/Repartidor OAuth role, creates that session and still writes `SESSION_COOKIE_NAME` (`deligo_session`), a shared name.
2. For `/api/auth/me?actorFamily=cliente`, `src/proxy.ts` first looks for `deligo_session_cliente`; only if missing does it use the legacy `deligo_session` fallback.
3. If the fallback contains the Repartidor token, `/api/auth/me` returns a Repartidor `user` because the handler returns the role stored on that session.
4. `src/hooks/use-auth.ts` accepts that returned role and calls `loginRepartidor`. The persisted key is dynamically resolved from the current `/cliente` pathname, so that write lands in `deligo-auth:cliente`.
5. `src/app/cliente/page.tsx` renders `WrongRoleNotice` for this `authUser.type`.

This is a fully plausible code path that produces the reported notice without a later regression commit. Its runtime preconditions (login method/cookie state and actual `/me` response) are not in the operator’s record, so it must not be reported as the proven physical root cause.

## 7. Legacy alias lifecycle

```text
LEGACY_ALIAS_BEFORE_FIX=deligo_session was the primary session cookie for Cliente, Negocio and Repartidor; second login overwrote the first browser token.
LEGACY_ALIAS_AFTER_FIX=Password login stopped writing it and used family cookies, but proxy retained legacy fallback and request-side rewrite. Google OAuth callback was not migrated and still wrote deligo_session.
LEGACY_ALIAS_CURRENT=Same: family cookie wins when present; deligo_session is fallback when selected family cookie is absent; OAuth callback remains an active writer. Proxy also rewrites the selected request token under the legacy name for unchanged downstream handlers.
```

Therefore the original fix did **not** eliminate all product dependence on `deligo_session`. It made the alias an internal downstream adapter/fallback for the new password-login path but left Google OAuth session creation on the global alias. No later commit reintroduced the password login alias; the Google callback write was preserved rather than reintroduced.

## 8. `/api/auth/me`, auth hook, hydration, store and warning history

- The `/api/auth/me` route remained a token-to-user handler: it reads the proxy-rewritten legacy cookie and returns that session’s real user type. Family awareness lives in `src/proxy.ts`, not in a role-check inside the route.
- Proxy family selection for `/api/auth/me` was added by `c047e9e`; `use-auth` began sending the query selector in `a1579f1`. There is no later removal of this selector.
- The current hook computes family from `window.location.pathname`, requests `/api/auth/me?actorFamily=cliente` on either `/cliente` or `/cliente/`, and on a successful response calls the matching login action. A 401 clears a persisted user. A network failure preserves the current persisted user.
- `deligo-auth:cliente` and `deligo-auth:repartidor` derive from one shared storage adapter added in `a1579f1`; this is per-origin localStorage but per-tab key. A Repartidor login in its `/repartidor` tab should not directly write the Client key. The different outcome can still arise if the Client tab’s own `/me` fetch resolves to Repartidor and writes its local namespace.
- `useHydrated()` only chooses client vs server render snapshot; the physical sequence did not capture the exact timing of Zustand persistence, fetch start/finish and notice render. No Git diff after AUTH2 establishes a timing regression.
- `WrongRoleNotice` was introduced with strict PWA role boundaries in `cd45cc9`, before the cookie/store fix. Its role label is derived from the `currentType`; the warning is an exposure/guard for a mismatch, not the source of actor selection.

## 9. Historical vs current reproduction

| Scenario | Historical P2-T18 R13-R7 | Current P2-T34 Case A/B |
|---|---|---|
| Cliente login | PASS, real browser | PASS, Android Chrome normal, `/cliente/` |
| Repartidor login | Not in R13-R7 matrix | PASS login in second tab; exact auth method unreported |
| Same Chrome profile/origin | Yes, two real browser tabs | Yes, same Android Chrome profile, two tabs |
| Second role actor | Negocio | Repartidor |
| Reload Cliente | PASS (`CASE_06`) | FAIL after returning from Repartidor; route `/cliente` |
| Reload second actor | Negocio reload PASS (`CASE_07`) | Not reported as separate reload; driver remained authenticated |
| Standalone PWA | Not certified in R13-R7 | Not used in Case A/B |
| Logout independence | Cliente/Negocio PASS in R13 cases 10/11; same-family cross-tab cases 12/13 | No logout in Case B |
| Same Google identity | Not part of R13-R7 matrix/evidence | R2 supplied facts do not say which Google identity or whether OAuth was used |
| Different Google identities | Not part of R13-R7 matrix/evidence | Not reported in this exact Case B |
| WrongRoleNotice absence | No explicit asserted case in R13-R7 | Notice appears after Client reload |

Separate older physical finding history (`F-P2-T31-R23B-01`) reports Android concurrency failing for same and different Google identities and an iPhone same-identity control passing; those findings did not identify auth method/runtime cookie resolution. Do not substitute that broad finding for the exact R1 Case B observation.

## 10. Historical test coverage and exact gap

| Test | Added/changed with | What it covers | What it does not cover for Case B |
|---|---|---|---|
| `src/lib/actor-family-session-coexistence.integration.test.ts` | `c047e9e` | Real handler/database integration for family-cookie login and actor-scoped logout. Login-created fixtures are Cliente and Negocio; assertions explicitly ensure new Cliente does not emit Repartidor cookie. | Does not execute a Repartidor login; no OAuth callback, two-browser-tab UI, `/me` reload bootstrap or notice assertion. Not run during this audit (DB writes are out of scope). |
| `src/proxy.test.ts` | `c047e9e`, expanded `fe0e11d` and later proxy commits | Pure resolver requests; family/path and selector selection; family cookies; fallback/fail-closed cases; later role-family Push regressions. | Not actual browser cookie jar, OAuth callback, React store or page guard. No complete Client+Repartidor reload case. |
| `src/store/auth-store.test.ts` | `a1579f1` | Active family recognizes `/repartidor`; persisted write/rehydrate isolation tests exercise Client and Negocio. | No Client+Repartidor persisted pair/reload or UI-level wrong-role test. |
| `src/hooks/use-auth-static-contract.test.ts` | `a1579f1` | Textual/source contract: derive actorFamily before `/me` fetch; logout captures family before store clear. | Not a response/cookie/store integration; no returned Repartidor-on-Client case. |
| `src/providers/realtime-provider-cross-tab-static-contract.test.ts` | `a1579f1` | Cross-tab event key is family-specific and null-only logout propagation. | Not two live React page instances with fresh login and reload. |
| `src/app/api/auth/login/apply-login-cookies.test.ts` | `1fc6edc` | T40 Push previous-owner/handoff outcomes around same family cookie slot. | Not proof of cross-family coexistence or Google callback family cookie behavior. |
| `src/lib/repartidor-post-login-navigation.test.ts` | `489528c` | T02-B1 route path and password-login static navigation contract. | Not cookie/store/session isolation. |

```text
HISTORICAL_TEST_COVERAGE=Strong for Cliente+Negocio family cookie selection, namespaced state, reload and R13 browser cases; only partial unit/static coverage for Repartidor; no OAuth family-cookie test.
CURRENT_TEST_COVERAGE=Proxy and generic activeSessionFamily include Repartidor; no integrated Cliente+Repartidor authentication + same-profile reload + auth.me response + persisted user + WrongRoleNotice absence + surviving Driver session test.
```

The case required by the future correction is mandatory even if those older tests pass: (1) Cliente authenticated, (2) Repartidor authenticated in another same-origin tab, (3) both sessions/cookies coexist, (4) reload/bootstrap Cliente, (5) `/me` resolves Cliente, (6) Client `authUser.type` never becomes Repartidor, (7) `WrongRoleNotice` never renders, (8) Repartidor remains authenticated. Exercise the relevant supported login methods, including Google OAuth if still offered.

## 11. Finding evolution

- `F-P2-T18-AUTH01` started as a new same-browser multi-actor cookie collision finding after the T18 audit; its historical state was `OPEN_DESIGN_FREEZE`, then implementation and acceptance. R13-R7 records it `RESOLVED` on `fe0e11d0` after its 18/18 Cliente+Negocio browser matrix. That resolution is scoped to its recorded acceptance evidence; it is not Android/Repartidor physical certification.
- `F-P2-T31-R23B-01` is a separate Android Cliente/Repartidor concurrency finding. R23C corrected the initial “same Google identity only” interpretation: Android failed for same and different Google identities; iPhone same-identity control passed. Root cause remained `NOT_AUDITED`; formal task P2-T34 was assigned later.
- Naming collision warning: the separate P2-T31 R23B chat/push deep-link root-cause report and its R23C chat-state fix concern `useChatActorReset`; they are not the session finding `F-P2-T31-R23B-01`. The history/docs preserve this distinction. R23C did not alter session cookies or auth store.
- The local ROADMAP/FINDINGS and T34 preflight consistently treat T34 as an open, separate Android finding; no documentation update was made to those authority files in this task.

## 12. Determination and fix proposal

```text
ORIGINAL_FIX_SOLVED=The shared password-login cookie overwrite for the tested Cliente/Negocio pair; family cookies, proxy selection and client persistence were introduced and the pair passed R13-R7 real-browser reload/logout cases.
ORIGINAL_FIX_DID_NOT_SOLVE=It did not migrate Google OAuth session-cookie writes from deligo_session; it also did not certify Android Cliente+Repartidor or integrate actual Repartidor login, Client reload and notice absence in one test.
CURRENT_CASE_GAP=Current Case B is an Android Cliente+Repartidor same-profile reload; prior physical matrix was Chrome Cliente+Negocio. The supported Google OAuth callback is a shared legacy-cookie writer outside the original fix fileset.
WHY_CASE_B_STILL_FAILS=The observed UI had a non-Cliente authUser after reload. If the Client tab lacked deligo_session_cliente and the last Google callback wrote a Repartidor token to deligo_session, the existing legacy fallback and hook/store chain deterministically produces that state. Case B does not report login method or capture runtime resolution, so this is a concrete conditional explanation, not a proven cause for this run.
WHY_PREVIOUS_FIX_DID_NOT_PREVENT_IT=AUTH2 family migration covered password login and namespaced client persistence; Google OAuth callback remained on the shared alias, and historical tests/physical acceptance used Cliente+Negocio rather than actual Cliente+Repartidor on Android.
REGRESSION_FOUND=NO (no later commit shown to revert family-cookie, actorFamily, storage namespace, logout, guard, or cross-tab isolation).
HISTORICAL_FIX_INCOMPLETE_FOR_CURRENT_CASE=YES
```

**Minimal proposed behavior direction (not implemented):** first determine whether the failed login used Google OAuth and whether the Client family cookie was absent. If confirmed, make the Cliente/Repartidor OAuth callback write the role-specific session cookie via the existing family-cookie helper while preserving the proxy’s request-side legacy rewrite for unchanged handlers; add direct OAuth cookie tests. Do not remove legacy fallback globally or redesign auth without a separate compatibility/security review. If the physical login was password-based, do not apply that OAuth-only fix as an assumed solution; authorize short-lived, redacted TESTING instrumentation to isolate proxy resolution, `/me` type and store writer first.

```text
PROPOSED_FIX=Conditional: migrate the Google OAuth callback for Cliente/Repartidor to the existing family-cookie architecture; otherwise no fix until runtime cause is isolated.
PROPOSED_FILESET=No confirmed production fileset. Conditional implementation candidate: src/app/api/auth/google/callback/route.ts plus focused OAuth/integration tests; do not touch proxy family precedence, cookie fallback or T40 handoff without evidence.
PROPOSED_TESTS=1) OAuth callback writes only role cookie for Cliente/Repartidor; 2) proxy /api/auth/me?actorFamily=cliente picks Client despite coexisting Driver/legacy candidates; 3) persistence reload namespaces Client and Driver; 4) mandatory browser-level eight-step Cliente+Repartidor scenario above and no WrongRoleNotice; 5) Driver session remains valid after Client reload.
NEXT_ACTION=RETURN_TO_OPERATOR_FOR_SAFE_INSTRUMENTATION_AUTHORIZATION
```

No new operator DevTools/USB/cookie/storage/Network request is made. If authorized later, the automatic next step should use temporary diagnostics in TESTING only, with an allowlisted event sequence and no token, cookie value, actor ID, email or other PII in logs; capture only login mechanism/role, selected family-vs-legacy source, `/me` returned `user.type`, active pathname and store key/type. Do not implement that instrumentation in this audit.

## 13. Read-only operations and limits

Read-only commands used included `git log`, `git log -S/-G`, `git show`, `git diff`, `git blame`, `git branch --contains`, `git merge-base`, `git ls-tree`, and source/report searches. No branch was modified; no historical checkout; no source/test changes; no integration test was run because it writes DB fixtures. No database, Railway variables/logs, deployments, Production, manifests, Service Worker, Push configuration, or physical operator test was touched. Only this report and the two T34 reports received a short R2 reference addendum; no master handoff, roadmap, findings, or completed-task file was changed.

```text
CODE_MODIFIED=NO
TESTS_MODIFIED=NO
DB_TOUCHED=NO
RAILWAY_TOUCHED=NO
PRODUCTION_TOUCHED=NO
```

## Consola final

```text
RESULT=HISTORICAL_FIX_INCOMPLETE
ORIGINAL_BUG=YES — shared global session cookie caused second-login overwrite for the historically tested Cliente/Negocio pair.
ORIGINAL_FIX=YES — family cookies + proxy actor-family resolution + namespaced client persistence; Google OAuth callback remains a legacy-cookie gap.
ORIGINAL_FIX_COMMIT=c047e9eb67e97ca1b9c1ae78b4c2725f44b02ebb; a1579f11e79a41b90c6df4d2e8573ca9a669b856; final acceptance/hardening fe0e11d0f6cf94db8a28ca98595fcbe3ea59623f
ORIGINAL_FIX_SCOPE=Password-login family isolation and real-browser Cliente+Negocio reload/logout acceptance; not Android Cliente+Repartidor nor Google OAuth family-cookie acceptance.
HISTORICAL_TEST_COVERAGE=18/18 real-browser Cliente+Negocio; unit/static/integration subsets; no actual Repartidor login integration, no Google OAuth family cookie, no Android pair.
LATER_RELEVANT_COMMITS=fe0e11d, a178140, 18aad86, cef85d9, f43705c, 489528c (T02-B1), e10eb5a, 1fc6edc (T40-R1), 2e0ee2b (T40-R2), 1661d87; reviewed diffs show no family-isolation reversion.
REGRESSION_STATUS=HISTORICAL_FIX_INCOMPLETE
REGRESSION_INTRODUCED_BY_COMMIT=NONE
ROOT_CAUSE_CONFIRMED=NO
ROOT_CAUSE_LAYER=UNCONFIRMED; conditional Google OAuth legacy-cookie write/fallback chain
WHY_CURRENT_CASE_FAILS=Physical UI received a non-Cliente authUser after reload. The legacy Google callback/fallback chain can produce it if those login/cookie preconditions held; R1 did not record login method or runtime response.
WHY_PREVIOUS_FIX_DID_NOT_PREVENT_IT=AUTH2 converted password logins and storage but left Google OAuth on deligo_session, and its accepted actor/platform matrix did not include Android Cliente+Repartidor.
CURRENT_TEST_COVERAGE_GAP=No one-test same-profile Cliente+Repartidor login/coexist/reload/bootstrap/notice-absence/Driver-survives scenario.
PROPOSED_FIX=Conditional OAuth callback migration to role-family cookie; otherwise instrument safely first. No implementation authorized/performed.
PROPOSED_FILESET=No confirmed fix fileset; conditional src/app/api/auth/google/callback/route.ts plus focused tests.
PROPOSED_TESTS=OAuth cookie-family integration; proxy /api/auth/me selector; Client+Driver persistence; mandatory 8-step browser regression with WrongRoleNotice absent and Driver still authenticated.
REPORT_PATH=C:\Leo Campos\Trabajo\deligo-main-limpio\codex-reports\P2_T34_R2_HISTORICAL_SESSION_ISOLATION_REGRESSION_AUDIT.md
PRODUCTION_TOUCHED=NO
NEXT_ACTION=RETURN_TO_OPERATOR_FOR_SAFE_INSTRUMENTATION_AUTHORIZATION
```
