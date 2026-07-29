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
//   - a run may end in a refusal to decide, and that is a valid result
//   - virtual evidence is never presented as a physical or safety guarantee
//   - figure values on the public site are schematic, never live run data

import type { EvidenceRung, ClaimInterval, OutcomeBand, DecisionCostRow, StatTile, LifecycleStage } from "@/components/site/figures";

/* -------------------------------------------------------------- home page */

export const homeHero = {
  eyebrow: "One service · Task Evaluation Runs",
  title: "Answer it before you send a robot.",
  body:
    "Field time is the most expensive possible way to learn that a policy does not work at your site. A Task Evaluation Run turns one real site-task into a testbed we maintain, tests the claims your decision actually rests on, and tells you what the evidence supports — including when it supports nothing yet.",
  chips: [
    "One service, one intake",
    "Answers claim by claim",
    "We say “not yet” out loud",
  ],
} as const;

export const homeStats: readonly StatTile[] = [
  {
    label: "Services to choose from",
    value: "One",
    detail: "A Task Evaluation Run. No tiers, no packages, no separate add-ons.",
  },
  {
    label: "Ways a run can end",
    value: "Five",
    detail: "Yes, no, partly, not yet — and the cheapest test that would settle it.",
  },
  {
    label: "Backends you pick",
    value: "Zero",
    detail: "You describe the decision. Choosing the method is our job, not yours.",
  },
  {
    label: "Published fixed prices",
    value: "None",
    detail: "Each run is scoped and quoted from the decision and evidence it needs.",
  },
];

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
      "Not “run a benchmark.” The actual call you are about to make, the threshold it turns on, and what a wrong yes would cost.",
  },
  {
    label: "We route each claim",
    detail:
      "Every claim goes to the cheapest evidence strong enough to carry it, and climbs only when that is not enough.",
  },
  {
    label: "You get an answer with its limits",
    detail:
      "What holds, what does not, what is still open, where the answer stops applying, and what to test next.",
  },
];

export const homeOutcomes: readonly OutcomeBand[] = [
  {
    label: "Yes, within these conditions",
    body: "The call is supported — and the report states exactly where that stops being true.",
    tone: "supported",
  },
  {
    label: "No",
    body: "The evidence supports ruling the option out. A clear no is often the cheapest result you can buy.",
    tone: "rejected",
  },
  {
    label: "Partly",
    body: "Some claims settled, others did not. You see which is which instead of an average that hides both.",
    tone: "partial",
  },
  {
    label: "Not yet",
    body: "The evidence is not strong enough to answer. We say so rather than dress a guess up as a finding.",
    tone: "abstained",
  },
  {
    label: "Test this next",
    body: "The least expensive experiment that would move the decision — including when that means real hardware.",
    tone: "next",
  },
];

export const homeEvidenceRungs: readonly EvidenceRung[] = [
  {
    label: "Geometry and reach",
    cost: 0.12,
    answers: "Whether the robot physically fits, reaches, and clears the space at all.",
  },
  {
    label: "Recorded real observations",
    cost: 0.3,
    answers: "What actually happens at this site — traffic, lighting, clutter, timing.",
    stopped: true,
  },
  {
    label: "Simulated rollouts",
    cost: 0.52,
    answers: "How a policy behaves across many variations of the task.",
  },
  {
    label: "Generated and model-based evidence",
    cost: 0.71,
    answers: "Coverage of conditions the capture did not contain, inside a stated envelope.",
  },
  {
    label: "Evidence from real hardware",
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
    label: "When you find out a policy will not work here",
    beforeLabel: "After the robot is already on site",
    afterLabel: "Before you schedule the visit",
  },
  {
    label: "What a negative answer costs you",
    beforeLabel: "A trip, a crew, and a slot on the floor",
    afterLabel: "A run, and the reason it failed",
  },
  {
    label: "What you can put in front of a reviewer",
    beforeLabel: "A demo reel and a judgement call",
    afterLabel: "Claims, the evidence behind each, and stated limits",
  },
];

