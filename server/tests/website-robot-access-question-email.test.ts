// @vitest-environment node
/**
 * The owner hears, once, that their job page asks whether to move chairs out
 * of the robot's way in the simulation. The outbox row is written in the same
 * transaction that makes a proposal the job's current one, keyed by its
 * digest, so a retry or replay is never a second email. Dispatch reads the job
 * page again: an answered, replaced, withdrawn or consent-revoked question is
 * cancelled, never sent. The page shows the question in the states a job is in
 * when the Pipeline asks it. OFFLINE: the real routes and the real outbox
 * against the fake Firestore; the email transport is a spy.
 */
import { createServer, type Server } from "node:http";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crossRuntimeArtifactDigest } from "../utils/crossRuntimeCanonical";
import { buildPipelineSyncSignature } from "../utils/pipelineSyncSecurity";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";
import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

const send = vi.hoisted(() => vi.fn());
const preparation = vi.hoisted(() => ({ read: vi.fn(async (): Promise<Record<string, unknown>> => ({
  state: "handed_off", correlationId: "bp-prep-1234567890abcdef" })) }));
vi.mock("../utils/websitePreparationStatus", () => ({ loadCurrentWebsitePreparationStatus: preparation.read,
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
vi.mock("../utils/email", () => ({ sendEmail: send }));
vi.mock("../utils/field-encryption", () => ({ decryptFieldValue: vi.fn(async (value: string) => value.replace(/^encrypted:/, "")) }));
vi.mock("../utils/pipelineSyncSecurity", async importOriginal => ({
  ...await importOriginal<typeof import("../utils/pipelineSyncSecurity")>(),
  createPipelineSyncRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const briefRouter = (await import("../routes/site-task-brief")).default;
const internalRouter = (await import("../routes/internal-robot-access-proposal")).default;
const { createCaptureUploadToken } = await import("../utils/captureUploadToken");
const { deliverOutbox } = await import("../utils/captureOutbox");
const { buildTaskLifecycleNotification } = await import("../utils/taskLifecycleNotifications");
const { ROBOT_ACCESS_PROPOSAL_SCHEMA } = await import("../utils/websiteRobotAccessRemoval");

const SECRET = "test-only-robot-access-email-signature";
const sha = (character: string) => `sha256:${character.repeat(64)}`;
// The job's own walkthrough capture: the one its owner link and its emails' dispatch check read.
const CAPTURE = "walkthrough-req-1";
const INTAKE = "taskEvaluationSceneIntakes/scene-intake-1";
const row = (key: string) => sharedFakeFirestoreState.docs.get(key);
const CHAIR = { target_id: "chair-east-1", label: "dining chair by the window", kind: "chair" as const };
const STOOL = { target_id: "stool-2", label: "bar stool", kind: "stool" as const };

function proposal(changes: Record<string, unknown> = {}) {
  const value = { schema_version: ROBOT_ACCESS_PROPOSAL_SCHEMA, intent_id: "scene-one", intent_digest: sha("a"),
    task_id: "website-0123456789abcdef0123", configured_scene_revision_digest: sha("b"), binding_digest: sha("c"),
    items: [CHAIR], support_label: "wooden dining table", reason: "no_ranked_stance_carries", appearance: "unchanged",
    ...changes };
  return { ...value, proposal_digest: crossRuntimeArtifactDigest(value as Record<string, unknown>, "proposal_digest") };
}
const questionKey = (digest: string) => `captureOutbox/req-1:robot_access_question:${digest.slice(7)}`;
// Queued emails only, not their delivery receipts.
const questions = () => [...sharedFakeFirestoreState.docs.keys()]
  .filter(key => /^captureOutbox\/req-1:robot_access_question:[a-f0-9]{64}$/.test(key));

let server: Server;
let baseUrl: string;
const owner = () => createCaptureUploadToken({ requestId: "req-1", captureId: CAPTURE, sceneId: "site-req-1" });
const film = () => createCaptureUploadToken({ requestId: "req-1", captureId: CAPTURE, sceneId: "site-req-1", scope: "film" });

async function notify(value: unknown) {
  const text = JSON.stringify(value), timestamp = new Date().toISOString();
  const response = await fetch(`${baseUrl}/api/internal/pipeline/task-evaluation-scene-intents/scene-one/robot-access-proposal`, {
    method: "POST", body: text, headers: { "content-type": "application/json", "X-Blueprint-Pipeline-Timestamp": timestamp,
      "X-Blueprint-Pipeline-Signature": buildPipelineSyncSignature({ secret: SECRET, timestamp, body: text }) } });
  return { status: response.status, body: await response.json() };
}
async function decide(body: unknown) {
  const response = await fetch(`${baseUrl}/api/site-task-brief/${owner()}/robot-access`, {
    method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json",
      cookie: "csrf_token=robot-access-test", "x-csrf-token": "robot-access-test" } });
  return { status: response.status, body: await response.json() };
}
async function status(token = owner()) {
  const response = await fetch(`${baseUrl}/api/site-task-brief/${token}/status`);
  return { status: response.status, body: await response.json() };
}

beforeEach(async () => {
  vi.clearAllMocks();
  send.mockReset().mockResolvedValue({ sent: true, provider: "resend", messageId: "accepted" });
  preparation.read.mockResolvedValue({ state: "handed_off", correlationId: "bp-prep-1234567890abcdef" });
  vi.stubEnv("PIPELINE_SYNC_TOKEN", SECRET); vi.stubEnv("PIPELINE_SYNC_ALLOW_LEGACY_BEARER", "false");
  vi.stubEnv("APP_URL", "https://tryblueprint.io"); vi.stubEnv("VITE_PUBLIC_APP_URL", "");
  sharedFakeFirestoreState.docs.clear();
  const app = express();
  app.use(express.json({ verify: (req, _res, buffer) => { (req as { rawBody?: string }).rawBody = buffer.toString("utf8"); } }));
  app.use("/api/site-task-brief", briefRouter);
  app.use("/api/internal/pipeline", internalRouter);
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  sharedFakeFirestoreState.docs.set("inboundRequests/req-1", { requestId: "req-1",
    contact: { email: "encrypted:owner@example.com" },
    request: { buyerType: "site_operator", capture_mode: "self_capture", siteTaskGates: {}, consent_attestation: {
      granted: true, statement_version: RECORDING_CONSENT_VERSION, recorded_at_iso: "2026-10-26T11:00:00.000Z" } } });
  sharedFakeFirestoreState.docs.set(`captureUploadSessions/${CAPTURE}`, { website_preparation: { selector: {} } });
  sharedFakeFirestoreState.docs.set(INTAKE, { website_request_id: "req-1", source_session_id: CAPTURE, state: "completed",
    created_at_iso: "2026-11-01T00:00:00.000Z", owner_user_id: "blueprint",
    request: { owner: { user_id: "blueprint", organization_id: "blueprint-operations" }, task: { task_id: "website-1" } },
    receipt: { intent_id: "scene-one", intent_digest: sha("a") } });
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
});

describe("the owner's email about the question", () => {
  it("is queued once when a proposal becomes current, sent once, and never again on a replay", async () => {
    const current = proposal();
    expect((await notify(current)).body.status).toBe("pending");
    const queued = row(questionKey(current.proposal_digest));
    expect(queued).toMatchObject({ kind: "robot_access_question", requestId: "req-1", to: "owner@example.com",
      status: "pending", subject: "The simulation of your site needs one decision", replyTo: "hello@tryblueprint.io" });
    // Bare bones (2026-11-11): the subject is the question; the body is the page's sentence and the two choices.
    expect(queued.body.startsWith("In the simulation, the robot arm can't stand close enough to reach the job because 1 chair is in the way.")).toBe(true);
    expect(queued.body).toContain('choose "Move it in the simulation" or "Keep it where it is"');
    // The link is the owner's private job page, from the same helper every owner email uses.
    expect(queued.body).toMatch(/\n\nChoose on your job page:\nhttps:\/\/tryblueprint\.io\/capture-upload\/[^\s]+\n\n\[fine\] Results stay estimates, not a physical test\.$/);
    // No figure, cost or internal budget step reaches the site; nor the scene analysis's own labels.
    expect(`${queued.subject} ${queued.body}`).not.toMatch(/\$|\bUSD\b|cost|budget|spend|price|fee|reserv|measur/i);
    expect(queued.body).not.toContain("dining chair by the window");
    // The page says the same thing in the same words.
    expect(queued.body).toContain(`because ${(await status()).body.robotAccess.what} is in the way`);

    await deliverOutbox();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ to: "owner@example.com", subject: "The simulation of your site needs one decision" });
    expect(row(questionKey(current.proposal_digest)).status).toBe("sent");

    // The Pipeline asks again on every check while the question is open, and retries a lost receipt.
    expect((await notify(current)).body.status).toBe("pending");
    expect((await notify(current)).body.status).toBe("pending");
    await deliverOutbox();
    expect(questions()).toHaveLength(1);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("is one email per proposal digest: a new proposal is asked again, a returning one is not", async () => {
    const first = proposal();
    const second = proposal({ configured_scene_revision_digest: sha("7"), binding_digest: sha("8"), items: [CHAIR, STOOL] });
    await notify(first);
    await deliverOutbox();
    await notify(second);
    expect(row(questionKey(second.proposal_digest)).body)
      .toContain("because 1 chair and 1 stool are in the way.");
    expect(row(questionKey(second.proposal_digest)).body)
      .toContain('choose "Move them in the simulation" or "Keep them where they are"');
    await deliverOutbox();
    expect(send).toHaveBeenCalledTimes(2);
    // The Pipeline goes back to the first proposal: the owner was already told about it.
    expect((await notify(first)).body.status).toBe("pending");
    await deliverOutbox();
    expect(questions()).toHaveLength(2);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("cancels a queued question the page no longer asks: answered, or replaced before it went out", async () => {
    const first = proposal();
    await notify(first);
    // Replaced by a newer proposal before the pump ran: only the current question is sent.
    const second = proposal({ binding_digest: sha("8") });
    await notify(second);
    await deliverOutbox();
    expect(send).toHaveBeenCalledTimes(1);
    expect(row(questionKey(first.proposal_digest)).status).toBe("cancelled");
    expect(row(questionKey(second.proposal_digest)).status).toBe("sent");
    // Answered on the page before its email went out: nothing to ask any more.
    const third = proposal({ binding_digest: sha("9") });
    await notify(third);
    expect((await decide({ proposalDigest: third.proposal_digest, decision: "decline" })).status).toBe(200);
    await deliverOutbox();
    expect(send).toHaveBeenCalledTimes(1);
    expect(row(questionKey(third.proposal_digest)).status).toBe("cancelled");
    // An answered proposal the Pipeline sends again is never queued.
    const fourth = proposal({ binding_digest: sha("d") });
    await notify(fourth);
    expect((await decide({ proposalDigest: fourth.proposal_digest, decision: "approve" })).status).toBe(200);
    sharedFakeFirestoreState.docs.delete(questionKey(fourth.proposal_digest));
    expect((await notify(fourth)).body.status).toBe("approved");
    expect(row(questionKey(fourth.proposal_digest))).toBeUndefined();
  });

  it.each([
    ["consent was revoked", () => { row("inboundRequests/req-1").request.consent_attestation.revoked_at_iso = "2026-11-02T00:00:00Z"; },
      "website_robot_access_consent_revoked"],
    ["the capture was withdrawn", () => { row("inboundRequests/req-1").capture_withdrawal = { requestedAtIso: "2026-11-02T00:00:00Z" }; },
      "website_robot_access_capture_withdrawn"],
  ])("never emails once %s, whether before dispatch or before the proposal", async (_name, withdraw, code) => {
    const queuedFirst = proposal();
    await notify(queuedFirst);
    expect(row(questionKey(queuedFirst.proposal_digest)).status).toBe("pending");
    withdraw();
    await deliverOutbox();
    expect(send).not.toHaveBeenCalled();
    expect(row(questionKey(queuedFirst.proposal_digest)).status).toBe("cancelled");
    // A proposal that arrives afterwards is refused, and nothing is queued for it.
    const later = proposal({ binding_digest: sha("8") });
    expect(await notify(later)).toEqual({ status: 409, body: { code } });
    expect(row(questionKey(later.proposal_digest))).toBeUndefined();
    await deliverOutbox();
    expect(send).not.toHaveBeenCalled();
  });

  it("keeps the question on the page without an address on file, and emails once when one is", async () => {
    delete row("inboundRequests/req-1").contact;
    const current = proposal();
    expect((await notify(current)).body.status).toBe("pending");
    expect(questions()).toHaveLength(0);
    expect((await status()).body.robotAccess.proposalDigest).toBe(current.proposal_digest);
    row("inboundRequests/req-1").contact = { email: "encrypted:owner@example.com" };
    await notify(current);
    await notify(current);
    await deliverOutbox();
    expect(questions()).toHaveLength(1);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("is built only from typed counts and the proposal digest", () => {
    const base = { requestId: "req-1", milestone: "robot_access_question" as const, to: "owner@example.com" };
    expect(() => buildTaskLifecycleNotification({ ...base, eventId: "a".repeat(64) })).toThrow("robot_access_question_notice_invalid");
    expect(() => buildTaskLifecycleNotification({ ...base, eventId: "not-a-digest", robotAccessCounts: { chair: 1, stool: 0 } }))
      .toThrow("robot_access_question_notice_invalid");
    expect(() => buildTaskLifecycleNotification({ ...base, eventId: "a".repeat(64), robotAccessCounts: { chair: 0, stool: 0 } }))
      .toThrow("robot_access_question_notice_invalid");
    expect(() => buildTaskLifecycleNotification({ ...base, eventId: "a".repeat(64), robotAccessCounts: { chair: 5, stool: 0 } }))
      .toThrow("robot_access_question_notice_invalid");
    const two = buildTaskLifecycleNotification({ ...base, eventId: "a".repeat(64), robotAccessCounts: { chair: 2, stool: 0 } });
    expect(two.idempotencyKey).toBe(`req-1:robot_access_question:${"a".repeat(64)}`);
    expect(two.body).toContain("because 2 chairs are in the way.");
  });
});

describe("the question on the owner's job page", () => {
  // Past hand-off, often while its candidates are screened, the live preparation read can also fail to confirm
  // in time ("unavailable"); the question it was emailed about must still show.
  it.each(["handed_off", "unavailable"])("shows the question while the preparation read says %s", async state => {
    preparation.read.mockResolvedValue({ state, correlationId: state === "unavailable" ? null : "bp-prep-1234567890abcdef" });
    const current = proposal();
    await notify(current);
    expect((await status()).body.robotAccess).toMatchObject({ proposalDigest: current.proposal_digest, decision: null,
      what: "1 chair", approve: "Move it in the simulation", decline: "Keep it where it is" });
    expect((await status(film())).body.robotAccess ?? null).toBeNull();
  });

  it("hides it once the preparation's authority ended or consent is withdrawn", async () => {
    await notify(proposal());
    preparation.read.mockResolvedValue({ state: "authority_ended", correlationId: "bp-prep-1234567890abcdef" });
    expect((await status()).body.robotAccess ?? null).toBeNull();
    preparation.read.mockResolvedValue({ state: "handed_off", correlationId: "bp-prep-1234567890abcdef" });
    row("inboundRequests/req-1").request.consent_attestation.revoked_at_iso = "2026-11-02T00:00:00Z";
    expect((await status()).body.robotAccess ?? null).toBeNull();
  });
});
