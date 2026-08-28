// Rewritten public-site copy for the single Task Evaluation Run offer.
//
// The product boundaries here are identical to the ones in
// `robotPolicyEvaluationClaims.ts` — this file exists to say them in plain
// language on the marketing surface. Where that file is the canonical
// machine-facing phrasing (SEO descriptions, structured data, agent context),
// this is the buyer-facing voice.
//
// Rules that still hold in every line below:
//   - one customer-facing service, no package tiers or add-ons
//   - no published fixed price
//   - the customer never selects a simulator, world model, or provider
//   - virtual evidence is never presented as a physical or safety guarantee
//   - figure values on the public site are schematic, never live run data
//   - "benchmark" stays a singular, site-specific noun
//   - turnaround is always a *target*, never an asserted delivery
//
// On turnaround. UPDATED 2026-08-24 by owner decision: the 12–24h target may
// now appear on a public page, and it does — on /capture-visit, where "what
// happens after the visit" is the reader's actual question. It is still stated
// as a design target and never as a service level, and it is still kept off the
// homepage, whose tests continue to assert its absence. The reasoning that
// originally kept it off every surface is preserved below because the second
// half of it still binds: no SLA, contract field, or run-duration telemetry
// backs the number, so if telemetry later supports it, promote the wording
// everywhere at once rather than page by page.
//
// 12–24h is a design target, not a measured service level:
// no SLA, contract field, or run-duration telemetry backs it anywhere in the
// repo. It is worth saying loudly — it is the objection-killer for "a sim of
// my site will take longer than the pilot", and it is the evidence that the
// minimum-replica thesis holds at all, since manual authoring dominating is
// the recorded failure mode. But every instance says "target", because
// asserting an unmeasured service level is exactly the fabricated
// operational state the repo guide forbids. If run telemetry later supports
// it, promote the wording everywhere at once.
//
// On the word "benchmark". It is the category word robot teams already budget
// for, and the mechanism genuinely matches one: a fixed task, a versioned
// testbed, and the same conditions for every candidate. What it must never
// imply is a platform or a public leaderboard — "a benchmark for this site"
// is true with one design partner and still true with twenty. "Our
// benchmarks" or "the benchmark platform" is not, and doctrine draws that
// line explicitly (PLATFORM_CONTEXT.md: not a general benchmark platform).
//
// On how a run reports what it could not settle. A run still has an
// `abstained` terminal state — that is a Pipeline-owned contract value, not a
// copy decision, and nothing here removes it. What changed is the framing: an
// unsettled claim is stated as a *resolution* fact ("this design separates
// gaps of 20 points or more; these two candidates are 4 apart") rather than as
// a stance about honesty. The site sells the ranking. Resolution is the spec
// on the ranking, the way a scale has a readability. It is never a section
// header, a headline, or a virtue.
//
// Buyer-facing vocabulary: "candidate", not "checkpoint" (a non-technical
// buyer reads that as a milestone); "ranking", not "ordering".
//
// "Candidate" vs "robot", and where each one belongs. Inside a run the noun is
// "candidate": a run compares policies or configurations against one site-task
// and does not pick an embodiment (PLATFORM_CONTEXT.md exact v1 scope: one
// fixed robot arm, two frozen policy checkpoints or configurations). Every
// figure, result, ranking, and boundary line below still says "candidate", and
// that is not negotiable — "we ranked the robots" would describe a service the
// evidence does not support.
//
// The hero is the one place that says "robots", deliberately. A site lead
// arriving cold is choosing between robot companies, not between checkpoints,
// and a headline written in the run's internal vocabulary fails the only job a
// headline has. The two coexist because they answer different questions:
// "evaluate robots" is what the business does, "rank candidates" is what a run
// returns. The moment a *result* is described in the headline's vocabulary,
// that is the line being crossed.
//
// On "deploy". The offer is evaluation plus the handoff into deployment, and
// the pricing proves the alignment: Blueprint is paid only on collected
// provider revenue from a real deployment (see `pricingHero`). So "help get
// the winner installed" is true and worth saying. What stays false, and is
// contradicted on the same page every time it appears, is that Blueprint
// performs the install, the commissioning, the physical validation, or the
// safety approval. Every surface carrying the deploy claim also carries the
// boundary — that pairing is the rule, not a nicety.
//
// On "a paying site". See `demandQualifier` below for what backs it and what
// it may never be stretched into.

