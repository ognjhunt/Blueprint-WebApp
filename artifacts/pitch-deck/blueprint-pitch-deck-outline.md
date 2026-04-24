# Blueprint Pitch Deck Outline

Audience: pre-seed / seed investors evaluating a frontier physical-AI infrastructure company.

Thesis: Blueprint is building the exact-site data and world-model operating system for robot teams.

Narrative arc: robotics is moving from demos to real deployment; real deployment is site-specific; Blueprint turns lawful/public and requested capture into provenance-safe exact-site packages, hosted review, and an autonomous operating loop.

Claim policy: no invented customers, revenue, partner logos, deployment guarantees, or traction. Fundraise and traction details are placeholders until founder-validated.

## 01. Blueprint

Visual concept: Editorial cover over a public-facing retail interior with route traces, point-cloud speckles, and a restrained Blueprint accent.

Bullets:
- Blueprint turns everyday real-world captures into site-specific world-model products.
- The first commercial wedge is Exact-Site Hosted Review: one real site, one workflow lane, one proof path.
- The company compounds through capture supply, provenance-safe packaging, buyer usage, and autonomous ops.

Claim status: Verified repo doctrine. No traction, customer, or revenue claims.

Citations:
- PLATFORM_CONTEXT.md
- WORLD_MODEL_STRATEGY_CONTEXT.md
- AUTONOMOUS_ORG.md

## 02. Robotics is crossing from demos to site-specific deployment.

Visual concept: Three verified proof points laid over a quiet test-bay image and a thin evidence rail.

Bullets:
- Cross-embodiment and multi-robot data are improving real robot performance.
- World models and learned simulators are becoming controllable enough to matter for physical AI.
- Robot deployments are expanding, but each site still has local geometry, workflows, and edge cases.

Claim status: Verified external claims: RT-X 50%, RT-1 22% to 39%, IFR 542,000 industrial robots installed in 2024.

Citations:
- https://deepmind.google/blog/scaling-up-learning-across-many-different-robot-types/
- https://research.google/blog/rt-1-robotics-transformer-for-real-world-control-at-scale/
- https://ifr.org/ifr-press-releases/news/global-robot-demand-in-factories-doubles-over-10-years?stream=top

## 03. The last mile of robotics is not generic.

Visual concept: Everyday grocery/backroom scene with spatial annotations and a hard-cut problem statement zone.

Bullets:
- A robot team can perform well in a lab and still fail inside a new aisle, stockroom, service corridor, or facility lane.
- Deployment blockers hide in route geometry, fixture placement, lighting, floor conditions, clutter, access, and workflow timing.
- Generic datasets and benchmarks do not answer the buyer's real question: what happens in this exact place?

Claim status: Verified as Blueprint thesis and product framing; no numeric deployment claim.

Citations:
- PLATFORM_CONTEXT.md
- WORLD_MODEL_STRATEGY_CONTEXT.md

## 04. Exact-site data is the missing layer between foundation models and deployment.

Visual concept: A site plan becomes the bridge between generic model capability and a concrete robot-team decision.

Bullets:
- The model layer will keep improving; the scarce layer is trusted real-site capture and productized site context.
- Exact-site packages turn a real location into geometry, routes, provenance, restrictions, and hosted review prerequisites.
- Blueprint sells leverage around a site, not a generic scan or a permanent model checkpoint.

Claim status: Verified repo doctrine. Strategic inference from local world-model context.

Citations:
- WORLD_MODEL_STRATEGY_CONTEXT.md
- PLATFORM_CONTEXT.md

## 05. Four layers turn public capture into buyer-ready world-model products.

Visual concept: A single vertical operating stack with a real logistics scene behind it.

Bullets:
- BlueprintCapture is the evidence-capture layer.
- BlueprintCapturePipeline packages raw capture into derived site-world outputs.
- Blueprint-WebApp is the buyer, licensing, ops, and hosted-review surface.
- Paperclip is the operating layer that makes the loop repeatable.

Claim status: Verified cross-repo architecture.

Citations:
- PLATFORM_CONTEXT.md
- ../BlueprintCapture/README.md
- ../BlueprintCapturePipeline/README.md
- AUTONOMOUS_ORG.md

## 06. Capture turns everyday places into truthful evidence packages.

Visual concept: Phone-led capture composition with public-retail cues, raw-bundle sidecar labels, and an earnings-supply signal.

Bullets:
- Capturers can gather lawful, public-facing site evidence from places people already visit: grocery, retail, service areas, and other everyday locations.
- The app preserves raw walkthrough video, motion, poses, intrinsics, depth when available, rights, consent, and provenance metadata.
- Generated scenes are downstream derived products; raw capture remains the source of truth.

Claim status: Verified repo contract. Legal availability is marked as lawful/where allowed rather than assumed universally permission-free.

Citations:
- ../BlueprintCapture/README.md
- ../BlueprintCapture/docs/CAPTURE_RAW_CONTRACT_V3.md
- PLATFORM_CONTEXT.md

## 07. Pipeline packages evidence into site-specific world-model products.

Visual concept: A proof-board surface with an artifact conveyor, provenance stamps, and depth/trajectory overlays.

Bullets:
- Pipeline emits qualification, capture quality, rights/compliance, buyer trust, world-model fit, preview status, and provenance artifacts.
- Derived geometry lanes can produce camera intrinsics, poses, depth, confidence maps, keyframes, and readiness summaries.
- Privacy-safe preview and hosted prerequisites are packaged without rewriting raw capture truth.

