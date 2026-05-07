# Durham, NC — Blueprint City Demand Plan

## Status
- phase: activation_ready
- owner: city-demand-agent
- latest-refresh: 2026-05-07
- planning-state: completed
- confidence: medium

## City Demand Thesis
Durham demand should stay proof-led: qualify real robot-team interest, classify exact-site versus adjacent-site fit inside one business day, and route serious threads into hosted review with clear artifact handoff and human-gated exceptions.

## What Changed This Pass
- evidence-backed: the city launcher now generates the compact demand playbook during activation so downstream tasks have a real canonical reference.
- evidence-backed: city demand instrumentation is pinned to the platform event model rather than custom city-specific events.
- evidence-backed: current deep research names buyer targets such as BotBuilt.

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

- robot_team_inbound_captured: required_tracked
- proof_path_assigned: required_tracked
- proof_pack_delivered: required_tracked
- hosted_review_ready: required_tracked
- hosted_review_started: required_tracked
- hosted_review_follow_up_sent: required_tracked
- human_commercial_handoff_started: required_tracked
- proof_motion_stalled: required_tracked
- city_launch_lawful_access_established: required_tracked
- city_launch_capturer_approved: required_tracked
- city_launch_capture_completed: required_tracked
- city_launch_capture_qa_passed: required_tracked
- city_launch_proof_asset_rights_cleared: required_tracked
- city_launch_proof_pack_delivered: required_tracked
- city_launch_hosted_review_ready: required_tracked
- city_launch_commercial_handoff: required_tracked

## Sensitive-Lane Constraints
- if a buyer sits in defense, aerospace, export-controlled, or air-gapped environments, block the standard hosted-review path until the policy and evidence path are explicit
- do not imply that Blueprint can serve sensitive or controlled-access environments over a standard cloud runtime without buyer-specific confirmation
- operator-governed facilities and rights-sensitive exact-site requests should route through `rights-provenance-agent` plus written policy evidence

## Immediate Next Actions
1. materialize the research-backed buyer targets and first-touch candidates as soon as deep research completes
2. keep `buyer-solutions-agent` and `revenue-ops-pricing-agent` on standard commercial prep while founders stay out of routine proof motion
3. block city-specific outbound scale until proof packs and hosted reviews are real, not just planned