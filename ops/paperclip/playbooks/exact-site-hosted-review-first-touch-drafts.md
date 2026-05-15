# Exact-Site Hosted Review First Touch Drafts

Date: 2026-05-15
Owner: `robot-team-growth-agent`
Status: draft-only, no live sends

These are first-touch draft shapes for the Exact-Site Hosted Review pilot. They are not send receipts, approvals, reply evidence, customer proof, or live-outreach authorization.

## Review Rules

- Use only recipient-backed rows from `ops/paperclip/playbooks/exact-site-hosted-review-gtm-ledger.json`.
- Keep the ask to one decision: inspect a labeled review, or name the site/workflow worth capturing next.
- Do not approve pricing, rights, privacy, permission, legal, readiness, sender durability, paid spend, or live dispatch in this draft file.
- Do not claim the recipient is a customer, partner, active prospect, or approved buyer.
- Do not claim a hosted review exists for `demand_sourced_capture` rows.

## Proof-Ready Draft

Subject: exact-site review for a real site workflow

Hi `<recipient name>`,

I am building Blueprint, a capture-backed way for robot teams to inspect real sites before committing people, simulation time, or deployment planning.

For `<organization>`, the closest current artifact is a labeled hosted review of `<site/workflow>`. It is not a customer result or deployment guarantee. It shows the review shape: scoped route, capture context, observed constraints, rights/privacy limits, and the next decision a buyer can make.

Would it be useful to inspect that review and tell me what exact site or workflow would make it more relevant for your team?

`<founder name>`

CTA: inspect the labeled review, then name the more relevant site or workflow.

Landing-page handoff: `/product` or the row's `artifact.hostedReviewPath`.

## Demand-Sourced Capture Draft

Subject: what exact site should Blueprint capture for `<organization>`?

Hi `<recipient name>`,

I am building Blueprint, a capture-backed way for robot teams to turn real sites into site-specific world-model packages and hosted review sessions.

For `<organization>`, I do not want to guess the wrong environment. If Blueprint captured one site or workflow for your team first, what would be most useful to review?

Examples:

- a warehouse aisle, tote flow, dock, or trailer unloading workflow
- a retail aisle or customer-facing service route
- a hospital supply route with privacy boundaries
- an industrial inspection path
- a yard, loading, dispatch, or delivery handoff workflow

If you point me at the workflow, I will either share the closest labeled review artifact or say plainly what would need to be captured first.

`<founder name>`

CTA: name the site or workflow worth capturing first.

Landing-page handoff: `/contact?persona=robot-team&buyerType=robot_team&interest=capture-access&path=request-capture&source=gtm-first-touch`.

## Objection Handling

| Objection | Draft-safe response |
| --- | --- |
| "This sample is not our site." | Correct. It is a labeled proof shape, not buyer-specific proof. The ask is which exact site or workflow would make the review relevant. |
| "Do you already have our facility captured?" | Only say yes if the ledger row and artifact prove it. Otherwise say Blueprint would need to capture the site first. |
| "Can you prove deployment readiness?" | Do not claim readiness. Offer capture proof, package review, hosted evaluation scope, and explicit limits. |
| "Can you send pricing or contract terms?" | Route to human review or revenue-ops pricing. Do not put pricing or contract commitments in first-touch copy. |
| "Do you have rights or permission for this site?" | Answer only from the artifact and rights/provenance record. If unclear, route to rights/provenance review. |
| "Can we see a live hosted session now?" | Offer only the supported labeled sample or request-gated hosted path. Do not promise live availability until entitlement, proof, and runtime checks pass. |

## Approval Checklist

Before a live send can even be considered:

- recipient email is explicit and evidence-backed
- `recipient.evidenceSource` explains where the address came from
- `recipient.evidenceType` is `explicit_research`, `historical_campaign`, or `human_supplied`
- the approval packet records `decision=approve` for the reviewed row
- `outbound.status` moves from `draft_ready` to `human_approved` only through `npm run gtm:first-send-approval:apply -- --write`
- `npm run gtm:send -- --dry-run --allow-blocked` is rerun
- `npm run human-replies:audit-durability` passes
- live dispatch is separately authorized

Blocked claims:

- no fake contacts, fake sends, fake replies, or fake buyer proof
- no claim that samples are customer results
- no claim that demand-sourced rows have hosted reviews ready
- no guarantee of model capability, provider readiness, deployment readiness, or city readiness
- no pricing, rights, permission, privacy, legal, or paid-spend commitments
