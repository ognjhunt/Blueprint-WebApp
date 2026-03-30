# Blueprint Robot-Team Finance Support Routing Playbook

## Purpose
This is the internal operating proposal for how `finance-support-agent` should handle commercial, billing, dispute, refund, and contract-adjacent questions that surface during the robot-team buyer motion.

It exists to support the reusable demand playbook without giving the finance-support lane authority it does not have.

## Core Rule
Finance support is a routing and drafting layer.

It should:
- keep buyer-facing follow-up factual and calm
- make the human commercial owner explicit
- preserve evidence and next steps in the right queue

It should not:
- quote or approve pricing
- negotiate discounts or custom terms
- approve refunds, disputes, or payouts
- make legal, privacy, rights, or procurement judgments
- imply that a hosted review or proof-pack guarantees delivery scope

## When Finance Support Enters The Buyer Motion
Finance support should get involved when a robot-team conversation moves beyond proof review and into questions about:
- billing mechanics or payment problems
- refund, chargeback, or dispute risk
- pricing, discounting, volume terms, or commercial packaging
- contract, procurement, invoice, or vendor-onboarding expectations
- who owns the next human commercial follow-up

Finance support should not become the default owner for:
- technical bugs in proof-pack pages or hosted-session flows
- site access, permissions, or operator-side judgments
- product-scoping questions that still belong with ops or the delivery owner

## Always Human-Gated Topics
The following must always fail closed into explicit human review:
- custom pricing, discounting, credits, or bundled commercial terms
- contract language, MSA, DPA, SLA, indemnity, insurance, or procurement requirements
- refund approvals, charge reversals, dispute evidence submission, or payout release
- privacy, rights, consent, or commercialization interpretation
- commitments about delivery dates, integration work, or package scope beyond current product truth
- any statement that a buyer is approved, cleared, or guaranteed for a commercial path

## Routing Surfaces
### 1. Buyer support or contact thread
If the question arrives through a help form, contact form, or support inbox, keep the source of truth in `contactRequests`.

Use support-triage output that:
- classifies obvious billing or account questions as `billing_question`
- sets `requires_human_review=true`
- uses blocked/fail-closed behavior when the request asks for a refund, legal interpretation, or unclear account action

Use `sales_follow_up` only when the message is commercial coordination rather than a financial decision. That queue can collect context, but it still must not answer pricing or contract questions without a human owner.

### 2. Capturer payout, dispute, or Stripe exception
If the issue is a payout failure, dispute, refund, or Stripe exception, keep the operator-owned state in `creatorPayouts.finance_review`.

Use the existing finance-review surface:
- `review_status`: `pending_human_review`, `investigating`, `ready_for_manual_action`, `waiting_on_creator`, or `resolved`
- `next_action`
- `owner_email`
- `sla_due_at`
- `required_evidence`
- `manual_action_type`
- `human_only_note`

This is a planning and evidence surface only. It is not authorization to move money.

### 3. Proof-pack or hosted-review conversation
If a buyer raises commercial questions during proof-pack review or a hosted-session walkthrough:
- keep the buyer motion anchored to current product truth
- capture the question, buyer, site, and urgency in a Paperclip issue or the existing support thread
- route the item to `finance-support-agent` for drafting and handoff packaging
- route the final commitment to the named human commercial owner; if none is named yet, route to `ops-lead`

The handoff package should include:
- buyer name and company
- source issue or thread link
- site or proof-pack being discussed
- exact commercial question asked
- requested timeline or procurement deadline
- what Blueprint can already show truthfully today
- what requires human review

## Escalation Rules From Proof-Pack And Hosted Review
### Route to `finance-support-agent`
- buyer asks how billing works for hosted access already shown in the proof path
- buyer requests invoice mechanics, payment timing, or refund policy clarification
- buyer asks who handles commercial follow-up after a hosted review
- buyer wants pricing or contract questions collected and routed without getting an immediate commitment

### Route to `ops-lead`
- there is no clear human commercial owner yet
- the buyer is asking for a package or delivery commitment that crosses ops and commercial scope
- the conversation mixes hosted-review follow-up with delivery coordination or access questions

### Route to engineering through a Paperclip issue
- the buyer reports a real bug in the proof-pack page, hosted-session flow, artifact download, login path, or billing UI
- the support draft depends on confirming visible product behavior
- the same buyer-facing bug is recurring across multiple support threads

When routing to engineering, finance support should still send the buyer a holding response that acknowledges the bug, avoids ETA promises, and states that the issue is under technical review.

### Route away from finance support
- site access, operator permissions, privacy boundaries, or commercialization rights interpretation
- bespoke integration scoping that still needs product or delivery definition

Those cases belong with `ops-lead`, `field-ops-agent`, or the relevant operator/commercialization lane, with finance support only assisting on the final human handoff if billing risk is also present.

## Language Rules Before A Human Commercial Owner Is Involved
### Safe language
- "I have routed this for human commercial review."
- "Current Blueprint proof covers the exact-site artifacts and hosted review already shown; pricing and contract questions need a human owner."
- "I can document the billing and procurement questions so the correct owner can reply."
- "Nothing has been approved yet. We are collecting the details needed for the next review step."
- "The current proof path is available now; any custom scope or commercial packaging needs follow-up."

