# San Diego, CA Initial Deep Research

- interaction_id: v1_Chd1Z2pkYVlyNUljbXhqTWNQX3JHRGtBSRIXdWdqZGFZcjVJY214ak1jUF9yR0RrQUk
- status: completed

## Prompt

```text
You are Blueprint's city launch research director.

Objective: produce the most expansive, detailed, operator-ready city launch playbook possible for San Diego, CA.
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
4. Translate that into a Blueprint-specific launch playbook for San Diego, CA.
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

# Blueprint City Launch Playbook: San Diego, CA (2026 Edition)

**Key Points**
*   **Wedge Identification:** San Diego is uniquely positioned for Blueprint’s capture-first doctrine due to its dual concentration of commercial Autonomous Mobile Robotics (AMR) (e.g., Brain Corp) and defense-oriented autonomous systems (e.g., Shield AI).
*   **Operational Posture:** Blueprint will run a gated-cohort pilot focusing strictly on indoor logistics and complex multi-room environments in Otay Mesa and Sorrento Valley.
*   **Launch Sequencing:** The playbook dictates a supply-seeding-first motion. Blueprint must secure high-fidelity, rights-cleared capture assets (Proof Packs) of industrial spaces before initiating demand-side outreach. 
*   **Agent-Human Symphony:** Routine operational classification, top-of-funnel outreach, and telemetry are entirely agent-managed (via Paperclip routines), while commercial commitments, pricing, and exact-site rights remain strictly human-gated.
*   **Controversy & Complexity:** Autonomous operations and AI data collection face growing regulatory scrutiny in California, making explicit privacy boundaries, site-operator consent, and provenance-safe data pipelines critical to preventing catastrophic failure modes.

### Introduction to Blueprint's Exact-Site Model
Blueprint’s fundamental doctrine dictates that we are not selling a generic foundational model or an abstract qualification tool. We sell site-specific world-model packages and hosted access to exact-site environments. This playbook outlines the systematic process for launching San Diego, California. It translates generalized marketplace growth mechanics into a capture-first, world-model-product-first operating rhythm, tailored to San Diego's unique industrial and robotics landscape.

### Strategic Imperative
San Diego represents a high-leverage beachhead market. By dominating indoor industrial capture in areas like Otay Mesa, Blueprint can immediately deliver Exact-Site Hosted Reviews to local robotics teams actively developing navigation software for complex, GPS-denied, or dynamic environments. This document serves as the authoritative, executable architecture for both human operators and autonomous agents to initialize, scale, and govern the San Diego market in Q3/Q4 2026.

---

## 1. Executive Summary

This playbook defines Blueprint's go-to-market architecture for San Diego, CA. It is designed for immediate execution by Blueprint's autonomous agent org (powered by Paperclip) and the human operator executive layer. 

**Objective:** Achieve localized liquidity in San Diego by producing operator-ready, site-specific world-model products for local AMR and defense-robotics teams.
**Primary Wedge:** Exact-Site Hosted Review for commercial warehouses in Otay Mesa and technical/biotech laboratories in Sorrento Valley.
**Execution Model:** 
1.  **Seed the Hard Side:** Recruit a highly gated, localized cohort of 25 technical capturers (drone pilots, mapping professionals, and technical videographers).
2.  **Generate Proof Assets:** Capture and materialize 5-10 high-value, rights-cleared sites into Blueprint’s GPU pipeline to create sellable hosted-session artifacts.
3.  **Drive Demand:** Execute highly targeted, proof-led outreach to 10-25 San Diego-based robotics teams (e.g., Brain Corp, Shield AI, local integrators), leading directly with exact-site artifacts rather than generic AI capabilities.
4.  **Agent Integration:** Utilize `city-launch-agent`, `intake-agent`, and `analytics-agent` to automate pipeline triage, while the human `Ops Lead` and `Growth Lead` maintain strict gates on commercial pricing, privacy boundaries, and site access rights.

---

## 2. City Thesis and Why Now

### The San Diego Hypothesis
San Diego is the optimal launchpad for Blueprint’s capture-first world-model ecosystem because it possesses a geographically dense concentration of highly funded, deployment-focused robotics companies combined with a rapidly expanding industrial real estate footprint. 

**Why San Diego Now (2026)?**
1.  **Density of Robotics ICP:** San Diego is home to Brain Corp, which has deployed over 37,000 AMRs covering 250 billion square feet globally [cite: 1, 2]. It is also the headquarters of Shield AI, an aerospace defense company valued at over $2.3 billion, specializing in AI-piloted drones (Nova, V-BAT, X-BAT) that require complex, GPS-denied indoor training environments [cite: 3, 4, 5].
2.  **Industrial Real Estate Boom (The Capture Target):** The Otay Mesa submarket is undergoing massive logistics expansion. With over 23 million sq. ft. of existing industrial space and massive new developments like the 1.8 million-square-foot Otay Business Park [cite: 6, 7], Otay Mesa provides the exact complex indoor environments AMR teams desperately need to test warehouse automation, palletizing, and inventory scanning [cite: 8].
3.  **Local Autonomous Proving Grounds:** San Diego is an established autonomous testing zone. Waymo and Zoox are actively mapping and testing in neighborhoods like Bankers Hill and Mission Hills [cite: 9, 10]. This normalizes autonomous data collection and provides a fertile ecosystem for secondary demand segments (e.g., deployment ops teams).
4.  **Available Technical Supply:** The city has a rich supply of commercial drone pilots (Part 107 certified), land surveyors, and freelance videographers, with local hubs like US Drone Supply in San Diego ensuring hardware availability [cite: 11, 12, 13]. Furthermore, the San Diego Tech Hub (1,600+ members) offers a direct, high-trust community for recruiting technical capturers [cite: 14].

**Conclusion:** Blueprint does not need to invent a use case here. The demand for indoor, exact-site world models exists natively within San Diego's AMR and defense sectors. 

---

## 3. Analog Comparison Table: Translating GTM Mechanics

To build the San Diego launch strategy, Blueprint's agents studied the cold-start mechanics of legacy consumer networks (Uber, DoorDash, Instacart, Airbnb) and modern decentralized physical infrastructure networks (DePIN) like Hivemapper. 

*Disclaimer: Blueprint is not a consumer rideshare or delivery app. We are an enterprise, site-specific world-model product. We adapt the underlying mechanics of liquidity sequencing while rejecting the generic, open-door growth models.*

| Company | Core Wedge / Cold Start Solution | Supply Seeding Tactic | Demand Generation Tactic | Relevance to Blueprint (Copy / Adapt / Reject) |
| :--- | :--- | :--- | :--- | :--- |
| **Uber** | Subsidized supply density before demand. | $1,000 sign-up bonuses, guaranteed hourly earnings to create artificial liquidity [cite: 15, 16]. | Free rides, aggressive VC-funded fare subsidies [cite: 15]. | **Adapt:** We must seed supply first. **Reject:** Broad subsidies. Blueprint requires *high-trust*, vetted capturers, not raw volume. We do not subsidize empty supply; we pay for verified site captures. |
| **Airbnb** | High-quality visual assets to build trust. | "Do things that don't scale": Founders went door-to-door in NYC taking professional photos of listings [cite: 17, 18]. | High-quality listing photos drove 40% higher conversion [cite: 18]. | **Copy:** High-fidelity, verified asset creation. Our "professional photos" are our *Proof Packs* and Hosted Reviews. Trust is built through verifiable provenance and rights metadata. |
| **DoorDash** | Hyper-local neighborhood density. | Onboarded restaurant menus manually before restaurants even explicitly partnered [cite: 18]. | SEO-optimized restaurant pages driving local hunger queries. | **Adapt:** We capture sites proactively (lawfully) to build the Exact-Site inventory before AMR teams ask for them. **Reject:** Scraping. All Blueprint captures must have explicit provenance. |
| **Instacart** | High-frequency utility. | Dedicated shoppers stationed inside specific high-volume grocery stores. | Promising 1-hour delivery of existing local inventory. | **Reject:** High-frequency, low-margin gig labor. Blueprint capture is a specialized, technical, low-frequency/high-value event. |
| **Hivemapper** (Robotics Infra Analog) | Decentralized global map rendering using dashcams. | Distributed proprietary hardware (dashcams); rewarded drivers with HONEY tokens [cite: 19, 20]. Validated data via AI trainers [cite: 21]. | **"HONEY Bursts"**: Allowed B2B customers to request on-demand fresh map data for targeted intersections/cities [cite: 22, 23]. | **Copy:** The "Bursts" model. We will implement "Capture Bounties" for specific target facilities (e.g., a specific Otay Mesa warehouse requested by Brain Corp). |

### What Blueprint Will Explicitly Reject
*   **Open-City Pushes:** We will not run open Facebook/gig-worker ads. Blueprint supply must be gated and qualified to ensure safe, rights-cleared data pipelines.
*   **Vague AI Claims:** We will not sell "the best foundation model." We sell the Otay Mesa Warehouse #4 Hosted Session. 
*   **Democratic Growth:** We will not try to grow supply and demand simultaneously [cite: 16]. We will establish the Exact-Site Proof Packs *first*.

---

## 4. Supply-Side Launch Design: Capturing San Diego

**Objective:** Build a highly reliable, rights-aware, and technically competent capturer network in San Diego, starting with a heavily vetted initial cohort.

### Target Capturer Profile
San Diego's ideal capturer is a Part 107 certified drone pilot, commercial videographer, or 3D mapping surveyor. These individuals already possess the spatial awareness, hardware (LiDAR-enabled devices, advanced cameras), and professional demeanor required to navigate industrial sites like Kearny Mesa distribution centers or Sorrento Valley biotech labs without causing operational disruption [cite: 12, 24, 25].

### Stage 1: The First 25 Capturers (Gated Seeding)
*   **Methodology:** Hand-to-hand combat and direct operator recruitment. No public signup links.
*   **Channels:** 
    1.  **San Diego Tech Hub (SDTH):** Direct networking via their community events and forums [cite: 26].
    2.  **Local Drone Supply & Pilot Networks:** Direct outreach to professional surveying firms (e.g., NV5, UNICO Engineering) and freelance pilot job boards [cite: 11, 12].
*   **Trust Mechanism:** Mandatory 1:1 onboarding via `intake-agent` scheduling, followed by human `Ops Lead` verification. Capturers must pass a "Trust Packet" review (Identity, device validation, understanding of site-privacy boundaries).
*   **Activation Metric:** First successful indoor capture of a "Test Site" (e.g., their own office or a public, rights-cleared local space) successfully materialized through `BlueprintCapturePipeline`.

### Stage 2: The First 100 Capturers (Targeted Expansion)
*   **Methodology:** Targeted cohorts and localized "Bursts."
*   **Channels:** 
    1.  **University Clusters:** UCSD Contextual Robotics Institute graduate students [cite: 27]. 
    2.  **Targeted Geographic Bounties:** Mirroring Hivemapper's "Bursts" [cite: 22], we issue specific paid bounties for logistics sites in Otay Mesa and Kearny Mesa. 
*   **Trust Mechanism:** Moving from 1:1 human interviews to `capture-qa-agent` automated rubric scoring for technical capture quality (timestamps, poses, intrinsics, depth). `Ops Lead` performs random QA audits.

### Stage 3: The First 250 Capturers (Network Loops)
*   **Methodology:** Activation-gated referral loops. 
*   **Mechanism:** Only capturers who have successfully passed three (3) high-fidelity commercial captures and maintained 100% adherence to Blueprint's privacy/consent doctrine are granted referral codes. 
*   **Human Gate:** Any change to referral compensation must be approved by the human `Growth Lead` and `CEO`. 

---

## 5. Demand-Side Launch Design: Robot-Team Conversations

**Objective:** Transition exact-site captures into hosted-session reviews and commercial pilots with San Diego's robotics developers.

### Target Buyer Profile
1.  **Primary ICP (Autonomy/Perception Leads):** Engineers at Brain Corp, Shield AI, or smaller stealth AMR startups in Sorrento Valley who need hyper-realistic indoor simulation environments to train collision avoidance, room-clearing, or inventory-scanning algorithms [cite: 28, 29].
2.  **Secondary ICP (Deployment Ops):** Systems integrators outfitting new Amazon fulfillment centers in Otay Mesa [cite: 30] or local logistics companies deploying automated guided vehicles (AGVs) [cite: 8].

### Stage 1: First 10 Conversations (Proof-Led Direct Sales)
*   **The Asset:** We do not reach out until we have 3-5 pristine "Proof Packs" of San Diego industrial spaces.
*   **The Motion:** Founder-led, highly targeted outreach to engineering managers at Brain Corp and Shield AI. 
*   **The Message:** *"We have a fully materialized, site-specific world model of a 50,000 sq ft Otay Mesa warehouse with full depth, pose, and provenance data. Here is the Hosted Session link to review it within 24 hours."*
*   **Goal:** Secure technical feedback on the `GPU compatibility contract` and the bridge materialization outputs. Do they integrate cleanly into the buyer's existing stack?

### Stage 2: First 25 Conversations (Expansion via Partners)
*   **The Asset:** 10+ Proof Packs covering both wide-open warehouses (Otay Mesa) and tight-corridor office/lab spaces (Sorrento Valley).
*   **The Motion:** `autonomous-research-outbound-agent` identifies mid-tier robotics integrators and defense contractors in the area. 
*   **The Message:** Move from founder-led demos to asynchronous, self-serve Proof Pack reviews using `Blueprint-WebApp`.
*   **Goal:** Test pricing elasticity via `revenue-ops-pricing-agent`. Validate the standard commercial handoff (when does technical evaluation turn into a procurement conversation?).

### Stage 3: First 50 Conversations (Establishing the Moat)
*   **The Asset:** A compounding catalog of exact-site models.
*   **The Motion:** Inbound demand via technical content marketing (e.g., publishing anonymized benchmarking reports of AMR navigation within Blueprint world models). `buyer-solutions-agent` manages triage.
*   **Goal:** Repeatable, scalable contract execution.

---

## 6. Proof-Asset Design: What Must Exist Before Scale

Blueprint cannot sell a concept. We sell reality. Before `growth-lead` initiates Stage 2 demand outreach, the following assets *must* exist and be fully queryable within `Blueprint-WebApp`.

### 1. The Anchor Site Proof Packs (Quantity: 3-5)
Each Proof Pack must be a perfect instantiation of Blueprint's Truth Hierarchy.
*   **Otay Mesa Logistics Facility:** (Target: 100,000+ sq ft). Demonstrates wide-open spaces, high ceilings, dynamic lighting, and repetitive racking structures [cite: 6].
*   **Sorrento Valley Tech Lab/Office:** Demonstrates tight corridors, reflective surfaces (glass), and multi-room complexity.
*   **Required Data Layers inside the Pack:**
    *   Raw capture bundle (video, IMU, depth, timestamps).
    *   Site-specific world-model package (materialized via `BlueprintCapturePipeline`).
    *   Cryptographic provenance chain (proving device, time, and location).
    *   **Explicit Rights Metadata:** Irrefutable digital proof of the site operator's consent for commercial use.

### 2. The Exact-Site Hosted Review Surface
*   A browser-based runtime (via `Blueprint-WebApp`) where a robotics engineer can virtually "drive" a simulated agent through the materialized Otay Mesa warehouse without needing to download massive datasets or negotiate complex local environments.

### 3. The Artifact Handoff Checklist
*   A clear, markdown-formatted technical document attached to every Proof Pack detailing *exactly* how the world-model outputs map to standard robotic simulation tools (e.g., ROS, Gazebo, Isaac Sim compatibility).

---

## 7. Human and Agent Operating Model by Lane

Blueprint operates an autonomous organization powered by Paperclip. To execute the San Diego launch, responsibilities are strictly partitioned to ensure scalability without sacrificing the critical human gates of privacy, rights, and pricing.

| Department | Role (Human/Agent) | San Diego Launch Responsibilities | Human Gates / Escalations |
| :--- | :--- | :--- | :--- |
| **Executive** | Human Founder (CEO) | Final Go/No-Go for SD Launch. Setting capital spend limits. | All non-standard commercial terms. Overriding rights/privacy exceptions. |
| **Executive** | `blueprint-chief-of-staff` (Hermes) | Monitors SD Paperclip queues. Routes stuck intake tickets. Correlates outbound blockers. | Cannot override human decisions. Must package founder asks cleanly. |
| **Growth** | `growth-lead` (Human/Hermes) | Determines SD channel mix. Decides when to open/close SD capturer cohorts based on liquidity. | Budget approval for SD targeted "Bursts". Final copy approval for ad-spend. |
| **Ops** | `ops-lead` (Human/Hermes) | Manages SD Trust Kit rubrics. Governs the First-Capture QA thresholds for the SD drone pilot cohort. | Approves local site-operator consent waivers. Handles legal/privacy exceptions. |
| **Ops** | `intake-agent` (Claude) | Ingests SD Waitlist applicants. Scores SD Capturers against market-device fit matrix. | Escalate rejected local capturers. Cannot automatically send final cohort invites without `ops-lead` approval. |
| **Ops** | `revenue-ops-pricing-agent` | Analyzes SD robotics buyer demand to draft localized pricebooks for exact-site models. | Cannot publish live pricing. Drafts only for Human Commercial Owner. |
| **Engineering** | `webapp-codex` / `claude` | Maintains SD locale-specific tagging in marketplace. Ensures Firebase/Stripe routing for SD buyers. | Escalate fundamental changes to bridge materialization contracts. |

---

## 8. Funnel Instrumentation and Launch Gates

Prior to any outreach, `analytics-agent` must confirm the following tracking events are live in Firestore / PostHog, adhering to the `BLUEPRINT_ANALYTICS_INGEST_ENABLED=1` configuration. 

*Missing Data Callout: We currently lack historical baseline conversion rates for hardware-heavy capturers (e.g., drone pilots). Initial targets are hypotheses.*

### Telemetry Pipeline
1.  `sd_capturer_waitlist_entry` (Properties: source_channel, hardware_profile, part107_status)
2.  `sd_trust_packet_submitted` (Properties: identity_verified, rights_acknowledged)
3.  `sd_cohort_approved` (Human operator stamped)
4.  `sd_first_capture_uploaded` (Properties: site_type, duration, gigabytes)
5.  `sd_first_capture_materialized` (Fires when `BlueprintCapturePipeline` completes the GPU bridge)
6.  `sd_robot_team_inbound` (Properties: company_name, use_case, exact_site_req)
7.  `sd_proof_pack_delivered`
8.  `sd_hosted_review_started` (Properties: session_duration, artifacts_inspected)

### Hard Launch Gates (Do Not Proceed Unless Validated)
*   **Gate 1 (Go-to-Market):** `ops-lead` signs off on the San Diego Trust Packet (localized for California privacy laws and commercial real estate recording permissions).
*   **Gate 2 (Supply Activation):** At least 10 Capturers have successfully materialized 1 site each. 
*   **Gate 3 (Demand Activation):** `Blueprint-WebApp` can serve a seamless Hosted Session of an Otay Mesa industrial site with `< 200ms` latency via `REDIS_URL` live-state storage.

---

## 9. Weekly Execution Plan: First 12 Weeks

This timeline dictates the asynchronous workflow between human operators and AI agents. 

### Phase 1: Infrastructure & Seeding (Weeks 1-4)
*   **Week 1:** 
    *   *Agents:* `notion-manager-agent` initializes the San Diego Launch Workspace. `analytics-agent` builds the San Diego funnel dashboard in PostHog.
    *   *Humans:* Ops Lead reviews and finalizes the California-compliant Trust Packet and privacy waivers.
*   **Week 2:**
    *   *Agents:* `autonomous-research-outbound-agent` scrapes SD Tech Hub, Indeed, and local drone supply boards for target capturer leads [cite: 11, 13, 14]. Generates 100 highly qualified leads.
    *   *Humans:* Growth Lead reviews lead list. Executes direct 1:1 outreach via email/LinkedIn.
*   **Week 3:**
    *   *Agents:* `intake-agent` processes initial waitlist replies, scoring hardware fit (e.g., LiDAR-equipped iPhone Pro, depth-cameras). 
    *   *Humans:* Ops Lead conducts 1:1 video interviews with the top 25 candidates. Issues invites.
*   **Week 4:**
    *   *Agents:* `capture-qa-agent` stands by. 
    *   *Humans:* The 25-person cohort executes their first test captures. Pipeline materialization begins. 

### Phase 2: Anchor Asset Creation (Weeks 5-8)
*   **Week 5:**
    *   *Agents:* `chief-of-staff` alerts Ops Lead to materialized captures. 
    *   *Humans:* QA review. If capturing quality is low, retrain cohort. Pay out successful capturers. 
*   **Week 6:**
    *   *Agents:* `revenue-ops-pricing-agent` begins tracking capture costs to establish baseline COGS.
    *   *Humans:* Execute the "Otay Mesa Burst." Issue specific bounties to top-tier capturers to secure 3-5 industrial warehouse captures. 
*   **Week 7:**
    *   *Agents:* `pipeline-codex` and `pipeline-claude` ensure the Otay Mesa captures successfully pass the GPU compatibility contract and render properly in the web runtime.
    *   *Humans:* Compile the "Artifact Handoff Checklists" for these specific sites. 
*   **Week 8:**
    *   *Agents:* `buyer-solutions-agent` drafts outbound emails to Brain Corp, Shield AI, and Zoox engineering leads using the newly minted Proof Packs.
    *   *Humans:* CEO/Founder reviews outbound copy. Founder initiates outreach to target executive networks. 

### Phase 3: Demand Activation & Hosted Reviews (Weeks 9-12)
*   **Week 9:**
    *   *Agents:* `intake-agent` classifies inbound/reply demand from robotics teams (Exact-site vs. adjacent-site needs). 
    *   *Humans:* Deliver Hosted Session links. Designated Human Commercial Owner takes over warm leads.
*   **Week 10:**
    *   *Agents:* `analytics-agent` monitors `sd_hosted_review_started` events. If a robotics team spends >30 minutes in a session, trigger an alert to the Growth Lead.
    *   *Humans:* Follow-up with technical recaps and artifact export discussions. 
*   **Week 11:**
    *   *Agents:* `ops-lead` summarizes ops load, capturer churn, and pipeline sync issues. 
    *   *Humans:* Address failure modes. Expand capturer cohort to 100 via referrals if demand velocity outpaces supply.
*   **Week 12:**
    *   *Agents:* `investor-relations-agent` compiles the San Diego Launch metrics (time-to-proof, active capturers, hosted sessions completed) into the monthly update.
    *   *Humans:* CEO decides whether to transition SD from "Pilot" to "Operational."

---

## 10. Outreach Playbooks, Referral Loops, and Channel Strategy

### Capturer Sourcing Playbook (The "SD Drone/Mapping Cohort")
*   **Channel Strategy:** Do not use generic "Make money gig driving" messaging. We appeal to professional pride and technical curiosity.
*   **Targeting:** Indeed job postings for UAV pilots in Escondido, freelance videographers in Chula Vista [cite: 11, 12].
*   **Agent Outbound Prompt / Email Structure:**
    *   *Subject:* Paid mapping pilot: Blueprint San Diego Cohort
    *   *Body:* "We are building site-specific world models for robotics simulation. We need 25 technical operators in San Diego with spatial capture experience (drones, LiDAR, photogrammetry) to capture industrial spaces in Otay Mesa and Sorrento Valley. This is high-value, rights-cleared capture work, not low-wage delivery. You maintain clean provenance of your work."

### Robot-Team Demand Playbook (The "Brain Corp / Shield AI Motion")
*   **Channel Strategy:** Highly technical, proof-led, founder-to-engineer routing. 
*   **Targeting:** Perception Leads, Autonomy Engineers, Simulation Directors. 
*   **Agent Outbound Prompt / Email Structure:**
    *   *Subject:* Hosted Session: 100k sq ft Otay Mesa Warehouse World Model
    *   *Body:* "I know [Company] is testing indoor navigation. Instead of generic synthetic data, Blueprint just captured and materialized a 100,000 sq ft industrial facility in Otay Mesa. We have the raw bundle, full poses, intrinsics, and the hosted interactive package ready today. Here is the link to the hosted review session. Let me know if you want the artifact handoff checklist for ROS/Isaac integration."

### Activation-Gated Referral Loop
*   *Mechanic:* A capturer is only given a unique invite code *after* their first capture passes QA and materializes. 
*   *Reward:* Paid bounty upon the referred capturer's first successful materialized capture. 
*   *Why:* Ensures we only replicate supply that understands the stringent technical and privacy requirements of Blueprint's doctrine. 

---

## 11. Ops Readiness Checklist and Failure Modes

Before `npm run smoke:launch` is executed for the San Diego environment, the following must be verified:

### Readiness Checklist
-  **Rights & Privacy:** California-specific consent waivers for commercial property capture are legally reviewed and loaded into the `Blueprint-WebApp` capturer portal.
-  **Infrastructure:** `REDIS_URL` is configured for high-concurrency Hosted Sessions, preventing latency during technical evaluations by demanding robotics teams.
-  **Pipeline:** `PIPELINE_SYNC_TOKEN` and Firebase Admin are properly linked to ensure inbound requests sync cleanly with the GPU materialization queue.
-  **Agent Config:** `BLUEPRINT_WAITLIST_AUTOMATION_ENABLED=1` and `BLUEPRINT_INBOUND_AUTOMATION_ENABLED=1` are active in production.
-  **Human Watchdogs:** Overdue queue watchdogs (`BLUEPRINT_FINANCE_REVIEW_OVERDUE_WATCHDOG_ENABLED=1`) are active to prevent capturer payout stalls.

### Critical Failure Modes & Mitigations
1.  **Failure Mode:** Capturers trespass or violate industrial IP/privacy boundaries in Otay Mesa.
    *   *Mitigation:* Strict human-gated Trust Packet review. Capture app explicitly requires site-operator authorization upload before recording begins. Immediate permanent ban for violations. 
2.  **Failure Mode:** GPU Pipeline chokes on massive warehouse captures (>50GB bundles).
    *   *Mitigation:* `BlueprintCapture` client must enforce chunking and localized bounds. `pipeline-codex` to monitor memory spikes during materialization. 
3.  **Failure Mode:** Robotics teams view the Hosted Session but don't convert because artifacts don't fit their simulation stack.
    *   *Mitigation:* Blueprint is *capture-first*. If the rendering is incompatible, we still own the raw, authoritative capture truth (timestamps, poses, depth). The human operator must quickly pivot to offering raw data licensing while `CTO Agent` evaluates a new export adapter.

---

## 12. Spend Tiers

*All numbers are strategic estimates pending final Human CEO budget approval.*

### Zero-Budget (Current Default)
*   **Supply:** Founder and `autonomous-research-outbound-agent` scrape Indeed/LinkedIn for 100 local technical operators. Onboard organically. 
*   **Demand:** Founder-led emails to 2nd-degree network connections at local robotics firms.
*   **Incentives:** Capturers are only paid a standard unit rate per successful commercial capture (funded by eventual buyer revenue).

### Low-Budget ($5k - $15k / month)
*   **Supply:** Pay upfront bounties ("Bursts" of $500-$1000) for highly specific, difficult-to-access sites (e.g., inside an active Sorrento Valley biotech lab). 
*   **Demand:** Host a technical breakfast for 20 perception engineers near UCSD or Sorrento Valley. Give live Hosted Session demos. 
*   **Incentives:** Activate the referral loop with $200 bonuses for referring verified Part 107 drone operators.

### Funded Expansion ($50k+ / month)
*   **Supply:** Hire a dedicated San Diego Field Ops Manager. Guarantee hourly minimums for a dedicated fleet of 10 professional LiDAR mappers to blanket every commercial real estate vacancy in Otay Mesa.
*   **Demand:** Sponsor a local robotics/autonomy hackathon using Blueprint world models as the base infrastructure.

---

## 13. Research Gaps & Pre-Beta Validations

**Data that is currently MISSING and must be validated locally by the `city-launch-agent` prior to claiming a "Public Beta":**

1.  **Site Operator Willingness in Otay Mesa:** We assume commercial real estate owners in Otay Mesa will permit indoor capture. *Unvalidated.* We must test if they require rev-share or strict NDAs before allowing cameras near logistics setups. 
2.  **Hardware Penetration:** What percentage of target capturers in San Diego currently possess the required hardware (e.g., specific LiDAR-enabled iOS devices or specialized 360 rigs) to meet the GPU compatibility contract? *Unvalidated.*
3.  **Brain Corp / Shield AI Stack Compatibility:** We know these companies need indoor data. We do *not* definitively know if their current ingestion pipelines prefer raw point clouds, mesh formats, or interactive web-based APIs. *Must be validated during Stage 1 Demand Outreach.*

### Conclusion
San Diego offers an asymmetric advantage for Blueprint. By utilizing disciplined, agent-assisted pipeline management to conquer the hard-side supply of complex industrial captures, Blueprint can bypass generic AI hype and deliver irrefutable, exact-site world models directly to the doorstep of the world's leading robotics developers. Execution begins immediately upon founder approval of the Stage 1 constraints.

**Sources:**
1. [therobotreport.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFD7931BcASc81xhML7FnXAHU7_5WXuJECXkV3YT10sBOymTADAM3KgEy4lUFattSMsGU5cnc_DfxUqNZpg2DLWtbXhtHxMZNCciI3T7rCCVWtnKc7nnjQZiUD4FKfRsMeDPYuYr7A_ZnD-nsi5PZokaAayL9WOffWgf3EA-iq1cG4kC2oz8EL6xB2JlCS_1pxYI9jxDWlmaMp6sNViKm9atw==)
2. [businesswire.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH9PyTeju9VGCRqwFYktsOCSUzIZABEgh7YJFo25yN6tMl6WlVZbfw2iFG_mDyDW0IT0Vramh52buhy7o_rrpMpoXesRQ-QYWVqifGwWiA7YlB7-wCPJlOdO-6LLIzMW-_G8yEnHZyhFo-Feh65txcGxMu7sJ9aoSn69_lqnUTDiioBmCUf0mugyV7GMXOUgYIS9ONWesIu49TSun6aagBUjBS-2MDIifEtYSdAM6LW3K9SAjWSjEb8K0jaGfVGPD22Qw5M4iRVQfSQpEtwmYlTCkmGxMkf3bm9jRtI1D_lc-RI)
3. [wikipedia.org](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGFbEXZPI8Ojj4TxOqou6K4dIVnRKMzwN_5cI-X2G-a4U2EEeTLyt5Lc6b9wNIWwywT2rboW_PVzqKrSG-1ZZHvrqrEvqPkhGuKhv2NXdz0dIzCBrl_Rie1PI9c-0I=)
4. [govtech.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG8RAU7c2gl8NcENWSnm7bFiCl0tc9aRvbhEP4cfS4VclxO7n3IuHd2mc0pOzL4W5Oc3f7eUbUB4IqAw7tccePZM6KZH6oARRv4bnh4d0goROqvsTTMcxVgR7hJHho8NZyloEwZ3hSH280MhhHrFqsQUAvqPijt3f_5L3dJNIe9iAHvXuSWzKE-Oeam70Cs)
5. [defenseone.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGEuz8DEArDkq004NEX5m8TNAPuiWItKc-SSdu1fuYWUHhdR7VT7ryfeLeL3Oao7uaHnOcFz72mKRlK6hG_LiRUhwqa-uxOGrBQ5NfnEI8Qi9unu-vgg8bCX_PqyBadqguDFU5S2OPflWsGaD8vRkxQQm_cI_JVhVpzDacKzhPrMoPMwYrVFnYZf6ZUhHCcWOcGLm-TE-4sTieQF0LTSq1a2dQJ_U03FSjlW0KUc9mQ6HrEcw52nIKTrQ==)
6. [cbre.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHg2jiZp4e6eLf7K_a1zomu8UdHM70lmBvBnv-KyGILG61BpeokBaxny8hqRBhRyHBnsRRyWd2nYY_khJqffFg832zzOyGNkfefftSC8TPYkq6b4RnO47zn4oJ4GivChAIZEk8azWSNUqTmW9zMVbg4w57RdRTXZQggIFS9Z62itnqcCRuSAIwZZVE=)
7. [elevation-land.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGIuXvvl6D5VcowERghJHwCUnitPipblAurf2-9b0QXEh-pAuO3BhhvLjWk69d4ePd9NBy572vqPmM7U-zTd4GKkiN18RM6FKG9QmDmTqjnlUko6gzDvl3nnpuUXkbsykml00afSiJd6TFBVfT7qF7-plH9ujPU58rgfNJ-mNVsUKO25a8L-BQ2bF-ZneOOhp6smq7-fcwpSDj74gwl3IMY0JA=)
8. [raymondwest.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGtjBoBjDO7bcgZqkjNIk95lC3E6xwykqUvKrTMh6x5JetWexIXgNg7Vj5AXl6uEKhM6Kf-8arovNvulrmP2gyJ9xvhzezTl0AaPrdlxn8v9bgwOb_szO8Ve6oKUc_KwPztfabzXifUWjKUCIsLCgJf83bORyeo5yqhSjpjeMUdnk_iYLC9c9fRewood6S3tpUgB1XElAyYmuN58ZqZ1BXcPAntRQVyrHHAwfs=)
9. [govtech.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEkZKRcBSqr5yWY3x5ixZs6mGlqzZXjr3u5bo1NfZwBL17bY_8okFDcTEryv5eA-eIUDnL4tgOz-qZHEy3-V9X2EmzYL0ngcdkpIzD_KgUcqOjxe_dnnGq3QKDfCiWycQEzQjj1nuPtL4Df9OPWgqdcljEBDQI05ecEmwHTPSZc7E3AbH5DeJ25LaPB8XOA66K0dRjwVJwN)
10. [labusinessjournal.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEJQaztYQByhz60Wev09ho6J5g-XhRhPLf7YuPq3v2TMhOqAPza2RbBcYhSyFLIHwsXQnGl_Cc_iL-CRkkVlQ8NVBvE2P5RG8irz0OEBF7h9U8ewg0OBUHx9uc8rkwCkYnSEztc1Z3TWfsdDbTr8Hktjz69f0dJLJCLpMYuPUDFiM6egcWTfzIVDNU=)
11. [indeed.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEqg9TmM_Wyzz1MIYdr26JJYXF-GelU6fvv_GyVS8GgnaypPj6aWCI0L7K8NjTp7KsOSpbXAmOjPjpCtF0fPL6q2F2EpjHW6HQTDrCD9LnbIHi_D0OVVljVcBgQ9_k78b5P_FsKgqDs8qbhkVQmgqIoN2U=)
12. [indeed.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHns6NmxJd9M6TkYHDWVsos_rEH0twrXXJGiDYRSWm1yDfBTKKbOl89a6_snlWBHx4_uFJUZV-6BOIpl_KFHTYXXGgm7XHcNZI_vphc9Sdgl8pLBxCLgaRJwCxLlkMDBwI814zv3J89Lot2Bsw2KGpwY0lv)
13. [indeed.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGd7JlqzJ-nWqBcYnAA336ZTJNBxiTHR7b2xV67CsE_h54YpG4HJISDlUd7CUHZAvgFz0zMJ8cXjov0S0UmyY1d11ddegpDWr8mYg2uaPr3Y4mLW0NG64oj7cVWfrAI5WUGZwAwoHsVsT-nfA==)
14. [innovationsoftheworld.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFinuvJYrMyV4UPq5X1Wshzf_XMIcqvMK6Td4KotxlXtt0Oy7hl9ntm1Ufe72glCQtRwZJtOit7NkvvNDD-Hg-je9tEbo4vqXcKjd9R9C0eLh1zMpSNBuq71mJHSPAqU9g7cSzis4pdD95ANw==)
15. [prospeo.io](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFX_DiV4PPmRCrz44S-vwADRnEs6dYN27toURASflcmtMYMBiQxr1UIBb13yFn9bOd4dB9XxCtut9GS_A0rrBXCBZMsAT5Wt4LdakDAZ1jJiMACSOpepC895-FCuR-9XuTmmR3udg==)
16. [medium.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHFLXMrq5b_hevwys0LbPIUnArQ6NkcOjLSpT7kytbTSNw-5tYS5-l-bcvn5oVHV_11UyDGsp6ZsGTuWkH6eHF2_CPhofEp46T82qk6AOBaNW9X8ZmH8UXwtVU997q1ycM1zJFsttcE93SX8_XjLJ9Iia2VD-PLnv6ZvMATxtz6hh5x3tXlwvr6_XXMohrf325Qx4WWDFmNCIsDIZjZKCYoqK6RzZl1KOnH2nc=)
17. [substack.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFUlnDxzbtHhtDn4QM7BHOpXnmcOwiQ6vCjV2sti1XwP0PfF6WH4qd9jNG6c-M7zkzqyeLY4cYI-N7q4NUodpyl9dOdJ4TYwGnslrwZBYdLKdFXVxV0KdoyoW1G1DDOPSOlNwuY2JnKWvEWZ2eaJ98Hznedt4XPCfXi)
18. [prospeo.io](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQErVPmlDncePA2uXoISgLt0ikKpmlfqBw-U1To8l8oICcQNwz4rd9END7ywv1ICAYESZWN-MZzacxBcqilsvlRgqz_pJKp_1ULcF38MPlVpHN1XrA-qA_3JqU_5R7W8rfrD-VRWPsZbiIr727ece9Ge)
19. [medium.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFY3WcSsBdyYW-HpATE5MBHBSdIkWZ2Eh_WlJQRghQP6kDBUBaRFpdbSk4LPldJiOE2i_abxdnFIZaEHOdcwA5lO6BPX5B5535wf0UkecxFfOaQIuUBlrcVSNiLfzmJDvAHxasKciG_iLtcehwqIyM=)
20. [siliconangle.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHtUwucWB-lV9cjI7x6GfkbMOb3AsmR6gbZ1my1Y7qYz1DmuGZ7QwTft5doaj7Ibu-3Ft7KNTwMzG4xd91njAOU02tJVLIZGpRMVQRXlbXqyr18h9hsSsHwWwtktFy-fN5qtkeAWNuGtng7cTw3x7_E15AyQ3Uhpce02Jm2r95dUsKJHns_kY__5BgANaxLT7i24-PXdo_jdSo=)
21. [paragraph.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEfCS_YvIeDQO0FrT23HaU9RRhoK2B03iINAVqV5VSJIRnl1Mp8sLaeTAPABOD8f0jvLKhdb4hnqnWX3G3Ru2TghgFfcru4vteq98MPTDD4vB86ry1rdqKi4rzElSZwRyc2d_Is0yza-KZuMYKnfR7n4GfV8hKbCPQL86Q9hSd38bRtdU89)
22. [hivemapper.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGYcYRa0eselZa4q0D-342TvjljkBprkeYnZfDaLU0hx9KLyFr-XNVW3U1qGEfgVuV-N3s0cl6bvf2YZBcK4lcfGzqe4-2QpmzLlPqGzF5XsuveatSRc1j9fNZDixoqFEMP15N6Ign3drMHd3c5fYyi9pKn5JJW-CqNJm1109Z8KGJKEnS-S_NTmV8M4MlquQrCVoc=)
23. [hivemapper.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEtB7lh3woIKxSWe8H9aShPHJToSxQHNclED7GNPxtYpYe2qBOTUHMUHqzISprrzHOegjLzFbLPA6df0QidhpHofoysgR_NWq4JPguZXcSCztbRtCEbV4RhVSmehvBRCnSUPLyF1O9tpg_yuCJBf5FHD0nlbBFluTin39ilfWYhEO9GBxaZCI98mtv8O3UpU80SB5hpM_4x6WDsVWEH)
24. [trueimagedronesolutions.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFADsPa1v_Kwiz2xea6gNTbVy2uILJVmaDNJTLN6v9KdsO4ONy7neALAj9ETxcXB8-ZsZEVfdBChprjOSuqWPEo2HSLH0bXWTSQEtDJGIjsG2V8D9Ddri2NpBWW2lOggVjZ3FoqYTU=)
25. [cushmanwakefield.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHNC4bI9qxeKnDB1SeDzP6iLtpSVaynNC5OGm127NvQu7HJs_4pwjCu9mcP-wpYdbwMtn1u3mSAEXZK2nrfjbsXSkshGC4Hl5G3zIDs61eqCFWEo4OcnXlzQ3c33U9ncb1FmG3ldfvw0KJXiW2Q6CWjNPWwGEEyBCzDIEvScXKby3qj8s-767b-N9cbztJcxFVz5EABHokTnrYvpZw=)
26. [meetup.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF-Ms438LIrMjpuAhafjV2Bb__M2-0FElvA_z6vfZLnN6NhgNKcPs-ym6hyWuY5gpAO8qAvX7V0od1AYYan3nvMtm9Mo4UUri4mjfTwbORVfWChyse9S53VWwEQ_Ds=)
27. [cbs8.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHJmrsEHn1lLVxB0t76iQwlMexkgKZyJrqsSY7OkxmmStBIGX0a2f6QIWEuq7VGynG3ZFSyO7Bzu8UVGH03YsVxrYVkN21lrIeDDcNtmclyOM5a3fsjYrRkJ0naJDbZB3zu6vgma_ZgkEyi1IXJ4opMWhAgIZpCMxrxZsP40-ZHMQ723ZVVbxjdmautDUq7-qoj7mI4Q_SvisaOZtjyluA=)
28. [foodlogistics.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHAtKYep5BkkN8Loesrjo3JZogZDac4Ac3mwF9XeIHHLhDAqmEUR-FouYezqPsOoLFk1GE2v-oBr9fWGJM-StWL1W0IqytUEFX09B7pCEJYTt5Ttlcp8EIuYj_4kCXpzTnnRV70sBvyShAZQCSh2HEb2ieerJmhxGfCZZAaq4zGHgpdOA==)
29. [contrary.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHvWaII7V1lrs24IUI4PfZ-jAtIKpk6fmNzSUTXsSWGQAtXTX5Wy8AndLFn4oO4rQ3p_8v-57cUA-lYTgH_1_fJUnEccx5ZjQgOxUkcn_tDSbZX9Mj2PbYpW6nhn4JTrLF0NhXxQw==)
30. [timesofsandiego.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHqMPKl-vW-swGf01X7DSboSUBc1aTag1kZFzgAqw-BMqrM9Hfn33THAB0PzjK7EzCUtQ57_2FNDSkp5fQMxGcBgmH5fSZeBIORg08GntX-AiXkmuML-GH-mt1SLSDgNNHyUlB8fQrKISD0pYvDONbOWBNvSRgbpW-EtjYARuzvRnc8Xxu7Z_f4SNnjtFMADQgGgDrQTajGvHV4Au9uIjTZLkYWMa4NH7O9)