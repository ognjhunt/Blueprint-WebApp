// @vitest-environment node
/**
 * ADP day-14/day-28/day-42: one correction request remains one task through
 * free admission, claimed dispatch, failed development-result ingestion and
 * authorized review. This is a hermetic contract rehearsal, not native or
 * physical execution: capture/testbed publications and the failed native
 * response below are explicit external-boundary fixtures.
 *
 * Rights, consent, supplement lineage, request preparation, admission, HMAC,
 * dispatch ownership, settlement, result projection and pilot gates are real.
 * Only Firebase persistence/auth and external transport are substituted.
 */
import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { listedTaskCard } from "./helpers/listedTaskCard";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE, fakeArrayUnion } = await import("./helpers/fake-firestore");
  return {
    dbAdmin: sharedFakeFirestore, storageAdmin: null, authAdmin: null,
    default: { firestore: { FieldValue: {
      serverTimestamp: () => new Date().toISOString(), delete: () => FAKE_FIELD_DELETE,
      arrayUnion: (...items: unknown[]) => fakeArrayUnion(...items), increment: (n: number) => n,
    } } },
  };
});
vi.mock("../constants/stripe", () => ({ stripeClient: null, stripeAvailable: false }));
vi.mock("../utils/email", () => ({ sendEmail: vi.fn(() => { throw new Error("No email transport in journey contract"); }) }));
vi.mock("../agents/runtime", () => ({ runAgentTask: vi.fn(() => { throw new Error("No model calls in journey contract"); }) }));

const sha = (c: string) => `sha256:${c.repeat(64)}`;
const SITE = "task-journey", SCENE = `site-${SITE}`, PARENT = `walkthrough-${SITE}`;
const APPLICATION = "evaluation-journey", TEAM = "team-journey", CHECKPOINT = "checkpoint-journey";
const OWNER = "site-owner", ROBOT = "robot-owner", STRANGER = "other-owner";
const syncSecret = "synthetic-contract-sync-secret-never-live";
const terms = { successRate: 95, cycleTimeSeconds: 30, pilotBudgetUsd: 25000,
  deploymentBudgetUsd: null, targetDate: null, successDefinition: "Place carton without dropping it" };
let server: Server | undefined, base = "";
const originalFetch = globalThis.fetch;

