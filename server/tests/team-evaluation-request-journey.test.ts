// @vitest-environment node
/**
 * Audit P0-5, the request step: an approved robot team can request an
 * evaluation on a job started from the public form, and every surface a team
 * meets gives the same answer about it.
 *
 * Nothing here is a hand-built job record. Each job starts from the real
 * `POST /api/inbound-request` handler with the exact body the public start form
 * sends (`helpers/siteCaptureStartSubmission.ts`, which the component's own test
 * pins). The site then confirms its brief through the real `confirmBrief`, and
 * the Pipeline reports the scene through the real, signed
 * `POST /api/internal/pipeline/attachments`. Teams then use the real job library,
 * workspace and free-admission code.
 *
 * Substituted: Firebase persistence and ID-token verification, outbound email,
 * Slack, analytics and model calls, and execution preparation, which belongs to
 * the runtime lane (`prepareFreeAgentExecution`, `discoverAgentExecutionAdmission`);
 * `free-beta-journey-contract.test.ts` covers those from an admitted request on.
 */
import express from "express";
import { createServer, type Server } from "node:http";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { SITE_CAPTURE_START_FORM, siteCaptureStartSubmission } from "./helpers/siteCaptureStartSubmission";
import type { TaskBrowseCard, TeamJobOpening } from "../../client/src/types/taskBrowse";

const sendEmail = vi.hoisted(() => vi.fn(async (_message: { to?: unknown }) => ({ sent: true })));
const prepare = vi.hoisted(() => vi.fn());
const admission = vi.hoisted(() => vi.fn());

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE, fakeArrayUnion } = await import("./helpers/fake-firestore");
  return {
    dbAdmin: sharedFakeFirestore, storageAdmin: null,
    // Firebase verifies ID tokens; a fixture token names its account.
    authAdmin: { verifyIdToken: async (token: string) => {
      const uid = token.replace(/^fixture-token:/, "");
      return { uid, email: `${uid}@example.test`, email_verified: true };
    } },
    default: { firestore: { FieldValue: {
      serverTimestamp: () => new Date().toISOString(), delete: () => FAKE_FIELD_DELETE,
      arrayUnion: (...items: unknown[]) => fakeArrayUnion(...items), increment: (n: number) => n,
    } } },
  };
});
vi.mock("../utils/email", () => ({ sendEmail }));
vi.mock("../agents/runtime", () => ({ runAgentTask: vi.fn(() => { throw new Error("No model calls in the request-step journey"); }) }));
vi.mock("../agents", () => ({ runInboundQualificationForRequest: vi.fn(async () => undefined) }));
vi.mock("../utils/slack", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/slack")>()), notifySlackInboundRequest: vi.fn(async () => undefined),
}));
vi.mock("../utils/growth-events", () => ({ logGrowthEvent: vi.fn(async () => ({ ok: true })) }));
vi.mock("../utils/highIntentLeadEnrichment", () => ({ runHighIntentLeadEnrichmentForRequest: vi.fn(async () => undefined) }));
vi.mock("../utils/lifecycle-cadence", () => ({ createLifecycleCadenceForInboundRequest: vi.fn(async () => undefined) }));
vi.mock("../utils/intakeOpsNotice", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/intakeOpsNotice")>()),
  deliverIntakeOpsNoticeAtIntake: vi.fn(async () => ({ channels: { slack: "skipped" } })),
}));
vi.mock("../utils/selfServeAgentExecution", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/selfServeAgentExecution")>()), prepareFreeAgentExecution: prepare,
}));
vi.mock("../utils/agentExecutionAdmission", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/agentExecutionAdmission")>()), discoverAgentExecutionAdmission: admission,
}));

const ROBOT = "robot-owner", PENDING = "robot-pending", TEAM = "team-journey", CHECKPOINT = "checkpoint-journey";
const SETUP = { id: "setup-journey", name: "Fixture arm", embodiment: "Fixed arm", policyName: "Packing",
  version: "v1", delivery: "endpoint", reference: "https://policy.example.test/action", notes: "" };
