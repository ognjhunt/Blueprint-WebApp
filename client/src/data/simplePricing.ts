export type SimplePricingOption = {
  id: "capture" | "world-models" | "simulation" | "enterprise";
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
    payer: "Capturers (people with phones or smart glasses)",
    summary: "Walk through any indoor space and get paid. No cost to join -- we pay you.",
    includes: [
      "Sign up free and start capturing immediately",
      "$20-$60 per capture depending on device and quality",
      "Most approved captures land around $40",
      "Quality bonuses for coverage, depth, and multi-pass",
      "10% lifetime referral earnings on invites",
    ],
  },
  {
    id: "world-models",
    step: "Start here",
    name: "World Models",
    internalName: "World Model License",
    price: "$500 - $2,000",
    unit: "per world model",
    payer: "Robot team / OEM / integrator",
    summary: "Buy site-specific world models of real indoor locations.",
    includes: [
      "Site-specific spatial data from real capture",
      "Simulation-ready environment",
      "Hosted access or packaged delivery paths",
      "Filterable by location type, size, and robot compatibility",
    ],
  },
  {
    id: "simulation",
    step: "Next layer",
    name: "Simulation Access",
    internalName: "Hosted Sessions",
    price: "$10 - $30",
    unit: "per session-hour",
    payer: "Robot team / OEM / integrator",
    summary:
      "Run your robot in hosted simulation environments built from real-world captures.",
    includes: [
      "Self-serve hosted simulation sessions",
      "Reset and rerun scenarios",
      "Export rollout datasets and policy comparisons",
      "Subscription tiers for teams with ongoing needs ($5K-$20K/month)",
    ],
  },
  {
    id: "enterprise",
    step: "Full service",
    name: "Blueprint Enterprise",
    internalName: "Enterprise",
    price: "$50,000 - $200,000+",
    unit: "annual contract",
    payer: "Robot team / OEM / enterprise pilot budget",
    summary: "On-demand captures, exclusive access, managed deployment support, and custom work.",
    includes: [
      "On-demand capture requests for specific locations",
      "Exclusive world model access and custom capture specs",
      "Managed evaluation and deployment assistance",
      "Scenario generation, validation, tuning, and licensing",
    ],
  },
];

export function getPricingContactInterest(id: SimplePricingOption["id"]): string {
  if (id === "capture") return "capturer-signup";
  if (id === "enterprise") return "enterprise";
  return "world-models";
}
