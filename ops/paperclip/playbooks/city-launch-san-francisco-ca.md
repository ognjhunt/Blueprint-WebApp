# San Francisco, CA — Blueprint City Launch Plan

## Status
- phase: planning
- owner: city-launch-agent
- last-reviewed: 2026-04-06
- recommended-posture: high-bar gated cohort after Austin learning loop, not public launch
- last-human-launch-decision: not approved

## Launch Thesis
San Francisco is strategically important because it concentrates the most technically sophisticated prospects, but it is the wrong place to prove broad capturer acquisition first. Blueprint should treat San Francisco as a smaller, higher-bar cohort that depends on strong trust tooling, sharper proof, cleaner measurement, and tightly controlled access routing before it widens anything.

The city should answer a different question from Austin: once Blueprint has a credible gated-cohort system, can it attract selective Bay Area contributors through invite or access-code routing without sounding like generic gig work or generic AI infrastructure?

## What Changed This Pass
- evidence-backed: multiple agent bootstraps completed April 5, creating a more complete execution infrastructure than existed at last review — SF now has clearer downstream owners for analytics, conversion, intake, and field-ops dependencies.
- evidence-backed: the capturer signup flow now requires an explicit access-source choice and supports invite/access-code routing in the current worktree.
- evidence-backed: structured signup analytics exist in code, but San Francisco-specific city and referral cuts still need deployment and end-to-end validation.
- evidence-backed: growth-lead weekly review (April 6) flagged the analytics gap as a critical cross-stack risk — SF expansion decisions are even more analytics-dependent than Austin's due to the higher bar and lower tolerance for noise.
- inferred: the transition from bootstrap to execution means SF-specific work items (proof-first copy, high-bar intake rubric, trust pack) now have named agent owners who can act once gated on human approvals.
- inferred: San Francisco still needs a human decision on who can issue access codes and how tightly they are distributed, so it remains a high-bar gated cohort rather than a public recruiting market.

## Why San Francisco Now
- the city has dense robotics, autonomy, simulation, and world-model-adjacent talent
- Bay Area contributors are likely to pressure-test Blueprint's trust and proof story faster than Austin contributors
- success in San Francisco would carry strategic signal value, but only if the product posture remains exact-site and truthful

## Recommended Launch Posture
- do not run San Francisco as an open-volume recruiting market
- use Bay Area outreach only after the first gated-cohort mechanics, trust materials, and measurement baselines are stable
- treat the new access-source step as a controlled pilot substrate, not as a reason to widen recruiting
- keep the cohort small, technical, and referral-heavy

## Target Capturer Profile
- technically sophisticated contributor who can understand exact-site capture quality requirements quickly
- local operator who values legitimacy, review quality, and clear workflow over vague marketplace upside
- most likely sourced through referrals, robotics communities, or trusted operator networks
- comfortable with explicit invite or access-code entry and a higher verification bar
- willing to tolerate a higher verification and review bar than Austin

## Ranked Channel Stack
| Rank | Channel | Why it fits San Francisco | Trust mechanism | Current posture |
|---|---|---|---|---|
| 1 | Approved-contributor referrals | Best path to attention and trust in a noisy market | Named referral and completion-tied rules | Use only after human approval of referral policy |
| 2 | Bay Area robotics and autonomy communities | Highest-likelihood source of technically credible contributors | Community standing plus invite-code cohort | Prepare, do not broaden yet |
| 3 | Founder and operator introductions | Good for high-context, high-trust early conversations | Personal intro and manual review | Use selectively |
| 4 | Technical events and closed cohorts | Useful once trust materials and exact-site proof are stronger | Event-specific invite or application filter | Hold until proof pack is sharper |
| 5 | Broad public social or gig-market style posts | Likely to attract noise and damage trust quickly | Weak | Do not use |

## Trust Infrastructure Required Before Expansion
- stronger contributor-facing proof that explains what is real today, what review exists, what remains gated, and who issued access
- invite-code or referral tagging tied to city, source, and later activation outcomes
- human-reviewed referral rules tied to completed work, not signup volume
- visible approval and first-capture quality bar so technically selective contributors know what Blueprint expects
- operator-safe trust materials for contributor credibility when site access becomes sensitive

