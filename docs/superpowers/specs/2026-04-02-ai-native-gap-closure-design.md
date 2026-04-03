# AI-Native Gap Closure: Full Parity Design Spec

**Date:** 2026-04-02
**Status:** Draft
**Author:** Claude (with founder approval)
**Scope:** 10 remaining gaps between Blueprint's current state and full AI-native autonomous operation

---

## Context

Blueprint's autonomous org infrastructure is ~85% complete. The code surface is built — analytics, email, experiments, creative pipeline, voice, checkout, entitlements, support triage, action executor with safety policies, and 39 Paperclip agent definitions all exist and are tested.

The remaining gaps are activation, scheduling, wiring, and a handful of missing integrations. This spec covers all 10.

---

## Gap 1: Enable Automation Lanes

### Problem
Every `BLUEPRINT_*_ENABLED` env flag defaults to disabled. The code works but nothing runs autonomously.

### Design
- Set all automation flags to `true` in `.env.example` as the new default
- Add a master switch `BLUEPRINT_ALL_AUTOMATION_ENABLED=true` in `server/config/env.ts`
- Resolution logic: if master switch is `true`, all lanes are enabled unless individually set to `false`
- Individual flags still override the master switch (opt-out model)
- Existing Phase 2 safety policies (daily caps, tier-based routing, idempotency) remain as guardrails

### Affected flags
```
BLUEPRINT_ANALYTICS_INGEST_ENABLED
BLUEPRINT_WAITLIST_AUTOMATION_ENABLED
BLUEPRINT_INBOUND_AUTOMATION_ENABLED
BLUEPRINT_SUPPORT_TRIAGE_ENABLED
BLUEPRINT_PAYOUT_TRIAGE_ENABLED
BLUEPRINT_PREVIEW_DIAGNOSIS_ENABLED
BLUEPRINT_EXPERIMENT_AUTOROLLOUT_ENABLED
BLUEPRINT_AUTONOMOUS_RESEARCH_OUTBOUND_ENABLED
BLUEPRINT_CREATIVE_FACTORY_ENABLED
BLUEPRINT_BUYER_LIFECYCLE_ENABLED
BLUEPRINT_SITE_ACCESS_OVERDUE_WATCHDOG_ENABLED
BLUEPRINT_FINANCE_REVIEW_OVERDUE_WATCHDOG_ENABLED
```

### Files modified
- `server/config/env.ts` — add `BLUEPRINT_ALL_AUTOMATION_ENABLED`, add resolver function `isAutomationLaneEnabled(laneEnvKey)`
- `.env.example` — flip all flags to `true`, add master switch

---

## Gap 2: Wire Schedulers for Autonomous Loops

### Problem
Creative factory, research outbound, lifecycle emails, experiment rollout, and SLA watchdog all require manual POST calls. No automated scheduling.

### Design
Register new workers in the existing `opsAutomationScheduler.ts` worker array, following the established `WorkerDefinition` pattern:

| Worker key | Interval | Env flag | Run function |
|------------|----------|----------|-------------|
| `creative_factory` | 24h | `BLUEPRINT_CREATIVE_FACTORY_ENABLED` | `runCreativeAssetFactoryLoop()` |
| `research_outbound` | 6h | `BLUEPRINT_AUTONOMOUS_RESEARCH_OUTBOUND_ENABLED` | `runAutonomousResearchOutboundLoop()` |
| `experiment_rollout` | 4h | `BLUEPRINT_EXPERIMENT_AUTOROLLOUT_ENABLED` | `runExperimentAutoRollout()` |
| `sla_watchdog` | 1h | `BLUEPRINT_SLA_WATCHDOG_ENABLED` (new) | `runSlaWatchdog()` |
| `notion_sync` | 30min | `BLUEPRINT_NOTION_SYNC_ENABLED` (new) | `runNotionBidirectionalSync()` |
| `graduation_eval` | 24h | `BLUEPRINT_ALL_AUTOMATION_ENABLED` | `runGraduationEvaluation()` |

Each worker:
- Checks its enabled flag before executing
- Persists status to Firestore `opsAutomationWorkerStatus` collection
- Has configurable interval, batch size, and startup delay via env vars
- Logs `processedCount` and `failedCount` per run

