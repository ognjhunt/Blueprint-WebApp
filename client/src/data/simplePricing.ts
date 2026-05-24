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
    step: "Start here",
    name: "World Models",
    internalName: "World Model License",
    price: "$2,100 - $3,400",
    unit: "per world model",
    payer: "Robot team / OEM / integrator",
    summary: "Buy site-specific world models of real indoor locations.",
    includes: [
      "Site-specific spatial data from real capture",
      "Scene package tied to one exact site and workflow",
      "Hosted access or packaged delivery paths",
      "Exports, hosted-review notes, and stated limitations for that listing",
    ],
  },
  {
    id: "simulation",
    step: "Next layer",
    name: "Simulation Access",
    internalName: "Hosted Sessions",
    price: "$16 - $29",
    unit: "per session-hour",
    payer: "Robot team / OEM / integrator",
    summary:
      "Run your robot in hosted simulation environments built from real-world captures.",
    includes: [
      "Self-serve hosted simulation sessions",
      "Reset and rerun scenarios",
      "Export rollout datasets and policy comparisons",
      "Managed or priority support when a run needs more help",
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
