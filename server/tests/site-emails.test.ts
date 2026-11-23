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

const { enqueueTaskLifecycleNotification, buildTaskLifecycleNotification, SHARING_AND_HOW_TO_STOP } = await import("../utils/taskLifecycleNotifications");
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
    expect(row.body).toMatch(/^Your job link is ready\.\n\nA video is required to post your job\./);
    expect(row.body).toMatch(/\/capture-upload\//);
    await deliverOutbox();
    expect(send).toHaveBeenCalledTimes(1);
  });

  // Decision 12 (launch copy, v-B-005): a site outside the US can save its job but may not send a video yet, so its
  // first email does not ask for one. A missing or unreadable region keeps the usual words.
  it("does not ask a site outside the US for a video, and says so the way its done screen does", async () => {
    (sharedFakeFirestoreState.docs.get("inboundRequests/req-1") as Record<string, any>).request.capture_region = "non_us";
    expect((await enqueueTaskLifecycleNotification({ requestId: "req-1", milestone: "task_received" })).enqueued).toBe(true);
    const row = sharedFakeFirestoreState.docs.get("captureOutbox/req-1:task_received") as Record<string, string>;
    expect(row.body).toMatch(/^Your job is saved\.\n\nWe can only take videos from sites in the United States for now, so please don't send a video yet\. This link opens your job without a password, so please don't forward it\.\n\nOpen your job:\nhttps:\/\/\S+\/capture-upload\//);
    expect(row.body).not.toMatch(/A video is required/);
    for (const captureRegion of ["us", null, "encrypted:abc"]) {
      expect(buildTaskLifecycleNotification({ requestId: "req-1", milestone: "task_received", to: "owner@example.com", captureRegion })
        .body).toMatch(/^Your job link is ready\.\n\nA video is required to post your job\./);
    }
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

  // The job link email says what "Your job is posted" said, so that email is no longer sent (ledger AL38).
  it("says in the job link email where the job goes once the video is in, what is never shared and how to stop", () => {
    const message = buildTaskLifecycleNotification({ requestId: "req-1", milestone: "task_received", to: "owner@example.com" });
    expect(message).toMatchObject({ kind: "task_received", subject: "Your Blueprint job link" });
    expect(SHARING_AND_HOW_TO_STOP).toBe("Once your video is in, your job goes to approved deployment companies. We don't share "
      + "your name, address or contact details with a deployment company unless you ask for an introduction to it. To stop, "
      + "open your job page and withdraw your job there. It then leaves every company's view at once, and each company it "
      + "was sent to is asked to delete any copy it saved.");
    expect(message.body).toContain(SHARING_AND_HOW_TO_STOP);
    // A site outside the approved region shares nothing, so its email says nothing about sharing.
    const outside = buildTaskLifecycleNotification({ requestId: "req-1", milestone: "task_received", to: "owner@example.com",
      captureRegion: "non_us" });
    expect(outside.body).not.toContain("approved deployment companies");
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
