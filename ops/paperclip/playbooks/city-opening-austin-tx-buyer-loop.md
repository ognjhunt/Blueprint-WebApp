# Exact-Site Hosted Review Buyer Loop

- report_date: 2026-05-07
- city: Austin, TX
- ledger: ops/paperclip/playbooks/exact-site-hosted-review-gtm-ledger.json
- loop_status: blocked
- durability_status: blocked
- note: Filtered to Austin, TX.

## Daily Dashboard

| Metric | Value |
| --- | ---: |
| Target rows | 1 |
| Recipient-backed targets | 0 |
| Enrichment attempted targets | 1 |
| Enrichment candidate targets | 0 |
| Enrichment contact-found targets | 0 |
| Founder approval needed | 0 |
| Sent touches | 0 |
| Replies | 0 |
| Hosted-review starts | 0 |
| Qualified calls | 0 |
| Proof-ready artifacts | 1 |
| Capture asks | 0 |
| Explicit next-action rows | 1 |
| Open blockers | 4 |
| Paperclip-linked blockers | 4 |
| 100-touch decision gap | 100 |
| Days remaining | 3 |

## One Sales Ledger

| Target | Track | Recipient | Status | Approval | Next action |
| --- | --- | --- | --- | --- | --- |
| Simbe Robotics | proof_ready_outreach | missing | draft_ready | blocked | Find explicit recipient-backed contact evidence before founder first-send approval. |

## Recipient-Backed Contact Engine

- Run `npm run gtm:enrichment:run -- --write` to refresh provider-backed recipient evidence before founder approval.
- Clay or another enrichment tool may feed this lane only as a provider-normalized candidate source; the GTM ledger remains the system of record.

- gtm-001-simbe-retail-aisle-review: Simbe Robotics / Retail shelf-scanning robotics team / Find explicit recipient-backed contact evidence before founder first-send approval.

## Founder First Send Batch

- no recipient-backed drafts are ready for founder approval yet

## Proof Artifact Queue

- all rows in this view have review-ready or delivered proof artifacts

## Blocker Ledger

| Target | Blocker | Owner | Status | Paperclip issue | Next action |
| --- | --- | --- | --- | --- | --- |
| pilot | The active pilot has 12 target rows, below the 30-account floor needed before judging the wedge. | demand-intel-agent | open | BLU-5394 | Add real robot-team target rows from explicit buying signals while keeping recipient fields empty unless evidence-backed. |
| pilot | The active pilot has two proof-ready hosted-review artifacts, below the three-artifact scale checkpoint. | robot-team-growth-agent | open | BLU-5395 | Create or attach one more buyer-specific hosted-review artifact from real capture provenance, or keep the capture-ask track explicit until a real artifact exists. |
| gtm-001-simbe-retail-aisle-review: Simbe Robotics | Governed recipient discovery is blocked because BLUEPRINT_GTM_CONTACT_DISCOVERY_ALLOWED_HOSTS is not configured and no selected recipient evidence exists. | growth-lead | blocked | BLU-5392 | Configure a governed contact-discovery allowlist or record explicit recipient-backed evidence before founder first-send approval. |
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
