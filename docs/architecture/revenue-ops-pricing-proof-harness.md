# Revenue Ops Pricing Proof Harness

Date: 2026-05-31
Status: Local design spec
Owner: `revenue-ops-pricing-agent`

## Purpose

Design a local proof harness that lets Blueprint prepare pricing and quote-band evidence without touching Stripe, sending buyer-facing quotes, granting entitlements, or making commercial commitments.

The harness proves consistency between public pricing display, buyer context, package truth, dry-run commerce shape, and approval routing. It does not prove live payment, live fulfillment, live package delivery, live hosted-session availability, payout readiness, or contract approval.

## Source Surfaces

The harness reads these repo-local surfaces first:

- Public pricing display: `client/src/pages/Pricing.tsx`, `client/src/components/site/OfferComparison.tsx`, and `client/src/data/marketingDefinitions.ts`
- Public route and buyer path inventory: `client/src/app/routes.tsx`
- Captured-site and package disclosure: `client/src/data/siteWorlds.ts` and `server/utils/site-worlds.ts`
- Buyer request and quote status state: `server/routes/inbound-request.ts`, `server/routes/admin-leads.ts`, and `server/types/inbound-request.ts`
- Dry-run agent commerce: `server/routes/agent-access.ts`, `server/utils/robot-agent-commerce.ts`, `scripts/agent-access/blueprint-agent-cli.ts`, and `docs/agent-access/robot-team-agent-access.md`
- Live payment and entitlement boundaries only as code contracts: `server/routes/api/create-checkout-session.ts`, `server/routes/stripe.ts`, `server/routes/stripe-webhooks.ts`, `server/routes/marketplace-entitlements.ts`, and `server/utils/accounting.ts`
- Revenue-ops ownership: `AUTONOMOUS_ORG.md`, `ops/paperclip/blueprint-company/agents/revenue-ops-pricing-agent/AGENTS.md`, `ops/paperclip/blueprint-company/agents/revenue-ops-pricing-agent/Tools.md`, `ops/paperclip/blueprint-company/agents/revenue-ops-pricing-agent/Heartbeat.md`, and `ops/paperclip/programs/revenue-ops-pricing-agent-program.md`
- Finance routing guardrails: `ops/paperclip/playbooks/robot-team-finance-support-routing-playbook.md`

Generated output should live under `output/revenue-ops/pricing-proof/latest/` and should be treated as local evidence only.

## Non-Goals

- No Stripe commands, Stripe API reads, checkout creation, webhook replay, payment intent checks, payout checks, invoice creation, refund action, or customer lookup.
- No live Firestore mutation, entitlement grant, package delivery, hosted-session fulfillment, Paperclip mutation, buyer send, or Notion write.
- No standard quote approval, discount approval, custom-term approval, contract approval, or founder decision.
- No claim that dry-run order, dry-run receipt, or dry-run entitlement proof is operational payment proof.

## Quote Band Schema

The harness should validate quote packets against `quote_band_v1`.

```json
{
  "schema": "quote_band_v1",
  "quoteId": "local-pricing-proof-<slug>",
  "mode": "local_proof",
  "buyerContext": {
    "buyerType": "robot_team",
    "buyerName": null,
    "company": null,
    "role": null,
    "sourceRecord": null,
    "siteWorldId": null,
    "siteName": null,
    "siteLocation": null,
    "workflow": null,
    "targetRobot": null,
    "proofPathPreference": null,
    "requestedStart": "site_package_access | hosted_review | custom_scope",
    "commercialQuestion": null
  },
  "quoteBand": {
    "path": "site_package_access | hosted_review | custom_scope",
    "publicDisplayLabel": "Site Package Access | Hosted Review | Custom Scope",
    "publicDisplayRange": {
      "currency": "usd",
      "minCents": 210000,
      "maxCents": 340000,
      "unit": "per_site_package"
    },
    "recommendedUnitAmountCents": null,
    "quantity": 1,
    "quantityUnit": "site_package | session_hour | scoped_program",
    "recommendedTotalCents": null,
    "approvalClass": "standard_owner_review | founder_required | blocked_missing_proof",
    "discount": {
      "requested": false,
      "percent": null,
      "approvalRequired": "none | standard_owner | founder"
    }
  },
  "proofInputs": {
    "publicPricingDisplay": [],
    "packageProof": null,
    "rightsProof": null,
    "buyerRequestProof": null,
    "dryRunCommerceProof": null,
    "deliveryScopeProof": null,
    "paymentProof": null,
    "fulfillmentProof": null
  },
  "checks": [],
  "blockedClaims": [],
  "approvalGates": [],
  "result": "pass | fail_closed"
}
```

