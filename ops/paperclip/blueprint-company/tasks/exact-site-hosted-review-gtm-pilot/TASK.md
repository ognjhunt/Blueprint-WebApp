---
name: Exact-Site Hosted Review GTM Pilot
project: blueprint-webapp
assignee: growth-lead
recurring: false
---

Run the 14-day "Blueprint uses Blueprint to sell Blueprint" pilot around the Exact-Site Hosted Review wedge.

Primary sources:

- `docs/exact-site-hosted-review-gtm-pilot-2026-04-26.md`
- `ops/paperclip/programs/exact-site-hosted-review-gtm-pilot-program.md`
- `ops/paperclip/playbooks/exact-site-hosted-review-gtm-ledger.json`
- `ops/paperclip/playbooks/robot-team-demand-playbook.md`
- `ops/paperclip/blueprint-company/tasks/exact-site-hosted-review-buyer-loop/TASK.md`

## Required Work

- keep the canonical ledger current
- keep at least 30 real robot-team target rows in the ledger while the pilot is active, with a near-term minimum of 12 recipient-backed first-batch targets
- treat target rows without recipient-backed contacts as research work, not send-ready work
- record approval state, send receipt, reply state, and next action on the same target row whenever those states exist
- every daily pass must update the founder review packet with targets added, recipient-backed targets, approvals, sent touches, replies, hosted-review starts, qualified calls, and blockers
- every daily pass must also generate `npm run gtm:hosted-review:buyer-loop -- --write --allow-blocked`
- default the first setup pass to `proof_ready_outreach` if a captured, packaged, reviewable site-world is selected
- use `demand_sourced_capture` when no reviewable site-world exists for the target and the ask is to learn which site/workflow should be captured next
- use `demand-intel-agent` for high-intent robot-team signal research
- use `robot-team-growth-agent` for proof-led offer and message packaging
- use `city-demand-agent` for city/site context when a target is city-specific
- use `site-operator-partnership-agent` only when operator access or commercialization materially matters
- run `npm run gtm:hosted-review:audit` before reporting the pilot as ready, active, or complete
- run `npm run gtm:hosted-review:daily -- --write --allow-blocked` after material target, send, reply, or blocker changes
- run `npm run human-replies:audit-durability` before claiming replies are production-durable

## Guardrails

- no fake emails
- no inferred recipient addresses
- no live buyer sends without recipient-backed evidence and founder first-send approval
- no public posts without review
- no paid spend until organic replies, hosted-review starts, or qualified calls are recorded in the ledger
- no pricing, legal, privacy, rights, permission, or commercialization commitments
- no hosted-review pitch from `demand_sourced_capture` rows
- no agent report counts as progress unless it changes a target, contact, draft, approval, send, reply, call, hosted-review start, or blocker
- after 100 recipient-backed touches or day 14, change ICP, offer, artifact, CTA, or close the motion instead of extending it by default

## Done When

- the pilot ledger records the targets, evidence, artifacts, sends, replies, content drafts, and outcomes for the full 14-day window
- the final closeout reports whether the pilot produced at least one qualified robot-team reply, hosted-review start, qualified call, exact-site request, or buyer-workflow capture request
- the final audit passes or records the exact blocker
- Growth Lead leaves a proof-bearing closeout with whether the motion should be scaled, paused, or revised