import type { EvidenceRung, ClaimInterval, OutcomeBand, DecisionCostRow, StatTile, LifecycleStage } from "@/components/site/figures";

/* -------------------------------------------------------------- home page */

export const homeHero = {
  eyebrow: "Robot evaluation and deployment",
  title: "Evaluate robots. Deploy the one that works.",
  /**
   * The same headline, pre-split at the sentence.
   *
   * Greedy wrapping breaks this line as "Evaluate robots. Deploy the / one
   * that works.", which strands the second verb and kills the two-beat read
   * the headline is built on. No max-width fixes it: any width narrow enough
   * to push "Deploy" down also fragments the second sentence. So the break is
   * authored. `title` stays the flat string for SEO, structured data, and
   * anything that needs one value; the renderer joins these with a real space
   * so the accessible name still matches it exactly.
   */
  titleLines: ["Evaluate robots.", "Deploy the one that works."],
  body:
    "We only run evaluations for real sites with a real job and a budget to fill it. We record the job, rebuild it as one test every robot takes, and help get the winner installed.",
  chips: [
    "Every job has a buyer behind it",
    "One test, every robot takes it",
    "The robot company still does the install",
  ],
} as const;

/**
 * The demand rule, in one place, because it is the claim the whole site rests
 * on and it must read the same everywhere it appears.
 *
 * It is grounded, not aspirational. Site intake requires a budget range
 * (`BudgetBucket` in `types/inbound-request.ts`), and the pilot-opportunity
 * fields ask for a named internal owner, a pilot area, timing, and the
 * procurement path before an opportunity can be shown to robot teams. A site
 * that will not answer those does not become an evaluation.
 *
 * What it must never say: that a budget is a signed order, that a named owner
 * is a purchase commitment, or that Blueprint has verified funds. The honest
 * claim is about *who we accept*, not about a guaranteed sale.
 */
export const demandQualifier = {
  short: "Every evaluation has a paying site behind it.",
  body:
    "We do not run evaluations against hypothetical sites. Before a job becomes an evaluation, the site names the work, a budget range, an internal owner, and how it buys. Robot teams are testing against demand, not a demo.",
  note: "A budget and an owner are not a signed order. They are the bar to get in.",
} as const;

export const homeStats: readonly StatTile[] = [
  {
    label: "Services to choose from",
    value: "One",
    detail: "A Task Evaluation Run. No tiers, no packages, no separate add-ons.",
  },
  {
    label: "Ruled out by measurement",
    value: "First",
    detail:
      "Reach, clearance, footprint, and sightlines come off the capture itself — before a single rollout is spent on a candidate the building will not take.",
  },
  {
    label: "Every ranking ships with",
    value: "Its margin",
    detail:
      "The gap between candidates, the 95% interval on that gap, and the smallest gap the design can separate at all.",
  },
  {
    label: "Backends you pick",
    value: "Zero",
    detail: "You describe the decision. Choosing the method is our job, not yours.",
  },
];

/**
 * The screening pass — hard incompatibilities, measured off the capture.
 *
 * These rows are the one place a run says *why* rather than *which*. Reach,
 * clearance, footprint, and sightlines are arithmetic over a measured place and
 * a published robot envelope; there is no policy, no rollout, and no transfer
 * assumption between the capture and the answer. That is why a screening result
 * can name a cause ("misses the opening by 18 cm") when a ranking result can
 * only name an order.
 *
 * `marginM` is measured minus required, in metres, and `toleranceM` is the
 * calibration uncertainty on it. The verdict is **derived** from those two
 * numbers rather than authored, which mirrors the Pipeline's analytic
 * reachability adapter: clears only when the whole interval is above zero,
 * ruled out only when the whole interval is below it, and otherwise reported as
 * a measurement the capture cannot separate at its current precision.
 */
export interface ScreeningMargin {
  /** The check, in the words a site lead would use. */
  check: string;
  /** What the capture measured, with its unit. */
  measured: string;
  /** What the candidate needs, with its unit. */
  required: string;
  /** Measured minus required, in metres. Negative means it does not fit. */
  marginM: number;
  /** Calibration uncertainty on the margin, in metres. */
  toleranceM: number;
}

