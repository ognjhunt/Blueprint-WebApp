import type { BuyerType, RequestedLane } from "../types/inbound-request";

export function defaultRequestedLaneForBuyerType(
  buyerType?: BuyerType | null,
): RequestedLane {
  return buyerType === "site_operator" ? "qualification" : "deeper_evaluation";
}

