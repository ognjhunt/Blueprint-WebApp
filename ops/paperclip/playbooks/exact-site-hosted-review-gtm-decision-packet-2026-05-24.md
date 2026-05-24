# Exact-Site Hosted Review GTM Decision Packet

Date: 2026-05-24 UTC
Status: repo-local no-send decision packet
Owner: `growth-lead`
Execution lane: `webapp-codex`
Routing surface: repo-local only; no Slack, email, Gmail polling, SendGrid, Notion, Stripe, paid spend, or live dispatch

## Decision

Do not approve the current 30-row batch as one unchanged first-send motion.

Recommended next ICP: structured-facility robot teams doing warehouse, fulfillment, retail aisle, dock, trailer, tote, picking, replenishment, or AMR/forklift/humanoid material-movement work.

Recommended change: narrow the first decision batch to structured-facility workflows and change the offer from a broad "what exact site should Blueprint capture?" ask into a concrete "choose one workflow lane for a capture-backed hosted review" ask. The artifact should become a short Warehouse/Retail Workflow Capture Menu that names 3-4 concrete lanes and routes the recipient to pick one:

- dock, trailer unload, forklift, or pallet movement
- fulfillment aisle, tote flow, induction, picking, or replenishment
- retail aisle or customer-facing service route
- humanoid/AMR route review inside a structured facility

Recommended CTA: "Reply with the one workflow lane your team would want captured and hosted first; if the labeled sample is useful, inspect it as proof shape only."

This changes ICP, artifact, and CTA instead of extending the same 14-day motion by default. It preserves the product doctrine: capture-first, world-model-product-first, and no claim that demand-sourced rows already have hosted reviews.

## Proof State

Current repo-safe evidence says the lane is packet-ready, not send-ready.

| Evidence | Result |
| --- | --- |
| `npm run gtm:hosted-review:audit -- --allow-blocked` | `ready_with_warnings`; 30 targets; 30 recipient-backed; 30 draft-ready; 30 founder approval needed; 0 sent; 0 replies; 0 hosted-review starts; 12 open blockers; decision status `decision_due`; 100-touch gap `100` |
| `npm run gtm:hosted-review:buyer-loop -- --allow-blocked --skip-durability` | `loop_status: decision_due`; `durability_status: unknown`; 30 recipient-backed targets; 0 sent touches; 0 replies; 0 hosted-review starts; day-14 rule says change ICP, offer, artifact, or CTA |
| `npm run gtm:first-send-approval:template -- --write` | refreshed `ops/paperclip/playbooks/exact-site-hosted-review-first-send-approval.template.json`; 30 approval rows; 0 approvals recorded |
| `npm run gtm:send -- --write --dry-run --allow-blocked` | wrote `ops/paperclip/reports/gtm-send-executor/2026-05-24/send-executor-manifest.json`; `eligible: 0`; `sent: 0`; `skippedApproval: 30`; `failed: 1` because no draft is founder/operator approved |

No command sent email, polled Gmail, used SendGrid, mutated Notion, changed Stripe/payment state, triggered paid spend, claimed replies, or started a hosted review.

## Row Disposition

These dispositions are for the next founder/operator review pass. They do not apply approvals and do not authorize sends.

### Stay

Keep these as the proof-shape control rows. They may stay in the approval packet, but only as labeled representative proof, not customer proof or buyer-specific proof.

| Target | Why |
| --- | --- |
| `gtm-001-simbe-retail-aisle-review` - Simbe Robotics | Structured retail aisle workflow and existing labeled sample-review handoff. Keep as proof-shape control. |
| `gtm-002-braincorp-retail-service-review` - Brain Corp | Structured retail/commercial service workflow and existing labeled sample-review handoff. Keep as proof-shape control. |
| `gtm-003-agility-warehouse-humanoid` - Agility Robotics | Closest fit to the recommended structured-facility ICP and existing hosted-review handoff. Keep as the first proof-led row. |

### Edit

Keep these targets, but edit the first-touch copy before approval so they receive the narrowed Warehouse/Retail Workflow Capture Menu and the new lane-selection CTA. Do not pitch a hosted review as ready for these rows.

