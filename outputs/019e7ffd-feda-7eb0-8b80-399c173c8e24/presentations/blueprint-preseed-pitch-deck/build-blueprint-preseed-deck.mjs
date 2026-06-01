import fs from "node:fs/promises";
import path from "node:path";

const repo = "/Users/nijelhunt_1/workspace/Blueprint-WebApp";
const workspace = path.join(
  repo,
  "outputs/019e7ffd-feda-7eb0-8b80-399c173c8e24/presentations/blueprint-preseed-pitch-deck",
);
const slidesDir = path.join(workspace, "slides");
const outputDir = path.join(workspace, "output");

async function write(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content.trimStart(), "utf8");
}

const helper = `
export const repoRoot = "/Users/nijelhunt_1/workspace/Blueprint-WebApp";
export const outputDir = "/Users/nijelhunt_1/workspace/Blueprint-WebApp/outputs/019e7ffd-feda-7eb0-8b80-399c173c8e24/presentations/blueprint-preseed-pitch-deck/output";

export const C = {
  ink: "#15130F",
  paper: "#F5F1E8",
  paper2: "#FFFDF7",
  blue: "#2456D6",
  blue2: "#6E8DFF",
  green: "#B9F24A",
  coral: "#FF6B4A",
  clay: "#B56A42",
  slate: "#505864",
  mute: "#7A776F",
  line: "#D8D0C2",
  dark: "#0D0D0B",
  white: "#FFFFFF",
};

export function bg(slide, ctx, fill = C.paper) {
  ctx.addShape(slide, { x: 0, y: 0, w: ctx.W, h: ctx.H, fill, line: ctx.line("#00000000", 0) });
}

export function rect(slide, ctx, x, y, w, h, fill, line = "#00000000", width = 0, name) {
  return ctx.addShape(slide, { x, y, w, h, fill, line: ctx.line(line, width), name });
}

export function rule(slide, ctx, x, y, w, color = C.ink, height = 1, name) {
  return rect(slide, ctx, x, y, w, height, color, color, 0, name);
}

export function text(slide, ctx, value, x, y, w, h, opts = {}) {
  return ctx.addText(slide, {
    text: value,
    x,
    y,
    w,
    h,
    fontSize: opts.size ?? 22,
    color: opts.color ?? C.ink,
    bold: opts.bold ?? false,
    typeface: opts.face ?? (opts.display ? ctx.fonts.title : ctx.fonts.body),
    align: opts.align ?? "left",
    valign: opts.valign ?? "top",
    fill: opts.fill ?? "#00000000",
    line: ctx.line(opts.line ?? "#00000000", opts.lineWidth ?? 0),
    insets: opts.insets ?? { left: 0, right: 0, top: 0, bottom: 0 },
    name: opts.name,
  });
}

export async function image(slide, ctx, rel, x, y, w, h, opts = {}) {
  return ctx.addImage(slide, {
    path: rel.startsWith("/") ? rel : repoRoot + "/" + rel,
    x,
    y,
    w,
    h,
    fit: opts.fit ?? "cover",
    alt: opts.alt ?? "",
    name: opts.name,
  });
}

export function kicker(slide, ctx, label, opts = {}) {
  const dark = opts.dark ?? false;
  const x = opts.x ?? 62;
  const y = opts.y ?? 44;
  const markerColor = opts.color ?? C.blue;
  const labelColor = dark ? C.white : C.ink;
  const id = String(ctx.slideNumber || "x").padStart(2, "0");
  rect(slide, ctx, x, y + 6, 36, 8, markerColor, markerColor, 0, "kicker-" + id + "-marker");
  text(slide, ctx, label, x + 50, y, 420, 22, {
    size: 11,
    bold: true,
    color: labelColor,
    valign: "mid",
    name: "kicker-" + id + "-label",
  });
}

export function title(slide, ctx, value, x = 62, y = 86, w = 790, h = 112, opts = {}) {
  return text(slide, ctx, value, x, y, w, h, {
    size: opts.size ?? 46,
    display: true,
    bold: true,
    color: opts.color ?? C.ink,
    valign: "top",
    line: "#00000000",
  });
}

export function subtitle(slide, ctx, value, x, y, w, h, opts = {}) {
  return text(slide, ctx, value, x, y, w, h, {
    size: opts.size ?? 21,
    color: opts.color ?? C.slate,
    valign: "top",
    line: "#00000000",
  });
}

export function footer(slide, ctx, sources, opts = {}) {
  const dark = opts.dark ?? false;
  rule(slide, ctx, 62, 670, 1080, dark ? "#FFFFFF22" : "#15130F20", 1);
  text(slide, ctx, sources, 62, 682, 900, 16, {
    size: 9,
    color: dark ? "#FFFFFF88" : "#5C564C",
  });
  const id = String(ctx.slideNumber || 0).padStart(2, "0");
  text(slide, ctx, id, 1160, 676, 44, 22, {
    size: 11,
    bold: true,
    color: dark ? "#FFFFFFAA" : C.ink,
    align: "right",
    valign: "mid",
  });
}

export function pill(slide, ctx, value, x, y, w, opts = {}) {
  rect(slide, ctx, x, y, w, 32, opts.fill ?? C.ink, opts.line ?? "#00000000", 0);
  text(slide, ctx, value, x + 12, y + 7, w - 24, 16, {
    size: opts.size ?? 11,
    bold: true,
    color: opts.color ?? C.white,
    valign: "mid",
  });
}

export function metric(slide, ctx, value, label, x, y, w, opts = {}) {
  text(slide, ctx, value, x, y, w, 46, {
    size: opts.valueSize ?? 38,
    bold: true,
    display: true,
    color: opts.color ?? C.ink,
  });
  text(slide, ctx, label, x, y + 50, w, 42, {
    size: opts.labelSize ?? 13,
    color: opts.labelColor ?? C.slate,
  });
}

export function card(slide, ctx, x, y, w, h, opts = {}) {
  rect(slide, ctx, x, y, w, h, opts.fill ?? C.paper2, opts.line ?? C.line, opts.lineWidth ?? 1);
}

export function bar(slide, ctx, label, value, max, x, y, w, color, opts = {}) {
  text(slide, ctx, label, x, y - 2, 190, 26, { size: opts.size ?? 14, bold: opts.bold ?? false });
  rect(slide, ctx, x + 205, y + 3, w, 10, "#E4DDD1", "#00000000", 0);
  rect(slide, ctx, x + 205, y + 3, Math.max(2, w * value / max), 10, color, color, 0);
  text(slide, ctx, opts.valueLabel ?? String(value), x + 220 + w, y - 2, 90, 24, {
    size: 13,
    bold: true,
    color: C.ink,
  });
}

export function step(slide, ctx, n, heading, body, x, y, w, opts = {}) {
  rect(slide, ctx, x, y, 38, 38, opts.color ?? C.blue, opts.color ?? C.blue, 0);
  text(slide, ctx, n, x + 8, y + 8, 22, 16, { size: 13, bold: true, color: C.white, align: "center" });
  text(slide, ctx, heading, x + 50, y - 2, w - 50, 28, { size: 20, bold: true });
  text(slide, ctx, body, x + 50, y + 31, w - 50, 60, { size: 14, color: C.slate });
}

export function notes(slide, body) {
  slide.speakerNotes.setText(body.trim());
}
`;

