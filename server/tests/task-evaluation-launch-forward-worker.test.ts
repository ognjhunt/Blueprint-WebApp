// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const authority = vi.hoisted(()=>({enabled:true, advisoryTick: vi.fn(), coverageTick: vi.fn(), db: null as any,
  jobEvidenceTick: vi.fn(async () => {}), sceneIntakeTick: vi.fn(async () => {})}));
vi.mock("../utils/jobEvidenceForwardWorker", () => ({processJobEvidenceForwardQueue: authority.jobEvidenceTick}));
vi.mock("../utils/captureCoverageQueue", () => ({tickCoverageReviews: authority.coverageTick}));
vi.mock("../utils/taskEvaluationSceneIntake", () => ({processSceneIntakeQueue: authority.sceneIntakeTick}));
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ get dbAdmin() { return authority.db; }, authAdmin:{getUser:async()=>({customClaims:{admin:authority.enabled},disabled:false})} }));

import {
  CANONICAL_TASK_EVALUATION_ALLOCATOR,
  buildTaskEvaluationLaunchRequest,
} from "../utils/taskEvaluationLaunchContract";
import { canonicalArtifactDigest } from "../utils/taskCandidateContract";
import {
  forwardStoredTaskEvaluationLaunch,
  validateStoredTaskEvaluationLaunch,
  startTaskEvaluationLaunchForwardWorker,
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
  authority.enabled=true;
  authority.db=null;
  authority.sceneIntakeTick.mockReset().mockResolvedValue(undefined);
  authority.jobEvidenceTick.mockReset().mockResolvedValue(undefined);
  authority.coverageTick.mockReset();
  delete process.env.TASK_EVALUATION_LAUNCH_FORWARD_MAX_ATTEMPTS;
});

it("does not overlap slow scene or forwarding batches while other lanes keep progressing", async () => {
  vi.useFakeTimers();
  vi.stubEnv("BLUEPRINT_TASK_EVALUATION_LAUNCH_FORWARD_WORKER_ENABLED", "true");
  vi.stubEnv("BLUEPRINT_SITE_VIDEO_EVIDENCE_ENABLED", "false");
  vi.stubEnv("TASK_EVALUATION_LAUNCH_FORWARD_WORKER_INTERVAL_MS", "10000");
  vi.stubEnv("TASK_EVALUATION_LAUNCH_STORE_TIMEOUT_MS", "60000");
  let finishScene!: () => void, finishForward!: (value: {docs: never[]}) => void;
  authority.sceneIntakeTick.mockImplementationOnce(() => new Promise<void>(resolve => { finishScene = resolve; }));
  const forwardReads = vi.fn(() => new Promise<{docs: never[]}>(resolve => { finishForward = resolve; }));
  const terminalReads = vi.fn(async () => ({docs: []}));
  authority.db = { collection: (collection: string) => {
    let state: string;
    const query: any = {where: (_field: string, _op: string, value: string) => {state = value; return query;},
      limit: () => query, get: () => collection === "taskEvaluationLaunches" && state === "forward_pending"
        ? forwardReads() : terminalReads()};
    return query;
  }};
  const stop = startTaskEvaluationLaunchForwardWorker();
  try {
    await vi.advanceTimersByTimeAsync(30000);
    expect(authority.sceneIntakeTick).toHaveBeenCalledTimes(1);
    expect(forwardReads).toHaveBeenCalledTimes(1);
    expect(authority.jobEvidenceTick).toHaveBeenCalledTimes(4);
    expect(terminalReads).toHaveBeenCalledTimes(0); // No other lane reads launches.
    finishScene(); finishForward({docs: []});
    await vi.advanceTimersByTimeAsync(10000);
    expect(authority.sceneIntakeTick).toHaveBeenCalledTimes(2);
    expect(forwardReads).toHaveBeenCalledTimes(2);
    stop(); finishForward({docs: []});
    await vi.advanceTimersByTimeAsync(10000);
    expect(forwardReads).toHaveBeenCalledTimes(2);
  } finally {stop(); vi.useRealTimers(); vi.unstubAllEnvs();}
});

