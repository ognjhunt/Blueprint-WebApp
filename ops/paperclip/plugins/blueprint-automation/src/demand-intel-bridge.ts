import type { FirehoseConfig } from "./marketing-integrations.js";

export type DemandIntelBridgeAssessment = {
  ok: boolean;
  bridgeState: "not-required" | "live" | "missing";
  scopeLine?: string;
  failureReason?: string;
};

export function assessDemandIntelBridgeReadiness(
  lane: string,
  firehoseConfig: FirehoseConfig | null,
): DemandIntelBridgeAssessment {
  if (lane !== "city-demand") {
    return {
      ok: true,
      bridgeState: "not-required",
    };
  }

  if (!firehoseConfig) {
    return {
      ok: false,
      bridgeState: "missing",
      scopeLine: "Firehose bridge: missing",
      failureReason:
        "City-demand demand intel requires the Firehose bridge. Restore firehoseBaseUrl and FIREHOSE_API_TOKEN, or replace the bridge with another verified source path before publishing city-level demand claims.",
    };
  }

  return {
    ok: true,
    bridgeState: "live",
    scopeLine: `Firehose bridge: live (${firehoseConfig.baseUrl})`,
  };
}
