// @vitest-environment node
/** Root wiring controls. Canonical status authority is injected; no provider/mail is live. */
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

const seam = vi.hoisted(() => ({ current: true, unavailable: false, send: vi.fn(),
  decryptUnavailable: false, authority: vi.fn(), drain: vi.fn(async () => ({enqueued: 0, pending: 0})) }));
vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const {sharedFakeFirestore, FAKE_FIELD_DELETE} = await import("./helpers/fake-firestore");
  return {default: {firestore: {FieldValue: {serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE}}},
    dbAdmin: sharedFakeFirestore};
});
vi.mock("../logger", () => ({logger: {info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn()}}));
vi.mock("../utils/email", () => ({sendEmail: seam.send}));
vi.mock("../utils/field-encryption", () => ({decryptFieldValue: async (value: string) => {
  if (seam.decryptUnavailable) throw Error("isolated encryption unavailable"); return value;
}}));
vi.mock("../utils/websitePreparationStatus", () => ({
  canNotifyCurrentWebsitePreparationIssue: seam.authority,
  drainPendingWebsitePreparationNotifications: seam.drain,
}));
const {buildTaskLifecycleNotification, enqueueTaskLifecycleNotification} = await import("../utils/taskLifecycleNotifications");
const {enqueueOutbox, deliverOutbox, reconcileOutboxDeliveries} = await import("../utils/captureOutbox");
const eventId = `sha256:${"a".repeat(64)}`;
const params = {requestId: "r1", milestone: "preparation_needs_attention" as const, eventId,
  correlationId: "bp-prep-1234567890abcdef"};
const key = `r1:preparation_needs_attention:sha256_${"a".repeat(64)}`;

beforeEach(() => {
  sharedFakeFirestoreState.docs.clear();
  sharedFakeFirestoreState.docs.set("inboundRequests/r1", {contact: {email: "owner@example.test"}});
  seam.current = true; seam.unavailable = false; seam.decryptUnavailable = false;
  seam.authority.mockReset().mockImplementation(async () => {
    if (seam.unavailable) throw Error("website_preparation_unavailable");
    return seam.current;
  });
  seam.send.mockReset().mockResolvedValue({sent: true, provider: "local-sink", messageId: "local-receipt"});
});

