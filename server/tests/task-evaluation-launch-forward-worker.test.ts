// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null }));

import {
  CANONICAL_TASK_EVALUATION_ALLOCATOR,
  buildTaskEvaluationLaunchRequest,
} from "../utils/taskEvaluationLaunchContract";
import {
  forwardStoredTaskEvaluationLaunch,
  validateStoredTaskEvaluationLaunch,
} from "../utils/taskEvaluationLaunchForwardWorker";

const sha = (character: string) => `sha256:${character.repeat(64)}`;

function record() {
  const profile = {
    profile_id: "interiorgs-sage-franka-001",
    profile_digest: sha("a"),
    source_bundle: {
      bundle_id: "scene-001", source_kind: "interiorgs_sage" as const,
      uri: "gs://blueprint-runs/scene.json", digest: sha("b"),
    },
    evaluation_run_spec: { uri: "gs://blueprint-runs/spec.json", digest: sha("c") },
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
  const request = buildTaskEvaluationLaunchRequest({
    profile,
    actorId: "founder-001",
    actorRole: "admin",
    authorizedAt: "2026-08-10T12:00:00.000Z",
    input: {
      launch_id: "launch-001",
      run_id: "run-001",
      profile_id: profile.profile_id,
      profile_digest: profile.profile_digest,
      rights: { scope: "test", evidence: { uri: "firestore://rights/1", digest: sha("d") } },
      spend: { max_spend_usd: 2, expires_at: "2026-08-11T12:00:00.000Z" },
      confirm_execution: true,
    },
  });
  return {
    state: "forward_pending",
    request,
    request_digest: request.request_digest,
    forward_attempt_count: 0,
  };
}

afterEach(() => {
  delete process.env.TASK_EVALUATION_LAUNCH_FORWARD_MAX_ATTEMPTS;
});

describe("Task Evaluation launch forward worker", () => {
  it("replays only the same digest-bound intake and never a paid execution", async () => {
    const forwarder = vi.fn(async () => ({
      status: "forwarded" as const,
      performed: true,
      required: true,
      endpoint_configured: true,
      pipeline_intake_status: "accepted" as const,
    }));

    const result = await forwardStoredTaskEvaluationLaunch(record(), forwarder);

    expect(result).toMatchObject({
      state: "queued_in_pipeline",
      forward_attempt_count: 1,
      provider_mutation_performed: false,
      paid_execution_retry_performed: false,
    });
    expect(forwarder).toHaveBeenCalledTimes(1);
  });

  it("terminally blocks a tampered stored request before network forwarding", async () => {
    const tampered = record();
    tampered.request.run_id = "changed";
    const forwarder = vi.fn();

    expect(validateStoredTaskEvaluationLaunch(tampered)).toContain(
      "stored_launch_request_digest_mismatch",
    );
    const result = await forwardStoredTaskEvaluationLaunch(tampered, forwarder);

    expect(result).toMatchObject({
      state: "forward_terminal_blocked",
      retryable: false,
      paid_execution_retry_performed: false,
    });
    expect(forwarder).not.toHaveBeenCalled();
  });
});
