export type SimplePricingOption = {
  id: "capture" | "world-models" | "simulation" | "validated-evaluation" | "site-operator";
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
    step: "Follow-on improvement",
    name: "Policy Improvement Run",
    internalName: "Sim-only Policy Improvement",
    price: "$35,000",
    unit: "per sim-only run",
    payer: "Robot team / OEM / integrator",
    summary: "Follow-on work after evaluation: improve a customer-supplied policy, adapter, task head, distilled skill, or complete policy inside simulation.",
    includes: [
      "Baseline evaluation and dominant failure-mode diagnosis",
      "Twin and cousin scenarios plus curriculum",
      "Candidate policy improvement and sealed scenario test",
      "Improved artifact, export format, and evidence report",
    ],
  },
  {
    id: "simulation",
    step: "Primary evaluation",
    name: "Policy Evaluation Run",
    internalName: "Real-Site Policy Evaluation",
    price: "$6,500",
    unit: "per 100-episode run",
    payer: "Robot team / OEM / integrator",
    summary:
      "Rank 1-3 policies/checkpoints on one captured real-site task pack before field time.",
    includes: [
      "100 or 500 WAM-eval episodes",
      "Unit: 1 site package, 1 task pack, 1 robot embodiment, 1-3 policies/checkpoints",
      "Predicted success, policy ranking, failure taxonomy, and per-scenario metrics",
      "OOD/uncertainty flags, generated rollout clips, and recommended real-world validation targets",
    ],
  },
  {
    id: "validated-evaluation",
    step: "Validated evaluation",
    name: "Validated Evaluation Pack",
    internalName: "Paired Real Robot Validation",
    price: "Scoped",
    unit: "after evaluation",
    payer: "Robot team / OEM / integrator",
    summary:
      "Add paired real robot rollouts and quantitative validity reporting for the validated envelope only.",
    includes: [
      "Paired real robot rollouts",
      "Pearson/Spearman/SRCC or rank-fidelity",
      "MAE, confidence bounds, validity envelope, and failure-mode agreement",
      "Reports validity only for the validated robot/task/site envelope",
    ],
  },
  {
    id: "site-operator",
    step: "Operator side",
    name: "Site Operators",
    internalName: "Participation",
    price: "Free",
    unit: "submit and govern sites",
    payer: "Site operator / facility owner",
    summary: "Submit a facility, define access boundaries, and review buyer-use posture without paying Blueprint.",
    includes: [
      "Submit or claim a real facility",
      "Define access windows, privacy boundaries, and restricted areas",
      "Review commercialization posture before robot-team use",
      "No paid plan required for operator participation",
    ],
  },
];

export function getPricingContactInterest(id: SimplePricingOption["id"]): string {
  if (id === "capture") return "capturer-signup";
  if (id === "site-operator") return "site-review";
  if (id === "simulation") return "policy-evaluation-run";
  if (id === "validated-evaluation") return "validated-evaluation-pack";
  return "world-model";
}
