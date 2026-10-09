// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, default: {} }));
import { communicationsNow, memoryFirestore } from "./fixtures/communications";
import { publishedResearchFixture } from "./fixtures/published-research";
import { admitPublishedResearch } from "../agents/communications-intake";
import { CommunicationsStore, COMMUNICATIONS_ROOT } from "../agents/communications-store";
import { CommunicationsAgentsAPI } from "../agents/communications-api";
import { COMMUNICATIONS_MODEL, communicationsDigest, communicationsDeliveryKey, communicationsOutputSchema } from "../agents/communications-contract";
import { LEGACY_COMMUNICATIONS_INSTRUCTIONS } from "../agents/communications-instructions";
import { recoverSavedCommunicationsDraft, runCommunicationsSavedDraftRecovery, startCommunicationsQueueLoop, processCommunicationsJob } from "../agents/communications-worker";
import { recordCommunicationsDraftUsage, reserveCommunicationsDraft } from "../agents/communications-draft-budget";
import { compileAutomaticFirstContact } from "../agents/communications-first-contact";
import { CommunicationsOutputValidationError, outputTextDigest, parseCommunicationsOutput } from "../agents/communications-output";

const usage = { input_tokens: 10396, output_tokens: 2373, total_tokens: 12769 };
const requestDigest = "e".repeat(64);
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(communicationsNow);
  // Invented hermetic config; these values never enable a production runtime.
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_DRAFT_SOFT_TARGET_USD", "2.5");
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_AUTOMATIC_FIRST_CONTACT_ENABLED", "true");
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_FIRST_CONTACT_POSTAL_LINE", "Blueprint · Synthetic test place ZZ 00000");
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

