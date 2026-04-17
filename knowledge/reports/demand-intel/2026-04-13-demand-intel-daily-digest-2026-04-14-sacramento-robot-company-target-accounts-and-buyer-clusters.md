---
authority: derived
source_system: web
source_urls:
  - "https://www.sir-robotics.com/"
  - "https://business.ca.gov/sir-robotics/"
  - "https://www.vcautomation.com/"
  - "https://www.cmtc.com/made-in-california-manufacturers/vc-automation"
  - "https://www.cmtc.com/made-in-california-manufacturers/axis-robotics"
  - "https://www.cmtc.com/made-in-california-profile-archived/axis-robotics"
  - "https://www.raymondwest.com/sacramento-ca/material-handling-equipment-supplier/warehouse-automation/invia-robotics"
  - "https://www.raymondwest.com/sacramento-ca/material-handling-equipment-supplier/warehouse-automation/locus-robotics"
  - "https://www.raymondwest.com/sacramento-ca/material-handling-equipment-supplier/warehouse-automation/robotic-palletizers"
  - "https://www.mcclellanpark.com/new-development/mcclellan-logistics-center-i"
  - "https://www.mcclellanpark.com/new-development/mcclellan-logistics-center-ii"
  - "https://ahmct.ucdavis.edu/ahmct-research-center-core-technologies"
  - "https://ahmct.ucdavis.edu/ahmct-facilities"
  - "https://fira-usa.com/"
  - "https://waymo.com/rides"
last_verified_at: "2026-04-17"
owner: demand-intel-agent
sensitivity: internal
confidence: 0.79
subject_key: sacramento-robot-company-target-accounts-and-buyer-clusters
review_status: active
canonical_refs:
  - system: paperclip
    ref: "issue://a30e0a6c-67ad-487c-a159-2973470a3bd1"
  - system: report
    ref: "knowledge/compiled/demand-intel/sacramento-robot-team-targets.md"
entity_tags:
  - robot-team-demand
  - sacramento
  - target-accounts
  - buyer-clusters
  - proof-pack
---

# Sacramento Robot Company Target Accounts and Buyer Clusters

## Summary

Sacramento should stay in a narrow proof-led posture. The strongest current target layer is a small cluster of warehouse automation, robotics integration, and industrial systems buyers, plus a second autonomy-research and ag-robotics validation lane, that can plausibly evaluate exact-site proof packs.

The practical implication is that Blueprint should lead with exact-site proof, replay, and provenance for industrial and warehouse buyers first, then keep the autonomy / ag-robotics lane as validation rather than trying to turn it into the primary buyer story.

## Evidence

- SIR Robotics publicly presents robotics and automation work tied to production-style workflows, and its Sacramento operations make it a local industrial-automation target.
- VC Automation publicly presents turnkey automation, robotics, PLC, machine vision, safety integration, and material-handling work, and its CMTC profile places it in West Sacramento.
- Axis Robotics' public profile and CMTC listing point to Orangevale / Sacramento-region automation, machine vision, design, prototyping, and production/test work for semiconductor and industrial markets.
- Raymond West's Sacramento pages explicitly sell warehouse automation equipment, AMRs, robotic palletizers, and integrated warehouse-automation brands like inVia and Locus.
- McClellan Park publicly markets large logistics and warehouse buildings, including cross-dock and cold-storage-adjacent industrial inventory, which makes it a strong operator and access-path anchor.
- UC Davis AHMCT publicly describes advanced robotics, sensing, localization, robotics labs, and autonomous mowing work, making it a credible regional autonomy-validation surface.
- FIRA USA explicitly centers autonomous farming and agricultural robotics in Woodland | Sacramento and draws growers, robot manufacturers, OEMs, investors, universities, and scientists.
- Waymo lists Sacramento in its city network as an up-next / corridor signal, which keeps local autonomy demand real even though it is not a direct Blueprint buyer.

## Recommended Follow-up

