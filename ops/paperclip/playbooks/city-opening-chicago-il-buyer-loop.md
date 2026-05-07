# Exact-Site Hosted Review Buyer Loop

- report_date: 2026-05-07
- city: Chicago, IL
- ledger: ops/paperclip/playbooks/exact-site-hosted-review-gtm-ledger.json
- loop_status: blocked
- durability_status: blocked
- note: No city-specific rows matched Chicago, IL; using the global target queue until this city adds its own rows.

## Daily Dashboard

| Metric | Value |
| --- | ---: |
| Target rows | 12 |
| Recipient-backed targets | 0 |
| Enrichment attempted targets | 12 |
| Enrichment candidate targets | 0 |
| Enrichment contact-found targets | 0 |
| Founder approval needed | 0 |
| Sent touches | 0 |
| Replies | 0 |
| Hosted-review starts | 0 |
| Qualified calls | 0 |
| Proof-ready artifacts | 2 |
| Capture asks | 10 |
| Explicit next-action rows | 12 |
| Open blockers | 26 |
| Paperclip-linked blockers | 26 |
| 100-touch decision gap | 100 |
| Days remaining | 3 |

## One Sales Ledger

| Target | Track | Recipient | Status | Approval | Next action |
| --- | --- | --- | --- | --- | --- |
| Simbe Robotics | proof_ready_outreach | missing | draft_ready | blocked | Find explicit recipient-backed contact evidence before founder first-send approval. |
| Brain Corp | proof_ready_outreach | missing | draft_ready | blocked | Find explicit recipient-backed contact evidence before founder first-send approval. |
| Agility Robotics | demand_sourced_capture | missing | draft_ready | blocked | Find explicit recipient-backed contact evidence before founder first-send approval. |
| Boston Dynamics | demand_sourced_capture | missing | draft_ready | blocked | Find explicit recipient-backed contact evidence before founder first-send approval. |
| Locus Robotics | demand_sourced_capture | missing | draft_ready | blocked | Find explicit recipient-backed contact evidence before founder first-send approval. |
| Seegrid | demand_sourced_capture | missing | draft_ready | blocked | Find explicit recipient-backed contact evidence before founder first-send approval. |
| Vecna Robotics | demand_sourced_capture | missing | draft_ready | blocked | Find explicit recipient-backed contact evidence before founder first-send approval. |
| Fox Robotics | demand_sourced_capture | missing | draft_ready | blocked | Find explicit recipient-backed contact evidence before founder first-send approval. |
| Diligent Robotics | demand_sourced_capture | missing | draft_ready | blocked | Find explicit recipient-backed contact evidence before founder first-send approval. |
| Gecko Robotics | demand_sourced_capture | missing | draft_ready | blocked | Find explicit recipient-backed contact evidence before founder first-send approval. |
| ANYbotics | demand_sourced_capture | missing | draft_ready | blocked | Find explicit recipient-backed contact evidence before founder first-send approval. |
| Outrider | demand_sourced_capture | missing | draft_ready | blocked | Find explicit recipient-backed contact evidence before founder first-send approval. |

## Recipient-Backed Contact Engine

- Run `npm run gtm:enrichment:run -- --write` to refresh provider-backed recipient evidence before founder approval.
- Clay or another enrichment tool may feed this lane only as a provider-normalized candidate source; the GTM ledger remains the system of record.

