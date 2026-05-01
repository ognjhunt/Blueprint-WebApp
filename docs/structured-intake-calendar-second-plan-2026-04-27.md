# Structured Intake First, Calendar Second

Date: 2026-04-27
Status: Implemented baseline

## Decision

Blueprint's website and autonomous organization should treat structured intake as the primary motion and calendar booking as an accelerator for high-intent or high-risk cases.

Calendly is not the funnel. It is a release valve once the request has enough concrete site, workflow, buyer, rights, privacy, or commercialization context to make a meeting useful.

## Why

Blueprint is capture-first and world-model-product-first. The first website job is to collect truthful context that can route a request into the correct operating lane:

- robot teams buying site-specific packages, hosted evaluation, or data access
- site operators submitting or claiming a site, access policy, privacy boundary, or commercialization preference
- internal ops deciding whether the next step is intake clarification, package review, hosted review, rights review, or a scoped human call

Pure self-serve is too early because the product has rights, privacy, provenance, hosted-session, and buyer-fit constraints. Calendar-only loses structured truth and turns weak leads into meetings.

## Product Contract

### Robot Teams

Primary CTAs:

- Request buyer access
- Scope hosted evaluation

Structured intake collects:

- robot/team type or role
- target site or desired site class
- first task/workflow question
- package vs hosted vs data path
- budget or procurement range
- timing
- blockers and human-gated topics

Calendar booking becomes recommended when the request names a concrete site/workflow/robot path, asks for exact-site hosted review, or carries a high-budget managed-scoping signal.

### Site Operators

Primary CTA:

- Submit or claim a site

Secondary CTAs:

- List a site for robot evaluation
- Talk to Blueprint

Structured intake collects:

- facility name and location
- operator or responsible contact
- access rules and capture windows
- restricted/private areas
- privacy/security constraints
- commercialization preference
- relevant robot-team or site-use context

Calendar booking becomes required before the next operational step when private access, rights, privacy, security, or commercialization boundaries are present. Submission itself remains lightweight and does not require a call.

## Autonomous Organization Routing

All website intake records must carry a structured-intake disposition:

- `structured_intake.mode`
- `structured_intake.calendar_disposition`
- `structured_intake.calendar_reasons`
- `structured_intake.missing_structured_fields`
- `structured_intake.owner_lane`
- `structured_intake.recommended_path`
- `structured_intake.proof_ready_outcome`
- `structured_intake.proof_path_outcome`
- `structured_intake.proof_readiness_score`
- `structured_intake.missing_proof_ready_fields`
- `ops_automation.recommended_path`
- `ops_automation.requires_human_review`

Routing defaults:

- `intake-agent`: raw or incomplete intake, missing-field clarification, first qualification recommendation
- `buyer-solutions-agent`: qualified robot-team journeys, exact-site hosted review, package/hosted commercial path
- `site-operator-partnership-agent`: operator access/commercialization lane and partnership context
- `rights-provenance-agent`: rights, consent, privacy, commercialization ambiguity, or policy exceptions
- `revenue-ops-pricing-agent`: standard quote-band support after buyer path is qualified

## Implementation Surfaces

Current baseline implementation:

- `client/src/lib/structuredIntake.ts` defines the shared disposition logic.
- `server/routes/inbound-request.ts` attaches structured-intake metadata to inbound request records and ops automation.
- `client/src/components/site/ContactForm.tsx` collects role-specific structured fields before any meeting.
- `client/src/pages/BusinessSignUpFlow.tsx` creates the user profile and emits the same inbound request record.
- `client/src/pages/OnboardingChecklist.tsx` splits robot-team and site-operator onboarding tasks.
- `ops/paperclip/programs/structured-intake-calendar-second-contract.md` gives Paperclip agents the operating contract.

Robot-team intake also records a proof-readiness outcome so the first review can distinguish a proof-ready exact-site or adjacent-site request from a scoped follow-up without inventing readiness:

- `proof_ready_outcome`: `proof_ready_intake`, `needs_clarification`, or `operator_handoff`
- `proof_path_outcome`: `exact_site`, `adjacent_site`, `scoped_follow_up`, or `operator_handoff`
- `proof_readiness_score`: completeness score for required robot-team proof-path fields
- `missing_proof_ready_fields`: explicit fields blocking proof-ready intake

## Acceptance Criteria

- Robot-team and site-operator CTAs are role-specific.
- Signup and contact flows both produce structured intake records.
- Calendar booking is never the only CTA.
- The server stores a calendar disposition and missing-field list.
- The server stores a proof-readiness outcome, proof-path outcome, score, and missing proof-ready fields.
- Operator rights/privacy/commercialization ambiguity is human-gated.
- Robot-team exact-site/high-intent requests route toward buyer-solutions scoping.
- Agents can route from first-party intake fields without inventing buyer, site, rights, or readiness truth.
