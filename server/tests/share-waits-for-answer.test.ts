// @vitest-environment node
/**
 * Sharing follows the job's outlook (review, 2026-11-11): the owner's card can be turned on only once the job has an
 * answer (a test result, the paper check after an ending, or another kind of job). While the video is read, the
 * simulation is built or the test runs, the route refuses with a typed code and writes nothing; a card already shared
 * stays shared and editable. An outlook that cannot be read for certain is "not yet", never a server error. The one
 * exception to the rule is the start form's explicit sharing consent, which publishes the card at intake
 * (`inbound-request.ts`), before any answer; this route never does. Its own file, because the listing router's rate
 * limit is per module.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return { dbAdmin: sharedFakeFirestore, storageAdmin: null, default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } } };
});
vi.mock("../utils/email", () => ({ sendEmail: vi.fn(async () => ({ sent: true, messageId: "fake", provider: "fake" })) }));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
const outlookPhase = vi.hoisted(() => ({ value: "building" as string, certain: true, fails: false }));
vi.mock("../utils/jobOutlook", async importOriginal => ({ ...await importOriginal<typeof import("../utils/jobOutlook")>(),
  loadJobOutlookDecision: vi.fn(async () => {
    if (outlookPhase.fails) throw new Error("job_outlook_unavailable");
    return { outlook: { phase: outlookPhase.value, reason: null, sentence: null }, certain: outlookPhase.certain };
  }) }));

const router = (await import("../routes/task-listings")).default;
const stateDocs = () => state.docs;
const { createCaptureUploadToken } = await import("../utils/captureUploadToken");
const details = { title: "Move cartons from conveyor to pallet", taskFamily: "Palletizing", region: "US Midwest", siteType: "Warehouse",
  objects: "Sealed cartons", cycleTarget: "12 seconds", pilotTiming: "October", pilotBudget: "", opportunity: "past" };
const record = (patch: Record<string, unknown> = {}) => ({
  requestId: "req1", contact: { email: "owner@example.test", firstName: "Sam" },
  request: { buyerType: "site_operator", capture_mode: "self_capture", siteTaskGates: {},
    consent_attestation: { granted: true, statement_version: "2026-09-18.v1", recorded_at_iso: "2026-09-19T00:00:00.000Z" } },
  site_task_triage: { disposition: "qualified" }, site_task_brief_confirmed_at: "2026-09-19T00:00:00.000Z", ...patch });

let server: Server; let base: string;
beforeEach(async () => {
  state.docs.clear();
  Object.assign(outlookPhase, { certain: true, fails: false });
  const app = express(); app.use(express.json({ limit: "1mb" })); app.use(router);
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterEach(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
const token = createCaptureUploadToken({ requestId: "req1", sceneId: "s", captureId: "c", scope: "owner" });
const post = (enabled: boolean) => fetch(`${base}/owner/${token}`, { method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ enabled, details, consent: true }) });

describe("sharing waits for the job's answer", () => {
  it.each(["reading", "building", "testing", "ended_by_site"])("refuses to turn a card on while the job is %s, writing nothing", async phase => {
    outlookPhase.value = phase;
    state.docs.set("inboundRequests/req1", record() as never);
    const refused = await post(true);
    expect(refused.status).toBe(409);
    // The refusal says which case it is; a job its owner closed is worded as closed (review, 2026-11-12).
    expect(await refused.json()).toMatchObject({ code: "share_waits_for_answer", phase,
      ...(phase === "ended_by_site" ? { reason: "job_closed", error: "This job is closed, so it cannot be shared." }
        : { reason: "packet_not_ready", error: "You can share your job once its job packet is ready." }) });
    expect((state.docs.get("inboundRequests/req1") as any).public_task_listing).toBeUndefined();
    expect([...state.docs.keys()].filter(key => key.startsWith("captureOutbox/"))).toEqual([]);
  });
  it.each([["uncertain", { certain: false, fails: false }], ["unreadable", { certain: true, fails: true }]] as const)(
    "refuses with the typed code, never a server error, when the outlook is %s", async (_label, given) => {
    outlookPhase.value = "no_test";
    Object.assign(outlookPhase, given);
    stateDocs().set("inboundRequests/req1", record() as never);
    const refused = await post(true);
    expect(refused.status).toBe(409);
    expect(await refused.json()).toMatchObject({ code: "share_waits_for_answer" });
    expect((stateDocs().get("inboundRequests/req1") as any).public_task_listing).toBeUndefined();
  });
  it.each(["result", "no_test", "cannot_match"])("turns a card on once the job is %s", async phase => {
    outlookPhase.value = phase;
    state.docs.set("inboundRequests/req1", record() as never);
    expect((await post(true)).status).toBe(200);
    expect((state.docs.get("inboundRequests/req1") as any).public_task_listing.enabled).toBe(true);
  });
  it.each(["building", "testing"])("keeps a card already shared editable while the job is %s, and lets it be switched off", async phase => {
    outlookPhase.value = phase;
    state.docs.set("inboundRequests/req1", record({ public_task_listing: { enabled: true, consentVersion: "public-task-card-v1",
      approvedAtIso: "2026-09-19T00:00:00.000Z", details } }) as never);
    expect((await post(true)).status).toBe(200);
    expect((state.docs.get("inboundRequests/req1") as any).public_task_listing.enabled).toBe(true);
    expect((await post(false)).status).toBe(200);
    expect((state.docs.get("inboundRequests/req1") as any).public_task_listing.enabled).toBe(false);
  });
});
