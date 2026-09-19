// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return {
    default: { firestore: { FieldValue: {
      serverTimestamp: () => "SERVER_TIMESTAMP",
      delete: () => FAKE_FIELD_DELETE,
    } } },
    dbAdmin: sharedFakeFirestore,
  };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/field-encryption", () => ({
  decryptFieldValue: vi.fn(async (value: string) => value.replace(/^encrypted:/, "")),
}));

const { enqueueTaskLifecycleNotification, reconstructionIsViewable, reconcileSceneReadyNotifications } = await import("../utils/taskLifecycleNotifications");

beforeEach(() => {
  sharedFakeFirestoreState.docs.clear();
  sharedFakeFirestoreState.docs.set("inboundRequests/req-1", {
    contact: { email: "encrypted:owner@example.com" },
  });
});

describe("task lifecycle notifications", () => {
  it("recognizes only a persisted ready world with something the owner can view", () => {
    expect(reconstructionIsViewable({ state: "processing", worldId: "w", assets: { launchUrl: "https://view" } })).toBe(false);
    expect(reconstructionIsViewable({ state: "ready", worldId: "w", assets: null })).toBe(false);
    expect(reconstructionIsViewable({ state: "ready", worldId: "w", assets: { launchUrl: null, spzUrlsByDetail: {} } })).toBe(false);
    expect(reconstructionIsViewable({ state: "ready", worldId: "w", assets: { thumbnailUrl: "https://thumb", spzUrlsByDetail: {} } })).toBe(false);
    expect(reconstructionIsViewable({ state: "ready", worldId: "w", assets: { launchUrl: "javascript:alert(1)" } })).toBe(false);
    expect(reconstructionIsViewable({ state: "ready", worldId: "w", assets: { spzUrlsByDetail: { full: "https://assets/scene.spz" } } })).toBe(false);
    expect(reconstructionIsViewable({ state: "ready", worldId: "w", assets: { launchUrl: "https://view" } })).toBe(true);
  });
  it("decrypts the owner, uses an owner-scoped task link, and deduplicates retries", async () => {
    expect((await enqueueTaskLifecycleNotification({ requestId: "req-1", milestone: "video_received" })).enqueued).toBe(true);
    expect((await enqueueTaskLifecycleNotification({ requestId: "req-1", milestone: "video_received" })).enqueued).toBe(false);

    const row = sharedFakeFirestoreState.docs.get("captureOutbox/req-1:video_received") as Record<string, unknown>;
    expect(row.to).toBe("owner@example.com");
    expect(row.kind).toBe("video_received");
    expect(row.body).toMatch(/reviewing privacy and coverage/i);
    expect(row.body).toMatch(/\/capture-upload\//);
    expect([...sharedFakeFirestoreState.docs.keys()].filter(key => key.startsWith("captureOutbox/"))).toHaveLength(1);
  });

  it("keeps each observed milestone distinct without claiming a result", async () => {
    await enqueueTaskLifecycleNotification({ requestId: "req-1", milestone: "scene_ready" });
    await enqueueTaskLifecycleNotification({ requestId: "req-1", milestone: "screening_started" });

    const scene = sharedFakeFirestoreState.docs.get("captureOutbox/req-1:scene_ready") as Record<string, unknown>;
    const screening = sharedFakeFirestoreState.docs.get("captureOutbox/req-1:screening_started") as Record<string, unknown>;
    expect(scene.body).toMatch(/persisted and ready to view/i);
    expect(screening.body).toMatch(/picked up/i);
    expect(screening.body).toMatch(/not an observed episode or result/i);
  });

  it("does not enqueue without an authoritative owner contact", async () => {
    sharedFakeFirestoreState.docs.set("inboundRequests/req-2", { contact: {} });
    await expect(enqueueTaskLifecycleNotification({ requestId: "req-2", milestone: "scene_ready" }))
      .resolves.toEqual({ enqueued: false, reason: "contact_missing" });
    expect(sharedFakeFirestoreState.docs.has("captureOutbox/req-2:scene_ready")).toBe(false);
  });
});


it("recovers a persisted ready scene notice without another controller poll", async () => {
  sharedFakeFirestoreState.docs.set("captureUploadSessions/capture-1", {
    scene_notification_pending: true, notification_request_id: "req-1",
    world_reconstruction: { state: "ready", world_id: "world-1", assets: { launchUrl: "https://view.example/1" } },
  });
  await reconcileSceneReadyNotifications();
  expect(sharedFakeFirestoreState.docs.get("captureOutbox/req-1:scene_ready")).toBeDefined();
  expect(sharedFakeFirestoreState.docs.get("captureUploadSessions/capture-1")).toMatchObject({ scene_notification_pending: false });
  await reconcileSceneReadyNotifications();
  expect([...sharedFakeFirestoreState.docs.keys()].filter(key => key.endsWith(":scene_ready"))).toHaveLength(1);
});
