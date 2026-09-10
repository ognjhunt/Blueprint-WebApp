// @vitest-environment node
import { createHash, createHmac } from "node:crypto";
import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import fixture from "./fixtures/pipeline-policy-canary-publication.v4.json";
import { canonicalArtifactDigest } from "../utils/taskCandidateContract";
import { sealRigidTaskSuccessContract } from "../utils/rigidTaskSuccessContract";
import { operatorPolicyCanaryRegistrationSchema } from "../utils/operatorPolicyCanaryRegistration";
import { parseVerifiedTaskEvaluationRunPublication } from "../utils/taskEvaluationRunContract";
import { encodeTaskEvaluationRunPublication } from "../utils/taskEvaluationRunPublicationStorage";

const state = vi.hoisted(() => ({
  records: new Map<string, Map<string, Record<string, any>>>(),
  queries: [] as Array<{ field: string | null; value: unknown; limit: number }>,
  omitFromInbox: new Set<string>(),
  uid: "blueprint-production-runner" as string | null,
  tenant: "",
  unavailable: false,
  writes: vi.fn(),
  rateLimited: false,
  rateLimiter: vi.fn(),
  probes: vi.fn(),
  streams: vi.fn(),
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  authAdmin: null,
  dbAdmin: {
    collection: (name: string) => {
      if (state.unavailable) throw new Error("fixture store unavailable");
      const query = (field: string | null, value: unknown, limit: number) => ({ get: async () => {
        state.queries.push({ field, value, limit });
        return { docs: [...(state.records.get(name)?.entries() || [])]
          .filter(([id, record]) => !state.omitFromInbox.has(id) && (!field || record[field] === value))
          .slice(0, limit).map(([id, record]) => ({ id, data: () => structuredClone(record) })) };
      } });
      return {
        doc: (id: string) => ({ get: async () => {
          const record = state.records.get(name)?.get(id);
          return { exists: Boolean(record), data: () => record && structuredClone(record) };
        }, set: state.writes, create: state.writes, update: state.writes }),
        where: (field: string, operator: string, value: unknown) => {
          if (operator !== "==") throw new Error("unexpected query");
          return { limit: (limit: number) => query(field, value, limit) };
        },
        limit: (limit: number) => query(null, null, limit),
      };
    },
  },
}));
vi.mock("../utils/pipelineSyncSecurity", async (importOriginal) => ({
  ...await importOriginal<typeof import("../utils/pipelineSyncSecurity")>(),
  createPipelineSyncRateLimiter: () => (req: express.Request, res: express.Response, next: () => void) => {
    state.rateLimiter(req.path);
    if (state.rateLimited) return res.status(429).json({ error: "rate limited" });
    next();
  },
}));
vi.mock("../utils/taskEvaluationResultArtifactProxy", () => ({
  probeTaskEvaluationResultArtifactMetadata: state.probes,
  probeTaskEvaluationResultArtifact: async (params: unknown) => (await state.probes(params)).status,
  streamTaskEvaluationResultArtifact: state.streams,
}));

import readbackRouter from "../routes/internal-task-evaluation-delivery-readback";
import downloadsRouter from "../routes/task-evaluation-result-downloads";
import resultsRouter from "../routes/task-evaluation-results";

const sha = (character: string) => `sha256:${character.repeat(64)}`;
const payload = Buffer.from("0123456789");
const artifactDigest = `sha256:${createHash("sha256").update(payload).digest("hex")}`;

