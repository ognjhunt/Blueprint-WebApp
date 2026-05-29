# Exact-Site Hosted Review Buyer Loop

- report_date: 2026-05-27
- city: Austin, TX
- ledger: ops/paperclip/playbooks/exact-site-hosted-review-gtm-ledger.json
- loop_status: decision_due
- durability_status: blocked
- note: Filtered to Austin, TX.

## Daily Dashboard

| Metric | Value |
| --- | ---: |
| Target rows | 1 |
| Recipient-backed targets | 1 |
| Enrichment attempted targets | 1 |
| Enrichment candidate targets | 1 |
| Enrichment contact-found targets | 1 |
| Approval-ready targets | 1 |
| Founder approval needed | 1 |
| Reply-durability blocked targets | 1 |
| Sent touches | 0 |
| Replies | 0 |
| Hosted-review starts | 0 |
| Qualified calls | 0 |
| Proof-ready artifacts | 1 |
| Capture asks | 0 |
| Explicit next-action rows | 1 |
| Open blockers | 1 |
| Paperclip-linked blockers | 1 |
| 100-touch decision gap | 100 |
| Days remaining | 0 |

## One Sales Ledger

| Target | Track | Recipient | Status | Approval | Next action |
| --- | --- | --- | --- | --- | --- |
| Simbe Robotics | proof_ready_outreach | sales@simberobotics.com | draft_ready | pending_first_send_approval | Founder approves, edits, or rejects this recipient-backed draft before any live send. |

## Recipient-Backed Contact Engine

- Run `npm run gtm:enrichment:run -- --write` to refresh provider-backed recipient evidence before founder approval.
- Clay or another enrichment tool may feed this lane only as a provider-normalized candidate source; the GTM ledger remains the system of record.

- no missing recipient-backed target rows in this view

## Approval And Reply Gate Classification

- classification: decision_due
- approval_ready_targets: 1
- reply_durability_blocked_targets: 1
- approval_ready means recipient-backed drafts are waiting on explicit founder approve/edit/reject decisions; it does not authorize live sends.
- reply_durability_blocked means first-send approval is recorded, but live send/reply durability is still blocked; target-level live reply/sender blockers also use this classification.

## Founder First Send Batch

- Founder action: approve, edit, or reject these recipient-backed drafts. This does not authorize live sends, pricing, rights, privacy, legal, permission, paid spend, or readiness claims.
- Review order: recipient evidence, draft angle, CTA, landing page handoff, objection plan, then decision.

| Target | Recipient | Draft angle | CTA | Landing page | Review flag |
| --- | --- | --- | --- | --- | --- |
| gtm-001-simbe-retail-aisle-review: Simbe Robotics | sales@simberobotics.com | Invite the recipient to inspect a labeled exact-site hosted review, then ask what site or workflow would make the review more relevant. | Inspect the review, then name the more relevant site or workflow. | /sample-evaluation | public/general inbox; expect routing friction |

## First-Send Review Workflow

- Keep all rows draft-only until the approval packet records explicit approve, edit, or reject decisions.
- Apply decisions with `npm run gtm:first-send-approval:apply -- --write --allow-blocked`, then rerun audit and dry-run send checks.
- A successful approval apply still does not permit a live send until reply durability passes and live dispatch is separately authorized.
- Rows marked edit or reject should keep a specific next action in the ledger before requesting approval again.

## Founder Approval Copy Preview

### gtm-001-simbe-retail-aisle-review: Simbe Robotics

- recipient: sales@simberobotics.com
- subject: Labeled exact-site review for Retail shelf-scanning robotics team
- landing_page: /sample-evaluation
- review_flags: public/general inbox; expect routing friction

> Hi,
> 
> I am building Blueprint, a capture-backed way for robot teams to inspect real sites before committing people, simulation time, or deployment planning.
> 
> For Simbe Robotics, I saw this signal: Company publicly sells retail shelf-intelligence robots that operate in grocery and store aisles.
> The closest current artifact is /sample-evaluation. It is representative proof shape, not Simbe Robotics' site, not a customer result, and not deployment proof.
> 
> Would it be useful to inspect it and tell me what exact site or workflow would make the review relevant for your retail shelf-scanning robotics team?
> 
> /sample-evaluation
> 
> Nijel

## Objection Handling

| Target | Likely objection or review question | Evidence-safe response boundary |
| --- | --- | --- |
| gtm-001-simbe-retail-aisle-review: Simbe Robotics | If they say the sample is not their site, ask for the exact workflow to capture next and keep the sample labeled as representative proof shape. | Answer from the ledger row, linked artifact, and public page only; route pricing, rights, privacy, or capability exceptions back to human review. |

## Proof Artifact Queue

- all rows in this view have review-ready or delivered proof artifacts

## Blocker Ledger

| Target | Blocker | Owner | Status | Paperclip issue | Next action |
| --- | --- | --- | --- | --- | --- |
| gtm-001-simbe-retail-aisle-review: Simbe Robotics | Buyer sends and replies cannot be treated as production-durable until sender verification and Gmail human-reply watcher credentials are configured. | growth-lead | blocked | BLU-5393 | Set sender verification, human-reply ingest token, approved identity, enable Gmail watcher, and provide Gmail OAuth credentials before counting live replies as durable. |

## Durable Reply Plumbing

- status: blocked
- sender_configured: true
- sender_verification: verified
- watcher_enabled: false
- blockers:
  - Human-reply ingest token is not configured, so internal blocker dispatch/reply intake cannot be treated as production durable.
  - Human-reply approved identity is relying on code default. Set BLUEPRINT_HUMAN_REPLY_APPROVED_EMAIL=ohstnhunt@gmail.com in the live env so production routing is explicit.
  - Gmail human-reply watcher is not enabled for the production scheduler.
  - BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_ID, BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_SECRET, and BLUEPRINT_HUMAN_REPLY_GMAIL_REFRESH_TOKEN are required.

## Public Conversion Rule

- Robot-team pages should drive exactly two buyer actions: inspect an exact-site review now, or request a capture for the site/workflow they need.
- Do not add public CTAs that create generic demos, platform tours, vague waitlist joins, or unsupported readiness claims for this wedge.

## Routine Pruning Rule

- During city launch, product/proof owns proof artifacts, demand/sales owns the sales ledger, and reliability owns send/reply durability.
- Agent work that does not change target, contact, draft, approval, send, reply, call, hosted-review start, exact-site request, capture ask, or blocker state does not count as progress.

## 14-Day Decision Rule

- Decision goal: 100 recipient-backed touches in the 14-day window.
- Current touches: 0.
- Remaining gap: 100.
- No organic signal recorded yet. After 100 touches or at day 14, change ICP, offer, artifact, or CTA instead of extending the same motion by default.
