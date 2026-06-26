export const robotPolicyEvaluationBoundary =
  "Blueprint uses policy-evaluation research as category evidence for ranking and diagnostic workflows. It does not turn a virtual score into a universal accuracy guarantee or public policy-ranking result outside the measured evaluation scope.";

export const robotPolicyComparisonUseCases = [
  {
    title: "Compare your own checkpoints",
    body:
      "Run current, previous, and candidate policies against the same captured task envelope before spending scarce robot time.",
  },
  {
    title: "Compare teams or vendors",
    body:
      "Give site ops one evidence packet for policies submitted by internal teams, integrators, or vendors under the same task and threshold scope.",
  },
  {
    title: "Decide the next test",
    body:
      "Use ranking, failure clusters, OOD flags, and missing-proof labels to choose a pilot, tune, recapture, or hold path.",
  },
] as const;

export const robotPolicyResearchSignals = [
  {
    label: "SC3-Eval",
    href: "https://arxiv.org/html/2606.18610v1",
    stat: "0.929 closed-loop Pearson correlation",
    body:
      "Reported across seven real-world VLA policies, with failure-mode reproduction for fine-grained diagnostic comparison.",
  },
  {
    label: "OSCAR",
    href: "https://arxiv.org/html/2606.04463v2",
    stat: "RoboArena policy-evaluation proxy",
    body:
      "Reports strong correlation between virtual OSCAR policy evaluation and real-world evaluation on RoboArena.",
  },
] as const;