Claim status: Verified Pipeline README and bridge/geometry contracts.

Citations:
- ../BlueprintCapturePipeline/README.md
- ../BlueprintCapturePipeline/docs/CAPTURE_BRIDGE_CONTRACT.md
- ../BlueprintCapturePipeline/docs/GEOMETRY_LANE_CONTRACT.md

## 08. WebApp turns one exact site into a buyer workflow.

Visual concept: Hosted-review workspace over a real interior, with buyer decision rails and proof chips.

Bullets:
- Robot teams inspect catalog listings, proof, rights posture, package access, and hosted review options from a single buyer surface.
- Hosted Review is a managed evaluation room for one site - not a deployment guarantee.
- The product keeps proof attached before package access, export, or broader commercial steps.

Claim status: Verified WebApp product surfaces and hosted-review copy.

Citations:
- PLATFORM_CONTEXT.md
- client/src/pages/Home.tsx
- client/src/pages/ExactSiteHostedReview.tsx

## 09. Paperclip makes the operating system scale.

Visual concept: Managerial operating board with agent lanes, issue movement, and a founder-gate interrupt line.

Bullets:
- Blueprint runs supply, review, buyer follow-through, pricing discipline, rights/provenance handling, and ops loops through persistent Paperclip agents.
- Paperclip is the execution and ownership record; Notion is the workspace and review surface; repo files hold doctrine.
- Founder attention stays reserved for strategy, policy, architecture, and irreversible high-risk decisions.

Claim status: Verified autonomous-org doctrine.

Citations:
- AUTONOMOUS_ORG.md

## 10. The moat compounds around real sites, not generic model access.

Visual concept: Circular flywheel around a provenance board, with one accent path and no generic marketplace card grid.

Bullets:
- More capturers produce more real-site coverage.
- More packages create better buyer workflows, review evidence, and rights/provenance density.
- Buyer usage creates demand signals that guide the next captures and stronger exact-site packaging.
- Model backends can improve or swap while the capture, package, rights, and buyer workflow contracts keep compounding.

Claim status: Verified repo doctrine and strategic inference.

Citations:
- WORLD_MODEL_STRATEGY_CONTEXT.md
- PLATFORM_CONTEXT.md

## 11. World models win when simulation is controllable and grounded.

Visual concept: Multi-sensor point cloud corridor with three evidence annotations and a site-specific evaluation lane.

Bullets:
- Waymo's world-model framing shows why controllable simulation matters, but Blueprint localizes the idea to site-specific robotics evaluation.
- UniSim and PointWorld reinforce the same arc: grounded world models can become training, planning, and evaluation infrastructure.
- Blueprint's wedge is practical: exact-site hosted review before broader package access or recurring workflows.

Claim status: Verified external analogs. Blueprint positioning is localized and does not claim Waymo-level capability.

Citations:
- https://waymo.com/blog/2026/02/the-waymo-world-model-a-new-frontier-for-autonomous-driving-simulation/
- https://deepmind.google/research/publications/learning-interactive-real-world-simulator/
- https://pointworld-iclr26.github.io/

## 12. The customer is the robot team deploying into messy real places.

Visual concept: Investor-style market slide with a restrained chart, customer lane labels, and warehouse/site imagery.

Bullets:
- Primary buyers are robot teams: autonomy companies, deployment orgs, systems integrators, warehouse/industrial teams, and service-robot operators.
- IFR reports industrial robot demand more than doubled over 10 years, with 542,000 installations in 2024.
- Transportation and logistics is the largest professional service robot application class by units sold.

Claim status: Verified IFR industrial and service-robot market claims.

Citations:
- https://ifr.org/ifr-press-releases/news/global-robot-demand-in-factories-doubles-over-10-years?stream=top
- https://ifr.org/ifr-press-releases/news/robotics-a-key-technology-for-resilient-economies

## 13. Start with Exact-Site Hosted Review.

Visual concept: Three-step commercial path with a real scoping room and a proof-preserving decision rail.

Bullets:
- Step 1: one exact site, one workflow lane, one hosted review, one proof-backed next step.
- Step 2: package access and exports when the buyer wants the site inside its own stack.
- Step 3: recurring site programs, rights-safe licensing, and broader capture demand loops.
- This wedge keeps the product concrete before Blueprint sells a larger network vision.

Claim status: Verified current commercial wedge from autonomous-org doctrine and WebApp hosted-review surface.

Citations:
- AUTONOMOUS_ORG.md
- client/src/pages/ExactSiteHostedReview.tsx

## 14. From one exact site to a network of world-model-ready places.

Visual concept: Premium closing slide with a network map, public capture foreground, and a sober placeholder raise band.

Bullets:
- Near term: launch the public capture loop and convert everyday site captures into proof-backed hosted-review inventory.
- Next: strengthen Pipeline packaging, privacy/provenance labels, and buyer review surfaces around exact-site packages.
- Then: build recurring robot-team workflows over a rights-safe network of world-model-ready sites.
- [PLACEHOLDER - validate] round size, runway, lead milestones, committed allocation, and current traction proof.

Claim status: Roadmap is strategy. Fundraise amount, runway, traction, and milestones are placeholders requiring founder validation.

Citations:
- PLATFORM_CONTEXT.md
- WORLD_MODEL_STRATEGY_CONTEXT.md
- AUTONOMOUS_ORG.md
