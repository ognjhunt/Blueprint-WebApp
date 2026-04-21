---
authority: derived
source_system: paperclip
source_urls:
  - "docs/city-launch-system-sacramento-ca.md"
  - "ops/paperclip/playbooks/city-capture-target-ledger-sacramento-ca.md"
  - "ops/paperclip/playbooks/city-launch-sacramento-ca-outbound-package.md"
  - "ops/paperclip/playbooks/hosted-review-artifact-handoff-checklist.md"
  - "ops/paperclip/playbooks/city-buyer-handoff-escalation-rubric-sacramento.md"
  - "knowledge/compiled/buyer-dossiers/sacramento-proof-pack-rights-clearance.md"
  - "knowledge/reports/analytics/2026-04-17-sacramento-launch-scorecard.md"
last_verified_at: 2026-04-20
owner: solutions-engineering-agent
sensitivity: internal
confidence: 0.8
subject_key: sacramento-hosted-review-technical-eval-plan
freshness_sla_days: 7
review_status: active
canonical_refs:
  - system: report
    ref: "knowledge/reports/analytics/2026-04-17-sacramento-launch-scorecard.md"
  - system: report
    ref: "knowledge/compiled/buyer-dossiers/sacramento-proof-pack-rights-clearance.md"
  - system: report
    ref: "ops/paperclip/playbooks/hosted-review-artifact-handoff-checklist.md"
entity_tags:
  - buyer-enablement
  - hosted-review
  - sacramento
  - exact-site
  - stack-fit
---

# Sacramento Hosted Review Technical Eval Plan

## Summary

Sacramento's current buyer motion can support a truthful hosted-review evaluation conversation, but not a buyer-ready claim that the proof path is fully closed.

The evaluation posture should stay narrow:

- use the existing Sacramento exact-site hosted-review story
- keep the proof-pack and hosted-review boundary explicit
- route any stack-fit, rights, or delivery uncertainty into named follow-up instead of implying readiness

## Current State

- The Sacramento city launch system already defines the city as founder-approved and activation-ready, with the exact-site hosted-review wedge as the launch thesis.
- The Sacramento outbound packet already has draft-only operator intro copy for McClellan Park and US Cold Storage, so the access-path conversation has a concrete starting point.
- The hosted-review handoff checklist already defines the truth checks Ops must make before sending review materials.
- The Sacramento proof-pack dossier says the current proof motion is still blocked on a rights-cleared proof asset.
- The Sacramento launch scorecard still reports 0 proof-pack deliveries, 0 hosted reviews started, and 0 hosted-review follow-ups sent in the live path.
- The current supported path is therefore an evaluation path, not a proof-complete or buyer-ready delivery claim.

## Supported Path Using Existing Product And Artifacts

Use the current repository truth instead of inventing a new buyer flow:

- `docs/city-launch-system-sacramento-ca.md` for the city posture, operating rules, and thresholds
- `ops/paperclip/playbooks/city-capture-target-ledger-sacramento-ca.md` for the current Sacramento proof targets and lawful-access buckets
- `ops/paperclip/playbooks/city-launch-sacramento-ca-outbound-package.md` for the draft-only operator intro packet
- `ops/paperclip/playbooks/hosted-review-artifact-handoff-checklist.md` for the exact-site versus adjacent-site handoff rules
- `ops/paperclip/playbooks/city-buyer-handoff-escalation-rubric-sacramento.md` for normal buyer follow-up versus escalation boundaries
- `knowledge/compiled/buyer-dossiers/sacramento-proof-pack-rights-clearance.md` for the current rights posture on each Sacramento proof candidate
- `knowledge/reports/analytics/2026-04-17-sacramento-launch-scorecard.md` for the live blocker view

## Explicit Evaluation Checklist

1. Confirm the buyer is asking for an exact-site hosted review, not a generic demo or benchmark.
2. Confirm which Sacramento site or site class is in scope and whether the label is exact-site or adjacent-site.
3. Confirm the buyer-facing review path exists in the current request state before offering a review link.
4. Confirm the proof asset is rights-cleared before calling it buyer-ready.
5. Confirm the hosted-review handoff explains what the buyer can inspect now, what is missing, and what is still human-gated.
6. Confirm the buyer stack question is explicit before implying fit.
7. Confirm whether the buyer expects a normal hosted evaluation, a proof-pack follow-up, or a custom delivery constraint.

## Buyer Stack Fit Checks

The current Sacramento scorecard already flags two important fit gaps:

- explicit evidence that the exact-site artifact is compatible with NVIDIA Omniverse and iWAREHOUSE is still missing
- explicit evidence that air-gapped delivery is not required for the buyer segment is still missing

If a buyer raises a different stack requirement, use the same rule: ask for the concrete integration or delivery expectation, then verify it against live product and artifact truth before promising anything.

## Unsupported Or Blocked Asks

- Claiming a buyer-ready proof pack exists when the live path still shows 0 proof-pack deliveries
- Claiming hosted-review readiness when no hosted review has been started in the live path
- Claiming exact-site coverage without rights-cleared evidence
- Claiming stack fit for Omniverse, iWAREHOUSE, or air-gapped delivery without explicit artifact-backed proof
- Promising custom exports, permissions, deployment guarantees, or commercialization terms that are not already explicit in repo truth

## Owner And Next Step For Each Blocker

| Blocker | Owner | Next step |
| --- | --- | --- |
| Rights-cleared Sacramento proof asset is missing | `rights-provenance-agent` | Clear or block the candidate asset with evidence so the buyer thread can stay truthful. |
| Hosted review has not started in the live path | `buyer-solutions-agent` plus `outbound-sales-agent` | Keep the motion in proof-pack / scoping mode until a real hosted review is stamped. |
| Proof-pack delivery stamp is missing | `analytics-agent` | Preserve the blocker view until the live stamp exists. |
| Buyer stack-fit evidence for Omniverse and iWAREHOUSE is missing | `buyer-solutions-agent` | Collect an explicit compatibility statement before any fit claim. |
| Air-gapped delivery expectation is unresolved | `buyer-solutions-agent` plus `rights-provenance-agent` | Route the delivery constraint into a named follow-up instead of implying support. |

## What To Say In The Buyer Thread

Use this shape when the buyer asks for technical evaluation guidance:

- we can scope an exact-site hosted review path now
- the current Sacramento proof motion is still blocked on rights-cleared proof and live hosted-review stamps
- the buyer can inspect the current proof path, but we should not overstate readiness
- stack-fit questions need to be checked against the actual buyer requirement before we call them supported

## Open Questions

- Which exact Sacramento site does the buyer want first in the hosted-review path?
- Does the buyer need Omniverse, iWAREHOUSE, or another explicit integration target?
- Does the buyer require air-gapped delivery, or is that just a concern to verify?
- Which follow-up owner should own the next technical response if the buyer raises a custom delivery request?

## Authority Boundary

This page is a derived Hermes KB artifact. It does not replace Paperclip issue state, approvals, rights/privacy judgment, pricing/legal commitments, capture provenance, or package/runtime truth.
