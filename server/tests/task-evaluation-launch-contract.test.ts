// @vitest-environment node
import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import { canonicalArtifactDigest } from "../utils/taskCandidateContract";
import {
  CANONICAL_TASK_EVALUATION_ALLOCATOR,
  buildTaskEvaluationLaunchRequest,
  forwardTaskEvaluationLaunch,
  loadPublishedLaunchProfiles,
  parseTaskEvaluationLaunchReceipt,
  resolvePublishedLaunchProfiles,
  resolveTaskEvaluationLaunchUrl,
  resolveTaskEvaluationProfileCatalogUrl,
  taskEvaluationLaunchInputSchema,
} from "../utils/taskEvaluationLaunchContract";

const sha = (character: string) => `sha256:${character.repeat(64)}`;

function profile() {
  return {
    profile_id: "interiorgs-sage-franka-001",
    profile_digest: sha("a"),
    source_bundle: {
      bundle_id: "scene-001",
      source_kind: "interiorgs_sage" as const,
      uri: "gs://blueprint-runs/scene-001.json",
      digest: sha("b"),
    },
    evaluation_run_spec: {
      uri: "gs://blueprint-runs/evaluation-run-spec.json",
      digest: sha("c"),
    },
    required_controls: {
      canonical_allocator: CANONICAL_TASK_EVALUATION_ALLOCATOR,
      secret_profile_id: "canonical-vast-adp",
      watchdog_required: true as const,
      artifact_storage_required: true as const,
      teardown_required: true as const,
      provider_zero_required: true as const,
      webapp_status_sync_required: true as const,
      retry_cap: 0 as const,
    },
    execution_admission: {
      live_enabled: true,
      readiness_receipt: { uri: "gs://blueprint-runs/readiness.json", digest: sha("e") },
      blockers: [],
    },
    claim_ceiling: "development_only" as const,
  };
}

