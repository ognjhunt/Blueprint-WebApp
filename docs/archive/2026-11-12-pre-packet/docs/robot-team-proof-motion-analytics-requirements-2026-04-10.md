# Robot-Team Proof-Motion Analytics Requirements

Date: 2026-04-10

Scope: repo-ready analytics requirements for the robot-team proof motion in `Blueprint-WebApp`.

## Purpose

This document translates the robot-team demand playbook into the current repo contract for analytics.

It separates:

- event coverage that already exists in code
- proof-motion signals that are still missing
- reporting views growth should be able to build from the current `growth_events` and `inboundRequests.ops.proof_path` surfaces

The goal is measurement clarity, not a new service or a new source of truth.

## Source Of Truth

The current authoritative sources are:

- `growth_events` for first-party analytics event capture
- `inboundRequests.ops.proof_path` for proof-path milestone timestamps and manual ops backfills
- `client/src/lib/analytics.ts` for client event definitions
- `client/src/components/site/ContactForm.tsx` for intake capture events
- `client/src/pages/ExactSiteHostedReview.tsx` for exact-site review view events
- `client/src/pages/AdminLeads.tsx` for proof-path milestone updates from ops and review-link actions
- `server/routes/admin-leads.ts` for reporting over growth events and queue state
- `docs/proof-motion-tags.md` for the canonical buyer-target, proof-pack, and hosted-review tag vocabulary

## Existing Coverage

These proof-motion signals already exist in the repo:

| Signal | Current event or state | Where it exists |
| --- | --- | --- |
| exact-site landing view | `exact_site_review_view` | `client/src/pages/ExactSiteHostedReview.tsx` |
| proof-path stage update | `proof_path_stage_updated` | `client/src/lib/analytics.ts` and `client/src/pages/AdminLeads.tsx` |
| contact request started | `contact_request_started` | `client/src/lib/analytics.ts` and `client/src/components/site/ContactForm.tsx` |
| contact request submitted | `contact_request_submitted` | `client/src/lib/analytics.ts` and `client/src/components/site/ContactForm.tsx` |
| contact request completed | `contact_request_completed` | `client/src/lib/analytics.ts` and `client/src/components/site/ContactForm.tsx` |
| contact request failed | `contact_request_failed` | `client/src/lib/analytics.ts` and `client/src/components/site/ContactForm.tsx` |
| robot-team fit checked | `robot_team_fit_checked` | `server/routes/inbound-request.ts` on intake capture and `server/routes/admin-leads.ts` on review update |
| experiment exposure | `experiment_exposure` | `client/src/lib/analytics.ts` |
| proof-path milestone persistence | `inboundRequests.ops.proof_path` | `client/src/types/inbound-request.ts` and server request types |

This means the repo already measures parts of the robot-team motion, but the funnel is still split between:

- landing-page events
- contact-request events
- ops-stamped proof-path milestones

The missing work is to make those pieces report as one coherent proof-motion funnel.

## Tracking Contract

These are the analytics signals the playbook expects. Some are now emitted directly from intake or ops update paths; later proof-delivery and conversion stages still depend on downstream package, hosted-review, and follow-up work.

| Required signal | Required payload shape | Notes |
| --- | --- | --- |
| `robot_team_inbound_captured` | source, city, buyer_role, requested_lane | Captures the first serious robot-team signal before qualification framing expands it |
| `robot_team_fit_checked` | exact_site_classification, adjacent_site_allowed, proof_path_preference, proof_ready_outcome, proof_readiness_score | Records whether the request has a truthful proof scope |
| `proof_path_assigned` | outcome, assigned_by, source, buyer_segment | Distinguishes exact-site, adjacent-site, or scoped follow-up |
| `proof_pack_delivered` | delivery timestamp, artifact summary, source, buyer_segment | Measures time-to-proof and what was included |
| `hosted_review_ready` | hosted_mode, review_path, buyer_segment | Confirms a real technical inspection surface exists |
| `hosted_review_started` | source, buyer_segment, hosted_mode | Measures whether proof packs actually open technical review |
| `hosted_review_follow_up_sent` | next_step_recommendation, source, buyer_segment | Keeps follow-up operational instead of anecdotal |
| `exact_site_request_created` | site_request_type, source, buyer_segment | Captures product pull for exact-site scope |
| `deeper_review_requested` | source, buyer_segment, blocker_type | Separates deeper evaluation from straight commercial escalation |
| `human_commercial_handoff_started` | handoff_reason, source, buyer_segment | Marks the start of human-only pricing, contract, or commercial handling |
| `proof_motion_stalled` | blocker_reason, blocker_detail, source, buyer_segment, city | Exposes where the motion breaks |

