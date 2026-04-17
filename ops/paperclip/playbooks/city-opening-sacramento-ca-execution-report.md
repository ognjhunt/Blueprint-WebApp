# Sacramento, CA City-Opening Execution Report

- status: generated execution snapshot
- purpose: show what is ready, what is live, and what is still blocked in city-opening execution

- channels_ready_or_created: 4
- sends_ready_or_sent: 1
- sends_marked_sent: 0
- sends_blocked: 1
- responses_routed: 0
- outbound_readiness_status: ready

## Interpretation
- `ready_to_create` means the channel/account is planned and not yet auto-opened for a launch lane.
- `ready_to_send` means the outreach is eligible for autonomous dispatch when a real recipient exists and transport is available.
- `sent` means a real send/post has been recorded in the send ledger.
- response ingest stays in the send ledger until the reply-conversion lane routes it onward.

## Outbound readiness
- direct_outreach_total: 2
- direct_outreach_recipient_backed: 2
- email_transport_configured: true
- city_launch_sender: launches@tryblueprint.io

## Current blockers
- sacramento-ca-send-warehouse-direct-1: Missing rights-cleared proof pack. Capital Robotics first touch is drafted, but it must stay conditional until a proof-ready asset exists.