The existing `buyer_lifecycle` worker in `opsAutomationScheduler.ts` already handles lifecycle emails — no new worker needed for that.

### Files modified
- `server/utils/opsAutomationScheduler.ts` — add 6 new worker definitions to the workers array

### New env vars
```
BLUEPRINT_SLA_WATCHDOG_ENABLED=true
BLUEPRINT_SLA_WATCHDOG_INTERVAL_MS=3600000
BLUEPRINT_NOTION_SYNC_ENABLED=true
BLUEPRINT_NOTION_SYNC_INTERVAL_MS=1800000
BLUEPRINT_CREATIVE_FACTORY_INTERVAL_MS=86400000
BLUEPRINT_RESEARCH_OUTBOUND_INTERVAL_MS=21600000
BLUEPRINT_EXPERIMENT_ROLLOUT_INTERVAL_MS=14400000
BLUEPRINT_GRADUATION_EVAL_INTERVAL_MS=86400000
```

---

## Gap 3: Landing Page A/B Testing

### Problem
Experiment framework and variant assignment exist, but no page components branch on `resolveExperimentVariant()` (except one variant on ExactSiteHostedReview).

### Design
Wire experiment variants into the 3 highest-traffic pages using the existing `resolveExperimentVariant()` from `client/src/lib/experiments.ts`.

**Home.tsx** — experiment key: `home_hero_variant`
- Variant `proof_led` (control): current hero with signal bullets and proof-first messaging
- Variant `speed_led`: hero emphasizes speed/SLA — headline: "Your robot trains on the real site in 72 hours." Replaces signal bullets with SLA-focused bullets. Same CTA buttons.
- Implementation: `useEffect` calls `resolveExperimentVariant('home_hero_variant', ['proof_led', 'speed_led'])` (async — stores result in `useState`, defaults to control variant `proof_led` until resolved to prevent layout shift). Tracks exposure via `analyticsEvents.experimentExposure()`.

**ForRobotIntegrators.tsx** — experiment key: `integrators_value_prop_order`
- Variant `technical_first` (control): current order (use cases → what you get → what to expect)
- Variant `outcome_first`: reorders sections (what to expect → use cases → what you get) — leads with outcomes
- Implementation: variant state controls section render order via a `sectionOrder` array. Same components, different sequence.

**HowItWorks.tsx** — experiment key: `how_it_works_format`
- Variant `steps` (control): current step-by-step text layout
- Variant `video`: replaces the step-by-step section with an embedded proof reel video (from `marketingProof.ts` proof video path) + condensed text below
- Implementation: variant state toggles between the two section implementations.

Each page:
1. Calls `resolveExperimentVariant()` in a `useEffect` on mount
2. Defaults to control variant until resolution completes (no layout shift)
3. Fires `analyticsEvents.experimentExposure()` once per session per experiment
4. The experiment auto-rollout worker (Gap 2) evaluates conversion rates and promotes winners

### Files modified
- `client/src/pages/Home.tsx`
- `client/src/pages/ForRobotIntegrators.tsx`
- `client/src/pages/HowItWorks.tsx`

---

## Gap 4: Agent Graduation Tracking

### Problem
AUTONOMOUS_ORG.md defines graduation paths (read-only → draft → auto-route → full autonomy), but there's no runtime metric tracking for accuracy thresholds that trigger advancement.

### Design

**New file:** `server/utils/agent-graduation.ts`

**Data model** — `agent_graduation_status/{lane}` in Firestore:
```typescript
interface AgentGraduationRecord {
  lane: string;                    // e.g. "waitlist", "inbound", "support"
  currentPhase: 1 | 2 | 3 | 4;    // read-only | draft | auto-route | full autonomy
  metrics: {
    accuracy: number;              // (approved + auto_approved) / total_decisions
    volume: number;                // total actions in evaluation window
    daysInPhase: number;           // days since last promotion
    rejectionRate: number;         // rejected / total_decisions
    failureRate: number;           // failed / total_decisions
  };
  evaluationWindow: number;        // days (default 30)
  lastEvaluatedAt: string;         // ISO timestamp
  recommendation: "hold" | "promote" | "demote" | null;
  recommendationReason: string | null;
  promotedAt: string | null;       // ISO timestamp of last promotion
  promotedBy: string | null;       // "system" or operator email
}
```

