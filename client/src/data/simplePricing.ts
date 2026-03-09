export type SimplePricingOption = {
  id: "evaluation" | "adaptation-data" | "managed-adaptation" | "data-license";
  step: string;
  name: string;
  internalName: string;
  price: string;
  unit: string;
  summary: string;
  includes: string[];
};

export const simplePricingOptions: SimplePricingOption[] = [
  {
    id: "evaluation",
    step: "Start here",
    name: "Test your robot",
    internalName: "Evaluation Run",
    price: "$1,450 - $2,350",
    unit: "per run",
    summary: "Use this when you want one clear answer: is your robot ready for this site?",
    includes: [
      "A scored test in the digital copy of the site",
      "A readiness scorecard with the biggest gaps",
      "A clear next step: ready, close, or not ready yet",
    ],
  },
  {
    id: "adaptation-data",
    step: "Add if needed",
    name: "Get site data",
    internalName: "Adaptation Data Pack",
    price: "$11,500 - $13,500",
    unit: "per pack",
    summary: "Use this when your team will do the training and you need data from this exact site.",
    includes: [
      "Site-specific eval scenes",
      "Training-ready data from this environment",
      "A faster way to improve before a real pilot",
    ],
  },
  {
    id: "managed-adaptation",
    step: "Hands-on help",
    name: "Let us tune it",
    internalName: "Managed Adaptation",
    price: "$15,500 - $22,000",
    unit: "per cycle",
    summary: "Use this when you want Blueprint to handle the tuning work for a supported stack.",
    includes: [
      "Blueprint runs the adaptation work",
      "Offline regression testing before rollout",
      "A recommendation on whether to redeploy",
    ],
  },
  {
    id: "data-license",
    step: "Ongoing rights",
    name: "License the site data",
    internalName: "Data License",
    price: "$45,000 - $68,000",
    unit: "per site / year",
    summary: "Use this when you need continuing rights to use the site data in your own pipeline.",
    includes: [
      "Licensed access to the site data",
      "Good fit for teams training in-house",
      "Annual rights for one site",
    ],
  },
];

export function getPricingContactInterest(id: SimplePricingOption["id"]): string {
  if (id === "adaptation-data") return "adaptation-data-pack";
  if (id === "managed-adaptation") return "managed-adaptation";
  if (id === "data-license") return "data-license";
  return "evaluation-run";
}
