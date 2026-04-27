# Structured Intake First, Calendar Second Contract

Status: Active
Owner: `ops-lead`
Execution lanes: `intake-agent`, `buyer-solutions-agent`, `site-operator-partnership-agent`, `rights-provenance-agent`, `revenue-ops-pricing-agent`

## Rule

Treat website intake as the source of routing truth. Do not replace missing structured detail with a meeting request.

Calendar booking is allowed only as an accelerator after the intake record is specific enough to make the call useful, or as a required human checkpoint before access, rights, privacy, or commercialization commitments.

## Required Fields To Read

For every `inboundRequests` record, inspect:

- `request.buyerType`
- `request.requestedLanes`
- `request.siteName`
- `request.siteLocation`
- `request.taskStatement`
- `request.targetSiteType`
- `request.proofPathPreference`
- `request.targetRobotTeam`
- `request.operatingConstraints`
- `request.privacySecurityConstraints`
- `request.captureRights`
- `request.derivedScenePermission`
- `request.datasetLicensingPermission`
- `request.payoutEligibility`
- `structured_intake.calendar_disposition`
- `structured_intake.calendar_reasons`
- `structured_intake.missing_structured_fields`
- `structured_intake.owner_lane`
- `ops_automation.recommended_path`
- `ops_automation.requires_human_review`

## Dispositions

`not_needed_yet`

- Ask for missing structured details.
- Do not push Calendly as the primary next action.

`eligible_optional`

- A call can be offered as secondary, but the intake review can proceed asynchronously.
- Keep the next action in Paperclip tied to the missing field or package/hosted path.

`recommended`

- A scoped call can accelerate the request.
- Use only when the site, workflow, robot stack, or buyer path is concrete enough.
- `buyer-solutions-agent` should own qualified robot-team journeys.

`required_before_next_step`

- A human checkpoint is required before operational access, rights, privacy, or commercialization movement.
- This does not mean the site is approved, buyer-ready, rights-cleared, or commercially committed.
- Route rights/privacy ambiguity to `rights-provenance-agent`.

## Lane Ownership

`intake-agent`

- Owns raw intake triage and missing-field clarification.
- If structured fields are incomplete, draft a short clarification instead of sending a meeting link.

`buyer-solutions-agent`

- Owns qualified robot-team journeys after intake.
- May offer a scoped call when `calendar_disposition` is `recommended` or when the buyer has a concrete exact-site hosted review question.

`site-operator-partnership-agent`

- Owns operator access/commercialization framing.
- Must not imply operator approval is universally required for lawful public capture or packaging.

`rights-provenance-agent`

- Owns ambiguous rights, privacy, consent, commercialization, retention, and release questions.
- Must preserve the difference between submitted operator context and rights-cleared proof.

`revenue-ops-pricing-agent`

- Supports standard quote-band handling only after buyer-solutions has a qualified buyer path.

## Done Condition

An intake issue is handled only when the owning issue records one of:

- missing fields requested
- qualified handoff to buyer-solutions
- operator/access handoff to site-operator-partnership
- rights/privacy blocker routed to rights-provenance
- scoped call recommended or required with the exact reason
- explicit no-fit or hold recommendation with evidence

Never close an intake issue because a Calendly link exists.
