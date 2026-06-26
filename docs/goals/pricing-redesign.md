# Goal: Subscription-first Blueprint pricing

## Outcome

Redesign and maintain the Blueprint pricing surfaces around recurring robot-team evaluation infrastructure, with cheap first-run, site-supply, and yearly site-monitoring paths that feed the subscription motion.

The public pricing model should center on:

1. Robot Team Subscription - $15,000/month for unlimited eval cycles up to the agreed active-policy cap, with overage pricing above the cap.
2. Lite Quick-Look Eval - $5,000-$8,000 per eval for about 50 episodes, 1 policy, and a ranking-only report.
3. Site Supply Review - $5,000/site for operators who can make useful facilities available as robot-team evaluation supply.
4. Site Monitoring Subscription - $30,000-$40,000/year per deployed site for multiple policy-update checks up to the agreed annual cap when new policy versions need site-specific report cards.

Policy Improvement Runs, validation, custom support, real-rollout evidence, and overage terms remain request-scoped. Do not present any pricing surface as generated-world rank-fidelity result, off-scope validation, simulator-completed proof, rights clearance, payment success, or hosted-session fulfillment.

## Required Terminology

Use:

- Robot Team Subscription
- Lite Quick-Look Eval
- Site Supply Review
- Site Monitoring Subscription
- Policy Evaluation Run
- Policy Improvement Run
- active-policy cap
- overage pricing
- capture-backed site/task scope
- robot policy/profile
- threshold set
- failure taxonomy
- ranking-only report
- proof boundary
- per deployed site
- policy regression eval
- annual monitoring cap

Avoid:

- site operators submit sites free
- free site review
- Task Evaluation Run as the only public pricing anchor
- Post-Training Data Package as the default paid pricing card
- site package as a generic pricing card
- capture-backed world model as the pricing story
- Public Launch Ready
- Operational Launch Ready

## Pricing Page Structure

Hero:

- Headline: Evaluation infrastructure, not one-off tax.
- Subhead: Robot teams subscribe when evals become part of the development loop. Lite evals and single-site reviews stay available as the ramp into that subscription.

Pricing cards:

- Robot team subscription - $15,000/month
- Lite quick-look eval - $5,000-$8,000/eval
- Site supply review - $5,000/site
- Site monitoring subscription - $30,000-$40,000/site/year

Site supply note:

- Site review is one-time; monitoring is recurring.
- The operator path is priced for supply creation: $5,000 per site review, with access, privacy, and commercial-use boundaries confirmed before any robot-team use.
- If a site becomes deployed, yearly monitoring covers multiple policy-update checks up to an agreed cap, so the subscription is a lower per-check price than repeated one-off monitoring evals.

Evidence boundary:

- Evaluation output is advisory.
- Policy ranking readiness still depends on simulator traces, action logs, robot trials, safety review, rights clearance, and site-specific approval.

## CTA Routing

Preserve existing routes where possible:

- Robot-team subscription and quick-look CTAs go to the robot-team contact/evaluation flow.
- Policy Improvement Run CTAs go to the robot-team contact flow with `policy-improvement-run` query params.
- Site Supply Review CTAs go to the site-operator contact flow.
- Site Monitoring Subscription CTAs go to the site-operator contact flow with `Site Monitoring Subscription` requested outputs.
- See proof details CTAs go to the Proof page.

## Acceptance Criteria

Pricing page must contain:

- Robot team subscription
- $15,000 / month
- Lite quick-look eval
- $5,000-$8,000 / eval
- Site supply review
- $5,000 / site
- Site monitoring subscription
- $30,000-$40,000 / site / year
- Virtual results do not approve deployment or safety.

Pricing surfaces must not contain:

- Site operators submit sites free
- Submit site free
- Free for site operators
- From $6,500 / run
- From $35,000 / run
- $3,500+ / site package
- capture-backed world model as the pricing story
- Public Launch Ready
- Operational Launch Ready

Homepage and buyer pages should not reintroduce the old free-operator or per-eval-first model.

Functional checks:

- Robot-team subscription CTA routes correctly.
- Lite quick-look CTA routes correctly.
- Site Supply Review CTA routes correctly.
- Site Monitoring Subscription CTA routes correctly.
- App builds successfully.
- Typecheck passes if configured.
- Desktop and mobile layouts render cleanly.

## Constraints

Do not change backend intake behavior unless required for CTA query params. Do not remove legal/proof pages. Do not claim Blueprint proves generated-world rank fidelity. Do not claim physical robot success, off-scope validation, rights clearance, payment, hosted execution, or simulator traces exist unless supplied by the appropriate owner system.
