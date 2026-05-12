# Austin, TX — Blueprint City Launch Plan

## Status
- phase: activation_ready
- owner: city-launch-agent
- last-reviewed: 2026-05-12
- recommended-posture: gated cohort pilot
- launch_policy_state: autonomous_execution_ready
- planning-state: completed

## Launch Thesis
Run one proof-led warehouse wedge.

## What Changed This Pass
- evidence-backed: the generic city-launch activation harness generated the Austin system doc, execution issue bundle, target ledger, and compact city playbooks in one run.
- evidence-backed: the launch harness now tracks planning state explicitly so activation can distinguish "not started" from "research still running".
- evidence-backed: the compact launch packet uses the standard platform analytics event model rather than inventing city-specific telemetry.
- evidence-backed: the target ledger mode for this city is `curated_city_profile`. No research-backed named targets are available yet, so the first live capture work should stay blocked until deep research materializes into named sites.

## Why This City Now
- the city remains a planning candidate only if it can produce rights-cleared exact-site proof assets for real robotics workflows
- the launch should stay anchored to warehouse, manufacturing, inspection, or similarly commercial site types where hosted review creates technical buyer value
- no city should widen until the first proof assets, hosted reviews, and capturer approvals are real and measurable

## Recommended Launch Posture
- Choose the lawful access mode per target from: buyer_requested_site.
- Private controlled interiors require explicit authorization before dispatching capturers.
- Keep the first active capturer cohort capped at roughly 5-10 vetted surveying, AEC, industrial inspection, or commercial mapping operators until the first 3-5 proof-ready sites exist.
- Do not run public bounty, generic gig-worker, or broad community sourcing for private controlled interiors.
- For public, non-controlled commercial locations such as groceries, retail stores, and similar walk-in sites, allow bounded online community sourcing when the brief constrains capture to lawful public areas and preserves privacy, signage, and provenance rules.
- For that public commercial lane, find everyday capturers where they already are online: local city/community groups, neighborhood forums, retail and shopping communities, creator communities, and lightweight campus or gig networks that do not imply private-interior access.
- Keep public posture at Exact-Site Hosted Review wedge only; no city-live or readiness claims until proof is real.
- Preferred first lawful access mode: buyer_requested_site.

## City-Opening Distribution Layer
- City opening is a first-class launch lane, not an implied side effect of having sourcing or demand tasks on paper.
- Austin should open with two explicit awareness tracks: warehouse/facility direct awareness to named buyers, operators, and integrators; and bounded public-commercial awareness through many small community placements rather than one broad campaign.
- Optimize the first wave for first response and truthful routing, not polished branding.
- Every city-opening asset should say who Blueprint is, what is launching in the city, what spaces are in scope, what is not allowed, and the exact CTA path for replies.

## Required Distribution Artifacts
- Austin city-opening brief with warehouse/facility and public-commercial awareness split
- Austin city channel map naming channels, audiences, owners, and message posture
- Austin first-wave outreach/posting pack with direct outreach variants and bounded community-placement variants
- Austin CTA / intake path with source tags and next-owner routing
- Austin response-tracking view showing which channels produced real replies
- Austin reply-conversion queue and follow-up cadence rules so live responses move into the correct next lane
- Austin channel/account registry with ready-to-create, created, or blocked state
- Austin live post/outreach send ledger with ready-to-send, sent, or blocked state plus first-send approval
- Austin city-opening execution report showing what actually went live versus what is still pending
- Austin exact-site buyer loop showing targets, recipient-backed contacts, founder approvals, sends, replies, calls, hosted-review starts, and blockers

## Target Capturer Profile
- site-authorized surveying, AEC scanning, industrial inspection, or commercial mapping operator
- comfortable with repeatable indoor walkthrough capture and explicit rights / privacy boundaries
- able to document access path and site-operator authority without ambiguity
- for public, non-controlled commercial locations, everyday capturers sourced from online communities may participate when they can follow a public-area-only brief and explicit privacy/signage rules

