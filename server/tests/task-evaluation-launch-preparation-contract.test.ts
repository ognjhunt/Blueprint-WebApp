// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { canonicalArtifactDigest } from "../utils/taskCandidateContract";
import {
  forwardTaskEvaluationLaunchPreparation,
  resolveTaskEvaluationLaunchPreparationUrl,
} from "../utils/taskEvaluationLaunchPreparationContract";

const sha = (character: string) => `sha256:${character.repeat(64)}`;

function request() {
  return {
    preparation_id: "prep-001",
    run_id: "run-001",
    team_namespace: "robot-team-001",
    expected_production_commit: "a".repeat(40),
  } as any;
}

function receipt(extra: Record<string, unknown> = {}) {
  const value: Record<string, unknown> = {
    schema_version: "task_evaluation_launch_preparation_intake_receipt.v1",
    status: "queued_for_no_spend_preparation",
    accepted: true,
    already_exists: false,
    preparation_id: "prep-001",
    run_id: "run-001",
    team_namespace: "robot-team-001",
    expected_production_commit: "a".repeat(40),
    request_digest: canonicalArtifactDigest(request(), "request_digest"),
    provider_mutation_performed_inside_http_request: false,
    catalog_mutation_performed_inside_http_request: false,
    paid_execution_requested: false,
    canonical_allocator_required_for_later_execution: true,
    ...extra,
    receipt_digest: "",
  };
  value.receipt_digest = canonicalArtifactDigest(value, "receipt_digest");
  return value;
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.TASK_EVALUATION_LAUNCH_URL;
});

describe("Task Evaluation launch preparation forwarding", () => {
  it("derives the preparation endpoint from the configured launch service", () => {
    process.env.TASK_EVALUATION_LAUNCH_URL = "https://pipeline.example/api/live-pipeline/task-evaluation-launches";
    expect(resolveTaskEvaluationLaunchPreparationUrl()).toBe(
      "https://pipeline.example/api/live-pipeline/task-evaluation-launch-preparations",
    );
    expect(resolveTaskEvaluationLaunchPreparationUrl("prep-001")).toBe(
      "https://pipeline.example/api/live-pipeline/task-evaluation-launch-preparations/prep-001",
    );
  });

  it("accepts only a digest-bound sanitized no-spend receipt", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(receipt()), {
      status: 202, headers: { "content-type": "application/json" },
    }));
    await expect(forwardTaskEvaluationLaunchPreparation({
      request: request(), endpointUrl: "https://pipeline.example/preparations", token: "secret",
    })).resolves.toMatchObject({ status: "forwarded", performed: true });
  });

  it("fails closed if Pipeline exposes an internal queue path", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(receipt({
      queue_path: "/var/lib/blueprint/task-evaluation-launch-preparations/pending/prep-001.json",
    })), { status: 202, headers: { "content-type": "application/json" } }));
    await expect(forwardTaskEvaluationLaunchPreparation({
      request: request(), endpointUrl: "https://pipeline.example/preparations", token: "secret",
    })).resolves.toMatchObject({
      status: "blocked",
      performed: false,
      blocker: "pipeline_task_evaluation_launch_preparation_receipt_invalid",
    });
  });
});

function surfaceTarget() {
  const target = {
    schema_version: "task_evaluation_surface_target.v1", shape: "flat_green_disc",
    non_colliding: true, visible_label: "clear support area", radius_m: 0.15,
    surface_position_world_m: [0.5, 0.5, 0.75], support_prim_path: "/Root/Table",
    support_source_instance_id: "/Table", maximum_tilt_rad: Math.PI / 12,
    stable_seconds: 1, maximum_linear_speed_m_s: 0.02, maximum_angular_speed_rad_s: 0.1,
    target_digest: "",
  };
  target.target_digest = canonicalArtifactDigest(target, "target_digest");
  return target;
}