function seed() {
  const publication = structuredClone(fixture) as Record<string, any>;
  const contract = sealRigidTaskSuccessContract({
    siteId: "operator-scene", taskId: "operator-relocation", authorSource: "task_owner",
    authorId: "operator", confirmationStatus: "confirmed", confirmedByTeamId: "team-1",
    criteria: {
      destination_containment: { mode: "required", position_bounds_world_m: { minimum: [0, 0, 0], maximum: [1, 1, 1] } },
      orientation: { mode: "ignored", reference_xyzw: [0, 0, 0, 1], tolerance_rad: 0.1 },
      support: { height_mode: "required", height_interval_m: [0, 1], contact_mode: "required" },
      terminal_task_contact: { mode: "cleared" }, gripper_state: { mode: "ignored", threshold_m: null },
      settling: { mode: "required", window_samples: 8, position_tolerance_m: 0.01, orientation_tolerance_rad: 0.08 },
      safety: { mode: "required" }, motion: { movement_epsilon_m: 0.002, minimum_translation_m: 0.08, minimum_lift_m: null },
      temporal_invariants: { schema_version: "rigid_task_event_ledger_expectation.v1",
        no_drop: { mode: "ignored", minimum_fall_m: 0.02 }, maximum_task_contact_force_n: null,
        forbidden_contact_classes: [], containment_excursions: "forbidden", workspace_excursions: "ignored",
        maximum_retries: null, maximum_regrasps: null },
    },
  });
  const registration: Record<string, any> = {
    schema_version: "task_evaluation_operator_policy_canary_registration.v1",
    run_kind: "internal_policy_canary", claim_ceiling: "diagnostic_policy_execution",
    run_id: publication.run_id, source_launch_id: "parent-scene-launch", source_offering_digest: sha("a"),
    capture_session_id: publication.capture_session_id, intake_id: publication.intake_id, team_namespace: "team-1",
    scene_revision_digest: sha("b"), request_digest: publication.request_digest, configuration_digest: publication.configuration_digest,
    plan_digest: sha("1"), activation_digest: sha("2"), runtime_inputs_digest: sha("3"), setup_digest: sha("4"),
    source_commit: "5".repeat(40), operator_authorization_digest: sha("6"), control_omission_authority_digest: sha("7"),
    task_success_contract: contract,
    policy_candidates: [
      { candidate_id: "pi05_droid", display_name: "PI 0.5 DROID", checkpoint_digest: sha("8") },
      { candidate_id: "groot_n17_droid", display_name: "GR00T N1.7 DROID", checkpoint_digest: sha("9") },
    ], notification: { email: "owner@example.invalid" },
  };
  registration.registration_digest = canonicalArtifactDigest(registration, "registration_digest");
  operatorPolicyCanaryRegistrationSchema.parse(registration);
  publication.plan_digest = registration.plan_digest;
  publication.operator_registration_digest = registration.registration_digest;
  publication.policy_canary_result.task_success_contract = contract;
  publication.policy_canary_result.task_success_contract_digest = contract.contract_digest;
  const omission = { authority_digest: registration.control_omission_authority_digest,
    task_success_contract_digest: contract.contract_digest, qualified_comparison_permitted: false,
    artifact: { artifact_id: "control-omission", digest: sha("a"), size_bytes: 100 } };
  const controls = { scene_controls_status: "controls_omitted_by_user",
    warning: "Controls omitted at the user's request — diagnostic results remain unqualified.", control_omission: omission };
  Object.assign(publication.policy_canary_result, controls);
  Object.assign(publication.result_delivery, controls);
  publication.scene_controls_status = controls.scene_controls_status;
  publication.warning = controls.warning;
  publication.result_delivery.artifacts = [omission.artifact];
  publication.policy_canary_result.counts.diagnostic_control_rollout_count = 0;
  publication.policy_canary_result.report.machine_readable_report.digest = artifactDigest;
  publication.result_delivery.delivery_digest = canonicalArtifactDigest(publication.result_delivery, "delivery_digest");
  publication.policy_canary_result.result_delivery_digest = publication.result_delivery.delivery_digest;
  publication.policy_canary_result.projection_digest = canonicalArtifactDigest(publication.policy_canary_result, "projection_digest");
  expect(parseVerifiedTaskEvaluationRunPublication(publication).ok).toBe(true);
  const recordId = `capture-run-${createHash("sha256").update(`${publication.capture_session_id}\0${publication.run_id}`).digest("hex").slice(0, 32)}`;
  const record = { record_id: recordId, owner_user_id: "blueprint-production-runner", organization_id: "team-1",
    access_visibility: "organization_members", publication_storage: encodeTaskEvaluationRunPublication(publication) };
  const policyRun = { run_id: publication.run_id, run_kind: "internal_policy_canary", owner_user_id: record.owner_user_id,
    operator_registration: registration, submission_channel: "production_webapp_operator_registration", team_namespace: "team-1",
    source_launch_id: registration.source_launch_id, result_record_id: recordId,
    request_digest: publication.request_digest, pipeline_configuration_digest: publication.configuration_digest,
    task_success_contract_digest: contract.contract_digest, phase: "published", stage: "terminal", result_status: publication.result_status,
    delivery_digest: publication.result_delivery.delivery_digest, policy_run_result_projection: publication.policy_canary_result };
  state.records.set("captureTaskEvaluationRuns", new Map([[recordId, record]]));
  state.records.set("taskEvaluationPolicyRuns", new Map([[publication.run_id, policyRun]]));
  return { recordId, record, policyRun, publication, body: {
    schema_version: "task_evaluation_delivery_readback_request.v1", capture_session_id: publication.capture_session_id,
    run_id: publication.run_id, operator_registration_digest: registration.registration_digest,
    result_delivery_digest: publication.result_delivery.delivery_digest,
    policy_canary_projection_digest: publication.policy_canary_result.projection_digest, artifact_ids: ["full-report"],
  } };
}