const profilePlan = `
Task mode: create
Primary deck-profile: product-platform
Secondary gates: gtm-growth, appendix-heavy/source-ledger

Required proof objects:
- Platform map across BlueprintCapture, BlueprintCapturePipeline, Blueprint-WebApp, and Paperclip/autonomous org.
- Exact-Site Hosted Review workflow tied to current WebApp product truth.
- Pricing and monetization bridge from current repo pricing surface.
- Market evidence frame with modeled TAM/SAM/SOM clearly labeled as modeled, not copied from any report.
- GTM loop tied to repo GTM pilot doctrine.
- Blocked-claims slide and source ledger.

Brand/authenticity constraints:
- Do not fabricate customer, partner, or provider logos.
- Use Blueprint text mark and repo-owned/generated visual assets only as illustrative assets, not capture proof.
- Use source IDs and a separate ledger for every market, product, and pricing claim.

Known missing inputs:
- Final raise amount, valuation, runway, committed investor/customer logos, and verified live payment/hosted-fulfillment proof were not provided. Deck avoids those claims.
`;

const sourceLedger = `
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
`;

const dataJson = {
  generatedAt: "2026-05-31",
  deckTitle: "Blueprint Pre-Seed Pitch Deck",
  marketModel: {
    source: "docs/research/2026-05-31-blueprint-tam-market-research.md",
    note: "Modeled estimates, not copied from a single market report.",
    rows: [
      { year: 2026, tam: "$1.6B-$11.8B", sam: "$0.12B-$5.08B", som: "$0.23M-$7.32M" },
      { year: 2030, tam: "$9.3B-$50.6B", sam: "$0.63B-$19.48B", som: "$10.62M-$280.45M" },
      { year: 2035, tam: "$19.4B-$215.6B", sam: "$3.09B-$85.14B", som: "$111.38M-$2.55B" },
    ],
  },
  pricing: [
    { path: "Package access", range: "$2,100-$3,400" },
    { path: "Hosted review", range: "$16-$29 / session-hour" },
    { path: "Custom scope", range: "$50,000+ scoped" },
  ],
};

const claimSpine = `
Thesis: Blueprint is the site-data and hosted-evaluation layer for indoor physical AI: capture-backed exact-site world-model packages, rights/provenance, and buyer review before robots enter the field.
Audience: Pre-seed investors evaluating category timing, product wedge, market shape, and proof discipline.
Arc: why now -> exact-site problem -> Blueprint product system -> market and wedge economics -> GTM loop -> moat -> raise frame -> evidence boundaries.

Slide list:
1. Blueprint turns exact indoor sites into world-model products. Proof: wedge/product/boundary rail. Sources: R1 R2 R7.
2. Robots are moving into places that need site-specific proof. Proof: robotics/world-model evidence grid. Sources: W1 W2 W3 W8 W9 W10 W11.
3. The missing layer is not another demo; it is exact-site decision evidence. Proof: evaluation gap diagram. Sources: R1 R4 R7 W7.
4. Model backends can swap; site truth compounds. Proof: swappable/stable contract split. Sources: R2 R5 W10.
5. Exact-Site Hosted Review is the wedge. Proof: capture -> package -> hosted review -> export/recapture workflow. Sources: R4 R5.
6. Blueprint is already shaped as a multi-repo product system. Proof: platform architecture map. Sources: R1 R2 R8.
7. The first monetization path is package access plus hosted review. Proof: pricing bridge. Sources: R3 R7.
8. The serviceable market is modeled from exact-site package demand, not robot hardware. Proof: TAM/SAM/SOM table. Sources: M1 W3 W4 W12 W13 W14 W15.
9. Start where site specificity is already expensive. Proof: ICP/vertical map and evidence rail. Sources: W2 W3 W4 W5 W11.
10. GTM is one site, one workflow, one proof artifact, one next step. Proof: two-track GTM loop. Sources: R6.
11. The moat is the capture -> package -> buyer usage -> more capture flywheel. Proof: flywheel diagram. Sources: R1 R2 R5.
12. The operating system turns the wedge into repeatable proof. Proof: product/proof, demand/sales, reliability loops. Sources: R6 R8.
13. The pre-seed raise should fund wedge proof into repeatability. Proof: roadmap and use-of-funds lanes. Sources: R2 R6.
14. Evidence boundaries are explicit before this deck leaves the repo. Proof: blocked claims + source ledger. Sources: R7 plus source ledger.
`;

