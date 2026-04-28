---
authority: derived
source_system: paperclip
source_urls:
  - "paperclip://issue/7e66aca5-7e1b-4124-91d3-4e56a21dabfb"
  - "knowledge/compiled/buyer-dossiers/brain-corp-san-diego-proof-pack.md"
  - "ops/paperclip/playbooks/city-launch-san-diego-ca-outbound-package.md"
  - "knowledge/compiled/playbooks/technical-buyer-evaluation-path.md"
last_verified_at: "2026-04-27"
owner: solutions-engineering-agent
sensitivity: internal
confidence: 0.84
subject_key: brain-corp-hosted-review-technical-eval-plan
freshness_sla_days: 7
review_status: active
canonical_refs:
  - system: paperclip
    ref: "issue://7e66aca5-7e1b-4124-91d3-4e56a21dabfb"
  - system: report
    ref: "knowledge/compiled/buyer-dossiers/brain-corp-san-diego-proof-pack.md"
  - system: playbook
    ref: "knowledge/compiled/playbooks/technical-buyer-evaluation-path.md"
entity_tags:
  - buyer-enablement
  - hosted-review
  - brain-corp
  - san-diego
  - exact-site
  - stack-fit
---

# Brain Corp Hosted Review Technical Eval Plan

## Summary

Brain Corp has a clear exact-site technical buyer path, but the current repository truth is still blocked on live hosted-review evidence.

The repo supports a narrow evaluation conversation:

- one exact site
- one warehouse or retail autonomy workflow lane
- one hosted-review path
- one stack-fit question at a time

It does not yet support a buyer-ready claim that the hosted review has actually completed, because the canonical issue still has no attached live work product or proof asset.

## Current State

- The reusable Brain Corp dossier says the live issue has no attached work product or proof asset.
- The San Diego outbound packet is draft-only and explicitly says it is not a live send.
- The generic technical-buyer path already defines the supported motion as `real site -> site package -> hosted evaluation -> exports`.
- The current blocker issue is `BLU-4737`, with parent issue `BLU-3025`, and both remain blocked until live evidence is attached or the canonical state is reconciled.

## Supported Path Using Existing Artifacts

Use the current repo artifacts, not a new sales narrative:

- `knowledge/compiled/buyer-dossiers/brain-corp-san-diego-proof-pack.md` for the buyer-thread prep and current blocker statement
- `ops/paperclip/playbooks/city-launch-san-diego-ca-outbound-package.md` for the draft-only first-send framing
- `knowledge/compiled/playbooks/technical-buyer-evaluation-path.md` for the reusable evaluation structure
- `ops/paperclip/programs/proof-path-ownership-contract.md` for ownership boundaries

## Explicit Evaluation Checklist

1. Confirm the buyer is asking about one exact site, not a generic robotics demo.
2. Confirm the workflow lane is warehouse autonomy, retail autonomy, or a clearly named adjacent lane.
3. Confirm whether the buyer wants hosted evaluation, a site package, or both.
4. Confirm whether the stack-fit question is ROS 2 / Gazebo, BrainOS, or another concrete runtime target.
5. Confirm the rights and coverage boundaries before promising any export or sharing behavior.
6. Confirm whether the buyer needs reruns, comparison, or a one-time proof pass.
7. Confirm what artifact the buyer actually wants to inspect next.

## Supported Buyer Questions

- What exact site are we evaluating first?
- What does the current site package or hosted session actually contain?
- What export types are available from the hosted path?
- Does the site model fit ROS 2 / Gazebo-style evaluation?
- What rights or privacy limits apply to the artifact?

## Unsupported Or Blocked Asks

- Claiming the Brain Corp hosted review has completed when no live proof asset is attached
- Claiming the proof pack is buyer-ready when the canonical issue is still blocked
- Claiming deployment guarantees, air-gapped handling, or unrestricted exports without a rights review
- Claiming a broader commercial commitment than the current proof evidence supports

## Owner And Next Step For Each Blocker

| Blocker | Owner | Next step |
| --- | --- | --- |
| Live hosted-review evidence is missing | `buyer-solutions-agent` plus the designated human commercial owner | Attach the real proof asset or reconcile the canonical issue state before telling the buyer the review is complete. |
| Exact-site capture/proof asset is missing | `ops-lead` | Provide the missing proof asset or capture request with explicit coverage boundaries. |
| Rights, privacy, or export scope is unclear | `rights-provenance-agent` | Clear or block the release path before any buyer-facing export claim. |
| Buyer stack-fit evidence is still thin | `buyer-solutions-agent` | Collect the concrete compatibility statement before promising fit. |

## What To Say In The Buyer Thread

- We can scope an exact-site Brain Corp evaluation path now.
- The current repo evidence is still blocked on a live hosted-review artifact.
- The buyer can inspect the draft packet and derived dossier, but we should not describe the review as completed.
- Stack-fit questions should be checked against the concrete runtime target before any support claim is made.

## Open Questions

- Is there a live hosted-review artifact that can be attached to the canonical issue?
- Should Brain Corp stay in draft-only scoping mode until that evidence exists?
- Which exact integration target matters most for the next buyer response?

## Authority Boundary

This page is a derived Hermes KB artifact. It does not replace Paperclip issue state, approvals, rights/privacy review, pricing/legal commitments, capture provenance, or package/runtime truth.