let server: Server;
let url: string;
let seeded: ReturnType<typeof seed>;

beforeEach(async () => {
  vi.stubEnv("PIPELINE_SYNC_TOKEN", "pipeline-secret");
  vi.stubEnv("PIPELINE_SYNC_ALLOW_LEGACY_BEARER", "false");
  vi.stubEnv("TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET", "download-secret");
  state.records.clear(); state.queries = []; state.omitFromInbox.clear(); state.unavailable = false;
  state.uid = "blueprint-production-runner"; state.tenant = ""; state.rateLimited = false;
  state.writes.mockClear(); state.probes.mockReset(); state.streams.mockReset(); state.rateLimiter.mockClear();
  state.probes.mockImplementation(async ({ artifactId, expected }) => ["full-report", "registry-only"].includes(artifactId)
    ? { status: "admitted", metadata: expected ?? { sha256: artifactDigest, size_bytes: 10 } } : { status: "not_found" });
  state.streams.mockImplementation(async ({ res }) => res.status(200).send(payload));
  seeded = seed();
  const app = express();
  app.use(express.json({ verify: (req, _res, bytes) => { (req as express.Request & { rawBody?: string }).rawBody = bytes.toString(); } }));
  app.use((_req, res, next) => { if (state.uid) res.locals.firebaseUser = { uid: state.uid, firebase: { tenant: state.tenant } }; next(); });
  app.use("/api/internal/pipeline", readbackRouter);
  app.use("/api/task-evaluation-results", resultsRouter);
  app.use("/api/task-evaluation-result-downloads", downloadsRouter);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture server missing");
  url = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  vi.unstubAllEnvs();
});

async function readback(body: Record<string, unknown> = seeded.body, options: { timestamp?: string; secret?: string; unsigned?: boolean } = {}) {
  const timestamp = options.timestamp ?? new Date().toISOString();
  const raw = JSON.stringify(body);
  const signature = createHmac("sha256", options.secret ?? "pipeline-secret").update(`${timestamp}.${raw}`).digest("hex");
  return fetch(`${url}/api/internal/pipeline/capture-task-evaluation-runs/readback`, { method: "POST", body: raw,
    headers: { "content-type": "application/json", ...(options.unsigned ? {} : {
      "X-Blueprint-Pipeline-Timestamp": timestamp, "X-Blueprint-Pipeline-Signature": `sha256=${signature}` }) } });
}

