# Blueprint Pre-Seed Pitch Deck Source Ledger

Generated: 2026-05-31

Deck path: /Users/nijelhunt_1/workspace/Blueprint-WebApp/outputs/019e7ffd-feda-7eb0-8b80-399c173c8e24/presentations/blueprint-preseed-pitch-deck/output/blueprint-preseed-pitch-deck.pptx

## How To Read This Ledger

Source IDs appear in slide footers and speaker notes. Market-sizing values in the deck are modeled estimates from the repo-local market memo, not direct claims from a single external report. Public/investor posture is allowed to be polished and present-tense, but operational claims remain blocked unless owned-system proof exists.

## Repo Sources

| ID | Source | Evidence used | Slides | Claim boundary |
|---|---|---|---|---|
| R1 | README.md; PLATFORM_CONTEXT.md | Blueprint is the buyer/licensing/ops/hosted-access surface for capture-backed site-specific world-model products; BlueprintCapture and BlueprintCapturePipeline own capture and package generation. | 1, 4, 6, 11 | Does not prove live package fulfillment. |
| R2 | WORLD_MODEL_STRATEGY_CONTEXT.md | Strategy is capture-first and world-model-product-first; model providers are swappable; durable moat is capture supply, rights/provenance, packages, hosted access, buyer workflows. | 1, 4, 6, 11, 13 | Does not claim Blueprint owns the frontier model backend. |
| R3 | client/src/pages/Pricing.tsx | Public pricing ranges: Package access $2,100-$3,400; hosted review $16-$29/session-hour; custom scope $50,000+ scoped; availability, rights, payment, and fulfillment confirmed per request. | 7, 8 | Does not prove payments have cleared. |
| R4 | client/src/pages/ExactSiteHostedReview.tsx | Current product workflow: indoor site capture -> world model package -> hosted evaluation -> export or recapture decision. | 3, 5, 7 | Does not prove any specific hosted session is live. |
| R5 | client/src/data/marketingDefinitions.ts | Definitions for world model, site package, hosted evaluation, session hour, and stable contract items. | 4, 5, 11 | Definitions are product truth, not operational proof. |
| R6 | ops/paperclip/programs/exact-site-hosted-review-gtm-pilot-program.md | GTM wedge and guardrails: Exact-Site Hosted Review; proof_ready_outreach vs demand_sourced_capture; 30-50 target ledger; scale gate requires qualified organic signal. | 10, 12, 13 | Does not prove sends, replies, calls, or hosted-review starts occurred. |
| R7 | docs/architecture/public-display-ready-claims-matrix.md | Public Launch Ready vs Operational Launch Ready separation; allowed polished public posture; blocked unsupported claims. | 1, 7, 14 | Keeps investor-showcase readiness separate from live operational readiness. |
| R8 | AUTONOMOUS_ORG.md | Paperclip is execution/ownership record; active wedge judged through product/proof, demand/sales, and reliability loops; founder gates for high-risk actions. | 12 | Does not prove current live Paperclip health. |
| M1 | docs/research/2026-05-31-blueprint-tam-market-research.md | Modeled TAM/SAM/SOM ranges, ICPs, first verticals, bottom-up assumptions, source table, and pitch-deck-ready slide suggestions. | 8, 9 | Untracked repo-local memo; its numbers are modeled estimates and must be refreshed before external fundraising distribution. |

## External Sources

