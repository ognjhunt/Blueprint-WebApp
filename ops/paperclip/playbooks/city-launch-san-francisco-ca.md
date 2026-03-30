# San Francisco, CA — Blueprint City Launch Plan

## Status
- phase: planning
- owner: city-launch-agent
- last-reviewed: 2026-03-30
- recommended-posture: high-bar gated cohort after Austin learning loop, not public launch
- last-human-launch-decision: not approved

## Launch Thesis
San Francisco is strategically important because it concentrates the most technically sophisticated prospects, but it is the wrong place to prove broad capturer acquisition first. Blueprint should treat San Francisco as a smaller, higher-bar cohort that depends on strong trust tooling, sharper proof, and cleaner measurement than Austin.

The city should answer a different question from Austin: once Blueprint has a credible gated-cohort system, can it attract selective Bay Area contributors without sounding like generic gig work or generic AI infrastructure?

## Why San Francisco Now
- the city has dense robotics, autonomy, simulation, and world-model-adjacent talent
- Bay Area contributors are likely to pressure-test Blueprint's trust and proof story faster than Austin contributors
- success in San Francisco would carry strategic signal value, but only if the product posture remains exact-site and truthful

## Recommended Launch Posture
- do not run San Francisco as an open-volume recruiting market
- use Bay Area outreach only after the first gated-cohort mechanics, trust materials, and measurement baselines are stable
- keep the cohort small, technical, and referral-heavy

## Target Capturer Profile
- technically sophisticated contributor who can understand exact-site capture quality requirements quickly
- local operator who values legitimacy, review quality, and clear workflow over vague marketplace upside
- most likely sourced through referrals, robotics communities, or trusted operator networks
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
- stronger contributor-facing proof that explains what is real today, what review exists, and what remains gated
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
| measurement readiness | 3/5 | Core funnel instrumentation is being added in the current repo worktree, but Bay Area cohort reporting and validation are not ready enough to justify expansion |
| legal/compliance clarity | 2/5 | Incentive language, referral rules, and local interpretation remain human-gated |
| strategic importance | 5/5 | The city is strategically valuable, but importance should not be confused with readiness |

## Dependency Map
| Function | What must exist before San Francisco expands | Current state |
|---|---|---|
| Growth | a clear Bay Area cohort thesis and referral-first posture | missing explicit SF cohort boundaries and human-approved referral rules |
| Conversion | SF-specific source-aware entry path and sharper proof language for selective contributors | generic signup flow exists; no SF-specific proof or cohort path |
| Analytics | city and source instrumentation from first touch through approval and first capture | the event contract is now being added in [client/src/lib/analytics.ts](/Users/nijelhunt_1/workspace/Blueprint-WebApp/client/src/lib/analytics.ts), [client/src/pages/CapturerSignUpFlow.tsx](/Users/nijelhunt_1/workspace/Blueprint-WebApp/client/src/pages/CapturerSignUpFlow.tsx), [client/src/pages/BusinessSignUpFlow.tsx](/Users/nijelhunt_1/workspace/Blueprint-WebApp/client/src/pages/BusinessSignUpFlow.tsx), and [client/src/components/site/ContactForm.tsx](/Users/nijelhunt_1/workspace/Blueprint-WebApp/client/src/components/site/ContactForm.tsx), but city- and referral-specific cuts are still not validated end to end |
| Intake | higher-bar SF approval rubric with source trust and responsiveness standards | current waitlist intake in [server/routes/waitlist.ts](/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/routes/waitlist.ts) stores market and device context, but not a city-specific high-bar workflow |
| Field Ops | clear rules for when SF contributor quality justifies assignment into real captures | field-ops automation exists in [server/utils/field-ops-automation.ts](/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/field-ops-automation.ts), but no Bay Area-specific activation thresholds or load assumptions exist |
| Ops | higher-touch trust kit for selective contributors and sensitive site-access cases | partial admin tooling exists; no SF-specific trust pack or sensitive-site escalation guidance is written down |

## Near-Term Experiments
1. Do not test San Francisco top-of-funnel volume yet; test whether referral-first and founder-intro sourcing can produce credible high-trust applicants after Austin establishes the baseline instrumentation.
2. Validate whether proof-first Bay Area copy can improve applicant quality without implying broader live-market availability.
3. Compare robotics-community sourcing versus trusted operator introductions only after referral and cohort-source tagging are validated.

## Staffing / Ops Implications
- San Francisco should assume a higher review burden per approved contributor than Austin because selective contributors and sensitive facilities will expose weak process faster.
- Intake and ops should expect more exception handling around proof, legitimacy, and operator-facing reassurance before Bay Area routing becomes repeatable.
- Field ops should treat San Francisco as a later-stage cohort with stricter assignment criteria, not as overflow volume when Austin is constrained.

## Issue-Ready Work Queue
| Owner | Proposed issue | Why now | Done when |
|---|---|---|---|
| conversion-agent | Add SF proof-first cohort path for selective contributors | San Francisco needs sharper proof and less generic signup framing than Austin | SF entry path exists with source-aware copy and no gig-style positioning |
| analytics-agent | Define SF launch scorecard with referral and trust-source cuts | SF should only expand if proof and trust are measurable by cohort | Baseline SF funnel can be segmented by referral, community source, approval, first capture, and repeat capture |
| intake-agent | Create SF high-bar approval rubric | Selective Bay Area outreach requires explicit screening expectations | Intake can classify SF applicants by source trust, device fit, responsiveness, and review priority |
| field-ops-agent | Define Bay Area first-capture assignment criteria | SF contributor expectations and facility sensitivity will punish sloppy routing | Ops has written rules for assignment, reminder cadence, and escalation before Bay Area activation expands |
| ops-lead | Build SF contributor trust pack for sensitive site access | Bay Area contributors and sites will require stronger legitimacy signals earlier | Internal materials exist for approved-contributor status, contact path, and operator-facing reassurance |
| growth-lead | Approve SF referral-only or invite-only posture and any incentive language | No agent should widen SF acquisition without a human decision | Human decision recorded on referral rules, invite-only scope, and whether SF remains behind Austin |

## Human Gates
- approve Bay Area referral mechanics and any incentive language
- approve any public San Francisco recruiting or paid spend
- approve any local legal or compliance interpretation
- make the actual San Francisco launch or no-launch call

## Sequencing Recommendation
San Francisco should remain second, not because it lacks value, but because it is less forgiving. Run it only after Austin establishes a trustworthy baseline for cohort tagging, approval logic, first-capture activation, and no-hype contributor messaging.
