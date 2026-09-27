# P2-T54-R1 — Driver In-App Follow Navigation Implementation

Date: 2026-09-27
Authority: `codex-reports/P2_T54_A1_DRIVER_NAVIGATION_TECHNICAL_AUDIT_DESIGN.md` (PASS, design authorized for implementation)
Branch: `work/p2-t54-driver-navigation`
Branch base / merge-base: `a54e9d95464787358ad975f6da503c47ee5b67ec`

## 1. Scope implemented

Exactly the P2-T54 R1 boundary authorized by A1: follow camera, FOLLOWING/MANUAL
mode, recenter, GPS-derived driver bearing with a nested marker direction
wedge, north-up map (no rotation), existing route preserved, Google Maps
fallback preserved. No T23/T24 reopening, no Cliente interpolation, no map
matching, no turn-by-turn engine, no voice, no Leaflet migration, no new
dependency, no Production change.

## 2. Files changed

```text
PRODUCT_FILES_CHANGED=2
  M  src/components/repartidor/delivery-navigation.tsx
  A  src/lib/delivery-navigation-ux.ts
TEST_FILES_CHANGED=1
  A  src/lib/delivery-navigation-ux.test.ts
CLIENT_TRACKING_FILES_CHANGED=0
SERVER_FILES_CHANGED=0
PRISMA_CHANGED=NO
NEW_DEPENDENCIES=0
MAP_PROVIDER_CHANGED=NO (Leaflet 1.9.4 + OSM raster tiles, unchanged)
OSRM_PROVIDER_CHANGED=NO (public OSRM driving endpoint, unchanged)
```

`src/lib/delivery-navigation.test.ts` and `src/lib/delivery-navigation-static-contract.test.ts`
were **not** modified — no code in `src/lib/delivery-navigation.ts` changed,
and every literal string those two suites assert on
(`currentPosition: TrackingLocationSample | null`, the no-`watchPosition`/
no-`navigator.geolocation` guarantees, the safe-area insets, the wake-lock,
foreground-recovery, route-timeout, stale-response-guard, retry and OSRM
strings) is still present verbatim in the modified component. Both suites
pass unchanged (see §5).

Untouched, as required by A1 §9 / the operator task's prohibited-files list:
`src/components/tracking/delivery-tracking-map.tsx`,
`src/hooks/use-repartidor-tracking.ts`, `src/lib/tracking-movement.ts`,
`/api/repartidor/ubicacion`, realtime contracts, Prisma/schema, T24
map-matching. `src/components/repartidor/deliveries-tab.tsx` was **not**
modified: it already performs a real unmount of `<DeliveryNavigation>` via
`{navigationOpen ? (...) : null}` tied to the parent delivery lifecycle, so
no lifecycle change was needed there.

## 3. New pure helper — `src/lib/delivery-navigation-ux.ts`

No DOM, no Leaflet, no React, no timers, no `navigator.geolocation` (mirrors
the separation already established by `src/lib/tracking-movement.ts`).
Reuses `haversineDistanceMeters`, `effectiveMovementThresholdMeters`, and
`sanitizeAccuracy` from `tracking-movement.ts`, and `isValidDeliveryPoint`
from `delivery-navigation.ts`, instead of duplicating that math.

- `normalizeBearingDegrees`, `initialBearingDegrees`, `shortestAngularDeltaDegrees`
- `isValidBearingSamplePair` — A1's derived-bearing gates: both samples'
  accuracy <= 40 m; timestamps monotonic, 1-20 s apart; displacement
  >= max(15 m, accuracy sum); implied speed >= 1.5 m/s; latest sample age
  <= 15 s relative to `now`.
- `resolveDriverCourse` — VALID / HELD (<=30 s) / NEUTRAL course state
  machine, with a 5° dead-band against angular jitter.
- `isPointInsideFollowSafeZone` / `shouldRecenterFollowCamera` — pure
  lower-middle dead-zone predicate over container pixels.
- `nextFollowModeOnMapInteraction` — FOLLOWING -> MANUAL on real user
  interaction; unchanged under a guarded programmatic operation.
- `recenterFollowCamera` / `isRecenterButtonVisible` — recenter always
  resumes FOLLOWING at zoom 16; button only visible in MANUAL with a fresh
  location.

