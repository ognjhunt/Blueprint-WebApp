# Phase 2 Autonomous Ops — Design & Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Blueprint's autonomous org from Phase 1 (draft-and-route) to Phase 2 (auto-execute low-risk reversible actions, human-gate everything else).

**Architecture:** Add an action executor layer between the existing draft-producing agent tasks and external systems. Each lane gets an explicit safety policy. A new `action_ledger` Firestore collection provides idempotent, auditable action tracking. The existing `ops_automation` envelope on each document gains `phase2_action_state` fields.

**Tech Stack:** TypeScript, Firebase/Firestore, Nodemailer SMTP, Google Calendar API, Google Sheets API, Slack Webhooks, OpenClaw/OpenAI Responses runtime (migration path to Anthropic Agent SDK noted).

---

## Table of Contents

1. [Capability Matrix](#1-capability-matrix)
2. [Phase 2 Control Model](#2-phase-2-control-model)
3. [Proposed Architecture](#3-proposed-architecture)
4. [Workstream Plan](#4-workstream-plan)
5. [Weekly Operating Impact](#5-weekly-operating-impact)
6. [Not Included](#6-not-included)

---

## 1. Capability Matrix

### 1.1 Waitlist Invite / Reject / Follow-up

| Dimension | Current State |
|---|---|
| **Status** | Draft-only. `waitlist-triage.ts` produces recommendation + draft email. `workflows.ts` writes `ops_automation.draft_email`, `ops_automation.recommendation`, `ops_automation.automation_confidence` to `waitlistSubmissions` doc. Email is never sent. |
| **Executable?** | No. Draft email sits in Firestore. No code path calls `sendEmail()` with the draft. |
| **Missing code paths** | 1) Action executor that reads draft from `ops_automation`, evaluates safety policy, calls `sendEmail()`. 2) Firestore status transition from `draft_ready` → `sending` → `sent` or `failed`. 3) Idempotency key on send to prevent double-send on retry. |
| **Human-gate policy (Phase 2)** | Auto-send: `invite_now` with confidence ≥ 0.85 AND market_fit ≥ 70. Human-review: `decline_for_now`, `request_follow_up` with confidence < 0.85, any `hold_for_market`, any submission flagged `requires_human_review`. |
| **External systems** | SMTP (already configured in `email.ts`). |
| **Audit/idempotency** | Need: action_ledger doc per send attempt with `idempotency_key = waitlist:{submissionId}:{recommendation}:{draft_hash}`. Prevent re-send if ledger doc exists with `status: sent`. |

### 1.2 Inbound Buyer Follow-up

| Dimension | Current State |
|---|---|
| **Status** | Draft-only for qualification follow-up. `inbound-qualification.ts` produces `buyer_follow_up_draft` (subject + body). `workflows.ts` writes it to `inboundRequests` doc under `ops_automation`. Separately, `inbound-request.ts` route already sends a generic confirmation email + Slack notification on initial submit — that is Phase 2-ready. |
| **Executable?** | Generic confirmation: yes (already sends). Qualification-driven follow-up: no (draft only). |
| **Missing code paths** | 1) Action executor for qualification follow-up email send. 2) Guard: only auto-send when `qualification_state_recommendation` is `needs_more_evidence` or `submitted` (safe states). 3) Block auto-send for `qualified_ready`, `qualified_risky`, `escalated_*` (binding commercial decisions). |
| **Human-gate policy (Phase 2)** | Auto-send: follow-up asking for more info when confidence ≥ 0.80 and recommendation is `needs_more_evidence` or `submitted`. Human-review: any `qualified_*`, `escalated_*`, `not_ready_yet`, or confidence < 0.80. |
| **External systems** | SMTP (exists). Slack (exists). |
| **Audit/idempotency** | Need: `idempotency_key = inbound:{requestId}:{qualification_state}:{draft_hash}`. |

### 1.3 Support Replies

| Dimension | Current State |
|---|---|
| **Status** | Draft-only. `support-triage.ts` produces `suggested_response` (subject + body), category, queue, priority. `workflows.ts` writes to `contactRequests` doc under `ops_automation`. Response is never sent. |
| **Executable?** | No. |
| **Missing code paths** | 1) Action executor that sends `suggested_response` via email. 2) Safety policy: only auto-send for `general_support` and `qualification_follow_up` categories. 3) Template validation — ensure response doesn't contain placeholder text. |
| **Human-gate policy (Phase 2)** | Auto-send: `general_support` with confidence ≥ 0.85. Auto-send: `qualification_follow_up` with confidence ≥ 0.85. Human-review: `billing_question`, `technical_issue`, `mapping_reschedule`, `sales_follow_up`, any `priority: high`, confidence < 0.85. |
| **External systems** | SMTP (exists). |
| **Audit/idempotency** | Need: `idempotency_key = support:{contactRequestId}:{category}:{draft_hash}`. |

### 1.4 Post-Signup Scheduling

| Dimension | Current State |
|---|---|
| **Status** | **Already Phase 2.** `post-signup-actions.ts` executes: Google Calendar event creation, confirmation email send, Slack notification, Google Sheets update. `post-signup-workflows.ts` orchestrates: runs scheduling agent → reads action plan → executes matching actions. |
| **Executable?** | Yes. This is the only lane that already auto-executes. |
| **Missing code paths** | 1) Action ledger logging (currently fire-and-forget with no durable audit trail). 2) Retry on partial failure (e.g., calendar created but email failed). 3) Idempotency guard to prevent duplicate calendar events on re-run. |
| **Human-gate policy (Phase 2)** | Already auto-executes all planned actions. Should add: block execution if `requires_human_review: true` from scheduling agent (currently ignored). |
| **External systems** | Google Calendar API, Google Sheets API, SMTP, Slack (all configured). |
| **Audit/idempotency** | Need: action_ledger docs per action. Calendar dedup by `{blueprintId}:{calendar_title}:{date}`. |

