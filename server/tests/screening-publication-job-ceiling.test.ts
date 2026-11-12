// @vitest-environment node
// Owner decision 2026-11-11: a result is never refused for its budget figures; the money stop is the reservation path.
import { createServer, request as httpRequest, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import express from "express";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { buildPipelineSyncSignature } from "../utils/pipelineSyncSecurity";
import { outcomePublication, screeningFixture, sealScreening } from "./fixtures/beta-policy-screening";
import { assertWithinWebsiteJobCeiling, transactionJobLedgerReader } from "../utils/websiteJobCeiling";

const store = vi.hoisted(() => ({ rows: new Map<string, any>(), quarantined: [] as Array<{ issue: string }> }));
vi.mock("../utils/pipelineSyncSecurity", async importOriginal => ({
  ...await importOriginal<typeof import("../utils/pipelineSyncSecurity")>(),
  createPipelineSyncRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../utils/robotTeamRegistry", () => ({ listMatchableRobotTeams: async () => [] }));
// The quarantine store is exercised in its own test; here it records what it was asked to keep.
vi.mock("../utils/pipelinePayloadQuarantine", async importOriginal => {
  const original = await importOriginal<typeof import("../utils/pipelinePayloadQuarantine")>();
  return { ...original, quarantineRejectedPayload: async (args: { body: unknown; digestField: string; schema: any }) => {
    if (!original.sealedPayloadDigest(args.body, args.digestField)) return null;
    const parsed = args.schema.safeParse(args.body);
    if (parsed.success) return null;
    store.quarantined.push({ issue: String(parsed.error.issues[0]?.message) });
    return { payload_digest: (args.body as any)[args.digestField], first_seen: true };
  } };
});
vi.mock("../../client/src/lib/firebaseAdmin", () => {
  const reference = (name: string, id: string): any => ({ id, path: `${name}/${id}`, get: async () => snapshot(reference(name, id)) });
  const snapshot = (ref: any) => ({ id: ref.id, ref, exists: store.rows.has(ref.path), data: () => structuredClone(store.rows.get(ref.path)) });
  return { dbAdmin: { collection: (name: string) => ({ doc: (id: string) => reference(name, id),
    where: (key: string, _operator: string, value: unknown) => {
      const query = (limit = 20): any => ({ orderBy: () => query(limit), limit: (count: number) => query(count),
        get: async () => ({ docs: [...store.rows.entries()].filter(([path, data]) => path.startsWith(`${name}/`)
          && key.split(".").reduce((current, part) => current?.[part], data) === value).slice(0, limit)
          .map(([path]) => snapshot(reference(name, path.slice(name.length + 1)))) }) });
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
  store.quarantined.length = 0;
  const { job, brief, intake, launch } = screeningFixture();
  store.rows.set(launch.path, launch.record);
  store.rows.set("inboundRequests/job-one", job);
  store.rows.set("siteTaskBriefs/job-one", brief);
  store.rows.set("taskEvaluationSceneIntakes/intake-one", intake);
  vi.stubEnv("PIPELINE_SYNC_TOKEN", "test-only-screening-signature");
  vi.stubEnv("PIPELINE_SYNC_ALLOW_LEGACY_BEARER", "false");
  vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_GRANT_POLICY_JSON", "");
  vi.stubEnv("BLUEPRINT_WEBSITE_ATLAS_AUTHORIZATIONS_JSON", "");
});
afterEach(async () => { vi.unstubAllEnvs(); if (server) await new Promise<void>(resolve => server!.close(() => resolve())); server = undefined; });

async function endpoint() {
  const app = express();
  app.use(express.json({ verify(req, _res, buffer) { (req as any).rawBody = buffer.toString(); } }));
  app.use("/api/internal/pipeline", (await import("../routes/internal-beta-policy-screening")).default);
  server = createServer(app);
  const socketPath = join(tmpdir(), `blueprint-screening-ceiling-${randomUUID()}.sock`);
  await new Promise<void>((resolve, reject) => { server!.once("error", reject); server!.listen(socketPath, resolve); });
  return socketPath;
}
function post(socketPath: string, body: unknown) {
  const text = JSON.stringify(body), timestamp = new Date().toISOString();
  const headers = { "Content-Type": "application/json", "X-Blueprint-Pipeline-Timestamp": timestamp,
    "X-Blueprint-Pipeline-Signature": buildPipelineSyncSignature({ secret: "test-only-screening-signature", timestamp, body: text }) };
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const request = httpRequest({ socketPath, path: "/api/internal/pipeline/beta-policy-screening-runs", method: "POST", headers }, response => {
      let data = ""; response.setEncoding("utf8"); response.on("data", chunk => { data += chunk; });
      response.on("end", () => resolve({ status: response.statusCode!, body: JSON.parse(data) }));
    });
    request.on("error", reject); request.end(text);
  });
}
const withBudget = (limit: string, committed = "0") => sealScreening({ ...screeningFixture().publication,
  budget: { currency: "USD", limit_usd: limit, committed_upper_bound_usd: committed, spent_upper_bound_usd: committed, reserved_usd: "0" } });
const runs = () => [...store.rows.keys()].filter(key => key.startsWith("taskEvaluationPolicyRuns/"));
const grantedAt = (figure: number) => {
  const job = store.rows.get("inboundRequests/job-one");
  const captureId = screeningFixture().publication.source.capture_id;
  job.website_atlas_grants = { ...(job.website_atlas_grants ?? {}), [captureId]: { maximum_cost_usd: figure } };
};

const alertRows = () => [...store.rows.keys()].filter(key => key.startsWith("opsWebsiteJobOverBudgetAlerts/"));
const jobSpend = async () => {
  const { dbAdmin } = await import("../../client/src/lib/firebaseAdmin");
  return assertWithinWebsiteJobCeiling({ record: store.rows.get("inboundRequests/job-one"), requestId: "job-one",
    captureId: screeningFixture().publication.source.capture_id, additionalCostUsd: 0.01,
    reader: transactionJobLedgerReader(dbAdmin as any, { get: (ref: any) => ref.get() }, "job-one") });
};

it("accepts what the Pipeline sends after its release, a limit equal to the job's $100 ceiling, with no alert", async () => {
  const url = await endpoint();
  grantedAt(100);
  expect((await post(url, withBudget("100", "51"))).status).toBe(201);
  expect(runs()).toHaveLength(1);
  expect(alertRows()).toEqual([]);
});

it("keeps today's $30 publications exactly as before on a job granted earlier at $25", async () => {
  const url = await endpoint();
  grantedAt(25);
  expect((await post(url, withBudget("30", "26.63"))).status).toBe(201);
  expect(alertRows()).toEqual([]);
  expect(store.quarantined).toHaveLength(0);
});

it("never refuses a result for its budget figures: one above the job's safety limit is kept, counted in full and reported once", async () => {
  const url = await endpoint();
  grantedAt(25);
  // Safety limit: max($25 stored ceiling, $100 owner default with no policy) = $100.
  expect((await post(url, withBudget("150", "120"))).status).toBe(201);
  expect(runs()).toHaveLength(1);
  expect(store.quarantined).toHaveLength(0);
  expect(alertRows()).toEqual(["opsWebsiteJobOverBudgetAlerts/job-one-screening-over-safety-limit"]);
  expect(store.rows.get(alertRows()[0]).screening_over_safety_limit).toMatchObject({ safety_limit_usd: 100, job_ceiling_usd: 25,
    limit_usd: "150", committed_upper_bound_usd: "120", campaign_id: "campaign-one" });
  // A later revision, and a replay, add no second alert.
  expect((await post(url, sealScreening({ ...withBudget("150", "130"), revision: 2 }))).status).toBe(200);
  expect(alertRows()).toHaveLength(1);
  // Counted in full ($130), so the job admits no more spend.
  const refusal = await jobSpend().catch(error => error);
  expect(refusal).toBeInstanceOf(Error);
  expect(refusal.message).toBe("website_scene_preparation_budget_exhausted");
});

it("refuses only past the parser's absolute $1000 cap, the largest job ceiling there can be", async () => {
  const url = await endpoint();
  expect((await post(url, withBudget("1000", "999"))).status).toBe(201);
  expect(await post(url, sealScreening({ ...withBudget("1000.000001"), revision: 2 }))).toEqual({ status: 422,
    body: expect.objectContaining({ code: "schema_not_accepted", quarantined: true }) });
  expect(store.quarantined).toEqual([{ issue: "Screening must stay within its limit, at most $1000" }]);
});

it("reports robots held back at the job's limit once per job, so a person can decide whether to raise its limit", async () => {
  const url = await endpoint();
  const held = outcomePublication(screeningFixture().publication, "awaiting_spend_approval");
  expect((await post(url, held)).status).toBe(201);
  expect(alertRows()).toEqual(["opsWebsiteJobOverBudgetAlerts/job-one-screening-job-ceiling"]);
  expect(store.rows.get(alertRows()[0]).screening_job_ceiling).toMatchObject({ candidate_count: held.candidates.length });
  expect((await post(url, held)).status).toBe(200);
  expect(alertRows()).toHaveLength(1);
});