Canonical bands for the first local version:

| Path | Public display | Unit | Local standard range | Approval baseline |
|---|---:|---|---:|---|
| `site_package_access` | `$2,100-$3,400` | one exact-site package | 210000-340000 cents | designated human commercial owner when proof is complete |
| `hosted_review` | `$16-$29 / session-hour` | positive integer session hours | 1600-2900 cents per hour | designated human commercial owner when proof is complete |
| `custom_scope` | `$50,000+ scoped` | scoped program | minimum 5000000 cents, no max | founder required |

The existing dry-run agent commerce defaults of `$2,400` for site-world package access and `$18 / session-hour` for hosted-session rental are acceptable local examples only when they remain inside the public display band and retain dry-run labels.

## Required Proof Inputs

Every local proof packet must include:

1. **Buyer context**: robot-team buyer status or fixture, company, role, exact commercial question, requested site/workflow, target robot class, and source thread or request id when available.
2. **Public pricing display**: parsed current public bands from `Pricing.tsx` and shared definitions from `marketingDefinitions.ts`.
3. **Package context**: `siteWorldId`, site name, package labels, `priceLabel`, data source, provenance summary, package manifest or artifact URI if present, and sample/planned/pipeline-backed disclosure.
4. **Rights and access context**: request-scoped rights status, privacy status, export limits, and any blocked rights/commercialization claims.
5. **Dry-run commerce context**: optional quote/order/receipt/entitlement shape from `agent-access` dry-run routes, with `mode=dry_run`, `livemode=false`, and null live Stripe identifiers.
6. **Operational payment proof pointer**: always `null` in this local harness unless a separately exported, human-supplied owner-system artifact is attached. The harness must not fetch it.
7. **Fulfillment proof pointer**: package access, hosted-session launch, or delivery proof pointer when already present in local artifacts. Absence keeps fulfillment claims blocked.
8. **Approval context**: standard-owner versus founder gate, discount request, non-standard term flags, and missing data list.

## Deterministic Checks

The harness should fail closed when any check cannot be proven locally.

### Public Pricing Checks

- Parse public display bands from `Pricing.tsx` and require the packet path to match one of `Site Package Access`, `Hosted Review`, or `Custom Scope`.
- Require the quote packet display label, route CTA, and contact URL path to match the selected path.
- Require site-package quotes to stay within `$2,100-$3,400` unless explicitly marked founder-gated.
- Require hosted-review quotes to use positive integer `sessionHours` and `$16-$29 / session-hour` unless explicitly marked founder-gated.
- Require custom scope to be `founder_required` and never auto-pass as standard-owner approval.

### Package And Buyer Checks

- Require `buyerType === "robot_team"` for robot-team commercial quote packets.
- Require exact site, workflow, and target robot context before standard quote guidance can pass.
- Treat planned profiles and samples as public display proof only. They can show product shape, not live availability, rights clearance, package delivery, or hosted fulfillment.
- Require package access language to remain tied to one exact site, request review, rights/privacy review, freshness, export limits, and buyer scope.
- Require hosted-review language to remain tied to account access, entitlement, package readiness, and hosted-session availability.

### Dry-Run Commerce Checks

- Allow only `mode: "dry_run"` for local commerce proof.
- Require dry-run order proof to include `dry_run: true`, `payment_status: "dry_run_paid"`, `stripe.livemode: false`, and null `checkout_session_id`, `payment_intent_id`, `customer_id`, and `charge_id`.
- Require dry-run entitlement proof to include `dry_run: true`, `source: "agent_dry_run"` or equivalent local label, and a SKU matching the selected site-world and product path.
- Block any conclusion that dry-run proof created a live Stripe Checkout Session, payment, customer, charge, payout, invoice, live package access, rights clearance, provider execution, or hosted fulfillment.

### Operational Proof Checks