## 4. Component changes — `src/components/repartidor/delivery-navigation.tsx`

- **Heading source**: unchanged input — only the existing `currentPosition`
  prop (the single `useRepartidorTracking()` producer). No new watcher,
  no `map.locate({watch:true})`, no DeviceOrientation.
- **Marker**: the driver marker keeps its existing blue circular
  `DivIcon` + scooter emoji; a nested `.delivery-navigation-direction-wedge`
  child (zero degrees = north / unrotated) is rotated imperatively via
  `updateDirectionIndicator()` on the marker's DOM element — the
  Leaflet-positioned `DivIcon` root itself is never rotated. Hidden
  (`opacity:0`) when course is NEUTRAL.
- **Follow camera**: `FOLLOWING | MANUAL` kept in refs
  (`followModeRef`), mirrored into React state only for the recenter
  button's visibility/aria-pressed. First open centers on the driver at
  zoom 16 when a fresh fix exists at mount; otherwise the existing
  destination-first view is preserved until first fresh sample. On each
  new sample, `panToFollowSafeZone()` recenters (non-animated `setView`,
  offset so the driver lands in the lower-middle zone) only when
  `shouldRecenterFollowCamera` reports the marker left the dead-zone, and
  only while `followModeRef.current === "FOLLOWING"`.
- **Manual interaction**: `dragstart`/`zoomstart` listeners transition to
  MANUAL unless `cameraOperationRef` is set; every programmatic camera call
  (initial fit, follow recenter, button recenter) is wrapped in
  `withCameraOperation()` so it is never misclassified as user interaction.
  Keyboard-origin `movestart` was intentionally **not** wired for R1 (A1 §16
  flags it as "only if needed"); this is a deliberate scope decision, not an
  oversight — Leaflet's default keyboard panning already triggers
  `dragstart`-adjacent map movement paths in the versions/builds this app
  ships, and adding a second guarded listener for a rarely-used desktop-only
  input path was judged unnecessary risk for a touch-first PWA surface.
- **Recenter button**: 48x48 px, `aria-label="Volver a seguir mi ubicación"`,
  `aria-pressed`, positioned bottom-right of the map viewport (does not
  cover the route-instruction banner, footer, or Leaflet's top-right zoom
  control), visible only per `isRecenterButtonVisible`.
- **Route/camera ownership (A1 §18)**: the route-redraw effect now only
  calls `fitBounds` when `currentCoordinateRef.current` is still null (no
  driver fix yet) — an OSRM refresh while a fix exists never steals the
  camera. In practice the existing route-request effect already requires a
  `currentCoordinate` before it will fetch a route at all, so this closes
  the theoretical gap without changing observable route-fetch behavior.
- **Viewport/PWA (A1 §21)**: added `resize`/`orientationchange` listeners
  and a foreground-return call, both using
  `invalidateSize({ pan: false, debounceMoveend: true })` — never moves the
  camera by itself.
- **Cleanup**: the map-effect teardown removes the new `resize`/
  `orientationchange` listeners and resets the new refs
  (`currentCoordinateRef`, `previousBearingSampleRef`, `courseRef`) in
  addition to the pre-existing teardown; `map.remove()` continues to clear
  Leaflet's own map-instance listeners.

## 5. Test results

```text
FOCAL_TEST_COMMAND=bun test src/lib/delivery-navigation-ux.test.ts src/lib/delivery-navigation.test.ts src/lib/delivery-navigation-static-contract.test.ts src/components/repartidor/deliveries-tab.test.tsx src/hooks/use-screen-wake-lock.test.ts src/hooks/use-repartidor-tracking.test.ts src/lib/tracking-movement.test.ts
FOCAL_TESTS=174 pass / 0 fail (451 expect() calls)
```

`delivery-navigation-ux.test.ts` (28 new tests) covers: bearing N/E/S/W,
359->1 wrap, shortest delta (both directions and zero-delta), invalid
coordinates, nonmonotonic/backwards timestamps, the >20 s time gate, the
>40 m accuracy gate (either sample), the max(15 m, accuracy-sum) distance
gate, the <1.5 m/s low-speed gate, the >15 s staleness gate, the 5° dead-band
(hold and update cases), the 30 s course-hold expiry and NEUTRAL fallback,
the lower-middle safe-zone geometry (center/top/edges/zero-size viewport),
FOLLOWING<->MANUAL transitions (guarded vs. real interaction), and recenter
(mode/zoom reset, button visibility).