### 1.5 Capturer Reminders / Comms

| Dimension | Current State |
|---|---|
| **Status** | **Not implemented.** `field-ops-agent.md` skill doc describes scheduling, reminders, and capturer notifications, but there is no corresponding task definition, workflow, or action executor in `server/agents/tasks/` or `server/utils/`. No `capturer_comms` task. No reminder scheduler. Grep for `capturer.*remind`, `capturer.*notif`, `capturer.*comm` returns zero hits in server code. |
| **Executable?** | No. Nothing exists. |
| **Missing code paths** | Everything: 1) Task definition for capturer communication drafting. 2) Firestore model for capturer contact info and communication preferences. 3) Action executor for email/SMS to capturers. 4) Reminder scheduling logic (capture date - N days). 5) Workflow integration with `capture_jobs` and `creatorCaptures` collections. |
| **Human-gate policy (Phase 2)** | Auto-send: standard reminders (48h and 24h before capture), confirmation of schedule. Human-review: reschedule requests, cancellations, any message about pay/rights/access. |
| **External systems** | SMTP (exists for email). SMS not configured — would need Twilio or similar. Calendar API (exists). |
| **Audit/idempotency** | Need: full action_ledger integration. `idempotency_key = capturer_comm:{captureJobId}:{comm_type}:{scheduled_date}`. |

### 1.6 Simple Reschedules

| Dimension | Current State |
|---|---|
| **Status** | **Not implemented as autonomous workflow.** `post-signup-actions.ts` can create calendar events but has no update/reschedule capability. `post-signup-scheduling.ts` task produces a schedule plan but doesn't handle modification of existing events. No Google Calendar update/delete code exists. |
| **Executable?** | No. |
| **Missing code paths** | 1) Google Calendar event update helper (patch existing event). 2) Reschedule task definition that takes existing booking + new time → produces updated plan. 3) Workflow that finds existing calendar event ID and patches it. 4) Confirmation email for reschedule. |
| **Human-gate policy (Phase 2)** | Auto-reschedule: time changes within same day, within business hours, initiated by buyer. Human-review: date changes, capturer-initiated reschedules, reschedules that conflict with other bookings. |
| **External systems** | Google Calendar API (exists for create, needs update). SMTP (exists). |
| **Audit/idempotency** | Need: action_ledger with `old_event_id` and `new_event_id` for rollback capability. |

### 1.7 Payout / Dispute Handling

| Dimension | Current State |
|---|---|
| **Status** | Draft-only, intentionally human-gated. `payout-exception-triage.ts` always sets `requires_human_review: true`. Explicitly states "Never authorize or execute funds movement." `workflows.ts` writes disposition + queue to `creatorPayouts` doc. `stripe-webhooks.ts` handles payment state changes but is webhook-driven, not agent-driven. |
| **Executable?** | No, by design. |
| **Missing code paths** | For Phase 2: 1) Queue routing automation (auto-assign to correct human reviewer based on disposition). 2) Notification to assigned reviewer. 3) SLA tracking for review response time. The actual payout execution stays manual. |
| **Human-gate policy (Phase 2)** | **Always human.** No auto-execution of funds movement. Phase 2 improvement is only: auto-route to correct queue + notify reviewer + track SLA. |
| **External systems** | Stripe (exists for webhook handling). Slack for reviewer notification (exists). |
| **Audit/idempotency** | Stripe webhook dedup already exists (`beginStripeWebhookEvent`). Need: reviewer assignment logging. |

### 1.8 Site-Access / Permission Resolution

| Dimension | Current State |
|---|---|
| **Status** | **Not implemented.** `field-ops-agent.md` describes site-access and permission resolution as a concept, but there is no state machine, workflow, task definition, or data model for tracking operator outreach, permission status, or access negotiation. The `capture_jobs` collection has no permission-state fields. |
| **Executable?** | No. Nothing exists. |
| **Missing code paths** | Everything: 1) Data model for site-access requests (operator contact, permission status, outreach history). 2) Task definition for operator outreach drafting. 3) Outreach action executor (email to site operators). 4) State machine: `not_started` → `outreach_sent` → `awaiting_response` → `granted` / `denied` / `conditional`. 5) Escalation logic when no response within SLA. |
| **Human-gate policy (Phase 2)** | **Always human for judgment calls.** Auto-send: initial templated outreach email to known operator contacts. Human-review: follow-up if no response, negotiation of conditions, any denial handling, any legal/liability language. |
| **External systems** | SMTP (exists). Potentially needs operator contact database (does not exist). |
| **Audit/idempotency** | Need: full outreach history per capture job. `idempotency_key = site_access:{captureJobId}:{operatorId}:{outreach_type}`. |

### Summary Matrix

| Lane | Sends Today? | Draft Exists? | Task Def? | Action Executor? | Phase 2 Auto-Send? | Phase 2 Human Gate? |
|---|---|---|---|---|---|---|
| Waitlist invite/reject | No | Yes | Yes | **No** | Invites w/ high confidence | Declines, low confidence |
| Inbound follow-up | Generic confirm only | Yes | Yes | **No** | Info requests w/ high confidence | Commercial decisions |
| Support replies | No | Yes | Yes | **No** | General support, high confidence | Billing, legal, technical |
| Post-signup scheduling | **Yes** | Yes | Yes | **Yes** | Already auto | Add human-review gate |
| Capturer comms | No | No | **No** | **No** | Standard reminders | Reschedule/cancel/pay |
| Simple reschedules | No | No | **No** | **No** | Same-day time changes | Date changes, conflicts |
| Payout/disputes | No | Yes | Yes | **No (by design)** | Never | Always human |
| Site-access/perms | No | No | **No** | **No** | Initial templated outreach | All judgment calls |

