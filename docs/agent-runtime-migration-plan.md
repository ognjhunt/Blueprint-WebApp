# Agent Runtime Migration Plan

Last updated: 2026-03-22

## Goal

Remove OpenClaw from the alpha launch path and run agent-backed automation directly through the OpenAI Responses API.

For this repo's current alpha shape, the OpenAI Agents SDK is not required.

## Lane Mapping

### Use direct Responses API

- `waitlist_triage`
  Why: single structured classification task with strict JSON output
- `inbound_qualification`
  Why: single structured recommendation/drafting task with strict JSON output
- `post_signup_scheduling`
  Why: single planning task; real external actions still run in Blueprint code after the model response
- `support_triage`
  Why: single structured routing/drafting task
- `payout_exception_triage`
  Why: single structured finance triage task that must still fail closed to human review
- `preview_diagnosis`
  Why: single structured diagnosis/escalation task
- `operator_thread`
  Why for alpha: still a prompt-in / JSON-out task; multi-agent orchestration is not required to ship the launch path

### Keep separate from the alpha agent runtime

- `external_harness_thread`
  Why: this is already a different execution model and should stay on the ACP harness path rather than being forced into the alpha OpenAI runtime migration

## Why Agents SDK is not needed for alpha

The current tasks are not handoff-heavy, not multi-agent, and not tool-lifecycle-heavy.

They are mostly:

- one request
- one structured result
- local business logic before/after the call

That matches the Responses API directly.

The Agents SDK becomes worth it later if you want:

- richer operator sessions with tool orchestration
- built-in tracing across handoffs
- multiple cooperating agents
- longer-running agent workflows with reusable session state

## Code Changes In This Migration

- Default provider for alpha task definitions moves from `openclaw` to `openai_responses`
- Runtime dispatch chooses adapter by provider instead of forcing `openclaw`
- Alpha launch preflight checks `OPENAI_API_KEY` instead of `OPENCLAW_*`
- Readiness checks look for the OpenAI runtime instead of OpenClaw
- Launch smoke runs an OpenAI runtime smoke test
- Admin runtime connectivity/smoke routes point at the OpenAI runtime
- OpenClaw remains legacy/optional, not launch-critical

## New Alpha Runtime Contract

Required:

- `OPENAI_API_KEY`

Optional:

- `OPENAI_DEFAULT_MODEL`
- `OPENAI_WAITLIST_AUTOMATION_MODEL`
- `OPENAI_INBOUND_QUALIFICATION_MODEL`
- `OPENAI_POST_SIGNUP_MODEL`
- `OPENAI_SUPPORT_TRIAGE_MODEL`
- `OPENAI_PAYOUT_EXCEPTION_MODEL`
- `OPENAI_PREVIEW_DIAGNOSIS_MODEL`
- `OPENAI_OPERATOR_THREAD_MODEL`

## Validation

Before launch:

- `npm run alpha:check`
- `npm run alpha:preflight`
- `npm run smoke:agent`
- `npm run smoke:launch`

## Non-Goals

- Do not migrate `external_harness_thread` into the OpenAI alpha path.
- Do not add Agents SDK orchestration until the operator-thread product actually needs it.