- Route SIR Robotics, VC Automation, Axis Robotics, and Raymond West to `robot-team-growth-agent` as the core Sacramento buyer / channel cluster.
- Keep McClellan Park in an operator and access-path lane for warehouse and logistics proof paths.
- Keep UC Davis AHMCT in a technical evaluation lane and FIRA USA in a corridor-validation lane.
- Use Waymo only as a regional autonomy signal, not as a direct Blueprint buyer.
- Keep exact-site versus adjacent-site labeling explicit before any live follow-up.

## Linked KB Pages

- [Sacramento robot team target accounts](../../compiled/demand-intel/sacramento-robot-team-targets.md)
- [Sacramento robot company target account source notes](../../raw/web/2026-04-14/sacramento-robot-company-target-accounts-source-notes.md)
- [Robot Team Demand Weekly Tracker](../../compiled/demand-intel/robot-team-demand-weekly-tracker.md)

## Buyer Clusters

### 1. Warehouse Automation and Intralogistics

- Raymond West
- McClellan Park logistics operators
- US Cold Storage / adjacent cold-chain and cross-dock operators

Why this cluster matters:
- These buyers care about layout, fleet routing, deployment realism, and facility constraints.
- Blueprint should lead with exact-site warehouse proof packs, replay, provenance, and clear hosted-review next steps.

### 2. Robotics Integration and Industrial Systems

- SIR Robotics
- VC Automation
- Axis Robotics

Why this cluster matters:
- These teams sell automation, integration, machine vision, and safety work into manufacturing or industrial environments.
- Blueprint should lead with exact-site proof, exportable artifacts, and a technical-review posture rather than a broad brand pitch.

### 3. Autonomy Research and Validation

- UC Davis AHMCT
- UC Davis robotics / autonomy labs

Why this cluster matters:
- These teams are closer to evaluation, validation, and technical review than to broad procurement.
- Blueprint should lead with inspectable artifacts, version history, and explicit proof boundaries.

### 4. Ag Robotics and Corridor Validation

- FIRA USA
- Woodland | Sacramento autonomous-farming ecosystem

Why this cluster matters:
- This is an ecosystem and channel-density surface, not a substitute for warehouse buyer demand.
- Blueprint should use it to validate corridor relevance and partnership density.

## Target Account Map

| Target | Cluster | Why it matters | Proof path note | Evidence vs inference |
|---|---|---|---|---|
| Raymond West | Warehouse automation and intralogistics | Material-handling and warehouse automation buyer / channel with local Sacramento relevance | Exact-site warehouse proof pack first | Evidence-backed |
| McClellan Park logistics operators | Warehouse automation and intralogistics | Site-operator lane that can unlock lawful access for the broader warehouse cluster | Site-operator intro or buyer-requested-site path | Evidence-backed |
| US Cold Storage / cold-chain operators | Warehouse automation and intralogistics | Cold-chain and cross-dock workflow buyers need realistic facility proof | Adjacent-site first if cold-zone access is blocked; exact-site if rights clear | Inference |
| SIR Robotics | Robotics integration and industrial systems | Sacramento operations plus manufacturing automation positioning | Exact-site industrial proof pack first | Evidence-backed |
| VC Automation | Robotics integration and industrial systems | West Sacramento integrator with robotics, PLC, machine vision, safety, and material-handling work | Exact-site proof pack plus safety-forward technical review | Evidence-backed |
| Axis Robotics | Robotics integration and industrial systems | Orangevale/Sacramento-region automation, prototyping, and production/test work | Exact-site lab or integration-cell proof pack | Evidence-backed |
| UC Davis AHMCT | Autonomy research and validation | Robotics, localization, and autonomous vehicle / maintenance research anchor | Exact-site lab or test-site proof pack | Evidence-backed |
| FIRA USA | Ag robotics and corridor validation | Regional ecosystem anchor for agricultural robotics and autonomous solutions | Channel anchor, not a buyer proof pack | Evidence-backed |
| Waymo | Autonomy corridor validation | Regional autonomy signal, but not a direct Blueprint buyer | Corridor signal only | Evidence-backed |

## Authority Boundary

This report is a derived work product. It does not replace Paperclip work state, approvals, rights/privacy review, pricing/legal commitments, capture provenance, or package/runtime truth.
