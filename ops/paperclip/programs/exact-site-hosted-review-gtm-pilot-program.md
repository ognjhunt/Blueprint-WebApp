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
- buyer-loop command: `npm run gtm:hosted-review:buyer-loop -- --write --allow-blocked`
- reply durability command: `npm run human-replies:audit-durability`

## Daily Done Condition

A daily pilot pass is done only when:

1. the ledger is moving toward 30-50 real robot-team target rows while the pilot is active
2. the daily founder review packet is generated with `npm run gtm:hosted-review:daily -- --write --allow-blocked`
3. every agent update changes one of the buyer-motion fields: target, contact, draft, approval, send, reply, call, hosted-review start, or blocker
4. every first-batch buyer touch is recipient-backed and either waiting on founder approval or explicitly approved
5. the buyer-loop report is generated with `npm run gtm:hosted-review:buyer-loop -- --write --allow-blocked`
6. every target has a real buying signal
7. every target declares `proof_ready_outreach` or `demand_sourced_capture`
8. every `proof_ready_outreach` target has a review-ready exact-site hosted-review artifact plus site-world id or hosted-review path
9. every `demand_sourced_capture` target has a capture ask and does not claim a live hosted review
10. every human-approved or sent touch has recipient-backed email evidence
11. every sent or later touch has a send receipt, reply path or reply watcher state, and explicit next action
12. every content-loop draft cites the proof artifact it came from
13. paid spend remains zero unless the ledger explicitly records a scale decision
14. `npm run gtm:hosted-review:audit` passes, or the run blocks with the exact audit finding

## Quality Bar

Good:

- one real site
- one robot workflow
- one proof artifact
- one concrete next step
- one inspectable ledger row
- one founder-visible daily dashboard
- one city-launch buyer-loop artifact whenever a city is launched

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

## City Launch Coupling

Every new city launch must emit the exact-site buyer-loop artifact alongside the city-opening send ledger and execution report. The artifact is the only robot-team sales status page for that city. It must show targets, recipient-backed contacts, founder approval queue, send/reply status, hosted-review starts, qualified calls, capture asks, next actions, reply durability, and the 100-touch decision gap.

If a city has no city-specific target rows, the buyer-loop artifact should say so and fall back to the global target queue until city-specific target rows are added. Do not mark the city demand loop healthy from internal issue movement alone.

## Scale Gate

The pilot can be considered for scale only when the ledger records at least one qualified organic signal:

- reply
- hosted-review start
- qualified call
- exact-site request
- capture request tied to a buyer workflow

Scale means repeating the same controlled motion by city or vertical. It does not authorize a high-volume outbound machine.

After 100 recipient-backed touches or day 14, the default action is a decision, not another week of the same motion. The allowed decisions are continue, change ICP, change offer, change proof artifact, change CTA, or stop.
