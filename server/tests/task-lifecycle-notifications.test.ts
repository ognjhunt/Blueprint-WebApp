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
const send = vi.hoisted(() => vi.fn());
vi.mock("../utils/email", () => ({ sendEmail: send }));
// The site's answer, as the composer would give it; null until a test sets one.
const composedAnswer = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../utils/siteAnswer", async importOriginal => ({ ...await importOriginal<typeof import("../utils/siteAnswer")>(),
  loadSiteAnswer: vi.fn(async () => composedAnswer.current) }));

const { enqueueTaskLifecycleNotification, reconstructionIsViewable, reconcileSceneReadyNotifications } = await import("../utils/taskLifecycleNotifications");

beforeEach(() => {
  sharedFakeFirestoreState.docs.clear();
  sharedFakeFirestoreState.docs.set("inboundRequests/req-1", {
    contact: { email: "encrypted:owner@example.com" }, request: { buyerType: "site_operator" },
  });
  send.mockReset().mockResolvedValue({ sent: true, provider: "resend", messageId: "accepted" });
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
    // Bare bones (2026-11-11): one idea, one button, no sign-off.
    expect(row.subject).toBe("We have your video");
    // The receipt says what happens next, true whichever way the job goes, and gives no answer.
    expect(row.body).toBe(`Your video arrived safely. Next, we build a simulation of your site and test AI robots on your job in it. We'll email you the result, or, if a test can't run, why not and what we found on paper.\n\nOpen your job:\n${row.body.split("Open your job:\n")[1]}`);
    expect(`${row.subject} ${row.body}`).not.toMatch(/confirm|create an account|save this site to your account|proposal/i);
    expect(row.body).toMatch(/\/capture-upload\//);
    expect([...sharedFakeFirestoreState.docs.keys()].filter(key => key.startsWith("captureOutbox/"))).toHaveLength(1);
  });

  it("brings the site back to a viewable reconstruction without claiming a test result", async () => {
    await enqueueTaskLifecycleNotification({ requestId: "req-1", milestone: "scene_ready" });

    const scene = sharedFakeFirestoreState.docs.get("captureOutbox/req-1:scene_ready") as Record<string, unknown>;
    expect(scene.subject).toBe("Your 3D view of the work area is ready");
    expect(scene.body).toMatch(/^You can look around the work area you filmed on your job page\./);
    expect(scene.body).not.toMatch(/has started an evaluation run|succeeded|result:/i);
    expect(scene.body).toMatch(/Open your job:\nhttps:\/\/\S+\/capture-upload\/\S+$/);
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
    expect(first.body).toMatch(/simulation estimate for that one candidate, not a physical test\. It never certifies physical performance or safety/);
    expect(first.body).not.toMatch(/finalists|full scoring|full evaluation/);
    expect(sharedFakeFirestoreState.docs.has("captureOutbox/req-1:results_ready:run_b")).toBe(true);
  });

  it("puts the private task link in the first email, so it is not only on the success screen", async () => {
    await enqueueTaskLifecycleNotification({ requestId: "req-1", milestone: "task_received" });
    const row = sharedFakeFirestoreState.docs.get("captureOutbox/req-1:task_received") as Record<string, string>;
    expect(row.body).toMatch(/\/capture-upload\//);
    expect(row.subject).toBe("Your Blueprint job link");
    expect(row.body).toMatch(/^We have your job\.\n\nIf you haven't sent the video yet, send it from your job page\. This link opens your job without a password, so please don't forward it\./);
    expect(row.body).not.toMatch(/questions that need your input|confirm.*brief|proposal/i);
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

describe("listing notices describe the free beta", () => {
  const build = async (milestone: "listing_live", detail?: string) => {
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

  it("no longer offers a recommended-pilot or booking notice", async () => {
    const { buildTaskLifecycleNotification } = await import("../utils/taskLifecycleNotifications");
    for (const milestone of ["pilot_recommended", "pilot_booked", "pilot_scheduled"]) {
      expect(() => buildTaskLifecycleNotification({ requestId: "req-1", milestone: milestone as never, to: "owner@example.com",
        captureUrl: "https://tryblueprint.io/capture-upload/owner-token" })).toThrow();
    }
  });

  it("tells the site Blueprint works with a deployment company, without a choice of company or proposal", async () => {
    const { buildTaskLifecycleNotification } = await import("../utils/taskLifecycleNotifications");
    const notice = buildTaskLifecycleNotification({ requestId: "req-1", milestone: "pilot_request", to: "owner@example.com",
      captureUrl: "https://tryblueprint.io/capture-upload/owner-token" });
    expect(notice.body).toContain("You and a deployment company agree any physical pilot directly.");
    expect(notice.body).not.toMatch(/you choose|option|proposal|\bbook/i);
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
    expect(row.body).toMatch(/^Your job is ready for evaluation in a simplified simulation of your task, informed by your footage\. Nothing is needed from you\./);
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
    expect(row.subject).toBe("The simulation of your site is ready");
    expect(row.body).toMatch(/^Your work area and its objects are in place\. We are running our first tests on it now\.\n\nNothing is needed from you\./);
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

  it("tells the site its evaluation's outcome in the page's sentence, only while the page states it (F-01)", async () => {
    const { buildTaskLifecycleNotification } = await import("../utils/taskLifecycleNotifications");
    const { taskLifecycleNotificationIsCurrent } = await import("../utils/taskLifecycleNotificationAuthority");
    const { simulationOutcomeEmailSentence } = await import("../utils/betaPolicyScreeningContract");
    sharedFakeFirestoreState.docs.set("taskEvaluationSceneIntakes/scene-1", { website_request_id: "req-1",
      source_session_id: "walkthrough-req-1", created_at_iso: "2026-10-22T00:00:00Z", state: "completed",
      receipt: { intent_id: "intent-1" }, pipeline_status: { status: "completed", phase: "scene_prepared" },
      request: { task: { task_id: `website-${"0".repeat(20)}` }, owner: { organization_id: "team-a" } } });
    const screening = (outcome: string, extra: Record<string, unknown> = {}) => ({ run_kind: "beta_policy_screening",
      source_scene_intent_id: "intent-1", team_namespace: "team-a", state: "blocked", screening_execution_observed: true,
      screening_outcome: outcome, created_at_iso: "2026-10-23T00:00:00Z", ...extra });
    const event = `no_match-${"a".repeat(24)}`;
    const notice = buildTaskLifecycleNotification({ requestId: "req-1", to: "owner@example.com", milestone: "evaluation_outcome",
      eventId: event, screeningOutcome: "no_match", captureUrl: "https://example.invalid/capture-upload/private-owner-link" });
    expect(notice.idempotencyKey).toBe(`req-1:evaluation_outcome:${event}`);
    expect(notice.subject).toBe("An update on the simulation of your job");
    // With no paper check given, it says plainly that there is none (review, 2026-11-11).
    expect(notice.body.startsWith(`${simulationOutcomeEmailSentence("no_match")} There is no paper check for this job. Nothing is needed from you.`)).toBe(true);
    expect(notice.body.startsWith("None of the robots the simulation can run matched this task.")).toBe(true);
    // No email offers an introduction: a person at Blueprint makes it, from the job page's own request.
    expect(notice.body).not.toMatch(/introduction|\bheld\b/i);
    // Enqueue checks consent; dispatch also reads what the job page states now.
    expect(await taskLifecycleNotificationIsCurrent({ kind: "evaluation_outcome", requestId: "req-1" })).toBe(true);
    expect(await taskLifecycleNotificationIsCurrent(notice)).toBe(false);
    sharedFakeFirestoreState.docs.set("taskEvaluationPolicyRuns/run-held", screening("no_match"));
    expect(await taskLifecycleNotificationIsCurrent(notice)).toBe(true);
    // A notice whose key names no outcome is never sent.
    expect(await taskLifecycleNotificationIsCurrent({ ...notice, idempotencyKey: "req-1:evaluation_outcome" })).toBe(false);
    // A newer finished campaign with another reason, or any estimate, takes the page: the held notice is stale.
    sharedFakeFirestoreState.docs.set("taskEvaluationPolicyRuns/run-newer", screening("held_unprepared", { created_at_iso: "2026-10-24T00:00:00Z" }));
    expect(await taskLifecycleNotificationIsCurrent(notice)).toBe(false);
    sharedFakeFirestoreState.docs.delete("taskEvaluationPolicyRuns/run-newer");
    sharedFakeFirestoreState.docs.set("taskEvaluationPolicyRuns/run-estimate", screening("estimate", { state: "completed" }));
    expect(await taskLifecycleNotificationIsCurrent(notice)).toBe(false);
    // Withdrawn recording permission cancels it like every capture notice.
    sharedFakeFirestoreState.docs.delete("taskEvaluationPolicyRuns/run-estimate");
    sharedFakeFirestoreState.docs.set("inboundRequests/req-1", { contact: { email: "encrypted:owner@example.com" }, consent_revoked: true });
    expect(await taskLifecycleNotificationIsCurrent(notice)).toBe(false);
    // Only a result outcome with its own event id can be built.
    expect(() => buildTaskLifecycleNotification({ requestId: "req-1", to: "owner@example.com", milestone: "evaluation_outcome",
      eventId: `setup_repair-${"a".repeat(24)}`, screeningOutcome: "setup_repair" })).toThrow("evaluation_outcome_notice_invalid");
    expect(() => buildTaskLifecycleNotification({ requestId: "req-1", to: "owner@example.com", milestone: "evaluation_outcome",
      eventId: `estimate-${"a".repeat(24)}`, screeningOutcome: "no_match" })).toThrow("evaluation_outcome_notice_invalid");
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

it.each(["results_ready", "run_no_result", "no_team_passed", "no_qualified_evaluation", "evaluation_outcome"] as const)("keeps %s on the private job page without an account step", async milestone => {
  const { buildTaskLifecycleNotification } = await import("../utils/taskLifecycleNotifications");
  const notice = buildTaskLifecycleNotification({ requestId: "req-1", to: "owner@example.com", milestone,
    ...(milestone === "evaluation_outcome" ? { eventId: `estimate-${"a".repeat(24)}`, screeningOutcome: "estimate" as const,
      screeningCounts: { ran: 2, total: 36, scored: 6 } } : {}),
    captureUrl: "https://example.invalid/capture-upload/private-owner-link", workspaceUrl: null });
  expect(notice.body).toContain("https://example.invalid/capture-upload/private-owner-link");
  expect(notice.body).toMatch(/private job page/i);
  expect(notice.body).not.toMatch(/create.*account|save.*account|results open in.*account|confirm.*brief/i);
});

describe("a finished simulation's email says what the job page's simulation result says", () => {
  const evaluation = (rows: Array<[string, number, number]>, extra: Record<string, unknown> = {}) => ({
    runId: "run-1", state: "completed", current: true, resultDigest: null, outcome: "estimate", summary: "", nextAction: "",
    limitations: [], href: "#", ...extra,
    screening: { candidates: rows.map(([candidateId, succeeded, scored]) => ({ candidateId, name: candidateId, state: "completed",
      planned: scored, scored, succeeded, failed: scored - succeeded, void: 0, blockers: [] })),
      ...(extra.setupNotes ? { setupNotes: extra.setupNotes } : {}) } });
  const build = async (proof: unknown, workspaceUrl: string | null = null) => {
    const { buildTaskLifecycleNotification } = await import("../utils/taskLifecycleNotifications");
    return buildTaskLifecycleNotification({ requestId: "req-1", to: "owner@example.com", milestone: "evaluation_outcome",
      eventId: `estimate-${"a".repeat(24)}`, screeningOutcome: "estimate", screeningCounts: { ran: 2, total: 36, scored: 6 },
      simulationProof: proof as never, captureUrl: "https://example.invalid/capture-upload/private-owner-link", workspaceUrl });
  };
  const proofOf = async (summary: unknown) => {
    const { projectSimulationProof } = await import("../../client/src/lib/simulationProof");
    return projectSimulationProof({ evaluation: summary as never, pick: null });
  };
  const banned = /episodes|candidates|screening|pi05_droid|groot_n17|estimate|reply to this email|introduc|pilot/i;

  // Rewritten in round 4 from the same-robot comparison sentence: the email now says the headline the job page
  // leads with (`testHeadline`), the line under it (`testSubLine`) and the set-up notice when flagged, one idea and
  // one button, with the page's tested limits line as fine print.
  it("states the job page's test headline word for word when an AI robot finished the job", async () => {
    const { finePrint } = await import("../utils/emailLayout");
    const { LIMITS_TESTED } = await import("../../client/src/lib/siteAnswer");
    const { testHeadline, testResultOf } = await import("../../client/src/lib/simulationProof");
    const proof = await proofOf(evaluation([["pi05_droid", 4, 5], ["groot_n17_droid", 1, 5]]));
    const notice = await build(proof, "https://example.invalid/app/tasks/req-1");
    expect(notice.subject).toBe("Your simulation test has a result");
    // 4 of 5 against 1 of 5 is about 0.96 under the probability rule: ahead, not "did best".
    expect(notice.body).toBe(`${testHeadline(testResultOf(proof))} Nothing is needed from you.\n\n`
      + "See the result in your workspace:\nhttps://example.invalid/app/tasks/req-1\n\n" + finePrint(LIMITS_TESTED));
    expect(notice.body.startsWith("Was ahead on your job: Franka arm + π0.5, doing your job in 4 of 5 tries. Nothing is needed from you.")).toBe(true);
    expect(notice.body).not.toMatch(banned);
    expect(notice.body).not.toContain("private-owner-link");
    // "Did best" only by the probability rule.
    const clear = await build(await proofOf(evaluation([["pi05_droid", 9, 10], ["groot_n17_droid", 2, 10]])));
    expect(clear.body.startsWith("Did best on your job: Franka arm + π0.5, doing your job in 9 of 10 tries. ")).toBe(true);
    const close = await build(await proofOf(evaluation([["pi05_droid", 1, 1], ["groot_n17_droid", 0, 1]])));
    expect(close.subject).toBe("Your simulation test has a result");
    expect(close.body.startsWith("Tested on your job: no clear winner yet. Top: Franka arm + π0.5, did your job in 1 of 1 try. Nothing is needed from you.")).toBe(true);
    for (const email of [notice, clear, close]) {
      expect(`${email.subject} ${email.body}`).not.toMatch(/\bproo?f|\bprove/i);
      expect(email.body.match(/:\nhttps?:\/\//g)).toHaveLength(1);
    }
  });

  it("says none finished, with the set-up notice when flagged, and no pilot offer, when no AI robot finished the job", async () => {
    const note = "The place point was beyond the simulated arm's reach.";
    const notice = await build(await proofOf(evaluation([["pi05_droid", 0, 5], ["groot_n17_droid", 0, 5]], { setupNotes: [note], outcomeCaveat: "scene_setup" })));
    expect(notice.subject).toBe("The simulation test of your job has finished");
    expect(notice.body.startsWith("No AI robot finished your job. 2 AI robots tried; none finished your job. "
      + "This result may come from how we set up the simulation of your site, not from the robots. Nothing is needed from you.\n\n")).toBe(true);
    expect(notice.body.endsWith("[fine] Tested in a simulation, not at your site. Pick-up-and-put-down jobs only. It does not certify performance or safety.")).toBe(true);
    expect(notice.body).not.toMatch(banned);
    expect(notice.body).not.toMatch(/did best|was ahead|has a result|proof|deployment company/i);
  });

  // Rewritten (review, 2026-11-11): whether an estimate scored an AI robot decides its slot, so an estimate whose
  // results cannot be read is never queued (it waits); built directly with none, it is an ending with no paper check.
  it("never queues an estimate whose results cannot be read, and builds one with none as an ending", async () => {
    sharedFakeFirestoreState.docs.set("inboundRequests/req-1", { contact: { email: "encrypted:owner@example.com" } });
    expect(await enqueueTaskLifecycleNotification({ requestId: "req-1", milestone: "evaluation_outcome",
      eventId: `estimate-${"a".repeat(24)}`, screeningOutcome: "estimate", screeningCounts: { ran: 2, total: 36, scored: 6 },
      simulationProof: null })).toEqual({ enqueued: false, reason: "awaiting_reading" });
    expect([...sharedFakeFirestoreState.docs.keys()].filter(key => key.startsWith("captureOutbox/"))).toEqual([]);
    const { buildTaskLifecycleNotification } = await import("../utils/taskLifecycleNotifications");
    const flagged = buildTaskLifecycleNotification({ requestId: "req-1", to: "owner@example.com", milestone: "evaluation_outcome",
      eventId: `estimate-${"a".repeat(24)}`, screeningOutcome: "estimate", screeningCounts: { ran: 2, total: 36, scored: 6 },
      screeningCaveat: "scene_setup", simulationProof: null, captureUrl: "https://example.invalid/capture-upload/x" });
    expect(flagged).toMatchObject({ answerSlot: "paper" });
    expect(flagged.body.startsWith("The simulation test finished, but no AI robot could be scored in it. "
      + "This result may come from how we set up the simulation of your site, not from the robots. There is no paper check for this job.")).toBe(true);
    expect(flagged.body).not.toMatch(banned);
  });
});

describe("a job the window sweep ended is told under its own fixed key", () => {
  it("builds the page's sentence and refuses every other shape", async () => {
    const { buildTaskLifecycleNotification } = await import("../utils/taskLifecycleNotifications");
    const { JOB_WINDOW_ENDING_MESSAGE } = await import("../utils/taskPreparationOutcome");
    const notice = buildTaskLifecycleNotification({ requestId: "req-1", to: "owner@example.com", milestone: "scene_outcome",
      eventId: "job_window_ended", jobWindowEnded: true, captureUrl: "https://example.invalid/private-owner-link" });
    expect(notice).toMatchObject({ idempotencyKey: "req-1:scene_outcome:job_window_ended", kind: "scene_outcome",
      subject: "The simulation of your site has stopped", replyTo: "hello@tryblueprint.io" });
    // With no paper check given, it says so plainly; a final ending never says a test result may follow.
    expect(notice.body).toBe(`${JOB_WINDOW_ENDING_MESSAGE} There is no paper check for this job.\n\nOpen your job on your private job page:\n`
      + "https://example.invalid/private-owner-link");
    const claimed = buildTaskLifecycleNotification({ requestId: "req-1", to: "owner@example.com", milestone: "scene_outcome",
      eventId: "job_window_ended", jobWindowEnded: true, captureUrl: "https://example.invalid/private-owner-link",
      workspaceUrl: "https://example.invalid/app/tasks/req-1" });
    expect(claimed.body).toContain("Open your job in your workspace:\nhttps://example.invalid/app/tasks/req-1");
    // Only the fixed event id, and never together with a scene outcome kind.
    for (const params of [{ eventId: `held-${"a".repeat(64)}` }, { eventId: undefined },
      { eventId: "job_window_ended", sceneOutcomeKind: "held" as const }])
      expect(() => buildTaskLifecycleNotification({ requestId: "req-1", to: "owner@example.com", milestone: "scene_outcome",
        jobWindowEnded: true, ...params })).toThrow("job_window_ended_notice_invalid");
    // Without the flag the fixed id is not a scene outcome, so no other caller can queue under it.
    expect(() => buildTaskLifecycleNotification({ requestId: "req-1", to: "owner@example.com", milestone: "scene_outcome",
      eventId: "job_window_ended" })).toThrow("scene_outcome_notice_invalid");
  });

  it("is not current at dispatch unless the job's ending is on record", async () => {
    const { taskLifecycleNotificationIsCurrent } = await import("../utils/taskLifecycleNotificationAuthority");
    const key = "req-1:scene_outcome:job_window_ended";
    expect(await taskLifecycleNotificationIsCurrent({ kind: "scene_outcome", requestId: "req-1", idempotencyKey: key })).toBe(false);
  });
});

describe("a website job's scene outcome is emailed once (C-04)", () => {
  const docs = sharedFakeFirestoreState.docs;
  const sha = (char: string) => `sha256:${char.repeat(64)}`;
  const sealed = async (kind: string, terminal: boolean, reasonCode: string, decidedAt = 1793000000.25) => {
    const { crossRuntimeDigest } = await import("../utils/crossRuntimeCanonical");
    const value = { schema_version: "task_evaluation_scene_intent_outcome.v1", intent_id: "scene-one", intent_digest: sha("d"),
      kind, terminal, reason_category: "capability_limit", reason_code: reasonCode, decided_at_epoch: decidedAt };
    return { ...value, outcome_digest: crossRuntimeDigest(value) };
  };
  /** The intake as the worker leaves it after the poll that read the outcome, with the intent it writes beside it. */
  const intake = async (outcome: Record<string, any>, extra: Record<string, unknown> = {}, id = "scene-1") => {
    const { sceneOutcomeNoticeIntent } = await import("../utils/sceneIntentOutcome");
    const record = { website_request_id: "req-1", source_session_id: "walkthrough-req-1", created_at_iso: "2026-10-22T00:00:00Z",
      state: outcome.terminal ? "blocked" : "accepted", receipt: { intent_id: "scene-one", intent_digest: sha("d") },
      pipeline_status: { status: "blocked", phase: "preparation", blockers: ["anything"], outcome }, ...extra };
    const intent = sceneOutcomeNoticeIntent(id, record);
    docs.set(`taskEvaluationSceneIntakes/${id}`, { ...record,
      ...(intent ? { scene_outcome_notification_pending: true, scene_outcome_notification_intent: intent } : {}) });
    return intent;
  };
  const rows = () => [...docs.entries()].filter(([path]) => path.startsWith("captureOutbox/req-1:scene_outcome:")
    && !path.includes("/deliveryReceipts/")) as Array<[string, Record<string, any>]>;
  const pending = (id = "scene-1") => (docs.get(`taskEvaluationSceneIntakes/${id}`) as Record<string, any>).scene_outcome_notification_pending;

  it.each([
    ["held", "task_family_unsupported", "The simulation of your job is held for now", "Your answer stays on your job page. Nothing is needed from you."],
    ["withdrawn", "consent_expired", "Your Blueprint job has stopped", "You don't need to do anything; this job has stopped."],
    ["setup_repair", "retry_cap_exhausted", "We stopped building the simulation of your site", "Your answer stays on your job page. Nothing is needed from you."],
  ] as const)("sends %s once, in the page's own sentence, with the job link", async (kind, reasonCode, subject, closing) => {
    const { deliverOutbox } = await import("../utils/captureOutbox");
    const { sceneOutcomeMessage } = await import("../utils/sceneIntentOutcome");
    const outcome = await sealed(kind, true, reasonCode);
    expect(await intake(outcome)).toMatchObject({ request_id: "req-1", intake_id: "scene-1", kind,
      outcome_digest: outcome.outcome_digest, event_id: `${kind}-${outcome.outcome_digest.slice(7)}` });
    await deliverOutbox();
    expect(send).toHaveBeenCalledTimes(1);
    expect(rows().map(([path]) => path)).toEqual([`captureOutbox/req-1:scene_outcome:${kind}-${outcome.outcome_digest.slice(7)}`]);
    const row = rows()[0][1];
    expect(row).toMatchObject({ status: "sent", kind: "scene_outcome", to: "owner@example.com", subject });
    // An ending with no paper check says so plainly; the site's own withdrawal says nothing about an answer.
    expect(row.body.startsWith(`${sceneOutcomeMessage(kind)}${kind === "withdrawn" ? "" : " There is no paper check for this job."}\n\nOpen your job on your private job page:\n`)).toBe(true);
    expect(sceneOutcomeMessage(kind).endsWith(closing)).toBe(true);
    expect(row.body).toMatch(/\/capture-upload\//);
    // Before the link: no code, no money and nothing Blueprint does next.
    expect(row.body.slice(0, row.body.indexOf("Open your job"))).not.toMatch(/[a-z]_[a-z]|budget|\$|rerun|retry/i);
    expect(pending()).toBe(false);
    // The same outcome read again is the same email: re-polls never send twice.
    await intake(outcome);
    await deliverOutbox();
    expect(send).toHaveBeenCalledTimes(1);
    expect(rows()).toHaveLength(1);
    expect(pending()).toBe(false);
  });

  it("sends nothing for a wait, and no notice can be built for one", async () => {
    const { deliverOutbox } = await import("../utils/captureOutbox");
    const { buildTaskLifecycleNotification } = await import("../utils/taskLifecycleNotifications");
    for (const [kind, reasonCode] of [["setup_repair", "pipeline_fault"], ["awaiting_spend_approval", "spend_cap_reached"],
      ["awaiting_site", "site_consent_required"]]) {
      expect(await intake(await sealed(kind, false, reasonCode))).toBeNull();
      await deliverOutbox();
    }
    expect(rows()).toHaveLength(0);
    expect(send).not.toHaveBeenCalled();
    for (const [kind, eventId] of [["awaiting_site", `awaiting_site-${"a".repeat(64)}`], ["held", `withdrawn-${"a".repeat(64)}`],
      ["held", `held-${"a".repeat(24)}`]])
      expect(() => buildTaskLifecycleNotification({ requestId: "req-1", to: "owner@example.com", milestone: "scene_outcome",
        eventId, sceneOutcomeKind: kind as never })).toThrow("scene_outcome_notice_invalid");
  });

  it("claims a site's next email for a new terminal outcome only, keyed by its digest", async () => {
    const { deliverOutbox } = await import("../utils/captureOutbox");
    const first = await sealed("setup_repair", true, "stalled");
    await intake(first);
    await deliverOutbox();
    // A later intake for the same capture ends again. Rewritten in round 7: the first ending already gave the job its
    // one answer email (the paper check), so a second ending sends no second answer.
    const second = await sealed("held", true, "policy_capability_unavailable");
    await intake(second, { created_at_iso: "2026-10-25T00:00:00Z" }, "scene-2");
    await deliverOutbox();
    expect(rows().filter(([, row]) => (row as { status?: string }).status === "sent").map(([path]) => path.split(":").pop()))
      .toEqual([`setup_repair-${first.outcome_digest.slice(7)}`]);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("is cancelled when recording permission is withdrawn, or the page no longer shows the outcome", async () => {
    const { deliverOutbox } = await import("../utils/captureOutbox");
    const { reconcileSceneOutcomeNotifications } = await import("../utils/sceneOutcomeNotifications");
    await intake(await sealed("held", true, "task_family_unsupported"));
    await reconcileSceneOutcomeNotifications();
    expect(rows()[0][1]).toMatchObject({ status: "pending" });
    expect(pending()).toBe(false);
    docs.set("inboundRequests/req-1", { ...docs.get("inboundRequests/req-1"), consent_revoked: true });
    await deliverOutbox();
    expect(send).not.toHaveBeenCalled();
    expect(rows()[0][1]).toMatchObject({ status: "cancelled", attempts: 0 });
    // Withdrawn before anything was queued: nothing is queued, and the intent stays pending for the record.
    docs.clear();
    docs.set("inboundRequests/req-1", { contact: { email: "encrypted:owner@example.com" }, consent_revoked: true });
    await intake(await sealed("withdrawn", true, "consent_withdrawn"));
    await deliverOutbox();
    expect(rows()).toHaveLength(0);
    expect(pending()).toBe(true);
    // A newer intake for the capture speaks for the job by dispatch: the queued ending is stale.
    docs.clear();
    docs.set("inboundRequests/req-1", { contact: { email: "encrypted:owner@example.com" } });
    await intake(await sealed("setup_repair", true, "retry_cap_exhausted"));
    await reconcileSceneOutcomeNotifications();
    docs.set("taskEvaluationSceneIntakes/scene-2", { website_request_id: "req-1", source_session_id: "walkthrough-req-1",
      created_at_iso: "2026-10-23T00:00:00Z", state: "accepted", pipeline_status: { status: "running", phase: "configuration" } });
    await deliverOutbox();
    expect(send).not.toHaveBeenCalled();
    expect(rows()[0][1]).toMatchObject({ status: "cancelled", attempts: 0 });
  });

  it("sends nothing once the job's evaluation outcome email (F-01) went out, and is the one email when it did not", async () => {
    const { deliverOutbox } = await import("../utils/captureOutbox");
    const { reconcileSceneOutcomeNotifications } = await import("../utils/sceneOutcomeNotifications");
    const screened = `captureOutbox/req-1:evaluation_outcome:estimate-${"a".repeat(24)}`;
    docs.set(screened, { requestId: "req-1", kind: "evaluation_outcome", status: "sent" });
    await intake(await sealed("held", true, "task_family_unsupported"));
    await deliverOutbox();
    expect(rows()).toHaveLength(0);
    expect(send).not.toHaveBeenCalled();
    expect(pending()).toBe(false);
    // Queued first, then the screening email went out: cancelled at dispatch.
    docs.delete(screened);
    await intake(await sealed("held", true, "task_family_unsupported"));
    await reconcileSceneOutcomeNotifications();
    docs.set(screened, { requestId: "req-1", kind: "evaluation_outcome", status: "sent" });
    await deliverOutbox();
    expect(send).not.toHaveBeenCalled();
    expect(rows()[0][1]).toMatchObject({ status: "cancelled", attempts: 0 });
    // An older screening hold still queued is not what the page says once the scene's own hold speaks: one email, ours.
    docs.clear();
    docs.set("inboundRequests/req-1", { contact: { email: "encrypted:owner@example.com" } });
    await enqueueTaskLifecycleNotification({ requestId: "req-1", milestone: "evaluation_outcome",
      eventId: `held_capability-${"b".repeat(24)}`, screeningOutcome: "held_capability" });
    await intake(await sealed("held", true, "task_family_unsupported"));
    await deliverOutbox();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].subject).toBe("The simulation of your job is held for now");
    expect(docs.get(`captureOutbox/req-1:evaluation_outcome:held_capability-${"b".repeat(24)}`)).toMatchObject({ status: "cancelled" });
  });

  it("does not tell the site it withdrew when the WebApp revoked the intent for its own reason", async () => {
    const { deliverOutbox } = await import("../utils/captureOutbox");
    const { taskLifecycleNotificationIsCurrent } = await import("../utils/taskLifecycleNotificationAuthority");
    const revoked = await sealed("withdrawn", true, "authority_revoked");
    expect(await intake(revoked, { state: "revoked", revocation_receipt: { scope: "future_execution" },
      revocation_cause: "website_scene_sponsorship_changed" })).toBeNull();
    await deliverOutbox();
    expect(rows()).toHaveLength(0);
    // Even a key naming that outcome is not sent, and a key naming no outcome never is.
    const key = `req-1:scene_outcome:withdrawn-${revoked.outcome_digest.slice(7)}`;
    expect(await taskLifecycleNotificationIsCurrent({ kind: "scene_outcome", requestId: "req-1", idempotencyKey: key })).toBe(false);
    expect(await taskLifecycleNotificationIsCurrent({ kind: "scene_outcome", requestId: "req-1",
      idempotencyKey: "req-1:scene_outcome" })).toBe(false);
    // The same outcome after a rights revoke is the site's own: it is told once.
    expect(await intake(revoked, { state: "revoked", revocation_receipt: { scope: "future_execution" },
      revocation_cause: "source_revoked" })).toMatchObject({ kind: "withdrawn" });
    expect(await taskLifecycleNotificationIsCurrent({ kind: "scene_outcome", requestId: "req-1", idempotencyKey: key })).toBe(true);
  });
});

describe("the site's answer is emailed once, when it first settles", () => {
  const answer = (changes: Record<string, unknown> = {}) => ({
    schemaVersion: "site_answer.v1", state: "ready", headline: "Most likely to fit: Universal Robots UR10e.",
    job: { sentence: "Move cartons from the conveyor to the pallet", drafted: true, family: "palletizing", familyLabel: "palletizing" },
    facts: [], pick: { modelId: "ur10e", name: "UR10e", manufacturer: "Universal Robots" },
    runnerUp: { modelId: "crx-10ia", name: "CRX-10iA", manufacturer: "FANUC" }, alsoFit: [], ruledOut: [], ruledOutMore: 0,
    formNote: null, approach: null, unknowns: [],
    confidence: { level: "fair", reasons: ["The weight and distances are estimated from your video.", "Second reason."], raiseIt: [] },
    nextStep: { kind: "introduction", text: "" }, reason: null,
    note: "This checks whether a robot can pick your object up and put it down, against published robot specifications and a cited track record. It is not a test of a robot at your site and does not certify performance or safety.",
    checked: { models: 22, makers: 13, specsRetrievedOn: "2026-11-11" }, introductionRequestedAtIso: null, jobCardListed: false, basisDigest: "sha256:x",
    ...changes,
  });
  const otherKind = () => answer({ state: "cannot_assess", headline: "We can't check robots against this job yet.", pick: null, runnerUp: null,
    reason: "This check covers jobs where a robot picks one solid object up and puts it down. Your job looks like another kind, which we can't check robots against yet." });
  const unsized = () => answer({ state: "cannot_assess", headline: "We can't check robots against this job yet.", pick: null, runnerUp: null,
    reason: "The video did not show the job clearly enough for us to size it." });
  // The answer email is built from the job's outlook (review, 2026-11-11): another kind of job, or an ending with no test.
  const OTHER = { phase: "cannot_match", reason: "other_kind", sentence: null };
  const UNSIZED = { phase: "no_test", reason: "unsized", sentence: "Your video didn't show the job clearly enough for us to measure it." };
  const build = async (siteAnswer: unknown, outlook: unknown = OTHER) => (await import("../utils/taskLifecycleNotifications")).buildTaskLifecycleNotification({
    requestId: "req-1", milestone: "answer_ready", to: "owner@example.com", siteAnswer: siteAnswer as never, outlook: outlook as never,
    captureUrl: "https://tryblueprint.io/capture-upload/owner-token" });
  beforeEach(() => { composedAnswer.current = null; });

  // Rewritten in round 7 (owner, 2026-11-11): the first message is the upload receipt; a ready paper check is never
  // emailed on its own. The one answer email is the test result, or the paper check when no test can run.
  it("never builds an answer email for a ready paper check while the job is still on its way to a test", async () => {
    for (const phase of ["reading", "building", "testing", "result", "ended_by_site"])
      await expect(build(answer(), { phase, sentence: null }), phase).rejects.toThrow("answer_ready_notice_invalid");
    await expect(build(answer())).rejects.toThrow("answer_ready_notice_invalid");
  });

  // Rewritten (review, 2026-11-11): `answer_ready` carries only the endings with no email of their own, each final, so
  // it never says a test result may follow.
  it("gives the paper check after an ending with no email of its own: why no test ran, then the paper check", async () => {
    const notice = await build(answer(), { phase: "no_test", reason: "run_ended", sentence: "The simulation test stopped before it gave a result." });
    expect(notice.subject).toBe("Your job's paper check is ready");
    expect(notice.body.startsWith("The simulation test stopped before it gave a result. So the paper check is your answer. "
      + "Most likely to fit: Universal Robots UR10e.\n\n")).toBe(true);
    expect(notice.body).not.toContain("If a test result comes later");
    // An ended authority has no email of its own either: the window's sentence, then the paper check.
    const ended = await build(answer(), { phase: "no_test", reason: "authority_ended", sentence: "The time for this job ran out before a simulation test could run." });
    expect(ended.body.startsWith("The time for this job ran out before a simulation test could run. So the paper check is your answer.")).toBe(true);
    for (const reason of ["window_expired", "no_grant", "scene_held", "kept_on_file", null])
      await expect(build(answer(), { phase: "no_test", reason, sentence: "x" }), String(reason)).rejects.toThrow("answer_ready_notice_invalid");
  });

  it("gives the paper check as the one answer when the test cannot run, with the page's reason and the scene note", async () => {
    const { buildTaskLifecycleNotification } = await import("../utils/taskLifecycleNotifications");
    const { projectSimulationProof } = await import("../../client/src/lib/simulationProof");
    const { winnerEvaluation } = await import("../../client/tests/fixtures/siteAnswer");
    const note = "The simulation of your site found that the UR10e does not fit. This check uses your own measurement instead, which we trust more.";
    const notice = buildTaskLifecycleNotification({ requestId: "req-1", to: "owner@example.com", milestone: "evaluation_outcome",
      eventId: `held_capability-${"a".repeat(24)}`, screeningOutcome: "held_capability", siteAnswer: answer({ sceneNote: note }) as never,
      simulationProof: projectSimulationProof({ evaluation: [{ ...winnerEvaluation, outcome: "held_capability" }] as never, pick: null }),
      captureUrl: "https://tryblueprint.io/capture-upload/owner-token" });
    expect(notice.subject).toBe("Your job's paper check is ready");
    // Rewritten (review, 2026-11-11): the paper check is the answer "for now", and the email says a later result would come.
    expect(notice.body.startsWith("The simulation test did not run. Our simulation test can't do this kind of job yet. "
      + `So for now the paper check is your answer. Most likely to fit: Universal Robots UR10e. ${note} If a test result comes later, we'll email it.\n\n`)).toBe(true);
    expect(notice.body.endsWith("[fine] A paper check, not a test at your site. Pick-up-and-put-down jobs only. It does not certify performance or safety.")).toBe(true);
    expect(notice.body.match(/:\nhttps?:\/\//g)).toHaveLength(1);
  });

  // Rewritten (review, 2026-11-11): the reader's final "cannot size this job" is a recorded ending, so the unsized video
  // gets this email, final (no later result promised). Another kind of job is told by its no-grant ending's own email.
  it("tells an unsized video's ending why, under its own subject, and leaves another kind of job to its ending's email", async () => {
    const sized = await build(unsized(), UNSIZED);
    expect(sized.subject).toBe("An update on your Blueprint job");
    expect(sized.body.startsWith(`We can't check robots against this job yet.\n\n${unsized().reason}\n\nOpen your job:\nhttps://tryblueprint.io/capture-upload/owner-token`)).toBe(true);
    expect(sized.body).not.toMatch(/How sure|Runner-up|test result comes later/);
    await expect(build(otherKind())).rejects.toThrow("answer_ready_notice_invalid");
    await expect(build(unsized(), { phase: "building", sentence: null })).rejects.toThrow("answer_ready_notice_invalid");
    await expect(build(answer({ state: "reading" }))).rejects.toThrow("answer_ready_notice_invalid");
    await expect(build(undefined)).rejects.toThrow("answer_ready_notice_invalid");
  });

  it("is queued once per job, only for a recorded ending, and cancelled at dispatch only by a recorded fact", async () => {
    const { notifyIfAnswerSettled } = await import("../utils/taskLifecycleNotifications");
    const { taskLifecycleNotificationIsCurrent } = await import("../utils/taskLifecycleNotificationAuthority");
    const outbox = () => [...sharedFakeFirestoreState.docs.keys()].filter(key => key.startsWith("captureOutbox/"));
    // No answer read yet: nothing queued (it waits for the reading).
    expect((await notifyIfAnswerSettled("req-1")).enqueued).toBe(false);
    // A ready paper check, or another kind of job, while the job is still being worked on: no recorded ending, no email.
    for (const current of [answer(), otherKind()]) {
      composedAnswer.current = current;
      expect((await notifyIfAnswerSettled("req-1")).enqueued).toBe(false);
    }
    expect(outbox()).toEqual([]);
    composedAnswer.current = unsized();
    expect((await notifyIfAnswerSettled("req-1")).enqueued).toBe(true);
    expect((await notifyIfAnswerSettled("req-1")).enqueued).toBe(false);
    expect(outbox()).toEqual(["captureOutbox/req-1:answer_ready"]);
    const notice = { kind: "answer_ready" as const, requestId: "req-1", idempotencyKey: "req-1:answer_ready" };
    expect(await taskLifecycleNotificationIsCurrent(notice)).toBe(true);
    // A transient failure at dispatch is unknown: the check throws (the row stays queued), it never cancels.
    const evidence = await import("../utils/siteManagedEvidence");
    const failing = vi.spyOn(evidence, "readSiteManagedEvidence").mockRejectedValueOnce(new Error("unavailable"));
    await expect(taskLifecycleNotificationIsCurrent(notice)).rejects.toThrow();
    failing.mockRestore();
    expect(await taskLifecycleNotificationIsCurrent(notice)).toBe(true);
    // A recorded fact cancels it: the site described the job and the video now reads as a job to test.
    composedAnswer.current = answer();
    expect(await taskLifecycleNotificationIsCurrent(notice)).toBe(false);
  });

  it("queues the unsized video's answer once, when the reader records it", async () => {
    const { notifyIfAnswerSettled } = await import("../utils/taskLifecycleNotifications");
    composedAnswer.current = unsized();
    expect((await notifyIfAnswerSettled("req-1")).enqueued).toBe(true);
    expect((await notifyIfAnswerSettled("req-1")).enqueued).toBe(false);
    expect([...sharedFakeFirestoreState.docs.keys()].filter(key => key.startsWith("captureOutbox/"))).toEqual(["captureOutbox/req-1:answer_ready"]);
  });

  it("is never queued or sent once recording consent is withdrawn", async () => {
    const { notifyIfAnswerSettled } = await import("../utils/taskLifecycleNotifications");
    const { deliverOutbox } = await import("../utils/captureOutbox");
    composedAnswer.current = unsized();
    const job = { contact: { email: "encrypted:owner@example.com" }, request: { buyerType: "site_operator" } };
    sharedFakeFirestoreState.docs.set("inboundRequests/req-1", { ...job, consent_revoked: true });
    // The outlook is the site's own ending, so no answer email is due (rewritten from the queue's own refusal reason,
    // which the outlook check now comes before).
    expect(await notifyIfAnswerSettled("req-1")).toEqual({ enqueued: false });
    // A queued one is cancelled at dispatch.
    sharedFakeFirestoreState.docs.set("inboundRequests/req-1", job);
    expect((await notifyIfAnswerSettled("req-1")).enqueued).toBe(true);
    sharedFakeFirestoreState.docs.set("inboundRequests/req-1", { ...job, consent_revoked: true });
    await deliverOutbox();
    expect(send).not.toHaveBeenCalled();
    expect(sharedFakeFirestoreState.docs.get("captureOutbox/req-1:answer_ready")).toMatchObject({ status: "cancelled" });
  });

  it("cancels the robot-team evaluation notices at dispatch, keeping their rows, and keeps Blueprint's own", async () => {
    const { taskLifecycleNotificationIsCurrent } = await import("../utils/taskLifecycleNotificationAuthority");
    const { deliverOutbox } = await import("../utils/captureOutbox");
    const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
    await enqueueTaskLifecycleNotification({ requestId: "req-1", milestone: "results_ready", eventId: "run_a", detail: "12 of 50 simulated episodes succeeded" });
    await enqueueTaskLifecycleNotification({ requestId: "req-1", milestone: "run_no_result", eventId: "run_b" });
    expect(sharedFakeFirestoreState.docs.has("captureOutbox/req-1:results_ready:run_a")).toBe(true);
    await sharedFakeFirestore.runTransaction(async transaction => {
      for (const kind of ["results_ready", "run_no_result", "awaiting_evaluations", "no_team_passed", "no_qualified_evaluation"] as const)
        expect(await taskLifecycleNotificationIsCurrent({ requestId: "req-1", kind }, transaction)).toBe(false);
      expect(await taskLifecycleNotificationIsCurrent({ requestId: "req-1", kind: "scene_ready" }, transaction)).toBe(true);
      expect(await taskLifecycleNotificationIsCurrent({ requestId: "req-1", kind: "listing_live" }, transaction)).toBe(true);
    });
    await enqueueTaskLifecycleNotification({ requestId: "req-1", milestone: "scene_ready" });
    await deliverOutbox();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].subject).toBe("Your 3D view of the work area is ready");
    expect(sharedFakeFirestoreState.docs.get("captureOutbox/req-1:results_ready:run_a")).toMatchObject({ status: "cancelled" });
    expect(sharedFakeFirestoreState.docs.get("captureOutbox/req-1:run_no_result:run_b")).toMatchObject({ status: "cancelled" });
  });
  it("cancels the ended screening and team-request emails already queued, and still sends the can't-simulate-yet one (owner decision 2026-11-11)", async () => {
    const { taskLifecycleNotificationIsCurrent } = await import("../utils/taskLifecycleNotificationAuthority");
    const { deliverOutbox, enqueueOutbox } = await import("../utils/captureOutbox");
    const ended = [
      { kind: "pilot_request", key: "req-1:pilot_request:application-1" },
      { kind: "brief_confirmed", key: "req-1:brief-screening:qualified" },
      { kind: "input_needed", key: "req-1:brief-screening:needs_conversation" },
      { kind: "input_needed", key: "req-1:brief-screening:not_now" },
      { kind: "screening_not_now", key: "req-1:screening_not_now:1700000000000" },
    ] as const;
    for (const row of ended) {
      expect(await taskLifecycleNotificationIsCurrent({ requestId: "req-1", kind: row.kind, idempotencyKey: row.key })).toBe(false);
      await enqueueOutbox({ idempotencyKey: row.key, requestId: "req-1", to: "owner@example.com", kind: row.kind, subject: "Old", body: "Old body" });
    }
    // Asked to queue one now, nothing is queued.
    expect(await enqueueTaskLifecycleNotification({ requestId: "req-1", milestone: "screening_not_now", eventId: "1700000000001" }))
      .toMatchObject({ enqueued: false });
    expect(await enqueueTaskLifecycleNotification({ requestId: "req-1", milestone: "pilot_request", eventId: "application-2" }))
      .toMatchObject({ enqueued: false });
    await enqueueOutbox({ idempotencyKey: "req-1:brief-screening:task-not-yet-supported", requestId: "req-1", to: "owner@example.com",
      kind: "screening_not_now", subject: "Your job: we are preparing its evaluation", body: "Kept" });
    await deliverOutbox({ limit: 20 });
    for (const row of ended) expect(sharedFakeFirestoreState.docs.get(`captureOutbox/${row.key}`)).toMatchObject({ status: "cancelled" });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].subject).toBe("Your job: we are preparing its evaluation");
  });
});

// Round 7 (owner, 2026-11-11): every way a job can end gives it exactly one answer email, the test result or the
// paper check with the true reason, except the site's own ending (withdrawn, or a run it closed), which gives none.
describe("one answer email for every way a job ends", () => {
  const paperAnswer = { schemaVersion: "site_answer.v1", state: "ready", headline: "Most likely to fit: Universal Robots UR10e.",
    pick: { modelId: "ur10e", name: "UR10e", manufacturer: "Universal Robots" }, sceneNote: null } as never;
  // After a hold the paper check is the answer for now and a later result would be emailed; after a final ending it is
  // the answer, with no such promise (review, 2026-11-11).
  const HOLD_PAPER = "So for now the paper check is your answer. Most likely to fit: Universal Robots UR10e. If a test result comes later, we'll email it.";
  const PAPER = "So the paper check is your answer. Most likely to fit: Universal Robots UR10e.";
  const build = async (params: Record<string, unknown>) => (await import("../utils/taskLifecycleNotifications")).buildTaskLifecycleNotification({
    requestId: "req-1", to: "owner@example.com", captureUrl: "https://tryblueprint.io/capture-upload/owner-token", ...params } as never);
  const digest = `sha256:${"d".repeat(64)}`;

  it("gives the paper check, after the ending's true reason, when the simulation is held, could not be built, or its window ran out", async () => {
    const { sceneOutcomeNoticeEventId } = await import("../utils/sceneIntentOutcome");
    for (const [label, params] of [
      ["scene held", { milestone: "scene_outcome", sceneOutcomeKind: "held", eventId: sceneOutcomeNoticeEventId("held", digest) }],
      ["simulation not built", { milestone: "scene_outcome", sceneOutcomeKind: "setup_repair", eventId: sceneOutcomeNoticeEventId("setup_repair", digest) }],
      ["window expired", { milestone: "scene_outcome", eventId: "job_window_ended", jobWindowEnded: true }],
      ["never started", { milestone: "scene_outcome", eventId: "job_no_grant_ended", jobNoGrantEnded: "blueprint" }],
    ] as const) {
      const without = await build(params);
      const notice = await build({ ...params, siteAnswer: paperAnswer });
      // The reason is said first, unchanged; the paper check follows it as the answer, in the no-test email's words.
      // Without one, the email says plainly that there is none.
      const reason = without.body.split("\n\n")[0].replace(" There is no paper check for this job.", "");
      expect(without.body.split("\n\n")[0].endsWith(" There is no paper check for this job."), label).toBe(true);
      const paper = label === "scene held" ? HOLD_PAPER : PAPER;
      expect(notice.body.startsWith(`${reason} ${paper}`), label).toBe(true);
      expect(label === "scene held" || !notice.body.includes("If a test result comes later"), label).toBe(true);
      expect(without.body, label).not.toContain("paper check is your answer");
      expect(notice.body.match(/:\nhttps?:\/\//g), label).toHaveLength(1);
    }
    // A preparation that stopped for good: its reason, then the paper check.
    const stopped = await build({ milestone: "preparation_ended", eventId: `sha256:${"e".repeat(64)}`, siteAnswer: paperAnswer });
    expect(stopped.body).toMatch(new RegExp(`^We could not finish building the simulation of your site, and we have stopped trying\\..*${PAPER.replace(/[.]/g, "\\.")}`, "s"));
    // The site's own withdrawal gives no answer, even when one exists.
    const withdrawn = await build({ milestone: "scene_outcome", sceneOutcomeKind: "withdrawn",
      eventId: sceneOutcomeNoticeEventId("withdrawn", digest), siteAnswer: paperAnswer });
    expect(withdrawn.body).not.toContain("paper check is your answer");
  });

  // Rewritten (review, 2026-11-11) from "the first answer email wins": a job gets at most one paper-check email and one
  // result email; a result may follow a paper email, never the other way round; only rows actually sent count; a run
  // the owner closed and a withdrawal give none.
  it("walks every terminal path: at most one paper email and one result email, none when the site ended the job itself", async () => {
    const { answerSlotOf, answerSlotTaken } = await import("../utils/taskLifecycleNotificationAuthority");
    const key = (kind: string, event: string) => `req-1:${kind}:${event}`;
    type Candidate = { kind: any; idempotencyKey: string; fails?: true };
    // Every email each ending can queue, in the order they can arrive (from the code: the evaluation outcome at run
    // end, a stopped preparation, the scene intent's ending, the window sweep's endings, the answer email).
    const PATHS: Record<string, { closed?: true; rows: Candidate[]; paper: number; result: number }> = {
      "test result": { paper: 0, result: 1, rows: [{ kind: "evaluation_outcome", idempotencyKey: key("evaluation_outcome", "estimate-a") },
        { kind: "scene_outcome", idempotencyKey: key("scene_outcome", "job_window_ended") },
        { kind: "answer_ready", idempotencyKey: "req-1:answer_ready" }] },
      "test held, closed or could not run": { paper: 1, result: 0, rows: [{ kind: "evaluation_outcome", idempotencyKey: key("evaluation_outcome", "held_capability-a") },
        { kind: "scene_outcome", idempotencyKey: key("scene_outcome", "held-b") }] },
      "simulation build failed": { paper: 1, result: 0, rows: [{ kind: "preparation_ended", idempotencyKey: key("preparation_ended", "sha256:x") },
        { kind: "scene_outcome", idempotencyKey: key("scene_outcome", "setup_repair-c") },
        { kind: "scene_outcome", idempotencyKey: key("scene_outcome", "job_window_ended") }] },
      "simulation never built": { paper: 1, result: 0, rows: [{ kind: "scene_outcome", idempotencyKey: key("scene_outcome", "job_no_grant_ended") }] },
      "built, never tested, then the window ran out": { paper: 1, result: 0, rows: [{ kind: "answer_ready", idempotencyKey: "req-1:answer_ready" },
        { kind: "scene_outcome", idempotencyKey: key("scene_outcome", "job_window_ended") }] },
      "scene outcome held, then a result": { paper: 1, result: 1, rows: [{ kind: "scene_outcome", idempotencyKey: key("scene_outcome", "held-d") },
        { kind: "evaluation_outcome", idempotencyKey: key("evaluation_outcome", "estimate-e") }] },
      "two results": { paper: 0, result: 1, rows: [{ kind: "evaluation_outcome", idempotencyKey: key("evaluation_outcome", "estimate-f") },
        { kind: "evaluation_outcome", idempotencyKey: key("evaluation_outcome", "estimate-g") }] },
      "job window expired": { paper: 1, result: 0, rows: [{ kind: "scene_outcome", idempotencyKey: key("scene_outcome", "job_window_ended") }] },
      "job of another kind": { paper: 1, result: 0, rows: [{ kind: "answer_ready", idempotencyKey: "req-1:answer_ready" },
        { kind: "scene_outcome", idempotencyKey: key("scene_outcome", "job_window_ended") }] },
      "can't simulate this kind of job yet, then another kind": { paper: 1, result: 0, rows: [
        { kind: "screening_not_now", idempotencyKey: "req-1:brief-screening:task-not-yet-supported" },
        { kind: "answer_ready", idempotencyKey: "req-1:answer_ready" }] },
      "a paper email that failed to send, then the window": { paper: 1, result: 0, rows: [
        { kind: "answer_ready", idempotencyKey: "req-1:answer_ready", fails: true },
        { kind: "scene_outcome", idempotencyKey: key("scene_outcome", "job_window_ended") }] },
      // The site's own endings: its run closed, or permission withdrawn.
      "run closed by the owner": { closed: true, paper: 0, result: 0, rows: [{ kind: "scene_outcome", idempotencyKey: key("scene_outcome", "job_window_ended") },
        { kind: "answer_ready", idempotencyKey: "req-1:answer_ready" }] },
      "recording permission withdrawn": { paper: 0, result: 0, rows: [{ kind: "scene_outcome", idempotencyKey: key("scene_outcome", "withdrawn-f") }] },
    };
    for (const [path, { closed, rows: candidates, paper, result }] of Object.entries(PATHS)) {
      const rows: Array<{ kind: any; idempotencyKey: string; status: string }> = [];
      for (const candidate of candidates) {
        const slot = answerSlotOf(candidate.kind, candidate.idempotencyKey);
        const sends = !slot || !(closed || answerSlotTaken(rows, candidate.kind, candidate.idempotencyKey));
        rows.push({ kind: candidate.kind, idempotencyKey: candidate.idempotencyKey, status: !sends ? "cancelled" : candidate.fails ? "failed" : "sent" });
      }
      const sent = (slot: string) => rows.filter(row => row.status === "sent" && answerSlotOf(row.kind, row.idempotencyKey) === slot).length;
      expect({ paper: sent("paper"), result: sent("result") }, path).toEqual({ paper, result });
    }
  });

  it("lets a result follow a paper email, counts only rows actually sent, and sends no answer after the owner closed the run", async () => {
    const { taskLifecycleNotificationIsCurrent, answerSlotTaken } = await import("../utils/taskLifecycleNotificationAuthority");
    const { crossRuntimeDigest } = await import("../utils/crossRuntimeCanonical");
    // An unsized video (a recorded ending): its answer email is due, so only the slot rules can stop it.
    composedAnswer.current = { schemaVersion: "site_answer.v1", state: "cannot_assess", headline: "We can't check robots against this job yet.",
      pick: null, reason: "The video did not show the job clearly enough for us to size it." } as never;
    const paper = { kind: "answer_ready" as const, requestId: "req-1", idempotencyKey: "req-1:answer_ready" };
    const result = { kind: "evaluation_outcome" as const, requestId: "req-1", idempotencyKey: "req-1:evaluation_outcome:estimate-a" };
    sharedFakeFirestoreState.docs.set("inboundRequests/req-1", { contact: { email: "encrypted:owner@example.com" }, request: { buyerType: "site_operator" } });
    expect(await taskLifecycleNotificationIsCurrent(paper)).toBe(true);
    // An earlier paper email that failed, was cancelled or is still pending fills no slot; one being dispatched, or
    // whose send outcome is unknown, may have gone out, so it does.
    for (const status of ["dispatching", "unknown"]) {
      sharedFakeFirestoreState.docs.set("captureOutbox/req-1:scene_outcome:job_window_ended", { requestId: "req-1", kind: "scene_outcome",
        idempotencyKey: "req-1:scene_outcome:job_window_ended", status });
      expect(await taskLifecycleNotificationIsCurrent(paper), status).toBe(false);
    }
    for (const status of ["failed", "cancelled", "pending"]) {
      sharedFakeFirestoreState.docs.set("captureOutbox/req-1:scene_outcome:job_window_ended", { requestId: "req-1", kind: "scene_outcome",
        idempotencyKey: "req-1:scene_outcome:job_window_ended", status });
      expect(await taskLifecycleNotificationIsCurrent(paper), status).toBe(true);
    }
    // One that went out fills the paper slot; a result may still follow it.
    sharedFakeFirestoreState.docs.set("captureOutbox/req-1:scene_outcome:job_window_ended", { requestId: "req-1", kind: "scene_outcome",
      idempotencyKey: "req-1:scene_outcome:job_window_ended", status: "sent" });
    expect(await taskLifecycleNotificationIsCurrent(paper)).toBe(false);
    const sentPaper = [{ kind: "scene_outcome" as const, idempotencyKey: "req-1:scene_outcome:job_window_ended", status: "sent" }];
    expect(answerSlotTaken(sentPaper, result.kind, result.idempotencyKey)).toBe(false);
    // A result that went out: no paper email after it, and no second result.
    sharedFakeFirestoreState.docs.delete("captureOutbox/req-1:scene_outcome:job_window_ended");
    sharedFakeFirestoreState.docs.set("captureOutbox/req-1:evaluation_outcome:estimate-a", { ...result, status: "sent" });
    expect(await taskLifecycleNotificationIsCurrent(paper)).toBe(false);
    expect(await taskLifecycleNotificationIsCurrent({ ...result, idempotencyKey: "req-1:evaluation_outcome:estimate-b" })).toBe(false);
    // The owner closed the run: no answer email at all.
    sharedFakeFirestoreState.docs.delete("captureOutbox/req-1:evaluation_outcome:estimate-a");
    const value = { schema_version: "website_run_closure.v1", request_id: "req-1", capture_id: "walkthrough-req-1",
      decision: "conservative_abstention", actor: "signed_owner_link", source_identity_digest: `sha256:${"a".repeat(64)}`,
      closed_at_iso: "2026-11-11T00:00:00.000Z", new_execution_authorized: false, explicit_resume_required: true, physical_validation: false };
    sharedFakeFirestoreState.docs.set("inboundRequests/req-1", { contact: { email: "encrypted:owner@example.com" }, request: { buyerType: "site_operator" },
      website_run_closures: { "walkthrough-req-1": { ...value, closure_digest: crossRuntimeDigest(value) } } });
    expect(await taskLifecycleNotificationIsCurrent(paper)).toBe(false);
    expect(await taskLifecycleNotificationIsCurrent(result)).toBe(false);
    // A closure record that does not read is unknown: the check throws, so the row stays queued and is not cancelled.
    sharedFakeFirestoreState.docs.set("inboundRequests/req-1", { contact: { email: "encrypted:owner@example.com" }, request: { buyerType: "site_operator" },
      website_run_closures: { "walkthrough-req-1": { broken: true } } });
    await expect(taskLifecycleNotificationIsCurrent(result)).rejects.toThrow();
  });

  it("holds an ending's email while the video is read, queues it with the paper check once read, and says plainly when the reading never came", async () => {
    const { releaseWaitingAnswerNotices, ANSWER_NOTICES_WAITING_FIELD, READING_WAIT_LIMIT_MS } = await import("../utils/taskLifecycleNotifications");
    const outbox = () => [...sharedFakeFirestoreState.docs.entries()].filter(([key]) => key.startsWith("captureOutbox/")) as Array<[string, any]>;
    const ending = { requestId: "req-1", milestone: "scene_outcome" as const, eventId: "job_window_ended", jobWindowEnded: true as const };
    composedAnswer.current = { state: "reading" };
    expect(await enqueueTaskLifecycleNotification(ending)).toEqual({ enqueued: false, reason: "awaiting_reading" });
    expect(outbox()).toEqual([]);
    const job = () => sharedFakeFirestoreState.docs.get("inboundRequests/req-1") as Record<string, any>;
    expect(Object.keys(job()[ANSWER_NOTICES_WAITING_FIELD])).toHaveLength(1);
    // Still reading: releasing leaves it waiting.
    await releaseWaitingAnswerNotices("req-1");
    expect(outbox()).toEqual([]);
    // Read: it is queued once, with the paper check, and the wait is cleared.
    composedAnswer.current = paperAnswer;
    await releaseWaitingAnswerNotices("req-1");
    expect(outbox().map(([key]) => key)).toEqual(["captureOutbox/req-1:scene_outcome:job_window_ended"]);
    expect(outbox()[0][1].body).toContain(PAPER);
    expect(job().answer_notices_waiting_pending).toBe(false);
    // A reading that never finished: past its limit the email goes, saying plainly there is no paper check.
    sharedFakeFirestoreState.docs.delete("captureOutbox/req-1:scene_outcome:job_window_ended");
    composedAnswer.current = { state: "reading" };
    await enqueueTaskLifecycleNotification(ending);
    const [slot] = Object.keys(job()[ANSWER_NOTICES_WAITING_FIELD]);
    job()[ANSWER_NOTICES_WAITING_FIELD][slot].since_iso = new Date(Date.now() - READING_WAIT_LIMIT_MS - 1000).toISOString();
    await releaseWaitingAnswerNotices("req-1");
    expect(outbox()[0][1].body).toContain("We could not finish reading your video, so there is no paper check for this job.");
  });

  it("lets only one of two paper emails out when two dispatchers run at once", async () => {
    const { deliverOutbox, enqueueOutbox } = await import("../utils/captureOutbox");
    composedAnswer.current = { schemaVersion: "site_answer.v1", state: "cannot_assess", headline: "We can't check robots against this job yet.",
      pick: null, reason: "The video did not show the job clearly enough for us to size it." } as never;
    await enqueueOutbox({ idempotencyKey: "req-1:answer_ready", requestId: "req-1", to: "owner@example.com", kind: "answer_ready",
      subject: "Paper one", body: "One" });
    await enqueueOutbox({ idempotencyKey: "req-1:brief-screening:task-not-yet-supported", requestId: "req-1", to: "owner@example.com",
      kind: "screening_not_now", subject: "Paper two", body: "Two" });
    // Two passes interleaved, as two instances of the pump would run them; a send takes a while, so one row is still
    // `dispatching` when the other pass checks its own.
    send.mockImplementation(async () => { await new Promise(resolve => setTimeout(resolve, 30));
      return { sent: true, provider: "resend", messageId: "accepted" }; });
    await Promise.all([deliverOutbox({ limit: 5 }), deliverOutbox({ limit: 5 })]);
    expect(send).toHaveBeenCalledTimes(1);
    const statuses = ["req-1:answer_ready", "req-1:brief-screening:task-not-yet-supported"]
      .map(key => (sharedFakeFirestoreState.docs.get(`captureOutbox/${key}`) as { status: string }).status).sort();
    expect(statuses).toEqual(["cancelled", "sent"]);
  });

  it("cancels the kept can't-simulate-yet email at dispatch after the site withdrew or closed its run", async () => {
    const { taskLifecycleNotificationIsCurrent } = await import("../utils/taskLifecycleNotificationAuthority");
    const kept = { kind: "screening_not_now" as const, requestId: "req-1", idempotencyKey: "req-1:brief-screening:task-not-yet-supported" };
    expect(await taskLifecycleNotificationIsCurrent(kept)).toBe(true);
    sharedFakeFirestoreState.docs.set("inboundRequests/req-1", { contact: { email: "encrypted:owner@example.com" },
      request: { buyerType: "site_operator" }, consent_revoked: true });
    expect(await taskLifecycleNotificationIsCurrent(kept)).toBe(false);
  });

  it("cancels a second answer email at dispatch once one has gone out", async () => {
    const { taskLifecycleNotificationIsCurrent } = await import("../utils/taskLifecycleNotificationAuthority");
    sharedFakeFirestoreState.docs.set("captureOutbox/req-1:evaluation_outcome:held_capability-a", { requestId: "req-1",
      kind: "evaluation_outcome", idempotencyKey: "req-1:evaluation_outcome:held_capability-a", status: "sent" });
    expect(await taskLifecycleNotificationIsCurrent({ kind: "scene_outcome", requestId: "req-1",
      idempotencyKey: "req-1:scene_outcome:job_window_ended" })).toBe(false);
    expect(await taskLifecycleNotificationIsCurrent({ kind: "answer_ready", requestId: "req-1",
      idempotencyKey: "req-1:answer_ready" })).toBe(false);
  });
});
