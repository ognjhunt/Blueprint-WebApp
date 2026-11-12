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
- `structured_intake.proof_ready_outcome`
- `structured_intake.proof_path_outcome`
- `structured_intake.proof_readiness_score`
- `structured_intake.missing_proof_ready_fields`
- `structured_intake.site_operator_claim_outcome`
- `structured_intake.access_boundary_outcome`
- `structured_intake.site_claim_readiness_score`
- `structured_intake.missing_site_claim_fields`
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
- Treats `proof_ready_outcome=proof_ready_intake` as an intake measurement only. It can start proof-path triage, but it is not proof that a package, hosted review, rights clearance, or buyer send exists.
- Uses `proof_path_outcome` to distinguish exact-site, adjacent-site, and scoped-follow-up paths before drafting the first response.

`site-operator-partnership-agent`

- Owns operator access/commercialization framing.
- Must not imply operator approval is universally required for lawful public capture or packaging.
- Treats `site_operator_claim_outcome=site_claim_access_boundary_ready` as a measured intake outcome only, not approval, rights clearance, buyer readiness, or commercialization permission.
- Uses `access_boundary_outcome` and `missing_site_claim_fields` before asking for a call so access/privacy gaps stay explicit.

`rights-provenance-agent`

- Owns ambiguous rights, privacy, consent, commercialization, retention, and release questions.
- Must preserve the difference between submitted operator context and rights-cleared proof.

`revenue-ops-pricing-agent`

- Supports standard quote-band handling only after buyer-solutions has a qualified buyer path.

## Done Condition

An intake issue is handled only when the owning issue records one of:

- missing fields requested
- qualified handoff to buyer-solutions
- proof-ready intake recorded with exact-site or adjacent-site proof-path outcome
- operator/access handoff to site-operator-partnership
- site-operator claim/access-boundary outcome recorded with any missing boundary fields named
- rights/privacy blocker routed to rights-provenance
- scoped call recommended or required with the exact reason
- explicit no-fit or hold recommendation with evidence

Never close an intake issue because a Calendly link exists.
