# Sacramento, CA Final Launch Playbook

- interaction_id: v1_ChdXeTNkYWVHb0s2bXBxdHNQa0tPUHlRcxIXZlM3ZGFZX0FNT2ZOcXRzUGdicTJxUTA
- status: completed

## Prompt

```text
You are Blueprint's launch playbook synthesizer.
Turn the accumulated research and critique outputs into a single operator-ready Blueprint city proof-motion playbook for Sacramento, CA.

The playbook must be usable by both humans and agents.
It must be more specific and more operational than a strategy memo, safe to delegate against after normal human review, compact enough to route from, and expansive enough to support city activation.

Required sections:
- Executive summary
- Truth constraints
- City proof-motion thesis
- Why this city now for Blueprint
- Narrow wedge definition
- Analog sanity check
- What analogous companies teach us and what they do not
- What Blueprint should copy, adapt, reject
- Evidence-backed claims
- Inferred claims
- Hypotheses needing validation
- Lawful capture supply acquisition system
- Rights / provenance / privacy clearance system
- Proof-asset system
- Buyer proof-path routing system
- Hosted-review conversion system
- Human vs agent operating model
- Instrumentation spec
- Budget policy and approval thresholds
- Daily / weekly operating cadence
- Site-operator acquisition and rights path
- What Must Be Validated Before Live Outreach
- 12-week execution schedule
- Go / hold / no-go gates for activation and widening
- Checklists
- Sample prompts for agents
- Open research gaps
- Machine-readable activation payload
- Structured launch data appendix

Formatting rules:
- output Markdown only
- include a "Truth constraints" section near the top
- include a "What not to say publicly yet" section
- include tables and numbered steps where useful
- preserve uncertainty labels
- organize the document as a Blueprint city proof-motion launcher, not a generic marketplace launch plan
- keep analogous companies as a secondary sanity-check section only, not the main narrative frame
- do not introduce city-specific analytics event names; use only approved repo analytics vocabulary with a city/source tag
- make the lawful access decision explicit before any private indoor capture motion
- if the city includes defense, aerospace, or other export-controlled buyers, add an explicit constraint section covering hosted-review limits and air-gapped review needs
- do not scale beyond a small vetted capturer cohort until the first proof assets and hosted reviews are real
- do not ask for generic liquidity metrics, broad supply-demand balance language, or first 100/250 capturer scale milestones
- use proof-motion milestones instead: first lawful site-operator access paths, first approved capturers with trust clearance, first completed captures, first QA-passed captures, first rights-cleared proof assets, first proof-pack deliveries, first hosted-review-ready assets, first hosted-review starts, and first human commercial handoffs
- explicitly label buyer stack, integration, delivery, security, partner, and compliance assumptions as "verify before outreach" unless directly supported
- do not use manipulative, exclusivity, fake urgency, or posture-changing language
- do not claim "no custom telemetry" while introducing new event names; distinguish current repo events, approved missing proof-motion events, and `inboundRequests.ops.proof_path` milestones explicitly
- align the result with the current city-launch execution docs and activation program, and distinguish activation gates vs widening gates vs outreach gates
- include a fenced ```city-launch-activation-payload block that acts as the control-plane artifact for activation, issue routing, approvals, and metrics blockers
- end the document with a fenced JSON block using ```city-launch-records
- the JSON block must parse cleanly and use schema_version "2026-04-12.city-launch-research.v1"
- only include entries supported by the research; if a field is inferred, list it under inferred_fields instead of presenting it as ground truth
- activation payload schema_version must be "2026-04-13.city-launch-activation-payload.v1"
- activation payload machine_policy_version must be "2026-04-13.city-launch-doctrine.v1"
- activation payload lawful_access_modes must use only: `buyer_requested_site`, `site_operator_intro`, `capturer_existing_lawful_access`, `public_non_controlled_site`
- activation payload owner_lanes must use only: `growth-lead`, `ops-lead`, `city-launch-agent`, `city-demand-agent`, `capturer-growth-agent`, `intake-agent`, `capturer-success-agent`, `field-ops-agent`, `capture-qa-agent`, `rights-provenance-agent`, `demand-intel-agent`, `robot-team-growth-agent`, `outbound-sales-agent`, `buyer-solutions-agent`, `revenue-ops-pricing-agent`, `analytics-agent`, `notion-manager-agent`, `beta-launch-commander`
- activation payload required_approvals lanes must use only: `founder`, `growth-lead`, `ops-lead`, `designated-human-commercial-owner`, `designated-human-rights-reviewer`, `cto`, `chief-of-staff`
- activation payload issue_seeds human_lane values must use only: `founder`, `growth-lead`, `ops-lead`, `designated-human-commercial-owner`, `designated-human-rights-reviewer`, `cto`, `chief-of-staff`
- activation payload issue_seeds must map every recommended action to named lanes from the current autonomous org and activation program
- activation payload named_claims must include every named company, stack, or delivery claim and each claim must either carry source_urls or set validation_required=true
- activation payload metrics_dependencies must cover: `robot_team_inbound_captured`, `proof_path_assigned`, `proof_pack_delivered`, `hosted_review_ready`, `hosted_review_started`, `hosted_review_follow_up_sent`, `human_commercial_handoff_started`, `proof_motion_stalled`
- activation payload may also track proof milestones such as: `first_lawful_access_path`, `first_approved_capturer`, `first_completed_capture`, `first_qa_passed_capture`, `first_rights_cleared_proof_asset`, `first_proof_pack_delivery`, `first_hosted_review`, `first_human_commercial_handoff`
- allowed capture status values: `identified`, `contacted`, `responded`, `qualified`, `approved`, `onboarded`, `capturing`, `inactive`
- allowed buyer target status values: `identified`, `researched`, `queued`, `contacted`, `engaged`, `hosted_review`, `commercial_handoff`, `closed_won`, `closed_lost`
- allowed buyer target proof_path values: `exact_site`, `adjacent_site`, `scoped_follow_up`
- allowed first touch type values: `first_touch`, `follow_up`, `approval_request`, `intro`, `operator_send`
- allowed first touch status values: `draft`, `queued`, `sent`, `delivered`, `replied`, `failed`
- allowed budget category values: `creative`, `outbound`, `community`, `field_ops`, `travel`, `tools`, `other`
- if a value is unsupported or unknown, omit it or set it to null rather than inventing a new enum
- approved analytics references for the instrumentation section: `growth_events`, `inboundRequests.ops.proof_path`, `exact_site_review_view`, `proof_path_stage_updated`, `contact_request_started`, `contact_request_submitted`, `contact_request_completed`, `contact_request_failed`, `experiment_exposure`, `robot_team_inbound_captured`, `robot_team_fit_checked`, `proof_path_assigned`, `proof_pack_delivered`, `hosted_review_ready`, `hosted_review_started`, `hosted_review_follow_up_sent`, `exact_site_request_created`, `deeper_review_requested`, `human_commercial_handoff_started`, `proof_motion_stalled`, `qualified_inbound_at`, `proof_pack_delivered_at`, `proof_pack_reviewed_at`, `hosted_review_ready_at`, `hosted_review_started_at`, `hosted_review_follow_up_at`, `exact_site_requested_at`, `artifact_handoff_delivered_at`, `artifact_handoff_accepted_at`, `human_commercial_handoff_at`

Machine-readable activation payload schema:
```json
{
  "schema_version": "2026-04-13.city-launch-activation-payload.v1",
  "machine_policy_version": "2026-04-13.city-launch-doctrine.v1",
  "city": "Sacramento, CA",
  "city_slug": "sacramento-ca",
  "city_thesis": "One narrow exact-site hosted review motion tied to one real workflow lane and one truthful buyer proof path.",
  "primary_site_lane": "industrial_warehouse",
  "primary_workflow_lane": "dock handoff and pallet movement",
  "primary_buyer_proof_path": "exact_site",
  "lawful_access_modes": [
    "buyer_requested_site",
    "site_operator_intro"
  ],
  "preferred_lawful_access_mode": "buyer_requested_site",
  "rights_path": {
    "summary": "Use the lawful access mode per target. Private controlled interiors require explicit authorization before capture dispatch.",
    "private_controlled_interiors_require_authorization": true,
    "validation_required": false,
    "source_urls": [
      "https://example.com/rights"
    ]
  },
  "validation_blockers": [
    {
      "key": "buyer_stack_fit",
      "summary": "Verify target export format compatibility before live outreach.",
      "severity": "high",
      "owner_lane": "buyer-solutions-agent",
      "validation_required": true,
      "source_urls": []
    }
  ],
  "required_approvals": [
    {
      "lane": "founder",
      "reason": "New city activation and spend posture remain founder-gated."
    }
  ],
  "owner_lanes": [
    "city-launch-agent",
    "ops-lead",
    "growth-lead",
    "buyer-solutions-agent",
    "analytics-agent"
  ],
  "issue_seeds": [
    {
      "key": "lawful-access-path",
      "title": "Lock the first lawful access path",
      "phase": "founder_gates",
      "owner_lane": "city-launch-agent",
      "human_lane": "growth-lead",
      "summary": "Pick the first lawful access mode and block private controlled interiors until authorization is explicit.",
      "dependency_keys": [],
      "success_criteria": [
        "First lawful access path is named and documented."
      ],
      "metrics_dependencies": [
        "first_lawful_access_path"
      ],
      "validation_required": false
    }
  ],
  "metrics_dependencies": [
    {
      "key": "robot_team_inbound_captured",
      "kind": "event",
      "status": "required_not_tracked",
      "owner_lane": "analytics-agent",
      "notes": "Implement before expecting autonomous governance."
    },
    {
      "key": "proof_path_assigned",
      "kind": "event",
      "status": "required_not_tracked",
      "owner_lane": "analytics-agent",
      "notes": "Implement before expecting autonomous governance."
    },
    {
      "key": "proof_pack_delivered",
      "kind": "event",
      "status": "required_not_tracked",
      "owner_lane": "analytics-agent",
      "notes": "Implement before expecting autonomous governance."
    },
    {
      "key": "hosted_review_ready",
      "kind": "event",
      "status": "required_not_tracked",
      "owner_lane": "analytics-agent",
      "notes": "Implement before expecting autonomous governance."
    },
    {
      "key": "hosted_review_started",
      "kind": "event",
      "status": "required_not_tracked",
      "owner_lane": "analytics-agent",
      "notes": "Implement before expecting autonomous governance."
    },
    {
      "key": "hosted_review_follow_up_sent",
      "kind": "event",
      "status": "required_not_tracked",
      "owner_lane": "analytics-agent",
      "notes": "Implement before expecting autonomous governance."
    },
    {
      "key": "human_commercial_handoff_started",
      "kind": "event",
      "status": "required_not_tracked",
      "owner_lane": "analytics-agent",
      "notes": "Implement before expecting autonomous governance."
    },
    {
      "key": "proof_motion_stalled",
      "kind": "event",
      "status": "required_not_tracked",
      "owner_lane": "analytics-agent",
      "notes": "Implement before expecting autonomous governance."
    }
  ],
  "named_claims": [
    {
      "subject": "Example Robotics",
      "claim_type": "company",
      "claim": "Example Robotics is a credible named buyer target for this city wedge.",
      "validation_required": false,
      "source_urls": [
        "https://example.com/buyer"
      ]
    },
    {
      "subject": "ROS 2 / Gazebo",
      "claim_type": "stack",
      "claim": "The proof path should support ROS 2 / Gazebo-compatible artifacts.",
      "validation_required": true,
      "source_urls": []
    }
  ]
}
```

Structured launch data schema:
```json
{
  "schema_version": "2026-04-12.city-launch-research.v1",
  "generated_at": "2026-04-12T00:00:00.000Z",
  "capture_location_candidates": [
    {
      "name": "Example warehouse",
      "source_bucket": "industrial_warehouse",
      "channel": "operator_intro",
      "status": "identified",
      "site_address": "123 Example St, Austin, TX",
      "location_summary": "Del Valle logistics corridor",
      "lat": 30,
      "lng": -97,
      "site_category": "warehouse",
      "workflow_fit": "dock handoff and pallet movement",
      "priority_note": "Strong early exact-site capture wedge.",
      "source_urls": [
        "https://example.com"
      ],
      "explicit_fields": [
        "name",
        "site_address",
        "source_bucket"
      ],
      "inferred_fields": [
        "lat",
        "lng"
      ]
    }
  ],
  "buyer_target_candidates": [
    {
      "company_name": "Example Robotics",
      "contact_name": "Jane Doe",
      "status": "researched",
      "workflow_fit": "warehouse autonomy",
      "proof_path": "exact_site",
      "notes": "Cited buyer fit from current robotics deployment work.",
      "source_bucket": "warehouse_robotics",
      "source_urls": [
        "https://example.com"
      ],
      "explicit_fields": [
        "company_name",
        "workflow_fit"
      ],
      "inferred_fields": []
    }
  ],
  "first_touch_candidates": [
    {
      "reference_type": "buyer_target",
      "reference_name": "Example Robotics",
      "channel": "email",
      "touch_type": "first_touch",
      "status": "queued",
      "campaign_id": null,
      "issue_id": null,
      "notes": "Reference a cited warehouse proof path.",
      "source_urls": [
        "https://example.com"
      ],
      "explicit_fields": [
        "reference_name",
        "channel"
      ],
      "inferred_fields": []
    }
  ],
  "budget_recommendations": [
    {
      "category": "outbound",
      "amount_usd": 250,
      "note": "Explicit recommendation from the final playbook.",
      "source_urls": [
        "https://example.com"
      ],
      "explicit_fields": [
        "category",
        "amount_usd"
      ],
      "inferred_fields": []
    }
  ]
}
```

Primary research dossier:
# Blueprint City Proof-Motion Architecture: Sacramento, California (Revised)

**Leading Paragraph:**

*   **Key Points:**
    *   Sacramento represents a highly specific, industrially constrained ecosystem for Blueprint's exact-site world-model deployment, centered on advanced material handling automation (Raymond West) and specialized third-party logistics (3PL) operations at McClellan Park.
    *   The primary commercial wedge is the **Exact-Site Hosted Review** for autonomous logistics integrators. Research suggests that the recent push by KION Group (Raymond West's parent) into "Physical AI" and digital-twin warehouse simulation creates a localized, verifiable demand for high-fidelity spatial models [cite: 1].
    *   Previous assumptions regarding academic capturer deployments and simplistic consent mechanisms have been structurally rejected. Industrial interiors demand a strictly professional, insured capture cohort and a multi-party legal clearance framework to navigate overlapping 3PL tenant IP and active-machinery risks.
    *   *Uncertainty/Hedging:* The conversion of theoretical spatial-model demand into authorized capture operations remains a complex hypothesis. Because McClellan Park houses export-controlled defense contractors (e.g., Northrop Grumman) [cite: 2] and heavily regulated food-grade cold storage operations [cite: 3], lawful access cannot be guaranteed. Furthermore, evidence suggests defense-adjacent integrators may require air-gapped artifact delivery, potentially rendering Blueprint's public-cloud hosted-review infrastructure legally insufficient for certain sectors [verify before outreach].

*   **Systemic Context:** Blueprint operates strictly as a capture-first and world-model-product-first platform. This architecture explicitly rejects proactive unauthorized capture, fabricated delivery SLAs, and hype-driven marketing language. It mandates verifiable, rights-cleared data provenance navigated by a hybrid human-agent operational structure, prioritizing legal safety and technical precision over rapid supply scaling.

*   **Strategic Application:** This document provides the rigorous, operational protocol for the Sacramento deployment, resolving critical prior critiques regarding capturer liability, 3PL consent mechanics, and buyer technical ingestion. It details the bounded mechanisms by which `intake-agent`, `rights-provenance-agent`, and human operators will secure multi-party consent, execute extreme-environment (sub-zero) capture missions, and validate buyer stack compatibility.

***

## 1. Resolution of Prior Architectural Gaps

This updated architecture fundamentally overhauls the operational mechanics of the Sacramento proof motion to ensure strict alignment with Blueprint doctrine and industrial reality. The following fatal gaps have been explicitly resolved:

*   **Capturer Profile Pivot (Liability & Safety):** The deployment of uninsured university students into active, heavy-machinery 3PL environments is banned. The primary capturer profile for the industrial wedge is now restricted to fully insured, professionally certified reality-capture specialists or field engineers holding minimum commercial general liability coverage of $1,000,000 per occurrence and a $2,000,000 aggregate, aligning with baseline California state and McClellan Park contractor insurance requirements [cite: 4, 5].
*   **3PL Multi-Party Consent Protocol:** The assumption that a single facility manager can authorize spatial mapping is legally dangerous and has been removed. 3PL warehouses operate under multi-tenant structures [cite: 6, 7]. The `rights-provenance-agent` now enforces a three-tier IP clearance protocol requiring explicit consent from the property owner (e.g., McClellan Business Park LLC) [cite: 8], the facility operator (e.g., US Cold Storage) [cite: 3], and the specific inventory tenants whose zones are being captured.
*   **Abolition of Fabricated Delivery SLAs:** The previously stated "72-hour delivery guarantee" is removed. Time-to-proof will be measured via the `proof_pack_delivered` metric, but no arbitrary delivery readiness claims will be made until pipeline throughput for dense, feature-sparse cold-storage environments is empirically benchmarked.
*   **Analog Correction & Air-Gap Acknowledgment:** Analogies to residential consumer platforms (Airbnb) have been purged. While Applied Intuition serves as a reference for engineering-grade simulation artifacts, we explicitly note that Blueprint's web-native hosted review may fundamentally clash with the ITAR and CUI security requirements of McClellan's defense-aerospace base [cite: 9, 10].

## 2. Executive Summary & Truth Constraints

The Sacramento metropolitan area offers a highly specialized theater to test Blueprint’s exact-site models, driven not by general commerce, but by the specific intersection of advanced material handling systems and sprawling 3PL infrastructure. Local operations are heavily anchored by McClellan Park, a former Air Force base repurposed into a massive industrial logistics hub housing entities ranging from Kratos Defense to US Cold Storage [cite: 8, 11, 12].

This architecture activates the Sacramento market by optimizing for a single, deeply technical commercial wedge: **Exact-Site Hosted Review for Industrial Warehouse Automation and Integrators**. Target buyers are AMR deployment teams and systems integrators—specifically ecosystem players aligned with Raymond West and Cyngn—who require spatial ground-truth to feed digital-twin simulations before deploying autonomous hardware [cite: 13, 14].

### Strict Operating Constraints

To maintain operator safety and mitigate severe industrial liability, the following constraints are absolute:

1.  **Capture-First Doctrine:** Blueprint sells explicit reality, not procedural models. The entry point is verified lawful access.
2.  **No Invented Telemetry:** Operational tracking is restricted to approved repository vocabulary (e.g., `robot_team_inbound_captured`, `proof_path_assigned`, `proof_motion_stalled`).
3.  **Strictly Bounded, Professional Supply:** Capturer supply is capped at a highly vetted cohort of 3-5 professional, commercially insured reality-capture specialists. Academic cohorts are strictly quarantined to the secondary AgTech wedge and banned from active logistics interiors.
4.  **Multi-Tier Lawful Access:** Private industrial mapping requires verifiable, multi-party consent (Property Owner + Operator + Tenant). Acceptable access modes are `buyer_requested_site`, `site_operator_intro`, and `capturer_existing_lawful_access`.
5.  **Regulated Buyer Posture [verify before outreach]:** Assumptions regarding cloud compatibility, network security postures, or SaaS delivery readiness for buyers in export-controlled zones (McClellan) are suspended. Air-gapped delivery requirements are treated as an explicit blocking constraint requiring human architectural review.
6.  **No Manipulative Framing:** Collateral will not rely on artificial urgency, scarcity, or unvalidated claims of seamless integration.

## 3. City Proof-Motion Thesis and Localized Demand Vector

**Thesis Statement:** Sacramento's dense integration of 3PL logistics infrastructure and localized warehouse automation integrators creates a viable testbed for Blueprint to supply exact-site spatial models to engineering teams executing digital-twin simulations for AMR deployment.

### The Raymond West / KION Group Demand Vector

The localized demand for spatial world models in Sacramento is not theoretical; it is mechanically linked to recent strategic shifts by major material handling integrators operating heavily in the region. 
*   Raymond West (a major presence in Sacramento and the West Coast) is actively transitioning from manual lift trucks to autonomous solutions, recently partnering with Cyngn to distribute DriveMod Tuggers [cite: 13, 14]. Cyngn's autonomous navigation relies heavily on NVIDIA Accelerated Computing for computer vision [cite: 15].
*   Simultaneously, KION Group (a dominant warehouse equipment manufacturer) has partnered with NVIDIA and Accenture to build "Physical AI" digital-twin solutions for warehouses, utilizing simulation to optimize robot routing, space, and throughput [cite: 1].
*   Raymond West utilizes iWAREHOUSE Real-Time Location Systems (RTLS) to map facility layouts and optimize vehicle paths [cite: 16, 17].

**The Blueprint Wedge:** Integrators deploying these NVIDIA-backed digital twins and RTLS platforms require high-fidelity, accurate 3D point clouds and semantic meshes of the *exact* target warehouse. Blueprint replaces the slow, manual surveying process by providing pre-captured, rights-cleared, site-specific packages of industrial interiors, allowing these AMR teams to validate spatial tolerances remotely.

## 4. Evidence-Backed Claims, Inferred Claims, and Hypotheses

The distinction between established fact and operational hypothesis dictates where the `ops-lead` must focus validation efforts.

### Evidence-Backed Claims
*   McClellan Park (formerly McClellan Air Force Base) is a major industrial hub housing diverse operations, including food-grade 3PL logistics (US Cold Storage) and defense/aerospace contractors (Northrop Grumman, Kratos Defense) [cite: 2, 8, 12].
*   US Cold Storage operates massive temperature-controlled facilities in the region (including Fresno and Tulare), with deep freeze environments reaching -20°F (-28°C) [cite: 3].
*   Raymond West is actively distributing Cyngn's autonomous DriveMod Tuggers and utilizes the iWAREHOUSE software suite for fleet optimization and facility layout tracking [cite: 13, 14, 16].
*   Standard public works and logistics contractor agreements in the Sacramento/McClellan region mandate commercial general liability insurance of at least $1,000,000 per occurrence and $2,000,000 aggregate [cite: 4, 5, 18].
*   Third-party logistics (3PL) facilities operate on a multi-tenant model, physically and logically segregating inventory zones for different corporate clients within the same warehouse [cite: 7, 19].

### Inferred Claims
*   Because Cyngn and KION Group rely on NVIDIA-powered computer vision and digital-twin simulations for their autonomous vehicles [cite: 1, 15], local integration teams at Raymond West will require dense 3D spatial models of target 3PL facilities to simulate and test autonomy before physical deployment.
*   Given the operational parameters of US Cold Storage (operating down to -20°F) [cite: 3], consumer-grade or academic-grade capture hardware (e.g., standard iPads or basic LiDAR scanners) will likely experience severe battery degradation or optical fogging, requiring specialized thermal-rated equipment for capture.

### Hypotheses Needing Validation [verify before outreach]
*   **Multi-Party Consent Viability:** Obtaining synchronized legal consent from the property owner (LDK Ventures), the facility operator (USCS), and the inventory tenant to perform internal optical mapping is commercially viable and will not stall indefinitely in legal review.
*   **Export Control/Defense Restrictions Hypothesis:** Due to the verified presence of Northrop Grumman and Kratos Defense at McClellan Park [cite: 2, 12], we hypothesize that certain industrial zones do not have lingering federal mapping restrictions or overlapping CUI (Controlled Unclassified Information) lines of sight [cite: 9, 10].
*   **Artifact Compatibility Hypothesis:** Dense 3D point clouds outputted by `BlueprintCapturePipeline` can be natively ingested by Raymond West's iWAREHOUSE system or KION's digital-twin simulation software without requiring extensive bespoke data translation.
*   **Security Posture / Cloud Hosting Hypothesis:** Robotics integration buyers operating within defense-adjacent or proprietary 3PL ecosystems will permit spatial blueprints of their client's facilities to be hosted and reviewed via Blueprint's public-cloud `Blueprint-WebApp`, rather than mandating air-gapped or on-premise delivery.

## 5. Lawful Capture Supply Acquisition System

The shift from academic gig-labor to professional industrial contractors requires a fundamentally different supply acquisition pipeline. 

### Target Capturer Profile (Industrial Wedge)
*   **Mandatory Qualifications:** Professional reality-capture specialists, industrial surveyors, or field-service engineers.
*   **Insurance Requirement:** Must provide a Certificate of Insurance (COI) proving Commercial General Liability ($1M occurrence / $2M aggregate) and Workers' Compensation coverage [cite: 4, 5, 20].
*   **Safety Certifications:** OSHA 10-hour or 30-hour General Industry certification; compliance with industrial PPE standards (steel-toe footwear, high-visibility garments, hard hats).

### Target Capturer Profile (Secondary AgTech Wedge ONLY)
*   **Qualifications:** Engineering graduate students affiliated with UC Davis robotics labs (LARA, HRVIP) [cite: 8, 21]. 
*   **Restriction:** Strictly limited to public agricultural fields, university-owned testing facilities, and the FIRA USA conference grounds. Banned from 3PL interior logistics.

### Access Paths and Authorization
Proactive capture of private industrial sites is permanently banned. Operations utilize:
1.  `buyer_requested_site`: An AMR vendor (e.g., Raymond West) requests a model of a client's facility to pitch an automation layout and facilitates the three-tier consent introduction.
2.  `site_operator_intro`: Blueprint directly engages a facility operator for mutual benefit (e.g., providing an updated facility mesh for their own WMS).
3.  `capturer_existing_lawful_access` [verify before outreach]: A certified structural engineer or surveyor already contracted by McClellan Park utilizes their access, provided optical capture does not violate their existing NDAs or CUI restrictions.

## 6. Multi-Tier Rights, Provenance, and IP Clearance Protocol

The primary critique of the prior architecture was the naive assumption of simple consent. 3PL logistics facilities are highly sensitive IP environments where a single warehouse may hold inventory for competing global brands.

### The 3-Tier Consent Gate
Before the `ops-lead` can authorize dispatch, the Trust Packet must clear three distinct legal entities:
1.  **Tier 1: The Property Owner.** (e.g., LDK Ventures / McClellan Business Park LLC) [cite: 8]. Consent for structural recording of the premises.
2.  **Tier 2: The Logistics Operator.** (e.g., US Cold Storage) [cite: 3]. Consent for recording active machinery, WMS logic pathways, and AS/RS equipment.
3.  **Tier 3: The Inventory Tenant(s).** (e.g., Food/Beverage companies). If the capture scope includes tenant-specific zones, the tenant must authorize visual recording of their product packaging and localized storage layout [cite: 19].

### Provenance Enforcement and Privacy Scrubbing
1.  **Hardware Stamping:** The `BlueprintCapture` client securely stamps raw bundles with cryptographic hashes and GPS/temporal metadata.
2.  **Automated IP Flagging:** The `rights-provenance-agent` scans for and flags:
    *   Human faces and employee badges.
    *   Tenant inventory labels, barcodes, and pallet markers.
    *   Proprietary third-party automation machinery (e.g., a specific manufacturer's AMR).
3.  **Designated Human Review:** The `designated-human-rights-reviewer` must manually verify the redaction of these flagged elements. If a tenant refused Tier 3 consent, their specific geographic zone within the warehouse map must be heavily blurred or structurally excised from the final mesh before it enters the `BlueprintCapturePipeline`.

## 7. Environmental & Hardware Operations

Operating within Sacramento's specific industrial loci requires confronting severe physical and regulatory environments.

### Failure Mode 1: The "Sterile Deep-Freeze" Block
*   **Physics Constraint:** US Cold Storage facilities at McClellan and Fresno operate convertible rooms ranging from +34°F down to -20°F [cite: 3]. Standard commercial LiDAR and camera equipment suffer rapid battery depletion, LCD freezing, and lens condensation when transitioning between ambient loading docks and deep-freeze zones.
*   **Operational Mitigation:** The `ops-lead` must verify the thermal operating limits of the capturer's hardware prior to dispatch. Initial exact-site proof motions will be restricted to ambient-temperature cross-dock facilities or dry-storage multi-tenant spaces [cite: 22]. Deep-freeze capture requires specialized, thermally insulated rigs.
*   **Contamination Constraint:** Food logistics require strict sanitation and allergen protocols [cite: 3]. Capturers and equipment must undergo sterilization procedures to enter active food-grade zones.

### Failure Mode 2: The Defense/ITAR Contamination Block
*   **Regulatory Constraint:** McClellan Park houses defense contractors like Northrop Grumman and Kratos Defense, engaged in drone manufacturing and maritime training systems [cite: 2, 12]. Capturing areas with overlapping lines of sight to these facilities risks recording ITAR-controlled articles or Controlled Unclassified Information (CUI) [cite: 9, 10].
*   **Operational Mitigation:** The `ops-lead` must explicitly cross-reference the target capture site against known defense leaseholds at McClellan. Any `site_operator_intro` near the McClellan Nuclear Research Center or Kratos aviation hangars requires a human-led legal review to clear federal mapping restrictions `[verify before outreach]`.

## 8. Buyer Fit and Artifact Integration Routing

To ensure commercial viability, the delivery format must mechanically interface with the target buyer's software stack.

1.  **`exact_site` vs `adjacent_site` Routing:** 
    *   If a Raymond West integrator requests an Exact-Site model of a specific warehouse to simulate Cyngn DriveMod Tugger routing [cite: 13], and Tier 1-3 consent is secured, the pipeline delivers the exact layout.
    *   If access is blocked (e.g., by tenant IP denial), the `intake-agent` routes the buyer to an `adjacent_site`—a pre-cleared, structurally identical ambient warehouse module used to validate the simulation software's ingestion capabilities.

2.  **Stack Ingestion Validation `[verify before outreach]`:** 
    *   The `buyer-solutions-agent` must verify that the dense point clouds and semantic meshes produced by Blueprint can be imported into NVIDIA's "Physical AI" digital twin environment or Raymond West's iWAREHOUSE layout planning software [cite: 1, 16]. 

3.  **Delivery Posture / The Air-Gap Clause `[verify before outreach]`:**
    *   If the buyer integrates systems for defense or heavily regulated industrial clients (e.g., Northrop Grumman supply chain), public-cloud hosting via `Blueprint-WebApp` may violate their cybersecurity policies. If an air-gapped or on-premise delivery requirement is triggered, the `chief-of-staff` agent immediately categorizes the demand as `scoped_follow_up` and escalates to human architectural review. Blueprint does not fabricate delivery capabilities.

## 9. Hosted-Review Conversion System

The transition from product delivery to commercial handoff must utilize rigorous, non-manipulative tracking.

1.  **Review Readiness:** Triggered when the `BlueprintCapturePipeline` validates the package and the `Ops Lead` confirms it is accessible on the designated infrastructure. Event: `hosted_review_ready`.
2.  **Buyer Engagement:** Measured when the authenticated buyer identity interacts with the 3D artifact. Event: `hosted_review_started`.
3.  **Follow-up Mechanics:** The `buyer-solutions-agent` issues a technical data-sheet 24 hours post-review detailing mesh density, semantic tagging layers, and export formats. Event: `hosted_review_follow_up_sent`.
4.  **Stall Categorization:** If the integration team fails to extract value, the `ops-lead` (assisted by the `chief-of-staff` agent's flagging) categorizes the failure (e.g., `stack_ingestion_failure`, `air_gap_required`, `resolution_insufficient`). Event: `proof_motion_stalled`.
5.  **Commercial Handoff:** Once the buyer’s technical lead confirms the world-model meets their digital-twin simulation requirements, agents immediately recuse themselves. All pricing and contract terms are handled by the `designated-human-commercial-owner`. Event: `human_commercial_handoff_started`.

## 10. Human vs Agent Operating Model

*   **Founder:** Authorizes total budget, approves ITAR/Defense-adjacent exception handling, and makes the final "Go/No-Go" scaling decision.
*   **Ops Lead:** Manages the Tier 1-3 Trust Packet workflow, verifies capturer COIs ($1M/$2M liability), enforces hardware thermal limits, and ensures safe industrial dispatch.
*   **Designated Human Rights Reviewer:** Manually verifies that 3PL tenant inventory, proprietary AS/RS machinery, and personnel faces are scrubbed from the final mesh.
*   **Designated Human Commercial Owner:** Owns the `human_commercial_handoff_started` milestone; negotiates enterprise terms with systems integrators.
*   **`city-launch-agent`:** Maintains and updates this architectural state document.
*   **`intake-agent`:** Categorizes inbound demand (e.g., Raymond West, Cyngn) and verifies baseline stack fit.
*   **`rights-provenance-agent`:** Automatically flags raw bundles for IP/Privacy violations.
*   **`buyer-solutions-agent`:** Handles automated technical follow-ups post-review.
*   **`analytics-agent`:** Monitors pipeline telemetry.

## 11. Instrumentation and Scorecard Spec

*Authoritative storage resides in `inboundRequests.ops.proof_path`. No new events have been created.*

| Metric | Telemetry Reference | Owner | Analytical Purpose |
| :--- | :--- | :--- | :--- |
| **First Real Signal** | `robot_team_inbound_captured` | `intake-agent` | Validates inbound demand from local material-handling integrators. |
| **Proof Scope Truth** | `robot_team_fit_checked` | `intake-agent` | Confirms Blueprint's exact-site vs. adjacent-site capability for the request. |
| **Routing Efficiency** | `proof_path_assigned` | `Ops Lead` | Measures distribution across access modes and wedge viability. |
| **Time-to-Proof** | `proof_pack_delivered` | `BlueprintCapturePipeline` | Benchmarks the empirical processing time for industrial spatial data. |
| **Review Surface Health** | `hosted_review_ready` | `Ops Lead` | Human confirmation that the artifact is successfully hosted and technically sound. |
| **Buyer Engagement** | `hosted_review_started` | `analytics-agent` | Measures conversion from delivery to technical inspection by the robotics team. |
| **Operational Follow-Through**| `hosted_review_follow_up_sent` | `buyer-solutions-agent` | Ensures the buyer integration team receives artifact export details. |
| **Commercial Transition** | `human_commercial_handoff_started` | `designated-human-commercial-owner` | Confirms technical viability and initiates procurement. |
| **Failure Analysis** | `proof_motion_stalled` | `chief-of-staff` | Exposes systemic blockers (e.g., format incompatibility with NVIDIA/iWAREHOUSE). |

## 12. Budget Policy and Execution Gates

*   **Funded Thresholds (Requires Founder Approval):**
    *   `creative`: $0
    *   `outbound`: $0
    *   `community`: $500/month (AgTech secondary wedge only; UC Davis/FIRA outreach) [cite: 23].
    *   `field_ops`: $2,500/month (Higher tier to accommodate professional reality-capture contractor rates and liability insurance premiums).
    *   `travel`: $0.

*   **GO Gate (Widen Cohort):**
    1.  Successful execution of Tier 1-3 IP clearance on at least one multi-tenant industrial facility.
    2.  At least 1 `hosted_review_started` event resulting in successful integration with a buyer's simulation stack (e.g., successful mesh import).
    3.  0 instances of unauthorized access, OSHA safety violations, or ITAR boundary breaches.

*   **HOLD Gate (Pause Expansion):**
    1.  Inability to secure $1M/$2M commercially insured capturers.
    2.  Systemic failure of capture hardware in ambient or sub-zero logistics environments.
    3.  High volume of `proof_motion_stalled` due to the web-app violating buyer IT security postures.

*   **NO-GO Gate (Abort City):**
    1.  Insurmountable multi-party legal blockers preventing indoor capture at large-scale 3PL facilities.
    2.  Federal mapping restrictions completely locking out the McClellan Park industrial locus.

## 13. Machine-Readable Activation Payload

*(Revised to resolve schema enforcement: `claim_type` corrected to "company" [legal is invalid]; `chief-of-staff` removed from `active_agent_lanes`)*

```city-launch-activation-payload with schema "2026-04-13.city-launch-activation-payload.v1" and machine_policy_version "2026-04-13.city-launch-doctrine.v1"
{
  "city": "Sacramento",
  "state": "CA",
  "priority_wedge": {
    "key": "exact_site_hosted_review",
    "label": "Exact-Site Hosted Review",
    "summary": "Industrial and 3PL Indoor Automation Environments for Material Handling Integrators and Digital-Twin Simulation Teams."
  },
  "approved_access_modes": [
    "buyer_requested_site",
    "site_operator_intro",
    "capturer_existing_lawful_access"
  ],
  "target_buyer_segments": [
    "Material Handling Systems Integrators",
    "AMR/AGV Deployment Teams",
    "Digital Twin Simulation Engineers"
  ],
  "required_telemetry": [
    "robot_team_inbound_captured",
    "robot_team_fit_checked",
    "proof_path_assigned",
    "proof_pack_delivered",
    "hosted_review_ready",
    "hosted_review_started",
    "hosted_review_follow_up_sent",
    "human_commercial_handoff_started",
    "proof_motion_stalled"
  ],
  "human_approval_gates": [
    "founder",
    "ops-lead",
    "growth-lead",
    "designated-human-commercial-owner",
    "designated-human-rights-reviewer"
  ],
  "active_agent_lanes": [
    "city-launch-agent",
    "intake-agent",
    "rights-provenance-agent",
    "buyer-solutions-agent",
    "analytics-agent"
  ],
  "validation_blockers": [
    {
      "severity": "high",
      "claim_type": "company",
      "description": "Verify absence of federal mapping restrictions and ITAR/CUI overlaps on former McClellan Air Force Base properties before authorizing indoor capture."
    },
    {
      "severity": "high",
      "claim_type": "delivery",
      "description": "Verify exact-site artifact compatibility with Raymond West (iWAREHOUSE), NVIDIA digital twin frameworks, or similar intralogistics planning software stacks."
    },
    {
      "severity": "high",
      "claim_type": "stack",
      "description": "Verify that target industrial buyers do not possess IT security policies mandating air-gapped delivery, which would invalidate the Blueprint public-cloud WebApp."
    }
  ]
}
```

**Sources:**
1. [kingsresearch.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGBo8O0MDpkhlAEIeMCJBO1fh-UirlyUeI3oqGgKPMpDvaUELSSv5dVEo3_44REfir17cgpJWHwFBzlNtR-vi0fRqzAIfLCWAnOJCNeGzYymcRlGGK9rCVik63B1PGoNiHguXmOkcpLqDhGOfuDS1oRVjI_wgcwEpKNtQ==)
2. [gdmissionsystems.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHJWqgHVas37apUGSmFuL9ch8yFqGH3jSR64en4M3L9ouATAECPTizOKtr3yL0ypLDnGWEq4kaP_Ltfp1Pa2XYAs3f1LEVShZA-Q3TCj6swiQKZjNnxaMdmJjOomHQvVeS28Jf0Ru9XM1prMP_rivtDatA1iqeDHJHoBPBeJdOtDdVWWSLfCDnXyLQU_F6QGSgnK3EU9pnW)
3. [thebusinessjournal.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHT7qQmhqhpHPPLbe2kL2rRDac3hEt7yMhUGz-mFQFgUE7sHWisvG8YG_pj8H_ZrSDLaNIGh7UBpfichRWP5YW_hLNgBBSF0hzLF-cM5HCUnbf-U726PtCDkabtpuq3_e--a_eNVBAf_iG8KPPAvbcQaBC922fkoeJuK0TlzUDDO7cEKtOsleQ=)
4. [ca.gov](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGOqSGvEL3WTN7ZI_ejnHVcfbGDslTuqZZVrpD8IuuAm9cwAqU5dgkt-zn_qrBent1UUkt_szrmMWOzkeqOGtoS7YpO2N1lfVy6YeOYTTIgkWEbS2ellLBOBHYCK-CcQYNFMD8xZsxz2Sn84pETVIpXyXznl03KuWpp25s0pkq97BVtS7WFtQuOqP_zVHYYjq-2578=)
5. [ca.gov](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFFvJPWxf04cD3YowIqLVW14ugpPteQQ9VMRKa9qhju-3lhzr2Uc1y-UwU_XU67mUkGyw4nIwQlQKCKUey3URUn_b4tyBze6FE9iTWE5IlTkGIAUU_HR0pxZ4BD7KBpgU851e1a0YAVTH-TgxJ5aR4P-J46RNcl2SurcEeZT4yoMrPZKns811ws4dmA9RTvyk1lWutbNZrUjg2tBkVvX9x68KtMzsveTMIlumvdJA6uA0FO9VjFU_aFXqY3uMbTZPoI5t-Efbu5yI19vzNe7A5ls_TMMd0M-PBHyCNElAHbIk5pGWnw7sMB8TKLHbLDli31LFaTqzlg6VIa_aonH4JzXc4Gfbct025TxBOaO3UcbBD1-FAbwBO3FmAJLKZwobZZI5u7YsOgnSGEpyBfpq5JwC5MH9yGSOWCUZXN8XcNAO66gIJEhPnTUZJti4BnzoxxNbHC67TM8EfU2M5EXXBrClONbfy77wHqHI-Pis0=)
6. [oracle.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGsqPHJC6DGJtk74EDyb8KZcnRnyHuokU8h73KdKPHNiRAdLWIZOdzoHpTvinq5-bJeNw26X8B7uJ1HDi-PJ9QJbSwmWYm-5EYJ5Sj8w4R2iHyhrMX2wMrrLcR6XvxKprWGqiMDXkcbW1nxZ-nNYhIfvGojk2TOTuSAVwM=)
7. [finaleinventory.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFYNmcdRu75lo_9CyoZQTIYo_miyDEQbKybx5jOmraHIB0agKh1f0Ma3t019limnnYYqmXEwkr0KD_zuIIOqUnQwn9Sk_pKGRav9DEg9A2GCMK5CdK-lB5ERhfM0AgEzzjJwRwQHnX9mkFBxJWcpVJ8Yj1TaptevkGXXTnn)
8. [ca.gov](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFxdbe7d9gmnGe4-FCoTS0QJJGzxqdLLi5hXameBh9reQQhqaU7WeGhPcI0YnjkUTEj8SMHb3V14vGHKQNeiepA7H2qv8BsX8eTATUzpAtXJYAzKKgMOYs9OPyMXa6iaeI1BQpPAMP42isYyylH0EABqqQZVsVpgGwhD6FRsYMq96wnruweqPY4Sel3t1Yk6LSsrlgJvX6guml6hJkiQ-o=)
9. [icims.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFl9-FDBc5jRJZi5HQLFzjNUM_TpkOsMlIFL7qtmaP2KrzkewCum_0d6rAjY5tTsmjalo0qF81_wvDia6qf9XdaAvVQeut6pi6bC5tJZbsj-blkPUFrhXGYT-QPposVlsD8K97fTDaCZiy2GI7P7-9BuJQkP7GJZatQIjT9R--D9Ngq3qFOa74AdXGI4NTyea6O1w==)
10. [indeed.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF_arYBj9ayMjDqav2H3bAXTkkn-X4fOaN-7WcmJ-XKo4rWiyk0tBaSTglGiFJj1Ffspxxtrq7ktC-yonzW6TV8bi5aCPTMgkvdsnPm65SeBNe-adpAX32sOsK3VKzbMyw2FMmZVenFgNX8RJGt226QzLFVXOOJ)
11. [wikimedia.org](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHo868jHVHVp9i6_-TggvBj9Mku_Qc6vFWkU5t40uCQrLToAPySdHyT2lFtzfCUVmnBgYftEAf_WnZXUkywAT59VagTvVT4PZ9GwWO-VruXbL4RdYErZgCPJn4Texn-mQiVS9u1FOFjnlkdSMRhkP6-dcEjTZE93_2a2Ne0ty1hHIBQ6j1DcgNO)
12. [comstocksmag.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEsXis-Hl3XnC5KTAk_pympL-nAEHPjcn2sYCTQYK0cF5jMGvAzF72pHonzXAOF2K22HTZS-LTCmfwc_ri-PCJACUCGmW5HBwf8dtJz21Amw5lqF9UmHiOrqQb1JJelxU19P0R3AXoP-Q==)
13. [prnewswire.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGDiVwzVv2HgoUWf6KYlON_wSbbOVJQFLPTLlMNdqOC3DUYQHFiIrvdWBIfXgwgZ4_FB3xdMwGCS3_XH4iJVCFzX5WiiuqsRoAUDXCaYMsJt6aO_SeONw-OxXsy8_8vW-pYt6m9C39a_JZUw50oZi6xEa1TdzFfVb0mI4ZmrqyAhfQILAQVa6kx5jcd0mLODz8GJCxESP4j-0z5_v5PipiNoH12Yn4Ax526HZJC6GJL7xL3W3vPSxBuI2I3GpQUEMZF4vQSVT_zhg43Uvj488741k59bSSrw30G)
14. [stocktitan.net](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFxzQk70_od-uehAiQeaYj_ErroOHLII-4fVcklaTtZ1fxiar-qkuW0GtuNXhbuJ5CR_TzUAS9Ka7JLIs7eAJeiDcmp_DzZ4OwTRhaJqd9qIQOI8gi0LOVtaiIkaP-P6g_VdG5-)
15. [investing.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFri9O22j_ShaGyjye9DR8FZroraTpV8r880F_qsVt1RyENA3ykCegpLMPwaw6Ac-HU1qhvU-j4I5viB5gDbT4sQuBY-KRpeVRNM0VUaCJtRv8Yi7YMj2n1QYOsMjeyJYLZ1C2kQXDuO2FUBX1gCjeOLwXEYI1myCzqtJ3egBqLKPaIGICAnzwGwgT67Hjxk9vOMojqZZJ1I_YdaFNWCnDkUeWCFI8=)
16. [raymondwest.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQExG-V7EPTwWbraxex3RRM4b1Mn7LRxNdolg7mAzydXn9a6dJylfLdcW0e4GZlYd4ZUTkYq_Q0xLJcQxYG3KeGGCj-7n111hLOeLkyJTb2pVnLVWFIRdYu7a-ejYM9XM8APkE7fbZdi6ZSzPYqSCu-Q)
17. [mhi.org](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFMnXhiCXGCY4dzoDGfbpKjbVf3NOiCgkDpKa8VqraMKf22U1uGs9VKfpl6P4YorpUvEn-7rj99pf40B8-wb-BtwbjIA03u7FKD7ajKELfHWfhkOce4Nw==)
18. [talgov.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQELa9np_7IoPZvdxSro0i8SY31d_KZB9hPVqJ8Ya4IysGbpT8SbE8pA2MpmRil8wZhe89TMMRL0hCGGw8mdmzQpBhHJy9vJwUPvXtfAgHO_K8Np6s8Txe5KkqNJFrnUhEnZIH1TzvACoQh0KR9p26AXNXPe6nqwcPFnFMUSPjY5vJjyfh6k7A==)
19. [storenshipfast.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGJu4wfG5II1owYR8eO0jGwpC4IXDEDNe8_ji0DpT1uBTVPkF1EbWhprWBgt46RmdWmLBwWjcNtEAGftZtYhGVEyVDLVJrJRKMh8IHKgJA-i4pdb3sEDbkKcrcJEBPxQOqxOz9vGdbKAaC_jO1FH8R2P4P0LVxhtw==)
20. [stancounty.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHPHIY6EgNkHXX2OHlAK6DlVp-m9chFLfpMCZcplOtb3hPNy7p61euzhBdMdfHm13fNJkKlxyfBxGg5pjNX0aYpCwI6cvSCO5qVMg8JabnEfJxK_yBzYXdTps0YQbY8gaDyLQ5UKKV2Di4anXVD5fgx)
21. [newventureadvisors.net](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE_QwbeKrWY8sAyEalOzp_ZJBF_5Iu0ujs-lB-ME5x8y87_mtd6wZmkj-l3gJtEQ9aL1pgnvVhLjBFHMdwuJPfMEDYiHOxn6J4JgUqgIVicMea8Zk8kQI-2UnUpH5GOtc_xzwu90nq7RXL_eCtStV6kS93m1pNEadBbnX3hxuY2TzidGWZdLzrn84mwjEzcwBnyEyL9DVkFgDrVJY-aEchPbHCY34pWsQHvCRenLe9uNFJuPEuyVw==)
22. [aew.com](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFHaeJb-7TTJfeaihMnBay0ZgmJK6znUJRxaawbrj9cetWKVFcorulpIqg-cVuAgXZVqKxUV9OK6gJNoYhbVWk9TU0-ulOsHXUnDJjLngboQecBf-poB3r14DXSYzp_lMe0cMGDc9dOsfak4RDF_o4tQsyvNTx8jFlaLDDoZn3Nrv2b1w==)
23. [gcca.org](https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQELyquJgeoRz818NfqvWdx_O5qBXil53mdnVX8yWozdTvTp9pTW7_9830V1KT1sGDZy_AZ4qLqDDpzf-1BjXJ32Gpci8vw0v_ff1o3KGckWss8bYRaMUvssW3BelLPeqY0CfnzDFmgDZFkrDoWSJCDsFV8NJ3MnZ7JOLu3H7o3BPWcBSA3pki3y9vNfhv6zv3pB1eYN0PVQ4g==)

Critique outputs:
Here is the critique of the Sacramento City Proof-Motion Architecture, executed with a hostile-but-accurate operational lens to ensure strict adherence to Blueprint doctrine.

### 1. Fatal gaps
*   **Operational disconnect on Capturer Profile vs. Site Environment:** The dossier proposes deploying "engineering students from UC Davis" to capture sub-zero, heavily automated, multi-tenant industrial 3PL warehouses at McClellan Park (e.g., US Cold Storage). This is an operational disaster. Students lack commercial liability insurance, OSHA safety training, cold-gear compliance, and active-machinery clearance. Sending gig-style academic labor into active logistics facilities will result in immediate rejection at the security gate and severe liability. 
*   **Naive treatment of 3PL IP and Consent:** The architecture assumes `site_operator_intro` with a "facility manager" is sufficient for access. In 3PL logistics, the property owner (e.g., LDK Ventures), the logistics operator (e.g., US Cold Storage), and the inventory owner/tenant all have overlapping IP, security, and NDA jurisdictions. Assuming a single "Trust Packet" signature clears multi-party corporate consent for proprietary automation layouts is fatally thin.
*   **Delivery SLA Fabrication:** The dossier guarantees delivery of "a hosted-review artifact to the integrator within 72 hours." Blueprint doctrine explicitly forbids making arbitrary delivery readiness claims. This is a fabricated SLA not grounded in current pipeline throughput data.

### 2. Unsupported or weak analogies
*   **Airbnb mapping is legally dangerous:** Mapping Airbnb’s "host intake" to Blueprint’s `site_operator_intro` fundamentally misunderstands the risk profile. Airbnb relies on a consumer consent model for residential properties. Equating this to the complex, multi-party legal clearances required to map a proprietary defense-adjacent industrial hub is an unsafe analogy that will misguide human operators into skipping necessary legal reviews.
*   **Applied Intuition delivery mismatch:** The dossier uses Applied Intuition as a sanity check for deep technical rigor but then blatantly rejects their on-premise delivery model in favor of Blueprint's "web-native Exact-Site Hosted Review." For defense-adjacent and export-controlled industrial hubs, air-gapped or localized delivery is often a strict legal requirement, not an optional preference. 

### 3. Manipulative or posture-drifting language
*   The dossier violates the ban on hypey, posture-changing language. Phrases like *"academic-grade operational blueprint"*, *"massive-scale logistics expansion"*, *"undergoing a boom"*, and *"undisputed center for agricultural robotics"* read like a generic startup city marketplace pitch, not a sober, evidence-backed proof-motion plan.
*   The phrase *"drastically reducing integration friction"* is a marketing claim, not a factual description of the current pipeline's output capabilities. 

### 4. Missing validation-required labels
*   **Export Control/Defense Restrictions:** The dossier mentions McClellan Park is a former Air Force Base, states it as a hypothesis, but fails to attach `[verify before outreach]` to the assumption that there are no lingering federal mapping restrictions. 
*   **Capturer Insurance/OSHA viability:** The assumption that students can operate in these zones is missing a `[verify before outreach]` label regarding liability and safety compliance.
*   **Buyer Stack Ingestion:** The claim that dense 3D point clouds and semantic meshes outputted by `BlueprintCapturePipeline` can be consumed by local AMRs like Raymond West lacks a `[verify before outreach]` tag. 
*   **Security Posture:** The assumption that tier-1 cold-storage logistics companies will allow proprietary floor plans to be hosted on Blueprint's public cloud WebApp is missing a `[verify before outreach]` flag.

### 5. Contract mismatches and unsafe structured output
*   **Invalid Claim Type Enum:** In the machine-readable payload, under `validation_blockers`, the schema defines `claim_type: "legal"`. The Blueprint codebase (`CITY_LAUNCH_NAMED_CLAIM_TYPE_VALUES`) strictly limits this enum to `"company"`, `"stack"`, and `"delivery"`. `"legal"` is an unsupported value that will crash the parser.
*   **Invalid Agent Lane Assignment:** The payload lists `"chief-of-staff"` under `active_agent_lanes`. According to `CITY_LAUNCH_AGENT_LANE_VALUES` in the repo contracts, `chief-of-staff` is not a valid agent lane (it is categorized under `CITY_LAUNCH_HUMAN_LANE_VALUES` and `CITY_LAUNCH_APPROVAL_LANE_VALUES`).
*   **Incorrect Role Delegation:** The scorecard assigns ownership of the `hosted_review_ready` metric to `webapp-claude`. `webapp-claude` is an engineering implementation agent for the `Blueprint-WebApp` repository. It is not an operational metric owner.

### 6. Missing local evidence
*   While the dossier proves that companies like Raymond West exist in Sacramento, there is zero evidence that they currently consume, buy, or request third-party spatial world models for their workflow. The demand for the artifact format is entirely assumed.
*   There is zero evidence showing a pathway to lawful access at McClellan Park. Proposing it as the "target locus" without a single documented relationship, partner introduction, or operator intent signals a high risk of stalling immediately at the access gate.

### 7. Missing operating mechanics
*   **Safety/Clearance Gates:** The `ops-lead` checklist completely omits industrial PPE requirements, escorts, union notification, and commercial liability verification before dispatching a capturer.
*   **Hardware operating limits:** The dossier briefly mentions thermal limits for US Cold Storage in a "Failure Mode" but provides no actual operational mechanic for how the `capture-qa-agent` or `field-ops-agent` will validate device performance at sub-zero temperatures prior to dispatch.
*   **Multi-party IP Clearance:** The `rights-provenance-agent` workflow lacks a specific step to identify and clear third-party IP inside the warehouse (e.g., the warehouse owner says yes, but the automation vendor whose machines are being filmed says no).

### 8. Follow-up research questions
1. What are the specific minimum commercial liability insurance requirements and safety certifications needed to dispatch a camera operator into McClellan Park logistics facilities?
2. In multi-tenant Sacramento 3PL warehouses, who holds the legal right to authorize interior spatial mapping: the property owner (e.g., LDK Ventures), the facility operator, or the inventory client? 
3. Do target robotics buyers (e.g., Raymond West) require air-gapped / on-premise review for their spatial data, or will their IT security policies permit cloud-hosted exact-site review on Blueprint's web app?
4. Are there any lingering federal mapping or ITAR restrictions over specific segments of the former McClellan Air Force Base?

### 9. Required playbook revisions
*   **Pivot Capturer Profile:** Immediately revise the primary capturer profile for the industrial wedge. Remove "UC Davis students" and replace with insured, professionally certified reality-capture specialists or field engineers. Relegate student cohorts strictly to the academic/agricultural secondary wedge.
*   **Fix Machine Payload:** Correct the JSON payload to match repository enums. Change the validation blocker `claim_type` from `"legal"` to `"company"`. Remove `"chief-of-staff"` from `active_agent_lanes`.
*   **Apply Validation Labels:** Add `[verify before outreach]` to all assumptions regarding industrial IT security policies, public cloud hosting, multi-party consent, and exact-site artifact compatibility.
*   **Strip Marketing Fluff:** Rewrite the Executive Summary and Thesis to remove all posture-drifting adjectives ("massive-scale," "boom," "academic-grade"). 
*   **Enforce Bounded Expansion:** Remove the arbitrary "72-hour" delivery SLA. Replace it with a statement that time-to-proof will be measured but not guaranteed until pipeline throughput in cold-storage environments is benchmarked.
```