**Graduation thresholds:**
| Transition | Accuracy | Volume | Days in phase |
|------------|----------|--------|---------------|
| Phase 1→2 | ≥90% | ≥20 | ≥14 |
| Phase 2→3 | ≥95% | ≥50 | ≥30 |
| Phase 3→4 | ≥98% | ≥100 | ≥60 |

**Demotion thresholds:**
| Condition | Action |
|-----------|--------|
| Accuracy drops below phase minimum by >5% | Recommend demote |
| 3+ rejections in 24h | Recommend demote |
| Failure rate >10% over 7 days | Recommend demote |

**Key functions:**
- `evaluateGraduationStatus(lane)` — queries Firestore `ops_automation_actions` for the lane's last 30 days, computes metrics, writes recommendation
- `runGraduationEvaluation()` — evaluates all lanes, returns summary (called by scheduler)
- `promoteAgentLane(lane, promotedBy)` — advances phase, resets daysInPhase counter
- `demoteAgentLane(lane, demotedBy, reason)` — decrements phase, logs reason

**API routes** (added to `server/routes/admin-agent.ts`):
- `GET /api/admin/agent/graduation` — returns all lanes' graduation status
- `POST /api/admin/agent/graduation/:lane/promote` — human-approved promotion
- `POST /api/admin/agent/graduation/:lane/demote` — human-initiated demotion

**No auto-promotion.** The system writes recommendations. Humans approve via the API or operator console.

### Files
- New: `server/utils/agent-graduation.ts`
- Modified: `server/routes/admin-agent.ts` — add graduation endpoints

---

## Gap 5: Complete OpenAI Responses Adapter

### Problem
Function signatures and tool definitions exist in `openai-responses.ts`, but the implementation needs to be fleshed out for production use.

### Design
Complete `runOpenAIResponsesTask()` to handle the full agent task lifecycle:

**Flow:**
1. Build messages array from `task.input` + startup context (`resolveStartupContext()`)
2. Call OpenAI Responses API with model, tools from `operatorTools`, and structured output instructions
3. Enter tool-calling loop (max 5 iterations, already defined):
   - For each `function_call` in response, dispatch to `runOperatorTool()`
   - Collect tool results, send back as follow-up
4. Extract final JSON output via `extractJsonPayload()` with Zod validation against `task.definition.output_schema`
5. Evaluate `inferRequiresHumanReview()` on the parsed output
6. Return normalized `AgentResult<TOutput>` with status, output, confidence, and review flag

**Tool dispatch** — `runOperatorTool()` maps tool names to existing functions:
| Tool name | Maps to |
|-----------|---------|
| `create_campaign_draft` | `createGrowthCampaignDraft()` from `growth-ops.ts` |
| `run_lifecycle_check` | `runBuyerLifecycleCheck()` from `growth-ops.ts` |
| `build_creative_kit` | `buildCreativeCampaignKit()` from `creative-pipeline.ts` |
| `verify_sendgrid` | `verifySendGridConfig()` from `email.ts` |
| `generate_image` | `generateGoogleImage()` from `google-creative.ts` |
| `generate_openai_image` | `generateOpenAIImage()` from `openai-creative.ts` (Gap 6) — gracefully returns "provider not configured" if `OPENAI_API_KEY` is unset |

**Note:** The `generate_openai_image` tool has a soft dependency on Gap 6. If Gap 6 is not yet deployed, the tool returns a configuration error to the model, which can fall back to `generate_image` (Google).

**Error handling:**
- API errors → retry once with exponential backoff, then fail with classified error
- Tool execution errors → return error message to model as tool result (let it recover)
- Schema validation errors → return raw output with `requires_human_review: true`

### Files modified
- `server/agents/adapters/openai-responses.ts` — complete implementation

---

## Gap 6: GPT-4o Image Generation

### Problem
Only Google GenAI is wired for image generation. No GPT-4o / `gpt-image-1` integration.

### Design

**New file:** `server/utils/openai-creative.ts`

