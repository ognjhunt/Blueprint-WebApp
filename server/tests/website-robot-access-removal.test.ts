// @vitest-environment node
/**
 * Moving chairs out of the robot's way in a website job's simulation, only
 * with the job owner's approval on the job page. The Pipeline sends the
 * proposal over its signed sync transport; only the owner link sees it and
 * decides; every decision is appended and bound to the exact proposal digest,
 * revision and removal binding; no decision means no change. OFFLINE: the real
 * routes against the fake Firestore.
 */
import { createServer, type Server } from "node:http";
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crossRuntimeArtifactDigest } from "../utils/crossRuntimeCanonical";
import { buildPipelineSyncSignature } from "../utils/pipelineSyncSecurity";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";
import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

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
vi.mock("../utils/captureOutbox", () => ({ enqueueOutbox: vi.fn(async () => ({ enqueued: true })),
  deliverOutbox: vi.fn(async () => ({ examined: 0, sent: 0, failed: 0, exhausted: 0 })) }));
vi.mock("../utils/pipelineSyncSecurity", async importOriginal => ({
  ...await importOriginal<typeof import("../utils/pipelineSyncSecurity")>(),
  createPipelineSyncRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const briefRouter = (await import("../routes/site-task-brief")).default;
const internalRouter = (await import("../routes/internal-robot-access-proposal")).default;
const { createCaptureUploadToken } = await import("../utils/captureUploadToken");
const { describeRobotAccessProposal, robotAccessProposalSchema, ROBOT_ACCESS_PROPOSAL_SCHEMA } =
  await import("../utils/websiteRobotAccessRemoval");

const SECRET = "test-only-robot-access-signature";
const sha = (character: string) => `sha256:${character.repeat(64)}`;
const INTAKE = "taskEvaluationSceneIntakes/scene-intake-1";
const row = (key: string) => sharedFakeFirestoreState.docs.get(key);
const CHAIR = { target_id: "chair-east-1", label: "dining chair by the window", kind: "chair" as const };
// The scene review's own grouped entry, as capture-447's review names its chairs.
const MEASURE_ITEM = { target_id: "dining_chairs", label: "dining_chairs", kind: "chair" as const };

function proposal(changes: Record<string, unknown> = {}) {
  const value = { schema_version: ROBOT_ACCESS_PROPOSAL_SCHEMA, intent_id: "scene-one", intent_digest: sha("a"),
    task_id: "website-0123456789abcdef0123", configured_scene_revision_digest: sha("b"), question: "move",
    binding_digest: sha("c"), items: [CHAIR], support_label: "wooden dining table", reason: "no_ranked_stance_carries",
    appearance: "unchanged", maximum_cost_usd: null, ...changes };
  return { ...value, proposal_digest: crossRuntimeArtifactDigest(value as Record<string, unknown>, "proposal_digest") };
}

const measure = (changes: Record<string, unknown> = {}) => proposal({ question: "measure", binding_digest: sha("d"),
  items: [MEASURE_ITEM], maximum_cost_usd: 0.4, ...changes });

let server: Server;
let baseUrl: string;
const owner = () => createCaptureUploadToken({ requestId: "req-1", captureId: "cap-1", sceneId: "scene-1" });
const film = () => createCaptureUploadToken({ requestId: "req-1", captureId: "cap-1", sceneId: "scene-1", scope: "film" });

async function notify(value: unknown, options: { intent?: string; signed?: boolean } = {}) {
  const text = JSON.stringify(value), timestamp = new Date().toISOString();
  const response = await fetch(`${baseUrl}/api/internal/pipeline/task-evaluation-scene-intents/${options.intent ?? "scene-one"}/robot-access-proposal`, {
    method: "POST", body: text, headers: { "content-type": "application/json", ...(options.signed === false ? {} : {
      "X-Blueprint-Pipeline-Timestamp": timestamp,
      "X-Blueprint-Pipeline-Signature": buildPipelineSyncSignature({ secret: SECRET, timestamp, body: text }) }) } });
  return { status: response.status, body: await response.json() };
}
async function decide(body: unknown, token = owner(), csrf = true) {
  const response = await fetch(`${baseUrl}/api/site-task-brief/${token}/robot-access`, {
    method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json",
      ...(csrf ? { cookie: "csrf_token=robot-access-test", "x-csrf-token": "robot-access-test" } : {}) } });
  return { status: response.status, body: await response.json() };
}
async function status(token = owner()) {
  const response = await fetch(`${baseUrl}/api/site-task-brief/${token}/status`);
  return { status: response.status, body: await response.json() };
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubEnv("PIPELINE_SYNC_TOKEN", SECRET); vi.stubEnv("PIPELINE_SYNC_ALLOW_LEGACY_BEARER", "false");
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
    request: { buyerType: "site_operator", capture_mode: "self_capture", siteTaskGates: {}, consent_attestation: {
      granted: true, statement_version: RECORDING_CONSENT_VERSION, recorded_at_iso: "2026-10-26T11:00:00.000Z" } } });
  sharedFakeFirestoreState.docs.set("captureUploadSessions/cap-1", { website_preparation: { selector: {} } });
  sharedFakeFirestoreState.docs.set(INTAKE, { website_request_id: "req-1", source_session_id: "cap-1", state: "completed",
    created_at_iso: "2026-11-01T00:00:00.000Z", owner_user_id: "blueprint",
    request: { owner: { user_id: "blueprint", organization_id: "blueprint-operations" }, task: { task_id: "website-1" } },
    receipt: { intent_id: "scene-one", intent_digest: sha("a") } });
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
});

