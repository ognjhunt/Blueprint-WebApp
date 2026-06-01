# Structured Intake Triage And Calendar-Second Optimizer

Date: 2026-05-31
Status: Spec for local implementation and fixture-backed validation
Owner: ops-lead
Primary surfaces: `/contact`, `/api/inbound-request`, `/requests/:requestId`, `/admin/leads`

## Purpose

Blueprint request flows must collect enough structured truth to route a buyer or site-operator request before asking for calendar time. The optimizer is not a calendar scheduler. It is a deterministic triage layer that decides:

- what structured fields are still missing
- which agent lane owns the first response
- what buyer proof is needed before any package, hosted review, rights, payment, provider, or fulfillment claim
- whether a call is not needed yet, optional, recommended, or required before movement
- what local fixture should prove the rule without production writes, sends, Notion, Slack, or calendar mutation

This extends the implemented baseline in `docs/structured-intake-calendar-second-plan-2026-04-27.md` and the Paperclip contract in `ops/paperclip/programs/structured-intake-calendar-second-contract.md`.

## Source Anchors

- Doctrine: `AGENTS.md`, `PLATFORM_CONTEXT.md`, `WORLD_MODEL_STRATEGY_CONTEXT.md`, `AUTONOMOUS_ORG.md`
- Claim boundaries: `docs/architecture/source-of-truth-map.md`, `docs/architecture/public-display-ready-claims-matrix.md`
- Command safety: `docs/architecture/command-safety-matrix.md`
- Shared request contracts: `server/types/inbound-request.ts`, `client/src/types/inbound-request.ts`
- Deterministic intake decision: `client/src/lib/structuredIntake.ts`
- URL and agent draft helpers: `client/src/lib/contactRequestPrefill.ts`
- Request submission: `client/src/components/site/ContactForm.tsx`, `client/src/pages/Contact.tsx`, `server/routes/inbound-request.ts`
- Operator display: `client/src/pages/RequestConsole.tsx`, `client/src/pages/AdminLeads.tsx`, `server/routes/requests.ts`, `server/routes/admin-leads.ts`

`server/routes/contact.ts` is a legacy contact path with Firestore and email side effects. New structured-intake work should not route primary buyer intake through that endpoint.

## Non-Goals

- No production Firestore writes.
- No email, Slack, SendGrid, Gmail, Notion, Stripe, Render, provider, Paperclip live, or calendar mutation.
- No claim that `proof_ready_intake` means package proof exists.
- No claim that `site_claim_access_boundary_ready` means approval, rights clearance, commercialization permission, buyer readiness, or site listing eligibility.
- No AI-owned final decision, send, access grant, rights clearance, quote, provider job, hosted-session fulfillment, payment, payout, or city activation.

## Current Flow Summary

1. `/contact` builds a request-first page with a primary text input, request path selector, catalog-local suggestions, and a detailed intake form.
2. `client/src/lib/contactRequestPrefill.ts` normalizes human and agent-friendly URLs into buyer type, request path, commercial request path, site, location, workflow, robot, and proof-path defaults.
3. `client/src/components/site/ContactForm.tsx` validates required first-pass fields and posts `InboundRequestPayload` to `/api/inbound-request`.
4. `server/routes/inbound-request.ts` normalizes lanes, buyer type, request path, proof path, location metadata, and display-capture metadata, then calls `evaluateStructuredIntake`.
5. The server persists `structured_intake`, `ops_automation`, `queue_key`, `queue_tags`, `human_review_required`, and default ops proof-path milestones. In development with no Firebase Admin, it writes a local JSONL fallback and skips notifications.
6. `/requests/:requestId` and `/admin/leads` display the structured route, calendar summary, proof-path summary, missing fields, and next action.

Important safety detail: when live Firebase Admin is configured, `/api/inbound-request` can write Firestore, send Slack/email notifications, run inbound qualification, and run lead enrichment. This spec must be validated through mocked or dev-fallback tests only.

## Deterministic Intake Schema

All request triage should be expressible as `structured_intake_triage_v1`.

