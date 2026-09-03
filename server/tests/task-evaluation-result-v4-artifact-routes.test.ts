// @vitest-environment node
import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { canonicalArtifactDigest } from "../utils/taskCandidateContract";
import canaryPublicationFixture from "./fixtures/pipeline-policy-canary-publication.v4.json";

const state = vi.hoisted(() => ({
  records: new Map<string, Record<string, any>>(),
  registry: new Set<string>(),
  uid: "owner-1" as string | null,
  probes: [] as Array<{ runId: string; artifactId: string }>,
  streams: [] as Array<{ runId: string; artifactId: string }>,
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  dbAdmin: {
    collection: (collection: string) => ({
      doc: (id: string) => ({
        get: async () => {
          const record = state.records.get(`${collection}:${id}`);
          return {
            exists: Boolean(record),
            data: () => record && structuredClone(record),
          };
        },
      }),
    }),
  },
}));

vi.mock("../utils/taskEvaluationResultArtifactProxy", () => ({
  probeTaskEvaluationResultArtifact: async (input: {
    runId: string;
    artifactId: string;
  }) => {
    state.probes.push(input);
    return state.registry.has(`${input.runId}:${input.artifactId}`)
      ? "admitted"
      : "not_found";
  },
  streamTaskEvaluationResultArtifact: async (input: {
    runId: string;
    artifactId: string;
    res: express.Response;
  }) => {
    state.streams.push({ runId: input.runId, artifactId: input.artifactId });
    if (!state.registry.has(`${input.runId}:${input.artifactId}`)) {
      input.res.status(404).json({ error: "Result artifact origin rejected the request" });
      return;
    }
    input.res.status(206).send("x");
  },
}));

import resultDownloadsRouter from "../routes/task-evaluation-result-downloads";
import resultsRouter from "../routes/task-evaluation-results";

function publication() {
  const value = structuredClone(canaryPublicationFixture) as Record<string, any>;
  value.result_delivery.delivery_digest = canonicalArtifactDigest(
    value.result_delivery,
    "delivery_digest",
  );
  value.policy_canary_result.result_delivery_digest = value.result_delivery.delivery_digest;
  value.policy_canary_result.projection_digest = canonicalArtifactDigest(
    value.policy_canary_result,
    "projection_digest",
  );
  return value;
}

function record() {
  return {
    record_id: "result-1",
    owner_user_id: "owner-1",
    organization_id: "team-1",
    access_visibility: "organization_members",
    publication: publication(),
  };
}

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => {
    if (state.uid) {
      res.locals.firebaseUser = { uid: state.uid, tenantId: "team-1" };
    }
    next();
  });
  app.use("/api/task-evaluation-results", resultsRouter);
  app.use("/api/task-evaluation-result-downloads", resultDownloadsRouter);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server unavailable");
  return { server, url: `http://127.0.0.1:${address.port}` };
}

