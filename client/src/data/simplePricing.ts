export type SimplePricingOption = {
  id:
    | "capture"
    | "world-models"
    | "simulation"
    | "validated-evaluation"
    | "site-operator"
    | "site-monitoring";
  step: string;
  name: string;
  internalName: string;
  price: string;
  unit: string;
  payer: string;
  summary: string;
  includes: string[];
};

export const simplePricingOptions: SimplePricingOption[] = [
  {
    id: "capture",
    step: "Supply side",
    name: "Capture & Earn",
    internalName: "Capturer",
    price: "Free",
    unit: "you get paid per capture",
    payer: "Capturers (phone-first; smart glasses only when approved)",
    summary:
      "Apply for approved capture assignments. No cost to join; assignment cards show payout before work starts.",
    includes: [
      "Apply free; city, invite, and assignment gates still apply",
      "Assignment payout shown before you start",
      "Accepted captures become payout-eligible after review",
      "Phone-first capture; smart glasses only for approved repeat walkthroughs",
      "Referral or bonus programs require separate approval",
    ],
  },
  {
    id: "world-models",
    step: "First-eval ramp",
    name: "Lite Quick-Look Eval",
    internalName: "Policy Evaluation Run Lite",
    price: "$5,000-$8,000",
    unit: "per quick-look eval",
    payer: "Robot team / OEM / integrator",
    summary:
      "A low-friction first pass for one policy and one capture-backed task before the buyer commits to recurring eval infrastructure.",
    includes: [
      "~50 episodes",
      "1 policy",
      "Ranking-only report",
      "No failure taxonomy, calibration, or deployment guarantee",
    ],
  },
  {
    id: "simulation",
    step: "Recurring robot-team plan",
    name: "Robot Team Subscription",
    internalName: "Policy Evaluation Infrastructure",
    price: "$15,000",
    unit: "per month",
    payer: "Robot team / OEM / integrator",
    summary:
      "Unlimited evaluation cycles for active development, up to the agreed policy cap, with overage pricing above the cap.",
    includes: [
      "Unlimited eval cycles up to the active-policy cap",
      "Multiple site/task packs as scoped in the subscription",
      "Predicted success, policy ranking, failure taxonomy, and per-scenario metrics",
      "OOD/uncertainty flags, generated rollout clips, regression tracking, and validation targets",
    ],
  },
  {
    id: "validated-evaluation",
    step: "Single-site option",
    name: "Single Site Evaluation",
    internalName: "Standalone Site Eval",
    price: "$5,000+",
    unit: "per scoped site/eval",
    payer: "Robot team / OEM / integrator",
    summary:
      "A standalone site or evaluation scope when the buyer is not ready for the recurring plan.",
    includes: [
      "One site/task scope",
      "Policy ranking or site feasibility question",
      "Upgrade path into the robot-team subscription",
      "Validation or real-rollout evidence remains scoped separately",
    ],
  },
  {
    id: "site-operator",
    step: "Operator side",
    name: "Site Supply Review",
    internalName: "Operator Site Supply",
    price: "$5,000",
    unit: "per site",
    payer: "Site operator / facility owner",
    summary:
      "A low-cost path for operators to make useful facilities available as robot-team evaluation supply while keeping boundaries explicit.",
    includes: [
      "Submit or claim a real facility",
      "Define access windows, privacy boundaries, and restricted areas",
      "Review commercialization posture before robot-team use",
      "Rights, capture, and downstream use still require request-specific review",
    ],
  },
  {
    id: "site-monitoring",
    step: "Operator recurring",
    name: "Site Monitoring Subscription",
    internalName: "Per-Site Policy Regression",
    price: "$30,000-$40,000",
    unit: "per deployed site / year",
    payer: "Site operator / deployment owner",
    summary:
      "A yearly monitoring retainer for a deployed site when multiple new policy versions need change-management evidence.",
    includes: [
      "Separate from the $5,000 one-time site supply review",
      "Multiple policy-update checks up to the agreed annual cap",
      "New policy version triggers a site-specific regression eval",
      "Report card for operator change-management review",
      "No deployment approval, safety validation, or rights clearance guarantee",
    ],
  },
];

export function getPricingContactInterest(id: SimplePricingOption["id"]): string {
  if (id === "capture") return "capturer-signup";
  if (id === "site-operator" || id === "site-monitoring") return "site-review";
  if (id === "simulation" || id === "world-models" || id === "validated-evaluation") {
    return "policy-evaluation-run";
  }
  return "policy-evaluation-run";
}
