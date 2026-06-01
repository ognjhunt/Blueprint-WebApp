# Blueprint Growth Research Swarm Operating Model

Date: 2026-05-31
Status: local draft, read-only research design, no-send, no-Notion, no-live-system mutation
Owner lane: `growth-lead`
Execution posture: draft-only subagent prompts for market and supply research. This artifact does not dispatch Paperclip agents, update CRM, write Notion, send Slack/email, clear rights, mutate Firebase/Stripe/Render/Redis/Paperclip, or claim live operational readiness.

## Purpose

Design a multi-agent read-only research swarm for Blueprint growth.

The swarm should help Blueprint decide which buyer demand, robot-team, exact-site, supply, competitor, and procurement/security research deserves follow-up inside the current Exact-Site Hosted Review wedge.

The swarm is a support layer. It is not a growth automation executor, outbound system, source of recipient truth, rights reviewer, procurement responder, city-launch proof source, or hosted-session fulfillment system.

## Doctrine Boundary

Blueprint-WebApp is the buyer, licensing, ops, and hosted-access surface for capture-backed site-specific world-model products. Growth research must keep the product story capture-first and world-model-product-first.

This swarm may research:

- robot-team demand signals
- exact-site workflow and facility categories
- current digital twin, robotics simulation, and reality-capture competitors
- supply and capturer marketplace patterns
- security/procurement expectations for enterprise buyers

This swarm must not claim:

- real customer traction
- active city coverage
- capture supply readiness
- cleared rights
- guaranteed package access
- hosted-session fulfillment
- payment, payout, or provider execution
- procurement, certification, DPA, SLA, or legal posture

## Operating Principles

1. Start from repo doctrine and current Paperclip growth programs before web research.
2. Use web research only for current external context, primary-source discovery, and source verification.
3. Every claim in every lane must map to a source ledger row.
4. Every ledger row must say what it proves and what it does not prove.
5. Research outputs are draft artifacts until a human owner chooses an action.
6. No lane may infer recipient data, contact readiness, rights, permission, pricing, contract terms, or live availability.
7. Weak evidence remains weak. Agents must label `evidence`, `inference`, and `missing`.
8. Synthesis should produce fewer, better follow-up candidates rather than generic market commentary.

## Swarm Shape

The swarm has six independent research lanes plus one synthesis/review lane.

| Lane | Primary repo owner | Research question | Draft output |
| --- | --- | --- | --- |
| Buyer demand | `demand-intel-agent` | Which current robot-team signals imply a real need for exact-site proof, hosted review, data licensing, or capture asks? | `buyer-demand-brief.md` |
| Robot teams | `robot-team-growth-agent` | Which robot-team segments and workflows should the Exact-Site Hosted Review motion prioritize? | `robot-team-segment-matrix.md` |
| Exact-site categories | `city-demand-agent` plus `market-intel-agent` | Which facility/site categories are most likely to create high-quality exact-site demand and capture priority? | `exact-site-category-map.md` |
| Supply/capturer opportunities | `supply-intel-agent` plus `capturer-growth-agent` | Which supply pools, channel mechanics, and trust gates should Blueprint test before widening top-of-funnel recruiting? | `capturer-opportunity-map.md` |
| Competitor positioning | `market-intel-agent` | Which competitors or substitutes shape buyer expectations around capture, digital twins, simulation, and spatial/world models? | `competitor-positioning-map.md` |
| Procurement/security needs | `security-procurement-agent` | Which evidence packets will enterprise buyers ask for before they can inspect or buy Blueprint outputs? | `procurement-security-needs.md` |
| Synthesis and review | `growth-lead` with `blueprint-cto` gate for security/architecture | Which findings should become draft-only issues, playbook updates, proof-pack requirements, or blocked gaps? | `growth-swarm-synthesis.md` |

Recommended run folder:

```text
docs/research/growth-swarm/YYYY-MM-DD-<slug>/
  README.md
  source-ledger.json
  source-ledger.md
  buyer-demand-brief.md
  robot-team-segment-matrix.md
  exact-site-category-map.md
  capturer-opportunity-map.md
  competitor-positioning-map.md
  procurement-security-needs.md
  growth-swarm-synthesis.md
  review-gates.md
```

Do not write into `knowledge/`, Notion, Paperclip issues, or GTM ledgers during this read-only swarm unless a later explicitly authorized run changes the scope.

## Deterministic Source Ledger

Every subagent writes ledger entries into the shared `source-ledger.json`. Agents may also render `source-ledger.md` for humans, but JSON is the deterministic source.

### Ledger Schema