| ID | Source | Evidence used | Slides | Confidence |
|---|---|---|---|---|
| W1 | IFR, World Robotics 2025 industrial robots, https://ifr.org/ifr-press-releases/news/global-robot-demand-in-factories-doubles-over-10-years%20%20%20 | 542,000 industrial robots installed in 2024; 4,664,000 industrial robots in operation worldwide. | 2, 9 | High, primary industry association. |
| W2 | IFR, World Robotics 2025 service robots executive summary, https://ifr.org/img/worldrobotics/Executive_Summary_WR_2025_Service_Robots.pdf | More than 199,000 professional service robots sold in 2024; transportation/logistics largest group; 333 logistics robot suppliers; RaaS fleet grew 31%. | 2, 9 | High, primary industry association summary. |
| W3 | Gartner, human-optional warehouses, https://www.gartner.com/en/newsroom/2026-04-13-gartner-predicts-half-of-new-warehouses-built-in-developed-markets-will-be-human-optional-facilities-by-2030 | By 2030, 50% of new developed-market warehouses expected to be robot-centric/human-optional; Gartner recommends digital twins and simulation early. | 2, 8, 9 | High for trend; forecast, not certainty. |
| W4 | Interact Analysis, Mobile robots market, https://interactanalysis.com/wp-content/uploads/January-2026-Mobile-Robots-Report.pdf | Mobile robot revenue forecast from just under $5B in 2024 to $14B in 2030; 19% annual growth. | 8, 9 | High for mobile-robot wedge; vendor market intelligence. |
| W5 | A3/BusinessWire, Q1 2026 robot orders, https://www.businesswire.com/news/home/20260511529781/en/Robot-Orders-Hold-Steady-in-Q1-2026-as-Demand-Broadens-Across-Non-Automotive-Industries | North American Q1 2026 orders: 9,055 robots, $543M; cobots +55.6% units, +78.2% revenue YoY; adoption broadening beyond automotive. | 9 | High for North America; not global TAM. |
| W6 | Deloitte, AI for robots and drones, https://www.deloitte.com/us/en/insights/industry/technology/technology-media-and-telecom-predictions/2026/ai-for-robots-drones.html | Industrial robot capacity could reach 5.5M in 2026; annual industrial robot shipments could reach 1M by 2030 with $21B revenue. | 2, 8 | Medium-high; analyst forecast. |
| W7 | BCG, Physical AI, https://www.bcg.com/publications/2026/how-physical-ai-is-reshaping-robotics-today | Near-term value concentrated in Level 2/3 systems; need to distinguish deployable capabilities from demos. | 2, 3 | High for strategic framing; not direct market size. |
| W8 | Google, Project Genie + Street View, https://blog.google/innovation-and-ai/models-and-research/google-deepmind/project-genie-expands/ | Street View grounding can provide virtual environments for AI agents or robots; Google AI Ultra rollout. | 2, 3, 5 | High for category signal; outdoor/public imagery, not Blueprint indoor proof. |
| W9 | Waymo, Waymo World Model, https://waymo.com/blog/2026/02/the-waymo-world-model-a-new-frontier-for-autonomous-driving-simulation/ | Waymo World Model built on Genie 3 for autonomous-driving simulation and rare-event generation. | 2, 3 | High for AV simulation analogy; domain differs from indoor sites. |
| W10 | NVIDIA Cosmos, https://nvidianews.nvidia.com/news/nvidia-launches-cosmos-world-foundation-model-platform-to-accelerate-physical-ai-development | Cosmos world foundation model platform for physical AI, robotics, AVs, synthetic data, simulation, and evaluation. | 2, 4 | High for physical-AI category signal; not a Blueprint provider claim. |
| W11 | Amazon Robotics/DeepFleet, https://www.aboutamazon.com/news/operations/amazon-million-robots-ai-foundation-model | Amazon deployed its 1 millionth robot across 300+ facilities; DeepFleet aims to improve robot fleet travel time by 10%. | 2, 9 | High for operator-scale robotics signal; Amazon is not a Blueprint customer. |
| W12 | Grand View Research, digital twin market, https://www.grandviewresearch.com/industry-analysis/digital-twin-market | Digital twin market estimated $35.82B in 2025 and forecast $328.51B by 2033. | 8 | Medium; public market-report summary. |
| W13 | Grand View Research, warehouse automation market, https://www.grandviewresearch.com/industry-analysis/warehouse-automation-market-report | Warehouse automation market estimated $19.23B in 2023 and forecast $59.52B by 2030. | 8 | Medium; public market-report summary. |
| W14 | MarketsandMarkets, simulation software market, https://www.marketsandmarkets.com/Market-Reports/simulation-software-market-263646018.html | Simulation software market estimated $19.95B in 2024 and forecast $36.22B by 2030. | 8 | Medium; public market-report summary. |
| W15 | MarketsandMarkets, digital twin market, https://www.marketsandmarkets.com/Market-Reports/digital-twin-market-225269522.html | Digital twin market forecast from $21.14B in 2025 to $149.81B in 2030. | 8 | Medium; public market-report summary. |

## Visual Asset Ledger

| Asset | Source | Usage | Boundary |
|---|---|---|---|
| client/public/generated/public-capture-2026-04-23/everyday-places-collage.png | Repo-owned/generated public capture visual | Slide 1 visual texture | Illustrative; not capture proof. |
| client/public/generated/editorial/hosted-hero.png | Repo-owned/generated editorial asset | Slide 5 hosted-review workflow visual | Illustrative; not hosted-session proof. |
| client/public/generated/public-capture-2026-04-23/capture-app-hero.png | Repo-owned/generated public capture visual | Slide 6 platform map accent | Illustrative; not app-store or real-device proof. |
| client/public/generated/editorial/sample-evaluation-proof-board.png | Repo-owned/generated editorial asset | Slide 10 GTM proof-object visual | Illustrative; not customer proof. |

## Blocked Claims

- Real customer logos, testimonials, revenue, conversion, or traction metrics were not provided.
- Live Stripe payments, checkout success, payouts, or settled entitlements were not verified.
- Rights-cleared commercial use for any specific external site was not verified.
- Hosted-session fulfillment for a specific buyer/site was not verified.
- Active city coverage and capturer availability were not verified.
- Final raise amount, valuation, runway, and committed use-of-funds budget were not provided.