export const homeScreeningMargins: readonly ScreeningMargin[] = [
  {
    check: "Base reach to the pick fixture",
    measured: "0.94 m from the approach pose",
    required: "0.38–1.18 m envelope",
    marginM: 0.24,
    toleranceM: 0.03,
  },
  {
    check: "Dock door at loaded height",
    measured: "2.16 m opening",
    required: "2.34 m loaded",
    marginM: -0.18,
    toleranceM: 0.02,
  },
  {
    check: "Aisle width against the footprint",
    measured: "1.42 m clear",
    required: "1.31 m with clearance",
    marginM: 0.11,
    toleranceM: 0.04,
  },
  {
    check: "Swept path past the rack upright",
    measured: "0.06 m nearest approach",
    required: "0.10 m minimum",
    marginM: -0.04,
    toleranceM: 0.05,
  },
];

/**
 * The ordering, and the resolution that comes with it.
 *
 * A rank on its own is not a deliverable — a rank you cannot separate is a coin
 * toss with a chart around it. So every candidate carries its interval, every
 * adjacent pair carries the gap and the interval on the gap, and the figure
 * carries the floor: the smallest difference a design at this rollout count can
 * resolve at all.
 *
 * The numbers below are schematic but internally consistent, and the floor is
 * real arithmetic rather than a chosen round number. At 100 rollouts per
 * candidate, the pooled two-proportion design resolves about 19.8 points at 80%
 * power — so a 24-point gap separates and a 4-point gap does not, no matter how
 * confident the ordering looks.
 */
export interface RankingCandidate {
  candidate: string;
  /** Success rate on the testbed, 0–1. */
  rate: number;
  /** Lower bound of the 95% interval, 0–1. */
  low: number;
  /** Upper bound of the 95% interval, 0–1. */
  high: number;
}

export const homeRankingCandidates: readonly RankingCandidate[] = [
  { candidate: "Candidate A", rate: 0.62, low: 0.522, high: 0.709 },
  { candidate: "Candidate C", rate: 0.38, low: 0.291, high: 0.478 },
  { candidate: "Candidate D", rate: 0.34, low: 0.255, high: 0.437 },
];

/** Rollouts per candidate behind the figure above. Sets the resolution floor. */
export const homeRankingRolloutsPerCandidate = 100;

/**
 * Smallest gap the design above can separate, in points of success rate.
 * Pooled two-proportion approximation at alpha 0.05 and 80% power.
 */
export const homeRankingResolutionFloorPp = 19.8;

/** The testbed version an ordering is pinned to. Schematic. */
export const homeRankingTestbedVersion = "testbed v3 · digest-pinned";

/**
 * The out-of-distribution axes an ordering is reported across. These are the
 * five the Pipeline's decision-grade ranking requires — an ordering that does
 * not cover all five is blocked rather than published.
 */
export const homeRankingOodAxes = [
  "site",
  "task",
  "embodiment",
  "viewpoint",
  "appearance",
] as const;

export const homeLifecycle: readonly LifecycleStage[] = [
  {
    label: "Bring one real task",
    detail:
      "A specific job at a specific site: the conditions, who can be there, what counts as success, and what must never happen.",
  },
  {
    label: "We build the testbed",
    detail:
      "The site-task becomes a captured, versioned testbed we keep — so this answer and the next one are measured against the same thing.",
  },
  {
    label: "You state the decision",
    detail:
      "Not “give me a score.” The actual call you are about to make, the candidates in front of you, and what a wrong yes would cost.",
  },
  {
    label: "We screen on measurement",
    detail:
      "Reach, clearance, footprint, and sightlines come off the capture. Candidates the building will not take are out before anyone spends a rollout on them.",
  },
  {
    label: "We order what survives",
    detail:
      "The remaining candidates are ranked on the same testbed version, with the margin, the interval on it, and the smallest gap the run can resolve.",
  },
];