```json
{
  "schemaVersion": "blueprint.growthResearchSourceLedger.v0.1",
  "preparedAt": "YYYY-MM-DD",
  "draftOnly": true,
  "externalSendAuthorized": false,
  "liveMutationAuthorized": false,
  "sources": [
    {
      "sourceId": "local:platform-context:20260531",
      "lane": "buyer_demand",
      "sourceType": "repo_doc | repo_code | repo_artifact | web_primary | web_secondary | generated_report",
      "title": "Source title",
      "pathOrUrl": "relative path or https URL",
      "publisher": "repo | company | standards_body | trade_association | publication",
      "accessedAt": "YYYY-MM-DD",
      "publishedAt": "YYYY-MM-DD or unknown",
      "lineRange": "optional for local files",
      "evidenceClass": "doctrine | operating_contract | market_context | competitor_positioning | buyer_signal | supply_signal | security_framework | procurement_context",
      "summary": "short neutral paraphrase",
      "proves": ["specific supported fact"],
      "doesNotProve": ["specific facts this source must not be used to claim"],
      "freshness": "current | recent | historical | stale | unknown",
      "status": "accepted | rejected | needs_verification | human_gated"
    }
  ],
  "claims": [
    {
      "claimId": "claim-001",
      "lane": "buyer_demand",
      "claimText": "narrow claim text",
      "claimClass": "allowed_context | inference | blocked_operational_claim | missing_evidence",
      "sourceRefs": ["sourceId"],
      "allowedUse": "how the claim may be used in draft outputs",
      "blockedUse": "how it must not be used"
    }
  ]
}
```

### Source Id Rule

Use deterministic IDs:

- Local source: `local:<path-slug>:<yyyymmdd>`
- Web source: `web:<domain-slug>:<page-slug>:<yyyymmdd>`
- Generated report: `generated:<artifact-slug>:<yyyymmdd>`

Never use auto-increment IDs that depend on agent order.

### Required Ledger Fields By Lane

| Lane | Minimum accepted source rows | Required source mix |
| --- | ---: | --- |
| Buyer demand | 12 | repo doctrine, demand program, robot-team playbook, at least 5 current web sources, at least 2 primary robot/company/association sources |
| Robot teams | 10 | robot-team playbook, exact-site GTM program, at least 4 robot-company or automation ecosystem sources |
| Exact-site categories | 10 | city-demand program, capturer playbook, at least 5 facility/workflow sources, no city-live inference |
| Supply/capturer opportunities | 12 | supply/capturer programs, capturer playbook, at least 5 marketplace/supply sources, explicit quality/trust/fraud notes |
| Competitor positioning | 12 | market-intel program, at least 6 primary company/product pages, no traction claims without primary proof |
| Procurement/security needs | 10 | security-procurement program/factory, deployment/source-of-truth docs, at least 2 standards/questionnaire sources |

## Repo Source Ledger Seed

These local sources were read for this design run and should be copied into future swarm ledgers when relevant.

