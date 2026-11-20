// @vitest-environment node
/**
 * The WebApp's own paid agent runs as named overhead (owner decision 2026-11-20).
 *
 * What this pins: the month is read from the runs' own records (`agentRuns`), so no run can be missing from it;
 * each run counts under its run kind and the bill its provider lands on, never on a job's ledger; a finished run with
 * no recorded cost is counted as such, never as zero; a record with incomplete accounting makes the month incomplete;
 * the month is read only over the signed Pipeline transport.
 */
import express from "express";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestore, sharedFakeFirestoreState as state } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore: store } = await import("./helpers/fake-firestore");
  return { dbAdmin: store, default: { firestore: { FieldValue: {} } } };
});

const overhead = await import("../utils/accountSpendOverhead");
const NOW = Date.parse("2026-11-20T16:00:00Z");
let server: Server | undefined, base = "";

beforeAll(async () => {
  vi.stubEnv("PIPELINE_SYNC_TOKEN", "fixture-pipeline-sync-secret");
  const { default: router } = await import("../routes/internal-account-spend-overhead");
  const app = express();
  app.use(express.json({ verify: (req: any, _res, buffer) => { req.rawBody = buffer; } }));
  app.use("/api/internal/pipeline", router);
  server = createServer(app);
  await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});
afterAll(async () => { vi.unstubAllEnvs(); await new Promise(resolve => server?.close(resolve)); });
beforeEach(() => state.docs.clear());

async function signedPost(body: unknown, sign = true) {
  const { buildPipelineSyncSignature } = await import("../utils/pipelineSyncSecurity");
  const raw = JSON.stringify(body), timestamp = new Date().toISOString();
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (sign) {
    headers["X-Blueprint-Pipeline-Timestamp"] = timestamp;
    headers["X-Blueprint-Pipeline-Signature"] = `sha256=${buildPipelineSyncSignature({
      secret: "fixture-pipeline-sync-secret", timestamp, body: raw })}`;
  }
  const response = await fetch(`${base}/api/internal/pipeline/account-spend-overhead`, { method: "POST", headers, body: raw });
  return { status: response.status, body: await response.json() as Record<string, any> };
}

function run(id: string, fields: Record<string, unknown>) {
  state.docs.set(`agentRuns/${id}`, { status: "completed", created_at: new Date(NOW), ...fields });
}
const priced = (usd: number | null, reserved: number | null = usd) =>
  ({ cost_telemetry: { cost_estimate_usd: usd, conservative_spend_usd: reserved, spend_accounting_status: "complete" } });

describe("named overhead for the WebApp's own agent runs", () => {
  it("counts each paid run of the month under its kind and its bill, from the run's own record", async () => {
    run("run-1", { task_kind: "site_task_brief_reading", provider: "openai_responses", metadata: priced(1.2) });
    run("run-2", { task_kind: "capture_coverage", provider: "gemini_video", metadata: priced(null, 0.004) });
    // A local harness bills nothing here.
    run("run-3", { task_kind: "site_task_brief_reading", provider: "codex_local", metadata: priced(5) });
    const month = await overhead.accountSpendOverheadMonth(sharedFakeFirestore, "2026-11", NOW);
    expect(month).toMatchObject({ complete: true, unreadable_rows: 0, rows: [
      { name: "webapp.capture_coverage", provider: "gemini", runs: 1, unpriced_runs: 0, usd: 0.004 },
      { name: "webapp.site_task_brief_reading", provider: "openai", runs: 1, unpriced_runs: 0, usd: 1.2 }] });
    // Reading writes nothing: no overhead copy, no job ledger.
    expect([...state.docs.keys()].every(key => key.startsWith("agentRuns/"))).toBe(true);
  });

  it("counts a finished run with no recorded cost as such, never as zero; a run in flight waits until it finishes", async () => {
    run("run-4", { task_kind: "site_video_evidence", provider: "openai_responses", status: "failed" });
    run("run-5", { task_kind: "site_video_evidence", provider: "openai_responses", status: "running" });
    const month = await overhead.accountSpendOverheadMonth(sharedFakeFirestore, "2026-11", NOW);
    expect(month.rows).toEqual([{ name: "webapp.site_video_evidence", provider: "openai", runs: 1, unpriced_runs: 1, usd: 0 }]);
    expect(month.complete).toBe(true);
  });

  it("says the month is incomplete when a run's record cannot be read", async () => {
    run("run-6", { task_kind: "site_task_brief_reading", provider: "openai_responses", metadata: priced(0.3),
      agent_accounting_incomplete: true });
    const month = await overhead.accountSpendOverheadMonth(sharedFakeFirestore, "2026-11", NOW);
    expect(month).toMatchObject({ rows: [], complete: false, unreadable_rows: 1 });
  });

  it("reads one month per kind and provider over the signed Pipeline transport only", async () => {
    for (const [id, kind, provider, cost, at] of [["a", "site_task_brief_reading", "openai_responses", 0.25, NOW],
      ["b", "site_task_brief_reading", "openai_responses", 0.5, NOW], ["c", "robot_fit_ranking", "anthropic_agent_sdk", 2, NOW],
      ["d", "robot_fit_ranking", "anthropic_agent_sdk", 9, Date.parse("2026-10-31T23:59:00Z")],
      ["e", "robot_fit_ranking", "anthropic_agent_sdk", 7, Date.parse("2026-12-01T00:00:00Z")]] as const)
      run(id, { task_kind: kind, provider, metadata: priced(cost), created_at: new Date(at) });
    expect((await signedPost({ month: "2026-11" }, false)).status).toBe(401);
    expect((await signedPost({ month: "November" })).status).toBe(400);
    const answer = await signedPost({ month: "2026-11" });
    expect(answer.status).toBe(200);
    expect(answer.body).toMatchObject({ schema_version: "blueprint.account_spend_overhead.v1", month: "2026-11",
      complete: true, rows: [
        { name: "webapp.robot_fit_ranking", provider: "anthropic", runs: 1, unpriced_runs: 0, usd: 2 },
        { name: "webapp.site_task_brief_reading", provider: "openai", runs: 2, unpriced_runs: 0, usd: 0.75 }] });
  });
});
