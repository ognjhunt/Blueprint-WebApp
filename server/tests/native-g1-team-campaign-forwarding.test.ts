// @vitest-environment node
import { createHmac } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";

import { crossRuntimeArtifactDigest } from "../utils/crossRuntimeCanonical";
import { fetchG1TeamCatalog, g1SubmissionSchema, submitG1TeamCampaign } from "../utils/nativeG1TeamCampaignForwarding";

const hash = (digit: string) => `sha256:${digit.repeat(64)}`;
const owner = { user_id: "owner", organization_id: "user:owner" };

function fixture() {
  const candidates = [
    { candidate_id: "humanoidarena_dp_g1_dex3_sonic", evaluation_objective_id: "task_success" },
    { candidate_id: "humanoidarena_pi05_g1_dex3_sonic", evaluation_objective_id: "task_success" },
    { candidate_id: "humanoidarena_dp_g1_dex3_sonic_vision_navi", evaluation_objective_id: "g1_navigation_goal" },
    { candidate_id: "humanoidarena_pi05_g1_dex3_sonic_vision_navi", evaluation_objective_id: "g1_navigation_goal" },
  ];
  const baseSetup = {
    schema_version: "task_evaluation_packet_planning_setup.v1" as const,
    claim_ceiling: "planning_only" as const,
    scene_id: "interiorgs-841757",
    task_id: "scene-841757-book-to-marked-area",
    source_packet_receipt_digest: hash("1"),
    robot_presets: [{ robot_preset_id: "unitree_g1_dex3_sonic_v1", policy_candidates: candidates }],
  };
  const setup = { ...baseSetup, setup_digest: crossRuntimeArtifactDigest(baseSetup, "setup_digest") };
  const baseCatalog = {
    schema_version: "native_g1_team_campaign_setup_catalog.v1" as const,
    owner, setups: [setup], claim_ceiling: "planning_only" as const,
    provider_mutation_performed: false as const,
  };
  const catalog = { ...baseCatalog, catalog_digest: crossRuntimeArtifactDigest(baseCatalog, "catalog_digest") };
  function handoff(objective: "task_success" | "g1_navigation_goal") {
    const baseChoice = {
      schema_version: "task_evaluation_packet_policy_pair_choice.v1" as const,
      claim_ceiling: "planning_only" as const,
      setup_digest: setup.setup_digest,
      source_packet_receipt_digest: setup.source_packet_receipt_digest,
      robot_preset_id: setup.robot_presets[0].robot_preset_id,
      policy_candidate_ids: candidates.filter((item) => item.evaluation_objective_id === objective)
        .map((item) => item.candidate_id) as [string, string],
      objective_id: objective,
    };
    const choice = { ...baseChoice, choice_digest: crossRuntimeArtifactDigest(baseChoice, "choice_digest") };
    const baseHandoff = {
      schema_version: "task_evaluation_packet_policy_handoff.v1" as const,
      claim_ceiling: "planning_only" as const,
      setup, choice,
    };
    return { ...baseHandoff, handoff_digest: crossRuntimeArtifactDigest(baseHandoff, "handoff_digest") };
  }
  const input = {
    run_id: "g1-team-run-1",
    setup_digest: setup.setup_digest,
    book_handoff: handoff("task_success"),
    movement_handoff: handoff("g1_navigation_goal"),
    authorization_expires_at_epoch: Date.now() / 1000 + 1800,
    authorize_maximum_cost_usd_12: true as const,
    maximum_cost_usd: 10.75,
  };
  return { catalog, input };
}

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("accepts an exact lower spend cap and rejects overspend or fractional cents", () => {
  const { input } = fixture();
  expect(g1SubmissionSchema.parse(input).maximum_cost_usd).toBe(10.75);
  expect(g1SubmissionSchema.safeParse({ ...input, maximum_cost_usd: 12.01 }).success).toBe(false);
  expect(g1SubmissionSchema.safeParse({ ...input, maximum_cost_usd: 10.751 }).success).toBe(false);
  const { maximum_cost_usd: _oldField, ...legacy } = input;
  expect(g1SubmissionSchema.parse(legacy).maximum_cost_usd).toBe(12);
});

it("forwards one exact G1 team choice with signed owner and bounded spend", async () => {
  const { catalog, input } = fixture();
  vi.stubEnv("TASK_EVALUATION_LAUNCH_URL", "https://pipeline.test/old-path");
  vi.stubEnv("ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN", "test-secret");
  const paths: string[] = [];
  const fetchMock = vi.fn(async (url: unknown, options: any) => {
    paths.push(String(url));
    const headers = options.headers;
    const expected = createHmac("sha256", "test-secret")
      .update(`${headers["x-blueprint-pipeline-timestamp"]}.blueprint-webapp.${headers["x-blueprint-pipeline-nonce"]}.${options.body}`)
      .digest("hex");
    expect(headers["x-blueprint-pipeline-signature"]).toBe(`sha256=${expected}`);
    if (paths.length === 1) return new Response(JSON.stringify(catalog));
    const request = JSON.parse(options.body);
    expect(request).toMatchObject({
      owner, scene_id: "interiorgs-841757", claim_ceiling: "development_only",
      public_redistribution_authorized: false,
      authorization: { maximum_cost_usd: 10.75, hard_ttl_seconds: 14_400,
        expires_at_epoch: input.authorization_expires_at_epoch, retry_cap: 0 },
    });
    const baseReceipt = {
      schema_version: "native_g1_team_campaign_intake_receipt.v1",
      status: "accepted_not_dispatched",
      intent_id: "g1-" + "a".repeat(64), intent_digest: hash("2"),
      request_digest: request.request_digest,
      provider_mutation_performed_inside_http_request: false,
    };
    return new Response(JSON.stringify({
      ...baseReceipt, receipt_digest: crossRuntimeArtifactDigest(baseReceipt, "receipt_digest"),
    }));
  });
  vi.stubGlobal("fetch", fetchMock);
  await expect(submitG1TeamCampaign(input, owner)).resolves.toMatchObject({
    status: "accepted_not_dispatched",
  });
  expect(paths).toEqual([
    "https://pipeline.test/api/live-pipeline/native-g1-team-campaign-setups",
    "https://pipeline.test/api/live-pipeline/native-g1-team-campaigns",
  ]);
});

it("rejects a changed owner catalog and a swapped objective before intake", async () => {
  const { catalog, input } = fixture();
  vi.stubEnv("TASK_EVALUATION_LAUNCH_URL", "https://pipeline.test");
  vi.stubEnv("ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN", "test-secret");
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(catalog)));
  vi.stubGlobal("fetch", fetchMock);
  await expect(fetchG1TeamCatalog({ user_id: "other", organization_id: "user:other" }))
    .rejects.toThrow("g1_catalog_binding_invalid");
  input.book_handoff = input.movement_handoff as typeof input.book_handoff;
  await expect(submitG1TeamCampaign(input, owner)).rejects.toThrow("g1_handoff_binding_invalid");
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