| Source id | Path | Evidence class | Proves | Does not prove |
| --- | --- | --- | --- | --- |
| `local:agents-root:20260531` | `AGENTS.md` | doctrine | Read order, product rules, public vs operational launch boundaries, no live side effects without authorization. | Current live readiness, rights, payments, hosted-session fulfillment, or Paperclip state. |
| `local:platform-context:20260531` | `PLATFORM_CONTEXT.md` | doctrine | Blueprint is capture-first and world-model-product-first; robot teams are core buyers; site operators are optional third lane. | Any specific capture, package, rights, or buyer fact. |
| `local:world-model-strategy:20260531` | `WORLD_MODEL_STRATEGY_CONTEXT.md` | doctrine | Blueprint should build around capture supply, rights/provenance-safe pipelines, site-specific packages, hosted access, and provider-swappable runtime contracts. | Provider execution or model quality for any target. |
| `local:autonomous-org:20260531` | `AUTONOMOUS_ORG.md` | org doctrine | Growth is anchored to Exact-Site Hosted Review; Paperclip is execution record; repo docs are definitional truth; Notion is visibility/review. | Permission to mutate Paperclip, write Notion, or send outreach. |
| `local:source-of-truth-map:20260531` | `docs/architecture/source-of-truth-map.md` | source boundary | Repo doctrine, Paperclip, Notion, Firestore, Stripe, Redis, Render, Capture, and Pipeline truth boundaries. | Live state from local docs alone. |
| `local:command-safety-matrix:20260531` | `docs/architecture/command-safety-matrix.md` | command safety | Which commands are local/read-only versus side-effect capable. | Permission to run live commands in this swarm. |
| `local:claims-matrix:20260531` | `docs/architecture/public-display-ready-claims-matrix.md` | claim guardrail | Public Launch Ready can be polished while operational facts need owner-system proof. | Operational Launch Ready proof. |
| `local:ai-tooling-adoption:20260531` | `docs/ai-tooling-adoption-implementation-2026-04-07.md` | tooling doctrine | Reuse current stack; growth loops must stay proof-led and wedge-specific; no generic trend-content center. | Approval for new services or architecture drift. |
| `local:ai-skills-governance:20260531` | `docs/ai-skills-governance-2026-04-07.md` | tooling governance | AI tools are support layers; Parallel Search MCP is read-only enrichment and cannot become capture/rights/recipient/readiness truth. | New service approval, live claims, or workspace mutation. |
| `local:parallel-search-policy:20260531` | `ops/paperclip/programs/parallel-search-mcp-policy.md` | web research policy | Web search/fetch order, agent access, source requirements, truth boundaries, cadence caps. | Product truth, contact proof, rights, or operational proof. |
| `local:demand-intel-program:20260531` | `ops/paperclip/programs/demand-intel-agent-program.md` | operating contract | Demand research should focus on technical-buyer demand for site-specific evidence-grounded products. | Pricing, contracts, procurement judgment, or outreach. |
| `local:robot-team-growth-program:20260531` | `ops/paperclip/programs/robot-team-growth-agent-program.md` | operating contract | Robot-team playbook must lead with exact-site package value, proof packs, hosted review, and measurable funnel stages. | Live sends, customer traction, or model capability claims. |
| `local:robot-team-playbook:20260531` | `ops/paperclip/playbooks/robot-team-demand-playbook.md` | playbook | ICP, proof-pack requirements, hosted-review standard, 24-hour proof-path target, source-tag discipline. | Buyer-specific proof or procurement support. |
| `local:exact-site-gtm-program:20260531` | `ops/paperclip/programs/exact-site-hosted-review-gtm-pilot-program.md` | operating contract | Two-track GTM motion, ledger requirements, daily done condition, scale gate, human gates. | Live sends, paid spend, pricing, rights, or public posts. |
| `local:supply-intel-program:20260531` | `ops/paperclip/programs/supply-intel-agent-program.md` | operating contract | Supply research should study marketplace supply playbooks, first 25-100 workers, channels, trust, fraud, and incentives. | Compensation policy, legal classification, or guaranteed earnings. |
| `local:capturer-growth-program:20260531` | `ops/paperclip/programs/capturer-growth-agent-program.md` | operating contract | Capturer growth should feed gated cohorts, trust packets, indoor location source logs, and review-only candidates. | Spend, compensation changes, public posting, or capture readiness. |
| `local:capturer-supply-playbook:20260531` | `ops/paperclip/playbooks/capturer-supply-playbook.md` | playbook | Gated cohorts, professional supply lanes, public-area-only sourcing, trust packet minimums, measurement requirements. | Earnings, work volume, private-interior permission, or rights clearance. |
| `local:market-intel-program:20260531` | `ops/paperclip/programs/market-intel-program.md` | operating contract | Competitor domains to track: capture/digital twins, world-model backends, robot deployment markets, regulatory movement. | Public competitive claims or comprehensive market coverage by itself. |
| `local:city-demand-program:20260531` | `ops/paperclip/programs/city-demand-agent-program.md` | operating contract | City demand plans should tie robot-team clusters to facility/site needs, evidence gaps, and no city-live claims. | City launch readiness or local legal/privacy/rights interpretations. |
| `local:security-procurement-program:20260531` | `ops/paperclip/programs/security-procurement-agent-program.md` | operating contract | Security/procurement responses must answer from real evidence and escalate legal/privacy/rights/certification interpretation. | Compliance posture, certification, legal commitments, or roadmap promises. |
| `local:security-procurement-factory:20260531` | `ops/paperclip/playbooks/security-procurement-evidence-factory.md` | evidence factory | Draft-only procurement packet schema, source ledger requirements, blocked commitments, deterministic claim checks. | External release approval, certification, DPA, live production proof, or buyer-specific rights. |
| `local:autonomous-loop-checklist:20260531` | `docs/autonomous-loop-evidence-checklist-2026-05-03.md` | closeout rule | Required fields before claiming done, blocked, or awaiting human decision. | That this run changed live state or closed any Paperclip issue. |

## Web Source Ledger Seed

These web sources were fetched/read as approved read-only context on 2026-05-31. They are seed sources for future lanes, not product proof.