```ts
type StructuredIntakeTriageV1 = {
  schema_version: "structured_intake_triage_v1";
  source: {
    request_id: string;
    source_page_url: string;
    request_path: "world_model" | "hosted_evaluation" | "capture_access" | "site_claim";
    buyer_type: "robot_team" | "site_operator";
    requested_lanes: Array<
      "qualification" |
      "preview_simulation" |
      "deeper_evaluation" |
      "managed_tuning" |
      "data_licensing"
    >;
  };
  normalized_request: {
    site_name: string;
    site_location: string;
    target_site_type: string | null;
    task_statement: string;
    target_robot_team: string | null;
    proof_path_preference:
      | "exact_site_required"
      | "adjacent_site_acceptable"
      | "need_guidance"
      | null;
    operating_constraints: string | null;
    privacy_security_constraints: string | null;
    capture_rights: string | null;
    derived_scene_permission: string | null;
    dataset_licensing_permission: string | null;
    payout_eligibility: string | null;
    human_gate_topics: string | null;
  };
  structured_intake: StructuredIntakeSummary;
  proof_needs: {
    buyer_scope_needed: string[];
    package_proof_needed: string[];
    hosted_review_proof_needed: string[];
    rights_privacy_needed: string[];
    payment_entitlement_needed: string[];
    provider_runtime_needed: string[];
    capture_provenance_needed: string[];
  };
  agent_work: {
    owner_lane:
      | "intake-agent"
      | "buyer-solutions-agent"
      | "site-operator-partnership-agent"
      | "rights-provenance-agent"
      | "revenue-ops-pricing-agent";
    draft_role:
      | "missing_field_clarification"
      | "proof_path_triage"
      | "operator_boundary_clarification"
      | "scoped_call_preparation"
      | "standard_quote_support";
    allowed_draft_actions: string[];
    forbidden_actions: string[];
  };
  calendar_second: {
    disposition:
      | "not_needed_yet"
      | "eligible_optional"
      | "recommended"
      | "required_before_next_step";
    reason_codes: string[];
    first_next_action: string;
    calendar_copy_allowed: boolean;
    calendar_mutation_allowed: false;
  };
};
```

The source of truth for `StructuredIntakeSummary` remains the existing shared contract in `server/types/inbound-request.ts` and `client/src/types/inbound-request.ts`. The optimizer must not create a second enum set with different values.

## Deterministic Triage Algorithm

1. Normalize request path.
   - `site_operator` always resolves to `site_claim`.
   - `hosted-review`, `hosted-evaluation`, or `hosted-session` URL hints resolve to `hosted_evaluation`.
   - `new-capture`, `request-capture`, or `capture-access` URL hints resolve to `capture_access`.
   - robot-team package/data lanes default to `world_model`.

2. Validate minimum structured payload.
   - All requests require request id, contact identity, company, email, budget bucket, and task statement.
   - Robot-team requests require role title, one of exact site/location/site class, and proof path preference.
   - Site-operator requests require site name and site location.

3. Run `evaluateStructuredIntake`.
   - Missing fields stay explicit as machine keys plus display labels.
   - `calendar_disposition` is derived from field completeness, robot-team exact-site/high-budget signals, and operator rights/privacy/commercialization boundaries.
   - `filter_tags` and `recommended_path` are derived, not AI-selected.

4. Derive owner lane.
   - `intake-agent`: incomplete raw intake or missing-field clarification.
   - `buyer-solutions-agent`: proof-ready robot-team intake, exact-site or adjacent-site proof path, or high-intent scoped buyer follow-up.
   - `site-operator-partnership-agent`: operator site claim, access boundary, or site participation path.
   - `rights-provenance-agent`: any rights, privacy, consent, commercialization, retention, or release ambiguity that would affect access or release.
   - `revenue-ops-pricing-agent`: standard quote-band support only after buyer-solutions has a qualified buyer path.

5. Derive buyer proof needs from request path.
   - `world_model`: capture provenance, package/artifact readiness, rights/privacy posture, package access or entitlement state, and buyer scope.
   - `hosted_evaluation`: all `world_model` needs plus hosted-session/runtime availability and review-room access state.
   - `capture_access`: site specificity, lawful access, rights/privacy boundary, capture feasibility, and whether an existing package is a better first step.
   - `site_claim`: operator identity, facility, access rules, privacy/security boundary, rights/control posture, commercialization preference, and human checkpoint when boundaries affect movement.

