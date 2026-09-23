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

const { ensureSelfServeAgentExecution } = await import("../utils/selfServeAgentExecution");
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