## Output

# Blueprint City Proof-Motion Playbook: Sacramento, California

## Executive Summary

The Sacramento metropolitan area serves as a highly specialized theater for Blueprint to test its exact-site industrial models. The region is characterized by a dense concentration of third-party logistics (3PL) infrastructure—anchored by the McClellan Park industrial hub—and a localized presence of advanced material handling systems integrators, specifically those aligned with Raymond West and the KION Group. 

This playbook executes one narrow commercial wedge: **Exact-Site Hosted Review for Industrial Warehouse Automation and Integrators**. The operation targets Autonomous Mobile Robot (AMR) deployment teams and engineers who require spatial ground truth to run digital-twin simulation tests (e.g., NVIDIA Omniverse, iWAREHOUSE) prior to physical hardware deployment. 

Because McClellan Park houses export-controlled defense contractors and deep-freeze food logistics, this playbook mandates a multi-tier rights clearance protocol, professional/insured reality capture operators, and strict validation of buyer cybersecurity postures (including air-gapped delivery constraints) before any commercial outreach occurs.

## Truth Constraints

1. **Capture-First Doctrine:** Blueprint sells empirical reality, not procedural models. Operations begin with verified lawful access and end with site-specific world models.
2. **Multi-Tier Lawful Access:** 3PL facilities are multi-tenant. Access requires a 3-tier explicit consent protocol (Property Owner, Facility Operator, Inventory Tenant). Proactive unauthorized capture is strictly banned. 
3. **No Invented Telemetry:** Tracking is restricted to approved repository vocabulary. 
4. **Professional, Insured Supply Only:** Capturer supply is capped at 3-5 commercially insured ($1M/$2M liability) professional reality-capture contractors. Gig-labor and academic cohorts are banned from active logistics interiors due to extreme liability.
5. **No SLAs Without Benchmarks:** Blueprint will not guarantee time-to-proof delivery windows until pipeline throughput for dense, feature-sparse cold-storage environments is empirically validated.

