# Blueprint Autonomous Organization Guide

> **Source of truth:** [Blueprint Knowledge](https://www.notion.so/16d80154161d80db869bcfba4fe70be3) — Autonomous Organization Guide
> This file is the repo-authoritative mirror of Blueprint Knowledge for org structure and agent roles.
> All Blueprint agent roles and developers consuming this file should treat Notion as the canonical
> operational surface and this file as the definitional source of truth within the repo.
> When changes are made to Notion Knowledge, the Notion Manager agent is responsible for pushing
> mirror updates to this file. When changes are made here, they should be reconciled back.

## Overview

Blueprint runs as an autonomous organization powered by [Paperclip](https://github.com/paperclipai/paperclip). Every operational role — from buyer intake to market research to conversion optimization — is modeled as a persistent agent with defined responsibilities, triggers, policy guardrails, and a graduation path toward full autonomy.

This guide covers the full org so that any agent or human working in any Blueprint repo understands who does what, how work flows, and where the boundaries are.

On the current trusted host, Paperclip uses local subscription-backed auth only. Claude is the default executive/review lane and Codex is the default implementation lane, but reconcile automatically fails a workspace over to the other local adapter when the default adapter is unhealthy or rate-limited.

**Key principles:**
- Capture-first, world-model-product-first positioning (see `PLATFORM_CONTEXT.md`)
- Progressive autonomy — agents start supervised and graduate based on track record
- Paperclip is the execution and ownership record; Notion is the workspace, knowledge, review, and operator-visibility surface; repo files are the definitional source of truth
- Autoresearch-pattern loops drive continuous optimization (adapted from [Karpathy's autoresearch](https://github.com/karpathy/autoresearch))
- Growth should stay anchored to one narrow commercial wedge at a time. The current priority wedge is **Exact-Site Hosted Review**: one real site, one workflow lane, one package-plus-hosted-review path, with explicit automatic policy enforcement on pricing, policy, rights, and irreversible commitments.
- During the current wedge, the active org is judged through three loops only: product/proof, demand/sales, and reliability. Any routine that does not move targets, contacts, approvals, sends, replies, calls, hosted-review starts, capture asks, or blockers is commentary.
- Website intake follows the **structured intake first, calendar second** contract in `ops/paperclip/programs/structured-intake-calendar-second-contract.md`: forms collect role-specific routing truth first, and calendar booking is only an accelerator or required human checkpoint when the structured record justifies it.
- Founder scope stays narrow: strategic repo truth, policy updates, and architecture changes. Routine launch, commercial, and ops execution should run autonomously from written policy and evidence, not approval packets.
- Named operator lanes in the current model: Growth Lead for channel/referral/source posture, Ops Lead for intake/threshold/trust-kit readiness, revenue-ops-pricing-agent for standard quote-band enforcement, and rights-provenance-agent for rights/privacy/commercialization evidence handling.

## Phase 0 Canonical Contracts

The current cross-repo autonomy program uses these repo-grounded contracts as canonical definitions:

- [Autonomous Org Cross-Repo Operating Graph Contract](./docs/autonomous-org-cross-repo-operating-graph-2026-04-20.md)
- [Autonomous Loop Evidence Checklist](./docs/autonomous-loop-evidence-checklist-2026-05-03.md)
- [Founder Inbox Contract](./docs/founder-inbox-contract-2026-04-20.md)
- [Company Metrics Contract](./docs/company-metrics-contract-2026-04-20.md)

These contracts establish that:

- `Blueprint-WebApp` is the canonical control plane for execution state, founder inbox state, and company metrics
- `blocked`, `awaiting_external_confirmation`, `awaiting_human_decision`, `ready_to_execute`, and `completed` have one shared meaning across repos
- `done`, `blocked`, and `awaiting_human_decision` closeouts must carry the shared evidence checklist fields before a loop can claim closure
- true founder-facing interrupts route through the universal founder inbox instead of ad hoc escalation packets
- company scoreboards must derive from first-party evidence projected into WebApp rather than lane-local narrative summaries

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
| **Ops** | Ops Lead | 13 agents | Product operations lifecycle, buyer solutions, technical enablement, rights/trust, public-space candidate review, enterprise review, capturer success, catalog, and buyer success |
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

**Policy guardrails:** Strategy and budget decisions are governed by written repo policy and fail-closed execution, not per-run founder approval.

**Graduation:** N/A — executive role, always reports to human.

**Instructions:** `ops/paperclip/blueprint-company/agents/blueprint-ceo/AGENTS.md`
**Paperclip config:** `ops/paperclip/blueprint-company/.paperclip.yaml`

---

#### Chief of Staff (`blueprint-chief-of-staff`)

| Field | Value |
|-------|-------|
| **Department** | Executive |
| **Reports to** | CEO |
| **Model** | Hermes (DeepSeek V4 Flash primary via official DeepSeek endpoint, DeepSeek V4 Pro discounted fallback before Codex fallback) |
| **Status** | Live in Paperclip package |

**Purpose:** Runs the continuous managerial loop. Watches issue state, routine health, queue changes, and agent activity; decides what finished, what stalled, and what needs a next action; routes or closes work in Paperclip; and turns missing policy or missing evidence into explicit blockers instead of vague escalation.

**Triggers:**
- `*/5 * * * *` — Continuous manager loop
- Event wakeups from issue create/update, routine activity, queue intake, and agent failures via the Blueprint automation plugin

**Inputs:** `blueprint-manager-state`, Blueprint automation recent events, active issues, routine health, queue sync state, and repo/plugin evidence.

**Outputs:**
- Concrete Paperclip issue creation/update/closure
- Delegations and blocker follow-up issues
- Cross-agent follow-through decisions
- Founder decision packets routed through the canonical founder inbox contract with one recommendation, one exact ask, one deadline, one blocker id, and one follow-through owner
- Slack-visible manager wakeups and task-routing activity
- Human-reply watcher ownership for blocker packets, including correlation, reply classification, and delegated execution handoff

**Policy guardrails:** Strategy, budget, rights/privacy, commercialization commitments, legal, policy, and other irreversible high-risk decisions. Founder-facing cases must use the canonical founder inbox contract rather than repo-local packet variants.

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

**Policy guardrails:** Architecture decisions affecting platform contracts.

**Graduation:** N/A — executive role.

**Instructions:** `ops/paperclip/blueprint-company/agents/blueprint-cto/AGENTS.md`
**Paperclip config:** `ops/paperclip/blueprint-company/.paperclip.yaml`

---

#### Investor Relations Agent (`investor-relations-agent`)

| Field | Value |
|-------|-------|
| **Department** | Executive |
| **Reports to** | Chief of Staff |
| **Model** | Hermes (DeepSeek V4 Flash primary via official DeepSeek endpoint, DeepSeek V4 Pro discounted fallback before Codex fallback) |
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

**Policy guardrails:** Any live send/publish, fundraising language, projections, runway claims, or board-sensitive disclosures.

**Instructions:** `ops/paperclip/blueprint-company/agents/investor-relations-agent/AGENTS.md`
**Program:** `ops/paperclip/programs/investor-relations-agent-program.md`

---

#### Notion Manager Agent (`notion-manager-agent`)

| Field | Value |
|-------|-------|
| **Department** | Executive |
| **Reports to** | Chief of Staff |
| **Model** | Hermes (DeepSeek V4 Flash primary via official DeepSeek endpoint, DeepSeek V4 Pro discounted fallback before Codex fallback) |
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

**Policy guardrails:** Ambiguous page identity, contested ownership, rights/privacy-sensitive content, arbitrary workspace cleanup outside Blueprint-managed Hub surfaces, or any move/archive decision without strong evidence.

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

**Policy guardrails:** Ambiguous page identity, unsafe move/archive decisions, and rights/privacy-sensitive cleanup.

**Instructions:** `ops/paperclip/blueprint-company/agents/notion-reconciler/AGENTS.md`

---

#### Revenue Ops & Pricing Agent (`revenue-ops-pricing-agent`)

| Field | Value |
|-------|-------|
| **Department** | Executive |
| **Reports to** | Chief of Staff |
| **Model** | Hermes (DeepSeek V4 Flash primary via official DeepSeek endpoint, DeepSeek V4 Pro discounted fallback before Codex fallback) |
| **Status** | New |

**Purpose:** Maintains Blueprint's pricing and commercial system discipline. Connects buyer demand, site-catalog supply, usage, and delivery-cost signals into draft pricebook updates, package guidance, quote support, and discount guardrails without taking over buyer-thread ownership or making live commercial commitments. The revenue-ops-pricing-agent uses this lane for standard quote decisions inside approved bands.

**Triggers:**
- Event: revenue-ops-pricing-agent, chief-of-staff, buyer-solutions-agent, or growth-lead requests quote or package guidance
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

**Policy guardrails:** Live pricing changes, discounts, terms, contract commitments, revenue-share logic, and any non-standard commercial offer.

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
| **Model** | Hermes (DeepSeek V4 Flash primary via official DeepSeek endpoint, DeepSeek V4 Pro discounted fallback before Codex fallback) |
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

**Policy guardrails:** Ops Lead is itself the routine human operator lane for launch-readiness ops. Founder escalation is only for spend, policy, rights/privacy, legal, or other irreversible exceptions.

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

**Policy guardrails:**
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
| **Reports to** | Ops Lead |
| **Model** | Claude |
| **Status** | New |

**Purpose:** Reviews pipeline outputs for quality, completeness, and privacy compliance. Flags recapture needs. Drafts payout recommendations.

**Triggers:**
- Webhook: Pipeline completion (Pub/Sub message or Firestore status change)
- `0 9 * * *` — Daily scan for stalled captures
- Event: Ops Lead assignment

**Inputs:**
- Pipeline artifacts: `qualification_summary.json`, `capture_quality_summary.json`, `rights_and_compliance_summary.json`, `gemini_capture_fidelity_review.json`
- Raw capture metadata from Firestore
- QA thresholds (Knowledge DB)

**Outputs:**
- QA pass/fail verdict with evidence citations
- Recapture request → routed to `field-ops-agent`
- Payout recommendation draft → human approval gate
- Quality trends report → Growth Lead (weekly)

**Policy guardrails:**
- All payout approvals (permanent — never graduates)
- Recapture decisions (Phase 1 only)
- QA pass/fail on borderline captures (Phase 1-2)

**External needs:** GCS read access (pipeline artifacts), Firestore read/write, Notion API.

**Graduation path:**
| Phase | Behavior | Criteria to advance |
|-------|----------|-------------------|
| 1 | Review + flag only; human makes all QA decisions | 2 weeks, QA assessment matches human >90% |
| 2 | Auto-pass captures above quality threshold; human reviews borderline + fails | 1 month, no false passes |
| 3 | Auto-pass + auto-fail clear cases; human reviews borderline. Payouts always human. | Founder sign-off |

**Skill file:** `ops/paperclip/skills/capture-qa-agent.md`

---

#### Scheduling & Field Ops Agent (`field-ops-agent`)

| Field | Value |
|-------|-------|
| **Department** | Ops |
| **Reports to** | Ops Lead |
| **Model** | Claude |
| **Status** | New |

**Purpose:** Coordinates capture scheduling — capturer assignment, standard communications, reminder sequencing, simple reschedules, and site-access tracking. Executes first-capture activation only inside Ops Lead-approved thresholds.

**Triggers:**
- Event: Intake agent qualifies a request needing capture
- Event: Capture QA agent requests recapture
- `0 7 * * 1-5` — Daily calendar review (7am ET)

**Inputs:**
- `capture_jobs`
- Capturer roster fields from Firestore (`users`)
- Site metadata (location, rights/access requirements)
- Bookings and blueprint contacts
- Google Calendar

**Outputs:**
- Capturer-to-site assignment recommendations with score breakdowns
- Standard confirmation/reminder sends when policy allows
- Simple same-day reschedule execution
- Site-access first outreach and permission-state tracking
- Travel/logistics notes

**Policy guardrails:**
- Complex reschedules and cancellations
- Custom capturer communications
- Site-access negotiation, denials, and conditional terms
- Access/permission issues requiring judgment

**External needs:** Google Calendar API, Firestore, Notion API. Travel/calendar optimization beyond heuristics still requires stronger external dispatch data.

**Graduation path:**
| Phase | Behavior | Criteria to advance |
|-------|----------|-------------------|
| 1 | Proposes schedule + match; human confirms and sends | 2 weeks, proposals accepted >85% |
| 2 | Auto-assigns heuristically, auto-sends standard reminders/comms, auto-executes same-day simple reschedules | Shipped in WebApp |
| 3 | Expand beyond heuristic dispatch only with stronger external availability/travel data and written thresholds | Ops Lead sign-off |

**Skill file:** `ops/paperclip/skills/field-ops-agent.md`

---

#### Finance & Support Agent (`finance-support-agent`)

| Field | Value |
|-------|-------|
| **Department** | Ops |
| **Reports to** | Ops Lead |
| **Model** | Claude |
| **Status** | New |

**Purpose:** Monitors Stripe health, triages payout issues, handles support inbox, drafts responses, and maintains explicit human review state for finance/dispute work.

**Triggers:**
- Webhook: Stripe events (payout failures, disputes, account updates)
- Webhook: Support inbox (email forward or form submission)
- `0 10 * * 1-5` — Daily ledger reconciliation check

**Inputs:**
- Stripe events and dashboard data
- Support tickets (email/form submissions)
- Firestore payout records
- Buyer/capturer account data

**Outputs:**
- Payout issue triage + recommended action
- Support response drafts and low-risk support auto-replies where policy allows
- `finance_review` state on payout/dispute items
- Ledger discrepancy reports
- Stripe health summary → Ops Lead

**Policy guardrails:**
- All financial actions
- Dispute responses, refunds, and compliance exceptions
- Any money movement or legal/privacy judgment

**External needs:** Stripe API (read + limited write), email/support platform API, Firestore, Notion API.

**Graduation path:**
| Phase | Behavior | Criteria to advance |
|-------|----------|-------------------|
| 1 | Monitors + drafts only; human approves everything | 2 weeks, draft quality validated |
| 2 | Auto-send low-risk support replies; queue/state automation for finance; money actions remain human-only | Shipped in WebApp |
| 3 | Support mostly autonomous; payouts/disputes/refunds still human-only | Founder sign-off |

**Skill file:** `ops/paperclip/skills/finance-support-agent.md`

---

#### Beta Launch Commander (`beta-launch-commander`)

| Field | Value |
|-------|-------|
| **Department** | Engineering (reports to CTO) |
| **Reports to** | CTO |
| **Model** | Claude |
| **Status** | New |

**Purpose:** Cross-repo release orchestrator. Runs preflight checks across all three repos, produces go/no-go recommendations with evidence, and coordinates freeze/rollback/incident response during beta releases.

**Why this is an agent (not just scripts):** Launch involves conflicting signals across tests, deploy health, smoke results, and incidents. Software runs the checks; this agent reads the results, decides go/no-go, and escalates when evidence is ambiguous.

**What stays as code:** Preflight scripts, smoke tests, health checks, rollback commands, release gates, CI pipelines.

**Triggers:**
- Release candidate tagged in any repo
- CI failure on main in any repo
- Smoke test failure post-deploy
- `0 9 * * 1-5` — Morning release health check (weekdays 9am ET)

**Inputs:**
- CI/test results across all three repos
- `alpha_readiness.sh` (BlueprintCapture)
- `run_external_alpha_launch_gate.py` (BlueprintCapturePipeline)
- `npm run check && npm run build` (Blueprint-WebApp)
- Open blocker issues in Paperclip

**Outputs:**
- GO / CONDITIONAL GO / HOLD recommendation with evidence
- Blocker issues routed to engineering agents
- Post-deploy monitoring reports
- Rollback documentation when needed

**Policy guardrails:**
- Release freeze directives
- Risk acceptance on compliance flags
- Go/no-go when evidence is genuinely ambiguous

**Graduation path:**
| Phase | Behavior | Criteria to advance |
|-------|----------|-------------------|
| 1 | Runs preflight, produces recommendations; human approves all releases | 3 successful release cycles |
| 2 | Auto-approves GO when all checks pass cleanly; human reviews CONDITIONAL GO and HOLD | 5 clean releases in a row |
| 3 | Manages routine releases autonomously; human reviews only HOLD and rollback decisions | Founder sign-off |

---

#### Buyer Solutions Agent (`buyer-solutions-agent`)

| Field | Value |
|-------|-------|
| **Department** | Ops |
| **Reports to** | Ops Lead |
| **Model** | Hermes (DeepSeek V4 Flash primary via official DeepSeek endpoint, DeepSeek V4 Pro discounted fallback before Codex fallback) |
| **Status** | New |

**Purpose:** Single commercial journey owner from qualified inbound to proof-ready commercial motion. Interprets messy buyer requests, translates them into concrete package requirements, tracks through capture matching and packaging, and delivers proof for buyer evaluation without letting pricing or technical specialists fragment ownership.

**Why this is an agent (not just CRM automation):** Buyer requests are natural language from diverse robot teams with unclear site details, proof expectations, and timelines. Someone has to interpret, prioritize, and route — that is judgment work, not form processing.

**What stays as code:** Form validation, CRM/inbound storage, status transitions, proof-pack generation, hosted-review setup, Firestore state management.

**Triggers:**
- Intake agent routes a qualified buyer request
- Pipeline attachment sync produces artifacts for an active buyer
- Buyer responds to outreach
- `15 10 * * 1-5` — Weekday buyer pipeline review

**Inputs:**
- Firestore inbound requests
- `structured_intake` and `ops_automation.recommended_path` fields from the website intake funnel
- Pipeline qualification state, opportunity state, derived assets
- WebApp admin leads view
- Buyer communications (email, form, Slack)

**Outputs:**
- Buyer journey issues in Paperclip (one per qualified request)
- Parsed requirements and feasibility assessments
- Capture job requests (handed to ops-lead when no match exists)
- Buyer-facing proof summaries
- Journey stage transitions and outcome documentation

**Policy guardrails:**
- Standard quotes and package approvals route to the revenue-ops-pricing-agent
- Non-standard pricing, terms, or contract negotiation route to founder
- Promises about capabilities Blueprint does not yet have
- Any external buyer-facing communication that would create a non-standard commitment
- Calendly links do not qualify a buyer by themselves; qualified handoff requires structured site/workflow/buyer context.

**Graduation path:**
| Phase | Behavior | Criteria to advance |
|-------|----------|-------------------|
| 1 | Tracks and recommends; human handles all buyer communication | 5 buyer journeys tracked end-to-end |
| 2 | Sends routine status updates and proof delivery autonomously; revenue-ops-pricing-agent handles standard commercial conversations | 3 successful proof deliveries |
| 3 | Manages routine buyer journeys autonomously; human reviews only non-standard commercial and capability-gap conversations | Founder sign-off |

---

#### Solutions Engineering Agent (`solutions-engineering-agent`)

| Field | Value |
|-------|-------|
| **Department** | Ops |
| **Reports to** | Ops Lead |
| **Model** | Hermes (DeepSeek V4 Flash primary via official DeepSeek endpoint, DeepSeek V4 Pro discounted fallback before Codex fallback) |
| **Status** | New |

**Purpose:** Owns technical buyer enablement inside the buyer-solutions thread from proof-ready to implementation-ready. Converts buyer stack questions, hosted-session requirements, export expectations, and deployment readiness into explicit evaluation plans and integration checklists grounded in the product and artifacts that already exist.

**Why this is an agent (not just product docs):** Technical buyers do not only need a proof pack. They need someone to connect a real site package and hosted review path to their stack, eval workflow, and implementation plan. That requires judgment across buyer context, current product behavior, and artifact reality.

**What stays as code:** Hosted-session product surfaces, package manifests, export paths, admin views, entitlement logic, runtime contracts, and deployment-readiness artifacts.

**Triggers:**
- buyer-solutions-agent hands off an active buyer needing technical evaluation or implementation guidance
- Buyer asks integration, deployment, export, or hosted-session architecture questions
- `30 11 * * 1-5` — Weekday active delivery review

**Inputs:**
- Buyer journey issues
- WebApp hosted-session and site-world surfaces
- Pipeline package and deployment-readiness artifacts
- Buyer stack constraints and workflow questions
- `ops/paperclip/programs/solutions-engineering-agent-program.md`

**Outputs:**
- Technical evaluation plans and integration checklists
- Implementation-readiness summaries
- Product-gap or artifact-gap escalations to engineering or ops
- Clean technical handoffs into buyer-success-agent when delivery is ready

**Policy guardrails:** Capability guarantees, deployment guarantees, custom engineering promises, pricing implications, and any external technical commitment beyond current product truth.

**Instructions:** `ops/paperclip/blueprint-company/agents/solutions-engineering-agent/AGENTS.md`
**Program:** `ops/paperclip/programs/solutions-engineering-agent-program.md`

---

#### Rights & Provenance Agent (`rights-provenance-agent`)

| Field | Value |
|-------|-------|
| **Department** | Ops |
| **Reports to** | Ops Lead |
| **Model** | Claude |
| **Status** | New |

**Purpose:** Trust and compliance gatekeeper. Reviews consent, rights, privacy processing, provenance chain, and commercialization scope before any capture or package is released to buyers. Default posture: fail-closed.

**Why this is an agent (not just boolean checks):** Consent scope, commercialization rights, and privacy sensitivity have ambiguous edge cases. A boolean check catches 80%; this agent handles the 20% that needs interpretation — high-sensitivity sites, cross-jurisdiction issues, scope expansion requests.

**What stays as code:** Required metadata fields, fail-closed permission defaults, redaction pipelines, release blockers, audit logs, privacy processing (SAM3, VIP, DeepPrivacy2, Depth Anything).

**Triggers:**
- Buyer-solutions-agent or capture-qa-agent requests rights clearance
- Pipeline produces `rights_and_compliance_summary.json`
- Buyer requests expanded commercialization scope
- `0 11 * * 1-5` — Morning rights review

**Inputs:**
- Pipeline: `rights_and_compliance_summary.json`, `provenance_summary.json`
- Privacy processing output artifacts
- Capture context: `capture_context.json`, consent metadata
- Firestore: rights_status, capture_policy_tier

**Outputs:**
- CLEARED / BLOCKED / NEEDS-REVIEW decisions with evidence citations
- Specific unblock actions for BLOCKED items
- Designated-human-reviewer escalation summaries for NEEDS-REVIEW cases
- Rights clearance attached to Paperclip issues

**Policy guardrails:**
- Novel consent situations without precedent
- Regulatory gray areas
- Expanding commercialization scope beyond original grant
- Any case where the right answer is genuinely unclear
- rights-provenance-agent handles sensitive rights/privacy judgments from written policy and evidence, and policy-changing exceptions require a repo policy update rather than a per-run approval gate
- All rights decisions remain permanently policy-blocked until repo truth and evidence support the action.

**Graduation path:**
| Phase | Behavior | Criteria to advance |
|-------|----------|-------------------|
| 1 | Reviews and recommends; human approves all clearance decisions | 10 reviews with consistent quality |
| 2 | Auto-clears routine cases matching established patterns; human reviews edge cases and high-sensitivity sites | 20 reviews, zero false clearances |
| 3 | Semi-autonomous for routine clearance; all novel, high-sensitivity, and scope-expansion cases remain policy-blocked permanently | Founder sign-off |

---

#### Security & Procurement Agent (`security-procurement-agent`)

| Field | Value |
|-------|-------|
| **Department** | Ops |
| **Reports to** | Ops Lead |
| **Model** | Hermes (DeepSeek V4 Flash primary via official DeepSeek endpoint, DeepSeek V4 Pro discounted fallback before Codex fallback) |
| **Status** | New |

**Purpose:** Drafts Blueprint's buyer-facing security, architecture, data-handling, and procurement responses from real system evidence. Keeps enterprise security review and procurement work moving without overstating legal, compliance, or certification posture.

**Why this is an agent (not just a FAQ page):** Enterprise buyers ask detailed questions about hosted-session isolation, access control, data retention, encryption, provenance, and operational ownership. Those questions require evidence collection and careful translation, not generic marketing copy.

**What stays as code:** Runtime auth, access control, field encryption, data retention behavior, deployment configuration, and rights/provenance evidence generation.

**Triggers:**
- buyer-solutions-agent or solutions-engineering-agent flags a security or procurement review
- Buyer sends a DDQ, architecture review request, or procurement checklist
- `30 12 * * 1-5` — Active security/procurement review sweep

**Inputs:**
- Deployment and runtime docs
- Hosted-session auth and access-control behavior
- Data retention and field-encryption posture
- Rights/provenance and privacy-processing evidence when relevant
- `ops/paperclip/programs/security-procurement-agent-program.md`

**Outputs:**
- DDQ and security packet drafts
- Procurement blocker summaries
- Missing-evidence escalations to engineering, ops, or rights owners
- Explicit "not currently supported" answers where evidence does not exist

**Policy guardrails:** Legal language, certification or pentest claims, privacy/risk interpretation, contract commitments, and any answer that outruns existing evidence.

**Instructions:** `ops/paperclip/blueprint-company/agents/security-procurement-agent/AGENTS.md`
**Program:** `ops/paperclip/programs/security-procurement-agent-program.md`

---

#### Capturer Success Agent (`capturer-success-agent`)

| Field | Value |
|-------|-------|
| **Department** | Ops |
| **Reports to** | Ops Lead |
| **Model** | Hermes (DeepSeek V4 Flash primary via official DeepSeek endpoint, DeepSeek V4 Pro discounted fallback before Codex fallback) |
| **Status** | New |

**Purpose:** Owns capturer activation and retention. Guides approved capturers through first capture success, translates QA feedback into actionable recapture instructions, monitors activity patterns, and identifies systemic platform issues from individual capturer struggles.

**Why this is an agent (not just onboarding automation):** Capturers fail in diverse ways — device issues, technique gaps, site access confusion, motivation drops. Pattern recognition across failure modes + personalized next steps = judgment work. And supply-side churn kills the entire business.

**What stays as code:** Onboarding reminders, upload diagnostics, capture quality scoring, activation metrics, capturer level/achievement tracking, push notifications.

**Triggers:**
- Intake agent approves a capturer application
- First capture uploaded (monitor QA closely)
- Capture QA result (FAIL/BORDERLINE) for any capturer
- Capturer inactive >7 days
- `0 9 * * 1-5` — Morning capturer health check
- `0 14 * * 1-5` — Afternoon follow-up

**Inputs:**
- Firestore: capture_submissions, capturer profiles, upload history
- Pipeline QA: qualification_summary, recapture_requirements, payout_recommendation
- App analytics (install, first launch, first capture attempt)
- Paperclip capturer lifecycle issues

**Outputs:**
- Capturer lifecycle issues in Paperclip
- Device-specific onboarding guidance
- Recapture instructions translated from QA feedback
- Activity pattern reports and intervention recommendations
- Systemic issue escalations (when multiple capturers hit the same wall)

**Policy guardrails:**
- Capturer deactivation
- Payout adjustments
- Platform-level UX/process changes based on pattern analysis

**Graduation path:**
| Phase | Behavior | Criteria to advance |
|-------|----------|-------------------|
| 1 | Tracks lifecycle and drafts guidance; human sends all communications | 10 capturers tracked through activation |
| 2 | Sends routine onboarding and recapture guidance autonomously; human handles deactivation and escalations | First capture success rate >60% for tracked cohort |
| 3 | Manages capturer lifecycle autonomously; human reviews deactivation, payouts, and systemic platform issues | Founder sign-off |

**Skill file:** `ops/paperclip/skills/capturer-success-agent.md`

---

#### Public Space Review Agent (`public-space-review-agent`)

| Field | Value |
|-------|-------|
| **Department** | Ops |
| **Reports to** | Ops Lead |
| **Model** | Hermes (DeepSeek V4 Flash primary via official DeepSeek endpoint, DeepSeek V4 Pro discounted fallback before Codex fallback) |
| **Status** | New |

**Purpose:** Reviews batches of public-facing city-launch candidates and promotes evidence-backed common-access locations into approved capture targets without treating them as rights-cleared, payable, or derived-world-model-ready.

**Why this is an agent (not just a script):** The deterministic reviewer should do the stable checks, but the org still needs an accountable owner to inspect batch outcomes, explain incomplete evidence, hand off rights/privacy questions after capture, and keep city location supply moving without waiting for founder review.

**What stays as code:** The promotion/rejection rules, Firestore writes, candidate status updates, and prospect creation live in `server/utils/cityLaunchCandidateReview.ts` and `scripts/city-launch/review-public-candidates.ts`.

**Triggers:**
- New `cityLaunchCandidateSignals` batch from agent research, app-open discovery, signup scan, or manual refresh
- City launch issue asks for public-facing location supply review
- `20 9 * * 1-5` — Weekday public candidate review sweep

**Inputs:**
- Firestore `cityLaunchCandidateSignals`
- Public candidate ledgers in `ops/paperclip/playbooks/`
- City launch activation state
- `PLATFORM_CONTEXT.md` and `WORLD_MODEL_STRATEGY_CONTEXT.md`

**Outputs:**
- Promoted `cityLaunchProspects` records for evidence-backed public/common-access candidates
- Candidate records marked `promoted`, `in_review`, or `rejected` with reasons
- Paperclip issue comments with batch counts and remaining review gaps
- Handoffs to `field-ops-agent` or `rights-provenance-agent` after promotion/capture when needed

**Policy guardrails:** This role cannot clear derived world-model rights, authorize payouts, approve private/staff/back-of-house capture, promote warehouses/facilities through the public-space lane, or make public claims about partner/operator approval.

**Instructions:** `ops/paperclip/blueprint-company/agents/public-space-review-agent/AGENTS.md`

---

### Growth Department

---

#### Growth Lead (`growth-lead`)

| Field | Value |
|-------|-------|
| **Department** | Growth |
| **Reports to** | Chief of Staff |
| **Model** | Hermes (DeepSeek V4 Flash primary via official DeepSeek endpoint, DeepSeek V4 Pro discounted fallback before Codex fallback) |
| **Status** | New |

**Purpose:** Coordinates a smaller active growth core: analytics, conversion, market intelligence, demand intelligence, and one city-demand loop. Sets experiment priorities using ICE scoring. Owns routine channel posture, referral mechanics, source policy, and city invite posture inside approved guardrails. Everything else in growth stays paused or event-driven unless evidence justifies restart.

**Triggers:**
- `0 9 * * 1-5` — Daily review of overnight analytics + agent reports
- `0 10 * * 1` — Weekly Monday growth review + experiment planning
- Event: Analytics agent anomaly alert

**Inputs:**
- Analytics agent daily/weekly reports
- Conversion Optimizer experiment results
- Market Intel research digests
- Demand Intel research digests
- City Demand city-plan updates
- Notion Work Queue (Growth-tagged items)

**Outputs:**
- Weekly growth summary → CEO + Notion
- Experiment priority queue → Conversion Optimizer
- Research briefs → Market Intelligence and Demand Intelligence agents
- Buyer-city sequencing priorities → City Demand agent
- Exact-Site Hosted Review GTM pilot ledger and audit closeout when the bounded 14-day pilot is active
- Exact-Site Hosted Review buyer-loop report with target count, recipient-backed contacts, founder approval queue, sends, replies, hosted-review starts, qualified calls, next actions, and the 100-touch decision gap
- Explicit pause or restart decisions for non-core growth lanes
- Funnel health dashboard updates → Notion

**Policy guardrails:** Growth Lead is itself the routine human operator lane for channel/referral/source policy. Founder escalation is only for spend envelopes, posture-changing public claims, or policy changes with irreversible external effect.

**External needs:** Notion API, Slack webhook, analytics platform read.

**Graduation path:**
| Phase | Behavior | Criteria to advance |
|-------|----------|-------------------|
| 1 | Reports + recommends priorities; human sets final experiment queue | 2 weeks, recommendations align with founder intent |
| 2 | Auto-prioritizes experiments; human reviews weekly summary | 1 month, no mis-prioritizations |
| 3 | Fully autonomous growth strategy; human intervenes on budget/brand only | Founder sign-off |

**Skill file:** `ops/paperclip/skills/growth-lead.md`

---

#### Supply Intelligence Agent (`supply-intel-agent`)

| Field | Value |
|-------|-------|
| **Department** | Growth |
| **Reports to** | Growth Lead |
| **Model** | Hermes (DeepSeek V4 Flash primary via official DeepSeek endpoint, DeepSeek V4 Pro discounted fallback before Codex fallback) |
| **Status** | New |

**Purpose:** Researches historical and current marketplace supply playbooks with emphasis on boots-on-the-ground growth, launch sequencing, incentive structures, referral loops, trust systems, and channel economics.

**Triggers:**
- `15 7 * * 1-5` — Daily supply scan (7:15am ET)
- `45 7 * * 1` — Weekly marketplace synthesis (Monday 7:45am ET)
- Event: Growth Lead / CEO ad-hoc request

**Inputs:**
- Public web research
- `ops/paperclip/programs/supply-intel-agent-program.md`
- Existing market-intel and growth context

**Outputs:**
- Marketplace playbook briefs
- Competitor teardown docs focused on supply growth
- Channel and referral recommendations
- Inputs for Capturer Growth and City Launch planning

**Policy guardrails:** Compensation policy, legal classification, claims about earnings/work volume, and any external outreach.

**Skill file:** `ops/paperclip/skills/supply-intel-agent.md`
**Steering file:** `ops/paperclip/programs/supply-intel-agent-program.md`

---

#### Capturer Growth Agent (`capturer-growth-agent`)

| Field | Value |
|-------|-------|
| **Department** | Growth |
| **Reports to** | Growth Lead |
| **Model** | Hermes (DeepSeek V4 Flash primary via official DeepSeek endpoint, DeepSeek V4 Pro discounted fallback before Codex fallback) |
| **Status** | New |

**Purpose:** Converts supply-intel research into Blueprint's reusable capturer acquisition playbook. Maintains the generic channel, messaging, referral, and activation system that later city launches should inherit.

**Triggers:**
- `15 9 * * 1` — Weekly playbook update (Monday 9:15am ET)
- `15 9 * * 4` — Midweek refresh (Thursday 9:15am ET)
- Event: Supply Intel or Growth Lead request

**Inputs:**
- Supply Intelligence briefs
- `ops/paperclip/programs/capturer-growth-agent-program.md`
- `ops/paperclip/playbooks/capturer-supply-playbook.md`
- Analytics and ops feedback

**Outputs:**
- Generic capturer supply playbook
- Channel recommendations and internal campaign drafts
- Execution queue for Conversion, Analytics, Intake, Ops, and City Launch

**Policy guardrails:** Spend, compensation changes, public posting, and claims about earnings/work availability.

**Skill file:** `ops/paperclip/skills/capturer-growth-agent.md`
**Steering file:** `ops/paperclip/programs/capturer-growth-agent-program.md`

---

#### City Launch Agent (`city-launch-agent`)

| Field | Value |
|-------|-------|
| **Department** | Growth |
| **Reports to** | Growth Lead |
| **Model** | Hermes (DeepSeek V4 Flash primary via official DeepSeek endpoint, DeepSeek V4 Pro discounted fallback before Codex fallback) |
| **Status** | New |

**Purpose:** Adapts Blueprint's generic capturer growth playbook to specific cities. Starts with Austin, TX and San Francisco, CA. Every city guide must make the split explicit between founder-only work, human operator-owned work, agent-prepared work, and exception-only escalation.

**Triggers:**
- `30 11 * * 1` — Weekly city planning (Monday 11:30am ET)
- `30 11 * * 4` — Midweek city refresh (Thursday 11:30am ET)
- Event: Growth Lead / Ops Lead request

**Inputs:**
- Supply Intelligence output
- Capturer Growth playbook updates
- `ops/paperclip/programs/city-launch-agent-program.md`
- Austin and San Francisco city playbooks

**Outputs:**
- City-specific launch plans
- Weekly city scorecards and readiness status
- Cross-agent action queues for web, analytics, ops, intake, and field readiness

**Policy guardrails:** Final city launch / no-launch decision, new spend envelopes, posture-changing public claims, and local legal/compliance interpretation. Routine invite/referral/rubric/threshold/trust-kit decisions belong to named operators.

**Skill file:** `ops/paperclip/skills/city-launch-agent.md`
**Steering file:** `ops/paperclip/programs/city-launch-agent-program.md`

---

#### Demand Intelligence Agent (`demand-intel-agent`)

| Field | Value |
|-------|-------|
| **Department** | Growth |
| **Reports to** | Growth Lead |
| **Model** | Hermes (DeepSeek V4 Flash primary via official DeepSeek endpoint, DeepSeek V4 Pro discounted fallback before Codex fallback) |
| **Status** | New |

**Purpose:** Researches how robotics infrastructure, autonomy, simulation/data, and world-model businesses generated buyer demand from robot teams and adjacent technical buyers. Focuses on channels, proof requirements, hosted-demo motions, procurement triggers, and city/vertical demand signals.

**Triggers:**
- `30 7 * * 1-5` — Daily robot-team demand scan (7:30am ET)
- `0 8 * * 1` — Weekly demand synthesis (Monday 8am ET)
- Event: Growth Lead / CEO ad-hoc request

**Inputs:**
- Public web research
- `ops/paperclip/programs/demand-intel-agent-program.md`
- Existing market-intel and growth context

**Outputs:**
- Buyer-motion research briefs
- Deterministic demand-intel reporting trail through a Notion Knowledge entry, a Notion Work Queue item, and a stable Paperclip issue comment with proof links plus confidence/lane metadata
- Proof-pack and channel recommendations
- Inputs for Robot Team Growth, Site Operator Partnership, and City Demand planning

**Policy guardrails:** Pricing or contract decisions, external outreach, public traction claims, and any privacy/rights/procurement judgment.

**Skill file:** `ops/paperclip/skills/demand-intel-agent.md`
**Steering file:** `ops/paperclip/programs/demand-intel-agent-program.md`

---

#### Robot Team Growth Agent (`robot-team-growth-agent`)

| Field | Value |
|-------|-------|
| **Department** | Growth |
| **Reports to** | Growth Lead |
| **Model** | Hermes (DeepSeek V4 Flash primary via official DeepSeek endpoint, DeepSeek V4 Pro discounted fallback before Codex fallback) |
| **Status** | New |

**Purpose:** Converts demand-intel research into Blueprint's reusable robot-team demand playbook. Maintains the generic ICP, messaging, proof-pack, hosted-session demo motion, and buyer funnel that later city-demand work should inherit.

**Triggers:**
- `30 9 * * 1` — Weekly playbook update (Monday 9:30am ET)
- `30 9 * * 4` — Midweek refresh (Thursday 9:30am ET)
- Event: Demand Intel or Growth Lead request

**Inputs:**
- Demand Intelligence briefs
- Website intake disposition fields from `structured_intake`
- `ops/paperclip/programs/robot-team-growth-agent-program.md`
- `ops/paperclip/playbooks/robot-team-demand-playbook.md`
- Analytics and ops feedback

**Outputs:**
- Generic robot-team demand playbook
- Proof-pack and hosted-session guidance
- Execution queue for Conversion, Analytics, Intake, Ops, standard commercial handling, and City Demand

**Policy guardrails:** Spend, discounts, pricing, contracts, outreach sends, and claims beyond current product truth.
Calendar booking must stay secondary to structured intake unless the record is high-intent enough for scoped buyer-solutions follow-up.

**Skill file:** `ops/paperclip/skills/robot-team-growth-agent.md`
**Steering file:** `ops/paperclip/programs/robot-team-growth-agent-program.md`

---

#### Site Operator Partnership Agent (`site-operator-partnership-agent`)

| Field | Value |
|-------|-------|
| **Department** | Growth |
| **Reports to** | Growth Lead |
| **Model** | Hermes (DeepSeek V4 Flash primary via official DeepSeek endpoint, DeepSeek V4 Pro discounted fallback before Codex fallback) |
| **Status** | New |

**Purpose:** Maintains Blueprint's optional third lane for site operators. Defines when site-operator demand matters, what access/privacy/rights/commercialization conversations are legitimate, and how this lane stays separate from the core robot-team buyer motion.

**Triggers:**
- `15 12 * * 1` — Weekly operator-lane review (Monday 12:15pm ET)
- `15 12 * * 4` — Midweek refresh (Thursday 12:15pm ET)
- Event: Growth Lead / Ops Lead / City Demand request

**Inputs:**
- Demand Intelligence output
- Website intake disposition fields from `structured_intake`
- `ops/paperclip/programs/site-operator-partnership-agent-program.md`
- `ops/paperclip/playbooks/site-operator-access-and-commercialization-playbook.md`
- City Demand, Intake, Ops, and Finance feedback

**Outputs:**
- Optional site-operator playbook
- Internal conversation frameworks for access and commercialization
- Execution queue for Ops, Intake, standard commercial handling, and City Demand

**Policy guardrails:** Permission judgments, legal/privacy/rights interpretation, pricing, contracts, revenue-share commitments, and external outreach.
Operator submission does not require a meeting, but private access, rights, privacy, or commercialization ambiguity requires a human checkpoint before the next operational step.

**Skill file:** `ops/paperclip/skills/site-operator-partnership-agent.md`
**Steering file:** `ops/paperclip/programs/site-operator-partnership-agent-program.md`

---

#### City Demand Agent (`city-demand-agent`)

| Field | Value |
|-------|-------|
| **Department** | Growth |
| **Reports to** | Growth Lead |
| **Model** | Hermes (DeepSeek V4 Flash primary via official DeepSeek endpoint, DeepSeek V4 Pro discounted fallback before Codex fallback) |
| **Status** | New |

**Purpose:** Adapts Blueprint's generic robot-team demand playbook to specific cities. Starts with Austin, TX and San Francisco, CA. Maps likely buyer clusters, facility-type demand, optional operator-lane opportunities, and city readiness.

**Triggers:**
- `15 13 * * 1` — Weekly city demand planning (Monday 1:15pm ET)
- `15 13 * * 4` — Midweek city refresh (Thursday 1:15pm ET)
- Event: Growth Lead / Ops Lead request

**Inputs:**
- Demand Intelligence output
- Robot Team Growth playbook updates
- Site Operator Partnership updates
- `ops/paperclip/programs/city-demand-agent-program.md`
- Austin and San Francisco city-demand playbooks

**Outputs:**
- City-specific demand plans
- Weekly city scorecards and readiness status
- Cross-agent action queues for web, analytics, intake, ops, standard commercial handling, and site-operator follow-up

**Policy guardrails:** Public posting, outreach, city-live claims, guaranteed demand or partnership claims, non-standard pricing or contract commitments, and local legal/privacy/rights/commercialization interpretation. Standard buyer progression and standard quotes should stay out of founder review.

**Skill file:** `ops/paperclip/skills/city-demand-agent.md`
**Steering file:** `ops/paperclip/programs/city-demand-agent-program.md`

---

#### Conversion Optimizer (`conversion-agent`)

| Field | Value |
|-------|-------|
| **Department** | Growth |
| **Reports to** | Growth Lead |
| **Model** | Claude |
| **Status** | New |

**Purpose:** Runs an autoresearch-style experiment loop on the webapp and capture app. Tests CTAs, onboarding flows, signup copy, pricing page layout, and any measurable surface.

**Autoresearch loop:**
```
1. Read program.md for current experiment focus
2. Analyze current funnel data + page structure
3. Propose a change (copy, CTA, form, layout, color/contrast)
4. Human approval gate → deploy (Phase 1)
5. Monitor metrics for 24-72hrs
6. Evaluate: improvement → keep + log | regression → revert + log
7. Loop with updated context
```

**Triggers:**
- `0 11 * * 1` — Weekly experiment cycle start (Monday 11am ET, after Growth Lead review)
- Event: Growth Lead assigns new experiment focus
- Event: Measurement period complete → evaluate results

**Inputs:**
- Analytics data: page views, signup rates, completion rates, conversion rates, bounce rates
- Current page source code (Blueprint-WebApp, BlueprintCapture marketing surfaces)
- Experiment history log (Notion Knowledge DB)
- `program.md` steering file (updated by Growth Lead)

**Outputs:**
- Experiment proposals with predicted impact → human approval gate
- Code change PRs (copy, layout, CTA adjustments) → Blueprint-WebApp repo
- Experiment result reports → Growth Lead
- Running experiment history → Notion Knowledge DB

**Policy guardrails:**
- All code deploys (Phase 1)
- Structural changes — flow reordering, new pages (Phase 1-2)

**External needs:**
- Analytics platform API (PostHog, Mixpanel, or GA4)
- Browser automation (gstack/preview tools) for visual QA
- Git access to Blueprint-WebApp and BlueprintCapture repos

**Infrastructure:** No GPU needed. Code-and-measure loop runs on local Paperclip hub.

**Graduation path:**
| Phase | Behavior | Criteria to advance |
|-------|----------|-------------------|
| 1 | Proposes + writes PRs; human reviews and deploys everything | 1 month, experiment win rate >40% |
| 2 | Auto-deploys copy/CTA tweaks behind feature flags; human approves structural changes | 2 months, no regressions from auto-deploys |
| 3 | Auto-deploys all behind feature flags with 48hr auto-rollback on metric regression | Founder sign-off |

**Skill file:** `ops/paperclip/skills/conversion-agent.md`
**Steering file:** `ops/paperclip/programs/conversion-agent-program.md`

---

#### Analytics Agent (`analytics-agent`)

| Field | Value |
|-------|-------|
| **Department** | Growth |
| **Reports to** | Growth Lead |
| **Model** | Hermes (DeepSeek V4 Flash primary via official DeepSeek endpoint, DeepSeek V4 Pro discounted fallback before Codex fallback) |
| **Status** | New |

**Purpose:** KPI contract owner across Firestore, Stripe, PostHog/GA4, and Paperclip. Pulls, aggregates, and interprets measurable signals, detects anomalies, publishes daily/weekly reports, and keeps blocked metrics visible instead of inventing them. Canonical metric definitions and scoreboard truth are governed by the Phase 0 company metrics contract in `docs/company-metrics-contract-2026-04-20.md`.

**Triggers:**
- `0 6 * * *` — Daily 6am ET metrics pull + anomaly detection
- `0 23 * * 0` — Weekly Sunday 11pm ET full report compilation
- Event: Any agent requests a metric query
- Event: Anomaly detected → immediate alert

**Inputs:**
- Analytics platform (page views, events, funnels)
- Stripe (revenue, transactions, payouts)
- Firestore (user counts, request counts, capture counts, queue depths)
- GitHub (traffic, PR velocity)
- Marketing channels (if instrumented)

**Outputs:**
- Daily metrics snapshot → Notion + Slack
- Weekly growth report → Growth Lead
- Anomaly alerts (immediate) → Growth Lead + CEO
- On-demand metric answers → requesting agent
- Shared company-scoreboard interpretations aligned to the canonical WebApp-centered metrics contract

**Key metrics tracked:**

| Funnel | Stages |
|--------|--------|
| **Buyer** | Visitor → signup → request submitted → qualified → purchased → active session |
| **Capturer** | Visitor → signup → waitlist → approved → first capture → QA pass → listed → sold |
| **Revenue** | MRR, transaction volume, average deal size, payout volume |
| **Operations** | Queue depth, resolution time, support ticket volume |
| **Engagement** | Page bounce rate, time on page, scroll depth, return visits |

**Policy guardrails:** None (reporting/analytics role).

**External needs:** Analytics platform API, Stripe API (read-only), Firestore read, Notion API, Slack webhook.

**Infrastructure:** No GPU. Lightweight compute. Local Paperclip hub or scheduled cloud function.

**Graduation path:**
| Phase | Behavior | Criteria to advance |
|-------|----------|-------------------|
| 1 | Produces reports; human validates accuracy for 2 weeks | Accuracy >95% vs manual spot-check |
| 2 | Trusted for daily reporting; human spot-checks weekly | 1 month, no errors in daily reports |
| 3 | Fully autonomous; other agents query directly as a service | Founder sign-off |

**Skill file:** `ops/paperclip/skills/analytics-agent.md`

---

#### Metrics Reporter (`metrics-reporter`)

| Field | Value |
|-------|-------|
| **Department** | Growth |
| **Reports to** | Analytics Agent |
| **Model** | Hermes (Paperclip execution truth, Notion visibility mirror) |
| **Status** | Paused legacy shim |

**Purpose:** Legacy compatibility shim for the former Notion-facing metrics pilot. Active ownership of recurring KPI and internal metrics reporting has been merged into `analytics-agent`.

**Triggers:**
- None by default. Historical routines remain paused.
- Event: legacy manual wake or old follow-up issue that still points at `metrics-reporter`

**Inputs:**
- analytics sources and Growth Studio mirrors
- Blueprint Work Queue and Knowledge
- `ops/paperclip/blueprint-company/agents/metrics-reporter/AGENTS.md`

**Outputs:**
- redirect note pointing legacy work to `analytics-agent`
- backward-compatible report/run mirror only when an old action still uses the legacy reporter

**Policy guardrails:** External reuse of material claims still requires human review.

**Instructions:** `ops/paperclip/blueprint-company/agents/metrics-reporter/AGENTS.md`

---

#### Community Updates Agent (`community-updates-agent`)

| Field | Value |
|-------|-------|
| **Department** | Growth |
| **Reports to** | Growth Lead |
| **Model** | Hermes (DeepSeek V4 Flash primary via official DeepSeek endpoint, DeepSeek V4 Pro discounted fallback before Codex fallback) |
| **Status** | New |

**Purpose:** Produces the weekly Blueprint community update for users, capturers, robot teams, partners, and interested operators. Turns real shipped work and community-relevant signals into a concise blog-plus-email draft.

**Triggers:**
- `0 9 * * 5` — Weekly Friday draft run (9am ET)
- Event: Growth Lead requests a special update tied to a launch, capture milestone, or community moment

**Inputs:**
- Closed Paperclip issues, weekly shipped work, Firestore/analytics deltas, Firehose/community signals
- `ops/paperclip/programs/community-updates-agent-program.md`
- The [$humanizer](/Users/nijelhunt_1/.agents/skills/humanizer/SKILL.md) skill for final copy cleanup

**Outputs:**
- Weekly update draft → Notion Knowledge DB
- Review artifact → Notion Work Queue
- Draft community campaign → SendGrid-backed draft path (when configured)
- Internal review note → Slack `#growth` (when configured)

**Policy guardrails:** Any live send/publish, unsupported traction claims, or sensitive rights/commercial disclosures.

**Instructions:** `ops/paperclip/blueprint-company/agents/community-updates-agent/AGENTS.md`
**Program:** `ops/paperclip/programs/community-updates-agent-program.md`

---

#### Workspace Digest Publisher (`workspace-digest-publisher`)

| Field | Value |
|-------|-------|
| **Department** | Growth |
| **Reports to** | Growth Lead |
| **Model** | Hermes (Paperclip execution truth, Notion visibility mirror) |
| **Status** | Pilot |

**Purpose:** Produces an internal weekly Blueprint workspace digest from Knowledge, Growth Studio, and Work Queue evidence. Writes draft roundup pages into Blueprint Knowledge, opens optional follow-up work items, and mirrors run visibility into Blueprint Agent Runs.

**Triggers:**
- Weekly digest draft run
- Event: manual wake tied to a launch, review, or operating recap need

**Inputs:**
- Blueprint Knowledge
- Growth Studio mirrors
- selected Work Queue views
- `ops/paperclip/blueprint-company/agents/workspace-digest-publisher/AGENTS.md`

**Outputs:**
- weekly internal digest draft → Blueprint Knowledge
- optional follow-up work items → Blueprint Work Queue
- run-level visibility row → Blueprint Agent Runs

**Policy guardrails:** Externalization of draft language or reuse as public messaging.

**Instructions:** `ops/paperclip/blueprint-company/agents/workspace-digest-publisher/AGENTS.md`

---

#### Market Intelligence Agent (`market-intel-agent`)

| Field | Value |
|-------|-------|
| **Department** | Growth |
| **Reports to** | Growth Lead |
| **Model** | Hermes (DeepSeek V4 Flash primary via official DeepSeek endpoint, DeepSeek V4 Pro discounted fallback before Codex fallback) |
| **Status** | New |

**Purpose:** Autoresearch-pattern agent for business intelligence. Continuously researches competitors, market trends, new papers/techniques, pricing movements, partnership opportunities, and regulatory changes.

**Autoresearch loop:**
```
1. Read program.md for current research focus areas
2. Run structured web research: scan sources → extract signals → synthesize
3. Score each finding by relevance + urgency
4. Produce research digest with actionable recommendations
5. Update context with new knowledge
6. Loop on schedule
```

**Triggers:**
- `0 7 * * 1-5` — Daily morning research scan (7am ET)
- `0 15 * * 5` — Weekly Friday deep synthesis (3pm ET)
- Event: CEO or Growth Lead assigns ad-hoc research question

**Inputs:**
- Web sources: competitor sites, ArXiv, robotics news, HN, industry blogs, regulatory filings
- `program.md` steering file (updated by Growth Lead or CEO)
- Previous research digests (Notion Knowledge DB)

**Outputs:**
- Daily signal digest → Growth Lead + CEO (Notion page)
- Weekly deep synthesis → Notion Knowledge DB + Slack
- Ad-hoc research answers → requesting agent
- Competitor tracker updates → Notion database

**Research domains:**

| Domain | What to track |
|--------|---------------|
| **Competitors** | Other capture/world-model/digital-twin platforms, pricing changes, feature launches, funding |
| **Technology** | New world-model papers, capture techniques, privacy tech, runtime innovations |
| **Market** | Robotics deployment trends, enterprise adoption, funding rounds in adjacent space |
| **Regulatory** | Data privacy laws, robotics safety standards, commercial robot regulations |

**Policy guardrails:** None (research/reporting role).

**External needs:** Web search API (SerpAPI/Brave/Tavily), ArXiv API, Notion API, Slack webhook.

**Infrastructure:** No GPU for daily work. Optional cloud GPU burst for deep paper analysis batches (~$5-20/mo).

**Graduation path:**
| Phase | Behavior | Criteria to advance |
|-------|----------|-------------------|
| 1 | Produces digests; human evaluates relevance/accuracy for 1 month | Relevance score >80% (human-judged) |
| 2 | Trusted for daily digests; human reviews weekly synthesis only | 2 months, consistently actionable insights |
| 3 | Fully autonomous; directly updates strategy docs and flags urgent items to CEO | Founder sign-off |

**Skill file:** `ops/paperclip/skills/market-intel-agent.md`
**Steering file:** `ops/paperclip/programs/market-intel-program.md`

---

#### Site Catalog Agent (`site-catalog-agent`)

| Field | Value |
|-------|-------|
| **Department** | Ops |
| **Reports to** | Ops Lead |
| **Model** | Hermes (DeepSeek V4 Flash primary via official DeepSeek endpoint, DeepSeek V4 Pro discounted fallback before Codex fallback) |
| **Status** | New |

**Purpose:** Product listing manager for Blueprint's site-world catalog. Creates and maintains accurate, discoverable listings for every package that clears QA and rights review. Ensures descriptions match reality — no embellishment, no underselling.

**Why this is an agent (not just automation):** Package metadata alone is not enough to make a good listing. The agent must interpret capture context, write a specific description ("45,000 sq ft distribution center, 3 aisles, ARKit depth"), choose the right category, and judge whether the listing is actually ready to publish. That is judgment over messy inputs.

**Triggers:**
- rights-provenance-agent clears a package for release
- Pipeline produces updated derived assets for an existing package
- Buyer-solutions-agent reports a catalog gap
- `0 11 * * 1,4` — Catalog freshness audit (Mon/Thu)

**Inputs:**
- Pipeline artifacts: qualification_summary, derived_assets, deployment_readiness, site_world_spec
- Firestore: site_worlds collection
- Rights clearance status from rights-provenance-agent
- Buyer demand signals from buyer-solutions-agent

**Outputs:**
- New or updated catalog listings in Firestore / WebApp
- Catalog gap reports to growth-lead
- Stale listing flags for review

**Policy guardrails:** Listing a new site type or removing a major category requires founder sign-off.

**Graduation path:**
| Phase | Behavior | Criteria to advance |
|-------|----------|-------------------|
| 1 | Drafts listings for human review and publish approval | 10 listings, quality validated |
| 2 | Publishes routine listings autonomously; human reviews novel site types | 20 accurate listings |
| 3 | Fully autonomous listing management; founder reviews only catalog-level structural changes | Founder sign-off |

---

#### Outbound Sales Agent (`outbound-sales-agent`)

| Field | Value |
|-------|-------|
| **Department** | Growth |
| **Reports to** | Growth Lead |
| **Model** | Hermes (DeepSeek V4 Flash primary via official DeepSeek endpoint, DeepSeek V4 Pro discounted fallback before Codex fallback) |
| **Status** | New |

**Purpose:** Blueprint's business development representative for robot team outreach. Monitors market and demand intel for strong signals, researches prospects, drafts personalized outreach, tracks conversations, and hands off qualified leads to buyer-solutions-agent.

**Why this is an agent (not just a CRM workflow):** Effective B2B outreach requires judgment — identifying the right signal, researching the specific prospect, crafting a message specific to their work, reading the response, and knowing when to advance or stop. That is not a templated sequence.

**Triggers:**
- demand-intel-agent publishes new robot team findings
- market-intel-agent flags a funding announcement or company news signal
- `0 10 * * 1-5` — Morning prospecting session
- `0 15 * * 1,3,5` — Follow-up session

**Inputs:**
- demand-intel and market-intel agent findings
- Site catalog (what is available to offer prospects)
- Prospect pipeline issues in Paperclip
- Web search for prospect research

**Outputs:**
- Personalized outreach drafts (human-approved in Phase 1)
- Prospect pipeline issues with stage and status
- Qualified handoffs to buyer-solutions-agent
- Outreach pattern reports to growth-lead

**Policy guardrails:**
- Standard outreach approval sits with Growth Lead inside approved posture; founder review is reserved for posture-changing, high-risk, or relationship-sensitive exceptions
- Any pricing or capability commitments outside approved commercial guardrails — founder
- Companies with existing relationships — coordinate through buyer-solutions-agent first

**Outreach rules (non-negotiable):**
- Max 2 touches per prospect without a response — then park
- Lead with their problem, not Blueprint's product
- Reference something specific to their work
- Never misrepresent capabilities or current availability

**Graduation path:**
| Phase | Behavior | Criteria to advance |
|-------|----------|-------------------|
| 1 | Researches and drafts; Growth Lead approves standard sends | 20 drafts, quality and accuracy validated |
| 2 | Sends first touch autonomously; Growth Lead reviews follow-ups and handoffs, founder sees only sensitive exceptions | >20% response rate over 30 outreaches |
| 3 | Manages outreach pipeline autonomously; founder reviews handoffs and escalations | Founder sign-off |

---

#### Buyer Success Agent (`buyer-success-agent`)

| Field | Value |
|-------|-------|
| **Department** | Ops |
| **Reports to** | Ops Lead |
| **Model** | Hermes (DeepSeek V4 Flash primary via official DeepSeek endpoint, DeepSeek V4 Pro discounted fallback before Codex fallback) |
| **Status** | New |

**Purpose:** Lightweight post-delivery buyer support lane. Handles onboarding, support, feedback, expansion signals, and churn risk after handoff, but stays event-driven until buyer volume is high enough to justify a standing cadence.

**Why this is an agent (not just analytics dashboards):** Usage dashboards tell you what happened. This agent interprets what it means — a buyer who stops logging in needs a follow-up, not a report. A buyer who asks about a second site needs a handoff to buyer-solutions, not a FAQ link. Pattern recognition plus relationship continuity is judgment work.

**Triggers:**
- buyer-solutions-agent marks a buyer as "delivered" / closes-won
- Hosted session error or degraded performance affecting active buyers
- Buyer submits support request or feedback
- Usage anomaly detected (significant drop or spike)
- manual milestone review once active-buyer thresholds justify a standing cadence

**Inputs:**
- Firestore: site-world sessions, buyer accounts, access entitlements, usage events
- WebApp: hosted session logs, buyer dashboard activity
- Pipeline: deployment_readiness, site_world_health
- Support requests from buyers

**Outputs:**
- Buyer health status and lifecycle stage in Paperclip
- Onboarding check-in communications (human-approved Phase 1)
- Support issue tracking and resolution
- Product feedback routed to appropriate teams
- Expansion handoffs to buyer-solutions-agent
- Churn reason reports and patterns to growth-lead

**Policy guardrails:**
- Routine buyer communication follows the active buyer-success policy
- Contract or pricing discussions route to the revenue-ops-pricing-agent for standard cases and founder only for non-standard exceptions
- Rights/privacy concerns from buyers escalate to `rights-provenance-agent` plus the rights-provenance-agent; founder only for precedent-setting exceptions

**Graduation path:**
| Phase | Behavior | Criteria to advance |
|-------|----------|-------------------|
| 1 | Monitors and drafts; Ops Lead approves routine communication policy | 5 buyers tracked through 30-day cycle |
| 2 | Sends routine check-ins and support acknowledgments autonomously; Ops Lead reviews feedback routing and escalations | Buyer satisfaction signals positive |
| 3 | Manages buyer relationships autonomously; founder reviews expansion handoffs, churn cases, and rights escalations | Founder sign-off |

---

#### Documentation Agent (`docs-agent`)

| Field | Value |
|-------|-------|
| **Department** | Engineering |
| **Reports to** | CTO |
| **Model** | Claude |
| **Status** | New |

**Purpose:** Cross-repo documentation owner. Monitors code changes across all three repos and keeps capture guides, API docs, onboarding materials, PLATFORM_CONTEXT, AUTONOMOUS_ORG, and internal architecture docs in sync with reality. Every update is minimal and accuracy-focused.

**Why this is an agent (not just a PR checklist):** Docs drift silently. When capture-claude ships a new upload flow, docs-agent reads the diff, identifies which guides are affected, and makes the minimal accurate change. That requires understanding what changed, which audiences it affects, and what docs describe that behavior. Cross-repo reasoning over messy inputs.

**Doc priority tiers:**
- **Tier 1 (within 24h):** Capture guides, API docs, onboarding materials
- **Tier 2 (within 1 week):** PLATFORM_CONTEXT, AUTONOMOUS_ORG, pipeline contract docs
- **Tier 3 (sweeps):** READMEs, FAQ, architecture docs

**Triggers:**
- Engineering agent merges a PR that changes user-facing behavior
- New agent created or agent definition changed
- Pipeline contract version change (Tier 1 urgency)
- capturer-success-agent or buyer-success-agent reports recurring user confusion
- `0 10 * * 2,5` — Documentation sweep (Tue/Fri)

**Inputs:**
- Git log across all 3 repos (recent merges)
- All existing documentation files
- Capture bridge contract, raw contract docs
- Confusion reports from capturer-success-agent, buyer-success-agent
- Paperclip: open doc-gap issues

**Outputs:**
- Minimal, accurate documentation updates (edits to existing files, not rewrites)
- New documents when a shipped feature has zero documentation
- Doc freshness tracking (last-verified date per major doc)
- Doc gap reports to CTO when gaps are too large to address without engineering input

**Policy guardrails:** New documentation created from scratch requires CTO review before publishing.

**Graduation path:**
| Phase | Behavior | Criteria to advance |
|-------|----------|-------------------|
| 1 | Proposes doc changes; human reviews and applies | 20 proposals, accuracy validated |
| 2 | Applies Tier 2/3 doc updates autonomously; human reviews Tier 1 | Zero accuracy regressions over 1 month |
| 3 | Manages all doc updates autonomously; CTO reviews new-doc creation only | Founder sign-off |

---

## Infrastructure

### Local Paperclip Hub (Your Mac)

All agents run on the local Paperclip instance. They are lightweight — mostly LLM API calls + data reads/writes.

Hermes-backed research/specialist agents are configured to use DeepSeek V4 Flash first on this host, with DeepSeek V4 Pro as the discounted model fallback and Codex as the execution fallback when the DeepSeek lane is unavailable.

Creative execution routing on this host is narrower than the general model ladder:

- Hermes-backed growth, research, and specialist lanes own planning, text, evidence gathering, and routing by default.
- `webapp-codex` is the default execution lane for Codex-run brand, marketing, frontend, mockup, and image-heavy work.
- Hermes lanes must not assume they can directly generate final imagery just because Codex can.
- Final image execution should use Codex desktop OAuth image generation on `gpt-image-2`, not a separate image API.
- Server-side autonomous workers keep explicit provider APIs for non-image work unless a separate migration changes their execution substrate.
- Video generation remains on an explicit provider path. The server-side default is OpenRouter video; Higgsfield MCP is an approved agent-side Seedance 2.0 alternative for scoped creative/video issues when account OAuth and credits are available.

| Component | Status | Notes |
|-----------|--------|-------|
| Paperclip Server (localhost:3100) | Active | Company package, plugin, and dashboard are live on the local trusted host |
| Cloudflare Tunnel | Active | Public Paperclip URL is live for webhook intake |
| LaunchAgent | Active | `com.blueprint.paperclip` and maintenance agent are installed |
| Blueprint Automation Plugin | Ready | CI, intake, Firestore, Stripe, and support webhook routes are live and smoke-tested |

### Cloud Burst (On-Demand)

| Service | Used By | When | Est. Cost |
|---------|---------|------|-----------|
| RunPod/Lambda GPU | Market Intel | Deep paper analysis batches | ~$5-20/mo |

### External APIs to Provision

| Service | Agents | Priority | Est. Cost | Status |
|---------|--------|----------|-----------|--------|
| Analytics (PostHog/GA4) | Analytics, Conversion, Growth Lead | P0 | Free tier | **Repo wired; account config still needed** |
| Web Search API | Market Intel | P1 | ~$50/mo | **Configured** |
| Slack Incoming Webhook | All leads + CEO | P1 | Free | **Configured** |
| SendGrid / Email API | Intake, Finance/Support, Growth | P1 | Free tier | **Repo wired; account config still needed** |
| Codex OAuth image generation (`gpt-image-2`) | Growth, Community Updates, Robot Team Growth | P1 | Included with Codex lane availability | **Route through `webapp-codex`; no separate image API key path for final assets** |
| Higgsfield MCP video generation (Seedance 2.0) | WebApp Codex, Growth Lead, Community Updates, Robot Team Growth, Capturer Growth | P1 | Higgsfield credits | **Agent-side MCP configured; requires Higgsfield account OAuth before use; use only through `higgsfield-creative-video`** |
| ElevenLabs voice | Support, Growth, Buyer-facing demo booking | P1 | Usage-based | **Repo wired; key/voice config still needed** |
| Notion API Token | All agents (via plugin) | P0 | Free | **Configured** |
| Cloudflare Tunnel | Plugin webhook intake | P0 | Free | **Verified** |

### Already In Place

- Firebase/Firestore — all ops data
- Stripe API — payments, payouts, webhooks
- Google Calendar/Maps/Sheets APIs
- GitHub API + webhooks
- Claude local subscription auth
- Codex local subscription auth
- Paperclip server + LaunchAgent + plugin

---

## Progressive Autonomy Framework

### Phase Definitions

| Phase | Name | Description |
|-------|------|-------------|
| **1** | Supervised | Agent produces outputs but human approves every action affecting external state |
| **2** | Semi-autonomous | Agent executes low-risk, reversible actions autonomously within boundaries. Human approves high-risk/irreversible. |
| **3** | Autonomous | Agent operates independently. Human reviews summaries and handles exceptions. |

### Graduation Criteria

An agent advances from Phase N to N+1 when ALL of these are met:

1. **Track record:** Operated at Phase N for at least 2 weeks (1→2) or 1 month (2→3)
2. **Accuracy:** Human override rate below 10% for 2 consecutive weeks
3. **No incidents:** No escalation caused by agent error in the graduation period
4. **Founder sign-off:** Human explicitly promotes the agent

### Permanent Policy Guardrails

These actions always require human approval regardless of phase:

- Payout release above configured $ threshold
- Rights, privacy, or consent signoff
- Legal or compliance decisions
- Final public release of sensitive previews
- Brand or positioning changes
- Budget allocation changes
- Agent promotion decisions (meta-gate)

---

## Autoresearch Pattern

Adapted from [Karpathy's autoresearch](https://github.com/karpathy/autoresearch) for non-ML experiment loops.

### Core Loop

```
while True:
    focus = read("program.md")          # human-steerable priorities
    context = gather(focus)              # data, metrics, web sources
    hypothesis = analyze(context)        # what to try or investigate
    action = propose(hypothesis)         # change, query, experiment
    if requires_approval(action):
        wait_for_human()
    result = execute_and_measure(action)
    log(result)                          # immutable history
    update_context(result)               # learn for next cycle
```

### Agents Using This Pattern

| Agent | What it experiments on | Measurement |
|-------|----------------------|-------------|
| `conversion-agent` | CTAs, copy, onboarding flows, page layout | Funnel conversion rates (24-72hr windows) |
| `market-intel-agent` | Research focus areas, source quality | Signal relevance + actionability (human-judged initially) |
| `demand-intel-agent` | Buyer research focus areas, source quality | Signal relevance + Blueprint buyer-fit actionability |

### program.md Steering File Format

```markdown
# [Agent Name] — Current Focus

## Priority
[What the agent should focus on this cycle]

## Constraints
[What to avoid, budget limits, off-limits areas]

## Success Metrics
[How to evaluate results]

## Recent Context
[Key learnings from last cycle]
```

Updated by Growth Lead (for Conversion + Market Intel) or CEO (for ad-hoc overrides). Lives at `ops/paperclip/programs/<agent>-program.md`.

---

## Notion Sync Protocol

### Source of Truth Rules

| What | Canonical Source | Sync Direction |
|------|-----------------|----------------|
| Agent definitions + org chart | Repo (`AUTONOMOUS_ORG.md`) | Repo → Notion |
| Execution ownership + live task state | Paperclip issues + routines | Paperclip → Notion |
| Agent registry + runtime access posture | Notion Agents DB | Repo/Paperclip → Notion |
| Agent run visibility + approval breadcrumbs | Notion Agent Runs DB | Paperclip/app → Notion |
| Research working memory + reusable synthesis | Repo `knowledge/` | Agents → repo |
| Workspace review queue + operator visibility | Notion Work Queue | Paperclip/agents → Notion, curated by `notion-manager-agent` |
| Operator-facing knowledge mirror | Notion Knowledge DB | Repo/Paperclip/agents → Notion, curated by `notion-manager-agent` |
| Skill file content | Repo skill files | Repo → Notion (metadata link), curated by `notion-manager-agent` |
| Experiment history | Repo `knowledge/` + Notion Knowledge DB mirror where needed | Agents → repo, selective mirror → Notion |
| Metrics + reports | Notion | Agents → Notion, curated by `notion-manager-agent` |

### Sync Cadence

- Agent definitions: Updated in repo, synced to Notion on change
- Work items: Paperclip changes should mirror into Notion promptly; the Notion manager repairs drift, duplicates, and metadata gaps
- Reports and digests: KB-eligible research and synthesis artifacts should be written to repo `knowledge/` first, then mirrored to Notion when operator visibility or review is needed
- Skill metadata: Updated in Notion Skills DB when skill files change, then reconciled against related docs and Hub structure
- Producer artifact rule: research, planning, scorecard, digest, and playbook-producing agents must not end a run with the artifact living only in Paperclip comments. When the artifact is eligible for the Hermes KB, the durable markdown artifact should be written to repo `knowledge/` first. When human review, decision, or operator visibility is needed, the run must also mirror or upsert the artifact into Notion Knowledge and create or update a Notion Work Queue breadcrumb when follow-up is required.

### Blueprint Hub Databases

| Database | Purpose | URL |
|----------|---------|-----|
| Blueprint Work Queue | Task tracking for all agents + humans | [Work Queue](https://www.notion.so/f83b6c53a33a47909ca4786dddadad46) |
| Blueprint Skills | Skill file metadata + lifecycle tracking | [Skills](https://www.notion.so/4e37bd7ae4484f81aa3eb8860826e98c) |
| Blueprint Knowledge | Research outputs, experiment logs, reference docs | [Knowledge](https://www.notion.so/7c729783c3774342bf005555b88a2ec6) |
| Blueprint Agents | Agent registry, runtime, access posture, and Hub surfacing | [Agents](https://www.notion.so/c6021156679642c5bef458d2eb12d6ab) |
| Blueprint Agent Runs | Run-level status, approval breadcrumbs, and artifact links | [Agent Runs](https://www.notion.so/bce59b924cf6446d9e07e026c824563b) |

---

## Cross-Repo Lifecycle

This guide exists in all 3 main repos. Here is how work flows across them:

```
BlueprintCapture          BlueprintCapturePipeline       Blueprint-WebApp
(capture evidence)        (package into world models)    (sell + operate)
       │                           │                           │
       │  raw bundle + handoff     │  artifacts + metadata     │
       └──────────────►────────────┘──────────────►────────────┘
                                                               │
                              Paperclip Hub                    │
                         (orchestrates all agents)◄────────────┘
                                   │
                            Notion Hub
                      (source of truth for ops)
```

### Which agents touch which repos

| Repo | Agents with access |
|------|--------------------|
| Blueprint-WebApp | webapp-codex, webapp-claude, conversion-agent, analytics-agent, demand-intel-agent, robot-team-growth-agent, site-operator-partnership-agent, city-demand-agent, buyer-solutions-agent, solutions-engineering-agent, buyer-success-agent, site-catalog-agent, outbound-sales-agent |
| BlueprintCapture | capture-codex, capture-claude, field-ops-agent, capturer-success-agent |
| BlueprintCapturePipeline | pipeline-codex, pipeline-claude, capture-qa-agent, rights-provenance-agent |
| All repos (read) | CEO, CTO, Ops Lead, Growth Lead, beta-launch-commander, docs-agent, notion-manager-agent, revenue-ops-pricing-agent, security-procurement-agent |
