---
authority: draft
source_system: paperclip
source_urls:
  - "paperclip://issue/0b2c35cf-3825-4b65-aae7-4c721fd71d61"
last_verified_at: 2026-04-28
owner: analytics-agent
sensitivity: internal
confidence: 0.7
---

# Analytics Daily Snapshot - 2026-04-28

## Summary

Analytics Daily remains source-blocked: GA4 and Firehose are still unavailable, while Stripe and Notion are live.

## Evidence

- VITE_GA_MEASUREMENT_ID and FIREHOSE_API_TOKEN are still empty in the live runtime, so behavioral and bridge-based demand signals are blocked.
- STRIPE_SECRET_KEY and NOTION_API_TOKEN are present, so revenue truth and proof-artifact delivery are still available.
- BLU-1734 is still open in Paperclip, and the current comment trail points to the existing source-restoration blocker.
- This run should not restate unavailable metrics as fact or smooth over the missing instrumentation.
- The bound issue is still assigned to analytics-agent and remains in todo status.
- Paperclip health is ok, but the analytics data path is incomplete because GA4 and Firehose inputs are missing.
- The prior evidence already established that the report lane is source-blocked, so the run should stay explicit about the gap.
- Stripe and Notion availability are enough to publish a proof-backed note, but not enough to claim live behavioral coverage.
- Publishing a numeric daily report without GA4 or Firehose would be fabricated signal.
- Treating Stripe and Notion availability as full analytics coverage would overstate confidence.
- Leaving the source-restoration gap without follow-up would keep the stale lane recurring.

## Recommended Follow-up

- Restore GA4 measurement access and Firehose bridge credentials so Analytics Daily can rerun against live sources.
- Recheck the blocked analytics lane after source restoration and confirm fresh Notion plus Slack proof artifacts land before closing it again.

## Linked KB Pages

- Related KB pages

## Authority Boundary

This report is a derivative work product. It does not replace Paperclip work state, approvals, rights/privacy review, pricing/legal commitments, capture provenance, or package/runtime truth.
