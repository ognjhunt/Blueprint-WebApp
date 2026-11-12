---
authority: draft
source_system: paperclip
source_urls:
  - "paperclip://issue/26ad19c1-1def-4dc3-a32b-2e5403f302b9"
last_verified_at: 2026-04-27
owner: analytics-agent
sensitivity: internal
confidence: 0.7
---

# Analytics Weekly Snapshot - 2026-04-27

## Summary

Analytics Weekly is blocked by missing live feeds and proof delivery dependencies.

## Evidence

- Notion token and Slack webhook targets are configured on this host, so proof delivery is available.
- GA4 measurement feed and Firestore admin feed are absent, so current-window behavioral and queue-state verification remain blocked.
- Firehose bridge access is missing, so external demand and operator signal reconciliation cannot be refreshed.
- Stripe secret key is present, but revenue truth still needs live verification before any commercial claim.
- The bound analytics issue remains the active execution truth in Paperclip and should stay issue-bound.
- Austin and San Francisco readiness claims remain blocked until tagged source data exists for the current window.
- End-to-end attribution stays blocked because Firestore, Stripe, and behavioral identity stitching is incomplete.
- The report can be delivered as a blocked weekly proof packet, but not as a fully verified KPI closeout.
- Founder-facing reporting would overstate confidence if missing feeds were smoothed over.
- Missing Firehose keeps external signal reconciliation stale.
- No Firestore admin path means queue and open-work claims cannot be refreshed truthfully.

## Recommended Follow-up

- Restore Firehose bridge access or an approved fallback source, then rerun Analytics Weekly.
- Restore GA4 measurement access and Firestore admin credentials so the weekly KPI contract can be verified.
- Verify or create tagged Austin and San Francisco source data before publishing any city readiness claim.

## Linked KB Pages

- Related KB pages

## Authority Boundary

This report is a derivative work product. It does not replace Paperclip work state, approvals, rights/privacy review, pricing/legal commitments, capture provenance, or package/runtime truth.
