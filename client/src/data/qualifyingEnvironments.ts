/**
 * The qualifying-environment standard.
 *
 * Everything else on this site argues that deployment is the bottleneck. This
 * file says something narrower and more useful: deployments that work share a
 * recognisable shape, and that shape can be tested for before anyone travels.
 *
 * Two things are kept strictly apart here, because collapsing them would be the
 * easiest way to oversell this.
 *
 *   1. The four conditions are **Blueprint's screening criteria**. They are a
 *      specification of what we test, not a discovered law of robotics, and
 *      they carry no evidence grade because they are not a claim about the
 *      world — they are our own standard, and we are accountable for them.
 *
 *   2. The environments are **other companies' deployments**, cited to name
 *      operators and sites that are documented in mainstream coverage. None of
 *      them is a Blueprint customer, none was prepared by Blueprint, and the
 *      site never implies otherwise. They are here as evidence that the
 *      conditions describe something real.
 *
 * On the convergence claim. Retail pharmacy is listed as reached independently
 * by more than one team because that is what the record supports: Galbot's
 * pharmacy fleet is documented in mainstream coverage at roughly a hundred
 * stores, and other teams have shown pharmacy work of their own. The claim is
 * about the environment being independently attractive, not about any one
 * company's store count, and it is deliberately not stated as a headcount.
 *
 * On what is excluded. Aggregate national shipment totals circulating from this
 * year's conference reporting are not used anywhere in this file. The
 * underlying report is not public, carries no definition of "humanoid", and
 * gives no split between wheeled and bipedal machines — it does not clear the
 * bar the rest of the site's figures clear, so it is not charted.
 */

import type { EvidenceBasis, MarketSource } from "./deploymentMarket";

/* ------------------------------------------------------------- the gates */

export interface QualifyingCondition {
  id: string;
  /** Short name, used as a matrix column header. */
  name: string;
  /** The question Blueprint actually asks about the site. */
  test: string;
  /** What goes wrong when the condition does not hold. */
  failure: string;
}

/**
 * Four gates, in the order they are cheapest to check. A site that fails any
 * one of them is not disqualified forever — it is disqualified until that
 * condition is engineered into place, which is itself a piece of work someone
 * can decide to fund.
 */
export const qualifyingConditions: readonly QualifyingCondition[] = [
  {
    id: "fixed-scene",
    name: "Fixed scene",
    test: "Does the work area stay put between shifts?",
    failure:
      "A layout that changes faster than the model of it means every re-map is a new deployment.",
  },
  {
    id: "bounded-task",
    name: "Bounded task",
    test: "Is this one repeated job rather than a category of jobs?",
    failure:
      "When the exceptions become most of the cycles, the acceptance test stops describing the work.",
  },
  {
    id: "known-objects",
    name: "Known objects",
    test: "Can the things being handled be enumerated in advance?",
    failure:
      "The long tail nobody listed is where grasp success quietly stops being the number you measured.",
  },
  {
    id: "clear-window",
    name: "Clear window",
    test: "Is there a period when no untrained people are in the space?",
    failure:
      "Safety review that has to cover the general public is a different and much longer project.",
  },
];

export const qualifyingStandard = {
  headline: "Four gates",
  claim:
    "The deployments that are working today are not the ones with the most capable robots. They are the ones where the environment was already arranged so a robot could succeed.",
  consequence:
    "That makes site readiness testable. Blueprint screens for these four before anyone commits an engineer-week, and names which ones a site fails and what it would take to pass.",
  /** The second-order point, and the one buyers under-price. */
  secondOrder:
    "A site that clears all four also lowers the hardware bar. Fixed scenes and enumerable objects are the conditions under which a simple gripper does the job a dexterous hand was quoted for.",
} as const;

/* ------------------------------------------------- where the record says yes */

export type EnvironmentStatus = "documented" | "emerging";

export interface DeployedEnvironment {
  id: string;
  name: string;
  status: EnvironmentStatus;
  /** Condition ids this environment satisfies by its nature. */
  satisfies: readonly string[];
  /** Why it satisfies them, in the words a site lead would use. */
  why: string;
  /** What is on the public record, with operators named. */
  evidence: string;
  sources: readonly MarketSource[];
  basis: EvidenceBasis;
}

