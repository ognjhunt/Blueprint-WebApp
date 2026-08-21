import { describe, expect, it } from "vitest";

import {
  deploymentEconomicsNote,
  deploymentPrepSources,
  publishedOemTimeline,
} from "@/data/deploymentPrep";

describe("deployment preparation public evidence", () => {
  it("keeps Blueprint scoped to the first phase of the published OEM example", () => {
    expect(publishedOemTimeline.map((phase) => phase.time)).toEqual([
      "Months 0–2",
      "Months 2–3",
      "Months 4–6",
      "Month 6+",
    ]);
    expect(publishedOemTimeline.filter((phase) => phase.blueprint)).toEqual([
      expect.objectContaining({ time: "Months 0–2" }),
    ]);
  });

  it("labels the economics as illustrative and links primary sources", () => {
    expect(deploymentEconomicsNote.title).toMatch(/not a market price/i);
    expect(deploymentEconomicsNote.body).toMatch(/illustrative/i);
    expect(deploymentEconomicsNote.body).toMatch(/does not publish/i);
    expect(deploymentPrepSources.timeline.href).toContain("sec.gov");
    expect(deploymentPrepSources.process.href).toContain("agilityrobotics.com");
  });
});
