/**
 * Every number the public site puts on a chart, with its provenance attached.
 *
 * The site's whole argument is quantitative, which makes the evidence grade of
 * each figure part of the product claim rather than a footnote. Two grades are
 * in play and the site never blurs them:
 *
 *   - `published`   — a third party stated this number in a named public
 *                     document. Reproducible by opening `source.href`.
 *   - `illustrative` — a third party published this number and labelled it a
 *                     management assumption or worked example, not a
 *                     transaction. Charted, but always carried with the label.
 *
 * There is no third grade. Nothing here is a Blueprint estimate, a market
 * average, or a projection, because the public market data to support one does
 * not exist yet: humanoid commercial terms are almost entirely private, and
 * inferring a "typical site contract" from two disclosed agreements would be
 * exactly the fabricated operational state this repo forbids.
 *
 * Consequence for anyone editing this file: a figure with no `source` does not
 * belong on the public site. Add the source or drop the figure.
 */

export type EvidenceBasis = "published" | "illustrative";

export interface MarketSource {
  label: string;
  href: string;
}

export const marketSources = {
  ifr2025: {
    label: "IFR World Robotics 2025",
    href: "https://ifr.org/ifr-press-releases/news/global-robot-demand-in-factories-doubles-over-10-years",
  },
  ifrDensity: {
    label: "IFR robot density 2025",
    href: "https://ifr.org/ifr-press-releases/news/robot-density-surges-in-europe-asia-and-americas",
  },
  agilityDeck: {
    label: "Agility Robotics investor presentation, June 2026",
    href: "https://www.sec.gov/Archives/edgar/data/2074973/000121390026071287/ea029548401ex99-2.htm",
  },
  agilityInvestors: {
    label: "Agility Robotics investor relations",
    href: "https://www.agilityrobotics.com/investors",
  },
  agilityProcess: {
    label: "Agility Robotics deployment process",
    href: "https://www.agilityrobotics.com/content/agilitys-humanoid-deployment-process",
  },
  sagHumanoid: {
    label: "Smart Analytics Global, humanoid shipments 1H 2026",
    href: "https://smartanalyticsglobal.com/global-humanoid-robot-shipments-2026-agibot-unitree/",
  },
  bloombergHumanoid: {
    label: "Bloomberg: China humanoid makers hold 97% of global shipments",
    href: "https://www.bloomberg.com/news/articles/2026-08-10/china-humanoid-makers-hold-97-of-global-shipments-report-says",
  },
  teslaOptimusCall: {
    label: "Tesla Q4 2025 earnings call, 28 Jan 2026",
    href: "https://electrek.co/2026/01/28/musk-admits-no-optimus-robots-are-doing-useful-work-at-tesla-after-claiming-otherwise/",
  },
  atlasCommitted: {
    label: "Boston Dynamics: 2026 Atlas output committed internally",
    href: "https://www.automate.org/robotics/industry-insights/boston-dynamics-to-begin-production-on-redesigned-atlas-humanoid-in-2026",
  },
  gxoPilot: {
    label: "GXO proof of concept, December 2023",
    href: "https://investors.gxo.com/news-releases/news-release-details/gxo-conducting-industry-leading-pilot-human-centric-robot",
  },
  gxoAgreement: {
    label: "GXO multi-year agreement, June 2024",
    href: "https://investors.gxo.com/news-releases/news-release-details/gxo-signs-industry-first-multi-year-agreement-agility-robotics",
  },
} as const satisfies Record<string, MarketSource>;

/* ------------------------------------------------------------------ the gap */

/**
 * Annual industrial-robot installations, 2024. The flow number, not the stock
 * number — flow is what a deployment company can actually move.
 *
 * Humanoids are a rounding error inside these totals today. They are included
 * anyway because they measure the thing that matters: how fast a country can
 * take a robot from "we should automate this" to "it is running on the floor."
 * That capacity is what gets inherited when humanoid volume arrives.
 */
export interface InstallBar {
  region: string;
  /** Units installed in 2024. */
  units: number;
  /** Share of global installations, whole percent. */
  share: number;
  /** Year-over-year change, whole percent. Null where IFR did not state one. */
  changePct: number | null;
  emphasis: "china" | "us" | "other";
}

