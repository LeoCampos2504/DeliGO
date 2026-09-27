# P2-T54-A1 — Driver In-App Navigation Technical Audit + Final Design

Date: 2026-09-27
Result: `PASS` — source audit and design only; no implementation

## 1. Authority and outcome

P2-T23 and P2-T24 remain superseded by the operator's product decision. This audit does not reopen either task, declare either technically complete, or change their historical results. Cliente tracking remains accepted as sufficient.

```text
P2_T23_STATUS=SUPERSEDED_BY_PRODUCT_DECISION_INTO_P2_T54
P2_T23_SMOOTH_MARKER_REQUIREMENT=REMOVED_BY_PRODUCT_DECISION
P2_T24_STATUS=SUPERSEDED_AS_INDEPENDENT_TASK_BY_P2_T54
P2_T24_BLOCKS_P2_T54=NO
P2_T54_STATUS=READY_FOR_IMPLEMENTATION_AUTHORIZATION
P2_T54_PRIMARY_SURFACE=REPARTIDOR
P2_T54_PRIMARY_SCOPE=DRIVER_IN_APP_NAVIGATION_UX
CURRENT_CLIENT_TRACKING_ACCEPTED_AS_SUFFICIENT=SI
RESULT=PASS
```

## 2. Current source and stack

Rechecked source after A0. The navigation screen still uses an imperative `L.Map` directly in `src/components/repartidor/delivery-navigation.tsx`; React-Leaflet is installed as a package but is not used by this map.

```text
MAP_LIBRARY=Leaflet
LEAFLET_VERSION=1.9.4 (package-lock.json and bun.lock resolved version)
REACT_LEAFLET_VERSION=5.0.0 (installed; not used in DeliveryNavigation)
MAP_RENDERER=Leaflet DOM/SVG panes; OSM raster tiles
PLUGINS_DE_MAPA_EXISTENTES=NONE_FOUND_IN_APP_DEPENDENCIES_OR_MAP_IMPORTS
MAP_ROTATION_SUPPORT_CURRENTLY_AVAILABLE=NO
CURRENT_ROUTE_PROVIDER=PUBLIC_OSRM_ROUTING_API (router.project-osrm.org/route/v1/driving)
```

No Leaflet rotation/rotated-marker plugin, MapLibre, Mapbox, or Google Maps JS renderer is installed or imported. Existing CSS transforms found in the app are ordinary UI/layout effects; no map-pane bearing transform exists. Leaflet core internally moves panes with transforms, but the current screen has no map bearing API or projection compensation.

The screen uses `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` for tiles and public OSRM for route geometry. The OSRM helper sends origin/destination coordinates, not the address string. This existing external routing behavior is preserved; provider/privacy policy is not expanded in A1.

### Map-bearing options

| Option | Feasibility / risk | Mobile and marker/route/control impact | Decision |
|---|---|---|---|
| A. North-up map, rotate a nested driver direction indicator | Feasible now; low risk. Does not rotate the map or alter Leaflet's positioned marker root. | Android/iOS use existing Leaflet map and touch behavior. Route and controls stay unchanged. Marker remains a normal Leaflet marker with only an inner visual rotated. High testability. | **Recommend.** |
| B. Use a rotation capability/plugin already present | Not available: audit found no such plugin or current rotation code. | No current support to certify on either platform. | Not applicable. |
| C. Add a small compatible rotation dependency | Technically feasible; medium/high integration and lifecycle risk. A plugin can rotate panes, but marker compensation, route geometry, attribution/controls, pinch/drag gestures, typings, and both mobile browsers require proof. | Android/iOS support is not established for this app; rotated markers/polyline and touch hit-testing are sensitive areas. Component and physical tests needed. | Do not add for R1; dependency would need separate operator approval. |
| D. Apply CSS transforms to the map/container | Technically possible, high risk and fragile. | Rotating the whole container also rotates controls; rotating panes requires counter-rotation and coordinate/hit-test compensation for markers, polylines and touch gestures. iOS Safari viewport/gesture interaction especially needs physical validation. | Reject for R1. |
| E. Migrate renderer (e.g. MapLibre/Mapbox) | Feasible as a larger architecture change; very high blast radius. | New map lifecycle, styles/tiles, gesture, marker and route rendering, attribution/provider decisions, mobile regression surface. | Not justified for follow-camera UX; reject. |

