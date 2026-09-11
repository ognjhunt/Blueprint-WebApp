// @vitest-environment node
import { createHash, createHmac } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null }));

import { AdpManagedRuns, ADP_ADMISSIONS, ADP_PENDING } from "../agents/adp-managed-runs";
import { adpTaskAdmissionSchema, type AdpTaskAdmission, type AdpTaskStatus } from "../agents/adp-contract";
import { AdpPipelineRequestError, requestAdpTask } from "../agents/adapters/openai-agents-api";
import { createFakeFirestore, createFakeFirestoreState } from "./helpers/fake-firestore";
import { crossRuntimeDigest } from "../utils/crossRuntimeCanonical";

const hash = (value: unknown) => `sha256:${createHash("sha256").update(JSON.stringify(value, Object.keys(value as object).sort())).digest("hex")}`;
const admission = (): AdpTaskAdmission => ({
  schema_version: "blueprint_webapp_agent_admission.v1", task_id: "task-1", task_digest: `sha256:${"a".repeat(64)}`,
  run_id: "run-1", source_commit: "a".repeat(40), runtime: "openai_agents_api", model: "gpt-5.6-terra",
  title: "Investigate retained failure", owner_client_id: "blueprint-webapp", expires_at: Date.now() / 1000 + 600,
  enabled: true, autostart: false, proof_effect: "none",
});
const diagnosis = { disposition: "investigate" as const, summary: "A saved input is missing.",
  evidence_references: [`sha256:${"e".repeat(64)}`], next_actions: ["Restore the admitted input."], uncertainty: [] };
const status = (record: AdpTaskAdmission, state: AdpTaskStatus["state"] = "running"): AdpTaskStatus => ({
  schema_version: "blueprint_agent_task_status.v1", task_id: record.task_id, task_digest: record.task_digest,
  run_id: record.run_id, source_commit: record.source_commit, runtime: record.runtime, state,
  error_code: null, cancel_requested: false, cleanup_state: "not_requested", updated_at: 100,
  usage: null, resource_closeout: "not_established_by_agent_completion", proof_effect: "none",
  result: state === "completed" ? {
    schema_version: "blueprint_agent_task_result.v1", task_id: record.task_id, task_digest: record.task_digest,
    run_id: record.run_id, source_commit: record.source_commit, runtime: record.runtime, model: record.model,
    output: diagnosis, output_digest: hash(diagnosis), result_digest: `sha256:${"b".repeat(64)}`,
    scientific_acceptance_granted: false,
  } : null,
});

function setup(forward = vi.fn(async (record: AdpTaskAdmission) => status(record))) {
  const state = createFakeFirestoreState();
  const original = createFakeFirestore(state);
  let serialized = Promise.resolve();
  const store = {
    ...original,
    collection: (name: string) => ({ ...original.collection(name), limit: (limit: number) => original.collection(name).orderBy("task_id").limit(limit) }),
    runTransaction: (operation: (tx: any) => Promise<any>): Promise<any> => {
      const task = serialized.then(async () => {
        const deletes: Array<any> = [];
        const result = await original.runTransaction((tx) => operation({ ...tx, delete: (ref: any) => deletes.push(ref) }));
        for (const ref of deletes) state.docs.delete(`${ref.__collection}/${ref.id}`);
        return result;
      });
      serialized = task.then(() => undefined, () => undefined);
      return task;
    },
  } as unknown as FirebaseFirestore.Firestore;
  let now = Date.now();
  const service = new AdpManagedRuns(store, forward, () => now);
  return { service, state, forward, advance: (milliseconds = 6000) => { now += milliseconds; } };
}

beforeEach(() => {
  process.env.BLUEPRINT_AGENT_PIPELINE_BASE_URL = "https://pipeline.example/api/live-pipeline";
  process.env.CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN = "fixture-signing-secret";
});
afterEach(() => { delete process.env.BLUEPRINT_AGENT_PIPELINE_BASE_URL; delete process.env.CAPTURE_UPLOAD_INTAKE_FORWARD_TOKEN; });

