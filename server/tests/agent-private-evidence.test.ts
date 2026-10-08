// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

const fake = vi.hoisted(() => ({ objects: new Map<string, string>(), available: true, timeoutAfterWrite: false, generation: "1", runs: new Map<string, any>() }));
vi.mock("../utils/siteCaptureBundleStorage", () => ({
  resolveBundleStorage: () => fake.available ? {
    bucketName: "existing-private-bucket",
    createOnly: async (name: string, content: string) => {
      if (!fake.objects.has(name)) fake.objects.set(name, content);
      if (fake.timeoutAfterWrite) throw new Error("private exception must not escape");
      return "created";
    },
    readText: async (name: string) => fake.objects.get(name) ?? null,
    info: async (name: string) => fake.objects.has(name) ? { name, generation: fake.generation, size: Buffer.byteLength(fake.objects.get(name)!) } : null,
  } : null,
}));
vi.mock("../agents/runtime", () => ({ runAgentTask: vi.fn() }));
vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: { firestore: { FieldValue: { serverTimestamp: () => "timestamp" } } },
  storageAdmin: null,
  dbAdmin: { collection: () => ({ where: (_field: string, _operator: string, captureId: string) => ({ get: async () => ({ docs: [...fake.runs.entries()].filter(([, row]) => row.metadata?.capture_id === captureId).map(([id, row]) => ({ id, data: () => row })) }) }) }) },
}));
import { AGENT_DOCUMENT_BYTE_BUDGET, hydrateAgentEvidence, inspectAgentEvidence, persistAgentEvidence, persistAgentEvidenceFailure, projectAgentEvidence } from "../agents/private-evidence";

beforeEach(() => { fake.objects.clear(); fake.available = true; fake.timeoutAfterWrite = false; fake.generation = "1"; fake.runs.clear(); });
const scope = { collection: "agentRuns" as const, id: "run_123" };
const large = () => ({ id: scope.id, status: "completed", input: { task: "existing" },
  raw_output_text: "raw".repeat(400_000), output: { summary: "small supported result" },
  artifacts: { mutation_reconciliation_required: true, output_repairs: [{ rawOutput: "bad".repeat(300_000) }] },
  metadata: { cost_telemetry: { total_cost_usd: 1.2 }, private_input: "preserve" },
});

