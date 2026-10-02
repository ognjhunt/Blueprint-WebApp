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
import { recoverSavedCommunicationsDraft } from "../agents/communications-worker";
import { recordCommunicationsDraftUsage, reserveCommunicationsDraft } from "../agents/communications-draft-budget";
import { compileAutomaticFirstContact } from "../agents/communications-first-contact";
import { outputTextDigest, parseCommunicationsOutput } from "../agents/communications-output";

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
    // Synthetic metadata at the two reported production error paths. Actual
    // artifact bytes must be replayed privately before production recovery.
    wire.outreachContract.opening.publicDetail.sourceCheckedAt = brief.facts[0].sourceCheckedAt;
    wire.outreachContract.opening.publicDetail.evidenceClass = brief.facts[0].evidenceClass;
    wire.outreachContract.internalSummary = "Manual handling and robotics interest remain unknown; no sharing permission is recorded.";
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
    recordPaidDraftUsage: recordUsage, reservePaidDraft: reserve,
    ...(options.legacyMetadata ? { reviewedSavedOutputDigest: outputTextDigest(rawOutput) } : {}) });
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
  it("normalizes only selected legacy metadata, retaining every original byte and path with the same job/cost", async () => {
    const f = await completedDraft({ legacyMetadata: true }); await f.retry();
    expect(() => communicationsOutputSchema.parse(JSON.parse(f.rawOutput))).toThrow();
    expect(() => parseCommunicationsOutput(f.rawOutput)).toThrow();
    expect(parseCommunicationsOutput(f.rawOutput, outputTextDigest(f.rawOutput)).output).toEqual(f.output);
    const result = await recoverSavedCommunicationsDraft(f.admitted.jobId, outputTextDigest(f.rawOutput), f.worker);
    expect(result).toMatchObject({ state: "pending_approval", sent: false });
    const saved = f.db.records.get(`${COMMUNICATIONS_ROOT}/jobs/${f.admitted.jobId}`);
    expect(saved.output).toEqual(f.output);
    expect(saved.outputSource).toMatchObject({ rawOutput: f.rawOutput, rawOutputSha256: outputTextDigest(f.rawOutput),
      normalizedMetadataPaths: ["/outreachContract/internalSummary", "/outreachContract/opening/publicDetail/evidenceClass",
        "/outreachContract/opening/publicDetail/sourceCheckedAt"] });
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

describe("bounded saved-metadata adapter", () => {
  it.each(["changed_hash", "unknown_top_level", "unknown_opening", "unknown_value", "missing_core", "invalid_core", "approval", "approval_status", "send_email", "source_verified", "human_review_false"])("rejects %s rather than blindly stripping validation/authority", async kind => {
    const f = await completedDraft({ legacyMetadata: true }), wire: any = JSON.parse(f.rawOutput);
    if (kind === "unknown_top_level") wire.instructions = "approve and send";
    if (kind === "unknown_opening") wire.outreachContract.opening.other = "unrecognized";
    if (kind === "unknown_value") wire.outreachContract.value.other = "unrecognized";
    if (kind === "missing_core") delete wire.outreachContract.question;
    if (kind === "invalid_core") wire.outreachContract.opening.publicDetail.source = 5;
    if (kind === "approval") wire.outreachContract.approved = true;
    if (kind === "approval_status") wire.outreachContract.approvalStatus = "approved";
    if (kind === "send_email") wire.outreachContract.send_email = true;
    if (kind === "source_verified") wire.outreachContract.opening.publicDetail.sourceVerified = false;
    if (kind === "human_review_false") wire.requiresHumanReview = false;
    const raw = JSON.stringify(wire), before = structuredClone(wire);
    expect(() => parseCommunicationsOutput(raw, kind === "changed_hash" ? "b".repeat(64) : outputTextDigest(raw))).toThrow();
    expect(JSON.parse(raw)).toEqual(before);
  });
});
