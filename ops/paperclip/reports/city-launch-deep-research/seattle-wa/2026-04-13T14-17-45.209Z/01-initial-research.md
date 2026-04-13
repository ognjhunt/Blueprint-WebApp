# Seattle, WA Initial Deep Research

- interaction_id: v1_ChdDZnZjYWZlRE1KR3N6N0lQckppV2tBVRIXQ2Z2Y2FmZURNSkdzejdJUHJKaVdrQVU
- status: completed

## Prompt

```text
You are Blueprint's city launch research director.

Objective: produce the most expansive, detailed, operator-ready city launch playbook possible for Seattle, WA, Washington.
This is not a generic startup memo. Build a launch system that humans and agents can execute.

Blueprint doctrine and operating context:
- capture-first and world-model-product-first
- Exact-Site Hosted Review is the active wedge
- do not invent traction, sites, rights, providers, or readiness states
- keep rights, privacy, provenance, hosted-session truth, and human gates explicit
- city launch planning must stay useful in 2026 with AI agents and human operators working together

Research brief:
1. Study city-launch mechanics used by analogous companies such as Uber, DoorDash, Instacart, Airbnb, Lime.
2. Identify the transferable patterns behind how those companies seeded supply, demand, trust, operations, referral loops, and city sequencing.
3. Separate what transfers cleanly to Blueprint from what does not, given Blueprint is a capture-first, exact-site world-model product rather than rideshare or delivery.
4. Translate that into a Blueprint-specific launch playbook for Seattle, WA.
5. Explicitly account for the 2026 AI era: agent-assisted planning, agent-prepared outbound, operator review lanes, instrumentation, and workflow automation.
6. Bias toward first-principles and concrete operating mechanics instead of generic growth advice.

Required deliverable shape:
- Executive summary
- City thesis and why now
- Analog comparison table: Uber / DoorDash / Instacart / Airbnb / one robotics-infra analog
- What Blueprint should copy, adapt, reject
- Supply-side launch design: first 25, first 100, first 250 capturers
- Demand-side launch design: first 10, first 25, first 50 robot-team conversations
- Proof-asset design: what exact proof packs, hosted reviews, and site assets must exist before scale
- Human and agent operating model by lane
- Funnel instrumentation and launch gates
- Weekly execution plan for the first 12 weeks
- Outreach playbooks, referral loops, and city-specific channel strategy
- Ops readiness checklist and failure modes
- Spend tiers: zero-budget, low-budget, and funded
- Research gaps and what must be validated locally before any public-beta claim

Formatting requirements:
- write in Markdown
- include tables where useful
- cite specific sources throughout
- call out unsupported assumptions explicitly instead of smoothing them over
- if data is missing, say it is missing

Repo context to ground the work:
## PLATFORM_CONTEXT.md

# Platform Context

> **Source of truth:** [Blueprint Knowledge](https://www.notion.so/16d80154161d80db869bcfba4fe70be3) — Platform Doctrine
> This file is the repo-authoritative mirror of Blueprint Knowledge for core system framing.
> All Blueprint agent roles and developers consuming this file should treat Notion as the canonical
> operational surface and this file as the definitional source of truth within the repo.
> When changes are made to Notion Knowledge, the Notion Manager agent is responsible for pushing
> mirror updates to this file. When changes are made here, they should be reconciled back.

<!-- SHARED_PLATFORM_CONTEXT_START -->
## Shared Platform Doctrine

### System Framing

- `BlueprintCapture` is the capture client and supply-side evidence collection tool.
- `BlueprintCapturePipeline` turns capture bundles through the bridge and GPU compatibility contracts into site-specific world-model packages, hosted-session artifacts, and optional trust / review outputs.
- `Blueprint-WebApp` is the buyer, licensing, ops, and hosted-access surface around those packages.
- `BlueprintValidation` remains optional downstream infrastructure for deeper benchmarking, robot evaluation, and specialized runtime checks.

This platform is capture-first and world-model-product-first.
The bridge materialization contract and GPU compatibility contract are downstream compatibility layers, not sources of capture truth.

### Product Center of Gravity

The center of gravity is:

- broad real-world capture coverage
- strong capture quality and provenance
- site-specific world models and hosted access for robot teams
- rights, privacy, and commercialization controls
- buyer-facing product surfaces that make real sites easy to browse, buy, run, and manage

The center of gravity is not:

- generic marketplace browsing as the main story
- qualification/readiness as the main thing Blueprint sells
- one-off model demos disconnected from real capture
- a single permanent world-model backend

### Market Structure

The core business engine is two-sided:

- **Capturers** supply real-site evidence packages.
- **Robot teams** buy site-specific world models, hosted access, and related outputs.

`Site operators` remain important, but they are an optional third lane for:

- access control
- rights / consent / privacy boundaries
- commercialization and revenue sharing

The platform must support lawful capture and packaging even when a site has not already gone through a pre-negotiated intake flow. Site-operator involvement is a supported workflow branch, not a universal prerequisite for all capture.

### Truth Hierarchy

- raw capture, timestamps, poses, device metadata, and provenance are authoritative
- rights / privacy / consent metadata are authoritative
- site-specific world-model packages and hosted-session artifacts are the primary sellable downstream products
- qualification / readiness / review outputs are optional trust layers that can guide buying, commercialization, and deployment decisions
- downstream outputs must not rewrite capture truth or provenance truth

### Product Stack

1. primary product: capture supply and real-site coverage
2. second product: site-specific world models and hosted access
3. third product: optional trust / review / readiness outputs
4. fourth product: deeper evaluation, managed tuning, licensing, and deployment support

### Default Lifecycle

1. A capture is sourced proactively or through a buyer / site / ops request.
2. `BlueprintCapture` records and uploads a truthful evidence bundle.
3. `BlueprintCapturePipeline` materializes site-specific packages, hosted artifacts, and optional trust outputs.
4. `Blueprint-WebApp` exposes those outputs through buyer, ops, licensing, and hosted-session surfaces.
5. Optional review, deeper evaluation, or managed support follows only when commercially useful.

### Practical Rule For Agents

When changing any Blueprint repo, optimize for:

1. stronger real-site capture supply
2. better site-specific world-model outputs and hosted access
3. stable rights / privacy / provenance contracts
4. buyer and ops surfaces that make those outputs easy to sell and use
5. optional trust / readiness layers that support the product without becoming the product story

Do not assume that every capture must begin with formal site qualification.
Do not treat qualification/readiness as the universal center of the company.
Do not overstate world-model quality beyond what capture, privacy, and runtime artifacts support.
<!-- SHARED_PLATFORM_CONTEXT_END -->

## WORLD_MODEL_STRATEGY_CONTEXT.md

# World Model Strategy Context

> **Source of truth:** [Blueprint Knowledge](https://www.notion.so/16d80154161d80db869bcfba4fe70be3) — World Model Strategy
> This file is the repo-authoritative mirror of Blueprint Knowledge for world-model strategy framing.
> All Blueprint agent roles and developers consuming this file should treat Notion as the canonical
> operational surface and this file as the definitional source of truth within the repo.
> When changes are made to Notion Knowledge, the Notion Manager agent is responsible for pushing
> mirror updates to this file. When changes are made here, they should be reconciled back.

<!-- SHARED_WORLD_MODEL_STRATEGY_START -->
## Strategic Doctrine

Blueprint should assume world models will improve rapidly and that multiple viable model providers, checkpoints, papers, and hosted services will exist over time.

Blueprint should not build the company around owning one permanent model.

Blueprint's durable moat should be:

1. capture supply and real-site coverage
2. rights-safe, provenance-safe, privacy-safe data pipelines
3. site-specific world-model packages and hosted access
4. buyer, licensing, and ops product surfaces around those packages
5. a compounding capture -> package -> buyer usage -> more capture flywheel

The model backend matters, but it should remain a replaceable engine behind stable capture, packaging, and product contracts.

## Core Belief

Blueprint is not qualification-first and not model-first.

Blueprint is capture-first and world-model-product-first.

That means:

- real capture supply is the entry point
- site-specific world models and hosted sessions are the primary sellable outputs
- qualification / readiness can exist as optional trust layers, especially for high-stakes buyers, commercialization decisions, or deployment review
- those trust layers should support the product, not define the company

## Practical Strategic Conclusion

Do not overfit the platform to any one of:

- a single model paper
- a single checkpoint family
- a single provider
- a single inference trick
- a single hardware profile

Instead, build the stack so that better model backends can be dropped in later with minimal changes above the model-adapter layer.

## Current Product Truth

Today, the strongest near-term value comes from:

1. capturing real indoor spaces at scale
2. turning those captures into site-specific world models and hosted access
3. preserving strong rights, privacy, and provenance metadata around those assets
4. giving robot teams clear buyer surfaces to browse, buy, run, and manage exact-site products
5. using qualification / readiness outputs only when they materially improve trust, pricing, commercialization, or deployment decisions

Native SWM-like interaction remains an important direction, but it is not the only thing customers need in order for the product to be valuable now.

## How To Think About The Runtime

The runtime should be treated as a bridge architecture:

- immediate interaction should come from truthful, site-grounded rendering and hosted-session paths
- more generative continuation can sit behind that as optional refinement
- the browser/runtime contract should not assume one model family

This keeps the product useful now while preserving room for stronger native world-model behavior later.

## What Must Stay Stable Across Model Swaps

These should be treated as long-lived platform contracts:

- raw capture bundle structure
- timestamps, poses, intrinsics, depth, and device metadata
- consent, rights, privacy, and provenance metadata
- bridge materialization contract
- GPU pipeline compatibility contract
- site-specific package manifests
- hosted-session and runtime session contracts
- buyer attachment, licensing, and sync contracts
- truth labeling in UI and APIs

Qualification / readiness outputs should stay compatible where they exist, but they should be treated as optional support contracts rather than the only source of product value.

## What Must Remain Swappable

These should be deliberately replaceable:

- world-model checkpoints
- world-model providers
- inference services
- retrieval-conditioned generation strategies
- refinement models
- training/export adapters

No repo should assume one specific model or provider is permanent.

## Platform Moat

Blueprint's moat should come from assets that get stronger when models commoditize:

- better real-site capture coverage
- better capture quality and provenance
- better rights / privacy / commercialization handling
- better site-specific packaging and hosted access
- better buyer UX and operational surfaces
- better feedback loops from real buyer usage on real sites

If world models become easier to buy, proprietary real-site capture and product workflow should become more valuable, not less.

## Product Implication

The company should be able to say:

- we do not depend on owning the single best world model
- we are the best system for turning real sites into site-specific world-model products and hosted experiences
- we can add trust, review, and readiness layers when they help, without making them the center of the company

## Build Priorities Right Now

For the current stage, prioritize:

1. capture quality and coverage
2. packaging captures into strong site-specific world models
3. hosted access and buyer usability
4. rights / privacy / provenance rigor
5. stable product contracts that survive backend swaps
6. optional trust / readiness outputs for the cases that need them

Do not spend disproportionate time pushing qualification/readiness into the lead product story when the main commercial value comes from capture supply and site-specific world-model access.

## Data Priority

Collect and preserve data now as if future world-model training and evaluation will depend on it.

That means preserving:

- walkthrough video
- motion / trajectory logs
- camera poses
- intrinsics
- depth when available
- timestamps and temporal alignment data
- device / modality metadata
- site / scenario / deployment context
- privacy / consent / rights metadata
- retrieval / reference relationships when derived

Future model quality and package quality will depend heavily on data quality and structure.

## Repo-Level Guidance

Each repo should optimize for the same posture:

- `BlueprintCapture`: capture the richest, cleanest, most reusable real-site evidence possible while keeping the bridge and GPU compatibility surfaces aligned with the raw bundle truth
- `BlueprintCapturePipeline`: turn that evidence into site-specific world-model products, hosted-session artifacts, and optional trust layers without coupling the platform to one backend
- `Blueprint-WebApp`: sell, deliver, and operate those products through clear buyer and ops surfaces

## Non-Goal

Do not assume the platform is "done" only when a perfect SWM runtime exists.

The correct goal is:

- build everything around capture, packaging, and buyer workflow so stronger world-model backends can be adopted later without a company-wide rebuild

## Decision Rule For Future Sessions

When choosing between:

- investing in model-specific hacks
- investing in reusable capture / packaging / product infrastructure

default toward reusable infrastructure unless a model-specific change materially improves near-term user-visible value without increasing long-term coupling.
<!-- SHARED_WORLD_MODEL_STRATEGY_END -->

## AUTONOMOUS_ORG.md

# Blueprint Autonomous Organization Guide

> **Source of truth:** [Blueprint Knowledge](https://www.notion.so/16d80154161d80db869bcfba4fe70be3) — Autonomous Organization Guide
> This file is the repo-authoritative mirror of Blueprint Knowledge for org structure and agent roles.
> All Blueprint agent roles and developers consuming this file should treat Notion as the canonical
> operational surface and this file as the definitional source of truth within the repo.
> When changes are made to Notion Knowledge, the Notion Manager agent is responsible for pushing
> mirror updates to this file. When changes are made here, they should be reconciled back.

## Overview

Blueprint runs as an autonomous organization powered by [Paperclip](https://github.com/paperclipai/paperclip). Every operational role — from buyer intake to market research to conversion optimization — is modeled as a persistent agent with defined responsibilities, triggers, human gates, and a graduation path toward full autonomy.

This guide covers the full org so that any agent or human working in any Blueprint repo understands who does what, how work flows, and where the boundaries are.

On the current trusted host, Paperclip uses local subscription-backed auth only. Claude is the default executive/review lane and Codex is the default implementation lane, but reconcile automatically fails a workspace over to the other local adapter when the default adapter is unhealthy or rate-limited.

**Key principles:**
- Capture-first, world-model-product-first positioning (see `PLATFORM_CONTEXT.md`)
- Progressive autonomy — agents start supervised and graduate based on track record
- Paperclip is the execution and ownership record; Notion is the workspace, knowledge, review, and operator-visibility surface; repo files are the definitional source of truth
- Autoresearch-pattern loops drive continuous optimization (adapted from [Karpathy's autoresearch](https://github.com/karpathy/autoresearch))
- Growth should stay anchored to one narrow commercial wedge at a time. The current priority wedge is **Exact-Site Hosted Review**: one real site, one workflow lane, one package-plus-hosted-review path, with explicit human gates on pricing, policy, rights, and irreversible commitments.
- Founder scope stays narrow: irreversible or company-level decisions only. Routine launch, commercial, and ops approvals belong in named operator lanes with agents preparing evidence, packets, and exception routing.
- Named operator lanes in the current model: Growth Lead for channel/referral/source posture, Ops Lead for intake/threshold/trust-kit readiness, designated human commercial owner for standard quotes inside approved bands, and designated human rights reviewer for sensitive trust cases.

---

## Org Chart

```
                           ┌──────────────┐
                           │  CEO Agent   │ ← Human founder is the board
                           │   (Claude)   │
                           └──────┬───────┘
                                  │
                         ┌────────┴────────┐
                         │ Chief of Staff  │
                         │   (Hermes)      │
                         └──────┬───────┬──┘
                                │       │
                 ┌──────────────┘       └──────────────┐
                 │                                     │
          ┌──────┴──────┐  ┌─────┴──────┐  ┌──────┴───────┐
          │  CTO Agent  │  │  Ops Lead  │  │ Growth Lead  │
          │  (Claude)   │  │  (Hermes)  │  │   (Hermes)   │
          └──────┬──────┘  └─────┬──────┘  └──────┬───────┘
                 │               │                 │
       ┌─────┬──┴──┐      ┌─────┼─────┐     ┌─────┼─────┐
       │     │     │       │     │     │     │     │     │
     Impl  Impl  Beta   Intk  QA   Fld   Conv  Anly  Mkt
     (x3)  Revw  Lnch   Agnt  Agnt Ops   Opt   Agnt  Intel
     Codex (x3)  Cmdr   Cld   Cld  Agnt  Cld   Cld   Cld
           Claude Cld          Cld
                         ┌─────┼─────┐
                         │     │     │
                        Buyr  Rghts  Capt
                        Soln  Prov   Succ
                        Herm  Cld    Herm