6. Generate draft constraints.
   - The deterministic record may feed an AI draft, but the AI draft is advisory.
   - The draft may ask for missing fields, summarize the requested proof path, prepare a scoped-call agenda, or create an internal handoff summary.
   - The draft must not send itself, mutate live state, promise access, clear rights, quote non-standard pricing, create a provider job, start a hosted session, or mark a request complete.

## Qualification-Support Boundaries

Qualification is support evidence only. It may measure intake completeness and route fit, but it cannot become product truth by itself.

| Field or outcome | Allowed meaning | Not allowed meaning |
|---|---|---|
| `proof_ready_outcome=proof_ready_intake` | The request has enough structured buyer/site/task/proof-path context for buyer-solutions triage. | Package proof exists, hosted review is ready, rights are clear, provider execution finished, payment succeeded, or fulfillment started. |
| `proof_path_outcome=exact_site` | The buyer asked for an exact-site proof path and supplied enough exact-site context for intake. | The exact site is captured, package-ready, entitled, or live-hosted. |
| `proof_path_outcome=adjacent_site` | The buyer accepts adjacent-site proof for first triage. | Adjacent proof is sufficient for deployment, safety, procurement, or production use. |
| `site_operator_claim_outcome=site_claim_access_boundary_ready` | Operator/site/access/privacy details are specific enough to route. | Operator approval, rights clearance, listing approval, commercialization permission, or buyer access is granted. |
| `calendar_disposition=recommended` | A scoped call may accelerate a concrete request. | Calendar booking qualifies the buyer or replaces missing proof. |
| `calendar_disposition=required_before_next_step` | A human checkpoint is needed before access, rights, privacy, or commercialization movement. | The site is approved or the next operational step is already authorized. |

## Agent Routing And Drafting Role

The optimizer should produce a first response mode, not a final business decision.

`intake-agent`

- Drafts missing-field clarification.
- Uses `missing_structured_field_labels`, `proof_path_summary`, and `calendar_summary`.
- Does not include a Calendly-first CTA when `calendar_disposition=not_needed_yet`.

`buyer-solutions-agent`

- Owns qualified robot-team journeys after deterministic intake.
- Drafts proof-path triage, buyer proof needs, and a scoped call agenda only when `calendar_disposition` is `recommended` or `eligible_optional`.
- Treats package access, hosted review, provider execution, and rights clearance as blocked until backing records exist.

`site-operator-partnership-agent`

- Owns facility/access/commercialization framing.
- Drafts boundary clarification or site participation follow-up.
- Must not imply site-operator approval is always required for lawful public capture or package creation.

`rights-provenance-agent`

- Owns ambiguous rights/privacy/commercialization questions.
- Drafts blocker summaries and evidence asks.
- Must fail closed on clearance claims.

`revenue-ops-pricing-agent`

- Supports standard quote-band handling after buyer path qualification.
- Does not own initial intake triage and does not bypass buyer-solutions.

## Calendar-Second Handoff

The calendar handoff is a consequence of structured truth, not a replacement for it.

| Disposition | First action | Calendar copy | Calendar mutation |
|---|---|---|---|
| `not_needed_yet` | Ask for missing structured fields or continue asynchronous triage. | Do not lead with booking. | Never. |
| `eligible_optional` | Continue async review; offer a call only as secondary. | Allowed as a secondary option. | Never from this optimizer. |
| `recommended` | Prepare a scoped agenda tied to exact site, workflow, robot stack, proof path, or budget signal. | Allowed with exact reason. | Never from this optimizer. |
| `required_before_next_step` | Route human checkpoint before access, rights, privacy, or commercialization movement. | Allowed as required checkpoint language. | Never from this optimizer. |

Done condition: an intake issue is not handled because a calendar link exists. It is handled only when the owning issue records missing fields requested, qualified buyer handoff, proof-ready intake, operator/access handoff, rights/privacy blocker routing, scoped call reason, explicit hold/no-fit recommendation, or equivalent evidence from the structured record.

## Local Fixture Plan

All fixtures must run without live Firebase Admin, Slack, email, Notion, provider, Stripe, Render, Paperclip, or calendar credentials.

