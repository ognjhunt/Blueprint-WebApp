# Blueprint City Buyer Handoff And Escalation Rubric - Sacramento

## Scope
This playbook defines how Sacramento-sourced proof review becomes standard commercial handling.

It inherits the shared rules from:
- `ops/paperclip/playbooks/robot-team-demand-playbook.md`
- `ops/paperclip/playbooks/robot-team-finance-support-routing-playbook.md`
- `ops/paperclip/playbooks/site-operator-access-and-commercialization-playbook.md`
- `ops/paperclip/HANDOFF_PROTOCOL.md`

This playbook does not authorize pricing, contract, permission, privacy, rights, or commercialization decisions.

## Shared Rule
Keep a request in normal buyer follow-up until there is evidence that the motion now needs coordinated proof delivery, standard commercial handling, or human-gated escalation.

Use the smallest truthful lane:
- `intake-agent`: buyer-safe follow-up, source tagging, and proof-path classification
- `ops-lead`: proof-pack assembly readiness, hosted-review coordination, mixed-lane ownership, and missing-owner escalation
- `buyer-solutions-agent` + designated human commercial owner: standard buyer-thread commercial handling inside approved quote bands
- `revenue-ops-pricing-agent`: quote guidance, package-band checks, discount guardrail checks, and exception detection for the human commercial owner
- optional operator lane / `field-ops-agent`: access, permissions, operator coordination, rights, privacy, or commercialization-boundary friction
- engineering via Paperclip issue: product bugs affecting proof-pack pages, hosted review, artifact access, or billing UI

## Sacramento Posture
Sacramento should be treated as a gated-cohort proof-and-commercialization market. Do not pull founder review into routine pricing or proof follow-up.

### Keep Sacramento In Normal Buyer Follow-Up When
- the request is still a single-thread proof review
- the next step is a standard proof-pack send, hosted-review invite, or artifact recap
- no pricing, contract, refund, permission, privacy, rights, or operator judgment is being requested
- there is one clear buyer thread and no mixed internal ownership question

### Route Sacramento To `ops-lead` When
- the buyer asks for a coordinated proof path that crosses proof-pack delivery, hosted-review readiness, and artifact handoff
- the next step requires a named owner and none is explicit yet
- the thread mixes proof follow-up with delivery coordination or access planning
- multiple internal lanes may need to act within one business day
- the buyer asks for exact-site or adjacent-site evidence packaging that is not yet cleanly assembled

### Route Sacramento To Standard Commercial Handling When
- proof review turns into standard pricing, invoice flow, procurement routing, or approved quote handling
- there is a normal commercial handoff after proof review
- the buyer asks for quote or package support that still fits the approved package and quote bands

Route to founder only when the commercial ask is non-standard: discounts outside guardrails, custom packaging beyond precedent, contract deviations, or commitments that change company posture.

### Route Sacramento To Operator / Access Review When
- site access or operator coordination becomes necessary for the next step
- privacy, consent, rights, or commercialization boundaries are now blocking progress
- a controlled-access or sensitive facility requires operator-side coordination to continue truthfully

### Escalate To Human Review Immediately
Fail closed into explicit human review when the request asks for:
- pricing approval, discounts, credits, refunds, or payout action
- contract language, procurement commitments, legal/privacy/rights interpretation
- permission judgment or commercialization terms
- delivery guarantees beyond current product truth

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
Sacramento proof-review conversion data is still sparse. This rubric is evidence-backed on channel structure and shared handoff rules, but the exact trigger thresholds should tighten as city-tagged funnel data becomes real.
