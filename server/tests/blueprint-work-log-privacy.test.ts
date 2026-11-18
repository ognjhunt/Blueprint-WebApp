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

  it("removes the site's signed job link from every address that carries one in its path", () => {
    const link = `v1.${"c".repeat(40)}.${"d".repeat(43)}`;
    const cases: Array<[string, string]> = [
      [`/api/site-task-brief/${link}`, "/api/site-task-brief/[link]"],
      [`/api/site-task-brief/${link}/status?x=1`, "/api/site-task-brief/[link]/status"],
      [`/api/site-task-brief/${link}/items/item-7`, "/api/site-task-brief/[link]/items/item-7"],
      [`/api/self-capture/uploads/${link}/parts/3`, "/api/self-capture/uploads/[link]/parts/3"],
      [`/api/self-capture/uploads/${link}`, "/api/self-capture/uploads/[link]"],
      [`/api/site-claim/${link}`, "/api/site-claim/[link]"],
      [`/api/job-facts/${link}`, "/api/job-facts/[link]"],
      [`/api/job-outcomes/${link}`, "/api/job-outcomes/[link]"],
    ];
    for (const [url, logged] of cases) {
      expect(privateWorkLogPath(url)).toBe(logged);
      expect(privateWorkLogPath(url)).not.toContain(link);
    }
    expect(privateWorkLogPath("/api/site-task-brief-other/x")).toBe("/api/site-task-brief-other/x");
  });
});
