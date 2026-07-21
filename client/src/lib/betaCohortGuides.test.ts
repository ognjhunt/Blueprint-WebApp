import { describe, expect, it } from "vitest";

import { betaCohortGuides, betaSupportEmail } from "@/lib/betaCohortGuides";

const requiredTopics = [
  "Cohort scope",
  "Support escalation",
];

describe("beta cohort guides", () => {
  it("publishes capturer and buyer guide routes", () => {
    expect(betaCohortGuides.map((guide) => guide.path)).toEqual([
      "/beta/capturer-guide",
      "/beta/buyer-guide",
    ]);
  });

  it("covers scope, expectations, degraded states, and escalation for every persona", () => {
    for (const guide of betaCohortGuides) {
      const sectionTitles = guide.sections.map((section) => section.title);
      for (const topic of requiredTopics) {
        expect(sectionTitles).toContain(topic);
      }
      expect(guide.sections.some((section) => /first|request/i.test(section.title))).toBe(true);
      expect(guide.sections.some((section) => /blocked|review|degraded/i.test(section.title))).toBe(true);
      expect(guide.sections.some((section) => section.items.join(" ").includes(betaSupportEmail))).toBe(true);
      expect(guide.escalation.length).toBeGreaterThanOrEqual(3);
    }
  });
});