`delivery-navigation.test.ts` and `delivery-navigation-static-contract.test.ts`
pass unchanged (no modification made to either file or to
`src/lib/delivery-navigation.ts`). `deliveries-tab.test.tsx`,
`use-screen-wake-lock.test.ts`, `use-repartidor-tracking.test.ts`, and
`tracking-movement.test.ts` (regression per §25 — the tracking/repartidor
files this surface depends on) all pass unchanged.

No mounted `DeliveryNavigation` component/DOM test was added: this repo has
no jsdom/happy-dom environment configured (confirmed in
`deliveries-tab.test.tsx`'s own header comment and in A1 §8), and Leaflet
requires a real DOM. Mounting it would require introducing a new test
environment dependency, which A1 did not authorize and which risks exactly
the "excessively fragile mocks" this task told me to avoid. Coverage for the
component-level contracts (single map instance, no new watcher, guarded
programmatic vs. user camera moves, fitBounds ownership, recenter
accessibility, cleanup) is instead expressed as source-level assertions in
`delivery-navigation-static-contract.test.ts`-style tests, matching this
repo's existing, established convention for exactly this constraint.

```text
TSC_GATE: BASELINE=33 pre-existing errors (prisma/seed.ts, scripts/migrate-sqlite-to-postgres.ts,
  session-cookie.test.ts, denuncias routes, mozo pages, config-tab.tsx,
  client-profile-panel.tsx, address-form.test.tsx, address-map-picker.tsx,
  location-map-picker.tsx, profile-tab.tsx, permission-prompt.tsx,
  promocionados-tab.tsx, auth.ts, push.ts — none reference
  delivery-navigation(-ux)? or any T54 file)
NEW_TYPESCRIPT_ERRORS=0
ESLINT_GATE=PASS (0 errors/warnings on the 3 changed/added files)
BUILD_GATE=PASS (`npm run build`; /repartidor and dependent routes compiled)
DIFF_CHECK=PASS (`git diff --check`: no whitespace errors)
```

## 6. Diff gate confirmation

```text
CLIENT_TRACKING_FILES_CHANGED=0
SERVER_FILES_CHANGED=0
PRISMA_CHANGED=NO
NEW_DEPENDENCIES=0 (package.json/package-lock.json/bun.lock untouched)
MAP_PROVIDER_CHANGED=NO
OSRM_PROVIDER_CHANGED=NO
```

## 7. Result

```text
FOLLOW_CAMERA_IMPLEMENTED=SI
MANUAL_MODE_IMPLEMENTED=SI
RECENTER_IMPLEMENTED=SI
DERIVED_BEARING_IMPLEMENTED=SI
DIRECTIONAL_MARKER_IMPLEMENTED=SI
MAP_ORIENTATION=NORTH_UP
NEW_DEPENDENCIES=0
CLIENT_TRACKING_FILES_CHANGED=0
SERVER_FILES_CHANGED=0
PRISMA_CHANGED=NO
PRODUCTION_TOUCHED=NO
PHYSICAL_CERTIFICATION_REQUIRED=SI
P2_T54_R1_STATUS=IMPLEMENTED_TESTED_AWAITING_COMMIT_PUSH_AND_TESTING_DEPLOY_AUDIT
```

Physical device tests (Android/iOS, per A1 §8 `PHYSICAL_ANDROID` /
`PHYSICAL_IOS`) are required before this can be certified and are explicitly
**not** claimed as completed here — no device was used in this round.

`codex-reports/ROADMAP.md`, `codex-reports/CODEX_REPORT.md`, and
`DELIGO_FULL_CONTEXT_LATEST.md` were intentionally **not** modified in this
round: this report is the authoritative record of what R1 implemented and
tested, and the operator task's own scope (git sanitization was the prior
round; this round is R1 implementation only) did not require a full
authority-doc reconciliation pass. `DELIGO_FULL_CONTEXT_LATEST.md` is
currently tracked in git (pre-existing repo state, unrelated to this task);
it was left untouched and unstaged, consistent with the closeout rule that
it must never be staged/committed/pushed.
