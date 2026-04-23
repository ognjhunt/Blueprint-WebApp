---
authority: derived
source_system: repo
source_urls:
  - "repo:///docs/city-launch-system-durham-nc.md"
  - "repo:///ops/paperclip/reports/city-launch-execution/durham-nc/2026-04-22T21-47-28.818Z/city-launch-issue-bundle-durham-nc.md"
  - "repo:///ops/paperclip/reports/city-launch-execution/durham-nc/2026-04-22T21-47-28.818Z/city-opening-durham-nc-execution-report.md"
  - "repo:///ops/paperclip/reports/city-launch-execution/durham-nc/2026-04-22T21-47-28.818Z/city-opening-durham-nc-send-ledger.md"
  - "repo:///ops/paperclip/reports/city-launch-execution/durham-nc/2026-04-22T21-47-28.818Z/city-opening-durham-nc-response-tracking.md"
  - "repo:///knowledge/compiled/buyer-dossiers/durham-proof-pack-rights-clearance.md"
  - "paperclip://issue/f15af43c-7d6b-45a9-a3a2-0b7d86436ab7"
last_verified_at: 2026-04-22
owner: solutions-engineering-agent
sensitivity: internal
confidence: 0.8
subject_key: durham-launch-system
review_status: active
entity_tags:
  - durham
  - city-launch
  - hosted-review
  - proof-pack
  - outbound
---

# Durham, NC Launch System

## Summary

Durham is activation-ready as a city-launch program, but the buyer-facing proof motion is still blocked on a rights-cleared proof asset. Outbound is already active and honest in repo truth, so the remaining gap is not send capability; it is the missing hosted-review proof pack that a serious buyer can inspect.

## Current State

- The Durham launch system is proof-led, exact-site first, and still bounded to one subscale bay or equivalent narrow interior path.
- The outbound lane is active: 2 direct outreach sends are marked `sent`, 2 are recipient-backed, and 0 responses have routed back yet.
- The city-opening execution report still shows `outbound_readiness_status: warning`, which reflects sender-verification uncertainty rather than a send-stage transport failure.
- The buyer-proof lane still cannot truthfully claim a proof-ready listing or buyer-ready hosted-review pack.
- Live site-side recipient evidence exists for Durham Logistics Center, but that does not clear the proof-pack gate.

## Evidence

- The Durham send ledger records the direct outreach rows as `sent` with approval and recipient state preserved.
- The Durham response-tracking draft keeps unsent outreach, draft copy, and account setup out of the real-response count.
- The Durham buyer dossier still says no rights-cleared proof asset or hosted-review artifact is evidenced in the current bundle.
- The Durham launch system requires at least one clean proof pack with hosted-review path and rights/provenance clearance before the city can be claimed live.

## Implications For Blueprint

- Keep outbound sends and hosted-review packaging as separate gates.
- Do not convert a warning-state outbound check into proof-pack clearance.
- Keep exact-site versus adjacent-site labeling explicit in every buyer-facing summary.
- Route any buyer-visible packaging that outruns evidence back to the rights and human-commercial lanes first.

## Open Questions

- Which rights-cleared Durham asset will become the first proof-ready listing?
- Which buyer-facing hosted-review path is truthful once the proof asset exists?
- Should the sender-verification warning be mirrored into a dedicated ops checklist, or is the current execution report sufficient?

## Canonical Links

- [docs/city-launch-system-durham-nc.md](/Users/nijelhunt_1/workspace/Blueprint-WebApp/docs/city-launch-system-durham-nc.md)
- [Durham proof pack rights clearance](/Users/nijelhunt_1/workspace/Blueprint-WebApp/knowledge/compiled/buyer-dossiers/durham-proof-pack-rights-clearance.md)
- [Durham city-opening execution report](/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/playbooks/city-opening-durham-nc-execution-report.md)
- [Durham send ledger](/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/playbooks/city-opening-durham-nc-send-ledger.md)
- [Durham response tracking](/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/playbooks/city-opening-durham-nc-response-tracking.md)
- [Paperclip issue f15af43c-7d6b-45a9-a3a2-0b7d86436ab7](issue://f15af43c-7d6b-45a9-a3a2-0b7d86436ab7)

## Authority Boundary

This page is a derived Hermes KB artifact. It does not replace Paperclip work state, approvals, rights/privacy review, pricing/legal commitments, capture provenance, or package/runtime truth.