```text
MAP_ROTATION_NATIVE_SUPPORT=NO
MAP_BEARING_FEASIBLE=ONLY_WITH_ADDED_PLUGIN_OR_RENDERER; NOT_SAFELY_NATIVE_IN_CURRENT_STACK
RECOMMENDED_MAP_ORIENTATION_MODEL=NORTH_UP_WITH_DIRECTIONAL_MARKER
```

Leaflet's documented `setView`/pan methods and map events support camera control without rotating the renderer. Its event reference documents `dragstart`, `zoomstart`, `movestart`, and `moveend`; `movestart` also fires for programmatic changes, so programmatic map operations must be explicitly guarded. References: [Leaflet API reference](https://leafletjs.com/reference), [Leaflet plugin catalog](https://leafletjs.com/plugins.html), [leaflet-rotate project](https://github.com/Raruto/leaflet-rotate).

## 3. Heading source and policy

The existing single Repartidor producer is `useRepartidorTracking()` in `src/hooks/use-repartidor-tracking.ts`; it starts one `navigator.geolocation.watchPosition` for eligible deliveries and updates `latestPosition` from each fresh callback. `DeliveryNavigation` receives that sample as a prop and has no watcher of its own. Do not add another watcher or call `map.locate({watch:true})`.

The local `TrackingLocationSample` contains only `lat`, `lng`, `accuracy`, and `capturedAt` (plus testing-only callback metadata). `buildSampleFromPosition()` drops `coords.heading` and `coords.speed`. The hook observes `speed` only for the existing T24 physical-witness diagnostic; it is not part of the navigation sample. The POST `/api/repartidor/ubicacion` body contains `pedidoId`, `lat`, `lng` and optional trajectory; the realtime location type contains position/time/version/trajectory, not heading or speed. There is no current heading/bearing source in the API or navigation payload.

```text
CURRENT_HEADING_SOURCE=NONE_IN_NAVIGATION_INPUT; EXISTING_GPS_POSITIONS_ONLY
CURRENT_HEADING_AVAILABLE_RELIABLY=NO
```

| Candidate | Audit | T54 decision |
|---|---|---|
| A. `GeolocationCoordinates.heading` | Standard reports course relative to true north, but may be null when unavailable or stationary. Current code discards it before it reaches the component. | Do not widen shared tracking types/hook in R1 solely to transport it; revisit only if derived course fails physical validation and the operator authorizes that scope. |
| B. Bearing between successive real GPS samples | Available locally from the existing `latestPosition` stream; needs displacement, accuracy and timestamp gates, and will update only when fresh callbacks arrive. | **Recommended and conditional.** No server, cadence, lifecycle, or Cliente change. |
| C. `DeviceOrientation`/compass | Device attitude is not necessarily direction of travel (phone may be mounted at an arbitrary angle). Absolute compass access has platform permission/availability constraints and introduces a new event/lifecycle path. | Exclude from R1. On supported iOS configurations, permission may require a secure context and a user gesture; the permission API is not broadly available across browsers. Android behavior likewise must not be assumed uniform. |
| D. Combination | Native heading is not in the current data flow; adding it plus sensor fallback increases state and test surface. | No sensor combination for R1: derived course, then a short held course, then neutral marker. |

Proposed R1 acceptance gates for a derived bearing (all tunable only through R1 evidence): both samples have valid coordinates and finite accuracy no worse than 40 m; timestamps are monotonic and 1–20 seconds apart; sample displacement is at least `max(15 m, previousAccuracy + currentAccuracy)`; implied speed is at least 1.5 m/s; latest input is no older than 15 seconds. Compute initial bearing over the short great-circle segment. Ignore tiny angular changes (5° dead-band) and normalize turns by the shortest angular delta; use a brief inner-icon transition rather than rotating the map. Do not use a bearing if any gate fails.