| Target | Edit direction |
| --- | --- |
| `gtm-004-boston-dynamics-stretch-warehouse` - Boston Dynamics | Move from broad capture ask to dock/trailer/case-handling workflow lane selection. |
| `gtm-005-locus-fulfillment-amr` - Locus Robotics | Move from broad capture ask to fulfillment aisle, tote, induction, or replenishment lane selection. |
| `gtm-006-seegrid-warehouse-amr` - Seegrid | Move from broad capture ask to material-movement route or dock-to-line lane selection. |
| `gtm-007-vecna-robotics-warehouse-orchestration` - Vecna Robotics | Move from broad capture ask to fleet-coordination route or warehouse workflow lane selection. |
| `gtm-008-fox-robotics-forklift-dock` - Fox Robotics | Move from broad capture ask to dock, trailer, pallet, or forklift lane selection. |
| `gtm-012-outrider-yard-automation` - Outrider | Keep as logistics-adjacent, but frame as yard/trailer movement only; no city-live or hosted-review-ready claim. |
| `gtm-covariant-identify-a-bin-picking-induction-or-item-handling-workflow-worth-capturi` - Covariant | Move to picking, induction, or item-handling lane selection. |
| `gtm-autostore-identify-a-goods-to-person-port-or-tote-flow-workflow-worth-capturing-fo` - AutoStore | Move to goods-to-person port or tote flow lane selection. |
| `gtm-greyorange-identify-a-fulfillment-picking-or-sortation-workflow-worth-capturing-for` - GreyOrange | Move to fulfillment, picking, or sortation lane selection. |
| `gtm-exotec-identify-a-goods-to-person-picking-or-storage-workflow-worth-capturing-f` - Exotec | Move to goods-to-person picking or storage lane selection. |
| `gtm-symbotic-identify-a-case-handling-palletizing-or-distribution-center-workflow-wor` - Symbotic | Move to case-handling, palletizing, or distribution-center lane selection. |
| `gtm-ocado-technology-identify-an-online-grocery-fulfillment-or-robotic-picking-workflow-worth` - Ocado Technology | Move to online grocery fulfillment or robotic picking lane selection. |
| `gtm-berkshire-grey-identify-a-package-handling-sortation-or-fulfillment-workflow-worth-capt` - Berkshire Grey | Move to package-handling, sortation, or fulfillment lane selection. |
| `gtm-righthand-robotics-identify-a-piece-picking-or-order-fulfillment-cell-worth-capturing-for-e` - RightHand Robotics | Move to piece-picking or order-fulfillment cell lane selection. |
| `gtm-mujin-identify-a-depalletizing-truck-unloading-or-material-handling-workflow-w` - Mujin | Move to depalletizing, truck unloading, or material-handling lane selection. |
| `gtm-dexterity-identify-a-truck-loading-palletizing-or-warehouse-manipulation-workflow-` - Dexterity | Move to truck loading, palletizing, or warehouse manipulation lane selection. |
| `gtm-robust-ai-identify-a-warehouse-cart-tote-or-collaborative-material-movement-workfl` - Robust.AI | Move to warehouse cart, tote, or collaborative material movement lane selection. |
| `gtm-zebra-robotics-automation-identify-a-picking-replenishment-or-fulfillment-amr-workflow-worth-captu` - Zebra Robotics Automation | Move to picking, replenishment, or fulfillment AMR lane selection. |

### Reject For This Batch

Do not send these current drafts in the first decision batch. They are not rejected as companies; the current copy/artifact is rejected because the workflow is too sensitive or too far from the narrowed ICP without a stronger proof or rights/privacy packet.

| Target | Reason |
| --- | --- |
| `gtm-009-diligent-healthcare-service-route` - Diligent Robotics | Healthcare routes carry privacy and permission sensitivity. Needs a healthcare-specific rights/privacy-safe artifact before first touch. |
| `gtm-knightscope-identify-a-patrol-route-lobby-parking-or-facility-security-workflow-wort` - Knightscope | Security/patrol workflows can imply safety, surveillance, or deployment readiness. Needs a separate security/procurement-safe artifact before outreach. |

### Lower Priority

Keep these rows in the ledger, but do not include them in the first approval batch unless the founder explicitly wants a wider ICP. They should wait for a vertical-specific artifact or a clearer proof path.

| Target | Reason |
| --- | --- |
| `gtm-010-gecko-industrial-inspection` - Gecko Robotics | Industrial inspection is valid but not the first structured-facility ICP. |
| `gtm-011-anybotics-industrial-inspection` - ANYbotics | Industrial inspection is valid but needs a stronger inspection-route artifact. |
| `gtm-skydio-identify-an-industrial-inspection-route-or-facility-workflow-worth-captu` - Skydio | Drone inspection route differs from current indoor structured-facility wedge. |
| `gtm-zipline-identify-a-loading-dispatch-or-delivery-operations-workflow-worth-captur` - Zipline | Delivery operations are adjacent but less aligned to current hosted-review artifact. |
| `gtm-serve-robotics-identify-a-restaurant-handoff-sidewalk-route-or-curbside-delivery-workfl` - Serve Robotics | Sidewalk delivery needs a public-space route artifact and access posture. |
| `gtm-nuro-identify-a-curbside-pickup-delivery-staging-or-goods-handoff-workflow-wo` - Nuro | Curbside/goods delivery is adjacent and should wait for delivery-specific proof. |
| `gtm-starship-technologies-identify-a-campus-retail-or-sidewalk-delivery-workflow-worth-capturing-f` - Starship Technologies | Sidewalk/campus delivery should wait for a public-space route proof packet. |