const syncSecret = "synthetic-request-step-sync-secret-never-live";
const operatorAnswers = { sceneStability: "stable", taskShape: "single", objectVariety: "under_10",
  deploymentTimeline: "this_quarter", accessWindow: "scheduled" };
const successCriteria = { successDefinition: "Every carton packed upright", successRate: 95, cycleTimeSeconds: 30, unknown: false };
const originalFetch = globalThis.fetch;
let server: Server | undefined, base = "", sequence = 0;
const next = (prefix: string) => `${prefix}-${++sequence}`;
const doc = (path: string): any => state.docs.get(path);

beforeAll(async () => {
  vi.stubEnv("PIPELINE_SYNC_TOKEN", syncSecret);
  vi.stubEnv("PIPELINE_SYNC_ALLOW_LEGACY_BEARER", "false");
  vi.stubEnv("PIPELINE_SYNC_ALLOWED_GCS_PREFIXES", "gs://fixture-bucket/");
  vi.stubEnv("PIPELINE_SYNC_RATE_LIMIT_MAX", "10000");
  vi.stubEnv("FIELD_ENCRYPTION_KMS_KEY_NAME", "");
  vi.stubEnv("FIELD_ENCRYPTION_MASTER_KEY", Buffer.alloc(32, 7).toString("base64"));
  vi.stubEnv("BLUEPRINT_ROBOT_TEAM_EARLY_ACCESS", "1");
  vi.stubEnv("BLUEPRINT_INTAKE_DAILY_LIMIT", "10000");
  vi.stubEnv("BLUEPRINT_INTAKE_PER_IP_DAILY_LIMIT", "10000");
  vi.stubGlobal("fetch", (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    if (url.hostname !== "127.0.0.1") throw new Error("External network forbidden in the request-step journey");
    return originalFetch(input, init);
  });
  // One at a time: these route modules import one another, and loading a
  // circular graph concurrently can stall the module runner past the hook timeout.
  const { default: intake } = await import("../routes/inbound-request");
  const { default: pipeline } = await import("../routes/internal-pipeline");
  const { default: siteWorlds } = await import("../routes/site-worlds");
  const { default: workspace } = await import("../routes/workspace");
  const app = express();
  // One forwarded address per site, as Render's proxy reports it, so the
  // per-address intake limits see distinct visitors.
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "2mb" }));
  app.use("/api/inbound-request", intake);
  app.use("/api/internal/pipeline", pipeline);
  app.use("/api/site-worlds", siteWorlds);
  // Substitutes Firebase's verified token, never the workspace's own role,
  // invitation, early-access or job checks.
  app.use("/api/workspace", (req, res, nextHandler) => {
    const uid = String(req.headers["x-fixture-user"] || "");
    res.locals.firebaseUser = { uid, email: `${uid}@example.test`, email_verified: true };
    nextHandler();
  }, workspace);
  server = createServer(app);
  await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  // Four full route graphs load here, after the env stubs they read. About 10s
  // alone and 22s under coverage, but CI's coverage run reached the 120s default
  // while every worker cold-transformed modules at once (WEB-03 in vitest.config.ts).
}, 300_000);
afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
  vi.unstubAllEnvs(); vi.unstubAllGlobals();
});

/**
 * A robot-team account. `approved` is the invitation granted after application
 * review; otherwise the application is still waiting. An approved account owns
 * the fixture team, its checkpoint and a saved setup, so free admission can bind
 * its request to them.
 */
