# Blueprint Agent Employee Audit

Date: 2026-04-01
Scope: `ops/paperclip/blueprint-company/agents`, `ops/paperclip/programs`, `AUTONOMOUS_ORG.md`, `PLATFORM_CONTEXT.md`, `WORLD_MODEL_STRATEGY_CONTEXT.md`

## What Blueprint Is Actually Building

From `PLATFORM_CONTEXT.md` and `WORLD_MODEL_STRATEGY_CONTEXT.md`, Blueprint is not a qualification-first company and not a single-model company.

Blueprint is:

- capture-first
- world-model-product-first
- exact-site package and hosted-access focused
- rights-safe, privacy-safe, provenance-safe
- designed so software remains the system of record and agents operate on top of it

For agent design, that means every agent should behave like a narrow employee operating real systems, not like a fake replacement for product, infra, or workflow code.

## Audit Rubric

Each agent was checked against six requirements:

1. Narrow vertical ownership
2. Distinct soul/personality and judgment style
3. Explicit tools, sources of truth, and trust model
4. Explicit collaboration and handoff model with other agents
5. Explicit software boundary: the agent operates on top of software and does not become the software
6. Alignment with Blueprint doctrine: capture-first, exact-site/world-model-product-first, rights/provenance truthful

## Overall Verdict

The org is directionally strong.

- `33` agents already look like real narrow employees with a strong operating pattern: `AGENTS.md` + `Soul.md` + `Tools.md` + `Heartbeat.md`.
- `6` engineering specialists are only partial matches. They are useful, but they are still thin repo-role prompts rather than full employee profiles.
- `2` directories are stale aliases with no files and should be removed or turned into explicit redirects.

The system already captures the right philosophy:

- many agents explicitly say they operate on evidence, not promises
- many agents explicitly preserve human gates
- many agents explicitly route work through Paperclip instead of turning chat into the operating system
- growth and ops roles generally stay grounded in exact-site packages, hosted access, rights, and provenance

The main gap is not product-doctrine drift. The main gap is structural inconsistency between the best agents and the thinner ones.

## Highest-Priority Fixes

### P0: Convert the 6 engineering specialists into full employee profiles

These agents currently have only `AGENTS.md`:

- `webapp-codex`
- `webapp-claude`
- `pipeline-codex`
- `pipeline-claude`
- `capture-codex`
- `capture-claude`

They already have good repo-specific scopes and skills, but they are missing the full employee structure:

- `Soul.md`
- `Tools.md`
- `Heartbeat.md`
- explicit non-goals / boundaries
- explicit handoff map to CTO, review partner, and adjacent business agents
- explicit statement that they operate on top of the repo and issue system rather than becoming the system

Why this matters:

- these six are core employees in the org chart
- they are the template people will copy when creating more specialists
- right now they read more like execution prompts than like full role definitions

### P1: Remove or repurpose stale alias directories

These directories exist but contain no files:

- `ops/paperclip/blueprint-company/agents/ceo`
- `ops/paperclip/blueprint-company/agents/cto`

This creates ambiguity because the real roles are:

- `blueprint-ceo`
- `blueprint-cto`

Fix:

- delete the empty alias directories, or
- add a tiny redirect/readme in each saying the canonical agent is `blueprint-ceo` / `blueprint-cto`

### P2: Standardize the “employee kit” across all future agents

The strongest pattern in the repo is:

- `AGENTS.md`: job, boundaries, default behavior
- `Soul.md`: personality, values, judgment, traps
- `Tools.md`: sources of truth, owned actions, handoffs, trust model
- `Heartbeat.md`: cadence, queue state, stage transitions, escalation triggers

That should become mandatory for any new role-hire agent.

## Department-by-Department Audit

### Executive

- `blueprint-ceo`: Strong fit.
  Why: mission is explicit, doctrine is explicit, delegation goes through Paperclip, and it refuses checkpoint/provider lock-in.
  Fix: optional parity cleanup only. Add an explicit `Primary scope:` block in `ops/paperclip/blueprint-company/agents/blueprint-ceo/AGENTS.md` if you want exact template consistency.

- `blueprint-chief-of-staff`: Strong fit.
  Why: this is one of the cleanest “agent as manager, not software” implementations in the repo. Truth hierarchy, routing, delegation visibility, and Slack-vs-Paperclip boundaries are all explicit.
  Fix: none required.

- `blueprint-cto`: Strong fit.
  Why: clear cross-repo ownership, concrete delegation model, and good alignment with swappable backend doctrine.
  Fix: optional parity cleanup only. Add an explicit `Primary scope:` block in `ops/paperclip/blueprint-company/agents/blueprint-cto/AGENTS.md`.

- `investor-relations-agent`: Strong fit.
  Why: narrow vertical, real metrics only, humanized copy, and strong human gates around fundraising and disclosures.
  Fix: none required.

- `notion-manager-agent`: Strong fit.
  Why: very clear software boundary. It explicitly says Notion is the workspace surface and Paperclip remains execution truth.
  Fix: none required.