| Source id | URL | Lane use | Proves | Does not prove |
| --- | --- | --- | --- | --- |
| `web:businesswire-a3:q1-2026-robot-orders:20260531` | `https://www.businesswire.com/news/home/20260511529781/en/Robot-Orders-Hold-Steady-in-Q1-2026-as-Demand-Broadens-Across-Non-Automotive-Industries` | buyer demand, exact-site categories | A3 reported Q1 2026 North American robot orders and described demand broadening beyond automotive into life sciences, electronics, plastics/rubber, food/consumer goods, and collaborative robots. | Blueprint demand, target readiness, buyer urgency, or facility-specific need. |
| `web:ifr:world-robotics-2025-americas:20260531` | `https://ifr.org/downloads/press_docs/2025-09-25-IFR_press_release_Americas_in_English.pdf` | buyer demand, market context | IFR reported 2024 US robot installation/customer-industry context and a positive long-run outlook tied to reshoring and labor scarcity. | Any near-term Blueprint revenue, city readiness, or specific robot-team fit. |
| `web:nvidia:isaac-sim-digital-twin-docs:20260531` | `https://docs.isaacsim.omniverse.nvidia.com/6.0.0/digital_twin/index.html` | robot teams, exact-site categories, competitor positioning | Isaac Sim has digital twin/warehouse logistics tooling, mapping, and robotics simulation context. | Blueprint runtime capability, provider execution, or capture accuracy. |
| `web:nvidia:robotics-simulation-use-case:20260531` | `https://www.nvidia.com/en-us/use-cases/robotics-simulation/` | robot teams, competitor positioning | NVIDIA positions robotics simulation and fleet-level digital twin testing as software-in-the-loop before physical deployment. | That Blueprint integrates with NVIDIA or supports fleet-level testing. |
| `web:matterport:capture-services:20260531` | `https://matterport.com/capture-services` | competitor positioning, supply/capturer | Matterport markets capture services and digital twin creation for business/property contexts, including facilities management. | Robotics-specific world-model quality, Blueprint parity, or rights clearance. |
| `web:matterport:digital-twin-features:20260531` | `https://matterport.com/digital-twin-features` | competitor positioning | Matterport positions a digital twin platform and demo/sales path. | Capture provenance or buyer suitability for Blueprint. |
| `web:navvis:surveying-reality-capture:20260531` | `https://www.navvis.com/industry/surveying` | competitor positioning, supply/capturer | NavVis markets wearable/handheld laser scanning, survey-grade workflows, and industrial facility digital twin use cases. | Blueprint hardware requirements, live site availability, or buyer demand. |
| `web:hexagon:reality-capture:20260531` | `https://hexagon.com/solutions/reality-capture` | competitor positioning, supply/capturer | Hexagon frames reality capture as field-to-finish digital twin workflow for plant facilities, construction, and industrial environments. | Blueprint deliverable quality or operational readiness. |
| `web:polycam:enterprise-solutions:20260531` | `https://poly.cam/solutions` | competitor positioning, supply/capturer | Polycam markets enterprise 3D capture using photogrammetry/LiDAR, smartphone capture, collaboration, user management, and security posture. | That Polycam outputs are valid robotics world models or that Blueprint has enterprise controls. |
| `web:cisco-world-labs:spatial-intelligence-investment:20260531` | `https://investor.cisco.com/files/doc_news/Cisco-Invests-in-Spatial-Intelligence-Pioneer-World-Labs-2025.pdf` | competitor positioning, market context | Cisco described World Labs as developing Large World Models for spatial intelligence and 3D physical-world interaction. | Blueprint backend comparison, customer adoption, or product readiness. |
| `web:kuka:amr-logistics-production:20260531` | `https://www.kuka.com/en-us/products/amr-autonomous-mobile-robotics` | robot teams, exact-site categories | KUKA positions AMRs for intralogistics, production, warehousing, manufacturing, healthcare, and retail. | Buyer demand for Blueprint or exact-site capture priority. |
| `web:boston-dynamics:spot-inspection:20260531` | `https://bostondynamics.com/solutions/inspection` | robot teams, exact-site categories | Boston Dynamics positions Spot for industrial inspection, predictive maintenance, sensing, and facility operations. | Blueprint fit, buyer contact readiness, or deployment readiness. |
| `web:agility:gxo-digit-deployment:20260531` | `https://www.agilityrobotics.com/content/gxo-signs-industry-first-multi-year-agreement-with-agility-robotics` | robot teams, exact-site categories | Agility/GXO announced Digit deployment in logistics operations and a workflow around facility mapping, workflow definition, and fleet management. | Any sales opportunity for Blueprint or exact target contact. |
| `web:massrobotics:amr-interoperability-standard:20260531` | `https://www.massrobotics.org/autonomous-mobile-robot-standards-published-by-massrobotics/` | robot teams, procurement/security | AMR interoperability discussions include shared spaces, fleet managers, JSON/WebSockets, security, firewall, bandwidth, and dashboard needs. | Blueprint standards compliance or integration support. |
| `web:kled:mobile-data-marketplace:20260531` | `https://www.kled.ai/product` | supply/capturer | Kled describes mobile data contribution, photo/video/file upload, curated labeling tasks, dashboards, and earnings tracking. | Legal classification, payout policy, or Blueprint capturer viability. |
| `web:gigwalk:field-task-network:20260531` | `https://www.gigwalk.com/how-it-works/` | supply/capturer | Gigwalk describes field-task creation, GPS matching, execution, real-time insights, validation/compliance, and an on-demand worker network. | Quality for Blueprint captures or legal/compensation policy. |
| `web:premise:contributor-network-qc:20260531` | `https://premise.com/how-premise-works/` | supply/capturer | Premise describes geography-based task distribution, contributor activation, manual/automatic QC, fraud detection, location verification, image analysis, and dashboards. | Blueprint supply quality or rights clearance. |
| `web:cloud-security-alliance:caiq-v4-1:20260531` | `https://cloudsecurityalliance.org/artifacts/star-level-1-security-questionnaire-caiq-v4-1` | procurement/security | CSA CAIQ v4.1 is an industry-accepted way to document cloud controls and give security control transparency for cloud customers/auditors. | Blueprint certification, CAIQ completion, or buyer-specific approval. |
| `web:nist:csf-2-0-release:20260531` | `https://www.nist.gov/news-events/news/2024/02/nist-releases-version-20-landmark-cybersecurity-framework` | procurement/security | NIST CSF 2.0 adds Govern and frames cybersecurity risk management through Govern, Identify, Protect, Detect, Respond, and Recover. | Blueprint controls, compliance, or certification. |

