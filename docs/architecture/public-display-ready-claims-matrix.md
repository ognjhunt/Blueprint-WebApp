# Public Launch Ready Claims Matrix

Date: 2026-06-02

Status: Active public-display and claims guardrail for `Blueprint-WebApp`.

Purpose: separate polished public presentation from operational launch proof so agents do not downgrade buyer-facing pages just because backend, provider, city, rights, payment, payout, hosted-session, or support-loop proof is still request-specific.

## Core Rule

Public Launch Ready is the default public posture for Blueprint routes. Public brand, buyer, investor, capturer, and operator surfaces should present Blueprint as a complete, premium, operational product experience with confident present-tense service language. Incomplete backend, ops, provider, payment, payout, city-launch, hosted-session, or support-loop proof is not by itself a public-copy blocker.

Do not add broad apology, "not launched yet", "coming soon", "not ready", "we are still building", "future service", "placeholder", "demo only", or "operationally not ready" language just because operational launch proof is request-specific. Only a specific unsupported claim about real customers, real traction metrics, cleared rights, completed provider execution, completed payments, live payouts, active city coverage, guaranteed package access, guaranteed hosted-session fulfillment, or guaranteed launch outcomes must be blocked or qualified.

Agents should ask:

> Does this sentence invent a specific unsupported fact?

They should not ask:

> Are we operationally launched enough to say anything polished?

Caveats belong in proof, detail, access-review, pricing-scope, or request-review areas. They should not weaken hero copy, route headings, primary CTAs, or first-screen service posture unless the first-screen sentence itself would otherwise invent a false fact.

## Definitions

| Standard | Meaning | Proof Needed |
|---|---|---|
| Public Launch Ready | The default posture for public routes: the public site, app, buyer workflow, investor showcase, capturer path, and operator surfaces look complete, confident, premium, present-tense, and service-ready. | Repo doctrine, current public route behavior, truthful sample/demo labels, and a claim-level review. |
| Public Display Ready | Older name for the same public-presentation standard. Treat it as Public Launch Ready unless a document is explicitly talking about visual display only. | Same as Public Launch Ready. |
| Operational Launch Ready | A concrete live operational claim is true in the system that owns it. | Live or current artifacts for payments, payouts, providers, capture supply, rights, hosted sessions, city activation, fulfillment, and support loops. |

## Allowed Public Claims

These are allowed on public pages without requiring Operational Launch Ready proof for every backend lane, as long as they do not imply a specific live fact that is unsupported.

| Claim Type | Allowed Language | Guardrail |
|---|---|---|
| Product category | Blueprint is a site-specific robot deployment readiness platform built on capture-backed site packages, hosted review paths, and buyer workflows. | Category language is allowed; do not imply every package is fulfilled, every hosted path is live, or any robot is ready to deploy. |
| Workflow | Request readiness evaluation, request a readiness report, book hosted evaluation, view pricing, inspect proof, browse site packages. | Requests can be confident; fulfillment state is confirmed after review. |
| Intended buyer value | Robot teams and site operators use exact-site packages to estimate whether a robot can hit required success rate, cycle time, intervention rate, and safety thresholds before field time. | Do not guarantee deployment success, safety certification, simulator execution, robot trials, or production performance. |
| Readiness deliverable | Site/task readiness report, deployment readiness advisory, pre-pilot readiness estimate, task-specific confidence packet, failure-mode report, site modification recommendation, data requirement, short-pilot protocol. | The deliverable is advisory until owner-system proof supports a stronger claim. |
| Request paths | Forms and CTAs can route buyers to readiness reports, package access, hosted evaluation, capture access, proof packets, or pricing. | A request is not a payment, entitlement grant, provider job, safety validation, robot trial, or fulfillment start. |
| Demo/sample framing | Public samples and representative packets can show product shape, UI quality, proof structure, and buyer workflow. | Label sample/demo material in proof/detail areas; do not present it as a customer result. |
| Launch-quality UI language | The site may use polished present-tense interface labels and confident buyer language. | Do not add broad apology copy solely because operations are still request-specific. |
| Request/access review | Request readiness evaluation, request package access, book hosted evaluation, submit site, apply for capture access, open request console. | Availability, rights, access, payment, payout, safety proof, and fulfillment are confirmed per site/request. |

## Conditional Claims