it("releases a failed lane for the next normal tick and contains synchronous errors", async () => {
  vi.useFakeTimers();
  vi.stubEnv("BLUEPRINT_TASK_EVALUATION_LAUNCH_FORWARD_WORKER_ENABLED", "true");
  vi.stubEnv("BLUEPRINT_SITE_VIDEO_EVIDENCE_ENABLED", "false");
  authority.sceneIntakeTick.mockImplementationOnce(() => {throw Error("synthetic_lane_failure");});
  const stop = startTaskEvaluationLaunchForwardWorker();
  try {
    await vi.advanceTimersByTimeAsync(5000);
    expect(authority.sceneIntakeTick).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(55000);
    expect(authority.sceneIntakeTick).toHaveBeenCalledTimes(2);
  } finally {stop(); vi.useRealTimers(); vi.unstubAllEnvs();}
});

describe("Task Evaluation launch forward worker", () => {
  it("refuses a historical admin launch when current verified claims are absent",async()=>{
    authority.enabled=false;const forwarder=vi.fn();
    expect(await forwardStoredTaskEvaluationLaunch(record(),forwarder)).toMatchObject({state:"forward_terminal_blocked",blockers:["execution_actor_verified_custom_claims_required"]});
    expect(forwarder).not.toHaveBeenCalled();
  });
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


it("launch-only loop ticks enabled coverage review without broad automation and stops with the worker", async () => {
  vi.useFakeTimers();
  vi.stubEnv("BLUEPRINT_TASK_EVALUATION_LAUNCH_FORWARD_WORKER_ENABLED", "true");
  vi.stubEnv("BLUEPRINT_TASK_EVALUATION_LAUNCH_FORWARD_ONLY_WORKER", "true");
  vi.stubEnv("BLUEPRINT_SITE_VIDEO_EVIDENCE_ENABLED", "false");
  const stop=startTaskEvaluationLaunchForwardWorker();
  try {
    await vi.advanceTimersByTimeAsync(5_000);
    expect(authority.coverageTick).not.toHaveBeenCalled();
    vi.stubEnv("BLUEPRINT_SITE_VIDEO_EVIDENCE_ENABLED", "true");
    await vi.advanceTimersByTimeAsync(55_000);
    expect(authority.coverageTick).toHaveBeenCalledExactlyOnceWith(2, { notifyOwner: false });
    stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(authority.coverageTick).toHaveBeenCalledTimes(1);
  } finally {stop();vi.useRealTimers();vi.unstubAllEnvs();}
});


it("keeps slow coverage recovery single-flight", async () => {
  vi.useFakeTimers();
  vi.stubEnv("BLUEPRINT_TASK_EVALUATION_LAUNCH_FORWARD_WORKER_ENABLED", "true");
  vi.stubEnv("BLUEPRINT_SITE_VIDEO_EVIDENCE_ENABLED", "true");
  vi.stubEnv("TASK_EVALUATION_LAUNCH_FORWARD_WORKER_INTERVAL_MS", "10000");
  let finish!: () => void;
  authority.coverageTick.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  const stop = startTaskEvaluationLaunchForwardWorker();
  try {
    await vi.advanceTimersByTimeAsync(30000);
    expect(authority.coverageTick).toHaveBeenCalledTimes(1);
    finish();
    await vi.advanceTimersByTimeAsync(10000);
    expect(authority.coverageTick).toHaveBeenCalledTimes(2);
    stop();
    await vi.advanceTimersByTimeAsync(10000);
    expect(authority.coverageTick).toHaveBeenCalledTimes(2);
  } finally { stop(); vi.useRealTimers(); vi.unstubAllEnvs(); }
});