- gtm-001-simbe-retail-aisle-review: Simbe Robotics / Retail shelf-scanning robotics team / Find explicit recipient-backed contact evidence before founder first-send approval.
- gtm-002-braincorp-retail-service-review: Brain Corp / Retail and commercial service robotics team / Find explicit recipient-backed contact evidence before founder first-send approval.
- gtm-003-agility-warehouse-humanoid: Agility Robotics / Warehouse humanoid deployment team / Find explicit recipient-backed contact evidence before founder first-send approval.
- gtm-004-boston-dynamics-stretch-warehouse: Boston Dynamics / Warehouse case-handling robotics team / Find explicit recipient-backed contact evidence before founder first-send approval.
- gtm-005-locus-fulfillment-amr: Locus Robotics / Fulfillment AMR deployment team / Find explicit recipient-backed contact evidence before founder first-send approval.
- gtm-006-seegrid-warehouse-amr: Seegrid / Autonomous industrial vehicle team / Find explicit recipient-backed contact evidence before founder first-send approval.
- gtm-007-vecna-robotics-warehouse-orchestration: Vecna Robotics / Warehouse automation and orchestration team / Find explicit recipient-backed contact evidence before founder first-send approval.
- gtm-008-fox-robotics-forklift-dock: Fox Robotics / Autonomous forklift deployment team / Find explicit recipient-backed contact evidence before founder first-send approval.
- gtm-009-diligent-healthcare-service-route: Diligent Robotics / Healthcare service robot deployment team / Find explicit recipient-backed contact evidence before founder first-send approval.
- gtm-010-gecko-industrial-inspection: Gecko Robotics / Industrial inspection robotics team / Find explicit recipient-backed contact evidence before founder first-send approval.
- gtm-011-anybotics-industrial-inspection: ANYbotics / Autonomous industrial inspection team / Find explicit recipient-backed contact evidence before founder first-send approval.
- gtm-012-outrider-yard-automation: Outrider / Autonomous yard operations team / Find explicit recipient-backed contact evidence before founder first-send approval.

## Founder First Send Batch

- no recipient-backed drafts are ready for founder approval yet

## Proof Artifact Queue

- gtm-003-agility-warehouse-humanoid: Agility Robotics / Warehouse humanoid deployment team / Find explicit recipient-backed contact evidence before founder first-send approval.
- gtm-004-boston-dynamics-stretch-warehouse: Boston Dynamics / Warehouse case-handling robotics team / Find explicit recipient-backed contact evidence before founder first-send approval.
- gtm-005-locus-fulfillment-amr: Locus Robotics / Fulfillment AMR deployment team / Find explicit recipient-backed contact evidence before founder first-send approval.
- gtm-006-seegrid-warehouse-amr: Seegrid / Autonomous industrial vehicle team / Find explicit recipient-backed contact evidence before founder first-send approval.
- gtm-007-vecna-robotics-warehouse-orchestration: Vecna Robotics / Warehouse automation and orchestration team / Find explicit recipient-backed contact evidence before founder first-send approval.
- gtm-008-fox-robotics-forklift-dock: Fox Robotics / Autonomous forklift deployment team / Find explicit recipient-backed contact evidence before founder first-send approval.
- gtm-009-diligent-healthcare-service-route: Diligent Robotics / Healthcare service robot deployment team / Find explicit recipient-backed contact evidence before founder first-send approval.
- gtm-010-gecko-industrial-inspection: Gecko Robotics / Industrial inspection robotics team / Find explicit recipient-backed contact evidence before founder first-send approval.
- gtm-011-anybotics-industrial-inspection: ANYbotics / Autonomous industrial inspection team / Find explicit recipient-backed contact evidence before founder first-send approval.
- gtm-012-outrider-yard-automation: Outrider / Autonomous yard operations team / Find explicit recipient-backed contact evidence before founder first-send approval.

## Blocker Ledger