export const installations2024: readonly InstallBar[] = [
  { region: "China", units: 295_000, share: 54, changePct: null, emphasis: "china" },
  { region: "Japan", units: 44_500, share: 8, changePct: -4, emphasis: "other" },
  { region: "United States", units: 34_200, share: 6, changePct: -9, emphasis: "us" },
  { region: "Rep. of Korea", units: 30_600, share: 6, changePct: -3, emphasis: "other" },
  { region: "Germany", units: 26_982, share: 5, changePct: -5, emphasis: "other" },
  { region: "India", units: 9_100, share: 2, changePct: 7, emphasis: "other" },
];

export const installationTotals = {
  global: 542_000,
  globalStock: 4_664_000,
  chinaStock: 2_000_000,
  /** China installs ÷ US installs, 2024. */
  chinaToUsRatio: 8.6,
  source: marketSources.ifr2025,
  basis: "published" as EvidenceBasis,
} as const;

export const regionalShare2024 = [
  { region: "Asia", share: 74 },
  { region: "Europe", share: 16 },
  { region: "Americas", share: 9 },
] as const;

/* ------------------------------------------------- the leading edge */

/**
 * Humanoid shipments, H1 2026.
 *
 * The IFR figures above measure deployment *capacity* — the muscle a country
 * has for taking any robot from "we should automate this" to "it is running on
 * the floor." This block measures the leading edge of the same race, and the
 * gap is far wider there: 54% of all industrial robots against more than 97% of
 * humanoids.
 *
 * Why this is charted as a share and not as a volume. Two independent datasets
 * cover the same half-year. They agree on the share almost exactly and disagree
 * on the volume by more than a factor of two — see `excludedVolumeFigure`. A
 * quantity two credible sources cannot agree on is not a quantity this site
 * puts on an axis; a share they both land on is.
 */
export const humanoidShare = {
  period: "H1 2026",
  headline: "97 of 100",
  chineseVendorSharePct: 97,
  restOfWorldSharePct: 3,
  /** Global shipments in the half-year, and the same half a year earlier. */
  globalUnits: 19_100,
  priorPeriodUnits: 5_100,
  growthPct: 272,
  /** Derived: 3% of global shipments. Rounded, and labelled as derived. */
  restOfWorldUnits: 570,
  chinaDemandSharePct: 85,
  leaders: [
    { name: "AgiBot", units: 8_400, sharePct: 44 },
    { name: "Unitree", units: 5_900, sharePct: 31 },
    { name: "Galbot", units: 900, sharePct: 5 },
    { name: "UBTECH", units: 700, sharePct: 4 },
    { name: "Leju", units: 600, sharePct: 3 },
  ],
  sources: [marketSources.sagHumanoid, marketSources.bloombergHumanoid],
  basis: "published" as EvidenceBasis,
} as const;

/**
 * The caveat that has to travel with any humanoid shipment number.
 *
 * This site's entire discipline is that a shipped robot is not a working one,
 * and humanoid shipment figures are the most contaminated numbers in the
 * category. Stated here with the three pieces of evidence that make it
 * concrete rather than as a general hedge, because a general hedge reads as
 * throat-clearing and gets skipped.
 */
export const shipmentsNotDeployments = {
  claim: "A shipped humanoid is not a working one.",
  detail:
    "More than 70% of H1 2026 shipments are classified industrial or commercial, up from about 50% a year earlier. That is an application classification of shipments, not a count of robots doing productive work — and the difference is where most published deployment claims live.",
  evidence: [
    {
      id: "optimus",
      subject: "Tesla",
      fact: "Several hundred Optimus units deployed, \u201cprimarily for learning, not productive tasks.\u201d On the same call: \u201cIt\u2019s not in usage in our factories in a material way.\u201d",
      source: marketSources.teslaOptimusCall,
    },
    {
      id: "atlas",
      subject: "Boston Dynamics",
      fact: "The entire 2026 production run of Atlas is committed internally, to Hyundai\u2019s Metaplant and Google DeepMind. No external customer.",
      source: marketSources.atlasCommitted,
    },
    {
      id: "classification",
      subject: "The category itself",
      fact: "Shipments, orders, pilots, and productive fleets are counted as if they were the same measure. They are not, and only the last one is a deployment.",
      source: marketSources.sagHumanoid,
    },
  ],
  basis: "published" as EvidenceBasis,
} as const;