describe("private agent evidence", () => {
  it.each(["capture_video_privacy", "site_video_evidence"])("recovers the indexed %s review after offload without another inference", async task_kind => {
    const output = task_kind === "capture_video_privacy" ? { decision: "clear", evidence_seconds: [1] }
      : { footage_status: "usable", footage_status_reason: null, summary: "Existing recorded reading", observations: [], cycle_measurement: { cycles: [], median_cycle_seconds: null, implied_band: null, note: "unknown" }, people_present: { max_visible_at_once: 0, relationship_to_work: "none_visible", note: "" }, not_evidenced: [], privacy_flag: false };
    const projected = await projectAgentEvidence({ ...large(), task_kind, output, created_at: "2026-10-02T00:00:00Z", metadata: { capture_id: "capture. legacy", scene_id: "scene-1", source_packet_digest: "sha256:original" } }, scope);
    expect(projected.metadata).toMatchObject({ capture_id: "capture. legacy", scene_id: "scene-1", source_packet_digest: "sha256:original" });
    fake.runs.set(scope.id, projected);
    const { findPriorFootageReview, findPriorPrivacyReview } = await import("../utils/captureFootageReview");
    const review = task_kind === "capture_video_privacy" ? findPriorPrivacyReview : findPriorFootageReview;
    expect(await review("capture. legacy")).toEqual({ state: "completed", output });
    fake.objects.clear();
    await expect(review("capture. legacy")).rejects.toThrow("agent_evidence_object_missing");
    const { runAgentTask } = await import("../agents/runtime");
    expect(runAgentTask).not.toHaveBeenCalled();
  });
  it("keeps ordinary records inline without storage calls", async () => {
    const record = { id: scope.id, output: { summary: "small" } };
    expect(await projectAgentEvidence(record, scope)).toMatchObject(record);
    expect(fake.objects.size).toBe(0);
  });
  it("projects oversized complete proof and restores original strings without public links", async () => {
    const record = large();
    const projected = await projectAgentEvidence(record, scope);
    expect(Buffer.byteLength(JSON.stringify(projected))).toBeLessThan(AGENT_DOCUMENT_BYTE_BUDGET);
    expect(projected.raw_output_text).toBeNull();
    expect(projected.mutation_reconciliation_required).toBe(true);
    expect(projected.agent_evidence_ref).toMatchObject({ collection: "agentRuns", id: scope.id, version: 1, bucket: "existing-private-bucket" });
    expect(JSON.stringify(projected)).not.toContain("https:");
    const recovered = await hydrateAgentEvidence(projected, scope);
    expect(recovered).toMatchObject(record);
    expect(recovered.metadata.mutation_reconciliation_required).toBe(true);
  });
  it.each(["agentSessions", "agentCheckpoints", "agentRuntimeEvents"] as const)("projects and hydrates %s duplicate payloads", async collection => {
    const payload = { raw: "x".repeat(1_200_000), marker: "retain sibling" };
    const field = collection === "agentCheckpoints" ? "snapshot" : "metadata";
    const record = { id: "record_1", [field]: payload };
    const currentScope = { collection, id: record.id };
    const projected = await projectAgentEvidence(record, currentScope);
    expect(Buffer.byteLength(JSON.stringify(projected))).toBeLessThan(AGENT_DOCUMENT_BYTE_BUDGET);
    expect(await hydrateAgentEvidence(projected, currentScope)).toMatchObject(record);
  });
  it("reconciles an ambiguous immutable upload by verified readback", async () => {
    fake.timeoutAfterWrite = true;
    const first = await projectAgentEvidence(large(), scope);
    const second = await projectAgentEvidence(large(), scope);
    expect(first.agent_evidence_ref).toEqual(second.agent_evidence_ref);
    expect(fake.objects.size).toBe(1);
  });
  it("rejects tampering without private bytes in diagnostics", async () => {
    const projected = await projectAgentEvidence(large(), scope);
    fake.objects.set(projected.agent_evidence_ref.object, "PRIVATE poison");
    await expect(hydrateAgentEvidence(projected, scope)).rejects.toThrow("agent_evidence_integrity_failed: agentRuns/run_123");
  });
  it("retains exact legacy Unicode and punctuation IDs with safe hashed object paths", async () => {
    const legacyScope = { collection: "agentRuns" as const, id: "legacy. Run 東京 🧪" };
    const projected = await projectAgentEvidence({ ...large(), id: legacyScope.id }, legacyScope);
    expect(projected.agent_evidence_ref.id).toBe(legacyScope.id);
    expect(projected.agent_evidence_ref.object).toMatch(/^agent-runtime-evidence\/v1\/agentRuns\/[a-f0-9]{64}\/[a-f0-9]{64}\.json$/);
    expect((await hydrateAgentEvidence(projected, legacyScope)).id).toBe(legacyScope.id);
  });
  it("rejects internally consistent malformed manifests with duplicate fields", async () => {
    const projected = await projectAgentEvidence(large(), scope);
    const content = JSON.stringify({ version: 1, ...scope, payload: { raw_output_text: "x", extra_control: "poison" } });
    const sha256 = createHash("sha256").update(content).digest("hex");
    const object = `agent-runtime-evidence/v1/agentRuns/${createHash("sha256").update(scope.id).digest("hex")}/${sha256}.json`;
    fake.objects.set(object, content);
    projected.agent_evidence_ref = { ...projected.agent_evidence_ref, object, sha256, bytes: Buffer.byteLength(content), fields: ["raw_output_text", "raw_output_text"] };
    await expect(hydrateAgentEvidence(projected, scope)).rejects.toThrow("agent_evidence_reference_invalid");
  });
  it("rejects replaced object generation even when content is identical", async () => {
    const projected = await projectAgentEvidence(large(), scope);
    fake.generation = "2";
    await expect(hydrateAgentEvidence(projected, scope)).rejects.toThrow("agent_evidence_integrity_failed");
  });
  it("rejects wrong owner scope before reading evidence", async () => {
    const projected = await projectAgentEvidence(large(), scope);
    await expect(hydrateAgentEvidence(projected, { collection: "agentRuns", id: "different_run" })).rejects.toThrow("agent_evidence_reference_invalid");
  });
  it("reports missing storage and object as recoverable explicit errors", async () => {
    const projected = await projectAgentEvidence(large(), scope);
    fake.objects.clear();
    await expect(hydrateAgentEvidence(projected, scope)).rejects.toThrow("agent_evidence_object_missing");
    fake.available = false;
    await expect(projectAgentEvidence(large(), scope)).rejects.toThrow("agent_evidence_storage_unavailable");
  });
  it("retains valid sibling records when one evidence bundle is unavailable", async () => {
    const bad = await projectAgentEvidence(large(), scope);
    fake.objects.clear();
    const good = { id: "sibling", output: { summary: "useful" } };
    const result = await Promise.all([inspectAgentEvidence(bad, scope), inspectAgentEvidence(good, { collection: "agentRuns", id: "sibling" })]);
    expect(result[0]).toMatchObject({ agent_evidence_error: "agent_evidence_object_missing: agentRuns/run_123", mutation_reconciliation_required: true });
    expect(result[1]).toEqual(good);
  });
  it("keeps compact quarantine and mutable controls independent of old bundle", async () => {
    const projected = await projectAgentEvidence({ id: "session_1", metadata: { private_input: "x".repeat(900_000) } }, { collection: "agentSessions", id: "session_1" });
    projected.mutation_reconciliation_required = true;
    projected.metadata = { safe_new_control: "new" };
    const hydrated = await hydrateAgentEvidence(projected, { collection: "agentSessions", id: "session_1" });
    expect(hydrated.metadata).toMatchObject({ mutation_reconciliation_required: true, safe_new_control: "new", private_input: "x".repeat(900_000) });
  });
  it("retains newer compact failure controls without an old bundle restoring success", async () => {
    const projected = await projectAgentEvidence({ ...large(), error: null, outcome_evaluation: { status: "pass" } }, scope);
    projected.status = "failed";
    projected.error = "agent_evidence_persistence_failed";
    projected.outcome_evaluation = { status: "fail" };
    const recovered = await hydrateAgentEvidence(projected, scope);
    expect(recovered.status).toBe("failed");
    expect(recovered.error).toBe("agent_evidence_persistence_failed");
    expect(recovered.outcome_evaluation.status).toBe("fail");
    expect(recovered.raw_output_text).toBe(large().raw_output_text);
  });
  it("does not overlay stale inline accounting from a different manifest", async () => {
    const projected = await projectAgentEvidence(large(), scope);
    projected.agent_evidence_accounting_sha256 = "stale";
    projected.metadata.cost_telemetry = { total_cost_usd: 0 };
    const recovered = await hydrateAgentEvidence(projected, scope);
    expect(recovered.metadata.cost_telemetry).toEqual(large().metadata.cost_telemetry);
  });
  it("fences failure recovery against a newer canonical proof without erasing quarantine", async () => {
    let saved: any = { id: scope.id, status: "running" };
    const document = { get: async () => ({ exists: true, data: () => saved }), set: async (value: any, options?: any) => { saved = options?.merge ? { ...saved, ...value } : value; } };
    let failure: unknown;
    try { await persistAgentEvidence(document, scope, large(), { runTransaction: async () => { throw new Error("commit failed"); } }); } catch (error) { failure = error; }
    saved = await projectAgentEvidence({ ...large(), raw_output_text: "NEWER".repeat(200_000) }, scope);
    const latestReference = saved.agent_evidence_ref;
    const database = { runTransaction: async (fn: any) => fn({ get: (ref: any) => ref.get(), set: (ref: any, value: any, options?: any) => ref.set(value, options) }) };
    await persistAgentEvidenceFailure(document, scope, { mutation_reconciliation_required: true, error: "pending old proof" }, failure, database);
    expect(saved.agent_evidence_ref).toEqual(latestReference);
    expect(saved.mutation_reconciliation_required).toBe(true);
    // The independently newer verified proof keeps its own accounting complete.
    expect(saved.agent_accounting_incomplete).toBeUndefined();
  });
  it("does not replace a newer generation even when the payload hash is unchanged", async () => {
    let saved: any = { id: scope.id, status: "running" };
    const document = { get: async () => ({ exists: true, data: () => saved }), set: async (value: any, options?: any) => { saved = options?.merge ? { ...saved, ...value } : value; } };
    let failure: any;
    try { await persistAgentEvidence(document, scope, large(), { runTransaction: async () => { throw new Error("commit failed"); } }); } catch (error) { failure = error; }
    fake.generation = "2";
    saved = await projectAgentEvidence(large(), scope);
    expect(saved.agent_evidence_ref.sha256).toBe(failure.evidenceReference.sha256);
    const database = { runTransaction: async (fn: any) => fn({ get: (ref: any) => ref.get(), set: (ref: any, value: any, options?: any) => ref.set(value, options) }) };
    await persistAgentEvidenceFailure(document, scope, { mutation_reconciliation_required: true }, failure, database);
    expect(saved.agent_evidence_ref.generation).toBe("2");
    expect(saved.mutation_reconciliation_required).toBe(true);
  });
  it("projects the whole merged document, preserves existing fields and rehydrates before updates", async () => {
    let saved: any = await projectAgentEvidence(large(), scope);
    const document = { get: async () => ({ exists: true, data: () => saved }), set: async (value: any) => { saved = value; } };
    const database = { runTransaction: async (fn: any) => fn({ get: (ref: any) => ref.get(), set: (ref: any, value: any) => ref.set(value) }) };
    await persistAgentEvidence(document, scope, { status: "failed", metadata: { extra: "new" } }, database);
    expect(saved.status).toBe("failed");
    const recovered = await hydrateAgentEvidence(saved, scope);
    expect(recovered.raw_output_text).toBe(large().raw_output_text);
    expect(recovered.metadata).toMatchObject({ private_input: "preserve", extra: "new" });
    expect(recovered.mutation_reconciliation_required).toBe(true);
  });
  it("fences a concurrent quarantine write and never clears it", async () => {
    let saved: any = { id: scope.id, status: "running" };
    let reads = 0;
    const document = { get: async () => {
      const snapshot = { ...saved };
      if (++reads === 1) saved.mutation_reconciliation_required = true;
      return { exists: true, data: () => snapshot };
    }, set: async (value: any) => { saved = value; } };
    const database = { runTransaction: async (fn: any) => fn({ get: (ref: any) => ref.get(), set: (ref: any, value: any) => ref.set(value) }) };
    await persistAgentEvidence(document, scope, { status: "completed" }, database);
    expect(saved.mutation_reconciliation_required).toBe(true);
    expect(reads).toBeGreaterThan(2);
  });
  it("replaces offloaded metadata without leaving large recursively merged keys", async () => {
    let saved: any = { id: scope.id, metadata: { huge: "x".repeat(900_000) } };
    const document = { get: async () => ({ exists: true, data: () => saved }), set: async (value: any) => { saved = value; } };
    const database = { runTransaction: async (fn: any) => fn({ get: (ref: any) => ref.get(), set: (ref: any, value: any) => ref.set(value) }) };
    await persistAgentEvidence(document, scope, { status: "completed" }, database);
    expect(saved.metadata?.huge).toBeUndefined();
    expect(Buffer.byteLength(JSON.stringify(saved))).toBeLessThan(AGENT_DOCUMENT_BYTE_BUDGET);
    expect((await hydrateAgentEvidence(saved, scope)).metadata.huge).toBe("x".repeat(900_000));
  });
  it("rejects controls too large instead of silently truncating originals", async () => {
    await expect(projectAgentEvidence({ ...large(), provider: "p".repeat(800_000) }, scope)).rejects.toThrow("agent_evidence_controls_too_large");
    expect(fake.objects.size).toBe(1);
  });
});