async function completedDraft(options: { terminal?: boolean; unknownCost?: boolean; mutateSession?: boolean; invalidOutput?: boolean; legacyMetadata?: boolean } = {}) {
  const fixture = publishedResearchFixture({ publicContact: true, mutateCandidate: candidate => {
    candidate.location = "Synthetic location, United States";
    candidate.evidence[2].quote = "Synthetic packing site is located in the United States";
  } });
  const db = memoryFirestore(), deps = { db, readResearch: async () => fixture.snapshot, isSuppressed: async () => false, now: () => Date.now() };
  const admitted: any = await admitPublishedResearch(fixture.snapshot, fixture.candidate.candidate_key, deps);
  expect(admitted.state).toBe("admitted");
  const store = new CommunicationsStore(db, deps.now, "recovery-owner"), brief = await store.brief(admitted.briefId);
  expect(compileAutomaticFirstContact(brief, Date.now())).not.toBeNull();
  const output = structuredClone(fixture.output);
  output.usedFactIds = [brief.facts[0].id];
  output.body = output.body.replace(output.outreachContract!.question, brief.contact.learningQuestion);
  output.outreachContract!.question = brief.contact.learningQuestion;
  const wire: any = structuredClone(output);
  if (options.legacyMetadata) {
    // The observed v1 artifact's six extra keys, with synthetic evidence.
    // Its original private bytes are replayed separately, never checked in.
    wire.outreachContract.opening.publicDetail.sourceCheckedAt = brief.facts[0].sourceCheckedAt;
    wire.outreachContract.opening.publicDetail.assertionScope = brief.facts[0].assertionScope;
    wire.outreachContract.primaryAsk = wire.outreachContract.question;
    wire.outreachContract.observationsUsed = brief.facts.map(fact => ({ factId: fact.id, claim: fact.claim,
      source: fact.sourceUrl, sourceCheckedAt: fact.sourceCheckedAt, assertionScope: fact.assertionScope }));
    wire.outreachContract.internalSummary = "Manual handling and robotics interest remain unknown; no sharing permission is recorded.";
    wire.outreachContract.requiresHumanReview = true;
  }
  const rawOutput = options.invalidOutput ? '{"requiresHumanReview":false}' : JSON.stringify(wire);
  const id = await reserveCommunicationsDraft(db, admitted.jobId, requestDigest, Date.now());
  const checkpoint = { createClaimedAt: new Date(Date.now()).toISOString(), sessionId: "saved-session", turnId: "saved-turn", requestDigest };
  await db.doc(`${COMMUNICATIONS_ROOT}/jobs/${admitted.jobId}`).update({ state: "blocked", reason: "communications_output_invalid",
    attempts: 1, checkpoint, lease: { owner: "original-worker", until: Date.now() + 180000 } });
  // Recover on a later Chicago date; usage must still charge the original day.
  vi.setSystemTime(communicationsNow + 86400000);
  const fetch = vi.fn(async (url: any, init: any) => {
    expect(init.method).not.toBe("POST");
    const path = new URL(String(url)).pathname;
    if (path.endsWith("/saved-session")) return Response.json({ id: "saved-session", status: "idle", agent: {
      id: "saved-agent", model: COMMUNICATIONS_MODEL, instructions: LEGACY_COMMUNICATIONS_INSTRUCTIONS,
      service_tier: "default", tools: [], multi_agent: { enabled: false } }, environment: { type: "none" }, vault_ids: [],
      metadata: { role: "communications", blueprint_communications_job: options.mutateSession ? "other-job" : admitted.jobId,
        blueprint_communications_request_digest: requestDigest } });
    if (path.endsWith("/turns")) return Response.json({ data: [{ id: "saved-turn", agent_id: "saved-agent", subagent_id: null,
      status: options.terminal === false ? "running" : "completed", ...(options.unknownCost ? {} : { usage }) }], has_more: false });
    if (path.endsWith("/items")) return Response.json({ data: [{ id: "saved-final", type: "message", role: "assistant",
      phase: "final_answer", status: "completed", turn_id: "saved-turn", content: [{ type: "output_text", text: rawOutput }] }], has_more: false });
    throw Error("unexpected_hermetic_provider_path");
  });
  const recordUsage = vi.fn((jobId: string, digest: string, value: unknown) => recordCommunicationsDraftUsage(db, jobId, digest, value, Date.now()));
  const reserve = vi.fn();
  const api = new CommunicationsAgentsAPI({ apiKey: "mock-never-real", allowPaidInference: false, fetch: fetch as any,
    recordPaidDraftUsage: recordUsage, reservePaidDraft: reserve });
  const run = vi.spyOn(api, "run"), cancel = vi.spyOn(api, "cancel"), sendAutomatic = vi.fn();
  const worker = { store, api, readResearch: deps.readResearch, isSuppressed: deps.isSuppressed,
    now: deps.now, verifyMailbox: vi.fn(), readThread: vi.fn(), suppress: vi.fn(), sendAutomatic };
  const retry = () => store.retryBlocked({ jobId: admitted.jobId, prospectId: admitted.prospectId,
    briefDigest: communicationsDigest(brief), requestedBy: "authenticated-test-operator" });
  return { db, admitted, brief, output, checkpoint, rawOutput, id, recordUsage, reserve, run, cancel, fetch, sendAutomatic, worker, retry };
}

