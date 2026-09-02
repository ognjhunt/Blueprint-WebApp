// @vitest-environment node
import express from "express";
import { createHmac } from "node:crypto";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseTaskEvaluationLaunchProgress } from "../utils/taskEvaluationLaunchContract";

const PIPELINE_SECRET = "forward-secret";

const state = vi.hoisted(() => ({
  records: new Map<string, Record<string, any>>(),
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => {
  const reference = (collection: string, id: string) => ({
    id,
    key: collection === "taskEvaluationLaunches" ? id : `${collection}:${id}`,
    get: async () => {
      const key = collection === "taskEvaluationLaunches" ? id : `${collection}:${id}`;
      const record = state.records.get(key);
      return { exists: Boolean(record), data: () => record && structuredClone(record) };
    },
  });
  return {
    dbAdmin: {
      collection: (collection: string) => ({
        doc: (id: string) => reference(collection, id),
      }),
      runTransaction: async <T>(callback: (transaction: any) => Promise<T>) => callback({
        get: async (ref: ReturnType<typeof reference>) => ref.get(),
        set: (
          ref: ReturnType<typeof reference>,
          payload: Record<string, unknown>,
          options?: { merge?: boolean },
        ) => {
          state.records.set(ref.key, options?.merge
            ? { ...(state.records.get(ref.key) || {}), ...structuredClone(payload) }
            : structuredClone(payload));
        },
      }),
    },
  };
});

// Only the rate limiter is replaced. The real signature verifier stays in the
// path so these tests pin the inbound canonical string the Pipeline must sign.
vi.mock("../utils/pipelineSyncSecurity", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/pipelineSyncSecurity")>()),
  createPipelineSyncRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const sha = (character: string) => `sha256:${character.repeat(64)}`;

function queuedRecord() {
  return {
    schema_version: "task_evaluation_launch_web_record.v1",
    launch_id: "launch-001",
    run_id: "run-001",
    request_digest: sha("a"),
    state: "queued_in_pipeline",
    provider_mutation_observed: false,
  };
}

function progressPayload(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "task_evaluation_launch_progress.v1",
    launch_id: "launch-001",
    run_id: "run-001",
    request_digest: sha("a"),
    phase: "dependency_closure",
    phase_status: "running",
    observed_at_iso: "2026-08-11T12:00:00.000Z",
    elapsed_seconds: 754.5,
    provider: {
      instance_state: "running",
      instance_age_seconds: 800.25,
      estimated_cost_usd: 0.142,
    },
    ...overrides,
  };
}

async function startInternalServer(): Promise<{ server: Server; url: string }> {
  const { default: router } = await import("../routes/internal-task-evaluation-launches");
  const app = express();
  app.use(express.json());
  app.use(router);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  return { server, url: `http://127.0.0.1:${address.port}` };
}

async function withServer<T>(run: (url: string) => Promise<T>): Promise<T> {
  const { server, url } = await startInternalServer();
  try {
    return await run(url);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function postProgress(url: string, payload: Record<string, unknown>) {
  const body = JSON.stringify(payload);
  const timestamp = new Date().toISOString();
  const signature = createHmac("sha256", PIPELINE_SECRET)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  return fetch(`${url}/task-evaluation-launch-progress`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-blueprint-pipeline-timestamp": timestamp,
      "x-blueprint-pipeline-signature": `sha256=${signature}`,
    },
    body,
  });
}

beforeEach(() => {
  state.records.clear();
  process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN = PIPELINE_SECRET;
});

afterEach(() => {
  delete process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN;
});

describe("internal Task Evaluation launch progress route", () => {
  it("records an in-flight phase without ever writing the terminal state field", async () => {
    state.records.set("launch-001", queuedRecord());
    await withServer(async (url) => {
      const response = await postProgress(url, progressPayload());
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        schema_version: "task_evaluation_launch_progress_web_sync_receipt.v1",
        status: "recorded",
        launch_id: "launch-001",
        phase: "dependency_closure",
      });
    });
    const record = state.records.get("launch-001");
    expect(record?.progress).toMatchObject({
      phase: "dependency_closure",
      phase_status: "running",
      elapsed_seconds: 754.5,
      provider: { instance_state: "running", estimated_cost_usd: 0.142 },
    });
    expect(typeof record?.progress_updated_at_iso).toBe("string");
    // The live view stops polling on a terminal state, so progress must leave
    // it exactly as the launch route left it.
    expect(record?.state).toBe("queued_in_pipeline");
    expect(record?.terminal_receipt).toBeUndefined();
  });

  it("binds an internal policy canary to its authenticated policy-run record", async () => {
    const runId = "scene839873-policy-canary-001";
    const key = `taskEvaluationPolicyRuns:${runId}`;
    state.records.set(key, {
      schema_version: "task_evaluation_policy_run_web_record.v2",
      run_kind: "internal_policy_canary",
      run_id: runId,
      request_digest: sha("b"),
      state: "queued",
      phase: "queued",
    });
    await withServer(async (url) => {
      const response = await postProgress(url, progressPayload({
        launch_id: runId,
        run_id: runId,
        request_digest: sha("b"),
        phase: "intake_webapp_record_binding",
        phase_status: "verified",
      }));
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        status: "recorded",
        launch_id: runId,
        run_id: runId,
        phase: "intake_webapp_record_binding",
      });
    });
    expect(state.records.get(key)).toMatchObject({
      run_kind: "internal_policy_canary",
      state: "queued",
      phase: "queued",
      pipeline_progress: {
        phase: "intake_webapp_record_binding",
        phase_status: "verified",
      },
    });
    expect(state.records.has(runId)).toBe(false);
  });

  it("does not treat another policy-run kind as a canary launch record", async () => {
    const runId = "qualified-policy-run-001";
    state.records.set(`taskEvaluationPolicyRuns:${runId}`, {
      run_kind: "qualified_evaluation",
      run_id: runId,
      request_digest: sha("b"),
    });
    await withServer(async (url) => {
      const response = await postProgress(url, progressPayload({
        launch_id: runId,
        run_id: runId,
        request_digest: sha("b"),
      }));
      expect(response.status).toBe(404);
    });
  });

  it("replaces the prior phase so the control room reads the current one", async () => {
    state.records.set("launch-001", queuedRecord());
    await withServer(async (url) => {
      expect((await postProgress(url, progressPayload())).status).toBe(200);
      const later = await postProgress(url, progressPayload({
        phase: "scene_build",
        elapsed_seconds: 1_204,
        provider: {
          instance_state: "running",
          instance_age_seconds: 1_250,
          estimated_cost_usd: 0.221,
        },
      }));
      expect(later.status).toBe(200);
    });
    expect(state.records.get("launch-001")?.progress).toMatchObject({
      phase: "scene_build",
      elapsed_seconds: 1_204,
    });
    expect(state.records.get("launch-001")?.state).toBe("queued_in_pipeline");
  });

  it("404s for a launch the website never authorized", async () => {
    await withServer(async (url) => {
      const response = await postProgress(url, progressPayload());
      expect(response.status).toBe(404);
    });
    expect(state.records.size).toBe(0);
  });

  it("refuses progress bound to a different request digest or run", async () => {
    state.records.set("launch-001", queuedRecord());
    await withServer(async (url) => {
      const wrongDigest = await postProgress(url, progressPayload({ request_digest: sha("f") }));
      expect(wrongDigest.status).toBe(409);
      const wrongRun = await postProgress(url, progressPayload({ run_id: "run-999" }));
      expect(wrongRun.status).toBe(409);
    });
    expect(state.records.get("launch-001")).toEqual(queuedRecord());
  });

  it("leaves a finished run finished when progress arrives late", async () => {
    const terminalReceipt = { status: "completed", receipt_digest: sha("c") };
    state.records.set("launch-001", {
      ...queuedRecord(),
      state: "completed",
      terminal_receipt: terminalReceipt,
      terminal_receipt_digest: sha("c"),
    });
    await withServer(async (url) => {
      const response = await postProgress(url, progressPayload({ phase: "runtime" }));
      // A no-op, not a conflict: the run really did reach this phase, the
      // receipt simply already settled the outcome.
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ status: "ignored_terminal" });
    });
    const record = state.records.get("launch-001");
    expect(record?.state).toBe("completed");
    expect(record?.terminal_receipt).toEqual(terminalReceipt);
    expect(record?.progress).toBeUndefined();
    expect(record?.progress_updated_at_iso).toBeUndefined();
  });

  it("rejects a progress post that carries its own launch state", async () => {
    state.records.set("launch-001", queuedRecord());
    await withServer(async (url) => {
      const response = await postProgress(url, progressPayload({ state: "completed" }));
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        blockers: ["task_evaluation_launch_progress_schema_invalid"],
      });
    });
    expect(state.records.get("launch-001")).toEqual(queuedRecord());
  });

  it("rejects the outbound signing form on this inbound channel", async () => {
    state.records.set("launch-001", queuedRecord());
    await withServer(async (url) => {
      const body = JSON.stringify(progressPayload());
      const timestamp = new Date().toISOString();
      // The website's outbound signer folds in a client id and nonce. Inbound
      // verification signs `${timestamp}.${body}` only, so this must not pass.
      const signature = createHmac("sha256", PIPELINE_SECRET)
        .update(`${timestamp}.blueprint-webapp.nonce-001.${body}`)
        .digest("hex");
      const response = await fetch(`${url}/task-evaluation-launch-progress`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-blueprint-pipeline-timestamp": timestamp,
          "x-blueprint-pipeline-client-id": "blueprint-webapp",
          "x-blueprint-pipeline-nonce": "nonce-001",
          "x-blueprint-pipeline-signature": `sha256=${signature}`,
        },
        body,
      });
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ code: "invalid_pipeline_sync_signature" });
    });
    expect(state.records.get("launch-001")?.progress).toBeUndefined();
  });
});

