# Warehouse/Retail Workflow Capture Menu

Date: 2026-05-24
Status: draft-only, no approvals applied, no live sends authorized
Owner: `growth-lead`
Execution lane: `webapp-codex`
Source packet: `ops/paperclip/playbooks/exact-site-hosted-review-gtm-decision-packet-2026-05-24.md`

This menu narrows the Exact-Site Hosted Review first-touch ask for the structured-facility edit rows. It is a repo-local copy artifact only. It does not change the GTM ledger, approve a row, authorize a send, poll Gmail, call SendGrid, call Nitrosend, write Notion, trigger paid spend, or claim that any demand-sourced target already has a capture, package, or hosted review.

## Recommended Ask

Reply with the one workflow lane your team would want captured and hosted first. If the labeled sample is useful, inspect it as proof shape only.

## Menu

| Lane | Use when the target works on | Draft-safe wording |
| --- | --- | --- |
| Dock, trailer, pallet, and case movement | Truck unload, dock-to-line, forklift, pallet movement, case handling, palletizing, depalletizing, loading, yard/trailer movement | Which dock, trailer, pallet, or case-movement workflow would be worth capturing first? |
| Fulfillment aisle, tote, induction, picking, and replenishment | AMRs, goods-to-person ports, tote flow, picking, sortation, package handling, grocery fulfillment, order fulfillment | Which fulfillment aisle, tote, induction, picking, or replenishment workflow should be captured first? |
| Retail aisle and customer-facing service route | Retail shelf scanning, store service routes, grocery aisles, front-of-house structured routes | Which retail aisle or customer-facing service route would make an exact-site review useful? |
| Humanoid or AMR route inside a structured facility | Humanoids, AMRs, collaborative carts, fleet routes, material movement through known facility paths | Which humanoid or AMR route inside a structured facility should Blueprint capture first? |

## Proof Boundary

- Proof-ready control rows may point at labeled sample reviews as representative proof shape.
- Demand-sourced rows must say Blueprint does not have a target-specific capture, package, or hosted review yet.
- Recipient-backed evidence proves only the address source. It does not prove buyer intent, permission, customer status, or approval to make unsupported claims.
- Do not claim generated-world rank fidelity, rights clearance, provider execution, city readiness, package access, hosted-session fulfillment, replies, traction, qualified calls, or live availability from this draft menu.

## Row Mapping

