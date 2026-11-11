// @vitest-environment node
/**
 * "Find a deployment company for this job": the owner link's one explicit
 * choice. It records the request once, turns the job card on through the same
 * grant "Manage opportunity sharing" records, and rings Blueprint once. It
 * contacts no outside company. OFFLINE: the real route against the fake
 * Firestore; the outbox and Slack are fakes.
 */
import { createServer, type Server } from "node:http";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";
import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

vi.mock("../utils/websitePreparationStatus", () => ({ loadCurrentWebsitePreparationStatus: vi.fn(async () => null),
  loadCurrentTaskTargetChoiceQuestion: vi.fn(async () => null) }));
vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore,
    storageAdmin: { bucket: () => ({ file: (name: string) => ({
      getMetadata: async () => { throw Object.assign(new Error(`missing ${name}`), { code: 404 }); },
      exists: async () => [false], download: async () => [Buffer.alloc(0)],
      save: () => { throw new Error("Unexpected storage mutation"); },
      delete: () => { throw new Error("Unexpected storage mutation"); } }) }) } };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
const enqueueOutbox = vi.hoisted(() => vi.fn(async () => ({ enqueued: true })));
vi.mock("../utils/captureOutbox", async importOriginal => ({
  ...await importOriginal<typeof import("../utils/captureOutbox")>(), enqueueOutbox,
  deliverOutbox: vi.fn(async () => ({ examined: 0, sent: 0, failed: 0, exhausted: 0 })) }));
const sendSlackMessage = vi.hoisted(() => vi.fn(async () => ({ sent: true })));
vi.mock("../utils/slack", async importOriginal => ({ ...await importOriginal<typeof import("../utils/slack")>(), sendSlackMessage }));
vi.mock("../utils/email", () => ({ sendEmail: vi.fn(async () => { throw new Error("No email is sent from tests"); }) }));

const briefRouter = (await import("../routes/site-task-brief")).default;
const { createCaptureUploadToken } = await import("../utils/captureUploadToken");
const { listingConsentVersion } = await import("../utils/taskListingDetails");

let server: Server;
let baseUrl: string;
const owner = () => createCaptureUploadToken({ requestId: "req-1", captureId: "walkthrough-req-1", sceneId: "site-req-1" });
const film = () => createCaptureUploadToken({ requestId: "req-1", captureId: "walkthrough-req-1", sceneId: "site-req-1", scope: "film" });
const row = (key: string) => sharedFakeFirestoreState.docs.get(key) as Record<string, any>;

async function ask(token = owner(), csrf = true, body: unknown = {}) {
  const response = await fetch(`${baseUrl}/api/site-task-brief/${token}/introduction-request`, {
    method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json",
      ...(csrf ? { cookie: "csrf_token=introduction-test", "x-csrf-token": "introduction-test" } : {}) } });
  return { status: response.status, body: await response.json() };
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubEnv("SLACK_INBOUND_WEBHOOK_URL", "https://hooks.slack.invalid/test");
  sharedFakeFirestoreState.docs.clear();
  const app = express();
  app.use(express.json());
  app.use("/api/site-task-brief", briefRouter);
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  sharedFakeFirestoreState.docs.set("inboundRequests/req-1", { requestId: "req-1", contact: { email: "owner@example.com" },
    request: { buyerType: "site_operator", capture_mode: "self_capture", siteTaskGates: {}, consent_attestation: {
      granted: true, statement_version: RECORDING_CONSENT_VERSION, recorded_at_iso: "2026-10-26T11:00:00.000Z" } } });
  sharedFakeFirestoreState.docs.set("siteTaskBriefs/req-1", { requestId: "req-1", summary: "Move cartons from the conveyor to the pallet",
    proposed: [], confirmedAtIso: null });
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
});

describe("POST /:token/introduction-request", () => {
  it("is the owner's alone", async () => {
    expect((await ask(film())).status).toBe(403);
    expect((await ask("not-a-token")).status).toBe(404);
    expect(row("inboundRequests/req-1").introduction_request).toBeUndefined();
    expect(sendSlackMessage).not.toHaveBeenCalled();
  });

  it("refuses a request without the CSRF token, and any body but an empty one", async () => {
    expect((await ask(owner(), false)).status).toBe(403);
    expect((await ask(owner(), true, { company: "Acme" })).status).toBe(400);
    expect(row("inboundRequests/req-1").introduction_request).toBeUndefined();
  });

  it("refuses once recording consent is withdrawn", async () => {
    row("inboundRequests/req-1").consent_revoked = true;
    expect((await ask()).status).toBe(409);
    expect(row("inboundRequests/req-1").introduction_request).toBeUndefined();
  });

  it("records once, turns the card on under its consent version, and rings once", async () => {
    const first = await ask();
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ ok: true, requestedAtIso: expect.any(String), listed: true });
    const stored = row("inboundRequests/req-1");
    expect(stored.introduction_request).toEqual({ requested_at_iso: first.body.requestedAtIso, requested_by: "signed_owner_link" });
    // The same grant "Manage opportunity sharing" records, with the anonymised card text.
    expect(stored.public_task_listing).toMatchObject({ enabled: true, consentVersion: listingConsentVersion,
      approvedBy: "signed_owner_link", details: { title: "Carton palletizing opportunity", opportunity: "open" } });
    expect(JSON.stringify(stored.public_task_listing)).not.toMatch(/conveyor/);
    expect(sendSlackMessage).toHaveBeenCalledTimes(1);
    const bell = (sendSlackMessage.mock.calls[0] as unknown as [string])[0];
    expect(bell).toContain("`req-1`");
    expect(bell).not.toMatch(/owner@example\.com|conveyor/);
    // The site hears its card went live, once, through the outbox.
    expect(enqueueOutbox.mock.calls.filter(call => (call as unknown as [{ kind: string }])[0].kind === "listing_live")).toHaveLength(1);

    const second = await ask();
    expect(second.body).toEqual({ ok: true, requestedAtIso: first.body.requestedAtIso, listed: true });
    expect(sendSlackMessage).toHaveBeenCalledTimes(1);
    expect(row("inboundRequests/req-1").public_task_listing.approvedAtIso).toBe(stored.public_task_listing.approvedAtIso);
  });

  it("leaves a card that is already on as it is", async () => {
    const listing = { enabled: true, details: { title: "The owner's own reviewed card" }, consentVersion: listingConsentVersion,
      approvedAtIso: "2026-11-01T00:00:00.000Z" };
    row("inboundRequests/req-1").public_task_listing = listing;
    expect((await ask()).body).toMatchObject({ ok: true, listed: true });
    expect(row("inboundRequests/req-1").public_task_listing).toEqual(listing);
  });

  it("still records the request when the card cannot be turned on", async () => {
    row("inboundRequests/req-1").request.buyerType = "robot_team";
    const response = await ask();
    expect(response.body).toEqual({ ok: true, requestedAtIso: expect.any(String), listed: false });
    expect(row("inboundRequests/req-1").introduction_request.requested_at_iso).toBe(response.body.requestedAtIso);
    expect(row("inboundRequests/req-1").public_task_listing).toBeUndefined();
    expect(sendSlackMessage).toHaveBeenCalledTimes(1);
  });
});