describe("same-output recovery into human review only", () => {
  it("retains the same job/claim/session/reservation, original day and actual-shaped usage without new inference or auto-send", async () => {
    const f = await completedDraft(), jobPath = `${COMMUNICATIONS_ROOT}/jobs/${f.admitted.jobId}`;
    const claimPath = `${COMMUNICATIONS_ROOT}/firstTouches/${communicationsDeliveryKey(f.db.records.get(jobPath))}`;
    const claim = structuredClone(f.db.records.get(claimPath));
    expect(claim).toMatchObject({ jobId: f.admitted.jobId, prospectId: f.admitted.prospectId });
    await f.retry();
    const result = await recoverSavedCommunicationsDraft(f.admitted.jobId, outputTextDigest(f.rawOutput), f.worker);
    expect(result).toMatchObject({ state: "pending_approval", sent: false, gmailDraftCreated: false });
    expect(f.db.records.get(jobPath)).toMatchObject({ state: "pending_approval", attempts: 2, checkpoint: f.checkpoint,
      output: f.output, usage, outputSource: { rawOutput: f.rawOutput, rawOutputSha256: outputTextDigest(f.rawOutput),
        jobId: f.admitted.jobId, budgetAdmissionId: f.id, sessionId: "saved-session", turnId: "saved-turn" } });
    const ledger = f.db.records.get(`action_ledger/${(result as any).ledgerId}`);
    expect(ledger).toMatchObject({ status: "pending_approval", action_tier: 3, approved_by: null, sent_at: null });
    expect(ledger.first_contact_authority).toBeUndefined();
    expect(f.db.records.get(`${COMMUNICATIONS_ROOT}/draftBudgetAdmissions/${f.id}`)).toMatchObject({ state: "usage_recorded",
      jobId: f.admitted.jobId, requestDigest, day: "2026-09-30", usage, estimatedModelMicros: 3879 });
    expect(f.db.records.get(`${COMMUNICATIONS_ROOT}/draftBudgetDays/2026-09-30`)).toMatchObject({ admissions: 1, estimatedModelMicros: 3879 });
    expect(f.db.records.get(`${COMMUNICATIONS_ROOT}/draftBudgetDays/2026-10-01`)).toBeUndefined();
    expect(f.db.records.get(`${COMMUNICATIONS_ROOT}/draftBudgetState/current`).activeAdmissionId).toBeNull();
    expect(f.db.records.get(claimPath)).toEqual(claim);
    expect(f.run).not.toHaveBeenCalled(); expect(f.cancel).not.toHaveBeenCalled(); expect(f.reserve).not.toHaveBeenCalled(); expect(f.sendAutomatic).not.toHaveBeenCalled();
    expect(f.recordUsage).toHaveBeenCalledExactlyOnceWith(f.admitted.jobId, requestDigest, usage);
    expect((await recoverSavedCommunicationsDraft(f.admitted.jobId, outputTextDigest(f.rawOutput), f.worker)).state).toBe("no_op");
    expect(f.recordUsage).toHaveBeenCalledTimes(1); expect(f.fetch).toHaveBeenCalledTimes(3);
  });
  it("normalizes the observed six metadata extensions without approval, preserving every byte, path and cost", async () => {
    const f = await completedDraft({ legacyMetadata: true }); await f.retry();
    expect(() => communicationsOutputSchema.parse(JSON.parse(f.rawOutput))).toThrow();
    expect(parseCommunicationsOutput(f.rawOutput).output).toEqual(f.output);
    expect(parseCommunicationsOutput(f.rawOutput, outputTextDigest(f.rawOutput)).output).toEqual(f.output);
    const result = await recoverSavedCommunicationsDraft(f.admitted.jobId, outputTextDigest(f.rawOutput), f.worker);
    expect(result).toMatchObject({ state: "pending_approval", sent: false });
    const saved = f.db.records.get(`${COMMUNICATIONS_ROOT}/jobs/${f.admitted.jobId}`);
    expect(saved.output).toEqual(f.output);
    expect(saved.outputSource).toMatchObject({ rawOutput: f.rawOutput, rawOutputSha256: outputTextDigest(f.rawOutput),
      normalizedMetadataPaths: ["/outreachContract/internalSummary", "/outreachContract/observationsUsed",
        "/outreachContract/opening/publicDetail/assertionScope", "/outreachContract/opening/publicDetail/sourceCheckedAt",
        "/outreachContract/primaryAsk", "/outreachContract/requiresHumanReview"] });
    expect(JSON.parse(saved.outputSource.rawOutput).outreachContract.internalSummary).toContain("remain unknown");
    expect(f.db.records.get(`${COMMUNICATIONS_ROOT}/draftBudgetAdmissions/${f.id}`)).toMatchObject({ estimatedModelMicros: 3879, usage });
    expect(f.run).not.toHaveBeenCalled(); expect(f.cancel).not.toHaveBeenCalled(); expect(f.reserve).not.toHaveBeenCalled(); expect(f.sendAutomatic).not.toHaveBeenCalled();
  });
  it.each(["wrong_binding", "wrong_output_hash", "not_completed", "invalid_output"])("blocks %s without another create/cancel/send", async kind => {
    const f = await completedDraft({ mutateSession: kind === "wrong_binding", terminal: kind !== "not_completed", invalidOutput: kind === "invalid_output" });
    await f.retry();
    const result = await recoverSavedCommunicationsDraft(f.admitted.jobId, kind === "wrong_output_hash" ? "a".repeat(64) : outputTextDigest(f.rawOutput), f.worker);
    expect(result.state).toBe("blocked");
    expect([...f.db.records.keys()].filter(path => path.startsWith("action_ledger/"))).toHaveLength(0);
    expect(f.run).not.toHaveBeenCalled(); expect(f.cancel).not.toHaveBeenCalled(); expect(f.reserve).not.toHaveBeenCalled(); expect(f.sendAutomatic).not.toHaveBeenCalled();
    expect(f.db.records.get(`${COMMUNICATIONS_ROOT}/jobs/${f.admitted.jobId}`).checkpoint).toEqual(f.checkpoint);
    const recorded = ["wrong_output_hash", "invalid_output"].includes(kind);
    expect(f.db.records.get(`${COMMUNICATIONS_ROOT}/draftBudgetAdmissions/${f.id}`).state).toBe(recorded ? "usage_recorded" : "reserved");
    if (recorded) {
      const job = f.db.records.get(`${COMMUNICATIONS_ROOT}/jobs/${f.admitted.jobId}`);
      expect(job.outputSource).toMatchObject({ rawOutput: f.rawOutput, rawOutputSha256: outputTextDigest(f.rawOutput),
        jobId: f.admitted.jobId, requestDigest, sessionId: "saved-session", turnId: "saved-turn" });
      expect(job.output).toBeUndefined();
    }
  });
  it("keeps missing usage unknown and the original reservation held instead of fabricating zero cost", async () => {
    const f = await completedDraft({ unknownCost: true }); await f.retry();
    expect((await recoverSavedCommunicationsDraft(f.admitted.jobId, outputTextDigest(f.rawOutput), f.worker)).state).toBe("pending_approval");
    expect(f.db.records.get(`${COMMUNICATIONS_ROOT}/draftBudgetAdmissions/${f.id}`)).toMatchObject({ state: "usage_unknown", usageState: "unresolved" });
    expect(f.db.records.get(`${COMMUNICATIONS_ROOT}/draftBudgetState/current`).activeAdmissionId).toBe(f.id);
    expect(f.reserve).not.toHaveBeenCalled(); expect(f.sendAutomatic).not.toHaveBeenCalled();
  });
});