describe("admitted asynchronous runtime", () => {
  it.each(["expired", "revoked"])("collects a delayed %s admission without restarting inference", async (reason) => {
    const record = { ...admission(), autostart: true, ...(reason === "expired" ? { expires_at: 1 } : { enabled: false }) };
    const forward = vi.fn(async (value: AdpTaskAdmission) => ({ ...status(value, "completed"), cleanup_state: "deleted" as const }));
    const { service } = setup(forward);
    await service.admit(record);
    expect((await service.status(record.task_id)).run!.collection_only).toBe(true);
    await service.tick();
    expect((await service.status(record.task_id)).run!.status).toBe("completed");
    expect(forward).toHaveBeenCalledWith(record, "inspect");
    expect(forward).toHaveBeenCalledOnce();
    await expect(service.start(record.task_id, "operator")).rejects.toThrow("expired_or_disabled");
  });

  it("does not turn a missing late task into a new execution", async () => {
    const record = { ...admission(), autostart: true, expires_at: 1 };
    const forward = vi.fn().mockRejectedValue(new AdpPipelineRequestError(409, "agent_task_missing"));
    const { service, advance } = setup(forward);
    await service.admit(record); await service.tick();
    expect((await service.status(record.task_id)).run!.reconciliation_error).toBe("agent_task_missing");
    advance(); await service.tick();
    expect(forward).toHaveBeenCalledOnce();
    expect(forward.mock.calls[0][1]).toBe("inspect");
  });

  it.each(["completed", "failed", "cancelled"] as const)("observes deferred cleanup after %s without deleting a retained session", async (terminalState) => {
    const record = admission();
    let current = { ...status(record, terminalState), cleanup_when_terminal: false };
    const forward = vi.fn(async (_record: AdpTaskAdmission, _action?: string) => current);
    const { service, state, advance } = setup(forward);
    await service.admit(record);
    const { run } = await service.start(record.task_id, "operator");
    await service.tick();
    const original = (await service.status(record.task_id)).run!;
    expect(state.docs.has(`${ADP_PENDING}/${run!.id}`)).toBe(true);
    advance(); await service.tick();
    expect(forward).toHaveBeenCalledOnce();
    current = { ...current, cleanup_state: "deleted", updated_at: 101 };
    advance(60_000);
    const restarted = new AdpManagedRuns(service.store, forward, service.now);
    await restarted.tick();
    const finished = (await restarted.status(record.task_id)).run!;
    expect(finished.status).toBe(terminalState);
    expect(finished.output).toEqual(original.output);
    expect(finished.completed_at).toEqual(original.completed_at);
    expect(finished.artifacts.agent_execution.cleanup_state).toBe("deleted");
    expect(state.docs.has(`${ADP_PENDING}/${run!.id}`)).toBe(false);
    expect(forward.mock.calls.map((call) => call[1])).toEqual(["inspect", "inspect"]);
  });

  it("retains deferred cleanup across an outage without rapid terminal polling", async () => {
    const record = admission();
    const current = { ...status(record, "completed"), cleanup_when_terminal: false };
    const forward = vi.fn().mockResolvedValueOnce(current)
      .mockRejectedValueOnce(new AdpPipelineRequestError(null, "adp_agent_pipeline_request_unresolved"))
      .mockResolvedValueOnce({ ...current, cleanup_state: "deleted", updated_at: 101 });
    const { service, advance } = setup(forward);
    await service.admit(record); await service.start(record.task_id, "operator"); await service.tick();
    advance(60_000); await service.tick();
    expect((await service.status(record.task_id)).run!.status).toBe("completed");
    advance(); await service.tick();
    expect(forward).toHaveBeenCalledTimes(2);
    advance(60_000); await service.tick();
    expect((await service.status(record.task_id)).run!.artifacts.agent_execution.cleanup_state).toBe("deleted");
    expect(forward.mock.calls.map((call) => call[1])).toEqual(["inspect", "inspect", "inspect"]);
  });

  it("keeps reading back controller-owned automatic cleanup after completion", async () => {
    const record = admission();
    let current = { ...status(record, "completed"), cleanup_when_terminal: true };
    const forward = vi.fn(async () => current);
    const { service, state, advance } = setup(forward);
    await service.admit(record);
    const { run } = await service.start(record.task_id, "operator");
    await service.tick();
    expect((await service.status(record.task_id)).run!.status).toBe("completed");
    expect(state.docs.has(`${ADP_PENDING}/${run!.id}`)).toBe(true);
    current = { ...current, cleanup_state: "deleted", updated_at: 101 };
    advance(); await service.tick();
    const saved = (await service.status(record.task_id)).run!;
    expect(saved.artifacts.agent_execution.cleanup_state).toBe("deleted");
    expect(saved.output).toEqual(diagnosis);
    expect(state.docs.has(`${ADP_PENDING}/${run!.id}`)).toBe(false);
    expect(forward.mock.calls).toHaveLength(2);
  });
  it("keeps an episode pending until independent collection and retains numeric evidence digests", async () => {
    const record = admission();
    const current = status(record, "completed");
    const episode = { episode_outcome: "unclear" as const, summary: "A camera interval is missing.",
      confidence: 1.0, events: [], possible_missed_events: [], contract_considerations: [] };
    current.result!.output = episode;
    current.output_cross_runtime_digest = crossRuntimeDigest(episode);
    current.interpretation = { status: "pending_validation" };
    const { service, advance } = setup(vi.fn(async () => structuredClone(current)));
    await service.admit(record); await service.start(record.task_id, "operator"); await service.tick();
    expect((await service.status(record.task_id)).run!.status).toBe("running");
    current.interpretation = { status: "abstained", task_id: record.task_id, task_digest: record.task_digest,
      receipt_digest: `sha256:${"f".repeat(64)}`, input_bundle_digest: `sha256:${"e".repeat(64)}`, proof_effect: "none" };
    advance(); await service.tick();
    const completed = (await service.status(record.task_id)).run!;
    expect(completed.status).toBe("completed");
    expect(completed.output).toMatchObject({ kind: "episode_interpretation", disposition: "abstained",
      interpretation_receipt_digest: current.interpretation.receipt_digest });
    const tampered = structuredClone(current);
    tampered.result!.output.summary = "Different output";
    await expect(requestAdpTask(record, "inspect", vi.fn(async () => new Response(JSON.stringify(tampered))) as any))
      .rejects.toThrow("digest_mismatch");
  });

  it("deduplicates repeated admission and start, while only the worker contacts Pipeline", async () => {
    const { service, state, forward } = setup();
    const record = admission();
    await service.admit(record);
    const first = await service.start(record.task_id, "verified-operator");
    const second = await service.start(record.task_id, "verified-operator");
    expect(first.run!.id).toBe(second.run!.id);
    expect(forward).not.toHaveBeenCalled();
    expect([...state.docs.keys()].filter((key) => key.startsWith("agentRuns/"))).toHaveLength(1);
    await service.tick();
    expect(forward).toHaveBeenCalledOnce();
    expect((await service.status(record.task_id)).run!.status).toBe("running");
  });

  it("recovers a lost enqueue reply by inspecting the same task without another provider identity", async () => {
    const forward = vi.fn().mockRejectedValueOnce(new AdpPipelineRequestError(409, "agent_task_missing"))
      .mockRejectedValueOnce(new AdpPipelineRequestError(null, "adp_agent_pipeline_request_unresolved"))
      .mockImplementation(async (record) => status(record, "completed"));
    const { service, state, advance } = setup(forward);
    const record = admission(); await service.admit(record); await service.start(record.task_id, "operator");
    await service.tick();
    expect((await service.status(record.task_id)).run!.status).toBe("queued");
    advance(); await service.tick();
    expect(forward.mock.calls.map((call) => call[1])).toEqual(["inspect", "enqueue", "inspect"]);
    expect((await service.status(record.task_id)).run!.status).toBe("completed");
    expect([...state.docs.keys()].some((key) => key.startsWith(`${ADP_PENDING}/`))).toBe(true);
  });

  it("keeps cancellation pending across an outage and accepts only observed terminal cancellation", async () => {
    const record = admission();
    const forward = vi.fn().mockRejectedValueOnce(new AdpPipelineRequestError(null, "adp_agent_pipeline_request_unresolved"))
      .mockResolvedValueOnce(status(record)).mockResolvedValueOnce({ ...status(record, "cancelled"), cancel_requested: true });
    const { service, advance } = setup(forward);
    await service.admit(record); await service.start(record.task_id, "operator");
    await service.requestAction(record.task_id, "cancel", "operator"); await service.tick();
    expect((await service.status(record.task_id)).run!.status).toBe("queued");
    advance(); await service.tick();
    const result = (await service.status(record.task_id)).run!;
    expect(result.status).toBe("cancelled"); expect(result.cancel_requested).toBe(true);
    expect(forward.mock.calls.map((call) => call[1])).toEqual(["inspect", "inspect", "cancel"]);
  });

  it("does not enqueue when a pre-enqueue cancellation finds the source journal missing", async () => {
    const record = admission();
    const forward = vi.fn().mockRejectedValueOnce(new AdpPipelineRequestError(409, "agent_task_missing"))
      .mockResolvedValue({ ...status(record, "queued"), cancel_requested: true });
    const { service } = setup(forward); await service.admit(record); await service.start(record.task_id, "operator");
    await service.requestAction(record.task_id, "cancel", "operator"); await service.tick();
    expect(forward.mock.calls.map((call) => call[1])).toEqual(["inspect", "cancel"]);
  });

  it("a cancellation committed during missing-task inspection prevents enqueue", async () => {
    let release!: () => void;
    const wait = new Promise<void>((resolve) => { release = resolve; });
    const forward = vi.fn(async (record, action) => {
      if (action === "inspect") { await wait; throw new AdpPipelineRequestError(409, "agent_task_missing"); }
      return { ...status(record, "cancelled"), cancel_requested: true };
    });
    const { service } = setup(forward);
    const record = admission(); await service.admit(record);
    const { run } = await service.start(record.task_id, "operator");
    const running = service.step(run!.id);
    await vi.waitFor(() => expect(forward).toHaveBeenCalledOnce());
    await service.requestAction(record.task_id, "cancel", "operator");
    release(); await running;
    expect(forward.mock.calls.map((call) => call[1])).toEqual(["inspect", "cancel"]);
    expect((await service.status(record.task_id)).run!.status).toBe("cancelled");
  });

  it("leases one pending task across concurrent workers", async () => {
    let release!: () => void;
    const wait = new Promise<void>((resolve) => { release = resolve; });
    const forward = vi.fn(async (record) => { await wait; return status(record); });
    const { service } = setup(forward); const record = admission(); await service.admit(record);
    const { run } = await service.start(record.task_id, "operator");
    const first = service.step(run!.id);
    await vi.waitFor(() => expect(forward).toHaveBeenCalledOnce());
    expect(await service.step(run!.id)).toEqual({ performed: false });
    release(); await first;
  });

  it("refuses changed task identity and never overwrites accepted terminal output", async () => {
    const { service, forward, advance } = setup(); const record = admission(); await service.admit(record);
    await expect(service.admit({ ...record, task_digest: `sha256:${"f".repeat(64)}` })).rejects.toThrow("admission_conflict");
    await service.start(record.task_id, "operator"); forward.mockResolvedValueOnce(status(record, "completed")); await service.tick();
    await service.requestAction(record.task_id, "cleanup", "operator"); advance();
    forward.mockResolvedValueOnce(status(record)); await service.tick();
    const result = (await service.status(record.task_id)).run!;
    expect(result.status).toBe("completed"); expect(result.output).toEqual(diagnosis);
    expect(result.reconciliation_error).toBe("adp_agent_reconciliation_refused");
  });

  it("retains evidence when session cleanup is confirmed", async () => {
    const { service, forward, advance } = setup(); const record = admission(); await service.admit(record);
    await service.start(record.task_id, "operator"); forward.mockResolvedValueOnce(status(record, "completed")); await service.tick();
    const completedAt = (await service.status(record.task_id)).run!.completed_at;
    await service.requestAction(record.task_id, "cleanup", "operator"); advance();
    forward.mockResolvedValueOnce(status(record, "completed"));
    forward.mockResolvedValueOnce({ ...status(record, "completed"), cleanup_state: "deleted" }); await service.tick();
    const result = (await service.status(record.task_id)).run!;
    expect(result.output).toEqual(diagnosis); expect(result.artifacts.agent_execution.cleanup_state).toBe("deleted");
    expect(result.artifacts.scientific_acceptance_granted).toBe(false);
    expect(result.completed_at).toBe(completedAt);
  });

  it("does not replace a failed terminal state with a later completed state", async () => {
    const { service, forward, advance } = setup(); const record = admission(); await service.admit(record);
    await service.start(record.task_id, "operator"); forward.mockResolvedValueOnce(status(record, "failed")); await service.tick();
    await service.requestAction(record.task_id, "cleanup", "operator"); advance();
    forward.mockResolvedValueOnce({ ...status(record, "completed"), cleanup_state: "deleted" }); await service.tick();
    expect((await service.status(record.task_id)).run!.status).toBe("failed");
  });

  it("rejects model-supplied prompts or authority in admission and disables only the existing task", async () => {
    const { service, state } = setup(); const record = admission();
    expect(adpTaskAdmissionSchema.safeParse({ ...record, prompt: "Launch a GPU" }).success).toBe(false);
    await service.admit(record); await service.admit({ ...record, enabled: false });
    await expect(service.start(record.task_id, "operator")).rejects.toThrow("expired_or_disabled");
    expect([...state.docs.keys()]).toEqual([`${ADP_ADMISSIONS}/${record.task_id}`]);
  });
});