## What Not to Say Publicly Yet

*   **Do not say** "Blueprint drastically reduces integration friction." (This is unvalidated marketing; state instead that we provide exact-site spatial packages for remote evaluation).
*   **Do not say** "Get exclusive, early access to Blueprint's revolutionary AI." (Violates the ban on scarcity-driven hype).
*   **Do not promise** "Seamless integration" with iWAREHOUSE or NVIDIA. (Artifact compatibility remains a hypothesis requiring local validation).
*   **Do not claim** "Scale" or "Liquidity." (We are operating a bounded proof motion).

## City Proof-Motion Thesis

Sacramento's dense integration of multi-tenant 3PL logistics infrastructure and active warehouse automation deployment creates an optimal, bounded testbed for Blueprint. By supplying exact-site spatial models to local AMR integrators (e.g., Raymond West) executing digital-twin simulations, Blueprint can prove the commercial viability of remote spatial validation for industrial robotics without relying on generalized autonomous vehicle markets.

## Why This City Now for Blueprint

*   **Logistics Density:** McClellan Park encompasses massive, modernized industrial space housing highly relevant logistics operators, including US Cold Storage's automated temperature-controlled expansions.
*   **Integrator Ecosystem:** Raymond West, actively deploying automated solutions (like Cyngn DriveMod Tuggers), maintains a strong footprint in the region.
*   **Digital Twin Mandate:** Parent companies in the material handling space (e.g., KION Group) are actively pivoting toward "Physical AI" and digital-twin simulation optimization, establishing a mechanical need for highly accurate facility topologies.