## Subagent Prompt Contract

All lane prompts inherit this system contract:

```text
You are running a read-only Blueprint growth research lane.

Start from the repo docs and Paperclip program files listed in this task. Use approved web research only for current public context and source verification. Do not contact anyone, infer email addresses, update CRM, write Notion, mutate Paperclip, change Firebase/Firestore/Stripe/Render/Redis, run provider jobs, send Slack/email, clear rights, make procurement/legal commitments, or claim operational launch readiness.

For every material claim, write a source-ledger entry with sourceId, sourceType, pathOrUrl, publisher, accessedAt, evidenceClass, proves, doesNotProve, freshness, and status. Then write claim rows that reference sourceRefs. If a source is weak, stale, or indirect, label it.

Output only draft Markdown plus source ledger rows. End with allowed claims, blocked claims, review gates, and follow-up candidates. Do not create send-ready copy unless explicitly requested; if draft copy is included, mark requires_human_approval=true and externalSendAuthorized=false.
```

## Subagent Prompts

### 1. Buyer Demand Lane

Use for `demand-intel-agent`.

```text
Objective:
Research current robot-team and adjacent technical-buyer demand signals that could support Blueprint's Exact-Site Hosted Review wedge.

Read first:
- PLATFORM_CONTEXT.md
- WORLD_MODEL_STRATEGY_CONTEXT.md
- docs/architecture/public-display-ready-claims-matrix.md
- ops/paperclip/programs/demand-intel-agent-program.md
- ops/paperclip/programs/exact-site-hosted-review-gtm-pilot-program.md
- ops/paperclip/playbooks/robot-team-demand-playbook.md

Research lanes:
1. Robot teams showing facility-specific deployment, simulation, testing, inspection, logistics, manufacturing, healthcare, or retail workflow needs.
2. Buyer roles likely to care about exact-site proof: autonomy/perception leads, deployment ops leads, simulation/data leads, systems integrators, industrial automation leaders.
3. Signals that justify a demand-sourced capture ask versus proof-ready outreach.
4. Procurement or security triggers that slow the first serious follow-up.

Web source requirements:
- Prefer primary company, standards body, trade association, conference, or technical documentation sources.
- Use news only to locate primary sources or date a public event.
- Do not infer named recipients or contactability from company pages.

Output:
- Ranked buyer-demand signals.
- Buyer segment matrix.
- Evidence-backed implications for Blueprint.
- Missing evidence and blocked claims.
- Draft-only handoff candidates for robot-team-growth-agent, each with one target pattern, one workflow, sourceRefs, and no send-ready recipient claim.
```

### 2. Robot Team Growth Lane

Use for `robot-team-growth-agent`.

```text
Objective:
Translate demand research into a reusable robot-team segment and proof-motion model for Blueprint.

Read first:
- ops/paperclip/programs/robot-team-growth-agent-program.md
- ops/paperclip/playbooks/robot-team-demand-playbook.md
- docs/exact-site-hosted-review-gtm-pilot-2026-04-26.md
- ops/paperclip/programs/exact-site-hosted-review-gtm-pilot-program.md

Required analysis:
1. Segment by buyer role, site/workflow need, proof requirement, evidence level, human dependency, and likely blocker.
2. Separate exact-site hosted review from city/site opportunity brief.
3. Define what a proof pack must contain before a serious technical buyer conversation.
4. Define which segment claims are ready for public language versus internal hypothesis only.

Allowed output:
- A segment matrix.
- Proof-pack requirement updates.
- Suggested instrumentation events.
- Draft-only first-response angles that require human approval and cite sourceRefs.

Blocked output:
- Broad cold outbound plan.
- Recipient guesses.
- Customer traction language.
- Claims that Blueprint has ready-now integration, procurement support, or hosted-session fulfillment without owner proof.
```

### 3. Exact-Site Category Lane

Use for `city-demand-agent` with market-intel support.

```text
Objective:
Rank exact-site categories that are most likely to matter for robot teams and capture prioritization.

Read first:
- ops/paperclip/programs/city-demand-agent-program.md
- ops/paperclip/programs/market-intel-program.md
- ops/paperclip/playbooks/robot-team-demand-playbook.md
- ops/paperclip/playbooks/capturer-supply-playbook.md

Research categories:
- warehouses, distribution centers, fulfillment areas, loading docks, and intralogistics zones
- manufacturing and industrial facilities
- retail/common-access commercial interiors
- hospitals/healthcare logistics areas when public or permissioned context exists
- hotels, convention centers, transit concourses, public lobbies/atriums, food halls, indoor markets, museums/galleries, coworking lobbies
- industrial inspection spaces and infrastructure facilities when lawful access and rights questions are explicit

For each category:
- buyer workflows
- likely robot types
- capture feasibility
- supply/capturer source class
- rights/access/privacy risk
- procurement/security questions
- current Blueprint evidence state: proof_ready, demand_sourced_capture, hypothesis, blocked

Output:
- Category priority table.
- Capture/supply dependencies.
- Blockers by rights, access, security, procurement, or missing proof artifact.
- No city-live claims.
```

