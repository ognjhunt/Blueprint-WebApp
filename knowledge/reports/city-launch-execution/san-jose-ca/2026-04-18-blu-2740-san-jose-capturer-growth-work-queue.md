---
authority: draft
source_system: paperclip
source_urls:
  - "paperclip://issue/0d57f8d2-74dc-4ad8-b051-4f63ef65a116"
  - "repo:///ops/paperclip/playbooks/capturer-supply-playbook.md"
  - "repo:///ops/paperclip/playbooks/city-opening-san-jose-ca-first-wave-pack.md"
  - "repo:///ops/paperclip/playbooks/city-opening-san-jose-ca-cta-routing.md"
last_verified_at: 2026-04-18
owner: capturer-growth-agent
sensitivity: internal
confidence: 0.84
subject_key: blu-2740-san-jose-capturer-growth-work-queue
review_status: active
entity_tags:
  - work-queue
  - san-jose
  - capturer-growth
  - draft-package
  - human-gate
---

# BLU-2740 San Jose Capturer Growth Work Queue

## Summary

This breadcrumb captures the current San Jose prospect-list and post-package state. The reusable playbook now has a San Jose bridge, and the city-opening pack already splits direct awareness from bounded public-commercial placements; the remaining work is human review plus the first real intake signal.

## Evidence

- The bound Paperclip issue is `BLU-2740`.
- The reusable capturer supply playbook now names the San Jose first-wave prospect wave and keeps the draft pack draft-only.
- The San Jose city-opening pack already exists as a draft artifact, and the CTA routing doc already defines the canonical intake path.
- No live approved capturer or response signal is recorded yet, so the finish condition is still open.

## Current Queue State

- issue: `BLU-2740`
- city: San Jose, CA
- execution_state: draft_prepared
- work_queue_state: awaiting_human_review
- next_human_gate: Growth Lead review of the first live send or post
- next_owner: `intake-agent` for qualification routing, `analytics-agent` for source attribution, `city-launch-agent` for city reuse

## Recommended Follow-up

- Keep the San Jose first-wave pack draft-only until a human approves the first live send or post.
- Keep every reply tagged by city, lane, source channel or class, and next owner.
- Route warehouse / facility replies into the operator/buyer path and public-commercial replies into qualification.
- Reuse the same channel map and CTA path in future city launches instead of rebuilding the same draft package from scratch.

## Linked KB Pages

- [Blueprint Capturer Supply Playbook](/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/playbooks/capturer-supply-playbook.md)
- [San Jose City-Opening First-Wave Pack](/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/playbooks/city-opening-san-jose-ca-first-wave-pack.md)
- [San Jose CTA Routing](/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/playbooks/city-opening-san-jose-ca-cta-routing.md)
- [BLU-2740 Status Note](/Users/nijelhunt_1/workspace/Blueprint-WebApp/issue-updates/BLU-2740-status.md)

## Authority Boundary

This breadcrumb is a derivative work product. It does not replace Paperclip work state, approvals, rights/privacy review, pricing/legal commitments, or live capture/posting truth.
