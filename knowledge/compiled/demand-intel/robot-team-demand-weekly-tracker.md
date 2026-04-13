---
authority: derived
source_system: web
source_urls:
  - "https://www.worldlabs.ai/blog/3d-as-code"
  - "https://www.worldlabs.ai/blog/announcing-the-world-api"
  - "https://www.worldlabs.ai/"
  - "https://docs.worldlabs.ai/api/examples"
  - "https://nvidianews.nvidia.com/news/nvidia-announces-open-physical-ai-data-factory-blueprint-to-accelerate-robotics-vision-ai-agents-and-autonomous-vehicle-development"
  - "https://nvidianews.nvidia.com/news/nvidia-and-global-robotics-leaders-take-physical-ai-to-the-real-world"
  - "https://nvidianews.nvidia.com/news/siemens-and-nvidia-expand-partnership-industrial-ai-operating-system"
  - "https://nvidianews.nvidia.com/news/latest?c=21926"
  - "https://poly.cam/press-release/space-mode-access-expanded-2026"
  - "https://a3.a3automate.org/a3/Events/Search"
last_verified_at: "2026-04-13"
owner: demand-intel-agent
sensitivity: internal
confidence: 0.68
subject_key: robot-team-demand-weekly-tracker
freshness_sla_days: 7
last_signal_at: "2026-04-13"
review_status: active
canonical_refs:
  - system: paperclip
    ref: "issue://06e0041b-8b0d-4b40-b31d-e2e1e928ff5c"
entity_tags:
  - robot-team-demand
  - proof-pack
  - physical-ai
  - world-model
---

# Robot Team Demand Weekly Tracker

## Summary

Current technical-buyer demand is concentrating around developer-first spatial platforms, physical-AI data pipelines, and safety/validation workflows rather than generic "AI interest." The strongest signal is that serious robot-team buyers want structured, inspectable, exportable artifacts that can plug into simulation, robotics, CAD, and industrial software stacks. That points Blueprint toward proof-pack language, hosted-session flows, and provenance clarity that look more like infrastructure and evaluation tooling than marketing demos.

## Current State

- The strongest public demand signals now cluster around platformized physical AI and world-model products, not isolated model demos.
- Buyers are being told to expect programmatic APIs, inspectable 3D outputs, simulation hooks, and reusable artifacts that can be versioned and reused.
- Technical evaluation is increasingly framed around data generation, augmentation, evaluation, safety, and commissioning speed.
- In-person technical communities remain important, especially robotics conferences, safety training, and developer workshops.

## Evidence

- World Labs explicitly frames 3D as the interface for space and says world models should generate, edit, simulate, and share worlds together. Its 3D-as-code essay emphasizes inspectable and versioned artifacts, integration with robotics stacks and simulation systems, and a hybrid runtime where rules matter.
- World Labs' World API is a public developer interface for generating explorable 3D worlds from text, images, panoramas, and video. The docs emphasize raw API usage, sample projects, and downstream rendering/export rather than a closed demo flow.
- World Labs' public site now positions Marble for robotics, simulation, architecture, and health systems, which is a clear signal that buyer interest is being organized around application workflows, not generic awareness.
- NVIDIA's Physical AI Data Factory Blueprint is explicitly about generating, augmenting, and evaluating training data at scale for robotics, vision AI agents, and autonomous vehicles. The release names robotics and industrial adopters, which is evidence that the platform message is landing with technical teams already building physical-AI systems.
- NVIDIA and Siemens describe digital twins turning into active intelligence for the physical world and say customers are evaluating capabilities that reduce commissioning time and risk. That language is closer to procurement and deployment value than to top-of-funnel branding.
- Polycam's non-LiDAR spatial capture release shows the market is lowering capture friction and normalizing walkthrough-based, dimensionally accurate 3D capture on commodity devices.
- A3's 2026 event listings include mobile robot safety training, robot safety and risk assessment training, and the International Robot Safety Conference. That is evidence that safety, validation, and risk language remain high-signal in this buyer ecosystem.

## Signals

- 2026-04-13: The clearest pattern is that robot-team demand is gravitating toward APIs, data pipelines, and simulation-ready artifacts that can be inspected and reused.
- 2026-04-13: Technical buyer language is increasingly about evaluation, determinism, risk reduction, and commissioning speed rather than raw model novelty.
- 2026-04-13: Robotics conferences and safety/risk training remain more credible than broad AI awareness channels for reaching serious deployment-minded buyers.
- 2026-04-13: Capture friction is falling, which likely raises buyer expectations for more precise provenance and more usable spatial outputs.

## Implications For Blueprint

- Blueprint should keep the core demand message anchored on exact-site proof, provenance, and exportable artifacts that fit existing robotics and simulation workflows.
- Hosted-review motions should look like an evaluation environment with inspectable outputs, not a sales presentation with a follow-up promise.
- Channel strategy should prioritize robotics developer ecosystems, simulation-adjacent communities, industrial software ecosystems, and safety/validation forums.
- The strongest proof pack language should make state, replay, export, and provenance obvious.
- Site-operator conversations should stay secondary unless they materially reduce site access friction or increase proof credibility for a specific buyer motion.
- Austin and San Francisco should be treated differently: Austin looks more like an industrial / deployment / safety-and-operations cluster, while San Francisco is more likely to reward developer-platform and world-model narrative work.

## Open Questions

- Which robot-team segments most often require a hosted, inspectable proof session before they will discuss deployment?
- Which channels convert into serious technical follow-up versus mere curiosity: robotics conferences, developer docs, partner ecosystems, or direct outbound?
- Where does the site-operator lane actually change conversion, and where is it just additional complexity?
- How much does proof-pack expectation differ between industrial buyers, humanoid teams, and systems integrators?
- Which city-specific buyer clusters should inherit this week's strongest proof requirements first: Austin or San Francisco?

## Canonical Links

- Paperclip issue: `paperclip://issue/06e0041b-8b0d-4b40-b31d-e2e1e928ff5c`
- Steering file: `ops/paperclip/programs/demand-intel-agent-program.md`
- Agent instructions: `ops/paperclip/skills/demand-intel-agent.md`
- Related downstream lanes: `robot-team-growth-agent`, `site-operator-partnership-agent`, `city-demand-agent`

## Authority Boundary

This page is a derived Hermes KB artifact. It does not replace Paperclip work state, approvals, rights/privacy review, pricing/legal commitments, capture provenance, or package/runtime truth. If any of those areas matter, the canonical system wins over this page.
