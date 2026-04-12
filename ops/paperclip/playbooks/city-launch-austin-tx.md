# Austin, TX — Blueprint City Launch Plan

## Status
- phase: planning
- owner: city-launch-agent
- last-reviewed: 2026-04-06
- recommended-posture: gated cohort pilot, not public launch
- last-human-launch-decision: not approved

## Launch Thesis
Austin is the better first city for Blueprint's capturer-side learning loop because founder/operator reach, technical community overlap, and a smaller trust graph should let Blueprint test a narrow, truthful cohort through access-controlled entry before trying to compete for broad attention.

Austin should be used to answer one question first: can Blueprint recruit and activate a small local cohort through trusted channels, visible review steps, and clear no-hype expectations about work, quality, approval, and access routing?

## What Changed This Pass
- evidence-backed: multiple agent bootstraps completed April 5 (capturer-growth, supply-intel, market-intel, robot-team-growth, site-operator-partnership, solutions-engineering, security-procurement, revenue-ops-pricing), creating a more complete execution infrastructure than existed at last review.
- evidence-backed: the capturer signup flow now requires an explicit access-source choice and supports invite/access-code routing in the current worktree.
- evidence-backed: structured capturer and buyer signup analytics events are present in code, but Austin-specific city and market reporting still needs deployment and end-to-end validation.
- evidence-backed: growth-lead weekly review (April 6) flagged the analytics gap (BLU-1583, BLU-1580, BLU-1581 still todo) as a critical risk — city expansion cannot be evidence-based until analytics is live.
- inferred: the Bootstrap phase is largely complete; the system is transitioning from setup to execution. Austin remains the first-city candidate but now has more downstream agent capacity to absorb city-specific work items.
- inferred: Austin no longer needs founder involvement for routine invite, access-code, rubric, threshold, or trust-kit decisions once the city policy is written and operator-owned; the remaining founder decision is whether Austin stays gated or expands.

## Why Austin Now
- founder and operator reach is more likely to convert into trusted introductions than in a noisier market
- robotics, maker, university, and creator communities give Blueprint multiple narrow cohort entry points
- Austin is a better environment than San Francisco for testing relationship-seeded density before public posting or paid spend

## Recommended Launch Posture
- start with invite-only or access-code cohorts, not open citywide recruiting
- treat the new access-source step as a control point, not as proof that the city is ready to widen
- use Austin to measure approved-to-first-capture activation and first-capture quality, not raw signup volume
- keep channel expansion gated on trust tooling and instrumentation, not enthusiasm

## Target Capturer Profile
- technically reliable local operator with iPhone-first capture fit
- comfortable with short, repeatable indoor walkthroughs and review feedback
- reachable through a trusted community, referral, or founder/operator introduction
- willing to state how they got access without ambiguity
- willing to accept that approval and work routing are gated, not guaranteed

## Ranked Channel Stack
| Rank | Channel | Why it fits Austin | Trust mechanism | Current posture |
|---|---|---|---|---|
| 1 | Founder and operator introductions | Highest-likelihood path to a narrow, accountable first cohort | Named referrals, invite codes, manual review | Start here |
| 2 | Robotics and maker communities | Good overlap with technically credible early capturers | Community reputation plus access-code pilot | Start with curated outreach |
| 3 | University technical communities | Potential for high-quality, trainable contributors | School affiliation plus cohort-based review | Test after first cohort tooling exists |
| 4 | Local creator / production freelancer groups | Useful for coverage breadth once trust rails exist | Statement-of-purpose and first-capture review | Hold for second wave |
| 5 | Broad public job or gig posting | Likely to inflate low-signal volume before trust systems are ready | Weak | Do not use yet |

## Trust Infrastructure Required Before Expansion
- cohort, invite-code, or access-code tagging that survives from entry source to approval and first capture and can be segmented by market
- visible application language that states no guaranteed work, no guaranteed earnings, and human approval before activation
- manual verification and review notes for first captures before repeat routing
- completion-tied referral rules reviewed by humans before any Austin referral push
- site-visit trust materials for approved capturers when operator-facing credibility is required

## Readiness Scorecard
| Dimension | Score | Rationale |
|---|---:|---|
| channel reachability | 3/5 | Austin has credible narrow-channel options, but no proven city-level response data yet |
| likely supply quality | 4/5 | Relationship-seeded cohorts should outperform broad volume if the bar stays high |
| operations feasibility | 3/5 | A small first cohort is operationally plausible. Agent bootstraps are complete, so field-ops-agent and intake-agent now exist as named owners for city-specific rules, but Austin capacity thresholds and assignment logic still need to be written. |
| measurement readiness | 3/5 | Structured capturer and buyer signup events now exist in the current worktree, but Austin city and market cuts are not yet validated in analytics or deployed |
| legal/compliance clarity | 2/5 | Incentive language, public posting rules, and local interpretation still require human review |
| strategic importance | 4/5 | Austin is the cleaner place to learn city launch mechanics before broader expansion |