| Target | Blocker | Owner | Status | Paperclip issue | Next action |
| --- | --- | --- | --- | --- | --- |
| pilot | The active pilot has 12 target rows, below the 30-account floor needed before judging the wedge. | demand-intel-agent | open | BLU-5394 | Add real robot-team target rows from explicit buying signals while keeping recipient fields empty unless evidence-backed. |
| pilot | The active pilot has two proof-ready hosted-review artifacts, below the three-artifact scale checkpoint. | robot-team-growth-agent | open | BLU-5395 | Create or attach one more buyer-specific hosted-review artifact from real capture provenance, or keep the capture-ask track explicit until a real artifact exists. |
| gtm-001-simbe-retail-aisle-review: Simbe Robotics | Governed recipient discovery is blocked because BLUEPRINT_GTM_CONTACT_DISCOVERY_ALLOWED_HOSTS is not configured and no selected recipient evidence exists. | growth-lead | blocked | BLU-5392 | Configure a governed contact-discovery allowlist or record explicit recipient-backed evidence before founder first-send approval. |
| gtm-001-simbe-retail-aisle-review: Simbe Robotics | Buyer sends and replies cannot be treated as production-durable until sender verification and Gmail human-reply watcher credentials are configured. | growth-lead | blocked | BLU-5393 | Set sender verification, human-reply ingest token, approved identity, enable Gmail watcher, and provide Gmail OAuth credentials before counting live replies as durable. |
| gtm-002-braincorp-retail-service-review: Brain Corp | Governed recipient discovery is blocked because BLUEPRINT_GTM_CONTACT_DISCOVERY_ALLOWED_HOSTS is not configured and no selected recipient evidence exists. | growth-lead | blocked | BLU-5392 | Configure a governed contact-discovery allowlist or record explicit recipient-backed evidence before founder first-send approval. |
| gtm-002-braincorp-retail-service-review: Brain Corp | Buyer sends and replies cannot be treated as production-durable until sender verification and Gmail human-reply watcher credentials are configured. | growth-lead | blocked | BLU-5393 | Set sender verification, human-reply ingest token, approved identity, enable Gmail watcher, and provide Gmail OAuth credentials before counting live replies as durable. |
| gtm-003-agility-warehouse-humanoid: Agility Robotics | Governed recipient discovery is blocked because BLUEPRINT_GTM_CONTACT_DISCOVERY_ALLOWED_HOSTS is not configured and no selected recipient evidence exists. | growth-lead | blocked | BLU-5392 | Configure a governed contact-discovery allowlist or record explicit recipient-backed evidence before founder first-send approval. |
| gtm-003-agility-warehouse-humanoid: Agility Robotics | Buyer sends and replies cannot be treated as production-durable until sender verification and Gmail human-reply watcher credentials are configured. | growth-lead | blocked | BLU-5393 | Set sender verification, human-reply ingest token, approved identity, enable Gmail watcher, and provide Gmail OAuth credentials before counting live replies as durable. |
| gtm-004-boston-dynamics-stretch-warehouse: Boston Dynamics | Governed recipient discovery is blocked because BLUEPRINT_GTM_CONTACT_DISCOVERY_ALLOWED_HOSTS is not configured and no selected recipient evidence exists. | growth-lead | blocked | BLU-5392 | Configure a governed contact-discovery allowlist or record explicit recipient-backed evidence before founder first-send approval. |
| gtm-004-boston-dynamics-stretch-warehouse: Boston Dynamics | Buyer sends and replies cannot be treated as production-durable until sender verification and Gmail human-reply watcher credentials are configured. | growth-lead | blocked | BLU-5393 | Set sender verification, human-reply ingest token, approved identity, enable Gmail watcher, and provide Gmail OAuth credentials before counting live replies as durable. |
| gtm-005-locus-fulfillment-amr: Locus Robotics | Governed recipient discovery is blocked because BLUEPRINT_GTM_CONTACT_DISCOVERY_ALLOWED_HOSTS is not configured and no selected recipient evidence exists. | growth-lead | blocked | BLU-5392 | Configure a governed contact-discovery allowlist or record explicit recipient-backed evidence before founder first-send approval. |
| gtm-005-locus-fulfillment-amr: Locus Robotics | Buyer sends and replies cannot be treated as production-durable until sender verification and Gmail human-reply watcher credentials are configured. | growth-lead | blocked | BLU-5393 | Set sender verification, human-reply ingest token, approved identity, enable Gmail watcher, and provide Gmail OAuth credentials before counting live replies as durable. |
| gtm-006-seegrid-warehouse-amr: Seegrid | Governed recipient discovery is blocked because BLUEPRINT_GTM_CONTACT_DISCOVERY_ALLOWED_HOSTS is not configured and no selected recipient evidence exists. | growth-lead | blocked | BLU-5392 | Configure a governed contact-discovery allowlist or record explicit recipient-backed evidence before founder first-send approval. |
| gtm-006-seegrid-warehouse-amr: Seegrid | Buyer sends and replies cannot be treated as production-durable until sender verification and Gmail human-reply watcher credentials are configured. | growth-lead | blocked | BLU-5393 | Set sender verification, human-reply ingest token, approved identity, enable Gmail watcher, and provide Gmail OAuth credentials before counting live replies as durable. |
| gtm-007-vecna-robotics-warehouse-orchestration: Vecna Robotics | Governed recipient discovery is blocked because BLUEPRINT_GTM_CONTACT_DISCOVERY_ALLOWED_HOSTS is not configured and no selected recipient evidence exists. | growth-lead | blocked | BLU-5392 | Configure a governed contact-discovery allowlist or record explicit recipient-backed evidence before founder first-send approval. |
| gtm-007-vecna-robotics-warehouse-orchestration: Vecna Robotics | Buyer sends and replies cannot be treated as production-durable until sender verification and Gmail human-reply watcher credentials are configured. | growth-lead | blocked | BLU-5393 | Set sender verification, human-reply ingest token, approved identity, enable Gmail watcher, and provide Gmail OAuth credentials before counting live replies as durable. |
| gtm-008-fox-robotics-forklift-dock: Fox Robotics | Governed recipient discovery is blocked because BLUEPRINT_GTM_CONTACT_DISCOVERY_ALLOWED_HOSTS is not configured and no selected recipient evidence exists. | growth-lead | blocked | BLU-5392 | Configure a governed contact-discovery allowlist or record explicit recipient-backed evidence before founder first-send approval. |
| gtm-008-fox-robotics-forklift-dock: Fox Robotics | Buyer sends and replies cannot be treated as production-durable until sender verification and Gmail human-reply watcher credentials are configured. | growth-lead | blocked | BLU-5393 | Set sender verification, human-reply ingest token, approved identity, enable Gmail watcher, and provide Gmail OAuth credentials before counting live replies as durable. |
| gtm-009-diligent-healthcare-service-route: Diligent Robotics | Governed recipient discovery is blocked because BLUEPRINT_GTM_CONTACT_DISCOVERY_ALLOWED_HOSTS is not configured and no selected recipient evidence exists. | growth-lead | blocked | BLU-5392 | Configure a governed contact-discovery allowlist or record explicit recipient-backed evidence before founder first-send approval. |
| gtm-009-diligent-healthcare-service-route: Diligent Robotics | Buyer sends and replies cannot be treated as production-durable until sender verification and Gmail human-reply watcher credentials are configured. | growth-lead | blocked | BLU-5393 | Set sender verification, human-reply ingest token, approved identity, enable Gmail watcher, and provide Gmail OAuth credentials before counting live replies as durable. |
| gtm-010-gecko-industrial-inspection: Gecko Robotics | Governed recipient discovery is blocked because BLUEPRINT_GTM_CONTACT_DISCOVERY_ALLOWED_HOSTS is not configured and no selected recipient evidence exists. | growth-lead | blocked | BLU-5392 | Configure a governed contact-discovery allowlist or record explicit recipient-backed evidence before founder first-send approval. |
| gtm-010-gecko-industrial-inspection: Gecko Robotics | Buyer sends and replies cannot be treated as production-durable until sender verification and Gmail human-reply watcher credentials are configured. | growth-lead | blocked | BLU-5393 | Set sender verification, human-reply ingest token, approved identity, enable Gmail watcher, and provide Gmail OAuth credentials before counting live replies as durable. |
| gtm-011-anybotics-industrial-inspection: ANYbotics | Governed recipient discovery is blocked because BLUEPRINT_GTM_CONTACT_DISCOVERY_ALLOWED_HOSTS is not configured and no selected recipient evidence exists. | growth-lead | blocked | BLU-5392 | Configure a governed contact-discovery allowlist or record explicit recipient-backed evidence before founder first-send approval. |
| gtm-011-anybotics-industrial-inspection: ANYbotics | Buyer sends and replies cannot be treated as production-durable until sender verification and Gmail human-reply watcher credentials are configured. | growth-lead | blocked | BLU-5393 | Set sender verification, human-reply ingest token, approved identity, enable Gmail watcher, and provide Gmail OAuth credentials before counting live replies as durable. |
| gtm-012-outrider-yard-automation: Outrider | Governed recipient discovery is blocked because BLUEPRINT_GTM_CONTACT_DISCOVERY_ALLOWED_HOSTS is not configured and no selected recipient evidence exists. | growth-lead | blocked | BLU-5392 | Configure a governed contact-discovery allowlist or record explicit recipient-backed evidence before founder first-send approval. |
| gtm-012-outrider-yard-automation: Outrider | Buyer sends and replies cannot be treated as production-durable until sender verification and Gmail human-reply watcher credentials are configured. | growth-lead | blocked | BLU-5393 | Set sender verification, human-reply ingest token, approved identity, enable Gmail watcher, and provide Gmail OAuth credentials before counting live replies as durable. |

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