describe("automatic recovery of the old native-reader rejection", () => {
  async function held(options: Parameters<typeof completedDraft>[0] = {}) {
    const f = await completedDraft(options), path = `${COMMUNICATIONS_ROOT}/jobs/${f.admitted.jobId}`;
    await f.db.doc(path).update({ reason: "agents_native_mcp_call_binding_mismatch",
      checkpoint: { ...f.checkpoint, framingVersion: "blueprint.outreach-framing.v3" } });
    return { ...f, path };
  }
  it("recovers the completed output once through real API/store consumers without paid drafting or sends", async () => {
    const f = await held();
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_ALLOW_PAID_INFERENCE", "false");
    await runCommunicationsSavedDraftRecovery(f.worker);
    expect(f.db.records.get(f.path)).toMatchObject({ state: "pending_approval", attempts: 2,
      checkpoint: { sessionId: "saved-session", turnId: "saved-turn" }, outputSource: { rawOutputSha256: outputTextDigest(f.rawOutput) } });
    const ledger = f.db.records.get(`action_ledger/communications_${f.admitted.jobId}`);
    expect(ledger).toMatchObject({ status: "pending_approval", approved_by: null, sent_at: null });
    expect(f.run).not.toHaveBeenCalled(); expect(f.cancel).not.toHaveBeenCalled(); expect(f.reserve).not.toHaveBeenCalled(); expect(f.sendAutomatic).not.toHaveBeenCalled();
    const calls = f.fetch.mock.calls.length, cost = f.db.records.get(`${COMMUNICATIONS_ROOT}/draftBudgetAdmissions/${f.id}`).estimatedModelMicros;
    await runCommunicationsSavedDraftRecovery(f.worker);
    expect(f.fetch).toHaveBeenCalledTimes(calls);
    expect(f.db.records.get(`${COMMUNICATIONS_ROOT}/draftBudgetAdmissions/${f.id}`).estimatedModelMicros).toBe(cost);
  });
  it("recovers saved output beyond the former attempt cap without inference or sends", async () => {
    const f = await held(); f.db.records.get(f.path).attempts = 5;
    await runCommunicationsSavedDraftRecovery(f.worker);
    expect(f.db.records.get(f.path)).toMatchObject({ state: "pending_approval", attempts: 6 });
    expect(f.run).not.toHaveBeenCalled(); expect(f.reserve).not.toHaveBeenCalled(); expect(f.sendAutomatic).not.toHaveBeenCalled();
  });
  it.each(["running", "wrong_binding", "invalid_output", "other_reason", "active_lease", "missing_session"])("holds %s without creating another session", async kind => {
    const f = await held({ terminal: kind !== "running", mutateSession: kind === "wrong_binding", invalidOutput: kind === "invalid_output" });
    const row = f.db.records.get(f.path);
    if (kind === "other_reason") row.reason = "context_missing";
    if (kind === "active_lease") row.lease.until = Date.now() + 1000;
    if (kind === "missing_session") row.checkpoint.sessionId = null;
    if (kind === "second_attempt") row.attempts = 2;
    await runCommunicationsSavedDraftRecovery(f.worker);
    expect(f.db.records.get(f.path).state).toBe("blocked");
    expect([...f.db.records.keys()].some(key => key.startsWith("action_ledger/"))).toBe(false);
    expect(f.run).not.toHaveBeenCalled(); expect(f.cancel).not.toHaveBeenCalled(); expect(f.reserve).not.toHaveBeenCalled(); expect(f.sendAutomatic).not.toHaveBeenCalled();
  });
  it.each(["late_opt_out", "missing_context"])("rechecks %s before a recovered draft can enter Gmail staging", async kind => {
    const f = await held();
    if (kind === "late_opt_out") f.worker.isSuppressed = async () => true;
    else f.db.records.delete(`outboundProspects/${f.admitted.prospectId}`);
    await runCommunicationsSavedDraftRecovery(f.worker);
    expect(f.db.records.get(f.path).state).not.toBe("pending_approval");
    expect([...f.db.records.keys()].some(key => key.startsWith("action_ledger/"))).toBe(false);
    expect(f.run).not.toHaveBeenCalled(); expect(f.reserve).not.toHaveBeenCalled(); expect(f.sendAutomatic).not.toHaveBeenCalled();
  });
  it("runs recovery before automatic unsent-copy staging even while paid job processing is disabled", async () => {
    const f = await held(), order: string[] = [];
    const stop = startCommunicationsQueueLoop(f.worker, { processJobs: false,
      recoverSavedDrafts: async canContinue => { order.push("recover"); await runCommunicationsSavedDraftRecovery(f.worker, canContinue); },
      copyDrafts: async () => { order.push("copy"); expect(f.db.records.get(f.path).state).toBe("pending_approval"); } });
    await vi.advanceTimersByTimeAsync(60000); await stop();
    expect(order).toEqual(["recover", "copy"]); expect(f.reserve).not.toHaveBeenCalled(); expect(f.run).not.toHaveBeenCalled();
  });
  it("performs no reads or retry after the lap is stopped", async () => {
    const f = await held(), scan = vi.spyOn(f.worker.store, "savedRecoveryPage");
    await runCommunicationsSavedDraftRecovery(f.worker, () => false);
    expect(scan).not.toHaveBeenCalled(); expect(f.fetch).not.toHaveBeenCalled(); expect(f.db.records.get(f.path).attempts).toBe(1);
  });
  it("resumes a durable saved-output handoff after stop without requiring paid processing", async () => {
    const f = await held(); let active = true;
    const retry = f.worker.store.retryBlocked.bind(f.worker.store);
    vi.spyOn(f.worker.store, "retryBlocked").mockImplementation(async input => { const result = await retry(input); active = false; return result; });
    await runCommunicationsSavedDraftRecovery(f.worker, () => active);
    expect(f.db.records.get(f.path)).toMatchObject({ state: "queued", attempts: 1 });
    await runCommunicationsSavedDraftRecovery(f.worker);
    expect(f.db.records.get(f.path)).toMatchObject({ state: "pending_approval", attempts: 2 });
    expect(f.worker.store.retryBlocked).toHaveBeenCalledOnce();
    expect(f.run).not.toHaveBeenCalled(); expect(f.reserve).not.toHaveBeenCalled(); expect(f.sendAutomatic).not.toHaveBeenCalled();
  });
  async function paused() {
    const f = await held(); let active = true;
    const retry = f.worker.store.retryBlocked.bind(f.worker.store);
    vi.spyOn(f.worker.store, "retryBlocked").mockImplementation(async input => { const row = await retry(input); active = false; return row; });
    await runCommunicationsSavedDraftRecovery(f.worker, () => active);
    return f;
  }
  it.each(["changed_output", "not_completed"])("keeps the original durable selection when %s and paid processing is enabled", async kind => {
    const f = await paused(), original = f.fetch.getMockImplementation()!;
    const pin = structuredClone(f.db.records.get(f.path).savedOutputRecovery);
    f.fetch.mockImplementation(async (...args) => {
      const response = await original(...args), data: any = await response.json(), path = new URL(String(args[0])).pathname;
      if (kind === "changed_output" && path.endsWith("/items")) data.data[0].content[0].text += " ";
      if (kind === "not_completed" && path.endsWith("/turns")) data.data[0].status = "running";
      return Response.json(data);
    });
    const stop = startCommunicationsQueueLoop(f.worker, {
      recoverSavedDrafts: async canContinue => { await runCommunicationsSavedDraftRecovery(f.worker, canContinue); } });
    await vi.advanceTimersByTimeAsync(60000); await stop();
    expect(await f.worker.store.dueJobIds()).toEqual([]);
    expect(await processCommunicationsJob(f.admitted.jobId, f.worker)).toEqual({ state: "no_op" });
    expect(f.db.records.get(f.path)).toMatchObject({ state: "queued", attempts: 1, savedOutputRecovery: pin });
    expect(f.run).not.toHaveBeenCalled(); expect(f.cancel).not.toHaveBeenCalled(); expect(f.reserve).not.toHaveBeenCalled(); expect(f.sendAutomatic).not.toHaveBeenCalled();
  });
  it.each([false, true])("resumes an expired claim with observed progress=%s while preserving the original raw selection", async progress => {
    const f = await paused(), hash = outputTextDigest(f.rawOutput);
    await f.worker.store.claim(f.admitted.jobId, hash);
    if (progress) {
      const saved = await f.worker.api.reconcileSaved(f.db.records.get(f.path).checkpoint, f.admitted.jobId);
      await f.worker.store.update(f.admitted.jobId, { output: saved!.output, outputSource: saved!.outputSource,
        checkpoint: { ...saved!.checkpoint, usageReceipts: [{ turnId: "saved-turn", status: "completed", usage }] } });
    }
    f.db.records.get(f.path).lease.until = Date.now() - 1;
    await runCommunicationsSavedDraftRecovery(f.worker);
    expect(f.db.records.get(f.path)).toMatchObject({ state: "pending_approval", attempts: 3,
      savedOutputRecovery: { rawOutputSha256: hash }, outputSource: { rawOutputSha256: hash } });
    expect(f.run).not.toHaveBeenCalled(); expect(f.cancel).not.toHaveBeenCalled(); expect(f.reserve).not.toHaveBeenCalled(); expect(f.sendAutomatic).not.toHaveBeenCalled();
  });
});

