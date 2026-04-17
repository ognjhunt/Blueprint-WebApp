# San Francisco, CA — Blueprint City Demand Plan

## Status
- phase: planning
- owner: city-demand-agent
- latest-refresh: 2026-04-17
- planning-state: target-ledger_ranked
- confidence: medium-low

## City Demand Thesis
San Francisco demand should stay proof-led and ecosystem-driven: qualify real robot-team interest, prioritize Bay Area warehouse / parcel / 3PL and manufacturing corridors, and move serious threads into exact-site or operator-lane proof before any broader review motion.

## What Changed This Pass
- evidence-backed: the San Francisco capture target ledger now names Oakland airport logistics, Port of Oakland support facilities, Fremont manufacturing, Milpitas electronics corridors, South San Francisco industrial/warehouse, San Leandro distribution, Hayward industrial parks, and Peninsula demo / lab clusters.
- evidence-backed: the Bay Area has dense robotics, logistics, and manufacturing ecosystems, so partner-introduced exact sites and operator intros should outrank broad public prospecting.
- evidence-backed: BARA-style networks, port, cargo, and airport systems are the most credible ecosystem channels for qualified demand.
- evidence-backed: the compact demand lane should stay subordinate to the launch system until a proof pack and hosted review are actually materialized.
- warning: proof-ready listings, hosted reviews, and named first-touch accounts are still not materialized in the compact demand lane.

## Likely Robot-Team Buyer Clusters
| Buyer cluster | Facility types | Why San Francisco fits | Default access posture |
| --- | --- | --- | --- |
| warehouse / parcel / 3PL operators | distribution centers, parcel hubs, tri-valley warehouses, light-industrial belts | Bay Area logistics density gives strong brownfield proof targets | buyer-linked exact-site or tenant mapping |
| advanced manufacturing and electronics teams | factories, supplier corridors, electronics assembly, robotics production | Fremont, Milpitas, and South Bay manufacturing create high-value exact-site proof | operator-lane first |
| industrial inspection and utility teams | industrial parks, utility-adjacent sites, constrained inspection environments | inspection remains technically valuable and maps cleanly to hosted review | exact-site if buyer-requested, otherwise operator intro |
| port, cargo, and airport logistics teams | port support facilities, cargo yards, airport-adjacent logistics | Oakland and SFO corridors are strong logistics proof lanes | operator-lane and tenant mapping |
| robotics integrators and demo / pilot teams | demo spaces, labs, pilot facilities, customer sites | Bay Area ecosystems are dense but secondary to commercially real sites | partner-introduced, not broad public outreach |

## Relevant Facilities and Exact-Site Needs
- warehouse and parcel buildings where exact aisles, staging, and recency matter
- port and cargo support facilities where yard logistics and constrained boundaries matter
- advanced manufacturing and electronics sites where internal logistics and plant support matter
- industrial inspection environments where permissions and site specificity are the main value
- demo, pilot, and lab sites only when they are attached to a real buyer or partner thread
- exact-site proof packs should remain the default ask for Bay Area buyers who care about technical evaluation speed
- operator-lane routing should stay secondary unless a site boundary, permission path, or tenant model makes it necessary
- adjacent-site proof is acceptable only when the buyer thread is strong enough to justify a scoped follow-up

## Best-Fit Channels, Communities, and Events
- Bay Area Robotics Alliance and adjacent technical robotics networks
- site-operator introductions through industrial, port, and logistics operators
- buyer-linked exact-site requests that can be labeled exact-site or adjacent-site immediately
- Port of Oakland, SFO cargo, and warehouse / logistics operator relationships
- local manufacturing and industrial communities in Fremont, Milpitas, South San Francisco, Hayward, and the broader East Bay
- partner-introduced technical demo or pilot environments when they support real buyer evaluation
- bounded logistics and robotics meetups that can produce qualified introductions without public city-launch language

## Demand Readiness Scorecard
| Dimension | Score | Rationale |
| --- | ---: | --- |
| likely robot-team density | 4/5 | The Bay Area has dense logistics, manufacturing, robotics, and industrial ecosystems. |
| exact-site proof fit | 3/5 | Good target density exists, but many of the best targets are access-sensitive and need careful labeling. |
| access and commercialization opportunity | 3/5 | Operator and partner channels are strong, but the best doors are gated and slower to convert. |
| instrumentation readiness | 2/5 | The platform events exist, but San Francisco still lacks end-to-end live proof-motion coverage. |
| operational follow-through readiness | 2/5 | Named buyer threads and proof packs are still missing, so execution is not yet self-propelling. |
| strategic importance | 5/5 | San Francisco remains the highest-density Bay Area market for technically sophisticated buyers. |
| overall readiness | 3/5 | Strong ecosystem density, but still blocked on proof-pack assembly and buyer-thread conversion. |

## Instrumentation Standard
| Stage | Event or state | Why it matters |
|---|---|---|
| demand signal | `robot_team_inbound_captured` with source, city, buyer role, and requested lane | separates real robot-team demand from generic awareness |
| proof-path triage | `proof_path_assigned` with outcome: exact_site, adjacent_site, scoped_follow_up | shows whether the city has truthful proof scope |
| proof delivery | `proof_pack_delivered` and `hosted_review_ready` | measures time-to-proof and whether a technical review surface exists |
| hosted review | `hosted_review_started` and `hosted_review_follow_up_sent` | measures whether proof actually converts into technical review |
| next action | `exact_site_request_created`, `deeper_review_requested`, or `human_commercial_handoff_started` | shows whether San Francisco is moving toward buyer pull or human-only commercial routing |

## Operational and Commercial Dependencies
- rights-cleared proof assets for at least one Bay Area logistics or manufacturing target
- proof-pack assembly with provenance, rights, privacy, recency, and hosted-review fields intact
- a named buyer-target ledger that turns corridors into concrete accounts and first touches
- analytics validation for city/source-tagged funnel events before scaling outbound
- human commercial owner for standard quotes, package bands, and any non-standard commercial ask
- site-operator support only where the access path, tenant rules, or operator permission model changes the deal
- downstream `demand-intel-agent` work to keep the target ledger current and tied to real buyer threads

## Metrics Dependencies
- `robot_team_inbound_captured`
- `proof_path_assigned`
- `proof_pack_delivered`
- `hosted_review_ready`
- `hosted_review_started`
- `hosted_review_follow_up_sent`
- `exact_site_request_created`
- `human_commercial_handoff_started`

## Sensitive-Lane Constraints
- if a buyer sits in defense, aerospace, export-controlled, or air-gapped environments, require explicit human review before assuming the standard hosted-review path is acceptable
- do not imply that Blueprint can serve sensitive or controlled-access environments over a standard cloud runtime without buyer-specific confirmation
- operator-governed facilities and rights-sensitive exact-site requests should route through `rights-provenance-agent` plus human review

## Immediate Next Actions
1. hand `demand-intel-agent` the San Francisco target ledger so named corridors turn into buyer threads, facility owners, and first-touch candidates.
2. hand `buyer-solutions-agent` the San Francisco proof-pack requirement so exact-site, adjacent-site, and scoped-follow-up labels are real before outbound.
3. hand `analytics-agent` the San Francisco funnel definitions so `robot_team_inbound_captured` through `hosted_review_follow_up_sent` are measurable by city and source.
4. keep `revenue-ops-pricing-agent` and the designated human commercial owner on standby for quote bands, while founders stay out of routine proof motion.
5. block city-specific outbound scale until at least one rights-cleared San Francisco proof pack and hosted review are actually materialized.
