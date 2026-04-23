---
authority: draft
source_system: paperclip
source_urls:
  - "paperclip://issue/38a5d5d8-4855-463b-9ada-d2fb5efb9a12"
last_verified_at: 2026-04-22
owner: analytics-agent
sensitivity: internal
confidence: 0.74
---

# Durham Launch Scorecard and Blocker View

## Summary

Durham is publishable as a scorecard plus blocker view, but the deterministic writer path is blocked on a 502 response. The repo truth is still honest: the city is activation-ready, buyer direct outreach remains gated by recipient-backed contact evidence, and the public-commercial lane is still waiting on first-send approval.

## Evidence

- The current Paperclip issue `BLU-3564` is checked out to `analytics-agent` and is `in_progress`.
- The Durham launch system still reports `planning_state: refresh in progress`.
- The Durham execution report shows `channels_ready_or_created: 4`, `sends_ready_or_sent: 2`, `sends_marked_sent: 2`, `responses_routed: 0`, and `outbound_readiness_status: warning`.
- The Durham send ledger keeps the public-commercial community lane at `ready_to_send` with `pending_first_send_approval`.
- The Durham activation payload keeps direct buyer outreach blocked until recipient-backed human contact emails are verified.
- The Durham target ledger is still hypothesis-ranked and treats Welcome Venture Park as blocked until the exact subspace, operator path, and rights posture are explicit.
- The deterministic analytics writer route returned HTTP 502 for the Durham report payload, so the proof-artifact publication path did not complete.
- Missing Notion and Slack proof artifacts therefore remain a blocker for a truthful done state on this run.

## Recommended Follow-up

- Restore the deterministic analytics writer route, then rerun the Durham scorecard publish path.
- Verify the city-launch sender/domain in the active mail provider before claiming outbound readiness beyond warning state.
- Keep buyer direct outreach blocked until recipient-backed contact emails are verified.

## Linked KB Pages

- [Durham launch system](/Users/nijelhunt_1/workspace/Blueprint-WebApp/docs/city-launch-system-durham-nc.md)
- [Durham launch issue bundle](/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/playbooks/city-launch-durham-nc-execution-issue-bundle.md)
- [Durham city-opening execution report](/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/playbooks/city-opening-durham-nc-execution-report.md)
- [Durham send ledger](/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/playbooks/city-opening-durham-nc-send-ledger.md)

## Authority Boundary

This report is a derivative work product. It does not replace Paperclip work state, approvals, rights/privacy review, pricing/legal commitments, capture provenance, or package/runtime truth.
