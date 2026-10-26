// @vitest-environment node
import { createServer, request as httpRequest, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import express from "express";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { buildPipelineSyncSignature } from "../utils/pipelineSyncSecurity";
import { screeningFixture, screeningSha, sealScreening } from "./fixtures/beta-policy-screening";
import { crossRuntimeArtifactDigest } from "../utils/crossRuntimeCanonical";
import { publicationFromResultRecord } from "../utils/taskEvaluationRunPublicationStorage";
import { scientificBriefDigest } from "../utils/jobEvidenceContract";
import { loadManagedJobEvidence } from "../utils/jobManagedEvaluation";

const store = vi.hoisted(() => ({ rows: new Map<string, any>() }));
vi.mock("../utils/pipelineSyncSecurity", async importOriginal => ({
  ...await importOriginal<typeof import("../utils/pipelineSyncSecurity")>(),
  createPipelineSyncRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../../client/src/lib/firebaseAdmin", () => {
  const reference = (name: string, id: string): any => ({ id, path: `${name}/${id}`, get: async () => snapshot(reference(name, id)) });
  const snapshot = (ref: any) => ({ id: ref.id, ref, exists: store.rows.has(ref.path), data: () => structuredClone(store.rows.get(ref.path)) });
  return { dbAdmin: { collection: (name: string) => ({ doc: (id: string) => reference(name, id),
    where: (key: string, _operator: string, value: unknown) => { const query = { orderBy: () => query, limit: (limit: number) => ({ get: async () => ({ docs: [...store.rows.entries()]
      .filter(([path, data]) => path.startsWith(`${name}/`) && key.split(".").reduce((current, part) => current?.[part], data) === value)
      .slice(0, limit).map(([path]) => snapshot(reference(name, path.slice(name.length + 1)))) }) }) }; return query; } }),
    runTransaction: async (fn: any) => {
      const writes: Array<[string, any]> = [];
      const result = await fn({ get: async (ref: any) => snapshot(ref), set: (ref: any, value: any) => writes.push([ref.path, value]) });
      writes.forEach(([path, value]) => store.rows.set(path, structuredClone(value)));
      return result;
    } } };
});

let server: Server | undefined;
beforeEach(() => {
  store.rows.clear();
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
  const next = sealScreening({ ...publication, revision: 2, status: "running",
    candidates: publication.candidates.map((row, index) => index ? row : { ...row, status: "running" }) });
  expect((await send(url, signed(next))).status).toBe(200);
  expect(store.rows.get("taskEvaluationPolicyRuns/campaign-one").screening_execution_observed).toBe(true);
  expect((await (await send(url, signed(publication))).json()).status).toBe("superseded");
  expect(store.rows.get("taskEvaluationPolicyRuns/campaign-one").publication_revision).toBe(2);
  const briefDigest = scientificBriefDigest(store.rows.get("siteTaskBriefs/job-one"));
  expect((await loadManagedJobEvidence("job-one", briefDigest))[0].current).toBe(true);
  const status = store.rows.get("taskEvaluationSceneIntakes/intake-one").pipeline_status;
  status.result_reference.digest = screeningSha("9");
  status.status_digest = crossRuntimeArtifactDigest(status, "status_digest");
  expect((await loadManagedJobEvidence("job-one", briefDigest))[0].current).toBe(false);
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

async function send(socketPath: string, options: any) {
  return new Promise<{status: number; json: () => Promise<any>}>((resolve, reject) => {
    const request = httpRequest({ socketPath, path: "/api/internal/pipeline/beta-policy-screening-runs", method: options.method, headers: options.headers }, response => {
      let body = ""; response.setEncoding("utf8"); response.on("data", chunk => { body += chunk; });
      response.on("end", () => resolve({ status: response.statusCode!, json: async () => JSON.parse(body) }));
    });
    request.on("error", reject); request.end(options.body);
  });
}
