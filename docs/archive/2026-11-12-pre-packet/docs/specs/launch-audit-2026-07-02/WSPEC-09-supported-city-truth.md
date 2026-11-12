# WSPEC-09: `backend_supported` must reflect real supply (Durham)

- Status: Proposed
- Priority: **P1 — major** (fake-readiness surface)
- Area: city-status route / supported-city configuration (server), cross-repo with `BlueprintCapturePipeline` SPEC-13

## Problem

The pipeline's city-launch harness recorded (Durham run `2026-05-11`,
`ops/city-launch-runs/durham-nc/.../proof.launch-proof.json` and
`lane-results/city_backend.webapp-status-route.json` in the pipeline repo):

- `city.backend_supported: true`
- `city.live_approved_job_count: 0`
- `city.live_capture_target_count: 0`

The WebApp backend presents Durham as a supported/live city with zero approved jobs and
zero capture targets — a "supported city" with no real supply. Doctrine forbids fake
supply/readiness states. The pipeline harness catches it downstream today, but the
buyer-facing status route itself is the surface that must be truthful.

Related: during the Austin run the same route was down with Firestore
`RESOURCE_EXHAUSTED` on `cityLaunchActivations`/`cityLaunchCandidateSignals` (pipeline
SPEC-13 item 1 covers the quota fix).

## Proposed fix

1. Derive `backend_supported` (or a new `supply_ready` field) from live ledgers, not a
   static config flag: supported requires ≥ configurable thresholds of approved
   jobs/capture targets (or an explicit ops attestation with expiry for pre-launch
   cities).
2. Split the states in the API: `configured` (we intend to launch here) vs
   `supply_ready` (real jobs/targets exist) vs `live` (buyers can transact). UI copy maps
   accordingly so a configured-but-empty city is never displayed as available.
3. Make the status route resilient (cached snapshot with staleness metadata) so quota
   exhaustion degrades to "stale data, timestamped" rather than unavailable.
4. Add the same fields to the pipeline harness contract so the city-backend lane
   validates the split states.

## Acceptance criteria

- [ ] A city with zero approved jobs/targets can never serialize as supported/available to buyers (unit test on the route).
- [ ] Durham's current state renders as configured-not-supply-ready.
- [ ] Status route serves cached-with-staleness rather than erroring on Firestore quota issues.
