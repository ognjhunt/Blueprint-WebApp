// @vitest-environment node
/**
 * The agent runtime's records keep Firestore's own values whole, and the spend guardrail and a capture's footage
 * review read the recent runs whatever a run's stored `created_at` is.
 *
 * Each writer's `stripUndefinedDeep` took every object apart by its own fields. A `serverTimestamp()` sentinel has
 * none, so it was written as `{}`: on 2026-11-20, 2375 of 2478 runs in production. The guardrail ordered the runs by
 * `created_at`, and in Firestore's type order a map sorts above every timestamp, so it read old runs first.
 *
 * The store here does the two things the bug lives in, as Firestore does: it resolves `serverTimestamp()` to a
 * Timestamp on write, and it orders and range-filters by type (a number, then a timestamp, then a string, then a map).
 */
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runOpenAIResponsesTask = vi.hoisted(() => vi.fn());
const fake = vi.hoisted(() => ({
  docs: new Map<string, Map<string, any>>(),
  queries: [] as Array<{ collection: string; filters: unknown[][]; orders: unknown[][]; limit: number | null }>,
}));

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { FieldValue, Timestamp } = await import("firebase-admin/firestore");
  const coll = (name: string) => { if (!fake.docs.has(name)) fake.docs.set(name, new Map()); return fake.docs.get(name)!; };
  const plain = (value: any) => value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype;
  const resolve = (value: any): any => value instanceof FieldValue && value.isEqual(FieldValue.serverTimestamp()) ? Timestamp.now()
    : Array.isArray(value) ? value.map(resolve)
    : plain(value) ? Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, resolve(entry)])) : value;
  const rank = (value: any) => value === null ? 0 : typeof value === "boolean" ? 1 : typeof value === "number" ? 2
    : value instanceof Timestamp ? 3 : typeof value === "string" ? 4 : Array.isArray(value) ? 9 : 10;
  const compare = (a: any, b: any) => rank(a) - rank(b) || (a instanceof Timestamp ? a.toMillis() - b.toMillis()
    : typeof a === "number" || typeof a === "string" ? (a < b ? -1 : a > b ? 1 : 0) : 0);
  const fieldAt = (data: any, path: string) => path.split(".").reduce((cursor, key) => plain(cursor) ? cursor[key] : undefined, data);
  const doc = (name: string, id: string): any => ({
    id, path: `${name}/${id}`,
    async get() { const data = coll(name).get(id); return { exists: data !== undefined, id, data: () => data, ref: doc(name, id) }; },
    async set(value: any, options?: { merge?: boolean }) {
      coll(name).set(id, resolve(options?.merge ? { ...(coll(name).get(id) || {}), ...value } : value));
    },
  });
  const query = (name: string, filters: any[][] = [], orders: any[][] = [], limit: number | null = null): any => ({
    where: (field: string, op: string, value: unknown) => query(name, [...filters, [field, op, value]], orders, limit),
    orderBy: (field: string, direction = "asc") => query(name, filters, [...orders, [field, direction]], limit),
    limit: (count: number) => query(name, filters, orders, count),
    async get() {
      fake.queries.push({ collection: name, filters, orders, limit });
      let rows = [...coll(name).entries()].filter(([, data]) => filters.every(([field, op, value]) => {
        const actual = fieldAt(data, field);
        if (op === "==") return actual === value;
        // A range matches values of its own type only.
        if (actual === undefined || rank(actual) !== rank(value)) return false;
        const order = compare(actual, value);
        return op === ">=" ? order >= 0 : op === ">" ? order > 0 : op === "<=" ? order <= 0 : order < 0;
      }) && orders.every(([field]) => fieldAt(data, field) !== undefined)); // orderBy reads only documents with the field
      rows.sort(([leftId, left], [rightId, right]) => {
        for (const [field, direction] of orders) {
          const order = compare(fieldAt(left, field), fieldAt(right, field));
          if (order) return direction === "desc" ? -order : order;
        }
        const byName = leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
        return orders.at(-1)?.[1] === "desc" ? -byName : byName;
      });
      if (limit !== null) rows = rows.slice(0, limit);
      const docs = rows.map(([id, data]) => ({ id, data: () => data, ref: doc(name, id) }));
      return { docs, size: docs.length, empty: !docs.length };
    },
  });
  const db = {
    collection: (name: string) => ({ doc: (id: string) => doc(name, id), ...query(name) }),
    doc: (path: string) => { const [name, id] = path.split("/"); return doc(name, id); },
    async runTransaction(fn: any) { return fn({ get: (ref: any) => ref.get(), set: (ref: any, value: any, options: any) => ref.set(value, options) }); },
    batch: () => ({ set() {}, delete() {}, async commit() {} }),
  };
  return { default: { firestore: { FieldValue, Timestamp } }, dbAdmin: db, storageAdmin: null, authAdmin: null };
});
vi.mock("../agents/adapters/openai-responses", () => ({ runOpenAIResponsesTask }));

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const picker = { kind: "robot_fit_ranking", input: { candidates: [{ teamId: "t", name: "T", status: "prospect", agreed: false,
  notes: "n", whatGoesWrong: null, recorded: [] }], job: { summary: "move totes", instruction: null, rated: false,
  notRatedReason: null, needs: [], requirements: [], unknowns: [], forms: [], serviceArea: null } } };