---

## 2. Phase 2 Control Model

### 2.1 Risk Classification

Every autonomous action is classified into one of three tiers:

**Tier 1 — Auto-Execute (low-risk, reversible)**
- Sending templated/drafted emails where the draft was produced by a triage agent with confidence ≥ threshold
- Creating or updating calendar events for confirmed bookings
- Sending Slack notifications to internal channels
- Updating internal Firestore status fields
- Sending standard capturer reminders for confirmed captures
- Routing queue items to the correct human reviewer
- Retrying previously-successful workflow patterns that failed transiently

**Tier 2 — Auto-Execute with Notification (medium-risk, reversible but notable)**
- Sending qualification follow-up emails to buyers (reversible: can send correction)
- Sending initial site-access outreach to known operators
- Auto-rescheduling within same-day windows
- Sending support responses for general inquiries

**Tier 3 — Human Approval Required (high-risk, irreversible, or sensitive)**
- Any action involving money: payouts, refunds, disputes, billing adjustments
- Decline/rejection communications (reputational risk, not easily reversed)
- Any action touching rights, licensing, privacy, or compliance
- Communications with legal or contractual implications
- Actions where agent confidence is below threshold
- Capturer cancellations or complex reschedules
- Site-access negotiation, denial handling, conditional access terms
- Any action the triage agent flagged `requires_human_review: true`
- Any action where `automation_status: "blocked"`
- Edge cases: unusual request patterns, first-time scenarios for a lane

### 2.2 Confidence Thresholds

| Lane | Auto-Send Threshold | Human-Review Below |
|---|---|---|
| Waitlist invite | ≥ 0.85 confidence AND market_fit ≥ 70 | < 0.85 or market_fit < 70 |
| Inbound follow-up | ≥ 0.80 confidence | < 0.80 |
| Support reply | ≥ 0.85 confidence | < 0.85 |
| Capturer reminder | N/A (templated, always send) | N/A |
| Reschedule | N/A (rule-based, not confidence) | Complex reschedules |

### 2.3 Approval State Machine

Each action progresses through these states:

```
draft_ready → [policy check] → auto_approved | pending_approval
auto_approved → executing → sent | failed
pending_approval → operator_approved → executing → sent | failed
pending_approval → operator_rejected → rejected
failed → [retry policy] → executing (max 3 retries)
```

**Firestore representation** — new fields on `ops_automation` envelope:

```typescript
interface Phase2ActionState {
  action_state: "draft_ready" | "auto_approved" | "pending_approval" |
                "operator_approved" | "operator_rejected" | "executing" |
                "sent" | "failed" | "rejected";
  action_tier: 1 | 2 | 3;
  action_type: string;          // e.g., "send_email", "create_calendar", "update_status"
  auto_approve_reason?: string; // why policy allowed auto-execution
  approval_requested_at?: Timestamp;
  approval_resolved_at?: Timestamp;
  approval_resolved_by?: string; // operator email or "system:auto"
  rejection_reason?: string;
  execution_attempts: number;
  last_execution_at?: Timestamp;
  last_execution_error?: string;
  idempotency_key: string;
  action_ledger_ref?: string;   // doc ID in action_ledger collection
}
```

### 2.4 Operator Override Logging

Every operator action on a Phase 2 item is logged:

```typescript
interface OperatorOverride {
  id: string;                    // auto-generated
  source_collection: string;     // e.g., "waitlistSubmissions"
  source_doc_id: string;
  action_type: string;
  original_recommendation: string;
  operator_decision: "approved" | "rejected" | "modified";
  operator_email: string;
  operator_reason?: string;      // optional free-text
  modified_action?: object;      // if operator changed the draft before sending
  timestamp: Timestamp;
}
```

Stored in `action_ledger` collection with subcollection `overrides`.

### 2.5 Safety Rails

1. **Kill switch per lane:** Environment variable `BLUEPRINT_PHASE2_{LANE}_ENABLED` (e.g., `BLUEPRINT_PHASE2_WAITLIST_AUTOSEND_ENABLED`). Disabled = all actions fall back to Phase 1 (draft-only).
2. **Daily volume cap:** Max auto-sends per lane per day (configurable). Exceeding cap → all remaining items go to human review.
3. **Content safety check:** Before auto-sending any email, validate: no placeholder text (`{{`, `[TODO]`, `[NAME]`), subject not empty, body > 50 chars, recipient email valid.
4. **Rollback capability:** For Tier 2 actions, the action executor must record enough state to send a correction/retraction if needed.

---

## 3. Proposed Architecture

### 3.1 New Files

#### `server/agents/action-executor.ts` — Core Phase 2 action execution engine

Responsibilities:
- Accept a drafted action + safety policy → evaluate tier → auto-execute or queue for approval
- Call the appropriate outbound channel (email, calendar, Slack, sheets)
- Write action_ledger doc before and after execution
- Enforce idempotency via ledger lookup
- Enforce daily volume caps
- Enforce content safety checks

