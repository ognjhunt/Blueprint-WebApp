---
authority: draft
source_system: paperclip
source_urls:
  - "paperclip://issue/9379d5d5-171f-4300-8501-19121cb2dce1"
  - "paperclip://issue/6de79915-bb57-44a2-bdd8-6f2da5815212"
last_verified_at: 2026-04-29
owner: analytics-agent
sensitivity: internal
confidence: 0.7
---

# Analytics Daily Snapshot - 2026-04-29

## Summary

Analytics Daily has two live findings for April 29: GA4 and Firehose coverage remain source-blocked, while the repo/CI-oriented snapshot reported a clean main checkout and green CI after recent E2E stabilization work.

## Evidence

- NOTION_API_TOKEN and both Slack webhooks are present, so proof delivery can complete on this host.
- STRIPE_SECRET_KEY and GOOGLE_APPLICATION_CREDENTIALS are present, so transactional truth and Firestore reads are available.
- VITE_GA_MEASUREMENT_ID is still missing, and FIREHOSE_API_TOKEN remains unset, so behavioral and external-signal coverage stay blocked.
- Publishing a numeric KPI closeout without GA4 or Firehose would overstate confidence.
- The deterministic analytics writer can still create the repo KB artifact, Notion Knowledge page, Notion Work Queue breadcrumb, and Slack digest from this host.
- The KPI contract still requires source precedence to keep GA4 and Firehose gaps visible instead of inferred.
- One analytics run reported that GitHub Actions CI for main was green after a prior E2E route/selector failure, which suggests stabilization rather than a still-open CI outage.
- A single green CI run after a recent failure is not enough to declare the E2E path permanently fixed.
- If a future analytics run depends on Firestore, Stripe, and behavioral joins, any identity-stitch mismatch must be reported as blocked rather than inferred through the report.
- The run can only be called truthful if the deterministic writer returns proof artifacts and the issue is patched to the matching terminal state.

## Recommended Follow-up

- Restore GA4 measurement access or the approved Firebase measurement fallback so behavioral trends can be verified.
- Restore Firehose bridge credentials or an approved alternate source so external demand and operator signals can be reconciled.
- Rerun Analytics Daily after those feeds return and keep any city-level readiness claim blocked until live source truth is available.
- Add a focused regression test around the recently corrected E2E route and selector path so the fix survives the next UI refactor.

## Linked KB Pages

- Related KB pages

## Authority Boundary

This report is a derivative work product. It does not replace Paperclip work state, approvals, rights/privacy review, pricing/legal commitments, capture provenance, or package/runtime truth.
