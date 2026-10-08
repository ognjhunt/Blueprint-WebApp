# Reliability queue slice: executed evidence

This slice fixes a reproducible customer draft-recovery starvation bug and keeps malformed email acknowledgements unknown. It does not establish production assessment or video-perception accuracy. Charter: `program-charter.md` in the integration branch. Canonical portable case catalog, result summary and failure ledger: `program-queue.json` beside this file; code, versioned expectations and replay live in this Git repository. Private raw output is ignored under `output/reliability-program/queue/`; replacement agents can regenerate it with the commands below. No provider-only artifact or new service is required.

## Scope and frozen denominators

Baseline source was `1b8d810ec117b93fe52fd323be052ddafa7070db`. Final v2 definitions and outcomes were fixed in `server/tests/helpers/reliability-queue-cases.ts` before the matched v2 baseline/candidate execution. There are **150 distinct semantic condition combinations**, 30 each in ordering, storage dependencies, provider failures, worker lifecycle, and notifications/accounting. These are not 150 full customer journeys. Seeds, generated identifiers, extra assertions, duplicate retries and the older 640 schedule permutations add no independent cases.

There are **20 additional joined producer/worker/status/notification traces**: five evidence-output conditions crossed with four boundaries (happy, local persisted-state restore after producer, withdrawal during provider, source replacement during provider). They execute real `enqueueCoverageReview`, `reconcileCoverageReviews`, `reviewCaptureCoverage`, `recordCoverageFinding`, status projection and outbox handlers. They use synthetic model outputs, an object-interface stub, local email sink and the existing serialized in-memory Firestore fake. Five traces save local JSON, clear simulated storage, restore it and reenter the worker. This demonstrates retained-state reentry, not OS process termination, actual browser restart, Firestore durability or Firebase emulator execution. Queue/publication integration must not substitute for the coordinator's normal-UI browser traces.

## Baseline and candidate

The corrected baseline executed all 150 cases: **135 pass, 15 fail**. Candidate: **150 pass, zero fail/skip/block/partial**. All 20 joined traces pass baseline and candidate, so their result is fresh integration proof rather than a new bug claim. Three candidate runs of all 170 cases/traces passed without disagreement; repeats add zero independent samples. Synthetic deterministic success is not model consistency or live provider reliability.

A harness-only correction is retained explicitly: the initial run was 129 pass/21 fail. Six extra failures came from `vi.restoreAllMocks` clearing the fake provider's call history before a no-resend assertion. Restoring just the dependency fault spy yielded 135/15 on unchanged baseline runtime. Expected product outcomes and thresholds did not change. Initial and corrected raw reports remain in ignored local output.

Independent review then invalidated eight v1 rows for fault-coverage credit: three enqueue rows varied an unused attempt parameter (two duplicates), and six worker fault rows reached budget exhaustion before the intended fault. Catalog v2 replaces those with three actually exercised enqueue outcomes (unavailable, permission denied, existing duplicate) and runnable attempt budgets for the six faults. Exhausted-budget cases that remain are explicitly labeled as refusal/protection cases. The final v2 catalog was frozen and rerun against exact baseline runtime and candidate; it independently produced 135/15 then 150/0. Coverage floors and expected safety outcomes did not change. V1 is retained as preliminary superseded accounting, not final scored coverage.

Focused neighboring validation: **259/259** checks passed, including the program suites, existing outbox recovery/concurrency checks, beta/audit recovery, coverage budget and customer status projection. The preexisting one test containing 640 schedules remains one check, and its schedules do not inflate this program's unique-case denominator. `npm run check` also passed. Full required release checks and exact merged/deployed receipts are coordinator gates.

## Repairs and limits

- **REL-QUEUE-001 / P2:** held leases could fill the first pending batch while later ready customer drafts wait across repeated recovery passes. This proves recovery delay while those leases remain held, not permanent loss under normal bounded leases. Minimized baseline: a held `aaa` document, ready `rq`, batch size one, two recovery passes. All three attempt-budget variants failed baseline. `captureReviewRecovery` now reuses the existing durable `automationBatch` cursor and wraps an exhausted scan immediately. All three same cases and neighboring recovery tests pass. No attempt budgets reset and no current lease is stolen.
- **REL-QUEUE-002 / P2:** a malformed email adapter acceptance with absent/empty/numeric message ID was marked sent; null output threw after dispatch. Twelve baseline variants failed. `captureOutbox` now validates a boolean acceptance and usable provider/message identity; malformed evidence becomes `unknown`, retains its receipt, and never authorizes resend. All twelve same cases and accepted/rejected/unknown/late/stale receipt neighbors pass. This is a synthetic boundary defect, not an observed production Resend incident.

No paid live call or real email was attempted; live cost is reported as not measured rather than fabricated zero-dollar provider receipts. No fixtures, usage or records from the separate dishwasher owner were reused. Raw fixture snapshots contain only synthetic test data and remain local/ignored. Source hashes accompany results when HEAD alone would omit dirty tested source.

## Replay

Prerequisite: the repository's normal installed Node dependencies. No secrets, production dotenv, service provisioning or provider credentials are needed; Vitest mocks storage, model and email boundaries. Run from the checkout root:

```bash
npx vitest run server/tests/reliability-program-queue.test.ts server/tests/reliability-program-worker-journeys.test.ts --maxWorkers=1
npm run check
```

Use `RELIABILITY_QUEUE_OUTPUT=output/reliability-program/queue/replay-name` to keep distinct private replay artifacts. The generated catalog has stable IDs/full SHA-256 hashes and meaningful parameters; `results.json` retains counts, source hashes, elapsed fake-layer time and sanitized durable states; `worker-journeys.json` retains correlated synthetic IDs and observable transitions. Latency here is local fake-layer latency, never production/provider performance. For a minimized replay, use Vitest `-t` with a stable case ID from the canonical catalog.

Status: scoped code repaired and locally evaluated. Independent review, integration required checks, merge, deployment and deployed behavior remain with the coordinator. No bounded beta or full-goal completion claim follows from this slice alone.


## PR940 current-authority prerequisite correction

PR940's actual dispatch check correctly cancels capture-derived notices when the inbound request is absent. The older catalog only created outbox rows. On exact relevant dispatcher sources from `2e5abb97a9618bc2ee8c3be640c1979ddca45737`, this reproduced **81/150 pass, 69 fail**; **zero of 30 provider variants reached the adapter**. The failed coordinator log remains at `output/reliability-program/combined-2e5-core.log`. These failures demonstrate an invalid fixture prerequisite, not a weakened product safeguard or a new provider incident.

The fixture now seeds explicit current recording consent and a synthetic source-bound capture request before dispatch. The real capture-notice authority remains unmocked, and each provider-failure case must call the adapter exactly once on its first delivery. Replaying the same frozen definitions on the same dispatch runtime passes **150/150**, with **30/30 provider boundaries reached**. All IDs, semantic hashes, parameters and expected transitions are byte-identical to the prior catalog; no case credit or acceptance threshold changed. Original source-repair before/after evidence above remains separate.

`program-queue.json.fixturePrerequisiteCorrection` preserves counts, exact source hashes and private replay paths. Only the relevant dispatcher sources were temporarily overlaid from the exact Git object in the author worktree and then restored; no runtime edit is committed. Storage/email remain simulated. Run the existing replay command on an integrated PR940 runtime; no credentials, provider calls, customer sends or new budget are needed. The helper source hash now identifies the corrected prerequisite. `providerFaultReached` in each provider trace records the explicit reached-boundary assertion. Existing guard tests and other peer fixtures remain separately owned.
