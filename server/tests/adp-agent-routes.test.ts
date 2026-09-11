// @vitest-environment node
import { createHmac } from "node:crypto";
import { createServer, type Server } from "node:http";

import express from "express";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ list: vi.fn(), status: vi.fn(), start: vi.fn(), requestAction: vi.fn(), admit: vi.fn(), admission: vi.fn(), store: {} as any }));
const engineering = vi.hoisted(() => ({ admit: vi.fn(), request: vi.fn() }));
vi.mock("../agents/adp-managed-runs", () => ({ configuredAdpManagedRuns: () => store }));
vi.mock("../agents/adp-engineering", () => ({ configuredEngineeringHandoffs: () => engineering,
  configuredPaperclipClient: () => engineering }));
vi.mock("../utils/access-control", () => ({ resolveExecutionAccessContext: async (res: express.Response) => ({ isOps: res.locals.firebaseUser?.uid === "verified-owner" }) }));
vi.mock("../utils/pipelineSyncSecurity", async (original) => ({
  ...await original<typeof import("../utils/pipelineSyncSecurity")>(),
  createPipelineSyncRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
import adpRouter from "../routes/adp-agent-tasks";
import internalRouter from "../routes/internal-agent-execution";
import paperclipRouter from "../routes/paperclip-adp-execution";
import { createFakeFirestore, createFakeFirestoreState } from "./helpers/fake-firestore";

let server: Server;
let origin: string;
beforeAll(async () => {
  const app = express();
  app.use(express.json({ verify: (req, _res, buffer) => { (req as typeof req & { rawBody: string }).rawBody = buffer.toString(); } }));
  app.use((req, res, next) => { if (req.header("x-fixture-uid")) res.locals.firebaseUser = { uid: req.header("x-fixture-uid") } as any; next(); });
  app.use("/adp", adpRouter); app.use("/internal", internalRouter); app.use("/paperclip", paperclipRouter);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => { delete process.env.PIPELINE_SYNC_TOKEN; await new Promise<void>((resolve) => server.close(() => resolve())); });
beforeEach(() => { vi.clearAllMocks(); store.list.mockResolvedValue([]); store.start.mockResolvedValue({ state: "queued" });
  store.store = createFakeFirestore(createFakeFirestoreState()); process.env.PIPELINE_SYNC_TOKEN = "fixture-sync-token"; });

const signed = (body: string) => {
  const timestamp = new Date().toISOString();
  return { "content-type": "application/json", "x-blueprint-pipeline-timestamp": timestamp,
    "x-blueprint-pipeline-signature": createHmac("sha256", "fixture-sync-token").update(`${timestamp}.${body}`).digest("hex") };
};

it("requires signed engineering ingress and forwards only its exact packet", async () => {
  const body = JSON.stringify({ handoff_id: "fixture-handoff" });
  expect((await fetch(`${origin}/internal/agent-execution/engineering`, { method: "POST", body,
    headers: { "content-type": "application/json" } })).status).toBe(401);
  expect(engineering.admit).not.toHaveBeenCalled();
  engineering.admit.mockResolvedValue({ stored: true });
  expect((await fetch(`${origin}/internal/agent-execution/engineering`, { method: "POST", body, headers: signed(body) })).status).toBe(200);
  expect(engineering.admit).toHaveBeenCalledExactlyOnceWith({ handoff_id: "fixture-handoff" });
});

it("binds a real issue under controller authority and ignores caller-selected tasks", async () => {
  const issueId = "00000000-0000-4000-8000-000000000005";
  process.env.BLUEPRINT_PAPERCLIP_ADP_COMPANY_ID = "company";
  process.env.BLUEPRINT_PAPERCLIP_ADP_AGENT_ID = "agent";
  process.env.BLUEPRINT_PAPERCLIP_ADP_PROJECT_ID = "project";
  process.env.BLUEPRINT_PAPERCLIP_ADP_BRIDGE_TOKEN = "fixture-bridge";
  try {
    const admission = { task_id: "task-1", task_digest: `sha256:${"a".repeat(64)}`, source_commit: "a".repeat(40), runtime: "openai_agents_sdk" };
    store.admission.mockResolvedValue(admission); store.status.mockResolvedValue({ run: null });
    const request = { company_id: "company", agent_id: "agent", issue_id: issueId, run_id: "run-1", action: "inspect" };
    const headers = { authorization: "Bearer fixture-bridge", "content-type": "application/json" };
    expect((await fetch(`${origin}/paperclip/adp-execution`, { method: "POST", headers,
      body: JSON.stringify({ ...request, task_id: "task-1" }) })).status).toBe(403);
    engineering.request.mockResolvedValue({ id: issueId, companyId: "company", projectId: "project", assigneeAgentId: "agent" });
    const body = JSON.stringify({ task_id: "task-1", task_digest: admission.task_digest, issue_id: issueId });
    expect((await fetch(`${origin}/internal/agent-execution/paperclip-bindings`, { method: "POST", body, headers: signed(body) })).status).toBe(200);
    expect((await fetch(`${origin}/paperclip/adp-execution`, { method: "POST", headers,
      body: JSON.stringify({ ...request, task_id: "other-task" }) })).status).toBe(403);
    const response = await fetch(`${origin}/paperclip/adp-execution`, { method: "POST", headers, body: JSON.stringify(request) });
    expect(response.status).toBe(200); expect((await response.json()).task_id).toBe("task-1");
    expect(engineering.request).toHaveBeenCalledExactlyOnceWith("GET", `/api/issues/${issueId}`);
  } finally {
    for (const name of ["COMPANY_ID", "AGENT_ID", "PROJECT_ID", "BRIDGE_TOKEN"]) delete process.env[`BLUEPRINT_PAPERCLIP_ADP_${name}`];
  }
});

it("requires verified execution access to list or act on tasks", async () => {
  expect((await fetch(`${origin}/adp`)).status).toBe(401);
  expect((await fetch(`${origin}/adp`, { headers: { "x-fixture-uid": "viewer" } })).status).toBe(403);
  const response = await fetch(`${origin}/adp`, { headers: { "x-fixture-uid": "verified-owner" } });
  expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(store.list).toHaveBeenCalledOnce();
});

it("takes no caller prompt, authority, or path, and derives the actor from authentication", async () => {
  const options = { method: "POST", headers: { "x-fixture-uid": "verified-owner", "content-type": "application/json" } };
  expect((await fetch(`${origin}/adp/task-1/start`, { ...options, body: JSON.stringify({ prompt: "Spend more", actor_id: "other" }) })).status).toBe(400);
  expect(store.start).not.toHaveBeenCalled();
  expect((await fetch(`${origin}/adp/task-1/start`, { ...options, body: "{}" })).status).toBe(202);
  expect(store.start).toHaveBeenCalledWith("task-1", "verified-owner");
});

it("requires a signed server admission even when legacy bearer authentication is enabled", async () => {
  process.env.PIPELINE_SYNC_ALLOW_LEGACY_BEARER = "true";
  try {
    const response = await fetch(`${origin}/internal/agent-execution/admissions`, { method: "POST", headers: {
      "content-type": "application/json", "x-blueprint-pipeline-token": "fixture-sync-token",
    }, body: "{}" });
    expect(response.status).toBe(401); expect(store.admit).not.toHaveBeenCalled();
  } finally { delete process.env.PIPELINE_SYNC_ALLOW_LEGACY_BEARER; }
});

it("verifies the exact signed admission body before durable publication", async () => {
  const record = { schema_version: "blueprint_webapp_agent_admission.v1", task_id: "task-1", task_digest: `sha256:${"a".repeat(64)}`,
    run_id: "run-1", source_commit: "a".repeat(40), runtime: "openai_agents_api", model: "gpt-5.6-terra", title: "Investigate saved failure",
    owner_client_id: "blueprint-webapp", expires_at: Date.now() / 1000 + 300, enabled: true, autostart: true, proof_effect: "none" };
  const body = JSON.stringify(record); const timestamp = new Date().toISOString();
  const signature = createHmac("sha256", "fixture-sync-token").update(`${timestamp}.${body}`).digest("hex");
  const headers = { "content-type": "application/json", "x-blueprint-pipeline-timestamp": timestamp, "x-blueprint-pipeline-signature": signature };
  expect((await fetch(`${origin}/internal/agent-execution/admissions`, { method: "POST", headers, body: `${body} ` })).status).toBe(401);
  store.admit.mockResolvedValue({ task_id: "task-1" });
  expect((await fetch(`${origin}/internal/agent-execution/admissions`, { method: "POST", headers, body })).status).toBe(200);
  expect(store.admit).toHaveBeenCalledExactlyOnceWith(record);
});