beforeEach(async () => {
  state.docs.clear();
  vi.stubEnv("PIPELINE_SYNC_TOKEN", syncSecret);
  vi.stubEnv("PIPELINE_SYNC_ALLOW_LEGACY_BEARER", "false");
  vi.stubEnv("FIELD_ENCRYPTION_KMS_KEY_NAME", "");
  vi.stubEnv("FIELD_ENCRYPTION_MASTER_KEY", Buffer.alloc(32, 7).toString("base64"));
  vi.stubEnv("BLUEPRINT_ROBOT_TEAM_EARLY_ACCESS", "1");
  vi.stubEnv("BLUEPRINT_BETA_INVITE_CAP", "100");
  vi.stubEnv("BLUEPRINT_BETA_COHORT_DAILY_LIMIT", "100");
  vi.stubGlobal("fetch", (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    if (url.hostname !== "127.0.0.1") throw new Error("External network forbidden in journey contract");
    return originalFetch(input, init);
  });
  console.log("journey_setup_routes_started", Date.now(), process.version);
  // The route graphs share cyclic run/result modules. Await their evaluation
  // separately so Vitest's mocked dynamic importer cannot wait on both graphs.
  const { default: workspace } = await import("../routes/workspace");
  console.log("journey_setup_workspace_loaded", Date.now());
  const { default: pipeline } = await import("../routes/internal-agent-run-settlement");
  console.log("journey_setup_pipeline_loaded", Date.now());
  console.log("journey_setup_routes_loaded", Date.now());
  const app = express();
  app.use(express.json());
  // This substitutes Firebase's verified token, not the workspace's actual
  // role, ownership, visibility or pilot authorization middleware.
  app.use((req, res, next) => {
    const uid = String(req.headers["x-fixture-user"] || "");
    res.locals.firebaseUser = { uid, email: `${uid}@example.test`, email_verified: true };
    next();
  });
  app.use("/api/workspace", workspace);
  app.use("/api/internal/pipeline", pipeline);
  server = createServer(app);
  await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
  console.log("journey_setup_listening", Date.now());
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterEach(async () => {
  if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
  server = undefined;
  vi.unstubAllEnvs(); vi.unstubAllGlobals();
});

async function api(path: string, uid: string, body?: unknown) {
  return fetch(`${base}/api/workspace${path}`, { method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", "x-fixture-user": uid },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function pipeline(path: string, body?: unknown) {
  const { buildPipelineSyncSignature } = await import("../utils/pipelineSyncSecurity");
  const timestamp = new Date().toISOString(), encoded = JSON.stringify(body ?? {});
  return fetch(`${base}/api/internal/pipeline${path}`, { method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", "X-Blueprint-Pipeline-Timestamp": timestamp,
      "X-Blueprint-Pipeline-Signature": buildPipelineSyncSignature({ secret: syncSecret, timestamp, body: encoded }) },
    ...(body === undefined ? {} : { body: encoded }) });
}
const doc = (path: string): any => state.docs.get(path);

it("retains correction lineage through actual free admission and signed failed-result review without qualifying a pilot", async () => {
  const { RECORDING_CONSENT_VERSION } = await import("../utils/recordingConsent");
  const { encryptFieldValue } = await import("../utils/field-encryption");
  const { recordCoverageFinding } = await import("../utils/captureCoverageReview");
  const { issueCaptureSupplement, validateCaptureSupplement } = await import("../utils/captureSupplement");
  const { verifyCaptureUploadToken } = await import("../utils/captureUploadToken");
  const { humanDecisionDigest } = await import("../utils/human-reply-admission");
  const { admitFreeWorkspaceEvaluation } = await import("../utils/freeEvaluationHandoff");
  const { accessRecordId } = await import("../utils/robotTeamEarlyAccess");
  const { TERMS_VERSION, PRIVACY_VERSION } = await import("../../client/src/lib/legalAcceptance");
  const brief = { summary: "Move one rigid carton into the destination bin" };
  const parentSource = { kind: "app_bundle", fixture_only: true, capture_id: PARENT };
  for (const [uid, buyerType] of [[OWNER, "site_operator"], [ROBOT, "robot_team"], [STRANGER, "site_operator"]]) {
    state.docs.set(`users/${uid}`, { buyerType, name: uid, email: `${uid}@example.test`,
      acceptedTerms: true, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION });
  }
  state.docs.set(`robotTeamAccess/${accessRecordId(`${ROBOT}@example.test`)}`, { status: "approved", decidedBy: "fixture-ops", decidedAtIso: "2026-10-09T00:00:00Z" });
  state.docs.set(`robotTeams/${TEAM}`, { id: TEAM, name: "Fixture robot team", status: "self_registered",
    accountUid: ROBOT, accountEmail: `${ROBOT}@example.test`, capability: {}, fieldProvenance: {},
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  state.docs.set(`robotCheckpoints/${CHECKPOINT}`, { checkpointId: CHECKPOINT, teamId: TEAM,
    label: "Contract fixture only", runtime: "customer_hosted", reference: "https://policy.example.test/action" });
  state.docs.set(`users/${ROBOT}/robotSetups/setup-journey`, {
    payload: await encryptFieldValue(JSON.stringify({ id: "setup-journey", name: "Fixture arm", delivery: "endpoint",
      reference: "https://policy.example.test/action", version: "fixture-v1" })),
  });
  state.docs.set(`siteTaskBriefs/${SITE}`, brief);
  state.docs.set(`inboundRequests/${SITE}`, {
    requestId: SITE, account_owner_uid: OWNER, contact: { firstName: "Fixture", lastName: "Owner", email: `${OWNER}@example.test`, roleTitle: "Owner", company: "Fixture site" },
    request: { buyerType: "site_operator", siteName: "Private fixture site", capture_mode: "self_capture",
      taskStatement: brief.summary, consent_attestation: { granted: true, statement_version: RECORDING_CONSENT_VERSION,
        recorded_at_iso: new Date().toISOString() } },
    siteTaskGates: { sceneStability: "stable", taskShape: "single", objectVariety: "under_10",
      deploymentTimeline: "this_quarter", accessWindow: "scheduled" },
    site_task_triage: { disposition: "qualified" }, site_task_brief_confirmed_at: new Date().toISOString(),
    public_task_listing: listedTaskCard(brief.summary), workspace_task: { terms },
    pipeline: { capture_job_id: PARENT, capture_id: PARENT },
    capture_privacy_source_bound_decision: { proceeded: true, capture_id: PARENT, producer_source: parentSource },
  });
  state.docs.set(`captureUploadSessions/${PARENT}`, {
    site_capture_bundle: { request_id: SITE, scene_id: SCENE },
    immutable_upload_identity: { raw_bundle_digest: sha("a"), raw_manifest_uri: `gs://fixture/${PARENT}/manifest.json` },
  });
  const originalParent = structuredClone(doc(`captureUploadSessions/${PARENT}`));
  state.docs.set(`inboundRequests/${APPLICATION}`, { requestId: APPLICATION, account_owner_uid: ROBOT,
    contact: { firstName: "Fixture", lastName: "Team", email: `${ROBOT}@example.test`, roleTitle: "Engineer", company: "Fixture team" },
    request: { buyerType: "robot_team" }, workspace_evaluation: { opportunityId: SITE, setupId: "setup-journey",
      targetSnapshot: terms, opportunityTitle: brief.summary } });
  const approval = { teamId: TEAM, checkpointId: CHECKPOINT, episodes: 1, sponsorCapUsd: 10,
    maxAttempts: 1, evidenceScope: "development_only", expiresAtIso: new Date(Date.now() + 600_000).toISOString() };

  await recordCoverageFinding(SITE, PARENT, { coversScene: false, missingCoverage: ["Show the destination bin from above"],
    supplementWouldFinish: true, confidence: .9, unreadableReasons: [] },
  { source: parentSource, capture_id: PARENT, brief_digest: humanDecisionDigest(brief) });
  await expect(admitFreeWorkspaceEvaluation(APPLICATION, approval, "fixture-operator")).rejects.toThrow("scene_not_runnable");
  expect([...state.docs.keys()].filter(key => key.startsWith("evaluationRuns/"))).toHaveLength(0);
  const parentLink = { requestId: SITE, sceneId: SCENE, captureId: PARENT, exp: Math.floor(Date.now() / 1000) + 3600 };
  const issued = await issueCaptureSupplement(parentLink);
  const retried = await issueCaptureSupplement(parentLink);
  expect(retried.captureId).toBe(issued.captureId);
  const token = verifyCaptureUploadToken(issued.token)!;
  expect(token).toMatchObject({ requestId: SITE, sceneId: SCENE, captureId: issued.captureId,
    supplement: { parent_capture_id: PARENT, parent_bundle_digest: sha("a") } });
  await validateCaptureSupplement(token);
  await expect(validateCaptureSupplement({ ...token, requestId: "another-task" })).rejects.toThrow("supplement_parent_changed");
  expect(doc(`captureSupplements/${issued.captureId}`).parent_coverage.missing_coverage).toEqual(["Show the destination bin from above"]);

  // External boundary: a synthetic, already verified child publication. No
  // upload, privacy/model call, reconstruction, policy or provider ran here.
  const child = issued.captureId, childSource = { kind: "app_bundle", fixture_only: true, capture_id: child };
  state.docs.set(`captureUploadSessions/${child}`, {
    fixture_only: true, site_capture_bundle: { request_id: SITE, scene_id: SCENE },
    immutable_upload_identity: { raw_bundle_digest: sha("c"), raw_manifest_uri: `gs://fixture/${child}/manifest.json` },
    pipeline_site_task_testbed: { testbed_id: "testbed-journey", version: "1", testbed_digest: sha("b"), testbed: {
      approved_task_definition: { approved_task_id: "pick-carton", task: { task_family: "pick_place" } },
      source_capture_bundles: [{ bundle_id: child, digest: sha("c") }], compiled_cards: { site_card: { id: SCENE } },
    } },
  });
  const task = doc(`inboundRequests/${SITE}`);
  state.docs.set(`inboundRequests/${SITE}`, { ...task,
    capture_privacy_source_bound_decision: { proceeded: true, capture_id: child, producer_source: childSource },
    pipeline: { capture_job_id: child, capture_id: child, artifacts: { worldlabs_world_manifest_uri: "gs://fixture/world.json" } },
    evaluation_readiness: { runtime_launchable: true, benchmark_coverage_status: "ready" },
    agent_execution_offer: { schema_version: "blueprint.agent_execution_offer.v1", scene_id: SCENE, capture_id: child,
      capture_root: `/srv/fixture/scenes/${SCENE}/captures/${child}`, scenario_id: "capture_observed", episode_count: 1,
      episode_specs_sha256: sha("e"), policy_execution_profiles: ["controlled_observation_v1"] },
  });
  await recordCoverageFinding(SITE, child, { coversScene: true, missingCoverage: [], supplementWouldFinish: false,
    confidence: .9, unreadableReasons: [], sourceCaptures: [{ capture_id: PARENT, bundle_digest: sha("a") }] },
  { source: childSource, capture_id: child, brief_digest: humanDecisionDigest(brief) });
  expect(doc(`captureUploadSessions/${PARENT}`)).toEqual(originalParent);
  expect(doc(`inboundRequests/${SITE}`).capture_coverage.source_captures[0].capture_id).toBe(PARENT);
  const created = await admitFreeWorkspaceEvaluation(APPLICATION, approval, "fixture-operator");
  expect(created.created).toBe(true);
  expect(await admitFreeWorkspaceEvaluation(APPLICATION, approval, "fixture-operator")).toEqual({ ...created, created: false });
  const run = doc(`evaluationRuns/${created.runId}`);
  expect(run.executionAdmission.envelope.binding).toMatchObject({ scene_request_id: SITE, capture_id: child, capture_digest_sha256: sha("c") });
  expect(run.executionAdmission.envelope.proof_boundary).toMatchObject({ provider_spend_authorized: false, physical_success_proven: false });
  expect(run.quotedUsd).toBe(0);
  expect(run.executionAdmission.envelope.canonical_execution_request.execution_authorization.max_cost_usd).toBe(10);
  expect(run.executionAdmission.envelope.canonical_execution_request.policy_package.policy_api_endpoint.execution_profile).toBe("controlled_observation_v1");
  expect(doc(`inboundRequests/${APPLICATION}`).free_evaluation_handoff.runId).toBe(created.runId);
  expect([...state.docs.keys()].filter(key => key.startsWith("evaluationRuns/"))).toHaveLength(1);

  const queue = await pipeline(`/agent-runs?capture_id=${child}`);
  expect(queue.status, await queue.clone().text()).toBe(200);
  expect((await queue.json()).runs.map((row: any) => row.run_id)).toEqual([created.runId]);
  expect((await (await pipeline(`/agent-runs?capture_id=${PARENT}`)).json()).runs).toEqual([]);
  const claim = { pipeline_run_id: "fixture-attempt-1", execution_admission_digest: run.executionAdmission.digestSha256 };
  expect((await pipeline(`/agent-runs/${created.runId}/started`, claim)).status).toBe(200);
  expect((await pipeline(`/agent-runs/${created.runId}/started`, claim)).status).toBe(200);
  expect((await pipeline(`/agent-runs/${created.runId}/started`, { ...claim, pipeline_run_id: "other-attempt" })).status).toBe(409);

  const result = { ...claim, reservation_id: run.reservationId, episodes_run: 1, episodes_succeeded: 0,
    note: "Synthetic failed native response for development contract testing; no policy executed.",
    private_execution_result: { schema_version: "blueprint.controlled_native_private_result.v1", evidence_scope: "development_only",
      native_simulator: "isaac", source_commit: "f".repeat(40), execution_receipt_digest: sha("d"), outcome_receipt_digest: sha("f"),
      task_spec_digest: sha("b"), samples_digest: sha("e"), policy_queries: 1, executed_motor_steps: 1,
      task_success: false, outcome: "fixture_task_failed", scene_files_exported: false, scoring_harness_exported: false,
      physical_success_proven: false, qualification_eligible: false, provider_zero_verified: true,
      provider_cost_status: "pending_official_reconciliation", observed_provider_cost_usd: null } };
  expect((await fetch(`${base}/api/internal/pipeline/agent-run-results`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(result) })).status).toBe(401);
  expect((await pipeline("/agent-run-results", { ...result, pipeline_run_id: "other-attempt" })).status).toBe(409);
  expect((await pipeline("/agent-run-results", { ...result, execution_admission_digest: sha("0") })).status).toBe(409);
  expect(doc(`evaluationRuns/${created.runId}`).result).toBeUndefined();
  const reported = await pipeline("/agent-run-results", result);
  expect(reported.status, await reported.clone().text()).toBe(200);
  const resultNotices = [...state.docs.keys()].filter(key => key.startsWith("captureOutbox/")).sort();
  expect((await pipeline("/agent-run-results", result)).status).toBe(200);
  expect([...state.docs.keys()].filter(key => key.startsWith("captureOutbox/")).sort()).toEqual(resultNotices);
  const settled = await pipeline("/agent-run-settlements", { ...claim, reservation_id: run.reservationId,
    team_id: TEAM, episodes_run: 1, rate_usd: 0, run_id: "fixture-attempt-1" });
  expect(settled.status, await settled.clone().text()).toBe(200);
  expect((await settled.json()).amountUsd).toBe(0);
  expect(doc(`evaluationRuns/${created.runId}`).result).toMatchObject({ evidenceScope: "development_only",
    observed: { episodesRun: 1, episodesSucceeded: 0 }, privateExecutionResult: { task_success: false, physical_success_proven: false } });
  expect(doc(`robotTeams/${TEAM}`).status).toBe("self_registered");

  const robotWorkspace = await api("", ROBOT);
  expect(robotWorkspace.status, await robotWorkspace.clone().text()).toBe(200);
  const evaluations = (await robotWorkspace.json()).evaluations;
  expect(evaluations).toHaveLength(1);
  expect(evaluations[0]).toMatchObject({ id: APPLICATION, runId: created.runId, sampleCount: 1, successRate: 0,
    evidenceLabel: "Development simulation", targetsMet: null, selected: false });
  const siteWorkspace = await api("", OWNER);
  expect(siteWorkspace.status, await siteWorkspace.clone().text()).toBe(200);
  const tasks = (await siteWorkspace.json()).tasks;
  expect(tasks).toHaveLength(1);
  expect(tasks[0].id).toBe(SITE);
  expect(tasks[0].results.filter((row: any) => row.id === created.runId)).toHaveLength(1);
  expect((await api(`/tasks/${SITE}/pilot`, OWNER, { action: "invite", resultId: created.runId,
    siteVisitAnswer: "yes", notes: "A fixture must not qualify a real pilot" })).status).toBe(409);
  expect((await api(`/tasks/${SITE}`, OWNER)).status).toBe(200);
  expect((await api(`/tasks/${SITE}`, STRANGER)).status).toBe(404);
  expect((await (await api("", STRANGER)).json()).tasks).toEqual([]);
  expect(doc(`inboundRequests/${SITE}`).workspace_task.pilot?.selectedResultId).toBeUndefined();
  expect(doc(`captureUploadSessions/${PARENT}`)).toEqual(originalParent);
  expect([...state.docs.keys()].some(key => /^robotTeamLedger\//.test(key))).toBe(false);
  expect((await import("../utils/email")).sendEmail).not.toHaveBeenCalled();
  expect((await import("../agents/runtime")).runAgentTask).not.toHaveBeenCalled();
});