```

### Departments

| Department | Lead | Agents | Focus |
|-----------|------|--------|-------|
| **Executive** | CEO | CEO, Chief of Staff, CTO, Investor Relations, Notion Manager, Revenue Ops & Pricing, legacy Notion Reconciler | Strategy, priorities, decision packaging, workspace stewardship, and commercial system discipline |
| **Engineering** | CTO | 6 agents (impl + review per repo) + Beta Launch Commander + Docs Agent | Code implementation, review, release orchestration, and documentation |
| **Ops** | Ops Lead | 12 agents | Product operations lifecycle, buyer solutions, technical enablement, rights/trust, enterprise review, capturer success, catalog, and buyer success |
| **Growth** | Growth Lead | 13 defined lanes, 5 active core lanes | Analytics, conversion, market/demand intelligence, one city-demand loop, and explicit pause control over all non-core growth work |

---

## Role Registry

### Executive Layer

---

#### CEO (`blueprint-ceo`)

| Field | Value |
|-------|-------|
| **Department** | Executive |
| **Reports to** | Human founder (board) |
| **Model** | Claude |
| **Status** | Live in Paperclip package |

**Purpose:** Sets company priorities, reviews cross-department status, handles escalations, interfaces with human founder.

**Triggers:**
- `0 8 * * 1-5` — Daily 8am ET company-wide priority review (weekdays)

**Inputs:** Ops Lead daily digest, Growth Lead reports, CTO triage summaries, escalations from any agent.

**Outputs:**
- Company priority ranking
- Escalation decisions
- Strategy direction updates
- Weekly founder briefing

**Human gates:** Strategy and budget decisions always require founder approval.

**Graduation:** N/A — executive role, always reports to human.

**Instructions:** `ops/paperclip/blueprint-company/agents/blueprint-ceo/AGENTS.md`
**Paperclip config:** `ops/paperclip/blueprint-company/.paperclip.yaml`

---

#### Chief of Staff (`blueprint-chief-of-staff`)

| Field | Value |
|-------|-------|
| **Department** | Executive |
| **Reports to** | CEO |
| **Model** | Hermes (OpenRouter Arcee free primary, Arcee/Z.ai ladder before Codex fallback) |
| **Status** | Live in Paperclip package |

**Purpose:** Runs the continuous managerial loop. Watches issue state, routine health, queue changes, and agent activity; decides what finished, what stalled, and what needs a next action; routes or closes work in Paperclip; and packages every founder or human gate as a standard decision packet instead of a vague escalation.

**Triggers:**
- `*/5 * * * *` — Continuous manager loop
- Event wakeups from issue create/update, routine activity, queue intake, and agent failures via the Blueprint automation plugin

**Inputs:** `blueprint-manager-state`, Blueprint automation recent events, active issues, routine health, queue sync state, and repo/plugin evidence.

**Outputs:**
- Concrete Paperclip issue creation/update/closure
- Delegations and blocker follow-up issues
- Cross-agent follow-through decisions
- Founder decision packets with one recommendation, one exact ask, one deadline, and one follow-through owner
- Slack-visible manager wakeups and task-routing activity
- Human-reply watcher ownership for blocker packets, including correlation, reply classification, and delegated execution handoff

**Human gates:** Strategy, budget, rights/privacy, commercialization commitments, legal, policy, and other irreversible high-risk decisions.

**Instructions:** `ops/paperclip/blueprint-company/agents/blueprint-chief-of-staff/AGENTS.md`
**Paperclip config:** `ops/paperclip/blueprint-company/.paperclip.yaml`

---

#### CTO (`blueprint-cto`)

| Field | Value |
|-------|-------|
| **Department** | Executive |
| **Reports to** | CEO |
| **Model** | Claude |
| **Status** | Live in Paperclip package |

**Purpose:** Technical decisions, cross-repo coordination, architecture review. Routes non-technical ops issues to Ops Lead and reviews technical blocker replies when the human response changes diagnosis or raises a platform-contract question.

**Triggers:**
- `30 8 * * 1-5` — Morning triage (8:30am ET)
- `0 14 * * 1-5` — Afternoon triage (2pm ET)

**Inputs:** GitHub events, CI status, PR reviews, engineering agent reports, technical escalations.

**Outputs:**
- Technical priority assignments
- Architecture decisions
- Engineering agent work items
- Technical escalations to CEO

**Human gates:** Architecture decisions affecting platform contracts.

**Graduation:** N/A — executive role.

**Instructions:** `ops/paperclip/blueprint-company/agents/blueprint-cto/AGENTS.md`
**Paperclip config:** `ops/paperclip/blueprint-company/.paperclip.yaml`

---

#### Investor Relations Agent (`investor-relations-agent`)

| Field | Value |
|-------|-------|
| **Department** | Executive |
| **Reports to** | Chief of Staff |
| **Model** | Hermes (OpenRouter Arcee free primary, Arcee/Z.ai ladder before Codex fallback) |
| **Status** | New |

**Purpose:** Produces the monthly investor update from real month-over-month metrics, shipped work, operating risks, and concrete asks. Drafts investor-facing blog/email artifacts but never sends them live.

**Triggers:**
- `0 8 1 * *` — Monthly investor draft run (8am ET on the first calendar day)
- Event: CEO or Chief of Staff requests an ad-hoc investor-ready draft

**Inputs:**
- Stripe, Firestore, GA4/PostHog, Paperclip issue completions, and Firehose signals
- `ops/paperclip/programs/investor-relations-agent-program.md`
- The [$humanizer](/Users/nijelhunt_1/.agents/skills/humanizer/SKILL.md) skill for final copy cleanup

**Outputs:**
- Investor update draft → Notion Knowledge DB
- Review artifact → Notion Work Queue
- Draft investor campaign → SendGrid-backed draft path (when configured)
- Internal review note → Slack `#exec` (when configured)

**Human gates:** Any live send/publish, fundraising language, projections, runway claims, or board-sensitive disclosures.

**Instructions:** `ops/paperclip/blueprint-company/agents/investor-relations-agent/AGENTS.md`
**Program:** `ops/paperclip/programs/investor-relations-agent-program.md`

---

#### Notion Manager Agent (`notion-manager-agent`)

| Field | Value |
|-------|-------|
| **Department** | Executive |
| **Reports to** | Chief of Staff |
| **Model** | Hermes (OpenRouter Arcee free primary, Arcee/Z.ai ladder before Codex fallback) |
| **Status** | New |

**Purpose:** Sole owner of Blueprint's Notion hygiene. Keeps Work Queue, Knowledge, Skills, and linked Hub surfaces correctly placed, properly related, visibly fresh, and safely deduped without replacing Paperclip as the execution record.

**Triggers:**
- Event-driven drift repair for duplicate, stale, or misplaced Blueprint-managed pages
- Manual or targeted reconciliation when Chief of Staff, Ops Lead, Growth Lead, or a producer issue flags Notion state that the write path could not repair safely
- Broad recurring sweeps stay paused until idempotency and drift rules are stable

**Inputs:**
- Paperclip issues, routine proof, and producer comments
- Blueprint Hub databases and linked pages
- Manager and exec Slack visibility paths for escalation
- `ops/paperclip/blueprint-company/agents/notion-manager-agent/AGENTS.md`

**Outputs:**
- Repaired Notion metadata, relations, freshness fields, and safe duplicate cleanup
- Escalation comment on affected page when the fix is unsafe or ambiguous
- Follow-up Paperclip issue plus manager-visible Slack alert when a page cannot be auto-repaired safely

**Human gates:** Ambiguous page identity, contested ownership, rights/privacy-sensitive content, arbitrary workspace cleanup outside Blueprint-managed Hub surfaces, or any move/archive decision without strong evidence.

**Instructions:** `ops/paperclip/blueprint-company/agents/notion-manager-agent/AGENTS.md`

---

#### Notion Reconciler (`notion-reconciler`)

| Field | Value |
|-------|-------|
| **Department** | Executive |
| **Reports to** | Notion Manager Agent |
| **Model** | Hermes (Paperclip execution truth, Notion visibility mirror) |
| **Status** | Paused legacy shim |

**Purpose:** Legacy compatibility shim for the former Notion-facing pilot reconcile loop. Active ownership has been merged into `notion-manager-agent`; this lane remains paused only so old references can be retired safely without silent breakage.

**Triggers:**
- None by default. Historical routines remain paused.
- Event: legacy manual wake or old follow-up issue that still points at `notion-reconciler`

**Inputs:**
- Blueprint Work Queue, Knowledge, Skills, Agents, and Agent Runs databases
- Paperclip issue state and routine context
- `ops/paperclip/blueprint-company/agents/notion-reconciler/AGENTS.md`

**Outputs:**
- redirect note pointing legacy work to `notion-manager-agent`
- backward-compatible run mirror only when an old action still uses the legacy recorder
- blocked follow-up comment when the cleanup is unsafe or ambiguous

**Human gates:** Ambiguous page identity, unsafe move/archive decisions, and rights/privacy-sensitive cleanup.

**Instructions:** `ops/paperclip/blueprint-company/agents/notion-reconciler/AGENTS.md`

---

#### Revenue Ops & Pricing Agent (`revenue-ops-pricing-agent`)

| Field | Value |
|-------|-------|
| **Department** | Executive |
| **Reports to** | Chief of Staff |
| **Model** | Hermes (OpenRouter Arcee free primary, Arcee/Z.ai ladder before Codex fallback) |
| **Status** | New |

**Purpose:** Maintains Blueprint's pricing and commercial system discipline. Connects buyer demand, site-catalog supply, usage, and delivery-cost signals into draft pricebook updates, package guidance, quote support, and discount guardrails without taking over buyer-thread ownership or making live commercial commitments. The designated human commercial owner uses this lane for standard quote decisions inside approved bands.

**Triggers:**
- Event: designated human commercial owner, chief-of-staff, buyer-solutions-agent, or growth-lead requests quote or package guidance
- Standing weekly pricing review remains paused until buyer volume or pricing-system drift justifies it

**Inputs:**
- Stripe revenue and checkout state
- buyer journey issues, buyer-success feedback, analytics, and conversion findings
- site catalog and current pricing surfaces
- `ops/paperclip/programs/revenue-ops-pricing-agent-program.md`

**Outputs:**
- Draft pricebook and package updates
- Quote support summaries and discount guardrail recommendations
- Commercial contradiction reports when pricing, catalog, and delivery truth diverge
- Follow-up work for product, ops, growth, or finance when pricing questions expose deeper gaps

**Human gates:** Live pricing changes, discounts, terms, contract commitments, revenue-share logic, and any non-standard commercial offer.

**Instructions:** `ops/paperclip/blueprint-company/agents/revenue-ops-pricing-agent/AGENTS.md`
**Program:** `ops/paperclip/programs/revenue-ops-pricing-agent-program.md`

---

### Engineering Department

All 6 engineering agents already exist in Paperclip. They are organized as implementation + review pairs per repo.

| Agent | Model | Repo | Trigger |
|-------|-------|------|---------|
| `webapp-codex` | Codex | Blueprint-WebApp | Issue assignment |
| `webapp-claude` | Claude | Blueprint-WebApp | PR/issue events |
| `pipeline-codex` | Codex | BlueprintCapturePipeline | Issue assignment |
| `pipeline-claude` | Claude | BlueprintCapturePipeline | PR/issue events |
| `capture-codex` | Codex | BlueprintCapture | Issue assignment |
| `capture-claude` | Claude | BlueprintCapture | PR/issue events |

**Current state:** Engineering agents are already configured around issue-driven Paperclip loops, so Ops and Growth work can route through Paperclip issues rather than only GitHub-originated events.

---

### Ops Department

---

#### Ops Lead (`ops-lead`)

| Field | Value |
|-------|-------|
| **Department** | Ops |
| **Reports to** | Chief of Staff |
| **Model** | Hermes (OpenRouter Arcee free primary, Arcee/Z.ai ladder before Codex fallback) |
| **Status** | New |

**Purpose:** Coordinates all product operations. Routes work between intake, QA, scheduling, and finance agents. Produces daily ops summary. Owns routine city-launch ops guardrails: intake rubric approval, first-capture thresholds, trust kit, and launch-readiness checklist for Austin and San Francisco. Escalates only true exceptions to CEO/founder lanes.

**Triggers:**
- `30 8 * * 1-5` — Morning ops review (8:30am ET)
- `30 14 * * 1-5` — Afternoon ops review (2:30pm ET)
- Event: Any ops agent escalation or blocker

**Inputs:**
- Firestore collections: waitlist, inbound_requests, capture_submissions, support_tickets, stripe_events
- Notion Work Queue (Ops-tagged items)
- Specialist agent reports and escalations

**Outputs:**
- Daily ops digest → Notion Work Queue + Slack
- Priority assignments → Paperclip issues for specialist agents
- Escalations → CEO agent
- Weekly ops trend summary → CEO + Growth Lead
- Resumed execution ownership for non-technical human replies unless a narrower buyer, rights, or commercial lane already owns the thread

**Human gates:** Ops Lead is itself the routine human operator lane for launch-readiness ops. Founder escalation is only for spend, policy, rights/privacy, legal, or other irreversible exceptions.

**External needs:** Firestore read, Notion API, Slack webhook.

**Graduation path:**
| Phase | Behavior | Criteria to advance |
|-------|----------|-------------------|
| 1 | Read-only monitoring + draft summaries for human review | 2 weeks, <10% override rate |
| 2 | Auto-route P2/P3 work to specialist agents without approval | 1 month, no mis-routes |
| 3 | Auto-route all work; human reviews weekly summary only | Founder sign-off |

**Skill file:** `ops/paperclip/skills/ops-lead.md`

---

#### Waitlist & Intake Agent (`intake-agent`)

| Field | Value |
|-------|-------|
| **Department** | Ops |
| **Reports to** | Ops Lead |
| **Model** | Claude |
| **Status** | New |

**Purpose:** Processes capturer applications (waitlist) and buyer inbound requests. Classifies by intent, scores readiness, detects missing info, drafts responses, and prepares operator-ready invite or follow-up recommendations inside approved policy. Routine invite or access-code issuance remains human-operated.

**Triggers:**
- Webhook: Firestore onCreate on waitlist and inbound_requests collections
- `0 * * * *` — Hourly queue scan for stuck items
- Event: Ops Lead assignment

**Inputs:**
- Waitlist collection: capturer applications, device metadata, market info
- Inbound requests collection: buyer requests, site details, use case info
- Market-device fit matrix (Knowledge DB)

