# Continuous Manager Loop — Master Spec and Next-Session Prompt

**Date:** 2026-03-30  
**Status:** Ready for implementation  
**Goal:** Build a genuinely continuous manager layer for Blueprint that runs nearly 24/7, understands what each agent is doing, detects what stalled or finished, decides what should happen next, and keeps work moving until complete.

---

## Executive Summary

Blueprint already has a strong Paperclip org skeleton, but it does **not** yet have a true 24/7 managerial loop.

Today, the system has:

- Paperclip agents, issues, routines, and plugin/webhook intake
- role hierarchy in `AUTONOMOUS_ORG.md`
- strategic CEO/CTO roles
- ops/growth lead roles
- specialist agents
- Hermes installed on the host and wired for selected research/specialist agents

What it still lacks:

- a continuous manager that always checks what finished, what stalled, and what should happen next
- durable managerial memory across interruptions
- a direct manager inbox/chat surface
- a single always-on loop that turns org state into next actions without waiting for only fixed daily routines

### Architecture Decision

**Do not replace Paperclip with Hermes.**

**Use Paperclip as the system of record and orchestration layer.**

**Use Hermes for the persistent manager runtime.**

That means:

- Paperclip remains authoritative for issues, routines, assignments, project state, work queues, and plugin/webhook intake.
- Hermes powers the persistent, continuous manager identity and memory loop.
- The manager writes decisions and next actions back into Paperclip issues/tasks/routines rather than treating Hermes memory as the source of truth.

### Recommended Manager Shape

**Recommended:** add a new Hermes-backed manager agent, `blueprint-chief-of-staff` or `executive-ops-manager`, rather than turning `blueprint-ceo` into the 24/7 loop.

Why:

- `blueprint-ceo` should stay strategic, board/founder-facing, and escalation-oriented.
- A 24/7 polling/triage loop is operationally more like a chief of staff / operating manager than a pure CEO.
- This preserves clean hierarchy:
  - founder = real CEO / board
  - `blueprint-ceo` = strategic delegate
  - `blueprint-chief-of-staff` = continuous managerial runtime
  - `ops-lead`, `growth-lead`, `cto`, and specialists = managed workers

If adding a new role is rejected, the fallback is:

- make `ops-lead` the first 24/7 Hermes-backed manager and let it coordinate across Ops + Growth + executive queues

But the preferred design is a dedicated manager.

---

## Current Ground Truth

### Repo and Product Doctrine

Read first:

1. `/Users/nijelhunt_1/workspace/Blueprint-WebApp/PLATFORM_CONTEXT.md`
2. `/Users/nijelhunt_1/workspace/Blueprint-WebApp/WORLD_MODEL_STRATEGY_CONTEXT.md`
3. `/Users/nijelhunt_1/workspace/Blueprint-WebApp/DEPLOYMENT.md`
4. `/Users/nijelhunt_1/workspace/Blueprint-WebApp/AUTONOMOUS_ORG.md`
5. `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/BLUEPRINT_AUTOMATION.md`

Do not violate the platform doctrine:

- capture-first
- world-model-product-first
- provenance-truth-first
- qualification/readiness remains secondary support, not the center of the company

### Live Paperclip/Hermes State

Host-local Paperclip:

- local API health: `http://127.0.0.1:3100/api/health`
- public URL: `https://paperclip.tryblueprint.io/`
- env file: `/Users/nijelhunt_1/workspace/.paperclip-blueprint.env`
- source checkout: `/Users/nijelhunt_1/workspace/paperclip`

Host-local Hermes:

- install root: `/Users/nijelhunt_1/.hermes/hermes-agent`
- config: `/Users/nijelhunt_1/.hermes/config.yaml`
- auth store: `/Users/nijelhunt_1/.hermes/auth.json`
- current provider target: Codex OAuth only

### Current Repo Config

Key files:

- Paperclip company package:
  `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/blueprint-company/.paperclip.yaml`
