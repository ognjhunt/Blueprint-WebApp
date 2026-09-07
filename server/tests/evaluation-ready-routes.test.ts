// @vitest-environment node
import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  records: new Map<string, Record<string, any>>(),
  tenantId: "robot-team-001",
  isOps: false,
  notificationCalls: [] as Record<string, unknown>[],
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => {
  const reference = (id: string) => ({
    id,
    get: async () => {
      const record = state.records.get(id);
      return { exists: Boolean(record), data: () => record && structuredClone(record) };
    },
  });
  return {
    dbAdmin: {
      collection: () => ({ doc: reference }),
      runTransaction: async <T>(callback: (transaction: any) => Promise<T>) => callback({
        get: async (ref: ReturnType<typeof reference>) => ref.get(),
        set: (ref: ReturnType<typeof reference>, payload: Record<string, unknown>, options?: { merge?: boolean }) => {
          state.records.set(ref.id, options?.merge
            ? { ...(state.records.get(ref.id) || {}), ...structuredClone(payload) }
            : structuredClone(payload));
        },
      }),
    },
  };
});

vi.mock("../middleware/verifyFirebaseToken", () => ({
  default: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../utils/access-control", () => ({
  resolveAccessContext: async () => ({
    uid: "member-001",
    email: "member@example.com",
    isAdmin: state.isOps,
    isOps: state.isOps,
    roles: [],
  }),
}));

vi.mock("../utils/pipelineSyncSecurity", () => ({
  createPipelineSyncRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  verifyPipelineSyncRequest: () => ({ ok: true, status: 200, code: "ok", message: "ok" }),
}));

vi.mock("../utils/transactional-notifications", () => ({
  dispatchTransactionalNotification: async (input: Record<string, unknown>) => {
    state.notificationCalls.push(structuredClone(input));
    return { webNotificationId: "notification-001", outboxId: "outbox-001" };
  },
}));

import router from "../routes/evaluation-ready-runs";

const sha = (character: string) => `sha256:${character.repeat(64)}`;

function runRecord() {
  return {
    schema_version: "task_evaluation_policy_run_web_record.v1",
    run_id: "evaluation-run-001",
    source_launch_id: "evaluation-launch-001",
    offering_digest: sha("a"),
    owner_user_id: "member-001",
    team_namespace: "robot-team-001",
    state: "running",
    configuration_digest: sha("b"),
    notification_source_event_id: sha("b"),
    notification_recipient_user_id: "member-001",
    episode_counts: {
      learned_episode_count: 14,
      control_episode_count: 14,
      total_episode_count: 28,
    },
    progress: { completed_episodes: 2, total_episodes: 28 },
    created_at_iso: "2026-08-30T12:00:00.000Z",
    updated_at_iso: "2026-08-30T12:01:00.000Z",
    private_result_uri: "s3://private-bucket/result.json",
  };
}

function resultSummary() {
  const metric = { attempts: 2, successes: 1, success_rate: 0.5 };
  const pair = { pi05_droid: metric, groot_n17_droid: metric };
  return {
    canonical: pair,
    per_family: {
      canonical_anchor: pair,
      placement_approach: pair,
      illumination: pair,
      camera_sensor: pair,
      bounded_physics: pair,
      pairwise: pair,
      held_out: pair,
    },
    paired: { comparable_pairs: 2, discordant_pairs: 0, summary: "Both candidates were comparable." },
    degradation: [],
    failures: [],
    contacts: { event_count: 4, summary: "Four simulator contacts were recorded." },
    evidence_completeness: {
      complete_episode_count: 28,
      invalid_episode_count: 0,
      all_policy_inputs_retained: true,
      all_frame_manifests_retained: true,
      all_review_videos_retained: true,
    },
  };
}