describe("authenticated Task Evaluation delivery readback", () => {
  it("reopens compressed storage, proves owner inbox membership and issues usable ephemeral UI tickets", async () => {
    const response = await readback(); const body = await response.json();
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(body).toMatchObject({ status: "verified", run_id: seeded.body.run_id, record_id: seeded.recordId,
      inbox: { status: "verified", scope: "owner", run_id: seeded.body.run_id, team_namespace: "team-1",
        source: "website_owner_run_index_readback", projection_digest: seeded.body.policy_canary_projection_digest } });
    expect(state.queries).toContainEqual({ field: "owner_user_id", value: "blueprint-production-runner", limit: 250 });
    expect(body.ephemeral_downloads[0]).toMatchObject({ artifact_id: "full-report", sha256: artifactDigest, size_bytes: 10 });
    const downloaded = await fetch(new URL(body.ephemeral_downloads[0].download_url, url));
    expect(downloaded.status).toBe(200); expect(Buffer.from(await downloaded.arrayBuffer())).toEqual(payload);
    expect(state.writes).not.toHaveBeenCalled(); expect(state.rateLimiter).toHaveBeenCalled();
  });

  it("gets registry-only artifact metadata through the existing signed-origin probe", async () => {
    const response = await readback({ ...seeded.body, artifact_ids: ["registry-only"] });
    expect(response.status).toBe(200);
    expect((await response.json()).ephemeral_downloads[0]).toMatchObject({ artifact_id: "registry-only", sha256: artifactDigest, size_bytes: 10 });
    expect(state.probes).toHaveBeenCalledWith({ runId: seeded.body.run_id, artifactId: "registry-only", expected: undefined });
  });

  it.each(["run_id", "capture_session_id", "operator_registration_digest", "result_delivery_digest", "policy_canary_projection_digest"])("refuses a mismatched %s binding", async (field) => {
    const response = await readback({ ...seeded.body, [field]: field.endsWith("digest") ? sha("0") : "wrong-run" });
    expect([404, 409]).toContain(response.status); expect(state.probes).not.toHaveBeenCalled();
  });

  it.each(["owner_user_id", "organization_id"])("never exposes a record with a wrong %s", async (field) => {
    state.records.get("captureTaskEvaluationRuns")!.get(seeded.recordId)![field] = "another-owner";
    const response = await readback(); expect(response.status).toBe(404);
    expect(JSON.stringify(await response.json())).not.toContain("another-owner");
    expect(state.probes).not.toHaveBeenCalled();
  });

  it("refuses a missing bound owner and a missing owner-list entry", async () => {
    seeded.policyRun.owner_user_id = "";
    expect((await readback()).status).toBe(404);
    seeded.policyRun.owner_user_id = "blueprint-production-runner";
    state.omitFromInbox.add(seeded.recordId);
    const response = await readback(); expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("delivery_readback_owner_inbox_unverified");
  });

  it("uses the same tenant query and access guard in the UI inbox", async () => {
    const records = state.records.get("captureTaskEvaluationRuns")!;
    records.set("private-other", { ...seeded.record, owner_user_id: "someone-else", access_visibility: "owner_only" });
    state.uid = "team-member"; state.tenant = "team-1";
    const response = await fetch(`${url}/api/task-evaluation-results`);
    const body = await response.json(); expect(response.status).toBe(200);
    expect(body.scope).toBe("organization"); expect(body.results.map((row: any) => row.record_id)).toEqual([seeded.recordId]);
    expect(state.queries).toContainEqual({ field: "organization_id", value: "team-1", limit: 250 });
    state.tenant = "other-team";
    expect((await (await fetch(`${url}/api/task-evaluation-results`)).json()).results).toEqual([]);
  });

  it("rejects missing, invalid and expired signed-body authentication before reading records", async () => {
    expect((await readback(seeded.body, { unsigned: true })).status).toBe(401);
    expect((await readback(seeded.body, { secret: "wrong-secret" })).status).toBe(401);
    expect((await readback(seeded.body, { timestamp: new Date(Date.now() - 600_000).toISOString() })).status).toBe(401);
    expect(state.queries).toEqual([]); expect(state.probes).not.toHaveBeenCalled();
  });

  it("does not mint download capabilities from legacy unsigned bearer authentication", async () => {
    vi.stubEnv("PIPELINE_SYNC_ALLOW_LEGACY_BEARER", "true");
    const response = await fetch(`${url}/api/internal/pipeline/capture-task-evaluation-runs/readback`, {
      method: "POST", headers: { "content-type": "application/json", "X-Blueprint-Pipeline-Token": "pipeline-secret" },
      body: JSON.stringify(seeded.body),
    });
    expect(response.status).toBe(401); expect(state.queries).toEqual([]);
    expect(state.probes).not.toHaveBeenCalled();
  });

  it("fails closed when sync or download secrets are absent", async () => {
    vi.stubEnv("PIPELINE_SYNC_TOKEN", ""); expect((await readback()).status).toBe(503);
    vi.stubEnv("PIPELINE_SYNC_TOKEN", "pipeline-secret"); vi.stubEnv("TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET", "");
    const response = await readback(); expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("delivery_readback_download_secret_unavailable");
  });

  it("rejects nonexistent registry artifacts, absent records and unavailable stores", async () => {
    expect((await readback({ ...seeded.body, artifact_ids: ["missing"] })).status).toBe(404);
    state.records.get("captureTaskEvaluationRuns")!.delete(seeded.recordId);
    expect((await readback()).status).toBe(404);
    state.unavailable = true; expect((await readback()).status).toBe(503);
  });

  it.each([[], ["full-report", "full-report"], Array.from({ length: 13 }, (_, index) => `item-${index}`)])("bounds artifact batches and refuses duplicate IDs", async (artifact_ids) => {
    expect((await readback({ ...seeded.body, artifact_ids })).status).toBe(400);
    expect(state.probes).not.toHaveBeenCalled();
  });

  it("requires the bound policy-run projection and rate limit", async () => {
    seeded.policyRun.delivery_digest = sha("0"); expect((await readback()).status).toBe(409);
    state.rateLimited = true; expect((await readback()).status).toBe(429);
  });

  it("uses the existing download route's expiry check", async () => {
    const expires = Math.floor(Date.now() / 1000) - 1;
    const signature = createHmac("sha256", "download-secret").update(`${seeded.recordId}\0full-report\0${expires}`).digest("hex");
    const response = await fetch(`${url}/api/task-evaluation-result-downloads/${seeded.recordId}/full-report?expires=${expires}&signature=${signature}`);
    expect(response.status).toBe(404); expect(state.streams).not.toHaveBeenCalled();
  });
});