```text
HEADING_SOURCE_PRIORITY=QUALIFIED_DERIVED_GPS_BEARING; ELSE_RECENT_QUALIFIED_BEARING; ELSE_NEUTRAL_MARKER
HEADING_VALIDITY_RULE=VALID_COORDINATES; ACCURACY_EACH_LE_40M; TIME_DELTA_1_TO_20S; DISTANCE_GE_MAX_15M_OR_ACCURACY_SUM; IMPLIED_SPEED_GE_1.5MPS; LATEST_AGE_LE_15S
MIN_DISTANCE_FOR_DERIVED_BEARING=MAX(15M, PREVIOUS_ACCURACY_PLUS_CURRENT_ACCURACY)
LOW_SPEED_POLICY=BELOW_1.5MPS_DO_NOT_UPDATE_COURSE; AVOID_STATIONARY_JITTER
STALE_HEADING_POLICY=HOLD_LAST_QUALIFIED_COURSE_FOR_AT_MOST_30S; THEN_NEUTRAL
NO_HEADING_FALLBACK=NORTH_UP_MAP_AND_NON_DIRECTIONAL_DRIVER_MARKER
```

W3C defines geolocation heading as nullable when unavailable or stationary and speed as nullable when unavailable. Device-orientation permission details are documented by MDN; Apple's WebKit API notes orientation data is device-relative unless a compass heading is available. These are reasons not to depend on a compass for R1, not a claim that device-specific physical behavior has been tested. References: [W3C Geolocation](https://www.w3.org/TR/geolocation/), [MDN `DeviceOrientationEvent.requestPermission`](https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent/requestPermission_static), [Apple WebKit `DeviceOrientationEvent`](https://developer.apple.com/documentation/webkitjs/deviceorientationevent).

## 4. Follow-camera and state machine

```text
FOLLOW_MODE_DEFAULT=FOLLOWING_WHEN_NAVIGATION_OPENS
FOLLOW_START_TRIGGER=FIRST_FRESH_CURRENT_POSITION; NO_NEW_GPS_ACQUISITION
FOLLOW_UPDATE_TRIGGER=NEWER_FRESH_SAMPLE_AND_DRIVER_OUTSIDE_CAMERA_DEAD_ZONE
FOLLOW_CENTER_STRATEGY=KEEP_DRIVER_IN_LOWER_MIDDLE_SAFE_ZONE; SHOW_ROUTE_AHEAD
FOLLOW_ZOOM_POLICY=INITIAL_ZOOM_16; NO_AUTO_ZOOM_PER_SAMPLE; MANUAL_ZOOM_PRESERVED_UNTIL_RECENTER
FOLLOW_PITCH_SUPPORTED=NO (Leaflet 2D)
FOLLOW_BEARING_POLICY=NORTH_UP; NEVER_ROTATE_MAP
FOLLOW_CAMERA_METHOD=SETVIEW_OR_PANTO_WITH_ANIMATE_FALSE; USE_EXISTING_LEAFLET_API
```

Use a simple `FOLLOWING | MANUAL` state in refs (plus React state only for the visible recenter affordance). Initialize on opening with a fresh location, otherwise show destination/route until a fresh sample arrives. Keep the driver around 65% down the map viewport with a modest dead-zone; issue a non-animated center adjustment only after the marker leaves the safe zone. Do not `flyTo` or animate every GPS update. Keep zoom fixed during follow. A fresh route response draws/updates the polyline but must not call `fitBounds` and steal the camera while following. If there is no location yet, one initial route `fitBounds` is acceptable; first fresh location then starts follow.

