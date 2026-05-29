---
name: goal-autoresearch
description: Run Blueprint-WebApp goal-style AutoResearch loops that turn repeated Codex/Paperclip discovery work into durable local skills, scripts, evals, or closeout checks.
---

# Goal AutoResearch

## Purpose

Use this skill to make a Blueprint `/goal` run compound instead of repeating the same context loading, dirty-tree triage, closeout proof, no-change diagnosis, brand/proof copy review, hosted-session contract lookup, fixture search, or skill-graduation decision every time.

The output of the run should be one narrow repo-safe improvement: a skill, deterministic helper script, fixture/eval expansion, closeout validator, local report template, or documented no-change suppression rule. The run should not broaden into live Paperclip repair, Notion mutation, sends, payments, provider jobs, or unsupported product claims.

## When To Use

Use this when the issue or prompt asks for any of these:

- Blueprint `/goal` hardening, AutoResearch, continuous improvement, repeated-agent-work reduction, or skill graduation.
- Paperclip/Codex closeout quality, goal eligibility, no-change suppression, routine waste, or control-room audit work.
- AutoAgent lab fixture/eval improvements that must stay offline and deterministic.
- A request to convert repeated investigation steps into durable repo-local practice.

Do not use this for ordinary feature work unless the feature itself is about autonomous-loop durability.

## Workflow

1. **Anchor the run**
   - Run `git status --short` first and preserve unrelated dirty work.
   - Read the repo doctrine requested by the issue, especially `AGENTS.md`, `PLATFORM_CONTEXT.md`, `WORLD_MODEL_STRATEGY_CONTEXT.md`, `AUTONOMOUS_ORG.md`, `docs/architecture/command-safety-matrix.md`, and `docs/autonomous-loop-evidence-checklist-2026-05-03.md`.
   - Use `graphify-out/GRAPH_REPORT.md` only as a navigation aid, never as product truth.

2. **Run the local baseline**
   - Prefer local deterministic evidence before live agents or browser exploration.
   - Start with the safe control-room commands listed below when they match the issue.
   - Record the command, exit status, and high-signal output in notes for the closeout.

3. **Study repeated discovery tax**
   - Classify the waste before choosing a fix:
     - context loading repeated across `/goal` runs
     - dirty-tree triage repeated on unrelated files
     - closeout proof labels missing or inconsistent
     - no-change work claiming completion without durable suppression
     - brand/proof copy drift between public polish and operational proof
     - hosted-session contract confusion
     - missing eval fixtures or negative controls
     - missing skill/helper/eval graduation path

4. **Pick one slice**
   - Choose exactly one repo-safe improvement.
   - Prefer new or untouched files when the worktree is dirty.
   - Keep code changes local-only and deterministic. No live sends, Notion writes, Stripe, Render, Firebase live writes, production Paperclip mutation, provider jobs, rights claims, customer claims, payment claims, or city-live claims without explicit authorization.

5. **Iterate with a strategy record**
   - Use the pattern: Objective -> Run -> Study trace/diff/cost/test evidence -> update strategy -> Iterate -> Converge -> Graduate.
   - If the issue needs a durable strategy file, use a task-scoped path such as `docs/autoresearch/<date>-<slug>-strategy.md`; otherwise keep the strategy summary in the closeout.
   - A strategy record should name the objective, baseline commands, observed tax, selected slice, rejected alternatives, validation command, graduation target, and next ranked queue.

6. **Graduate the durable asset**
   - Skill: include purpose, when-to-use, workflow, Blueprint gotchas, allowed commands, forbidden commands, graduation criteria, and closeout template.
   - Script/helper: make it local-only, deterministic, idempotent, and runnable without secrets by default.
   - Eval/fixture: include negative controls for unsafe auto-clear, unsupported proof, live-service assumptions, and no-change churn.
   - Closeout check: assert required goal closeout labels and allowed states from `server/agents/goal-closeout-contract.ts`.

7. **Verify before claiming status**
   - Run the targeted validation command for the changed artifact.
   - Run `npm run check` only when TypeScript/code changed.
   - After code-file changes, run `bash scripts/graphify/run-webapp-architecture-pilot.sh --no-viz`.
   - Do not claim done from adapter success, a generated artifact alone, or a local test unrelated to the requested durability improvement.

## Repo-Specific Gotchas

- `Blueprint-WebApp` is buyer, licensing, ops, and hosted access for capture-backed site-specific world-model products. Do not reframe it as qualification-first or model-checkpoint-first.
- Public pages may be polished and present-tense, but exact claims about customers, rights, payments, provider execution, city coverage, hosted fulfillment, or live availability need owning-system proof.
- Paperclip is execution state; Notion is workspace/review visibility; repo docs are doctrine; Firestore/Stripe/Render/Redis/provider systems own their specific live facts.
- AutoAgent is an offline harness-optimization lab for `waitlist_triage`, `support_triage`, and `preview_diagnosis`. Live Firestore export is opt-in only.
- Existing dirty files may be user or agent work. Do not revert or normalize them while landing a narrow improvement.
- A no-change result is not waste if it is explicitly classified, backed by evidence, and suppresses future repeated runs. It is waste when it consumes a full run and leaves no durable suppression or proof trail.

## Allowed Commands

These are safe local defaults for this skill:

```bash
git status --short
npm run paperclip:control-room:inventory
scripts/paperclip/validate-agent-kits.sh
npm run agent:cost-cache-report
npm run autoagent:run -- --sample 3
npm run check
bash scripts/graphify/run-webapp-architecture-pilot.sh --no-viz
```

Use targeted `npm run test -- <paths>` or `npm exec -- vitest run <paths>` when code or test files changed and the target is narrower than `npm run check`.

## Forbidden Commands And Actions

Do not run or perform these unless the issue explicitly authorizes the live side effect and the required proof/approval is present:

- live sends, outreach, Slack/Gmail/SendGrid sends, or human-reply polling
- Stripe, Stripe Connect, payment, payout, refund, invoice, or subscription mutation
- Notion writes, page moves, workspace restructuring, or private Notion scraping
- Render deploys, production env mutation, public-url/webhook changes, or VPS repair/restart
- production Paperclip reconcile, bootstrap, import, issue mutation, routine repair, or live agent dispatch
- provider jobs, paid creative/video execution, or live Deep Research runs
- rights/privacy/commercialization exceptions, real customer claims, active city coverage claims, hosted-session fulfillment claims, or payment success claims

## Graduation Criteria

Graduate a repeated discovery pattern only when all are true:

- The same tax has appeared in at least one current run and is likely to recur.
- The durable asset has a narrower scope than the whole system.
- A future agent can invoke it without live secrets or production mutation.
- The asset names blocked claims and source-of-truth boundaries.
- The validation command proves the asset exists and covers the intended rule.
- The closeout ranks the next queue instead of reopening broad exploration.

## Closeout Template

Use this shape in final packets and Paperclip comments:

```text
Goal objective:
Issue/run id:
Budget/timeout context:
Stage reached:
State claimed: done | blocked | awaiting_human_decision
Owner:
Blocker/decision id:
Durable improvement:
Repeated discovery tax addressed:
Proof paths:
Command outputs:
Requirement coverage:
Next action:
Retry/resume condition:
Residual risk:

Next ranked /goal queue:
1. Lane:
   Owner:
   Safe commands:
   Success criteria:
   Blocked claims:
   Why /goal is appropriate:
2. Lane:
   Owner:
   Safe commands:
   Success criteria:
   Blocked claims:
   Why /goal is appropriate:
3. Lane:
   Owner:
   Safe commands:
   Success criteria:
   Blocked claims:
   Why /goal is appropriate:
```
