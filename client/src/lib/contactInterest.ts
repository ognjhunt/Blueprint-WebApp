import type { RequestedLane } from "@/types/inbound-request";

export const CANONICAL_CONTACT_INTEREST_BY_LANE: Record<RequestedLane, string> = {
  qualification: "site-qualification",
  preview_simulation: "preview-simulation",
  deeper_evaluation: "deeper-evaluation",
  managed_tuning: "managed-tuning",
  data_licensing: "data-licensing",
};

const CONTACT_INTEREST_TO_LANE: Record<string, RequestedLane> = {
  "site-qualification": "qualification",
  "preview-simulation": "preview_simulation",
  "deeper-evaluation": "deeper_evaluation",
  "evaluation-run": "deeper_evaluation",
  "adaptation-data-pack": "data_licensing",
  "exclusive-dataset": "data_licensing",
  "private-twin-buyout": "preview_simulation",
  enterprise: "deeper_evaluation",
  "egocentric-video": "preview_simulation",
  "managed-tuning": "managed_tuning",
  "managed-adaptation": "managed_tuning",
  "data-licensing": "data_licensing",
};

export function normalizeInterestToLane(
  interest: string | null | undefined,
): RequestedLane | null {
  if (!interest) {
    return null;
  }

  const normalizedInterest = interest.trim().toLowerCase();
  return CONTACT_INTEREST_TO_LANE[normalizedInterest] ?? null;
}
