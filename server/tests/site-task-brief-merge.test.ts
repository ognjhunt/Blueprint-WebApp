// @vitest-environment node
/**
 * Evidence arriving after the brief was drafted.
 *
 * The brief was drafted once, at submit, from whatever the operator typed, and
 * nothing later could improve it -- so the model read of the description and
 * the footage observations had nowhere to land. Merging is where they land,
 * and these pin the rules: a stronger basis replaces a weaker one, a weaker
 * one never replaces a stronger one, an assumption is stored but stays a
 * question, and a brief the operator has already confirmed is never touched.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sharedFakeFirestore, sharedFakeFirestoreState } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return {
    default: {
      firestore: {
        FieldValue: {
          serverTimestamp: () => "SERVER_TIMESTAMP",
          delete: () => FAKE_FIELD_DELETE,
        },
      },
    },
    dbAdmin: sharedFakeFirestore,
  };
});

vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { draftBrief, saveBrief, getBrief, mergeBriefProposals, mergeProposals, confirmBrief } =
  await import("../utils/siteTaskBrief");

const REQUEST = "req-1";

const intakeStability = {
  fieldId: "sceneStability",
  value: "stable",
  basis: "description" as const,
  reading: "From what you told us at intake.",
};
const footageStability = {
  fieldId: "sceneStability",
  value: "rearranged",
  basis: "observation" as const,
  reading: "Pallet positions moved between 0:10 and 0:40.",
};
const guessedShape = {
  fieldId: "taskShape",
  value: "single",
  basis: "assumption" as const,
  reading: "Reads like one job, but the description does not say.",
};

beforeEach(() => {
  sharedFakeFirestoreState.docs.clear();
});

describe("mergeProposals", () => {
  it("lets a stronger basis replace a weaker one", () => {
    const merged = mergeProposals([intakeStability], [footageStability]);
    expect(merged).toEqual([footageStability]);
  });

  it("never lets a weaker basis replace a stronger one", () => {
    const merged = mergeProposals([footageStability], [intakeStability]);
    expect(merged).toEqual([footageStability]);
  });

  it("keeps what is there on a tie", () => {
    const later = { ...intakeStability, value: "rearranged", reading: "A later read." };
    expect(mergeProposals([intakeStability], [later])).toEqual([intakeStability]);
  });

  it("adds fields it did not have", () => {
    expect(mergeProposals([intakeStability], [guessedShape])).toEqual([intakeStability, guessedShape]);
  });
});

describe("mergeBriefProposals", () => {
  it("folds new evidence into the stored brief and recomputes what is unresolved", async () => {
    await saveBrief(
      draftBrief({ requestId: REQUEST, summary: "Move cartons", captureMode: "self_capture", proposed: [intakeStability] }),
    );

    const merged = await mergeBriefProposals({ requestId: REQUEST, proposals: [footageStability, guessedShape] });

    expect(merged).not.toBeNull();
    const stored = await getBrief(REQUEST);
    const stability = stored!.proposed.find((answer) => answer.fieldId === "sceneStability");
    expect(stability?.basis).toBe("observation");
    expect(stability?.value).toBe("rearranged");
    // The assumption is on file as a question, not as an answer.
    expect(stored!.proposed.find((answer) => answer.fieldId === "taskShape")?.basis).toBe("assumption");
    expect(stored!.unresolved).toContain("taskShape");
    expect(stored!.unresolved).not.toContain("sceneStability");
    expect(stored!.draftedFrom).toEqual(expect.arrayContaining(["description", "observation", "assumption"]));
  });

  it("preserves the operator-authored summary while merging later evidence", async () => {
    await saveBrief(draftBrief({ requestId: REQUEST, summary: "Move cartons", captureMode: "self_capture", proposed: [] }));
    await mergeBriefProposals({ requestId: REQUEST, proposals: [intakeStability] });
    expect((await getBrief(REQUEST))!.summary).toBe("Move cartons");
  });

  it("never touches a brief the operator has confirmed", async () => {
    await saveBrief(
      draftBrief({ requestId: REQUEST, summary: "Move cartons", captureMode: "self_capture", proposed: [intakeStability] }),
    );
    await confirmBrief({ requestId: REQUEST, confirmedBy: "Dana" });

    const merged = await mergeBriefProposals({ requestId: REQUEST, proposals: [footageStability] });

    expect(merged).toBeNull();
    const stored = await getBrief(REQUEST);
    expect(stored!.proposed.find((answer) => answer.fieldId === "sceneStability")?.value).toBe("stable");
    expect(stored!.confirmedBy).toBe("Dana");
  });

  it("preserves a confirmation that wins a transaction race", async () => {
    await saveBrief(
      draftBrief({ requestId: REQUEST, summary: "Move cartons", captureMode: "self_capture", proposed: [intakeStability] }),
    );
    const originalRunTransaction = sharedFakeFirestore.runTransaction;
    const unconfirmed = { ...(await getBrief(REQUEST))! };
    const transaction = vi.spyOn(sharedFakeFirestore, "runTransaction").mockImplementationOnce(async (updateFn: any) => {
      // First attempt read the old draft, but Firestore detected a conflicting
      // confirmation before commit and retried the callback.
      await updateFn({
        get: async () => ({ exists: true, data: () => unconfirmed }),
        set: () => undefined,
      });
      await confirmBrief({ requestId: REQUEST, confirmedBy: "Dana" });
      return originalRunTransaction(updateFn);
    });

    const merged = await mergeBriefProposals({ requestId: REQUEST, proposals: [footageStability] });
    transaction.mockRestore();

    expect(merged).toBeNull();
    const stored = await getBrief(REQUEST);
    expect(stored!.confirmedBy).toBe("Dana");
    expect(stored!.proposed.find((answer) => answer.fieldId === "sceneStability")?.value).toBe("stable");
  });

  it("retries against concurrently merged stronger evidence", async () => {
    await saveBrief(
      draftBrief({ requestId: REQUEST, summary: "Move cartons", captureMode: "self_capture", proposed: [] }),
    );
    const originalRunTransaction = sharedFakeFirestore.runTransaction;
    const initial = { ...(await getBrief(REQUEST))! };
    const transaction = vi.spyOn(sharedFakeFirestore, "runTransaction").mockImplementationOnce(async (updateFn: any) => {
      await updateFn({
        get: async () => ({ exists: true, data: () => initial }),
        set: () => undefined,
      });
      sharedFakeFirestoreState.docs.set("siteTaskBriefs/req-1", {
        ...initial,
        proposed: [footageStability],
        unresolved: initial.unresolved.filter((fieldId) => fieldId !== "sceneStability"),
        draftedFrom: ["observation"],
      });
      return originalRunTransaction(updateFn);
    });

    await mergeBriefProposals({ requestId: REQUEST, proposals: [intakeStability] });
    transaction.mockRestore();

    const stored = await getBrief(REQUEST);
    expect(stored!.proposed.find((answer) => answer.fieldId === "sceneStability")).toEqual(footageStability);
  });

  it("returns null when there is no brief to merge into", async () => {
    expect(await mergeBriefProposals({ requestId: "req-none", proposals: [footageStability] })).toBeNull();
  });
});