```typescript
// Key exports
export async function executeAction(params: {
  sourceCollection: string;
  sourceDocId: string;
  actionType: ActionType;
  actionPayload: ActionPayload;
  safetyPolicy: LaneSafetyPolicy;
  draftConfidence: number;
  draftRecommendation: string;
  idempotencyKey: string;
}): Promise<ActionResult>;

export async function retryFailedAction(ledgerDocId: string): Promise<ActionResult>;

export type ActionType = "send_email" | "create_calendar_event" | "update_calendar_event" |
  "send_slack" | "update_sheet" | "update_firestore_status" | "route_to_queue";

export interface LaneSafetyPolicy {
  lane: string;
  autoApproveCriteria: (draft: DraftOutput) => boolean;
  alwaysHumanReview: (draft: DraftOutput) => boolean;
  maxDailyAutoSends: number;
  contentChecks: boolean;
}
```

#### `server/agents/action-policies.ts` — Per-lane safety policy definitions

```typescript
export const WAITLIST_POLICY: LaneSafetyPolicy = {
  lane: "waitlist",
  autoApproveCriteria: (draft) =>
    draft.recommendation === "invite_now" &&
    draft.confidence >= 0.85 &&
    (draft.scores?.market_fit ?? 0) >= 70 &&
    !draft.requires_human_review,
  alwaysHumanReview: (draft) =>
    draft.recommendation === "decline_for_now" ||
    draft.requires_human_review === true ||
    draft.automation_status === "blocked",
  maxDailyAutoSends: 50,
  contentChecks: true,
};

// Similar for: INBOUND_POLICY, SUPPORT_POLICY, CAPTURER_COMMS_POLICY,
// RESCHEDULE_POLICY, PAYOUT_POLICY (always human), SITE_ACCESS_POLICY
```

#### `server/agents/tasks/capturer-comms.ts` — New task definition

Draft capturer communications: reminders, confirmations, schedule updates.

```typescript
// Input: capture job data, communication type, capturer contact info
// Output: draft message (subject + body), communication_type, send_channel (email/sms),
//         scheduled_send_time, requires_human_review
```

#### `server/agents/tasks/site-access-outreach.ts` — New task definition

Draft site-access outreach messages to property operators.

```typescript
// Input: capture job data, site info, operator contact, outreach_type (initial/follow_up)
// Output: draft message, outreach_type, requires_human_review (always true for follow-ups)
```

#### `server/agents/tasks/reschedule.ts` — New task definition

Evaluate reschedule request and produce updated schedule.

```typescript
// Input: existing booking data, requested change, reason
// Output: new_time, calendar_event_update, confirmation_email_draft,
//         requires_human_review (true if date change or conflict)
```

#### `server/utils/calendar-update.ts` — Google Calendar update/patch helper

```typescript
export async function updateCalendarEvent(params: {
  eventId: string;
  calendarId: string;
  updates: { summary?: string; start?: string; end?: string; description?: string };
}): Promise<{ updated: boolean; error?: string }>;
```

### 3.2 Changed Files

#### `server/agents/workflows.ts`

**Changes:**
- After each triage task writes its draft to Firestore, call `executeAction()` with the draft + lane policy
- Add new workflow functions: `runCapturerCommsLoop()`, `runSiteAccessOutreachLoop()`, `runRescheduleLoop()`
- Add action execution step to: `runWaitlistAutomationLoop()`, `runInboundQualificationLoop()`, `runSupportTriageLoop()`

**Pattern (waitlist example):**
```typescript
// After existing draft write...
const actionResult = await executeAction({
  sourceCollection: "waitlistSubmissions",
  sourceDocId: submission.id,
  actionType: "send_email",
  actionPayload: {
    to: submission.email,
    subject: triageResult.draft_email.subject,
    body: triageResult.draft_email.body,
  },
  safetyPolicy: WAITLIST_POLICY,
  draftConfidence: triageResult.confidence,
  draftRecommendation: triageResult.recommendation,
  idempotencyKey: `waitlist:${submission.id}:${triageResult.recommendation}:${hashDraft(triageResult.draft_email)}`,
});
// Write actionResult back to ops_automation.phase2_action_state
```

#### `server/utils/opsAutomationScheduler.ts`

**Changes:**
- Add three new workers: `capturer_comms` (interval 10min), `site_access_outreach` (interval 15min), `reschedule` (interval 5min)
- Add env flags: `BLUEPRINT_CAPTURER_COMMS_ENABLED`, `BLUEPRINT_SITE_ACCESS_ENABLED`, `BLUEPRINT_RESCHEDULE_ENABLED`

#### `server/routes/post-signup-workflows.ts`

**Changes:**
- Add action_ledger writes around each action in `executePostSignupActions()`
- Add idempotency check before calendar creation
- Respect `requires_human_review` from scheduling agent (currently ignored)

#### `server/routes/admin-leads.ts`

**Changes:**
- Add endpoints for Phase 2 approval queue:
  - `GET /api/admin/approval-queue` — items in `pending_approval` state across all lanes
  - `POST /api/admin/approve-action/:ledgerId` — approve a pending action
  - `POST /api/admin/reject-action/:ledgerId` — reject with reason
  - `GET /api/admin/action-ledger` — audit log view with filters

#### `client/src/pages/AdminLeads.tsx`

**Changes:**
- Add "Approval Queue" tab showing pending Phase 2 actions
- Each item shows: lane, source doc, draft content, confidence, recommendation, action type
- Approve / Reject / Edit-and-Approve buttons
- Add "Action Log" tab showing recent auto-executed and human-approved actions

### 3.3 Firestore Schema Additions

#### New collection: `action_ledger`

