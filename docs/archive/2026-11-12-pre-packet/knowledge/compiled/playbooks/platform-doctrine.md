---
authority: derived
source_system: repo
source_urls:
  - 'repo:///PLATFORM_CONTEXT.md'
last_verified_at: "2026-07-29"
owner: blueprint-ops-lead
sensitivity: internal
confidence: 0.95
source_hashes:
  PLATFORM_CONTEXT.md: "c82fa8af8c5de1751ff20bced116eef9db6fb29d"
---

# Platform Doctrine — Core System Framing

## Summary

This page mirrors `PLATFORM_CONTEXT.md`, the shared platform doctrine document that defines Blueprint's four-system architecture, product center of gravity, market structure, truth hierarchy, product stack, default lifecycle, and practical rules for agents. It is the single source of framing truth that all agents across all Blueprint repos must align with.

## Evidence

### Four-System Architecture

1. **BlueprintCapture** — Capture client and supply-side evidence collection tool.
2. **BlueprintCapturePipeline** — Turns capture bundles into site-specific world-model packages, hosted-session artifacts, and optional trust/review outputs.
3. **Blueprint-WebApp** — Buyer, licensing, ops, and hosted-access surface around those packages.
4. **BlueprintValidation** — Optional downstream infrastructure for deeper benchmarking, robot evaluation, and specialized runtime checks.

The platform is capture-first and real-site-task decision first. The one customer-facing product is a Task Evaluation Run. World models are internal compatibility, generation, augmentation, or advisory evidence methods inside runs.

### Product Center of Gravity

The center of gravity is:
- Broad real-world capture coverage
- Strong capture quality and provenance
- Maintained Site-Task Testbeds behind decision-oriented runs
- Rights, privacy, and commercialization controls
- Buyer-facing surfaces that make requests, decisions, abstentions, evidence limits, and provenance easy to inspect

The center of gravity is NOT:
- Generic marketplace browsing as the main story
- Qualification/readiness as the main thing Blueprint sells
- One-off model demos disconnected from real capture
- A single permanent world-model backend

### Market Structure

The core business engine is two-sided:
- **Capturers** supply real-site evidence packages.
- **Robot teams and site operators** use the same scoped Task Evaluation Run; candidates are optional at intake and evidence methods are selected by Pipeline.

**Site operators** remain an optional third lane for access control, rights/consent/privacy boundaries, and commercialization/revenue sharing.

The platform must support lawful capture and packaging even when a site has not already gone through a pre-negotiated intake flow. Site-operator involvement is a supported workflow branch, not a universal prerequisite.

### Truth Hierarchy

1. Raw capture, timestamps, poses, device metadata, and provenance — authoritative
2. Rights/privacy/consent metadata — authoritative
3. Derived geometry, simulation, generated, provider, and runtime evidence — replaceable, explicitly classified support inside a run
4. Pipeline-owned Decision Envelopes and authoritative Physical Outcome Joins — claim-scoped result evidence
5. Downstream outputs must not rewrite capture truth or provenance truth

### Product Stack (Priority Order)

1. Primary: capture supply and real-site coverage
2. Second: maintained Site-Task Testbeds
3. Third: one Task Evaluation Run with qualified evidence routing and a decision or abstention
4. Fourth: eligible evidence uses and physical learning joins inside the run lifecycle

### Default Lifecycle

1. Capture is sourced proactively or through a buyer/site/ops request
2. BlueprintCapture records and uploads a truthful evidence bundle
3. BlueprintCapturePipeline maintains the testbed, qualifies evidence methods, routes claims, and emits normalized evidence and a Decision Envelope
4. Blueprint-WebApp securely projects the request state, decision or abstention, evidence envelope, artifacts, and permitted uses
5. Authoritative physical outcomes join exact identifiers and update the maintained learning loop when required

### Practical Rule for Agents

When changing any Blueprint repo, optimize for:
1. Stronger real-site capture supply
2. Better site-specific world-model outputs and hosted access
3. Stable rights/privacy/provenance contracts
4. Buyer and ops surfaces that make those outputs easy to sell and use
5. Optional trust/readiness layers that support the product without becoming the product story

Key prohibitions:
- Do not assume every capture must begin with formal site qualification
- Do not treat qualification/readiness as the universal center of the company
- Do not overstate world-model quality beyond what capture, privacy, and runtime artifacts support

## Implications For Blueprint

- All agent decisions across all repos must align with the capture-first, real-site evaluation and policy-improvement doctrine
- Qualification and readiness are support layers, not the product story
- No agent should invent fake supply, fake providers, or fake readiness states in production paths
- Product language around hosted sessions, captures, rights, and provenance must remain truthful

## Open Questions

- Should this playbook include explicit cross-references to how other repos (BlueprintCapture, BlueprintCapturePipeline) implement these principles?
- Should agent compliance with platform doctrine be auditable via Paperclip labels?

## Authority Boundary

This page is a derived Hermes KB artifact mirroring `PLATFORM_CONTEXT.md` from the Blueprint-WebApp repo. It is NOT authoritative for work state, approvals, rights/privacy decisions, pricing/legal commitments, capture provenance, or package/runtime truth. The source file `PLATFORM_CONTEXT.md` prevails in any discrepancy. For work state and approvals, check Paperclip; for workspace context, check Notion.