const completed = (task: { provider: string; runtime: string; model: string }) => ({
  status: "completed", provider: task.provider, runtime: task.runtime, model: task.model, tool_mode: "api",
  output: { ranked: [] }, raw_output_text: "{}", requires_human_review: false, requires_approval: false,
  artifacts: { usage: { prompt_tokens: 10, completion_tokens: 2 } },
});
const runPicker = async (task: Record<string, unknown> = picker, sessionId?: string) => {
  const { runAgentTask } = await import("../agents/runtime");
  return runAgentTask(task as never, { sessionId, privacyRequestBinding: { request_id: "job-new" } });
};
const collection = (name: string) => [...(fake.docs.get(name)?.values() ?? [])];
/** A finished run with its cost on its record, as the runtime stores one. */
const pricedRun = (startedAtMs: number, costUsd: number, createdAt: unknown) => ({
  task_kind: "robot_fit_ranking", provider: "openai_responses", model: "gpt-fixture", status: "completed",
  artifacts: { cost_usd: costUsd }, created_at: createdAt, updated_at: createdAt,
  metadata: { cost_telemetry: { created_at_ms: startedAtMs, cost_estimate_usd: costUsd } },
});
/** 600 runs from October saved with `created_at: {}`: more than one read of 500, and all above a timestamp. */
const seedOldRuns = () => {
  const runs = fake.docs.get("agentRuns")!;
  for (let index = 0; index < 600; index++) {
    const id = `old-${String(index).padStart(3, "0")}`;
    runs.set(id, { id, ...pricedRun(Date.now() - 40 * DAY - index * MINUTE, 1, {}) });
  }
};

