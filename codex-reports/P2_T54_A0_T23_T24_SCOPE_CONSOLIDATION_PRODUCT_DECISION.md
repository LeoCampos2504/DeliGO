# P2-T54-A0 — Product Scope Consolidation: P2-T23 + P2-T24 into P2-T54

Date: 2026-09-27
Result: `PASS` — documentation and source audit only

## Operator decision

P2-T23 and P2-T24 are no longer independent steps or prerequisites in a three-task chain. The product decision is to consolidate the relevant future navigation work into P2-T54, which is now the sole active task in this chain and is `READY_FOR_AUDIT_AND_DESIGN`.

This is a scope reduction, not a technical closure. Existing code, test results, historical FAIL/PASS outcomes, reports, H1/H2/H3/H4 work, and physical evidence remain intact. T23/T24 are not represented as technically complete.

```text
P2_T23_STATUS=SUPERSEDED_BY_PRODUCT_DECISION_INTO_P2_T54
P2_T23_H4_FILTER_CALIBRATION_REQUIRED=NO
P2_T23_SMOOTH_MARKER_REQUIREMENT=REMOVED_BY_PRODUCT_DECISION
P2_T23_TECHNICAL_HISTORY_PRESERVED=SI
P2_T23_COMPLETED_TECHNICALLY=NO
P2_T24_STATUS=SUPERSEDED_AS_INDEPENDENT_TASK_BY_P2_T54
P2_T24_BLOCKS_P2_T54=NO
P2_T24_INDEPENDENT_RELEASE_GATE=NO
P2_T24_TECHNICAL_HISTORY_PRESERVED=SI
P2_T24_COMPLETED_TECHNICALLY=NO
T24_FEATURE_ABSORPTION_INTO_T54=ONLY_IF_REQUIRED_FOR_DRIVER_NAVIGATION
P2_T54_STATUS=READY_FOR_AUDIT_AND_DESIGN
P2_T54_PRIMARY_SURFACE=REPARTIDOR
P2_T54_PRIMARY_SCOPE=DRIVER_IN_APP_NAVIGATION_UX
P2_T54_CLIENT_SMOOTH_INTERPOLATION_SCOPE=OUT
P2_T54_T23_FILTER_CALIBRATION_SCOPE=OUT
P2_T54_T24_FULL_MAP_MATCHING_SCOPE=OUT_BY_DEFAULT
P2_T54_GOOGLE_MAPS_FALLBACK=PRESERVE
P2_T54_BLOCKED_BY_T23=NO
P2_T54_BLOCKED_BY_T24=NO
CURRENT_CLIENT_TRACKING_ACCEPTED_AS_SUFFICIENT=SI
CLIENT_TRACKING_REWORK_REQUIRED_FOR_P2_T54=NO_BY_DEFAULT
NEXT_PRIORITY_TASK=P2-T54
P2_T54_IMPLEMENTATION_AUTHORIZED=NO
PRODUCTION_TOUCHED=NO
NEXT_ACTION=RETURN_TO_OPERATOR_FOR_P2_T54_A1_AUTHORIZATION
```

## Source audit: what exists

Read-only inspection was performed against the canonical local source; the audited navigation/tracking source blobs matched `origin/testing-codex` at the fetched remote base.

- `src/components/repartidor/delivery-navigation.tsx` provides the in-app Leaflet map, current-location and destination markers, route line, distance, ETA, first route instruction, route retry/error UX, and a Google Maps action. Route calculation uses the OSRM routing endpoint. The map fits bounds when a route is drawn; current-position updates move the marker.
- `src/lib/delivery-navigation.ts` contains route URL/response and Google Maps URL helpers.
- `src/components/repartidor/deliveries-tab.tsx` mounts the navigation surface from the Repartidor delivery flow.
- The source inspected does not implement follow-camera updates, a recenter control, driver-heading marker orientation, map bearing/orientation, or explicit manual-pan suspension and return-to-follow controls. A0 is source inspection only; this is not a claim about physical-device behavior.
- Map-matching provider/policy code is used in `/api/repartidor/ubicacion` and tracking/playback paths associated with the Cliente tracking surface. It is not evidence that full map matching is currently part of the driver navigation UX, and it is not included by default in T54.
- The Cliente tracking map remains a separate surface. The operator accepts the current ability to see the delivery position as sufficient; this task makes no tracking, GPS cadence, API, realtime, lifecycle, stale-state, playback, or database changes.