/**
 * What this site deliberately does not chart, and why.
 *
 * Publishing the exclusion is the point. A reader who sees the 40,000 figure
 * quoted elsewhere should be able to find out here why it is absent rather
 * than assume it was missed.
 */
export const excludedVolumeFigure = {
  figure: "40,000+",
  attribution: "China Electronics Society, 2026 Humanoid Robot Industry Development Report",
  reason:
    "Presented at a conference and not published. No definition of \u201chumanoid\u201d accompanies it and no split between wheeled and bipedal machines. It implies a global half-year total of roughly 41,000 against Smart Analytics Global\u2019s 19,100 — a disagreement of more than two times on volume between sources that agree almost exactly on the share.",
  consequence:
    "The share is charted. The volume is not.",
} as const;

/* --------------------------------------------------- the six-month pipeline */

/**
 * The published path from "a robot company is interested in your site" to
 * "robots are scaling there." Agility is the only humanoid maker that has put
 * this timeline in a public filing, so it is the one the site charts.
 *
 * `blueprint: true` marks the phase Blueprint compresses. The other three are
 * not ours and the site never implies otherwise.
 */
export interface DeploymentPhase {
  id: string;
  window: string;
  /** Start and end month, used to lay the phase out on a real axis. */
  startMonth: number;
  endMonth: number;
  name: string;
  owner: string;
  detail: string;
  blueprint: boolean;
}

export const oemDeploymentPhases: readonly DeploymentPhase[] = [
  {
    id: "proof-of-technology",
    window: "Months 0–2",
    startMonth: 0,
    endMonth: 2,
    name: "Proof of technology",
    owner: "Blueprint automates this",
    detail:
      "Define the task and the win condition, recreate the site, run the robot against it, refine the workflow.",
    blueprint: true,
  },
  {
    id: "proof-of-concept",
    window: "Months 2–3",
    startMonth: 2,
    endMonth: 3,
    name: "Onsite proof of concept",
    owner: "OEM deployment engineers",
    detail:
      "Uncrate, connect, map the work area, configure the workflow, adjust for quirks, train the team.",
    blueprint: false,
  },
  {
    id: "raas-pilot",
    window: "Months 4–6",
    startMonth: 3,
    endMonth: 6,
    name: "Production pilot",
    owner: "OEM and site",
    detail: "Ninety days of uptime, throughput and reliability on real hardware.",
    blueprint: false,
  },
  {
    id: "scaled",
    window: "Month 6+",
    startMonth: 6,
    endMonth: 8,
    name: "Scaled deployment",
    owner: "OEM and site",
    detail: "Expand robots, shifts and facilities once the evidence supports it.",
    blueprint: false,
  },
];

export const deploymentPipelineMeta = {
  totalMonths: 6,
  blueprintMonths: 2,
  source: marketSources.agilityDeck,
  investorsSource: marketSources.agilityInvestors,
  processSource: marketSources.agilityProcess,
  basis: "illustrative" as EvidenceBasis,
  caveat:
    "Agility describes this as an illustrative Customer Acceleration Program timeline, not an industry average.",
} as const;

/** The one publicly checkable elapsed deployment: GXO's Digit installation. */
export const gxoObservedTimeline = {
  headline: "6 months",
  from: "Proof of concept announced, 6 Dec 2023",
  to: "Regular commercial operations, 5 Jun 2024",
  note: "This deployment predates the formal program above, so it is a sanity check on the order of magnitude rather than a like-for-like comparison.",
  sources: [marketSources.gxoPilot, marketSources.gxoAgreement],
  basis: "published" as EvidenceBasis,
} as const;

/* ------------------------------------------------------- the unit economics */

