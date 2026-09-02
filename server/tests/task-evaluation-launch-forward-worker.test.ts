// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null }));

import {
  CANONICAL_TASK_EVALUATION_ALLOCATOR,
  buildTaskEvaluationLaunchRequest,
} from "../utils/taskEvaluationLaunchContract";
import { canonicalArtifactDigest } from "../utils/taskCandidateContract";
import {
  buildExpiredControlPlaneTerminalBlocker,
  closeExpiredTaskEvaluationLaunches,
  forwardStoredPolicyCanaryRun,
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

  it("retries a stored policy canary forward under the same immutable run id", async () => {
    const canary = record();
    canary.request.run_kind = "internal_policy_canary";
    canary.request.launch_id = "scene-839873-policy-canary-001";
    canary.request.run_id = "scene-839873-policy-canary-001";
    canary.request.request_digest = canonicalArtifactDigest(
      canary.request,
      "request_digest",
    );
    canary.request_digest = canary.request.request_digest;
    const first = await forwardStoredPolicyCanaryRun(
      canary,
      vi.fn(async () => ({
        status: "blocked" as const,
        blocker: "pipeline_temporarily_unavailable",
      })),
    );

    expect(first).toMatchObject({
      state: "forward_blocked",
      phase: "blocked",
      retryable: true,
      forward_attempt_count: 1,
    });

    const replay = {
      ...canary,
      ...first,
      next_forward_at_iso: "2026-01-01T00:00:00.000Z",
    };
    const second = await forwardStoredPolicyCanaryRun(
      replay,
      vi.fn(async () => ({
        status: "forwarded" as const,
        performed: true,
        required: true,
        endpoint_configured: true,
        pipeline_intake_status: "accepted" as const,
      })),
    );

    expect(second).toMatchObject({
      state: "queued",
      phase: "preparing",
      retryable: false,
      forward_attempt_count: 2,
    });
  });

  it("retains a typed control-plane blocker only after an accepted launch authority expires", () => {
    const queued = { ...record(), state: "queued_in_pipeline" };
    const beforeExpiry = buildExpiredControlPlaneTerminalBlocker(
      queued,
      Date.parse("2026-08-11T11:59:59.999Z"),
    );
    const afterExpiry = buildExpiredControlPlaneTerminalBlocker(
      queued,
      Date.parse("2026-08-11T12:00:00.000Z"),
    );

    expect(beforeExpiry).toBeNull();
    expect(afterExpiry).toMatchObject({
      state: "control_plane_terminal_blocked",
      retryable: false,
      paid_execution_retry_performed: false,
      control_plane_terminal_blocker: {
        schema_version: "task_evaluation_launch_control_plane_blocker.v1",
        code: "control_plane_terminal_receipt_missing_after_spend_authority_expiry",
        pipeline_terminal_receipt_observed: false,
        provider_mutation_performed_by_webapp: false,
        execution_result: "not_observed",
        scripted_positive_controls_result: "not_observed",
        learned_policy_result: "not_observed",
      },
    });
    expect(afterExpiry).not.toHaveProperty("terminal_receipt");
  });

  it("durably closes only the exact expired queued launch without a provider action", async () => {
    const records = new Map<string, Record<string, any>>([
      ["launch-001", { ...record(), state: "queued_in_pipeline", provider_mutation_observed: true }],
    ]);
    const ref = (id: string) => ({
      id,
      get: async () => {
        const value = records.get(id);
        return { exists: Boolean(value), data: () => value && structuredClone(value) };
      },
    });
    const firestore = {
      collection: () => ({
        where: (_field: string, _operator: string, state: string) => ({
          limit: (limit: number) => ({
            get: async () => ({
              docs: [...records.entries()]
                .filter(([, value]) => value.state === state)
                .slice(0, limit)
                .map(([id, value]) => ({ ref: ref(id), data: () => structuredClone(value) })),
            }),
          }),
        }),
      }),
      runTransaction: async <T>(callback: (transaction: any) => Promise<T>) => callback({
        get: async (target: ReturnType<typeof ref>) => target.get(),
        set: (target: ReturnType<typeof ref>, value: Record<string, any>, options?: { merge?: boolean }) => {
          records.set(target.id, options?.merge
            ? { ...(records.get(target.id) || {}), ...structuredClone(value) }
            : structuredClone(value));
        },
      }),
    };

    const result = await closeExpiredTaskEvaluationLaunches(10, {
      firestore: firestore as any,
      nowMs: () => Date.parse("2026-08-11T12:00:00.000Z"),
    });

    expect(result).toEqual({ status: "completed", closed: 1 });
    expect(records.get("launch-001")).toMatchObject({
      state: "control_plane_terminal_blocked",
      provider_mutation_observed: true,
      paid_execution_retry_performed: false,
      control_plane_terminal_blocker: {
        execution_result: "not_observed",
        scripted_positive_controls_result: "not_observed",
        learned_policy_result: "not_observed",
      },
    });
  });
});