| Situation | Designed behavior |
|---|---|
| First open + fresh GPS | Enter FOLLOWING, center on driver, zoom 16, north-up. |
| First open without fresh GPS | Keep the existing destination-first view; do not request another fix. When a fresh prop arrives, enter follow. |
| Route loading/loaded | Follow current driver if available. Loading or successful redraw does not recenter/zoom the map. If there is no driver fix, one initial route bounds fit is allowed. |
| New GPS sample | Update marker and conditionally bearing; move camera non-animated only after leaving dead-zone. |
| GPS unavailable/stale | Freeze camera at last valid view; keep last position visibly stale, suppress heading after its 30-second hold, and do not start another watcher. Resume on a newer fresh sample. |
| Route error | Keep follow independent of routing; preserve any last good route, display existing error/retry and Google Maps fallback. |
| Destination close | No automatic zoom or repeated fit. Keep follow/route readable; allow driver to use manual map controls. |
| Delivery finalized | Stop navigation-owned route work and close/unmount the overlay with its parent delivery lifecycle; cleanup cancels pending route request/listeners. Do not create background work. |

## 5. Manual pan, zoom, recenter, marker

Manual interaction transitions FOLLOWING to MANUAL. Listen to Leaflet `dragstart` and user-initiated `zoomstart`; optionally cover keyboard map movement with `movestart`. Do not use bare `movestart` without a guard because follow `setView` and initial `fitBounds` also move the map. Wrap every programmatic camera change in a short-lived `cameraOperationRef` guard and use non-animated camera calls so no delayed animation is misclassified. On manual drag/zoom, never move the camera from GPS updates; marker and route data may continue updating.

`RECENTER_VISIBLE_WHEN=MANUAL_AND_A_FRESH_LOCATION_EXISTS` (can also remain visible if the marker leaves the dead-zone). The button transitions to FOLLOWING, centers at the latest fresh location, resets zoom to 16, and leaves the map north-up. Put it in the map viewport's lower-right with a 48×48 px target, safe spacing from map edges/footer, visible focus ring, and an `aria-label` such as “Volver a seguir mi ubicación”; expose pressed/following state. Do not cover the route instruction or existing Leaflet zoom controls.

```text
RECENTER_ACTION=SET_FOLLOWING_AND_CENTER_LATEST_FRESH_POSITION
RECENTER_RESUMES_FOLLOW=YES
RECENTER_RESTORES_ZOOM=YES (ZOOM_16)
RECENTER_RESTORES_BEARING=NOT_APPLICABLE; MAP_REMAINS_NORTH_UP
CURRENT_MARKER_TYPE=LEAFLET_DIVICON_WITH_BLUE_CIRCULAR_BACKGROUND_AND_SCOOTER_EMOJI
MARKER_ROTATION_FEASIBLE=YES_ON_NESTED_DIVICON_CHILD; DO_NOT_ROTATE_LEAFLET_POSITIONING_ROOT
MARKER_ROTATION_REQUIRES_NEW_ASSET=NO
RECOMMENDED_DRIVER_MARKER_BEHAVIOR=KEEP_BLUE_POSITION_MARKER; ADD_SIMPLE_NORTH-REFERENCED_DIRECTION_WEDGE_ONLY_WHEN_COURSE_VALID; NEUTRAL_WHEN_NOT
```

This avoids map/plugin transforms and does not require a new raster asset. Ensure the direction wedge's zero-degree direction is explicitly north; preserve the marker's geographical anchor and position transform.

## 6. Route, off-route, instructions

```text
ROUTE_INITIAL_CALC_TRIGGER=NAVIGATION_OPEN_AND_TRACKING_ELIGIBLE_AND_DESTINATION_AND_CURRENT_COORDINATE_AVAILABLE
ROUTE_RECALC_CURRENT_BEHAVIOR=AT_LEAST_30S_AND_(ORIGIN_MOVED_GE_100M_OR_ELAPSED_GE_120S)
ROUTE_REFRESH_CURRENT_BEHAVIOR=POSITION_PROP_CHANGES_RUN_THROUGH_THROTTLE; FOREGROUND_RETRY_IF_ROUTE_MISSING_ERROR_OR_STUCK_LOADING
ROUTE_REFRESH_FOR_T54=NOT_REQUIRED
CURRENT_OFF_ROUTE_BEHAVIOR=NO_EXPLICIT_OFF_ROUTE_DISTANCE_DETECTION_OR_WARNING; EXISTING_THROTTLED_REFRESH_REQUESTS_A_NEW_ORIGIN_TO_DESTINATION_ROUTE
CURRENT_INSTRUCTION_LEVEL=FIRST_NONEMPTY_OSRM_STEP_INSTRUCTION_ONLY; NO_STEP_ADVANCEMENT_OR_VOICE
VOICE_NAVIGATION=OUT_BY_DEFAULT
FULL_TURN_BY_TURN_ENGINE=OUT_BY_DEFAULT
```

