# Goal: Simplify Blueprint pricing to two products

## Outcome

Redesign and rewrite the Blueprint pricing page so it is simple enough for an intern, operator, or robot-team agent to understand in under 30 seconds.

The pricing page should sell only two robot-team products:

1. Task Evaluation Run — from $6,500 / run
2. Post-Training Data Package — from $25,000+

Site operators can still submit sites for free, but site-operator participation should be a small free note, not a pricing plan/card.

The page should clearly explain:

- what a Task Evaluation Run is
- what a Task Pack is
- what a scenario is
- what comes with the $6,500 run
- what comes with the $25,000+ post-training data package
- what site operators can do for free

## Required Terminology

Use:

- Task Evaluation Run
- Task Pack
- scenario
- Post-Training Data Package
- robot policy/profile
- site
- threshold set
- scenario manifest
- pass/fail results
- cycle-time results
- intervention and failure notes
- selected rollout evidence
- exportable scenario/results manifest
- site operators submit sites free

Avoid:

- Policy Evaluation Set
- Site Data Package as a paid product
- site package as a pricing card
- capture-backed world model
- manual browser session
- headless agent path as the primary robot-policy execution wording
- Public Launch Ready
- Operational Launch Ready

## Pricing Page Structure

Hero:

- Eyebrow: Pricing
- Headline: Simple pricing for real-site robot evaluation.
- Subhead: Blueprint sells two robot-team products: Task Evaluation Runs and Post-Training Data Packages. Site operators can submit sites for free.
- Primary CTA: Request Task Evaluation Run
- Secondary CTA: Request Data Package

Two pricing cards:

- Task Evaluation Run — From $6,500 / run
- Post-Training Data Package — From $25,000+

Task Pack explainer:

- A Task Pack is one job the robot needs to perform, tested across many scenarios.
- Scenario = one test attempt.
- Task Pack = the full set of scenarios for that job.
- Task Evaluation Run = one policy tested against one Task Pack.

Site operator free note:

- Site operators submit sites free.
- Facility owners can submit or claim a site, define privacy/access boundaries, and review commercial-use terms before anything is shared.

Evidence boundary:

- Evaluation output is advisory.
- Deployment readiness still depends on simulator traces, action logs, robot trials, safety review, rights clearance, and site-specific approval.

## Homepage Consistency

Update the homepage so pricing and product language match this simplified model:

- Replace Policy Evaluation Set with Task Evaluation Run.
- Replace pricing preview with Task Evaluation Run, Post-Training Data Package, and a free site-operator note.
- Remove Site Data Package and $3,500+ / site package.
- Remove scenario tests as a standalone product.
- Remove capture-backed world model.
- Replace manual browser session or headless agent path with: policy API, vendor container, action trace, simulation workflow, or assisted review.

## CTA Routing

Preserve existing routes where possible:

- Request Task Evaluation Run should go to the robot-team contact/evaluation flow.
- Request Data Package should go to the robot-team contact flow with a data-package or equivalent query param.
- Submit site free should go to the site-operator contact flow.
- See proof details should go to the Proof page.

## Acceptance Criteria

Pricing page must contain:

- Task Evaluation Run
- From $6,500 / run
- One Task Evaluation Run = 1 site × 1 robot policy/profile × 1 Task Pack × up to 500 scenarios.
- Post-Training Data Package
- From $25,000
- Site operators submit sites free.
- Evaluation output is advisory.

Pricing page must not contain:

- Policy Evaluation Set
- Site Data Package
- $3,500+ / site package
- capture-backed world model
- manual browser session
- headless agent path
- Public Launch Ready
- Operational Launch Ready

Homepage must not contain:

- Site Data Package
- $3,500+ / site package
- capture-backed world model
- manual browser session
- headless agent path

Functional checks:

- Request Task Evaluation Run CTA routes correctly.
- Request Data Package CTA routes correctly.
- Submit site free CTA routes correctly.
- See proof details CTA routes correctly.
- App builds successfully.
- Lint/typecheck passes if configured.
- Desktop and mobile layouts render cleanly.

## Constraints

Do not change backend intake behavior unless required for CTA query params. Do not remove legal/proof pages. Do not create a third paid product. Do not claim Blueprint proves deployment readiness. Do not claim physical robot success, safety validation, rights clearance, payment, hosted execution, or simulator traces exist unless supplied by the appropriate owner system.