| Target | Organization | Primary lane | Secondary lane | Draft note |
| --- | --- | --- | --- | --- |
| `gtm-004-boston-dynamics-stretch-warehouse` | Boston Dynamics | Dock, trailer, pallet, and case movement | Humanoid or AMR route inside a structured facility | Stretch-specific case handling and trailer unload framing. |
| `gtm-005-locus-fulfillment-amr` | Locus Robotics | Fulfillment aisle, tote, induction, picking, and replenishment | Humanoid or AMR route inside a structured facility | Fulfillment AMR workflow selection, not broad capture. |
| `gtm-006-seegrid-warehouse-amr` | Seegrid | Dock, trailer, pallet, and case movement | Humanoid or AMR route inside a structured facility | Material-movement route or dock-to-line framing. |
| `gtm-007-vecna-robotics-warehouse-orchestration` | Vecna Robotics | Humanoid or AMR route inside a structured facility | Fulfillment aisle, tote, induction, picking, and replenishment | Fleet-coordination route or warehouse workflow lane selection. |
| `gtm-008-fox-robotics-forklift-dock` | Fox Robotics | Dock, trailer, pallet, and case movement | Humanoid or AMR route inside a structured facility | Dock, trailer, pallet, or forklift lane selection. |
| `gtm-012-outrider-yard-automation` | Outrider | Dock, trailer, pallet, and case movement | Humanoid or AMR route inside a structured facility | Yard/trailer movement only; no city-live or readiness claim. |
| `gtm-covariant-identify-a-bin-picking-induction-or-item-handling-workflow-worth-capturi` | Covariant | Fulfillment aisle, tote, induction, picking, and replenishment | Dock, trailer, pallet, and case movement | Picking, induction, or item-handling lane selection. |
| `gtm-autostore-identify-a-goods-to-person-port-or-tote-flow-workflow-worth-capturing-fo` | AutoStore | Fulfillment aisle, tote, induction, picking, and replenishment | Dock, trailer, pallet, and case movement | Goods-to-person port and tote flow framing. |
| `gtm-greyorange-identify-a-fulfillment-picking-or-sortation-workflow-worth-capturing-for` | GreyOrange | Fulfillment aisle, tote, induction, picking, and replenishment | Humanoid or AMR route inside a structured facility | Fulfillment, picking, or sortation lane selection. |
| `gtm-exotec-identify-a-goods-to-person-picking-or-storage-workflow-worth-capturing-f` | Exotec | Fulfillment aisle, tote, induction, picking, and replenishment | Humanoid or AMR route inside a structured facility | Goods-to-person picking or storage lane selection. |
| `gtm-symbotic-identify-a-case-handling-palletizing-or-distribution-center-workflow-wor` | Symbotic | Dock, trailer, pallet, and case movement | Fulfillment aisle, tote, induction, picking, and replenishment | Case-handling, palletizing, or distribution-center lane selection. |
| `gtm-ocado-technology-identify-an-online-grocery-fulfillment-or-robotic-picking-workflow-worth` | Ocado Technology | Fulfillment aisle, tote, induction, picking, and replenishment | Retail aisle and customer-facing service route | Online grocery fulfillment or robotic picking lane selection. |
| `gtm-berkshire-grey-identify-a-package-handling-sortation-or-fulfillment-workflow-worth-capt` | Berkshire Grey | Fulfillment aisle, tote, induction, picking, and replenishment | Dock, trailer, pallet, and case movement | Package handling, sortation, or fulfillment lane selection. |
| `gtm-righthand-robotics-identify-a-piece-picking-or-order-fulfillment-cell-worth-capturing-for-e` | RightHand Robotics | Fulfillment aisle, tote, induction, picking, and replenishment | Dock, trailer, pallet, and case movement | Piece-picking or order-fulfillment workcell lane selection. |
| `gtm-mujin-identify-a-depalletizing-truck-unloading-or-material-handling-workflow-w` | Mujin | Dock, trailer, pallet, and case movement | Fulfillment aisle, tote, induction, picking, and replenishment | Depalletizing, truck unloading, or material-handling lane selection. |
| `gtm-dexterity-identify-a-truck-loading-palletizing-or-warehouse-manipulation-workflow-` | Dexterity | Dock, trailer, pallet, and case movement | Fulfillment aisle, tote, induction, picking, and replenishment | Truck loading, palletizing, or warehouse manipulation lane selection. |
| `gtm-robust-ai-identify-a-warehouse-cart-tote-or-collaborative-material-movement-workfl` | Robust.AI | Humanoid or AMR route inside a structured facility | Fulfillment aisle, tote, induction, picking, and replenishment | Collaborative cart, tote, or material-movement lane selection. |
| `gtm-zebra-robotics-automation-identify-a-picking-replenishment-or-fulfillment-amr-workflow-worth-captu` | Zebra Robotics Automation | Fulfillment aisle, tote, induction, picking, and replenishment | Humanoid or AMR route inside a structured facility | Picking, replenishment, or fulfillment AMR lane selection. |

## Approval Boundary

This artifact can be attached to a future founder/operator review packet. It should not be used as approval by itself.

Before any row can move beyond draft:

- the row-level approval packet must still record an explicit founder/operator `approve`, `edit`, or `reject` decision;
- `npm run gtm:first-send-approval:apply -- --write` must only run after explicit decisions exist;
- `npm run gtm:send -- --dry-run --allow-blocked` must still show safe gated behavior before live dispatch;
- live dispatch requires separate explicit authorization after reply durability passes.