### Language to avoid
- "We can offer that price."
- "We can put that in the contract."
- "This refund is approved."
- "There should be no privacy or rights issue."
- "Procurement will be easy."
- "Hosted review today means delivery is guaranteed."
- "We can support that integration" when the team has only shown a proof-pack or hosted review surface
- "This will be ready by" unless a human owner has already committed it

## Default Next-Step Template
When finance support needs to hand a robot-team buyer question to a human commercial owner, the draft should do three things:
- restate the exact question without expanding scope
- state what Blueprint can already show truthfully now
- identify the remaining human review gate

Suggested structure:

1. Acknowledge the buyer's request.
2. Separate current proof-path facts from open commercial questions.
3. State that pricing, contract, refund, dispute, and custom-term decisions are human-reviewed.
4. Name the next owner if known, otherwise say the request is being routed for review.

## Evidence Checklist For Commercial Handoffs
- source thread or issue link
- buyer and company name
- site or package under discussion
- current proof-pack or hosted-review status
- requested commercial decision
- known blockers or missing facts
- any procurement or deadline signal

## Shared Intake Fields Before Human Commercial Handling
Finance support should not route a pricing, billing, refund, procurement, or commercialization question to a human owner without first capturing:

- buyer name, company, role, and reply channel
- city tag and source tag for the conversation
- exact site, facility type, or proof-pack being discussed
- whether the current proof is exact-site or adjacent-site
- current hosted-review or artifact status, including what the buyer has already seen
- the exact question asked, quoted as directly as possible
- requested timeline, procurement milestone, or rollout deadline if one exists
- what Blueprint can already state truthfully now
- what still requires human review, approvals, extra packaging, or access clearance
- whether a visible product bug is blocking a truthful response

If any of these fields are missing, finance support should fail closed into a context-gathering step instead of drafting a confident commercial handoff.

## City-Aware Commercial Handoff Notes
These notes adapt the same finance-support guardrails to the Austin and San Francisco demand plans.

### Austin
Austin should be treated as a relationship-driven market where the first serious question after proof review may still be exploratory rather than procurement-ready.

Use the handoff package to capture:
- whether the conversation came through Texas Robotics, a founder intro, a university link, or an industrial/logistics relationship
- whether the buyer is asking for a commercial owner, billing mechanics, or only a next-step contact after proof review
- which exact-site workflow or facility type created the follow-up question
- whether the buyer is still validating technical fit versus actually trying to start procurement
- whether controlled-access industrial conditions create separate site-access or commercialization-boundary questions

Austin routing posture:
- keep the note concise and relationship-aware
- do not inflate a founder-led follow-up into a mature procurement motion
- route vague commercial curiosity to `ops-lead` for owner assignment if no human commercial owner exists yet
- split operator access or permissions questions away from pricing and billing questions before handoff

### San Francisco
San Francisco should be treated as a denser commercialization environment where buyers, partners, or integrators may ask structured commercial questions earlier in the motion.

Use the handoff package to capture:
- whether the conversation came through BARA-style matchmaking, a proof-led event, a founder intro, or a partner referral
- whether the buyer is asking about pricing, contracts, procurement steps, partner terms, or stack-adjacent packaging
- whether a systems integrator, partner, or customer-facing deadline is shaping the urgency
- which hosted-review or proof artifact triggered the follow-up
- whether the request mixes current proof review with custom export, integration, or rollout expectations

San Francisco routing posture:
- expect sharper distinctions between what exists now and what needs human commercial review
- record partner and procurement signals explicitly because they are more likely to matter early
- route mixed commercial-plus-delivery scope to `ops-lead` if the human commercial owner is not already named
- route any proof-pack, hosted-session, download, login, or billing-UI defect to engineering while keeping the buyer response factual and non-committal

## City-Specific Commercial Question Checklist
After proof review, finance support should classify the follow-up before handing it to a human owner.

### Austin checklist
- Is this a relationship-led follow-up that mainly needs the correct human contact?
- Is the buyer asking about invoice or billing mechanics for an already-understood proof path?
- Is there a real pricing, refund, or contract question, or only early commercial curiosity?
- Does the thread include site-access, permission, or operator-boundary issues that should be routed separately?
- Has finance support captured the source relationship so the human owner understands the trust context?

### San Francisco checklist
- Is the buyer asking for pricing, procurement, or partner-facing answers that require a named human commercial owner?
- Does the request imply custom packaging, integration, or rollout support beyond the current proof path?
- Is there a concrete buyer, partner, investor, or customer deadline that raises urgency without authorizing promises?
- Does the thread include commercialization-sensitive facility governance or rights questions that need a different owner?
- Has finance support captured the exact proof artifact and stack-compatibility question that triggered the commercial follow-up?

## Handoffs
- `ops-lead`: owner assignment, commercial escalation, and mixed ops/commercial decisions
- `finance-support-agent`: buyer-safe drafting, queue hygiene, and finance-review packaging
- engineering agents via Paperclip issues: technical bugs affecting proof-pack or hosted review
- `field-ops-agent` or site-operator lane: access, permission, rights, or commercialization-boundary questions

## Non-Goal
This playbook does not authorize finance support to make pricing, contract, dispute, refund, payout, privacy, rights, or procurement decisions. It only defines how those questions should be captured, routed, and discussed truthfully before a human owner responds.
