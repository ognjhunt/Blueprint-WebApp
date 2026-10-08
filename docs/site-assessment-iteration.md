# Local production assessment iteration

Owner instruction: the October 8 fast-iteration goal authorizes this narrow engineering tool. The owner subsequently approved provider iteration on the retained dishwasher and explicitly removed all spending approval/cap gates. Customer dispatch, new upload, notification, access grants, and a second agent remain outside this tool. Integration/release ownership remains task `01a119be-86a2-7db2-b469-b8e1f6b11e4d`; dishwasher upload/acceptance remains `01a11919-055b-727e-a26b-744383484002`.

From the checkout containing this change:

```bash
npm run assessment:iterate -- --help
npm run assessment:iterate -- --mode fresh-video --input INPUT.json --output output/assessment-iteration/baseline
npm run assessment:iterate -- --mode saved-evidence --input INPUT.json --evidence output/assessment-iteration/baseline/evidence.json --output output/assessment-iteration/after
npm run assessment:iterate -- --compare output/assessment-iteration/baseline output/assessment-iteration/after --output output/assessment-iteration/comparison.json
```

`INPUT.json` is a private file with the existing adapter input, for example:

```json
{
  "message": "Assess the admitted recording against the supplied site task; preserve unobserved endpoints.",
  "context": { "request_id": "THE_EXISTING_AUTHORIZED_REQUEST_ID" },
  "video_binding": { "sha256": "THE_VERIFIED_64_CHARACTER_VIDEO_SHA256", "bytes": 60035801 },
  "retention": {
    "local_evidence_allowed": true,
    "authority_ref": "THE_RECORDED_SOURCE_RETENTION_PERMISSION",
    "expires_at_ms": 0
  }
}
```

Set the retention expiration to the actual permitted deadline; the example zero grants no retention. This is a data-use permission, not spending approval.

Provider modes require the exact authorized video hash/byte binding through `video_binding` or `local_video`. `video_binding` has no filesystem path, so the same source can run in the already-configured cloud runtime without copying a key or uploading the video again. An optional `local_video` object contains `path`, `sha256` and `bytes`; it additionally checks local bytes against the supplied hash. Conflicting bindings fail before adapter dispatch. Both forms are checked against the current source admitted from Storage before any model call. It never replaces Storage evidence or uploads the file. Do not supply `advisory_job_id`, a customer claim, a prior run, or the original dishwasher allocation. A file marked `execution_scope: "read-only-preflight"` is rejected in both provider modes.

There is no build, dev server, deployment, or full CI prerequisite. Each command starts `tsx` from current source, so the next assessment-prompt edit is loaded immediately. The four production tools, Sol model, Gemini path, output schema, source formatter and guards are unchanged. No model override is offered. The local CLI calls `runSiteAssessmentTask` in `server/agents/adapters/site-assessment.ts`, then the existing `createSiteAssessmentAgent(...).run()` and SDK `Runner`. `server/agents/runtime.ts` uses the same adapter; there is no `SDKAgentRunner` class in the inspected main revision. `agent:cli` addresses agent-access APIs; `smoke:agent` is another runtime smoke, neither runs this pipeline.

## Scope and prerequisites

Both provider modes need the existing OpenAI API credential, Firebase Admin configuration, enabled site-video lane, and a currently published, rights/privacy-admitted website capture. Encrypted request fields also need the existing field-encryption configuration and the existing principal's decrypt access. Fresh mode additionally needs the existing Gemini credential. `BLUEPRINT_ENV_FILE` can reference an already authorized environment file. The runner itself neither copies nor creates credentials; the owner separately authorized configuring the existing production OpenAI key in the private, ignored local `.env.local` file. Logging uses a plain transport for the standalone process. No existing development logger repair is included.

Live Firestore/Storage reads and the original pinned generation, manifest/marker verification, current rights/privacy, context and byte checks stay in the production adapter. They run again before every paid dispatch. Missing or changed authority fails closed. This loop cannot accept an arbitrary local clip without its existing admitted source record.

The only persistence substitution is the trusted local experiment host's accounting I/O, replacing ordinary customer `agentRuns`/capture bookkeeping with private `accounting.json` in the run directory. It does not create synthetic customer records or remove source admission. All corpus/registry tools keep existing read scope. Optional paid embeddings are disabled explicitly, so the only paid providers admitted are Sol and Gemini; this difference is recorded. No scheduler, customer status route, notification, job dispatch or report delivery runs. Experiments do not prove that orchestration/integration works.

For a video-discovery diagnostic, add `"model_context": "video-only"` to the private input. After validating the actual stored source, rights, privacy and context, the adapter omits operator statements, host instructions, prior assessments and site task/location metadata from model input. The same source identity, video bytes, current-context checks and authorized knowledge scope remain. Stored customer records are untouched. This explicit input suppression is recorded in `run.scope` and source provenance; it is **not production-context parity**. Sol asks Gemini to identify the visible setting, objects and activity before choosing focused follow-ups. The intended job and success criteria remain unknown unless established separately.

