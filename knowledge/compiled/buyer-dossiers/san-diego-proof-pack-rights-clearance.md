---
authority: derived
source_system: paperclip
source_urls:
  - "paperclip://issue/0f41d264-d4f8-4262-8aea-5c6542c25c58"
  - "paperclip://issue/1a7e74b6-752c-483c-b680-ecd74b3aff8f"
  - "knowledge/reports/demand-intel/2026-04-13-san-diego-robot-team-target-accounts.md"
  - "ops/paperclip/reports/city-launch-execution/san-diego-ca/2026-04-13T15-20-38.086Z/city-launch-issue-bundle-san-diego-ca.md"
last_verified_at: "2026-04-20"
owner: demand-intel-agent
sensitivity: internal
confidence: 0.7
subject_key: san-diego-proof-pack-rights-clearance
freshness_sla_days: 7
review_status: active
canonical_refs:
  - system: paperclip
    ref: "issue://da5e02b4-15ac-4ab4-9a46-ca6c34dd3ba7"
  - system: report
    ref: "knowledge/reports/demand-intel/2026-04-13-san-diego-robot-team-target-accounts.md"
entity_tags:
  - buyer-dossier
  - san-diego
  - rights-clearance
  - proof-pack
  - operator-lane
---

# San Diego Proof Pack Rights Clearance

## Summary

San Diego only works as a demand wedge when the proof-path remains explicit. Blueprint should treat exact-site, adjacent-site, and operator-lane accounts differently and avoid collapsing site rights, mission sensitivity, and buyer fit into one generic robotics story.

## Current Status

- As of 2026-04-20, no rights-cleared San Diego proof asset or proof-ready listing is evidenced in the live buyer thread.
- The active Paperclip issue is `BLU-3261` and it is still blocked on missing activation payload proof truth plus unsupported proof-path values, so buyer-visible readiness would outrun evidence.
- The buyer-solutions lane is still pre-proof and should not claim hosted review readiness yet.
- The current exact-site anchors remain Brain Corp and Biosero; defense and export-sensitive accounts remain operator-lane only until the rights chain is explicit.

## Clearance Rules

- Use exact-site proof when the buyer can reasonably evaluate a real warehouse, hangar, lab, depot, marine facility, or integration cell.
- Use adjacent-site proof when the workflow is plausible but the physical site cannot be cleared quickly or truthfully.
- Use operator-lane handling when access, mission sensitivity, export controls, or defense constraints make the buyer path depend on named introductions and tighter rights framing.

## Evidence

- Brain Corp, Shield AI, and GA-ASI are the clearest San Diego anchors for exact-site proof motions because their public language already maps to operational workflows.
- UC San Diego Contextual Robotics Institute and San Diego Tech Hub are useful for introductions and legitimacy, but they do not replace proof-pack rights clearance.
- Defense autonomy, marine robotics, and systems-integration buyers should be assumed sensitive until a site and rights chain is explicitly clear.
- Exact-site proof matters more than office-address proximity.

## Practical Guidance

- Keep proof-pack language tied to a specific site type and workflow.
- Preserve provenance, replay, and exportability in the proof package.
- Do not imply access, commercialization rights, or procurement readiness that have not been cleared.
- Keep site-operator conversations separate from buyer conversations unless the access path itself is the product of the handoff.

## Recommended Follow-up

- Use this dossier as the rights boundary reference for the San Diego target-account page.
- Route operator-lane targets to the handoff that can preserve access and rights truth.
- Keep the proof-pack review motion explicit before any outbound is drafted.
- Request or wait for a CLEARED San Diego proof asset before drafting a buyer-facing proof summary or hosted-review handoff.
- Keep `BLU-3261` blocked until the activation payload, proof-path shape, and rights-cleared proof asset all exist together in repo truth.

## Linked KB Pages

- [San Diego robot-team target accounts](../demand-intel/san-diego-robot-team-target-accounts.md)
- [San Diego robot-team target accounts and buyer clusters](../../reports/demand-intel/2026-04-13-san-diego-robot-team-target-accounts.md)

## Authority Boundary

This page is a derived Hermes KB artifact. It does not replace Paperclip work state, approvals, rights/privacy review, pricing/legal commitments, capture provenance, or package/runtime truth.
