# Blueprint Autonomous Organization Guide

> **Source of truth:** [Blueprint Hub on Notion](https://www.notion.so/16d80154161d80db869bcfba4fe70be3)
> This file is the canonical repo-side reference. Notion Hub is the canonical operational surface.
> Both must stay in sync.

## Overview

Blueprint runs as an autonomous organization powered by [Paperclip](https://github.com/paperclipai/paperclip). Every operational role — from buyer intake to market research to conversion optimization — is modeled as a persistent agent with defined responsibilities, triggers, human gates, and a graduation path toward full autonomy.

This guide covers the full org so that any agent or human working in any Blueprint repo understands who does what, how work flows, and where the boundaries are.

On the current trusted host, Paperclip uses local subscription-backed auth only. Claude is the default executive/review lane and Codex is the default implementation lane, but reconcile automatically fails a workspace over to the other local adapter when the default adapter is unhealthy or rate-limited.

**Key principles:**
- Capture-first, world-model-product-first positioning (see `PLATFORM_CONTEXT.md`)
- Progressive autonomy — agents start supervised and graduate based on track record
- Notion is the operational source of truth; repo files are the definitional source of truth
- Autoresearch-pattern loops drive continuous optimization (adapted from [Karpathy's autoresearch](https://github.com/karpathy/autoresearch))

---

## Org Chart

```
                           ┌──────────────┐
                           │  CEO Agent   │ ← Human founder is the board
                           │   (Claude)   │
                           └──────┬───────┘
                                  │
                 ┌────────────────┼────────────────┐
                 │                │                 │
          ┌──────┴──────┐  ┌─────┴──────┐  ┌──────┴───────┐
          │  CTO Agent  │  │  Ops Lead  │  │ Growth Lead  │
          │  (Claude)   │  │  (Claude)  │  │   (Claude)   │
          └──────┬──────┘  └─────┬──────┘  └──────┬───────┘
                 │               │                 │
       ┌─────┬──┴──┐      ┌─────┼─────┐     ┌─────┼─────┐
       │     │     │       │     │     │     │     │     │
     Impl  Impl  Impl   Intk  QA   Fld   Conv  Anly  Mkt
     (x3)  Revw  (x3)   Agnt  Agnt Ops   Opt   Agnt  Intel
     Codex (x3)  Codex  Cld   Cld  Agnt  Cld   Cld   Cld
           Claude              Cld
```

### Departments

| Department | Lead | Agents | Focus |
|-----------|------|--------|-------|
| **Executive** | CEO | CEO, CTO | Strategy, priorities, cross-dept coordination |
| **Engineering** | CTO | 6 agents (impl + review per repo) | Code implementation and review |
| **Ops** | Ops Lead | 5 agents | Product operations lifecycle |
| **Growth** | Growth Lead | 11 agents | Buyer demand, capturer supply, city planning, conversion, retention, and intelligence |

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

#### CTO (`blueprint-cto`)

| Field | Value |
|-------|-------|
| **Department** | Executive |
| **Reports to** | CEO |
| **Model** | Claude |
| **Status** | Live in Paperclip package |

**Purpose:** Technical decisions, cross-repo coordination, architecture review. Routes non-technical ops issues to Ops Lead.

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
| **Reports to** | CEO |
| **Model** | Hermes (Codex OAuth) |
| **Status** | New |

**Purpose:** Coordinates all product operations. Routes work between intake, QA, scheduling, and finance agents. Produces daily ops summary. Escalates blockers to CEO.

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

**Human gates:** None (coordination/routing role).

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

**Purpose:** Processes capturer applications (waitlist) and buyer inbound requests. Classifies by intent, scores readiness, detects missing info, drafts responses, and auto-executes low-risk follow-up where policy allows.

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
- Auto-sent low-risk follow-up and invite flows routed through the action ledger
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
| 2 | Auto-send low-risk follow-up and invite flows; human reviews rejections and sensitive cases | Shipped in WebApp |
| 3 | Expand auto-invite authority only if policy and outcomes justify it | Founder sign-off |

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

**Human gates:**
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

**Purpose:** Coordinates capture scheduling — capturer assignment, standard communications, reminder sequencing, simple reschedules, and site-access tracking.

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

**Human gates:**
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
| 3 | Expand beyond heuristic dispatch only with stronger external availability/travel data | Founder sign-off |

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

**Human gates:**
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

### Growth Department

---

#### Growth Lead (`growth-lead`)

| Field | Value |
|-------|-------|
| **Department** | Growth |
| **Reports to** | CEO |
| **Model** | Hermes (Codex OAuth) |
| **Status** | New |

**Purpose:** Coordinates buyer demand, capturer supply, conversion, retention, and city planning. Sets experiment priorities using ICE scoring. Synthesizes analytics, market intelligence, supply intelligence, capturer growth planning, city launch planning, demand intelligence, robot-team growth planning, site-operator lane planning, and city demand planning into growth strategy.

**Triggers:**
- `0 9 * * 1-5` — Daily review of overnight analytics + agent reports
- `0 10 * * 1` — Weekly Monday growth review + experiment planning
- Event: Analytics agent anomaly alert

**Inputs:**
- Analytics agent daily/weekly reports
- Conversion Optimizer experiment results
- Market Intel research digests
- Supply Intel research digests
- Capturer Growth playbook updates
- City Launch city-plan updates
- Demand Intel research digests
- Robot Team Growth playbook updates
- Site Operator Partnership updates
- City Demand city-plan updates
- Notion Work Queue (Growth-tagged items)

**Outputs:**
- Weekly growth summary → CEO + Notion
- Experiment priority queue → Conversion Optimizer
- Research briefs → Market Intelligence agent
- Marketplace-supply research priorities → Supply Intelligence agent
- Generic capturer playbook priorities → Capturer Growth agent
- City sequencing priorities → City Launch agent
- Robot-team demand research priorities → Demand Intelligence agent
- Generic robot-team demand priorities → Robot Team Growth agent
- Site-operator lane priorities → Site Operator Partnership agent
- Buyer-city sequencing priorities → City Demand agent
- Funnel health dashboard updates → Notion

**Human gates:** None (coordination role).

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
| **Model** | Hermes (Codex OAuth) |
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

**Human gates:** Compensation policy, legal classification, claims about earnings/work volume, and any external outreach.

**Skill file:** `ops/paperclip/skills/supply-intel-agent.md`
**Steering file:** `ops/paperclip/programs/supply-intel-agent-program.md`

---

#### Capturer Growth Agent (`capturer-growth-agent`)

| Field | Value |
|-------|-------|
| **Department** | Growth |
| **Reports to** | Growth Lead |
| **Model** | Hermes (Codex OAuth) |
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

**Human gates:** Spend, compensation changes, public posting, and claims about earnings/work availability.

**Skill file:** `ops/paperclip/skills/capturer-growth-agent.md`
**Steering file:** `ops/paperclip/programs/capturer-growth-agent-program.md`

---

#### City Launch Agent (`city-launch-agent`)

| Field | Value |
|-------|-------|
| **Department** | Growth |
| **Reports to** | Growth Lead |
| **Model** | Hermes (Codex OAuth) |
| **Status** | New |

**Purpose:** Adapts Blueprint's generic capturer growth playbook to specific cities. Starts with Austin, TX and San Francisco, CA.

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

**Human gates:** Final city launch decision, spend, public posting, compensation claims, and local legal/compliance interpretation.

**Skill file:** `ops/paperclip/skills/city-launch-agent.md`
**Steering file:** `ops/paperclip/programs/city-launch-agent-program.md`

---

#### Demand Intelligence Agent (`demand-intel-agent`)

| Field | Value |
|-------|-------|
| **Department** | Growth |
| **Reports to** | Growth Lead |
| **Model** | Hermes (Codex OAuth) |
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

**Human gates:** Pricing or contract decisions, external outreach, public traction claims, and any privacy/rights/procurement judgment.

**Skill file:** `ops/paperclip/skills/demand-intel-agent.md`
**Steering file:** `ops/paperclip/programs/demand-intel-agent-program.md`

---

#### Robot Team Growth Agent (`robot-team-growth-agent`)

| Field | Value |
|-------|-------|
| **Department** | Growth |
| **Reports to** | Growth Lead |
| **Model** | Hermes (Codex OAuth) |
| **Status** | New |

**Purpose:** Converts demand-intel research into Blueprint's reusable robot-team demand playbook. Maintains the generic ICP, messaging, proof-pack, hosted-session demo motion, and buyer funnel that later city-demand work should inherit.

**Triggers:**
- `30 9 * * 1` — Weekly playbook update (Monday 9:30am ET)
- `30 9 * * 4` — Midweek refresh (Thursday 9:30am ET)
- Event: Demand Intel or Growth Lead request

**Inputs:**
- Demand Intelligence briefs
- `ops/paperclip/programs/robot-team-growth-agent-program.md`
- `ops/paperclip/playbooks/robot-team-demand-playbook.md`
- Analytics and ops feedback

**Outputs:**
- Generic robot-team demand playbook
- Proof-pack and hosted-session guidance
- Execution queue for Conversion, Analytics, Intake, Ops, Finance Support, and City Demand

**Human gates:** Spend, discounts, pricing, contracts, outreach sends, and claims beyond current product truth.

**Skill file:** `ops/paperclip/skills/robot-team-growth-agent.md`
**Steering file:** `ops/paperclip/programs/robot-team-growth-agent-program.md`

---

#### Site Operator Partnership Agent (`site-operator-partnership-agent`)

| Field | Value |
|-------|-------|
| **Department** | Growth |
| **Reports to** | Growth Lead |
| **Model** | Hermes (Codex OAuth) |
| **Status** | New |

**Purpose:** Maintains Blueprint's optional third lane for site operators. Defines when site-operator demand matters, what access/privacy/rights/commercialization conversations are legitimate, and how this lane stays separate from the core robot-team buyer motion.

**Triggers:**
- `15 12 * * 1` — Weekly operator-lane review (Monday 12:15pm ET)
- `15 12 * * 4` — Midweek refresh (Thursday 12:15pm ET)
- Event: Growth Lead / Ops Lead / City Demand request

**Inputs:**
- Demand Intelligence output
- `ops/paperclip/programs/site-operator-partnership-agent-program.md`
- `ops/paperclip/playbooks/site-operator-access-and-commercialization-playbook.md`
- City Demand, Intake, Ops, and Finance feedback

**Outputs:**
- Optional site-operator playbook
- Internal conversation frameworks for access and commercialization
- Execution queue for Ops, Intake, Finance Support, and City Demand

**Human gates:** Permission judgments, legal/privacy/rights interpretation, pricing, contracts, revenue-share commitments, and external outreach.

**Skill file:** `ops/paperclip/skills/site-operator-partnership-agent.md`
**Steering file:** `ops/paperclip/programs/site-operator-partnership-agent-program.md`

---

#### City Demand Agent (`city-demand-agent`)

| Field | Value |
|-------|-------|
| **Department** | Growth |
| **Reports to** | Growth Lead |
| **Model** | Hermes (Codex OAuth) |
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
- Cross-agent action queues for web, analytics, intake, ops, finance, and site-operator follow-up

**Human gates:** Public posting, outreach, city-live claims, guaranteed demand or partnership claims, pricing or contract commitments, and local legal/privacy/rights/commercialization interpretation.

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

**Human gates:**
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
| **Model** | Hermes (Codex OAuth) |
| **Status** | New |

**Purpose:** Pulls, aggregates, and interprets all measurable signals across the platform. Detects anomalies. Produces daily/weekly reports. Answers ad-hoc metric queries from other agents.

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

**Key metrics tracked:**

| Funnel | Stages |
|--------|--------|
| **Buyer** | Visitor → signup → request submitted → qualified → purchased → active session |
| **Capturer** | Visitor → signup → waitlist → approved → first capture → QA pass → listed → sold |
| **Revenue** | MRR, transaction volume, average deal size, payout volume |
| **Operations** | Queue depth, resolution time, support ticket volume |
| **Engagement** | Page bounce rate, time on page, scroll depth, return visits |

**Human gates:** None (reporting/analytics role).

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

#### Market Intelligence Agent (`market-intel-agent`)

| Field | Value |
|-------|-------|
| **Department** | Growth |
| **Reports to** | Growth Lead |
| **Model** | Hermes (Codex OAuth) |
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

**Human gates:** None (research/reporting role).

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

## Infrastructure

### Local Paperclip Hub (Your Mac)

All agents run on the local Paperclip instance. They are lightweight — mostly LLM API calls + data reads/writes.

Hermes-backed research/copilot agents are configured to use Codex OAuth only on this host. They are not expected to consume Anthropic or OpenAI API keys for their main model path.

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
| Analytics (PostHog/GA4) | Analytics, Conversion, Growth Lead | P0 | Free tier | **Not yet set up** |
| Web Search API | Market Intel | P1 | ~$50/mo | **Configured** |
| Slack Incoming Webhook | All leads + CEO | P1 | Free | **Configured** |
| SendGrid / Email API | Intake, Finance/Support | P1 | Free tier | **Not yet set up** |
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

### Permanent Human Gates (Never Graduate)

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
| Work items + task state | Notion Work Queue | Notion ↔ Agents |
| Knowledge + research outputs | Notion Knowledge DB | Agents → Notion |
| Skill file content | Repo skill files | Repo → Notion (metadata link) |
| Experiment history | Notion Knowledge DB | Agents → Notion |
| Metrics + reports | Notion | Agents → Notion |

### Sync Cadence

- Agent definitions: Updated in repo, synced to Notion on change
- Work items: Real-time via Notion API
- Reports and digests: Written to Notion on each agent's schedule
- Skill metadata: Updated in Notion Skills DB when skill files change

### Blueprint Hub Databases

| Database | Purpose | URL |
|----------|---------|-----|
| Blueprint Work Queue | Task tracking for all agents + humans | [Work Queue](https://www.notion.so/f83b6c53a33a47909ca4786dddadad46) |
| Blueprint Skills | Skill file metadata + lifecycle tracking | [Skills](https://www.notion.so/4e37bd7ae4484f81aa3eb8860826e98c) |
| Blueprint Knowledge | Research outputs, experiment logs, reference docs | [Knowledge](https://www.notion.so/7c729783c3774342bf005555b88a2ec6) |

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
| Blueprint-WebApp | webapp-codex, webapp-claude, conversion-agent, analytics-agent, demand-intel-agent, robot-team-growth-agent, site-operator-partnership-agent, city-demand-agent |
| BlueprintCapture | capture-codex, capture-claude, field-ops-agent |
| BlueprintCapturePipeline | pipeline-codex, pipeline-claude, capture-qa-agent |
| All repos (read) | CEO, CTO, Ops Lead, Growth Lead |