## Austin Operating Model

### Founder-only
- decide whether Austin stays a gated pilot or expands
- approve any new Austin spend envelope
- approve any public claim that would change Blueprint's company posture
- approve any non-standard pricing, contract, or commercialization commitment
- decide any rights, privacy, or policy exception that would change trust, legality, or irreversible external commitments

### Human operator-owned
- `growth-lead`: owns Austin channel posture, source policy, referral mechanics inside approved guardrails, and invite/access-code posture
- `growth-lead` or `ops-lead`: may issue Austin invites or access codes inside the written Austin cohort policy
- `ops-lead`: owns the Austin intake rubric, first-capture activation thresholds, operator-facing trust kit, and launch-readiness ops checklist
- designated human commercial owner: handles standard Austin buyer progression and standard quote approvals inside approved price bands with `buyer-solutions-agent` and `revenue-ops-pricing-agent` support

### Agent-prepared / autonomous
- `city-launch-agent`: maintains the Austin plan, dependency map, and operator-ready decision packet inputs
- `conversion-agent`: ships Austin-specific invite/access-source entry copy that preserves truthful no-guarantee language
- `analytics-agent` plus `webapp-codex`: validate Austin source, cohort, approval, first-capture, and repeat-capture instrumentation end to end
- `intake-agent`: classifies Austin applicants using the Ops Lead-approved rubric and flags exceptions instead of inventing approvals
- `field-ops-agent`: runs assignment, reminder, and escalation logic inside the Austin activation thresholds
- `notion-manager-agent`: keeps Austin launch-readiness and operator views current so routine approvals stay out of founder-facing queues

### Exception-only escalation
- rights, privacy, consent, or commercialization ambiguity routes to `rights-provenance-agent` plus a designated human reviewer; founder sees only precedent-breaking exceptions
- pricing, contract, or packaging outside approved Austin bands routes to designated human commercial owner plus `revenue-ops-pricing-agent`; founder sees only non-standard commitments
- Austin should not hit Founder OS for routine invite issuance, referrals inside policy, rubric approval, threshold tuning, trust-kit updates, analytics validation, or proof-pack quality checks

## Near-Term Experiments
1. Compare founder-introduction cohorts against access-code seeded maker-community cohorts once source tagging is validated, using approval and first-capture quality rather than signup volume as the decision signal.
2. Test whether invite-only Austin copy can increase truthful high-intent applications without reopening generic gig-market expectations.
3. Validate whether approved-capturer referrals should remain blocked until first-passed-capture evidence and written Austin referral guardrails are both in place.

## Issue-Ready Work Queue
| Owner | Proposed issue | Why now | Done when |
|---|---|---|---|
| `growth-lead` | Publish Austin cohort policy covering source rules, referral guardrails, and invite/access-code issuance | Austin routine access decisions should leave the founder lane immediately | Austin policy names who may issue invites, what sources count, and when Austin remains invite-only |
| `ops-lead` | Approve Austin intake rubric, first-capture thresholds, trust kit, and readiness checklist | Austin routine launch ops need a named operator lane before the first cohort scales | Operator packet exists for rubric, threshold, trust-kit, and readiness ownership |
| `conversion-agent` | Add Austin cohort-aware entry path and access-source copy | Austin should begin as a gated pilot, not a generic signup blast | Austin source or cohort entry path exists, preserves truthful no-guarantee language, and records access source end to end |
| `analytics-agent` + `webapp-codex` | Build and verify Austin launch scorecard for source -> approval -> first capture | Austin expansion should be gated on real activation data, not signups | Baseline Austin funnel can report signup start, step completion, account creation, approval, first capture, and repeat capture by cohort and access source |
| `buyer-solutions-agent` + designated human commercial owner | Define Austin standard buyer-thread handling and quote handoff | Standard commercial handling should not jump straight to founder review | Austin buyer threads stay in standard handling unless pricing, rights, or contract exceptions appear |

## Sequencing Recommendation
Austin should remain ahead of San Francisco for the first live capturer cohort. If Austin cannot produce a clean, instrumented, trust-heavy pilot, San Francisco should not be treated as a fallback volume market. Austin needs to prove narrow-cohort activation and access discipline first.
