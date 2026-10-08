// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestore as db, sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
const forward = vi.hoisted(() => vi.fn());
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({ dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore, authAdmin: { getUser: async () => ({customClaims:{admin:true}, disabled:false}) } }));
vi.mock("../logger", () => ({logger:{warn:vi.fn(),info:vi.fn(),error:vi.fn()}}));
vi.mock("../utils/taskEvaluationLaunchContract", async importOriginal => ({...await importOriginal<typeof import("../utils/taskEvaluationLaunchContract")>(), forwardTaskEvaluationLaunch: forward}));
import { CANONICAL_TASK_EVALUATION_ALLOCATOR, buildTaskEvaluationLaunchRequest } from "../utils/taskEvaluationLaunchContract";
import { processTaskEvaluationLaunchForwardQueue } from "../utils/taskEvaluationLaunchForwardWorker";

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

beforeEach(() => { state.docs.clear(); forward.mockReset(); });
afterEach(() => {vi.restoreAllMocks();});
describe("immutable forward receipt application", () => {
  it.each(["completed", "failed", "cancelled", "control_plane_terminal_blocked"])("does not reopen %s when a Pipeline callback lands during forward", async terminal => {
    state.docs.set("taskEvaluationLaunches/launch-001", record());
    forward.mockImplementation(async () => {
      await db.collection("taskEvaluationLaunches").doc("launch-001").set({state:terminal, terminal_receipt:{status:terminal}}, {merge:true});
      return {status:"forwarded",pipeline_intake_status:"accepted"};
    });
    await processTaskEvaluationLaunchForwardQueue();
    expect(state.docs.get("taskEvaluationLaunches/launch-001")).toMatchObject({state:terminal,terminal_receipt:{status:terminal}});
  });
  it("does not attach an old receipt to a replaced request digest", async () => {
    state.docs.set("taskEvaluationLaunches/launch-001", record());
    forward.mockImplementation(async () => {
      await db.collection("taskEvaluationLaunches").doc("launch-001").set({request_digest:"sha256:successor"}, {merge:true});
      return {status:"forwarded",pipeline_intake_status:"accepted"};
    });
    await processTaskEvaluationLaunchForwardQueue();
    expect(state.docs.get("taskEvaluationLaunches/launch-001")?.state).toBe("forward_pending");
    expect(state.docs.get("taskEvaluationLaunches/launch-001")?.forward).toBeUndefined();
  });
  it("does not overwrite a newer forward attempt", async () => {
    state.docs.set("taskEvaluationLaunches/launch-001", record());
    forward.mockImplementation(async () => {
      await db.collection("taskEvaluationLaunches").doc("launch-001").set({forward_attempt_count:2,forward:{status:"newer"}}, {merge:true});
      return {status:"forwarded",pipeline_intake_status:"accepted"};
    });
    await processTaskEvaluationLaunchForwardQueue();
    expect(state.docs.get("taskEvaluationLaunches/launch-001")).toMatchObject({state:"forward_pending",forward_attempt_count:2,forward:{status:"newer"}});
  });
  it("preserves a policy canary terminal callback during forwarding", async () => {
    const launch = record();
    state.docs.set("taskEvaluationPolicyRuns/run-001", {...launch,run_kind:"internal_policy_canary",request:{...launch.request,run_kind:"internal_policy_canary"}});
    forward.mockImplementation(async () => {
      await db.collection("taskEvaluationPolicyRuns").doc("run-001").set({state:"completed",phase:"completed",terminal_receipt:{status:"completed"}}, {merge:true});
      return {status:"forwarded",pipeline_intake_status:"accepted"};
    });
    // Rebind the immutable request digest to the policy-canary request fixture.
    const {canonicalArtifactDigest} = await import("../utils/taskCandidateContract");
    const run = state.docs.get("taskEvaluationPolicyRuns/run-001") as any;
    run.request.request_digest=canonicalArtifactDigest(run.request,"request_digest");run.request_digest=run.request.request_digest;
    await processTaskEvaluationLaunchForwardQueue();
    expect(state.docs.get("taskEvaluationPolicyRuns/run-001")).toMatchObject({state:"completed",phase:"completed",terminal_receipt:{status:"completed"}});
  });
  it("fences two overlapping workers from applying two responses", async () => {
    state.docs.set("taskEvaluationLaunches/launch-001", record());
    let release!: () => void;
    const held = new Promise<void>(resolve => {release=resolve;});
    forward.mockImplementation(async () => {await held;return {status:"forwarded",pipeline_intake_status:"accepted"};});
    const runs=[processTaskEvaluationLaunchForwardQueue(),processTaskEvaluationLaunchForwardQueue()];
    const completed=Promise.allSettled(runs);
    try {await vi.waitFor(()=>expect(forward).toHaveBeenCalledTimes(2));}finally{release();}
    const receipts=await completed;
    for(const receipt of receipts)if(receipt.status==="rejected")throw receipt.reason;
    expect(receipts.reduce((sum,receipt)=>sum+(receipt.status==="fulfilled"?receipt.value.processed:0),0)).toBe(1);
    expect(state.docs.get("taskEvaluationLaunches/launch-001")).toMatchObject({state:"queued_in_pipeline",forward_attempt_count:1});
  });
  it("applies an unchanged pending receipt", async () => {
    state.docs.set("taskEvaluationLaunches/launch-001", record());
    forward.mockResolvedValue({status:"forwarded",pipeline_intake_status:"accepted"});
    expect(await processTaskEvaluationLaunchForwardQueue()).toMatchObject({processed:1});
    expect(state.docs.get("taskEvaluationLaunches/launch-001")).toMatchObject({state:"queued_in_pipeline",forward_attempt_count:1});
  });
});
