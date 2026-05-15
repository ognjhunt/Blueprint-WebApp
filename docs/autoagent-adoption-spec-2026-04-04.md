# AutoAgent Adoption Spec

Last updated: 2026-04-04

## Goal

Adopt AutoAgent as an offline harness-optimization lab for a small set of narrow Blueprint automation lanes, without replacing Hermes/Paperclip as the production operating system.

This spec assumes immediate implementation on the current repo and host, not a staged four-week planning exercise.

## Non-Goals

- Do not let AutoAgent mutate production employee agents directly.
- Do not replace Paperclip issue state, queue state, or human gates.
- Do not route production Hermes-backed agents through AutoAgent directly.
- Do not optimize payout, rights, legal, privacy, or other irreversible decision lanes first.

## First 3 Pilot Lanes

1. `waitlist_triage`
2. `support_triage`
3. `preview_diagnosis`

These are the best initial pilots because they already have:

- narrow structured inputs
- schema-bound outputs
- measurable end states
- lower business risk than payout or executive lanes

## Repo Shape

Use a repo-local lab scaffold now, then split to a standalone repo later if needed.

Recommended structure:

```text
labs/autoagent/
  README.md
  program.md
  tasks/
    README.md
    waitlist-triage/
      CASE_FORMAT.md
    support-triage/
      CASE_FORMAT.md
    preview-diagnosis/
      CASE_FORMAT.md
```

The current repo keeps:

- production task contracts in `server/agents/tasks/`
- production workflow execution in `server/agents/workflows.ts`
- shadow-run comparison storage under `ops_automation.shadow_runs.autoagent`

## Harbor Eval Format

Each historical case should become one Harbor task directory or one task fixture consumed by a lane-specific verifier.

Each case needs:

- `input.json`
  Exact production task input payload
- `expected.json`
  Human-accepted structured outcome
- `labels.json`
  Risk weights and review expectations

Example common fields:

```json
{
  "case_id": "waitlist-2026-03-14-001",
  "lane": "waitlist_triage",
  "input": {},
  "expected": {},
  "labels": {
    "requires_human_review": false,
    "risk_tier": "low",
    "unsafe_auto_clear_penalty": 5.0,
    "wrong_queue_penalty": 2.0
  }
}
```

## Lane-Specific Eval Rules

### Waitlist

Primary score:

- recommendation exact match
- queue exact match
- automation status exact match
- requires human review exact match

Secondary score:

- fit/readiness score within tolerance band
- draft email presence and usefulness

Heavy penalties:

- auto-safe when case required review
- wrong queue for follow-up/decline

### Support

Primary score:

- category exact match
- queue exact match
- priority exact match
- automation status exact match
- requires human review exact match

Secondary score:

- concise safe response draft

Heavy penalties:

- unsafe non-blocked result for billing/legal/account-sensitive cases
- wrong queue on technical or reschedule cases

### Preview Diagnosis

Primary score:

- disposition exact match
- retryable exact match
- automation status exact match
- requires human review exact match

Secondary score:

- rationale usefulness

Heavy penalties:

- retry_now on provider/artifact failures that should escalate
- not blocked when release-risk case should fail closed

## Model Strategy

Optimize separately per target family.

Current default:

- Hermes-hosted lab target should assume the current Qwen ladder on this host
- ACP-backed lab target can be tuned independently

Do not assume the same harness ports cleanly across:

- Hermes/Qwen
- Codex/OpenAI
- Claude/Anthropic

## Production Integration

Production path stays unchanged.

The only new production behavior is optional shadow execution behind env flags:

- `BLUEPRINT_AUTOAGENT_SHADOW_ENABLED=1`
- `BLUEPRINT_AUTOAGENT_SHADOW_LANES=waitlist_triage,support_triage,preview_diagnosis`
- `BLUEPRINT_AUTOAGENT_SHADOW_PROVIDER=acp_harness`
- optional: `BLUEPRINT_AUTOAGENT_SHADOW_MODEL=<model>`

Shadow runs:

- never drive downstream actions
- never replace primary task results
- persist side-by-side comparison data under the source document

Storage location:

```text
ops_automation.shadow_runs.autoagent
```

Stored fields:

- lane/kind
- source collection + doc id
- session key
- provider/runtime/model
- status
- output
- primary run summary
- captured timestamp

## Current Workflow Changes

`server/agents/workflows.ts` now supports shadow runs for:

- `runWaitlistAutomationLoop`
- `runSupportTriageLoop`
- `runPreviewDiagnosisLoop`

Implementation behavior:

1. run primary task as before
2. persist primary result as before
3. if the lane is shadow-enabled, run a second task invocation through the configured shadow provider
4. persist the shadow result under `ops_automation.shadow_runs.autoagent`
5. continue primary downstream actions unchanged

## Immediate Next Steps

1. Keep the seed/canonical fixture path runnable without Firestore or provider credentials:
   `npm run autoagent:run -- --sample 3`.
2. Export 100-300 historical resolved cases per pilot lane only when Firebase Admin
   credentials are intentionally available: `npm run autoagent:run -- --export-live`.
3. Normalize exported cases into the case format documented in
   `labs/autoagent/tasks/*/CASE_FORMAT.md`.
4. Stand up a dedicated ACP harness endpoint only after the local fixture evaluator
   is producing clean baseline evidence.
5. Run baseline evals before any AutoAgent tuning.
6. Port only winning prompt/tool/orchestration changes back into `server/agents/tasks/`.

## Graduation Criteria

Promote a tuned harness only if all are true:

- holdout score improves materially
- human override rate declines
- unsafe-decision rate does not increase
- shadow runs stay clean for at least two weeks of live volume

## Decision Rule

Blueprint should optimize narrow automation engines under the org, not the org’s employee personas themselves.
