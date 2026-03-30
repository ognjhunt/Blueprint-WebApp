# Austin, TX — Blueprint City Launch Plan

## Status
- phase: planning
- owner: city-launch-agent
- last-reviewed: 2026-03-30
- recommended-posture: gated cohort pilot, not public launch
- last-human-launch-decision: not approved

## Launch Thesis
Austin is the better first city for Blueprint's capturer-side learning loop because founder/operator reach, technical community overlap, and a smaller trust graph should let Blueprint test a narrow, truthful cohort through access-controlled entry before trying to compete for broad attention.

Austin should be used to answer one question first: can Blueprint recruit and activate a small local cohort through trusted channels, visible review steps, and clear no-hype expectations about work, quality, approval, and access routing?

## What Changed This Pass
- evidence-backed: the capturer signup flow now requires an explicit access-source choice and supports invite/access-code routing in the current worktree.
- evidence-backed: structured capturer and buyer signup analytics events are present in code, but Austin-specific city and market reporting still needs deployment and end-to-end validation.
- inferred: Austin still needs a human decision on who can issue invites or access codes, so the city remains a gated pilot rather than a public recruiting motion.

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
| operations feasibility | 3/5 | A small first cohort is operationally plausible, but city-specific capacity rules are not yet written |
| measurement readiness | 3/5 | Structured capturer and buyer signup events now exist in the current worktree, but Austin city and market cuts are not yet validated in analytics or deployed |
| legal/compliance clarity | 2/5 | Incentive language, public posting rules, and local interpretation still require human review |
| strategic importance | 4/5 | Austin is the cleaner place to learn city launch mechanics before broader expansion |

## Dependency Map
| Function | What must exist before Austin expands | Current state |
|---|---|---|
| Growth | named cohort list, access-posture owner, and approved incentive guardrails | missing explicit Austin cohort plan, named access-code owner, and human-approved incentive policy |
| Conversion | Austin-specific invite or access-code entry path with truthful copy and no gig-style framing | capturer signup now collects access source in the current worktree, but Austin-specific source taxonomy, copy, and deployment validation are still missing |
| Analytics | step-level funnel events plus city, cohort, and source properties from signup through first capture | structured signup events now exist in the current worktree, but Austin city and market reporting is not yet validated end to end |
| Intake | Austin-specific approval rubric for device fit, responsiveness, cohort source trust, and access routing | waitlist routing stores market, role, and device in [server/routes/waitlist.ts](/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/routes/waitlist.ts), but there is no gated-cohort rubric or access-source triage yet |
| Field Ops | first-capture assignment, confirmation, reminder, and escalation thresholds for Austin cohort members | core automation exists in [server/utils/field-ops-automation.ts](/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/field-ops-automation.ts), but no Austin-specific activation thresholds or capacity rules exist |
| Ops | trust kit for approved capturers: who to contact, what proof to show, when to escalate operator-facing friction | partial admin and automation surfaces exist; no Austin-specific operator-facing trust materials yet |

## Near-Term Experiments
1. Compare founder-introduction cohorts against access-code seeded maker-community cohorts once source tagging is validated, using approval and first-capture quality rather than signup volume as the decision signal.
2. Test whether invite-only Austin copy can increase truthful high-intent applications without reopening generic gig-market expectations.
3. Validate whether approved-capturer referrals should remain blocked until first-passed-capture evidence and human-reviewed referral language are both in place.

## Staffing / Ops Implications
- Austin should assume manual intake review, manual first-capture exception handling, and human control of access-code issuance for the first cohort, even if the signup funnel becomes better instrumented.
- Field ops should not inherit Austin as an always-on city until assignment thresholds, reminder rules, and escalation owners are written down.
- Ops needs a named owner for operator-facing trust materials before Austin contributors are asked to represent Blueprint in sensitive site contexts.

## Issue-Ready Work Queue
| Owner | Proposed issue | Why now | Done when |
|---|---|---|---|
| conversion-agent | Add Austin cohort-aware entry path and access-source copy | Austin should begin as a gated pilot, not a generic signup blast | Austin source or cohort entry path exists, preserves truthful no-guarantee language, and records access source end to end |
| analytics-agent | Build Austin launch scorecard for source -> approval -> first capture | City expansion should be gated on real activation data, not signups | Baseline Austin funnel can report signup start, step completion, account creation, approval, first capture, and repeat capture by cohort and access source |
| intake-agent | Define Austin approval rubric for gated cohorts and access-source triage | Manual review needs explicit rules before the first cohort arrives | Intake can classify Austin applicants by source quality, device fit, responsiveness, trust tier, and access route |
| field-ops-agent | Write Austin first-capture activation thresholds and escalation rules | Small-cohort ops must stay predictable before volume expands | Austin-approved capturers have clear assignment, reminder, and exception handling rules |
| ops-lead | Package Austin trust kit for site-facing captures and access-code handoff | Approved capturers need operator-safe credibility before real-site work scales | Internal checklist exists for credential note, contact path, escalation owner, and access-code issuer |
| growth-lead | Approve or reject Austin incentive, invite/access-code, and public-posting posture | No agent should invent compensation or citywide recruiting policy | Human decision recorded on referral rules, any incentive language, access-code distribution, and whether Austin stays invite-only |

## Human Gates
- approve any Austin referral or incentive language
- approve any Austin invite or access-code issuance policy
- approve any public city posting or paid spend
- approve any local legal or compliance interpretation
- make the actual Austin launch or no-launch call

## Sequencing Recommendation
Austin should remain ahead of San Francisco for the first live capturer cohort. If Austin cannot produce a clean, instrumented, trust-heavy pilot, San Francisco should not be treated as a fallback volume market. Austin needs to prove narrow-cohort activation and access discipline first.
