// @vitest-environment node
/**
 * Restoring a brief a model reading moved after the job's scene grant.
 *
 * capture-447ae4f4 (2026-11-02): a late description reading closed one open
 * site question on a paid job's unconfirmed brief; the grant no longer
 * verified and the job was revoked. Restoring removes only model-read
 * proposals, only when one smallest removal reproduces the grant exactly.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return {
    default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore,
  };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const { draftBrief, saveBrief, getBrief, unresolvedGates } = await import("../utils/siteTaskBrief");
const { planGrantedBriefRestore, restoreGrantedBrief } = await import("../utils/grantedBriefRestore");
const { projectWebsiteTaskContext } = await import("../utils/websiteTaskContext");
const { projectWebsiteCaptureRights } = await import("../utils/websiteCaptureRights");

const REQUEST = "req-restore";
const inferred = { fieldId: "objectVariety", value: "single", basis: "description" as const,
  reading: "From what you told us at intake." };
const guessed = { fieldId: "taskShape", value: "single", basis: "assumption" as const,
  reading: "Reads like one job, but the description does not say." };
const measured = { fieldId: "sceneStability", value: "stable", basis: "measurement" as const,
  reading: "A figure you gave us." };

async function granted(proposedAtGrant: typeof inferred[] = []) {
  const brief = draftBrief({ requestId: REQUEST, captureMode: "self_capture", proposed: proposedAtGrant,
    summary: "Pick up the wooden tray and place it at the other end of the table" });
  await saveBrief(brief);
  const record: Record<string, any> = {};
  const digest = projectWebsiteTaskContext((await getBrief(REQUEST))!, projectWebsiteCaptureRights(record),
    { inventory: null, purpose: "scene_preparation" }).context_digest;
  const grant = { purpose: "scene_preparation", authority_digest: `sha256:${"a".repeat(64)}`, task_context_digest: digest };
  sharedFakeFirestoreState.docs.set(`inboundRequests/${REQUEST}`, { website_scene_sponsorship: grant });
  return { grant, granted: (await getBrief(REQUEST))! };
}

async function readingMerged(rows: (typeof inferred)[]) {
  const brief = (await getBrief(REQUEST))!;
  const proposed = [...brief.proposed, ...rows];
  await saveBrief({ ...brief, proposed, unresolved: unresolvedGates(brief.captureMode, proposed) });
}

beforeEach(() => sharedFakeFirestoreState.docs.clear());

describe("restoring a brief to its granted task", () => {
  it("removes exactly the model reading that moved the task and keeps it for review", async () => {
    const { granted: before } = await granted();
    await readingMerged([guessed, inferred]);
    const dryRun = await restoreGrantedBrief(REQUEST, { apply: false });
    expect(dryRun).toMatchObject({ applied: false, status: "restorable", removed_fields: ["objectVariety"],
      removed_bases: ["description"] });
    expect((await getBrief(REQUEST))!.proposed).toHaveLength(2);

    expect(await restoreGrantedBrief(REQUEST, { apply: true })).toMatchObject({ applied: true, removed_fields: ["objectVariety"] });
    const restored = (await getBrief(REQUEST))!;
    expect(restored.proposed).toEqual([guessed]);
    expect(restored.unresolved).toEqual(before.unresolved);
    const notes = [...sharedFakeFirestoreState.docs.entries()].filter(([key]) => key.includes("/footageProposals/"));
    expect(notes).toHaveLength(1);
    expect(notes[0][1]).toMatchObject({ state: "grant_review_required", proposals: [inferred] });
    expect(await restoreGrantedBrief(REQUEST, { apply: true })).toEqual({ applied: false, status: "matches_grant" });
  });

  it("never removes a measurement, and says so when nothing model-read explains the move", async () => {
    await granted();
    await readingMerged([measured as never]);
    expect(await restoreGrantedBrief(REQUEST, { apply: true })).toMatchObject({ applied: false, status: "not_reproducible" });
    expect((await getBrief(REQUEST))!.proposed).toEqual([measured]);
  });

  it("leaves a confirmed brief and a job without a grant alone", async () => {
    await granted();
    await readingMerged([inferred]);
    const brief = (await getBrief(REQUEST))!;
    const record = sharedFakeFirestoreState.docs.get(`inboundRequests/${REQUEST}`) as Record<string, any>;
    expect(planGrantedBriefRestore(record, { ...brief, confirmedAtIso: "2026-11-02T00:00:00Z" }, null))
      .toEqual({ status: "confirmed" });
    expect(planGrantedBriefRestore({}, brief, null)).toEqual({ status: "no_grant" });
  });

  it("removes every reading of a question when only removing all of them restores the task", async () => {
    await granted();
    const twin = { ...inferred, value: "mixed", reading: "Another reading of the same question." };
    const brief = (await getBrief(REQUEST))!;
    // Two readings of one question: removing either alone leaves the question answered.
    await saveBrief({ ...brief, proposed: [inferred, twin], unresolved: unresolvedGates(brief.captureMode, [inferred, twin]) });
    const record = sharedFakeFirestoreState.docs.get(`inboundRequests/${REQUEST}`) as Record<string, any>;
    const plan = planGrantedBriefRestore(record, (await getBrief(REQUEST))!, null);
    expect(plan).toMatchObject({ status: "restorable", remove: [0, 1] });
  });
});
