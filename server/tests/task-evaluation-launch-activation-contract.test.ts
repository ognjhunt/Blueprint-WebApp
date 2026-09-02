// @vitest-environment node
import { describe, expect, it } from "vitest";

import { taskEvaluationLaunchActivationInputSchema } from "../utils/taskEvaluationLaunchActivationContract";

const digest = (character: string) => `sha256:${character.repeat(64)}`;
const reference = (character: string) => ({
  uri: `s3://blueprint/activation/${character}.json`,
  digest: digest(character),
  size_bytes: 128,
});

function canaryActivation() {
  return {
    schema_version: "task_evaluation_launch_activation_request.v1",
    expected_production_commit: "a".repeat(40),
    activation_id: "scene-839873-policy-canary-activation",
    team_namespace: "blueprint-internal",
    run_kind: "internal_policy_canary",
    capture_session_id: "scene-839873-configured-source",
    intake_id: "scene-839873-configuration-run",
    lane: "native_task_arena_policy_evaluation",
    preparation: {
      preparation_id: "scene-839873-policy-canary-preparation",
      request_digest: digest("b"),
      result_digest: digest("c"),
    },
    release_window: reference("d"),
    lineage: {
      kind: "predecessor",
      prior_authority: reference("e"),
      prior_result: reference("f"),
      prior_launch_receipt: reference("1"),
      prior_webapp_sync: reference("2"),
      prior_provider_zero: reference("3"),
      prior_spend_reconciliation: reference("4"),
      construction_result: reference("5"),
    },
    authorization: {
      reference: "automatic policy-canary activation",
      authorized_by: "blueprint-policy-lead",
      authorized_on: "2026-09-01T12:00:00.000Z",
      standing_authorization_expires_at: "2026-09-01T13:00:00.000Z",
      profile_revision: "policy-canary-v1",
    },
    requested_mutations: {
      profile_publication: false,
      catalog_synchronization: false,
      standing_authorization: false,
      policy_campaign_queue: true,
    },
  };
}

describe("Task Evaluation policy-canary activation contract", () => {
  it("admits only the automated unqualified campaign-queue mutation", () => {
    expect(taskEvaluationLaunchActivationInputSchema.parse(canaryActivation())).toMatchObject({
      lane: "native_task_arena_policy_evaluation",
      run_kind: "internal_policy_canary",
      requested_mutations: { policy_campaign_queue: true },
    });
  });

  it("rejects profile authority mutation on the canary lane", () => {
    const request = canaryActivation();
    request.requested_mutations.profile_publication = true;
    expect(taskEvaluationLaunchActivationInputSchema.safeParse(request).success).toBe(false);
  });
});
