// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, default: {} }));
import { HYPOTHESIS_DRAFTS_FLAG, runCommunicationsIntake } from "../agents/communications-intake";
import { processCommunicationsJob, recoverSavedCommunicationsDraft } from "../agents/communications-worker";
import { reviseCommunicationsDraft } from "../agents/communications-draft-revision";
import { CommunicationsStore } from "../agents/communications-store";
import { communicationsBriefSchema, communicationsDigest } from "../agents/communications-contract";
import { COMMUNICATIONS_FOUNDER_GUIDANCE, COMMUNICATIONS_FRAMING_VERSION, COMMUNICATIONS_FRAMING_V2, COMMUNICATIONS_AUDIENCE_ROLES, communicationsLaunchFraming } from "../agents/communications-launch-framing";
import { reviewCommunicationsPayload } from "../agents/communications-review";
import { COMMUNICATIONS_HYPOTHESIS_PROFILE } from "../agents/communications-saved-agent";
import { launchHypothesisDraft as hypothesisDraft, archivedLaunchHypothesisDraft, hypothesisDraft as archivedHypothesisDraft, hypothesisSetup } from "./fixtures/hypothesis";

// Invented operators, *.example hosts and synthetic evidence only. The model is a mock; no network or mailbox.
afterEach(() => { vi.unstubAllEnvs(); });

async function admitted(options: Parameters<typeof hypothesisSetup>[0] = {}) {
  vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "true");
  const f = hypothesisSetup(options);
  await f.workItem(); await runCommunicationsIntake(f.deps);
  const intake = f.hypothesisIntake();
  const brief = communicationsBriefSchema.parse(f.records("briefs").find(item => item.briefId === intake.briefId));
  const verifiedJob = f.records("jobs").find(job => job.prospectId !== brief.prospectId);
  const store = new CommunicationsStore(f.db, f.deps.now, "drafting-owner");
  let output = hypothesisDraft(brief);
  const seen: { input: any; checkpoint: any; feedback: unknown }[] = [];
  const api = { run: vi.fn(async (params: any) => {
    if (params.checkpoint.writingProfile && output.outreachContract?.version === "blueprint.outreach.v4") (output.outreachContract as any).version = "blueprint.outreach.v5";
    seen.push({ input: JSON.parse(params.input), checkpoint: structuredClone(params.checkpoint), feedback: await params.validateOutput?.(output) });
    return { output, checkpoint: params.checkpoint, usage: { input_tokens: 1 } };
  }), cancel: vi.fn(async () => true), reconcileSaved: vi.fn(async () => null as any) };
  const deps = { ...f.deps, store, api, verifyMailbox: vi.fn(), readThread: vi.fn(), suppress: vi.fn(async () => ({ persisted: true })) };
  return { f, intake, brief, verifiedJob, store, api, deps, seen, setOutput: (value: typeof output) => { output = value; } };
}
/** The verified row's own v1 draft, as the phase-1 intake test writes it. */
function verifiedOutput(h: Awaited<ReturnType<typeof admitted>>) {
  const verifiedBrief = communicationsBriefSchema.parse(h.f.records("briefs").find(item => item.briefId === h.verifiedJob.briefId));
  const output = structuredClone(h.f.output);
  output.usedFactIds = [verifiedBrief.facts[0].id];
  output.body = output.body.replace((output.outreachContract as any).question, verifiedBrief.contact.learningQuestion);
  (output.outreachContract as any).question = verifiedBrief.contact.learningQuestion;
  return output;
}

