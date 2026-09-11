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

/* ------------------------------- the seed, through the real matcher */

import { matchRobotTeam, summariseMatches } from "../../client/src/lib/robotMatch";
import {
  payloadKgToBand,
  poundsToKg,
} from "../utils/capabilityFigures";

/** Build match candidates the way the seed loader would, quotable fields only. */
function seededCandidates() {
  return robotTeamSeed.map((team) => {
    const capability: Record<string, string | number | null> = {};
    for (const figure of team.figures) {
      if (figure.grade === "inferred") continue; // stripped before matching
      if (figure.unit === "kg") capability[figure.field] = payloadKgToBand(Number(figure.value));
      else if (figure.unit === "lb")
        capability[figure.field] = payloadKgToBand(poundsToKg(Number(figure.value)));
      else if (figure.unit === "metres") capability[figure.field] = Number(figure.value);
      else capability[figure.field] = String(figure.value);
    }
    return {
      id: team.id,
      capability,
      deploymentGeography: null,
      taskFamily: (capability.taskFamily as string) ?? null,
    };
  });
}

describe("the seed through the matcher", () => {
  const site = {
    serviceArea: "austin_metro",
    spec: {
      payloadWeight: "ten_to_twentyfive",
      humanProximity: "shared",
      budgetBand: "fifty_to_250k",
      cycleTime: "thirty_to_two_min",
    },
    taskFamily: null,
  };

  it("returns no confirmed match from research alone", () => {
    const summary = summariseMatches(
      seededCandidates().map((candidate) => matchRobotTeam(site, candidate)),
    );
    // Nothing researched can be counted in an email. A confirmed match needs a
    // team to tell us or Blueprint to measure it.
    expect(summary.matched).toHaveLength(0);
    expect(summary.provisional.length + summary.ruledOut.length).toBe(robotTeamSeed.length);
  });

  it("still rules out a team whose published payload is short", () => {
    // Franka's 3 kg and the UR5e's 5 kg cannot lift a 10-25 kg task, and that is
    // decidable from a published figure even without a geography.
    const results = seededCandidates().map((candidate) => matchRobotTeam(site, candidate));
    const ruledOut = results
      .filter((result) => result.outcome === "ruled_out")
      .map((result) => result.robotTeamId);
    expect(ruledOut).toContain("team-franka-robotics");
    expect(ruledOut).toContain("team-universal-robots-ur5e");
  });

  it("does not rule out a team that simply has not published a payload", () => {
    // Locus Array publishes no load figure. Unknown is not short.
    const array = seededCandidates().find((c) => c.id === "team-locus-array")!;
    expect(matchRobotTeam(site, array).outcome).toBe("provisional");
  });

  it("strips inferred figures before matching", () => {
    // Both UR arms carry an inferred humanProximity. It must not reach the
    // matcher, so proximity reads as unknown rather than as a cleared constraint.
    const ur20 = seededCandidates().find((c) => c.id === "team-universal-robots-ur20")!;
    expect(ur20.capability.humanProximity).toBeUndefined();
    const finding = matchRobotTeam(site, ur20).findings.find(
      (f) => f.scaleId === "humanProximity",
    );
    expect(finding?.comparison).toBe("unknown");
  });
});