async function robotAccount(uid: string, approved: boolean) {
  const { accessRecordId } = await import("../utils/robotTeamEarlyAccess");
  const { TERMS_VERSION, PRIVACY_VERSION } = await import("../../client/src/lib/legalAcceptance");
  const email = `${uid}@example.test`;
  state.docs.set(`users/${uid}`, { buyerType: "robot_team", name: "Robot Owner", email,
    acceptedTerms: true, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION });
  state.docs.set(`robotTeamAccess/${accessRecordId(email)}`, approved
    ? { email, status: "approved", decidedBy: "fixture-ops", decidedAtIso: "2026-10-09T00:00:00Z" }
    : { email, status: "pending" });
  if (!approved) return;
  state.docs.set(`robotTeams/${TEAM}`, { id: TEAM, name: "Fixture robot team", status: "self_registered",
    accountUid: uid, accountEmail: email, capability: {}, fieldProvenance: {},
    createdAt: "2026-10-09T00:00:00Z", updatedAt: "2026-10-09T00:00:00Z" });
  state.docs.set(`robotCheckpoints/${CHECKPOINT}`, { checkpointId: CHECKPOINT, teamId: TEAM,
    label: "Request-step fixture", runtime: "policy_endpoint", reference: SETUP.reference,
    // The policy token a team evaluation calls the endpoint with (Settings → Robots & policies).
    policyCredential: { ref: "credential-journey", kind: "bearer", expiresAtIso: "2100-01-01T00:00:00Z" } });
  expect((await workspaceApi("/setups", uid, SETUP)).status).toBe(200);
}
beforeEach(async () => {
  state.docs.clear(); prepare.mockReset(); admission.mockReset(); sendEmail.mockClear();
  await robotAccount(ROBOT, true);
  await robotAccount(PENDING, false);
});
afterEach(() => {
  // The only direct send is the intake's own receipt to the requesting team.
  // Nothing is sent to a site, and site notices only enter the durable outbox.
  for (const [message] of sendEmail.mock.calls) expect(String(message.to)).toMatch(/^robot-[\w-]+@example\.test$/);
});

