# Paperclip/Hermes Failure Promotion Queue

Date: 2026-05-28
Status: Repo-local AutoResearch queue contract

## Purpose

Turn classified Paperclip/Hermes run failures into a deterministic queue of the next repo-local AutoResearch improvements.

This queue is a planning and verification surface only. It does not mutate Paperclip, Hermes, providers, Firebase, Notion, Stripe, Render, or production behavior. It does not claim live readiness.

## Input

Use the local failure classifier output from `scripts/paperclip/sweep-agent-run-failures.ts`.

Safe local shape:

```bash
npm run paperclip:sweep:run-failures -- --json --limit 250 > /tmp/paperclip-failures.json
npm exec -- tsx scripts/paperclip/autoresearch-promotion-queue.ts --input /tmp/paperclip-failures.json --markdown
```

If the sweep cannot reach local Paperclip, treat that as runtime availability evidence, not as a reason to claim the queue is complete from live state. The queue builder can also be validated from fixtures without any live Paperclip API.

## Required Queue Fields

Every queued item must include:

- owner
- target file
- expected negative control
- validation command
- promotion threshold
- rollback condition
- residual risk

The queue builder also records the source failure family, observed count, observed agents, proof paths, and blocked claims so a future `/goal` run can stay bounded.

## Lane Mapping

| Classified failure family | Queue lane | Default owner | Default target file |
| --- | --- | --- | --- |
| Issue-bound scope widening, `/api/runs` probing, invalid jq guardrail failures | `prompt_patch` | `blueprint-chief-of-staff` | `ops/paperclip/blueprint-company/hermes-profiles/orchestrator-task-template.md` |
| Provider auth, quota, usage limit, timeout, process loss, env/capacity blockers | `policy_patch` | `blueprint-cto` | `docs/ai-skills-governance-2026-04-07.md` |
| Succeeded runs with terminal provider errors, exit-zero false positives, stalled no-output runs, tool-runtime closeout ambiguity | `closeout_rule_patch` | `webapp-codex` | `server/agents/goal-closeout-contract.ts` |
| Unknown or newly recurring failure family | `autoagent_eval` | `webapp-codex` | `labs/autoagent/tasks/agent-failure-promotion/CASE_FORMAT.md` |

## Promotion Rules

Promotion means creating the next repo-local patch or eval candidate. It never means enabling production behavior.

- AutoAgent evals must reject schema-valid unsafe candidates that omit the required queue fields or claim live readiness.
- Prompt patches must prove the negative control blocks queue-wide Paperclip probing from an issue-bound wake.
- Policy patches must preserve repo/Paperclip/provider source-of-truth boundaries and keep auth/quota/capacity as explicit blockers.
- Closeout-rule patches must force `done`, `blocked`, or `awaiting_human_decision` evidence fields instead of accepting adapter success or status labels alone.

## Validation

Focused queue validation:

```bash
npm exec -- vitest run scripts/paperclip/autoresearch-promotion-queue.test.ts
```

Validation with the existing classifier:

```bash
npm exec -- vitest run scripts/paperclip/sweep-agent-run-failures.test.ts scripts/paperclip/autoresearch-promotion-queue.test.ts
```

## Disallowed Claims

Do not use this queue to claim:

- live Paperclip readiness
- Hermes/provider recovery
- fixed production routing
- operational launch readiness
- rights, payment, hosted-session, buyer-fulfillment, or city-live proof

The only claim this queue can support is that classified recurring failures now have deterministic repo-local next candidates with validation and rollback gates.
