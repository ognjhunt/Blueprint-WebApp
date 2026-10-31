// @vitest-environment node
import { createServer, request as httpRequest, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import express from "express";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { buildPipelineSyncSignature } from "../utils/pipelineSyncSecurity";
import { allCandidateFamilyScreeningFixture, familyScreeningFixture, finishedScreening, screeningFixture, screeningSha, sealScreening,
  sealSelection, selectionFixture } from "./fixtures/beta-policy-screening";
import { crossRuntimeArtifactDigest } from "../utils/crossRuntimeCanonical";
import { publicationFromResultRecord } from "../utils/taskEvaluationRunPublicationStorage";
import { scientificBriefDigest } from "../utils/jobEvidenceContract";
import { loadManagedJobEvidence } from "../utils/jobManagedEvaluation";
import { readCurrentTaskScreening } from "../utils/taskScreeningEvidence";

const store = vi.hoisted(() => ({ rows: new Map<string, any>(), teams: [] as Array<{ id: string; name: string }> }));
vi.mock("../utils/pipelineSyncSecurity", async importOriginal => ({
  ...await importOriginal<typeof import("../utils/pipelineSyncSecurity")>(),
  createPipelineSyncRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../utils/robotTeamRegistry", () => ({ listMatchableRobotTeams: async () => store.teams }));
vi.mock("../../client/src/lib/firebaseAdmin", () => {
  const reference = (name: string, id: string): any => ({ id, path: `${name}/${id}`, get: async () => snapshot(reference(name, id)) });
  const snapshot = (ref: any) => ({ id: ref.id, ref, exists: store.rows.has(ref.path), data: () => structuredClone(store.rows.get(ref.path)) });
  return { dbAdmin: { collection: (name: string) => ({ doc: (id: string) => reference(name, id),
    where: (key: string, _operator: string, value: unknown) => {
      const query = (limit = 20, cursor?: string): any => ({ orderBy: () => query(limit, cursor),
        limit: (count: number) => query(count, cursor), startAfter: (document: { id: string }) => query(limit, document.id),
        get: async () => {
          const rows = [...store.rows.entries()].filter(([path, data]) => path.startsWith(`${name}/`)
            && key.split(".").reduce((current, part) => current?.[part], data) === value)
            .sort((left, right) => String(right[1].created_at_iso).localeCompare(String(left[1].created_at_iso)));
          const start = cursor ? rows.findIndex(([path]) => path === `${name}/${cursor}`) + 1 : 0;
          return { docs: rows.slice(start, start + limit).map(([path]) => snapshot(reference(name, path.slice(name.length + 1)))) };
        } });
      return query();
    } }),
    runTransaction: async (fn: any) => {
      const writes: Array<[string, any, boolean]> = [];
      const result = await fn({ get: async (ref: any) => snapshot(ref),
        set: (ref: any, value: any, options?: { mergeFields?: string[] }) => writes.push([ref.path, value, Boolean(options?.mergeFields)]) });
      writes.forEach(([path, value, merge]) => store.rows.set(path, structuredClone(merge ? { ...store.rows.get(path), ...value } : value)));
      return result;
    } } };
});

let server: Server | undefined;
beforeEach(() => {
  store.rows.clear();
  store.teams = [];
  const { job, brief, intake } = screeningFixture();
  store.rows.set("inboundRequests/job-one", job);
  store.rows.set("siteTaskBriefs/job-one", brief);
  store.rows.set("taskEvaluationSceneIntakes/intake-one", intake);
  vi.stubEnv("PIPELINE_SYNC_TOKEN", "test-only-screening-signature");
  vi.stubEnv("PIPELINE_SYNC_ALLOW_LEGACY_BEARER", "false");
});
afterEach(async () => { vi.unstubAllEnvs(); if (server) await new Promise<void>(resolve => server!.close(() => resolve())); server = undefined; });
async function endpoint() {
  const app = express();
  app.use(express.json({ verify(req, _res, buffer) { (req as any).rawBody = buffer.toString(); } }));
  app.use("/api/internal/pipeline", (await import("../routes/internal-beta-policy-screening")).default);
  server = createServer(app);
  const socketPath = join(tmpdir(), `blueprint-screening-${randomUUID()}.sock`);
  await new Promise<void>((resolve, reject) => { server!.once("error", reject); server!.listen(socketPath, resolve); });
  return socketPath;
}
function signed(body: unknown) {
  const text = JSON.stringify(body), timestamp = new Date().toISOString();
  return { method: "POST", headers: { "Content-Type": "application/json", "X-Blueprint-Pipeline-Timestamp": timestamp,
    "X-Blueprint-Pipeline-Signature": buildPipelineSyncSignature({ secret: "test-only-screening-signature", timestamp, body: text }) }, body: text };
}

it("requires the existing Pipeline signature before accepting any publication", async () => {
  const url = await endpoint(), { publication } = screeningFixture();
  const result = await send(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(publication) });
  expect(result.status).toBe(401);
  expect([...store.rows.keys()].some(key => key.startsWith("taskEvaluationPolicyRuns/"))).toBe(false);
});

it("atomically stores diagnostic progress in existing managed evidence and accepts exact retry", async () => {
  const url = await endpoint(), { publication } = screeningFixture();
  const first = await send(url, signed(publication));
  expect(first.status).toBe(201);
  expect((await first.json()).status).toBe("created");
  const run = store.rows.get("taskEvaluationPolicyRuns/campaign-one");
  expect(run.job_evidence_binding.job_id).toBe("job-one");
  expect(run.screening_execution_observed).toBe(false);
  expect(publicationFromResultRecord(store.rows.get(`captureTaskEvaluationRuns/${run.result_record_id}`))).toEqual(publication);
  expect((await (await send(url, signed(publication))).json()).status).toBe("replayed");
  const waiting = sealScreening({ ...publication, revision: 2, status: "running",
    candidates: publication.candidates.map((row, index) => index ? row : { ...row, status: "preparing", blockers: ["beta_screening_waiting_for_capacity"] }) });
  expect((await send(url, signed(waiting))).status).toBe(200);
  expect(store.rows.get("taskEvaluationPolicyRuns/campaign-one").screening_execution_observed).toBe(false);
  const next = sealScreening({ ...publication, revision: 3, status: "running",
    candidates: publication.candidates.map((row, index) => index ? row : { ...row, status: "running" }) });
  expect((await send(url, signed(next))).status).toBe(200);
  expect(store.rows.get("taskEvaluationPolicyRuns/campaign-one").screening_execution_observed).toBe(true);
  expect((await (await send(url, signed(publication))).json()).status).toBe("superseded");
  expect(store.rows.get("taskEvaluationPolicyRuns/campaign-one").publication_revision).toBe(3);
  const briefDigest = scientificBriefDigest(store.rows.get("siteTaskBriefs/job-one"));
  expect((await loadManagedJobEvidence("job-one", briefDigest))[0].current).toBe(true);
  const status = store.rows.get("taskEvaluationSceneIntakes/intake-one").pipeline_status;
  status.result_reference.digest = screeningSha("9");
  status.status_digest = crossRuntimeArtifactDigest(status, "status_digest");
  expect((await loadManagedJobEvidence("job-one", briefDigest))[0].current).toBe(false);
});

it.each(["legacy", "scripted"])("stores signed single-candidate family results (%s) and replays the exact publication", async kind => {
  const { publication, intake } = familyScreeningFixture();
  store.rows.set("taskEvaluationSceneIntakes/intake-one", intake);
  const completed = sealScreening({ ...publication, status: "completed", candidates: [{ ...publication.candidates[0],
    status: "completed", episodes_scored: 3, episodes_succeeded: 2, episodes_failed: 1,
    success_rate: 2 / 3, session_result_digest: screeningSha("6"),
    ...(kind === "scripted" ? { execution_evidence_kind: "scripted_simulator_state_baseline", action_source: "scripted_simulator_state",
      scripted_rollout_count: 3, learned_policy_rollout_count: 0, scripted_controller_invoked: true, candidate_policy_queried: false } : {}) }] });
  const url = await endpoint();
  expect((await send(url, signed(completed))).status).toBe(201);
  expect((await (await send(url, signed(completed))).json()).status).toBe("replayed");
  const run = store.rows.get("taskEvaluationPolicyRuns/campaign-one");
  const retained = publicationFromResultRecord(store.rows.get(`captureTaskEvaluationRuns/${run.result_record_id}`));
  expect(retained).toEqual(completed);
  expect(run.screening_execution_observed).toBe(true);
  const briefDigest = scientificBriefDigest(store.rows.get("siteTaskBriefs/job-one"));
  expect((await loadManagedJobEvidence("job-one", briefDigest))[0].current).toBe(true);
  if (kind === "scripted") {
    const readback = await readCurrentTaskScreening({ requestId: "job-one", briefDigest, captureId: completed.source.capture_id });
    expect(readback.runs[0].candidates[0].executionEvidence).toMatchObject({ execution_evidence_kind: "scripted_simulator_state_baseline",
      scripted_rollout_count: 3, learned_policy_rollout_count: 0, candidate_policy_queried: false });
    expect(Object.values(readback.evidence_source!.content.content.candidate_statements)[0]).toContain("do not establish learned-policy or vendor-policy performance");
  }
  for (const field of ["native_runtime_contract_digest", "runtime_catalog_digest", "request_digest"] as const) {
    const changed = structuredClone(intake);
    if (field === "native_runtime_contract_digest") changed.pipeline_status.result_reference.native_runtime_contract_digest = screeningSha("9");
    else if (field === "runtime_catalog_digest") changed.pipeline_status.result_reference.task_family_runtime_selection.runtime_catalog_digest = screeningSha("9");
    else {
      changed.request.task.native_runtime_contract_digest = screeningSha("9");
      changed.pipeline_status.result_reference.native_runtime_contract_digest = screeningSha("9");
    }
    changed.pipeline_status.status_digest = crossRuntimeArtifactDigest(changed.pipeline_status, "status_digest");
    store.rows.set("taskEvaluationSceneIntakes/intake-one", changed);
    expect((await loadManagedJobEvidence("job-one", briefDigest))[0].current).toBe(false);
  }
});

it("stores and projects all 84 family candidate outcomes while preserving exact scene, task and capture authority", async () => {
  const { publication, intake } = allCandidateFamilyScreeningFixture();
  store.rows.set("taskEvaluationSceneIntakes/intake-one", intake);
  const completed = sealScreening({ ...publication, status: "completed", candidates: publication.candidates.map((row, index) =>
    index < 2 ? { ...row, status: "completed", blockers: [], episodes_planned: 3,
      episodes_scored: 3, episodes_succeeded: 2, episodes_failed: 1,
      success_rate: 2 / 3, session_result_digest: screeningSha(index ? "7" : "6") } : row) });
  expect(Buffer.byteLength(JSON.stringify(completed))).toBeLessThan(1024 * 1024);
  const url = await endpoint();
  for (const field of ["scene_revision_digest", "task_id", "capture_id"] as const) {
    const wrongSource = sealScreening({ ...completed, source: { ...completed.source,
      [field]: field.endsWith("_digest") ? screeningSha("9") : "another-source" } });
    const rejected = await send(url, signed(wrongSource));
    expect(rejected.status).toBe(409);
    expect((await rejected.json()).code).toBe("screening_scene_source_mismatch");
    expect([...store.rows.keys()].some(key => /taskEvaluationPolicyRuns|captureTaskEvaluationRuns/.test(key))).toBe(false);
  }
  expect((await send(url, signed(completed))).status).toBe(201);
  expect((await (await send(url, signed(completed))).json()).status).toBe("replayed");
  const run = store.rows.get("taskEvaluationPolicyRuns/campaign-one");
  const retained = publicationFromResultRecord(store.rows.get(`captureTaskEvaluationRuns/${run.result_record_id}`));
  expect(retained).toEqual(completed);
  const briefDigest = scientificBriefDigest(store.rows.get("siteTaskBriefs/job-one"));
  const [evidence] = await loadManagedJobEvidence("job-one", briefDigest);
  expect(evidence.current).toBe(true);
  expect(evidence.screening?.candidates).toHaveLength(84);
  expect(evidence.screening?.candidates).toEqual(completed.candidates.map(row => ({
    candidateId: row.candidate_id, name: row.display_name, state: row.status,
    configurationDigest: row.configuration_digest,
    planned: row.episodes_planned, scored: row.episodes_scored, succeeded: row.episodes_succeeded,
    failed: row.episodes_failed, void: row.episodes_void, blockers: row.blockers,
  })));
  // Separate policy routes for one body remain separate rows, including their reasons.
  expect(evidence.screening?.candidates.filter(row => row.candidateId.startsWith("universal_robots_ur5e__")).length).toBeGreaterThan(1);
  const scope = { requestId: "job-one", briefDigest, captureId: completed.source.capture_id };
  // The current task result remains discoverable below a page of unrelated
  // or historical campaigns; the workspace's default page stays unchanged.
  for (let index = 0; index < 25; index++) store.rows.set(`taskEvaluationPolicyRuns/historical-${index}`, {
    run_id: `historical-${index}`, job_evidence_binding: { job_id: "job-one", brief_digest: screeningSha("9") },
    created_at_iso: `2099-01-${String(index + 1).padStart(2, "0")}T00:00:00Z`, state: "blocked",
  });
  expect((await loadManagedJobEvidence("job-one", briefDigest)).some(row => row.current)).toBe(false);
  const readback = await readCurrentTaskScreening(scope);
  expect(readback.status).toBe("recorded");
  expect(readback.runs[0].candidates).toEqual(evidence.screening?.candidates);
  expect(readback.runs[0].provenance).toMatchObject({ source: completed.source,
    generated_at: completed.generated_at, publication_digest: completed.publication_digest });
  expect(Object.keys(readback.evidence_source!.content.content.candidate_statements)).toHaveLength(84);
  for (const different of [{ requestId: "other-job" }, { captureId: "other-capture" }, { briefDigest: screeningSha("9") }]) {
    const inaccessible = await readCurrentTaskScreening({ ...scope, ...different });
    expect(inaccessible).toMatchObject({ status: "unavailable", runs: [], evidence_source: null });
  }
  store.rows.get("inboundRequests/job-one").request.consent_attestation.revoked_at_iso = "2026-10-26T13:00:00Z";
  expect((await send(url, signed(completed))).status).toBe(409);
  expect((await loadManagedJobEvidence("job-one", briefDigest, { pageAll: true })).some(row => row.current)).toBe(false);
  expect(await readCurrentTaskScreening(scope)).toMatchObject({ status: "unavailable", runs: [], evidence_source: null });
});

it("refuses cross-site and revoked source publications without partial records", async () => {
  const url = await endpoint(), { publication } = screeningFixture();
  const wrongSite = sealScreening({ ...publication, site_id: "site-other" });
  expect((await send(url, signed(wrongSite))).status).toBe(409);
  store.rows.get("inboundRequests/job-one").request.consent_attestation.revoked_at_iso = "2026-10-26T13:00:00Z";
  expect((await send(url, signed(publication))).status).toBe(409);
  expect([...store.rows.keys()].some(key => /taskEvaluationPolicyRuns|captureTaskEvaluationRuns/.test(key))).toBe(false);
});

it("rejects a campaign ID already owned by another execution mode", async () => {
  const url = await endpoint(), { publication } = screeningFixture();
  store.rows.set("taskEvaluationPolicyRuns/campaign-one", { run_kind: "internal_policy_canary" });
  expect((await send(url, signed(publication))).status).toBe(409);
  expect(store.rows.get("taskEvaluationPolicyRuns/campaign-one")).toEqual({ run_kind: "internal_policy_canary" });
});

it("accepts proposed preparation screening and shows it as current until the task is confirmed or changes", async () => {
  const { publication, job, brief, intake } = screeningFixture(true);
  store.rows.set("inboundRequests/job-one", job);
  store.rows.set("siteTaskBriefs/job-one", brief);
  store.rows.set("taskEvaluationSceneIntakes/intake-one", intake);
  const url = await endpoint();
  expect((await send(url, signed(publication))).status).toBe(201);
  const digest = scientificBriefDigest(brief);
  let evidence = await loadManagedJobEvidence("job-one", digest);
  expect(evidence[0].current).toBe(true);
  expect(evidence[0].screening?.candidates).toHaveLength(36);
  store.rows.set("siteTaskBriefs/job-one", { ...brief, confirmedAtIso: "2026-10-26T13:00:00Z" });
  evidence = await loadManagedJobEvidence("job-one", digest);
  expect(evidence[0].current).toBe(false);
  store.rows.set("siteTaskBriefs/job-one", { ...brief, summary: "Move another object" });
  expect((await loadManagedJobEvidence("job-one", scientificBriefDigest(store.rows.get("siteTaskBriefs/job-one"))))[0].current).toBe(false);
});

it("keeps the Pipeline's choice on the job's run, joins registry teams by recorded name and shows it with every outcome", async () => {
  store.teams = [{ id: "jacobi", name: "Jacobi Robotics" }, { id: "oem", name: "FANUC" }, { id: "substring", name: "Jacobi" }];
  const url = await endpoint(), { publication } = screeningFixture();
  const finished = finishedScreening(publication);
  const selection = selectionFixture(finished);
  const path = `/api/internal/pipeline/beta-policy-screening-runs/${finished.campaign_id}/candidate-selection`;
  expect((await send(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(selection) }, path)).status).toBe(401);
  // A choice needs the accepted result it restates.
  expect((await send(url, signed(selection), path)).status).toBe(409);
  expect((await send(url, signed(finished))).status).toBe(201);
  const otherPlan = await send(url, signed(selectionFixture(sealScreening({ ...finished, plan_digest: screeningSha("9") }))), path);
  expect([otherPlan.status, (await otherPlan.json()).code]).toEqual([409, "screening_selection_publication_mismatch"]);
  expect((await send(url, signed(selection), `/api/internal/pipeline/beta-policy-screening-runs/another/candidate-selection`)).status).toBe(400);
  const created = await send(url, signed(selection), path);
  expect(created.status).toBe(201);
  expect(await created.json()).toEqual({ status: "created", run_id: finished.campaign_id, publication_revision: 2,
    selection_digest: selection.selection_digest });
  expect((await (await send(url, signed(selection), path)).json()).status).toBe("replayed");
  const { selection_digest: _digest, ...body } = selection;
  const rewritten = await send(url, signed(sealSelection({ ...body, chosen: { ...body.chosen!, related_teams: [] } })), path);
  expect([rewritten.status, (await rewritten.json()).code]).toEqual([409, "screening_selection_conflict"]);
  const run = store.rows.get(`taskEvaluationPolicyRuns/${finished.campaign_id}`);
  expect(run.candidate_selection.record).toEqual(selection);
  expect(run.candidate_selection.registry_teams).toEqual([{ id: "jacobi", name: "Jacobi Robotics" }]);
  expect(run.publication_revision).toBe(2);
  const briefDigest = scientificBriefDigest(store.rows.get("siteTaskBriefs/job-one"));
  let [evidence] = await loadManagedJobEvidence("job-one", briefDigest);
  expect(evidence.current).toBe(true);
  expect(evidence.screening?.selection?.chosen).toMatchObject({ candidateId: "candidate-0",
    deploymentCompanies: ["Jacobi Robotics", "Delta Technology"], registryTeams: [{ id: "jacobi", name: "Jacobi Robotics" }] });
  expect(evidence.screening?.selection?.candidates).toHaveLength(36);
  expect(evidence.screening?.candidates[2].state).toBe("infeasible");
  // A later budget-only revision keeps the stored choice; its re-derived record replaces it.
  const budget = sealScreening({ ...finished, revision: 3, budget: { ...finished.budget, reserved_usd: "1", committed_upper_bound_usd: "1" } });
  expect((await send(url, signed(budget))).status).toBe(200);
  [evidence] = await loadManagedJobEvidence("job-one", briefDigest);
  expect(evidence.screening?.selection?.selectionDigest).toBe(selection.selection_digest);
  expect((await send(url, signed(selection), path)).status).toBe(409);
  const next = selectionFixture(budget);
  expect((await (await send(url, signed(next), path)).json()).status).toBe("updated");
  expect(store.rows.get(`taskEvaluationPolicyRuns/${finished.campaign_id}`).candidate_selection.record).toEqual(next);
});

async function send(socketPath: string, options: any, path = "/api/internal/pipeline/beta-policy-screening-runs") {
  return new Promise<{status: number; json: () => Promise<any>}>((resolve, reject) => {
    const request = httpRequest({ socketPath, path, method: options.method, headers: options.headers }, response => {
      let body = ""; response.setEncoding("utf8"); response.on("data", chunk => { body += chunk; });
      response.on("end", () => resolve({ status: response.statusCode!, json: async () => JSON.parse(body) }));
    });
    request.on("error", reject); request.end(options.body);
  });
}