function workspaceApi(path: string, uid: string, body?: unknown) {
  return fetch(`${base}/api/workspace${path}`, { method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", "x-fixture-user": uid, "x-forwarded-for": `198.51.100.${(++sequence % 250) + 1}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function library(uid: string): Promise<{ items: TaskBrowseCard[]; access: { allowed: boolean } }> {
  const response = await fetch(`${base}/api/site-worlds/tasks`, { headers: { authorization: `Bearer fixture-token:${uid}` } });
  expect(response.status).toBe(200);
  return response.json();
}
async function pipelineSync(jobId: string, readiness: Record<string, unknown> = { rights_review_status: "cleared" }) {
  const { buildPipelineSyncSignature } = await import("../utils/pipelineSyncSecurity");
  const prefix = `gs://fixture-bucket/scenes/site-${jobId}`;
  const body = JSON.stringify({
    schema_version: "v1", site_submission_id: jobId, request_id: jobId, buyer_request_id: jobId,
    capture_job_id: `walkthrough-${jobId}`, scene_id: `site-${jobId}`, capture_id: `walkthrough-${jobId}`, pipeline_prefix: prefix,
    // What the Pipeline publishes once the scene is rebuilt, launchable and scoreable.
    artifacts: {
      worldlabs_world_manifest_uri: `${prefix}/world/manifest.json`,
      runtime_demo_manifest_uri: `${prefix}/runtime/demo_manifest.json`,
      benchmark_suite_manifest_uri: `${prefix}/benchmarks/suite_manifest.json`,
    },
    evaluation_readiness: readiness,
  });
  const timestamp = new Date().toISOString();
  const response = await fetch(`${base}/api/internal/pipeline/attachments`, { method: "POST",
    headers: { "content-type": "application/json", "X-Blueprint-Pipeline-Timestamp": timestamp,
      "X-Blueprint-Pipeline-Signature": buildPipelineSyncSignature({ secret: syncSecret, timestamp, body }) }, body });
  expect(response.status, await response.clone().text()).toBe(200);
}

/** A site starts a job on the public form, exactly as the browser sends it. */
async function startJob(options: { keepPrivate?: boolean } = {}) {
  const requestId = next("site-job");
  const response = await fetch(`${base}/api/inbound-request`, { method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `203.0.113.${(sequence % 250) + 1}` },
    body: JSON.stringify(siteCaptureStartSubmission({ requestId, retryToken: `r${requestId}`.padEnd(64, "x"),
      sourcePageUrl: "https://tryblueprint.io/contact/site-operator", keepPrivate: options.keepPrivate,
      email: `${requestId}@example.test` })) });
  expect(response.status, await response.clone().text()).toBe(201);
  return requestId;
}
/** The site confirms the brief Blueprint drafted from its submission. */
async function confirm(jobId: string) {
  const { confirmBrief } = await import("../utils/siteTaskBrief");
  const confirmed = await confirmBrief({ requestId: jobId, confirmedBy: "site-owner-fixture", operatorAnswers, successCriteria });
  expect(confirmed?.disposition).toBe("qualified");
}
async function openJob() {
  const jobId = await startJob();
  await confirm(jobId);
  await pipelineSync(jobId);
  return jobId;
}
function requestEvaluation(jobId: string, uid = ROBOT, licensed = true) {
  return workspaceApi("/evaluations", uid, { id: next("application"), opportunityId: jobId, setupId: SETUP.id, notes: "",
    ...(licensed ? { licenseToRun: true } : {}) });
}
function approveFreeRun(applicationId: string) {
  return import("../utils/freeEvaluationHandoff").then(({ admitFreeWorkspaceEvaluation }) =>
    admitFreeWorkspaceEvaluation(applicationId, { teamId: TEAM, checkpointId: CHECKPOINT, episodes: 200, sponsorCapUsd: 20,
      maxAttempts: 1, evidenceScope: "development_only", expiresAtIso: new Date(Date.now() + 600_000).toISOString() }, "founder-fixture"));
}
function preparedExecution(owner: string) {
  prepare.mockImplementation(async () => {
    state.docs.set("robotEvalJobRequests/prepared-journey", { buyer_user_id: owner });
    return { prepared: true, requestId: "prepared-journey", created: true };
  });
  admission.mockResolvedValue({ admitted: true, digestSha256: `sha256:${"a".repeat(64)}`,
    envelope: { binding: { capture_id: "capture-fixture", task_family: "pick_place" },
      canonical_execution_request: { execution_authorization: { max_cost_usd: 20, episodes: 200 },
        policy_package: { policy_api_endpoint: { execution_profile: "team_evaluation_scored_v1" } } } } });
}

describe("a job started from the public form", () => {
  it("reaches an approved robot team: card, opening, request and the record free admission starts from", async () => {
    const { anonymizedOpportunityDraft } = await import("../../client/src/types/taskBrowse");
    const { projectWorkspaceTask } = await import("../utils/workspace-projection");
    const jobId = await startJob();
    const stored = doc(`inboundRequests/${jobId}`);
    // What the real intake wrote: the site's card grant, and no retired dossier.
    expect(stored.public_task_listing).toMatchObject({ enabled: true, consentVersion: "public-task-card-v1",
      details: anonymizedOpportunityDraft(SITE_CAPTURE_START_FORM.task) });
    expect(stored.request.pilotOpportunity ?? null).toBeNull();

    // Listed straight away, but nothing is offered until the scene can run.
    let card = (await library(ROBOT)).items.find(item => item.id === jobId);
    expect(card).toMatchObject({ evaluationAvailable: false, stage: "capture" });
    expect((await workspaceApi(`/openings/${jobId}`, ROBOT)).status).toBe(404);
    expect((await requestEvaluation(jobId)).status).toBe(404);

    await confirm(jobId);
    expect((await library(ROBOT)).items.find(item => item.id === jobId)?.evaluationAvailable).toBe(false);
    await pipelineSync(jobId);
    // What the Pipeline sync made of the scene, read back from the record.
    expect(doc(`inboundRequests/${jobId}`).evaluation_readiness).toMatchObject({
      runtime_launchable: true, benchmark_coverage_status: "ready", rights_review_status: "cleared" });

    card = (await library(ROBOT)).items.find(item => item.id === jobId);
    expect(card).toMatchObject({ evaluationAvailable: true, stage: "ready" });

    const opened = await workspaceApi(`/openings/${jobId}`, ROBOT);
    expect(opened.status).toBe(200);
    const { opening } = await opened.json() as { opening: TeamJobOpening };
    // The e2e workspace spec mocks exactly this projection for its job.
    expect(opening).toEqual({ ...anonymizedOpportunityDraft(SITE_CAPTURE_START_FORM.task), id: jobId,
      publishedAtIso: stored.public_task_listing.approvedAtIso, thumbnailUrl: null, evaluation: null });
    expect(JSON.stringify(opening)).not.toMatch(/Austin|@example|Acme|gs:\/\/|successRate|walkthrough/);
    expect(JSON.stringify(opening)).not.toContain(SITE_CAPTURE_START_FORM.task);

    // Once the Pipeline publishes team evaluations, the opening says what a team is asked to do and
    // how it is judged: the instruction, the scored variations and the policy interfaces, never the
    // site's geometry and never a cell's draw.
    const listing = (profile: string, episodes: number) => ({ profile, episodes, available: true, reason: null });
    state.docs.set(`inboundRequests/${jobId}`, { ...doc(`inboundRequests/${jobId}`), agent_execution_offer: {
      policy_execution_profiles: ["team_evaluation_scored_v1"], episode_count: 200,
      team_evaluation: { scored: listing("team_evaluation_scored_v1", 200),
        contract: { instruction: "Put the tote on the shelf", task_kind: "rigid_pick_place",
          task_success_contract: { destination_box_world_m: [1, 2, 3] },
          scored: { families: ["placement_approach", "illumination"], parameter_bounds: { object_start_x_delta_m: [-0.03, 0.03] } },
          policy_interfaces: [{ policy_interface_id: "openpi_droid_https.v1" }, { policy_interface_id: "blueprint_policy_https.v1" }] } } } } as never);
    const terms = (await (await workspaceApi(`/openings/${jobId}`, ROBOT)).json() as { opening: TeamJobOpening }).opening.evaluation;
    expect(terms).toMatchObject({ instruction: "Put the tote on the shelf",
      scored: { episodes: 200, families: ["placement_approach", "illumination"],
        parameterBounds: { object_start_x_delta_m: [-0.03, 0.03] } } });
    expect(terms?.policyInterfaces.map(row => row.robot)).toEqual(["droid_franka", "team_declared"]);
    expect(JSON.stringify(terms)).not.toMatch(/destination_box_world_m/);

    // The team's notification email links to this job's opening page.
    const { teamPilotNoticeBody } = await import("../utils/robotTeamPilotNotifications");
    const notice = teamPilotNoticeBody({ kind: "team_pilot_recommended", requestId: jobId, recommendation: { id: "rec-1", teamId: TEAM } });
    const linked = /\/app\/opportunities\/([^\s/]+)/.exec(notice.body)?.[1];
    expect(linked && decodeURIComponent(linked)).toBe(jobId);
    expect((await workspaceApi(`/openings/${linked}`, ROBOT)).status).toBe(200);

    // A team evaluation is one attempt: without a policy token on file it is refused before it is asked for.
    const { policyCredential: token, ...untokened } = doc(`robotCheckpoints/${CHECKPOINT}`);
    state.docs.set(`robotCheckpoints/${CHECKPOINT}`, untokened);
    const refused = await requestEvaluation(jobId, ROBOT, true);
    expect(refused.status).toBe(409);
    expect((await refused.json()).code).toBe("team_evaluation_policy_credential_required");
    state.docs.set(`robotCheckpoints/${CHECKPOINT}`, { ...untokened, policyCredential: token });

    const requested = await requestEvaluation(jobId, ROBOT, true);
    expect(requested.status, await requested.clone().text()).toBe(201);
    const applicationId = (await requested.json()).requestId as string;
    const application = doc(`inboundRequests/${applicationId}`);
    expect(application).toMatchObject({ account_owner_uid: ROBOT, workspace_evaluation: {
      opportunityId: jobId, setupId: SETUP.id, setupName: "Fixture arm · Packing v1",
      licenseToRunGrantedAt: expect.any(String),
      // The job's targets, frozen at request time.
      targetSnapshot: { successRate: 95, cycleTimeSeconds: 30 } } });
    expect(application.request.buyerType).toBe("robot_team");

    // The site sees its job open, and the team sees its request.
    expect(projectWorkspaceTask(jobId, doc(`inboundRequests/${jobId}`)).published).toBe(true);
    const teamWorkspace = await (await workspaceApi("", ROBOT)).json();
    expect(teamWorkspace.evaluations).toEqual([expect.objectContaining({ id: applicationId, taskId: jobId, title: opening.title })]);

    // Free admission accepts the record the request produced.
    preparedExecution(ROBOT);
    const admitted = await approveFreeRun(applicationId);
    expect(admitted.created).toBe(true);
    // A team evaluation: 200 hidden cells, on the DROID Franka (no manifest saved).
    expect(prepare).toHaveBeenCalledWith(expect.objectContaining({ teamId: TEAM, checkpointId: CHECKPOINT, sceneId: jobId,
      quotedEpisodes: 200, teamEvaluation: { robotEmbodiment: null } }),
      expect.objectContaining({ approvedBy: "founder-fixture" }));
    const run = doc(`evaluationRuns/${admitted.runId}`);
    expect(run).toMatchObject({ sceneId: jobId, teamId: TEAM, quotedUsd: 0, quotedEpisodes: 200, state: "requested",
      teamEvaluationPurpose: "scored" });
    expect(run.executionAdmission.envelope.funding).toMatchObject({ payer: "blueprint", customer_price_usd: 0,
      cap_usd: 20, max_attempts: 1, workspace_request_id: applicationId });
    expect(doc(`inboundRequests/${applicationId}`).free_evaluation_handoff.runId).toBe(admitted.runId);
  });

  it("the agent API's candidate list offers the same job", async () => {
    const { buildTeamEvalCandidates } = await import("../utils/teamEvalCandidates");
    const jobId = await openJob();
    const candidates = await buildTeamEvalCandidates({ teamId: TEAM, checkpointId: CHECKPOINT });
    expect(candidates.map(candidate => candidate.sceneId)).toContain(jobId);
    expect(candidates.find(candidate => candidate.sceneId === jobId)?.details?.title).toBe("Packing opportunity");
  });
});

type Row = {
  label: string;
  open: boolean;
  /** How the job is set up before any team arrives. */
  start?: "public" | "kept_private" | "not_confirmed" | "not_synced";
  /** What changes after the team requested, standing in for the writer named. */
  change?: (jobId: string, team: string) => Promise<void> | void;
  viewer?: string;
};

function patch(jobId: string, update: (record: any) => void) {
  const record = structuredClone(doc(`inboundRequests/${jobId}`));
  update(record);
  state.docs.set(`inboundRequests/${jobId}`, record);
}

const rows: Row[] = [
  { label: "listed, confirmed, runnable and rights cleared", open: true },
  { label: "kept private on the start form", open: false, start: "kept_private" },
  { label: "brief not yet confirmed by the site", open: false, start: "not_confirmed" },
  { label: "scene not yet reported by the Pipeline", open: false, start: "not_synced" },
  // The owner link (`task-listings.ts`) turns the card off.
  { label: "card hidden by the site", open: false, change: id => patch(id, r => { r.public_task_listing.enabled = false; }) },
  // The workspace listing control (`POST /tasks/:id/listing`).
  { label: "paused by the site", open: false, change: id => patch(id, r => { r.workspace_task = { ...r.workspace_task, paused: true }; }) },
  { label: "closed by the site", open: false, change: id => patch(id, r => { r.workspace_task = { ...r.workspace_task, archived: true }; }) },
  { label: "recording permission withdrawn", open: false, change: async id => {
    const { recordWebsiteCaptureWithdrawal } = await import("../utils/websiteCaptureWithdrawal");
    await recordWebsiteCaptureWithdrawal({ requestId: id, requestedBy: "site-owner-fixture", authorize: () => undefined });
  } },
  { label: "rights blocked by the Pipeline review", open: false, change: id => pipelineSync(id, { rights_review_status: "blocked" }) },
  { label: "rights awaiting the Pipeline review", open: false, change: id => pipelineSync(id, { rights_review_status: "needs_review" }) },
  { label: "a development capture", open: false, change: id => patch(id, r => { r.evidence_tier = "development_only"; }) },
  { label: "scene no longer launches", open: false, change: id => patch(id, r => { r.evaluation_readiness.runtime_launchable = false; }) },
  { label: "no current recording grant", open: false, change: id => patch(id, r => { r.request.consent_attestation = null; }) },
  { label: "retired dossier kept the job private", open: false,
    change: id => patch(id, r => { r.request.pilotOpportunity = { requested: true, visibility: "private" }; }) },
  // Even the named team: the beta's card cannot honour a narrower list.
  { label: "retired dossier named only certain teams", open: false,
    change: (id, team) => patch(id, r => { r.request.pilotOpportunity = { requested: true, visibility: "approved_robot_teams",
      approvedRobotTeamEmails: [`${team}@example.test`] }; }) },
  { label: "a robot team still awaiting approval", open: false, viewer: PENDING },
  // A re-confirmed brief screened as a kind we cannot score (`siteTaskScope.ts`).
  { label: "a job we cannot score yet", open: false, change: id => patch(id, r => {
    r.site_task_scope = { schemaVersion: "site_task_scope.v1", supported: false, kind: null, reason: "deformable" }; }) },
];

describe("every surface gives the same answer", () => {
  it.each(rows)("$label", async (row) => {
    const { buildTeamEvalCandidates } = await import("../utils/teamEvalCandidates");
    const { projectWorkspaceTask } = await import("../utils/workspace-projection");
    // A fresh approved team per row: intake limits each mailbox to three
    // requests in fifteen minutes, workspace evaluation requests included.
    const team = next("robot-team");
    await robotAccount(team, true);
    const viewer = row.viewer ?? team;
    const start = row.start ?? "public";
    const jobId = await startJob({ keepPrivate: start === "kept_private" });
    if (start !== "not_confirmed") await confirm(jobId);
    if (start !== "not_synced") await pipelineSync(jobId);
    // A change after a team asked: the request was accepted while the job was open.
    let applicationId: string | null = null;
    if (row.change || row.open) {
      const requested = await requestEvaluation(jobId, team);
      expect(requested.status, await requested.clone().text()).toBe(201);
      applicationId = (await requested.json()).requestId;
      await row.change?.(jobId, team);
    }

    const card = (await library(viewer)).items.find(item => item.id === jobId);
    const opening = await workspaceApi(`/openings/${jobId}`, viewer);
    const request = await requestEvaluation(jobId, viewer);
    const surfaces: Record<string, boolean> = {
      library: card?.evaluationAvailable === true,
      opening: opening.status === 200,
      request: request.status === 201,
    };
    const site = projectWorkspaceTask(jobId, doc(`inboundRequests/${jobId}`)).published;
    if (viewer === team) {
      // Job-level surfaces answer for every approved team at once.
      surfaces.site = site;
      surfaces.agentApi = (await buildTeamEvalCandidates({ teamId: TEAM, checkpointId: CHECKPOINT }))
        .some(candidate => candidate.sceneId === jobId);
    } else {
      // The job is open to approved teams; only this account is refused.
      expect(site).toBe(true);
    }
    if (applicationId && viewer === team) {
      preparedExecution(team);
      surfaces.freeAdmission = await approveFreeRun(applicationId).then(() => true, (error: Error) => {
        // Refused by the job's state, before any execution is prepared.
        expect(error.message).toMatch(/^free_evaluation_(job_not_open|scene_authority_unavailable)/);
        expect(prepare).not.toHaveBeenCalled();
        return false;
      });
    }
    expect(surfaces).toEqual(Object.fromEntries(Object.keys(surfaces).map(key => [key, row.open])));

    if (!row.open) {
      // Refused for the job's state (404) or the account's (403), never by accident.
      if (viewer === team) {
        for (const response of [opening, request]) {
          expect(response.status).toBe(404);
          expect((await response.json()).code).toBe("job_not_open");
        }
      } else {
        expect([opening.status, request.status]).toEqual([403, 403]);
        expect((await library(viewer)).items).toEqual([]);
      }
      expect([...state.docs.keys()].filter(key => key.startsWith("evaluationRuns/"))).toEqual([]);
    }
  });
});
