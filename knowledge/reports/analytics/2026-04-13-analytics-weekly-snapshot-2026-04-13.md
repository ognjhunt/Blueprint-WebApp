---
authority: draft
source_system: paperclip
source_urls:
  - "paperclip://issue/26ad19c1-1def-4dc3-a32b-2e5403f302b9"
last_verified_at: 2026-04-13
owner: analytics-agent
sensitivity: internal
confidence: 0.7
---

# Analytics Weekly Snapshot - 2026-04-13

## Summary

Analytics Weekly is blocked by missing runtime feeds and proof delivery credentials.

## Evidence

- Live GA4, Stripe, Firehose, and Firestore admin feeds are not configured in this runtime, so the weekly KPI contract cannot be verified from live data here.
- The repo documents `VITE_FIREBASE_MEASUREMENT_ID` as the GA measurement fallback alias, so the missing runtime feed should be reported as GA measurement unavailable rather than a missing GA4 key.
- Austin and San Francisco scorecards should stay operator-facing only until tagged demand/source data and proof-path truth are available.
- The current shell environment shows `VITE_GA_MEASUREMENT_ID`, `STRIPE_SECRET_KEY`, `FIREHOSE_API_TOKEN`, and Firestore admin credentials unset.
- The analytics-report writer requires a KB artifact, a Notion Knowledge mirror, and a Slack delivery target before it can return a truthful done state.
- Existing daily analytics evidence already recorded the same blocked state, which is consistent with the live runtime here.
- Any end-to-end attribution claim would violate the KPI contract because identity stitching across Firestore, Stripe, and behavioral analytics is unavailable in this window.
- If Notion or Slack proof artifacts cannot be written, the run must stay blocked instead of being marked done.
- City-level readiness claims for Austin or San Francisco remain blocked until tagged source data exists for the current window.

## Recommended Follow-up

- Restore `VITE_GA_MEASUREMENT_ID` or `VITE_FIREBASE_MEASUREMENT_ID`, plus `STRIPE_SECRET_KEY` and `FIREHOSE_API_TOKEN`, or provide an approved fallback source, then rerun Analytics Weekly.
- Provision `NOTION_API_TOKEN` and a Slack webhook target for analytics delivery so the deterministic writer can complete proof artifacts on this host.
- Create or verify tagged Austin and San Francisco source data before publishing any city-level readiness claim.

## Linked KB Pages

- Related KB pages

## Authority Boundary

This report is a derivative work product. It does not replace Paperclip work state, approvals, rights/privacy review, pricing/legal commitments, capture provenance, or package/runtime truth.
