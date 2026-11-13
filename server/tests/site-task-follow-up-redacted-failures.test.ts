// @vitest-environment node
/**
 * A lane that stores its content redacted keeps a failure as its class, HTTP
 * status and code with a digest of the message, never the message, whether
 * the adapter throws or returns the failure. And it runs at once or not at
 * all: every path that would replay its stored input is refused before
 * anything is stored or sent.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const adapter = vi.hoisted(() => vi.fn());
const logged = vi.hoisted(() => [] as string[]);
const store = vi.hoisted(() => new Map<string, Map<string, any>>());

vi.mock("../agents/adapters/openai-responses", () => ({ runOpenAIResponsesTask: adapter }));
vi.mock("../../client/src/lib/firebaseAdmin", () => {
  const coll = (name: string) => { if (!store.has(name)) store.set(name, new Map()); return store.get(name)!; };
  const doc = (name: string, id: string): any => ({
    id, path: `${name}/${id}`,
    async get() { const d = coll(name).get(id); return { exists: d !== undefined, id, data: () => d }; },
    async set(value: any, options?: { merge?: boolean }) {
      coll(name).set(id, options?.merge ? { ...(coll(name).get(id) || {}), ...value } : value);
    },
  });
  const query = (name: string): any => ({
    where: () => query(name), orderBy: () => query(name), limit: () => query(name), startAfter: () => query(name),
    async get() {
      const docs = [...coll(name).entries()].map(([id, d]) => ({ id, data: () => d, ref: doc(name, id) }));
      return { docs, size: docs.length, empty: !docs.length };
    },
  });
  const db = {
    collection: (name: string) => ({ doc: (id: string) => doc(name, id), ...query(name) }),
    doc: (path: string) => { const [name, id] = path.split("/"); return doc(name, id); },
    async runTransaction(fn: any) { return fn({ get: (ref: any) => ref.get(), set: (ref: any, v: any, o: any) => ref.set(v, o) }); },
    batch: () => ({ set() {}, delete() {}, async commit() {} }),
  };
  return { default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" } } }, dbAdmin: db, storageAdmin: null };
});
vi.mock("../logger", () => {
  const capture = (...args: unknown[]) => { logged.push(JSON.stringify(args)); };
  const logger = { info: capture, warn: capture, error: capture, debug: capture, child: () => logger };
  return { logger, attachRequestMeta: (meta: unknown) => meta, default: logger };
});

const SITE_TEXT = "SITE-TEXT-MARKER-7f3a";
const ANSWER_TEXT = "ANSWER-MARKER-91c2";
const eligible = ["success_target", "item_photos", "item_weight", "item_make_model"];
const taskInput = { taskStatement: `${SITE_TEXT} move totes`, briefSummary: "b", itemLabels: [], eligible };
const quoting = `the request said "${SITE_TEXT}" and the answer was "${ANSWER_TEXT}"`;

beforeEach(() => {
  adapter.mockReset(); logged.length = 0; store.clear();
  vi.stubEnv("OPENAI_API_KEY", "offline-fixture"); vi.stubEnv("OPENAI_BASE_URL", "");
  vi.stubEnv("ANTHROPIC_API_KEY", ""); vi.stubEnv("CODEX_LOCAL_AVAILABLE", "0");
  vi.resetModules();
});
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

function expectNoMarkers() {
  for (const [, docs] of store) {
    for (const [, stored] of docs) {
      expect(JSON.stringify(stored)).not.toContain(SITE_TEXT);
      expect(JSON.stringify(stored)).not.toContain(ANSWER_TEXT);
    }
  }
  expect(logged.filter((line) => line.includes(SITE_TEXT) || line.includes(ANSWER_TEXT))).toEqual([]);
}

describe("redacted lane: failure messages", () => {
  it("stores and logs a thrown provider error as its class, status, code and a digest, never its message", async () => {
    const OpenAI = (await import("openai")).default;
    adapter.mockRejectedValue(OpenAI.APIError.generate(400,
      { error: { type: "invalid_request_error", code: "bad_input", message: quoting } }, undefined, new Headers()));
    const { selectFollowUps } = await import("../utils/siteTaskFollowUp");
    expect(await selectFollowUps({ requestId: "req-1", ...taskInput })).toEqual(["success_target", "item_photos", "item_weight"]);
    const [run] = [...store.get("agentRuns")!.values()];
    expect(run.status).toBe("failed");
    expect(run.error).toBe("agent_run_failed: bad_request http 400 bad_input");
    expect(run.failure_detail).toMatchObject({ error_class: "bad_request", http_status: 400, error_code: "bad_input",
      exception_type: expect.any(String), message: { redacted: true, chars: expect.any(Number), sha256: expect.stringMatching(/^[a-f0-9]{64}$/) } });
    expect(run.outcome_evaluation.checks[0].detail).toBe(run.error);
    const actions = [...(store.get("opsActionLogs")?.values() ?? [])];
    expect(actions.some((row) => row.status === "failed" && row.summary === run.error)).toBe(true);
    expect(logged.some((line) => line.includes("Agent task failed") && line.includes("bad_input"))).toBe(true);
    expectNoMarkers();
  });

  it("stores and logs a returned failure the same way", async () => {
    adapter.mockResolvedValue({ status: "failed", provider: "openai_responses", runtime: "openai_responses", model: "gpt-6-luna",
      tool_mode: "api", error: quoting, requires_human_review: true, requires_approval: false,
      artifacts: { provider_error: { error_class: "other", provider: "openai_responses", sdk: "openai", status: 500, type: "server_error",
        code: "upstream" } } });
    const { selectFollowUps } = await import("../utils/siteTaskFollowUp");
    expect(await selectFollowUps({ requestId: "req-1", ...taskInput })).toEqual(["success_target", "item_photos", "item_weight"]);
    const [run] = [...store.get("agentRuns")!.values()];
    expect(run).toMatchObject({ status: "failed", error: "agent_run_failed: other http 500 upstream" });
    expect(run.artifacts.failure_detail).toMatchObject({ error_class: "other", http_status: 500, error_code: "upstream",
      message: { redacted: true } });
    const actions = [...(store.get("opsActionLogs")?.values() ?? [])];
    expect(actions.some((row) => row.status === "failed" && row.summary === run.error)).toBe(true);
    expectNoMarkers();
  });
});

describe("redacted lane: never on a path that replays its stored input", () => {
  it.each([
    ["a session key", { session_key: "follow-up:req-1" }, undefined],
    ["a session id on the task", { session_id: "session-1" }, undefined],
    ["a session id from the caller", {}, { sessionId: "session-1" }],
    ["an existing run id", {}, { runId: "run-1" }],
    ["a resume", { resume_from_run_id: "run-0" }, undefined],
    ["approval", { approval_policy: { require_human_approval: true } }, undefined],
  ])("refuses %s with redacted_content_not_replayable, storing and sending nothing", async (_name, extra, options) => {
    const { runAgentTask, REDACTED_CONTENT_NOT_REPLAYABLE } = await import("../agents/runtime");
    const result = await runAgentTask({ kind: "site_task_follow_up", input: taskInput, ...extra } as never,
      { dispatchQueuedOnFinish: false, ...(options ?? {}) });
    expect(result.status).toBe("failed");
    expect(result.error).toMatch(new RegExp(`^${REDACTED_CONTENT_NOT_REPLAYABLE}:`));
    expect(result.artifacts).toMatchObject({ inference_not_invoked: true, refusal_reason: REDACTED_CONTENT_NOT_REPLAYABLE });
    expect(adapter).not.toHaveBeenCalled();
    expect(store.size).toBe(0);
  });

  it("refuses to open a session for the lane or send it a session message", async () => {
    const { createAgentSession, sendAgentSessionMessage, REDACTED_CONTENT_NOT_REPLAYABLE } = await import("../agents/runtime");
    await expect(createAgentSession({ title: "t", task_kind: "site_task_follow_up" })).rejects.toThrow(REDACTED_CONTENT_NOT_REPLAYABLE);
    await expect(sendAgentSessionMessage({ sessionId: "session-1", task: { kind: "site_task_follow_up", input: taskInput } }))
      .rejects.toThrow(REDACTED_CONTENT_NOT_REPLAYABLE);
    expect(store.size).toBe(0);
    expect(adapter).not.toHaveBeenCalled();
  });

  it("leaves the picker's normal call as it was", async () => {
    adapter.mockResolvedValue({ status: "completed", provider: "openai_responses", runtime: "openai_responses", model: "gpt-6-luna",
      tool_mode: "api", output: { question_ids: ["item_make_model"] }, requires_human_review: false, requires_approval: false });
    const { selectFollowUps } = await import("../utils/siteTaskFollowUp");
    expect(await selectFollowUps({ requestId: "req-1", ...taskInput })).toEqual(["success_target", "item_photos", "item_make_model"]);
    expect(adapter).toHaveBeenCalledTimes(1);
    expect([...store.get("agentRuns")!.values()].map((run) => run.status)).toEqual(["completed"]);
  });
});
