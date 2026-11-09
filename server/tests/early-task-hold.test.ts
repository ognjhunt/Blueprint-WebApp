// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState } from "./helpers/fake-firestore";
import { crossRuntimeArtifactDigest } from "../utils/crossRuntimeCanonical";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/field-encryption", () => ({ decryptFieldValue: vi.fn(async (value: string) => value.replace(/^encrypted:/, "")) }));
// The preparation event's own currency check reads the Pipeline ledger; it is covered in website-preparation-status.
vi.mock("../utils/taskLifecycleNotificationAuthority", () => ({ taskLifecycleNotificationIsCurrent: vi.fn(async () => true) }));
const send = vi.hoisted(() => vi.fn());
vi.mock("../utils/email", () => ({ sendEmail: send }));

const { projectAtlasPreparationOutcome, EARLY_TASK_HOLD_SENTENCES } = await import("../utils/taskPreparationOutcome");
const { selectWebsiteAtlasPreview } = await import("../utils/websiteAtlasPreview");
const { projectTaskStatus } = await import("../utils/taskStatusProjection");
const { enqueueTaskLifecycleNotification } = await import("../utils/taskLifecycleNotifications");

const EVENT = `sha256:${"c".repeat(64)}`;
function atlas(reason: string, state = "needs_input") {
  const value = { schema_version: "website_atlas_preview.v1", capture_id: "walkthrough-req-1", revision: 3, state, reason,
    updated_at_epoch: 1793109960, bundle: null, splat_available: false, mesh_available: false,
    claim_ceiling: "development_only", scale_status: "unscaled_provider_world_units" };
  return { ...value, preview_digest: crossRuntimeArtifactDigest(value, "preview_digest") };
}
const base = { briefDrafted: true, briefConfirmed: true, hasStoredCapture: true, stage: null, coversScene: null,
  missingViews: [], supplementWouldFinish: false };

/** The exact sentence for each Pipeline early-hold reason (website_early_task_hold.EARLY_CODES). */
const EXPECTED: Record<string, string> = {
  website_native_task_profile_preparation_required: "Held: we can't simulate this kind of job yet.",
  website_task_family_runtime_preparation_required:
    "Held: we can't simulate this kind of job yet, because the simulator it needs isn't set up on our side.",
  website_task_operation_coverage_unresolved: "Held: we can't simulate every step this job asks for yet.",
};

beforeEach(() => {
  sharedFakeFirestoreState.docs.clear();
  send.mockReset();
});

describe("the Pipeline's early task hold", () => {
  it("covers exactly the three early-hold reasons", () => {
    expect(Object.keys(EARLY_TASK_HOLD_SENTENCES).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  for (const [reason, sentence] of Object.entries(EXPECTED)) {
    it(`shows ${reason} as held, in one plain sentence, never as a processing failure`, () => {
      const preview = atlas(reason);
      const outcome = projectAtlasPreparationOutcome(selectWebsiteAtlasPreview(
        { website_atlas_previews: { [preview.capture_id]: preview } }, preview.capture_id));
      expect(outcome).toMatchObject({ category: "held", basis: "simulation_not_available", title: sentence, actionOwner: "blueprint",
        evidence: [{ digest: preview.preview_digest }] });
      const status = projectTaskStatus({ ...base, preparationOutcome: outcome });
      expect(status).toMatchObject({ decision: "held", headline: sentence, operatorAction: null });
      const text = JSON.stringify(status);
      expect(text).not.toMatch(/could not finish processing|processing step stopped/i);
      expect(text).not.toMatch(/website_|_required|_unresolved/);
      // No rerun, date or follow-up the code does not deliver.
      expect(text).not.toMatch(/we will|we'll|email you|again once|rerun|run it again|by \w+day/i);
    });
  }

  it("keeps the recording sentence true when the recording is not stored", () => {
    const outcome = projectAtlasPreparationOutcome(selectWebsiteAtlasPreview(
      { website_atlas_previews: { "walkthrough-req-1": atlas("website_native_task_profile_preparation_required") } }, "walkthrough-req-1"));
    expect(projectTaskStatus({ ...base, hasStoredCapture: false, preparationOutcome: outcome }).outcome!.nextStep)
      .toBe("Nothing is needed from you. Keep your original recording; you do not need to send it again.");
  });

  it("leaves other needs-input reasons where they were", () => {
    const preview = atlas("website_atlas_api_key_missing");
    expect(projectAtlasPreparationOutcome(selectWebsiteAtlasPreview(
      { website_atlas_previews: { [preview.capture_id]: preview } }, preview.capture_id))!.category).toBe("processing_failure");
    const failed = atlas("website_native_task_profile_preparation_required", "failed");
    expect(projectAtlasPreparationOutcome(selectWebsiteAtlasPreview(
      { website_atlas_previews: { [failed.capture_id]: failed } }, failed.capture_id))!.category).toBe("processing_failure");
  });

  for (const [reason, sentence] of Object.entries(EXPECTED)) {
    it(`sends the held email for ${reason} in place of needs-attention, once, with the page's sentence`, async () => {
      const preview = atlas(reason);
      sharedFakeFirestoreState.docs.set("inboundRequests/req-1", { contact: { email: "encrypted:owner@example.com" },
        website_atlas_previews: { [preview.capture_id]: preview } });
      const intent = { requestId: "req-1", captureId: "walkthrough-req-1", eventId: EVENT,
        correlationId: "bp-prep-0123456789abcdef", milestone: "preparation_needs_attention" as const, terminalReason: null };
      expect((await enqueueTaskLifecycleNotification(intent)).enqueued).toBe(true);
      expect((await enqueueTaskLifecycleNotification(intent)).enqueued).toBe(false);
      const rows = [...sharedFakeFirestoreState.docs.entries()].filter(([key]) => key.startsWith("captureOutbox/"));
      expect(rows).toHaveLength(1);
      const row = rows[0][1] as Record<string, string>;
      expect(rows[0][0]).toBe(`captureOutbox/req-1:preparation_needs_attention:${EVENT.replace(":", "_")}`);
      expect(row.subject).toBe("Your Blueprint job is held");
      expect(row.body.startsWith(`${sentence} No robot was tested on your job, and this is not a finding that a robot could not do it.`)).toBe(true);
      expect(row.body).toMatch(/Reference: bp-prep-0123456789abcdef\./);
      expect(row.body).not.toMatch(/needs our team's review|could not finish|website_|we'll|email you|rerun/i);
      expect(send).not.toHaveBeenCalled();
    });
  }

  it("keeps the needs-attention email for a job that is not early-held", async () => {
    sharedFakeFirestoreState.docs.set("inboundRequests/req-1", { contact: { email: "encrypted:owner@example.com" },
      website_atlas_previews: { "walkthrough-req-1": atlas("atlas_task_and_scene_coverage_gap") } });
    await enqueueTaskLifecycleNotification({ requestId: "req-1", captureId: "walkthrough-req-1", eventId: EVENT,
      milestone: "preparation_needs_attention" });
    const row = [...sharedFakeFirestoreState.docs.entries()].find(([key]) => key.startsWith("captureOutbox/"))![1] as Record<string, string>;
    expect(row.subject).toBe("An update on your Blueprint job preparation");
    expect(row.body).toMatch(/needs our team's review/);
    expect(send).not.toHaveBeenCalled();
  });
});