export const deployedEnvironments: readonly DeployedEnvironment[] = [
  {
    id: "pharmacy",
    name: "Retail pharmacy",
    status: "documented",
    satisfies: ["fixed-scene", "bounded-task", "known-objects", "clear-window"],
    why: "Fixed shelving, an enumerable SKU list, no safety-critical contact with the public, and a closed overnight store.",
    evidence:
      "Galbot's pharmacy robots are reported in service at roughly a hundred stores across more than ten Chinese cities, locating, picking, and packaging items from shelves. More than one team has shown pharmacy work independently.",
    sources: [
      {
        label: "CGTN: first pharmacy robot in service, Beijing",
        href: "https://news.cgtn.com/news/2026-03-13/China-s-first-pharmacy-robot-goes-into-service-in-Beijing-1LtZ7juLcZ2/p.html",
      },
      {
        label: "Xinhua: mass deployment and China's robot momentum",
        href: "https://english.news.cn/20260824/c3519beae83a47f1900980ceff541d28/c.html",
      },
    ],
    basis: "published",
  },
  {
    id: "parcel-sorting",
    name: "Parcel sorting",
    status: "documented",
    satisfies: ["fixed-scene", "bounded-task", "known-objects", "clear-window"],
    why: "A sorting line does not move, the task is one repeated transfer, parcels fall in a known size and weight band, and the floor runs on shifts.",
    evidence:
      "Robot Era reports sorting robots in more than ten logistics centres operated by China Post and SF Holding across northern, eastern, and southern China.",
    sources: [
      {
        label: "China Daily: humanoid robots move onto fast track",
        href: "https://global.chinadaily.com.cn/a/202606/11/WS6a2ac863a310d6866eb4dcd2.html",
      },
      {
        label: "Interesting Engineering: China Post parcel sorting",
        href: "https://interestingengineering.com/ai-robotics/china-deploys-humanoid-robots-in-postal-hub",
      },
    ],
    basis: "published",
  },
  {
    id: "substation-inspection",
    name: "Substation inspection",
    status: "documented",
    satisfies: ["fixed-scene", "bounded-task", "known-objects", "clear-window"],
    why: "A substation is surveyed infrastructure, the round is the same every time, the instruments being read are fixed, and the site is closed to the public by definition.",
    evidence:
      "State Grid has opened supplier selection for roughly 8,500 robots for inspection and maintenance, the majority of them quadrupeds for patrol and wheeled dual-arm machines, with a much smaller humanoid allocation for live-line work.",
    sources: [
      {
        label: "Interesting Engineering: State Grid 8,500-robot program",
        href: "https://interestingengineering.com/ai-robotics/china-8500-robots-power-grid",
      },
    ],
    basis: "published",
  },
  {
    id: "forward-warehouse",
    name: "Forward warehouse",
    status: "emerging",
    satisfies: ["fixed-scene", "bounded-task", "known-objects"],
    why: "The same four conditions hold, but order mix moves faster than a pharmacy's and the picking window is not reliably empty.",
    evidence:
      "Demonstrated as a full-scale reproduction rather than a running site. The environment class is credible; a specific operating deployment is not yet on the public record.",
    sources: [
      {
        label: "Inside Retail Asia: putting humanoids to work",
        href: "https://insideretail.asia/2026/08/21/how-chinas-robot-makers-are-putting-humanoids-to-work/",
      },
    ],
    basis: "published",
  },
  {
    id: "line-side-packing",
    name: "Line-side packing",
    status: "emerging",
    satisfies: ["fixed-scene", "bounded-task", "known-objects"],
    why: "A fixed station with one product family, inside a plant where the working window is a scheduled shift rather than an empty building.",
    evidence:
      "Reported on an assembly line at a components manufacturer, packing a single product family into cartons.",
    sources: [
      {
        label: "China Daily: humanoid robots move onto fast track",
        href: "https://global.chinadaily.com.cn/a/202606/11/WS6a2ac863a310d6866eb4dcd2.html",
      },
    ],
    basis: "published",
  },
];

/**
 * The convergence, stated as an argument about environments rather than about
 * companies. Independent teams choosing the same scene is the cleanest
 * available signal that the scene — not the robot — is what qualified.
 */
export const convergenceNote = {
  environment: "Retail pharmacy",
  claim:
    "More than one team arrived at the pharmacy independently, which is evidence about the environment rather than about any one company's robot.",
  reason:
    "It is one of the few retail settings that clears all four gates at once: fixed shelving, a bounded SKU list, no safety-critical public contact, and a genuinely empty overnight window.",
} as const;

export const environmentsFootnote =
  "These are third-party deployments cited as evidence about which environments qualify. None is a Blueprint customer and none was prepared by Blueprint.";