async function stopServer(server: Server) {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

async function issueTicket(url: string, artifactId: string) {
  return fetch(
    `${url}/api/task-evaluation-results/result-1/artifacts/${encodeURIComponent(artifactId)}/ticket`,
    { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
  );
}

describe("v4 Task Evaluation Result artifact routes", () => {
  let server: Server;
  let url: string;

  beforeEach(async () => {
    process.env.TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET = "download-secret";
    state.records.clear();
    state.registry.clear();
    state.probes = [];
    state.streams = [];
    state.uid = "owner-1";
    state.records.set("captureTaskEvaluationRuns:result-1", record());
    ({ server, url } = await startServer());
  });

  afterEach(async () => {
    delete process.env.TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET;
    await stopServer(server);
  });

  it("issues tickets for compact v4 artifacts only after per-run registry admission", async () => {
    const artifactIds = [
      "full-json",
      "summary-csv",
      "episode-csv",
      "evidence-manifest",
      "review-video",
      "episode-json",
      "observation-frame",
    ];
    for (const artifactId of artifactIds) {
      state.registry.add(`scene-839873-canary-1:${artifactId}`);
      const response = await issueTicket(url, artifactId);
      expect(response.status, artifactId).toBe(201);
      await expect(response.json()).resolves.toMatchObject({
        schema_version: "task_evaluation_result_download_ticket.v1",
        download_url: expect.stringContaining(
          `/api/task-evaluation-result-downloads/result-1/${artifactId}?`,
        ),
      });
    }
    expect(state.probes).toEqual(artifactIds.map((artifactId) => ({
      runId: "scene-839873-canary-1",
      artifactId,
    })));
  });

  it("checks Website run access before probing the private registry", async () => {
    state.uid = "other-user";
    state.records.get("captureTaskEvaluationRuns:result-1")!.access_visibility = "owner_only";
    state.registry.add("scene-839873-canary-1:observation-frame");

    expect((await issueTicket(url, "observation-frame")).status).toBe(404);
    expect(state.probes).toEqual([]);
  });

  it("serves an unlisted public result and its admitted artifacts without a Firebase identity", async () => {
    state.uid = null;
    const stored = state.records.get("captureTaskEvaluationRuns:result-1")!;
    stored.access_visibility = "unlisted_public";
    state.registry.add("scene-839873-canary-1:observation-frame");

    const detail = await fetch(`${url}/api/task-evaluation-results/result-1`);
    expect(detail.status).toBe(200);
    const body = await detail.json() as Record<string, any>;
    expect(body).toMatchObject({
      organization_id: "unlisted",
      access_visibility: "unlisted_public",
    });
    expect(body.publication.submitted_by).toBeUndefined();
    expect(body.publication.team_namespace).toBeUndefined();
    expect(body.publication.notification_delivery).toBeUndefined();

    expect((await issueTicket(url, "observation-frame")).status).toBe(201);
    expect(state.probes).toEqual([{
      runId: "scene-839873-canary-1",
      artifactId: "observation-frame",
    }]);
  });

  it("does not expose the private organization to a signed-in stranger using an unlisted link", async () => {
    state.uid = "other-user";
    state.records.get("captureTaskEvaluationRuns:result-1")!.access_visibility = "unlisted_public";

    const detail = await fetch(`${url}/api/task-evaluation-results/result-1`);
    expect(detail.status).toBe(200);
    await expect(detail.json()).resolves.toMatchObject({
      organization_id: "unlisted",
      access_visibility: "unlisted_public",
    });
  });

  it("keeps organization and owner-only result records hidden from anonymous callers", async () => {
    state.uid = null;
    expect((await fetch(`${url}/api/task-evaluation-results/result-1`)).status).toBe(404);
    expect((await issueTicket(url, "observation-frame")).status).toBe(404);
    expect(state.probes).toEqual([]);
  });

  it("rejects cross-run, unknown, and malformed artifact IDs without issuing a ticket", async () => {
    state.registry.add("another-run:observation-frame");
    expect((await issueTicket(url, "observation-frame")).status).toBe(404);
    expect(state.probes).toEqual([{
      runId: "scene-839873-canary-1",
      artifactId: "observation-frame",
    }]);

    state.probes = [];
    expect((await issueTicket(url, "missing-frame")).status).toBe(404);
    expect(state.probes).toHaveLength(1);

    state.probes = [];
    expect((await issueTicket(url, "../private-file")).status).toBe(404);
    expect(state.probes).toEqual([]);
  });

  it("accepts a signed v4 download and lets Pipeline reject a stale registry ID", async () => {
    state.registry.add("scene-839873-canary-1:observation-frame");
    const ticketResponse = await issueTicket(url, "observation-frame");
    const ticket = await ticketResponse.json() as { download_url: string };

    const download = await fetch(`${url}${ticket.download_url}`);
    expect(download.status).toBe(206);
    expect(state.streams).toEqual([{
      runId: "scene-839873-canary-1",
      artifactId: "observation-frame",
    }]);

    state.registry.delete("scene-839873-canary-1:observation-frame");
    const stale = await fetch(`${url}${ticket.download_url}`);
    expect(stale.status).toBe(404);

    const tampered = ticket.download_url.replace("observation-frame", "other-frame");
    expect((await fetch(`${url}${tampered}`)).status).toBe(404);
    expect(state.streams).toHaveLength(2);
  });
});