describe("source/context preparation notice uses existing durable outbox", () => {
  it("PREP-NOTICE-001 preserves exact event identity, safe copy and one logical intent", async () => {
    expect((await enqueueTaskLifecycleNotification(params)).enqueued).toBe(true);
    expect((await enqueueTaskLifecycleNotification(params)).enqueued).toBe(false);
    const row = sharedFakeFirestoreState.docs.get(`captureOutbox/${key}`) as any;
    expect(row.preparationEventId).toBe(eventId);
    expect(row.body).toContain("bp-prep-1234567890abcdef");
    expect(row.body).not.toMatch(/budget|completed|automatically retry|robot can/i);
    expect([...sharedFakeFirestoreState.docs.keys()].filter(k => k.startsWith("captureOutbox/"))).toHaveLength(1);
    expect(seam.send).not.toHaveBeenCalled();
  });
  it("PREP-NOTICE-002 drops untrusted error/detail/reference content", () => {
    const row = buildTaskLifecycleNotification({...params, to: "owner@example.test",
      detail: "private provider /path key=secret", correlationId: "https://unsafe.example/token"});
    expect(row.body).not.toMatch(/private provider|key=secret|unsafe\.example/);
  });
  it("PREP-NOTICE-003 refuses missing event authority", async () => {
    expect(() => buildTaskLifecycleNotification({...params, eventId: undefined, to: "owner@example.test"})).toThrow();
    await enqueueOutbox({idempotencyKey: "r1:forged", requestId: "r1", kind: "preparation_needs_attention",
      to: "owner@example.test", subject: "s", body: "b"});
    await deliverOutbox();
    expect(sharedFakeFirestoreState.docs.get("captureOutbox/r1:forged")).toMatchObject({status: "cancelled", attempts: 0});
    expect(seam.send).not.toHaveBeenCalled();
  });
  it("PREP-NOTICE-004 cancellation after recovery/withdrawal consumes no send", async () => {
    await enqueueTaskLifecycleNotification(params); seam.current = false;
    await deliverOutbox();
    expect(sharedFakeFirestoreState.docs.get(`captureOutbox/${key}`)).toMatchObject({status: "cancelled", attempts: 0});
    expect(seam.authority.mock.calls.at(-1)?.[2]).toBeDefined();
    expect(seam.send).not.toHaveBeenCalled();
  });
  it("PREP-NOTICE-005 unknown read keeps pre-dispatch claim recoverable", async () => {
    await enqueueTaskLifecycleNotification(params); seam.unavailable = true;
    await expect(deliverOutbox()).rejects.toThrow("website_preparation_unavailable");
    const row = sharedFakeFirestoreState.docs.get(`captureOutbox/${key}`) as any;
    expect(row).toMatchObject({status: "claimed", attempts: 0});
    expect(seam.send).not.toHaveBeenCalled();
    row.deliveryLeaseUntilMs = 0; seam.unavailable = false;
    await reconcileOutboxDeliveries(); await deliverOutbox();
    expect(seam.send).toHaveBeenCalledTimes(1);
  });
  it("PREP-NOTICE-006 binds new event identity while retaining historical message digests", async () => {
    await enqueueTaskLifecycleNotification(params); await deliverOutbox();
    const row = sharedFakeFirestoreState.docs.get(`captureOutbox/${key}`) as any;
    const fields = [row.idempotencyKey, row.requestId, row.kind, row.to, row.subject, row.body, row.replyTo ?? null];
    expect(row.deliveryDigest).toBe(createHash("sha256").update(JSON.stringify([...fields,eventId])).digest("hex"));
    const old = {idempotencyKey: "r1:old", requestId: "r1", kind: "task_received" as const,
      to: "owner@example.test", subject: "s", body: "b"};
    await enqueueOutbox(old); await deliverOutbox();
    expect(sharedFakeFirestoreState.docs.get("captureOutbox/r1:old")).toMatchObject({
      deliveryDigest: createHash("sha256").update(JSON.stringify([
        old.idempotencyKey, old.requestId, old.kind, old.to, old.subject, old.body, null,
      ])).digest("hex"), status: "sent",
    });
  });
  it("PREP-NOTICE-007 missing delivery acknowledgment stays unknown without another send", async () => {
    await enqueueTaskLifecycleNotification(params);
    seam.send.mockRejectedValueOnce(Error("local lost response after simulated acceptance"));
    await deliverOutbox(); await deliverOutbox();
    expect(sharedFakeFirestoreState.docs.get(`captureOutbox/${key}`)).toMatchObject({status: "unknown", attempts: 1});
    expect(seam.send).toHaveBeenCalledTimes(1);
  });
  it("PREP-NOTICE-008 contact correction cancels private-link delivery to the old recipient", async () => {
    await enqueueTaskLifecycleNotification(params);
    sharedFakeFirestoreState.docs.set("inboundRequests/r1", {contact: {email: "corrected@example.test"}});
    await deliverOutbox();
    expect(seam.send).not.toHaveBeenCalled();
    expect(sharedFakeFirestoreState.docs.get(`captureOutbox/${key}`)).toMatchObject({status: "cancelled", attempts: 0});
  });
  it("PREP-NOTICE-009 recipient read/decrypt uncertainty stays recoverable without send", async () => {
    await enqueueTaskLifecycleNotification(params); seam.decryptUnavailable = true;
    await expect(deliverOutbox()).rejects.toThrow();
    expect(seam.send).not.toHaveBeenCalled();
    expect(sharedFakeFirestoreState.docs.get(`captureOutbox/${key}`)).toMatchObject({status: "claimed", attempts: 0});
  });
});
