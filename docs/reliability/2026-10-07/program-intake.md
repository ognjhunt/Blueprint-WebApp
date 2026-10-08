# Intake and return reliability evidence

Scope: the owner's reliability program, partner intake/authorization and durable workflow state under the coordinator's `program-charter.md`. Baseline is `1b8d810ec117b93fe52fd323be052ddafa7070db`. This lane owns `SiteCaptureStart`, its draft helper/tests and isolated browser replay. No server queue, provider, notification transport or dishwasher fixture was changed or used.

The scoped repair retains a draft, request identity and retry credential in account- and authoring-scoped local browser storage, with bounded record size. Seven days is recovery eligibility from the last draft edit, not deletion retention. Expiry disables local replay and preserves the stored bytes until the user explicitly clears this browser's draft. It freezes the exact body before intake dispatch. An uncertain response or acknowledged save can be recovered explicitly through the existing authorized same-ID handler, which obtains the current private link. Video bytes and signed capture URLs are not stored. Return restores drafting fields and clears unsubmitted recording/provider consent; recovering an already-submitted body preserves its historical attestation without granting new authority. Server authorization remains authoritative. Switching accounts resets the mounted form and prevents a late intake response from starting the previous video's upload.

Interrupted uploads return to the same job with an uploader/reselection route; this is **not chunk resumption** and makes no promise that original File bytes survived. A status hint with a denied HTTP response cannot become upload receipt. Malformed error fields use a safe repair message and job correlation reference. Unreadable or expired stored recovery bytes are preserved and require the emailed private link or explicit local clearing, instead of silently creating another intake. Local clearing never claims server/provider deletion. Blocked browser storage shows the specific recovery limitation while submission remains usable.

## Frozen counts and executed layers

`program-intake.json` froze 90 catalog entries before its scored execution: 30 existing intake cases selected by meaningful condition (equivalent capitalization variants excluded), 30 new local retention/return cases and 30 new local scope/replay-authority cases. Every entry has a stable ID, condition, expected outcome, source, layer and SHA-256. The 60 storage cases test parser, retention, scope and authority contracts; they are not customer journeys or proof of backend access enforcement. The 30 reused component cases must be deduplicated against other inventories by source/full test name. Extra assertions, source-specific IDs and repeated runs do not increase these denominators.

The accepted focused replay has **127 passing checks**, zero failures/skips: 49 existing component checks, seven recovery/neighbor checks, 61 local helper checks and ten existing video-upload helper checks. Only the frozen 90 are the inventory denominator. Four added neighbors explicitly sit outside it: acknowledged upload return without duplicate upload, stale account acceptance fencing, malformed HTTP error shape, and unreadable local bytes; an additional UID-sentinel collision assertion is also separately retained. No thresholds or original labels were changed to pass.

Eight distinct browser cases pass through the actual customer UI with intercepted API/transport responses. The selected lost-response/reload case was also repeated three times, with three passes; these repeats add no unique case. The final result and exact attempts are bound in `program-intake-results.json`. They cover lost create response/reload, tab closure, persisted browser-storage handoff, provider-mode isolation, repairable HTTP body, slow double click, denied receipt, and actual Chromium process termination while a real decoded synthetic MP4/XHR is in flight. That last case closes the first browser, launches another process and explicitly imports previously captured origin storage: process termination is real, **browser storage restoration is a controlled handoff**, and backend/provider durability is simulated. It recovers the same request and offers original-file reselection without a second automatic video dispatch or a receipt claim. None of these eight fill a normal-UI real-backend denominator.

## Counterexamples and limits

| Failure | Severity and root cause | Before/after evidence |
|---|---|---|
| `RETURN-001` draft lost on remount | P1 lost customer work: uncontrolled fields had no retained state | Exact unchanged-main reproducer fails; repaired same case passes |
| `RETURN-002` lost intake response has no retained recovery action | P1 durable recovery loss: request/retry identity lived in refs | Exact unchanged-main reproducer fails; repaired same case passes; same serialized body in browser replay |
| `RETURN-003` account switch retains anonymous task fields | P1 local privacy boundary: mounted form was not scoped to identity | Exact unchanged-main reproducer fails; repaired same case passes. This does not establish a backend cross-tenant leak |
| First candidate double-click moved the form beneath the pointer | P2 candidate regression: inserting recovery UI during save shifted the disabled Start and exposed a Pricing link under the next click | First browser run 6/7 with retained failing trace; hide recovery panel during in-flight operation; same case passes |

The original three minimized reproducers executed against unchanged baseline production source: 0/3 passed, 3/3 failed. Receipts contain synthetic identities only. The reference test's expected recording-consent reset is a repair rule; baseline failure was lost draft before that assertion. Later native-process harness attempts failed before the requested transport boundary because of an ambiguous accessible-name selector and a redundant manual tracing start (Playwright already starts contexts). Those are preserved as harness failures, then repaired without changing the test expectation.

Browser transport/status tests, parser cases and fake handlers cannot establish Firestore/object persistence, provider receipts, worker restart, notification delivery, withdrawal or renewed-link authorization in production. The coordinator owns that joined proof. This lane performs no paid model/provider call or real notification send. No human review gate is inferred or reactivated here.

## Replay and artifact recovery

Install the repository dependencies using the established install command, then run:

```bash
npx vitest run client/tests/components/SiteCaptureStart.test.tsx client/tests/components/SiteCaptureStart.recovery.test.tsx client/tests/lib/siteCaptureDraft.reliability.test.ts client/tests/lib/selfCaptureVideo.test.ts --maxWorkers=1 --minWorkers=1
npx playwright test --config playwright.reliability-intake.config.ts
npm run check
bash scripts/graphify/run-webapp-architecture-pilot.sh --no-viz
```

Browser replay uses loopback Vite only, existing no-dotenv Vite configuration, fresh anonymous identities and an outbound-deny route; no live backend or credentials are required. Install Playwright's pinned Chromium through the existing browser setup. The native transport case additionally needs local `ffmpeg` (or `BLUEPRINT_TEST_FFMPEG` pointing to it) to generate a two-second synthetic test pattern; absence is an explicit skipped dependency. `RELIABILITY_INTAKE_OUTPUT` selects an ignored result folder. A replay can view the retained local `trace.zip` with Playwright's trace viewer.

Canonical code/catalog and sanitized result summary live in Blueprint-owned Git. Raw synthetic-only local receipts/traces are retained under the lane's ignored `output/reliability-program/intake/`, with hashes in the compact result index; replay regenerates them from Git. They contain no original customer video, paid-provider secret or bearer customer link. This lane's code/check result is a reviewable slice, not a merged/deployed release or a beta readiness decision. The coordinator retains merge, exact deployment and joined-product acceptance ownership.


## Independent review correction

Independent review found that the first UI wording implied browser deletion after seven days. The copy now describes recovery eligibility and explicitly recommends clearing the browser draft on a shared device; the document distinguishes expiry from deletion. This changes no storage, authorization, retry or deletion behavior. Original executed receipts and their source hashes remain unchanged in the result index. A separate post-review source fingerprint and scoped replay receipt bind this wording correction; prior runs are not relabeled as executions of the later text.
