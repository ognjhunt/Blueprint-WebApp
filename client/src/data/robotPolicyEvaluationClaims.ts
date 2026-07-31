// Canonical public framing for Blueprint's single customer-facing product.
// Pipeline owns method qualification, routing, and scientific verdicts; WebApp
// collects the decision request and projects the returned evidence envelope.

export const robotPolicyEvaluationBoundary =
  "A Task Evaluation Run returns only the decisions supported inside its stated validation envelope. An ordering holds on the testbed version and conditions it was measured under; Blueprint has not measured how its orderings correlate with real-world orderings and does not inherit external rank-fidelity figures. Estimates are not physical guarantees, safety approval remains external, and claims that cannot be supported virtually still require physical evidence.";

export const robotPolicyScreeningValue =
  "Rule out candidate policies or checkpoints that a real site will not physically accept, then rank the remainder against that site-task with the margin, its interval, and the resolution floor of the design.";

export const blueprintPositioning =
  "Blueprint turns a real site-task into a maintained testbed, eliminates candidates on measured incompatibility, and ranks the rest — reporting each margin, the interval on it, and the smallest difference the design can separate.";

export const siteSpecificRankingSummary =
  "Blueprint captures the site-task, maintains the testbed, screens candidates on measured geometry, and reports the ordering of the survivors with per-gap intervals and the resolution floor.";

/**
 * Two claim families, deliberately separated.
 *
 * Screening claims are arithmetic over a measured site and a published robot
 * envelope, so they can name a cause and a magnitude. Ranking claims are
 * ordinal: they say which candidate led on this testbed, by how much, and
 * whether the design could separate the pair at all. Nothing in this product
 * infers *why* a policy would fail in the real world from a simulated or
 * generated rollout, and no copy on this site may imply that it does.
 */
export const rankingOutcomeCategories = [
  {
    label: "Measured incompatibility",
    body: "The candidate does not fit the captured site. Reported as a signed margin in metres with its calibration tolerance — the one result that names its own cause.",
  },
  {
    label: "Separated ordering",
    body: "The candidates are ranked and each adjacent gap has an interval that stays clear of zero, inside the stated conditions and claim ceiling.",
  },
  {
    label: "Partial ordering",
    body: "Some adjacent pairs separate and others fall inside the resolution floor, which is reported per pair rather than smoothed into one rank.",
  },
  {
    label: "Inside the resolution floor",
    body: "The observed gaps are smaller than the design can separate at the rollout count used. Reported as tied at that count, with the floor stated.",
  },
  {
    label: "Next evidence required",
    body: "Blueprint identifies the least expensive stronger experiment needed to move the decision forward, including the rollout count that would close a given gap.",
  },
] as const;

export const robotPolicyEvaluationBeachhead =
  "Current virtual evidence is strongest for navigation, mobile-base movement, and rigid pick-and-place in warehouse and logistics spaces. Contact-rich or safety-critical claims require a stronger validation envelope and may require physical evidence.";

export const robotPolicyBeachheadShort =
  "Warehouse and logistics tasks, with claim-specific evidence boundaries";

export const robotPolicyComparisonUseCases = [
  {
    title: "Screen on measured geometry",
    body: "Rule out reach, footprint, clearance, and sightline incompatibilities from the capture itself, before any rollout budget is committed.",
  },
  {
    title: "Rank internal candidates",
    body: "Order checkpoints or policies under one decision, task, threshold, testbed version, and provenance scope.",
  },
  {
    title: "Read the resolution before the rank",
    body: "Use the interval on each gap and the design's minimum separable difference to tell a real lead from two candidates that are simply tied.",
  },
  {
    title: "Choose the next experiment",
    body: "Use unseparated pairs, uncertainty, and the claim ceiling to decide whether to add rollouts, test physically, recapture, narrow the task, or stop.",
  },
] as const;

export const robotPolicyResearchSignalsNote =
  "External research can motivate an evidence method, but it is not a Blueprint result. Published rank-fidelity figures in this field are computed over roughly seven to eight policies, which leaves their confidence intervals wide; Blueprint neither inherits those point estimates nor reports one of its own until independently accepted real-world anchors exist. Each method must be qualified for the claim and validation envelope in the current run.";

export const robotPolicyResearchSignals = [
  {
    label: "SC3-Eval",
    href: "https://arxiv.org/html/2606.18610v3",
    stat: "External policy-evaluation research",
    body: "Category evidence for generated-world evaluation, not a Blueprint physical or ranking-fidelity claim.",
  },
  {
    label: "OSCAR",
    href: "https://arxiv.org/html/2606.04463v2",
    stat: "External policy-evaluation research",
    body: "Category evidence that may inform method qualification, not a universal accuracy guarantee.",
  },
] as const;