describe("Evaluation Ready run routes", () => {
  let server: Server;
  let url: string;

  beforeEach(async () => {
    state.records.clear();
    state.tenantId = "robot-team-001";
    state.isOps = false;
    state.notificationCalls = [];
    const app = express();
    app.use(express.json());
    app.use((_req, res, next) => {
      res.locals.firebaseUser = { uid: "member-001", tenantId: state.tenantId };
      next();
    });
    app.use(router);
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("fixture_server_missing");
    url = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("serves only the authenticated team projection and strips private evidence paths", async () => {
    state.records.set("evaluation-run-001", runRecord());
    const allowed = await fetch(`${url}/evaluation-run-001`);
    expect(allowed.status).toBe(200);
    const payload = await allowed.json() as any;
    expect(payload).toMatchObject({
      schema_version: "task_evaluation_policy_run_projection.v1",
      state: "running",
      result: null,
      proof_boundary: { simulation_is_physical_success: false },
    });
    expect(JSON.stringify(payload)).not.toContain("s3://");

    state.tenantId = "different-team";
    const denied = await fetch(`${url}/evaluation-run-001`);
    expect(denied.status).toBe(404);
  });

  it("publishes one safe terminal result projection and stable notification event identity", async () => {
    state.records.set("evaluation-run-001", runRecord());
    const status = {
      schema_version: "task_evaluation_policy_run_status_projection.v1",
      run_id: "evaluation-run-001",
      source_launch_id: "evaluation-launch-001",
      offering_digest: sha("a"),
      configuration_digest: sha("b"),
      state: "results_ready",
      phase: "published",
      progress: { completed_episodes: 28, total_episodes: 28 },
      result_record_id: "result-record-001",
      result_summary: resultSummary(),
      delivery_digest: sha("c"),
      observed_at_iso: "2026-08-30T12:10:00.000Z",
    };
    const first = await fetch(`${url}/evaluation-run-001/pipeline-status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(status),
    });
    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toMatchObject({
      state: "results_ready",
      already_exists: false,
      notification_event_emitted: true,
      result: {
        record_id: "result-record-001",
        href: "/app/results/result-record-001",
        api_href: "/api/task-evaluation-results/result-record-001",
      },
    });

    const replay = await fetch(`${url}/evaluation-run-001/pipeline-status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(status),
    });
    expect(replay.status).toBe(200);
    await expect(replay.json()).resolves.toMatchObject({ already_exists: true });
    expect(state.notificationCalls).toHaveLength(2);
    expect(state.notificationCalls[0]).toMatchObject({
      eventType: "evaluation_results_ready",
      recipientUserId: "member-001",
      subjectId: "evaluation-run-001",
      sourceEventId: sha("b"),
      data: {
        result_record_id: "result-record-001",
        result_url: "https://tryblueprint.io/app/results/result-record-001",
      },
    });
    expect(state.notificationCalls[1]).toEqual(state.notificationCalls[0]);
    expect(JSON.stringify(state.notificationCalls)).not.toContain("s3://");

    const terminalConflict = { ...status, observed_at_iso: "2026-08-30T12:11:00.000Z" };
    const refused = await fetch(`${url}/evaluation-run-001/pipeline-status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(terminalConflict),
    });
    expect(refused.status).toBe(409);
    expect(state.notificationCalls).toHaveLength(2);
  });
  it("rejects older same-state updates without erasing newer progress or owner binding", async () => {
    const original = { ...runRecord(), pipeline_observed_at_iso: "2026-08-30T12:09:00.000Z", progress: {completed_episodes: 12,total_episodes:28} };
    state.records.set(original.run_id, original);
    const response = await fetch(`${url}/${original.run_id}/pipeline-status`, {
      method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({
        schema_version:"task_evaluation_policy_run_status_projection.v1", run_id:original.run_id,
        source_launch_id:original.source_launch_id, offering_digest:original.offering_digest,
        configuration_digest:original.configuration_digest, state:"running", phase:"older",
        progress:{completed_episodes:2,total_episodes:28}, observed_at_iso:"2026-08-30T12:08:00.000Z",
      }),
    });
    expect(response.status).toBe(409);
    expect(state.records.get(original.run_id)).toEqual(original);
    expect(state.notificationCalls).toHaveLength(0);
  });
  it("accepts canary learned-episode progress separately from the control count", async () => {
    const original = { ...runRecord(), run_kind:"internal_policy_canary", request_digest:sha("c"),
      episode_counts:{learned_episode_count:20,control_episode_count:20,total_episode_count:40} };
    state.records.set(original.run_id, original);
    const response = await fetch(`${url}/${original.run_id}/pipeline-status`, {
      method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({
        schema_version:"task_evaluation_policy_run_status_projection.v1",run_id:original.run_id,
        source_launch_id:original.source_launch_id,offering_digest:original.offering_digest,
        configuration_digest:sha("d"), request_digest:sha("c"), run_kind:"internal_policy_canary",
        claim_ceiling:"diagnostic_policy_execution", result_status:null,scene_controls_status:"configured_controls_pending",
        state:"running",stage:"policy_a_running",phase:"policy_a_running",
        progress:{completed_episodes:2,total_episodes:20},completed_learned_episode_count:2,
        expected_learned_episode_count:20,completed_control_episode_count:0,
        observed_at_iso:"2026-08-30T12:08:00.000Z",
      }),
    });
    expect(response.status).toBe(200);
    expect(state.records.get(original.run_id)?.progress).toEqual({completed_episodes:2,total_episodes:20});
    expect(state.records.get(original.run_id)?.owner_user_id).toBe("member-001");
  });

  it("allows a personal run owner without a tenant but refuses another personal owner", async () => {
    state.tenantId = "";
    state.records.set("evaluation-run-001", {...runRecord(),team_namespace:"user:member-001"});
    expect((await fetch(`${url}/evaluation-run-001/status`)).status).toBe(200);
    state.records.set("evaluation-run-001", {...runRecord(),owner_user_id:"other",team_namespace:"user:other"});
    expect((await fetch(`${url}/evaluation-run-001/status`)).status).toBe(404);
  });

});