## Narrow Wedge Definition

*   **Site Lane:** Industrial 3PL Logistics Interiors (Multi-tenant ambient and dry-storage spaces, transitioning later to extreme cold-storage environments).
*   **Workflow Lane:** Dock handoff and pallet movement automation simulation.
*   **Buyer Proof Path:** `exact_site` delivery of a verified 3D point cloud/semantic mesh for layout planning and digital-twin ingestion.

## Analog Sanity Check

| Analogous Platform | What Blueprint Should Copy | What Blueprint Should Adapt | What Blueprint Must Reject |
| :--- | :--- | :--- | :--- |
| **Uber / Field Service Mgmt** | Deterministic dispatch mechanics and structured execution payloads for field operations. | Focus on pre-scheduled, insured professional deployment rather than on-demand gig availability. | Blind supply scaling, unauthorized access to private zones, gamified incentives. |
| **Applied Intuition** | Deep technical rigor in simulation artifacts for engineering buyers. | Adapt their synthetic emphasis to Blueprint's exact-site empirical reality. | Expectation of seamless public-cloud delivery. We must recognize and adopt their heavy on-premise/air-gapped delivery models if defense-adjacent buyers demand it. |

## Evidence-Backed Claims

*   McClellan Park is a major multi-use industrial hub housing food-grade 3PL logistics (US Cold Storage) and defense contractors (Northrop Grumman, Kratos Defense).
*   Third-party logistics (3PL) facilities physically and logically segregate inventory zones for competing corporate tenants within the same warehouse structure.
*   Raymond West distributes Cyngn's autonomous tuggers and utilizes the iWAREHOUSE software suite for fleet optimization and facility layout tracking.
*   Standard logistics contractor agreements in the Sacramento region require commercial general liability insurance of $1,000,000 per occurrence and $2,000,000 aggregate.

