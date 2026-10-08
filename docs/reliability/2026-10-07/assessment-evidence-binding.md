# Assessment evidence binding v2

Scope: the two existing P1 counterexamples, `V2-conflicting-owner-spec-video` and `V5-admitted-field-wrong-claim`. This repairs the derived factual publication boundary. It does not improve or certify model reasoning, video perception, robot suitability, or human reference labels.

## Contract and compatibility

New packets use `site_assessment.v2`, with `verification.format=assessment_evidence_binding.v1`. A citation may select a zero-based video observation, a registry capability field, a fetched knowledge-content leaf, or an operator statement. Missing selectors stay parseable for older responses/records, but cannot establish a source-bound fact. The host checks the selected observation basis/interval or the selected registry field's own value/provenance, then renders factual wording from that data. Arbitrary model prose cannot be laundered through a valid selector.

The original parsed model assessment is retained separately as `raw_model_assessment` inside the existing private assessment artifact. Provider responses continue through the existing protected receipt path. Unknown/estimate interpretations remain explicitly labeled, and source records are not changed. Video reports retain uncertainty and unobservable items; they establish neither calibrated measurements nor robot capability. A knowledge leaf states what the fetched record says, not verified site fit. Knowledge without an admitted per-field measurement contract cannot become a source-bound measured claim.

Unbound factual claims become unknown/unverified. The assessment uses the existing `needs_operator_input` recovery status and a safe evidence-research next step. Model approach dispositions become `needs_evidence`; next actions use bounded advisory wording, and a model `no_robot` verdict becomes research with manual work retained as an option. A correctly selected reach field does not establish universal exclusion. Recommendations are explicitly `advisory_review_required`, including in the returned assessment, and raw original recommendations remain retained. This lane has no physical-trial decision DTO that could validate stronger conclusions.

The actual adapter stores the entire packet opaquely and publishes only the derived `packet.assessment` as run output. Its prior-assessment input remains question context, with independently admitted sources. Existing `site_assessment.v1` records are not rewritten, deleted or silently upgraded; the actual admin output consumer displays a visible legacy-unverified notice. Existing admin authorization and private bundle persistence remain unchanged. No database migration, provider call, video upload or new storage destination is introduced. The source/schema/task/client code in Blueprint-owned Git plus portable private JSON packets remain the recovery route.

## Executed evidence and expectation correction

Baseline source is exact `d21721d94aad50c0314d2e10875c3b022841c689`, SHA256 `509fa43bb86fadcacccf4d3d9a8b219197d63c0a86e356145066b54ce9e3ed01`. Both unchanged SDK cases accepted false factual prose relative to their synthetic sources. The baseline harness records these as semantic-partial, so its green exit is not a passing entailment verdict. Baseline receipt: `output/reliability-program/semantic-entailment-d217-baseline/results.json`, SHA256 `055469c1b5a72c047d8adec7d1cfd2edc26fc32bd7034e65a678d309de43219e`.

Candidate source SHA256 `2260d77d6b3940fea257b19284b3b289c3c582b524ba68abf55b8b1de405f950`. The same two cases keep identical semantic hashes, admitted sources/tool receipts, scripted provider outputs and original assessment text. Their derived facts now become unknown/unverified and the visible assessment requests unresolved evidence. `C-semantic-sdk.v10` explicitly records this publication-boundary correction alongside the prior V9 applicability correction. It preserves original semantic-partial status; no synthetic truth label becomes gold or an accuracy sample. Final 30-case receipt: `output/reliability-program/semantic-evidence-binding-final/results.json`.

The existing frozen 120 typed mutation states replayed through the actual SDK with the unchanged supplemental harness: 120 attempted, 264 scripted invocations, 72 original structural controls passing, 48 original truth-partial labels unchanged, and 12/12 stale-source admission controls passing. All 264 semantic/input hashes, source/tool receipts and scripted outputs match the prior applicability candidate; every accepted original packet matches the retained raw model assessment. There are 90 accepted attempts and 174 admission rejections. The 90 accepted packets have no selectors, so every one weakens its factual claim and uses evidence recovery. This demonstrates safe legacy weakening, **not useful positively bound assessment output**. Separate derived outcomes are in `output/reliability-program/semantic-evidence-binding-120/publication-results.json`; the full prior receipts remain unchanged.

Useful bound output is demonstrated by an additional regression using actual SDK/tool handlers with scripted providers: selected rack movement and qualified `reachM:1` display source-derived facts despite deliberately false model prose. Three independent fresh processes agree. These are repeated neighboring assertions, not new unique catalog cases. Other neighbors cover invalid/estimated observation selectors, qualified siblings, measured/published grades, historical unknown/estimate context, nested claims, inherited/missing knowledge leaves, unsupported video measurements, and an unsupported exclusion/no-robot decision beside a truthful field. The admin consumer tests distinguish v1 and v2 without writes.

