# Blueprint TAM and Market Research Memo: Exact-Site Hosted Review and Indoor World-Model Packages

Date: 2026-05-31
Scope: Investor-grade market memo for Blueprint's capture-backed Exact-Site Hosted Review and site-specific indoor world-model package business.

## Executive View

Blueprint's market is not generic robotics, generic simulation, or generic model-checkpoint ownership. The market is the spend layer that forms when robot teams, automation integrators, and large operators need exact indoor sites turned into reviewable, rights-aware, provenance-backed world-model packages before field deployment, export, tuning, or integration decisions.

The strongest investor framing is:

- **2026 wedge:** sell one exact-site package and one hosted review path at a time to robot teams evaluating logistics, manufacturing, retail, service, lab, healthcare, and facility workflows.
- **2030 expansion:** become the site-data and hosted-evaluation layer around robot-centric warehouses, non-automotive automation, and physical-AI deployment programs.
- **2035 strategic market:** become infrastructure for indoor physical AI where exact-site data, rights, provenance, simulation, and hosted evaluation are required before robots enter real environments.

### TAM / SAM / SOM Ranges

Definitions:

- **TAM:** broad strategic market for exact-site indoor world-model / hosted-evaluation infrastructure, modeled as a filtered share of robotics, warehouse automation, digital twin, and simulation spend.
- **SAM:** serviceable exact-site indoor package market, modeled bottom-up with Blueprint's current pricing and plausible buyer-site activity.
- **SOM:** obtainable Blueprint revenue at conservative market-share assumptions; this is not a traction claim.

| Year | TAM, low/base/high | SAM, low/base/high | SOM, low/base/high |
|---|---:|---:|---:|
| 2026 | $1.6B / $5.5B / $11.8B | $0.12B / $0.97B / $5.08B | $0.23M / $1.60M / $7.32M |
| 2030 | $9.3B / $24.3B / $50.6B | $0.63B / $7.49B / $19.48B | $10.62M / $87.66M / $280.45M |
| 2035 | $19.4B / $81.6B / $215.6B | $3.09B / $37.35B / $85.14B | $111.38M / $1.01B / $2.55B |

All values above are estimates. The source inputs are cited below; the TAM/SAM/SOM values are explicitly modeled, not copied from any single report.

## Product Boundary Used in This Memo

Repo doctrine defines Blueprint as capture-first and world-model-product-first. `Blueprint-WebApp` is the buyer, licensing, ops, and hosted-access surface around site-specific world-model packages; robot teams buy site-specific world models, hosted access, and related outputs; site operators are an optional rights/access/commercialization lane, not the only buyer. See `PLATFORM_CONTEXT.md` lines 15-21, 25-31, 40-53, and 55-68.

`WORLD_MODEL_STRATEGY_CONTEXT.md` frames the moat as capture supply, rights-safe/provenance-safe data pipelines, site-specific world-model packages, hosted access, buyer surfaces, and a capture -> package -> buyer usage flywheel. It explicitly says Blueprint should not build around one permanent model backend and should keep world-model providers swappable; see lines 13-25, 52-62, 74-122.

The current product/pricing surface used in the bottom-up model comes from `client/src/pages/Pricing.tsx`:

- Site Package Access: `$2,100-$3,400` per exact site, lines 52-57 and 95-104.
- Hosted Review: `$16-$29 / session-hour`, lines 59-64 and 106-114.
- Custom Scope: `$50,000+ scoped`, lines 116-124.
- Package and hosted review are proof/rights/access gated, lines 80-92 and 214-216.

The current product page describes the workflow as indoor site capture -> world model package -> hosted evaluation -> export or recapture decision, with rights/proof boundaries kept visible; see `client/src/pages/ExactSiteHostedReview.tsx` lines 15-39, 60-76, and 86-123.

The GTM pilot doctrine keeps the wedge as Exact-Site Hosted Review and separates `proof_ready_outreach` from `demand_sourced_capture`; no live sends, public posts, spend, pricing commitments, rights commitments, or commercialization commitments are allowed without explicit approval. See `ops/paperclip/programs/exact-site-hosted-review-gtm-pilot-program.md` lines 3-32, 53-71, 90-116, and 134-146.

## Source Table

