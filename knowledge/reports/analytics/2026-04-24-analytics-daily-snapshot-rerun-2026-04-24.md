---
authority: draft
source_system: repo
source_urls:
  - "repo:///ops/paperclip/plugins/blueprint-automation/src/worker.ts"
last_verified_at: 2026-04-24
owner: analytics-agent
sensitivity: internal
confidence: 0.8
---

# Analytics Daily Snapshot - 2026-04-24 (Re-run after source restoration)

## Summary

Analytics Daily re-run completed after partial source restoration. Notion, Slack, Stripe, and Firestore sources are now available. GA4 remains unavailable.

## Evidence

- Notion API token is configured and available for Knowledge and Work Queue writes.
- Slack webhook targets (growth and ops) are configured for digest delivery.
- Stripe secret key is present; will return fresh revenue data for the last 24h.
- Firestore admin credentials available via GOOGLE_APPLICATION_CREDENTIALS; queue-depth and open-item refresh can now complete.
- GA4 measurement ID is still not present; behavioral trend refresh remains blocked.
- Fresh analytics daily artifact generated for 2026-04-24 in repo mirrors.
- Notion Knowledge and Work Queue entries will be updated with fresh content.
- Slack digest will be posted to configured channels.

## Data Availability

- Notion reporting: Available — Notion token is configured for Work Queue and Knowledge writes.
- Slack digest delivery: Available — Slack webhook target is configured for growth and analytics digests.
- GA4 measurement feed: Unavailable — GA measurement ID is not present in the Paperclip runtime environment, and no Firebase fallback alias is set.
- Stripe revenue feed: Available — Stripe secret key is present in the runtime environment.
- Firestore admin feed: Available — Firestore admin credentials are present in the runtime environment.

## Recommended Follow-up

- Restore GA4 measurement access to enable behavioral trend refresh.
- Monitor Firestore read quota to ensure queue-depth refresh completes without exhaustion.
- Verify Notion and Slack artifacts are updated with fresh data from this re-run.
