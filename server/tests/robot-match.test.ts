/**
 * The matcher.
 *
 * The property that matters most here is the one an email depends on: a team
 * counted as a match has actually been checked against every hard constraint.
 * An unknown is never a pass, because "three teams clear your payload" must
 * mean three teams clear your payload.
 */
import { describe, expect, it } from "vitest";

import { compareBand, bandScaleById } from "../../client/src/lib/capabilityBands";
import {
  matchRobotTeam,
  rankMatches,
  summariseMatches,
  type RobotCandidate,
  type SiteRequirement,
} from "../../client/src/lib/robotMatch";

/** A site with every spec answered: 10-25kg, shared space, 30s-2min, $50-250K. */
const site: SiteRequirement = {
  serviceArea: "austin_metro",
  spec: {
    payloadWeight: "ten_to_twentyfive",
    humanProximity: "shared",
    budgetBand: "fifty_to_250k",
    cycleTime: "thirty_to_two_min",
    volume: "fifty_to_250",
    successThreshold: "ninetyfive",
    lighting: "mixed",
  },
};

function team(overrides: Partial<RobotCandidate["capability"]> = {}, id = "team-a"): RobotCandidate {
  return {
    id,
    capability: {
      payloadCapacity: "ten_to_twentyfive",
      humanProximity: "shared",
      budgetBand: "fifty_to_250k",
      cycleTime: "thirty_to_two_min",
      dutyCycle: "fifty_to_250",
      demonstratedSuccessRate: "ninetyfive",
      lighting: "mixed",
      ...overrides,
    },
    deploymentGeography: "yes",
    taskFamily: "pick_place",
  };
}

describe("band comparison", () => {
  it("reads at_least scales as capability meeting requirement", () => {
    const payload = bandScaleById.payload;
    expect(compareBand(payload, "ten_to_twentyfive", "over_25kg")).toBe("clears");
    expect(compareBand(payload, "ten_to_twentyfive", "ten_to_twentyfive")).toBe("clears");
    expect(compareBand(payload, "ten_to_twentyfive", "two_to_ten")).toBe("short");
  });

  it("reads at_most scales the other way", () => {
    const cycle = bandScaleById.cycleTime;
    // The site needs 30s-2min; a faster robot clears it, a slower one does not.
    expect(compareBand(cycle, "thirty_to_two_min", "under_30s")).toBe("clears");
    expect(compareBand(cycle, "thirty_to_two_min", "two_to_ten_min")).toBe("short");
  });

  it("treats an explicit non-answer as unknown, not as a pass or a fail", () => {
    const cycle = bandScaleById.cycleTime;
    expect(compareBand(cycle, "thirty_to_two_min", "varies")).toBe("unknown");
    expect(compareBand(cycle, "varies", "under_30s")).toBe("unknown");
    expect(compareBand(bandScaleById.successRate, "ninetyfive", "unsure")).toBe("unknown");
  });

  it("treats a missing or unrecognised value as unknown", () => {
    const payload = bandScaleById.payload;
    expect(compareBand(payload, "ten_to_twentyfive", null)).toBe("unknown");
    expect(compareBand(payload, "ten_to_twentyfive", "nonsense")).toBe("unknown");
  });
});

describe("hard constraints eliminate", () => {
  it("rules out a team that cannot lift the payload", () => {
    const result = matchRobotTeam(site, team({ payloadCapacity: "two_to_ten" }));
    expect(result.outcome).toBe("ruled_out");
    expect(result.ruledOutBy.map((finding) => finding.scaleId)).toContain("payload");
  });

  it("rules out a team not rated for the site's human proximity", () => {
    // People work in the space. A system rated only for isolated operation is
    // not a weaker match — it is a different and much longer safety project.
    const result = matchRobotTeam(site, team({ humanProximity: "isolated" }));
    expect(result.outcome).toBe("ruled_out");
    expect(result.ruledOutBy.map((finding) => finding.scaleId)).toContain("humanProximity");
  });

  it("rules out a team whose deployments start above the site's ceiling", () => {
    const result = matchRobotTeam(site, team({ budgetBand: "over_1m" }));
    expect(result.outcome).toBe("ruled_out");
    expect(result.ruledOutBy.map((finding) => finding.scaleId)).toContain("budget");
  });

  it("rules out a team that says it will not deploy here", () => {
    const candidate = { ...team(), deploymentGeography: "no" };
    const result = matchRobotTeam(site, candidate);
    expect(result.outcome).toBe("ruled_out");
    expect(result.ruledOutBy.map((finding) => finding.scaleId)).toContain("geography");
  });

  it("translates between the two sides' geography vocabularies", () => {
    // The site stores where it is; the robot intake stores whether they would
    // come here. Comparing those with === ruled out every team that said yes,
    // which is the only population that can produce a confirmed match.
    for (const answer of ["yes", "right_opportunity", "size_dependent"]) {
      const result = matchRobotTeam(site, { ...team(), deploymentGeography: answer });
      expect(result.outcome, `robot answered ${answer}`).toBe("matched");
    }
  });

  it("treats an unrecognised geography answer as unknown, not as a yes", () => {
    const result = matchRobotTeam(site, { ...team(), deploymentGeography: "elsewhere" });
    expect(result.outcome).toBe("provisional");
  });

  it("fails closed for a site outside the served metro", () => {
    // Such a site should never reach matching -- its service-area gate blocks
    // first -- so this must not quietly clear if it ever does.
    const outside = { ...site, serviceArea: "outside_texas" };
    expect(matchRobotTeam(outside, team()).outcome).toBe("ruled_out");
  });

  it("names the requirement and the capability so a person can check it", () => {
    const result = matchRobotTeam(site, team({ payloadCapacity: "two_to_ten" }));
    const payload = result.ruledOutBy.find((finding) => finding.scaleId === "payload");
    expect(payload?.required).toBe("ten_to_twentyfive");
    expect(payload?.capability).toBe("two_to_ten");
  });
});