export const homeOutcomes: readonly OutcomeBand[] = [
  {
    label: "Ordered, with margin",
    body: "The candidates are ranked and the gaps clear the run's resolution. You get the order, each margin, and the conditions it holds under.",
    tone: "supported",
  },
  {
    label: "Ruled out on measurement",
    body: "A candidate does not physically fit the site. The cheapest finding in a run, and the one that names its own cause.",
    tone: "rejected",
  },
  {
    label: "Ordered in part",
    body: "Some pairs separate and some sit inside the resolution. You see which is which, instead of a full ranking implying precision the design does not have.",
    tone: "partial",
  },
  {
    label: "Inside the resolution",
    body: "The gaps are smaller than this design can separate. The run reports the floor and what it would take to get under it.",
    tone: "abstained",
  },
  {
    label: "Test this next",
    body: "The least expensive experiment that would move the decision — more rollouts, a recapture, or real hardware.",
    tone: "next",
  },
];

// Ordered by relative cost to run, NOT by authority. Real capture is the source
// of truth; a costlier derived method never outranks it. Each entry carries an
// explicit `basis` so the public figure cannot be read as a proof hierarchy.
export const homeEvidenceRungs: readonly EvidenceRung[] = [
  {
    label: "Geometry and reach",
    basis: "Computed from capture",
    cost: 0.12,
    answers: "Whether the robot physically fits, reaches, and clears the space at all.",
  },
  {
    label: "Recorded real observations",
    basis: "Real capture",
    cost: 0.3,
    answers:
      "What actually happens at this site — traffic, lighting, clutter, timing. The reference every derived method is checked against.",
    stopped: true,
  },
  {
    label: "Simulated rollouts",
    basis: "Derived",
    cost: 0.52,
    answers: "How a policy behaves across many variations of the task, inside a stated envelope.",
  },
  {
    label: "Generated and model-based evidence",
    basis: "Derived",
    cost: 0.71,
    answers:
      "Advisory coverage of conditions the capture did not contain. Support for a claim, never ground truth for it.",
  },
  {
    label: "Evidence from real hardware",
    basis: "Real world",
    cost: 0.94,
    answers: "The only thing that settles a physical claim. Sometimes there is no substitute.",
  },
];

export const homeClaims: readonly ClaimInterval[] = [
  {
    claim: "Candidate A can reach the fixture from the approach lane.",
    estimate: 0.97,
    low: 0.95,
    high: 0.99,
    verdict: "supported",
  },
  {
    claim: "Candidate B clears the dock door at loaded height.",
    estimate: 0.62,
    low: 0.54,
    high: 0.7,
    verdict: "rejected",
  },
  {
    claim: "Candidate A outperforms candidate B on this site.",
    estimate: 0.88,
    low: 0.79,
    high: 0.96,
    verdict: "unresolved",
  },
];

export const homeClaimThreshold = 0.9;
export const homeClaimMetricLabel = "success rate";

export const homeDecisionCost: readonly DecisionCostRow[] = [
  {
    label: "How you pick which candidate ships",
    beforeLabel: "Whichever one demoed best somewhere else",
    afterLabel: "A ranking measured on your site",
  },
  {
    label: "When you find out one will not fit",
    beforeLabel: "After the robot is already on the floor",
    afterLabel: "Before you schedule the visit",
  },
  {
    label: "What you can put in front of a reviewer",
    beforeLabel: "A demo reel and a judgement call",
    afterLabel: "The order, each margin, and the resolution behind them",
  },
];

export const homeLimits = [
  {
    title: "A run is evidence, not permission",
    body:
      "Nothing we return is a safety approval, a certification, or a licence to operate. Those stay with you and your regulator.",
  },
  {
    title: "A ranking holds only where it was measured",
    body:
      "A ranking holds on the testbed version it was measured on, under the conditions stated. We have not measured how our rankings track real-world results, and we do not inherit anyone else's correlation figures as if they were ours.",
  },
  {
    title: "Resolution is a property of the design",
    body:
      "Every run can only separate gaps above a certain size. We publish that floor with the ranking, because a rank you cannot separate is not a result.",
  },
  {
    title: "Some claims need hardware",
    body:
      "Contact-heavy and safety-critical questions often cannot be settled short of real robots. When that is the case, the run says so.",
  },
  {
    title: "Where we are strongest today",
    body:
      "Navigation, mobile-base movement, and rigid pick-and-place in warehouse and logistics spaces. We will tell you when your task is outside that.",
  },
] as const;

/* ------------------------------------------------------- robot-team page */

