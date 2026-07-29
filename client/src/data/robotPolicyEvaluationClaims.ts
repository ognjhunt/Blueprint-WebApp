// Canonical public framing for Blueprint's single customer-facing product.
// Pipeline owns method qualification, routing, and scientific verdicts; WebApp
// collects the decision request and projects the returned evidence envelope.

export const robotPolicyEvaluationBoundary =
  "A Task Evaluation Run returns only the decisions supported inside its stated validation envelope. Estimates are not physical guarantees, safety approval remains external, and claims that cannot be supported virtually still require physical evidence.";

export const robotPolicyScreeningValue =
  "Test candidate policies or checkpoints against a prospective real-site task, discover failure conditions, and decide whether field time is justified.";

export const blueprintPositioning =
  "Blueprint turns a real site-task into a maintained testbed, routes each claim to the least expensive currently qualified evidence, and returns a bounded decision or an explicit abstention.";

export const siteSpecificRankingSummary =
  "Blueprint captures the site-task, maintains the testbed, evaluates the decision-relevant claims, and reports what is supported, rejected, unresolved, or still needs physical evidence.";

export const rankingOutcomeCategories = [
  {
    label: "Bounded positive decision",
    body: "The requested action is supported only inside the stated conditions and claim ceiling.",
  },
  {
    label: "Bounded negative decision",
    body: "The evidence supports rejecting an option or action inside the stated scope.",
  },
  {
    label: "Partial decision",
    body: "Some claims are resolved while other decision-relevant claims remain unknown.",
  },
  {
    label: "Explicit abstention",
    body: "The current evidence is not trustworthy enough to support the requested decision.",
  },
  {
    label: "Next evidence required",
    body: "Blueprint identifies the least expensive stronger experiment needed to move the decision forward.",
  },
] as const;

export const robotPolicyEvaluationBeachhead =
  "Current virtual evidence is strongest for navigation, mobile-base movement, and rigid pick-and-place in warehouse and logistics spaces. Contact-rich or safety-critical claims require a stronger validation envelope and may require physical evidence.";

export const robotPolicyBeachheadShort =
  "Warehouse and logistics tasks, with claim-specific evidence boundaries";

export const robotPolicyComparisonUseCases = [
  {
    title: "Compare internal candidates",
    body: "Evaluate checkpoints or policies under one decision, task, threshold, and provenance scope.",
  },
  {
    title: "Test task compatibility",
    body: "Find reach, embodiment, observation, action, and environmental incompatibilities before field time.",
  },
  {
    title: "Choose the next experiment",
    body: "Use unresolved claims, uncertainty, and the claim ceiling to decide whether to test physically, recapture, narrow the task, or stop.",
  },
] as const;

export const robotPolicyResearchSignalsNote =
  "External research can motivate an evidence method, but it is not a Blueprint result. Each method must be qualified for the claim and validation envelope in the current run.";

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