describe("drafting v2 for outreach-ready hypotheses (synthetic)", () => {
  it("accepts a natural future-oriented interest question without requiring the suggested wording or why", async () => {
    const h = await admitted(), output = hypothesisDraft(h.brief), old = (output.outreachContract as any).questions[0].question;
    const question = "Would exploring the options for that work be useful, even if it is just to prepare for later?";
    output.body = output.body.replace(old, question);
    const contract = output.outreachContract as any;
    contract.questions[0].question = question; contract.opening.relevance = question; contract.recipientChoice = question;
    h.setOutput(output);
    expect(await processCommunicationsJob(h.intake.jobId, h.deps)).toMatchObject({ state: "pending_approval", sent: false });
    expect(h.seen[0].feedback).toBeNull();
    expect(h.seen[0].input.writingGuidance).toContain("Ask one easy question");
    expect(h.seen[0].input.firstTouchFraming.questionIsSuggestion).toBe(true);
    const job = h.f.records("jobs").find(job => job.jobId === h.intake.jobId);
    expect(job.writingQuality).toMatchObject({ advisoryOnly: true, signals: [] });
  });
  it.each(["blueprint.outreach-framing.v1", COMMUNICATIONS_FRAMING_V2])("replays a charged %s draft with its historical instructions and question", async framingVersion => {
    const h = await admitted(), original = h.f.records("jobs").find(job => job.jobId === h.intake.jobId);
    const checkpoint = { ...original.checkpoint, framingVersion, draftProfile: COMMUNICATIONS_HYPOTHESIS_PROFILE,
      draftWritingGuidance: "retained historical guidance", createClaimedAt: new Date(h.deps.now()).toISOString(),
      sessionId: "synthetic-retained-session", turnId: "synthetic-retained-turn" };
    h.f.db.records.set(`blueprintCommunications/default/jobs/${h.intake.jobId}`, { ...original, checkpoint });
    h.setOutput(archivedLaunchHypothesisDraft(h.brief));
    expect(await processCommunicationsJob(h.intake.jobId, h.deps)).toMatchObject({ state: "pending_approval", sent: false });
    expect(h.seen[0].feedback).toBeNull();
    expect(h.seen[0].input.writingGuidance).toBe("retained historical guidance");
    expect(h.seen[0].checkpoint.framingVersion).toBe(framingVersion);
    expect(h.seen[0].input.firstTouchFraming.question).toContain("and if so, why?");
  });
  it.each(["El Paso versus Ubly", "San Antonio versus Muskogee"])("holds a recipient-site conflict (%s) before the generator even when the email is deliverable", async conflict => {
    const h = await admitted();
    const priorDigest = communicationsDigest(h.brief);
    h.brief.conflicts = [`A deliverable address belongs to a person at another site: ${conflict}. Site authority is unresolved.`];
    const digest = communicationsDigest(h.brief), jobPath = `blueprintCommunications/default/jobs/${h.intake.jobId}`;
    h.f.db.records.set(`blueprintCommunications/default/briefs/${h.brief.briefId}`, h.brief);
    h.f.db.records.set(`blueprintCommunications/default/handoffs/${digest}`, {
      ...h.f.db.records.get(`blueprintCommunications/default/handoffs/${priorDigest}`), briefDigest: digest,
    });
    h.f.db.records.set(jobPath, { ...h.f.db.records.get(jobPath), briefDigest: digest });
    expect(await processCommunicationsJob(h.intake.jobId, h.deps)).toEqual({ state: "awaiting_research", reasons: ["conflicting_evidence"] });
    expect(h.api.run).not.toHaveBeenCalled();
    expect([...h.f.db.records.keys()].some(path => path.startsWith("action_ledger/"))).toBe(false);
  });
  it.each(COMMUNICATIONS_AUDIENCE_ROLES)("reviews the retained %s role against its own launch question", async audienceRole => {
    const h = await admitted(), result: any = await processCommunicationsJob(h.intake.jobId, h.deps);
    const payload = structuredClone(h.f.db.records.get(`action_ledger/${result.ledgerId}`).action_payload);
    payload.communications.brief.audienceRole = audienceRole;
    payload.communications.job.briefDigest = communicationsDigest(payload.communications.brief);
    const output = hypothesisDraft(payload.communications.brief);
    Object.assign(payload, { transportBody: payload.transportBody.replace(payload.body, output.body),
      body: output.body, outreachContract: output.outreachContract });
    payload.communications.output = output;
    expect(reviewCommunicationsPayload(payload, h.deps.now())).toMatchObject({ hardChecksPassed: true, blockers: [] });
    expect((output.outreachContract as any).questions[0].question).toBe(communicationsLaunchFraming(payload.communications.brief).question);
  });
  it("gives a useful same-session repair for an archived contract returned to a fresh launch request", async () => {
    const h = await admitted(); h.setOutput(archivedHypothesisDraft(h.brief));
    const result: any = await processCommunicationsJob(h.intake.jobId, h.deps);
    expect(h.seen[0].feedback).toEqual(expect.arrayContaining([expect.objectContaining({ code: "launch_contract_required",
      message: expect.stringContaining("blueprint.outreach.v5") })]));
    expect(result).toMatchObject({ state: "blocked", reason: "hypothesis_draft_contract_failed:launch_contract_required" });
    expect([...h.f.db.records.keys()].some(path => path.startsWith("action_ledger/"))).toBe(false);
  });
  it("drafts with the hypothesis guidance and session profile, to a human-review draft that never sends", async () => {
    const h = await admitted();
    const result: any = await processCommunicationsJob(h.intake.jobId, h.deps);
    expect(result).toMatchObject({ state: "pending_approval", sent: false, gmailDraftCreated: false });
    expect(h.api.run).toHaveBeenCalledOnce();
    const [{ input, checkpoint, feedback }] = h.seen;
    expect(input.firstTouchPolicy).not.toContain(COMMUNICATIONS_FOUNDER_GUIDANCE);
    expect(input.firstTouchPolicy).toContain("recipient-aware-writing-v5");
    expect(input.researchBrief.qualification.openQuestions).toEqual(h.brief.qualification!.openQuestions);
    expect(checkpoint.draftProfile).toBe(COMMUNICATIONS_HYPOTHESIS_PROFILE);
    expect(checkpoint.framingVersion).toBe(COMMUNICATIONS_FRAMING_VERSION);
    expect(input.firstTouchFraming).toEqual({ ...communicationsLaunchFraming(h.brief), guidance: input.writingGuidance, question: undefined, questionIsSuggestion: true });
    expect(feedback).toBeNull();
    const ledger = h.f.db.records.get(`action_ledger/${result.ledgerId}`);
    expect(ledger).toMatchObject({ status: "pending_approval", action_tier: 3, approved_by: null, sent_at: null,
      qualification_tier: "outreach_ready", send_authority: "none", approval_reason: "outreach_ready_hypothesis_draft_only" });
    expect(ledger).not.toHaveProperty("first_contact_authority");
    expect(ledger.action_payload.communications.brief.qualification).toEqual(h.brief.qualification);
  });

  it("keeps a hypothesis draft draft-only through a founder's revision", async () => {
    const h = await admitted();
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_FIRST_CONTACT_POSTAL_LINE", "Blueprint Robotics, Inc. · 1 Synthetic Road, Testville, TX 75001");
    const result: any = await processCommunicationsJob(h.intake.jobId, h.deps);
    h.f.advance(181000); // The drafting worker's lease has ended.
    const job = h.f.records("jobs").find(item => item.jobId === h.intake.jobId);
    const revised = { ...job.output, subject: "About sorting returned parcels at your site" };
    const saved = await reviseCommunicationsDraft(h.f.db, result.ledgerId, "Synthetic Operator 1",
      { expectedReviewDigest: job.reviewDigest, output: revised }, h.f.deps.now());
    expect(saved).toMatchObject({ state: "pending_approval", sent: false, review: { hardChecksPassed: true } });
    expect(h.f.db.records.get(`action_ledger/${result.ledgerId}`)).toMatchObject({ status: "pending_approval",
      qualification_tier: "outreach_ready", send_authority: "none", approval_reason: "outreach_ready_hypothesis_draft_only" });
    // A revision that breaks blueprint.outreach.v2 is kept for repair but stays draft only and fails review.
    const broken = { ...revised, body: `${revised.body}\n\nIs this the right inbox?` };
    const again = await reviseCommunicationsDraft(h.f.db, result.ledgerId, "Synthetic Operator 1",
      { expectedReviewDigest: saved.review.digest, output: broken }, h.f.deps.now());
    expect(again.review).toMatchObject({ hardChecksPassed: false, blockers: expect.arrayContaining(["exactly_one_initial_question_required"]) });
    expect(h.f.db.records.get(`action_ledger/${result.ledgerId}`)).toMatchObject({ approval_reason: "outreach_ready_hypothesis_draft_only",
      send_authority: "none" });
  });

  it("drafts nothing once hypothesis drafts are turned off: the queued job waits, with no session or paid create", async () => {
    const h = await admitted();
    vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "false");
    const job = () => h.f.records("jobs").find(item => item.jobId === h.intake.jobId);
    expect(await processCommunicationsJob(h.intake.jobId, h.deps)).toEqual({ state: "queued", reason: "hypothesis_drafts_disabled", sent: false });
    expect(job()).toMatchObject({ state: "queued", reason: "hypothesis_drafts_disabled", attempts: 0,
      checkpoint: { createClaimedAt: null, sessionId: null, turnId: null }, lease: { until: 0 } });
    expect(job().checkpoint).not.toHaveProperty("executionWindow");
    expect(await h.store.dueJobIds()).not.toContain(h.intake.jobId);
    // The operator's saved-output recovery waits too, and reads nothing from the provider.
    h.f.advance(15 * 60000 + 1);
    expect(await recoverSavedCommunicationsDraft(h.intake.jobId, "a".repeat(64), h.deps)).toMatchObject({ state: "queued", reason: "hypothesis_drafts_disabled" });
    for (const call of [h.api.run, h.api.reconcileSaved, h.api.cancel]) expect(call).not.toHaveBeenCalled();
    expect([...h.f.db.records.keys()].some(key => key.startsWith("action_ledger/"))).toBe(false);
    // The verified row's job on the same day still drafts with the flag off.
    h.setOutput(verifiedOutput(h));
    expect(await processCommunicationsJob(h.verifiedJob.jobId, h.deps)).toMatchObject({ state: "pending_approval" });
    expect(h.api.run).toHaveBeenCalledOnce();
    // Turned on again, the same job drafts once its wait ends.
    vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "true");
    h.setOutput(hypothesisDraft(h.brief));
    h.f.advance(15 * 60000 + 1);
    expect(await processCommunicationsJob(h.intake.jobId, h.deps)).toMatchObject({ state: "pending_approval", sent: false });
    expect(h.api.run).toHaveBeenCalledTimes(2);
    expect(h.seen[1].checkpoint.draftProfile).toBe(COMMUNICATIONS_HYPOTHESIS_PROFILE);
  });

  it("waits without inference when the flag turns off during published-research verification", async () => {
    const h = await admitted(), read = h.deps.readResearch.getMockImplementation()!;
    h.deps.readResearch.mockImplementation(async (...args: any[]) => {
      const snapshot = await read(...args as [string]);
      vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "false");
      return snapshot;
    });
    expect(await processCommunicationsJob(h.intake.jobId, h.deps)).toMatchObject({ state: "queued", reason: "hypothesis_drafts_disabled", sent: false });
    expect(h.api.run).not.toHaveBeenCalled();
    expect(h.f.records("jobs").find(job => job.jobId === h.intake.jobId)).toMatchObject({ attempts: 0, checkpoint: { sessionId: null, createClaimedAt: null } });
  });
  it("refuses repair after the flag turns off during async repair evidence checks, retaining the charged checkpoint", async () => {
    const h = await admitted();
    h.api.run.mockImplementation(async params => {
      const charged = { ...params.checkpoint, createClaimedAt: new Date(h.deps.now()).toISOString(), sessionId: "synthetic-paid-session", turnId: "synthetic-paid-turn" };
      await params.saveCheckpoint(charged);
      const read = h.deps.readResearch.getMockImplementation()!;
      h.deps.readResearch.mockImplementation(async (...args: any[]) => {
        const snapshot = await read(...args as [string]);
        vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "false");
        return snapshot;
      });
      await params.assertRepairAllowed();
      throw new Error("unexpected_repair_allowed");
    });
    expect(await processCommunicationsJob(h.intake.jobId, h.deps)).toMatchObject({ state: "queued", reason: "hypothesis_drafts_disabled", sent: false });
    expect(h.f.records("jobs").find(job => job.jobId === h.intake.jobId)).toMatchObject({ checkpoint: { sessionId: "synthetic-paid-session", turnId: "synthetic-paid-turn" } });
    expect([...h.f.db.records.keys()].some(key => key.startsWith("action_ledger/"))).toBe(false);
  });
  it("keeps verified drafting unchanged on the same day", async () => {
    const h = await admitted();
    h.setOutput(verifiedOutput(h));
    const outcome = await processCommunicationsJob(h.verifiedJob.jobId, h.deps);
    expect(outcome).toMatchObject({ state: "pending_approval" });
    const [{ input, checkpoint }] = h.seen;
    expect(input.firstTouchPolicy).not.toContain(COMMUNICATIONS_FOUNDER_GUIDANCE);
    expect(input.firstTouchPolicy).toContain("recipient-aware-writing-v5");
    expect(input.researchBrief).not.toHaveProperty("qualification");
    expect(checkpoint).not.toHaveProperty("draftProfile");
    const ledger = h.f.db.records.get(`action_ledger/communications_${h.verifiedJob.jobId}`);
    expect(ledger).toMatchObject({ status: "pending_approval", approval_reason: "footerless_draft_requires_delivery_review" });
    expect(ledger).not.toHaveProperty("qualification_tier");
    expect(ledger.send_authority).toBe("none");
  });

  it("gives a verified draft that carries the v2 contract the prospective value-contract repair, never the v2 review", async () => {
    const h = await admitted();
    const output = verifiedOutput(h);
    h.setOutput({ ...output, outreachContract: hypothesisDraft(h.brief).outreachContract });
    const result: any = await processCommunicationsJob(h.verifiedJob.jobId, h.deps);
    expect(result.state).not.toBe("blocked");
    expect(h.seen[0].feedback).toEqual([{ code: "outreach_contract_missing_or_invalid", path: "outreachContract",
      message: "Use blueprint.outreach.v6 with evidence-backed contract anchors for this recipient-aware profile." }]);
  });

  it("never applies automatic first contact to a hypothesis, even with every automation flag on", async () => {
    const h = await admitted();
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_AUTOMATIC_FIRST_CONTACT_ENABLED", "true");
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", "true");
    vi.stubEnv("BLUEPRINT_COMMUNICATIONS_FIRST_CONTACT_POSTAL_LINE", "Blueprint Robotics, Inc. · 1 Synthetic Road, Testville, TX 75001");
    const result: any = await processCommunicationsJob(h.intake.jobId, h.deps);
    expect(result).toMatchObject({ state: "pending_approval", sent: false });
    const job = h.f.records("jobs").find(item => item.jobId === h.intake.jobId);
    expect(job).not.toHaveProperty("automationPolicyVersion");
    expect(h.f.db.records.get(`action_ledger/${result.ledgerId}`)).toMatchObject({ status: "pending_approval", auto_approve_reason: null });
  });

  it("gives the writer repairable feedback for blueprint.outreach.v2 issues", async () => {
    const h = await admitted();
    const draft = hypothesisDraft(h.brief);
    h.setOutput({ ...draft, body: `${draft.body}\n\nAre you the right person to ask?` });
    await processCommunicationsJob(h.intake.jobId, h.deps);
    expect(h.seen[0].feedback).toEqual(expect.arrayContaining([expect.objectContaining({ code: "exactly_one_initial_question_required",
      path: "body" })]));
  });

  it.each<[string, (draft: ReturnType<typeof hypothesisDraft>) => ReturnType<typeof hypothesisDraft>, string]>([
    ["a second question", draft => ({ ...draft, body: `${draft.body}\n\nAre you the right person to ask?` }), "exactly_one_initial_question_required"],
    ["the verified-lead contract", draft => ({ ...draft, outreachContract: null }), "outreach_contract_missing_or_invalid"],
    ["unsupported pilot readiness", draft => ({ ...draft, body: `${draft.body}\nWe are pilot-ready.` }), "unsupported_readiness_or_supply"],
    ["free hardware", draft => ({ ...draft, body: `${draft.body}\nWe provide free hardware.` }), "unsupported_readiness_or_supply"],
  ])("rejects a final draft with %s: no ledger row, nothing copied or sent", async (_name, change, blocker) => {
    const h = await admitted();
    h.setOutput(change(hypothesisDraft(h.brief)));
    const result: any = await processCommunicationsJob(h.intake.jobId, h.deps);
    expect(result.state).toBe("blocked");
    expect(result.reason).toMatch(/^hypothesis_draft_contract_failed:|^communications_context_not_repairable:/);
    expect(result.reason).toContain(blocker);
    expect([...h.f.db.records.keys()].some(key => key.startsWith("action_ledger/"))).toBe(false);
  });

  it("stops before inference when the published hypothesis no longer verifies", async () => {
    const h = await admitted();
    h.f.snapshot.row.review.lead_verification.tier_evidence.pages = 9;
    const result: any = await processCommunicationsJob(h.intake.jobId, h.deps);
    expect(result).toMatchObject({ state: "blocked", reason: "outreach_ready_evidence_changed" });
    expect(h.api.run).not.toHaveBeenCalled();
  });
});
