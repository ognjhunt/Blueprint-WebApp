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

## Explicit V2 admission correction and repair replay

The baseline above remains unchanged. Supplemental admission assertion version `published-applicability.v2` now requires rejection of the same 12 stale-specification job claims. The report explicitly lists every affected case, its original `not_a_semantic_oracle` structural expectation, original PROVISIONAL label, baseline accepted outcome and candidate required error. This changes an admission assertion after a demonstrated scope gap; it does **not** change a video truth label, source relationship, source split or semantic accuracy threshold. All original truth labels remain `judgment-rubric.v1` / PROVISIONAL.

Minimal production candidate `a980884bb19a5481e2b9303db3c92a05d47fd048` on exact `eda83741bd06026f9ad4e9e8fa16417bdc1d432c` extends the explicit `current:false` published-source veto recursively. Known facts keep their existing error; other locations use `assessment_published_source_not_current`. The production slice contains only the validator change and self-contained placement tests, not this supplemental harness. Source SHA256 is `509fa43bb86fadcacccf4d3d9a8b219197d63c0a86e356145066b54ce9e3ed01`. It introduces no prose heuristic, date threshold, schema or missing/string flag coercion. Historical source bytes remain accessible under unknown/estimate claims.

Candidate supplemental execution used a byte-identical temporary overlay of that exact committed production source in the separate supplemental worktree. The report's `codeSha` (`dacefc944573885784ca80a1e5bbb4ce18e65372`) identifies the supplemental checkout, while `runtimeSourceSha256` identifies the executed candidate; those identities must not be conflated. Source identity was checked against the committed production candidate. The supplemental branch subsequently depends on that production repair so its assertion is not quietly conditional on old behavior.

All 120 existing states and 264 scripted attempts execute: 72 original structural controls pass, all 12 supplemental applicability admission assertions pass, and the original 48 semantic labels remain partial/unscored. Twelve formerly accepted stale job packets now reject. Every before/after semantic hash, actual-input hash and admitted source/tool receipt object is unchanged. Repeated outcomes agree. The unsupported-dimension, contradiction and non-entailment interpretation remains provisional; no natural-model behavior or customer publication is certified.

Candidate ignored receipt `output/reliability-program/semantic-sdk-120-candidate/results.json` SHA256 `3cae823de4ae182c201027f58eaac2136f93bf425452e5ce692515d840f93f04`; adjacent `sdk.log` retains the 120-test result. Production baseline placement replay is seven failures/eight passes; candidate 15/15 passes. Six focused production suites pass 191/191, including the unchanged 30 SDK diagnostics. Typecheck, Graphify and diff check pass in the production worktree. These are overlapping evidence layers, not another set of independent semantic variants.

Replay the supplemental command above only with the recursive applicability repair present. Root owns independent review, required CI, merge and exact deployed verification. Two semantic entailment defects remain open; historical contextual facts and missing capabilities are not silently turned into unsupported fit conclusions.