describe("the Pipeline's signed proposal", () => {
  it("accepts a proposal the Pipeline sealed, byte for byte", () => {
    // Sealed by the Pipeline's own robot_access_furniture.proposal_notice (cross-runtime canonical digest).
    const sealedByPipeline = { schema_version: "website_robot_access_proposal.v1", intent_id: "scene-one",
      intent_digest: sha("a"), task_id: "website-0123456789abcdef0123", configured_scene_revision_digest: sha("b"),
      question: "move", binding_digest: sha("c"), items: [CHAIR], support_label: "wooden dining table",
      reason: "no_ranked_stance_carries", appearance: "unchanged", maximum_cost_usd: null,
      proposal_digest: "sha256:943d7190f9249381976770cf1205ef3e8a8a78de6b7b6f776f17d68ecdcd3e0c" };
    expect(robotAccessProposalSchema.safeParse(sealedByPipeline).success).toBe(true);
    expect(proposal().proposal_digest).toBe(sealedByPipeline.proposal_digest);
    // The measurement question carries its cost, and the Pipeline's digest of that number is the WebApp's.
    const measureByPipeline = { ...sealedByPipeline, question: "measure", binding_digest: sha("d"),
      items: [MEASURE_ITEM], maximum_cost_usd: 0.4,
      proposal_digest: "sha256:c03dba5630d092c698b1060be41401219471f9fb30f02c11c97ec473161a1c8f" };
    expect(robotAccessProposalSchema.safeParse(measureByPipeline).success).toBe(true);
    expect(measure().proposal_digest).toBe(measureByPipeline.proposal_digest);
  });

  it("is kept append-only and answered pending until the owner decides", async () => {
    const first = proposal();
    expect(await notify(first)).toEqual({ status: 200, body: { schema_version: "website_robot_access_proposal_receipt.v1",
      status: "pending", intent_id: "scene-one", proposal_digest: first.proposal_digest, decision: null } });
    const kept = structuredClone(row(INTAKE));
    expect(kept.robot_access_proposal_current).toBe(first.proposal_digest);
    expect(kept.robot_access_proposals).toHaveLength(1);
    expect(JSON.parse(kept.robot_access_proposals[0].proposal_json)).toEqual(first);
    expect((await notify(first)).body.status).toBe("pending");
    expect(row(INTAKE)).toEqual(kept);
  });

  it.each([
    ["no signature", (value: any) => notify(value, { signed: false }), 401],
    ["another path intent", (value: any) => notify(value, { intent: "scene-two" }), 400],
    ["another item under the same digest", (value: any) => notify({ ...value, items: [{ ...CHAIR, kind: "stool" }] }), 400],
    ["a wall, which is never movable furniture", (value: any) => notify(proposal({ items: [{ ...CHAIR, kind: "wall" }] })), 400],
    ["the item's measured bounds", (value: any) => notify({ ...value, bounds_world_m: { minimum: [0, 0, 0], maximum: [1, 1, 1] } }), 400],
    ["no items at all", () => notify(proposal({ items: [] })), 400],
  ])("refuses %s before any write", async (_name, send, code) => {
    expect((await send(proposal())).status).toBe(code);
    expect(row(INTAKE).robot_access_proposals).toBeUndefined();
  });

  it.each([
    ["revoked consent", () => { row("inboundRequests/req-1").request.consent_attestation.revoked_at_iso = "2026-11-02T00:00:00Z"; },
      "website_robot_access_consent_revoked"],
    ["a withdrawn capture", () => { row("inboundRequests/req-1").capture_withdrawal = { requested_at_iso: "2026-11-02T00:00:00Z" }; },
      "website_robot_access_capture_withdrawn"],
    ["a revoked intent", () => { row(INTAKE).revocation_requested = true; }, "website_robot_access_intent_revoked"],
    ["another intent digest", () => { row(INTAKE).receipt.intent_digest = sha("9"); }, "website_robot_access_intent_mismatch"],
    ["a job that is not a website job", () => { delete row(INTAKE).website_request_id; }, "website_robot_access_not_a_website_job"],
  ])("refuses %s and writes nothing", async (_name, mutate, code) => {
    mutate();
    const before = structuredClone(row(INTAKE));
    expect(await notify(proposal())).toEqual({ status: 409, body: { code } });
    expect(row(INTAKE)).toEqual(before);
  });

  it("returns 404 for an unknown intent", async () => {
    expect(await notify(proposal({ intent_id: "scene-two" }), { intent: "scene-two" }))
      .toEqual({ status: 404, body: { code: "website_robot_access_intake_unavailable" } });
  });
});