function input() {
  return taskEvaluationLaunchInputSchema.parse({
    launch_id: "launch-001",
    run_id: "run-001",
    profile_id: profile().profile_id,
    profile_digest: profile().profile_digest,
    rights: {
      scope: "interiorgs_sage_simulator_evaluation",
      evidence: { uri: "firestore://authorities/rights-001", digest: sha("d") },
    },
    spend: {
      max_spend_usd: 2,
      expires_at: "2026-08-11T12:00:00.000Z",
    },
    confirm_execution: true,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  delete process.env.TASK_EVALUATION_LAUNCH_PROFILES_JSON;
  delete process.env.TASK_EVALUATION_LAUNCH_PROFILES_URL;
  delete process.env.TASK_EVALUATION_LAUNCH_URL;
  delete process.env.TASK_EVALUATION_RUN_FORWARD_TOKEN;
  delete process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_URL;
  delete process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN;
});

describe("Task Evaluation production launch contract", () => {
  it("builds a digest-bound request without allocator arguments or secrets", () => {
    process.env.TASK_EVALUATION_LAUNCH_PROFILES_JSON = JSON.stringify([profile()]);
    const published = loadPublishedLaunchProfiles();
    const request = buildTaskEvaluationLaunchRequest({
      input: input(),
      profile: published[0],
      actorId: "founder-001",
      actorRole: "admin",
      authorizedAt: "2026-08-10T12:00:00.000Z",
    });

    expect(request.request_digest).toBe(canonicalArtifactDigest(request, "request_digest"));
    expect(request.required_controls.canonical_allocator).toBe(CANONICAL_TASK_EVALUATION_ALLOCATOR);
    expect(JSON.stringify(request)).not.toContain("provider-launch-request");
    expect(JSON.stringify(request)).not.toContain("api_key");
    expect(request.authorization.spend.max_spend_usd).toBe(2);
  });

  it("signs and verifies the Pipeline queue receipt binding", async () => {
    const request = buildTaskEvaluationLaunchRequest({
      input: input(), profile: profile(), actorId: "founder-001", actorRole: "admin",
      authorizedAt: "2026-08-10T12:00:00.000Z",
    });
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      const timestamp = headers["x-blueprint-pipeline-timestamp"];
      const clientId = headers["x-blueprint-pipeline-client-id"];
      const nonce = headers["x-blueprint-pipeline-nonce"];
      const expected = createHmac("sha256", "forward-secret")
        .update(`${timestamp}.${clientId}.${nonce}.${init.body}`)
        .digest("hex");
      expect(headers["x-blueprint-pipeline-signature"]).toBe(`sha256=${expected}`);
      return new Response(JSON.stringify({
        schema_version: "task_evaluation_launch_intake_receipt.v1",
        status: "accepted",
        provider_mutation_performed_inside_http_request: false,
        queue: {
          schema_version: "task_evaluation_launch_queue_receipt.v1",
          status: "queued",
          launch_id: request.launch_id,
          run_id: request.run_id,
          request_digest: request.request_digest,
          provider_mutation_performed: false,
        },
      }), { status: 202, headers: { "content-type": "application/json" } });
    }));

    const result = await forwardTaskEvaluationLaunch({
      request,
      endpointUrl: "https://pipeline.example/api/live-pipeline/task-evaluation-launches",
      token: "forward-secret",
      clientId: "blueprint-webapp",
    });

    expect(result).toMatchObject({ status: "forwarded", performed: true, http_status: 202 });
  });

  it("reuses the canonical robot-eval Pipeline bridge for Task Evaluation intake", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_URL =
      "https://paperclip.tryblueprint.io/api/live-pipeline/job-requests";
    process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN = "canonical-forward-secret";
    process.env.TASK_EVALUATION_RUN_FORWARD_TOKEN = "deprecated-noncanonical-secret";
    const request = buildTaskEvaluationLaunchRequest({
      input: input(), profile: profile(), actorId: "founder-001", actorRole: "admin",
      authorizedAt: "2026-08-10T12:00:00.000Z",
    });
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe(
        "https://paperclip.tryblueprint.io/api/live-pipeline/task-evaluation-launches",
      );
      const headers = init.headers as Record<string, string>;
      const expected = createHmac("sha256", "canonical-forward-secret")
        .update(
          `${headers["x-blueprint-pipeline-timestamp"]}.blueprint-webapp.${headers["x-blueprint-pipeline-nonce"]}.${init.body}`,
        )
        .digest("hex");
      expect(headers["x-blueprint-pipeline-signature"]).toBe(`sha256=${expected}`);
      return new Response(JSON.stringify({
        schema_version: "task_evaluation_launch_intake_receipt.v1",
        status: "accepted",
        provider_mutation_performed_inside_http_request: false,
        queue: {
          schema_version: "task_evaluation_launch_queue_receipt.v1",
          status: "queued",
          launch_id: request.launch_id,
          run_id: request.run_id,
          request_digest: request.request_digest,
          provider_mutation_performed: false,
        },
      }), { status: 202, headers: { "content-type": "application/json" } });
    }));

    expect(resolveTaskEvaluationLaunchUrl()).toBe(
      "https://paperclip.tryblueprint.io/api/live-pipeline/task-evaluation-launches",
    );
    expect(await forwardTaskEvaluationLaunch({ request })).toMatchObject({
      status: "forwarded", performed: true,
    });
  });

  it("discovers and validates the immutable public catalog from Pipeline", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_URL =
      "https://paperclip.tryblueprint.io/api/live-pipeline/job-requests";
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      expect(url).toBe(
        "https://paperclip.tryblueprint.io/api/live-pipeline/task-evaluation-launch-profiles",
      );
      return new Response(JSON.stringify({
        schema_version: "task_evaluation_launch_profile_catalog.v1",
        profiles: [profile()],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }));

    expect(resolveTaskEvaluationProfileCatalogUrl()).toBe(
      "https://paperclip.tryblueprint.io/api/live-pipeline/task-evaluation-launch-profiles",
    );
    expect(await resolvePublishedLaunchProfiles()).toEqual([profile()]);
  });

  it("rejects a terminal receipt whose digest was altered", () => {
    const receipt: Record<string, any> = {
      schema_version: "task_evaluation_launch_receipt.v1",
      status: "completed",
      launch_id: "launch-001",
      run_id: "run-001",
      request_digest: sha("a"),
      launch_profile_digest: sha("b"),
      binding_digest: sha("c"),
      canonical_allocator: CANONICAL_TASK_EVALUATION_ALLOCATOR,
      allocator_exit_code: 0,
      execute_requested: true,
      provider_mutation_attempted: true,
      terminal_evidence: { status: "passed" },
      blockers: [],
      raw_secret_values_recorded: false,
      agent_operator_used: false,
      claim_ceiling: "development_only",
    };
    receipt.receipt_digest = canonicalArtifactDigest(receipt, "receipt_digest");
    expect(parseTaskEvaluationLaunchReceipt(receipt).ok).toBe(true);
    receipt.status = "blocked";
    expect(parseTaskEvaluationLaunchReceipt(receipt)).toEqual({
      ok: false,
      blockers: ["task_evaluation_launch_receipt_digest_mismatch"],
    });
  });
});