## Ranked Channel Stack
| Rank | Channel | Why it fits | Trust mechanism | Current posture |
|---|---|---|---|---|
| 1 | site-operator introductions | lawful path into private interiors | named operator approval and rights packet | start here |
| 2 | buyer-linked exact-site requests | strongest proof-led capture path | buyer thread plus operator approval | start here |
| 3 | local surveying / AEC / industrial inspection firms | best early supply quality | professional credentials plus first-capture review | curated only |
| 4 | high-trust mapper referrals | useful after first proof assets exist | referral guardrails plus completion history | hold until proof exists |
| 5 | online community capture for public, non-controlled commercial sites | enables everyday capturers to source groceries, retail, and similar walk-in locations through the communities they already use online | public-area-only brief plus privacy/signage guardrails | enable in bounded form |

## Response Signal Standard
- A real live city-opening signal means a real reply, applicant, referral, operator callback, buyer callback, or community response is recorded in the canonical intake path with city, lane, source, and CTA attribution.
- Draft copy, saved prospect lists, and unsent channel ideas are preparation, not live response.
- Warehouse/facility awareness should route into named direct threads with proof-led next steps and access-path truth.
- Public-commercial awareness should route into bounded public-area capture replies without implying blanket permission for private interiors.

## Reply Conversion Cadence
- Once replies start arriving, the city-opening lane should own a shared response queue instead of letting different channels drift into scattered inboxes.
- Each live response should be tagged by responder type, channel, current status, next owner, next follow-up due, and downstream handoff target.
- Reply conversion should hand warehouse/facility responses into operator/buyer/access work, public-commercial responses into qualification, and ambiguous or weak responses into blocked/no-fit states with named reasons.
- A live response does not count as converted just because it exists; it counts when it receives a next step, follow-up cadence, and downstream routing decision.

## City-Opening Execution Layer
- The city-opening execution layer should keep a first-class channel/account registry, a send ledger, a buyer loop, and a current execution report.
- Account creation, send readiness, send approval, sent state, and response ingest should stay visible in canonical artifacts instead of hiding in agent comments.
- The reply-conversion lane should ingest responses from the send ledger rather than assuming responses will be routed manually.

## Rights Path

Private controlled interiors require authorization.

## Trust Infrastructure Required Before Expansion
- written site-operator acquisition path and authority verification checklist
- Ops Lead-approved intake rubric, trust kit, and first-capture thresholds
- standard proof-pack structure with provenance, rights, privacy, recency, and hosted-review path
- platform analytics using `robot_team_inbound_captured`, `proof_path_assigned`, `proof_pack_delivered`, `hosted_review_ready`, and `hosted_review_started` with city/source tags

## Validation Blockers

- none recorded in the current activation payload

## Launch Surface Coverage

| Surface | Owner | Human lane | Artifact | Gate | Blocker behavior |
|---|---|---|---|---|---|
| validation_required | city-launch-agent | growth-lead | activation payload missing launch_surface_coverage | refresh the city deep-research playbook with the current harness | blocked |

## Readiness Scorecard
| Dimension | Score | Rationale |
|---|---:|---|
| channel reachability | 3/5 | Named research exists, but operator-rights paths still need validation. |
| likely supply quality | 3/5 | high if channels stay with site-authorized technical operators, low if widened into generic public recruiting |
| operations feasibility | 3/5 | the issue tree and operator lanes exist, but the city still needs explicit site acquisition and proof-ops packets |
| measurement readiness | 3/5 | platform events exist, but city-specific reporting still needs end-to-end validation |
| legal/compliance clarity | 1/5 | private-interior access, rights authority, and any defense/export constraints remain explicit blockers until reviewed |
| strategic importance | 3/5 | city value is still hypothesis-level until proof-ready assets and hosted reviews exist |

## Autonomous Policy
- city activation runs automatically inside the written budget envelope, source policy, and evidence-backed posture
- unsupported public claims, evidence-free rights/privacy exceptions, and non-standard commercial terms stay automatically blocked until repo truth is updated
- pricing, rights, privacy, and commercialization rules are enforced from the written policy and proof artifacts rather than approval packets

## Sequencing Recommendation
Do not treat Austin as operationally real until a small number of rights-cleared sites, proof packs, and hosted reviews are real. The city should widen only after those proofs exist and the operator lanes can support them.