describe("the owner's decision on the job page", () => {
  it("shows the owner the chair in plain words, records a bound approval, and the Pipeline reads it", async () => {
    const current = proposal();
    await notify(current);
    const shown = (await status()).body.robotAccess;
    expect(shown).toMatchObject({ proposalDigest: current.proposal_digest, decision: null, what: "1 chair",
      question: "move",
      ask: "To give the robot room, Blueprint would move 1 chair away from the wooden dining table in the simulation. Approve?",
      why: "In the simulation of your site, the robot arm can't stand close enough to reach the job. 1 chair is in the way.",
      items: ["dining chair by the window"], approve: "Move it in the simulation", decline: "Keep it where it is" });
    expect(shown.note).toMatch(/^Only the simulation changes; your site and your video stay as they are\. The chair may still show/);
    expect(JSON.stringify(shown)).not.toContain("binding_digest");
    // A film link sees nothing and cannot decide; a missing CSRF token is refused; nothing else is a field.
    expect((await status(film())).body.robotAccess ?? null).toBeNull();
    expect((await decide({ proposalDigest: current.proposal_digest, decision: "approve" }, film())).status).toBe(403);
    expect((await decide({ proposalDigest: current.proposal_digest, decision: "approve" }, owner(), false)).status).toBe(403);
    expect((await decide({ proposalDigest: current.proposal_digest, decision: "approve", items: ["wall"] })).status).toBe(400);
    expect(row(INTAKE).robot_access_decisions).toBeUndefined();
    const approved = await decide({ proposalDigest: current.proposal_digest, decision: "approve" });
    expect(approved).toMatchObject({ status: 200, body: { ok: true, decision: "approved" } });
    const [decision] = row(INTAKE).robot_access_decisions;
    expect(decision).toMatchObject({ schema_version: "website_robot_access_decision.v1", intent_id: "scene-one",
      intent_digest: sha("a"), request_id: "req-1", capture_id: "cap-1", proposal_digest: current.proposal_digest,
      configured_scene_revision_digest: sha("b"), question: "move", binding_digest: sha("c"), decision: "approved",
      decided_via: "owner_job_link" });
    expect(decision.decision_digest).toBe(crossRuntimeArtifactDigest(decision, "decision_digest"));
    expect((await notify(current)).body).toMatchObject({ status: "approved", decision });
    expect((await status()).body.robotAccess.decision).toMatchObject({ kind: "approved" });
    // An approval is final: repeating it changes nothing; declining afterwards is refused.
    expect((await decide({ proposalDigest: current.proposal_digest, decision: "approve" })).status).toBe(200);
    expect((await decide({ proposalDigest: current.proposal_digest, decision: "decline" })).status).toBe(409);
    expect(row(INTAKE).robot_access_decisions).toEqual([decision]);
  });

  it("keeps the chair where it is on a decline, which holds the job, and the owner may still approve", async () => {
    const current = proposal();
    await notify(current);
    const declined = await decide({ proposalDigest: current.proposal_digest, decision: "decline" });
    expect(declined).toMatchObject({ status: 200, body: { ok: true, decision: "declined" } });
    expect((await notify(current)).body).toMatchObject({ status: "declined", decision: { decision: "declined" } });
    const shown = (await status()).body.robotAccess;
    expect(shown.decision).toMatchObject({ kind: "declined" });
    expect(shown.declined).toBe("You chose to keep 1 chair where it is. The robot can't stand within reach, so this job is "
      + "on hold. You can still approve if you change your mind.");
    expect(JSON.parse(row(INTAKE).robot_access_proposals[0].proposal_json)).toEqual(current);
    expect((await decide({ proposalDigest: current.proposal_digest, decision: "approve" })).body.decision).toBe("approved");
    expect(row(INTAKE).robot_access_decisions.map((value: { decision: string }) => value.decision))
      .toEqual(["declined", "approved"]);
    expect((await notify(current)).body.status).toBe("approved");
  });

  it("refuses a decision on a stale proposal and asks again when the proposal changes", async () => {
    const first = proposal();
    await notify(first);
    expect((await decide({ proposalDigest: first.proposal_digest, decision: "approve" })).status).toBe(200);
    // The scene is republished: another binding, another proposal, with no decision yet.
    const second = proposal({ configured_scene_revision_digest: sha("7"), binding_digest: sha("8"),
      items: [CHAIR, { target_id: "stool-2", label: "bar stool", kind: "stool" }] });
    expect((await notify(second)).body).toMatchObject({ status: "pending", proposal_digest: second.proposal_digest, decision: null });
    expect((await status()).body.robotAccess).toMatchObject({ proposalDigest: second.proposal_digest, decision: null,
      what: "1 chair and 1 stool", approve: "Move them in the simulation", decline: "Keep them where they are" });
    expect(await decide({ proposalDigest: first.proposal_digest, decision: "approve" })).toMatchObject({
      status: 409, body: { code: "website_robot_access_proposal_changed" } });
    expect(row(INTAKE).robot_access_decisions).toHaveLength(1);
    expect((await decide({ proposalDigest: second.proposal_digest, decision: "approve" })).status).toBe(200);
    expect((await notify(second)).body.decision.proposal_digest).toBe(second.proposal_digest);
  });

  it("refuses a decision once consent is withdrawn", async () => {
    const current = proposal();
    await notify(current);
    row("inboundRequests/req-1").request.consent_attestation.revoked_at_iso = "2026-11-02T00:00:00Z";
    expect((await decide({ proposalDigest: current.proposal_digest, decision: "approve" })).status).toBe(409);
    expect(row(INTAKE).robot_access_decisions).toBeUndefined();
    expect((await status()).body.robotAccess ?? null).toBeNull();
  });
});

