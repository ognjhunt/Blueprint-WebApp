# AI Tooling Adoption Implementation

Date: 2026-04-07

Status: Approved implementation plan for same-day execution

Scope: Blueprint adoption of AI-native developer and automation accelerants using only the services, providers, and orchestration layers already present in the current stack.

## Decision

Blueprint will adopt the useful parts of the external "launch with Claude" pattern without importing its default architecture.

Blueprint will:

- keep the current `Blueprint-WebApp` stack centered on Vite, Express, Firebase, Firestore, Stripe, Render, Redis, Notion, and Paperclip
- keep Paperclip as the execution and ownership record
- keep current agent runtime providers and harnesses as the execution layer
- use AI tooling to improve repo ergonomics, bounded automation quality, and ship-to-distribution speed
- avoid introducing new primary services or replatforming core auth, database, hosting, payments, queueing, or ops state

Blueprint will not:

- migrate the core app to Open SaaS, Wasp, Supabase, or Vercel
- add a second primary auth system
- add a second primary operational datastore
- replace Paperclip with a generic skills runtime
- adopt trend-content or commodity micro-SaaS growth tactics as the center of the company

## Why

This plan follows repo doctrine:

- capture-first and world-model-product-first in `PLATFORM_CONTEXT.md`
- swappable model backends over permanent model coupling in `WORLD_MODEL_STRATEGY_CONTEXT.md`
- Paperclip as execution record and human-gated autonomous org control plane in `AUTONOMOUS_ORG.md`

This also follows the repo's own recent conclusions:

- "optimize narrow automation engines under the org, not the org's employee personas themselves" in `docs/autoagent-adoption-spec-2026-04-04.md`
- "adopt the structure, not the stack" in `docs/superpowers/plans/2026-04-04-agentic-marketing-loop-adaptation.md`

## Hard Constraints

- No new services.
- No replatforming.
- No changes that weaken provenance, rights, privacy, entitlement, hosted-session, or pipeline-sync truth boundaries.
- No production path may start depending on tools that are only useful in local developer workflows.
- All adoption work must be support-layer work on top of the current stack.

## In-Scope Today

- lock the architecture decision in repo docs
- define the exact AI-tooling adoption surface for this repo
- define owners, work order, and acceptance criteria
- implement repo-local documentation and governance needed to execute the adoption safely
- queue same-day implementation work that can land in this repo without introducing new services

## Out Of Scope Today

- Supabase migration
- Vercel migration
- Open SaaS/Wasp starter adoption
- new paid SaaS subscriptions
- replacing Firebase/Firestore as system of record
- replacing Paperclip routines, issue state, or human gates

## Existing Stack To Reuse

- Web runtime: Vite + Express + TypeScript
- Core identity and ops data: Firebase client auth + Firebase Admin / Firestore
- Payments and payouts: Stripe + Stripe Connect
- Hosting: Render
- live session and rate-limit support: Redis
- workspace and review surface: Notion
- autonomous org and execution record: Paperclip
- AI runtime lanes: OpenAI, Anthropic, ACP/OpenClaw paths already modeled in env and runtime code
- growth and comms: PostHog/GA, SendGrid, existing creative and outbound loops

Creative execution addendum on the trusted host:

- Codex-executed brand, marketing, and frontend image work should use Codex desktop's OAuth-backed native image workflow with `gpt-image-1.5` by default
- screenshots and code context should stay in the same Codex workflow when iterating on visuals
- Hermes-backed lanes remain planning, research, copy, and routing lanes unless work is explicitly moved into Codex
- server-side autonomous workers do not call a separate paid image API for final asset execution; they route image-heavy work into the Codex lane
- video stays on the explicit provider path

## Target Outcome By End Of Session

By the end of the session, Blueprint should have a concrete repo-level operating plan for AI tooling adoption that the team can execute immediately without ambiguity and without architectural drift.

The outcome is successful when all of the following are true:

