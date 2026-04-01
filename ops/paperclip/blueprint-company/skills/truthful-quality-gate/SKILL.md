---
name: truthful-quality-gate
description: Review buyer-facing, public-facing, and executive-facing drafts for Blueprint truthfulness, product-doctrine alignment, unsupported claims, and clarity before they are sent or published.
---

# Truthful Quality Gate

Use this skill when a draft needs a hard review before it is sent, posted, or handed to another agent.

Best fits:

- buyer proof summaries
- package recommendations
- community updates
- investor updates
- outbound drafts
- pricing and packaging writeups

## Goal

Catch the failures that matter most for Blueprint:

- invented traction or demand
- fake availability, supply, providers, or readiness
- overclaiming exact-site package or hosted-session capability
- collapsing optional trust layers into the main product story
- muddy language around rights, privacy, provenance, or proof
- generic marketing copy that hides what is actually included

## Required Review Lenses

Apply all five lenses every time:

1. Product truth
   Does the draft describe what Blueprint actually sells: exact-site packages, hosted access, and truthful proof paths?
2. Evidence truth
   Are claims grounded in capture, package, runtime, catalog, buyer, or ops evidence already available?
3. Rights and provenance truth
   Does the draft avoid implying permissions, release status, or compliance clearance that are not established?
4. Promise discipline
   Does the draft avoid capability guarantees, delivery guarantees, or roadmap-as-reality language?
5. Clarity and usefulness
   Can the reader tell what is included, excluded, next, and blocked?

## Workflow

1. Identify the artifact type and intended audience.
2. Identify what evidence should back the draft:
   - capture/package artifacts
   - hosted-session state
   - pricing surfaces
   - buyer issue context
   - analytics or ops reports
3. Read the draft as if it will be challenged by a skeptical buyer, founder, or operator.
4. Mark each issue as one of:
   - `blocker`: false, unsupported, risky to send
   - `revise`: directionally right but unclear or sloppy
   - `pass`: safe and useful as written
5. Produce a cleaned version if the draft is salvageable.

## Output Format

Always return:

- `Decision:` `PASS`, `REVISE`, or `BLOCK`
- `Why:` one short paragraph
- `Findings:` flat list of concrete issues
- `Rewritten draft:` only when a rewrite is useful

## Rewrite Rules

- Prefer precise nouns over hype.
- Name what exists now before naming what could exist later.
- When relevant, state:
  - what is included
  - what is not included
  - what evidence supports the statement
  - what requires human approval or another gate
- If evidence is missing, say so plainly instead of smoothing it over.

## Do Not

- invent metrics, pipeline, customer logos, or market proof
- imply rights clearance, privacy review, or commercialization approval without evidence
- present hosted sessions or exact-site packages as broader than they are
- rewrite the company into a generic AI automation or qualification product
- approve copy just because it sounds polished
