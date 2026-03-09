export type SimplePricingOption = {
  id: "evaluation" | "adaptation-data" | "managed-adaptation";
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
    step: "After qualification",
    name: "Evaluation",
    internalName: "Evaluation Run",
    price: "$1,450 - $2,350",
    unit: "per run",
    summary: "Use this when a qualified site is ready for a team check.",
    includes: [
      "A scored check on the qualified site",
      "A short scorecard with the main gaps",
      "A clear next step for the team",
    ],
  },
  {
    id: "adaptation-data",
    step: "If needed",
    name: "Site data",
    internalName: "Adaptation Data Pack",
    price: "$11,500 - $13,500",
    unit: "per pack",
    summary: "Use this when the team needs data from the exact site.",
    includes: [
      "Site-specific eval scenes",
      "Training-ready data from the site",
      "A faster path to the next check",
    ],
  },
  {
    id: "managed-adaptation",
    step: "Hands-on help",
    name: "Managed tuning",
    internalName: "Managed Adaptation",
    price: "$15,500 - $22,000",
    unit: "per cycle",
    summary: "Use this when you want Blueprint to handle the tuning work on a supported stack.",
    includes: [
      "Blueprint runs the tuning work",
      "Offline regression testing before rollout",
      "A recommendation on whether to redeploy",
    ],
  },
];

export function getPricingContactInterest(id: SimplePricingOption["id"]): string {
  if (id === "adaptation-data") return "adaptation-data-pack";
  if (id === "managed-adaptation") return "managed-adaptation";
  return "evaluation-run";
}