beforeEach(async () => {
  for (const key of ["BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER", "BLUEPRINT_STRUCTURED_AUTOMATION_FALLBACK_PROVIDER",
    "BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDERS", "BLUEPRINT_ROBOT_FIT_RANKING_PROVIDERS", "BLUEPRINT_ROBOT_FIT_RANKING_PROVIDER",
    "ANTHROPIC_ROBOT_FIT_RANKING_MODEL", "OPENAI_ROBOT_FIT_RANKING_MODEL", "ANTHROPIC_DEFAULT_MODEL", "OPENAI_DEFAULT_MODEL",
    "ANTHROPIC_BASE_URL", "OPENAI_BASE_URL", "ACP_HARNESS_URL", "OPENCLAW_BASE_URL", "BLUEPRINT_AGENT_COST_WARN_15M_USD",
    "BLUEPRINT_AGENT_COST_WARN_HOUR_USD", "BLUEPRINT_AGENT_COST_WARN_DAY_USD", "BLUEPRINT_AGENT_COST_STOP_15M_USD",
    "BLUEPRINT_AGENT_COST_STOP_HOUR_USD", "BLUEPRINT_AGENT_COST_STOP_DAY_USD"]) {
    vi.stubEnv(key, "");
  }
  vi.stubEnv("OPENAI_API_KEY", "offline-fixture");
  vi.stubEnv("ANTHROPIC_API_KEY", "offline-fixture");
  vi.stubEnv("CODEX_LOCAL_AVAILABLE", "0");
  vi.resetModules();
  (await import("../agents/provider-funds")).resetProviderFundsStateForTests();
  fake.docs.clear();
  fake.queries.length = 0;
  fake.docs.set("agentRuns", new Map());
  fake.docs.set("inboundRequests", new Map([["job-new", { privacy_version_at_submission: "2026-11-13.1" }]]));
  runOpenAIResponsesTask.mockImplementation(async (task) => completed(task));
});
afterEach(() => {
  runOpenAIResponsesTask.mockReset();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Firestore values in agent records", () => {
  it("writes a run's, its session's, checkpoints', events' and action logs' times as timestamps, and keeps a Timestamp and a Date", async () => {
    const sessionCreatedAt = Timestamp.fromMillis(Date.now() - DAY);
    fake.docs.set("agentSessions", new Map([["session-1", { id: "session-1", status: "active", metadata: {},
      created_at: sessionCreatedAt, updated_at: sessionCreatedAt }]]));
    const askedAt = Timestamp.fromMillis(Date.now() - MINUTE), dueBy = new Date(Date.now() + DAY);

    expect((await runPicker({ ...picker, metadata: { asked_at: askedAt, due_by: dueBy } }, "session-1")).status).toBe("completed");

    const [run] = collection("agentRuns");
    for (const field of ["created_at", "updated_at", "started_at", "completed_at"]) expect(run[field]).toBeInstanceOf(Timestamp);
    expect(run.metadata.asked_at).toBe(askedAt);
    expect(run.metadata.due_by).toBe(dueBy);
    // The guardrail's read key, written from the run's start with its cost record.
    expect(run.metadata.cost_telemetry.created_at_ms).toBeGreaterThan(Date.now() - MINUTE);
    const [session] = collection("agentSessions");
    expect(session.created_at).toBeInstanceOf(Timestamp);
    expect(session.created_at.isEqual(sessionCreatedAt)).toBe(true);
    expect(session.updated_at).toBeInstanceOf(Timestamp);
    expect(session.updated_at.toMillis()).toBeGreaterThan(sessionCreatedAt.toMillis());
    for (const name of ["agentCheckpoints", "agentRuntimeEvents", "opsActionLogs"]) {
      expect(collection(name).length).toBeGreaterThan(0);
      for (const record of collection(name)) expect(record.created_at).toBeInstanceOf(Timestamp);
    }
  });

  it("passes a serverTimestamp sentinel, a Timestamp and a Date through the event, checkpoint and action-log writers", async () => {
    const at = Timestamp.fromMillis(1_763_600_000_123), on = new Date(1_763_600_000_456);
    const stamps = { at, on, requested: FieldValue.serverTimestamp() };
    const { recordRuntimeEvent } = await import("../agents/runtime-events");
    const { createAgentCheckpoint } = await import("../agents/checkpoints");
    const { recordOpsActionLog } = await import("../agents/ops-action-logs");
    await recordRuntimeEvent({ session_id: "s", kind: "k", summary: "s", metadata: { stamps } });
    await createAgentCheckpoint({ session_id: "s", label: "l", trigger: "t", snapshot: { stamps } });
    await recordOpsActionLog({ session_id: "s", run_id: "r", session_key: null, action_key: "a", status: "info", summary: "s",
      provider: "openai_responses", runtime: "openai_responses", task_kind: "robot_fit_ranking", risk_level: "low", reversible: true,
      requires_approval: false, latency_ms: null, metadata: { stamps } } as never);
    const written = [collection("agentRuntimeEvents")[0].metadata.stamps, collection("agentCheckpoints")[0].snapshot.stamps,
      collection("opsActionLogs")[0].metadata.stamps];
    for (const value of written) {
      expect(value.at).toBe(at);
      expect(value.on).toBe(on);
      expect(value.requested).toBeInstanceOf(Timestamp);
    }
  });
});

