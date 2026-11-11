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
    contact: { email: "encrypted:owner@example.com" },
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
    expect(row.body).toMatch(/Blueprint handles reconstruction and evaluation/i);
    expect(`${row.subject} ${row.body}`).not.toMatch(/confirm|create an account|save this site to your account|proposal/i);
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
    expect(first.body).toMatch(/simulation estimate for that one candidate, not a physical test\. It never certifies physical performance or safety/);
    expect(first.body).not.toMatch(/finalists|full scoring|full evaluation/);
    expect(sharedFakeFirestoreState.docs.has("captureOutbox/req-1:results_ready:run_b")).toBe(true);
  });

  it("puts the private task link in the first email, so it is not only on the success screen", async () => {
    await enqueueTaskLifecycleNotification({ requestId: "req-1", milestone: "task_received" });
    const row = sharedFakeFirestoreState.docs.get("captureOutbox/req-1:task_received") as Record<string, string>;
    expect(row.body).toMatch(/\/capture-upload\//);
    expect(row.body).toMatch(/Blueprint handles reconstruction and evaluation/i);
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
    expect(notice.body).toContain("Blueprint works with a deployment company on the result, and you and that company agree any physical pilot directly.");
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
    expect(row.body).toMatch(/Next, Blueprint tests robots and policies on it\./);
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
    expect(notice.body.startsWith(`${simulationOutcomeEmailSentence("no_match")} Nothing is needed from you.`)).toBe(true);
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

describe("a finished simulation's email says what the job page's simulation proof says", () => {
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

  it("names the winning policy in plain words, with its count and how far to trust it, when the result separates them", async () => {
    const { EMAIL_SIGN_OFF } = await import("../utils/emailLayout");
    const notice = await build(await proofOf(evaluation([["pi05_droid", 4, 5], ["groot_n17_droid", 1, 5]])),
      "https://example.invalid/app/tasks/req-1");
    expect(notice.subject).toBe("Your simulation proof is ready");
    expect(notice.body).toBe("In a simulation of your site, π0.5, an AI control policy from Physical Intelligence, did best: it completed the job in 4 of 5 tries.\n\n"
      + "In published tests on research robots, a simulation built from a scan of the scene picked the better of two policies in 8 of 9 comparisons, and simulated scores tracked real ones closely (a correlation of about 0.9 on average). "
      + "The conditions and sources are on your job page. Nothing is needed from you.\n\n"
      + "A simulation is not a physical test, and it never certifies physical performance or safety.\n\n"
      + "See the result in your workspace:\nhttps://example.invalid/app/tasks/req-1\n\n" + EMAIL_SIGN_OFF);
    expect(notice.body).not.toMatch(banned);
    expect(notice.body).not.toContain("private-owner-link");
  });

  it("says it could not rank them, with its scene notes and no pilot offer, when no policy completed the job", async () => {
    const note = "The place point was beyond the simulated arm's reach.";
    const notice = await build(await proofOf(evaluation([["pi05_droid", 0, 5], ["groot_n17_droid", 0, 5]], { setupNotes: [note] })));
    expect(notice.subject).toBe("The simulation of your job has finished");
    expect(notice.body.startsWith(`The simulation ran, but no policy completed the job in it, so it could not rank them. ${note} Nothing is needed from you.\n\n`
      + "A simulation is not a physical test, and it never certifies physical performance or safety.")).toBe(true);
    expect(notice.body).not.toMatch(banned);
    expect(notice.body).not.toMatch(/did best|proof is ready|deployment company/i);
  });

  it("says only that the simulation finished when the job's results could not be read, and what a stored caveat shows", async () => {
    const unread = await build(null);
    expect(unread.subject).toBe("The simulation of your job has finished");
    expect(unread.body.startsWith("The simulation of your site has finished. Your job page shows how each policy did. Nothing is needed from you.")).toBe(true);
    const { buildTaskLifecycleNotification } = await import("../utils/taskLifecycleNotifications");
    const flagged = buildTaskLifecycleNotification({ requestId: "req-1", to: "owner@example.com", milestone: "evaluation_outcome",
      eventId: `estimate-${"a".repeat(24)}`, screeningOutcome: "estimate", screeningCounts: { ran: 2, total: 36, scored: 6 },
      screeningCaveat: "scene_setup", simulationProof: null, captureUrl: "https://example.invalid/capture-upload/x" });
    expect(flagged.body.startsWith("The simulation ran, but no policy completed the job in it, so it could not rank them. "
      + "Our scene check found a possible set-up cause")).toBe(true);
    for (const notice of [unread, flagged]) expect(notice.body).not.toMatch(banned);
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
    expect(notice.body).toBe(`${JOB_WINDOW_ENDING_MESSAGE}\n\nOpen your job on your private job page:\n`
      + "https://example.invalid/private-owner-link\n\n— The Blueprint team");
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
    expect(row.body.startsWith(`${sceneOutcomeMessage(kind)}\n\nOpen your job on your private job page:\n`)).toBe(true);
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
    // A later intake for the same capture ends again: a different outcome, its own one email.
    const second = await sealed("held", true, "policy_capability_unavailable");
    await intake(second, { created_at_iso: "2026-10-25T00:00:00Z" }, "scene-2");
    await deliverOutbox();
    expect(rows().map(([path]) => path.split(":").pop())).toEqual([`setup_repair-${first.outcome_digest.slice(7)}`,
      `held-${second.outcome_digest.slice(7)}`]);
    expect(send).toHaveBeenCalledTimes(2);
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
    note: "This is a fit check against published robot specifications and a cited track record. It is not a test of a robot at your site and does not certify performance or safety.",
    checked: { models: 22, makers: 13, specsRetrievedOn: "2026-11-11" }, introductionRequestedAtIso: null, basisDigest: "sha256:x",
    ...changes,
  });
  const otherKind = () => answer({ state: "cannot_assess", headline: "We can't check robots against this job yet.", pick: null, runnerUp: null,
    reason: "This check covers jobs where a robot picks one solid object up and puts it down. Your job looks like another kind, which we can't check robots against yet." });
  const unsized = () => answer({ state: "cannot_assess", headline: "We can't check robots against this job yet.", pick: null, runnerUp: null,
    reason: "The video did not show the job clearly enough for us to size it." });
  const build = async (siteAnswer: unknown) => (await import("../utils/taskLifecycleNotifications")).buildTaskLifecycleNotification({
    requestId: "req-1", milestone: "answer_ready", to: "owner@example.com", siteAnswer: siteAnswer as never,
    captureUrl: "https://tryblueprint.io/capture-upload/owner-token" });
  beforeEach(() => { composedAnswer.current = null; });

  it("states the pick, the runner-up, how sure, where the proof appears, the note and the private link", async () => {
    const notice = await build(answer());
    expect(notice.idempotencyKey).toBe("req-1:answer_ready");
    expect(notice.subject).toBe("Your Blueprint answer is ready");
    expect(notice.body).toBe([
      "Most likely to fit: Universal Robots UR10e.",
      "Runner-up: FANUC CRX-10iA.",
      "How sure we are: Fair. The weight and distances are estimated from your video.",
      "When Blueprint runs your job in a simulation of your site, the proof appears on the same page.",
      answer().note,
      "Open your answer:\nhttps://tryblueprint.io/capture-upload/owner-token",
      "— The Blueprint team",
    ].join("\n\n"));
    expect(notice.body).not.toMatch(/episode|candidate|screening|checkpoint|embodiment/i);
    expect((await build(answer({ runnerUp: null }))).body).not.toMatch(/Runner-up/);
  });

  it("tells a job of another kind why, under its own subject, and never builds the unsized case", async () => {
    const notice = await build(otherKind());
    expect(notice.subject).toBe("An update on your Blueprint job");
    expect(notice.body.startsWith(`We can't check robots against this job yet. ${otherKind().reason}\n\nOpen your answer:\nhttps://tryblueprint.io/capture-upload/owner-token`)).toBe(true);
    expect(notice.body).not.toMatch(/How sure|Runner-up/);
    await expect(build(unsized())).rejects.toThrow("answer_ready_notice_invalid");
    await expect(build(answer({ state: "reading" }))).rejects.toThrow("answer_ready_notice_invalid");
    await expect(build(undefined)).rejects.toThrow("answer_ready_notice_invalid");
  });

  it("is queued once per job, only while the answer is settled", async () => {
    const { notifyIfAnswerSettled } = await import("../utils/taskLifecycleNotifications");
    const { taskLifecycleNotificationIsCurrent } = await import("../utils/taskLifecycleNotificationAuthority");
    expect((await notifyIfAnswerSettled("req-1")).enqueued).toBe(false);
    composedAnswer.current = unsized();
    expect((await notifyIfAnswerSettled("req-1")).enqueued).toBe(false);
    composedAnswer.current = answer();
    expect((await notifyIfAnswerSettled("req-1")).enqueued).toBe(true);
    expect((await notifyIfAnswerSettled("req-1")).enqueued).toBe(false);
    expect([...sharedFakeFirestoreState.docs.keys()].filter(key => key.startsWith("captureOutbox/"))).toEqual(["captureOutbox/req-1:answer_ready"]);
    expect(sharedFakeFirestoreState.docs.get("captureOutbox/req-1:answer_ready")).toMatchObject({ kind: "answer_ready", to: "owner@example.com" });
    // Dispatch reads the answer again.
    const notice = { kind: "answer_ready" as const, requestId: "req-1", idempotencyKey: "req-1:answer_ready" };
    expect(await taskLifecycleNotificationIsCurrent(notice)).toBe(true);
    composedAnswer.current = answer({ state: "reading" });
    expect(await taskLifecycleNotificationIsCurrent(notice)).toBe(false);
  });

  it("is never queued or sent once recording consent is withdrawn", async () => {
    const { notifyIfAnswerSettled } = await import("../utils/taskLifecycleNotifications");
    const { deliverOutbox } = await import("../utils/captureOutbox");
    composedAnswer.current = answer();
    sharedFakeFirestoreState.docs.set("inboundRequests/req-1", { contact: { email: "encrypted:owner@example.com" }, consent_revoked: true });
    expect(await notifyIfAnswerSettled("req-1")).toEqual({ enqueued: false, reason: "consent_withdrawn" });
    // A queued one is cancelled at dispatch.
    sharedFakeFirestoreState.docs.set("inboundRequests/req-1", { contact: { email: "encrypted:owner@example.com" } });
    expect((await notifyIfAnswerSettled("req-1")).enqueued).toBe(true);
    sharedFakeFirestoreState.docs.set("inboundRequests/req-1", { contact: { email: "encrypted:owner@example.com" }, consent_revoked: true });
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
      expect(await taskLifecycleNotificationIsCurrent({ requestId: "req-1", kind: "pilot_request" }, transaction)).toBe(true);
    });
    await enqueueTaskLifecycleNotification({ requestId: "req-1", milestone: "scene_ready" });
    await deliverOutbox();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].subject).toBe("Your Blueprint scene is ready to view");
    expect(sharedFakeFirestoreState.docs.get("captureOutbox/req-1:results_ready:run_a")).toMatchObject({ status: "cancelled" });
    expect(sharedFakeFirestoreState.docs.get("captureOutbox/req-1:run_no_result:run_b")).toMatchObject({ status: "cancelled" });
  });
});
