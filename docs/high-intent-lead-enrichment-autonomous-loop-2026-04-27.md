# High-Intent Lead Enrichment Autonomous Loop

## Decision

Build the first version as a draft-first, evidence-bounded loop for high-intent website inputs. It should research company/domain context, create a short dossier, draft a follow-up, and route the work into Paperclip. It must not become generic outbound automation or person-level profiling.

This loop is live for:

- robot teams requesting Exact-Site Hosted Review, deeper evaluation, data licensing, managed tuning, or exact-site proof
- site operators who submit a specific site plus access, rights, privacy, or commercialization context
- waitlist/city interest only when the city is active or near activation
- capturer supply only when it matches an active/near city or carries unusually strong supply signal

Everything else remains aggregate demand signal or normal intake.

## Runtime Integration

The implementation entrypoint is `server/utils/highIntentLeadEnrichment.ts`.

Triggers:

- `server/routes/inbound-request.ts` calls `runHighIntentLeadEnrichmentForRequest()` after an inbound request is persisted.
- `server/routes/waitlist.ts` calls `runWaitlistLeadSignalRouting()` after a waitlist submission is persisted.

Primary write surfaces:

- `leadEnrichmentDossiers/{stable_source_hash}` stores the evidence-bounded dossier.
- `inboundRequests/{requestId}.lead_enrichment` stores the routing summary.
- `waitlistSubmissions/{submissionId}.lead_enrichment` stores active/near-city routing summaries.
- `waitlistSubmissions/{submissionId}.city_demand_signal` stores aggregate-only city demand signals.

Paperclip handoff:

- enabled when `BLUEPRINT_LEAD_ENRICHMENT_PAPERCLIP_HANDOFF_ENABLED=1` or when Paperclip API configuration is present
- disabled with `BLUEPRINT_LEAD_ENRICHMENT_PAPERCLIP_HANDOFF_ENABLED=0`
- creates or updates a Paperclip issue with `originKind=high_intent_lead_enrichment`
- wakes the assigned agent when an assignee agent id exists

## Classification And Owners

| Input | Required trigger | Classification | Owner |
| --- | --- | --- | --- |
| Robot team | Exact-site proof, Exact-Site Hosted Review, deeper evaluation, data licensing, or managed tuning | `robot_team_buyer` | `buyer-solutions-agent` for exact-site/deeper/tuning, otherwise `robot-team-growth-agent` |
| Site operator | Specific site plus rights/access/privacy/commercialization context | `site_operator` | `site-operator-partnership-agent` |
| Active-city capturer | Active/near city plus capturer role and strong device/site signal | `capturer_supply` | `intake-agent` |
| Active-city demand | Active/near city and buyer/operator/partner signal | `city_launch_interest`, `robot_team_buyer`, `site_operator`, or `partner` | `city-demand-agent` |
| Inactive city or normal waitlist | City not active/near, or normal low-signal capturer | aggregate only | `city-demand-agent` |

## Dossier Contract

Each dossier must include:

- source collection and source document id
- classification, trigger kind, trigger reasons, owner, related agents
- company name/domain/website derived only from submitted fields or safe email-domain parsing
- submitted context needed for the owner to understand the request
- public company homepage snapshot when a safe company domain exists and the fetch succeeds
- evidence items labeled as `evidence`, `inference`, or `open_question`
- draft follow-up when the case is appropriate for human-reviewed reply
- allowed claims and blocked claims for the draft
- next actions and guardrails

Enrichment result is evidence context, not truth. It does not approve buyer readiness, site rights, pricing, delivery dates, capturer approval, launch status, or outreach.

## Guardrails

- no invented contacts
- no guessed emails
- no person-level social profiling unless the submitter explicitly provided that profile/context
- no automated live outreach to third parties who did not submit the form
- no public/company claims unless backed by submitted or public source evidence
- no claim that Blueprint has validated more than the evidence shows
- no pricing, rights, procurement, permission, delivery, or sales commitment in draft automation
- all live sends require human approval in phase 1

## Graduation Gates

Phase 1 is research + draft + route only.

Auto-send is not allowed until at least 20-50 reviewed cases show the drafts are safe, useful, and low correction. The first eligible auto-send class should be limited to low-risk clarification questions, such as asking for the exact site/workflow to review.

Never auto-send:

- pricing
- rights or permission asks
- procurement or legal claims
- promises of delivery
- third-party outreach
- claims that a site, company, buyer, or city was validated

## Acceptance Criteria

- high-intent robot-team request produces a `leadEnrichmentDossiers` record and `inboundRequests.lead_enrichment`
- low-signal robot-team request produces no dossier
- specific site-operator request routes to `site-operator-partnership-agent`
- inactive-city waitlist interest writes only `city_demand_signal.status=aggregated_only`
- active-city strong capturer supply writes a dossier and routes to `intake-agent`
- every generated draft has `requires_human_approval=true`
- every persisted summary has `no_live_send=true`
- tests cover eligible, skipped, aggregate-only, and active-city cases
