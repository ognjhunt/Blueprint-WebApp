// Canonical, single-source copy for the one core service (Task Evaluation Run /
// policy ranking) and its proof boundary. Imported across public pages so the
// service framing, the beachhead scope, and the honesty language stay identical
// everywhere. Keep export names stable — several pages consume these.

export const robotPolicyEvaluationBoundary =
  "A Task Evaluation Run ranks robot policies on a captured real-site task envelope as an estimate and decision-support screen — never a guarantee, a safety certification, or a deployment-readiness claim. It holds as rank fidelity inside the measured site, task, robot, and threshold scope; policy-evaluation research is cited as external category evidence, and it does not turn a virtual score into a universal accuracy guarantee or public policy-ranking result outside the measured evaluation scope.";

// The one-line value proposition for the primary buyer (robot / foundation-model teams).
export const robotPolicyScreeningValue =
  "Rank your candidate policies on a captured real-site task envelope so you know which to field-test first — cheap screening before you spend field or pilot time.";

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