describe("Task Evaluation launch progress contract", () => {
  it("accepts a provider whose age and cost are not observable yet", () => {
    const parsed = parseTaskEvaluationLaunchProgress(progressPayload({
      provider: {
        instance_state: "loading",
        instance_age_seconds: null,
        estimated_cost_usd: null,
      },
    }));
    expect(parsed.ok).toBe(true);
  });

  it("accepts a launch reporting no provider instance at all", () => {
    const { provider, ...withoutProvider } = progressPayload();
    expect(provider).toBeDefined();
    expect(parseTaskEvaluationLaunchProgress(withoutProvider).ok).toBe(true);
  });

  it("keeps the record bounded to the known observational keys", () => {
    expect(parseTaskEvaluationLaunchProgress(progressPayload({
      terminal_evidence: { status: "passed" },
    }))).toEqual({
      ok: false,
      blockers: ["task_evaluation_launch_progress_schema_invalid"],
    });
    expect(parseTaskEvaluationLaunchProgress(progressPayload({
      provider: {
        instance_state: "running",
        instance_age_seconds: 10,
        estimated_cost_usd: 0.1,
        api_key: "secret",
      },
    })).ok).toBe(false);
  });

  it("rejects impossible elapsed time and a foreign schema version", () => {
    expect(parseTaskEvaluationLaunchProgress(progressPayload({ elapsed_seconds: -1 })).ok)
      .toBe(false);
    expect(parseTaskEvaluationLaunchProgress(progressPayload({
      schema_version: "task_evaluation_launch_receipt.v1",
    })).ok).toBe(false);
  });

  it("rejects an empty phase label", () => {
    expect(parseTaskEvaluationLaunchProgress(progressPayload({ phase: "   " })).ok).toBe(false);
    expect(parseTaskEvaluationLaunchProgress(progressPayload({ phase_status: "" })).ok).toBe(false);
  });
});