| Source | Publisher / date | Market scope | Number used | Confidence | Applies to Blueprint? |
|---|---|---:|---:|---|---|
| [World Robotics 2025 industrial robots](https://ifr.org/ifr-press-releases/news/global-robot-demand-in-factories-doubles-over-10-years) | IFR, 2025-09-25 | Industrial robots | 542,000 installations in 2024; 4,664,000 operational industrial robots | High | Yes as robot-deployment base. Does not itself price exact-site packages. |
| [World Robotics 2025 service robots](https://ifr.org/ifr-press-releases/news/one-million-robots-work-in) | IFR, 2025-10-07 | Professional service robots | Almost 200,000 professional service robots sold in 2024; 102,900 transportation/logistics units; RaaS fleet +31% to 24,500 units | High | Yes for mobile/logistics/service robot demand; Blueprint filters to indoor exact-site evaluation needs. |
| [World Robotics 2025 Service Robots executive summary](https://ifr.org/img/worldrobotics/Executive_Summary_WR_2025_Service_Robots.pdf) | IFR, 2025 | Service robot suppliers and units | 944 service-robot producers known to IFR; 333 logistics robot suppliers; >199,000 professional service units; 16,700 medical robots | High | Yes for supplier/account sanity checks; not all suppliers are buyers. |
| [Mobile robots market outpaces fixed automation](https://interactanalysis.com/wp-content/uploads/January-2026-Mobile-Robots-Report.pdf) | Interact Analysis, 2026-01 | AGV/AMR material-handling mobile robots | Mobile robot revenue just under $5B in 2024 to $14B in 2030; order-fulfillment robots about 50% of shipments by 2030; forklifts about 33% of revenue | High | Strong for warehouse/manufacturing mobile-robot wedge; Blueprint is a data/package layer, not robot hardware. |
| [Warehouse automation order intake up by 7%](https://interactanalysis.com/warehouse-automation-order-intake-up-by-7/) | Interact Analysis, 2026-02-23 | Warehouse automation orders/revenue | 2025 order intake +7%; global warehouse automation CAGR about 6% from 2025-2030 | High | Strong for deployment-environment demand; order intake is not directly package spend. |
| [Gartner predicts half of new warehouses in developed markets will be human-optional by 2030](https://www.gartner.com/en/newsroom/2026-04-13-gartner-predicts-half-of-new-warehouses-built-in-developed-markets-will-be-human-optional-facilities-by-2030) | Gartner, 2026-04-13 | Warehouse automation / intralogistics smart robotics | 50% of new warehouses in developed markets robot-centric/human-optional by 2030; recommends digital twin and simulation models early | High | Very strong why-now signal for exact-site simulation/review in warehouses. |
| [Gartner predicts one in 20 supply chain managers will manage robots by 2030](https://www.gartner.com/en/newsroom/press-releases/2025-07-16-gartner-predicts-one-in-20-supply-chain-managers-will-manage-robots-rather-than-humans-by-2030) | Gartner, 2025-07-16 | Supply-chain robot management | 80% of humans engage with smart robots daily by 2030; 1 in 20 supply-chain managers manage robots | Medium-high | Supports buyer workflow and robot-fleet operations trend; broad and not directly monetizable. |
| [Robotics Outlook 2030](https://www.bcg.com/publications/2021/how-intelligence-and-mobility-will-shape-the-future-of-the-robotics-industry) | BCG, 2021-06-28 | Global robotics | Robotics market $160B-$260B by 2030; professional service robots up to $170B; industrial/logistics up to $80B | Medium-high | Useful top-down ceiling. Older source; memo does not treat it as direct revenue. |
| [How Physical AI Is Reshaping Robotics Today](https://www.bcg.com/publications/2026/how-physical-ai-is-reshaping-robotics-today) | BCG, 2026-04-14 | Physical AI / robotics capability maturity | 2030 humanoid projections range from under 1M annual units to more than 6M; Level 2/3 near-term value already deployable | High for trend, medium for forecasts | Useful why-now and maturity framing; humanoid TAM is not direct Blueprint TAM. |
| [AI for robots and drones](https://www.deloitte.com/us/en/insights/industry/technology/technology-media-and-telecom-predictions/2026/ai-for-robots-drones.html) | Deloitte, 2026 | Industrial robots + AI | Industrial robot annual installations could reach 1M by 2030; 2030 revenues $21B; assumes 500k annual installations in 2025/2026 then +100k/year from 2027-2030 | Medium-high | Strong industrial adoption check; narrow to industrial robots. |
| [Warehouse automation market](https://www.grandviewresearch.com/industry-analysis/warehouse-automation-market-report) | Grand View Research, current public summary | Warehouse automation | $19.23B in 2023 to $59.52B in 2030; 18.7% CAGR | Medium | Useful top-down cross-check; public summary only, report paywalled. |
| [Warehouse robotics market](https://www.grandviewresearch.com/industry-analysis/warehouse-robotics-market) | Grand View Research, current public summary | Warehouse robotics | $4.31B in 2022 to $17.29B in 2030; 19.6% CAGR | Medium | Useful wedge cross-check; paywalled details. |
| [Mobile robotics market](https://www.grandviewresearch.com/industry-analysis/mobile-robotics-market) | Grand View Research, current public summary | Mobile robotics | $25.40B in 2024 to $73.68B in 2030; 20.7% CAGR | Medium | Broader than Blueprint; includes non-indoor/non-package categories. |
| [Digital twin market](https://www.grandviewresearch.com/industry-analysis/digital-twin-market) | Grand View Research, 2025 public summary | Digital twins | $35.82B in 2025 to $328.51B in 2033; 31.1% CAGR | Medium | Useful strategic ceiling; broad digital twins overstates Blueprint's directly reachable layer. |
| [Digital twin market](https://www.marketsandmarkets.com/Market-Reports/digital-twin-market-225269522.html) | MarketsandMarkets, 2025 public summary | Digital twins | $21.14B in 2025 to $149.81B in 2030; 47.9% CAGR | Medium | Useful 2030 cross-check; broad and paywalled. |
| [Digital twin market 2025-2035](https://www.emergenresearch.com/industry-report/digital-twin-market/market-analysis) | Emergen Research, 2026-04-23 | Digital twins | $24.62B in 2025 to $686.99B in 2035; 39.5% CAGR | Medium-low | Useful high-case 2035 ceiling only; broad vendor estimate and likely overlap. |
| [Digital twin market 2025-2035](https://www.factmr.com/report/digital-twin-market) | Fact.MR, 2025 public summary | Digital twins | $9.3B in 2025 to $177.5B in 2035; 34.3% CAGR | Medium-low | Useful conservative 2035 digital twin check; paywalled details. |
| [Simulation software market](https://www.marketsandmarkets.com/Market-Reports/simulation-software-market-263646018.html) | MarketsandMarkets, 2024 public summary | Simulation software | $19.95B in 2024 to $36.22B in 2030; 10.4% CAGR | Medium | Relevant to robot simulation/evaluation spend; broader than exact-site indoor. |
| [Simulation software market](https://www.imarcgroup.com/simulation-software-market) | IMARC, 2026 public summary | Simulation software | $18.4B in 2025 to $44.3B in 2034; 10.27% CAGR | Medium | Useful for 2035 extrapolation; broad. |
| [Embodied AI market](https://www.marketsandmarkets.com/Market-Reports/embodied-ai-market-83867232.html) | MarketsandMarkets, 2025 public summary | Embodied AI across robots, exoskeletons, autonomous systems, and smart appliances | $4.44B in 2025 to $23.06B in 2030; 39.0% CAGR | Medium | Useful category confirmation for robotics + AI convergence; excluded from TAM math to avoid double-counting robot/digital-twin/simulation spend. |
| [Synthetic data generation market](https://www.grandviewresearch.com/industry-analysis/synthetic-data-generation-market-report) | Grand View Research, current public summary | Synthetic data generation | $218.4M in 2023 to $1.79B in 2030; 35.3% CAGR | Medium-low | Relevant to synthetic training/evaluation demand, but mostly non-robotics and not capture-backed; excluded from TAM math except as a small adjacent-market check. |
| [Robotics worldwide market forecast](https://www.statista.com/outlook/tmo/robotics/worldwide) | Statista, current public summary | Robotics revenue | $53.64B in 2026; $65.02B in 2030; service robotics $42.69B in 2026; 4.92% CAGR 2026-2030 | Medium-low | Useful low-case top-down anchor; public summary/paywall and category definitions may differ. |
| [Robot orders hold steady in Q1 2026](https://www.businesswire.com/news/home/20260511529781/en/Robot-Orders-Hold-Steady-in-Q1-2026-as-Demand-Broadens-Across-Non-Automotive-Industries) | A3 via BusinessWire, 2026-05-11 | North American robot orders | 9,055 robots ordered for $543M in Q1 2026; cobots 18.1% of units and 12.9% of revenue; cobot units +55.6% YoY | High for North America | Supports non-automotive automation broadening; not global TAM. |
| [Project Genie + Street View](https://blog.google/innovation-and-ai/models-and-research/google-deepmind/project-genie-expands/) | Google / DeepMind / Google Maps, 2026-05-19 | World models grounded in real imagery | Genie with Street View can provide virtual environments for AI agents/robots; AI Ultra rollout globally to eligible subscribers | High for category signal | Why-now signal. Not proof of Blueprint execution or indoor rights coverage. |
| [Waymo World Model](https://waymo.com/blog/2026/02/the-waymo-world-model-a-new-frontier-for-autonomous-driving-simulation/) | Waymo, 2026-02 | AV world-model simulation | Waymo World Model built on Genie 3; counterfactual controllable simulation | High for category signal | Shows world models as deployment infrastructure; AV/outdoor road domain differs from Blueprint's indoor packages. |
| [NVIDIA Cosmos world foundation model platform](https://nvidianews.nvidia.com/news/nvidia-launches-cosmos-world-foundation-model-platform-to-accelerate-physical-ai-development) | NVIDIA, 2025-01-06 | Physical AI / world foundation models | Cosmos platform for physical AI development | High for category signal | Supports physical-AI why-now; not Blueprint-specific. |
| [NVIDIA Omniverse / physical AI](https://www.nvidia.com/en-us/omniverse/) | NVIDIA, current | Physical AI simulation / digital twins | Omniverse for physical AI applications including industrial digital twins and robotics | High for category signal | Supports simulation/digital-twin stack relevance; not market size. |
| [Amazon 1 million robots and DeepFleet](https://www.aboutamazon.com/news/operations/amazon-million-robots-ai-foundation-model) | Amazon, 2025-06-30 | Warehouse/mobile robotics deployment | 1 million robots across 300+ facilities; DeepFleet improves robot fleet travel efficiency by 10% | High | Strong proof of robot-fleet scale and need for site-specific orchestration; Amazon is not a Blueprint customer claim. |
| [Amazon robot fleet overview](https://www.aboutamazon.com/news/operations/amazon-robotics-robots-fulfillment-center) | Amazon, updated 2025-10-22 | Fulfillment robotics | More than 1 million robots deployed since 2012 | High | Supports operations-scale robotics; not directly addressable unless Amazon-like operators buy exact-site packages. |
| [McKinsey: From demos to deployment](https://www.mckinsey.com/capabilities/tech-and-ai/how-we-help-clients/mckinsey-at-ces-2026/from-demos-to-deployment-scaling-robots-means-scaling-trust) | McKinsey, 2026 | Robotics deployment trust | Nearly 2M manufacturing jobs could go unfilled by early 2030s; warehouse turnover remains high | Medium | Useful trust/deployment narrative; no direct TAM used. |

## Market Layering

### Layer 1: Near-Term Wedge TAM

This layer is only package access plus hosted review. It excludes custom enterprise scope so the wedge stays buyer-legible.

Formula:

`wedge TAM = target accounts x sites/account x refresh cadence x (package price + hosted hours x hosted hourly rate)`

| Year | Low | Base | High |
|---|---:|---:|---:|
| 2026 | $96.8M | $790.1M | $4.18B |
| 2030 | $532.0M | $6.14B | $15.88B |
| 2035 | $2.72B | $31.35B | $67.14B |

Interpretation: this is the concrete paid wedge. It is supported by current public pricing, but all adoption/account/site counts are modeled.

### Layer 2: Expansion SAM

This layer adds private/multi-site/custom scope work on top of the wedge. It is the serviceable exact-site indoor package market Blueprint can pursue with capture supply, rights/provenance operations, hosted review, and buyer workflows.

Formula:

`SAM = wedge TAM + (target accounts x custom attach rate x average custom scope)`

| Year | Low | Base | High |
|---|---:|---:|---:|
| 2026 | $116.8M | $970.1M | $5.08B |
| 2030 | $632.0M | $7.49B | $19.48B |
| 2035 | $3.09B | $37.35B | $85.14B |

Interpretation: this is the main serviceable market. It is below the top-down TAM and above the near-term wedge when custom enterprise scope attaches.

### Layer 3: Broad Strategic TAM

This layer is a filtered share of broader robotics, warehouse automation, digital twin, and simulation markets. It is not directly capturable. It says how large the exact-site indoor deployment-infrastructure layer can become if robot deployment, physical AI, and digital twins make real-site data/provenance/rights a standard procurement requirement.

Top-down source-pool formulas:

- 2026 source pool: Statista robotics 2026 `$53.64B` + GVR digital twin 2025 `$35.82B x 1.311` + MarketsandMarkets simulation 2024 `$19.95B x 1.104^2` + GVR warehouse automation 2023 `$19.23B x 1.187^3` = about `$157.1B`. Exact-site indoor filter: low 1.0%, base 3.5%, high 7.5%.
- 2030 source pool: robotics low/base/high uses Statista `$65.02B`, BCG low `$160B`, BCG high `$260B`, plus MarketsandMarkets digital twin `$149.81B`, MarketsandMarkets simulation `$36.22B`, and GVR warehouse automation `$59.52B`. Exact-site indoor filter: low 3.0%, base 6.0%, high 10.0%.
- 2035 source pool: robotics low = Statista 2030 `$65.02B x 1.0492^5`; robotics base = BCG `$160B x 1.06^5`; robotics high = BCG `$260B x 1.08^5`; digital twin low/base/high uses Fact.MR `$177.5B`, GVR 2033 `$328.51B x 1.20^2`, and Emergen `$686.99B`; simulation uses IMARC `$44.3B x 1.1027`; warehouse automation uses GVR `$59.52B x 1.06^5`. Exact-site indoor filter: low 5.0%, base 10.0%, high 18.0%.

Embodied AI and synthetic data market reports are used as category checks, not direct source-pool inputs. They overlap with robotics, simulation, computer vision, and digital-twin spend, and most synthetic data revenue is not capture-backed indoor site data.

| Year | Low | Base | High |
|---|---:|---:|---:|
| 2026 | $1.6B | $5.5B | $11.8B |
| 2030 | $9.3B | $24.3B | $50.6B |
| 2035 | $19.4B | $81.6B | $215.6B |

Sanity check: the modeled SAM remains below broad strategic TAM in every same-year scenario.

## Bottom-Up Model Detail

Current Blueprint public prices:

- Package access: `$2,100-$3,400` per exact site.
- Hosted review: `$16-$29` per session-hour.
- Custom scope: `$50,000+` scoped.

Modeled assumptions:

| Year / case | Target accounts | Sites/account | Refresh cadence | Hosted hours/site | Package price | Hosted rate | Custom attach | Avg custom scope |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 2026 low | 8,000 | 5 | 1.00x | 20 | $2,100 | $16 | 5% | $50,000 |
| 2026 base | 30,000 | 7 | 1.00x | 45 | $2,750 | $22.50 | 8% | $75,000 |
| 2026 high | 75,000 | 8 | 1.25x | 75 | $3,400 | $29 | 12% | $100,000 |
| 2030 low | 25,000 | 8 | 1.00x | 35 | $2,100 | $16 | 8% | $50,000 |
| 2030 base | 90,000 | 12 | 1.25x | 80 | $2,750 | $22.50 | 15% | $100,000 |
| 2030 high | 120,000 | 14 | 1.50x | 100 | $3,400 | $29 | 20% | $150,000 |
| 2035 low | 75,000 | 10 | 1.25x | 50 | $2,100 | $16 | 10% | $50,000 |
| 2035 base | 200,000 | 20 | 1.50x | 110 | $2,750 | $22.50 | 20% | $150,000 |
| 2035 high | 300,000 | 20 | 1.50x | 140 | $3,400 | $29 | 30% | $200,000 |

Outputs:

| Year / case | Site review events | Revenue/event | Wedge revenue | Custom revenue | SAM |
|---|---:|---:|---:|---:|---:|
| 2026 low | 40,000 | $2,420 | $96.8M | $20.0M | $116.8M |
| 2026 base | 210,000 | $3,762.50 | $790.1M | $180.0M | $970.1M |
| 2026 high | 750,000 | $5,575 | $4.18B | $900.0M | $5.08B |
| 2030 low | 200,000 | $2,660 | $532.0M | $100.0M | $632.0M |
| 2030 base | 1,350,000 | $4,550 | $6.14B | $1.35B | $7.49B |
| 2030 high | 2,520,000 | $6,300 | $15.88B | $3.60B | $19.48B |
| 2035 low | 937,500 | $2,900 | $2.72B | $375.0M | $3.09B |
| 2035 base | 6,000,000 | $5,225 | $31.35B | $6.00B | $37.35B |
| 2035 high | 9,000,000 | $7,460 | $67.14B | $18.00B | $85.14B |

Why the account counts are defensible as a model, not a source claim:

- IFR counted 944 service-robot producers globally and 333 logistics robot suppliers in the 2025 service-robot report; those are only producers, not integrators, enterprise robotics teams, site operators, or automation buyers.
- IFR industrial and service-robot unit flows show a multi-million-unit deployed base and hundreds of thousands of annual unit sales before counting every integrator, robot software team, warehouse automation team, retail automation team, healthcare/lab automation team, or large operator.
- A3's Q1 2026 North American order data shows non-automotive automation demand broadening even while automotive OEMs were cyclical.
- Gartner's 2030 warehouse forecasts imply a shift from robot pilots to robot-centric facility design, increasing the number of sites that need pre-deployment simulation, review, and rights-aware exact-site data.

## SOM Model

SOM is modeled as a percentage of SAM, not as existing Blueprint revenue or traction.

Assumed capture rates:

- 2026 low/base/high: 0.8%, 0.75%, 0.8% of the reachable SAM slice, where reachable slice equals 18%-25% of SAM depending on scenario.
- 2030 low/base/high: 6.0%, 4.5%, 6.0% of reachable SAM, where reachable slice equals 24%-28% of SAM.
- 2035 low/base/high: 12.0%, 9.0%, 10.0% of reachable SAM, where reachable slice equals 30% of SAM.

| Year / case | SAM | Reachable slice | Reachable market | Capture of reachable market | SOM |
|---|---:|---:|---:|---:|---:|
| 2026 low | $116.8M | 25% | $29.2M | 0.8% | $0.23M |
| 2026 base | $970.1M | 22% | $213.4M | 0.75% | $1.60M |
| 2026 high | $5.08B | 18% | $914.6M | 0.8% | $7.32M |
| 2030 low | $632.0M | 28% | $177.0M | 6.0% | $10.62M |
| 2030 base | $7.49B | 26% | $1.95B | 4.5% | $87.66M |
| 2030 high | $19.48B | 24% | $4.67B | 6.0% | $280.45M |
| 2035 low | $3.09B | 30% | $928.1M | 12.0% | $111.38M |
| 2035 base | $37.35B | 30% | $11.21B | 9.0% | $1.01B |
| 2035 high | $85.14B | 30% | $25.54B | 10.0% | $2.55B |

SOM interpretation:

- The 2026 SOM range is a narrow wedge outcome, not an operational-readiness claim.
- The 2030 SOM range assumes repeatable city/vertical playbooks, recipient-backed GTM, proof-ready hosted review artifacts, and enough capture supply to serve multiple verticals.
- The 2035 SOM range requires Blueprint to become a category layer for indoor robot-deployment data, not merely a services business.

## Top-Down Sanity Checks

The broad market cannot be presented as directly capturable revenue. It is used only to bound the model.

- IFR shows a 4.664M-unit operational industrial robot base and 542,000 new industrial installations in 2024. If even a small share of those robot deployments move into variable indoor settings that need exact-site evaluation, the package layer can support a multi-billion-dollar serviceable market.
- IFR's service robot data shows 102,900 logistics/transport service robots sold in 2024. Logistics robots are the cleanest wedge because their workflows depend on route, aisle, obstacle, shelf, lift, dock, and human-interaction conditions.
- Interact Analysis puts mobile-robot revenue at just under $5B in 2024 and $14B by 2030, focused on material handling in manufacturing/logistics. A $7.49B 2030 base SAM for exact-site packages is aggressive only if interpreted as a slice of robot hardware revenue; it is more plausible when interpreted as recurring package, review, custom, and deployment-infrastructure spend across robot teams, integrators, and operators.
- Gartner's 2030 warehouse view says design shifts toward robot-centric facilities and digital twins/simulation early in the design process. That is directly supportive of site packages and hosted review because the buyer problem becomes "will this workflow work in this facility?" before robots arrive.
- Digital twin and simulation market forecasts are large and noisy. This memo filters them heavily because general digital twin spend includes plant twins, asset twins, process twins, infrastructure twins, and IT/service twins that Blueprint should not claim.
- Embodied AI and synthetic data markets confirm demand for real-world training/evaluation data, but they are intentionally not added into the top-down pool because doing so would double-count robotics and simulation spend while overstating Blueprint's capture-backed indoor slice.

## Why Now

The market is pulling in Blueprint's direction for five reasons:

1. **Robots are leaving fixed cells.** IFR, A3, and Interact Analysis show robot adoption expanding beyond traditional industrial use into mobile logistics, cobots, service robots, cleaning, healthcare/labs, and heterogeneous fleets.
2. **Warehouses are being designed around robots.** Gartner's 2030 warehouse prediction makes exact-site simulation and review part of facility strategy, not a late-stage demo.
3. **World models made real-place simulation legible.** Google's Street View-grounded Genie and Waymo's world model show that real-world imagery plus generative simulation is becoming a category buyers understand. Blueprint's opportunity is the indoor rights/provenance layer that public maps do not cover.
4. **Physical AI stacks need data, not just models.** NVIDIA Cosmos/Omniverse, Deloitte's AI-for-robots forecast, and BCG's physical-AI capability framing all point to simulation, data quality, and workflow validation as key bottlenecks.
5. **Large operators prove site-specific robotics is already operationally complex.** Amazon's 1M-robot fleet and DeepFleet system show that when robots reach scale, facility-specific routing, orchestration, and efficiency become core infrastructure.

## ICPs and First Verticals

### First ICPs

1. **Robot teams evaluating indoor deployment.** Mobile robot, manipulation, inventory, cleaning, inspection, service, humanoid, and lab automation teams that need exact sites before travel or production pilots.
2. **Systems integrators and automation solution providers.** Teams preparing robot deployments for customers and needing package/proof artifacts to shorten discovery, layout review, and pilot scoping.
3. **Large operators with internal robotics/automation teams.** 3PLs, retailers, grocers, manufacturers, hospitals, lab networks, hotels, airports, and campus/facility operators.
4. **Physical AI / simulation teams.** Teams that need capture-backed indoor data and scenario review for model evaluation, synthetic data, or site adaptation.
5. **Site operators as optional lane.** Operators matter when access, rights, privacy, or commercialization requires their involvement; they are not the only buyer.

### First Verticals

Priority order:

1. Warehousing, 3PL, fulfillment, parcel, and grocery distribution.
2. Manufacturing cells and intralogistics routes.
3. Retail stores, back rooms, micro-fulfillment, and shopping-center service paths.
4. Healthcare, labs, pharmacies, and hospital service corridors.
5. Hospitality, airports, campuses, and public-facing service environments.

The first two verticals should dominate 2026 because the source base is strongest: IFR logistics robots, Interact mobile robots, Gartner warehouse forecasts, and Amazon-scale examples all converge there.

## Buyer Workflow

The buyer motion should stay narrow:

1. Buyer names one exact site, robot workflow, deployment question, and desired path.
2. Blueprint routes the request to an existing package, a hosted review, a new capture request, or a custom scope.
3. Capture proof, rights/privacy limits, freshness, package scope, and hosted-review availability stay attached.
4. Hosted review produces run notes, observations, export/recapture decisions, and buyer next steps.
5. Expansion follows the same proof chain: more sites, refresh/recapture cadence, deeper hosted hours, custom rights, integrations, enterprise terms, and optional data/simulation licensing.

This keeps qualification/readiness as support evidence rather than the product center.

## GTM Path to Reach the Market

### 2026: Wedge Proof

Objective: prove the repeatable paid motion for Exact-Site Hosted Review without inventing traction.

Actions:

- Keep the lead magnet as Exact-Site Hosted Review: one site, one robot workflow, one proof artifact, one next step.
- Split `proof_ready_outreach` from `demand_sourced_capture`.
- Build a 30-50 target ledger for robot teams and integrators with real buying signals.
- Prioritize logistics, fulfillment, grocery, manufacturing, and service-robot teams.
- Use package access and hosted review pricing as the first commercial path; use `$50,000+` custom scope only for private/multi-site/operator-heavy work.
- Build capturer supply around high-demand site types, not generic city excitement.
- Route site operators only when access/rights/commercialization materially changes the package.

Milestones:

- First repeatable proof-ready package workflow.
- First recipient-backed buyer target batch.
- First qualified organic signal: reply, hosted-review start, qualified call, exact-site request, or capture request tied to a buyer workflow.
- First city/vertical buyer-loop artifact showing targets, contacts, approval state, send/reply state, hosted-review starts, calls, and blockers.

### 2030: Vertical Expansion

Objective: become the site-package and hosted-review layer for robot-centric indoor facilities.

Actions:

- Expand from logistics to manufacturing, retail, healthcare/labs, hospitality/service, and campus/facility environments.
- Convert city/vertical launch playbooks into repeatable market-entry motions.
- Add refresh/recapture cadence as a standard commercial expectation.
- Add enterprise package management: multi-site contracts, access roles, audit trails, usage/hosted-review logs, data licensing, and custom exports.
- Build integrations with robot-team workflows: simulation import/export, scenario notes, route metadata, rights sheet, site freshness, and model-provider adapters.
- Keep provider-swappable world-model infrastructure so NVIDIA/Google/Waymo-like world-model progress increases Blueprint package value rather than commoditizing it.

Milestones:

- Multi-vertical package catalog with proof labels.
- Repeatable capturer supply flywheel in priority cities.
- Enterprise custom scope motion with rights/provenance audit evidence.
- Hosted review used as buyer procurement evidence before robot pilots.

### 2035: Category Infrastructure

Objective: make exact-site indoor packages and hosted review a required layer in physical AI deployment.

Actions:

- Treat site data, rights, provenance, freshness, and hosted evaluation as procurement primitives.
- Sell package + hosted review + refresh/recapture + enterprise scope as a recurring deployment-infrastructure stack.
- Support a broader set of world-model backends, simulation engines, and robot-team import/export contracts.
- Build a rights-aware operator commercialization lane while preserving buyer-led and capturer-led acquisition.
- Use buyer feedback to guide new captures and improve package value over time.

Milestones:

- Category-standard proof schema for indoor robot deployment packages.
- Multi-market supply and enterprise account coverage.
- Data-quality and rights/provenance moat that compounds as world-model backends improve.
- Revenue mix shifts from one-off packages toward recurring review, refresh, enterprise, and data/simulation licensing.

## Risks and Source Limitations

- Broad robotics, digital twin, and simulation forecasts overlap; they cannot be added without filters.
- Digital twin forecasts are especially dispersed. The memo uses them only as ceiling signals and applies heavy exact-site indoor filters.
- 2035 is inherently model-driven. The sources provide some 2035 digital twin estimates, but robotics and warehouse automation need extrapolation.
- Site/operator rights clearance, live hosted-session fulfillment, payments, city coverage, provider execution, and customer traction are not claimed here.
- Site-package demand depends on robot teams accepting exact-site review as a procurement step. The GTM plan must prove that motion with real buyer signals, not just market logic.

## Pitch-Deck-Ready Slides

### Slide 1: Market

Headline: **Indoor physical AI needs an exact-site data layer.**

- Robots are moving from fixed cells into warehouses, stores, labs, hospitals, plants, and service corridors.
- Blueprint's modeled broad TAM: **$1.6B-$11.8B in 2026, $9.3B-$50.6B in 2030, $19.4B-$215.6B in 2035**.
- Blueprint's serviceable exact-site package SAM: **$0.12B-$5.08B in 2026, $0.63B-$19.48B in 2030, $3.09B-$85.14B in 2035**.
- Wedge: package access at `$2,100-$3,400/site` plus hosted review at `$16-$29/session-hour`, expanding into `$50,000+` custom scope.
- The market is not robot hardware. It is the proof/provenance/rights/hosted-review layer before robot deployment.

### Slide 2: Why Now

Headline: **World models made real-place simulation legible; robots made indoor data urgent.**

- IFR: 542,000 industrial robots installed in 2024 and 4.664M in operation.
- IFR: almost 200,000 professional service robots sold in 2024; logistics/transport is the largest service category.
- Gartner: by 2030, 50% of new developed-market warehouses are expected to be robot-centric/human-optional.
- Google/Waymo/NVIDIA validate world models and physical-AI simulation as a mainstream category.
- The gap: public outdoor maps and generic simulation do not solve indoor rights, provenance, freshness, and exact workflow context.

### Slide 3: Wedge to Platform

Headline: **Start with Exact-Site Hosted Review; expand into indoor deployment infrastructure.**

- Wedge: one real site, one robot workflow, one package, one hosted review.
- Package: capture manifest, route notes, model artifacts, rights sheet, freshness, and approved exports.
- Hosted review: managed buyer room for run notes, observations, reruns, export, recapture, or hold decisions.
- Expansion: refresh/recapture cadence, multi-site accounts, private-site scope, data/simulation licensing, and enterprise access controls.
- Moat: capture supply + rights/provenance + package contracts + buyer workflow + feedback loops.

### Slide 4: Market Expansion Roadmap

Headline: **Logistics first, then every indoor operating environment robots must understand.**

- 2026: logistics, fulfillment, grocery, manufacturing intralogistics, service robots; prove buyer-led Exact-Site Hosted Review.
- 2030: multi-vertical expansion across retail, healthcare/labs, hospitality/service, campuses, and manufacturing.
- 2035: exact-site packages become standard infrastructure for physical AI deployment, evaluation, data licensing, and procurement.
- Supply flywheel: buyer demand identifies sites -> capturers produce proof -> packages enter hosted review -> buyer usage funds refresh and more capture.
- Operator lane: access/rights/commercialization path when useful, not a universal prerequisite.

### Slide 5: Assumptions Footnote

Headline: **Every market number is filtered or modeled.**

- Broad TAM is a filtered share of robotics, warehouse automation, digital twin, and simulation markets; broad market spend is not treated as directly capturable.
- SAM is bottom-up from target accounts, sites/account, refresh cadence, package price, hosted-review hours, and custom-scope attach rate.
- SOM is a modeled capture of the reachable SAM slice, not a current revenue or traction claim.
- Source confidence is highest for IFR/Gartner/Interact/A3/company primary sources and lower for paywalled public market-report summaries.
- Live customer traction, rights clearance, payments, city coverage, provider execution, and hosted-session fulfillment are not claimed.