- the no-new-services rule is explicit in repo documentation
- the adoption surface is narrowed to repo ergonomics, bounded automation, and growth/distribution loops
- each milestone has a named owner, a deliverable, and a verification rule
- every item is implementable with the stack already defined in `DEPLOYMENT.md` and `package.json`
- no milestone requires a replatform decision to proceed

## Owners

- Human founder: final priority and scope authority
- `blueprint-cto`: architecture owner, contract protection, go/no-go on repo-level technical changes
- `webapp-codex`: implementation owner inside `Blueprint-WebApp`
- `blueprint-chief-of-staff`: routing, sequencing, and completion tracking across org lanes
- `growth-lead`: owner for demand-content, ship-broadcast, and search/discovery loop adoption
- `notion-manager-agent`: optional mirror of approved docs/tasks into Notion after repo truth is settled

## Milestones

### M0. Lock The Decision

Owner: `blueprint-cto`

Deliverable:

- this implementation document committed in `docs/`
- explicit statement that Blueprint will not adopt Open SaaS, Supabase, or Vercel as new primary services for this repo

Acceptance criteria:

- the decision is written in repo-visible form
- the no-new-services rule is unambiguous
- all later milestones inherit the same constraint

### M1. Repo AI Ergonomics Baseline

Owner: `webapp-codex`

Deliverable:

- normalize repo instructions and usage guidance around the current stack
- document the approved AI-tooling surface for this repo

Work:

- keep `AGENTS.md`, `CLAUDE.md`, `PLATFORM_CONTEXT.md`, and `WORLD_MODEL_STRATEGY_CONTEXT.md` as the canonical context pack
- treat repo-local guidance as the source of truth for AI agents instead of external boilerplate assumptions
- allow Repomix only as an optional reference/export tool for bounded slices, external reference repos, or cross-repo understanding
- do not let packed-context workflows replace direct reading of canonical repo docs

Acceptance criteria:

- repo instructions clearly favor current local doctrine over external starter conventions
- AI assistants have a clear, bounded context pack to read first
- no part of the repo implies a planned core-stack migration

### M2. Skill Governance On Current Infrastructure

Owner: `blueprint-chief-of-staff`

Execution owner: `webapp-codex`

Deliverable:

- a governed list of what external skills and AI helper workflows are allowed, conditionally allowed, or disallowed for this repo

Rules:

- approved for engineering reference use: Repomix, Anthropic skills patterns, official provider best-practice skills that match already-used providers
- approved for bounded workflow optimization: lane-specific eval harness work already described in `docs/autoagent-adoption-spec-2026-04-04.md`
- disallowed in production-sensitive lanes without explicit review: third-party generic ops skills that can rewrite workspace truth, send external messages, or imply unsupported product states
- disallowed as default architecture drivers: greenfield boilerplates, second-auth-stack patterns, or second-datastore patterns

Acceptance criteria:

- the team can tell which tools are helpers versus architecture inputs
- imported skill usage cannot silently rewrite core product or ops assumptions
- high-risk lanes remain governed by Paperclip and existing human gates

### M3. Narrow Automation Improvement Plan

Owner: `blueprint-cto`

Execution owner: `webapp-codex`

Deliverable:

- a same-stack plan to improve the narrow automation lanes already identified by the repo

Initial lanes:

- `waitlist_triage`
- `support_triage`
- `preview_diagnosis`

Work:

- keep production workflows unchanged by default
- continue shadow-run and eval-first optimization using the existing AutoAgent lab shape
- only port winning prompts, policies, or task-orchestration changes back into production task definitions
- do not promote any lane that touches rights, payouts, privacy, legal, or irreversible commitments without the existing review thresholds

Acceptance criteria:

- lane optimization remains isolated from production truth
- every promoted change has eval evidence
- no lane bypasses Paperclip or current Firestore-backed state

### M4. Ship-To-Distribution Loop On Existing Growth Stack

Owner: `growth-lead`

Execution owner: `webapp-codex`

Deliverable:

- a concrete adoption plan for using existing growth and content infrastructure more effectively

Work:

- use the current wedge, Exact-Site Hosted Review, as the center of the loop
- convert shipped work into truthful drafts using current growth, creative, analytics, and Notion/Paperclip paths
- improve asset-centric tracking and outcome review rather than adding a new "marketing brain"
- keep all public sends draft-first and approval-gated
- for image-heavy creative work, route execution to Codex lanes that can use Codex-native image generation; keep Hermes lanes on brief-writing, evidence, and review
- keep scheduled or server-side creative workers on explicit provider APIs until a separate migration is approved

Acceptance criteria:

- growth work stays proof-led and wedge-specific
- no tactic depends on fake traction, generic viral content, or unsupported claims
- all outbound work routes through existing internal surfaces and gates

### M5. Optional Same-Day Repo Follow-Through

Owner: `webapp-codex`

Deliverable:

- repo-local follow-through items that can be implemented immediately after this doc lands

Candidate items for this same session:

- add a dedicated AI tooling policy doc under `docs/`
- add a skills-governance doc under `docs/`
- add an implementation checklist issue template or task list under `ops/paperclip/`
- tighten `CLAUDE.md` wording to reinforce the no-new-services rule

Acceptance criteria:

- every change is doc/config/process level
- every change is compatible with the current stack
- no change expands service footprint

## Execution Order For Today

1. Land this document.
2. Land the companion governance docs and instruction updates in this repo.
3. Record the approved tool classes and disallowed tool classes.
4. Convert the approved plan into concrete Paperclip work items if needed.
5. Execute only repo-local follow-through that does not require new services.

## Task Breakdown

### Track A. Documentation And Decision Lock

Owner: `webapp-codex`

Files:

- `docs/ai-tooling-adoption-implementation-2026-04-07.md`
- optional companion docs created today

Done when:

- the architecture decision is explicit
- implementation scope is bounded
- owners and acceptance criteria are written

### Track B. Repo Instructions

Owner: `webapp-codex`

Files:

- `AGENTS.md`
- `CLAUDE.md`

Done when:

- repo instructions state that current services remain primary
- repo instructions discourage external boilerplate assumptions
- AI helper tooling is framed as support tooling only

### Track C. Automation Lane Quality

Owner: `blueprint-cto`

Files:

- `docs/autoagent-adoption-spec-2026-04-04.md`
- existing `labs/autoagent/` and `server/agents/` surfaces as needed

Done when:

- the first three pilot lanes remain the approved narrow-lane focus
- shadow-run behavior remains non-authoritative
- promotion rules remain evidence-based

### Track D. Growth Loop Adaptation

Owner: `growth-lead`

Files:

- `docs/superpowers/plans/2026-04-04-agentic-marketing-loop-adaptation.md`
- any same-day follow-through docs or task files

Done when:

- growth adoption remains wedge-first
- public publishing remains approval-gated
- the loop is framed around proof assets, not generic trend content

## Risks

- architectural drift caused by importing greenfield indie-SaaS advice into a multi-repo platform with stronger truth contracts
- hidden service sprawl caused by "just trying" second auth, second database, or second hosting paths
- agent drift caused by ungoverned imported skills
- growth drift caused by generic AI-marketing tactics that are misaligned with Blueprint's narrow exact-site wedge

## Mitigations

- keep repo doctrine at the top of every adoption decision
- require `blueprint-cto` approval for any change that touches auth, ops state, payments, pipeline sync, hosted-session runtime, or cross-repo contracts
- treat Paperclip and repo files as system-of-record surfaces
- keep external skills and helper tools behind explicit allowlists and review

## Non-Goals

- maximizing trend velocity
- chasing the cheapest possible launch stack
- turning Blueprint into a generic AI wrapper SaaS
- optimizing for short-term developer novelty at the expense of durable product contracts

## References

- `PLATFORM_CONTEXT.md`
- `WORLD_MODEL_STRATEGY_CONTEXT.md`
- `AUTONOMOUS_ORG.md`
- `DEPLOYMENT.md`
- `package.json`
- `docs/autoagent-adoption-spec-2026-04-04.md`
- `docs/superpowers/plans/2026-04-04-agentic-marketing-loop-adaptation.md`