describe("unknown is never a pass", () => {
  it("marks a team provisional when a hard constraint has no figure", () => {
    const result = matchRobotTeam(site, team({ payloadCapacity: null }));
    expect(result.outcome).toBe("provisional");
    expect(result.unknownHardConstraints.map((finding) => finding.scaleId)).toContain("payload");
  });

  it("keeps provisional teams out of the matched count", () => {
    const summary = summariseMatches([
      matchRobotTeam(site, team({}, "known")),
      matchRobotTeam(site, team({ payloadCapacity: null }, "unknown-payload")),
    ]);
    // This is the guarantee the email leans on.
    expect(summary.matched.map((result) => result.robotTeamId)).toEqual(["known"]);
    expect(summary.provisional.map((result) => result.robotTeamId)).toEqual(["unknown-payload"]);
  });

  it("confirms a match only when every hard constraint was compared", () => {
    const result = matchRobotTeam(site, team());
    expect(result.outcome).toBe("matched");
    expect(result.unknownHardConstraints).toHaveLength(0);
  });
});

describe("soft constraints rank rather than eliminate", () => {
  it("keeps a team that is slower than the site would like", () => {
    const result = matchRobotTeam(site, team({ cycleTime: "two_to_ten_min" }));
    expect(result.outcome).toBe("matched");
    expect(result.score).toBeLessThan(matchRobotTeam(site, team()).score);
  });

  it("sorts confirmed matches above provisional ones regardless of score", () => {
    const strongButUnknown = matchRobotTeam(
      site,
      team({ payloadCapacity: null }, "provisional"),
    );
    const weakerButKnown = matchRobotTeam(
      site,
      team({ cycleTime: "over_ten_min", lighting: "consistent" }, "confirmed"),
    );
    const ranked = rankMatches([strongButUnknown, weakerButKnown]);
    // "We checked and it clears" beats "we have no reason to think it does not".
    expect(ranked[0].robotTeamId).toBe("confirmed");
  });

  it("breaks a score tie on how much is actually known", () => {
    const known = matchRobotTeam(site, team({}, "known"));
    const thinner = matchRobotTeam(
      site,
      team({ lighting: null, volume: null, demonstratedSuccessRate: null }, "thinner"),
    );
    const ranked = rankMatches([thinner, known]);
    expect(ranked[0].robotTeamId).toBe("known");
  });
});

describe("summary", () => {
  it("counts what eliminated the most teams, commonest first", () => {
    const summary = summariseMatches([
      matchRobotTeam(site, team({ payloadCapacity: "two_to_ten" }, "a")),
      matchRobotTeam(site, team({ payloadCapacity: "under_2kg" }, "b")),
      matchRobotTeam(site, team({ budgetBand: "over_1m" }, "c")),
    ]);
    expect(summary.matched).toHaveLength(0);
    expect(summary.commonBlockers[0]).toMatchObject({ scaleId: "payload", count: 2 });
    expect(summary.commonBlockers[1]).toMatchObject({ scaleId: "budget", count: 1 });
  });

  it("excludes ruled-out teams from the ranking entirely", () => {
    const summary = summariseMatches([
      matchRobotTeam(site, team({}, "good")),
      matchRobotTeam(site, team({ payloadCapacity: "under_2kg" }, "bad")),
    ]);
    expect(summary.ruledOut.map((result) => result.robotTeamId)).toEqual(["bad"]);
    expect([...summary.matched, ...summary.provisional].map((r) => r.robotTeamId)).toEqual([
      "good",
    ]);
  });
});
