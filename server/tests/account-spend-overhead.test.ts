// @vitest-environment node
/**
 * The WebApp's own paid agent runs as named overhead (owner decision 2026-11-20).
 *
 * What this pins: a finished run of the first look or brief reading is recorded once, under its run kind and the bill
 * its provider lands on, and never on a job's ledger; a run with no recorded cost is counted as such, never as zero;
 * the month is read back per run kind and provider, only over the signed Pipeline transport.
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

const priced = { cost_estimate_usd: 1.2, conservative_spend_usd: 1.2, spend_accounting_status: "complete" as const };

describe("named overhead for the WebApp's own agent runs", () => {
  it("records each paid run once under its kind and its bill, outside every job ledger", async () => {
    await overhead.recordAgentRunOverhead(sharedFakeFirestore, { runId: "run-1", taskKind: "site_task_brief_reading",
      provider: "openai_responses", model: "gpt-6-luna", telemetry: priced, nowMs: NOW, requestId: "capture-job1" });
    await overhead.recordAgentRunOverhead(sharedFakeFirestore, { runId: "run-1", taskKind: "site_task_brief_reading",
      provider: "openai_responses", model: "gpt-6-luna", telemetry: priced, nowMs: NOW, requestId: "capture-job1" });
    await overhead.recordAgentRunOverhead(sharedFakeFirestore, { runId: "run-2", taskKind: "capture_coverage",
      provider: "gemini_video", model: "gemini-3.8-flash", telemetry: { cost_estimate_usd: null,
        conservative_spend_usd: 0.004, spend_accounting_status: "reserved_unknown" }, nowMs: NOW });
    // A local harness bills nothing here.
    await overhead.recordAgentRunOverhead(sharedFakeFirestore, { runId: "run-3", taskKind: "site_task_brief_reading",
      provider: "codex_local", model: "codex", telemetry: priced, nowMs: NOW });
    const docs = [...state.docs.keys()].sort();
    expect(docs).toEqual(["accountSpendOverhead/run-1", "accountSpendOverhead/run-2"]);
    expect(state.docs.get("accountSpendOverhead/run-1")).toMatchObject({ month: "2026-11",
      name: "webapp.site_task_brief_reading", provider: "openai", cost_usd: 1.2, request_id: "capture-job1" });
    expect(state.docs.get("accountSpendOverhead/run-2")).toMatchObject({ provider: "gemini", cost_usd: 0.004 });
    // Nothing touched a job: no inbound request, no preparation reservation.
    expect(docs.some(key => key.startsWith("inboundRequests/"))).toBe(false);
  });

  it("counts a run with no recorded cost as such, never as zero, and never fails the run", async () => {
    await overhead.recordAgentRunOverhead(sharedFakeFirestore, { runId: "run-4", taskKind: "site_video_evidence",
      provider: "openai_responses", model: "gpt-6.1-sol", telemetry: { cost_estimate_usd: null,
        conservative_spend_usd: null, spend_accounting_status: "unresolved" }, nowMs: NOW });
    const month = await overhead.accountSpendOverheadMonth(sharedFakeFirestore, "2026-11", NOW);
    expect(month.rows).toEqual([{ name: "webapp.site_video_evidence", provider: "openai", runs: 1, unpriced_runs: 1, usd: 0 }]);
    const broken = { collection: () => ({ doc: () => ({ set: async () => { throw new Error("store down"); } }) }) };
    await expect(overhead.recordAgentRunOverhead(broken, { runId: "run-5", taskKind: "site_task_brief_reading",
      provider: "openai_responses", model: "gpt-6-luna", telemetry: priced, nowMs: NOW })).resolves.toBeUndefined();
  });

  it("reads one month per kind and provider over the signed Pipeline transport only", async () => {
    for (const [id, kind, provider, cost, at] of [["a", "site_task_brief_reading", "openai_responses", 0.25, NOW],
      ["b", "site_task_brief_reading", "openai_responses", 0.5, NOW], ["c", "robot_fit_ranking", "anthropic_agent_sdk", 2, NOW],
      ["d", "robot_fit_ranking", "anthropic_agent_sdk", 9, Date.parse("2026-10-31T23:59:00Z")]] as const)
      await overhead.recordAgentRunOverhead(sharedFakeFirestore, { runId: id, taskKind: kind, provider, model: "m",
        telemetry: { cost_estimate_usd: cost, conservative_spend_usd: cost, spend_accounting_status: "complete" }, nowMs: at });
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