Use these only when the page, listing, packet, or request has supporting proof. Otherwise qualify the exact term while keeping the surrounding product presentation confident.

| Claim | Requires | Safe Qualification |
|---|---|---|
| Available | Current listing, package, entitlement, or request state supports access. | `available after request review`, `request access`, or `availability confirmed per site/request`. |
| Live hosted session | Runtime/session artifacts, entitlement path, and hosted-session availability support it. | `book hosted review` or `hosted review is confirmed per site/request`. |
| Ready to deploy | Site-specific simulator traces, action logs, robot trials, safety review/signoff, rights/privacy proof, support path, and runtime proof support deployment. | `deployment readiness advisory`, `pre-pilot readiness estimate`, `readiness report`, `task-specific confidence packet`, or `deployment readiness confirmed after review`. |
| Safety validated | Safety owner review/signoff, exact-site risk controls, robot-stack evidence, and request-scoped records support the claim. | `safety threshold scoped`, `safety review required`, or `safety posture reviewed per request`. |
| Simulator execution completed | Provider/runtime artifacts, run logs, scenario manifest, robot policy linkage, and exact request linkage exist. | `simulator traces required`, `hosted evaluation requested`, or `execution confirmed per request`. |
| Guaranteed success/cycle/intervention threshold | Current exact-site evidence, robot trials or action logs, agreed threshold methodology, and buyer-approved proof support the guarantee. | `threshold scoped`, `advisory estimate`, or `requires simulator traces/action logs/robot trials for operational readiness`. |
| Rights-cleared | Rights/privacy/consent/commercialization record exists for that exact site and use. | `rights reviewed per request` or `rights posture attached when available`. |
| Provider-ready | Provider execution path, artifacts, or adapter proof exists for the request. | `provider-swappable`, `provider path selected after review`, or `provider execution confirmed per request`. |
| City live | Supported-city or city-launch activation truth says the city is live. | `request the city`, `planned city`, or `capture access reviewed by city`. |
| Package access open | Package, entitlement, rights, and access state support opening files. | `request package access` or `package access confirmed after review`. |

## Disallowed Until Proven

Do not publish or let agents claim these without current proof from the owning system.

| Claim | Owning Proof | Next Action When Missing |
|---|---|---|
| Real customer proof, logos, testimonials, or case outcomes | Signed/customer-approved evidence and public-use approval. | Replace with labeled sample, representative packet, or product workflow language. |
| Active capture supply for a market/site | Capture ledger, city activation, capturer assignment, or supply record. | Say `request capture access` or `capture path reviewed per site/city`. |
| Real buyer traction, revenue, conversion, or KPI claims | Analytics, Stripe, CRM/Paperclip, or approved metric source. | Remove the metric or mark it as an internal target. |
| Cleared rights or unrestricted commercial use | Rights/privacy/consent/commercialization record. | Use rights-review language tied to the request. |
| Live payouts or guaranteed capturer earnings | Stripe Connect/payout ledger and approved payout policy. | Use application/review language. |
| Guaranteed launch city coverage | Supported-city activation and city-launch evidence. | Use planned/request-city wording. |
| Provider execution completed | Provider artifacts, run logs, or package manifest evidence. | Use provider-swappable or request-scoped provider review. |
| Payment or fulfillment success | Stripe checkout/webhook/entitlement plus fulfillment record. | Treat the form or CTA as a request, not a completed purchase. |
| Hosted-session fulfillment | Runtime/session/entitlement artifacts and live state. | Use `book hosted review` and confirm availability per site/request. |
| This robot is ready to deploy, safety validated, collision/contact/manipulation validated, or guaranteed to hit thresholds | Request-scoped simulator traces, action logs, robot trials, safety review/signoff, rights/privacy proof, hosted/runtime proof, and buyer-approved methodology. | Use readiness advisory language and name the missing proof. |

## Investor And Demo Interpretation

Use this sentence when explaining a polished public/demo surface without implying Operational Launch Ready:

> This is the launch-ready public surface and buyer workflow. Live availability, rights, and fulfillment are confirmed per site/request.

This sentence is safe because it describes the public experience and the request-specific proof boundary at the same time.

## Agent Closeout Rule

When a page looks polished but an operational lane is not live, close the copy/design work as Public Launch Ready / investor-showcase ready only. Do not claim Operational Launch Ready unless live proof was verified in the owning systems.