**Interface** (matches `google-creative.ts` pattern):
```typescript
interface OpenAIImageOptions {
  prompt: string;
  size?: "1024x1024" | "1536x1024" | "1024x1536";
  quality?: "low" | "medium" | "high";
}

interface OpenAIImageResult {
  dataUrl: string;          // base64 data URL
  revisedPrompt: string;    // model's revised prompt
}

interface OpenAICreativeStatus {
  configured: boolean;
  available: boolean;
  model: string;            // "gpt-image-1"
  apiKeySource: "OPENAI_API_KEY" | null;
  executionState: ProviderExecutionState;
  note: string;
  lastError: string | null;
}
```

**Key functions:**
- `generateOpenAIImage(options)` — calls OpenAI Images API, returns base64 data URL
- `getOpenAICreativeStatus()` — returns provider health status
- `getOpenAICreativeConfig()` — checks for `OPENAI_API_KEY` env var

**Provider selection in creative factory:**
- New env var: `BLUEPRINT_IMAGE_PROVIDER` — values: `google` (default), `openai`, `both`
- When `both`: generates one image from each provider, creative factory stores both
- Creative factory's `runCreativeAssetFactoryLoop()` updated to check provider setting

**API routes** (added to `server/routes/admin-creative.ts`):
- Existing `POST /api/admin/creative/generate-image` gains optional `provider` param (`google` | `openai`)
- `AdminGrowthStudio.tsx` updated with provider dropdown

### Files
- New: `server/utils/openai-creative.ts`
- Modified: `server/routes/admin-creative.ts` — add provider param
- Modified: `server/utils/creative-factory.ts` — add provider selection
- Modified: `server/utils/provider-status.ts` — add OpenAI creative status
- Modified: `client/src/pages/AdminGrowthStudio.tsx` — add provider dropdown

### New env vars
```
OPENAI_API_KEY=sk-...
BLUEPRINT_IMAGE_PROVIDER=google
```

---

## Gap 7: Agent-Operated Onboarding

### Problem
Post-checkout experience relies on manual provisioning steps, not a guided buyer onboarding.

### Design
On successful payment, the system dispatches an agent-operated onboarding sequence. No new UI — agents send emails through the existing action executor.

**Trigger:** After `markBuyerOrderPaidFromCheckout()` in `stripe-webhooks.ts`, dispatch onboarding task.

**New file:** `server/utils/buyer-onboarding.ts`

**Onboarding sequence** (persisted as `onboarding_sequences/{orderId}`):
```typescript
interface OnboardingSequence {
  orderId: string;
  buyerEmail: string;
  skuName: string;
  licenseTier: string;
  status: "active" | "completed" | "paused";
  steps: OnboardingStep[];
  createdAt: string;
  completedAt: string | null;
}

interface OnboardingStep {
  key: "welcome" | "checkin_day3" | "activation_day7";
  scheduledAt: string;       // ISO timestamp
  sentAt: string | null;
  status: "pending" | "sent" | "skipped";
  emailSubject: string;
  emailBody: string;
}
```

**Sequence steps:**
1. **Welcome (immediate):** Personalized welcome with what was purchased, access instructions, support contact. Action tier: Tier 2 (auto-execute + notify).
2. **Day 3 check-in:** "Have you accessed your data yet?" with quick-start tips. Action tier: Tier 2.
3. **Day 7 activation:** "Here's what other teams do in week one" with case-study-style content. Action tier: Tier 2.

**Key functions:**
- `createOnboardingSequence(order)` — creates sequence with 3 scheduled steps
- `processOnboardingStep(orderId, stepKey)` — generates email via agent task, dispatches through action executor
- `runOnboardingWorker({ limit })` — queries pending steps where `scheduledAt <= now`, processes batch

**Worker registration:** Added to `opsAutomationScheduler.ts` as `onboarding_sequence` worker, interval 1h.

### Files
- New: `server/utils/buyer-onboarding.ts`
- Modified: `server/routes/stripe-webhooks.ts` — dispatch onboarding after payment
- Modified: `server/utils/opsAutomationScheduler.ts` — register onboarding worker

### New env vars
```
BLUEPRINT_ONBOARDING_ENABLED=true
BLUEPRINT_ONBOARDING_INTERVAL_MS=3600000
```

---

## Gap 8: Renewal/Upsell Automation