export interface EconomicsRow {
  id: string;
  label: string;
  value: string;
  /** Numeric value in dollars, for charting. */
  amount: number;
  note: string;
  basis: EvidenceBasis;
  tone: "cost" | "fee" | "recurring";
}

/**
 * Agility's modelled per-Digit unit economics, read off slide 57 of the June
 * 2026 deck. Every row is labelled by Agility as an assumption, so every row is
 * graded `illustrative` — including the ones that happen to line up with a
 * disclosed order.
 *
 * The deployment fee differs by adoption model: ~$25k under RaaS, ~$20k under
 * ownership. The site charts the RaaS figure because RaaS is the model the
 * disclosed 1,000-robot order uses, and says so rather than presenting one
 * number as the deployment fee.
 */
export const perRobotEconomics: readonly EconomicsRow[] = [
  {
    id: "deployment-cost",
    label: "Deployment cost to the OEM",
    value: "~$15,000",
    amount: 15_000,
    note: "One-time, per robot. Excludes corporate SG&A and R&D.",
    basis: "illustrative",
    tone: "cost",
  },
  {
    id: "deployment-fee",
    label: "Deployment fee to the customer",
    value: "~$25,000",
    amount: 25_000,
    note: "One-time, per robot, under the service model. ~$20,000 if the customer buys the robot outright.",
    basis: "illustrative",
    tone: "fee",
  },
  {
    id: "delivery",
    label: "Annual cost of delivery",
    value: "~$15,000 / yr",
    amount: 15_000,
    note: "Recurring, per robot, for software and maintenance — on top of the one-time deployment cost.",
    basis: "illustrative",
    tone: "cost",
  },
  {
    id: "raas",
    label: "Robot-as-a-service",
    value: "~$8,500 / mo",
    amount: 102_000,
    note: "About $102,000 per robot per year once the robot is working.",
    basis: "illustrative",
    tone: "recurring",
  },
];

/**
 * What the robot itself costs to build, set against what it costs to deploy.
 *
 * This is the ratio the whole business rests on. Building a Digit is a capital
 * cost that falls with volume — Agility models it dropping toward $80k at
 * 1,000/yr and further at 10,000/yr. Deploying one is a cost that is paid again
 * at every site, and nothing about volume makes a new building easier to model.
 */
export const bomVersusDeployment = {
  bom: "~$125,000",
  bomNote: "Current Digit v4 bill of materials, which Agility models falling with volume.",
  deployment: "~$15,000",
  deploymentNote: "One-time deployment cost, per robot, per site. Paid again at the next site.",
  ratio: "~12%",
  ratioNote: "Deployment costs roughly an eighth of building the robot — and unlike the robot, it does not get cheaper by making more of them.",
  source: marketSources.agilityDeck,
  basis: "illustrative" as EvidenceBasis,
} as const;

/**
 * The one contracted number that corroborates the modelled RaaS rate. Worth
 * charting because it is an order, not an assumption — and worth not
 * over-reading, because it carries warrants and milestones.
 */
export const contractedAnchor = {
  headline: "~$100K",
  unit: "per robot, per year",
  derivation: "$300M+ of orders ÷ 1,000 robots ÷ 3 years",
  note: "Agility reported this order volume as of May 2026 for 1,000 Digit v5 robots on three-year RaaS terms, subject to contractual milestones and including warrants that vest as robots deploy. It lands within a few percent of the modelled $8,500/month rate, which is why the site does not reverse-engineer it further.",
  lifetime: "~$500K",
  lifetimeNote:
    "Agility's illustrative cumulative revenue per robot over an assumed five-year useful life under the service model — five years of subscription plus the one-time deployment fee.",
  source: marketSources.agilityDeck,
  basis: "published" as EvidenceBasis,
} as const;

/**
 * How the modelled $15,000 splits. Agility does not publish this breakdown, so
 * the site charts the split as an unknown with a named boundary rather than
 * inventing three percentages: the front half is the work Blueprint does, the
 * back half is onsite, and the ratio between them is not public.
 */