### 4. Supply And Capturer Opportunities Lane

Use for `supply-intel-agent` and `capturer-growth-agent`.

```text
Objective:
Identify supply pools, channel mechanics, quality controls, and trust gates that can improve Blueprint's capturer marketplace without broad low-quality recruiting.

Read first:
- ops/paperclip/programs/supply-intel-agent-program.md
- ops/paperclip/programs/capturer-growth-agent-program.md
- ops/paperclip/playbooks/capturer-supply-playbook.md
- ops/paperclip/programs/parallel-search-mcp-policy.md

Research focus:
1. First 25-100 high-signal local contributors in a city.
2. Professional supply lanes: AEC, surveying, laser scanning, industrial inspection, commercial mapping, creator/photo/video operators.
3. Public-commercial community lanes for lawful public-area capture only.
4. Trust packet and QA patterns from field task/data collection platforms.
5. Fraud, quality, GPS, image, and completion controls.
6. Incentive patterns that avoid fake signup volume.

Source requirements:
- Marketplace/company pages can prove platform mechanics, not Blueprint legal/compensation policy.
- Supply pages can suggest channels, not approve capturers or guarantee work.
- Every recommended channel needs a quality filter and human dependency.

Output:
- Channel matrix with audience, expected quality, evidence level, trust gate, and blocked claims.
- First-25 starter cohort recommendation by source class.
- Source-ledger-backed QC patterns.
- No earnings, payout, job volume, legal classification, or public posting claims.
```

### 5. Competitor Positioning Lane

Use for `market-intel-agent`.

```text
Objective:
Map competitor and substitute positioning around capture, digital twins, robot simulation, spatial/world models, and facility reality data.

Read first:
- ops/paperclip/programs/market-intel-program.md
- PLATFORM_CONTEXT.md
- WORLD_MODEL_STRATEGY_CONTEXT.md
- docs/architecture/public-display-ready-claims-matrix.md

Competitor/substitute groups:
1. Digital twin and capture services: Matterport, NavVis, Hexagon, Polycam, other reality-capture platforms.
2. Robot simulation and physical AI platforms: NVIDIA Isaac Sim/Omniverse, robot fleet simulation tools, AMR interoperability tooling.
3. Spatial/world-model research/product platforms: World Labs, Luma, Polycam AI/Gaussian-splat tools, emerging 3D generation/backends.
4. Robot teams as buyers or proof benchmarks: Agility, Boston Dynamics, KUKA, AMR vendors, humanoid/logistics/inspection companies.

For each competitor:
- What they sell or enable.
- How they frame proof, capture, simulation, hosted/cloud access, enterprise security, and support.
- What buyer expectation they create.
- Blueprint positioning implication.
- Claims Blueprint should not make without stronger proof.

Output:
- Competitor map.
- Buyer-objection implications.
- Positioning guardrails.
- Source ledger with primary URLs where possible.
```

### 6. Procurement And Security Needs Lane

Use for `security-procurement-agent`.

```text
Objective:
Identify the evidence enterprise buyers will likely ask for before inspecting, buying, integrating, or procuring Blueprint exact-site products.

Read first:
- ops/paperclip/programs/security-procurement-agent-program.md
- ops/paperclip/playbooks/security-procurement-evidence-factory.md
- DEPLOYMENT.md
- docs/architecture/source-of-truth-map.md
- docs/architecture/command-safety-matrix.md

Research focus:
1. Hosted-session access control and isolation questions.
2. Data handling, encryption, retention, deletion, export, and incident-response questions.
3. Capture provenance, rights, privacy, consent, and commercialization boundaries.
4. Procurement packet shape: questionnaire rows, source ledger, blockers, human/legal gates.
5. External standards/questionnaires useful as context, such as CSA CAIQ and NIST CSF 2.0.

Source requirements:
- Standards/questionnaires can define buyer evidence categories, not prove Blueprint controls.
- Repo docs/code can prove authored posture and implementation intent, not current production configuration.
- Live operational claims require owner-system exports and are outside this read-only swarm.

Output:
- Procurement/security question taxonomy.
- Required Blueprint evidence packet rows.
- Missing-evidence table by owner.
- Blocked commitments and deterministic phrase checks.
- No SOC 2, ISO, DPA, SLA, HIPAA, GDPR, CCPA, pen-test, uptime, live secret, or rights-clearance claim without owner proof.
```

### 7. Synthesis And Review Lane

Use for `growth-lead`, with `blueprint-cto` review for architecture/security implications.