### Unit fixtures

Target: `client/tests/lib/structuredIntake.test.ts`

- `robot_exact_site_complete`: robot-team, exact-site, task, stack, site, budget, and deeper-evaluation lane produce `proof_ready_intake`, `exact_site`, score `100`, and `calendar_disposition=recommended`.
- `robot_missing_stack`: robot-team request without robot/stack produces `needs_clarification`, missing `robot_or_stack`, `calendar_disposition=not_needed_yet`, owner `intake-agent`.
- `robot_adjacent_site_complete`: adjacent-site request with target site class produces `proof_ready_intake`, `adjacent_site`, no exact-site fields required, owner `buyer-solutions-agent`, calendar secondary.
- `operator_boundary_defined`: site operator with access and privacy boundary produces `site_claim_access_boundary_ready`, `access_boundary_defined`, human review required when rights/privacy/commercialization boundary is named.
- `operator_missing_privacy_boundary`: site operator with access but no privacy boundary produces `site_claim_needs_access_boundary`, secondary calendar, and a boundary clarification next action.

### Server route fixtures

Target: `server/tests/inbound-request.test.ts`

- Development with mocked `dbAdmin=null` writes only `/tmp/blueprint-dev-inbound-requests.jsonl`, returns `201`, and does not call email or Slack mocks.
- Production with mocked `dbAdmin=null` fails closed with `500` and no dev fallback file.
- Agent-friendly location-only hosted-review URL persists `proof_ready_intake` without setting capture, quote, proof-pack, hosted-review, payment, or fulfillment milestones.
- Operator rights/privacy case persists `calendar_disposition=required_before_next_step` and `human_review_required=true`.
- Invalid proof path or missing robot-team proof-path fields returns validation error before any write.

### Operator display fixtures

Targets:

- `client/tests/pages/RequestConsole.test.tsx`
- `client/tests/pages/AdminLeads.test.tsx`

Assertions:

- Request Console shows structured route, calendar summary, proof path summary, and missing fields without implying operational proof.
- Admin Leads shows owner lane, recommended path, human review status, proof path summary, and missing fields.
- Fixtures include one operator claim and one robot-team proof-path request.
- UI copy keeps package files, provider previews, hosted sessions, payments, and fulfillment blocked until backing records support them.

### Negative controls

- Calendar-only lead with missing structured fields cannot become `recommended` or `required_before_next_step` solely because a meeting link exists.
- AI draft text cannot become a send, Firestore update, rights clearance, quote, hosted-session launch, provider job, or Paperclip mutation.
- Legacy `/api/contact` fixture is not accepted as structured-intake proof unless converted into `InboundRequestPayload`.
- `proof_ready_intake` fixture cannot set `ops.proof_path.proof_pack_delivered_at`, `hosted_review_ready_at`, `hosted_review_started_at`, `artifact_handoff_delivered_at`, or `human_commercial_handoff_at`.
- Site-operator access-boundary fixture cannot set rights status to `verified` or capture policy to `approved_capture`.

## Safe Local QA Commands

Use targeted local tests first:

```bash
npm exec vitest run client/tests/lib/structuredIntake.test.ts server/tests/inbound-request.test.ts client/tests/pages/RequestConsole.test.tsx client/tests/pages/AdminLeads.test.tsx
```

Use TypeScript check when the implementation or contract types change:

```bash
npm run check
```

Do not use `npm run smoke:launch`, live `/api/inbound-request` probes, Gmail/Slack/Notion/calendar commands, Render commands, provider commands, Stripe commands, or production Paperclip commands for this optimizer.

## Acceptance Criteria

- The deterministic schema preserves the existing request enums and shared `StructuredIntakeSummary`.
- The first response is derived from structured fields and proof needs before any calendar CTA.
- Agent drafting remains advisory, local, and reviewable.
- Buyer proof needs stay separate from intake completeness.
- Calendar is never treated as qualification, proof, fulfillment, or issue closeout.
- Local fixtures include positive and negative controls for robot-team, site-operator, proof-path, and calendar-only cases.
- Verification evidence is local test output only; no production Firestore, emails, Slack, Notion, or calendar side effects are used.