```
action_ledger/{ledgerId}
  ├── idempotency_key: string (unique index)
  ├── lane: string
  ├── action_type: string
  ├── action_tier: number (1, 2, 3)
  ├── source_collection: string
  ├── source_doc_id: string
  ├── action_payload: map (email content, calendar data, etc.)
  ├── draft_confidence: number
  ├── draft_recommendation: string
  ├── status: "pending" | "auto_approved" | "pending_approval" | "executing" |
  │           "sent" | "failed" | "rejected"
  ├── auto_approve_reason: string | null
  ├── approved_by: string | null (operator email or "system:auto")
  ├── approved_at: timestamp | null
  ├── rejected_by: string | null
  ├── rejected_reason: string | null
  ├── execution_attempts: number
  ├── last_execution_at: timestamp | null
  ├── last_execution_error: string | null
  ├── sent_at: timestamp | null
  ├── created_at: timestamp
  ├── updated_at: timestamp
  └── overrides/ (subcollection)
      └── {overrideId}
          ├── operator_email: string
          ├── decision: string
          ├── reason: string
          ├── original_payload: map
          ├── modified_payload: map | null
          └── timestamp: timestamp
```

**Indexes needed:**
- `(lane, status, created_at)` — approval queue queries
- `(idempotency_key)` — unique, for dedup
- `(source_collection, source_doc_id)` — lookup by source
- `(status, lane, created_at)` — daily volume cap counting

#### New fields on existing collections

On `waitlistSubmissions`, `inboundRequests`, `contactRequests` docs — extend `ops_automation`:

```
ops_automation.phase2_action_state: string
ops_automation.phase2_action_tier: number
ops_automation.phase2_action_ledger_ref: string
ops_automation.phase2_sent_at: timestamp | null
```

#### New collection: `site_access_requests`

```
site_access_requests/{requestId}
  ├── capture_job_id: string
  ├── site_address: string
  ├── operator_name: string | null
  ├── operator_email: string | null
  ├── operator_phone: string | null
  ├── permission_state: "not_started" | "outreach_sent" | "awaiting_response" |
  │                     "granted" | "denied" | "conditional" | "expired"
  ├── outreach_history: array of { type, sent_at, channel, message_hash, ledger_ref }
  ├── conditions: string | null
  ├── granted_at: timestamp | null
  ├── denied_at: timestamp | null
  ├── sla_deadline: timestamp (e.g., 72h from first outreach)
  ├── escalation_count: number
  ├── created_at: timestamp
  └── updated_at: timestamp
```

#### New collection: `capturer_comms`

```
capturer_comms/{commId}
  ├── capture_job_id: string
  ├── capturer_id: string
  ├── comm_type: "reminder_48h" | "reminder_24h" | "confirmation" | "reschedule_notice" | "custom"
  ├── channel: "email" | "sms"
  ├── status: "scheduled" | "draft_ready" | "sent" | "failed"
  ├── scheduled_send_at: timestamp
  ├── sent_at: timestamp | null
  ├── message_subject: string
  ├── message_body: string
  ├── ledger_ref: string | null
  ├── created_at: timestamp
  └── updated_at: timestamp
```

### 3.4 Retry / Idempotency Logic

**Idempotency model:**
1. Before executing any action, query `action_ledger` for matching `idempotency_key`
2. If found with `status: sent` → skip (already sent)
3. If found with `status: failed` and `execution_attempts < 3` → retry
4. If found with `status: failed` and `execution_attempts >= 3` → escalate to human
5. If not found → create ledger doc with `status: pending`, then proceed

**Retry semantics:**
- Max 3 attempts per action
- Exponential backoff: 1min, 5min, 15min (handled by scheduler re-runs, not in-process waits)
- On retry, increment `execution_attempts`, update `last_execution_at`
- After 3 failures, set `status: failed` permanently, create Slack alert to ops channel

**Email-specific idempotency:**
- Hash of `{to}:{subject}:{body_first_500_chars}` as part of idempotency key
- Prevents re-sending identical content even if triggered from different code paths

### 3.5 Provider Model Issue

**First-class issue: All structured automation tasks currently depend on `openai_responses` provider.**

Every task definition in `server/agents/tasks/` sets `default_provider: "openai_responses"`. The runtime connectivity check in `runtime-connectivity.ts` requires `OPENAI_API_KEY` to be set. The `openai-responses.ts` adapter directly imports the `openai` npm package.

Meanwhile, the broader Paperclip org runs local subscription-backed auth with Claude/Codex failover, and `runtime.ts` already supports `anthropic_agent_sdk` and `acp_harness` adapters.

**Proposed migration path:**

1. **Phase 2 ships with `openai_responses` as-is.** The action executor layer is provider-agnostic — it receives drafted outputs and executes actions. The provider choice only affects draft generation quality, not action safety.

2. **Parallel: Add `anthropic_agent_sdk` model configs to each task definition.** Each task already has a `models` map keyed by provider. Add:
   ```typescript
   models: {
     openai_responses: { model: process.env.OPENCLAW_DEFAULT_MODEL || "openai/gpt-5.4" },
     anthropic_agent_sdk: { model: process.env.ANTHROPIC_DEFAULT_MODEL || "claude-sonnet-4-6" },
   }
   ```

3. **Add provider selection logic in `runtime.ts`:** Try preferred provider (Anthropic) → fall back to OpenAI → fail if neither configured. This matches the Paperclip failover pattern.

4. **Remove hard `OPENAI_API_KEY` requirement from `runtime-connectivity.ts`:** Make it check for *any* configured provider, not specifically OpenAI.

5. **Timeline:** Provider migration is independent of Phase 2 action execution. Can ship in parallel or after.

---

## 4. Workstream Plan

### Workstream 1: Action Ledger & Executor Foundation