export const deploymentCostSplit = {
  total: "~$15,000",
  known:
    "Agility publishes the total and describes what happens in each phase. It does not publish how the cost divides between the months 0–2 preparation and the onsite work.",
  frontHalf:
    "Task definition, site modelling, simulation, physical mock-up, robot runs, workflow tuning",
  backHalf:
    "Crating and freight, uncrate, network and security, area mapping, commissioning, operator training",
  source: marketSources.agilityDeck,
  processSource: marketSources.agilityProcess,
  basis: "illustrative" as EvidenceBasis,
} as const;

/* -------------------------------------------------- what months 0–2 contain */

/** Agility's own description of the pre-shipment work, condensed. */
export const monthsZeroToTwo = [
  {
    step: "01",
    title: "Decide whether the task fits at all",
    detail: "Is a robot the right answer for this workflow, and what counts as success?",
  },
  {
    step: "02",
    title: "Recreate the site's conditions",
    detail: "Layout, obstacles, buttons, object weights and form factors — in simulation and physically.",
  },
  {
    step: "03",
    title: "Run the robot against the recreation",
    detail: "Generate real robot data on the workflow and refine how it executes.",
  },
  {
    step: "04",
    title: "Prepare the handoff",
    detail: "Freeze the workflow, the KPIs, and the configuration the onsite team will start from.",
  },
] as const;

export const monthsZeroToTwoSource = {
  source: marketSources.agilityProcess,
  basis: "published" as EvidenceBasis,
} as const;

/* --------------------------------------------------- Blueprint vs doing it */

/**
 * The structural argument, and the only place the site claims an advantage.
 *
 * The claim is about *shape*, not speed multiples: the same discovery work
 * repeats once per vendor relationship today, and repeats zero additional times
 * when the site is captured once. No row here asserts a measured time or cost
 * saving, because Blueprint has not yet run enough deployments to have one.
 */
export const structuralComparison = [
  {
    dimension: "Explaining the job",
    diy: "One site tour and discovery call per robot company",
    diyCount: "×N vendors",
    blueprint: "One captured workflow, read by every vendor",
    blueprintCount: "×1",
  },
  {
    dimension: "Recreating the site",
    diy: "Each vendor builds its own partial model on its own assumptions",
    diyCount: "×N vendors",
    blueprint: "One versioned testbed as the shared reference",
    blueprintCount: "×1",
  },
  {
    dimension: "Testing fit",
    diy: "Each vendor picks its own test; the answers do not compare",
    diyCount: "×N vendors",
    blueprint: "One acceptance test, same conditions for everyone",
    blueprintCount: "×1",
  },
  {
    dimension: "Finding mismatches",
    diy: "After engineers and hardware are onsite",
    diyCount: "Month 2–3",
    blueprint: "Before anything ships",
    blueprintCount: "Month 0–2",
  },
] as const;

/* ---------------------------------------------------------- the flywheel */

/**
 * Why this compounds rather than being a services business. Each stage is a
 * consequence of the one before it; the loop closes because the marginal cost
 * of preparing deployment number N falls as N grows.
 */
export const flywheelStages = [
  {
    id: "capture",
    label: "More sites captured",
    detail: "Each workflow is captured once and readable by every robot team.",
  },
  {
    id: "cheaper",
    label: "Preparation gets cheaper",
    detail: "Shared method, shared tooling, shared acceptance tests.",
  },
  {
    id: "pilots",
    label: "More pilots start",
    detail: "Cheaper preparation lowers the bar for trying a robot at all.",
  },
  {
    id: "data",
    label: "More deployment data",
    detail: "Every prepared deployment sharpens what fit and failure look like.",
  },
] as const;

/* ------------------------------------------------------------- the boundary */

/** What Blueprint is not. Stated on the page, not buried in terms. */
export const deploymentBoundary = [
  {
    title: "We prepare the deployment",
    body: "Capture the task, build the testbed, screen robot fit, run bounded evaluations, package the handoff.",
    kind: "does" as const,
  },
  {
    title: "The robot company still deploys",
    body: "Onsite integration, safety sign-off, commissioning, service, and uptime stay with the OEM and the site.",
    kind: "does-not" as const,
  },
  {
    title: "Simulation filters, it does not certify",
    body: "A virtual result narrows the trip. Real hardware still settles physical performance and safety.",
    kind: "does-not" as const,
  },
];

