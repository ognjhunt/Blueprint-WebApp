# Field Ops First-Assignment Site-Facing Trust Gate

## Purpose
This is the field-ops-owned gate for deciding what a first-assignment capturer needs before showing up at a site where legitimacy questions may arise.

Use it after the capturer trust checklist in [capturer-authorization-identity-duplicate-checklist.md](/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/playbooks/capturer-authorization-identity-duplicate-checklist.md) and before any first assignment is treated as site-ready.

This gate is about field credibility and escalation discipline. It is not a permission grant, legal opinion, or guarantee that the schedule is fully confirmed.

## Truth Guardrails
- Treat `capture_jobs.site_access` as the authority on permission state, contact path, restrictions, and human-only boundaries.
- Treat `capture_jobs.field_ops.capturer_assignment` and `capture_jobs.field_ops.dispatch_review` as assignment heuristics, not proof that the capturer is cleared to represent Blueprint on site.
- Do not let a trust artifact imply site permission, legal clearance, privacy clearance, or guaranteed access if the record does not already say that.
- Do not tell a first-assignment capturer to negotiate conditions, answer rights questions, or improvise legitimacy claims at the door.

## Source Of Truth Before First Assignment
Review the current capture-job record before deciding the path.

### Field ops state to check
- `capture_jobs.field_ops.capturer_assignment`
- `capture_jobs.field_ops.dispatch_review.review_state`
- `capture_jobs.field_ops.dispatch_review.manual_confirmation_required`
- `capture_jobs.field_ops.dispatch_review.calendar_availability_verified`
- `capture_jobs.field_ops.dispatch_review.travel_time_verified`
- `capture_jobs.field_ops.dispatch_review.missing_inputs`

### Site access state to check
- `capture_jobs.site_access.permission_state`
- `capture_jobs.site_access.workflow_stage`
- `capture_jobs.site_access.operator_contact`
- `capture_jobs.site_access.review_requirements.required_evidence`
- `capture_jobs.site_access.review_requirements.negotiation_required`
- `capture_jobs.site_access.human_only_boundary`
- `capture_jobs.site_access.follow_up_due_at`
- `capture_jobs.site_access.overdue_review`

## Default Decision Rule
Make the trust call in this order:

1. Is site access already clearly confirmed for the real job?
2. Will the capturer have to answer operator-facing legitimacy questions on arrival?
3. Is there a named Blueprint contact and a truthful escalation path if the site pushes back?
4. Are there unresolved site conditions, privacy restrictions, or missing evidence that a capturer should not handle alone?

If any answer is uncertain, keep the job human-gated.

## Decision Table

### Path A: Internal Field-Ready Explanation Only
Use this path only when all are true:
- `site_access.permission_state` is `granted`, or the workflow truly does not depend on operator-side interaction before capture begins.
- `site_access.workflow_stage` does not indicate active operator follow-up or terms review.
- `site_access.overdue_review.active` is not `true`.
- `field_ops.dispatch_review.manual_confirmation_required` may still be `true`, but the capturer is not being asked to represent that the schedule or access is fully locked.
- The capturer has a named Blueprint contact to escalate to if challenged.

What the capturer may say:
- "I’m here for a scheduled Blueprint capture."
- "If you need confirmation or have site questions, I can connect you with the Blueprint contact on this job."

What the capturer may not say:
- "Blueprint already has permission for everything."
- "The site approved me."
- "I can answer your privacy, rights, or access-policy questions."

### Path B: Site-Facing Trust Artifact Required Before First Assignment
Require a trust artifact before first assignment when all are true:
- the capturer is expected to introduce themselves to an operator, guard desk, or facilities contact
- the site may reasonably ask why the capturer is there or who sent them
- the job is still operationally viable without making the capturer negotiate access terms
- there is already a real Blueprint escalation contact attached to the job

Minimum trust artifact contents:
- capturer name as stored in `field_ops.capturer_assignment`
- site label or address tied to the actual capture job
- scheduled window or "pending final on-site timing confirmation" note, whichever is truthful
- named Blueprint ops contact and reachable contact path
- one-sentence purpose of visit grounded in capture work
- explicit boundary that site questions about permission, restrictions, privacy, or terms go back to Blueprint ops

Artifact truth rules:
- the artifact can establish identity and contact path
- the artifact cannot claim permission beyond the current `site_access.permission_state`
- the artifact cannot stand in for site badges, contracts, insurance certificates, or legal approvals that do not already exist

### Path C: Keep Human-Gated
Do not send a first-assignment capturer alone with a trust artifact when any are true:
- `site_access.permission_state` is `not_started`, `awaiting_response`, `review_required`, or `conditional`
- `site_access.workflow_stage` is `contact_acquisition`, `waiting_on_operator`, `terms_review_required`, or `human_resolution_required`
- `site_access.overdue_review.active` is `true`
- `site_access.review_requirements.negotiation_required` is `true`
- no verified operator contact exists and the site is likely to question the visit
- the capturer would need to explain restrictions, privacy boundaries, escort requirements, excluded zones, or other evidence in `review_requirements.required_evidence`
- the assignment would force the capturer to improvise around uncertain timing, travel, or access because `dispatch_review` still shows unresolved inputs

Human-gated next moves:
- have a human operator handle site contact or permission review first
- update `site_access` with the real decision state, contact, and notes
- only then decide whether the capturer needs a simple field-ready explanation or a site-facing trust artifact

## Escalation Triggers
Escalate the job instead of downgrading the problem into a template if any of these show up:
- operator asks for proof that sounds like legal permission, insurance, contract authority, or privacy approval
- site conditions include escort rules, restricted zones, badge handling, or filming limits that the capturer would have to interpret
- `site_access.permission_state` changes to `conditional` or `denied`
- `site_access.follow_up_due_at` is past due or `site_access.overdue_review.active=true`
- the only available credibility path depends on city-specific or facility-specific exceptions
- the capturer raises uncertainty about travel, timing, or acceptance and `dispatch_review` still shows manual confirmation required

## Capturer Script Boundary
Field ops may standardize only the minimum safe script:
- who the capturer is
- that they are there for a Blueprint capture
- who at Blueprint can answer site questions

Field ops may not standardize script that implies:
- operator permission is settled when it is not
- local rules have already been legally reviewed for that capturer
- the capturer can negotiate alternative access terms
- the capturer can override restrictions written by the site

## City-Specific Exceptions That Must Not Become Default

### Austin
- Keep Austin first captures on the stricter side until the cohort proves predictable assignment and escalation handling.
- If a site context is even moderately sensitive, default to a human-reviewed trust artifact and named escalation owner rather than a lightweight verbal explanation.
- Do not normalize Austin pilot trust materials into a universal national default.

### San Francisco
- Treat Bay Area first assignments as higher-friction by default.
- Expect stronger legitimacy questions from selective contributors and sensitive facilities.
- Require a human-reviewed trust artifact earlier, and escalate faster when the site asks for anything beyond identity plus a Blueprint contact path.

## Recording Rule
When this gate is applied, the job should make three things separable:
- assignment recommendation in `field_ops.capturer_assignment`
- dispatch uncertainty in `field_ops.dispatch_review`
- access truth and human-only boundaries in `site_access`

Do not collapse those into one "scheduled" or "approved" note.

## Exit Criteria
The first-assignment trust gate is satisfied only when:
- the capturer has a truthful site-facing posture for the real job
- the capturer knows exactly what they may say and what they must escalate
- the record does not imply permission beyond `site_access.permission_state`
- unresolved access or condition-setting work is still visibly human-owned
