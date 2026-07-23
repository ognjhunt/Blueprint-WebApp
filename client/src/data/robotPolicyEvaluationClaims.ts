// Canonical, single-source copy for the one core service (Task Evaluation Run /
// policy ranking) and its proof boundary. Imported across public pages so the
// service framing, the beachhead scope, and the honesty language stay identical
// everywhere. Keep export names stable — several pages consume these.

export const robotPolicyEvaluationBoundary =
  "A Task Evaluation Run ranks robot policies on a captured real-site task envelope as an estimate and decision-support screen — never a guarantee, a safety certification, or a deployment-readiness claim. It holds as rank fidelity inside the measured site, task, robot, and threshold scope; policy-evaluation research is cited as external category evidence, and it does not turn a virtual score into a universal accuracy guarantee or public policy-ranking result outside the measured evaluation scope.";

// The one-line value proposition for the primary buyer (robot / foundation-model teams).
export const robotPolicyScreeningValue =
  "Rank your candidate policies on the captured site and task where they would deploy, so only the two or three strongest need onsite pilot time.";

// The organizing idea for the whole webapp: what the customer is actually buying
// is a shortlist before an expensive onsite pilot — not episodes, subscriptions,
// or a deployment guarantee.
export const blueprintPositioning =
  "Blueprint ranks robot policies and robot teams against the site where they may be deployed, so only the strongest two or three candidates need an onsite pilot.";

// Plain-language summary of the one core service — site-specific robot ranking.
export const siteSpecificRankingSummary =
  "Blueprint captures the actual site and task, evaluates comparable robot policies under the same protocol, and returns the best-supported two or three candidates for an onsite pilot.";

// The verdict a candidate can receive. Every campaign resolves to one of these —
// including outcomes where nothing is shortlisted. Blueprint never manufactures a winner.
export const rankingOutcomeCategories = [
  {
    label: "Shortlisted",
    body: "Strong, consistent evidence across scenario families — recommended for an onsite pilot.",
  },
  {
    label: "Viable, below shortlist",
    body: "Competent, but outranked under the same site, task, seeds, and scoring rules.",
  },
  {
    label: "Insufficient evidence",
    body: "Too few resolved episodes or too much uncertainty to place with confidence.",
  },
  {
    label: "Incompatible",
    body: "Failed the embodiment, observation, action, or task-compatibility gate before ranking.",
  },
  {
    label: "Below minimum threshold",
    body: "Did not clear the task's floor for completion or safety-relevant behavior.",
  },
] as const;

// The evidence beachhead, stated plainly so the site claims where the science is
// strongest and guards the over-promise boundary at the same time.
export const robotPolicyEvaluationBeachhead =
  "Today the evidence is strongest for navigation and mobile-base movement plus rigid pick-and-place in warehouse and logistics spaces. Dexterous, contact-rich manipulation is out of scope for now.";

export const robotPolicyBeachheadShort =
  "Warehouse & logistics — navigation and rigid pick-and-place";

export const robotPolicyComparisonUseCases = [
  {
    title: "Compare your own checkpoints",
    body:
      "Rank current, previous, and candidate policies on the same captured task envelope before spending scarce robot time.",
  },
  {
    title: "Screen what earns pilot slots",
    body:
      "Rank an incoming base or foundation checkpoint, another internal team's policy, or a vendor runner under one shared task and threshold scope — so only the strongest earns field time.",
  },
  {
    title: "Decide the next test",
    body:
      "Use the ranking, failure clusters, OOD flags, and missing-proof labels to choose a pilot, tune, recapture, or hold path.",
  },
] as const;

// External, third-party research — cited as category evidence, never as a Blueprint result.
export const robotPolicyResearchSignalsNote =
  "External, third-party research cited as category evidence that generated-world evaluation can track real-world policy ranking. Correlation supports the ordering (rank fidelity) — not a calibrated per-policy accuracy, and only when anchored to real trials.";

export const robotPolicyResearchSignals = [
  {
    label: "SC3-Eval",
    href: "https://arxiv.org/html/2606.18610v3",
    stat: "0.929 closed-loop Pearson correlation",
    body:
      "Third-party result across seven real-world VLA policies — external category evidence for ranking order, not a Blueprint accuracy result.",
  },
  {
    label: "OSCAR",
    href: "https://arxiv.org/html/2606.04463v2",
    stat: "RoboArena eval-to-real correlation",
    body:
      "Third-party evidence of correlation between generated-world policy evaluation and real-world RoboArena ranking.",
  },
] as const;
