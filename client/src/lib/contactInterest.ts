import type { RequestedLane } from "@/types/inbound-request";
import {
  CANONICAL_CONTACT_INTEREST_BY_LANE as SHARED_CANONICAL_CONTACT_INTEREST_BY_LANE,
  CONTACT_INTEREST_TO_LANE,
} from "@/lib/requestTaxonomy";

export const CANONICAL_CONTACT_INTEREST_BY_LANE = SHARED_CANONICAL_CONTACT_INTEREST_BY_LANE;

export function normalizeInterestToLane(
  interest: string | null | undefined,
): RequestedLane | null {
  if (!interest) {
    return null;
  }

  const normalizedInterest = interest.trim().toLowerCase();
  return (CONTACT_INTEREST_TO_LANE[normalizedInterest as keyof typeof CONTACT_INTEREST_TO_LANE] ??
    null) as RequestedLane | null;
}