Keep the existing public OSRM route/helper and its 30-second / 100-metre minimum and 120-second maximum refresh cadence. T54's follow camera does not require additional server calls. A refresh must replace the route line without stealing camera state. Do not add T24 map matching, snapping, an off-route detector, reroute banners, a step list, automatic maneuver progression, or voice in this round. If the current static first instruction proves materially misleading during physical recertification, record evidence for a separately scoped decision; do not silently grow R1.

Recommended off-route behavior is the existing throttled recalculation only plus the persistent Google Maps fallback. No advanced off-route inference is needed for the core follow-camera deliverable. `retryRoute` remains user-triggered and bypasses the throttle only as it does today.

## 7. Client/server boundary, mobile, performance, accessibility

All new behavior can be derived from the Repartidor's existing `currentPosition` prop and map-local state. There is no need to alter the Cliente tracking map/playback, T23 filters, GPS cadence/sends, tracking lifecycle/background behavior, stale UI, completion APIs, realtime payloads, DB, or map-matching server path.

```text
CLIENT_TRACKING_FILES_REQUIRED_FOR_T54=0
T54_SERVER_CHANGE_REQUIRED=NO
T54_SCHEMA_CHANGE_REQUIRED=NO
T54_MIGRATION_REQUIRED=NO
```

- The existing full-screen header/footer already use top/bottom `safe-area-inset` padding. Keep new map controls inside the visible map viewport; recenter target at least 44 px (recommend 48 px). Recalculate map size after layout/orientation change and on return to foreground; Leaflet's `invalidateSize({pan:false, debounceMoveend:true})` is suitable. Do not promise background tracking: the existing hook documents best-effort platform behavior.
- Keep the Leaflet map instance in refs. Avoid per-GPS React state churn beyond the current component input and small follow/manual UI state. Heading calculations should be pure and gated; coalesce map updates to one animation frame if needed, then cancel the frame on teardown. No chained `flyTo`/pan animations.
- Continue existing route request throttle/timeout/abort/generation guards. A route refresh does not change camera. Preserve last known route on failure and expose retry + Google Maps.
- Remove map listeners and cancel pending frames/timers on unmount; map removal already clears Leaflet-owned listeners. Review the existing delayed `invalidateSize` callback so it cannot act after unmount. Foreground return should invalidate dimensions and wait for a fresh position rather than infer movement from stale data.
- New button: accessible name, meaningful follow/manual state, keyboard focus visibility, and 48 px touch target. Keep map zoom controls in place; any restyling must preserve their accessible operation.

`DeviceOrientationEvent.requestPermission()` is not a cross-browser baseline; in supporting configurations it is HTTPS-only and requires transient user activation, and absolute heading may request magnetometer access. Do not request sensor permission on navigation open. Android Chrome/PWA and iOS Safari/PWA support must be verified on physical devices for the proposed GPS-derived behavior; A1 did not run physical tests.

## 8. Test plan before implementation

No tests were run in A1. The repository has `src/lib/delivery-navigation.test.ts` and `src/lib/delivery-navigation-static-contract.test.ts`; there is no focused mounted `DeliveryNavigation` component test in the inspected test set. Bun is the test runtime (`bun:test`); package scripts do not define a dedicated `test` command.

### AUTOMATED_UNIT

- Bearing calculation across cardinal directions and the 359°→1° wrap; invalid coordinates and nonmonotonic time.
- Accuracy-sum distance gate, maximum sample age/gap, low-speed/stationary behavior, 30-second stale expiry, and neutral fallback.
- FOLLOWING/MANUAL transitions, recenter restoring default zoom, camera dead-zone predicate, and programmatic-operation guard.
- Existing OSRM URL/parser/throttle/error tests continue passing unchanged.