Use fresh mode first for this diagnostic. Description-conditioned evidence has a different operator-context hash and is rejected before any model call; never relabel it as video-only evidence. A subsequent saved run can reuse the diagnostic's own evidence only while all bindings remain valid. Existing dishwasher experiments used a recorded statement naming the task, so they do not demonstrate discovery from an undescribed video.

## Accounting without spending gates

The owner explicitly removed spending approval, dollar caps, call allowances and unknown-charge spending denials. Neither provider mode requires an allocation file or `--approved-budget`. Sol and fresh Gemini calls have no default count limit: the former twelve-turn SDK ceiling and two-unchanged-probe stop are removed. Sol has no application-set response-token ceiling; the SDK request omits `max_output_tokens`. There is no implicit assessment deadline. Explicit host deadlines/cancellation, provider request timeouts/context limits and source/rights/privacy/retention checks still apply. Identical video queries reuse their exact source-bound cache. No automatic retry of a failed or uncertain provider call is added.

Each run writes `accounting.json` atomically and fsyncs it before dispatch. Calls append a distinct accounting row containing model, provider, exposure estimate and usage state. Missing responses stay `admitted`; returned responses without usable usage stay `unknown`. Sol's historical 8,192-output-token reference remains only an accounting estimate, explicitly marked as having no enforced output ceiling or finite maximum spend bound. Unresolved Sol usage remains unresolved in existing telemetry; known subtotals and positive reservation estimates are preserved. Later calls append rows without resetting earlier unknowns or pretending they cost zero. Known usage remains a pricing estimate, not a provider invoice. Existing original dishwasher records are neither read as an allowance nor modified by the local accounting I/O.

The run directory must be new and cannot overwrite an earlier experiment. Source binding, accounting integrity and permitted retention are rechecked at dispatch. Cost visibility never becomes a customer spending question. Monetary gate removal in shared production admission is coordinated with the integration owner; this CLI uses the same production assessment adapter and accounting model as that release.

## Saved evidence and inspection

Fresh mode calls the real Gemini `analyseAgenticVideo` and production Sol SDK. A successful, retention-permitted analysis produces `evidence.json` even if a later SDK stage fails. The record retains exact source bytes/hash/generation, request/capture/source key, analysis implementation/schema hash, exact question/inspection, normalized operator-statement digest, exact prompt hash, requested Gemini model and returned version when available, timestamps, provider response binding and content digest. Run-local conversation IDs are normalized for reuse; all statement text and non-run provenance remain bound.

Saved mode loads only this compatible, source-bound record, injects the original retained video sources through the existing seam, and still invokes **paid production Sol**. It never calls Gemini. A different source, operator statement, analysis configuration/schema/tool implementation, expired retention or damaged binding requires fresh evidence. If the agent asks a question/inspection absent from the saved record, the run pauses/fails with `experiment_saved_evidence_miss`; it cannot silently answer a different question. It does not retest upload, Gemini perception or complete production integration. Assessment-only prompt edits can use the same evidence. A record with redacted/changed analysis text is retained for inspection but cannot become a reusable cache. Raw Gemini JSON is validated with the same production parser and timestamp checks; harmless extra metadata remains in the raw response while the admitted evidence uses the production schema. Mocked observations and provisional frame descriptions are not real Gemini evidence.

Each new, private run directory contains `run.json`, `summary.md`, and, when available, `assessment.json` and `evidence.json`. `run.json` includes validated sanitized input, code commit/dirty patch hash, SDK/dependency/prompt/schema/tool hashes, model IDs, source/admission, tool/provider responses, output/error, timestamps/wall time, usage/known estimates, run-local accounting and unknown state. Hidden reasoning, credential fields, personal email addresses and access URL query strings are removed. Owned denial codes and schema paths remain readable; arbitrary error prose/stacks/headers/bodies are not copied. Failures exit nonzero. If assessment succeeds but evidence retention fails, the wrapper records failed at the evidence-retention stage while retaining the SDK result and cost; comparison preserves that distinction. Restrict local filesystem access and honor the recorded retention expiration; no deletion or archival job is added.

Comparison lists changed conclusions, evidence references, missing facts/questions, uncertainty and verification outcomes alongside cost/usage, accounting records and latency. It includes runtime failures. A lost adapter response leaves usage/charges unresolved; failed ledger finalization fails the wrapper and preserves its last durable accounting snapshot for reconciliation. Neither can be reported as no dispatch or a completed experiment. Comparison does **not** declare an improvement from text changes or model agreement. Use the authorized operator's success criteria and actual visible evidence to adjudicate changes; unknown expectations stay unknown.

## Verified example and current limits

The authorized read-only dishwasher input was prepared privately under `output/assessment-iteration/dishwasher.preflight.input.json`. Its `execution_scope` prevents use in either paid mode. This real command was run:

```bash
npm run assessment:iterate -- --preflight --input output/assessment-iteration/dishwasher.preflight.input.json --output output/assessment-iteration/dishwasher-preflight-2
```

