// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestore as store, sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: store, default: {} }));
const decrypt = vi.hoisted(() => vi.fn(async (value: unknown) => value));
vi.mock("../utils/field-encryption", () => ({ decryptFieldValue: decrypt }));
vi.mock("../utils/captureOutbox", () => ({ CAPTURE_OUTBOX_COLLECTION: "captureOutbox", enqueueOutbox: vi.fn() }));
const { buildPilotRecommendationNotification, pilotRecommendationNotificationIsCurrent } = await import("../utils/pilotRecommendationNotifications");
const recommendation = { id: "rec_a", teamName: "Fixture team", purpose: "Test picking" };
const entry = () => ({ ...buildPilotRecommendationNotification({ requestId: "request-1", recommendation, to: "owner@example.test", captureUrl: "https://fixture.invalid/private-link" }),
  status: "pending" as const, attempts: 0, createdAtIso: "2026-10-07T00:00:00Z", sentAtIso: null, lastError: null });
const current = () => store.runTransaction(tx => pilotRecommendationNotificationIsCurrent(entry(), tx as never));
beforeEach(() => {
  state.docs.clear();
  decrypt.mockReset(); decrypt.mockImplementation(async value => value);
  state.docs.set("inboundRequests/request-1", { pilot_recommendation: recommendation, contact: { email: "owner@example.test" } });
});
describe("pilot recommendation dispatch authority", () => {
  it("allows only the current recommendation and exact current recipient", async () => {
    expect(await current()).toBe(true);
    state.docs.set("inboundRequests/request-1", { pilot_recommendation: { ...recommendation, id: "rec_b" }, contact: { email: "owner@example.test" } });
    expect(await current()).toBe(false);
  });
  it("rejects a changed recipient, booked pilot, and deleted source", async () => {
    state.docs.set("inboundRequests/request-1", { pilot_recommendation: recommendation, contact: { email: "new@example.test" } });
    expect(await current()).toBe(false);
    state.docs.set("inboundRequests/request-1", { pilot_recommendation: recommendation, contact: { email: "owner@example.test" }, pilot_booking: { recommendationId: "rec_a" } });
    expect(await current()).toBe(false);
    state.docs.clear();
    expect(await current()).toBe(false);
  });
  it("does not treat a decryption or authoritative read failure as permission to send", async () => {
    decrypt.mockRejectedValueOnce(new Error("encryption key unavailable"));
    await expect(current()).rejects.toThrow("encryption key unavailable");
    await expect(pilotRecommendationNotificationIsCurrent(entry(), { get: async () => { throw new Error("read failed"); } } as never)).rejects.toThrow("read failed");
  });
  it("revalidates legacy queued notices and never upgrades a previous event", async () => {
    const legacy = { ...entry(), idempotencyKey: "request-1:pilot_recommended:rec_a" };
    expect(await store.runTransaction(tx => pilotRecommendationNotificationIsCurrent(legacy, tx as never))).toBe(true);
    state.docs.set("inboundRequests/request-1", { pilot_recommendation: { ...recommendation, id: "rec_b" }, contact: { email: "owner@example.test" } });
    expect(await store.runTransaction(tx => pilotRecommendationNotificationIsCurrent(legacy, tx as never))).toBe(false);
  });
  it("does not read recommendation state for another notice type", async () => {
    const get = vi.fn();
    expect(await pilotRecommendationNotificationIsCurrent({ ...entry(), kind: "task_received" }, { get } as never)).toBe(true);
    expect(get).not.toHaveBeenCalled();
  });
});