No tests were run. No code, test, configuration, GPS, database, Railway, or Production changes were made.

## P2-T54 scope classification for A0 handoff

### CORE_T54_REQUIRED

- Follow camera that keeps the driver/location and usable route context visible.
- Recenter action and a clear transition between automatic follow and manual map movement.
- Driver heading and map bearing/orientation behavior, subject to confirming available heading data and platform constraints during A1 design.
- Route remains visible and understandable during navigation.
- Manual pan must not fight the user; provide an understandable way to resume follow.
- Preserve Google Maps as fallback.

These are the product scope named by the operator. Exact behavior and implementation details remain for A1 design; this report does not claim they are already implemented.

### OPTIONAL

- Navigation presentation polish and nonessential refinements identified during A1, only if they support the core driver experience and are separately bounded.
- Route refresh/recovery improvements beyond the current behavior, if evidence shows they are needed for core navigation.

No optional item is authorized merely by appearing in historical T23/T24 architecture or reports.

### OUT_OF_SCOPE

- Smooth/interpolated Cliente marker playback or work whose only purpose is visual smoothness.
- H4 filter calibration as a gate.
- Full T24 map matching, route snapping, or final-delivery GPS refinements by default; absorb an individual piece only if a concrete driver-navigation requirement is demonstrated.
- A complete turn-by-turn navigation engine, voice prompts, full maneuver guidance, advanced rerouting/map matching, or a new map provider unless separately justified and authorized.
- Changes to Cliente tracking, GPS frequency/sending, lifecycle/background tracking, stale UI, completion tracking, APIs, realtime, or database schema.

## Current backlog and operating policy

```text
P2_T33_STATUS=SEQUENCED_AFTER_FUNCTIONAL_WORK
P2_T37_STATUS=SEQUENCED_AFTER_FUNCTIONAL_WORK
P2_T52_PHASE4_STATUS=ALTERNATIVE_PRIORITY_UNASSIGNED; NOT_STARTED
P2_T44_STATUS=PAUSED_UNRESOLVED_AFTER_TIMEBOX
DELIGO_WORKTREE_POLICY=SINGLE_PHYSICAL_PROJECT_DIRECTORY
CANONICAL_PROJECT_DIR=C:\Leo Campos\Trabajo\deligo-main-limpio
TASK_WORKTREES_ALLOWED=NO
CANONICAL_REPORT_DIR=C:\Leo Campos\Trabajo\deligo-main-limpio\codex-reports
IMPORTANT_TASK_ISOLATION=DEDICATED_GIT_BRANCH
FUTURE_T54_BRANCH_EXAMPLE=work/p2-t54-driver-navigation
BRANCH_CREATED_DURING_A0=NO
SINGLE_PHYSICAL_DOCUMENTATION_COPY_PRESERVED=SI
```

No branch or worktree was created. For a future important implementation task, use a dedicated Git branch inside the same canonical physical project directory, after checking that changing branches is safe. Do not create a project folder or worktree per task.

## Documentation and Git closeout

The canonical handoff files are the root `CODEX_REPORT.md`, root `DELIGO_FULL_CONTEXT_LATEST.md`, and `codex-reports/ROADMAP.md`. This report is stored only in the canonical `codex-reports` directory. The documentation-only commit is constructed directly on the fetched `origin/testing-codex` tip with a temporary Git index; only the four authorized documentation files are included. The push target is `origin/testing-codex`, using a normal fast-forward push (never force).

```text
SOURCE_CODE_CHANGED=NO
TEST_FILES_CHANGED=NO
PRISMA_CHANGED=NO
CONFIG_CHANGED=NO
PRODUCTION_CONFIG_CHANGED=NO
PRODUCTION_TOUCHED=NO
REPORT_PATH=C:\Leo Campos\Trabajo\deligo-main-limpio\codex-reports\P2_T54_A0_T23_T24_SCOPE_CONSOLIDATION_PRODUCT_DECISION.md
```

The documentation commit SHA and push result are recorded in the final task handoff after remote verification.
