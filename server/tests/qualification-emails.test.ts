/**
 * The two replies, and the storage boundary that makes them possible.
 *
 * The email tests pin that the copy is built from the site's own answers rather
 * than generated, and that a site clearing the screen hears its next step and
 * what follows, never a count of teams. The round-trip test pins the bug that
 * made all of this dead: gate answers were set in memory and dropped on write,
 * so a retried lead lost them.
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
    // A blank name greets plainly, never with a placeholder.
    expect(email.body.startsWith("Hi,\n")).toBe(true);
    expect(email.body).not.toContain("Hi there");
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
  it("tells a site that clears the screen its next step, not who might evaluate it", () => {
    const email = buildQualificationEmail({
      firstName: "Sam",
      triage: triage({ disposition: "qualified", blockers: [], blocking_field_ids: [] }),
    });
    expect(email?.variant).toBe("qualified");
    expect(email?.body).toMatch(/You choose the delivery partner/);
    expect(email?.body).not.toMatch(/\bmatch|\bteams? on our list|budget/i);
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
    expect(
      buildQualificationEmail({
        firstName: "S",
        triage: triage({ disposition: "qualified", blockers: [], blocking_field_ids: [] }),
      })?.variant,
    ).toBe("qualified");
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

/* --------------------------------------------- the qualified branch */

import { buildQualifiedEmail } from "../utils/qualificationEmails";

describe("the qualified reply", () => {
  it("names the upload link, the evaluated recommendation and the free beta", () => {
    const email = buildQualifiedEmail({
      firstName: "Dana Whitfield",
      siteName: "Riverside DC",
      stage: "brief_confirmed",
      nextStep: { kind: "self_capture", uploadUrl: "https://example.test/capture-upload/abc" },
    });

    expect(email.variant).toBe("qualified");
    expect(email.subject).toBe("Riverside DC: your job brief is confirmed");
    expect(email.body.startsWith("Hi Dana,\n")).toBe(true);
    expect(email.body).toContain("Thanks for confirming the job brief for Riverside DC");
    expect(email.body).toContain("upload it here: https://example.test/capture-upload/abc");
    expect(email.body).toMatch(/reconstruct the work area and evaluate compatible robots and policies in simulation/);
    expect(email.body).toMatch(/review proposals covering scope, total cost, timing and support/);
    expect(email.body).toMatch(/You choose the delivery partner/);
    expect(email.body).toMatch(/If no suitable option is supported, we explain what is missing/);
    expect(email.body).toMatch(/free during the beta/);
    expect(email.body).toMatch(/not proof of how a robot will perform/);
    expect(email.body).not.toContain(CALENDLY_URL);
  });

  it("never counts teams, names a budget, or uses match wording", () => {
    for (const stage of ["brief_confirmed", "screened"] as const) {
      for (const nextStep of [
        { kind: "self_capture", uploadUrl: "https://example.test/capture-upload/abc" },
        { kind: "capturer_visit", taskUrl: "https://example.test/capture-upload/abc" },
        { kind: "capturer_visit" },
        { kind: "held" },
        undefined,
      ] as const) {
        const email = buildQualifiedEmail({ firstName: "Dana", siteName: "Riverside DC", stage, nextStep });
        const text = `${email.subject}\n${email.body}`;
        expect(text).not.toMatch(/\bmatch(?:es|ed|ing)?\b/i);
        // "That one team" is the recommendation; a count of registry teams is not.
        expect(text).not.toMatch(/\b(?:\d+|two|three|four|five|several|further) (?:further )?(?:robot )?teams\b/i);
        expect(text).not.toMatch(/\bteams? on our list\b/i);
        expect(text).not.toMatch(/budget/i);
        expect(text).not.toMatch(/Austin/);
      }
    }
  });

  it("answers a visit request with a reply about the site's location, not a city", () => {
    const email = buildQualifiedEmail({
      firstName: "Dana",
      nextStep: { kind: "capturer_visit", taskUrl: "https://example.test/capture-upload/abc" },
    });
    expect(email.body).toMatch(/whether a visit is possible for your location/);
    expect(email.body).toContain("https://example.test/capture-upload/abc");
    expect(email.body).not.toMatch(/visit date/i);
  });

  it("asks for the account step only when the site has none", () => {
    const step = { kind: "self_capture", uploadUrl: "https://example.test/capture-upload/abc" } as const;
    expect(buildQualifiedEmail({ firstName: "Dana", nextStep: step, accountNeeded: true }).body)
      .toMatch(/create and verify your site account/);
    expect(buildQualifiedEmail({ firstName: "Dana", nextStep: step }).body)
      .not.toMatch(/site account/);
  });

  it("keeps private assessment separate from permission to share a job with providers", () => {
    const step = { kind: "self_capture", uploadUrl: "https://example.test/capture-upload/abc" } as const;
    const body = buildQualificationEmail({ firstName: "Dana", stage: "brief_confirmed", nextStep: step, jobCardPublished: false,
      triage: triage({ disposition: "qualified", blockers: [], blocking_field_ids: [] }) })!.body;
    expect(body).toMatch(/Video is required before the site assessment/);
    expect(body).toMatch(/partners cannot discover it through the shared library/);
    expect(body).toMatch(/We ask before sharing details with a provider/);
    expect(body).toMatch(/publish its card from your job page/);
    expect(body).not.toMatch(/We prepare a simplified simulation|book the pilot in one step/);
  });

  it("speaks for an intake-time screen as well as a confirmed brief", () => {
    const email = buildQualificationEmail({
      firstName: "Dana",
      siteName: "Riverside DC",
      stage: "screened",
      triage: triage({ disposition: "qualified", blockers: [], blocking_field_ids: [] }),
    });
    expect(email?.subject).toBe("Riverside DC: your job cleared our screen");
    expect(email?.body).toContain("Thanks for describing the job at Riverside DC");
  });
});
