// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, default: {} }));
import { CommunicationsStore, COMMUNICATIONS_ROOT } from "../agents/communications-store";
import { buildCommunicationsInput, processCommunicationsJob, recoverSavedCommunicationsDraft } from "../agents/communications-worker";
import { CommunicationsRuntimeError } from "../agents/communications-api";
import { communicationsDigest } from "../agents/communications-contract";
import { createNativeLearningHooks } from "../research-learning/native-hooks";
import { verifySourceSnapshot } from "../research-learning/prior-research";
import { digest, LEARNING_ROOT } from "../research-learning/contract";
import { initialHypothesisEvents } from "../research-learning/initial-hypotheses";
import { BusinessHistoryStore } from "../research-learning/business-history";
import { communicationsFixture, communicationsNow, memoryFirestore } from "./fixtures/communications";
import { learningMemoryFirestore, learningEvent } from "./fixtures/research-learning";

async function setup(options: { sourceMissing?: boolean; checkpoint?: boolean; liveClock?: boolean } = {}) {
  const f = communicationsFixture(), learningMemory = learningMemoryFirestore(), db = memoryFirestore(learningMemory.records);
  const now = options.liveClock ? () => Date.now() : () => communicationsNow;
  const clock = () => new Date(communicationsNow).toISOString(), store = new CommunicationsStore(db, now, "communications-learning-owner");
  const body = { version: "blueprint.research-learning-source-snapshot.v1", asOf: "2026-09-30T20:00:00.000Z",
    scope: { principalId: "source-reconciler", crmIds: [], capabilityIds: ["cap-1"], sections: ["crm", "capabilities"] },
    source: { crm: { recordRef: "blueprintDailyResearch/sites-first/files/crm.json", sourceHash: digest("crm"), capturedAt: "2026-09-30T20:00:00Z" },
      knowledge: { recordRef: "blueprintDailyResearch/sites-first/files/knowledge.json", sourceHash: digest("knowledge"), capturedAt: "2026-09-30T20:00:00Z" },
      knowledgeContentHash: digest("knowledge-content"), reconciliationHash: digest("reconciled") },
    crmRows: [], companies: [{ companyId: "company-1", name: "Synthetic team", roles: [], sourcePageIds: [] }],
    capabilities: [{ capabilityId: "cap-1", companyId: "company-1", recordType: "reviewed_capability", product: { name: "Synthetic product", version: null },
      taskTags: [], geographyTags: [], facts: [] }], sourcePages: [], researchRuns: [], unknowns: [], parentSnapshotId: null };
  const source = verifySourceSnapshot({ ...body, snapshotId: digest(body), contentHash: digest(body) });
  const sourcePath = `${LEARNING_ROOT}/sourceSnapshots/${source.snapshotId}`;
  if (!options.sourceMissing) learningMemory.records.set(sourcePath, source);
  await db.doc(`${COMMUNICATIONS_ROOT}/briefs/${f.brief.briefId}`).set(f.brief);
  await db.doc(`${COMMUNICATIONS_ROOT}/handoffs/${f.job.briefDigest}`).set(f.handoff);
  await db.doc(`outboundProspects/${f.brief.prospectId}`).set({ contactEmail: f.brief.contact.email, siteId: f.brief.siteId,
    taskId: f.brief.taskId, stage: "drafted", privateNotes: "PRIVATE_CANONICAL_SENTINEL" });
  // Another authorized company prospect does not widen this draft's scope.
  learningMemory.records.set("outboundProspects/unrelated-prospect", { privateNotes: "UNRELATED_PRIVATE_SENTINEL" });
  const { jobId: _id, ...enqueue } = f.job, job = await store.enqueue(enqueue), jobPath = `${COMMUNICATIONS_ROOT}/jobs/${job.jobId}`;
  if (options.checkpoint) await db.doc(jobPath).update({ checkpoint: { createClaimedAt: new Date(communicationsNow-1000).toISOString(),
    sessionId: "original-session", turnId: "original-turn", requestDigest: "a".repeat(64) } });
  const event = learningEvent("contact_observed", f.brief.prospectId, { occurredAt: "2026-09-30T20:30:00.000Z", recordedAt: "2026-09-30T20:30:00.000Z" });
  learningMemory.records.set(`${LEARNING_ROOT}/events/${event.eventId}`, event);
  // Real business schema/provenance, dated before this draft's frozen cutoff.
  const hypothesis = initialHypothesisEvents({ subjectKey: "blueprint:research-learning", capturedBy: "blueprint-learning-host",
    occurredAt: "2026-09-30T21:00:00.000Z", recordedAt: clock(), sources: [{ system: "chat", threadId: "synthetic-business-thread",
      messageId: "synthetic-business-message", originalTimestamp: "2026-09-30T21:00:00.000Z", originalAuthorId: "synthetic-owner",
      originalAuthorRole: "user", sourceHash: digest("synthetic-original-message"), businessExcerpt: "SYNTHETIC_BUSINESS_CONTEXT" }] })[0];
  await new BusinessHistoryStore(learningMemory.db, clock).append(hypothesis, { principalId: "blueprint-learning-host",
    subjectKeys: ["blueprint:research-learning"], approvedEventId: hypothesis.eventId, verifiedSources: hypothesis.sources });
  const hooks = createNativeLearningHooks(learningMemory.db, { sourceSnapshotId: source.snapshotId, principalId: "blueprint-learning-host",
    businessSubjectKeys: ["blueprint:research-learning"], focus: { city: "Sacramento", industry: "Laundromats" } }, clock);
  const learningHooks = { prepareNativeJob: vi.fn(hooks.prepareNativeJob), afterNativeWork: vi.fn(hooks.afterNativeWork) };
  for (const path of learningMemory.records.keys()) learningMemory.updateTimes.set(path, clock());
  const deps = { store, learningHooks, api: { run: vi.fn(async () => ({ output: f.output,
    checkpoint: learningMemory.records.get(jobPath).checkpoint, usage: { input_tokens: 10 } })),
    cancel: vi.fn(async () => true), reconcileSaved: vi.fn(async () => null as any) },
    readResearch: vi.fn(async () => f.snapshot), verifyMailbox: vi.fn(async () => ({})), readThread: vi.fn(async () => f.thread!),
    isSuppressed: vi.fn(async () => false), suppress: vi.fn(async () => ({ persisted: true })), now };
  return { ...f, job, jobPath, db, hooks, deps, learningMemory, source, sourcePath, hypothesis };
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(communicationsNow); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

async function freezeLegacy(f: Awaited<ReturnType<typeof setup>>) {
  await f.hooks.prepareNativeJob("communications", f.jobPath, [f.job.prospectId]);
  await f.db.doc(f.jobPath).update({ checkpoint: { createClaimedAt: new Date(communicationsNow-1000).toISOString(),
    sessionId: "original-session", turnId: "original-turn", requestDigest: "a".repeat(64) } });
}

describe("communications retains legacy history and new sessions choose history tools", () => {
  it("keeps one prospective session owned beyond the short lease and exposes its frozen 20-minute clock", async () => {
    const f = await setup({ liveClock: true });
    vi.spyOn(f.deps.store, "renewLease").mockRejectedValueOnce(Error("temporary datastore unavailable"));
    let complete!: () => void, entered!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; });
    const pending = new Promise<void>(resolve => { complete = resolve; });
    (f.deps.api.run as any).mockImplementationOnce(async (params: any) => {
      await params.saveCheckpoint({ ...params.checkpoint, createClaimedAt: new Date().toISOString(), sessionId: "owned-session", turnId: "owned-turn", requestDigest: "a".repeat(64) });
      entered(); await pending; await params.assertRepairAllowed();
      return { output: f.output, checkpoint: f.db.records.get(f.jobPath).checkpoint, usage: { input_tokens: 10 } };
    });
    const result = processCommunicationsJob(f.job.jobId, f.deps); await started;
    const original = structuredClone(f.db.records.get(f.jobPath).checkpoint);
    await vi.advanceTimersByTimeAsync(240000);
    const running = f.db.records.get(f.jobPath);
    expect(running).toMatchObject({ state: "running", attempts: 1, checkpoint: original });
    expect(running.lease.until).toBeGreaterThan(Date.now());
    expect(JSON.parse((f.deps.api.run.mock.calls as any)[0][0].input).executionBoundary.window).toEqual({
      version: "communications-execution-window-v1", preparedAt: new Date(communicationsNow).toISOString(),
      deadlineAt: new Date(communicationsNow + 1200000).toISOString(), timeoutSeconds: 1200 });
    complete(); expect(await result).toMatchObject({ state: "pending_approval", sent: false, gmailDraftCreated: false });
    expect(f.deps.api.run).toHaveBeenCalledTimes(1); expect(f.deps.api.cancel).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("requests cancellation once at a configured new-session deadline without claiming a terminal provider result", async () => {
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_EXECUTION_TIMEOUT_SECONDS", "180");
    const f = await setup({ liveClock: true }); let entered!: () => void, stop!: (error: unknown) => void;
    const started = new Promise<void>(resolve => { entered = resolve; });
    const pending = new Promise<never>((_, reject) => { stop = reject; });
    (f.deps.api.run as any).mockImplementationOnce(async (params: any) => {
      await params.saveCheckpoint({ ...params.checkpoint, createClaimedAt: new Date().toISOString(), sessionId: "owned-session", turnId: "owned-turn", requestDigest: "a".repeat(64) });
      entered(); return pending;
    });
    f.deps.api.cancel.mockImplementationOnce(async () => { stop(new CommunicationsRuntimeError("communications_execution_deadline")); return true; });
    const result = processCommunicationsJob(f.job.jobId, f.deps); await started;
    await vi.advanceTimersByTimeAsync(180000);
    expect(await result).toMatchObject({ state: "blocked", reason: "communications_deadline_cancel_requested" });
    expect(f.deps.api.cancel).toHaveBeenCalledTimes(1);
    expect(f.db.records.get(f.jobPath).checkpoint).toMatchObject({ sessionId: "owned-session", executionWindow: { timeoutSeconds: 180 } });
    expect(f.db.records.get(f.jobPath).checkpoint.finalRepairSettled).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("refuses renewal by a different owner and invalid prospective timing before inference", async () => {
    const f = await setup({ liveClock: true }); const claimed = await f.deps.store.claim(f.job.jobId);
    const window = { version: "communications-execution-window-v1" as const, preparedAt: new Date().toISOString(),
      deadlineAt: new Date(Date.now() + 1200000).toISOString(), timeoutSeconds: 1200 };
    await f.db.doc(f.jobPath).update({ checkpoint: { ...claimed!.checkpoint, executionWindow: window }, lease: { owner: "replacement-owner", until: Date.now() + 180000 } });
    await expect(f.deps.store.renewLease(f.job.jobId, window)).rejects.toThrow("communications_lease_lost");
    expect(f.db.records.get(f.jobPath).lease.owner).toBe("replacement-owner");
    const next = await setup(); vi.stubEnv("BLUEPRINT_COMMUNICATIONS_EXECUTION_TIMEOUT_SECONDS", "unbounded");
    expect(await processCommunicationsJob(next.job.jobId, next.deps)).toMatchObject({ state: "blocked", reason: "communications_execution_window_invalid" });
    expect(next.deps.api.run).not.toHaveBeenCalled();
  });
  it("new sessions do not require a frozen relevance preload and keep after-work observation", async () => {
    const f = await setup(); f.deps.learningHooks.prepareNativeJob.mockRejectedValueOnce(Error("legacy eligibility unavailable"));
    expect(await processCommunicationsJob(f.job.jobId, f.deps)).toMatchObject({state:"pending_approval",sent:false});
    expect(f.deps.learningHooks.prepareNativeJob).not.toHaveBeenCalled();
    expect(JSON.parse(f.deps.api.run.mock.calls[0][0].input).learningHistory).toBeUndefined();
    expect(f.deps.learningHooks.afterNativeWork).toHaveBeenCalledTimes(1);
    expect(f.learningMemory.writes.some(path=>path.startsWith(`${LEARNING_ROOT}/nativeLearningInputs/`))).toBe(false);
  });
  it("preserves an already charged legacy frozen exact-prospect handoff and records the persisted draft afterward", async () => {
    const f = await setup(); await freezeLegacy(f);
    expect(await processCommunicationsJob(f.job.jobId, f.deps)).toMatchObject({ state: "pending_approval", sent: false });
    expect(f.deps.learningHooks.prepareNativeJob).toHaveBeenCalledExactlyOnceWith("communications", f.jobPath, [f.job.prospectId], { allowCreate: false });
    expect(f.deps.learningHooks.prepareNativeJob.mock.invocationCallOrder[0]).toBeLessThan(f.deps.api.run.mock.invocationCallOrder[0]);
    expect(f.deps.learningHooks.afterNativeWork.mock.invocationCallOrder[0]).toBeGreaterThan(f.deps.api.run.mock.invocationCallOrder[0]);
    const input = JSON.parse(f.deps.api.run.mock.calls[0][0].input), h = input.learningHistory;
    expect(input.executionBoundary).toBeUndefined();
    expect(f.db.records.get(f.jobPath).checkpoint.executionWindow).toBeUndefined();
    expect(h).toMatchObject({ trust: "untrusted_evidence_only", sourceChecksRefreshed: false, preparedAt: new Date(communicationsNow).toISOString(), unknown: null });
    expect(h.priorContactAndOutcomes.prospects.map((row: any) => row.prospectId)).toEqual([f.job.prospectId]);
    expect(h.priorContactAndOutcomes.prospects[0].historyCount).toBeGreaterThan(0);
    expect(h.priorContactAndOutcomes.missingRecordsMean).toBe("unknown_not_no_contact_no_reply_or_rejection");
    expect(f.db.records.get(h.recordRef).inputHash).toBe(h.inputHash);
    expect(JSON.stringify(input)).not.toMatch(/PRIVATE_CANONICAL_SENTINEL|UNRELATED_PRIVATE_SENTINEL|unrelated-prospect/);
    expect(input.researchBrief.facts[0].sourceCheckedAt).toBe(f.brief.facts[0].sourceCheckedAt);
    expect(h.businessHistory.hypotheses[0]).toMatchObject({ eventId: f.hypothesis.eventId, status: "provisional", causalProof: false,
      hardFilterProspects: false, occurredAt: "2026-09-30T21:00:00.000Z" });
    expect(f.db.records.get(`action_ledger/communications_${f.job.jobId}`).action_payload.body).not.toContain("SYNTHETIC_BUSINESS_CONTEXT");
    const summaries = [...f.db.records.values()].filter(row => row.kind === "run_summary");
    expect(summaries).toHaveLength(1); expect(summaries[0]).toMatchObject({ state: "pending_approval", prospectIds: [f.job.prospectId],
      counts: { acceptedTouches: null, repliedProspects: null }, paidAnalysisCalls: 0 });
    expect(summaries[0].sources[0].sourceHash).toBe(digest(f.db.records.get(f.jobPath)));
    expect(f.db.records.get(`action_ledger/communications_${f.job.jobId}`)).toMatchObject({ status: "pending_approval", action_tier: 3, approved_by: null });
  });
  it("freezes unavailable context as unknown without blocking and reuses it when source data later appears", async () => {
    const f = await setup({ sourceMissing: true }); await freezeLegacy(f);
    f.deps.api.run.mockRejectedValueOnce(new CommunicationsRuntimeError("agents_api_http_503", true));
    expect((await processCommunicationsJob(f.job.jobId, f.deps)).state).toBe("retry");
    const first = f.deps.api.run.mock.calls[0][0].input;
    expect(JSON.parse(first).learningHistory).toMatchObject({ unknown: "native_learning_context_unavailable" });
    f.learningMemory.records.set(f.sourcePath, f.source);
    await f.db.doc(f.jobPath).update({ lease: { owner: "communications-learning-owner", until: 0 }, nextAttemptAt: 0 });
    expect((await processCommunicationsJob(f.job.jobId, f.deps)).state).toBe("pending_approval");
    expect(f.deps.api.run.mock.calls[1][0].input).toBe(first);
    expect(f.learningMemory.writes.filter(path => path.startsWith(`${LEARNING_ROOT}/nativeLearningInputs/`))).toHaveLength(2);
  });
  it("does not add learning context to an unbound legacy session or replace its original checkpoint", async () => {
    const f = await setup({ checkpoint: true }), checkpoint = structuredClone(f.db.records.get(f.jobPath).checkpoint);
    expect((await processCommunicationsJob(f.job.jobId, f.deps)).state).toBe("pending_approval");
    expect(f.deps.learningHooks.prepareNativeJob).toHaveBeenCalledWith("communications", f.jobPath, [f.job.prospectId], { allowCreate: false });
    expect(JSON.parse(f.deps.api.run.mock.calls[0][0].input).learningHistory).toBeUndefined();
    expect(f.db.records.get(f.jobPath).checkpoint).toEqual(checkpoint);
    expect(f.learningMemory.writes.some(path => path.startsWith(`${LEARNING_ROOT}/nativeLearningInputs/`))).toBe(false);
  });
  it("explicit saved-output recovery observes the original result without creating a context, model request or new turn", async () => {
    const f = await setup({ checkpoint: true }), checkpoint = structuredClone(f.db.records.get(f.jobPath).checkpoint), rawHash = "b".repeat(64);
    f.deps.api.reconcileSaved.mockResolvedValueOnce({ output: f.output, checkpoint, usage: {}, outputSource: { rawOutputSha256: rawHash, normalizedMetadataPaths: [] } });
    expect((await recoverSavedCommunicationsDraft(f.job.jobId, rawHash, f.deps)).state).toBe("pending_approval");
    expect(f.deps.api.run).not.toHaveBeenCalled(); expect(f.deps.api.cancel).not.toHaveBeenCalled();
    expect(f.deps.learningHooks.prepareNativeJob).toHaveBeenCalledWith("communications", f.jobPath, [f.job.prospectId], { allowCreate: false });
    expect(f.db.records.get(f.jobPath).checkpoint).toEqual(checkpoint);
    expect(f.learningMemory.writes.some(path => path.startsWith(`${LEARNING_ROOT}/nativeLearningInputs/`))).toBe(false);
  });
  it("fails a changed persisted context before inference rather than admitting a rehashed replacement", async () => {
    const f = await setup(); await freezeLegacy(f); f.deps.api.run.mockRejectedValueOnce(new CommunicationsRuntimeError("agents_api_http_503", true));
    await processCommunicationsJob(f.job.jobId, f.deps);
    const first = JSON.parse(f.deps.api.run.mock.calls[0][0].input).learningHistory;
    const row = f.db.records.get(first.recordRef); row.preparedAt = "2026-09-30T21:00:00.000Z";
    await f.db.doc(f.jobPath).update({ lease: { owner: "communications-learning-owner", until: 0 }, nextAttemptAt: 0 });
    expect((await processCommunicationsJob(f.job.jobId, f.deps)).state).toBe("blocked");
    expect(f.deps.api.run).toHaveBeenCalledTimes(1);
    expect(f.db.records.has(`action_ledger/communications_${f.job.jobId}`)).toBe(false);
  });
  it("retains pending human approval when the post-native learning observation fails", async () => {
    const f = await setup(); f.deps.learningHooks.afterNativeWork.mockRejectedValueOnce(Error("offline_projection_failure"));
    expect((await processCommunicationsJob(f.job.jobId, f.deps)).state).toBe("pending_approval");
    expect(f.db.records.get(f.jobPath).state).toBe("pending_approval");
    expect(f.db.records.get(`action_ledger/communications_${f.job.jobId}`)).toMatchObject({ status: "pending_approval", approved_by: null });
  });
  it("does not read prompt history for a suppressed recipient and never changes suppression or consent", async () => {
    const f = await setup(), briefBefore = structuredClone(f.brief); f.deps.isSuppressed.mockResolvedValueOnce(true);
    expect((await processCommunicationsJob(f.job.jobId, f.deps)).state).toBe("blocked");
    expect(f.deps.learningHooks.prepareNativeJob).not.toHaveBeenCalled(); expect(f.deps.api.run).not.toHaveBeenCalled();
    expect(f.deps.suppress).not.toHaveBeenCalled(); expect(f.db.records.get(`${COMMUNICATIONS_ROOT}/briefs/${f.brief.briefId}`)).toEqual(briefBefore);
  });
  it("retains large frozen context by hash/reference without creating an input-size draft gate", async () => {
    const f = await setup(), prepared = await f.hooks.prepareNativeJob("communications", f.jobPath, [f.job.prospectId]);
    if (!prepared?.handoff) throw Error("expected real prepared history");
    const large = structuredClone(prepared); large.handoff.unknowns.push("synthetic_large_history".repeat(4000));
    const input = JSON.parse(buildCommunicationsInput(f.brief, null, "outreach", {}, large));
    expect(input.learningHistory).toMatchObject({ recordRef: prepared.recordRef, inputHash: prepared.inputHash,
      unknown: "native_learning_context_exceeds_inline_budget", sourceChecksRefreshed: false });
    expect(Buffer.byteLength(JSON.stringify(input))).toBeLessThan(64000);
    expect(input.researchBrief).toEqual(f.brief);
  });
});