**Outputs:**
- Classification label + priority score on each record
- Draft invite/reject/follow-up messages
- Operator-ready invite or access recommendation packets routed to Growth Lead / Ops Lead inside approved city policy
- Missing-info flags with specific questions
- Updates to Notion Work Queue

**Human gates:**
- High-risk or low-confidence outbound messages
- Rejections and edge cases
- Rights/privacy/commercial commitment cases

**External needs:** Firestore read/write, SendGrid or email API (drafts), Notion API.

**Graduation path:**
| Phase | Behavior | Criteria to advance |
|-------|----------|-------------------|
| 1 | Classify + score only; human sends all messages | 2 weeks, classification accuracy >90% |
| 2 | Auto-send low-risk follow-up only; Growth Lead / Ops Lead issue invites and access decisions inside policy | Shipped in WebApp |
| 3 | Expand operator-approved invite execution only if policy and outcomes justify it | Ops Lead + Growth Lead sign-off |

**Skill file:** `ops/paperclip/skills/intake-agent.md`

---

#### Capture QA Agent (`capture-qa-agent`)

| Field | Value |
|-------|-------|
| **Department** | Ops |
| **Reports to

[Truncated for prompt budget]

## DEPLOYMENT.md

# Blueprint Deployment

## Build and Runtime

Blueprint uses a single build pipeline:

```bash
npm ci
npm run check
npm run test:coverage
npm run build
```

Release gate:

```bash
npm run alpha:check
```

Launch preflight:

```bash
npm run alpha:preflight
```

Live alpha smoke:

```bash
npm run smoke:launch
```

- Client build: Vite (`dist/public`)
- Server build: esbuild bundle from `server/index.ts` (`dist/index.js`)
- Runtime start command:

```bash
npm start
```

## Render Blueprint

The repo now includes [render.yaml](/Users/nijelhunt_1/workspace/Blueprint-WebApp/render.yaml) for the primary alpha deployment path.

- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Health check: `/health/ready`

Render should hold all secrets in the service environment, not in `render.yaml`.

## Required Environment Variables

### Firebase (client)
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- Optional: `VITE_FIREBASE_DATABASE_URL`, `VITE_FIREBASE_MEASUREMENT_ID`

Launch-critical note:
- The client no longer falls back to source-level Firebase values. These variables must be present in the runtime environment used for builds and tests.

### Firebase Admin (server)
Provide one of the following, or run on Cloud Run / Cloud Functions with an attached service account:
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `GOOGLE_APPLICATION_CREDENTIALS`

Launch-critical note:
- Buyer checkout auth, marketplace entitlements, pipeline attachment sync, creator ledgers, and inbound request persistence all depend on Firebase Admin being live in production.

### Field Encryption (server)
- one of:
  - `FIELD_ENCRYPTION_MASTER_KEY`
  - `FIELD_ENCRYPTION_KMS_KEY_NAME`

Launch-critical note:
- Inbound request persistence encrypts contact and request fields before storage.
- If neither field-encryption env is configured, `/api/inbound-request` can fail even when `/health/ready` would otherwise look healthy.

### Contact + Signup Links
- `VITE_PUBLIC_APP_URL` (canonical public origin used for generated links)
- `VITE_GOOGLE_CLIENT_ID`
- `VITE_GOOGLE_APP_ID`
- Optional: `VITE_GOOGLE_MAPS_API_KEY`

### Stripe (server)
- `STRIPE_SECRET_KEY`
- `STRIPE_CONNECT_ACCOUNT_ID`
- `STRIPE_WEBHOOK_SECRET`
- `CHECKOUT_ALLOWED_ORIGINS`
- Optional: `STRIPE_PUBLIC_BASE_URL`, `STRIPE_ONBOARDING_REFRESH_URL`, `STRIPE_ONBOARDING_RETURN_URL`

### Agent Runtime (server)
- one of:
  - `OPENAI_API_KEY`
  - `ANTHROPIC_API_KEY`
  - `ACP_HARNESS_URL`
- Optional provider selection:
  - `BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER`
  - `BLUEPRINT_STRUCTURED_AUTOMATION_FALLBACK_PROVIDER`
- Optional: `OPENAI_DEFAULT_MODEL`
- Optional: `ANTHROPIC_DEFAULT_MODEL`
- Optional: `ACP_DEFAULT_HARNESS`
- Optional analytics mirror:
  `BLUEPRINT_ANALYTICS_INGEST_ENABLED=1`
- Optional per-lane overrides:
  `OPENAI_WAITLIST_AUTOMATION_MODEL`,
  `OPENAI_INBOUND_QUALIFICATION_MODEL`,
  `OPENAI_POST_SIGNUP_MODEL`,
  `OPENAI_SUPPORT_TRIAGE_MODEL`,
  `OPENAI_PAYOUT_EXCEPTION_MODEL`,
  `OPENAI_PREVIEW_DIAGNOSIS_MODEL`,
  `OPENAI_OPERATOR_THREAD_MODEL`
- Anthropic per-lane overrides are also supported:
  `ANTHROPIC_WAITLIST_AUTOMATION_MODEL`,
  `ANTHROPIC_INBOUND_QUALIFICATION_MODEL`,
  `ANTHROPIC_POST_SIGNUP_MODEL`,
  `ANTHROPIC_SUPPORT_TRIAGE_MODEL`,
  `ANTHROPIC_PAYOUT_EXCEPTION_MODEL`,
  `ANTHROPIC_PREVIEW_DIAGNOSIS_MODEL`,
  `ANTHROPIC_OPERATOR_THREAD_MODEL`

### Internal Marketplace + Pipeline
- `PIPELINE_SYNC_TOKEN`
- `BLUEPRINT_REQUEST_REVIEW_TOKEN_SECRET`
- Optional internal-only fallback: `PIPELINE_SYNC_ALLOW_PLACEHOLDER_REQUESTS=true`
- Optional internal demo flags: `BLUEPRINT_ENABLE_DEMO_SITE_WORLDS=1`, `BLUEPRINT_DEMO_BUNDLE_PIPELINE_ROOT=/abs/path`, `BLUEPRINT_HOSTED_DEMO_SITE_WORLD_ID=<id>`

Launch-critical note:
- Leave `PIPELINE_SYNC_ALLOW_PLACEHOLDER_REQUESTS` unset in paid/production flows so pipeline sync fails closed when inbound request bootstrap is missing.
- Leave demo site-world flags unset in production unless you explicitly want the internal demo world exposed.

### Redis (server, recommended for live hosted sessions)
- Optional but recommended: `REDIS_URL`
- Optional: `RATE_LIMIT_REDIS_URL` if you want rate limiting isolated from session live-state storage

For Upstash, use the TLS Redis URL from the Connect panel, for example:

```bash
REDIS_URL=rediss://default:<token>@active-phoenix-39183.upstash.io:6379
```

### Error Tracking
- Optional: `VITE_SENTRY_DSN`
- Optional: `VITE_ENABLE_ERROR_TRACKING_SMOKE_TEST=true`

### Growth Ops
- Optional PostHog client vars:
  `VITE_PUBLIC_POSTHOG_PROJECT_TOKEN`
  `VITE_PUBLIC_POSTHOG_HOST`
- Optional GA4 override:
  `VITE_GA_MEASUREMENT_ID`
  `VITE_FIREBASE_MEASUREMENT_ID` as the documented fallback alias when the GA-specific key is not set
- Optional first-party growth event mirror:
  `BLUEPRINT_ANALYTICS_INGEST_ENABLED=1`
- Optional SendGrid email delivery:
  `SENDGRID_API_KEY`
  `SENDGRID_FROM_EMAIL`
  `SENDGRID_FROM_NAME`
  `SENDGRID_EVENT_WEBHOOK_SECRET`
- Optional human-reply ingest and email watcher:
  `BLUEPRINT_HUMAN_REPLY_INGEST_TOKEN`
  `BLUEPRINT_HUMAN_REPLY_APPROVED_EMAIL`
  `BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_ID`
  `BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_SECRET`
  `BLUEPRINT_HUMAN_REPLY_GMAIL_REFRESH_TOKEN`
  `BLUEPRINT_HUMAN_REPLY_GMAIL_OAUTH_PUBLISHING_STATUS`
  `BLUEPRINT_HUMAN_REPLY_GMAIL_QUERY`
  `BLUEPRINT_HUMAN_REPLY_GMAIL_WATCHER_ENABLED=1`
  `BLUEPRINT_HUMAN_REPLY_GMAIL_WATCHER_INTERVAL_MS`
  `BLUEPRINT_HUMAN_REPLY_GMAIL_WATCHER_BATCH_SIZE`
  `BLUEPRINT_HUMAN_REPLY_GMAIL_WATCHER_STARTUP_DELAY_MS`
- Optional Slack human-reply watcher policy:
  `BLUEPRINT_HUMAN_REPLY_SLACK_ALLOW_DMS=1`
  `BLUEPRINT_HUMAN_REPLY_SLACK_ALLOWED_CHANNELS`
- Optional Notion operational mirror:
  `NOTION_API_KEY` or `NOTION_API_TOKEN`
  `NOTION_GROWTH_STUDIO_SHIP_BROADCAST_DB_ID`
  `NOTION_GROWTH_STUDIO_CAMPAIGN_DRAFTS_DB_ID`
  `NOTION_GROWTH_STUDIO_CREATIVE_RUNS_DB_ID`
  `NOTION_GROWTH_STUDIO_INTEGRATION_CHECKS_DB_ID`
  `NOTION_GROWTH_STUDIO_CONTENT_REVIEWS_DB_ID`

Important:
- For the Growth Studio mirror vars above, use the Notion data source UUIDs for each database, not the outer database page UUIDs.
- The Growth Studio sync path can be run by scheduler, by `POST /api/admin/growth/notion/sync`, or from the shell with `npm run notion:sync:growth-studio`.
- The human-reply Gmail watcher is valid only when the authenticated mailbox is the approved org-facing identity `ohstnhunt@gmail.com`. If Gmail OAuth resolves to another mailbox, the watcher must fail closed.
- `BLUEPRINT_HUMAN_REPLY_INGEST_TOKEN` also authorizes the internal human-blocker dispatch route used by Blueprint automation tools to queue or send standard blocker packets from Paperclip agent lanes.
- `BLUEPRINT_HUMAN_REPLY_GMAIL_OAUTH_PUBLISHING_STATUS` is a manual mirror of the Google OAuth consent-screen publishing state. If it is unset, treat Gmail OAuth durability as unknown rather than production-grade.
- Slack reply watching is operationally valid only for conversations the bot can actually see. DMs require `BLUEPRINT_HUMAN_REPLY_SLACK_ALLOW_DMS=1`. Channel replies require the bot to be present and the channel id to be listed in `BLUEPRINT_HUMAN_REPLY_SLACK_ALLOWED_CHANNELS`. Root-channel replies should fail closed.

### Creative Pipeline
- Google image generation:
  `GOOGLE_GENAI_API_KEY` or `GEMINI_API_KEY`
- Optional model override:
  `GOOGLE_CREATIVE_IMAGE_MODEL`
- Optional aspect-ratio default:
  `GOOGLE_CREATIVE_IMAGE_DEFAULT_ASPECT_RATIO`
- Optional Runway video generation:
  `RUNWAY_API_KEY`
  `RUNWAY_BASE_URL`
  `BLUEPRINT_RUNWAY_VIDEO_MODEL`

### Voice Concierge
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID`
- Optional:
  `ELEVENLABS_TTS_MODEL_ID`
  `ELEVENLABS_AGENT_ID`
  `ELEVENLABS_WEBHOOK_SECRET`
  `BLUEPRINT_VOICE_BOOKING_URL`
  `BLUEPRINT_SUPPORT_EMAIL`
  `TWILIO_ACCOUNT_SID`
  `TWILIO_AUTH_TOKEN`
  `TWILIO_PHONE_NUMBER`
  `BLUEPRINT_VOICE_FORWARD_NUMBER`

### Autonomous Alpha Automation

These should be enabled for the no-human-in-the-loop alpha configuration:

- `BLUEPRINT_WAITLIST_AUTOMATION_ENABLED=1`
- `BLUEPRINT_INBOUND_AUTOMATION_ENABLED=1`
- `BLUEPRINT_SUPPORT_TRIAGE_ENABLED=1`
- `BLUEPRINT_PAYOUT_TRIAGE_ENABLED=1`
- `BLUEPRINT_PREVIEW_DIAGNOSIS_ENABLED=1`
- `BLUEPRINT_EXPERIMENT_AUTOROLLOUT_ENABLED=1`
- `BLUEPRINT_AUTONOMOUS_RESEARCH_OUTBOUND_ENABLED=1`
- `BLUEPRINT_CREATIVE_FACTORY_ENABLED=1`
- `BLUEPRINT_BUYER_LIFECYCLE_ENABLED=1`

Optional review-watchdog workers that only flag overdue human queues:

- `BLUEPRINT_SITE_ACCESS_OVERDUE_WATCHDOG_ENABLED=1`
- `BLUEPRINT_FINANCE_REVIEW_OVERDUE_WATCHDOG_ENABLED=1`

These watchdogs do not send outreach, grant permissions, submit disputes, or move funds. They only mark overdue review state in Firestore so operators can work the queue.
- Optional field-ops reminder worker:
  `BLUEPRINT_CAPTURER_REMINDER_ENABLED=1`
- Optional buyer lifecycle cadence overrides:
  `BLUEPRINT_BUYER_LIFECYCLE_INTERVAL_MS`,
  `BLUEPRINT_BUYER_LIFECYCLE_BATCH_SIZE`,
  `BLUEPRINT_BUYER_LIFECYCLE_STARTUP_DELAY_MS`,
  `BLUEPRINT_BUYER_LIFECYCLE_DAYS_SINCE_GRANT`
- Optional experiment autorollout cadence and thresholds:
  `BLUEPRINT_EXPERIMENT_AUTOROLLOUT_INTERVAL_MS`,
  `BLUEPRINT_EXPERIMENT_AUTOROLLOUT_LOOKBACK_DAYS`,
  `BLUEPRINT_EXPERIMENT_AUTOROLLOUT_MIN_EXPOSURES`,
  `BLUEPRINT_EXPERIMENT_AUTOROLLOUT_MIN_RELATIVE_LIFT`
- Optional autonomous research-to-outbound configuration:
  `BLUEPRINT_AUTONOMOUS_RESEARCH_OUTBOUND_INTERVAL_MS`,
  `BLUEPRINT_AUTONOMOUS_RESEARCH_TOPICS`,
  `BLUEPRINT_AUTONOMOUS_OUTBOUND_RECIPIENTS`,
  `BLUEPRINT_AUTONOMOUS_OUTBOUND_CHANNEL`,
  `FIREHOSE_API_TOKEN`,
  `FIREHOSE_BASE_URL`
- Optional creative factory configuration:
  `BLUEPRINT_CREATIVE_FACTORY_INTERVAL_MS`,
  `BLUEPRINT_CREATIVE_FACTORY_SKU`,
  `BLUEPRINT_CREATIVE_FACTORY_AUDIENCE`,
  `BLUEPRINT_CREATIVE_FACTORY_SITE_TYPE`,
  `BLUEPRINT_CREATIVE_FACTORY_WORKFLOW`,
  `BLUEPRINT_CREATIVE_FACTORY_CTA`

Post-signup automation also requires:

- one of:
  `GOOGLE_CLIENT_EMAIL` + `GOOGLE_PRIVATE_KEY`
  or `FIREBASE_SERVICE_ACCOUNT_JSON`
  or `GOOGLE_APPLICATION_CREDENTIALS`
- `GOOGLE_CALENDAR_ID`
- `POST_SIGNUP_SPREADSHEET_ID` or `SPREADSHEET_ID`
- `SLACK_WEBHOOK_URL`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`