### AUTOMATED_COMPONENT / SOURCE_CONTRACT

- Map mounts once; one current-position prop stream only; no `navigator.geolocation`, `watchPosition`, `map.locate({watch:true})`, new route endpoint, or added dependency.
- Follow update does not call animated `flyTo`; route redraw does not override FOLLOWING or MANUAL camera.
- Drag, pinch/zoom controls and keyboard-origin map movement enter MANUAL; guarded programmatic movement does not. GPS updates while MANUAL never recenter.
- Recenter button has accessible label/state, >=44 px target, re-enables follow and resets zoom; cleanup removes listeners/cancels pending frame/timer.
- Route error/fallback and stale/finalized delivery lifecycle remain truthful.

### PHYSICAL_ANDROID

- Android Chrome and installed PWA: initial route/follow, repeated location updates, heading while moving and no heading while stopped/poor GPS, manual drag, pinch/zoom, recenter, OSRM failure/Google Maps return, orientation/viewport change, foreground resume, and delivery completion.

### PHYSICAL_IOS

- iPhone Safari and installed PWA: same interaction matrix; safe areas, map resize after orientation/app return, drag/pinch non-conflict with page gestures, no extra sensor permission prompt, Google Maps round trip, stale location and completion cleanup.

Physical device tests are required in R1 closeout; they are not claimed as completed here.

## 9. R1 implementation boundary

```text
EXPECTED_PRODUCT_FILES=src/components/repartidor/delivery-navigation.tsx; new src/lib/delivery-navigation-ux.ts; conditionally src/components/repartidor/deliveries-tab.tsx only if terminal state does not already unmount the overlay
EXPECTED_TEST_FILES=new src/lib/delivery-navigation-ux.test.ts; extend src/lib/delivery-navigation.test.ts and src/lib/delivery-navigation-static-contract.test.ts; add focused DeliveryNavigation component test if the existing test harness can mock Leaflet without brittle implementation coupling
NEW_HELPERS_IF_ANY=PURE_BEARING_VALIDATION_AND_FOLLOW_CAMERA_STATE/DEAD_ZONE_HELPERS
NEW_DEPENDENCY_PROPOSED=NONE
WHY_REQUIRED=NO_NEW_DEPENDENCY_REQUIRED_FOR_NORTH_UP_CAMERA_FOLLOW_OR_NESTED_MARKER_DIRECTION_INDICATOR
ALTERNATIVE_WITHOUT_DEPENDENCY=USE_CURRENT_LEAFLET_SET_VIEW_AND_EXISTING_POSITION_PROP
RISK=MEDIUM; MAP_EVENT_GUARD_AND_PHYSICAL_TOUCH/HEADING_VALIDATION_ARE_THE_MAIN_RISKS
IMPLEMENTATION_SPLIT_REQUIRED=NO
P2_T54_IMPLEMENTATION_SPLIT=P2-T54-R1_SINGLE_BOUNDED_ROUND
```

Keep the R1 diff local to the driver navigation surface and pure UX helpers/tests. Do not modify `src/components/tracking/delivery-tracking-map.tsx`, `src/hooks/use-repartidor-tracking.ts`, `src/lib/tracking-movement.ts`, `/api/repartidor/ubicacion`, realtime contracts, Prisma/schema, or T24 map-matching files. If reliable course cannot be obtained from existing samples during physical certification, stop and ask before expanding that boundary.

## 10. Read-only execution and next gate