const designSystem = `
Slide size: 1280x720.
Background: warm paper with deep ink and occasional dark editorial slides.
Typography: Aptos Display for claims; Aptos for body and source labels.
Palette: ink #15130F, paper #F5F1E8, white #FFFFFF, Blueprint blue #2456D6, support green #B9F24A, coral #FF6B4A, clay #B56A42, muted slate #505864.
Chart grammar: editable rectangles, direct labels, source IDs in quiet footer.
Diagram grammar: squared lanes and proof rails; no decorative arrows unless sequencing matters.
Containers: squared panels only when they encode lanes, proof objects, or comparison groups.
Source/footer: slide number right, source IDs left, small and quiet.
Kicker: named marker and label pairs via helper; centerline aligned.
Brand policy: no customer/provider logos; no pseudo-official marks. Repo-owned generated visuals are illustrative only.
Layout families: cover visual field, metrics grid, evaluation gap diagram, split contract comparison, workflow rail, architecture map, pricing bridge, market table, ICP map, GTM loop, flywheel, ops loop, roadmap, evidence appendix.
Banned motifs: generic SaaS dashboards, fake logos, broad apology language, operational readiness claims, decorative blobs/orbs.
`;

const contactSheetPlan = `
Macro-layout cadence:
1. Cover with image field and proof rail.
2. Evidence grid with metrics and category proof.
3. Evaluation gap diagram.
4. Split contract comparison.
5. Workflow rail with image accent.
6. Architecture layer map.
7. Monetization bridge.
8. Market model table.
9. ICP/vertical map.
10. GTM loop.
11. Flywheel.
12. Operating-loop map.
13. Roadmap/use-of-funds.
14. Evidence appendix.

No three consecutive slides share the same composition. No customer or partner identity assets are used.
`;

function slideModule(number, body) {
  const name = String(number).padStart(2, "0");
  return `
import { C, bg, rect, rule, text, image, kicker, title, subtitle, footer, pill, metric, card, bar, step, notes, outputDir } from "./_helpers.mjs";

export async function slide${name}(presentation, ctx) {
  const slide = presentation.slides.add();
${body}
  return slide;
}
`;
}

