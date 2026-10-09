// @vitest-environment node
/** Opt-in real Firestore emulator parity for the P1 stale-forward repair. */
import {afterAll,beforeEach,describe,it,expect,vi} from "vitest";
const forward=vi.hoisted(()=>vi.fn());
const enabled=process.env.BLUEPRINT_FORWARD_EMULATOR_TEST === "1";
vi.mock("../../client/src/lib/firebaseAdmin",async()=>{
 if(process.env.BLUEPRINT_FORWARD_EMULATOR_TEST !== "1")return {dbAdmin:null,authAdmin:null};
 if(process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080" || process.env.GOOGLE_CLOUD_PROJECT !== "demo-blueprint-reliability-b")throw new Error("Owned demo B emulator required");
 const {default:admin}=await import("firebase-admin");
 const app=admin.initializeApp({projectId:"demo-blueprint-reliability-b"},"b-forward-repair-parity");
 return {dbAdmin:admin.firestore(app),authAdmin:{getUser:async()=>({customClaims:{admin:true},disabled:false})}};
});
vi.mock("../utils/taskEvaluationLaunchContract",async original=>({...await original<typeof import("../utils/taskEvaluationLaunchContract")>(),forwardTaskEvaluationLaunch:forward}));
vi.mock("../logger",()=>({logger:{info:vi.fn(),warn:vi.fn(),error:vi.fn()}}));
import {dbAdmin as db} from "../../client/src/lib/firebaseAdmin";
import {CANONICAL_TASK_EVALUATION_ALLOCATOR,buildTaskEvaluationLaunchRequest} from "../utils/taskEvaluationLaunchContract";
import {processTaskEvaluationLaunchForwardQueue} from "../utils/taskEvaluationLaunchForwardWorker";
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
      launch_id: "b-forward-emulator-001",
      run_id: "b-forward-emulator-run-001",
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

beforeEach(async()=>{if(!enabled)return;forward.mockReset();await db!.collection("taskEvaluationLaunches").doc("b-forward-emulator-001").set(record());});
afterAll(async()=>{if(enabled)await db!.terminate();});
describe.skipIf(!enabled)("real Firestore emulator stale forward fencing (mocked authority and upstream)",()=>{
 it("preserves terminal callback through actual transaction",async()=>{
  forward.mockImplementation(async()=>{await db!.collection("taskEvaluationLaunches").doc("b-forward-emulator-001").set({state:"completed",terminal_receipt:{status:"completed"}},{merge:true});return {status:"forwarded",pipeline_intake_status:"accepted"};});
  await processTaskEvaluationLaunchForwardQueue();
  expect((await db!.collection("taskEvaluationLaunches").doc("b-forward-emulator-001").get()).data()).toMatchObject({state:"completed",terminal_receipt:{status:"completed"}});
 });
 it("applies unchanged happy receipt through actual transaction",async()=>{
  forward.mockResolvedValue({status:"forwarded",pipeline_intake_status:"accepted"});
  expect(await processTaskEvaluationLaunchForwardQueue()).toMatchObject({processed:1});
  expect((await db!.collection("taskEvaluationLaunches").doc("b-forward-emulator-001").get()).data()).toMatchObject({state:"queued_in_pipeline",forward_attempt_count:1});
 });
});
