// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, authAdmin: null, default: {} }));
const storage = vi.hoisted(() => ({ raw: "", generation: "1" }));
vi.mock("../utils/siteCaptureBundleStorage", () => ({ resolveBundleStorage: () => ({ bucketName: "blueprint-8c1ca.appspot.com",
  info: async () => ({ generation: storage.generation, size: Buffer.byteLength(storage.raw) }), readText: async () => storage.raw }) }));
import { communicationsFixture, communicationsNow, memoryFirestore } from "./fixtures/communications";
import { communicationsDigest } from "../agents/communications-contract";
import { CommunicationsStore, COMMUNICATIONS_ROOT } from "../agents/communications-store";
import { processCommunicationsJob, type CommunicationsDependencies } from "../agents/communications-worker";
import { prepareSameRunDraftSave, saveCommunicationsUnsentDraft, type GmailDraftPorts } from "../agents/communications-gmail-draft";
import { COMMUNICATIONS_AUDIENCE_ROLES, communicationsLaunchFraming, type CommunicationsAudienceRole } from "../agents/communications-launch-framing";
import { appendCommunicationsFooter } from "../agents/communications-first-contact-footer";

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
async function setup(role: CommunicationsAudienceRole = "site") {
  const f = communicationsFixture(), now = () => communicationsNow, db = memoryFirestore(), store = new CommunicationsStore(db, now, "synthetic-worker");
  f.brief.audienceRole = role; f.brief.unknowns.push("Closed-source model; early offer, interest, budget and deployment maturity unknown");
  f.job.briefDigest = communicationsDigest(f.brief); f.handoff.briefDigest = f.job.briefDigest;
  const framing = communicationsLaunchFraming(f.brief), contract = f.output.outreachContract as any;
  f.output.body = f.output.body.replace(contract.question, framing.question) + "\n\nNijel Hunt\nBlueprint"; contract.question = framing.question;
  await db.doc(`${COMMUNICATIONS_ROOT}/briefs/${f.brief.briefId}`).set(f.brief);
  await db.doc(`${COMMUNICATIONS_ROOT}/handoffs/${f.job.briefDigest}`).set(f.handoff);
  await db.doc(`outboundProspects/${f.brief.prospectId}`).set({ contactEmail: f.brief.contact.email, siteId: f.brief.siteId, taskId: f.brief.taskId, caseId: f.brief.caseId, stage: "drafted" });
  const { jobId: _, ...identity } = f.job, job = await store.enqueue(identity);
  const authority = { version: "blueprint.communications-gmail-draft-copy-direction.v2", owner: "Nijel Hunt", approvedAt: new Date(communicationsNow-1000).toISOString(), expiresAt: new Date(communicationsNow+60000).toISOString(),
    direction: { kind: "direct_current_chat_human_reply", text: "Save eligible prospective drafts in the same run", sourceRef: "gs://blueprint-8c1ca.appspot.com/operations/recovery/synthetic/direct-save-direction.json" },
    binding: { mailbox: "nijel@tryblueprint.io", composeApprovalReference: "synthetic-existing-compose" },
    scope: { draftOnly: true, gmailCopiesAuthorized: true, sendsAuthorized: false, newInferenceAuthorized: false, accessChangesAuthorized: false, saveWithinRun: true, prospectiveOnly: true } };
  storage.raw = JSON.stringify(authority); storage.generation = "1";
  await db.doc(COMMUNICATIONS_ROOT).set({ gmailDraftCopyDirection: { uri: "gs://blueprint-8c1ca.appspot.com/operations/recovery/synthetic/agent-e2e-gmail-draft-copy-owner-direction.json", generation: "1", sha256: communicationsDigest(authority) } });
  // The pinned object hash is over raw bytes, while business digests are canonical.
  const { createHash } = await import("node:crypto");
  db.records.get(COMMUNICATIONS_ROOT).gmailDraftCopyDirection.sha256 = createHash("sha256").update(storage.raw).digest("hex");
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_FIRST_CONTACT_POSTAL_LINE", "Blueprint Robotics, Inc. · Synthetic test location, ZZ 00000");
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", "false"); vi.stubEnv("BLUEPRINT_COMMUNICATIONS_AUTOMATIC_FIRST_CONTACT_ENABLED", "false");
  vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFTS_ENABLED", "false"); vi.stubEnv("BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFT_APPROVAL_REF", "synthetic-existing-compose");
  let copied: any = null;
  const ports: GmailDraftPorts = { enabled: () => false, allowsRevision: () => false, requireCapability: vi.fn(async () => {}), verifyMailbox: vi.fn(async () => ({})),
    priorContact: vi.fn(async () => false), recipientDraftExists: vi.fn(async () => false),
    write: vi.fn(async content => { copied = structuredClone(content); return { draftId: "synthetic-gmail-draft" }; }),
    find: vi.fn(async content => copied && communicationsDigest(content) === communicationsDigest(copied)
      ? { draftId: "synthetic-gmail-draft", messageId: "synthetic-message", threadId: "synthetic-thread", authoredRfcMessageId: content.messageId, observedRfcMessageId: "<synthetic@reserved.invalid>" } : null) };
  const api = { run: vi.fn(async (params: any) => {
    const input = JSON.parse(params.input); expect(input.firstTouchFraming).toEqual(framing);
    expect(input.writingGuidance).toContain("save_unsent_draft"); expect(input.firstTouchPolicy).toContain("No public API or deployment maturity hard gate");
    return { output: f.output, checkpoint: params.checkpoint, usage: { input_tokens: 10 } };
  }), cancel: vi.fn(async () => true), reconcileSaved: vi.fn(async () => null) };
  const deps: CommunicationsDependencies = { store, api, readResearch: async () => f.snapshot, verifyMailbox: async () => ({}), readThread: async () => f.thread!,
    isSuppressed: async () => false, suppress: async () => ({ persisted: true }), now,
    prepareDraftSave: () => prepareSameRunDraftSave(db, now, ports), saveUnsentDraft: (id, bound, canContinue) => saveCommunicationsUnsentDraft(db, id, bound, now, ports, canContinue) };
  return { ...f, db, job, deps, ports, api };
}
describe("one communications run saves and verifies the unsent Gmail draft", () => {
  it.each(COMMUNICATIONS_AUDIENCE_ROLES)("consumes %s framing then returns the real save action's verified draft ID", async role => {
    const f = await setup(role), result = await processCommunicationsJob(f.job.jobId, f.deps);
    expect(result).toMatchObject({ state: "gmail_draft_saved", gmailDraftId: "synthetic-gmail-draft", gmailDraftCreated: true, sent: false, approved: false });
    expect(f.api.run).toHaveBeenCalledOnce(); expect(f.ports.write).toHaveBeenCalledOnce();
    const copied = vi.mocked(f.ports.write).mock.calls[0][0];
    expect(copied.body).toContain("Blueprint Robotics, Inc. · Synthetic test location, ZZ 00000");
    expect(copied.body).toContain("Reply “no thanks” to stop all marketing emails from Blueprint.");
    expect(copied.body).toContain("Commercial outreach.");
    expect(f.db.records.get(`${COMMUNICATIONS_ROOT}/jobs/${f.job.jobId}`).output.body).toBe(f.output.body);
    expect(await processCommunicationsJob(f.job.jobId, f.deps)).toMatchObject({ state: "gmail_draft_saved" });
    expect(f.api.run).toHaveBeenCalledOnce(); expect(f.ports.write).toHaveBeenCalledOnce();
    expect(f.db.records.get(`action_ledger/communications_${f.job.jobId}`)).toMatchObject({ status: "pending_approval", approved_by: null, sent_at: null });
  });
  it("does no inference or Gmail write when the approved runtime postal configuration is unavailable", async () => {
    const f = await setup(); vi.stubEnv("BLUEPRINT_COMMUNICATIONS_FIRST_CONTACT_POSTAL_LINE", "");
    expect(await processCommunicationsJob(f.job.jobId, f.deps)).toMatchObject({ state: "blocked" });
    expect(f.api.run).not.toHaveBeenCalled(); expect(f.ports.write).not.toHaveBeenCalled();
  });
  it("retains the historical footer for an already charged same-run v1 checkpoint", async () => {
    const f = await setup(), bound = await f.deps.prepareDraftSave!();
    const checkpoint = { sameRunDraftSave: bound, framingVersion: "blueprint.outreach-framing.v3", createClaimedAt: new Date(communicationsNow).toISOString(),
      sessionId: "synthetic-existing-session", turnId: "synthetic-existing-turn",
      draftWritingGuidance: "save_unsent_draft" };
    f.db.records.get(`${COMMUNICATIONS_ROOT}/jobs/${f.job.jobId}`).checkpoint = checkpoint;
    f.deps.prepareDraftSave = vi.fn(async () => bound);
    const result = await processCommunicationsJob(f.job.jobId, f.deps);
    expect(result, JSON.stringify(result)).toMatchObject({ state: "gmail_draft_saved" });
    expect(f.deps.prepareDraftSave).not.toHaveBeenCalled();
    expect(vi.mocked(f.ports.write).mock.calls[0][0].body).toBe(appendCommunicationsFooter(f.output.body, f.brief.contact.email));
    expect(f.db.records.get(`${COMMUNICATIONS_ROOT}/jobs/${f.job.jobId}`).checkpoint.unsentDraftFooterProfile).toBeUndefined();
    expect(await processCommunicationsJob(f.job.jobId, f.deps)).toMatchObject({ state: "gmail_draft_saved" });
    expect(f.api.run).toHaveBeenCalledOnce(); expect(f.ports.write).toHaveBeenCalledOnce();
  });
  it("does no inference when existing compose capability is unavailable", async () => {
    const f = await setup(); vi.mocked(f.ports.requireCapability).mockRejectedValue(Error("founder_gmail_draft_capability_missing"));
    expect(await processCommunicationsJob(f.job.jobId, f.deps)).toMatchObject({ state: "blocked" });
    expect(f.api.run).not.toHaveBeenCalled(); expect(f.ports.write).not.toHaveBeenCalled();
  });
  it("propagates the active worker lap guard into the immediate save after model output", async () => {
    const f = await setup(); let continuing = true;
    vi.mocked(f.ports.priorContact).mockImplementation(async () => { continuing = false; return false; });
    expect(await processCommunicationsJob(f.job.jobId, f.deps, undefined, undefined, undefined, () => continuing))
      .toMatchObject({ state: "gmail_draft_pending", gmailDraftCreated: false });
    expect(f.api.run).toHaveBeenCalledOnce(); expect(f.ports.write).not.toHaveBeenCalled();
    expect(f.db.records.get(`${COMMUNICATIONS_ROOT}/jobs/${f.job.jobId}`)).toMatchObject({ state: "pending_approval", output: f.output });
  });
  it("keeps canonical output and accounting intact while an unverified Gmail readback remains pending", async () => {
    const f = await setup(), budgetPath = `${COMMUNICATIONS_ROOT}/draftBudgetState/current`, budget = { activeAdmissionId: "synthetic-unknown-liability", actualModelMicros: 14755 };
    f.db.records.set(budgetPath, budget); vi.mocked(f.ports.find).mockResolvedValue(null);
    expect(await processCommunicationsJob(f.job.jobId, f.deps)).toMatchObject({ state: "gmail_draft_pending", gmailDraftCreated: false });
    expect(f.db.records.get(`${COMMUNICATIONS_ROOT}/jobs/${f.job.jobId}`)).toMatchObject({ state: "pending_approval", output: f.output });
    expect(await processCommunicationsJob(f.job.jobId, f.deps)).toMatchObject({ state: "gmail_draft_pending" });
    expect(f.api.run).toHaveBeenCalledOnce(); expect(f.ports.write).toHaveBeenCalledOnce(); expect(f.db.records.get(budgetPath)).toEqual(budget);
  });
});
