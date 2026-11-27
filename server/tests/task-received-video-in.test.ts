// @vitest-environment node
/**
 * The job link email says what has happened by the time it goes. A site that sent its video with the start form is
 * not told that a video is required: the form saves the job (and queues this email) before the video uploads, so the
 * email reads the job's saved video when it is sent, the way every job page reads it (`savedWalkthrough`). Until the
 * video is saved, or when that cannot be read, it still asks for one.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore, storageAdmin: null };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/field-encryption", () => ({ decryptFieldValue: vi.fn(async (value: string) => value.replace(/^encrypted:/, "")) }));
const send = vi.hoisted(() => vi.fn());
vi.mock("../utils/email", () => ({ sendEmail: send }));
// What every job page reads to say "We have your video.": null when it could not be read.
const saved = vi.hoisted(() => ({ value: { received: false } as { received: boolean } | null }));
vi.mock("../utils/siteWalkthrough", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/siteWalkthrough")>()),
  savedWalkthrough: vi.fn(async () => saved.value),
}));

const { enqueueTaskLifecycleNotification, SHARING_AND_HOW_TO_STOP } = await import("../utils/taskLifecycleNotifications");
const { deliverOutbox } = await import("../utils/captureOutbox");

const ASK = "A video is required to post your job. Use the link to send one or check your upload.";
const VIDEO_IN = "We have your video. Next, we watch your video. Your job page shows what we find.";
const PRIVATE_LINK = "This link opens your job without a password, so please don't forward it.";
const HOW_TO_STOP = "We don't share your name, address or contact details with a deployment company unless you ask for "
  + "an introduction to it. To stop, open your job page and withdraw your job there. It then leaves every company's view "
  + "at once, and each company it was sent to is asked to delete any copy it saved.";
// No approved company may see jobs in this store (as in production on 2026-11-27): the email says so (outreach audit D6).
const NONE_YET = "None is approved yet, so no company can see your job yet; your job page shows when one can.";
const sentText = () => String(send.mock.calls[0]?.[0]?.text ?? "");

beforeEach(() => {
  sharedFakeFirestoreState.docs.clear();
  sharedFakeFirestoreState.docs.set("inboundRequests/req-1", { contact: { email: "encrypted:owner@example.com" },
    request: { buyerType: "site_operator", has_existing_footage: true, consent_attestation: { granted: true,
      statement_version: "2026-11-12.v4", recorded_at_iso: "2026-11-12T00:00:00Z" } } });
  saved.value = { received: false };
  send.mockReset().mockResolvedValue({ sent: true, provider: "resend", messageId: "accepted" });
});

describe("the job link email of a job whose video is in", () => {
  it("says the video is in, not that one is required, when the video arrived after the email was queued", async () => {
    // The start form saves the job, and queues this email, before its video has uploaded.
    expect((await enqueueTaskLifecycleNotification({ requestId: "req-1", milestone: "task_received" })).enqueued).toBe(true);
    expect((sharedFakeFirestoreState.docs.get("captureOutbox/req-1:task_received") as { body: string }).body).toContain(ASK);
    saved.value = { received: true };
    await deliverOutbox();
    expect(send).toHaveBeenCalledTimes(1);
    const text = sentText();
    expect(text).toMatch(/^Your job link is ready\.\n\nWe have your video\. Next, we watch your video\. Your job page shows what we find\. /);
    expect(text).toContain(`${VIDEO_IN} ${PRIVATE_LINK}`);
    expect(text).not.toContain("A video is required");
    expect(text).not.toContain("Once your video is in");
    // Where the job goes, what is never shared and how to stop stay in it.
    expect(text).toContain(`Your job goes to the deployment companies we approve. ${NONE_YET} ${HOW_TO_STOP}`);
    expect(text).not.toContain("Your job goes to approved deployment companies.");
    expect(text).toMatch(/Open your job:\nhttps:\/\/\S+\/capture-upload\//);
    expect(sharedFakeFirestoreState.docs.get("captureOutbox/req-1:task_received")).toMatchObject({ status: "sent" });
  });

  it("says the video is in when the email is queued after it arrived", async () => {
    saved.value = { received: true };
    await enqueueTaskLifecycleNotification({ requestId: "req-1", milestone: "task_received" });
    const row = sharedFakeFirestoreState.docs.get("captureOutbox/req-1:task_received") as { body: string };
    expect(row.body).toContain(`${VIDEO_IN} ${PRIVATE_LINK}`);
    expect(row.body).not.toContain("A video is required");
  });

  it("still asks for the video while none is saved, or when that cannot be read", async () => {
    for (const value of [{ received: false }, null]) {
      sharedFakeFirestoreState.docs.delete("captureOutbox/req-1:task_received");
      send.mockClear();
      saved.value = { received: false };
      await enqueueTaskLifecycleNotification({ requestId: "req-1", milestone: "task_received" });
      saved.value = value;
      await deliverOutbox();
      expect(send).toHaveBeenCalledTimes(1);
      expect(sentText()).toContain(`${ASK} ${PRIVATE_LINK}\n\nOnce your video is in, your job goes to the deployment companies we approve. ${NONE_YET} ${HOW_TO_STOP}`);
      expect(SHARING_AND_HOW_TO_STOP).toContain(HOW_TO_STOP);
      expect(sentText()).not.toContain("We have your video");
    }
  });

  it("does not change an email a dispatch may already have carried", async () => {
    await enqueueTaskLifecycleNotification({ requestId: "req-1", milestone: "task_received" });
    const row = sharedFakeFirestoreState.docs.get("captureOutbox/req-1:task_received") as Record<string, unknown>;
    // A transient failure on an earlier try: the provider holds that message under the row's key.
    Object.assign(row, { attempts: 1, nextAttemptAtMs: null });
    saved.value = { received: true };
    await deliverOutbox();
    expect(sentText()).toContain(ASK);
  });
});