/* -------------------------------------------------- observed deployments */

/**
 * The public record of how long a humanoid deployment actually takes.
 *
 * Three companies have put enough in public to time. None of them published a
 * deployment-cost breakdown, so these entries carry duration and scope only —
 * which is the honest limit of what is knowable, and happens to be the number
 * that matters most here.
 */
export interface ObservedDeployment {
  id: string;
  operator: string;
  site: string;
  robot: string;
  /** Elapsed time, as the public record supports it. */
  elapsed: string;
  elapsedMonths: number;
  /**
   * False when the public record establishes the sequence but not the duration.
   * The figure draws those as an indeterminate span rather than as a measured
   * bar, because a bar with a length is a claim about how long it took.
   */
  timed: boolean;
  milestone: string;
  detail: string;
  sources: readonly MarketSource[];
}

export const observedDeployments: readonly ObservedDeployment[] = [
  {
    id: "gxo",
    operator: "Agility Robotics",
    site: "GXO Logistics",
    robot: "Digit",
    elapsed: "~6 months",
    elapsedMonths: 6,
    timed: true,
    milestone: "Announced proof of concept to regular commercial operations",
    detail:
      "PoC announced 6 Dec 2023; commercial operations 5 Jun 2024; multi-year RaaS agreement 27 Jun 2024.",
    sources: [marketSources.gxoPilot, marketSources.gxoAgreement],
  },
  {
    id: "bmw",
    operator: "Figure",
    site: "BMW Group Plant Spartanburg",
    robot: "Figure 02",
    elapsed: "~10 months",
    elapsedMonths: 10,
    timed: true,
    milestone: "Robot bring-up to full deployment on an active assembly line",
    detail:
      "One task — sheet-metal loading to 5 mm. On site by about six months, on the live line by ten.",
    sources: [
      {
        label: "Figure: production at BMW",
        href: "https://www.figure.ai/news/production-at-bmw",
      },
    ],
  },
  {
    id: "tmmc",
    operator: "Agility Robotics",
    site: "Toyota Motor Manufacturing Canada",
    robot: "Digit",
    elapsed: "Duration not disclosed",
    elapsedMonths: 6,
    timed: false,
    milestone: "Pilot completed before any commercial agreement was signed",
    detail:
      "Announced 19 Feb 2026 after a successful pilot: seven Digits at the Woodstock RAV4 plant, expansion contingent on results.",
    sources: [
      {
        label: "Agility: Toyota Motor Manufacturing Canada agreement",
        href: "https://www.agilityrobotics.com/content/agility-robotics-announces-commercial-agreement-with-toyota-motor-manufacturing-canada",
      },
    ],
  },
];

export const observedDeploymentsNote =
  "Every documented humanoid deployment ran a site-specific evaluation before terms were signed.";

/**
 * The strongest single piece of evidence that deployment preparation is
 * genuinely unsolved rather than merely unglamorous.
 *
 * Agility's own footnote on its Customer Acceleration Program slide states that
 * of its current commercial deployments, only Mercado Libre went through CAP —
 * the Schaeffler, GXO, Toyota Motor Manufacturing Canada, and Amazon
 * deployments all pre-date the program. So the leading humanoid maker's
 * standardised preparation program is new enough that four of its five named
 * commercial customers were deployed without it, one bespoke engagement at a
 * time. That is the work this company is trying to make repeatable.
 */
export const capAdoption = {
  totalNamed: 5,
  throughProgram: 1,
  headline: "1 of 5",
  claim:
    "Only one of the five named commercial deployments went through a standardised preparation program. The other four pre-date its existence.",
  named: [
    "Schaeffler",
    "GXO",
    "Toyota Motor Manufacturing Canada",
    "Amazon",
    "Mercado Libre",
  ],
  throughProgramName: "Mercado Libre",
  pipeline: "30+",
  pipelineNote:
    "Potential customers Agility reports in active pipeline discussions or in the program.",
  source: marketSources.agilityDeck,
  basis: "published" as EvidenceBasis,
} as const;

