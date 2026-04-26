# Exact-Site Hosted Review GTM Pilot

Date: 2026-04-26

Status: implementation plan and operating contract

Scope: 14-day internal GTM pilot for using Blueprint's own proof, Paperclip agents, and hosted-review artifacts to generate qualified robot-team demand.

## Decision

Run a narrow 14-day pilot: **Blueprint uses Blueprint to sell Blueprint**.

The pilot wedge is **Exact-Site Hosted Review for robot teams**. The lead magnet is a concrete artifact, not a generic pitch:

- an exact-site hosted review when a real proof path exists
- a city/site opportunity brief when the proof path is still being assembled

The pilot does not authorize generic cold outbound, paid scale, live posting, or broad domain/inbox rotation.

## Why This Fits Blueprint

This implements the useful part of high-velocity GTM: dogfood the product and operating system to create market motion.

For Blueprint, that means:

- `demand-intel-agent` finds robot-team buying signals
- `robot-team-growth-agent` turns those signals into exact-site proof offers and draft messages
- `city-demand-agent` keeps city/site specificity tied to real capture and hosted-review readiness
- `site-operator-partnership-agent` handles optional access/commercialization lanes without making operator approval universal
- Growth Lead keeps the loop narrow, measurable, and review-gated

## Non-Negotiables

- No fake recipient data.
- No guessed or pattern-made email addresses.
- No live send without recipient-backed evidence.
- No paid spend until organic replies, hosted-review starts, or qualified calls exist in the ledger.
- No public traction, customer, site-live, or readiness claims unless the proof exists.
- No qualification-first reframing. The product story remains capture-first and world-model-product-first.

## Pilot Window

- planned start: 2026-04-27
- planned end: 2026-05-10
- daily outbound target: 20-50 high-quality touches
- default track: `proof_ready_outreach`
- owner: `growth-lead`
- execution lanes: `demand-intel-agent`, `robot-team-growth-agent`, `city-demand-agent`, `site-operator-partnership-agent`
- human gates: live sends, public posting, paid spend, commercial commitments, rights/privacy/permission judgments

## Two Tracks

### Track 1: Proof-Ready Outreach

Use this when Blueprint already has a captured, packaged, reviewable site-world or hosted-review path.

Ledger requirements:

- `track`: `proof_ready_outreach`
- `artifact.type`: `exact_site_hosted_review`
- `artifact.status`: `review_ready` or `delivered`
- `artifact.siteWorldId` or `artifact.hostedReviewPath`: required

Allowed CTA:

- ask a robot team to inspect or test the existing exact-site hosted review

Blocked:

- pitching a hosted review when the artifact is `missing` or only `draft`
- claiming a city is live because one target exists

### Track 2: Demand-Sourced Capture

Use this when Blueprint does not yet have the right site captured and needs buyer demand to decide what to capture.

Ledger requirements:

- `track`: `demand_sourced_capture`
- `artifact.type`: `city_site_opportunity_brief`
- `artifact.status`: usually `missing` or `draft`
- `captureAsk`: required
- `captureAsk.requestedSiteType` or `captureAsk.requestedCity`: required

Allowed CTA:

- ask the robot team what site, facility type, or workflow would be most useful to capture and host next

Blocked:

- saying a hosted review is ready
- implying an exact-site world already exists for that target
- treating a demand-sourced target as proof-ready until capture, packaging, and hosted-review readiness are real

## Operating Loop

### Day 0: Setup

1. Confirm the canonical ledger exists:
   `ops/paperclip/playbooks/exact-site-hosted-review-gtm-ledger.json`
2. Run:
   `npm run gtm:hosted-review:audit`
3. Generate the founder daily review packet:
   `npm run gtm:hosted-review:daily -- --write --allow-blocked`
4. Create the kickoff Paperclip issue from:
   `ops/paperclip/blueprint-company/tasks/exact-site-hosted-review-gtm-pilot/TASK.md`

### Daily Loop

1. `demand-intel-agent` adds or improves real robot-team targets.
2. `robot-team-growth-agent` drafts the proof-led offer and message.
3. `city-demand-agent` attaches the relevant city/site opportunity context when the motion is city-specific.
4. `site-operator-partnership-agent` flags optional access or commercialization context only for a specific target.
5. Growth Lead records the target, evidence, artifact, message, recipient evidence, send status, reply state, and outcome in the ledger.
6. Run `npm run gtm:hosted-review:audit` before claiming the day's motion is ready.
7. Run `npm run gtm:hosted-review:daily -- --write --allow-blocked` so the founder sees one dashboard: targets added, recipient-backed targets, approvals, sends, replies, hosted-review starts, qualified calls, and blockers.

Internal summaries do not count as daily progress unless they change one of those dashboard fields.

### Weekly Review

Growth Lead reviews:

- number of targets with real buying signals
- number of review-ready artifacts
- number of human-approved sends
- sent touches
- replies
- hosted-review starts
- qualified calls
- exact-site or capture requests
- blockers by evidence, artifact, recipient, reply routing, or human gate

## Ledger Contract

The canonical ledger tracks:

- track: `proof_ready_outreach` or `demand_sourced_capture`
- target organization and buyer segment
- real intent signals
- evidence source and proof artifact
- site-world id or hosted-review path for Track 1
- capture ask for Track 2
- recipient evidence, if outreach is ready
- message/send status
- content-loop drafts tied to proof artifacts
- daily sent touches and outcome counts
- paid-spend lock state

Validation is implemented in:

- `server/utils/exactSiteHostedReviewGtmPilot.ts`
- `scripts/gtm/audit-exact-site-hosted-review-pilot.ts`
- `server/tests/exact-site-hosted-review-gtm-pilot.test.ts`

## Success Criteria

The pilot is worth scaling only if it creates at least one of:

- qualified robot-team reply
- hosted-review start
- qualified call
- exact-site request
- capture request tied to a buyer workflow

Scale means widening the same ledgered motion by city or vertical. It does not mean adding paid spend or high-volume cold outbound by default.

## Current First Batch

As of 2026-04-26, the canonical ledger contains the first 12 target rows. They are intentionally not marked sent or human-approved because recipient-backed contacts are still missing.

The immediate work is:

1. research explicit recipient-backed contacts for those targets
2. have the founder approve or edit the first real outreach batch
3. record every send in the ledger before counting it
4. convert replies into calls, hosted-review starts, exact-site requests, or explicit blockers

## Blocked States

Block the motion instead of smoothing it over when:

- the target has no real buying signal
- the artifact does not exist
- the recipient email lacks evidence
- the content draft lacks proof artifact linkage
- a public post or live send lacks human approval
- paid spend is requested before organic signal exists
- the ask requires pricing, legal, privacy, rights, permission, or commercialization judgment