describe("the first question: may Blueprint measure the chairs", () => {
  it("names its own bounded cost, says the site is not charged, and a decline holds the job", async () => {
    const current = measure();
    expect((await notify(current)).body.status).toBe("pending");
    const shown = (await status()).body.robotAccess;
    expect(shown).toMatchObject({ proposalDigest: current.proposal_digest, question: "measure", decision: null,
      what: "chairs", items: ["dining chairs"], approve: "Measure the chairs", decline: "Not now",
      ask: "Blueprint would measure the chairs in your video (at most $0.40 of Blueprint's own processing; you are not "
        + "charged) so it can propose moving one. Approve?",
      why: "In the simulation of your site, the robot arm can't stand close enough to reach the job. The chairs around "
        + "the wooden dining table may be in the way." });
    expect(shown.note).toBe("Measuring changes nothing in the simulation. If moving one would give the robot room, "
      + "Blueprint asks you first.");
    // Not now: recorded, bound to the measurement, and the Pipeline reads it as a hold.
    expect((await decide({ proposalDigest: current.proposal_digest, decision: "decline" })).body.decision).toBe("declined");
    const [declined] = row(INTAKE).robot_access_decisions;
    expect(declined).toMatchObject({ question: "measure", binding_digest: sha("d"), decision: "declined" });
    expect((await notify(current)).body).toMatchObject({ status: "declined", decision: declined });
    expect((await status()).body.robotAccess.declined).toBe("You chose not to measure the chairs. The robot can't stand "
      + "within reach, so this job is on hold. You can still approve if you change your mind.");
    // Then approves; the next question (moving one chair) is a new proposal with no decision yet.
    expect((await decide({ proposalDigest: current.proposal_digest, decision: "approve" })).body.decision).toBe("approved");
    expect((await notify(current)).body.status).toBe("approved");
    const next = proposal();
    expect((await notify(next)).body).toMatchObject({ status: "pending", decision: null });
    expect((await status()).body.robotAccess).toMatchObject({ question: "move", decision: null });
  });

  it.each([
    ["a measurement without its cost", () => measure({ maximum_cost_usd: null })],
    ["a move with a cost", () => proposal({ maximum_cost_usd: 0.4 })],
    ["a cost above the bound", () => measure({ maximum_cost_usd: 5.01 })],
    ["a free measurement", () => measure({ maximum_cost_usd: 0 })],
  ])("refuses %s before any write", async (_name, make) => {
    expect((await notify(make())).status).toBe(400);
    expect(row(INTAKE).robot_access_proposals).toBeUndefined();
  });
});

describe("plain words", () => {
  it("counts each kind and names each item as the analysis did", () => {
    const words = describeRobotAccessProposal(proposal({ support_label: "the kitchen island",
      items: [CHAIR, { ...CHAIR, target_id: "chair-2", label: "chair" }, { target_id: "s", label: "stool", kind: "stool" }] }));
    expect(words.what).toBe("2 chairs and 1 stool");
    expect(words.ask).toBe("To give the robot room, Blueprint would move 2 chairs and 1 stool away from the kitchen island in the simulation. Approve?");
    expect(words.why).toMatch(/ 2 chairs and 1 stool are in the way\.$/);
    expect(words.items).toEqual(["dining chair by the window", "chair", "stool"]);
  });
});
