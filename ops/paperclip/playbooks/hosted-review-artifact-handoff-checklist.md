# Hosted Review And Artifact Handoff Checklist

## Purpose
This is the ops-side checklist that backs the hosted review and artifact handoff standard in [BLU-158](/BLU/issues/BLU-158).

Use it when a robot-team buyer is ready to review a real Blueprint package remotely and Ops needs to decide:

- what can be shown now
- how it must be labeled
- what can be handed off asynchronously
- which topics must be escalated instead of implied

## Truth Guardrails
- Treat Firestore and pipeline-backed artifact state as the source of truth.
- Do not present adjacent-site proof as exact-site proof.
- Do not imply that a hosted review replaces on-site validation, deployment signoff, safety review, or final rollout approval.
- Do not promise custom exports, integrations, delivery dates, or permissions unless the owner and evidence are already explicit.
- If the proof path is not ready, frame the motion as scoped follow-up, not ready-now review.

## Source Of Truth Before Sending Anything
Confirm the request is grounded in the current record, not in Slack or memory.

### Required request state
- `inboundRequests.qualification_state` is current and matches the real review posture.
- `inboundRequests.opportunity_state` is current.
- `inboundRequests.buyer_review_access.buyer_review_url` exists if the buyer is being sent a review link.
- `inboundRequests.ops.rights_status` is current.
- `inboundRequests.ops.capture_policy_tier` is current.
- `inboundRequests.ops.capture_status` is current.
- `inboundRequests.ops.quote_status` is current.

### Required supporting state when capture or permissions are still active
- `capture_jobs.site_access.permission_state` is current when operator permission or access is still open.
- `capture_jobs.site_access.overdue_review` is checked before claiming access is on track.
- `capture_jobs.field_ops.dispatch_review` is checked before implying a capture slot, travel plan, or field schedule is already locked.

### Artifact truth
- Only list artifacts that exist in the current pipeline attachment, listing, or hosted-session surface.
- If the proof references package outputs, confirm the relevant artifact URIs actually exist before naming them.
- If the hosted session depends on runtime manifests or launch URLs, confirm those are present and currently reviewable.

## Exact-Site Labeling Decision

### Label as exact-site proof only when all are true
- The artifacts and hosted review are tied to the buyer's actual site or exact requested lane.
- The current package keeps the same site attached across proof materials.
- Capture recency and site-coverage boundaries are known.
- Ops can state what part of the buyer workflow is represented without guessing.

### Label as adjacent-site proof when any are true
- The package shows a similar site, lane, or workflow rather than the buyer's exact site.
- Coverage is representative but not site-identical.
- The hosted review demonstrates structure or workflow shape, not the buyer's actual environment.

### Escalate instead of sending proof when any are true
- Rights status is `permission_required` or `blocked`.
- Capture policy tier is `permission_required` or `not_allowed`.
- The request still needs more evidence before a truthful remote review can happen.
- The only available artifacts would force Ops to imply exact-site coverage that does not exist.

## Remote Review Checklist
Before the buyer receives a hosted review or asynchronous handoff, verify each item below.

### 1. Review posture
- The request is in a reviewable state, typically `qualification_state = qualified_ready`.
- If `opportunity_state` is not `handoff_ready`, state the real posture explicitly instead of implying a completed handoff.
- The buyer's workflow question is stated in plain language.

### 2. Site and coverage label
- The review explicitly says `exact-site` or `adjacent-site`.
- The note includes the covered lane, area, or workflow boundary.
- Recency is included.
- Known missing areas, stale zones, or recapture boundaries are included.

### 3. Hosted review path
- `buyer_review_access.buyer_review_url` is live if a review URL is being sent.
- The hosted path explains what the buyer can inspect remotely right now.
- Any runtime limitations, fallback states, or unavailable session capabilities are labeled plainly.
- The review copy stays grounded in inspection, rerun, export, and failure review, not speculative autonomy claims.

### 4. Artifact handoff contents
- The buyer receives a short list of artifacts that exist now.
- Each artifact is described in terms of review value, not hype.
- The handoff says which items are already reviewable asynchronously and which require a live walkthrough.
- The handoff says what fits into the buyer's existing stack now and what would require extra packaging or integration work.

### 5. Rights, privacy, and commercialization
- Rights status is stated truthfully.
- Privacy and consent boundaries are included when relevant.
- Any customer-specific sharing or commercialization limits are called out before handoff.
- If rights or permissions are still under human review, that is called out as an open gate.

### 6. Human-gated topics
- Pricing and commercial terms are not implied unless a human owner has already taken them forward.
- Site access, operator approvals, and permissions are not implied unless already cleared.
- Delivery timing is not implied unless the delivery owner and dependency state are explicit.
- Rollout claims, deployment readiness, and signoff language are not implied from a hosted review alone.

## What Ops Can Truthfully Hand Off Now
- Review URL or hosted walkthrough path that already exists.
- Capture provenance and recency summary.
- Exact-site or adjacent-site label.
- Current artifact list from pipeline-backed outputs or listing metadata.
- Current compatibility statement for how the buyer can inspect the output now.
- Clear note of missing evidence, extra packaging, or required follow-up.

## What Requires Escalation Or Scoped Follow-Up
- New capture commitments or recapture promises.
- Site-operator outreach, permission exceptions, or access negotiations.
- Custom artifact exports or buyer-specific packaging not already present.
- Integration promises into the buyer's stack.
- Rollout planning, deployment approval, or field-travel commitments.
- Contracting, commercialization, privacy exceptions, or billing.

## Suggested Artifact Categories For The Handoff Note
Only include categories that are actually present for the request.

- hosted review link
- walkthrough or rollout video
- capture provenance summary
- package manifest or runtime manifest
- export bundle
- compatibility matrix
- opportunity handoff summary
- rights and compliance summary

## Minimum Handoff Note Template
Use this structure when Ops sends the review package.

1. Site label: exact-site or adjacent-site.
2. Workflow covered: the concrete lane, task, or runtime question.
3. Review now: what the buyer can inspect remotely today.
4. Artifacts included: only the outputs that already exist.
5. Boundaries: recency, missing areas, privacy limits, or rights limits.
6. Follow-up required: extra capture, packaging, integration, approvals, or human commercial handling.
7. Human owner: who takes the next step for pricing, site access, delivery coordination, or rollout questions.

## Exit Criteria
The hosted review and artifact handoff are ready only when:

- the request record reflects the real review posture
- the proof is labeled exact-site or adjacent-site without ambiguity
- the buyer can see what exists now without guessing
- open human gates are explicit
- Ops has not promised anything that depends on unstated capture, permissions, packaging, or rollout work
