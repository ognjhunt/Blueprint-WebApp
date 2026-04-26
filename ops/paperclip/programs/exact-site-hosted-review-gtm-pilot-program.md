# Exact-Site Hosted Review GTM Pilot Program

## Mission

Run a 14-day proof-led GTM pilot where Blueprint uses its own product artifacts and Paperclip operating lanes to create qualified robot-team demand.

The lead magnet is **Exact-Site Hosted Review**. When exact-site proof is not ready, use a clearly labeled city/site opportunity brief instead.

The pilot has two supported tracks:

- `proof_ready_outreach`: use when an exact-site world is already captured, packaged, and reviewable.
- `demand_sourced_capture`: use when the buyer conversation should identify which site/workflow Blueprint should capture next.

## Operating Scope

This is a controlled exception to the default paused state of the broader growth tree.

Allowed lanes:

- `growth-lead`: pilot owner, ledger owner, human-gate router
- `demand-intel-agent`: high-intent robot-team signal research
- `robot-team-growth-agent`: proof-led offer, draft message, and content-loop packaging
- `city-demand-agent`: city/site opportunity context and target prioritization
- `site-operator-partnership-agent`: optional operator/access/commercialization lane notes

Not allowed without explicit human approval:

- live sends
- public posts
- paid spend
- influencer spend
- pricing, discount, procurement, rights, permission, privacy, legal, or commercialization commitments

## Required Artifacts

- pilot plan: `docs/exact-site-hosted-review-gtm-pilot-2026-04-26.md`
- canonical ledger: `ops/paperclip/playbooks/exact-site-hosted-review-gtm-ledger.json`
- robot-team playbook: `ops/paperclip/playbooks/robot-team-demand-playbook.md`
- audit command: `npm run gtm:hosted-review:audit`

## Daily Done Condition

A daily pilot pass is done only when:

1. the ledger has at least 10 real robot-team target rows while the pilot is active
2. the daily founder review packet is generated with `npm run gtm:hosted-review:daily -- --write --allow-blocked`
3. every agent update changes one of the buyer-motion fields: target, contact, draft, approval, send, reply, call, hosted-review start, or blocker
1. every target has a real buying signal
2. every target declares `proof_ready_outreach` or `demand_sourced_capture`
3. every `proof_ready_outreach` target has a review-ready exact-site hosted-review artifact plus site-world id or hosted-review path
4. every `demand_sourced_capture` target has a capture ask and does not claim a live hosted review
5. every human-approved or sent touch has recipient-backed email evidence
6. every content-loop draft cites the proof artifact it came from
7. paid spend remains zero unless the ledger explicitly records a scale decision
8. `npm run gtm:hosted-review:audit` passes, or the run blocks with the exact audit finding

## Quality Bar

Good:

- one real site
- one robot workflow
- one proof artifact
- one concrete next step
- one inspectable ledger row
- one founder-visible daily dashboard

Track-specific good:

- Track 1 says: "inspect this reviewable exact-site world."
- Track 2 says: "tell us which site/workflow would be worth capturing next."

Bad:

- generic AI/software pitch
- broad cold outbound
- target research that never becomes a contact, approval, send, reply, call, hosted-review start, or explicit blocker
- guessed recipients
- fake traction language
- city-live claims without proof
- hosted-review claims on demand-sourced capture targets
- paid scale before organic signal

## Three-Loop Operating Shape

For the pilot window, collapse the autonomous org into three practical loops:

- product/proof: keep the artifact honest and buyer-inspectable
- demand/sales: add targets, find recipient-backed contacts, draft, approve, send, and follow up
- reliability: keep reply resume, send ledgers, audit output, and blocker state truthful

Do not restart broad content, city, or market routines unless they directly improve one of those three loops for the current target batch.

## Scale Gate

The pilot can be considered for scale only when the ledger records at least one qualified organic signal:

- reply
- hosted-review start
- qualified call
- exact-site request
- capture request tied to a buyer workflow

Scale means repeating the same controlled motion by city or vertical. It does not authorize a high-volume outbound machine.
