# Supplemental scripted SDK replay of the unchanged semantic catalog

Owner: assessment lane. The original 120 typed fixture states in `server/tests/fixtures/site-assessment-mutations.ts` now run through the actual OpenAI Agents SDK Runner and video/history tools using scripted callbacks. This adds SDK source-construction, tool-error and packet-admission evidence to existing direct validator checks. It adds **no independent cases, real model judgments, video perception samples or customer publication proof**.

All original IDs, semantic hashes, source lineage, development/holdout strings, invariant/weaken/change/abstain relationships, repeat selections and PROVISIONAL truth labels remain unchanged. The synthetic holdout partition is not a human-observed untouched holdout. SDK namespaces change citation IDs, and a neutral synthetic operator context is added where required by the real SDK input contract; admitted observations, claims, timestamps and job placement remain faithful to the frozen fixture states.

## Executed baseline on deployed assessment source

Runtime: `eda83741bd06026f9ad4e9e8fa16417bdc1d432c`; assessment source SHA256 `a889137a97af596aeeb4f90a320993bb7765e4bf43b8a03af232ea3460edcfba`. Unchanged fixture SHA256 `7d3f86a4b91b0e61e2517730260cd1d6901cdb0098febae1c02d4b4a77d14731`. Supplemental runner SHA256 `b6a93c5a9bdde851739e611d210f08f315fa701b13ccdf8f01fb77ff66d1ebe5`.

Generated/deduplicated/attempted: 120/120/120. There are 264 scripted attempts under the catalog's existing repeat selections; repeats do not increase the denominator. The 72 pre-existing structural admission controls pass. The 48 pre-existing semantic-only states remain partial even when a software guard rejects their packets. There are zero skipped/blocked attempts, zero live provider calls and zero scored accuracy samples. Local SDK timings are not model/customer latency; no model cost is estimated from fake usage.

| Family | Original unique states | SDK acceptance result | Evaluation interpretation |
| --- | ---: | --- | --- |
| Ambiguous/occluded | 12 | All rejected | Structural admission controls pass |
| Absent action | 12 | All rejected | Structural admission controls pass |
| Cropped evidence | 12 | All rejected | Structural admission controls pass |
| Reordered evidence | 12 | 6 accepted, 6 rejected | Array-order invariance and reversed-time rejection pass |
| Unsupported dimensions | 12 | All rejected | Measured-video source guard executes; truth labels remain provisional/partial |
| Unsupported robot capability | 12 | All rejected | Operator-as-published source guard executes |
| Conflicting statements | 12 | All accepted | Consequential false conclusion relative to synthetic sources; semantic partial |
| Stale specifications in job | 12 | All accepted | Narrow known-only applicability guard does not cover job placement; semantic partial |
| Citation non-entailment | 12 | All accepted | Observation interval exists but claims a different event; semantic partial |
| Source-preserving positive | 12 | All accepted | Structural admission controls pass |

Repeated outcomes agree. SDK packet acceptance is not durable storage or customer publication. Provider outputs are deliberately scripted, so a fabricated conclusion is an executable admission counterexample, not evidence that a natural model produced it.

## Actionable minimized findings

`J-stale_specifications-e83af5c28bb3` accepts `Current robot payload is 12 kg` in `assessment.job[0]` from explicit non-current knowledge with a superseded correction. This is the same explicit applicability invariant as the known-field repair, in another factual field. The source metadata itself remains accessible. Root authorized a separate minimal recursive published-source applicability repair; the supplemental harness is kept separate from that production slice.

`J-conflicting_statements-e7563cdd6000` accepts `Owner says Bin is stacked; specification requires a different result; video proves success` beside bin-onto-table observations and an explicit conflicting specification. `J-citation_non_entailment-9274a838d37c` accepts `Bin is stacked` beside only bin-onto-table evidence. These remain open semantic entailment defects. No generic prose/numeric heuristic, schema expansion or model prompt tuning was added.

## Receipts and replay

Ignored canonical lane receipts: `output/reliability-program/semantic-sdk-120/results.json` (SHA256 `3fcb39997d98120ece896f34c62d52e9893193b338a8c7d5982ed90123c97a0a`), `sdk.log`, `typecheck.log`, `graphify.log`. Baseline focused 120 tests, typecheck, Graphify and diff check pass. These counts overlap the original catalog and must not be added as another 120 variants.

```bash
mkdir -p output/reliability-program/semantic-sdk-120
RELIABILITY_C_SDK_OUTPUT=output/reliability-program/semantic-sdk-120 npx vitest run server/tests/site-assessment-mutations-sdk.test.ts --maxWorkers=1 --minWorkers=1
```

Dependencies: existing `npm ci`; no provider keys, video bytes, emulator or customer fixture required. Code/fixture/doc in Blueprint-owned Git are portable; retain raw scripted traces privately under the ignored output path and verify hashes. No signed URL, personal details, private customer footage or hidden reasoning is present in this supplemental dataset. Root owns integration, release and final evidence accounting.