## Notes

- Firestore is the active datastore.
- In production, public world-model pages should surface pipeline-backed site worlds only. Static fixture cards are for non-production and explicit demo mode.
- Live hosted-session state now prefers Redis when `REDIS_URL` is configured, then falls back to in-process memory, with Firestore acting as async mirroring/trail storage.
- Marketplace checkout and artifact entitlement flows are only truthful when Firebase Admin, Stripe checkout, and Stripe webhooks are all configured together.
- Marketplace search and checkout now fail toward live `marketplace_items` inventory in production instead of silently relying on static sample content.
- Growth telemetry can now mirror experiment exposures, page views, and campaign events into Firestore when `BLUEPRINT_ANALYTICS_INGEST_ENABLED=1`, which gives Paperclip and the analytics agent a first-party event stream even before PostHog/GA4 are fully live.
- Experiment winners can now roll themselves into production overrides through the first-party event stream when the autorollout worker is enabled.
- Autonomous research can now turn configured Firehose demand topics into draft outbound campaigns and queue them for human send approval.
- The creative pipeline now supports both the protected campaign-kit builder and a background creative factory that can continuously generate proof-led prompt packs, images, and optional Runway tasks from live Blueprint signals.
- The voice concierge now supports both web voice and Twilio-compatible PSTN intake. Pricing, legal, privacy, rights, contract, and irreversible commitments remain human-gated, and phone handoff can forward to a live operator when configured.
- Legacy manual deployment scripts were removed; deployment should always run through project scripts.
- `client/public/robots.txt` must exist at build time and be served in production.
- `npm run alpha:preflight` is the launch-environment validator for Render and should pass before promoting the service.
- `npm run smoke:launch` is the live alpha smoke runner for `/health`, `/health/ready`, the selected structured automation provider, inbound qualification, and post-signup workflows.

## ops/paperclip/playbooks/city-launch-template.md

# City Name, State — Blueprint City Launch Guide

## Status
- phase: planning
- owner: city-launch-agent
- last-reviewed: YYYY-MM-DD
- recommended-posture: planning only | gated cohort pilot | do not launch
- last-human-launch-decision: not approved | approved with conditions

## Launch Thesis
- one short paragraph on why the city matters for Blueprint's capture-first, world-model-product-first strategy

## Why This City Now
- 3-5 bullets grounded in current Blueprint research, not generic city hype

## Recommended Launch Posture
- internal-only posture recommendation
- what should happen first
- what should stay explicitly human-gated

## Target Capturer Profile
- who fits this city best
- why that profile matches Blueprint's real capture needs

## Ranked Channel Stack
| Rank | Channel | Why it fits | Trust mechanism | Current posture |
|---|---|---|---|---|
| 1 |  |  |  |  |

## Trust Infrastructure Required Before Expansion
- what proof, rights, intake, and ops rails must exist before scale

## Readiness Scorecard
| Dimension | Score | Rationale |
|---|---:|---|
| channel reachability | 0/5 |  |
| likely supply quality | 0/5 |  |
| operations feasibility | 0/5 |  |
| measurement readiness | 0/5 |  |
| legal/compliance clarity | 0/5 |  |
| strategic importance | 0/5 |  |

## Dependency Map
| Function | What must exist before expansion | Current state |
|---|---|---|
| Growth |  |  |
| Conversion |  |  |
| Analytics |  |  |
| Intake |  |  |
| Field Ops |  |  |
| Ops |  |  |

## Near-Term Experiments
1. 
2. 
3. 

## Staffing / Ops Implications
- what changes operationally if this city moves forward

## Issue-Ready Work Queue
| Owner | Proposed issue | Why now | Done when |
|---|---|---|---|
|  |  |  |  |

## Human Gates
- what must stay human-approved

## Sequencing Recommendation
- where this city fits relative to the current queue

## ops/paperclip/playbooks/capturer-supply-playbook.md

# Blueprint Capturer Supply Playbook

## Purpose
This is the reusable Blueprint playbook for acquiring, activating, and retaining capturers before customizing tactics by city.

It should be updated by `capturer-growth-agent` as new market and operating evidence arrives.

## Core Thesis
Blueprint should grow capturer supply the same way it grows capture quality: truthfully and deliberately.

That means:
- do not optimize for raw signups that never activate
- do not run open-city top-of-funnel pushes before gated cohorts are working
- do not make promises about earnings or work volume that the product cannot support
- do not copy gig-economy tactics that trade trust for short-term volume
- do optimize for reliable, rights-safe, high-quality local contributors

## Generic Funnel
1. targeted channel entry
2. gated cohort intake or access-code expression of interest
3. qualification and trust-packet review
4. approval into an active cohort
5. onboarding and expectation setting
6. first capture activation
7. quality review, trust building, and contributor tiering
8. repeat capture participation
9. referral or ambassador loop

## Candidate Channel Stack

Open discovery should feed gated cohorts, not immediate broad approval. The operating default is: find promising contributors in public or semi-public channels, then move them into invite, access-code, or operator-reviewed cohorts before scale.

| Channel | Lane | Hypothesis | Audience | Expected quality | Evidence level | Human dependencies |
| --- | --- | --- | --- | --- | --- | --- |
| Robotics / creator / mapping communities | Gated cohort | Highest-signal early supply comes from communities that already understand spatial, capture, or technical field work | technical creators, robotics-adjacent contributors, mapper profiles | high | high | community outreach, operator review, access-code or invite workflow |
| Local photo / video / production freelancer groups | Gated cohort | contributors already used to site visits and media capture can activate faster than generic gig applicants | freelance camera and production operators | medium-high | medium | truthful screening copy, portfolio review, trust packet |
| Campus technical communities | Gated cohort | school-linked or program-linked cohorts can create higher-trust early density | student builders, labs, clubs, campus creators | medium-high | high | campus relationship owner, access-code logic, approval queue |
| Local operations and field-service communities | Gated cohort | contributors with field discipline can convert if expectations are explicit | inspectors, survey-support profiles, field-service workers | medium | medium | intake review, policy and rights briefing |
| Approved-capturer referrals | Gated referral | the best new contributors come from activated capturers, not unqualified social reach | approved capturers and their trusted peers | high | high | referral tracking, milestone verification, human-approved incentive copy |
| Founder/operator outbound into trusted networks | Gated cohort | direct outreach can seed the first city cohorts before scalable channels are live | known local connectors and community leads | high | medium | operator time, cohort management, approval follow-up |
| Partner channels with aligned local networks | Gated cohort | aligned institutions can provide trust and density if the workflow is controlled | schools, studios, robotics groups, creator orgs | medium-high | medium | partnership owner, materials, intake stage management |
| City-specific local communities | Open discovery | useful for lead discovery only after intake and trust controls exist | local creator and neighborhood groups | low-medium | medium | moderation, fast follow-up, move leads into gated intake |
| Niche field-task platforms | Open discovery | can surface supply pockets but usually with more noise and trust burden | task-platform workers | low-medium | medium | duplicate/content checks, stronger review, limited pilot scope |
| Event-based recruiting pushes | Gated cohort | time-bounded cohorts can work when intake and onboarding are already standardized | hackathons, meetups, local activations | medium | medium | event coordination, fast stage management, human attendance |

## Cohort and Access Rules
- Austin and San Francisco should start with cohort-based supply seeding, not citywide open recruiting.
- Open channels are discovery surfaces only until approval rate, first-capture activation rate, and trust checks are stable.
- Access codes, invite links, or direct operator review should be the default way to admit early cohorts.
- Private or higher-trust work should stay restricted to approved contributors who have passed a first capture and trust review.

## Messaging Hierarchy
1. what Blueprint is asking people to do
2. why the work is real and valuable
3. what approval, authorization, and trust expectations exist
4. what happens after approval and first capture
5. what is not guaranteed about work volume, timing, or incentives

## Stage Management and Trust Packet

Every active city or cohort should use the same stage language so operators do not recreate onboarding from scratch.

### Suggested stage model
1. sourced
2. applied / expressed interest
3. trust packet requested
4. trust packet verified
5. approved
6. onboarded
7. first capture submitted
8. first capture passed
9. repeat-ready / tiered

### Trust packet minimums before scale
- identity verification appropriate to the workflow
- authorization proof or field-ready explanation artifacts when needed, using [field-ops-first-assignment-site-facing-trust-gate.md](/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/playbooks/field-ops-first-assignment-site-facing-trust-gate.md) for first-assignment decisions
- duplicate and content-integrity checks
- location and device validation where relevant
- policy, privacy, and rights acknowledgement

If these controls are not operational, Blueprint should not widen top-of-funnel spend or public recruiting intensity.

## Incentive Rules
- referral and incentive ideas may be proposed here
- referral logic should trigger only after an approved capturer completes a first passed capture or equivalent activation milestone
- no compensation or bonus change is valid until a human approves it
- public earnings language, bonus claims, or invite-post copy require human review before use
- avoid tactics that create fake signups, low-trust behavior, or adversarial quality outcomes

## Referral Loop Rules
- referrals are an activation-quality loop, not a signup-volume loop
- only approved capturers who have passed a first capture should be eligible to refer
- referred contributors should count only after their first passed capture or equivalent quality milestone
- referral programs should prefer metro-specific or cohort-specific windows over blanket always-on pushes
- private higher-trust opportunities can be used as a retention and quality lever before cash-heavy public incentives

## Quality and Trust Filters
- market and device fit
- responsiveness
- trust packet completeness
- first-capture quality
- repeat reliability
- duplicate/content integrity
- location and device validation where relevant
- policy and rights adherence
- ability to operate inside standardized stage management

## Measurement Requirements
- signup volume by channel
- gated-cohort entry volume by source
- approval rate by channel
- trust-packet completion rate
- first-capture activation rate
- first-capture pass rate
- repeat capture rate
- referral-to-passed-capture rate
- ops load per activated contributor
- quality pass rate by source
- time spent in each stage before approval and first passed capture

## Ready / Blocked / Needs Data

### Ready now
- gated cohort seeding through trusted communities
- activation-gated referral design
- standardized stage management
- trust packet as a prerequisite for broader scale

### Blocked on operating readiness
- public incentive or compensation changes
- earnings-led recruiting copy
- broad open-city recruiting without stronger trust controls

### Needs data
- Blueprint channel-by-channel capturer conversion
- Blueprint trust-packet drop-off and approval timing
- city-by-city first-capture activation benchmarks
- ops burden by cohort source and contributor tier

## Handoffs
- `intake-agent`: signup qualification, trust-packet rules, approval stages, and contributor tier entry rules
- `analytics-agent`: instrumentation for gated cohorts, trust-packet completion, first passed capture, and referral activation quality
- `conversion-agent`: landing pages, forms, access-code flows, and truthful recruiting copy
- `city-launch-agent`: Austin and San Francisco adaptation using gated cohort defaults instead of open-city pushes
- `ops-lead` / `field-ops-agent`: authorization artifacts, identity workflow, duplicate/content checks, and stage-management operations once supply is real

## ops/paperclip/playbooks/robot-team-demand-playbook.md

# Blueprint Robot-Team Demand Playbook

## Purpose
This is the reusable Blueprint playbook for generating and qualifying robot-team demand before customizing motions by city.

It should be updated by `robot-team-growth-agent` as new demand and operating evidence arrives.

## Core Thesis
Blueprint should grow robot-team demand the same way it grows product trust: truthfully and specifically.

That means:
- do not optimize for generic AI curiosity that never becomes an exact-site buying conversation
- do not lead with abstract model claims when the real product is site-specific world models and hosted access
- do not treat qualification or readiness as the main thing being sold
- do optimize for technical buyers who need exact-site coverage, provenance, hosted-session proof, and clear rights boundaries

## Primary Buyer Lane
Blueprint's core demand lane is robot teams buying:
- site-specific world-model packages
- hosted access to exact-site environments
- attached provenance, rights, and privacy boundaries
- optional trust or readiness outputs when they materially help the deal

## Secondary Buyer Segments
These can matter, but they are not the center of the playbook:
- deployment and operations teams around robot fleets
- systems integrators coordinating site-specific robot rollouts
- simulation or data teams that need exact-site grounding for downstream work

## Generic Buyer Funnel
1. demand signal or introduction
2. site and use-case fit check
3. 24-hour proof-path triage
4. proof-pack review
5. hosted-session demo or exact-site artifact review
6. standard commercial handling inside approved guardrails, plus human-gated exception routing
7. buyer activation or package purchase
8. usage feedback, renewal, or adjacent site expansion

## ICP and Segment Guidance

### 1. Primary ICP
- robot autonomy teams with real deployment or evaluation needs
- teams that care about exact sites more than generic benchmark content
- buyers who can evaluate hosted proof and provenance artifacts

### 2. Strong Secondary ICP
- deployment-heavy robotics programs coordinating facility-specific rollouts
- technical operators who need site-grounded assets before spend or field work
- partner-led buyers who already work inside robotics data, teleoperation, or industrial-software stacks and want Blueprint to fit into an existing review workflow

### 3. Weak-Fit Segments
- buyers seeking only generic model demos
- teams that do not care which site is used
- buyers expecting mature procurement, pricing, or legal packaging that Blueprint does not yet support

## Message Hierarchy
1. Blueprint turns real captured sites into exact-site world-model packages and hosted review surfaces.
2. The buyer should understand the proof path within a day, not after a bespoke integration cycle.
3. The primary deliverables are exact-site packages, hosted access, and clear artifact handoff expectations, not abstract AI claims.
4. Blueprint should be explained as fitting into an existing robotics, inspection, or data-review stack where possible.
5. Provenance, privacy boundaries, rights boundaries, and recency stay attached to the product.
6. Optional trust or readiness layers can support a deal when they materially help.

## Latest Operating Evidence
- As of 2026-03-30, `inboundRequests.ops.proof_path` is the authoritative storage layer for proof-path timestamps, but truthful reporting still depends on new requests plus ops-stamped manual milestones for steps the system cannot infer automatically.
- The intake contract now captures buyer role, target site type, proof-path preference, existing-stack or review-workflow context, and early human-gated topics, so the first response can distinguish exact-site proof from adjacent-site proof without guessing.
- The reusable proof motion now has explicit support artifacts in `hosted-review-artifact-handoff-checklist.md` and `robot-team-finance-support-routing-playbook.md`, so hosted review and commercial-routing claims do not need to live as unwritten tribal knowledge.
- Austin and San Francisco playbooks now inherit this shared proof system, but live intake review still shows no city-tagged buyer-demand evidence for either city. City-specific messaging should stay hypothesis-labeled until tagged traffic is real.

