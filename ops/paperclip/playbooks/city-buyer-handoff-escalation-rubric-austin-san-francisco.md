# Blueprint City Buyer Handoff And Escalation Rubric

## Scope
This playbook defines how `ops-lead` should route serious buyer follow-up once Austin- or San Francisco-sourced proof review turns into real operational work.

It inherits the shared rules from:
- `ops/paperclip/playbooks/robot-team-demand-playbook.md`
- `ops/paperclip/playbooks/robot-team-finance-support-routing-playbook.md`
- `ops/paperclip/playbooks/site-operator-access-and-commercialization-playbook.md`
- `ops/paperclip/HANDOFF_PROTOCOL.md`

This playbook does not authorize pricing, contract, permission, privacy, rights, or commercialization decisions.

## Shared Rule
Keep a request in normal buyer follow-up until there is evidence that the motion now needs coordinated proof delivery, mixed-lane routing, or a human-gated escalation.

Use the smallest truthful lane:
- `intake-agent`: buyer-safe follow-up, source tagging, and proof-path classification
- `ops-lead`: proof-pack assembly readiness, hosted-review coordination, mixed-lane ownership, and missing-owner escalation
- `buyer-solutions-agent` + designated human commercial owner: standard buyer-thread commercial handling inside approved quote bands
- `revenue-ops-pricing-agent`: quote guidance, package-band checks, and exception detection for the human commercial owner
- optional operator lane / `field-ops-agent`: access, permissions, operator coordination, rights, privacy, or commercialization-boundary friction
- engineering via Paperclip issue: product bugs affecting proof-pack pages, hosted review, artifact access, or billing UI

## Default Trigger Map
### Stay In Normal Buyer Follow-Up
Keep the request with `intake-agent` when all of the following are true:
- the buyer is still evaluating current proof truthfully available now
- the next step is a standard proof-pack send, hosted-review invite, or artifact recap
- no pricing, contract, refund, permission, privacy, rights, or operator judgment is being requested
- there is one clear buyer thread and no mixed internal ownership question

### Move To `ops-lead`
Route to `ops-lead` when any of the following becomes true:
- the buyer asks for a coordinated proof path that crosses proof-pack delivery, hosted-review readiness, and artifact handoff
- the next step requires a named owner and none is explicit yet
- the thread mixes technical proof follow-up with delivery coordination or access planning
- multiple internal lanes may need to act within one business day
- the buyer asks for exact-site or adjacent-site evidence packaging that is not yet cleanly assembled

### Move To Standard Commercial Handling
Route to `buyer-solutions-agent` plus the designated human commercial owner when the thread moves beyond proof review and into:
- standard pricing, invoice flow, procurement routing, or approved quote handling
- a normal commercial handoff after proof review
- questions that need `revenue-ops-pricing-agent` support but still fit the approved package and quote bands

Route to founder only when the commercial ask is non-standard: discounts outside guardrails, custom packaging beyond precedent, contract deviations, or commitments that change company posture

### Move To Operator / Access Routing
Route to the optional operator lane or `field-ops-agent` when:
- site access or operator coordination becomes necessary for the next step
- privacy, consent, rights, or commercialization boundaries are now blocking progress
- a controlled-access or sensitive facility requires operator-side coordination to continue truthfully

### Escalate To Human Review Immediately
Fail closed into explicit human review when the request asks for:
- pricing approval, discounts, credits, refunds, or payout action
- contract language, procurement commitments, legal/privacy/rights interpretation
- permission judgment or commercialization terms
- delivery guarantees beyond current product truth

## Austin, TX Posture
Austin should be treated as a relationship-driven market where not every introduction deserves ops-level handling.

### Keep Austin In Standard Buyer Follow-Up When
- the request came from Texas Robotics, a founder introduction, a university tie, or an industrial introduction and is still a single-thread proof review
- the buyer only needs the current proof pack, hosted-review link, or artifact recap
- no delivery coordination, operator coordination, or commercial owner decision is needed yet

### Route Austin To `ops-lead` When
- a relationship-driven intro converts into a real exact-site request with a one-business-day proof expectation
- the buyer asks for a hosted review plus a clear artifact handoff path for an industrial, warehouse, or logistics site
- the thread now includes both technical stakeholders and someone asking how Blueprint would coordinate next steps
- operator-governed facility questions appear alongside proof follow-up
- the team needs to separate what Blueprint can show now from what requires more capture, packaging, or approvals

### Route Austin To Standard Commercial Handling When
- the intro quickly turns into pilot budget, invoice, pricing, discount, or procurement questions
- a founder or partner wants commercial follow-up packaged for a named human owner

### Route Austin To Operator / Access Review When
- the site is private industrial, controlled-access, or clearly operator-governed
- access permission, privacy boundaries, or commercialization participation become explicit blockers

### Austin Anti-Pattern
Do not treat every founder intro or Texas Robotics conversation as ops escalation. Austin should stay narrow and relationship-led until the request clearly creates proof-delivery work or human-gated risk.

## San Francisco, CA Posture
San Francisco should be treated as the denser buyer-matchmaking market, which means ops should engage earlier when proof review starts pulling in multiple stakeholders or commercialization-adjacent expectations.

### Keep San Francisco In Standard Buyer Follow-Up When
- the request is still a single-thread proof review from BARA-style matchmaking, a proof-led event, a founder intro, or a partner referral
- the buyer is only evaluating the currently available proof surface
- the next step is still a standard proof-pack send, hosted-review invite, or artifact recap

### Route San Francisco To `ops-lead` When
- the request now involves partner, integrator, deployment, or commercialization stakeholders in the same thread
- the buyer wants hosted review, artifact compatibility context, and a concrete next-step owner
- the thread has deadline pressure around proof review even if pricing is not yet being discussed
- repeated SF channel activity creates ambiguity about whether the motion is still product evaluation or now operational coordination
- the request mixes proof-path questions with access planning, delivery coordination, or partner handoff expectations

### Route San Francisco To Standard Commercial Handling When
- proof review is successful and the next questions are pricing, contract, procurement, invoice, or commercial packaging
- a buyer-matchmaking or partner thread needs a buyer-safe commercial handoff package without making commitments

### Route San Francisco To Operator / Access Review When
- the facility is sensitive, high-value, or operator-governed and access or commercialization boundaries appear early
- governed hosted access or recurring operator coordination becomes part of the live request

### San Francisco Anti-Pattern
Do not confuse higher meeting density with real ops urgency. SF should escalate earlier than Austin only when there is clear multi-party coordination, mixed-lane ownership, or human-gated risk, not just more introductions.

## Minimum Handoff Packet
When `ops-lead` takes ownership, the handoff package should include:
- city and source channel
- buyer name, company, and role
- site type and exact-site versus adjacent-site status
- current proof-pack or hosted-review state
- open technical questions
- open human-gated questions
- requested timeline
- recommended next owner

If another agent must take the next step, use the Paperclip handoff protocol and keep the first comment structured.

## Queue Truth
Operational ownership should remain visible in the real systems:
- Firestore holds queue truth for `inboundRequests`, `contactRequests`, and any related access or payout records
- Paperclip holds task ownership, escalation state, and follow-up accountability
- Notion and Slack are downstream visibility layers only

## Current Limitation
Austin- and San Francisco-specific proof-review conversion data is still sparse. This rubric is evidence-backed on channel structure and shared handoff rules, but the exact trigger thresholds should tighten as city-tagged funnel data becomes real.
