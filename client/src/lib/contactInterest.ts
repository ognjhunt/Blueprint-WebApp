import type { RequestedLane } from "@/types/inbound-request";

export const CANONICAL_CONTACT_INTEREST_BY_LANE: Record<RequestedLane, string> = {
  qualification: "site-qualification",
  deeper_evaluation: "deeper-evaluation",
  managed_tuning: "managed-tuning",
};

const CONTACT_INTEREST_TO_LANE: Record<string, RequestedLane> = {
  "site-qualification": "qualification",
  "deeper-evaluation": "deeper_evaluation",
  "evaluation-run": "deeper_evaluation",
  "adaptation-data-pack": "deeper_evaluation",
  "exclusive-dataset": "deeper_evaluation",
  "private-twin-buyout": "deeper_evaluation",
  enterprise: "deeper_evaluation",
  "egocentric-video": "deeper_evaluation",
  "managed-tuning": "managed_tuning",
  "managed-adaptation": "managed_tuning",
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
