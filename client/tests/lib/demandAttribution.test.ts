import { describe, expect, it } from "vitest";
import {
  getDemandAttributionFromContext,
  getDemandAttributionFromSearchParams,
  normalizeBuyerChannelSource,
  overlaySelfReportedBuyerChannelSource,
} from "@/lib/demandAttribution";

describe("demand attribution", () => {
  it("normalizes Austin and San Francisco campaign source aliases", () => {
    expect(normalizeBuyerChannelSource("texas-robotics")).toBe("texas_robotics");
    expect(normalizeBuyerChannelSource("BARA")).toBe("bara_matchmaking");
    expect(normalizeBuyerChannelSource("proof-led-event")).toBe("proof_led_event");
  });

  it("parses city and explicit channel source from URL search params", () => {
    const attribution = getDemandAttributionFromSearchParams(
      new URLSearchParams("?city=san-francisco&source=partner-referral"),
    );

    expect(attribution).toEqual({
      demandCity: "san-francisco",
      buyerChannelSource: "partner_referral",
      buyerChannelSourceCaptureMode: "explicit_query",
      buyerChannelSourceRaw: "partner-referral",
      utm: {
        source: null,
        medium: null,
        campaign: null,
        term: null,
        content: null,
      },
    });
  });

  it("lets a self-reported source override a generic URL-level source", () => {
    const base = getDemandAttributionFromSearchParams(
      new URLSearchParams("?city=austin&source=site-worlds"),
    );

    expect(overlaySelfReportedBuyerChannelSource(base, "founder_intro")).toEqual({
      demandCity: "austin",
      buyerChannelSource: "founder_intro",
      buyerChannelSourceCaptureMode: "self_reported",
      buyerChannelSourceRaw: "founder_intro",
      utm: {
        source: null,
        medium: null,
        campaign: null,
        term: null,
        content: null,
      },
    });
  });

  it("falls back to the stored source page URL when explicit context fields are missing", () => {
    const attribution = getDemandAttributionFromContext({
      sourcePageUrl: "https://tryblueprint.io/contact?city=austin&source=texas-robotics",
      utm: {},
    });

    expect(attribution.demandCity).toBe("austin");
    expect(attribution.buyerChannelSource).toBe("texas_robotics");
    expect(attribution.buyerChannelSourceCaptureMode).toBe("explicit_query");
  });
});
