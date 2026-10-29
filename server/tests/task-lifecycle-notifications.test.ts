// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState } from "./helpers/fake-firestore";
import { syntheticQualifiedAdmission, syntheticSiteTaskQualification, syntheticEpisodeOutcomes } from "./helpers/recommendation-evidence";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return {
    default: { firestore: { FieldValue: {
      serverTimestamp: () => "SERVER_TIMESTAMP",
      delete: () => FAKE_FIELD_DELETE,
    } } },
    dbAdmin: sharedFakeFirestore,
  };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/field-encryption", () => ({
  decryptFieldValue: vi.fn(async (value: string) => value.replace(/^encrypted:/, "")),
}));
const jobAccess = vi.hoisted(() => ({ evaluationAvailable: false }));
vi.mock("../utils/teamJobAccess", () => ({ teamJobAccess: () => jobAccess }));

const { enqueueTaskLifecycleNotification, reconstructionIsViewable, reconcileSceneReadyNotifications } = await import("../utils/taskLifecycleNotifications");

beforeEach(() => {
  sharedFakeFirestoreState.docs.clear();
  sharedFakeFirestoreState.docs.set("inboundRequests/req-1", {
    contact: { email: "encrypted:owner@example.com" },
  });
});

describe("task lifecycle notifications", () => {
  it("recognizes only a persisted ready world with something the owner can view", () => {
    expect(reconstructionIsViewable({ state: "processing", worldId: "w", assets: { launchUrl: "https://view" } })).toBe(false);
    expect(reconstructionIsViewable({ state: "ready", worldId: "w", assets: null })).toBe(false);
    expect(reconstructionIsViewable({ state: "ready", worldId: "w", assets: { launchUrl: null, spzUrlsByDetail: {} } })).toBe(false);
    expect(reconstructionIsViewable({ state: "ready", worldId: "w", assets: { thumbnailUrl: "https://thumb", spzUrlsByDetail: {} } })).toBe(false);
    expect(reconstructionIsViewable({ state: "ready", worldId: "w", assets: { launchUrl: "javascript:alert(1)" } })).toBe(false);
    expect(reconstructionIsViewable({ state: "ready", worldId: "w", assets: { spzUrlsByDetail: { full: "https://assets/scene.spz" } } })).toBe(false);
    expect(reconstructionIsViewable({ state: "ready", worldId: "w", assets: { launchUrl: "https://view" } })).toBe(true);
  });
  it("acknowledges a draft job without another confirmation step and deduplicates the private owner notice", async () => {
    sharedFakeFirestoreState.docs.set("siteTaskBriefs/req-1", { requestId: "req-1", summary: "Move cartons", confirmedAtIso: null });
    sharedFakeFirestoreState.docs.get("inboundRequests/req-1")!.request = { buyerType: "site_operator" };
    expect((await enqueueTaskLifecycleNotification({ requestId: "req-1", milestone: "video_received" })).enqueued).toBe(true);
    expect((await enqueueTaskLifecycleNotification({ requestId: "req-1", milestone: "video_received" })).enqueued).toBe(false);

    const row = sharedFakeFirestoreState.docs.get("captureOutbox/req-1:video_received") as Record<string, unknown>;
    expect(row.to).toBe("owner@example.com");
    expect(row.kind).toBe("video_received");
    expect(row.body).toMatch(/Blueprint handles reconstruction and evaluation/i);
    expect(`${row.subject} ${row.body}`).not.toMatch(/confirm|create an account|save this site to your account/i);
    expect(row.body).toMatch(/\/capture-upload\//);
    expect([...sharedFakeFirestoreState.docs.keys()].filter(key => key.startsWith("captureOutbox/"))).toHaveLength(1);
  });

  it("brings the site back to a viewable reconstruction without claiming a test result", async () => {
    await enqueueTaskLifecycleNotification({ requestId: "req-1", milestone: "scene_ready" });

    const scene = sharedFakeFirestoreState.docs.get("captureOutbox/req-1:scene_ready") as Record<string, unknown>;
    expect(scene.body).toMatch(/your scene is ready/i);
    expect(scene.body).not.toMatch(/has started an evaluation run|succeeded|result:/i);
    expect(scene.body).toMatch(/— The Blueprint team$/);
    expect(sharedFakeFirestoreState.docs.has("captureOutbox/req-1:screening_started")).toBe(false);
  });

  it("sends each run or request its own email, and a retry of one event none", async () => {
    await enqueueTaskLifecycleNotification({ requestId: "req-1", milestone: "results_ready", eventId: "run_a", detail: "12 of 50 simulated episodes succeeded" });
    await enqueueTaskLifecycleNotification({ requestId: "req-1", milestone: "results_ready", eventId: "run_b" });
    expect((await enqueueTaskLifecycleNotification({ requestId: "req-1", milestone: "results_ready", eventId: "run_a" })).enqueued).toBe(false);

    const first = sharedFakeFirestoreState.docs.get("captureOutbox/req-1:results_ready:run_a") as Record<string, string>;
    expect(first.body).toContain("12 of 50 simulated episodes succeeded");
    expect(first.body).toMatch(/not a physical test/i);
    // One candidate's run is a bounded estimate; there is no separate full-evaluation tier (owner, 2026-10-28).
    expect(first.body).toMatch(/bounded simulation estimate for one candidate, not a physical test; it never certifies physical performance or safety/);
    expect(first.body).not.toMatch(/finalists|full scoring|full evaluation/);
    expect(sharedFakeFirestoreState.docs.has("captureOutbox/req-1:results_ready:run_b")).toBe(true);
  });

  it("puts the private task link in the first email, so it is not only on the success screen", async () => {
    await enqueueTaskLifecycleNotification({ requestId: "req-1", milestone: "task_received" });
    const row = sharedFakeFirestoreState.docs.get("captureOutbox/req-1:task_received") as Record<string, string>;
    expect(row.body).toMatch(/\/capture-upload\//);
    expect(row.body).toMatch(/Blueprint handles reconstruction and evaluation/i);
    expect(row.body).not.toMatch(/questions that need your input|confirm.*brief/i);
  });

  it("does not enqueue without an authoritative owner contact", async () => {
    sharedFakeFirestoreState.docs.set("inboundRequests/req-2", { contact: {} });
    await expect(enqueueTaskLifecycleNotification({ requestId: "req-2", milestone: "scene_ready" }))
      .resolves.toEqual({ enqueued: false, reason: "contact_missing" });
    expect(sharedFakeFirestoreState.docs.has("captureOutbox/req-2:scene_ready")).toBe(false);
  });
});


it("recovers a persisted ready scene notice without another controller poll", async () => {
  sharedFakeFirestoreState.docs.set("captureUploadSessions/capture-1", {
    scene_notification_pending: true, notification_request_id: "req-1",
    world_reconstruction: { state: "ready", world_id: "world-1", assets: { launchUrl: "https://view.example/1" } },
  });
  await reconcileSceneReadyNotifications();
  expect(sharedFakeFirestoreState.docs.get("captureOutbox/req-1:scene_ready")).toBeDefined();
  expect(sharedFakeFirestoreState.docs.get("captureUploadSessions/capture-1")).toMatchObject({ scene_notification_pending: false });
  await reconcileSceneReadyNotifications();
  expect([...sharedFakeFirestoreState.docs.keys()].filter(key => key.endsWith(":scene_ready"))).toHaveLength(1);
});

describe('withdrawal fences capture-derived notices without suppressing recovery',()=>{
 it.each(['video_received','scene_ready','results_ready','run_no_result'] as const)('does not enqueue %s after persisted withdrawal',async milestone=>{
  sharedFakeFirestoreState.docs.set('inboundRequests/req-1',{contact:{email:'encrypted:owner@example.com'},request:{consent_attestation:{granted:false,withdrawn_at_iso:'2026-10-08T00:00:00Z'}}});
  expect(await enqueueTaskLifecycleNotification({requestId:'req-1',milestone})).toEqual({enqueued:false,reason:'consent_withdrawn'});
  expect([...sharedFakeFirestoreState.docs.keys()].some(key=>key.startsWith('captureOutbox/'))).toBe(false);
 });
 it('keeps the original intake receipt while derived generation is withdrawn',async()=>{
  sharedFakeFirestoreState.docs.set('inboundRequests/req-1',{contact:{email:'encrypted:owner@example.com'},consent_revoked:true});
  expect((await enqueueTaskLifecycleNotification({requestId:'req-1',milestone:'task_received'})).enqueued).toBe(true);
 });
 it('checks missing and legacy capture notice sources at the dispatch transaction boundary',async()=>{
  const {taskLifecycleNotificationIsCurrent}=await import('../utils/taskLifecycleNotificationAuthority');
  const {sharedFakeFirestore}=await import('./helpers/fake-firestore');
  expect(await taskLifecycleNotificationIsCurrent({requestId:'missing',kind:'assessment_ready'})).toBe(false);
  sharedFakeFirestoreState.docs.set('inboundRequests/req-1',{consent_revoked:true});
  await sharedFakeFirestore.runTransaction(async transaction=>{
   for(const kind of ['brief_confirmed','coverage_shortfall','assessment_ready','input_needed'] as const)
    expect(await taskLifecycleNotificationIsCurrent({requestId:'req-1',kind},transaction)).toBe(false);
   expect(await taskLifecycleNotificationIsCurrent({requestId:'req-1',kind:'fresh_link'},transaction)).toBe(true);
  });
 });
});

describe("pilot and listing notices describe the free beta", () => {
  const build = async (milestone: "listing_live" | "pilot_recommended" | "pilot_booked", detail?: string) => {
    const { buildTaskLifecycleNotification } = await import("../utils/taskLifecycleNotifications");
    return buildTaskLifecycleNotification({ requestId: "req-1", milestone, to: "owner@example.com",
      captureUrl: "https://tryblueprint.io/capture-upload/owner-token", detail });
  };

  it("tells a link-only site how to hide its card without an account", async () => {
    const notice = await build("listing_live");
    expect(notice.body).toContain('untick "Show this card in the job library"');
    expect(notice.body).toContain("https://tryblueprint.io/capture-upload/owner-token");
    expect(notice.body).not.toMatch(/Blueprint account|\/app\/tasks/);
  });

  it("asks the customer to review a delivery option without treating selection as a contract", async () => {
    const notice = await build("pilot_recommended");
    expect(notice.body).toMatch(/Review the scope, total cost and support before choosing/);
    expect(notice.body).toMatch(/paid to the delivery company, not to Blueprint/);
    expect(notice.body).toMatch(/Selection does not itself sign a contract or reserve a date/);
    expect(notice.body).not.toMatch(/book it there in one step/i);
  });

  it("confirms a booking, leaves the agreement to the site and team, and states no Blueprint fee", async () => {
    const free = await build("pilot_booked", "invited_beta_free");
    expect(free.subject).toBe("Your pilot selection is recorded");
    expect(free.body).toMatch(/^Your selection is recorded\./);
    expect(free.body).toContain("You and the delivery company agree the physical pilot's scope, price, dates and acceptance criteria directly.");
    expect(free.body).toContain("No contract is signed or date reserved by this selection.");
    expect(free.body).not.toMatch(/Blueprint owns/);
    expect(free.body).toContain("Blueprint charges nothing during the beta and takes no cut; the pilot's cost is agreed with the delivery company.");
    // A pre-beta booking keeps its accepted terms; the email neither restates a fee nor waives one.
    const historical = await build("pilot_booked");
    expect(historical.body).toContain("Your previously accepted commercial terms remain on file.");
    expect(historical.body).not.toMatch(/\bfee\b/i);
  });
});

describe("a waiting job hears what it is waiting on", () => {
  const scored = (episodes: number) => ({ schemaVersion: "blueprint.agent_run_result_scoring.v1", runtime: "team_evaluation_scored",
    successSource: "simulator_scored", scoredEpisodeCount: episodes, successContractDigest: `sha256:${"1".repeat(64)}`,
    sceneRevisionDigest: `sha256:${"2".repeat(64)}`, robotFreeProbeReceiptDigest: `sha256:${"3".repeat(64)}`,
    teamCandidateAdmissionDigest: `sha256:${"4".repeat(64)}`, sessionResultDigest: `sha256:${"5".repeat(64)}`, claimCeiling: "site_task_simulation",
    siteTaskQualification: syntheticSiteTaskQualification("capture-fixture", "req-1") });
  const run = (runId: string, state: string, succeeded: number | null) => sharedFakeFirestoreState.docs.set(`evaluationRuns/${runId}`, {
    runId, teamId: `team-${runId}`, sceneId: "req-1", executionAdmission: syntheticQualifiedAdmission("capture-fixture", "req-1"), evaluationPurpose: "pilot", state, executionCaptureId: "capture-fixture", quotedEpisodes: 200,
    ...(succeeded === null ? {} : { result: { scoring: scored(200), episodeOutcomes: syntheticEpisodeOutcomes(200, succeeded),
      observed: { episodesRun: 200, episodesSucceeded: succeeded, medianCycleSeconds: null } } }) });

  it("tells the site once that its job is ready for evaluation, only while true and before any run", async () => {
    const { notifyIfOpenForEvaluations } = await import("../utils/taskLifecycleNotifications");
    jobAccess.evaluationAvailable = false;
    expect((await notifyIfOpenForEvaluations("req-1")).enqueued).toBe(false);
    jobAccess.evaluationAvailable = true;
    expect((await notifyIfOpenForEvaluations("req-1")).enqueued).toBe(true);
    expect((await notifyIfOpenForEvaluations("req-1")).enqueued).toBe(false);
    const row = sharedFakeFirestoreState.docs.get("captureOutbox/req-1:awaiting_evaluations") as Record<string, string>;
    expect(row.subject).toBe("Your job is ready for evaluation");
    // Blueprint runs the candidates; partners can ask to be evaluated too (owner, 2026-10-26).
    expect(row.body).toMatch(/Next, Blueprint evaluates candidate robots and policies against it/);
    expect(row.body).toMatch(/Your job page shows where the evaluations stand\. Nothing is needed from you\./);
    expect(row.body).not.toMatch(/robot teams?/i);
    sharedFakeFirestoreState.docs.delete("captureOutbox/req-1:awaiting_evaluations");
    run("run_q", "requested", null);
    expect((await notifyIfOpenForEvaluations("req-1")).enqueued).toBe(false);
  });

  it("tells the site once its scene is ready and its first test started, only while true", async () => {
    const { notifyIfSceneTestsStarted, reconcileSceneTestsStartedNotices, notifySceneTestsStartedForLaunch } =
      await import("../utils/taskLifecycleNotifications");
    const { taskLifecycleNotificationIsCurrent } = await import("../utils/taskLifecycleNotificationAuthority");
    const taskId = `website-${"0".repeat(20)}`;
    sharedFakeFirestoreState.docs.set("taskEvaluationSceneIntakes/scene-1", { website_request_id: "req-1",
      source_session_id: "walkthrough-req-1", created_at_iso: "2026-10-22T00:00:00Z", state: "completed",
      pipeline_status: { status: "completed", phase: "scene_prepared" },
      request: { task: { task_id: taskId }, owner: { organization_id: "team-a" } } });
    sharedFakeFirestoreState.docs.set("taskEvaluationLaunches/launch-a", { configured_scene_offering: {
      task: { identity: { id: taskId } }, team_namespace: "team-a" } });
    // The room is built, but no test has started: nothing is said yet.
    expect((await notifyIfSceneTestsStarted("req-1")).enqueued).toBe(false);
    await reconcileSceneTestsStartedNotices();
    expect(sharedFakeFirestoreState.docs.has("captureOutbox/req-1:scene_tests_started")).toBe(false);
    const ready = { kind: "scene_tests_started" as const, requestId: "req-1" };
    expect(await taskLifecycleNotificationIsCurrent(ready)).toBe(false);
    sharedFakeFirestoreState.docs.set("taskEvaluationPolicyRuns/run-a", { source_launch_id: "launch-a",
      state: "queued_in_pipeline", launch_forward: { status: "forwarded" } });
    expect(await taskLifecycleNotificationIsCurrent(ready)).toBe(true);
    await notifySceneTestsStartedForLaunch("launch-a");
    const row = sharedFakeFirestoreState.docs.get("captureOutbox/req-1:scene_tests_started") as Record<string, string>;
    expect(row.subject).toBe("Your Blueprint scene is ready");
    expect(row.body).toMatch(/with your task's objects in place\. We are running our first tests on it now\. Nothing is needed from you for these tests/);
    expect(row.body).not.toMatch(/pass|recommend|robot team/i);
    expect((await notifyIfSceneTestsStarted("req-1")).enqueued).toBe(false);
    // The reconciler repairs a lost enqueue, once.
    sharedFakeFirestoreState.docs.delete("captureOutbox/req-1:scene_tests_started");
    await reconcileSceneTestsStartedNotices();
    expect(sharedFakeFirestoreState.docs.has("captureOutbox/req-1:scene_tests_started")).toBe(true);
    // A test that ended unrun is no longer a started test at dispatch.
    sharedFakeFirestoreState.docs.set("taskEvaluationPolicyRuns/run-a", { source_launch_id: "launch-a", state: "failed",
      launch_forward: { status: "forwarded" } });
    expect(await taskLifecycleNotificationIsCurrent(ready)).toBe(false);
  });

  it("is not sent once it has become false between enqueue and dispatch", async () => {
    const { taskLifecycleNotificationIsCurrent } = await import("../utils/taskLifecycleNotificationAuthority");
    jobAccess.evaluationAvailable = true;
    const waiting = { kind: "awaiting_evaluations" as const, requestId: "req-1" };
    expect(await taskLifecycleNotificationIsCurrent(waiting)).toBe(true);
    run("run_q", "requested", null);
    expect(await taskLifecycleNotificationIsCurrent(waiting)).toBe(false);
    run("run_q", "completed", 100);
    const none = { kind: "no_team_passed" as const, requestId: "req-1" };
    expect(await taskLifecycleNotificationIsCurrent(none)).toBe(true);
    run("run_p", "completed", 199);
    expect(await taskLifecycleNotificationIsCurrent(none)).toBe(false);
  });

  it("says no team passed only when every evaluation finished below the pass mark and nothing is recommended", async () => {
    const { notifyIfNoTeamPassed } = await import("../utils/taskLifecycleNotifications");
    run("run_a", "completed", 120);
    run("run_b", "blocked", null);
    expect((await notifyIfNoTeamPassed("req-1", "run_b")).enqueued).toBe(false);
    sharedFakeFirestoreState.docs.delete("evaluationRuns/run_b");
    expect((await notifyIfNoTeamPassed("req-1", "run_b")).enqueued).toBe(true);
    const row = sharedFakeFirestoreState.docs.get("captureOutbox/req-1:no_team_passed:run_b") as Record<string, string>;
    expect(row.subject).toBe("No evaluation of your job has passed yet");
    expect(row.body).not.toMatch(/robot teams?/i);
    expect(row.body).toMatch(/none passed\. /);
    expect(row.body).not.toMatch(/pilot recommendation|full evaluation/);

    run("run_c", "requested", null);
    expect((await notifyIfNoTeamPassed("req-1", "run_a")).enqueued).toBe(false);
    run("run_c", "completed", 195);
    expect((await notifyIfNoTeamPassed("req-1", "run_c")).enqueued).toBe(false);
    run("run_c", "completed", 100);
    sharedFakeFirestoreState.docs.set("inboundRequests/req-1", { contact: { email: "encrypted:owner@example.com" }, pilot_recommendation: { id: "rec" } });
    expect((await notifyIfNoTeamPassed("req-1", "run_c")).enqueued).toBe(false);
  });

  it("does not turn development evidence or missing measurements into a failed-policy notice", async () => {
    const { notifyIfNoTeamPassed } = await import("../utils/taskLifecycleNotifications");
    run("run_a", "completed", 120);
    const value = sharedFakeFirestoreState.docs.get("evaluationRuns/run_a") as Record<string, any>;
    value.result.evidenceScope = "development_only";
    // It counts neither way: the site hears, once, that none can support a recommendation yet.
    expect((await notifyIfNoTeamPassed("req-1", "run_a")).enqueued).toBe(true);
    delete value.result.evidenceScope;
    delete value.result.scoring.siteTaskQualification;
    expect((await notifyIfNoTeamPassed("req-1", "run_a")).enqueued).toBe(false);
    expect([...sharedFakeFirestoreState.docs.keys()].some(key => key.includes(":no_team_passed:"))).toBe(false);
    expect([...sharedFakeFirestoreState.docs.keys()].filter(key => key.endsWith(":no_qualified_evaluation"))).toHaveLength(1);
  });
});

it.each(["results_ready", "run_no_result", "no_team_passed", "no_qualified_evaluation"] as const)("keeps %s on the private job page without an account step", async milestone => {
  const { buildTaskLifecycleNotification } = await import("../utils/taskLifecycleNotifications");
  const notice = buildTaskLifecycleNotification({ requestId: "req-1", to: "owner@example.com", milestone,
    captureUrl: "https://example.invalid/capture-upload/private-owner-link", workspaceUrl: null });
  expect(notice.body).toContain("https://example.invalid/capture-upload/private-owner-link");
  expect(notice.body).toMatch(/private job page/i);
  expect(notice.body).not.toMatch(/create.*account|save.*account|results open in.*account|confirm.*brief/i);
});