```text
Objective:
Merge lane outputs into one draft-only Blueprint growth research packet.

Inputs:
- All lane markdown outputs.
- Shared source-ledger.json.
- Review-gates.md.

Required work:
1. Validate that every material claim has sourceRefs.
2. Reject unsupported claims or rewrite them as missing-evidence rows.
3. Deduplicate findings across buyer demand, robot teams, exact-site categories, supply, competitors, and procurement.
4. Rank follow-up candidates by Blueprint fit, evidence strength, urgency, and proof/capture dependency.
5. Decide whether each follow-up belongs to demand-intel, robot-team-growth, city-demand, capturer-growth, market-intel, security-procurement, buyer-solutions, solutions-engineering, rights-provenance, or webapp-codex.
6. Emit draft-only issue packets only when they include sourceRefs, blocked claims, owner, and no live action.

Output:
- Growth-swarm synthesis.
- Decision table: continue research, create draft issue, update playbook draft, block on evidence, or stop.
- Review gate status.
- No sends, CRM updates, Notion writes, Paperclip mutation, rights claims, or live state changes.
```

## Review Gates

### Gate 0: Preflight

Pass only when:

- `git status --short` has been recorded.
- Root and nested instructions were read.
- Command safety matrix was read.
- The run folder is new or explicitly safe to update.
- Live side-effect commands are out of scope.

Failure state:

- `blocked_preflight`.

### Gate 1: Source Acceptance

Pass only when:

- Every source row has `proves` and `doesNotProve`.
- Every web source is linked and accessible or marked `needs_verification`.
- Every standards/company source is treated as context unless it directly proves a narrow claim.
- Every local repo source is scoped to the owner system it can actually prove.

Failure state:

- `blocked_source_integrity`.

### Gate 2: Claim Integrity

Pass only when:

- Every material claim has at least one accepted sourceRef.
- Every inference is labeled `inference`.
- No operational claim relies on market/web context.
- No external-source claim implies Blueprint has owner-system proof.

Failure state:

- `blocked_claim_integrity`.

### Gate 3: Claim Guardrail Scan

Scan and block unsupported language around:

```text
customer
traction
revenue
live city
active coverage
rights-cleared
operator-approved
permission granted
package access open
hosted session live
provider execution complete
payment succeeded
payout succeeded
SOC 2 certified
ISO 27001 certified
DPA signed
SLA
guaranteed uptime
guaranteed work
earnings
recipient-backed
email found
send-ready
```

Failure state:

- `blocked_guardrail_scan`.

### Gate 4: Lane Owner Review

Each lane owner checks:

- output fits the lane
- blocked claims are listed
- follow-up actions are draft-only
- no action requires a live system mutation

Failure state:

- `blocked_lane_review`.

### Gate 5: Synthesis Review

Growth Lead checks:

- research supports the current Exact-Site Hosted Review wedge
- findings are not generic B2B growth advice
- follow-up candidates map to named agents and proof needs
- weak evidence does not become a public claim
- stop/change decisions are allowed outcomes

Failure state:

- `blocked_synthesis_review`.

### Gate 6: Security/Procurement Review

Required when procurement, access control, data handling, retention, certification, DPA, SLA, legal/privacy, rights, or production security posture appears.

Owner:

- `security-procurement-agent` for packet shape
- `blueprint-cto` for architecture/security commitments
- founder/legal owner for legal commitments
- `rights-provenance-agent` for rights/provenance questions

Failure state:

- `human_gated_security_or_rights_review`.

### Gate 7: Draft-Only Closeout

Pass only when:

- `externalSendAuthorized=false`
- `liveMutationAuthorized=false`
- all outputs are local draft files
- no Notion/Paperclip/CRM/slack/email write occurred
- no rights, procurement, live city, payment, payout, provider, or hosted-session claim is promoted
- closeout includes objective, run id or missing context, proof paths, commands run, requirement coverage, next action, retry/resume condition, and residual risk

Failure state:

- `blocked_closeout_evidence`.

## Claim Guardrails

### Allowed Research Claims

Allowed when sourced:

- A source says a market/competitor/platform offers or positions a capability.
- A robot company or association publicly describes a deployment, use case, standard, or market trend.
- A standards body describes questionnaire or framework categories.
- A repo doc defines Blueprint doctrine, lane ownership, or guardrails.
- A subagent infers a Blueprint implication from source evidence and labels it as inference.

### Blocked Or Human-Gated Claims

Blocked unless exact owner proof exists:

- "Blueprint has customers using this"
- "Blueprint can fulfill this hosted session"
- "This site is rights-cleared"
- "This city is live"
- "This target is recipient-backed"
- "This contact is send-ready"
- "This capture is approved"
- "This payout is guaranteed"
- "This provider execution is complete"
- "Blueprint is SOC 2/ISO/HIPAA/GDPR/CCPA compliant"
- "Blueprint has a signed DPA/SLA/pen-test"
- "This package is deployment-ready"

### Safe Public-Wedge Language

Allowed as draft positioning, not as proof:

- "Blueprint sells capture-backed site-specific world-model packages and hosted review paths for robot teams."
- "Live availability, rights, and fulfillment are confirmed per site/request."
- "Exact-site hosted review is a technical evaluation motion, not a generic sales demo."
- "A demand-sourced capture target asks what site or workflow should be captured next; it does not imply a hosted review exists."

## Draft-Only Output Formats

### Lane Brief Frontmatter