### Problem
Lifecycle emails go up to "renewal planning" at 90+ days, but there's no automated renewal checkout or expansion offer.

### Design
Extend the existing lifecycle system in `growth-ops.ts` with renewal-specific logic.

**New Firestore collection:** `renewal_tracking/{entitlementId}`
```typescript
interface RenewalTracker {
  entitlementId: string;
  orderId: string;
  buyerEmail: string;
  skuName: string;
  licenseTier: string;
  grantedAt: string;
  renewalWindowOpensAt: string;  // grantedAt + 75 days
  renewalDeadline: string;       // grantedAt + 365 days (or term end)
  status: "not_due" | "outreach_sent" | "at_risk" | "renewed" | "churned";
  outreachHistory: RenewalOutreach[];
  upsellRecommendation: string | null;
  renewalCheckoutUrl: string | null;
}

interface RenewalOutreach {
  type: "renewal_intro" | "renewal_reminder" | "at_risk_escalation" | "upsell_offer";
  sentAt: string;
  emailSubject: string;
  channel: "email" | "ops_queue";
}
```

**Renewal sequence:**
1. **Day 75:** Lifecycle agent generates renewal email with usage summary + parameterized Stripe checkout URL for same SKU/tier. Status → `outreach_sent`. Action tier: Tier 2.
2. **Day 85:** If no renewal checkout completed, status → `at_risk`. Escalation to ops queue. Action tier: Tier 3 (human review).
3. **Day 95:** Final renewal reminder. Action tier: Tier 2.

**Upsell detection:**
- If entitlement usage metadata suggests higher tier need (e.g., multiple download requests, API calls exceeding tier limits), agent drafts upsell message
- Upsell messages always require human review (Tier 3)

**Renewal checkout URL:** Generated via existing `createCheckoutSession()` with pre-filled SKU, license tier, and `renewal_of` metadata pointing to the original order.

**Key functions:**
- `initRenewalTracking(entitlement)` — creates tracker when entitlement is provisioned
- `runRenewalOutreach({ limit })` — queries trackers in renewal window, dispatches appropriate outreach
- Added to existing `buyer_lifecycle` worker logic (not a separate worker)

### Files
- Modified: `server/utils/growth-ops.ts` — add renewal tracking + outreach functions
- Modified: `server/routes/stripe-webhooks.ts` — init renewal tracking on entitlement provisioning

---

## Gap 9: Notion Bidirectional Sync

### Problem
Notion manager agent exists in Paperclip, but full workspace ↔ Firestore reconciliation isn't operational.

### Design

**New file:** `server/utils/notion-sync.ts`

**Sync scope** (using database IDs from `reference_notion_hub.md`):

| Firestore collection | Notion database | Direction | Sync fields |
|---------------------|-----------------|-----------|-------------|
| `growthCampaigns` | Campaigns DB | Firestore → Notion | id, status, channel, subject, sentAt, eventCounts |
| `creative_factory_runs` | Creative Runs DB | Firestore → Notion | id, status, skuName, createdAt, storageUri, error |
| `agent_graduation_status` | Agent Graduation DB | Firestore → Notion | lane, currentPhase, accuracy, volume, recommendation |
| `sla_tracking` | SLA Tracker DB | Firestore → Notion | orderId, stage, deadline, status, escalations |
| Notion Tasks board | `ops_automation` | Notion → Firestore | approved_by, notes, priority_override |

**Conflict resolution:**
- Firestore wins for automated fields (status, metrics, timestamps)
- Notion wins for manual operator fields (approved_by, notes, priority_override)
- Sync uses `lastSyncedAt` timestamp per record to detect changes

**Key functions:**
- `syncFirestoreToNotion()` — reads changed Firestore docs since last sync, upserts to Notion via MCP tools
- `syncNotionToFirestore()` — reads Notion pages modified since last sync, updates Firestore operator fields
- `runNotionBidirectionalSync()` — orchestrates both directions, logs sync results
- `resolveConflict(firestoreDoc, notionPage)` — applies field-level conflict resolution rules