Validation: frozen SDK30 passes; six focused suites pass 177 assertions; typed SDK120 replay passes; three selected positive binding processes pass; typecheck, Graphify, portability static audit and diff check pass. These layers overlap existing cases and are not added together as independent coverage. All execution is offline/scripted, with no storage/customer publication execution or provider cost/latency measurement. Source fingerprints identify the executed working bytes; receipt `codeSha` identifies the pre-commit checkout and must not be confused with a deployed revision.

## Replay

Use existing `npm ci`. Fresh private output directories are required; do not overwrite retained receipts. No provider keys or video bytes are needed.

```bash
umask 077
case_output=$(mktemp -d output/reliability-program/evidence-binding-replay.XXXXXX)
env -i PATH="$PATH" TMPDIR="${TMPDIR:-/tmp}" NODE_ENV=test RELIABILITY_C_V2_OUTPUT="$case_output" ./node_modules/.bin/vitest run server/tests/site-assessment-semantic-sdk.test.ts --maxWorkers=1 --minWorkers=1
./node_modules/.bin/vitest run server/tests/site-assessment-evidence-binding.test.ts client/tests/components/admin/AdminAgentConsole.test.tsx --maxWorkers=1 --minWorkers=1
```

The separate unchanged supplemental SDK120 harness is [published in company Git at `6b34d0ec`](https://github.com/ognjhunt/Blueprint-WebApp/blob/6b34d0ec43c1a1d3e83bca659accbf40af3b2f8f/server/tests/site-assessment-mutations-sdk.test.ts), not added to the minimal production slice. Its SHA256 `3180dd8a129426eefcc2c5f956c2d087976387ee20bcba04e2817020183be609` is byte-identical to original local supplemental commit `ab9b2df3`, which is not independently available from GitHub. Fetch the published coordinator branch `codex/reliability-program-20261007` to recover these bytes; do not treat the local commit as the remote recovery route. Its replay command uses `RELIABILITY_C_SDK_OUTPUT` and `server/tests/site-assessment-mutations-sdk.test.ts`. Root owns independent review, integration, required CI and deployed acceptance. At this artifact's freeze there is no merge or deployment claim. Reference-video quality and freeform interpretation entailment remain unscored.

## Independent review correction

Initial candidate `0167dcabb9f09b120353fb14016e3d82d3856851` used source fingerprint `2260d77d...`. Review identified retained model strings in approach descriptions/checks and question presuppositions. The final correction explicitly tags each approach and question as an unverified interpretation, lists those free-string fields in packet metadata, and makes that status visible in the actual admin consumer. These fields do not become source-bound facts. Original text remains retained; no prose heuristic is introduced.

Corrected source SHA256 is `5a5365c639b0e6224f88594c427b2b2905cfbb820aff2e2dce345cf59e1f805c`. Fresh corrected SDK30/binding/admin checks pass 52 assertions; SDK120 repeats the same 120/264/72-structural/48-partial/12-applicability counts. Three corrected bound SDK processes produce identical private receipts, including the serialized strict SDK output schema. Its recursively inspected object schemas require every property and forbid additional properties; legacy parser optionality does not weaken the provider's required nullable selector field in the current SDK. This is local serialization proof, not a paid live provider call.

Corrected private receipts beneath `output/reliability-program/`:

| Receipt | SHA256 |
| --- | --- |
| `semantic-evidence-binding-reviewed/results.json` | `f04caabdf2d00b009ca5fe1a0a48b7cf7409f82c60a71b5726058ccde3952070` |
| `semantic-evidence-binding-120-reviewed/results.json` | `590f7395007d8bfb2baa746c44d8df374885543f5beb74b4dd4d92ec81ede70b` |
| `semantic-evidence-binding-120-reviewed/publication-results.json` | `5314361085a4ab061f80649f39025d430c656566dfadeebb813ac0d00c21e4cc` |
| `semantic-evidence-binding-reviewed/minimized-decision.json` | `87e9ab9b99d1c5e24109a62ad5d2b2d84b0ab4ac0fc8344171fe98b669b1cfb1` |
| `semantic-evidence-binding-reviewed/bound-repeat-{1,2,3}/results.json` | `83df0be5aca60f77aeb0a025c74ddc8e6129b982d562c55f443775e82eb185d1` each |

The minimized decision reproducer runs the unchanged legacy validator (body byte-identical to exact d217) followed by the v2 renderer: the validator admits a selected truthful reach field beside an unsupported exclusion/no-robot conclusion, while the renderer returns `needs_evidence`/research and a source-derived reason. It is an isolated validation/rendering counterexample, not an old production/customer publication trace. The two original P1 SDK reproductions preserve their raw outputs, sources and semantic hashes. Catalog input hashes cover fixture parameters/evidence/operator/scripted claims/tool steps/placement; they do not cover the changed SDK instructions or derived output. No natural-model matched A/B claim is made. Earlier receipts remain immutable.