Implementation note:

- use explicit snake_case event names in `growth_events`
- keep proof-path milestone timestamps on `inboundRequests.ops.proof_path`
- do not replace the milestone timestamps with derived analytics state
- do not invent city or buyer-segment labels when the upstream request does not carry them

## Reporting Views

These are the reporting views growth should be able to build from the current stack:

### 1. Funnel Daily View

Purpose:

- count the proof-motion stages by day
- compare stages to each other over time

Inputs:

- `growth_events`
- `inboundRequests.ops.proof_path`

Measures:

- inbound volume
- proof-path assignment rate
- proof-pack delivery rate
- hosted-review readiness rate
- hosted-review start rate
- follow-up rate
- human commercial handoff rate
- stall rate

### 2. Time-To-Proof Cohort View

Purpose:

- measure the time from qualified inbound to proof-pack delivery
- measure the time from qualified inbound to hosted-review readiness

Inputs:

- `inboundRequests.ops.proof_path.qualified_inbound_at`
- `inboundRequests.ops.proof_path.proof_pack_delivered_at`
- `inboundRequests.ops.proof_path.hosted_review_ready_at`

Measures:

- median time to proof-pack delivery
- median time to hosted-review readiness
- percentile spread for slow requests

### 3. Hosted-Review Conversion View

Purpose:

- measure whether the proof pack converts into a real hosted review

Inputs:

- `proof_pack_delivered`
- `hosted_review_ready`
- `hosted_review_started`
- `hosted_review_follow_up_sent`

Measures:

- proof-pack delivered to hosted-review-started conversion
- hosted-review-started to follow-up conversion
- follow-up to handoff conversion

### 4. Stall-Reason Breakdown

Purpose:

- see why proof motion stops
- keep source and buyer segment attached to the failure mode

Inputs:

- `proof_motion_stalled`
- `inboundRequests.ops.proof_path`
- attribution fields in `growth_events`

Measures:

- stall reasons by source
- stall reasons by buyer segment
- stall reasons by city
- stall reasons by exact-site vs adjacent-site classification

### 5. Handoff-Pressure View

Purpose:

- isolate motion that reaches human commercial handling
- keep technical proof follow-up distinct from commercial escalation

Inputs:

- `human_commercial_handoff_started`
- `inboundRequests.ops.proof_path.human_commercial_handoff_at`

Measures:

- time to human commercial handoff
- share of motions that need human follow-up
- handoff reason distribution

## Gap Summary

Current repo coverage is enough to observe:

- exact-site landing interest
- contact-request completion
- ops-managed proof-path updates

It is not yet enough to report the full funnel without a few dedicated events for:

- proof-path assignment
- proof-pack delivery
- hosted-review start
- hosted-review follow-up
- stall reasons

## Acceptance Criteria

This requirement is met when:

- the playbook names the exact repo surfaces that already exist
- missing proof-motion stages are listed with their required payloads
- reporting views are defined in terms of existing repo data sources
- no new primary service is introduced
- the distinction between event capture and proof-path milestone truth remains explicit

## Autonomy Gate

City-launch automation should not be treated as governance-ready until the required proof-motion events above are tracked end to end or explicitly marked blocked in the activation payload.
If these events are missing, the city may still plan, but widening and autonomous launch-health claims should stay blocked.