**Notion API access:**
Uses `@notionhq/client` SDK directly (not MCP tools, which are agent-context only). The server already has Notion database IDs from configuration. Key operations:
- `notion.databases.query()` — find existing pages by external ID property
- `notion.pages.update()` — update Notion pages with Firestore data
- `notion.pages.create()` — create new Notion pages for new Firestore records
- `notion.pages.retrieve()` — read Notion pages for Notion→Firestore direction

**New env vars for Notion sync:**
```
NOTION_API_KEY=ntn_...
NOTION_CAMPAIGNS_DB_ID=...
NOTION_CREATIVE_RUNS_DB_ID=...
NOTION_GRADUATION_DB_ID=...
NOTION_SLA_DB_ID=...
NOTION_TASKS_DB_ID=...
```

**Worker registration:** `notion_sync` worker in `opsAutomationScheduler.ts`, interval 30min.

### Files
- New: `server/utils/notion-sync.ts`
- Modified: `server/utils/opsAutomationScheduler.ts` — register notion_sync worker

---

## Gap 10: Fixed-SLA Enforcement

### Problem
ExactSiteHostedReview describes the workflow but there's no SLA timer or escalation logic.

### Design

**New file:** `server/utils/sla-enforcement.ts`

**SLA stages and deadlines:**
| Stage | SLA | Starts when |
|-------|-----|-------------|
| `scoping` | 24h | Contact request with `interest=evaluation-package` created |
| `packaging` | 48h | Scoping completed (ops marks scope approved) |
| `delivery` | 72h | Packaging completed (evidence packaged) |
| `review_setup` | 24h | Delivery completed (hosted review session created) |

**Data model** — `sla_tracking/{orderId}` in Firestore:
```typescript
interface SlaTracker {
  orderId: string;           // or contactRequestId for pre-order
  buyerEmail: string;
  currentStage: "scoping" | "packaging" | "delivery" | "review_setup" | "completed";
  stages: SlaStage[];
  status: "on_track" | "at_risk" | "breached" | "completed";
  createdAt: string;
  completedAt: string | null;
}

interface SlaStage {
  key: string;
  slaHours: number;
  startedAt: string | null;
  deadline: string | null;
  completedAt: string | null;
  status: "pending" | "active" | "completed" | "at_risk" | "breached";
  escalations: SlaEscalation[];
}

interface SlaEscalation {
  type: "warning" | "breach";
  channel: "slack" | "email" | "ops_queue";
  sentAt: string;
  message: string;
}
```

**Watchdog logic** (`runSlaWatchdog()`):
1. Query all `sla_tracking` docs where `status` is not `completed`
2. For each active stage:
   - If elapsed > 80% of SLA: mark `at_risk`, send Slack + email warning
   - If elapsed > 100% of SLA: mark `breached`, escalate to ops queue as Tier 3 (human review)
3. Log watchdog run to `automation_runs` collection

**Trigger points:**
- SLA tracker created when inbound request with `interest=evaluation-package` is processed
- Stage transitions triggered by ops actions (mark scoping complete, mark packaging complete, etc.)
- Completion when hosted review session is created and buyer notified

**API routes** (added to `server/routes/admin-agent.ts` or new `server/routes/admin-sla.ts`):
- `GET /api/admin/sla/status` — all active SLA trackers with current status
- `POST /api/admin/sla/:id/advance` — manually advance to next stage
- `POST /api/admin/sla/:id/complete` — mark SLA completed

### Files
- New: `server/utils/sla-enforcement.ts`
- Modified: `server/routes/inbound-request.ts` — create SLA tracker on evaluation-package requests
- Modified: `server/utils/opsAutomationScheduler.ts` — register sla_watchdog worker (already covered in Gap 2)

---

## New Environment Variables Summary

