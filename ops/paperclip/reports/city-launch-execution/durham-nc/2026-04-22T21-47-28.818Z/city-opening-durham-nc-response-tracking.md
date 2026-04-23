# Durham, NC City-Opening Response Tracking

- status: published execution snapshot
- purpose: measure which Durham city-opening lanes were activated, how many replies were routed, and where attribution is still missing

## Source Basis
- channel registry shows 4 created city-opening lanes
- send ledger shows 2 sent outreach rows and 0 routed replies
- execution report shows outbound readiness warning only; no send-stage transport block

## Activated Lanes

| Lane | Channel class | Activation state | Evidence basis | Routed responses |
| --- | --- | --- | --- | --- |
| warehouse-facility-direct | direct_email_or_intro_thread | activated | one sent direct-outreach row in the send ledger | 0 |
| professional-capturer | curated_professional_outreach | activated | one sent direct-outreach row in the send ledger | 0 |
| buyer-linked-site | buyer_thread_or_intro_request | created, not yet activated | registry only; no send row yet | 0 |
| public-commercial-community | bounded_community_posting | created, not yet activated in the automated launch path | registry only; publication connector is excluded from the automated path | 0 |

## What Counts As A Real Response
- a reply, applicant, referral, operator callback, buyer callback, or community response recorded with city, lane, source, and CTA attribution

## What Does Not Count
- draft copy
- unsent outreach
- account setup alone
- a prospect list with no response

## Current Tracking State
- real Durham city-opening responses routed: 0
- warehouse/facility channels activated: warehouse-facility-direct, professional-capturer
- public-commercial community channels activated: none yet in the automated launch path
- attribution gaps: no response ingest yet, no reply-conversion rows yet, and no message-level response evidence to classify

## Visibility Rules
- separate warehouse/facility direct awareness from public-commercial community awareness
- show which channel classes were activated
- show response counts and attribution gaps
- make missing instrumentation explicit instead of assuming awareness happened
- keep blocked or untracked visibility visible rather than smoothing it into a positive claim

## Current Constraint
- sender verification cannot be proven programmatically from env state, so outbound launchability remains a warning until the active mail provider confirms the configured city-launch sender/domain