- `revenue-ops-pricing-agent`: Strong fit.
  Why: one of the clearest “operator on top of software” agents. It explicitly says it does not replace the product with spreadsheet theater and keeps pricing grounded in exact-site packages and hosted access.
  Fix: none required.

### Engineering

- `webapp-codex`: Partial fit.
  Why: strong repo role, strong skills, good execution posture. Missing soul, handoff structure, and stage model.
  Fix: add `Soul.md`, `Tools.md`, and `Heartbeat.md` in `ops/paperclip/blueprint-company/agents/webapp-codex/`; update `AGENTS.md` to read them before substantial runs; add explicit handoffs to `webapp-claude`, `blueprint-cto`, `buyer-solutions-agent`, `solutions-engineering-agent`, `site-catalog-agent`, and `conversion-agent`.

- `webapp-claude`: Partial fit.
  Why: strong review/planning role, but still not a full employee profile.
  Fix: add `Soul.md`, `Tools.md`, and `Heartbeat.md` in `ops/paperclip/blueprint-company/agents/webapp-claude/`; update `AGENTS.md`; make explicit that it does not replace QA/release automation and instead interprets evidence from those systems.

- `pipeline-codex`: Partial fit.
  Why: good implementation specialist, good anti-coupling language, but missing employee scaffolding.
  Fix: add `Soul.md`, `Tools.md`, and `Heartbeat.md` in `ops/paperclip/blueprint-company/agents/pipeline-codex/`; add explicit interfaces with `pipeline-claude`, `capture-qa-agent`, `rights-provenance-agent`, and `beta-launch-commander`.

- `pipeline-claude`: Partial fit.
  Why: good review role, but thin compared with the best agents.
  Fix: add `Soul.md`, `Tools.md`, and `Heartbeat.md` in `ops/paperclip/blueprint-company/agents/pipeline-claude/`; define what counts as a real blocker vs a monitor-only concern.

- `capture-codex`: Partial fit.
  Why: good implementation posture and good contract language, but missing employee-style operating files.
  Fix: add `Soul.md`, `Tools.md`, and `Heartbeat.md` in `ops/paperclip/blueprint-company/agents/capture-codex/`; make handoffs to `capture-claude`, `field-ops-agent`, and `capturer-success-agent` explicit.

- `capture-claude`: Partial fit.
  Why: useful planning/review role, but still a prompt-only specialist.
  Fix: add `Soul.md`, `Tools.md`, and `Heartbeat.md` in `ops/paperclip/blueprint-company/agents/capture-claude/`; explicitly define how it interacts with rollout gates and cross-repo compatibility.

- `beta-launch-commander`: Strong fit.
  Why: exactly the right distinction between scripts doing checks and an agent interpreting release evidence.
  Fix: none required.

- `docs-agent`: Strong fit.
  Why: narrow vertical, explicit code-as-truth doctrine, strong cross-repo reasoning, and good human gate on net-new docs.
  Fix: none required.

### Ops

- `ops-lead`: Strong fit.
  Why: coordinator, not fake operator software; routes through queues and issues rather than replacing them.
  Fix: none required.

- `intake-agent`: Strong fit.
  Why: narrow lane, good human gates, strong anti-promise posture, and appropriate routing to downstream roles.
  Fix: optional standardization only. `Tools.md` could gain explicit `## Actions You Own` and `## Handoff Partners` headings for template consistency.

- `capture-qa-agent`: Strong fit.
  Why: strong evaluation lane, fail-aware posture, and permanent human gate on payout approvals.
  Fix: optional standardization only. `Tools.md` could add explicit `## Actions You Own`.

- `field-ops-agent`: Strong fit.
  Why: clearly an operator over schedules and access state, not a replacement for dispatch or permissions systems.
  Fix: optional standardization only. `Tools.md` could add explicit `## Actions You Own` and `## Handoff Partners`.

- `finance-support-agent`: Strong fit.
  Why: crisp on the “never move money / never make legal calls” boundary.
  Fix: optional standardization only. `Tools.md` could add explicit `## Actions You Own` and `## Handoff Partners`.

- `buyer-solutions-agent`: Strong fit.
  Why: one of the best agents in the repo. It feels like a real account manager who operates on proof, not promises.
  Fix: none required.

- `solutions-engineering-agent`: Strong fit.
  Why: very strong software-boundary language. One of the cleanest examples of an “employee on top of software.”
  Fix: none required.

- `rights-provenance-agent`: Strong fit.
  Why: fail-closed posture, clear decision framework, and permanent human-gated edge cases.
  Fix: minor cleanup only. Add a `## Trust Model` heading in `ops/paperclip/blueprint-company/agents/rights-provenance-agent/Tools.md` for template consistency, even though the logic is already there.

- `security-procurement-agent`: Strong fit.
  Why: excellent truth-translation role. It explicitly avoids inventing a compliance system or outrunning evidence.
  Fix: none required.

- `capturer-success-agent`: Strong fit.
  Why: good narrow ownership, good cross-agent routing, good operator-vs-system boundary.
  Fix: none required.

