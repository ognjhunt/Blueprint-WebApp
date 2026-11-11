/**
 * The four-conditions screen, after its emails ended (owner decision 2026-11-11),
 * and the storage boundary that keeps its answers.
 *
 * The screen still decides what it gates; it no longer writes to the site. The
 * predicate the inbound workflow keeps stops a model-written draft from
 * starting where the ended email used to go. The round-trip test pins the bug
 * where gate answers were set in memory and dropped on write.
 */
import crypto from "node:crypto";

import { beforeAll, describe, expect, it } from "vitest";

import * as qualificationEmails from "../utils/qualificationEmails";
import { screeningEmailWouldHaveBeenSent } from "../utils/qualificationEmails";
import {
  decryptInboundRequestForAdmin,
  encryptInboundRequestForStorage,
} from "../utils/field-encryption";
import type { SiteTaskTriageSummary } from "../types/inbound-request";
import { triageGateAnswers } from "../../client/src/lib/gateTriage";
import { gateFields } from "../../client/src/data/siteTaskQualification";

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

describe("the screen", () => {
  it("is only reached with a blocker: screening says not now only when a gate blocks", () => {
    // Every gate answered with each of its options in turn, under both capture modes: not_now always carries a blocker.
    for (const captureMode of ["site_visit", "self_capture"] as const) {
      for (const field of gateFields) {
        for (const option of field.options) {
          const answers: Record<string, string> = {};
          for (const other of gateFields) {
            const clear = other.options.find((entry) => entry.verdict === "clear");
            if (clear) answers[other.id] = clear.value;
          }
          answers[field.id] = option.value;
          const result = triageGateAnswers(answers, gateFields, captureMode);
          if (result.disposition === "not_now") expect(result.blockers.length, `${field.id}=${option.value}`).toBeGreaterThan(0);
        }
      }
    }
  });
});


describe("the ended screening emails", () => {
  it("are gone: only the can't-simulate-yet email is still built", () => {
    expect(Object.keys(qualificationEmails).sort()).toEqual(["buildTaskNotYetSupportedEmail", "screeningEmailWouldHaveBeenSent"]);
  });

  it("still say where one would have gone, so no model draft starts in its place", () => {
    expect(screeningEmailWouldHaveBeenSent(triage())).toBe(true);
    expect(screeningEmailWouldHaveBeenSent(triage({ blockers: [] }))).toBe(false);
    expect(screeningEmailWouldHaveBeenSent(triage({ blockers: ["", ""] }))).toBe(false);
    expect(screeningEmailWouldHaveBeenSent(triage({ disposition: "needs_conversation", blockers: [] }))).toBe(true);
    expect(screeningEmailWouldHaveBeenSent(triage({ disposition: "qualified", blockers: [], blocking_field_ids: [] }))).toBe(true);
    expect(screeningEmailWouldHaveBeenSent(null)).toBe(false);
    expect(screeningEmailWouldHaveBeenSent(undefined)).toBe(false);
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