describe("the spend guardrail's recent runs", () => {
  it("reads runs by their cost record's start time and by real timestamps, never `{}` first", async () => {
    vi.stubEnv("BLUEPRINT_AGENT_COST_STOP_HOUR_USD", "5");
    seedOldRuns();
    const runs = fake.docs.get("agentRuns")!;
    // Saved before the fix: `created_at` is `{}`, its time is in its cost record.
    runs.set("a-before-fix", { id: "a-before-fix", ...pricedRun(Date.now() - 10 * MINUTE, 3, {}) });
    // Saved since: `created_at` is a timestamp.
    runs.set("a-since-fix", { id: "a-since-fix", ...pricedRun(Date.now() - 5 * MINUTE, 3, Timestamp.fromMillis(Date.now() - 5 * MINUTE)) });

    const result = await runPicker();

    expect(result.status).toBe("failed");
    expect(result.error).toBe("Agent runtime cost stop threshold reached for lastHour: $6.0000.");
    expect(runOpenAIResponsesTask).not.toHaveBeenCalled();
    expect(fake.queries.filter((query) => query.collection === "agentRuns" && query.orders.length)).toEqual([
      { collection: "agentRuns", filters: [], orders: [["metadata.cost_telemetry.created_at_ms", "desc"]], limit: 500 },
      { collection: "agentRuns", filters: [["created_at", ">=", Timestamp.fromMillis(0)]], orders: [["created_at", "desc"]], limit: 500 },
    ]);
  });

  it("still stops on a recent run whose accounting is incomplete and that has no cost record", async () => {
    vi.stubEnv("BLUEPRINT_AGENT_COST_STOP_HOUR_USD", "5");
    seedOldRuns();
    fake.docs.get("agentRuns")!.set("a-incomplete", { id: "a-incomplete", task_kind: "robot_fit_ranking", provider: "openai_responses",
      status: "failed", agent_accounting_incomplete: true, created_at: Timestamp.fromMillis(Date.now() - 5 * MINUTE) });

    const result = await runPicker();

    expect(result.status).toBe("failed");
    expect(result.error).toBe("agent_usage_evidence_unavailable: agentRuns/a-incomplete");
    expect(runOpenAIResponsesTask).not.toHaveBeenCalled();
  });
});

describe("a capture's newest footage review", () => {
  const reading = (summary: string) => ({ footage_status: "usable", footage_status_reason: null, summary, observations: [],
    cycle_measurement: { cycles: [], median_cycle_seconds: null, implied_band: null, note: "unknown" },
    people_present: { max_visible_at_once: 0, relationship_to_work: "none_visible", note: "" }, not_evidenced: [], privacy_flag: false });
  /** A finished footage review of capture-1, as the runtime stored one. */
  const review = (startedAtMs: number, summary: string, stamp: unknown) => ({ task_kind: "site_video_evidence", status: "completed",
    output: reading(summary), created_at: stamp, started_at: stamp, updated_at: stamp,
    metadata: { capture_id: "capture-1", cost_telemetry: { created_at_ms: startedAtMs, cost_estimate_usd: 0.1 } } });

  it("is the newest by its cost record's start time when the runs were saved with `{}` times", async () => {
    const runs = fake.docs.get("agentRuns")!;
    // Both saved before the fix. The older one comes first in the store's own order.
    runs.set("a-older", review(Date.now() - 3 * DAY, "the older reading", {}));
    runs.set("b-newer", review(Date.now() - DAY, "the newer reading", {}));
    const { findPriorFootageReview } = await import("../utils/captureFootageReview");

    expect(await findPriorFootageReview("capture-1")).toEqual({ state: "completed", output: reading("the newer reading") });
  });

  it("is a run saved since the fix over one saved before it", async () => {
    const runs = fake.docs.get("agentRuns")!;
    runs.set("b-since-fix", review(Date.now() - DAY, "saved since", Timestamp.fromMillis(Date.now() - DAY)));
    runs.set("a-before-fix", review(Date.now() - 2 * DAY, "saved before", {}));
    const { findPriorFootageReview } = await import("../utils/captureFootageReview");

    expect(await findPriorFootageReview("capture-1")).toEqual({ state: "completed", output: reading("saved since") });
  });
});
