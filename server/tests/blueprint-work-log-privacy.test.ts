import { describe, expect, it } from "vitest";
import { privateWorkLogPath } from "../utils/blueprintWorkLogPrivacy";
describe("Blueprint Work request-log privacy", () => {
  it("removes connection handles and all OAuth query parameters", () => {
    expect(privateWorkLogPath("/api/blueprint-work/consent/private-flow?token=secret")).toBe("/api/blueprint-work/consent/[flow]");
    expect(privateWorkLogPath("/api/blueprint-work/oauth/authorize?state=secret&code_challenge=private")).toBe("/api/blueprint-work/oauth/authorize");
    expect(privateWorkLogPath("/app/connect/chatgpt?flow=private")).toBe("/app/connect/chatgpt");
    expect(privateWorkLogPath("/signup/business?invitation=private")).toBe("/signup/business");
    expect(privateWorkLogPath("/api/location-autocomplete?input=private-address")).toBe("/api/location-autocomplete");
    expect(privateWorkLogPath("/api/unrelated?filter=public")).toBe("/api/unrelated?filter=public");
  });

  it("removes every signed ticket from the addresses that carry one", () => {
    const ticket = `expires=1794000000&signature=${"a".repeat(64)}`;
    for (const path of ["/api/website-atlas-preview-views/req-1/walkthrough-req-1/scene.ply",
      "/api/website-atlas-preview-views/req-1/walkthrough-req-1/settings.json",
      "/api/website-atlas-preview-downloads/req-1/walkthrough-req-1",
      "/api/website-destination-pictures/req-1/walkthrough-req-1/place.png",
      "/api/company-media/jobs/req-1/video.mp4",
      "/api/company-media/jobs/req-1/simulation.zip"]) {
      for (const query of [`source=scene&admin=1&${ticket}`, `source=scene&viewer=${"b".repeat(64)}&${ticket}`, ticket])
        expect(privateWorkLogPath(`${path}?${query}`)).toBe(path);
    }
  });
});