describe("signed Pipeline provider adapter", () => {
  it("strips private or unknown producer fields before persistence", async () => {
    const record = admission(); const response = status(record, "completed") as any;
    Object.assign(response.result, { prompt: "private prompt", api_key: "sk-private", host_path: "/private/host/path", authority: { extra: true } });
    response.usage = { input_tokens: 10, api_key: "sk-private" };
    const parsed = await requestAdpTask(record, "inspect", vi.fn(async () => new Response(JSON.stringify(response))) as typeof fetch);
    const retained = JSON.stringify(parsed);
    for (const privateValue of ["private prompt", "sk-private", "/private/host/path", "authority"]) expect(retained).not.toContain(privateValue);
    expect(parsed.usage).toEqual({ input_tokens: 10 });
  });
  it("binds the request to the admitted task and preserves the response output digest", async () => {
    const record = admission();
    const fetcher = vi.fn(async (url, options) => {
      expect(url).toBe("https://pipeline.example/api/live-pipeline/agents/tasks/task-1/enqueue");
      expect(options.redirect).toBe("error"); expect(options.body).toBe("{}");
      const headers = options.headers;
      const expected = createHmac("sha256", "fixture-signing-secret")
        .update(`${headers["x-blueprint-pipeline-timestamp"]}.blueprint-webapp.${headers["x-blueprint-pipeline-nonce"]}.{}`).digest("hex");
      expect(headers["x-blueprint-pipeline-signature"]).toBe(`sha256=${expected}`);
      return new Response(JSON.stringify(status(record, "completed")), { status: 200 });
    });
    expect((await requestAdpTask(record, "enqueue", fetcher as typeof fetch)).result?.output).toEqual(diagnosis);
  });

  it.each(["source", "runtime", "digest", "acceptance"])("refuses an invalid %s response", async (change) => {
    const record = admission(); const response = status(record, "completed");
    if (change === "source") response.source_commit = "f".repeat(40);
    if (change === "runtime") response.runtime = "openai_agents_sdk";
    if (change === "digest") response.result!.output.summary = "Replaced output";
    if (change === "acceptance") (response.result as any).scientific_acceptance_granted = true;
    await expect(requestAdpTask(record, "inspect", vi.fn(async () => new Response(JSON.stringify(response))) as typeof fetch)).rejects.toThrow();
  });
});
