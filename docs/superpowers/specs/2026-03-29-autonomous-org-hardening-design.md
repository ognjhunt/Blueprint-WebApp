# Autonomous Org Hardening — Design Spec

**Date:** 2026-03-29
**Status:** Draft
**Scope:** Close all 11 identified gaps across Tier 1 (operational), Tier 2 (trust), and Tier 3 (compliance)

---

## Context

The autonomous org skeleton is architecturally complete and one lane (Analytics Daily) is productionized end-to-end. This spec covers hardening the remaining 11 gaps to bring the org from "skeleton with one proven lane" to "operational org with monitoring, enforcement, and compliance."

---

## Work Package A: Plugin Infrastructure (Gaps 4, 5, 7, 9)

### Gap 4 — Monitoring & Alerting

**Problem:** If a routine ends `blocked` or a scheduled job fails, nobody gets notified. The plugin has `activity.log.write` capability and Slack integration but no alerting pipeline.

**Design:**

Add a `routine-health` monitoring layer to the plugin worker:

1. **New STATE_KEY: `routine-health`** — tracks per-routine last outcome, last success timestamp, consecutive failure count.

2. **New job: `routine-health-check`** — runs every 2 hours (`0 1,3,5,7,9,11,13,15,17,19,21,23 * * *`). Reads `routine-health` state. For any routine with:
   - `consecutiveFailures >= 2` — post Slack alert to `#ops` with routine name, last failure reason, and link to Paperclip issue
   - `lastSuccessAt` older than `2 * expectedInterval` — post Slack "stale routine" warning

3. **Hook into existing issue lifecycle:** When the analytics-report action (or any future deterministic writer) returns `outcome: "blocked"`, the worker updates `routine-health` state before returning. This means any routine that follows the analytics pattern (investigate → deterministic writer → issue patch) automatically feeds the health tracker.

4. **Alert format:** Slack message to `#ops`:
   ```
   :warning: Routine Alert: {routineTitle}
   Status: {blocked|stale}
   Last failure: {reason}
   Consecutive failures: {count}
   Issue: {paperclipIssueUrl}
   ```

5. **Manifest changes:**
   - Add `routine-health-check` to `jobs` array
   - No new capabilities needed (already has `plugin.state.read/write`, `http.outbound`)

**Files changed:**
- `ops/paperclip/plugins/blueprint-automation/src/manifest.ts` — add job
- `ops/paperclip/plugins/blueprint-automation/src/worker.ts` — add health tracking + job handler
- `ops/paperclip/plugins/blueprint-automation/src/constants.ts` — add job key + state key

---

### Gap 5 — Reconcile Script Reads From YAML

**Problem:** The reconcile script at `scripts/paperclip/reconcile-blueprint-paperclip-company.sh` hardcodes all 17 agents, their adapter configs, instruction source paths, and all 22 routines independently from `.paperclip.yaml`. Two sources of truth = config drift.

**Design:**

Refactor the reconcile script to parse `.paperclip.yaml` as the single source of truth:

1. **Read `.paperclip.yaml`** at script start using a small JS YAML parser (inline, no npm dependency — use a minimal YAML-to-JSON converter or shell `yq` if available, otherwise embed a lightweight parser).

   Actually, since the script already runs as `node <<'NODE'`, we can use a simple approach: the script already uses Node.js. We'll add a dependency on `js-yaml` in the plugin's `node_modules` (it's already a transitive dep of many tools) or parse the YAML subset we actually use with a minimal inline parser. The YAML structure is regular enough that we can extract what we need.

   **Simpler approach:** Since the `.paperclip.yaml` structure is well-defined and we control it, write a focused YAML parser that handles the subset we use (agents, routines, projects). No external dependency needed — Node.js can handle the regular structure with string splitting.

   **Simplest approach (recommended):** Export a JSON sidecar from the YAML during build/commit, and have the reconcile script read that. But this adds a build step.

   **Final decision:** Use `js-yaml` from the plugin's node_modules. The plugin already has a node_modules directory. Add `js-yaml` as a dependency of the plugin package.

2. **Derive agent configs from YAML `agents` section.** Each agent in YAML has `model`, `timeout`, `role` — map these to `adapterType` + `adapterConfig`. The mapping:
   - `model: claude-sonnet-4-6` → `adapterType: "claude_local"`
   - `model: gpt-5.4` → `adapterType: "codex_local"`
   - `workspace` field → `cwd` path
   - `timeout` → `timeoutSec`

3. **Derive routine configs from YAML `routines` section.** Each routine has `agent`, `schedule`, `project` — these map directly.

4. **Derive instruction source paths from YAML `agents` section.** Convention:
   - Executive/engineering agents: `ops/paperclip/blueprint-company/agents/{slug}/AGENTS.md`
   - Ops/growth agents: `ops/paperclip/skills/{slug}.md`

5. **Keep the reconcile script's core logic** (canonical matching, dedup, instruction sync) — just replace the hardcoded data with YAML-derived data.

**Files changed:**
- `scripts/paperclip/reconcile-blueprint-paperclip-company.sh` — full refactor
- `ops/paperclip/plugins/blueprint-automation/package.json` — add `js-yaml` dependency

---

### Gap 7 — Budget Enforcement

**Problem:** Monthly budgets declared in `.paperclip.yaml` ($2k-$5k per agent) but nothing enforces them. A runaway agent could burn through allocation.

**Design:**

Add budget tracking to the plugin worker:

1. **New STATE_KEY: `budget-tracking`** — stores per-agent monthly spend:
   ```json
   {
     "period": "2026-03",
     "agents": {
       "analytics-agent": { "runs": 45, "estimatedCostUsd": 12.50 },
       "market-intel-agent": { "runs": 22, "estimatedCostUsd": 8.30 }
     }
   }
   ```

2. **Cost estimation model:** Since we can't read actual API billing from inside the plugin, estimate based on:
   - Per-run cost estimate based on model type: `claude-sonnet-4-6` ≈ $0.25/run, `gpt-5.4` ≈ $0.40/run (configurable in plugin config)
   - Track actual run count from routine completions
   - Compare estimated spend against declared budget from YAML

3. **Enforcement levels:**
   - **Warn at 80%:** Post Slack message to `#ops` — "{agent} has used ~80% of monthly budget ({estimatedSpend}/{budget})"
   - **Alert at 100%:** Post Slack message to `#ops` + CEO — "{agent} has exceeded monthly budget"
   - **No hard stop in Phase 1.** Hard stops are dangerous when the org is still proving lanes. The human founder decides whether to pause an agent. Add hard-stop capability as a Phase 2 graduation feature.

4. **Budget reset:** Auto-reset on first run of each new calendar month.

5. **New tool: `budget-status`** — agents can query their own budget status. Returns current period, run count, estimated spend, budget limit, percentage used.

**Files changed:**
- `ops/paperclip/plugins/blueprint-automation/src/worker.ts` — add budget tracking logic
- `ops/paperclip/plugins/blueprint-automation/src/manifest.ts` — add `budget-status` tool
- `ops/paperclip/plugins/blueprint-automation/src/constants.ts` — add state key + tool name

---

### Gap 9 — Phase Transition Automation

**Problem:** Graduation criteria exist in skill files but transitions are manual. No tracking of performance metrics that feed graduation decisions.

**Design:**

Add phase tracking to the plugin:

1. **New STATE_KEY: `phase-tracking`** — stores per-agent graduation metrics:
   ```json
   {
     "analytics-agent": {
       "currentPhase": 1,
       "phaseStartDate": "2026-03-29",
       "metrics": {
         "totalRuns": 1,
         "successfulRuns": 1,
         "overrideCount": 0,
         "overrideRate": 0.0,
         "consecutiveSuccesses": 1
       }
     }
   }
   ```

2. **Metric collection:** Update metrics on every routine completion:
   - Increment `totalRuns`
   - Increment `successfulRuns` if issue ended `done`
   - Track `overrideCount` when a human overrides an agent decision (requires a `record-override` tool)

3. **New tool: `record-override`** — human or lead agent records when they override a subordinate agent's decision. Increments that agent's override count. Input: `agentKey`, `issueId`, `reason`.

4. **New tool: `phase-status`** — returns current phase, metrics, and whether graduation criteria are met for a given agent.

5. **Graduation check:** Part of the `routine-health-check` job. For each agent, check if metrics meet skill-file criteria:
   - Analytics: accuracy >95% for 2 weeks (proxy: success rate >95%, 14+ days in phase)
   - Ops Lead: override rate <10% for 2 weeks
   - Intake: classification accuracy >90% for 2 weeks (proxy: override rate <10%)
   - etc.

   When criteria are met, post to `#ops`: "{agent} is eligible for Phase {n+1} graduation. Metrics: {summary}. Founder approval required."

6. **No auto-promotion.** Phase transitions always require human approval. The system identifies eligibility and notifies — the founder decides.

**Files changed:**
- `ops/paperclip/plugins/blueprint-automation/src/worker.ts` — add phase tracking
- `ops/paperclip/plugins/blueprint-automation/src/manifest.ts` — add tools
- `ops/paperclip/plugins/blueprint-automation/src/constants.ts` — add keys

---

## Work Package B: Operational Contracts & Docs (Gaps 3, 6, 8, 10, 11)

### Gap 3 — Fill Steering Files

**Problem:** `conversion-agent-program.md` and `market-intel-program.md` have placeholder content that will cause agents to produce weak first runs.

**Design:**

#### `market-intel-program.md` — fill competitor list and research context:

**Known competitors to track** (based on the capture → world model / digital twin space):

| Company | Focus | Why Track |
|---------|-------|-----------|
| Matterport | 3D capture + digital twins for real estate/facilities | Closest comparable; established capture supply chain |
| Gaussian Splatting startups (Luma AI, Polycam, etc.) | Consumer 3D capture from phone video | Potential lower-end competition or partnership |
| NVIDIA Omniverse / Isaac Sim | Simulation environments for robotics | Major platform player; potential customer or competitor |
| Embodied AI labs (Covariant, Physical Intelligence, etc.) | Robot learning from real-world data | Primary buyer persona; track what they need |
| Rerun.io | Visualization/logging for robotics data | Adjacent tooling; potential integration |
| Realtime Robotics | Motion planning with environment models | Potential buyer; tracks world model consumption |
| Zipline, Agility Robotics, Figure AI | Deploying robots in real facilities | Target customers; track site-specific needs |

**Recent context update:**
- Analytics Agent completed first daily run 2026-03-29
- PostHog analytics now live on webapp with consent tracking
- No prior competitor map exists; this is the baseline scan

#### `conversion-agent-program.md` — fill with real baseline context:

**Baseline metrics** (from Analytics Daily BLU-38, 2026-03-29):
- Note: First analytics run focused on operational health, not funnel metrics. True funnel baselines will come from subsequent runs once PostHog data accumulates.
- PostHog was deployed 2026-03-27 — minimum 7 days of data needed before meaningful conversion analysis
- **Action for first cycle:** Instead of running a conversion experiment immediately, the first cycle should be a baseline measurement cycle. Read PostHog data for the capturer signup flow, establish current completion rate, identify top drop-off steps, then propose the first experiment.

**Updated hypothesis queue:**
1. (Deferred until baseline) Simplify signup form — email + device type only
2. (Deferred until baseline) Add progress indicator to multi-step flow
3. (Deferred until baseline) Reduce required fields per step

**Files changed:**
- `ops/paperclip/programs/market-intel-program.md`
- `ops/paperclip/programs/conversion-agent-program.md`

---

### Gap 6 — Agent-to-Agent Handoff Protocol

**Problem:** Agents are told to "route work via Paperclip issues" but there's no structured protocol for how handoffs work.

**Design:**

Create `ops/paperclip/HANDOFF_PROTOCOL.md` — a protocol document that all agent contracts reference.

**A2A-Informed Design:** We evaluated Google's A2A protocol (Agent-to-Agent, open standard for agent interoperability). A2A's concepts are excellent but the full HTTP/JSON-RPC protocol layer is overkill for internal Paperclip agents that already share an issue system. We borrow A2A's conceptual patterns and implement them natively within Paperclip issues:

| A2A Concept | Paperclip Implementation |
|-------------|------------------------|
| Agent Card (capability discovery) | Agent capability tags in `.paperclip.yaml` + skill file headers |
| Task lifecycle states | Paperclip issue states: `todo` → `in_progress` → `done`/`blocked`/`cancelled` |
| Message parts (structured content) | Structured JSON in issue comments (schema below) |
| Artifacts | Notion entries + Slack posts + issue comments with proof links |
| Push notifications | Paperclip routine triggers + webhook events |

**Handoff Issue Schema:**

When an agent creates an issue to hand off work to another agent, the issue must include a structured comment as the first comment:

```json
{
  "handoff": {
    "version": "1.0",
    "from": "ops-lead",
    "to": "capture-qa-agent",
    "type": "work-request",
    "priority": "high",
    "context": {
      "summary": "New capture submission needs QA review",
      "sourceIssueId": "BLU-42",
      "relatedArtifacts": [
        { "type": "firestore", "path": "captures/abc123" },
        { "type": "gcs", "path": "scenes/site-1/captures/cap-1/pipeline/" }
      ]
    },
    "expectedOutcome": "QA verdict (PASS/BORDERLINE/FAIL) with evidence",
    "deadline": "2026-03-30T09:00:00-04:00",
    "responseSchema": {
      "verdict": "PASS|BORDERLINE|FAIL",
      "evidence": "string",
      "payoutRecommendation": "string|null",
      "recaptureNeeded": "boolean"
    }
  }
}
```

**Handoff types:**
- `work-request` — requesting agent asks receiving agent to do work
- `escalation` — agent escalates a problem it can't solve
- `information-request` — agent needs data from another agent
- `status-update` — agent reports status back to requesting agent

**Response protocol:**
When the receiving agent completes the handoff, it:
1. Patches the handoff issue to `done` or `blocked`
2. Adds a structured response comment:
```json
{
  "handoff_response": {
    "version": "1.0",
    "from": "capture-qa-agent",
    "to": "ops-lead",
    "sourceHandoffIssueId": "BLU-43",
    "outcome": "done",
    "result": { ... },
    "proofLinks": ["https://notion.so/..."],
    "followUpNeeded": false
  }
}
```

**Routing rules:**
- Ops Lead routes to: intake-agent, capture-qa-agent, field-ops-agent, finance-support-agent
- Growth Lead routes to: conversion-agent, analytics-agent, market-intel-agent
- CEO routes to: CTO, Ops Lead, Growth Lead
- CTO routes to: webapp-codex/claude, pipeline-codex/claude, capture-codex/claude
- Any agent can escalate upward to their lead

**Future A2A compliance path:**
When Blueprint needs external agent interop, expose each Paperclip agent as an A2A-compatible endpoint by:
1. Generating Agent Cards from `.paperclip.yaml` agent definitions
2. Mapping Paperclip issue lifecycle to A2A Task states
3. Wrapping the handoff JSON schema as A2A Message parts
This is not needed now but the schema is designed to be compatible.

**Files changed:**
- `ops/paperclip/HANDOFF_PROTOCOL.md` — new file
- All 9 ops/growth skill files — add reference to handoff protocol in their contracts

---

### Gap 8 — Firestore Schema Documentation

**Problem:** Agents reference Firestore collections but no field spec exists. Agents could fail silently if schema changes.

**Design:**

Create `ops/paperclip/FIRESTORE_SCHEMA.md` documenting all collections agents reference:

```
waitlist
├── id: string (auto)
├── email: string
├── deviceType: string (e.g. "iPhone 15 Pro", "iPad Pro M4")
├── deviceOS: string
├── hasLiDAR: boolean
├── region: string
├── source: string (e.g. "website", "referral", "direct")
├── experience: string (e.g. "none", "some", "professional")
├── status: string (e.g. "pending", "invited", "rejected")
├── createdAt: timestamp
├── updatedAt: timestamp
├── notes: string (optional)

inbound_requests
├── id: string (auto)
├── type: string ("buyer" | "site_operator" | "other")
├── contactEmail: string
├── companyName: string (optional)
├── siteType: string (optional)
├── useCase: string
├── message: string
├── status: string ("new" | "qualified" | "responded" | "closed")
├── priority: string ("low" | "medium" | "high")
├── createdAt: timestamp
├── updatedAt: timestamp

capture_submissions
├── id: string (auto)
├── capturerId: string (ref → users)
├── sceneId: string (ref → scenes)
├── captureId: string
├── deviceType: string
├── status: string ("uploaded" | "processing" | "qa_pending" | "qa_passed" | "qa_failed" | "listed")
├── pipelineStatus: string
├── createdAt: timestamp
├── updatedAt: timestamp

support_tickets
├── id: string (auto)
├── source: string ("email" | "contact_form" | "in_app")
├── contactEmail: string
├── subject: string
├── body: string
├── category: string ("billing" | "technical" | "capture" | "general")
├── status: string ("new" | "in_progress" | "resolved" | "closed")
├── assignedTo: string (optional, agent key)
├── createdAt: timestamp
├── updatedAt: timestamp

payout_records
├── id: string (auto)
├── capturerId: string (ref → users)
├── captureId: string (ref → capture_submissions)
├── amount: number (cents)
├── currency: string
├── stripePayoutId: string (optional)
├── status: string ("draft" | "approved" | "processing" | "completed" | "failed")
├── approvedBy: string (human only)
├── createdAt: timestamp
├── updatedAt: timestamp

stripe_events
├── id: string (Stripe event ID)
├── type: string (Stripe event type)
├── processed: boolean
├── processedAt: timestamp (optional)
├── agentAction: string (optional — what the finance agent did)
├── createdAt: timestamp
```

**Note:** This is the expected schema based on what agents reference. It should be verified against actual Firestore collections and updated if fields differ. The schema is documentation, not enforcement — Firestore is schemaless.

**Files changed:**
- `ops/paperclip/FIRESTORE_SCHEMA.md` — new file

---

### Gap 10 — Statistical Rigor for Conversion Agent

**Problem:** The conversion agent contract says "minimum 48hrs measurement period" but has no sample size calculation, power analysis, or confidence interval thresholds.

**Design:**

Add a "Statistical Requirements" section to `ops/paperclip/skills/conversion-agent.md`:

**Minimum sample size:** Before evaluating any experiment, require at least 100 sessions in each variant (control + treatment). If traffic is too low to reach this in 72 hours, extend the measurement period — do not evaluate early.

**Significance threshold:** Use a two-proportion z-test. Require p < 0.05 (95% confidence) before declaring a winner. If the result is not significant after the maximum measurement period (7 days), declare "inconclusive" and move on.

**Effect size minimum:** Only implement changes that show a relative improvement of >= 10% in the primary metric. Small improvements (<10%) are not worth the complexity cost at Blueprint's current scale.

**Guard rail metrics:** Every experiment must also track:
- Buyer signup rate (must not decrease by >5%)
- Inbound request rate (must not decrease by >5%)
- Page load time (must not increase by >500ms)
If any guard rail is violated, revert immediately regardless of primary metric improvement.

**Evaluation protocol:**
1. Wait for minimum sample size (100 sessions per variant)
2. Run two-proportion z-test on primary metric
3. Check guard rail metrics
4. Decision: KEEP (significant improvement + no guard rail violations), REVERT (guard rail violated OR significant degradation), EXTEND (not yet significant, <7 days elapsed), INCONCLUSIVE (not significant after 7 days → revert)

**Files changed:**
- `ops/paperclip/skills/conversion-agent.md` — add statistical requirements section
- `ops/paperclip/programs/conversion-agent-program.md` — reference the new requirements

---

### Gap 11 — Data Retention & GDPR Policy

**Problem:** No deletion schedule for capturer PII in Firestore. Agents handle personal data (emails, names, device info) with no documented retention rules.

**Design:**

Create `ops/paperclip/DATA_RETENTION_POLICY.md`:

**Retention periods:**

| Collection | PII Fields | Retention | Basis |
|-----------|-----------|-----------|-------|
| `waitlist` | email, deviceType, region | 12 months from creation; 30 days after rejection | Legitimate interest (application processing) |
| `inbound_requests` | contactEmail, companyName | 12 months from creation; 30 days after close | Legitimate interest (sales inquiry) |
| `capture_submissions` | capturerId | Indefinite while capture is listed; 90 days after delisting | Contractual (capturer agreement) |
| `support_tickets` | contactEmail, body | 24 months from resolution | Legitimate interest (support history) |
| `payout_records` | capturerId, amount | 7 years (financial/tax records) | Legal obligation |
| `stripe_events` | (no direct PII) | 12 months | Operational |

**Deletion protocol:**
- Finance Support Agent runs monthly scan for records past retention
- Agent flags records for deletion but does not delete (human gate — permanent)
- Human approves batch deletion
- Deletion is logged with timestamp and reason

**Subject access requests (SAR):**
- Any agent receiving a data access or deletion request from a user must escalate immediately to CEO with `escalation` handoff type
- Do not attempt to fulfill SARs automatically in Phase 1

**Agent data handling rules (added to all agent contracts):**
- Do not store PII in Notion, Slack, or issue comments beyond what is needed for the current task
- When referencing a user in a report, use anonymized identifiers (e.g., "capturer-7a3b") not email addresses
- Do not include PII in Slack digests

**Files changed:**
- `ops/paperclip/DATA_RETENTION_POLICY.md` — new file
- All ops agent skill files — add "Data Handling" section referencing the policy

---

## Work Package C: Live Proving (Gaps 1, 2)

### Gap 1 — Bootstrap Tasks BLU-1 through BLU-8

**Problem:** The 8 executive + engineering agent bootstrap tasks have never run. These agents have contracts but haven't executed against them.

**Design:**

Bootstrap tasks should run sequentially in a logical order:

1. **BLU-1: CEO Bootstrap** — CEO agent reads its contract, inspects the org chart, and produces its first daily review draft. Success = a coherent priority list posted to Notion.
2. **BLU-2: CTO Bootstrap** — CTO agent reads its contract, scans all 3 repos for open issues/PRs, and produces its first triage summary. Success = triage summary with prioritized list.
3. **BLU-3: WebApp Codex Bootstrap** — Implementation agent picks up a real open issue and produces a PR or draft. Success = a branch with changes that pass `npm run check`.
4. **BLU-4: WebApp Claude Bootstrap** — Review agent picks up an existing PR and produces a review. Success = a review comment with actionable feedback.
5. **BLU-5: Pipeline Codex Bootstrap** — Same as BLU-3 for BlueprintCapturePipeline.
6. **BLU-6: Pipeline Claude Bootstrap** — Same as BLU-4 for BlueprintCapturePipeline.
7. **BLU-7: Capture Codex Bootstrap** — Same as BLU-3 for BlueprintCapture.
8. **BLU-8: Capture Claude Bootstrap** — Same as BLU-4 for BlueprintCapture.

**Execution:** These must be triggered manually on the droplet via the Paperclip API. The reconcile script ensures contracts are current. Each task should be run, observed, and the issue patched to `done` or `blocked` with the result.

**Pre-requisites:** Work Package A and B should be complete first so that:
- Monitoring alerts on failures (Gap 4)
- Budget tracking starts from bootstrap (Gap 7)
- Phase tracking starts recording metrics (Gap 9)
- Handoff protocol is available if agents need to route work (Gap 6)

---

### Gap 2 — Prove Market Intel Lane End-to-End

**Problem:** Only Analytics Daily is proven. Market Intel is the best next candidate because it uses web search (wired), Notion Knowledge write (proven), and Slack digest (proven).

**Design:**

The Market Intel agent needs the same hybrid discipline as Analytics:

1. **Add a deterministic writer action for market intel** — `market-intel-report` action in the plugin, similar to `analytics-report`. Accepts:
   - `cadence` (daily/weekly)
   - `signals` (array of scored signal objects)
   - `competitorUpdates` (array)
   - `technologyFindings` (array)
   - `recommendedActions` (array)

2. **Update Market Intel agent contract** to follow the same hybrid pattern:
   - Read steering file
   - Investigate dynamically (web search, source scanning)
   - Synthesize into structured payload
   - Call deterministic writer
   - Patch issue to `done`/`blocked`
   - Never end a run without a terminal issue state

3. **Update reconcile script** to build market-intel routine descriptions the same way it builds analytics descriptions.

4. **Run the first Market Intel Daily** on the droplet:
   - Trigger manually
   - Observe the run
   - Verify: Notion Knowledge entry created, Slack `#research` posted, issue lands `done` with proof

**Files changed:**
- `ops/paperclip/plugins/blueprint-automation/src/worker.ts` — add `market-intel-report` action handler
- `ops/paperclip/plugins/blueprint-automation/src/manifest.ts` — add action to manifest
- `ops/paperclip/plugins/blueprint-automation/src/constants.ts` — add action key
- `ops/paperclip/skills/market-intel-agent.md` — add required execution contract (like analytics)
- `scripts/paperclip/reconcile-blueprint-paperclip-company.sh` — add market-intel routine description builder

---

## Implementation Order

```
Phase 1 (parallel):
  Work Package A (plugin infra)     Work Package B (contracts & docs)
  ├─ Gap 5: Reconcile refactor      ├─ Gap 3: Steering files
  ├─ Gap 4: Monitoring               ├─ Gap 6: Handoff protocol
  ├─ Gap 7: Budget enforcement       ├─ Gap 8: Firestore schema
  └─ Gap 9: Phase tracking           ├─ Gap 10: Statistical rigor
                                     └─ Gap 11: Data retention

Phase 2 (sequential, depends on Phase 1):
  ├─ Gap 2: Market Intel deterministic writer + contract update
  └─ Gap 1: Bootstrap BLU-1 through BLU-8

Phase 3 (on droplet):
  ├─ Deploy plugin with new features
  ├─ Run reconcile to sync contracts
  ├─ Trigger Market Intel Daily
  └─ Trigger bootstrap tasks sequentially
```

---

## Out of Scope

- Horizontal scaling / multi-node Paperclip (Phase 3 concern)
- Full A2A HTTP endpoint exposure (future, when external interop needed)
- Auto-promotion of agents between phases (always human-gated)
- Hard budget stops (Phase 2 graduation feature)
