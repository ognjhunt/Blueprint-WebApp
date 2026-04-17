# Austin, TX — Blueprint City Demand Plan

## Status
- phase: activation_ready
- owner: city-demand-agent
- latest-refresh: 2026-04-17
- planning-state: completed
- confidence: medium

## City Demand Thesis
Austin demand should stay proof-led: qualify real robot-team interest, classify exact-site versus adjacent-site fit inside one business day, and route serious threads into hosted review with clear artifact handoff and human-gated exceptions.

## What Changed This Pass
- evidence-backed: Austin is the only active city-launch activation and remains the city-demand lane with the clearest execution posture.
- evidence-backed: the launcher now routes Austin work through a live issue tree, so the demand plan has to produce named downstream work instead of generic planning notes.
- evidence-backed: city demand instrumentation stays pinned to the platform event model rather than custom city-specific events.
- warning: no research-backed Austin buyer target list or proof pack has been materialized yet.

## Likely Robot-Team Buyer Clusters
| Buyer cluster | Facility types | Why Austin fits | Default access posture |
| --- | --- | --- | --- |
| warehouse / fulfillment operators | industrial warehouses, cross-dock facilities, regional distribution sites | Austin has enough logistics and industrial activity to support a proof-led warehouse wedge | buyer-linked exact-site first |
| manufacturing and industrial systems teams | light manufacturing, contract manufacturing, industrial service facilities | exact-site proof is valuable when workflow, boundaries, and recency matter | exact-site or adjacent-site depending on access |
| robotics / autonomy builders | lab-adjacent demo spaces, pilot facilities, integration environments | Austin's technical community can produce high-signal intros if the offer stays specific | partner-introduced, not broad public prospecting |
| industrial inspection and facilities teams | controlled-access industrial sites, maintenance-heavy facilities | site-specific coverage and hosted review are easy to explain against real operational pain | exact-site if requested, otherwise scoped follow-up |
| operator-secondary facilities | sites with recurring access friction or governed boundaries | operator involvement can matter, but only when the site itself creates a real access problem | operator lane only when access friction is real |

## Required Proof Motion
- serious robot-team demand must hit 24-hour proof-path triage
- classify every serious thread as exact_site, adjacent_site, or scoped_follow_up before promising a review surface
- default to proof-pack plus hosted review, with artifact handoff expectations attached
- keep pricing, rights, privacy, and commercialization exceptions out of the technical proof lane until humans are needed

## Relevant Facilities and Exact-Site Needs
- Austin-area industrial parks where access, recency, and staging layout matter
- warehouse and fulfillment facilities with real dock or aisle workflow questions
- manufacturing or industrial service sites where the buyer needs exact-site context before travel or spend
- controlled-access facilities only when operator routing is clearly part of the buyer request
- proof-pack candidates only when rights, provenance, and privacy can be cleared truthfully

## Best-Fit Channels, Communities, and Events
- founder or operator introductions into real robot-team buyer threads
- maker and robotics communities that can produce qualified technical conversations
- university technical communities when they lead to a named buyer or operator
- curated industrial and logistics channels
- bounded public-commercial community channels only when they reach real buyer threads and stay inside the approved source policy

## Demand Readiness Scorecard
| Dimension | Score | Rationale |
| --- | ---: | --- |
| likely robot-team density | 3/5 | Austin has a credible technical base and enough industrial adjacency to support a narrow demand wedge. |
| exact-site proof fit | 3/5 | The city can support exact-site proof, but the current repo still lacks a materialized Austin proof pack. |
| access and commercialization opportunity | 2/5 | Relationships and approvals still dominate, and no standard commercial motion is yet proven in-city. |
| instrumentation readiness | 2/5 | The platform event model exists, but Austin-specific reporting still lacks live metrics coverage. |
| operational follow-through readiness | 2/5 | The issue tree exists, but the city still needs named buyer threads and proof-led follow-up execution. |
| strategic importance | 4/5 | Austin is the active city-launch activation and should remain the primary demand testbed. |
| overall readiness | 3/5 | Active and execution-ready at the planning level, but still blocked on named proof assets and buyer targets. |

## Instrumentation Standard
| Stage | Event or state | Why it matters |
|---|---|---|
| demand signal | `robot_team_inbound_captured` with source, city, buyer role, and requested lane | separates real robot-team demand from generic awareness |
| proof-path triage | `proof_path_assigned` with outcome: exact_site, adjacent_site, scoped_follow_up | shows whether the city has truthful proof scope |
| proof delivery | `proof_pack_delivered` and `hosted_review_ready` | measures time-to-proof and whether a technical review surface exists |
| hosted review | `hosted_review_started` and `hosted_review_follow_up_sent` | measures whether proof actually converts into technical review |

## Operational and Commercial Dependencies
- rights-cleared Austin proof assets for at least one exact-site or clearly labeled adjacent-site target
- buyer-target research that turns Austin corridors into named accounts and first-touch candidates
- analytics validation for `robot_team_inbound_captured` through `hosted_review_follow_up_sent`
- a standard commercial owner for quote bands, discounts, and handoff thresholds
- human review for any rights, privacy, or commercialization exception that would set precedent
- site-operator routing only for controlled-access sites where the operator lane is actually relevant

## Issue-Ready Work Items
- `demand-intel-agent`: turn the Austin target ledger into named buyer threads, facility owners, and first-touch candidates.
- `buyer-solutions-agent`: define the Austin proof-pack structure so exact-site and adjacent-site labels can be used truthfully.
- `analytics-agent`: wire the Austin funnel from `robot_team_inbound_captured` through `hosted_review_follow_up_sent` so city/source reporting is measurable.
- `robot-team-growth-agent`: draft proof-led Austin outbound only after the buyer list and proof-pack requirements exist.
- `ops-lead`: keep the Austin proof pack fail-closed until rights, provenance, and privacy are actually cleared.
- `rights-provenance-agent`: clear the first Austin proof assets or mark them blocked with evidence and next steps.

## Metrics Dependencies

- robot_team_inbound_captured: required_not_tracked
- proof_path_assigned: required_not_tracked
- proof_pack_delivered: required_not_tracked
- hosted_review_ready: required_not_tracked
- hosted_review_started: required_not_tracked
- hosted_review_follow_up_sent: required_not_tracked
- human_commercial_handoff_started: required_not_tracked
- proof_motion_stalled: required_not_tracked

## Sensitive-Lane Constraints
- if a buyer sits in defense, aerospace, export-controlled, or air-gapped environments, require explicit human review before assuming the standard hosted-review path is acceptable
- do not imply that Blueprint can serve sensitive or controlled-access environments over a standard cloud runtime without buyer-specific confirmation
- operator-governed facilities and rights-sensitive exact-site requests should route through `rights-provenance-agent` plus human review

## Immediate Next Actions
1. materialize the Austin buyer target list and first-touch candidates from the active issue tree so the plan has named threads instead of abstract corridor labels.
2. hand `buyer-solutions-agent` a real Austin proof-pack requirement once the first rights-cleared exact-site asset exists.
3. hand `analytics-agent` the Austin funnel definition so city/source reporting is measurable instead of implied.
4. keep `revenue-ops-pricing-agent` and the designated human commercial owner on standby for standard quote handling only.
5. block city-specific outbound scale until proof packs and hosted reviews are real, not just planned.
