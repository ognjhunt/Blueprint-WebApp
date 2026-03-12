export type SimplePricingOption = {
  id: "readiness-pack" | "qualified-opportunity" | "technical-evaluation" | "deployment-prep";
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
    id: "readiness-pack",
    step: "Start here",
    name: "Readiness Pack",
    internalName: "Qualification",
    price: "$1,500 - $4,000",
    unit: "per site or workflow",
    payer: "Site operator",
    summary: "The default product. Start with the site, the task, and a clear readiness report.",
    includes: [
      "Site intake and workflow scoping",
      "Capture request or captured evidence review",
      "Qualification report with ready, risky, or not-ready call",
      "Handoff-ready brief for later team review",
    ],
  },
  {
    id: "qualified-opportunity",
    step: "Next layer",
    name: "Qualified Opportunity",
    internalName: "Exchange Access",
    price: "$2,000 - $10,000",
    unit: "per brief or subscription access",
    payer: "Robot team / OEM / integrator",
    summary: "Pay to review qualified site briefs instead of chasing cold leads.",
    includes: [
      "Access to scoped site briefs",
      "Task and constraint summary",
      "Readiness pack and handoff review",
      "A cleaner path into deeper evaluation",
    ],
  },
  {
    id: "technical-evaluation",
    step: "When both sides are serious",
    name: "Evaluation Package",
    internalName: "Evaluation Package",
    price: "$7,500 - $20,000",
    unit: "per site",
    payer: "Robot team / OEM / integrator",
    summary:
      "Managed technical diligence for a specific robot, team, and site after self-serve hosted evals have narrowed the question.",
    includes: [
      "Priority or higher-touch hosted evaluation support when justified",
      "Preview or simulation-backed review when the workflow needs it",
      "Robot/team-specific fit checks",
      "Stronger blocker and feasibility analysis",
      "Decision on whether to proceed to deployment prep",
    ],
  },
  {
    id: "deployment-prep",
    step: "Highest-touch lane",
    name: "Deployment Prep / Managed Tuning",
    internalName: "Managed Tuning",
    price: "$20,000 - $100,000+",
    unit: "scoped engagement",
    payer: "Robot team / OEM / enterprise pilot budget",
    summary: "Use this when the site is real, the stack is known, and the team wants Blueprint to do the heavy lifting.",
    includes: [
      "Scenario generation or validation package",
      "Managed tuning on supported stacks",
      "Offline evaluation gates before redeploy",
      "Licensing, data, or private terms when needed",
    ],
  },
];

export function getPricingContactInterest(id: SimplePricingOption["id"]): string {
  if (id === "readiness-pack") return "site-qualification";
  if (id === "deployment-prep") return "managed-tuning";
  return "evaluation-package";
}
