# Local production assessment iteration

Owner instruction: the October 8 fast-iteration goal authorizes this narrow engineering tool. It does not authorize new provider spend, customer dispatch, upload, notification, access grants, or a second agent. Integration/release ownership remains task `01a119be-86a2-7db2-b469-b8e1f6b11e4d`; dishwasher upload/acceptance remains `01a11919-055b-727e-a26b-744383484002`.

From the checkout containing this change:

```bash
npm run assessment:iterate -- --help
npm run assessment:iterate -- --mode fresh-video --input INPUT.json --approved-budget ALLOCATION.json --output output/assessment-iteration/baseline
npm run assessment:iterate -- --mode saved-evidence --input INPUT.json --evidence output/assessment-iteration/baseline/evidence.json --approved-budget ALLOCATION.json --output output/assessment-iteration/after
npm run assessment:iterate -- --compare output/assessment-iteration/baseline output/assessment-iteration/after --output output/assessment-iteration/comparison.json
```

`INPUT.json` is a private file with the existing adapter input, for example:

```json
{
  "message": "Assess the admitted recording against the supplied site task; preserve unobserved endpoints.",
  "context": { "request_id": "THE_EXISTING_AUTHORIZED_REQUEST_ID" }
}
```

An optional `local_video` object contains `path`, `sha256` and `bytes`; it checks local bytes against the supplied hash and, in provider modes, against the source admitted from Storage. It never replaces Storage evidence or uploads the file. Do not supply `advisory_job_id`, a customer claim, a prior run, or the original dishwasher allocation. A file marked `execution_scope: "read-only-preflight"` is rejected in both provider modes.

There is no build, dev server, deployment, or full CI prerequisite. Each command starts `tsx` from current source, so the next assessment-prompt edit is loaded immediately. The four production tools, Sol model, Gemini path, output schema, source formatter and guards are unchanged. No model override is offered. The local CLI calls `runSiteAssessmentTask` in `server/agents/adapters/site-assessment.ts`, then the existing `createSiteAssessmentAgent(...).run()` and SDK `Runner`. `server/agents/runtime.ts` uses the same adapter; there is no `SDKAgentRunner` class in the inspected main revision. `agent:cli` addresses agent-access APIs; `smoke:agent` is another runtime smoke, neither runs this pipeline.

## Scope and prerequisites

Both provider modes need the existing OpenAI API credential, Firebase Admin configuration, enabled site-video lane, and a currently published, rights/privacy-admitted website capture. Fresh mode additionally needs the existing Gemini credential. `BLUEPRINT_ENV_FILE` can reference an already authorized environment file; nothing copies or creates credentials. Logging uses a plain transport for the standalone process. No existing development logger repair is included.

Live Firestore/Storage reads and the original pinned generation, manifest/marker verification, current rights/privacy, context and byte checks stay in the production adapter. They run again before every paid dispatch. Missing or changed authority fails closed. This loop cannot accept an arbitrary local clip without its existing admitted source record.

The only persistence substitution is the trusted local experiment host's provider reservation/response ledger, replacing ordinary customer `agentRuns`/capture-budget bookkeeping with the existing `inference_program.v1` contract on disk. It does not create synthetic customer records or remove source admission. All corpus/registry tools keep existing read scope. Optional paid embeddings are disabled explicitly, so the only paid providers admitted are Sol and Gemini; this difference is recorded. No scheduler, customer status route, notification, job dispatch or report delivery runs. Experiments do not prove that orchestration/integration works.

## Explicit separate spending allocation

Before paid execution, the owner must approve a distinct experiment allocation with a dollar cap and maximum API-call count for **each** provider, permission for fresh Gemini and repeated Sol calls, exact source/context, and local derived-evidence retention. The original dishwasher $5 is excluded. A subscription, present credential, or example JSON is not approval.

The `--approved-budget` file is a private **mutable ledger**, shared by every run in this allocation. It uses `server/utils/inferenceProgrammeAdmission.ts`'s existing `inference_program.v1`, including `authority_ref`, the authorization receipt's `ledger_sha256`, exact `request_id`, `capture_id`, `context_digest` (the existing inference programme context digest), `video_sha256`, `producer_source_digest`, expiration, aggregate `cap_micro_usd`, and existing held/admitted/recorded/unknown provider slots. It adds only this explicit experiment scope:

```json
{
  "experiment": {
    "allocation_id": "assessment-experiment-OWNER_APPROVED_ID",
    "purpose": "site-assessment-iteration",
    "providers": {
      "openai": { "cap_usd": 0, "max_calls": 0 },
      "gemini": { "cap_usd": 0, "max_calls": 0 }
    },
    "retention": {
      "local_evidence_allowed": true,
      "authority_ref": "EXISTING_OWNER_RETENTION_APPROVAL",
      "expires_at_ms": 0
    }
  }
}
```

This fragment intentionally grants no usable allowance and is not a complete allocation. Populate the existing programme only from actual approval and verified source metadata. Do not copy a ledger or reset slots to held to obtain more calls.

