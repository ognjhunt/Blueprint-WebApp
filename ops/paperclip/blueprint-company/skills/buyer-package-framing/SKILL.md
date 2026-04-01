---
name: buyer-package-framing
description: Translate buyer needs into truthful Blueprint package, proof, and pricing recommendations grounded in exact-site availability, hosted-session reality, delivery scope, and commercial guardrails.
---

# Buyer Package Framing

Use this skill when a buyer request needs to be turned into a concrete package recommendation, proof path, or pricing rationale.

Primary users:

- `revenue-ops-pricing-agent`
- `buyer-solutions-agent`
- `solutions-engineering-agent`

## Goal

Produce a recommendation that is commercially useful without inventing product shape, catalog supply, delivery readiness, or commitment authority.

## Required Inputs

Ground the recommendation in actual evidence:

- buyer request and use case
- matching site/package availability
- hosted-session or artifact readiness
- rights/provenance status when relevant
- current pricing and catalog surfaces
- delivery/support burden

If a required input is missing, make that the center of the output.

## Framing Rules

1. Start from the buyer's job to be done.
2. Recommend the smallest truthful package that solves the job.
3. Keep exact-site package and hosted access primary.
4. Treat trust/readiness outputs as optional support layers unless the case truly requires them.
5. Separate:
   - what exists now
   - what can be delivered with routine work
   - what would require a new commitment or escalation

## Workflow

1. Parse the buyer need:
   - site type
   - robot workflow
   - evaluation goal
   - timeline
2. Check whether Blueprint already has a matching package or hosted path.
3. If yes, frame the recommendation around that real asset.
4. If partial match only, state the gap explicitly.
5. If no match, frame the answer as a scoped capture/package path, not a fake SKU.
6. Add pricing logic only after the package shape is clear.
7. Call out approvals needed for discounts, terms, or custom commitments.

## Required Output

Always return these sections:

- `Recommended package`
- `Who it is for`
- `Included now`
- `Not included`
- `Proof / evaluation path`
- `Pricing rationale`
- `Risks or blockers`
- `Human-gated decisions`

## Writing Rules

- Keep commercial language concrete.
- Name the exact artifact or hosted path when possible.
- Use caveats where evidence is incomplete.
- Prefer “currently available” and “requires confirmation” over soft bluffing.

## Escalation Rules

Escalate instead of smoothing over when:

- rights or privacy status is unclear
- the hosted path is not actually ready
- the package does not exist in sellable form
- support burden would materially change pricing
- the buyer is asking for terms, discounts, or guarantees

## Do Not

- invent tiers or bundles the delivery system cannot support
- imply purchase automatically includes rights the buyer does not have
- sell readiness review as the main product by default
- hide uncertainty inside vague commercial language
- approve live pricing, discounts, or terms
