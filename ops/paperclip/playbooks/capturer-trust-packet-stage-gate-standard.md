# Capturer Trust-Packet And Stage-Gate Standard

## Purpose
This is the intake-owned operating standard for moving a prospective capturer from first record to repeat-ready status without inventing approval logic per city or over-claiming what Blueprint can promise.

Use this standard when:
- reviewing a new `waitlistSubmissions` record for capturer work
- deciding what evidence is still missing before approval
- handing a capture-needing or exception case to ops
- determining whether a contributor can move from approval into referral-eligible or repeat-ready states

This standard supports Blueprint's capture-first product. It does not replace capture QA, site-access review, finance review, or any human decision touching compensation, rights, privacy exceptions, or legal interpretation.

## Truth Guardrails
- Approval is about operational readiness, not a promise of work volume or payout.
- A completed trust packet does not imply operator permission, legal clearance, or site access approval.
- Intake may standardize evidence collection and routing, but final edge-case approval remains human-gated.
- When a check is genuinely lane-dependent, record `not_required` instead of pretending the check passed.

## Current System Of Record
Until the productized trust-packet workflow exists, the current review record should span:
- `waitlistSubmissions` for the live intake record and queue state
- the linked Paperclip issue for reviewer notes, exceptions, and handoffs
- evidence links or artifacts referenced from the issue comment trail

The minimum auditable record for a reviewed capturer is:
- source channel or cohort
- market and device facts
- current stage
- reviewer owner
- identity outcome
- authorization outcome when required
- duplicate or integrity outcome
- location or device validation outcome when required
- policy, privacy, and rights acknowledgement outcome
- explicit next action or blocker

## Standard Stage Model

### 1. `sourced`
Use when Blueprint has identified a prospective capturer but the person has not yet submitted a usable application.

Required evidence:
- source channel or referring cohort
- target market or city hypothesis if known

Exit criteria:
- person submits a live application or explicitly expresses interest through a controlled intake path

### 2. `applied`
Use when a live `waitlistSubmissions` record exists and intake has enough raw facts to start review.

Required evidence:
- reachable email
- role indicates capturer intent
- market or operating area when available
- device claim when available

Exit criteria:
- request trust packet if the applicant is plausibly in-scope
- block or close if the record is clearly unusable or outside current operating lanes

### 3. `trust_packet_requested`
Use when intake has asked for the minimum evidence set needed to evaluate the applicant for real capture work.

Required evidence:
- named reviewer owner
- missing evidence list
- due-next action for the applicant

Exit criteria:
- trust packet materials arrive and can be reviewed
- or the record stalls and needs follow-up or closure

### 4. `trust_packet_verified`
Use only when the required trust-packet checks have explicit outcomes recorded.

Required evidence:
- identity outcome
- duplicate or integrity outcome
- policy, privacy, and rights acknowledgement outcome
- location or device validation outcome, or `not_required`
- authorization outcome, or `not_required`

Exit criteria:
- move to `approved` if all required checks are acceptable
- move to a blocked state if any approval-critical check is unresolved
- escalate edge cases instead of forcing approval

### 5. `approved`
Use when the contributor is eligible for cohort participation and can be onboarded into real capture work under current policy.

Required evidence:
- approval timestamp
- approval owner
- any restrictions on allowed lanes, cities, device classes, or site-facing claims

Exit criteria:
- contributor receives onboarding and operating expectations

### 6. `onboarded`
Use when the contributor has received the current operating brief and knows what Blueprint does and does not authorize.

Required evidence:
- onboarding completed
- current policy and rights framing delivered
- allowed next action is explicit

Exit criteria:
- first capture is assigned or submitted through the approved path

### 7. `first_capture_submitted`
Use when the contributor has delivered a first real capture for review.

Required evidence:
- linked capture submission or job reference
- submission timestamp

Exit criteria:
- capture QA returns a pass or fail outcome

### 8. `first_capture_passed`
Use when capture QA confirms the first submitted capture met the required quality bar.

Required evidence:
- capture QA pass result
- any notes about restrictions, coaching, or follow-up requirements

Exit criteria:
- contributor can be considered for repeat participation and referral eligibility under current program rules

### 9. `repeat_ready`
Use when the contributor has passed the first capture gate and can re-enter work without redoing first-time approval logic.

Required evidence:
- first passed capture is recorded
- any contributor tier or lane restriction is current

Exit criteria:
- contributor participates in repeat work
- referral eligibility can be considered if the current program rules allow it

## Trust Packet Minimum Contents

### Identity And Contact
- stable real-world identity appropriate to the workflow
- reachable contact path that matches the operating record
- market or city specificity good enough to route real work
- cohort or referral source when the applicant came through a trusted path

### Market, Device, And Lane Fit
- claimed operating market or travel pattern
- claimed device and capability
- note whether the current lane is device-sensitive
- explicit `not_required` outcome when device validation is unnecessary

### Authorization And Field-Facing Trust
- whether the planned work needs operator-facing authorization proof or only an internal field-ready explanation
- any artifact required before first assignment
- what the capturer may and may not say on site
- escalation note for any workflow that could imply ungranted permission or legal clearance

### Duplicate And Integrity Review
- duplicate application check
- duplicate referral or alias check when relevant
- suspicious portfolio or sample reuse check when the workflow depends on prior work evidence
- explicit result: `pass`, `needs_review`, or `blocked`

### Policy, Privacy, And Rights Acknowledgement
- confirmation that the capturer received current capture-policy framing
- confirmation that the capturer understands rights, privacy, and site-access constraints may limit work
- confirmation that no misleading earnings, incentive, or work-volume claim was used to onboard them

### Reviewer Decision
- current stage
- reviewer owner
- next action
- blocker or escalation note if the applicant cannot advance

## Approval Blockers
Do not move a capturer to `approved` when any of the following is true:
- no stable identity or no reliable contact path
- market or operating area is too vague to route safely
- claimed device or capability is implausible for the intended lane and not yet resolved
- duplicate or integrity review is unresolved or blocked
- required authorization artifact is missing for a site-facing workflow
- policy, privacy, and rights acknowledgement is missing
- the reviewer cannot tell what the capturer is actually allowed to say or do on site
- the case requires a human judgment on compensation, legal interpretation, privacy exception, rights exception, or public recruiting claims

## Human-Only Decisions
Escalate instead of standardizing any of the following into automatic approval logic:
- compensation changes, payout promises, or referral incentive terms
- legal interpretation of permission, operator authority, or privacy exceptions
- site-facing trust artifacts that could be read as official approval
- exceptions for contributors outside the seeded market, device, or travel posture
- public recruiting copy that makes earnings or availability claims

## Recording Guidance In Today's Workflow
Until implementation tasks land, intake should use the existing system conservatively:
- keep `waitlistSubmissions.status` and `queue` aligned with the current review posture
- use linked Paperclip issues for evidence notes, reviewer rationale, and escalation history
- avoid inventing Firestore fields that imply approval certainty before the schema exists

## Handoffs
- Route site-facing authorization questions or first-assignment artifact rules to `field-ops-agent`.
- Route first-capture pass and referral-unlock logic to `capture-qa-agent`.
- Route schema or admin-surface implementation work to the owning implementation issue rather than ad hoc notes.
- Escalate any rights, privacy, legal, compensation, or public-claim ambiguity to `ops-lead`.