- `site-catalog-agent`: Strong fit.
  Why: exactly the right judgment layer over catalog software and package metadata.
  Fix: none required.

- `buyer-success-agent`: Strong fit.
  Why: behaves like a real CSM, not a dashboard. Good expansion and churn-risk routing.
  Fix: none required.

### Growth

- `growth-lead`: Strong fit.
  Why: good discipline around growth truth, no qualification-first rewrite, and clear linkage across supply, demand, and operator lane.
  Fix: none required.

- `supply-intel-agent`: Strong fit.
  Why: narrow research vertical, good truth constraints, good downstream handoff pattern.
  Fix: optional standardization only. `Tools.md` could add explicit `## Actions You Own` and `## Handoff Partners`.

- `capturer-growth-agent`: Strong fit.
  Why: correctly translates research into reusable operating playbooks without pretending supply or maturity that does not exist.
  Fix: optional standardization only. `Tools.md` could add explicit `## Actions You Own` and `## Handoff Partners`.

- `city-launch-agent`: Strong fit.
  Why: clearly adapts the generic supply playbook into city-specific operating plans without pretending cities are interchangeable.
  Fix: optional standardization only. `Tools.md` could add explicit `## Actions You Own` and `## Handoff Partners`.

- `demand-intel-agent`: Strong fit.
  Why: grounded in exact-site products and proof-path mechanics, not generic B2B demand gen.
  Fix: minor language cleanup only. In `ops/paperclip/programs/demand-intel-agent-program.md`, consider changing `hosted-demo` references to `exact-site hosted review` or `hosted proof review` so the wording stays product-first, not generic-demo-first.

- `robot-team-growth-agent`: Strong fit.
  Why: keeps generic robot-team demand grounded in exact-site package value and hosted review truth.
  Fix: minor language cleanup only. In `ops/paperclip/programs/robot-team-growth-agent-program.md`, consider renaming `hosted-session demo motion` and `hosted-session demo to follow-up rate` to `hosted review motion` and `hosted review to follow-up rate`.

- `site-operator-partnership-agent`: Strong fit.
  Why: excellent doctrine alignment. It keeps site operators as an optional third lane and explicitly refuses to make them the center of the business.
  Fix: none required.

- `city-demand-agent`: Strong fit.
  Why: properly adapts generic demand to city reality without overstating certainty.
  Fix: optional standardization only. `Tools.md` could add explicit `## Actions You Own` and `## Handoff Partners`.

- `conversion-agent`: Strong fit.
  Why: strong measurement-first loop and explicit guard against qualification-first regression.
  Fix: none required.

- `analytics-agent`: Strong fit.
  Why: strong trust hierarchy, clear use of transactional truth vs behavioral truth, and good proof-artifact requirement.
  Fix: optional standardization only. `Tools.md` could add explicit `## Actions You Own` and `## Handoff Partners`.

- `community-updates-agent`: Strong fit.
  Why: strong draft-only posture, good anti-hype boundaries, and good doctrine alignment.
  Fix: none required.

- `market-intel-agent`: Strong fit.
  Why: narrow research vertical and useful autoresearch pattern.
  Fix: optional standardization only. `Tools.md` could add explicit `## Actions You Own` and `## Handoff Partners`.

- `outbound-sales-agent`: Strong fit.
  Why: behaves like a real BDR role with clear handoff boundaries to buyer solutions.
  Fix: minor language cleanup only. In `ops/paperclip/blueprint-company/agents/outbound-sales-agent/AGENTS.md`, prefer `hosted review` or `relevant exact-site package` over the more generic `demo` wording where possible.

## Structural Pattern To Use For Every New Agent

If you want to keep building agents as employees, new roles should copy this structure exactly:

1. `AGENTS.md`
   - role title
   - who they report to
   - primary scope
   - default behavior
   - explicit non-goals
   - explicit “operate on top of software” sentence
   - delegation visibility rule

2. `Soul.md`
   - why you exist
   - what you care about
   - excellent judgment in this role
   - never compromise
   - traps to avoid

3. `Tools.md`
   - primary sources
   - actions you own
   - handoff partners
   - trust model
   - do not use casually

4. `Heartbeat.md`
   - schedule / triggers
   - stage model
   - block conditions
   - escalation conditions

5. `programs/<agent>-program.md` when the role runs a repeatable research, writing, or optimization loop

## Canonical New-Agent Design Rules

Any new “hire” should satisfy all of these before it is considered complete:

- narrow vertical, not broad generalist authority
- operates on top of existing product, workflow, and data systems
- uses Paperclip issues as the work record
- has explicit handoffs to adjacent employees/agents
- leaves high-risk decisions visibly human-gated
- speaks in exact-site, capture-first, rights/provenance-truthful language
- does not invent supply, demand, readiness, traction, or capability

## Bottom Line

Blueprint already has the right org philosophy.

The best agents in this repo already feel like narrow employees with judgment, tools, teammates, and boundaries.

The remaining work is to make the engineering specialists match that same standard and remove the stale alias directories so the system is easier to extend cleanly when you add new hires.