## Readiness Scorecard
| Dimension | Score | Rationale |
|---|---:|---|
| channel reachability | 4/5 | Bay Area reach is available, but attention competition is severe without trusted introductions |
| likely supply quality | 4/5 | The city can yield strong technical contributors if the bar and proof are credible |
| operations feasibility | 2/5 | Selective contributors and sensitive facilities raise coordination cost before the city is proven |
| measurement readiness | 3/5 | Structured signup events now exist in the current worktree, but Bay Area city and referral cuts are not yet validated enough to justify expansion |
| legal/compliance clarity | 2/5 | Incentive language, referral rules, and local interpretation remain human-gated |
| strategic importance | 5/5 | The city is strategically valuable, but importance should not be confused with readiness |

## Dependency Map
| Function | What must exist before San Francisco expands | Current state |
|---|---|---|
| Growth | a clear Bay Area cohort thesis and referral-first posture | missing explicit SF cohort boundaries and human-approved referral rules |
| Conversion | SF-specific source-aware entry path and sharper proof language for selective contributors | capturer signup now collects access source in the current worktree, but SF-specific proof language, source taxonomy, and deployment validation are still missing |
| Analytics | city and source instrumentation from first touch through approval and first capture | structured signup events now exist in the current worktree, but SF city and referral cuts are still not validated end to end |
| Intake | higher-bar SF approval rubric with source trust, access routing, and responsiveness standards | current waitlist intake in [server/routes/waitlist.ts](/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/routes/waitlist.ts) stores market and device context, but not a city-specific high-bar workflow or access-source triage |
| Field Ops | clear rules for when SF contributor quality justifies assignment into real captures | field-ops automation exists in [server/utils/field-ops-automation.ts](/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/field-ops-automation.ts), but no Bay Area-specific activation thresholds or load assumptions exist |
| Ops | higher-touch trust kit for selective contributors and sensitive site-access cases | partial admin tooling exists; no SF-specific trust pack or sensitive-site escalation guidance is written down |

## Near-Term Experiments
1. Do not test San Francisco top-of-funnel volume yet; test whether referral-first and access-code seeded sourcing can produce credible high-trust applicants after Austin establishes the baseline instrumentation.
2. Validate whether proof-first Bay Area copy can improve applicant quality without implying broader live-market availability.
3. Compare robotics-community sourcing versus trusted operator introductions only after referral and source tagging are validated.

## Staffing / Ops Implications
- San Francisco should assume a higher review burden per approved contributor than Austin because selective contributors, access routing, and sensitive facilities will expose weak process faster.
- Intake and ops should expect more exception handling around proof, legitimacy, and operator-facing reassurance before Bay Area routing becomes repeatable.
- Field ops should treat San Francisco as a later-stage cohort with stricter assignment criteria, not as overflow volume when Austin is constrained.

## Issue-Ready Work Queue
| Owner | Proposed issue | Why now | Done when |
|---|---|---|---|
| conversion-agent | Add SF proof-first cohort path with access-source routing | San Francisco needs sharper proof and less generic signup framing than Austin | SF entry path exists with source-aware copy, no gig-style positioning, and explicit access routing |
| analytics-agent | Define SF launch scorecard with referral, access-source, and trust-source cuts | SF should only expand if proof and trust are measurable by cohort | Baseline SF funnel can be segmented by referral, access source, community source, approval, first capture, and repeat capture |
| intake-agent | Create SF high-bar approval rubric | Selective Bay Area outreach requires explicit screening expectations | Intake can classify SF applicants by source trust, access route, device fit, responsiveness, and review priority |
| field-ops-agent | Define Bay Area first-capture assignment criteria | SF contributor expectations and facility sensitivity will punish sloppy routing | Ops has written rules for assignment, reminder cadence, and escalation before Bay Area activation expands |
| ops-lead | Build SF contributor trust pack for sensitive site access | Bay Area contributors and sites will require stronger legitimacy signals earlier | Internal materials exist for approved-contributor status, contact path, and operator-facing reassurance |
| growth-lead | Approve SF referral-only or invite-only posture, access-code distribution, and any incentive language | No agent should widen SF acquisition without a human decision | Human decision recorded on referral rules, invite-only scope, access-code distribution, and whether SF remains behind Austin |

## Human Gates
- approve Bay Area referral mechanics and any incentive language
- approve any Bay Area invite or access-code issuance policy
- approve any public San Francisco recruiting or paid spend
- approve any local legal or compliance interpretation
- make the actual San Francisco launch or no-launch call

## Sequencing Recommendation
San Francisco should remain second, not because it lacks value, but because it is less forgiving. Run it only after Austin establishes a trustworthy baseline for cohort tagging, approval logic, first-capture activation, access discipline, and no-hype contributor messaging.