export const robotTeamHero = {
  eyebrow: "For robot teams",
  title: "Arrive with the robot. Not before it.",
  body:
    "Tell us your capability envelope and we go find matching work. Every opportunity reaches you with the customer qualified, the task defined, the site modelled, the envelope screened, and the acceptance test already written — so your engineers commission rather than discover.",
  chips: [
    "Zero engineering hours before arrival",
    "Free to browse and screen",
    "One standard evaluation included",
  ],
} as const;

export const robotTeamValue = [
  {
    title: "The site already wants to buy",
    body:
      "Every workflow reaches you with a budget range, a named internal owner, and a procurement path. You are not qualifying the lead — that already happened.",
  },
  {
    title: "Skip repeated site discovery",
    body:
      "Read one standard dossier instead of rebuilding the task from calls, phone videos, floor plans, and scattered notes.",
  },
  {
    title: "Arrive with the gaps named",
    body:
      "The handoff tells you what fit, what failed, what is still unknown, and exactly what the onsite proof of concept must settle.",
  },
] as const;

export const robotTeamFlow: readonly LifecycleStage[] = [
  {
    label: "Describe the call",
    detail:
      "The decision in front of you, the candidates, the threshold, and what a wrong yes would cost. Budget and deadline included.",
  },
  {
    label: "Pin the substrate",
    detail: "The run is bound to one exact testbed version and digest, so results stay comparable later.",
  },
  {
    label: "Screen on measurement",
    detail: "Reach, clearance, and footprint come off the capture. Candidates the site will not take are out, with the shortfall in metres.",
  },
  {
    label: "Read the ranking",
    detail: "The survivors ranked, each margin with its interval, and the smallest gap this design separates. Not one number.",
  },
  {
    label: "Commit the field time",
    detail: "Now the trip is a test of something specific, not a fishing expedition.",
  },
];

/* --------------------------------------------------- site-operator page */

export const siteOperatorHero = {
  eyebrow: "For site operators",
  title: "Show us the job. We find the robot that can do it.",
  body:
    "Tell us one real job you want a robot to do. We capture it once, set the success bar with you, and run every qualified robot team against the same test — so you compare measured results instead of demo reels.",
  chips: ["Free to submit", "Captured once, read by many", "Your site data stays controlled"],
} as const;

export const siteOperatorNeeds = [
  {
    title: "Start with the job, not a robot",
    body:
      "The workflow, the shifts, the conditions, the failures you will not accept. That is enough to scope a run.",
  },
  {
    title: "See what is missing",
    body:
      "The run separates what your site can already answer from what needs stronger evidence — or real hardware.",
  },
  {
    title: "Judge candidates on your terms",
    body:
      "When vendors or policies arrive, they enter the same run, against the same task and the same threshold.",
  },
  {
    title: "Keep the parts that matter to you",
    body:
      "Capture windows, restricted areas, privacy, who may use the evidence, and whether anyone tests on your floor.",
  },
] as const;

export const siteOperatorControls = [
  { label: "Capture windows", detail: "You set when, where, and who is on site." },
  { label: "Restricted areas", detail: "Excluded before capture, not redacted after." },
  { label: "Evidence use", detail: "What the run may be used for is written down, per artifact." },
  { label: "Physical access", detail: "Any test on your floor is a separate, explicit yes." },
] as const;

/* ------------------------------------------------------ how-it-works page */

export const howItWorksSplit = {
  blueprint: [
    "Secure intake and who is allowed to see what",
    "The maintained testbed, its versions and digests",
    "Durable records of every request and result",
    "Provenance, rights, and permitted-use tracking",
  ],
  pipeline: [
    "Whether a method is qualified for a given claim",
    "Which evidence a claim is routed to, and when to escalate",
    "What was measured, and how sure the measurement is",
    "The ranking, its margin, and anything the evidence could not separate",
  ],
} as const;

/* ------------------------------------------------------------ pricing page */

export const pricingHero = {
  eyebrow: "Two numbers · sites pay nothing",
  title: "Two charges. The site pays nothing.",
  body:
    "Robot teams pay $1,000 to evaluate a site-task. Win it and the total is $10,000. Lose and it stays $1,000. No percentage, no per-robot rate, nothing recurring.",
} as const;