The local file is 60,035,801 bytes, SHA256 `c549b3b358fb3abe4248c81d20f28794e398ae2685fbbae990851941e639fedd`; the preflight checks exact request metadata and local hash only. It does not invoke the model adapter. These private files are ignored, not public fixtures. The production owner already achieved upload; original customer-workflow failures and unresolved charges remain separate from these experiments.

The private authorized provider input is `output/assessment-iteration/dishwasher.iteration.input.json`; it contains that verified binding and the permitted retention deadline. Both real modes completed on October 8 without a deployment between them:

```bash
npm run assessment:iterate -- --mode fresh-video --input output/assessment-iteration/dishwasher.iteration.input.json --output output/assessment-iteration/baseline-fresh-2
npm run assessment:iterate -- --mode saved-evidence --input output/assessment-iteration/dishwasher.iteration.input.json --evidence output/assessment-iteration/baseline-fresh-2/evidence.json --output output/assessment-iteration/after-saved-1
npm run assessment:iterate -- --compare output/assessment-iteration/baseline-fresh-2 output/assessment-iteration/after-saved-1 --output output/assessment-iteration/before-after-1.json
```

Those directories are retained receipts; use new output names to rerun. Fresh baseline: six Sol calls and one Gemini call, 106,954 ms, $0.102680 usage-price estimate. The next local assessment-only prompt edit was exercised in the saved rerun: three Sol calls, no Gemini call, 62,538 ms, $0.0591725 estimate. Source and analysis hashes matched, and both had zero invalid claim bindings. Repeated searches against unavailable knowledge access fell from three to one; the rerun explicitly reported that access gap. `quality-observation-1.json` records this limited improvement. Cost/latency differences also reflect skipping Gemini, so they are not attributed solely to the prompt. This single authorized development source supplies no general accuracy score or verified robot suitability.

The first fresh command failed before admission because the Mac lacked the existing KMS key-name configuration; its ledger has no calls. That configuration was loaded securely, without a new key or grant. A further read-only diagnosis found that the local TypeScript runtime's dynamic Firebase import hid its database export. The existing scoped knowledge binding was valid. Shared import repairs restore that exact scope without widening or renewing it. Production esbuild preserves the original named export; this local defect alone does not establish a website failure.

The later removal of the Gemini probe-count gate changes the recorded analysis implementation hash. The above historical evidence must therefore fail reuse against that changed version; create a new fresh run and use its resulting `evidence.json`. No artifact is relabeled to evade compatibility checks.

The coordinated recheck completed on October 8. `fresh-unbounded-1` used eleven Sol calls and one Gemini call, 130,562 ms and $0.18075075 estimated cost. `after-unbounded-saved-1` used its exact evidence after a local assessment-prompt edit: seven Sol calls, zero Gemini calls, 79,706 ms and $0.1190325. Both had complete accounting and no unknown local charges. These context-bearing runs exposed repeated knowledge cursor errors: the second run still passed the string `"null"`, rather than JSON null. Prompt guidance alone did not fix that defect. The scoped tool correction treats only that absence marker as null; real cursors retain backend source/query/access binding checks. `before-after-unbounded-1.json` retains the comparison without claiming accuracy improvement.

The same authorized source then ran with explicit video-only input on reviewed commit `cc23d826f732cbcdc13e288b091c159b6d4163a0`:

```bash
npm run assessment:iterate -- --mode fresh-video --input output/assessment-iteration/video-only.iteration.input.json --output output/assessment-iteration/video-only-fresh-1
```

This diagnostic completed in 107,293 ms with six Sol calls and one Gemini call, all recorded, $0.190595 usage-price estimate. The first tool call asked Gemini generally to identify the setting, objects, people and activity without assuming the intended job; Gemini identified a dishwasher and described door/rack motions before any knowledge search. There were zero operator sources. Sol asked the site to distinguish door/rack operation from loading or unloading and define the intended finished state. Corrected knowledge searches returned twenty and four rows, and an original capability record was fetched. This establishes working retrieval and initial video discovery for this clip, not general perception accuracy or robot suitability. The guard retained five bound, two unverified and eleven interpretation claims, leaving the unsupported claims visible. A real adapter attempt to reuse the description-informed cache in video-only context failed with `experiment_analysis_context_changed`, zero calls and nonzero exit (`video-only-conditioned-cache-denial`).

All five completed local provider runs total $0.65223075 in usage-price estimates, thirty-three Sol calls and three Gemini calls; original website failures and unknown charges remain separate. Private receipts remain under `output/assessment-iteration/`; retention is not renewed by rerunning. The local provider actor was returned to the integration owner after terminal reconciliation. Production release still requires coordinated lifecycle compatibility and customer evidence-persistence repairs. Neither mode nor the diagnostic establishes upload-to-final-output customer acceptance or physical evaluation. Missing operator success/workload facts are actionable questions, not blanket preparation stops; the agent names the affected decision while proposing preparation that can proceed.

Offline safeguards:

```bash
npm exec vitest run server/tests/assessment-experiment.test.ts server/tests/site-assessment-error.test.ts server/tests/site-assessment-integration.test.ts
npm run check
```

These checks are **OFFLINE / NO MODEL-QUALITY EVIDENCE**.