describe("private unpublished operator result links", () => {
  function pendingRun() {
    state.records.get("captureTaskEvaluationRuns")!.delete(seeded.recordId);
    Object.assign(seeded.policyRun, {
      claim_ceiling: "diagnostic_policy_execution", state: "running", phase: "awaiting_operator_results",
      configuration_digest: seeded.publication.configuration_digest, result_record_id: null,
      progress: { completed_episodes: 4, total_episodes: 20 }, updated_at_iso: "2026-09-10T21:00:00.000Z",
    });
    delete seeded.policyRun.stage;
    state.uid = "team-member"; state.tenant = "team-1";
  }
  const getResult = () => fetch(`${url}/api/task-evaluation-results/${seeded.recordId}`);

  it("shows verified-team recorded progress, then serves the sealed publication at the same URL", async () => {
    pendingRun();
    const response = await getResult();
    expect(response.status).toBe(202);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const body = await response.json();
    expect(body).toMatchObject({ schema_version: "task_evaluation_result_pending.v1", record_id: seeded.recordId,
      status: "publication_pending", run: { phase: "awaiting_operator_results", progress: { completed_episodes: 4, total_episodes: 20 } } });
    expect(body.publication).toBeUndefined();
    expect(JSON.stringify(body)).not.toMatch(/owner@example|operator_registration|download_url/);
    state.records.get("captureTaskEvaluationRuns")!.set(seeded.recordId, seeded.record);
    const published = await getResult();
    expect(published.status).toBe(200);
    expect((await published.json()).publication.run_id).toBe(seeded.publication.run_id);
    expect(state.writes).not.toHaveBeenCalled();
  });

  it.each([null, "stranger", "blueprint-production-runner"])("does not reveal a pending team run to %s without team membership", async (uid) => {
    pendingRun(); state.uid = uid; state.tenant = "";
    const response = await getResult();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Task Evaluation Result not found" });
  });

  it("allows a verified operations reader", async () => {
    pendingRun(); state.uid = "ops-reader"; state.tenant = "";
    state.records.set("users", new Map([["ops-reader", { roles: ["ops"] }]]));
    expect((await getResult()).status).toBe(202);
  });

  it.each(["registration", "run_id", "team_namespace", "configuration_digest", "task_success_contract_digest", "result_record_id"])("fails closed for a conflicting %s", async (field) => {
    pendingRun();
    if (field === "registration") seeded.policyRun.operator_registration.registration_digest = sha("0");
    else seeded.policyRun[field] = "conflicting";
    expect((await getResult()).status).toBe(404);
  });

  it("does not replace a corrupt published record with pending progress", async () => {
    pendingRun();
    state.records.get("captureTaskEvaluationRuns")!.set(seeded.recordId, { publication: { run_id: "invalid" } });
    expect((await getResult()).status).toBe(404);
  });

  it("retains a terminal failure without claiming publication or retrying execution", async () => {
    pendingRun(); seeded.policyRun.state = "failed"; seeded.policyRun.phase = "collection_failed";
    const response = await getResult();
    expect(response.status).toBe(202);
    expect((await response.json()).run).toMatchObject({ state: "failed", terminal: true, phase: "collection_failed" });
    expect(state.writes).not.toHaveBeenCalled();
  });
});
