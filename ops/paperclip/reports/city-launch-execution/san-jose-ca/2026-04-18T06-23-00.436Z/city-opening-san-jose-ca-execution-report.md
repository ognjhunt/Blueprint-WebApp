# San Jose, CA City-Opening Execution Report

- status: generated execution snapshot
- purpose: show what is ready, what is live, and what is still blocked in city-opening execution

- channels_ready_or_created: 4
- sends_ready_or_sent: 4
- sends_marked_sent: 2
- sends_blocked: 0
- responses_routed: 0
- outbound_readiness_status: warning

## Interpretation
- `ready_to_create` means the channel/account is planned and not yet auto-opened for a launch lane.
- `ready_to_send` means the outreach is eligible for autonomous dispatch when a real recipient exists and transport is available.
- `sent` means a real send/post has been recorded in the send ledger.
- response ingest stays in the send ledger until the reply-conversion lane routes it onward.

## Outbound readiness
- direct_outreach_total: 3
- direct_outreach_recipient_backed: 2
- email_transport_configured: true
- city_launch_sender: ohstnhunt@gmail.com

### Outbound warnings
- Sender verification cannot be proven programmatically from env state. Confirm the configured city-launch sender/domain is verified in the active mail provider before claiming outward launchability.

## Current blockers
- san-jose-ca-send-professional-capturer-1: missing real recipient email First curated professional outreach draft ready for approval.