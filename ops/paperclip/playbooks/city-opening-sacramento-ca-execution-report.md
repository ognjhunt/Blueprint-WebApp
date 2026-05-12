# Sacramento, CA City-Opening Execution Report

- status: generated execution snapshot
- purpose: show what is ready, what is live, and what is still blocked in city-opening execution

- channels_ready_or_created: 0
- sends_ready_or_sent: 0
- sends_marked_sent: 0
- sends_blocked: 1
- responses_routed: 0
- outbound_readiness_status: blocked

## Interpretation
- `ready_to_create` means the channel/account is planned and not yet auto-opened for a launch lane.
- `ready_to_send` means the outreach is eligible for autonomous dispatch when a real recipient exists and transport is available.
- `sent` means a real send/post has been recorded in the send ledger.
- response ingest stays in the send ledger until the reply-conversion lane routes it onward.

## Outbound readiness
- direct_outreach_total: 1
- direct_outreach_recipient_backed: 0
- direct_outreach_ready_to_send: 0
- direct_outreach_founder_approval_needed: 0
- email_transport_configured: true
- city_launch_sender: missing
- Sacramento may be activated operationally, but it is not outwardly addressable yet.

### Outbound blockers
- No recipient-backed direct-outreach send actions were seeded for Sacramento, CA.
- 1 direct-outreach action(s) have invalid or placeholder recipient emails and cannot count as recipient-backed.

## Current blockers
- sacramento-ca-send-legacy-placeholder: invalid or placeholder recipient email Legacy row leaked placeholder recipient.