```text
CURRENT_MAP_STACK=LEAFLET_1.9.4; DIRECT_IMPERATIVE_LEAFLET; REACT_LEAFLET_5.0.0_INSTALLED_BUT_NOT_USED_BY_THIS_MAP
CURRENT_ROUTE_PROVIDER=PUBLIC_OSRM_ROUTING_API
CURRENT_HEADING_SOURCE=NONE_IN_NAVIGATION_INPUT; EXISTING_GPS_POSITIONS_ONLY
CURRENT_HEADING_AVAILABLE_RELIABLY=NO
MAP_ROTATION_NATIVE_SUPPORT=NO
MAP_BEARING_FEASIBLE=ONLY_WITH_ADDED_PLUGIN_OR_RENDERER; NOT_SAFELY_NATIVE_IN_CURRENT_STACK
MARKER_ROTATION_FEASIBLE=YES_ON_NESTED_DIVICON_CHILD; NO_NEW_ASSET
RECOMMENDED_MAP_ORIENTATION_MODEL=NORTH_UP_WITH_DIRECTIONAL_MARKER
RECOMMENDED_HEADING_MODEL=QUALIFIED_BEARING_DERIVED_FROM_EXISTING_FRESH_GPS_SAMPLES; SHORT_HOLD; NEUTRAL_IF_UNRELIABLE
RECOMMENDED_FOLLOW_MODEL=FOLLOWING_BY_DEFAULT; LOWER_MIDDLE_SAFE_ZONE; DEAD_ZONE; SETVIEW_OR_PANTO_ANIMATE_FALSE; DEFAULT_ZOOM_16
RECOMMENDED_MANUAL_PAN_MODEL=FOLLOWING_TO_MANUAL_ON_USER_DRAG_OR_ZOOM; CAMERA_FROZEN_UNTIL_RECENTER
RECOMMENDED_RECENTER_MODEL=VISIBLE_IN_MANUAL_WITH_FRESH_FIX; ACCESSIBLE_48PX; RESUME_FOLLOW_CENTER_LATEST_AND_RESET_ZOOM_16
RECOMMENDED_ROUTE_REFRESH_MODEL=KEEP_CURRENT_OSRM_THROTTLE_100M_30S_MAX_120S; ROUTE_REFRESH_FOR_T54=NOT_REQUIRED
RECOMMENDED_OFF_ROUTE_MODEL=NO_ADVANCED_DETECTOR; KEEP_EXISTING_THROTTLED_REFRESH_PLUS_GOOGLE_MAPS
RECOMMENDED_MARKER_MODEL=EXISTING_BLUE_MARKER_WITH_NESTED_DIRECTION_WEDGE; NEUTRAL_IF_NO_VALID_COURSE
NEW_DEPENDENCY_PROPOSED=NONE
T54_SERVER_CHANGE_REQUIRED=NO
T54_SCHEMA_CHANGE_REQUIRED=NO
T54_MIGRATION_REQUIRED=NO
CLIENT_TRACKING_FILES_REQUIRED_FOR_T54=0
EXPECTED_PRODUCT_FILES=delivery-navigation.tsx; new delivery-navigation-ux.ts; parent deliveries-tab.tsx only if completion does not already unmount
EXPECTED_TEST_FILES=new delivery-navigation-ux.test.ts; extend delivery-navigation.test.ts and delivery-navigation-static-contract.test.ts; focused component coverage for map mode/buttons
IMPLEMENTATION_SPLIT_REQUIRED=NO; P2-T54-R1_SINGLE_BOUNDED_ROUND
BRANCH_CREATED=NO
WORKTREE_CREATED=NO
CODE_CHANGED=NO
TESTS_RUN=NO
CLIENT_TRACKING_FILES_REQUIRED_FOR_T54=0
T54_SERVER_CHANGE_REQUIRED=NO
T54_SCHEMA_CHANGE_REQUIRED=NO
T54_MIGRATION_REQUIRED=NO
PRODUCTION_TOUCHED=NO
P2_T54_A1_STATUS=DESIGN_COMPLETE
P2_T54_R1_READY_FOR_AUTHORIZATION=YES
NEXT_ACTION=RETURN_TO_OPERATOR_FOR_P2_T54_R1_IMPLEMENTATION_AUTHORIZATION
REPORT_PATH=C:\Leo Campos\Trabajo\deligo-main-limpio\codex-reports\P2_T54_A1_DRIVER_NAVIGATION_TECHNICAL_AUDIT_DESIGN.md
```

When R1 is authorized, work in the single canonical directory `C:\Leo Campos\Trabajo\deligo-main-limpio`, and only after safely reviewing the existing dirty state create `work/p2-t54-driver-navigation` there. No branch switch or worktree was performed during A1.
