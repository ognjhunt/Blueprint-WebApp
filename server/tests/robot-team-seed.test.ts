/**
 * The seed file's own discipline, enforced.
 *
 * These are real companies that have agreed to nothing. CLAUDE.md is explicit
 * that a third party cited as evidence is never implied to be a Blueprint
 * customer, and that a public figure without a source does not ship. A comment
 * saying so is a hope; this is the check.
 */
import { describe, expect, it } from "vitest";

import { robotTeamSeed } from "../data/robotTeamSeed";

describe("seeded prospects", () => {
  it("ships at least one of several embodiments so a match sees more than one shape", () => {
    const embodiments = new Set(
      robotTeamSeed
        .flatMap((team) => team.figures)
        .filter((figure) => figure.field === "embodiment")
        .map((figure) => String(figure.value)),
    );
    expect(embodiments.size).toBeGreaterThanOrEqual(3);
  });

  it("gives every figure a source and its own words", () => {
    for (const team of robotTeamSeed) {
      for (const figure of team.figures) {
        expect(figure.sourceUrl, `${team.name}/${figure.field}`).toMatch(/^https:\/\//);
        expect(figure.quote.trim().length, `${team.name}/${figure.field}`).toBeGreaterThan(0);
      }
    }
  });

  it("never claims a deployment geography for a company that has not told us", () => {
    // This is what keeps every seeded team provisional rather than matched.
    // Research can say what a robot lifts; it cannot say a company will deploy
    // at our site on our terms.
    for (const team of robotTeamSeed) {
      const geography = team.figures.find((figure) => figure.field === "deploymentGeography");
      expect(geography, `${team.name} must not claim a deployment geography`).toBeUndefined();
    }
  });

  it("never claims a measured or self-reported figure from public research", () => {
    // measured means Blueprint ran it. self_reported means the team told us.
    // Neither can come from reading a web page.
    for (const team of robotTeamSeed) {
      for (const figure of team.figures) {
        expect(["published", "inferred"], `${team.name}/${figure.field}`).toContain(
          figure.grade,
        );
      }
    }
  });

  it("uses unique ids", () => {
    const ids = robotTeamSeed.map((team) => team.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
