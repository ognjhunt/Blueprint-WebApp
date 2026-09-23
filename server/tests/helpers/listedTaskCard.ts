/**
 * The task card a site approved, as it is stored on the request. Robot teams
 * see (and plan against) only sites that carry one.
 */
export function listedTaskCard(title = "Move totes between two stations") {
  return {
    enabled: true,
    consentVersion: "public-task-card-v1",
    approvedAtIso: "2026-09-19T00:00:00.000Z",
    approvedBy: "signed_owner_link",
    details: {
      title,
      taskFamily: "Pick and place",
      siteType: "Warehouse",
      region: "US",
      objects: "Totes",
      cycleTarget: "",
      pilotTiming: "",
      pilotBudget: "",
      opportunity: "open" as const,
    },
  };
}
