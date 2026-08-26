// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { canonicalArtifactDigest } from "../utils/taskCandidateContract";
import {
  forwardSceneObjectDiscovery,
  resolveSceneObjectDiscoveryUrl,
  sceneObjectDiscoveryInputSchema,
} from "../utils/sceneObjectDiscoveryContract";

const sha = (character: string) => `sha256:${character.repeat(64)}`;
const ref = (character: string) => ({
  uri: `https://objects.example/${character}.json`,
  digest: sha(character),
  size_bytes: 100,
});

function request() {
  return {
    schema_version: "scene_object_discovery_request.v1",
    discovery_id: "discover-scene-001",
    expected_production_commit: "a".repeat(40),
    team_namespace: "robot-team-001",
    scene: {
      identity: { id: "scene-001", version: "v1" },
      source_splat: ref("a"),
      scene_analysis: ref("b"),
      metric_registration: ref("c"),
      renderer_qualification: ref("d"),
      retained_gaussian_count: 1234,
    },
    task: {
      kind: "rigid_relocation",
      strategy: "pick_and_place",
      task_statement: "Pick the red tote",
      target_hint: "red tote",
    },
    analysis: {
      analyzers: ["splat_analyzer", "sam31"],
      prompts: ["red tote", "container"],
      minimum_confidence: 0.5,
      minimum_task_relevance: 0.5,
      require_metric_source_object: true,
      full_scene_survey_required: true,
    },
    rights: {
      admission: ref("e"),
      human_authority_record: ref("f"),
      source_bytes_redistributable: false,
      provider_disclosure_scope: "derived_only",
    },
    execution: { mode: "qualified_local_runtime" },
    publication: {
      input_namespace: "scene-001-discovery",
      service_account_readback_required: true,
    },
  } as const;
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.TASK_EVALUATION_LAUNCH_URL;
});

describe("scene object discovery contract", () => {
  it("accepts a bounded local discovery request", () => {
    expect(sceneObjectDiscoveryInputSchema.safeParse(request()).success).toBe(true);
  });

  it("requires source disclosure authority for provider execution", () => {
    const value: any = request();
    value.execution = { mode: "provider_gpu_after_activation", selected_provider: "vast" };
    expect(sceneObjectDiscoveryInputSchema.safeParse(value).success).toBe(false);
  });

  it("derives collection, status, and selection endpoints", () => {
    process.env.TASK_EVALUATION_LAUNCH_URL = "https://pipeline.example/api/live-pipeline/task-evaluation-launches";
    expect(resolveSceneObjectDiscoveryUrl()).toBe("https://pipeline.example/api/live-pipeline/scene-object-discoveries");
    expect(resolveSceneObjectDiscoveryUrl("discover-001")).toBe("https://pipeline.example/api/live-pipeline/scene-object-discoveries/discover-001");
    expect(resolveSceneObjectDiscoveryUrl("discover-001", "selection")).toBe("https://pipeline.example/api/live-pipeline/scene-object-discoveries/discover-001/selection");
  });

  it("accepts only a sanitized digest-bound Pipeline receipt", async () => {
    const value = request();
    const receipt: Record<string, unknown> = {
      schema_version: "scene_object_discovery_intake_receipt.v1",
      status: "queued_for_no_spend_discovery_preparation",
      accepted: true,
      already_exists: false,
      discovery_id: value.discovery_id,
      team_namespace: value.team_namespace,
      request_digest: canonicalArtifactDigest(value as unknown as Record<string, unknown>, "request_digest"),
      expected_production_commit: value.expected_production_commit,
      provider_mutation_performed_inside_http_request: false,
      paid_execution_requested: false,
      canonical_allocator_required_for_provider_execution: true,
      receipt_digest: "",
    };
    receipt.receipt_digest = canonicalArtifactDigest(receipt, "receipt_digest");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(receipt), {
      status: 202,
      headers: { "content-type": "application/json" },
    }));

    await expect(forwardSceneObjectDiscovery({
      request: value,
      endpointUrl: "https://pipeline.example/discoveries",
      token: "secret",
    })).resolves.toMatchObject({ status: "forwarded", performed: true });
  });
});
