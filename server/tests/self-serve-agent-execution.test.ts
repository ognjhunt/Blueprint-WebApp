// @vitest-environment node
/**
 * The payment setup record, made without a person.
 *
 * It used to be hand-built per team, robot and site. Now a plan for an
 * account-bound team prepares it from the records the system already holds,
 * through the same request validation a person's request goes through, and
 * the admission check that gates payment accepts what it made. Every missing
 * fact is a blocker, never a default.
 */
import express from "express";
import { createServer } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sharedFakeFirestoreState, fakeArrayUnion } from "./helpers/fake-firestore";
import { listedTaskCard } from "./helpers/listedTaskCard";
import { dreamRobotFixture } from "./helpers/dream-robot";

// Early access is covered in robot-team-early-access.test.ts. These tests are
// about planning, spending and settling, so every team here is admitted.
vi.mock("../utils/robotTeamEarlyAccess", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/robotTeamEarlyAccess")>()),
  teamHasEarlyAccess: async () => true,
}));


vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return {
    default: {
      firestore: {
        FieldValue: {
          serverTimestamp: () => "SERVER_TIMESTAMP",
          delete: () => FAKE_FIELD_DELETE,
          arrayUnion: (...items: unknown[]) => fakeArrayUnion(...items),
          increment: (value: number) => value,
        },
      },
    },
    dbAdmin: sharedFakeFirestore,
    storageAdmin: null,
    authAdmin: null,
  };
});
vi.mock("express-rate-limit", () => ({
  default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../constants/stripe", () => ({ stripeClient: null, stripeAvailable: false }));
vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { ensureSelfServeAgentExecution, prepareFreeAgentExecution } = await import("../utils/selfServeAgentExecution");
const { discoverAgentExecutionAdmission } = await import("../utils/agentExecutionAdmission");

const sha = (letter: string) => `sha256:${letter.repeat(64)}`;
const ROOT = "/srv/pipeline/partition/scenes/site-req-1/captures/walkthrough-req-1";
const quote = { teamId: "team-1", checkpointId: "ckpt-1", sceneId: "req-1", quotedEpisodes: 50, quotedUsd: 99 };

function seed(patch: { scene?: Record<string, unknown>; checkpoint?: Record<string, unknown>; team?: Record<string, unknown> } = {}) {
  const docs = sharedFakeFirestoreState.docs;
  docs.set("robotTeams/team-1", {
    id: "team-1", name: "Alpha Robotics", status: "self_registered", capability: {}, fieldProvenance: {},
    createdAt: "2026-09-20T00:00:00.000Z", updatedAt: "2026-09-20T00:00:00.000Z",
    accountUid: "owner-uid", ...patch.team,
  });
  docs.set("robotCheckpoints/ckpt-1", {
    checkpointId: "ckpt-1", teamId: "team-1", runtime: "policy_endpoint", reference: "https://policy.alpha.example/v3",
    ...patch.checkpoint,
  });
  docs.set("inboundRequests/req-1", {
    requestId: "req-1",
    request: {
      buyerType: "site_operator",
      capture_mode: "self_capture",
      consent_attestation: { granted: true, statement_version: "2026-09-18.v1", recorded_at_iso: "2026-09-20T00:00:00.000Z" },
    },
    siteTaskGates: {
      sceneStability: "stable", taskShape: "single", objectVariety: "under_10",
      deploymentTimeline: "this_quarter", accessWindow: "scheduled",
    },
    site_task_triage: { disposition: "qualified" },
    // Teams plan only against sites that shared a card.
    public_task_listing: listedTaskCard(),
    site_task_brief_confirmed_at: "2026-09-20T00:00:00.000Z",
    pipeline: {
      capture_job_id: "walkthrough-req-1",
      capture_id: "walkthrough-req-1",
      artifacts: { worldlabs_world_manifest_uri: "gs://bucket/world.json" },
    },
    evaluation_readiness: { runtime_launchable: true, benchmark_coverage_status: "ready" },
    agent_execution_offer: {
      schema_version: "blueprint.agent_execution_offer.v1",
      scene_id: "site-req-1", capture_id: "walkthrough-req-1", capture_root: ROOT,
      scenario_id: "capture_observed", episode_count: 50, episode_specs_sha256: sha("e"),
    },
    ...patch.scene,
  });
  docs.set("captureUploadSessions/walkthrough-req-1", {
    pipeline_site_task_testbed: {
      testbed_id: "testbed-req-1",
      version: "1",
      testbed_digest: sha("b"),
      testbed: {
        approved_task_definition: { approved_task_id: "pick-carton", task: { task_family: "pick_place" } },
        source_capture_bundles: [{ bundle_id: "walkthrough-req-1", digest: sha("a") }],
        compiled_cards: { site_card: { id: "site-req-1" } },
      },
    },
  });
}

beforeEach(() => {
  sharedFakeFirestoreState.docs.clear();
  vi.stubEnv("BLUEPRINT_BETA_INVITE_CAP", "100");
  vi.stubEnv("BLUEPRINT_BETA_COHORT_DAILY_LIMIT", "100");
});
afterEach(() => vi.unstubAllEnvs());

describe("preparing a self-serve execution", () => {
  it("prepares a record the payment gate admits, bound to the verified account", async () => {
    seed();
    const prepared = await ensureSelfServeAgentExecution(quote);
    expect(prepared, JSON.stringify(prepared)).toMatchObject({ prepared: true, created: true });

    const admission = await discoverAgentExecutionAdmission(quote);
    expect(admission.admitted, JSON.stringify(admission)).toBe(true);
    if (!admission.admitted) return;
    expect(admission.envelope).toMatchObject({
      binding: { team_id: "team-1", checkpoint_id: "ckpt-1", scene_request_id: "req-1", scenario_id: "capture_observed" },
      proof_boundary: { provider_spend_authorized: false, pipeline_execution_started: false },
    });
    const canonical = admission.envelope.canonical_execution_request as Record<string, any>;
    expect(canonical.execution_authorization).toMatchObject({
      authorized_by_user_id: "owner-uid", principal_team_id: "team-1", episodes: 50, max_cost_usd: 99,
    });
    expect(canonical.capture_root).toBe(ROOT);
  });

  it("is idempotent: a repeated plan reuses the record", async () => {
    seed();
    const first = await ensureSelfServeAgentExecution(quote);
    const second = await ensureSelfServeAgentExecution(quote);
    expect(second).toMatchObject({ prepared: true, created: false });
    expect(first.prepared && second.prepared && first.requestId === second.requestId).toBe(true);
    expect((await discoverAgentExecutionAdmission(quote)).admitted).toBe(true);
  });

  it.each([
    ["no verified account owns the team", { team: { accountUid: null } }, "team_account_required"],
    ["the checkpoint is a model artifact", { checkpoint: { runtime: "model_artifact" } }, "agent_execution_checkpoint_runtime_not_admissible"],
    ["the site has not consented to robot evaluation", { scene: { request: { buyerType: "site_operator" } } }, "site_rights_not_cleared"],
    ["the Pipeline has published no execution offer", { scene: { agent_execution_offer: null } }, "pipeline_execution_offer_missing"],
    ["the offer's episode count differs from the quote", { scene: { agent_execution_offer: {
      schema_version: "blueprint.agent_execution_offer.v1", scene_id: "site-req-1", capture_id: "walkthrough-req-1",
      capture_root: ROOT, scenario_id: "capture_observed", episode_count: 20, episode_specs_sha256: sha("e"),
    } } }, "pipeline_execution_offer_episode_mismatch"],
    ["the scene is not runnable", { scene: { evaluation_readiness: null } }, "scene_not_runnable"],
    // The job library's rule (teamJobAccess) applies here too.
    ["the site kept the job private", { scene: { public_task_listing: null } }, "job_not_open:not_listed"],
    ["the rights review has not cleared the capture", { scene: { evaluation_readiness: {
      runtime_launchable: true, benchmark_coverage_status: "ready", rights_review_status: "needs_review",
    } } }, "site_rights_not_cleared"],
  ])("prepares nothing when %s", async (_label, patch, blocker) => {
    seed(patch as never);
    const prepared = await ensureSelfServeAgentExecution(quote);
    expect(prepared).toEqual({ prepared: false, blockers: expect.arrayContaining([blocker]) });
    expect([...sharedFakeFirestoreState.docs.keys()].some((key) => key.startsWith("robotEvalJobRequests/"))).toBe(false);
    expect((await discoverAgentExecutionAdmission(quote)).admitted).toBe(false);
  });

  it("makes a new record when the checkpoint changes, and the old one no longer admits", async () => {
    seed();
    await ensureSelfServeAgentExecution(quote);
    sharedFakeFirestoreState.docs.set("robotCheckpoints/ckpt-1", {
      checkpointId: "ckpt-1", teamId: "team-1", runtime: "policy_endpoint", reference: "https://policy.alpha.example/v4",
    });
    const admissionBefore = await discoverAgentExecutionAdmission(quote);
    expect(admissionBefore.admitted).toBe(false);
    expect((await ensureSelfServeAgentExecution(quote))).toMatchObject({ prepared: true, created: true });
    expect((await discoverAgentExecutionAdmission(quote)).admitted).toBe(true);
  });
});

describe("the plan a bound team sees is payable without anyone at Blueprint", () => {
  it("returns a signed plan for a bound team, and an unsigned one naming the account step otherwise", async () => {
    seed();
    const { issueAgentKey } = await import("../utils/robotTeamAgentKeys");
    const { default: agentTeam } = await import("../routes/agent-team");
    const issued = await issueAgentKey({ teamId: "team-1", label: "test" });
    const app = express(); app.use(express.json()); app.use("/api/agent-team", agentTeam);
    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as { port: number }).port;
    const plan = () => fetch(`http://127.0.0.1:${port}/api/agent-team/plan`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${issued!.key}` },
      body: JSON.stringify({ checkpointId: "ckpt-1", sceneId: "req-1" }),
    }).then((response) => response.json());
    try {
      const bound = await plan();
      expect(bound.selected, JSON.stringify(bound)).toBeDefined();
      expect(bound.selected.map((line: { sceneId: string }) => line.sceneId)).toEqual(["req-1"]);
      expect(typeof bound.planToken, JSON.stringify(bound.lineBlockers)).toBe("string");
      expect(bound).toMatchObject({ executionReady: true, accountBound: true });

      sharedFakeFirestoreState.docs.set("robotTeams/team-1", {
        ...sharedFakeFirestoreState.docs.get("robotTeams/team-1"), accountUid: null,
      });
      const unbound = await plan();
      expect(unbound).toMatchObject({ planToken: null, accountBound: false, blockedBy: "team_account_required" });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe("an autonomous agent can buy without a dry run first", () => {
  it("prepares the record at confirm time and reserves the run", async () => {
    seed();
    const { issueAgentKey } = await import("../utils/robotTeamAgentKeys");
    const { creditTeam, setSpendPolicy } = await import("../utils/robotTeamBalance");
    const { default: agentTeam } = await import("../routes/agent-team");
    const issued = await issueAgentKey({ teamId: "team-1", label: "agent" });
    await creditTeam({ teamId: "team-1", amountUsd: 500, reason: "test funding", idempotencyKey: "fund-1" });
    await setSpendPolicy({ teamId: "team-1", dailyLimitUsd: 200, perRunLimitUsd: 99, agentSpendEnabled: true });
    const app = express(); app.use(express.json()); app.use("/api/agent-team", agentTeam);
    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as { port: number }).port;
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/agent-team/runs`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${issued!.key}` },
        body: JSON.stringify({ checkpointId: "ckpt-1", confirm: true, idempotencyKey: "agent-run-0001", budgetUsd: 99 }),
      });
      const body = await response.json();
      expect(body.refused ?? [], JSON.stringify(body)).toEqual([]);
      expect(body.started?.map((run: { sceneId: string }) => run.sceneId)).toEqual(["req-1"]);
      expect([...sharedFakeFirestoreState.docs.keys()].some((key) => key.startsWith("robotEvalJobRequests/selfserve-"))).toBe(true);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

// Historical paid lifecycle coverage only; production release refusal is tested in free-beta-guards and robot-team-account-gate.
vi.mock("../utils/freeBeta", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/freeBeta")>()),
  FREE_BETA_ONLY: false,
  canDispatchFreeBetaRun: () => true,
}));

it("prepares a sponsor-bounded free request through real canonical admission", async () => {
  seed();
  const free = { ...quote, quotedUsd: 10, submissionKey: "free:workspace-request" };
  const prepared = await prepareFreeAgentExecution(free, { approvedBy: "operator", expiresAtIso: new Date(Date.now() + 600000).toISOString() });
  expect(prepared, JSON.stringify(prepared)).toMatchObject({ prepared: true });
  if (!prepared.prepared) return;
  const admission = await discoverAgentExecutionAdmission({ ...free, executionRequestId: prepared.requestId });
  expect(admission, JSON.stringify(admission)).toMatchObject({ admitted: true });
  expect([...sharedFakeFirestoreState.docs.keys()].filter(key => /evaluationRuns|robotTeamLedger/.test(key))).toEqual([]);
});

describe("asking for a team evaluation (beta L5)", () => {
  const credential = { ref: "credential-ref-1", kind: "bearer", expiresAtIso: "2100-01-01T00:00:00.000Z" };
  const offered = (episodeCount: number, profiles = ["team_evaluation_scored_v1"]) => ({
    agent_execution_offer: {
      schema_version: "blueprint.agent_execution_offer.v1", scene_id: "site-req-1", capture_id: "walkthrough-req-1",
      capture_root: ROOT, scenario_id: "capture_observed", episode_count: episodeCount, episode_specs_sha256: sha("e"),
      policy_execution_profiles: profiles,
    } });
  const approval = () => ({ approvedBy: "operator", expiresAtIso: new Date(Date.now() + 600000).toISOString() });
  it("seals the real Dream protocol and refuses a substituted model at admission", async () => {
    const policyConfig = { policy_interface_id: "dreamlabs_dream1.v1", model_id: "dreamlabs/dream-1",
      camera_roles: { overhead: "overview", wrist_l: "left_wrist", wrist_r: "right_wrist" } };
    seed({ scene: offered(200), checkpoint: { reference: "https://api.dreamlabs.ai/v1/get_action", policyConfig,
      policyCredential: credential } });
    const free = { ...quote, quotedEpisodes: 200, quotedUsd: 10, submissionKey: "free:dream",
      teamEvaluation: { robotEmbodiment: dreamRobotFixture() } };
    const prepared = await prepareFreeAgentExecution(free, approval());
    if (!prepared.prepared) throw new Error(JSON.stringify(prepared));
    const admitted = await discoverAgentExecutionAdmission({ ...free, executionRequestId: prepared.requestId });
    if (!admitted.admitted) throw new Error(JSON.stringify(admitted));
    const canonical = admitted.envelope.canonical_execution_request as Record<string, any>;
    expect(canonical.policy_package.policy_api_endpoint).toMatchObject({ policy_interface_id: "dreamlabs_dream1.v1",
      policy_config: { model_id: policyConfig.model_id, camera_roles: policyConfig.camera_roles } });
    const checkpoint = sharedFakeFirestoreState.docs.get("robotCheckpoints/ckpt-1")!;
    checkpoint.policyConfig = { ...policyConfig, model_id: "dreamlabs/dream-1-beta" };
    const changed = await discoverAgentExecutionAdmission({ ...free, executionRequestId: prepared.requestId });
    expect(changed.admitted).toBe(false);
  });
  const arm = { schema_version: "blueprint.robot_embodiment.v1", embodiment_id: "acme-arm-v2", form: "fixed_base_arm",
    model: { format: "usd", url: "https://models.acme.example/arm.usd", sha256: sha("9") },
    base: { mode: "fixed" },
    joints: [{ name: "shoulder", control: "position", lower: -3, upper: 3, max_velocity: 2 },
      { name: "elbow", control: "position", lower: -3, upper: 3, max_velocity: 2 }],
    gripper: { joints: [{ name: "finger", open: 0.04, closed: 0 }], max_width_m: 0.08, contact_links: ["left_finger", "right_finger"] },
    tool_link: "wrist", reset_joint_positions: { shoulder: 0, elbow: 0, finger: 0.04 }, actuator: { stiffness: 400, damping: 40 },
    cameras: [{ name: "wrist_rgb", mount_link: "wrist", position_m: [0, 0.05, 0.02], orientation_xyzw: [0, 0, 0, 1],
      width: 320, height: 240, horizontal_fov_deg: 90 }],
    control_hz: 30, action_chunk_rows: 4, reach_m: 0.9 } as const;
  // The same arm on a wheeled humanoid: free on the floor, two wheels driven by velocity, no station reach.
  const { reach_m: _reach, ...unmounted } = arm;
  const wheeled = { ...unmounted, embodiment_id: "acme-wheeled-v1", form: "wheeled_humanoid",
    base: { mode: "free", root_height_m: 0.9, fall_height_m: 0.45, footprint_half_extent_m: [0.3, 0.3],
      ground_contact_links: ["left_wheel", "right_wheel"] },
    joints: [...arm.joints, { name: "left_wheel_joint", control: "velocity", max_velocity: 10, damping: 5 },
      { name: "right_wheel_joint", control: "velocity", max_velocity: 10, damping: 5 }] } as const;

  it("asks for 200 hidden scored episodes of the team's authenticated HTTPS policy on the DROID Franka", async () => {
    seed({ scene: offered(200), checkpoint: { policyCredential: credential } });
    const free = { ...quote, quotedEpisodes: 200, quotedUsd: 10, submissionKey: "free:team-franka",
      teamEvaluation: {} };
    const prepared = await prepareFreeAgentExecution(free, approval());
    expect(prepared, JSON.stringify(prepared)).toMatchObject({ prepared: true });
    if (!prepared.prepared) return;
    const admission = await discoverAgentExecutionAdmission({ ...free, executionRequestId: prepared.requestId });
    expect(admission, JSON.stringify(admission)).toMatchObject({ admitted: true });
    if (!admission.admitted) return;
    const canonical = admission.envelope.canonical_execution_request as Record<string, any>;
    expect(canonical.policy_package).toEqual({ policy_api_endpoint: {
      endpoint_url: "https://policy.alpha.example/v3", execution_profile: "team_evaluation_scored_v1",
      policy_interface_id: "openpi_droid_https.v1", credential_ref: "credential-ref-1", credential_kind: "bearer" } });
    expect(canonical.execution_authorization).toMatchObject({ episodes: 200, max_cost_usd: 10 });
  });

  it("asks for 200 hidden scored episodes on the team's own declared arm", async () => {
    seed({ scene: offered(200), checkpoint: { policyCredential: credential } });
    const free = { ...quote, quotedEpisodes: 200, quotedUsd: 10, submissionKey: "free:team-scored",
      teamEvaluation: { robotEmbodiment: arm as any } };
    const prepared = await prepareFreeAgentExecution(free, approval());
    expect(prepared, JSON.stringify(prepared)).toMatchObject({ prepared: true });
    if (!prepared.prepared) return;
    const admission = await discoverAgentExecutionAdmission({ ...free, executionRequestId: prepared.requestId });
    if (!admission.admitted) throw new Error(JSON.stringify(admission));
    const canonical = admission.envelope.canonical_execution_request as Record<string, any>;
    expect(canonical.policy_package.policy_api_endpoint).toMatchObject({ execution_profile: "team_evaluation_scored_v1",
      policy_interface_id: "blueprint_policy_https.v1", robot_embodiment: arm });
    expect(canonical.execution_authorization).toMatchObject({ episodes: 200 });
  });

  function seedManaged() {
    seed({ scene: { ...offered(200), public_task_listing: null }, checkpoint: { policyCredential: credential } });
    sharedFakeFirestoreState.docs.set("inboundRequests/managed-request", {
      account_owner_uid: "owner-uid",
      workspace_evaluation: { executionOrigin: "blueprint_managed", opportunityId: "req-1", checkpointId: "ckpt-1" },
    });
    return { ...quote, quotedEpisodes: 200, quotedUsd: 10, submissionKey: "free:managed-request",
      teamEvaluation: { robotEmbodiment: arm as any, executionOrigin: "blueprint_managed" as const } };
  }

  it("prepares a private job only through its saved managed request and exact operator approval", async () => {
    const free = seedManaged();
    const approved = { ...approval(), workspaceRequestId: "managed-request" };
    const prepared = await prepareFreeAgentExecution(free, approved);
    expect(prepared, JSON.stringify(prepared)).toMatchObject({ prepared: true });
    if (!prepared.prepared) return;
    const selection = { ...free, executionRequestId: prepared.requestId };
    expect(await discoverAgentExecutionAdmission(selection)).toEqual({ admitted: false,
      blockers: ["agent_execution_exact_authorization_missing"] });
    const admitted = await discoverAgentExecutionAdmission({ ...selection,
      blueprintManagedApproval: { approvedBy: approved.approvedBy, workspaceRequestId: "managed-request" } });
    expect(admitted, JSON.stringify(admitted)).toMatchObject({ admitted: true });
    if (!admitted.admitted) return;
    expect((admitted.envelope.canonical_execution_request as any).source).toMatchObject({
      execution_origin: "blueprint_managed", workspace_request_id: "managed-request", approved_by: "operator",
      scene_request_id: "req-1",
    });
    expect([...sharedFakeFirestoreState.docs.keys()].filter(key => /evaluationRuns|robotTeamLedger/.test(key))).toEqual([]);
    expect((await prepareFreeAgentExecution(free, approved))).toMatchObject({ prepared: true, created: false, requestId: prepared.requestId });
  });

  it("does not let an ordinary self-serve call or mismatched source application select private managed access", async () => {
    const free = seedManaged();
    expect(await ensureSelfServeAgentExecution(free)).toMatchObject({ prepared: false,
      blockers: ["blueprint_managed_operator_approval_required"] });
    expect(await prepareFreeAgentExecution(free, approval())).toMatchObject({ prepared: false,
      blockers: ["blueprint_managed_operator_approval_required"] });
    sharedFakeFirestoreState.docs.get("inboundRequests/managed-request")!.account_owner_uid = "someone-else";
    expect(await prepareFreeAgentExecution(free, { ...approval(), workspaceRequestId: "managed-request" }))
      .toMatchObject({ prepared: false, blockers: ["blueprint_managed_application_mismatch"] });
    expect([...sharedFakeFirestoreState.docs.keys()].some(key => key.startsWith("robotEvalJobRequests/"))).toBe(false);
  });

  it.each(["rights", "paused", "runtime", "checkpoint", "origin"])("rechecks current private-job %s before admission", async state => {
    const free = seedManaged();
    const prepared = await prepareFreeAgentExecution(free, { ...approval(), workspaceRequestId: "managed-request" });
    if (!prepared.prepared) throw new Error(JSON.stringify(prepared));
    const scene = sharedFakeFirestoreState.docs.get("inboundRequests/req-1")!;
    const application = sharedFakeFirestoreState.docs.get("inboundRequests/managed-request")!;
    if (state === "rights") scene.pipeline.rights_review_status = "blocked";
    if (state === "paused") scene.workspace_task = { paused: true };
    if (state === "runtime") scene.evaluation_readiness = null;
    if (state === "checkpoint") application.workspace_evaluation.checkpointId = "other-checkpoint";
    if (state === "origin") application.workspace_evaluation.executionOrigin = "technology_team";
    const admitted = await discoverAgentExecutionAdmission({ ...free, executionRequestId: prepared.requestId,
      blueprintManagedApproval: { approvedBy: "operator", workspaceRequestId: "managed-request" } });
    expect(admitted.admitted, JSON.stringify(admitted)).toBe(false);
    expect([...sharedFakeFirestoreState.docs.keys()].some(key => key.startsWith("evaluationRuns/"))).toBe(false);
  });

  it("carries any form the team declares, and refuses a manifest that contradicts itself", async () => {
    const { robotEmbodimentSchema, actionWidth } = await import("../../client/src/types/robotEmbodiment");
    const parsed = robotEmbodimentSchema.parse(wheeled);
    expect(actionWidth(parsed)).toBe(5);  // two arm joints, two wheels, the gripper
    seed({ scene: offered(200), checkpoint: { policyCredential: credential } });
    const free = { ...quote, quotedEpisodes: 200, quotedUsd: 10, submissionKey: "free:team-wheeled",
      teamEvaluation: { robotEmbodiment: wheeled as any } };
    const prepared = await prepareFreeAgentExecution(free, approval());
    if (!prepared.prepared) throw new Error(JSON.stringify(prepared));
    const admission = await discoverAgentExecutionAdmission({ ...free, executionRequestId: prepared.requestId });
    if (!admission.admitted) throw new Error(JSON.stringify(admission));
    const canonical = admission.envelope.canonical_execution_request as Record<string, any>;
    expect(canonical.policy_package.policy_api_endpoint.robot_embodiment).toEqual(wheeled);
    // A fixed arm declared free, a free base given a station reach, a fall above standing height.
    expect(robotEmbodimentSchema.safeParse({ ...wheeled, form: "fixed_base_arm" }).success).toBe(false);
    expect(robotEmbodimentSchema.safeParse({ ...wheeled, reach_m: 0.9 }).success).toBe(false);
    expect(robotEmbodimentSchema.safeParse({ ...wheeled, base: { ...wheeled.base, fall_height_m: 1.2 } }).success)
      .toBe(false);
  });

  it("refuses an episode count other than the evaluation's 200", async () => {
    seed({ scene: offered(200), checkpoint: { policyCredential: credential } });
    expect(await prepareFreeAgentExecution({ ...quote, quotedEpisodes: 10, quotedUsd: 10, submissionKey: "free:wrong-count",
      teamEvaluation: {} }, approval())).toEqual({ prepared: false,
      blockers: ["pipeline_team_evaluation_episode_mismatch"] });
  });

  // The job offers nothing else, so these never fall back to an unscored run that spends the attempt.
  it.each([
    ["no bearer token is on file", {}, "team_evaluation_policy_credential_required"],
    ["the endpoint is not HTTPS", { reference: "http://policy.alpha.example/v3", policyCredential: credential },
      "team_evaluation_policy_https_required"],
  ])("refuses it, preparing nothing, when %s", async (_label, checkpoint, blocker) => {
    seed({ scene: offered(200), checkpoint });
    expect(await prepareFreeAgentExecution({ ...quote, quotedEpisodes: 200, quotedUsd: 10,
      submissionKey: "free:refused", teamEvaluation: {} }, approval())).toEqual({ prepared: false, blockers: [blocker] });
    expect([...sharedFakeFirestoreState.docs.keys()].some((key) => key.startsWith("robotEvalJobRequests/"))).toBe(false);
  });
});