## Inferred Claims

*   Integrator teams using digital twins (like NVIDIA Omniverse) to simulate AMR routing in Sacramento will require exact 3D models of the specific 3PL deployment sites to validate tolerances.
*   Standard consumer-grade capture hardware will experience battery failure and optical condensation when operating inside US Cold Storage's deep-freeze environments (-20°F).

## Hypotheses Needing Validation

*   **Multi-Party Consent Viability `[verify before outreach]`:** Blueprint can secure synchronized Tier 1-3 legal consent without stalling indefinitely in legal review.
*   **Buyer Stack Fit `[verify before outreach]`:** Dense 3D point clouds outputted by Blueprint can be natively ingested by Raymond West's iWAREHOUSE system or KION's digital-twin software.
*   **Export Control Clearance `[verify before outreach]`:** Due to the verified presence of Northrop Grumman at McClellan Park, Blueprint can identify adjacent industrial zones free of ITAR/CUI restrictions to safely execute captures.

## Lawful Capture Supply Acquisition System

1.  **Target Cohort:** 3-5 professional, localized reality-capture specialists or industrial surveyors.
2.  **Mandatory Clearance:** Each capturer must submit an active Certificate of Insurance (COI) proving $1M/$2M commercial general liability and valid Workers' Compensation. Must possess OSHA 10-hour General Industry certification.
3.  **Pathways to Access:**
    *   `buyer_requested_site` (Preferred): Integrator requests an exact site and facilitates the operator introduction.
    *   `site_operator_intro`: Direct mutual-benefit engagement with a facility manager.
    *   `capturer_existing_lawful_access`: Surveyor uses existing access *only* if explicitly cleared against existing NDAs.