export const pricingIncluded = [
  "One decision-shaped request against a real site-task",
  "A versioned testbed reference the result is bound to",
  "Claim, threshold, risk, budget, and deadline scoping",
  "A measured screening pass, with the shortfall on anything ruled out",
  "An evidence plan chosen per claim, and the reasoning",
  "The ranking of the surviving candidates, with each margin",
  "The interval on every margin, and the gap the design can separate",
  "The conditions it holds under, and where it stops",
  "Any disagreement between methods, reported rather than averaged",
  "The next cheapest test, and whether hardware is required",
  "Exact provenance, and what each artifact may be used for",
] as const;

export const pricingBoundaries = [
  {
    title: "Free evaluation does not buy the answer you wanted",
    body:
      "Included standard evaluation capacity does not purchase a particular winner, a green light, a field recommendation, or a passing result. It returns only the decision the evidence supports.",
  },
  {
    title: "Commercial state stays server-owned",
    body:
      "Budget, deposit, provider price, collected revenue, refunds, annual volume, and the applicable network fee must come from accepted server-owned records rather than browser-supplied values.",
  },
] as const;

/* ------------------------------------------------------------- about page */

export const aboutHero = {
  eyebrow: "About Blueprint",
  title: "We evaluate robots for sites that are ready to buy.",
  body:
    "A robot deployment starts with weeks of discovery, site recreation, simulation, and fit testing — repeated inside every vendor conversation. Blueprint does that work once, as one Task Evaluation Run, for sites that have a job and a budget.",
  chips: ["Record the job once", "Test every robot on it", "Hand off to the install"],
} as const;

export const aboutStats: readonly StatTile[] = [
  {
    label: "Customer-facing services",
    value: "One",
    detail: "A Task Evaluation Run. Every other product name is retired, not renamed.",
  },
  {
    label: "Rankings without a margin",
    value: "None",
    detail: "A rank ships with its gap, the interval on that gap, and the floor the design can separate.",
  },
  {
    label: "Backends you pick",
    value: "Zero",
    detail: "Which method is qualified for which claim is the judgement, and it is ours.",
  },
  {
    label: "Claims without provenance",
    value: "None",
    detail: "Every figure traces to a capture, a version, a digest, and a permitted use.",
  },
];

export const aboutPrinciples = [
  {
    title: "Capture first. Claim later.",
    body:
      "Every testbed starts as one real place, recorded with timestamps, poses, device metadata, and a rights record. Derived geometry, simulation, and generated media never outrank the capture they came from.",
  },
  {
    title: "An estimate is never a guarantee",
    body:
      "We report what the evidence supports inside stated conditions, and we publish the resolution alongside the ranking — because a gap the design cannot separate is not a lead.",
  },
  {
    title: "Generated frames are review support",
    body:
      "Simulated and generated material helps a team read a run. It is labelled that way everywhere it appears, and it is never shown as real-world proof.",
  },
  {
    title: "Rights travel with the evidence",
    body:
      "Consent, privacy, restricted areas, and permitted use live on the artifact and the manifest — not in marketing copy, and not in anyone's memory of a conversation.",
  },
  {
    title: "Field time is the scarce resource",
    body:
      "Everything here exists to make one real site usable before that clock starts, and to be honest about the questions only a real robot on a real floor can settle.",
  },
] as const;

export const aboutMission = {
  quote:
    "The expensive part of robotics is field time. Our job is to make one real site usable before that clock starts — with proof a serious team can actually read.",
  body:
    "Blueprint was built by Nijel Hunt around the gap between an interesting robotics demo and serious, site-specific deployment work. Background in robotics simulation, 3D capture, and deployment operations.",
  note:
    "Every extra product name is another chance to sell a claim the evidence cannot carry. One service, scoped to one decision, is harder to fake and easier to check.",
} as const;

/* -------------------------------------------------------- governance page */

export const governanceHero = {
  eyebrow: "Governance",
  title: "Rights, privacy, and provenance — kept visible.",
  body:
    "One service runs against a captured real site-task, so the questions that matter are who allowed the capture, what may be done with it, and how anyone checks. Those answers are product surfaces here, not promises.",
  chips: ["Rights stay explicit", "Hosted access stays bounded", "No claims beyond the record"],
} as const;

