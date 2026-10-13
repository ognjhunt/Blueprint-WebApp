import { describe, expect, it } from "vitest";

import { betaCohortGuides, betaSupportEmail } from "@/lib/betaCohortGuides";

const requiredTopics = [
  "Cohort scope",
  "Support escalation",
];

describe("beta cohort guides", () => {
  it("publishes only the robot-team guide; the capturer guide is retired", () => {
    expect(betaCohortGuides.map((guide) => guide.path)).toEqual(["/beta/buyer-guide"]);
  });

  it("describes the free, invited, evaluated-recommendation beta", () => {
    const text = JSON.stringify(betaCohortGuides);
    expect(text).toMatch(/join by invitation/);
    expect(text).toMatch(/no entry fee, balance, top-up or checkout/);
    expect(text).toMatch(/recommends one team whose evaluation passed/);
    expect(text).toMatch(/not proof of physical performance or safety/);
    expect(text).not.toMatch(/\bmatch(?:ed|es|ing)?\b|marketplace|\$\d|payout|entitlement/i);
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