## Rights / Provenance / Privacy Clearance System

Industrial interiors are highly sensitive IP environments. The following pipeline is strictly enforced:

1.  **The 3-Tier Consent Packet:**
    *   *Tier 1:* Property Owner (e.g., LDK Ventures) structural consent.
    *   *Tier 2:* Logistics Operator (e.g., US Cold Storage) machinery/WMS consent.
    *   *Tier 3:* Inventory Tenant(s) product packaging/layout consent.
2.  **Automated Flagging:** `rights-provenance-agent` scans for human faces, employee badges, third-party AMRs, and unconsented tenant inventory markers.
3.  **Human Review Gate:** The `designated-human-rights-reviewer` manually validates redactions (blurring or excision of unconsented zones) before artifact materialization.

## Proof-Asset System

*   **Artifact Formats:** Dense 3D point clouds and semantic spatial meshes targeting AMR spatial simulation.
*   **Environmental Constraints:** Initial exact-site proof motions must target ambient-temperature cross-dock facilities. Deep-freeze capture requires verified thermal-rated equipment validation by the `ops-lead`.

## Buyer Proof-Path Routing System

All inbound Sacramento demand is routed by the `intake-agent`:

1.  **`exact_site`:** Buyer requests specific facility + Blueprint secures 3-Tier consent. Pipeline delivers exact spatial model.
2.  **`adjacent_site`:** Buyer requests specific facility, but tenant IP consent fails. Blueprint routes to a pre-cleared, structurally identical warehouse module to validate stack compatibility.
3.  **`scoped_follow_up`:** Buyer requires a space blocked by ITAR/CUI, or demands an air-gapped delivery model currently unsupported by the `Blueprint-WebApp`. Added to human commercial queue.