## Reusable Segment and Channel Matrix
| Buyer role | Site / workflow need | Channel fit | Proof requirement | Evidence level | Human dependencies |
| --- | --- | --- | --- | --- | --- |
| autonomy or perception lead | evaluate an exact site before deployment or model tuning | founder intros, robotics builder networks, technical community events | exact-site proof pack plus hosted review within 24 hours | ready now | designated human commercial owner only for standard pricing/progression; founder only for non-standard commitments and rights exceptions |
| deployment or operations lead | remote review before field travel, rollout planning, or intervention prep | partner referrals, operations communities, deployment-heavy intros | hosted review path, artifact handoff checklist, recency and site coverage summary | ready now | human for site access, delivery commitments, and rollout coordination; founder only for irreversible exceptions |
| systems integrator or industrial data partner | fit Blueprint output into an existing customer stack | stack-adjacent partners and implementation relationships | compatibility statement, artifact export expectations, and explicit gap labeling | partial | designated human commercial owner for standard commercials; founder for partner-term or non-standard scope commitments |
| simulation or data platform owner | consume exact-site artifacts inside an existing data workflow | developer-native channels, docs, partner introductions | standardized artifact structure, provenance, and what would require extra packaging | partial | human for delivery scope and any custom export commitments |

## Proof Pack Requirements
- exact site summary
- 24-hour proof-path target for first qualified review
- capture provenance summary
- capture recency and known site coverage boundaries
- package and runtime artifact description
- existing-stack compatibility statement describing how the buyer can inspect or ingest the current output
- hosted-session walkthrough or access path
- standardized artifact handoff checklist covering what the buyer receives now
- rights, privacy, and consent boundary summary
- explicit statement of what exists now versus what would require additional capture, packaging, integration, approvals, or ops work

## Proof Pack Structure
Every reusable proof pack should be organized in this order so the buyer can understand the offer without a live explanation:

1. Buyer context block
   - buyer role
   - target robot workflow
   - facility type
   - exact-site versus adjacent-site label
2. Site evidence block
   - site name or labeled proxy description
   - capture date or recency window
   - known coverage boundaries
   - provenance and rights summary
3. Review-now block
   - hosted-session entry point or walkthrough path
   - what the buyer can inspect remotely today
   - expected time to first technical review
4. Artifact handoff block
   - package or artifact types currently available
   - compatibility notes for the buyer's stack
   - what can be reviewed asynchronously versus what needs a live session
5. Gap and escalation block
   - what still requires more capture, packaging, or integration
   - what still requires human review for rights, privacy, commercials, or access
   - named next step: proof review, scoped follow-up, or human handoff

## 24-Hour Proof Path
For qualified robot-team demand, Blueprint should aim to move from first serious signal to a reviewable proof path inside one business day.

1. Confirm the buyer role, target site type, and immediate workflow question.
2. Decide whether current Blueprint evidence supports an exact-site proof pack, a clearly labeled adjacent-site proof pack, or only a scoped follow-up.
3. Deliver a standard proof pack with hosted review access or walkthrough instructions.
4. Attach artifact handoff expectations so the buyer knows what can be reviewed asynchronously versus what still needs a live conversation.
5. Flag all human-gated topics immediately instead of hiding them in later stages.

If Blueprint cannot satisfy this proof path truthfully, the motion should be framed as a scoped follow-up, not as a ready-now demo.

## Hosted Review and Artifact Handoff Standard
Every serious robot-team motion should default to a hosted review and artifact handoff structure that answers:

- what exact site or adjacent-site evidence is being shown
- what the buyer can inspect remotely right now
- what artifact formats or outputs exist today
- how the current output fits into the buyer's existing stack or review workflow
- what additional capture, packaging, integration, or approvals would still be required
- which questions must be escalated to humans

The hosted review should feel like a technical evaluation surface, not a generic sales demo.

## Hosted-Session Demo Motion
1. Start with the target site type and the buyer's actual robot workflow.
2. Show only exact-site or clearly labeled adjacent-site proof.
3. Lead with what the buyer can review now within the existing proof pack and hosted surface.
4. Use hosted access to demonstrate grounded navigation or inspection, not speculative autonomy claims.
5. State how the current artifact handoff fits into the buyer's existing stack or review process.
6. Label any gaps that would require additional capture, packaging, integration, or approvals.
7. Escalate pricing, contracts, permissions, privacy, rights, and commercialization questions to humans.

## Buyer Follow-Up Standard
The default follow-up after a serious hosted review should be an artifact-led technical recap, not a generic sales email.

Within one business day after the hosted session or async review:
- restate the exact site or labeled adjacent-site evidence that was reviewed
- attach or relink the proof pack and hosted-session entry point
- list the specific artifacts the buyer can inspect now
- name the open technical questions that still block buyer confidence
- separate human-gated topics from product or evidence gaps
- propose one concrete next step: exact-site request, deeper technical review, or scoped human commercial handoff

If the hosted review surfaced a missing proof surface, the follow-up should say that directly instead of pretending the deal is already in commercial scoping.

## Channel Hypotheses
- founder-led introductions into technical robot-team networks
- robotics deployment and autonomy communities
- systems-integrator and rollout-partner relationships
- technical events where exact-site proof can be discussed credibly
- stack-adjacent partner channels where Blueprint can be evaluated inside an existing review or inspection workflow
- inbound traffic from truthful exact-site or hosted-session pages when instrumentation exists

## Source-Tag Discipline
- Keep reusable source tags limited to explicitly evidenced paths such as founder intro, university or lab intro, industrial partner, proof-led event, buyer-matchmaking community, and partner referral.
- Do not infer a city, community, or partner source from a vague conversation thread. If the source is unknown, leave it unknown and preserve that ambiguity in analytics.
- Treat city-specific channel bets as inherited hypotheses until live tagged demand shows that a source repeatedly reaches qualified hosted review.

## Packaging Expectations
Robot-team buyers should be able to understand:
- which site is covered
- how recent the capture is
- what product format is available now
- what hosted access includes
- how the current artifact can be reviewed or handed off inside an existing toolchain
- what rights, privacy, and commercialization boundaries are already known
- what still requires human scoping
- what still requires extra capture, packaging, or integration work

## Buyer-Motion Status
### Ready now
- exact-site or clearly labeled adjacent-site proof-pack review
- hosted review as the default technical evaluation surface
- provenance, rights, privacy, and recency labeling
- compatibility-oriented messaging that explains how current Blueprint output can fit into existing workflows
- ops-side hosted-review and artifact handoff checklist
- standard buyer-solutions plus human-commercial-owner routing that cleanly separates technical proof follow-up from human-only commercial decisions

### Blocked
- public proof-pack pages or contact flows that still over-weight qualification-first framing
- analytics and reporting work that still does not expose time-to-proof, proof-pack delivery, hosted review, follow-up, and stall reasons end to end
- any buyer motion that implies ready-now integration or procurement support Blueprint cannot yet deliver truthfully

### Needs data
- which partner channels produce the fastest path to qualified hosted review
- how often buyers accept adjacent-site proof versus requiring exact-site proof immediately
- where hosted review stops being enough and a deeper integration workflow becomes necessary
- whether Austin- or San Francisco-tagged buyer traffic is real enough to justify sharper city-specific copy and ops thresholds

## Measurement Requirements
- qualified robot-team inbound volume
- time from qualified inbound to first proof-pack delivery
- time from qualified inbound to hosted review availability
- proof-pack review to hosted-session rate
- hosted-session to follow-up rate
- exact-site request rate
- artifact handoff acceptance rate
- time to human commercial handoff
- ops load created by each buyer segment

Repo-ready analytics requirements, current coverage, and reporting views are documented in
[docs/robot-team-proof-motion-analytics-requirements-2026-04-10.md](/Users/nijelhunt_1/workspace/Blueprint-WebApp/docs/robot-team-proof-motion-analytics-requirements-2026-04-10.md).

## Funnel Instrumentation Map
| Stage | Required event or state | Why it matters |
| --- | --- | --- |
| demand signal | `robot_team_inbound_captured` with source, city, buyer role, and requested lane | separates real robot-team demand from generic awareness |
| fit check | `robot_team_fit_checked` with exact-site versus adjacent-site classification | shows whether Blueprint had truthful proof scope for the request |
| proof-path triage | `proof_path_assigned` with outcome: exact_site, adjacent_site, scoped_follow_up | measures how often serious demand gets a real proof path inside one day |
| proof-pack delivery | `proof_pack_delivered` with delivery timestamp and artifact summary | measures time-to-proof and proof coverage quality |
| hosted review ready | `hosted_review_ready` with hosted mode and review path | shows whether buyers received a real technical inspection surface |
| hosted review started | `hosted_review_started` with buyer segment and source | measures whether proof packs are compelling enough to open |
| hosted follow-up | `hosted_review_follow_up_sent` with next-step recommendation | keeps follow-up operational instead of anecdotal |
| buyer next action | `exact_site_request_created`, `deeper_review_requested`, or `human_commercial_handoff_started` | distinguishes product pull from commercial escalation |
| stalled motion | `proof_motion_stalled` with blocker reason | exposes whether demand is failing on proof, product gaps, or human gates |

Authoritative storage for proof-path milestones lives in `inboundRequests.ops.proof_path`. Historical requests remain incomplete until ops backfills the manual milestone fields, so reporting should explicitly distinguish live coverage from legacy gaps.

## Downstream Execution Queue
| Owner | Work package | Success condition |
| --- | --- | --- |
| `conversion-agent` | update buyer-entry and follow-up copy so robot-team flows lead with exact-site proof, hosted review, and artifact handoff instead of qualification-first framing | robot-team landing, signup, and contact surfaces describe the 24-hour proof path and hosted review clearly |
| `analytics-agent` | instrument the funnel events in this playbook and publish stage definitions for reporting | growth can see time-to-proof, hosted-review conversion, and stall reasons by buyer segment and source |
| `intake-agent` | classify inbound robot-team requests by buyer role, exact-site need, and proof-path outcome | intake can route serious requests into exact-site, adjacent-site, or scoped follow-up lanes without ambiguous qualification-only framing |
| `ops-lead` | define the operational checklist for proof-pack assembly, hosted review readiness, and human escalation triggers | ops can support the proof motion without ad hoc delivery behavior |
| `buyer-solutions-agent` + designated human commercial owner | define the standard commercial handoff that should stay separate from technical proof follow-up | standard pricing, quote, and procurement handling stop contaminating the technical proof motion while founder review stays sparse |
| `revenue-ops-pricing-agent` | define approved quote bands, package logic, and exception thresholds for the human commercial owner | pricing guidance stays truthful to the real product and exposes non-standard asks early |
| `city-demand-agent` | inherit this proof-pack and hosted-review standard into Austin and San Francisco demand plans | city plans customize channels and clusters without rewriting the reusable buyer proof system |

## City Inheritance Rules
Austin and San Francisco plans should inherit the same message hierarchy, proof-pack standard, hosted review structure, and human-gate rules from this playbook.

Cities should customize:
- which communities and intros produce qualified demand
- which partner channels shorten access or deployment friction
- which site clusters show enough density to justify targeted follow-up

## Handoffs
- `conversion-agent`: buyer landing pages, proof-pack pages, and demo-request flows
- `analytics-agent`: instrumentation and funnel reporting
- `intake-agent`: inbound classification and missing-info handling
- `ops-lead`: delivery and operational coordination when demand becomes real work
- `buyer-solutions-agent` + designated human commercial owner: standard quote, procurement, and buyer-thread commercial routing
- `revenue-ops-pricing-agent`: standard pricing guidance and exception detection
- `city-demand-agent`: city-specific adaptation

## ops/paperclip/programs/city-launch-agent-program.md

# City Launch Planning — Current Focus

## Objective
Use the generic capturer-growth playbook plus Blueprint's existing supply, demand, and operations research to publish one concrete city launch guide per week.

## Planning Engine Requirement

All substantial city-launch planning work must use the Gemini Deep Research harness documented in
`docs/city-launch-deep-research-harness-2026-04-11.md`.

Operational rule:
- use `npm run city-launch:plan -- --city "<City, ST>"` as the default upstream planning pass for city launch work
- treat the generated deep-research playbook as the expansive planning source
- then condense the relevant decisions into the compact city-launch playbook and issue-ready follow-ups
- when a focus city moves from planning to execution, hand the approved city playbook into `npm run city-launch:activate -- --city "<City, ST>"` and route work through `ops/paperclip/programs/city-launch-activation-program.md`
- do not treat ad hoc web summaries or generic LLM output as sufficient replacements for this harness

## Current Queue
1. Austin, TX
2. San Francisco, CA

## Deferred Cities
- Chicago, IL
- Los Angeles, CA
- New York, NY
- Boston, MA
- Seattle, WA
- Atlanta, GA

Selection rule:
- pick the next city whose guide is missing or stale
- do not expand beyond Austin and San Francisco in recurring work
- treat deferred cities as archive/background only until a new evidence packet exists
- do not rotate just for novelty; choose the next city where a guide would improve real planning clarity

Evidence gate for reopening a deferred city:
- one new exact-site proof signal tied to that city, or
- one new qualified local anchor demand/supply signal tied to that city, or
- one explicit founder request after reviewing a bounded decision packet

Absent one of those, do not reopen deferred-city planning and do not create founder-facing review work about it.

## Required City Guide Structure
For every city guide, maintain:
- launch thesis
- why this city now
- target capturer profile
- best-fit channels
- local trust / quality risks
- operational dependencies
- web / funnel dependencies
- measurement plan
- launch readiness score
- immediate next actions
- a four-layer operating split:
  - founder-only
  - human operator-owned
  - agent-prepared / autonomous
  - exception-only escalation

## Initial Readiness Dimensions
Score each city 1-5 on:
1. channel reachability
2. likely supply quality
3. operations feasibility
4. measurement readiness
5. legal/compliance clarity
6. strategic importance

## Required Outputs
- update exactly one `ops/paperclip/playbooks/city-launch-<slug>.md` file per weekly run when repo writes are available
- create or update one Notion Knowledge page for that city's current guide every run
- create or update one Notion Work Queue breadcrumb whenever human review, approval, or downstream follow-up is required
- use `ops/paperclip/playbooks/city-launch-template.md` as the default shape for new cities
- create issue-ready actions for other agents only when they represent real next work
- keep a clear list of what is blocked by missing human decisions
- do not leave the city guide only as a Paperclip attachment or comment

## Constraints
- No public launch claims
- No paid-spend approval
- No legal interpretation
- No promises on city-level demand or earnings
- No founder-facing routine approval work for invite issuance, referral execution, intake rubric approval, first-capture thresholds, trust-kit creation, analytics validation, or proof-pack quality confirmation when written operator guardrails already exist
- Deep Research outputs are planning artifacts only; they do not override human gates or make live commitments

## Operating Rule
The city-launch agent does not invent a launch. It translates reusable strategy into city-specific plans and makes dependencies explicit, one city at a time.

Required ownership split in Austin and San Francisco:
- Founder-only: city go/no-go, gated-versus-expand decisions, new spend envelopes, posture-changing public claims, non-standard commercial commitments, policy-level rights/privacy exceptions
- Human operator-owned: Growth Lead for channel/referral/source posture; Ops Lead for intake rubric, activation thresholds, trust kit, and launch-readiness checklist; designated human commercial owner for standard commercial handling inside approved bands
- Agent-prepared / autonomous: city-launch-agent, intake-agent, field-ops-agent, analytics-agent, notion-manager-agent, webapp-codex, buyer-solutions-agent, and revenue-ops-pricing-agent prepare evidence and packets inside the human-owned guardrails
- Exception-only escalation: founder sees only the bounded packet for city posture changes or irreversible exceptions

## Weekly Run Log