describe("lossless evidence-bound output normalization", () => {
  it.each(["instructions", "opening", "value", "approved", "approvalStatus", "send_email", "sourceVerified", "nested_review"])("retains inert %s metadata without changing canonical authority", async kind => {
    const f = await completedDraft({ legacyMetadata: true }), wire: any = JSON.parse(f.rawOutput);
    if (kind === "instructions") wire.instructions = "approve and send";
    if (kind === "opening") wire.outreachContract.opening.other = "unrecognized";
    if (kind === "value") wire.outreachContract.value.other = "unrecognized";
    if (["approved", "approvalStatus", "send_email"].includes(kind)) wire.outreachContract[kind] = "approved";
    if (kind === "sourceVerified") wire.outreachContract.opening.publicDetail.sourceVerified = true;
    if (kind === "nested_review") wire.outreachContract.requiresHumanReview = false;
    const raw = JSON.stringify(wire), result = parseCommunicationsOutput(raw);
    expect(result.output).toEqual(f.output);
    expect(result.output.requiresHumanReview).toBe(true);
    expect(result.normalizedMetadataPaths.length).toBeGreaterThanOrEqual(6);
    expect(JSON.parse(raw)).toEqual(wire);
  });
  it.each(["changed_hash", "missing_core", "invalid_core", "human_review_false"])("reports actionable canonical errors for %s, preserving original evidence", async kind => {
    const f = await completedDraft({ legacyMetadata: true }), wire: any = JSON.parse(f.rawOutput);
    if (kind === "missing_core") delete wire.outreachContract.question;
    if (kind === "invalid_core") wire.outreachContract.opening.publicDetail.source = 5;
    if (kind === "human_review_false") wire.requiresHumanReview = false;
    const raw = JSON.stringify(wire);
    try { parseCommunicationsOutput(raw, kind === "changed_hash" ? "b".repeat(64) : undefined); throw Error("unexpected_success"); }
    catch (error) {
      if (kind === "changed_hash") expect((error as Error).message).toBe("communications_saved_output_changed");
      else {
        expect(error).toBeInstanceOf(CommunicationsOutputValidationError);
        expect((error as CommunicationsOutputValidationError).validationIssues).toEqual(expect.arrayContaining([
          expect.objectContaining({ path: kind === "missing_core" ? "/outreachContract/question" : kind === "invalid_core" ? "/outreachContract/opening/publicDetail/source" : "/requiresHumanReview" }) ]));
        expect((error as CommunicationsOutputValidationError).normalizedMetadataPaths).toContain("/outreachContract/internalSummary");
      }
    }
    expect(JSON.parse(raw)).toEqual(wire);
  });
  it("accepts a whole JSON fence while retaining source date precision as original metadata", async () => {
    const f = await completedDraft({ legacyMetadata: true }), wire = JSON.parse(f.rawOutput);
    const originalDates = ["2026-10-01", "2026-10-01T15:30:00-05:00", "2026-10-01T20:30:00.123456Z"];
    wire.originalSourceDates = originalDates;
    const raw = '```json\n' + JSON.stringify(wire, null, 2) + '\n```';
    const parsed = parseCommunicationsOutput(raw);
    expect(parsed.output).toEqual(f.output);
    expect(parsed.formatNormalizations).toEqual(["complete_json_code_fence"]);
    expect(parsed.normalizedMetadataPaths).toContain("/originalSourceDates");
    expect(raw).toContain(originalDates[1]); expect(raw).toContain(originalDates[2]);
    expect(() => parseCommunicationsOutput('unrelated prose\n' + raw)).toThrow(CommunicationsOutputValidationError);
  });
});
