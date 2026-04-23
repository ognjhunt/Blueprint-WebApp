// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runDocs = new Map<string, Record<string, unknown>>();
let autoIdCounter = 0;

function resetState() {
  runDocs.clear();
  autoIdCounter = 0;
}

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => "timestamp",
      },
    },
  },
  dbAdmin: {
    collection(name: string) {
      if (name !== "ad_studio_runs") {
        throw new Error(`Unexpected collection ${name}`);
      }

      return {
        doc(id: string) {
          return {
            async get() {
              return {
                exists: runDocs.has(id),
                data: () => runDocs.get(id),
              };
            },
            async set(payload: Record<string, unknown>, options?: { merge?: boolean }) {
              if (options?.merge) {
                runDocs.set(id, {
                  ...(runDocs.get(id) || {}),
                  ...payload,
                });
                return;
              }

              runDocs.set(id, payload);
            },
          };
        },
        async add(payload: Record<string, unknown>) {
          const id = `ad-studio-run-${++autoIdCounter}`;
          runDocs.set(id, payload);
          return { id };
        },
      };
    },
  },
}));

import { createAdStudioRun } from "../utils/ad-studio";

beforeEach(() => {
  resetState();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ad studio service", () => {
  it("creates an ad studio run with normalized lane, claims, and paused meta placeholders", async () => {
    const result = await createAdStudioRun({
      lane: "capturer",
      audience: " public indoor capturers ",
      cta: " Apply to capture public indoor spaces ",
      budgetCapUsd: 250,
      city: " Atlanta ",
      allowedClaims: [" Illustrative public-indoor scenes are allowed "],
      blockedClaims: [" No fabricated proof claims "],
      aspectRatio: " 9:16 ",
    });

    expect(result.run.id).toBe("ad-studio-run-1");
    expect(result.run.lane).toBe("capturer");
    expect(result.run.audience).toBe("public indoor capturers");
    expect(result.run.status).toBe("draft_requested");
    expect(result.run.claimsLedger).toEqual({
      allowedClaims: ["Illustrative public-indoor scenes are allowed"],
      blockedClaims: ["No fabricated proof claims"],
      evidenceLinks: [],
      reviewDecision: "pending",
      reviewNotes: [],
    });
    expect(result.run.metaDraft).toEqual({
      campaignId: null,
      adSetId: null,
      adId: null,
      status: "not_created",
    });

    expect(runDocs.get("ad-studio-run-1")).toMatchObject({
      lane: "capturer",
      audience: "public indoor capturers",
      cta: "Apply to capture public indoor spaces",
      city: "Atlanta",
      aspect_ratio: "9:16",
      status: "draft_requested",
    });
  });

  it("rejects runs missing the brief contract", async () => {
    await expect(
      createAdStudioRun({
        lane: "capturer",
        audience: "",
        cta: "",
        budgetCapUsd: 0,
        city: null,
        allowedClaims: [],
        blockedClaims: [],
        aspectRatio: "",
      }),
    ).rejects.toThrow(
      "Ad Studio run requires audience, CTA, budget cap, aspect ratio, and claim boundaries.",
    );
  });
});