/* ------------------------------------------------ where the bottleneck is */

/**
 * The constraint migrates. This is the thesis in one figure: capability stops
 * being the scarce thing long before deployment does, and the industry is
 * already past the crossover.
 *
 * `state` is deliberately coarse — "easing", "binding", "next" — because a
 * percentage here would be invented precision about an industry-wide condition
 * nobody measures.
 */
export const bottleneckChain = [
  {
    id: "capability",
    label: "Robot capability",
    state: "easing" as const,
    note: "General-purpose policies keep getting better, faster than anything downstream of them.",
  },
  {
    id: "bodies",
    label: "Robot bodies",
    state: "easing" as const,
    note: "Factory capacity is being built against multi-year order books.",
  },
  {
    id: "deployment",
    label: "Deployment",
    state: "binding" as const,
    note: "Every site needs its own task definition, model, evaluation, and integration. This is where the queue forms.",
  },
  {
    id: "service",
    label: "Service and spares",
    state: "next" as const,
    note: "Field technicians, replacement units, and regional coverage per deployed robot.",
  },
];

export const bottleneckThesis = {
  claim:
    "A robot that has not been matched to a site and a task is not capacity. It is inventory.",
  consequence:
    "The scarce unit is not a robot. It is a validated robot–task–site configuration, and today each one is built by hand, once per vendor, per site.",
} as const;

/* --------------------------------------------- how robot teams allocate */

/**
 * What a robot company is actually optimising when it decides where a robot
 * goes. Stated because it reframes the sales conversation: the constraint is
 * deployment-engineer weeks, not robot-months, and Blueprint sells against the
 * former.
 */
export const allocationFactors = [
  {
    factor: "Probability the deployment succeeds",
    signal: "Has anyone tested this task against this robot's envelope?",
  },
  {
    factor: "Integration burden",
    signal: "How many engineer-weeks before the first production cycle?",
  },
  {
    factor: "Rollout multiple",
    signal: "How many near-identical sites does this customer operate?",
  },
  {
    factor: "Information gained",
    signal: "Does this site expose a failure mode the team cannot reproduce internally?",
  },
] as const;

export const allocationThesis = {
  scarcest: "Deployment-engineer weeks",
  notScarcest: "Robot-months",
  consequence:
    "Qualification, not lead generation, is the binding constraint.",
} as const;

/* ------------------------------------------------- the deployment compiler */

/** The product, stated as a transformation. */
export const deploymentCompiler = {
  inputs: [
    "Site capture",
    "Task definition",
    "Objects, weights, cycle times",
    "Exceptions and edge cases",
    "Systems, security, access rules",
  ],
  outputs: [
    "Versioned site-task testbed",
    "Robot-fit and envelope screening",
    "Controlled evaluation results",
    "Acceptance criteria",
    "Onsite commissioning checklist",
  ],
} as const;

/* ------------------------------------------------- historical analogues */

/**
 * Markets that already solved a version of this. Included because the pattern
 * is not speculative — scarce, long-lived, physically-located capacity has been
 * allocated this way before, and each analogue supplies one piece of the shape.
 */
export const historicalAnalogues = [
  {
    market: "Aircraft leasing",
    parallel: "Allocating scarce long-lived assets",
    detail:
      "Lessors underwrite the lessee, the configuration, the maintenance condition, and the cost of the next transition — not just the lease rate.",
  },
  {
    market: "Equipment rental",
    parallel: "Regional repositioning and service",
    detail:
      "A branch network makes an asset in the wrong place economically equivalent to one in the right place.",
  },
  {
    market: "Semiconductor foundries",
    parallel: "Capacity planning against a pipeline",
    detail:
      "Capacity is committed years ahead, using a qualified customer pipeline to decide what to build.",
  },
  {
    market: "Cloud reserved capacity",
    parallel: "Contracting for scarce supply",
    detail:
      "Reserved, on-demand, and interruptible tiers — but only once the workload became standard enough to be fungible.",
  },
] as const;

export const analogueLesson =
  "In each of these markets the winner was not the largest listing board. It was the operator that made scarce capacity productive fastest.";
