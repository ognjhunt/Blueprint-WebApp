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
  it("decrypts the owner, uses an owner-scoped task link, and deduplicates retries", async () => {
    expect((await enqueueTaskLifecycleNotification({ requestId: "req-1", milestone: "video_received" })).enqueued).toBe(true);
    expect((await enqueueTaskLifecycleNotification({ requestId: "req-1", milestone: "video_received" })).enqueued).toBe(false);

    const row = sharedFakeFirestoreState.docs.get("captureOutbox/req-1:video_received") as Record<string, unknown>;
    expect(row.to).toBe("owner@example.com");
    expect(row.kind).toBe("video_received");
    expect(row.body).toMatch(/investigate the observed task and prepare a recommendation/i);
    expect(row.body).toMatch(/\/capture-upload\//);
    expect([...sharedFakeFirestoreState.docs.keys()].filter(key => key.startsWith("captureOutbox/"))).toHaveLength(1);
  });

  it("keeps each observed milestone distinct without claiming a result", async () => {
    await enqueueTaskLifecycleNotification({ requestId: "req-1", milestone: "scene_ready" });
    await enqueueTaskLifecycleNotification({ requestId: "req-1", milestone: "screening_started" });

    const scene = sharedFakeFirestoreState.docs.get("captureOutbox/req-1:scene_ready") as Record<string, unknown>;
    const screening = sharedFakeFirestoreState.docs.get("captureOutbox/req-1:screening_started") as Record<string, unknown>;
    expect(scene.body).toMatch(/your scene is ready/i);
    expect(screening.body).toMatch(/has started an evaluation run/i);
    expect(screening.body).toMatch(/again when it reports a result/i);
    expect(screening.body).not.toMatch(/succeeded|result:/i);
    expect(screening.body).toMatch(/— The Blueprint team$/);
  });

  it("sends each run or request its own email, and a retry of one event none", async () => {
    await enqueueTaskLifecycleNotification({ requestId: "req-1", milestone: "results_ready", eventId: "run_a", detail: "12 of 50 simulated episodes succeeded" });
    await enqueueTaskLifecycleNotification({ requestId: "req-1", milestone: "results_ready", eventId: "run_b" });
    expect((await enqueueTaskLifecycleNotification({ requestId: "req-1", milestone: "results_ready", eventId: "run_a" })).enqueued).toBe(false);

    const first = sharedFakeFirestoreState.docs.get("captureOutbox/req-1:results_ready:run_a") as Record<string, string>;
    expect(first.body).toContain("12 of 50 simulated episodes succeeded");
    expect(first.body).toMatch(/not a physical test/i);
    expect(sharedFakeFirestoreState.docs.has("captureOutbox/req-1:results_ready:run_b")).toBe(true);
  });

  it("puts the private task link in the first email, so it is not only on the success screen", async () => {
    await enqueueTaskLifecycleNotification({ requestId: "req-1", milestone: "task_received" });
    const row = sharedFakeFirestoreState.docs.get("captureOutbox/req-1:task_received") as Record<string, string>;
    expect(row.body).toMatch(/\/capture-upload\//);
    expect(row.body).toMatch(/meaningful findings and questions that need your input/i);
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
 it.each(['video_received','scene_ready','screening_cleared','screening_started','results_ready','run_no_result'] as const)('does not enqueue %s after persisted withdrawal',async milestone=>{
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

  it("asks the site to book the recommended pilot, not to accept a proposal", async () => {
    const notice = await build("pilot_recommended");
    expect(notice.body).toMatch(/book it there in one step; booking costs nothing during the beta/);
    expect(notice.body).toMatch(/paid to the robot team, not to Blueprint/);
    expect(notice.body).not.toMatch(/accept the proposal/i);
  });

  it("confirms a booking, leaves the agreement to the site and team, and states no Blueprint fee", async () => {
    const free = await build("pilot_booked", "invited_beta_free");
    expect(free.subject).toBe("Your pilot is booked");
    expect(free.body).toMatch(/^Your booking is recorded\./);
    expect(free.body).toContain("You and the robot team agree the pilot's dates and terms directly.");
    expect(free.body).not.toMatch(/Blueprint owns/);
    expect(free.body).toContain("Blueprint charges nothing during the beta; the pilot's cost is agreed with the robot team.");
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

  it("tells the site once that robot teams can evaluate the job, only while true and before any run", async () => {
    const { notifyIfOpenForEvaluations } = await import("../utils/taskLifecycleNotifications");
    jobAccess.evaluationAvailable = false;
    expect((await notifyIfOpenForEvaluations("req-1")).enqueued).toBe(false);
    jobAccess.evaluationAvailable = true;
    expect((await notifyIfOpenForEvaluations("req-1")).enqueued).toBe(true);
    expect((await notifyIfOpenForEvaluations("req-1")).enqueued).toBe(false);
    const row = sharedFakeFirestoreState.docs.get("captureOutbox/req-1:awaiting_evaluations") as Record<string, string>;
    expect(row.subject).toBe("Robot teams can now evaluate your job");
    expect(row.body).toMatch(/No team has started one yet\. We will email you when a team starts/);
    sharedFakeFirestoreState.docs.delete("captureOutbox/req-1:awaiting_evaluations");
    run("run_q", "requested", null);
    expect((await notifyIfOpenForEvaluations("req-1")).enqueued).toBe(false);
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
    expect(row.subject).toBe("No robot team's evaluation has passed yet");
    expect(row.body).toMatch(/none passed, so there is no pilot to recommend yet/);

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
    expect((await notifyIfNoTeamPassed("req-1", "run_a")).enqueued).toBe(false);
    delete value.result.evidenceScope;
    delete value.result.scoring.siteTaskQualification;
    expect((await notifyIfNoTeamPassed("req-1", "run_a")).enqueued).toBe(false);
    expect([...sharedFakeFirestoreState.docs.keys()].some(key => key.includes(":no_team_passed:"))).toBe(false);
  });
});
