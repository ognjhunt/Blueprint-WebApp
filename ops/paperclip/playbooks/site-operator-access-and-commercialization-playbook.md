# Blueprint Site-Operator Access and Commercialization Playbook

## Purpose
This is the reusable Blueprint playbook for the optional site-operator lane.

It should be updated by `site-operator-partnership-agent` as new buyer, ops, and commercialization evidence arrives.

## Core Rule
Site operators are an important but optional third lane.

This playbook exists to make that lane explicit without implying:
- that site-operator approval is always required before lawful capture
- that site-operator commercialization is the center of the business
- that agents can make permission, legal, privacy, rights, or contract judgments

## When This Lane Matters
- facilities with meaningful access control or operator-managed boundaries
- situations where privacy or rights constraints materially affect commercialization
- cases where an operator could become a collaborator in governed hosted access
- situations where recurring site updates or operator coordination would improve product value

## When This Lane Is Not The Default
- lawful capture and packaging paths that do not depend on pre-negotiated operator intake
- robot-team demand motions where the buyer can proceed based on existing product truth
- exploratory or city-level planning where operator involvement is still speculative

## Legitimate Operator-Side Value Props
- clearer access governance around exact-site products
- clearer rights, privacy, and consent boundary handling
- optional commercialization participation once a human has defined the terms
- better coordination when a site becomes strategically important enough to manage actively

## Conversation Structure
1. Clarify the site type and why operator-side involvement might matter.
2. State clearly that Blueprint's core product is site-specific world models and hosted access for robot teams.
3. Explain the operator-side value prop only if the facts support it.
4. Surface the human-only gates before the conversation drifts into judgment calls.
5. Route permissions, privacy, rights, contracts, pricing, and commercialization terms to humans.

## Human-Only Gates
- permission judgments
- legal interpretation
- privacy or consent interpretation
- rights interpretation
- revenue-share or commercialization commitments
- pricing, contract, or procurement commitments

## Site-Type Hypotheses To Evaluate Carefully
- private industrial and logistics facilities
- commercial spaces with controlled access
- high-sensitivity facilities where privacy boundaries matter more than generic capture convenience

These are hypotheses for planning, not policy.

## Signals This Lane Is Worth More Attention
- robot-team buyers repeatedly ask whether a facility operator is involved
- a site's privacy or access boundaries create repeated human escalations
- operators show interest in governed access or commercialization conversations
- city plans identify site clusters where operator-side coordination is likely to matter

## Current City Signals
- Austin: keep operator-lane work secondary unless a controlled-access industrial, logistics, or similarly governed facility creates real access friction or recurring update work. The current Austin launch system still sits in `draft_pending_founder_approval`, so the operator lane should not drift ahead of the buyer motion.
- San Francisco: treat sensitive, high-value, or partner-led commercialization conversations as earlier operator-lane candidates, but still keep the lane secondary to the robot-team buyer motion. The current San Francisco launch system is still `planning_state: not_started`, so this lane remains speculative until the city has a real evidence packet.
- San Diego: keep the lane centered on warehouse, manufacturing, inspection, and other controlled commercial sites where exact-site proof packs and hosted review are already buyer-relevant. San Diego planning is complete, so this is the clearest city for concrete operator-lane packaging, but live contact still stays draft-only until policy guardrails clear.
- Sacramento: keep the lane centered on McClellan Park, McClellan-area cold storage, and public walk-in retail only where the access path is already lawful. Use McClellan Park leasing / ownership contacts for the property-owner path, US Cold Storage for the facility-operator path, and the warehouse line only for public Costco-style walk-in routing. Live outreach still stays draft-only until a policy update clears it.

## Weekly Operating Signals
- If a city is still awaiting manual approval or lacks a completed planning packet, keep operator-lane work as routing guidance only.
- If a city has completed planning and the site type is controlled-access or operator-managed, the operator lane can own contact mapping, approval sequencing, and draft-only outreach prep.
- If the commercial question starts to touch pricing, reimbursement, revenue share, contract shape, or procurement, stop treating it as an operator-lane planning question and hand it to the human commercial owner.

These are planning signals, not policy.

## Operator-Lane Matrix
| Site type | Likely operator concern | Legitimate Blueprint value prop | Required human gate | Downstream owner |
| --- | --- | --- | --- | --- |
| Private industrial and logistics facilities | escorts, access windows, recurring updates, controlled zones | clearer access governance around exact-site products and hosted access | automatic policy review for permission, rights, privacy, and any commercialization participation | `ops-lead` |
| Commercial spaces with controlled access | visitor routing, tenant rules, customer privacy | boundary handling and hosted review that labels what is already captured | automatic policy review for privacy, consent, operator permission, and scope limits | `intake-agent` |
| High-sensitivity facilities | restricted zones, sensitive operations, privacy exposure | explicit boundary labeling, narrow hosted review, and careful handoff packaging | automatic policy review for privacy, rights, and exception handling | `ops-lead` |
| Customer sites with commercialization-adjacent stakeholders | partner expectations, custom packaging pressure, rollout coordination | draft-only commercialization framing after a human sets the terms | automatic policy review for pricing, contract, revenue-share, and procurement terms | `buyer-solutions-agent` + automated commercial policy |

The matrix is a routing aid, not a standing claim that operator involvement is mandatory or commercially available in every case.

## Issue-Ready Actions
- `ops-lead`: update the hosted-review and artifact-handoff checklist so controlled-access or high-sensitivity facilities always carry site type, access state, operator involvement, and human-only gate fields.
- `intake-agent`: add routing prompts that split buyer evaluation from operator-governed access or commercialization questions and fail closed when rights, privacy, or contract language appears.
- `buyer-solutions-agent` + automated commercial policy: add a draft response pattern for pricing, procurement, and revenue-share questions that may follow proof review, while keeping all commitments human-owned.
- `finance-support-agent`: add a lightweight review hook for billing, reimbursement, and payment-friction questions so operator-lane discussions do not silently become financial commitments.
- `revenue-ops-pricing-agent`: keep any operator-adjacent pricing, quote bands, or discount language draft-only until a human sets the terms.
- `city-demand-agent`: mirror the Austin, San Francisco, San Diego, and Sacramento signals into city plans by marking which site clusters are operator-secondary versus operator-relevant, and which ones still need automatic policy block before any commercialization language is used.
- `site-operator-partnership-agent`: keep the Sacramento operator-lane packet focused on owner/operator/tenant contacts, approval sequence, and the first draft-only outreach note before any live operator contact is allowed.

## Handoffs
- `growth-lead`: priority and posture decisions
- `ops-lead`: operational routing and queue ownership
- `intake-agent`: inbound question handling
- `buyer-solutions-agent` + automated commercial policy: commercial support and human escalation routing
- `finance-support-agent`: billing, reimbursement, and payment-friction questions
- `revenue-ops-pricing-agent`: draft pricing support before human approval
- `city-demand-agent`: city-specific adaptation