```bash
# Master automation switch
BLUEPRINT_ALL_AUTOMATION_ENABLED=true

# New workers
BLUEPRINT_SLA_WATCHDOG_ENABLED=true
BLUEPRINT_SLA_WATCHDOG_INTERVAL_MS=3600000
BLUEPRINT_NOTION_SYNC_ENABLED=true
BLUEPRINT_NOTION_SYNC_INTERVAL_MS=1800000
BLUEPRINT_ONBOARDING_ENABLED=true
BLUEPRINT_ONBOARDING_INTERVAL_MS=3600000

# Scheduler intervals (override defaults)
BLUEPRINT_CREATIVE_FACTORY_INTERVAL_MS=86400000
BLUEPRINT_RESEARCH_OUTBOUND_INTERVAL_MS=21600000
BLUEPRINT_EXPERIMENT_ROLLOUT_INTERVAL_MS=14400000
BLUEPRINT_GRADUATION_EVAL_INTERVAL_MS=86400000

# Image generation provider
BLUEPRINT_IMAGE_PROVIDER=google
OPENAI_API_KEY=sk-...

# Notion sync
NOTION_API_KEY=ntn_...
NOTION_CAMPAIGNS_DB_ID=...
NOTION_CREATIVE_RUNS_DB_ID=...
NOTION_GRADUATION_DB_ID=...
NOTION_SLA_DB_ID=...
NOTION_TASKS_DB_ID=...
```

## New Files Summary

| File | Gap | Purpose |
|------|-----|---------|
| `server/utils/agent-graduation.ts` | #4 | Graduation metrics, evaluation, promotion/demotion |
| `server/utils/openai-creative.ts` | #6 | GPT-4o image generation via OpenAI Images API |
| `server/utils/buyer-onboarding.ts` | #7 | Agent-operated onboarding sequence |
| `server/utils/notion-sync.ts` | #9 | Bidirectional Firestore ↔ Notion reconciliation |
| `server/utils/sla-enforcement.ts` | #10 | SLA timers, watchdog, escalation |

## Modified Files Summary

| File | Gaps | Changes |
|------|------|---------|
| `server/config/env.ts` | #1 | Master switch + resolver function |
| `.env.example` | #1, #2, #6, #7 | New env vars, flip defaults to true |
| `server/utils/opsAutomationScheduler.ts` | #2, #7 | 7 new worker definitions |
| `client/src/pages/Home.tsx` | #3 | Experiment variant branching |
| `client/src/pages/ForRobotIntegrators.tsx` | #3 | Section order variant |
| `client/src/pages/HowItWorks.tsx` | #3 | Steps vs video variant |
| `server/routes/admin-agent.ts` | #4 | Graduation API endpoints |
| `server/agents/adapters/openai-responses.ts` | #5 | Complete implementation |
| `server/routes/admin-creative.ts` | #6 | Provider param |
| `server/utils/creative-factory.ts` | #6 | Provider selection |
| `server/utils/provider-status.ts` | #6 | OpenAI creative status |
| `client/src/pages/AdminGrowthStudio.tsx` | #6 | Provider dropdown |
| `server/routes/stripe-webhooks.ts` | #7, #8 | Onboarding dispatch + renewal init |
| `server/utils/growth-ops.ts` | #8 | Renewal tracking + outreach |
| `server/routes/inbound-request.ts` | #10 | SLA tracker creation |

## Testing Strategy

Each gap gets a corresponding test file:
- `server/tests/automation-lane-enablement.test.ts` — master switch resolution
- `server/tests/agent-graduation.test.ts` — metrics computation, thresholds, promotion
- `server/tests/openai-creative.test.ts` — image generation, provider status
- `server/tests/buyer-onboarding.test.ts` — sequence creation, step processing
- `server/tests/renewal-tracking.test.ts` — renewal outreach, upsell detection
- `server/tests/notion-sync.test.ts` — bidirectional sync, conflict resolution
- `server/tests/sla-enforcement.test.ts` — watchdog logic, escalation
- `client/tests/pages/Home.test.tsx` — variant rendering (updated)
- `client/tests/pages/ForRobotIntegrators.test.tsx` — variant rendering (updated)

Existing test files for experiments, creative factory, growth ops, and stripe webhooks are updated to cover new behavior.

## Implementation Order

These 10 gaps decompose into 5 parallel workstreams with no blocking dependencies:

```
Workstream A (config):  Gap 1 → Gap 2 (sequential: env first, then schedulers)
Workstream B (agents):  Gap 4 + Gap 5 (parallel within workstream)
Workstream C (growth):  Gap 3 + Gap 6 (parallel within workstream)
Workstream D (revenue): Gap 7 → Gap 8 → Gap 10 (sequential: onboarding before renewal before SLA)
Workstream E (sync):    Gap 9 (independent)
```

All 5 workstreams can execute in parallel.