export const homeLimits = [
  {
    title: "A run is evidence, not permission",
    body:
      "Nothing we return is a safety approval, a certification, or a licence to operate. Those stay with you and your regulator.",
  },
  {
    title: "Virtual evidence has an edge",
    body:
      "Every estimate comes with the conditions it was measured under. Outside them it is not a weaker claim — it is not a claim.",
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
  eyebrow: "Task Evaluation Runs · for robot teams",
  title: "Spend field time on the candidate that earned it.",
  body:
    "You have more checkpoints than sites, and more sites than weeks. Bring the candidates and the site-task, and find out which questions the current evidence can already close — and which ones only a real robot will settle.",
  chips: ["Bring policies or checkpoints", "Incompatibility found early", "A no is a useful result"],
} as const;

export const robotTeamValue = [
  {
    title: "Compare your own candidates",
    body:
      "Several checkpoints, one task, one threshold, one set of conditions. Same substrate for every candidate, so the comparison means something.",
  },
  {
    title: "Find the disqualifiers first",
    body:
      "Reach, footprint, embodiment, observation and action mismatches, environmental limits. Cheap to discover here, expensive to discover on site.",
  },
  {
    title: "Decide what to do next",
    body:
      "Test physically, recapture, narrow the task, or stop. The run names the next move and what it would cost you.",
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
    label: "Claims get routed",
    detail: "Each claim goes to the cheapest evidence strong enough to carry it. You do not choose the method.",
  },
  {
    label: "Read what holds",
    detail: "Supported, ruled out, still open — per claim, with the conditions attached. Not one number.",
  },
  {
    label: "Commit the field time",
    detail: "Now the trip is a test of something specific, not a fishing expedition.",
  },
];

/* --------------------------------------------------- site-operator page */

export const siteOperatorHero = {
  eyebrow: "Task Evaluation Runs · for site operators",
  title: "Find out what a robot could do here, before anyone shows up.",
  body:
    "You do not need a policy, a vendor, or an evaluation stack to start. Describe the job you would hand to a robot and the terms you would hand it under. We turn that into a testbed we maintain and a decision you can inspect.",
  chips: ["No candidate needed to start", "You keep control of access", "Rights and privacy in writing"],
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

export const howItWorksSteps = [
  {
    title: "Say what you need to decide",
    body:
      "The question, the claims under it, the threshold and its units, what a wrong yes would cost, how much risk is acceptable, your budget and deadline, what evidence already exists, and anything we may not do.",
  },
  {
    title: "Bind the run to a testbed",
    body:
      "One exact testbed ID, version, and digest. Raw capture stays the source of truth — derived evidence never quietly gets promoted to fact.",
  },
  {
    title: "Route every claim separately",
    body:
      "Geometry, real observations, simulation, world models, provider tools, physical tests: each claim gets the cheapest one strong enough. Choosing is our job.",
  },
  {
    title: "Measure and combine honestly",
    body:
      "Each method reports what it measured, under what conditions, how sure it is, and where methods disagreed. Disagreement is reported, not averaged away.",
  },
  {
    title: "Return the answer and its edges",
    body:
      "Yes, no, partly, or not yet. Unknown states fail closed, and a refusal to decide is never converted into a winner by comparing raw scores.",
  },
  {
    title: "Name the next cheapest test",
    body:
      "When the evidence falls short, the run says what would close the gap and whether that means real hardware.",
  },
] as const;

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
    "The verdict — including the decision to abstain",
  ],
} as const;

/* ------------------------------------------------------------ pricing page */

export const pricingHero = {
  eyebrow: "One service · scoped per run",
  title: "You pay for the decision, not a package.",
  body:
    "There is one thing to buy and no price list, because two runs that sound alike can need very different evidence. We scope the run with you and quote it before anything is authorised.",
} as const;

export const pricingDrivers = [
  { label: "The decision", detail: "How consequential it is, and how strong the evidence has to be to carry it." },
  { label: "What already exists", detail: "An existing testbed and prior evidence make a run cheaper. A cold start does not." },
  { label: "Candidates and scenarios", detail: "How many things are being compared, across how many conditions." },
  { label: "Compute and deadline", detail: "What the evidence plan needs, and how fast you need it." },
  { label: "Rights and privacy", detail: "Restrictions on capture, storage, providers, and permitted use." },
  { label: "Physical work", detail: "Whether settling the claims requires anyone on a real floor." },
] as const;

export const pricingIncluded = [
  "One decision-shaped request against a real site-task",
  "A versioned testbed reference the result is bound to",
  "Claim, threshold, risk, budget, and deadline scoping",
  "An evidence plan chosen per claim, and the reasoning",
  "The answer: yes, no, partly, or not yet",
  "The conditions it holds under, and where it stops",
  "Uncertainty, and any disagreement between methods",
  "The next cheapest test, and whether hardware is required",
  "Exact provenance, and what each artifact may be used for",
] as const;

export const pricingBoundaries = [
  {
    title: "A quote buys the work, not the answer you wanted",
    body:
      "Authorising a run does not purchase a winner, a green light, a field recommendation, or a passing result. It purchases an honest one.",
  },
  {
    title: "Price is set on our side",
    body:
      "We record your budget and deadline, but the site never treats a client-supplied number as authoritative. Scope and authorisation stay server-owned.",
  },
] as const;

/* ----------------------------------------------------------------- shared */

export const closingCta = {
  eyebrow: "Start with the decision",
  title: "Tell us what you need to decide.",
  body:
    "The site-task, the call you are about to make, the threshold it turns on, and anything we may not do. We will come back with the evidence plan and the quote.",
} as const;
