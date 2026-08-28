import { describe, expect, it, vi } from "vitest";

import {
  bindConfiguredSceneOfferingToPreparation,
  fetchAuthenticatedConfiguredSceneThumbnail,
  type ConfiguredSceneOfferingCard,
} from "./configuredSceneOffering";

const sha = (character: string) => `sha256:${character.repeat(64)}`;

function offering(): ConfiguredSceneOfferingCard {
  return {
    source_launch_id: "scene-launch-1",
    status: "launch_ready",
    offering_digest: sha("a"),
    configuration_run_id: "scene-run-1",
    team_namespace: "team-1",
    scene_identity: { id: "scene-1", version: "v1" },
    task: {
      identity: { id: "relocate-1", version: "v1" },
      kind: "rigid_relocation",
      strategy: "planar_push",
      subject_identity: { id: "object-1", version: "v1" },
    },
    presentation: {
      thumbnail_url: "/thumbnail",
      selection: { camera_id: "camera-3", rationale: "Upright task view" },
      selected_from_exact_reviewed_frame_count: 8,
    },
    evaluation_preparation_binding: {
      configuration_source_commit: "a".repeat(40),
      scene_mode: "reuse_configured_revision",
      construction_mode: "reuse_configured_scene",
      task_binding_mode: "reuse_configured_template",
      configured_scene_revision: {
        uri: "gs://bucket/revision.json", digest: sha("c"), size_bytes: 100,
      },
      configured_scene_revision_digest: sha("d"),
      configured_scene_bundle: {
        uri: "gs://bucket/bundle.zip", digest: sha("e"), size_bytes: 200,
      },
    },
    proof_boundary: {
      thumbnail_is_derived_appearance_evidence: true,
      thumbnail_is_capture_or_physical_evidence: false,
      configuration_is_policy_evaluation: false,
      configuration_is_deployment_or_safety_approval: false,
    },
  };
}

describe("configured scene offering preparation binding", () => {
  it("keeps a controls-pending configured scene out of evaluation preparation", () => {
    const pending = offering();
    pending.status = "configured_controls_pending";

    expect(() => bindConfiguredSceneOfferingToPreparation({}, pending)).toThrow(
      "Configured scene offering is not launch-ready",
    );
  });

  it("preserves team runtime inputs while replacing every configured-scene identity", () => {
    const result = bindConfiguredSceneOfferingToPreparation({
      preparation_id: "prep-1",
      run_id: "run-1",
      expected_production_commit: "b".repeat(40),
      robot: { identity: { id: "robot", version: "v1" } },
      controller: { identity: { id: "policy", version: "v1" } },
      task: {
        definition: { uri: "gs://old/definition", digest: sha("f"), size_bytes: 1 },
        subject: { source_object: { uri: "gs://old/object", digest: sha("f"), size_bytes: 1 } },
      },
    }, offering());

    expect(result).toMatchObject({
      preparation_id: "prep-1",
      run_id: "run-1",
      run_mode: "episode_evaluation",
      expected_production_commit: "b".repeat(40),
      team_namespace: "team-1",
      scene: {
        mode: "reuse_configured_revision",
        configured_revision: { digest: sha("c") },
      },
      construction: { mode: "reuse_configured_scene" },
      task: {
        binding_mode: "reuse_configured_template",
        configured_scene_revision_digest: sha("d"),
        subject: { mode: "configured_scene_object", physics_authority: "configured_scene_revision" },
      },
      robot: { identity: { id: "robot", version: "v1" } },
      controller: { identity: { id: "policy", version: "v1" } },
    });
    expect(result.task).not.toHaveProperty("definition");
    expect(result.task.subject).not.toHaveProperty("source_object");
  });

  it("fetches the private thumbnail with Firebase authorization", async () => {
    const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer firebase-token");
      return new Response(new Blob(["png-bytes"], { type: "image/png" }), { status: 200 });
    });
    const blob = await fetchAuthenticatedConfiguredSceneThumbnail(
      "/api/configured-scene-offerings/launch-1/thumbnail",
      { authorization: "Bearer firebase-token" },
      fetcher as typeof fetch,
    );
    expect(await blob.text()).toBe("png-bytes");
  });
});
