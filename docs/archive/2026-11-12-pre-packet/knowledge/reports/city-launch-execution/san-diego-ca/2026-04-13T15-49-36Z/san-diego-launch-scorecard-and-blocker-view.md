---
authority: draft
source_system: paperclip
source_urls:
  - "paperclip://issue/9a0ca4ce-6f81-49de-bff6-a6015ca1299a"
last_verified_at: 2026-04-13
owner: analytics-agent
sensitivity: internal
confidence: 0.7
---

# Analytics Weekly Snapshot - 2026-04-13

## Summary

San Diego is measurable on supply-side materialization, and the canonical buyer-motion tag vocabulary is now defined; buyer-side and live conversion are still blocked by missing live evidence.

## Evidence

- The San Diego capture target ledger is materialized: 25 immediate targets, 100 expansion buckets, and a 300-1000 universe model now exist.
- The San Diego capturer prospect package is draft-first and human-gated; 25 prospects were upserted and no public posting happened.
- No buyer targets, touches, or budget recommendations were created in the current San Diego materialization run.
- The launch system still sits at draft_pending_founder_approval, so scorecard claims must stay bounded and not read as active launch proof.
- Source-of-truth paths now exist for the city target ledger and supply package, but the demand loop has not been materially seeded.
- The city launch system explicitly requires live repo truth sources for the scorecard and says missing instrumentation must stay blocked.
- The only recent San Diego execution artifact in repo truth is the supply materialization; it is not a proxy for demand readiness.
- The root launch issue remains blocked, so the scorecard should frame the city as queued rather than activated.
- Buyer-side funnel stages are still at zero in the current run, but the canonical Firestore and analytics tag vocabulary is now defined in `docs/proof-motion-tags.md`; the remaining blocker is live evidence, not schema ambiguity.
- Hosted-review and proof-pack progress cannot be claimed from the current run because no buyer-target or touch evidence exists.
- Any claim of activation would overstate readiness while founder approval remains draft_pending_founder_approval.
- The current run only proves supply targeting, not end-to-end city activation.

## Recommended Follow-up

- Seed live San Diego buyer-target, proof-pack, and hosted-review evidence so the scorecard can move from tag validation to actual motion.
- Route the San Diego proof-pack and rights-clearance work so at least one proof-ready listing exists before the next scorecard refresh.
- Publish San Diego buyer-target research and outbound sequencing so the demand loop has live evidence instead of zero-touch placeholders.
- Update the root San Diego launch packet with activation approval status so the measurement view can distinguish draft-only from active work.

## Linked KB Pages

- Related KB pages

## Authority Boundary

This report is a derivative work product. It does not replace Paperclip work state, approvals, rights/privacy review, pricing/legal commitments, capture provenance, or package/runtime truth.
