---
authority: derived
source_system: web
source_urls:
  - "https://docs.worldlabs.ai/marble/release-notes"
  - "https://docs.worldlabs.ai/"
  - "https://docs.worldlabs.ai/marble/models"
  - "https://docs.worldlabs.ai/api/models"
  - "https://learn.poly.cam/hc/en-us/articles/43933482446996-How-to-Use-Space-Mode-Non-LiDAR-Devices"
  - "https://learn.poly.cam/hc/en-us/articles/48338504343188-How-to-Capture-As-Built-Drawings"
  - "https://learn.poly.cam/hc/en-us/articles/35145054767124-How-to-Generate-a-Spatial-Report"
  - "https://nvidianews.nvidia.com/news/nvidia-and-global-robotics-leaders-take-physical-ai-to-the-real-world"
  - "https://nvidianews.nvidia.com/news/nvidia-announces-open-physical-ai-data-factory-blueprint-to-accelerate-robotics-vision-ai-agents-and-autonomous-vehicle-development"
  - "https://arxiv.org/abs/2604.02851"
  - "https://digital-strategy.ec.europa.eu/en/consultations/targeted-consultation-measuring-energy-consumption-and-emissions-ai-models-and-systems"
last_verified_at: 2026-04-25
owner: market-intel-agent
sensitivity: internal
confidence: 0.81
---

# Market Intel Daily Digest - 2026-04-25

## Summary

Blueprint's market baseline keeps moving in the same direction, but the surface is getting more explicit. World Labs is tightening product versioning, Polycam is documenting structured deliverables from phone scans, NVIDIA is still packaging physical AI as a full stack, and research is pushing 3D Gaussian scene streaming toward a live runtime primitive. The practical implication is unchanged: Blueprint should stay centered on site specificity, rights-safe packaging, and browser delivery, not generic model ownership.

## Evidence

- [8.7] World Labs release notes now expose Marble 1.1 and Marble 1.1 Plus, while the API docs say the default model will move to `marble-1.1` in a future release (https://docs.worldlabs.ai/marble/release-notes, https://docs.worldlabs.ai/api/models): This is a strong productization signal because it shows the category is maturing into versioned, documented platform behavior rather than one-off launches.
- [8.5] Polycam's help center now documents Spatial Reports and As-Built Drawings alongside Space Mode outputs (https://learn.poly.cam/hc/en-us/articles/35145054767124-How-to-Generate-a-Spatial-Report, https://learn.poly.cam/hc/en-us/articles/48338504343188-How-to-Capture-As-Built-Drawings): This suggests the market now expects structured deliverables from capture workflows, not just raw scans.
- [8.2] NVIDIA's latest physical-AI release keeps pushing Cosmos, Isaac, and named partner adoption together (https://nvidianews.nvidia.com/news/nvidia-and-global-robotics-leaders-take-physical-ai-to-the-real-world): This reinforces the expectation that robotics buyers will be sold a simulation/data/deployment stack, not isolated models.
- [7.8] A current arXiv paper on streaming live 3D Gaussian scenes treats scene transport as a runtime problem instead of a viewer feature (https://arxiv.org/abs/2604.02851): This is a useful backend signal because it lines up with browser-native spatial delivery becoming a category baseline.
- [7.3] The EU AI Act energy-consumption consultation remains open through 15 May 2026 (https://digital-strategy.ec.europa.eu/en/consultations/targeted-consultation-measuring-energy-consumption-and-emissions-ai-models-and-systems): This is still a live documentation pressure point for deployed AI systems, even if the exact enforcement surface is not final yet.

## Notes

- Evidence: World Labs, Polycam, and NVIDIA are all speaking in productized categories, not research-only language.
- Evidence: the 3DGS streaming paper is not a Blueprint competitor, but it is a meaningful backend signal because it lowers the distance between generated worlds and a web-delivered runtime.
- Inference: Blueprint's strongest defense remains site specificity plus rights-safe delivery, but it now also needs a clearer runtime story for how generated worlds are streamed and updated.
- Inference: compliance pressure is still broadening from provenance and traceability into energy and reporting metadata, especially for EU-facing deployments.

## Recommended Follow-up

- Keep the capture onboarding path short and explicit, because commodity-device capture keeps getting easier.
- Track World Labs' model/versioning surface for export and integration expectations that may become standard buyer asks.
- Watch Polycam's structured deliverables for any move toward broader export, reporting, or collaboration features that could raise the capture-floor baseline.
- Treat runtime portability, provenance, consent, traceability, and energy metadata as part of the asset contract, not post-processing paperwork.

## Linked KB Pages

- [Market Intel Tracker](../../compiled/market-intel/market-intel-tracker.md)
- [Raw source note - 2026-04-25](../../raw/web/2026-04-25/market-intel-sources.md)

## Authority Boundary

This report is a derivative work product. It does not replace Paperclip work state, approvals, rights/privacy review, pricing/legal commitments, capture provenance, or package/runtime truth.