## Founder Approval Scope

If the founder/operator approves the next packet, that approval should approve only:

- row-level `approve`, `edit`, or `reject` decisions in `ops/paperclip/playbooks/exact-site-hosted-review-first-send-approval.template.json`
- the selected target order and the narrowed structured-facility ICP
- the exact proposed subject/body, draft angle, CTA, landing page, proof source, objection plan, and blocked claims for each approved row
- permission to apply decisions into the ledger with the documented approval apply command after the packet is edited

It does not approve:

- live email sends or SendGrid execution
- Gmail polling or live mailbox access
- reply durability, sender verification, or watcher readiness
- Notion mutation, Stripe/payment changes, paid spend, public posting, or broad outbound scale
- pricing, legal, privacy, rights, permission, security, procurement, or deployment commitments
- claims of replies, hosted-review starts, customer traction, active prospects, package access, city readiness, or provider execution

## Repo-Safe Work Still Available

These can be done without live sends or external-state mutation after the founder chooses the direction:

1. Edit the approval template decisions to mark the rows above as approve/edit/reject/lower-priority review notes.
2. Create the Warehouse/Retail Workflow Capture Menu as a repo-local artifact tied to the first 18 edited structured-facility rows.
3. Rewrite the edited rows' first-touch copy to use the new lane-selection CTA and preserve the demand-sourced no-hosted-review claim boundary.
4. Normalize stale `sales.nextAction` text in the first 12 ledger rows so it no longer says recipient evidence is missing where recipient-backed evidence now exists.
5. Rerun `npm run gtm:hosted-review:audit -- --allow-blocked` and `npm run gtm:send -- --write --dry-run --allow-blocked`.

## Remaining Live Or Human-Gated Blockers

These are not solved by this packet and were intentionally not attempted:

| Blocker | Current evidence | Exact unblock |
| --- | --- | --- |
| First-send approval | Send dry-run reports `skippedApproval: 30` and `eligible: 0`. | Founder/operator records explicit row decisions, then the approval apply command is run. |
| Reply durability | 12 open target blockers reference `gtm-blocker-buyer-reply-durability` / `BLU-5393`. | Configure sender verification, human-reply ingest token, approved reply identity, Gmail OAuth credentials/status, and watcher readiness; prove with the safe durability audit before live sends. |
| Live dispatch authorization | This packet is no-send and the send dry-run produced no receipts. | After approval decisions and reply durability pass, live dispatch still needs separate explicit authorization. |
| Hosted-review starts | Audit and buyer-loop both report `hostedReviewStarts: 0`. | Only count starts after ledger/runtime or buyer-facing evidence exists. |
| Replies and qualified calls | Audit and buyer-loop both report `replies: 0` and `qualifiedCalls: 0`. | Only count replies/calls from durable reply records or qualified-call evidence. |
| Paid scale | Ledger records `paidScaleAllowed: false` and paid spend `0`. | Paid scale remains blocked until organic replies, hosted-review starts, or qualified calls exist in the ledger. |

## Closeout State

State claimed: `done` for repo-safe packet creation.

Objective: turn the current repo-safe Exact-Site Hosted Review GTM state into a no-send founder/operator decision packet with proof.

Issue/run id: unknown; this is a repo-local `/goal` packet and no live Paperclip mutation was required.

Stage reached: decision packet written, approval template refreshed, dry-run send artifact written.

Proof paths:

- `ops/paperclip/playbooks/exact-site-hosted-review-gtm-decision-packet-2026-05-24.md`
- `ops/paperclip/playbooks/exact-site-hosted-review-gtm-ledger.json`
- `ops/paperclip/playbooks/exact-site-hosted-review-first-send-approval.template.json`
- `ops/paperclip/reports/gtm-send-executor/2026-05-24/send-executor-manifest.json`
- `server/utils/exactSiteHostedReviewBuyerLoop.ts`

Retry/resume condition: resume only after the founder/operator chooses whether to apply this disposition, edit the approval template, and authorize the next repo-safe row rewrite. Live send remains separately blocked until reply durability and live dispatch authorization exist.

Residual risk: this packet is based on current repo ledger and generated dry-run artifacts only; no live mailbox, SendGrid, Notion, Stripe, hosted-session runtime, or Paperclip production state was mutated or polled.
