---
authority: derived
source_system: repo
source_urls:
  - 'repo:///WORLD_MODEL_STRATEGY_CONTEXT.md'
last_verified_at: "2026-04-04"
owner: blueprint-ops-lead
sensitivity: internal
confidence: 0.95
source_hashes:
  WORLD_MODEL_STRATEGY_CONTEXT.md: "924e7ed32f1796"
---

# World Model Strategy — Core System Framing

## Summary

This page mirrors `WORLD_MODEL_STRATEGY_CONTEXT.md`, which defines Blueprint's strategic doctrine around world models — what must stay stable vs swappable, data priorities, build priorities, and how the platform establishes a durable moat beyond any single model provider.

## Evidence

### Why World Models Are Not the Center of Gravity

- World models will improve rapidly; Blueprint should NOT build around one permanent model.
- Model backends change monthly or faster. Building a business around one is fragile.
- The durable moat is: capture supply, rights-safe pipelines, site-specific packages, buyer surfaces, and the capture → package → usage flywheel.

### What Must Stay Stable Across Model Swaps

- Capture bundle structure
- Timestamps, poses, intrinsics, depth information, metadata
- Consent, rights, and privacy handling
- Package manifests
- Hosted-session contracts
- Buyer attachment, licensing, and sync contracts
- Truth labeling (what is measured vs inferred/simulated)

### What Is Swappable

- World-model checkpoints
- Model providers and runtime environments
- Inference services
- Retrieval-conditioned generation strategies
- Refinement models
- Training and export adapters

### Data to Preserve (Long-Term Value)

- Walkthrough video
- Motion and trajectory logs
- Camera poses and intrinsics
- Depth data
- Timestamps
- Device and modality metadata
- Site/scenario/deployment context
- Privacy/consent/rights metadata
- Retrieval and reference relationships

### Build Priorities (In Order)

1. Capture quality and coverage
2. Packaging into site-specific world models
3. Hosted access and buyer usability
4. Rights/privacy/provenance rigor
5. Stable contracts that survive backend swaps
6. Optional trust/readiness outputs

### Decision Rule

Prefer reusable capture/packaging/product infrastructure over model-specific hacks — UNLESS the hack materially improves near-term user-visible value WITHOUT increasing long-term coupling.

### What Makes Blueprint Valuable

- Real-site coverage with strong capture provenance
- Rights-clean site-specific world-model packages
- Buyer-facing surfaces that tie to licensed, hosted access
- A platform that survives and benefits from model improvements as the models get better, not worse

### What Should NOT Happen

- No single model provider should become the center of the business
- No model-specific hacks should compromise stable packaging or contract surfaces
- No simulation or generated output should be presented as ground truth
- Downstream qualification or review outputs should not be sold as the primary product

## Implications For Blueprint

- All technical architecture should assume model interchangeability as a core requirement
- Investment should prioritize capture infrastructure, packaging contracts, and buyer surfaces over model-specific optimization
- Data preservation choices should be made with the assumption that future models will want to retrain on historical capture data
- Product messaging should emphasize the capture→package→hosted-access loop, not any particular model capability
- Any agent building model-integration code must use swappable adapter patterns, not hard-coded provider dependencies

## Open Questions

- Should the world model strategy doc include explicit adapter interface contracts for model swap compatibility?
- How should Blueprint track which model versions have been used for specific site packages (for provenance and reproducibility)?
- Should there be a canonical "model registry" tracking available providers, capabilities, and swap costs?

## Authority Boundary

This page is a derived Hermes KB artifact mirroring `WORLD_MODEL_STRATEGY_CONTEXT.md` from the Blueprint-WebApp repo. It is NOT authoritative for work state, approvals, rights/privacy decisions, pricing/legal commitments, capture provenance, or package/runtime truth. The source file `WORLD_MODEL_STRATEGY_CONTEXT.md` prevails in any discrepancy. For work state and approvals, check Paperclip; for workspace context, check Notion.
