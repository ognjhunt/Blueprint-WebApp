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

/* ------------------------------------------------------------- about page */

export const aboutHero = {
  eyebrow: "About Blueprint",
  title: "The gap between a good demo and a real building.",
  body:
    "A policy that works in a lab and a policy that works in this warehouse, on this shift, around these people are different claims. Blueprint exists to make the second one testable before anyone spends a week finding out the hard way.",
  chips: ["Capture first", "Estimates, never guarantees", "Rights travel with the evidence"],
} as const;

export const aboutStats: readonly StatTile[] = [
  {
    label: "Customer-facing services",
    value: "One",
    detail: "A Task Evaluation Run. Every other product name is retired, not renamed.",
  },
  {
    label: "Ways a run can end",
    value: "Five",
    detail: "Yes, no, partly, not yet — and the cheapest test that would settle it.",
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
      "We report what the evidence supports inside stated conditions. Partial answers and outright refusals to decide are first-class results, not failures to be dressed up.",
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