Admission uses **unchanged** `SiteAssessmentBudget` model pricing/ceilings and `admitInferenceProgramme` binding/slots. At inspected defaults the worst-case reservation is $0.331920 per Sol call and $1.818624 per Gemini analysis; these are conservative reservations, not invoices. Existing internal inference limits also apply even if owner caps are larger. Allocated slot sums must fit both provider caps/counts and the programme cap. Known usage records estimates; every slot remains consumed, retaining conservative exposure. Missing usage remains unknown. A failed/lost response leaves an admitted reservation and blocks subsequent paid execution, including another process. OpenAI uses the adapter's `maxRetries: 0`; no CLI retry occurs.

The allocation is locked for the whole run, atomically written and fsynced before dispatch. A crash leaves the lock and admission intact. Do not automatically delete a stale lock: verify the process has ended and reconcile outstanding reservations with actual provider receipts first. This command never resets unknown charges, refunds slots, or bypasses unresolved original customer accounting. The original customer allocation is not read or modified by experiment reservation writes.

## Saved evidence and inspection

Fresh mode calls the real Gemini `analyseAgenticVideo` and production Sol SDK. A successful, retention-permitted analysis produces `evidence.json` even if a later SDK stage fails. The record retains exact source bytes/hash/generation, request/capture/source key, analysis implementation/schema hash, exact question/inspection, normalized operator-statement digest, exact prompt hash, requested Gemini model and returned version when available, timestamps, provider response binding and content digest. Run-local conversation IDs are normalized for reuse; all statement text and non-run provenance remain bound.

Saved mode loads only this compatible, source-bound record, injects the original retained video sources through the existing seam, and still invokes **paid production Sol**. It never calls Gemini. A different source, operator statement, analysis configuration/schema/tool implementation, expired retention or damaged binding requires fresh evidence. If the agent asks a question/inspection absent from the saved record, the run pauses/fails with `experiment_saved_evidence_miss`; it cannot silently answer a different question. It does not retest upload, Gemini perception or complete production integration. Assessment-only prompt edits can use the same evidence. A record with redacted/changed analysis text is retained for inspection but cannot become a reusable cache. Raw Gemini JSON is validated with the same production parser and timestamp checks; harmless extra metadata remains in the raw response while the admitted evidence uses the production schema. Mocked observations and provisional frame descriptions are not real Gemini evidence.

Each new, private run directory contains `run.json`, `summary.md`, and, when available, `assessment.json` and `evidence.json`. `run.json` includes validated sanitized input, code commit/dirty patch hash, SDK/dependency/prompt/schema/tool hashes, model IDs, source/admission, tool/provider responses, output/error, timestamps/wall time, usage/known estimates, local reservations and unknown state. Hidden reasoning, credential fields, personal email addresses and access URL query strings are removed. Owned denial codes and schema paths remain readable; arbitrary error prose/stacks/headers/bodies are not copied. Failures exit nonzero. If assessment succeeds but evidence retention fails, the wrapper records failed at the evidence-retention stage while retaining the SDK result and cost; comparison preserves that distinction. Restrict local filesystem access and honor the recorded retention expiration; no deletion or archival job is added.

Comparison lists changed conclusions, evidence references, missing facts/questions, uncertainty and verification outcomes alongside cost/usage and latency. It includes runtime failures. It does **not** declare an improvement from text changes or model agreement. Use the authorized operator's success criteria and actual visible evidence to adjudicate changes; unknown expectations stay unknown.

## Verified example and current limits

The authorized read-only dishwasher input was prepared privately under `output/assessment-iteration/dishwasher.preflight.input.json`. Its `execution_scope` prevents use in either paid mode. This real command was run:

```bash
npm run assessment:iterate -- --preflight --input output/assessment-iteration/dishwasher.preflight.input.json --output output/assessment-iteration/dishwasher-preflight-2
```

The local file is 60,035,801 bytes, SHA256 `c549b3b358fb3abe4248c81d20f28794e398ae2685fbbae990851941e639fedd`; the preflight checks exact request metadata and local hash only. It does not invoke the model adapter. These private files are ignored, not public fixtures. The production owner already achieved upload; its normal SDK failure, unknown Sol charge and lack of reusable real Gemini evidence remain distinct.

At implementation time no experiment provider approval or successful genuine saved Gemini evidence was supplied, and OpenAI configuration was absent in this worktree. Therefore neither real-provider mode, before/after quality improvement, nor upload-to-final-output acceptance is claimed. Fresh/saved CLI argument and denial paths and focused contracts are tested offline. Necessary release work remains coordinated with the integration owner after real-quality evidence exists; no prompt experiment triggers deployment.

Offline safeguards:

```bash
npm exec vitest run server/tests/assessment-experiment.test.ts server/tests/site-assessment-error.test.ts server/tests/site-assessment-integration.test.ts
npm run check
```

These checks are **OFFLINE / NO MODEL-QUALITY EVIDENCE**.
