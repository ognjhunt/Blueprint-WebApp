---
authority: draft
source_system: paperclip
source_urls:
  - "paperclip://issue/326e8fe1-d8a6-4912-8944-204786625e58"
  - "repo:///ops/paperclip/playbooks/capturer-supply-playbook.md"
  - "repo:///ops/paperclip/playbooks/city-launch-san-diego-ca.md"
  - "repo:///ops/paperclip/playbooks/city-launch-san-diego-ca-execution-issue-bundle.md"
  - "repo:///ops/paperclip/playbooks/city-launch-san-diego-ca-professional-first-wave-pack.md"
  - "repo:///ops/paperclip/playbooks/city-launch-san-diego-ca-outbound-package.md"
last_verified_at: 2026-04-20
owner: capturer-growth-agent
sensitivity: internal
confidence: 0.84
subject_key: blu-2788-san-diego-capturer-growth-work-queue
review_status: active
entity_tags:
  - work-queue
  - san-diego
  - capturer-growth
  - professional-first-wave
  - human-gate
---

# BLU-2788 San Diego Capturer Growth Work Queue

## Summary

This breadcrumb records the current San Diego professional capturer prospect state for `BLU-2788`. The reusable playbook, execution bundle, and draft outbound packet are aligned, but the lane remains draft-only until Growth Lead review clears any live send or post.

## Evidence

- The bound Paperclip issue is `BLU-2788`.
- The reusable capturer playbook names the San Diego professional first-wave pack and keeps it draft-only until human review clears a live send.
- The San Diego launch plan keeps the first active capturer cohort hard-capped at 10 vetted surveying, AEC, industrial inspection, or commercial mapping operators.
- The San Diego outbound packet is draft-only and does not authorize any live buyer-facing send.
- No live approved capturer signal is recorded yet, so the finish condition is still open.

## Current Queue State

- issue: `BLU-2788`
- city: San Diego, CA
- execution_state: draft_prepared
- work_queue_state: awaiting_human_review
- next_human_gate: Growth Lead review of the professional first-wave pack before any live send
- next_owner: `intake-agent` for any qualified reply
- rights_check_owner: `ops-lead`
- first_capture_prep_owner: `field-ops-agent`
- measurement_owner: `analytics-agent`

## Recommended Follow-up

- Keep the San Diego professional first-wave pack draft-only until a human approves the first live send or post.
- Route any qualified reply through intake, then keep rights and first-capture prep with the existing operator lanes.
- Keep analytics aligned on approval owner, approval timestamp, and `first_approved_capturer`.
- Do not widen the cohort beyond the 10-person cap until proof-ready sites and the first approved capturer are visible.

## Linked KB Pages

- [Blueprint Capturer Supply Playbook](/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/playbooks/capturer-supply-playbook.md)
- [San Diego City Launch Plan](/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/playbooks/city-launch-san-diego-ca.md)
- [San Diego City Launch Execution Bundle](/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/playbooks/city-launch-san-diego-ca-execution-issue-bundle.md)
- [San Diego Professional First-Wave Pack](/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/playbooks/city-launch-san-diego-ca-professional-first-wave-pack.md)
- [San Diego Operator Intro Packet](/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/playbooks/city-launch-san-diego-ca-outbound-package.md)
- [BLU-2788 Status Note](/Users/nijelhunt_1/workspace/Blueprint-WebApp/issue-updates/BLU-2788-status.md)

## Authority Boundary

This breadcrumb is a derivative work product. It does not replace Paperclip work state, approvals, rights/privacy review, pricing/legal commitments, or live capture/posting truth.
