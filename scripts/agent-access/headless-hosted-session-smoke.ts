#!/usr/bin/env tsx
import path from "node:path";
import { pathToFileURL } from "node:url";
import { BlueprintAgentApiClient, type FetchLike } from "./agent-api-client";

type SmokeStep = {
  name: string;
  ok: boolean;
  status?: number;
  detail?: string;
};

export type HeadlessSmokeResult = {
  mode: "mock" | "public-demo";
  ok: boolean;
  sessionId: string | null;
  steps: SmokeStep[];
};

type SmokeOptions = {
  mode?: "mock" | "public-demo";
  stdout?: (line: string) => void;
  fetchImpl?: FetchLike;
};

const mockSessionId = "mock-session-1";

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function createMockFetch(): FetchLike {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const method = String(init?.method || "GET").toUpperCase();
    const path = url.pathname;

    if (method === "GET" && path === "/api/site-worlds") {
      return json({
        items: [{ id: "siteworld-f5fd54898cfb", siteName: "Public demo site world" }],
        count: 1,
      });
    }
    if (method === "GET" && path === "/api/site-worlds/sessions/launch-readiness") {
      return json({
        entitled: true,
        status: "runtime_live_ready",
        launchable: true,
        blockers: [],
        runtime_only: { launchable: true, blockers: [] },
      });
    }
    if (method === "POST" && path === "/api/site-worlds/sessions") {
      return json({ sessionId: mockSessionId, status: "ready", workspaceUrl: `/world-models/siteworld-f5fd54898cfb/workspace?sessionId=${mockSessionId}` }, 201);
    }
    if (method === "POST" && path === `/api/site-worlds/sessions/${mockSessionId}/reset`) {
      return json({ episode: { episodeId: "episode-1", status: "running", stepIndex: 0 } });
    }
    if (method === "POST" && path === `/api/site-worlds/sessions/${mockSessionId}/step`) {
      return json({ episode: { episodeId: "episode-1", status: "running", stepIndex: 1 } });
    }
    if (method === "POST" && path === `/api/site-worlds/sessions/${mockSessionId}/run-batch`) {
      return json({ summary: { batchRunId: "batch-1", status: "completed", numEpisodes: 1, numSuccess: 1 } });
    }
    if (method === "POST" && path === `/api/site-worlds/sessions/${mockSessionId}/export`) {
      return json({
        artifact_uris: { export_manifest: "mock://exports/session-export.json" },
        dataset_artifacts: { label: "mock export artifact" },
      });
    }

    return json({ error: `Unhandled mock route ${method} ${path}` }, 404);
  }) as FetchLike;
}

async function runStep<T>(
  steps: SmokeStep[],
  name: string,
  run: () => Promise<T>,
) {
  try {
    const payload = await run();
    steps.push({ name, ok: true });
    return payload;
  } catch (error) {
    steps.push({
      name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function runHeadlessAgentSmoke(options: SmokeOptions = {}): Promise<HeadlessSmokeResult> {
  const mode = options.mode || "mock";
  const stdout = options.stdout || ((line: string) => process.stdout.write(`${line}\n`));
  const steps: SmokeStep[] = [];
  const client = new BlueprintAgentApiClient({
    baseUrl: mode === "mock" ? "https://mock.tryblueprint.local" : undefined,
    fetchImpl: options.fetchImpl || (mode === "mock" ? createMockFetch() : undefined),
  });

  await runStep(steps, "catalog", () => client.listCatalog(1));
  await runStep(steps, "readiness", () => client.readiness("siteworld-f5fd54898cfb"));
  const created = await runStep(steps, "session.create", () =>
    client.createSession({
      siteWorldId: "siteworld-f5fd54898cfb",
      sessionMode: "runtime_only",
      robotProfileId: "other_sample",
      taskId: "sw-chi-01-task-1",
      scenarioId: "sw-chi-01-scenario-1",
      startStateId: "sw-chi-01-start-1",
      requestedOutputs: ["observation_frames", "action_trace", "export_bundle"],
    }),
  ) as { sessionId?: string };
  const sessionId = String(created.sessionId || "");
  if (!sessionId) {
    throw new Error("Smoke session create did not return sessionId.");
  }
  await runStep(steps, "session.reset", () =>
    client.resetSession(sessionId, {
      taskId: "sw-chi-01-task-1",
      scenarioId: "sw-chi-01-scenario-1",
      startStateId: "sw-chi-01-start-1",
      seed: 17,
    }),
  );
  await runStep(steps, "session.step", () => client.stepSession(sessionId, { autoPolicy: true }));
  await runStep(steps, "session.runBatch", () =>
    client.runBatch(sessionId, {
      numEpisodes: 1,
      taskId: "sw-chi-01-task-1",
      scenarioId: "sw-chi-01-scenario-1",
      startStateId: "sw-chi-01-start-1",
      seed: 17,
      maxSteps: 2,
    }),
  );
  await runStep(steps, "session.export", () => client.exportSession(sessionId));

  const result = {
    mode,
    ok: steps.every((step) => step.ok),
    sessionId,
    steps,
  };
  stdout(JSON.stringify(result, null, 2));
  return result;
}

function parseMode(argv: string[]): "mock" | "public-demo" {
  const index = argv.indexOf("--mode");
  const value = index >= 0 ? argv[index + 1] : "";
  if (value === "public-demo") return "public-demo";
  return "mock";
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  runHeadlessAgentSmoke({ mode: parseMode(process.argv.slice(2)) }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