describe("existing support pick-and-place preparation", () => {
  it("preserves the Pipeline website derivative references and rejects unbound local files", async () => {
    const { taskEvaluationLaunchPreparationInputSchema } = await import("../utils/taskEvaluationLaunchPreparationContract");
    const fixture = structuredClone((await import("./fixtures/astra-preparation-request.v1.json")).default) as any;
    const reference = { uri: "gs://capture-bucket/prepared/object.png", digest: sha("a"), size_bytes: 32 };
    fixture.scene.website_native_inputs = {
      runtime_inputs: reference, appearance: reference, observations: reference,
      candidate: reference, frames: [reference],
    };
    const parsed = taskEvaluationLaunchPreparationInputSchema.safeParse(fixture);
    expect(parsed.success, JSON.stringify(parsed.success ? null : parsed.error.issues)).toBe(true);
    if (parsed.success && parsed.data.scene.mode === "configure_source_scene") {
      expect(parsed.data.scene.website_native_inputs).toEqual(fixture.scene.website_native_inputs);
    }
    fixture.scene.website_native_inputs.frames = [{ ...reference, uri: "file:///tmp/object.png" }];
    expect(taskEvaluationLaunchPreparationInputSchema.safeParse(fixture).success).toBe(false);
    fixture.scene.website_native_inputs.frames = [];
    expect(taskEvaluationLaunchPreparationInputSchema.safeParse(fixture).success).toBe(false);
  });

  it("does not reserve ArtiFixer spend for prepared website backgrounds", async () => {
    const { taskEvaluationLaunchPreparationInputSchema } = await import("../utils/taskEvaluationLaunchPreparationContract");
    const fixture = structuredClone((await import("./fixtures/astra-preparation-request.v1.json")).default) as any;
    const reference = { uri: "gs://capture-bucket/prepared/object.png", digest: sha("a"), size_bytes: 32 };
    fixture.scene.website_native_inputs = {
      runtime_inputs: reference, appearance: reference, observations: reference,
      candidate: reference, frames: [reference],
    };
    fixture.spend.hard_cap_usd = 11;
    fixture.spend.external_service_caps.openai.maximum_cost_usd = 5;
    fixture.spend.external_service_caps.openai.stage_max_cost_usd = {
      artifixer_semantic_teacher: 0, artifixer_visual_review: 0, content_agents: 5,
    };
    expect(taskEvaluationLaunchPreparationInputSchema.safeParse(fixture).success).toBe(true);
    delete fixture.scene.website_native_inputs;
    expect(taskEvaluationLaunchPreparationInputSchema.safeParse(fixture).success).toBe(false);
  });

  it("accepts the Pipeline surface contract without a fabricated destination asset", async () => {
    const { taskEvaluationLaunchPreparationInputSchema } = await import("../utils/taskEvaluationLaunchPreparationContract");
    const fixture = structuredClone((await import("./fixtures/astra-preparation-request.v1.json")).default) as any;
    delete fixture.task.destination;
    fixture.task.strategy = "pick_and_place";
    fixture.task.surface_target = surfaceTarget();
    const parsed = taskEvaluationLaunchPreparationInputSchema.safeParse(fixture);
    expect(parsed.success, JSON.stringify(parsed.success ? null : parsed.error.issues)).toBe(true);
    if (parsed.success) expect(parsed.data.task.surface_target).toEqual(fixture.task.surface_target);
  });

  it("rejects changing the target after sealing or using it for another task strategy", async () => {
    const { taskEvaluationLaunchPreparationInputSchema } = await import("../utils/taskEvaluationLaunchPreparationContract");
    const fixture = structuredClone((await import("./fixtures/astra-preparation-request.v1.json")).default) as any;
    fixture.task.strategy = "pick_and_place";
    fixture.task.surface_target = surfaceTarget();
    fixture.task.strategy = "planar_push";
    expect(taskEvaluationLaunchPreparationInputSchema.safeParse(fixture).success).toBe(false);
    fixture.task.strategy = "pick_and_place";
    delete fixture.task.destination;
    fixture.task.surface_target.radius_m += 0.1;
    expect(taskEvaluationLaunchPreparationInputSchema.safeParse(fixture).success).toBe(false);
  });
});