```yaml
---
schema: blueprint/growth-research-lane-brief/v0.1
date: YYYY-MM-DD
lane: buyer_demand
ownerAgent: demand-intel-agent
draftOnly: true
externalSendAuthorized: false
liveMutationAuthorized: false
sourceLedgerPath: ./source-ledger.json
reviewState: draft | blocked | awaiting_human_review
---
```

### Finding Row

| Field | Required |
| --- | --- |
| findingId | yes |
| lane | yes |
| title | yes |
| evidenceSummary | yes |
| sourceRefs | yes |
| implicationForBlueprint | yes |
| confidence | yes, `low`, `medium`, or `high` |
| allowedClaims | yes |
| blockedClaims | yes |
| nextOwner | yes |
| nextAction | yes, draft-only |
| reviewGate | yes |

### Follow-Up Candidate Row

```json
{
  "candidateId": "followup-001",
  "type": "draft_issue | playbook_update | proof_pack_gap | blocked_evidence_gap | stop",
  "ownerAgent": "robot-team-growth-agent",
  "title": "Short title",
  "whyNow": "Evidence-backed reason",
  "sourceRefs": ["web:kuka:amr-logistics-production:20260531"],
  "allowedClaims": ["Narrow claims only"],
  "blockedClaims": ["No live send", "No customer traction claim"],
  "requiresHumanReview": true,
  "externalSendAuthorized": false,
  "liveMutationAuthorized": false
}
```

## Research Lane Acceptance Criteria

| Requirement | Acceptance rule |
| --- | --- |
| Buyer demand lane exists | Brief ranks demand signals with sourceRefs and no guessed recipients. |
| Robot teams lane exists | Segment matrix maps buyer role, site/workflow need, proof requirement, and blocked claims. |
| Exact-site categories lane exists | Category map ties facility type to robot workflow, capture feasibility, supply needs, rights/access risk, and no city-live claim. |
| Supply/capturer lane exists | Channel matrix prioritizes gated cohorts and quality/trust controls, with no earnings or guaranteed work language. |
| Competitor positioning lane exists | Competitor map uses primary sources where possible and separates competitor positioning from Blueprint claims. |
| Procurement/security lane exists | Packet taxonomy maps buyer evidence questions to source classes, missing evidence, and human/legal/CTO/rights gates. |
| Source ledger exists | `source-ledger.json` includes accepted source rows and claim rows with `proves` and `doesNotProve`. |
| Review gates exist | `review-gates.md` records gate status and blockers. |
| Draft-only proof | Every output says `draftOnly=true`, `externalSendAuthorized=false`, `liveMutationAuthorized=false`. |

## Stop Rules

Stop the swarm and report `blocked` when:

- a lane needs live Firestore, Stripe, Render, Redis, Paperclip, Gmail, Slack, Notion, or provider state
- a lane needs rights/provenance evidence for a specific site
- a lane needs recipient-backed contact evidence not available from approved sources
- a lane needs legal/procurement/certification interpretation
- source references are missing or stale
- a finding would require outreach, public posting, paid spend, CRM update, Notion write, or Paperclip mutation

Stop the swarm and report `awaiting_human_decision` only when:

- the next action is irreversible, policy-changing, spend-related, rights/legal sensitive, public-claim sensitive, or live-send sensitive
- the decision packet has a durable blocker id and a repo-local no-send route

## Current Run Command And Mutation Log

Commands and tools used for this design run:

| Action | Result |
| --- | --- |
| `git status --short` | Worktree was dirty before this task with generated AutoAgent/QA outputs and untracked docs/output folders. This run preserved unrelated state. |
| Local doc reads | Read root and Paperclip instructions, doctrine, source-of-truth, command safety, AI tooling/governance, public claims, autonomous org, growth programs, playbooks, routine tasks, and closeout checklist. |
| Approved web research | Read-only search/open of primary or near-primary public sources listed in the web seed ledger. |
| File mutation | Added this single local draft file under `docs/research/`. |
| Live mutations | None. No outreach, CRM updates, Notion writes, Slack/email sends, rights claims, live Paperclip state changes, provider jobs, Stripe/Firebase/Render/Redis writes, or hosted-session claims. |

## Recommended First Swarm Run

Use one bounded run:

```text
Run id: growth-swarm-2026-05-31-v1
Output folder: docs/research/growth-swarm/2026-05-31-blueprint-growth-swarm-v1/
Research horizon: sources published or updated in the last 18 months, plus canonical repo docs
Web cap: 5-10 searches and 3-5 fetches per lane
No live mutations: true
No Notion/Paperclip writes: true
No outreach: true
No recipient inference: true
```

First output should be a draft synthesis with exactly three follow-up queues:

1. `proof-pack-gap`: what evidence or hosted-review artifact needs to exist before buyer demand work can advance.
2. `capture-priority-gap`: which exact-site category should be captured or source-mapped next, and why.
3. `procurement-evidence-gap`: which security/procurement evidence row is most likely to block serious robot-team review.

If the swarm cannot name one source-backed candidate in each queue, it should close as `blocked_claim_integrity` instead of producing strategy narrative.
