// @vitest-environment node
/**
 * The emails the one job needs, and nothing else (owner, 2026-11-19: 43 kinds down to the ones the job needs). A site
 * hears when its job is received (with its link), sent to companies, answered and introduced; everything else is on
 * its job page. A row of a retired kind queued before then is cancelled at dispatch, never sent.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/field-encryption", () => ({ decryptFieldValue: vi.fn(async (value: string) => value.replace(/^encrypted:/, "")) }));
const send = vi.hoisted(() => vi.fn());
vi.mock("../utils/email", () => ({ sendEmail: send }));

const { enqueueTaskLifecycleNotification, buildTaskLifecycleNotification, HOW_TO_WITHDRAW } = await import("../utils/taskLifecycleNotifications");
const { RETIRED_KINDS, deliverOutbox } = await import("../utils/captureOutbox");

beforeEach(() => {
  sharedFakeFirestoreState.docs.clear();
  sharedFakeFirestoreState.docs.set("inboundRequests/req-1", { contact: { email: "encrypted:owner@example.com" },
    request: { buyerType: "site_operator", consent_attestation: { granted: true, statement_version: "2026-11-12.v4",
      recorded_at_iso: "2026-11-12T00:00:00Z" } } });
  send.mockReset().mockResolvedValue({ sent: true, provider: "resend", messageId: "accepted" });
});

describe("the site's emails", () => {
  it("puts the private job link in the first email, once", async () => {
    expect((await enqueueTaskLifecycleNotification({ requestId: "req-1", milestone: "task_received" })).enqueued).toBe(true);
    expect((await enqueueTaskLifecycleNotification({ requestId: "req-1", milestone: "task_received" })).enqueued).toBe(false);
    const row = sharedFakeFirestoreState.docs.get("captureOutbox/req-1:task_received") as Record<string, string>;
    expect(row).toMatchObject({ to: "owner@example.com", kind: "task_received", subject: "Your Blueprint job link" });
    expect(row.body).toMatch(/^We have your job\.\n\nIf you haven't sent the video yet, send it from your job page\./);
    expect(row.body).toMatch(/\/capture-upload\//);
    await deliverOutbox();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("queues nothing without an owner contact, or once the site withdrew, and cancels a queued one after a withdrawal", async () => {
    sharedFakeFirestoreState.docs.set("inboundRequests/req-2", { contact: {} });
    await expect(enqueueTaskLifecycleNotification({ requestId: "req-2", milestone: "task_received" }))
      .resolves.toEqual({ enqueued: false, reason: "contact_missing" });
    await enqueueTaskLifecycleNotification({ requestId: "req-1", milestone: "task_received" });
    (sharedFakeFirestoreState.docs.get("inboundRequests/req-1") as Record<string, unknown>).consent_revoked = true;
    await deliverOutbox();
    expect(send).not.toHaveBeenCalled();
    expect(sharedFakeFirestoreState.docs.get("captureOutbox/req-1:task_received")).toMatchObject({ status: "cancelled" });
    await expect(enqueueTaskLifecycleNotification({ requestId: "req-1", milestone: "task_received" }))
      .resolves.toEqual({ enqueued: false, reason: "consent_withdrawn" });
  });

  it("says the job went to the companies, what is never shared and how to stop", () => {
    const message = buildTaskLifecycleNotification({ requestId: "req-1", milestone: "job_sent", to: "owner@example.com",
      eventId: "companies", companyCount: 3 });
    expect(message).toMatchObject({ idempotencyKey: "req-1:job_sent:companies", kind: "job_sent",
      subject: "Your job was sent to deployment companies" });
    expect(message.body).toMatch(/^Your job is with 3 deployment companies\. We don't share your name, address or contact details/);
    expect(message.body).toContain(HOW_TO_WITHDRAW);
  });

  it("names a company's answer by its label only, never the company", () => {
    const message = buildTaskLifecycleNotification({ requestId: "req-1", milestone: "company_answered", to: "owner@example.com",
      eventId: "c1-interested", companyAnswerState: "interested" });
    expect(message.subject).toBe("A deployment company answered");
    expect(() => buildTaskLifecycleNotification({ requestId: "req-1", milestone: "company_answered", to: "x@example.com",
      companyAnswerState: "bogus" as never })).toThrow("company_answer_state_invalid");
  });
});

describe("the retired emails", () => {
  it("never sends a row of a retired kind queued before the cut", async () => {
    for (const kind of ["video_received", "scene_ready", "answer_ready", "preparation_ended", "scene_outcome", "listing_live",
      "video_too_large", "screening_not_now", "robot_team_access_received", "robot_team_access_not_yet"]) {
      expect(RETIRED_KINDS.has(kind)).toBe(true);
      sharedFakeFirestoreState.docs.set(`captureOutbox/req-1:${kind}`, { idempotencyKey: `req-1:${kind}`, requestId: "req-1", kind,
        to: "owner@example.com", subject: "s", body: "b", replyTo: null, status: "pending", attempts: 0, createdAtIso: "2026-11-18T00:00:00Z",
        sentAtIso: null, lastError: null });
    }
    await deliverOutbox({ limit: 20 });
    expect(send).not.toHaveBeenCalled();
    for (const [path, row] of sharedFakeFirestoreState.docs) if (path.startsWith("captureOutbox/req-1:"))
      expect(row).toMatchObject({ status: "cancelled", attempts: 0 });
  });
});
