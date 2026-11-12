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

/**
 * A site job shared under the current rule (2026-11-12): recording statement v4 granted, the listing record
 * `job-shared-2026-11-12`, and the video past the privacy screen. Merge it into a job record.
 */
export function sharedJobFields(record: { request?: Record<string, unknown> } = {}, atIso = "2026-11-12T10:00:00.000Z") {
  return {
    request: { buyerType: "site_operator", ...(record.request ?? {}),
      consent_attestation: { granted: true, statement_version: "2026-11-12.v4", recorded_at_iso: atIso } },
    public_task_listing: { enabled: true, consentVersion: "job-shared-2026-11-12", approvedAtIso: atIso, wentLiveIso: atIso,
      approvedBy: "recording_statement", details: listedTaskCard().details, thumbnailDigest: null, reviewRequired: false },
    capture_privacy_screen: { proceeded: true, eligibility: "eligible" },
  };
}
