# Reliability program: assessment source admission

Owner: assessment lane; coordinator owns integration/release. ADP scope: partner admission and evidence review; no physical day-gate completion is claimed. Base revision `1b8d810ec117b93fe52fd323be052ddafa7070db`. No paid provider/model invocation, real notification, new private upload, or remote trace service was used.

## Frozen scope and denominator

`program-judgment.json` freezes 120 synthetic source-admission mutations: 15 documented evidence/source conditions crossed with eight consequential claim topics (action, completion, dimension, mass, force, reach, hygiene, capability). The actual production validator executes on each synthetic packet. Stable IDs, semantic SHA-256 values, source relationship, expected admission, provisional labels, and development/regression split are retained. Parameters were fixed in `scripts/reliability/judgment-cases.ts` before the baseline run; the portable JSON was materialized before repair. Acceptance is 120/120 admission controls with raw claim bytes preserved. Thresholds were not changed after failures.

This is 120 claim/source mutations, **not 120 independent videos, natural model outputs, base journeys, or perception samples**. Eight topics exercise consequential claim types but the guard does not inspect prose semantics. These cases do not contribute to the infrastructure, browser journey, upload transport, or publication denominators. All labels are PROVISIONAL agent-checked controls, awaiting independent review of their meaning. No untouched human-labeled holdout exists; no holdout was tuned.

## Reproduced failures and repair

| Failure | Impact / reproducibility | Root cause | Before / after |
| --- | --- | --- | --- |
| `JUD-action-occluded-estimate`, `JUD-action-absent-action`, crop/reorder siblings | P1 evidence provenance: a model-estimated/invisible or uncited-time event can be promoted to observed; deterministic isolated reproduction | Validator checked citation existence and clip duration, without checking a returned observed interval | Baseline admitted unsupported claim; repaired validator rejects it |
| `JUD-capability-owner-is-not-published`, video sibling | P1 evidence attribution: unsupported source class can become published robot/spec evidence; deterministic isolated reproduction | No published-source-kind check | Baseline admitted owner/video as published; repaired validator requires a knowledge/registry source |

The 120-case baseline executed 120, passed 64, failed 56, skipped 0, blocked 0. The same frozen 120 execute and pass after repair. Final replay repeats every case three times (360 attempts, still 120 unique); deterministic outcomes agree. This does not measure stochastic model disagreement. Neighbor cases cover a point observation with no interval end, zero time, interval beyond duration, supported siblings, nonfinite/negative references, and the unverified-entailment boundary. Existing SDK scripted tool loop, source admission/accounting, video provenance and cycle suites also pass: **152/152 checks** across five files. This total includes the 120 mutations, catalog-retention check, five new neighbors and 26 existing checks; it is not a count of unique journeys.

The repair preserves source packets and throws safe existing-style validation codes; it adds no migration, storage, auth or spending service. Observed claims must reference a returned observed interval; null-end observations support only their exact start. Operator statements/video cannot become published specifications. Knowledge/registry citation admission still does not establish that a field is genuinely published, measured, fresh, or true.

## Semantic limitation preserved as an executable diagnostic

`does not mistake interval admissibility for citation entailment` submits an invented safe dish-loading completion claim beside a synthetic rack-motion source. Citation admission still accepts it. That passing **diagnostic** demonstrates the remaining semantic gap; it is not a correctness pass for the assessment. Unsupported measurements/capabilities, conflicting or stale specifications, absent actions, safety, and citation entailment remain unscored against real model responses. A structurally valid observed interval cannot prove an event or guarantee safe automation. Unknown capability cannot establish robot incompatibility.

## Reference manifest and remaining gate

`program-reference-manifest.json` verifies six existing local recorded-simulation clips against the prior reference manifest; all six hashes match. Existing provisional sampled-frame descriptions remain attributed to the previous agent, not new human review. Clips are local development/regression fixtures and source licenses were not independently re-adjudicated for new transmission. No footage was sent anywhere. There are zero independently human-observed real-site labels and no untouched holdout. The minimum 12 real-site reference target has a shortfall of 12. The coordinator owns the newly selected dishwasher source and its current authorization; this lane did not reuse the other owner's fixture or budget.

The smallest quality dependency is a rights-admitted local/company-controlled source plus current owner observation labels (single review explicitly acceptable); live model execution additionally requires current program provider budget approval. Historical human gates are not reactivated. Offline source repairs can ship independently with honest semantic limits.

## Replay and recovery

With repository dependencies installed (`npm ci`; no provider keys required):

```bash
npx vitest run server/tests/site-assessment-evidence-mutations.test.ts server/tests/site-assessment.test.ts server/tests/site-assessment-integration.test.ts server/tests/site-video-judgment-provenance.test.ts server/tests/site-video-cycle-provenance.test.ts --maxWorkers=1 --minWorkers=1
npm run check
bash scripts/graphify/run-webapp-architecture-pilot.sh --no-viz
```

The mutation test writes ignored raw results to `output/reliability-program/judgment/results.json`. Retained baseline/candidate logs and results stay in the lane worktree under that same ignored folder; tracked `program-judgment-results.json` binds their hashes and counts for review. Restore source/catalog/manifests from Blueprint-owned Git and replay; no Library/session identity is canonical. Existing MP4 paths and hashes are in the reference manifest. Traces contain synthetic source IDs, no bearer links, video bytes, credentials or customer details.

Status: scoped code/test slice complete pending independent review and coordinator release. Assessment quality evaluation is partial/blocked by the specified reference/paid-run dependencies; no deployment or bounded-beta recommendation is asserted by this lane.
