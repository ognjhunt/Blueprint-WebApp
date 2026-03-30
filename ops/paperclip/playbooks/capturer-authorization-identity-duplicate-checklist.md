# Capturer Authorization, Identity, And Duplicate-Check Checklist

## Purpose
This is the minimum ops checklist Blueprint should have before city teams or growth widen capturer recruiting beyond small gated cohorts.

Use it to decide whether a prospective capturer is safe to approve into real capture work, especially when the workflow may involve:

- site-facing trust questions
- device or location-dependent assignments
- referral eligibility
- higher-risk duplicate, spoofed, or low-trust submissions

This checklist is a trust-control layer for capturer operations. It does not replace capture QA, site-access review, finance review, or human approval for compensation changes.

## Truth Guardrails
- Treat Firestore and current Paperclip issue state as the operational source of truth, not Slack memory.
- Do not mark a capturer as approved, trusted, or referral-ready unless the underlying evidence exists.
- Do not imply operator permission, legal clearance, or guaranteed work volume from a completed trust packet.
- Do not widen public recruiting if the review path below is not staffed and auditable.

## When This Checklist Must Be Applied
Apply this checklist before any of the following:

- moving a lead from gated intake into an approved capturer cohort
- assigning a first capture with site-facing or rights-sensitive implications
- allowing a capturer into a referral-eligible tier
- widening a city from curated cohort sourcing to broader recruiting

## Minimum Review Record
Each reviewed capturer should have one current record that makes the decision auditable.

At minimum, the review record should capture:

- source channel and market
- reviewer owner
- current stage
- identity check outcome
- authorization-artifact outcome when relevant
- duplicate/content-integrity outcome
- location/device validation outcome when relevant
- policy, privacy, and rights acknowledgement outcome
- approval decision, timestamp, and escalation notes

Today, that record will likely span `waitlistSubmissions`, linked Paperclip issues, and follow-up operational notes until a tighter trust-packet workflow exists.

## Minimum Checklist Before Approval

### 1. Intake identity
- Confirm the applicant is tied to a stable real-world identity appropriate to the workflow.
- Confirm a reachable contact method exists and matches the approved communication path.
- Confirm market or city targeting is specific enough to route real work.
- If the applicant is entering through a trusted cohort, record the cohort or access path explicitly.

### 2. Authorization and field-facing trust artifacts
- Decide whether the planned work actually needs site-facing authorization proof or only an internal field-ready explanation.
- If operator-facing credibility is required, collect the minimum artifact set before first assignment.
- Record what the capturer is allowed to say, show, or reference on site.
- Escalate any workflow that would require implying permission, legal clearance, or site access that Blueprint has not actually secured.

Use the field-ops gate in [field-ops-first-assignment-site-facing-trust-gate.md](/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/playbooks/field-ops-first-assignment-site-facing-trust-gate.md) to decide which of those two paths is actually allowed for a first assignment.

### 3. Duplicate and content-integrity review
- Check for duplicate applications, duplicate referrals, and materially overlapping contributor identities before approval.
- Check whether the same person appears to be re-entering through multiple channels or aliases.
- Check for suspicious portfolio, sample, or submission reuse where the workflow depends on prior work evidence.
- Record the result as pass, needs review, or blocked, with the reason.

### 4. Location and device validation where relevant
- Validate that the claimed city or operating area matches the cohort being seeded.
- Validate that the claimed capture device or capability is plausible for the lane being offered.
- If the lane has no device-sensitive requirement yet, record that the check was not required rather than pretending it passed.
- Escalate city-specific or lane-specific exceptions instead of normalizing them into the default path.

### 5. Policy, privacy, and rights acknowledgement
- Confirm the capturer has received the current policy and rights framing for Blueprint capture work.
- Confirm the capturer understands that site access, rights, and privacy constraints can limit what work is allowed.
- Confirm the capturer is not being onboarded with misleading earnings, incentive, or work-volume claims.
- Keep incentive and compensation language human-reviewed only.

### 6. Stage decision
- Move the capturer into a defined stage with an owner and next action.
- Use explicit outcomes: approved, needs more evidence, blocked, or rejected.
- Record what must happen before the next stage, especially if first capture assignment is still gated.
- Do not leave the record in a vague "looks good" state.

## What Can Be Standardized Now
- A single stage vocabulary across intake and ops.
- A minimum review record with named outcomes for identity, authorization, duplicates, and device/location checks.
- A rule that no referral eligibility begins before first passed capture.
- A rule that incomplete trust-packet reviews block public recruiting expansion.
- A rule that incentive, payout, or public earnings language remains human-reviewed.
- A rule that "not required" is an allowed outcome for location/device or authorization checks when the workflow truly does not depend on them.

## What Must Stay Human-Gated Or City-Specific
- Final approval for edge-case identity mismatches or ambiguous contributor identity.
- Any operator-facing authorization artifact that could be interpreted as legal permission or site approval.
- Exceptions for contributors whose device, city, or travel pattern falls outside the seeded cohort.
- Referral incentive terms, compensation changes, and public recruiting copy.
- City-specific trust kits for Austin, San Francisco, or future launches where local site norms differ.
- Any decision that touches rights, privacy exceptions, site access, or legal interpretation.

## Tooling And Staffing Assumptions Still Missing
- `waitlistSubmissions` does not yet expose a fully productized trust-packet structure with explicit sub-check outcomes.
- Ops still needs a durable place to store evidence links and reviewer decisions without spreading them across ad hoc notes.
- Duplicate detection is still operational judgment plus manual review, not a hardened system control.
- Device and location validation logic are not yet consistently encoded by lane.
- City launch teams do not yet have finished operator-safe trust kits for site-facing captures.
- Someone must own SLA-bound review for trust-packet exceptions before growth widens intake volume.

## Exit Criteria Before Wider Recruiting
Blueprint is ready to widen capturer recruiting only when:

- each approved capturer can be traced to a completed minimum review record
- the approval queue has a named owner and visible blocker path
- duplicate/content-integrity review is happening consistently enough to stop obvious bad entries
- location/device checks are explicit where the workflow depends on them
- site-facing authorization expectations are not being improvised per capturer
- referral eligibility is tied to first passed capture, not signup volume
- growth and city teams can tell which controls are standardized versus still human-gated

## Suggested Handoffs
- `intake-agent`: enforce stage language and minimum intake fields
- `field-ops-agent`: apply [field-ops-first-assignment-site-facing-trust-gate.md](/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/playbooks/field-ops-first-assignment-site-facing-trust-gate.md) before any first assignment with operator-facing credibility questions
- `capture-qa-agent`: define how first-passed-capture status unlocks referral eligibility
- `analytics-agent`: instrument approval, duplicate-review, and first-pass conversion rates
- `capturer-growth-agent`: keep recruiting copy and channel tactics aligned with these trust controls
