# San Diego, CA — Blueprint City Demand Plan

## Status
- phase: planning
- owner: city-demand-agent
- latest-refresh: 2026-04-13
- planning-state: completed
- confidence: low

## City Demand Thesis
San Diego demand should stay proof-led: qualify real robot-team interest, classify exact-site versus adjacent-site fit inside one business day, and route serious threads into hosted review with clear artifact handoff and human-gated exceptions.

## What Changed This Pass
- evidence-backed: the city launcher now generates the compact demand playbook during activation so downstream tasks have a real canonical reference.
- evidence-backed: city demand instrumentation is pinned to the platform event model rather than custom city-specific events.
- warning: no research-backed buyer target list has been materialized yet.

## Required Proof Motion
- serious robot-team demand must hit 24-hour proof-path triage
- classify every serious thread as exact_site, adjacent_site, or scoped_follow_up before promising a review surface
- default to proof-pack plus hosted review, with artifact handoff expectations attached
- keep pricing, rights, privacy, and commercialization exceptions out of the technical proof lane until humans are needed

## Instrumentation Standard
| Stage | Event or state | Why it matters |
|---|---|---|
| demand signal | `robot_team_inbound_captured` with source, city, buyer role, and requested lane | separates real robot-team demand from generic awareness |
| proof-path triage | `proof_path_assigned` with outcome: exact_site, adjacent_site, scoped_follow_up | shows whether the city has truthful proof scope |
| proof delivery | `proof_pack_delivered` and `hosted_review_ready` | measures time-to-proof and whether a technical review surface exists |
| hosted review | `hosted_review_started` and `hosted_review_follow_up_sent` | measures whether proof actually converts into technical review |

## Metrics Dependencies

- No machine-readable metrics dependency payload is available yet.

## Sensitive-Lane Constraints
- if a buyer sits in defense, aerospace, export-controlled, or air-gapped environments, require explicit human review before assuming the standard hosted-review path is acceptable
- do not imply that Blueprint can serve sensitive or controlled-access environments over a standard cloud runtime without buyer-specific confirmation
- operator-governed facilities and rights-sensitive exact-site requests should route through `rights-provenance-agent` plus human review

## Immediate Next Actions
1. materialize the research-backed buyer targets and first-touch candidates as soon as deep research completes
2. keep `buyer-solutions-agent` and `revenue-ops-pricing-agent` on standard commercial prep while founders stay out of routine proof motion
3. block city-specific outbound scale until proof packs and hosted reviews are real, not just planned