**Goal:** Build the core `action_ledger` collection, `action-executor.ts`, `action-policies.ts`, and admin approval API endpoints. This is the foundation everything else builds on.

**Files to create:**
- `server/agents/action-executor.ts`
- `server/agents/action-policies.ts`

**Files to change:**
- `server/routes/admin-leads.ts` (add approval queue endpoints)
- `client/src/pages/AdminLeads.tsx` (add approval queue + action log tabs)

**Firestore additions:**
- `action_ledger` collection with indexes

**Key risks:**
- Firestore index creation can be slow in production — deploy indexes first
- Approval queue UI must handle concurrent operator access (two operators approving same item)

**Validation:**
- Unit tests for `executeAction()` with all three tiers
- Unit tests for idempotency (duplicate key rejection)
- Unit tests for daily volume cap enforcement
- Unit tests for content safety checks
- Integration test: draft → auto-approve → send → ledger written
- Integration test: draft → pending_approval → operator approve → send

**Rollout:** Deploy Firestore indexes and collection first. Deploy action-executor as dormant code (no callers yet). Deploy admin UI behind feature flag.

**Ships independently:** Yes. No behavior change until workflows call executeAction().

### Workstream 2: Waitlist & Inbound Auto-Send

**Goal:** Wire waitlist and inbound qualification workflows to the action executor so drafted emails auto-send when policy allows.

**Files to change:**
- `server/agents/workflows.ts` (add executeAction calls after draft writes)
- `server/utils/opsAutomationScheduler.ts` (add Phase 2 env flags)

**Key risks:**
- Sending real emails to real waitlist applicants — needs staging validation
- Draft quality from triage agent may produce embarrassing content — content safety checks critical

**Validation:**
- Test with `BLUEPRINT_PHASE2_WAITLIST_AUTOSEND_ENABLED=false` → no behavior change
- Test with enabled + mock email transport → ledger written, email "sent" in test
- Test confidence below threshold → routed to approval queue
- Test decline recommendation → always routed to approval queue
- Staging dry-run: enable with real data, real drafts, but email transport pointing to internal-only mailbox

**Rollout:**
1. Deploy with env flag OFF
2. Enable in staging with internal mailbox
3. Monitor 1 week of draft quality + approval queue behavior
4. Enable in production with low daily cap (10/day)
5. Increase cap after 2 weeks of clean operation

**Ships independently:** Yes, after Workstream 1.

### Workstream 3: Support Auto-Reply

**Goal:** Wire support triage workflow to auto-send responses for general support with high confidence.

**Files to change:**
- `server/agents/workflows.ts` (add executeAction call in support triage loop)

**Key risks:**
- Support responses go to paying customers/prospects — quality bar is highest
- Misclassified billing issue sent a general response = bad

**Validation:**
- Same pattern as Workstream 2: env flag, staging dry-run, low cap
- Additional: manual review of first 50 auto-sent support responses

**Rollout:** Same graduated rollout as Workstream 2. Start with daily cap of 5.

**Ships independently:** Yes, after Workstream 1.

### Workstream 4: Post-Signup Hardening

**Goal:** Add action ledger, idempotency, and human-review gate to the existing post-signup action execution.

**Files to change:**
- `server/routes/post-signup-workflows.ts` (add ledger writes, idempotency checks, human-review gate)
- `server/utils/post-signup-actions.ts` (add calendar dedup check)

**Key risks:**
- Existing working flow — changes must not break it
- Calendar dedup needs careful handling (what if summary changed but same booking?)

**Validation:**
- Existing `post-signup-actions.test.ts` must continue passing
- New tests: duplicate calendar prevention, ledger audit trail, human-review blocking

**Rollout:** Deploy as enhancement to existing flow. No env flag needed — purely additive safety.

**Ships independently:** Yes, can ship before or after Workstream 1 (ledger writes are optional enhancement).

### Workstream 5: Capturer Comms Engine

**Goal:** Build the capturer communication task, workflow, scheduler worker, and action execution.

**Files to create:**
- `server/agents/tasks/capturer-comms.ts`
- Capturer comms workflow function in `server/agents/workflows.ts`

**Files to change:**
- `server/utils/opsAutomationScheduler.ts` (add capturer_comms worker)
- `server/agents/workflows.ts` (add `runCapturerCommsLoop()`)

**Firestore additions:**
- `capturer_comms` collection

**Dependencies:** Workstream 1 (action ledger), capture_jobs must have capturer contact info (verify this exists).

**Key risks:**
- Capturer contact info may not be consistently available in `capture_jobs` or `creatorCaptures`
- SMS channel requires new integration (Twilio or similar) — email-only for Phase 2
- Reminder timing depends on accurate capture dates in Firestore

**Validation:**
- Unit tests for capturer-comms task definition
- Integration test: capture job with date in 48h → reminder scheduled → sent
- Test: capture job with no capturer email → skip with warning

**Rollout:**
1. Start email-only (no SMS)
2. Deploy with manual trigger first (admin UI button)
3. Enable scheduler after 2 weeks of manual operation

**Ships independently:** Yes, after Workstream 1. Can ship in parallel with Workstreams 2-3.

### Workstream 6: Simple Reschedules

**Goal:** Build reschedule capability for calendar events.

**Files to create:**
- `server/utils/calendar-update.ts`
- `server/agents/tasks/reschedule.ts`

**Files to change:**
- `server/agents/workflows.ts` (add `runRescheduleLoop()`)
- `server/utils/opsAutomationScheduler.ts` (add reschedule worker)

**Dependencies:** Workstream 1, Workstream 4 (post-signup must store calendar event IDs in Firestore for later update).

