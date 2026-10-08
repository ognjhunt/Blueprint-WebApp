# Clear acknowledgment and reload reliability

Observed blocker: required main CI run `37766871316`, E2E job `113276689429`, on `8c6f020ea75eccd4530b1cb8dde478fe6482b4be` failed UI-RETURN-002. The test clicked Clear and immediately reloaded, then saw the original task for its 12-second assertion window. PR943 CI had passed. The failure is retained in the coordinator's private `output/reliability-program/assessment-8c6-release/main-e2e-failure.log`; no lucky rerun was used to erase it.

The unchanged case passed three predetermined local Chromium attempts. A real origin WebLock held by a second disposable tab made the boundary deterministic. Clear waits for that lock and strict IndexedDB retirement/fresh-generation commits; a click's returned event is not their acknowledgment. When a new document replaces the old one before the held lock is released, the uncommitted Clear is canceled and the old draft remains. No completed-clear message was displayed. The pre-fix pending-feedback expectation failed deterministically. This evidence supports a P2 missing feedback/ambiguous action boundary, rather than a demonstrated acknowledged-clear resurrection or privacy P1. Required CI remains a release blocker until the reviewed replacement checks pass.

The repair gives each existing Clear control pending, completed, and failure states. It blocks editing and dispatch while Clear is pending, preserves the uncertainty on failure, and exposes completion only after the existing two-store reset commits a fresh empty authority. It also covers the unreadable-recovery and saved-job surfaces. Clearing removes this device's draft/retry recovery; it does not cancel or delete the saved job or promise provider deletion. No persistence schema, backend, provider, or authorization contract changes are included.

UI-RETURN-002 is explicitly corrected to await the actual visible durable completion, then retain its original reload-empty assertion. This is a product acknowledgment, not a sleep or a weakened persistence assertion. Two new frozen supplemental cases prove (001) pending controls while the real lock is held, both-store empty/fresh generation before completed acknowledgment, reload, and second-tab adoption; and (002) literal reload before acknowledgment with no false success and the original unretired draft restored. The original 12 case IDs remain, with two supplemental conditions added. Consent remains unchecked on return and fresh grants are not inherited.

The first interruption probe released the lock as soon as navigation was requested, before the old document actually ended; Clear legitimately committed. That diagnostic failure is retained as an invalid cancellation boundary. The corrected version awaits the new document's DOMContentLoaded before releasing the lock and passed on unchanged source. Mirrors are captured after the holder's mount autosaves drain, preventing unrelated timestamps from being mistaken for a clear mutation. A new signed-account component fixture initially tried to fill a hidden email field; its retained setup failure was corrected without a runtime change.

Initial candidate (`81183b1f`) local execution: the full 14 intercepted-API browser cases passed, plus three executions of each selected UI-RETURN-002/UI-CLEAR-001/UI-CLEAR-002 (nine attempts). That is **14 unique browser cases and 23 passed attempts**, with each selected case executed four times including the full run. Seven component/helper/account-retirement test files passed 228 checks. A subsequent component-only supplement added two account-change-during-clear checks; its targeted file passed all eight checks, including the six already covered. The two new checks verify queued ordinary/unreadable clears cannot erase or acknowledge the new account scope. They use the explicit durability fake and add zero browser cases. Typecheck, Graphify and diff validation passed. The initial two new component expectations failed before repair and passed afterward. Exact source/test-definition/native trace/result hashes and every diagnostic outcome are in the JSON companion. Repeats and component checks are not additional customer journeys.

These are actual Chromium and native local IndexedDB/WebLock executions with intercepted APIs, plus explicitly simulated component durability tests. They do not establish production backend, provider, notification, or assessment correctness. All fixtures are disposable synthetic data; no live model, mail, real customer record, production fault, or private footage was used. Retain private raw evidence under `output/reliability-program/clear-reload/` for at most 30 days. Root owns independent acceptance, required remote checks, merge, deployment and live verification.

Replay from this revision after dependency setup with port 42879 free; the runner starts and cleans its own Vite child. No provider credentials are needed:

```bash
env -i PATH="$PATH" HOME="$HOME" TMPDIR="${TMPDIR:-/tmp}" \
  RELIABILITY_INTAKE_OUTPUT=output/reliability-program/clear-reload/replay \
  node node_modules/@playwright/test/cli.js test \
  --config playwright.reliability-intake.config.ts
```

Add `--grep 'UI-CLEAR|UI-RETURN-002' --repeat-each 3` for the selected repeat run. Relevant local checks:

```bash
node node_modules/vitest/vitest.mjs run \
  client/tests/components/SiteCaptureStart.durability.test.tsx \
  client/tests/components/SiteCaptureStart.recovery.test.tsx \
  client/tests/components/SiteCaptureStart.test.tsx \
  client/tests/lib/siteCaptureDraft.test.ts \
  client/tests/lib/siteCaptureDraft.crossTab.test.ts \
  client/tests/lib/siteCaptureDraft.reliability.test.ts \
  client/tests/contexts/AuthProviderRecoveryCleanup.test.tsx
npm run check
bash scripts/graphify/run-webapp-architecture-pilot.sh --no-viz
```

Independent review reproduced two P2 neighbors on `81183b1f`: a canceled unavailable-clear intent revives after A→B→A, and a successful retry retains a stale storage warning. The account probe models same-key FIFO: returning-A hydration queues behind the old clear, and no new A work is edited or claimed erased. The matched expectations failed 2/2 before repair (seven other component checks skipped). The small follow-up binds the wrapper intent to a monotonic scoped epoch before mutation and completion, and clears the stale warning after a successful commit. Its component file passed 9/9, with persistence helpers unchanged. Final native execution will be recorded separately; the 811 browser receipts are not final-epoch proof.
