# Sacramento, CA City-Opening Execution Report

- status: generated execution snapshot
- purpose: show what is ready, what is live, and what is still blocked in city-opening execution

- channels_ready_or_created: 4
- sends_ready_or_sent: 3
- sends_marked_sent: 0
- sends_blocked: 1
- responses_routed: 0
- outbound_readiness_status: draft_ready

## Interpretation
- `ready_to_create` means the channel/account is planned and ready for operator setup, not that it already exists.
- `ready_to_send` means the outreach/post is prepared and pending the first-live-send approval path.
- `sent` means a real send/post has been recorded in the send ledger.
- response ingest stays in the send ledger until the reply-conversion lane routes it onward.

## Current blockers
- sacramento-ca-send-warehouse-direct-1: SendGrid sender identity is still unverified, so the Raymond West draft remains approval-ready but not live.
- sacramento-ca-send-professional-capturer-1: No verified recipient or operator contact exists for the ambient-module thread yet, so the lane stays parked until a real owner is found.