**Key risks:**
- Need to store Google Calendar event IDs at creation time (currently not stored)
- Google Calendar API update requires the original event ID + calendar ID
- Conflict detection requires querying other bookings (not just Calendar API)

**Validation:**
- Unit test: same-day time change → auto-approved → calendar updated
- Unit test: date change → routed to human approval
- Integration test with Google Calendar API sandbox

**Rollout:** Deploy after Workstream 4 confirms calendar event IDs are being stored.

**Ships independently:** Yes, after Workstreams 1 and 4.

### Workstream 7: Site-Access Permissions Workflow

**Goal:** Build the site-access outreach state machine and initial templated outreach.

**Files to create:**
- `server/agents/tasks/site-access-outreach.ts`

**Files to change:**
- `server/agents/workflows.ts` (add `runSiteAccessOutreachLoop()`)
- `server/utils/opsAutomationScheduler.ts` (add site_access worker)
- `client/src/pages/AdminLeads.tsx` (add site-access status view)

**Firestore additions:**
- `site_access_requests` collection

**Dependencies:** Workstream 1. Also requires product decision: where does operator contact info come from?

**Key risks:**
- **Biggest blocker is product, not code.** There is no operator contact database. Someone must define: how are operators identified? Where are their emails stored? Is this manual data entry or pulled from a property database?
- Initial outreach is auto-sendable but everything after requires human judgment
- SLA tracking for operator response needs careful timezone handling

**Validation:**
- Unit test: state machine transitions
- Integration test: outreach sent → status updated → SLA timer started
- Manual test: full cycle with test operator email

**Rollout:** Start with manual operator contact entry in admin UI. Auto-send initial outreach only. All follow-up remains human.

**Ships independently:** Yes, after Workstream 1. Can ship in parallel with other workstreams.

### Workstream 8: Payout/Dispute Queue Routing

**Goal:** Auto-route payout exceptions to the correct human reviewer with notifications and SLA tracking. No auto-execution of funds.

**Files to change:**
- `server/agents/workflows.ts` (add reviewer assignment after payout triage)
- `server/utils/slack.ts` (add reviewer notification helper)

**Dependencies:** Workstream 1 (for ledger logging of routing decisions).

**Key risks:** Low — this is routing, not execution. Misrouting to wrong reviewer is annoying but not dangerous.

**Validation:**
- Unit test: disposition → correct queue → correct reviewer notified
- Test: SLA exceeded → escalation notification sent

**Rollout:** Deploy immediately after Workstream 1. No graduated rollout needed.

**Ships independently:** Yes.

### Workstream 9: Provider Migration Path

**Goal:** Add Anthropic Agent SDK as fallback/primary provider for all task definitions.

**Files to change:**
- All files in `server/agents/tasks/` (add `anthropic_agent_sdk` model config)
- `server/agents/runtime.ts` (add provider preference/fallback logic)
- `server/agents/runtime-connectivity.ts` (remove hard OPENAI_API_KEY requirement)

**Dependencies:** None — fully independent of Phase 2 action execution.

**Key risks:**
- Different provider may produce different draft quality/format — need output schema validation
- Anthropic Agent SDK adapter (`anthropic-agent-sdk.ts`) may need updates for latest SDK

**Validation:**
- Run each task against both providers with same input → compare output schema conformance
- Existing tests must pass with either provider configured

**Rollout:** Deploy provider configs. Switch one low-risk lane (preview_diagnosis) first. Monitor. Expand.

**Ships independently:** Yes. Fully independent.

### Workstream 10: Tests & Rollout Gates

**Goal:** Comprehensive test coverage for Phase 2 behavior.

**Files to create:**
- `server/tests/action-executor.test.ts`
- `server/tests/action-policies.test.ts`
- `server/tests/phase2-waitlist-autosend.test.ts`
- `server/tests/phase2-support-autoreply.test.ts`
- `server/tests/phase2-approval-queue.test.ts`
- `server/tests/capturer-comms.test.ts`

**Rollout gates (must pass before enabling each lane in production):**
1. All unit tests pass
2. Integration tests pass against Firestore emulator
3. 1 week of staging dry-run with internal-only email transport
4. Manual review of first N auto-sent items (N varies by lane)
5. Daily volume cap set conservatively (10-20% of typical daily volume)
6. Ops lead sign-off on approval queue UX
7. Kill switch tested (disable env flag → immediate fallback to draft-only)

**Ships independently:** Tests ship with each workstream.

### Dependency Graph

```
Workstream 1 (Foundation)
    ├── Workstream 2 (Waitlist/Inbound auto-send)
    ├── Workstream 3 (Support auto-reply)
    ├── Workstream 4 (Post-signup hardening)
    │       └── Workstream 6 (Reschedules)
    ├── Workstream 5 (Capturer comms)
    ├── Workstream 7 (Site-access)
    ├── Workstream 8 (Payout routing)
    └── Workstream 10 (Tests — ships with each)

Workstream 9 (Provider migration) — independent, parallel track
```

---

## 5. Weekly Operating Impact

### What Gets Sent Automatically (Post Phase 2)

**Monday–Friday, the system will:**