### 2026-04-06
- Refreshed Austin and San Francisco playbooks with latest findings
- Incorporated April 5 agent bootstrap completions as new downstream capacity
- Incorporated growth-lead weekly review analytics gap findings
- No new city guides published this run (Austin and SF still first in queue; Chicago remains deferred)
- Key block: analytics instrumentation not deployed — city expansion cannot be evidence-based

## ops/paperclip/programs/city-demand-agent-program.md

# City Demand Planning — Current Focus

## Objective
Use the generic robot-team demand playbook plus demand research to maintain concrete demand plans for Blueprint's first target cities.

## Planning Engine Requirement

All substantial city-demand planning work should begin from the Gemini Deep Research harness documented in
`docs/city-launch-deep-research-harness-2026-04-11.md`.

Operational rule:
- use the harness to generate the expansive city launch / demand research artifact first
- then distill buyer-cluster, proof-pack, outreach, and ops conclusions into the compact city-demand plan
- for city activation work, feed the approved focus-city demand plan into `ops/paperclip/programs/city-launch-activation-program.md` instead of leaving the plan as a standalone memo
- use follow-up questions through `previous_interaction_id` when demand questions are unresolved instead of restarting research from scratch
- do not rely on generic market summaries when the harness can produce a city-specific planning artifact

## Active Cities
1. Austin, TX
2. San Francisco, CA

## Required City Plan Structure
For every active city, maintain:
- city demand thesis
- why this city now
- likely robot-team buyer clusters
- relevant facility and exact-site needs
- best-fit channels, communities, and events
- optional site-operator opportunities
- proof-pack expectations
- operational and commercial dependencies
- measurement plan
- demand readiness score
- immediate next actions

## Initial Readiness Dimensions
Score each city 1-5 on:
1. likely robot-team density
2. exact-site proof fit
3. access and commercialization opportunity
4. instrumentation readiness
5. operational follow-through readiness
6. strategic importance

## Required Outputs
- update `ops/paperclip/playbooks/city-demand-austin-tx.md`
- update `ops/paperclip/playbooks/city-demand-san-francisco-ca.md`
- create or update Notion Knowledge pages for each active city-demand plan that changed in the run
- create or update Notion Work Queue breadcrumbs whenever a human review, approval, or downstream action is required
- create issue-ready actions for other agents
- keep a clear list of what is blocked by missing evidence or human decisions

## Constraints
- No public city-live claims
- No public posting or outreach
- No guaranteed demand or partnership claims
- No local legal, privacy, rights, or commercialization interpretation
- Deep Research outputs are planning artifacts only; they do not authorize live outreach or commercial claims

