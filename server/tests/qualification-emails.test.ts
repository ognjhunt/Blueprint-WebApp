/**
 * The two replies, and the storage boundary that makes them possible.
 *
 * The email tests pin that the copy is built from the site's own answers rather
 * than generated, and that a site clearing the screen gets no automated reply at
 * all. The round-trip test pins the bug that made all of this dead: gate
 * answers were set in memory and dropped on write, so a retried lead lost them.
 */
import crypto from "node:crypto";

import { beforeAll, describe, expect, it } from "vitest";

import {
  buildLetsTalkEmail,
  buildNotYetEmail,
  buildQualificationEmail,
  CALENDLY_URL,
} from "../utils/qualificationEmails";
import {
  decryptInboundRequestForAdmin,
  encryptInboundRequestForStorage,
} from "../utils/field-encryption";
import type { SiteTaskTriageSummary } from "../types/inbound-request";

function triage(overrides: Partial<SiteTaskTriageSummary> = {}): SiteTaskTriageSummary {
  return {
    disposition: "not_now",
    blocking_field_ids: ["serviceArea"],
    blockers: [
      "Outside Texas — Expansion beyond Texas. Worth telling us anyway — where demand clusters is how that order gets decided.",
    ],
    open_questions: [],
    unanswered_field_ids: [],
    incomplete: false,
    evaluated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("the not-yet reply", () => {
  it("names what would flip the answer, using the site's own blocker string", () => {
    const email = buildNotYetEmail({
      firstName: "Dana Whitfield",
      siteName: "Riverside DC",
      triage: triage(),
    });

    expect(email.variant).toBe("not_yet");
    expect(email.body).toContain("Hi Dana,");
    expect(email.body).toContain("Riverside DC");
    expect(email.body).toContain("Expansion beyond Texas");
    expect(email.body).toContain("not-yet rather than a no");
  });

  it("does not ask a blocked site for a call", () => {
    const email = buildNotYetEmail({ firstName: "Dana", triage: triage() });
    expect(email.body).not.toContain(CALENDLY_URL);
    expect(email.body).toMatch(/No call needed/i);
  });

  it("still reads sensibly when the blocker list is empty", () => {
    const email = buildNotYetEmail({
      firstName: "",
      triage: triage({ blockers: [] }),
    });
    expect(email.body).toContain("Hi there,");
    expect(email.body).toContain("does not hold at the site today");
  });
});

describe("the let's-talk reply", () => {
  const marginal = triage({
    disposition: "needs_conversation",
    blockers: [],
    blocking_field_ids: [],
    open_questions: [
      "How stable is the layout? Small things move, but the layout holds — whether that counts depends on how much moves and how often.",
    ],
  });

  it("carries the agenda and the booking link", () => {
    const email = buildLetsTalkEmail({
      firstName: "Sam",
      siteName: "Line 4",
      triage: marginal,
    });

    expect(email.variant).toBe("lets_talk");
    expect(email.subject).toContain("Line 4");
    expect(email.body).toContain("Small things move");
    expect(email.body).toContain(CALENDLY_URL);
    expect(email.body).toContain("agenda");
  });

  it("mentions blanks when the submission was incomplete", () => {
    const email = buildLetsTalkEmail({
      firstName: "Sam",
      triage: { ...marginal, incomplete: true },
    });
    expect(email.body).toMatch(/left blank/i);
  });

  it("offers the site a way out rather than only a booking link", () => {
    const email = buildLetsTalkEmail({ firstName: "Sam", triage: marginal });
    expect(email.body).toMatch(/save us both the call/i);
  });
});

describe("choosing a reply", () => {
  it("sends nothing automated to a site that clears the screen", () => {
    // A clean screen is not an offer. The next step is a match against robot
    // teams, which is a human's call and often a no.
    expect(
      buildQualificationEmail({
        firstName: "Sam",
        triage: triage({ disposition: "qualified", blockers: [], blocking_field_ids: [] }),
      }),
    ).toBeNull();
  });

  it("sends nothing when there was no screen at all", () => {
    expect(buildQualificationEmail({ firstName: "Sam", triage: null })).toBeNull();
  });

  it("routes each disposition to its own variant", () => {
    expect(buildQualificationEmail({ firstName: "S", triage: triage() })?.variant).toBe(
      "not_yet",
    );
    expect(
      buildQualificationEmail({
        firstName: "S",
        triage: triage({ disposition: "needs_conversation", blockers: [] }),
      })?.variant,
    ).toBe("lets_talk");
  });
});

describe("storage round trip", () => {
  beforeAll(() => {
    process.env.FIELD_ENCRYPTION_MASTER_KEY = crypto
      .randomBytes(32)
      .toString("base64");
  });


  it("keeps the gate answers, spec, prose and footage link across a write", async () => {
    const request = {
      contact: {
        firstName: "Dana",
        lastName: "Whitfield",
        email: "dana@example.com",
        roleTitle: "Ops lead",
        company: "Riverside",
      },
      request: {
        budgetBucket: "Undecided/Unsure" as const,
        requestedLanes: [],
        helpWith: [],
        buyerType: "site_operator" as const,
        siteName: "Riverside DC",
        siteLocation: "Austin, TX",
        taskStatement: "Tote transfer",
        siteTaskGates: { serviceArea: "austin_metro", sceneStability: "stable" },
        siteTaskSpec: { cycleTime: "thirty_to_two_min", lighting: "mixed" },
        taskDescription: "Totes move from the conveyor to a pallet.",
        whatGoesWrong: "Shrink wrap snags about twice a shift.",
        taskVideoUrl: "https://example.com/clip.mp4",
      },
    };

    const stored = await encryptInboundRequestForStorage(request as never);
    const restored = await decryptInboundRequestForAdmin(stored as never);

    // The regression this was written for: these five used to vanish here, and
    // the retry loop then re-read a request with no gate answers on it.
    expect(restored.request.siteTaskGates).toEqual(request.request.siteTaskGates);
    expect(restored.request.siteTaskSpec).toEqual(request.request.siteTaskSpec);
    expect(restored.request.taskDescription).toBe(request.request.taskDescription);
    expect(restored.request.whatGoesWrong).toBe(request.request.whatGoesWrong);
    expect(restored.request.taskVideoUrl).toBe(request.request.taskVideoUrl);
  });

  it("tolerates a legacy row that never had them", async () => {
    const request = {
      contact: {
        firstName: "Old",
        lastName: "Row",
        email: "old@example.com",
        roleTitle: "",
        company: "Legacy",
      },
      request: {
        budgetBucket: "Undecided/Unsure" as const,
        requestedLanes: [],
        helpWith: [],
        buyerType: "site_operator" as const,
        siteName: "Legacy site",
        siteLocation: "Somewhere",
        taskStatement: "Unknown",
      },
    };

    const stored = await encryptInboundRequestForStorage(request as never);
    const restored = await decryptInboundRequestForAdmin(stored as never);

    expect(restored.request.siteTaskGates).toBeNull();
    expect(restored.request.taskVideoUrl).toBeNull();
  });
});

/* ------------------------------------------------- the match branch */

import { buildMatchEmail } from "../utils/qualificationEmails";
import type { MatchSummary, MatchResult } from "../../client/src/lib/robotMatch";

function matchResult(id: string, outcome: MatchResult["outcome"]): MatchResult {
  return {
    robotTeamId: id,
    outcome,
    score: 3,
    scored: 4,
    findings: [],
    ruledOutBy: [],
    unknownHardConstraints: [],
  };
}

function summary(overrides: Partial<MatchSummary> = {}): MatchSummary {
  return {
    matched: [],
    provisional: [],
    ruledOut: [],
    commonBlockers: [],
    ...overrides,
  };
}

describe("the match reply", () => {
  it("counts only confirmed matches, never provisional ones", () => {
    const email = buildMatchEmail({
      firstName: "Dana",
      siteName: "Riverside DC",
      summary: summary({
        matched: [matchResult("a", "matched"), matchResult("b", "matched")],
        provisional: [matchResult("c", "provisional")],
      }),
    });

    expect(email.variant).toBe("match_found");
    expect(email.body).toContain("2 robot teams on our list clear");
    // The provisional team is mentioned as a maybe, never counted as a clear.
    expect(email.body).toMatch(/One further team/i);
    expect(email.body).toContain(CALENDLY_URL);
  });

  it("does not promise an introduction it has not secured", () => {
    const email = buildMatchEmail({
      firstName: "Dana",
      summary: summary({ matched: [matchResult("a", "matched")] }),
    });
    expect(email.body).toMatch(/confirm interest on their side/i);
    expect(email.body).toMatch(/not a recommendation yet/i);
  });

  it("names the constraint that eliminated everyone when nothing matches", () => {
    const email = buildMatchEmail({
      firstName: "Dana",
      siteName: "Riverside DC",
      summary: summary({
        ruledOut: [matchResult("a", "ruled_out"), matchResult("b", "ruled_out")],
        commonBlockers: [{ scaleId: "payload", label: "payload", count: 2 }],
      }),
    });

    expect(email.variant).toBe("no_match_yet");
    expect(email.body).toContain("payload — 2 teams ruled out on this");
    // A no about today's list, not a judgement about the site.
    expect(email.body).toMatch(/statement about today's list, not about your task/i);
    expect(email.body).not.toContain(CALENDLY_URL);
  });

  it("stays silent on a clean screen when no match has been run", () => {
    expect(
      buildQualificationEmail({
        firstName: "Dana",
        triage: triage({ disposition: "qualified", blockers: [], blocking_field_ids: [] }),
      }),
    ).toBeNull();
  });

  it("speaks on a clean screen once a match has been run", () => {
    const email = buildQualificationEmail({
      firstName: "Dana",
      triage: triage({ disposition: "qualified", blockers: [], blocking_field_ids: [] }),
      matches: summary({ matched: [matchResult("a", "matched")] }),
    });
    expect(email?.variant).toBe("match_found");
  });
});