- **Waitlist invites:** Auto-send invite emails to high-confidence, high-market-fit applicants. Expected: 5-15 per day, depending on waitlist volume. Operator sees these in the action log, not the approval queue.
- **Inbound follow-ups:** Auto-send "we need more info" emails to buyers whose qualification needs more evidence. Expected: 3-8 per day. Binding qualification decisions still queued for human.
- **Support responses:** Auto-reply to general support inquiries with high-confidence responses. Expected: 2-5 per day initially (conservative cap).
- **Post-signup actions:** Continue auto-executing calendar events, confirmation emails, Slack posts, sheet updates (already happening today — now with audit trail).
- **Capturer reminders:** Auto-send 48h and 24h reminders before confirmed captures. Expected: volume tracks capture schedule.
- **Queue routing:** Auto-route payout exceptions, support tickets, and waitlist items to correct human reviewer queues with Slack notifications.
- **Site-access outreach:** Auto-send initial templated outreach to known operator contacts. Expected: low volume (1-3 per week).

### What Still Waits for Human Approval

**The operator's daily review queue will contain:**

- Waitlist declines and low-confidence invites (expect 5-10 per day)
- Inbound qualification decisions for `qualified_ready`, `qualified_risky`, `escalated_*` (expect 2-5 per day)
- Support responses for billing, technical, legal issues (expect 1-3 per day)
- All payout exception dispositions (expect 1-5 per week)
- Capturer reschedule/cancellation communications (expect 1-3 per week)
- Site-access follow-ups and negotiation (expect 1-2 per week)
- Any item where agent confidence was below threshold
- Any item flagged `requires_human_review` by the triage agent

### What the Operator Should Expect

1. **New daily routine:** Check the Approval Queue tab in AdminLeads 2-3 times daily. Items are prioritized by SLA deadline.
2. **Action log review:** Skim the Action Log weekly for anomalies in auto-sent content.
3. **Kill switch awareness:** Know how to disable any lane via env var if quality degrades.
4. **Volume monitoring:** Watch daily auto-send counts. Unusual spikes may indicate upstream data issues.
5. **Override logging:** Every approval/rejection is logged. Patterns in overrides inform future policy tuning.

### Expected Time Savings

- **Before Phase 2:** Operator manually reviews and sends/acts on every item across all lanes. Estimated: 2-4 hours/day of queue processing.
- **After Phase 2:** Operator reviews only gated items (maybe 30-50% of previous volume). Estimated: 1-2 hours/day. Remaining time shifts to quality oversight and edge case handling.

---

## 6. Not Included

### Explicitly Outside Phase 2 Scope

1. **Payout execution.** Agents will never auto-execute funds movement. Triage and routing only. Stripe payouts remain human-initiated through existing admin flows.

2. **Refund processing.** Same as payouts — triage and recommendation only.

3. **Dispute responses.** Draft and route to human reviewer. No auto-response to Stripe disputes or buyer complaints involving money.

4. **Legal/compliance signoff.** Any action touching rights, licensing, privacy, consent, or legal terms requires human review. This includes: creator rights agreements, data deletion requests, GDPR/CCPA responses, NDA-adjacent communications.

5. **Site-access negotiation.** Initial templated outreach is auto-sendable. Everything after (follow-ups, condition negotiation, denial handling, liability discussions) remains human-only. The state machine tracks status, but humans make all judgment calls.

6. **SMS/push notifications.** Phase 2 is email and Slack only. SMS to capturers (Twilio integration) is Phase 3.

7. **Multi-step autonomous workflows.** Phase 2 executes single actions (send one email, update one calendar event). Chained sequences (send email → wait for reply → send follow-up) remain human-orchestrated.

8. **Dynamic template generation.** All auto-sent content is drafted by the triage agent for the specific item. No shared templates with variable substitution. If template-based sending is desired, it's a Phase 3 feature.

9. **CRM/external system writes beyond what exists today.** Google Sheets updates for post-signup are the extent. No HubSpot, Salesforce, or external CRM integration.

10. **Automated A/B testing of agent-drafted content.** Conversion agent experiments with email subject lines or response variants are Phase 3.

### Docs That Overstate Capability

| Document | Claim | Reality |
|---|---|---|
| `field-ops-agent.md` | Describes scheduling, reminders, capturer notifications as capabilities | Zero implementation in server code. No task, no workflow, no action executor. |
| `AUTONOMOUS_ORG.md` | Lists 13 agent roles with triggers and outputs | Only 7 have task definitions. Field ops, analytics, market intel, conversion, growth lead, and capture QA have skill docs but no executable task code. Analytics and market intel agents operate via Paperclip plugin, not the in-repo automation runtime. |
| `FIRESTORE_SCHEMA.md` | Documents 6 ops collections | Does not document the `ops_automation` envelope shape that all workflows depend on. Missing: `agentSessions`, `agentRuns` collections used by runtime. |
| `HANDOFF_PROTOCOL.md` | Defines structured handoff JSON schema | No code in this repo implements the handoff protocol. It's a spec for Paperclip agents, not for the webapp's automation runtime. |
| `intake-agent.md` | "Phase 2 → 3: auto-approve low-risk invites" | Phase 2 as designed here auto-sends invites but does not auto-approve in the sense of bypassing all review. The triage agent's confidence + policy check is the gate, not a blanket "low-risk" label. |

### Biggest Non-Code Blocker

**Site-access/permission resolution depends on a product decision that hasn't been made:** where does operator contact information come from? There is no operator database, no operator CRM, no intake form for operators. Until someone defines the operator data model and ingestion path, the site-access workflow has no one to send outreach to. This is a product/ops decision, not an engineering blocker.

### Provider Model Tension

The structured automation runtime runs on `openai_responses` via `OPENAI_API_KEY`. The broader Paperclip org uses subscription-backed Claude/Codex with failover. These are currently separate auth models. Phase 2 action execution is provider-agnostic (it receives drafts, not generates them), so this tension does not block Phase 2 rollout. However, the long-term provider migration (Workstream 9) should be prioritized to unify the auth model and reduce operational surface area.