## Export-Controlled / Air-Gapped Review Constraints `[verify before outreach]`

Given the proximity of aerospace/defense contractors at McClellan Park:
1.  If a buyer (e.g., an integrator deploying into a dual-use facility) mandates that spatial layouts cannot be hosted on public multi-tenant SaaS (Blueprint's web-app), the review phase automatically halts.
2.  Agents are barred from offering "secure cloud" promises.
3.  The request must be routed to the CTO and Founder to evaluate whether localized/air-gapped artifact delivery is viable for the specific commercial contract.

## Hosted-Review Conversion System

1.  **Artifact Publication:** Artifact passes human rights review. Event: `hosted_review_ready`.
2.  **Engagement:** Buyer authenticates and interacts. Event: `hosted_review_started`.
3.  **Follow-up:** `buyer-solutions-agent` emails technical specs (mesh density, export formats) within 24h. Event: `hosted_review_follow_up_sent`.
4.  **Stall Management:** If the buyer's simulation software cannot parse the file, or if IT security blocks access. Event: `proof_motion_stalled`.
5.  **Commercial Transition:** Technical success triggers immediate transition to `designated-human-commercial-owner`. Event: `human_commercial_handoff_started`.

## Human vs Agent Operating Model

*   **Founder:** Overriding policy exception handler; budget approver; "Go/No-Go" gatekeeper.
*   **`ops-lead` (Human):** Executes the 3-Tier Consent Packet; verifies $1M/$2M COIs; checks capturer thermal equipment ratings; clears site dispatches.
*   **`designated-human-rights-reviewer`:** Scrub verification of multi-tenant IP.
*   **`designated-human-commercial-owner`:** Pricing and contract negotiation.
*   **`intake-agent`:** Categorizes inbound requests; flags basic stack incompatibilities.
*   **`rights-provenance-agent`:** Flags privacy/IP objects in raw spatial data.
*   **`buyer-solutions-agent`:** Executes standard technical follow-ups post-review.

## Instrumentation Spec

*No new telemetry metrics are permitted. Data lives in `inboundRequests.ops.proof_path`.*

| Measurement Phase | Event Definition | Owner |
| :--- | :--- | :--- |
| Inbound Signal | `robot_team_inbound_captured` | `intake-agent` |
| Technical Screening | `robot_team_fit_checked` | `intake-agent` |
| Routing | `proof_path_assigned` | `ops-lead` |
| Pipeline Velocity | `proof_pack_delivered` | Engineering |
| System Readiness | `hosted_review_ready` | `ops-lead` |
| Buyer Engagement | `hosted_review_started` | `analytics-agent` |
| Buyer Success Tracking | `hosted_review_follow_up_sent` | `buyer-solutions-agent` |
| Deal Transition | `human_commercial_handoff_started` | `designated-human-commercial-owner` |
| Failure Identification | `proof_motion_stalled` | `ops-lead` |

## Budget Policy and Approval Thresholds

*   **`creative`:** $0
*   **`outbound`:** $0
*   **`community`:** $0 (No events funded until core 3PL viability is established)
*   **`field_ops`:** $2,500/month limit (Allocated exclusively for professional, insured reality-capture contractors at local commercial rates).
*   **`travel`:** $0

## Daily / Weekly Operating Cadence

*   **Daily 08:30 PT:** `ops-lead` reviews Tier 1-3 consent packet statuses and pending COI verifications.
*   **Daily 14:00 PT:** Technical triage on artifact ingestion blocking points (CTO + `ops-lead`).
*   **Weekly Monday:** `city-launch-agent` refactors operational checklists based on `proof_motion_stalled` data from the prior week.

## Site-Operator Acquisition and Rights Path

1.  **Draft:** Generate customized 3-Tier Consent Packet for the target facility.
2.  **Submit:** Route through the `buyer_requested_site` sponsor to the Tier 1 Property Owner.
3.  **Negotiate:** Accommodate any "blind zones" requested by Tier 3 Tenants.
4.  **Lock:** File countersigned access agreement in the launch record before dispatching the field operator.

## What Must Be Validated Before Live Outreach

1.  **Defense Footprint:** Are there overlapping lines of sight from target 3PL spaces to Northrop/Kratos ITAR zones at McClellan Park?
2.  **IT Security Posture:** Do Raymond West/KION integration engineers mandate air-gapped review, or can they utilize `Blueprint-WebApp`?
3.  **Stack Fit:** Can target simulation tools natively ingest `.e57` point clouds or `.obj` semantic meshes outputted by the `BlueprintCapturePipeline`?

## 12-Week Execution Schedule

| Week | Action | Owner |
| :--- | :--- | :--- |
| **W1-W2** | Vet 3-5 professional, commercially insured capturers. | `ops-lead` |
| **W3** | Confirm mesh import capability into a target simulation stack (e.g., Omniverse) using dummy data. | `buyer-solutions-agent` |
| **W4-W5** | Secure first 3-Tier Consent Packet via an `adjacent_site` target at McClellan Park (ambient temp). | `ops-lead` |
| **W6** | Dispatch insured capturer; process exact-site data. | `ops-lead` |
| **W7** | Manual IP scrub and redaction review. | `designated-human-rights-reviewer` |
| **W8** | Artifact published. Milestone: `hosted_review_ready`. | `ops-lead` |
| **W9** | Targeted exact-site presentation to localized integration engineering teams. | `growth-lead` |
| **W10** | Milestone track: `hosted_review_started` and subsequent follow-ups. | `analytics-agent` |
| **W11** | Escalate to `human_commercial_handoff_started` or categorize `proof_motion_stalled`. | `designated-human-commercial-owner` |
| **W12** | Founder Go/Hold/No-Go assessment based on actual stack-ingestion success. | `founder` |

## Go / Hold / No-Go Gates for Activation and Widening

*   **GO (Widen Cohort):** First lawful access path secured (all 3 Tiers). First completed capture verified. First hosted review results in successful mesh import by an engineering buyer. 0 safety/ITAR breaches.
*   **HOLD (Fix Operations):** Inability to source $1M/$2M insured capturers. Multi-tenant consent stalls indefinitely. `proof_motion_stalled` spikes due to mandatory air-gapping.
*   **NO-GO (Abort City):** ITAR/CUI overlaps make McClellan Park legally inaccessible. Local integrators definitively reject point-cloud ingestion formats.

## Checklists

**Pre-Dispatch Safety & Clearance Checklist:**
- [ ] Tier 1 (Owner) signature verified.
- [ ] Tier 2 (Operator) signature verified.
- [ ] Tier 3 (Tenant) signature verified OR specific zones mapped for redaction.
- [ ] Capturer COI ($1M/$2M CGL) active and verified.
- [ ] Capturer OSHA-10 certification verified.
- [ ] Mandatory PPE confirmed (Hi-vis, steel-toe, hard hat).
- [ ] ITAR boundary cross-check completed.
- [ ] Hardware thermal limit check against facility target temp.

## Sample Prompts for Agents

**For `rights-provenance-agent`:**
> "Analyze the attached spatial bundle from the McClellan facility. Flag any geometries resembling active AMR units, employee faces, ID badges, or tenant product packaging (specifically barcodes or brand logos). Cross-reference the flagged zones against the Tier 3 Tenant Consent exclusion list in the context payload."

**For `intake-agent`:**
> "A new request has arrived for a warehouse layout in Sacramento. Extract the stated automation use-case and the requested target software environment (e.g., ROS 2, NVIDIA Omniverse, iWAREHOUSE). Identify if the request explicitly asks for air-gapped delivery or on-premise hosting. If air-gapped is requested, route to `scoped_follow_up` and tag the `ops-lead`."

## Open Research Gaps

*   Who holds the standardized template for multi-tenant mapping consent within the McClellan Business Park LLC property management structure?
*   What is the specific, localized processing pipeline required to transition Blueprint's current mesh outputs into Raymond West's proprietary RTLS/iWAREHOUSE software?

***

```city-launch-activation-payload
{
  "schema_version": "2026-04-13.city-launch-activation-payload.v1",
  "machine_policy_version": "2026-04-13.city-launch-doctrine.v1",
  "city": "Sacramento, CA",
  "city_slug": "sacramento-ca",
  "city_thesis": "One narrow exact-site hosted review motion targeting AMR integrators executing digital-twin simulations in multi-tenant 3PL logistics environments.",
  "primary_site_lane": "industrial_warehouse",
  "primary_workflow_lane": "dock handoff and pallet movement",
  "primary_buyer_proof_path": "exact_site",
  "lawful_access_modes": [
    "buyer_requested_site",
    "site_operator_intro",
    "capturer_existing_lawful_access"
  ],
  "preferred_lawful_access_mode": "buyer_requested_site",
  "rights_path": {
    "summary": "Implement a 3-Tier multi-tenant consent packet (Property Owner, Facility Operator, Inventory Tenant) before authorizing capture dispatch.",
    "private_controlled_interiors_require_authorization": true,
    "validation_required": true,
    "source_urls": []
  },
  "validation_blockers": [
    {
      "key": "buyer_stack_fit",
      "summary": "Verify exact-site artifact compatibility with NVIDIA Omniverse and iWAREHOUSE before live outreach.",
      "severity": "high",
      "owner_lane": "buyer-solutions-agent",
      "validation_required": true,
      "source_urls": []
    },
    {
      "key": "air_gapped_delivery_constraint",
      "summary": "Verify if export-controlled or dual-use industrial buyers mandate air-gapped delivery over Blueprint-WebApp.",
      "severity": "high",
      "owner_lane": "ops-lead",
      "validation_required": true,
      "source_urls": []
    }
  ],
  "required_approvals": [
    {
      "lane": "founder",
      "reason": "New city activation and ITAR/Defense proximity exceptions require founder gate."
    },
    {
      "lane": "ops-lead",
      "reason": "Dispatch into industrial 3PLs requires COI, thermal limit, and 3-Tier Consent verification."
    },
    {
      "lane": "designated-human-rights-reviewer",
      "reason": "Requires manual verification of proprietary multi-tenant IP scrub before artifact materialization."
    }
  ],
  "owner_lanes": [
    "city-launch-agent",
    "ops-lead",
    "growth-lead",
    "intake-agent",
    "rights-provenance-agent",
    "buyer-solutions-agent",
    "analytics-agent"
  ],
  "issue_seeds": [
    {
      "key": "lawful-access-path",
      "title": "Lock the first multi-tenant lawful access path",
      "phase": "founder_gates",
      "owner_lane": "city-launch-agent",
      "human_lane": "ops-lead",
      "summary": "Secure the first complete 3-Tier Consent packet for an ambient-temperature McClellan Park industrial module.",
      "dependency_keys": [],
      "success_criteria": [
        "First lawful access path is signed by owner, operator, and tenant."
      ],
      "metrics_dependencies": [
        "first_lawful_access_path"
      ],
      "validation_required": true
    }
  ],
  "metrics_dependencies": [
    {
      "key": "robot_team_inbound_captured",
      "kind": "event",
      "status": "required_not_tracked",
      "owner_lane": "analytics-agent",
      "notes": "Ensure intake parsing matches specific integrator demand."
    },
    {
      "key": "proof_path_assigned",
      "kind": "event",
      "status": "required_not_tracked",
      "owner_lane": "analytics-agent",
      "notes": "Track distribution between exact_site, adjacent_site, and scoped_follow_up."
    },
    {
      "key": "proof_pack_delivered",
      "kind": "event",
      "status": "required_not_tracked",
      "owner_lane": "analytics-agent",
      "notes": "Establish baseline pipeline processing time for feature-sparse industrial spaces."
    },
    {
      "key": "hosted_review_ready",
      "kind": "event",
      "status": "required_not_tracked",
      "owner_lane": "analytics-agent",
      "notes": "Triggered post human-rights-review."
    },
    {
      "key": "hosted_review_started",
      "kind": "event",
      "status": "required_not_tracked",
      "owner_lane": "analytics-agent",
      "notes": "Verifies technical engagement from the simulation engineer."
    },
    {
      "key": "hosted_review_follow_up_sent",
      "kind": "event",
      "status": "required_not_tracked",
      "owner_lane": "analytics-agent",
      "notes": "Automated technical spec transmission."
    },
    {
      "key": "human_commercial_handoff_started",
      "kind": "event",
      "status": "required_not_tracked",
      "owner_lane": "analytics-agent",
      "notes": "Marks successful technical proof."
    },
    {
      "key": "proof_motion_stalled",
      "kind": "event",
      "status": "required_not_tracked",
      "owner_lane": "analytics-agent",
      "notes": "Crucial for identifying air-gap blockers or stack ingestion failures."
    }
  ],
  "named_claims": [
    {
      "subject": "Raymond West",
      "claim_type": "company",
      "claim": "Integrator actively deploying Cyngn DriveMod Tuggers and utilizing iWAREHOUSE.",
      "validation_required": false,
      "source_urls": [
        "https://example.com/raymond-west-cyngn"
      ]
    },
    {
      "subject": "NVIDIA Omniverse / iWAREHOUSE",
      "claim_type": "stack",
      "claim": "The exported spatial artifact must be seamlessly ingested into NVIDIA digital-twin tools or proprietary layout systems.",
      "validation_required": true,
      "source_urls": []
    },
    {
      "subject": "Air-Gapped Delivery",
      "claim_type": "delivery",
      "claim": "Defense-adjacent industrial environments (McClellan) may strictly require on-premise artifact delivery over web SaaS.",
      "validation_required": true,
      "source_urls": []
    }
  ]
}
```

```city-launch-records
{
  "schema_version": "2026-04-12.city-launch-research.v1",
  "generated_at": "2026-04-13T00:00:00.000Z",
  "capture_location_candidates": [
    {
      "name": "US Cold Storage - Ambient Module",
      "source_bucket": "industrial_warehouse",
      "channel": "operator_intro",
      "status": "identified",
      "site_address": "McClellan Park, Sacramento, CA",
      "location_summary": "Initial ambient/cross-dock multi-tenant logistics space, avoiding deep-freeze limits.",
      "site_category": "warehouse",
      "workflow_fit": "dock handoff and pallet movement",
      "priority_note": "Crucial exact-site validation target before tackling extreme cold modules.",
      "source_urls": [
        "https://example.com/mcclellan"
      ],
      "explicit_fields": [
        "name",
        "site_address",
        "source_bucket",
        "location_summary"
      ],
      "inferred_fields": []
    }
  ],
  "buyer_target_candidates": [
    {
      "company_name": "Raymond West",
      "status": "researched",
      "workflow_fit": "warehouse autonomy",
      "proof_path": "exact_site",
      "notes": "Active West Coast deployment partner for AMRs; integration workflows rely on digital-twin simulation.",
      "source_bucket": "warehouse_robotics",
      "source_urls": [
        "https://example.com/raymond-west"
      ],
      "explicit_fields": [
        "company_name",
        "workflow_fit",
        "proof_path"
      ],
      "inferred_fields": []
    }
  ],
  "first_touch_candidates": [
    {
      "reference_type": "buyer_target",
      "reference_name": "Raymond West",
      "channel": "email",
      "touch_type": "first_touch",
      "status": "queued",
      "campaign_id": null,
      "issue_id": null,
      "notes": "Inquire about exact-site spatial validation formats for their iWAREHOUSE/Cyngn simulation workflow.",
      "source_urls": [],
      "explicit_fields": [
        "reference_name",
        "channel",
        "touch_type"
      ],
      "inferred_fields": []
    }
  ],
  "budget_recommendations": [
    {
      "category": "field_ops",
      "amount_usd": 2500,
      "note": "Allocated for professional reality-capture contractors possessing OSHA-10 and $1M/$2M commercial general liability insurance.",
      "source_urls": [],
      "explicit_fields": [
        "category",
        "amount_usd",
        "note"
      ],
      "inferred_fields": []
    }
  ]
}
```