const slides = [
  slideModule(1, `
  bg(slide, ctx, C.dark);
  await image(slide, ctx, "client/public/generated/public-capture-2026-04-23/everyday-places-collage.png", 742, 0, 538, 720, { alt: "Illustrative collage of everyday public-facing indoor sites" });
  rect(slide, ctx, 0, 0, 1280, 720, "#00000000", "#00000000", 0);
  rect(slide, ctx, 690, 0, 230, 720, "#0D0D0BB0", "#00000000", 0);
  kicker(slide, ctx, "PRE-SEED DECK", { dark: true, color: C.green });
  text(slide, ctx, "BLUEPRINT", 62, 92, 380, 34, { size: 24, bold: true, color: C.white });
  title(slide, ctx, "Exact sites become world-model products.", 62, 154, 640, 196, { color: C.white, size: 52 });
  subtitle(slide, ctx, "Capture-backed indoor site packages and hosted review for robot teams deciding before field time.", 64, 374, 570, 70, { color: "#FFFFFFCC", size: 22 });
  pill(slide, ctx, "Wedge: Exact-Site Hosted Review", 64, 456, 266, { fill: C.green, color: C.ink });
  pill(slide, ctx, "Product: site package + hosted evaluation", 344, 456, 326, { fill: C.white, color: C.ink });
  pill(slide, ctx, "Boundary: live proof confirmed per request", 64, 502, 346, { fill: "#FFFFFF22", color: C.white });
  rule(slide, ctx, 62, 670, 610, "#FFFFFF22", 1);
  text(slide, ctx, "Sources: R1 R2 R7. Visual asset is repo-generated and illustrative, not capture proof.", 62, 682, 520, 16, { size: 8, color: "#FFFFFF88" });
  text(slide, ctx, "01", 628, 676, 44, 22, { size: 11, bold: true, color: "#FFFFFFAA", align: "right", valign: "mid" });
  notes(slide, "Open with the product category and the proof boundary. Blueprint is not being pitched as a generic model checkpoint company. The wedge is Exact-Site Hosted Review: one real indoor site, one workflow, one package, one hosted review path. Do not imply live fulfillment for a specific buyer; the deck keeps that per-request.");
`),
  slideModule(2, `
  bg(slide, ctx, C.paper);
  kicker(slide, ctx, "WHY NOW");
  title(slide, ctx, "Robots are moving into places that need site-specific proof.", 62, 86, 780, 112);
  subtitle(slide, ctx, "World models made real-place simulation legible. Robotics adoption makes indoor site data urgent.", 64, 210, 780, 52);
  metric(slide, ctx, "542K", "industrial robots installed in 2024", 70, 292, 220, { color: C.blue });
  metric(slide, ctx, "4.664M", "industrial robots in operation worldwide", 318, 292, 270, { color: C.ink });
  metric(slide, ctx, ">199K", "professional service robots sold in 2024", 620, 292, 270, { color: C.coral });
  metric(slide, ctx, "50%", "new developed-market warehouses expected robot-centric by 2030", 924, 292, 260, { color: C.clay, labelSize: 12 });
  rule(slide, ctx, 64, 425, 820, "#15130F22", 1);
  card(slide, ctx, 64, 458, 350, 136, { fill: "#FFFFFFB0" });
  text(slide, ctx, "Real-place world models", 88, 480, 280, 24, { size: 19, bold: true });
  text(slide, ctx, "Google connected Genie with Street View so virtual environments can be anchored in reality for agents or robots.", 88, 514, 286, 56, { size: 13, color: C.slate });
  card(slide, ctx, 450, 458, 350, 136, { fill: "#FFFFFFB0" });
  text(slide, ctx, "Counterfactual simulation", 474, 480, 280, 24, { size: 19, bold: true });
  text(slide, ctx, "Waymo adapted a world model for driving-domain simulation, including rare events that are hard to capture at scale.", 474, 514, 286, 56, { size: 13, color: C.slate });
  card(slide, ctx, 836, 458, 350, 136, { fill: "#FFFFFFB0" });
  text(slide, ctx, "Physical AI tooling", 860, 480, 280, 24, { size: 19, bold: true });
  text(slide, ctx, "NVIDIA Cosmos frames world foundation models around robots, AVs, synthetic data, and physical-AI evaluation.", 860, 514, 286, 56, { size: 13, color: C.slate });
  footer(slide, ctx, "Sources: W1 W2 W3 W8 W9 W10 W11.");
  notes(slide, "This slide establishes category timing. The key point is not that these sources prove Blueprint execution. They show demand shifting toward robot-centric facilities and world-model/simulation infrastructure. The Blueprint wedge is the indoor rights and provenance layer missing from public outdoor maps and generic simulations.");
`),
  slideModule(3, `
  bg(slide, ctx, C.paper2);
  kicker(slide, ctx, "PROBLEM");
  title(slide, ctx, "The missing layer is not another demo; it is exact-site decision evidence.", 62, 86, 860, 112);
  subtitle(slide, ctx, "Robot teams need to know whether a workflow can survive one real facility before travel, pilots, or file handoff.", 64, 198, 750, 48);
  rect(slide, ctx, 72, 306, 210, 86, C.ink, C.ink, 0);
  text(slide, ctx, "Robot team", 96, 326, 150, 20, { size: 19, bold: true, color: C.white });
  text(slide, ctx, "One deployment question", 96, 356, 150, 20, { size: 13, color: "#FFFFFFAA" });
  rect(slide, ctx, 355, 306, 246, 86, "#E7DFD3", "#CFC4B5", 1);
  text(slide, ctx, "Generic demo", 384, 326, 190, 22, { size: 19, bold: true });
  text(slide, ctx, "No exact route, rights, freshness, or provenance", 384, 354, 170, 36, { size: 12, color: C.slate });
  rect(slide, ctx, 674, 306, 246, 86, "#E7DFD3", "#CFC4B5", 1);
  text(slide, ctx, "Field pilot", 704, 326, 190, 22, { size: 19, bold: true });
  text(slide, ctx, "Too late to learn the site is wrong", 704, 354, 170, 36, { size: 12, color: C.slate });
  rect(slide, ctx, 982, 306, 170, 86, C.coral, C.coral, 0);
  text(slide, ctx, "Cost and delay", 1008, 326, 120, 22, { size: 18, bold: true, color: C.white });
  rule(slide, ctx, 282, 349, 73, C.ink, 2);
  rule(slide, ctx, 601, 349, 73, C.ink, 2);
  rule(slide, ctx, 920, 349, 62, C.ink, 2);
  rect(slide, ctx, 348, 470, 330, 88, C.blue, C.blue, 0);
  text(slide, ctx, "Exact-site package", 378, 492, 220, 22, { size: 21, bold: true, color: C.white });
  text(slide, ctx, "Capture manifest, route notes, proof labels, rights boundaries, hosted review.", 378, 522, 252, 32, { size: 12, color: "#FFFFFFCC" });
  rect(slide, ctx, 720, 470, 330, 88, C.green, C.green, 0);
  text(slide, ctx, "Pre-field decision", 750, 492, 250, 22, { size: 21, bold: true, color: C.ink });
  text(slide, ctx, "Approve export, request recapture, scope custom work, or hold.", 750, 522, 252, 32, { size: 12, color: C.ink });
  footer(slide, ctx, "Sources: R1 R4 R7 W7 W8 W9.");
  notes(slide, "Frame the pain around deployment uncertainty. The customer does not need another impressive demo; they need a package that keeps the exact site, route, rights, freshness, and hosted-review evidence together. Keep this slide grounded in buyer workflow rather than readiness theater.");
`),
  slideModule(4, `
  bg(slide, ctx, C.dark);
  kicker(slide, ctx, "INSIGHT", { dark: true, color: C.green });
  title(slide, ctx, "Model backends can swap; site truth compounds.", 62, 86, 770, 112, { color: C.white });
  subtitle(slide, ctx, "The durable asset is the capture-backed contract around a real place, not permanent ownership of one frontier model.", 64, 198, 760, 50, { color: "#FFFFFFBF" });
  card(slide, ctx, 74, 302, 500, 240, { fill: "#FFFFFF10", line: "#FFFFFF20" });
  text(slide, ctx, "Swappable engines", 106, 330, 360, 28, { size: 25, bold: true, color: C.white });
  text(slide, ctx, "- world-model checkpoints\\n- inference providers\\n- retrieval and refinement strategies\\n- training/export adapters", 106, 388, 360, 120, { size: 19, color: "#FFFFFFBA" });
  card(slide, ctx, 642, 302, 500, 240, { fill: C.paper, line: "#00000000" });
  text(slide, ctx, "Stable contracts", 674, 330, 360, 28, { size: 25, bold: true, color: C.ink });
  text(slide, ctx, "- raw capture, timestamps, poses, intrinsics\\n- rights, privacy, consent, provenance\\n- package manifests and hosted sessions\\n- buyer licensing and export boundaries", 674, 388, 400, 120, { size: 18, color: C.slate });
  rect(slide, ctx, 576, 404, 64, 24, C.green, C.green, 0);
  text(slide, ctx, "moat", 586, 409, 44, 12, { size: 11, bold: true, color: C.ink, align: "center" });
  footer(slide, ctx, "Sources: R2 R5 W10. No claim that Blueprint owns a frontier model backend.", { dark: true });
  notes(slide, "This is the core strategic argument. If world models improve rapidly, Blueprint benefits by owning better real-site inputs, rights and provenance, package contracts, and buyer workflows. Better backends increase the value of exact-site packages instead of commoditizing the company.");
`),
  slideModule(5, `
  bg(slide, ctx, C.paper);
  await image(slide, ctx, "client/public/generated/editorial/hosted-hero.png", 804, 74, 360, 512, { alt: "Illustrative hosted review workspace visual" });
  rect(slide, ctx, 804, 74, 360, 512, "#00000000", "#15130F", 1);
  kicker(slide, ctx, "PRODUCT WEDGE");
  title(slide, ctx, "Exact-Site Hosted Review turns one place into a buyer decision.", 62, 86, 720, 110);
  subtitle(slide, ctx, "A narrow first product: one real site, one robot workflow, one package, one hosted review path.", 64, 198, 690, 48);
  step(slide, ctx, "01", "Indoor site capture", "Record route, timestamps, device context, capture notes, and access boundaries.", 80, 298, 620, { color: C.blue });
  step(slide, ctx, "02", "World model package", "Package the site with manifest, media, model artifacts, restrictions, and review evidence.", 80, 394, 620, { color: C.ink });
  step(slide, ctx, "03", "Hosted evaluation", "Open a buyer room for task runs, observations, result notes, and export framing.", 80, 490, 620, { color: C.coral });
  step(slide, ctx, "04", "Export or recapture decision", "Approve export, request recapture, scope the next workflow, or hold for rights review.", 80, 586, 620, { color: C.clay });
  footer(slide, ctx, "Sources: R4 R5. Visual asset is illustrative, not hosted-session proof.");
  notes(slide, "Walk through the product as a decision path, not as a broad platform promise. The deck should make the wedge feel concrete: exact-site capture becomes a package, the hosted review creates decision evidence, and the buyer either exports, reruns, recaptures, or holds.");
`),
  slideModule(6, `
  bg(slide, ctx, C.paper2);
  kicker(slide, ctx, "PLATFORM SYSTEM");
  title(slide, ctx, "Blueprint is already shaped as a multi-repo product system.", 62, 86, 780, 104);
  subtitle(slide, ctx, "Each layer owns a different truth boundary, which is why the investor story can stay precise.", 64, 190, 700, 46);
  const layers = [
    ["BlueprintCapture", "Evidence layer", "Real-site capture bundles, timestamps, poses, device metadata, access boundaries."],
    ["BlueprintCapturePipeline", "Packaging layer", "Site-specific world-model packages, hosted artifacts, optional trust outputs."],
    ["Blueprint-WebApp", "Buyer and ops layer", "Product routes, pricing, entitlements, hosted access, GTM and control surfaces."],
    ["Paperclip autonomous org", "Operating layer", "Product/proof, demand/sales, and reliability loops with human gates."]
  ];
  for (let i = 0; i < layers.length; i++) {
    const y = 278 + i * 92;
    rect(slide, ctx, 82, y, 266, 62, i === 0 ? C.blue : i === 1 ? C.ink : i === 2 ? C.coral : C.green, "#00000000", 0);
    text(slide, ctx, layers[i][0], 104, y + 13, 220, 18, { size: 18, bold: true, color: i === 3 ? C.ink : C.white });
    text(slide, ctx, layers[i][1], 104, y + 36, 220, 12, { size: 11, color: i === 3 ? C.ink : "#FFFFFFB8" });
    rect(slide, ctx, 392, y, 610, 62, "#FFFFFF", "#D8D0C2", 1);
    text(slide, ctx, layers[i][2], 420, y + 17, 540, 28, { size: 15, color: C.slate });
    if (i < layers.length - 1) rule(slide, ctx, 216, y + 66, 2, C.ink, 26);
  }
  await image(slide, ctx, "client/public/generated/public-capture-2026-04-23/capture-app-hero.png", 1040, 278, 116, 340, { alt: "Illustrative capture app visual" });
  footer(slide, ctx, "Sources: R1 R2 R8. Visual asset is repo-generated and illustrative.");
  notes(slide, "Explain the company as a system, not a monolith. Capture collects evidence. Pipeline creates site-specific products. WebApp sells, gates, and operates access. Paperclip turns the wedge into accountable operating loops. This keeps product truth separate from live operational readiness.");
`),
  slideModule(7, `
  bg(slide, ctx, C.paper);
  kicker(slide, ctx, "BUSINESS MODEL");
  title(slide, ctx, "The first monetization path is package access plus hosted review.", 62, 86, 820, 104);
  subtitle(slide, ctx, "Pricing is public, but availability, rights, payment, and fulfillment stay confirmed per site/request.", 64, 190, 760, 46);
  const cards = [
    ["Site Package Access", "$2,100-$3,400", "Files, manifest, route notes, rights sheet, provenance summary, export scope.", C.blue],
    ["Hosted Review", "$16-$29/session-hour", "Managed buyer room, scoped run notes, observations, and output decisions.", C.coral],
    ["Custom Scope", "$50,000+ scoped", "Private or multi-site work with capture plan, operator boundary review, and delivery estimate.", C.ink]
  ];
  for (let i = 0; i < cards.length; i++) {
    const x = 76 + i * 374;
    card(slide, ctx, x, 294, 326, 232, { fill: C.paper2, line: "#BDB3A3" });
    rect(slide, ctx, x, 294, 326, 12, cards[i][3], cards[i][3], 0);
    text(slide, ctx, cards[i][0], x + 26, 332, 260, 28, { size: 22, bold: true });
    text(slide, ctx, cards[i][1], x + 26, 378, 274, 40, { size: i === 1 ? 24 : 30, display: true, bold: true, color: cards[i][3] });
    text(slide, ctx, cards[i][2], x + 26, 438, 256, 62, { size: 14, color: C.slate });
  }
  rect(slide, ctx, 78, 560, 1020, 48, C.ink, C.ink, 0);
  text(slide, ctx, "Investor read: wedge revenue starts with one exact site, then expands through hosted hours, refresh/recapture, multi-site scope, and enterprise access controls.", 102, 575, 946, 20, { size: 15, color: C.white, valign: "mid" });
  footer(slide, ctx, "Sources: R3 R7. Does not claim completed payments or entitlements.");
  notes(slide, "Use this as the monetization bridge. The numbers come from the current repo pricing surface. Be explicit that these are public planning ranges and request paths, not evidence of settled payments, payouts, or fulfilled entitlements.");
`),
  slideModule(8, `
  bg(slide, ctx, C.paper2);
  kicker(slide, ctx, "MARKET MODEL");
  title(slide, ctx, "The market is exact-site deployment infrastructure.", 62, 86, 900, 108);
  subtitle(slide, ctx, "TAM/SAM/SOM are modeled from filtered robotics, warehouse automation, digital twin, simulation, pricing, account, site, and refresh assumptions.", 64, 214, 880, 54);
  const rows = [
    ["2026", "$1.6B-$11.8B", "$0.12B-$5.08B", "$0.23M-$7.32M"],
    ["2030", "$9.3B-$50.6B", "$0.63B-$19.48B", "$10.62M-$280.45M"],
    ["2035", "$19.4B-$215.6B", "$3.09B-$85.14B", "$111.38M-$2.55B"]
  ];
  const cols = [74, 242, 508, 784];
  const widths = [130, 220, 220, 252];
  text(slide, ctx, "Year", cols[0], 310, widths[0], 20, { size: 13, bold: true, color: C.mute });
  text(slide, ctx, "Broad strategic TAM", cols[1], 310, widths[1], 20, { size: 13, bold: true, color: C.mute });
  text(slide, ctx, "Serviceable SAM", cols[2], 310, widths[2], 20, { size: 13, bold: true, color: C.mute });
  text(slide, ctx, "Modeled SOM", cols[3], 310, widths[3], 20, { size: 13, bold: true, color: C.mute });
  for (let i = 0; i < rows.length; i++) {
    const y = 350 + i * 74;
    rect(slide, ctx, 62, y - 12, 1060, 58, i === 1 ? "#E8F2C7" : "#FFFFFF", "#D8D0C2", 1);
    for (let j = 0; j < rows[i].length; j++) {
      text(slide, ctx, rows[i][j], cols[j], y, widths[j], 28, {
        size: j === 0 ? 18 : 20,
        bold: j === 0 || i === 1,
        color: j === 1 ? C.blue : j === 2 ? C.coral : C.ink,
      });
    }
  }
  rect(slide, ctx, 76, 585, 1000, 38, C.ink, C.ink, 0);
  text(slide, ctx, "Deck uses base-case 2030 as the narrative anchor: $24.3B TAM, $7.49B SAM, $87.66M SOM. Refresh the model before external fundraising distribution.", 98, 596, 930, 16, { size: 13, color: C.white, valign: "mid" });
  footer(slide, ctx, "Sources: M1 W3 W4 W12 W13 W14 W15. Modeled estimates, not direct report claims.");
  notes(slide, "This is intentionally conservative in language. The broad source pool includes robotics, warehouse automation, digital twin, and simulation markets, then filters to exact-site indoor deployment infrastructure. The SAM is bottom-up from Blueprint pricing and modeled account/site activity. Treat as a fundraise model that needs refresh before external circulation.");
`),
  slideModule(9, `
  bg(slide, ctx, C.paper);
  kicker(slide, ctx, "CUSTOMER FOCUS");
  title(slide, ctx, "Start where site specificity is already expensive.", 62, 86, 780, 100);
  subtitle(slide, ctx, "The first ICPs are teams that need exact facilities before hardware travel, pilot scoping, simulation, or export decisions.", 64, 188, 760, 48);
  const icps = [
    ["Robot teams", "AMR, manipulation, cleaning, inspection, service, humanoid, lab automation."],
    ["Systems integrators", "Teams scoping deployments for customers before discovery and pilot costs."],
    ["Large operators", "3PLs, retailers, grocers, manufacturers, hospitals, labs, campuses."],
    ["Physical AI teams", "Simulation, evaluation, synthetic-data, and site-adaptation workflows."],
    ["Site operators", "Optional lane when access, rights, privacy, or commercialization requires it."]
  ];
  for (let i = 0; i < icps.length; i++) {
    const y = 286 + i * 56;
    rect(slide, ctx, 70, y, 28, 28, i < 2 ? C.blue : i === 2 ? C.coral : i === 3 ? C.green : C.clay, "#00000000", 0);
    text(slide, ctx, icps[i][0], 116, y - 2, 170, 20, { size: 18, bold: true });
    text(slide, ctx, icps[i][1], 300, y - 2, 480, 34, { size: 13, color: C.slate });
  }
  card(slide, ctx, 860, 286, 290, 282, { fill: C.dark, line: C.dark });
  text(slide, ctx, "First verticals", 888, 314, 220, 24, { size: 22, bold: true, color: C.white });
  text(slide, ctx, "1. Warehousing, 3PL, fulfillment\\n2. Manufacturing and intralogistics\\n3. Retail, grocery, back rooms\\n4. Healthcare, labs, hospital routes\\n5. Hospitality, airports, campuses", 888, 362, 226, 142, { size: 16, color: "#FFFFFFCC" });
  text(slide, ctx, "Evidence converges around logistics/mobile robots, robot-centric warehouses, and broadening automation demand.", 888, 520, 226, 32, { size: 12, color: "#FFFFFF99" });
  footer(slide, ctx, "Sources: M1 W2 W3 W4 W5 W11.");
  notes(slide, "Make the customer wedge concrete. The buyer does not have to be the site operator. Site operators matter when access, privacy, rights, or commercialization require them. The first verticals are logistics and manufacturing because the evidence base is strongest there.");
`),
  slideModule(10, `
  bg(slide, ctx, C.paper2);
  await image(slide, ctx, "client/public/generated/editorial/sample-evaluation-proof-board.png", 804, 90, 330, 220, { alt: "Illustrative sample evaluation proof board" });
  kicker(slide, ctx, "GO-TO-MARKET");
  title(slide, ctx, "GTM is one site, one workflow, one proof artifact, one next step.", 62, 86, 720, 100);
  subtitle(slide, ctx, "The pilot doctrine keeps demand generation proof-led and prevents generic AI/software outreach.", 64, 188, 700, 44);
  rect(slide, ctx, 84, 314, 390, 130, C.blue, C.blue, 0);
  text(slide, ctx, "proof_ready_outreach", 112, 344, 300, 24, { size: 23, bold: true, color: C.white });
  text(slide, ctx, "Use when an exact-site world is already captured, packaged, and reviewable.", 112, 386, 300, 34, { size: 14, color: "#FFFFFFCC" });
  rect(slide, ctx, 540, 314, 390, 130, C.ink, C.ink, 0);
  text(slide, ctx, "demand_sourced_capture", 568, 344, 320, 24, { size: 23, bold: true, color: C.white });
  text(slide, ctx, "Use when the buyer conversation identifies which site or workflow Blueprint should capture next.", 568, 386, 320, 34, { size: 14, color: "#FFFFFFCC" });
  rule(slide, ctx, 474, 378, 66, C.ink, 2);
  card(slide, ctx, 84, 504, 846, 88, { fill: "#FFFFFF", line: C.line });
  text(slide, ctx, "Scale gate", 112, 526, 120, 20, { size: 18, bold: true });
  text(slide, ctx, "A qualified organic signal: reply, hosted-review start, qualified call, exact-site request, or capture request tied to a buyer workflow.", 242, 522, 628, 28, { size: 14, color: C.slate });
  text(slide, ctx, "The repo blocks live sends, public posts, paid spend, rights commitments, and commercialization commitments without explicit approval.", 242, 552, 638, 16, { size: 11, color: C.coral });
  footer(slide, ctx, "Sources: R6. Visual asset is illustrative, not customer proof.");
  notes(slide, "This slide should reassure investors that GTM is focused and proof-led. It also preserves the hard boundary: the pilot can generate target ledgers, drafts, and review packets, but live sends or commitments need explicit approval and evidence.");
`),
  slideModule(11, `
  bg(slide, ctx, C.dark);
  kicker(slide, ctx, "MOAT", { dark: true, color: C.green });
  title(slide, ctx, "Capture -> package -> buyer usage -> more capture.", 62, 86, 820, 104, { color: C.white });
  subtitle(slide, ctx, "Better world-model providers make proprietary site coverage, rights/provenance, and buyer workflow more valuable.", 64, 210, 780, 50, { color: "#FFFFFFC8" });
  const nodes = [
    [110, 342, "Capture supply", "More real indoor routes and device context."],
    [402, 270, "Package quality", "Better manifests, freshness, and proof labels."],
    [724, 342, "Buyer usage", "Hosted review creates observations and next-step demand."],
    [402, 490, "More capture", "Usage signals identify sites, recapture, and vertical expansion."]
  ];
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    rect(slide, ctx, n[0], n[1], 230, 86, i === 0 ? C.blue : i === 1 ? C.green : i === 2 ? C.coral : C.paper, "#00000000", 0);
    text(slide, ctx, n[2], n[0] + 18, n[1] + 18, 190, 20, { size: 19, bold: true, color: i === 1 || i === 3 ? C.ink : C.white });
    text(slide, ctx, n[3], n[0] + 18, n[1] + 48, 190, 26, { size: 12, color: i === 1 || i === 3 ? C.ink : "#FFFFFFC8" });
  }
  rule(slide, ctx, 340, 382, 60, C.white, 2);
  rule(slide, ctx, 632, 312, 90, C.white, 2);
  rule(slide, ctx, 600, 382, 124, C.white, 2);
  rule(slide, ctx, 515, 428, 2, C.white, 62);
  card(slide, ctx, 930, 302, 238, 220, { fill: "#FFFFFF12", line: "#FFFFFF22" });
  text(slide, ctx, "Compounding assets", 958, 330, 190, 22, { size: 20, bold: true, color: C.white });
  text(slide, ctx, "- real-site coverage\\n- provenance and rights\\n- package contracts\\n- hosted-review logs\\n- buyer feedback loops", 958, 374, 174, 108, { size: 15, color: "#FFFFFFC8" });
  footer(slide, ctx, "Sources: R1 R2 R5. Does not claim rights are cleared for any specific external site.", { dark: true });
  notes(slide, "The flywheel is the economic argument. More buyer usage should guide more capture and better packages. More packages make hosted review and buyer workflows more useful. The moat is not a model checkpoint; it is real-site coverage plus rights, provenance, package contracts, and feedback.");
`),
  slideModule(12, `
  bg(slide, ctx, C.paper);
  kicker(slide, ctx, "OPERATING SYSTEM");
  title(slide, ctx, "The operating system turns the wedge into repeatable proof.", 62, 86, 820, 104);
  subtitle(slide, ctx, "Paperclip is the execution record. The active wedge is judged through three loops that move buyer evidence, not commentary.", 64, 190, 800, 48);
  const loops = [
    ["Product / proof", "Keep artifacts honest, buyer-inspectable, and attached to rights/provenance boundaries.", C.blue],
    ["Demand / sales", "Add targets, find recipient-backed contacts, draft, approve, send, follow up.", C.coral],
    ["Reliability", "Keep reply resume, send ledgers, audits, blocker state, and closeout proof truthful.", C.ink]
  ];
  for (let i = 0; i < loops.length; i++) {
    const x = 90 + i * 360;
    card(slide, ctx, x, 306, 302, 190, { fill: C.paper2, line: "#BDB3A3" });
    rect(slide, ctx, x, 306, 302, 12, loops[i][2], loops[i][2], 0);
    text(slide, ctx, loops[i][0], x + 24, 344, 242, 24, { size: 22, bold: true });
    text(slide, ctx, loops[i][1], x + 24, 392, 238, 64, { size: 14, color: C.slate });
  }
  rect(slide, ctx, 200, 550, 760, 48, C.green, C.green, 0);
  text(slide, ctx, "Founder gates remain for live sends, pricing commitments, rights/privacy, legal, paid spend, and other irreversible actions.", 226, 565, 708, 18, { size: 14, bold: true, color: C.ink, valign: "mid" });
  footer(slide, ctx, "Sources: R6 R8. Does not prove current live Paperclip/API health.");
  notes(slide, "Use this slide to explain operational leverage without overstating autonomy. The repo doctrine says the wedge should be judged by movement in product proof, demand/sales, and reliability. High-risk actions are still gated.");
`),
  slideModule(13, `
  bg(slide, ctx, C.paper2);
  kicker(slide, ctx, "PRE-SEED PLAN");
  title(slide, ctx, "The raise should fund wedge proof into repeatability.", 62, 86, 820, 104);
  subtitle(slide, ctx, "The exact dollar ask, valuation, and runway require founder confirmation; the use-of-funds story is already grounded.", 64, 190, 820, 48);
  const stages = [
    ["0-6 months", "Prove the wedge", "First repeatable exact-site hosted-review package workflow and qualified organic signal."],
    ["6-12 months", "Repeat by vertical", "Logistics and manufacturing target batches with recipient-backed GTM, proof ledgers, and capture asks."],
    ["12-18 months", "Expand accounts", "Multi-site package management, hosted-review logs, refresh/recapture cadence, enterprise controls."]
  ];
  for (let i = 0; i < stages.length; i++) {
    const x = 74 + i * 374;
    rect(slide, ctx, x, 296, 326, 178, i === 0 ? C.blue : i === 1 ? C.ink : C.coral, "#00000000", 0);
    text(slide, ctx, stages[i][0], x + 24, 322, 180, 18, { size: 14, bold: true, color: "#FFFFFFB8" });
    text(slide, ctx, stages[i][1], x + 24, 356, 260, 26, { size: 24, bold: true, color: C.white });
    text(slide, ctx, stages[i][2], x + 24, 402, 258, 46, { size: 13, color: "#FFFFFFCC" });
  }
  card(slide, ctx, 74, 520, 1030, 88, { fill: "#FFFFFF", line: C.line });
  text(slide, ctx, "Use of funds", 100, 544, 120, 20, { size: 18, bold: true });
  text(slide, ctx, "Capture supply, package/runtime quality, buyer GTM, rights/provenance, autonomous-loop reliability.", 244, 544, 800, 20, { size: 14, color: C.slate });
  text(slide, ctx, "Blocked before send: exact raise amount, runway, hiring plan, committed investor/customer logos.", 244, 578, 770, 14, { size: 11, color: C.coral });
  footer(slide, ctx, "Sources: R2 R6. Ask amount and terms are not claimed.");
  notes(slide, "This is the fundraise framing slide without inventing a dollar ask. Before sending to investors, replace the founder-confirmation language with the actual target raise, runway, valuation strategy, hiring plan, and milestones.");
`),
  slideModule(14, `
  bg(slide, ctx, C.dark);
  kicker(slide, ctx, "EVIDENCE BOUNDARY", { dark: true, color: C.green });
  title(slide, ctx, "Evidence is explicit before this deck leaves the repo.", 62, 86, 760, 96, { color: C.white });
  subtitle(slide, ctx, "The deck is investor-showcase ready. It does not claim operational launch readiness where owner-system proof is missing.", 64, 184, 760, 48, { color: "#FFFFFFC8" });
  card(slide, ctx, 82, 286, 500, 254, { fill: "#FFFFFF10", line: "#FFFFFF22" });
  text(slide, ctx, "Blocked claims", 112, 316, 220, 24, { size: 23, bold: true, color: C.white });
  text(slide, ctx, "- real customer logos, revenue, or traction\\n- live payments, payouts, or entitlements\\n- rights-cleared commercial use for any specific external site\\n- guaranteed hosted-session fulfillment\\n- active city coverage or capturer availability\\n- final raise amount, terms, runway, hiring plan", 112, 364, 410, 132, { size: 14, color: "#FFFFFFC8" });
  card(slide, ctx, 646, 286, 500, 260, { fill: C.paper, line: "#00000000" });
  text(slide, ctx, "Source ledger", 676, 316, 220, 24, { size: 23, bold: true, color: C.ink });
  text(slide, ctx, "Every source ID in the footer maps to a repo file, source URL, evidence use, slide list, confidence level, and claim boundary.", 676, 360, 400, 56, { size: 16, color: C.slate });
  text(slide, ctx, outputDir + "/blueprint-preseed-source-ledger.md", 676, 448, 390, 46, { size: 12, color: C.blue });
  rect(slide, ctx, 676, 512, 330, 28, C.green, C.green, 0);
  text(slide, ctx, "Pitch-ready means polished plus proof-labeled.", 690, 519, 300, 12, { size: 12, bold: true, color: C.ink, valign: "mid" });
  footer(slide, ctx, "Sources: R7 plus source ledger.", { dark: true });
  notes(slide, "Close by making the proof boundary credible. This is a polished investor deck, but it does not upgrade public surface readiness into operational readiness. If the deck is sent externally, confirm the raise amount and refresh the market memo first.");
`),
];

async function main() {
  await write(path.join(workspace, "profile-plan.txt"), profilePlan);
  await write(path.join(workspace, "source-notes.txt"), sourceLedger);
  await write(path.join(workspace, "reference-audit.txt"), "No source deck or visual reference deck was supplied. Built from repo doctrine, current public product surfaces, and sourced market evidence.");
  await write(path.join(workspace, "claim-spine.txt"), claimSpine);
  await write(path.join(workspace, "design-system.txt"), designSystem);
  await write(path.join(workspace, "contact-sheet-plan.txt"), contactSheetPlan);
  await write(path.join(workspace, "data.json"), `${JSON.stringify(dataJson, null, 2)}\\n`);
  await write(path.join(outputDir, "blueprint-preseed-source-ledger.md"), sourceLedger);
  await write(path.join(outputDir, "blueprint-preseed-blocked-claims.md"), sourceLedger.split("## Blocked Claims")[1].trimStart());
  await write(path.join(slidesDir, "_helpers.mjs"), helper);
  for (let index = 0; index < slides.length; index += 1) {
    await write(path.join(slidesDir, `slide-${String(index + 1).padStart(2, "0")}.mjs`), slides[index]);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