- Payment readiness can pass only from Stripe-owned proof exported into the packet by a human or owner system. This harness must report `paymentProof: missing` by default.
- Fulfillment readiness can pass only from package, entitlement, rights, and hosted-session/runtime evidence already present in local artifacts. Missing evidence blocks the operational claim only; it does not weaken public display language.
- Entitlement readiness is not the same as payment proof. It proves access linkage only when the entitlement source, buyer id, SKU, access state, and site-world id match.
- A request or contact URL is not a quote approval, payment, entitlement grant, or fulfillment start.

### Approval Checks

- Standard site-package and hosted-review quote guidance routes to the designated human commercial owner only when buyer context, package context, rights/access context, and quote-band checks pass.
- Founder approval is required for custom scope, discounts outside approved guardrails, custom terms, contract language, revenue share, exclusivity changes, refund promises, delivery-date commitments, or package scope beyond current product truth.
- Rights/privacy ambiguity routes to `rights-provenance-agent` plus human review before quote approval.
- Technical capability ambiguity routes to `solutions-engineering-agent` before quote approval.
- Billing, invoice, refund, dispute, or procurement mechanics route through `finance-support-agent` for handoff packaging, but final decisions remain human-gated.

## Agent Buyer-Context Role

`revenue-ops-pricing-agent` should be the buyer-context pricing analyst, not the buyer-thread owner.

It may:

- prepare local quote-band packets;
- compare public pricing, catalog, package, delivery, buyer-success, and revenue truth;
- identify contradictions between public pricing display and operational proof;
- recommend standard-owner approval when all standard gates pass;
- recommend founder review when a request is non-standard;
- leave missing-data follow-up for buyer-solutions, solutions engineering, rights/provenance, finance support, or site catalog owners.

It must not:

- send a quote to a buyer;
- approve price, discount, custom term, refund, payout, invoice, or contract language;
- mutate Stripe, Firestore, Paperclip, Notion, hosted-session state, or package access;
- take over the active buyer journey from `buyer-solutions-agent`;
- treat qualification/readiness as the primary product being sold.

The output language should say "quote guidance" or "pricing proof packet", not "approved quote" unless the human commercial owner has recorded approval outside the harness.

## Approval Gate Matrix

| Scenario | Harness result | Owner |
|---|---|---|
| Site-package quote inside public band with complete buyer, package, rights, and scope proof | `standard_owner_review` | designated human commercial owner |
| Hosted-review quote inside public band with entitlement/package/runtime availability proof present | `standard_owner_review` | designated human commercial owner |
| Hosted-review quote inside public band but entitlement/runtime proof missing | `blocked_missing_proof` for operational fulfillment, public display still allowed | buyer-solutions plus solutions-engineering |
| Dry-run quote/order/entitlement proof only | `local_shape_pass_operational_blocked` | revenue-ops-pricing-agent |
| Planned or sample site only | `public_display_pass_operational_blocked` | buyer-solutions for request intake |
| Custom scope, exclusivity, discount exception, custom terms, revenue share, SLA, procurement, refund, or contract language | `founder_required` | founder |
| Rights, privacy, consent, or commercialization ambiguity | `blocked_missing_rights_proof` | rights-provenance-agent plus human review |
| Billing, invoice, dispute, refund, or payment mechanics question | `human_finance_handoff_required` | finance-support-agent plus human commercial/finance owner |

## Risks

- Public ranges can drift from dry-run defaults unless the harness parses both and reports inconsistencies.
- Dry-run entitlement proof can look stronger than it is. The harness must keep dry-run commerce, live payment, and live hosted fulfillment as separate proof classes.
- Static and sample listings can accidentally be treated as sellable inventory. The harness must require sample/planned/pipeline-backed disclosure in every packet.
- Custom scope can swallow unsupported delivery work. The harness must mark it founder-required instead of standard-owner approvable.
- Buyer-support, finance-support, and revenue-ops ownership can fragment the buyer thread. `buyer-solutions-agent` remains the live buyer-thread owner.
- Missing Stripe proof is expected in this local harness. The correct result is a blocked operational payment claim, not a weaker public pricing page.

## Minimum Local Report

Each run should write a markdown or JSON packet with:

- objective and input artifact paths;
- quote band and selected path;
- buyer-context summary;
- public display check results;
- package, rights, dry-run commerce, payment, and fulfillment proof classes;
- blocked claims;
- approval gate result;
- next owner and retry condition;
- explicit statement: `No Stripe command, live payment check, entitlement grant, package delivery, hosted-session fulfillment, buyer send, or commercial commitment was performed.`
