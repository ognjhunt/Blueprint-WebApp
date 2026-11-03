// @vitest-environment node
/**
 * A website job's proposed success thresholds, confirmed by the job's owner on
 * the job page. The Pipeline sends the proposal over its signed sync
 * transport; only the owner link sees it and decides; every decision is
 * appended and bound to the exact proposal digest and revision; a changed
 * proposal needs a fresh decision. OFFLINE: the real routes against the fake
 * Firestore.
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
    // No recording stored: the status still reads, as for a job whose video another device sent.
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
const internalRouter = (await import("../routes/internal-owner-success-proposal")).default;
const { createCaptureUploadToken } = await import("../utils/captureUploadToken");
const { describeOwnerSuccessThresholds, OWNER_SUCCESS_PROPOSAL_SCHEMA } = await import("../utils/websiteOwnerSuccessConfirmation");

const SECRET = "test-only-owner-success-signature";
const sha = (character: string) => `sha256:${character.repeat(64)}`;
const INTAKE = "taskEvaluationSceneIntakes/scene-intake-1";
const row = (key: string) => sharedFakeFirestoreState.docs.get(key);
// The thresholds a website pick-and-place job is built with, as the Pipeline sends them.
const CRITERIA = {
  authority: "deterministic_simulator_state", collision_failure_minimum_force_n: 1.0, drop_events_allowed: false,
  drop_minimum_fall_m: 0.02, forbidden_collision_allowed: false,
  forbidden_contact_classes: ["robot_background", "robot_object", "object_background"],
  joint_limit_violation_allowed: false, maximum_final_planar_target_error_m: 0.05, maximum_regrasps: 0,
  maximum_retries: 0, maximum_task_contact_force_n: 100.0, minimum_lift_m: 0.05, minimum_planar_displacement_m: 0.1,
  object_must_rest_on_destination_support: true, owner_success_contract_required: true, per_cell_controls_required: true,
  release_required: true, retreat_clearance_m: 0.05, retreat_clearance_required: true,
  robot_workspace_position_bounds_world_m: { maximum: [5.5, -0.3999999999999999, 2.2545], minimum: [1.5, -10.5, -1.0] },
  surface_target: { maximum_angular_speed_rad_s: 0.1, maximum_linear_speed_m_s: 0.02, maximum_tilt_rad: 0.2617993877991494,
    non_colliding: true, radius_m: 0.15, schema_version: "task_evaluation_surface_target.v1", shape: "flat_green_disc",
    stable_seconds: 1.0, support_prim_path: "/Root/Support", support_source_instance_id: "support",
    surface_position_world_m: [3.2742285, -6.7605156, 0.7545], target_digest: sha("e"), visible_label: "green spot" },
  target_center_xyz_m: [3.2742285, -6.7605156, 0.818319], whole_subject_containment_required: true,
};

function proposal(changes: Record<string, unknown> = {}) {
  const value = { schema_version: OWNER_SUCCESS_PROPOSAL_SCHEMA, intent_id: "scene-one", intent_digest: sha("a"),
    task_id: "pick-book", configured_scene_revision_digest: sha("b"), configured_success_criteria: CRITERIA,
    configured_success_criteria_digest: sha("c"), proposal_authority_digest: sha("d"), binding_digest: sha("f"), ...changes };
  return { ...value, proposal_digest: crossRuntimeArtifactDigest(value as Record<string, unknown>, "proposal_digest") };
}

let server: Server;
let baseUrl: string;
const owner = () => createCaptureUploadToken({ requestId: "req-1", captureId: "cap-1", sceneId: "scene-1" });
const film = () => createCaptureUploadToken({ requestId: "req-1", captureId: "cap-1", sceneId: "scene-1", scope: "film" });

async function notify(value: unknown, options: { intent?: string; signed?: boolean } = {}) {
  const text = JSON.stringify(value), timestamp = new Date().toISOString();
  const response = await fetch(`${baseUrl}/api/internal/pipeline/task-evaluation-scene-intents/${options.intent ?? "scene-one"}/owner-success-proposal`, {
    method: "POST", body: text, headers: { "content-type": "application/json", ...(options.signed === false ? {} : {
      "X-Blueprint-Pipeline-Timestamp": timestamp,
      "X-Blueprint-Pipeline-Signature": buildPipelineSyncSignature({ secret: SECRET, timestamp, body: text }) }) } });
  return { status: response.status, body: await response.json() };
}
async function decide(body: unknown, token = owner(), csrf = true) {
  const response = await fetch(`${baseUrl}/api/site-task-brief/${token}/success-thresholds`, {
    method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json",
      ...(csrf ? { cookie: "csrf_token=owner-success-test", "x-csrf-token": "owner-success-test" } : {}) } });
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
  it("is kept append-only and answered pending until the owner decides", async () => {
    const first = proposal();
    expect(await notify(first)).toEqual({ status: 200, body: { schema_version: "website_owner_success_proposal_receipt.v1",
      status: "pending", intent_id: "scene-one", proposal_digest: first.proposal_digest, decision: null } });
    const kept = structuredClone(row(INTAKE));
    expect(kept.owner_success_proposal_current).toBe(first.proposal_digest);
    expect(kept.owner_success_proposals).toHaveLength(1);
    expect(JSON.parse(kept.owner_success_proposals[0].proposal_json)).toEqual(first);
    // The same proposal again is a read: nothing is rewritten.
    expect((await notify(first)).body.status).toBe("pending");
    expect(row(INTAKE)).toEqual(kept);
  });

  it.each([
    ["no signature", (value: any) => notify(value, { signed: false }), 401],
    ["another path intent", (value: any) => notify(value, { intent: "scene-two" }), 400],
    ["a changed threshold under the same digest", (value: any) => notify({ ...value,
      configured_success_criteria: { ...CRITERIA, maximum_task_contact_force_n: 500 } }), 400],
    ["an extra field", (value: any) => notify({ ...value, max_total_spend_usd: 100 }), 400],
  ])("refuses %s before any write", async (_name, send, code) => {
    expect((await send(proposal())).status).toBe(code);
    expect(row(INTAKE).owner_success_proposals).toBeUndefined();
  });

  it.each([
    ["revoked consent", () => { row("inboundRequests/req-1").request.consent_attestation.revoked_at_iso = "2026-11-02T00:00:00Z"; },
      "website_owner_success_consent_revoked"],
    ["a withdrawn capture", () => { row("inboundRequests/req-1").capture_withdrawal = { requested_at_iso: "2026-11-02T00:00:00Z" }; },
      "website_owner_success_capture_withdrawn"],
    ["a revoked intent", () => { row(INTAKE).revocation_requested = true; }, "website_owner_success_intent_revoked"],
    ["another intent digest", () => { row(INTAKE).receipt.intent_digest = sha("9"); }, "website_owner_success_intent_mismatch"],
    ["a job that is not a website job", () => { delete row(INTAKE).website_request_id; }, "website_owner_success_not_a_website_job"],
  ])("refuses %s and writes nothing", async (_name, mutate, code) => {
    mutate();
    const before = structuredClone(row(INTAKE));
    expect(await notify(proposal())).toEqual({ status: 409, body: { code } });
    expect(row(INTAKE)).toEqual(before);
  });

  it("returns 404 for an unknown intent", async () => {
    expect(await notify(proposal({ intent_id: "scene-two" }), { intent: "scene-two" }))
      .toEqual({ status: 404, body: { code: "website_owner_success_intake_unavailable" } });
  });
});

describe("the owner's decision on the job page", () => {
  it("shows the owner the thresholds in plain words, records a bound confirmation, and the Pipeline reads it", async () => {
    const current = proposal();
    await notify(current);
    const shown = (await status()).body.successThresholds;
    expect(shown.proposalDigest).toBe(current.proposal_digest);
    expect(shown.decision).toBeNull();
    expect(shown.rows).toEqual(expect.arrayContaining([
      { label: "Goal area", value: "The green spot: a circle 30 cm across. The whole object has to end up inside it." },
      { label: "Force", value: "The robot pushes on the object with no more than 100 N (about the weight of 10 kg)." },
      { label: "Drops", value: "The object is never dropped." },
      { label: "Upright", value: "It ends tilted no more than 15°." },
    ]));
    // Every other value is listed as sent, so the owner confirms all of them knowingly.
    expect(shown.otherValues.map((value: { label: string }) => value.label)).toEqual(expect.arrayContaining(
      ["authority", "collision failure minimum force n", "robot workspace position bounds world m"]));
    expect(JSON.stringify(shown)).not.toContain("binding_digest");
    // A film link sees nothing and cannot decide; a missing CSRF token is refused.
    expect((await status(film())).body.successThresholds ?? null).toBeNull();
    expect((await decide({ proposalDigest: current.proposal_digest, decision: "confirm" }, film())).status).toBe(403);
    expect((await decide({ proposalDigest: current.proposal_digest, decision: "confirm" }, owner(), false)).status).toBe(403);
    expect(row(INTAKE).owner_success_decisions).toBeUndefined();
    // No number is a field.
    expect((await decide({ proposalDigest: current.proposal_digest, decision: "confirm", minimum_lift_m: 0.01 })).status).toBe(400);
    const confirmed = await decide({ proposalDigest: current.proposal_digest, decision: "confirm" });
    expect(confirmed).toMatchObject({ status: 200, body: { ok: true, decision: "confirmed", reason: null } });
    const [decision] = row(INTAKE).owner_success_decisions;
    expect(decision).toMatchObject({ schema_version: "website_owner_success_decision.v1", intent_id: "scene-one",
      intent_digest: sha("a"), request_id: "req-1", capture_id: "cap-1", proposal_digest: current.proposal_digest,
      configured_scene_revision_digest: sha("b"), binding_digest: sha("f"), decision: "confirmed", reason: null,
      decided_via: "owner_job_link" });
    expect(decision.decision_digest).toBe(crossRuntimeArtifactDigest(decision, "decision_digest"));
    // The thresholds the Pipeline sent are unchanged.
    expect(JSON.parse(row(INTAKE).owner_success_proposals[0].proposal_json).configured_success_criteria).toEqual(CRITERIA);
    // The Pipeline's next check reads the confirmation for exactly this proposal.
    expect((await notify(current)).body).toMatchObject({ status: "confirmed", decision });
    expect((await status()).body.successThresholds.decision).toMatchObject({ kind: "confirmed", reason: null });
    // A confirmation is final: repeating it changes nothing; "wrong" afterwards is refused.
    expect((await decide({ proposalDigest: current.proposal_digest, decision: "confirm" })).status).toBe(200);
    expect((await decide({ proposalDigest: current.proposal_digest, decision: "wrong", reason: "too_strict" })).status).toBe(409);
    expect(row(INTAKE).owner_success_decisions).toEqual([decision]);
  });

  it("says this is wrong with a typed reason, which holds the job and edits no number", async () => {
    const current = proposal();
    await notify(current);
    expect((await decide({ proposalDigest: current.proposal_digest, decision: "wrong" })).status).toBe(400);
    expect((await decide({ proposalDigest: current.proposal_digest, decision: "wrong", reason: "the numbers look off" })).status).toBe(400);
    const held = await decide({ proposalDigest: current.proposal_digest, decision: "wrong", reason: "wrong_goal" });
    expect(held).toMatchObject({ status: 200, body: { ok: true, decision: "held", reason: "wrong_goal" } });
    expect((await notify(current)).body).toMatchObject({ status: "held", decision: { decision: "held", reason: "wrong_goal" } });
    expect((await status()).body.successThresholds.decision).toMatchObject({ kind: "held", reason: "wrong_goal" });
    expect(JSON.parse(row(INTAKE).owner_success_proposals[0].proposal_json)).toEqual(current);
    // The owner may still confirm the same goals afterwards; both decisions are kept.
    expect((await decide({ proposalDigest: current.proposal_digest, decision: "confirm" })).body.decision).toBe("confirmed");
    expect(row(INTAKE).owner_success_decisions.map((value: { decision: string }) => value.decision)).toEqual(["held", "confirmed"]);
    expect((await notify(current)).body.status).toBe("confirmed");
  });

  it("refuses a decision on a stale proposal and asks again when the proposal changes", async () => {
    const first = proposal();
    await notify(first);
    expect((await decide({ proposalDigest: first.proposal_digest, decision: "confirm" })).status).toBe(200);
    // The job is republished with another threshold: a new proposal, with no decision yet.
    const second = proposal({ configured_scene_revision_digest: sha("7"),
      configured_success_criteria: { ...CRITERIA, maximum_task_contact_force_n: 50 }, binding_digest: sha("8") });
    expect((await notify(second)).body).toMatchObject({ status: "pending", proposal_digest: second.proposal_digest, decision: null });
    const shown = (await status()).body.successThresholds;
    expect(shown).toMatchObject({ proposalDigest: second.proposal_digest, decision: null });
    expect(shown.rows).toEqual(expect.arrayContaining([
      { label: "Force", value: "The robot pushes on the object with no more than 50 N (about the weight of 5 kg)." }]));
    // A page still showing the first proposal cannot decide on the second.
    expect(await decide({ proposalDigest: first.proposal_digest, decision: "confirm" })).toMatchObject({
      status: 409, body: { code: "website_owner_success_proposal_changed" } });
    expect(row(INTAKE).owner_success_proposals).toHaveLength(2);
    expect(row(INTAKE).owner_success_decisions).toHaveLength(1);
    expect((await decide({ proposalDigest: second.proposal_digest, decision: "confirm" })).status).toBe(200);
    expect((await notify(second)).body.decision.proposal_digest).toBe(second.proposal_digest);
  });

  it("refuses a decision once consent is withdrawn", async () => {
    const current = proposal();
    await notify(current);
    row("inboundRequests/req-1").request.consent_attestation.revoked_at_iso = "2026-11-02T00:00:00Z";
    expect((await decide({ proposalDigest: current.proposal_digest, decision: "confirm" })).status).toBe(409);
    expect(row(INTAKE).owner_success_decisions).toBeUndefined();
  });
});

describe("plain words", () => {
  it("names each threshold it knows and lists every other value unchanged", () => {
    const { rows, otherValues } = describeOwnerSuccessThresholds({ minimum_opening_fraction_of_estimated_stroke: 0.8,
      minimum_hold_seconds: 2, maximum_retries: 1, something_new: [1, 2], source: "s3://bucket/private/success.json" });
    expect(rows).toEqual([{ label: "Opening", value: "Opened at least 80% of the estimated travel." },
      { label: "Held", value: "Held there for at least 2 s." }, { label: "Second tries", value: "At most 1" }]);
    expect(otherValues).toEqual([{ label: "something new", value: "[1,2]" },
      { label: "source", value: "(internal reference)" }]);
  });
});
