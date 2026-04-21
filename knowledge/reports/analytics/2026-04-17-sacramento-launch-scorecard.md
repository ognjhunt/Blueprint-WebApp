---
authority: draft
source_system: paperclip
source_urls:
  - "paperclip://issue/b422892a-356e-4147-8c39-8a80fe585d5b"
  - "repo:///ops/paperclip/reports/city-launch-execution/sacramento-ca/2026-04-18T02-13-51.618Z/city-launch-sacramento-ca.md"
  - "repo:///ops/paperclip/reports/city-launch-execution/sacramento-ca/2026-04-18T02-13-51.618Z/city-launch-issue-bundle-sacramento-ca.md"
last_verified_at: 2026-04-17
owner: analytics-agent
sensitivity: internal
confidence: 0.82
---

# Analytics Daily Snapshot - 2026-04-17

## Summary

Sacramento launch scorecard remains publishable, but the city is still blocked on supply, demand, proof motion, and widening.

## Evidence

- The live Sacramento scorecard collector ran at `2026-04-18T02:15:57.701Z` and returned a zero-budget, founder-approved activation-ready posture with widening still disabled.
- Supply is still blocked: 0 supply prospects contacted, 0 Sacramento source-tagged signups or applications, 0 approved capturers, 0 first captures, 0 QA-passed captures, and 0 proof-ready listings or proof packs.
- City-opening readiness is prepared but not live: 4 channels are ready, 0 have been sent, 0 blocked sends exist, and 0 responses have been recorded or routed.
- Demand motion is still blocked: 0 robot-team inbound captures, 0 proof-path assignments, 0 proof-pack deliveries, 0 hosted reviews started, 0 hosted-review follow-ups sent, and 0 human commercial handoffs have been recorded.
- The proof-motion stall metric is 0, which is good, but it does not change the fact that the core proof-motion milestones are missing.
- The activation payload keeps widening disabled because at least one proof-ready city asset, one hosted review, three approved capturers, and two onboarded capturers are still missing.
- The current validation blockers remain `buyer_stack_fit` and `air_gapped_delivery_constraint`, both marked high and requiring validation before live outreach claims can be upgraded.
- The Sacramento target ledger still points to `US Cold Storage - Ambient Module`, `McClellan Park - Building 775 (Light Industrial)`, `Sacramento Costco - Natomas`, `Home Depot - Sacramento (Cal Expo)`, `Safeway - Alhambra Blvd`, `Walmart Supercenter - Natomas`, and `Arden Fair Mall - Common Areas`.

## Scorecard

| Dimension | Status | Source truth |
| --- | --- | --- |
| Supply readiness | Blocked | live scorecard collector and city launch ledgers |
| City opening readiness | On track | city-opening channel registry and send ledger |
| Demand motion | Blocked | growth events, proof-path state, and inbound requests |
| Budget | On track | zero-budget activation payload |
| Widening eligibility | Blocked | activation guard and validation blockers |

## Blocker View

- Missing live proof-ready city asset.
- Missing completed hosted review.
- Missing proof-pack delivery stamp in the live path.
- Missing hosted-review follow-up stamp in the live path.
- Missing robot-team inbound demand signal.
- Missing proof-path assignment signal.
- Missing first approved capturer and first completed capture.
- Missing explicit evidence that the exact-site artifact is compatible with NVIDIA Omniverse and iWAREHOUSE.
- Missing explicit evidence that air-gapped delivery is not required for the buyer segment.

## Recommended Follow-up

- Keep Sacramento blocked until proof-pack delivery, hosted-review start, and hosted-review follow-up are stamped in the live path.
- Do not widen until the first proof-ready city asset and one hosted review are real.
- Preserve the zero-budget posture and keep any new city movement grounded in the canonical source.

## Authority Boundary

This report is a derivative work product. It does not replace Paperclip work state, approvals, rights/privacy review, pricing/legal commitments, capture provenance, or package/runtime truth.
