// @vitest-environment node
import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";

import pythonReview from "./fixtures/native-g1-private-review.v1.json";

const state = vi.hoisted(() => ({
  records: new Map<string, Record<string, unknown>>(),
  probe: vi.fn(async () => "admitted" as const),
  stream: vi.fn(async ({ res }: { res: express.Response }) => { res.status(200).send("video bytes"); }),
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  dbAdmin: { collection: () => ({
    doc: (id: string) => ({
      get: async () => ({ exists: state.records.has(id), data: () => state.records.get(id) }),
      create: async (value: Record<string, unknown>) => {
        if (state.records.has(id)) throw new Error("exists");
        state.records.set(id, structuredClone(value));
      },
    }),
    where: (_field: string, _op: string, uid: string) => ({ limit: () => ({ get: async () => ({
      docs: [...state.records.entries()].filter(([, record]) => record.owner_user_id === uid)
        .map(([id, record]) => ({ id, data: () => record })),
    }) }) }),
  }) },
}));
vi.mock("../utils/access-control", () => ({
  resolveAccessContext: async (res: express.Response) => ({
    uid: res.locals.actor || null, isOps: false,
  }),
}));
vi.mock("../utils/taskEvaluationResultArtifactProxy", () => ({
  probeTaskEvaluationResultArtifact: state.probe,
  streamTaskEvaluationResultArtifact: state.stream,
}));
vi.mock("../utils/pipelineSyncSecurity", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/pipelineSyncSecurity")>()),
  createPipelineSyncRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import reviewRouter, { nativeG1PrivateReviewDownloadsRouter, nativeG1PrivateReviewIngestRouter } from "../routes/native-g1-private-reviews";
import { buildPipelineSyncSignature } from "../utils/pipelineSyncSecurity";

let server: Server | null = null;
let originalToken: string | undefined;
let originalTicket: string | undefined;
afterEach(async () => {
  await new Promise<void>((resolve) => server?.close(() => resolve()) || resolve());
  server = null;
  state.records.clear();
  state.probe.mockClear();
  state.stream.mockClear();
  if (originalToken === undefined) delete process.env.PIPELINE_SYNC_TOKEN;
  else process.env.PIPELINE_SYNC_TOKEN = originalToken;
  if (originalTicket === undefined) delete process.env.TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET;
  else process.env.TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET = originalTicket;
});

async function start() {
  originalToken = process.env.PIPELINE_SYNC_TOKEN;
  originalTicket = process.env.TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET;
  process.env.PIPELINE_SYNC_TOKEN = "test-pipeline-secret";
  process.env.TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET = "test-ticket-secret";
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { res.locals.actor = req.header("x-test-actor") || null; next(); });
  app.use("/api/internal/pipeline", nativeG1PrivateReviewIngestRouter);
  app.use("/api/native-g1-reviews", reviewRouter);
  app.use("/api/native-g1-review-downloads", nativeG1PrivateReviewDownloadsRouter);
  server = createServer(app);
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("port unavailable");
  return `http://127.0.0.1:${address.port}`;
}

describe("native G1 private review route", () => {
  it("requires signed ingestion, binds an owner, and issues only allowlisted media tickets", async () => {
    const base = await start();
    const runId = "g1-841757-dev";
    const body = JSON.stringify({ schema_version: "native_g1_private_review_ingest.v1", run_id: runId,
      owner_user_id: "nijel", organization_id: "blueprint", review: pythonReview });
    const timestamp = new Date().toISOString();
    const endpoint = `${base}/api/internal/pipeline/native-g1-reviews`;
    expect((await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body })).status).toBe(401);
    const ingested = await fetch(endpoint, { method: "POST", body, headers: {
      "content-type": "application/json", "x-blueprint-pipeline-timestamp": timestamp,
      "x-blueprint-pipeline-signature": buildPipelineSyncSignature({
        secret: "test-pipeline-secret", timestamp, body,
      }),
    } });
    expect(ingested.status).toBe(201);
    expect(state.probe).toHaveBeenCalledTimes(12);
    expect((await fetch(`${base}/api/native-g1-reviews/${runId}`, { headers: { "x-test-actor": "another-user" } })).status).toBe(404);
    const ownerResult = await fetch(`${base}/api/native-g1-reviews/${runId}`, { headers: { "x-test-actor": "nijel" } });
    expect(ownerResult.status).toBe(200);
    const review = await ownerResult.json() as { artifacts: Array<{ artifact_id: string }> };
    expect(review.artifacts).toHaveLength(12);
    const artifactId = review.artifacts[1].artifact_id;
    expect((await fetch(`${base}/api/native-g1-reviews/${runId}/artifacts/unknown/ticket`,
      { method: "POST", headers: { "x-test-actor": "nijel" } })).status).toBe(404);
    const ticketResponse = await fetch(`${base}/api/native-g1-reviews/${runId}/artifacts/${artifactId}/ticket`,
      { method: "POST", headers: { "x-test-actor": "nijel" } });
    expect(ticketResponse.status).toBe(201);
    const ticket = await ticketResponse.json() as { download_url: string };
    expect((await fetch(base + ticket.download_url)).status).toBe(200);
    expect(state.stream).toHaveBeenCalledTimes(1);
  });
});