- Paperclip reconcile:
  `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/reconcile-blueprint-paperclip-company.sh`
- Paperclip verify:
  `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/verify-blueprint-paperclip.sh`
- Blueprint plugin worker:
  `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/plugins/blueprint-automation/src/worker.ts`

### Hermes-Backed Agents Already Converted

These agents are already `hermes_local`:

- `ops-lead`
- `growth-lead`
- `analytics-agent`
- `market-intel-agent`
- `supply-intel-agent`
- `capturer-growth-agent`
- `city-launch-agent`
- `demand-intel-agent`
- `robot-team-growth-agent`
- `site-operator-partnership-agent`
- `city-demand-agent`

These remain non-Hermes on purpose:

- `blueprint-ceo`
- `blueprint-cto`
- `webapp-codex`, `webapp-claude`
- `pipeline-codex`, `pipeline-claude`
- `capture-codex`, `capture-claude`
- `intake-agent`
- `capture-qa-agent`
- `field-ops-agent`
- `finance-support-agent`
- `conversion-agent`

That separation is intentional:

- Hermes is best for persistence, memory, continuity, and manager-like behavior.
- Paperclip issue-driven agents remain better for sensitive action lanes and repo specialists.

---

## Product Requirement

Build a system where a manager agent:

1. runs nearly continuously
2. knows what each subordinate agent is doing
3. knows what each queue/routine/issue/project looks like now
4. determines what finished, what stalled, and what is blocked
5. decides what should happen next
6. creates or updates concrete Paperclip work items
7. wakes or nudges the correct agents
8. tracks progress until completion
9. remembers prior managerial context across interruptions
10. exposes a human-friendly inbox/chat surface later without making that surface the source of truth

This is not just another routine.

It is a manager loop.

---

## Strong Recommendation

### Paperclip vs Hermes split

**Paperclip should own:**

- issue lifecycle
- routine definitions
- wakeups and assignments
- plugin/webhook intake
- project/workspace topology
- cross-agent governance
- authoritative work state
- auditability

**Hermes should own:**

- the continuous manager persona
- durable conversational/session continuity
- memory that helps managerial follow-through
- direct operator messaging later
- a long-lived operating surface that feels like an employee

### Best near-term implementation

**Implement a single Hermes-backed manager first.**

Preferred new agent:

- `blueprint-chief-of-staff`

Fallback if you do not want a new role:

- repurpose `ops-lead` into the primary continuous manager loop

### Why not make CEO the 24/7 loop?

Because the 24/7 loop is mostly:

- triage
- follow-through
- cross-agent coordination
- blocker detection
- assignment pressure
- completion management

That is chief-of-staff / operator behavior, not pure CEO behavior.

Keep `blueprint-ceo` strategic and escalation-oriented.

### Provider decision

**Default implementation path:** use Codex OAuth first.

Reason:

- already installed and authenticated
- no extra provider/secrets required
- lowest-friction implementation path
- consistent with the current Hermes host setup

**When OpenRouter becomes worth it:**

- if the manager loop runs very frequently and cost matters
- if you want a cheap always-on open model for housekeeping and classification
- if you want cheap cheap-model routing for triage and Codex only for harder decisions

So:

- **Phase 1:** Codex OAuth only
- **Phase 2 optional:** OpenRouter-backed cheap manager routing with Codex escalation/fallback

Do not introduce OpenRouter during the first full-manager implementation unless there is a concrete reason. The objective is continuous managerial behavior, not provider experimentation.

---

## Target Design

### New or repurposed manager loop

Create a continuous manager loop that wakes on:

- a short recurring schedule, e.g. every 5 minutes
- issue creation/update/close events
- routine completion/failure
- queue changes from the Blueprint plugin
- explicit founder/operator messages later

### Inputs the manager must read every cycle

At minimum:

- active Paperclip issues across relevant projects
- recent routine runs and their outcomes
- recent agent runs and failures
- plugin state for automation activity
- Notion Work Queue where relevant
- Firestore/Stripe/support queue summaries where relevant
- the current Blueprint product doctrine and operating rules

### Outputs the manager must be able to produce

- create/update/close/reprioritize Paperclip issues
- wake relevant agents
- request clarification from founder only when needed
- write concise manager notes into Paperclip issue comments or linked docs
- emit “what changed / what next” summaries
- keep pressure on incomplete work until done or blocked

### Memory rules

Critical rule:

**Hermes memory is supportive, not authoritative.**

Use Hermes memory for:

- managerial continuity
- recurring preferences
- recent context
- soft planning memory

Do **not** use Hermes memory as the final source of truth for:

- issue state
- queue state
- commitments
- rights/privacy/commercial decisions
- “what is done”

That must stay in Paperclip and the repo/system records.

### Human control rules

The founder remains the real board/CEO.

The manager loop should:

- autonomously triage and assign
- autonomously follow up
- autonomously keep work moving
- ask the founder for approval on strategy, budget, product positioning, rights/privacy/commercial commitments, or any risky irreversible action

### Messaging surface

Messaging is optional in Phase 1.

Do **not** block implementation on Telegram/Slack inbox work.

Phase 1 can be:

- Hermes-backed continuous manager running locally or on the host
- Paperclip remains the work surface

Phase 2 can add:

- Slack DM or channel presence
- founder/operator inbox
- “ask the manager what is happening” surface

---

## Implementation Scope for the Next Session

The next session should implement this fully.

### Required work

1. Add the continuous manager role:
   - preferred: add `blueprint-chief-of-staff`
   - fallback: refactor `ops-lead` into this role

2. Define its instructions and responsibilities:
   - new `AGENTS.md`
   - strong doctrine alignment
   - explicit managerial behavior
   - explicit “keep pushing until done/blocked” behavior

3. Wire it into Paperclip:
   - add agent to `.paperclip.yaml`
   - attach to correct project/workspace
   - add routines/events
   - import/reconcile it

4. Build a short-interval continuous routine:
   - 5-minute or similarly tight cadence
   - must not spam or duplicate work
   - must be idempotent

5. Add event-driven wakeups:
   - issue updates
   - routine failures/completions
   - plugin queue updates

6. Ensure it can inspect subordinate state:
   - active issues
   - stalled work
   - recent failures
   - overdue queues
   - missing follow-through

7. Ensure it can act:
   - create/update/close issues
   - assign and reprioritize
   - wake agents
   - write manager notes/comments

8. Add safeguards:
   - avoid duplicate issues
   - avoid infinite self-chatter
   - avoid reassign loops
   - avoid unsupported side effects

9. Add verification:
   - reconcile works
   - verify script checks manager agent presence and health
   - smoke scenario proving it notices a stalled or finished issue and does the next step

10. Update docs:
   - `AUTONOMOUS_ORG.md`
   - `BLUEPRINT_AUTOMATION.md`
   - relevant Paperclip readmes/specs

### Nice-to-have if time permits

- founder inbox integration design
- Slack message design
- Hermes memory conventions
- OpenRouter-ready cheap-routing design but not necessarily enabled

---

## Concrete File Targets

Likely files to create or edit:

### Create or modify manager instructions

- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/blueprint-company/agents/blueprint-chief-of-staff/AGENTS.md`

If not adding a new role, then modify:

- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/blueprint-company/agents/ops-lead/AGENTS.md`

### Company package

- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/blueprint-company/.paperclip.yaml`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/AUTONOMOUS_ORG.md`

### Bootstrap/reconcile/verify

- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/reconcile-blueprint-paperclip-company.sh`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/verify-blueprint-paperclip.sh`
- maybe `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/bootstrap-blueprint-paperclip.sh`

### Plugin worker / event intake

- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/plugins/blueprint-automation/src/worker.ts`
- related constants/manifest files in the same plugin package if needed

### Supporting docs

- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/BLUEPRINT_AUTOMATION.md`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/README.md`

---

## Acceptance Criteria

This is complete only if all of the following are true:

1. A single manager loop exists that wakes frequently and continuously.
2. It can see subordinate agent state, issue state, and routine state.
3. It can determine:
   - what finished
   - what stalled
   - what should happen next
4. It writes its decisions back into Paperclip, not only Hermes memory.
5. It creates or updates actionable work items rather than narrating.
6. It avoids duplicate work creation.
7. It survives interruptions and resumes with continuity.
8. It does not require Telegram/Slack to function in Phase 1.
9. The founder remains the human escalation authority.
10. Reconcile/verify/smoke prove the behavior end-to-end.

---

## Explicit Prompt for the Next Session

Use the following prompt in the next session:

```md
Implement the full continuous 24/7 manager loop for Blueprint.

Read these first:
1. /Users/nijelhunt_1/workspace/Blueprint-WebApp/PLATFORM_CONTEXT.md
2. /Users/nijelhunt_1/workspace/Blueprint-WebApp/WORLD_MODEL_STRATEGY_CONTEXT.md
3. /Users/nijelhunt_1/workspace/Blueprint-WebApp/DEPLOYMENT.md
4. /Users/nijelhunt_1/workspace/Blueprint-WebApp/AUTONOMOUS_ORG.md
5. /Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/BLUEPRINT_AUTOMATION.md
6. /Users/nijelhunt_1/workspace/Blueprint-WebApp/docs/superpowers/specs/2026-03-30-continuous-manager-loop-spec.md

Current ground truth:
- Paperclip is the orchestration layer and source of truth.
- Hermes is installed at /Users/nijelhunt_1/.hermes/hermes-agent.
- Hermes is configured for Codex OAuth only via /Users/nijelhunt_1/.hermes/config.yaml and /Users/nijelhunt_1/.hermes/auth.json.
- Selected research/specialist agents already use hermes_local in /Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/blueprint-company/.paperclip.yaml.
- Local Paperclip API is at http://127.0.0.1:3100 and the public URL is https://paperclip.tryblueprint.io/.

What I want:
- a genuinely continuous 24/7 managerial memory loop
- a manager that always checks what finished, what stalled, and what should happen next
- durable context across interruptions
- a real employee-style manager layer
- no need for Telegram/Slack in phase 1

Architecture decision:
- Keep Paperclip as the system of record and orchestration layer.
- Use Hermes for the persistent manager runtime.
- Do not replace Paperclip with Hermes.
- Prefer creating a new manager role like blueprint-chief-of-staff rather than turning blueprint-ceo into the 24/7 loop.
- If a new manager role is a bad fit, repurpose ops-lead instead, but explain why.

Implement this fully:
1. Add the continuous manager role and instructions.
2. Wire it into the Paperclip company package.
3. Create a short-interval continuous routine plus event-driven wakeups.
4. Ensure it can inspect subordinate work/routine/plugin state.
5. Ensure it creates or updates real Paperclip work items and wakes the right agents.
6. Add safeguards against duplicate issues, reassign loops, or empty narration.
7. Update reconcile/verify/smoke so the manager loop is covered.
8. Update docs.
9. Run end-to-end verification.

Constraints:
- Preserve Blueprint product doctrine.
- Do not make Hermes memory the source of truth.
- Do not move sensitive rights/privacy/finance/access decisions out of governed Paperclip state.
- Keep the founder as final authority.

If OpenRouter is genuinely needed for the manager loop, explain exactly why before enabling it. Otherwise keep the implementation on the current Codex OAuth path.

Do the implementation, not just analysis.
```

---

## Optional OpenRouter Note

If the founder later provides OpenRouter credentials, the best use is:

- a cheap manager housekeeping route for frequent polling/classification
- leaving harder escalations or major decisions on Codex or Claude

Do not make OpenRouter a prerequisite for the first full implementation.