## Operating Rule
The city-demand agent does not invent a market. It translates reusable buyer strategy into city-specific plans and makes dependencies explicit.
```

## Output

# Blueprint City Launch Playbook: Seattle, WA

**Key Points:**
*   **Launch Posture:** The evidence suggests that Seattle, WA represents an optimal near-term expansion market for Blueprint due to its dense concentration of robotics infrastructure startups, world-class academic institutions (University of Washington), and expansive industrial logistics corridors (Kent Valley and SODO).
*   **Operational Wedge:** Launching successfully likely requires anchoring on the Exact-Site Hosted Review wedge. Blueprint should avoid generic top-of-funnel consumer marketing and instead utilize targeted, gated cohorts of capturers deployed to highly specific industrial and robotics sites.
*   **Analog Syntheses:** Analysis of Uber, DoorDash, Instacart, and Airbnb reveals that seeding hyper-local supply liquidity, establishing high-fidelity proof assets (akin to Airbnb's professional photography), and utilizing neighborhood-by-neighborhood clustering are highly transferable mechanics for Blueprint. 
*   **Agent-Human Synergy:** The 2026 operating era demands that this launch be heavily driven by autonomous and semi-autonomous AI agents (e.g., `intake-agent`, `city-demand-agent`), with humans firmly positioned as review gates for irreversible commercial, legal, and privacy decisions.
*   **Traction Reality:** It must be explicitly noted that Blueprint currently has no established traction, sites, or commercial agreements in Seattle. This playbook outlines the *zero-to-one* strategy.

**Methodology and Scope:**
This document provides an exhaustive, academic-grade operational playbook for launching Blueprint in Seattle, Washington. It synthesizes strategic doctrines provided in Blueprint's core operating context (`PLATFORM_CONTEXT.md`, `WORLD_MODEL_STRATEGY_CONTEXT.md`, `AUTONOMOUS_ORG.md`) with concrete local market data regarding Seattle's robotics ecosystem and commercial real estate landscape.

**Uncertainty and Constraints:**
While the local market data points (such as industrial vacancy rates and specific startup cohorts) are drawn from recent market reports, the translation of these metrics into guaranteed capturer supply and buyer demand remains a hypothesis. Complexities surrounding local facility mapping regulations, union resistance in warehouse environments, and the actual conversion rates of Seattle-based robotics teams to hosted-review buyers constitute areas of uncertainty. 

---

## Executive Summary

Blueprint's center of gravity is capture-first and world-model-product-first. The company does not sell generic marketplace browsing, nor does it sell a single permanent world model. Instead, Blueprint sells real-world capture coverage, site-specific world models, and exact-site hosted access. 

This playbook architects the expansion of Blueprint into Seattle, Washington. Seattle presents a uniquely fertile ground for this doctrine. The city merges a massive industrial and distribution footprint (specifically the Kent Valley and SODO submarkets) [cite: 1, 2, 3, 4] with a dense, highly sophisticated robotics engineering ecosystem (anchored by the University of Washington's BioRobotics Lab and initiatives like the Plug and Play Seattle AI Center of Excellence) [cite: 5, 6, 7]. 

The launch strategy rejects the "blitzscaling" gig-economy playbook of untargeted, subsidized supply acquisition [cite: 8, 9]. Instead, it adapts the high-trust, unscalable asset-creation tactics of early Airbnb (e.g., high-quality photographic verification) [cite: 10, 11] and the hyper-local, clustered paratrooper models of early DoorDash and Instacart [cite: 12, 13, 14]. 

Operationally, this launch is designed for the 2026 AI era. Workflows are divided strictly along Blueprint's Autonomous Organization lines. AI agents (`intake-agent`, `capture-qa-agent`, `city-launch-agent`) will handle data synthesis, lead scoring, anomaly detection, and proof-pack preparation. Human operators (Founder, Ops Lead, Growth Lead) are explicitly restricted to policy, irreversible commercial commitments, and rights/privacy exceptions. 

This playbook provides a concrete, first-principles 12-week execution plan, a granular supply and demand scaling design, and explicit instrumentation gates required to transform Seattle into a self-sustaining node in Blueprint's compounding capture-to-buyer flywheel.

---

## City Thesis and Why Now

### The Seattle Robotics Ecosystem
Seattle is a top-tier hub for physical AI, robotics, and cloud infrastructure. The University of Washington (UW) confers over 500 computer science degrees annually and operates the globally recognized BioRobotics Lab (BRL) [cite: 15, 16]. The UW BRL has a long history of deep-tech spinouts (e.g., BluHaptics) and pioneering work in closed-loop systems, remote teleoperation, and haptic feedback—core competencies adjacent to world-model interaction [cite: 6, 7, 15].

Furthermore, the recent establishment of the Plug and Play Seattle AI Center of Excellence, co-located at UW CoMotion Labs and SNBL Global Gateway in Everett, demonstrates a surge in institutional support for local AI startups [cite: 5, 17]. Batch 3 of this accelerator features companies directly aligned with Blueprint's target robot-team ICP, such as Reflection Robotics, which is building flexible robot foundation models for physical task automation [cite: 5, 18]. 

### The Exact-Site Demand Engine: Kent Valley and SODO
Blueprint's value proposition requires dense clusters of highly structured, physically complex real estate. Seattle provides two ideal proving grounds:
1.  **Kent Valley (Southend):** This is the primary logistics and distribution corridor for the Puget Sound region, housing 123.3 million square feet of industrial inventory [cite: 1, 4]. With vacancy rates rising to 9.6% due to negative absorption [cite: 1, 19], warehouse owners are increasingly motivated to optimize operations, driving demand for automated logistics, which in turn drives the need for site-specific world models for robotics integrators. Facilities here range up to 228,300 SF (e.g., East Valley Distribution Center) [cite: 20, 21].
2.  **SODO (South of Downtown):** Seattle's urban industrial core. It features older, functionally obsolete facilities converting to mixed-use and last-mile distribution [cite: 1, 19]. High property turnover and proximity to downtown make it ideal for high-frequency, complex indoor captures [cite: 22, 23]. 

### Why Now?
1.  **Macro-Economic Pressure in Logistics:** Rising vacancies in Seattle's industrial sectors [cite: 1, 4] mean operators are seeking automation. Robot teams targeting these operators need exact-site proof to close deals.
2.  **Maturation of Local Physical AI:** Startups like Reflection Robotics are moving from theory to facility deployment, creating an immediate localized demand for rights-safe, high-provenance spatial capture [cite: 18].
3.  **Platform Readiness:** Blueprint's core infrastructure (`BlueprintCapture`, `BlueprintCapturePipeline`, and `Blueprint-WebApp`) is prepared to ingest raw capture bundles and output site-specific packages and hosted-session artifacts.

---

## Analog Comparison Table and Transferability Analysis

To design a robust launch system, we must study analogous multi-sided marketplace and logistics launches. However, Blueprint is *capture-first* and *world-model-product-first*, meaning pure liquidity models do not map 1:1. 

| Company | Core Early Launch Strategy | Key Mechanics | Relevancy to Blueprint | Cite |
| :--- | :--- | :--- | :--- | :--- |
| **Uber** | Liquidity and Geographic Density | Launch one city at a time; heavily subsidize supply (drivers) to guarantee availability; play regulatory arbitrage ("liminal movement"). | **Moderate.** Subsidizing generic supply is dangerous for Blueprint, but geographical density (saturating SODO before moving to Bellevue) is critical. | [cite: 8, 24, 25, 26] |
| **DoorDash** | Suburban/Mid-sized Clustering | Focus on logistics control rather than speed; utilize sophisticated hierarchical clustering for anomaly/fraud detection; hyper-local rollout. | **High.** Blueprint must use geographic clustering to dense-up capture zones. DoorDash's anomaly detection clustering maps directly to Blueprint's `capture-qa-agent` detecting fake/low-quality captures. | [cite: 14, 27, 28, 29] |
| **Instacart** | Neighborhood "Paratroopers" | Waitlist-driven expansion; send small sales teams to sign up ~50 local nodes; tightly control logistics in specific neighborhoods (e.g., Brooklyn subsets). | **High.** Blueprint will use a paratrooper approach: finding 10-25 anchor facilities in Kent/SODO before allowing broad city-wide capturing. | [cite: 12, 13, 30, 31] |
| **Airbnb** | Unscalable Asset Verification | Professional photography in NY to boost bookings 3x; verified photos built market trust; event-based launches (DNC in Denver). | **Very High.** Blueprint's core asset is *trust in the site capture*. Early exact-site proof packs must be generated with extreme rigor, akin to Airbnb's early photography program. | [cite: 10, 11, 32, 33] |
| **Lime** | Campus & Trail Connectivity | Partnered with local universities (e.g., UW) and disabled rights organizations; deployed fleets in dense, connected corridors. | **Moderate.** The partnership with UW is highly replicable for recruiting technically sophisticated early capturers. | [cite: 34, 35, 36] |
| **Robotics Analog (Plug & Play)** | Institutional Anchoring | Establish a physical CoE (Center of Excellence); run structured cohorts (12-week accelerators); partner with corporate/academic bodies. | **High.** Blueprint must anchor its demand-side launch on existing technical cohorts rather than shouting into the void. | [cite: 5, 17] |

### What Blueprint Should Copy, Adapt, Reject

*   **COPY:** 
    *   *Airbnb's Unscalable Asset Creation:* In the early weeks, `BlueprintCapture` quality must be obsessively managed. Early site-specific world-model packages must be pristine. Do things that do not scale to verify rights and provenance.
    *   *Instacart's Paratrooper Constraints:* Confine the initial launch strictly to SODO, the UW campus vicinity, and specific Kent Valley industrial parks. Do not open the whole city.
*   **ADAPT:**
    *   *DoorDash's Clustering:* Adapt hierarchical spatial clustering not just for delivery efficiency, but for *capture anomaly detection*. If multiple capturers submit data for a specific SODO warehouse, `capture-qa-agent` must cluster these to detect contradictory spatial data or fraudulent device metadata.
    *   *Lime's Campus Strategy:* Target UW BioRobotics Lab students, computer science undergrads, and UW mapping communities as the first gated cohort of capturers, adapting Lime's campus-first deployment [cite: 15, 34].
*   **REJECT:**
    *   *Uber's "Launch First, Ask Permission Later":* Blueprint doctrine explicitly forbids this. We must "keep rights, privacy, provenance, hosted-session truth, and human gates explicit." Regulatory defiance is an existential threat to selling trustable world models.
    *   *Gig-Economy Blanket Subsidies:* We will not offer flat $1,000 sign-up bonuses to acquire generic supply [cite: 24]. We pay for verifiable, exact-site, rights-cleared spatial capture.

---

## Supply-Side Launch Design

Blueprint requires reliable, rights-safe, high-quality local contributors. Open discovery will feed gated cohorts.

### Target Capturer Profile for Seattle
1.  **Campus Technical Communities:** UW Computer Science and Engineering students, members of the Advanced Robotics at UW (ARUW) club. High technical literacy, understand spatial data.
2.  **Local Operations / Field Service:** Freelance surveyors, commercial real estate photographers operating in Kent Valley/SODO. They possess existing access to target facilities and understand field discipline.

### Scaling Tiers

#### Tier 1: First 25 Capturers (Weeks 1-4)
*   **Source:** Direct founder/operator outbound to UW academic networks and local commercial real estate photographers.
*   **Gate:** Highly restrictive. Requires a video interview, portfolio review, and manual clearance by the Ops Lead.
*   **Trust Mechanism:** Manual identity verification; explicit 1:1 briefing on privacy and rights policies.
*   **Objective:** Achieve 25 successfully processed `BlueprintCapture` bundles in non-sensitive adjacent sites (e.g., public campus buildings, collaborative co-working spaces in Pioneer Square) to calibrate the `BlueprintCapturePipeline`.

#### Tier 2: First 100 Capturers (Weeks 5-8)
*   **Source:** Approved-capturer referral loop. Only the first 25 approved capturers who have passed a first capture quality check are eligible to refer.
*   **Gate:** Access-code expression of interest. `intake-agent` scores readiness based on device metadata and market-fit matrix.
*   **Trust Mechanism:** Standardized Trust Packet (identity, location validation). `capture-qa-agent` conducts automated duplicate and content-integrity checks.
*   **Objective:** Expand capture footprint into target industrial zones (SODO/Kent). Execute first structured exact-site mapping under site operator consent.

#### Tier 3: First 250 Capturers (Weeks 9-12)
*   **Source:** Niche field-task platforms and local photo/video freelancer groups in the greater Seattle metro.
*   **Gate:** Automated waitlist processing by `intake-agent`.
*   **Trust Mechanism:** Full automated identity and device spoofing checks. Strict adherence to stage management.
*   **Objective:** Establish sufficient supply liquidity to guarantee that a custom exact-site capture request from a robot team in Seattle can be fulfilled within 72 hours.

---

## Demand-Side Launch Design

Blueprint grows robot-team demand truthfully. The product is *site-specific world models and hosted access*. Generic model demos are rejected.

### Target Buyer Clusters in Seattle
1.  **Robotics Foundation Model Startups:** e.g., Reflection Robotics [cite: 18]. They need varied industrial environments to test generalized physical AI.
2.  **Industrial Logistics Integrators:** Teams deploying automated guided vehicles (AGVs) in Kent Valley warehouses.

### Scaling Tiers

#### Tier 1: First 10 Robot-Team Conversations (Weeks 1-4)
*   **Source:** Founder-led introductions into the Plug and Play Batch 3 cohort and UW BRL alumni network [cite: 5, 6].
*   **Pitch:** "We turn real Seattle industrial sites into site-specific world-model packages and hosted review surfaces."
*   **Delivery:** Provide access to a pre-captured "adjacent-site" proof pack (e.g., a generic SODO warehouse capture) to demonstrate pipeline fidelity.
*   **Goal:** Validate the hosted-session demo motion and gather exact-site wishlists.

#### Tier 2: First 25 Robot-Team Conversations (Weeks 5-8)
*   **Source:** Direct outbound to logistics operations leads managing facilities in the Southend/Kent distribution corridor [cite: 1, 4]. 
*   **Pitch:** Exact-site proof. "Evaluate your exact Kent Valley facility remotely before field deployment."
*   **Delivery:** Execute a targeted capture via our Tier 2 capturer supply. Deliver a 24-hour proof path containing capture provenance, rights boundary summaries, and a hosted walkthrough.
*   **Goal:** Secure the first paid licensing agreements for exact-site hosted access.

#### Tier 3: First 50 Robot-Team Conversations (Weeks 9-12)
*   **Source:** Inbound traffic generated by publishing anonymized, rights-cleared case studies of Seattle industrial captures, indexed for local SEO.
*   **Pitch:** Standardized API/artifact handoff for integration into existing simulation or data-review stacks.
*   **Delivery:** Automated pipeline generation. `buyer-solutions-agent` handles standard quotes.
*   **Goal:** Establish predictable time-to-proof and hosted-review conversion metrics.

---

## Proof-Asset Design

Before scaling, specific assets must be generated to ensure the Exact-Site Hosted Review wedge is viable. 

1.  **The Seattle Anchor Site Proof Pack:**
    *   *What:* A comprehensive, legally cleared capture of a representative SODO light-industrial space (e.g., analogous to SODO Urbanworks [cite: 22]).
    *   *Components:* Raw video walkthrough, motion/trajectory logs, camera poses, depth maps, temporal alignment data, and strict privacy/consent metadata.
    *   *Function:* Serves as the primary "adjacent-site" demo for Seattle inbound leads who do not yet have a specific site in mind.
2.  **Artifact Handoff Checklist:**
    *   A standardized document detailing exactly what a buyer receives:
        *   Package manifest.
        *   Compatibility notes for ROS / standard simulation environments.
        *   Explicit labeling of gaps (what requires more capture).
3.  **Hosted Review Environment:**
    *   Deployed via `Blueprint-WebApp`.
    *   Must feature low-latency rendering of the site-specific world model, bounded by confirmed rights logic.

---

## Human and Agent Operating Model by Lane

Blueprint operates on a progressive autonomy model using Paperclip. For the Seattle launch, responsibilities are strictly demarcated.

### 1. Executive Layer (Human Founder & Claude CEO Agent)
*   **Founder:** Owns irreversible decisions. Go/no-go on the Seattle launch. Approves the Seattle specific spend budget. Reviews legal exceptions regarding Washington state privacy laws or specific union/warehouse mapping restrictions.
*   **CEO Agent (`blueprint-ceo`):** Reviews daily Seattle metrics, handles escalations from the Ops Lead, and packages founder decision packets (e.g., "Recommend pausing Kent Valley capture due to abnormal QA failure rate").

### 2. Chief of Staff (`blueprint-chief-of-staff`)
*   Runs the continuous managerial loop for the Seattle rollout. Watches issue states in the Work Queue. Routes blocked capturer identity verifications to the human Ops Lead.

### 3. Operations Layer
*   **Ops Lead (Human / `ops-lead` Agent):** The designated human operator manages the Seattle launch-readiness checklist, approves the local trust-kit, and handles rights/trust exceptions. The `ops-lead` agent routes routine SODO/Kent waitlist applications to the `intake-agent`.
*   **Intake Agent (`intake-agent`):** Processes Seattle capturer applications. Scores them based on device fit (e.g., do they have a LiDAR-enabled device?) and market fit (are they located near target industrial zones?). Drafts invite/reject emails.
*   **Capture QA Agent (`capture-qa-agent`):** Ingests incoming Seattle captures. Cross-references GPS/device metadata against expected SODO/Kent coordinates. Flags duplicates or low-quality temporal alignment.

### 4. Growth & Commercial Layer
*   **Growth Lead (Human / `growth-lead` Agent):** Owns the channel posture (UW partnerships, local SEO).
*   **Revenue Ops & Pricing Agent (`revenue-ops-pricing-agent`):** Compares Seattle delivery costs against existing pricebooks to recommend standard quote bands for local robot teams. 
*   **Designated Human Commercial Owner:** Executes standard quotes within the bands established by the Revenue Ops agent.

---

## Funnel Instrumentation and Launch Gates

A launch cannot be managed if it is not measured. The following instrumentation must be live in Firebase/PostHog before public outreach begins.

### Supply-Side Gates
| Stage | Required Event / State | Metric Target before Scaling |
| :--- | :--- | :--- |
| Demand Signal | `seattle_capturer_waitlist_entry` | N/A |
| Trust Packet | `trust_packet_submitted` | >80% completion rate |
| Activation | `first_capture_passed` | >60% of onboarded capturers |
| Retention | `repeat_capture_submitted` | >30% within 14 days |

### Demand-Side Gates
| Stage | Required Event / State | Metric Target before Scaling |
| :--- | :--- | :--- |
| Inbound | `robot_team_inbound_captured` (tagged: Seattle) | N/A |
| Triage | `proof_path_assigned` | < 24 hours from inbound |
| Demo | `hosted_review_started` | > 50% of qualified leads |
| Conversion | `exact_site_request_created` | > 20% of demos |

*Missing Data Callout:* Currently, the historical `inboundRequests.ops.proof_path` timestamps are incomplete. Ops must manually backfill milestone fields for any early Seattle beta testers to ensure accurate time-to-proof reporting.

---

## Weekly Execution Plan (First 12 Weeks)

### Phase 1: Foundation & Seeding (Weeks 1-4)
*   **Week 1: Instrumentation & Asset Generation.** `analytics-agent` verifies all Seattle tags are active. Engineering ensures Firebase Admin and Stripe webhooks are healthy. Human operators secure one legally cleared "Anchor Site" in SODO [cite: 22] to create the baseline proof pack.
*   **Week 2: Tier 1 Supply Intake.** Founder conducts outreach to UW BioRobotics lab and local mapping communities [cite: 6]. `intake-agent` processes top 25 candidates. Manual interviews conducted.
*   **Week 3: First Captures.** Tier 1 supply deploys to non-sensitive zones. `capture-qa-agent` rigorously tests the `BlueprintCapturePipeline` on this fresh local data.
*   **Week 4: Tier 1 Demand Outreach.** Founder initiates conversations with 10 target robot teams (e.g., Plug and Play Batch 3 startups [cite: 5, 37]). Deliver Anchor Site proof packs. 

### Phase 2: Gated Expansion & Exact-Site Testing (Weeks 5-8)
*   **Week 5: Supply Referral Loop.** Activate the referral loop for the first 25 passed capturers. Goal: reach 100 total capturers. `notion-manager-agent` updates all knowledge docs with local FAQs.
*   **Week 6: Exact-Site Demand Sourcing.** Target Kent Valley facility managers. `city-demand-agent` prepares outreach detailing blueprint's value for robotics integration prep.
*   **Week 7: The Paratrooper Drop.** Deploy local capturers to 3-5 specific Kent Valley/SODO sites requested by robot teams. Test the 72-hour turnaround time from request to hosted review.
*   **Week 8: Commercial Handoff Calibration.** First commercial negotiations for exact-site packages. The Designated Human Commercial Owner utilizes `revenue-ops-pricing-agent` guidance to quote.

### Phase 3: Liquidity & Automation (Weeks 9-12)
*   **Week 9: Tier 3 Supply Open.** Open niche job boards for Seattle freelancers. `intake-agent` transitions to fully autonomous processing of low-risk applications.
*   **Week 10: Inbound Demand Activation.** Launch targeted digital content (local SEO) highlighting the completed SODO/Kent captures (anonymized/rights-cleared).
*   **Week 11: System Stress Test.** Intentionally drive high volume through the `capture-qa-agent`. Monitor error tracking (Sentry) and pipeline GPU sync states. 
*   **Week 12: Review and Graduate.** CEO Agent conducts the 12-week retrospective. If instrumentation targets are met, Seattle graduates from "Launch" to "Active Market."

---

## Outreach Playbooks, Referral Loops, and Channel Strategy

### Capturer Outreach Playbook
*   **Channel:** UW Departmental Mailing Lists, Local Commercial Photography Facebook Groups.
*   **Message Hierarchy:** 
    1. The Ask: Perform detailed indoor spatial video/LiDAR captures of commercial spaces.
    2. The Value: Contribute to foundational spatial AI; earn reliable compensation for high-fidelity work.
    3. The Trust: Strict identity verification; you must respect site operator privacy and rights.
    4. The Reality: Not a get-rich-quick gig. Quality over volume.
*   **Referral Loop:** Activated only *after* a capturer has successfully passed a QA review on a real site. A flat monetary bonus is awarded upon the referred capturer passing their first QA review.

### Robot-Team Outreach Playbook
*   **Channel:** Direct outreach via LinkedIn to Autonomy Leads, Perception Engineers, and Founders in the Seattle metro (specifically targeting the Plug and Play network and AI2 incubator spinouts) [cite: 5, 16].
*   **Message Hierarchy:**
    1. The Hook: Stop testing your AGV navigation on generic datasets.
    2. The Proof: We have a 24-hour proof path for exact-site world models of Kent Valley logistics facilities.
    3. The Call to Action: Log into a hosted review session today to see the SODO Anchor Site, then request your exact target facility.
*   **Agent Role:** `autonomous-research-outbound-worker` continuously scrapes Firehose signals for Seattle-based robotics hiring or funding events to queue draft outreach for human approval.

---

## Ops Readiness Checklist and Failure Modes

### Pre-Flight Checklist
*    `VITE_FIREBASE_API_KEY` and Admin credentials verified in production.
*    `REDIS_URL` configured for live hosted-session state.
*    SODO Anchor Site captured, processed, and rights-cleared.
*    `intake-agent` market-fit matrix updated with Seattle zip codes (e.g., 98032 for Kent [cite: 20], 98108 for Georgetown/SODO [cite: 38]).
*    Trust packet minimums defined for Washington State ID verification.
*    Artifact handoff checklist published to Notion.

### Expected Failure Modes and Mitigations
1.  **Failure Mode:** High rejection rate of early captures due to poor temporal alignment.
    *   *Mitigation:* `capture-qa-agent` must be configured to return specific, actionable feedback on device movement speed and lighting requirements.
2.  **Failure Mode:** SODO/Kent facility managers deny entry to capturers.
    *   *Mitigation:* Deploy the `field-ops-first-assignment-site-facing-trust-gate` protocol. Equip capturers with formalized digital authorization proof generated by the WebApp.
3.  **Failure Mode:** Legacy `notion-reconciler` causes data drift.
    *   *Mitigation:* Ensure legacy shim is paused; rely strictly on `notion-manager-agent` for workspace updates to avoid duplication.
4.  **Failure Mode:** Pricing mismatch for large Kent Valley warehouses (e.g., 200,000+ SF).
    *   *Mitigation:* `revenue-ops-pricing-agent` must establish volumetric pricing bands; founder escalation required for facilities exceeding 100,000 SF.

---

## Spend Tiers

*   **Zero-Budget:** Founder-led organic outreach to UW BRL; direct emails to local robotics startups; manual processing of all trust packets.
*   **Low-Budget (Recommended):** Modest stipends for the first 25 UW student capturers to guarantee baseline supply; API costs for elevated Claude/Codex limits during the stress-test phase; Redis Upstash hosting for high-fidelity hosted sessions.
*   **Funded:** Paid targeted local SEO and LinkedIn campaigns targeting Seattle logistics integrators; dedicated local field-ops community manager; financial incentives for the referral loop.

---

## Research Gaps and Local Validation Requirements

Before Blueprint can claim a "Public Beta" in Seattle, the following missing data points must be validated locally:

1.  **Union / Labor Regulations:** The current research does not indicate the stance of local warehouse worker unions (e.g., Teamsters) regarding third-party spatial mapping inside operational logistics facilities in Kent Valley. This poses a massive rights/access risk. *Validation required: Ops Lead must secure written consent protocols specifically tailored to unionized environments.*
2.  **Local Device Penetration:** The exact density of LiDAR-enabled consumer devices (e.g., iPhone Pro models) among our target UW/freelancer supply base is an assumption. *Validation required: `intake-agent` must run a 100-person dummy survey to establish true local hardware readiness.*
3.  **Exact Robot-Team Conversion Time:** We lack historical data on how long it takes a Seattle-based robotics startup to move from "Hosted Review Started" to "Paid Commercial License." *Validation required: The first 10 robot-team conversations must be rigorously tracked via Firebase to establish a baseline sales cycle duration.*

---
*End of Playbook*

**Sources:**
1. [warecre.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGW0siC9kC75_kgM_zKYArH2Xyb1APHqJ8bby0RyUH2fk7OqWALQVUsgPw5qZ7mXI4Wp5o8sN23DljgJhje5RNr4bvs4q55seNN0wzW80tiOE_FH1oeKo_GWLXvvm5ErBLtV_sJn_JWUC_D7NNE39uCgxNDAqwDSnTZu_qqcfpywm6PRXQ2rhgHUEkZF5knqFCPfkd6)
2. [cushmanwakefield.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHRsksA6N0_5O46PqYcnvJXfTUvLdnihBEehbKz9y-Rqr_-KGzhPVgQNLxQOpSZJ4VF-lLRmN7hZo6UawWpQNjamgqXU7TZUvlCXeDQtSNZsY4AGqwgzR81-bufR-F0o_diSKrEhy1jgV0p6yaYU7nPLrdcyL-vEo68lN7NKOHsGppyzFMPTO4nHdnrbmAqHKxEiQW4pH57Otw=)
3. [commercialseattle.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFGlbl4NiGBIaWEKKVoVx5Y2NBPPjLJW_U4HUW2S9r_iZ8UdO8ddF6EB4Vr9q6qdG_Kt8LD7e6G8dDuLZIq6OcLyTWy7cMAqtZYw9X9cd-NlqttH2p-Pt3FSEWrmaPk3ac5NIAIFdfhyR1Vi-80g2iN_1MMAbvVP9uIYxWtdUM=)
4. [kingcounty.gov](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGuju9_wJgjODICUqo1gYy8F57h7rxVD_DfR3_Ue_9QUVBtM1h9ygixdCwBHvGss5mnpWXxTDTTK4tyw8Rx_Y__XcwQIuhRWFizMKzmQL3BF01SGrW5e0Xh_-JGq1PI7HKkxm0ckO57uzkOPPucIhrv_wEBIwo_XgafmQssgoNio1nKO4mf6fSaCLavqTaKCBSWb-qci_8sZ6UUJ0S-mQsEDEj-vywtB7cEIcjCo_1o4M4mnwcEiIgYwWI1I_GW47d2Gim9sMbgZeGu0gugsaakmSG-0gFSdw4irGBwzL3FhINkf0JU0fikeUVFLJAzkIDO2VuOUGJDx8QzMkw92JZYKoj33fGYphoLtyU4JGaXuhM=)
5. [plugandplaytechcenter.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGE_CGpzu6OyiCY9Vyaa-Xf6T1rMB6DfXXENQtWASj9iZbHibdi0-ZWix5fXiLsBeImMq7cso2cvYKRgj9AoSfdtrfUQ2QKlgBQvud-uPCFDlaPOX--LtgnZddys7PEyBAwUDnMoq_Hjj6Emgjjv1ST_tRJtkVGrz65L-xVXcKpz1g=)
6. [uw.edu](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHd5mKUk0-E4xlX4Jig6MdPh7xM2kigDfrjUJQPZSYnJgaznwWW3NdyVNhG4GlOed1pLKp5OmfFiCCOy0WiqgGSjy9dw_Czm8wz5a_ZDoM7sf94arKvjA==)
7. [washington.edu](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEGAq-0JwGecO4QEPxsR7l41-npUVUttMZAU1tP-qghJ1U1_RBLLo7w6DkiY4IF74sJUsKs5qohaKlpbam0iQthDjpX6AOQFlEvmoMBp3uKiBb91aWaLQjvDJOsfLACseedaBldm0m7wKNxICv4PU_rb9VWYRUy1TbZffHFu1wFX0mnQYAsUtfdkMjCxw4jAmhD4_v5Qn5DXLRS54EY5iHDTBkHsW3RsNpwBZ8=)
8. [nataliabandach.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGD8sjY5rpg2srFMDRN-R-cuoNbsa0v-VBqgoodsc2k1Yp51qk9KFzS93PU34vwaQuBlHvnWaNgPoK7-Q9t2PoZ766sTJNbtF3YEHGN0tJg94Ang_U4pbUQwEsG1icTY3d8mGrTMw==)
9. [justanotherpm.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQETuPM3iveCNzrcW8yGyJvjv1tzxBFQCRzsqzfOPyWsJvrwbQ2K0jYT8AbLk8fxUGCJiLeOBkuRrIg7ePDF0eD6yqDHXTnyeiSgIJV1-IYxOCLfmq_4H_YLv8HikYkSeA8gXS01MfxDic6zSlF59AbuVP4-4n8LBRuNNee8LvdDItWa)
10. [laurabusche.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHqTMEoK6-ZlgJGsdc8FRpi8RUmcHPIqHE35nBUxDkN38cZOtcFs15gUnWak3uj70jF4lsjzLePBMF1EGkCUwgijzlquZRGHRRinNJltZ21-bb-rdZpt3z4R-DZeZY=)
11. [hbs.edu](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE1GWexfLf7jmGCMUrB18RSzuV2CcElmTxZVsRNPgS7l9IFr3szkhHq2NZbg3t94GbiLK6aqUDCGYc0jo8l1FCzODv_8Uvpp6k1ttHGejih34KuLeMSWPYNx91-L84EyJA7jvQ2SNZBpxoVyX2UjLiqSnvWHuqCBBM51bLyB-ygOsTwfmtRmt2FKHukorMUwGIvHjD81rWrwdA-JHOais9agg==)
12. [lennysnewsletter.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEP3gVpctHtSBp5DhxrT-HvWLjebyOZD7SQD74gfKjLYzIvUXEv4las3NYYKOos58Y48sbFtIHUzd9dDzswbGJTqSgbkf_-qbLkpX_mSQMlyq-MrLPCtK9jBr73QjzKEKL25O-wGZ2oqwFgIhoxfUniCIk=)
13. [medium.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG8Se_zfd9Z0SCCi6sgpywb4URSEl1Pc4UxsA83ijunJacmOVFaj3tAUj69H5wF3G1IYnjoutGHHkfULP7oZM3jehJ5PlUYCMKLWr43fCR_n27LoaIcy6Yxx6QhI48niVzl21Zo79A2T2z3xh9W0cSAqyBsMABCv91g_02rMfN3DcJggdSMfb5_EbC6OSdCIV1ryHQYI7GutfkQxBOo4D-EH7nGJE1TSDGC4p8S)
14. [careersatdoordash.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHr3TnXAX3V9aMfS4xDE6h7bG5t5XiLHNiMV88_kxMt3KbcbuUq0WDfF2_0ikRV2LzN9yuaOlwJ5V8lgjXCk9LnYIRsQkRnEBpgkGJWzZqmrjJ5ZtA8pMciKvGfoxcxmp8uK8qa5IBXoDPCnSHq_Wtgw6SaBhzk-0xWUJVyOzxUokAdeo-51oRIpyRO2S96wlw=)
15. [uw.edu](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFmt6NcjV_BxY4JVrcPk1tayoYlzQjhgvkqtXghGkjlohT1jDxWZZIuYq_MGPfj9dS7nVk2IyRxhYKtmwjOrsIgjxz_EOuzIIkMs6rKxKUltYCrnbPU7xUjowhtJiz1feAt2saS7TmaXBHa0hM5mm8=)
16. [greater-seattle.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQECO1YNXoJUPAg9dXz-3Y3ftbhiv6P_P5IrNw6czXwryyJSwfN8thG9MkF02zAJ3WPHk5qysF8T4QQ36jE_FshAH1_YkNhgmmBkwOkY6FGSIOxgHTY=)
17. [plugandplaytechcenter.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGbv3k-FuDcw7wZXlX7xKggE2D-fY04XRN-BK5t2dv6b4EEm4vZVzLf5JgqZSQRDGGPwI_yhMbib-eBl7pbImM6sGoNuqtlGIxhy5IipKaLixaw7_IzIDiwXcaEVXix39P5pLUHGXmaAo5kKys=)
18. [reflectionrobotics.co](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGzEVJIYIInxvKPJZMabx2Ey4_V8kEQzGClHN-skbyC0Gssojas1hj7iuA3SrZeHqdRFYsJQ9EoT3Mgkok9GmRvoV9P-cFxowcdeHIeHXLtqh_TwA==)
19. [kidder.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHUm-l28jI8Bogxd4b4xCXzSYNiqtYvrA8kDsXSAIOpXMFCyKWOHAUW8RJ11a9MNFZwVsV9DvYOIMifFlsjJizXDJ5oApasnLYJcOZgjYgwLJAF1Qon_muOBxN1CxySioSM)
20. [commercialsearch.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFhPILjT49_FobN74qzBfFNKxZB4ELrBqpPtfmACcs49ugxWCTP958Wn-QSFTx1-Ua9cpUecUu5VR--cXrp94KJGH70NF1ryg8kz7j0E9GNELzDi8VjcbhpVW7tVdeJsyc7mFK_qttwtPaG6a6AM1k7IhG0JSqyoS3hqRrbOk1Oc7u9jJW_JxM_rotAzGCZLGI9sFpNlA==)
21. [pacificcontinentalrealty.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHmwDsCKXNnc076jVpK7qEjho0irZ_2Baetw0elelNri3ONgX0Ct-2URyOmPOZxo1Z2mC77WkdcytRKsOAOQeiXV3Ltuy9HcoebIfUnIrt4vGOHG1hZKzxPqjfr_p911oMoPMDFKZtumdKs5m8KhL5rSDAJotvo4XhaVq05mqbtzX2IJ-wgTlkE2XVUYyPfoMXfhtrUJzyRj7ca4Jk39unbK9aX)
22. [kidder.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFAti4-h2oJw-IvI7y5bkappElACiLbkm3m1w03BKJeQkFJWp_ieeknBAqP6bFw1QvjixoIK9ugkE3wlzRG6yC2DqwCrE1rwn-6-JQybklAa8j9tNNXoZm2UpDPIh3MrNbKZXm-J1XiTN4EUGZvvkkf3GSJCKBxctNi7j3UitNkLCxB6pkiHsAKmhoXAuF9U6rT9q32F_zt09NlNel-ccdzuNOWS2h6uA67d2I=)
23. [nai-psp.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQECT5mM9drnGBX5PYAHNzS4PE5M0oNV5H3c5291QL67i_5oicCdXkVpFsCCstMdeC_OzTPosPbehSO6WF1Uz0kvIi3f-YCHjcaG5dGPlrG51yy9k9tpNC_A67x1eLRVgiwH8sGf6Rbyb1MpGm0LQt7kKdf75mS3-g==)
24. [prospeo.io](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEESyZp-cAIQgzUDhibQElYwPRjVvgpnmflBT9ib-8IO0YOfZd8FSAvcM1nQeNisO0VyJDCZFLqQybI_WLTTk_iZ15HMOXrQLarVr34mO-aO-STqMGEDxfHjBXHMItllFVS_pT7)
25. [medium.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHHieRXpy4poa93pNVENCche4ggyo0C6nujjfU6sGnCZRS0vkPe-sCpIIgCM8-dzJ2UjXA0S63yZG9Ef7m0hUEI55kytaw6oOi4nE4ZTN3C6N0iAc6HZindXCJk249h_gICL0w_w5qh3PjwMwROk9AFXFkXv1nsk8TUJXmyadoGeNQtyA56AdeJmSFKj2DbWRBLQ8in8b1HyPUeK_ByPuURGIFEHEX3ve4SqA==)
26. [quartr.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEUfF8zJ0QrkiNp39F0xpo8WjFZ_88IIUUXLkV68z051gA_-jBMuiFKJ1BaLdbd6oJslh1MCC3GwuFEVRBWKjdMHlWyYXlbIgj-itwTNaDh99XYUDe9abSTCrJCoXqvTdqixWuIaLqhkMWobDMGujaZ)
27. [vrinsofts.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFI1-jPZ1FXdRILSVp2jNC98bN267cV0uhO1juEJ7S7JIlTaw1HVtVQGARDqfuK06eKMmVfeNzDIxM4LDmhgKXBaXiQBKz90eqffc7-ykN7puUoAMKdbIq29a3mTbCiU9EVz73sH4IkNEKcPpnS)
28. [careersatdoordash.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE7vOzSpOw4PCivxotBb6pnMuUVF36p7mk2tI5NqTf4gWmD0BeM5r-sfu1kU5025YvcqxHK53OKlJBfGzKiFH494LX_6eoVvgEJT7cZGzzDTn2aBFCKevPkwKQc6d6igtRjbnj5z2eIIq5uATwpN9-EgCAvlHRMEM-jEAlj1SVHrsLz7k1XnpBOQVn-oP0Ow_4cOA==)
29. [careersatdoordash.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGD3wZI_VhcoXM98VxdmtRZ-RqbZKZFtohyE2t5FWh52Ezi9TqmjuZLbqjHIJKn7_8Nhxh6dyYse-3RvM46qO8Pn4WyB0slBz-G--uH1kEVm348BdvtOmMVeMQNQK1__HHKxeWIyWl0nxvsa0-CIkOpOsjR4gFGAvD5ABQECkxJggTSkF6Sdw==)
30. [pehub.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHOTtTrEUEofpUTM6EMnInyfTmKJ3byJzHQ52AMRmbuQiTU5A8E_p2v3TXQ8WVsxxshaGR-c7HX_bGfpuiK9IctbfXs0CNCSmZChC8H3ePIO4d7rjY1MAm6ST05IBJIvhko8lMVUc5Y)
31. [observer.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFeyUjahim595WBgCqyjH4UbQ9TjiId4AD6mPvwCgm2FsTy3NNXtAzZrJZbT9O9l7OOHuoLN_H3Yx3jjtae0KXRUB-XsuJLdoe2kK6s5wXIaYLIFR-tZCZUaHbcTGZONTTzH6JgzG8DKOVA12ClpNAC5E4w32vYGx0By0Ak0ozSishU04jXLfil1YT1UhqwOQ==)
32. [bu.edu](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEwvBePYJNpWxbiywYT6145L7IZ3IXLKkC-gm8dEsDGUBJXdHt-8tyI3iWe-Z2AJaPbzwSxpKEibWdUA_-AJ_w98itqIjLZ49Mj45kPOMTCaW71A1I5ZoDMDsUlzylrscFXD5zBPj5IUv3UcPc=)
33. [strategybreakdowns.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF58s9YRGJIpTuLq5kpff5jF5oGQnA3vSq_yLGw6PLzJWyeIQK1vuczLKKhLK-JHPoJWMLsOgOuudOHC2tz3HGhiJu1orsARy8KFh6WfEhewuiKhyY6zQjMSlEryWgp97pMlX__SZtvNw==)
34. [waterloo.ca](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGeo5j6rkSWSm2lhpWLJbsyxpQk11vWXiRUGtqTwmiLrJ_DGJJu-jNEjyByy5Xdn4VCYy7Pb3it3qa3k-oHOq90-feeabNCEyF23xe3tVSjROjWEDw9LcXYmiaSy1Fg1PWPRGEefsbYCh7nvVJ-s6ccuzXQQy9Cfsvnl_aAa9iOlMBMvgBYX6DQ)
35. [ucair.org](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFh0X9M-JsBXiEVU0VSQpHcSbbsJLsor0Tar3XRyJEaDVtXueIe3JpIUDLcTFrk53o6ZMjCOIppYGOnUcdiZNj4JX04POagO7n1rWHWM4n8bmVoKeQNOQypVJ8LtNOVap0gtvKe1acFIsHS74tpB7oPo75N7Ryov4wSw4U=)
36. [portland.gov](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGGqjfkYgn6MXqhh3IUafuKtJCe9szJ8y8s_gGHr9jYC2-NfYE8wsimca6Z4h95khpYEjfKXFqUAaafcfVxR31VF_eEu7yKalFnbZtBW6Kov190bbxqknVNZFGp91WY9eLJ0Va2Qd1tOgRs4EN2PYAE4PWkM5TFo_jpKL6Cb7_AxXrnUiH0H_o5IfYC37JB6nwIf-m3Wau7WYX9q71IKY_po3xrxp_tRY6b0e11_Q==)
37. [geekwire.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHXxj9nXSVfjP0rEjOgToLO3_i45JUc-FV3i7UBuUHSlUDHs-B8msgtdhkHqOIq8oop4ZLIBb8n9A6vaV9IbaO35564-SkLIRAL4dBjn4l3lzg1-n49BWG1nSB-c6ktN9CIVghi_XQUcUayxGzHoZeED0R3qqgUbZ8VVhp0GKy_gi2Xr-MZBgH41RfS9VEn_fVZWBMK_n0-kAYjtZCOQlA=)
38. [crexi.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFZjqZXw0BriFbRkE-J_ZjoAQQHQFw9iSvMEyJ5evDaaaqhk5QUCR5ds9f5VhFPN4wTdARheBtvKo-rKFUAQH60dORzpjKNB9CgOh5MzTaAWq4YL5tUQ6FH-W8IOykEadWEfS3snVlCkj5bsPHspY8aD9an6su6oZG63FXRje7xqH1YC8ZR43Obrr6Aguw0cQSUvVX5afyJFCVbsIU=)