export const governanceGates = [
  {
    title: "Rights",
    body:
      "Rights class, export entitlements, and sharing limits are attached to the capture record and manifest, never inferred from copy. What is licensed is readable before anyone gets access.",
  },
  {
    title: "Privacy",
    body:
      "Records state whether privacy processing ran, whether raw media is retained, and what stays visible or exportable. Restricted, private, and employee-only areas are out of scope by default.",
  },
  {
    title: "Provenance",
    body:
      "Facility identifier, capture timing, freshness, approval path, and evidence depth travel with the testbed, so a site counts as current only when it actually is.",
  },
  {
    title: "Scope limits",
    body:
      "Hosted review separates what can be launched, what stays human-gated, and which outputs are labelled examples rather than confirmed exports.",
  },
] as const;

export const governanceOperatorControls = [
  { title: "Capture windows", body: "When anyone is on site, and for how long." },
  { title: "Restricted areas", body: "What is never captured, and what is redacted afterwards." },
  {
    title: "Permitted evidence use",
    body: "Whether an artifact may be used for evaluation, and whether post-training use is allowed at all.",
  },
  { title: "Physical access", body: "Whether a robot may ever run here, and under whose supervision." },
  {
    title: "Safety approval",
    body: "Yours and your regulator's. Never ours, and never implied by a result.",
  },
] as const;

export const governanceCommitments = [
  "Evidence depth, freshness, and commercial status are shown before access, not after.",
  "Rights, restricted zones, and export scope stay attached to the manifest, not the marketing.",
  "Public proof and example UI are separated on every hosted-access surface.",
  "Generated and simulated media is labelled review support, never real-world proof.",
  "Only the per-claim outcome the run envelope supports is reported — never a deployment guarantee.",
  "Takedown, refresh, redaction, and revocation requests are honoured on the published timeline.",
] as const;

export const governanceRightsPacket: readonly { label: string; value: string }[] = [
  { label: "Packet ID", value: "RIGHTS-2049-08" },
  { label: "Facility", value: "SITE-2049 · Midwest DC" },
  { label: "Eval envelope", value: "Nav + rigid pick-and-place · dexterous out of scope" },
  { label: "Rights class", value: "Evaluation now · licensed evidence export only when eligible" },
  { label: "Export scope", value: "Buyer + 1 named policy team" },
  { label: "Restricted zones", value: "Checkout · employee corridor" },
  { label: "Retention", value: "Raw 90d · derived 365d" },
  { label: "Approval path", value: "Operator → Blueprint review" },
  { label: "Revocation", value: "Takedown honoured ≤ 5 business days" },
];

/* ----------------------------------------------------------------- shared */

export const closingCta = {
  eyebrow: "Start with the decision",
  title: "Tell us what you need to decide.",
  body:
    "The site-task, the call you are about to make, the threshold it turns on, and anything we may not do. We will come back with the evidence plan and the quote.",
} as const;

/* ------------------------------------------------------------- run film */

/**
 * Script for "The Run Film" — the scroll-driven motion graphic that shows one
 * Task Evaluation Run end to end instead of describing it.
 *
 * Three rules govern this block, and they are acceptance criteria rather than
 * preferences:
 *
 *   - `label` is at most 8 words; `caption` is at most 22 words, and each
 *     caption carries its own count. A caption that needs more than 22 words is
 *     a caption trying to carry two acts — split the act, do not raise the cap.
 *   - Plain language leads and the internal term follows. `caption` is what a
 *     visitor who has never heard of a Task Evaluation Run reads; `term` is the
 *     small mono chip beneath it. Never the reverse.
 *   - `actor` says who did this. Two acts are the buyer's; the rest are ours,
 *     and that split is the point — method selection is the last thing a buyer
 *     should be holding.
 *
 * No provider, model, or vendor name appears here, and no metric, count, or
 * customer is invented. The intervals and verdicts the film draws come from
 * `homeClaims` above, so the film and the claim-threshold chart cannot drift.
 */
export interface RunFilmAct {
  /** Stable key, used for React keys, the stepper, and tests. */
  id: string;
  /** The act's on-screen name. At most 8 words. */
  label: string;
  /** The one caption for this act. At most 22 words. */
  caption: string;
  /** The internal term, shown as a small mono chip under the human words. */
  term: string;
  /** Who performed this act. Rendered as a persistent side-marker. */
  actor: "You" | "Blueprint";
}

export const runFilmActs: readonly RunFilmAct[] = [
  {
    id: "capture",
    label: "One real site-task",
    // 17 words.
    caption:
      "You bring one real job at one real site. We capture the place exactly as it is.",
    term: "capture bundle",
    actor: "You",
  },
  {
    id: "testbed",
    label: "The testbed we keep",
    // 19 words.
    caption:
      "The capture becomes a testbed we version, pin, and maintain, so today's answer and next quarter's stay comparable.",
    term: "maintained site-task testbed",
    actor: "Blueprint",
  },
  {
    id: "decision",
    label: "The decision you are making",
    // 19 words.
    caption:
      "Not “give me a score.” The actual call, the threshold it turns on, and what a wrong yes would cost.",
    term: "decision request",
    actor: "You",
  },
  {
    id: "claims",
    label: "One decision, several claims",
    // 18 words.
    caption:
      "The decision splits into claims that can each be tested — and can each be wrong — on their own.",
    term: "claim decomposition",
    actor: "Blueprint",
  },
  {
    id: "routing",
    label: "Each claim finds its evidence",
    // 19 words.
    caption:
      "Each claim goes to the cheapest evidence that is strong enough. You never pick the method — that is our job.",
    term: "evidence plan",
    actor: "Blueprint",
  },
  {
    id: "measurement",
    label: "What came back",
    // 19 words.
    caption:
      "Every method reports what it measured, under what conditions, and how sure it is. Disagreement is reported, never averaged away.",
    term: "normalised results",
    actor: "Blueprint",
  },
  {
    id: "envelope",
    label: "The order and its resolution",
    // 17 words.
    caption:
      "The order, each margin, and the interval on it — plus the smallest gap this run could separate.",
    term: "decision envelope",
    actor: "Blueprint",
  },
];

/**
 * The evidence ladder the film's claims climb, cheapest first. Cost order is
 * not authority order: real capture stays the reference every derived method is
 * checked against, which is why `basis` is carried separately from position.
 */
export const runFilmRungs: readonly { label: string; basis: EvidenceRung["basis"] }[] = [
  { label: "Geometry and reach", basis: "Computed from capture" },
  { label: "Recorded real observations", basis: "Real capture" },
  { label: "Simulated rollouts", basis: "Derived" },
  { label: "Generated and model-based evidence", basis: "Derived" },
  { label: "Evidence from real hardware", basis: "Real world" },
];

export interface RunFilmRoute {
  /** Short form of the claim, so a narrow row stays readable. At most 8 words. */
  short: string;
  /** Index into `runFilmRungs` the claim's evidence was actually taken from. */
  rung: number;
  /**
   * A rung this claim was refused, if any. A method is only used where it has
   * been qualified for that kind of claim, and being cheaper never overrides
   * that — this is the gate that makes the third claim end unresolved.
   */
  gate?: { rung: number; reason: string };
  /** Rung that would settle a claim the evidence could not close. */
  nextTest?: number;
  /** The claim, its interval and its verdict — shared with the other figures. */
  claim: ClaimInterval;
}

export const runFilmRoutes: readonly RunFilmRoute[] = [
  { short: "Can it reach the fixture?", rung: 0, claim: homeClaims[0] },
  { short: "Does it clear the dock door?", rung: 1, claim: homeClaims[1] },
  {
    short: "Is A better than B here?",
    rung: 2,
    gate: {
      rung: 3,
      reason: "Not qualified as proof for a head-to-head claim — support only",
    },
    nextTest: 4,
    claim: homeClaims[2],
  },
];

/**
 * The decision the film follows, and the two things an envelope never grants.
 *
 * The stamps are not marketing framing. `DecisionEnvelope` fails validation
 * unless both `deployment_approval` and `safety_certification` are false, so
 * this is a contract-level guarantee rather than a promise — which is exactly
 * why it belongs on the public page.
 */
export const runFilmDecision = {
  question: "Should candidate A do this job at this site?",
  metricLabel: "success rate",
} as const;

export const runFilmStamps: readonly { label: string; value: string }[] = [
  { label: "Deployment approval", value: "No" },
  { label: "Safety certification", value: "No" },
];

export const runFilmStampNote =
  "A run never grants either one. Both stay external, and the contract refuses an envelope that claims otherwise.";
